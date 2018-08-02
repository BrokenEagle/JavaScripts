// ==UserScript==
// @name         CurrentUploads
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      8.2
// @source       https://danbooru.donmai.us/users/23799
// @description  Gives up-to-date stats on uploads
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/currentuploads.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.5.2/localforage.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.12.0/validate.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180723/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180723/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180723/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180723/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180723/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180723/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180723/lib/danbooru.js
// ==/UserScript==

/**GLOBAL VARIABLES**/

//Variables for debug.js
JSPLib.debug.debug_console = false;
JSPLib.debug.pretext = "CU:";
JSPLib.debug.level = JSPLib.debug.INFO;

//Variables for load.js
const program_load_required_variables = ['window.jQuery','window.Danbooru','Danbooru.Cookie','Danbooru.meta'];
const program_load_required_ids = ["top","page-footer"];

//Variables for danbooru.js
JSPLib.danbooru.counter_domname = "#loading-counter";

//Column headers of the count table
const column_headers = ['Name','Day','Week','Month','Year','All-time'];

//Value expirations
const expirations = {
    'd': 5 * JSPLib.utility.one_minute,
    'w': JSPLib.utility.one_hour,
    'mo': JSPLib.utility.one_day,
    'y': JSPLib.utility.one_week,
    'at': JSPLib.utility.one_month
};
const rti_expiration = JSPLib.utility.one_month; //one month

//Network call configuration
const max_post_limit_query = 100;
const max_network_requests = 25;
const rate_limit_wait = 500;

//Metrics used by statistics functions
const tooltip_metrics = ['score','upscore','downscore','favcount','tagcount','gentags'];

//Feedback messages
const empty_uploads_message_owner = 'Feed me more uploads!';
const empty_uploads_message_other = 'No uploads for this user.';
var empty_uploads_message = empty_uploads_message_owner;

//Placeholders for setting during program execution
var username;
var use_dummy_value;
var num_network_requests = 0;
var user_copytags = {};

//Style information
const program_css = `
#upload-counts {
    border: #EEE dotted;
    max-width: ${JSPLib.utility.max_column_characters + 35}em;
    margin-left: 2em;
}
#upload-counts.opened {
    border: lightgrey dotted;
}
#upload-counts.stashed {
    display: none;
}
#count-module {
    margin-bottom: 1em;
    display: none;
    border: lightgrey solid 1px;
}
#upload-counts.opened #count-module {
    display: block;
}
#count-table {
    white-space: nowrap;
}
#count-table.overflowed {
    max-height: 20em;
    overflow-x: hidden;
    overflow-y: auto;
}
#count-controls {
    margin-top: 1em;
    margin-left: 1em;
}
#count-query-user {
    margin: 0.5em;
}
#stash-count-notice {
    color: #D44;
    font-weight: bold;
    font-size: 80%;
}
#empty-uploads {
    margin: 1em;
    font-size: 200%;
    font-weight: bold;
    font-family: monospace;
}
#upload-counts.opened #upload-counts-toggle {
    margin: 0.5em;
}
#upload-counts-restore {
    display: none;
}
#upload-counts-restore.stashed {
    display: inline-block;
}
#upload-counts-restore a {
    color: green;
}
.tooltip {
    position: relative;
    display: inline-block;
    border-bottom: 1px dotted black;
    min-width: 2em;
    text-align: center;
}
.tooltip .tooltiptext {
    visibility: hidden;
    width: 80px;
    background-color: black;
    color: #fff;
    text-align: left;
    border-radius: 6px;
    padding: 5px;
    /* Position the tooltip */
    position: absolute;
    z-index: 1;
    top: -50px;
    left: 105%;
}
.tooltip:hover .tooltiptext.activetooltip {
    visibility: visible;
}
#count-table.overflowed tr:nth-child(1) .tooltiptext {
    top: -30px;
}
#count-table.overflowed tr:nth-child(2) .tooltiptext {
    top: -45px;
}
#count-table.overflowed tr:nth-last-child(2) .tooltiptext {
    top: -60px;
}
#count-table.overflowed tr:nth-last-child(1) .tooltiptext {
    top: -75px;
}
.select-tooltip a {
    color: grey;
    margin-right: 1em;
}
.select-tooltip.activetooltip a {
    font-weight: bold;
}
`;

//HTML for user interface
const notice_box = `
<div class="ui-corner-all" id="upload-counts">
    <div id="count-module">
        <div id="count-table">
        </div>
        <div id="count-controls">
        </div>
        <div id="count-query-user">
            <input id="count_query_user_id" placeholder="Check users" type="text">
            <input id="count_submit_user_id" type="submit" value="Submit" class="btn">
        </div>
    </div>
    <div id="upload-counts-toggle">
        <a href="#" id="hide-count-notice">Toggle Upload Table</a>&nbsp;(<a href="#" id="stash-count-notice">STASH</a>)
    </div>
</div>
`;

const unstash_notice = '<span id="upload-counts-restore"> - <a href="#" id="restore-count-notice">Restore CurrentUploads</a></span>';

//Validation values

const fix_expires_constraints = {
    presence: true,
    numericality: {
        onlyInteger: true,
        greaterThan: -1,
    }
}

const validation_constraints = {
    countentry: JSPLib.validate.postcount_constraints,
    implicationentry: JSPLib.validate.integer_constraints,
    postentries: JSPLib.validate.array_constraints,
    postentry: {
        id: JSPLib.validate.integer_constraints,
        score: JSPLib.validate.integer_constraints,
        upscore: JSPLib.validate.integer_constraints,
        downscore: JSPLib.validate.integer_constraints,
        favcount: JSPLib.validate.integer_constraints,
        tagcount: JSPLib.validate.integer_constraints,
        gentags: JSPLib.validate.integer_constraints,
        copyrights: JSPLib.validate.stringonly_constraints,
        created: JSPLib.validate.integer_constraints
    }
};

/**FUNCTIONS**/

//Validation functions

function ValidationSelector(key) {
    if (key.match(/^ct-/)) {
        return 'countentry';
    } else if (key.match(/^rti-/)) {
        return 'implicationentry';
    }
    else if (key.match(/^(?:current|previous)-uploads-/)) {
        return 'postentries';
    }
}

function BuildValidator(validation_key) {
    return {
        expires: fix_expires_constraints,
        value: validation_constraints[validation_key]
    };
}

function ValidateEntry(key,entry) {
    if (entry === null) {
        JSPLib.debug.debuglog(key,"entry not found!");
        return false;
    }
    let validation_key = ValidationSelector(key);
    check = validate(entry,BuildValidator(validation_key));
    if (check !== undefined) {
        JSPLib.validate.printValidateError(key,check);
        return false;
    }
    if (validation_key === 'postentries') {
        return ValidatePostentries(key,entry.value);
    }
    return true;
}

function ValidatePostentries(key,postentries) {
    if (postentries === null) {
        JSPLib.debug.debuglog(key,"entry not found!");
        return false;
    }
    check = validate({postentries: postentries},{postentries: validation_constraints.postentries});
    if (check !== undefined) {
        JSPLib.validate.printValidateError(key,check);
        return false;
    }
    for (let i = 0;i < postentries.length;i++){
        check = validate(postentries[i],validation_constraints.postentry);
        if (check !== undefined) {
            JSPLib.validate.printValidateError(key,check);
            return false;
        }
    }
    return true;
}

//Table functions

function AddTable(input) {
    return '<table class="striped">\r\n' + input + '</table>\r\n';
}

function AddTableHead(input) {
    return '<thead>\r\n' + input + '</thead>\r\n';
}

function AddTableBody(input) {
    return '<tbody>\r\n' + input + '</tbody>\r\n';
}

function AddTableRow(input) {
    return '<tr>\r\n' + input + '</tr>\r\n';
}

function AddTableHeader(input) {
    return '<th>' + input + '</th>\r\n';
}

function AddTableData(input) {
    return '<td>' + input + '</td>\r\n';
}

//Render functions

function RenderTable() {
    return AddTable(RenderHeader() + RenderBody());
}

function RenderHeader() {
    var tabletext = '';
    $.each(column_headers,(i,column)=>{
        tabletext += AddTableHeader(column);
    });
    return AddTableHead(tabletext);
}

function RenderBody() {
    if (user_copytags[username].length > 3) {
        $("#count-table").addClass("overflowed");
    } else {
        $("#count-table").removeClass("overflowed");
    }
    var tabletext = RenderRow('');
    for (let i = 0;i < user_copytags[username].length; i++) {
        tabletext += RenderRow(user_copytags[username][i]);
    }
    return AddTableBody(tabletext);
}

function RenderRow(key) {
    const timevalues = ['d','w','mo','y','at'];
    var rowtag = key == ''? 'user:' + username : key;
    var rowtext = (key == ''? username : key).replace(/_/g,' ');
    var tabletext = AddTableData(JSPLib.danbooru.postSearchLink(rowtag,JSPLib.utility.maxLengthString(rowtext)));
    for (let i = 0;i < timevalues.length; i++) {
        let data_text = GetTableValue(key,timevalues[i]);
        if (i === 0) {
            tabletext += AddTableData(RenderTooltipData(data_text,key));
        } else {
            tabletext += AddTableData(data_text);
        }
    }
    return AddTableRow(tabletext);
}

function GetTableValue(key,type) {
    if (key == '') {
        return JSPLib.storage.getStorageData('ct' + type + '-user:' + username, sessionStorage, {value:'N/A'}).value.toString();
    }
    var useruploads = JSPLib.storage.getStorageData('ct' + type + '-user:' + username + ' ' + key, sessionStorage, {value:'N/A'}).value.toString();
    var alluploads = JSPLib.storage.getStorageData('ct' + type + '-' + key, sessionStorage, {value:'N/A'}).value.toString();
    return `(${useruploads}/${alluploads})`;
}

function RenderTooltipData(text,key) {
    return `
<div class="tooltip">${text}
${RenderAllToolPopups(key)}
</div>
`;
}

function RenderAllToolPopups(key) {
    let html_text = "";
    $.each(tooltip_metrics,(i,metric)=> {
        html_text += RenderToolpopup(key,metric);
    });
    return html_text;
}

function RenderToolpopup(key,metric) {
    return `
<span class="tooltiptext" data-key="${key}" data-type="${metric}"></span>`;
}

function RenderAllTooltipControls() {
    let html_text = "";
    $.each(tooltip_metrics,(i,metric)=> {
        html_text += RenderToolcontrol(metric);
    });
    return html_text;
}

function RenderToolcontrol(metric) {
    return `
<span class="select-tooltip" data-type="${metric}"><a href="#">${JSPLib.utility.titleizeString(metric)}</a></span>`;
}

function RenderStatistics(key,attribute) {
    let current_uploads = JSPLib.storage.getStorageData(`current-uploads-${username}`,sessionStorage).value;
    if (key !== '') {
        current_uploads = current_uploads.filter(val=>{return val.copyrights.split(' ').includes(key);});
    }
    let upload_scores = JSPLib.utility.getObjectAttributes(current_uploads,attribute);
    let score_max = Math.max(...upload_scores);
    let score_average = JSPLib.statistics.average(upload_scores);
    let score_stddev = JSPLib.statistics.standardDeviation(upload_scores);
    let score_outliers = JSPLib.statistics.removeOutliers(upload_scores);
    let score_removed = upload_scores.length - score_outliers.length;
    let score_adjusted = JSPLib.statistics.average(score_outliers);
    return `
<ul>
<li>Max: ${score_max}</li>
<li>Avg: ${JSPLib.utility.setPrecision(score_average,2)}</li>
<li>StD: ${JSPLib.utility.setPrecision(score_stddev,2)}</li>
<li>Out: ${score_removed}</li>
<li>Adj: ${JSPLib.utility.setPrecision(score_adjusted,2)}</li>
</ul>
`;
}

//Helper functions

//Returns a sorted key array from highest to lowest using the length of the array in each value
function SortDict(dict) {
    var items = Object.keys(dict).map(function(key) {
        return [key, dict[key].length];
    });
    items.sort(function(first, second) {
        return second[1] - first[1];
    });
    return items.map(entry=>{return entry[0];});
}

function BuildTagParams(type,tag) {
    return {'tags':(type === 'at' ? '' : ('age:..1' + type + ' ')) + tag + (use_dummy_value ? ' -' + JSPLib.danbooru.randomDummyTag() : '')};
}

function GetCopyrightCount(posts) {
    let copyright_count = {};
    $.each(posts,(i,entry)=>{
        $.each(entry.copyrights.split(' '),(j,tag)=>{
            copyright_count[tag] = (tag in copyright_count ? copyright_count[tag].concat([entry.id]): [entry.id]);
        });
    });
    return copyright_count;
}

function CompareCopyrightCounts(dict1,dict2) {
    let difference = [];
    $.each(JSPLib.utility.setUnique(Object.keys(dict1).concat(Object.keys(dict2))),(i,key)=>{
        if (dict1[key] === undefined || dict2[key] === undefined || JSPLib.utility.setSymmetricDifference(dict1[key],dict2[key]).length) {
            difference.push(key);
        }
    });
    return difference;
}

function CheckCopyrightVelocity(tag) {
    var dayuploads = JSPLib.storage.getStorageData('ctd-' + tag,sessionStorage);
    var weekuploads = JSPLib.storage.getStorageData('ctw-' + tag,sessionStorage);
    if (dayuploads === undefined || weekuploads === undefined) {
        return true;
    }
    var day_gettime =  dayuploads.expires - expirations.d; //Time data was originally retrieved
    var week_velocity = (JSPLib.utility.one_week) / (weekuploads.value | 1); //Milliseconds per upload
    var adjusted_poll_interval = Math.min(week_velocity, JSPLib.utility.one_day); //Max wait time is 1 day
    return Date.now() > day_gettime + adjusted_poll_interval;
}

function MapPostData(posts) {
    return posts.map((entry)=>{
        return {
            id: entry.id,
            score: entry.score,
            upscore: entry.up_score,
            downscore: entry.down_score,
            favcount: entry.fav_count,
            tagcount: entry.tag_count,
            gentags: entry.tag_count_general,
            copyrights: entry.tag_string_copyright,
            created: Date.parse(entry.created_at)
        };
    });
}

function GetTagData(tag) {
    return Promise.all([
        GetCount('d',tag),
        GetCount('w',tag),
        GetCount('mo',tag),
        GetCount('y',tag),
        GetCount('at',tag)
    ]);
}

//Network functions

async function GetReverseTagImplication(tag) {
    var key = 'rti' + '-' + tag;
    var check = await JSPLib.storage.checkLocalDB(key,ValidateEntry);
    if (!(check)) {
        JSPLib.debug.debuglog("Network (implication):",key);
        return JSPLib.danbooru.submitRequest('tag_implications',{search: {antecedent_name: tag}},[],key)
        .then(data=>{
            JSPLib.storage.saveData(key, {'value':data.length,'expires':Date.now() + rti_expiration});
        });
    }
}

async function GetCount(type,tag) {
    var key = 'ct' + type + '-' + tag;
    var check = await JSPLib.storage.checkLocalDB(key,ValidateEntry);
    if (!(check)) {
        JSPLib.debug.debuglog("Network (count):",key);
        return JSPLib.danbooru.submitRequest('counts/posts',BuildTagParams(type,tag),{counts: {posts: 0}},key)
        .then(data=>{
            JSPLib.storage.saveData(key, {'value':data.counts.posts,'expires':Date.now() + expirations[type]});
        });
    }
}

async function CheckUser(username) {
    return JSPLib.danbooru.submitRequest('users',{search:{name_matches:username}});
}

async function GetCurrentUploads(username) {
    let key = `current-uploads-${username}`;
    var check = await JSPLib.storage.checkLocalDB(key,ValidateEntry);
    if (!(check)) {
        JSPLib.debug.debuglog("Network (current uploads)");
        let data = await JSPLib.danbooru.getAllItems('posts',max_post_limit_query,{addons: BuildTagParams('d',`user:${username}`)});
        let mapped_data = MapPostData(data);
        JSPLib.storage.saveData(key,{'value':mapped_data,'expires':Date.now() + expirations.d});
        return mapped_data;
    } else {
        return JSPLib.storage.getStorageData(key,sessionStorage).value;
    }
}

//Main functions

async function ProcessUploads() {
    var promise_array = [];
    var current_uploads = await GetCurrentUploads(username);
    if (current_uploads.length) {
        let previous_key = `previous-uploads-${username}`;
        let is_new_tab = JSPLib.storage.getStorageData(previous_key,sessionStorage) === null;
        let previous_uploads = await JSPLib.storage.checkLocalDB(previous_key,ValidateEntry) || {value: []};
        previous_uploads = previous_uploads.value;
        let symmetric_difference = JSPLib.utility.setSymmetricDifference(JSPLib.utility.getObjectAttributes(current_uploads,'id'),JSPLib.utility.getObjectAttributes(previous_uploads,'id'));
        if (is_new_tab || symmetric_difference.length) {
            promise_array.push(GetTagData(`user:${username}`));
        }
        let curr_copyright_count = GetCopyrightCount(current_uploads);
        let prev_copyright_count = GetCopyrightCount(previous_uploads);
        await Promise.all($.map(curr_copyright_count,(val,key)=>{return GetReverseTagImplication(key);}));
        user_copytags[username] = SortDict(curr_copyright_count).filter(value=>{return JSPLib.storage.getStorageData('rti-'+value,sessionStorage).value == 0;});
        let copyright_symdiff = CompareCopyrightCounts(curr_copyright_count,prev_copyright_count);
        let copyright_changed = (is_new_tab ? user_copytags[username] : JSPLib.utility.setIntersection(user_copytags[username],copyright_symdiff));
        let copyright_nochange = (is_new_tab ? [] : JSPLib.utility.setDifference(user_copytags[username],copyright_changed));
        $.each(copyright_nochange,(i,val)=>{
            if (CheckCopyrightVelocity(val)) {
                promise_array.push(GetTagData(val));
            }
        });
        $.each(copyright_changed,(i,val)=>{
            promise_array.push(GetTagData(`user:${username} ${val}`));
            promise_array.push(GetTagData(val));
        });
        await Promise.all(promise_array);
    }
    JSPLib.storage.saveData(`previous-uploads-${username}`,{value: current_uploads, expires: 0});
    return current_uploads;
}

function SetTooltipHover() {
    $(".tooltip").hover((e)=>{
        let $tooltip_text = $(".activetooltip",e.target);
        if ($tooltip_text.html() === "") {
            let tooltip_key = $(".activetooltip",e.target).data('key');
            let tooltip_metric = $(".activetooltip",e.target).data('type');
            $tooltip_text.html("Loading!");
            $tooltip_text.html(RenderStatistics(tooltip_key,tooltip_metric));
        }
    });
}

function SetTooltipChangeClick() {
    $(".select-tooltip").click((e)=>{
        let tooltip_type = $(e.target.parentElement).data('type');
        $(".select-tooltip,.tooltiptext").removeClass("activetooltip");
        $(`.select-tooltip[data-type="${tooltip_type}"]`).addClass("activetooltip");
        $(`.tooltiptext[data-type="${tooltip_type}"]`).addClass("activetooltip");
        Danbooru.Cookie.put('cu-current-metric',tooltip_type);
    });
}

function SetCountNoticeClick() {
    $("#hide-count-notice").click((e)=>{
        if (Danbooru.Cookie.get('cu-hide-current-uploads') === "1") {
            Danbooru.Cookie.put('cu-hide-current-uploads',0);
            $('#upload-counts').addClass('opened');
            //Prevent processing potentially bad usernames set by SetCheckUserClick
            username = Danbooru.meta("current-user-name");
            empty_uploads_message = empty_uploads_message_owner;
            PopulateTable();
        } else {
            Danbooru.Cookie.put('cu-hide-current-uploads',1);
            $('#upload-counts').removeClass('opened');
        }
        e.preventDefault();
    });
}

function SetStashNoticeClick() {
    $("#stash-count-notice").click((e)=>{
        Danbooru.Cookie.put('cu-stash-current-uploads',1);
        //Hide the table so that it doesn't always process on each page load
        Danbooru.Cookie.put('cu-hide-current-uploads',1);
        $('#upload-counts,#upload-counts-restore').removeClass('opened').addClass('stashed');
        e.preventDefault();
    });
}

function SetRestoreNoticeClick() {
    $("#restore-count-notice").click((e)=>{
        Danbooru.Cookie.put('cu-stash-current-uploads',0);
        $('#upload-counts,#upload-counts-restore').removeClass('stashed');
        e.preventDefault();
    });
}

function SetCheckUserClick() {
    PopulateTable.checked_usernames = PopulateTable.checked_usernames || {};
    $("#count_submit_user_id").click(async (e)=>{
        //Don't change the username while currently processing
        if (!PopulateTable.is_started) {
            let check_user = [];
            let check_username = $("#count_query_user_id").val();
            if (check_username in PopulateTable.checked_usernames) {
                check_user = PopulateTable.checked_usernames[check_username];
            } else {
                //Check each time no matter what as misses can be catastrophic
                check_user = await CheckUser(check_username);
            }
            if (check_user.length) {
                username = check_user[0].name;
                PopulateTable.checked_usernames[check_username] = check_user;
                empty_uploads_message = empty_uploads_message_other;
                PopulateTable();
            } else {
                $('#count-table').html(`<div id="empty-uploads">User doesn't exist!</div>`);
            }
        }
        e.preventDefault();
    });
}

async function PopulateTable() {
    PopulateTable.checked_users = PopulateTable.checked_users || [];
    if (!PopulateTable.is_started) {
        var post_data = [];
        if (PopulateTable.checked_users.indexOf(username) < 0) {
            PopulateTable.is_started = true;
            $('#count-table').html(`<div id="empty-uploads">Loading data... (<span id="loading-counter">${num_network_requests}</span>)</div>`);
            post_data = await ProcessUploads();
            PopulateTable.checked_users.push(username);
            PopulateTable.is_started = false;
        } else {
            post_data = JSPLib.storage.getStorageData(`current-uploads-${username}`,sessionStorage).value;
        }
        if (post_data.length) {
            $('#count-table').html(RenderTable());
            $('#count-controls').html(RenderAllTooltipControls());
            SetTooltipHover();
            SetTooltipChangeClick();
            let tooltip_type = Danbooru.Cookie.get('cu-current-metric') || 'score';
            $(`.select-tooltip[data-type="${tooltip_type}"] a`).click();
        } else {
            $('#count-table').html(`<div id="empty-uploads">${empty_uploads_message}</div>`);
        }
    }
}

function main() {
    username = Danbooru.meta("current-user-name");
    if (username === "Anonymous") {
        return;
    }
    use_dummy_value = $('body').data('user-is-gold');
    JSPLib.utility.setCSSStyle(program_css,'program');
    $notice_box = $(notice_box);
    $footer_notice = $(unstash_notice);
    if (Danbooru.Cookie.get('cu-stash-current-uploads') === "1") {
        $($notice_box).addClass('stashed');
        $($footer_notice).addClass('stashed');
    }
    $('header#top').append($notice_box);
    $('footer#page-footer').append($footer_notice);
    SetCountNoticeClick();
    SetStashNoticeClick();
    SetRestoreNoticeClick();
    SetCheckUserClick();
    if (Danbooru.Cookie.get('cu-hide-current-uploads') !== "1") {
        //Set to opposite so that click can be used and sets it back
        Danbooru.Cookie.put('cu-hide-current-uploads',1);
        $("#hide-count-notice").click();
    }
    if (JSPLib.debug.debug_console) {
        window.addEventListener('beforeunload',function () {
            JSPLib.statistics.outputAdjustedMean("CurrentUploads");
        });
    }
}

JSPLib.load.programInitialize(main,'CU',program_load_required_variables,program_load_required_ids);
