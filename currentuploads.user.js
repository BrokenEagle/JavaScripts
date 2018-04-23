// ==UserScript==
// @name         CurrentUploads
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      6
// @source       https://danbooru.donmai.us/users/23799
// @description  Gives up-to-date stats on uploads
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/currentuploads.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.5.2/localforage.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.12.0/validate.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180421/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180421/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180421/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180421/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180421/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180421/lib/statistics.js
// ==/UserScript==

/**GLOBAL VARIABLES**/

//Variables for debug.js
JSPLib.debug.debug_console = true;

//Variables for load.js
const program_load_required_variables = ['jQuery','Danbooru'];

//Affects how much of a tag will be shown
const max_column_characters = 20;

//Column headers of the count table
const column_headers = ['Name','Day','Week','Month','Year','All-time'];

//Time constant
const one_minute = 60 * 1000;

//Value expirations
const expirations = {'d':5,'w':60,'mo':24*60,'y':7*24*60,'at':30*24*60};
const rti_expiration = 30*24*60 * one_minute; //one month

//Network call configuration
const max_post_limit_query = 100;
const max_network_requests = 25;
const rate_limit_wait = 500;

//Placeholders for setting during program execution
var username;
var use_dummy_value;
var num_network_requests = 0;

//Style information
const program_css = `
#upload-counts {
    border: lightgrey dotted;
    max-width: ${max_column_characters + 35}em;
}
#count-table {
    white-space: nowrap;
}
#count-table.overflowed {
    max-height: 20em;
    overflow-x: hidden;
    overflow-y: auto;
}
#count-module {
    margin-bottom: 1em;
    display: none;
    border: lightgrey solid 1px;
}
#count-controls {
    margin-top: 1em;
    margin-left: 1em;
}
#upload-counts {
    margin-left: 2em;
}
#empty-uploads {
    margin: 1em;
    font-size: 200%;
    font-weight: bold;
    font-family: monospace;
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
var notice_box = `
<div class="ui-corner-all" id="upload-counts">
    <div id="count-module">
        <div id="count-table">
        </div>
        <div id="count-controls">
        </div>
    </div>
    <span><a href="#" id="hide-count-notice">Toggle Upload Table</a></span>
</div>
`;

const tooltip_metrics = {
    score: 'score',
    upscore: 'up_score',
    downscore: 'down_score',
    favcount: 'fav_count',
    tagcount: 'tag_count',
    gentags: 'tag_count_general'
};

//Used for value validations
const validation_constraints = {
    countentry: JSPLib.validate.postcount_constraints,
    implicationentry: {
        presence: true,
        numericality: {
            noStrings: true,
            onlyInteger: true
        }
    },
    postentry: {
        presence: true,
        array: true
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
    else if (key.match(/^current-uploads-/)) {
        return 'postentry';
    }
}

function BuildValidator(key) {
    return {
        expires: JSPLib.validate.expires_constraints,
        value: validation_constraints[ValidationSelector(key)]
    };
}

function ValidateEntry(key,entry) {
    if (entry === null) {
        JSPLib.debug.debuglog(key,"entry not found!");
        return false;
    }
    check = validate(entry,BuildValidator(key));
    if (check !== undefined) {
        JSPLib.validate.printValidateError(key,check);
        return false;
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
    if (ProcessUploads.copytags.length > 3) {
        $("#count-table").addClass("overflowed");
    }
    var tabletext = RenderRow('');
    for (let i = 0;i < ProcessUploads.copytags.length; i++) {
        tabletext += RenderRow(ProcessUploads.copytags[i]);
    }
    return AddTableBody(tabletext);
}

function RenderRow(key) {
    const timevalues = ['d','w','mo','y','at'];
    var rowtag = encodeURIComponent(key == ''? 'user:' + username : key);
    var rowtext = (key == ''? username : key).replace(/_/g,' ');
    var tabletext = AddTableData(PostSearchLink(rowtag,MaxEntryLength(rowtext)));
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

function PostSearchLink(tag,text) {
    return `<a href=/posts?tags=${tag}>${text}</a>`;
}

function GetTableValue(key,type) {
    if (key == '') {
        //Adding the '' to undefined changes it to a string
        return (JSPLib.storage.getSessionData('ct' + type + '-user:' + username).value + '').toString();
    }
    var useruploads = (JSPLib.storage.getSessionData('ct' + type + '-user:' + username + ' ' + key).value + '').toString();
    var alluploads = (JSPLib.storage.getSessionData('ct' + type + '-' + key).value + '').toString();
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
    $.each(tooltip_metrics,(metric,attribute)=> {
        html_text += RenderToolpopup(key,metric,attribute);
    });
    return html_text;
}

function RenderToolpopup(key,metric,attribute) {
    return `
<span class="tooltiptext" data-key="${key}" data-type="${metric}" data-attribute="${attribute}"></span>`;
}

function RenderAllTooltipControls() {
    let html_text = "";
    $.each(tooltip_metrics,(metric,attribute)=> {
        html_text += RenderToolcontrol(metric);
    });
    return html_text;
}

function RenderToolcontrol(metric) {
    return `
<span class="select-tooltip" data-type="${metric}"><a href="#">${TitleizeString(metric)}</a></span>`;
}

function RenderStatistics(key,attribute) {
    let current_uploads = JSPLib.storage.getSessionData(`current-uploads-${username}`).value;
    if (key !== '') {
        current_uploads = current_uploads.filter(val=>{return val.tag_string_copyright.match(TagRegExp(key));});
    }
    let upload_scores = GetObjectAttributes(current_uploads,attribute);
    let score_max = ValuesMax(upload_scores);
    let score_average = JSPLib.statistics.average(upload_scores);
    let score_stddev = JSPLib.statistics.standardDeviation(upload_scores);
    let score_outliers = JSPLib.statistics.removeOutliers(upload_scores);
    let score_removed = upload_scores.length - score_outliers.length;
    let score_adjusted = JSPLib.statistics.average(score_outliers);
    return `
<ul>
<li>Max: ${score_max}</li>
<li>Avg: ${SetPrecision(score_average,2)}</li>
<li>StD: ${SetPrecision(score_stddev,2)}</li>
<li>Out: ${score_removed}</li>
<li>Adj: ${SetPrecision(score_adjusted,2)}</li>
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

function RandomDummyTag() {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    var result = '';
    for (var i = 8; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
    return 'dummytag-' + result;
}

function BuildTagParams(type,tag) {
    return {'tags':(type === 'at' ? '' : ('age:..1' + type + ' ')) + tag + (use_dummy_value ? ' -' + RandomDummyTag() : '')};
}

function MaxEntryLength(string) {
    if (string.length > max_column_characters) {
        string = string.slice(0,max_column_characters-1) + '…';
    }
    return string;
}

function TitleizeString(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function RemoveDanbooruDuplicates(array) {
    let seen_array = [];
    return array.filter(value=>{
        if ($.inArray(value.id,seen_array) >= 0) {
            return;
        }
        seen_array.push(value.id);
        return value;
    });
}

function IncrementCounter() {
    num_network_requests += 1;
    $('#loading-counter').html(num_network_requests);
}

function DecrementCounter() {
    num_network_requests -= 1;
    $('#loading-counter').html(num_network_requests);
}

async function RateLimit() {
    while (num_network_requests >= max_network_requests) {
        await JSPLib.utility.sleep(rate_limit_wait);
    }
}

function GetCopyrightCount(posts) {
    let copyright_count = {};
    $.each(posts,(i,entry)=>{
        $.each(entry.tag_string_copyright.split(' '),(j,tag)=>{
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
    var dayuploads = JSPLib.storage.getSessionData('ctd-' + tag);
    var weekuploads = JSPLib.storage.getSessionData('ctw-' + tag);
    if (dayuploads === undefined || weekuploads === undefined) {
        return true;
    }
    var day_gettime =  dayuploads.expires - expirations.d * one_minute; //Time data was originally retrieved
    var week_velocity = (7 * 24 * 60 * one_minute) / (weekuploads.value | 1); //Milliseconds per upload
    var adjusted_poll_interval = Math.min(week_velocity,24 * 60 * one_minute); //Max wait time is 1 day
    return Date.now() > day_gettime + adjusted_poll_interval;
}

function GetObjectAttributes(array,attribute) {
    return array.map(val=>{return val[attribute];});
}

function ValuesMax(array) {
    return array.reduce(function(a, b) { return Math.max(a,b); });
}

function ValuesMin(array) {
    return array.reduce(function(a, b) { return Math.min(a,b); });
}

function SetPrecision(number,precision) {
    return parseFloat(number.toFixed(precision));
}

function TagRegExp(str) {
    return RegExp('(?<!\S)'+str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1") +'(?!\S)','gi');
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

async function GetAllDanbooru(type,url_addons,limit) {
    var return_items = [];
    var page_addon = {};
    var limit_addon = {limit: limit};
    var lastid = 0;
    while (true) {
        let request_addons = Object.assign({},url_addons,page_addon,limit_addon);
        let request_key = $.param(request_addons);
        JSPLib.debug.recordTime(request_key,'Network');
        let temp_items = await $.getJSON(`/${type}`,request_addons);
        JSPLib.debug.recordTimeEnd(request_key,'Network');
        return_items = return_items.concat(temp_items);
        if (temp_items.length < limit) {
            return return_items;
        }
        let lastid = ValuesMin(GetObjectAttributes(temp_items,'id'));
        page_addon = {page:`b${lastid}`};
    }
}

async function GetReverseTagImplication(tag) {
    var key = 'rti' + '-' + tag;
    var check = await JSPLib.storage.checkLocalDB(key,ValidateEntry);
    if (!(check)) {
        JSPLib.debug.debuglog("Network (implication):",key);
        await RateLimit();
        IncrementCounter();
        JSPLib.debug.recordTime(key,'Network');
        return $.getJSON('/tag_implications?search[antecedent_name]=' + encodeURIComponent(tag)
        ).then(data=>{
            JSPLib.storage.saveData(key, {'value':data.length,'expires':Date.now() + rti_expiration});
        }).always(()=>{
            JSPLib.debug.recordTimeEnd(key,'Network');
            DecrementCounter();
        });
    }
}

async function GetCount(type,tag) {
    var key = 'ct' + type + '-' + tag;
    var check = await JSPLib.storage.checkLocalDB(key,ValidateEntry);
    if (!(check)) {
        JSPLib.debug.debuglog("Network (count):",key);
        await RateLimit();
        IncrementCounter();
        JSPLib.debug.recordTime(key,'Network');
        return $.getJSON('/counts/posts',BuildTagParams(type,tag)
        ).then(data=>{
            JSPLib.storage.saveData(key, {'value':data.counts.posts,'expires':Date.now() + expirations[type] * one_minute});
        }).always(()=>{
            JSPLib.debug.recordTimeEnd(key,'Network');
            DecrementCounter();
        });
    }
}

async function GetCurrentUploads(username) {
    let key = `current-uploads-${username}`;
    var check = await JSPLib.storage.checkLocalDB(key,ValidateEntry);
    if (!(check)) {
        JSPLib.debug.debuglog("Network (current uploads)");
        let data = await GetAllDanbooru('posts',BuildTagParams('d',`user:${username}`),max_post_limit_query);
        JSPLib.storage.saveData(key,{'value':data,'expires':Date.now() + 5 * one_minute});
        return data;
    } else {
        return JSPLib.storage.getSessionData(key).value;
    }
}

//Main functions

async function ProcessUploads() {
    var promise_array = [];
    var current_uploads = await GetCurrentUploads(username);
    if (current_uploads.length) {
        let is_new_tab = JSPLib.storage.getSessionData(`previous-uploads-${username}`) === undefined;
        let previous_uploads = await JSPLib.storage.retrieveData(`previous-uploads-${username}`) || [];
        let symmetric_difference = JSPLib.utility.setSymmetricDifference(GetObjectAttributes(current_uploads,'id'),GetObjectAttributes(previous_uploads,'id'));
        if (is_new_tab || symmetric_difference.length) {
            promise_array.push(GetTagData(`user:${username}`));
        }
        let curr_copyright_count = GetCopyrightCount(current_uploads);
        let prev_copyright_count = GetCopyrightCount(previous_uploads);
        await Promise.all($.map(curr_copyright_count,(val,key)=>{return GetReverseTagImplication(key);}));
        ProcessUploads.copytags = SortDict(curr_copyright_count).filter(value=>{return JSPLib.storage.getSessionData('rti-'+value).value == 0;});
        let copyright_symdiff = CompareCopyrightCounts(curr_copyright_count,prev_copyright_count);
        let copyright_changed = (is_new_tab ? ProcessUploads.copytags : JSPLib.utility.setIntersection(ProcessUploads.copytags,copyright_symdiff));
        let copyright_nochange = (is_new_tab ? [] : JSPLib.utility.setDifference(ProcessUploads.copytags,copyright_changed));
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
    JSPLib.storage.saveData(`previous-uploads-${username}`,current_uploads);
    return current_uploads;
}

function SetTooltipHover() {
    $(".tooltip").hover((e)=>{
        let $tooltip_text = $(".activetooltip",e.target);
        if ($tooltip_text.html() === "") {
            let tooltip_key = $(".activetooltip",e.target).data('key');
            let tooltip_metric = $(".activetooltip",e.target).data('type');
            let tooltip_attribute = $(".activetooltip",e.target).data('attribute');
            console.log("Hover:",tooltip_key,tooltip_metric,tooltip_attribute);
            $tooltip_text.html("Loading!");
            $tooltip_text.html(RenderStatistics(tooltip_key,tooltip_attribute));
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
        if (!PopulateTable.is_started || Danbooru.Cookie.get('cu-hide-current-uploads') === "1") {
            Danbooru.Cookie.put('cu-hide-current-uploads',0);
            $('#count-module').show();
        } else {
            Danbooru.Cookie.put('cu-hide-current-uploads',1);
            $('#count-module').hide();
        }
        PopulateTable();
        e.preventDefault();
    });
}


async function PopulateTable() {
    if (!PopulateTable.is_started) {
        PopulateTable.is_started = true;
        $('#count-table').html(`<div id="empty-uploads">Loading data... (<span id="loading-counter">${num_network_requests}</span>)</div>`);
        let data = await ProcessUploads();
        if (data.length) {
            $('#count-table').html(RenderTable());
            $('#count-controls').html(RenderAllTooltipControls());
            SetTooltipHover();
            SetTooltipChangeClick();
            let tooltip_type = Danbooru.Cookie.get('cu-current-metric') || 'score';
            $(`.select-tooltip[data-type="${tooltip_type}"] a`).click();
        } else {
            $('#count-table').html('<div id="empty-uploads">Feed me more uploads!</div>');
        }
    }
}
PopulateTable.is_started = false;

function main() {
    username = Danbooru.meta("current-user-name");
    use_dummy_value = $('body').data('user-is-gold');
    if (username === "Anonymous") {
        return;
    }
    JSPLib.utility.setCSSStyle(program_css,'program');
    $('header#top').append(notice_box);
    SetCountNoticeClick();
    if (Danbooru.Cookie.get('cu-hide-current-uploads') !== "1") {
        $("#hide-count-notice").click();
    }
    if (JSPLib.debug.debug_console) {
        window.addEventListener('beforeunload',function () {
            JSPLib.statistics.outputAdjustedMean("CurrentUploads");
        });
    }
}

JSPLib.load.programInitialize(main,'CU',program_load_required_variables);
