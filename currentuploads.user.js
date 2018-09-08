// ==UserScript==
// @name         CurrentUploads
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      10.1
// @source       https://danbooru.donmai.us/users/23799
// @description  Gives up-to-date stats on uploads
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/currentuploads.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.5.2/localforage.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.12.0/validate.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180827/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180827/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180827/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180827/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180827/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180827/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180827/lib/danbooru.js
// ==/UserScript==

/**GLOBAL VARIABLES**/

//Variables for debug.js
JSPLib.debug.debug_console = false;
JSPLib.debug.pretext = "CU:";
JSPLib.debug.pretimer = "CU-";
JSPLib.debug.level = JSPLib.debug.INFO;

//Variables for load.js
const program_load_required_variables = ['window.jQuery','window.Danbooru'];
const program_load_required_selectors = ["#top","#page-footer"];

//Variables for danbooru.js
JSPLib.danbooru.counter_domname = "#loading-counter";

//Main function expires
const prune_expires = JSPLib.utility.one_day;
const prune_limit = 1000;

//Regex that matches the prefix of all program cache data
const program_cache_regex = /^rti-|ct(?:d|w|mo|y|at)?-|(?:daily|weekly|monthly|yearly|alltime|previous)-uploads-/

//For factory reset
const localstorage_keys = [
    'cu-prune-expires',
    'cu-current-metric',
    'cu-hide-current-uploads',
    'cu-stash-current-uploads'
];
const program_reset_keys = {
    checked_usernames: {},
    checked_users: {},
    user_copytags: {},
    period_available: {}
};

//Time periods
const period_selectors = ['daily','weekly','monthly','yearly','alltime'];
const timevalues = ['d','w','mo','y','at'];
const manual_periods = ['w','mo'];
const limited_periods = ['y','at'];

//Period constants
const period_info = {
    countexpires: {
        d: 5 * JSPLib.utility.one_minute,
        w: JSPLib.utility.one_hour,
        mo: JSPLib.utility.one_day,
        y: JSPLib.utility.one_week,
        at: JSPLib.utility.one_month
    },
    uploadexpires: {
        d: 5 * JSPLib.utility.one_minute,
        w: JSPLib.utility.one_day,
        mo: JSPLib.utility.one_week,
        y: JSPLib.utility.one_month,
        at: JSPLib.utility.one_year
    },
    longname: {
        d: 'daily',
        w: 'weekly',
        mo: 'monthly',
        y: 'yearly',
        at: 'alltime'
    },
    header: {
        d: 'Day',
        w: 'Week',
        mo: 'Month',
        y: 'Year',
        at: 'All-time'
    }
}

const longname_key = {
    daily: 'd',
    weekly: 'w',
    monthly: 'mo',
    yearly: 'y',
    alltime: 'at'
}

//Reverse tag implication expiration
const rti_expiration = JSPLib.utility.one_month; //one month

//Network call configuration
const max_post_limit_query = 100;

//Metrics used by statistics functions
const tooltip_metrics = ['score','upscore','downscore','favcount','tagcount','gentags'];

//Feedback messages
const empty_uploads_message_owner = 'Feed me more uploads!';
const empty_uploads_message_other = 'No uploads for this user.';
const empty_uploads_message_anonymous = 'User is Anonymous, so no uploads.';

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
.cu-tooltip {
    position: relative;
    display: inline-block;
    border-bottom: 1px dotted black;
    min-width: 2em;
    text-align: center;
}
.cu-tooltip .cu-tooltiptext {
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
    right: -100px;
}
.cu-tooltip:hover .cu-tooltiptext.cu-activetooltip {
    visibility: visible;
}
#count-table.overflowed tr:nth-child(1) .cu-tooltiptext {
    top: -30px;
}
#count-table.overflowed tr:nth-child(2) .cu-tooltiptext {
    top: -45px;
}
#count-table.overflowed tr:nth-last-child(2) .cu-tooltiptext {
    top: -60px;
}
#count-table.overflowed tr:nth-last-child(1) .cu-tooltiptext {
    top: -75px;
}
.cu-select-tooltip a {
    color: grey;
    margin-right: 1em;
}
.cu-select-tooltip.cu-activetooltip a {
    font-weight: bold;
}
.cu-manual:hover,
.cu-limited:hover {
    color: grey;
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
        <a href="#" id="toggle-count-notice">Toggle Upload Table</a>&nbsp;(<a href="#" id="stash-count-notice">STASH</a>)
    </div>
</div>
`;

const unstash_notice = '<span id="upload-counts-restore"> - <a href="#" id="restore-count-notice">Restore CurrentUploads</a></span>';

//Validation values

const validation_constraints = {
    countentry: JSPLib.validate.postcount_constraints,
    implicationentry: JSPLib.validate.integer_constraints,
    postentries: JSPLib.validate.array_constraints,
    statentries: JSPLib.validate.hash_constraints,
    postentry: [
        JSPLib.validate.integer_constraints,    //ID
        JSPLib.validate.integer_constraints,    //SCORE
        JSPLib.validate.integer_constraints,    //UPSCORE
        JSPLib.validate.integer_constraints,    //DOWNSCORE
        JSPLib.validate.integer_constraints,    //FAVCOUNT
        JSPLib.validate.integer_constraints,    //TAGCOUNT
        JSPLib.validate.integer_constraints,    //GENTAGS
        JSPLib.validate.stringonly_constraints  //COPYRIGHTS
    ],
    postmetric: {
        score: JSPLib.validate.hash_constraints,
        upscore: JSPLib.validate.hash_constraints,
        downscore: JSPLib.validate.hash_constraints,
        favcount: JSPLib.validate.hash_constraints,
        tagcount: JSPLib.validate.hash_constraints,
        gentags: JSPLib.validate.hash_constraints
    },
    poststat: {
        max: JSPLib.validate.integer_constraints,
        average: JSPLib.validate.number_constraints,
        stddev: JSPLib.validate.number_constraints,
        outlier: JSPLib.validate.integer_constraints,
        adjusted: JSPLib.validate.number_constraints
    }
};

/**FUNCTIONS**/

//Validation functions

function ValidationSelector(key) {
    if (key.match(/^ct(?:d|w|mo|y|at)?-/)) {
        return 'countentry';
    } else if (key.match(/^rti-/)) {
        return 'implicationentry';
    }
    else if (key.match(/^(?:daily|weekly|monthly|previous)-uploads-/)) {
        return 'postentries';
    } else if (key.match(/^(?:yearly|alltime)-uploads-/)) {
        return 'statentries';
    }
}

function BuildValidator(validation_key) {
    return {
        expires: JSPLib.validate.expires_constraints,
        value: validation_constraints[validation_key]
    };
}

function ValidateEntry(key,entry) {
    if (!JSPLib.validate.validateIsHash(key,entry)) {
        return false
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
    if (validation_key === 'statentries') {
        return ValidateStatEntries(key,entry.value);
    }
    return true;
}

function ValidatePostentries(key,postentries) {
    for (let i = 0;i < postentries.length;i++){
        let value_key = key + `[${i}]`;
        if (!JSPLib.validate.validateIsArray(value_key, postentries[i], validation_constraints.postentry.length)) {
            return false;
        }
        check = validate(postentries[i],validation_constraints.postentry);
        if (check !== undefined) {
            JSPLib.validate.printValidateError(value_key,check);
            return false;
        }
    }
    return true;
}

function ValidateStatEntries(key,statentries) {
    check = validate(statentries,validation_constraints.postmetric);
    if (check !== undefined) {
        JSPLib.validate.printValidateError(key,check);
        return false;
    }
    for (let i = 0; i < tooltip_metrics.length; i++) {
        let metric = tooltip_metrics[i];
        check = validate(statentries[metric],validation_constraints.poststat);
        if (check !== undefined) {
            JSPLib.validate.printValidateError(key + '.' + metric,check);
            return false;
        }
    }
    return true;
}

//Library functions

function IsNamespaceBound(selector,eventtype,namespace) {
    let namespaces = GetBoundEventNames(selector,eventtype);
    return namespaces.includes(namespace);
}

function GetBoundEventNames(selector,eventtype) {
    let $obj = $(selector);
    if ($obj.length === 0) {
        return [];
    }
    let boundevents = $._data($obj[0], "events");
    if (!boundevents || !(eventtype in boundevents)) {
        return [];
    }
    return $.map(boundevents[eventtype],(entry)=>{return entry.namespace;});
}

function AddStyleSheet(url,title='') {
    AddStyleSheet.cssstyle = AddStyleSheet.cssstyle || {};
    if (title in AddStyleSheet.cssstyle) {
        AddStyleSheet.cssstyle[title].href = url;
    } else {
        AddStyleSheet.cssstyle[title] = document.createElement('link');
        AddStyleSheet.cssstyle[title].rel = 'stylesheet';
        AddStyleSheet.cssstyle[title].type = 'text/css';
        AddStyleSheet.cssstyle[title].href = url;
        document.head.appendChild(AddStyleSheet.cssstyle[title]);
    }
}

function InstallScript(url) {
    return $.ajax({
        url: url,
        dataType: "script",
        cache: true
    });
}

function KebabCase(string) {
    return string.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g,'-').toLowerCase();
}

function DisplayCase(string) {
    return JSPLib.utility.titleizeString(string.toLowerCase().replace(/[_]/g,' '));
}

//Table functions

function AddTable(input,inner_args="") {
    return `<table ${inner_args}>\r\n` + input + '</table>\r\n';
}

function AddTableHead(input,inner_args="") {
    return `<thead ${inner_args}>\r\n` + input + '</thead>\r\n';
}

function AddTableBody(input,inner_args="") {
    return `<tbody ${inner_args}>\r\n` + input + '</tbody>\r\n';
}

function AddTableRow(input,inner_args="") {
    return `<tr ${inner_args}>\r\n` + input + '</tr>\r\n';
}

function AddTableHeader(input,inner_args="") {
    return `<th ${inner_args}>` + input + '</th>\r\n';
}

function AddTableData(input,inner_args="") {
    return `<td ${inner_args}>` + input + '</td>\r\n';
}

//Render functions

function RenderTable() {
    return AddTable(RenderHeader() + RenderBody(),'class="striped"');
}

function RenderHeader() {
    var tabletext = AddTableHeader('Name');
    let click_periods = manual_periods.concat(limited_periods);
    let times_shown = GetShownPeriodKeys();
    $.each(times_shown,(i,period)=>{
        let header = period_info.header[period];
        if (click_periods.includes(period)) {
            let class_name = (manual_periods.includes(period) ? 'cu-manual' : 'cu-limited');
            tabletext += AddTableHeader(`<a class="${class_name}">${header}</a><span class="cu-display" style="display:none">&nbsp;(<span class="cu-counter">...</span>)</span>`,`data-period="${period}"`);
        } else {
            tabletext += AddTableHeader(header);
        }
    });
    return AddTableHead(AddTableRow(tabletext));
}

function RenderBody() {
    if (Danbooru.CU.user_copytags[Danbooru.CU.current_username].length > 3) {
        $("#count-table").addClass("overflowed");
    } else {
        $("#count-table").removeClass("overflowed");
    }
    var tabletext = RenderRow('');
    for (let i = 0;i < Danbooru.CU.user_copytags[Danbooru.CU.current_username].length; i++) {
        tabletext += RenderRow(Danbooru.CU.user_copytags[Danbooru.CU.current_username][i]);
    }
    return AddTableBody(tabletext);
}

function RenderRow(key) {
    var rowtag = key == ''? 'user:' + Danbooru.CU.current_username : key;
    var rowtext = (key == ''? Danbooru.CU.current_username : key).replace(/_/g,' ');
    var tabletext = AddTableData(JSPLib.danbooru.postSearchLink(rowtag,JSPLib.utility.maxLengthString(rowtext)));
    let times_shown = GetShownPeriodKeys();
    for (let i = 0;i < times_shown.length; i++) {
        let period = times_shown[i];
        let data_text = GetTableValue(key,period);
        let is_available = Danbooru.CU.period_available[Danbooru.CU.current_username][period];
        let is_limited = limited_periods.includes(period);
        if (is_available && is_limited && key == '') {
            tabletext += AddTableData(RenderTooltipData(data_text,times_shown[i],true));
        } else if (is_available && !is_limited) {
            tabletext += AddTableData(RenderTooltipData(data_text,times_shown[i]));
        } else {
            tabletext += AddTableData(`<span class="cu-uploads">${data_text}</span>`);
        }
    }
    return AddTableRow(tabletext,`data-key="${key}"`);
}

//Get the data and validate it without checking the expires
function GetCountData(key,default_val=null) {
    let count_data = JSPLib.storage.getStorageData(key, sessionStorage);
    if (!ValidateEntry(key,count_data)) {
        return default_val;
    }
    return count_data.value;
}

function GetTableValue(key,type) {
    if (key == '') {
        return GetCountData('ct' + type + '-user:' + Danbooru.CU.current_username,"N/A");
    }
    var useruploads = GetCountData('ct' + type + '-user:' + Danbooru.CU.current_username + ' ' + key,"N/A");
    var alluploads = GetCountData('ct' + type + '-' + key,"N/A");
    return `(${useruploads}/${alluploads})`;
}

function RenderTooltipData(text,period,limited=false) {
    let tooltip_html = RenderAllToolPopups(period,limited);
    return `
<div class="cu-tooltip" data-period="${period}"><span class="cu-uploads">${text}</span>${tooltip_html}
</div>
`;
}

function RenderAllToolPopups(period,limited) {
    return tooltip_metrics.map((metric)=>{return RenderToolpopup(metric,period,limited);}).join('');
}

function RenderToolpopup(metric,period,limited) {
    let inner_text = (limited ? RenderStatistics('',metric,period,true) : '');
    return `
    <span class="cu-tooltiptext" data-type="${metric}">${inner_text}</span>`;
}

function RenderAllTooltipControls() {
    return tooltip_metrics.map((metric)=>{return RenderToolcontrol(metric);}).join('');
}

function RenderToolcontrol(metric) {
    return `
<span class="cu-select-tooltip" data-type="${metric}"><a href="#">${JSPLib.utility.titleizeString(metric)}</a></span>`;
}

function RenderStatistics(key,attribute,period,limited=false) {
    let period_name = period_info.longname[period];
    let data = JSPLib.storage.getStorageData(`${period_name}-uploads-${Danbooru.CU.current_username}`,sessionStorage);
    if (!data) {
        return "No data!";
    }
    let stat = data.value;
    if (!limited) {
        let uploads = PostDecompressData(stat);
        if (key !== '') {
            uploads = uploads.filter(val=>{return val.copyrights.split(' ').includes(key);});
        }
        //It's possible with their longer expirations for daily copyrights that don't exist in other periods
        if (uploads.length === 0) {
            return "No data!";
        }
        stat = GetPostStatistics(uploads,attribute);
    } else {
        stat = stat[attribute];
    }
    return RenderStatlist(stat);
}

function RenderStatlist(stat) {
    return `
<ul>
    <li>Max: ${stat.max}</li>
    <li>Avg: ${stat.average}</li>
    <li>StD: ${stat.stddev}</li>
    <li>Out: ${stat.outlier}</li>
    <li>Adj: ${stat.adjusted}</li>
</ul>`;
}

function GetPostStatistics(posts,attribute) {
    let data = JSPLib.utility.getObjectAttributes(posts,attribute);
    let data_max = Math.max(...data);
    let data_average = JSPLib.statistics.average(data);
    let data_stddev = JSPLib.statistics.standardDeviation(data);
    let data_outliers = JSPLib.statistics.removeOutliers(data);
    let data_removed = data.length - data_outliers.length;
    let data_adjusted = JSPLib.statistics.average(data_outliers);
    return {
        max: data_max,
        average: JSPLib.utility.setPrecision(data_average,2),
        stddev: JSPLib.utility.setPrecision(data_stddev,2),
        outlier: data_removed,
        adjusted: JSPLib.utility.setPrecision(data_adjusted,2)
    };
}

//Helper functions

function BroadcastCU(ev) {
    JSPLib.debug.debuglog("Broadcast",ev.data);
    if (ev.data.type === "hide") {
        Danbooru.CU.hidden = 1;
        $('#upload-counts').removeClass('opened');
    } else if (ev.data.type === "show") {
        Danbooru.CU.hidden = 0;
        $('#upload-counts').addClass('opened');
    } else if (ev.data.type === "stash") {
        Danbooru.CU.stashed = 1;
        Danbooru.CU.hidden = 1;
        $('#upload-counts,#upload-counts-restore').addClass('stashed');
    } else if (ev.data.type === "unstash") {
        Danbooru.CU.stashed = 0;
        $('#upload-counts,#upload-counts-restore').removeClass('stashed');
    } else if (ev.data.type === "settings") {
        Danbooru.CU.user_settings = ev.data.user_settings;
    } else if (ev.data.type === "reset") {
        $('#upload-counts').removeClass('opened');
        JSPLib.storage.setStorageData('cu-hide-current-uploads',1,localStorage);
        Danbooru.CU.user_settings = ev.data.user_settings;
        Object.assign(Danbooru.CU,program_reset_keys);
    } else if (ev.data.type === "purge") {
        $.each(sessionStorage,(key)=>{
            if (key.match(program_cache_regex)) {
                sessionStorage.removeItem(key);
            }
        });
    }
}

function IsSettingEnabled(setting_name,selector) {
    return Danbooru.CU.user_settings[setting_name].includes(selector);
}

function GetShownPeriodKeys() {
    return timevalues.filter((period_key)=>{return Danbooru.CU.user_settings.periods_shown.includes(period_info.longname[period_key]);});
}

//Returns a sorted key array from highest to lowest using the length of the array in each value
function SortDict(dict) {
    var items = Object.keys(dict).map((key)=>{
        return [key, dict[key].length];
    });
    items.sort((first, second)=>{
        return second[1] - first[1];
    });
    return items.map((entry)=>{return entry[0];});
}

function BuildTagParams(type,tag) {
    return (type === 'at' ? '' : ('age:..1' + type + ' ')) + tag + (Danbooru.CU.is_gold_user ? ' -' + JSPLib.danbooru.randomDummyTag() : '');
}

function GetCopyrightCount(posts) {
    let copyright_count = {};
    $.each(posts,(i,entry)=>{
        $.each(entry.copyrights.split(' '),(j,tag)=>{
            copyright_count[tag] = copyright_count[tag] || [];
            copyright_count[tag] = copyright_count[tag].concat([entry.id]);
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
    if (dayuploads === null || weekuploads === null) {
        return true;
    }
    var day_gettime =  dayuploads.expires - period_info.countexpires.d; //Time data was originally retrieved
    var week_velocity = (JSPLib.utility.one_week) / (weekuploads.value | 1); //Milliseconds per upload
    var adjusted_poll_interval = Math.min(week_velocity, JSPLib.utility.one_day); //Max wait time is 1 day
    return Date.now() > day_gettime + adjusted_poll_interval;
}

function IsMissingTag(tag) {
    return GetShownPeriodKeys().reduce((total,period)=>{return total || !GetCountData(`ct${period}-${tag}`);},false);
}

function MapPostData(posts) {
    return posts.map((entry)=>{
        return {
            id: entry.id,
            score: entry.score,
            upscore: entry.up_score,
            downscore: -entry.down_score,
            favcount: entry.fav_count,
            tagcount: entry.tag_count,
            gentags: entry.tag_count_general,
            copyrights: entry.tag_string_copyright
        };
    });
}

function PreCompressData(posts) {
    return posts.map((entry)=>{
        return [entry.id,entry.score,entry.upscore,entry.downscore,entry.favcount,entry.tagcount,entry.gentags,entry.copyrights]
    });
}

function PostDecompressData(posts) {
    return posts.map((entry)=>{
        return {
            id: entry[0],
            score: entry[1],
            upscore: entry[2],
            downscore: entry[3],
            favcount: entry[4],
            tagcount: entry[5],
            gentags: entry[6],
            copyrights: entry[7],
        };
    });
}

function GetTagData(tag) {
    return Danbooru.CU.user_settings.periods_shown.map((period)=>{return GetCount(longname_key[period],tag);});
}

async function CheckPeriodUploads(username) {
    Danbooru.CU.period_available[username] = Danbooru.CU.period_available[username] || {};
    let times_shown = GetShownPeriodKeys();
    for (let i = 0; i < times_shown.length; i++) {
        let period = times_shown[i];
        if (period in Danbooru.CU.period_available[username]) {
            continue;
        }
        let period_name = period_info.longname[period];
        let max_expires = period_info.uploadexpires[period]
        var check = await JSPLib.storage.checkLocalDB(`${period_name}-uploads-${username}`,ValidateEntry,max_expires);
        Danbooru.CU.period_available[username][period] = Boolean(check);
    }
}

//Network functions

async function GetPostsCountdown(limit,searchstring,domname) {
    let tag_addon = {tags: searchstring};
    let limit_addon = {limit: limit};
    let page_addon = {};
    var return_items = [];
    let page_num = 0;
    if (domname) {
        let total_posts = (await JSPLib.danbooru.submitRequest('counts/posts',tag_addon,{counts: {posts: 0}})).counts.posts;
        page_num = Math.ceil(total_posts/limit);
    }
    while (true) {
        if (domname) {
            JSPLib.debug.debuglog("Pages left #",page_num);
            domname && jQuery(domname).html(page_num);
        }
        let request_addons = JSPLib.danbooru.joinArgs(tag_addon,limit_addon,page_addon);
        let request_key = 'posts-' + jQuery.param(request_addons);
        let temp_items = await JSPLib.danbooru.submitRequest('posts',request_addons,[],request_key);
        return_items = return_items.concat(temp_items);
        if (temp_items.length < limit) {
            return return_items;
        }
        let lastid = JSPLib.danbooru.getNextPageID(temp_items,false);
        page_addon = {page:`b${lastid}`};
        page_num -= 1;
    }
}

async function GetReverseTagImplication(tag) {
    var key = 'rti' + '-' + tag;
    var check = await JSPLib.storage.checkLocalDB(key,ValidateEntry,rti_expiration);
    if (!(check)) {
        JSPLib.debug.debuglog("Network (implication):",key);
        let data = await JSPLib.danbooru.submitRequest('tag_implications',{search: {antecedent_name: tag}},[],key)
        JSPLib.storage.saveData(key, {value: data.length, expires: JSPLib.utility.getExpiration(rti_expiration)});
        return data.length;
    }
    return check.value;
}

async function GetCount(type,tag) {
    let max_expires = period_info.countexpires[type]
    var key = 'ct' + type + '-' + tag;
    var check = await JSPLib.storage.checkLocalDB(key,ValidateEntry,max_expires);
    if (!(check)) {
        JSPLib.debug.debuglog("Network (count):",key);
        return JSPLib.danbooru.submitRequest('counts/posts',{tags: BuildTagParams(type,tag)},{counts: {posts: 0}},key)
        .then(data=>{
            JSPLib.storage.saveData(key, {value: data.counts.posts, expires: JSPLib.utility.getExpiration(max_expires)});
        });
    }
}

function CheckUser(username) {
    return JSPLib.danbooru.submitRequest('users', {search: {name_matches: username}});
}

async function GetPeriodUploads(username,period,limited=false,domname=null) {
    let period_name = period_info.longname[period];
    let max_expires = period_info.uploadexpires[period]
    let key = `${period_name}-uploads-${username}`;
    var check = await JSPLib.storage.checkLocalDB(key,ValidateEntry,max_expires);
    if (!(check)) {
        JSPLib.debug.debuglog(`Network (${period_name} uploads)`);
        let data = await GetPostsCountdown(max_post_limit_query,BuildTagParams(period,`user:${username}`),domname);
        let mapped_data = MapPostData(data);
        if (limited) {
            mapped_data = Object.assign(...tooltip_metrics.map((metric)=>{return {[metric]: GetPostStatistics(mapped_data,metric)};}));
            JSPLib.storage.saveData(key, {value: mapped_data, expires: JSPLib.utility.getExpiration(max_expires)});
        } else {
            JSPLib.storage.saveData(key, {value: PreCompressData(mapped_data), expires: JSPLib.utility.getExpiration(max_expires)});
        }
        return mapped_data;
    } else {
        if (limited) {
            return check.value;
        } else {
            return PostDecompressData(check.value);
        }
    }
}

//Event handlers

function GetPeriodClick() {
    $("#count-table .cu-manual,#count-table .cu-limited").click(async (e)=>{
        let header = e.target.parentElement;
        if ($(header).hasClass("cu-processed")) {
            return;
        }
        let is_limited = $(e.target).hasClass("cu-limited");
        let period = header.dataset.period;
        $(`#count-table th[data-period=${period}] .cu-display`).show();
        await GetPeriodUploads(Danbooru.CU.current_username,period,is_limited,`#count-table th[data-period=${period}] .cu-counter`);
        let column = header.cellIndex;
        let $cells = $(`#count-table td:nth-of-type(${column + 1})`);
        if (is_limited) {
            let value = $(".cu-uploads",$cells[0]).html()
            $($cells[0]).html(RenderTooltipData(value,period,true));
        } else {
            $.each($cells,(i,cell)=>{
                let value = $(".cu-uploads",cell).html();
                $(cell).html(RenderTooltipData(value,period));
            });
            SetTooltipHover();
        }
        $(`#count-table th[data-period=${period}] .cu-display`).hide();
        $(`.cu-select-tooltip[data-type="${Danbooru.CU.current_metric}"] a`).click();
        $(header).addClass("cu-processed");
    });
}

function SetTooltipChangeClick() {
    $(".cu-select-tooltip").click((e)=>{
        Danbooru.CU.current_metric = $(e.target.parentElement).data('type');
        $(".cu-select-tooltip,.cu-tooltiptext").removeClass("cu-activetooltip");
        $(`.cu-select-tooltip[data-type="${Danbooru.CU.current_metric}"]`).addClass("cu-activetooltip");
        $(`.cu-tooltiptext[data-type="${Danbooru.CU.current_metric}"]`).addClass("cu-activetooltip");
        JSPLib.storage.setStorageData('cu-current-metric',Danbooru.CU.current_metric,localStorage);
    });
}

function SetToggleNoticeClick() {
    $("#toggle-count-notice").click((e)=>{
        if (Danbooru.CU.hidden === 1) {
            Danbooru.CU.hidden = 0;
            $('#upload-counts').addClass('opened');
            if (!PopulateTable.is_started) {
                //Always show current user on open to prevent processing potentially bad usernames set by SetCheckUserClick
                Danbooru.CU.empty_uploads_message = (Danbooru.CU.username === "Anonymous" ? empty_uploads_message_anonymous : empty_uploads_message_owner);
                Danbooru.CU.current_username = Danbooru.CU.username;
                PopulateTable(Danbooru.CU.current_username);
            }
            Danbooru.CU.channel.postMessage({type: "show"});
        } else {
            Danbooru.CU.hidden = 1;
            $('#upload-counts').removeClass('opened');
            Danbooru.CU.channel.postMessage({type: "hide"});
        }
        JSPLib.storage.setStorageData('cu-hide-current-uploads',Danbooru.CU.hidden,localStorage)
        e.preventDefault();
    });
}

function SetStashNoticeClick() {
    $("#stash-count-notice,#restore-count-notice").click((e)=>{
        if (Danbooru.CU.stashed === 1) {
            Danbooru.CU.stashed = 0;
            $('#upload-counts,#upload-counts-restore').removeClass('stashed');
            Danbooru.CU.channel.postMessage({type: "unstash"});
        } else {
            Danbooru.CU.stashed = 1;
            Danbooru.CU.hidden = 1;
            $('#upload-counts,#upload-counts-restore').removeClass('opened').addClass('stashed');
            Danbooru.CU.channel.postMessage({type: "stash"});
        }
        JSPLib.storage.setStorageData('cu-stash-current-uploads',Danbooru.CU.stashed,localStorage);
        JSPLib.storage.setStorageData('cu-hide-current-uploads',Danbooru.CU.hidden,localStorage);
        e.preventDefault();
    });
}

function SetRestoreNoticeClick() {
    $("#restore-count-notice").click((e)=>{
        JSPLib.storage.setStorageData('cu-stash-current-uploads',0,localStorage);
        $('#upload-counts,#upload-counts-restore').removeClass('stashed');
        Danbooru.CU.channel.postMessage({type: "unstash"});
        e.preventDefault();
    });
}

function SetCheckUserClick() {
    $("#count_submit_user_id").click(async (e)=>{
        //Don't change the username while currently processing
        if (!PopulateTable.is_started) {
            let check_user;
            let check_username = $("#count_query_user_id").val();
            if (check_username === "") {
                check_user = [];
            } else if (check_username in Danbooru.CU.checked_usernames) {
                check_user = Danbooru.CU.checked_usernames[check_username];
            } else {
                //Check each time no matter what as misses can be catastrophic
                check_user = await CheckUser(check_username);
                Danbooru.CU.checked_usernames[check_username] = check_user;
            }
            if (check_user.length) {
                Danbooru.CU.current_username = check_user[0].name;
                Danbooru.CU.empty_uploads_message = empty_uploads_message_other;
                PopulateTable(Danbooru.CU.current_username);
            } else {
                $('#count-table').html(`<div id="empty-uploads">User doesn't exist!</div>`);
            }
        }
        e.preventDefault();
    });
}

function SetTooltipHover() {
    $(".cu-tooltip .cu-uploads").off().hover((e)=>{
        let container = e.target.parentElement;
        let $tooltip_text = $(".cu-activetooltip",container);
        if ($tooltip_text.html() === "") {
            let tooltip_key = $(container.parentElement.parentElement).data('key');
            let tooltip_period = $(container).data('period');
            let tooltip_metric = $(".cu-activetooltip",container).data('type');
            $tooltip_text.html("Loading!");
            $tooltip_text.html(RenderStatistics(tooltip_key,tooltip_metric,tooltip_period));
        }
    });
}

//Main functions

async function ProcessUploads(username) {
    var promise_array = [];
    var current_uploads = [];
    if (username !== "Anonymous") {
        current_uploads = await GetPeriodUploads(username,'d');
    }
    if (current_uploads.length) {
        let previous_key = `previous-uploads-${username}`;
        let is_new_tab = JSPLib.storage.getStorageData(previous_key,sessionStorage) === null;
        let previous_uploads = await JSPLib.storage.checkLocalDB(previous_key,ValidateEntry) || {value: []};
        previous_uploads = PostDecompressData(previous_uploads.value);
        let symmetric_difference = JSPLib.utility.setSymmetricDifference(JSPLib.utility.getObjectAttributes(current_uploads,'id'),JSPLib.utility.getObjectAttributes(previous_uploads,'id'));
        if (is_new_tab || symmetric_difference.length || IsMissingTag(`user:${username}`)) {
            promise_array.push(GetTagData(`user:${username}`));
        }
        if (Danbooru.CU.is_gold_user && Danbooru.CU.user_settings.copyrights_enabled) {
            let curr_copyright_count = GetCopyrightCount(current_uploads);
            let prev_copyright_count = GetCopyrightCount(previous_uploads);
            Danbooru.CU.user_copytags[username] = SortDict(curr_copyright_count);
            if (Danbooru.CU.user_settings.copyrights_merge) {
                let query_implications = JSPLib.utility.setDifference(Object.keys(curr_copyright_count),Object.keys(Danbooru.CU.reverse_implications));
                Object.assign(Danbooru.CU.reverse_implications,...(await Promise.all(query_implications.map(async (key)=>{return {[key]:await GetReverseTagImplication(key)};}))));
                Danbooru.CU.user_copytags[username] = Danbooru.CU.user_copytags[username].filter(value=>{return Danbooru.CU.reverse_implications[value] === 0;});
            }
            let copyright_symdiff = CompareCopyrightCounts(curr_copyright_count,prev_copyright_count);
            let copyright_changed = (is_new_tab ? Danbooru.CU.user_copytags[username] : JSPLib.utility.setIntersection(Danbooru.CU.user_copytags[username],copyright_symdiff));
            let copyright_nochange = (is_new_tab ? [] : JSPLib.utility.setDifference(Danbooru.CU.user_copytags[username],copyright_changed));
            $.each(copyright_nochange,(i,val)=>{
                if (CheckCopyrightVelocity(val) || IsMissingTag(val)) {
                    promise_array.push(GetTagData(val));
                }
                if (IsMissingTag(`user:${username} ${val}`)) {
                    promise_array.push(GetTagData(`user:${username} ${val}`));
                }
            });
            $.each(copyright_changed,(i,val)=>{
                promise_array.push(GetTagData(`user:${username} ${val}`));
                promise_array.push(GetTagData(val));
            });
        } else {
            Danbooru.CU.user_copytags[username] = [];
        }
        await Promise.all(promise_array);
    }
    JSPLib.storage.saveData(`previous-uploads-${username}`,{value: PreCompressData(current_uploads), expires: 0});
    return current_uploads;
}

async function PopulateTable(username) {
    //Prevent function from being reentrant while processing uploads
    PopulateTable.is_started = true;
    var post_data = [];
    if (Danbooru.CU.checked_users[username] === undefined) {
        $('#count-table').html(`<div id="empty-uploads">Loading data... (<span id="loading-counter">...</span>)</div>`);
        post_data = await ProcessUploads(username);
        Danbooru.CU.checked_users[username] = post_data.length;
    }
    if (Danbooru.CU.checked_users[username]) {
        await CheckPeriodUploads(username);
        $('#count-table').html(RenderTable());
        $('#count-controls').html(RenderAllTooltipControls());
        SetTooltipHover();
        SetTooltipChangeClick();
        GetPeriodClick();
        $(`.cu-select-tooltip[data-type="${Danbooru.CU.current_metric}"] a`).click();
    } else {
        $('#count-table').html(`<div id="empty-uploads">${Danbooru.CU.empty_uploads_message}</div>`);
    }
    PopulateTable.is_started = false;
}

//Settings menu

function RenderTextinput(program_shortcut,setting_name,length=20) {
    let program_key = program_shortcut.toUpperCase();
    let setting_key = KebabCase(setting_name);
    let display_name = DisplayCase(setting_name);
    let value = Danbooru[program_key].user_settings[setting_name];
    let hint = settings_config[setting_name].hint;
    return `
<div class="${program_shortcut}-textinput" data-setting="${setting_name}" style="margin:0.5em">
    <h4>${display_name}</h4>
    <div style="margin-left:0.5em">
        <input type="text" class="${program_shortcut}-setting" id="${program_shortcut}-setting-${setting_key}" value="${value}" size="${length}" autocomplete="off" class="text" style="padding:1px 0.5em">
        <span class="${program_shortcut}-setting-tooltip" style="display:block;font-style:italic;color:#666">${hint}</span>
    </div>
</div>`;
}

function RenderCheckbox(program_shortcut,setting_name) {
    let program_key = program_shortcut.toUpperCase();
    let setting_key = KebabCase(setting_name);
    let display_name = DisplayCase(setting_name);
    let checked = (Danbooru[program_key].user_settings[setting_name] ? "checked" : "");
    let hint = settings_config[setting_name].hint;
    return `
<div class="${program_shortcut}-checkbox" data-setting="${setting_name}" style="margin:0.5em">
    <h4>${display_name}</h4>
    <div style="margin-left:0.5em">
        <input type="checkbox" ${checked} class="${program_shortcut}-setting" id="${program_shortcut}-enable-${setting_key}">
        <span class="${program_shortcut}-setting-tooltip" style="display:inline;font-style:italic;color:#666">${hint}</span>
    </div>
</div>`;
}

function RenderInputSelectors(program_shortcut,setting_name,type) {
    let program_key = program_shortcut.toUpperCase();
    let setting_key = KebabCase(setting_name);
    let display_name = DisplayCase(setting_name);
    let all_selectors = settings_config[setting_name].allitems;
    let hint = settings_config[setting_name].hint;
    let html = '';
    $.each(all_selectors,(i,selector)=>{
        let checked = (Danbooru[program_key].user_settings[setting_name].includes(selector) ? "checked" : "");
        let display_selection = DisplayCase(selector);
        let selection_name = `${program_shortcut}-${setting_key}`;
        let selection_key = `${program_shortcut}-${setting_key}-${selector}`;
        html += `
            <label for="${selection_key}" style="width:100px">${display_selection}</label>
            <input type="${type}" ${checked} class="${program_shortcut}-setting" name="${selection_name}" id="${selection_key}" data-selector="${selector}">`;
    });
    return `
<div class="${program_shortcut}-selectors" data-setting="${setting_name}" style="margin:0.5em">
    <h4>${display_name}</h4>
    <div style="margin-left:0.5em">
        ${html}
        <span class="${program_shortcut}-setting-tooltip" style="display:block;font-style:italic;color:#666">${hint}</span>
    </div>
</div>
`;
}
function RenderLinkclick(program_shortcut,setting_name,display_name,link_text) {
    let setting_key = KebabCase(setting_name);
    return `
<div class="${program_shortcut}-linkclick" style="margin:0.5em">
    <h4>${display_name}</h4>
    <div style="margin-left:0.5em">
        <span class="${program_shortcut}-control-linkclick" style="display:block"><a href="#" id="${program_shortcut}-setting-${setting_key}" style="color:#0073ff">${link_text}</a></span>
    </div>
</div>`;
}

const cu_menu = `
<div id="cu-settings" style="float:left;;width:60em">
    <div id="cu-script-message" class="prose">
        <h2>CurrentUploads</h2>
        <p>Check the forum for the latest on information and updates (<a class="dtext-link dtext-id-link dtext-forum-topic-id-link" href="/forum_topics/15169" style="color:#0073ff">topic #15169</a>).</p>
    </div>
    <div id="cu-display-settings" style="margin-bottom:2em">
        <div id="cu-display-message" class="prose">
            <h4>Display settings</h4>
            <ul>
                <li><b>Period selectors:</b> Select which periods to process and show.</li>
            </ul>
        </div>
    </div>
    <div id="cu-cache-settings" style="margin-bottom:2em">
        <div id="cu-cache-message" class="prose">
            <h4>Cache settings</h4>
            <h5>Cache data</h5>
            <ul>
                <li><b>Count data:</b> Main data shown in the table.</li>
                <li><b>Post data:</b> Used to determine post statistics shown in the tooltips.</li>
                <li><b>Reverse tag implications:</b> Used to determine the base copyright tag.</li>
            </ul>
            <h5>Cache controls</h5>
            <ul>
                <li><b>Purge cache:</b> Dumps all of the cached data related to CurrentUploads.</li>
            </ul>
        </div>
    </div>
    <hr>
    <div id="cu-settings-buttons" style="margin-top:1em">
        <input type="button" id="cu-commit" value="Save">
        <input type="button" id="cu-resetall" value="Factory Reset">
    </div>
</div>`;

const settings_config = {
    copyrights_merge: {
        default: true,
        validate: (data)=>{return validate.isBoolean(data);},
        hint: "Merge all implied copyrights to their base copyright. Ex: (splatoon_1, splatoon_2) -> splatoon."
    },
    copyrights_enabled: {
        default: true,
        validate: (data)=>{return validate.isBoolean(data);},
        hint: "Process and show user copyright uploads."
    },
    periods_shown: {
        allitems: period_selectors,
        default: period_selectors,
        validate: (data)=>{return Array.isArray(data) && data.reduce((is_string,val)=>{return is_string && (typeof val === 'string') && period_selectors.includes(val);},true)},
        hint: "Uncheck to turn off event type."
    },
}

function LoadUserSettings(program_shortcut) {
    let user_settings = JSPLib.storage.getStorageData(`${program_shortcut}-user-settings`,localStorage,{});
    let is_dirty = false;
    $.each(settings_config,(setting)=>{
        if (!(setting in user_settings) || !settings_config[setting].validate(user_settings[setting])) {
            JSPLib.debug.debuglog("Loading default:",setting,user_settings[setting]);
            user_settings[setting] = settings_config[setting].default;
            is_dirty = true;
        }
    });
    let valid_settings = Object.keys(settings_config);
    $.each(user_settings,(setting)=>{
        if (!valid_settings.includes(setting)) {
            JSPLib.debug.debuglog("Deleting invalid setting:",setting,user_settings[setting]);
            delete user_settings[setting];
            is_dirty = true;
        }
    });
    if (is_dirty) {
        JSPLib.debug.debuglog("Saving change to user settings!");
        JSPLib.storage.setStorageData(`${program_shortcut}-user-settings`,user_settings,localStorage);
    }
    return user_settings;
}

function SaveUserSettingsClick(program_shortcut,program_name) {
    let program_key = program_shortcut.toUpperCase();
    $(`#${program_shortcut}-commit`).click((e)=>{
        let invalid_setting = false;
        let temp_selectors = {};
        $(`#${program_shortcut}-settings .${program_shortcut}-setting[id]`).each((i,entry)=>{
            let setting_name = $(entry).parent().parent().data('setting');
            if (entry.type === "checkbox") {
                let selector = $(entry).data('selector');
                if (selector) {
                    temp_selectors[setting_name] = temp_selectors[setting_name] || [];
                    if (entry.checked) {
                        temp_selectors[setting_name].push(selector);
                    }
                } else {
                    Danbooru[program_key].user_settings[setting_name] = entry.checked;
                }
            } else if (entry.type === "text") {
                 let user_setting = settings_config[setting_name].parse($(entry).val());
                 if (settings_config[setting_name].validate(user_setting)) {
                    Danbooru[program_key].user_settings[setting_name] = user_setting;
                 } else {
                    invalid_setting = true;
                 }
                 $(entry).val(Danbooru[program_key].user_settings[setting_name]);
            }
        });
        $.each(temp_selectors,(setting_name)=>{
            Danbooru[program_key].user_settings[setting_name] = temp_selectors[setting_name];
        });
        JSPLib.storage.setStorageData(`${program_shortcut}-user-settings`,Danbooru[program_key].user_settings,localStorage);
        Danbooru[program_key].channel && Danbooru[program_key].channel.postMessage({type: "settings", user_settings: Danbooru[program_key].user_settings});
        if (!invalid_setting) {
            Danbooru.Utility.notice(`${program_name}: Settings updated!`);
        } else {
            Danbooru.Utility.error("Error: Some settings were invalid!")
        }
    });
}

function ResetUserSettingsClick(program_shortcut,program_name,delete_keys,reset_settings) {
    let program_key = program_shortcut.toUpperCase();
    $(`#${program_shortcut}-resetall`).click((e)=>{
        if (confirm(`This will reset all of ${program_name}'s settings.\n\nAre you sure?`)) {
            $.each(settings_config,(setting)=>{
                Danbooru[program_key].user_settings[setting] = settings_config[setting].default;
            });
            $(`#${program_shortcut}-settings .${program_shortcut}-setting[id]`).each((i,entry)=>{
                let $input = $(entry);
                let setting_name = $input.parent().parent().data('setting');
                if (entry.type === "checkbox") {
                    let selector = $input.data('selector');
                    if (selector) {
                        $input.prop('checked', IsSettingEnabled(setting_name,selector));
                        $input.checkboxradio("refresh");
                    } else {
                        $input.prop('checked', Danbooru[program_key].user_settings[setting_name]);
                    }
                } else if (entry.type === "text") {
                     $input.val(Danbooru[program_key].user_settings[setting_name]);
                }
            });
            $.each(delete_keys,(i,key)=>{
                localStorage.removeItem(key);
            });
            Object.assign(Danbooru[program_key],reset_settings);
            JSPLib.storage.setStorageData(`${program_shortcut}-user-settings`,Danbooru[program_key].user_settings,localStorage);
            Danbooru[program_key].channel && Danbooru[program_key].channel.postMessage({type: "reset", user_settings: Danbooru[program_key].user_settings});
            Danbooru.Utility.notice(`${program_name}: Settings reset to defaults!`);
        }
    });
}

async function PurgeCache(regex,domname) {
    Danbooru.Utility.notice("Starting cache deletion...");
    let promise_array = [];
    let purged_count = 0;
    let remaining_count = 0;
    await JSPLib.storage.danboorustorage.iterate((value,key)=>{
        if (key.match(regex)) {
            JSPLib.debug.debuglogLevel("Deleting",key,JSPLib.debug.DEBUG);
            let resp = JSPLib.storage.removeData(key).then(()=>{
                domname && $(domname).html(--remaining_count);
            });
            promise_array.push(resp);
            purged_count += 1;
            domname && $(domname).html(++remaining_count);
        }
    });
    Danbooru.Utility.notice(`Deleting ${purged_count} items...`);
    JSPLib.debug.debuglogLevel(`Deleting ${purged_count} items...`,JSPLib.debug.INFO);
    //Wait at least 5 seconds
    await JSPLib.utility.sleep(5000);
    await Promise.all(promise_array);
    Danbooru.Utility.notice("Finished deleting cached data!");
    JSPLib.debug.debuglogLevel("Finished deleting cached data!",JSPLib.debug.INFO);
}

function PurgeCacheClick(program_shortcut,program_name,regex,domname) {
    let program_key = program_shortcut.toUpperCase();
    $(`#${program_shortcut}-setting-purge-cache`).click((e)=>{
        if (!PurgeCacheClick.is_started && confirm(`This will delete all of ${program_name}'s cached data.\n\nAre you sure?`)) {
            PurgeCacheClick.is_started = true;
            PurgeCache(regex,domname).then(()=>{
                Danbooru[program_key].channel && Danbooru[program_key].channel.postMessage({type: "purge"});
                PurgeCacheClick.is_started = false;
            });;
        }
        e.preventDefault();
    });
}

function RenderSettingsMenu() {
    $("#current-uploads").append(cu_menu);
    $("#cu-display-settings").append(RenderCheckbox('cu','copyrights_merge'));
    $("#cu-display-settings").append(RenderCheckbox('cu','copyrights_enabled'));
    $("#cu-display-settings").append(RenderInputSelectors('cu','periods_shown','checkbox'));
    $("#cu-cache-settings").append(RenderLinkclick("cu",'purge_cache',`Purge cache (<span id="cu-purge-counter">...</span>)`,"Click to purge"));
    $(".cu-selectors input").checkboxradio();
    $(".cu-selectors .ui-state-hover").removeClass('ui-state-hover'); //Because of jQuery-UI bug
    $("#cu-periods-shown-daily").checkboxradio("disable"); //Daily period is mandatory
    SaveUserSettingsClick('cu','CurrentUploads');
    ResetUserSettingsClick('cu','CurrentUploads',localstorage_keys,program_reset_keys);
    PurgeCacheClick('cu','CurrentUploads',program_cache_regex,"#cu-purge-counter");
}

//Main menu tabs

const css_themes_url = 'https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/themes/base/jquery-ui.css';

const settings_field = `
<fieldset id="userscript-settings-menu" style="display:none">
  <ul id="userscript-settings-tabs">
  </ul>
  <div id="userscript-settings-sections">
  </div>
</fieldset>`;

function RenderTab(program_name,program_key) {
    return `<li><a href="#${program_key}">${program_name}</a></li>`;
}

function RenderSection(program_key) {
    return `<div id="${program_key}"></div>`;
}

function MainSettingsClick() {
    if (!IsNamespaceBound(`[href="#userscript-menu"`,'click','jsplib.menuchange')) {
        $(`[href="#userscript-menu"`).on('click.jsplib.menuchange',(e)=>{
            $(`#edit-options a[href$="settings"]`).removeClass("active");
            $(e.target).addClass("active");
            $(".edit_user > fieldset").hide();
            $("#userscript-settings-menu").show();
            $('[name=commit]').hide();
            e.preventDefault();
        });
    }
}
function OtherSettingsClicks() {
    if (!IsNamespaceBound("#edit-options a[href$=settings]",'click','jsplib.menuchange')) {
        $("#edit-options a[href$=settings]").on('click.jsplib.menuchange',(e)=>{
            $(`[href="#userscript-menu"`).removeClass('active');
            $("#userscript-settings-menu").hide();
            $('[name=commit]').show();
            e.preventDefault()
        });
    }
}

function InstallSettingsMenu(program_name) {
    let program_key = KebabCase(program_name);
    if ($("#userscript-settings-menu").length === 0) {
        $(`input[name="commit"]`).before(settings_field);
        $("#edit-options").append('| <a href="#userscript-menu">Userscript Menus</a>');
        //Periodic recheck in case other programs remove/rebind click events
        setInterval(()=>{
            MainSettingsClick();
            OtherSettingsClicks();
        },1000);
        AddStyleSheet(css_themes_url);
    } else {
        $("#userscript-settings-menu").tabs("destroy");
    }
    $("#userscript-settings-tabs").append(RenderTab(program_name,program_key));
    $("#userscript-settings-sections").append(RenderSection(program_key));
    //Sort the tabs alphabetically
    $("#userscript-settings-tabs li").sort(function(a, b) {
        try {
            return a.children[0].innerText.localeCompare(b.children[0].innerText);
        } catch (e) {
            return 0;
        }
    }).each(function() {
        var elem = $(this);
        elem.remove();
        $(elem).appendTo("#userscript-settings-tabs");
    });
    $("#userscript-settings-menu").tabs();
}

/****MAIN****/

function main() {
    Danbooru.CU = {
        username: JSPLib.utility.getMeta("current-user-name"),
        is_gold_user: $('body').data('user-is-gold'),
        user_settings: LoadUserSettings('cu'),
        channel: new BroadcastChannel('CurrentUploads'),
        checked_usernames: {},
        checked_users: {},
        user_copytags: {},
        period_available: {},
        reverse_implications: {},
        current_metric: JSPLib.storage.getStorageData('cu-current-metric',localStorage,'score'),
        hidden: JSPLib.storage.getStorageData('cu-hide-current-uploads',localStorage,0),
        stashed: JSPLib.storage.getStorageData('cu-stash-current-uploads',localStorage,0)
    };
    Danbooru.CU.channel.onmessage = BroadcastCU;
    JSPLib.utility.setCSSStyle(program_css,'program');
    $notice_box = $(notice_box);
    $footer_notice = $(unstash_notice);
    if (Danbooru.CU.stashed === 1) {
        $($notice_box).addClass('stashed');
        $($footer_notice).addClass('stashed');
    }
    $('header#top').append($notice_box);
    $('footer#page-footer').append($footer_notice);
    SetToggleNoticeClick();
    SetStashNoticeClick();
    SetCheckUserClick();
    if (Danbooru.CU.hidden === 0) {
        //Set to opposite so that click can be used and sets it back
        Danbooru.CU.hidden = 1;
        $("#toggle-count-notice").click();
    }
    if ($("#c-users #a-edit").length) {
        InstallScript("https://cdn.rawgit.com/jquery/jquery-ui/1.12.1/ui/widgets/tabs.js").done(()=>{
            InstallSettingsMenu("CurrentUploads");
            RenderSettingsMenu();
        });
    }
    JSPLib.debug.debugExecute(()=>{
        window.addEventListener('beforeunload',function () {
            JSPLib.statistics.outputAdjustedMean("CurrentUploads");
        });
    });
    //Take care of other non-critical tasks at a later time
    setTimeout(()=>{
        JSPLib.storage.pruneEntries('cu',program_cache_regex,prune_expires);
    },JSPLib.utility.one_minute);
}

JSPLib.load.programInitialize(main,'CU',program_load_required_variables,program_load_required_selectors);
