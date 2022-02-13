// ==UserScript==
// @name         CurrentUploads
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      16.11
// @description  Gives up-to-date stats on uploads.
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @exclude      /^https?://\w+\.donmai\.us/.*\.(xml|json|atom)(\?|$)/
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/currentuploads.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/core-js/3.21.0/minified.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.10.0/localforage.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.13.1/validate.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/canvasjs/1.7.0/canvasjs.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220212/lib/module.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220212/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220212/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220212/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220212/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220212/lib/notice.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220212/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220212/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220212/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220212/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220212/lib/menu.js
// ==/UserScript==

/* global JSPLib $ Danbooru CanvasJS */

/****Global variables****/

//Library constants

////NONE

//Exterior script variables
const DANBOORU_TOPIC_ID = '15169';

//Variables for load.js
const program_load_required_variables = ['window.jQuery','window.Danbooru','Danbooru.CurrentUser'];
const program_load_required_selectors = ["#top","#page-footer"];

//Program name constants
const PROGRAM_SHORTCUT = 'cu';
const PROGRAM_CLICK = 'click.cu';
const PROGRAM_NAME = 'CurrentUploads';

//Program data constants
const PROGRAM_DATA_REGEX = /^rti-|ct(d|w|mo|y|at)-|(daily|weekly|monthly|yearly|alltime|previous)-(uploads|approvals)-/; //Regex that matches the prefix of all program cache data

//Main program variable
const CU = {};

//For factory reset
const LOCALSTORAGE_KEYS = [
    'cu-current-metric',
    'cu-hide-current-uploads',
    'cu-stash-current-uploads'
];
const PROGRAM_RESET_KEYS = {
    checked_usernames: {},
    checked_users: {user:{}, approver: {}},
    user_copytags: {user:{}, approver: {}},
    period_available: {user:{}, approver: {}},
    reverse_implications: {},
};

//Available setting values
const period_selectors = ['daily','weekly','monthly','yearly','alltime'];

//Main settings
const SETTINGS_CONFIG = {
    copyrights_merge: {
        default: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Merge all implied copyrights to their base copyright. Ex: (splatoon_1, splatoon_2) -> splatoon."
    },
    copyrights_enabled: {
        default: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Process and show user copyright uploads."
    },
    periods_shown: {
        allitems: period_selectors,
        default: period_selectors,
        validate: (data) => (JSPLib.menu.validateCheckboxRadio(data,'checkbox',period_selectors) && data.includes('daily')),
        hint: "Select which periods to process and show."
    },
    copyrights_threshold: {
        default: 0,
        parse: parseInt,
        validate: (data) => (Number.isInteger(data) && data >= 0),
        hint: "Maximum number of copyrights to display. Enter 0 to disable this threshold."
    },
    postcount_threshold: {
        default: 0,
        parse: parseInt,
        validate: (data) => (Number.isInteger(data) && data >= 0),
        hint: "Minimum postcount to display copyright. Enter 0 to disable this threshold."
    }
};

//Available config values
const all_source_types = ['indexed_db', 'local_storage'];
const all_data_types = ['count', 'uploads', 'approvals', 'reverse_implication', 'custom'];
const all_periods = ['daily', 'weekly', 'monthly', 'yearly', 'alltime', 'previous'];

const CONTROL_CONFIG = {
    cache_info: {
        value: "Click to populate",
        hint: "Calculates the cache usage of the program and compares it to the total usage.",
    },
    purge_cache: {
        display: `Purge cache (<span id="cu-purge-counter">...</span>)`,
        value: "Click to purge",
        hint: `Dumps all of the cached data related to ${PROGRAM_NAME}.`,
    },
    data_source: {
        allitems: all_source_types,
        value: 'indexed_db',
        hint: "Indexed DB is <b>Cache Data</b> and Local Storage is <b>Program Data</b>.",
    },
    data_type: {
        allitems: all_data_types,
        value: 'count',
        hint: "Select type of data. Use <b>Custom</b> for querying by keyname.",
    },
    data_period: {
        allitems: all_periods,
        value: "",
        hint: "Select the data period. <b>Count</b> cannot use the 'Previous' period.",
    },
    raw_data: {
        value: false,
        hint: "Select to import/export all program data",
    },
    data_name: {
        value: "",
        buttons: ['get', 'save', 'delete', 'list', 'refresh'],
        hint: "Click <b>Get</b> to see the data, <b>Save</b> to edit it, and <b>Delete</b> to remove it.<br><b>List</b> shows keys in their raw format, and <b>Refresh</b> checks the keys again.",
    },
};

const MENU_CONFIG = {
    topic_id: DANBOORU_TOPIC_ID,
    settings: [{
        name: 'general',
    },{
        name: 'display',
    }],
    controls: [],
};

// Default values

const DEFAULT_VALUES = {
    usertag: 'user',
    counttype: 'uploads',
    controls_initialized: false,
    copyright_period: 'd',
};

//CSS Constants

//Style information
const program_css = `
#upload-counts {
    border: var(--footer-border);
    border-style: dotted;
    border-width: 2px;
    max-width: 70em;
    margin-left: 2em;
}
#upload-counts.opened {
    border: var(--form-input-border);
    border-style: dashed;
    border-width: 5px;
}
#upload-counts.stashed {
    display: none;
}
#count-module {
    margin-bottom: 1em;
    display: none;
    border: var(--form-input-border);
}
#upload-counts.opened #count-module {
    display: block;
}
#count-header {
    margin-left: 1em;
}
#count-table {
    white-space: nowrap;
    margin-left: 1em;
}
#count-header th,
#count-table td {
    width: 10em;
    text-align: center;
}
#count-header th:first-of-type,
#count-table td:first-of-type {
    width: 12em;
    text-align: left;
}
#count-table.overflowed {
    max-height: 20em;
    overflow-x: hidden;
    overflow-y: auto;
}
#count-order {
    color: var(--muted-text-color);
    font-style: italic;
    margin-right: 4em;
    font-size: 70%;
    text-align: right;
}
#count-chart {
    height: 400px;
    width: 100%;
    display: none;
}
#count-controls {
    display: none;
    margin-left: 1em;
}
#count-query-user {
    margin: 0.5em;
}
#stash-count-notice {
    color: #F44;
    font-weight: bold;
    font-size: 80%;
}
#stash-count-notice:hover {
    color: #F88;
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
    color: mediumseagreen;
}
#restore-count-notice:hover {
    filter: brightness(1.1);
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
    top: -5px;
}
#count-table.overflowed tr:nth-child(2) .cu-tooltiptext {
    top: -25px;
}
#count-table.overflowed tr:nth-child(3) .cu-tooltiptext {
    top: -40px;
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
.cu-select-tooltip a:hover,
.cu-select-period a:hover{
    filter: brightness(1.5);
}
.cu-select-tooltip.cu-activetooltip a {
    font-weight: bold;
}
.cu-period-header {
    background-color: #CCC;
    border-left: 1px solid #444;
    margin-left: -1px;
}
[data-current-user-theme="dark"] .cu-period-header {
    background-color: #666;
}
#count-header .cu-manual,
#count-header .cu-limited {
    background-color: var(--body-background-color);
}
#count-header .cu-manual:hover,
#count-header .cu-limited:hover {
    color: grey;
}
#count-table .cu-manual,
#count-table .cu-limited {
    background-color: lightcyan;
    border-left: 1px solid #CCC;
}
[data-user-theme="dark"] #count-table .cu-manual,
[data-user-theme="dark"] #count-table .cu-limited {
    background-color: darkcyan;
}
#count-table .cu-uploads {
    background-color: var(--body-background-color);
    padding: 0 5px;
}
#count-table a.with-style:hover {
    filter: brightness(1.5);
}
#count-copyrights {
    margin: 1em;
    display: none;
}
#count-copyrights-header {
    font-size: 1.25em;
    font-weight: bold;
}
[data-user-theme="dark"] #count-copyrights .ui-icon {
    background-image: url(/packs/media/images/ui-icons_ffffff_256x240-bf27228a.png);
}
#count-copyrights-section {
    margin: 0.5em;
    display: none;
}
.cu-select-period a {
    color: grey;
    margin-right: 1em;
}
.cu-select-period.cu-active-period a {
    font-weight: bold;
}
#count-copyrights-list {
    line-height: 150%;
}
#count-copyrights-list .cu-active-copyright a {
    background: #0073ff;
    color: #FFF;
}
#empty-statistics {
    margin: 1em;
    font-weight: bold;
    font-size: 16px;
}
#count-copyrights-manual {
    margin: 1em;
    display: none;
}
#count-module .ui-checkboxradio-label {
    color: black;
    background-color: lightgrey;
}
#count-module .ui-checkboxradio-label:hover {
    filter: brightness(1.1);
}
`;

//HTML constants

const notice_box = `
<div class="ui-corner-all" id="upload-counts">
    <div id="count-module">
        <div id="count-header"></div>
        <div id="count-table"></div>
        <div id="count-order"></div>
        <div id="count-chart"></div>
        <div id="count-controls"></div>
        <div id="count-copyrights">
            <div id="count-copyrights-header">Copyrights<a class="ui-icon ui-icon-triangle-1-e"></a><span id="count-copyrights-counter"></span></div>
            <div id="count-copyrights-section">
                <div id="count-copyrights-controls"></div>
                <div id="count-copyrights-list"></div>
                <div id="count-copyrights-manual">
                    <input id="count_query_copyright" placeholder="Check copyright" type="text">
                    <input id="count_add_copyright" type="submit" value="Add" class="btn">
                </div>
            </div>
        </div>
        <div id="count-query-user">
            <input id="count_query_user_id" placeholder="Check users" type="text">
            <input id="count_submit_user_id" type="submit" value="Submit" class="btn">
            <input id="count_refresh_user_id" type="submit" value="Refresh" class="btn">
            <label for="count_approver_select" style="color:black;background-color:lightgrey">Approvals</label>
            <input id="count_approver_select" class="cu-program-checkbox" type="checkbox">
            <label for="count_override_select" style="color:black;background-color:lightgrey">Override</label>
            <input id="count_override_select" class="cu-program-checkbox" type="checkbox">
        </div>
    </div>
    <div id="upload-counts-toggle">
        <a href="#" id="toggle-count-notice">Toggle Upload Table</a>&nbsp;(<a href="#" id="stash-count-notice">STASH</a>)
    </div>
</div>
`;

const unstash_notice = `<span id="upload-counts-restore"> - <a href="#" id="restore-count-notice">Restore ${PROGRAM_NAME}</a></span>`;

const copyright_counter = '(<span id="loading-counter">...</span>)';

const CACHE_DATA_DETAILS = `
<ul>
    <li><b>Count data (ctd,ctw,ctmo,cty,ctat):</b> Main data shown in the table.</li>
    <li><b>Post data:</b> Used to determine post statistics shown in the tooltips and chart data.
        <ul>
            <li>Key format: <code>(daily|weekly|monthly|yearly|alltime|previous)-(uploads|approvals)-USERNAME</code></li>
            <li>For <i>daily</i>, <i>weekly</i>, <i>monthly</i> and <i>previous</i>, the data represents actual post values.
                <ul>
                    <li>The data has been compressed into an array to save space, but the following is what each index represents:</li>
                    <li>0. Post ID</li>
                    <li>1. Score</li>
                    <li>2. Upscore</li>
                    <li>3. Downscore</li>
                    <li>4. Favcount</li>
                    <li>5. Tagcount</li>
                    <li>6. Gentags</li>
                    <li>7. Copyrights string</li>
                    <li>8. Created timestamp</li>
                </ul>
            </li>
            <li>For <i>yearly</i> and <i>alltime</i>, the data represents the finalized statistics and chart data.
        </ul>
    </li>
    <li><b>Reverse tag implications (rti):</b>The number of tags that a tag implicates. Used to determine the base copyright tag.</li>
</ul>`;

const PROGRAM_DATA_DETAILS = `
<p class="tn">All timestamps are in milliseconds since the epoch (<a href="https://www.epochconverter.com">Epoch converter</a>).</p>
<ul>
    <li>General data
        <ul>
            <li><b>prune-expires:</b> When the program will next check for cache data that has expired.</li>
            <li><b>user-settings:</b> All configurable settings.</li>
        </ul>
    </li>
    <li>Status data
        <ul>
            <li><b>current-metric:</b> Which metric to show upon first opening the table.</li>
            <li><b>hide-current-uploads:</b> Should the table be opened on page load?</li>
            <li><b>stash-current-uploads:</b> Should the table be hidden and the restore link shown? Takes precedence over <code>hide-current-uploads</code>.</li>
        </ul>
    </li>
</ul>`;

//Time periods
const timevalues = ['d','w','mo','y','at'];
const manual_periods = ['w','mo'];
const limited_periods = ['y','at'];
const copyright_periods = ['d','w','mo'];

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
    },
    points: {
        w: 7,
        mo: 30,
        y: 12,
        at: 0
    },
    xlabel: {
        w: "Days ago",
        mo: "Days ago",
        y: "Months ago",
        at: "Months ago"
    },
    divisor: {
        w: JSPLib.utility.one_day,
        mo: JSPLib.utility.one_day,
        y: JSPLib.utility.one_month,
        at: JSPLib.utility.one_month,
    }
};

const longname_key = {
    daily: 'd',
    weekly: 'w',
    monthly: 'mo',
    yearly: 'y',
    alltime: 'at'
};

//Time constants
const prune_expires = JSPLib.utility.one_day;
const noncritical_recheck = JSPLib.utility.one_minute;
const rti_expiration = JSPLib.utility.one_month;
const JQUERY_DELAY = 1; //For jQuery updates that should not be done synchronously

//Network call configuration
const max_post_limit_query = 100;

//Metrics used by statistics functions
const tooltip_metrics = ['score','upscore','downscore','favcount','tagcount','gentags','week','day'];
const chart_metrics = ['score','upscore','downscore','favcount','tagcount','gentags'];

//Feedback messages
const empty_uploads_message_owner = 'Feed me more uploads!';
const empty_uploads_message_other = 'No uploads for this user.';
const empty_approvals_message_other = 'No approvals for this user.';
const empty_uploads_message_anonymous = 'User is Anonymous, so no uploads.';
const copyright_no_uploads = 'No uploads, so no copyrights available for this period.';
const copyright_no_statistics = 'No statistics available for this period (<span style="font-size:80%;color:grey">click the table header</span>).';

//Other constants

const name_field = "name";
const id_field = "id";
const user_fields = "name,level_string";
const post_fields = "id,score,up_score,down_score,fav_count,tag_count,tag_count_general,tag_string_copyright,created_at";

//Validation values

const validation_constraints = {
    countentry: JSPLib.validate.counting_constraints,
    implicationentry: JSPLib.validate.counting_constraints,
    postentries: JSPLib.validate.array_constraints,
    statentries: JSPLib.validate.hash_constraints,
    postentry: [
        JSPLib.validate.integer_constraints, //ID
        JSPLib.validate.integer_constraints, //SCORE
        JSPLib.validate.integer_constraints, //UPSCORE
        JSPLib.validate.integer_constraints, //DOWNSCORE
        JSPLib.validate.integer_constraints, //FAVCOUNT
        JSPLib.validate.integer_constraints, //TAGCOUNT
        JSPLib.validate.integer_constraints, //GENTAGS
        JSPLib.validate.stringonly_constraints, //COPYRIGHTS
        JSPLib.validate.integer_constraints //CREATED
    ],
    postmetric: {
        chart_data: JSPLib.validate.hash_constraints,
        score: JSPLib.validate.hash_constraints,
        upscore: JSPLib.validate.hash_constraints,
        downscore: JSPLib.validate.hash_constraints,
        favcount: JSPLib.validate.hash_constraints,
        tagcount: JSPLib.validate.hash_constraints,
        gentags: JSPLib.validate.hash_constraints,
        week: JSPLib.validate.array_constraints,
        day: JSPLib.validate.array_constraints
    },
    timestat: JSPLib.validate.basic_number_validator,
    poststat: {
        max: JSPLib.validate.integer_constraints,
        average: JSPLib.validate.number_constraints,
        stddev: JSPLib.validate.number_constraints,
        outlier: JSPLib.validate.integer_constraints,
        adjusted: JSPLib.validate.number_constraints
    },
    chartentry: {
        score: JSPLib.validate.array_constraints,
        upscore: JSPLib.validate.array_constraints,
        downscore: JSPLib.validate.array_constraints,
        favcount: JSPLib.validate.array_constraints,
        tagcount: JSPLib.validate.array_constraints,
        gentags: JSPLib.validate.array_constraints,
        uploads: JSPLib.validate.array_constraints
    },
    chartdata: {
        x: JSPLib.validate.integer_constraints,
        y: JSPLib.validate.number_constraints
    }
};

/**FUNCTIONS**/

//Validation functions

function BuildValidator(validation_key) {
    return {
        expires: JSPLib.validate.expires_constraints,
        value: validation_constraints[validation_key]
    };
}

function ValidateEntry(key,entry) {
    if (!JSPLib.validate.validateIsHash(key,entry)) {
        return false;
    }
    if (key.match(/^ct(d|w|mo|y|at)?-/)) {
        return JSPLib.validate.validateHashEntries(key, entry, BuildValidator('countentry'));
    } else if (key.match(/^rti-/)) {
        return JSPLib.validate.validateHashEntries(key, entry, BuildValidator('implicationentry'));
    } else if (key.match(/^(daily|weekly|monthly|previous)-(uploads|approvals)-/)) {
        if (!JSPLib.validate.validateHashEntries(key, entry, BuildValidator('postentries'))) {
            return false;
        }
        return ValidatePostentries(key + '.value', entry.value);
    } else if (key.match(/^(yearly|alltime)-(uploads|approvals)-/)) {
        if (!JSPLib.validate.validateHashEntries(key, entry, BuildValidator('statentries'))) {
            return false;
        }
        return ValidateStatEntries(key + '.value',entry.value);
    }
    this.debug('log',"Bad key!");
    return false;
}

function ValidatePostentries(key,postentries) {
    for (let i = 0;i < postentries.length;i++){
        let value_key = key + `[${i}]`;
        if (!JSPLib.validate.validateIsArray(value_key, postentries[i], {is: validation_constraints.postentry.length})) {
            return false;
        }
        //It's technically not a hash, although it works since arrays can be treated like one
        if (!JSPLib.validate.validateHashEntries(value_key, postentries[i], validation_constraints.postentry)) {
            return false;
        }
    }
    return true;
}

function ValidateStatEntries(key,statentries) {
    if (!JSPLib.validate.validateHashEntries(key, statentries, validation_constraints.postmetric)) {
        return false;
    }
    for (let i = 0; i < tooltip_metrics.length; i++) {
        let metric = tooltip_metrics[i];
        let metric_key = key + '.' + metric;
        if (metric === 'week' || metric === 'day') {
            if (!JSPLib.validate.validateArrayValues(metric_key, statentries[metric], validation_constraints.timestat)) {
                return false;
            }
        } else if (!JSPLib.validate.validateHashEntries(metric_key, statentries[metric], validation_constraints.poststat)) {
            return false;
        }
    }
    return ValidateChartEntries(key + '.chart_data', statentries.chart_data);
}

function ValidateChartEntries(key,chartentries) {
    if (!JSPLib.validate.validateHashEntries(key, chartentries, validation_constraints.chartentry)) {
        return false;
    }
    for (let chart_key in chartentries) {
        for (let i = 0; i < chartentries[chart_key].length; i ++) {
            if (!JSPLib.validate.validateHashEntries(`${key}.${chart_key}[${i}]`, chartentries[chart_key][i], validation_constraints.chartdata)) {
                return false;
            }
        }
    }
    return true;
}

function ValidateProgramData(key,entry) {
    var checkerror = [];
    switch (key) {
        case 'cu-user-settings':
            checkerror = JSPLib.menu.validateUserSettings(entry, SETTINGS_CONFIG);
            break;
        case 'cu-prune-expires':
            if (!Number.isInteger(entry)) {
                checkerror = ["Value is not an integer."];
            }
            break;
        case 'cu-current-metric':
            if (!tooltip_metrics.includes(entry)) {
                checkerror = [`Value not in list: ${tooltip_metrics}`];
            }
            break;
        case 'cu-hide-current-uploads':
        case 'cu-stash-current-uploads':
            if (!JSPLib.validate.isBoolean(entry)) {
                checkerror = ['Value is not a boolean.'];
            }
            break;
        default:
            checkerror = ["Not a valid program data key."];
    }
    if (checkerror.length) {
        JSPLib.validate.outputValidateError(key,checkerror);
        return false;
    }
    return true;
}

//Library functions

////NONE

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

//Render table

function RenderHeader() {
    var tabletext = AddTableHeader('Name');
    let click_periods = manual_periods.concat(limited_periods);
    let times_shown = GetShownPeriodKeys();
    times_shown.forEach((period)=>{
        let header = period_info.header[period];
        if (click_periods.includes(period)) {
            let is_available = CU.period_available[CU.usertag][CU.current_username][period];
            let link_class = (manual_periods.includes(period) ? 'cu-manual' : 'cu-limited');
            let header_class = (!is_available ? 'cu-process' : '');
            let counter_html = (!is_available ? '<span class="cu-display" style="display:none">&nbsp;(<span class="cu-counter">...</span>)</span>' : '');
            tabletext += AddTableHeader(`<a class="${link_class}">${header}</a>${counter_html}`,`class="cu-period-header ${header_class}" data-period="${period}"`);
        } else {
            tabletext += AddTableHeader(header,`class="cu-period-header" data-period="${period}"`);
        }
    });
    return AddTableHead(AddTableRow(tabletext));
}

function RenderBody() {
    if (CU.active_copytags.length > 5) {
        $("#count-table").addClass("overflowed");
    } else {
        $("#count-table").removeClass("overflowed");
    }
    var tabletext = RenderRow('');
    for (let i = 0;i < CU.active_copytags.length; i++) {
        tabletext += RenderRow(CU.active_copytags[i]);
    }
    return AddTableBody(tabletext);
}

function RenderRow(key) {
    var rowtag = (key === ''? `${CU.usertag}:` + CU.display_username : key);
    var rowtext = (key === ''? CU.display_username : key).replace(/_/g,' ');
    rowtext = JSPLib.utility.maxLengthString(rowtext);
    var rowaddon = (key === '' ? `class="user-${CU.level_string.toLowerCase()} with-style"` : 'class="tag-type-3"');
    var tabletext = AddTableData(JSPLib.danbooru.postSearchLink(rowtag, rowtext, rowaddon));
    let times_shown = GetShownPeriodKeys();
    let click_periods = manual_periods.concat(limited_periods);
    for (let i = 0;i < times_shown.length; i++) {
        let period = times_shown[i];
        let data_text = GetTableValue(key,period);
        let is_limited = limited_periods.includes(period);
        let class_name = (!is_limited ? 'cu-hover' : '');
        if (click_periods.includes(period) && key === '') {
            class_name += (manual_periods.includes(period) ? ' cu-manual' : ' cu-limited');
        }
        let rowdata = `class="${class_name}" data-period="${period}"`;
        let is_available = CU.period_available[CU.usertag][CU.current_username][period];
        if (is_available && is_limited && key == '') {
            tabletext += AddTableData(RenderTooltipData(data_text,times_shown[i],true),rowdata);
        } else if (is_available && !is_limited) {
            tabletext += AddTableData(RenderTooltipData(data_text,times_shown[i]),rowdata);
        } else {
            tabletext += AddTableData(`<span class="cu-uploads">${data_text}</span>`,rowdata);
        }
    }
    return AddTableRow(tabletext,`data-key="${key}"`);
}

function RenderOrderMessage(period,sorttype) {
    let header = period_info.header[period];
    switch (sorttype) {
        case 0:
            return `Copyrights ordered by user postcount; ${header} period; H -> L`;
        case 1:
            return `Copyrights ordered by user postcount; ${header} period; L -> H`;
        case 2:
            return `Copyrights ordered by site postcount; ${header} period; H -> L`;
        case 3:
            return `Copyrights ordered by site postcount; ${header} period; L -> H`;
    }
}

//Get the data and validate it without checking the expires
function GetCountData(key,default_val=null) {
    let count_data = JSPLib.storage.getIndexedSessionData(key);
    if (!ValidateEntry(key,count_data)) {
        return default_val;
    }
    return count_data.value;
}

function GetTableValue(key,type) {
    if (key == '') {
        return GetCountData('ct' + type + `-${CU.usertag}:` + CU.current_username,"N/A");
    }
    var useruploads = GetCountData('ct' + type + `-${CU.usertag}:` + CU.current_username + ' ' + key,"N/A");
    var alluploads = GetCountData('ct' + type + '-' + key,"N/A");
    return `(${useruploads}/${alluploads})`;
}

//Render copyrights

function RenderCopyrights(period) {
    let copytags = CU.user_copytags[CU.usertag][CU.current_username][period].sort();
    return copytags.map((copyright)=>{
        let tag_text = JSPLib.utility.maxLengthString(copyright);
        let taglink = JSPLib.danbooru.postSearchLink(copyright, tag_text, 'class="tag-type-3"');
        let active = CU.active_copytags.includes(copyright) ? ' class="cu-active-copyright"' : '';
        return `<span title="${copyright}" data-copyright="${copyright}"${active}>${taglink}</span>`;
    }).join(' ');
}

function RenderCopyrightControls() {
    return copyright_periods.map((period)=>{
        let period_name = period_info.longname[period];
        return `<span class="cu-select-period" data-type="${period}"><a href="#">${JSPLib.utility.titleizeString(period_name)}</a></span>`;
    }).join(' ') + '<span class="cu-select-period" data-type="manual"><a href="#">Manual</a></span>';
}

//Render Tooltips

function RenderTooltipData(text,period,limited=false) {
    let tooltip_html = RenderAllToolPopups(period,limited);
    return `
<div class="cu-tooltip" data-period="${period}"><span class="cu-uploads">${text}</span>${tooltip_html}
</div>
`;
}

function RenderAllToolPopups(period,limited) {
    return tooltip_metrics.map((metric) => RenderToolpopup(metric,period,limited)).join('');
}

function RenderToolpopup(metric,period,limited) {
    let inner_text = (limited ? RenderStatistics('',metric,period,true) : '');
    return `
    <span class="cu-tooltiptext" data-type="${metric}">${inner_text}</span>`;
}

function RenderAllTooltipControls() {
    return tooltip_metrics.map((metric) => RenderToolcontrol(metric)).join('');
}

function RenderToolcontrol(metric) {
    return `
<span class="cu-select-tooltip" data-type="${metric}"><a href="#">${JSPLib.utility.titleizeString(metric)}</a></span>`;
}

function RenderStatistics(key,attribute,period,limited=false) {
    let period_key = GetPeriodKey(period_info.longname[period]);
    let data = JSPLib.storage.getIndexedSessionData(period_key);
    if (!data) {
        return "No data!";
    }
    let stat = data.value;
    if (!limited) {
        let uploads = PostDecompressData(stat);
        if (key !== '') {
            uploads = uploads.filter((val) => val.copyrights.split(' ').includes(key));
        }
        //It's possible with their longer expirations for daily copyrights that don't exist in other periods
        if (uploads.length === 0) {
            return "No data!";
        }
        stat = GetAllStatistics(uploads,attribute);
    } else {
        stat = stat[attribute];
    }
    return RenderAllStats(stat,attribute);
}

function RenderAllStats(stat,attribute) {
    if (attribute === 'week') {
        return RenderWeeklist(stat);
    } else if (attribute === 'day') {
        return RenderDaylist(stat);
    } else {
        return RenderStatlist(stat);
    }
}

function RenderWeeklist(stat) {
    return `
<ul style="font-family:monospace;font-size:12px">
    <li>Sun: ${stat[0]}</li>
    <li>Mon: ${stat[1]}</li>
    <li>Tue: ${stat[2]}</li>
    <li>Wed: ${stat[3]}</li>
    <li>Thu: ${stat[4]}</li>
    <li>Fri: ${stat[5]}</li>
    <li>Sat: ${stat[6]}</li>
</ul>`;
}

function RenderDaylist(stat) {
    return `
<ul style="font-family:monospace;font-size:12px">
    <li>00-04: ${stat[0]}</li>
    <li>04-08: ${stat[1]}</li>
    <li>08-12: ${stat[2]}</li>
    <li>12-16: ${stat[3]}</li>
    <li>16-20: ${stat[4]}</li>
    <li>20-24: ${stat[5]}</li>
</ul>`;
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

function GetAllStatistics(posts,attribute) {
    if (attribute === 'week') {
        return GetWeekStatistics(posts);
    } else if (attribute === 'day') {
        return GetDayStatistics(posts);
    } else {
        return GetPostStatistics(posts,attribute);
    }
}

function GetWeekStatistics(posts) {
    let week_days = new Array(7).fill(0);
    posts.forEach((upload)=>{
        let timeindex = new Date(upload.created).getUTCDay();
        week_days[timeindex] += 1;
    });
    let week_stats = week_days.map((day)=>{
        let percent = (100 * day / posts.length);
        return (percent === 0 || percent === 100 ? percent : JSPLib.utility.setPrecision(percent,1));
    });
    return week_stats;
}

function GetDayStatistics(posts) {
    let day_hours = new Array(6).fill(0);
    posts.forEach((upload)=>{
        let timeindex = Math.floor(new Date(upload.created).getUTCHours() / 4);
        day_hours[timeindex] += 1;
    });
    let day_stats = day_hours.map((day)=>{
        let percent = (100 * day / posts.length);
        return (percent === 0 || percent === 100 ? percent : JSPLib.utility.setPrecision(percent,1));
    });
    return day_stats;
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

function AssignPostIndexes(period,posts,time_offset) {
    let points = period_info.points[period];
    //Have to do it this way to avoid getting the same object
    let periods = JSPLib.utility.arrayFill(points, "[]");
    posts.forEach((post)=>{
        let index = Math.floor((Date.now() - post.created - time_offset)/(period_info.divisor[period]));
        index = (points ? Math.min(points-1,index) : index);
        index = Math.max(0,index);
        if (index >= periods.length) {
            periods = periods.concat(JSPLib.utility.arrayFill(index + 1 - periods.length, "[]"));
        }
        periods[index].push(post);
    });
    return periods;
}

function GetPeriodAverages(indexed_posts,metric) {
    let period_averages = [];
    for (let index in indexed_posts) {
        if (!indexed_posts[index].length) continue;
        let data_point = {
            x: parseInt(index),
            y: JSPLib.utility.setPrecision(JSPLib.statistics.average(JSPLib.utility.getObjectAttributes(indexed_posts[index],metric)),2)
        };
        period_averages.push(data_point);
    }
    return period_averages;
}

function GetPeriodPosts(indexed_posts) {
    let period_uploads = [];
    for (let index in indexed_posts) {
        if (!indexed_posts[index].length) continue;
        let data_point = {
            x: parseInt(index),
            y: indexed_posts[index].length
        };
        period_uploads.push(data_point);
    }
    return period_uploads;
}

//Helper functions

//Returns a sorted key array from highest to lowest using the length of the array in each value
function SortDict(dict) {
    var items = Object.keys(dict).map((key) => [key, dict[key].length]);
    items.sort((first, second)=>{
        if (first[1] !== second[1]) {
            return second[1] - first[1];
        } else {
            return first[0].localeCompare(second[0]);
        }
    });
    return items.map((entry) => entry[0]);
}

function BuildTagParams(type,tag) {
    return (type === 'at' ? '' : ('age:..1' + type + ' ')) + tag;
}

function GetCopyrightCount(posts) {
    let copyright_count = {};
    posts.forEach((post)=>{
        post.copyrights.split(' ').forEach((tag)=>{
            copyright_count[tag] = copyright_count[tag] || [];
            copyright_count[tag] = copyright_count[tag].concat([post.id]);
        });
    });
    if (CU.user_settings.postcount_threshold) {
        for (let copyright in copyright_count) {
            if (copyright_count[copyright].length < CU.user_settings.postcount_threshold) {
                delete copyright_count[copyright];
            }
        }
    }
    return copyright_count;
}

function CompareCopyrightCounts(dict1,dict2) {
    let difference = [];
    JSPLib.utility.arrayUnion(Object.keys(dict1), Object.keys(dict2)).forEach((key)=>{
        if (!JSPLib.utility.arrayEquals(dict1[key], dict2[key])) {
            difference.push(key);
        }
    });
    return difference;
}

function CheckCopyrightVelocity(tag) {
    var dayuploads = JSPLib.storage.getIndexedSessionData('ctd-' + tag);
    var weekuploads = JSPLib.storage.getIndexedSessionData('ctw-' + tag);
    if (dayuploads === null || weekuploads === null) {
        return true;
    }
    var day_gettime = dayuploads.expires - period_info.countexpires.d; //Time data was originally retrieved
    var week_velocity = (JSPLib.utility.one_week) / (weekuploads.value | 1); //Milliseconds per upload
    var adjusted_poll_interval = Math.min(week_velocity, JSPLib.utility.one_day); //Max wait time is 1 day
    return Date.now() > day_gettime + adjusted_poll_interval;
}

async function MergeCopyrightTags(user_copytags) {
    let query_implications = JSPLib.utility.arrayDifference(user_copytags,Object.keys(CU.reverse_implications));
    let promise_array = query_implications.map((key) => GetReverseTagImplication(key));
    let reverse_implications = await Promise.all(promise_array);
    query_implications.forEach((key,i)=>{
        CU.reverse_implications[key] = reverse_implications[i];
    });
    return user_copytags.filter((value) => (CU.reverse_implications[value] === 0));
}

function IsMissingTag(tag) {
    return GetShownPeriodKeys().reduce((total,period) => (total || !GetCountData(`ct${period}-${tag}`)), false);
}

function MapPostData(posts) {
    return posts.map((entry) => (
        {
            id: entry.id,
            score: entry.score,
            upscore: entry.up_score,
            downscore: -entry.down_score,
            favcount: entry.fav_count,
            tagcount: entry.tag_count,
            gentags: entry.tag_count_general,
            copyrights: entry.tag_string_copyright,
            created: new Date(entry.created_at).getTime()
        }
    ));
}

function PreCompressData(posts) {
    return posts.map((entry) => [entry.id, entry.score, entry.upscore, entry.downscore, entry.favcount, entry.tagcount, entry.gentags, entry.copyrights, entry.created]);
}

function PostDecompressData(posts) {
    return posts.map((entry) => (
        {
            id: entry[0],
            score: entry[1],
            upscore: entry[2],
            downscore: entry[3],
            favcount: entry[4],
            tagcount: entry[5],
            gentags: entry[6],
            copyrights: entry[7],
            created: entry[8]
        }
    ));
}

function GetTagData(tag) {
    return Promise.all(CU.user_settings.periods_shown.map((period) => GetCount(longname_key[period],tag)));
}

function GetPeriodKey(period_name) {
    return `${period_name}-${CU.counttype}-${CU.current_username}`;
}

async function CheckPeriodUploads() {
    let promise_array = [];
    const checkPeriod = (key,period,check)=>{
        CU.period_available[CU.usertag][CU.current_username][period] = Boolean(check);
        if (!check) {
            JSPLib.storage.removeIndexedSessionData(key);
        }
    };
    CU.period_available[CU.usertag][CU.current_username] = CU.period_available[CU.usertag][CU.current_username] || {};
    let times_shown = GetShownPeriodKeys();
    for (let i = 0; i < times_shown.length; i++) {
        let period = times_shown[i];
        if (period in CU.period_available[CU.usertag][CU.current_username]) {
            continue;
        }
        let data_key = GetPeriodKey(period_info.longname[period]);
        let max_expires = period_info.uploadexpires[period];
        let check_promise = JSPLib.storage.checkLocalDB(data_key,ValidateEntry,max_expires).then((check)=>{checkPeriod(data_key,period,check);});
        promise_array.push(check_promise);
    }
    return Promise.all(promise_array);
}

async function PopulateTable() {
    //Prevent function from being reentrant while processing uploads
    PopulateTable.is_started = true;
    var post_data = [];
    InitializeControls();
    if (CU.checked_users[CU.usertag][CU.current_username] === undefined) {
        TableMessage(`<div id="empty-uploads">Loading data... (<span id="loading-counter">...</span>)</div>`);
        post_data = await ProcessUploads(CU.current_username);
        CU.checked_users[CU.usertag][CU.current_username] = post_data.length;
    }
    let is_override = $("#count_override_select")[0].checked;
    if (is_override || CU.checked_users[CU.usertag][CU.current_username]) {
        CU.active_copytags = JSPLib.utility.dataCopy(CU.user_copytags[CU.usertag][CU.current_username].daily);
        await CheckPeriodUploads(CU.current_username);
        InitializeTable();
    } else {
        TableMessage(`<div id="empty-uploads">${CU.empty_uploads_message}</div>`);
    }
    PopulateTable.is_started = false;
}

function InitializeControls() {
    //Render the controls only once when the table is first opened
    if (!CU.controls_initialized) {
        $('.cu-program-checkbox').checkboxradio();
        $("#count-controls").html(RenderAllTooltipControls());
        $("#count-copyrights-controls").html(RenderCopyrightControls());
        $(".cu-select-tooltip").on(PROGRAM_CLICK,TooltipChange);
        $(".cu-select-period a").on(PROGRAM_CLICK,CopyrightPeriod);
        $("#count-copyrights-header a").on(PROGRAM_CLICK,ToggleCopyrightsSection);
        $("#count_submit_user_id").on(PROGRAM_CLICK,CheckUser);
        $("#count_refresh_user_id").on(PROGRAM_CLICK,RefreshUser);
        $("#count_add_copyright").on(PROGRAM_CLICK,AddCopyright);
        CU.controls_initialized = true;
        setTimeout(()=>{CU.IAC.InitializeAutocompleteIndexed && CU.IAC.InitializeAutocompleteIndexed("#count_query_user_id",'us');}, 1000);
    }
}

function InitializeTable() {
    $("#count-header").html(AddTable(RenderHeader(),'class="striped"'));
    $("#count-table").html(AddTable(RenderBody(),'class="striped"'));
    $("#count-order").html(RenderOrderMessage("d",0));
    $("#count-header .cu-process").on(PROGRAM_CLICK,GetPeriod);
    $("#count-header th").on(PROGRAM_CLICK,SortTable);
    $("#count-table .cu-manual,#count-table .cu-limited").on(PROGRAM_CLICK, RenderChart);
    $("#count-controls,#count-copyrights,#count-header").show();
    $(`.cu-select-tooltip[data-type="${CU.current_metric}"] a`).click();
    CU.sorttype = 0;
    CU.sortperiod = "d";
    CU.copyright_period && $(`.cu-select-period[data-type="${CU.copyright_period}"] a`).click();
    CU.shown_copytags = JSPLib.utility.dataCopy(CU.active_copytags);
}

function TableMessage(message) {
    $("#count-table").html(message);
    $("#count-controls,#count-copyrights,#count-header,#count-chart").hide();
}

//Network functions

async function GetReverseTagImplication(tag) {
    var key = 'rti-' + tag;
    var check = await JSPLib.storage.checkLocalDB(key,ValidateEntry,rti_expiration);
    if (!(check)) {
        this.debug('log',"Network:",key);
        let data = await JSPLib.danbooru.submitRequest('tag_implications', {search: {antecedent_name: tag}, only: id_field}, [], false, key);
        JSPLib.storage.saveData(key, {value: data.length, expires: JSPLib.utility.getExpires(rti_expiration)});
        return data.length;
    }
    return check.value;
}

async function GetCount(type,tag) {
    let max_expires = period_info.countexpires[type];
    var key = 'ct' + type + '-' + tag;
    var check = await JSPLib.storage.checkLocalDB(key,ValidateEntry,max_expires);
    if (!(check)) {
        this.debug('log',"Network:",key);
        return JSPLib.danbooru.submitRequest('counts/posts',{tags: BuildTagParams(type,tag), skip_cache: true},{counts: {posts: 0}},false,key)
        .then(data=>{
            JSPLib.storage.saveData(key, {value: data.counts.posts, expires: JSPLib.utility.getExpires(max_expires)});
        });
    }
}

async function GetPeriodUploads(username,period,limited=false,domname=null) {
    let period_name = period_info.longname[period];
    let max_expires = period_info.uploadexpires[period];
    let key = GetPeriodKey(period_name);
    var check = await JSPLib.storage.checkLocalDB(key,ValidateEntry,max_expires);
    if (!(check)) {
        this.debug('log',`Network (${period_name} ${CU.counttype})`);
        let data = await JSPLib.danbooru.getPostsCountdown(BuildTagParams(period,`${CU.usertag}:${username}`),max_post_limit_query,post_fields,domname);
        let mapped_data = MapPostData(data);
        if (limited) {
            let indexed_posts = AssignPostIndexes(period,mapped_data,0);
            mapped_data = Object.assign(...tooltip_metrics.map((metric) => ({[metric]: GetAllStatistics(mapped_data,metric)})));
            mapped_data.chart_data = Object.assign(...chart_metrics.map((metric) => ({[metric]: GetPeriodAverages(indexed_posts,metric)})));
            mapped_data.chart_data.uploads = GetPeriodPosts(indexed_posts);
            JSPLib.storage.saveData(key, {value: mapped_data, expires: JSPLib.utility.getExpires(max_expires)});
        } else {
            JSPLib.storage.saveData(key, {value: PreCompressData(mapped_data), expires: JSPLib.utility.getExpires(max_expires)});
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

async function GetPeriod(event) {
    let header = event.target.parentElement;
    let is_limited = $(event.target).hasClass("cu-limited");
    let period = header.dataset.period;
    $(`#count-header th[data-period=${period}] .cu-display`).show();
    await GetPeriodUploads(CU.current_username,period,is_limited,`#count-header th[data-period=${period}] .cu-counter`);
    CU.period_available[CU.usertag][CU.current_username][period] = true;
    let column = header.cellIndex;
    let $cells = $(`#count-table td:nth-of-type(${column + 1})`);
    if (is_limited) {
        let value = $(".cu-uploads",$cells[0]).html();
        $($cells[0]).html(RenderTooltipData(value,period,true));
    } else {
        $cells.each((i,cell)=>{
            let value = $(".cu-uploads",cell).html();
            $(cell).html(RenderTooltipData(value,period));
        });
        $(`.cu-select-tooltip[data-type="${CU.current_metric}"] a`).click();
    }
    $(`#count-header th[data-period=${period}] .cu-display`).hide();
    $(`.cu-select-tooltip[data-type="${CU.current_metric}"] a`).click();
    $(event.target).off(PROGRAM_CLICK);
}

function SortTable(event) {
    if (event.target.tagName !== "TH") {
        return;
    }
    let column = event.target.cellIndex + 1;
    let period = $(`#count-header th:nth-of-type(${column})`).data('period');
    if (CU.sortperiod !== period) {
        CU.sorttype = 3;
        CU.sortperiod = period;
    }
    let rows = [];
    $("#count-table tr").each((i,row)=>{
        if (i === 0) {
            return;
        }
        let data = $(`td:nth-of-type(${column}) .cu-uploads`,row).html();
        let posts = data.match(/\((\d+)\/(\d+)\)/).slice(1,3).map(Number);
        rows.push({
            domobj: $(row).detach(),
            posts: posts
        });
    });
    rows.sort((a,b)=>{
        switch (CU.sorttype) {
            case 0:
                return a.posts[0] - b.posts[0];
            case 1:
                return b.posts[1] - a.posts[1];
            case 2:
                return a.posts[1] - b.posts[1];
            case 3:
                return b.posts[0] - a.posts[0];
        }
    }).forEach((row)=>{
        $("#count-table tbody").append(row.domobj);
    });
    CU.sorttype = (CU.sorttype + 1) % 4;
    $("#count-order").html(RenderOrderMessage(period,CU.sorttype));
}

function RenderChart(event) {
    if (event.target.tagName !== "TD") {
        return;
    }
    if (!chart_metrics.includes(CU.current_metric)) {
        JSPLib.notice.notice("Chart data not available on Day and Week metrics.");
        return;
    }
    let period = $(event.target).data('period');
    let is_limited = $(event.target).hasClass("cu-limited");
    let longname = period_info.longname[period];
    let points = period_info.points[period];
    let period_key = GetPeriodKey(longname);
    let data = JSPLib.storage.getIndexedSessionData(period_key);
    if (!data || (!is_limited && data.value.length === 0) || (is_limited && !data.value.chart_data)) {
        JSPLib.notice.notice(`${period_info.header[period]} period not populated! Click the period header to activate the chart.`);
        return;
    }
    if (!is_limited) {
        let time_offset = Date.now() - (data.expires - period_info.uploadexpires[period]);
        let posts = PostDecompressData(data.value);
        let indexed_posts = AssignPostIndexes(period,posts,time_offset);
        var period_averages = GetPeriodAverages(indexed_posts,CU.current_metric);
        var period_uploads = GetPeriodPosts(indexed_posts);
    } else {
        period_averages = data.value.chart_data[CU.current_metric];
        period_uploads = data.value.chart_data.uploads;
    }
    let metric_display = JSPLib.utility.displayCase(CU.current_metric);
    let type_display = JSPLib.utility.displayCase(CU.counttype);
    let chart_data = {
        title:{
            text: `${JSPLib.utility.displayCase(longname)} ${CU.counttype} - Average post ${CU.current_metric}`
        },
        axisX: {
            title: period_info.xlabel[period],
            minimum: 0,
            maximum: (points ? points - 1 : period_uploads.slice(-1)[0].x)
        },
        axisY: {
            title: `${metric_display}`
        },
        axisY2:{
            title: `${type_display}`,
        },
        legend: {
            horizontalAlign: "right",
            verticalAlign: "bottom",
        },
        data: [{
            showInLegend: true,
            legendText: `${metric_display}`,
            type: "spline",
            dataPoints: period_averages
        },
        {
            showInLegend: true,
            legendText: `${type_display}`,
            type: "line",
            axisYType: "secondary",
            dataPoints: period_uploads
        }]
    };
    //This needs to be shown now so that the chart function renders to the right size
    $("#count-chart").show();
    var chart = new CanvasJS.Chart("count-chart",chart_data);
    chart.render();
    $(".canvasjs-chart-credit").css('top',"400px");
}

function TooltipChange(event) {
    CU.current_metric = $(event.target.parentElement).data('type');
    $(".cu-select-tooltip,.cu-tooltiptext").removeClass("cu-activetooltip");
    $(`.cu-select-tooltip[data-type="${CU.current_metric}"]`).addClass("cu-activetooltip");
    $(`.cu-tooltiptext[data-type="${CU.current_metric}"]`).addClass("cu-activetooltip");
    JSPLib.storage.setStorageData('cu-current-metric',CU.current_metric,localStorage);
    $(".cu-hover .cu-uploads").off('mouseover.cu').on('mouseover.cu', TooltipHover);
    event.preventDefault();
}

function ToggleCopyrightsSection(event) {
    $(event.target).toggleClass("ui-icon-triangle-1-e ui-icon-triangle-1-s");
    $('#count-copyrights-section').slideToggle(100);
}

function ToggleCopyrightTag(event) {
    let $container = $(event.target.parentElement);
    $container.toggleClass("cu-active-copyright");
    let copyright = $container.data('copyright');
    if ($container.hasClass("cu-active-copyright")) {
        CU.active_copytags.push(copyright);
    } else {
        CU.active_copytags.splice(CU.active_copytags.indexOf(copyright),1);
    }
    event.preventDefault();
}

async function CopyrightPeriod(event) {
    let $container = $(event.target.parentElement);
    let short_period = CU.copyright_period = $container.data('type');
    $(".cu-select-period").removeClass("cu-active-period");
    $container.addClass("cu-active-period");
    if (short_period === 'manual') {
        $("#count-copyrights-manual").show();
        $('#count-copyrights-list').html(RenderCopyrights('manual'));
        $("#count-copyrights-list a").off(PROGRAM_CLICK).on(PROGRAM_CLICK,ToggleCopyrightTag);
    } else {
        $("#count-copyrights-manual").hide();
        let current_period = period_info.longname[short_period];
        let is_period_enabled = CU.period_available[CU.usertag][CU.current_username][short_period];
        if (is_period_enabled) {
            if (CU.user_copytags[CU.usertag][CU.current_username][current_period] === undefined) {
                let period_key = GetPeriodKey(current_period);
                let data = JSPLib.storage.getIndexedSessionData(period_key);
                let copyright_count = GetCopyrightCount(PostDecompressData(data.value));
                let user_copytags = SortDict(copyright_count);
                if (CU.user_settings.copyrights_merge) {
                    $("#count-copyrights-counter").html(copyright_counter);
                    user_copytags = await MergeCopyrightTags(user_copytags);
                    $("#count-copyrights-counter").html('');
                }
                CU.user_copytags[CU.usertag][CU.current_username][current_period] = user_copytags;
            }
            if (CU.user_copytags[CU.usertag][CU.current_username][current_period].length === 0) {
                $('#count-copyrights-list').html(`<div id="empty-statistics">${copyright_no_uploads}</div>`);
            } else {
                $('#count-copyrights-list').html(RenderCopyrights(current_period));
                $("#count-copyrights-list a").off(PROGRAM_CLICK).on(PROGRAM_CLICK,ToggleCopyrightTag);
            }
        } else {
            $('#count-copyrights-list').html(`<div id="empty-statistics">${copyright_no_statistics}</div>`);
        }
    }
    event.preventDefault();
}

function ToggleNotice(event) {
    if (CU.hidden === true) {
        CU.hidden = false;
        $('#upload-counts').addClass('opened');
        if (!PopulateTable.is_started) {
            //Always show current user on open to prevent processing potentially bad usernames set by CheckUser
            CU.empty_uploads_message = (CU.username === "Anonymous" ? empty_uploads_message_anonymous : empty_uploads_message_owner);
            CU.display_username = CU.username;
            CU.current_username = CU.username.toLowerCase();
            CU.level_string = (CU.username === "Anonymous" ? 'Member' : Danbooru.CurrentUser.data('level-string'));
            CU.usertag = 'user';
            PopulateTable();
        }
        CU.channel.postMessage({type: "show"});
    } else {
        CU.hidden = true;
        $('#upload-counts').removeClass('opened');
        $('.cu-program-checkbox').prop('checked', false);
        CU.controls_initialized && $('.cu-program-checkbox').checkboxradio("refresh");
        $("#count-chart").hide();
        CU.channel.postMessage({type: "hide"});
    }
    JSPLib.storage.setStorageData('cu-hide-current-uploads', CU.hidden,localStorage);
    event.preventDefault();
}

function StashNotice(event) {
    if (CU.stashed === true) {
        CU.stashed = false;
        $('#upload-counts,#upload-counts-restore').removeClass('stashed');
        CU.channel.postMessage({type: "unstash"});
    } else {
        CU.stashed = true;
        CU.hidden = true;
        $('#upload-counts,#upload-counts-restore').removeClass('opened').addClass('stashed');
        $('.cu-program-checkbox').prop('checked', false);
        CU.controls_initialized && $('.cu-program-checkbox').checkboxradio("refresh");
        $("#count-chart").hide();
        CU.channel.postMessage({type: "stash"});
    }
    JSPLib.storage.setStorageData('cu-stash-current-uploads',CU.stashed,localStorage);
    JSPLib.storage.setStorageData('cu-hide-current-uploads',CU.hidden,localStorage);
    event.preventDefault();
}

async function RefreshUser() {
    $("#count-copyrights-counter").html(copyright_counter);
    let diff_tags = JSPLib.utility.arrayDifference(CU.active_copytags,CU.shown_copytags);
    let promise_array = [];
    diff_tags.forEach((val)=>{
        promise_array.push(GetTagData(`${CU.usertag}:${CU.current_username} ${val}`));
        promise_array.push(GetTagData(val));
    });
    await Promise.all(promise_array);
    $("#count-copyrights-counter").html('');
    InitializeTable();
}

async function CheckUser() {
    //Don't change the username while currently processing
    if (!PopulateTable.is_started) {
        $("#count-chart").hide();
        let check_user;
        let check_username = $("#count_query_user_id").val().toLowerCase();
        if (check_username === "") {
            check_user = [];
        } else if (check_username in CU.checked_usernames) {
            check_user = CU.checked_usernames[check_username];
        } else {
            //Check each time no matter what as misses can be catastrophic
            check_user = await JSPLib.danbooru.submitRequest('users', {search: {name_matches: check_username}, only: user_fields, expiry: 30});
            CU.checked_usernames[check_username] = check_user;
        }
        if (check_user.length) {
            CU.display_username = check_user[0].name;
            CU.current_username = check_user[0].name.toLowerCase();
            CU.level_string = check_user[0].level_string;
            let is_approvals = $("#count_approver_select")[0].checked;
            CU.empty_uploads_message = is_approvals ? empty_approvals_message_other : empty_uploads_message_other;
            CU.usertag = is_approvals ? 'approver' : 'user';
            CU.counttype = is_approvals ? 'approvals' : 'uploads';
            PopulateTable();
        } else {
            TableMessage(`<div id="empty-uploads">User doesn't exist!</div>`);
        }
    }
}

async function AddCopyright() {
    let user_copytags = CU.user_copytags[CU.usertag][CU.current_username];
    let tag = $("#count_query_copyright").val();
    let tagdata = await JSPLib.danbooru.submitRequest('tags', {search: {name: tag}, only: name_field},[]);
    if (tagdata.length === 0) {
        JSPLib.notice.notice('Tag not valid');
        return;
    }
    tag = tagdata[0].name;
    user_copytags.manual.push(tag);
    user_copytags.manual = JSPLib.utility.arrayUnique(user_copytags.manual);
    CU.active_copytags.push(tag);
    CU.active_copytags = JSPLib.utility.arrayUnique(CU.active_copytags);
    $('#count-copyrights-list').html(RenderCopyrights('manual'));
    $("#count-copyrights-list a").off(PROGRAM_CLICK).on(PROGRAM_CLICK,ToggleCopyrightTag);
}

function TooltipHover(event) {
    let container = event.target.parentElement;
    let $tooltip_text = $(".cu-activetooltip",container);
    let tooltip_key = $(container.parentElement.parentElement).data('key');
    let tooltip_period = $(container).data('period');
    let tooltip_metric = $(".cu-activetooltip",container).data('type');
    $tooltip_text.html("Loading!");
    $tooltip_text.html(RenderStatistics(tooltip_key,tooltip_metric,tooltip_period));
    $(event.target).off();
}

//Main execution functions

async function ProcessUploads() {
    var promise_array = [];
    var current_uploads = [];
    var user_copytags = [];
    if (CU.current_username !== "Anonymous") {
        current_uploads = await GetPeriodUploads(CU.current_username,'d');
    }
    let previous_key = GetPeriodKey("previous");
    if (current_uploads.length) {
        let is_new_tab = JSPLib.storage.getIndexedSessionData(previous_key) === null;
        let previous_uploads = await JSPLib.storage.checkLocalDB(previous_key,ValidateEntry) || {value: []};
        previous_uploads = PostDecompressData(previous_uploads.value);
        let current_ids = JSPLib.utility.getObjectAttributes(current_uploads,'id');
        let previous_ids = JSPLib.utility.getObjectAttributes(previous_uploads,'id');
        if (is_new_tab || !JSPLib.utility.arrayEquals(current_ids, previous_ids) || IsMissingTag(`${CU.usertag}:${CU.current_username}`)) {
            promise_array.push(GetTagData(`${CU.usertag}:${CU.current_username}`));
        }
        if (CU.is_gold_user && CU.user_settings.copyrights_enabled) {
            let curr_copyright_count = GetCopyrightCount(current_uploads);
            let prev_copyright_count = GetCopyrightCount(previous_uploads);
            user_copytags = SortDict(curr_copyright_count);
            if (CU.user_settings.copyrights_merge) {
                user_copytags = await MergeCopyrightTags(user_copytags);
            }
            if (CU.user_settings.copyrights_threshold) {
                user_copytags = user_copytags.slice(0,CU.user_settings.copyrights_threshold);
            }
            let copyright_symdiff = CompareCopyrightCounts(curr_copyright_count,prev_copyright_count);
            let copyright_changed = (is_new_tab ? user_copytags : JSPLib.utility.arrayIntersection(user_copytags,copyright_symdiff));
            let copyright_nochange = (is_new_tab ? [] : JSPLib.utility.arrayDifference(user_copytags,copyright_changed));
            copyright_nochange.forEach((val)=>{
                if (CheckCopyrightVelocity(val) || IsMissingTag(val)) {
                    promise_array.push(GetTagData(val));
                }
                if (IsMissingTag(`${CU.usertag}:${CU.current_username} ${val}`)) {
                    promise_array.push(GetTagData(`${CU.usertag}:${CU.current_username} ${val}`));
                }
            });
            copyright_changed.forEach((val)=>{
                promise_array.push(GetTagData(`${CU.usertag}:${CU.current_username} ${val}`));
                promise_array.push(GetTagData(val));
            });
        }
        await Promise.all(promise_array);
    } else if (IsMissingTag(`${CU.usertag}:${CU.current_username}`)) {
        await GetTagData(`${CU.usertag}:${CU.current_username}`);
    }
    CU.user_copytags[CU.usertag][CU.current_username] = {daily: user_copytags, manual: []};
    JSPLib.storage.saveData(previous_key,{value: PreCompressData(current_uploads), expires: 0});
    return current_uploads;
}

//Cache functions

function OptionCacheDataKey(data_type,data_value) {
    CU.data_period = $("#cu-control-data-period").val();
    if (data_type === "reverse_implication") {
        return 'rti-' + data_value;
    }
    if (data_type === "count") {
        if (CU.data_period == "previous") {
            CU.data_value = "";
            return "";
        }
        let shortkey = (CU.data_period !== "" ? longname_key[CU.data_period] : "");
        return `ct${shortkey}-${data_value}`;
    } else {
        return `${CU.data_period}-${data_type}-${data_value}`;
    }
}

//Settings functions

function BroadcastCU(ev) {
    this.debug('log',`(${ev.data.type}):`,ev.data);
    switch (ev.data.type) {
        case "hide":
            CU.hidden = true;
            $('#upload-counts').removeClass('opened');
            break;
        case "show":
            CU.hidden = false;
            $('#upload-counts').addClass('opened');
            break;
        case "stash":
            CU.stashed = true;
            CU.hidden = true;
            $('#upload-counts,#upload-counts-restore').removeClass('opened').addClass('stashed');
            break;
        case "unstash":
            CU.stashed = false;
            $('#upload-counts,#upload-counts-restore').removeClass('stashed');
            //falls through
        default:
            //do nothing
    }
}

function RemoteResetCallback() {
    if (!CU.hidden && !CU.stashed) {
        CU.hidden = true;
        $('#upload-counts').removeClass('opened');
    }
}

function GetShownPeriodKeys() {
    return timevalues.filter((period_key) => CU.user_settings.periods_shown.includes(period_info.longname[period_key]));
}

function DataTypeChange() {
    let data_type = $('#cu-control-data-type').val();
    let action = (['count', 'uploads', 'approvals'].includes(data_type) ? 'show' : 'hide');
    $('.cu-options[data-setting="data_period"]')[action]();
}

function RenderSettingsMenu() {
    $("#current-uploads").append(JSPLib.menu.renderMenuFramework(MENU_CONFIG));
    $("#cu-general-settings").append(JSPLib.menu.renderDomainSelectors());
    $("#cu-display-settings").append(JSPLib.menu.renderCheckbox('copyrights_merge'));
    $("#cu-display-settings").append(JSPLib.menu.renderCheckbox('copyrights_enabled'));
    $("#cu-display-settings").append(JSPLib.menu.renderTextinput('copyrights_threshold', 10));
    $("#cu-display-settings").append(JSPLib.menu.renderTextinput('postcount_threshold', 10));
    $("#cu-display-settings").append(JSPLib.menu.renderInputSelectors('periods_shown', 'checkbox'));
    $('#cu-controls').append(JSPLib.menu.renderCacheControls());
    $('#cu-cache-controls-message').append(JSPLib.menu.renderExpandable("Cache Data details", CACHE_DATA_DETAILS));
    $("#cu-cache-controls").append(JSPLib.menu.renderLinkclick('cache_info', true));
    $('#cu-cache-controls').append(JSPLib.menu.renderCacheInfoTable());
    $("#cu-cache-controls").append(JSPLib.menu.renderLinkclick('purge_cache', true));
    $('#cu-controls').append(JSPLib.menu.renderCacheEditor(true));
    $('#cu-cache-editor-message').append(JSPLib.menu.renderExpandable("Program Data details", PROGRAM_DATA_DETAILS));
    $("#cu-cache-editor-controls").append(JSPLib.menu.renderKeyselect('data_source', true));
    $("#cu-cache-editor-controls").append(JSPLib.menu.renderDataSourceSections());
    $("#cu-section-indexed-db").append(JSPLib.menu.renderKeyselect('data_type', true));
    $("#cu-section-indexed-db").append(JSPLib.menu.renderKeyselect('data_period', true));
    $("#cu-section-local-storage").append(JSPLib.menu.renderCheckbox('raw_data', true));
    $("#cu-cache-editor-controls").append(JSPLib.menu.renderTextinput('data_name', 20, true));
    JSPLib.menu.engageUI(true);
    $("#cu-select-periods-shown-daily").checkboxradio("disable"); //Daily period is mandatory
    JSPLib.menu.saveUserSettingsClick();
    JSPLib.menu.resetUserSettingsClick(LOCALSTORAGE_KEYS, RemoteResetCallback);
    JSPLib.menu.cacheInfoClick();
    JSPLib.menu.purgeCacheClick();
    JSPLib.menu.expandableClick();
    JSPLib.menu.dataSourceChange();
    $("#cu-control-data-type").on('change.cu', DataTypeChange);
    JSPLib.menu.rawDataChange();
    JSPLib.menu.getCacheClick(ValidateProgramData);
    JSPLib.menu.saveCacheClick(ValidateProgramData, ValidateEntry);
    JSPLib.menu.deleteCacheClick();
    JSPLib.menu.listCacheClick();
    JSPLib.menu.refreshCacheClick();
    JSPLib.menu.cacheAutocomplete();
}

//Main program

function Main() {
    Object.assign(CU, {
        username: Danbooru.CurrentUser.data('name'),
        is_gold_user: Danbooru.CurrentUser.data('is-gold'),
        channel: JSPLib.utility.createBroadcastChannel(PROGRAM_NAME, BroadcastCU),
        user_settings: JSPLib.menu.loadUserSettings(),
    }, DEFAULT_VALUES, PROGRAM_RESET_KEYS);
    if (JSPLib.danbooru.isSettingMenu()) {
        JSPLib.menu.initializeSettingsMenu(RenderSettingsMenu);
    }
    if (!JSPLib.menu.isScriptEnabled()) {
        this.debug('log',"Script is disabled on", window.location.hostname);
        return;
    }
    Object.assign(CU, {
        get IAC() {return JSPLib.load.getExport('IndexedAutocomplete') || Danbooru.IAC || {};},
        current_metric: JSPLib.storage.checkStorageData('cu-current-metric',ValidateProgramData,localStorage,'score'),
        hidden: Boolean(JSPLib.storage.checkStorageData('cu-hide-current-uploads',ValidateProgramData,localStorage,true)),
        stashed: Boolean(JSPLib.storage.checkStorageData('cu-stash-current-uploads',ValidateProgramData,localStorage,false)),
    });
    var $notice_box = $(notice_box);
    var $footer_notice = $(unstash_notice);
    if (CU.stashed === true) {
        $notice_box.addClass('stashed');
        $footer_notice.addClass('stashed');
        //The table needs to be hidden when it's stashed
        CU.hidden = true;
    }
    $('header#top').append($notice_box);
    $('footer#page-footer').append($footer_notice);
    $("#toggle-count-notice").on(PROGRAM_CLICK, ToggleNotice);
    $("#stash-count-notice,#restore-count-notice").on(PROGRAM_CLICK, StashNotice);
    if (CU.hidden === false) {
        //Set to opposite so that click can be used and sets it back
        CU.hidden = true;
        setTimeout(()=>{$("#toggle-count-notice").click();}, JQUERY_DELAY);
    }
    JSPLib.utility.setCSSStyle(program_css,'program');
    JSPLib.statistics.addPageStatistics(PROGRAM_NAME);
    setTimeout(()=>{
        JSPLib.storage.pruneEntries(PROGRAM_SHORTCUT, PROGRAM_DATA_REGEX, prune_expires);
    }, noncritical_recheck);
}

/****Function decoration****/

[
    Main,BroadcastCU,GetPeriodUploads,GetCount,GetReverseTagImplication,ValidateEntry,
] = JSPLib.debug.addFunctionLogs([
    Main,BroadcastCU,GetPeriodUploads,GetCount,GetReverseTagImplication,ValidateEntry,
]);

[
    RenderSettingsMenu,InitializeTable,InitializeControls,TooltipHover,RenderChart,
    GetPeriod,CheckPeriodUploads,GetPeriodUploads,RefreshUser,CheckUser,AddCopyright,CopyrightPeriod,
    MergeCopyrightTags,ProcessUploads,PopulateTable,
] = JSPLib.debug.addFunctionTimers([
    //Sync
    RenderSettingsMenu,InitializeTable,InitializeControls,TooltipHover,RenderChart,
    //Async
    GetPeriod,CheckPeriodUploads,GetPeriodUploads,RefreshUser,CheckUser,AddCopyright,CopyrightPeriod,
    MergeCopyrightTags,ProcessUploads,PopulateTable
]);

/****Initialization****/

//Variables for debug.js
JSPLib.debug.debug_console = false;
JSPLib.debug.level = JSPLib.debug.INFO;
JSPLib.debug.program_shortcut = PROGRAM_SHORTCUT;

//Variables for menu.js
JSPLib.menu.program_shortcut = PROGRAM_SHORTCUT;
JSPLib.menu.program_name = PROGRAM_NAME;
JSPLib.menu.program_data = CU;
JSPLib.menu.program_reset_data = PROGRAM_RESET_KEYS;
JSPLib.menu.program_data_regex = PROGRAM_DATA_REGEX;
JSPLib.menu.program_data_key = OptionCacheDataKey;
JSPLib.menu.settings_config = SETTINGS_CONFIG;
JSPLib.menu.control_config = CONTROL_CONFIG;

//Variables for network.js
JSPLib.network.counter_domname = "#loading-counter";

//Export JSPLib
JSPLib.load.exportData(PROGRAM_NAME, CU);

/****Execution start****/

JSPLib.load.programInitialize(Main,'CU',program_load_required_variables,program_load_required_selectors);
