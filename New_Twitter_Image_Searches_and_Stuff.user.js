// ==UserScript==
// @name         New Twitter Image Searches and Stuff
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      9.0
// @description  Searches Danbooru database for tweet IDs, adds image search links, and highlights images based on Tweet favorites.
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        https://twitter.com/*
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/New_Twitter_Image_Searches_and_Stuff.user.js
// @updateURL    https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/New_Twitter_Image_Searches_and_Stuff.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
// @require      https://cdn.jsdelivr.net/npm/jquery-hotkeys@0.2.2/jquery-hotkeys.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.13.1/validate.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.10.0/localforage.min.js
// @require      https://cdn.jsdelivr.net/npm/localforage-getitems@1.4.2/dist/localforage-getitems.min.js
// @require      https://cdn.jsdelivr.net/npm/localforage-setitems@1.4.0/dist/localforage-setitems.min.js
// @require      https://cdn.jsdelivr.net/npm/localforage-removeitems@1.4.0/dist/localforage-removeitems.min.js
// @require      https://cdn.jsdelivr.net/npm/xregexp@5.1.0/xregexp-all.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/custom-20190305/custom/qtip_tisas.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/module.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/notice.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/concurrency.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/saucenao.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/menu.js
// @resource     jquery_ui_css https://raw.githubusercontent.com/BrokenEagle/JavaScripts/custom-20190305/custom/jquery_ui_custom.css
// @resource     jquery_qtip_css https://raw.githubusercontent.com/BrokenEagle/JavaScripts/custom-20190305/custom/qtip_tisas.css
// @grant        GM_getResourceText
// @grant        GM.xmlHttpRequest
// @connect      donmai.us
// @connect      saucenao.com
// @connect      twimg.com
// @connect      api.twitter.com
// @connect      google.com
// @connect      googleusercontent.com
// @run-at       document-body
// @noframes
// ==/UserScript==

// eslint-disable-next-line no-redeclare
/* global $ jQuery JSPLib validate localforage saveAs XRegExp GM_getResourceText BigInt */

/****Global variables****/

//Library constants

////NONE

//Exterior script variables

const DANBOORU_TOPIC_ID = '16342';

//Variables for load.js
const PROGRAM_LOAD_REQUIRED_SELECTORS = ['[role=region]'];

//Program name constants
const PROGRAM_FULL_NAME = "New Twitter Image Searches and Stuff";
const PROGRAM_NAME = 'NTISAS';
const PROGRAM_SHORTCUT = 'ntisas';
const PROGRAM_CLICK = 'click.ntisas';
const PROGRAM_KEYDOWN = 'keydown.ntisas';

//Variables for network.js
const API_DATA = {tweets: {}, users_id: {}, users_name: {}, retweets: {}, has_data: false, raw_data: []};

//Variables for storage.js
JSPLib.storage.twitterstorage = localforage.createInstance({
    name: 'Twitter storage',
    driver: [localforage.INDEXEDDB]
});

//Main program variable
const NTISAS = {};

//Program data constants
const PROGRAM_DATA_REGEX = /^(post|view|iqdb|sauce|video|tweet|twuser|ntisas-available-sauce)-/; //Regex that matches the prefix of all program cache data

//For factory reset !!!These need to be set!!!
const LOCALSTORAGE_KEYS = [
    'ntisas-side-selection',
    'ntisas-database-length',
    'ntisas-remote-database',
    'ntisas-user-data',
    'ntisas-color-style',
    'ntisas-recent-timestamp',
    //Boolean
    'ntisas-purge-bad',
    'ntisas-overflow',
    //Last ID
    'ntisas-postver-lastid',
    'ntisas-badver-lastid',
    //Timeouts
    'ntisas-timeout',
    'ntisas-database-recheck',
    'ntisas-length-recheck',
    'ntisas-badver-recheck',
    'ntisas-user-profile-recheck',
    'ntisas-prune-expires',
    //Semaphore
    'ntisas-process-semaphore-checkuser',
    'ntisas-process-semaphore-purgebad',
    'ntisas-process-semaphore-badvers',
    'ntisas-process-semaphore-records',
    'ntisas-process-semaphore-checkpost',
    'ntisas-process-semaphore-postvers',
];
const PROGRAM_RESET_KEYS = {
    tweet_pos: [],
    tweet_faves: [],
    tweet_finish: {},
    page_stats: {},
};
const PROGRAM_DEFAULT_VALUES = {
    lists: {},
    update_profile: {},
    tweet_images: {},
    tweet_index: {},
    tweet_qtip: {},
    image_anchor: {},
    qtip_anchor: {},
    image_data: {},
    timeline_tweets: {},
    tweet_dialog: {},
    dialog_ancor: {},
    media_dialog: {},
    media_dialog_anchor: {},
    similar_results: {},
    known_extensions: {},
    no_url_results: [],
    merge_results: [],
    recorded_views: [],
    photo_index: null,
    photo_navigation: false,
    artist_iqdb_enabled: false,
    opened_menu: false,
    colors_checked: false,
    page_locked: false,
    import_is_running: false,
    update_user_timer: null,
};

//Settings constants
const COMMON_QUERY_SETTINGS = ['pick_image', 'confirm_save', 'auto_save'];
const DEFAULT_QUERY_SETTINGS = ['pick_image', 'confirm_save'];
const ALL_SCORE_LEVELS = ['excellent', 'good', 'aboveavg', 'fair', 'belowavg', 'poor'];
const SUBDOMAINS = ['danbooru', 'kagamihara', 'saitou', 'shima', 'betabooru'];

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
        allitems: SUBDOMAINS,
        reset: ['danbooru'],
        validate: (data) => JSPLib.menu.validateCheckboxRadio(data, 'radio', SUBDOMAINS),
        hint: "Select which subdomain of Danbooru to query from. <b>Note:</b> The chosen subdomain must be logged into or the script will fail to work."
    },
    use_graphql: {
        display: "Use GraphQL",
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Select whether to use the GraphQL endpoint instead of the API endpoint for network requests."
    },
    bypass_server_mode: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Operates without information from the tweet server database. <b>Note:</b> Should only be used when the server is unreachable."
    },
    autoclick_IQDB_enabled: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: `Will automatically trigger the <b>IQDB</b> links (limited availability, see <a class="ntisas-forum-topic-link" target="_blank">topic #${DANBOORU_TOPIC_ID}</a> for details). <b>Note:</b> Any results are saved automatically.`
    },
    auto_unhide_tweets_enabled: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Automatically unhides sensitive Tweet content."
    },
    display_retweet_id: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays the retweet ID next to the retweeter's name. <b>Note:</b> Only available with access to Twitter's API."
    },
    display_tweet_views: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays the the number of times a tweet has been seen."
    },
    display_profile_views: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays the the number of times a user/timeline has been seen."
    },
    display_user_id: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays the user ID above the username on the Tweet view. <b>Note:</b> Only available with access to Twitter's API."
    },
    display_media_link: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays a link to the media/likes timeline in the tweet view."
    },
    display_image_number: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays the image number used by <b>Download Originals</b>."
    },
    display_upload_link: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays an <b>Upload</b> link to Danbooru in the enlarged image view."
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
    score_highlights_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: `Adds colored borders and other stylings based upon the Tweet score (limited availability, see <a class="ntisas-forum-topic-link" target="_blank">topic #${DANBOORU_TOPIC_ID}</a> for details).`
    },
    media_timeline_enabled: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Processes tweets on the grid media timeline (uses additional network calls)."
    },
    advanced_tooltips_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays extra information and thumbnails on IQDB results. <b>Note:</b> Only when the data is not auto-saved."
    },
    score_window_size: {
        reset: 40,
        parse: parseInt,
        validate: (data) => Number.isInteger(data) && data >= 10,
        hint: "Valid values: >= 10. The number of surrounding tweets to consider when calculating levels."
    },
    original_download_enabled: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Shows download links for the original images on the Tweet view with customizable filename prefixes."
    },
    filename_prefix_format: {
        reset: "%TWEETID%--%IMG%",
        parse: String,
        validate: JSPLib.validate.isString,
        hint: "Prefix to add to original image downloads. Available format keywords include:<br><span class=\"ntisas-code\">%TWEETID%, %USERID%, %USERACCOUNT%, %IMG%, %DATE%, %TIME%, %ORDER%</span>."
    },
};

const ALL_LIST_TYPES = ['iqdb'];
const ALL_IMPORT_TYPES = ['program_data', 'tweet_database'];
const CONTROL_CONFIG = {
    select_list: {
        allitems: ALL_LIST_TYPES,
        value: [],
        hint: "Select which lists to affect.",
    },
    reset_list: {
        value: "Click to reset",
        hint: "Resets the selected lists to a blank state.",
    },
    list_info: {
        value: "Click to populate",
        hint: "Displays the current sizes for all lists.",
    },
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
const TWITTER_SPACING_CLASSES = [
    'r-1vvnge1', //padding for Twitter icon
    'r-1ag2gil', 'r-oyd9sg', //padding for side menu items
    'r-vpgt9t', 'r-jw8lkh', //padding for tweet button
];
const TWITTER_SPACING_SELECTOR = JSPLib.utility.joinList(TWITTER_SPACING_CLASSES, '#ntisas-account-options.ntisas-activated .', null, ',');

const PROGRAM_CSS = `
:root {
    --menu-height: 200px;
}
.ntisas-horizontal-rule {
    border-top: 1px solid grey;
    margin: 10px;
}
.ntisas-expanded-link {
   display: inline-block;
   position: relative;
   z-index: 1;
   padding: 8px;
   margin: -8px;
}
[ntisas-highlight] {
    position: relative;
}
.ntisas-highlight-border {
    display: none;
    position: absolute;
}
[ntisas-highlight] .ntisas-highlight-border {
    display: block;
}
.ntisas-highlight-left {
    top: -4px;
    left: 0;
    width: 10px;
    height: 100%;
}
.ntisas-highlight-right {
    top: -4px;
    right: 0;
    width: 10px;
    height: 100%;
}
.ntisas-highlight-top {
    top: -6px;
    left: 0;
    width: 100%;
    height: 10px;
}
.ntisas-highlight-bottom {
    bottom: 4px;
    left: 0;
    width: 100%;
    height: 10px;
}
[ntisas-highlight=excellent] .ntisas-highlight-border {
    background-color: green;
}
[ntisas-highlight=good] .ntisas-highlight-border {
    background-color: orange;
}
[ntisas-highlight=aboveavg] .ntisas-highlight-border {
    background-color: green;
}
[ntisas-highlight=fair] .ntisas-highlight-border {
    background-color: blue;
}
[ntisas-highlight=belowavg] .ntisas-highlight-border {
    background-color: purple;
}
[ntisas-highlight=poor] .ntisas-highlight-border {
    background-color: black;
}
.ntisas-show-views .ntisas-viewed .ntisas-tweet-left {
    border: 1px solid;
    border-radius: 25px;
    height: calc(100% - var(--menu-height));
}
.ntisas-code {
    font-family: monospace;
}
#ntisas-database-version,
#ntisas-install,
#ntisas-upgrade {
    color: #0073ff;
}
[ntisas-tweet] .ntisas-no-sources {
    letter-spacing: -1px;
}
[ntisas-tweet] .ntisas-database-match,
[ntisas-tweet] .ntisas-database-match:hover,
[ntisas-tweet] .ntisas-database-match:focus,
[ntisas-tweet] [ntisas-similar-match=great],
[ntisas-tweet] [ntisas-similar-match=great]:hover,
[ntisas-tweet] [ntisas-similar-match=great]:focus {
    color: green;
}
[ntisas-tweet] [ntisas-similar-match=good],
[ntisas-tweet] [ntisas-similar-match=good]:hover,
[ntisas-tweet] [ntisas-similar-match=good]:focus {
    color: blue;
}
[ntisas-tweet] [ntisas-similar-match=fair],
[ntisas-tweet] [ntisas-similar-match=fair]:hover,
[ntisas-tweet] [ntisas-similar-match=fair]:focus {
    color: orange;
}
[ntisas-tweet] [ntisas-similar-match=poor],
[ntisas-tweet] [ntisas-similar-match=poor]:hover,
[ntisas-tweet] [ntisas-similar-match=poor]:focus {
    color: red;
}
[ntisas-tweet] .ntisas-manual-add,
[ntisas-tweet] .ntisas-manual-add:hover,
[ntisas-tweet] .ntisas-database-no-match,
[ntisas-tweet] .ntisas-database-no-match:hover,
[ntisas-tweet] .ntisas-cancel-merge,
[ntisas-tweet] .ntisas-cancel-merge:hover {
    color: red;
}
[ntisas-tweet] .ntisas-check-url,
[ntisas-tweet] .ntisas-check-url:hover,
[ntisas-tweet] .ntisas-check-iqdb,
[ntisas-tweet] .ntisas-check-iqdb:hover,
[ntisas-tweet] .ntisas-check-sauce,
[ntisas-tweet] .ntisas-check-sauce:hover,
[ntisas-tweet] .ntisas-merge-results,
[ntisas-tweet] .ntisas-merge-results:hover,
#ntisas-current-records,
#ntisas-error-messages,
#ntisas-total-records {
    color: grey;
}
.ntisas-media-tweet .ntisas-media-icon-container {
    bottom: 10px;
    right: 10px;
    margin: -8px;
    padding: 8px;
    position: absolute;
}
.ntisas-media-tweet .ntisas-media-icon {
    width: 35px;
    height: 20px;
    border-radius: 25px;
    background-color: white;
    border: 1px solid black;
}
.ntisas-media-tweet .ntisas-media-icon-section {
    display: inline-block;
    width: 50%;
    height: 100%;
    font-family: monospace;
    font-weight: bold;
    text-align: center;
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
.ntisas-media-menu .ntisas-media-images {
    display: flex;
    flex-wrap: wrap;
    margin: 20px;
}
.ntisas-media-menu .ntisas-media-images .ntisas-media-image,
.ntisas-media-menu .ntisas-media-images .ntisas-media-video {
    display: inline-block;
    margin: 20px;
    width: 240px;
    height: 240px;
    text-align: center;
    box-shadow: 0 0 0 4px #fff, 0 0 0 6px #eee;
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
#ntisas-server-bypass,
#ntisas-active-autoiqdb,
#ntisas-unavailable-autoiqdb {
    font-style: italic;
    letter-spacing: 1px;
}
[ntisas-tweet] .ntisas-check-url,
[ntisas-tweet] .ntisas-check-iqdb,
[ntisas-tweet] .ntisas-check-sauce,
#ntisas-views-toggle {
    display: inline-block;
    text-align: center;
}
#ntisas-views-toggle a,
#ntisas-iqdb-toggle a {
    display: none;
}
#ntisas-enable-downloads,
#ntisas-enable-view-highlights,
#ntisas-enable-view-counts,
#ntisas-enable-autoiqdb,
#ntisas-disable-lockpage {
    color: green;
}
#ntisas-disable-downloads,
#ntisas-disable-view-highlights,
#ntisas-disable-view-counts,
#ntisas-disable-autoiqdb,
#ntisas-enable-lockpage {
    color: red;
}
#ntisas-side-menu {
    font-size: 14px;
    margin-top: 10px;
    width: 285px;
    height: 475px;
    font-family: ${FONT_FAMILY};
}
#ntisas-side-border {
    border: solid lightgrey 1px;
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
#ntisas-version-header,
#ntisas-database-version {
    letter-spacing: -0.5px;
}
#ntisas-install,
#ntisas-upgrade,
#ntisas-current-records {
    letter-spacing: -1px;
}
#ntisas-menu-header {
    margin: 8px -10px 0;
    padding: 2px;
    font-size: 18px;
    font-weight: bold;
    line-height: 1;
    letter-spacing: -1px;
    transform: scaleX(0.9);
    text-decoration: underline;
}
#ntisas-stats-header {
    margin: 8px;
    font-size: 18px;
    font-weight: bold;
    line-height: 0.9;
}
#ntisas-stats-header span {
    text-decoration: underline;
}
#ntisas-tweet-stats-message {
    font-size: 14px;
    font-weight: bold;
    padding: 0 0.5em 0.5em;
}
#ntisas-open-settings {
    margin: 0.5em;
}
#ntisas-open-settings input {
    font-weight: bold;
    width: 19.5em;
}
.ntisas-image-section {
    margin-top: 0.2em;
    min-height: 2.2em;
    padding-left: 0.5em;
}
[ntisas-tweet=main] .ntisas-image-section {
    font-size: 1.1em;
}
.ntisas-query-button {
    display: inline-block;
    text-align: center;
    min-width: 5em;
    border: 1px solid;
    padding: 4px;
}
[ntisas-tweet=main] .ntisas-query-button {
    margin: 0 -7px;
}
[ntisas-tweet=stream] .ntisas-query-button,
[ntisas-tweet=media] .ntisas-query-button {
    margin: 0 -6px 0 -5px;
}
.ntisas-query-button a {
    min-width: 100%;
}
.ntisas-download-section {
    font-size: 14px;
    font-family: ${FONT_FAMILY};
    line-height: 30px;
    letter-spacing: .01em;
    white-space: normal;
}
[ntisas-tweet=stream] .ntisas-download-section,
[ntisas-tweet=media] .ntisas-download-section {
    margin-top: 0.4em;
}
[ntisas-tweet=main] .ntisas-download-section {
    margin-top: 0.2em;
}
.ntisas-download-button {
    display: inline-block;
    border: 2px solid;
    border-radius: 10px;
    margin: 0 0.3em;
    padding: 0 0.4em;
}
.ntisas-download-button a {
    color: white;
    font-weight: bold;
}
.ntisas-links a {
    cursor: pointer;
    text-decoration: none;
}
.ntisas-links a:hover {
    text-decoration: underline;
}
.ntisas-download-header {
    font-size: 90%;
    text-decoration: underline;
}
.qtiptisas.ntisas-preview-tooltip,
.qtiptisas.ntisas-image-tooltip {
    max-width: none;
}
.ntisas-preview-tooltip .qtiptisas-content {
    max-width: 1000px;
    max-height: 500px;
    overflow-y: auto;
}
.ntisas-image-tooltip .qtiptisas-content,
.ntisas-image-tooltip .qtiptisas-content img {
    max-width: 900px;
}

.ntisas-similar-result,
.ntisas-post-result {
    font-family: ${FONT_FAMILY};
}
.ntisas-similar-result h4,
.ntisas-post-result h4 {
    margin-top: 0;
    margin-bottom: 5px;
    font-size: 16px;
    font-weight: bold;
}
.ntisas-vr {
    display: inline-block;
    border-left: 1px solid #DDD;
    height: 200px;
}
.ntisas-confirm-image > p {
    font-weight: 12px;
    padding: 6px;
}
.ntisas-confirm-image b {
    font-weight: bold;
}
.ntisas-post-preview {
    display: inline-block;
    width: ${BASE_PREVIEW_WIDTH}px;
    text-align: center;
    font-family: ${FONT_FAMILY};
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
.ntisas-image-container {
    height: ${POST_PREVIEW_DIMENSION}px;
    width: ${POST_PREVIEW_DIMENSION}px;
    border: solid transparent 5px;
}
.ntisas-post-result .ntisas-post-select.ntisas-post-match .ntisas-image-container,
.ntisas-similar-result .ntisas-post-select.ntisas-post-match .ntisas-image-container {
    border: solid green 5px;
}
.ntisas-post-result .ntisas-image-container,
.ntisas-similar-result .ntisas-image-container {
    border: solid black 5px;
}
.ntisas-post-result .ntisas-post-select .ntisas-image-container,
.ntisas-similar-result .ntisas-post-select .ntisas-image-container,
.ntisas-similar-result .ntisas-tweet-preview .ntisas-image-container {
    border: solid transparent 5px;
}
.ntisas-confirm-image .ntisas-post-select .ntisas-image-container {
    border: solid blue 5px;
}
.ntisas-desc {
    font-size:12px;
    margin-bottom: 2px;
    margin-top: 0;
}
.ntisas-desc-info {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.ntisas-desc-size {
    letter-spacing: -1px;
}
.ntisas-timeline-menu {
    font-size: 13px;
    letter-spacing: -1px;
    font-weight: bold;
    min-width: 250px;
    font-family: ${FONT_FAMILY};
}
.ntisas-tweet-menu {
    font-weight: bold;
    font-family: ${FONT_FAMILY};
}
.ntisas-upload {
    font-size: 20px;
    font-weight: bold;
    width: 50px;
    margin-left: 50px;
    padding-top: 10px;
    font-family: ${FONT_FAMILY};
}
.ntisas-upload a {
    color: rgba(255,255,255,0.8);
    text-decoration: none;
}
.ntisas-upload a:hover {
    text-decoration: underline;
}
.ntisas-help-info,
.ntisas-help-info:hover {
    color: hotpink !important;
}
.ntisas-main-links {
    margin: 0 0.5em;
}
.ntisas-media-link {
    font-size: 14px;
    font-weight: bold;
    border: 1px solid;
    border-radius: 20px;
    padding: 8px 16px;
    font-family: ${FONT_FAMILY};
    text-decoration: none;
}
.ntisas-media-icon:hover {
    box-shadow: 0 0 0 2px;
}
[ntisas-tweet=main] .ntisas-tweet-status {
    display: inline-block;
    height: 34px;
}
.ntisas-tweet-status > .ntisas-status-marker {
    margin-left: 3.75em;
    display: flex;
    padding-top: 2px;
}
.ntisas-retweet-marker {
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    display: inline-block;
    white-space: nowrap;
}
[ntisas-tweet=stream] .ntisas-tweet-actions .r-n6v787 {
    font-size: 10px;
}
.ntisas-retweet-id {
    font-size: 12px;
}
.ntisas-view-info,
.ntisas-profile-section {
    font-size: 12px;
    font-family: monospace;
    letter-spacing: -1px;
}
.ntisas-profile-section {
    display: flex;
    flex-direction: column;
    margin-left: 1em;
    margin-top: auto;
}
.ntisas-profile-user-id,
.ntisas-profile-user-view,
.ntisas-profile-stream-view {
    display: flex;
    border-bottom: 1px solid #CCC;
}
.ntisas-profile-user-view {
    border-bottom: 1px solid #CCC;
}
.ntisas-user-id {
    font-size: 12px;
}
.ntisas-indicators {
    font-family: 'MS Gothic', 'Meiryo UI';
    font-size: 16px;
    font-weight: bold;
    margin: 0 5px;
}
[ntisas-tweet=main] .ntisas-tweet-media,
[ntisas-tweet=main] .ntisas-time-line {
    margin-bottom: 10px;
}
[ntisas-tweet=main] .ntisas-tweet-header {
    padding: 5px 6px;
}
[ntisas-tweet=stream] .ntisas-tweet-header,
[ntisas-tweet=media] .ntisas-tweet-header {
    padding: 4px 6px;
}
.ntisas-tweet-header {
    font-family: ${FONT_FAMILY};
    font-size: 1.4em;
    font-weight: bold;
    text-align: center;
    border-right: 1px solid;
    border-bottom: 1px solid;
}
.ntisas-tweet-header a {
    padding: 8px 12px;
    margin: -8px -12px;
}
.ntisas-download-header {
    font-family: ${FONT_FAMILY};
    font-size: 110%;
    font-weight: bold;
    letter-spacing: -1px;
    transform: scaleX(0.9);
    margin: 0.6em 0;
}
.ntisas-footer-entries {
    font-size: 16px;
    font-weight: bold;
    font-family: ${FONT_FAMILY};
}
[ntisas-tweet=main] .ntisas-footer-entries {
    border-top-width: 1px;
    border-top-style: solid;
    padding: 5px 0 20px;
}
[ntisas-tweet=stream] .ntisas-footer-entries {
    margin-top: 10px;
}
[ntisas-tweet=stream] .ntisas-footer-section {
    margin-bottom: 0.5em;
}
[ntisas-tweet=stream] .ntisas-link-menu,
[ntisas-tweet=media] .ntisas-link-menu {
    font-size: 1.125em;
}
[ntisas-tweet=stream] .ntisas-tweet-controls {
    margin-top: 0.5em;
    margin-left: -4em;
}
.ntisas-activated,
.ntisas-activated:hover {
    color: unset;
}
#ntisas-tweet-stats-table {
    margin: 0.5em;
}
#ntisas-tweet-stats-table table {
    width: 95%;
    text-align: center;
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
${TWITTER_SPACING_SELECTOR} {
    margin: -3px 0;
    padding: 0;
}
#ntisas-account-options.ntisas-activated {
    justify-content: normal;
}
#ntisas-account-options.ntisas-activated > div:first-child {
    flex: none;
}
#ntisas-account-options.ntisas-activated .r-1jayybb {
    min-height: 35px;
}
#ntisas-account-options.ntisas-activated [role=link] > div {
    padding: 8px;
}
@media screen and (min-width: 1282px) {
    #ntisas-account-options.ntisas-activated {
        width: 325px;
        margin-left: -50px;
    }
}
.ui-dialog.ntisas-dialog {
    z-index: 1010;
}
.ui-dialog .ntisas-dialog-close.ui-dialog-titlebar-close {
    font-size: 0;
    margin-right: 5px;
}
.ui-dialog .ntisas-dialog-close.ui-dialog-titlebar-close .ui-icon-closethick {
    margin: -8px;
}
[viewed="false"] .ntisas-view-indicator {
    display: none;
}
[viewed="true"] .ntisas-view-indicator {
    display: true;
}
.ntisas-view-block {
    display: inline-block;
    width: 1.5em;
    text-align: center;
}
.ntisas-view-indicator {
    width: 2em;
}
.ntisas-similar-results .ntisas-select-controls {
    right: 0;
    top: -5px;
}
.ntisas-post-result .ntisas-select-controls {
    left: 0;
    top: 0;
}
.ntisas-confirm-image .ntisas-select-controls {
    left: 0;
    bottom: -2.5em;
}
.ui-dialog .ntisas-confirm-image.ui-dialog-content {
    overflow: visible;
}
.ntisas-preview-tooltip .ntisas-select-controls a,
.ntisas-dialog .ntisas-select-controls a {
    color: dodgerblue;
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
}
`;

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
}`;

const COLOR_CSS = `
/*Program colors*/
#ntisas-side-menu,
.ntisas-retweet-id,
.ntisas-user-id,
.ntisas-tweet-menu,
.ntisas-timeline-menu,
.ntisas-download-section,
.ntisas-footer-entries {
    color: %TEXTCOLOR%;
}
#ntisas-server-bypass,
#ntisas-active-autoiqdb,
#ntisas-unavailable-autoiqdb,
#ntisas-tweet-stats-message {
    color: %TEXTMUTED%;
}
[ntisas-tweet=main] .ntisas-tweet-menu,
[ntisas-tweet=main] .ntisas-footer-entries {
    border-color: %TEXTFADED%;
}
.ntisas-media-link,
#ntisas-tweet-stats-table th a,
#ntisas-menu-selection a.ntisas-selected {
    color: %BASECOLOR%;
}
.ntisas-media-link,
#ntisas-tweet-stats-table th a {
    border-color: %BASECOLOR%;
}
.ntisas-tweet-header,
#ntisas-menu-header,
.ntisas-media-link:hover,
#ntisas-tweet-stats-table th a:hover {
    background-color: %BASEFAINT%;
}
.ntisas-tweet-header:hover {
    background-color: %BASECOLOR%;
}
.ntisas-media-link:active,
.ntisas-media-link:focus {
    box-shadow: 0 0 0 2px %BACKGROUNDCOLOR%, 0 0 0 4px %BASECOLOR%;
}
.ntisas-show-views .ntisas-viewed .ntisas-tweet-left {
    border-color: %TEXTMUTED%;
    background-color: %TEXTFADED%;
}
#ntisas-menu-selection {
    background-color: %TEXTFADED%;
}
.ntisas-code {
    background-color: %TEXTFADED%;
}
/*Dialogs*/
.ui-dialog.ntisas-dialog,
.ui-dialog.ntisas-dialog .ui-widget-content,
.ui-dialog.ntisas-dialog .ui-state-default {
    color: %TEXTCOLOR%;
    background: %BACKGROUNDCOLOR%;
}
.ui-dialog.ntisas-dialog,
.ui-dialog.ntisas-dialog .ui-tabs,
.ui-dialog.ntisas-dialog .ui-state-default {
    border: 1px solid %TEXTSHADED%;
}
.ui-dialog.ntisas-dialog .ui-tabs-nav,
.ui-dialog.ntisas-dialog .ui-dialog-titlebar,
.ui-dialog.ntisas-dialog .ui-dialog-buttonpane {
    border: 1px solid %TEXTFADED%;
}
.ntisas-view-info,
.ntisas-profile-section,
#ntisas-menu-selection a,
#ntisas-available-sauce,
.jsplib-inline-tooltip,
.jsplib-block-tooltip {
    color: %TEXTSHADED%;
}
.ntisas-tweet-header {
    border-color: %TEXTSHADED%;
}
.ntisas-query-button {
    background-color: %BACKGROUNDCOLOR%;
    border-color: %TEXTSHADED%;
}
.ntisas-query-button:hover {
    background-color: %TEXTFADED%;
}
.ntisas-download-button {
    background-color: %BASECOLOR%;
    border-color: %BASEDARKER%;
}
.ntisas-download-button:hover {
    background-color: %BASESHADED%;
}
#new-twitter-image-searches-and-stuff a {
    color: %BASECOLOR%;
}
.ui-dialog.ntisas-dialog .ui-state-active .ui-icon-background {
    border: 4px solid %BASEDARKER%;
}
.ui-dialog.ntisas-dialog .ui-widget-header {
    color: %TEXTCOLOR%;
    background-color: %BASESHADED%;
}
.ui-dialog.ntisas-dialog .ui-button {
    color: %TEXTCOLOR%;
    background-color: %BASEFAINT%;
    border: 1px solid %BASESHADED%;
}
.ui-dialog.ntisas-dialog .ui-button:hover,
.ui-dialog.ntisas-dialog .ui-tab:hover {
    background-color: %BASESHADED%;
    border: 1px solid %BASECOLOR%;
}

.ui-dialog.ntisas-dialog .ui-widget-content .ui-state-active,
.ui-dialog.ntisas-dialog .ui-widget-content .ui-state-active:focus {
    color: %BACKGROUNDCOLOR%;
    background-color: %BASECOLOR%;
    border: 1px solid %BASEDARKER%;
}
.ui-dialog.ntisas-dialog .ui-button:hover,
.ui-dialog.ntisas-dialog .ui-widget-content .ui-state-active:active,
.ui-dialog.ntisas-dialog .ui-widget-content .ui-state-active:focus {
    box-shadow: 0 0 0 2px %BACKGROUNDCOLOR%, 0 0 0 4px %BASECOLOR%;
}
#new-twitter-image-searches-and-stuff .ntisas-striped thead th {
    color: %TEXTSHADED%;
}
#ntisas-available-hotkeys-title {
    color: %BASESHADED%;
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
/*qTips*/
.qtiptisas.qtiptisas-twitter {
    color: %TEXTCOLOR%;
    background-color: %BACKGROUNDCOLOR%;
    border: 1px solid %TEXTSHADED%;
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

//HTML constants

const HORIZONTAL_RULE = '<div class="ntisas-horizontal-rule"></div>';

const SETTINGS_MENU = `<div id="new-twitter-image-searches-and-stuff" title="${PROGRAM_NAME} Settings"></div>`;

const IMPORT_FILE_INPUT = '<div class="jsplib-menu-item"><h4>Import file</h4><input size="50" type="file" name="ntisas-import-file" id="ntisas-import-file"></div>';

const LIST_INFO_TABLE = '<div id="ntisas-list-info-table" style="display:none"></div>';

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
            <li><a href="#ntisas-highlight-settings">Highlight</a></li>
            <li><a href="#ntisas-query-settings">Query</a></li>
            <li><a href="#ntisas-database-settings">Database</a></li>
            <li><a href="#ntisas-network-settings">Network</a></li>
            <li><a href="#ntisas-download-settings">Download</a></li>
            <li><a href="#ntisas-list-controls">List</a></li>
            <li><a href="#ntisas-cache-controls">Cache</a></li>
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
        <div id="ntisas-highlight-settings" class="jsplib-settings-grouping">
            <div id="ntisas-highlight-message" class="prose">
                <h4>Highlight settings</h4>
            </div>
        </div>
        <div id="ntisas-query-settings" class="jsplib-settings-grouping">
            <div id="ntisas-query-message" class="prose">
                <h4>Query settings</h4>
            </div>
        </div>
        <div id="ntisas-database-settings" class="jsplib-settings-grouping">
            <div id="ntisas-database-message" class="prose">
                <h4>Database settings</h4>
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
        <div id="ntisas-list-controls" class="jsplib-settings-grouping">
            <div id="ntisas-list-message" class="prose">
                <h4>List controls</h4>
                    <p>Alter lists used to control various aspects of NTISAS.&emsp;<b>Note:</b> Factory Reset does not affect the lists.</p>
            </div>
        </div>
        <div id="ntisas-cache-controls" class="jsplib-settings-grouping">
            <div id="ntisas-cache-message" class="prose">
                <h4>Cache controls</h4>
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

const LIST_CONTROL_DETAILS = `
<ul>
    <li><b>IQDB:</b> Auto-IQDB list</li>
</ul>`;

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
                    <td><span id="ntisas-version-header">Database version:</span></td>
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
                <tr data-setting="original_download_enabled">
                    <td><span>Download links:</span></td>
                    <td>%DOWNLOADS%</td>
                    <td>(%DOWNLOADSHELP%)</td>
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
                <tr data-setting="autoclick_IQDB_enabled">
                    <td><span>Autoclick IQDB:</span></td>
                    <td>%AUTOCLICKIQDB%</td>
                    <td>(%AUTOCLICKIQDBHELP%)</td>
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
                <div id="ntisas-stats-header"><span>Tweet Statistics</span> (%STATISTICSHELP%)</div>
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

const NTISAS_TWEET_MENU = `
<div class="ntisas-tweet-controls">
    <div class="ntisas-tweet-image-menu" style="border: 2px solid black; display: flex;">
        <div style="width: 7em;">
            <div class="ntisas-tweet-header"><a class="ntisas-expanded-link">NTISAS</a></div>
            <div class="ntisas-download-header">Download (&nbsp;<span class="ntisas-download-counter">0</span>&nbsp;)</div>
        </div>
        <div style="padding-left: 1em;">
            <div class="ntisas-image-section ntisas-links"></div>
            <div class="ntisas-download-section ntisas-links"></div>
            <div class="ntisas-menu-indicators"></div>
        </div>
    </div>
</div>`;

const SELECTION_CONTROLS = `
<div style="position: absolute" class="ntisas-select-controls ntisas-links">
    [
        <a class="ntisas-expanded-link" data-type="all">all</a> |
        <a class="ntisas-expanded-link" data-type="none">none</a> |
        <a class="ntisas-expanded-link" data-type="invert">invert</a>
    ]
</div>`;

const DOWNLOADS_HTML = `
<span id="ntisas-downloads-toggle">
    <a id="ntisas-enable-downloads" class="ntisas-expanded-link">Show</a>
    <a id="ntisas-disable-downloads" class="ntisas-expanded-link">Hide</a>
</span>`;

const VIEW_HIGHLIGHTS_HTML = `
<span id="ntisas-view-highlights-toggle">
    <a id="ntisas-enable-view-highlights" class="ntisas-expanded-link">Show</a>
    <a id="ntisas-disable-view-highlights" class="ntisas-expanded-link">Hide</a>
</span>`;

const VIEW_COUNTS_HTML = `
<span id="ntisas-view-counts-toggle">
    <a id="ntisas-enable-view-counts" class="ntisas-expanded-link">Enable</a>
    <a id="ntisas-disable-view-counts" class="ntisas-expanded-link">Disable</a>
</span>`;

const PROFILE_TIMELINE_HTML = `
<div class="ntisas-profile-section">
    <div class="ntisas-profile-user-id"></div>
    <div class="ntisas-profile-user-view"></div>
    <div class="ntisas-profile-stream-view"></div>
</div>`;

const AUTO_IQDB_HTML = `
<span id="ntisas-iqdb-toggle">
    <a id="ntisas-enable-autoiqdb" class="ntisas-expanded-link">Enable</a>
    <a id="ntisas-disable-autoiqdb" class="ntisas-expanded-link">Disable</a>
    <span id="ntisas-active-autoiqdb">Active</span>
    <span id="ntisas-unavailable-autoiqdb">Unavailable</span>
</span>`;

const LOCKPAGE_HTML = `
<span id="ntisas-lockpage-toggle">
    <a id="ntisas-enable-lockpage" class="ntisas-expanded-link">Lock</a>
    <a id="ntisas-disable-lockpage" class="ntisas-expanded-link" style="display:none">Unlock</a>
</span>`;

const MEDIA_LINKS_HTML = `
<div class="ntisas-main-links">
    <a class="ntisas-media-link" href="/%SCREENNAME%/media">Media</a>
    <a class="ntisas-media-link" href="/%SCREENNAME%/likes">Likes</a>
</div>`;

const STATUS_MARKER = `
<span class="ntisas-status-marker">
    <span class="ntisas-user-id"></span>
    <span class="ntisas-retweet-id"></span>
    <span class="ntisas-view-info"></span>
</span>`;

const MEDIA_RESULTS_ICON = '<div class="ntisas-media-results ntisas-media-icon-section %s">%s</div>';
const MEDIA_COUNTER_ICON = '<div class="ntisas-media-counter ntisas-media-icon-section">%s</div>';
const MEDIA_VIDEO_ICON = '<div class="ntisas-video-icon"><svg viewBox="0 0 60 61" aria-hidden="true" class="r-uvuy5l r-cfp7ip"><g><circle cx="30" cy="30.4219" fill="#333333" opacity="0.6" r="30"></circle><path d="M22.2275 17.1971V43.6465L43.0304 30.4218L22.2275 17.1971Z" fill="white"></path></g></svg></div>';

const LOAD_COUNTER = '<span id="ntisas-load-message">Loading ( <span id="ntisas-counter">...</span> )</span>';

const PROFILE_USER_ID = '<b>User ID&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; - %s</b>';
const PROFILE_USER_VIEW = 'Viewed user&nbsp;&nbsp; - %s';
const PROFILE_STREAM_VIEW = 'Viewed stream - %s';

//Message constants

const SAVE_HELP = "L-Click to save current settings. (Shortcut: Alt+S)";
const RESET_HELP = "L-Click to reset settings to default. (Shortcut: Alt+R)";
const SETTINGS_HELP = "L-Click to open settings menu. (Shortcut: Alt+M)";
const CLOSE_HELP = "L-Click to close. (Shortcut: Alt+C)";

const NO_MATCH_HELP = "no sources: L-click, manual add posts";
const NO_RESULTS_HELP = "no results: L-click, reset IQDB/Sauce results";
const CHECK_URL_HELP = "URL: L-click, query Danbooru for URL match";
const CHECK_IQDB_HELP = "IQDB: L-click, query Danbooru for image match";
const CHECK_SAUCE_HELP = "Sauce: L-click, query SauceNAO for image match";
const CONFIRM_DELETE_HELP = "postlink: L-click, add/delete info; R-click, open postlink";
const CONFIRM_IQDB_HELP = "postlink: L-click, confirm results; R-click open postlink";
const MERGE_RESULTS_HELP = "Merge: L-click, perform another query and merge with current results";
const IQDB_SELECT_HELP = "Select posts that aren't valid IQDB matches.\nClick the colored postlink when finished to confirm.";
const POST_SELECT_HELP = "Select posts for deletion by clicking the thumbnail.\nLeaving the Delete all checkbox on will select all posts.\nUnsetting that checkbox allows adding posts to the current set.\nClick the colored postlink when finished to delete/add posts.";

const INSTALL_DATABASE_HELP = "L-Click to install database.";
const UPGRADE_DATABASE_HELP = "L-Click to upgrade database.";
const MANUAL_INSTALL_HELP = `Visit topic #${DANBOORU_TOPIC_ID} for manual install file.\n(see settings menu for link).`;
const DATABASE_VERSION_HELP = "L-Click to set record position to latest on Danbooru.\nR-Click to open page to Danbooru records.";
const UPDATE_RECORDS_HELP = "L-Click to update records to current.";
const MUST_INSTALL_HELP = "The database must be installed before the script is fully functional.";
const REFRESH_RECORDS_HELP = "L-Click to refresh record count.";
const AVAILABLE_SAUCE_HELP = "Shows the number of API requests remaining.\nOnly shown after use of the Sauce link.\nResults are kept for only 1 hour.";
const DOWNLOADS_HELP = "L-Click to hide/show the downloads section. (Shortcut: Alt+D)";
const VIEWS_HIGHLIGHTS_HELP = "L-Click to toggle borders on viewed Tweets. (Shortcut: Alt+V)";
const VIEWS_COUNTS_HELP = "L-Click to toggle whether tweets are being counted as viewed.";
const AUTO_IQDB_HELP = "L-Click to toggle auto-IQDB click. (Shortcut: Alt+Q)";
const LOCKPAGE_HELP = "L-Click to prevent navigating away from the page (does not prevent Twitter navigation).";
const ERROR_MESSAGES_HELP = "L-Click to see full error messages.";
const STATISTICS_HELP = 'L-Click any category heading to narrow down results.\nL-Click &quot;Total&quot; category to reset results.';

const INSTALL_MENU_TEXT = "Must install DB!";

const SERVER_ERROR = "Failed to connect to remote server to get latest %s!";

const INSTALL_CONFIRM = JSPLib.utility.trim`
This will install the database (%s, %s).
This can take a couple of minutes.

Click OK when ready.`;

const UPGRADE_CONFIRM = JSPLib.utility.trim`
This will upgrade the database to (%s, %s).
Old database is at (%s, %s).
This can take a couple of minutes.

Click OK when ready.`;

const CURRENT_RECORDS_CONFIRM = JSPLib.utility.trim`
This will keep querying Danbooru until the records are current.
Depending on the current position, this could take several minutes.
Moving focus away from the page will halt the process.

Continue?`;

const CURRENT_POSTVER_CONFIRM = JSPLib.utility.trim`
This will query Danbooru for the latest record position to use.
This may potentially cause change records to be missed.

Continue?`;

const MANUAL_ADD_PROMPT = "Enter the post IDs of matches. (separated by commas)";
const CONFIRM_SAVE_PROMPT = "Save the following post IDs? (separate by comma, empty to reset link)";
const CONFIRM_DELETE_PROMPT = JSPLib.utility.trim`
The following posts will be deleted: %s

Save the following post IDs? (separate by comma, empty to delete)`;

//Database constants

const SERVER_DATABASE_URL = 'https://drive.google.com/uc?export=download&id=16YapNscZ0W-tZaRelYF2kDtR31idUd_p';
const SERVER_PURGELIST_URL = 'https://drive.google.com/uc?export=download&id=1uFixlRryOGUzhfvU6nbrkNRAQC4VvO10';
const DATABASE_INFO_URL = 'https://drive.google.com/uc?export=download&id=1evAJM-K6QpHg52997PbXf-bptImLgHDs';

//Time constants

const STORAGE_DELAY = 1; //Don't save lists synchronously since large lists delay UI response
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
const SIMILAR_EXPIRES = JSPLib.utility.one_day;
const VIDEO_EXPIRES = JSPLib.utility.one_week;
const TWEET_EXPIRES = JSPLib.utility.one_week;
const TWUSER_EXPIRES = JSPLib.utility.one_day;
const LENGTH_RECHECK_EXPIRES = JSPLib.utility.one_hour;
const USER_PROFILE_RECHECK_EXPIRES = JSPLib.utility.one_month;
const DATABASE_RECHECK_EXPIRES = JSPLib.utility.one_day;
const BADVER_RECHECK_EXPIRES = JSPLib.utility.one_day;
const PRUNE_RECHECK_EXPIRES = JSPLib.utility.one_hour * 6;
const PROFILE_VIEWS_CALLBACK = JSPLib.utility.one_second * 10;

//Regex constants

var TWITTER_ACCOUNT = String.raw`[\w-]+`;
var TWITTER_ID = String.raw`\d+`;
var QUERY_END = String.raw`(?:\?|$)`;

const TWEET_REGEX = XRegExp.tag('g')`^https://twitter\.com/[\w-]+/status/(\d+)$`;
const TWEET_URL_REGEX = XRegExp.tag('g')`^https://twitter\.com/[\w-]+/status/\d+`;
const SOURCE_TWITTER_REGEX = XRegExp.tag('g')`^source:https://twitter\.com/[\w-]+/status/(\d+)$`;

const IMAGE_REGEX = XRegExp.tag()`(https://pbs\.twimg\.com/media/[\w-]+\?format=(?:jpg|png|gif|webp)&name=)(.+)`;
const BANNER_REGEX = XRegExp.tag()`https://pbs\.twimg\.com/profile_banners/(\d+)/\d+/`;

const TWIMG_HOST_RG = XRegExp.tag('i')`^https?://pbs\.twimg\.com`;
const TWITTER_IMAGE1 = XRegExp.tag('xi')`
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
const TWITTER_IMAGE2 = XRegExp.tag('xi')`
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
const TWITTER_IMAGE3 = XRegExp.tag('xi')`
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
const TWITTER_IMAGE4 = XRegExp.tag('xi')`
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
    XRegExp.tag()`^https://pbs\.twimg\.com/profile_images/`,
    XRegExp.tag()`^https://[^.]+\.twimg\.com/emoji/`,
    XRegExp.tag()`^https://pbs.twimg.com/ad_img/`,
    XRegExp.tag()`^https://abs.twimg.com/hashflags/`,
    XRegExp.tag()`^https://pbs.twimg.com/card_img/`,
];

var ALL_PAGE_REGEXES = {
    main: {
        format: ' {{no_match}} ({{main_account}}) {{end}} ',
        subs: {
            main_account: TWITTER_ACCOUNT,
            no_match: '(?!search|home)',
            end: QUERY_END,
        }
    },
    media: {
        format: ' ( {{media_account}} ) {{media}} {{end}} ',
        subs: {
            media_account: TWITTER_ACCOUNT,
            media: '/media',
            end: QUERY_END,
        }
    },
    search: {
        format: ' {{search}} ( {{search_query}} ) ',
        subs: {
            search: String.raw`search\?`,
            search_query: String.raw`.*?\bq=.+`,
        }
    },
    tweet: {
        format: ' ( {{tweet_account}} ) {{status}} ( {{tweet_id}} ) {{end}} ',
        subs: {
            tweet_account: TWITTER_ACCOUNT,
            tweet_id: TWITTER_ID,
            status: '/status/',
            end: QUERY_END,
        }
    },
    web_tweet: {
        format: ' {{status}} ( {{web_tweet_id}} ) {{end}} ',
        subs: {
            web: TWITTER_ACCOUNT,
            web_tweet_id: TWITTER_ID,
            status: 'i/web/status/',
            end: QUERY_END,
        }
    },
    hashtag: {
        format: ' {{hashtag}} ( {{hashtag_hash}} ) {{end}} ',
        subs: {
            hashtag: 'hashtag/',
            hashtag_hash: '.+?',
            end: QUERY_END,
        }
    },
    list: {
        format: ' ( {{list_account}} ) {{list}} ( {{list_id}} ) {{end}} ',
        subs: {
            list_account: TWITTER_ACCOUNT,
            list_id: String.raw`[\w-]+`,
            list: '/lists/',
            end: QUERY_END,
        }
    },
    home: {
        format: ' {{home}} {{end}} ',
        subs: {
            home: 'home',
            end: QUERY_END,
        }
    },
    likes: {
        format: ' ( {{likes_account}} ) {{likes}} {{end}} ',
        subs: {
            likes_account: TWITTER_ACCOUNT,
            likes: '/likes',
            end: QUERY_END,
        }
    },
    replies: {
        format: ' ( {{replies_account}} ) {{replies}} {{end}} ',
        subs: {
            replies_account: TWITTER_ACCOUNT,
            replies: '/with_replies',
            end: QUERY_END,
        }
    },
    photo: {
        format: ' ( {{photo_account}} ) {{status}} ( {{photo_id}} ) {{type}} ( {{photo_index}} ) {{end}} ',
        subs: {
            photo_account: TWITTER_ACCOUNT,
            photo_id: TWITTER_ID,
            photo_index: String.raw`\d`,
            type: '/(?:photo|video)/',
            status: '/status/',
            end: QUERY_END,
        }
    },
    moments: {
        format: ' {{moments}} ( {{moment_id}} ) {{end}} ',
        subs: {
            moment_id: TWITTER_ID,
            moments: 'i/moments/',
            end: QUERY_END,
        }
    },
    topics: {
        format: ' {{topics}} ( {{topic_id}} ) {{end}} ',
        subs: {
            topic_id: TWITTER_ID,
            topics: 'i/topics/',
            end: QUERY_END,
        }
    },
    display: {
        format: ' {{display}} {{end}} ',
        subs: {
            display: 'i/display',
            end: QUERY_END,
        }
    },
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

const QUERY_LIMIT = 100;
const QUERY_BATCH_NUM = 5;
const QUERY_BATCH_SIZE = QUERY_LIMIT * QUERY_BATCH_NUM;

const POST_FIELDS = 'id,uploader_id,score,fav_count,rating,tag_string,created_at,preview_file_url,source,file_ext,file_size,image_width,image_height,uploader[name]';
const POSTVER_FIELDS = 'id,updated_at,post_id,version,source,source_changed,added_tags,removed_tags';
const PROFILE_FIELDS = 'id,level';

//DOM constants

const DOWNLOAD_CONTROLS = ['enable', 'disable'];
const VIEW_HIGHLIGHT_CONTROLS = ['enable', 'disable'];
const VIEW_COUNT_CONTROLS = ['enable', 'disable'];
const IQDB_CONTROLS = ['enable', 'disable', 'active', 'unavailable'];

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

const STREAMING_PAGES = ['home', 'main', 'likes', 'replies', 'media', 'list', 'search', 'hashtag', 'moments', 'topics'];
const MEDIA_TYPES = ['images', 'media', 'videos'];

const ALL_LISTS = {
    iqdb: 'auto-iqdb-list',
};

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

const CONFIRM_DIALOG_SETTINGS = {
    title: "Image select",
    modal: true,
    resizable: false,
    autoOpen: false,
    classes: {
        'ui-dialog': 'ntisas-dialog',
        'ui-dialog-titlebar-close': 'ntisas-dialog-close'
    },
    open () {
        this.promiseConfirm = new Promise((resolve) => {this.resolveConfirm = resolve;});
    },
    close () {
        this.resolveConfirm?.(false);
    },
    buttons: {
        'Submit' () {
            this.resolveConfirm?.(true);
            $(this).dialog('close');
        },
        'Cancel' () {
            this.resolveConfirm?.(false);
            $(this).dialog('close');
        }
    }
};

const MEDIA_DIALOG_SETTINGS = {
    title: "Media menu",
    modal: false,
    resizable: false,
    autoOpen: false,
    width: 640,
    classes: {
        'ui-dialog': 'ntisas-dialog',
        'ui-dialog-titlebar-close': 'ntisas-dialog-close'
    },
    buttons: {
        'Close' () {
            $(this).dialog('close');
        }
    }
};

const MENU_DIALOG_SETTINGS = {
    modal: true,
    resizable: false,
    autoOpen: false,
    width: 1000,
    height: 800,
    classes: {
        'ui-dialog': 'ntisas-dialog',
        'ui-dialog-titlebar-close': 'ntisas-dialog-close'
    },
    open: () => {
        NTISAS.opened_menu = true;
    },
    close: () => {
        NTISAS.opened_menu = false;
    },
    buttons: {
        //Save and reset are bound separately
        'Save': (() => {}),
        'Factory reset': (() => {}),
        'Close' () {
            $(this).dialog('close');
        }
    }
};

const MENU_DIALOG_BUTTONS = {
    'Save': {
        id: 'ntisas-commit',
        title: SAVE_HELP
    },
    'Factory reset': {
        id: 'ntisas-resetall',
        title: RESET_HELP
    },
    'Close': {
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
    values: {
        partial_image: JSPLib.validate.stringonly_constraints,
        partial_video: JSPLib.validate.stringnull_constraints,
        partial_sample: JSPLib.validate.stringnull_constraints,
    },
};

const VIEW_CONSTRAINTS = {
    entry: JSPLib.validate.hashentry_constraints,
    value: {
        count: JSPLib.validate.counting_constraints,
        viewed: JSPLib.validate.counting_constraints,
    },
};

const SIMILAR_CONSTRAINTS = {
    expires: JSPLib.validate.expires_constraints,
    value: JSPLib.validate.boolean_constraints
};

const VIDEO_CONSTRAINTS = {
    expires: JSPLib.validate.expires_constraints,
    value: JSPLib.validate.stringnull_constraints
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

const DATABASE_CONSTRAINTS = {
    post_version: JSPLib.validate.id_constraints,
    timestamp: JSPLib.validate.timestamp_constraints,
};

/****Functions****/

function ValidateEntry(key, entry) {
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
    if (key.match(/^(iqdb|sauce)-/)) {
        return JSPLib.validate.validateHashEntries(key, entry, SIMILAR_CONSTRAINTS);
    }
    if (key.match(/^video-/)) {
        return JSPLib.validate.validateHashEntries(key, entry, VIDEO_CONSTRAINTS);
    }
    if (key.match(/^twuser-/)) {
        return JSPLib.validate.validateHashEntries(key, entry, TWUSER_CONSTRAINTS);
    }
    if (key.match(/^tweet-/)) {
        return ValidateTypeEntry(key, entry, 'array', TWEET_CONSTRAINTS);
    }
    if (key === 'ntisas-available-sauce') {
        return JSPLib.validate.validateHashEntries(key, entry, SAUCE_CONSTRAINTS);
    }
    this.debug('warn', "Bad key!");
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
    if (key.match(/^(iqdb|sauce)-/)) {
        return SIMILAR_EXPIRES;
    }
    if (key.match(/^video-/)) {
        return VIDEO_EXPIRES;
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
    for (let i = 0; i < entry.value.length; i++) {
        if (!JSPLib.validate.validateHashEntries(`${key}.value[${i}]`, entry.value[i], constraints.values)) {
            return false;
        }
    }
    return true;
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
        case 'ntisas-database-recheck':
        case 'ntisas-badver-recheck':
        case 'ntisas-length-recheck':
        case 'ntisas-user-profile-recheck':
        case 'ntisas-recent-timestamp':
        case 'ntisas-process-semaphore-checkuser':
        case 'ntisas-process-semaphore-purgebad':
        case 'ntisas-process-semaphore-badvers':
        case 'ntisas-process-semaphore-records':
        case 'ntisas-process-semaphore-checkpost':
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
        case 'ntisas-purge-bad':
            if (!JSPLib.validate.isBoolean(entry)) {
                checkerror = ["Value is not a boolean."];
            }
            break;
        case 'ntisas-auto-iqdb-list':
            return JSPLib.validate.validateArrayValues(key, entry, JSPLib.validate.basic_stringonly_validator);
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

function CorrectStringArray(name, stringlist) {
    if (!Array.isArray(stringlist)) {
        this.debug('log', "Value is not an array.");
        return [];
    }
    let correctlist = stringlist.filter(JSPLib.validate.isString);
    if (stringlist.length !== correctlist.length) {
        SetLocalData('ntisas-' + name, correctlist);
        JSPLib.debug.debugExecute(() => {
            let bad_values = JSPLib.utility.arrayDifference(stringlist, correctlist);
            this.debug('log', "Bad values found:", name, bad_values);
        });
    }
    return correctlist;
}

function VaildateColorArray(array) {
    return array.every((val) => {
        let parse = Number(val);
        return JSPLib.validate.isString(val) &&
               Number.isInteger(parse) &&
               parse >= 0 && parse <= 255;
    });
}

//Library functions

JSPLib.utility.promiseState = function (promise) {
    const pendingState = {status: 'pending'};
    return Promise.race([promise, pendingState]).then(
        (value) => (value === pendingState ? value : {status: 'resolved', value}),
        (reason) => ({status: 'rejected', reason}),
    );
};

JSPLib.utility.createStatusPromise = function () {
    const ret = this.createPromise();
    const timer = this.initializeInterval(() => {
        this.promiseState(ret.promise).then((state) => {
            ret.status = state.status;
            if (ret.status !== 'pending') {
                clearInterval(timer);
            }
        });
    }, 100);
    return ret;
};

JSPLib.utility.bigIntMax = function (...args) {
    return args.reduce((max, comp) => (max > comp ? max : comp));
};

JSPLib.utility.bigIntMin = function (...args) {
    return args.reduce((min, comp) => (min < comp ? min : comp));
};

JSPLib.concurrency.freeSemaphore = function (program_shortcut, name) {
    let event_name = this._getSemaphoreName(program_shortcut, name, false);
    let storage_name = this._getSemaphoreName(program_shortcut, name, true);
    JSPLib._jQuery(JSPLib._window).off('beforeunload.' + event_name);
    JSPLib.storage.setStorageData(storage_name, 0, localStorage);
};

JSPLib.concurrency.reserveSemaphore = function (self, program_shortcut, name) {
    let display_name = (name ? `[${name}]` : '');
    if (this.checkSemaphore(program_shortcut, name)) {
        self.debug('logLevel', `Tab got the semaphore ${display_name}!`, JSPLib.debug.INFO);
        //Guarantee that leaving/closing tab reverts the semaphore
        let event_name = this._getSemaphoreName(program_shortcut, name, false);
        let storage_name = this._getSemaphoreName(program_shortcut, name, true);
        JSPLib._jQuery(JSPLib._window).on('beforeunload.' + event_name, () => {
            JSPLib.storage.setStorageData(storage_name, 0, localStorage);
        });
        //Set semaphore with an expires in case the program crashes
        let semaphore = JSPLib.utility.getExpires(this.process_semaphore_expires);
        JSPLib.storage.setStorageData(storage_name, semaphore, localStorage);
        return semaphore;
    }
    self.debug('logLevel', `Tab missed the semaphore ${display_name}!`, JSPLib.debug.WARNING);
    return null;
};

JSPLib.storage.getStorageData = function (key, storage, default_val = null) {
    let storage_type = this._getStorageType(storage);
    if (!(key in this.memory_storage[storage_type]) && key in storage) {
        let record_key = this._getUID(key);
        JSPLib.debug.recordTime(record_key, 'Storage');
        let data = storage.getItem(key);
        JSPLib.debug.recordTimeEnd(record_key, 'Storage');
        try {
            this.memory_storage[storage_type][key] = JSON.parse(data);
        } catch (e) {
            //swallow exception
        }
    }
    if (this.memory_storage[storage_type][key] === undefined){
        this.memory_storage[storage_type][key] = default_val;
    }
    return JSPLib.utility.dataCopy(this.memory_storage[storage_type][key]);
};

JSPLib.debug.addModuleLogs('concurrency', ['reserveSemaphore']);

//Helper functions

////Make setting all of these into a library function
function GetLocalData(key, default_val) {
    return JSPLib.storage.getStorageData(key, localStorage, default_val);
}

function CheckLocalData(key, default_val) {
    return JSPLib.storage.checkStorageData(key, ValidateProgramData, localStorage, default_val);
}

function SetLocalData(key, data) {
    JSPLib.storage.setStorageData(key, data, localStorage);
}

function InvalidateLocalData(key) {
    JSPLib.storage.invalidateStorageData(key, localStorage);
}

function GetSessionTwitterData(tweet_id) {
    return JSPLib.storage.getIndexedSessionData('tweet-' + tweet_id, [], STORAGE_DATABASES.twitter);
}

function GetAPIData(key, id, value) {
    if (API_DATA === undefined || !(key in API_DATA) || !(id in API_DATA[key])) {
        return null;
    }
    return (value ? API_DATA[key][id][value] : API_DATA[key][id]);
}

function GetNumericTimestamp(timestamp) {
    return GetDateString(timestamp) + GetTimeString(timestamp);
}

function GetDateString(timestamp) {
    let time_obj = new Date(timestamp);
    return `${time_obj.getFullYear()}${JSPLib.utility.padNumber(time_obj.getMonth() + 1, 2)}${JSPLib.utility.padNumber(time_obj.getDate(), 2)}`;
}

function GetTimeString(timestamp) {
    let time_obj = new Date(timestamp);
    return `${JSPLib.utility.padNumber(time_obj.getHours(), 2)}${JSPLib.utility.padNumber(time_obj.getMinutes(), 2)}`;
}

function ParseQueries(str) {
    return str.split(' ').reduce((params, param) => {
        var paramSplit = param.split(':');
        params[paramSplit[0]] = paramSplit[1];
        return params;
    }, {});
}

function TimeAgo(timestamp) {
    let time_interval = Date.now() - timestamp;
    if (time_interval < JSPLib.utility.one_hour) {
        return JSPLib.utility.setPrecision(time_interval / JSPLib.utility.one_minute, 2) + " minutes ago";
    } if (time_interval < JSPLib.utility.one_day) {
        return JSPLib.utility.setPrecision(time_interval / JSPLib.utility.one_hour, 2) + " hours ago";
    } if (time_interval < JSPLib.utility.one_month) {
        return JSPLib.utility.setPrecision(time_interval / JSPLib.utility.one_day, 2) + " days ago";
    } if (time_interval < JSPLib.utility.one_year) {
        return JSPLib.utility.setPrecision(time_interval / JSPLib.utility.one_month, 2) + " months ago";
    }
    return JSPLib.utility.setPrecision(time_interval / JSPLib.utility.one_year, 2) + " years ago";

}

function GetPostVersionsExpiration() {
    return NTISAS.user_settings.recheck_interval * JSPLib.utility.one_minute;
}

function WasOverflow() {
    return CheckLocalData('ntisas-overflow', false);
}

//This needs its own separate validation because it should not be exported
function GetRemoteDatabase() {
    let data = GetLocalData('ntisas-remote-database');
    return (JSPLib.validate.validateHashEntries('ntisas-remote-database', data, DATABASE_CONSTRAINTS) ? data : null);
}

function IsTISASInstalled() {
    return GetRemoteDatabase() !== null;
}

function GetUserIdent() {
    if (API_DATA.has_data) {
        return [NTISAS.user_id, [NTISAS.user_id, NTISAS.account]];
    }
    return [NTISAS.account, [NTISAS.account]];

}

function PageRegex() {
    if (!NTISAS.page_regex) {
        let built_regexes = Object.assign({}, ...Object.keys(ALL_PAGE_REGEXES).map((page) => {
            //Match at beginning of string with Twitter URL
            let regex = XRegExp.build(`^ https://twitter.com/ ` + ALL_PAGE_REGEXES[page].format, ALL_PAGE_REGEXES[page].subs, 'x');
            //Add page named capturing group
            return {[page]: XRegExp.build(' ( {{' + page + '}} ) ', {[page]: regex}, 'x')};
        }));
        //Combine all regexes
        let all_format = Object.keys(built_regexes).map((page) => (' {{' + page + '}} ')).join('|');
        let all_regex = XRegExp.build(all_format, built_regexes, 'x');
        //Add overall capturing group...
        NTISAS.page_regex = XRegExp.build(' ( {{site}} )', {site: all_regex}, 'x');
    }
    return NTISAS.page_regex;
}

function DisplayHighlights() {
    return NTISAS.user_settings.score_highlights_enabled && IsMediaTimeline();
}

function IsQuerySettingEnabled(setting, type) {
    let type_key = (type === 'iqdb' ? 'IQDB' : type) + '_settings';
    return NTISAS.user_settings[type_key].includes(setting);
}

function MapPostData(posts) {
    return posts.map(MapPost);
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

function MapSimilar(post, score) {
    return {
        score,
        post
    };
}

function GetLinkTitle(post) {
    let tags = JSPLib.utility.HTMLEscape(post.tags);
    let age = JSPLib.utility.HTMLEscape(`age:"${TimeAgo(post.created)}"`);
    return `user:${post.uploadername} score:${post.score} favcount:${post.favcount} rating:${post.rating} ${age} ${tags}`;
}

function GetMultiLinkTitle(posts) {
    let title = [];
    posts.forEach((post) => {
        let age = JSPLib.utility.HTMLEscape(`age:"${TimeAgo(post.created)}"`);
        title.push(`post #${post.id} - user:${post.uploadername} score:${post.score} favcount:${post.favcount} rating:${post.rating} ${age}`);
    });
    return title.join('\n');
}

function GetCustomQuery() {
    return (NTISAS.user_settings.custom_order_enabled && (NTISAS.user_data.level >= GOLD_LEVEL) ? '+order%3Acustom' : '');
}

function GetPostVersionsLastID(type) {
    //Get the program last ID if it exists
    let postver_lastid = CheckLocalData(`ntisas-${type}-lastid`, NTISAS.database_info && NTISAS.database_info.post_version);
    if (NTISAS.user_settings.bypass_server_mode && !NTISAS.database_info) {
        return postver_lastid;
    }
    //Select the largest of the program lastid and the database lastid
    let max_postver_lastid = Math.max(postver_lastid, NTISAS.database_info.post_version);
    if (postver_lastid !== max_postver_lastid) {
        SetLocalData(`ntisas-${type}-lastid`, max_postver_lastid);
    }
    return max_postver_lastid;
}

async function GetTotalRecords(manual = false) {
    if (manual || JSPLib.concurrency.checkTimeout('ntisas-length-recheck', LENGTH_RECHECK_EXPIRES)) {
        let database_length = await JSPLib.storage.twitterstorage.length();
        SetLocalData('ntisas-database-length', database_length);
        JSPLib.concurrency.setRecheckTimeout('ntisas-length-recheck', LENGTH_RECHECK_EXPIRES);
    }
    return GetLocalData('ntisas-database-length', 0);
}

function GetImageAttributes(image_url) {
    let base_url = image_url.split(':orig')[0];
    NTISAS.image_data = NTISAS.image_data || {};
    return new Promise((resolve) => {
        if (image_url in NTISAS.image_data) {
            resolve(NTISAS.image_data[image_url]);
        }
        let size_promise = JSPLib.network.getDataSize(image_url);
        let dimensions_promise;
        if (base_url in NTISAS.tweet_images) {
            this.debug('log', "Found image API data:", base_url, NTISAS.tweet_images[base_url]);
            dimensions_promise = Promise.resolve(NTISAS.tweet_images[base_url].original_info);
        } else {
            this.debug('warn', "Missing image API data:", base_url);
            dimensions_promise = JSPLib.utility.getImageDimensions(image_url);
        }
        Promise.all([size_promise, dimensions_promise]).then(([size, dimensions]) => {
            NTISAS.image_data[image_url] = Object.assign(dimensions, {size});
            resolve(NTISAS.image_data[image_url]);
        });
    });
}

function ReadableBytes(bytes) {
    var i = Math.floor(Math.log(bytes) / Math.log(1024)),
        sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    return JSPLib.utility.setPrecision((bytes / Math.pow(1024, i)), 2) + ' ' + sizes[i];
}

function GetFileExtension(url, splitter = ' ') {
    let parser = new URL(url);
    let pathname = parser.pathname.split(splitter)[0];
    let extpos = pathname.lastIndexOf('.');
    return pathname.slice(extpos + 1);
}

function GetThumbUrl(url, splitter, ext, size) {
    let parser = new URL(url);
    let pathname = parser.pathname.split(splitter)[0];
    let extpos = pathname.lastIndexOf('.');
    return parser.origin + pathname.slice(0, extpos) + `?format=${ext}&name=${size}`;
}

function GetFileURLNameExt(file_url) {
    let path_index = file_url.lastIndexOf('/');
    let file_ident = file_url.slice(path_index + 1);
    let [file_name, extension] = file_ident.split('.');
    extension = extension.split(/\W+/)[0];
    return [file_name, extension];
}

async function GetNormalImageURL(image_info) {
    if (!(image_info.key in NTISAS.known_extensions)) {
        if (image_info.ext === 'webp') {
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

function GetImageURLInfo(image_url) {
    for (let i = 0; i < HANDLED_IMAGES.length; i++) {
        let match = XRegExp.exec(image_url, HANDLED_IMAGES[i]);
        if (match) {
            return match.groups;
        }
    }
    for (let i = 0; i < UNHANDLED_IMAGES.length; i++) {
        let match = image_url.match(UNHANDLED_IMAGES[i]);
        if (match) {
            return null;
        }
    }
    return false;
}

function GetSingleImageInfo(tweet_id) {
    GetSingleImageInfo.memoized ??= {};
    if (!GetSingleImageInfo.memoized[tweet_id]) {
        let image_url = $(`.ntisas-media-tweet[data-tweet-id=${tweet_id}] img`).attr('src');
        if (JSPLib.validate.isString(image_url)) {
            let image_info = GetImageURLInfo(image_url);
            GetSingleImageInfo.memoized[tweet_id] = [{partial_image: image_info.path + '/' + image_info.key + '.' + image_info.ext}];
        } else {
            JSPLib.debug.debugwarn("Image URL not found:", tweet_id);
            GetSingleImageInfo.memoized[tweet_id] = [];
        }
    }
    return GetSingleImageInfo.memoized[tweet_id];
}

function GetNomatchHelp(no_url_results, no_iqdb_results, no_sauce_results) {
    let help_info = [NO_MATCH_HELP];
    if (no_iqdb_results || no_sauce_results) {
        help_info.push(NO_RESULTS_HELP);
    }
    if (!no_url_results) {
        help_info.push(CHECK_URL_HELP);
    }
    if (!no_iqdb_results) {
        help_info.push(CHECK_IQDB_HELP);
    }
    if (!no_sauce_results) {
        help_info.push(CHECK_SAUCE_HELP);
    }
    return help_info.join('\n');
}

function RemoveDuplicates(obj_array, attribute){
    const attribute_index = JSPLib.utility.getObjectAttributes(obj_array, attribute);
    return obj_array.filter((obj, index) => (attribute_index.indexOf(obj[attribute]) === index));
}

function LogarithmicExpiration(count, max_count, time_divisor, multiplier) {
    let time_exponent = Math.pow(10, (1 / time_divisor));
    return Math.round(Math.log10(time_exponent + (10 - time_exponent) * (count / max_count)) * multiplier);
}

//Auxiliary functions

function GetList(name) {
    NTISAS.lists[name] = NTISAS.lists[name] || {};
    if (!('list' in NTISAS.lists[name])) {
        NTISAS.lists[name].list = GetLocalData('ntisas-' + name, []);
        NTISAS.lists[name].list = CorrectStringArray(name, NTISAS.lists[name].list);
    }
    return NTISAS.lists[name].list;
}

function SaveList(name, list, delay = true) {
    NTISAS.lists[name].list = list;
    if (delay) {
        setTimeout(() => {
            SetLocalData('ntisas-' + name, list);
        }, STORAGE_DELAY);
    } else {
        SetLocalData('ntisas-' + name, list);
    }
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

function SetCheckPostvers() {
    if (JSPLib.concurrency.checkTimeout('ntisas-timeout', GetPostVersionsExpiration()) || WasOverflow()) {
        clearTimeout(CheckPostvers.timeout);
        CheckPostvers.timeout = setTimeout(() => {
            if ((NTISAS.database_info || NTISAS.user_settings.bypass_server_mode) && JSPLib.concurrency.reserveSemaphore(PROGRAM_SHORTCUT, 'postvers')) {
                CheckPostvers();
            }
        }, POST_VERSIONS_CALLBACK);
    }
}

async function AddViewCount(tweet_id) {
    if (NTISAS.count_views && !NTISAS.recorded_views.includes(tweet_id)) {
        let views = await GetData('view-' + tweet_id, 'danbooru');
        let mapped_view = {
            count: (views ? views.value.count : 0) + 1,
            viewed: Date.now()
        };
        let data_expires = JSPLib.utility.getExpires(VIEW_EXPIRES);
        SaveData('view-' + tweet_id, {value: mapped_view, expires: data_expires}, 'danbooru', false);
        NTISAS.recorded_views.push(tweet_id);
    }
}

function UpdateImageDict(tweet) {
    let $tweet = $(tweet);
    let tweet_id = $tweet.data('tweet-id');
    if ((tweet_id in API_DATA.tweets) && ('extended_entities' in API_DATA.tweets[tweet_id]) && ('media' in API_DATA.tweets[tweet_id].extended_entities)) {
        API_DATA.tweets[tweet_id].extended_entities.media.forEach((image) => {
            NTISAS.tweet_images[image.media_url_https] = image;
        });
    }
}

function GetTweetQuartile(tweetid) {
    if (tweetid in NTISAS.tweet_finish) {
        return NTISAS.tweet_finish[tweetid];
    }
    let windowsize = NTISAS.user_settings.score_window_size;
    let pos = NTISAS.tweet_pos.indexOf(tweetid);
    let fave = NTISAS.tweet_faves[pos];
    let posmin = Math.max(0, pos - windowsize);
    let posmax = Math.min(NTISAS.tweet_pos.length, pos + windowsize);
    let subarray = NTISAS.tweet_faves.slice(posmin, posmax);
    var quartilepos = Math.floor(subarray.length / 4);
    var sortedfaves = subarray.sort((a, b) => (a - b));
    var q1 = sortedfaves[quartilepos];
    var q2 = sortedfaves[2 * quartilepos];
    var q3 = sortedfaves[3 * quartilepos];
    var min = Math.min(...sortedfaves);
    var max = Math.max(...sortedfaves);
    var outlierq1 = (q1 + min) / 2;
    var outlierq3 = (q3 + max) / 2;
    let quartile = 5;
    if (fave >= outlierq3) {
        quartile = 0;
    } else if (fave >= q3) {
        quartile = 1;
    } else if (fave >= q2) {
        quartile = 2;
    } else if (fave >= q1) {
        quartile = 3;
    } else if (fave >= outlierq1) {
        quartile = 4;
    }
    if ((posmax - posmin) >= (windowsize * 2)) {
        NTISAS.tweet_finish[tweetid] = quartile;
    }
    return quartile;
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

function SetVideoDownload($download_section, video_url) {
    let [video_name, extension] = GetFileURLNameExt(video_url);
    let download_filename = JSPLib.utility.regexReplace(NTISAS.filename_prefix, {
        ORDER: 'video1',
        IMG: video_name
    }) + '.' + extension;
    let $video_button = $download_section.parent().find('.ntisas-download-video');
    $video_button.attr('href', video_url).attr('download', download_filename);
    $video_button.parent().show();
}

function UpdatePostIDsLink(tweet_id, post_ids) {
    var $tweet;
    if (NTISAS.page === 'media') {
        $tweet = $(`.ntisas-media-menu[data-tweet-id=${tweet_id}]`);
    } else {
        $tweet = $(`[ntisas-tweet][data-tweet-id=${tweet_id}]`);
    }
    if ($tweet.length === 0) {
        return;
    }
    let $link_container = $tweet.find('.ntisas-link-menu');
    let $link = $tweet.find('.ntisas-database-match, .ntisas-confirm-save');
    if ($link.length && NTISAS.user_settings.advanced_tooltips_enabled) {
        $link.qtiptisas('destroy', true);
    }
    if (post_ids.length === 0) {
        InitializeNoMatchesLinks(tweet_id, $link_container);
    } else {
        InitializePostIDsLink(tweet_id, $link_container, $tweet[0], post_ids);
    }
}

function PromptSavePostIDs($link, $tweet, tweet_id, $replace, message, initial_post_ids) {
    let prompt_string = prompt(message, initial_post_ids.join(', '));
    if (prompt_string !== null) {
        let confirm_post_ids = JSPLib.utility.arrayUnique(
            prompt_string.split(',')
                .map(Number)
                .filter((num) => JSPLib.validate.validateID(num))
        );
        this.debug('log', "Confirmed IDs:", confirm_post_ids);
        if (confirm_post_ids.length === 0) {
            RemoveData('tweet-' + tweet_id, 'twitter');
        } else {
            SaveData('tweet-' + tweet_id, confirm_post_ids, 'twitter');
        }
        UpdatePostIDsLink(tweet_id, confirm_post_ids);
        NTISAS.channel.postMessage({type: 'postlink', tweet_id, post_ids: confirm_post_ids});
    }
}

function GetSelectPostIDs(tweet_id, type) {
    if (!NTISAS[type][tweet_id]) {
        return [];
    }
    let $select_previews = $('.ntisas-post-select', NTISAS[type][tweet_id][0]);
    return JSPLib.utility.getDOMAttributes($select_previews, 'id', Number);
}

function SetThumbnailWait(container, all_posts) {
    all_posts.forEach(async (post) => {
        let blob = await JSPLib.network.getData(post.thumbnail);
        let image_blob = blob.slice(0, blob.size, 'image/jpeg');
        let blob_url = window.URL.createObjectURL(image_blob);
        $(`[data-id=${post.id}] img`, container).attr('src', blob_url);
    });
}

//Checks and removes a value from a hash key if it exists
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

function ProcessPostvers(postvers) {
    postvers.sort((a, b) => (a.id - b.id));
    var account_swaps = 0;
    var inactive_posts = 0;
    var reversed_posts = 0;
    var add_entries = {};
    var rem_entries = {};
    postvers.forEach((postver) => {
        if (postver.source_changed) {
            if (postver.version === 1) {
                let tweet_id = JSPLib.utility.findAll(postver.source, TWEET_REGEX)[1];
                if (tweet_id) {
                    add_entries[tweet_id] = add_entries[tweet_id] || [];
                    add_entries[tweet_id] = JSPLib.utility.arrayUnion(add_entries[tweet_id], [postver.post_id]);
                }
            } else {
                let tweet_id = {};
                let twitter_add = postver.added_tags.find((tag) => SOURCE_TWITTER_REGEX.test(tag)) || "";
                tweet_id.add = JSPLib.utility.findAll(twitter_add, SOURCE_TWITTER_REGEX)[1];
                let twitter_rem = postver.removed_tags.find((tag) => SOURCE_TWITTER_REGEX.test(tag)) || "";
                tweet_id.rem = JSPLib.utility.findAll(twitter_rem, SOURCE_TWITTER_REGEX)[1];
                if (tweet_id.add && tweet_id.rem) {
                    if (tweet_id.add === tweet_id.rem) {
                        tweet_id.add = tweet_id.rem = undefined;
                        account_swaps++;
                    } else {
                        this.debug('log', "ID swap detected", tweet_id.rem, "->", tweet_id.add);
                    }
                }
                if (tweet_id.add) {
                    add_entries[tweet_id.add] = add_entries[tweet_id.add] || [];
                    add_entries[tweet_id.add] = JSPLib.utility.arrayUnion(add_entries[tweet_id.add], [postver.post_id]);
                    if (RemoveHashKeyValue(rem_entries, tweet_id.add[0], postver.post_id)) {
                        this.debug('log', "Source delete reversal detected", tweet_id.add);
                    }
                }
                if (tweet_id.rem) {
                    rem_entries[tweet_id.rem] = rem_entries[tweet_id.rem] || [];
                    JSPLib.utility.arrayUnion(rem_entries[tweet_id.rem], [postver.post_id]);
                    if (RemoveHashKeyValue(add_entries, tweet_id.rem, postver.post_id)) {
                        this.debug('log', "Source add reversal detected", tweet_id.rem);
                    }
                }
            }
        }
        if (postver.added_tags.includes('bad_twitter_id') || postver.removed_tags.includes('bad_twitter_id')) {
            let tweet_id = JSPLib.utility.findAll(postver.source, TWEET_REGEX)[1];
            if (tweet_id) {
                if (postver.removed_tags.includes('bad_twitter_id')) {
                    this.debug('log', "Activated tweet:", tweet_id);
                    add_entries[tweet_id] = add_entries[tweet_id] || [];
                    add_entries[tweet_id] = JSPLib.utility.arrayUnion(add_entries[tweet_id], [postver.post_id]);
                    reversed_posts++;
                    if (RemoveHashKeyValue(rem_entries, tweet_id, postver.post_id)) {
                        this.debug('log', "Tweet remove reversal detected", tweet_id);
                    }
                } else if (postver.added_tags.includes('bad_twitter_id')) {
                    rem_entries[tweet_id] = rem_entries[tweet_id] || [];
                    rem_entries[tweet_id] = JSPLib.utility.arrayUnion(rem_entries[tweet_id], [postver.post_id]);
                    inactive_posts++;
                    if (RemoveHashKeyValue(add_entries, tweet_id, postver.post_id)) {
                        this.debug('log', "Tweet add reversal detected", tweet_id);
                    }
                }
            }
        }
    });
    if (account_swaps > 0) {
        this.debug('log', "Account swaps detected:", account_swaps);
    }
    if (inactive_posts > 0) {
        this.debug('log', "Inactive tweets detected:", inactive_posts);
    }
    if (reversed_posts > 0) {
        this.debug('log', "Activated tweets detected:", reversed_posts);
    }
    return [add_entries, rem_entries];
}

function GetPageType() {
    NTISAS.page_match = XRegExp.exec(window.location.href.split('#')[0], PageRegex());
    if (!NTISAS.page_match) {
        return 'other';
    }
    switch (NTISAS.page_match.groups.site) {
        case NTISAS.page_match.groups.main:
            return 'main';
        case NTISAS.page_match.groups.media:
            return 'media';
        case NTISAS.page_match.groups.search:
            return 'search';
        case NTISAS.page_match.groups.tweet:
            return 'tweet';
        case NTISAS.page_match.groups.web_tweet:
            return 'web_tweet';
        case NTISAS.page_match.groups.hashtag:
            return 'hashtag';
        case NTISAS.page_match.groups.list:
            return 'list';
        case NTISAS.page_match.groups.home:
            return 'home';
        case NTISAS.page_match.groups.likes:
            return 'likes';
        case NTISAS.page_match.groups.replies:
            return 'replies';
        case NTISAS.page_match.groups.photo:
            return 'photo';
        case NTISAS.page_match.groups.topics:
            return 'topics';
        case NTISAS.page_match.groups.moments:
            return 'moments';
        case NTISAS.page_match.groups.display:
            return 'display';
        default:
            this.debug('warn', "Regex error:", window.location.href, NTISAS.page_match);
            return 'default';
    }
}

function UpdateSideMenu() {
    let menu_shown = GetLocalData('ntisas-side-menu', true);
    if (menu_shown) {
        $('#ntisas-account-options').addClass('ntisas-activated');
        $('#ntisas-side-menu').show();
    } else {
        $('#ntisas-account-options').removeClass('ntisas-activated');
        $('#ntisas-side-menu').hide();
    }
}

function UpdateDownloadControls() {
    if (!NTISAS.user_settings.original_download_enabled) {
        return;
    }
    let downloads_enabled = GetLocalData('ntisas-download-menu', true);
    if (downloads_enabled) {
        DisplayControl('disable', DOWNLOAD_CONTROLS, 'downloads');
    } else {
        DisplayControl('enable', DOWNLOAD_CONTROLS, 'downloads');
    }
}

function UpdateDownloadSection() {
    if (!NTISAS.user_settings.original_download_enabled) {
        return;
    }
    let downloads_enabled = GetLocalData('ntisas-download-menu', true);
    if (downloads_enabled) {
        $('.ntisas-download-header, .ntisas-download-stub, .ntisas-download-section').show();
    } else {
        $('.ntisas-download-header, .ntisas-download-stub, .ntisas-download-section').hide();
    }
}

function UpdateViewHighlightControls() {
    let show_highlights = GetLocalData('ntisas-view-highlights', true);
    let switch_type = (show_highlights ? 'disable' : 'enable');
    DisplayControl(switch_type, VIEW_HIGHLIGHT_CONTROLS, 'view-highlights');
}

function UpdateViewCountControls() {
    let count_views = NTISAS.count_views = GetLocalData('ntisas-view-counts', true);
    let switch_type = (count_views ? 'disable' : 'enable');
    DisplayControl(switch_type, VIEW_COUNT_CONTROLS, 'view-counts');
}

function UpdateViewHighlights() {
    let show_highlights = GetLocalData('ntisas-view-highlights', true);
    if (show_highlights) {
        $('[role=main]').addClass('ntisas-show-views');
    } else {
        $('[role=main]').removeClass('ntisas-show-views');
    }
}

function UpdateIQDBControls() {
    if (!NTISAS.user_settings.autoclick_IQDB_enabled) {
        return;
    }
    let [user_ident, all_idents] = GetUserIdent();
    if (user_ident && IsMediaTimeline()) {
        let auto_iqdb_list = GetList('auto-iqdb-list');
        if (JSPLib.utility.arrayHasIntersection(auto_iqdb_list, all_idents)) {
            NTISAS.artist_iqdb_enabled = true;
            DisplayControl('disable', IQDB_CONTROLS, 'autoiqdb');
        } else {
            NTISAS.artist_iqdb_enabled = false;
            DisplayControl('enable', IQDB_CONTROLS, 'autoiqdb');
        }
    } else if (IsTweetPage()) {
        NTISAS.artist_iqdb_enabled = false;
        DisplayControl('active', IQDB_CONTROLS, 'autoiqdb');
    } else {
        NTISAS.artist_iqdb_enabled = false;
        $('#ntisas-unavailable-autoiqdb').show();
        DisplayControl('unavailable', IQDB_CONTROLS, 'autoiqdb');
    }
}

function DisplayControl(control, all_controls, type) {
    let all_selectors = JSPLib.utility.joinList(all_controls, '#ntisas-', '-' + type, ',');
    $(all_selectors).hide();
    setTimeout(() => {$(`#ntisas-${control}-${type}`).show();}, JQUERY_DELAY);
}

async function GetAllCurrentRecords() {
    let i = 0;
    while (true) {
        if (!WasOverflow() || !NTISAS.database_info) {
            //Main exit condition
            break;
        }
        clearTimeout(CheckPostvers.timeout);
        if (JSPLib.concurrency.reserveSemaphore(PROGRAM_SHORTCUT, 'postvers')) {
            JSPLib.notice.notice(`Querying Danbooru...[${i}]`, false, false);
            await CheckPostvers();
        } else {
            JSPLib.notice.notice(`Waiting on other tasks to finish...[${i}]`, false, false);
            await JSPLib.utility.sleep(POST_VERSIONS_CALLBACK);
        }
        i++;
    }
}

async function PickImage(event, type, pick_func) {
    let similar_class = 'ntisas-check-' + type;
    let [$link, $tweet, tweet_id,,,,, $replace] = GetEventPreload(event, similar_class);
    let all_image_urls = await GetImageLinks($tweet[0]);
    if (all_image_urls.length === 0) {
        this.debug('log', "Images not loaded yet.");
        JSPLib.notice.debugNoticeLevel("No images detected.", JSPLib.debug.DEBUG);
        return false;
    }
    this.debug('log', "All:", all_image_urls);
    var selected_image_urls;
    if ((all_image_urls.length > 1) && IsQuerySettingEnabled('pick_image', type) && (typeof pick_func !== 'function' || pick_func())) {
        if (!NTISAS.tweet_dialog[tweet_id]) {
            NTISAS.tweet_dialog[tweet_id] = InitializeConfirmContainer(all_image_urls);
            NTISAS.dialog_ancor[tweet_id] = $link;
        }
        NTISAS.tweet_dialog[tweet_id].dialog('open');
        let status = await NTISAS.tweet_dialog[tweet_id].prop('promiseConfirm');
        if (!status) {
            this.debug('log', "Exiting...");
            return false;
        }
        let selected_indexes = GetSelectPostIDs(tweet_id, 'tweet_dialog');
        selected_image_urls = all_image_urls.filter((image, index) => selected_indexes.includes(index));
    } else {
        selected_image_urls = all_image_urls;
    }
    this.debug('log', "Selected:", selected_image_urls);
    $link.removeClass(similar_class).html("loading…");
    return [$link, $tweet, tweet_id, $replace, selected_image_urls];
}

function ProcessSimilarData(type, tweet_id, $tweet, $replace, selected_image_urls, similar_data, autosave_func) {
    let flat_data = similar_data.flat();
    if (flat_data.length > 0) {
        let max_score = Math.max(...JSPLib.utility.getObjectAttributes(flat_data, 'score'));
        let level = 'poor';
        if (max_score > 95.0) {
            level = 'great';
        } else if (max_score > 90.0) {
            level = 'good';
        } else if (max_score > 85.0) {
            level = 'fair';
        }
        let similar_post_ids = JSPLib.utility.arrayUnique(JSPLib.utility.getNestedObjectAttributes(flat_data, ['post', 'id']));
        if (IsQuerySettingEnabled('auto_save', type) || ((typeof autosave_func === 'function') && autosave_func())) {
            if (NTISAS.merge_results.includes(tweet_id)) {
                let merge_ids = GetSessionTwitterData(tweet_id);
                similar_post_ids = JSPLib.utility.arrayUnion(merge_ids, similar_post_ids);
            }
            SaveData('tweet-' + tweet_id, similar_post_ids, 'twitter');
            InitializePostIDsLink(tweet_id, $replace, $tweet[0], similar_post_ids);
            NTISAS.channel.postMessage({type: 'postlink', tweet_id, post_ids: similar_post_ids});
        } else {
            $replace.html(RenderSimilarIDsLink(similar_post_ids, flat_data, level, type));
            NTISAS.similar_results[tweet_id] = similar_post_ids;
            if (NTISAS.user_settings.advanced_tooltips_enabled) {
                let $postlink = $('.ntisas-confirm-save', $tweet[0]);
                InitializeQtip($postlink, tweet_id);
                //Some elements are delayed in rendering, so render ahead of time
                NTISAS.tweet_qtip[tweet_id] = InitializeSimilarContainer(selected_image_urls, similar_data, tweet_id, type);
            }
        }
    } else {
        SaveData(type + '-' + tweet_id, {value: true, expires: JSPLib.utility.getExpires(SIMILAR_EXPIRES)}, 'danbooru');
        InitializeNoMatchesLinks(tweet_id, $replace);
    }
}

function GetTweetInfo($tweet) {
    let tweet_id = String($tweet.data('tweet-id'));
    let user_id = String($tweet.data('user-id') || "");
    let screen_name = String($tweet.data('screen-name'));
    let user_ident = user_id || screen_name;
    let all_idents = JSPLib.utility.arrayUnique([user_ident, screen_name]);
    return [tweet_id, user_id, screen_name, user_ident, all_idents];
}

function GetEventPreload(event, classname) {
    let $link = $(event.target);
    let $tweet = $link.closest('[ntisas-tweet]');
    let [tweet_id, user_id, screen_name, user_ident, all_idents] = GetTweetInfo($tweet);
    let $replace = $tweet.find(`.${classname}`);
    let replace_level = $replace.data('replace') || 1;
    $replace = $(JSPLib.utility.getNthParent($replace.get(0), replace_level));
    return [$link, $tweet, tweet_id, user_id, screen_name, user_ident, all_idents, $replace];
}

function IsPageType(types) {
    return types.includes(NTISAS.page) || (NTISAS.page === 'display' && types.includes(NTISAS.prev_page));
}

function IsTweetPage() {
    return IsPageType(['tweet', 'web_tweet']);
}

function IsMediaTimeline() {
    return (NTISAS.page === 'media') || (NTISAS.page === 'search' && NTISAS.account && MEDIA_TYPES.includes(NTISAS.queries.filter));
}

function IsIQDBAutoclick() {
    return NTISAS.user_settings.autoclick_IQDB_enabled && ((NTISAS.artist_iqdb_enabled && IsMediaTimeline()) || IsTweetPage());
}

function GetLowestRequestedTweetID(account) {
    let account_requests = TIMELINE_REQUESTS.filter((request) => request.account === account);
    let tweet_ids = account_requests.map((request) => BigInt(request.tweet_id));
    return JSPLib.utility.bigIntMin(...tweet_ids);
}

function GetMaxVideoURL(media_data, index) {
    let variants = media_data.video_info.variants.filter((variant) => Number.isInteger(variant.bitrate));
    if (index >= variants.length) {
        return null;
    }
    let sorted_variants = variants.sort((a, b) => b.bitrate - a.bitrate);
    return new URL(sorted_variants[index].url).pathname.slice(1);
}

//File functions

function ReadFileAsync(fileselector, is_json) {
    const context = this;
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
                context.debug('log', "File loaded:", file.size);
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
    let current_message = (!CheckLocalData('ntisas-recent-timestamp') ? MUST_INSTALL_HELP : UPDATE_RECORDS_HELP);
    return JSPLib.utility.regexReplace(SIDE_MENU, {
        CURRENTRECORDS: RenderCurrentRecords(),
        CURRENTHELP: RenderHelp(current_message),
        RECORDSHELP: RenderHelp(REFRESH_RECORDS_HELP),
        SAUCEHELP: RenderHelp(AVAILABLE_SAUCE_HELP),
        DOWNLOADS: DOWNLOADS_HTML,
        DOWNLOADSHELP: RenderHelp(DOWNLOADS_HELP),
        VIEW_HIGHLIGHTS: VIEW_HIGHLIGHTS_HTML,
        VIEW_HIGHLIGHTS_HELP: RenderHelp(VIEWS_HIGHLIGHTS_HELP),
        VIEW_COUNTS: VIEW_COUNTS_HTML,
        VIEW_COUNTS_HELP: RenderHelp(VIEWS_COUNTS_HELP),
        AUTOCLICKIQDB: AUTO_IQDB_HTML,
        AUTOCLICKIQDBHELP: RenderHelp(AUTO_IQDB_HELP),
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
    let timestamp = CheckLocalData('ntisas-recent-timestamp');
    if (timestamp) {
        let timestring = new Date(timestamp).toLocaleString();
        let timeagostring = ((Date.now() - timestamp) < GetPostVersionsExpiration() * 2 ? "Up to date" : TimeAgo(timestamp));
        record_html = `<a id="ntisas-current-records" class="ntisas-expanded-link" title="${timestring}">${timeagostring}</a>`;
    } else {
        record_html = '<span id="ntisas-current-records">Loading...</span>';
    }
    return record_html;
}

function RenderDatabaseVersion() {
    let timestring = new Date(NTISAS.server_info.timestamp).toLocaleString();
    let url = `${NTISAS.domain}/post_versions?page=b${NTISAS.server_info.post_version + 1}`;
    return `<a id="ntisas-database-version" class="ntisas-expanded-link" href="${url}" title="${timestring}">${NTISAS.server_info.post_version}</a>`;
}

async function RenderDownloadLinks($tweet, is_video, image_links) {
    let [tweet_id, user_id, screen_name,, ] = GetTweetInfo($tweet);
    let date_string = GetDateString(Date.now());
    let time_string = GetTimeString(Date.now());
    NTISAS.filename_prefix = JSPLib.utility.regexReplace(NTISAS.user_settings.filename_prefix_format, {
        TWEETID: tweet_id,
        USERID: user_id,
        USERACCOUNT: screen_name,
        DATE: date_string,
        TIME: time_string
    });
    if (!image_links) {
        image_links = await GetImageLinks($tweet[0]);
    }
    var hrefs = image_links.map((image) => (image + ':orig'));
    var html = "";
    for (let i = 0; i < image_links.length; i++) {
        let image_num = i + 1;
        let [image_name, extension] = GetFileURLNameExt(image_links[i]);
        let download_filename = JSPLib.utility.regexReplace(NTISAS.filename_prefix, {
            ORDER: 'img' + String(image_num),
            IMG: image_name
        }) + '.' + extension;
        html += `<span class="ntisas-download-button"><a class="ntisas-download-original ntisas-download-image ntisas-expanded-link" href="${hrefs[i]}" download="${download_filename}">Image #${image_num}</a></span>`;
    }
    if (is_video) {
        html += '<span class="ntisas-download-button" style="display:none;"><a class="ntisas-download-original ntisas-download-video ntisas-expanded-link">Video #1</a></span>';
    }
    if (image_links.length > 1) {
        html += '<span class="ntisas-download-button"><a class="ntisas-download-all ntisas-expanded-link" href="javascript:void(0)">All images</a></span>';
    }
    return html;
}

function RenderPostIDsLink(posts, classname) {
    let mergelink = '<a class="ntisas-merge-results ntisas-expanded-link" data-replace="2">Merge</a>';
    let helpinfo = CONFIRM_DELETE_HELP + '\n' + MERGE_RESULTS_HELP;
    let helplink = RenderHelp(helpinfo);
    let post_ids = JSPLib.utility.getObjectAttributes(posts, 'id');
    var title, href, text;
    if (posts.length === 1) {
        title = GetLinkTitle(posts[0]);
        href = `${NTISAS.domain}/posts/${post_ids[0]}`;
        text = 'post #' + post_ids[0];
    } else {
        title = GetMultiLinkTitle(posts);
        href = `${NTISAS.domain}/posts?tags=status%3Aany+id%3A${post_ids.join(',')}${GetCustomQuery()}`;
        text = post_ids.length + ' sources';
    }
    let idlink = `
<a
    class="ntisas-confirm-delete ${classname} ntisas-expanded-link"
    target="_blank"
    title="${title}"
    href="${href}"
    data-replace="2"
    >
    ${text}
</a>`;
    return `
<span class="ntisas-query-button" style="border-radius: 25px 0 0 25px; min-width: 8em;">${idlink}</span>
|
<span class="ntisas-query-button">${mergelink}</span>
|
<span class="ntisas-query-button" style="border-radius: 0 25px 25px 0; min-width: 2em;">${helplink}</span>
`;
}

function RenderSimilarIDsLink(post_ids, similar_data, level, type) {
    let helplink = RenderHelp(CONFIRM_IQDB_HELP);
    var title, href, text;
    if (similar_data.length === 1) {
        title = GetLinkTitle(similar_data[0].post);
        href = `${NTISAS.domain}/posts/${post_ids[0]}`;
        text = 'post #' + post_ids[0];
    } else {
        let all_posts = JSPLib.utility.getObjectAttributes(similar_data, 'post');
        let unique_posts = RemoveDuplicates(all_posts, 'id');
        title = GetMultiLinkTitle(unique_posts);
        href = `${NTISAS.domain}/posts?tags=status%3Aany+id%3A${post_ids.join(',')}${GetCustomQuery()}`;
        text = post_ids.length + ' sources';
    }
    let idlink = `
<a
    class="ntisas-confirm-save ntisas-expanded-link"
    ntisas-similar-match="${level}"
    data-type="${type}"
    target="_blank"
    title="${title}"
    href="${href}"
    data-replace="2"
    >
    ${text}
</a>`;
    return `
<span class="ntisas-query-button" style="border-radius: 25px 0 0 25px; min-width: 8em;">${idlink}</span>
|
<span class="ntisas-query-button" style="border-radius: 0 25px 25px 0; min-width: 2em;">${helplink}</span>
`;
}

function RenderAllSimilar(all_iqdb_results, image_urls, type) {
    var image_results = [];
    var max_results = 0;
    all_iqdb_results.forEach((iqdb_results, i) => {
        if (iqdb_results.length === 0) {
            return;
        }
        max_results = Math.max(max_results, iqdb_results.length);
        let html = RenderSimilarContainer("Image " + (i + 1), iqdb_results, image_urls[i], i);
        image_results.push(html);
    });
    let render_width = Math.min(((max_results + 1) * BASE_PREVIEW_WIDTH) + BASE_QTIP_WIDTH + 20, 1000);
    return `
<div class="ntisas-similar-results ntisas-qtip-container" data-type="${type}" style="width:${render_width}px">
    ${image_results.join(HORIZONTAL_RULE)}
</div>`;
}

function RenderSimilarContainer(header, iqdb_results, image_url, index) {
    var html = RenderTwimgPreview(image_url, index);
    html += `<div class="ntisas-vr"></div>`;
    iqdb_results.forEach((iqdb_result) => {
        let is_user_upload = iqdb_result.post.uploaderid === NTISAS.user_data.id;
        let addons = RenderPreviewAddons(iqdb_result.post.source, null, iqdb_result.score, iqdb_result.post.ext, iqdb_result.post.size, iqdb_result.post.width, iqdb_result.post.height, is_user_upload);
        html += RenderPostPreview(iqdb_result.post, addons);
    });
    let controls = (iqdb_results.length > 1 ? SELECTION_CONTROLS : "");
    return `
<div class="ntisas-similar-result ntisas-selectable-results">
    <div style="position: relative;">
        <h4>${header} (${RenderHelp(IQDB_SELECT_HELP)})</h4>
        ${controls}
    </div>
    ${html}
</div>`;
}

function RenderConfirmContainer(image_urls) {
    let html = "";
    image_urls.forEach((image, i) => {
        html += RenderTwimgPreview(image, i, true);
    });
    let controls = (image_urls.length > 1 ? `<div style="position: relative; display: block; width: 10em;">${SELECTION_CONTROLS}</div>` : "");
    return `
<div class="ntisas-confirm-image ntisas-selectable-results">
    <p style="font-size:12px">Selected images will be used for the query. Press <b>Submit</b> to execute query, or <b>Cancel</b> to go back.</p>
    ${html}
    ${controls}
</div>`;
}

function RenderPostsContainer(all_posts) {
    let html = "";
    all_posts.forEach((post) => {
        let is_user_upload = post.uploaderid === NTISAS.user_data.id;
        let addons = RenderPreviewAddons(post.source, post.id, null, post.ext, post.size, post.width, post.height, is_user_upload);
        html += RenderPostPreview(post, addons);
    });
    let controls = (all_posts.length > 1 ? `<div style="position: relative; height: 1.5em; margin-top: 1em">${SELECTION_CONTROLS}</div>` : "");
    let width_addon = (all_posts.length > 5 ? 'style="width:850px"' : "");
    return `
<div class="ntisas-post-result ntisas-qtip-container ntisas-selectable-results" ${width_addon}>
    <h4>Danbooru matches (${RenderHelp(POST_SELECT_HELP)})</h4>
    ${html}
    ${controls}
</div>`;
}

//Expects a mapped post as input
function RenderPostPreview(post, append_html = "") {
    let [width, height] = JSPLib.utility.getPreviewDimensions(post.width, post.height, POST_PREVIEW_DIMENSION);
    let padding_height = POST_PREVIEW_DIMENSION - height;
    return `
<article class="ntisas-post-preview ntisas-post-selectable ntisas-post-select" data-id="${post.id}" data-size="${post.size}">
    <div class="ntisas-image-container">
        <a target="_blank" href="https://danbooru.donmai.us/posts/${post.id}">
            <img width="${width}" height="${height}" style="padding-top:${padding_height}px" title="${GetLinkTitle(post)}">
        </a>
    </div>
    ${append_html}
</article>`;
}

function RenderTwimgPreview(image_url, index, selectable) {
    let file_type = GetFileExtension(image_url, ':');
    let thumb_url = GetThumbUrl(image_url, ':', 'jpg', '360x360');
    let image_html = `<img width="${POST_PREVIEW_DIMENSION}" height="${POST_PREVIEW_DIMENSION}" src="${thumb_url}">`;
    let selected_class = "";
    if (selectable) {
        image_html = `<a>${image_html}</a>`;
        selected_class = 'ntisas-post-select ntisas-post-selectable';
    }
    let append_html = RenderPreviewAddons('https://twitter.com', null, null, file_type);
    return `
<article class="ntisas-post-preview ntisas-tweet-preview ${selected_class}" data-id="${index}">
    <div class="ntisas-image-container">
        ${image_html}
    </div>
    ${append_html}
</article>`;
}

function RenderPreviewAddons(source, id, score, file_ext, file_size, width, height, is_user_upload = false) {
    let title_text = "Original image";
    if (JSPLib.validate.validateID(id)) {
        title_text = "post #" + id;
    } else if (JSPLib.validate.isNumber(score)) {
        title_text = `Similarity: ${JSPLib.utility.setPrecision(score, 2)}`;
    }
    let uploader_addon = (is_user_upload ? 'class="ntisas-post-upload"' : "");
    let domain = (source.match(/^https?:\/\//) ? JSPLib.utility.getDomainName(source, 2) : "NON-WEB");
    let size_text = (Number.isInteger(file_size) && Number.isInteger(width) && Number.isInteger(height) ? `${ReadableBytes(file_size)} (${width}x${height})` : "");
    return `
<p class="ntisas-desc ntisas-desc-title"><span ${uploader_addon}>${title_text}</span></p>
<p class="ntisas-desc ntisas-desc-info">${file_ext.toUpperCase()} @ <span title="${domain}">${domain}</span></p>
<p class="ntisas-desc ntisas-desc-size">${size_text}</p>`;
}

function RenderNomatchLinks(tweet_id, no_iqdb_results, no_sauce_results, merge_results = false) {
    let results_link = (!merge_results ? '<a class="ntisas-manual-add ntisas-database-no-match ntisas-no-sources ntisas-expanded-link" data-replace="2">no sources</a>' : '<a class="ntisas-cancel-merge ntisas-expanded-link" data-replace="2">Cancel</a>');
    let no_url_results = NTISAS.no_url_results.includes(tweet_id);
    let iqdb_link = (no_iqdb_results ? '<a class="ntisas-reset-results ntisas-database-no-match ntisas-no-results ntisas-expanded-link" data-type="iqdb" data-replace="2">no results</a>' : '<a class="ntisas-check-iqdb ntisas-expanded-link" data-replace="2">IQDB</a>');
    let url_link = (no_url_results ? '<a class="ntisas-manual-add ntisas-database-no-match ntisas-no-sources ntisas-expanded-link" data-replace="2">no sources</a>' : '<a class="ntisas-check-url ntisas-expanded-link" data-replace="2">URL</a>');
    let sauce_link = (no_sauce_results ? '<a class="ntisas-reset-results ntisas-database-no-match ntisas-no-sources ntisas-expanded-link" data-type="sauce" data-replace="2">no results</a>' : '<a class="ntisas-check-sauce ntisas-expanded-link" data-replace="2">Sauce</a>');
    let help_info = GetNomatchHelp(no_url_results, no_iqdb_results, no_sauce_results);
    return `
<span class="ntisas-query-button" style="border-radius: 25px 0 0 25px;">${results_link}</span>
    |
<span class="ntisas-query-button">${url_link}</span>
    |
<span class="ntisas-query-button">${iqdb_link}</span>
    |
<span class="ntisas-query-button">${sauce_link}</span>
    |
<span class="ntisas-query-button" style="border-radius: 0 25px 25px 0; min-width: 2em;">${RenderHelp(help_info)}</span>
`;
}

function RenderHelp(help_text) {
    return `<a class="ntisas-help-info ntisas-expanded-link" title="${help_text}">&nbsp;?&nbsp;</a>`;
}

function RenderColorStyle(color_data) {
    return JSPLib.utility.regexReplace(COLOR_CSS, {
        BASECOLOR: JSPLib.utility.sprintf('rgb(%s, %s, %s)', ...color_data.base_color),
        BASEFAINT: JSPLib.utility.sprintf('rgb(%s, %s, %s, 0.1)', ...color_data.base_color),
        BASESHADED: JSPLib.utility.sprintf('rgb(%s, %s, %s, 0.5)', ...color_data.base_color),
        BASEDARKER: JSPLib.utility.sprintf('rgb(%s, %s, %s)', ...DarkenColorArray(color_data.base_color)),
        TEXTCOLOR: JSPLib.utility.sprintf('rgb(%s, %s, %s)', ...color_data.text_color),
        TEXTFADED: JSPLib.utility.sprintf('rgb(%s, %s, %s, 0.1)', ...color_data.text_color),
        TEXTMUTED: JSPLib.utility.sprintf('rgb(%s, %s, %s, 0.2)', ...color_data.text_color),
        TEXTSHADED: JSPLib.utility.sprintf('rgb(%s, %s, %s, 0.5)', ...color_data.text_color),
        BACKGROUNDCOLOR: JSPLib.utility.sprintf('rgb(%s, %s, %s)', ...color_data.background_color)
    });
}

function DarkenColorArray(array) {
    return array.map((val) => Math.max(Number(val) - 50, 0).toString());
}

function RenderListInfo() {
    let auto_iqdb_list = GetList('auto-iqdb-list');
    return `
<table class="jsplib-striped">
    <thead>
        <tr>
            <th>Name</th>
            <th>Items</th>
            <th>Size</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <th>IQDB</th>
            <td>${auto_iqdb_list.length}</td>
            <td>${JSON.stringify(auto_iqdb_list).length}</td>
        </tr>
    </tbody>
</table>`;
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

//Initialize functions

function CleanupTasks() {
    CheckDatabaseInfo();
    CheckServerBadTweets();
    CheckPurgeBadTweets();
    JSPLib.storage.pruneEntries(PROGRAM_SHORTCUT, PROGRAM_DATA_REGEX, PRUNE_RECHECK_EXPIRES);
}

function InitializeColorScheme() {
    if (!JSPLib.utility.hasStyle('color')) {
        let color_data = CheckLocalData('ntisas-color-style');
        if (color_data) {
            let color_style = RenderColorStyle(color_data);
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
    $('#ntisas-side-menu [data-setting]').each((i, entry) => {
        let setting = $(entry).data('setting');
        if (NTISAS.user_settings[setting]) {
            $(entry).show();
        } else {
            $(entry).hide();
        }
    });
    let selected_menu = JSPLib.storage.checkStorageData('ntisas-side-selection', ValidateProgramData, localStorage, 'info');
    $(`#ntisas-menu-selection a[data-selector=${selected_menu}]`).addClass('ntisas-selected');
    $(`#ntisas-content div[data-selector=${selected_menu}]`).show();
    JSPLib.storage.checkLocalDB('ntisas-available-sauce', ValidateEntry, SAUCE_EXPIRES).then((data) => {
        if (data) {
            $('#ntisas-available-sauce').text(data.value);
        }
    });
}

function InitializeDatabaseLink() {
    var database_html = "";
    var database_help = "";
    if (NTISAS.user_settings.bypass_server_mode) {
        $('#ntisas-database-link').html('<span id="ntisas-server-bypass">Server Bypass</span>');
        $('#ntisas-database-help').html(RenderHelp(MANUAL_INSTALL_HELP));
        return;
    }
    NTISAS.server_info = GetRemoteDatabase();
    if (NTISAS.server_info === null) {
        return;
    }
    let database_timestring = new Date(NTISAS.server_info.timestamp).toLocaleString();
    //Add some validation to the following, and move it out of the RenderSideMenu function
    JSPLib.storage.retrieveData('ntisas-database-info', false, JSPLib.storage.twitterstorage).then((database_info) => {
        if (!JSPLib.validate.isHash(database_info)) {
            database_html = `<a id="ntisas-install" class="ntisas-expanded-link" title="${database_timestring}">Install Database</a>`;
            database_help = RenderHelp(INSTALL_DATABASE_HELP);
            $('#ntisas-current-records').html(INSTALL_MENU_TEXT);
        } else if (database_info.post_version === NTISAS.server_info.post_version && database_info.timestamp === NTISAS.server_info.timestamp) {
            NTISAS.database_info = database_info;
            database_html = RenderDatabaseVersion();
            database_help = RenderHelp(DATABASE_VERSION_HELP);
        } else {
            NTISAS.database_info = database_info;
            database_html = `<a id="ntisas-upgrade" class="ntisas-expanded-link" title="${database_timestring}">Upgrade Database</a>`;
            database_help = RenderHelp(UPGRADE_DATABASE_HELP);
        }
        $('#ntisas-database-link').html(database_html);
        $('#ntisas-database-help').html(database_help);
        $('#ntisas-database-version').on(PROGRAM_CLICK, CurrentPostver);
        $('#ntisas-install').on(PROGRAM_CLICK, InstallDatabase);
        $('#ntisas-upgrade').on(PROGRAM_CLICK, UpgradeDatabase);
    });
}

function InitializeCurrentRecords() {
    $('#ntisas-current-records').replaceWith(RenderCurrentRecords());
    $('#ntisas-current-records').on(PROGRAM_CLICK, CurrentRecords);
    $('#ntisas-current-records-help a').attr('title', UPDATE_RECORDS_HELP);
}

async function InitializeImageMenu($tweets, menu_class) {
    let promise_array = [];
    $tweets.each((i, tweet) => {
        let p = JSPLib.utility.createPromise();
        promise_array.push(p.promise);
        let tweet_id = String($(tweet).data('tweet-id'));
        let $link_container = $(`<div class="ntisas-link-menu ${menu_class} ntisas-links"><span style="font-weight:bold">Loading...</span></div>`);
        $('.ntisas-image-section', tweet).append($link_container);
        GetData('tweet-' + tweet_id, 'twitter').then((post_ids) => {
            if (post_ids !== null) {
                InitializePostIDsLink(tweet_id, $link_container, tweet, post_ids);
            } else {
                InitializeNoMatchesLinks(tweet_id, $link_container);
            }
            p.resolve(null);
        });
    });
    await Promise.all(promise_array);
}

function InitializeMediaTweet(tweet_id, post_ids, tweet_dict_promise) {
    let $tweet = $(`.ntisas-media-tweet[data-tweet-id=${tweet_id}]`);
    let screen_name = $tweet.data('screen-name');
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
            $media_icon.append(JSPLib.utility.sprintf(MEDIA_COUNTER_ICON, '0'));
        }
    }
    $media_icon.on(PROGRAM_CLICK, OpenMediaTweetMenu);
    if (NTISAS.user_settings.display_tweet_views) {
        GetData('view-' + tweet_id, 'danbooru').then((views) => {
            if (views && views.value.count > 0) {
                let timeagostring = ((Date.now() - views.value.viewed) < VIEWCOUNT_RECENT_DURATION ? "recently" : TimeAgo(views.value.viewed));
                let $view_icon = $(`<div class="ntisas-media-view-icon" title="Viewed ${timeagostring} [${views.value.count}]"></div>`);
                $tweet.append($view_icon[0]);
            }
        });
    }
    if (NTISAS.user_settings.auto_unhide_tweets_enabled && $tweet.get(0).innerText.split('\n').some((text) => text.match(/^Warning:/))) {
        $tweet.find('[role="button"]').click();
    }
}

function InitializeQtip($obj, tweet_id, delayfunc) {
    const qtip_settings = Object.assign({}, PREVIEW_QTIP_SETTINGS, {
        content: {
            text: (event, qtip) => {
                if (!qtip.tooltip[0].hasAttribute(PROGRAM_SHORTCUT)) {
                    if (delayfunc) {
                        let results = delayfunc();
                        if (results === false) {
                            return "Loading...";
                        }
                        NTISAS.tweet_qtip[tweet_id] = results;
                    }
                    qtip.tooltip.attr(PROGRAM_SHORTCUT, 'done');
                }
                return NTISAS.tweet_qtip[tweet_id] || "Loading...";
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


function InitializeSimilarContainer(image_urls, similar_results, tweet_id, type) {
    let $attachment = $(RenderAllSimilar(similar_results, image_urls, type));
    let all_posts = JSPLib.utility.getObjectAttributes(similar_results.flat(), 'post');
    SetThumbnailWait($attachment[0], all_posts);
    $('article:first-of-type', $attachment[0]).each((i, article) => {
        InitializeTwitterImage(article, image_urls).then(({size}) => {
            $(article).closest('.ntisas-similar-result').find(`[data-size=${size}]`).addClass('ntisas-post-match');
        });
    });
    return $attachment;
}

function InitializeConfirmContainer(image_urls) {
    let $dialog = $(RenderConfirmContainer(image_urls));
    const dialog_settings = Object.assign({}, CONFIRM_DIALOG_SETTINGS, {
        width: BASE_DIALOG_WIDTH + BASE_PREVIEW_WIDTH * image_urls.length
    });
    $('article', $dialog[0]).each((i, article) => {
        InitializeTwitterImage(article, image_urls);
    });
    InitializeUIStyle();
    $dialog.dialog(dialog_settings);
    return $dialog;
}

function InitializeTwitterImage(article, image_urls) {
    let index = Number($(article).data('id'));
    let image_url = image_urls[index] + ':orig';
    let image = $('img', article)[0];
    let image_promise = GetImageAttributes(image_url);
    image_promise.then(({size, width, height}) => {
        let [preview_width, preview_height] = JSPLib.utility.getPreviewDimensions(width, height, POST_PREVIEW_DIMENSION);
        image.width = preview_width;
        image.height = preview_height;
        image.style.paddingTop = `${POST_PREVIEW_DIMENSION - preview_height}px`;
        let size_text = (size > 0 ? ReadableBytes(size) : 'Unavailable');
        $('p:nth-child(4)', article).html(`${size_text} (${width}x${height})`);
    });
    return image_promise;
}

function InitializePostsContainer(all_posts, image_urls) {
    let $attachment = $(RenderPostsContainer(all_posts));
    SetThumbnailWait($attachment[0], all_posts);
    image_urls.forEach((image_url) => {
        JSPLib.network.getDataSize(image_url + ':orig').then((size) => {
            $(`[data-size=${size}]`, $attachment[0]).addClass('ntisas-post-match');
        });
    });
    return $attachment;
}

async function InitializePostIDsLink(tweet_id, $link_container, tweet, post_ids) {
    let posts_data = await GetPosts(post_ids);
    $link_container.html(RenderPostIDsLink(posts_data, 'ntisas-database-match'));
    if (NTISAS.user_settings.advanced_tooltips_enabled) {
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
        let $media_results = $(`.ntisas-media-tweet[data-tweet-id="${tweet_id}"] .ntisas-media-results`);
        $media_results.text(post_ids.length);
        $media_results.css('background-color', 'green');
    }
}

async function InitializeNoMatchesLinks(tweet_id, $obj) {
    let [iqdb_results, sauce_results] = await Promise.all([
        GetData('iqdb-' + tweet_id, 'danbooru'),
        GetData('sauce-' + tweet_id, 'danbooru'),
    ]);
    let merge_results = NTISAS.merge_results.includes(tweet_id);
    $obj.html(RenderNomatchLinks(tweet_id, iqdb_results !== null && iqdb_results.value, sauce_results !== null && sauce_results.value, merge_results));
    if (NTISAS.page === 'media') {
        let $media_results = $(`.ntisas-media-tweet[data-tweet-id="${tweet_id}"] .ntisas-media-results`);
        $media_results.text('·');
        $media_results.css('background-color', 'grey');
    }
}

async function InitializeViewCount(tweet) {
    let tweet_id = String($(tweet).data('tweet-id'));
    let views = await GetData('view-' + tweet_id, 'danbooru');
    if (views && views.value.count > 0) {
        let timeagostring = ((Date.now() - views.value.viewed) < VIEWCOUNT_RECENT_DURATION ? "recently" : TimeAgo(views.value.viewed));
        $('.ntisas-view-info', tweet).append(`<span title="${views.value.count} views">[Viewed ${timeagostring}]</span>`);
        $(tweet).addClass('ntisas-viewed');
    }
    if (!document.hidden && JSPLib.utility.isScrolledIntoView(tweet)) {
        this.debug('logLevel', "Viewable tweet:", tweet_id, JSPLib.utility.DEBUG);
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
        view_time = ((Date.now() - views.value.viewed) < VIEWCOUNT_RECENT_DURATION ? "recently" : TimeAgo(views.value.viewed));
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
            let $entry = $name_line.children().first();
            $entry.css('flex-direction', 'row');
            $entry.find('>div').css('max-width', '60%');
            $entry.append(PROFILE_TIMELINE_HTML);
        }
    } else {
        this.debug('warn', "Unable to find profile attachment point!", $info);
    }
}

function InitializeDownloadLinks($tweet) {
    let p = JSPLib.utility.createPromise();
    let tweet_deferred = $tweet.prop('ntisasDeferred');
    if (tweet_deferred && NTISAS.user_settings.original_download_enabled) {
        tweet_deferred.promise.then(async () => {
            let is_video = Boolean($('.ntisas-tweet-video', $tweet[0]).length);
            let download_html = await RenderDownloadLinks($tweet, is_video);
            let $download_section = $(download_html);
            $('.ntisas-download-section', $tweet[0]).append($download_section);
            if (is_video) {
                let tweet_id = String($tweet.data('tweet-id'));
                GetMaxVideoDownloadLink(tweet_id).then((video_url) => {
                    if (video_url !== null) {
                        SetVideoDownload($download_section, video_url);
                    }
                    p.resolve(null);
                });
            } else {
                p.resolve(null);
            }
        });
    } else {
        $('.ntisas-download-header, .ntisas-download-section').css('display', 'none');
        p.resolve(null);
    }
    return p.promise;
}

async function InitializeUploadlinks(install) {
    NTISAS.photo_index = NTISAS.page_match.groups.photo_index;
    let $photo_container = $('.ntisas-photo-container');
    let selected_photo = $(`li:nth-of-type(${NTISAS.photo_index}) img`, $photo_container[0]);
    if (selected_photo.length === 0) {
        selected_photo = $('img', $photo_container[0]);
        if (selected_photo.length === 0) {
            this.debug('log', "No popup images found!");
            return;
        }
    }
    let image_info = GetImageURLInfo(selected_photo[0].src);
    let tweet_url = JSPLib.utility.findAll(window.location.href, TWEET_URL_REGEX)[0];
    if (!image_info || !tweet_url) {
        return;
    }
    let image_url = await GetNormalImageURL(image_info);
    let orig_image_url = image_url + ':orig';
    let url_addons = $.param({url: orig_image_url, ref: tweet_url});
    let upload_link = `${NTISAS.domain}/uploads/new?${url_addons}`;
    var $link;
    if (install) {
        $link = $(`<div class="ntisas-upload"><a target="_blank" href="${upload_link}">Upload</a></div>`);
        $('.ntisas-photo-menu').append($link);
    } else {
        $link = $('.ntisas-upload a');
        $link.attr('href', upload_link);
    }
    let qtip_key = NTISAS.page_match.groups.photo_id + '-' + NTISAS.page_match.groups.photo_index;
    InitializeQtip($link, qtip_key, async () => {
        let extension = GetFileExtension(image_url).toUpperCase();
        let $container = await GetImageAttributes(orig_image_url).then(({size, width, height}) => {
            let size_text = (size > 0 ? ReadableBytes(size) : 'Unavailable');
            return `<span class="ntisas-code">${size_text} : ${extension} : (${width} x ${height})</span>`;
        });
        return $container;
    });
}

function InitializeMediaLink($tweet) {
    if (NTISAS.user_settings.display_media_link && IsTweetPage()) {
        let screen_name = String($tweet.data('screen-name'));
        let links_html = JSPLib.utility.regexReplace(MEDIA_LINKS_HTML, {SCREENNAME: screen_name});
        $('.r-18u37iz.r-1mi0q7o .r-1wtj0ep').css('display', 'flex');
        JSPLib.utility.recheckTimer({
            check: () => {
                let $mark = $('[data-testid=caret]', $tweet[0]);
                return Boolean($mark.length);
            },
            exec: () => {
                $('[data-testid=caret]', $tweet[0]).before(links_html);
            }
        }, JSPLib.utility.one_second, JSPLib.utility.one_second * 10);
    }
}

function InitializeRetweetDisplay(tweet) {
    let retweet_id = String($(tweet).data('retweet-id'));
    $('.ntisas-retweet-id', tweet).html(`[${retweet_id}]`);
}

function InitializeUserDisplay($tweets) {
    let $tweet = $tweets.filter('[ntisas-tweet=main]');
    if ($tweet.length) {
        let user_id = String($tweet.data('user-id') || "");
        if (user_id) {
            $('.ntisas-user-id', $tweet[0]).html(`<b>User</b> [${user_id}]`);
        }
    }
}

function InitializeImageTweets($image_tweets) {
    const [menu_class, $process_tweets] = IsPageType(STREAMING_PAGES) ? ['ntisas-timeline-menu', $image_tweets] :
        IsTweetPage() ? ['ntisas-tweet-menu', $image_tweets.filter(`[data-tweet-id=${NTISAS.tweet_id}]`)] :
            [null, []];
    if ($process_tweets.length === 0) return;
    const uniqueid = NTISAS.uniqueid;
    const timername = `InitializeImageTweets-${uniqueid}`;
    JSPLib.debug.debugTime(timername);
    const promise_array = [];
    const tweet_ids = JSPLib.utility.arrayUnique(JSPLib.utility.getDOMAttributes($process_tweets, 'tweet-id', String));
    this.debug('log', `[${uniqueid}]`, "Check Tweets:", tweet_ids);
    $process_tweets.each((i, tweet) => {
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
                    InitializeImageMenu($tweet, menu_class),
                    InitializeDownloadLinks($tweet),
                ]).then(() => {
                    p.resolve(null);
                });
                InitializeMediaLink($tweet);
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
    if (QUEUED_STORAGE_REQUESTS.length === 0) {
        return;
    }
    this.debug('logLevel', () => ["Queued requests:", JSPLib.utility.dataCopy(QUEUED_STORAGE_REQUESTS)], JSPLib.debug.VERBOSE);
    for (let database in STORAGE_DATABASES) {
        let requests = QUEUED_STORAGE_REQUESTS.filter((request) => (request.database === database));
        let save_requests = requests.filter((request) => (request.type === 'save'));
        if (save_requests.length) {
            this.debug('logLevel', "Save requests:", save_requests, JSPLib.debug.DEBUG);
            let save_data = Object.assign(...save_requests.map((request) => ({[request.key]: request.value})));
            JSPLib.storage.batchSaveData(save_data, STORAGE_DATABASES[database]).then(() => {
                save_requests.forEach((request) => {
                    request.deferred.resolve(null);
                    request.endtime = performance.now();
                });
            });
        }
        let remove_requests = requests.filter((request) => (request.type === 'remove'));
        if (remove_requests.length) {
            this.debug('logLevel', "Remove requests:", remove_requests, JSPLib.debug.DEBUG);
            let remove_keys = remove_requests.map((request) => request.key);
            JSPLib.storage.batchRemoveData(remove_keys, STORAGE_DATABASES[database]).then(() => {
                remove_requests.forEach((request) => {
                    request.deferred.resolve(null);
                    request.endtime = performance.now();
                });
            });
        }
        let check_requests = requests.filter((request) => (request.type === 'check'));
        if (check_requests.length) {
            this.debug('logLevel', "Check requests:", check_requests, JSPLib.debug.DEBUG);
            let check_keys = check_requests.map((request) => request.key);
            JSPLib.storage.batchCheckLocalDB(check_keys, ValidateEntry, ValidateExpiration, STORAGE_DATABASES[database]).then((check_data) => {
                FulfillStorageRequests(check_keys, check_data, check_requests);
            });
        }
        let noncheck_requests = requests.filter((request) => (request.type === 'get'));
        if (noncheck_requests.length) {
            this.debug('logLevel', "Noncheck requests:", noncheck_requests, JSPLib.debug.DEBUG);
            let noncheck_keys = noncheck_requests.map((request) => request.key);
            JSPLib.storage.batchRetrieveData(noncheck_keys, STORAGE_DATABASES[database]).then((noncheck_data) => {
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
    TimelineHandler.is_busy = true;
    let accounts = JSPLib.utility.arrayUnique(TIMELINE_REQUESTS.map((request) => request.account));
    for (let i = 0; i < accounts.length; i++) {
        let account = accounts[i];
        if (!TIMELINE_VALS.user_ids[account]) {
            TIMELINE_VALS.user_ids[account] = await GetUserRestID(account);
        }
        TIMELINE_VALS.cursor[account] ??= null;
        TIMELINE_VALS.lowest_available_tweet[account] ??= Infinity;
        let user_id = TIMELINE_VALS.user_ids[account];
        let cursor = TIMELINE_VALS.cursor[account];
        let lowest_available_id = TIMELINE_VALS.lowest_available_tweet[account];
        let lowest_requested_id = GetLowestRequestedTweetID(account);
        while (lowest_requested_id < lowest_available_id) {
            let tweet_data = await GetMediaTimelineGQL(user_id, cursor);
            cursor = tweet_data.cursors.bottom;
            TIMELINE_VALS.api_data = Object.assign(TIMELINE_VALS.api_data, tweet_data.tweets);
            let tweet_ids = Object.keys(tweet_data.tweets).map((tweet_id) => BigInt(tweet_id));
            lowest_available_id = JSPLib.utility.bigIntMin(...tweet_ids);
            lowest_requested_id = GetLowestRequestedTweetID(account);
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
    if (TIMELINE_REQUESTS.length) {
        setTimeout(() => {TimelineHandler();}, 1);
    }
}

//Network functions

function TwitterAPI1_1Request(endpoint, data) {
    let url_addons = $.param(data);
    return $.ajax({
        method: 'GET',
        url: `https://api.twitter.com/1.1/${endpoint}.json?${url_addons}`,
        processData: false,
        beforeSend (request) {
            request.setRequestHeader('authorization', 'Bearer AAAAAAAAAAAAAAAAAAAAALVzYQAAAAAAIItU1SgTX8I%2B7Q3Cl3mqvuZiAAc%3D0AtbuGPnZgRlOHbTIk3JudxSGqXxgfkwpMG367Rtyw6GGLwO6N');
        },
    });
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
    return $.ajax({
        method: 'GET',
        url: `https://twitter.com/i/api/graphql/${endpoint}?${url_addons}`,
        processData: false,
        beforeSend (request) {
            request.setRequestHeader('authorization', 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA');
            request.setRequestHeader('x-csrf-token', csrf_token);
        },
    });
}

function GetTweetAPI1_1(tweet_id) {
    return TwitterAPI1_1Request('statuses/show', {id: tweet_id, tweet_mode: 'extended', trim_user: true});
}

function GetTweetsAPI1_1(tweet_ids) {
    return TwitterAPI1_1Request('statuses/lookup', {id: tweet_ids.join(','), tweet_mode: 'extended', trim_user: true});
}

function GetTweetGQL(tweet_id) {
    let data = Object.assign({
        focalTweetId: tweet_id,
    }, TWEET_GRAPHQL_PARAMS);
    return TwitterGraphQLRequest('L1DeQfPt7n3LtTvrBqkJ2g/TweetDetail', data).then((data) => {
        let api_data = CheckGraphqlData2(data);
        return api_data.tweets[tweet_id] ?? null;
    });
}

function GetUserIDGQL(screen_name) {
    let data = {
        screen_name,
        'withHighlightedLabel': false,
    };
    return TwitterGraphQLRequest('Vf8si2dfZ1zmah8ePYPjDQ/UserByScreenNameWithoutResults', data).then((data) => {
        let api_data = CheckGraphqlData2(data);
        for (let user_id in api_data.users) {
            if (api_data.users[user_id].screen_name === screen_name) {
                return api_data.users[user_id]
            }
        }
        return null;
    });
}

function GetMediaTimelineGQL(user_id, cursor) {
    let variables = {
        userId: user_id,
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
    if (JSPLib.validate.isString(cursor)) {
        variables.cursor = cursor;
    }
    let features = {
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
    return TwitterGraphQLRequest('_vFDgkWOKL_U64Y2VmnvJw/UserMedia', variables, features).then((data) => {
        return CheckGraphqlData2(data);
    });
}

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
        let mapped_posts = MapPostData(network_posts);
        SavePosts(mapped_posts);
        SavePostUsers(mapped_posts);
        posts_data = posts_data.concat(mapped_posts);
    }
    posts_data.sort((a, b) => (post_ids.indexOf(a.id) - post_ids.indexOf(b.id)));
    return posts_data;
}

function GetTweetData(tweet_id) {
    GetTweetData.memoized ??= {};
    if (!GetTweetData.memoized[tweet_id]) {
        let p = JSPLib.utility.createPromise();
        GetTweetData.memoized[tweet_id] = p.promise;
        let data_key = 'tweet-' + tweet_id;
        GetData(data_key, 'danbooru').then((storage_data) => {
            if (!storage_data) {
                let tweet_func = (NTISAS.user_settings.use_graphql ? GetTweetGQL : GetTweetAPI1_1);
                tweet_func(tweet_id).then((network_data) => {
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
                });
            } else {
                p.resolve(storage_data.value);
            }
        });
    }
    return GetTweetData.memoized[tweet_id];
}

function GetTweetsData(tweet_ids, account) {
    GetTweetsData.memoized ??= {};
    let key = [...tweet_ids].sort().join(',');
    if (!GetTweetsData.memoized[key]) {
        const p = JSPLib.utility.createPromise();
        GetTweetsData.memoized[key] = p.promise;
        let promise_array = tweet_ids.map((tweet_id) => GetData('tweet-' + tweet_id, 'danbooru'));
        Promise.all(promise_array).then(async (storage_data) => {
            let tweet_dict = {};
            storage_data.forEach((data, i) => {
                if (data) {
                    let tweet_id = tweet_ids[i];
                    tweet_dict[tweet_id] = data.value;
                }
            });
            let query_tweet_ids = JSPLib.utility.arrayDifference(tweet_ids, Object.keys(tweet_dict));
            if (query_tweet_ids.length) {
                let tweet_func = (NTISAS.user_settings.use_graphql ? GetTweetsGQL : GetTweetsAPI1_1);
                let network_data = await tweet_func(query_tweet_ids, account);
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
                    tweet_dict[tweet_id] = value;
                    network_tweet_ids.push(tweet_id);
                });
                let missing_tweet_ids = JSPLib.utility.arrayDifference(query_tweet_ids, network_tweet_ids);
                expires = JSPLib.utility.getExpires(JSPLib.utility.one_day);
                missing_tweet_ids.forEach((tweet_id) => {
                    SaveData('tweet-' + tweet_id, {value: [], expires}, 'danbooru');
                    tweet_dict[tweet_id] = [];
                });
            }
            p.resolve(tweet_dict);
        });
    }
    return GetTweetsData.memoized[key];
}

async function GetTweetsGQL(tweet_ids, account) {
    let network_data = await Promise.all(tweet_ids.map((tweet_id) => QueueTimelineRequest(tweet_id, account)));
    tweet_ids.forEach((tweet_id, i) => {
        if (JSPLib.validate.isHash(network_data[i])) {
            network_data[i].id_str = tweet_id;
        }
    });
    return network_data.filter((data) => JSPLib.validate.isHash(data));
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
                            let value = twitter_data.id;
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

async function CheckPostvers() {
    let postver_lastid = GetPostVersionsLastID('postver');
    let url_addons = {search: {source_changed: true, source_regex: 'twitter\\.com'}, only: POSTVER_FIELDS};
    let query_params = {addons: url_addons, reverse: true, domain: NTISAS.domain, notify: true};
    if (postver_lastid) {
        query_params.page = postver_lastid;
    }
    let post_versions = await JSPLib.danbooru.getAllItems('post_versions', QUERY_LIMIT, {page: postver_lastid, batches: QUERY_BATCH_NUM, url_addons, reverse: true, domain: NTISAS.domain, notify: true});
    if (post_versions.length === QUERY_BATCH_SIZE) {
        this.debug('log', "Overflow detected!");
        SetLocalData('ntisas-overflow', true);
    } else {
        this.debug('log', "No overflow:", post_versions.length, QUERY_BATCH_SIZE);
        SetLocalData('ntisas-overflow', false);
    }
    if (post_versions.length) {
        let [add_entries, rem_entries] = ProcessPostvers(post_versions);
        this.debug('log', "Process:", add_entries, rem_entries);
        SavePostvers(add_entries, rem_entries);
        let lastid = JSPLib.danbooru.getNextPageID(post_versions, true);
        //Since the post version last ID is critical, an extra sanity check has been added
        if (JSPLib.validate.validateID(lastid)) {
            SetLocalData('ntisas-postver-lastid', lastid);
            let all_timestamps = JSPLib.utility.getObjectAttributes(post_versions, 'updated_at');
            let normal_timestamps = all_timestamps.map((timestamp) => (new Date(timestamp).getTime()));
            let most_recent_timestamp = Math.max(...normal_timestamps);
            SetLocalData('ntisas-recent-timestamp', most_recent_timestamp);
            InitializeCurrentRecords();
            NTISAS.channel.postMessage({type: 'currentrecords'});
        }
    }
    JSPLib.concurrency.setRecheckTimeout('ntisas-timeout', GetPostVersionsExpiration());
    JSPLib.concurrency.freeSemaphore(PROGRAM_SHORTCUT, 'postvers');
}

async function CheckServerBadTweets() {
    if (NTISAS.database_info && JSPLib.concurrency.checkTimeout('ntisas-badver-recheck', BADVER_RECHECK_EXPIRES) && JSPLib.concurrency.reserveSemaphore(PROGRAM_SHORTCUT, 'badvers')) {
        let postver_lastid = GetPostVersionsLastID('badver');
        let url_addons = {search: {changed_tags: 'bad_twitter_id'}, only: POSTVER_FIELDS};
        let post_versions = await JSPLib.danbooru.getAllItems('post_versions', QUERY_LIMIT, {page: postver_lastid, url_addons, batches: QUERY_BATCH_NUM, reverse: true, domain: NTISAS.domain, notify: true});
        if (post_versions.length === QUERY_BATCH_SIZE) {
            this.debug('log', "Overflow detected!");
        } else {
            this.debug('log', "No overflow:", post_versions.length, QUERY_BATCH_SIZE);
            JSPLib.concurrency.setRecheckTimeout('ntisas-badver-recheck', BADVER_RECHECK_EXPIRES);
        }
        if (post_versions.length) {
            let [add_entries, rem_entries] = ProcessPostvers(post_versions);
            this.debug('log', "Process:", add_entries, rem_entries);
            SavePostvers(add_entries, rem_entries);
            let lastid = JSPLib.danbooru.getNextPageID(post_versions, true);
            //Since the post version last ID is critical, an extra sanity check has been added
            if (JSPLib.validate.validateID(lastid)) {
                SetLocalData('ntisas-badver-lastid', lastid);
                InitializeCurrentRecords();
                NTISAS.channel.postMessage({type: 'currentrecords'});
            }
        }
        JSPLib.concurrency.freeSemaphore(PROGRAM_SHORTCUT, 'badvers');
    }
}

function SavePostvers(add_entries, rem_entries) {
    let combined_keys = JSPLib.utility.arrayIntersection(Object.keys(add_entries), Object.keys(rem_entries));
    combined_keys.forEach((tweet_id) => {
        let tweet_key = 'tweet-' + tweet_id;
        let post_ids = add_entries[tweet_id];
        JSPLib.storage.retrieveData(tweet_key, false, JSPLib.storage.twitterstorage).then((data) => {
            if (JSPLib.validate.validateIDList(data)) {
                this.debug('logLevel', "Tweet adds/rems - existing IDs:", tweet_key, data, JSPLib.debug.DEBUG);
                post_ids = JSPLib.utility.arrayUnique(JSPLib.utility.arrayDifference(JSPLib.utility.arrayUnion(data, add_entries[tweet_id]), rem_entries[tweet_id]));
            }
            if (data === null || JSPLib.utility.arraySymmetricDifference(post_ids, data)) {
                this.debug('logLevel', "Tweet adds/rems - saving:", tweet_key, post_ids, JSPLib.debug.DEBUG);
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
        JSPLib.storage.retrieveData(tweet_key, false, JSPLib.storage.twitterstorage).then((data) => {
            if (JSPLib.validate.validateIDList(data)) {
                this.debug('log', "Tweet adds - existing IDs:", tweet_key, data);
                post_ids = JSPLib.utility.arrayUnion(data, post_ids);
            }
            if (data === null || post_ids.length > data.length) {
                this.debug('log', "Tweet adds - saving:", tweet_key, post_ids);
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
        JSPLib.storage.retrieveData(tweet_key, false, JSPLib.storage.twitterstorage).then((data) => {
            if (data !== null && JSPLib.validate.validateIDList(data)) {
                this.debug('log', "Tweet removes - existing IDs:", tweet_key, data);
                post_ids = JSPLib.utility.arrayUnique(JSPLib.utility.arrayDifference(data, rem_entries[tweet_id]));
            }
            if (post_ids.length) {
                this.debug('log', "Tweet removes - saving:", tweet_key, post_ids);
                SaveData(tweet_key, post_ids, 'twitter');
            } else {
                this.debug('log', "Tweet removes - deleting:", tweet_key);
                RemoveData(tweet_key, 'twitter');
            }
            if (data !== null) {
                UpdatePostIDsLink(tweet_id, post_ids);
                NTISAS.channel.postMessage({type: 'postlink', tweet_id, post_ids});
            }
        });
    });
}

async function GetMaxVideoDownloadLink(tweet_id) {
    let key = 'video-' + tweet_id;
    let cached = await JSPLib.storage.checkLocalDB(key, ValidateEntry, VIDEO_EXPIRES);
    var video_url, variants, data;
    if (!cached) {
        if (API_DATA.has_data && tweet_id in API_DATA.tweets) {
            data = GetAPIData('tweets', tweet_id);
        } else {
            let tweet_func = (NTISAS.user_settings.use_graphql ? GetTweetGQL : GetTweetAPI1_1);
            try {
                data = await tweet_func(tweet_id);
            } catch (e) {
                this.debug('warn', "HTTP Error:", e.status, e);
                data = null;
            }
        }
        try {
            variants = data.extended_entities.media[0].video_info.variants;
        } catch (e) {
            //Bad data was returned!
            this.debug('log', "Bad data returned:", data);
            variants = null;
        }
        if (variants) {
            let max_bitrate = Math.max(...JSPLib.utility.getObjectAttributes(variants, 'bitrate').filter((num) => Number.isInteger(num)));
            let max_video = variants.filter((variant) => (variant.bitrate === max_bitrate));
            video_url = (max_video.length ? max_video[0].url.split('?')[0] : null);
        } else {
            video_url = null;
        }
        JSPLib.storage.saveData(key, {value: video_url, expires: JSPLib.utility.getExpires(VIDEO_EXPIRES)});
        return video_url;
    }
    return cached.value;

}

async function InstallUserProfileData() {
    NTISAS.user_data = CheckLocalData('ntisas-user-data');
    if (!NTISAS.user_data || JSPLib.concurrency.checkTimeout('ntisas-user-profile-recheck', USER_PROFILE_RECHECK_EXPIRES)) {
        NTISAS.user_data = await JSPLib.danbooru.submitRequest('profile', {only: PROFILE_FIELDS}, {default_val: {}, domain: NTISAS.domain});
        if (!NTISAS.user_data.id || !NTISAS.user_data.level) {
            NTISAS.user_data = {id: 2, level: GOLD_LEVEL};
        }
        SetLocalData('ntisas-user-data', NTISAS.user_data);
        JSPLib.concurrency.setRecheckTimeout('ntisas-user-profile-recheck', USER_PROFILE_RECHECK_EXPIRES);
    }
}

function TweetUserData(data) {
    if (typeof data === 'object' && 'globalObjects' in data) {
        ProcessTwitterGlobalObjects(data);
    } else if (typeof data === 'object' && 'data' in data) {
        API_DATA.raw_data.push(data);
        //Process in a separately in case there are errors
        setTimeout(() => {ProcessTwitterData(data);}, 1);
    }
}

function ProcessTwitterGlobalObjects(data) {
    if ('tweets' in data.globalObjects) {
        let existing_keys = Object.keys(API_DATA.tweets);
        Object.assign(API_DATA.tweets, data.globalObjects.tweets);
        for (let twitter_id in data.globalObjects.tweets) {
            let entry = data.globalObjects.tweets[twitter_id];
            if ('retweeted_status_id_str' in entry) {
                let tweet_id = entry.retweeted_status_id_str;
                API_DATA.retweets[tweet_id] = entry;
            }
        }
        let current_keys = Object.keys(API_DATA.tweets);
        let new_keys = JSPLib.utility.arrayDifference(current_keys, existing_keys);
        if (new_keys.length) {
            setTimeout(() => {PreloadStorageData(new_keys);}, 1);
        }
        API_DATA.has_data = true;
    }
    if ('users' in data.globalObjects) {
        Object.assign(API_DATA.users_id, data.globalObjects.users);
        for (let twitter_id in data.globalObjects.users) {
            let entry = data.globalObjects.users[twitter_id];
            entry.id_str = String(twitter_id);
            API_DATA.users_name[entry.screen_name] = entry;
            API_DATA.users_id[twitter_id] = entry;
        }
        API_DATA.has_data = true;
    }
}

function ProcessTwitterData(data) {
    let checked_data = CheckGraphqlData(data);
    let display_user_id = 'user_settings' in NTISAS && NTISAS.user_settings.display_user_id;
    let existing_keys = Object.keys(API_DATA.tweets);
    for (let i = 0; i < checked_data.length; i++) {
        let {type, id, item} = checked_data[i];
        let $tweet = null;
        item.id_str = String(id);
        switch(type) {
            case 'tweet':
                API_DATA.tweets[id] = item;
                $tweet = $(`[ntisas-tweet][data-tweet-id=${id}]`);
                if ($tweet.length > 0 && $tweet.data('user-id') === undefined) {
                    $tweet.attr('data-user-id', item.user_id_str);
                    if (display_user_id) {
                        InitializeUserDisplay($tweet);
                    }
                }
                break;
            case 'user':
                API_DATA.users_id[id] = item;
                API_DATA.users_name[item.screen_name] = item;
                //falls through
            default:
                //do nothing
        }
    }
    let current_keys = Object.keys(API_DATA.tweets);
    let new_keys = JSPLib.utility.arrayDifference(current_keys, existing_keys);
    if (new_keys.length) {
        setTimeout(() => {PreloadStorageData(new_keys);}, 1);
    }
    if (checked_data.length) {
        API_DATA.has_data = true;
    }
}

function CheckGraphqlData(data, savedata = []) {
    for (let i in data) {
        if (typeof data[i] === "object" && data[i] !== null) {
            if (('legacy' in data[i]) && ('rest_id' in data[i])) {
                if ((i === "tweet" || i === "user")) {
                    savedata.push({type: i, id: data[i].rest_id, item: data[i].legacy});
                } else if ((i === 'result') && (data[i]?.__typename === 'Tweet' || data[i]?.__typename === 'User')) {
                    savedata.push({type: data[i].__typename.toLowerCase(), id: data[i].rest_id, item: data[i].legacy});
                }
            }
            CheckGraphqlData(data[i], savedata);
        }
    }
    return savedata;
}

function CheckGraphqlData2(data, savedata) {
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
            CheckGraphqlData2(data[i], savedata);
        } else if (data[i] === "TimelineTimelineCursor") {
            let cursor_key = data.cursorType.toLowerCase();
            savedata.cursors[cursor_key] = data.value;
        }
    }
    return savedata;
}

function PreloadStorageData(tweet_ids) {
    this.debug('log', "Tweet IDs:", tweet_ids);
    let promise_array = tweet_ids.map((tweet_id) => [
        GetData('tweet-' + tweet_id, 'twitter'),
        GetData('iqdb-' + tweet_id, 'danbooru'),
        GetData('sauce-' + tweet_id, 'danbooru'),
        (NTISAS.user_settings && NTISAS.user_settings.display_tweet_views ? GetData('view-' + tweet_id, 'danbooru') : null),
    ]).flat().filter((promise) => (promise !== null));
    Promise.all(promise_array).then((data_items) => {
        this.debug('logLevel', "Data:", data_items, JSPLib.debug.DEBUG);
        let post_ids = JSPLib.utility.arrayUnique(data_items.filter((data) => (Array.isArray(data))).flat());
        this.debug('log', "Query post IDs:", post_ids);
        if (post_ids.length) {
            GetPosts(post_ids).then((post_data) => {
                this.debug('logLevel', "Query post data:", post_data, JSPLib.debug.INFO);
            });
        }
    });
}

//Database functions

function GetData(key, database) {
    let type = (database === 'danbooru' ? 'check' : 'get');
    return QueueStorageRequest(type, key, null, database);
}

function SaveData(key, value, database, invalidate = true) {
    if (invalidate) {
        InvalidateCache(key, database);
    }
    return QueueStorageRequest('save', key, value, database);
}

function RemoveData(key, database) {
    InvalidateCache(key, database);
    return QueueStorageRequest('remove', key, null, database);
}

async function LoadDatabase() {
    this.debug('log', "starting tweet load");
    JSPLib.debug.debugTime('database-network');
    var tweet_data = await JSPLib.network.getNotify(SERVER_DATABASE_URL, {custom_error: JSPLib.utility.sprintf(SERVER_ERROR, "tweet database"), xhr_options: {anonymous: true}});
    JSPLib.debug.debugTimeEnd('database-network');
    if (JSPLib.validate.isString(tweet_data)) {
        JSPLib.debug.debugTime('database-parse');
        try {
            tweet_data = JSON.parse(tweet_data);
        } catch(e) {
            JSPLib.debug.debugerror("Error parsing tweet database:", e);
        }
        JSPLib.debug.debugTimeEnd('database-parse');
    }
    if (JSPLib.validate.isHash(tweet_data)) {
        await SaveDatabase(tweet_data, '#ntisas-counter');
        return true;
    }
    return false;
}

async function SaveDatabase(database, counter_selector) {
    var database_keys = Object.keys(database);
    let batches = Math.floor(database_keys.length / 2000);
    this.debug('log', "Database size:", database_keys.length);
    var payload = {};
    for (var i = 0; i < database_keys.length; i++) {
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
            this.debug('log', "Saving batch #", batches);
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
        this.debug('log', "Saving batch #", batches);
        JSPLib.debug.debugTime('database-save-' + batches);
        await JSPLib.storage.twitterstorage.setItems(payload);
        JSPLib.debug.debugTimeEnd('database-save-' + batches);
    }
}

async function GetSavePackage(export_types) {
    let save_package = Object.assign(...export_types.map((type) => ({[type]: {}})));
    if (export_types.includes('program_data')) {
        Object.keys(localStorage).forEach((key) => {
            if (key.match(/^ntisas-/)) {
                let temp_data = CheckLocalData(key);
                if (temp_data !== null) {
                    save_package.program_data[key] = temp_data;
                }
            }
        });
    }
    if (export_types.includes('tweet_database')) {
        let database_length = await GetTotalRecords();
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

function InitializeDatabase() {
    localStorage.removeItem('ntisas-length-recheck');
    NTISAS.channel.postMessage({type: 'database'});
    JSPLib.notice.notice("NTISAS will momentarily refresh the page to finish initializing the database.");
    //It's just easier to reload the page on database updates
    JSPLib.utility.refreshPage(PAGE_REFRESH_TIMEOUT);
}

async function CheckDatabaseInfo(initial) {
    if (!NTISAS.user_settings.bypass_server_mode && (initial || JSPLib.concurrency.checkTimeout('ntisas-database-recheck', DATABASE_RECHECK_EXPIRES))) {
        let database_info = await JSPLib.network.getNotify(DATABASE_INFO_URL, {custom_error: JSPLib.utility.sprintf(SERVER_ERROR, "database info"), xhr_options: {anonymous: true}});
        if (JSPLib.validate.isString(database_info)) {
            try {
                database_info = JSON.parse(database_info);
            } catch (e) {
                //do nothing
            }
        }
        if (JSPLib.validate.isHash(database_info)) {
            SetLocalData('ntisas-remote-database', database_info);
        }
        JSPLib.concurrency.setRecheckTimeout('ntisas-database-recheck', DATABASE_RECHECK_EXPIRES);
    }
}

function CheckPurgeBadTweets() {
    if (!NTISAS.user_settings.bypass_server_mode && GetLocalData('ntisas-purge-bad', false) && JSPLib.concurrency.reserveSemaphore(PROGRAM_SHORTCUT, 'purgebad')) {
        PurgeBadTweets().then(() => {
            this.debug('log', "All bad Tweets purged!");
            SetLocalData('ntisas-purge-bad', false);
            JSPLib.concurrency.freeSemaphore(PROGRAM_SHORTCUT, 'purgebad');
        });
    }
}

async function PurgeBadTweets(purgelist) {
    if (purgelist === undefined) {
        purgelist = await JSPLib.network.getNotify(SERVER_PURGELIST_URL, {custom_error: JSPLib.utility.sprintf(SERVER_ERROR, "purge list"), xhr_options: {anonymous: true}});
        if (JSPLib.validate.isString(purgelist)) {
            try {
                purgelist = JSON.parse(purgelist);
            } catch(e) {
                JSPLib.debug.debugerror("Error parsing purge list:", e);
            }
        }
    }
    if (Array.isArray(purgelist)) {
        let purge_keylist = purgelist.map((tweet_id) => ('tweet-' + tweet_id));
        let database_keylist = await JSPLib.storage.twitterstorage.keys();
        let purge_set = new Set(purge_keylist);
        let database_set = new Set(database_keylist);
        let delete_keys = JSPLib.utility.setIntersection(database_set, purge_set);
        this.debug('log', delete_keys);
        await JSPLib.storage.batchRemoveData([...delete_keys], JSPLib.storage.twitterstorage);
    }
}

//Event handlers

function CheckViews(entries, observer) {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            let $tweet = $(entry.target);
            let tweet_id = $tweet.attr('data-tweet-id');
            this.debug('logLevel', "Viewable tweet:", tweet_id, entry, JSPLib.debug.DEBUG);
            AddViewCount(tweet_id);
            $tweet.attr('viewed', 'true');
            observer.unobserve(entry.target);
        }
    });
}

function PhotoNavigation() {
    if (!NTISAS.photo_navigation) {
        return;
    }
    setTimeout(() => {
        //Get the latest page regex match stored onto global variable
        let pagetype = GetPageType();
        if (pagetype === 'photo') {
            if (NTISAS.page_match.groups.photo_index !== NTISAS.photo_index) {
                InitializeUploadlinks(false);
            }
        }
    }, TWITTER_DELAY);
}

function ImageEnter(event) {
    if (!NTISAS.user_settings.display_image_number) {
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
    if (!NTISAS.user_settings.display_image_number) {
        return;
    }
    $(event.currentTarget).removeClass('ntisas-image-num');
    JSPLib.utility.setCSSStyle("", 'image_num');
}

function ToggleImageSize(event) {
    let image = event.target;
    let $image = $(image);
    let image_url = $image.attr('src');
    let match = image_url.match(IMAGE_REGEX);
    if (match) {
        let orig_url = $image.parent().data('orig-size');
        let $image_anchor = NTISAS.image_anchor[orig_url];
        let showing_large = $image.data('showing-large') || false;
        if (showing_large || match[2] === 'large') {
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
            $image.attr('src', match[1] + 'large');
            $image.data('showing-large', true);
        }
    } else {
        this.debug('warn', "No match!", image_url);
    }
    event.preventDefault();
}

function ToggleSideMenu(event) {
    let menu_shown = GetLocalData('ntisas-side-menu', true);
    SetLocalData('ntisas-side-menu', !menu_shown);
    UpdateSideMenu();
    NTISAS.channel.postMessage({type: 'sidemenu_ui'});
    event.preventDefault();
    event.stopImmediatePropagation();
    return false;
}

function ToggleDownloadSection() {
    let menu_shown = GetLocalData('ntisas-download-menu', true);
    SetLocalData('ntisas-download-menu', !menu_shown);
    UpdateDownloadControls();
    UpdateDownloadSection();
    NTISAS.channel.postMessage({type: 'download_ui'});
}

function ToggleViewHighlights() {
    let show_highlights = GetLocalData('ntisas-view-highlights', true);
    SetLocalData('ntisas-view-highlights', !show_highlights);
    UpdateViewHighlights();
    UpdateViewHighlightControls();
    NTISAS.channel.postMessage({type: 'view_highlights'});
}

function ToggleViewCounts() {
    let count_views = GetLocalData('ntisas-view-counts', true);
    SetLocalData('ntisas-view-counts', !count_views);
    UpdateViewCountControls();
    NTISAS.channel.postMessage({type: 'count_views'});
}

function ToggleAutoclickIQDB() {
    let [user_ident, all_idents] = GetUserIdent();
    if (user_ident) {
        let auto_iqdb_list = GetList('auto-iqdb-list');
        if (JSPLib.utility.arrayHasIntersection(auto_iqdb_list, all_idents)) {
            auto_iqdb_list = JSPLib.utility.arrayDifference(auto_iqdb_list, all_idents);
        } else {
            auto_iqdb_list = JSPLib.utility.arrayUnion(auto_iqdb_list, all_idents);
        }
        SaveList('auto-iqdb-list', auto_iqdb_list);
        UpdateIQDBControls();
        NTISAS.channel.postMessage({type: 'autoiqdb', list: auto_iqdb_list});
    }
}

function InstallDatabase() {
    let message = JSPLib.utility.sprintf(INSTALL_CONFIRM, NTISAS.server_info.post_version, new Date(NTISAS.server_info.timestamp).toLocaleString());
    if (confirm(message)) {
        $('#ntisas-database-link').html(LOAD_COUNTER);
        LoadDatabase().then((data) => {
            if (data) {
                JSPLib.storage.saveData('ntisas-database-info', NTISAS.server_info, JSPLib.storage.twitterstorage);
                SetLocalData(`ntisas-postver-lastid`, NTISAS.server_info.post_version);
                InitializeDatabase();
            }
        });
    }
}

function UpgradeDatabase() {
    let message = JSPLib.utility.sprintf(UPGRADE_CONFIRM, NTISAS.server_info.post_version, new Date(NTISAS.server_info.timestamp).toLocaleString(),
        NTISAS.database_info.post_version, new Date(NTISAS.database_info.timestamp).toLocaleString());
    if (confirm(message)) {
        $('#ntisas-database-link').html(LOAD_COUNTER);
        LoadDatabase().then((data) => {
            if (data) {
                JSPLib.storage.saveData('ntisas-database-info', NTISAS.server_info, JSPLib.storage.twitterstorage);
                SetLocalData('ntisas-purge-bad', true);
                InitializeDatabase();
            }
        });
    }
}

function SideMenuSelection(event) {
    let $link = $(event.target);
    let selected_menu = $link.data('selector');
    $('#ntisas-menu-selection > a').removeClass('ntisas-selected');
    $(`#ntisas-menu-selection a[data-selector=${selected_menu}]`).addClass('ntisas-selected');
    $('#ntisas-content > div').hide();
    $(`#ntisas-content div[data-selector=${selected_menu}]`).show();
    JSPLib.storage.setStorageData('ntisas-side-selection', selected_menu, localStorage);
}

function SideMenuHotkeys(event) {
    $(`#ntisas-menu-selection a:nth-of-type(${event.originalEvent.key})`).click();
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

function CurrentPostver() {
    if (confirm(CURRENT_POSTVER_CONFIRM)) {
        JSPLib.danbooru.submitRequest('post_versions', {limit: 1}, {domain: NTISAS.domain, notify: true}).then((data) => {
            if (Array.isArray(data) && data.length > 0) {
                SetLocalData('ntisas-postver-lastid', data[0].id);
                SetLocalData('ntisas-recent-timestamp', new Date(data[0].updated_at).getTime());
                JSPLib.notice.notice("Finished updating record position!");
                InitializeCurrentRecords();
                NTISAS.channel.postMessage({type: 'currentrecords'});
            }
        });
    }
}

function QueryTotalRecords() {
    GetTotalRecords(true).then((length) => {
        $('#ntisas-total-records').html(length);
        JSPLib.notice.notice("Finished updating record count!");
    });
}

function OpenMediaTweetMenu(event) {
    let $menu = $(event.target);
    let $tweet = $menu.closest('.ntisas-media-tweet');
    let tweet_id = $tweet.data('tweet-id');
    if (!NTISAS.media_dialog[tweet_id]) {
        let screen_name = $tweet.data('tweet-id');
        NTISAS.media_dialog_anchor[tweet_id] = $menu;
        var tweet_data;
        if ($tweet.hasClass('ntisas-multi-media')) {
            let session_data = JSPLib.storage.getIndexedSessionData('tweet-' + tweet_id, {value: []});
            tweet_data = session_data.value;
        } else {
            tweet_data = GetSingleImageInfo(tweet_id);
        }
        let image_urls = tweet_data.map((data) => 'https://pbs.twimg.com/' + data.partial_image);
        var video_promise;
        if (($tweet.data('media-type') === 'video' || $tweet.data('text') === 'GIF') && $tweet.hasClass('ntisas-single-media')) {
            video_promise = GetTweetData(tweet_id).then((data) => {
                return data.map((data) => Boolean(data.partial_video));
            });
        } else {
            video_promise = Promise.resolve(tweet_data.map((data) => Boolean(data.partial_video)));
        }
        video_promise.then((videos) => {
            let $dialog = NTISAS.media_dialog[tweet_id] = $(RenderMediaMenu(tweet_id, screen_name, image_urls, videos));
            $dialog.prop('ntisasImageUrls', image_urls);
            $dialog.find('.ntisas-media-image').each((i, entry) => {
                $(entry).on(PROGRAM_CLICK, PopupMediaTweetImage);
            });
            $dialog.find('.ntisas-media-video').each((i, entry) => {
                $(entry).on(PROGRAM_CLICK, PopupMediaTweetVideo);
            });
            let $link_container = $('<div class="ntisas-link-menu ntisas-timeline-menu ntisas-links"><span style="font-weight:bold">Loading...</span></div>');
            $dialog.find('.ntisas-image-section').append($link_container);
            GetData('tweet-' + tweet_id, 'twitter').then((post_ids) => {
                if (post_ids !== null) {
                    InitializePostIDsLink(tweet_id, $link_container, $dialog[0], post_ids);
                } else {
                    InitializeNoMatchesLinks(tweet_id, $link_container);
                }
            });
            if (NTISAS.user_settings.original_download_enabled) {
                let is_video = $tweet.hasClass('ntisas-media-video');
                RenderDownloadLinks($tweet, is_video, image_urls).then((download_html) => {
                    let $download_section = $(download_html);
                    $('.ntisas-download-section', $dialog[0]).append($download_section);
                    if (is_video) {
                        GetMaxVideoDownloadLink(tweet_id).then((video_url) => {
                            if (video_url !== null) {
                                SetVideoDownload($download_section, video_url);
                            }
                        });
                    }
                    UpdateDownloadSection();
                });
            } else {
                $dialog.find('.ntisas-download-header, .ntisas-download-section').css('display', 'none');
            }
            $dialog.dialog(MEDIA_DIALOG_SETTINGS);
            $dialog.dialog('open');
        });
        InitializeUIStyle();
        if (NTISAS.user_settings.display_tweet_views) {
            AddViewCount(tweet_id);
        }
    } else {
        NTISAS.media_dialog[tweet_id].dialog('open');
    }
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
    let tweet_data = JSPLib.storage.getIndexedSessionData('tweet-' + tweet_id, {value: []});
    let image_data = tweet_data.value[order];
    if (JSPLib.validate.isHash(image_data)) {
        let video_url = 'https://video.twimg.com/' + (image_data.partial_sample || image_data.partial_video);
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

function CheckURL(event) {
    let [$link, $tweet, tweet_id,, screen_name,,, ] = GetEventPreload(event, 'ntisas-check-url');
    $link.removeClass('ntisas-check-url').html("loading…");
    let normal_url = `https://twitter.com/${screen_name}/status/${tweet_id}`;
    let wildcard_url = `https://twitter.com/*/status/${tweet_id}`;
    let check_url = (NTISAS.user_settings.URL_wildcards_enabled ? wildcard_url : normal_url);
    this.debug('log', check_url);
    JSPLib.danbooru.submitRequest('posts', {tags: 'status:any source:' + check_url, only: POST_FIELDS}, {default_val: [], domain: NTISAS.domain, notify: true}).then((data) => {
        let post_ids = [];
        if (data.length === 0) {
            NTISAS.no_url_results.push(tweet_id);
        } else {
            let mapped_posts = MapPostData(data);
            SavePosts(mapped_posts);
            SavePostUsers(mapped_posts);
            post_ids = JSPLib.utility.arrayUnique(JSPLib.utility.getObjectAttributes(data, 'id'));
            if (NTISAS.merge_results.includes(tweet_id)) {
                let merge_ids = GetSessionTwitterData(tweet_id);
                post_ids = JSPLib.utility.arrayUnion(merge_ids, post_ids);
            }
            SaveData('tweet-' + tweet_id, post_ids, 'twitter');
        }
        UpdatePostIDsLink(tweet_id, post_ids);
        NTISAS.channel.postMessage({type: 'postlink', tweet_id, post_ids});
    });
}

async function CheckIQDB(event) {
    let pick = await PickImage(event, 'iqdb', (() => !IsIQDBAutoclick()));
    if (!pick) {
        return;
    }
    let [, $tweet, tweet_id, $replace, selected_image_urls] = pick;
    let promise_array = selected_image_urls.map((image_url) => JSPLib.danbooru.submitRequest('iqdb_queries', {url: image_url, similarity: NTISAS.user_settings.similarity_cutoff, limit: NTISAS.user_settings.results_returned}, {default_val: [], domain: NTISAS.domain, notify: true}));
    let all_iqdb_results = await Promise.all(promise_array);
    let flat_data = all_iqdb_results.flat();
    let similar_data = [];
    if (flat_data.length) {
        this.debug('log', `Found ${flat_data.length} results.`);
        let post_data = JSPLib.utility.getObjectAttributes(flat_data, 'post');
        let unique_posts = RemoveDuplicates(post_data, 'id');
        let mapped_posts = MapPostData(unique_posts);
        let uploader_ids = JSPLib.utility.arrayUnique(JSPLib.utility.getObjectAttributes(mapped_posts, 'uploaderid'));
        let [user_data, network_users] = await GetItems(uploader_ids, 'user', 'users');
        user_data = user_data.concat(network_users);
        mapped_posts.forEach((post) => {
            let user = user_data.find((user) => (user.id === post.uploaderid));
            post.uploadername = user.name;
        });
        SavePosts(mapped_posts);
        SaveUsers(network_users);
        similar_data = all_iqdb_results.map((image_result) => {
            let valid_results = image_result.filter((result) => (result.post !== undefined && result.post.id !== undefined));
            let filter_results = valid_results.filter((result) => (parseFloat(result.score) >= NTISAS.user_settings.similarity_cutoff));
            let sorted_results = filter_results.sort((resulta, resultb) => (resultb.score - resulta.score)).slice(0, NTISAS.user_settings.results_returned);
            return sorted_results.map((result) => {
                let score = result.score;
                let post_id = result.post.id;
                let post = mapped_posts.find((post) => (post.id === post_id));
                return MapSimilar(post, score);
            });
        });
    } else {
        this.debug('log', "Found no results.");
    }
    ProcessSimilarData('iqdb', tweet_id, $tweet, $replace, selected_image_urls, similar_data, (() => IsIQDBAutoclick()));
}

async function CheckSauce(event) {
    if (!NTISAS.user_settings.SauceNAO_API_key) {
        JSPLib.notice.error("<b>Error!</b> Must set SauceNAO API key in user settings.");
        return;
    }
    let pick = await PickImage(event, 'sauce');
    if (!pick) {
        return;
    }
    let [, $tweet, tweet_id, $replace, selected_image_urls] = pick;
    let promise_array = selected_image_urls.map((image_url) => JSPLib.saucenao.getSauce(image_url, JSPLib.saucenao.getDBIndex('danbooru'), NTISAS.user_settings.results_returned));
    let all_data = await Promise.all(promise_array);
    let good_data = all_data.filter((data) => JSPLib.saucenao.checkSauce(data));
    let combined_data = JSPLib.utility.getObjectAttributes(good_data, 'results');
    let flat_data = combined_data.flat();
    let filtered_data = flat_data.filter((result) => (parseFloat(result.header.similarity) >= NTISAS.user_settings.similarity_cutoff));
    let similar_data = [];
    if (filtered_data.length) {
        this.debug('log', `Found ${filtered_data.length} results.`);
        let danbooru_ids = JSPLib.utility.arrayUnique(JSPLib.utility.getNestedObjectAttributes(filtered_data, ['data', 'danbooru_id']));
        var posts_data = await GetPosts(danbooru_ids);
        similar_data = combined_data.map((image_result) => {
            let filter_results = image_result.filter((result) => (parseFloat(result.header.similarity) >= NTISAS.user_settings.similarity_cutoff));
            let sorted_results = filter_results.sort((resulta, resultb) => (resultb.score - resulta.score)).slice(0, NTISAS.user_settings.results_returned);
            return sorted_results.map((result) => {
                let score = parseFloat(result.header.similarity);
                let post_id = result.data.danbooru_id;
                let post = posts_data.find((post) => (post.id === post_id));
                return MapSimilar(post, score);
            });
        });
    } else {
        this.debug('log', "No results found.");
    }
    ProcessSimilarData('sauce', tweet_id, $tweet, $replace, selected_image_urls, similar_data);
    let combined_headers = JSPLib.utility.getObjectAttributes(good_data, 'header');
    let flat_headers = combined_headers.flat();
    let sauce_remaining = flat_headers.reduce((total, header) => Math.min(total, header.long_remaining), Infinity);
    $('#ntisas-available-sauce').text(sauce_remaining);
    JSPLib.storage.saveData('ntisas-available-sauce', {value: sauce_remaining, expires: JSPLib.utility.getExpires(SAUCE_EXPIRES)});
}

function ManualAdd(event) {
    let [$link, $tweet, tweet_id,,,,, $replace] = GetEventPreload(event, 'ntisas-manual-add');
    PromptSavePostIDs($link, $tweet, tweet_id, $replace, MANUAL_ADD_PROMPT, []);
}

function ConfirmSave(event) {
    let type = $(event.target).data('type');
    if (!IsQuerySettingEnabled('confirm_save', type)) {
        return;
    }
    let [$link, $tweet, tweet_id,,,,, $replace] = GetEventPreload(event, 'ntisas-confirm-save');
    let save_post_ids = GetSelectPostIDs(tweet_id, 'tweet_qtip');
    if (NTISAS.merge_results.includes(tweet_id)) {
        let merge_ids = GetSessionTwitterData(tweet_id);
        save_post_ids = JSPLib.utility.arrayUnion(merge_ids, save_post_ids);
    }
    PromptSavePostIDs($link, $tweet, tweet_id, $replace, CONFIRM_SAVE_PROMPT, save_post_ids);
    event.preventDefault();
}

function ConfirmDelete(event) {
    let [$link, $tweet, tweet_id,,,,, $replace] = GetEventPreload(event, 'ntisas-confirm-delete');
    let all_post_ids = GetSessionTwitterData(tweet_id);
    let save_post_ids = GetSelectPostIDs(tweet_id, 'tweet_qtip');
    let delete_post_ids = JSPLib.utility.arrayDifference(all_post_ids, save_post_ids);
    let message = JSPLib.utility.sprintf(CONFIRM_DELETE_PROMPT, delete_post_ids);
    PromptSavePostIDs($link, $tweet, tweet_id, $replace, message, save_post_ids);
    event.preventDefault();
}

function ResetResults(event) {
    let [$link,, tweet_id,,,,, $replace] = GetEventPreload(event, 'ntisas-reset-results');
    let type = $link.data('type');
    RemoveData(type + '-' + tweet_id, 'danbooru');
    InitializeNoMatchesLinks(tweet_id, $replace);
}

function MergeResults(event) {
    let [, $tweet, tweet_id,,,,, $replace] = GetEventPreload(event, 'ntisas-merge-results');
    NTISAS.merge_results = JSPLib.utility.arrayUnion(NTISAS.merge_results, [tweet_id]);
    $('.ntisas-database-match', $tweet[0]).qtiptisas('destroy', true);
    InitializeNoMatchesLinks(tweet_id, $replace, true);
}

function CancelMerge(event) {
    let [, $tweet, tweet_id,,,,, $replace] = GetEventPreload(event, 'ntisas-cancel-merge');
    NTISAS.merge_results = JSPLib.utility.arrayDifference(NTISAS.merge_results, [tweet_id]);
    let post_ids = GetSessionTwitterData(tweet_id);
    InitializePostIDsLink(tweet_id, $replace, $tweet[0], post_ids);
}

function SelectPreview(event) {
    let $container = $(event.target).closest('.ntisas-qtip-container');
    if ($container.hasClass('ntisas-similar-results')) {
        let type = $container.data('type');
        if (!IsQuerySettingEnabled('confirm_save', type)) {
            return;
        }
    }
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
    $('#ntisas-enable-lockpage, #ntisas-disable-lockpage').toggle();
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

function DownloadOriginal(event) {
    const mime_types = {
        jpg: 'image/jpeg',
        png: 'image/png',
        mp4: 'video/mp4',
    };
    let [$link, $tweet,,,,,, ] = GetEventPreload(event, 'ntisas-download-original');
    let image_link = $link.attr('href');
    let download_name = $link.attr('download');
    let [, extension] = GetFileURLNameExt(image_link);
    let mime_type = mime_types[extension];
    if (mime_type) {
        this.debug('log', "Saving", image_link, "as", download_name);
        let $counter = $tweet.find('.ntisas-download-counter');
        let counter = parseInt($counter.text());
        $counter.text(counter + 1);
        JSPLib.network.getData(image_link).then((blob) => {
            let image_blob = blob.slice(0, blob.size, mime_type);
            saveAs(image_blob, download_name);
            this.debug('log', "Saved", extension, "file as", mime_type, "with size of", blob.size);
        }).catch((e) => {
            let error_text = 'Check the debug console.';
            if (Number.isInteger(e)) {
                error_text = 'HTTP ' + e;
            } else {
                JSPLib.debug.debugerror("DownloadOriginal error:", e);
            }
            JSPLib.notice.error(`Error downloading image: ${error_text}`);
        }).always(() => {
            let counter = parseInt($counter.text());
            $counter.text(counter - 1);
        });
    } else {
        JSPLib.notice.error("Unknown mime type for extension:", extension);
    }
    event.preventDefault();
}

function DownloadAll(event) {
    let [, $tweet,,,,,, ] = GetEventPreload(event, 'ntisas-download-all');
    $('.ntisas-download-original', $tweet[0]).click();
}

function ListInfo() {
    $('#ntisas-list-info-table').html(RenderListInfo()).show();
}

function ResetLists() {
    let selected_lists = JSPLib.menu.getCheckboxRadioSelected('[data-setting="select_list"] [data-selector]');
    if (selected_lists.length === 0) {
        JSPLib.notice.notice("Must select at least one list!");
    } else {
        selected_lists.forEach((list) => {
            SaveList(ALL_LISTS[list], [], false);
        });
        UpdateIQDBControls();
        JSPLib.notice.notice("Lists have been reset!");
    }
}

function ExportData() {
    let export_types = JSPLib.menu.getCheckboxRadioSelected('[data-setting="export_types"] [data-selector]');
    if (export_types.length === 0) {
        JSPLib.notice.notice("Must select at least one export type!");
    } else if (!ExportData.is_running) {
        ExportData.is_running = true;
        JSPLib.notice.notice("Exporting data!");
        GetSavePackage(export_types).then((save_package) => {
            let export_addon = export_types.map((type) => `[${type}]`).join('-');
            let time_addon = GetNumericTimestamp(Date.now());
            let filename = `NTISAS-${export_addon}-${time_addon}.json`;
            DownloadObject(save_package, filename, true);
            ExportData.is_running = false;
        });
    }
}

function ImportData() {
    if (!NTISAS.import_is_running) {
        NTISAS.import_is_running = true;
        $('#ntisas-import-counter').text('reading');
        ReadFileAsync('#ntisas-import-file', true).then(async (import_package) => {
            JSPLib.notice.notice("Importing data...");
            let errors = false;
            function userOutput() {
                if (errors) {
                    JSPLib.notice.error("Error importing some data!");
                } else {
                    JSPLib.notice.notice("Finished importing data.");
                }
                NTISAS.import_is_running = false;
            }
            if ('program_data' in import_package) {
                this.debug('log', "Program data:", import_package.program_data);
                Object.keys(import_package.program_data).forEach((key) => {
                    if (ValidateProgramData(key, import_package.program_data[key])) {
                        SetLocalData(key, import_package.program_data[key]);
                    } else {
                        errors = true;
                    }
                });
            }
            if ('database_info' in import_package) {
                this.debug('log', "Database info:", import_package.database_info);
                await JSPLib.storage.saveData('ntisas-database-info', import_package.database_info, JSPLib.storage.twitterstorage);
            }
            if ('tweet_purgelist' in import_package) {
                this.debug('log', "Purgelist length:", Object.keys(import_package.tweet_purgelist).length);
                $('#ntisas-import-counter').text('purging');
                await PurgeBadTweets(import_package.tweet_purgelist);
            }
            if ('tweet_database' in import_package) {
                this.debug('log', "Database length:", Object.keys(import_package.tweet_database).length);
                await SaveDatabase(import_package.tweet_database, '#ntisas-import-counter');
            }
            userOutput();
            await JSPLib.utility.sleep(JSPLib.utility.one_second * 2);
            InitializeDatabase();
        }).catch(() => {
            NTISAS.import_is_running = false;
        });
    }
}

//Timer/callback functions

function UpdateUserIDCallback() {
    function getUserID(selector, field, regex, group) {
        let $obj = $(selector);
        return $obj.length && JSPLib.utility.safeMatch($obj.attr(field), regex, group);
    }
    function saveUserID() {
        let expires = JSPLib.utility.getExpires(TWUSER_EXPIRES);
        JSPLib.storage.saveData('twuser-' + NTISAS.account, {value: NTISAS.user_id, expires});
    }
    function checkUserID() {
        //This will be true if the ID was found in storage
        if (JSPLib.validate.isString(NTISAS.user_id)) {
            JSPLib.notice.debugNoticeLevel("User ID storage path", JSPLib.debug.DEBUG);
            return true;
        }
        let found_ID = true;
        let user_id;
        if (API_DATA.has_data && NTISAS.account && (NTISAS.account in API_DATA.users_name) && (user_id = GetAPIData('users_name', NTISAS.account, 'id_str'))) {
            NTISAS.user_id = user_id;
            JSPLib.notice.debugNoticeLevel("Primary user ID path", JSPLib.debug.DEBUG);
        } else if (user_id = getUserID('[src*="/profile_banners/"]', 'src', BANNER_REGEX, 1)) {
            NTISAS.user_id = user_id;
            JSPLib.notice.debugNoticeLevel("Alternate user ID path #1", JSPLib.debug.DEBUG);
        } else if (user_id = getUserID('[href^="/i/connect_people?user_id="]', 'href', /\d+/, 0)) {
            NTISAS.user_id = user_id;
            JSPLib.notice.debugNoticeLevel("Alternate user ID path #2", JSPLib.debug.DEBUG);
        } else {
            found_ID = false;
        }
        if (found_ID) {
            saveUserID();
        }
        return found_ID;
    }
    NTISAS.user_id = undefined;
    NTISAS.update_on_found = false;
    if (NTISAS.update_user_timer) {
        this.debug('log', "Overwrite existing execution request!");
        clearInterval(NTISAS.update_user_timer);
    }
    let unique_id = UpdateUserIDCallback.unique_id = JSPLib.utility.getUniqueID();
    if (!checkUserID()) {
        JSPLib.storage.checkLocalDB('twuser-' + NTISAS.account, ValidateEntry).then((data) => {
            //This will be true if the interval handler found the user ID
            if (JSPLib.validate.isString(NTISAS.user_id)) {
                this.debug('log', "Interval handler beat storage handler.");
            } else if (data && (unique_id === UpdateUserIDCallback.unique_id)) {
                this.debug('log', "Storage handler beat interval handler.");
                NTISAS.user_id = data.value;
            }
        });
        let interval_expires = JSPLib.utility.getExpires(JSPLib.utility.one_second * 5);
        this.debug('log', "First execution did not find the user ID.");
        NTISAS.update_on_found = true;
        let timer = NTISAS.update_user_timer = setInterval(() => {
            let found_ID = checkUserID();
            if (found_ID) {
                this.debug('log', "Found user ID on nth iteration.");
                clearInterval(timer);
                NTISAS.update_user_timer = null;
            } else if (!JSPLib.utility.validateExpires(interval_expires)) {
                JSPLib.notice.debugError("User ID not found!");
                clearInterval(timer);
                NTISAS.update_user_timer = null;
            }
            this.debug('logLevel', found_ID, NTISAS.user_id, JSPLib.debug.DEBUG);
        }, TIMER_POLL_INTERVAL);
    } else {
        this.debug('log', "Found user ID on 1st iteration.");
    }
}

function UpdateProfileCallback() {
    if (NTISAS.update_profile.timer) {
        clearInterval(NTISAS.update_profile.timer);
    }
    if (NTISAS.user_settings.display_user_id) {
        $('.ntisas-profile-user-id').html(JSPLib.utility.sprintf(PROFILE_USER_ID, ''));
    }
    if (NTISAS.user_settings.display_profile_views) {
        $('.ntisas-profile-user-view').html(JSPLib.utility.sprintf(PROFILE_USER_VIEW, ''));
        $('.ntisas-profile-stream-view').html(JSPLib.utility.sprintf(PROFILE_STREAM_VIEW, ''));
    }
    NTISAS.update_profile = JSPLib.utility.recheckTimer({
        check: () => JSPLib.validate.isString(NTISAS.user_id),
        exec: () => {
            if (NTISAS.user_settings.display_user_id) {
                $('.ntisas-profile-user-id').html(JSPLib.utility.sprintf(PROFILE_USER_ID, NTISAS.user_id));
            }
            if (NTISAS.user_settings.display_profile_views) {
                let user_key = 'user-view-' + NTISAS.user_id;
                GetData(user_key, 'danbooru').then((views) => {
                    InitializeProfileViewCount(views, user_key, '.ntisas-profile-user-view', PROFILE_USER_VIEW);
                });
                let stream_key1 = NTISAS.page + '-stream-view-' + NTISAS.account;
                let stream_key2 = NTISAS.page + '-stream-view-' + NTISAS.user_id;
                let stream_promise1 = GetData(stream_key1, 'danbooru');
                let stream_promise2 = GetData(stream_key2, 'danbooru');
                Promise.all([stream_promise1, stream_promise2]).then(([views1, views2]) => {
                    let views = views1 || views2;
                    InitializeProfileViewCount(views, stream_key2, '.ntisas-profile-stream-view', PROFILE_STREAM_VIEW);
                    if (views1) {
                        RemoveData(stream_key1, 'danbooru');
                    }
                });
            }
        }
    }, TIMER_POLL_INTERVAL, PROFILE_VIEWS_CALLBACK);
}

//Event execute functions

function AutoclickIQDB() {
    if (NTISAS.artist_iqdb_enabled && IsMediaTimeline()) {
        $('.ntisas-check-iqdb').each((i, entry) => {
            let tweet = $(entry).closest('[ntisas-tweet]').get(0);
            if (JSPLib.utility.isScrolledIntoView(tweet, 0.25)) {
                $(entry).click();
            }
        });
    } else if (IsTweetPage()) {
        $(`[ntisas-tweet=main][data-tweet-id=${NTISAS.tweet_id}] .ntisas-check-iqdb`).click();
    }
}

function UnhideTweets() {
    let $hidden_tweets = $('.ntisas-hidden-media [role=button]');
    if ($hidden_tweets.length) {
        this.debug('log', "Found hidden tweets:", $hidden_tweets.length);
        $hidden_tweets.click();
    }
}

//Markup tweet functions

function MarkupMediaType(tweet) {
    if ($('.ntisas-tweet-media [src*="/card_img/"]', tweet).length) {
        $('.ntisas-tweet-media', tweet).addClass('ntisas-tweet-card').removeClass('ntisas-tweet-media');
    } else if ($('.ntisas-tweet-media [role=progressbar]', tweet).length) {
        this.debug('log', "Delaying media check for", $(tweet).data('tweet-id'));
        let timer = setInterval(() => {
            if ($('.ntisas-tweet-media [role=progressbar]', tweet).length === 0) {
                clearInterval(timer);
                MarkupMediaType(tweet);
            }
        }, TIMER_POLL_INTERVAL);
    } else {
        let media_children = $('.ntisas-tweet-media', tweet).children().children();
        media_children.each((i, entry) => {
            let $entry = $(entry);
            let ret = false
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
            } else if ($('video, [data-testid=playButton]', tweet).length) {
                $entry.addClass('ntisas-tweet-video').attr('ntisas-media-type', 'video');
                ret = true;
            } else {
                $entry.addClass('ntisas-tweet-image').attr('ntisas-media-type', 'image');
                ret = true;
            }
            return ret;
        });
    }
}

function MarkupStreamTweet(tweet) {
    try {
        let status_link = $('time', tweet).parent();
        let [, screen_name,, tweet_id] = status_link[0].pathname.split('/');
        $(tweet).attr('ntisas-tweet', 'stream');
        $(tweet).attr('data-tweet-id', tweet_id);
        $(tweet).attr('data-screen-name', screen_name);
        //Get API data if available
        let data_tweet = GetAPIData('tweets', tweet_id);
        if (data_tweet) {
            $(tweet).attr('data-user-id', data_tweet.user_id_str);
        }
        //Not marking this with a a class since Twitter alters it
        let article = tweet.children[0].children[0];
        let main_body = article.children[0].children[0];
        $(main_body).addClass('ntisas-main-body');
        let tweet_status = main_body.children[0];
        $(tweet_status).addClass('ntisas-tweet-status');
        InitializeStatusBar(tweet_status, false);
        let is_retweet = Boolean($(tweet_status).text().match(/ Retweeted$/));
        $(tweet).attr('data-is-retweet', is_retweet);
        if (is_retweet) {
            let data_retweet = GetAPIData('retweets', tweet_id);
            if (data_retweet) {
                $(tweet).attr('data-retweet-id', data_retweet.id_str);
            }
        }
        let tweet_body = main_body.children[1];
        $(tweet_body).addClass('ntisas-tweet-body');
        let tweet_left = tweet_body.children[0];
        $(tweet_left).addClass('ntisas-tweet-left');
        let tweet_right = tweet_body.children[1];
        $(tweet_right).addClass('ntisas-tweet-right');
        let sub_body = tweet_right;
        $(sub_body.children[0]).addClass('ntisas-profile-line');
        var replychild, conversationchild, actionchild;
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
        this.debug('error', e, tweet);
        if (JSPLib.debug.debug_console) {
            JSPLib.notice.error("Error marking up stream tweet! (check debug console for details)", false);
        }
    }
    $('.ntisas-tweet-actions', tweet).after('<div class="ntisas-footer-section"></div>');
    $(tweet).append('<div class="ntisas-highlight-border ntisas-highlight-left"></div><div class="ntisas-highlight-border ntisas-highlight-right"></div><div class="ntisas-highlight-border ntisas-highlight-top"></div><div class="ntisas-highlight-border ntisas-highlight-bottom"></div>');
}

function MarkupMainTweet(tweet) {
    try {
        $(tweet).attr('ntisas-tweet', 'main');
        $(tweet).attr('data-tweet-id', NTISAS.tweet_id);
        //Get API data if available
        let data_tweet = GetAPIData('tweets', NTISAS.tweet_id);
        if (data_tweet) {
            $(tweet).attr('data-user-id', data_tweet.user_id_str);
        }
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
            let screen_name = ($('[role=link]', profile_line).attr('href') || "").slice(1);
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
        $(sub_body.children[1]).addClass('ntisas-tweet-media');
        let has_media = Boolean($(sub_body.children[1]).children().length);
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
        this.debug('error', e, tweet);
        if (JSPLib.debug.debug_console) {
            JSPLib.notice.error("Error marking up main tweet! (check debug console for details)", false);
        }
    }
    $('.ntisas-tweet-actions', tweet).after('<div class="ntisas-footer-section"></div>');
}

function MarkupMediaTweet(tweet) {
    let $tweet = $(tweet);
    $tweet.addClass('ntisas-media-tweet');
    let $link = $tweet.find('a[role="link"]');
    let [, screen_name,, tweet_id, media_type, ] = $link.get(0).pathname.split('/');
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
    $tweet.find('[dir="ltr"]').each((i, entry) => {
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
    if (NTISAS.update_on_found && NTISAS.user_id) {
        UpdateIQDBControls();
        NTISAS.update_on_found = false;
    } else if (NTISAS.update_profile.timer === false) {
        this.debug('warn', "Failed to find user ID!!");
    }

    //Get current page and previous page info
    NTISAS.prev_pagetype = NTISAS.page;
    let pagetype = GetPageType();
    if (pagetype === "other") {
        return;
    }
    //Process only photo popups when in that mode
    if (pagetype === 'photo') {
        NTISAS.photo_navigation = true;
        ProcessPhotoPopup();
        return;
    }
    NTISAS.photo_navigation = false;

    //Process events on a page change
    PageNavigation(pagetype);

    //Process events at each interval
    if (!NTISAS.colors_checked || window.location.pathname === '/i/display') {
        AdjustColorScheme();
    }
    if (NTISAS.user_settings.autoclick_IQDB_enabled) {
        AutoclickIQDB();
    }
    for (let tweet_id in NTISAS.qtip_anchor) {
        if (!document.body.contains(NTISAS.qtip_anchor[tweet_id].get(0))) {
            NTISAS.qtip_anchor[tweet_id].qtiptisas('destroy', true);
            delete NTISAS.tweet_qtip[tweet_id];
            delete NTISAS.qtip_anchor[tweet_id];
        }
    }
    for (let tweet_id in NTISAS.dialog_ancor) {
        if (!document.body.contains(NTISAS.dialog_ancor[tweet_id].get(0))) {
            NTISAS.tweet_dialog[tweet_id].dialog('destroy').remove();
            delete NTISAS.tweet_dialog[tweet_id];
            delete NTISAS.dialog_ancor[tweet_id];
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
    if (NTISAS.user_settings.media_timeline_enabled && NTISAS.page === 'media') {
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

    //Additional processing on all tweets when new tweets get added
    if (DisplayHighlights()) {
        HighlightTweets();
    }
    if (!IsPageType(['tweet', 'web_tweet', 'other'])) {
        CollectTweetStats();
    }
    if (NTISAS.user_settings.auto_unhide_tweets_enabled) {
        UnhideTweets();
    }
}

function PageNavigation(pagetype) {
    //Use all non-URL matching groups as a page key to detect page changes
    let page_key = JSPLib.utility.arrayUnique(
        Object.values(NTISAS.page_match.groups).filter((val) => (JSPLib.validate.isString(val) && !val.startsWith('https:')))
    ).join(',');
    if (NTISAS.page === pagetype && NTISAS.page_key === page_key && (pagetype !== 'hashtag' || NTISAS.hashtag_search === window.location.search)) {
        return;
    }
    var params;
    let account = NTISAS.page_match.groups[pagetype + '_account'];
    let page_id = NTISAS.page_match.groups[pagetype + '_id'];
    NTISAS.prev_page = NTISAS.page;
    NTISAS.page = pagetype;
    NTISAS.page_key = page_key;
    switch (NTISAS.page) {
        case 'main':
        case 'media':
        case 'likes':
        case 'replies':
            this.debug('log', `User timeline [${NTISAS.page}]:`, account);
            NTISAS.account = account;
            UpdateUserIDCallback();
            if (NTISAS.account === 'following' || NTISAS.account === 'lists') {
                return;
            }
            break;
        case 'home':
        case 'list':
        case 'topics':
        case 'moments':
            this.debug('log', `Stream timeline [${NTISAS.page}]:`, page_id || "n/a");
            NTISAS.account = NTISAS.user_id = undefined;
            break;
        case 'hashtag':
            this.debug('log', "Hashtag timeline:", NTISAS.page_match.groups.hashtag_hash);
            NTISAS.account = NTISAS.user_id = undefined;
            NTISAS.hashtag_search = window.location.search;
            break;
        case 'search':
            this.debug('log', "Search timeline:", NTISAS.page_match.groups.search_query);
            params = JSPLib.utility.parseParams(NTISAS.page_match.groups.search_query);
            NTISAS.queries = ParseQueries(params.q);
            NTISAS.account = ('from' in NTISAS.queries ? NTISAS.queries.from : undefined);
            NTISAS.user_id = NTISAS.account && GetAPIData('users_name', NTISAS.account, 'id_str');
            break;
        case 'tweet':
        case 'web_tweet':
            this.debug('log', "Tweet ID:", page_id);
            NTISAS.screen_name = account;
            NTISAS.tweet_id = page_id;
            NTISAS.account = NTISAS.user_id = undefined;
            break;
        case 'display':
            this.debug('log', "Twitter display settings");
            return;
        default:
            //Do nothing
    }
    //Only render pages with attachment points
    if (IsPageType(STREAMING_PAGES) || IsTweetPage()) {
        if ($('#ntisas-side-menu').length === 0) {
            let $account_options = $('header[role=banner] > div > div > div');
            let child_count = $account_options[0].childElementCount;
            if (child_count > 1) {
                $account_options.children().last().css('margin', '0');
            }
            $account_options.append(RenderSideMenu());
            $account_options.attr('id', 'ntisas-account-options'); //Marking this for the CSS
            InitializeSideMenu();
            InitializeDatabaseLink();
            GetTotalRecords().then((total) => {
                $('#ntisas-records-stub').replaceWith(`<a id="ntisas-total-records" class="ntisas-expanded-link">${total}</a>`);
                $('#ntisas-total-records').on(PROGRAM_CLICK, QueryTotalRecords);
            });
        }
        //Bind events for creation/rebind
        if (!JSPLib.utility.isNamespaceBound('#ntisas-open-settings', 'click', PROGRAM_SHORTCUT)) {
            $('#ntisas-menu-selection a').on(PROGRAM_CLICK, SideMenuSelection);
            $('#ntisas-current-records').on(PROGRAM_CLICK, CurrentRecords);
            $('#ntisas-downloads-toggle a').on(PROGRAM_CLICK, ToggleDownloadSection);
            $('#ntisas-view-highlights-toggle a').on(PROGRAM_CLICK, ToggleViewHighlights);
            $('#ntisas-view-counts-toggle a').on(PROGRAM_CLICK, ToggleViewCounts);
            $('#ntisas-iqdb-toggle a').on(PROGRAM_CLICK, ToggleAutoclickIQDB);
            $('#ntisas-open-settings').on(PROGRAM_CLICK, OpenSettingsMenu);
            //These will only get bound here on a rebind
            $('#ntisas-database-version').on(PROGRAM_CLICK, CurrentPostver);
            $('#ntisas-install').on(PROGRAM_CLICK, InstallDatabase);
            $('#ntisas-upgrade').on(PROGRAM_CLICK, UpgradeDatabase);
            $('#ntisas-total-records').on(PROGRAM_CLICK, QueryTotalRecords);
            $('#ntisas-error-messages').on(PROGRAM_CLICK, ErrorMessages);
            $('#ntisas-lockpage-toggle a').on(PROGRAM_CLICK, ToggleLock);
        }
        if (!IsTweetPage() && (NTISAS.prev_pagetype !== 'tweet')) {
            let stat_key = NTISAS.page + NTISAS.page_key;
            NTISAS.page_stats[stat_key] = NTISAS.page_stats[stat_key] || [];
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
            InitializeProfileTimeline();
            UpdateProfileCallback();
        }
    }
    UpdateSideMenu();
    UpdateDownloadControls();
    UpdateViewHighlightControls();
    UpdateViewCountControls();
    UpdateIQDBControls();
    SetCheckPostvers();
    //Tweets are not available upon page load, so don't bother processing them
    if (NTISAS.prev_pagetype !== undefined) {
        UpdateDownloadSection();
        UpdateViewHighlights();
    }
}

function ProcessPhotoPopup() {
    let $photo_container = $('[aria-labelledby="modal-header"] > div > div:first-of-type');
    if ($photo_container.length) {
        let $photo_menu = $('[role=group]:not(.ntisas-photo-menu)', $photo_container[0]);
        if ($photo_menu.length) {
            $photo_container.addClass('ntisas-photo-container');
            $photo_menu.addClass('ntisas-photo-menu');
            $('.ntisas-photo-container [aria-label=Next], .ntisas-photo-container [aria-label=Previous]').on(PROGRAM_CLICK, PhotoNavigation);
            if (NTISAS.user_settings.display_upload_link) {
                InitializeUploadlinks(true);
            }
        }
    }
}

function ProcessTweetImage(obj, image_info, unprocessed_tweets) {
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
            if (NTISAS.user_settings.image_popout_enabled && $tweet.attr('ntisas-tweet') == 'stream') {
                InitializeImageQtip($obj);
            }
        }
    } else {
        $obj.addClass('ntisas-unhandled-image');
        JSPLib.debug.debugExecute(() => {
            if (JSPLib.validate.isBoolean(image_info)) {
                JSPLib.notice.debugNoticeLevel("New unhandled image found (see debug console)", JSPLib.debug.INFO);
                this.debug('warn', "Unhandled image", obj.src, $obj.closest('[ntisas-tweet]').data('tweet-id'));
            }
        });
    }
}

function ProcessTweetImages() {
    let $unprocessed_images = $('.ntisas-tweet-media > div > div:not(.ntisas-tweet-quote):not(.ntisas-tweet-quote2) div:not([ntisas-image]) > img:not(.ntisas-unhandled-image)');
    if ($unprocessed_images.length) {
        this.debug('log', "Images found:", $unprocessed_images.length);
    }
    let unprocessed_tweets = {};
    $unprocessed_images.each((i, image) => {
        let image_info = GetImageURLInfo(image.src);
        ProcessTweetImage(image, image_info, unprocessed_tweets);
    });
    //Only gets executed when videos are autoplay. Otherwise videos get found as images above.
    let $unprocessed_videos = $('.ntisas-tweet-media > div:not(.ntisas-tweet-quote) div:not([ntisas-image]) > video');
    if ($unprocessed_videos.length) {
        this.debug('log', "Videos found:", $unprocessed_videos.length);
    }
    $unprocessed_videos.each((i, video) => {
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
        this.debug('log', "Tweets updated:", total_unprocessed);
    }
}

function ProcessNewTweets() {
    //Use the article HTML element as a landmark for locating tweets
    let $tweet_articles = $('div[data-testid=primaryColumn] div:not([ntisas-tweet]) > div > article[data-testid=tweet]');
    //Get the highest delineation point between tweets that Twitter doesn't alter through events
    let $tweets = $tweet_articles.map((i, entry) => entry.parentElement.parentElement);
    if ($tweets.length === 0) {
        return false;
    }
    NTISAS.uniqueid = JSPLib.utility.getUniqueID();
    this.debug('log', NTISAS.uniqueid);
    let main_tweets = [];
    $tweets.each((i, entry) => {
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
    let $image_tweets = $tweets.filter((i, entry) => $('[ntisas-media-type=image], [ntisas-media-type=video], [ntisas-media-type=deferred]', entry).length);
    this.debug('log', `[${NTISAS.uniqueid}]`, "New:", $tweets.length, "Image:", $image_tweets.length);
    //Initialize tweets with images
    if ($image_tweets.length) {
        InitializeImageTweets($image_tweets);
        if (NTISAS.user_settings.original_download_enabled) {
            UpdateDownloadSection();
        }
        if (NTISAS.user_settings.display_tweet_views) {
            $image_tweets.each((i, entry) => {
                InitializeViewCount(entry);
                UpdateImageDict(entry);
                if (IsTweetPage()) {
                    let tweet_id = $(entry).attr('data-tweet-id');
                    this.debug('logLevel', "Viewable tweet:", tweet_id, JSPLib.utility.DEBUG);
                    AddViewCount(tweet_id);
                    $(entry).attr('viewed', 'true');
                } else {
                    NTISAS.intersection_observer.observe(entry);
                }
            });
            UpdateViewHighlights();
        }
    }
    if (NTISAS.user_settings.display_retweet_id && API_DATA.has_data && IsPageType(['main'])) {
        let $retweets = $tweets.filter('[data-retweet-id]');
        $retweets.each((i, entry) => {
            InitializeRetweetDisplay(entry);
        });
    }
    if (NTISAS.user_settings.display_user_id && API_DATA.has_data && IsTweetPage()) {
        InitializeUserDisplay($tweets);
    }
    return true;
}

function ProcessMediaTweets() {
    let $tweet_list_items = $('div[data-testid=primaryColumn] div[data-testid="cellInnerDiv"] li[role="listitem"]:not(.ntisas-media-tweet)');
    if ($tweet_list_items.length === 0) return;
    NTISAS.timeline_tweets[NTISAS.account] ??= {total: new Set(), single: new Set(), multi: new Set()};
    let timeline_tweets = NTISAS.timeline_tweets[NTISAS.account];
    let tweet_ids = [];
    let promise_array = [];
    $tweet_list_items.each((i, tweet) => {
        let tweet_id = MarkupMediaTweet(tweet);
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
    let multi_tweet_ids = $('.ntisas-media-tweet.ntisas-multi-media').map((i, entry) => entry.dataset.tweetId).toArray();
    var tweet_dict_promise = GetTweetsData(multi_tweet_ids, NTISAS.account);
    if (NTISAS.user_settings.use_graphql) {
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
    const compareColors = (result, val, key) => (String(NTISAS.colors[key]) !== String(val));
    let $tweet_button = $('[data-testid=SideNav_NewTweet_Button]');
    let $home_button = $('[data-testid=AppTabBar_More_Menu] > div > div').filter((i, entry) => entry.children[0].tagName === 'SPAN');
    if ($tweet_button.length && $home_button.length && document.body.style['background-color']) {
        NTISAS.colors_checked = true;
        let new_colors = {
            base_color: getComputedStyle($tweet_button[0]).backgroundColor.match(/\d+/g),
            text_color: getComputedStyle($home_button[0]).color.match(/\d+/g),
            background_color: document.body.style['background-color'].match(/\d+/g)
        };
        if (!NTISAS.colors || JSPLib.utility.objectReduce(new_colors, compareColors, false)) {
            NTISAS.old_colors = NTISAS.colors;
            NTISAS.colors = new_colors;
            let color_style = RenderColorStyle(NTISAS.colors);
            JSPLib.utility.setCSSStyle(color_style, 'color');
            SetLocalData('ntisas-color-style', NTISAS.colors);
        }
    }
}

function HighlightTweets() {
    var $tweets = $('[ntisas-tweet]:not([ntisas-highlight])');
    $tweets.each((i, entry) => {
        var $entry = $(entry);
        $entry.attr('ntisas-highlight', "");
        var tweetid = String($entry.data('tweet-id'));
        if (NTISAS.tweet_pos.includes(tweetid)) {
            return;
        }
        NTISAS.tweet_pos.push(tweetid);
        var favorites = GetTweetStat(entry, ['like', 'unlike']);
        NTISAS.tweet_faves.push(favorites);
    });
    this.debug('log', "Tweets:", NTISAS.tweet_pos);
    this.debug('log', "Faves:", NTISAS.tweet_faves);
    this.debug('log', "Finish:", NTISAS.tweet_finish);
    var current_count = Object.assign(...ALL_SCORE_LEVELS.map((level) => ({[level]: 0})));
    var visible_tweetids = JSPLib.utility.getDOMAttributes($('[ntisas-tweet]'), 'tweet-id', String);
    NTISAS.tweet_pos.forEach((tweetid) => {
        let quartile = GetTweetQuartile(tweetid);
        let level = ALL_SCORE_LEVELS[quartile];
        current_count[level]++;
        if (visible_tweetids.includes(tweetid)) {
            let $tweet = $(`[ntisas-tweet][data-tweet-id=${tweetid}]`);
            $tweet.attr('ntisas-highlight', level);
        }
    });
    this.debug('log', "Excellent:", current_count.excellent, "Good:", current_count.good, "Above average:", current_count.aboveavg, "Fair:", current_count.fair, "Belowavg:", current_count.belowavg, "Poor:", current_count.poor);
}

function CollectTweetStats() {
    let are_new = false;
    let tweets_collected = JSPLib.utility.getObjectAttributes(NTISAS.tweet_stats, 'tweetid');
    $('[ntisas-tweet]').each((i, entry) => {
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

function BroadcastTISAS(ev) {
    this.debug('log', `(${ev.data.type}):`, ev.data);
    switch (ev.data.type) {
        case 'postlink':
            if (ev.data.post_ids.length) {
                JSPLib.storage.setStorageData('tweet-' + ev.data.tweet_id, ev.data.post_ids, sessionStorage);
            } else {
                sessionStorage.removeItem('tweet-' + ev.data.tweet_id);
            }
            UpdatePostIDsLink(ev.data.tweet_id, ev.data.post_ids);
            break;
        case 'database':
            sessionStorage.removeItem('ntisas-database-info');
            $(window).one('focus.ntisas.reload', () => {window.location.reload();});
            break;
        case 'currentrecords':
            InvalidateLocalData('ntisas-recent-timestamp');
            InitializeCurrentRecords();
            break;
        case 'sidemenu_ui':
            UpdateSideMenu();
            break;
        case 'view_highlights':
            UpdateViewHighlights();
            break;
        case 'download_ui':
            UpdateDownloadControls();
            UpdateDownloadSection();
            break;
        case 'autoiqdb':
            NTISAS.lists['auto-iqdb-list'] = ev.data.list;
            UpdateIQDBControls();
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
    $processed_tweets.each((i, tweet) => {
        let $tweet = $(tweet);
        let tweet_id = String($tweet.data('tweet-id'));
        let $post_link = $('.ntisas-database-match', tweet);
        let post_ids = GetSessionTwitterData(tweet_id);
        if ($post_link.length && JSPLib.menu.hasSettingChanged('advanced_tooltips_enabled')) {
            if (NTISAS.user_settings.advanced_tooltips_enabled) {
                InitializePostIDsLink(tweet_id, $post_link.parent(), tweet, post_ids);
            } else {
                $post_link.qtiptisas('destroy', true);
            }
        }
        if ($tweet.filter('[data-retweet-id]').length && JSPLib.menu.hasSettingChanged('display_retweet_id')) {
            if (NTISAS.user_settings.display_retweet_id) {
                InitializeRetweetDisplay(tweet);
            } else {
                $('.ntisas-retweet-id', tweet).html("");
            }
        }
        if (JSPLib.menu.hasSettingChanged('display_tweet_views')) {
            if (NTISAS.user_settings.display_tweet_views) {
                InitializeViewCount(tweet);
            } else {
                $(".ntisas-view-info", tweet).html("");
            }
        }
        if (IsTweetPage() && JSPLib.menu.hasSettingChanged('display_media_link')) {
            if (NTISAS.user_settings.display_media_link) {
                InitializeMediaLink($tweet);
            } else {
                $('.ntisas-media-link', tweet).remove();
            }
        }
        if (JSPLib.menu.hasSettingChanged('original_download_enabled') || JSPLib.menu.hasSettingChanged('filename_prefix_format')) {
            $('.ntisas-download-section', tweet).html("");
            if (NTISAS.user_settings.original_download_enabled) {
                InitializeDownloadLinks($tweet);
                UpdateDownloadControls();
                UpdateDownloadSection();
            } else {
                $('.ntisas-download-header, .ntisas-download-section').css('display', 'none');
            }
        }
        if ($post_link.length && ((post_ids.length > 1 && JSPLib.menu.hasSettingChanged('custom_order_enabled')))) {
            $post_link.qtiptisas('destroy', true);
            InitializePostIDsLink(tweet_id, $post_link.parent(), tweet, post_ids);
        }
    });
    let called_profile_callback = false;
    if (JSPLib.menu.hasSettingChanged('display_user_id')) {
        if (NTISAS.user_settings.display_user_id && IsTweetPage()) {
            InitializeUserDisplay($processed_tweets);
        } else if (NTISAS.user_settings.display_user_id && IsPageType(['main', 'media', 'likes', 'replies'])) {
            UpdateProfileCallback();
            called_profile_callback = true;
        } else if (!NTISAS.user_settings.display_user_id) {
            $('.ntisas-user-id').html("");
            $('.ntisas-profile-user-id').html("");
        }
    }
    if (JSPLib.menu.hasSettingChanged('auto_unhide_tweets_enabled') && NTISAS.user_settings.auto_unhide_tweets_enabled) {
        UnhideTweets();
    }
    if (JSPLib.menu.hasSettingChanged('display_profile_views') && IsPageType(['main', 'media', 'likes', 'replies'])) {
        if (NTISAS.user_settings.display_profile_views && !called_profile_callback) {
            UpdateProfileCallback();
        } else {
            $('.ntisas-profile-user-view').html("");
            $('.ntisas-profile-stream-view').html("");
        }
    }
    if (JSPLib.menu.hasSettingChanged('image_popout_enabled') && IsPageType(STREAMING_PAGES)) {
        $('[ntisas-tweet=stream] [ntisas-image] img').each((i, image) => {
            let $image = $(image);
            if (NTISAS.user_settings.image_popout_enabled) {
                InitializeImageQtip($image);
            } else {
                $image.qtiptisas('destroy', true);
            }
        });
        NTISAS.image_anchor = {};
    }
    if (JSPLib.menu.hasSettingChanged('display_tweet_statistics') && NTISAS.user_settings.display_tweet_statistics && !IsPageType(['tweet', 'web_tweet', 'other'])) {
        CollectTweetStats();
    }
    if (JSPLib.menu.hasSettingChanged('display_upload_link')) {
        if (NTISAS.user_settings.display_upload_link) {
            let $upload_link = $('.ntisas-upload');
            let install = true;
            if ($upload_link.length) {
                $('.ntisas-upload').show();
                install = false;
            }
            if (NTISAS.page === "photo") {
                InitializeUploadlinks(install);
            }
        } else {
            $('.ntisas-upload').hide();
        }
    }
    if (JSPLib.menu.hasSettingChanged('lock_page_enabled')) {
        if (NTISAS.user_settings.lock_page_enabled && NTISAS.page_locked) {
            $(window).on('beforeunload.ntisas.lock_page', () => "");
        } else {
            $(window).off('beforeunload.ntisas.lock_page');
        }
    }
    if (JSPLib.menu.hasSettingChanged('media_timeline_enabled') && !NTISAS.user_settings.media_timeline_enabled) {
        $('.ntisas-media-icon-container').remove();
        $('.ntisas-media-view-icon').remove();
        $('.ntisas-media-tweet').removeClass('ntisas-media-tweet');
    }
    if (JSPLib.menu.hasSettingChanged('score_highlights_enabled') || JSPLib.menu.hasSettingChanged('score_window_size')) {
        $('[ntisas-highlight]').attr('ntisas-highlight', null);
        if (DisplayHighlights()) {
            NTISAS.tweet_pos = [];
            NTISAS.tweet_faves = [];
            NTISAS.tweet_finish = {};
            HighlightTweets();
        }
    }
    if (JSPLib.menu.hasSettingChanged('query_subdomain')) {
        let old_domain = NTISAS.domain;
        SetQueryDomain();
        $(`[href^="${old_domain}"]`).each((i, entry) => {
            entry.href = NTISAS.domain + entry.pathname + entry.search;
        });
    }
    if (JSPLib.menu.hasSettingChanged('SauceNAO_API_key')) {
        SetSauceAPIKey();
    }
    if (JSPLib.menu.hasSettingChanged('bypass_server_mode')) {
        InitializeDatabaseLink();
    }
    InitializeSideMenu();
}

function OpenSettingsMenu() {
    if (!NTISAS.opened_menu) {
        if ($('#new-twitter-image-searches-and-stuff').length === 0) {
            RenderSettingsMenu();
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
    NTISAS.domain = 'https://' + NTISAS.user_settings.query_subdomain + '.donmai.us';
}

function SetSauceAPIKey() {
    JSPLib.saucenao.api_key = NTISAS.user_settings.SauceNAO_API_key;
}

function GetMenuCloseButton() {
    return $('#new-twitter-image-searches-and-stuff').closest('.ntisas-dialog').find('.ntisas-dialog-close');
}

function InitializeDialogButtons() {
    $('.ntisas-dialog .ui-dialog-buttonset .ui-button').each((i, entry) => {
        let key = entry.innerText;
        for (let attribute in MENU_DIALOG_BUTTONS[key]) {
            $(entry).attr(attribute, MENU_DIALOG_BUTTONS[key][attribute]);
        }
    });
    GetMenuCloseButton().attr('title', CLOSE_HELP);
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
    $('#ntisas-display-settings').append(JSPLib.menu.renderCheckbox('display_user_id'));
    $('#ntisas-display-settings').append(JSPLib.menu.renderCheckbox('display_retweet_id'));
    $('#ntisas-display-settings').append(JSPLib.menu.renderCheckbox('display_media_link'));
    $('#ntisas-display-settings').append(JSPLib.menu.renderCheckbox('display_image_number'));
    $('#ntisas-display-settings').append(JSPLib.menu.renderCheckbox('display_upload_link'));
    $('#ntisas-display-settings').append(JSPLib.menu.renderCheckbox('display_tweet_statistics'));
    $('#ntisas-display-settings').append(JSPLib.menu.renderCheckbox('display_available_sauce'));
    $('#ntisas-display-settings').append(JSPLib.menu.renderCheckbox('display_network_errors'));
    $('#ntisas-function-settings').append(JSPLib.menu.renderCheckbox('media_timeline_enabled'));
    $('#ntisas-function-settings').append(JSPLib.menu.renderCheckbox('advanced_tooltips_enabled'));
    $('#ntisas-function-settings').append(JSPLib.menu.renderCheckbox('image_popout_enabled'));
    $('#ntisas-function-settings').append(JSPLib.menu.renderCheckbox('auto_unhide_tweets_enabled'));
    $('#ntisas-function-settings').append(JSPLib.menu.renderCheckbox('lock_page_enabled'));
    $('#ntisas-highlight-settings').append(JSPLib.menu.renderCheckbox('score_highlights_enabled'));
    $('#ntisas-highlight-settings').append(JSPLib.menu.renderTextinput('score_window_size', 5));
    $("#ntisas-query-message").append(JSPLib.menu.renderExpandable("Additional setting details", QUERY_SETTINGS_DETAILS));
    $('#ntisas-query-settings').append(JSPLib.menu.renderInputSelectors('IQDB_settings', 'checkbox'));
    $('#ntisas-query-settings').append(JSPLib.menu.renderInputSelectors('sauce_settings', 'checkbox'));
    $('#ntisas-query-settings').append(JSPLib.menu.renderCheckbox('autoclick_IQDB_enabled'));
    $('#ntisas-query-settings').append(JSPLib.menu.renderTextinput('similarity_cutoff', 10));
    $('#ntisas-query-settings').append(JSPLib.menu.renderTextinput('results_returned', 10));
    $('#ntisas-query-settings').append(JSPLib.menu.renderTextinput('SauceNAO_API_key', 80));
    $('#ntisas-database-settings').append(JSPLib.menu.renderCheckbox('bypass_server_mode'));
    $('#ntisas-network-settings').append(JSPLib.menu.renderCheckbox('URL_wildcards_enabled'));
    $('#ntisas-network-settings').append(JSPLib.menu.renderCheckbox('custom_order_enabled'));
    $('#ntisas-network-settings').append(JSPLib.menu.renderTextinput('recheck_interval', 5));
    $('#ntisas-network-settings').append(JSPLib.menu.renderInputSelectors('query_subdomain', 'radio'));
    $('#ntisas-network-settings').append(JSPLib.menu.renderCheckbox('use_graphql'));
    $('#ntisas-download-settings').append(JSPLib.menu.renderCheckbox('original_download_enabled'));
    $('#ntisas-download-settings').append(JSPLib.menu.renderTextinput('filename_prefix_format', 80));
    $("#ntisas-list-message").append(JSPLib.menu.renderExpandable("Additional control details", LIST_CONTROL_DETAILS));
    $('#ntisas-list-controls').append(JSPLib.menu.renderInputSelectors('select_list', 'checkbox', true));
    $('#ntisas-list-controls').append(JSPLib.menu.renderLinkclick('reset_list', true));
    $('#ntisas-list-controls').append(JSPLib.menu.renderLinkclick('list_info', true));
    $("#ntisas-list-controls").append(LIST_INFO_TABLE);
    $('#ntisas-cache-controls').append(IMPORT_FILE_INPUT);
    $('#ntisas-cache-controls').append(JSPLib.menu.renderLinkclick('import_data', true));
    $('#ntisas-cache-controls').append(JSPLib.menu.renderInputSelectors('export_types', 'checkbox', true));
    $('#ntisas-cache-controls').append(JSPLib.menu.renderLinkclick('export_data', true));
    $('#ntisas-cache-controls').append(JSPLib.menu.renderLinkclick('cache_info', true));
    $('#ntisas-cache-controls').append(JSPLib.menu.renderCacheInfoTable());
    $('#ntisas-cache-controls').append(JSPLib.menu.renderLinkclick('purge_cache', true));
    $('#ntisas-cache-controls').append(IMPORT_ERROR_DISPLAY);
    //Engage jQuery UI
    JSPLib.menu.engageUI(true);
    $('#ntisas-settings').tabs();
    //Set event handlers
    JSPLib.menu.saveUserSettingsClick(InitializeChangedSettings);
    JSPLib.menu.resetUserSettingsClick(LOCALSTORAGE_KEYS, InitializeChangedSettings);
    $('#ntisas-control-reset-list').on(PROGRAM_CLICK, ResetLists);
    $('#ntisas-control-list-info').on(PROGRAM_CLICK, ListInfo);
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
    InitializeUIStyle();
}

//Main function

async function Main() {
    JSPLib.network.jQuerySetup();
    JSPLib.notice.installBanner(PROGRAM_SHORTCUT);
    Object.assign(NTISAS, {
        intersection_observer: new IntersectionObserver(CheckViews, {threshold: 0.75}),
        channel: JSPLib.utility.createBroadcastChannel(PROGRAM_NAME, BroadcastTISAS),
        user_settings: JSPLib.menu.loadUserSettings(),
    }, PROGRAM_DEFAULT_VALUES, PROGRAM_RESET_KEYS);
    if (!IsTISASInstalled()) {
        await CheckDatabaseInfo(true);
    }
    SetQueryDomain();
    SetSauceAPIKey();
    await InstallUserProfileData();
    $(document).on(PROGRAM_CLICK, '.ntisas-tweet-header a', ToggleSideMenu);
    $(document).on(PROGRAM_CLICK, '.ntisas-check-url', CheckURL);
    $(document).on(PROGRAM_CLICK, '.ntisas-check-iqdb', CheckIQDB);
    $(document).on(PROGRAM_CLICK, '.ntisas-check-sauce', CheckSauce);
    $(document).on(PROGRAM_CLICK, '.ntisas-manual-add', ManualAdd);
    $(document).on(PROGRAM_CLICK, '.ntisas-confirm-save', ConfirmSave);
    $(document).on(PROGRAM_CLICK, '.ntisas-confirm-delete', ConfirmDelete);
    $(document).on(PROGRAM_CLICK, '.ntisas-reset-results', ResetResults);
    $(document).on(PROGRAM_CLICK, '.ntisas-merge-results', MergeResults);
    $(document).on(PROGRAM_CLICK, '.ntisas-cancel-merge', CancelMerge);
    $(document).on(PROGRAM_CLICK, '.ntisas-help-info', HelpInfo);
    $(document).on(PROGRAM_CLICK, '.ntisas-post-preview a', SelectPreview);
    $(document).on(PROGRAM_CLICK, '.ntisas-select-controls a', SelectControls);
    $(document).on(PROGRAM_CLICK, '.ntisas-download-original', DownloadOriginal);
    $(document).on(PROGRAM_CLICK, '.ntisas-download-all', DownloadAll);
    $(document).on(PROGRAM_CLICK, '.ntisas-metric', SelectMetric);
    $(document).on(PROGRAM_CLICK, '.ntisas-toggle-image-size', ToggleImageSize);
    $(document).on(PROGRAM_KEYDOWN, null, 'left', PhotoNavigation);
    $(document).on(PROGRAM_KEYDOWN, null, 'right', PhotoNavigation);
    $(document).on(PROGRAM_KEYDOWN, null, 'alt+q', ToggleAutoclickIQDB);
    $(document).on(PROGRAM_KEYDOWN, null, 'alt+d', ToggleDownloadSection);
    $(document).on(PROGRAM_KEYDOWN, null, 'alt+v', ToggleViewHighlights);
    $(document).on(PROGRAM_KEYDOWN, null, 'alt+m', OpenSettingsMenu);
    $(document).on(PROGRAM_KEYDOWN, null, 'alt+c', CloseSettingsMenu);
    $(document).on(PROGRAM_KEYDOWN, null, 'alt+s', SaveSettingsMenu);
    $(document).on(PROGRAM_KEYDOWN, null, 'alt+r', ResetSettingsMenu);
    $(document).on(PROGRAM_KEYDOWN, null, 'alt+1 alt+2 alt+3', SideMenuHotkeys);
    setInterval(IntervalStorageHandler, QUEUE_POLL_INTERVAL);
    setInterval(IntervalNetworkHandler, QUEUE_POLL_INTERVAL);
    JSPLib.utility.setCSSStyle(PROGRAM_CSS, 'program');
    JSPLib.utility.setCSSStyle(GM_getResourceText('jquery_qtip_css'), 'qtip');
    JSPLib.utility.setCSSStyle(NOTICE_CSS, 'notice');
    InitializeColorScheme();
    JSPLib.utility.initializeInterval(RegularCheck, PROGRAM_RECHECK_INTERVAL);
    JSPLib.statistics.addPageStatistics(PROGRAM_NAME);
    JSPLib.load.noncriticalTasks(CleanupTasks);
}

/****Function decoration****/

[
    UnhideTweets, HighlightTweets, RegularCheck, ImportData, DownloadOriginal, PromptSavePostIDs,
    CheckIQDB, CheckURL, PurgeBadTweets, CheckPurgeBadTweets, SaveDatabase, LoadDatabase, CheckPostvers,
    ReadFileAsync, ProcessPostvers, InitializeImageTweets, CorrectStringArray, ValidateEntry, BroadcastTISAS,
    PageNavigation, ProcessNewTweets, ProcessTweetImage, ProcessTweetImages, InitializeUploadlinks, CheckSauce,
    GetMaxVideoDownloadLink, GetPageType, CheckServerBadTweets, SavePostvers, PickImage, MarkupMainTweet,
    MarkupStreamTweet, MarkupMediaType, CheckViews, InitializeViewCount, ToggleImageSize, InitializeProfileTimeline,
    IntervalStorageHandler, GetImageAttributes, UpdateUserIDCallback, PreloadStorageData,
] = JSPLib.debug.addFunctionLogs([
    UnhideTweets, HighlightTweets, RegularCheck, ImportData, DownloadOriginal, PromptSavePostIDs,
    CheckIQDB, CheckURL, PurgeBadTweets, CheckPurgeBadTweets, SaveDatabase, LoadDatabase, CheckPostvers,
    ReadFileAsync, ProcessPostvers, InitializeImageTweets, CorrectStringArray, ValidateEntry, BroadcastTISAS,
    PageNavigation, ProcessNewTweets, ProcessTweetImage, ProcessTweetImages, InitializeUploadlinks, CheckSauce,
    GetMaxVideoDownloadLink, GetPageType, CheckServerBadTweets, SavePostvers, PickImage, MarkupMainTweet,
    MarkupStreamTweet, MarkupMediaType, CheckViews, InitializeViewCount, ToggleImageSize, InitializeProfileTimeline,
    IntervalStorageHandler, GetImageAttributes, UpdateUserIDCallback, PreloadStorageData,
]);

[
    RenderSettingsMenu, PurgeBadTweets, SaveDatabase, GetSavePackage, CheckPostvers,
] = JSPLib.debug.addFunctionTimers([
    RenderSettingsMenu, PurgeBadTweets, SaveDatabase, GetSavePackage, CheckPostvers,
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
JSPLib.menu.settings_callback = RemoteSettingsCallback;
JSPLib.menu.settings_migrations = [
    {from: 'display_view_count', to: 'display_tweet_views'},
];
JSPLib.menu.settings_config = SETTINGS_CONFIG;
JSPLib.menu.control_config = CONTROL_CONFIG;

//Variables for storage.js
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
JSPLib.load.exportData(PROGRAM_NAME, NTISAS, {other_data: {API_DATA, jQuery, XRegExp, SAVED_STORAGE_REQUESTS, SAVED_NETWORK_REQUESTS}, datalist: ['page']});
JSPLib.load.exportFuncs(PROGRAM_NAME, {debuglist: [GetList, SaveList, GetData, SaveData, GetTweetAPI1_1, GetTweetGQL, GetTweetsAPI1_1], alwayslist: [GetAPIData, GetImageLinks]});

/****Execution start****/

var hook_disabled = (GM_info?.scriptHandler === 'Tampermonkey' &&
                     GM_info?.userAgentData.brands.some(brand => brand.brand === 'Firefox'));
if (!hook_disabled) {
    JSPLib.network.installXHRHook([TweetUserData]);
}
JSPLib.load.programInitialize(Main, {program_name: PROGRAM_NAME, required_selectors: PROGRAM_LOAD_REQUIRED_SELECTORS, max_retries: 100, timer_interval: 500});
