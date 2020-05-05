// ==UserScript==
// @name         New Twitter Image Searches and Stuff
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      6.5
// @description  Searches Danbooru database for tweet IDs, adds image search links, and highlights images based on Tweet favorites.
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        https://twitter.com/*
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/New_Twitter_Image_Searches_and_Stuff.user.js
// @require      https://cdn.jsdelivr.net/npm/core-js-bundle@3.2.1/minified.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.4.1/jquery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
// @require      https://cdn.jsdelivr.net/npm/jquery-hotkeys@0.2.2/jquery-hotkeys.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.13.1/validate.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.7.3/localforage.min.js
// @require      https://cdn.jsdelivr.net/npm/localforage-getitems@1.4.2/dist/localforage-getitems.js
// @require      https://cdn.jsdelivr.net/npm/localforage-setitems@1.4.0/dist/localforage-setitems.js
// @require      https://cdn.jsdelivr.net/npm/localforage-removeitems@1.4.0/dist/localforage-removeitems.js
// @require      https://cdn.jsdelivr.net/npm/xregexp@4.2.4/xregexp-all.js
// @require      https://cdn.jsdelivr.net/npm/file-saver@2.0.2/dist/FileSaver.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/custom-20190305/custom/qtip_tisas.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/concurrency.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/saucenao.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/menu.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/danbooru/utility.js
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
// @run-at       document-start
// @noframes
// ==/UserScript==

/* global $ jQuery Danbooru JSPLib validate localforage saveAs XRegExp */

/****Global variables****/

//Library constants

////NONE

//Exterior script variables

const DANBOORU_TOPIC_ID = '16342';

//Variables for load.js
const PROGRAM_LOAD_REQUIRED_VARIABLES = [];
const PROGRAM_LOAD_REQUIRED_SELECTORS = ['[role=region]'];

//Program name constants
const PROGRAM_FULL_NAME = "New Twitter Image Searches and Stuff";
const PROGRAM_NAME = 'NTISAS';
const PROGRAM_SHORTCUT = 'ntisas';
const PROGRAM_CLICK = 'click.ntisas';
const PROGRAM_KEYDOWN = 'keydown.ntisas';

//Variables for network.js
const API_DATA = {tweets: {}, users_id: {}, users_name: {}, retweets: {}, has_data: false};

//Variables for storage.js
JSPLib.storage.twitterstorage = localforage.createInstance({
    name: 'Twitter storage',
    driver: [localforage.INDEXEDDB]
});

//Main program variable
const NTISAS = {};

//TIMER function hash
const TIMER = {};

//Program data constants
const PROGRAM_DATA_REGEX = /^(post|view|iqdb|sauce|video)-/; //Regex that matches the prefix of all program cache data

//For factory reset !!!These need to be set!!!
const LOCALSTORAGE_KEYS = [
    'ntisas-postver-lastid',
    'ntisas-badver-lastid',
    'ntisas-overflow',
    'ntisas-color-style',
];
const PROGRAM_RESET_KEYS = {
    tweet_pos: [],
    tweet_faves: [],
    tweet_finish: {},
    page_stats: {},
    counted_artists: [],
    counted_tweets: [],
};

//Settings constants
const COMMON_QUERY_SETTINGS = ['pick_image', 'confirm_save', 'auto_save'];
const DEFAULT_QUERY_SETTINGS = ['pick_image', 'confirm_save'];
const ALL_SCORE_LEVELS = ['excellent', 'good', 'aboveavg', 'fair', 'belowavg', 'poor'];
const SCORE_LEVELS = ['good', 'aboveavg', 'fair', 'belowavg', 'poor'];
const SUBDOMAINS = ['danbooru', 'kagamihara', 'saitou', 'shima'];
const ALL_POSITIONS = ['above', 'below'];

//Main settings
const SETTINGS_CONFIG = {
    IQDB_settings: {
        allitems: COMMON_QUERY_SETTINGS,
        default: DEFAULT_QUERY_SETTINGS,
        validate: (data) => JSPLib.menu.validateCheckboxRadio(data, 'checkbox', COMMON_QUERY_SETTINGS),
        hint: "Check/uncheck to turn on/off setting."
    },
    sauce_settings: {
        allitems: COMMON_QUERY_SETTINGS,
        default: DEFAULT_QUERY_SETTINGS,
        validate: (data) => JSPLib.menu.validateCheckboxRadio(data, 'checkbox', COMMON_QUERY_SETTINGS),
        hint: "Check/uncheck to turn on/off setting."
    },
    SauceNAO_API_key: {
        default: "",
        parse: String,
        validate: JSPLib.validate.isString,
        hint: "Required to use SauceNAO queries. See <a href=\"http://saucenao.com\" target=\"_blank\">SauceNAO</a> for how to get an API key."
    },
    similarity_cutoff: {
        default: 80.0,
        parse: parseFloat,
        validate: (data) => JSPLib.validate.isNumber(data) && data > 0 && data < 100,
        hint: "Minimum similiarity score of an image match to return. Valid values: 0 - 100."
    },
    results_returned: {
        default: 5,
        parse: parseInt,
        validate: (data) => Number.isInteger(data) && data > 0 && data <= 20,
        hint: "Maximum number of results to return per image. Valid values: 1 - 20."
    },
    URL_wildcards_enabled: {
        default: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Manual searches of URLs will use wildcards in the search. <b>Note:</b> This will make the search take longer or timeout."
    },
    recheck_interval: {
        default: 10,
        parse: parseInt,
        validate: (data) => Number.isInteger(data) && data >= 5,
        hint: "Number of minutes. Valid values: >= 5. How often to check post versions once up to date."
    },
    custom_order_enabled: {
        default: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Multi-post results will use <span class=\"ntisas-code\">order:custom</span>, showing results with Twitter's order. <b>Note:</b> This will break the tag limit for non-Gold+."
    },
    query_subdomain: {
        allitems: SUBDOMAINS,
        default: ['danbooru'],
        validate: (data) => JSPLib.menu.validateCheckboxRadio(data, 'radio', SUBDOMAINS),
        hint: "Select which subdomain of Danbooru to query from. <b>Note:</b> The chosen subdomain must be logged into or the script will fail to work."
    },
    confirm_delete_enabled: {
        default: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Prompt the user on deleting results from the database."
    },
    delete_all_default: {
        default: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Whether to start out with <b>Delete all</b> enabled or not on the advanced tooltips."
    },
    merge_results_enabled: {
        default: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays a merge link that allows a new query merging the old results with the new."
    },
    bypass_server_mode: {
        default: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Operates without information from the tweet server database. <b>Note:</b> Should only be used when the server is unreachable."
    },
    autocheck_IQDB_enabled: {
        default: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Will trigger the <b>IQDB</b> link if no results are found with the <b>URL</b> link."
    },
    autoclick_IQDB_enabled: {
        default: false,
        validate: JSPLib.validate.isBoolean,
        hint: `Will automatically trigger the <b>IQDB</b> links (limited availability, see <a class="ntisas-forum-topic-link" target="_blank">topic #${DANBOORU_TOPIC_ID}</a> for details). <b>Note:</b> Any results are saved automatically.`
    },
    auto_unhide_tweets_enabled: {
        default: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Automatically unhides sensitive Tweet content (while browsing anonymously)."
    },
    display_retweet_id: {
        default: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays the retweet ID next to the retweeter's name. <b>Note:</b> Only available with access to Twitter's API."
    },
    display_view_count: {
        default: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays the the number of times a tweet has been seen in the current tab."
    },
    display_user_id: {
        default: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays the user ID above the username on the Tweet view. <b>Note:</b> Only available with access to Twitter's API."
    },
    display_media_link: {
        default: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays a link to the media/likes timeline in the tweet view."
    },
    display_image_number: {
        default: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays the image number used by <b>Download Originals</b>."
    },
    display_upload_link: {
        default: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays an <b>Upload</b> link to Danbooru in the enlarged image view."
    },
    display_tweet_statistics: {
        default: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays tweets statistics for the current timeline in the side menu."
    },
    display_network_errors: {
        default: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays network error count and controls in the side menu."
    },
    lock_page_enabled: {
        default: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays controls in the side menu to allow page navigation to be locked."
    },
    tweet_indicators_enabled: {
        default: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Display controls that allow temporary/permanent marking of a Tweet/Account."
    },
    score_highlights_enabled: {
        default: true,
        validate: JSPLib.validate.isBoolean,
        hint: `Adds colored borders and other stylings based upon the Tweet score (limited availability, see <a class="ntisas-forum-topic-link" target="_blank">topic #${DANBOORU_TOPIC_ID}</a> for details).`
    },
    advanced_tooltips_enabled: {
        default: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays extra information and thumbnails on IQDB results. <b>Note:</b> Only when the data is not auto-saved."
    },
    score_levels_faded: {
        allitems: SCORE_LEVELS,
        default: ['belowavg'],
        validate: (data) => JSPLib.menu.validateCheckboxRadio(data, 'radio', SCORE_LEVELS),
        hint: "Select the default score level cutoff (inclusive) where Tweets get faded automatically."
    },
    score_levels_hidden: {
        allitems: SCORE_LEVELS,
        default: ['poor'],
        validate: (data) => JSPLib.menu.validateCheckboxRadio(data, 'radio', SCORE_LEVELS),
        hint: "Select the default score level cutoff (inclusive) where Tweets get hidden automatically."
    },
    score_window_size: {
        default: 40,
        parse: parseInt,
        validate: (data) => Number.isInteger(data) && data >= 10,
        hint: "Valid values: >= 10. The number of surrounding tweets to consider when calculating levels."
    },
    original_download_enabled: {
        default: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Shows download links for the original images on the Tweet view with customizable filename prefixes."
    },
    download_position: {
        allitems: ALL_POSITIONS,
        default: ['above'],
        validate: (data) => JSPLib.menu.validateCheckboxRadio(data, 'radio', ALL_POSITIONS),
        hint: "Select whether the download image links will appear above or below the images."
    },
    filename_prefix_format: {
        default: "%TWEETID%--%IMG%",
        parse: String,
        validate: JSPLib.validate.isString,
        hint: "Prefix to add to original image downloads. Available format keywords include:<br><span class=\"ntisas-code\">%TWEETID%, %USERID%, %USERACCOUNT%, %IMG%, %DATE%, %TIME%, %ORDER%</span>."
    }
};

const ALL_LIST_TYPES = ['highlight', 'iqdb', 'artist', 'tweet'];
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
const BASE_PREVIEW_WIDTH = 165;
const POST_PREVIEW_DIMENSION = 150;
const TWITTER_SPACING_CLASSES = [
    'r-1vvnge1', //padding for Twitter icon
    'r-1ag2gil', 'r-oyd9sg', //padding for side menu items
    'r-vpgt9t', 'r-jw8lkh', //padding for tweet button
];
const TWITTER_SPACING_SELECTOR = JSPLib.utility.joinList(TWITTER_SPACING_CLASSES, '#ntisas-account-options .', null, ',');

const PROGRAM_CSS = `
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
.ntisas-highlight.ntisas-excellent {
    border: red solid 10px;
}
.ntisas-highlight.ntisas-good {
    border: orange solid 10px;
}
.ntisas-highlight.ntisas-aboveavg {
    border: green solid 10px;
}
.ntisas-highlight.ntisas-fair {
    border: blue solid 10px;
}
.ntisas-highlight.ntisas-belowavg {
    border: purple solid 10px;
}
.ntisas-highlight.ntisas-poor {
    border: black solid 10px;
}
.ntisas-highlight.ntisas-fade article {
    opacity: 0.2;
}
.ntisas-highlight.ntisas-fade article:hover {
    opacity: 1.0;
}
.ntisas-highlight.ntisas-hide article {
    opacity: 0.0;
}
.ntisas-highlight.ntisas-hide article:hover {
    opacity: 1.0;
}
.ntisas-show-views .ntisas-viewed .ntisas-tweet-left {
    border: 1px solid;
    border-radius: 25px;
}
.ntisas-code {
    font-family: monospace;
}
#ntisas-database-version,
#ntisas-install,
#ntisas-upgrade {
    color: #0073ff;
}
.ntisas-tweet .ntisas-database-match,
.ntisas-tweet .ntisas-database-match:hover,
.ntisas-tweet .ntisas-database-match:focus,
.ntisas-tweet .ntisas-similar-match-great,
.ntisas-tweet .ntisas-similar-match-great:hover,
.ntisas-tweet .ntisas-similar-match-great:focus {
    color: green;
}
.ntisas-tweet .ntisas-similar-match-good,
.ntisas-tweet .ntisas-similar-match-good:hover,
.ntisas-tweet .ntisas-similar-match-good:focus {
    color: blue;
}
.ntisas-tweet .ntisas-similar-match-fair,
.ntisas-tweet .ntisas-similar-match-fair:hover,
.ntisas-tweet .ntisas-similar-match-fair:focus {
    color: orange;
}
.ntisas-tweet .ntisas-similar-match-poor,
.ntisas-tweet .ntisas-similar-match-poor:hover,
.ntisas-tweet .ntisas-similar-match-poor:focus {
    color: red;
}
.ntisas-tweet .ntisas-manual-add,
.ntisas-tweet .ntisas-manual-add:hover,
.ntisas-tweet .ntisas-database-no-match,
.ntisas-tweet .ntisas-database-no-match:hover,
.ntisas-tweet .ntisas-cancel-merge,
.ntisas-tweet .ntisas-cancel-merge:hover {
    color: red;
}
.ntisas-tweet .ntisas-check-url,
.ntisas-tweet .ntisas-check-url:hover,
.ntisas-tweet .ntisas-check-iqdb,
.ntisas-tweet .ntisas-check-iqdb:hover,
.ntisas-tweet .ntisas-check-sauce,
.ntisas-tweet .ntisas-check-sauce:hover,
.ntisas-tweet .ntisas-merge-results,
.ntisas-tweet .ntisas-merge-results:hover,
#ntisas-current-records,
#ntisas-error-messages,
#ntisas-total-records,
#ntisas-current-fade-level,
#ntisas-current-hide-level {
    color: grey;
}
#ntisas-server-bypass,
#ntisas-active-autoiqdb,
#ntisas-unavailable-highlights,
#ntisas-unavailable-autoiqdb {
    font-style: italic;
    letter-spacing: 1px;
}
.ntisas-tweet .ntisas-check-url,
.ntisas-tweet .ntisas-check-iqdb,
.ntisas-tweet .ntisas-check-sauce,
#ntisas-artist-toggle
#ntisas-views-toggle,
#ntisas-indicator-toggle {
    display: inline-block;
    min-width: 40px;
    text-align: center;
}
#ntisas-artist-toggle a,
#ntisas-views-toggle a,
#ntisas-iqdb-toggle a,
#ntisas-indicator-toggle a {
    display: none;
}
#ntisas-current-fade-level,
#ntisas-current-hide-level {
    min-width: 5em;
    display: inline-block;
    text-align: center;
}
#ntisas-enable-highlights,
#ntisas-enable-views,
#ntisas-enable-autoiqdb,
#ntisas-enable-indicators,
#ntisas-disable-lockpage {
    color: green;
}
#ntisas-disable-highlights,
#ntisas-disable-views,
#ntisas-disable-autoiqdb,
#ntisas-disable-indicators,
#ntisas-enable-lockpage {
    color: red;
}
#ntisas-increase-fade-level:hover,
#ntisas-increase-hide-level:hover,
#ntisas-decrease-fade-level:hover,
#ntisas-decrease-hide-level:hover {
    text-decoration: none;
}
#ntisas-side-menu {
    font-size: 14px;
    margin-top: 10px;
    margin-left: -15px;
    width: 285px;
    height: 475px;
    font-family: ${FONT_FAMILY};
}
#ntisas-side-border {
    border: solid lightgrey 1px;
}
#ntisas-menu-settings {
    margin-left: 5px;
    font-weight: bold;
    line-height: 18px;
}
#ntisas-menu-settings td {
    padding: 0 2px;
}
#ntisas-menu-settings td:nth-of-type(1),
#ntisas-menu-settings td:nth-of-type(2) {
    width: 115px;
}
#ntisas-version-header,
#ntisas-database-version {
    letter-spacing: -0.5px;
}
#ntisas-install,
#ntisas-upgrade,
#ntisas-current-records,
#ntisas-hide-level-header,
#ntisas-fade-level-header {
    letter-spacing: -1px;
}
#ntisas-menu-header {
    margin: 8px -10px;
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
.ntisas-download-section {
    font-size: 24px;
    line-height: 30px;
    letter-spacing: .01em;
    white-space: normal;
    font-family: ${FONT_FAMILY};
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
.ntisas-download-original,
.ntisas-download-all {
    margin: 0 0.5em;
    font-size: 75%;
}
.qtiptisas.ntisas-preview-tooltip {
    max-width: none;
}
.ntisas-preview-tooltip .qtiptisas-content {
    max-width: 850px;
    max-height: 500px;
    overflow-y: auto;
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
.ntisas-confirm-image > p {
    font-weight: 12px;
    padding: 6px;
}
.ntisas-confirm-image b {
    font-weight: bold;
}
.ntisas-delete-label {
    font-size: 1em;
    margin-top: 0.25em;
    margin-right: 0.5em;
    float: left;
}
.ntisas-delete-all {
    display: block;
    float: left;
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
.ntisas-post-match .ntisas-image-container {
    border: solid green 5px;
}
.ntisas-post-select .ntisas-image-container {
    border: solid black 5px;
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
    margin-left: 1em;
    font-weight: bold;
    font-family: ${FONT_FAMILY};
}
.ntisas-image-menu.ntisas-tweet-actions {
    max-width: 550px;
}
.ntisas-image-menu.ntisas-tweet-actions .ntisas-reply {
    justify-content: flex-start;
}
.ntisas-image-menu.ntisas-tweet-actions .ntisas-retweet {
    justify-content: center;
}
.ntisas-image-menu.ntisas-tweet-actions .ntisas-like {
    justify-content: flex-end;
}
.ntisas-image-menu.ntisas-tweet-actions .ntisas-share {
    justify-content: center;
    min-width: 50px;
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
    color: hotpink;
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
.ntisas-main-tweet .ntisas-tweet-status {
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
.ntisas-tweet .r-n6v787 {
    font-size: 10px;
}
.ntisas-retweet-id {
    font-size: 12px;
}
.ntisas-view-info {
    font-size: 12px;
    font-family: monospace;
    letter-spacing: -1px;
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
.ntisas-main-tweet .ntisas-tweet-media,
.ntisas-main-tweet .ntisas-time-line {
    margin-bottom: 10px;
}
.ntisas-main-tweet .ntisas-tweet-actions {
    height: 35px;
}
.ntisas-main-tweet .ntisas-retweets-likes {
    padding: 10px 0;
}
.ntisas-footer-entries {
    font-size: 16px;
    font-weight: bold;
    font-family: ${FONT_FAMILY};
}
.ntisas-main-tweet .ntisas-footer-entries {
    border-top-width: 1px;
    border-top-style: solid;
    padding: 5px 0 20px;
}
.ntisas-stream-tweet .ntisas-footer-entries {
    margin-top: 10px;
}
.ntisas-mark-artist,
.ntisas-mark-artist:hover {
    color: red;
}
.ntisas-mark-tweet,
.ntisas-mark-tweet:hover {
    color: orange;
}
.ntisas-count-artist,
.ntisas-count-artist:hover {
    color: blue;
}
.ntisas-count-tweet,
.ntisas-count-tweet:hover {
    color: green;
}
.ntisas-activated,
.ntisas-activated:hover {
    color: unset;
}
#ntisas-indicator-counter {
    position: absolute;
    right: -3.75em;
    font-size: 20px;
    font-weight: bold;
    font-family: ${FONT_FAMILY};
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
#ntisas-account-options .r-1jayybb {
    min-height: 35px;
}
#ntisas-account-options [role=link] > div {
    padding: 8px;
}
@media screen and (min-width: 1282px) {
    #ntisas-account-options {
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
}`;

const MENU_CSS = `
.jsplib-outer-menu {
    float: left;
    width: 100%;
    min-width: 60em;
}
.jsplib-settings-grouping {
    margin-bottom: 2em;
}
.jsplib-settings-buttons {
    margin-top: 1em;
}
.jsplib-menu-item {
    margin: 0.5em;
}
.jsplib-menu-item > div,
.jsplib-menu-item > ul {
    margin-left: 0.5em;
}
.jsplib-inline-tooltip {
    display: inline;
    font-style: italic;
}
.jsplib-block-tooltip {
    display: block;
    font-style: italic;
}
.jsplib-textinput jsplib-setting {
    padding: 1px 0.5em;
}
.jsplib-sortlist li {
    width: 5.5em;
    font-size: 125%;
}
.jsplib-sortlist li > div {
    padding: 5px;
}
.jsplib-textinput-control .jsplib-control {
    padding: 1px 0.5em;
}
.jsplib-selectors.ntisas-selectors label,
.jsplib-selectors.ntisas-selectors label:hover {
    width: 140px;
    font-weight: bold;
}
.jsplib-linkclick .jsplib-control {
    display: inline;
}
.jsplib-console {
    width: 100%;
    min-width: 60em;
}
.jsplib-console hr,
.jsplib-console .expandable {
    width: 90%;
    margin-left: 0;
}
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
#ntisas-indicator-counter,
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
#ntisas-unavailable-highlights,
#ntisas-unavailable-autoiqdb,
#ntisas-tweet-stats-message {
    color: %TEXTMUTED%;
}
.ntisas-main-tweet .ntisas-footer-entries {
    border-color: %TEXTFADED%;
}
.ntisas-download-original,
.ntisas-download-all,
.ntisas-media-link,
#ntisas-tweet-stats-table th a {
    color: %BASECOLOR%;
}
.ntisas-media-link,
#ntisas-tweet-stats-table th a {
    border-color: %BASECOLOR%;
}
.ntisas-media-link:hover,
#ntisas-tweet-stats-table th a:hover {
    background-color: %BASEFAINT%;
}
.ntisas-media-link:active,
.ntisas-media-link:focus {
    box-shadow: 0 0 0 2px %BACKGROUNDCOLOR%, 0 0 0 4px %BASECOLOR%;
}
.ntisas-show-views .ntisas-viewed .ntisas-tweet-left {
    border-color: %TEXTMUTED%;
    background-color: %TEXTFADED%;
}
#ntisas-increase-fade-level:hover,
#ntisas-increase-hide-level:hover,
#ntisas-decrease-fade-level:hover,
#ntisas-decrease-hide-level:hover {
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
.jsplib-inline-tooltip,
.jsplib-block-tooltip {
    color: %TEXTSHADED%;
}
#new-twitter-image-searches-and-stuff a {
    color: %BASECOLOR%;
}
.ui-dialog.ntisas-dialog .ui-state-active .ui-icon-background {
    border: 4px solid %BASEDARKER%;
}
.ui-dialog.ntisas-dialog .ui-widget-header {
    color: %TEXTCOLOR%;
    background: %BASESHADED%;
}
.ui-dialog.ntisas-dialog .ui-button {
    color: %TEXTCOLOR%;
    background: %BASEFAINT%;
    border: 1px solid %BASESHADED%;
}
.ui-dialog.ntisas-dialog .ui-button:hover,
.ui-dialog.ntisas-dialog .ui-tab:hover {
    background: %BASESHADED%;
    border: 1px solid %BASECOLOR%;
}

.ui-dialog.ntisas-dialog .ui-widget-content .ui-state-active,
.ui-dialog.ntisas-dialog .ui-widget-content .ui-state-active:focus {
    color: %BACKGROUNDCOLOR%;
    background: %BASECOLOR%;
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
/*qTips*/
.qtiptisas.qtiptisas-twitter {
    color: %TEXTCOLOR%;
    background: %BACKGROUNDCOLOR%;
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

const CACHE_INFO_TABLE = '<div id="ntisas-cache-info-table" style="display:none"></div>';

const NTISAS_MENU = `
<div id="ntisas-script-message" class="prose">
    <h2>${PROGRAM_FULL_NAME}</h2>
    <div id="ntisas-forum-message">
        <p>Check the forum for the latest on information and updates (<a class="ntisas-forum-topic-link" target="_blank">topic #${DANBOORU_TOPIC_ID}</a>).</p>
        <p>For the TISAS version on old Twitter, check the forum at <a class="tisas-forum-topic-link" target="_blank">topic #15976</a>.</p>
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
        <div id="ntisas-highlight-settings" class="jsplib-settings-grouping">
            <div id="ntisas-highlight-message" class="prose">
                <h4>Highlight settings</h4>
            </div>
        </div>
        <div id="ntisas-query-settings" class="jsplib-settings-grouping">
            <div id="ntisas-query-message" class="prose">
                <h4>Query settings</h4>
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
                <p><b>Note:</b> Sauce may be limited. Check <a href="http://saucenao.com" target="_blank">SauceNAO</a> for details.
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
                <p>Alter lists used to control various aspects of NTISAS.</p>
                <p><b>Note:</b> Factory Reset does not affect the lists.</p>
                <ul>
                    <li><b>Highlight:</b> No highlight list</li>
                    <li><b>IQDB:</b> Auto-IQDB list</li>
                    <li><b>Artist:</b> Tweet Indicators / Artist</li>
                    <li><b>Tweet:</b> Tweet Indicators / Tweet</li>
                </ul>
            </div>
        </div>
        <div id="ntisas-cache-controls" class="jsplib-settings-grouping">
            <div id="ntisas-cache-message" class="prose">
                <h4>Cache controls</h4>
            </div>
        </div>
    </div>
</div>`;

const SIDE_MENU = `
<div id="ntisas-side-menu" class="ntisas-links">
<div id="ntisas-side-border">
    <div id="ntisas-menu-header">${PROGRAM_FULL_NAME}</div>
    <div id="ntisas-menu-settings">
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
            <tr data-setting="score_highlights_enabled">
                <td><span>Artist highlights:</span></td>
                <td>%HIGHLIGHTS%</td>
                <td>(%HIGHLIGHTSHELP%)</td>
            </tr>
            <tr id="ntisas-fade-level-display">
                <td><span id="ntisas-fade-level-header">Current fade level:</span></td>
                <td>%CURRENTFADE%</td>
                <td>(%CURRENTFADEHELP%)</td>
            </tr>
            <tr id="ntisas-hide-level-display">
                <td><span id="ntisas-hide-level-header">Current hide level:</span></td>
                <td>%CURRENTHIDE%</td>
                <td>(%CURRENTHIDEHELP%)</td>
            </tr>
            <tr data-setting="display_view_count">
                <td><span>View highlights:</span></td>
                <td>%VIEWS%</td>
                <td>(%VIEWSHELP%)</td>
            </tr>
            <tr data-setting="autoclick_IQDB_enabled">
                <td><span>Autoclick IQDB:</span></td>
                <td>%AUTOCLICKIQDB%</td>
                <td>(%AUTOCLICKIQDBHELP%)</td>
            </tr>
            <tr data-setting="tweet_indicators_enabled">
                <td><span>Tweet indicators:</span></td>
                <td>%INDICATOR%</td>
                <td>(%INDICATORHELP%)</td>
            </tr>
            <tr data-setting="lock_page_enabled">
                <td><span>Page navigation:</span></td>
                <td>%LOCKPAGE%</td>
                <td>(%LOCKPAGEHELP%)</td>
            </tr>
            <tr data-setting="display_network_errors">
                <td><span>Network errors:</span></td>
                <td><a id="ntisas-error-messages">%ERRORMESSAGES%</a></td>
                <td>(%ERRORMESSAGESHELP%)</td>
            </tr>
            </tbody>
        </table>
    </div>
    <div id="ntisas-open-settings">
        <input type="button" title="%SETTINGSHELP%" value="Settings">
    </div>
    <div data-setting="display_tweet_statistics">
        ${HORIZONTAL_RULE}
        <div id="ntisas-stats-header"><span>Tweet Statistics</span> (%STATISTICSHELP%)</div>
        <div id="ntisas-tweet-stats-table"></div>
        <div id="ntisas-tweet-stats-message">Unavailable on Tweet view.</div>
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

const INDICATOR_LINKS = `
<div class="ntisas-footer-entries ntisas-links">
    Mark(
        <a class="ntisas-mark-artist ntisas-expanded-link">Artist</a> |
        <a class="ntisas-mark-tweet ntisas-expanded-link">Tweet</a>
    )&emsp;
    Count(
        <a class="ntisas-count-artist ntisas-expanded-link">Artist</a> |
        <a class="ntisas-count-tweet ntisas-expanded-link">Tweet</a>
    )
</div>`;

const MINUS_SIGN = `
<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="-20 -40 240 240">
    <path d="M 0,75 L 0,125 L 200,125 L 200,75 L 0,75 z" fill="#F00" />
</svg>`;

const PLUS_SIGN = `
<svg xmlns="http://www.w3.org/2000/svg"  width="15" height="15" viewBox="-20 -40 240 240">
    <path d="M75,0 V75 H0 V125 H75 V200 H125 V125 H200 V75 H125 V0 H75 z" fill="#080" />
</svg>`;

const HIGHLIGHT_HTML = `
<span id="ntisas-artist-toggle">
    <a id="ntisas-enable-highlights" class="ntisas-expanded-link">Enable</a>
    <a id="ntisas-disable-highlights" class="ntisas-expanded-link">Disable</a>
    <span id="ntisas-unavailable-highlights">Unavailable</span>
</span>`;

const FADE_HIGHLIGHT_HTML = `
<a id="ntisas-decrease-fade-level" class="ntisas-expanded-link">${MINUS_SIGN}</a>
<span id="ntisas-current-fade-level">%s</span>
<a id="ntisas-increase-fade-level" class="ntisas-expanded-link">${PLUS_SIGN}</a>`;

const HIDE_HIGHLIGHT_HTML = `
<a id="ntisas-decrease-hide-level" class="ntisas-expanded-link">${MINUS_SIGN}</a>
<span id="ntisas-current-hide-level">%s</span>
<a id="ntisas-increase-hide-level" class="ntisas-expanded-link">${PLUS_SIGN}</a>`;

const VIEWS_HTML = `
<span id="ntisas-views-toggle">
    <a id="ntisas-enable-views" class="ntisas-expanded-link">Enable</a>
    <a id="ntisas-disable-views" class="ntisas-expanded-link">Disable</a>
</span>`;

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

const INDICATOR_HTML = `
<span id="ntisas-indicator-toggle">
    <a id="ntisas-enable-indicators" class="ntisas-expanded-link">Show</a>
    <a id="ntisas-disable-indicators" class="ntisas-expanded-link">Hide</a>
</span>`;

const MEDIA_LINKS_HTML = `
<div class="ntisas-main-links">
    <a class="ntisas-media-link" href="/%SCREENNAME%/media">Media</a>
    <a class="ntisas-media-link" href="/%SCREENNAME%/likes">Likes</a>
</div>`;



const STATUS_MARKER = '<span class="ntisas-status-marker"><span class="ntisas-user-id"></span><span class="ntisas-retweet-id"></span><span class="ntisas-indicators"></span><span class="ntisas-view-info"></span></span>';
const MAIN_COUNTER = '<span id="ntisas-indicator-counter">( <span class="ntisas-count-artist">0</span> , <span class="ntisas-count-tweet">0</span> )</span>';
const TWEET_INDICATORS = '<span class="ntisas-mark-artist">Ⓐ</span><span class="ntisas-mark-tweet">Ⓣ</span><span class="ntisas-count-artist">ⓐ</span><span class="ntisas-count-tweet">ⓣ</span>';
const NOTICE_BANNER = '<div id="ntisas-notice"><span>.</span><a href="javascript:void(0)" id="ntisas-close-notice-link">close</a></div>';
const LOAD_COUNTER = '<span id="ntisas-load-message">Loading ( <span id="ntisas-counter">...</span> )</span>';

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
const DATABASE_VERSION_HELP = "L-Click to set record position to latest on Danbooru.\nR-Click to open page to Danbooru records.";
const UPDATE_RECORDS_HELP = "L-Click to update records to current.";
const MUST_INSTALL_HELP = "The database must be installed before the script is fully functional.";
const REFRESH_RECORDS_HELP = "L-Click to refresh record count.";
const HIGHLIGHTS_HELP = "L-Click to toggle Tweet hiding/fading. (Shortcut: Alt+H)";
const VIEWS_HELP = "L-Click to toggle borders on viewed Tweets. (Shortcut: Alt+V)";
const FADE_HIGHLIGHT_HELP = "L-Click '-' to decrease fade level. (Shortcut: Alt+-)\nL-Click '+' to increase fade level. (Shortcut: Alt+=)";
const HIDE_HIGHLIGHT_HELP = "L-Click '-' to decrease hide level. (Shortcut: Alt+[)\nL-Click '+' to increase hide level. (Shortcut: Alt+])";
const AUTO_IQDB_HELP = "L-Click to toggle auto-IQDB click. (Shortcut: Alt+Q)";
const INDICATOR_HELP = "L-Click to toggle display of Tweet mark/count controls. (Shortcut: Alt+I)";
const LOCKPAGE_HELP = "L-Click to prevent navigating away from the page (does not prevent Twitter navigation).";
const ERROR_MESSAGES_HELP = "L-Click to see full error messages.";
const STATISTICS_HELP = 'L-Click any category heading to narrow down results.\nL-Click &quot;Total&quot; category to reset results.';

const INSTALL_MENU_TEXT = "Must install DB!";
const LOGIN_MENU_TEXT = "Log into Danbooru!";

const SERVER_ERROR = "Failed to connect to remote server to get latest %s!";

//Simple template trim for singular strings
function TRIM(string) {
    return string[0].trim();
}

const LOGIN_ALERT = TRIM`
User must be logged into Danbooru for the script to work.
Also, check the user settings for the subdomain being used.

Note: Banned users cannot use this functionality!
Instead, use Check URL or Check IQDB to get this info.
Set the recheck interval to a long duration in user settings
to avoid repeatedly getting this message.`;

const INSTALL_CONFIRM = TRIM`
This will install the database (%s, %s).
This can take a couple of minutes.

Click OK when ready.`;

const UPGRADE_CONFIRM = TRIM`
This will upgrade the database to (%s, %s).
Old database is at (%s, %s).
This can take a couple of minutes.

Click OK when ready.`;

const CURRENT_RECORDS_CONFIRM = TRIM`
This will keep querying Danbooru until the records are current.
Depending on the current position, this could take several minutes.
Moving focus away from the page will halt the process.

Continue?`;

const CURRENT_POSTVER_CONFIRM = TRIM`
This will query Danbooru for the latest record position to use.
This may potentially cause change records to be missed.

Continue?`;

const MANUAL_ADD_PROMPT = "Enter the post IDs of matches. (separated by commas)";
const CONFIRM_SAVE_PROMPT = "Save the following post IDs? (separate by comma, empty to reset link)";
const CONFIRM_DELETE_PROMPT = TRIM`
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
const PROGRAM_RECHECK_INTERVAL = JSPLib.utility.one_second;
const VIEWCOUNT_RECENT_DURATION = JSPLib.utility.one_minute * 5;
const POST_VERSIONS_CALLBACK = JSPLib.utility.one_second * 5;
const PAGE_REFRESH_TIMEOUT = JSPLib.utility.one_second * 5;
const REMOVE_CHECK_TIMEOUT = JSPLib.utility.one_second * 10;
const MIN_POST_EXPIRES = JSPLib.utility.one_day;
const MAX_POST_EXPIRES = JSPLib.utility.one_month;
const USER_EXPIRES = JSPLib.utility.one_month;
const VIEW_EXPIRES = JSPLib.utility.one_month;
const SIMILAR_EXPIRES = JSPLib.utility.one_day;
const VIDEO_EXPIRES = JSPLib.utility.one_week;
const LENGTH_RECHECK_EXPIRES = JSPLib.utility.one_hour;
const USER_PROFILE_RECHECK_EXPIRES = JSPLib.utility.one_month;
const DATABASE_RECHECK_EXPIRES = JSPLib.utility.one_day;
const BADVER_RECHECK_EXPIRES = JSPLib.utility.one_day;
const PRUNE_RECHECK_EXPIRES = JSPLib.utility.one_hour * 6;
const CLEANUP_TASK_DELAY = JSPLib.utility.one_minute;

//Regex constants

var TWITTER_ACCOUNT = String.raw`[\w-]+`;
var TWITTER_ID = String.raw`\d+`;
var QUERY_END = String.raw`(?:\?|$)`;

const TWEET_REGEX = XRegExp.tag('g')`^https://twitter\.com/[\w-]+/status/(\d+)$`;
const TWEET_URL_REGEX = XRegExp.tag('g')`^https://twitter\.com/[\w-]+/status/\d+`;
const SOURCE_TWITTER_REGEX = XRegExp.tag('g')`^source:https://twitter\.com/[\w-]+/status/(\d+)$`;

const HANDLED_IMAGES = [{
    regex: XRegExp.tag()`^https://pbs\.twimg\.com/(media|tweet_video_thumb)/([^.?]+)`,
    format: 'https://pbs.twimg.com/%s/%s.%s',
    arguments: (match,extension)=>[match[1], match[2], extension[0]],
},{
    regex: XRegExp.tag()`^https://pbs\.twimg\.com/ext_tw_video_thumb/(\d+)/(\w+)/img/([^.?]+)`,
    format: 'https://pbs.twimg.com/ext_tw_video_thumb/%s/%s/img/%s.jpg',
    arguments: (match,extension)=>[match[1], match[2], match[3]],
},{
    regex: XRegExp.tag()`^https://pbs\.twimg\.com/amplify_video_thumb/(\d+)/img/([^.?]+)`,
    format: 'https://pbs.twimg.com/amplify_video_thumb/%s/img/%s.jpg',
    arguments: (match,extension)=>[match[1], match[2]],
}];
const UNHANDLED_IMAGES = [
    XRegExp.tag()`^https://pbs\.twimg\.com/profile_images/`,
    XRegExp.tag()`^https://[^.]+\.twimg\.com/emoji/`,
    XRegExp.tag()`^https://pbs.twimg.com/ad_img/`,
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
            moment_account: TWITTER_ACCOUNT,
            moment_id: TWITTER_ID,
            moments: 'i/moments/',
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

const QUERY_LIMIT = 100;
const QUERY_BATCH_NUM = 5;
const QUERY_BATCH_SIZE = QUERY_LIMIT * QUERY_BATCH_NUM;

const POST_FIELDS = 'id,uploader_id,score,fav_count,rating,tag_string,created_at,preview_file_url,source,file_ext,file_size,image_width,image_height,uploader[name]';
const POSTVER_FIELDS = 'id,updated_at,post_id,version,source,source_changed,added_tags,removed_tags';
const PROFILE_FIELDS = 'id,level';

//DOM constants

const HIGHLIGHT_CONTROLS = ['enable', 'disable', 'unavailable'];
const VIEW_CONTROLS = ['enable', 'disable'];
const IQDB_CONTROLS = ['enable', 'disable', 'active', 'unavailable'];
const INDICATOR_CONTROLS = ['enable', 'disable'];

const ALL_INDICATOR_TYPES = ['mark-artist', 'mark-tweet', 'count-artist', 'count-tweet'];

const BASE_DIALOG_WIDTH = 45;
const BASE_QTIP_WIDTH = 10;

//Queue constants

const QUEUED_STORAGE_REQUESTS = [];
const CACHED_STORAGE_REQUESTS = {};
const CACHE_STORAGE_TYPES = ['get','check'];
const STORAGE_DATABASES = {
    danbooru: JSPLib.storage.danboorustorage,
    twitter: JSPLib.storage.twitterstorage,
};

const QUEUED_NETWORK_REQUESTS = [];

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

//Other constants

const STREAMING_PAGES = ['home', 'main', 'likes', 'replies', 'media', 'list', 'search', 'hashtag', 'moment'];
const MEDIA_TYPES = ['images', 'media', 'videos'];

const ALL_LISTS = {
    highlight: 'no-highlight-list',
    iqdb: 'auto-iqdb-list',
    artist: 'artist-list',
    tweet: 'tweet-list'
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
        delay: 250,
        solo: true,
    },
    hide: {
        delay: 250,
        fixed: true,
        leave: false, // Prevent hiding when cursor hovers a browser tooltip
    }
};

const CONFIRM_DIALOG_SETTINGS = {
    title: "Image select",
    modal: true,
    resizable:false,
    autoOpen: false,
    classes: {
        'ui-dialog': 'ntisas-dialog',
        'ui-dialog-titlebar-close': 'ntisas-dialog-close'
    },
    open: function (event,ui ) {
        this.promiseConfirm = new Promise((resolve)=>{this.resolveConfirm = resolve;});
    },
    close: function (event,ui) {
        this.resolveConfirm && this.resolveConfirm(false);
    },
    buttons: {
        'Submit': function () {
            this.resolveConfirm && this.resolveConfirm(true);
            $(this).dialog('close');
        },
        'Cancel': function () {
            this.resolveConfirm && this.resolveConfirm(false);
            $(this).dialog('close');
        }
    }
};

const MENU_DIALOG_SETTINGS = {
    modal: true,
    resizable:false,
    autoOpen: false,
    width: 1000,
    height: 800,
    classes: {
        'ui-dialog': 'ntisas-dialog',
        'ui-dialog-titlebar-close': 'ntisas-dialog-close'
    },
    open: (event,ui)=>{
        NTISAS.opened_menu = true;
    },
    close: (event,ui)=>{
        NTISAS.opened_menu = false;
    },
    buttons: {
        //Save and reset are bound separately
        'Save': (()=>{}),
        'Factory reset': (()=>{}),
        'Cancel': function () {
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
    'Cancel': {
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
        rating: JSPLib.validate.inclusion_constraints(['s', 'q', 'e']),
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
}

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
}

const VIDEO_CONSTRAINTS = {
    expires: JSPLib.validate.expires_constraints,
    value: JSPLib.validate.stringnull_constraints
}

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

function ValidateEntry(key,entry) {
    if (!JSPLib.validate.validateIsHash(key, entry)) {
        return false;
    }
    if (key.match(/^post-/)) {
        return ValidateTypeEntry(key, entry, POST_CONSTRAINTS);
    }
    if (key.match(/^user-/)) {
        return ValidateTypeEntry(key, entry, USER_CONSTRAINTS);
    }
    if (key.match(/^view-/)) {
        return ValidateTypeEntry(key, entry, VIEW_CONSTRAINTS);
    }
    if (key.match(/^(iqdb|sauce)-/)) {
        return JSPLib.validate.validateHashEntries(key, entry, SIMILAR_CONSTRAINTS);
    }
    if (key.match(/^video-/)) {
        return JSPLib.validate.validateHashEntries(key, entry, VIDEO_CONSTRAINTS);
    }
    ValidateEntry.debuglog("Bad key!");
    return false;
}

function ValidateExpiration(key) {
    if (key.match(/^post-/)) {
        return MAX_POST_EXPIRES;
    }
    if (key.match(/^user-/)) {
        return USER_EXPIRES;
    }
    if (key.match(/^view-/)) {
        return VIEW_EXPIRES;
    }
    if (key.match(/^(iqdb|sauce)-/)) {
        return SIMILAR_EXPIRES;
    }
    if (key.match(/^video-/)) {
        return VIDEO_EXPIRES;
    }
    return 0;
}

function ValidateTypeEntry(key,entry,constraints) {
    if (!JSPLib.validate.validateHashEntries(key, entry, constraints.entry)) {
        return false;
    }
    return JSPLib.validate.validateHashEntries(key + '.value', entry.value, constraints.value);
}

function ValidateProgramData(key,entry) {
    var checkerror = [], check;
    switch (key) {
        case 'ntisas-recent-timestamp':
            if (!Number.isInteger(entry)) {
                checkerror = ["Value is not an integer."];
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
        default:
            checkerror = ["Not a valid program data key."];
    }
    if (checkerror.length) {
        JSPLib.validate.printValidateError(key, checkerror);
        return false;
    }
    return true;
}

function CorrectStringArray(name,stringlist) {
    let error_messages = [];
    if (!Array.isArray(stringlist)) {
        CorrectStringArray.debuglog("Value is not an array.");
        return [];
    }
    let correctlist = stringlist.filter((name)=>{return JSPLib.validate.isString(name);});
    if (stringlist.length !== correctlist.length) {
        JSPLib.storage.setStorageData('ntisas-' + name, correctlist, localStorage);
        JSPLib.debug.debugExecute(()=>{
            let bad_values = JSPLib.utility.setDifference(stringlist, correctlist);
            CorrectStringArray.debuglog("Bad values found:", name, bad_values);
        });
    }
    return correctlist;
}

function VaildateColorArray(array) {
    return array.every((val)=>{
        let parse = Number(val);
        return JSPLib.validate.isString(val) &&
               Number.isInteger(parse) &&
               parse >=0 && parse <= 255;
    });
}

//Library functions

////NONE

//Helper functions

function GetAPIData(key,id,value) {
    if (API_DATA === undefined || !(key in API_DATA) || !(id in API_DATA[key])) {
        return null;
    }
    return (value ? API_DATA[key][id][value] : API_DATA[key][id]);
}

function GetNumericTimestamp(timestamp) {
    let time_obj = new Date(timestamp);
    return GetDateString(timestamp) + GetTimeString(timestamp);
}

function GetDateString(timestamp) {
    let time_obj = new Date(timestamp);
    return `${time_obj.getFullYear()}${JSPLib.utility.padNumber(time_obj.getMonth() + 1, 2)}${JSPLib.utility.padNumber(time_obj.getDate() ,2)}`;
}

function GetTimeString(timestamp) {
    let time_obj = new Date(timestamp);
    return `${JSPLib.utility.padNumber(time_obj.getHours(), 2)}${JSPLib.utility.padNumber(time_obj.getMinutes(), 2)}`;
}

function ParseQueries(str) {
    return str.split(' ').reduce(function (params, param) {
        var paramSplit = param.split(':');
        params[paramSplit[0]] = paramSplit[1];
        return params;
    }, {});
}

function TimeAgo(timestamp) {
    let time_interval = Date.now() - timestamp;
    if (time_interval < JSPLib.utility.one_hour) {
        return JSPLib.utility.setPrecision(time_interval / JSPLib.utility.one_minute, 2) + " minutes ago";
    } else if (time_interval < JSPLib.utility.one_day) {
        return JSPLib.utility.setPrecision(time_interval / JSPLib.utility.one_hour, 2) + " hours ago";
    } else if (time_interval < JSPLib.utility.one_month) {
        return JSPLib.utility.setPrecision(time_interval / JSPLib.utility.one_day, 2) + " days ago";
    } else if (time_interval < JSPLib.utility.one_year) {
        return JSPLib.utility.setPrecision(time_interval / JSPLib.utility.one_month, 2) + " months ago";
    } else {
        return JSPLib.utility.setPrecision(time_interval / JSPLib.utility.one_year, 2) + " years ago";
    }
}

function GetPostVersionsExpiration() {
    return NTISAS.user_settings.recheck_interval * JSPLib.utility.one_minute;
}

function WasOverflow() {
    return JSPLib.storage.checkStorageData('ntisas-overflow', ValidateProgramData, localStorage, false);
}

function IsTISASInstalled() {
    return JSPLib.storage.getStorageData('ntisas-remote-database', localStorage) !== null;
}

function GetUserIdent() {
    if (API_DATA.has_data) {
        return [NTISAS.user_id, [NTISAS.user_id, NTISAS.account]];
    } else {
        return [NTISAS.account, [NTISAS.account]];
    }
}

function PageRegex() {
    if (!('regex' in PageRegex)) {
        let built_regexes = Object.assign({}, ...Object.keys(ALL_PAGE_REGEXES).map((page)=>{
            //Match at beginning of string with Twitter URL
            let regex = XRegExp.build(`^ https://twitter.com/ ` + ALL_PAGE_REGEXES[page].format, ALL_PAGE_REGEXES[page].subs, 'x');
            //Add page named capturing group
            return {[page]: XRegExp.build(' ( {{' + page + '}} ) ', {[page]: regex}, 'x')};
        }));
        //Combine all regexes
        let all_format = Object.keys(built_regexes).map((page)=>{return ' {{' + page + '}} ';}).join('|');
        let all_regex = XRegExp.build(all_format, built_regexes, 'x');
        //Add overall capturing group...
        PageRegex.regex = XRegExp.build(' ( {{site}} )', {site: all_regex}, 'x');
    }
    return PageRegex.regex;
}

function DisplayHighlights() {
    return NTISAS.user_settings.score_highlights_enabled && IsMediaTimeline();
}

function IsQuerySettingEnabled(setting,type) {
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
    }
}

function MapSimilar(post,score) {
    return {
        score: score,
        post: post
    }
}

function GetLinkTitle(post) {
    let tags = JSPLib.utility.HTMLEscape(post.tags);
    let age = JSPLib.utility.HTMLEscape(`age:"${TimeAgo(post.created)}"`);
    return `user:${post.uploadername} score:${post.score} favcount:${post.favcount} rating:${post.rating} ${age} ${tags}`;
}

function GetMultiLinkTitle(posts) {
    let title = [];
    posts.forEach((post,i)=>{
        let age = JSPLib.utility.HTMLEscape(`age:"${TimeAgo(post.created)}"`);
        title.push(`post #${post.id} - user:${post.uploadername} score:${post.score} favcount:${post.favcount} rating:${post.rating} ${age}`);
    });
    return title.join('\n');
}

function CheckSimilarResults(results,tweet_id,type) {
    let data_key = type + '-' + tweet_id;
    if (results === null) {
        return false;
    }
    if (!ValidateEntry(data_key, results) && JSPLib.storage.hasDataExpired(data_key, results, SIMILAR_EXPIRES)) {
        JSPLib.storage.removeData(data_key);
        return false;
    }
    return results.value;
}

function GetCustomQuery() {
    return (NTISAS.user_settings.custom_order_enabled && (NTISAS.user_data.level >= GOLD_LEVEL) ? '+order%3Acustom' : '');
}

function GetPostVersionsLastID(type) {
    //Get the program last ID if it exists
    let postver_lastid = JSPLib.storage.checkStorageData(`ntisas-${type}-lastid`, ValidateProgramData, localStorage, NTISAS.database_info && NTISAS.database_info.post_version);
    if (NTISAS.user_settings.bypass_server_mode && !NTISAS.database_info) {
        return postver_lastid;
    }
    //Select the largest of the program lastid and the database lastid
    let max_postver_lastid = Math.max(postver_lastid, NTISAS.database_info.post_version);
    if (postver_lastid !== max_postver_lastid) {
        JSPLib.storage.setStorageData(`ntisas-${type}-lastid`, max_postver_lastid, localStorage);
    }
    return max_postver_lastid;
}

async function GetTotalRecords(manual=false) {
    if (manual || JSPLib.concurrency.checkTimeout('ntisas-length-recheck', LENGTH_RECHECK_EXPIRES)) {
        let database_length = await JSPLib.storage.twitterstorage.length();
        JSPLib.storage.setStorageData('ntisas-database-length', database_length, localStorage);
        JSPLib.concurrency.setRecheckTimeout('ntisas-length-recheck', LENGTH_RECHECK_EXPIRES);
    }
    return JSPLib.storage.getStorageData('ntisas-database-length', localStorage, 0);
}

function GetImageAttributes(image_url) {
    GetImageAttributes.image_data = GetImageAttributes.image_data || {};
    return new Promise((resolve)=>{
        if (image_url in GetImageAttributes.image_data) {
            resolve(GetImageAttributes.image_data[image_url]);
        }
        let size_promise = JSPLib.network.getImageSize(image_url);
        let dimensions_promise = JSPLib.utility.getImageDimensions(image_url);
        Promise.all([size_promise, dimensions_promise]).then(([size,dimensions])=>{
            GetImageAttributes.image_data[image_url] = Object.assign(dimensions, {size: size});
            resolve(GetImageAttributes.image_data[image_url]);
        });
    });
}

function ReadableBytes(bytes) {
    var i = Math.floor(Math.log(bytes) / Math.log(1024)),
    sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    return JSPLib.utility.setPrecision((bytes / Math.pow(1024, i)), 2) + ' ' + sizes[i];
}

function GetFileExtension(url,splitter) {
    let parser = new URL(url);
    let pathname = parser.pathname.split(splitter)[0];
    let extpos = pathname.lastIndexOf('.');
    return pathname.slice(extpos + 1);
}

function GetThumbUrl(url,splitter,ext) {
    let parser = new URL(url);
    let pathname = parser.pathname.split(splitter)[0];
    let extpos = pathname.lastIndexOf('.');
    return parser.origin + pathname.slice(0, extpos + 1) + ext;
}

function GetFileURLNameExt(file_url) {
    let path_index = file_url.lastIndexOf('/');
    let file_ident = file_url.slice(path_index + 1);
    let [file_name,extension] = file_ident.split('.');
    extension = extension.split(/\W+/)[0];
    return [file_name, extension];
}

function GetNormalImageURL(image_url) {
    let extension = JSPLib.utility.setIntersection(image_url.split(/\W+/), ['jpg', 'png', 'gif']);
    for (let i = 0; i < HANDLED_IMAGES.length; i++) {
        let match = image_url.match(HANDLED_IMAGES[i].regex);
        if (match && extension.length !== 0) {
            return JSPLib.utility.sprintf(HANDLED_IMAGES[i].format, ...HANDLED_IMAGES[i].arguments(match, extension));
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

function GetNomatchHelp(no_url_results,no_iqdb_results,no_sauce_results) {
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

function RemoveDuplicates(obj_array,attribute){
    const attribute_index = JSPLib.utility.getObjectAttributes(obj_array, attribute);
    return obj_array.filter((obj,index)=>{
        return attribute_index.indexOf(obj[attribute]) === index;
    });
}

function LogarithmicExpiration(count, max_count, time_divisor, multiplier) {
    let time_exponent = Math.pow(10, (1 / time_divisor));
    return Math.round(Math.log10(time_exponent + (10 - time_exponent) * (count / max_count)) * multiplier);
}

//Auxiliary functions

function GetList(name) {
    GetList[name] = GetList[name] || {};
    if (!GetList[name].list) {
        GetList[name].list = JSPLib.storage.getStorageData('ntisas-' + name, localStorage, []);
        GetList[name].list = CorrectStringArray(name, GetList[name].list);
    }
    return GetList[name].list;
}

function SaveList(name,list,delay=true) {
    GetList[name].list = list;
    if (delay) {
        setTimeout(()=>{
            JSPLib.storage.setStorageData('ntisas-' + name, list, localStorage);
        }, STORAGE_DELAY);
    } else {
        JSPLib.storage.setStorageData('ntisas-' + name, list, localStorage);
    }
}

function SavePosts(mapped_posts) {
    mapped_posts.forEach((mapped_post)=>{
        let expires_duration = PostExpiration(mapped_post.created);
        let data_expires = JSPLib.utility.getExpires(expires_duration);
        SaveData('post-' + mapped_post.id, {value: mapped_post, expires: data_expires}, 'danbooru');
    });
}

function SaveUsers(mapped_users) {
    mapped_users.forEach((mapped_user)=>{
        let data_expires = JSPLib.utility.getExpires(USER_EXPIRES);
        SaveData('user-' + mapped_user.id, {value: mapped_user, expires: data_expires}, 'danbooru');
    });
}

function SavePostUsers(mapped_posts) {
    let all_users = mapped_posts.map((post)=>({id: post.uploaderid, name: post.uploadername}));
    let unique_users = RemoveDuplicates(all_users, 'id');
    SaveUsers(unique_users);
}

function PostExpiration(created_timestamp) {
    let created_interval = Date.now() - created_timestamp;
    if (created_interval < JSPLib.utility.one_day) {
        return MIN_POST_EXPIRES;
    } else if (created_interval < JSPLib.utility.one_month) {
        let day_interval = (created_interval / JSPLib.utility.one_day) - 1; //Start at 0 days and go to 29 days
        let day_slots = 29; //There are 29 day slots between 1 day and 30 days
        let days_month = 30;
        return LogarithmicExpiration(day_interval, day_slots, days_month, MAX_POST_EXPIRES);
    } else {
        return MAX_POST_EXPIRES;
    }
}

function SetCheckPostvers() {
    if (JSPLib.concurrency.checkTimeout('ntisas-timeout', GetPostVersionsExpiration()) || WasOverflow()) {
        clearTimeout(CheckPostvers.timeout);
        CheckPostvers.timeout = setTimeout(()=>{
            if ((NTISAS.database_info || NTISAS.user_settings.bypass_server_mode) && JSPLib.concurrency.reserveSemaphore(PROGRAM_SHORTCUT, 'postvers')) {
                TIMER.CheckPostvers();
            }
        }, POST_VERSIONS_CALLBACK);
    }
}

async function AddViewCount(tweet_id) {
    if (!NTISAS.recorded_views.includes(tweet_id)) {
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
    var sortedfaves = subarray.sort((a,b)=>{return a - b;});
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

function GetImageLinks(tweet) {
    let $obj = $('[data-image-url]', tweet);
    return JSPLib.utility.getDOMAttributes($obj, 'image-url');
}

function GetTweetStat(tweet,types) {
    for (let i = 0; i < types.length; i++) {
        let label = $(`[data-testid=${types[i]}]`, tweet).attr('aria-label');
        let match = label && label.match(/\d+/);
        if (match) {
            return parseInt(match[0]);
        }
    }
    return 0;
}

function SetVideoDownload($download_section,video_url) {
    let [video_name,extension] = GetFileURLNameExt(video_url);
    let download_filename = JSPLib.utility.regexReplace(NTISAS.filename_prefix, {
        ORDER: 'video1',
        IMG: video_name
    }) + '.' + extension;
    $('.ntisas-download-video', $download_section[0])
        .attr('href', video_url)
        .attr('download', download_filename)
        .show();
}

function UpdatePostIDsLink(tweet_id, post_ids) {
    let $tweet = $(`[data-tweet-id=${tweet_id}]`);
    if ($tweet.length === 0) {
        return;
    }
    let $link_container = $('.ntisas-link-menu', $tweet[0]);
    let $link = $('.ntisas-database-match, .ntisas-confirm-save', $tweet[0]);
    if ($link.length && NTISAS.user_settings.advanced_tooltips_enabled) {
        $link.qtiptisas('destroy', true);
    }
    if (post_ids.length === 0) {
        InitializeNoMatchesLinks(tweet_id, $link_container);
    } else {
        InitializePostIDsLink(tweet_id, $link_container, $tweet[0], post_ids);
    }
}

function PromptSavePostIDs($link,$tweet,tweet_id,$replace,message,initial_post_ids) {
    let prompt_string = prompt(message, initial_post_ids.join(', '));
    if (prompt_string !== null) {
        let confirm_post_ids = JSPLib.utility.setUnique(
            prompt_string.split(',')
            .map(Number)
            .filter((num)=>{
                return JSPLib.validate.validateID(num);
            })
        );
        PromptSavePostIDs.debuglog("Confirmed IDs:", confirm_post_ids);
        if (confirm_post_ids.length === 0) {
            RemoveData('tweet-' + tweet_id, 'twitter');
        } else {
            SaveData('tweet-' + tweet_id, confirm_post_ids, 'twitter');
        }
        UpdatePostIDsLink(tweet_id, confirm_post_ids);
        NTISAS.channel.postMessage({type: 'postlink', tweet_id: tweet_id, post_ids: confirm_post_ids});
    }
}

function GetSelectPostIDs(tweet_id,type) {
    if (!NTISAS[type][tweet_id]) {
        return [];
    }
    let $select_previews = $('.ntisas-post-select', NTISAS[type][tweet_id][0]);
    return JSPLib.utility.getDOMAttributes($select_previews, 'id', Number);
}

function SetThumbnailWait(container,all_posts) {
    all_posts.forEach(async (post)=>{
        let blob = await JSPLib.network.getImage(post.thumbnail);
        let image_blob = blob.slice(0, blob.size, 'image/jpeg');
        let blob_url = window.URL.createObjectURL(image_blob);
        $(`[data-id=${post.id}] img`, container).attr('src', blob_url);
    });
}

//Checks and removes a value from a hash key if it exists
function RemoveHashKeyValue(hash,key,value) {
    if ((key in hash) && hash[key].includes(value)) {
        hash[key] = JSPLib.utility.setDifference(hash[key], [value]);
        if (hash[key].length === 0) {
            delete hash[key];
        }
        return true;
    }
    return false;
}

function ProcessPostvers(postvers) {
    postvers.sort((a,b)=>{return a.id - b.id;});
    var account_swaps = 0;
    var inactive_posts = 0;
    var reversed_posts = 0;
    var add_entries = {};
    var rem_entries = {};
    postvers.forEach((postver)=>{
        if (postver.source_changed) {
            if (postver.version === 1) {
                let tweet_id = JSPLib.utility.findAll(postver.source, TWEET_REGEX)[1];
                if (tweet_id) {
                    add_entries[tweet_id] = add_entries[tweet_id] || [];
                    add_entries[tweet_id] = JSPLib.utility.setUnion(add_entries[tweet_id], [postver.post_id]);
                }
            } else {
                let tweet_id = {};
                let twitter_add = postver.added_tags.find((tag)=>{return SOURCE_TWITTER_REGEX.test(tag);}) || "";
                tweet_id.add = JSPLib.utility.findAll(twitter_add, SOURCE_TWITTER_REGEX)[1];
                let twitter_rem = postver.removed_tags.find((tag)=>{return SOURCE_TWITTER_REGEX.test(tag);}) || "";
                tweet_id.rem = JSPLib.utility.findAll(twitter_rem, SOURCE_TWITTER_REGEX)[1];
                if (tweet_id.add && tweet_id.rem) {
                    if (tweet_id.add === tweet_id.rem) {
                        tweet_id.add = tweet_id.rem = undefined;
                        account_swaps++;
                    } else {
                        ProcessPostvers.debuglog("ID swap detected", tweet_id.rem, "->", tweet_id.add);
                    }
                }
                if (tweet_id.add) {
                    add_entries[tweet_id.add] = add_entries[tweet_id.add] || [];
                    add_entries[tweet_id.add] = JSPLib.utility.setUnion(add_entries[tweet_id.add], [postver.post_id]);
                    if (RemoveHashKeyValue(rem_entries, tweet_id.add[0], postver.post_id)) {
                        ProcessPostvers.debuglog("Source delete reversal detected", tweet_id.add);
                    }
                }
                if (tweet_id.rem) {
                    rem_entries[tweet_id.rem] = rem_entries[tweet_id.rem] || [];
                    JSPLib.utility.setUnion(rem_entries[tweet_id.rem], [postver.post_id]);
                    if (RemoveHashKeyValue(add_entries, tweet_id.rem, postver.post_id)) {
                        ProcessPostvers.debuglog("Source add reversal detected", tweet_id.rem);
                    }
                }
            }
        }
        if (postver.added_tags.includes('bad_twitter_id') || postver.removed_tags.includes('bad_twitter_id')) {
            let tweet_id = JSPLib.utility.findAll(postver.source, TWEET_REGEX)[1];
            if (tweet_id) {
                if (postver.removed_tags.includes('bad_twitter_id')) {
                    ProcessPostvers.debuglog("Activated tweet:", tweet_id);
                    add_entries[tweet_id] = add_entries[tweet_id] || [];
                    add_entries[tweet_id] = JSPLib.utility.setUnion(add_entries[tweet_id], [postver.post_id]);
                    reversed_posts++;
                    if (RemoveHashKeyValue(rem_entries, tweet_id, postver.post_id)) {
                        ProcessPostvers.debuglog("Tweet remove reversal detected", tweet_id);
                    }
                } else if (postver.added_tags.includes('bad_twitter_id')) {
                    rem_entries[tweet_id] = rem_entries[tweet_id] || [];
                    rem_entries[tweet_id] = JSPLib.utility.setUnion(rem_entries[tweet_id], [postver.post_id]);
                    inactive_posts++;
                    if (RemoveHashKeyValue(add_entries, tweet_id, postver.post_id)) {
                        ProcessPostvers.debuglog("Tweet add reversal detected", tweet_id);
                    }
                }
            }
        }
    });
    if (account_swaps > 0) {
        ProcessPostvers.debuglog("Account swaps detected:", account_swaps);
    }
    if (inactive_posts > 0) {
        ProcessPostvers.debuglog("Inactive tweets detected:", inactive_posts);
    }
    if (reversed_posts > 0) {
        ProcessPostvers.debuglog("Activated tweets detected:", reversed_posts);
    }
    return [add_entries, rem_entries];
}

function GetPageType() {
    NTISAS.page_match = XRegExp.exec(window.location.href.split('#')[0], PageRegex());
    if (!NTISAS.page_match) {
        return 'other';
    }
    switch (NTISAS.page_match.site) {
        case NTISAS.page_match.main:
            return 'main';
        case NTISAS.page_match.media:
            return 'media';
        case NTISAS.page_match.search:
            return 'search';
        case NTISAS.page_match.tweet:
            return 'tweet';
        case NTISAS.page_match.web_tweet:
            return 'web_tweet';
        case NTISAS.page_match.hashtag:
            return 'hashtag';
        case NTISAS.page_match.list:
            return 'list';
        case NTISAS.page_match.home:
            return 'home';
        case NTISAS.page_match.likes:
            return 'likes';
        case NTISAS.page_match.replies:
            return 'replies';
        case NTISAS.page_match.photo:
            return 'photo';
        case NTISAS.page_match.moment:
            return 'moment';
        case NTISAS.page_match.display:
            return 'display';
        default:
            GetPageType.debuglog("Regex error:", window.location.href, NTISAS.page_match);
            return 'default';
    }
}

function UpdateHighlightControls() {
    if (!NTISAS.user_settings.score_highlights_enabled) {
        return;
    }
    let [user_ident,all_idents] = GetUserIdent();
    if (user_ident && IsMediaTimeline()) {
        let no_highlight_list = GetList('no-highlight-list');
        if (JSPLib.utility.hasIntersection(no_highlight_list, all_idents)) {
            NTISAS.artist_highlights_enabled = false;
            DisplayControl('enable', HIGHLIGHT_CONTROLS, 'highlights');
            $('#ntisas-fade-level-display').hide();
            $('#ntisas-hide-level-display').hide();
        } else {
            NTISAS.artist_highlights_enabled = true;
            DisplayControl('disable', HIGHLIGHT_CONTROLS, 'highlights');
            $('#ntisas-fade-level-display').show();
            $('#ntisas-hide-level-display').show();
        }
    } else {
        NTISAS.artist_highlights_enabled = false;
        DisplayControl('unavailable', HIGHLIGHT_CONTROLS, 'highlights');
        $('#ntisas-fade-level-display').hide();
        $('#ntisas-hide-level-display').hide();
    }
}

function UpdateArtistHighlights() {
    if (!NTISAS.artist_highlights_enabled) {
        $('.ntisas-fade').removeClass('ntisas-fade');
        $('.ntisas-hide').removeClass('ntisas-hide');
        return;
    }
    let [user_ident,all_idents] = GetUserIdent();
    if (user_ident) {
        let no_highlight_list = GetList('no-highlight-list');
        let fade_levels = SCORE_LEVELS.slice(NTISAS.fade_level);
        let fade_selectors = JSPLib.utility.joinList(fade_levels, '.ntisas-', null, ',');
        let hide_levels = SCORE_LEVELS.slice(NTISAS.hide_level);
        let hide_selectors = JSPLib.utility.joinList(hide_levels, '.ntisas-', null, ',');
        $('.ntisas-fade').removeClass('ntisas-fade');
        $('.ntisas-hide').removeClass('ntisas-hide');
        if (!JSPLib.utility.hasIntersection(no_highlight_list, all_idents)) {
            $(fade_selectors).addClass('ntisas-fade');
            $(hide_selectors).addClass('ntisas-hide');
        }
    }
}

function UpdateViewControls() {
    let switch_type = (NTISAS.view_highlights ? 'disable' : 'enable');
    DisplayControl(switch_type, VIEW_CONTROLS, 'views');
}

function UpdateIQDBControls() {
    if (!NTISAS.user_settings.autoclick_IQDB_enabled) {
        return;
    }
    let [user_ident,all_idents] = GetUserIdent();
    if (user_ident && IsMediaTimeline()) {
        let auto_iqdb_list = GetList('auto-iqdb-list');
        if (JSPLib.utility.hasIntersection(auto_iqdb_list, all_idents)) {
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

function DisplayControl(control,all_controls,type) {
    let all_selectors = JSPLib.utility.joinList(all_controls, '#ntisas-', '-' + type, ',');
    $(all_selectors).hide();
    setTimeout(()=>{$(`#ntisas-${control}-${type}`).show();}, JQUERY_DELAY);
}

function UpdateIndicatorControls() {
    if (!NTISAS.user_settings.tweet_indicators_enabled) {
        return;
    }
    let indicators_enabled = JSPLib.storage.getStorageData('ntisas-indicator-controls', localStorage, true);
    if (indicators_enabled) {
        DisplayControl('disable', INDICATOR_CONTROLS, 'indicators');
        $('.ntisas-footer-entries').show();
        $('#ntisas-indicator-counter').show();
    } else {
        DisplayControl('enable', INDICATOR_CONTROLS, 'indicators');
        $('.ntisas-footer-entries').hide();
        $('#ntisas-indicator-counter').hide();
    }
}

function UpdateTweetIndicators() {
    if (!NTISAS.user_settings.tweet_indicators_enabled) {
        return;
    }
    let artist_list = GetList('artist-list');
    let tweet_list = GetList('tweet-list');
    $('.ntisas-tweet').each((i,entry)=>{
        let $tweet = $(entry);
        let [tweet_id,,,user_ident,all_idents] = GetTweetInfo($tweet);
        let active_indicators = [];
        if (JSPLib.utility.hasIntersection(artist_list, all_idents)) {
            active_indicators.push('mark-artist');
        }
        if (tweet_list.includes(tweet_id)) {
            active_indicators.push('mark-tweet');
        }
        if (NTISAS.counted_artists.includes(user_ident)) {
            active_indicators.push('count-artist');
        }
        if (NTISAS.counted_tweets.includes(tweet_id)) {
            active_indicators.push('count-tweet');
        }
        let shown_indicators = false;
        ALL_INDICATOR_TYPES.forEach((type)=>{
            if (active_indicators.includes(type)) {
                $(`.ntisas-indicators .ntisas-${type}`, entry).show();
                $(`.ntisas-footer-entries .ntisas-${type}`, entry).addClass('ntisas-activated');
                shown_indicators = true;
            } else {
                $(`.ntisas-indicators .ntisas-${type}`, entry).hide();
                $(`.ntisas-footer-entries .ntisas-${type}`, entry).removeClass('ntisas-activated');
            }
        });
        if (shown_indicators) {
            $('.ntisas-stream-tweet .ntisas-tweet-status', entry).css('min-height', '1.5em');
        } else {
            $('.ntisas-stream-tweet .ntisas-tweet-status', entry).css('min-height', '');
        }
    });
    let indicators_enabled = JSPLib.storage.getStorageData('ntisas-indicator-controls', localStorage, true);
    if (indicators_enabled) {
        $('.ntisas-footer-entries').show();
    } else {
        $('.ntisas-footer-entries').hide();
    }
}

async function GetAllCurrentRecords() {
    GetAllCurrentRecords.is_running = true;
    let i = 0;
    while (true) {
        if (!WasOverflow() || !NTISAS.database_info) {
            //Main exit condition
            break;
        }
        clearTimeout(CheckPostvers.timeout);
        if (JSPLib.concurrency.reserveSemaphore(PROGRAM_SHORTCUT, 'postvers')) {
            Danbooru.Utility.notice(`Querying Danbooru...[${i}]`, false);
            await TIMER.CheckPostvers();
        } else {
            Danbooru.Utility.notice(`Waiting on other tasks to finish...[${i}]`, false);
            await JSPLib.utility.sleep(POST_VERSIONS_CALLBACK);
        }
        i++;
    }
    JSPLib.concurrency.freeSemaphore(PROGRAM_SHORTCUT, 'records')
    GetAllCurrentRecords.is_running = false;
}
GetAllCurrentRecords.is_running = false;

async function PickImage(event,type,pick_func) {
    let similar_class = 'ntisas-check-' + type;
    let [$link,$tweet,tweet_id,,,,,$replace] = GetEventPreload(event, similar_class);
    let all_image_urls = GetImageLinks($tweet[0]);
    if (all_image_urls.length === 0) {
        PickImage.debuglog("Images not loaded yet...");
        return false;
    }
    PickImage.debuglog("All:", all_image_urls);
    if ((all_image_urls.length > 1) && IsQuerySettingEnabled('pick_image', type) && (typeof pick_func !== 'function' || pick_func())) {
        if (!NTISAS.tweet_dialog[tweet_id]) {
            NTISAS.tweet_dialog[tweet_id] = InitializeConfirmContainer(all_image_urls);
        }
        NTISAS.tweet_dialog[tweet_id].dialog('open');
        let status = await NTISAS.tweet_dialog[tweet_id].prop('promiseConfirm');
        if (!status) {
            PickImage.debuglog("Exiting...");
            return false;
        }
        let selected_indexes = GetSelectPostIDs(tweet_id, 'tweet_dialog');
        var selected_image_urls = all_image_urls.filter((image,index)=>{return selected_indexes.includes(index);});
    } else {
        selected_image_urls = all_image_urls;
    }
    PickImage.debuglog("Selected:", selected_image_urls);
    $link.removeClass(similar_class).html("loading…");
    return [$link,$tweet,tweet_id,$replace,selected_image_urls];
}

function ProcessSimilarData(type,tweet_id,$tweet,$replace,selected_image_urls,similar_data,autosave_func) {
    let flat_data = similar_data.flat();
    if (flat_data.length > 0) {
        let max_score = Math.max(...JSPLib.utility.getObjectAttributes(flat_data, 'score'));
        let classname = 'ntisas-similar-match-poor';
        if (max_score > 95.0) {
            classname = 'ntisas-similar-match-great';
        } else if (max_score > 90.0) {
            classname = 'ntisas-similar-match-good';
        } else if (max_score > 85.0) {
            classname = 'ntisas-similar-match-fair';
        }
        let similar_post_ids = JSPLib.utility.setUnique(JSPLib.utility.getNestedObjectAttributes(flat_data, ['post', 'id']));
        if (IsQuerySettingEnabled('auto_save', type) || ((typeof autosave_func === 'function') && autosave_func())) {
            if (NTISAS.merge_results.includes(tweet_id)) {
                let merge_ids = JSPLib.storage.getStorageData('tweet-' + tweet_id, sessionStorage, []);
                similar_post_ids = JSPLib.utility.setUnion(merge_ids, similar_post_ids);
            }
            SaveData('tweet-' + tweet_id, similar_post_ids, 'twitter');
            InitializePostIDsLink(tweet_id, $replace, $tweet[0], similar_post_ids)
            NTISAS.channel.postMessage({type: 'postlink', tweet_id: tweet_id, post_ids: similar_post_ids});
        } else {
            $replace.html(RenderSimilarIDsLink(similar_post_ids, flat_data, classname, type));
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
    let all_idents = JSPLib.utility.setUnique([user_ident, screen_name]);
    return [tweet_id, user_id, screen_name, user_ident, all_idents];
}

function GetEventPreload(event,classname) {
    let $link = $(event.target);
    let $tweet = $link.closest('.ntisas-tweet');
    let [tweet_id,user_id,screen_name,user_ident,all_idents] = GetTweetInfo($tweet);
    let $replace = $(`[data-tweet-id=${tweet_id}] .${classname}`).parent();
    return [$link, $tweet, tweet_id, user_id, screen_name, user_ident, all_idents, $replace];
}

function IsPageType(types) {
    return types.includes(NTISAS.page) || (NTISAS.page === 'display' && types.includes(NTISAS.prev_page));
}

function IsTweetPage() {
    return IsPageType(['tweet','web_tweet']);
}

function IsMediaTimeline() {
    return (NTISAS.page === 'media') || (NTISAS.page === 'search' && NTISAS.account && MEDIA_TYPES.includes(NTISAS.queries.filter));
}

function IsIQDBAutoclick() {
    return NTISAS.user_settings.autoclick_IQDB_enabled && ((NTISAS.artist_iqdb_enabled && IsMediaTimeline()) || IsTweetPage());
}

//File functions

function ReadFileAsync(fileselector,is_json) {
    return new Promise((resolve,reject)=>{
        let files = $(fileselector).prop('files');
        if (!files.length) {
            alert('Please select a file!');
            reject();
            return;
        }
        var file = files[0];
        var reader = new FileReader();
        reader.onloadend = function(event) {
            if (event.target.readyState == FileReader.DONE) {
                ReadFileAsync.debuglog("File loaded:", file.size);
                let data = event.target.result;
                if (is_json) {
                    try {
                        data = JSON.parse(data);
                    } catch (e) {
                        Danbooru.Utility.error("Error: File is not JSON!");
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
    let current_message = (!JSPLib.storage.checkStorageData('ntisas-recent-timestamp', ValidateProgramData, localStorage) ? MUST_INSTALL_HELP : UPDATE_RECORDS_HELP);
    let fade_level = JSPLib.utility.displayCase(NTISAS.user_settings.score_levels_faded[0]);
    let hide_level = JSPLib.utility.displayCase(NTISAS.user_settings.score_levels_hidden[0]);
    let current_fade_html = JSPLib.utility.sprintf(FADE_HIGHLIGHT_HTML, fade_level);
    let current_hide_html = JSPLib.utility.sprintf(HIDE_HIGHLIGHT_HTML, hide_level);
    return JSPLib.utility.regexReplace(SIDE_MENU, {
        CURRENTRECORDS: RenderCurrentRecords(),
        CURRENTHELP: RenderHelp(current_message),
        RECORDSHELP: RenderHelp(REFRESH_RECORDS_HELP),
        HIGHLIGHTS: HIGHLIGHT_HTML,
        HIGHLIGHTSHELP: RenderHelp(HIGHLIGHTS_HELP),
        CURRENTFADE: current_fade_html,
        CURRENTFADEHELP: RenderHelp(FADE_HIGHLIGHT_HELP),
        CURRENTHIDE: current_hide_html,
        CURRENTHIDEHELP: RenderHelp(HIDE_HIGHLIGHT_HELP),
        VIEWS: VIEWS_HTML,
        VIEWSHELP: RenderHelp(VIEWS_HELP),
        AUTOCLICKIQDB: AUTO_IQDB_HTML,
        AUTOCLICKIQDBHELP: RenderHelp(AUTO_IQDB_HELP),
        INDICATOR: INDICATOR_HTML,
        INDICATORHELP: RenderHelp(INDICATOR_HELP),
        LOCKPAGE: LOCKPAGE_HTML,
        LOCKPAGEHELP: RenderHelp(LOCKPAGE_HELP),
        ERRORMESSAGES: JSPLib.network.error_messages.length,
        ERRORMESSAGESHELP: RenderHelp(ERROR_MESSAGES_HELP),
        SETTINGSHELP:  SETTINGS_HELP,
        STATISTICSHELP: RenderHelp(STATISTICS_HELP),
    });
}

function RenderCurrentRecords() {
    var record_html = "";
    let timestamp = JSPLib.storage.checkStorageData('ntisas-recent-timestamp', ValidateProgramData, localStorage);
    if (timestamp) {
        let timestring = new Date(timestamp).toLocaleString();
        let timeagostring = ((Date.now() - timestamp) < GetPostVersionsExpiration() * 2 ? "Up to date" : TimeAgo(timestamp));
        record_html = `<a id="ntisas-current-records" class="ntisas-expanded-link" title="${timestring}">${timeagostring}</a>`
    } else {
        record_html = '<span id="ntisas-current-records">Loading...</span>';
    }
    return record_html;
}

function RenderDatabaseVersion() {
    let timestring = new Date(NTISAS.server_info.timestamp).toLocaleString();
    let url = `${NTISAS.domain}/post_versions?page=b${NTISAS.server_info.post_version+1}`;
    return `<a id="ntisas-database-version" class="ntisas-expanded-link" href="${url}" title="${timestring}">${NTISAS.server_info.post_version}</a>`;
}

function RenderDownloadLinks($tweet,position,is_video) {
    let [tweet_id,user_id,screen_name,,] = GetTweetInfo($tweet);
    let date_string = GetDateString(Date.now());
    let time_string = GetTimeString(Date.now());
    NTISAS.filename_prefix = JSPLib.utility.regexReplace(NTISAS.user_settings.filename_prefix_format, {
        TWEETID: tweet_id,
        USERID: user_id,
        USERACCOUNT: screen_name,
        DATE: date_string,
        TIME: time_string
    });
    var image_links = GetImageLinks($tweet[0]);
    var hrefs = image_links.map((image)=>{return image + ':orig'});
    let html = '<span class="ntisas-download-header">Download Originals</span><br>';
    for (let i = 0; i < image_links.length; i++) {
        let [image_name,extension] = GetFileURLNameExt(image_links[i]);
        let download_filename = JSPLib.utility.regexReplace(NTISAS.filename_prefix, {
            ORDER: 'img' + String(i + 1),
            IMG: image_name
        }) + '.' + extension;
        html += `<a class="ntisas-download-original ntisas-download-image ntisas-expanded-link" href="${hrefs[i]}" download="${download_filename}">Image #${i + 1}</a>`;
    }
    if (is_video) {
        html += '<a class="ntisas-download-original ntisas-download-video ntisas-expanded-link" style="display:none">Video #1</a>';
    }
    if (image_links.length > 1) {
        html += '<a class="ntisas-download-all ntisas-expanded-link" href="javascript:void(0)">All images</a>';
    }
    if (position === 'above') {
        html = HORIZONTAL_RULE + html;
    } else if (position === 'below') {
        html += HORIZONTAL_RULE;
    }
    return `
<div class="ntisas-download-section ntisas-links">
    ${html}
</div>`;
}

function RenderPostIDsLink(posts,classname) {
    let mergelink = "";
    let helpinfo = CONFIRM_DELETE_HELP;
    if (NTISAS.user_settings.merge_results_enabled) {
        mergelink = ' | <a class="ntisas-merge-results ntisas-expanded-link">Merge</a>';
        helpinfo += '\n' + MERGE_RESULTS_HELP;
    }
    let helplink = RenderHelp(helpinfo);
    let post_ids = JSPLib.utility.getObjectAttributes(posts, 'id');
    if (posts.length === 1) {
        let title = GetLinkTitle(posts[0]);
        return `( <a class="ntisas-confirm-delete ${classname} ntisas-expanded-link" target="_blank" title="${title}" href="${NTISAS.domain}/posts/${post_ids[0]}">post #${post_ids[0]}</a>${mergelink} | ${helplink} )`
    } else {
        let title = GetMultiLinkTitle(posts);
        return `( <a class="ntisas-confirm-delete ${classname} ntisas-expanded-link" target="_blank" title="${title}" href="${NTISAS.domain}/posts?tags=status%3Aany+id%3A${post_ids.join(',')}${GetCustomQuery()}">${post_ids.length} sources</a>${mergelink} | ${helplink} ) `;
    }
}

function RenderSimilarIDsLink(post_ids,similar_data,classname,type) {
    let helplink = RenderHelp(CONFIRM_IQDB_HELP);
    if (similar_data.length === 1) {
        let url = `${NTISAS.domain}/posts/${post_ids[0]}`;
        let title = GetLinkTitle(similar_data[0].post);
        return `( <a class="ntisas-confirm-save ${classname} ntisas-expanded-link" data-type=${type} target="_blank" href="${url}" title="${title}">post #${post_ids[0]}</a> | ${helplink} )`
    } else {
        let all_posts = JSPLib.utility.getObjectAttributes(similar_data, 'post');
        let unique_posts = RemoveDuplicates(all_posts, 'id');
        let url = `${NTISAS.domain}/posts?` + $.param({tags: "status:any id:" + post_ids.join(',')}) + GetCustomQuery();
        let title = GetMultiLinkTitle(unique_posts);
        return `( <a class="ntisas-confirm-save ${classname} ntisas-expanded-link" data-type=${type} target="_blank" href="${url}"  title="${title}">${post_ids.length} sources</a> | ${helplink} )`;
    }
}

function RenderAllSimilar(all_iqdb_results,image_urls,type) {
    var image_results = [];
    var max_results = 0;
    all_iqdb_results.forEach((iqdb_results,i)=>{
        if (iqdb_results.length === 0) {
            return;
        }
        max_results = Math.max(max_results, iqdb_results.length);
        let html = RenderSimilarContainer("Image " + (i + 1), iqdb_results, image_urls[i], i);
        image_results.push(html);
    });
    let render_width = Math.min(((max_results + 1) * BASE_PREVIEW_WIDTH) + BASE_QTIP_WIDTH, 850);
    return `
<div class="ntisas-similar-results ntisas-qtip-container" data-type="${type}" style="width:${render_width}px">
    ${image_results.join(HORIZONTAL_RULE)}
</div>`;
}

function RenderSimilarContainer(header,iqdb_results,image_url,index) {
    var html = RenderTwimgPreview(image_url, index);
    iqdb_results.forEach((iqdb_result,i)=>{
        let is_user_upload = iqdb_result.post.uploaderid === NTISAS.user_data.id;
        let addons = RenderPreviewAddons(iqdb_result.post.source, null, iqdb_result.score, iqdb_result.post.ext, iqdb_result.post.size, iqdb_result.post.width, iqdb_result.post.height, is_user_upload);
        html += RenderPostPreview(iqdb_result.post, addons)
    });
    return `
<div class="ntisas-similar-result">
    <h4>${header} (${RenderHelp(IQDB_SELECT_HELP)})</h4>
    ${html}
</div>`;
}

function RenderConfirmContainer(image_urls) {
    let html = "";
    image_urls.forEach((image,i)=>{
        html += RenderTwimgPreview(image, i, true);
    });
    return `
<div class="ntisas-confirm-image">
    <p style="font-size:12px">Selected images will be used for the query. Press <b>Submit</b> to execute query, or <b>Cancel</b> to go back.</p>
    ${html}
</div>`;
}

function RenderPostsContainer(all_posts) {
    let html = "";
    all_posts.forEach((post,i)=>{
        let is_user_upload = post.uploaderid === NTISAS.user_data.id;
        let addons = RenderPreviewAddons(post.source, post.id, null, post.ext, post.size, post.width, post.height, is_user_upload);
        html += RenderPostPreview(post, addons)
    });
    let delete_all_checked = (NTISAS.user_settings.delete_all_default ? "checked" : "");
    let width_addon = (all_posts.length > 10 ? 'style="width:900px"' : "");
    return `
<div class="ntisas-post-result ntisas-qtip-container" ${width_addon}>
    <h4>Danbooru matches (${RenderHelp(POST_SELECT_HELP)})</h4>
    <div class="ntisas-delete-label">Delete all</div>
    <input ${delete_all_checked} type="checkbox" class="ntisas-delete-all">
    <div style="clear:left"></div>
    ${html}
</div>`;
}

//Expects a mapped post as input
function RenderPostPreview(post,append_html="") {
    let [width,height] = JSPLib.utility.getPreviewDimensions(post.width, post.height, POST_PREVIEW_DIMENSION);
    let padding_height = POST_PREVIEW_DIMENSION - height;
    return `
<article class="ntisas-post-preview" data-id="${post.id}" data-size="${post.size}">
    <div class="ntisas-image-container">
        <a target="_blank" href="https://danbooru.donmai.us/posts/${post.id}">
            <img width="${width}" height="${height}" style="padding-top:${padding_height}px" title="${GetLinkTitle(post)}">
        </a>
    </div>
    ${append_html}
</article>`;
}

function RenderTwimgPreview(image_url,index,selectable) {
    let domain = 'twitter.com';
    let file_type = GetFileExtension(image_url, ':');
    let thumb_url = GetThumbUrl(image_url, ':', 'jpg') + ':small';
    let image_html = `<img width="${POST_PREVIEW_DIMENSION}" height="${POST_PREVIEW_DIMENSION}" src="${thumb_url}">`;
    let selected_class = "";
    if (selectable) {
        image_html = `<a>${image_html}</a>`;
        selected_class = 'ntisas-post-select';
    }
    let append_html = RenderPreviewAddons('https://twitter.com', null, null, file_type);
    return `
<article class="ntisas-post-preview ${selected_class}" data-id="${index}">
    <div class="ntisas-image-container">
        ${image_html}
    </div>
    ${append_html}
</article>`;
}

function RenderPreviewAddons(source,id,score,file_ext,file_size,width,height,is_user_upload=false) {
    let title_text = "Original image";
    if (JSPLib.validate.validateID(id)) {
        title_text = "post #" + id;
    } else if (JSPLib.validate.isNumber(score)) {
        title_text = `Similarity: ${JSPLib.utility.setPrecision(score, 2)}`
    }
    let uploader_addon = (is_user_upload ? 'class="ntisas-post-upload"' : "");
    let domain = (source.match(/^https?:\/\//) ? JSPLib.utility.getDomainName(source, 2) : "NON-WEB");
    let size_text = (Number.isInteger(file_size) && Number.isInteger(width) && Number.isInteger(height) ? `${ReadableBytes(file_size)} (${width}x${height})` : "");
    return `
<p class="ntisas-desc ntisas-desc-title"><span ${uploader_addon}>${title_text}</span></p>
<p class="ntisas-desc ntisas-desc-info">${file_ext.toUpperCase()} @ <span title="${domain}">${domain}</span></p>
<p class="ntisas-desc ntisas-desc-size">${size_text}</p>`;
}

function RenderNomatchLinks(tweet_id,no_iqdb_results,no_sauce_results,merge_results=false) {
    let results_link = (!merge_results ? '<a class="ntisas-manual-add ntisas-database-no-match ntisas-expanded-link">no sources</a>' : '<a class="ntisas-cancel-merge ntisas-expanded-link">Cancel</a>');
    let no_url_results = NTISAS.no_url_results.includes(tweet_id);
    let iqdb_link = (no_iqdb_results ? '<a class="ntisas-reset-results ntisas-database-no-match ntisas-expanded-link" data-type="iqdb">no results</a>' : '<a class="ntisas-check-iqdb ntisas-expanded-link">IQDB</a>');
    let url_link = (no_url_results ? '<a class="ntisas-manual-add ntisas-database-no-match ntisas-expanded-link">no sources</a>' : '<a class="ntisas-check-url ntisas-expanded-link">URL</a>');
    let sauce_link = (no_sauce_results ? '<a class="ntisas-reset-results ntisas-database-no-match ntisas-expanded-link" data-type="sauce">no results</a>' : '<a class="ntisas-check-sauce ntisas-expanded-link">Sauce</a>');
    let help_info = GetNomatchHelp(no_url_results, no_iqdb_results, no_sauce_results);
    return `
(
    ${results_link}
    |
    ${url_link}
    |
    ${iqdb_link}
    |
    ${sauce_link}
    |
    ${RenderHelp(help_info)}
)`;
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
    return array.map((val)=>{return Math.max(Number(val) - 50, 0).toString();})
}

//Initialize functions

function InitializeCleanupTasks() {
    //Take care of other non-critical tasks at a later time
    setTimeout(()=>{
        CheckDatabaseInfo();
        CheckServerBadTweets();
        CheckPurgeBadTweets();
        JSPLib.storage.pruneEntries(PROGRAM_SHORTCUT, PROGRAM_DATA_REGEX, PRUNE_RECHECK_EXPIRES);
    }, CLEANUP_TASK_DELAY);
}

function InitializeColorScheme() {
    if (!JSPLib.utility.hasStyle('color')) {
        let color_data = JSPLib.storage.checkStorageData('ntisas-color-style', ValidateProgramData, localStorage);
        if (color_data) {
            let color_style = RenderColorStyle(color_data)
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

function InitializeStatusBar(tweet_status,is_main_tweet) {
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
    $('#ntisas-side-menu [data-setting]').each((i,entry)=>{
        let setting = $(entry).data('setting');
        if (NTISAS.user_settings[setting]) {
            $(entry).show();
        } else {
            $(entry).hide();
        }
    });
}

function InitializeDatabaseLink() {
    var database_html = "";
    var database_help = "";
    if (NTISAS.user_settings.bypass_server_mode) {
        $('#ntisas-database-link').html('<span id="ntisas-server-bypass">Server Bypass</span>');
        $('#ntisas-database-help').html('&nbsp;&nbsp;&nbsp;');
        return;
    }
    NTISAS.server_info = JSPLib.storage.getStorageData('ntisas-remote-database', localStorage);
    if (NTISAS.server_info === null) {
        return;
    }
    let database_timestring = new Date(NTISAS.server_info.timestamp).toLocaleString();
    //Add some validation to the following, and move it out of the RenderSideMenu function
    JSPLib.storage.retrieveData('ntisas-database-info', false, JSPLib.storage.twitterstorage).then((database_info)=>{
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

function InitializeCounter() {
    if (!NTISAS.user_settings.tweet_indicators_enabled) {
        return;
    }
    if ($('#ntisas-indicator-counter').length) {
        if (NTISAS.prev_pagetype !== 'tweet') {
            $('#ntisas-indicator-counter').remove();
            NTISAS.counted_artists = [];
            NTISAS.counted_tweets = [];
        } else {
            return
        }
    }
    $('#ntisas-account-options h1').append(MAIN_COUNTER);
}

function InitializeImageMenu($tweets,append_selector,menu_class) {
    let uniqueid = NTISAS.uniqueid;
    let timername = `InitializeImageMenu-${uniqueid}`;
    JSPLib.debug.debugTime(timername);
    let tweet_ids = JSPLib.utility.setUnique(JSPLib.utility.getDOMAttributes($tweets, 'tweet-id', String));
    let promise_array = [];
    InitializeImageMenu.debuglog(`[${uniqueid}]`, "Check Tweets:", tweet_ids);
    $tweets.each((i,tweet)=>{
        let tweet_promise = $.Deferred();
        promise_array.push(tweet_promise);
        $(append_selector, tweet).addClass('ntisas-image-menu');
        let tweet_id = String($(tweet).data('tweet-id'));
        GetData('tweet-' + tweet_id, 'twitter').then(async (post_ids)=>{
            let $link_container = $(`<div class="ntisas-link-menu ${menu_class} ntisas-links"></div>`);
            $(append_selector, tweet).append($link_container);
            if (post_ids !== null) {
                InitializePostIDsLink(tweet_id, $link_container, tweet, post_ids)
            } else {
                InitializeNoMatchesLinks(tweet_id, $link_container);
            }
            tweet_promise.resolve(null);
        });
    });
    Promise.all(promise_array).then(()=>{
        JSPLib.debug.debugTimeEnd(timername);
    });
}

function InitializeQtip($obj,tweet_id,delayfunc) {
    const qtip_settings = Object.assign({}, PREVIEW_QTIP_SETTINGS, {
        content: {
            text: (event,qtip) => {
                if (!qtip.tooltip[0].hasAttribute(PROGRAM_SHORTCUT)) {
                    if (delayfunc) {
                        NTISAS.tweet_qtip[tweet_id] = delayfunc();
                    }
                    qtip.tooltip.attr(PROGRAM_SHORTCUT, 'done');
                }
                return NTISAS.tweet_qtip[tweet_id] || "Loading...";
            }
        }
    });
    $obj.qtiptisas(qtip_settings);
}

function InitializeSimilarContainer(image_urls,similar_results,tweet_id,type) {
    let $attachment = $(RenderAllSimilar(similar_results, image_urls, type));
    let all_posts = JSPLib.utility.getObjectAttributes(similar_results.flat(),'post');
    SetThumbnailWait($attachment[0], all_posts);
    $('article:first-of-type', $attachment[0]).each((i,article)=>{
        InitializeTwitterImage(article, image_urls).then(({size})=>{
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
    $('article', $dialog[0]).each((i,article)=>{
        InitializeTwitterImage(article, image_urls);
    });
    InitializeUIStyle();
    $dialog.dialog(dialog_settings);
    return $dialog;
}

function InitializeTwitterImage(article,image_urls) {
    let index = Number($(article).data('id'));
    let image_url = image_urls[index] + ':orig';
    let image = $('img', article)[0];
    let image_promise = GetImageAttributes(image_url);
    image_promise.then(({size,width,height})=>{
        let [preview_width,preview_height] = JSPLib.utility.getPreviewDimensions(width, height, POST_PREVIEW_DIMENSION);
        image.width = preview_width;
        image.height = preview_height;
        image.style.paddingTop = `${POST_PREVIEW_DIMENSION - preview_height}px`;
        $('p:nth-child(4)', article).html(`${ReadableBytes(size)} (${width}x${height})`);
    });
    return image_promise;
}

function InitializePostsContainer(all_posts,image_urls) {
    let $attachment = $(RenderPostsContainer(all_posts));
    SetThumbnailWait($attachment[0], all_posts);
    image_urls.forEach((image_url)=>{
        JSPLib.network.getImageSize(image_url + ':orig').then((size)=>{
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
        let image_urls = GetImageLinks(tweet);
        InitializeQtip($link, tweet_id, () => (InitializePostsContainer(posts_data, image_urls)));
    }
}

async function InitializeNoMatchesLinks(tweet_id,$obj) {
    let [iqdb_results,sauce_results] = await Promise.all([
        GetData('iqdb-' + tweet_id, 'danbooru'),
        GetData('sauce-' + tweet_id, 'danbooru'),
    ]);
    let merge_results = NTISAS.merge_results.includes(tweet_id);
    $obj.html(RenderNomatchLinks(tweet_id, iqdb_results !== null && iqdb_results.value, sauce_results !== null && sauce_results.value, merge_results));
}

function InitializeTweetIndicators(tweet) {
    $('.ntisas-indicators', tweet).append(TWEET_INDICATORS);
    $('.ntisas-tweet-actions', tweet).after(INDICATOR_LINKS);
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
        InitializeViewCount.debuglog("Viewable tweet:", tweet_id);
        AddViewCount(tweet_id);
    }
}

function InitializeDownloadLinks($tweet) {
    let tweet_deferred = $tweet.prop('ntisasDeferred');
    if (!tweet_deferred) {
        return;
    }
    //Only add download links once images have been loaded
    tweet_deferred.then(()=>{
        let is_video = Boolean($('.ntisas-tweet-video', $tweet[0]).length);
        let $download_section = $(RenderDownloadLinks($tweet, NTISAS.user_settings.download_position[0], is_video));
        if (NTISAS.user_settings.download_position[0] === 'above') {
            $('.ntisas-tweet-media', $tweet[0]).prepend($download_section);
        } else if (NTISAS.user_settings.download_position[0] === 'below') {
            $('.ntisas-tweet-media', $tweet[0]).append($download_section);
        }
        if (is_video) {
            let tweet_id = String($tweet.data('tweet-id'));
            GetMaxVideoDownloadLink(tweet_id).then((video_url)=>{
                if (video_url !== null) {
                    SetVideoDownload($download_section, video_url);
                }
            });
        }
    });
}

function InitializeUploadlinks(install) {
    InitializeUploadlinks.photo_index = NTISAS.page_match.photo_index;
    let $photo_container = $('.ntisas-photo-container');
    let selected_photo = $(`li:nth-of-type(${InitializeUploadlinks.photo_index}) img`, $photo_container[0]);
    if (selected_photo.length === 0) {
        selected_photo = $('img', $photo_container[0]);
        if (selected_photo.length === 0) {
            InitializeUploadlinks.debuglog("No popup images found!");
            return;
        }
    }
    let image_url = GetNormalImageURL(selected_photo[0].src);
    let tweet_url = JSPLib.utility.findAll(window.location.href, TWEET_URL_REGEX)[0];
    if (!image_url || !tweet_url) {
        return
    }
    let orig_image_url = image_url + ':orig';
    let url_addons = $.param({url: orig_image_url, ref: tweet_url});
    let upload_link = `${NTISAS.domain}/uploads/new?${url_addons}`
    if (install) {
        var $link = $(`<div class="ntisas-upload"><a target="_blank" href="${upload_link}">Upload</a></div>`);
        $('.ntisas-photo-menu').append($link);
    } else {
        $link = $('.ntisas-upload a');
        $link.attr('href', upload_link);
    }
    GetImageAttributes(orig_image_url).then(({size,width,height})=>{
        $link.attr('title', `${ReadableBytes(size)} (${width}x${height})`);
    });
}

function InitializeMediaLink($tweet) {
    let screen_name = String($tweet.data('screen-name'));
    let links_html = JSPLib.utility.regexReplace(MEDIA_LINKS_HTML, {SCREENNAME: screen_name});
    $('.r-18u37iz.r-1mi0q7o .r-1wtj0ep').css('display', 'flex');
    $('[data-testid=caret]', $tweet[0]).before(links_html);
}

function InitializeRetweetDisplay(tweet) {
    let retweet_id = String($(tweet).data('retweet-id'));
    $('.ntisas-retweet-id', tweet).html(`[${retweet_id}]`);
}

function InitializeUserDisplay($tweets) {
    let $tweet = $tweets.filter('.ntisas-main-tweet');
    if ($tweet.length) {
        let user_id = String($tweet.data('user-id') || "");
        if (user_id) {
            $('.ntisas-user-id', $tweet[0]).html(`<b>User</b> [${user_id}]`);
        }
    }
}

function InitializeImageTweets($image_tweets) {
    if (IsPageType(STREAMING_PAGES)) {
        InitializeImageMenu($image_tweets, '.ntisas-tweet-actions', 'ntisas-timeline-menu');
    } else if (IsTweetPage()) {
        let $tweet = $image_tweets.filter(`[data-tweet-id=${NTISAS.tweet_id}]`);
        if ($tweet.length && $('.ntisas-tweet-image, .ntisas-tweet-video', $tweet[0]).length) {
            InitializeImageMenu($tweet, '.ntisas-retweets-likes', 'ntisas-tweet-menu');
            if (NTISAS.user_settings.original_download_enabled) {
                InitializeDownloadLinks($tweet);
            }
            if (NTISAS.user_settings.display_media_link) {
                InitializeMediaLink($tweet);
            }
        }
    }
}

function InitializeTweetStats(filter1,filter2) {
    const getStatAverage = (obj, type)=>{
        let type_array = JSPLib.utility.getObjectAttributes(obj, type);
        let adjusted_array = JSPLib.statistics.removeOutliers(type_array, 1);
        let average = JSPLib.statistics.average(adjusted_array);
        return JSPLib.utility.setPrecision(average, 2);
    };
    let filter_tweets = NTISAS.tweet_stats.filter((entry)=>{
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
    let retweets = filter_tweets.filter((entry)=>{return entry.retweet}).length;
    let image_tweets = filter_tweets.filter((entry)=>{return entry.image}).length;
    let video_tweets = filter_tweets.filter((entry)=>{return entry.video}).length;
    let text_tweets = filter_tweets.filter((entry)=>{return !entry.image && !entry.video}).length;
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
    let selected_metrics = JSPLib.utility.setUnique([filter1, filter2]);
    if (selected_metrics.length == 2 && selected_metrics.includes('total')) {
        selected_metrics.splice(selected_metrics.indexOf('total'), 1);
    }
    $('#ntisas-tweet-stats-table td').css('background-color', 'white');
    selected_metrics.forEach((metric)=>{
        $(`#ntisas-tweet-stats-table td[data-key=${metric}]`).css('background-color', 'yellow');
    });
    return true;
}

//Queue functions

function QueueStorageRequest(type,key,value,database) {
    let queue_key = type + '-' + key + '-' + database;
    if (!CACHE_STORAGE_TYPES.includes(type) || !(queue_key in CACHED_STORAGE_REQUESTS)) {
        const request = {
            type,
            key,
            value,
            database,
            promise: $.Deferred(),
        };
        QUEUED_STORAGE_REQUESTS.push(request);
        CACHED_STORAGE_REQUESTS[queue_key] = request.promise;
    }
    return CACHED_STORAGE_REQUESTS[queue_key];
}

function InvalidateCache(key,database) {
    CACHE_STORAGE_TYPES.forEach((type)=>{
        let queue_key = type + '-' + key + '-' + database;
        delete CACHED_STORAGE_REQUESTS[queue_key];
    });
}

function FulfillStorageRequests(keylist,data_items,requests) {
    keylist.forEach((key)=>{
        let data = (key in data_items ? data_items[key] : null);
        let request = requests.find((request) => (request.key === key));
        request.promise.resolve(data);
    });
}

async function IntervalStorageHandler() {
    if (QUEUED_STORAGE_REQUESTS.length === 0) {
        return;
    }
    for (let database in STORAGE_DATABASES) {
        let requests = QUEUED_STORAGE_REQUESTS.filter((request) => (request.database === database));
        let save_requests = requests.filter((request) => (request.type === 'save'));
        if (save_requests.length) {
            let save_data = Object.assign(...save_requests.map((request) => ({[request.key]: request.value})));
            JSPLib.storage.batchSaveData(save_data, STORAGE_DATABASES[database]).then(()=>{
                save_requests.forEach((request) => request.promise.resolve(null));
            });
        }
        let remove_requests = requests.filter((request) => (request.type === 'remove'));
        if (remove_requests.length) {
            let remove_keys = remove_requests.map((request) => request.key);
            JSPLib.storage.batchRemoveData(remove_keys, STORAGE_DATABASES[database]).then(()=>{
                remove_requests.forEach((request) => request.promise.resolve(null));
            });
        }
        let check_requests = requests.filter((request) => (request.type === 'check'));
        if (check_requests.length) {
            let check_keys = check_requests.map((request) => request.key);
            JSPLib.storage.batchCheckLocalDB(check_keys, ValidateEntry, ValidateExpiration, STORAGE_DATABASES[database]).then((check_data)=>{
                FulfillStorageRequests(check_keys,check_data,check_requests);
            });
        }
        let noncheck_requests = requests.filter((request) => (request.type === 'get'));
        if (noncheck_requests.length) {
            let noncheck_keys = noncheck_requests.map((request) => request.key);
            JSPLib.storage.batchRetrieveData(noncheck_keys, STORAGE_DATABASES[database]).then((noncheck_data)=>{
                FulfillStorageRequests(noncheck_keys,noncheck_data,noncheck_requests);
            });
        }
    }
    QUEUED_STORAGE_REQUESTS.length = 0;
}

function QueueNetworkRequest (type, item) {
    const request = {
        type,
        item,
        promise: $.Deferred(),
    };
    QUEUED_NETWORK_REQUESTS.push(request);
    return request.promise;
}

function IntervalNetworkHandler () {
    if (QUEUED_NETWORK_REQUESTS.length === 0) {
        return;
    }
    Object.keys(NETWORK_REQUEST_DICT).forEach((type) => {
        const requests = QUEUED_NETWORK_REQUESTS.filter((request) => (request.type === type));
        if (requests.length > 0) {
            const items = requests.map((request) => request.item).flat();
            const params = NETWORK_REQUEST_DICT[type].params(items);
            const data_key = NETWORK_REQUEST_DICT[type].data_key;
            JSPLib.danbooru.submitRequest(type, params, [], false, null, NTISAS.domain).then((data_items)=>{
                requests.forEach((request)=>{
                    let request_data = data_items.filter((data)=>{
                        return request.item.includes(data[data_key]);
                    });
                    request.promise.resolve(request_data);
                });
            });
        }
    });
    QUEUED_NETWORK_REQUESTS.length = 0;
}

//Network functions

async function GetItems(item_ids, storage_key, network_key) {
    let storage_promises = item_ids.map((id) => GetData(storage_key + '-' + id, 'danbooru'));
    let storage_data = await Promise.all(storage_promises);
    storage_data = storage_data.filter((data) => (data !== null));
    storage_data = JSPLib.utility.getObjectAttributes(storage_data, 'value');
    let found_ids = JSPLib.utility.getObjectAttributes(storage_data, 'id');
    let missing_ids = JSPLib.utility.setDifference(item_ids, found_ids);
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
    posts_data.sort((a,b) => (post_ids.indexOf(a.id) - post_ids.indexOf(b.id)));
    return posts_data;
}

async function CheckPostvers() {
    let postver_lastid = GetPostVersionsLastID('postver');
    let url_addons = {search: {source_changed: true, source_regex: 'twitter\.com'}, only: POSTVER_FIELDS};
    let query_params = {addons: url_addons, reverse: true, domain: NTISAS.domain, notify: true};
    if (postver_lastid) {
        query_params.page = postver_lastid;
    }
    let post_versions = await JSPLib.danbooru.getAllItems('post_versions', QUERY_LIMIT, QUERY_BATCH_NUM, {page:postver_lastid, addons: url_addons, reverse: true, domain: NTISAS.domain, notify: true});
    if (post_versions.length === QUERY_BATCH_SIZE) {
        CheckPostvers.debuglog("Overflow detected!");
        JSPLib.storage.setStorageData('ntisas-overflow', true, localStorage);
    } else {
        CheckPostvers.debuglog("No overflow:", post_versions.length, QUERY_BATCH_SIZE);
        JSPLib.storage.setStorageData('ntisas-overflow', false, localStorage);
    }
    if (post_versions.length) {
        let [add_entries,rem_entries] = ProcessPostvers(post_versions);
        CheckPostvers.debuglog("Process:", add_entries, rem_entries);
        SavePostvers(add_entries,rem_entries);
        let lastid = JSPLib.danbooru.getNextPageID(post_versions, true);
        //Since the post version last ID is critical, an extra sanity check has been added
        if (JSPLib.validate.validateID(lastid)) {
            JSPLib.storage.setStorageData('ntisas-postver-lastid', lastid, localStorage);
            let all_timestamps = JSPLib.utility.getObjectAttributes(post_versions, 'updated_at');
            let normal_timestamps = all_timestamps.map((timestamp)=>{return new Date(timestamp).getTime();})
            let most_recent_timestamp = Math.max(...normal_timestamps);
            JSPLib.storage.setStorageData('ntisas-recent-timestamp', most_recent_timestamp, localStorage);
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
        let post_versions = await JSPLib.danbooru.getAllItems('post_versions', QUERY_LIMIT, QUERY_BATCH_NUM, {page:postver_lastid, addons: url_addons, reverse: true, domain: NTISAS.domain, notify: true});
        if (post_versions.length === QUERY_BATCH_SIZE) {
            CheckServerBadTweets.debuglog("Overflow detected!");
        } else {
            CheckServerBadTweets.debuglog("No overflow:", post_versions.length, QUERY_BATCH_SIZE);
            JSPLib.concurrency.setRecheckTimeout('ntisas-badver-recheck', BADVER_RECHECK_EXPIRES);
        }
        if (post_versions.length) {
            let [add_entries,rem_entries] = ProcessPostvers(post_versions);
            CheckServerBadTweets.debuglog("Process:", add_entries, rem_entries);
            SavePostvers(add_entries,rem_entries);
            let lastid = JSPLib.danbooru.getNextPageID(post_versions, true);
            //Since the post version last ID is critical, an extra sanity check has been added
            if (JSPLib.validate.validateID(lastid)) {
                JSPLib.storage.setStorageData('ntisas-badver-lastid', lastid, localStorage);
                let all_timestamps = JSPLib.utility.getObjectAttributes(post_versions, 'updated_at');
                InitializeCurrentRecords();
                NTISAS.channel.postMessage({type: 'currentrecords'});
            }
        }
        JSPLib.concurrency.freeSemaphore(PROGRAM_SHORTCUT, 'badvers');
    }
}

function SavePostvers(add_entries,rem_entries) {
    let combined_keys = JSPLib.utility.setIntersection(Object.keys(add_entries), Object.keys(rem_entries));
    combined_keys.forEach((tweet_id)=>{
        let tweet_key = 'tweet-' + tweet_id;
        let post_ids = add_entries[tweet_id];
        JSPLib.storage.retrieveData(tweet_key, false, JSPLib.storage.twitterstorage).then((data)=>{
            if (JSPLib.validate.validateIDList(data)) {
                SavePostvers.debuglog("Tweet adds/rems - existing IDs:", tweet_key, data);
                post_ids = JSPLib.utility.setUnique(JSPLib.utility.setDifference(JSPLib.utility.setUnion(data, add_entries[tweet_id]), rem_entries[tweet_id]));
            }
            if (data === null || JSPLib.utility.setSymmetricDifference(post_ids, data)) {
                SavePostvers.debuglog("Tweet adds/rems - saving:", tweet_key, post_ids);
                SaveData(tweet_key, post_ids, 'twitter');
                UpdatePostIDsLink(tweet_id, post_ids);
                NTISAS.channel.postMessage({type: 'postlink', tweet_id: tweet_id, post_ids: post_ids});
            }
        });
    });
    let single_adds = JSPLib.utility.setDifference(Object.keys(add_entries), combined_keys);
    single_adds.forEach((tweet_id)=>{
        let tweet_key = 'tweet-' + tweet_id;
        let post_ids = add_entries[tweet_id];
        JSPLib.storage.retrieveData(tweet_key, false, JSPLib.storage.twitterstorage).then((data)=>{
            if (JSPLib.validate.validateIDList(data)) {
                SavePostvers.debuglog("Tweet adds - existing IDs:", tweet_key, data);
                post_ids = JSPLib.utility.setUnion(data, post_ids);
            }
            if (data === null || post_ids.length > data.length) {
                SavePostvers.debuglog("Tweet adds - saving:", tweet_key, post_ids);
                SaveData(tweet_key, post_ids, 'twitter');
                UpdatePostIDsLink(tweet_id, post_ids);
                NTISAS.channel.postMessage({type: 'postlink', tweet_id: tweet_id, post_ids: post_ids});
            }
        });
    });
    let single_rems = JSPLib.utility.setDifference(Object.keys(rem_entries), combined_keys);
    single_rems.forEach((tweet_id)=>{
        let tweet_key = 'tweet-' + tweet_id;
        let post_ids = [];
        JSPLib.storage.retrieveData(tweet_key, false, JSPLib.storage.twitterstorage).then((data)=>{
            if (data !== null && JSPLib.validate.validateIDList(data)) {
                SavePostvers.debuglog("Tweet removes - existing IDs:", tweet_key, data);
                post_ids = JSPLib.utility.setUnique(JSPLib.utility.setDifference(data, rem_entries[tweet_id]));
            }
            if (post_ids.length) {
                SavePostvers.debuglog("Tweet removes - saving:", tweet_key, post_ids);
                SaveData(tweet_key, post_ids, 'twitter');
            } else {
                SavePostvers.debuglog("Tweet removes - deleting:", tweet_key);
                RemoveData(tweet_key, 'twitter');
            }
            if (data !== null) {
                UpdatePostIDsLink(tweet_id, post_ids);
                NTISAS.channel.postMessage({type: 'postlink', tweet_id: tweet_id, post_ids: post_ids});
            }
        });
    });
}

async function GetMaxVideoDownloadLink(tweet_id) {
    let key = 'video-' + tweet_id;
    let cached = await JSPLib.storage.checkLocalDB(key, ValidateEntry, VIDEO_EXPIRES);
    if (!cached) {
        if (API_DATA.has_data && tweet_id in API_DATA.tweets) {
            var data = GetAPIData('tweets', tweet_id);
        } else {
            data = await $.ajax({
                method: 'GET',
                beforeSend: function (request) {
                    request.setRequestHeader('authorization', 'Bearer AAAAAAAAAAAAAAAAAAAAALVzYQAAAAAAIItU1SgTX8I%2B7Q3Cl3mqvuZiAAc%3D0AtbuGPnZgRlOHbTIk3JudxSGqXxgfkwpMG367Rtyw6GGLwO6N');
                },
                url: `https://api.twitter.com/1.1/statuses/show.json?id=${tweet_id}&tweet_mode=extended&trim_user=true`,
                processData: false
            });
        }
        try {
            var variants = data.extended_entities.media[0].video_info.variants;
        } catch (e) {
            //Bad data was returned!
            GetMaxVideoDownloadLink.debuglog("Bad data returned:", data);
            variants = null;
        }
        if (variants) {
            let max_bitrate = Math.max(...JSPLib.utility.getObjectAttributes(variants, 'bitrate').filter((num)=>{return Number.isInteger(num);}));
            let max_video = variants.filter((variant)=>{return variant.bitrate === max_bitrate;});
            var video_url = (max_video.length ? max_video[0].url.split('?')[0] : null);
        } else {
            video_url = null;
        }
        JSPLib.storage.saveData(key, {value: video_url, expires: JSPLib.utility.getExpires(VIDEO_EXPIRES)});
        return video_url;
    } else {
        return cached.value;
    }
}

async function InstallUserProfileData() {
    NTISAS.user_data = JSPLib.storage.checkStorageData('ntisas-user-data', ValidateProgramData, localStorage);
    if (!NTISAS.user_data || JSPLib.concurrency.checkTimeout('ntisas-user-profile-recheck', USER_PROFILE_RECHECK_EXPIRES)) {
        NTISAS.user_data = await JSPLib.danbooru.submitRequest('profile', {only: PROFILE_FIELDS}, {}, false, null, NTISAS.domain);
        if (!NTISAS.user_data.id || !NTISAS.user_data.level) {
            NTISAS.user_data = {id: 2, level: GOLD_LEVEL};
        }
        JSPLib.storage.setStorageData('ntisas-user-data', NTISAS.user_data, localStorage);
        JSPLib.concurrency.setRecheckTimeout('ntisas-user-profile-recheck', USER_PROFILE_RECHECK_EXPIRES);
    }
}

function TweetUserData(data) {
    if (typeof data === 'object' && 'globalObjects' in data) {
        if ('tweets' in data.globalObjects) {
            Object.assign(API_DATA.tweets, data.globalObjects.tweets);
            for (let twitter_id in data.globalObjects.tweets) {
                let entry = data.globalObjects.tweets[twitter_id];
                if ('retweeted_status_id_str' in entry) {
                    let tweet_id = entry.retweeted_status_id_str;
                    API_DATA.retweets[tweet_id] = entry;
                }
            }
            API_DATA.has_data = true;
        }
        if ('users' in data.globalObjects) {
            Object.assign(API_DATA.users_id, data.globalObjects.users);
            for (let twitter_id in data.globalObjects.users) {
                let entry = data.globalObjects.users[twitter_id];
                API_DATA.users_name[entry.screen_name] = entry;
            }
            API_DATA.has_data = true;
        }
    }
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
    LoadDatabase.debuglog("starting tweet load");
    JSPLib.debug.debugTime('database-network');
    var tweet_data = await JSPLib.network.getNotify(SERVER_DATABASE_URL, {}, JSPLib.utility.sprintf(SERVER_ERROR, "tweet database"));
    JSPLib.debug.debugTimeEnd('database-network');
    if (tweet_data !== false) {
        await TIMER.SaveDatabase(tweet_data, '#ntisas-counter');
        return true;
    }
    return false;
}

async function SaveDatabase(database,counter_selector) {
    var database_keys = Object.keys(database);
    let batches = Math.floor(database_keys.length / 2000);
    SaveDatabase.debuglog("Database size:", database_keys.length);
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
            SaveDatabase.debuglog("Saving batch #", batches);
            JSPLib.debug.debugTime('database-save-' + batches);
            await JSPLib.storage.twitterstorage.setItems(payload);
            JSPLib.debug.debugTimeEnd('database-save-' + batches);
            //Give some control back to the user
            await JSPLib.utility.sleep(500);
            payload = {};
        }
    }
}

async function GetSavePackage(export_types) {
    let save_package = Object.assign(...export_types.map((type)=>{return {[type]: {}};}));
    if (export_types.includes('program_data')) {
        Object.keys(localStorage).forEach((key)=>{
            if (key.match(/^ntisas-/)) {
                save_package.program_data[key] = JSPLib.storage.getStorageData(key, localStorage);
            }
        });
    }
    if (export_types.includes('tweet_database')) {
        let database_length = await GetTotalRecords();
        let batch_counter = Math.floor(database_length / 10000);
        await JSPLib.storage.twitterstorage.iterate((value,key,i)=>{
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
    Danbooru.Utility.notice("NTISAS will momentarily refresh the page to finish initializing the database.");
    //It's just easier to reload the page on database updates
    JSPLib.utility.refreshPage(PAGE_REFRESH_TIMEOUT);
}

async function CheckDatabaseInfo(initial) {
    if (!NTISAS.user_settings.bypass_server_mode && (initial || JSPLib.concurrency.checkTimeout('ntisas-database-recheck', DATABASE_RECHECK_EXPIRES))) {
        let database_info = await JSPLib.network.getNotify(DATABASE_INFO_URL, {}, JSPLib.utility.sprintf(SERVER_ERROR, "database info"));
        if (database_info !== false) {
            JSPLib.storage.setStorageData('ntisas-remote-database', database_info, localStorage);
        }
        JSPLib.concurrency.setRecheckTimeout('ntisas-database-recheck', DATABASE_RECHECK_EXPIRES);
    }
}

function CheckPurgeBadTweets() {
    if (!NTISAS.user_settings.bypass_server_mode && JSPLib.storage.getStorageData('ntisas-purge-bad', localStorage, false) && JSPLib.concurrency.reserveSemaphore(PROGRAM_SHORTCUT, 'purgebad')) {
        TIMER.PurgeBadTweets().then(()=>{
            CheckPurgeBadTweets.debuglog("All bad Tweets purged!");
            JSPLib.storage.setStorageData('ntisas-purge-bad', false, localStorage);
            JSPLib.concurrency.freeSemaphore(PROGRAM_SHORTCUT, 'purgebad')
        });
    }
}

async function PurgeBadTweets() {
    let server_purgelist = await JSPLib.network.getNotify(SERVER_PURGELIST_URL, {}, JSPLib.utility.sprintf(SERVER_ERROR, "purge list"));
    if (server_purgelist !== false) {
        let purge_keylist = server_purgelist.map((tweet_id)=>{return 'tweet-' + tweet_id;});
        let database_keylist = await JSPLib.storage.twitterstorage.keys();
        let purge_set = new Set(purge_keylist)
        let database_set = new Set(database_keylist)
        let delete_keys = [...purge_set].filter((x)=>{return database_set.has(x);});
        PurgeBadTweets.debuglog(delete_keys);
        await JSPLib.storage.batchRemoveData(delete_keys, JSPLib.storage.twitterstorage);
    }
}

//Event handlers

function CheckViews(event) {
    $('.ntisas-tweet-image, .ntisas-tweet-video').closest('.ntisas-tweet').each((i,tweet)=>{
        if (JSPLib.utility.isScrolledIntoView(tweet)) {
            let tweet_id = String($(tweet).data('tweet-id'));
            CheckViews.debuglog("Viewable tweet:", event.type, tweet_id);
            AddViewCount(tweet_id);
        }
    });
}

function PhotoNavigation(event) {
    if (!NTISAS.photo_navigation) {
        return;
    }
    setTimeout(()=>{
        //Get the latest page regex match stored onto global variable
        let pagetype = GetPageType();
        if (pagetype === 'photo') {
            if (NTISAS.page_match.photo_index !== InitializeUploadlinks.photo_index) {
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
    let image_num = $container.data('image-num');
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

function ToggleArtistHilights(event) {
    let [user_ident,all_idents] = GetUserIdent();
    if (user_ident) {
        let no_highlight_list = GetList('no-highlight-list');
        if (JSPLib.utility.hasIntersection(no_highlight_list, all_idents)) {
            no_highlight_list = JSPLib.utility.setDifference(no_highlight_list, all_idents);
        } else {
            no_highlight_list = JSPLib.utility.setUnion(no_highlight_list, all_idents);
        }
        SaveList('no-highlight-list', no_highlight_list);
        UpdateHighlightControls();
        setTimeout(UpdateArtistHighlights, JQUERY_DELAY);
        NTISAS.channel.postMessage({type: 'highlights', list: no_highlight_list});
    }
}

function IncreaseFadeLevel(event) {
    NTISAS.fade_level = Math.max(--NTISAS.fade_level, 0);
    $('#ntisas-current-fade-level').html(JSPLib.utility.displayCase(SCORE_LEVELS[NTISAS.fade_level]));
    setTimeout(UpdateArtistHighlights, JQUERY_DELAY);
}

function DecreaseFadeLevel(event) {
    NTISAS.fade_level = Math.min(++NTISAS.fade_level, SCORE_LEVELS.length - 1);
    $('#ntisas-current-fade-level').html(JSPLib.utility.displayCase(SCORE_LEVELS[NTISAS.fade_level]));
    setTimeout(UpdateArtistHighlights, JQUERY_DELAY);
}

function IncreaseHideLevel(event) {
    NTISAS.hide_level = Math.max(--NTISAS.hide_level, 0);
    $('#ntisas-current-hide-level').html(JSPLib.utility.displayCase(SCORE_LEVELS[NTISAS.hide_level]));
    setTimeout(UpdateArtistHighlights, JQUERY_DELAY);
}

function DecreaseHideLevel(event) {
    NTISAS.hide_level = Math.min(++NTISAS.hide_level, SCORE_LEVELS.length - 1);
    $('#ntisas-current-hide-level').html(JSPLib.utility.displayCase(SCORE_LEVELS[NTISAS.hide_level]));
    setTimeout(UpdateArtistHighlights, JQUERY_DELAY);
}

function ToggleViewHighlights(event) {
    NTISAS.view_highlights = !NTISAS.view_highlights;
    $('[role=main]').toggleClass('ntisas-show-views');
    UpdateViewControls();
}

function ToggleAutoclickIQDB(event) {
    let [user_ident,all_idents] = GetUserIdent();
    if (user_ident) {
        let auto_iqdb_list = GetList('auto-iqdb-list');
        if (JSPLib.utility.hasIntersection(auto_iqdb_list, all_idents)) {
            auto_iqdb_list = JSPLib.utility.setDifference(auto_iqdb_list, all_idents);
        } else {
            auto_iqdb_list = JSPLib.utility.setUnion(auto_iqdb_list, all_idents);
        }
        SaveList('auto-iqdb-list', auto_iqdb_list);
        UpdateIQDBControls();
        NTISAS.channel.postMessage({type: 'autoiqdb', list: auto_iqdb_list});
    }
}

function ToggleTweetIndicators(event) {
    let INDICATOR_CONTROLS = JSPLib.storage.getStorageData('ntisas-indicator-controls', localStorage, true);
    JSPLib.storage.setStorageData('ntisas-indicator-controls', !INDICATOR_CONTROLS, localStorage);
    UpdateIndicatorControls();
    setTimeout(UpdateTweetIndicators, JQUERY_DELAY);
    NTISAS.channel.postMessage({type: 'indicators'});
}

function InstallDatabase(event) {
    let message = JSPLib.utility.sprintf(INSTALL_CONFIRM, NTISAS.server_info.post_version, new Date(NTISAS.server_info.timestamp).toLocaleString());
    if (confirm(message)) {
        $('#ntisas-database-link').html(LOAD_COUNTER)
        LoadDatabase().then((data)=>{
            if (data) {
                JSPLib.storage.saveData('ntisas-database-info', NTISAS.server_info, JSPLib.storage.twitterstorage);
                InitializeDatabase();
            }
        });
    }
}

function UpgradeDatabase(event) {
    let message = JSPLib.utility.sprintf(UPGRADE_CONFIRM, NTISAS.server_info.post_version, new Date(NTISAS.server_info.timestamp).toLocaleString(),
                                                          NTISAS.database_info.post_version, new Date(NTISAS.database_info.timestamp).toLocaleString());
    if (confirm(message)) {
        $('#ntisas-database-link').html(LOAD_COUNTER);
        LoadDatabase().then((data)=>{
            if (data) {
                JSPLib.storage.saveData('ntisas-database-info', NTISAS.server_info, JSPLib.storage.twitterstorage);
                JSPLib.storage.setStorageData('ntisas-purge-bad', true, localStorage);
                InitializeDatabase();
            }
        });
    }
}

function CurrentRecords(event) {
    if (event.target.tagName === 'A' && !GetAllCurrentRecords.is_running) {
        if (WasOverflow()) {
            if (JSPLib.concurrency.reserveSemaphore(PROGRAM_SHORTCUT, 'records')) {
                if (confirm(CURRENT_RECORDS_CONFIRM)) {
                    GetAllCurrentRecords();
                } else {
                    JSPLib.concurrency.freeSemaphore(PROGRAM_SHORTCUT, 'records')
                }
            } else {
                Danbooru.Utility.error("Getting current records in another tab!");
            }
        } else {
            Danbooru.Utility.notice("Already up to date!");
        }
    } else if (event.target.tagName === 'SPAN' && NTISAS.database_info) {
        $('#ntisas-current-records').html("Loading...");
        TIMER.CheckPostvers();
    }
}

function CurrentPostver(event) {
    if (confirm(CURRENT_POSTVER_CONFIRM)) {
        JSPLib.danbooru.submitRequest('post_versions', {limit: 1}, null, false, null, NTISAS.domain, true).then((data)=>{
            if (Array.isArray(data) && data.length > 0) {
                JSPLib.storage.setStorageData('ntisas-postver-lastid', data[0].id, localStorage);
                JSPLib.storage.setStorageData('ntisas-recent-timestamp', new Date(data[0].updated_at).getTime(), localStorage);
                Danbooru.Utility.notice("Finished updating record position!");
                InitializeCurrentRecords();
                NTISAS.channel.postMessage({type: 'currentrecords'});
            }
        });
    }
    event.preventDefault();
}

function QueryTotalRecords(event) {
    GetTotalRecords(true).then((length)=>{
        $('#ntisas-total-records').html(length);
        Danbooru.Utility.notice("Finished updating record count!");
    });
}

function CheckURL(event) {
    let [$link,$tweet,tweet_id,,screen_name,,,] = GetEventPreload(event, 'ntisas-check-url');
    $link.removeClass('ntisas-check-url').html("loading…");
    let normal_url = `https://twitter.com/${screen_name}/status/${tweet_id}`;
    let wildcard_url = `https://twitter.com/*/status/${tweet_id}`;
    let check_url = (NTISAS.user_settings.URL_wildcards_enabled ? wildcard_url : normal_url);
    CheckURL.debuglog(check_url);
    JSPLib.danbooru.submitRequest('posts', {tags: 'source:' + check_url, only: POST_FIELDS}, [], false, null, NTISAS.domain, true).then((data)=>{
        let post_ids = [];
        if (data.length === 0) {
            NTISAS.no_url_results.push(tweet_id);
        } else {
            let mapped_posts = MapPostData(data);
            SavePosts(mapped_posts);
            SavePostUsers(mapped_posts);
            post_ids = JSPLib.utility.setUnique(JSPLib.utility.getObjectAttributes(data, 'id'));
            if (NTISAS.merge_results.includes(tweet_id)) {
                let merge_ids = JSPLib.storage.getStorageData('tweet-' + tweet_id, sessionStorage, []);
                post_ids = JSPLib.utility.setUnion(merge_ids, post_ids);
            }
            SaveData('tweet-' + tweet_id, post_ids, 'twitter');
        }
        UpdatePostIDsLink(tweet_id, post_ids);
        NTISAS.channel.postMessage({type: 'postlink', tweet_id: tweet_id, post_ids: post_ids});
        if (data.length === 0 && NTISAS.user_settings.autocheck_IQDB_enabled) {
            $('.ntisas-check-iqdb', $tweet[0]).click();
        }
    });
}

async function CheckIQDB(event) {
    let pick = await PickImage(event, 'iqdb', (()=>!IsIQDBAutoclick()));
    if (!pick) {
        return;
    }
    let [$link,$tweet,tweet_id,$replace,selected_image_urls] = pick;
    let promise_array = selected_image_urls.map(image_url => JSPLib.danbooru.submitRequest('iqdb_queries', {url: image_url, similarity: NTISAS.user_settings.similarity_cutoff, limit: NTISAS.user_settings.results_returned}, [], false, null, NTISAS.domain, true));
    let all_iqdb_results = await Promise.all(promise_array);
    let flat_data = all_iqdb_results.flat();
    let similar_data = [];
    if (flat_data.length) {
        CheckIQDB.debuglog(`Found ${flat_data.length} results.`);
        let post_data = JSPLib.utility.getObjectAttributes(flat_data, 'post');
        let unique_posts = RemoveDuplicates(post_data, 'id');
        let mapped_posts = MapPostData(unique_posts);
        let uploader_ids = JSPLib.utility.setUnique(JSPLib.utility.getObjectAttributes(mapped_posts, 'uploaderid'));
        let [user_data, network_users] = await GetItems(uploader_ids, 'user', 'users');
        user_data = user_data.concat(network_users);
        mapped_posts.forEach((post)=>{
            let user = user_data.find((user) => (user.id === post.uploaderid));
            post.uploadername = user.name;
        });
        SavePosts(mapped_posts);
        SaveUsers(network_users);
        similar_data = all_iqdb_results.map((image_result)=>{
            let filter_results = image_result.filter(result => (parseFloat(result.score) >= NTISAS.user_settings.similarity_cutoff));
            let sorted_results = filter_results.sort((resulta,resultb) => (resulta.score - resultb.score)).slice(0, NTISAS.user_settings.results_returned);
            return sorted_results.map((result)=>{
                let score = result.score;
                let post_id = result.post.id;
                let post = mapped_posts.find((post) => (post.id === post_id));
                return MapSimilar(post, score);
            });
        });
    } else {
        CheckIQDB.debuglog("Found no results.");
    }
    ProcessSimilarData('iqdb', tweet_id, $tweet, $replace, selected_image_urls, similar_data, (()=>IsIQDBAutoclick()));
}

async function CheckSauce(event) {
    if (!NTISAS.user_settings.SauceNAO_API_key) {
        Danbooru.Utility.error("<b>Error!</b> Must set SauceNAO API key in user settings.");
        return;
    }
    let pick = await PickImage(event, 'sauce');
    if (!pick) {
        return;
    }
    let [$link,$tweet,tweet_id,$replace,selected_image_urls] = pick;
    let promise_array = selected_image_urls.map(image_url => JSPLib.saucenao.getSauce(image_url, JSPLib.saucenao.getDBIndex('danbooru'), NTISAS.user_settings.results_returned));
    let all_data = await Promise.all(promise_array);
    let good_data = all_data.filter(data => JSPLib.saucenao.checkSauce(data));
    let combined_data = JSPLib.utility.getObjectAttributes(good_data, 'results');
    let flat_data = combined_data.flat();
    let filtered_data = flat_data.filter(result => (parseFloat(result.header.similarity) >= NTISAS.user_settings.similarity_cutoff));
    let similar_data = [];
    if (filtered_data.length) {
        CheckSauce.debuglog(`Found ${filtered_data.length} results.`);
        let danbooru_ids = JSPLib.utility.setUnique(JSPLib.utility.getNestedObjectAttributes(filtered_data, ['data', 'danbooru_id']));
        var posts_data = await GetPosts(danbooru_ids);
        similar_data = combined_data.map((image_result)=>{
            let filter_results = image_result.filter(result => (parseFloat(result.header.similarity) >= NTISAS.user_settings.similarity_cutoff));
            let sorted_results = filter_results.sort((resulta,resultb) => (resulta.score - resultb.score)).slice(0, NTISAS.user_settings.results_returned);
            return sorted_results.map((result)=>{
                let score = parseFloat(result.header.similarity);
                let post_id = result.data.danbooru_id;
                let post = posts_data.find((post) => (post.id === post_id));
                return MapSimilar(post, score);
            });
        });
    } else {
        CheckSauce.debuglog("No results found.");
    }
    ProcessSimilarData('sauce', tweet_id, $tweet, $replace, selected_image_urls, similar_data);
}

function ManualAdd(event) {
    let [$link,$tweet,tweet_id,,,,,$replace] = GetEventPreload(event, 'ntisas-manual-add');
    PromptSavePostIDs($link, $tweet, tweet_id, $replace, MANUAL_ADD_PROMPT, []);
}

function ConfirmSave(event) {
    let type = $(event.target).data('type');
    if (!IsQuerySettingEnabled('confirm_save', type)) {
        return;
    }
    let [$link,$tweet,tweet_id,,,,,$replace] = GetEventPreload(event, 'ntisas-confirm-save');
    let select_post_ids = GetSelectPostIDs(tweet_id, 'tweet_qtip');
    let all_post_ids = NTISAS.similar_results[tweet_id];
    let save_post_ids = JSPLib.utility.setDifference(all_post_ids, select_post_ids);
    if (NTISAS.merge_results.includes(tweet_id)) {
        let merge_ids = JSPLib.storage.getStorageData('tweet-' + tweet_id, sessionStorage, []);
        save_post_ids = JSPLib.utility.setUnion(merge_ids, save_post_ids);
    }
    PromptSavePostIDs($link, $tweet, tweet_id, $replace, CONFIRM_SAVE_PROMPT, save_post_ids);
    event.preventDefault();
}

function ConfirmDelete(event) {
    if (!NTISAS.user_settings.confirm_delete_enabled) {
        return;
    }
    let [$link,$tweet,tweet_id,,,,,$replace] = GetEventPreload(event, 'ntisas-confirm-delete');
    let delete_all = $('.ntisas-delete-all', NTISAS.tweet_qtip[tweet_id]).prop('checked');
    let all_post_ids = JSPLib.storage.getStorageData('tweet-' + tweet_id, sessionStorage, []);
    if (delete_all) {
        var select_post_ids = all_post_ids;
    } else {
        select_post_ids = GetSelectPostIDs(tweet_id, 'tweet_qtip');
    }
    let save_post_ids = JSPLib.utility.setDifference(all_post_ids, select_post_ids);
    let message = JSPLib.utility.sprintf(CONFIRM_DELETE_PROMPT, select_post_ids);
    PromptSavePostIDs($link, $tweet, tweet_id, $replace, message, save_post_ids);
    event.preventDefault();
}

function ResetResults(event) {
    let [$link,,tweet_id,,,,,$replace] = GetEventPreload(event, 'ntisas-reset-results');
    let type = $link.data('type');
    RemoveData(type + '-' + tweet_id, 'danbooru');
    InitializeNoMatchesLinks(tweet_id, $replace);
}

function MergeResults(event) {
    let [,$tweet,tweet_id,,,,,$replace] = GetEventPreload(event, 'ntisas-merge-results');
    NTISAS.merge_results = JSPLib.utility.setUnion(NTISAS.merge_results, [tweet_id]);
    $('.ntisas-database-match', $tweet[0]).qtiptisas('destroy', true);
    InitializeNoMatchesLinks(tweet_id, $replace, true);
}

function CancelMerge(event) {
    let [,$tweet,tweet_id,,,,,$replace] = GetEventPreload(event, 'ntisas-cancel-merge');
    NTISAS.merge_results = JSPLib.utility.setDifference(NTISAS.merge_results, [tweet_id]);
    let post_ids = JSPLib.storage.getStorageData('tweet-' + tweet_id, sessionStorage, []);
    InitializePostIDsLink(tweet_id, $replace, $tweet[0], post_ids);
}

function SelectPreview(event) {
    let $container = $(event.target).closest('.ntisas-qtip-container');
    if ($container.hasClass('ntisas-similar-results')) {
        let type = $container.data('type');
        if (!IsQuerySettingEnabled('confirm_save', type)) {
            return;
        }
    } else if ($container.hasClass('ntisas-post-result') && !NTISAS.user_settings.confirm_delete_enabled) {
        return
    }
    $(event.currentTarget).closest('.ntisas-post-preview').toggleClass('ntisas-post-select');
    event.preventDefault();
}

function HelpInfo(event) {
    let help_text = $(event.target).attr('title');
    alert(help_text);
}

function ErrorMessages(event) {
    if (JSPLib.network.error_messages.length) {
        let help_text = JSPLib.network.error_messages.map(entry => `HTTP Error ${entry[1]}: ${entry[2]}<br>&emsp;&emsp;=> ${entry[0]}`).join('<br><br>');
        Danbooru.Utility.error(help_text);
    } else {
        Danbooru.Utility.notice("No error messages!");
    }
}

function ToggleLock(event) {
    if (NTISAS.page_locked) {
        $(window).off('beforeunload.ntisas.lock_page');
    } else {
        $(window).on('beforeunload.ntisas.lock_page',()=>{return ""});
    }
    $('#ntisas-enable-lockpage, #ntisas-disable-lockpage').toggle();
    NTISAS.page_locked = !NTISAS.page_locked;
}

function SelectMetric(event) {
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
        Danbooru.Utility.notice("Must select category combinations with at least one tweet!");
    }
}

function MarkArtist(event) {
    let [$link,$tweet,,,,,all_idents,] = GetEventPreload(event, 'ntisas-mark-artist');
    let artist_list = GetList('artist-list');
    if (JSPLib.utility.hasIntersection(artist_list, all_idents)) {
        artist_list = JSPLib.utility.setDifference(artist_list, all_idents);
    } else {
        artist_list = JSPLib.utility.setUnion(artist_list, all_idents);
    }
    SaveList('artist-list', artist_list);
    $link.toggleClass('ntisas-activated');
    $('.ntisas-indicators .ntisas-mark-artist', $tweet[0]).toggle();
    setTimeout(UpdateTweetIndicators, JQUERY_DELAY);
    NTISAS.channel.postMessage({type: 'indicators', artist_list: artist_list});
}

function MarkTweet(event) {
    let [$link,$tweet,tweet_id,,,,,] = GetEventPreload(event, 'ntisas-mark-tweet');
    let tweet_list = GetList('tweet-list');
    if (tweet_list.includes(tweet_id)) {
        tweet_list = JSPLib.utility.setDifference(tweet_list, [tweet_id]);
    } else {
        tweet_list = JSPLib.utility.setUnion(tweet_list, [tweet_id]);
    }
    SaveList('tweet-list', tweet_list);
    $link.toggleClass('ntisas-activated');
    $('.ntisas-indicators .ntisas-mark-tweet', $tweet[0]).toggle();
    NTISAS.channel.postMessage({type: 'indicators', tweet_list: tweet_list});
}

function CountArtist(event) {
    let [$link,$tweet,,,,user_ident,,] = GetEventPreload(event, 'ntisas-count-artist');
    if (NTISAS.counted_artists.includes(user_ident)) {
        NTISAS.counted_artists = JSPLib.utility.setDifference(NTISAS.counted_artists, [user_ident]);
    } else {
        NTISAS.counted_artists = JSPLib.utility.setUnion(NTISAS.counted_artists, [user_ident]);
    }
    $link.toggleClass('ntisas-activated');
    $('.ntisas-indicators .ntisas-count-artist', $tweet[0]).toggle();
    setTimeout(UpdateTweetIndicators, JQUERY_DELAY);
    $('#ntisas-indicator-counter .ntisas-count-artist').html(NTISAS.counted_artists.length);
}

function CountTweet(event) {
    let [$link,$tweet,tweet_id,,,,,] = GetEventPreload(event, 'ntisas-count-tweet');
    if (NTISAS.counted_tweets.includes(tweet_id)) {
        NTISAS.counted_tweets = JSPLib.utility.setDifference(NTISAS.counted_tweets, [tweet_id]);
    } else {
        NTISAS.counted_tweets = JSPLib.utility.setUnion(NTISAS.counted_tweets, [tweet_id]);
    }
    $link.toggleClass('ntisas-activated');
    $('.ntisas-indicators .ntisas-count-tweet', $tweet[0]).toggle();
    $('#ntisas-indicator-counter .ntisas-count-tweet').html(NTISAS.counted_tweets.length);
}

function DownloadOriginal(event) {
    let [$link,,,,,,,] = GetEventPreload(event, 'ntisas-download-original');
    let image_link = $link.attr('href');
    let download_name = $link.attr('download');
    DownloadOriginal.debuglog("Saving", image_link, "as", download_name);
    saveAs(image_link, download_name);
    event.preventDefault();
}

function DownloadAll(event) {
    let [,$tweet,,,,,,] = GetEventPreload(event, 'ntisas-download-all');
    $('.ntisas-download-original', $tweet[0]).click();
}

function ResetLists(event) {
    let selected_lists = JSPLib.menu.getCheckboxRadioSelected('[data-setting="select_list"] [data-selector]');
    if (selected_lists.length === 0) {
        Danbooru.Utility.notice("Must select at least one list!");
    } else {
        selected_lists.forEach((list)=>{
            SaveList(ALL_LISTS[list], [], false);
        });
        UpdateHighlightControls();
        UpdateArtistHighlights();
        UpdateIQDBControls();
        UpdateTweetIndicators();
        Danbooru.Utility.notice("Lists have been reset!");
    }
}

function ExportData(event) {
    let export_types = JSPLib.menu.getCheckboxRadioSelected('[data-setting="export_types"] [data-selector]');
    if (export_types.length === 0) {
        Danbooru.Utility.notice("Must select at least one export type!");
    } else if (!ExportData.is_running) {
        ExportData.is_running = true;
        Danbooru.Utility.notice("Exporting data!");
        TIMER.GetSavePackage(export_types).then((save_package)=>{
            let export_addon = export_types.map(type => `[${type}]`).join('-');
            let time_addon = GetNumericTimestamp(Date.now());
            let filename = `NTISAS-${export_addon}-${time_addon}.json`;
            DownloadObject(save_package, filename, true);
            ExportData.is_running = false;
        });
    }
    event.preventDefault();
}
ExportData.is_running = false;

function ImportData(event) {
    if (!ImportData.is_running) {
        ImportData.is_running = true;
        ReadFileAsync('#ntisas-import-file', true).then((import_package)=>{
            Danbooru.Utility.notice("Importing data!");
            let promise_array = [];
            if ('program_data' in import_package) {
                ImportData.debuglog("Program data:" ,import_package.program_data);
                Object.keys(import_package.program_data).forEach((key)=>{
                    //For backwards compatibility
                    let store_key = key.replace(/^tisas-/, 'ntisas-');
                    JSPLib.storage.setStorageData(store_key, import_package.program_data[key], localStorage);
                });
            }
            if ('database_info' in import_package) {
                ImportData.debuglog("Database info:", import_package.database_info);
                promise_array.push(JSPLib.storage.saveData('ntisas-database-info', import_package.database_info, JSPLib.storage.twitterstorage));
                ImportData.debuglog("Database length:", Object.keys(import_package.tweet_database).length);
                promise_array.push(TIMER.SaveDatabase(import_package.tweet_database, '#ntisas-import-counter'));
                Promise.all(promise_array).then(()=>{
                    InitializeDatabase();
                    ImportData.is_running = false;
                });
            }
        }).catch((error)=>{
            ImportData.is_running = false;
        });
    }
    event.preventDefault();
}
ImportData.is_running = false;

//Event execute functions

function AutoclickIQDB() {
    if (NTISAS.artist_iqdb_enabled && IsMediaTimeline()) {
        $('.ntisas-check-iqdb').click();
    } else if (IsTweetPage()) {
        $(`.ntisas-main-tweet[data-tweet-id=${NTISAS.tweet_id}] .ntisas-check-iqdb`).click();
    }
}

function UnhideTweets() {
    let $hidden_tweets = $('.ntisas-hidden-media [role=button]');
    if ($hidden_tweets.length) {
        UnhideTweets.debuglog("Found hidden tweets:", $hidden_tweets.length);
        $hidden_tweets.click();
    }
}

//Markup tweet functions

function MarkupMediaType(tweet) {
    if ($('[src*="/card_img/"], span > svg', tweet).length) {
        $('.ntisas-tweet-media', tweet).addClass('ntisas-tweet-card').removeClass('ntisas-tweet-media');
    } else if ($('[role=progressbar]', tweet).length) {
        MarkupMediaType.debuglog("Delaying media check for", $(tweet).data('tweet-id'));
        let timer = setInterval(()=>{
            if ($('[role=progressbar]', tweet).length === 0) {
                clearInterval(timer);
                MarkupMediaType(tweet);
            }
        }, TIMER_POLL_INTERVAL);
    } else {
        let media_children = $('.ntisas-tweet-media', tweet).children().children();
        media_children.each((i,entry)=>{
            let $entry = $(entry);
            if ($entry.children().length === 0) {
                $entry.addClass('ntisas-media-stub');
            } else if ($('[role=blockquote]', entry).length) {
                $entry.addClass('ntisas-tweet-quote');
            } else if ($('video, [data-testid=playButton]', tweet).length) {
                $entry.addClass('ntisas-tweet-video');
            } else {
                $entry.addClass('ntisas-tweet-image');
            }
        });
    }
}

function MarkupStreamTweet(tweet) {
    try {
    let status_link = $('time', tweet).parent();
    let [,screen_name,,tweet_id] = status_link[0].pathname.split('/');
    $(tweet).addClass('ntisas-stream-tweet');
    $(tweet).attr('data-tweet-id', tweet_id);
    $(tweet).attr('data-screen-name', screen_name);
    //Get API data if available
    let data_tweet = GetAPIData('tweets', tweet_id);
    if (data_tweet) {
        $(tweet).attr('data-user-id', data_tweet.user_id_str);
    }
    //Not marking this with a a class since Twitter alters it
    let article = tweet.children[0].children[0];
    let main_body = article.children[0];
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
    let profile_line = tweet_right.children[0];
    $(profile_line).addClass('ntisas-profile-line');
    let sub_body = tweet_right.children[1];
    $(sub_body).addClass('ntisas-sub-body');
        let child_count = sub_body.childElementCount;
    let tweet_menu_index = child_count - 1;
    if (sub_body.children[tweet_menu_index].children[0].tagName.toUpperCase() === 'SVG') {
        let promoted_line = sub_body.children[child_count - 1];
        $(promoted_line).addClass('ntisas-promoted-line');
        tweet_menu_index = child_count - 2;
    }
    let tweet_menu = sub_body.children[tweet_menu_index];
    $(tweet_menu).addClass('ntisas-tweet-actions');
    $('[data-testid="reply"]', tweet_menu).parent().addClass('ntisas-reply');
    $('[data-testid="retweet"]', tweet_menu).parent().addClass('ntisas-retweet');
    $('[data-testid="like"]', tweet_menu).parent().addClass('ntisas-like');
    $('[role="button"]:not([data-testid])', tweet_menu).parent().addClass('ntisas-share');
    let reply_line_count = 0;
    let child1 = sub_body.children[0];
    if (child1.children[0] && child1.children[0].tagName.toUpperCase() === 'DIV' && child1.innerText.match(/^Replying to/)) {
        $(child1).addClass('ntisas-reply-line');
        reply_line_count = 1;
    }
    var has_media = false;
    if (tweet_menu_index === (2 + reply_line_count)) {
        let tweet_text = sub_body.children[0 + reply_line_count];
        $(tweet_text).addClass('ntisas-tweet-text');
        let tweet_image = sub_body.children[1 + reply_line_count];
        if (tweet_image.childElementCount > 0) {
            $(tweet_image).addClass('ntisas-tweet-media');
            has_media = true;
        } else {
            $(tweet_image).addClass('ntisas-empty-media');
            has_media = false;
        }
    } else if (tweet_menu_index === (1 + reply_line_count)) {
        let element = sub_body.children[0 + reply_line_count];
        has_media = !element.children[0].children[0] || element.children[0].children[0].tagName.toUpperCase() !== 'SPAN';
        let element_class = (has_media ? 'ntisas-tweet-media' : 'ntisas-tweet-text');
        $(element).addClass(element_class);
    }
    if (has_media) {
        CheckHiddenMedia(tweet);
    }
    } catch (e) {
        MarkupStreamTweet.debuglog(e, tweet);
        if (JSPLib.debug.debug_console) {
            Danbooru.Utility.error("Error marking up stream tweet! (check debug console for details)", false);
        }
    }
}

function MarkupMainTweet(tweet) {
    try {
    $(tweet).addClass('ntisas-main-tweet');
    $(tweet).attr('data-tweet-id', NTISAS.tweet_id);
    //Get API data if available
    let data_tweet = GetAPIData('tweets', NTISAS.tweet_id);
    if (data_tweet) {
        $(tweet).attr('data-user-id', data_tweet.user_id_str);
    }
    let main_body = tweet.children[0].children[0].children[0];
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
    let reply_line_count = 0;
    let child2 = main_body.children[2];
    if (child2.children[0]
      && child2.children[0].tagName.toUpperCase() !== 'SPAN'
      && child2.children[0].children[0]
      && child2.children[0].children[0].tagName.toUpperCase() !== 'SPAN'
      && child2.innerText.match(/^Replying to/)) {
        $(child2).addClass('ntisas-reply-line');
        reply_line_count = 1;
    }
    let sub_body = main_body.children[2];
    $(sub_body).addClass('ntisas-sub-body');
    let tweet_menu_index = sub_body.childElementCount - 1;
    let tweet_menu = sub_body.children[tweet_menu_index];
    $(tweet_menu).addClass('ntisas-tweet-actions');
    let retweet_like_count = 0;
    let childn1 = sub_body.children[tweet_menu_index - 1];
    if ($('[href$="/retweets"]', childn1).length || $('[href$="/likes"]', childn1).length) {
        retweet_like_count = 1;
        $(childn1).addClass('ntisas-retweets-likes');
    }
    let time_line = sub_body.children[tweet_menu_index - 1 - retweet_like_count]
    $(time_line).addClass('ntisas-time-line');
    let remaining_lines = tweet_menu_index - 1 - retweet_like_count - reply_line_count;
    var has_media = false;
    if (remaining_lines === 2) {
        let tweet_text = sub_body.children[reply_line_count];
        $(tweet_text).addClass('ntisas-tweet-text');
        let tweet_image = sub_body.children[1 + reply_line_count];
        $(tweet_image).addClass('ntisas-tweet-media');
        has_media = true;
    } else if (remaining_lines === 1) {
        let element = sub_body.children[reply_line_count];
        has_media = element.children[0].tagName.toUpperCase() !== 'SPAN' && element.children[0].children[0].tagName.toUpperCase() !== 'SPAN';
        let element_class = (has_media ? 'ntisas-tweet-media' : 'ntisas-tweet-text');
        $(element).addClass(element_class);
    }
    if (has_media) {
        CheckHiddenMedia(tweet);
    }
    } catch (e) {
        MarkupMainTweet.debuglog(e, tweet);
        if (JSPLib.debug.debug_console) {
            Danbooru.Utility.error("Error marking up main tweet! (check debug console for details)", false);
        }
    }
}

function CheckHiddenMedia(tweet) {
    tweet.ntisasDeferred = $.Deferred();
    if ($('.ntisas-tweet-media', tweet).text().match(/The following media includes potentially sensitive content/)) {
        $('.ntisas-tweet-media', tweet).addClass('ntisas-hidden-media');
        $('.ntisas-tweet-media [role=button]', tweet).one(PROGRAM_CLICK, (event)=>{
            $('.ntisas-tweet-media', tweet).removeClass('ntisas-hidden-media');
            setTimeout(()=>{
                MarkupMediaType(tweet);
            }, TWITTER_DELAY);
        });
    } else {
        MarkupMediaType(tweet);
    }
}

//Main execution functions

function RegularCheck() {
    if (!NTISAS.user_id && API_DATA.has_data && NTISAS.account && (NTISAS.account in API_DATA.users_name)) {
        NTISAS.user_id = GetAPIData('users_name', NTISAS.account, 'id_str');
        UpdateHighlightControls();
        UpdateViewControls();
        UpdateIQDBControls();
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
    } else {
        NTISAS.photo_navigation = false;
    }

    //Process events on a page change
    PageNavigation(pagetype);

    //Process events at each interval
    if (!NTISAS.colors_checked || window.location.pathname === '/i/display') {
        AdjustColorScheme();
    }
    if (NTISAS.user_settings.autoclick_IQDB_enabled) {
        AutoclickIQDB();
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
    let page_key = JSPLib.utility.setUnique(
        Object.values(NTISAS.page_match).filter((val)=>{
            return typeof val === "string" && !val.startsWith('https:');
        })
    ).join(',');
    if (NTISAS.page === pagetype && NTISAS.page_key === page_key && (pagetype !== 'hashtag' || NTISAS.hashtag_search === window.location.search)) {
        return;
    }
    var params;
    let account = NTISAS.page_match[pagetype + '_account'];
    let page_id = NTISAS.page_match[pagetype + '_id'];
    NTISAS.prev_page = NTISAS.page;
    NTISAS.page = pagetype;
    NTISAS.page_key = page_key;
    switch (NTISAS.page) {
        case 'main':
        case 'media':
        case 'likes':
        case 'replies':
            PageNavigation.debuglog(`User timeline [${NTISAS.page}]:`, account);
            NTISAS.account = account;
            NTISAS.user_id = GetAPIData('users_name', NTISAS.account, 'id_str');
            if (NTISAS.account === 'following' || NTISAS.account === 'lists') {
                return;
            }
            break;
        case 'home':
        case 'list':
        case 'moment':
            PageNavigation.debuglog(`Stream timeline [${NTISAS.page}]:`, page_id || "n/a");
            NTISAS.account = NTISAS.user_id = undefined;
            break;
        case 'hashtag':
            PageNavigation.debuglog("Hashtag timeline:", NTISAS.page_match.hashtag_hash);
            NTISAS.account = NTISAS.user_id = undefined;
            NTISAS.hashtag_search = window.location.search;
            break;
        case 'search':
            PageNavigation.debuglog("Search timeline:", NTISAS.page_match.search_query);
            params = JSPLib.utility.parseParams(NTISAS.page_match.search_query);
            NTISAS.queries = ParseQueries(params.q);
            NTISAS.account = ('from' in NTISAS.queries ? NTISAS.queries.from : undefined);
            NTISAS.user_id = NTISAS.account && GetAPIData('users_name', NTISAS.account, 'id_str');
            break;
        case 'tweet':
        case 'web_tweet':
            PageNavigation.debuglog("Tweet ID:", page_id);
            NTISAS.screen_name = account;
            NTISAS.tweet_id = page_id;
            NTISAS.account = NTISAS.user_id = undefined;
            break;
        case 'display':
            PageNavigation.debuglog("Twitter display settings");
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
            GetTotalRecords().then((total)=>{
                $('#ntisas-records-stub').replaceWith(`<a id="ntisas-total-records" class="ntisas-expanded-link">${total}</a>`);
                $('#ntisas-total-records').on(PROGRAM_CLICK, QueryTotalRecords);
            });
        }
        //Bind events for creation/rebind
        if (!JSPLib.utility.isNamespaceBound('#ntisas-open-settings', 'click', PROGRAM_SHORTCUT)) {
            $('#ntisas-current-records').on(PROGRAM_CLICK, CurrentRecords);
            $('#ntisas-artist-toggle a').on(PROGRAM_CLICK, ToggleArtistHilights);
            $('#ntisas-views-toggle a').on(PROGRAM_CLICK, ToggleViewHighlights);
            $('#ntisas-increase-fade-level').on(PROGRAM_CLICK, IncreaseFadeLevel);
            $('#ntisas-decrease-fade-level').on(PROGRAM_CLICK, DecreaseFadeLevel);
            $('#ntisas-increase-hide-level').on(PROGRAM_CLICK, IncreaseHideLevel);
            $('#ntisas-decrease-hide-level').on(PROGRAM_CLICK, DecreaseHideLevel);
            $('#ntisas-iqdb-toggle a').on(PROGRAM_CLICK, ToggleAutoclickIQDB);
            $('#ntisas-indicator-toggle a').on(PROGRAM_CLICK, ToggleTweetIndicators);
            $('#ntisas-open-settings').on(PROGRAM_CLICK, OpenSettingsMenu);
            //These will only get bound here on a rebind
            $('#ntisas-database-version').on(PROGRAM_CLICK, CurrentPostver);
            $('#ntisas-install').on(PROGRAM_CLICK, InstallDatabase);
            $('#ntisas-upgrade').on(PROGRAM_CLICK, UpgradeDatabase);
            $('#ntisas-total-records').on(PROGRAM_CLICK, QueryTotalRecords);
            $('#ntisas-error-messages').on(PROGRAM_CLICK, ErrorMessages);
            $('#ntisas-lockpage-toggle a').on(PROGRAM_CLICK, ToggleLock);
        }
        InitializeCounter();
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
    }
    UpdateHighlightControls();
    UpdateViewControls();
    UpdateIQDBControls();
    UpdateIndicatorControls();
    SetCheckPostvers();
    //Tweets are not available upon page load, so don't bother processing them
    if (NTISAS.prev_pagetype !== undefined) {
        UpdateArtistHighlights();
        UpdateTweetIndicators();
    }
}

function ProcessPhotoPopup() {
    let $photo_container = $('#layers');
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

function ProcessTweetImage(obj,image_url,unprocessed_tweets) {
    if (image_url) {
        $(obj.parentElement).attr('data-image-url', image_url);
        let $tweet = $(obj).closest('.ntisas-tweet');
        let tweet_id = $tweet.data('tweet-id');
        if (!(tweet_id in unprocessed_tweets)) {
            unprocessed_tweets[tweet_id] = $tweet;
        }
    } else {
        $(obj).addClass('ntisas-unhandled-image');
        JSPLib.debug.debugExecute(()=>{
            if (JSPLib.validate.isBoolean(image_url)) {
                Danbooru.Utility.notice("New unhandled image found (see debug console)");
                ProcessTweetImage.debuglog("Unhandled image", $(obj).closest('.ntisas-tweet').data('tweet-id'));
            }
        });
    }
}

function ProcessTweetImages() {
    let $unprocessed_images = $('.ntisas-tweet-media > div > div:not(.ntisas-tweet-quote) div:not([data-image-url]) > img:not(.ntisas-unhandled-image)');
    if ($unprocessed_images.length) {
        ProcessTweetImages.debuglog("Images found:", $unprocessed_images.length);
    }
    let unprocessed_tweets = {};
    $unprocessed_images.each((i,image)=>{
        let image_url = GetNormalImageURL(image.src);
        ProcessTweetImage(image, image_url, unprocessed_tweets);
    });
    //Only gets executed when videos are autoplay. Otherwise videos get found as images above.
    let $unprocessed_videos = $('.ntisas-tweet-media > div:not(.ntisas-tweet-quote) div:not([data-image-url]) > video');
    if ($unprocessed_videos.length) {
        ProcessTweetImages.debuglog("Videos found:", $unprocessed_videos.length);
    }
    $unprocessed_videos.each((i,video)=>{
        let image_url = video.poster;
        ProcessTweetImage(video, image_url, unprocessed_tweets);
    });
    let $main_tweet = null;
    for (let tweet_id in unprocessed_tweets) {
        let $tweet = unprocessed_tweets[tweet_id];
        let is_main_tweet = $tweet.hasClass('ntisas-main-tweet');
        $tweet.find('[data-image-url]').each((i,entry)=>{
            $(entry).attr('data-image-num', i + 1);
            if (is_main_tweet) {
                $(entry.parentElement).on('mouseenter.ntisas', ImageEnter);
                $(entry.parentElement).on('mouseleave.ntisas', ImageLeave);
            }
        });
        if (is_main_tweet) {
            $main_tweet = $tweet;
        }
    };
    let total_unprocessed = Object.keys(unprocessed_tweets).length;
    if (total_unprocessed > 0) {
        ProcessTweetImages.debuglog("Tweets updated:", total_unprocessed);
    }
    if (IsTweetPage() && $main_tweet) {
        //Trigger download links to start initializing
        let tweet_deferred = $main_tweet.prop('ntisasDeferred');
        if (tweet_deferred) {
            tweet_deferred.resolve();
        }
    }
}

function ProcessNewTweets() {
    //Use the article HTML element as a landmark for locating tweets
    let $tweet_articles = $('div[data-testid=primaryColumn] div:not(.ntisas-tweet) > div > article');
    //Get the highest delineation point between tweets that Twitter doesn't alter through events
    let $tweets = $tweet_articles.map((i,entry) => entry.parentElement.parentElement);
    if ($tweets.length === 0) {
        return false;
    }
    NTISAS.uniqueid = JSPLib.utility.getUniqueID();
    ProcessNewTweets.debuglog(NTISAS.uniqueid);
    $tweets.each((i,entry)=>{
        $(entry).addClass('ntisas-tweet');
        if ($('a > time', entry).length) {
            MarkupStreamTweet(entry);
        } else if (IsTweetPage() && $('article > div > div', entry).children().length > 2) {
            MarkupMainTweet(entry);
        }
    });
    let $image_tweets = $tweets.filter((i,entry) => $('.ntisas-tweet-image, .ntisas-tweet-video', entry).length);
    ProcessNewTweets.debuglog(`[${NTISAS.uniqueid}]`, "Unprocessed:", $tweets.length, $image_tweets.length);
    //Initialize tweets with images
    if ($image_tweets.length) {
        InitializeImageTweets($image_tweets);
        if (NTISAS.user_settings.display_view_count) {
            $image_tweets.each((i,entry)=>{
                InitializeViewCount(entry);
            });
        }
    }
    if (NTISAS.user_settings.tweet_indicators_enabled) {
        $tweets.each((i,entry)=>{
            InitializeTweetIndicators(entry);
        });
        UpdateTweetIndicators();
    }
    if (NTISAS.user_settings.display_retweet_id && API_DATA.has_data && IsPageType(['main'])) {
        let $retweets = $tweets.filter('[data-retweet-id]');
        $retweets.each((i,entry)=>{
            InitializeRetweetDisplay(entry);
        });
    }
    if (NTISAS.user_settings.display_user_id && API_DATA.has_data && IsTweetPage()) {
        InitializeUserDisplay($tweets);
    }
    return true;
}

function AdjustColorScheme() {
    const compareColors = (result,val,key) => (String(NTISAS.colors[key]) !== String(val));
    let $tweet_button = $('[data-testid=SideNav_NewTweet_Button]');
    let $home_button = $('[data-testid=AppTabBar_More_Menu] > div > div').filter((i,entry) => entry.children[0].tagName === 'SPAN');
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
            JSPLib.storage.setStorageData('ntisas-color-style', NTISAS.colors, localStorage);
        }
    }
}

function HighlightTweets() {
    var $tweets = $('.ntisas-tweet:not(.ntisas-highlight)');
    $tweets.each((i,entry)=>{
        var $entry = $(entry);
        $entry.addClass('ntisas-highlight');
        var tweetid = String($entry.data('tweet-id'));
        if (NTISAS.tweet_pos.includes(tweetid)) {
            return;
        }
        NTISAS.tweet_pos.push(tweetid);
        var favorites = GetTweetStat(entry, ['like','unlike']);
        NTISAS.tweet_faves.push(favorites);
    });
    HighlightTweets.debuglog("Tweets:", NTISAS.tweet_pos);
    HighlightTweets.debuglog("Faves:", NTISAS.tweet_faves);
    HighlightTweets.debuglog("Finish:", NTISAS.tweet_finish);
    var current_count = Object.assign(...ALL_SCORE_LEVELS.map(level => ({[level]: 0})));
    var visible_tweetids = JSPLib.utility.getDOMAttributes($('.ntisas-tweet'), 'tweet-id', String);
    NTISAS.tweet_pos.forEach((tweetid)=>{
        let quartile = GetTweetQuartile(tweetid);
        let level = ALL_SCORE_LEVELS[quartile];
        current_count[level]++;
        if (visible_tweetids.includes(tweetid)) {
            let $tweet = $(`.ntisas-tweet[data-tweet-id=${tweetid}]`);
            $tweet.removeClass(JSPLib.utility.joinList(ALL_SCORE_LEVELS, 'ntisas-', null, ' ')).addClass(`ntisas-${level}`);
        }
    });
    UpdateArtistHighlights();
    HighlightTweets.debuglog("Excellent:", current_count.excellent, "Good:", current_count.good, "Above average:", current_count.aboveavg, "Fair:", current_count.fair, "Belowavg:", current_count.belowavg, "Poor:", current_count.poor);
}

function CollectTweetStats() {
    let are_new = false;
    let tweets_collected = JSPLib.utility.getObjectAttributes(NTISAS.tweet_stats, 'tweetid');
    $('.ntisas-tweet').each((i,entry)=>{
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
    BroadcastTISAS.debuglog(`(${ev.data.type}):`, ev.data);
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
            $(window).one('focus.ntisas.reload', ()=>{window.location.reload();});
            break;
        case 'currentrecords':
            InitializeCurrentRecords();
            break;
        case 'indicators':
            if ('artist_list' in ev.data && 'artist-list' in GetList && 'list' in GetList['artist-list']) {
                GetList['artist-list'].list = ev.data.artist_list;
            }
            if ('tweet_list' in ev.data &&'tweet-list' in GetList && 'list' in GetList['tweet-list']) {
                GetList['tweet-list'].list = ev.data.tweet_list;
            }
            UpdateIndicatorControls();
            UpdateTweetIndicators();
            break;
        case 'highlights':
            GetList['no-highlight-list'] = ev.data.list;
            UpdateHighlightControls();
            UpdateArtistHighlights();
            break;
        case 'autoiqdb':
            GetList['auto-iqdb-list'] = ev.data.list;
            UpdateIQDBControls();
            // falls through
        default:
            //do nothing
    }
}

function RemoteSettingsCallback() {
    InitializeChangedSettings();
}

function InitializeChangedSettings() {
    let $processed_tweets = $('.ntisas-tweet');
    $processed_tweets.each((i,tweet)=>{
        let $tweet = $(tweet);
        let tweet_id = String($tweet.data('tweet-id'));
        let $post_link = $('.ntisas-database-match', tweet);
        let post_ids = JSPLib.storage.getStorageData('tweet-' + tweet_id, sessionStorage, []);
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
        if (JSPLib.menu.hasSettingChanged('display_view_count')) {
            if (NTISAS.user_settings.display_view_count) {
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
        if (IsTweetPage() && (JSPLib.menu.hasSettingChanged('original_download_enabled') || JSPLib.menu.hasSettingChanged('download_position') || JSPLib.menu.hasSettingChanged('filename_prefix_format'))) {
            $('.ntisas-download-section', tweet).remove();
            if (NTISAS.user_settings.original_download_enabled) {
                InitializeDownloadLinks($tweet);
            }
        }
        if (JSPLib.menu.hasSettingChanged('tweet_indicators_enabled')) {
            if (NTISAS.user_settings.tweet_indicators_enabled) {
                InitializeTweetIndicators(tweet);
            } else {
                $('.ntisas-indicators', tweet).html("");
                $('.ntisas-footer-entries', tweet).remove();
            }
        }
        if ($post_link.length && ((post_ids.length > 1 && JSPLib.menu.hasSettingChanged('custom_order_enabled')) || JSPLib.menu.hasSettingChanged('delete_all_default') || JSPLib.menu.hasSettingChanged('merge_results_enabled'))) {
            $post_link.qtiptisas('destroy', true);
            InitializePostIDsLink(tweet_id, $post_link.parent(), tweet, post_ids);
        }
    });
    if (API_DATA.has_data && IsTweetPage() && JSPLib.menu.hasSettingChanged('display_user_id')) {
        if (NTISAS.user_settings.display_user_id) {
            InitializeUserDisplay($processed_tweets);
        } else {
            $('.ntisas-user-id').html("");
        }
    }
    if (JSPLib.menu.hasSettingChanged('auto_unhide_tweets_enabled') && NTISAS.user_settings.auto_unhide_tweets_enabled) {
        UnhideTweets();
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
    if (JSPLib.menu.hasSettingChanged('tweet_indicators_enabled')) {
        if (NTISAS.user_settings.tweet_indicators_enabled) {
            InitializeCounter();
        } else {
            $('#ntisas-indicator-counter').remove();
        }
    }
    if (JSPLib.menu.hasSettingChanged('lock_page_enabled')) {
        if (NTISAS.user_settings.lock_page_enabled && NTISAS.page_locked) {
            $(window).on('beforeunload.ntisas.lock_page', ()=>{return ""});
        } else {
            $(window).off('beforeunload.ntisas.lock_page');
        }
    }
    if (JSPLib.menu.hasSettingChanged('score_highlights_enabled') || JSPLib.menu.hasSettingChanged('score_window_size')) {
        $('.ntisas-highlight').removeClass('ntisas-highlight');
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
        $(`[href^="${old_domain}"]`).each((i,entry)=>{
            entry.href = NTISAS.domain + entry.pathname + entry.search
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

function OpenSettingsMenu(event) {
    if (!NTISAS.opened_menu) {
        if ($('#new-twitter-image-searches-and-stuff').length === 0) {
            TIMER.RenderSettingsMenu();
        }
        $('#new-twitter-image-searches-and-stuff').dialog('open');
    }
}

function CloseSettingsMenu(event) {
    if (NTISAS.opened_menu) {
        GetMenuCloseButton().click();
    }
}

function SaveSettingsMenu(event) {
    if (NTISAS.opened_menu) {
        $('#ntisas-commit').click();
    }
}

function ResetSettingsMenu(event) {
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

function SetHighlightLevels() {
    NTISAS.fade_level = SCORE_LEVELS.indexOf(NTISAS.user_settings.score_levels_faded[0]);
    NTISAS.hide_level = SCORE_LEVELS.indexOf(NTISAS.user_settings.score_levels_hidden[0]);
}

function GetMenuCloseButton() {
    return $('#new-twitter-image-searches-and-stuff').closest('.ntisas-dialog').find('.ntisas-dialog-close');
}

function InitializeDialogButtons() {
    $('.ntisas-dialog .ui-dialog-buttonset .ui-button').each((i,entry)=>{
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
    $('#ntisas-display-settings').append(JSPLib.menu.renderCheckbox('advanced_tooltips_enabled'));
    $('#ntisas-display-settings').append(JSPLib.menu.renderCheckbox('auto_unhide_tweets_enabled'));
    $('#ntisas-display-settings').append(JSPLib.menu.renderCheckbox('display_retweet_id'));
    $('#ntisas-display-settings').append(JSPLib.menu.renderCheckbox('display_view_count'));
    $('#ntisas-display-settings').append(JSPLib.menu.renderCheckbox('display_user_id'));
    $('#ntisas-display-settings').append(JSPLib.menu.renderCheckbox('display_media_link'));
    $('#ntisas-display-settings').append(JSPLib.menu.renderCheckbox('display_image_number'));
    $('#ntisas-display-settings').append(JSPLib.menu.renderCheckbox('display_upload_link'));
    $('#ntisas-display-settings').append(JSPLib.menu.renderCheckbox('tweet_indicators_enabled'));
    $('#ntisas-display-settings').append(JSPLib.menu.renderCheckbox('display_tweet_statistics'));
    $('#ntisas-display-settings').append(JSPLib.menu.renderCheckbox('lock_page_enabled'));
    $('#ntisas-display-settings').append(JSPLib.menu.renderCheckbox('display_network_errors'));
    $('#ntisas-highlight-settings').append(JSPLib.menu.renderCheckbox('score_highlights_enabled'));
    $('#ntisas-highlight-settings').append(JSPLib.menu.renderTextinput('score_window_size', 5));
    $('#ntisas-highlight-settings').append(JSPLib.menu.renderInputSelectors('score_levels_faded', 'radio'));
    $('#ntisas-highlight-settings').append(JSPLib.menu.renderInputSelectors('score_levels_hidden', 'radio'));
    $('#ntisas-query-settings').append(JSPLib.menu.renderInputSelectors('IQDB_settings', 'checkbox'));
    $('#ntisas-query-settings').append(JSPLib.menu.renderInputSelectors('sauce_settings', 'checkbox'));
    $('#ntisas-query-settings').append(JSPLib.menu.renderCheckbox('autocheck_IQDB_enabled'));
    $('#ntisas-query-settings').append(JSPLib.menu.renderCheckbox('autoclick_IQDB_enabled'));
    $('#ntisas-query-settings').append(JSPLib.menu.renderTextinput('similarity_cutoff', 10));
    $('#ntisas-query-settings').append(JSPLib.menu.renderTextinput('results_returned', 10));
    $('#ntisas-query-settings').append(JSPLib.menu.renderTextinput('SauceNAO_API_key', 80));
    $('#ntisas-database-settings').append(JSPLib.menu.renderCheckbox('confirm_delete_enabled'));
    $('#ntisas-database-settings').append(JSPLib.menu.renderCheckbox('delete_all_default'));
    $('#ntisas-database-settings').append(JSPLib.menu.renderCheckbox('merge_results_enabled'));
    $('#ntisas-database-settings').append(JSPLib.menu.renderCheckbox('bypass_server_mode'));
    $('#ntisas-network-settings').append(JSPLib.menu.renderCheckbox('URL_wildcards_enabled'));
    $('#ntisas-network-settings').append(JSPLib.menu.renderCheckbox('custom_order_enabled'));
    $('#ntisas-network-settings').append(JSPLib.menu.renderTextinput('recheck_interval', 5));
    $('#ntisas-network-settings').append(JSPLib.menu.renderInputSelectors('query_subdomain', 'radio'));
    $('#ntisas-download-settings').append(JSPLib.menu.renderCheckbox('original_download_enabled'));
    $('#ntisas-download-settings').append(JSPLib.menu.renderInputSelectors('download_position', 'radio'));
    $('#ntisas-download-settings').append(JSPLib.menu.renderTextinput('filename_prefix_format', 80));
    $('#ntisas-list-controls').append(JSPLib.menu.renderInputSelectors('select_list', 'checkbox', true));
    $('#ntisas-list-controls').append(JSPLib.menu.renderLinkclick('reset_list', true));
    $('#ntisas-cache-controls').append(IMPORT_FILE_INPUT);
    $('#ntisas-cache-controls').append(JSPLib.menu.renderLinkclick('import_data', true));
    $('#ntisas-cache-controls').append(JSPLib.menu.renderInputSelectors('export_types', 'checkbox', true));
    $('#ntisas-cache-controls').append(JSPLib.menu.renderLinkclick('export_data', true));
    $('#ntisas-cache-controls').append(JSPLib.menu.renderLinkclick('cache_info', true));
    $('#ntisas-cache-controls').append(CACHE_INFO_TABLE);
    $('#ntisas-cache-controls').append(JSPLib.menu.renderLinkclick('purge_cache', true));
    //Engage jQuery UI
    JSPLib.menu.engageUI(true);
    $('#ntisas-settings').tabs();
    //Set event handlers
    JSPLib.menu.saveUserSettingsClick(InitializeChangedSettings);
    JSPLib.menu.resetUserSettingsClick(LOCALSTORAGE_KEYS, InitializeChangedSettings);
    $('#ntisas-control-reset-list').on(PROGRAM_CLICK, ResetLists);
    $('#ntisas-control-import-data').on(PROGRAM_CLICK, ImportData);
    $('#ntisas-control-export-data').on(PROGRAM_CLICK, ExportData);
    JSPLib.menu.cacheInfoClick();
    JSPLib.menu.purgeCacheClick();
    //Fixup forum links
    $('.ntisas-forum-topic-link').attr('href', `${NTISAS.domain}/forum_topics/${DANBOORU_TOPIC_ID}`);
    //Add CSS stylings
    JSPLib.utility.setCSSStyle(MENU_CSS, 'menu');
    InitializeUIStyle();
}

//Main function

async function Main() {
    JSPLib.network.jQuerySetup();
    Danbooru.Utility.installBanner(PROGRAM_SHORTCUT);
    Danbooru.NTISAS = Object.assign(NTISAS, {
        tweet_index: {},
        tweet_qtip: {},
        tweet_dialog: {},
        similar_results: {},
        no_url_results: [],
        merge_results: [],
        recorded_views: [],
        photo_navigation: false,
        artist_iqdb_enabled: false,
        opened_menu: false,
        colors_checked: false,
        page_locked: false,
        settings_config: SETTINGS_CONFIG,
        control_config: CONTROL_CONFIG,
        channel: JSPLib.utility.createBroadcastChannel(PROGRAM_NAME, BroadcastTISAS),
    });
    Object.assign(NTISAS, {
        user_settings: JSPLib.menu.loadUserSettings(),
    }, PROGRAM_RESET_KEYS);
    if (!IsTISASInstalled()) {
        await CheckDatabaseInfo(true);
    }
    SetHighlightLevels();
    SetQueryDomain();
    SetSauceAPIKey();
    await InstallUserProfileData();
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
    $(document).on(PROGRAM_CLICK, '.ntisas-download-original', DownloadOriginal);
    $(document).on(PROGRAM_CLICK, '.ntisas-download-all', DownloadAll);
    $(document).on(PROGRAM_CLICK, '.ntisas-footer-entries .ntisas-mark-artist', MarkArtist);
    $(document).on(PROGRAM_CLICK, '.ntisas-footer-entries .ntisas-mark-tweet', MarkTweet);
    $(document).on(PROGRAM_CLICK, '.ntisas-footer-entries .ntisas-count-artist', CountArtist);
    $(document).on(PROGRAM_CLICK, '.ntisas-footer-entries .ntisas-count-tweet', CountTweet);
    $(document).on(PROGRAM_CLICK, '.ntisas-metric', SelectMetric);
    $(document).on('scroll.ntisas.check_views', CheckViews);
    $(window).on('focus.ntisas.check_views', CheckViews);
    $(document).on(PROGRAM_KEYDOWN, null, 'left', PhotoNavigation);
    $(document).on(PROGRAM_KEYDOWN, null, 'right', PhotoNavigation);
    $(document).on(PROGRAM_KEYDOWN, null, 'alt+h', ToggleArtistHilights);
    $(document).on(PROGRAM_KEYDOWN, null, 'alt+=', IncreaseFadeLevel);
    $(document).on(PROGRAM_KEYDOWN, null, 'alt+-', DecreaseFadeLevel);
    $(document).on(PROGRAM_KEYDOWN, null, 'alt+]', IncreaseHideLevel);
    $(document).on(PROGRAM_KEYDOWN, null, 'alt+[', DecreaseHideLevel);
    $(document).on(PROGRAM_KEYDOWN, null, 'alt+q', ToggleAutoclickIQDB);
    $(document).on(PROGRAM_KEYDOWN, null, 'alt+i', ToggleTweetIndicators);
    $(document).on(PROGRAM_KEYDOWN, null, 'alt+m', OpenSettingsMenu);
    $(document).on(PROGRAM_KEYDOWN, null, 'alt+c', CloseSettingsMenu);
    $(document).on(PROGRAM_KEYDOWN, null, 'alt+s', SaveSettingsMenu);
    $(document).on(PROGRAM_KEYDOWN, null, 'alt+r', ResetSettingsMenu);
    setInterval(IntervalStorageHandler, TIMER_POLL_INTERVAL);
    setInterval(IntervalNetworkHandler, TIMER_POLL_INTERVAL);
    JSPLib.utility.setCSSStyle(PROGRAM_CSS, 'program');
    JSPLib.utility.setCSSStyle(GM_getResourceText('jquery_qtip_css'), 'qtip');
    JSPLib.utility.setCSSStyle(NOTICE_CSS, 'notice');
    InitializeColorScheme();
    JSPLib.utility.initializeInterval(RegularCheck, PROGRAM_RECHECK_INTERVAL);
    InitializeCleanupTasks();
    JSPLib.statistics.addPageStatistics(PROGRAM_NAME);
    Main.debuglog("Hi!", window.location.href);
}

/****Function decoration****/

JSPLib.debug.addFunctionTimers(TIMER, false, [
    RenderSettingsMenu
]);

JSPLib.debug.addFunctionTimers(TIMER, true, [
    PurgeBadTweets, SaveDatabase, GetSavePackage, CheckPostvers
]);

JSPLib.debug.addFunctionLogs([
    Main, UnhideTweets, HighlightTweets, RegularCheck, ImportData, DownloadOriginal, PromptSavePostIDs,
    CheckIQDB, CheckURL, PurgeBadTweets, CheckPurgeBadTweets, SaveDatabase, LoadDatabase, CheckPostvers,
    ReadFileAsync, ProcessPostvers, InitializeImageMenu, CorrectStringArray, ValidateEntry,
    BroadcastTISAS, PageNavigation, ProcessNewTweets, ProcessTweetImage, ProcessTweetImages, InitializeUploadlinks, CheckSauce,
    GetMaxVideoDownloadLink, GetPageType, CheckServerBadTweets, SavePostvers, PickImage, MarkupMainTweet,
    MarkupStreamTweet, MarkupMediaType, CheckViews, InitializeViewCount,
]);

/****Initialization****/

//Variables for debug.js
JSPLib.debug.debug_console = false;
JSPLib.debug.pretext = 'NTISAS:';
JSPLib.debug.pretimer = 'NTISAS-';
JSPLib.debug.level = JSPLib.debug.INFO;

//Variables for menu.js
JSPLib.menu.program_shortcut = PROGRAM_SHORTCUT;
JSPLib.menu.program_name = PROGRAM_NAME;
JSPLib.menu.program_reset_data = PROGRAM_RESET_KEYS;
JSPLib.menu.program_data_regex = PROGRAM_DATA_REGEX;
JSPLib.menu.settings_callback = RemoteSettingsCallback;

//Variables for storage.js
JSPLib.storage.prune_limit = 2000;

//variables for network.js
JSPLib.network.error_domname = '#ntisas-error-messages';
JSPLib.network.rate_limit_wait = JSPLib.utility.one_second;

//Variables for danbooru.js
JSPLib.danbooru.max_network_requests = 10;

//Export JSPLib
if (JSPLib.debug.debug_console) {
    unsafeWindow.JSPLib.lib = unsafeWindow.JSPLib.lib || {};
    unsafeWindow.JSPLib.lib[PROGRAM_NAME] = JSPLib;
    unsafeWindow.JSPLib.Danbooru = unsafeWindow.JSPLib.Danbooru || {};
    unsafeWindow.JSPLib.Danbooru[PROGRAM_NAME] = Danbooru;
    unsafeWindow.JSPLib.API_DATA = unsafeWindow.JSPLib.API_DATA || {};
    unsafeWindow.JSPLib.API_DATA[PROGRAM_NAME] = API_DATA;
}

/****Execution start****/

JSPLib.network.installXHRHook([TweetUserData]);
JSPLib.load.programInitialize(Main, PROGRAM_NAME, PROGRAM_LOAD_REQUIRED_VARIABLES, PROGRAM_LOAD_REQUIRED_SELECTORS, [], 100);
