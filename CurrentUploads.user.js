// ==UserScript==
// @name         CurrentUploads
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      16.25
// @description  Gives up-to-date stats on uploads.
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        https://*.donmai.us/*
// @exclude      /^https://\w+\.donmai\.us/.*\.(xml|json|atom)(\?|$)/
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/CurrentUploads.user.js
// @updateURL    https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/CurrentUploads.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.10.0/localforage.min.js
// @require      https://cdn.jsdelivr.net/npm/localforage-removeitems@1.4.0/dist/localforage-removeitems.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.13.1/validate.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/canvasjs/1.7.0/canvasjs.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/ece7ee0fb90dfa2c90874bd6eea467b5295d15dd/lib/module.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/ece7ee0fb90dfa2c90874bd6eea467b5295d15dd/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/ece7ee0fb90dfa2c90874bd6eea467b5295d15dd/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/ece7ee0fb90dfa2c90874bd6eea467b5295d15dd/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/ece7ee0fb90dfa2c90874bd6eea467b5295d15dd/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/ece7ee0fb90dfa2c90874bd6eea467b5295d15dd/lib/template.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/ece7ee0fb90dfa2c90874bd6eea467b5295d15dd/lib/concurrency.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/ece7ee0fb90dfa2c90874bd6eea467b5295d15dd/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/ece7ee0fb90dfa2c90874bd6eea467b5295d15dd/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/ece7ee0fb90dfa2c90874bd6eea467b5295d15dd/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/ece7ee0fb90dfa2c90874bd6eea467b5295d15dd/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/ece7ee0fb90dfa2c90874bd6eea467b5295d15dd/lib/menu.js
// ==/UserScript==

/* global JSPLib $ CanvasJS */

/****Module import****/

(({DanbooruProxy, Debug, Notice, Utility, Storage, Template, Statistics, Validate, Danbooru, Load, Menu}) => {

const PROGRAM_NAME = 'CurrentUploads';
const PROGRAM_SHORTCUT = 'cu';

/****Library updates****/

////NONE

/****Global variables****/

//Exterior script variables
const DANBOORU_TOPIC_ID = '15169';

//Variables for Load.js
const PROGRAM_LOAD_REQUIRED_VARIABLES = ['window.jQuery', 'window.Danbooru', 'Danbooru.CurrentUser'];
const PROGRAM_LOAD_REQUIRED_SELECTORS = ["#top", "#page-footer"];

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
    checked_users: {user: {}, approver: {}},
    user_copytags: {user: {}, approver: {}},
    period_available: {user: {}, approver: {}},
    reverse_implications: {},
};

//Available setting values
const period_selectors = ['daily', 'weekly', 'monthly', 'yearly', 'alltime'];

//Main settings
const SETTINGS_CONFIG = {
    copyrights_merge: {
        reset: true,
        validate: Utility.isBoolean,
        hint: "Merge all implied copyrights to their base copyright. Ex: (splatoon_1, splatoon_2) -> splatoon."
    },
    copyrights_enabled: {
        reset: true,
        validate: Utility.isBoolean,
        hint: "Process and show user copyright uploads."
    },
    periods_shown: {
        allitems: period_selectors,
        reset: period_selectors,
        validate: (data) => (Menu.validateCheckboxRadio(data, 'checkbox', period_selectors) && data.includes('daily')),
        hint: "Select which periods to process and show."
    },
    copyrights_threshold: {
        reset: 0,
        parse: parseInt,
        validate: (data) => (Number.isInteger(data) && data >= 0),
        hint: "Maximum number of copyrights to display. Enter 0 to disable this threshold."
    },
    postcount_threshold: {
        reset: 0,
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
    }, {
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
const PROGRAM_CSS = Template.normalizeCSS()`
/**GENERAL**/
.cu-link {
    cursor: pointer;
}
.cu-switch-control {
    &.cu-active-control {
        text-shadow: 1px 0 0;
    }
    a {
        color: grey;
        &:hover {
            filter: brightness(1.5);
        }
    }
}
/**MAIN**/
#upload-counts {
    border-style: dotted;
    border-width: 2px;
    max-width: 70em;
    margin-left: 2em;
    &.opened {
        border-style: dashed;
        border-width: 5px;
        #count-module {
            display: block;
        }
        #upload-counts-toggle {
            margin: 0.5em;
        }
    }
    &.stashed {
        display: none;
    }
}
#count-module {
    display: none;
    padding-bottom: 1em;
    border-bottom: 1px solid;
}
/**TABLE**/
#count-table {
    margin-left: 1em;
    td, th {
        width: 10em;
        text-align: center;
        &:first-of-type {
            width: 12em;
            text-align: left;
            word-break: break-all;
        }
        &:not(:first-of-type) {
            border-left: 1px solid;
        }
    }
}
#count-header a {
    padding: 2px;
    border-radius: 5px;
}
#count-body {
    .overflowed {
        max-height: 20em;
        overflow-x: hidden;
        overflow-y: auto;
        tr:nth-child(1) .cu-tooltiptext {
            top: -5px;
        }
        tr:nth-child(2) .cu-tooltiptext {
            top: -25px;
        }
        tr:nth-child(3) .cu-tooltiptext {
            top: -40px;
        }
        tr:nth-last-child(2) .cu-tooltiptext {
            top: -60px;
        }
        tr:nth-last-child(1) .cu-tooltiptext {
            top: -75px;
        }
    }
    .cu-uploads {
        background-color: var(--body-background-color);
        padding: 0 5px;
    }
    a.with-style:hover {
        filter: brightness(1.5);
    }
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
}
#count-controls {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
}
.cu-tooltip {
    position: relative;
    display: inline-block;
    border-bottom: 1px dotted black;
    min-width: 2em;
    text-align: center;
    .cu-tooltiptext {
        visibility: hidden;
        width: 90px;
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
    &:hover .cu-tooltiptext.cu-activetooltip {
        visibility: visible;
    }
}
.cu-period-header {
    border-left: 1px solid;
    margin-left: -1px;
}
#empty-uploads {
    margin: 1em;
    font-size: 200%;
    font-weight: bold;
    font-family: monospace;
}
/**COPYRIGHTS**/
#count-copyrights {
    margin: 1em;
}
#count-copyrights-header {
    font-size: 1.25em;
    font-weight: bold;
    display: flex;
    .cu-triangle {
        position: relative;
        width: 1em;
    }
    .cu-svg-caret {
        position: absolute;
    }
    .cu-triangle-right .cu-svg-caret-down {
        display: none;
    }
    .cu-triangle-down .cu-svg-caret-right {
        display: none;
    }
    .cu-svg-caret-right {
        top: -2px;
    }
    .cu-svg-caret-down {
        top: -4px;
    }
}
#count-copyrights-section {
    margin: 0.5em;
}
#count-copyrights-controls {
    display: flex;
    gap: 20px;
}
#count-copyrights-list {
    line-height: 150%;
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    .cu-active-copyright a {
        text-shadow: 1px 0 0;
    }
}
#count-copyrights-manual {
    margin: 1em;
}
#empty-statistics {
    margin: 1em;
    font-weight: bold;
    font-size: 16px;
}
/**USER**/
#count-query-user {
    margin: 0.5em;
    display: flex;
    gap: 0.5em;
    & > label {
        padding: 5px 10px;
        border-radius: 25px;
        border: 1px solid;
        cursor: pointer;
        position: relative;
        width: 10em;
        text-align: right;
        padding-right: 3em;
        & > input {
            position: absolute;
            right: 1.75em;
            top: 0.55em;
        }
    }
}
/**STASH**/
#stash-count-notice {
    color: #F44;
    font-weight: bold;
    font-size: 80%;
    &:hover {
        color: #F88;
    }
}
/**FOOTER**/
#upload-counts-restore {
    display: none;
    &.stashed {
        display: inline-block;
    }
}
#restore-count-notice {
    color: mediumseagreen;
    &:hover {
        filter: brightness(1.1);
    }
}`;

const LIGHT_MODE_CSS = Template.normalizeCSS({theme: 'light'})`
#upload-counts {
    border-color: var(--grey-1);
    &.opened {
        border-color: var(--grey-2);
    }
}
#count-module {
    border-bottom-color: var(--grey-2);
}
#count-header {
    th {
        &:not(:first-of-type) {
            background-color: var(--grey-2);
            border-left-color: var(--grey-5);
        }
    }
    a {
        background-color: var(--white);
        &:hover {
            color: grey;
        }
    }
}
#count-body td:not(:first-of-type) {
    background-color: lightcyan;
    border-left-color: var(--grey-2);
}
#count-query-user > label {
    background-color: var(--grey-2);
    border-color: var(--grey-4);
    &:hover {
        background-color:  var(--grey-1);
    }
}
.cu-svg-icon {
    fill: var(--black);
}`;

const DARK_MODE_CSS = Template.normalizeCSS({theme: 'dark'})`
#upload-counts {
    border-color: var(--grey-8);
    &.opened {
        border-color: var(--grey-7);
    }
}
#count-module {
    border-bottom-color: var(--grey-7);
}
#count-header {
    th {
        &:not(:first-of-type) {
            background-color: var(--grey-7);
            border-left-color: var(--grey-4);
        }
    }
    a {
        background-color: var(--black);
        &:hover {
            color: grey;
        }
    }
}
#count-body td:not(:first-of-type) {
    background-color: darkcyan;
    border-left-color: var(--grey-7);
}
#count-query-user > label {
    background-color: var(--grey-7);
    border-color: var(--grey-5);
    &:hover {
        background-color:  var(--grey-8);
    }
}
.cu-svg-icon {
    fill: var(--white);
}`;

//HTML constants

const CARET_RIGHT = '<svg class="cu-svg-caret cu-svg-caret-right" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 512" width="20" height="20"><path class="cu-svg-icon" d="M246.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-128-128c-9.2-9.2-22.9-11.9-34.9-6.9s-19.8 16.6-19.8 29.6l0 256c0 12.9 7.8 24.6 19.8 29.6s25.7 2.2 34.9-6.9l128-128z"/></svg>';
const CARET_DOWN = '<svg class="cu-svg-caret cu-svg-caret-down" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" height="20" width="20"><path class="cu-svg-icon" d="M137.4 374.6c12.5 12.5 32.8 12.5 45.3 0l128-128c9.2-9.2 11.9-22.9 6.9-34.9s-16.6-19.8-29.6-19.8L32 192c-12.9 0-24.6 7.8-29.6 19.8s-2.2 25.7 6.9 34.9l128 128z"/></svg>';

const notice_box = Template.normalizeHTML()`
<div id="upload-counts">
    <div id="count-module">
        <div id="count-table">
            <div id="count-header"></div>
            <div id="count-body"></div>
            <div id="count-order"></div>
            <div id="count-chart" style="display: none;"></div>
            <div id="count-controls"></div>
        </div>
        <div id="count-copyrights" style="display: none;">
            <div id="count-copyrights-header"><a class="cu-triangle cu-triangle-right">${CARET_RIGHT}${CARET_DOWN}</a>Copyrights<span id="count-copyrights-counter"></span></div>
            <div id="count-copyrights-section" style="display: none;">
                <div id="count-copyrights-controls"></div>
                <div id="count-copyrights-list"></div>
                <div id="count-copyrights-manual" style="display: none;">
                    <input id="count_query_copyright" placeholder="Check copyright" type="text">
                    <input id="count_add_copyright" type="submit" value="Add" class="btn">
                </div>
            </div>
        </div>
        <div id="count-query-user" style="display: flex; gap: 0.5em;">
            <input id="count_query_user_id" placeholder="Check users" type="text">
            <input id="count_submit_user_id" type="submit" value="Submit" class="btn">
            <input id="count_refresh_user_id" type="submit" value="Refresh" class="btn">
            <label for="count_approver_select">
                Approvals
                <input id="count_approver_select" class="cu-program-checkbox" type="checkbox">
            </label>
            <label for="count_override_select">
                Override
                <input id="count_override_select" class="cu-program-checkbox" type="checkbox">
            </label>
        </div>
    </div>
    <div id="upload-counts-toggle">
        <a id="toggle-count-notice" class="cu-link">Toggle Upload Table</a>&nbsp;(<a id="stash-count-notice" class="cu-link">STASH</a>)
    </div>
</div>
`;

const unstash_notice = `<span id="upload-counts-restore"> - <a id="restore-count-notice" class="cu-link">Restore ${PROGRAM_NAME}</a></span>`;

const copyright_counter = '(<span id="loading-counter">...</span>)';

const CACHE_DATA_DETAILS = Template.normalizeHTML()`
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

const PROGRAM_DATA_DETAILS = Template.normalizeHTML()`
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

const TOOLTIP_DATA_TEMPLATE = Template.normalizeHTML({template: true})`
<div class="cu-tooltip" data-period="${'period'}">
    <span class="cu-uploads">${'text'}</span>
    ${'popups'}
</div>`;

const TOOLTIP_POPUP_TEMPLATE = Template.normalizeHTML({template: true})`
<span class="cu-tooltiptext" data-type="${'metric'}">
    ${'text'}
</span>`;

const TOOLTIP_CONTROL_TEMPLATE = Template.normalizeHTML({template: true})`
<span class="cu-select-tooltip cu-switch-control" data-type="${'metric'}">
    <a class="cu-link">${'text'}</a>
</span>`;

const COPYRIGHT_CONTROL_TEMPLATE = Template.normalizeHTML({template: true})`
<span class="cu-select-period cu-switch-control" data-type="${'period'}">
    <a class="cu-link">${'text'}</a>
</span>`;

const COPYRIGHT_TAG_TEMPLATE = Template.normalizeHTML({template: true})`
<span title="${'copyright'}" data-copyright="${'copyright'}" class="${'classname'}">
    ${'taglink'}
</span>`;

//Time periods
const timevalues = ['d', 'w', 'mo', 'y', 'at'];
const manual_periods = ['w', 'mo'];
const limited_periods = ['y', 'at'];
const copyright_periods = ['d', 'w', 'mo'];

//Period constants
const period_info = {
    countexpires: {
        d: 5 * Utility.one_minute,
        w: Utility.one_hour,
        mo: Utility.one_day,
        y: Utility.one_week,
        at: Utility.one_month
    },
    uploadexpires: {
        d: 5 * Utility.one_minute,
        w: Utility.one_day,
        mo: Utility.one_week,
        y: Utility.one_month,
        at: Utility.one_year
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
        w: Utility.one_day,
        mo: Utility.one_day,
        y: Utility.one_month,
        at: Utility.one_month,
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
const prune_expires = Utility.one_day;
const rti_expiration = Utility.one_month;
const JQUERY_DELAY = 1; //For jQuery updates that should not be done synchronously

//Network call configuration
const max_post_limit_query = 100;

//Metrics used by statistics functions
const tooltip_metrics = ['score', 'upscore', 'downscore', 'favcount', 'tagcount', 'gentags', 'week', 'day'];
const chart_metrics = ['score', 'upscore', 'downscore', 'favcount', 'tagcount', 'gentags'];

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
    countentry: Validate.counting_constraints,
    implicationentry: Validate.counting_constraints,
    postentries: Validate.array_constraints,
    statentries: Validate.hash_constraints,
    postentry: [
        Validate.integer_constraints, //ID
        Validate.integer_constraints, //SCORE
        Validate.integer_constraints, //UPSCORE
        Validate.integer_constraints, //DOWNSCORE
        Validate.integer_constraints, //FAVCOUNT
        Validate.integer_constraints, //TAGCOUNT
        Validate.integer_constraints, //GENTAGS
        Validate.stringonly_constraints, //COPYRIGHTS
        Validate.integer_constraints //CREATED
    ],
    postmetric: {
        chart_data: Validate.hash_constraints,
        score: Validate.hash_constraints,
        upscore: Validate.hash_constraints,
        downscore: Validate.hash_constraints,
        favcount: Validate.hash_constraints,
        tagcount: Validate.hash_constraints,
        gentags: Validate.hash_constraints,
        week: Validate.array_constraints,
        day: Validate.array_constraints
    },
    timestat: Validate.basic_number_validator,
    poststat: {
        max: Validate.integer_constraints,
        average: Validate.number_constraints,
        stddev: Validate.number_constraints,
        outlier: Validate.integer_constraints,
        adjusted: Validate.number_constraints
    },
    chartentry: {
        score: Validate.array_constraints,
        upscore: Validate.array_constraints,
        downscore: Validate.array_constraints,
        favcount: Validate.array_constraints,
        tagcount: Validate.array_constraints,
        gentags: Validate.array_constraints,
        uploads: Validate.array_constraints
    },
    chartdata: {
        x: Validate.integer_constraints,
        y: Validate.number_constraints
    }
};

/**FUNCTIONS**/

//Validation functions

function BuildValidator(validation_key) {
    return {
        expires: Validate.expires_constraints,
        value: validation_constraints[validation_key]
    };
}

function ValidateEntry(key, entry) {
    let printer = Debug.getFunctionPrint('ValidateEntry');
    if (!Validate.validateIsHash(key, entry)) {
        return false;
    }
    if (key.match(/^ct(d|w|mo|y|at)?-/)) {
        return Validate.validateHashEntries(key, entry, BuildValidator('countentry'));
    }
    if (key.match(/^rti-/)) {
        return Validate.validateHashEntries(key, entry, BuildValidator('implicationentry'));
    }
    if (key.match(/^(daily|weekly|monthly|previous)-(uploads|approvals)-/)) {
        if (!Validate.validateHashEntries(key, entry, BuildValidator('postentries'))) {
            return false;
        }
        return ValidatePostentries(key + '.value', entry.value);
    }
    if (key.match(/^(yearly|alltime)-(uploads|approvals)-/)) {
        if (!Validate.validateHashEntries(key, entry, BuildValidator('statentries'))) {
            return false;
        }
        return ValidateStatEntries(key + '.value', entry.value);
    }
    printer.log("Bad key!");
    return false;
}

function ValidatePostentries(key, postentries) {
    for (let i = 0;i < postentries.length;i++){
        let value_key = key + `[${i}]`;
        if (!Validate.validateIsArray(value_key, postentries[i], {is: validation_constraints.postentry.length})) {
            return false;
        }
        //It's technically not a hash, although it works since arrays can be treated like one
        if (!Validate.validateHashEntries(value_key, postentries[i], validation_constraints.postentry)) {
            return false;
        }
    }
    return true;
}

function ValidateStatEntries(key, statentries) {
    if (!Validate.validateHashEntries(key, statentries, validation_constraints.postmetric)) {
        return false;
    }
    for (let i = 0; i < tooltip_metrics.length; i++) {
        let metric = tooltip_metrics[i];
        let metric_key = key + '.' + metric;
        if (metric === 'week' || metric === 'day') {
            if (!Validate.validateArrayValues(metric_key, statentries[metric], validation_constraints.timestat)) {
                return false;
            }
        } else if (!Validate.validateHashEntries(metric_key, statentries[metric], validation_constraints.poststat)) {
            return false;
        }
    }
    return ValidateChartEntries(key + '.chart_data', statentries.chart_data);
}

function ValidateChartEntries(key, chartentries) {
    if (!Validate.validateHashEntries(key, chartentries, validation_constraints.chartentry)) {
        return false;
    }
    for (let chart_key in chartentries) {
        for (let i = 0; i < chartentries[chart_key].length; i ++) {
            if (!Validate.validateHashEntries(`${key}.${chart_key}[${i}]`, chartentries[chart_key][i], validation_constraints.chartdata)) {
                return false;
            }
        }
    }
    return true;
}

function ValidateProgramData(key, entry) {
    var checkerror = [];
    switch (key) {
        case 'cu-user-settings':
            checkerror = Menu.validateUserSettings(entry, SETTINGS_CONFIG);
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
            if (!Utility.isBoolean(entry)) {
                checkerror = ['Value is not a boolean.'];
            }
            break;
        default:
            checkerror = ["Not a valid program data key."];
    }
    if (checkerror.length) {
        Validate.outputValidateError(key, checkerror);
        return false;
    }
    return true;
}

//Render functions

//Render table

function RenderHeader() {
    var tabletext = Utility.renderHTMLTag('th', 'Name');
    let click_periods = manual_periods.concat(limited_periods);
    let times_shown = GetShownPeriodKeys();
    times_shown.forEach((period) => {
        let header = period_info.header[period];
        if (click_periods.includes(period)) {
            let is_available = CU.period_available[CU.usertag][CU.current_username][period];
            let link_class = (manual_periods.includes(period) ? 'cu-manual' : 'cu-limited');
            let header_class = (!is_available ? 'cu-process' : '');
            let counter_html = (!is_available ? '<span class="cu-display" style="display:none">&nbsp;(<span class="cu-counter">...</span>)</span>' : '');
            tabletext += Utility.renderHTMLTag('th', `<a class="cu-link ${link_class}">${header}</a>${counter_html}`, {class: `cu-period-header ${header_class}`, dataPeriod: period});
        } else {
            tabletext += Utility.renderHTMLTag('th', header, {class: 'cu-period-header', dataPeriod: period});
        }
    });
    tabletext = Utility.renderHTMLTag('tr', tabletext);
    return Utility.renderHTMLTag('thead', tabletext);
}

function RenderBody() {
    if (CU.active_copytags.length > 5) {
        $("#count-body").addClass("overflowed");
    } else {
        $("#count-body").removeClass("overflowed");
    }
    var tabletext = RenderRow('');
    for (let i = 0;i < CU.active_copytags.length; i++) {
        tabletext += RenderRow(CU.active_copytags[i]);
    }
    return Utility.renderHTMLTag('tbody', tabletext);
}

function RenderRow(key) {
    var row_tag, row_text, classname;
    if (key === '') {
        row_tag = `${CU.usertag}:` + CU.display_username;
        row_text = CU.display_username;
        let normalized_level = CU.level_string.toLowerCase();
        classname = `user-${normalized_level} with-style`;
    } else {
        row_tag = key;
        row_text = key;
        classname = 'tag-type-3';
    }
    var tabletext = Utility.renderHTMLTag('td', Danbooru.postSearchLink(row_text, {tags: row_tag}, {class: classname}));
    let times_shown = GetShownPeriodKeys();
    let click_periods = manual_periods.concat(limited_periods);
    for (let i = 0;i < times_shown.length; i++) {
        let period = times_shown[i];
        let data_text = GetTableValue(key, period);
        let is_limited = limited_periods.includes(period);
        let class_name = (!is_limited ? 'cu-hover' : '');
        if (click_periods.includes(period) && key === '') {
            class_name += (manual_periods.includes(period) ? ' cu-manual' : ' cu-limited');
        }
        let rowdata = {class: class_name, dataPeriod: period};
        let is_available = CU.period_available[CU.usertag][CU.current_username][period];
        if (is_available && is_limited && key === '') {
            tabletext += Utility.renderHTMLTag('td', RenderTooltipData(data_text, times_shown[i], true), rowdata);
        } else if (is_available && !is_limited) {
            tabletext += Utility.renderHTMLTag('td', RenderTooltipData(data_text, times_shown[i]), rowdata);
        } else {
            tabletext += Utility.renderHTMLTag('td', `<span class="cu-uploads">${data_text}</span>`, rowdata);
        }
    }
    return Utility.renderHTMLTag('tr', tabletext, {dataKey: key});
}

function RenderOrderMessage(period, sorttype) {
    let header = period_info.header[period];
    switch (sorttype) {
        case 1:
            return `Copyrights ordered by user postcount; ${header} period; L -> H`;
        case 2:
            return `Copyrights ordered by site postcount; ${header} period; H -> L`;
        case 3:
            return `Copyrights ordered by site postcount; ${header} period; L -> H`;
        case 0:
        default:
            return `Copyrights ordered by user postcount; ${header} period; H -> L`;
    }
}

//Get the data and validate it without checking the expires
function GetCountData(key, default_val = null) {
    let count_data = Storage.getIndexedSessionData(key);
    if (!ValidateEntry(key, count_data)) {
        return default_val;
    }
    return count_data.value;
}

function GetTableValue(key, type) {
    if (key === '') {
        return GetCountData('ct' + type + `-${CU.usertag}:` + CU.current_username, "N/A");
    }
    var useruploads = GetCountData('ct' + type + `-${CU.usertag}:` + CU.current_username + ' ' + key, "N/A");
    var alluploads = GetCountData('ct' + type + '-' + key, "N/A");
    return `(${useruploads}/${alluploads})`;
}

//Render copyrights

function RenderCopyrights(period) {
    let copytags = CU.user_copytags[CU.usertag][CU.current_username][period].sort();
    return copytags.map((copyright) => {
        let tag_text = Utility.maxLengthString(copyright);
        let taglink = Danbooru.postSearchLink(tag_text, {tags: copyright}, {class: 'tag-type-3'});
        let classname = CU.active_copytags.includes(copyright) ? 'cu-active-copyright' : '';
        return COPYRIGHT_TAG_TEMPLATE({copyright, taglink, classname});
    }).join('');
}

function RenderCopyrightControls() {
    let controls = copyright_periods.map((period) => {
        let period_name = period_info.longname[period];
        return COPYRIGHT_CONTROL_TEMPLATE({period, text: Utility.titleizeString(period_name)});
    });
    controls.push(COPYRIGHT_CONTROL_TEMPLATE({period: 'manual', text: 'Manual'}));
    return controls.join('');
}

//Render Tooltips

function RenderTooltipData(text, period, limited = false) {
    let popups = tooltip_metrics.map((metric) => {
        let text = (limited ? RenderStatistics('', metric, period, true) : '');
        return TOOLTIP_POPUP_TEMPLATE({metric, text});
    });
    return TOOLTIP_DATA_TEMPLATE({text, period, popups: popups.join('')});
}

function RenderAllTooltipControls() {
    return tooltip_metrics.map((metric) => TOOLTIP_CONTROL_TEMPLATE({metric, text: Utility.titleizeString(metric)})).join('');
}

function RenderStatistics(key, attribute, period, limited = false) {
    let period_key = GetPeriodKey(period_info.longname[period]);
    let data = Storage.getIndexedSessionData(period_key);
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
        stat = GetAllStatistics(uploads, attribute);
    } else {
        stat = stat[attribute];
    }
    return RenderAllStats(stat, attribute);
}

function RenderAllStats(stat, attribute) {
    switch (attribute) {
        case 'week':
            return RenderWeeklist(stat);
        case 'day':
            return RenderDaylist(stat);
        default:
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

function GetAllStatistics(posts, attribute) {
    switch (attribute) {
        case 'week':
            return GetWeekStatistics(posts);
        case 'day':
            return GetDayStatistics(posts);
        default:
            return GetPostStatistics(posts, attribute);
    }
}

function GetWeekStatistics(posts) {
    let week_days = new Array(7).fill(0);
    posts.forEach((upload) => {
        let timeindex = new Date(upload.created).getUTCDay();
        week_days[timeindex] += 1;
    });
    let week_stats = week_days.map((day) => {
        let percent = (100 * day / posts.length);
        return (percent === 0 || percent === 100 ? percent : Utility.setPrecision(percent, 1));
    });
    return week_stats;
}

function GetDayStatistics(posts) {
    let day_hours = new Array(6).fill(0);
    posts.forEach((upload) => {
        let timeindex = Math.floor(new Date(upload.created).getUTCHours() / 4);
        day_hours[timeindex] += 1;
    });
    let day_stats = day_hours.map((day) => {
        let percent = (100 * day / posts.length);
        return (percent === 0 || percent === 100 ? percent : Utility.setPrecision(percent, 1));
    });
    return day_stats;
}

function GetPostStatistics(posts, attribute) {
    let data = Utility.getObjectAttributes(posts, attribute);
    let data_max = Math.max(...data);
    let data_average = Statistics.average(data);
    let data_stddev = Statistics.standardDeviation(data);
    let data_outliers = Statistics.removeOutliers(data);
    let data_removed = data.length - data_outliers.length;
    let data_adjusted = Statistics.average(data_outliers);
    return {
        max: data_max,
        average: Utility.setPrecision(data_average, 2),
        stddev: Utility.setPrecision(data_stddev, 2),
        outlier: data_removed,
        adjusted: Utility.setPrecision(data_adjusted, 2)
    };
}

function AssignPostIndexes(period, posts, time_offset) {
    let points = period_info.points[period];
    //Have to do it this way to avoid getting the same object
    let periods = Utility.arrayFill(points, "[]");
    posts.forEach((post) => {
        let index = Math.floor((Date.now() - post.created - time_offset) / (period_info.divisor[period]));
        index = (points ? Math.min(points - 1, index) : index);
        index = Math.max(0, index);
        if (index >= periods.length) {
            periods = periods.concat(Utility.arrayFill(index + 1 - periods.length, "[]"));
        }
        periods[index].push(post);
    });
    return periods;
}

function GetPeriodAverages(indexed_posts, metric) {
    let period_averages = [];
    for (let index in indexed_posts) {
        if (!indexed_posts[index].length) continue;
        let data_point = {
            x: parseInt(index),
            y: Utility.setPrecision(Statistics.average(Utility.getObjectAttributes(indexed_posts[index], metric)), 2)
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
    items.sort((first, second) => (first[1] !== second[1] ? second[1] - first[1] : first[0].localeCompare(second[0])));
    return items.map((entry) => entry[0]);
}

function BuildTagParams(type, tag) {
    return (type === 'at' ? '' : ('age:..1' + type + ' ')) + tag;
}

function GetCopyrightCount(posts) {
    let copyright_count = {};
    posts.forEach((post) => {
        post.copyrights.split(' ').forEach((tag) => {
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

function CompareCopyrightCounts(dict1, dict2) {
    let difference = [];
    Utility.arrayUnion(Object.keys(dict1), Object.keys(dict2)).forEach((key) => {
        if (!Utility.arrayEquals(dict1[key], dict2[key])) {
            difference.push(key);
        }
    });
    return difference;
}

function CheckCopyrightVelocity(tag) {
    var dayuploads = Storage.getIndexedSessionData('ctd-' + tag);
    var weekuploads = Storage.getIndexedSessionData('ctw-' + tag);
    if (dayuploads === null || weekuploads === null) {
        return true;
    }
    var day_gettime = dayuploads.expires - period_info.countexpires.d; //Time data was originally retrieved
    var week_velocity = (Utility.one_week) / (weekuploads.value | 1); //Milliseconds per upload
    var adjusted_poll_interval = Math.min(week_velocity, Utility.one_day); //Max wait time is 1 day
    return Date.now() > day_gettime + adjusted_poll_interval;
}

async function MergeCopyrightTags(user_copytags) {
    let query_implications = Utility.arrayDifference(user_copytags, Object.keys(CU.reverse_implications));
    let promise_array = query_implications.map((key) => GetReverseTagImplication(key));
    let reverse_implications = await Promise.all(promise_array);
    query_implications.forEach((key, i) => {
        CU.reverse_implications[key] = reverse_implications[i];
    });
    return user_copytags.filter((value) => (CU.reverse_implications[value] === 0));
}

function IsMissingTag(tag) {
    return GetShownPeriodKeys().reduce((total, period) => (total || !GetCountData(`ct${period}-${tag}`)), false);
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
    return Promise.all(CU.user_settings.periods_shown.map((period) => GetCount(longname_key[period], tag)));
}

function GetPeriodKey(period_name) {
    return `${period_name}-${CU.counttype}-${CU.current_username}`;
}

function CheckPeriodUploads() {
    let promise_array = [];
    const checkPeriod = (key, period, check) => {
        CU.period_available[CU.usertag][CU.current_username][period] = Boolean(check);
        if (!check) {
            Storage.removeIndexedSessionData(key);
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
        let check_promise = Storage.checkLocalDB(data_key, {max_expires}).then((check) => {checkPeriod(data_key, period, check);});
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
        CU.active_copytags = Utility.dataCopy(CU.user_copytags[CU.usertag][CU.current_username].daily);
        await CheckPeriodUploads(CU.current_username);
        InitializeTable();
    } else {
        TableMessage(`<div id="empty-uploads">${CU.empty_uploads_message}</div>`);
    }
    PopulateTable.is_started = false;
}

function InitializeControls() {
    const printer = Debug.getFunctionPrint('InitializeControls');
    //Render the controls only once when the table is first opened
    if (!CU.controls_initialized) {
        $("#count-controls").html(RenderAllTooltipControls());
        $("#count-copyrights-controls").html(RenderCopyrightControls());
        $(".cu-select-tooltip").on(JSPLib.event.click, TooltipChange);
        $(".cu-select-period a").on(JSPLib.event.click, CopyrightPeriod);
        $("#count-copyrights-header a").on(JSPLib.event.click, ToggleCopyrightsSection);
        $("#count_submit_user_id").on(JSPLib.event.click, CheckUser);
        $("#count_refresh_user_id").on(JSPLib.event.click, RefreshUser);
        $("#count_add_copyright").on(JSPLib.event.click, AddCopyright);
        CU.controls_initialized = true;
        Load.scriptWaitExecute(CU, 'IAC', {
            available: () => {
                CU.IAC.InitializeProgramValues(true);
                CU.IAC.InitializeAutocompleteIndexed("#count_query_user_id", 'us');
                printer.logLevel('Initialized CU input autocomplete: #count_query_user_id', Debug.DEBUG);
            },
            fallback: () => {
                printer.logLevel('Unable to initialize textarea autocomplete: #count_query_user_id', Debug.DEBUG);
            },
        });
    }
}

function InitializeTable() {
    $("#count-header").html(Utility.renderHTMLTag('table', RenderHeader(), {class: 'striped'}));
    $("#count-body").html(Utility.renderHTMLTag('table', RenderBody(), {class: 'striped'}));
    $("#count-order").html(RenderOrderMessage("d", 0));
    $("#count-header .cu-process").on(JSPLib.event.click, GetPeriod);
    $("#count-header th").on(JSPLib.event.click, SortTable);
    $("#count-body .cu-manual,#count-body .cu-limited").on(JSPLib.event.click, RenderChart);
    $("#count-controls,#count-copyrights,#count-header").show();
    $(`.cu-select-tooltip[data-type="${CU.current_metric}"] a`).click();
    CU.sorttype = 0;
    CU.sortperiod = "d";
    if (CU.copyright_period) {
        $(`.cu-select-period[data-type="${CU.copyright_period}"] a`).click();
    }
    CU.shown_copytags = Utility.dataCopy(CU.active_copytags);
}

function TableMessage(message) {
    $("#count-body").html(message);
    $("#count-controls,#count-copyrights,#count-header,#count-chart").hide();
}

//Network functions

async function GetReverseTagImplication(tag) {
    let printer = Debug.getFunctionPrint('GetReverseTagImplication');
    var key = 'rti-' + tag;
    var check = await Storage.checkLocalDB(key, {max_expires: rti_expiration});
    if (!(check)) {
        printer.log("Network:", key);
        let data = await Danbooru.submitRequest('tag_implications', {search: {antecedent_name: tag}, only: id_field}, {default_val: [], key});
        Storage.saveData(key, {value: data.length, expires: Utility.getExpires(rti_expiration)});
        return data.length;
    }
    return check.value;
}

async function GetCount(type, tag) {
    let printer = Debug.getFunctionPrint('GetCount');
    let max_expires = period_info.countexpires[type];
    var key = 'ct' + type + '-' + tag;
    var check = await Storage.checkLocalDB(key, {max_expires});
    if (!(check)) {
        printer.log("Network:", key);
        return Danbooru.submitRequest('counts/posts', {tags: BuildTagParams(type, tag), skip_cache: true}, {default_val: {counts: {posts: 0}}, key})
            .then((data) => {
                Storage.saveData(key, {value: data.counts.posts, expires: Utility.getExpires(max_expires)});
            });
    }
}

async function GetPeriodUploads(username, period, limited = false, domname = null) {
    let printer = Debug.getFunctionPrint('GetPeriodUploads');
    let period_name = period_info.longname[period];
    let max_expires = period_info.uploadexpires[period];
    let key = GetPeriodKey(period_name);
    var check = await Storage.checkLocalDB(key, {max_expires});
    if (!(check)) {
        printer.log(`Network (${period_name} ${CU.counttype})`);
        let data = await Danbooru.getPostsCountdown(BuildTagParams(period, `${CU.usertag}:${username}`), max_post_limit_query, post_fields, domname);
        let mapped_data = MapPostData(data);
        if (limited) {
            let indexed_posts = AssignPostIndexes(period, mapped_data, 0);
            mapped_data = Utility.mergeHashes(...tooltip_metrics.map((metric) => ({[metric]: GetAllStatistics(mapped_data, metric)})));
            mapped_data.chart_data = Utility.mergeHashes(...chart_metrics.map((metric) => ({[metric]: GetPeriodAverages(indexed_posts, metric)})));
            mapped_data.chart_data.uploads = GetPeriodPosts(indexed_posts);
            Storage.saveData(key, {value: mapped_data, expires: Utility.getExpires(max_expires)});
        } else {
            Storage.saveData(key, {value: PreCompressData(mapped_data), expires: Utility.getExpires(max_expires)});
        }
        return mapped_data;
    }
    return (limited ? check.value : PostDecompressData(check.value));
}

//Event handlers

async function GetPeriod(event) {
    let header = event.target.parentElement;
    let is_limited = $(event.target).hasClass("cu-limited");
    let period = header.dataset.period;
    $(`#count-header th[data-period=${period}] .cu-display`).show();
    await GetPeriodUploads(CU.current_username, period, is_limited, `#count-header th[data-period=${period}] .cu-counter`);
    CU.period_available[CU.usertag][CU.current_username][period] = true;
    let column = header.cellIndex;
    let $cells = $(`#count-body td:nth-of-type(${column + 1})`);
    if (is_limited) {
        let value = $(".cu-uploads", $cells[0]).html();
        $($cells[0]).html(RenderTooltipData(value, period, true));
    } else {
        $cells.each((_i, cell) => {
            let value = $(".cu-uploads", cell).html();
            $(cell).html(RenderTooltipData(value, period));
        });
        $(`.cu-select-tooltip[data-type="${CU.current_metric}"] a`).click();
    }
    $(`#count-header th[data-period=${period}] .cu-display`).hide();
    $(`.cu-select-tooltip[data-type="${CU.current_metric}"] a`).click();
    $(event.target).off(JSPLib.event.click);
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
    $("#count-body tr").each((i, row) => {
        if (i === 0) {
            return;
        }
        let data = $(`td:nth-of-type(${column}) .cu-uploads`, row).html();
        let posts = data.match(/\((\d+)\/(\d+)\)/).slice(1, 3).map(Number);
        rows.push({
            domobj: $(row).detach(),
            posts
        });
    });
    rows.sort((a, b) => {
        switch (CU.sorttype) {
            case 1:
                return b.posts[1] - a.posts[1];
            case 2:
                return a.posts[1] - b.posts[1];
            case 3:
                return b.posts[0] - a.posts[0];
            case 0:
            default:
                return a.posts[0] - b.posts[0];
        }
    }).forEach((row) => {
        $("#count-body tbody").append(row.domobj);
    });
    CU.sorttype = (CU.sorttype + 1) % 4;
    $("#count-order").html(RenderOrderMessage(period, CU.sorttype));
}

function RenderChart(event) {
    if (event.target.tagName !== "TD") {
        return;
    }
    if (!chart_metrics.includes(CU.current_metric)) {
        Notice.notice("Chart data not available on Day and Week metrics.");
        return;
    }
    let period = $(event.target).data('period');
    let is_limited = $(event.target).hasClass("cu-limited");
    let longname = period_info.longname[period];
    let points = period_info.points[period];
    let period_key = GetPeriodKey(longname);
    let data = Storage.getIndexedSessionData(period_key);
    if (!data || (!is_limited && data.value.length === 0) || (is_limited && !data.value.chart_data)) {
        Notice.notice(`${period_info.header[period]} period not populated! Click the period header to activate the chart.`);
        return;
    }
    var period_averages, period_uploads;
    if (!is_limited) {
        let time_offset = Date.now() - (data.expires - period_info.uploadexpires[period]);
        let posts = PostDecompressData(data.value);
        let indexed_posts = AssignPostIndexes(period, posts, time_offset);
        period_averages = GetPeriodAverages(indexed_posts, CU.current_metric);
        period_uploads = GetPeriodPosts(indexed_posts);
    } else {
        period_averages = data.value.chart_data[CU.current_metric];
        period_uploads = data.value.chart_data.uploads;
    }
    let metric_display = Utility.displayCase(CU.current_metric);
    let type_display = Utility.displayCase(CU.counttype);
    let chart_data = {
        title: {
            text: `${Utility.displayCase(longname)} ${CU.counttype} - Average post ${CU.current_metric}`
        },
        axisX: {
            title: period_info.xlabel[period],
            minimum: 0,
            maximum: (points ? points - 1 : period_uploads.slice(-1)[0].x)
        },
        axisY: {
            title: `${metric_display}`
        },
        axisY2: {
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
    var chart = new CanvasJS.Chart("count-chart", chart_data);
    chart.render();
    $(".canvasjs-chart-credit").css('top', "400px");
}

function TooltipChange(event) {
    CU.current_metric = $(event.target.parentElement).data('type');
    $(".cu-select-tooltip").removeClass("cu-active-control");
    $(`.cu-select-tooltip[data-type="${CU.current_metric}"]`).addClass("cu-active-control");
    $(".cu-tooltiptext").removeClass("cu-activetooltip");
    $(`.cu-tooltiptext[data-type="${CU.current_metric}"]`).addClass("cu-activetooltip");
    Storage.setLocalData('cu-current-metric', CU.current_metric);
    $(".cu-hover .cu-uploads").off(JSPLib.event.mouseover).on(JSPLib.event.mouseover, TooltipHover);
    event.preventDefault();
}

function ToggleCopyrightsSection(event) {
    $(event.target).closest('a').toggleClass("cu-triangle-right cu-triangle-down");
    $('#count-copyrights-section').slideToggle(100);
}

function ToggleCopyrightTag(event) {
    let $container = $(event.target.parentElement);
    $container.toggleClass("cu-active-copyright");
    let copyright = $container.data('copyright');
    if ($container.hasClass("cu-active-copyright")) {
        CU.active_copytags.push(copyright);
    } else {
        CU.active_copytags.splice(CU.active_copytags.indexOf(copyright), 1);
    }
    event.preventDefault();
}

async function CopyrightPeriod(event) {
    let $container = $(event.target.parentElement);
    let short_period = CU.copyright_period = $container.data('type');
    $(".cu-select-period").removeClass("cu-active-control");
    $container.addClass("cu-active-control");
    if (short_period === 'manual') {
        $("#count-copyrights-manual").show();
        $('#count-copyrights-list').html(RenderCopyrights('manual'));
        $("#count-copyrights-list a").off(JSPLib.event.click).on(JSPLib.event.click, ToggleCopyrightTag);
    } else {
        $("#count-copyrights-manual").hide();
        let current_period = period_info.longname[short_period];
        let is_period_enabled = CU.period_available[CU.usertag][CU.current_username][short_period];
        if (is_period_enabled) {
            if (CU.user_copytags[CU.usertag][CU.current_username][current_period] === undefined) {
                let period_key = GetPeriodKey(current_period);
                let data = Storage.getIndexedSessionData(period_key);
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
                $("#count-copyrights-list a").off(JSPLib.event.click).on(JSPLib.event.click, ToggleCopyrightTag);
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
            CU.level_string = (CU.username === "Anonymous" ? 'Member' : DanbooruProxy.CurrentUser.data('level-string'));
            CU.usertag = 'user';
            PopulateTable();
        }
        CU.channel.postMessage({type: "show"});
    } else {
        CU.hidden = true;
        $('#upload-counts').removeClass('opened');
        $('.cu-program-checkbox').prop('checked', false);
        $("#count-chart").hide();
        CU.channel.postMessage({type: "hide"});
    }
    Storage.setLocalData('cu-hide-current-uploads', CU.hidden);
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
        $("#count-chart").hide();
        CU.channel.postMessage({type: "stash"});
    }
    Storage.setLocalData('cu-stash-current-uploads', CU.stashed);
    Storage.setLocalData('cu-hide-current-uploads', CU.hidden);
    event.preventDefault();
}

async function RefreshUser() {
    $("#count-copyrights-counter").html(copyright_counter);
    let diff_tags = Utility.arrayDifference(CU.active_copytags, CU.shown_copytags);
    let promise_array = [];
    diff_tags.forEach((val) => {
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
            check_user = await Danbooru.submitRequest('users', {search: {name_matches: check_username}, only: user_fields, expiry: 30});
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
    let tagdata = await Danbooru.submitRequest('tags', {search: {name: tag}, only: name_field}, {default_val: []});
    if (tagdata.length === 0) {
        Notice.notice('Tag not valid');
        return;
    }
    tag = tagdata[0].name;
    user_copytags.manual.push(tag);
    user_copytags.manual = Utility.arrayUnique(user_copytags.manual);
    CU.active_copytags.push(tag);
    CU.active_copytags = Utility.arrayUnique(CU.active_copytags);
    $('#count-copyrights-list').html(RenderCopyrights('manual'));
    $("#count-copyrights-list a").off(JSPLib.event.click).on(JSPLib.event.click, ToggleCopyrightTag);
}

function TooltipHover(event) {
    let container = event.target.parentElement;
    let $tooltip_text = $(".cu-activetooltip", container);
    let tooltip_key = $(container.parentElement.parentElement).data('key');
    let tooltip_period = $(container).data('period');
    let tooltip_metric = $(".cu-activetooltip", container).data('type');
    $tooltip_text.html("Loading!");
    $tooltip_text.html(RenderStatistics(tooltip_key, tooltip_metric, tooltip_period));
    $(event.target).off();
}

//Main execution functions

async function ProcessUploads() {
    var promise_array = [];
    var current_uploads = [];
    var user_copytags = [];
    if (CU.current_username !== "Anonymous") {
        current_uploads = await GetPeriodUploads(CU.current_username, 'd');
    }
    let previous_key = GetPeriodKey("previous");
    if (current_uploads.length) {
        let is_new_tab = Storage.getIndexedSessionData(previous_key) === null;
        let previous_uploads = await Storage.checkLocalDB(previous_key, {default_val: {value: []}});
        previous_uploads = PostDecompressData(previous_uploads.value);
        let current_ids = Utility.getObjectAttributes(current_uploads, 'id');
        let previous_ids = Utility.getObjectAttributes(previous_uploads, 'id');
        if (is_new_tab || !Utility.arrayEquals(current_ids, previous_ids) || IsMissingTag(`${CU.usertag}:${CU.current_username}`)) {
            promise_array.push(GetTagData(`${CU.usertag}:${CU.current_username}`));
        }
        if (CU.is_gold_user && CU.copyrights_enabled) {
            let curr_copyright_count = GetCopyrightCount(current_uploads);
            let prev_copyright_count = GetCopyrightCount(previous_uploads);
            user_copytags = SortDict(curr_copyright_count);
            if (CU.copyrights_merge) {
                user_copytags = await MergeCopyrightTags(user_copytags);
            }
            if (CU.copyrights_threshold) {
                user_copytags = user_copytags.slice(0, CU.copyrights_threshold);
            }
            let copyright_symdiff = CompareCopyrightCounts(curr_copyright_count, prev_copyright_count);
            let copyright_changed = (is_new_tab ? user_copytags : Utility.arrayIntersection(user_copytags, copyright_symdiff));
            let copyright_nochange = (is_new_tab ? [] : Utility.arrayDifference(user_copytags, copyright_changed));
            copyright_nochange.forEach((val) => {
                if (CheckCopyrightVelocity(val) || IsMissingTag(val)) {
                    promise_array.push(GetTagData(val));
                }
                if (IsMissingTag(`${CU.usertag}:${CU.current_username} ${val}`)) {
                    promise_array.push(GetTagData(`${CU.usertag}:${CU.current_username} ${val}`));
                }
            });
            copyright_changed.forEach((val) => {
                promise_array.push(GetTagData(`${CU.usertag}:${CU.current_username} ${val}`));
                promise_array.push(GetTagData(val));
            });
        }
        await Promise.all(promise_array);
    } else if (IsMissingTag(`${CU.usertag}:${CU.current_username}`)) {
        await GetTagData(`${CU.usertag}:${CU.current_username}`);
    }
    CU.user_copytags[CU.usertag][CU.current_username] = {daily: user_copytags, manual: []};
    Storage.saveData(previous_key, {value: PreCompressData(current_uploads), expires: 0});
    return current_uploads;
}

function CleanupTasks() {
    Storage.pruneProgramCache(PROGRAM_DATA_REGEX, prune_expires);
}

//Cache functions

function OptionCacheDataKey(data_type) {
    CU.data_period = $("#cu-control-data-period").val();
    if (data_type === "reverse_implication") {
        return 'rti-';
    }
    if (data_type === "count") {
        if (CU.data_period === "previous") {
            CU.data_value = "";
            return "";
        }
        let shortkey = (CU.data_period !== "" ? longname_key[CU.data_period] : "");
        return `ct${shortkey}-`;
    }
    return `${CU.data_period}-${data_type}-`;
}

//Settings functions

function BroadcastCU(ev) {
    let printer = Debug.getFunctionPrint('BroadcastCU');
    printer.log(`(${ev.data.type}):`, ev.data);
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

function InitializeProgramValues() {
    Object.assign(CU, {
        username: DanbooruProxy.CurrentUser.data('name'),
        is_gold_user: DanbooruProxy.CurrentUser.data('is-gold'),
        current_metric: Storage.checkLocalData('cu-current-metric', {default_val: 'score'}),
        hidden: Boolean(Storage.checkLocalData('cu-hide-current-uploads', {default_val: true})),
        stashed: Boolean(Storage.checkLocalData('cu-stash-current-uploads', {default_val: false})),
    });
    Load.setProgramGetter(CU, 'IAC', 'IndexedAutocomplete', 29.32);
    return true;
}

function RenderSettingsMenu() {
    $(Menu.program_selector).append(Menu.renderMenuFramework(MENU_CONFIG));
    $("#cu-general-settings").append(Menu.renderDomainSelectors());
    $("#cu-display-settings").append(Menu.renderCheckbox('copyrights_merge'));
    $("#cu-display-settings").append(Menu.renderCheckbox('copyrights_enabled'));
    $("#cu-display-settings").append(Menu.renderTextinput('copyrights_threshold', 10));
    $("#cu-display-settings").append(Menu.renderTextinput('postcount_threshold', 10));
    $("#cu-display-settings").append(Menu.renderInputSelectors('periods_shown', 'checkbox'));
    $('#cu-controls').append(Menu.renderCacheControls());
    $('#cu-cache-controls-message').append(Menu.renderExpandable("Cache Data details", CACHE_DATA_DETAILS));
    $("#cu-cache-controls").append(Menu.renderLinkclick('cache_info', true));
    $('#cu-cache-controls').append(Menu.renderCacheInfoTable());
    $("#cu-cache-controls").append(Menu.renderLinkclick('purge_cache', true));
    $('#cu-controls').append(Menu.renderCacheEditor(true));
    $('#cu-cache-editor-message').append(Menu.renderExpandable("Program Data details", PROGRAM_DATA_DETAILS));
    $("#cu-cache-editor-controls").append(Menu.renderKeyselect('data_source', true));
    $("#cu-cache-editor-controls").append(Menu.renderDataSourceSections());
    $("#cu-section-indexed-db").append(Menu.renderKeyselect('data_type', true));
    $("#cu-section-indexed-db").append(Menu.renderKeyselect('data_period', true));
    $("#cu-section-local-storage").append(Menu.renderCheckbox('raw_data', true));
    $("#cu-cache-editor-controls").append(Menu.renderTextinput('data_name', 20, true));
    Menu.engageUI({checkboxradio: true});
    $("#cu-select-periods-shown-daily").checkboxradio("disable"); //Daily period is mandatory
    Menu.saveUserSettingsClick();
    Menu.resetUserSettingsClick({delete_keys: LOCALSTORAGE_KEYS, local_callback: RemoteResetCallback});
    Menu.cacheInfoClick();
    Menu.purgeCacheClick();
    Menu.expandableClick();
    Menu.dataSourceChange();
    $("#cu-control-data-type").on(JSPLib.event.change, DataTypeChange);
    Menu.rawDataChange();
    Menu.getCacheClick(ValidateProgramData);
    Menu.saveCacheClick(ValidateProgramData, ValidateEntry);
    Menu.deleteCacheClick();
    Menu.listCacheClick();
    Menu.refreshCacheClick();
    Menu.cacheAutocomplete();
}

//Main program

function Main() {
    const preload = {
        run_on_settings: true,
        default_data: DEFAULT_VALUES,
        reset_data: PROGRAM_RESET_KEYS,
        initialize_func: InitializeProgramValues,
        broadcast_func: BroadcastCU,
        render_menu_func: RenderSettingsMenu,
        program_css: PROGRAM_CSS,
        light_css: LIGHT_MODE_CSS,
        dark_css: DARK_MODE_CSS,
    };
    if (!Menu.preloadScript(CU, preload)) return;

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
    $("#toggle-count-notice").on(JSPLib.event.click, ToggleNotice);
    $("#stash-count-notice,#restore-count-notice").on(JSPLib.event.click, StashNotice);
    if (CU.hidden === false) {
        //Set to opposite so that click can be used and sets it back
        CU.hidden = true;
        setTimeout(() => {$("#toggle-count-notice").click();}, JQUERY_DELAY);
    }
    Statistics.addPageStatistics();
    Load.noncriticalTasks(CleanupTasks);
}

/****Initialization****/

//Variables for JSPLib
JSPLib.name = PROGRAM_NAME;
JSPLib.shortcut = PROGRAM_SHORTCUT;
JSPLib.data = CU;

//Variables for debug.js
Debug.mode = false;
Debug.level = Debug.VERBOSE;

//Variables for menu.js
Menu.reset_data = PROGRAM_RESET_KEYS;
Menu.data_regex = PROGRAM_DATA_REGEX;
Menu.data_key = OptionCacheDataKey;
Menu.settings_config = SETTINGS_CONFIG;
Menu.control_config = CONTROL_CONFIG;

//Variables for danbooru.js
Danbooru.counter_domname = "#loading-counter";

//Variables for Storage.js
Storage.indexedDBValidator = ValidateEntry;
Storage.localSessionValidator = ValidateProgramData;

//Export JSPLib
Load.exportData();

/****Execution start****/

Load.programInitialize(Main, {required_variables: PROGRAM_LOAD_REQUIRED_VARIABLES, required_selectors: PROGRAM_LOAD_REQUIRED_SELECTORS});

})(JSPLib);
