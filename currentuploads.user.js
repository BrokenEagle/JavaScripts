// ==UserScript==
// @name         CurrentUploads
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      9.0
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
JSPLib.debug.level = JSPLib.debug.DEBUG;

//Variables for load.js
const program_load_required_variables = ['window.jQuery'];
const program_load_required_ids = ["top","page-footer"];

//Variables for danbooru.js
JSPLib.danbooru.counter_domname = "#loading-counter";

//Main function expires
const prune_expires = JSPLib.utility.one_day;

//Maximum number of entries to prune in one go
const prune_limit = 1000;

//Time periods
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
var empty_uploads_message;

//Placeholders for setting during program execution
var username;
var is_gold_user;
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
        <a href="#" id="hide-count-notice">Toggle Upload Table</a>&nbsp;(<a href="#" id="stash-count-notice">STASH</a>)
    </div>
</div>
`;

const unstash_notice = '<span id="upload-counts-restore"> - <a href="#" id="restore-count-notice">Restore CurrentUploads</a></span>';

//Validation values

validate.validators.hash = function(value, options, key, attributes) {
    if (options !== false) {
        if (validate.isHash(value)) {
            return;
        }
        return "is not a hash";
    }
};

const hash_constraints = {
    presence: true,
    hash: true
}

const fix_expires_constraints = {
    presence: true,
    numericality: {
        onlyInteger: true,
        greaterThan: -1,
    }
}

const number_constraints = {
    presence: true,
    numericality: true
}

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
        score: hash_constraints,
        upscore: hash_constraints,
        downscore: hash_constraints,
        favcount: hash_constraints,
        tagcount: hash_constraints,
        gentags: hash_constraints
    },
    poststat: {
        max: JSPLib.validate.integer_constraints,
        average: number_constraints,
        stddev: number_constraints,
        outlier: JSPLib.validate.integer_constraints,
        adjusted: number_constraints
    }
};

/**FUNCTIONS**/

//Validation functions

function ValidateIsArray(key,entry,length) {
    let array_validator = {
        presence: true,
        array: (length ? {length: length} : true)
     };
    let check = validate({value: entry}, {value: array_validator});
    if (check !== undefined) {
        JSPLib.validate.printValidateError(key,check);
        return false;
    }
    return true;
}

function ValidateIsHash(key,entry) {
    let check = validate({value: entry}, {value: hash_constraints});
    if (check !== undefined) {
        JSPLib.validate.printValidateError(key,check);
        return false;
    }
    return true;
}

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
        expires: fix_expires_constraints,
        value: validation_constraints[validation_key]
    };
}

function ValidateEntry(key,entry) {
    if (!ValidateIsHash(key,entry)) {
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
        if (!ValidateIsArray(value_key, postentries[i], validation_constraints.postentry.length)) {
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

function DebugExecute(func) {
    if (JSPLib.debug.debug_console) {
        func();
    }
}

function GetMeta(key) {
  return $("meta[name=" + key + "]").attr("content");
}

function GetExpiration(expires) {
    return Date.now() + expires;
}

function ValidateExpires(actual_expires,expected_expires) {
    //Resolve to true if the actual_expires is bogus, has expired, or the expiration is too long
    return !Number.isInteger(actual_expires) || (Date.now() > actual_expires) || ((actual_expires - Date.now()) > expected_expires);
}

function PruneEntries(modulename,regex) {
    let timer_name = modulename + '-' + "PruneEntries";
    let expire_name = modulename + '-prune-expires';
    JSPLib.debug.debugTime(timer_name);
    let expires = JSPLib.storage.getStorageData(expire_name,localStorage,0);
    if (ValidateExpires(expires, prune_expires)) {
        JSPLib.debug.debuglog("PruneIACEntries");
        PruneStorage(regex).then(()=>{
            JSPLib.debug.debuglog("Pruning complete!");
            JSPLib.debug.debugTimeEnd(timer_name);
        });
        JSPLib.storage.setStorageData(expire_name, GetExpiration(prune_expires), localStorage);;
    } else {
        JSPLib.debug.debuglog("No prune of entries!");
    }
}

async function PruneStorage(regex) {
    if (JSPLib.storage.use_storage) {
        let pruned_items = 0;
        let total_items = 0;
        let promise_array = [];
        await JSPLib.storage.danboorustorage.iterate((value,key)=>{
            if (key.match(regex)) {
                if (JSPLib.storage.hasDataExpired(value)) {
                    JSPLib.debug.debuglog("Deleting",key);
                    promise_array.push(JSPLib.storage.removeData(key));
                    pruned_items += 1;
                }
                total_items += 1;
                if (pruned_items >= prune_limit) {
                    JSPLib.debug.debuglog("Prune limit reached!");
                    return true;
                }
            }
        });
        JSPLib.debug.debuglog(`Pruning ${pruned_items}/${total_items} items!`);
        return Promise.all(promise_array);
    }
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
    $.each(timevalues,(i,period)=>{
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
    var rowtag = key == ''? 'user:' + username : key;
    var rowtext = (key == ''? username : key).replace(/_/g,' ');
    var tabletext = AddTableData(JSPLib.danbooru.postSearchLink(rowtag,JSPLib.utility.maxLengthString(rowtext)));
    for (let i = 0;i < timevalues.length; i++) {
        let period = timevalues[i];
        let data_text = GetTableValue(key,period);
        let is_available = CheckPeriodStatus(period,'available');
        let is_limited = limited_periods.includes(period);
        if (is_available && is_limited && key == '') {
            tabletext += AddTableData(RenderTooltipData(data_text,timevalues[i],true));
        } else if (is_available && !is_limited) {
            tabletext += AddTableData(RenderTooltipData(data_text,timevalues[i]));
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
        return GetCountData('ct' + type + '-user:' + username,"N/A");
    }
    var useruploads = GetCountData('ct' + type + '-user:' + username + ' ' + key,"N/A");
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
    let html_text = "";
    $.each(tooltip_metrics,(i,metric)=> {
        html_text += RenderToolpopup(metric,period,limited);
    });
    return html_text;
}

function RenderToolpopup(metric,period,limited) {
    let inner_text = (limited ? RenderStatistics('',metric,period,true) : '');
    return `
    <span class="cu-tooltiptext" data-type="${metric}">${inner_text}</span>`;
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
<span class="cu-select-tooltip" data-type="${metric}"><a href="#">${JSPLib.utility.titleizeString(metric)}</a></span>`;
}

function RenderStatistics(key,attribute,period,limited=false) {
    let period_name = period_info.longname[period];
    let data = JSPLib.storage.getStorageData(`${period_name}-uploads-${username}`,sessionStorage);
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
    return (type === 'at' ? '' : ('age:..1' + type + ' ')) + tag + (is_gold_user ? ' -' + JSPLib.danbooru.randomDummyTag() : '');
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
    if (dayuploads === null || weekuploads === null) {
        return true;
    }
    var day_gettime =  dayuploads.expires - period_info.countexpires.d; //Time data was originally retrieved
    var week_velocity = (JSPLib.utility.one_week) / (weekuploads.value | 1); //Milliseconds per upload
    var adjusted_poll_interval = Math.min(week_velocity, JSPLib.utility.one_day); //Max wait time is 1 day
    return Date.now() > day_gettime + adjusted_poll_interval;
}

function IsMissingTag(tag) {
    return timevalues.reduce((total,period)=>{return total || !GetCountData(`ct${period}-${tag}`);},false);
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
    return Promise.all([
        GetCount('d',tag),
        GetCount('w',tag),
        GetCount('mo',tag),
        GetCount('y',tag),
        GetCount('at',tag)
    ]);
}

async function CheckPeriodUploads() {
    CheckPeriodUploads[username] = CheckPeriodUploads[username] || {};
    for (let i = 0; i < timevalues.length; i++) {
        let period = timevalues[i];
        if (period in CheckPeriodUploads[username]) {
            continue;
        }
        CheckPeriodUploads[username][period] = CheckPeriodUploads[username][period] || {available: false};
        let period_name = period_info.longname[period];
        let key = `${period_name}-uploads-${username}`;
        var check = await JSPLib.storage.checkLocalDB(key,ValidateEntry);
        if (check) {
            CheckPeriodUploads[username][period].available = true;
        }
    }
}

function CheckPeriodStatus(period,stat) {
    return (period in CheckPeriodUploads[username]) && CheckPeriodUploads[username][period][stat];
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
        return JSPLib.danbooru.submitRequest('counts/posts',{tags: BuildTagParams(type,tag)},{counts: {posts: 0}},key)
        .then(data=>{
            JSPLib.storage.saveData(key, {value: data.counts.posts, expires: GetExpiration(period_info.countexpires[type])});
        });
    }
}

function CheckUser(username) {
    return JSPLib.danbooru.submitRequest('users', {search: {name_matches: username}});
}

async function GetPeriodUploads(username,period,limited=false,domname=null) {
    let period_name = period_info.longname[period];
    let key = `${period_name}-uploads-${username}`;
    var check = await JSPLib.storage.checkLocalDB(key,ValidateEntry);
    if (!(check)) {
        JSPLib.debug.debuglog(`Network (${period_name} uploads)`);
        let data = await GetPostsCountdown(max_post_limit_query,BuildTagParams(period,`user:${username}`),domname);
        let mapped_data = MapPostData(data);
        if (limited) {
            mapped_data = Object.assign(...tooltip_metrics.map((metric)=>{return {[metric]: GetPostStatistics(mapped_data,metric)};}));
            JSPLib.storage.saveData(key, {value: mapped_data, expires: GetExpiration(period_info.uploadexpires[period])});
        } else {
            JSPLib.storage.saveData(key, {value: PreCompressData(mapped_data), expires: GetExpiration(period_info.uploadexpires[period])});
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
        await GetPeriodUploads(username,period,is_limited,`#count-table th[data-period=${period}] .cu-counter`);
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
        let tooltip_type = JSPLib.storage.getStorageData('cu-current-metric',localStorage,'score');
        $(`.cu-select-tooltip[data-type="${tooltip_type}"] a`).click();
        $(header).addClass("cu-processed");
    });
}

function SetTooltipChangeClick() {
    $(".cu-select-tooltip").click((e)=>{
        let tooltip_type = $(e.target.parentElement).data('type');
        $(".cu-select-tooltip,.cu-tooltiptext").removeClass("cu-activetooltip");
        $(`.cu-select-tooltip[data-type="${tooltip_type}"]`).addClass("cu-activetooltip");
        $(`.cu-tooltiptext[data-type="${tooltip_type}"]`).addClass("cu-activetooltip");
        JSPLib.storage.setStorageData('cu-current-metric',tooltip_type,localStorage);
    });
}

function SetCountNoticeClick() {
    $("#hide-count-notice").click((e)=>{
        if (JSPLib.storage.getStorageData('cu-hide-current-uploads',localStorage,0) === 1) {
            JSPLib.storage.setStorageData('cu-hide-current-uploads',0,localStorage);
            $('#upload-counts').addClass('opened');
            //Prevent processing potentially bad usernames set by SetCheckUserClick
            username = GetMeta("current-user-name");
            empty_uploads_message = (username === "Anonymous" ? empty_uploads_message_anonymous : empty_uploads_message_owner);
            PopulateTable();
        } else {
            JSPLib.storage.setStorageData('cu-hide-current-uploads',1,localStorage);
            $('#upload-counts').removeClass('opened');
        }
        e.preventDefault();
    });
}

function SetStashNoticeClick() {
    $("#stash-count-notice").click((e)=>{
        JSPLib.storage.setStorageData('cu-stash-current-uploads',1,localStorage);
        //Hide the table so that it doesn't always process on each page load
        JSPLib.storage.setStorageData('cu-hide-current-uploads',1,localStorage);
        $('#upload-counts,#upload-counts-restore').removeClass('opened').addClass('stashed');
        e.preventDefault();
    });
}

function SetRestoreNoticeClick() {
    $("#restore-count-notice").click((e)=>{
        JSPLib.storage.setStorageData('cu-stash-current-uploads',0,localStorage);
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

async function ProcessUploads() {
    var promise_array = [];
    var current_uploads = [];
    if (username !== "Anonymous") {
        var current_uploads = await GetPeriodUploads(username,'d');
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
        if (is_gold_user) {
            let curr_copyright_count = GetCopyrightCount(current_uploads);
            let prev_copyright_count = GetCopyrightCount(previous_uploads);
            await Promise.all($.map(curr_copyright_count,(val,key)=>{return GetReverseTagImplication(key);}));
            user_copytags[username] = SortDict(curr_copyright_count).filter(value=>{return JSPLib.storage.getStorageData('rti-'+value,sessionStorage).value == 0;});
            let copyright_symdiff = CompareCopyrightCounts(curr_copyright_count,prev_copyright_count);
            let copyright_changed = (is_new_tab ? user_copytags[username] : JSPLib.utility.setIntersection(user_copytags[username],copyright_symdiff));
            let copyright_nochange = (is_new_tab ? [] : JSPLib.utility.setDifference(user_copytags[username],copyright_changed));
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
            user_copytags[username] = [];
        }
        await Promise.all(promise_array);
    }
    JSPLib.storage.saveData(`previous-uploads-${username}`,{value: PreCompressData(current_uploads), expires: 0});
    return current_uploads;
}

async function PopulateTable() {
    PopulateTable.checked_users = PopulateTable.checked_users || [];
    if (!PopulateTable.is_started) {
        var post_data = [];
        if (PopulateTable.checked_users.indexOf(username) < 0) {
            PopulateTable.is_started = true;
            $('#count-table').html(`<div id="empty-uploads">Loading data... (<span id="loading-counter">...</span>)</div>`);
            post_data = await ProcessUploads();
            PopulateTable.checked_users.push(username);
            PopulateTable.is_started = false;
        } else {
            post_data = JSPLib.storage.getStorageData(`daily-uploads-${username}`,sessionStorage).value;
        }
        if (post_data.length) {
            await CheckPeriodUploads();
            $('#count-table').html(RenderTable());
            $('#count-controls').html(RenderAllTooltipControls());
            SetTooltipHover();
            SetTooltipChangeClick();
            GetPeriodClick();
            let tooltip_type = JSPLib.storage.getStorageData('cu-current-metric',localStorage,'score');
            $(`.cu-select-tooltip[data-type="${tooltip_type}"] a`).click();
        } else {
            $('#count-table').html(`<div id="empty-uploads">${empty_uploads_message}</div>`);
        }
    }
}

function main() {
    username = GetMeta("current-user-name");
    is_gold_user = $('body').data('user-is-gold');
    JSPLib.utility.setCSSStyle(program_css,'program');
    $notice_box = $(notice_box);
    $footer_notice = $(unstash_notice);
    if (JSPLib.storage.getStorageData('cu-stash-current-uploads',localStorage,0) === 1) {
        $($notice_box).addClass('stashed');
        $($footer_notice).addClass('stashed');
    }
    $('header#top').append($notice_box);
    $('footer#page-footer').append($footer_notice);
    SetCountNoticeClick();
    SetStashNoticeClick();
    SetRestoreNoticeClick();
    SetCheckUserClick();
    if (JSPLib.storage.getStorageData('cu-hide-current-uploads',localStorage,0) === 0) {
        //Set to opposite so that click can be used and sets it back
        JSPLib.storage.setStorageData('cu-hide-current-uploads',1,localStorage);
        $("#hide-count-notice").click();
    }
    DebugExecute(()=>{
        window.addEventListener('beforeunload',function () {
            JSPLib.statistics.outputAdjustedMean("CurrentUploads");
        });
    });
    //Take care of other non-critical tasks at a later time
    setTimeout(()=>{
        PruneEntries('CU',/^rti-|ct(?:d|w|mo|y|at)?-|(?:daily|weekly|monthly|previous)-uploads-/);
    },JSPLib.utility.one_minute);
}

JSPLib.load.programInitialize(main,'CU',program_load_required_variables,program_load_required_ids);
