// ==UserScript==
// @name         CurrentUploads
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      17.0
// @description  Gives up-to-date stats on uploads.
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        https://*.donmai.us/*
// @exclude      /^(?!https:\/\/\w+\.donmai\.us\/(static\/site_map|settings)\/?(\?|$)).*/
// @exclude      /^https://\w+\.donmai\.us/.*\.(xml|json|atom)(\?|$)/
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/CurrentUploads.user.js
// @updateURL    https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/CurrentUploads.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.10.0/localforage.min.js
// @require      https://cdn.jsdelivr.net/npm/localforage-getitems@1.4.2/dist/localforage-getitems.min.js
// @require      https://cdn.jsdelivr.net/npm/localforage-setitems@1.4.0/dist/localforage-setitems.min.js
// @require      https://cdn.jsdelivr.net/npm/localforage-removeitems@1.4.0/dist/localforage-removeitems.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.13.1/validate.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/canvasjs/1.7.0/canvasjs.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20260225/lib/module.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20260225/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20260225/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20260225/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20260225/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20260225/lib/template.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20260225/lib/concurrency.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20260225/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20260225/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20260225/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20260225/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20260225/lib/menu.js
// ==/UserScript==

/* global JSPLib $ CanvasJS */

/****Module import****/

(({DanbooruProxy, Debug, Notice, Utility, Storage, Template, Statistics, Validate, Danbooru, Load, Menu}) => {

const PROGRAM_NAME = 'CurrentUploads';
const PROGRAM_SHORTCUT = 'cu';
const DANBOORU_TOPIC_ID = 15169;

/****Library updates****/

////NONE

/****Global variables****/

//Module constants

const CU = {};

const DEFAULT_VALUES = {
    usertag: 'user',
    counttype: 'uploads',
    controls_initialized: false,
    copyright_period: 'd',
    populating_table: false,
};

const PROGRAM_RESET_KEYS = {
    checked_usernames: {},
    checked_users: {user: {}, approver: {}},
    user_copytags: {user: {}, approver: {}},
    period_available: {user: {}, approver: {}},
    reverse_implications: {},
};

const STORAGE_RESET_KEYS = [
    'cu-current-metric',
];

const PROGRAM_DATA_REGEX = /^rti-|ct(?:d|w|mo|y|at)-|(?:daily|weekly|monthly|yearly|alltime|previous)-(?:uploads|approvals)-/;

const LOAD_REQUIRED_VARIABLES = ['window.jQuery', 'window.Danbooru', 'Danbooru.CurrentUser'];
const LOAD_OPTIONAL_SELECTORS = ['#c-static #a-site-map', '#c-users #a-edit'];

//Setting constants

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
        allitems: ['daily', 'weekly', 'monthly', 'yearly', 'alltime'],
        get reset() {return this.allitems;},
        validate(data) {return (Menu.validateCheckboxRadio(data, 'checkbox', this.allitems, {min_length: 1}) && data.includes('daily'));},
        hint: "Select which periods to process and show."
    },
    copyrights_threshold: {
        reset: 0,
        parse: parseInt,
        validate: (data) => Menu.validateNumber(data, {integer: true, minimum: 0}),
        hint: "Maximum number of copyrights to display. Enter 0 to disable this threshold."
    },
    postcount_threshold: {
        reset: 0,
        parse: parseInt,
        validate: (data) => Menu.validateNumber(data, {integer: true, minimum: 0}),
        hint: "Minimum postcount to display copyright. Enter 0 to disable this threshold."
    }
};

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
        allitems: ['local_storage', 'indexed_db'],
        value: 'local_storage',
        hint: "Indexed DB is <b>Cache Data</b> and Local Storage is <b>Program Data</b>.",
    },
    data_type: {
        allitems: ['count', 'uploads', 'approvals', 'reverse_implication', 'custom'],
        value: 'count',
        hint: "Select type of data. Use <b>Custom</b> for querying by keyname.",
    },
    data_period: {
        allitems: ['daily', 'weekly', 'monthly', 'yearly', 'alltime', 'previous'],
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
};

//CSS Constants

const PROGRAM_CSS = Template.normalizeCSS()`
/**GENERAL**/
.cu-link {
    cursor: pointer;
}
.cu-monospace {
    font-family: monospace;
    font-size: 12px;
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
    margin-top: 1em;
    padding-top: 0.5em;
    padding-right: 0.5em;
    max-width: 80em;
    border-style: solid;
    border-width: 5px;
}
/**TABLE**/
#count-table {
    margin-left: 1em;
    td, th {
        text-align: center;
        &:first-of-type {
            text-align: left;
            word-break: break-all;
        }
        &:not(:first-of-type) {
            border-left: 1px solid;
        }
    }
}
#count-header {
    tr {
        border-bottom-width: 1px;
    }
    th {
        cursor: cell;
    }
    a {
        padding: 2px;
        border-radius: 5px;
    }
}
#count-body {
    &.overflowed {
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
    .cu-chart-cell {
        cursor: copy;
    }
    .cu-uploads {
        background-color: var(--body-background-color);
        padding: 0 5px;
        cursor: default;
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
}`;

const LIGHT_MODE_CSS = Template.normalizeCSS({theme: 'light'})`
#cu-uploads-report {
    color: var(--green-5);
}
#upload-counts {
    border-color: var(--grey-1);
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
    &.cu-chart-cell {
        background-color: palegreen;
    }
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
#cu-uploads-report {
    color: var(--green-4);
}
#upload-counts {
    border-color: var(--grey-8);
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
    &.cu-chart-cell {
        background-color: forestgreen;
    }
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

const MENU_LINK_HTML = '<li><a id="cu-uploads-report" class="cu-link">Uploads/Approvals</a></li>';

const CARET_RIGHT = '<svg class="cu-svg-caret cu-svg-caret-right" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 512" width="20" height="20"><path class="cu-svg-icon" d="M246.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-128-128c-9.2-9.2-22.9-11.9-34.9-6.9s-19.8 16.6-19.8 29.6l0 256c0 12.9 7.8 24.6 19.8 29.6s25.7 2.2 34.9-6.9l128-128z"/></svg>';
const CARET_DOWN = '<svg class="cu-svg-caret cu-svg-caret-down" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512" height="20" width="20"><path class="cu-svg-icon" d="M137.4 374.6c12.5 12.5 32.8 12.5 45.3 0l128-128c9.2-9.2 11.9-22.9 6.9-34.9s-16.6-19.8-29.6-19.8L32 192c-12.9 0-24.6 7.8-29.6 19.8s-2.2 25.7 6.9 34.9l128 128z"/></svg>';

const NOTICE_BOX_HTML = Template.normalizeHTML()`
<div id="upload-counts" style="display: none;">
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
                <input id="count_query_copyright" placeholder="Check copyright" type="text" autocomplete="off">
                <input id="count_add_copyright" type="submit" value="Add" class="btn">
            </div>
        </div>
    </div>
    <div id="count-query-user">
        <input id="count_query_user_id" placeholder="Check users" type="text" autocomplete="off">
        <input id="count_submit_user_id" type="submit" value="Submit" class="btn">
        <input id="count_refresh_user_id" type="submit" value="Refresh" class="btn">
        <label for="count_approver_select" title="Switch to checking approvals instead of uploads.">
            Approvals
            <input id="count_approver_select" class="cu-program-checkbox" type="checkbox">
        </label>
        <label for="count_override_select" title="Load table even if there were no uploads in the last 24 hours.">
            Override
            <input id="count_override_select" class="cu-program-checkbox" type="checkbox">
        </label>
    </div>
</div>
`;

const COUNTER_HTML = '(<span id="loading-counter">...</span>)';
const HEADER_COUNTER_HTML = '<span class="cu-display" style="display:none">&nbsp;(<span class="cu-counter">...</span>)</span>';

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
            <li><b>user-settings:</b> All configurable settings.</li>
        </ul>
    </li>
    <li>Status data
        <ul>
            <li><b>current-metric:</b> Which metric to show upon first opening the table.</li>
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

const WEEKLIST_TEMPLATE = Template.normalizeHTML({template: true})`
<ul class="cu-monospace">
    <li>Sun: ${'sunday'}</li>
    <li>Mon: ${'monday'}</li>
    <li>Tue: ${'tuesday'}</li>
    <li>Wed: ${'wednesday'}</li>
    <li>Thu: ${'thursday'}</li>
    <li>Fri: ${'friday'}</li>
    <li>Sat: ${'saturday'}</li>
</ul>`;

const DAYLIST_TEMPLATE = Template.normalizeHTML({template: true})`
<ul class="cu-monospace">
    <li>00-04: ${'t00_04'}</li>
    <li>04-08: ${'t04_08'}</li>
    <li>08-12: ${'t08_12'}</li>
    <li>12-16: ${'t12_16'}</li>
    <li>16-20: ${'t16_20'}</li>
    <li>20-24: ${'t20_24'}</li>
</ul>`;

const STATLIST_TEMPLATE = Template.normalizeHTML({template: true})`
<ul>
    <li>Max: ${'max'}</li>
    <li>Avg: ${'average'}</li>
    <li>StD: ${'stddev'}</li>
    <li>Out: ${'outlier'}</li>
    <li>Adj: ${'adjusted'}</li>
</ul>`;

//Message constants

const REORDER_MESSAGE = "Click to reorder the table by this column.\nWill switch the order when clicked more than once.";
const POPULATE_MESSAGE = "Click to populate the upload statistics for this period.";

const EMPTY_UPLOADS_MESSAGE_OWNER = "No uploads from you yet.";
const EMPTY_UPLOADS_MESSAGE_OTHER = "No uploads for this user.";
const EMPTY_APPROVALS_MESSAGE_OTHER = "No approvals for this user.";
const EMPTY_UPLOADS_MESSAGE_ANONYMOUS = "User is Anonymous, so no uploads.";
const COPYRIGHT_NO_UPLOADS = "No uploads, so no copyrights available for this period.";
const COPYRIGHT_NO_STATISTICS = 'No statistics available for this period (<span style="font-size:80%; color:grey;">click the table header</span>).';

//Period constants

const TIMEVALUES = ['d', 'w', 'mo', 'y', 'at'];
const MANUAL_PERIODS = ['w', 'mo'];
const LIMITED_PERIODS = ['y', 'at'];
const COPYRIGHT_PERIODS = ['d', 'w', 'mo'];

const COUNT_EXPIRES = {
    d: 15 * Utility.one_minute,
    w: Utility.one_day,
    mo: Utility.one_week,
    y: Utility.one_month,
    at: 3 * Utility.one_month,
};

const UPLOAD_EXPIRES = {
    d: 15 * Utility.one_minute,
    w: Utility.one_week,
    mo: Utility.one_month,
    y: 3 * Utility.one_month,
    at: Utility.one_year,
};

const PERIOD_HEADER = {
    d: "Day",
    w: "Week",
    mo: "Month",
    y: "Year",
    at: "All-time",
};

const PERIOD_X_POINTS = {
    w: 7,
    mo: 30,
    y: 12,
    at: 0,
};

const PERIOD_X_LABEL = {
    w: "Days ago",
    mo: "Days ago",
    y: "Months ago",
    at: "Months ago",
};

const PERIOD_DIVISOR = {
    w: Utility.one_day,
    mo: Utility.one_day,
    y: Utility.one_month,
    at: Utility.one_month,
};

const SHORTNAME_KEY = {
    d: 'daily',
    w: 'weekly',
    mo: 'monthly',
    y: 'yearly',
    at: 'alltime',
};

const LONGNAME_KEY = {
    daily: 'd',
    weekly: 'w',
    monthly: 'mo',
    yearly: 'y',
    alltime: 'at'
};

//Time constants

const RTI_EXPIRATION = Utility.one_month;
const JQUERY_DELAY = 1; //For jQuery updates that should not be done synchronously

//Other constants

const TOOLTIP_METRICS = ['score', 'upscore', 'downscore', 'favcount', 'tagcount', 'gentags', 'week', 'day'];
const CHART_METRICS = ['score', 'upscore', 'downscore', 'favcount', 'tagcount', 'gentags'];

const MAX_POST_LIMIT_QUERY = 100;

const IMPLICATION_FIELDS = 'antecedent_name';
const NAME_FIELD = 'name';
const USER_FIELDS = 'name,level_string';
const POST_FIELDS = 'id,score,up_score,down_score,fav_count,tag_count,tag_count_general,tag_string_copyright,created_at';

//Validation constants

const COUNT_CONSTRAINTS = {
    expires: Validate.nonnegative_integer_constraints,
    value: Validate.nonnegative_integer_constraints,
};

const IMPLICATION_CONSTRAINTS = {
    expires: Validate.nonnegative_integer_constraints,
    value: Validate.boolean_constraints,
};

const POST_CONSTRAINTS = {
    entry: {
        expires: Validate.nonnegative_integer_constraints,
        value: Validate.array_constraints,
    },
    value: [
        Validate.positive_integer_constraints, //ID
        Validate.integer_constraints, //SCORE
        Validate.nonnegative_integer_constraints, //UPSCORE
        Validate.nonnegative_integer_constraints, //DOWNSCORE
        Validate.nonnegative_integer_constraints, //FAVCOUNT
        Validate.positive_integer_constraints, //TAGCOUNT
        Validate.nonnegative_integer_constraints, //GENTAGS
        Validate.stringonly_constraints, //COPYRIGHTS
        Validate.nonnegative_integer_constraints //CREATED
    ],
};

const STATISTICS_CONSTRAINTS = {
    entry: Validate.hashentry_constraints,
    value: {
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
    time: Validate.basic_number_validator,
    post: {
        max: Validate.nonnegative_integer_constraints,
        average: Validate.number_constraints,
        stddev: Validate.number_constraints,
        outlier: Validate.nonnegative_integer_constraints,
        adjusted: Validate.number_constraints
    },
};

const CHART_CONSTRAINTS = {
    value: {
        score: Validate.array_constraints,
        upscore: Validate.array_constraints,
        downscore: Validate.array_constraints,
        favcount: Validate.array_constraints,
        tagcount: Validate.array_constraints,
        gentags: Validate.array_constraints,
        uploads: Validate.array_constraints
    },
    data: {
        x: Validate.nonnegative_integer_constraints,
        y: Validate.number_constraints,
    },
};

/****Functions****/

//Validation functions

function ValidateEntry(key, entry) {
    let printer = Debug.getFunctionPrint('ValidateEntry');
    if (!Validate.validateIsHash(key, entry)) {
        return false;
    }
    if (key.match(/^ct(?:d|w|mo|y|at)-/)) {
        return Validate.validateHashEntries(key, entry, COUNT_CONSTRAINTS);
    }
    if (key.match(/^rti-/)) {
        return Validate.validateHashEntries(key, entry, IMPLICATION_CONSTRAINTS);
    }
    if (key.match(/^(?:daily|weekly|monthly|previous)-(?:uploads|approvals)-/)) {
        if (!Validate.validateHashEntries(key, entry, POST_CONSTRAINTS.entry)) {
            return false;
        }
        return ValidatePosts(key + '.value', entry.value);
    }
    if (key.match(/^(?:yearly|alltime)-(?:uploads|approvals)-/)) {
        if (!Validate.validateHashEntries(key, entry, STATISTICS_CONSTRAINTS.entry)) {
            return false;
        }
        return ValidateStatistics(key + '.value', entry.value);
    }
    printer.log("Bad key!");
    return false;
}

function ValidatePosts(key, postentries) {
    for (let i = 0;i < postentries.length;i++){
        let value_key = key + `[${i}]`;
        if (!Validate.validateIsArray(value_key, postentries[i], {is: POST_CONSTRAINTS.value.length})) {
            return false;
        }
        //It's technically not a hash, although it works since arrays can be treated like one
        if (!Validate.validateHashEntries(value_key, postentries[i], POST_CONSTRAINTS.value)) {
            return false;
        }
    }
    return true;
}

function ValidateStatistics(key, statentries) {
    if (!Validate.validateHashEntries(key, statentries, STATISTICS_CONSTRAINTS.value)) {
        return false;
    }
    for (let i = 0; i < TOOLTIP_METRICS.length; i++) {
        let metric = TOOLTIP_METRICS[i];
        let metric_key = key + '.' + metric;
        if (metric === 'week' || metric === 'day') {
            if (!Validate.validateArrayValues(metric_key, statentries[metric], STATISTICS_CONSTRAINTS.time)) {
                return false;
            }
        } else if (!Validate.validateHashEntries(metric_key, statentries[metric], STATISTICS_CONSTRAINTS.post)) {
            return false;
        }
    }
    return ValidateChart(key + '.chart_data', statentries.chart_data);
}

function ValidateChart(key, chartentries) {
    if (!Validate.validateHashEntries(key, chartentries, CHART_CONSTRAINTS.value)) {
        return false;
    }
    for (let chart_key in chartentries) {
        for (let i = 0; i < chartentries[chart_key].length; i ++) {
            if (!Validate.validateHashEntries(`${key}.${chart_key}[${i}]`, chartentries[chart_key][i], CHART_CONSTRAINTS.data)) {
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
            checkerror = Load.validateUserSettings(entry, SETTINGS_CONFIG);
            break;
        case 'cu-current-metric':
            if (!TOOLTIP_METRICS.includes(entry)) {
                checkerror = [`Value not in list: ${TOOLTIP_METRICS}`];
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

function ValidateExpiration(key) {
    let short_period = /^ct(d|w|mo|y|at)-/.exec(key)[1];
    return COUNT_EXPIRES[short_period];
}

//Helper functions

/**
 * Returns a sorted key array from highest to lowest
 * using the length of the array in each value.
 */
function SortDict(dict) {
    var items = Object.keys(dict).map((key) => [key, dict[key].length]);
    items.sort((first, second) => (first[1] !== second[1] ? second[1] - first[1] : first[0].localeCompare(second[0])));
    return items.map((entry) => entry[0]);
}

function BuildTagParams(tag, period) {
    return (period === 'at' ? '' : ('age:..1' + period + ' ')) + tag;
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
    let points = PERIOD_X_POINTS[period];
    let periods = Array(length).fill().map(() => []);
    posts.forEach((post) => {
        let index = Math.floor((Date.now() - post.created - time_offset) / (PERIOD_DIVISOR[period]));
        index = (points ? Math.min(points - 1, index) : index);
        index = Math.max(0, index);
        if (index >= periods.length) {
            let empty_periods = Array(index + 1 - periods.length).fill().map(() => []);
            periods = Utility.concat(periods, empty_periods);
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

function GetCopyrightCount(posts) {
    let copyright_count = {};
    posts.forEach((post) => {
        post.copyrights.split(' ').forEach((tag) => {
            copyright_count[tag] ??= [];
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

/**
 * Given the rate at which a tag has been uploaded over the last week for
 * all of Danbooru, has an upload likely occurred since the last check?
 */
function CheckCopyrightVelocity(tag) {
    var dayuploads = Storage.getIndexedSessionData('ctd-' + tag);
    var weekuploads = Storage.getIndexedSessionData('ctw-' + tag);
    if (dayuploads === null || weekuploads === null) {
        return true;
    }
    var day_gettime = dayuploads.expires - COUNT_EXPIRES.d; //Time data was originally retrieved
    var week_velocity = (Utility.one_week) / (weekuploads.value | 1); //Milliseconds per upload
    var adjusted_poll_interval = Math.min(week_velocity, Utility.one_day); //Max wait time is 1 day
    return Date.now() > day_gettime + adjusted_poll_interval;
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

function GetPeriodKey(period_name) {
    return `${period_name}-${CU.counttype}-${CU.current_username}`;
}

function GetShownPeriodKeys() {
    return TIMEVALUES.filter((period_key) => CU.user_settings.periods_shown.includes(SHORTNAME_KEY[period_key]));
}

function TableMessage(message) {
    $('#count-body').html(message);
    $('#count-controls, #count-copyrights, #count-header, #count-chart').hide();
}

//Render functions

function RenderHeader() {
    var tabletext = Utility.renderHTMLTag('th', 'Name');
    let click_periods = MANUAL_PERIODS.concat(LIMITED_PERIODS);
    let times_shown = GetShownPeriodKeys();
    times_shown.forEach((period) => {
        let header = PERIOD_HEADER[period];
        let is_available = CU.period_available[CU.usertag][CU.current_username][period];
        let header_options = {title: REORDER_MESSAGE, class: 'cu-period-header', dataPeriod: period, width: '15%'};
        if (click_periods.includes(period) && !is_available) {
            let link_class = (MANUAL_PERIODS.includes(period) ? 'cu-manual' : 'cu-limited');
            // eslint-disable-next-line dot-notation
            header_options.class += ' cu-process';
            let title = POPULATE_MESSAGE + (MANUAL_PERIODS.includes(period) ? '\nShows the statistics for all rows.' : '\nIs limited to only only the top row.');
            let link_html = Utility.renderHTMLTag('a', header, {title, class: `cu-link ${link_class}`});
            tabletext += Utility.renderHTMLTag('th', `${link_html}${HEADER_COUNTER_HTML}`, header_options);
        } else {
            tabletext += Utility.renderHTMLTag('th', header, header_options);
        }
    });
    tabletext = Utility.renderHTMLTag('tr', tabletext);
    return Utility.renderHTMLTag('thead', tabletext);
}

function RenderBody() {
    if (CU.active_copytags.length > 5) {
        $('#count-body').addClass('overflowed');
    } else {
        $('#count-body').removeClass('overflowed');
    }
    let header = Utility.renderHTMLTag('tr', '<th></th>' + Array(CU.periods_shown.length).fill('<th width="15%"></th>').join(""));
    var tabletext = RenderRow('');
    for (let i = 0;i < CU.active_copytags.length; i++) {
        tabletext += RenderRow(CU.active_copytags[i]);
    }
    return Utility.renderHTMLTag('thead', header, {style: 'visibility: collapse;'}) + Utility.renderHTMLTag('tbody', tabletext);
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
    let click_periods = MANUAL_PERIODS.concat(LIMITED_PERIODS);
    for (let i = 0;i < times_shown.length; i++) {
        let period = times_shown[i];
        var data_text;
        if (key === "") {
            data_text = GetCountData('ct' + period + `-${CU.usertag}:` + CU.current_username, "N/A");
        } else {
            var user_uploads = GetCountData('ct' + period + `-${CU.usertag}:` + CU.current_username + ' ' + key, "N/A");
            var all_uploads = GetCountData('ct' + period + '-' + key, "N/A");
            data_text = `(${user_uploads}/${all_uploads})`;
        }
        let is_limited = LIMITED_PERIODS.includes(period);
        let class_name = (!is_limited ? 'cu-hover' : '');
        let title = undefined;
        if (click_periods.includes(period) && key === '') {
            title = "Click to show the uploads chart.";
            class_name += ' cu-chart-cell' + (MANUAL_PERIODS.includes(period) ? ' cu-manual' : ' cu-limited');
        }
        let rowdata = {title, class: class_name, dataPeriod: period};
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
    let header = PERIOD_HEADER[period];
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

function RenderCopyrights(period) {
    let copytags = CU.user_copytags[CU.usertag][CU.current_username][period].toSorted();
    return copytags.map((copyright) => {
        let tag_text = Utility.maxLengthString(copyright, 20);
        let taglink = Danbooru.postSearchLink(tag_text, {tags: copyright}, {class: 'tag-type-3'});
        let classname = CU.active_copytags.includes(copyright) ? 'cu-active-copyright' : '';
        return COPYRIGHT_TAG_TEMPLATE({copyright, taglink, classname});
    }).join('');
}

function RenderCopyrightControls() {
    let controls = COPYRIGHT_PERIODS.map((period) => {
        let period_name = SHORTNAME_KEY[period];
        return COPYRIGHT_CONTROL_TEMPLATE({period, text: Utility.titleize(period_name)});
    });
    controls.push(COPYRIGHT_CONTROL_TEMPLATE({period: 'manual', text: 'Manual'}));
    return controls.join('');
}

function RenderTooltipData(text, period, limited = false) {
    let popups = TOOLTIP_METRICS.map((metric) => {
        let text = (limited ? RenderStatistics('', metric, period, true) : '');
        return TOOLTIP_POPUP_TEMPLATE({metric, text});
    });
    return TOOLTIP_DATA_TEMPLATE({text, period, popups: popups.join('')});
}

function RenderAllTooltipControls() {
    return TOOLTIP_METRICS.map((metric) => TOOLTIP_CONTROL_TEMPLATE({metric, text: Utility.titleize(metric)})).join('');
}

function RenderStatistics(key, attribute, period, limited = false) {
    let period_key = GetPeriodKey(SHORTNAME_KEY[period]);
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
    return WEEKLIST_TEMPLATE({
        sunday: stat[0],
        monday: stat[1],
        tuesday: stat[2],
        wednesday: stat[3],
        thursday: stat[4],
        friday: stat[5],
        saturday: stat[6],
    });
}

function RenderDaylist(stat) {
    return DAYLIST_TEMPLATE({
        t00_04: stat[0],
        t04_08: stat[1],
        t08_12: stat[2],
        t12_16: stat[3],
        t16_20: stat[4],
        t20_24: stat[5],
    });
}

function RenderStatlist(stat) {
    return STATLIST_TEMPLATE(stat);
}

//Data functions

function GetCountData(key, default_val = null) {
    let count_data = Storage.getIndexedSessionData(key);
    if (!ValidateEntry(key, count_data)) {
        return default_val;
    }
    return count_data.value;
}

function CheckPeriodUploads() {
    let promise_array = [];
    const checkPeriod = (key, period, check) => {
        CU.period_available[CU.usertag][CU.current_username][period] = Boolean(check);
        if (!check) {
            Storage.removeIndexedSessionData(key);
        }
    };
    CU.period_available[CU.usertag][CU.current_username] ??= {};
    let times_shown = GetShownPeriodKeys();
    for (let i = 0; i < times_shown.length; i++) {
        let period = times_shown[i];
        if (period in CU.period_available[CU.usertag][CU.current_username]) {
            continue;
        }
        let data_key = GetPeriodKey(SHORTNAME_KEY[period]);
        let max_expires = UPLOAD_EXPIRES[period];
        let check_promise = Storage.checkData(data_key, {max_expires}).then((check) => {checkPeriod(data_key, period, check);});
        promise_array.push(check_promise);
    }
    return Promise.all(promise_array);
}

//Initialize functions

function InitializeControls() {
    const printer = Debug.getFunctionPrint('InitializeControls');
    //Render the controls only once when the table is first opened
    if (!CU.controls_initialized) {
        $('#count-controls').html(RenderAllTooltipControls());
        $('#count-copyrights-controls').html(RenderCopyrightControls());
        $('.cu-select-tooltip').on(JSPLib.event.click, TooltipChange);
        $('.cu-select-period a').on(JSPLib.event.click, CopyrightPeriod);
        $('#count-copyrights-header a').on(JSPLib.event.click, ToggleCopyrightsSection);
        $('#count_submit_user_id').on(JSPLib.event.click, CheckUser);
        $('#count_refresh_user_id').on(JSPLib.event.click, RefreshUser);
        $('#count_add_copyright').on(JSPLib.event.click, AddCopyright);
        CU.controls_initialized = true;
        Load.scriptWaitExecute(CU, 'IAC', {
            available: () => {
                CU.IAC.InitializeProgramValues(true);
                CU.IAC.InitializeAutocompleteIndexed("#count_query_user_id", 'us');
                CU.IAC.InitializeAutocompleteIndexed("#count_query_copyright", 'ac');
                printer.logLevel("Initialized CU input autocomplete.", Debug.DEBUG);
            },
            fallback: () => {
                printer.logLevel("Unable to initialize textarea autocomplete.", Debug.DEBUG);
            },
        });
    }
}

function InitializeTable() {
    $('#count-header').html(Utility.renderHTMLTag('table', RenderHeader(), {class: 'striped', 'width': '100%'}));
    $('#count-body').html(Utility.renderHTMLTag('table', RenderBody(), {class: 'striped', 'width': '100%'}));
    $('#count-order').html(RenderOrderMessage('d', 0));
    $('#count-header .cu-process a').on(JSPLib.event.click, GetPeriod);
    $('#count-header th').on(JSPLib.event.click, SortTable);
    $('#count-body .cu-manual, #count-body .cu-limited').on(JSPLib.event.click, RenderChart);
    $('#count-controls, #count-copyrights, #count-header').show();
    $(`.cu-select-tooltip[data-type="${CU.current_metric}"] a`).click();
    CU.sort_type = 0;
    CU.sort_period = "d";
    if (CU.copyright_period) {
        $(`.cu-select-period[data-type="${CU.copyright_period}"] a`).click();
    }
    CU.shown_copytags = Utility.deepCopy(CU.active_copytags);
}

function CleanupTasks() {
    Storage.pruneProgramCache();
}

//Network functions

async function CheckTagImplications(tags) {
    let printer = Debug.getFunctionPrint('CheckTagImplications');
    let check_tags = Utility.arrayDifference(tags, Object.keys(CU.reverse_implications));
    if (check_tags.length) {
        printer.log("Check:", check_tags);
        let storage_keys = check_tags.map((tag) => 'rti-' + tag);
        let storage_data = await Storage.batchCheckData(storage_keys, {expiration: RTI_EXPIRATION});
        printer.log("Storage:", storage_data);
        for (let key in storage_data) {
            let tag = key.slice(4);
            CU.reverse_implications[tag] = storage_data[key].value;
        }
        let query_tags = Utility.arrayDifference(check_tags, Object.keys(CU.reverse_implications));
        if (query_tags.length) {
            printer.log("Network:", query_tags);
            let network_data = await Danbooru.query('tag_implications', {search: {antecedent_name_comma: query_tags.join(',')}, only: IMPLICATION_FIELDS, limit: query_tags.limit}, {default_val: []});
            let found_tags = network_data.map((implication) => implication.antecedent_name);
            printer.log("Found:", found_tags);
            let expires = Utility.getExpires(RTI_EXPIRATION);
            let batch_save = {};
            query_tags.forEach((tag) => {
                CU.reverse_implications[tag] = found_tags.includes(tag);
                batch_save['rti-' + tag] = {value: CU.reverse_implications[tag], expires};
            });
            Storage.batchSaveData(batch_save);
        }
    }
    return tags.filter((tag) => !CU.reverse_implications[tag]);
}

async function LoadTagCountData(tags) {
    let printer = Debug.getFunctionPrint('LoadTagCountData');
    LoadTagCountData.memoized ??= [];
    let check_tags = Utility.arrayDifference(tags, LoadTagCountData.memoized);
    if (check_tags.length === 0) return;
    LoadTagCountData.memoized = Utility.arrayUnion(check_tags, LoadTagCountData.memoized);
    printer.log("Check:", check_tags);
    let short_periods = CU.periods_shown.map((period) => LONGNAME_KEY[period]);
    let storage_keys = check_tags.map((tag) => short_periods.map((period) => 'ct' + period + '-' + tag)).flat();
    let storage_data = await Storage.batchCheckData(storage_keys, {expiration: ValidateExpiration});
    printer.log("Storage:", storage_data);
    let missing_keys = Utility.arrayDifference(storage_keys, Object.keys(storage_data));
    if (missing_keys.length === 0) return;
    printer.log("Network:", missing_keys);
    let promise_array = [];
    let batch_save = {};
    for (let key of missing_keys) {
        let [, short_period, tag] = /^ct(d|w|mo|y|at)-(.*)/.exec(key);
        let promise = Danbooru.query('counts/posts', {tags: BuildTagParams(tag, short_period), skip_cache: true}, {default_val: {counts: {posts: 0}}});
        promise.then((network_data) => {
            printer.logLevel("Count:", tag, SHORTNAME_KEY[short_period], network_data, Debug.VERBOSE);
            batch_save[key] = {value: network_data.counts.posts, expires: Utility.getExpires(COUNT_EXPIRES[short_period])};
        });
        promise_array.push(promise);
    }
    await Promise.all(promise_array);
    Storage.batchSaveData(batch_save);
}

async function GetPeriodUploads(username, period, limited = false, domname = null) {
    let printer = Debug.getFunctionPrint('GetPeriodUploads');
    let period_name = SHORTNAME_KEY[period];
    let max_expires = UPLOAD_EXPIRES[period];
    let key = GetPeriodKey(period_name);
    var check = await Storage.checkData(key, {max_expires});
    if (!(check)) {
        printer.log(`Network (${period_name} ${CU.counttype})`);
        let data = await GetPostsCountdown(BuildTagParams(`${CU.usertag}:${username}`, period), domname);
        let mapped_data = MapPostData(data);
        if (limited) {
            let indexed_posts = AssignPostIndexes(period, mapped_data, 0);
            mapped_data = Utility.assignObjects(...TOOLTIP_METRICS.map((metric) => ({[metric]: GetAllStatistics(mapped_data, metric)})));
            mapped_data.chart_data = Utility.assignObjects(...CHART_METRICS.map((metric) => ({[metric]: GetPeriodAverages(indexed_posts, metric)})));
            mapped_data.chart_data.uploads = GetPeriodPosts(indexed_posts);
            Storage.saveData(key, {value: mapped_data, expires: Utility.getExpires(max_expires)});
        } else {
            Storage.saveData(key, {value: PreCompressData(mapped_data), expires: Utility.getExpires(max_expires)});
        }
        return mapped_data;
    }
    return (limited ? check.value : PostDecompressData(check.value));
}

async function GetPostsCountdown(query, domname) {
    const printer = Debug.getFunctionPrint('GetPostsCountdown');
    printer.logLevel({query, domname}, Debug.VERBOSE);
    let limit = MAX_POST_LIMIT_QUERY;
    let tag_addon = {tags: query};
    let only_addon = {only: POST_FIELDS};
    let limit_addon = {limit};
    let page_addon = {};
    var return_items = [];
    let page_num = 1;
    var counter;
    if (domname) {
        let count_resp = await Danbooru.query('counts/posts', tag_addon, {default_val: {counts: {posts: 0}}});
        try {
            counter = Math.ceil(count_resp.counts.posts / limit);
        } catch (e) {
            printer.warnLevel("Malformed count response", count_resp, e, Debug.ERROR);
            counter = '<span title="Malformed count response" style="color:red">Error!</span>';
        }
    }
    while (true) {
        if (domname) {
            $(domname).html(counter);
        }
        if (Utility.isInteger(counter)) {
            printer.logLevel("Pages left #", counter--, Debug.INFO);
        } else {
            printer.logLevel("Pages done #", page_num++, Debug.INFO);
        }
        let request_addons = Utility.mergeObjects(tag_addon, limit_addon, only_addon, page_addon);
        let request_key = 'posts-' + Utility.renderParams(request_addons);
        let temp_items = await Danbooru.query('posts', request_addons, {default_val: [], key: request_key});
        return_items = Utility.concat(return_items, temp_items);
        if (temp_items.length < limit) {
            return return_items;
        }
        let lastid = Danbooru.getNextPageID(temp_items, false);
        page_addon = {page: `b${lastid}`};
    }
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
        let value = $('.cu-uploads', $cells[0]).html();
        $($cells[0]).html(RenderTooltipData(value, period, true));
    } else {
        $cells.each((_i, cell) => {
            let value = $('.cu-uploads', cell).html();
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
    if (CU.sort_period !== period) {
        CU.sort_type = 3;
        CU.sort_period = period;
    }
    let rows = [];
    $('#count-body tbody tr').each((i, row) => {
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
        switch (CU.sort_type) {
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
        $('#count-body tbody').append(row.domobj);
    });
    CU.sort_type = (CU.sort_type + 1) % 4;
    $('#count-order').html(RenderOrderMessage(period, CU.sort_type));
}

function RenderChart(event) {
    if (event.target.tagName !== "TD") {
        return;
    }
    if (!CHART_METRICS.includes(CU.current_metric)) {
        Notice.notice("Chart data not available on Day and Week metrics.");
        return;
    }
    let period = $(event.target).data('period');
    let is_limited = $(event.target).hasClass('cu-limited');
    let long_period = SHORTNAME_KEY[period];
    let points = PERIOD_X_POINTS[period];
    let period_key = GetPeriodKey(long_period);
    let data = Storage.getIndexedSessionData(period_key);
    if (!data || (!is_limited && data.value.length === 0) || (is_limited && !data.value.chart_data)) {
        Notice.notice(`${PERIOD_HEADER[period]} period not populated! Click the period header to activate the chart.`);
        return;
    }
    var period_averages, period_uploads;
    if (!is_limited) {
        let time_offset = Date.now() - (data.expires - UPLOAD_EXPIRES[period]);
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
            text: `${Utility.displayCase(long_period)} ${CU.counttype} - Average post ${CU.current_metric}`
        },
        axisX: {
            title: PERIOD_X_LABEL[period],
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
            horizontalAlign: 'right',
            verticalAlign: 'bottom',
        },
        data: [{
            showInLegend: true,
            legendText: `${metric_display}`,
            type: 'spline',
            dataPoints: period_averages
        },
        {
            showInLegend: true,
            legendText: `${type_display}`,
            type: 'line',
            axisYType: 'secondary',
            dataPoints: period_uploads
        }]
    };
    //This needs to be shown now so that the chart function renders to the right size
    $('#count-chart').show();
    var chart = new CanvasJS.Chart("count-chart", chart_data);
    chart.render();
    $(".canvasjs-chart-credit").css('top', "400px");
}

function TooltipChange(event) {
    CU.current_metric = $(event.target.parentElement).data('type');
    $('.cu-select-tooltip').removeClass('cu-active-control');
    $(`.cu-select-tooltip[data-type='${CU.current_metric}']`).addClass('cu-active-control');
    $('.cu-tooltiptext').removeClass('cu-activetooltip');
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
    $container.toggleClass('cu-active-copyright');
    let copyright = $container.data('copyright');
    if ($container.hasClass('cu-active-copyright')) {
        CU.active_copytags.push(copyright);
    } else {
        CU.active_copytags.splice(CU.active_copytags.indexOf(copyright), 1);
    }
    event.preventDefault();
}

async function CopyrightPeriod(event) {
    let $container = $(event.target.parentElement);
    let short_period = CU.copyright_period = $container.data('type');
    $('.cu-select-period').removeClass('cu-active-control');
    $container.addClass('cu-active-control');
    if (short_period === 'manual') {
        $('#count-copyrights-manual').show();
        $('#count-copyrights-list').html(RenderCopyrights('manual'));
        $('#count-copyrights-list a').off(JSPLib.event.click).on(JSPLib.event.click, ToggleCopyrightTag);
    } else {
        $('#count-copyrights-manual').hide();
        let current_period = SHORTNAME_KEY[short_period];
        let is_period_enabled = CU.period_available[CU.usertag][CU.current_username][short_period];
        if (is_period_enabled) {
            if (CU.user_copytags[CU.usertag][CU.current_username][current_period] === undefined) {
                let period_key = GetPeriodKey(current_period);
                let data = Storage.getIndexedSessionData(period_key);
                let copyright_count = GetCopyrightCount(PostDecompressData(data.value));
                let user_copytags = SortDict(copyright_count);
                if (CU.user_settings.copyrights_merge) {
                    $('#count-copyrights-counter').html(COUNTER_HTML);
                    user_copytags = await CheckTagImplications(user_copytags);
                    $('#count-copyrights-counter').html("");
                }
                CU.user_copytags[CU.usertag][CU.current_username][current_period] = user_copytags;
            }
            if (CU.user_copytags[CU.usertag][CU.current_username][current_period].length === 0) {
                $('#count-copyrights-list').html(`<div id="empty-statistics">${COPYRIGHT_NO_UPLOADS}</div>`);
            } else {
                $('#count-copyrights-list').html(RenderCopyrights(current_period));
                $('#count-copyrights-list a').off(JSPLib.event.click).on(JSPLib.event.click, ToggleCopyrightTag);
            }
        } else {
            $('#count-copyrights-list').html(`<div id="empty-statistics">${COPYRIGHT_NO_STATISTICS}</div>`);
        }
    }
    event.preventDefault();
}

function ToggleNotice() {
    if (CU.hidden === true) {
        CU.hidden = false;
        $('#upload-counts').show();
        if (!CU.populating_table) {
            //Always show current user on open to prevent processing potentially bad usernames set by CheckUser
            CU.empty_uploads_message = (CU.username === "Anonymous" ? EMPTY_UPLOADS_MESSAGE_ANONYMOUS : EMPTY_UPLOADS_MESSAGE_OWNER);
            CU.display_username = CU.username;
            CU.current_username = CU.username.toLowerCase();
            CU.level_string = (CU.username === "Anonymous" ? "Member" : DanbooruProxy.CurrentUser.data('level-string'));
            CU.usertag = 'user';
            setTimeout(() => PopulateTable(), JQUERY_DELAY);
        }
    } else {
        CU.hidden = true;
        $('#upload-counts').hide();
        $('.cu-program-checkbox').prop('checked', false);
        $('#count-chart').hide();
    }
}

async function RefreshUser() {
    $("#count-copyrights-counter").html(COUNTER_HTML);
    let diff_tags = Utility.arrayDifference(CU.active_copytags, CU.shown_copytags);
    let count_tags = [];
    diff_tags.forEach((val) => {
        count_tags.push(`${CU.usertag}:${CU.current_username} ${val}`);
        count_tags.push(val);
    });
    await LoadTagCountData(count_tags);
    $("#count-copyrights-counter").html('');
    InitializeTable();
}

async function CheckUser() {
    //Don't change the username while currently processing
    if (!CU.populating_table) {
        $('#count-chart').hide();
        let check_user;
        let check_username = $('#count_query_user_id').val().toLowerCase();
        if (check_username === "") {
            check_user = [];
        } else if (check_username in CU.checked_usernames) {
            check_user = CU.checked_usernames[check_username];
        } else {
            //Check each time no matter what as misses can be catastrophic
            check_user = await Danbooru.query('users', {search: {name_matches: check_username}, only: USER_FIELDS, expiry: 30});
            CU.checked_usernames[check_username] = check_user;
        }
        if (check_user.length) {
            CU.display_username = check_user[0].name;
            CU.current_username = check_user[0].name.toLowerCase();
            CU.level_string = check_user[0].level_string;
            let is_approvals = $('#count_approver_select')[0].checked;
            CU.empty_uploads_message = is_approvals ? EMPTY_APPROVALS_MESSAGE_OTHER : EMPTY_UPLOADS_MESSAGE_OTHER;
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
    let tag = $('#count_query_copyright').val();
    let tagdata = await Danbooru.query('tags', {search: {name: tag}, only: NAME_FIELD}, {default_val: []});
    if (tagdata.length === 0) {
        Notice.notice("Tag not valid");
        return;
    }
    tag = tagdata[0].name;
    user_copytags.manual.push(tag);
    user_copytags.manual = Utility.arrayUnique(user_copytags.manual);
    CU.active_copytags.push(tag);
    CU.active_copytags = Utility.arrayUnique(CU.active_copytags);
    $('#count-copyrights-list').html(RenderCopyrights('manual'));
    $('#count-copyrights-list a').off(JSPLib.event.click).on(JSPLib.event.click, ToggleCopyrightTag);
}

function TooltipHover(event) {
    let container = event.target.parentElement;
    let $tooltip_text = $('.cu-activetooltip', container);
    let tooltip_key = $(container.parentElement.parentElement).data('key');
    let tooltip_period = $(container).data('period');
    let tooltip_metric = $('.cu-activetooltip', container).data('type');
    $tooltip_text.html("Loading!");
    $tooltip_text.html(RenderStatistics(tooltip_key, tooltip_metric, tooltip_period));
    $(event.target).off();
}

//Main execution functions

async function PopulateTable() {
    //Prevent function from being reentrant while processing uploads
    CU.populating_table = true;
    var post_data = [];
    InitializeControls();
    if (CU.checked_users[CU.usertag][CU.current_username] === undefined) {
        TableMessage(`<div id="empty-uploads">Loading data... (<span id="loading-counter">...</span>)</div>`);
        post_data = await ProcessUploads(CU.current_username);
        CU.checked_users[CU.usertag][CU.current_username] = post_data.length;
    }
    let is_override = $('#count_override_select')[0].checked;
    if (is_override || CU.checked_users[CU.usertag][CU.current_username]) {
        CU.active_copytags = Utility.deepCopy(CU.user_copytags[CU.usertag][CU.current_username].daily);
        await CheckPeriodUploads(CU.current_username);
        InitializeTable();
    } else {
        TableMessage(`<div id="empty-uploads">${CU.empty_uploads_message}</div>`);
    }
    CU.populating_table = false;
}

async function ProcessUploads() {
    var count_tags = [];
    var current_uploads = [];
    var user_copytags = [];
    if (CU.current_username !== "Anonymous") {
        current_uploads = await GetPeriodUploads(CU.current_username, 'd');
    }
    let previous_key = GetPeriodKey('previous');
    if (current_uploads.length) {
        let is_new_tab = Storage.getIndexedSessionData(previous_key) === null;
        let previous_uploads = await Storage.checkData(previous_key, {default_val: {value: []}});
        previous_uploads = PostDecompressData(previous_uploads.value);
        let current_ids = Utility.getObjectAttributes(current_uploads, 'id');
        let previous_ids = Utility.getObjectAttributes(previous_uploads, 'id');
        if (is_new_tab || !Utility.arrayEquals(current_ids, previous_ids) || IsMissingTag(`${CU.usertag}:${CU.current_username}`)) {
            count_tags.push(`${CU.usertag}:${CU.current_username}`);
        }
        if (CU.is_gold_user && CU.copyrights_enabled) {
            let curr_copyright_count = GetCopyrightCount(current_uploads);
            let prev_copyright_count = GetCopyrightCount(previous_uploads);
            user_copytags = SortDict(curr_copyright_count);
            if (CU.copyrights_merge) {
                user_copytags = await CheckTagImplications(user_copytags);
            }
            if (CU.copyrights_threshold) {
                user_copytags = user_copytags.slice(0, CU.copyrights_threshold);
            }
            let copyright_symdiff = CompareCopyrightCounts(curr_copyright_count, prev_copyright_count);
            let copyright_changed = (is_new_tab ? user_copytags : Utility.arrayIntersection(user_copytags, copyright_symdiff));
            let copyright_nochange = (is_new_tab ? [] : Utility.arrayDifference(user_copytags, copyright_changed));
            copyright_nochange.forEach((val) => {
                if (CheckCopyrightVelocity(val) || IsMissingTag(val)) {
                    count_tags.push(val);
                }
                if (IsMissingTag(`${CU.usertag}:${CU.current_username} ${val}`)) {
                    count_tags.push(`${CU.usertag}:${CU.current_username} ${val}`);
                }
            });
            copyright_changed.forEach((val) => {
                count_tags.push(`${CU.usertag}:${CU.current_username} ${val}`);
                count_tags.push(val);
            });
        }
        await LoadTagCountData(count_tags);
    } else if (IsMissingTag(`${CU.usertag}:${CU.current_username}`)) {
        await LoadTagCountData([`${CU.usertag}:${CU.current_username}`]);
    }
    CU.user_copytags[CU.usertag][CU.current_username] = {daily: user_copytags, manual: []};
    Storage.saveData(previous_key, {value: PreCompressData(current_uploads), expires: 0});
    return current_uploads;
}

//Settings functions

function OptionCacheDataKey(data_type) {
    CU.data_period = $('#cu-control-data-period').val();
    if (data_type === 'reverse_implication') {
        return 'rti-';
    }
    if (data_type === 'count') {
        if (CU.data_period === 'previous') {
            CU.data_value = "";
            return "";
        }
        let shortkey = (CU.data_period !== "" ? LONGNAME_KEY[CU.data_period] : "");
        return `ct${shortkey}-`;
    }
    return `${CU.data_period}-${data_type}-`;
}

function DataTypeChange() {
    let data_type = $('#cu-control-data-type').val();
    let action = (['count', 'uploads', 'approvals'].includes(data_type) ? 'show' : 'hide');
    $('.cu-options[data-setting="data_period"]')[action]();
}

function InitializeProgramValues() {
    Utility.assignObjects(CU, {
        username: DanbooruProxy.CurrentUser.data('name'),
        is_gold_user: DanbooruProxy.CurrentUser.data('is-gold'),
        current_metric: Storage.checkLocalData('cu-current-metric', {default_val: 'score'}),
        hidden: true,
    });
    Load.setProgramGetter(CU, 'IAC', 'IndexedAutocomplete', 29.32);
}

function RenderSettingsMenu() {
    $(Menu.program_selector).append(Menu.renderMenuFramework(MENU_CONFIG));
    $('#cu-general-settings').append(Menu.renderDomainSelectors());
    $('#cu-display-settings').append(Menu.renderCheckbox('copyrights_merge'));
    $('#cu-display-settings').append(Menu.renderCheckbox('copyrights_enabled'));
    $('#cu-display-settings').append(Menu.renderTextinput('copyrights_threshold', 10));
    $('#cu-display-settings').append(Menu.renderTextinput('postcount_threshold', 10));
    $('#cu-display-settings').append(Menu.renderInputSelectors('periods_shown', 'checkbox'));
    $('#cu-controls').append(Menu.renderCacheControls());
    $('#cu-cache-controls-message').append(Menu.renderExpandable('Cache Data details', CACHE_DATA_DETAILS));
    $('#cu-cache-controls').append(Menu.renderLinkclick('cache_info', true));
    $('#cu-cache-controls').append(Menu.renderCacheInfoTable());
    $('#cu-cache-controls').append(Menu.renderLinkclick('purge_cache', true));
    $('#cu-controls').append(Menu.renderCacheEditor({has_cache_data: true}));
    $('#cu-cache-editor-message').append(Menu.renderExpandable('Program Data details', PROGRAM_DATA_DETAILS));
    $('#cu-cache-editor-controls').append(Menu.renderKeyselect('data_source', true));
    $('#cu-cache-editor-controls').append(Menu.renderDataSourceSections());
    $('#cu-section-indexed-db').append(Menu.renderKeyselect('data_type', true));
    $('#cu-section-indexed-db').append(Menu.renderKeyselect('data_period', true));
    $('#cu-section-local-storage').append(Menu.renderCheckbox('raw_data', true));
    $('#cu-cache-editor-controls').append(Menu.renderTextinput('data_name', 20, true));
    Menu.engageUI({checkboxradio: true});
    $('#cu-select-periods-shown-daily').checkboxradio('disable'); //Daily period is mandatory
    Menu.saveUserSettingsClick();
    Menu.resetUserSettingsClick({delete_keys: STORAGE_RESET_KEYS});
    Menu.cacheInfoClick();
    Menu.purgeCacheClick();
    Menu.expandableClick();
    Menu.dataSourceChange();
    $('#cu-control-data-type').on(JSPLib.event.change, DataTypeChange);
    Menu.rawDataChange();
    Menu.getCacheClick();
    Menu.saveCacheClick();
    Menu.deleteCacheClick();
    Menu.listCacheClick();
    Menu.refreshCacheClick();
    Menu.cacheAutocomplete();
}

//Main program

function Main() {
    Load.preloadScript({
        program_css: PROGRAM_CSS,
        light_css: LIGHT_MODE_CSS,
        dark_css: DARK_MODE_CSS,
        run_on_settings: true,
    });
    Menu.preloadMenu({
        menu_func: RenderSettingsMenu,
    });
    if (!Load.isScriptEnabled()) return;
    InitializeProgramValues();
    $('[href="/explore/posts/missed_searches"]').parent().after(MENU_LINK_HTML);
    $('#a-site-map').after(NOTICE_BOX_HTML);
    $('#cu-uploads-report').on(JSPLib.event.click, ToggleNotice);
    Statistics.addPageStatistics();
    Load.noncriticalTasks(CleanupTasks);
}

/****Initialization****/

JSPLib.data = CU;
JSPLib.name = PROGRAM_NAME;
JSPLib.shortcut = PROGRAM_SHORTCUT;
JSPLib.data_regex = PROGRAM_DATA_REGEX;
JSPLib.default_data = DEFAULT_VALUES;
JSPLib.reset_data = PROGRAM_RESET_KEYS;
JSPLib.settings_config = SETTINGS_CONFIG;

Debug.mode = false;
Debug.level = Debug.INFO;

Menu.data_key = OptionCacheDataKey;
Menu.control_config = CONTROL_CONFIG;

Danbooru.counter_domname = "#loading-counter";

Storage.indexedDBValidator = ValidateEntry;
Storage.localSessionValidator = ValidateProgramData;

Load.exportData();

/****Execution start****/

Load.programInitialize(Main, {required_variables: LOAD_REQUIRED_VARIABLES, optional_selectors: LOAD_OPTIONAL_SELECTORS});

})(JSPLib);
