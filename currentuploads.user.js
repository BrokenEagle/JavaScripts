// ==UserScript==
// @name         CurrentUploads
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      14.0
// @source       https://danbooru.donmai.us/users/23799
// @description  Gives up-to-date stats on uploads
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/currentuploads.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.5.2/localforage.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.12.0/validate.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/canvasjs/1.7.0/canvasjs.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/menu.js
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

//Main program variable
var CU;

//Regex that matches the prefix of all program cache data
const program_cache_regex = /^rti-|ct(?:d|w|mo|y|at)?-|(?:daily|weekly|monthly|yearly|alltime|previous)-uploads-/

//Main program expires
const prune_expires = JSPLib.utility.one_day;

//For factory reset
const localstorage_keys = [
    'cu-prune-expires',
    'cu-current-metric',
    'cu-hide-current-uploads',
    'cu-stash-current-uploads'
];
const program_reset_keys = {
    checked_usernames: {},
    checked_users: { user:{}, approver:{} },
    user_copytags: { user:{}, approver:{} },
    period_available: { user:{}, approver:{} }
};

//Available setting values
const period_selectors = ['daily','weekly','monthly','yearly','alltime'];

//Main settings
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
        validate: (data)=>{return Array.isArray(data) && data.reduce((is_string,val)=>{return is_string && (typeof val === 'string') && period_selectors.includes(val);},true) && data.includes('daily');},
        hint: "Select which periods to process and show."
    },
    copyrights_threshold: {
        default: 0,
        parse: parseInt,
        validate: (data)=>{return Number.isInteger(data) && data >= 0;},
        hint: "Maximum number of copyrights to display. Enter 0 to disable this threshold."
    },
    postcount_threshold: {
        default: 0,
        parse: parseInt,
        validate: (data)=>{return Number.isInteger(data) && data >= 0;},
        hint: "Minimum postcount to display copyright. Enter 0 to disable this threshold."
    }
}

//CSS Constants

//Style information
const program_css = `
#upload-counts {
    border: #EEE dotted;
    max-width: 70em;
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
    color: #666;
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
.cu-select-tooltip.cu-activetooltip a {
    font-weight: bold;
}
.cu-period-header {
    background-color: #CCC;
    border-left: 1px solid #444;
    margin-left: -1px;
}
#count-header .cu-manual,
#count-header .cu-limited {
    background-color: white;
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
#count-table .cu-uploads {
    background-color: white;
    padding: 0 5px;
}
#count-copyrights {
    margin: 1em;
    display: none;
}
#count-copyrights-header {
    font-size: 1.25em;
    font-weight: bold;
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
`;

const menu_css = `
#cu-settings hr,
#cu-console .expandable {
    width: 90%;
    margin-left: 0;
}
#cu-cache-viewer textarea {
    width: 100%;
    min-width: 40em;
    height: 50em;
    padding: 5px;
}
#cu-cache-editor-errors {
    display: none;
    border: solid lightgrey 1px;
    margin: 0.5em;
    padding: 0.5em;
}
.jsplib-console {
    width: 100%;
    min-width: 100em;
}
.cu-linkclick.jsplib-linkclick .cu-control.jsplib-control {
    display: inline;
}
#userscript-settings-menu .ui-widget-content a,
#notice .ui-widget-content a {
    color:#0073ff
}
#notice.ui-state-highlight {
    color: #363636;
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

const unstash_notice = '<span id="upload-counts-restore"> - <a href="#" id="restore-count-notice">Restore CurrentUploads</a></span>';
const copyright_counter = '(<span id="loading-counter">...</span>)';

const cu_menu = `
<div id="cu-script-message" class="prose">
    <h2>CurrentUploads</h2>
    <p>Check the forum for the latest on information and updates (<a class="dtext-link dtext-id-link dtext-forum-topic-id-link" href="/forum_topics/15169" style="color:#0073ff">topic #15169</a>).</p>
</div>
<div id="cu-console" class="jsplib-console">
    <div id="cu-settings" class="jsplib-outer-menu">
        <div id="cu-display-settings" class="jsplib-settings-grouping">
            <div id="cu-display-message" class="prose">
                <h4>Display settings</h4>
            </div>
        </div>
        <div id="cu-cache-settings" class="jsplib-settings-grouping">
            <div id="cu-cache-message" class="prose">
                <h4>Cache settings</h4>
                <div class="expandable">
                    <div class="expandable-header">
                        <span>Cache Data details</span>
                        <input type="button" value="Show" class="expandable-button">
                    </div>
                    <div class="expandable-content">
                        <ul>
                            <li><b>Count data:</b> Main data shown in the table.</li>
                            <li><b>Post data:</b> Used to determine post statistics shown in the tooltips and chart data.
                                <ul>
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
                                    <li>For <i>yearly</i> and <i>alltime</i>, the data represents the finalized statistics.
                                </ul>
                            </li>
                            <li><b>Reverse tag implications:</b>The number of tags that a tag implicates. Used to determine the base copyright tag.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        <hr>
        <div id="cu-settings-buttons" class="jsplib-settings-buttons">
            <input type="button" id="cu-commit" value="Save">
            <input type="button" id="cu-resetall" value="Factory Reset">
        </div>
    </div>
    <div id="cu-cache-editor" class="jsplib-outer-menu">
        <div id="cu-editor-message" class="prose">
            <h4>Cache editor</h4>
            <p>See the <b><a href="#cu-cache-message">Cache settings</a></b> settings for the list of all cache data and what they do.</p>
            <div class="expandable">
                <div class="expandable-header">
                    <span>Program Data details</span>
                    <input type="button" value="Show" class="expandable-button">
                </div>
                <div class="expandable-content">
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
                    </ul>
                </div>
            </div>
        </div>
        <div id="cu-cache-editor-controls"></div>
        <div id="cu-cache-editor-errors"></div>
        <div id="cu-cache-viewer">
            <textarea></textarea>
        </div>
    </div>
</div>`;

const all_source_types = ['indexed_db','local_storage'];
const all_data_types = ['count','uploads','approvals','reverse_implication','custom'];

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
const tooltip_metrics = ['score','upscore','downscore','favcount','tagcount','gentags','week','day'];
const chart_metrics = ['score','upscore','downscore','favcount','tagcount','gentags'];

//Feedback messages
const empty_uploads_message_owner = 'Feed me more uploads!';
const empty_uploads_message_other = 'No uploads for this user.';
const empty_approvals_message_other = 'No approvals for this user.';
const empty_uploads_message_anonymous = 'User is Anonymous, so no uploads.';
const copyright_no_uploads = 'No uploads, so no copyrights available for this period.';
const copyright_no_statistics = 'No statistics available for this period (<span style="font-size:80%;color:grey">click the table header</span>).';

//Validation values

const validation_constraints = {
    countentry: JSPLib.validate.counting_constraints,
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
        JSPLib.validate.stringonly_constraints, //COPYRIGHTS
        JSPLib.validate.integer_constraints     //CREATED
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

function ValidationSelector(key) {
    if (key.match(/^ct(?:d|w|mo|y|at)?-/)) {
        return 'countentry';
    } else if (key.match(/^rti-/)) {
        return 'implicationentry';
    }
    else if (key.match(/^(?:daily|weekly|monthly|previous)-(?:uploads|approvals)-/)) {
        return 'postentries';
    } else if (key.match(/^(?:yearly|alltime)-(?:uploads|approvals)-/)) {
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
        RenderValidateError(key,["Data is not a hash."]);
        return false
    }
    let validation_key = ValidationSelector(key);
    check = validate(entry,BuildValidator(validation_key));
    if (check !== undefined) {
        OutputValidateError(key,check);
        return false;
    }
    if (validation_key === 'postentries') {
        return ValidatePostentries(key+'.value',entry.value);
    }
    if (validation_key === 'statentries') {
        return ValidateStatEntries(key+'.value',entry.value);
    }
    return true;
}

function ValidatePostentries(key,postentries) {
    for (let i = 0;i < postentries.length;i++){
        let value_key = key + `[${i}]`;
        if (!JSPLib.validate.validateIsArray(value_key, postentries[i], validation_constraints.postentry.length)) {
            return false;
        }
        let check = validate(postentries[i],validation_constraints.postentry);
        if (check !== undefined) {
            OutputValidateError(value_key,check);
            return false;
        }
    }
    return true;
}

function ValidateStatEntries(key,statentries) {
    let check = validate(statentries,validation_constraints.postmetric);
    if (check !== undefined) {
        OutputValidateError(key,check);
        return false;
    }
    for (let i = 0; i < tooltip_metrics.length; i++) {
        let metric = tooltip_metrics[i];
        if (metric === 'week' || metric === 'day') {
            if (!FixValidateArrayValues(key + '.' + metric,statentries[metric],JSPLib.validate.number_constraints)) {
                return false;
            }
        } else {
            check = validate(statentries[metric],validation_constraints.poststat);
            if (check !== undefined) {
                OutputValidateError(key + '.' + metric,check);
                return false;
            }
        }
    }
    return ValidateChartEntries(key+'.chart_data',statentries.chart_data);
}

function ValidateChartEntries(key,chartentries) {
    let check = validate(chartentries,validation_constraints.chartentry);
    if (check !== undefined) {
        OutputValidateError(key,check);
        return false;
    }
    for (let chart_key in chartentries) {
        for (let i = 0; i < chartentries[chart_key].length; i ++ ) {
            check = validate(chartentries[chart_key][i],validation_constraints.chartdata);
            if (check !== undefined) {
                OutputValidateError(`${key}.${chart_key}[${i}]`,check);
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
            var checkerror = ValidateUserSettings(entry,settings_config);
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
            if (!validate.isBoolean(entry)) {
                checkerror = ['Value is not a boolean.'];
            }
            break;
        default:
            checkerror = ["Not a valid program data key."];
    }
    if (checkerror.length) {
        OutputValidateError(key,checkerror);
        return false;
    }
    return true;
}

//Library functions

function OutputValidateError(key,checkerror) {
    JSPLib.validate.printValidateError(key,checkerror);
    JSPLib.validate.dom_output && RenderValidateError(key,JSON.stringify(checkerror,null,2));
}

function RenderValidateError(key,error_message) {
    if (JSPLib.validate.dom_output) {
        let output_text = `<b>${key}:</b>\r\n<pre>${error_message}</pre>`;
        $(JSPLib.validate.dom_output).html(output_text).show();
    }
}

function HideValidateError() {
    JSPLib.validate.dom_output && $(JSPLib.validate.dom_output).hide();
}

function FixValidateArrayValues(key,array,validator) {
    for (let i = 0;i < array.length; i++) {
        let check = validate({value: array[i]},{value: validator});
        if (check !== undefined) {
            OutputValidateError(key + `[${i}]`,check);
            return false;
        }
    }
    return true;
}

function RenderKeyselect(program_shortcut,setting_name,control=false,value='',all_options=[],hint='') {
    let config, setting_key, display_name, item;
    [config,setting_key,display_name,item] = JSPLib.menu.getProgramValues(program_shortcut,setting_name);
    let menu_type = (control ? "control" : "setting");
    let keyselect_key = `${program_shortcut}-${menu_type}-${setting_key}`;
    if (!control) {
        all_options = config[setting_name].allitems;
        hint = config[setting_name].hint;
        value = item;
    }
    let hint_html = JSPLib.menu.renderSettingHint(program_shortcut,"inline",hint);
    let html = "";
    all_options.forEach((option)=>{
        let selected = (option === value ? 'selected="selected"' : '');
        let display_option = JSPLib.utility.displayCase(option);
        html += `<option ${selected} value="${option}">${display_option}</option>`;
    });
    return `
<div class="${program_shortcut}-options jsplib-options jsplib-menu-item" data-setting="${setting_name}">
    <h4>${display_name}</h4>
    <div>
        <select name="${keyselect_key}" id="${keyselect_key}" data-parent="2">;
            ${html}
        </select>
        ${hint_html}
    </div>
</div>
`;
}

function FixRenderTextinput(program_shortcut,setting_name,length=20,control=false,hint='',buttons=[]) {
    let config, setting_key, display_name, item;
    [config,setting_key,display_name,item] = JSPLib.menu.getProgramValues(program_shortcut,setting_name);
    let textinput_key = `${program_shortcut}-setting-${setting_key}`;
    let menu_type = (control ? "control" : "setting");
    let submit_control = '';
    if (control && buttons.length) {
        buttons.forEach((button)=>{
            submit_control += FixRenderControlButton(program_shortcut,setting_key,button,2);
        });
    }
    let value = '';
    if (!control) {
        hint = config[setting_name].hint;
        value = item;
    }
    let hint_html = JSPLib.menu.renderSettingHint(program_shortcut,"block",hint);
    return `
<div class="${program_shortcut}-textinput jsplib-textinput jsplib-menu-item" data-setting="${setting_name}">
    <h4>${display_name}</h4>
    <div>
        <input type="text" class="${program_shortcut}-${menu_type} jsplib-${menu_type}" name="${textinput_key}" id="${textinput_key}" value="${value}" size="${length}" autocomplete="off" data-parent="2">
        ${submit_control}
        ${hint_html}
    </div>
</div>`;
}

function FixRenderControlButton(program_shortcut,setting_key,button_name,parent_level) {
    let button_key = `${program_shortcut}-${setting_key}-${button_name}`;
    let display_name = JSPLib.utility.displayCase(button_name);
    return `<input type="button" class="jsplib-control ${program_shortcut}-control" name="${button_key}" id="${button_key}" value="${display_name}" data-parent="${parent_level}">`;
}

function FixRenderLinkclick(program_shortcut,setting_name,display_name,link_text,hint) {
    let setting_key = JSPLib.utility.kebabCase(setting_name);
    return `
<div class="${program_shortcut}-linkclick jsplib-linkclick jsplib-menu-item">
    <h4>${display_name}</h4>
    <div>
        <b>[
            <span class="${program_shortcut}-control jsplib-control">
                <a href="#" id="${program_shortcut}-setting-${setting_key}">${link_text}</a>
            </span>
        ]</b>
        &emsp;
        <span class="${program_shortcut}-setting-tooltip jsplib-inline-tooltip">${hint}</span>
    </div>
</div>`;
}

function ValidateUserSettings(settings,config) {
    let error_messages = [];
    if (!validate.isHash(settings)) {
        return ["User settings are not a hash."];
    }
    for (let setting in config) {
        if (!(setting in settings) || !config[setting].validate(settings[setting])) {
            if (!(setting in settings)) {
                error_messages.push(`'${setting}' setting not found.`);
            } else {
                error_messages.push(`'${setting}' contains invalid data.`);
            }
            JSPLib.debug.debuglogLevel("Loading default:",setting,settings[setting],JSPLib.debug.WARNING);
            settings[setting] = config[setting].default;
        }
    }
    let valid_settings = Object.keys(config);
    for (let setting in settings) {
        if (!valid_settings.includes(setting)) {
            JSPLib.debug.debuglogLevel("Deleting invalid setting:",setting,settings[setting],JSPLib.debug.WARNING);
            delete settings[setting];
            error_messages.push(`'${setting}' is an invalid setting.`);
        }
    }
    return error_messages;
}

function UpdateUserSettings(program_shortcut) {
    let program_key = program_shortcut.toUpperCase();
    let settings = Danbooru[program_key].user_settings;
    jQuery(`#${program_shortcut}-settings .${program_shortcut}-setting[id]`).each((i,entry)=>{
        let $input = jQuery(entry);
        let parent_level = $input.data('parent');
        let container = JSPLib.utility.getNthParent(entry,parent_level);
        let setting_name = jQuery(container).data('setting');
        if (entry.type === "checkbox" || entry.type === "radio") {
            let selector = $input.data('selector');
            if (selector) {
                $input.prop('checked', JSPLib.menu.isSettingEnabled(program_key,setting_name,selector));
                $input.checkboxradio("refresh");
            } else {
                $input.prop('checked', settings[setting_name]);
            }
        } else if (entry.type === "text") {
             $input.val(settings[setting_name]);
        } else if (entry.type === "hidden") {
            if (!$(container).hasClass("sorted")) {
                $("ul",container).sortable("destroy");
                let sortlist = $("li",container).detach();
                sortlist.sort((a, b)=>{
                    let sort_a = $("input",a).data('sort');
                    let sort_b = $("input",b).data('sort');
                    return settings[setting_name].indexOf(sort_a) - settings[setting_name].indexOf(sort_b);
                });
                sortlist.each((i,entry)=>{
                    $("ul",container).append(entry);
                });
                $("ul",container).sortable();
                $(container).addClass("sorted");
            }
        }
    });
    $(".jsplib-sortlist").removeClass("sorted");
}

//Prevents the same object from filling up the array
function BetterArrayFill(length,stringified_json) {
    return Array(length).fill().map(()=>{return JSON.parse(stringified_json);});
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

//Render table

function RenderHeader() {
    var tabletext = AddTableHeader('Name');
    let click_periods = manual_periods.concat(limited_periods);
    let times_shown = GetShownPeriodKeys();
    $.each(times_shown,(i,period)=>{
        let header = period_info.header[period];
        if (click_periods.includes(period)) {
            let class_name = (manual_periods.includes(period) ? 'cu-manual' : 'cu-limited');
            tabletext += AddTableHeader(`<a class="${class_name}">${header}</a><span class="cu-display" style="display:none">&nbsp;(<span class="cu-counter">...</span>)</span>`,`class="cu-period-header" data-period="${period}"`);
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
    var rowtag = (key === ''? `${CU.usertag}:` + CU.current_username : key);
    var rowtext = (key === ''? CU.current_username : key).replace(/_/g,' ');
    var tabletext = AddTableData(JSPLib.danbooru.postSearchLink(rowtag,JSPLib.utility.maxLengthString(rowtext)));
    let times_shown = GetShownPeriodKeys();
    let click_periods = manual_periods.concat(limited_periods);
    for (let i = 0;i < times_shown.length; i++) {
        let period = times_shown[i];
        let data_text = GetTableValue(key,period);
        var rowdata = "";
        if (click_periods.includes(period)) {
            let class_name = (manual_periods.includes(period) ? 'cu-manual' : 'cu-limited');
            rowdata = (key === ''? `class="${class_name}" data-period="${period}"` : "");
        }
        let is_available = CU.period_available[CU.usertag][CU.current_username][period];
        let is_limited = limited_periods.includes(period);
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
    let count_data = JSPLib.storage.getStorageData(key, sessionStorage);
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
        let taglink = JSPLib.danbooru.postSearchLink(copyright,JSPLib.utility.maxLengthString(copyright));
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
    let data = JSPLib.storage.getStorageData(GetPeriodKey(period_info.longname[period]),sessionStorage);
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
    let periods = BetterArrayFill(points, "[]");
    posts.forEach((post)=>{
        let index = Math.floor((Date.now() - post.created - time_offset)/(period_info.divisor[period]));
        index = (points ? Math.min(points-1,index) : index);
        index = Math.max(0,index);
        if (index >= periods.length) {
            periods = periods.concat(BetterArrayFill(index + 1 - periods.length, "[]"));
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
        data_point = {
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
    var items = Object.keys(dict).map((key)=>{
        return [key, dict[key].length];
    });
    items.sort((first, second)=>{
        if (first[1] !== second[1]) {
            return second[1] - first[1];
        } else {
            return first[0].localeCompare(second[0]);
        }
    });
    return items.map((entry)=>{return entry[0];});
}

function BuildTagParams(type,tag) {
    return (type === 'at' ? '' : ('age:..1' + type + ' ')) + tag;
}

function GetCopyrightCount(posts) {
    let copyright_count = {};
    $.each(posts,(i,entry)=>{
        $.each(entry.copyrights.split(' '),(j,tag)=>{
            copyright_count[tag] = copyright_count[tag] || [];
            copyright_count[tag] = copyright_count[tag].concat([entry.id]);
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

async function MergeCopyrightTags(user_copytags) {
    let query_implications = JSPLib.utility.setDifference(user_copytags,Object.keys(CU.reverse_implications));
    Object.assign(CU.reverse_implications,...(await Promise.all(query_implications.map(async (key)=>{return {[key]:await GetReverseTagImplication(key)};}))));
    return user_copytags.filter(value=>{return CU.reverse_implications[value] === 0;});
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
            copyrights: entry.tag_string_copyright,
            created: new Date(entry.created_at).getTime()
        };
    });
}

function PreCompressData(posts) {
    return posts.map((entry)=>{
        return [entry.id,entry.score,entry.upscore,entry.downscore,entry.favcount,entry.tagcount,entry.gentags,entry.copyrights,entry.created]
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
            created: entry[8]
        };
    });
}

function GetTagData(tag) {
    return Promise.all(CU.user_settings.periods_shown.map((period)=>{return GetCount(longname_key[period],tag);}));
}

function GetPeriodKey(period_name) {
    return `${period_name}-${CU.counttype}-${CU.current_username}`;
}

async function CheckPeriodUploads() {
    CU.period_available[CU.usertag][CU.current_username] = CU.period_available[CU.usertag][CU.current_username] || {};
    let times_shown = GetShownPeriodKeys();
    for (let i = 0; i < times_shown.length; i++) {
        let period = times_shown[i];
        if (period in CU.period_available[CU.usertag][CU.current_username]) {
            continue;
        }
        let data_key = GetPeriodKey(period_info.longname[period]);
        let max_expires = period_info.uploadexpires[period]
        var check = await JSPLib.storage.checkLocalDB(data_key,ValidateEntry,max_expires);
        CU.period_available[CU.usertag][CU.current_username][period] = Boolean(check);
        if (!check) {
            sessionStorage.removeItem(data_key);
        }
    }
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
        SetTooltipChangeClick();
        SetCopyrightPeriodClick();
        SetToggleCopyrightsSectionClick();
        SetCheckUserClick();
        SetRefreshUserClick();
        SetAddCopyrightClick();
        CU.controls_initialized = true;
        setTimeout(()=>{Danbooru.IAC && Danbooru.IAC.InitializeAutocompleteIndexed && Danbooru.IAC.InitializeAutocompleteIndexed("#count_query_user_id",'us');},1000);
    }
}

function InitializeTable() {
    $("#count-header").html(AddTable(RenderHeader(),'class="striped"'));
    $("#count-table").html(AddTable(RenderBody(),'class="striped"'));
    $("#count-order").html(RenderOrderMessage("d",0));
    SetTooltipHover();
    GetPeriodClick();
    SortTableClick();
    RenderChartClick();
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
        return JSPLib.danbooru.submitRequest('counts/posts',{tags: BuildTagParams(type,tag), skip_cache: true},{counts: {posts: 0}},key)
        .then(data=>{
            JSPLib.storage.saveData(key, {value: data.counts.posts, expires: JSPLib.utility.getExpiration(max_expires)});
        });
    }
}

//Only checking the existence of a user, so set a long expiration timeout
function CheckUser(username) {
    return JSPLib.danbooru.submitRequest('users', {search: {name_matches: username}, expiry: 30});
}

async function GetPeriodUploads(username,period,limited=false,domname=null) {
    let period_name = period_info.longname[period];
    let max_expires = period_info.uploadexpires[period]
    let key = GetPeriodKey(period_name);
    var check = await JSPLib.storage.checkLocalDB(key,ValidateEntry,max_expires);
    if (!(check)) {
        JSPLib.debug.debuglog(`Network (${period_name} ${CU.counttype})`);
        let data = await GetPostsCountdown(max_post_limit_query,BuildTagParams(period,`${CU.usertag}:${username}`),domname);
        let mapped_data = MapPostData(data);
        if (limited) {
            let indexed_posts = AssignPostIndexes(period,mapped_data,0);
            mapped_data = Object.assign(...tooltip_metrics.map((metric)=>{return {[metric]: GetAllStatistics(mapped_data,metric)};}));
            mapped_data.chart_data = Object.assign(...chart_metrics.map((metric)=>{return {[metric]: GetPeriodAverages(indexed_posts,metric)};}));
            mapped_data.chart_data.uploads = GetPeriodPosts(indexed_posts);
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
    $("#count-header .cu-manual,#count-header .cu-limited").click(async (e)=>{
        let header = e.target.parentElement;
        if ($(header).hasClass("cu-processed")) {
            return;
        }
        let is_limited = $(e.target).hasClass("cu-limited");
        let period = header.dataset.period;
        $(`#count-header th[data-period=${period}] .cu-display`).show();
        await GetPeriodUploads(CU.current_username,period,is_limited,`#count-header th[data-period=${period}] .cu-counter`);
        CU.period_available[CU.usertag][CU.current_username][period] = true;
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
        $(`#count-header th[data-period=${period}] .cu-display`).hide();
        $(`.cu-select-tooltip[data-type="${CU.current_metric}"] a`).click();
        $(header).addClass("cu-processed");
    });
}

function SortTableClick() {
    $("#count-header th").click((e)=>{
        if (e.target.tagName !== "TH") {
            return;
        }
        let column = e.target.cellIndex + 1;
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
    });
}

function RenderChartClick() {
    $("#count-table .cu-manual,#count-table .cu-limited").click((e)=>{
        if (e.target.tagName !== "TD" || !chart_metrics.includes(CU.current_metric)) {
            return;
        }
        let period = $(e.target).data('period');
        let is_limited = $(e.target).hasClass("cu-limited");
        let longname = period_info.longname[period];
        let points = period_info.points[period];
        let data = JSPLib.storage.getStorageData(GetPeriodKey(longname),sessionStorage);
        if (!data || (!is_limited && data.value.length === 0) || (is_limited && !data.value.chart_data)) {
            Danbooru.Utility.notice(`${period_info.header[period]} period not populated! Click the period header to activate the chart.`);
            return;
        }
        if (!is_limited) {
            let time_offset = Date.now() - (data.expires - period_info.uploadexpires[period]);
            let posts = PostDecompressData(data.value);
            let indexed_posts = AssignPostIndexes(period,posts,time_offset);
            var period_averages = GetPeriodAverages(indexed_posts,CU.current_metric);
            var period_uploads = GetPeriodPosts(indexed_posts);
        } else {
            var period_averages = data.value.chart_data[CU.current_metric];
            var period_uploads = data.value.chart_data.uploads;
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
                type: "line",
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
        $("#count-chart").show();
        var chart = new CanvasJS.Chart("count-chart",chart_data);
        chart.render();
        $(".canvasjs-chart-credit").css('top',"400px");
    });
}

function SetTooltipChangeClick() {
    $(".cu-select-tooltip").click((e)=>{
        CU.current_metric = $(e.target.parentElement).data('type');
        $(".cu-select-tooltip,.cu-tooltiptext").removeClass("cu-activetooltip");
        $(`.cu-select-tooltip[data-type="${CU.current_metric}"]`).addClass("cu-activetooltip");
        $(`.cu-tooltiptext[data-type="${CU.current_metric}"]`).addClass("cu-activetooltip");
        JSPLib.storage.setStorageData('cu-current-metric',CU.current_metric,localStorage);
        e.preventDefault();
    });
}

function SetToggleCopyrightsSectionClick() {
    $("#count-copyrights-header a").click((e)=>{
        $(e.target).toggleClass("ui-icon-triangle-1-e ui-icon-triangle-1-s");
        $('#count-copyrights-section').slideToggle(100);
    });
}

function SetToggleCopyrightTagClick() {
    $("#count-copyrights-list a").off().click((e)=>{
        let $container = $(e.target.parentElement);
        $container.toggleClass("cu-active-copyright");
        let copyright = $container.data('copyright');
        if ($container.hasClass("cu-active-copyright")) {
            CU.active_copytags.push(copyright);
        } else {
            CU.active_copytags.splice(CU.active_copytags.indexOf(copyright),1);
        }
        e.preventDefault();
    })
}

function SetCopyrightPeriodClick() {
    $(".cu-select-period a").click(async (e)=>{
        let short_period = CU.copyright_period = $(e.target.parentElement).data('type');
        $(".cu-select-period").removeClass("cu-active-period");
        $(`.cu-select-period[data-type="${short_period}"]`).addClass("cu-active-period");
        if (short_period === 'manual') {
            $("#count-copyrights-manual").show();
            $('#count-copyrights-list').html(RenderCopyrights('manual'));
            SetToggleCopyrightTagClick();
        } else {
            $("#count-copyrights-manual").hide();
            let current_period = period_info.longname[short_period];
            let is_period_enabled = CU.period_available[CU.usertag][CU.current_username][short_period];
            if (is_period_enabled) {
                if (CU.user_copytags[CU.usertag][CU.current_username][current_period] === undefined) {
                    let data = JSPLib.storage.getStorageData(GetPeriodKey(current_period),sessionStorage);
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
                    SetToggleCopyrightTagClick();
                }
            } else {
                $('#count-copyrights-list').html(`<div id="empty-statistics">${copyright_no_statistics}</div>`);
            }
        }
        e.preventDefault();
    });
}

function SetToggleNoticeClick() {
    $("#toggle-count-notice").click((e)=>{
        if (CU.hidden === true) {
            CU.hidden = false;
            $('#upload-counts').addClass('opened');
            if (!PopulateTable.is_started) {
                //Always show current user on open to prevent processing potentially bad usernames set by SetCheckUserClick
                CU.empty_uploads_message = (CU.username === "Anonymous" ? empty_uploads_message_anonymous : empty_uploads_message_owner);
                CU.current_username = CU.username;
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
        JSPLib.storage.setStorageData('cu-hide-current-uploads',CU.hidden,localStorage)
        e.preventDefault();
    });
}

function SetStashNoticeClick() {
    $("#stash-count-notice,#restore-count-notice").click((e)=>{
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
        e.preventDefault();
    });
}

function SetRestoreNoticeClick() {
    $("#restore-count-notice").click((e)=>{
        CU.stashed = false;
        JSPLib.storage.setStorageData('cu-stash-current-uploads',CU.stashed,localStorage);
        $('#upload-counts,#upload-counts-restore').removeClass('stashed');
        CU.channel.postMessage({type: "unstash"});
        e.preventDefault();
    });
}

function SetRefreshUserClick() {
    $("#count_refresh_user_id").click(async (e)=>{
        $("#count-copyrights-counter").html(copyright_counter);
        let diff_tags = JSPLib.utility.setDifference(CU.active_copytags,CU.shown_copytags);
        let promise_array = [];
        $.each((diff_tags),(i,val)=>{
            promise_array.push(GetTagData(`${CU.usertag}:${CU.current_username} ${val}`));
            promise_array.push(GetTagData(val));
        });
        await Promise.all(promise_array);
        $("#count-copyrights-counter").html('');
        InitializeTable();
    });
}

function SetCheckUserClick() {
    $("#count_submit_user_id").click(async (e)=>{
        //Don't change the username while currently processing
        if (!PopulateTable.is_started) {
            $("#count-chart").hide();
            let check_user;
            let check_username = $("#count_query_user_id").val();
            if (check_username === "") {
                check_user = [];
            } else if (check_username in CU.checked_usernames) {
                check_user = CU.checked_usernames[check_username];
            } else {
                //Check each time no matter what as misses can be catastrophic
                check_user = await CheckUser(check_username);
                CU.checked_usernames[check_username] = check_user;
            }
            if (check_user.length) {
                CU.current_username = check_user[0].name;
                let is_approvals = $("#count_approver_select")[0].checked;
                CU.empty_uploads_message = is_approvals ? empty_approvals_message_other : empty_uploads_message_other;
                CU.usertag = is_approvals ? 'approver' : 'user';
                CU.counttype = is_approvals ? 'approvals' : 'uploads';
                PopulateTable();
            } else {
                TableMessage(`<div id="empty-uploads">User doesn't exist!</div>`);
            }
        }
        e.preventDefault();
    });
}

function SetAddCopyrightClick() {
    $("#count_add_copyright").click(async (e)=>{
        let user_copytags = CU.user_copytags[CU.usertag][CU.current_username];
        let tag = $("#count_query_copyright").val();
        let tagdata = await JSPLib.danbooru.submitRequest('tags',{search:{name: tag}},[]);
        if (tagdata.length === 0) {
            Danbooru.Utility.notice('Tag not valid');
            return;
        }
        tag = tagdata[0].name;
        user_copytags.manual.push(tag);
        user_copytags.manual = JSPLib.utility.setUnique(user_copytags.manual);
        CU.active_copytags.push(tag);
        CU.active_copytags = JSPLib.utility.setUnique(CU.active_copytags);
        $('#count-copyrights-list').html(RenderCopyrights('manual'));
        SetToggleCopyrightTagClick();
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
        let is_new_tab = JSPLib.storage.getStorageData(previous_key,sessionStorage) === null;
        let previous_uploads = await JSPLib.storage.checkLocalDB(previous_key,ValidateEntry) || {value: []};
        previous_uploads = PostDecompressData(previous_uploads.value);
        let symmetric_difference = JSPLib.utility.setSymmetricDifference(JSPLib.utility.getObjectAttributes(current_uploads,'id'),JSPLib.utility.getObjectAttributes(previous_uploads,'id'));
        if (is_new_tab || symmetric_difference.length || IsMissingTag(`${CU.usertag}:${CU.current_username}`)) {
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
            let copyright_changed = (is_new_tab ? user_copytags : JSPLib.utility.setIntersection(user_copytags,copyright_symdiff));
            let copyright_nochange = (is_new_tab ? [] : JSPLib.utility.setDifference(user_copytags,copyright_changed));
            $.each(copyright_nochange,(i,val)=>{
                if (CheckCopyrightVelocity(val) || IsMissingTag(val)) {
                    promise_array.push(GetTagData(val));
                }
                if (IsMissingTag(`${CU.usertag}:${CU.current_username} ${val}`)) {
                    promise_array.push(GetTagData(`${CU.usertag}:${CU.current_username} ${val}`));
                }
            });
            $.each(copyright_changed,(i,val)=>{
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

////Cache editor

//Program cache function

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

//Cache helper functions

async function LoadStorageKeys(program_shortcut) {
    let program_key = program_shortcut.toUpperCase();
    let storage_keys = await JSPLib.storage.danboorustorage.keys();
    Danbooru[program_key].storage_keys.indexed_db = storage_keys.filter((key)=>{return key.match(program_cache_regex);});
    storage_keys = Object.keys(localStorage);
    Danbooru[program_key].storage_keys.local_storage = storage_keys.filter((key)=>{return key.startsWith(program_shortcut + "-");});
}

function GetCacheDatakey(program_shortcut,option) {
    let program_key = program_shortcut.toUpperCase();
    let program_data = Danbooru[program_key];
    program_data.data_source = $(`#${program_shortcut}-control-data-source`).val();
    program_data.data_type = $(`#${program_shortcut}-control-data-type`).val();
    program_data.data_value = data_key = $(`#${program_shortcut}-setting-data-name`).val().trim().replace(/\s+/g,'_');
    if (program_data.data_source === "local_storage") {
        data_key = program_shortcut + '-' + program_data.data_value;
    } else if (program_data.data_type !== "custom") {
        if (typeof option === "function") {
            data_key = option(program_data.data_type,program_data.data_value);
        } else if (typeof option === "object") {
            data_key = option[program_data.data_type] + '-' + program_data.data_value;
        }
    }
    return data_key;
}

function CacheSource(program_shortcut,data_regex,option) {
    let program_key = program_shortcut.toUpperCase();
    let program_data = Danbooru[program_key];
    return function (req,resp) {
        let check_key = GetCacheDatakey(program_shortcut,option);
        if (program_data.data_source === "indexed_db" && program_data.data_value.length === 0) {
            resp([]);
            return;
        }
        let source_keys = program_data.storage_keys[program_data.data_source];
        let available_keys = source_keys.filter((key)=>{return key.toLowerCase().startsWith(check_key.toLowerCase());});
        let transformed_keys = available_keys.slice(0,10);
        if (program_data.data_source === 'local_storage') {
            transformed_keys = transformed_keys.map((key)=>{return key.replace(RegExp(`^${program_shortcut}-`),'');});
        } else if (program_data.data_type !== "custom") {
            transformed_keys = transformed_keys.map((key)=>{return key.replace(data_regex,'');});
        }
        resp(transformed_keys);
    }
}

//Cache event functions

function GetCacheClick(program_shortcut,option) {
    let program_key = program_shortcut.toUpperCase();
    $(`#${program_shortcut}-data-name-get`).on(`click.${program_shortcut}`,(e)=>{
        let storage_key = GetCacheDatakey(program_shortcut,option);
        if (Danbooru[program_key].data_source === "local_storage") {
            let data = JSPLib.storage.getStorageData(storage_key,localStorage);
            $(`#${program_shortcut}-cache-viewer textarea`).val(JSON.stringify(data,null,2));
        } else {
            JSPLib.storage.retrieveData(storage_key).then((data)=>{
                $(`#${program_shortcut}-cache-viewer textarea`).val(JSON.stringify(data,null,2));
            });
        }
        HideValidateError();
        $("#close-notice-link").click();
    });
}

function SaveCacheClick(program_shortcut,localvalidator,indexvalidator,option) {
    let program_key = program_shortcut.toUpperCase();
    $(`#${program_shortcut}-data-name-save`).on(`click.${program_shortcut}`,(e)=>{
        try {
            var data = JSON.parse($(`#${program_shortcut}-cache-viewer textarea`).val());
        } catch (e) {
            Danbooru.Utility.error("Invalid JSON data! Unable to save.");
            return;
        }
        let storage_key = GetCacheDatakey(program_shortcut,option);
        if (Danbooru[program_key].data_source === "local_storage") {
            if (localvalidator(storage_key,data)) {
                JSPLib.storage.setStorageData(storage_key,data,localStorage);
                Danbooru.Utility.notice("Data was saved.");
                HideValidateError();
                if (storage_key === `${program_shortcut}-user-settings`) {
                    CU.user_settings = data;
                    UpdateUserSettings(program_shortcut);
                }
            } else {
                Danbooru.Utility.error("Data is invalid! Unable to save.");
            }
        } else {
            if (indexvalidator(storage_key,data)) {
                JSPLib.storage.saveData(storage_key,data).then(()=>{
                    Danbooru.Utility.notice("Data was saved.");
                    HideValidateError();
                });
            } else {
                Danbooru.Utility.error("Data is invalid! Unable to save.");
            }
        }
    });
}

function DeleteCacheClick(program_shortcut,option) {
    let program_key = program_shortcut.toUpperCase();
    $(`#${program_shortcut}-data-name-delete`).on(`click.${program_shortcut}`,(e)=>{
        let storage_key = GetCacheDatakey(program_shortcut,option);
        if (Danbooru[program_key].data_source === "local_storage") {
            if (confirm("This will delete program data that may cause problems until the page can be refreshed.\n\nAre you sure?")) {
                localStorage.removeItem(storage_key);
                Danbooru.Utility.notice("Data has been deleted.");
                HideValidateError();
            }
        } else {
            JSPLib.storage.removeData(storage_key).then((data)=>{
                Danbooru.Utility.notice("Data has been deleted.");
                HideValidateError();
            });
        }
    });
}

function CacheAutocomplete(program_shortcut,data_regex,option) {
    let program_key = program_shortcut.toUpperCase();
    $(`#${program_shortcut}-setting-data-name`).autocomplete({
        minLength: 0,
        delay: 0,
        source: CacheSource(program_shortcut,data_regex,option),
        search: function() {
            $(this).data("uiAutocomplete").menu.bindings = $();
        }
    }).off('keydown.Autocomplete.tab');
}

//Settings functions

function BroadcastCU(ev) {
    JSPLib.debug.debuglog("Broadcast",ev.data);
    if (ev.data.type === "hide") {
        CU.hidden = true;
        $('#upload-counts').removeClass('opened');
    } else if (ev.data.type === "show") {
        CU.hidden = false;
        $('#upload-counts').addClass('opened');
    } else if (ev.data.type === "stash") {
        CU.stashed = true;
        CU.hidden = true;
        $('#upload-counts,#upload-counts-restore').addClass('stashed');
    } else if (ev.data.type === "unstash") {
        CU.stashed = false;
        $('#upload-counts,#upload-counts-restore').removeClass('stashed');
    } else if (ev.data.type === "settings") {
        CU.user_settings = ev.data.user_settings;
    } else if (ev.data.type === "reset") {
        $('#upload-counts').removeClass('opened');
        JSPLib.storage.setStorageData('cu-hide-current-uploads',true,localStorage);
        CU.user_settings = ev.data.user_settings;
        Object.assign(CU,program_reset_keys);
    } else if (ev.data.type === "purge") {
        $.each(sessionStorage,(key)=>{
            if (key.match(program_cache_regex)) {
                sessionStorage.removeItem(key);
            }
        });
    }
}

function IsSettingEnabled(setting_name,selector) {
    return CU.user_settings[setting_name].includes(selector);
}

function GetShownPeriodKeys() {
    return timevalues.filter((period_key)=>{return CU.user_settings.periods_shown.includes(period_info.longname[period_key]);});
}

function RenderSettingsMenu() {
    $("#current-uploads").append(cu_menu);
    $("#cu-display-settings").append(JSPLib.menu.renderCheckbox('cu','copyrights_merge'));
    $("#cu-display-settings").append(JSPLib.menu.renderCheckbox('cu','copyrights_enabled'));
    $("#cu-display-settings").append(JSPLib.menu.renderTextinput("cu",'copyrights_threshold',10));
    $("#cu-display-settings").append(JSPLib.menu.renderTextinput("cu",'postcount_threshold',10));
    $("#cu-display-settings").append(JSPLib.menu.renderInputSelectors('cu','periods_shown','checkbox'));
    $("#cu-cache-settings").append(FixRenderLinkclick("cu",'purge_cache',`Purge cache (<span id="cu-purge-counter">...</span>)`,"Click to purge","Dumps all of the cached data related to CurrentUploads."));
    $("#cu-cache-editor-controls").append(RenderKeyselect('cu','data_source',true,'indexed_db',all_source_types,"Indexed DB is <b>Cache Data</b> and Local Storage is <b>Program Data</b>."));
    $("#cu-cache-editor-controls").append(RenderKeyselect('cu','data_type',true,'count',all_data_types,"Only applies to Indexed DB.  Use <b>Custom</b> for querying by keyname."));
    $("#cu-cache-editor-controls").append(RenderKeyselect('cu','data_period',true,'daily',period_selectors.concat(['previous']),"Period is only for <b>Count</b>, <b>Uploads</b> and <b>Approvals</b>. <b>Count</b> cannot use the 'Previous' period."));
    $("#cu-cache-editor-controls").append(FixRenderTextinput('cu','data_name',20,true,"Click <b>Get</b> to see the data, <b>Save</b> to edit it, and <b>Delete</b> to remove it.",['get','save','delete']));
    JSPLib.menu.engageUI('cu',true);
    $("#cu-select-periods-shown-daily").checkboxradio("disable"); //Daily period is mandatory
    JSPLib.menu.saveUserSettingsClick('cu','CurrentUploads');
    JSPLib.menu.resetUserSettingsClick('cu','CurrentUploads',localstorage_keys,program_reset_keys);
    JSPLib.menu.purgeCacheClick('cu','CurrentUploads',program_cache_regex,"#cu-purge-counter");
    GetCacheClick('cu',OptionCacheDataKey);
    SaveCacheClick('cu',ValidateProgramData,ValidateEntry,OptionCacheDataKey);
    DeleteCacheClick('cu',OptionCacheDataKey);
    CacheAutocomplete('cu',program_cache_regex,OptionCacheDataKey);
}

//Main function

function main() {
    Danbooru.CU = CU = {
        username: JSPLib.utility.getMeta("current-user-name"),
        is_gold_user: $('body').data('user-is-gold'),
        usertag: 'user',
        counttype: 'uploads',
        channel: new BroadcastChannel('CurrentUploads'),
        checked_usernames: {},
        checked_users: { user:{}, approver:{} },
        user_copytags: { user:{}, approver:{} },
        period_available: { user:{}, approver:{} },
        reverse_implications: {},
        current_metric: JSPLib.storage.getStorageData('cu-current-metric',localStorage,'score'),
        hidden: Boolean(JSPLib.storage.getStorageData('cu-hide-current-uploads',localStorage,false)),
        stashed: Boolean(JSPLib.storage.getStorageData('cu-stash-current-uploads',localStorage,false)),
        controls_initialized: false,
        copyright_period: 'd',
        storage_keys: {indexed_db: [], local_storage: []},
        settings_config: settings_config
    };
    CU.user_settings = JSPLib.menu.loadUserSettings('cu');
    CU.channel.onmessage = BroadcastCU;
    JSPLib.utility.setCSSStyle(program_css,'program');
    $notice_box = $(notice_box);
    $footer_notice = $(unstash_notice);
    if (CU.stashed === true) {
        $notice_box.addClass('stashed');
        $footer_notice.addClass('stashed');
        //The table needs to be hidden when it's stashed
        CU.hidden = true;
    }
    $('header#top').append($notice_box);
    $('footer#page-footer').append($footer_notice);
    SetToggleNoticeClick();
    SetStashNoticeClick();
    if (CU.hidden === false) {
        //Set to opposite so that click can be used and sets it back
        CU.hidden = true;
        $("#toggle-count-notice").click();
    }
    if ($("#c-users #a-edit").length) {
        JSPLib.validate.dom_output = "#cu-cache-editor-errors";
        LoadStorageKeys('cu');
        JSPLib.utility.installScript("https://cdn.jsdelivr.net/gh/jquery/jquery-ui@1.12.1/ui/widgets/tabs.js").done(()=>{
            JSPLib.menu.installSettingsMenu("CurrentUploads");
            RenderSettingsMenu();
        });
        JSPLib.utility.setCSSStyle(menu_css,'menu');
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
