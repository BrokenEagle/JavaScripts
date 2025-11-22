// ==UserScript==
// @name         New Twitter Image Searches and Stuff
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      11.6
// @description  Searches Danbooru database for tweet IDs, adds image search links.
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        https://x.com/*
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/New_Twitter_Image_Searches_and_Stuff.user.js
// @updateURL    https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/New_Twitter_Image_Searches_and_Stuff.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.14.1/jquery-ui.min.js
// @require      https://cdn.jsdelivr.net/npm/jquery-hotkeys@0.2.2/jquery-hotkeys.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.13.1/validate.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.10.0/localforage.min.js
// @require      https://cdn.jsdelivr.net/npm/localforage-getitems@1.4.2/dist/localforage-getitems.min.js
// @require      https://cdn.jsdelivr.net/npm/localforage-setitems@1.4.0/dist/localforage-setitems.min.js
// @require      https://cdn.jsdelivr.net/npm/localforage-removeitems@1.4.0/dist/localforage-removeitems.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/custom-20190305/custom/qtip_tisas.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/module.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/notice.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/concurrency.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/saucenao.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/menu.js
// @resource     jquery_ui_css https://raw.githubusercontent.com/BrokenEagle/JavaScripts/custom-20190305/custom/jquery_ui_custom.css
// @resource     jquery_qtip_css https://raw.githubusercontent.com/BrokenEagle/JavaScripts/custom-20190305/custom/qtip_tisas.css
// @grant        GM_getResourceText
// @grant        GM.xmlHttpRequest
// @connect      donmai.us
// @connect      saucenao.com
// @connect      twimg.com
// @run-at       document-body
// @noframes
// ==/UserScript==

// eslint-disable-next-line no-redeclare
/* global $ jQuery JSPLib validate localforage saveAs GM_getResourceText BigInt */

/****Library updates****/

////NONE

/****Global variables****/

//Exterior script variables

const DANBOORU_TOPIC_ID = '16342';

//Variables for load.js
const PROGRAM_LOAD_REQUIRED_SELECTORS = ['[role=region]'];

//Program name constants
const PROGRAM_FULL_NAME = "New Twitter Image Searches and Stuff";
const PROGRAM_NAME = 'NTISAS';
const PROGRAM_SHORTCUT = 'ntisas';
const PROGRAM_CLICK = 'click.ntisas';
const PROGRAM_RCLICK = 'contextmenu.ntisas';
const PROGRAM_KEYDOWN = 'keydown.ntisas';

//Variables for storage.js
JSPLib.storage.twitterstorage = localforage.createInstance({
    name: 'Twitter storage',
    driver: [localforage.INDEXEDDB]
});
JSPLib.storage.batchstorage = localforage.createInstance({
    name: 'Batch storage',
    driver: [localforage.INDEXEDDB]
});
JSPLib.storage.localforage = localforage.createInstance({
    name: 'localforage',
    driver: [localforage.INDEXEDDB]
});

//Main program variable
const NTISAS = {};

//Program data constants
const PROGRAM_DATA_REGEX = /^(post|user|view|tweet|twuser|twimg|ntisas-available-sauce)-/; //Regex that matches the prefix of all program cache data

//For factory reset !!!These need to be set!!!
const LOCALSTORAGE_KEYS = [
    'ntisas-side-selection',
    'ntisas-database-length',
    'ntisas-user-data',
    'ntisas-color-style',
    'ntisas-recent-timestamp',
    //Boolean
    'ntisas-overflow',
    //Last ID
    'ntisas-postver-lastid',
    'ntisas-badver-lastid',
    //Timeouts
    'ntisas-timeout',
    'ntisas-length-recheck',
    'ntisas-badver-recheck',
    'ntisas-user-profile-recheck',
    'ntisas-prune-expires',
    //Semaphore
    'ntisas-process-semaphore-badvers',
    'ntisas-process-semaphore-records',
    'ntisas-process-semaphore-postvers',
];
const PROGRAM_RESET_KEYS = {
    page_stats: {},
};
const PROGRAM_DEFAULT_VALUES = {
    tweet_qtip: {},
    image_anchor: {},
    qtip_anchor: {},
    dialog_tweet: {},
    timeline_tweets: {},
    media_dialog: {},
    media_dialog_anchor: {},
    known_extensions: {},
    recorded_views: [],
    opened_menu: false,
    colors_checked: false,
    page_locked: false,
    import_is_running: false,
    seen_tweet: new Set(),
    no_confirm: new Set(),
    search_running: new Set(),
    download_running: new Set(),
    storage_data: {danbooru: {}, twitter: {}},
};

//Settings constants
const COMMON_QUERY_SETTINGS = ['pick_image', 'confirm_save', 'auto_save'];
const DEFAULT_QUERY_SETTINGS = ['pick_image', 'confirm_save'];

//Main settings
const SETTINGS_CONFIG = {
    IQDB_settings: {
        allitems: COMMON_QUERY_SETTINGS,
        reset: DEFAULT_QUERY_SETTINGS,
        validate: (data) => JSPLib.menu.validateCheckboxRadio(data, 'checkbox', COMMON_QUERY_SETTINGS),
        hint: "Check/uncheck to turn on/off setting."
    },
    sauce_settings: {
        allitems: COMMON_QUERY_SETTINGS,
        reset: DEFAULT_QUERY_SETTINGS,
        validate: (data) => JSPLib.menu.validateCheckboxRadio(data, 'checkbox', COMMON_QUERY_SETTINGS),
        hint: "Check/uncheck to turn on/off setting."
    },
    SauceNAO_API_key: {
        reset: "",
        parse: String,
        validate: JSPLib.validate.isString,
        hint: "Required to use SauceNAO queries. See <a href=\"http://saucenao.com\" target=\"_blank\">SauceNAO</a> for how to get an API key."
    },
    similarity_cutoff: {
        reset: 80.0,
        parse: parseFloat,
        validate: (data) => JSPLib.validate.isNumber(data) && data > 0 && data < 100,
        hint: "Minimum similiarity score of an image match to return. Valid values: 0 - 100."
    },
    results_returned: {
        reset: 5,
        parse: parseInt,
        validate: (data) => Number.isInteger(data) && data > 0 && data <= 20,
        hint: "Maximum number of results to return per image. Valid values: 1 - 20."
    },
    URL_wildcards_enabled: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Manual searches of URLs will use wildcards in the search. <b>Note:</b> This will make the search take longer or timeout."
    },
    recheck_interval: {
        reset: 10,
        parse: parseInt,
        validate: (data) => Number.isInteger(data) && data >= 5,
        hint: "Number of minutes. Valid values: >= 5. How often to check post versions once up to date."
    },
    custom_order_enabled: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Multi-post results will use <span class=\"ntisas-code\">order:custom</span>, showing results with Twitter's order. <b>Note:</b> This will break the tag limit for non-Gold+."
    },
    query_subdomain: {
        allitems: JSPLib.menu.domains,
        reset: ['danbooru'],
        validate: (data) => JSPLib.menu.validateCheckboxRadio(data, 'radio', JSPLib.menu.domains),
        hint: "Select which subdomain of Danbooru to query from. <b>Note:</b> The chosen subdomain must be logged into or the script will fail to work."
    },
    auto_unhide_tweets_enabled: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Automatically unhides sensitive Tweet content."
    },
    display_tweet_views: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays the the number of times a tweet has been seen."
    },
    display_profile_views: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays the the last visit occurrence to a user and their timelines."
    },
    self_tweet_highlights: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Highlights self tweets on the main/replies/media timelines."
    },
    display_user_id: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays the user ID on the main/replies/media timelines."
    },
    display_image_number: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays the image number as ordered by Twitter (tweet view only)."
    },
    display_tweet_statistics: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays tweets statistics for the current timeline in the side menu."
    },
    display_available_sauce: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays the number of available sauce in the side menu."
    },
    display_network_errors: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays network error count and controls in the side menu."
    },
    image_popout_enabled: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays the image without any clipping (stream view only)."
    },
    lock_page_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays controls in the side menu to allow page navigation to be locked."
    },
    media_timeline_enabled: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Processes tweets on the grid media timeline (uses additional network calls)."
    },
    use_alternate_tweets_API: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Uses an alternate API endpoint (media timline) to query multiple tweets. <b>Note:</b> This endpoint retrieves more tweets than needed, which will count towards the tweets viewed limit."
    },
    advanced_tooltips_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays extra information and thumbnails on IQDB results. <b>Note:</b> Only when the data is not auto-saved."
    },
    filename_prefix_format: {
        reset: "%TWEETID%--%IMG%",
        parse: String,
        validate: JSPLib.validate.isString,
        hint: "Prefix to add to original image downloads. Available format keywords include:<br><span class=\"ntisas-code\">%TWEETID%, %USERACCOUNT%, %IMG%, %DATE%, %TIME%, %ORDER%</span>."
    },
};

const ALL_IMPORT_TYPES = ['program_data', 'tweet_database'];
const CONTROL_CONFIG = {
    import_data: {
        display: `Import data (<span id="${PROGRAM_SHORTCUT}-import-counter">...</span>)`,
        value: "Click to import",
        hint: "Imports a JSON file containing cache and program data.",
    },
    export_types: {
        allitems: ALL_IMPORT_TYPES,
        value: ALL_IMPORT_TYPES,
        hint: "Select which types to export.",
    },
    export_data: {
        display: `Export data (<span id="${PROGRAM_SHORTCUT}-export-counter">...</span>)`,
        value: "Click to export",
        hint: "Exports cache and/or program data to a JSON file.",
    },
    cache_info: {
        value: "Click to populate",
        hint: "Calculates the cache usage of the program and compares it to the total usage. Does not include tweet data.",
    },
    purge_cache: {
        display: `Purge cache (<span id="${PROGRAM_SHORTCUT}-purge-counter">...</span>)`,
        value: "Click to purge",
        hint: `"Dumps all ${PROGRAM_NAME} data with expirations. Does not include tweet data.`,
    },
};

//CSS constants

const FONT_FAMILY = '\'Segoe UI\', Arial, sans-serif';
const BASE_PREVIEW_WIDTH = 160;
const POST_PREVIEW_DIMENSION = 150;
const TWEET_PREVIEW_DIMENSION = 300;

const PROGRAM_CSS = `
/**General*/
:root {
    --menu-height: 100px;
}
.ntisas-code {
    font-family: monospace;
}
.ntisas-narrow-text {
    letter-spacing: -1px;
}
.ntisas-horizontal-rule {
    border-top: 1px solid;
    margin: 10px;
}
.ntisas-vertical-rule {
    display: inline-block;
    border-left: 1px solid;
    height: 200px;
}
.ntisas-links a {
    cursor: pointer;
    text-decoration: none;
}
.ntisas-links a:hover {
    text-decoration: underline;
}
.ntisas-expanded-link {
   display: inline-block;
   position: relative;
   z-index: 1;
   padding: 8px;
   margin: -8px;
}
.ntisas-help-info,
.ntisas-help-info:hover {
    color: hotpink !important;
}
/**Side menu**/
#ntisas-side-menu {
    position: fixed;
    top: 1.5em;
    left: 1.5em;
    width: 300px;
    height: auto;
    font-size: 14px;
    font-family: ${FONT_FAMILY};
    z-index: 100;
}
#ntisas-side-border {
    border: 1px solid;
}
#ntisas-menu-header {
    padding: 2px;
    font-size: 18px;
    font-weight: bold;
    letter-spacing: -1px;
    text-align: center;
    cursor: move;
    border-bottom: solid 1px;
}
#ntisas-menu-selection {
    font-weight: bold;
    margin: 0 1em;
    padding: 0.1em;
}
#ntisas-menu-selection a {
    padding: 5px;
}
#ntisas-menu-info,
#ntisas-menu-controls {
    margin-left: 5px;
    font-weight: bold;
    line-height: 18px;
}
#ntisas-menu-info td,
#ntisas-menu-controls td {
    padding: 0 2px;
}
#ntisas-menu-info td:nth-of-type(1),
#ntisas-menu-info td:nth-of-type(2),
#ntisas-menu-controls td:nth-of-type(1),
#ntisas-menu-controls td:nth-of-type(2) {
    width: 115px;
}
#ntisas-stats-header {
    margin: 8px;
    font-size: 18px;
    font-weight: bold;
    line-height: 0.9;
}
#ntisas-stats-header span:nth-of-type(1) {
    text-decoration: underline;
}
#ntisas-tweet-stats-message {
    font-size: 14px;
    font-weight: bold;
    padding: 0 0.5em 0.5em;
}
#ntisas-tweet-stats-table {
    margin: 0.5em;
}
#ntisas-tweet-stats-table table {
    width: 95%;
    text-align: center;
}
#ntisas-tweet-stats-table tr:nth-of-type(1) th {
    padding-bottom: 5px;
}
#ntisas-tweet-stats-table tr:nth-of-type(3) th {
    padding: 5px 0;
}
#ntisas-tweet-stats-table th a {
    padding: 1px 5px;
    border-radius: 10px;
    border: solid 1px;
}
#ntisas-tweet-stats-table td {
    color: grey;
    border: 1px solid;
}
#ntisas-open-settings {
    margin: 0.5em;
    text-align: center;
}
#ntisas-open-settings input[type=button] {
    font-weight: bold;
    width: 19.5em;
    border-radius: 3px;
    padding: 0.25em 1em;
    cursor: pointer;
    border: 1px solid;
}
#ntisas-database-version,
#ntisas-install {
    color: #0073ff;
}
#ntisas-similar-toggle a,
#ntisas-current-records,
#ntisas-error-messages,
#ntisas-total-records {
    color: grey;
}
#ntisas-yes-confirm-upload,
#ntisas-yes-confirm-download,
#ntisas-enabled-view-highlights,
#ntisas-enabled-view-counts,
#ntisas-disabled-lockpage {
    color: green;
}
#ntisas-no-confirm-upload,
#ntisas-no-confirm-download,
#ntisas-disabled-view-highlights,
#ntisas-disabled-view-counts,
#ntisas-enabled-lockpage {
    color: red;
}
/**Timeline header**/
.ntisas-profile-section {
    font-size: 12px;
    font-family: monospace;
    letter-spacing: -1px;
    position: absolute;
    left: 29.25em;
    height: 4em;
    padding: 7px;
    width: 18em;
    top: -1em;
    border: 1px solid;
}
.ntisas-profile-user-id,
.ntisas-profile-user-view,
.ntisas-profile-stream-view {
    display: flex;
    border-bottom: 1px solid #CCC;
}
/**Tweet**/
[ntisas-tweet] .ntisas-retweet-marker {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    display: inline-block;
    white-space: nowrap;
}
[ntisas-tweet] .ntisas-status-marker {
    margin-left: 4px;
}
[ntisas-tweet] .ntisas-tweet-status > .ntisas-status-marker {
    margin-left: 3.75em;
    display: flex;
    padding-top: 2px;
}
[ntisas-tweet] .ntisas-tweet-status > .ntisas-status-marker > span {
    margin-right: 2px;
}
[ntisas-tweet] .ntisas-already-seen,
[ntisas-tweet] .ntisas-view-info {
    font-size: 12px;
    font-family: monospace;
    font-weight: bold;
    border: 1px solid;
    padding: 2px;
    border-radius: 5px;
}
.ntisas-self-tweet-highlights [ntisas-tweet].ntisas-self-tweet .ntisas-display-name {
    background-color: rgba(255,255,0,0.5);
}
[ntisas-tweet] .ntisas-tweet-left {
    border: 1px solid transparent;
    border-radius: 25px;
}
.ntisas-show-views [ntisas-tweet].ntisas-viewed .ntisas-tweet-left,
.ntisas-show-views [ntisas-tweet].ntisas-seen .ntisas-tweet-left {
    height: calc(100% - var(--menu-height));
    position: relative;
}
.ntisas-show-views [ntisas-tweet].ntisas-seen .ntisas-seen-indicator {
    position: absolute;
    bottom: 3px;
    width: 80%;
    border: 1px solid;
    aspect-ratio: 1/1;
    border-radius: 25px;
}
[ntisas-tweet=main] .ntisas-tweet-status {
    display: inline-block;
    height: 34px;
}
[ntisas-tweet=stream] .ntisas-footer-section {
    margin-bottom: 0.5em;
}
[ntisas-tweet=main] .ntisas-tweet-media,
[ntisas-tweet=main] .ntisas-time-line {
    margin-bottom: 10px;
}
/**Tweet menu**/
[ntisas-tweet] .ntisas-tweet-image-menu {
    display: flex;
    border: 2px solid;
}
[ntisas-tweet] .ntisas-tweet-header {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 4em;
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 1.4em;
    font-weight: bold;
    border-right: 1px solid;
}
[ntisas-tweet] .ntisas-tweet-header a {
    padding: 8px 12px;
    margin: -8px -12px;
}
[ntisas-tweet] .ntisas-image-section {
    margin-top: 0.2em;
    min-height: 2.2em;
    white-space: nowrap;
}
[ntisas-tweet] [data-has-posts=true],
[ntisas-tweet] [data-has-posts=true]:hover,
[ntisas-tweet] [data-has-posts=true]:focus {
    color: green;
}
[ntisas-tweet] [data-has-posts=false],
[ntisas-tweet] [data-has-posts=false]:hover,
[ntisas-tweet] [data-has-posts=false]:focus {
    color: red;
}
[ntisas-tweet] .ntisas-link-menu {
    display: flex;
}
[ntisas-tweet] .ntisas-control-search,
[ntisas-tweet] .ntisas-control-search:hover,
[ntisas-tweet] .ntisas-control-confirm,
[ntisas-tweet] .ntisas-control-confirm:hover,
[ntisas-tweet] .ntisas-control-upload,
[ntisas-tweet] .ntisas-control-upload:hover,
[ntisas-tweet] .ntisas-control-download,
[ntisas-tweet] .ntisas-control-download:hover {
    color: grey;
}
[ntisas-tweet] .ntisas-query-button {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 5.5em;
    height: 1.75em;
    border: 1px solid;
    padding: 4px;
}
[ntisas-tweet] .ntisas-query-button.ntisas-menu-active a,
[ntisas-tweet] .ntisas-query-button.ntisas-menu-active a:hover {
    color: white;
}
[ntisas-tweet] .ntisas-menu-results {
    border-radius: 25px 0 0 25px;
    width: 9.5em;
}
[ntisas-tweet] .ntisas-menu-help {
    border-radius: 0 25px 25px 0;
    width: 2em;
}
[ntisas-tweet=main] .ntisas-image-section {
    padding-left: 0.4em;
}
[ntisas-tweet=stream] .ntisas-image-section {
    padding-left: 0.3em;
}
[ntisas-tweet=media] .ntisas-image-section {
    padding-left: 0.75em;
}
[ntisas-tweet=stream] .ntisas-tweet-controls {
    margin-top: 0.5em;
    margin-left: -4em;
}
[ntisas-tweet=main] .ntisas-tweet-image-menu {
    height: 2.6em;
}
[ntisas-tweet=stream] .ntisas-tweet-image-menu,
[ntisas-tweet=media] .ntisas-tweet-image-menu {
    height: 2.5em;
}
[ntisas-tweet=main] .ntisas-tweet-header {
    padding: 5px 6px;
}
[ntisas-tweet=stream] .ntisas-tweet-header,
[ntisas-tweet=media] .ntisas-tweet-header {
    padding: 4px 6px;
}
[ntisas-tweet=main] .ntisas-image-section {
    font-size: 1.1em;
}
[ntisas-tweet=main] .ntisas-link-menu {
    font-weight: bold;
    font-family: ${FONT_FAMILY};
}
[ntisas-tweet=stream] .ntisas-link-menu,
[ntisas-tweet=media] .ntisas-link-menu {
    font-size: 1.125em;
    letter-spacing: -1px;
    font-weight: bold;
    min-width: 250px;
    font-family: ${FONT_FAMILY};
}
/**Media tweet**/
.ntisas-media-tweet .ntisas-media-icon-container {
    bottom: 10px;
    right: 10px;
    margin: -8px;
    padding: 8px;
    position: absolute;
}
.ntisas-media-tweet .ntisas-media-icon {
    display: flex;
    width: 35px;
    height: 20px;
    border-radius: 25px;
    background-color: white;
    border: 1px solid black;
}
.ntisas-media-tweet .ntisas-media-icon:hover {
    box-shadow: 0 0 0 2px;
}
.ntisas-media-tweet .ntisas-media-icon-section {
    display: flex;
    width: 50%;
    height: 100%;
    font-family: monospace;
    font-weight: bold;
    justify-content: center;
    align-items: center;
}
.ntisas-media-tweet .ntisas-media-results {
    border-radius: 25px 0 0 25px;
    color: white;
}
.ntisas-media-tweet .ntisas-media-match {
    background-color: green;
}
.ntisas-media-tweet .ntisas-media-nomatch {
    background-color: grey;
}
.ntisas-media-tweet .ntisas-media-counter {
    border-radius: 0 25px 25px 0;
    background-color: white;
    color: black;
}
.ntisas-show-views .ntisas-media-tweet .ntisas-media-view-icon {
    position: absolute;
    top: 10px;
    left: 10px;
    width: 15px;
    height: 15px;
    border-radius: 5px;
    border: 1px solid rgba(0,0,0,0.5);
    background-color: rgba(255,255,255,0.6);
}
/**Media menu**/
.ntisas-media-menu .ntisas-media-images {
    display: flex;
    flex-wrap: wrap;
    margin: 15px;
}
.ntisas-media-menu .ntisas-media-images .ntisas-media-image,
.ntisas-media-menu .ntisas-media-images .ntisas-media-video {
    display: inline-block;
    margin: 20px;
    width: 240px;
    height: 240px;
    text-align: center;
}
.ntisas-media-menu .ntisas-media-images .ntisas-media-video {
    position: relative;
}
.ntisas-media-menu .ntisas-media-images .ntisas-video-icon {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
}
/**Qtips**/
.qtiptisas.qtiptisas-twitter {
    max-width: none;
}
.ntisas-qtip-container {
    font-size: 15px;
    font-family: ${FONT_FAMILY};
    line-height: normal;
}
/**Media popups**/
.ntisas-image-tooltip .qtiptisas-content,
.ntisas-image-tooltip .qtiptisas-content img {
    max-width: 900px;
}
.ntisas-popup-media-image,
.ntisas-popup-media-video {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    max-width: 80vw;
    max-height: 80vh;
    overflow: auto;
    z-index: 2000;
}
.ntisas-preview-popup {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    max-height: 80vh;
    overflow-y: auto;
    z-index: 2000;
    overscroll-behavior: contain;
    background: white;
}
.ntisas-preview-popup img {
    max-width: 80vw;
    height: auto;
}
/**Post result popup**/
.ntisas-preview-tooltip .qtiptisas-content {
    max-height: 500px;
    overflow-y: auto;
    overscroll-behavior: contain;
}
.ntisas-post-result h4 {
    margin-top: 0;
    margin-bottom: 5px;
    font-size: 16px;
    font-weight: bold;
}
.ntisas-post-result .ntisas-image-container {
    border: solid 5px;
}
.ntisas-post-result .ntisas-post-select .ntisas-image-container {
    border: solid 5px transparent;
}
.ntisas-post-result .ntisas-post-select.ntisas-post-match .ntisas-image-container {
    border: solid 5px rgba(0,128,0,0.75);
}
/**Dialogs**/
.ui-dialog.ui-dialog-twitter.ntisas-dialog {
    z-index: 1010;
}
.ui-dialog .ntisas-dialog-close.ui-dialog-titlebar-close {
    font-size: 0;
    margin-right: 5px;
}
.ui-dialog .ntisas-dialog-close.ui-dialog-titlebar-close .ui-icon-closethick {
    margin: -8px;
}
.ntisas-dialog-container {
    font-size: 15px;
    font-family: ${FONT_FAMILY};
    line-height: normal;
}
.ntisas-preview-section {
    display: flex;
    flex-wrap: wrap;
    max-height: 75vh;
    overflow-y: auto;
    overscroll-behavior: contain;
}
/**Search dialog**/
.ntisas-confirm-image .ntisas-image-container {
    border: solid 5px transparent;
}
.ntisas-confirm-image .ntisas-post-select .ntisas-image-container {
    border: solid 5px rgba(0,0,255,0.75);
}
.ntisas-search-dialog .ntisas-desc-title a {
    color: dodgerblue;
}
/**Confirm dialog**/
.ntisas-similar-container {
    max-height: 75vh;
    overflow-y: auto;
    overscroll-behavior: contain;
}
.ntisas-similar-result {
    position: relative;
}
.ntisas-similar-header {
    font-weight: bold;
    display: inline-block;
    border: 1px solid;
    border-radius: 5px;
    height: 90%; padding: 5px;
    vertical-align: top;
}
.ntisas-similar-header-text {
    writing-mode: vertical-lr;
    text-orientation: upright;
}
.ntisas-similar-header-help {
    margin-top: 1em;
}
.ntisas-similar-result .ntisas-post-select.ntisas-post-match .ntisas-image-container {
    border: solid 5px rgba(0,128,0,0.75);
}
.ntisas-similar-result .ntisas-image-container {
    border: solid 5px;
}
.ntisas-similar-result .ntisas-post-select .ntisas-image-container,
.ntisas-similar-result .ntisas-tweet-preview .ntisas-image-container {
    border: solid 5px transparent;
}
.ntisas-no-results {
    font-style: italic;
    display: inline-block;
    height: 200px;
    width: 160px;
    position: relative;
}
.ntisas-no-results > span {
    position: absolute;
    top: 2em;
    left: 2em;
}
/**Upload dialog**/
.ntisas-upload-dialog .ntisas-desc-title a {
    color: orange;
}
/**Download dialog**/
.ntisas-download-dialog .ntisas-desc-title a {
    min-width: 5.5em;
}
.ntisas-download-dialog .ntisas-desc-title a.ntisas-active {
    color: green;
}
/**Post preview**/
.ntisas-post-preview {
    display: inline-block;
    width: ${BASE_PREVIEW_WIDTH}px;
    text-align: center;
    font-family: ${FONT_FAMILY};
}
.ntisas-post-preview .ntisas-image-container {
    height: ${POST_PREVIEW_DIMENSION}px;
    width: ${POST_PREVIEW_DIMENSION}px;
    margin: 0 auto 5px;
}
.ntisas-post-preview img {
    max-width: ${POST_PREVIEW_DIMENSION}px;
    max-height: ${POST_PREVIEW_DIMENSION}px;
    overflow: hidden;
}
.ntisas-post-upload::before {
    content: "";
    display: inline-block;
    background-image: url(data:image/svg+xml,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22iso-8859-1%22%3F%3E%0D%0A%3Csvg%20version%3D%221.1%22%20id%3D%22Capa_1%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20xmlns%3Axlink%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxlink%22%20x%3D%220px%22%20y%3D%220px%22%0D%0A%09%20width%3D%2215%22%20height%3D%2215%22%20viewBox%3D%220%200%2053.867%2053.867%22%20style%3D%22enable-background%3Anew%200%200%2053.867%2053.867%3B%22%20xml%3Aspace%3D%22preserve%22%3E%0D%0A%3Cpolygon%20style%3D%22fill%3A%23EFCE4A%3B%22%20points%3D%2226.934%2C1.318%2035.256%2C18.182%2053.867%2C20.887%2040.4%2C34.013%2043.579%2C52.549%2026.934%2C43.798%20%0D%0A%0910.288%2C52.549%2013.467%2C34.013%200%2C20.887%2018.611%2C18.182%20%22%2F%3E%0D%0A%3Cg%3E%0D%0A%3C%2Fg%3E%0D%0A%3Cg%3E%0D%0A%3C%2Fg%3E%0D%0A%3Cg%3E%0D%0A%3C%2Fg%3E%0D%0A%3Cg%3E%0D%0A%3C%2Fg%3E%0D%0A%3Cg%3E%0D%0A%3C%2Fg%3E%0D%0A%3Cg%3E%0D%0A%3C%2Fg%3E%0D%0A%3Cg%3E%0D%0A%3C%2Fg%3E%0D%0A%3Cg%3E%0D%0A%3C%2Fg%3E%0D%0A%3Cg%3E%0D%0A%3C%2Fg%3E%0D%0A%3Cg%3E%0D%0A%3C%2Fg%3E%0D%0A%3Cg%3E%0D%0A%3C%2Fg%3E%0D%0A%3Cg%3E%0D%0A%3C%2Fg%3E%0D%0A%3Cg%3E%0D%0A%3C%2Fg%3E%0D%0A%3Cg%3E%0D%0A%3C%2Fg%3E%0D%0A%3Cg%3E%0D%0A%3C%2Fg%3E%0D%0A%3C%2Fsvg%3E);
    background-repeat: no-repeat;
    background-size: 1em;
    width: 1em;
    height: 1em;
    padding-right: 0.5em;
}
/**Tweet preview**/
.ntisas-illust-preview {
    display: inline-block;
    width: ${TWEET_PREVIEW_DIMENSION + 10}px;
    text-align: center;
    font-family: ${FONT_FAMILY};
    margin-bottom: 1em;
}
.ntisas-illust-preview .ntisas-image-container {
    height: ${TWEET_PREVIEW_DIMENSION}px;
    width: ${TWEET_PREVIEW_DIMENSION}px;
    margin: 0 auto 5px;
}
.ntisas-illust-preview img {
    max-width: ${TWEET_PREVIEW_DIMENSION}px;
    max-height: ${TWEET_PREVIEW_DIMENSION}px;
    overflow: hidden;
}
.ntisas-illust-preview .ntisas-desc {
    font-size: 1.05em;
    line-height: 100%;
    letter-spacing: 1px;
}
/**Preview descriptions**/
.ntisas-desc {
    font-size:12px;
    margin-bottom: 2px;
    margin-top: 0;
}
.ntisas-desc-title {
    font-weight: bold;
}
.ntisas-desc-info {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
/**Select controls**/
.ntisas-select-controls {
    position: absolute;
    right: 5px;
    top: 3em;
    width: 4em;
    text-align: center;
}
.ntisas-select-controls div {
    padding: 5px;
    border: 2px solid;
}
.ntisas-select-controls div:first-of-type {
    border-bottom: 1px solid;
    border-radius: 5px 5px 0 0;
}
.ntisas-select-controls div:last-of-type {
    border-top: 1px solid;
    border-radius: 0 0 5px 5px;
}
.ntisas-select-controls > div > a {
    font-weight: bold;
    font-size: 14px;
}`;

const NOTICE_CSS = `
div#ntisas-notice.ui-state-highlight {
    color: #5f3f3f;
    background-color: #fffbbf;
    border: 1px solid #ccc999;
}
div#ntisas-notice.ui-state-error {
    color: #5f3f3f;
    background-color: #fddfde;
    border: 1px solid #fbc7c6;
}
div#ntisas-notice {
    border: 1px solid #dad55e;
    background: #fffa90;
    color: #777620;
    z-index: 1050;
    max-height: 90vh;
    overflow: auto;
}
#ntisas-close-notice-link {
    bottom: 0;
}`;

const IMAGE_NUMBER_CSS = `
.ntisas-image-num > div:before {
    content: '%s';
    margin-top: %spx;
    margin-left: %spx;
    position: absolute;
    background: rgba(0,0,0,0.3);
    width: 100%;
    height: 100%;
    pointer-events: none;
    text-align: center;
    font-size: 500%;
    line-height: 200%;
    font-family: arial;
    color: rgba(255,255,255,0.6);
}`;

const MENU_CSS = `
#new-twitter-image-searches-and-stuff {
    z-index: 1001;
    font-size: 14px;
}
#new-twitter-image-searches-and-stuff p {
    margin-bottom: 1em;
}
#new-twitter-image-searches-and-stuff h4 {
    font-size: 1.16667em;
    line-height: 1.5em;
    margin: 0;
}
#new-twitter-image-searches-and-stuff .prose h2 {
    font-size: 1.8em;
    padding: 0.25em;
    line-height: 1em;
    margin: 0;
}
#new-twitter-image-searches-and-stuff .prose h4 {
    font-size: 1.4em;
    padding: .8em 0 .25em;
    margin: 0;
}
#new-twitter-image-searches-and-stuff a {
    font-weight:bold;
    text-decoration: none;
    cursor: pointer;
}
#new-twitter-image-searches-and-stuff .prose a:hover,
#new-twitter-image-searches-and-stuff .ntisas-menu-tooltip a:hover,
#new-twitter-image-searches-and-stuff .ntisas-linkclick a:hover {
    text-decoration: underline;
}
#new-twitter-image-searches-and-stuff b {
    font-weight: bold;
}
#new-twitter-image-searches-and-stuff #ntisas-tabs a {
    color: unset;
}
#new-twitter-image-searches-and-stuff ul:not(#ntisas-tabs) {
    margin-left: 1em;
    padding-left: 0;
}
#new-twitter-image-searches-and-stuff ul:not(#ntisas-tabs) li {
    list-style-type: disc;
    margin-left: 0.5em;
}
.ntisas-textinput input {
    width: unset;
}
#ntisas-console {
    width: unset;
    min-width: unset;
}
#ntisas-settings {
    width: 100%;
    min-width: unset;
}
#ntisas-settings > div {
    overflow-y: auto;
    height: 460px;
}
#ntisas-import-file,
#ntisas-settings-buttons input,
.ntisas-textinput input{
    color: black;
    background-color: white;
}
#ntisas-import-data-errors {
    border: 1px solid grey;
}
#new-twitter-image-searches-and-stuff .ntisas-selectors label {
    width: 140px;
}
#new-twitter-image-searches-and-stuff .ntisas-striped {
    border-collapse: collapse;
    border-spacing: 0;
}
#new-twitter-image-searches-and-stuff .ntisas-striped td,
#new-twitter-image-searches-and-stuff .ntisas-striped th {
    padding: 4px 6px;
}
#new-twitter-image-searches-and-stuff .ntisas-striped thead th {
    font-weight: 700;
    text-align: left;
}
#ntisas-script-message > div {
    display: inline-block;
}
#ntisas-forum-message {
    padding: 0 1em;
}
#ntisas-available-hotkeys {
    float: right;
    margin-bottom: -1px;
}
#ntisas-available-hotkeys-title {
    font-size: 125%;
    padding-left: 0.5em;
}
/**FIXES**/
.jsplib-checkbox > div {
    display: inline-block;
    text-indent: -1.7em;
    margin-left: 2em;
}`;

const COLOR_CSS = `
/**General**/
.ntisas-code {
    background-color: %TEXTFADED%;
}
.ntisas-horizontal-rule {
    border-top-color: %TEXTSHADED%;
    margin: 10px;
}
.ntisas-vertical-rule {
    display: inline-block;
    border-left-color: %TEXTSHADED%;
    height: 200px;
}
/**Side menu**/
#ntisas-side-menu {
    color: %TEXTCOLOR%;
    background-color: %BACKGROUNDCOLOR%;
    border-bottom-color: %TEXTSHADED%;
}
#ntisas-side-border {
    border-color: %TEXTMUTED%;
}
#ntisas-menu-header {
    background-color: %BASEFAINT%;
    border-bottom-color: %TEXTMUTED%;
}
#ntisas-menu-selection {
    background-color: %TEXTFADED%;
}
#ntisas-menu-selection a {
    color: %TEXTSHADED%;
}
#ntisas-menu-selection a.ntisas-selected {
    color: %BASECOLOR%;
}
#ntisas-menu-info td:nth-of-type(3),
#ntisas-menu-controls td:nth-of-type(3) {
    color: %TEXTSHADED%;
}
#ntisas-available-sauce {
    color: %TEXTSHADED%;
}
#ntisas-stats-header span:nth-of-type(2) {
    color: %TEXTSHADED%;
}
#ntisas-tweet-stats-message {
    color: %TEXTMUTED%;
}
#ntisas-tweet-stats-table th {
    color: %TEXTSHADED%;
}
#ntisas-tweet-stats-table th a {
    color: %BASECOLOR%;
}
#ntisas-tweet-stats-table th a {
    border-color: %BASECOLOR%;
}
#ntisas-tweet-stats-table th a:hover {
    background-color: %BASEFAINT%;
}
#ntisas-open-settings input[type=button] {
    color: %TEXTCOLOR%;
    background-color: %BACKGROUNDCOLOR%;
    border-color: %TEXTSHADED%;
}
/**Timeline header**/
.ntisas-profile-section {
    color: %TEXTSHADED%;
    background-color: %BACKGROUNDCOLOR%;
    border-color: %TEXTFADED%;
}
/**Tweet**/
[ntisas-tweet].ntisas-seen .ntisas-already-seen {
    color: %BASECOLOR%;
    border-color: %BASECOLOR%;
}
.ntisas-view-info {
    color: %TEXTSHADED%;
    border-color: %TEXTSHADED%;
}
.ntisas-show-views [ntisas-tweet].ntisas-viewed .ntisas-tweet-left {
    border-color: %TEXTMUTED%;
    background-color: %TEXTFADED%;
}
.ntisas-show-views [ntisas-tweet].ntisas-seen:not(.ntisas-viewed) .ntisas-tweet-left {
    border-color: %BASEDARKER%;
}
.ntisas-show-views [ntisas-tweet].ntisas-seen .ntisas-seen-indicator {
    border-color: %BASEDARKER%;
    background-color: %BASECOLOR%;
}
/**Tweet menu**/
[ntisas-tweet] .ntisas-tweet-header {
    background-color: %BASEFAINT%;
    border-right-color: %TEXTMUTED%;
}
[ntisas-tweet] .ntisas-tweet-header:hover {
    background-color: %BASECOLOR%;
}
[ntisas-tweet] .ntisas-tweet-header a {
    color: %TEXTCOLOR%;
}
[ntisas-tweet=stream] .ntisas-tweet-controls {
    background-color: %BACKGROUNDCOLOR%;
}
[ntisas-tweet] .ntisas-tweet-image-menu {
    border-color: %TEXTMUTED%;
}
[ntisas-tweet] .ntisas-link-menu {
    color: %TEXTCOLOR%;
    border-color: %TEXTFADED%;
}
[ntisas-tweet] .ntisas-query-button {
    background-color: %BACKGROUNDCOLOR%;
    border-color: %TEXTSHADED%;
}
[ntisas-tweet] .ntisas-query-button:hover {
    background-color: %TEXTFADED%;
}
[ntisas-tweet] .ntisas-query-button.ntisas-menu-active {
    background-color: %BASECOLOR%;
    border-color: %BASEDARKER%;
}
[ntisas-tweet] .ntisas-query-button.ntisas-menu-active:hover {
    background-color: %BASESHADED%;
}
/**Media menu**/
.ntisas-media-menu .ntisas-media-images .ntisas-media-image,
.ntisas-media-menu .ntisas-media-images .ntisas-media-video {
    box-shadow: 0 0 0 4px %BACKGROUNDCOLOR%, 0 0 0 6px %TEXTFADED%;
}
/**Qtips**/
.qtiptisas.qtiptisas-twitter {
    color: %TEXTCOLOR%;
    background-color: %BACKGROUNDCOLOR%;
    border: 1px solid %TEXTSHADED%;
}
/**Post result popup**/
.ntisas-post-result .ntisas-image-container {
    border-color: %TEXTCOLOR%;
}
/**Dialogs**/
.ui-dialog.ui-dialog-twitter.ntisas-dialog,
.ui-dialog.ui-dialog-twitter.ntisas-dialog .ui-widget-content,
.ui-dialog.ui-dialog-twitter.ntisas-dialog .ui-state-default {
    color: %TEXTCOLOR%;
    background: %BACKGROUNDCOLOR%;
}
.ui-dialog.ui-dialog-twitter.ntisas-dialog,
.ui-dialog.ui-dialog-twitter.ntisas-dialog .ui-tabs,
.ui-dialog.ui-dialog-twitter.ntisas-dialog .ui-state-default {
    border: 1px solid %TEXTSHADED%;
}
.ui-dialog.ui-dialog-twitter.ntisas-dialog .ui-tabs-nav,
.ui-dialog.ui-dialog-twitter.ntisas-dialog .ui-dialog-titlebar,
.ui-dialog.ui-dialog-twitter.ntisas-dialog .ui-dialog-buttonpane {
    border: 1px solid %TEXTFADED%;
}
.ui-dialog.ui-dialog-twitter.ntisas-dialog .ui-state-active .ui-icon-background {
    border: 4px solid %BASEDARKER%;
}
.ui-dialog.ui-dialog-twitter.ntisas-dialog .ui-widget-header {
    color: %TEXTCOLOR%;
    background-color: %BASESHADED%;
}
.ui-dialog.ui-dialog-twitter.ntisas-dialog .ui-button {
    color: %TEXTCOLOR%;
    background-color: %BASEFAINT%;
    border: 1px solid %BASESHADED%;
}
.ui-dialog.ui-dialog-twitter.ntisas-dialog .ui-button:hover,
.ui-dialog.ui-dialog-twitter.ntisas-dialog .ui-tab:hover {
    background-color: %BASESHADED%;
    border: 1px solid %BASECOLOR%;
}
.ui-dialog.ui-dialog-twitter.ntisas-dialog .ui-widget-content .ui-state-active,
.ui-dialog.ui-dialog-twitter.ntisas-dialog .ui-widget-content .ui-state-active:focus {
    color: %BACKGROUNDCOLOR%;
    background-color: %BASECOLOR%;
    border: 1px solid %BASEDARKER%;
}
.ui-dialog.ui-dialog-twitter.ntisas-dialog .ui-button:hover,
.ui-dialog.ui-dialog-twitter.ntisas-dialog .ui-widget-content .ui-state-active:active,
.ui-dialog.ui-dialog-twitter.ntisas-dialog .ui-widget-content .ui-state-active:focus {
    box-shadow: 0 0 0 2px %BACKGROUNDCOLOR%, 0 0 0 4px %BASECOLOR%;
}
/**Confirm dialog**/
.ntisas-similar-header {
    color: %TEXTCOLOR%;
    border-color: %BASESHADED%;
    background-color: %BASEFAINT%;
}
.ntisas-similar-header-help {
    color: %TEXTSHADED%;
}
.ntisas-similar-result .ntisas-image-container {
    border-color: %TEXTCOLOR%;
}
/**Select controls**/
.ntisas-select-controls div {
    border-color: %TEXTMUTED%;
    background-color: %TEXTFADED%;
}
.ntisas-select-controls div:first-of-type {
    border-bottom-color: %TEXTMUTED%;
}
.ntisas-select-controls div:last-of-type {
    border-top-color: %TEXTMUTED%;
}
.ntisas-select-controls > div > a {
    color: %BASECOLOR%;
}`;

const MENU_COLOR_CSS = `
/**Settings menu**/
#new-twitter-image-searches-and-stuff a {
    color: %BASECOLOR%;
}
#new-twitter-image-searches-and-stuff .ntisas-striped thead th {
    color: %TEXTSHADED%;
}
#new-twitter-image-searches-and-stuff .ntisas-striped thead tr {
    border-bottom: 2px solid %TEXTSHADED%;
}
#new-twitter-image-searches-and-stuff .ntisas-striped tbody tr {
    border-bottom: 1px solid %TEXTFADED%;
}
#new-twitter-image-searches-and-stuff .jsplib-expandable {
    border: 1px inset %TEXTCOLOR%;
}
#new-twitter-image-searches-and-stuff .jsplib-expandable-content {
    border-top: 1px solid %TEXTMUTED%;
}
#ntisas-available-hotkeys-title {
    color: %BASESHADED%;
}
.jsplib-inline-tooltip,
.jsplib-block-tooltip {
    color: %TEXTSHADED%;
}`;

//HTML constants

const HORIZONTAL_RULE = '<div class="ntisas-horizontal-rule"></div>';

const SETTINGS_MENU = `<div id="new-twitter-image-searches-and-stuff" title="${PROGRAM_NAME} Settings"></div>`;

const IMPORT_FILE_INPUT = '<div class="jsplib-menu-item"><h4>Import file</h4><input size="50" type="file" name="ntisas-import-file" id="ntisas-import-file"></div>';

const IMPORT_ERROR_DISPLAY = '<div id="ntisas-import-data-errors" style="display:none"></div>';

const NTISAS_MENU = `
<div id="ntisas-script-message" class="prose">
    <h2>${PROGRAM_FULL_NAME}</h2>
    <div id="ntisas-forum-message">
        <p>Check the forum for the latest on information and updates (<a class="ntisas-forum-topic-link" target="_blank">topic #${DANBOORU_TOPIC_ID}</a>).</p>
    </div>
    <div id="ntisas-available-hotkeys">
        <div id="ntisas-available-hotkeys-title"><b>Available hotkeys</b>:</div>
        <table class="ntisas-striped">
            <thead><tr>
                <th>Open</th>
                <th>Close</th>
                <th>Save</th>
                <th>Reset</th>
            </thead></tr>
            <tbody><tr>
                <td>Alt+M</td>
                <td>Alt+C</td>
                <td>Alt+S</td>
                <td>Alt+R</td>
            </tbody></tr>
        </table>
    </div>
</div>
<div id="ntisas-console" class="jsplib-console">
    <div id="ntisas-settings" class="jsplib-outer-menu">
        <ul id="ntisas-tabs">
            <li><a href="#ntisas-display-settings">Display</a></li>
            <li><a href="#ntisas-function-settings">Function</a></li>
            <li><a href="#ntisas-query-settings">Query</a></li>
            <li><a href="#ntisas-network-settings">Network</a></li>
            <li><a href="#ntisas-download-settings">Download</a></li>
            <li><a href="#ntisas-cache-controls">Cache</a></li>
            <li><a href="#ntisas-database-controls">Database</a></li>
        </ul>
        <div id="ntisas-display-settings" class="jsplib-settings-grouping">
            <div id="ntisas-display-message" class="prose">
                <h4>Display settings</h4>
            </div>
        </div>
        <div id="ntisas-function-settings" class="jsplib-settings-grouping">
            <div id="ntisas-function-message" class="prose">
                <h4>Function settings</h4>
            </div>
        </div>
        <div id="ntisas-query-settings" class="jsplib-settings-grouping">
            <div id="ntisas-query-message" class="prose">
                <h4>Query settings</h4>
            </div>
        </div>
        <div id="ntisas-network-settings" class="jsplib-settings-grouping">
            <div id="ntisas-network-message" class="prose">
                <h4>Network settings</h4>
            </div>
        </div>
        <div id="ntisas-download-settings" class="jsplib-settings-grouping">
            <div id="ntisas-download-message" class="prose">
                <h4>Download settings</h4>
            </div>
        </div>
        <div id="ntisas-cache-controls" class="jsplib-settings-grouping">
            <div id="ntisas-cache-message" class="prose">
                <h4>Cache controls</h4>
            </div>
        </div>
        <div id="ntisas-database-controls" class="jsplib-settings-grouping">
            <div id="ntisas-database-message" class="prose">
                <h4>Database controls</h4>
            </div>
        </div>
    </div>
</div>`;

const QUERY_SETTINGS_DETAILS = `
<ul>
    <li><b>Pick image:</b> Prompt the user on which images to query when there is more than one image.</li>
    <li><b>Confirm save:</b> Prompt the user on which images to save from the results.
        <ul>
            <li>When disabled, the thumbnail and post ID links behave as regular links.</li>
            <li>Additionally, the results of the query are not saveable.</li>
        </ul>
    </li>
    <li><b>Auto save:</b> Automatically saves any matches from the results.</li>
</ul>
<p><b>Note:</b> Sauce may be limited. Check <a href="http://saucenao.com" target="_blank">SauceNAO</a> for details.`;

const SIDE_MENU = `
<div id="ntisas-side-menu" class="ntisas-links" style="display: none;">
<div id="ntisas-side-border">
    <div id="ntisas-menu-header">${PROGRAM_FULL_NAME}</div>
    <div id="ntisas-menu-selection">
        <a id="ntisas-select-info" data-selector="info">Info</a>
        <a id="ntisas-select-controls" data-selector="controls">Controls</a>
        <a id="ntisas-select-info" data-selector="statistics">Statistics</a>
    </div>
    ${HORIZONTAL_RULE}
    <div id="ntisas-content">
        <div id="ntisas-menu-info" data-selector="info" style="display:none">
            <table>
                <tbody>
                <tr>
                    <td><span id="ntisas-version-header" class="ntisas-narrow-text">Database version:</span></td>
                    <td><span id="ntisas-database-link"></span></td>
                    <td>(<span id="ntisas-database-help"></span>)</td>
                </tr>
                <tr>
                    <td><span>Current records:</span></td>
                    <td>%CURRENTRECORDS%</td>
                    <td><span id="ntisas-current-records-help">(%CURRENTHELP%)</span></td>
                </tr>
                <tr>
                    <td><span>Total records:</span></td>
                    <td><span id="ntisas-records-stub"></span></td>
                    <td>(%RECORDSHELP%)</td>
                </tr>
                <tr data-setting="display_available_sauce">
                    <td><span>Available sauce:</span></td>
                    <td><span id="ntisas-available-sauce">N/A</span></td>
                    <td>(%SAUCEHELP%)</td>
                </tr>
                <tr data-setting="display_network_errors">
                    <td><span>Network errors:</span></td>
                    <td><a id="ntisas-error-messages">%ERRORMESSAGES%</a></td>
                    <td>(%ERRORMESSAGESHELP%)</td>
                </tr>
                </tbody>
            </table>
        </div>
        <div id="ntisas-menu-controls" data-selector="controls" style="display:none">
            <table>
                <tbody>
                <tr>
                    <td><span>Search source:</span></td>
                    <td>%SIMILAR_SOURCE%</td>
                    <td>(%SIMILAR_SOURCE_HELP%)</td>
                </tr>
                <tr>
                    <td><span>Confirm upload:</span></td>
                    <td>%CONFIRM_UPLOAD%</td>
                    <td>(%CONFIRM_UPLOAD_HELP%)</td>
                </tr>
                <tr>
                    <td><span class="ntisas-narrow-text">Confirm download:</span></td>
                    <td>%CONFIRM_DOWNLOAD%</td>
                    <td>(%CONFIRM_DOWNLOAD_HELP%)</td>
                </tr>
                <tr data-setting="display_tweet_views">
                    <td><span>View indicators:</span></td>
                    <td>%VIEW_HIGHLIGHTS%</td>
                    <td>(%VIEW_HIGHLIGHTS_HELP%)</td>
                </tr>
                <tr data-setting="display_tweet_views">
                    <td><span>Count views:</span></td>
                    <td>%VIEW_COUNTS%</td>
                    <td>(%VIEW_COUNTS_HELP%)</td>
                </tr>
                <tr data-setting="lock_page_enabled">
                    <td><span>Page navigation:</span></td>
                    <td>%LOCKPAGE%</td>
                    <td>(%LOCKPAGEHELP%)</td>
                </tr>
                </tbody>
            </table>
        </div>
        <div id="ntisas-menu-statistics" data-selector="statistics" style="display:none">
            <div data-setting="display_tweet_statistics">
                <div id="ntisas-stats-header"><span>Tweet Statistics</span> <span>(%STATISTICSHELP%)</span></div>
                <div id="ntisas-tweet-stats-table"></div>
                <div id="ntisas-tweet-stats-message">Unavailable on Tweet view.</div>
            </div>
        </div>
    </div>
    <div id="ntisas-open-settings">
        <input type="button" title="%SETTINGSHELP%" value="Settings">
    </div>
</div>
</div>`;

const TWEET_STATISTICS = `
<table>
    <tbody>
    <tr>
        <th data-key="total"><a class="ntisas-metric">Total</a></th>
        <th data-key="retweet"><a class="ntisas-metric">Retweet</a></th>
        <th data-key="tweet"><a class="ntisas-metric">Tweet</a></th>
    </tr>
    <tr>
        <td data-key="total">%TOTALTWEETS%</td>
        <td data-key="retweet">%RETWEETS%</td>
        <td data-key="tweet">%TWEETS%</td>
    </tr>
    <tr>
        <th data-key="image"><a class="ntisas-metric">Image</a></th>
        <th data-key="video"><a class="ntisas-metric">Video</a></th>
        <th data-key="text"><a class="ntisas-metric">Text</a></th>
    </tr>
    <tr>
        <td data-key="image">%IMAGETWEETS%</td>
        <td data-key="video">%VIDEOTWEETS%</td>
        <td data-key="text">%TEXTTWEETS%</td>
    </tr>
    <tr>
        <th>Replies</th>
        <th>Retweets</th>
        <th>Favorites</th>
    </tr>
    <tr>
        <td>%AVERAGEREPLIES%</td>
        <td>%AVERAGERETWEETS%</td>
        <td>%AVERAGEFAVORITES%</td>
    </tr>
    </tbody>
</table>`;

const MEDIA_STATISTICS = `
<table>
    <tbody>
    <tr>
        <th data-key="total"><a class="ntisas-metric">Total</a></th>
        <th data-key="single"><a class="ntisas-metric">Single</a></th>
        <th data-key="multi"><a class="ntisas-metric">Multi</a></th>
    </tr>
    <tr>
        <td data-key="total">%TOTALTWEETS%</td>
        <td data-key="single">%SINGLETWEETS%</td>
        <td data-key="multi">%MULTITWEETS%</td>
    </tr>
    </tbody>
</table>`;

const NTISAS_TWEET_MENU_HELP = `
results: L-click, manual add posts; R-click, open posts on Danbooru
Search: L-click, network similarity query; R-click, network URL query
Upload: L-click, menu for individual uploads; R-click, upload tweet
Download: L-click, menu for individual downloads; R-click, download all
`.trim();

const NTISAS_TWEET_MENU = `
<div class="ntisas-tweet-controls">
    <div class="ntisas-tweet-image-menu">
        <div class="ntisas-tweet-header"><a class="ntisas-expanded-link">NTISAS</a></div>
        <div>
            <div class="ntisas-image-section ntisas-links">
                <div class="ntisas-link-menu ntisas-links">
                    <span class="ntisas-query-button ntisas-menu-results">loading...</span>
                    <span class="ntisas-query-button ntisas-menu-search">
                        <a class="ntisas-control-search ntisas-expanded-link">Search</a>
                    </span>
                    <span class="ntisas-query-button ntisas-menu-upload">
                        <a class="ntisas-control-upload ntisas-expanded-link" target="_blank">Upload</a>
                    </span>
                    <span class="ntisas-query-button ntisas-menu-download">
                        <a class="ntisas-control-download ntisas-expanded-link">Download</a>
                    </span>
                    <span class="ntisas-query-button ntisas-menu-help">
                        <a class="ntisas-help-info ntisas-expanded-link" title="${NTISAS_TWEET_MENU_HELP}">&nbsp;?&nbsp;</a>
                    </span>
                </div>
            </div>
        </div>
    </div>
</div>`;

const NO_MATCH_LINK = `
 <a
    class="ntisas-manual-add ntisas-expanded-link"
    data-has-posts="false"
    >
    no sources
 </a>`;

const SELECTION_CONTROLS = `
<div class="ntisas-select-controls ntisas-links">
    <div>
        <a class="ntisas-expanded-link" data-type="all">all</a>
    </div>
    <div>
        <a class="ntisas-expanded-link" data-type="none">none</a>
    </div>
    <div>
        <a class="ntisas-expanded-link" data-type="invert">invert</a>
    </div>
</div>`;

const SIMILAR_SOURCE_HTML = `
<span id="ntisas-similar-toggle">
    <a id="ntisas-danbooru-similar-source" class="ntisas-expanded-link">Danbooru</a>
    <a id="ntisas-saucenao-similar-source" class="ntisas-expanded-link">SauceNAO</a>
</span>`;

const CONFIRM_UPLOAD_HTML = `
<span id="ntisas-confirm-upload-toggle">
    <a id="ntisas-yes-confirm-upload" class="ntisas-expanded-link">Yes</a>
    <a id="ntisas-no-confirm-upload" class="ntisas-expanded-link">No</a>
</span>`;

const CONFIRM_DOWNLOAD_HTML = `
<span id="ntisas-confirm-download-toggle">
    <a id="ntisas-yes-confirm-download" class="ntisas-expanded-link">Yes</a>
    <a id="ntisas-no-confirm-download" class="ntisas-expanded-link">No</a>
</span>`;

const VIEW_HIGHLIGHTS_HTML = `
<span id="ntisas-view-highlights-toggle">
    <a id="ntisas-enabled-view-highlights" class="ntisas-expanded-link">Shown</a>
    <a id="ntisas-disabled-view-highlights" class="ntisas-expanded-link">Hidden</a>
</span>`;

const VIEW_COUNTS_HTML = `
<span id="ntisas-view-counts-toggle">
    <a id="ntisas-enabled-view-counts" class="ntisas-expanded-link">Enabled</a>
    <a id="ntisas-disabled-view-counts" class="ntisas-expanded-link">Disabled</a>
</span>`;

const PROFILE_TIMELINE_HTML = `
<div class="ntisas-profile-section">
    <div class="ntisas-profile-user-id"></div>
    <div class="ntisas-profile-user-view"></div>
    <div class="ntisas-profile-stream-view"></div>
</div>`;

const LOCKPAGE_HTML = `
<span id="ntisas-lockpage-toggle">
    <a id="ntisas-disabled-lockpage" class="ntisas-expanded-link">Unlocked</a>
    <a id="ntisas-enabled-lockpage" class="ntisas-expanded-link" style="display:none">Locked</a>
</span>`;

const STATUS_MARKER = `
<span class="ntisas-status-marker">
    <span class="ntisas-already-seen" style="display: none;">already seen</span>
    <span class="ntisas-view-info ntisas-narrow-text" style="display: none;"></span>
</span>`;

const MEDIA_RESULTS_ICON = '<div class="ntisas-media-results ntisas-media-icon-section %s">%s</div>';
const MEDIA_COUNTER_ICON = '<div class="ntisas-media-counter ntisas-media-icon-section">%s</div>';
const MEDIA_VIDEO_ICON = '<div class="ntisas-video-icon"><svg viewBox="0 0 60 61" aria-hidden="true" class="r-uvuy5l r-cfp7ip"><g><circle cx="30" cy="30.4219" fill="#333333" opacity="0.6" r="30"></circle><path d="M22.2275 17.1971V43.6465L43.0304 30.4218L22.2275 17.1971Z" fill="white"></path></g></svg></div>';

const PROFILE_USER_ID = '<b>User ID&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; - %s</b>';
const PROFILE_USER_VIEW = 'Viewed user&nbsp;&nbsp; - %s';
const PROFILE_STREAM_VIEW = 'Viewed stream - %s';

//Message constants

const SAVE_HELP = "L-Click to save current settings. (Shortcut: Alt+S)";
const RESET_HELP = "L-Click to reset settings to default. (Shortcut: Alt+R)";
const SETTINGS_HELP = "L-Click to open settings menu. (Shortcut: Alt+M)";
const CLOSE_HELP = "L-Click to close. (Shortcut: Alt+C)";

const IQDB_SELECT_HELP = "Unselect posts (black/white border) that aren't valid matches.\nMatches with a green border are a size match.";
const POST_SELECT_HELP = "Select posts for deletion by clicking the thumbnail (black/white border).\nClick the colored postlink when finished to delete/add posts.";

const DATABASE_IS_INSTALLING_HELP = "The database is currently installing 1 batch periodically.";
const INSTALL_DATABASE_HELP = `Click to visit topic #${DANBOORU_TOPIC_ID} for manual install file.`;
const DATABASE_VERSION_HELP = "Click to open new tab to userscript details page.";
const UPDATE_RECORDS_HELP = "L-Click to update records to current.";
const MUST_INSTALL_HELP = "The database must be installed before the script is fully functional.";
const REFRESH_RECORDS_HELP = "L-Click to refresh record count.";
const AVAILABLE_SAUCE_HELP = "Shows the number of API requests remaining.\nOnly shown after use of the Sauce link.\nResults are kept for only 1 hour.";
const SIMILAR_SOURCE_HELP = "L-Click to switch the source for the similar search. (Shortcut: Alt+Q)";
const CONFIRM_UPLOAD_HELP = "L-click to turn on/off confirmation for uploading the full tweet, when done from the tweet menu.";
const CONFIRM_DOWNLOAD_HELP = "L-click to turn on/off confirmation for downloading all media, when done from the tweet menu.";
const VIEWS_HIGHLIGHTS_HELP = "L-Click to toggle visualizations on viewed/seen Tweets. (Shortcut: Alt+V)";
const VIEWS_COUNTS_HELP = "L-Click to toggle whether tweets are being counted as viewed.";
const LOCKPAGE_HELP = "L-Click to prevent navigating away from the page (does not prevent Twitter navigation).";
const ERROR_MESSAGES_HELP = "L-Click to see full error messages.";
const STATISTICS_HELP = 'L-Click any category heading to narrow down results.\nL-Click &quot;Total&quot; category to reset results.';

const INSTALL_MENU_TEXT = "Must install DB!";

const CURRENT_RECORDS_CONFIRM = JSPLib.utility.trim`
This will keep querying Danbooru until the records are current.
Depending on the current position, this could take several minutes.
Moving focus away from the page will halt the process.

Continue?`;

const MANUAL_ADD_PROMPT = "Enter the post IDs of matches. (separated by commas)";
const CONFIRM_DELETE_PROMPT = JSPLib.utility.trim`
The following posts will be deleted: %s

Save the following post IDs? (separate by comma, empty to delete)`;

//Time constants

const JQUERY_DELAY = 1; //For jQuery updates that should not be done synchronously
const TWITTER_DELAY = 100; //Give twitter handler some time to change the page
const TIMER_POLL_INTERVAL = 100;
const QUEUE_POLL_INTERVAL = 500;
const PROGRAM_RECHECK_INTERVAL = JSPLib.utility.one_second;
const VIEWCOUNT_RECENT_DURATION = JSPLib.utility.one_minute * 5;
const POST_VERSIONS_CALLBACK = JSPLib.utility.one_second * 5;
const PAGE_REFRESH_TIMEOUT = JSPLib.utility.one_second * 5;
const SAUCE_EXPIRES = JSPLib.utility.one_hour;
const MIN_POST_EXPIRES = JSPLib.utility.one_day;
const MAX_POST_EXPIRES = JSPLib.utility.one_month;
const USER_EXPIRES = JSPLib.utility.one_month;
const VIEW_EXPIRES = JSPLib.utility.one_month * 2;
const TWEET_EXPIRES = JSPLib.utility.one_week;
const TWUSER_EXPIRES = JSPLib.utility.one_day;
const LENGTH_RECHECK_EXPIRES = JSPLib.utility.one_hour;
const USER_PROFILE_RECHECK_EXPIRES = JSPLib.utility.one_month;
const BADVER_RECHECK_EXPIRES = JSPLib.utility.one_day;
const PRUNE_RECHECK_EXPIRES = JSPLib.utility.one_hour * 6;
const PROFILE_VIEWS_CALLBACK = JSPLib.utility.one_second * 10;
const USER_ID_CALLBACK = JSPLib.utility.one_second * 5;
const DATABASE_BATCHSAVE_INTERVAL = JSPLib.utility.one_second * 15;

//Regex constants

const TWITTER_HOST = String.raw`^https://(?:\w+\.)?(?:twitter|x)\.com`;
const TWIMG_HOST_RG = String.raw`^https?://pbs\.twimg\.com`;

const TWITTER_ACCOUNT = String.raw`[\w_-]+`;
const TWITTER_ID = String.raw`\d+`;
const QUERY_END = String.raw`(?:\?|$|/$)`;

const TWEET_REGEX = JSPLib.utility.verboseRegex()`${TWITTER_HOST}/(?:i/web|${TWITTER_ACCOUNT})/status/(${TWITTER_ID})(?:/photo/\d+|/video/\d+)?${QUERY_END}`;
const SOURCE_TWITTER_REGEX = JSPLib.utility.verboseRegex()`^source:${TWEET_REGEX.source.slice(1)}`;
const TWEET_REGEXG = new RegExp(TWEET_REGEX.source, 'g');
const SOURCE_TWITTER_REGEXG = new RegExp(SOURCE_TWITTER_REGEX.source, 'g');

const BANNER_REGEX = JSPLib.utility.verboseRegex()`https://pbs\.twimg\.com/profile_banners/(\d+)/\d+/`;

const TWITTER_IMAGE1 = JSPLib.utility.verboseRegex('i')`
${TWIMG_HOST_RG}
/
(?<path>media|tweet_video_thumb)
/
(?<key>[^.]+)
\.
(?<ext>jpg|png|gif)
(?::
(?<size>[a-z0-9]+)
)?
$`;

const TWITTER_IMAGE2 = JSPLib.utility.verboseRegex('i')`
${TWIMG_HOST_RG}
/
(?<path>(?:ext_tw_video_thumb|amplify_video_thumb)/\d+(?:/\w+)?/img)
/
(?<key>[^.]+)
\.
(?<ext>jpg|png|gif)
(?::
(?<size>[a-z0-9]+)
)?
$`;

const TWITTER_IMAGE3 = JSPLib.utility.verboseRegex('i')`
${TWIMG_HOST_RG}
/
(?<path>media|tweet_video_thumb)
/
(?<key>[^.]+)
\?format=
(?<ext>jpg|png|gif|webp)
(?:&name=
(?<size>[a-z0-9]+)
)?
$`;

const TWITTER_IMAGE4 = JSPLib.utility.verboseRegex('i')`
${TWIMG_HOST_RG}
/
(?<path>(?:ext_tw_video_thumb|amplify_video_thumb)/\d+(?:/\w+)?/img)
/
(?<key>[^.]+)
\?format=
(?<ext>jpg|png|gif|webp)
(?:&name=
(?<size>[a-z0-9]+)
)?
$`;

const HANDLED_IMAGES = [
    TWITTER_IMAGE1,
    TWITTER_IMAGE2,
    TWITTER_IMAGE3,
    TWITTER_IMAGE4,
];

const UNHANDLED_IMAGES = [
    JSPLib.utility.verboseRegex()`^https://pbs\.twimg\.com/profile_images/`,
    JSPLib.utility.verboseRegex()`^https://[^.]+\.twimg\.com/emoji/`,
    JSPLib.utility.verboseRegex()`^https://pbs\.twimg\.com/ad_img/`,
    JSPLib.utility.verboseRegex()`^https://abs\.twimg\.com/hashflags/`,
    JSPLib.utility.verboseRegex()`^https://pbs\.twimg\.com/card_img/`,
    JSPLib.utility.verboseRegex()`^https://abs\.twimg\.com/sticky/`,
    JSPLib.utility.verboseRegex()`^https://abs\.twimg\.com/responsive-web/`,
];

const MAIN_PAGE_REGEX = JSPLib.utility.verboseRegex('i')`
${TWITTER_HOST}
/
(?!search|home)
(?<account>${TWITTER_ACCOUNT})
${QUERY_END}
`;

const MEDIA_PAGE_REGEX = JSPLib.utility.verboseRegex('i')`
${TWITTER_HOST}
/
(?<account>${TWITTER_ACCOUNT})
/media
${QUERY_END}
`;

const LIKES_PAGE_REGEX = JSPLib.utility.verboseRegex('i')`
${TWITTER_HOST}
/
(?<account>${TWITTER_ACCOUNT})
/likes
${QUERY_END}
`;

const REPLIES_PAGE_REGEX = JSPLib.utility.verboseRegex('i')`
${TWITTER_HOST}
/
(?<account>${TWITTER_ACCOUNT})
/with_replies
${QUERY_END}
`;

const SEARCH_PAGE_REGEX = JSPLib.utility.verboseRegex('i')`
${TWITTER_HOST}
/
search\?
(?<query>.*?\bq=.+)
`;

const QUOTES_PAGE_REGEX = JSPLib.utility.verboseRegex('i')`
${TWITTER_HOST}
/
(?<account>${TWITTER_ACCOUNT})
/status/
(?<id>${TWITTER_ID})
/quotes
${QUERY_END}
`;

const TWEET_PAGE_REGEX = JSPLib.utility.verboseRegex('i')`
${TWITTER_HOST}
/
(?<account>${TWITTER_ACCOUNT})
/status/
(?<id>${TWITTER_ID})
${QUERY_END}
`;

const WEB_TWEET_PAGE_REGEX = JSPLib.utility.verboseRegex('i')`
${TWITTER_HOST}
/
i/web
/status/
(?<id>${TWITTER_ID})
${QUERY_END}
`;

const PHOTO_PAGE_REGEX = JSPLib.utility.verboseRegex('i')`
${TWITTER_HOST}
/
(?<account>${TWITTER_ACCOUNT})
/status/
(?<id>${TWITTER_ID})
/
(?<type>photo|video)
/
(?<index>\d)
${QUERY_END}
`;

const HASHTAG_PAGE_REGEX = JSPLib.utility.verboseRegex('i')`
${TWITTER_HOST}
/
hashtag/
(?<hashtag>[^?]+)
`;

const LIST_PAGE_REGEX = JSPLib.utility.verboseRegex('i')`
${TWITTER_HOST}
/
(?<account>${TWITTER_ACCOUNT})
/lists/
(?<id>${TWITTER_ID})
${QUERY_END}
`;

const HOME_PAGE_REGEX = JSPLib.utility.verboseRegex('i')`
${TWITTER_HOST}
/
home
${QUERY_END}
`;

const EVENTS_PAGE_REGEX = JSPLib.utility.verboseRegex('i')`
${TWITTER_HOST}
/
i/events/
(?<id>${TWITTER_ID})
${QUERY_END}
`;

const TOPICS_PAGE_REGEX = JSPLib.utility.verboseRegex('i')`
${TWITTER_HOST}
/
i/topics/
(?<id>${TWITTER_ID})
${QUERY_END}
`;

const DISPLAY_PAGE_REGEX = JSPLib.utility.verboseRegex('i')`
${TWITTER_HOST}
/
settings/display
${QUERY_END}
`;

const PAGE_REGEXES = {
    main: MAIN_PAGE_REGEX,
    media: MEDIA_PAGE_REGEX,
    likes: LIKES_PAGE_REGEX,
    replies: REPLIES_PAGE_REGEX,
    search: SEARCH_PAGE_REGEX,
    quotes: QUOTES_PAGE_REGEX,
    tweet: TWEET_PAGE_REGEX,
    web_tweet: WEB_TWEET_PAGE_REGEX,
    photo: PHOTO_PAGE_REGEX,
    hashtag: HASHTAG_PAGE_REGEX,
    list: LIST_PAGE_REGEX,
    home: HOME_PAGE_REGEX,
    events: EVENTS_PAGE_REGEX,
    topics: TOPICS_PAGE_REGEX,
    display: DISPLAY_PAGE_REGEX,
};

//Network constants

const TWEET_GRAPHQL_PARAMS = {
    with_rux_injections: false,
    includePromotedContent: true,
    withCommunity: false,
    withQuickPromoteEligibilityTweetFields: true,
    withBirdwatchNotes: false,
    withSuperFollowsUserFields: true,
    withDownvotePerspective: false,
    withReactionsMetadata: false,
    withReactionsPerspective: false,
    withSuperFollowsTweetFields: true,
    withVoice: true,
    withV2Timeline: true,
    __fs_responsive_web_like_by_author_enabled: false,
    __fs_dont_mention_me_view_api_enabled: true,
    __fs_interactive_text_enabled: true,
    __fs_responsive_web_uc_gql_enabled: false,
    __fs_responsive_web_edit_tweet_api_enabled: false
};

const TWEET_RESTID_GQL_PARAMS = {
    withCommunity: false,
    includePromotedContent: false,
    withVoice: false,
};

const TWEET_RESTID_GQL_FEATURES = {
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    tweetypie_unmention_optimization_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    rweb_video_timestamps_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    responsive_web_media_download_video_enabled: true,
    responsive_web_enhance_cards_enabled: false,
};

const TWEET_RESTIDS_GQL_FEATURES = {
    creator_subscriptions_tweet_preview_api_enabled: false,
    premium_content_api_read_enabled: false,
    communities_web_enable_tweet_community_results_fetch: false,
    c9s_tweet_anatomy_moderator_badge_enabled: false,
    responsive_web_grok_analyze_button_fetch_trends_enabled: false,
    responsive_web_grok_analyze_post_followups_enabled: false,
    responsive_web_jetfuel_frame: false,
    responsive_web_grok_share_attachment_enabled: false,
    articles_preview_enabled: false,
    responsive_web_edit_tweet_api_enabled: false,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: false,
    view_counts_everywhere_api_enabled: false,
    longform_notetweets_consumption_enabled: false,
    responsive_web_twitter_article_tweet_consumption_enabled: false,
    tweet_awards_web_tipping_enabled: false,
    responsive_web_grok_show_grok_translated_post: false,
    responsive_web_grok_analysis_button_from_backend: false,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: false,
    standardized_nudges_misinfo: false,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: false,
    longform_notetweets_rich_text_read_enabled: false,
    longform_notetweets_inline_media_enabled: false,
    payments_enabled: false,
    profile_label_improvements_pcf_label_in_post_enabled: false,
    responsive_web_profile_redirect_enabled: false,
    rweb_tipjar_consumption_enabled: false,
    verified_phone_label_enabled: false,
    responsive_web_grok_image_annotation_enabled: false,
    responsive_web_grok_imagine_annotation_enabled: false,
    responsive_web_grok_community_note_auto_translation_is_enabled: false,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    responsive_web_graphql_timeline_navigation_enabled: false,
    responsive_web_enhance_cards_enabled: false,
};

const TWEET_RESTIDS_GQL_DATA = {
    includePromotedContent: false,
    withBirdwatchNotes: false,
    withVoice: false,
    withCommunity: false,
};

const TWEET_RESTIDS_GQL_FIELDS = {
    withArticleRichContentState: false,
    withArticlePlainText: false,
    withGrokAnalyze: false,
    withDisallowedReplyControls: false,
    withAuxiliaryUserLabels: false,
};

const MEDIA_TIMELINE_DATA = {
    includePromotedContent: false,
    withSuperFollowsUserFields: true,
    withDownvotePerspective: false,
    withReactionsMetadata: false,
    withReactionsPerspective: false,
    withSuperFollowsTweetFields: true,
    withClientEventToken: false,
    withBirdwatchNotes: false,
    withVoice: true,
    withV2Timeline: true,
    count: 20,
};

const MEDIA_TIMELINE_FEATURES = {
    responsive_web_graphql_timeline_navigation_enabled: false,
    unified_cards_ad_metadata_container_dynamic_card_content_query_enabled: false,
    dont_mention_me_view_api_enabled: true,
    responsive_web_uc_gql_enabled: true,
    vibe_api_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: false,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: false,
    interactive_text_enabled: true,
    responsive_web_text_conversations_enabled: false,
    responsive_web_enhance_cards_enabled: true,
};

const QUERY_LIMIT = 100;
const QUERY_BATCH_NUM = 5;
const QUERY_BATCH_SIZE = QUERY_LIMIT * QUERY_BATCH_NUM;

const POST_FIELDS = 'id,uploader_id,score,fav_count,rating,tag_string,created_at,preview_file_url,source,file_ext,file_size,image_width,image_height,uploader[name]';
const POSTVER_FIELDS = 'id,updated_at,post_id,version,source,source_changed,added_tags,removed_tags,unchanged_tags';
const PROFILE_FIELDS = 'id,level';

//DOM constants

const SIMILAR_SOURCE_CONTROLS = ['danbooru', 'saucenao'];
const CONFIRM_UPLOAD_CONTROLS = ['yes', 'no'];
const CONFIRM_DOWNLOAD_CONTROLS = ['yes', 'no'];
const VIEW_HIGHLIGHT_CONTROLS = ['enabled', 'disabled'];
const VIEW_COUNT_CONTROLS = ['enabled', 'disabled'];

const BASE_DIALOG_WIDTH = 60;
const BASE_QTIP_WIDTH = 10;

//Queue constants

const QUEUED_STORAGE_REQUESTS = [];
const SAVED_STORAGE_REQUESTS = [];
const CACHED_STORAGE_REQUESTS = {};
const CACHE_STORAGE_TYPES = ['get', 'check'];
const STORAGE_DATABASES = {
    danbooru: JSPLib.storage.danboorustorage,
    twitter: JSPLib.storage.twitterstorage,
};

const QUEUED_NETWORK_REQUESTS = [];
const SAVED_NETWORK_REQUESTS = [];
const NETWORK_REQUEST_DICT = {
    posts: {
        data_key: "id",
        params (post_ids) {
            return {
                tags: 'status:any id:' + post_ids.join(','),
                only: POST_FIELDS,
                limit: 200,
            };
        },
    },
    users: {
        data_key: "id",
        params (user_ids) {
            return {
                search: {
                    id: user_ids.join(','),
                },
                only: 'id,name',
                limit: 1000,
            };
        },
    },
};

const TIMELINE_REQUESTS = [];
const TIMELINE_VALS = {
    user_ids: {},
    lowest_available_tweet: {},
    api_data: {},
    cursor: {},
};

//Other constants

const TWITTER_COLORS = {
    light_normal: {
        blue500: "#1D9BF0",
        green500: "#00BA7C",
        magenta500: "#F91880",
        orange500: "#FF7A00",
        plum500: "#C936CC",
        purple500: "#7856FF",
        red500: "#F4212E",
        teal500: "#00AFB6",
        yellow500: "#FFD400",
    },
    light_contrast: {
        blue500: "#003886",
        green500: "#00613D",
        magenta500: "#890A46",
        orange500: "#892B00",
        plum500: "#520B53",
        purple500: "#5234B7",
        red500: "#AE1425",
        teal500: "#005A5F",
        yellow500: "#6F3E00"
    },
    dark_normal: {
        blue500: "#1D9BF0",
        green500: "#00BA7C",
        magenta500: "#F91880",
        orange500: "#FF7A00",
        plum500: "#C936CC",
        purple500: "#7856FF",
        red500: "#F4212E",
        teal500: "#00AFB6",
        yellow500: "#FFD400",
    },
    dark_contrast: {
        blue500: "#6BC9FB",
        green500: "#61D6A3",
        magenta500: "#FB70B0",
        orange500: "#FFAD61",
        plum500: "#DF82E0",
        purple500: "#AC97FF",
        red500: "#F87580",
        teal500: "#3CD6DD",
        yellow500: "#FFEB6B"
    },
};

const STREAMING_PAGES = ['home', 'main', 'likes', 'replies', 'quotes', 'media', 'list', 'search', 'hashtag', 'events', 'topics'];
const SHOWN_MENU_PAGES = JSPLib.utility.concat(STREAMING_PAGES, ['tweet', 'web_tweet']);

const GOLD_LEVEL = 30;

//UI constants

const PREVIEW_QTIP_SETTINGS = {
    style: {
        classes: 'qtiptisas-twitter ntisas-preview-tooltip',
    },
    position: {
        my: 'top center',
        at: 'bottom center',
        viewport: true,
    },
    show: {
        delay: 500,
        solo: true,
    },
    hide: {
        delay: 250,
        fixed: true,
        leave: false, // Prevent hiding when cursor hovers a browser tooltip
    }
};

const IMAGE_QTIP_SETTINGS = {
    style: {
        classes: 'qtiptisas-twitter ntisas-image-tooltip',
    },
    position: {
        my: 'center',
        at: 'center',
        viewport: false,
    },
    show: {
        delay: 1000,
        solo: true,
    },
    hide: {
        delay: 100,
        fixed: true,
    }
};

const GENERAL_DIALOG_SETTINGS = {
    modal: true,
    resizable: false,
    autoOpen: false,
    classes: {
        'ui-dialog': 'ntisas-dialog ui-dialog-twitter',
        'ui-dialog-titlebar-close': 'ntisas-dialog-close'
    },
};

const MENU_DIALOG_SETTINGS = Object.assign({
    width: 1000,
    height: 800,
    open: () => {
        NTISAS.opened_menu = true;
    },
    close: () => {
        NTISAS.opened_menu = false;
    },
    buttons: {
        //Save and reset are bound separately
        Save: (() => {}),
        'Factory reset': (() => {}),
        Close: CloseDialog,
    }
}, GENERAL_DIALOG_SETTINGS);

const MENU_DIALOG_BUTTONS = {
    Save: {
        id: 'ntisas-commit',
        title: SAVE_HELP
    },
    'Factory reset': {
        id: 'ntisas-resetall',
        title: RESET_HELP
    },
    Close: {
        id: null,
        title: CLOSE_HELP
    }
};

//Validation constants

const POST_CONSTRAINTS = {
    entry: JSPLib.validate.hashentry_constraints,
    value: {
        id: JSPLib.validate.id_constraints,
        uploaderid: JSPLib.validate.id_constraints,
        uploadername: JSPLib.validate.stringonly_constraints,
        score: JSPLib.validate.integer_constraints,
        favcount: JSPLib.validate.counting_constraints,
        rating: JSPLib.validate.inclusion_constraints(['g', 's', 'q', 'e']),
        tags: JSPLib.validate.stringonly_constraints,
        created: JSPLib.validate.counting_constraints,
        thumbnail: JSPLib.validate.stringonly_constraints,
        source: JSPLib.validate.stringonly_constraints,
        ext: JSPLib.validate.inclusion_constraints(['jpg', 'png', 'gif', 'mp4', 'webm']),
        size: JSPLib.validate.counting_constraints,
        width: JSPLib.validate.counting_constraints,
        height: JSPLib.validate.counting_constraints
    }
};

const USER_CONSTRAINTS = {
    entry: JSPLib.validate.hashentry_constraints,
    value: {
        id: JSPLib.validate.id_constraints,
        name: JSPLib.validate.stringonly_constraints,
    }
};

const TWEET_CONSTRAINTS = {
    entry: JSPLib.validate.arrayentry_constraints(),
    value: {
        partial_image: JSPLib.validate.stringonly_constraints,
        partial_video: JSPLib.validate.stringnull_constraints,
        partial_sample: JSPLib.validate.stringnull_constraints,
    },
};

const TWIMG_CONSTRAINTS = {
    entry: JSPLib.validate.hashentry_constraints,
    value: {
        size: JSPLib.validate.counting_constraints,
        width: JSPLib.validate.counting_constraints,
        height: JSPLib.validate.counting_constraints,
    }
};

const VIEW_CONSTRAINTS = {
    entry: JSPLib.validate.hashentry_constraints,
    value: {
        count: JSPLib.validate.counting_constraints,
        viewed: JSPLib.validate.counting_constraints,
    },
};

const TWUSER_CONSTRAINTS = {
    expires: JSPLib.validate.expires_constraints,
    value: JSPLib.validate.stringonly_constraints,
};

const SAUCE_CONSTRAINTS = {
    expires: JSPLib.validate.expires_constraints,
    value: JSPLib.validate.integer_constraints
};

const COLOR_CONSTRAINTS = {
    base_color: JSPLib.validate.array_constraints({is: 3}),
    text_color: JSPLib.validate.array_constraints({is: 3}),
    background_color: JSPLib.validate.array_constraints({is: 3})
};

const PROFILE_CONSTRAINTS = {
    id: JSPLib.validate.id_constraints,
    level: JSPLib.validate.id_constraints,
};

/****Functions****/

function ValidateEntry(key, entry) {
    let printer = JSPLib.debug.getFunctionPrint('ValidateEntry');
    if (!JSPLib.validate.validateIsHash(key, entry)) {
        return false;
    }
    if (key.match(/^post-/)) {
        return ValidateTypeEntry(key, entry, 'hash', POST_CONSTRAINTS);
    }
    if (key.match(/^user-\d+/)) {
        return ValidateTypeEntry(key, entry, 'hash', USER_CONSTRAINTS);
    }
    if (key.match(/^view-/) || key.match(/^((main|media|likes|replies)-stream|user)-view-/)) {
        return ValidateTypeEntry(key, entry, 'hash', VIEW_CONSTRAINTS);
    }
    if (key.match(/^twuser-/)) {
        return JSPLib.validate.validateHashEntries(key, entry, TWUSER_CONSTRAINTS);
    }
    if (key.match(/^tweet-/)) {
        return ValidateTypeEntry(key, entry, 'array', TWEET_CONSTRAINTS);
    }
    if (key.match(/^twimg-/)) {
        return ValidateTypeEntry(key, entry, 'hash', TWIMG_CONSTRAINTS);
    }
    if (key === 'ntisas-available-sauce') {
        return JSPLib.validate.validateHashEntries(key, entry, SAUCE_CONSTRAINTS);
    }
    printer.debugwarn("Bad key!");
    return false;
}

function ValidateExpiration(key) {
    if (key.match(/^post-/)) {
        return MAX_POST_EXPIRES;
    }
    if (key.match(/^user-\d+/)) {
        return USER_EXPIRES;
    }
    if (key.match(/^view-/)) {
        return VIEW_EXPIRES;
    }
    if (key.match(/^((main|media|likes|replies)-stream|user)-view-/)) {
        return JSPLib.utility.one_year;
    }
    if (key.match(/^twuser-/)) {
        return TWUSER_EXPIRES;
    }
    if (key.match(/^tweet-/)) {
        return TWEET_EXPIRES;
    }
    return 0;
}

function ValidateTypeEntry(key, entry, type, constraints) {
    if (!JSPLib.validate.validateHashEntries(key, entry, constraints.entry)) {
        return false;
    }
    if (type === 'hash') {
        return JSPLib.validate.validateHashEntries(key + '.value', entry.value, constraints.value);
    }
    return JSPLib.validate.validateHashArrayEntries(key + '.value', entry.value, constraints.value)
}

function ValidateProgramData(key, entry) {
    var checkerror = [], check;
    switch (key) {
        case 'ntisas-user-settings':
            checkerror = JSPLib.menu.validateUserSettings(entry);
            break;
        case 'ntisas-database-length':
            if (!Number.isInteger(entry)) {
                checkerror = ["Value is not an integer."];
            }
            break;
        case 'ntisas-timeout':
        case 'ntisas-badver-recheck':
        case 'ntisas-length-recheck':
        case 'ntisas-user-profile-recheck':
        case 'ntisas-recent-timestamp':
        case 'ntisas-process-semaphore-badvers':
        case 'ntisas-process-semaphore-records':
        case 'ntisas-process-semaphore-postvers':
        case 'ntisas-prune-expires':
            if (!Number.isInteger(entry)) {
                checkerror = ["Value is not an integer."];
            } else if (entry < 0) {
                checkerror = ["Value is not greater than or equal to zero."];
            }
            break;
        case 'ntisas-postver-lastid':
        case 'ntisas-badver-lastid':
            if (!JSPLib.validate.validateID(entry)) {
                checkerror = ["Value is not a valid ID."];
            }
            break;
        case 'ntisas-overflow':
            if (!JSPLib.validate.isBoolean(entry)) {
                checkerror = ["Value is not a boolean."];
            }
            break;
        case 'ntisas-user-data':
            check = validate(entry, PROFILE_CONSTRAINTS);
            if (check) {
                checkerror = [check];
                break;
            }
            break;
        case 'ntisas-color-style':
            check = validate(entry, COLOR_CONSTRAINTS);
            if (check) {
                checkerror = [check];
                break;
            }
            for (let key in entry) {
                if (!VaildateColorArray(entry[key])) {
                    checkerror.push(`${key} does not contain a valid color array.`);
                }
            }
            break;
        case 'ntisas-side-selection':
            if (!['info', 'controls', 'statistics'].includes(entry)) {
                checkerror = ["Not a valid selection."];
            }
            break;
        default:
            checkerror = ["Not a valid program data key."];
    }
    if (checkerror.length) {
        JSPLib.validate.outputValidateError(key, checkerror);
        return false;
    }
    return true;
}

function VaildateColorArray(array) {
    return array.every((val) => {
        let parse = Number(val);
        return JSPLib.validate.isString(val) &&
               Number.isInteger(parse) &&
               parse >= 0 && parse <= 255;
    });
}

//String functions

function GetDateString(timestamp) {
    let time_obj = new Date(timestamp);
    return `${time_obj.getFullYear()}${JSPLib.utility.padNumber(time_obj.getMonth() + 1, 2)}${JSPLib.utility.padNumber(time_obj.getDate(), 2)}`;
}

function GetTimeString(timestamp) {
    let time_obj = new Date(timestamp);
    return `${JSPLib.utility.padNumber(time_obj.getHours(), 2)}${JSPLib.utility.padNumber(time_obj.getMinutes(), 2)}`;
}

function GetDateTimeString(timestamp) {
    return GetDateString(timestamp) + GetTimeString(timestamp);
}

function GetLinkTitle(post) {
    let tags = JSPLib.utility.HTMLEscape(post.tags);
    let age = JSPLib.utility.HTMLEscape(`age:"${JSPLib.utility.timeAgo(post.created)}"`);
    return `user:${post.uploadername} score:${post.score} favcount:${post.favcount} rating:${post.rating} ${age} ${tags}`;
}

function GetMultiLinkTitle(posts) {
    let title = [];
    posts.forEach((post) => {
        let age = JSPLib.utility.HTMLEscape(`age:"${JSPLib.utility.timeAgo(post.created)}"`);
        title.push(`post #${post.id} - user:${post.uploadername} score:${post.score} favcount:${post.favcount} rating:${post.rating} ${age}`);
    });
    return title.join('\n');
}

function GetForumTopicLink() {
    return `${NTISAS.domain}/forum_topics/${DANBOORU_TOPIC_ID}`;
}

//Hash/array functions

function RemoveDuplicates(obj_array, attribute){
    const attribute_index = JSPLib.utility.getObjectAttributes(obj_array, attribute);
    return obj_array.filter((obj, index) => (attribute_index.indexOf(obj[attribute]) === index));
}

function RemoveHashKeyValue(hash, key, value) {
    if ((key in hash) && hash[key].includes(value)) {
        hash[key] = JSPLib.utility.arrayDifference(hash[key], [value]);
        if (hash[key].length === 0) {
            delete hash[key];
        }
        return true;
    }
    return false;
}

function MapPost(post) {
    return {
        id: post.id,
        uploaderid: post.uploader_id,
        uploadername: ('uploader' in post ? post.uploader.name : null),
        score: post.score,
        favcount: post.fav_count,
        rating: post.rating,
        tags: post.tag_string,
        created: new Date(post.created_at).getTime(),
        thumbnail: post.preview_file_url,
        source: post.source,
        ext: post.file_ext,
        size: post.file_size,
        width: post.image_width,
        height: post.image_height
    };
}

function DarkenColorArray(array, amount) {
    return array.map((val) => Math.max(Number(val) - amount, 0).toString());
}

//URL functions

function ParseQueries(str) {
    return str.split(' ').reduce((params, param) => {
        var paramSplit = param.split(':');
        params[paramSplit[0]] = paramSplit[1];
        return params;
    }, {});
}

function GetImageURLInfo(image_url) {
    for (let i = 0; i < HANDLED_IMAGES.length; i++) {
        let match = HANDLED_IMAGES[i].exec(image_url);
        if (match) {
            return match.groups;
        }
    }
    for (let i = 0; i < UNHANDLED_IMAGES.length; i++) {
        let match = UNHANDLED_IMAGES[i].exec(image_url);
        if (match) {
            return null;
        }
    }
    return false;
}

function GetFileURLInfo(file_url) {
    let parser = new URL(file_url);
    let file_index = parser.pathname.lastIndexOf('/');
    let file_ident = parser.pathname.slice(file_index + 1);
    let [name, extension] = file_ident.split('.');
    extension = extension.split(/\W+/)[0];
    return {name, extension};
}

function GetThumbUrl(url, splitter, ext, size) {
    let parser = new URL(url);
    let pathname = parser.pathname.split(splitter)[0];
    let extpos = pathname.lastIndexOf('.');
    return parser.origin + pathname.slice(0, extpos) + `?format=${ext}&name=${size}`;
}

async function GetNormalImageURL(image_info) {
    let printer = JSPLib.debug.getFunctionPrint('GetNormalImageURL');
    if (!(image_info.key in NTISAS.known_extensions)) {
        if (image_info.ext === 'webp') {
            printer.debuglog("Checking webp image for extension:", image_info);
            JSPLib.notice.debugNoticeLevel("Webp image detected.", JSPLib.debug.DEBUG);
            for (let ext of ['jpg', 'png']) {
                let image_url = `https://pbs.twimg.com/${image_info.path}/${image_info.key}.${ext}`;
                let dimensions = await JSPLib.utility.getImageDimensions(image_url);
                if (dimensions) {
                    NTISAS.known_extensions[image_info.key] = ext;
                    break;
                }
            }
        } else {
            NTISAS.known_extensions[image_info.key] = image_info.ext;
        }
    }
    if (NTISAS.known_extensions[image_info.key]) {
        let ext = NTISAS.known_extensions[image_info.key];
        return `https://pbs.twimg.com/${image_info.path}/${image_info.key}.${ext}`;
    }
    return null;
}

function GetSingleImageInfo(tweet_id) {
    GetSingleImageInfo.memoized ??= {};
    if (!GetSingleImageInfo.memoized[tweet_id]) {
        let image = GetMediaTweet(tweet_id).find('img').get(0);
        if (image?.complete && JSPLib.validate.isString(image.src)) {
            let image_info = GetImageURLInfo(image.src);
            GetSingleImageInfo.memoized[tweet_id] = [{partial_image: image_info.path + '/' + image_info.key + '.' + image_info.ext}];
        } else {
            return [];
        }
    }
    return GetSingleImageInfo.memoized[tweet_id];
}

//Time functions

function GetPostVersionsExpiration() {
    return NTISAS.recheck_interval * JSPLib.utility.one_minute;
}

function LogarithmicExpiration(count, max_count, time_divisor, multiplier) {
    let time_exponent = Math.pow(10, (1 / time_divisor));
    return Math.round(Math.log10(time_exponent + (10 - time_exponent) * (count / max_count)) * multiplier);
}

function PostExpiration(created_timestamp) {
    let created_interval = Date.now() - created_timestamp;
    if (created_interval < JSPLib.utility.one_day) {
        return MIN_POST_EXPIRES;
    } if (created_interval < JSPLib.utility.one_month) {
        let day_interval = (created_interval / JSPLib.utility.one_day) - 1; //Start at 0 days and go to 29 days
        let day_slots = 29; //There are 29 day slots between 1 day and 30 days
        let days_month = 30;
        return LogarithmicExpiration(day_interval, day_slots, days_month, MAX_POST_EXPIRES);
    }
    return MAX_POST_EXPIRES;
}

//Auxiliary functions

async function AddViewCount(tweet_id) {
    if (NTISAS.count_views && !NTISAS.recorded_views.includes(tweet_id)) {
        let views = await GetData('view-' + tweet_id, 'danbooru');
        let mapped_view = {
            count: (views ? views.value.count : 0) + 1,
            viewed: Date.now(),
        };
        let data_expires = JSPLib.utility.getExpires(VIEW_EXPIRES);
        SaveData('view-' + tweet_id, {value: mapped_view, expires: data_expires}, 'danbooru', false);
        NTISAS.recorded_views.push(tweet_id);
    }
}

function PromptSavePostIDs(tweet_id, message, initial_post_ids) {
    let printer = JSPLib.debug.getFunctionPrint('PromptSavePostIDs');
    let prompt_string = prompt(message, initial_post_ids.join(', '));
    if (prompt_string !== null) {
        let confirm_post_ids = JSPLib.utility.arrayUnique(
            prompt_string.split(',')
                .map(Number)
                .filter((num) => JSPLib.validate.validateID(num))
        );
        printer.debuglog("Confirmed IDs:", confirm_post_ids);
        if (confirm_post_ids.length === 0) {
            RemoveData('tweet-' + tweet_id, 'twitter');
        } else {
            SaveData('tweet-' + tweet_id, confirm_post_ids, 'twitter');
        }
        UpdatePostIDsLink(tweet_id, confirm_post_ids);
        NTISAS.channel.postMessage({type: 'postlink', tweet_id, post_ids: confirm_post_ids});
        return true;
    }
    return false;
}

function DestroyDialog(key, tweet_id) {
    if (key in NTISAS) {
        if (tweet_id in NTISAS[key]) {
            NTISAS[key][tweet_id].dialog('destroy');
            NTISAS[key][tweet_id].remove();
            delete NTISAS[key][tweet_id];
        }
    }
}

function UpdateUserIDCallback() {
    if (NTISAS.update_user_id?.timer) {
        clearInterval(NTISAS.update_user_id?.timer);
    }
    JSPLib.storage.checkLocalDB('twuser-' + NTISAS.account).then((storage_data) => {
        if (!storage_data) {
            NTISAS.update_user_id = JSPLib.utility.recheckTimer({
                check: () => $('[src*="/profile_banners/"], [href^="/i/connect_people?user_id="]').length,
                exec: () => {
                    let $obj = $('[src*="/profile_banners/"]');
                    if ($obj.length) {
                        NTISAS.user_id = JSPLib.utility.safeMatch($obj.attr('src'), BANNER_REGEX, 1);
                    } else {
                        NTISAS.user_id = JSPLib.utility.safeMatch($('[href^="/i/connect_people?user_id="]').attr('href'), /\d+/, 0);
                    }
                    let expires = JSPLib.utility.getExpires(TWUSER_EXPIRES);
                    JSPLib.storage.saveData('twuser-' + NTISAS.account, {value: NTISAS.user_id, expires});
                },
                fail: () => {
                    JSPLib.notice.debugError("User ID not found!");
                },
            }, TIMER_POLL_INTERVAL, USER_ID_CALLBACK);
        } else {
            NTISAS.user_id = storage_data.value;
        }
    });
}

function UpdateProfileCallback() {
    if (NTISAS.update_profile?.timer) {
        clearInterval(NTISAS.update_profile?.timer);
    }
    if (NTISAS.display_user_id) {
        $('.ntisas-profile-user-id').html(JSPLib.utility.sprintf(PROFILE_USER_ID, ''));
    }
    if (NTISAS.display_profile_views) {
        $('.ntisas-profile-user-view').html(JSPLib.utility.sprintf(PROFILE_USER_VIEW, ''));
        $('.ntisas-profile-stream-view').html(JSPLib.utility.sprintf(PROFILE_STREAM_VIEW, ''));
    }
    NTISAS.update_profile = JSPLib.utility.recheckTimer({
        check: () => JSPLib.validate.isString(NTISAS.user_id),
        exec: () => {
            if (NTISAS.display_user_id) {
                $('.ntisas-profile-user-id').html(JSPLib.utility.sprintf(PROFILE_USER_ID, NTISAS.user_id));
            }
            if (NTISAS.display_profile_views) {
                let user_key = 'user-view-' + NTISAS.user_id;
                GetData(user_key, 'danbooru').then((views) => {
                    InitializeProfileViewCount(views, user_key, '.ntisas-profile-user-view', PROFILE_USER_VIEW);
                });
                let stream_key1 = NTISAS.page + '-stream-view-' + NTISAS.account;
                let stream_key2 = NTISAS.page + '-stream-view-' + NTISAS.user_id;
                let stream_promise1 = GetData(stream_key1, 'danbooru');
                let stream_promise2 = GetData(stream_key2, 'danbooru');
                Promise.all([stream_promise1, stream_promise2]).then(([views1, views2]) => {
                    let views = views1 ?? views2;
                    InitializeProfileViewCount(views, stream_key2, '.ntisas-profile-stream-view', PROFILE_STREAM_VIEW);
                    if (views1) {
                        RemoveData(stream_key1, 'danbooru');
                    }
                });
            }
        }
    }, TIMER_POLL_INTERVAL, PROFILE_VIEWS_CALLBACK);
}

function UnhideTweets() {
    let printer = JSPLib.debug.getFunctionPrint('UnhideTweets');
    let $hidden_tweets = $('.ntisas-hidden-media [role=button]');
    if ($hidden_tweets.length) {
        printer.debuglog("Found hidden tweets:", $hidden_tweets.length);
        $hidden_tweets.click();
    }
}

//DOM functions

function GetTweet(tweet_id) {
    return (NTISAS.page === 'media' ? $(`.ntisas-media-menu[data-tweet-id=${tweet_id}]`) : $(`[ntisas-tweet][data-tweet-id=${tweet_id}]`));
}

function GetMediaTweet(tweet_id) {
    return $(`.ntisas-media-tweet[data-tweet-id=${tweet_id}]`);
}

//DOM data functions

function GetTweetInfo($tweet) {
    let tweet_id = String($tweet.data('tweet-id'));
    let screen_name = String($tweet.data('screen-name'));
    return {tweet_id, screen_name};
}

function GetEventPreload(event) {
    let $link = $(event.target);
    let $tweet = $link.closest('[ntisas-tweet]');
    let {tweet_id, screen_name} = GetTweetInfo($tweet);
    return {$link, $tweet, tweet_id, screen_name};
}

function GetDialogPreload(event) {
    let $link = $(event.currentTarget);
    let $dialog = $link.closest('.ntisas-dialog').find('.ui-dialog-content');
    let tweet_id = String($dialog.data('tweet-id'));
    let screen_name = $dialog.data('screen-name');
    screen_name = (screen_name ? String(screen_name) : null);
    return {$link, $dialog, tweet_id, screen_name};
}

function GetTweetStat(tweet, types) {
    for (let i = 0; i < types.length; i++) {
        let label = $(`[data-testid=${types[i]}]`, tweet).attr('aria-label');
        let match = label && label.match(/\d+/);
        if (match) {
            return parseInt(match[0]);
        }
    }
    return 0;
}

async function GetImageLinks(tweet) {
    if (!tweet.ntisasImageUrls) {
        let $obj = $('[ntisas-media-type=image] [ntisas-image], [ntisas-media-type=video] [ntisas-image]', tweet).sort((entrya, entryb) => (Number($(entrya).attr('ntisas-image')) - Number($(entryb).attr('ntisas-image'))));
        tweet.ntisasImageUrls = [];
        for (let i = 0; i < $obj.length; i++) {
            let image_info = $($obj[i]).data();
            let image_url = await GetNormalImageURL(image_info);
            if (image_url) {
                tweet.ntisasImageUrls.push(image_url);
            }
        }
    }
    return tweet.ntisasImageUrls;
}

async function GetMediaLinksData($tweet) {
    let image_urls = await GetImageLinks($tweet[0]);
    var videos;
    if (NTISAS.page === 'media') {
        videos = $tweet.find('.ntisas-media-images > div').map((_, entry) => entry.classList.contains('ntisas-media-video')).toArray();
    } else {
        videos = $tweet.find('[ntisas-image]').map((_, entry) => Boolean(/^tweet_video_thumb|^ext_tw_video_thumb|^amplify_video_thumb/.exec($(entry).data('path')))).toArray();
    }
    return {image_urls, videos};
}

//Update DOM functions

function UpdateSideMenu(page_type, update_visibility) {
    let menu_shown = JSPLib.storage.getLocalData('ntisas-side-menu', {default_val: true});
    let $side_menu = $('#ntisas-side-menu');
    if (menu_shown) {
        if (!NTISAS.side_menu_draggable) {
            $side_menu.draggable({
                handle: '#ntisas-menu-header',
                stop: SaveMenuPosition,
            });
            NTISAS.side_menu_draggable = true;
        }
    } else {
        if (NTISAS.side_menu_draggable) {
            $side_menu.draggable('destroy');
            NTISAS.side_menu_draggable = false;
            JSPLib.storage.removeLocalData('ntisas-menu-position');
            $side_menu.css({top: "", left: ""});
        }
    }
    if (update_visibility || !UpdateSideMenu.initialized) {
        if (menu_shown && SHOWN_MENU_PAGES.includes(page_type)) {
            $side_menu.show();
        } else {
            $side_menu.hide();
        }
        UpdateSideMenu.initialized = true;
    }
}

function UpdateSideMenuSelection() {
    let selected_menu = JSPLib.storage.getLocalData('ntisas-side-selection');
    $('#ntisas-menu-selection > a').removeClass('ntisas-selected');
    $(`#ntisas-menu-selection a[data-selector=${selected_menu}]`).addClass('ntisas-selected');
    $('#ntisas-content > div').hide();
    $(`#ntisas-content div[data-selector=${selected_menu}]`).show();
}

function DisplayControl(control, all_controls, type) {
    let all_selectors = JSPLib.utility.joinList(all_controls, '#ntisas-', '-' + type, ',');
    $(all_selectors).hide();
    setTimeout(() => {$(`#ntisas-${control}-${type}`).show();}, JQUERY_DELAY);
}

function UpdateSimilarControls() {
    NTISAS.similar_source = JSPLib.storage.getLocalData('ntisas-similar-source', {default_val: 'danbooru'});
    let switch_type = NTISAS.similar_source ?? 'danbooru';
    DisplayControl(switch_type, SIMILAR_SOURCE_CONTROLS, 'similar-source');
}

function UpdateConfirmUploadControls() {
    NTISAS.confirm_upload = JSPLib.storage.getLocalData('ntisas-confirm-upload', {default_val: false});
    let switch_type = (NTISAS.confirm_upload ? 'yes' : 'no');
    DisplayControl(switch_type, CONFIRM_UPLOAD_CONTROLS, 'confirm-upload');
}

function UpdateConfirmDownloadControls() {
    NTISAS.confirm_download = JSPLib.storage.getLocalData('ntisas-confirm-download', {default_val: false});
    let switch_type = (NTISAS.confirm_download ? 'yes' : 'no');
    DisplayControl(switch_type, CONFIRM_DOWNLOAD_CONTROLS, 'confirm-download');
}

function UpdateViewHighlightControls() {
    let show_highlights = JSPLib.storage.getLocalData('ntisas-view-highlights', {default_val: true});
    let switch_type = (show_highlights ? 'enabled' : 'disabled');
    DisplayControl(switch_type, VIEW_HIGHLIGHT_CONTROLS, 'view-highlights');
}

function UpdateViewCountControls() {
    let count_views = NTISAS.count_views = JSPLib.storage.getLocalData('ntisas-view-counts', {default_val: true});
    let switch_type = (count_views ? 'enabled' : 'disabled');
    DisplayControl(switch_type, VIEW_COUNT_CONTROLS, 'view-counts');
}

function UpdateViewHighlights() {
    let show_highlights = JSPLib.storage.getLocalData('ntisas-view-highlights', {default_val: true});
    let jquery_action = (show_highlights ? 'addClass' : 'removeClass');
    $('[role=main]')[jquery_action]('ntisas-show-views');
}

function UpdateMenuResults(tweet_id, html, is_active) {
    let $tweet = GetTweet(tweet_id);
    let $menu_results = $tweet.find('.ntisas-menu-results');
    if (NTISAS.advanced_tooltips_enabled && tweet_id in NTISAS.qtip_anchor) {
        NTISAS.qtip_anchor[tweet_id].qtiptisas('destroy', true);
        delete NTISAS.qtip_anchor[tweet_id];
    }
    $menu_results.html(html);
    if (is_active) {
        $tweet.find('.ntisas-menu-search').addClass('ntisas-menu-active');
    } else {
        $tweet.find('.ntisas-menu-search').removeClass('ntisas-menu-active');
    }
}

function UpdatePostIDsLink(tweet_id, post_ids) {
    let $tweet = GetTweet(tweet_id);
    if ($tweet.length === 0) {
        return;
    }
    let $link = $tweet.find('.ntisas-database-match, .ntisas-confirm-save');
    if ($link.length && NTISAS.advanced_tooltips_enabled) {
        $link.qtiptisas('destroy', true);
    }
    if (post_ids.length === 0) {
        InitializeNoMatchesLinks(tweet_id);
    } else {
        InitializePostIDsLink(tweet_id, $tweet[0], post_ids);
    }
    // eslint-disable-next-line dot-notation
    NTISAS.no_confirm.delete(tweet_id);
}

function UpdateThumbnails(container, all_posts) {
    all_posts.forEach(async (post) => {
        let blob = await JSPLib.network.getData(post.thumbnail);
        let image_blob = blob.slice(0, blob.size, 'image/jpeg');
        let blob_url = window.URL.createObjectURL(image_blob);
        $(`[data-id=${post.id}] img`, container).attr('src', blob_url);
    });
}

//Page functions

function IsPageType(types) {
    return types.includes(NTISAS.page) || (NTISAS.page === 'display' && types.includes(NTISAS.prev_page));
}

function IsTweetPage() {
    return IsPageType(['tweet', 'web_tweet']);
}

function GetPageType(page_url) {
    page_url = page_url.split('#')[0];
    for (let key in PAGE_REGEXES) {
        NTISAS.page_match = PAGE_REGEXES[key].exec(page_url);
        if (NTISAS.page_match) {
            return key;
        }
    }
    return 'other';
}

function PageNavigation(pagetype) {
    let printer = JSPLib.debug.getFunctionPrint('PageNavigation');
    //Use all non-URL matching groups as a page key to detect page changes
    let page_key = NTISAS.page_match.groups ?
        JSPLib.utility.arrayUnique(
            Object.values(NTISAS.page_match.groups).filter((val) => (JSPLib.validate.isString(val) && !val.startsWith('https:')))
        ).join(',') :
        "";
    if (NTISAS.page === pagetype && NTISAS.page_key === page_key && (pagetype !== 'hashtag' || NTISAS.hashtag_search === window.location.search)) {
        return;
    }
    var params;
    let account = NTISAS.page_match.groups?.account;
    let page_id = NTISAS.page_match.groups?.id;
    NTISAS.prev_page = NTISAS.page;
    NTISAS.page = pagetype;
    NTISAS.page_key = page_key;
    switch (NTISAS.page) {
        case 'main':
        case 'media':
        case 'likes':
        case 'replies':
            printer.debuglog(`User timeline [${NTISAS.page}]:`, account);
            NTISAS.account = account;
            UpdateUserIDCallback();
            if (NTISAS.account === 'following' || NTISAS.account === 'lists') {
                return;
            }
            break;
        case 'home':
        case 'list':
        case 'topics':
        case 'events':
            printer.debuglog(`Stream timeline [${NTISAS.page}]:`, page_id ?? "n/a");
            NTISAS.account = NTISAS.user_id = undefined;
            break;
        case 'hashtag':
            printer.debuglog("Hashtag timeline:", NTISAS.page_match.groups.hashtag);
            NTISAS.account = NTISAS.user_id = undefined;
            NTISAS.hashtag_search = window.location.search;
            break;
        case 'search':
            printer.debuglog("Search timeline:", NTISAS.page_match.groups.query);
            params = JSPLib.utility.parseParams(NTISAS.page_match.groups.query);
            NTISAS.queries = ParseQueries(params.q);
            NTISAS.account = ('from' in NTISAS.queries ? NTISAS.queries.from : undefined);
            NTISAS.user_id = undefined;
            break;
        case 'tweet':
        case 'web_tweet':
            printer.debuglog("Tweet ID:", page_id);
            NTISAS.screen_name = account;
            NTISAS.tweet_id = page_id;
            NTISAS.account = NTISAS.user_id = undefined;
            break;
        case 'display':
            printer.debuglog("Twitter display settings");
            return;
        default:
            //Do nothing
    }
    //Only render pages with attachment points
    if (IsPageType(STREAMING_PAGES) || IsTweetPage()) {
        if ($('#ntisas-side-menu').length === 0) {
            $(document.body).append(RenderSideMenu());
            $(window.navigation).off('navigate.ntisas').on('navigate.ntisas', MenuNavigation);
            InitializeSideMenu();
            InitializeDatabaseLink();
            InitializeTotalRecords().then((total) => {
                $('#ntisas-records-stub').replaceWith(`<a id="ntisas-total-records" class="ntisas-expanded-link">${total}</a>`);
                $('#ntisas-total-records').on(PROGRAM_CLICK, QueryTotalRecords);
            });
        }
        //Bind events for creation/rebind
        if (!JSPLib.utility.isNamespaceBound('#ntisas-open-settings', 'click', PROGRAM_SHORTCUT)) {
            $('#ntisas-menu-selection a').on(PROGRAM_CLICK, SideMenuSelection);
            $('#ntisas-current-records').on(PROGRAM_CLICK, CurrentRecords);
            $('#ntisas-similar-toggle a').on(PROGRAM_CLICK, ToggleSimilarSource);
            $('#ntisas-confirm-upload-toggle a').on(PROGRAM_CLICK, ToggleConfirmUpload);
            $('#ntisas-confirm-download-toggle a').on(PROGRAM_CLICK, ToggleConfirmDownload);
            $('#ntisas-view-highlights-toggle a').on(PROGRAM_CLICK, ToggleViewHighlights);
            $('#ntisas-view-counts-toggle a').on(PROGRAM_CLICK, ToggleViewCounts);
            $('#ntisas-open-settings').on(PROGRAM_CLICK, OpenSettingsMenu);
            //These will only get bound here on a rebind
            $('#ntisas-total-records').on(PROGRAM_CLICK, QueryTotalRecords);
            $('#ntisas-error-messages').on(PROGRAM_CLICK, ErrorMessages);
            $('#ntisas-lockpage-toggle a').on(PROGRAM_CLICK, ToggleLock);
        }
        if (!IsTweetPage() && (NTISAS.prev_pagetype !== 'tweet')) {
            let stat_key = NTISAS.page + NTISAS.page_key;
            NTISAS.page_stats[stat_key] ??= [];
            NTISAS.tweet_stats = NTISAS.page_stats[stat_key];
            NTISAS.tweet_type1_filter = 'total';
            NTISAS.tweet_type2_filter = 'total';
            if (NTISAS.tweet_stats.length) {
                InitializeTweetStats(NTISAS.tweet_type1_filter, NTISAS.tweet_type2_filter);
            }
        }
        if (IsTweetPage()) {
            $('#ntisas-tweet-stats-table').hide();
            $('#ntisas-tweet-stats-message').show();
        } else {
            $('#ntisas-tweet-stats-table').show();
            $('#ntisas-tweet-stats-message').hide();
        }
        if (IsPageType(['main', 'media', 'likes', 'replies'])) {
            if (NTISAS.display_user_id || NTISAS.display_profile_views) {
                InitializeProfileTimeline();
            }
            UpdateProfileCallback();
            if (NTISAS.self_tweet_highlights) {
                $('[role=main]').addClass('ntisas-self-tweet-highlights');
            } else {
                $('[role=main]').removeClass('ntisas-self-tweet-highlights');
            }
        }
    }
    UpdateSideMenu(NTISAS.page, false);
    UpdateSimilarControls();
    UpdateConfirmUploadControls();
    UpdateConfirmDownloadControls();
    UpdateViewHighlightControls();
    UpdateViewCountControls();
    SetCheckPostvers();
    //Tweets are not available upon page load, so don't bother processing them
    if (NTISAS.prev_pagetype !== undefined) {
        UpdateViewHighlights();
    }
}

//Post version functions

function SetCheckPostvers() {
    if (JSPLib.concurrency.checkTimeout('ntisas-timeout', GetPostVersionsExpiration()) || WasOverflow()) {
        clearTimeout(NTISAS.postvers_timeout);
        NTISAS.postvers_timeout = setTimeout(() => {
            if (NTISAS.database_info && JSPLib.concurrency.reserveSemaphore(PROGRAM_SHORTCUT, 'postvers')) {
                CheckPostvers_T();
            }
        }, POST_VERSIONS_CALLBACK);
    }
}

async function GetAllCurrentRecords() {
    let i = 0;
    while (true) {
        if (!WasOverflow() || !NTISAS.database_info) {
            //Main exit condition
            break;
        }
        clearTimeout(NTISAS.postvers_timeout);
        if (JSPLib.concurrency.reserveSemaphore(PROGRAM_SHORTCUT, 'postvers')) {
            JSPLib.notice.notice(`Querying Danbooru...[${i}]`, false, false);
            await CheckPostvers_T();
        } else {
            JSPLib.notice.notice(`Waiting on other tasks to finish...[${i}]`, false, false);
            await JSPLib.utility.sleep(POST_VERSIONS_CALLBACK);
        }
        i++;
    }
}

async function CheckPostvers() {
    let printer = JSPLib.debug.getFunctionPrint('CheckPostvers');
    let postver_lastid = GetPostVersionsLastID('postver');
    let url_addons = {search: {source_changed: true, source_regex: '(twitter|x)\\.com'}, only: POSTVER_FIELDS};
    let query_params = {addons: url_addons, reverse: true, domain: NTISAS.domain, notify: true};
    if (postver_lastid) {
        query_params.page = postver_lastid;
    }
    let post_versions = await JSPLib.danbooru.getAllItems('post_versions', QUERY_LIMIT, {page: postver_lastid, batches: QUERY_BATCH_NUM, url_addons, reverse: true, domain: NTISAS.domain, notify: true});
    if (post_versions.length === QUERY_BATCH_SIZE) {
        printer.debuglog("Overflow detected!");
        JSPLib.storage.setLocalData('ntisas-overflow', true);
    } else {
        printer.debuglog("No overflow:", post_versions.length, QUERY_BATCH_SIZE);
        JSPLib.storage.setLocalData('ntisas-overflow', false);
    }
    if (post_versions.length) {
        let [add_entries, rem_entries] = ProcessPostvers(post_versions);
        printer.debuglog("Process:", add_entries, rem_entries);
        SavePostvers(add_entries, rem_entries);
        let lastid = JSPLib.danbooru.getNextPageID(post_versions, true);
        //Since the post version last ID is critical, an extra sanity check has been added
        if (JSPLib.validate.validateID(lastid)) {
            JSPLib.storage.setLocalData('ntisas-postver-lastid', lastid);
            let all_timestamps = JSPLib.utility.getObjectAttributes(post_versions, 'updated_at');
            let normal_timestamps = all_timestamps.map((timestamp) => (new Date(timestamp).getTime()));
            let most_recent_timestamp = Math.max(...normal_timestamps);
            JSPLib.storage.setLocalData('ntisas-recent-timestamp', most_recent_timestamp);
            InitializeCurrentRecords();
            NTISAS.channel.postMessage({type: 'currentrecords'});
        }
    }
    JSPLib.concurrency.setRecheckTimeout('ntisas-timeout', GetPostVersionsExpiration());
    JSPLib.concurrency.freeSemaphore(PROGRAM_SHORTCUT, 'postvers');
}

async function CheckServerBadTweets() {
    let printer = JSPLib.debug.getFunctionPrint('CheckServerBadTweets');
    if (NTISAS.database_info && JSPLib.concurrency.checkTimeout('ntisas-badver-recheck', BADVER_RECHECK_EXPIRES) && JSPLib.concurrency.reserveSemaphore(PROGRAM_SHORTCUT, 'badvers')) {
        let postver_lastid = GetPostVersionsLastID('badver');
        let url_addons = {search: {changed_tags: 'bad_twitter_id'}, only: POSTVER_FIELDS};
        let post_versions = await JSPLib.danbooru.getAllItems('post_versions', QUERY_LIMIT, {page: postver_lastid, url_addons, batches: QUERY_BATCH_NUM, reverse: true, domain: NTISAS.domain, notify: true});
        if (post_versions.length === QUERY_BATCH_SIZE) {
            printer.debuglog("Overflow detected!");
        } else {
            printer.debuglog("No overflow:", post_versions.length, QUERY_BATCH_SIZE);
            JSPLib.concurrency.setRecheckTimeout('ntisas-badver-recheck', BADVER_RECHECK_EXPIRES);
        }
        if (post_versions.length) {
            let [add_entries, rem_entries] = ProcessPostvers(post_versions);
            printer.debuglog("Process:", add_entries, rem_entries);
            SavePostvers(add_entries, rem_entries);
            let lastid = JSPLib.danbooru.getNextPageID(post_versions, true);
            //Since the post version last ID is critical, an extra sanity check has been added
            if (JSPLib.validate.validateID(lastid)) {
                JSPLib.storage.setLocalData('ntisas-badver-lastid', lastid);
                InitializeCurrentRecords();
                NTISAS.channel.postMessage({type: 'currentrecords'});
            }
        }
        JSPLib.concurrency.freeSemaphore(PROGRAM_SHORTCUT, 'badvers');
    }
}

function GetPostVersionsLastID(type) {
    //Get the program last ID if it exists
    const storage_key = `ntisas-${type}-lastid`;
    JSPLib.storage.invalidateLocalData(storage_key);
    let postver_lastid = JSPLib.storage.checkLocalData(storage_key, {default_val: NTISAS.database_info?.post_version});
    if (!NTISAS.database_info) {
        return postver_lastid;
    }
    //Select the largest of the program lastid and the database lastid
    let max_postver_lastid = Math.max(postver_lastid, NTISAS.database_info.post_version);
    if (postver_lastid !== max_postver_lastid) {
        JSPLib.storage.setLocalData(`ntisas-${type}-lastid`, max_postver_lastid);
    }
    return max_postver_lastid;
}

function SavePostvers(add_entries, rem_entries) {
    let printer = JSPLib.debug.getFunctionPrint('SavePostvers');
    let combined_keys = JSPLib.utility.arrayIntersection(Object.keys(add_entries), Object.keys(rem_entries));
    combined_keys.forEach((tweet_id) => {
        let tweet_key = 'tweet-' + tweet_id;
        let post_ids = add_entries[tweet_id];
        JSPLib.storage.retrieveData(tweet_key, {bypass_cache: true, database: JSPLib.storage.twitterstorage}).then((data) => {
            if (JSPLib.validate.validateIDList(data)) {
                printer.debuglogLevel("Tweet adds/rems - existing IDs:", tweet_key, data, JSPLib.debug.DEBUG);
                post_ids = JSPLib.utility.arrayUnique(JSPLib.utility.arrayDifference(JSPLib.utility.arrayUnion(data, add_entries[tweet_id]), rem_entries[tweet_id]));
            }
            if (data === null || JSPLib.utility.arraySymmetricDifference(post_ids, data)) {
                printer.debuglogLevel("Tweet adds/rems - saving:", tweet_key, post_ids, JSPLib.debug.DEBUG);
                SaveData(tweet_key, post_ids, 'twitter');
                UpdatePostIDsLink(tweet_id, post_ids);
                NTISAS.channel.postMessage({type: 'postlink', tweet_id, post_ids});
            }
        });
    });
    let single_adds = JSPLib.utility.arrayDifference(Object.keys(add_entries), combined_keys);
    single_adds.forEach((tweet_id) => {
        let tweet_key = 'tweet-' + tweet_id;
        let post_ids = add_entries[tweet_id];
        JSPLib.storage.retrieveData(tweet_key, {bypass_cache: true, database: JSPLib.storage.twitterstorage}).then((data) => {
            if (JSPLib.validate.validateIDList(data)) {
                printer.debuglog("Tweet adds - existing IDs:", tweet_key, data);
                post_ids = JSPLib.utility.arrayUnion(data, post_ids);
            }
            if (data === null || post_ids.length > data.length) {
                printer.debuglog("Tweet adds - saving:", tweet_key, post_ids);
                SaveData(tweet_key, post_ids, 'twitter');
                UpdatePostIDsLink(tweet_id, post_ids);
                NTISAS.channel.postMessage({type: 'postlink', tweet_id, post_ids});
            }
        });
    });
    let single_rems = JSPLib.utility.arrayDifference(Object.keys(rem_entries), combined_keys);
    single_rems.forEach((tweet_id) => {
        let tweet_key = 'tweet-' + tweet_id;
        let post_ids = [];
        JSPLib.storage.retrieveData(tweet_key, {bypass_cache: true, database: JSPLib.storage.twitterstorage}).then((data) => {
            if (data !== null && JSPLib.validate.validateIDList(data)) {
                printer.debuglog("Tweet removes - existing IDs:", tweet_key, data);
                post_ids = JSPLib.utility.arrayUnique(JSPLib.utility.arrayDifference(data, rem_entries[tweet_id]));
            }
            if (post_ids.length) {
                printer.debuglog("Tweet removes - saving:", tweet_key, post_ids);
                SaveData(tweet_key, post_ids, 'twitter');
            } else {
                printer.debuglog("Tweet removes - deleting:", tweet_key);
                RemoveData(tweet_key, 'twitter');
            }
            if (data !== null) {
                UpdatePostIDsLink(tweet_id, post_ids);
                NTISAS.channel.postMessage({type: 'postlink', tweet_id, post_ids});
            }
        });
    });
}

function ProcessPostvers(postvers) {
    let printer = JSPLib.debug.getFunctionPrint('ProcessPostvers');
    postvers.sort((a, b) => (a.id - b.id));
    var account_swaps = 0;
    var link_modifies = 0;
    var inactive_posts = 0;
    var reversed_posts = 0;
    var add_entries = {};
    var rem_entries = {};
    postvers.forEach((postver) => {
        if (postver.source_changed) {
            if (postver.version === 1) {
                let tweet_id = JSPLib.utility.findAll(postver.source, TWEET_REGEXG)[1];
                if (tweet_id) {
                    add_entries[tweet_id] ??= [];
                    add_entries[tweet_id] = JSPLib.utility.arrayUnion(add_entries[tweet_id], [postver.post_id]);
                } else {
                    printer.debugwarn("Unfound new post:", postver.source, postver);
                }
            } else {
                let tweet_id = {};
                let twitter_add = postver.added_tags.find((tag) => SOURCE_TWITTER_REGEX.test(tag)) ?? "";
                tweet_id.add = JSPLib.utility.findAll(twitter_add, SOURCE_TWITTER_REGEXG)[1];
                let twitter_rem = postver.removed_tags.find((tag) => SOURCE_TWITTER_REGEX.test(tag)) ?? "";
                tweet_id.rem = JSPLib.utility.findAll(twitter_rem, SOURCE_TWITTER_REGEXG)[1];
                var link_modify = false;
                if (tweet_id.add && tweet_id.rem) {
                    if (tweet_id.add === tweet_id.rem) {
                        tweet_id.add = tweet_id.rem = undefined;
                        link_modify = true;
                        link_modifies++;
                        printer.debuglog("Link modify detected", twitter_rem, "->", twitter_add);
                    } else {
                        account_swaps++;
                        printer.debuglog("ID swap detected", tweet_id.rem, "->", tweet_id.add);
                    }
                }
                if (tweet_id.add) {
                    add_entries[tweet_id.add] = add_entries[tweet_id.add] || [];
                    add_entries[tweet_id.add] = JSPLib.utility.arrayUnion(add_entries[tweet_id.add], [postver.post_id]);
                    if (RemoveHashKeyValue(rem_entries, tweet_id.add[0], postver.post_id)) {
                        printer.debuglog("Source delete reversal detected", tweet_id.add);
                    }
                }
                if (tweet_id.rem) {
                    rem_entries[tweet_id.rem] = rem_entries[tweet_id.rem] || [];
                    JSPLib.utility.arrayUnion(rem_entries[tweet_id.rem], [postver.post_id]);
                    if (RemoveHashKeyValue(add_entries, tweet_id.rem, postver.post_id)) {
                        printer.debuglog("Source add reversal detected", tweet_id.rem);
                    }
                }
                if (!tweet_id.add && !tweet_id.rem && !link_modify) {
                    printer.debugwarn("Unfound edit post:", postver.added_tags, postver.removed_tags, twitter_add, twitter_rem, postver);
                }
            }
        }
        if (postver.added_tags.includes('bad_twitter_id') || postver.removed_tags.includes('bad_twitter_id')) {
            let tweet_id = JSPLib.utility.findAll(postver.source, TWEET_REGEXG)[1];
            if (tweet_id) {
                if (postver.removed_tags.includes('bad_twitter_id')) {
                    printer.debuglog("Activated tweet:", tweet_id);
                    add_entries[tweet_id] ??= [];
                    add_entries[tweet_id] = JSPLib.utility.arrayUnion(add_entries[tweet_id], [postver.post_id]);
                    reversed_posts++;
                    if (RemoveHashKeyValue(rem_entries, tweet_id, postver.post_id)) {
                        printer.debuglog("Tweet remove reversal detected", tweet_id);
                    }
                } else if (postver.added_tags.includes('bad_twitter_id')) {
                    rem_entries[tweet_id] ??= [];
                    rem_entries[tweet_id] = JSPLib.utility.arrayUnion(rem_entries[tweet_id], [postver.post_id]);
                    inactive_posts++;
                    if (RemoveHashKeyValue(add_entries, tweet_id, postver.post_id)) {
                        printer.debuglog("Tweet add reversal detected", tweet_id);
                    }
                }
            }
        }
    });
    if (account_swaps > 0) {
        printer.debuglog("Account swaps detected:", account_swaps);
    }
    if (link_modifies > 0) {
        printer.debuglog("Link modifies detected:", link_modifies);
    }
    if (inactive_posts > 0) {
        printer.debuglog("Inactive tweets detected:", inactive_posts);
    }
    if (reversed_posts > 0) {
        printer.debuglog("Activated tweets detected:", reversed_posts);
    }
    return [add_entries, rem_entries];
}

//File functions

function ReadFileAsync(fileselector, is_json) {
    let printer = JSPLib.debug.getFunctionPrint('ReadFileAsync');
    return new Promise((resolve, reject) => {
        let files = $(fileselector).prop('files');
        if (!files.length) {
            alert('Please select a file!');
            reject();
            return;
        }
        var file = files[0];
        var reader = new FileReader();
        reader.onloadend = function(event) {
            if (event.target.readyState === FileReader.DONE) {
                printer.debuglog("File loaded:", file.size);
                let data = event.target.result;
                if (is_json) {
                    try {
                        data = JSON.parse(data);
                    } catch (e) {
                        JSPLib.notice.error("Error: File is not JSON!");
                        reject();
                    }
                }
                resolve(data);
            }
        };
        var blob = file.slice(0, file.size);
        reader.readAsBinaryString(blob);
    });
}

function DownloadObject(export_obj, export_name, is_json) {
    var export_data = export_obj;
    var encoding = {type: 'text/plain;charset=utf-8'};
    if (is_json) {
        export_data = JSON.stringify(export_obj);
        encoding = {type: 'text/json;charset=utf-8'};
    }
    var blob = new Blob([export_data], encoding);
    saveAs(blob, export_name);
}

//Render functions

function RenderSideMenu() {
    let current_message = (!JSPLib.storage.checkLocalData('ntisas-recent-timestamp') ? MUST_INSTALL_HELP : UPDATE_RECORDS_HELP);
    return JSPLib.utility.regexReplace(SIDE_MENU, {
        SIMILAR_SOURCE: SIMILAR_SOURCE_HTML,
        SIMILAR_SOURCE_HELP: RenderHelp(SIMILAR_SOURCE_HELP),
        CONFIRM_UPLOAD: CONFIRM_UPLOAD_HTML,
        CONFIRM_UPLOAD_HELP: RenderHelp(CONFIRM_UPLOAD_HELP),
        CONFIRM_DOWNLOAD: CONFIRM_DOWNLOAD_HTML,
        CONFIRM_DOWNLOAD_HELP: RenderHelp(CONFIRM_DOWNLOAD_HELP),
        CURRENTRECORDS: RenderCurrentRecords(),
        CURRENTHELP: RenderHelp(current_message),
        RECORDSHELP: RenderHelp(REFRESH_RECORDS_HELP),
        SAUCEHELP: RenderHelp(AVAILABLE_SAUCE_HELP),
        VIEW_HIGHLIGHTS: VIEW_HIGHLIGHTS_HTML,
        VIEW_HIGHLIGHTS_HELP: RenderHelp(VIEWS_HIGHLIGHTS_HELP),
        VIEW_COUNTS: VIEW_COUNTS_HTML,
        VIEW_COUNTS_HELP: RenderHelp(VIEWS_COUNTS_HELP),
        LOCKPAGE: LOCKPAGE_HTML,
        LOCKPAGEHELP: RenderHelp(LOCKPAGE_HELP),
        ERRORMESSAGES: JSPLib.network.error_messages.length,
        ERRORMESSAGESHELP: RenderHelp(ERROR_MESSAGES_HELP),
        SETTINGSHELP: SETTINGS_HELP,
        STATISTICSHELP: RenderHelp(STATISTICS_HELP),
    });
}

function RenderCurrentRecords() {
    var record_html = "";
    let timestamp = JSPLib.storage.checkLocalData('ntisas-recent-timestamp');
    if (timestamp) {
        let timestring = new Date(timestamp).toLocaleString();
        let timeagostring = ((Date.now() - timestamp) < GetPostVersionsExpiration() * 2 ? "Up to date" : JSPLib.utility.timeAgo(timestamp));
        record_html = `<a id="ntisas-current-records" class="ntisas-expanded-link ntisas-narrow-text" title="${timestring}">${timeagostring}</a>`;
    } else {
        record_html = '<span id="ntisas-current-records">Loading...</span>';
    }
    return record_html;
}

function RenderDatabaseVersion(database_info) {
    let datestring = GetDateString(database_info.timestamp);
    let title = "Checked until: " + new Date(database_info.timestamp).toLocaleString();
    title += "\nLast post version: " + database_info.post_version;
    if (database_info.max_post_id) {
        title += "\nLast post id: " + database_info.max_post_id;
    }
    if (database_info.max_tweet_id) {
        title += "\nLast tweet id: " + database_info.max_tweet_id;
    }
    let url = GetForumTopicLink();
    return `<a id="ntisas-database-version" title="${title}" href="${url}" target="_blank">${datestring}</a>`;
}

function RenderMediaMenu(tweet_id, screen_name, image_urls, videos) {
    let image_html = image_urls.map((url, i) => {
        let media_type = (videos[i] ? 'video' : 'image');
        let extpos = url.lastIndexOf('.');
        let partial = url.slice(0, extpos);
        let ext = url.slice(extpos + 1);
        let image_url = `${partial}?format=${ext}&name=240x240`;
        let video_icon = (videos[i] ? MEDIA_VIDEO_ICON : "");
        return `<div class="ntisas-media-${media_type}" data-order="${i}" title="${media_type} #${i + 1}"><img src="${image_url}">${video_icon}</div>`;
    }).join("");
    return `
<div class="ntisas-media-menu" ntisas-tweet="media" data-tweet-id="${tweet_id}" data-user-id="${NTISAS.user_id}" data-screen-name="${screen_name}">
    <div class="ntisas-media-images">
        ${image_html}
    </div>
    ${NTISAS_TWEET_MENU}
</div>`;
}

function RenderPostIDsLink(post_ids, posts, classname) {
    var title, href, text;
    if (post_ids.length === 1) {
        title = (posts.length > 0 ? GetLinkTitle(posts[0]) : "");
        href = `${NTISAS.domain}/posts/${post_ids[0]}`;
        text = 'post #' + post_ids[0];
    } else {
        title = (posts.length > 0 ? GetMultiLinkTitle(posts) : "");
        let query = (NTISAS.custom_order_enabled && (NTISAS.user_data.level >= GOLD_LEVEL) ? '+order%3Acustom' : '');
        href = `${NTISAS.domain}/posts?tags=status%3Aany+id%3A${post_ids.join(',')}${query}`;
        text = post_ids.length + ' sources';
    }
    return `
<a
    class="ntisas-manual-add ${classname} ntisas-expanded-link"
    data-has-posts="true"
    target="_blank"
    title="${title}"
    href="${href}"
    >
    ${text}
</a>`;
}

function RenderUploadLink(upload_url) {
    return `
<span class="ntisas-links">
    (
    <a
        class="ntisas-expanded-link"
        href="${upload_url}"
        target="_blank"
        >
        upload
    </a>
    )
</span>`;
}

function RenderDownloadLink(media_url, index) {
    return `
<span class="ntisas-links">
    (
    <a
        class="ntisas-download-media ntisas-expanded-link ntisas-active"
        data-order="${index}"
        data-url="${media_url}"
        >
        download
    </a>
    )
</span>`;
}

function RenderPostsQtip(all_posts) {
    let html = "";
    all_posts.forEach((post) => {
        let is_user_upload = post.uploaderid === NTISAS.user_data.id;
        let addons = RenderPreviewAddons('post #' + post.id, post.source, post.ext, Object.assign({is_user_upload}, post));
        html += RenderPostPreview(post, addons);
    });
    let controls = (all_posts.length > 1 ? SELECTION_CONTROLS : "");
    let controls_width = (all_posts.length > 1 ? 60 : 0);
    let container_width = Math.min(all_posts.length, 5) * (BASE_PREVIEW_WIDTH + 5) + BASE_QTIP_WIDTH + controls_width;
    return `
<div class="ntisas-post-result ntisas-qtip-container ntisas-selectable-results">
    <h4>Danbooru matches (${RenderHelp(POST_SELECT_HELP)})</h4>
    <div style="position: relative; display: flex; width: ${container_width}px;">
        <div>${html}</div>
        ${controls}
    </div>
</div>`;
}

function RenderSearchDialog(tweet_id, image_urls) {
    let html = "";
    image_urls.forEach((image_url, i) => {
        let encoded_image_url = encodeURIComponent(image_url);
        let search_url = `${NTISAS.domain}/iqdb_queries?url=${encoded_image_url}`;
        let search_html = `<span class="ntisas-links">(&thinsp;<a href="${search_url}" target="blank">search</a>&thinsp;)</span>`;
        html += RenderTwimgPreview(image_url, i, 'selectable', search_html);
    });
    return `
<div class="ntisas-search-dialog ntisas-confirm-image ntisas-selectable-results ntisas-dialog-container" data-tweet-id="${tweet_id}">
    <p><small>Selected images (blue border) will be used for the query. Click <b>Submit</b> to finish, or <b>Close</b> to exit.</small></p>
    <div style="position: relative;">
        ${html}
        ${SELECTION_CONTROLS}
    </div>
</div>`;
}

function RenderConfirmDialog(tweet_id, similar_results) {
    var image_results = [];
    similar_results.forEach((image_result, i) => {
        let html = RenderSimilarContainer(image_result, i);
        image_results.push(html);
    });
    return `
<div class="ntisas-confirm-dialog ntisas-dialog-container" data-tweet-id="${tweet_id}">
    <p><small><br><b>Submit</b> will save the results, and <b>Close</b> will exit without saving. Clicking <b>Confirm</b> in the tweet menu will reopen this dialog.</small></p>
    <div class="ntisas-similar-container">
        ${image_results.join(HORIZONTAL_RULE)}
    </div>
</div>`;
}

function RenderSimilarContainer(image_result, index) {
    var html = RenderTwimgPreview(image_result.image_url, index, 'normal', 'Original image');
    html += `<div class="ntisas-vertical-rule"></div>`;
    if (image_result.results.length > 0) {
        image_result.results.forEach((iqdb_result) => {
            let post = iqdb_result.post;
            let is_user_upload = post.uploaderid === NTISAS.user_data.id;
            let similarity_score = JSPLib.utility.setPrecision(iqdb_result.score, 2);
            let addons = RenderPreviewAddons(`Similarity: ${similarity_score}`, post.source, post.ext, Object.assign({is_user_upload}, post));
            html += RenderPostPreview(post, addons);
        });
    } else {
        html += `
<div class="ntisas-no-results">
    <span>Nothing found.</span>
</div>`;
    }
    let controls = (image_result.results.length > 1 ? SELECTION_CONTROLS : "");
    return `
<div class="ntisas-similar-result ntisas-selectable-results">
    <div class="ntisas-similar-header">
        <div class="ntisas-similar-header-text">Image #${index + 1}</div>
        <div class="ntisas-similar-header-help">(${RenderHelp(IQDB_SELECT_HELP)})</div>
    </div>
    ${html}
    ${controls}
</div>`;
}

function RenderUploadDialog(tweet_id, screen_name, image_urls, videos) {
    let html = "";
    let encoded_tweet_url = encodeURIComponent(`https://twitter.com/${screen_name}/status/${tweet_id}`);
    image_urls.forEach((image_url, i) => {
        let is_video = videos[i];
        var upload_html;
        if (!is_video) {
            let encoded_image_url = encodeURIComponent(image_url);
            let upload_url = `${NTISAS.domain}/uploads/new?url=${encoded_image_url}&ref=${encoded_tweet_url}`;
            upload_html = RenderUploadLink(upload_url);
        } else {
            upload_html = 'loading...';
        }
        html += RenderTwimgPreview(image_url, i, 'preview', upload_html, is_video);
    });
    let upload_url = `${NTISAS.domain}/uploads/new?url=${encoded_tweet_url}`;
    return `
<div class="ntisas-upload-dialog ntisas-dialog-container" data-tweet-id="${tweet_id}">
    <div class="ntisas-preview-section">
        ${html}
    </div>
    <a class="ntisas-upload-all" href="${upload_url}" target="_blank" style="display: none;"></a>
</div>`;
}

function RenderDownloadDialog(tweet_id, screen_name, image_urls, videos) {
    let html = "";
    image_urls.forEach((image_url, i) => {
        let is_video = videos[i];
        var download_html;
        if (!is_video) {
            download_html = RenderDownloadLink(image_url, i);
        } else {
            download_html = 'loading...';
        }
        html += RenderTwimgPreview(image_url, i, 'preview', download_html, is_video);
    });
    return `
<div class="ntisas-download-dialog ntisas-dialog-container" data-tweet-id="${tweet_id}" data-screen-name="${screen_name}">
    <div class="ntisas-illust-previews">
        <div class="ntisas-preview-section">
            ${html}
        </div>
    </div>
</div>`;
}

function RenderPostPreview(post, append_html = "") {
    let [width, height] = JSPLib.utility.getPreviewDimensions(post.width, post.height, POST_PREVIEW_DIMENSION);
    let padding_height = POST_PREVIEW_DIMENSION - height;
    let title = GetLinkTitle(post);
    return `
<article class="ntisas-post-preview ntisas-post-selectable ntisas-post-select" data-id="${post.id}" data-size="${post.size}">
    <div class="ntisas-image-container">
        <a target="_blank" href="https://danbooru.donmai.us/posts/${post.id}">
            <img width="${width}" height="${height}" style="padding-top:${padding_height}px" title="${title}">
        </a>
    </div>
    ${append_html}
</article>`;
}

function RenderTwimgPreview(image_url, index, type, title, is_video = false) {
    let {extension} = GetFileURLInfo(image_url);
    let thumb_url = GetThumbUrl(image_url, ':', 'jpg', '360x360');
    var image_html, selected_class;
    if (type === 'normal') {
        image_html = `<img width="${POST_PREVIEW_DIMENSION}" height="${POST_PREVIEW_DIMENSION}" src="${thumb_url}">`;
        selected_class = "ntisas-post-preview";
    } else if (type === 'selectable') {
        image_html = `<a><img width="${POST_PREVIEW_DIMENSION}" height="${POST_PREVIEW_DIMENSION}" src="${thumb_url}"></a>`;
        selected_class = 'ntisas-post-preview ntisas-post-select ntisas-post-selectable';
    } else if (type === 'preview') {
        let orig_media_url = (is_video ? '#' : image_url + ':orig');
        image_html = `<a href="${orig_media_url}" data-url="${image_url}"><img width="${TWEET_PREVIEW_DIMENSION}" height="${TWEET_PREVIEW_DIMENSION}" src="${thumb_url}"></a>`;
        selected_class = 'ntisas-illust-preview';
    }
    let append_html = RenderPreviewAddons(title, 'https://' + location.host, extension);
    return `
<article class="ntisas-tweet-preview ${selected_class}" data-id="${index}" data-url="${image_url}">
    <div class="ntisas-image-container">
        ${image_html}
    </div>
    ${append_html}
</article>`;
}

function RenderPreviewAddons(title, source, ext, {size, width, height, is_user_upload = false} = {}) {
    let uploader_addon = (is_user_upload ? 'class="ntisas-post-upload"' : "");
    let domain = (source.match(/^https?:\/\//) ? JSPLib.utility.getDomainName(source, 2) : "NON-WEB");
    let size_text = (Number.isInteger(size) && Number.isInteger(width) && Number.isInteger(height) ? `${JSPLib.utility.readableBytes(size)} (${width} x ${height})` : "loading...");
    return `
<p class="ntisas-desc ntisas-desc-title"><span ${uploader_addon}>${title}</span></p>
<p class="ntisas-desc ntisas-desc-info">${ext.toUpperCase()} @ <span title="${domain}">${domain}</span></p>
<p class="ntisas-desc ntisas-desc-size ntisas-narrow-text">${size_text}</p>`;
}

function RenderHelp(help_text) {
    return `<a class="ntisas-help-info ntisas-expanded-link" title="${help_text}">&nbsp;?&nbsp;</a>`;
}

function RenderColorStyle(css, color_data) {
    return JSPLib.utility.regexReplace(css, {
        BASECOLOR: JSPLib.utility.sprintf('rgb(%s, %s, %s)', ...color_data.base_color),
        BASEFAINT: JSPLib.utility.sprintf('rgba(%s, %s, %s, 0.2)', ...color_data.base_color),
        BASESHADED: JSPLib.utility.sprintf('rgba(%s, %s, %s, 0.5)', ...color_data.base_color),
        BASEDARKER: JSPLib.utility.sprintf('rgb(%s, %s, %s)', ...DarkenColorArray(color_data.base_color, 50)),
        TEXTCOLOR: JSPLib.utility.sprintf('rgb(%s, %s, %s)', ...color_data.text_color),
        TEXTFADED: JSPLib.utility.sprintf('rgba(%s, %s, %s, 0.1)', ...color_data.text_color),
        TEXTMUTED: JSPLib.utility.sprintf('rgba(%s, %s, %s, 0.2)', ...color_data.text_color),
        TEXTSHADED: JSPLib.utility.sprintf('rgba(%s, %s, %s, 0.5)', ...color_data.text_color),
        BACKGROUNDCOLOR: JSPLib.utility.sprintf('rgb(%s, %s, %s)', ...color_data.background_color)
    });
}

//Initialize functions

function InitializeCleanupTasks() {
    CheckServerBadTweets();
    JSPLib.storage.pruneProgramCache(PROGRAM_SHORTCUT, PROGRAM_DATA_REGEX, PRUNE_RECHECK_EXPIRES);
}

async function InitializeTotalRecords(manual = false) {
    if (manual || JSPLib.concurrency.checkTimeout('ntisas-length-recheck', LENGTH_RECHECK_EXPIRES)) {
        let database_length = await JSPLib.storage.twitterstorage.length();
        JSPLib.storage.setLocalData('ntisas-database-length', database_length);
        JSPLib.concurrency.setRecheckTimeout('ntisas-length-recheck', LENGTH_RECHECK_EXPIRES);
    }
    return JSPLib.storage.getLocalData('ntisas-database-length', {default_val: 0});
}

async function InitializelUserProfileData() {
    NTISAS.user_data = JSPLib.storage.checkLocalData('ntisas-user-data');
    if (!NTISAS.user_data || JSPLib.concurrency.checkTimeout('ntisas-user-profile-recheck', USER_PROFILE_RECHECK_EXPIRES)) {
        NTISAS.user_data = await JSPLib.danbooru.submitRequest('profile', {only: PROFILE_FIELDS}, {default_val: {}, domain: NTISAS.domain});
        if (!NTISAS.user_data.id || !NTISAS.user_data.level) {
            NTISAS.user_data = {id: 2, level: GOLD_LEVEL};
        }
        JSPLib.storage.setLocalData('ntisas-user-data', NTISAS.user_data);
        JSPLib.concurrency.setRecheckTimeout('ntisas-user-profile-recheck', USER_PROFILE_RECHECK_EXPIRES);
    }
}

function InitializeColorScheme() {
    if (!JSPLib.utility.hasStyle('color')) {
        let color_data = JSPLib.storage.checkLocalData('ntisas-color-style');
        if (color_data) {
            let color_style = RenderColorStyle(COLOR_CSS, color_data);
            JSPLib.utility.setCSSStyle(color_style, 'color');
            NTISAS.colors = color_style;
        }
    }
}

function InitializeUIStyle() {
    if (!JSPLib.utility.hasStyle('jquery')) {
        const jquery_ui_css = GM_getResourceText('jquery_ui_css');
        JSPLib.utility.setCSSStyle(jquery_ui_css, 'jquery');
    }
}

function InitializeStatusBar(tweet_status, is_main_tweet) {
    var $container;
    var direction = 'append';
    if (tweet_status.childElementCount > 0) {
        if (tweet_status.children[0] && tweet_status.children[0].children[0] && tweet_status.children[0].children[0].children[0]) {
            $container = $('> div > div > div > div:last-of-type', tweet_status);
            $("> div:last-of-type", $container[0]).css('flex-grow', 'unset').css('flex-basis', 'unset');
            $("[role=link] > span > span", $container[0]).addClass('ntisas-retweet-marker');
        } else if (!is_main_tweet) {
            direction = 'prepend';
        }
    }
    if (!$container) {
        $container = $(tweet_status);
    }
    $container[direction](STATUS_MARKER);
}

function InitializeSideMenu() {
    let $side_menu = $('#ntisas-side-menu');
    $side_menu.find('[data-setting]').each((_, entry) => {
        let setting = $(entry).data('setting');
        if (NTISAS.user_settings[setting]) {
            $(entry).show();
        } else {
            $(entry).hide();
        }
    });
    let selected_menu = JSPLib.storage.checkLocalData('ntisas-side-selection', {default_val: 'info'});
    $side_menu.find(`#ntisas-menu-selection a[data-selector=${selected_menu}]`).addClass('ntisas-selected');
    $side_menu.find(`#ntisas-content div[data-selector=${selected_menu}]`).show();
    let positions = JSPLib.storage.getLocalData('ntisas-menu-position');
    if (JSPLib.validate.isHash(positions)) {
        $side_menu.css(positions);
    }
    JSPLib.storage.checkLocalDB('ntisas-available-sauce', SAUCE_EXPIRES).then((data) => {
        if (data) {
            $('#ntisas-available-sauce').text(data.value);
        }
    });
}

function InitializeDatabaseLink() {
    //Add some validation to the following, and move it out of the RenderSideMenu function
    JSPLib.storage.retrieveData('ntisas-database-info', {bypass_cache: true, database: JSPLib.storage.twitterstorage}).then((database_info) => {
        var database_html, database_help;
        if (JSPLib.validate.isHash(database_info)) {
            NTISAS.database_info = database_info;
            database_html = RenderDatabaseVersion(database_info);
            database_help = RenderHelp(DATABASE_VERSION_HELP);
        } else {
            NTISAS.database_info = null;
            let url = GetForumTopicLink();
            database_html = `<a id="ntisas-install" class="ntisas-expanded-link ntisas-narrow-text" href="${url}">Install Database</a>`;
            database_help = RenderHelp(INSTALL_DATABASE_HELP);
            $('#ntisas-current-records').html(INSTALL_MENU_TEXT);
        }
        $('#ntisas-database-link').html(database_html);
        $('#ntisas-database-help').html(database_help);
    });
}

function InitializeCurrentRecords() {
    $('#ntisas-current-records').replaceWith(RenderCurrentRecords());
    $('#ntisas-current-records').on(PROGRAM_CLICK, CurrentRecords);
    $('#ntisas-current-records-help a').attr('title', UPDATE_RECORDS_HELP);
}

async function InitializeImageMenu($tweets) {
    let promise_array = [];
    $tweets.each((_, tweet) => {
        let p = JSPLib.utility.createPromise();
        promise_array.push(p.promise);
        let $tweet = $(tweet);
        let {tweet_id, screen_name} = GetTweetInfo($tweet);
        let encoded_url = encodeURIComponent(`https://twitter.com/${screen_name}/status/${tweet_id}`);
        $tweet.find('.ntisas-control-upload').attr('href', `${NTISAS.domain}/uploads/new?url=${encoded_url}`);
        GetData('tweet-' + tweet_id, 'twitter').then((post_ids) => {
            if (post_ids !== null) {
                InitializePostIDsLink(tweet_id, tweet, post_ids);
            } else {
                InitializeNoMatchesLinks(tweet_id);
            }
            p.resolve(null);
        });
    });
    await Promise.all(promise_array);
}

function InitializeMediaTweet(tweet_id, post_ids, tweet_dict_promise) {
    let $tweet = GetMediaTweet(tweet_id);
    let $media_icon_container = $('<div class="ntisas-media-icon-container"><div class="ntisas-media-icon"></div></div>');
    $tweet.append($media_icon_container[0]);
    let $media_icon = $media_icon_container.children().eq(0);
    if (post_ids !== null) {
        $media_icon.append(JSPLib.utility.sprintf(MEDIA_RESULTS_ICON, 'ntisas-media-match', String(post_ids.length)));
    } else {
        $media_icon.append(JSPLib.utility.sprintf(MEDIA_RESULTS_ICON, 'ntisas-media-nomatch', '·'));
    }
    if ($tweet.hasClass('ntisas-multi-media')) {
        tweet_dict_promise.then((tweet_dict) => {
            $media_icon.append(JSPLib.utility.sprintf(MEDIA_COUNTER_ICON, String(tweet_dict[tweet_id].length)));
        });
    } else {
        if (GetSingleImageInfo(tweet_id).length) {
            $media_icon.append(JSPLib.utility.sprintf(MEDIA_COUNTER_ICON, '·'));
        } else {
            let image = $tweet.find(`img`).get(0);
            if (image) {
                image.onload = function () {
                    JSPLib.debug.debuglog("Image loaded late:", tweet_id, image, image.src);
                    $tweet.find('.ntisas-media-counter').text('·');
                };
                image.onerror = function () {
                    JSPLib.debug.debugwarn("Image failed to load:", tweet_id, image);
                    $tweet.find('.ntisas-media-counter').text('X');
                };
            }
            $media_icon.append(JSPLib.utility.sprintf(MEDIA_COUNTER_ICON, '0'));
        }
    }
    $media_icon.on(PROGRAM_CLICK, OpenMediaTweetMenu);
    if (NTISAS.display_tweet_views) {
        GetData('view-' + tweet_id, 'danbooru').then((views) => {
            if (views && views.value.count > 0) {
                let timeagostring = ((Date.now() - views.value.viewed) < VIEWCOUNT_RECENT_DURATION ? "recently" : JSPLib.utility.timeAgo(views.value.viewed));
                let $view_icon = $(`<div class="ntisas-media-view-icon" title="Viewed ${timeagostring} [${views.value.count}]"></div>`);
                $tweet.append($view_icon[0]);
            }
        });
    }
    if (NTISAS.auto_unhide_tweets_enabled && $tweet.get(0)?.innerText.split('\n').some((text) => text.match(/^Warning:/))) {
        $tweet.find('[role="button"]').click();
    }
}

function InitializeQtip($obj, tweet_id, delayfunc) {
    const qtip_settings = Object.assign({}, PREVIEW_QTIP_SETTINGS, {
        content: {
            text: (_, qtip) => {
                if (!qtip.tooltip[0].hasAttribute(PROGRAM_SHORTCUT)) {
                    if (delayfunc) {
                        var timer;
                        timer = JSPLib.utility.initializeInterval(() => {
                            let results = delayfunc();
                            if (results !== false) {
                                qtip.set('content.text', results);
                                NTISAS.tweet_qtip[tweet_id] = results;
                                if (Number.isInteger(timer)) {
                                    clearInterval(timer);
                                }
                                qtip.tooltip.attr(PROGRAM_SHORTCUT, 'done');
                            } else {
                                return false;
                            }
                        }, 100);
                        return '<div style="width: 200px; height: 200px;"><b>Loading...</b></div>';
                    }
                    qtip.tooltip.attr(PROGRAM_SHORTCUT, 'done');
                }
                return NTISAS.tweet_qtip[tweet_id] ?? "Loading...";
            }
        }
    });
    $obj.qtiptisas(qtip_settings);
    NTISAS.qtip_anchor[tweet_id] = $obj;
}

function InitializeImageQtip($image) {
    let image_url = $image.attr('src');
    const qtip_settings = Object.assign({}, IMAGE_QTIP_SETTINGS, {
        content: {
            text: () => (`<a data-orig-size="${image_url}" data-showing-large="false" class="ntisas-toggle-image-size" href="#"><img src="${image_url}"></a>`),
        },
    });
    $image.qtiptisas(qtip_settings);
    NTISAS.image_anchor[image_url] = $image;
}

function InitializeTwitterImage(article, image_urls, preview_dimensions) {
    let index = Number($(article).data('id'));
    let image_url = image_urls[index] + ':orig';
    let image = $('img', article)[0];
    let image_promise = GetImageData(image_url);
    image_promise.then(({size, width, height}) => {
        let [preview_width, preview_height] = JSPLib.utility.getPreviewDimensions(width, height, preview_dimensions);
        image.width = preview_width;
        image.height = preview_height;
        image.style.paddingTop = `${preview_dimensions - preview_height}px`;
        let size_text = (size > 0 ? JSPLib.utility.readableBytes(size) : 'Unavailable');
        $('.ntisas-desc-size', article).html(`${size_text} (${width} x ${height})`);
    });
    return image_promise;
}

function InitializePostsContainer(all_posts, image_urls) {
    let $attachment = $(RenderPostsQtip(all_posts));
    UpdateThumbnails($attachment[0], all_posts);
    image_urls.forEach((image_url) => {
        JSPLib.network.getDataSize(image_url + ':orig').then((size) => {
            $(`[data-size=${size}]`, $attachment[0]).addClass('ntisas-post-match');
        });
    });
    return $attachment;
}

function InitializeSearchDialog(tweet_id, image_urls) {
    NTISAS.search_dialog ??= {};
    if (!NTISAS.search_dialog[tweet_id]) {
        InitializeUIStyle();
        let $dialog = $(RenderSearchDialog(tweet_id, image_urls));
        $('article', $dialog[0]).each((_, article) => {
            InitializeTwitterImage(article, image_urls, POST_PREVIEW_DIMENSION);
        });
        let dialog_settings = Object.assign({}, GENERAL_DIALOG_SETTINGS, {
            title: "Search Menu",
            buttons: {
                Submit: SearchSubmit,
                Close: CloseDialog,
            },
            width: Math.max(BASE_DIALOG_WIDTH + BASE_PREVIEW_WIDTH * image_urls.length + 50, 350),
        });
        $dialog.dialog(dialog_settings);
        NTISAS.search_dialog[tweet_id] = $dialog;
        NTISAS.dialog_tweet[tweet_id] ??= GetTweet(tweet_id);
    }
    NTISAS.search_dialog[tweet_id].dialog('open');
}

function InitializeConfirmDialog(tweet_id, similar_results, posts) {
    NTISAS.confirm_dialog ??= {};
    if (tweet_id in NTISAS.confirm_dialog) {
        NTISAS.confirm_dialog[tweet_id].dialog('destroy').remove();
        delete NTISAS.confirm_dialog[tweet_id];
    }
    InitializeUIStyle();
    let $dialog = $(RenderConfirmDialog(tweet_id, similar_results));
    UpdateThumbnails($dialog[0], posts);
    let image_urls = JSPLib.utility.getObjectAttributes(similar_results, 'image_url');
    $('article:first-of-type', $dialog[0]).each((_, article) => {
        InitializeTwitterImage(article, image_urls, POST_PREVIEW_DIMENSION).then(({size}) => {
            $(article).closest('.ntisas-similar-result').find(`[data-size=${size}]`).addClass('ntisas-post-match');
        });
    });
    let max_results = Math.max(...similar_results.map((result) => result.results.length));
    let base_width = max_results > 1 ? 180 : 120;
    let render_width = Math.min(((max_results + 1) * BASE_PREVIEW_WIDTH) + base_width, 1200);
    let dialog_settings = Object.assign({}, GENERAL_DIALOG_SETTINGS, {
        title: "Confirm Menu",
        buttons: {
            Submit: ConfirmSubmit,
            Close: CloseDialog,
        },
        width: render_width,
    });
    $dialog.dialog(dialog_settings);
    $dialog.dialog('open');
    NTISAS.confirm_dialog[tweet_id] = $dialog;
    NTISAS.dialog_tweet[tweet_id] ??= GetTweet(tweet_id);
    UpdateMenuResults(tweet_id, '<a class="ntisas-control-confirm ntisas-expanded-link">Confirm</a>', false);
}

function InitializeUploadDialog(tweet_id, screen_name, image_urls, videos) {
    NTISAS.upload_dialog ??= {};
    if (!NTISAS.upload_dialog[tweet_id]) {
        InitializeUIStyle();
        let $dialog = $(RenderUploadDialog(tweet_id, screen_name, image_urls, videos));
        $('article', $dialog[0]).each((_, article) => {
            InitializeTwitterImage(article, image_urls, TWEET_PREVIEW_DIMENSION);
        });
        if (videos.some((status) => status)) {
            GetTweetData(tweet_id).then((tweet_data) => {
                tweet_data.forEach((url_data, i) => {
                    let is_video = videos[i];
                    if (!is_video) return;
                    let video_url = 'https://video.twimg.com/' + url_data.partial_video;
                    let encoded_video_url = encodeURIComponent(video_url);
                    let encoded_tweet_url = encodeURIComponent(`https://twitter.com/${screen_name}/status/${tweet_id}`);
                    let upload_url = `${NTISAS.domain}/uploads/new?url=${encoded_video_url}&ref=${encoded_tweet_url}`;
                    let upload_html = RenderUploadLink(upload_url);
                    let $tweet_preview = $dialog.find(`.ntisas-tweet-preview[data-id="${i}"]`);
                    $tweet_preview.find('.ntisas-image-container a').attr('href', video_url);
                    $tweet_preview.find('.ntisas-desc-title').html(upload_html);
                });
            });
        }
        $dialog.find('.ntisas-image-container a').on(PROGRAM_CLICK, PopupTweetLargeImage);
        let dialog_settings = Object.assign({}, GENERAL_DIALOG_SETTINGS, {
            title: "Upload Menu",
            buttons: {
                'Upload All': UploadAllSubmit,
                Close: CloseDialog,
            },
            width: 675,
        });
        $dialog.dialog(dialog_settings);
        NTISAS.upload_dialog[tweet_id] = $dialog;
    }
    NTISAS.upload_dialog[tweet_id].dialog('open');
    NTISAS.dialog_tweet[tweet_id] ??= GetTweet(tweet_id);
}

function InitializeDownloadDialog(tweet_id, screen_name, image_urls, videos) {
    NTISAS.download_dialog ??= {};
    if (!NTISAS.download_dialog[tweet_id]) {
        InitializeUIStyle();
        let $dialog = $(RenderDownloadDialog(tweet_id, screen_name, image_urls, videos));
        $('article', $dialog[0]).each((_, article) => {
            InitializeTwitterImage(article, image_urls, TWEET_PREVIEW_DIMENSION);
        });
        if (videos.some((status) => status)) {
            GetTweetData(tweet_id).then((tweet_data) => {
                tweet_data.forEach((url_data, i) => {
                    let is_video = videos[i];
                    if (!is_video) return;
                    let video_url = 'https://video.twimg.com/' + url_data.partial_video;
                    let download_html = RenderDownloadLink(video_url, i);
                    let $tweet_preview = $dialog.find(`.ntisas-tweet-preview[data-id="${i}"]`);
                    $tweet_preview.find('.ntisas-image-container a').attr('href', video_url);
                    $tweet_preview.find('.ntisas-desc-title').html(download_html);
                });
            });
        }
        $dialog.find('.ntisas-image-container a').on(PROGRAM_CLICK, PopupTweetLargeImage);
        let dialog_settings = Object.assign({}, GENERAL_DIALOG_SETTINGS, {
            title: "Download Menu",
            buttons: {
                'Download All': DownloadAllSubmit,
                Close: CloseDialog,
            },
            width: 675,
        });
        $dialog.dialog(dialog_settings);
        NTISAS.download_dialog[tweet_id] = $dialog;
    }
    NTISAS.download_dialog[tweet_id].dialog('open');

}
async function InitializePostIDsLink(tweet_id, tweet, post_ids) {
    let posts_data = await GetPosts(post_ids);
    UpdateMenuResults(tweet_id, RenderPostIDsLink(post_ids, posts_data, 'ntisas-database-match'), false);
    if (NTISAS.advanced_tooltips_enabled) {
        let $link = $('.ntisas-database-match, .ntisas-confirm-save', tweet);
        InitializeQtip($link, tweet_id, () => {
            var image_urls;
            if (Array.isArray(tweet.ntisasImageUrls)) {
                image_urls = tweet.ntisasImageUrls;
            }
            if (!image_urls) {
                if (!tweet.ntisasDeferred) {
                    return "Error initializing images...";
                }
                if (tweet.ntisasDeferred.status !== 'resolved') {
                    return false;
                }
                if (!tweet.ntisasImageUrls) {
                    GetImageLinks(tweet);
                    return false;
                }
            }
            return InitializePostsContainer(posts_data, image_urls);
        });
    }
    if (NTISAS.page === 'media') {
        let $media_results = GetMediaTweet(tweet_id).find('.ntisas-media-results');
        $media_results.text(post_ids.length);
        $media_results.css('background-color', 'green');
    }
}

function InitializeNoMatchesLinks(tweet_id) {
    UpdateMenuResults(tweet_id, NO_MATCH_LINK, false);
    if (NTISAS.page === 'media') {
        let $media_results = GetMediaTweet(tweet_id).find('.ntisas-media-results');
        $media_results.text('·');
        $media_results.css('background-color', 'grey');
    }
}

async function InitializeViewCount(tweet) {
    let printer = JSPLib.debug.getFunctionPrint('ToggleImageSize');
    let tweet_id = String($(tweet).data('tweet-id'));
    let views = await GetData('view-' + tweet_id, 'danbooru');
    if (views && views.value.count > 0) {
        let timeagostring = ((Date.now() - views.value.viewed) < VIEWCOUNT_RECENT_DURATION ? "recently" : JSPLib.utility.timeAgo(views.value.viewed));
        $('.ntisas-view-info', tweet).append(`<span title="${views.value.count} views">Viewed ${timeagostring}</span>`);
        $('.ntisas-view-info', tweet).show();
        $(tweet).addClass('ntisas-viewed');
    }
    if (!document.hidden && JSPLib.utility.isScrolledIntoView(tweet)) {
        printer.debuglogLevel("Viewable tweet:", tweet_id, JSPLib.utility.DEBUG);
        AddViewCount(tweet_id);
        $(tweet).attr('viewed', 'true');
    }
}

function InitializeProfileViewCount(views, data_key, selector, format) {
    let view_title = "";
    let view_time = "initial";
    if (views && views.value.count > 0) {
        let date_string = new Date(views.value.viewed).toLocaleDateString();
        view_title = `${date_string} : ${views.value.count} views`;
        view_time = ((Date.now() - views.value.viewed) < VIEWCOUNT_RECENT_DURATION ? "recently" : JSPLib.utility.timeAgo(views.value.viewed));
    }
    let display_text = JSPLib.utility.sprintf(format, view_time);
    $(selector).html(`<span title="${view_title}">${display_text}</span>`);
    if (!NTISAS.recorded_views.includes(data_key)) {
        let mapped_view = {
            count: (views ? views.value.count : 0) + 1,
            viewed: Date.now()
        };
        let data_expires = JSPLib.utility.getExpires(JSPLib.utility.one_year);
        SaveData(data_key, {value: mapped_view, expires: data_expires}, 'danbooru', false);
        NTISAS.recorded_views.push(data_key);
    }
}

function InitializeProfileTimeline() {
    let printer = JSPLib.debug.getFunctionPrint('ToggleImageSize');
    let $info = $('[href$="/photo"],[href^="/i/spaces"]');
    while ($info.find('[href$="/following"]').length === 0) {
        $info = $info.parent();
        if ($info.length === 0) {
            //The top of the document has been reached
            break;
        }
    }
    if ($info.length === 1) {
        let $children = $info.children();
        let name_line = $children.get(1);
        if ($('.ntisas-profile-section', name_line).length === 0) {
            let $name_line = $(name_line);
            $name_line.addClass('ntisas-timeline-profile-name');
            $name_line.children().first().append(PROFILE_TIMELINE_HTML);
        }
    } else {
        printer.debugwarn("Unable to find profile attachment point!", $info);
    }
}

function InitializeImageTweets($image_tweets) {
    let printer = JSPLib.debug.getFunctionPrint('InitializeImageTweets');
    var $process_tweets;
    if(IsPageType(STREAMING_PAGES)) {
        $process_tweets = $image_tweets;
    } else if(IsTweetPage()) {
        $process_tweets = $image_tweets.filter(`[data-tweet-id=${NTISAS.tweet_id}]`);
    } else {
        $process_tweets = [];
    }
    if ($process_tweets.length === 0) return;
    const uniqueid = NTISAS.uniqueid;
    const timername = `InitializeImageTweets-${uniqueid}`;
    JSPLib.debug.debugTime(timername);
    const promise_array = [];
    const tweet_ids = JSPLib.utility.arrayUnique(JSPLib.utility.getDOMAttributes($process_tweets, 'tweet-id', String));
    printer.debuglog(`[${uniqueid}]`, "Check Tweets:", tweet_ids);
    $process_tweets.each((_, tweet) => {
        const p = JSPLib.utility.createPromise();
        promise_array.push(p.promise);
        $('.ntisas-footer-section', tweet).append(NTISAS_TWEET_MENU);
        const $tweet = $(tweet);
        const media_type = $('[ntisas-media-type]', tweet).attr('ntisas-media-type');
        if (!['image', 'video', 'deferred'].includes(media_type)) return;
        JSPLib.utility.recheckTimer({
            check: () => ['image', 'video'].includes(media_type) ||
                       $('[ntisas-media-type=image], [ntisas-media-type=video]', tweet).length,
            exec: () => {
                Promise.all([
                    InitializeImageMenu($tweet),
                ]).then(() => {
                    p.resolve(null);
                });
            },
            fail: () => {
                p.reject(null);
            },
        }, TWITTER_DELAY, JSPLib.utility.one_second * 10);
    });
    Promise.all(promise_array).then(() => {
        JSPLib.debug.debugTimeEnd(timername);
    });
}

function InitializeTweetStats(filter1, filter2) {
    const getStatAverage = (obj, type) => {
        let type_array = JSPLib.utility.getObjectAttributes(obj, type);
        let adjusted_array = JSPLib.statistics.removeOutliers(type_array, 1);
        let average = JSPLib.statistics.average(adjusted_array);
        return JSPLib.utility.setPrecision(average, 2);
    };
    let filter_tweets = NTISAS.tweet_stats.filter((entry) => {
        let condition_1 = true, condition_2 = true;
        switch (filter1) {
            case 'retweet':
                condition_1 = entry.retweet;
                break;
            case 'tweet':
                condition_1 = !entry.retweet;
                // falls through
            case 'total':
            default:
                //do nothing
        }
        switch (filter2) {
            case 'image':
                condition_2 = entry.image;
                break;
            case 'video':
                condition_2 = entry.video;
                break;
            case 'text':
                condition_2 = !entry.image && !entry.video;
                // falls through
            case 'total':
            default:
                //do nothing
        }
        return condition_1 && condition_2;
    });
    if (filter_tweets.length === 0) {
        return false;
    }
    let total_tweets = filter_tweets.length;
    let retweets = filter_tweets.filter((entry) => entry.retweet).length;
    let image_tweets = filter_tweets.filter((entry) => entry.image).length;
    let video_tweets = filter_tweets.filter((entry) => entry.video).length;
    let text_tweets = filter_tweets.filter((entry) => (!entry.image && !entry.video)).length;
    let average_replies = getStatAverage(filter_tweets, 'replies');
    let average_retweets = getStatAverage(filter_tweets, 'retweets');
    let average_favorites = getStatAverage(filter_tweets, 'favorites');
    let table_html = JSPLib.utility.regexReplace(TWEET_STATISTICS, {
        TOTALTWEETS: total_tweets,
        RETWEETS: retweets,
        TWEETS: total_tweets - retweets,
        IMAGETWEETS: image_tweets,
        VIDEOTWEETS: video_tweets,
        TEXTTWEETS: text_tweets,
        AVERAGEREPLIES: average_replies,
        AVERAGERETWEETS: average_retweets,
        AVERAGEFAVORITES: average_favorites,
    });
    $('#ntisas-tweet-stats-table').html(table_html);
    let selected_metrics = JSPLib.utility.arrayUnique([filter1, filter2]);
    if (selected_metrics.length === 2 && selected_metrics.includes('total')) {
        selected_metrics.splice(selected_metrics.indexOf('total'), 1);
    }
    $('#ntisas-tweet-stats-table td').css('background-color', 'white');
    selected_metrics.forEach((metric) => {
        $(`#ntisas-tweet-stats-table td[data-key=${metric}]`).css('background-color', 'yellow');
    });
    return true;
}

//Queue functions

function QueueStorageRequest(type, key, value, database) {
    let queue_key = type + '-' + key + '-' + database;
    if (!CACHE_STORAGE_TYPES.includes(type) || !(queue_key in CACHED_STORAGE_REQUESTS)) {
        const request = {
            type,
            key,
            value,
            database,
            deferred: JSPLib.utility.createPromise(),
            error: (JSPLib.debug.debug_console ? new Error() : null),
        };
        if (CACHE_STORAGE_TYPES.includes(type)) {
            JSPLib.debug.recordTime(key, 'Storage-queue');
        }
        QUEUED_STORAGE_REQUESTS.push(request);
        CACHED_STORAGE_REQUESTS[queue_key] = request.deferred.promise;
        JSPLib.debug.debugExecute(() => {
            SAVED_STORAGE_REQUESTS.push(request);
        });
    }
    return CACHED_STORAGE_REQUESTS[queue_key];
}

function InvalidateCache(key, database) {
    CACHE_STORAGE_TYPES.forEach((type) => {
        let queue_key = type + '-' + key + '-' + database;
        delete CACHED_STORAGE_REQUESTS[queue_key];
    });
}

function FulfillStorageRequests(keylist, data_items, requests) {
    keylist.forEach((key) => {
        let data = (key in data_items ? data_items[key] : null);
        let request = requests.find((request) => (request.key === key));
        request.deferred.resolve(data);
        request.data = data;
        JSPLib.debug.recordTimeEnd(key, 'Storage-queue');
    });
}

function IntervalStorageHandler() {
    let printer = JSPLib.debug.getFunctionPrint('IntervalStorageHandler');
    if (QUEUED_STORAGE_REQUESTS.length === 0) {
        return;
    }
    printer.debuglogLevel(() => ["Queued requests:", JSPLib.utility.dataCopy(QUEUED_STORAGE_REQUESTS)], JSPLib.debug.VERBOSE);
    for (let database in STORAGE_DATABASES) {
        let requests = QUEUED_STORAGE_REQUESTS.filter((request) => (request.database === database));
        let save_requests = requests.filter((request) => (request.type === 'save'));
        if (save_requests.length) {
            printer.debuglogLevel("Save requests:", save_requests, JSPLib.debug.DEBUG);
            let save_data = Object.assign(...save_requests.map((request) => ({[request.key]: request.value})));
            JSPLib.storage.batchSaveData(save_data, {database: STORAGE_DATABASES[database]}).then(() => {
                save_requests.forEach((request) => {
                    request.deferred.resolve(null);
                    request.endtime = performance.now();
                });
            });
        }
        let remove_requests = requests.filter((request) => (request.type === 'remove'));
        if (remove_requests.length) {
            printer.debuglogLevel("Remove requests:", remove_requests, JSPLib.debug.DEBUG);
            let remove_keys = remove_requests.map((request) => request.key);
            JSPLib.storage.batchRemoveData(remove_keys, {database: STORAGE_DATABASES[database]}).then(() => {
                remove_requests.forEach((request) => {
                    request.deferred.resolve(null);
                    request.endtime = performance.now();
                });
            });
        }
        let check_requests = requests.filter((request) => (request.type === 'check'));
        if (check_requests.length) {
            printer.debuglogLevel("Check requests:", check_requests, JSPLib.debug.DEBUG);
            let check_keys = check_requests.map((request) => request.key);
            JSPLib.storage.batchCheckLocalDB(check_keys, ValidateExpiration, {database: STORAGE_DATABASES[database]}).then((check_data) => {
                FulfillStorageRequests(check_keys, check_data, check_requests);
            });
        }
        let noncheck_requests = requests.filter((request) => (request.type === 'get'));
        if (noncheck_requests.length) {
            printer.debuglogLevel("Noncheck requests:", noncheck_requests, JSPLib.debug.DEBUG);
            let noncheck_keys = noncheck_requests.map((request) => request.key);
            JSPLib.storage.batchRetrieveData(noncheck_keys, {database: STORAGE_DATABASES[database]}).then((noncheck_data) => {
                FulfillStorageRequests(noncheck_keys, noncheck_data, noncheck_requests);
            });
        }
    }
    QUEUED_STORAGE_REQUESTS.length = 0;
}

function QueueNetworkRequest (type, item) {
    const request_key = type + ',' + item.toString();
    const request = {
        type,
        item,
        request_key,
        deferred: JSPLib.utility.createPromise(),
        error: (JSPLib.debug.debug_console ? new Error() : null),
    };
    JSPLib.debug.recordTime(request_key, 'Network-queue');
    QUEUED_NETWORK_REQUESTS.push(request);
    JSPLib.debug.debugExecute(() => {
        SAVED_NETWORK_REQUESTS.push(request);
    });
    return request.deferred.promise;
}

function IntervalNetworkHandler () {
    if (QUEUED_NETWORK_REQUESTS.length === 0) {
        return;
    }
    for (let type of Object.keys(NETWORK_REQUEST_DICT)) {
        const requests = QUEUED_NETWORK_REQUESTS.filter((request) => (request.type === type));
        if (requests.length > 0) {
            const items = requests.map((request) => request.item).flat();
            const params = NETWORK_REQUEST_DICT[type].params(items);
            const data_key = NETWORK_REQUEST_DICT[type].data_key;
            JSPLib.danbooru.submitRequest(type, params, {default_val: [], domain: NTISAS.domain}).then((data_items) => {
                for (let i = 0; i < requests.length; i++) {
                    let request = requests[i];
                    let request_data = data_items.filter((data) => request.item.includes(data[data_key]));
                    request.deferred.resolve(request_data);
                    request.data = request_data;
                    JSPLib.debug.recordTimeEnd(request.request_key, 'Network-queue');
                }
            });
        }
    }
    QUEUED_NETWORK_REQUESTS.length = 0;
}

function QueueTimelineRequest(tweet_id, account) {
    QueueTimelineRequest.memoized ??= {};
    QueueTimelineRequest.memoized[account] ??= {};
    if (!QueueTimelineRequest.memoized[account][tweet_id]) {
        const request = {
            tweet_id,
            account,
            deferred: JSPLib.utility.createPromise(),
        };
        TIMELINE_REQUESTS.push(request);
        setTimeout(() => {TimelineHandler();}, 1);
        QueueTimelineRequest.memoized[account][tweet_id] = request.deferred.promise;
    }
    return QueueTimelineRequest.memoized[account][tweet_id];
}

async function TimelineHandler() {
    if (TimelineHandler.is_busy) return;
    const getLowestRequestedTweetID = function (account) {
        let account_requests = TIMELINE_REQUESTS.filter((request) => request.account === account);
        let tweet_ids = account_requests.map((request) => BigInt(request.tweet_id));
        return JSPLib.utility.bigIntMin(...tweet_ids);
    };
    TimelineHandler.errors ??= 0;
    TimelineHandler.is_busy = true;
    let accounts = JSPLib.utility.arrayUnique(TIMELINE_REQUESTS.map((request) => request.account));
    for (let i = 0; i < accounts.length; i++) {
        let account = accounts[i];
        if (!TIMELINE_VALS.user_ids[account]) {
            TIMELINE_VALS.user_ids[account] = await GetUserRestID(account);
        }
        if (!JSPLib.utility.isDigit(TIMELINE_VALS.user_ids[account])) {
            delete TIMELINE_VALS.user_ids[account];
            TimelineHandler.errors++;
            continue;
        }
        TIMELINE_VALS.cursor[account] ??= null;
        TIMELINE_VALS.lowest_available_tweet[account] ??= Infinity;
        let user_id = TIMELINE_VALS.user_ids[account];
        let cursor = TIMELINE_VALS.cursor[account];
        let lowest_available_id = TIMELINE_VALS.lowest_available_tweet[account];
        let lowest_requested_id = getLowestRequestedTweetID(account);
        while (lowest_requested_id < lowest_available_id) {
            let tweet_data = await GetMediaTimelineGQL(user_id, cursor);
            cursor = tweet_data.cursors.bottom;
            if (Object.keys(tweet_data.tweets).length === 0) {
                JSPLib.debug.debugwarn("TimelineHandler - No found tweets:", tweet_data);
                return;
            }
            TIMELINE_VALS.api_data = Object.assign(TIMELINE_VALS.api_data, tweet_data.tweets);
            let tweet_ids = Object.keys(tweet_data.tweets).map((tweet_id) => BigInt(tweet_id));
            lowest_available_id = JSPLib.utility.bigIntMin(...tweet_ids);
            lowest_requested_id = getLowestRequestedTweetID(account);
        }
        TIMELINE_VALS.cursor[account] = cursor;
        TIMELINE_VALS.lowest_available_tweet[account] = lowest_available_id;
        let account_requests = TIMELINE_REQUESTS.filter((request) => request.account === account);
        let remaining_requests = TIMELINE_REQUESTS.filter((request) => request.account !== account);
        account_requests.forEach((request) => {
            if (TIMELINE_VALS.api_data[request.tweet_id]) {
                request.deferred.resolve(TIMELINE_VALS.api_data[request.tweet_id]);
            } else {
                request.deferred.resolve(null);
            }
        });
        TIMELINE_REQUESTS.splice(0, TIMELINE_REQUESTS.length, ...remaining_requests);
    }
    TimelineHandler.is_busy = false;
    //More requests may have arrived since processing finished, so ensure the function gets called again
    if (TIMELINE_REQUESTS.length && TimelineHandler.errors < 3) {
        setTimeout(() => {TimelineHandler();}, JSPLib.utility.one_second);
    }
}

//Network functions

async function CheckURL(tweet_id, screen_name) {
    let normal_url = `https://*.com/${screen_name}/status/${tweet_id}`;
    let wildcard_url = `https://*.com/*/status/${tweet_id}`;
    let check_url = (NTISAS.URL_wildcards_enabled ? wildcard_url : normal_url);
    let params = {
        tags: 'status:any source:' + check_url,
        only: POST_FIELDS,
        expires_in: '300s',
    };
    let data = await JSPLib.danbooru.submitRequest('posts', params, {default_val: [], domain: NTISAS.domain, notify: true});
    let post_ids = [];
    let twitter_posts = data.filter((post) => TWEET_REGEX.test(post.source));
    if (twitter_posts.length > 0) {
        let mapped_posts = data.map(MapPost);
        SavePosts(mapped_posts);
        SavePostUsers(mapped_posts);
        post_ids = JSPLib.utility.arrayUnique(JSPLib.utility.getObjectAttributes(twitter_posts, 'id'));
    }
    return post_ids;
}

async function CheckSimilar(tweet_id, image_urls) {
    if (NTISAS.search_running.has(tweet_id)) return;
    NTISAS.search_running.add(tweet_id);
    let check_func = (NTISAS.similar_source === 'danbooru' ? CheckIQDB : CheckSauce);
    UpdateMenuResults(tweet_id, 'loading...', true);
    let similar_results = await check_func(image_urls);
    if (similar_results.length > 0) {
        let all_results = JSPLib.utility.getObjectAttributes(similar_results, 'results').flat();
        let all_posts = JSPLib.utility.getObjectAttributes(all_results, 'post');
        let unique_posts = RemoveDuplicates(all_posts, 'id');
        let post_ids = JSPLib.utility.getObjectAttributes(unique_posts, 'id');
        if (IsQuerySettingEnabled('auto_save', NTISAS.similar_source)) {
            let save_ids = SaveTweetData(tweet_id, post_ids);
            UpdatePostIDsLink(tweet_id, save_ids);
        } else if (IsQuerySettingEnabled('confirm_save', NTISAS.similar_source)) {
            InitializeConfirmDialog(tweet_id, similar_results, unique_posts);
        } else {
            UpdatePostIDsLink(tweet_id, post_ids);
            NTISAS.no_confirm.add(tweet_id);
        }
    } else if (IsQuerySettingEnabled('confirm_save', NTISAS.similar_source)) {
        let post_ids = GetSessionTweetData(tweet_id);
        UpdatePostIDsLink(tweet_id, post_ids);
    } else {
        UpdatePostIDsLink(tweet_id, []);
    }
    // eslint-disable-next-line
    NTISAS.search_running.delete(tweet_id);
}

async function CheckIQDB(image_urls) {
    let promise_array = image_urls.map((image_url) => {
        let params = {
            url: image_url,
            similarity: NTISAS.similarity_cutoff,
            limit: NTISAS.results_returned,
            expires_in: '300s',
        };
        return JSPLib.danbooru.submitRequest('iqdb_queries', params, {default_val: [], domain: NTISAS.domain, notify: true});
    });
    let iqdb_results = await Promise.all(promise_array);
    let flat_data = iqdb_results.flat();
    let similar_results = [];
    if (flat_data.length) {
        let post_data = JSPLib.utility.getObjectAttributes(flat_data, 'post');
        let unique_posts = RemoveDuplicates(post_data, 'id');
        let mapped_posts = unique_posts.map(MapPost);
        let uploader_ids = JSPLib.utility.arrayUnique(JSPLib.utility.getObjectAttributes(mapped_posts, 'uploaderid'));
        let [user_data, network_users] = await GetItems(uploader_ids, 'user', 'users');
        user_data = user_data.concat(network_users);
        mapped_posts.forEach((post) => {
            let user = user_data.find((user) => (user.id === post.uploaderid));
            post.uploadername = user.name;
        });
        SavePosts(mapped_posts);
        SaveUsers(network_users);
        for (let i = 0; i < iqdb_results.length; i++) {
            let image_results = iqdb_results[i];
            let valid_results = image_results.filter((result) => (result.post !== undefined && result.post.id !== undefined));
            let filter_results = valid_results.filter((result) => (parseFloat(result.score) >= NTISAS.similarity_cutoff));
            let sorted_results = filter_results.sort((resulta, resultb) => (resultb.score - resulta.score)).slice(0, NTISAS.results_returned);
            let mapped_results = sorted_results.map((result) => {
                let score = result.score;
                let post = mapped_posts.find((post) => (post.id === result.post.id));
                return {score, post};
            });
            similar_results.push({image_url: image_urls[i], results: mapped_results});
        }
    }
    return similar_results;
}

async function CheckSauce(image_urls) {
    if (!NTISAS.SauceNAO_API_key) {
        JSPLib.notice.error("<b>Error!</b> Must set SauceNAO API key in user settings.");
        return [];
    }
    let promise_array = image_urls.map((image_url) => JSPLib.saucenao.getSauce(image_url, JSPLib.saucenao.getDBIndex('danbooru'), NTISAS.results_returned));
    let all_data = await Promise.all(promise_array);
    let good_data = all_data.filter((data) => JSPLib.saucenao.checkSauce(data));
    let combined_data = JSPLib.utility.getObjectAttributes(good_data, 'results');
    let flat_data = combined_data.flat();
    let filtered_data = flat_data.filter((result) => (parseFloat(result.header.similarity) >= NTISAS.similarity_cutoff));
    let similar_results = [];
    if (filtered_data.length) {
        let danbooru_ids = JSPLib.utility.arrayUnique(JSPLib.utility.getNestedObjectAttributes(filtered_data, ['data', 'danbooru_id']));
        var posts_data = await GetPosts(danbooru_ids);
        for (let i = 0; i < combined_data.length; i++) {
            let image_result = combined_data[i];
            let filter_results = image_result.filter((result) => (parseFloat(result.header.similarity) >= NTISAS.similarity_cutoff));
            let sorted_results = filter_results.sort((resulta, resultb) => (resultb.score - resulta.score)).slice(0, NTISAS.results_returned);
            let mapped_results = sorted_results.map((result) => {
                let score = parseFloat(result.header.similarity);
                let post = posts_data.find((post) => (post.id === result.data.danbooru_id));
                return {score, post};
            });
            similar_results.push({image_url: image_urls[i], results: mapped_results});
        }
    }
    let combined_headers = JSPLib.utility.getObjectAttributes(good_data, 'header');
    let flat_headers = combined_headers.flat();
    let sauce_remaining = flat_headers.reduce((total, header) => Math.min(total, header.long_remaining), Infinity);
    $('#ntisas-available-sauce').text(sauce_remaining);
    JSPLib.storage.saveData('ntisas-available-sauce', {value: sauce_remaining, expires: JSPLib.utility.getExpires(SAUCE_EXPIRES)});
    return similar_results;
}

function DownloadAllTweet($tweet) {
    let {tweet_id, screen_name} = GetTweetInfo($tweet);
    if (NTISAS.download_running.has(tweet_id)) return;
    NTISAS.download_running.add(tweet_id);
    $tweet.find('.ntisas-menu-download').addClass('ntisas-menu-active');
    GetMediaLinksData($tweet).then(async ({image_urls, videos}) => {
        var media_urls;
        if (videos.some((is_video) => is_video)) {
            let tweet_data = await GetTweetData(tweet_id);
            media_urls = image_urls.map((image_url, i) => {
                let is_video = videos[i];
                return (is_video ? 'https://video.twimg.com/' + tweet_data[i].partial_video : image_url + ':orig');
            });
        } else {
            media_urls = image_urls;
        }
        let promise_array = media_urls.map((media_url, i) => DownloadMediaFile(media_url, tweet_id, screen_name, i));
        Promise.all(promise_array).then(() => {
            $tweet.find('.ntisas-menu-download').removeClass('ntisas-menu-active');
            // eslint-disable-next-line
            NTISAS.download_running.delete(tweet_id);
        });
    });
}

function DownloadMediaFile(file_url, tweet_id, screen_name, order) {
    let printer = JSPLib.debug.getFunctionPrint('DownloadMediaFile');
    const mime_types = {
        jpg: 'image/jpeg',
        png: 'image/png',
        mp4: 'video/mp4',
    };
    let p = JSPLib.utility.createPromise();
    let {name, extension} = GetFileURLInfo(file_url);
    let date_string = GetDateString(Date.now());
    let time_string = GetTimeString(Date.now());
    let media_type = (extension === 'mp4' ? 'video' : 'image');
    let download_name = JSPLib.utility.regexReplace(NTISAS.filename_prefix_format, {
        DATE: date_string,
        TIME: time_string,
        TWEETID: tweet_id,
        USERACCOUNT: screen_name,
        ORDER: media_type + (order + 1),
        IMG: name,
    }) + '.' + extension;
    file_url += (extension !== 'mp4' ? ':orig' : "");
    let mime_type = mime_types[extension];
    if (mime_type) {
        printer.debuglog("Saving", file_url, "as", download_name);
        JSPLib.network.getData(file_url, {ajax_options: {timeout: 0}}).then(
            //Success
            (blob) => {
                let image_blob = blob.slice(0, blob.size, mime_type);
                saveAs(image_blob, download_name);
                printer.debuglog("Saved", extension, "file as", mime_type, "with size of", blob.size);
                p.resolve(true);
            },
            //Failure
            (e) => {
                let error_text = 'Check the debug console.';
                if (Number.isInteger(e)) {
                    error_text = 'HTTP ' + e;
                } else {
                    JSPLib.debug.debugerror("DownloadImage error:", e);
                }
                JSPLib.notice.error(`Error downloading image: ${error_text}`);
            }
        ).always(() => {
            p.resolve(null);
        });
    } else {
        JSPLib.notice.error("Unknown mime type for extension:", extension);
    }
    return p.promise;
}

function TwitterGraphQLRequest(endpoint, variables, features) {
    let addons = {};
    if (variables) {
        addons.variables = JSON.stringify(variables);
    }
    if (features) {
        addons.features = JSON.stringify(features);
    }
    let url_addons = $.param(addons);
    let csrf_token = JSPLib.utility.readCookie('ct0');
    const ajax_options = {
        processData: false,
        beforeSend (request) {
            request.setRequestHeader('authorization', 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA');
            request.setRequestHeader('x-csrf-token', csrf_token);
        },
    };
    return JSPLib.network.get(`https://${location.host}/i/api/graphql/${endpoint}?${url_addons}`, {ajax_options});
}

function GetTweetGQL(tweet_id) {
    let data = Object.assign({
        focalTweetId: tweet_id,
    }, TWEET_GRAPHQL_PARAMS);
    return TwitterGraphQLRequest('L1DeQfPt7n3LtTvrBqkJ2g/TweetDetail', data).then((data) => {
        let api_data = CheckGraphqlData(data);
        return api_data.tweets[tweet_id] ?? null;
    });
}

function GetTweetGQL_alt(tweet_id) {
    let data = Object.assign({
        tweetId: tweet_id,
    }, TWEET_RESTID_GQL_PARAMS);
    return TwitterGraphQLRequest('MWY3AO9_I3rcP_L2A4FR4A/TweetResultByRestId', data, TWEET_RESTID_GQL_FEATURES, null).then((data) => {
        let api_data = CheckGraphqlData(data);
        return api_data.tweets[tweet_id] ?? null;
    });
}

function GetTweetsGQL(tweet_ids) {
    let data = Object.assign({tweetIds: tweet_ids}, TWEET_RESTIDS_GQL_DATA);
    return TwitterGraphQLRequest('qvJxlsU8dkDfEh59g_RNXg/TweetResultsByRestIds', data, TWEET_RESTIDS_GQL_FEATURES, TWEET_RESTIDS_GQL_FIELDS).then((data) => {
        let api_data = CheckGraphqlData(data);
        return Object.values(api_data.tweets);
    });
}

async function GetMediaTweetsGQL(tweet_ids, account) {
    let network_data = await Promise.all(tweet_ids.map((tweet_id) => QueueTimelineRequest(tweet_id, account)));
    tweet_ids.forEach((tweet_id, i) => {
        if (JSPLib.validate.isHash(network_data[i])) {
            network_data[i].id_str = tweet_id;
        }
    });
    return network_data.filter((data) => JSPLib.validate.isHash(data));
}

function GetUserIDGQL(screen_name) {
    let data = {
        screen_name,
        'withHighlightedLabel': false,
    };
    return TwitterGraphQLRequest('Vf8si2dfZ1zmah8ePYPjDQ/UserByScreenNameWithoutResults', data).then((data) => {
        let api_data = CheckGraphqlData(data);
        for (let user_id in api_data.users) {
            if (api_data.users[user_id].screen_name === screen_name) {
                return api_data.users[user_id];
            }
        }
        return null;
    });
}

function GetMediaTimelineGQL(user_id, cursor) {
    let data = Object.assign({userId: user_id}, MEDIA_TIMELINE_DATA);
    if (JSPLib.validate.isString(cursor)) {
        data.cursor = cursor;
    }
    return TwitterGraphQLRequest('_vFDgkWOKL_U64Y2VmnvJw/UserMedia', data, MEDIA_TIMELINE_FEATURES).then((data) => CheckGraphqlData(data));
}

//Data network functions

async function GetItems(item_ids, storage_key, network_key) {
    let storage_promises = item_ids.map((id) => GetData(storage_key + '-' + id, 'danbooru'));
    let storage_data = await Promise.all(storage_promises);
    storage_data = storage_data.filter((data) => (data !== null));
    storage_data = JSPLib.utility.getObjectAttributes(storage_data, 'value');
    let found_ids = JSPLib.utility.getObjectAttributes(storage_data, 'id');
    let missing_ids = JSPLib.utility.arrayDifference(item_ids, found_ids);
    let network_data = [];
    if (missing_ids.length) {
        network_data = await QueueNetworkRequest(network_key, missing_ids);
    }
    return [storage_data, network_data];
}

async function GetPosts(post_ids) {
    let [posts_data, network_posts] = await GetItems(post_ids, 'post', 'posts');
    if (network_posts.length) {
        let mapped_posts = network_posts.map(MapPost);
        SavePosts(mapped_posts);
        SavePostUsers(mapped_posts);
        posts_data = posts_data.concat(mapped_posts);
    }
    posts_data.sort((a, b) => (post_ids.indexOf(a.id) - post_ids.indexOf(b.id)));
    return posts_data;
}

async function GetImageData(image_url) {
    GetImageData.memoized ??= {};
    if (!(image_url in GetImageData.memoized)) {
        let storage_key = 'twimg-' + image_url;
        let storage_data = await JSPLib.storage.checkLocalDB(storage_key, JSPLib.utility.one_day);
        if (!storage_data) {
            let size_promise = JSPLib.network.getDataSize(image_url);
            let dimensions_promise = JSPLib.utility.getImageDimensions(image_url);
            let [size, dimensions] = await Promise.all([size_promise, dimensions_promise]);
            GetImageData.memoized[image_url] = Object.assign(dimensions, {size});
            JSPLib.storage.saveData(storage_key, {value: GetImageData.memoized[image_url], expires: JSPLib.utility.getExpires(JSPLib.utility.one_day)});
        } else {
            GetImageData.memoized[image_url] = storage_data.value;
        }
    }
    return GetImageData.memoized[image_url];
}

function GetTweetData(tweet_id) {
    GetTweetData.memoized ??= {};
    if (!GetTweetData.memoized[tweet_id]) {
        let p = JSPLib.utility.createPromise();
        GetTweetData.memoized[tweet_id] = p.promise;
        let data_key = 'tweet-' + tweet_id;
        GetData(data_key, 'danbooru').then(async (storage_data) => {
            if (!storage_data) {
                var network_data;
                try {
                    network_data = await GetTweetGQL(tweet_id);
                } catch (response) {
                    HandleTwitterErrorResponse(response, false);
                }
                if (!network_data) {
                    try {
                        network_data = await GetTweetGQL_alt(tweet_id);
                    } catch (response) {
                        HandleTwitterErrorResponse(response, true);
                    }
                }
                if (JSPLib.validate.isHash(network_data)) {
                    let value = network_data.extended_entities.media.map((media) => {
                        let image_info = GetImageURLInfo(media.media_url_https);
                        let partial_image = image_info.path + '/' + image_info.key + '.' + image_info.ext;
                        let partial_video = (media.video_info ? GetMaxVideoURL(media, 0) : null);
                        let partial_sample = (media.video_info ? GetMaxVideoURL(media, 1) : null);
                        return {partial_image, partial_video, partial_sample};
                    });
                    let expires = JSPLib.utility.getExpires(TWEET_EXPIRES);
                    SaveData(data_key, {value, expires}, 'danbooru');
                    p.resolve(value);
                } else {
                    p.reject(null);
                }
            } else {
                p.resolve(storage_data.value);
            }
        });
    }
    return GetTweetData.memoized[tweet_id];
}

function GetTweetsData(tweet_ids, account) {
    GetTweetsData.memoized ??= {};
    const promise_dict = {};
    let unchecked_tweet_ids = JSPLib.utility.arrayDifference(tweet_ids, Object.keys(GetTweetsData.memoized));
    if (unchecked_tweet_ids.length) {
        unchecked_tweet_ids.forEach((tweet_id) => {
            promise_dict[tweet_id] = JSPLib.utility.createPromise();
            GetTweetsData.memoized[tweet_id] = promise_dict[tweet_id].promise;
        });
        let promise_array = unchecked_tweet_ids.map((tweet_id) => GetData('tweet-' + tweet_id, 'danbooru'));
        Promise.all(promise_array).then(async (storage_data) => {
            let storage_tweet_ids = [];
            storage_data.forEach((data, i) => {
                if (data) {
                    let tweet_id = unchecked_tweet_ids[i];
                    promise_dict[tweet_id].resolve(data.value);
                    storage_tweet_ids.push(tweet_id);
                }
            });
            let query_tweet_ids = JSPLib.utility.arrayDifference(unchecked_tweet_ids, storage_tweet_ids);
            if (query_tweet_ids.length) {
                var network_data;
                var tweet_func = (NTISAS.use_media_timeline_endpoint ? GetMediaTweetsGQL : GetTweetsGQL);
                try {
                    network_data = await tweet_func(query_tweet_ids, account);
                } catch (response) {
                    HandleTwitterErrorResponse(response, false);
                }
                if (Array.isArray(network_data)) {
                    let network_tweet_ids = [];
                    let expires = JSPLib.utility.getExpires(TWEET_EXPIRES);
                    network_data.forEach((tweet_data) => {
                        let tweet_id = tweet_data.id_str;
                        let value = tweet_data.extended_entities.media.map((media) => {
                            let image_info = GetImageURLInfo(media.media_url_https);
                            let partial_image = image_info.path + '/' + image_info.key + '.' + image_info.ext;
                            let partial_video = (media.video_info ? GetMaxVideoURL(media, 0) : null);
                            let partial_sample = (media.video_info ? GetMaxVideoURL(media, 1) : null);
                            return {partial_image, partial_video, partial_sample};
                        });
                        SaveData('tweet-' + tweet_id, {value, expires}, 'danbooru');
                        promise_dict[tweet_id].resolve(value);
                        network_tweet_ids.push(tweet_id);
                    });
                    let missing_tweet_ids = JSPLib.utility.arrayDifference(query_tweet_ids, network_tweet_ids);
                    expires = JSPLib.utility.getExpires(JSPLib.utility.one_day);
                    missing_tweet_ids.forEach((tweet_id) => {
                        SaveData('tweet-' + tweet_id, {value: [], expires}, 'danbooru');
                        promise_dict[tweet_id].resolve([]);
                    });
                } else {
                    for (let tweet_id in query_tweet_ids) {
                        promise_dict[tweet_id].resolve([]);
                    }
                }
            }
        });
    }
    let p = JSPLib.utility.createPromise();
    Promise.all(tweet_ids.map((tweet_id) => GetTweetsData.memoized[tweet_id])).then((all_data) => {
        let tweet_dict = {};
        for (let i = 0; i < tweet_ids.length; i++) {
            let tweet_id = tweet_ids[i];
            tweet_dict[tweet_id] = all_data[i];
        }
        p.resolve(tweet_dict);
    });
    return p.promise;
}

function GetUserRestID(account) {
    GetUserRestID.memoized ??= {};
    if (!GetUserRestID.memoized[account]) {
        let p = JSPLib.utility.createPromise();
        GetUserRestID.memoized[account] = p.promise;
        if (NTISAS.account === account && JSPLib.validate.isString(NTISAS.user_id)) {
            p.resolve(NTISAS.user_id);
        } else {
            GetData('twuser-' + account, 'danbooru').then((storage_data) => {
                if (!storage_data) {
                    GetUserIDGQL(account).then((twitter_data) => {
                        if (JSPLib.validate.isHash(twitter_data)) {
                            let expires = JSPLib.utility.getExpires(TWUSER_EXPIRES);
                            let value = twitter_data.id_str;
                            SaveData('twuser-' + account, {value, expires}, 'danbooru');
                            p.resolve(value);
                        } else {
                            p.resolve(null);
                        }
                    });
                } else {
                    p.resolve(storage_data.value);
                }
            });
        }
    }
    return GetUserRestID.memoized[account];
}

//Twitter API process functions

function CheckGraphqlData(data, savedata) {
    savedata ??= {tweets: {}, users: {}, cursors: {}};
    for (let i in data) {
        if (i === "quoted_status_result") continue;
        if (typeof data[i] === "object" && data[i] !== null) {
            if (('legacy' in data[i]) && ('rest_id' in data[i])) {
                if ((i === "tweet" || i === "user")) {
                    let key = i + 's';
                    let item = data[i].legacy;
                    item.id_str = data[i].rest_id;
                    savedata[key][item.id_str] = item;
                } else if ((i === 'result') && (data[i]?.__typename === 'Tweet' || data[i]?.__typename === 'User')) {
                    let key = data[i].__typename.toLowerCase() + 's';
                    let item = data[i].legacy;
                    item.id_str = data[i].rest_id;
                    savedata[key][item.id_str] = item;
                }
            }
            CheckGraphqlData(data[i], savedata);
        } else if (data[i] === "TimelineTimelineCursor") {
            let cursor_key = data.cursorType.toLowerCase();
            savedata.cursors[cursor_key] = data.value;
        }
    }
    return savedata;
}

function HandleTwitterErrorResponse(response, notice) {
    var message, html;
    if (JSPLib.validate.isHash(response.responseJSON)) {
        message = JSON.stringify(response.responseJSON, null, 2);
        html = '<pre>' + message + '</pre>';
    } else if (typeof response.responseText === 'string') {
        message = html = response.responseText;
    } else {
        message = html = 'Unknown error';
    }
    let error_code = Number.isInteger(response.status) ? response.status : 'unknown';
    if (notice) {
        JSPLib.notice.error(`HTTP ${error_code}:<br>${html}`);
    } else {
        console.error(`HTTP ${error_code}:\n${message}`);
    }
}

function GetMaxVideoURL(media_data, index) {
    let variants = media_data.video_info.variants.filter((variant) => Number.isInteger(variant.bitrate));
    if (index >= variants.length) {
        return null;
    }
    let sorted_variants = variants.sort((a, b) => b.bitrate - a.bitrate);
    return new URL(sorted_variants[index].url).pathname.slice(1);
}

//Storage functions

function GetData(key, database) {
    let type = (database === 'danbooru' ? 'check' : 'get');
    if (!(key in NTISAS.storage_data[database])) {
        NTISAS.storage_data[database][key] = QueueStorageRequest(type, key, null, database);
    }
    return NTISAS.storage_data[database][key];
}

function SaveData(key, value, database, invalidate = true) {
    if (invalidate) {
        InvalidateCache(key, database);
        NTISAS.storage_data[database][key] = Promise.resolve(value);
    } else {
        NTISAS.storage_data[database][key] ??= Promise.resolve(value);
    }
    return QueueStorageRequest('save', key, value, database);
}

function RemoveData(key, database) {
    InvalidateCache(key, database);
    delete NTISAS.storage_data[database][key];
    return QueueStorageRequest('remove', key, null, database);
}

function SavePosts(mapped_posts) {
    mapped_posts.forEach((mapped_post) => {
        let expires_duration = PostExpiration(mapped_post.created);
        let data_expires = JSPLib.utility.getExpires(expires_duration);
        SaveData('post-' + mapped_post.id, {value: mapped_post, expires: data_expires}, 'danbooru');
    });
}

function SaveUsers(mapped_users) {
    mapped_users.forEach((mapped_user) => {
        let data_expires = JSPLib.utility.getExpires(USER_EXPIRES);
        SaveData('user-' + mapped_user.id, {value: mapped_user, expires: data_expires}, 'danbooru');
    });
}

function SavePostUsers(mapped_posts) {
    let all_users = mapped_posts.map((post) => ({id: post.uploaderid, name: post.uploadername}));
    let unique_users = RemoveDuplicates(all_users, 'id');
    SaveUsers(unique_users);
}

function SaveTweetData(tweet_id, post_ids) {
    let existing_ids = GetSessionTweetData(tweet_id);
    let merge_ids = JSPLib.utility.arrayUnion(existing_ids, post_ids);
    if (merge_ids.length > existing_ids.length) {
        SaveData('tweet-' + tweet_id, merge_ids, 'twitter');
    }
    return merge_ids;
}

function GetSessionTweetData(tweet_id) {
    return JSPLib.storage.getIndexedSessionData('tweet-' + tweet_id, {default_val: [], database: STORAGE_DATABASES.twitter});
}

function WasOverflow() {
    return JSPLib.storage.checkLocalData('ntisas-overflow', {default_val: false});
}

//Database functions

async function SaveDatabase(database, counter_selector) {
    let printer = JSPLib.debug.getFunctionPrint('SaveDatabase');
    var database_keys = Object.keys(database);
    let batches = Math.floor(database_keys.length / 2000);
    printer.debuglog("Database size:", database_keys.length);
    var payload = {};
    var i;
    for (i = 0; i < database_keys.length; i++) {
        let key = database_keys[i];
        let value = database[key];
        //Support keys both with and without a tweet- prefix
        let match = key.match(/^tweet-(\d+)$/);
        if (match) {
            key = match[1];
        }
        payload['tweet-' + key] = value;
        if (i !== 0 && (i % 2000 === 0)) {
            $(counter_selector).html(--batches);
            printer.debuglog("Saving batch #", batches);
            JSPLib.debug.debugTime('database-save-' + batches);
            await JSPLib.storage.twitterstorage.setItems(payload);
            JSPLib.debug.debugTimeEnd('database-save-' + batches);
            //Give some control back to the user
            await JSPLib.utility.sleep(500);
            payload = {};
        }
    }
    if (i % 2000 > 0) {
        // Final save
        $(counter_selector).html('Final');
        printer.debuglog("Saving batch #", batches);
        JSPLib.debug.debugTime('database-save-' + batches);
        await JSPLib.storage.twitterstorage.setItems(payload);
        JSPLib.debug.debugTimeEnd('database-save-' + batches);
    }
}

async function InitializeSaveDatabaseBatches() {
    let import_pending = JSPLib.storage.getLocalData('ntisas-import-pending');
    if (!import_pending) return;
    let keylist = await JSPLib.storage.batchstorage.keys();
    let batch_keys = keylist.filter((key) => /database-batch-\d+/.exec(key));
    if (batch_keys.length > 0) {
        let batch_indices = batch_keys.map((key) => Number(/\d+$/.exec(key)[0]));
        JSPLib.storage.setLocalData('ntisas-database-batchindex', Math.min(...batch_indices));
        JSPLib.storage.setLocalData('ntisas-database-numbatches', Math.max(...batch_indices) + 1);
        NTISAS.database_interval = setInterval(SaveDatabaseBatch, DATABASE_BATCHSAVE_INTERVAL);
    } else {
        JSPLib.storage.setLocalData('ntisas-import-pending', false);
    }
}

function SaveDatabaseBatch() {
    let num_batches = JSPLib.storage.getLocalData('ntisas-database-numbatches');
    JSPLib.storage.invalidateLocalData('ntisas-database-batchindex');
    let batch_index = JSPLib.storage.getLocalData('ntisas-database-batchindex');
    if (Number.isInteger(num_batches) && Number.isInteger(batch_index) && num_batches > batch_index) {
        let display_index = batch_index + 1;
        JSPLib.debug.debuglog(`SaveDatabaseBatch: batch #${display_index} of ${num_batches}`);
        $('#ntisas-database-link').html(`<span id="ntisas-batch-index" title="Total batches: ${num_batches}">Saving&thinsp;(&thinsp;${display_index}&thinsp;)</span>`);
        if (!SaveDatabaseBatch.is_help_installed) {
            $('#ntisas-database-help').html(RenderHelp(DATABASE_IS_INSTALLING_HELP));
            SaveDatabaseBatch.is_help_installed = true;
        }
        JSPLib.storage.setLocalData('ntisas-database-batchindex', batch_index + 1);
        JSPLib.storage.batchstorage.getItem('database-batch-' + batch_index).then((database_batch) => {
            if (JSPLib.validate.isHash(database_batch)) {
                (async () => {
                    JSPLib.debug.debugTime('SaveDatabaseBatch-' + display_index);
                    let keylist = Object.keys(database_batch).map((key) => 'tweet-' + key);
                    let payload = await JSPLib.storage.batchRetrieveData(keylist, {database: JSPLib.storage.twitterstorage});
                    for (let tweet_id in database_batch) {
                        if (Array.isArray(payload['tweet-' + tweet_id])) {
                            payload['tweet-' + tweet_id] = JSPLib.utility.arrayUnion(payload['tweet-' + tweet_id], database_batch[tweet_id]);
                        } else {
                            payload['tweet-' + tweet_id] = database_batch[tweet_id];
                        }
                    }
                    await JSPLib.storage.twitterstorage.setItems(payload);
                    await JSPLib.storage.batchstorage.removeItem('database-batch-' + batch_index);
                    JSPLib.debug.debugTimeEnd('SaveDatabaseBatch-' + display_index);
                })();
            } else {
                JSPLib.debug.debuglog(`SaveDatabaseBatch: batch #${display_index} not found... skipping.`);
            }
        });
    } else if (Number.isInteger(NTISAS.database_interval)) {
        if (SaveDatabaseBatch.is_help_installed) {
            $('#ntisas-database-link').html(RenderDatabaseVersion(NTISAS.database_info));
            $('#ntisas-database-help').html(RenderHelp(DATABASE_VERSION_HELP));
            SaveDatabaseBatch.is_help_installed = false;
        }
        JSPLib.storage.removeLocalData('ntisas-database-numbatches');
        JSPLib.storage.removeLocalData('ntisas-database-batchindex');
        clearInterval(NTISAS.database_interval);
        NTISAS.database_interval = null;
    }
}

async function GetSavePackage(export_types) {
    let save_package = Object.assign(...export_types.map((type) => ({[type]: {}})));
    if (export_types.includes('program_data')) {
        Object.keys(localStorage).forEach((key) => {
            if (key.match(/^ntisas-/)) {
                let temp_data = JSPLib.storage.checkLocalData(key);
                if (temp_data !== null) {
                    save_package.program_data[key] = temp_data;
                }
            }
        });
    }
    if (export_types.includes('tweet_database')) {
        let database_length = await InitializeTotalRecords();
        let batch_counter = Math.floor(database_length / 10000);
        await JSPLib.storage.twitterstorage.iterate((value, key, i) => {
            let match = key.match(/^tweet-(\d+)$/);
            if (match) {
                save_package.tweet_database[match[1]] = value;
            } else if (key === 'ntisas-database-info') {
                save_package.database_info = value;
            }
            if ((i % 10000) === 0) {
                $('#ntisas-export-counter').html(--batch_counter);
            }
        });
    }
    return save_package;
}

//Event handlers

function CheckViews(entries, observer) {
    let printer = JSPLib.debug.getFunctionPrint('CheckViews');
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            let $tweet = $(entry.target);
            let tweet_id = $tweet.attr('data-tweet-id');
            printer.debuglogLevel("Viewable tweet:", tweet_id, entry, JSPLib.debug.DEBUG);
            AddViewCount(tweet_id);
            $tweet.attr('viewed', 'true');
            observer.unobserve(entry.target);
        }
    });
}

function SeenTweet(entries, observer) {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            let $tweet = $(entry.target);
            let tweet_id = $tweet.attr('data-tweet-id');
            let is_duplicate = NTISAS.seen_tweet.has(tweet_id);
            NTISAS.seen_tweet.add(tweet_id);
            if (is_duplicate && $tweet.attr('ntisas-tweet') === 'stream') {
                $tweet.find('.ntisas-already-seen').show();
                $tweet.addClass('ntisas-seen');
            }
            observer.unobserve(entry.target);
        }
    });
}

function MenuNavigation(event) {
    if (event.originalEvent.destination.url.startsWith('blob:')) return;
    let page_type = GetPageType(event.originalEvent.destination.url);
    UpdateSideMenu(page_type, true);
}

function SaveMenuPosition() {
    let {left, top} = $('#ntisas-side-menu').get(0).style;
    if (left !== "" && top !== "") {
        JSPLib.storage.setLocalData('ntisas-menu-position', {left, top});
        NTISAS.channel.postMessage({type: 'sidemenu_position', left, top});
    }
}

function ImageEnter(event) {
    if (!NTISAS.display_image_number) {
        return;
    }
    let $overlay = $(event.currentTarget).addClass('ntisas-image-num');
    let $container = $overlay.children();
    let image_num = $container.attr('ntisas-image');
    let left = parseFloat($container.css('margin-left').match(/[\d+.]+/)[0]);
    let right = parseFloat($container.css('margin-right').match(/[\d+.]+/)[0]);
    let margin_top = parseFloat($container.css('margin-top').match(/[\d+.]+/)[0]);
    let margin_left = 0;
    if (left > 0) {
        margin_left = left / 2;
    } else if (right > 0) {
        margin_left = right / -2;
    }
    let style = JSPLib.utility.sprintf(IMAGE_NUMBER_CSS, image_num, margin_top, margin_left);
    JSPLib.utility.setCSSStyle(style, 'image_num');
}

function ImageLeave(event) {
    if (!NTISAS.display_image_number) {
        return;
    }
    $(event.currentTarget).removeClass('ntisas-image-num');
    JSPLib.utility.setCSSStyle("", 'image_num');
}

function ToggleImageSize(event) {
    let printer = JSPLib.debug.getFunctionPrint('ToggleImageSize');
    try {
        let image = event.target;
        let $image = $(image);
        let image_url = $image.attr('src');
        let image_info = GetImageURLInfo(image_url);
        if (image_info) {
            let orig_url = $image.parent().data('orig-size');
            let $image_anchor = NTISAS.image_anchor[orig_url];
            let showing_large = $image.data('showing-large') ?? false;
            if (showing_large || image_info.size === 'large') {
                $image_anchor.qtiptisas('hide');
                $image_anchor.closest('a').get(0).click();
            } else {
                let qtip_API = $image_anchor.qtiptisas('api');
                let current_x = parseFloat(qtip_API.tooltip.css('left'));
                let current_y = parseFloat(qtip_API.tooltip.css('top'));
                let current_width = image.width;
                let current_height = image.height;
                image.onload = () => {
                    let new_x = current_x - ((image.width - current_width) / 2);
                    let new_y = current_y - ((image.height - current_height) / 2);
                    qtip_API.tooltip.css({
                        left: new_x,
                        top: new_y,
                    });
                };
                let large_url = 'https://pbs.twimg.com/' + image_info.path + '/' + image_info.key + '?format=' + image_info.ext + '&name=medium';
                $image.attr('src', large_url);
                $image.data('showing-large', true);
            }
        } else {
            printer.debugwarn("No match!", image_url);
        }
    } catch (e) {
        JSPLib.notice.error("ToggleImage: Error");
        console.log("ToggleImage error:", e);
    } finally {
        event.preventDefault();
    }
}

function ToggleSideMenu(event) {
    let menu_shown = JSPLib.storage.getLocalData('ntisas-side-menu', {default_val: true});
    JSPLib.storage.setLocalData('ntisas-side-menu', !menu_shown);
    UpdateSideMenu(NTISAS.page, true);
    NTISAS.channel.postMessage({type: 'sidemenu_ui'});
    event.preventDefault();
    event.stopImmediatePropagation();
    return false;
}

function SideMenuSelection(event) {
    let $link = $(event.target);
    let selected_menu = $link.data('selector');
    JSPLib.storage.setLocalData('ntisas-side-selection', selected_menu);
    UpdateSideMenuSelection();
    NTISAS.channel.postMessage({type: 'sidemenu_selection'});
}

function SideMenuHotkeys(event) {
    $(`#ntisas-menu-selection a:nth-of-type(${event.originalEvent.key})`).click();
}

function ToggleSimilarSource() {
    let similar_source = (NTISAS.similar_source === 'danbooru' ? 'saucenao' : 'danbooru');
    JSPLib.storage.setLocalData('ntisas-similar-source', similar_source);
    UpdateSimilarControls();
    NTISAS.channel.postMessage({type: 'similar_source'});
}

function ToggleConfirmUpload() {
    JSPLib.storage.setLocalData('ntisas-confirm-upload', !NTISAS.confirm_upload);
    UpdateConfirmUploadControls();
    NTISAS.channel.postMessage({type: 'confirm_upload'});
}

function ToggleConfirmDownload() {
    JSPLib.storage.setLocalData('ntisas-confirm-download', !NTISAS.confirm_download);
    UpdateConfirmDownloadControls();
    NTISAS.channel.postMessage({type: 'confirm_download'});
}

function ToggleViewHighlights() {
    let show_highlights = JSPLib.storage.getLocalData('ntisas-view-highlights', {default_val: true});
    JSPLib.storage.setLocalData('ntisas-view-highlights', !show_highlights);
    UpdateViewHighlights();
    UpdateViewHighlightControls();
    NTISAS.channel.postMessage({type: 'view_highlights'});
}

function ToggleViewCounts() {
    let count_views = JSPLib.storage.getLocalData('ntisas-view-counts', {default_val: true});
    JSPLib.storage.setLocalData('ntisas-view-counts', !count_views);
    UpdateViewCountControls();
    NTISAS.channel.postMessage({type: 'count_views'});
}

function CurrentRecords() {
    if (!CurrentRecords.is_running) {
        CurrentRecords.is_running = true;
        if (WasOverflow()) {
            if (JSPLib.concurrency.reserveSemaphore(PROGRAM_SHORTCUT, 'records')) {
                if (confirm(CURRENT_RECORDS_CONFIRM)) {
                    GetAllCurrentRecords();
                }
                JSPLib.concurrency.freeSemaphore(PROGRAM_SHORTCUT, 'records');
            } else {
                JSPLib.notice.error("Getting current records in another tab!");
            }
        } else {
            JSPLib.notice.notice("Already up to date!");
        }
        CurrentRecords.is_running = false;
    }
}

function QueryTotalRecords() {
    InitializeTotalRecords(true).then((length) => {
        $('#ntisas-total-records').html(length);
        JSPLib.notice.notice("Finished updating record count!");
    });
}

function OpenMediaTweetMenu(event) {
    let $menu = $(event.target);
    let $tweet = $menu.closest('.ntisas-media-tweet');
    let tweet_id = $tweet.data('tweet-id');
    if (!NTISAS.media_dialog[tweet_id]) {
        let screen_name = $tweet.data('screen-name');
        NTISAS.media_dialog_anchor[tweet_id] = $menu;
        var tweet_data;
        if ($tweet.hasClass('ntisas-multi-media')) {
            let session_data = JSPLib.storage.getIndexedSessionData('tweet-' + tweet_id, {default_val: []});
            tweet_data = session_data.value;
        } else {
            tweet_data = GetSingleImageInfo(tweet_id);
        }
        let image_urls = tweet_data.map((data) => 'https://pbs.twimg.com/' + data.partial_image);
        var video_promise;
        if (($tweet.data('media-type') === 'video' || $tweet.data('text') === 'GIF') && $tweet.hasClass('ntisas-single-media')) {
            video_promise = GetTweetData(tweet_id).then((data) => data.map((data) => Boolean(data.partial_video)));
        } else {
            video_promise = Promise.resolve(tweet_data.map((data) => Boolean(data.partial_video)));
        }
        video_promise.then((videos) => {
            let $dialog = NTISAS.media_dialog[tweet_id] = $(RenderMediaMenu(tweet_id, screen_name, image_urls, videos));
            $dialog.prop('ntisasImageUrls', image_urls);
            $dialog.find('.ntisas-media-image').each((_, entry) => {
                $(entry).on(PROGRAM_CLICK, PopupMediaTweetImage);
            });
            $dialog.find('.ntisas-media-video').each((_, entry) => {
                $(entry).on(PROGRAM_CLICK, PopupMediaTweetVideo);
            });
            let encoded_url = encodeURIComponent(`https://twitter.com/${screen_name}/status/${tweet_id}`);
            $dialog.find('.ntisas-control-upload').attr('href', `${NTISAS.domain}/uploads/new?url=${encoded_url}`);
            GetData('tweet-' + tweet_id, 'twitter').then((post_ids) => {
                if (post_ids !== null) {
                    InitializePostIDsLink(tweet_id, $dialog[0], post_ids);
                } else {
                    InitializeNoMatchesLinks(tweet_id);
                }
            });
            let dialog_settings = Object.assign({}, GENERAL_DIALOG_SETTINGS, {
                title: "Media menu",
                modal: false,
                width: 620,
                buttons: {
                    Close: CloseDialog,
                },
            });
            $dialog.dialog(dialog_settings);
            $dialog.dialog('open');
        });
        InitializeUIStyle();
        if (NTISAS.display_tweet_views) {
            AddViewCount(tweet_id);
        }
    } else {
        NTISAS.media_dialog[tweet_id].dialog('open');
    }
}

function PopupTweetLargeImage(event) {
    let $container = $(event.currentTarget);
    let image_url = $container.data('url');
    let original = image_url + ':orig';
    let regular = image_url + ':large';
    let html = `
        <div class="ntisas-preview-popup">
            <a href="${original}"><img src="${regular}"></a>
        </div>`;
    let $popup = $(html);
    $popup.appendTo(document.body);
    $popup.on('mouseleave.ntisas', () => {
        $popup.remove();
    });
    $popup.find('a').get(0).onclick = (() => false);
    event.preventDefault();
}

function PopupMediaTweetImage(event) {
    let $container = $(event.currentTarget);
    let $image = $container.find('img');
    let image_url = $image.attr('src');
    let image_info = GetImageURLInfo(image_url);
    let large_url = 'https://pbs.twimg.com/' + image_info.path + '/' + image_info.key + '?format=' + image_info.ext + '&name=medium';
    let html = `
<div class="ntisas-popup-media-image">
    <img src="${large_url}">
</div>`;
    let $popup = $(html);
    $popup.appendTo(document.body);
    $popup.on('mouseleave.ntisas', () => {
        $popup.remove();
    });
}

function PopupMediaTweetVideo(event) {
    let $container = $(event.currentTarget);
    let $menu = $container.closest('.ntisas-media-menu');
    let tweet_id = $menu.data('tweet-id');
    let order = $container.data('order');
    let tweet_data = JSPLib.storage.getIndexedSessionData('tweet-' + tweet_id, {default_val: []});
    let image_data = tweet_data.value[order];
    if (JSPLib.validate.isHash(image_data)) {
        let video_url = 'https://video.twimg.com/' + (image_data.partial_sample ?? image_data.partial_video);
        let html = `
    <div class="ntisas-popup-media-video">
        <video controls autoplay src="${video_url}">
    </div>`;
        let $popup = $(html);
        $popup.appendTo(document.body);
        setTimeout(() => {
            $popup.on('mouseleave.ntisas', () => {
                $popup.remove();
            });
        }, 500);
    }
}

function SearchMenu(event) {
    let {tweet_id, $tweet} = GetEventPreload(event);
    GetImageLinks($tweet[0]).then((image_urls) => {
        if (image_urls.length > 0) {
            if (image_urls.length > 1 && IsQuerySettingEnabled('pick_image', NTISAS.similar_source)) {
                InitializeSearchDialog(tweet_id, image_urls);
            } else {
                CheckSimilar(tweet_id, image_urls);
            }
        } else {
            JSPLib.notice.error(`Unable to find any images to query for tweet #${tweet_id}.`);
        }
    });
}

function SearchControl(event) {
    let {tweet_id, screen_name} = GetEventPreload(event);
    if (NTISAS.search_running.has(tweet_id)) return;
    NTISAS.search_running.add(tweet_id);
    UpdateMenuResults(tweet_id, 'loading...', true);
    CheckURL(tweet_id, screen_name).then((post_ids) => {
        let save_ids = SaveTweetData(tweet_id, post_ids);
        UpdatePostIDsLink(tweet_id, save_ids);
        // eslint-disable-next-line
        NTISAS.search_running.delete(tweet_id);
    });
    event.preventDefault();
}

function SearchSubmit(event) {
    let {$dialog, tweet_id} = GetDialogPreload(event);
    let image_urls = JSPLib.utility.getDOMAttributes($dialog.find('.ntisas-post-select'), 'url');
    if (image_urls.length > 0) {
        CheckSimilar(tweet_id, image_urls);
    } else {
        JSPLib.notice.notice("Must select at least one image to query.");
    }
    CloseDialog(event);
}

function ConfirmControl(event) {
    let {tweet_id} = GetEventPreload(event);
    NTISAS.confirm_dialog[tweet_id].dialog('open');
}

function ConfirmSubmit(event) {
    let {$dialog, tweet_id} = GetDialogPreload(event);
    let selected_post_ids = JSPLib.utility.getDOMAttributes($dialog.find('.ntisas-post-select'), 'id', Number);
    let save_ids = SaveTweetData(tweet_id, selected_post_ids);
    UpdatePostIDsLink(tweet_id, save_ids);
    CloseDialog(event);
    $dialog.dialog('destroy').remove();
    delete NTISAS.confirm_dialog[tweet_id];
}

function UploadMenu(event) {
    let {$tweet, tweet_id, screen_name} = GetEventPreload(event);
    GetMediaLinksData($tweet).then(({image_urls, videos}) => {
        if (image_urls.length > 1) {
            InitializeUploadDialog(tweet_id, screen_name, image_urls, videos);
        } else if (image_urls.length === 1) {
            if (!NTISAS.confirm_upload || confirm("Upload tweet?")) {
                $tweet.find('.ntisas-control-upload').clone().get(0).click();
            }
        } else {
            JSPLib.notice.error(`Unable to find any images to upload for tweet #${tweet_id}.`);
        }
    });
    event.preventDefault();
}

function UploadAllSubmit(event) {
    let {$dialog} = GetDialogPreload(event);
    $dialog.find('.ntisas-upload-all').get(0).click();
}

function DownloadMenu(event) {
    let {$tweet, tweet_id, screen_name} = GetEventPreload(event);
    GetMediaLinksData($tweet).then(({image_urls, videos}) => {
        if (image_urls.length > 1) {
            InitializeDownloadDialog(tweet_id, screen_name, image_urls, videos);
        } else if (image_urls.length === 1) {
            if (!NTISAS.confirm_download || confirm("Download all?")) {
                DownloadAllTweet($tweet);
            }
        } else {
            JSPLib.notice.error(`Unable to find any images to download for tweet #${tweet_id}.`);
        }
    });
    event.preventDefault();
}

function DownloadControl(event) {
    let {$tweet} = GetEventPreload(event);
    if (!NTISAS.confirm_download || confirm("Download all?")) {
        DownloadAllTweet($tweet);
    }
    event.preventDefault();
}

function DownloadLink(event) {
    let {$link, tweet_id, screen_name} = GetDialogPreload(event);
    let media_url = $link.data('url');
    let order = $link.data('order');
    $link.removeClass('ntisas-active').text('loading...');
    DownloadMediaFile(media_url, tweet_id, screen_name, order).then(() => {
        $link.addClass('ntisas-active').text('download');
    });
}

function DownloadAllSubmit(event) {
    let {tweet_id} = GetDialogPreload(event);
    let $tweet = GetTweet(tweet_id);
    DownloadAllTweet($tweet);
    CloseDialog(event);
}

function CloseDialog(event) {
    let {$dialog} = GetDialogPreload(event);
    $dialog.dialog('close');
}

function ManualAdd(event) {
    let {$link, tweet_id} = GetEventPreload(event);
    if (NTISAS.no_confirm.has(tweet_id)) {
        if (confirm("Reset results link?")) {
            let post_ids = GetSessionTweetData(tweet_id);
            UpdatePostIDsLink(tweet_id, post_ids);
        }
    } else {
        var message, save_post_ids;
        if ($link.data('has-posts')) {
            let all_post_ids = GetSessionTweetData(tweet_id);
            if (!NTISAS.tweet_qtip[tweet_id]) {
                save_post_ids = [];
            } else {
                let $select_previews = $('.ntisas-post-select', NTISAS.tweet_qtip[tweet_id][0]);
                save_post_ids = JSPLib.utility.getDOMAttributes($select_previews, 'id', Number);
            }
            let delete_post_ids = JSPLib.utility.arrayDifference(all_post_ids, save_post_ids);
            message = JSPLib.utility.sprintf(CONFIRM_DELETE_PROMPT, delete_post_ids);
        } else {
            message = MANUAL_ADD_PROMPT;
            save_post_ids = [];
        }
        PromptSavePostIDs(tweet_id, message, save_post_ids);
    }
    event.preventDefault();
}

function SelectPreview(event) {
    $(event.currentTarget).closest('.ntisas-post-preview').toggleClass('ntisas-post-select');
    event.preventDefault();
}

function SelectControls(event) {
    let $container = $(event.target).closest('.ntisas-selectable-results');
    let type = $(event.target).data('type');
    let $post_previews = $container.find('.ntisas-post-preview.ntisas-post-selectable');
    switch (type) {
        case 'all':
            $post_previews.addClass('ntisas-post-select');
            break;
        case 'none':
            $post_previews.removeClass('ntisas-post-select');
            break;
        case 'invert':
            $post_previews.toggleClass('ntisas-post-select');
            // falls through
        default:
            // do nothing
    }
}

function HelpInfo(event) {
    let help_text = $(event.target).attr('title');
    alert(help_text);
}

function ErrorMessages() {
    if (JSPLib.network.error_messages.length) {
        let help_text = JSPLib.network.error_messages.map((entry) => `HTTP Error ${entry[1]}: ${entry[2]}<br>&emsp;&emsp;=> ${entry[0]}`).join('<br><br>');
        JSPLib.notice.error(help_text);
    } else {
        JSPLib.notice.notice("No error messages!");
    }
}

function ToggleLock() {
    if (NTISAS.page_locked) {
        $(window).off('beforeunload.ntisas.lock_page');
    } else {
        $(window).on('beforeunload.ntisas.lock_page', () => "");
    }
    $('#ntisas-enabled-lockpage, #ntisas-disabled-lockpage').toggle();
    NTISAS.page_locked = !NTISAS.page_locked;
}

function SelectMetric(event) {
    if (NTISAS.page === 'media') return;
    let type = $(event.target).parent().data('key');
    let filter1 = NTISAS.tweet_type1_filter;
    let filter2 = NTISAS.tweet_type2_filter;
    switch (type) {
        case 'total':
            filter1 = 'total';
            filter2 = 'total';
            break;
        case 'retweet':
            filter1 = 'retweet';
            break;
        case 'tweet':
            filter1 = 'tweet';
            break;
        case 'image':
            filter2 = 'image';
            break;
        case 'video':
            filter2 = 'video';
            break;
        case 'text':
            filter2 = 'text';
            //falls through
        default:
            //do nothing
    }
    if (InitializeTweetStats(filter1, filter2)) {
        NTISAS.tweet_type1_filter = filter1;
        NTISAS.tweet_type2_filter = filter2;
    } else {
        JSPLib.notice.notice("Must select category combinations with at least one tweet!");
    }
}

function ExportData() {
    let export_types = JSPLib.menu.getCheckboxRadioSelected('[data-setting="export_types"] [data-selector]');
    if (export_types.length === 0) {
        JSPLib.notice.notice("Must select at least one export type!");
    } else if (!ExportData.is_running) {
        ExportData.is_running = true;
        JSPLib.notice.notice("Exporting data!");
        GetSavePackage_T(export_types).then((save_package) => {
            let export_addon = export_types.map((type) => `[${type}]`).join('-');
            let time_addon = GetDateTimeString(Date.now());
            let filename = `NTISAS-${export_addon}-${time_addon}.json`;
            DownloadObject(save_package, filename, true);
            ExportData.is_running = false;
        });
    }
}

function ImportData() {
    let printer = JSPLib.debug.getFunctionPrint('ImportData');
    if (!NTISAS.import_is_running) {
        NTISAS.import_is_running = true;
        $('#ntisas-import-counter').text('reading');
        ReadFileAsync('#ntisas-import-file', true).then(
            //Success
            async (import_package) => {
                JSPLib.notice.notice("Importing data...");
                let errors = false;
                if ('program_data' in import_package) {
                    printer.debuglog("Program data:", import_package.program_data);
                    Object.keys(import_package.program_data).forEach((key) => {
                        if (ValidateProgramData(key, import_package.program_data[key])) {
                            JSPLib.storage.setLocalData(key, import_package.program_data[key]);
                        } else {
                            errors = true;
                        }
                    });
                }
                if ('database_info' in import_package) {
                    //Add a way to overwrite the current last_id and timestamp values (settings menu)
                    printer.debuglog("Database info:", import_package.database_info);
                    await JSPLib.storage.saveData('ntisas-database-info', import_package.database_info, {database: JSPLib.storage.twitterstorage});
                    NTISAS.database_info = import_package.database_info;
                    $('#ntisas-database-link').html(RenderDatabaseVersion(NTISAS.database_info));
                }
                if ('database_batches' in import_package) {
                    printer.debuglog("Database batches length:", import_package.database_batches.length);
                    if (Number.isInteger(NTISAS.database_interval)) {
                        clearInterval(NTISAS.database_interval);
                        NTISAS.database_interval = null;
                    }
                    for (let i = 0; i < import_package.database_batches.length; i++) {
                        printer.debuglog(`"Saving batch #${i + 1} of ${import_package.database_batches.length}`);
                        $('#ntisas-import-counter').text(import_package.database_batches.length - i);
                        await JSPLib.storage.batchstorage.setItem('database-batch-' + i, import_package.database_batches[i]);
                        await JSPLib.utility.sleep(100);
                    }
                    JSPLib.storage.setLocalData('ntisas-import-pending', true);
                    $('#ntisas-import-counter').text(0);
                }
                if ('tweet_database' in import_package) {
                    printer.debuglog("Database length:", Object.keys(import_package.tweet_database).length);
                    await SaveDatabase_T(import_package.tweet_database, '#ntisas-import-counter');
                }
                if (errors) {
                    JSPLib.notice.error("Error importing some data!");
                } else {
                    JSPLib.notice.notice("Finished importing data.");
                }
                NTISAS.import_is_running = false;
                await JSPLib.utility.sleep(JSPLib.utility.one_second * 2);
                localStorage.removeItem('ntisas-length-recheck');
                NTISAS.channel.postMessage({type: 'database'});
                JSPLib.notice.notice("NTISAS will momentarily refresh the page to finish initializing the database.");
                //It's just easier to reload the page on database updates
                JSPLib.utility.refreshPage(PAGE_REFRESH_TIMEOUT);
            },
            //Failure
            () => {
                NTISAS.import_is_running = false;
                $('#ntisas-import-counter').text('failed');
            }
        );
    }
}

//Markup tweet functions

function MarkupMediaType(tweet) {
    let printer = JSPLib.debug.getFunctionPrint('MarkupMediaType');
    if ($('.ntisas-tweet-media [src*="/card_img/"]', tweet).length) {
        $('.ntisas-tweet-media', tweet).addClass('ntisas-tweet-card').removeClass('ntisas-tweet-media');
    } else if ($('.ntisas-tweet-media [role=progressbar]', tweet).length) {
        printer.debuglog("Delaying media check for", $(tweet).data('tweet-id'));
        let timer = setInterval(() => {
            if ($('.ntisas-tweet-media [role=progressbar]', tweet).length === 0) {
                clearInterval(timer);
                MarkupMediaType(tweet);
            }
        }, TIMER_POLL_INTERVAL);
    } else {
        let media_children = $('.ntisas-tweet-media', tweet).children().children();
        media_children.each((_, entry) => {
            let $entry = $(entry);
            let ret = false;
            if ($entry.children().length === 0) {
                $entry.addClass('ntisas-media-stub').attr('ntisas-media-type', 'stub');
                ret = true;
            } else if ($('[role=blockquote]', entry).length) {
                $entry.addClass('ntisas-tweet-quote').attr('ntisas-media-type', 'quote');
            } else if ($entry.parent().data('testid') === 'card.wrapper') {
                $entry.addClass('ntisas-tweet-card').attr('ntisas-media-type', 'card');
            } else if ($entry.find('div[role=link]').length === 1 || $entry.attr('role') === 'link') {
                $entry.addClass('ntisas-tweet-quote2').attr('ntisas-media-type', 'quote2');
            } else if ($entry.text() === "Quote Tweet" || $entry.text() === "Quote") {
                $entry.addClass('ntisas-tweet-quote3').attr('ntisas-media-type', 'quote3');
            } else if ($entry.text() === "This Tweet is unavailable.") {
                $entry.addClass('ntisas-tweet-quote4').attr('ntisas-media-type', 'quote4');
            } else if ($entry.find('img[src^="https://pbs.twimg.com/profile_images/"]').length > 0) {
                $entry.addClass('ntisas-tweet-quote4').attr('ntisas-media-type', 'quote5');
            } else if ($('video, [data-testid=playButton]', entry).length) {
                $entry.addClass('ntisas-tweet-video').attr('ntisas-media-type', 'video');
                ret = true;
            } else if (entry.tagName === 'BUTTON') {
                $entry.addClass('ntisas-tweet-button').attr('ntisas-media-type', 'button');
            } else {
                $entry.addClass('ntisas-tweet-image').attr('ntisas-media-type', 'image');
                ret = true;
            }
            return ret;
        });
    }
}

function MarkupStreamTweet(tweet) {
    let printer = JSPLib.debug.getFunctionPrint('MarkupStreamTweet');
    try {
        let status_link = $('time', tweet).parent();
        let [, screen_name,, tweet_id] = status_link[0].pathname.split('/');
        $(tweet).attr('ntisas-tweet', 'stream');
        $(tweet).attr('data-tweet-id', tweet_id);
        $(tweet).attr('data-screen-name', screen_name);
        if (IsPageType(['main', 'likes', 'replies']) && screen_name === NTISAS.account) {
            $(tweet).addClass('ntisas-self-tweet');
        }
        //Not marking this with a a class since Twitter alters it
        let article = tweet.children[0].children[0];
        let main_body = article.children[0].children[0];
        $(main_body).addClass('ntisas-main-body');
        let tweet_status = main_body.children[0];
        $(tweet_status).addClass('ntisas-tweet-status');
        InitializeStatusBar(tweet_status, false);
        let is_retweet = Boolean(tweet_status.innerText.match(/ reposted$/));
        $(tweet).attr('data-is-retweet', is_retweet);
        let tweet_body = main_body.children[1];
        $(tweet_body).addClass('ntisas-tweet-body');
        let tweet_left = tweet_body.children[0];
        $(tweet_left).addClass('ntisas-tweet-left');
        $(tweet_left).append('<div class="ntisas-seen-indicator"></div>');
        let tweet_right = tweet_body.children[1];
        $(tweet_right).addClass('ntisas-tweet-right');
        let sub_body = tweet_right;
        $(sub_body.children[0]).addClass('ntisas-profile-line');
        let profile_links = $('a', sub_body.children[0]);
        $(profile_links[0]).addClass('ntisas-display-name');
        var replychild, actionchild;
        var has_indicator;
        var index = 1;
        var saved_index = index;
        do {
            replychild = sub_body.children[index++];
            has_indicator = replychild.innerText.startsWith("Replying to \n@");
        } while (!has_indicator && index < sub_body.childElementCount);
        if (has_indicator) {
            $(replychild).addClass('ntisas-reply');
        } else {
            index = saved_index;
        }
        saved_index = index;
        $(sub_body.children[index++]).addClass('ntisas-tweet-text');
        var has_media;
        if (sub_body.childElementCount > (index + 1)) {
            let $media_child = $(sub_body.children[index++]);
            $media_child.addClass('ntisas-tweet-media');
            has_media = Boolean($media_child.children().length);
        }
        do {
            actionchild = sub_body.children[index++];
            has_indicator = (actionchild.querySelector('[data-testid="reply"]') !== null) ||
                            (actionchild.querySelector('[data-testid="retweet"]') !== null) ||
                            (actionchild.querySelector('[data-testid="like"]') !== null);
        } while (!has_indicator && index < sub_body.childElementCount);
        if (has_indicator) {
            $(actionchild).addClass('ntisas-tweet-actions');
        }
        if (has_media) {
            CheckHiddenMedia(tweet);
        }
    } catch (e) {
        printer.debugerror(e, tweet);
        if (JSPLib.debug.debug_console) {
            JSPLib.notice.error("Error marking up stream tweet! (check debug console for details)", false);
        }
    }
    $('.ntisas-tweet-actions', tweet).after('<div class="ntisas-footer-section"></div>');
}

function MarkupMainTweet(tweet) {
    let printer = JSPLib.debug.getFunctionPrint('MarkupMainTweet');
    try {
        $(tweet).attr('ntisas-tweet', 'main');
        $(tweet).attr('data-tweet-id', NTISAS.tweet_id);
        let main_body = tweet.children[0].children[0].children[0].children[0];
        $(main_body).addClass('ntisas-main-body');
        let tweet_status = main_body.children[0];
        $(tweet_status).addClass('ntisas-tweet-status');
        InitializeStatusBar(tweet_status, true);
        let profile_line = main_body.children[1];
        $(profile_line).addClass('ntisas-profile-line');
        if (NTISAS.page === "tweet") {
            $(tweet).attr('data-screen-name', NTISAS.screen_name);
        } else if (NTISAS.page === "web_tweet") {
            let screen_name = ($('[role=link]', profile_line).attr('href') ?? "").slice(1);
            $(tweet).attr('data-screen-name', screen_name);
        }
        let child2 = main_body.children[2];
        if (child2 && child2.children[1]
                && child2.children[1].tagName.toUpperCase() !== 'SPAN'
                && child2.children[1].children[0]
                && child2.children[1].children[0].tagName.toUpperCase() !== 'SPAN'
                && child2.children[1].innerText.match(/^Replying to/)) {
            $(child2.children[1]).addClass('ntisas-reply-line');
        }
        let sub_body = main_body.children[2];
        $(sub_body).addClass('ntisas-sub-body');
        $(sub_body.children[0]).addClass('ntisas-tweet-text');
        let mediachild = sub_body.children[1];
        $(mediachild).addClass('ntisas-tweet-media');
        $(sub_body.children[1]).addClass('ntisas-stub');
        let has_media = Boolean($(mediachild).children().length);
        var timechild, retweetchild, actionchild;
        var index = 3;
        var has_indicator;
        var saved_index = index;
        do {
            timechild = sub_body.children[index++];
            has_indicator = timechild.querySelector('time') !== null;
        } while (!has_indicator && index < sub_body.childElementCount);
        if (has_indicator) {
            $(timechild).addClass('ntisas-time-line');
        } else {
            index = saved_index;
        }
        saved_index = index;
        do {
            retweetchild = sub_body.children[index++];
            has_indicator = (retweetchild.querySelector('[href$="/retweets"]') !== null) ||
                            (retweetchild.querySelector('[href$="/likes"]') !== null) ||
                            (retweetchild.querySelector('[href$="/retweets/with_comments"]') !== null);
        } while (!has_indicator && index < sub_body.childElementCount);
        if (has_indicator) {
            $(retweetchild).addClass('ntisas-retweets-likes');
        } else {
            index = saved_index;
        }
        saved_index = index;
        do {
            actionchild = sub_body.children[index++];
            has_indicator = (actionchild.querySelector('[data-testid="reply"]') !== null) ||
                            (actionchild.querySelector('[data-testid="retweet"]') !== null) ||
                            (actionchild.querySelector('[data-testid="like"]') !== null);
        } while (!has_indicator && index < sub_body.childElementCount);
        if (has_indicator) {
            $(actionchild).addClass('ntisas-tweet-actions');
        }
        if (has_media) {
            CheckHiddenMedia(tweet);
        }
    } catch (e) {
        printer.debugerror(e, tweet);
        if (JSPLib.debug.debug_console) {
            JSPLib.notice.error("Error marking up main tweet! (check debug console for details)", false);
        }
    }
    $('.ntisas-tweet-actions', tweet).after('<div class="ntisas-footer-section"></div>');
}

function MarkupMediaTweet(tweet) {
    let $tweet = $(tweet);
    let $link = $tweet.find('a[role="link"]');
    if ($link.length === 0) {
        $tweet.addClass('ntisas-blank-tweet');
        return;
    }
    let [, screen_name,, tweet_id, media_type, ] = $link.get(0).pathname.split('/');
    $tweet.addClass('ntisas-media-tweet');
    $tweet.attr('data-tweet-id', tweet_id);
    $tweet.attr('data-screen-name', screen_name);
    $tweet.attr('data-media-type', media_type);
    $tweet.attr('data-text', tweet.innerText);
    let $svg = $tweet.find('svg');
    if ($svg.length > 0) {
        $tweet.addClass('ntisas-multi-media');
    } else {
        $tweet.addClass('ntisas-single-media');
    }
    JSPLib.utility.recheckTimer({
        check: () => JSPLib.validate.isString(NTISAS.user_id),
        exec: () => {
            $tweet.attr('data-user-id', NTISAS.user_id);
        }
    }, TIMER_POLL_INTERVAL, PROFILE_VIEWS_CALLBACK);
    $tweet.find('[dir="ltr"]').each((_, entry) => {
        if (entry.innerText.match(/GIF|\d+:\d{2}/)) {
            $tweet.addClass('ntisas-media-video');
            return false;
        }
    });
    return tweet_id;
}

function CheckHiddenMedia(tweet) {
    tweet.ntisasDeferred = JSPLib.utility.createStatusPromise();
    if ($('.ntisas-tweet-media', tweet).text().match(/The following media includes potentially sensitive content|The Tweet author flagged this Tweet as showing sensitive content|The post author flagged this post as showing sensitive content/)) {
        $('.ntisas-tweet-media', tweet).attr('ntisas-media-type', 'deferred');
        $('.ntisas-tweet-media', tweet).addClass('ntisas-hidden-media');
        $('.ntisas-tweet-media [role=button]', tweet).one(PROGRAM_CLICK, () => {
            $('.ntisas-tweet-media', tweet).removeClass('ntisas-hidden-media');
            setTimeout(() => {
                MarkupMediaType(tweet);
            }, TWITTER_DELAY);
        });
    } else {
        MarkupMediaType(tweet);
    }
}

//Main execution functions

function RegularCheck() {
    let printer = JSPLib.debug.getFunctionPrint('RegularCheck');
    if (NTISAS.update_on_found && NTISAS.user_id) {
        NTISAS.update_on_found = false;
    } else if (NTISAS.update_profile?.timer === false) {
        printer.debugwarn("Failed to find user ID!!");
    }

    //Get current page and previous page info
    NTISAS.prev_pagetype = NTISAS.page;
    let pagetype = GetPageType(window.location.href);
    if (pagetype === "other") {
        return;
    }

    //Process events on a page change
    PageNavigation(pagetype);

    //Process events at each interval
    if (!NTISAS.colors_checked || window.location.pathname === '/i/display') {
        AdjustColorScheme();
    }
    for (let tweet_id in NTISAS.qtip_anchor) {
        if (!document.body.contains(NTISAS.qtip_anchor[tweet_id].get(0))) {
            NTISAS.qtip_anchor[tweet_id].qtiptisas('destroy', true);
            delete NTISAS.tweet_qtip[tweet_id];
            delete NTISAS.qtip_anchor[tweet_id];
        }
    }
    for (let tweet_id in NTISAS.dialog_tweet) {
        if (!document.body.contains(NTISAS.dialog_tweet[tweet_id].get(0))) {
            DestroyDialog('search_dialog', tweet_id);
            DestroyDialog('confirm_dialog', tweet_id);
            DestroyDialog('upload_dialog', tweet_id);
            delete NTISAS.dialog_tweet[tweet_id];
        }
    }
    for (let image_url in NTISAS.image_anchor) {
        if (!document.body.contains(NTISAS.image_anchor[image_url].get(0))) {
            NTISAS.image_anchor[image_url].qtiptisas('destroy', true);
            delete NTISAS.image_anchor[image_url];
        }
    }
    for (let tweet_id in NTISAS.media_dialog_anchor) {
        if (!document.body.contains(NTISAS.media_dialog_anchor[tweet_id].get(0))) {
            NTISAS.media_dialog[tweet_id].dialog('destroy').remove();
            delete NTISAS.media_dialog[tweet_id];
            delete NTISAS.media_dialog_anchor[tweet_id];
        }
    }
    if (NTISAS.media_timeline_enabled && NTISAS.page === 'media') {
        ProcessMediaTweets();
        return;
    }
    //Process any new images that have been loaded
    ProcessTweetImages();
    //Process events on newly rendered tweets that should only be done once
    if (!ProcessNewTweets()) {
        //Only process further if there are new tweets
        return;
    }
    if (!IsPageType(['tweet', 'web_tweet', 'other'])) {
        CollectTweetStats();
    }
    if (NTISAS.auto_unhide_tweets_enabled) {
        UnhideTweets();
    }
}

function ProcessTweetImage(obj, image_info, unprocessed_tweets) {
    let printer = JSPLib.debug.getFunctionPrint('ProcessTweetImage');
    let $obj = $(obj);
    if (image_info) {
        let $tweet = $obj.closest('[ntisas-tweet]');
        let tweet_id = $tweet.data('tweet-id');
        let image_keys = JSPLib.utility.getDOMAttributes($tweet.find('ntisas-key'), 'key');
        if (!image_keys.includes(image_info.key)) {
            let dom_attributes = Object.assign(
                {'ntisas-image': ""},
                ...Object.entries(image_info).map(([key, value]) => ({['data-' + key]: value})),
            );
            $obj.parent().attr(dom_attributes);
            if (!(tweet_id in unprocessed_tweets)) {
                unprocessed_tweets[tweet_id] = $tweet;
            }
            if (NTISAS.image_popout_enabled && $tweet.attr('ntisas-tweet') === 'stream') {
                InitializeImageQtip($obj);
            }
        }
    } else {
        $obj.addClass('ntisas-unhandled-image');
        JSPLib.debug.debugExecute(() => {
            if (JSPLib.validate.isBoolean(image_info)) {
                JSPLib.notice.debugNoticeLevel("New unhandled image found (see debug console)", JSPLib.debug.INFO);
                printer.debugwarn("Unhandled image", obj.src, $obj.closest('[ntisas-tweet]').data('tweet-id'));
            }
        });
    }
}

function ProcessTweetImages() {
    let printer = JSPLib.debug.getFunctionPrint('ProcessTweetImages');
    let $unprocessed_images = $('.ntisas-tweet-media > div > div:not(.ntisas-tweet-quote):not(.ntisas-tweet-quote2) div:not([ntisas-image]) > img:not(.ntisas-unhandled-image)');
    if ($unprocessed_images.length) {
        printer.debuglog("Images found:", $unprocessed_images.length);
    }
    let unprocessed_tweets = {};
    $unprocessed_images.each((_, image) => {
        let image_info = GetImageURLInfo(image.src);
        ProcessTweetImage(image, image_info, unprocessed_tweets);
    });
    //Only gets executed when videos are autoplay. Otherwise videos get found as images above.
    let $unprocessed_videos = $('.ntisas-tweet-media > div:not(.ntisas-tweet-quote) div:not([ntisas-image]) > video');
    if ($unprocessed_videos.length) {
        printer.debuglog("Videos found:", $unprocessed_videos.length);
    }
    $unprocessed_videos.each((_, video) => {
        let image_info = GetImageURLInfo(video.poster);
        ProcessTweetImage(video, image_info, unprocessed_tweets);
    });
    for (let tweet_id in unprocessed_tweets) {
        let $tweet = unprocessed_tweets[tweet_id];
        let is_main_tweet = $tweet.attr('ntisas-tweet') === 'main';
        let $images = $tweet.find('[ntisas-image]');
        $images.each((i, entry) => {
            let image_num = i + 1;
            $(entry).attr('ntisas-image', image_num);
            if (is_main_tweet) {
                $(entry.parentElement).on('mouseenter.ntisas', ImageEnter);
                $(entry.parentElement).on('mouseleave.ntisas', ImageLeave);
            }
        });
        $tweet.prop('ntisasDeferred')?.resolve(null);
    }
    let total_unprocessed = Object.keys(unprocessed_tweets).length;
    if (total_unprocessed > 0) {
        printer.debuglog("Tweets updated:", total_unprocessed);
    }
}

function ProcessNewTweets() {
    let printer = JSPLib.debug.getFunctionPrint('ProcessNewTweets');
    //Use the article HTML element as a landmark for locating tweets
    let $tweet_articles = $('div[data-testid=primaryColumn] div:not([ntisas-tweet]) > div > article[data-testid=tweet]');
    //Get the highest delineation point between tweets that Twitter doesn't alter through events
    let $tweets = $tweet_articles.map((_, entry) => entry.parentElement.parentElement);
    if ($tweets.length === 0) {
        return false;
    }
    NTISAS.uniqueid = JSPLib.utility.getUniqueID();
    printer.debuglog(NTISAS.uniqueid);
    let main_tweets = [];
    $tweets.each((_, entry) => {
        $(entry).attr({
            viewed: false,
            'ntisas-tweet': "",
        });
        if (IsTweetPage()) {
            if ($('> div > article > div > div', entry).children().length > 2) {
                main_tweets.push(entry);
            }
        } else if ($('a > time', entry).length) {
            MarkupStreamTweet(entry);
        }
    });
    if (IsTweetPage() && main_tweets.length > 0) {
        MarkupMainTweet(main_tweets[0]);
    }
    let $image_tweets = $tweets.filter((_, entry) => $('[ntisas-media-type=image], [ntisas-media-type=video], [ntisas-media-type=deferred]', entry).length);
    printer.debuglog(`[${NTISAS.uniqueid}]`, "New:", $tweets.length, "Image:", $image_tweets.length);
    //Initialize tweets with images
    if ($image_tweets.length) {
        InitializeImageTweets($image_tweets);
        if (NTISAS.display_tweet_views) {
            $image_tweets.each((_, entry) => {
                InitializeViewCount(entry);
                if (IsTweetPage()) {
                    let tweet_id = $(entry).attr('data-tweet-id');
                    printer.debuglogLevel("Viewable tweet:", tweet_id, JSPLib.utility.DEBUG);
                    AddViewCount(tweet_id);
                    $(entry).attr('viewed', 'true');
                } else {
                    NTISAS.intersection_observer.observe(entry);
                    NTISAS.seen_observer.observe(entry);
                }
            });
            UpdateViewHighlights();
        }
    }
    return true;
}

function ProcessMediaTweets() {
    let $tweet_list_items = $('div[data-testid=primaryColumn] div[data-testid="cellInnerDiv"] li[role="listitem"]:not(.ntisas-media-tweet):not(.ntisas-blank-tweet)');
    if ($tweet_list_items.length === 0) return;
    NTISAS.timeline_tweets[NTISAS.account] ??= {total: new Set(), single: new Set(), multi: new Set()};
    let timeline_tweets = NTISAS.timeline_tweets[NTISAS.account];
    let tweet_ids = [];
    let promise_array = [];
    $tweet_list_items.each((_, tweet) => {
        let tweet_id = MarkupMediaTweet(tweet);
        if (!JSPLib.validate.isString(tweet_id)) return;
        promise_array.push(GetData('tweet-' + tweet_id, 'twitter'));
        tweet_ids.push(tweet_id);
        timeline_tweets.total.add(tweet_id);
        if ($(tweet).hasClass('ntisas-multi-media')) {
            timeline_tweets.multi.add(tweet_id);
        } else {
            timeline_tweets.single.add(tweet_id);
        }
    });
    UpdateViewHighlights();
    let table_html = JSPLib.utility.regexReplace(MEDIA_STATISTICS, {
        TOTALTWEETS: timeline_tweets.total.size,
        SINGLETWEETS: timeline_tweets.single.size,
        MULTITWEETS: timeline_tweets.multi.size,
    });
    $('#ntisas-tweet-stats-table').html(table_html);
    let $multi_media_tweets = $('.ntisas-media-tweet.ntisas-multi-media:not(.ntisas-media-checked)');
    let multi_tweet_ids = $multi_media_tweets.map((_, entry) => entry.dataset.tweetId).toArray();
    $multi_media_tweets.addClass('ntisas-media-checked');
    var tweet_dict_promise = GetTweetsData(multi_tweet_ids, NTISAS.account);
    if (NTISAS.use_media_timeline_endpoint) {
        let lowest_tweet_id = String(JSPLib.utility.bigIntMin(...tweet_ids.map((tweet_id) => BigInt(tweet_id))));
        //Keep the timeline handler up-to-date with the media timeline no matter what, otherwise it takes forever to catch up.
        QueueTimelineRequest(lowest_tweet_id, NTISAS.account);
    }
    Promise.all(promise_array).then((tweet_post_ids) => {
        for (let i = 0; i < tweet_ids.length; i++) {
            let tweet_id = tweet_ids[i];
            let post_ids = tweet_post_ids[i];
            InitializeMediaTweet(tweet_id, post_ids, tweet_dict_promise);
        }
    });
}

function AdjustColorScheme() {
    const compareColors = (result, val, key) => (result || String(NTISAS.colors[key]) !== String(val));
    let $home_button = $('[data-testid=AppTabBar_More_Menu] > div > div').filter((_, entry) => entry.children[0].tagName === 'SPAN');
    JSPLib.storage.localforage.getItem('device:rweb.settings').then((settings) => {
        if (JSPLib.validate.isHash(settings) && $home_button.length && document.body.style['background-color']) {
            NTISAS.colors_checked = true;
            let text_color = getComputedStyle($home_button[0]).color.match(/\d+/g);
            let background_color = document.body.style['background-color'].match(/\d+/g);
            let light_mode = (background_color.reduce((total, x) => total + Number(x), 0) / 3) > 128;
            let contrast = settings.local.highContrastEnabled;
            let color_scheme = (light_mode ? 'light' : 'dark') + '_' + (contrast ? 'contrast' : 'normal');
            let color_hex = TWITTER_COLORS[color_scheme][settings.local.themeColor];
            let base_color = [color_hex.slice(1, 3), color_hex.slice(3, 5), color_hex.slice(5, 7)].map((hex) => String(Number('0x' + hex)));
            let new_colors = {base_color, text_color, background_color};
            if (!NTISAS.colors || JSPLib.utility.objectReduce(new_colors, compareColors, false)) {
                NTISAS.old_colors = NTISAS.colors;
                NTISAS.colors = new_colors;
                let color_style = RenderColorStyle(COLOR_CSS, NTISAS.colors);
                JSPLib.utility.setCSSStyle(color_style, 'color');
                JSPLib.storage.setLocalData('ntisas-color-style', NTISAS.colors);
            }
        }
    });
}

function CollectTweetStats() {
    let are_new = false;
    let tweets_collected = JSPLib.utility.getObjectAttributes(NTISAS.tweet_stats, 'tweetid');
    $('[ntisas-tweet]').each((_, entry) => {
        let tweet_id = String($(entry).data('tweet-id'));
        if (tweets_collected.includes(tweet_id)) {
            return;
        }
        NTISAS.tweet_stats.push({
            tweetid: tweet_id,
            retweet: $(entry).data('is-retweet'),
            video: Boolean($('.ntisas-tweet-video', entry).length),
            image: Boolean($('.ntisas-tweet-image', entry).length),
            replies: GetTweetStat(entry, ['reply']),
            retweets: GetTweetStat(entry, ['retweet', 'unretweet']),
            favorites: GetTweetStat(entry, ['like', 'unlike'])
        });
        are_new = true;
    });
    if (are_new) {
        InitializeTweetStats(NTISAS.tweet_type1_filter, NTISAS.tweet_type2_filter);
    }
}

//Settings functions

function BroadcastNTISAS(ev) {
    let printer = JSPLib.debug.getFunctionPrint('BroadcastNTISAS');
    printer.debuglog(`(${ev.data.type}):`, ev.data);
    switch (ev.data.type) {
        case 'postlink':
            if (ev.data.post_ids.length) {
                JSPLib.storage.setSessionData('tweet-' + ev.data.tweet_id, ev.data.post_ids);
            } else {
                JSPLib.storage.removeSessionData('tweet-' + ev.data.tweet_id);
            }
            UpdatePostIDsLink(ev.data.tweet_id, ev.data.post_ids);
            break;
        case 'database':
            JSPLib.storage.removeSessionData('ntisas-database-info');
            $(window).one('focus.ntisas.reload', () => {window.location.reload();});
            break;
        case 'currentrecords':
            JSPLib.storage.invalidateLocalData('ntisas-recent-timestamp');
            InitializeCurrentRecords();
            break;
        case 'sidemenu_ui':
            JSPLib.storage.invalidateLocalData('ntisas-side-menu');
            UpdateSideMenu(NTISAS.page, true);
            break;
        case 'sidemenu_selection':
            JSPLib.storage.invalidateLocalData('ntisas-side-selection');
            UpdateSideMenuSelection();
            break;
        case 'sidemenu_position':
            $('#ntisas-side-menu').css({left: ev.data.left, top: ev.data.top});
            break;
        case 'view_highlights':
            JSPLib.storage.invalidateLocalData('ntisas-view-highlights');
            UpdateViewHighlights();
            break;
        case 'similar_source':
            JSPLib.storage.invalidateLocalData('ntisas-similar-source');
            UpdateSimilarControls();
            break;
        case 'confirm_upload':
            JSPLib.storage.invalidateLocalData('ntisas-confirm-upload');
            UpdateConfirmUploadControls();
            break;
        case 'confirm_download':
            JSPLib.storage.invalidateLocalData('ntisas-confirm-download');
            UpdateConfirmDownloadControls();
            // falls through
        default:
            //do nothing
    }
}

function RemoteSettingsCallback() {
    setTimeout(() => {InitializeChangedSettings();}, 1);
}

function InitializeChangedSettings() {
    let $processed_tweets = $('[ntisas-tweet]');
    $processed_tweets.each((_, tweet) => {
        let $tweet = $(tweet);
        let tweet_id = String($tweet.data('tweet-id'));
        let $post_link = $('.ntisas-database-match', tweet);
        let post_ids = GetSessionTweetData(tweet_id);
        if ($post_link.length && JSPLib.menu.hasSettingChanged('advanced_tooltips_enabled')) {
            if (NTISAS.advanced_tooltips_enabled) {
                InitializePostIDsLink(tweet_id, tweet, post_ids);
            } else {
                $post_link.qtiptisas('destroy', true);
            }
        }
        if (JSPLib.menu.hasSettingChanged('display_tweet_views')) {
            if (NTISAS.display_tweet_views) {
                InitializeViewCount(tweet);
            } else {
                $(".ntisas-view-info", tweet).html("");
            }
        }
        if ($post_link.length && ((post_ids.length > 1 && JSPLib.menu.hasSettingChanged('custom_order_enabled')))) {
            $post_link.qtiptisas('destroy', true);
            InitializePostIDsLink(tweet_id, tweet, post_ids);
        }
    });
    let called_profile_callback = false;
    if (JSPLib.menu.hasSettingChanged('display_user_id')) {
        if (NTISAS.display_user_id && IsPageType(['main', 'media', 'likes', 'replies'])) {
            UpdateProfileCallback();
            called_profile_callback = true;
        } else if (!NTISAS.display_user_id) {
            $('.ntisas-profile-user-id').html("");
        }
    }
    if (JSPLib.menu.hasSettingChanged('auto_unhide_tweets_enabled') && NTISAS.auto_unhide_tweets_enabled) {
        UnhideTweets();
    }
    if (JSPLib.menu.hasSettingChanged('display_profile_views') && IsPageType(['main', 'media', 'likes', 'replies'])) {
        if (NTISAS.display_profile_views && !called_profile_callback) {
            UpdateProfileCallback();
        } else {
            $('.ntisas-profile-user-view').html("");
            $('.ntisas-profile-stream-view').html("");
        }
    }
    if (JSPLib.menu.hasSettingChanged('self_tweet_highlights') && IsPageType(['main', 'likes', 'replies'])) {
        if (NTISAS.self_tweet_highlights) {
            $('[role=main]').addClass('ntisas-self-tweet-highlights');
        } else {
            $('[role=main]').removeClass('ntisas-self-tweet-highlights');
        }
    }
    if (JSPLib.menu.hasSettingChanged('image_popout_enabled') && IsPageType(STREAMING_PAGES)) {
        $('[ntisas-tweet=stream] [ntisas-image] img').each((_, image) => {
            let $image = $(image);
            if (NTISAS.image_popout_enabled) {
                InitializeImageQtip($image);
            } else {
                $image.qtiptisas('destroy', true);
            }
        });
        NTISAS.image_anchor = {};
    }
    if (JSPLib.menu.hasSettingChanged('display_tweet_statistics') && NTISAS.display_tweet_statistics && !IsPageType(['tweet', 'web_tweet', 'other'])) {
        CollectTweetStats();
    }
    if (JSPLib.menu.hasSettingChanged('lock_page_enabled')) {
        if (NTISAS.lock_page_enabled && NTISAS.page_locked) {
            $(window).on('beforeunload.ntisas.lock_page', () => "");
        } else {
            $(window).off('beforeunload.ntisas.lock_page');
        }
    }
    if (JSPLib.menu.hasSettingChanged('media_timeline_enabled') && !NTISAS.media_timeline_enabled) {
        $('.ntisas-media-icon-container').remove();
        $('.ntisas-media-view-icon').remove();
        $('.ntisas-media-tweet').removeClass('ntisas-media-tweet');
    }
    if (JSPLib.menu.hasSettingChanged('query_subdomain')) {
        let old_domain = NTISAS.domain;
        SetQueryDomain();
        $(`[href^="${old_domain}"]`).each((_, entry) => {
            entry.href = NTISAS.domain + entry.pathname + entry.search;
        });
    }
    if (JSPLib.menu.hasSettingChanged('SauceNAO_API_key')) {
        SetSauceAPIKey();
    }
    if (JSPLib.menu.hasSettingChanged('use_alternate_tweets_API')) {
        JSPLib.notice.notice("Changing the API endpoint requires a page refresh.", true);
    }
    InitializeSideMenu();
}

function OpenSettingsMenu() {
    if (!NTISAS.opened_menu) {
        if ($('#new-twitter-image-searches-and-stuff').length === 0) {
            RenderSettingsMenu_T();
        }
        $('#new-twitter-image-searches-and-stuff').dialog('open');
    }
}

function CloseSettingsMenu() {
    if (NTISAS.opened_menu) {
        GetMenuCloseButton().click();
    }
}

function SaveSettingsMenu() {
    if (NTISAS.opened_menu) {
        $('#ntisas-commit').click();
    }
}

function ResetSettingsMenu() {
    if (NTISAS.opened_menu) {
        $('#ntisas-resetall').click();
    }
}

function SetQueryDomain() {
    NTISAS.domain = 'https://' + NTISAS.query_subdomain + '.donmai.us';
}

function SetSauceAPIKey() {
    JSPLib.saucenao.api_key = NTISAS.SauceNAO_API_key;
}

function SetGraphQLEndpoints() {
    NTISAS.use_media_timeline_endpoint = NTISAS.use_alternate_tweets_API;
}

function IsQuerySettingEnabled(setting, type) {
    const prefix_lookup = {
        danbooru: 'IQDB',
        saucenao: 'sauce',
    };
    let setting_prefix = prefix_lookup[type];
    let setting_key = setting_prefix + '_settings';
    return NTISAS.user_settings[setting_key].includes(setting);
}

function GetMenuCloseButton() {
    return $('#new-twitter-image-searches-and-stuff').closest('.ntisas-dialog').find('.ntisas-dialog-close');
}

function InitializeDialogButtons() {
    $('.ntisas-dialog .ui-dialog-buttonset .ui-button').each((_, entry) => {
        let key = entry.innerText;
        for (let attribute in MENU_DIALOG_BUTTONS[key]) {
            $(entry).attr(attribute, MENU_DIALOG_BUTTONS[key][attribute]);
        }
    });
    GetMenuCloseButton().attr('title', CLOSE_HELP);
}

function InitializeProgramValues() {
    Object.assign(NTISAS, {
        intersection_observer: new IntersectionObserver(CheckViews, {threshold: 0.75}),
        seen_observer: new IntersectionObserver(SeenTweet, {threshold: 0.10}),
    });
    SetQueryDomain();
    SetSauceAPIKey();
    SetGraphQLEndpoints();
}

//Only render the settings menu on demand
function RenderSettingsMenu() {
    //Create the dialog
    $('body').append(SETTINGS_MENU);
    $('#new-twitter-image-searches-and-stuff').dialog(MENU_DIALOG_SETTINGS);
    InitializeDialogButtons();
    //Standard menu creation
    $('#new-twitter-image-searches-and-stuff').append(NTISAS_MENU);
    $('#ntisas-display-settings').append(JSPLib.menu.renderCheckbox('display_tweet_views'));
    $('#ntisas-display-settings').append(JSPLib.menu.renderCheckbox('display_profile_views'));
    $('#ntisas-display-settings').append(JSPLib.menu.renderCheckbox('self_tweet_highlights'));
    $('#ntisas-display-settings').append(JSPLib.menu.renderCheckbox('display_user_id'));
    $('#ntisas-display-settings').append(JSPLib.menu.renderCheckbox('display_image_number'));
    $('#ntisas-display-settings').append(JSPLib.menu.renderCheckbox('display_tweet_statistics'));
    $('#ntisas-display-settings').append(JSPLib.menu.renderCheckbox('display_available_sauce'));
    $('#ntisas-display-settings').append(JSPLib.menu.renderCheckbox('display_network_errors'));
    $('#ntisas-function-settings').append(JSPLib.menu.renderCheckbox('media_timeline_enabled'));
    $('#ntisas-function-settings').append(JSPLib.menu.renderCheckbox('advanced_tooltips_enabled'));
    $('#ntisas-function-settings').append(JSPLib.menu.renderCheckbox('image_popout_enabled'));
    $('#ntisas-function-settings').append(JSPLib.menu.renderCheckbox('auto_unhide_tweets_enabled'));
    $('#ntisas-function-settings').append(JSPLib.menu.renderCheckbox('lock_page_enabled'));
    $("#ntisas-query-message").append(JSPLib.menu.renderExpandable("Additional setting details", QUERY_SETTINGS_DETAILS));
    $('#ntisas-query-settings').append(JSPLib.menu.renderInputSelectors('IQDB_settings', 'checkbox'));
    $('#ntisas-query-settings').append(JSPLib.menu.renderInputSelectors('sauce_settings', 'checkbox'));
    $('#ntisas-query-settings').append(JSPLib.menu.renderTextinput('similarity_cutoff', 10));
    $('#ntisas-query-settings').append(JSPLib.menu.renderTextinput('results_returned', 10));
    $('#ntisas-query-settings').append(JSPLib.menu.renderTextinput('SauceNAO_API_key', 80));
    $('#ntisas-network-settings').append(JSPLib.menu.renderCheckbox('URL_wildcards_enabled'));
    $('#ntisas-network-settings').append(JSPLib.menu.renderCheckbox('custom_order_enabled'));
    $('#ntisas-network-settings').append(JSPLib.menu.renderTextinput('recheck_interval', 5));
    $('#ntisas-network-settings').append(JSPLib.menu.renderInputSelectors('query_subdomain', 'radio'));
    $('#ntisas-network-settings').append(JSPLib.menu.renderCheckbox('use_alternate_tweets_API'));
    $('#ntisas-download-settings').append(JSPLib.menu.renderTextinput('filename_prefix_format', 80));
    $('#ntisas-database-controls').append(IMPORT_FILE_INPUT);
    $('#ntisas-database-controls').append(JSPLib.menu.renderLinkclick('import_data', true));
    $('#ntisas-database-controls').append(JSPLib.menu.renderInputSelectors('export_types', 'checkbox', true));
    $('#ntisas-database-controls').append(JSPLib.menu.renderLinkclick('export_data', true));
    $('#ntisas-database-controls').append(IMPORT_ERROR_DISPLAY);
    $('#ntisas-cache-controls').append(JSPLib.menu.renderLinkclick('cache_info', true));
    $('#ntisas-cache-controls').append(JSPLib.menu.renderCacheInfoTable());
    $('#ntisas-cache-controls').append(JSPLib.menu.renderLinkclick('purge_cache', true));
    //Engage jQuery UI
    JSPLib.menu.engageUI(true);
    $('#ntisas-settings').tabs();
    //Set event handlers
    JSPLib.menu.saveUserSettingsClick(InitializeChangedSettings);
    JSPLib.menu.resetUserSettingsClick(LOCALSTORAGE_KEYS, InitializeChangedSettings);
    $('#ntisas-control-import-data').on(PROGRAM_CLICK, ImportData);
    $('#ntisas-control-export-data').on(PROGRAM_CLICK, ExportData);
    JSPLib.menu.cacheInfoClick();
    JSPLib.menu.expandableClick();
    JSPLib.menu.purgeCacheClick();
    //Fixup forum links
    $('.ntisas-forum-topic-link').attr('href', `${NTISAS.domain}/forum_topics/${DANBOORU_TOPIC_ID}`);
    //Add CSS stylings
    JSPLib.utility.setCSSStyle(JSPLib.menu.settings_css, 'menu_settings');
    JSPLib.utility.setCSSStyle(MENU_CSS, 'menu');
    JSPLib.utility.recheckTimer({
        check: () => JSPLib.validate.isHash(NTISAS.colors),
        exec: () => {
            let color_style = RenderColorStyle(MENU_COLOR_CSS, NTISAS.colors);
            JSPLib.utility.setCSSStyle(color_style, 'menu_color');
        }
    }, TIMER_POLL_INTERVAL);
    InitializeUIStyle();
}

//Main function

async function Main() {
    JSPLib.network.jQuerySetup();
    jQuery.ajaxSetup({timeout: JSPLib.utility.one_second * 10});
    JSPLib.menu.preloadScript(NTISAS, {
        danbooru_userscript: false,
        default_data: PROGRAM_DEFAULT_VALUES,
        reset_data: PROGRAM_RESET_KEYS,
        initialize_func: InitializeProgramValues,
        broadcast_func: BroadcastNTISAS,
        program_css: PROGRAM_CSS,
        menu_css: MENU_CSS,
    });
    await InitializelUserProfileData();
    $(document).on(PROGRAM_CLICK, '.ntisas-tweet-header a', ToggleSideMenu);
    $(document).on(PROGRAM_CLICK, '.ntisas-control-search', SearchMenu);
    $(document).on(PROGRAM_RCLICK, '.ntisas-control-search', SearchControl);
    $(document).on(PROGRAM_CLICK, '.ntisas-control-confirm', ConfirmControl);
    $(document).on(PROGRAM_CLICK, '.ntisas-control-upload', UploadMenu);
    $(document).on(PROGRAM_CLICK, '.ntisas-control-download', DownloadMenu);
    $(document).on(PROGRAM_RCLICK, '.ntisas-control-download', DownloadControl);
    $(document).on(PROGRAM_CLICK, '.ntisas-download-media.ntisas-active', DownloadLink);
    $(document).on(PROGRAM_CLICK, '.ntisas-manual-add', ManualAdd);
    $(document).on(PROGRAM_CLICK, '.ntisas-help-info', HelpInfo);
    $(document).on(PROGRAM_CLICK, '.ntisas-image-container a', SelectPreview);
    $(document).on(PROGRAM_CLICK, '.ntisas-select-controls a', SelectControls);
    $(document).on(PROGRAM_CLICK, '.ntisas-metric', SelectMetric);
    $(document).on(PROGRAM_CLICK, '.ntisas-toggle-image-size', ToggleImageSize);
    $(document).on(PROGRAM_KEYDOWN, null, 'alt+q', ToggleSimilarSource);
    $(document).on(PROGRAM_KEYDOWN, null, 'alt+v', ToggleViewHighlights);
    $(document).on(PROGRAM_KEYDOWN, null, 'alt+m', OpenSettingsMenu);
    $(document).on(PROGRAM_KEYDOWN, null, 'alt+c', CloseSettingsMenu);
    $(document).on(PROGRAM_KEYDOWN, null, 'alt+s', SaveSettingsMenu);
    $(document).on(PROGRAM_KEYDOWN, null, 'alt+r', ResetSettingsMenu);
    $(document).on(PROGRAM_KEYDOWN, null, 'alt+0', ToggleSideMenu);
    $(document).on(PROGRAM_KEYDOWN, null, 'alt+1 alt+2 alt+3', SideMenuHotkeys);
    setInterval(IntervalStorageHandler, QUEUE_POLL_INTERVAL);
    setInterval(IntervalNetworkHandler, QUEUE_POLL_INTERVAL);
    InitializeSaveDatabaseBatches();
    InitializeColorScheme();
    JSPLib.notice.installBanner(PROGRAM_SHORTCUT);
    JSPLib.utility.setCSSStyle(NOTICE_CSS, 'notice');
    JSPLib.utility.setCSSStyle(GM_getResourceText('jquery_qtip_css'), 'qtip');
    JSPLib.utility.initializeInterval(RegularCheck, PROGRAM_RECHECK_INTERVAL);
    JSPLib.statistics.addPageStatistics(PROGRAM_NAME);
    JSPLib.load.noncriticalTasks(InitializeCleanupTasks);
}

/****Function decoration****/

const [
    RenderSettingsMenu_T, SaveDatabase_T, GetSavePackage_T, CheckPostvers_T,
] = JSPLib.debug.addFunctionTimers([
    RenderSettingsMenu, SaveDatabase, GetSavePackage, CheckPostvers,
]);

/****Initialization****/

//Variables for debug.js
JSPLib.debug.debug_console = false;
JSPLib.debug.level = JSPLib.debug.INFO;
JSPLib.debug.program_shortcut = PROGRAM_SHORTCUT;

//Variables for menu.js
JSPLib.menu.program_shortcut = PROGRAM_SHORTCUT;
JSPLib.menu.program_name = PROGRAM_NAME;
JSPLib.menu.program_data = NTISAS;
JSPLib.menu.program_reset_data = PROGRAM_RESET_KEYS;
JSPLib.menu.program_data_regex = PROGRAM_DATA_REGEX;
JSPLib.menu.settings_config = SETTINGS_CONFIG;
JSPLib.menu.control_config = CONTROL_CONFIG;

//Variables for storage.js
JSPLib.storage.localSessionValidator = ValidateProgramData;
JSPLib.storage.indexedDBValidator = ValidateEntry;
JSPLib.storage.prune_limit = 2000;

//Variables for validate.js
JSPLib.validate.dom_output = '#ntisas-import-data-errors';

//variables for network.js
JSPLib.network.error_domname = '#ntisas-error-messages';
JSPLib.network.rate_limit_wait = JSPLib.utility.one_second;

//Variables for danbooru.js
JSPLib.danbooru.max_network_requests = 10;

//Variables for notice.js
JSPLib.notice.program_shortcut = PROGRAM_SHORTCUT;

//Variables for load.js
JSPLib.load.load_when_hidden = false;

//Export JSPLib
JSPLib.load.exportData(PROGRAM_NAME, NTISAS, {other_data: {jQuery, SAVED_STORAGE_REQUESTS, SAVED_NETWORK_REQUESTS, PAGE_REGEXES}, datalist: ['page']});
JSPLib.load.exportFuncs(PROGRAM_NAME, {debuglist: [GetData, SaveData], alwayslist: [GetImageLinks, GetImageData]});

/****Execution start****/

JSPLib.load.programInitialize(Main, {program_name: PROGRAM_NAME, required_selectors: PROGRAM_LOAD_REQUIRED_SELECTORS, max_retries: 100, timer_interval: 500});
