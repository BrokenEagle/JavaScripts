// ==UserScript==
// @name         Twitter Image Searches and Stuff
// @version      3.4
// @description  Searches Danbooru database for tweet IDs, adds image search links, and highlights images based on Tweet favorites.
// @match        https://twitter.com/*
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/Twitter_Image_Searches_and_Stuff.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/custom-20190305/custom/qtip_tisas.js
// @require      https://raw.githubusercontent.com/jeresig/jquery.hotkeys/0.2.0/jquery.hotkeys.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.12.0/validate.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.5.2/localforage.min.js
// @require      https://raw.githubusercontent.com/localForage/localForage-setItems/v1.3.0/dist/localforage-setitems.js
// @require      https://raw.githubusercontent.com/eligrey/FileSaver.js/2.0.0/dist/FileSaver.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190213/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190213/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190213/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190213/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190213/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190213/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190213/lib/concurrency.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190213/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190213/lib/menu.js
// @resource     jquery_ui_css https://raw.githubusercontent.com/BrokenEagle/JavaScripts/custom-20190305/custom/jquery_ui_custom.css
// @resource     jquery_qtip_css https://raw.githubusercontent.com/BrokenEagle/JavaScripts/custom-20190305/custom/qtip_tisas.css
// @grant        GM_getResourceText
// @grant        GM.xmlHttpRequest
// @connect      donmai.us
// @connect      twimg.com
// @connect      google.com
// @connect      githubusercontent.com
// @connect      googleusercontent.com
// @noframes
// ==/UserScript==

/****Global variables****/

//Variables for debug.js
JSPLib.debug.debug_console = true;
JSPLib.debug.pretext = "TISAS:";
JSPLib.debug.pretimer = "TISAS-";
JSPLib.debug.level = JSPLib.debug.INFO;

//Variables for load.js
const program_load_required_variables = ['window.jQuery','window.Danbooru'];
const program_load_required_selectors = [".ProfileSidebar--withLeftAlignment,.SidebarFilterModule,.dashboard-left,.DashboardProfileCard"];

//Variables for storage.js
JSPLib.storage.prune_limit = 2000;

//Variables for danbooru.js
JSPLib.danbooru.max_network_requests = 10;
JSPLib.danbooru.rate_limit_wait = JSPLib.utility.one_second;

//JSPLib variable
window.Danbooru = {};
//Need to fix this for JSPLib.menu
Danbooru.Utility = {};

//Main program variable
var TISAS;

//Timer function hash
const Timer = {};

//Regex that matches the prefix of all program cache data
const program_cache_regex = /^(post|iqdb)-/;

//For factory reset !!!These need to be set!!!
const localstorage_keys = [];
const program_reset_keys = {};

const score_levels = ['excellent','good','aboveavg','fair','belowavg','poor'];
const subdomains = ['danbooru','kagamihara','saitou','shima'];
const all_positions = ['above','below'];

//Main settings
const settings_config = {
    URL_wildcards_enabled: {
        default: false,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Manual searches of URLs will use wildcards in the search. <b>Note:</b> This will make the search take longer or timeout."
    },
    recheck_interval: {
        default: 10,
        parse: parseInt,
        validate: (data)=>{return Number.isInteger(data) && data >= 5;},
        hint: "Number of minutes. Valid values: >= 5. How often to check post versions once up to date."
    },
    custom_order_enabled: {
        default: false,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: `Multi-post results will use <span class="tisas-code">order:custom</span>, showing results with Twitter's order. <b>Note:</b> This will break the tag limit for non-Gold+.`
    },
    query_subdomain: {
        allitems: subdomains,
        default: ['danbooru'],
        validate: (data)=>{return Array.isArray(data) && data.length === 1 && data.reduce((is_string,val)=>{return is_string && (typeof val === 'string') && subdomains.includes(val);},true);},
        hint: "Select which subdomain of Danbooru to query from. <b>Note:</b> The chosen subdomain must be logged into or the script will fail to work."
    },
    confirm_delete_enabled: {
        default: true,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Prompt the user on deleting results from the database."
    },
    confirm_IQDB_enabled: {
        default: true,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Prompt the user on adding IQDB results to the database."
    },
    autosave_IQDB_enabled: {
        default: false,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "IQDB results are saved to the database automatically."
    },
    autocheck_IQDB_enabled: {
        default: false,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Will trigger the <b>Check IQDB</b> link if no results are found with the <b>Check URL</b> link."
    },
    autoclick_IQDB_enabled: {
        default: false,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: 'Will automatically trigger the <b>Check IQDB</b> links (limited availability, see <a class="tisas-forum-topic-link" target="_blank">topic #15976</a> for details). <b>Note:</b> Any results are saved automatically.'
    },
    auto_unhide_tweets_enabled: {
        default: false,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Automatically unhides sensitive Tweet content."
    },
    display_retweet_id: {
        default: false,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Displays the retweet ID next to the retweeter's name."
    },
    display_media_link: {
        default: true,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Displays a link to the media timeline in the tweet view."
    },
    display_upload_link: {
        default: true,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Displays an <b>Upload</b> link to Danbooru in the enlarged image view."
    },
    tweet_indicators_enabled: {
        default: false,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Display controls that allow temporary/permanent marking of a Tweet/Account."
    },
    score_highlights_enabled: {
        default: true,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: 'Adds colored borders and other stylings based upon the Tweet score (limited availability, see <a class="tisas-forum-topic-link" target="_blank">topic #15976</a> for details).'
    },
    advanced_tooltips_enabled: {
        default: true,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Displays extra information and thumbnails on IQDB results. <b>Note:</b> Only when the data is not auto-saved."
    },
    score_levels_faded: {
        allitems: score_levels,
        default: ['belowavg','poor'],
        validate: (data)=>{return Array.isArray(data) && data.reduce((is_string,val)=>{return is_string && (typeof val === 'string') && score_levels.includes(val);},true);},
        hint: "Select which score levels get faded automatically."
    },
    score_levels_hidden: {
        allitems: score_levels,
        default: ['poor'],
        validate: (data)=>{return Array.isArray(data) && data.reduce((is_string,val)=>{return is_string && (typeof val === 'string') && score_levels.includes(val);},true);},
        hint: "Select which score levels get hidden automatically."
    },
    score_window_size: {
        default: 40,
        parse: parseInt,
        validate: (data)=>{return Number.isInteger(data) && data >= 10;},
        hint: "Valid values: >= 10. The number of surrounding tweets to consider when calculating levels."
    },
    original_download_enabled: {
        default: false,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Shows download links for the original images on the Tweet view with customizable filename prefixes."
    },
    download_position: {
        allitems: all_positions,
        default: ['above'],
        validate: (data)=>{return Array.isArray(data) && data.length === 1 && data.reduce((is_string,val)=>{return is_string && (typeof val === 'string') && all_positions.includes(val);},true);},
        hint: "Select whether the download image links will appear above or below the images."
    },
    filename_prefix_format: {
        default: "%TWEETID%--%IMG%",
        parse: String,
        validate: (data)=>{return JSPLib.validate.isString(data);},
        hint: `Prefix to add to original image downloads. Available format keywords include:<br><span class="tisas-code">%TWEETID%, %USERID%, %USERACCOUNT%, %IMG%, %DATE%, %TIME%, %ORDER%</span>.`
    }
};

//CSS constants

const program_css = `
.tisas-highlight.tisas-excellent .tweet {
    border: red solid 10px;
}
.tisas-highlight.tisas-good .tweet {
    border: orange solid 10px;
}
.tisas-highlight.tisas-aboveavg .tweet {
    border: green solid 10px;
}
.tisas-highlight.tisas-fair .tweet {
    border: blue solid 10px;
}
.tisas-highlight.tisas-belowavg .tweet {
    border: purple solid 10px;
}
.tisas-highlight.tisas-poor .tweet {
    border: black solid 10px;
}
.tisas-highlight.tisas-fade .tweet {
    opacity: 0.2;
}
.tisas-highlight.tisas-fade .tweet:hover {
    opacity: 1.0;
}
.tisas-highlight.tisas-hide .tweet {
    max-height: 10px;
    overflow: hidden;
}
.tisas-highlight.tisas-hide .tweet:hover {
    max-height: unset;
}
#tisas-notice {
    padding: .25em;
    position: fixed;
    top: 4em;
    left: 25%;
    width: 50%;
    z-index: 1002;
    display: none;
}
#tisas-close-notice-link {
    right: 1em;
    position: absolute;
}
.tisas-code {
    font-family: monospace;
    background: #eee
}
#tisas-database-version,
#tisas-close-notice-link,
#tisas-current-records,
#tisas-install,
#tisas-upgrade {
    color: #0073ff;
}
#tisas-database-version:hover,
#tisas-close-notice-link:hover,
#tisas-current-records:hover,
#tisas-install:hover,
#tisas-upgrade:hover {
    color: #0073ff;
}
.tweet .tisas-database-match,
.tweet .tisas-iqdb-match-great {
    color: green;
}
.tweet .tisas-database-match:hover,
.tweet .tisas-iqdb-match-great:hover {
    color: green;
}
.tweet .tisas-iqdb-match-good {
    color: blue;
}
.tweet .tisas-iqdb-match-good:hover {
    color: blue;
}
.tweet .tisas-iqdb-match-fair {
    color: orange;
}
.tweet .tisas-iqdb-match-fair:hover {
    color: orange;
}
.tweet .tisas-manual-add,
.tweet .tisas-database-no-match,
.tweet .tisas-iqdb-match-poor {
    color: red;
}
.tweet .tisas-manual-add:hover,
.tweet .tisas-database-no-match:hover,
.tweet .tisas-iqdb-match-poor:hover {
    color: red;
}
.tweet .tisas-check-url,
.tweet .tisas-check-iqdb,
#tisas-current-records,
#tisas-total-records {
    color: grey;
}
.tweet .tisas-check-url:hover,
.tweet .tisas-check-iqdb:hover,
#tisas-current-records:hover {
    color: grey;
}
#tisas-artist-toggle,
#tisas-indicator-toggle {
    font-weight: bold;
}
#tisas-artist-toggle a,
#tisas-iqdb-toggle a,
#tisas-indicator-toggle a {
    display: none;
}
#tisas-enable-highlights,
#tisas-enable-autoiqdb,
#tisas-enable-indicators {
    color: green;
}
#tisas-enable-highlights:hover,
#tisas-enable-autoiqdb:hover,
#tisas-enable-indicators:hover {
    color: green;
}

#tisas-disable-highlights,
#tisas-disable-autoiqdb,
#tisas-disable-indicators {
    color: red;
}
#tisas-disable-highlights:hover,
#tisas-disable-autoiqdb:hover,
#tisas-disable-indicators:hover {
    color: red;
}
#tisas-side-menu {
    border: solid lightgrey 1px;
    height: 13em;
}
#tisas-side-menu ul {
    margin-left: 10px;
}
#tisas-side-menu li {
    font-weight: bold;
    line-height: 18px;
}
#tisas-side-menu li:first-of-type span:first-of-type {
    letter-spacing: -0.5px;
}
#tisas-header {
    margin: 8px;
    font-size: 18px;
    font-weight: bold;
    line-height: 1;
    letter-spacing: -1px;
    text-decoration: underline;
}
#tisas-open-settings {
    margin-left: 0.5em;
}
#tisas-open-settings input {
    font-weight: bold;
    width: 19.5em;
}
.tisas-download-section {
    font-size: 24px;
    line-height: 30px;
    letter-spacing: .01em;
    white-space: normal;
}
.tisas-download-header {
    font-size: 90%;
    text-decoration: underline;
}
.tisas-download-original,
.tisas-download-all {
    margin: 0 0.5em;
    font-size: 75%;
}
.tisas-iqdb-result h4 {
    margin-top: 0;
    margin-bottom: 5px;
    font-size: 16px;
    font-weight: bold;
}
.tisas-post-preview {
    display: inline-block;
    width: 150px;
    text-align: center;
    font-family: Verdana, Helvetica, sans-serif;
}
.tisas-desc {
    font-size:12px;
    margin-bottom: 2px;
    margin-top: 0;
}
.tisas-desc-size {
    letter-spacing: -1px;
}
.tisas-timeline-menu {
    font-size: 14px;
    letter-spacing: -1px;
    font-weight: bold;
}
.tisas-tweet-menu {
    font-weight: bold;
    margin-left: 1em;
}
.tisas-logged-in {
    margin-left: -1em;
}
.tisas-logged-out {
    margin-left: 0.5em;
}
.js-stream-tweet .ProfileTweet-action {
    min-width: 60px;
}
.tisas-upload {
    font-size: 20px;
    font-weight: bold;
}
.Tweet--invertedColors .ProfileTweet-action:not(.ProfileTweet-action--dm) {
    max-width: 100px;
}
.Tweet--invertedColors .ProfileTweet-action--dm {
    max-width: 80px;
}
.tisas-help-info,
.tisas-help-info:hover {
    color: hotpink;
}
.tisas-media-link {
    font-size: 14px;
    margin-right: 0.5em;
    font-weight: bold;
    border: 1px solid;
    border-radius: 20px;
    padding: 8px 16px;
}
.tisas-media-link:hover {
    text-decoration: none;
}
.tisas-indicators {
    font-family: 'MS Gothic','Meiryo UI';
    font-size: 20px;
    font-weight: bold;
    margin-left: 5px;
}
.tisas-indicators span {
    display: none;
}
.tisas-footer-entries {
    font-size: 16px;
    font-weight: bold;
    margin-top: 10px;
}
.tisas-mark-artist,
.tisas-mark-artist:hover {
    color: red;
}
.tisas-mark-tweet,
.tisas-mark-tweet:hover {
    color: orange;
}
.tisas-count-artist,
.tisas-count-artist:hover {
    color: blue;
}
.tisas-count-tweet,
.tisas-count-tweet:hover {
    color: green;
}
.tisas-activated,
.tisas-activated:hover {
    color: unset;
}
.ProfileCanopy-card #tisas-indicator-counter {
    font-size: 24px;
    position: absolute;
    right: -40px;
    letter-spacing: -4px;
    font-weight: bold;
    top: 10px;
}
.ProfileCardMini {
    position: relative;
    width: 95%;
}
.is-locked .ProfileCanopy-card {
    overflow: visible;
}
.SearchNavigation-titleText #tisas-indicator-counter {
    color: black;
    margin-left: 0.5em;
    letter-spacing: -3px;
}
#global-actions #tisas-indicator-counter {
    font-size: 24px;
    font-weight: bold;
    letter-spacing: -3px;
}
`;

const menu_css = `
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
    color: #666;
}
.jsplib-block-tooltip {
    display: block;
    font-style: italic;
    color: #666;
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
.jsplib-selectors label {
    width: 100px;
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
#twitter-image-searches-and-stuff {
    z-index: 1001;
}
#twitter-image-searches-and-stuff p {
    margin-bottom: 1em;
}
#twitter-image-searches-and-stuff h4 {
    font-size: 1.16667em;
    line-height: 1.5em;
}
#twitter-image-searches-and-stuff .prose h2 {
    font-size: 1.8em;
    padding: .8em 0 .25em;
    line-height: 1em;
    color: black;
}
#twitter-image-searches-and-stuff .prose h4 {
    font-size: 1.4em;
    padding: .8em 0 .25em;
}
#twitter-image-searches-and-stuff a {
    color:#0073ff
}
#twitter-image-searches-and-stuff b {
    font-weight: bold;
}
.tisas-textinput input {
    width: unset;
}
#tisas-import-file,
#tisas-settings-buttons input,
.tisas-textinput input{
    background-color: white;
}
#tisas-cache-info-table {
    border-collapse: collapse;
    border-spacing: 0;
}
#tisas-cache-info-table .striped td,
#tisas-cache-info-table .striped th {
    padding: 4px 6px;
}
#tisas-cache-info-table .striped thead tr {
    border-bottom: 2px solid #666;
}
#tisas-cache-info-table .striped thead th {
    font-weight: 700;
    text-align: left;
    color: #333;
}
#tisas-cache-info-table .striped tbody tr {
    border-bottom: 1px solid #BBB !important;
}
.ui-dialog .ui-dialog-titlebar .ui-dialog-titlebar-close {
    font-size: 0;
    margin-right: 5px;
}
.ui-dialog .ui-dialog-titlebar .ui-dialog-titlebar-close .ui-icon-closethick {
    margin: -8px;
}
`;

//HTML constants

const tisas_menu = `
<div id="tisas-script-message" class="prose">
    <h2>Twitter Image Searches and Stuff</h2>
    <p>Check the forum for the latest on information and updates (<a class="tisas-forum-topic-link" target="_blank">topic #15976</a>).</p>
</div>
<div id="tisas-console" class="jsplib-console">
    <div id="tisas-settings" class="jsplib-outer-menu">
        <div id="tisas-display-settings" class="jsplib-settings-grouping">
            <div id="tisas-display-message" class="prose">
                <h4>Display settings</h4>
            </div>
        </div>
        <div id="tisas-highlight-settings" class="jsplib-settings-grouping">
            <div id="tisas-highlight-message" class="prose">
                <h4>Highlight settings</h4>
            </div>
        </div>
        <div id="tisas-database-settings" class="jsplib-settings-grouping">
            <div id="tisas-database-message" class="prose">
                <h4>Database settings</h4>
            </div>
        </div>
        <div id="tisas-network-settings" class="jsplib-settings-grouping">
            <div id="tisas-network-message" class="prose">
                <h4>Network settings</h4>
            </div>
        </div>
        <div id="tisas-download-settings" class="jsplib-settings-grouping">
            <div id="tisas-download-message" class="prose">
                <h4>Download settings</h4>
            </div>
        </div>
        <div id="tisas-cache-settings" class="jsplib-settings-grouping">
            <div id="tisas-cache-message" class="prose">
                <h4>Cache settings</h4>
            </div>
        </div>
        <hr>
        <div id="tisas-settings-buttons" class="jsplib-settings-buttons">
            <input type="button" id="tisas-commit" value="Save">
            <input type="button" id="tisas-resetall" value="Factory Reset">
        </div>
    </div>
</div>`;

const indicator_links = `
<div class="tisas-footer-entries">
    Mark(
        <a class="tisas-mark-artist">Artist</a> |
        <a class="tisas-mark-tweet">Tweet</a>
    )&emsp;
    Count(
        <a class="tisas-count-artist">Artist</a> |
        <a class="tisas-count-tweet">Tweet</a>
    )
</div>
`;

const no_match_help = "no sources: L-click, manual add posts";
const no_results_help = "no results: L-click, reset IQDB results";
const confirm_delete_help = "postlink: L-click, delete info; R-click, open postlink";
const confirm_iqdb_help = "postlink: L-click, confirm results; R-click open postlink";

const main_counter = '<span id="tisas-indicator-counter">( <span class="tisas-count-artist">0</span> , <span class="tisas-count-tweet">0</span> )</span>';
const tweet_indicators = '<span class="tisas-indicators"><span class="tisas-mark-artist">Ⓐ</span><span class="tisas-mark-tweet">Ⓣ</span><span class="tisas-count-artist">ⓐ</span><span class="tisas-count-tweet">ⓣ</span></span>';
const notice_banner = '<div id="tisas-notice"><span>.</span><a href="#" id="tisas-close-notice-link">close</a></div>';
const load_counter = '<span id="tisas-load-message">Loading ( <span id="tisas-counter">...</span> )</span>';

//Database constants

const server_database_url = "https://drive.google.com/uc?export=download&id=16YapNscZ0W-tZaRelYF2kDtR31idUd_p";
const server_purgelist_url = "https://drive.google.com/uc?export=download&id=1uFixlRryOGUzhfvU6nbrkNRAQC4VvO10";
const database_info_url = "https://drive.google.com/uc?export=download&id=1evAJM-K6QpHg52997PbXf-bptImLgHDs";

//Time constants

const timer_poll_interval = 100;
const program_recheck_interval = JSPLib.utility.one_second;
const post_versions_callback = JSPLib.utility.one_second * 5;
const page_refresh_timeout = JSPLib.utility.one_second * 5;
const min_post_expires = JSPLib.utility.one_day;
const max_post_expires = JSPLib.utility.one_month;
const post_expires = JSPLib.utility.one_day;
const iqdb_expires = JSPLib.utility.one_day;
const length_recheck_expires = JSPLib.utility.one_hour;
const database_recheck_expires = JSPLib.utility.one_day;
const prune_recheck_expires = JSPLib.utility.one_hour * 6;

//Other constants

const query_limit = 100;
const query_batch_size = 499;

const twitter_regex = /^https:\/\/twitter\.com\/[\w-]+\/status\/(\d+)$/;

//Qtip constants

const ARTIST_QTIP_SETTINGS = {
    style: {
        classes: "qtiptisas-light tisas-iqdb-tooltip",
    },
    position: {
        my: "top center",
        at: "bottom center",
        viewport: true,
    },
    show: {
        delay: 150,
        solo: true,
    },
    hide: {
        delay: 250,
        fixed: true,
    }
};

/****localforage setup****/

JSPLib.storage.twitterstorage = localforage.createInstance({
    name: 'Twitter storage',
    driver: [localforage.INDEXEDDB]
});

function TwitterStorage() {
    let func = arguments[0];
    let pass_args = Object.values(arguments).slice(1);
    JSPLib.storage.danboorustorage = JSPLib.storage.twitterstorage;
    let ret = func(...pass_args);
    JSPLib.storage.danboorustorage = TwitterStorage.danboorustorage;
    return ret;
}
TwitterStorage.danboorustorage = JSPLib.storage.danboorustorage;

/****jQuery Setup****/

// https://gist.github.com/monperrus/999065
// This is a shim that adapts jQuery's ajax methods to use GM_xmlhttpRequest.
// This allows the use $.getJSON instead of using GM_xmlhttpRequest directly.
//
// This is necessary because some sites have a Content Security Policy (CSP) which
// blocks cross-origin requests to Danbooru that require authentication.
// Tampermonkey can bypass the CSP, but only if GM_xmlhttpRequest is used.
function GM_XHR() {
    const open_params = ['type','url','async','username','password'];
    Object.assign(this,{headers: {}},...open_params.concat(['status','readyState']).map(function (key) {return {[key]: null};}));

    this.abort = function() {
        this.readyState = 0;
    };

    this.getAllResponseHeaders = function(name) {
        return (this.readyState != 4 ? "" : this.responseHeaders);
    };

    this.getResponseHeader = function(name) {
        var regexp = new RegExp('^'+name+': (.*)$','im');
        var match = regexp.exec(this.responseHeaders);
        return (match ? match[1] : '');
    };

    this.open = function(type, url, async, username, password) {
        let outerargs = arguments;
        let xhr = this;
        open_params.forEach(function (arg,i) {
            xhr[arg] = outerargs[i] || null;
        });
        this.readyState = 1;
    };

    this.setRequestHeader = function(name, value) {
        this.headers[name] = value;
    };

    this.onresponse = function (handler) {
        let xhr = this;
        return function (resp) {
            ['readyState','responseHeaders','responseText','status','statusText'].forEach(function (key) {
                xhr[key] = resp[key];
            });
            if (xhr[handler]) {
                xhr[handler].call(xhr);
            } else {
                xhr.onreadystatechange();
            }
        };
    };

    this.send = function(data) {
        this.data = data;
        GM.xmlHttpRequest({
            method: this.type,
            url: this.url,
            headers: this.headers,
            data: this.data,
            responseType: this.responseType,
            onload: this.onresponse("onload"),
            onerror: this.onresponse("onerror"),
        });
    };
}

$.ajaxSetup({xhr: function () {return new GM_XHR();}});

/****Functions****/

const post_constraints = {
    entry: JSPLib.validate.hashentry_constraints,
    value: {
        uploader: JSPLib.validate.stringonly_constraints,
        score: JSPLib.validate.integer_constraints,
        favcount: JSPLib.validate.counting_constraints,
        rating: JSPLib.validate.inclusion_constraints(['s','q','e']),
        tags: JSPLib.validate.stringonly_constraints,
        created: JSPLib.validate.integer_constraints
    }
};

const iqdb_constriants = {
    expires: JSPLib.validate.expires_constraints,
    value: JSPLib.validate.boolean_constraints
}

function ValidateEntry(key,entry) {
    if (!JSPLib.validate.validateIsHash(key, entry)) {
        return false;
    }
    if (key.match(/^post-/)) {
        return ValidatePostEntry(key, entry);
    }
    if (key.match(/^iqdb-/)) {
        return JSPLib.validate.validateHashEntries(key, entry, iqdb_constriants)
    }
    ValidateEntry.debuglog("Bad key!");
    return false;
}

function ValidatePostEntry(key,entry) {
    if (!JSPLib.validate.validateHashEntries(key, entry, post_constraints.entry)) {
        return false;
    }
    return JSPLib.validate.validateHashEntries(key + '.value', entry.value, post_constraints.value);
}

function ValidateProgramData(key,entry) {
    var checkerror=[];
    switch (key) {
        case 'tisas-recent-timestamp':
            if (!Number.isInteger(entry)) {
                checkerror = ["Value is not an integer."];
            }
            break;
        case 'tisas-postver-lastid':
            if (!JSPLib.validate.validateID(entry)) {
                checkerror = ["Value is not a valid ID."];
            }
            break;
        case 'tisas-overflow':
            if (!JSPLib.validate.isBoolean(entry)) {
                checkerror = ["Value is not a boolean."];
            }
            break;
        default:
            checkerror = ["Not a valid program data key."];
    }
    if (checkerror.length) {
        JSPLib.validate.printValidateError(key,checkerror);
        return false;
    }
    return true;
}

function CorrectStringArray(name,artistlist) {
    let error_messages = [];
    if (!Array.isArray(artistlist)) {
        CorrectStringArray.debuglog("Value is not an array.");
        return [];
    }
    let correctlist = artistlist.filter((name)=>{return JSPLib.validate.isString(name);});
    if (artistlist.length !== correctlist.length) {
        JSPLib.storage.setStorageData('tisas-' + name,correctlist,localStorage);
        JSPLib.debug.debugExecute(()=>{
            let bad_values = JSPLib.utility.setDifference(artistlist,correctlist);
            CorrectStringArray.debuglog("Bad values found:",name,bad_values);
        });
    }
    return correctlist;
}

//Library functions

Danbooru.Utility.notice = function(msg, permanent) {
    $('#tisas-notice').addClass("ui-state-highlight").removeClass("ui-state-error").fadeIn("fast").children("span").html(msg);
    if (Danbooru.Utility.notice_timeout_id !== undefined) {
        clearTimeout(Danbooru.Utility.notice_timeout_id);
    }
    if (!permanent) {
        Danbooru.Utility.notice_timeout_id = setTimeout(function() {
            $("#tisas-close-notice-link").click();
            Danbooru.Utility.notice_timeout_id = undefined;
        }, 6000);
    }
};

Danbooru.Utility.error = function(msg) {
    $('#tisas-notice').removeClass("ui-state-highlight").addClass("ui-state-error").fadeIn("fast").children("span").html(msg);
    if (Danbooru.Utility.notice_timeout_id !== undefined) {
        clearTimeout(Danbooru.Utility.notice_timeout_id);
    }
};

Danbooru.Utility.closeNotice = function (event) {
    $('#tisas-notice').fadeOut("fast");
    event.preventDefault();
};


////Fixes for validate.js

JSPLib.validate.isHash = function (value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
};

////Fixes for danbooru.js

JSPLib.danbooru.submitRequest = async function (type,url_addons,default_val=null,key,domain='',notify_user=false) {
    key = key || JSPLib.danbooru.randomDummyTag();
    if (JSPLib.danbooru.num_network_requests >= JSPLib.danbooru.max_network_requests) {
        await JSPLib.danbooru.rateLimit();
    }
    JSPLib.danbooru.incrementCounter();
    JSPLib.debug.recordTime(key,'Network');
    try {
        return await jQuery.getJSON(`${domain}/${type}.json`,url_addons
        ).always(()=>{
            JSPLib.debug.recordTimeEnd(key,'Network');
            JSPLib.danbooru.decrementCounter();
        });
    } catch(e) {
        //Swallow exception... will return default value
        e = (typeof e === "object" && 'status' in e && 'responseText' in e ? e : {status: 999, responseText: "Bad error code!"});
        JSPLib.debug.debuglogLevel("SubmitRequest error:",e.status,e.responseText,JSPLib.debug.ERROR);
        if (notify_user) {
            let message = e.responseText;
            try {
                let parse_message = JSON.parse(message);
                message = (JSPLib.validate.isHash(parse_message) && 'message' in parse_message ? parse_message.message : message);
            } catch (e) {
                //Swallow
            }
            Danbooru.Utility.error(`HTTP ${e.status}: ${message}`);
        }
        return default_val;
    }
};

JSPLib.danbooru.getAllItems = async function (type,limit,options) {
    let url_addons = options.addons || {};
    let reverse = options.reverse || false;
    let page_modifier = (reverse ? 'a' : 'b');
    let domain = options.domain;
    let page_addon = (options.page ? {page:`${page_modifier}${options.page}`} : {});
    let notify_user = (options.notify ? options.notify : false);
    let limit_addon = {limit: limit};
    var return_items = [];
    while (true) {
        let request_addons = JSPLib.danbooru.joinArgs(url_addons,page_addon,limit_addon);
        let request_key = jQuery.param(request_addons);
        let temp_items = await JSPLib.danbooru.submitRequest(type,request_addons,[],request_key,domain,notify_user);
        return_items = return_items.concat(temp_items);
        if (temp_items.length < limit) {
            return return_items;
        }
        let lastid = JSPLib.danbooru.getNextPageID(temp_items,reverse);
        page_addon = {page:`${page_modifier}${lastid}`};
        JSPLib.debug.debuglogLevel("Rechecking",type,"@",lastid,JSPLib.debug.INFO);
    }
};

////New for utility

JSPLib.utility.joinList = function (array,prefix,joiner) {
    return array.map((level)=>{return prefix + level;}).join(joiner);
}

JSPLib.utility.parseParams = function (str) {
    return str.split('&').reduce(function (params, param) {
        var paramSplit = param.split('=').map(function (value) {
            return decodeURIComponent(value.replace(/\+/g, ' '));
        });
        params[paramSplit[0]] = paramSplit[1];
        return params;
    }, {});
};

//Helper functions

function PadNumber(num,size) {
    var s = String(num);
    while (s.length < (size || 2)) {s = "0" + s;}
    return s;
}

function GetNumericTimestamp(timestamp) {
    let time_obj = new Date(timestamp);
    return GetDateString(timestamp) + GetTimeString(timestamp);
}

function GetDateString(timestamp) {
    let time_obj = new Date(timestamp);
    return `${time_obj.getFullYear()}${PadNumber(time_obj.getMonth()+1,2)}${PadNumber(time_obj.getDate(),2)}`;
}

function GetTimeString(timestamp) {
    let time_obj = new Date(timestamp);
    return `${PadNumber(time_obj.getHours(),2)}${PadNumber(time_obj.getMinutes(),2)}`;
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
    if (time_interval < GetPostVersionsExpiration() * 2) {
        return "Up to date";
    } else if (time_interval < JSPLib.utility.one_hour) {
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
    return TISAS.user_settings.recheck_interval * JSPLib.utility.one_minute;
}

function WasOverflow() {
    return JSPLib.storage.checkStorageData('tisas-overflow',ValidateProgramData,localStorage,false);
}

function MapPostData(posts) {
    return posts.map(MapPost);
}

function MapPost(post) {
    return {
        uploader: post.uploader_name,
        score: post.score,
        favcount: post.fav_count,
        rating: post.rating,
        tags: post.tag_string,
        created: new Date(post.created_at).getTime()
    }
}

function GetLinkTitle(post,is_render=true) {
    let tags = post.tags;
    let age = `age:"${TimeAgo(post.created)}"`
    if (is_render) {
        tags = jQueryEscape(tags);
        age = jQueryEscape(age);
    }
    return `user:${post.uploader} score:${post.score} favcount:${post.favcount} rating:${post.rating} ${age} ${tags}`;
}


function GetMultiLinkTitle(post_ids,posts,is_render=true) {
    let title = [];
    posts.forEach((post,i)=>{
        let age = `age:"${TimeAgo(post.created)}"`
        if (is_render) {
            age = jQueryEscape(age);
        }
        title.push(`post #${post_ids[i]} - user:${post.uploader} score:${post.score} favcount:${post.favcount} rating:${post.rating} ${age}`);
    });
    return title.join('\n');
}

function GetCustomQuery() {
    return (TISAS.user_settings.custom_order_enabled ? '+order%3Acustom' : '');
}

function jQueryEscape(string) {
    return jQuery('<div />').attr('parse',string)[0].outerHTML.match(/parse="([^"]+)"/)[1];
}

function GetPostVersionsLastID() {
    //Get the program last ID if it exists
    let postver_lastid = JSPLib.storage.checkStorageData('tisas-postver-lastid',ValidateProgramData,localStorage,TISAS.database_info.post_version);
    //Select the largest of the program lastid and the database lastid
    let max_postver_lastid = Math.max(postver_lastid,TISAS.database_info.post_version);
    if (postver_lastid !== max_postver_lastid) {
        JSPLib.storage.setStorageData('tisas-postver-lastid',max_postver_lastid,localStorage);
    }
    return max_postver_lastid;
}

async function GetTotalRecords() {
    if (JSPLib.concurrency.checkTimeout('tisas-length-recheck',length_recheck_expires)) {
        let database_length = await JSPLib.storage.twitterstorage.length();
        JSPLib.storage.setStorageData('tisas-database-length',database_length,localStorage);
        JSPLib.concurrency.setRecheckTimeout('tisas-length-recheck',length_recheck_expires);
    }
    return JSPLib.storage.getStorageData('tisas-database-length',localStorage,0);
}

function GetPreviewDimensions(image_width,image_height) {
    let scale = Math.min(150 / image_width, 150 / image_height);
    scale = Math.min(1, scale);
    let width = Math.round(image_width * scale);
    let height = Math.round(image_height * scale);
    return [width,height];
}

function ReadableBytes(bytes) {
    var i = Math.floor(Math.log(bytes) / Math.log(1024)),
    sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    return JSPLib.utility.setPrecision((bytes / Math.pow(1024, i)),2) + ' ' + sizes[i];
}

function GetBaseDomainName(url) {
    let parser = $("<a \>").attr('href',url)[0];
    let root = parser.hostname.lastIndexOf('.');
    let domain = parser.hostname.lastIndexOf('.', root - 1);
    return parser.hostname.slice(domain + 1);
}

function GetFileExtension(url,splitter) {
    let parser = $("<a \>").attr('href',url)[0];
    let pathname = parser.pathname.split(splitter)[0];
    let extpos = pathname.lastIndexOf('.');
    return pathname.slice(extpos + 1);
}

function GetThumbUrl(url,splitter,ext) {
    let parser = $("<a \>").attr('href',url)[0];
    let pathname = parser.pathname.split(splitter)[0];
    let extpos = pathname.lastIndexOf('.');
    return parser.origin + pathname.slice(0, extpos + 1) + ext;
}

function RemoveDuplicates(obj_array, attribute){
    const attribute_index = obj_array.map((item)=>{return item[attribute]});
    return obj_array.filter((obj,index)=>{
        return attribute_index.indexOf(obj[attribute]) === index;
    });
}

function LogarithmicExpiration(count, max_count, time_divisor, multiplier) {
    let time_exponent = Math.pow(10,(1/time_divisor));
    return Math.round(Math.log10(time_exponent + (10 - time_exponent) * (count / max_count)) * multiplier);
}

//Auxiliary functions

function GetList(name) {
    GetList[name] = GetList[name] || {};
    if (!GetList[name].list) {
        GetList[name].list = JSPLib.storage.getStorageData('tisas-' + name,localStorage,[]);
        GetList[name].list = CorrectStringArray(name,GetList[name].list);
    }
    return GetList[name].list;
}

function SaveList(name,list,delay=true) {
    GetList[name].list = list;
    if (delay) {
        setTimeout(()=>{JSPLib.storage.setStorageData('tisas-' + name,list,localStorage);},1);
    } else {
        JSPLib.storage.setStorageData('tisas-' + name,list,localStorage);
    }
}

function SavePost(post_id,mapped_post) {
    let expires_duration = PostExpiration(mapped_post.created);
    let data_expires = JSPLib.utility.getExpiration(expires_duration)
    JSPLib.storage.saveData('post-' + post_id, {value: mapped_post, expires: data_expires});
}

function PostExpiration(created_timestamp) {
    let created_interval = Date.now() - created_timestamp;
    if (created_interval < JSPLib.utility.one_day) {
        return min_post_expires;
    } else if (created_interval < JSPLib.utility.one_month) {
        let day_interval = (created_interval / JSPLib.utility.one_day) - 1; //Start at 0 days and go to 29 days
        let day_slots = 29; //There are 29 day slots between 1 day and 30 days
        let days_month = 30;
        return LogarithmicExpiration(day_interval, day_slots, days_month, max_post_expires);
    } else {
        return max_post_expires;
    }
}

function SetCheckPostvers() {
    if (JSPLib.concurrency.checkTimeout('tisas-timeout',GetPostVersionsExpiration()) || WasOverflow()) {
        clearTimeout(CheckPostvers.timeout);
        CheckPostvers.timeout = setTimeout(()=>{
            if (TISAS.database_info && JSPLib.concurrency.reserveSemaphore('tisas','postvers')) {
                Timer.CheckPostvers();
            }
        },post_versions_callback);
    }
}

function GetTweetQuartile(tweetid) {
    if (tweetid in TISAS.tweet_finish) {
        return TISAS.tweet_finish[tweetid];
    }
    let windowsize = TISAS.user_settings.score_window_size;
    let pos = TISAS.tweet_pos.indexOf(tweetid);
    let fave = TISAS.tweet_faves[pos];
    let posmin = Math.max(0, pos - windowsize);
    let posmax = Math.min(TISAS.tweet_pos.length, pos + windowsize);
    let subarray = TISAS.tweet_faves.slice(posmin,posmax);
    var quartilepos = Math.floor(subarray.length / 4);
    var sortedfaves = subarray.sort((a,b)=>{return a - b;});
    var q1 = sortedfaves[quartilepos];
    var q2 = sortedfaves[2*quartilepos];
    var q3 = sortedfaves[3*quartilepos];
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
        TISAS.tweet_finish[tweetid] = quartile;
    }
    return quartile;
}

function ProcessTweets($tweets,primaryfilter,append_selector,outerHTML) {
    var all_post_ids = [];
    var $filter_tweets = $tweets;
    if (primaryfilter) {
        $filter_tweets = $filter_tweets.filter(primaryfilter);
    }
    $filter_tweets = $filter_tweets.filter((i,tweet)=>{return $(tweet).find(append_selector).length;});
    if ($filter_tweets.length === 0) {
        return;
    }
    let tweet_ids = $filter_tweets.map((i,entry)=>{return String($(entry).data('tweet-id'));}).toArray();
    ProcessTweets.debuglog("Check Tweets:",tweet_ids);
    let promise_array = tweet_ids.map((tweet_id)=>{return TwitterStorage(JSPLib.storage.retrieveData,'tweet-' + tweet_id);});
    Promise.all(promise_array).then((data_items)=>{
        ProcessTweets.debuglog("Tweet data:",data_items);
        data_items.forEach((data,i)=>{
            let tweet_id = tweet_ids[i];
            let $tweet = $filter_tweets.filter(`[data-tweet-id=${tweet_id}]`);
            if (data !== null) {
                let postlink = "";
                let helplink = RenderHelp(confirm_delete_help);
                if (data.length === 1) {
                    postlink = `( <a class="tisas-confirm-delete tisas-database-match" target="_blank" href="${TISAS.domain}/posts/${data[0]}">post #${data[0]}</a> | ${helplink} )`
                } else {
                    postlink = `( <a class="tisas-confirm-delete tisas-database-match" target="_blank" href="${TISAS.domain}/posts?tags=status%3Aany+id%3A${data.join(',')}${GetCustomQuery()}">${data.length} sources</a> | ${helplink} ) `;
                }
                ProcessTweets.tweet_index[tweet_id] = {entry: $tweet, post_ids: data, processed: false};
                all_post_ids = all_post_ids.concat(data);
                let $link_container = $(outerHTML).append(postlink);
                $tweet.find(append_selector).append($link_container);
            } else {
                JSPLib.storage.checkLocalDB('iqdb-' + tweet_id, ValidateEntry, iqdb_expires).then((iqdb_data)=>{
                    let has_no_results = false;
                    if (iqdb_data === null) {
                        JSPLib.storage.saveData('iqdb-' + tweet_id, {value: false, expires: JSPLib.utility.getExpiration(iqdb_expires)});
                    } else {
                        has_no_results = iqdb_data.value;
                    }
                    let $link_container = $(outerHTML).append(RenderNomatchLinks(has_no_results));
                    $tweet.find(append_selector).append($link_container);
                });
            }
        });
        if (all_post_ids.length) {
            JSPLib.storage.batchStorageCheck(all_post_ids,ValidateEntry,max_post_expires,'post').then((missing_ids)=>{
                ProcessTweets.debuglog("Missing posts:",missing_ids);
                if (missing_ids.length) {
                    JSPLib.danbooru.submitRequest('posts',{tags: 'id:' + missing_ids.join(','), limit: missing_ids.length},[],null,TISAS.domain).then((data)=>{
                        let mapped_data = MapPostData(data);
                        mapped_data.forEach((post,i)=>{
                            let post_id = data[i].id;
                            ProcessTweets.post_index[post_id] = post;
                            SavePost(post_id, post);
                        });
                        UpdateLinkTitles();
                    });
                }
                let found_ids = JSPLib.utility.setDifference(all_post_ids,missing_ids.map(Number));
                ProcessTweets.debuglog("Found posts:",found_ids);
                found_ids.forEach((post_id)=>{
                    ProcessTweets.post_index[post_id] = JSPLib.storage.getStorageData('post-' + post_id, sessionStorage).value;
                });
                UpdateLinkTitles();
            });
        }
    });
}
ProcessTweets.tweet_index = {};
ProcessTweets.post_index = {};

function UpdateLinkTitles() {
    for (let tweet_id in ProcessTweets.tweet_index) {
        let tweet_entry = ProcessTweets.tweet_index[tweet_id];
        if (tweet_entry.post_ids.length < 1 || tweet_entry.processed) {
            continue;
        }
        let $link = tweet_entry.entry.find('.tisas-database-match');
        if (tweet_entry.post_ids.length === 1) {
            let post_id = tweet_entry.post_ids[0];
            if (post_id in ProcessTweets.post_index) {
                $link.attr('title',GetLinkTitle(ProcessTweets.post_index[post_id],false));
                tweet_entry.processed = true;
            }
        } else {
            let post_ids = tweet_entry.post_ids;
            if (JSPLib.utility.setIntersection(Object.keys(ProcessTweets.post_index).map(Number),post_ids).length === post_ids.length) {
                let posts = post_ids.map((post_id)=>{return ProcessTweets.post_index[post_id];});
                $link.attr('title',GetMultiLinkTitle(post_ids,posts,false));
                tweet_entry.processed = true;
            }
        }
    }
}

function ReversalCheck(hash,key,id) {
    if ((key in hash) && hash[key].includes(id)) {
        hash[key] = JSPLib.utility.setDifference(hash[key],[id]);
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
                let match = postver.source.match(twitter_regex);
                if (match) {
                    add_entries[match[1]] = JSPLib.utility.setUnion(add_entries[match[1]] || [], [postver.post_id]);
                }
            } else {
                let source_add = postver.added_tags.filter((tag)=>{return tag.replace(/^source:/,'').match(twitter_regex);}).map((tag)=>{return tag.replace(/^source:/,'').match(twitter_regex)[1];});
                let source_rem = postver.removed_tags.filter((tag)=>{return tag.replace(/^source:/,'').match(twitter_regex);}).map((tag)=>{return tag.replace(/^source:/,'').match(twitter_regex)[1];});
                if (source_add.length && source_rem.length) {
                    if (source_add[0] === source_rem[0]) {
                        source_add.length = source_rem.length = 0;
                        account_swaps++;
                    } else {
                        ProcessPostvers.debuglog("ID swap detected",source_rem[0],"->",source_add[0]);
                    }
                }
                if (source_add.length) {
                    add_entries[source_add[0]] = JSPLib.utility.setUnion(add_entries[source_add[0]] || [], [postver.post_id]);
                    if (ReversalCheck(rem_entries,source_add[0],postver.post_id)) {
                        ProcessPostvers.debuglog("Source delete reversal detected",source_add[0]);
                    }
                }
                if (source_rem.length) {
                    rem_entries[source_rem[0]] = JSPLib.utility.setUnion(rem_entries[source_rem[0]] || [], [postver.post_id]);
                    if (ReversalCheck(add_entries,source_rem[0],postver.post_id)) {
                        ProcessPostvers.debuglog("Source add reversal detected",source_rem[0]);
                    }
                }
            }
        }
        if (postver.added_tags.includes('bad_twitter_id') || postver.removed_tags.includes('bad_twitter_id')) {
            let match = postver.source.match(twitter_regex);
            if (match) {
                if (postver.removed_tags.includes('bad_twitter_id')) {
                    ProcessPostvers.debuglog("Activated tweet:",match[1]);
                    add_entries[match[1]] = JSPLib.utility.setUnion(add_entries[match[1]] || [], [postver.post_id]);
                    reversed_posts++;
                    if (ReversalCheck(rem_entries,match[1],postver.post_id)) {
                        ProcessPostvers.debuglog("Tweet remove reversal detected",match[1]);
                    }
                } else if (postver.added_tags.includes('bad_twitter_id')) {
                    rem_entries[match[1]] = JSPLib.utility.setUnion(rem_entries[match[1]] || [], [postver.post_id]);
                    inactive_posts++;
                    if (ReversalCheck(add_entries,match[1],postver.post_id)) {
                        ProcessPostvers.debuglog("Tweet add reversal detected",match[1]);
                    }
                }
            }
        }
    });
    if (account_swaps > 0) {
        ProcessPostvers.debuglog("Account swaps detected:",account_swaps);
    }
    if (inactive_posts > 0) {
        ProcessPostvers.debuglog("Inactive tweets detected:",inactive_posts);
    }
    if (reversed_posts > 0) {
        ProcessPostvers.debuglog("Activated tweets detected:",reversed_posts);
    }
    return [add_entries,rem_entries];
}

function GetPageType() {
    const home_regex = "(^https:\/\/twitter\\.com\/?(?:\\?|$))";
    const main_regex = "(^https:\/\/twitter\\.com\/(?!search)([\\w-]+)(?:\\?|$))";
    const likes_regex = "(^https:\/\/twitter\\.com\/([\\w-]+)\/likes(?:\\?|$))";
    const replies_regex = "(^https:\/\/twitter\\.com\/([\\w-]+)\/with_replies(?:\\?|$))";
    const media_regex = "(^https:\/\/twitter\\.com\/([\\w-]+)\/media(?:\\?|$))";
    const list_regex = "(^https:\/\/twitter\\.com\/[\\w-]+\/lists\/([\\w-]+)(?:\\?|$))";
    const hashtag_regex = "(^https:\/\/twitter\\.com\/hashtag\/(.+?)(?:\\?|$))";
    const search_regex = "(^https:\/\/twitter\\.com\/search\\?(.*?\\bq=.+))";
    const tweet_regex = "(^https:\/\/twitter\\.com\/[\\w-]+\/status\/(\\d+)(?:\\?|$))";
    const page_regex = RegExp(`(${main_regex}|${media_regex}|${search_regex}|${tweet_regex}|${hashtag_regex}|${list_regex}|${home_regex}|${likes_regex}|${replies_regex})`);
    let match = page_regex.exec(window.location.href);
    if (!match) {
        return [null,null];
    }
    switch(match[1]) {
        case match[2]:
            return ["main",match[3]];
        case match[4]:
            return ["media",match[5]];
        case match[6]:
            return ["search",match[7]];
        case match[8]:
            return ["tweet",match[9]];
        case match[10]:
            return ["hashtag",match[11]];
        case match[12]:
            return ["list",match[13]];
        case match[14]:
            return ["home",null];
        case match[15]:
            return ["likes",match[16]];
        case match[17]:
            return ["replies",match[18]];
        default:
            return [null,null];
    }
}

function UpdateHighlightControls() {
    if (TISAS.user_id) {
        let no_highlight_list = GetList('no-highlight-list');
        if (no_highlight_list.includes(TISAS.account)) {
            no_highlight_list = JSPLib.utility.setDifference(no_highlight_list,[TISAS.account]);
            no_highlight_list = JSPLib.utility.setUnion(no_highlight_list,[TISAS.user_id]);
            SaveList('no-highlight-list',no_highlight_list,false);
        }
        if (no_highlight_list.includes(TISAS.account) || no_highlight_list.includes(TISAS.user_id)) {
            $("#tisas-enable-highlights").show();
            $("#tisas-disable-highlights").hide();
        } else {
            $("#tisas-enable-highlights").hide();
            $("#tisas-disable-highlights").show();
        }
    }
}

function UpdateArtistHighlights() {
    if (TISAS.user_id) {
        let no_highlight_list = GetList('no-highlight-list');
        let fade_selectors = JSPLib.utility.joinList(TISAS.user_settings.score_levels_faded,'.tisas-',',');
        let hide_selectors = JSPLib.utility.joinList(TISAS.user_settings.score_levels_hidden,'.tisas-',',');
        $(".tisas-fade").removeClass("tisas-fade");
        $(".tisas-hide").removeClass("tisas-hide");
        if (!(no_highlight_list.includes(TISAS.account) || no_highlight_list.includes(TISAS.user_id))) {
            $(fade_selectors).addClass("tisas-fade");
            $(hide_selectors).addClass("tisas-hide");
        }
    }
}

function UpdateIQDBControls() {
    if (TISAS.user_id) {
        let auto_iqdb_list = GetList('auto-iqdb-list');
        if (auto_iqdb_list.includes(TISAS.account)) {
            auto_iqdb_list = JSPLib.utility.setDifference(auto_iqdb_list,[TISAS.account]);
            auto_iqdb_list = JSPLib.utility.setUnion(auto_iqdb_list,[TISAS.user_id]);
            SaveList('auto-iqdb-list',auto_iqdb_list,false);
        }
        if (auto_iqdb_list.includes(TISAS.account) || auto_iqdb_list.includes(TISAS.user_id)) {
            TISAS.artist_iqdb_enabled = true;
            $("#tisas-enable-autoiqdb").hide();
            $("#tisas-disable-autoiqdb").show();
        } else {
            TISAS.artist_iqdb_enabled = false;
            $("#tisas-enable-autoiqdb").show();
            $("#tisas-disable-autoiqdb").hide();
        }
    }
}

function UpdateIndicatorControls() {
    let indicator_controls = JSPLib.storage.getStorageData('tisas-indicator-controls',localStorage,true);
    if (indicator_controls) {
        $(".tisas-footer-entries").show();
        $("#tisas-indicator-counter").show();
        $("#tisas-enable-indicators").hide();
        $("#tisas-disable-indicators").show();
    } else {
        $(".tisas-footer-entries").hide();
        $("#tisas-indicator-counter").hide();
        $("#tisas-enable-indicators").show();
        $("#tisas-disable-indicators").hide();
    }
}

function UpdateTweetIndicators() {
    let artist_list = GetList('artist-list');
    let tweet_list = GetList('tweet-list');
    $(".tweet").each((i,entry)=>{
        let $tweet = $(entry);
        let tweet_id = String($tweet.data('tweet-id'));
        let user_id = String($tweet.data('user-id'));
        let screen_name = String($tweet.data('screen-name'));
        if (artist_list.includes(screen_name)) {
            artist_list = JSPLib.utility.setDifference(artist_list,[screen_name]);
            artist_list = JSPLib.utility.setUnion(artist_list,[user_id]);
            SaveList('artist-list',artist_list,false);
        }
        if ($tweet.find('.tisas-indicators').length === 0) {
            return;
        }
        if (artist_list.includes(screen_name) || artist_list.includes(user_id)) {
            $(".tisas-indicators .tisas-mark-artist",entry).show();
            $(".tisas-footer-entries .tisas-mark-artist",entry).addClass("tisas-activated");
        } else {
            $(".tisas-indicators .tisas-mark-artist",entry).hide();
            $(".tisas-footer-entries .tisas-mark-artist",entry).removeClass("tisas-activated");
        }
        if (tweet_list.includes(tweet_id)) {
            $(".tisas-indicators .tisas-mark-tweet",entry).show();
            $(".tisas-footer-entries .tisas-mark-tweet",entry).addClass("tisas-activated");
        } else {
            $(".tisas-indicators .tisas-mark-tweet",entry).hide();
            $(".tisas-footer-entries .tisas-mark-tweet",entry).removeClass("tisas-activated");
        }
        if (TISAS.counted_artists.includes(user_id)) {
            $(".tisas-indicators .tisas-count-artist",entry).show();
            $(".tisas-footer-entries .tisas-count-artist",entry).addClass("tisas-activated");
        } else {
            $(".tisas-indicators .tisas-count-artist",entry).hide();
            $(".tisas-footer-entries .tisas-count-artist",entry).removeClass("tisas-activated");
        }
        if (TISAS.counted_tweets.includes(tweet_id)) {
            $(".tisas-indicators .tisas-count-tweet",entry).show();
            $(".tisas-footer-entries .tisas-count-tweet",entry).addClass("tisas-activated");
        } else {
            $(".tisas-indicators .tisas-count-tweet",entry).hide();
            $(".tisas-footer-entries .tisas-count-tweet",entry).removeClass("tisas-activated");
        }
    });
}

async function GetAllCurrentRecords() {
    GetAllCurrentRecords.is_running = true;
    let i = 0;
    while (true) {
        if (!WasOverflow() || !TISAS.database_info) {
            //Main exit condition
            break;
        }
        clearTimeout(CheckPostvers.timeout);
        if (JSPLib.concurrency.reserveSemaphore('tisas','postvers')) {
            Danbooru.Utility.notice(`Querying Danbooru...[${i}]`);
            await Timer.CheckPostvers();
        } else {
            Danbooru.Utility.notice(`Waiting on other tasks to finish...[${i}]`);
            await JSPLib.utility.sleep(post_versions_callback);
        }
        i++;
    }
    JSPLib.concurrency.freeSemaphore('tisas','records')
    GetAllCurrentRecords.is_running = false;
}
GetAllCurrentRecords.is_running = false;

function GetEventPreload(event,classname) {
    let $link = $(event.target);
    let $tweet = $link.closest(".tweet");
    let tweet_id = String($tweet.data("tweet-id"));
    let user_id = String($tweet.data("user-id"));
    let screen_name = String($tweet.data("screen-name"));
    let $replace = $(`[data-tweet-id=${tweet_id}] .${classname}`).parent();
    return [$link,$tweet,tweet_id,user_id,screen_name,$replace];
}

function IsIQDBAutoclick() {
    return TISAS.user_settings.autoclick_IQDB_enabled && ((TISAS.artist_iqdb_enabled && ((TISAS.page === "media") || (TISAS.page === "search" && TISAS.queries.filter === "images"))) || (TISAS.page === "tweet"));
}

//File functions

function ReadFileAsync(fileselector,is_json) {
    return new Promise((resolve,reject)=>{
        var files = document.querySelector(fileselector).files;
        if (!files.length) {
            alert('Please select a file!');
            reject();
            return;
        }
        var file = files[0];
        var start = 0;
        var stop = file.size - 1;
        var reader = new FileReader();
        // If we use onloadend, we need to check the readyState.
        reader.onloadend = function(event) {
            if (event.target.readyState == FileReader.DONE) { // DONE == 2
                ReadFileAsync.debuglog("File loaded:",file.size);
                let data;
                if (is_json) {
                    try {
                        data = JSON.parse(event.target.result);
                    } catch (e) {
                        ReadFileAsync.debuglog("Error: File is not JSON!");
                        reject();
                    }
                } else {
                    data = event.target.result;
                }
                resolve(data);
            }
        };
        var blob = file.slice(start, stop + 1);
        reader.readAsBinaryString(blob);
    });
}

function DownloadObject(export_obj, export_name, is_json) {
    var export_data = export_obj;
    var encoding = {type: "text/plain;charset=utf-8"};
    if (is_json) {
        export_data = JSON.stringify(export_obj);
        encoding = {type: "text/json;charset=utf-8"};
    }
    var blob = new Blob([export_data], encoding);
    saveAs(blob, export_name);
}

//Render functions

function RenderMenu() {
    let artist_html = `
<span id="tisas-artist-toggle">
    <a id="tisas-enable-highlights" title="Click to enable Tweet hiding/fading. (Shortcut: Alt+H)">Enable</a>
    <a id="tisas-disable-highlights" title="Click to disable Tweet hiding/fading. (Shortcut: Alt+H)">Disable</a>
</span>
`;
    let iqdb_html = `
<span id="tisas-iqdb-toggle">
    <a id="tisas-enable-autoiqdb" title="Click to enable auto Check IQDB click. (Shortcut: Alt+Q)">Enable</a>
    <a id="tisas-disable-autoiqdb" title="Click to disable auto Check IQDB click. (Shortcut: Alt+Q)">Disable</a>
</span>
`;
    let indicator_html = `
<span id="tisas-indicator-toggle">
    <a id="tisas-enable-indicators" title="Click to display Tweet mark/count controls. (Shortcut: Alt+I)">Enable</a>
    <a id="tisas-disable-indicators" title="Click to hide Tweet mark/count controls. (Shortcut: Alt+I)">Disable</a>
</span>
`;
    return `
<div id="tisas-side-menu">
    <div id="tisas-header">Twitter Image Searches and Stuff</div>
    <ul>
        <li><span>Database version:</span> <span id="tisas-database-stub"></span></li>
        <li><span>Current records:</span> ${RenderCurrentRecords()}</li>
        <li><span>Total records:</span> <span id="tisas-records-stub"></span></li>
        <li><span>Artist highlights:</span> ${artist_html}</li>
        <li><span>Autoclick IQDB:</span> ${iqdb_html}</li>
        <li><span>Tweet indicators:</span> ${indicator_html}</li>
    </ul>
    <div id="tisas-open-settings">
        <input type="button" title="Click to open settings menu. (Shortcut: Alt+M)" value="Settings">
    </div>
</div>
`;
}

function RenderCurrentRecords() {
    var record_html = "";
    let timestamp = JSPLib.storage.checkStorageData('tisas-recent-timestamp',ValidateProgramData,localStorage);
    if (timestamp) {
        record_html = `<a id="tisas-current-records" title="${new Date(timestamp).toLocaleString()}\n\nClick to update records to current.">${TimeAgo(timestamp)}</a>`
    }
    return record_html;
}

function RenderDatabaseVersion() {
    let timestring = new Date(TISAS.server_info.timestamp).toLocaleString();
    return `<a id="tisas-database-version" target="_blank" href="${TISAS.domain}/post_versions?page=b${TISAS.server_info.post_version+1}" title="${timestring}\n\nClick to open page to Danbooru records.">${TISAS.server_info.post_version}</a>`;
}

function RenderDownloadLinks($tweet,position) {
    let tweet_id = String($tweet.data('tweet-id'));
    let user_id = String($tweet.data('user-id'));
    let user_name = String($tweet.data('screen-name'));
    let date_string = GetDateString(Date.now());
    let time_string = GetTimeString(Date.now());
    let filename_prefix = TISAS.user_settings.filename_prefix_format.replace(/%TWEETID%/g,tweet_id).replace(/%USERID%/g,user_id).replace(/%USERACCOUNT%/g,user_name).replace(/%DATE%/g,date_string).replace(/%TIME%/g,time_string);
    var image_links = $("[data-image-url]",$tweet).map((i,image)=>{return image.dataset.imageUrl;}).toArray();
    var hrefs = image_links.map((image)=>{return image + ':orig'});
    let html = `<span class="tisas-download-header">Download Originals</span><br>`;
    for (let i = 0; i < image_links.length; i++) {
        let [image_name,extension] = image_links[i].slice(image_links[i].lastIndexOf('/')+1).split('.');
        let download_filename = filename_prefix.replace(/%ORDER%/g,'img' + (i + 1)).replace(/%IMG%/g,image_name) + '.' + extension;
       html += `<a class="tisas-download-original" href="${hrefs[i]}" download="${download_filename}">Image #${i + 1}</a>`;
    }
    if (image_links.length > 1) {
        html += `<a class="tisas-download-all" href="#">All images</a>`;
    }
    if (position === "above") {
        html = '<hr>' + html;
    } else if (position === "below") {
        html += '<hr>';
    }
    return `
<div class="tisas-download-section">
    ${html}
</div>`
}

function RenderAllSimilar(all_iqdb_results,image_urls) {
    var image_results = [];
    all_iqdb_results.forEach((iqdb_results,i)=>{
        if (iqdb_results.length === 0) {
            return;
        }
        let html = RenderSimilarContainer("Image " + (i + 1), iqdb_results, image_urls[i], i);
        image_results.push(html);
    });
    return image_results.join('\r\n<hr>\r\n');
}

function RenderSimilarContainer(header,iqdb_results,image_url,index) {
    var html = "";
    iqdb_results.forEach((iqdb_result,i)=>{
        let addons = RenderSimilarAddons(iqdb_result.post.source, iqdb_result.score, iqdb_result.post.file_ext, iqdb_result.post.file_size, iqdb_result.post.image_width, iqdb_result.post.image_height);
        html += RenderPostPreview(iqdb_result.post,addons)
    });
    let domain = 'twitter.com';
    let file_type = GetFileExtension(image_url,':');
    let thumb_url = GetThumbUrl(image_url,':','jpg') + ':small';
    let append_html = RenderSimilarAddons('https://twitter.com', null, file_type);
    return `
<div class="tisas-iqdb-result">
    <h4>${header}</h4>
     <article class="tisas-post-preview" data-id="${index}">
        <img width="150" height="150" src="${thumb_url}">
        ${append_html}
    </article>
    ${html}
</div>
`
}

function RenderPostPreview(post,append_html="") {
    let [width,height] = GetPreviewDimensions(post.image_width, post.image_height);
    return `
<article class="tisas-post-preview" data-id="${post.id}" data-size="${post.file_size}">
    <a target="_blank" href="https://danbooru.donmai.us/posts/${post.id}">
        <img width="${width}" height="${height}" title="${GetLinkTitle(MapPost(post),true)}">
    </a>
    ${append_html}
</article>
`;
}

function RenderSimilarAddons(source,score,file_ext,file_size,width,height) {
    var title_text = (JSPLib.validate.isNumber(score) ? `Similarity: ${JSPLib.utility.setPrecision(score,2)}` : "Original image");
    var domain = (source.match(/^https?:\/\//) ? GetBaseDomainName(source) : "NON-WEB");
    let size_text = (Number.isInteger(file_size) && Number.isInteger(width) && Number.isInteger(height) ? `${ReadableBytes(file_size)} (${width}x${height})` : "");
    return `
<p class="tisas-desc tisas-desc-title">${title_text}</p>
<p class="tisas-desc tisas-desc-info">${file_ext.toUpperCase()} @ ${domain}</p>
<p class="tisas-desc tisas-desc-size">${size_text}</p>
`;
}

function RenderNomatchLinks(no_iqdb_results,no_url_results=false) {
    let iqdb_link = (no_iqdb_results ? '<a class="tisas-reset-iqdb tisas-database-no-match">no results</a>' : '<a class="tisas-check-iqdb">Check IQDB</a>');
    let url_link = (no_url_results ? '<a class="tisas-manual-add tisas-database-no-match">no sources</a>' : '<a class="tisas-check-url">Check URL</a>');
    let help_info = (no_iqdb_results ? no_match_help + '\n' + no_results_help : no_match_help);
    return `
(
    <a class="tisas-manual-add tisas-database-no-match">no sources</a>
    |
    ${url_link}
    |
    ${iqdb_link}
    |
    ${RenderHelp(help_info)}
)`;
}

function RenderHelp(help_text) {
    return `<a class="tisas-help-info" title="${help_text}">&nbsp;?&nbsp;</a>`;
}

//Initialize functions

function InitializeDatabaseLink() {
    var database_html = "";
    TISAS.server_info = JSPLib.storage.getStorageData('tisas-remote-database', localStorage);
    if (TISAS.server_info === null) {
        return;
    }
    let database_timestring = new Date(TISAS.server_info.timestamp).toLocaleString();
    //Add some validation to the following, and move it out of the RenderMenu function
    TwitterStorage(JSPLib.storage.retrieveData,'tisas-database-info').then((database_info)=>{
        if (!JSPLib.validate.isHash(database_info)) {
            database_html = `<a id="tisas-install" title="${database_timestring}\n\nClick to install database.">Install Database</a>`;
        } else if (database_info.post_version === TISAS.server_info.post_version && database_info.timestamp === TISAS.server_info.timestamp) {
            TISAS.database_info = database_info;
            database_html = RenderDatabaseVersion();
        } else {
            TISAS.database_info = database_info;
            database_html = `<a id="tisas-upgrade" title="${database_timestring}\n\nClick to upgrade database.">Upgrade Database</a>`;
        }
        $("#tisas-database-stub").replaceWith(database_html);
        $("#tisas-install").on('click.tisas',InstallDatabase);
        $("#tisas-upgrade").on('click.tisas',UpgradeDatabase);
    });
    GetTotalRecords().then((data)=>{
        $("#tisas-records-stub").replaceWith(`<span id="tisas-total-records">${data}</span>`);
    });
}

function InitializeCounter(prev_pagetype) {
    if (!TISAS.user_settings.tweet_indicators_enabled) {
        return;
    }
    if ($("#tisas-indicator-counter").length) {
        if (prev_pagetype !== "tweet") {
            $("#tisas-indicator-counter").remove();
            TISAS.counted_artists = [];
            TISAS.counted_tweets = [];
        } else {
            return
        }
    }
    if (["main","likes","replies","media"].includes(TISAS.page)) {
        $(".ProfileCardMini-screenname").after(main_counter);
        $(".ProfileCanopy-card").css('margin-left','-40px');
    } else if (["search","hashtag"].includes(TISAS.page)) {
        $(".SearchNavigation-titleText").append(main_counter);
    } else if (["home","list"].includes(TISAS.page)) {
        $("#global-actions").append(`<li style="margin-top:12px">${main_counter}</li>`);
    }
}

function InitializeQtip($obj,tweet_id) {
    const qtip_settings = Object.assign(ARTIST_QTIP_SETTINGS, {
        content: {
            text: (event, qtip) => {
                if (qtip.tooltip.css('max-width') !== "none") {
                    qtip.tooltip.css('max-width','none');
                }
                return CheckIQDB.tweet_qtip[tweet_id] || "Loading...";
            }
        }
    });
    $obj.qtiptisas(qtip_settings);
}

function InitializeSimilarContainer(image_urls,all_iqdb_results,tweet_id) {
    let $attachment = $(RenderAllSimilar(all_iqdb_results,image_urls));
    $("article:first-of-type",$attachment).each((i,article)=>{
        let index = Number($(article).data('id'));
        let image_url = image_urls[index] + ':orig';
        let image = $("img",article)[0];
        let fake_image = $('<img>')[0];
        fake_image.onload = function () {
            InitializeSimilarContainer.debuglog("Image onload called!",image_url);
            let [width,height] = GetPreviewDimensions(fake_image.naturalWidth,fake_image.naturalHeight);
            image.width = width;
            image.height = height;
            let starttime = Date.now();
            GetImageSize(image_url).then((size)=>{
                $("p:nth-child(4)",article).html(`${ReadableBytes(size)} (${fake_image.naturalWidth}x${fake_image.naturalHeight})`);
                let $matching_images = $(article).closest(".tisas-iqdb-result").find(`[data-size=${size}]`);
                if ($matching_images.length) {
                    InitializeSimilarContainer.debuglog("Matching image found!",$matching_images.data('id'));
                    $("img",$matching_images).css('border','solid green 5px');
                }
            });
        };
        fake_image.src = image_url;
    });
    Promise.all(CheckIQDB.thumb_wait[tweet_id]).then((data)=>{
        data.forEach((item)=>{
            let $image = $(`[data-id=${item.post_id}] img`,$attachment);
            $(`[data-id=${item.post_id}] img`,$attachment).attr('src',item.blob_url);
        });
    });
    return $attachment;
}

//Network functions

async function CheckPostvers() {
    let postver_lastid = GetPostVersionsLastID();
    let url_addons = {search:{id:`${postver_lastid}..${postver_lastid + query_batch_size}`}};
    let post_versions = await JSPLib.danbooru.getAllItems('post_versions', query_limit, {page:postver_lastid, addons: url_addons, reverse: true, domain: TISAS.domain, notify: true});
    if (post_versions.length === query_batch_size) {
        CheckPostvers.debuglog("Overflow detected!");
        JSPLib.storage.setStorageData('tisas-overflow',true,localStorage);
    } else {
        CheckPostvers.debuglog("No overflow:",post_versions.length,query_batch_size);
        JSPLib.storage.setStorageData('tisas-overflow',false,localStorage);
    }
    let [add_entries,rem_entries] = ProcessPostvers(post_versions);
    CheckPostvers.debuglog("Process:",add_entries,rem_entries);
    let combined_keys = JSPLib.utility.setIntersection(Object.keys(add_entries),Object.keys(rem_entries));
    combined_keys.forEach((tweet_id)=>{
        let tweet_key = 'tweet-' + tweet_id;
        let post_ids = add_entries[tweet_id];
        TwitterStorage(JSPLib.storage.retrieveData,tweet_key).then((data)=>{
            if (JSPLib.validate.validateIDList(data)) {
                CheckPostvers.debuglog("Tweet adds/rems - existing IDs:",tweet_key,data);
                post_ids = JSPLib.utility.setDifference(JSPLib.utility.setUnion(data,add_entries[tweet_id]),rem_entries[tweet_id]);
            }
            if (data === null || JSPLib.utility.setSymmetricDifference(post_ids,data)) {
                CheckPostvers.debuglog("Tweet adds/rems - saving:",tweet_key,post_ids);
                TwitterStorage(JSPLib.storage.saveData,tweet_key,post_ids);
            }
        });
    });
    let single_adds = JSPLib.utility.setDifference(Object.keys(add_entries),combined_keys);
    single_adds.forEach((tweet_id)=>{
        let tweet_key = 'tweet-' + tweet_id;
        let post_ids = add_entries[tweet_id];
        TwitterStorage(JSPLib.storage.retrieveData,tweet_key).then((data)=>{
            if (JSPLib.validate.validateIDList(data)) {
                CheckPostvers.debuglog("Tweet adds - existing IDs:",tweet_key,data);
                post_ids = JSPLib.utility.setUnion(data,post_ids);
            }
            if (data === null || post_ids.length > data.length) {
                CheckPostvers.debuglog("Tweet adds - saving:",tweet_key,post_ids);
                TwitterStorage(JSPLib.storage.saveData,tweet_key,post_ids);
            }
        });
    });
    let single_rems = JSPLib.utility.setDifference(Object.keys(rem_entries),combined_keys);
    single_rems.forEach((tweet_id)=>{
        let tweet_key = 'tweet-' + tweet_id;
        let post_ids = [];
        TwitterStorage(JSPLib.storage.retrieveData,tweet_key).then((data)=>{
            if (data !== null && JSPLib.validate.validateIDList(data)) {
                CheckPostvers.debuglog("Tweet removes - existing IDs:",tweet_key,data);
                post_ids = JSPLib.utility.setDifference(data,rem_entries[tweet_id]);
            }
            if (post_ids.length) {
                CheckPostvers.debuglog("Tweet removes - saving:",tweet_key,post_ids);
                TwitterStorage(JSPLib.storage.saveData,tweet_key,post_ids);
            } else {
                CheckPostvers.debuglog("Tweet removes - deleting:",tweet_key);
                TwitterStorage(JSPLib.storage.removeData,tweet_key);
            }
        });
    });
    let lastid = JSPLib.danbooru.getNextPageID(post_versions,true);
    //Since the post version last ID is critical, an extra sanity check has been added
    if (JSPLib.validate.validateID(lastid)) {
        JSPLib.storage.setStorageData('tisas-postver-lastid', lastid, localStorage);
        let all_timestamps = JSPLib.utility.getObjectAttributes(post_versions,'updated_at');
        let normal_timestamps = all_timestamps.map((timestamp)=>{return new Date(timestamp).getTime();})
        let most_recent_timestamp = Math.max(...normal_timestamps);
        JSPLib.storage.setStorageData('tisas-recent-timestamp', most_recent_timestamp, localStorage);
        $("#tisas-current-records").replaceWith(RenderCurrentRecords());
        $("#tisas-current-records").on('click.tisas',CurrentRecords);
    }
    JSPLib.concurrency.setRecheckTimeout('tisas-timeout',GetPostVersionsExpiration());
    JSPLib.concurrency.freeSemaphore('tisas','postvers');
}

function GetImage(image_url) {
    JSPLib.debug.recordTime(image_url,'Network');
    return new Promise((resolve,reject)=>{
        GM.xmlHttpRequest({
            method: "GET",
            url: image_url,
            responseType: 'blob',
            onload: function(resp) {
                JSPLib.debug.recordTimeEnd(image_url,'Network');
                resolve(resp.response);
            },
            onerror: function(resp) {
                JSPLib.debug.recordTimeEnd(image_url,'Network');
                reject(resp);
            }
        });
    });
}

function GetImageSize(image_url) {
    JSPLib.debug.recordTime(image_url,'Network');
    return new Promise((resolve,reject)=>{
        GM.xmlHttpRequest({
            method: "HEAD",
            url: image_url,
            onload: function(resp) {
                JSPLib.debug.recordTimeEnd(image_url,'Network');
                let size = -1;
                let match = resp.responseHeaders.match(/content-length: (\d+)/);
                if (match) {
                    size = parseInt(match[1]);
                }
                resolve(size);
            },
            onerror: function(resp) {
                JSPLib.debug.recordTimeEnd(image_url,'Network');
                reject(resp);
            }
        });
    });
}

//Database functions

async function LoadDatabase() {
    LoadDatabase.debuglog("starting tweet load");
    JSPLib.debug.debugTime("database-network");
    var tweet_data = await $.getJSON(server_database_url);
    JSPLib.debug.debugTimeEnd("database-network");
    return Timer.SaveDatabase(tweet_data,"#tisas-counter");
}

async function SaveDatabase(database,counter_selector) {
    var database_keys = Object.keys(database);
    let batches = Math.floor(database_keys.length / 2000);
    SaveDatabase.debuglog("Database size:",database_keys.length);
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
            SaveDatabase.debuglog("Saving batch #",batches);
            JSPLib.debug.debugTime("database-save-" + batches);
            await JSPLib.storage.twitterstorage.setItems(payload);
            JSPLib.debug.debugTimeEnd("database-save-" + batches);
            //Give some control back to the user
            await JSPLib.utility.sleep(500);
            payload = {};
        }
    }
}

async function GetSavePackage() {
    let save_package = {program_data: {}, tweet_database: {}};
    Object.keys(localStorage).forEach((key)=>{
        if (key.match(/^tisas-/)) {
            save_package.program_data[key] = JSPLib.storage.getStorageData(key,localStorage);
        }
    });
    let database_length = await GetTotalRecords();
    let batch_counter = Math.floor(database_length / 10000);
    await JSPLib.storage.twitterstorage.iterate((value,key,i)=>{
        let match = key.match(/^tweet-(\d+)$/);
        if (match) {
            save_package.tweet_database[match[1]] = value;
        } else if (key === 'tisas-database-info') {
            save_package.database_info = value;
        }
        if ((i % 10000) === 0) {
            $("#tisas-export-counter").html(--batch_counter);
        }
    });
    return save_package;
}

async function CheckDatabaseInfo(initial) {
    if (initial || JSPLib.concurrency.checkTimeout('tisas-database-recheck',database_recheck_expires)) {
        let database_info = await $.getJSON(database_info_url);
        JSPLib.storage.setStorageData('tisas-remote-database', database_info, localStorage);
        JSPLib.concurrency.setRecheckTimeout('tisas-database-recheck',database_recheck_expires);
    }
}

async function PurgeBadTweets() {
    let server_purgelist = await $.getJSON(server_purgelist_url);
    let purge_keylist = server_purgelist.map((tweet_id)=>{return 'tweet-' + tweet_id;});
    let database_keylist = await JSPLib.storage.twitterstorage.keys();
    let purge_set = new Set(purge_keylist)
    let database_set = new Set(database_keylist)
    let delete_keys = [...purge_set].filter((x)=>{return database_set.has(x);});
    PurgeBadTweets.debuglog(delete_keys);
    await Promise.all(delete_keys.map((key)=>{return TwitterStorage(JSPLib.storage.removeData,key);}));
}

//Event handlers

function ToggleArtistHilights(event) {
    if (TISAS.user_id) {
        let no_highlight_list = GetList('no-highlight-list');
        if (no_highlight_list.includes(TISAS.account) || no_highlight_list.includes(TISAS.user_id)) {
            no_highlight_list = JSPLib.utility.setDifference(no_highlight_list,[TISAS.account,TISAS.user_id]);
        } else {
            no_highlight_list = JSPLib.utility.setUnion(no_highlight_list,[TISAS.user_id]);
        }
        SaveList('no-highlight-list',no_highlight_list);
        UpdateHighlightControls();
        setTimeout(()=>{UpdateArtistHighlights();},1);
    }
    event.preventDefault();
}

function ToggleAutoclickIQDB(event) {
    if (TISAS.user_id) {
        let auto_iqdb_list = GetList('auto-iqdb-list');
        if (auto_iqdb_list.includes(TISAS.account) || auto_iqdb_list.includes(TISAS.user_id)) {
            auto_iqdb_list = JSPLib.utility.setDifference(auto_iqdb_list,[TISAS.account,TISAS.user_id]);
        } else {
            auto_iqdb_list = JSPLib.utility.setUnion(auto_iqdb_list,[TISAS.user_id]);
        }
        SaveList('auto-iqdb-list',auto_iqdb_list);
        UpdateIQDBControls();
    }
    event.preventDefault();
}

function ToggleTweetIndicators(event) {
    let indicator_controls = JSPLib.storage.getStorageData('tisas-indicator-controls',localStorage,true);
    JSPLib.storage.setStorageData('tisas-indicator-controls',!indicator_controls,localStorage);
    UpdateIndicatorControls();
    setTimeout(()=>{UpdateTweetIndicators();},1);
    event.preventDefault();
}

function InstallDatabase(event) {
    let message = `
This will install the database (${TISAS.server_info.post_version}, ${new Date(TISAS.server_info.timestamp).toLocaleString()}).
This can take a couple of minutes.

Click OK when ready.
`;
    if (confirm(message.trim())) {
        $("#tisas-install").replaceWith(load_counter)
        LoadDatabase().then(()=>{
            TwitterStorage(JSPLib.storage.saveData,'tisas-database-info',{post_version: TISAS.server_info.post_version, timestamp: TISAS.server_info.timestamp});
            $("#tisas-load-message").replaceWith(RenderDatabaseVersion());
            localStorage.removeItem('tisas-length-recheck');
            GetTotalRecords().then((length)=>{
                $("#tisas-total-records").html(length);
            });
            Danbooru.Utility.notice("Database installed!");
        });
    }
    event.preventDefault();
}

function UpgradeDatabase(event) {
    let message = `
This will upgrade the database to (${TISAS.server_info.post_version}, ${new Date(TISAS.server_info.timestamp).toLocaleString()}).
Old database is at (${TISAS.database_info.post_version}, ${new Date(TISAS.database_info.timestamp).toLocaleString()}).
This can take a couple of minutes.

Click OK when ready.
`;
    if (confirm(message.trim())) {
        $("#tisas-upgrade").replaceWith(load_counter);
        LoadDatabase().then(()=>{
            TwitterStorage(JSPLib.storage.saveData,'tisas-database-info',{post_version: TISAS.server_info.post_version, timestamp: TISAS.server_info.timestamp});
            $("#tisas-load-message").replaceWith(RenderDatabaseVersion());
            localStorage.removeItem('tisas-length-recheck');
            GetTotalRecords().then((length)=>{
                $("#tisas-total-records").html(length);
            });
            Danbooru.Utility.notice("Database upgraded!");
            Timer.PurgeBadTweets().then(()=>{
                UpgradeDatabase.debuglog("All bad Tweets purged");
            });
        });
    }
    event.preventDefault();
}

function CurrentRecords(event) {
    if (!GetAllCurrentRecords.is_running && WasOverflow()) {
        let message = `
This will keep querying Danbooru until the records are current.
Depending on the current position, this could take several minutes.
Moving focus away from the page will halt the process.

Continue?
`;
        if (JSPLib.concurrency.reserveSemaphore('tisas','records')) {
            if (confirm(message.trim())) {
                GetAllCurrentRecords();
            } else {
                JSPLib.concurrency.freeSemaphore('tisas','records')
            }
        } else {
            Danbooru.Utility.error("Getting current records in another tab!");
        }
    }
    event.preventDefault();
}

function CheckUrl(event) {
    let [$link,$tweet,tweet_id,user_id,screen_name,$replace] = GetEventPreload(event,'tisas-check-url');
    $link.removeClass('tisas-check-url').html("loading…");
    let no_iqdb_results = $tweet.find(".tisas-check-iqdb").length === 0;
    let normal_url = `https://twitter.com/${screen_name}/status/${tweet_id}`;
    let wildcard_url = `https://twitter.com/*/status/${tweet_id}`;
    let check_url = (TISAS.user_settings.URL_wildcards_enabled ? wildcard_url : normal_url);
    CheckUrl.debuglog(check_url);
    JSPLib.danbooru.submitRequest('posts',{tags: "source:" + check_url},[],null,TISAS.domain,true).then((data)=>{
        if (data.length === 0) {
            if (TISAS.user_settings.autocheck_IQDB_enabled) {
                $tweet.find(".tisas-check-iqdb").click();
            }
            $replace.html(RenderNomatchLinks(no_iqdb_results,true));
        } else {
            let mapped_data = MapPostData(data);
            mapped_data.forEach((post,i)=>{SavePost(data[i].id, post);});
            let post_ids = JSPLib.utility.getObjectAttributes(data,'id');
            let helplink = RenderHelp(confirm_delete_help);
            let postlink = "";
            if (data.length === 1) {
                postlink = `( <a class="tisas-confirm-delete tisas-database-match" target="_blank" href="${TISAS.domain}/posts/${post_ids[0]}" title="${GetLinkTitle(mapped_data[0])}">post #${post_ids[0]}</a> | ${helplink} )`
            } else {
                postlink = `( <a class="tisas-confirm-delete tisas-database-match" target="_blank" href="${TISAS.domain}/posts?tags=status%3Aany+id%3A${post_ids.join(',')}${GetCustomQuery()}" title="${GetMultiLinkTitle(post_ids,mapped_data)}">${post_ids.length} sources</a> | ${helplink} )`;
            }
            TwitterStorage(JSPLib.storage.saveData,'tweet-' + tweet_id, post_ids);
            $replace.html(postlink);
        }
    });
    event.preventDefault();
}

function CheckIQDB(event) {
    let [$link,$tweet,tweet_id,user_id,screen_name,$replace] = GetEventPreload(event,'tisas-check-iqdb');
    $link.removeClass('tisas-check-iqdb').html("loading…");
    let no_url_results = $tweet.find(".tisas-check-url").length === 0;
    let image_urls = $tweet.find("[data-image-url]").map((i,entry)=>{return $(entry).data('image-url');}).toArray();
    CheckIQDB.debuglog(image_urls);
    let promise_array = image_urls.map((image_url)=>{return JSPLib.danbooru.submitRequest('iqdb_queries',{url: image_url},[],null,TISAS.domain,true);});
    Promise.all(promise_array).then((data)=>{
        let flat_data = data.flat();
        let unique_posts = RemoveDuplicates(JSPLib.utility.getObjectAttributes(flat_data,'post'),'id');
        if (flat_data.length > 0) {
            let post_data = JSPLib.utility.getObjectAttributes(flat_data,'post');
            let mapped_data = MapPostData(unique_posts);
            mapped_data.forEach((post,i)=>{SavePost(unique_posts[i].id, post);});
            let max_score = Math.max(...JSPLib.utility.getObjectAttributes(flat_data,'score'));
            let classnames = "tisas-iqdb-match-poor";
            if (max_score > 95.0) {
                classnames = "tisas-iqdb-match-great";
            } else if (max_score > 90.0) {
                classnames = "tisas-iqdb-match-good";
            } else if (max_score > 85.0) {
                classnames = "tisas-iqdb-match-fair";
            }
            let post_ids = JSPLib.utility.getObjectAttributes(flat_data,'post_id');
            let helplink = "";
            if (TISAS.user_settings.autosave_IQDB_enabled || IsIQDBAutoclick()) {
                TwitterStorage(JSPLib.storage.saveData,'tweet-' + tweet_id, post_ids);
                classnames += " tisas-confirm-delete";
                helplink = RenderHelp(confirm_delete_help);
            } else {
                classnames += " tisas-confirm-iqdb";
                helplink = RenderHelp(confirm_iqdb_help);
            }
            TISAS.IQDB_results = TISAS.IQDB_results || {};
            TISAS.IQDB_results[tweet_id] = post_ids;
            let postlink = "";
            if (post_ids.length === 1) {
                postlink = `( <a class="${classnames}" target="_blank" href="${TISAS.domain}/posts/${post_ids[0]}" title="${GetLinkTitle(mapped_data[0])}">post #${post_ids[0]}</a> | ${helplink} )`
            } else {
                postlink = `( <a class="${classnames}" target="_blank" href="${TISAS.domain}/posts?tags=status%3Aany+id%3A${post_ids.join(',')}${GetCustomQuery()}"  title="${GetMultiLinkTitle(post_ids,mapped_data)}">${post_ids.length} sources</a> | ${helplink} )`;
            }
            $replace.html(postlink);
            if (!TISAS.user_settings.autosave_IQDB_enabled && !IsIQDBAutoclick() && TISAS.user_settings.advanced_tooltips_enabled) {
                InitializeQtip($tweet.find('.tisas-confirm-iqdb'),tweet_id);
                //Some elements are delayed in rendering, so render ahead of time
                CheckIQDB.thumb_wait[tweet_id] = unique_posts.map(async (post)=>{
                    let blob = await GetImage(post.preview_file_url);
                    let image_blob = blob.slice(0, blob.size, "image/jpeg");
                    let blob_url = window.URL.createObjectURL(image_blob);
                    return {
                        post_id: post.id,
                        blob_url: blob_url
                    };
                });
                CheckIQDB.tweet_qtip[tweet_id] = InitializeSimilarContainer(image_urls,data,tweet_id);
            }
        } else {
            JSPLib.storage.saveData('iqdb-' + tweet_id, {value: true, expires: JSPLib.utility.getExpiration(iqdb_expires)});
            $replace.html(RenderNomatchLinks(true,no_url_results));
        }
    });
    event.preventDefault();
}
CheckIQDB.tweet_qtip = {};
CheckIQDB.IQDB_results = {};
CheckIQDB.thumb_wait = {};

function ManualAdd(event) {
    let [$link,$tweet,tweet_id,user_id,screen_name,$replace] = GetEventPreload(event,'tisas-manual-add');
    let confirmed_ids = prompt("Enter the post IDs of matches separated by commas.");
    if (confirmed_ids === null) {
        return;
    }
    confirmed_ids = confirmed_ids.split(',').map(Number).filter((num)=>{return JSPLib.validate.validateID(num);});
    ManualAdd.debuglog("Confirmed IDs:",confirmed_ids);
    if (confirmed_ids.length) {
        TwitterStorage(JSPLib.storage.saveData,'tweet-' + tweet_id, confirmed_ids);
        let postlink = "";
        let helplink = RenderHelp(confirm_delete_help);
        if (confirmed_ids.length === 1) {
            postlink = `( <a class="tisas-confirm-delete tisas-database-match" target="_blank" href="${TISAS.domain}/posts/${confirmed_ids[0]}">post #${confirmed_ids[0]}</a> | ${helplink} )`
        } else {
            postlink = `( <a class="tisas-confirm-delete tisas-database-match" target="_blank" href="${TISAS.domain}/posts?tags=status%3Aany+id%3A${confirmed_ids.join(',')}${GetCustomQuery()}">${confirmed_ids.length} sources</a> | ${helplink} )`;
        }
        $replace.html(postlink);
    }
    event.preventDefault();
}

function ConfirmIQDB(event) {
    if (!TISAS.user_settings.confirm_IQDB_enabled) {
        return;
    }
    let [$link,$tweet,tweet_id,user_id,screen_name,$replace] = GetEventPreload(event,'tisas-confirm-iqdb');
    let post_ids = TISAS.IQDB_results[tweet_id];
    let confirmed_ids = prompt("Which of the following post IDs are valid IQDB hits?",post_ids.join(','));
    if (confirmed_ids !== null) {
        confirmed_ids = confirmed_ids.split(',').map(Number).filter((num)=>{return JSPLib.validate.validateID(num);});
        ConfirmIQDB.debuglog("Confirmed IDs:",confirmed_ids);
        if (confirmed_ids.length) {
            TwitterStorage(JSPLib.storage.saveData,'tweet-' + tweet_id, confirmed_ids);
            $replace.find('.tisas-help-info').attr('title',confirm_delete_help);
            $replace.find('.tisas-confirm-iqdb').removeClass("tisas-confirm-iqdb").addClass('tisas-confirm-delete');
        }
    }
    event.preventDefault();
}

function ConfirmDelete(event) {
    if (!TISAS.user_settings.confirm_delete_enabled) {
        return;
    }
    let [$link,$tweet,tweet_id,user_id,screen_name,$replace] = GetEventPreload(event,'tisas-confirm-delete');
    if (confirm("Delete this tweet info?")) {
        TwitterStorage(JSPLib.storage.removeData,'tweet-' + tweet_id);
        JSPLib.storage.checkLocalDB('iqdb-' + tweet_id, ValidateEntry, iqdb_expires).then((data)=>{
            let has_no_results = false;
            if (data === null) {
                JSPLib.storage.saveData('iqdb-' + tweet_id, {value: false, expires: JSPLib.utility.getExpiration(iqdb_expires)});
            } else {
                has_no_results = data.value;
            }
            $replace.html(RenderNomatchLinks(has_no_results));
        });
    }
    event.preventDefault();
}

function ResetIQDB(event) {
    let [$link,$tweet,tweet_id,user_id,screen_name,$replace] = GetEventPreload(event,'tisas-reset-iqdb');
    JSPLib.storage.saveData('iqdb-' + tweet_id, {value: false, expires: JSPLib.utility.getExpiration(iqdb_expires)});
    $replace.html(RenderNomatchLinks(false));
    event.preventDefault();
}

function HelpInfo(event) {
    let help_text = $(event.target).attr('title');
    alert(help_text);
    event.preventDefault();
}

function MarkArtist(event) {
    let [$link,$tweet,tweet_id,user_id,screen_name,$replace] = GetEventPreload(event,'tisas-mark-artist');
    let artist_list = GetList('artist-list');
    if (artist_list.includes(screen_name) || artist_list.includes(user_id)) {
        artist_list = JSPLib.utility.setDifference(artist_list,[user_id,screen_name]);
    } else {
        artist_list = JSPLib.utility.setUnion(artist_list,[user_id]);
    }
    SaveList('artist-list',artist_list);
    $link.toggleClass('tisas-activated');
    $tweet.find('.tisas-indicators .tisas-mark-artist').toggle();
    setTimeout(()=>{UpdateTweetIndicators();},1);
    event.preventDefault();
}

function MarkTweet(event) {
    let [$link,$tweet,tweet_id,user_id,screen_name,$replace] = GetEventPreload(event,'tisas-mark-tweet');
    let tweet_list = GetList('tweet-list');
    if (tweet_list.includes(tweet_id)) {
        tweet_list = JSPLib.utility.setDifference(tweet_list,[tweet_id]);
    } else {
        tweet_list = JSPLib.utility.setUnion(tweet_list,[tweet_id]);
    }
    SaveList('tweet-list',tweet_list);
    $link.toggleClass('tisas-activated');
    $tweet.find('.tisas-indicators .tisas-mark-tweet').toggle();
    event.preventDefault();
}

function CountArtist(event) {
    let [$link,$tweet,tweet_id,user_id,screen_name,$replace] = GetEventPreload(event,'tisas-count-artist');
    if (TISAS.counted_artists.includes(user_id)) {
        TISAS.counted_artists = JSPLib.utility.setDifference(TISAS.counted_artists,[user_id]);
    } else {
        TISAS.counted_artists = JSPLib.utility.setUnion(TISAS.counted_artists,[user_id]);
    }
    $link.toggleClass('tisas-activated');
    $tweet.find('.tisas-indicators .tisas-count-artist').toggle();
    setTimeout(()=>{UpdateTweetIndicators();},1);
    $("#tisas-indicator-counter .tisas-count-artist").html(TISAS.counted_artists.length);
    event.preventDefault();
}

function CountTweet(event) {
    let [$link,$tweet,tweet_id,user_id,screen_name,$replace] = GetEventPreload(event,'tisas-count-tweet');
    if (TISAS.counted_tweets.includes(tweet_id)) {
        TISAS.counted_tweets = JSPLib.utility.setDifference(TISAS.counted_tweets,[tweet_id]);
    } else {
        TISAS.counted_tweets = JSPLib.utility.setUnion(TISAS.counted_tweets,[tweet_id]);
    }
    $link.toggleClass('tisas-activated');
    $tweet.find('.tisas-indicators .tisas-count-tweet').toggle();
    $("#tisas-indicator-counter .tisas-count-tweet").html(TISAS.counted_tweets.length);
    event.preventDefault();
}

function DownloadOriginal(event) {
    let [$link,$tweet,tweet_id,user_id,screen_name,$replace] = GetEventPreload(event,'tisas-download-original');
    let image_link = $link.attr('href');
    let download_name = $link.attr('download');
    DownloadOriginal.debuglog("Saving",image_link,"as",download_name);
    saveAs(image_link,download_name);
    event.preventDefault();
}

function DownloadAll(event) {
    let [$link,$tweet,tweet_id,user_id,screen_name,$replace] = GetEventPreload(event,'tisas-download-all');
    let $image_links = $tweet.find('.tisas-download-original');
    $image_links.click();
    event.preventDefault();
}

function ExportData(event) {
    if (!ExportData.is_running) {
        ExportData.is_running = true;
        Danbooru.Utility.notice("Exporting data!");
        Timer.GetSavePackage().then((save_package)=>{
            let filename = "TISAS-data-" + GetNumericTimestamp(Date.now()) + ".json";
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
        ReadFileAsync("#tisas-import-file",true).then((import_package)=>{
            Danbooru.Utility.notice("Importing data!");
            let promise_array = [];
            ImportData.debuglog("Program data:",import_package.program_data);
            Object.keys(import_package.program_data).forEach((key)=>{
                JSPLib.storage.setStorageData(key,import_package.program_data[key],localStorage);
            });
            ImportData.debuglog("Database info:",import_package.database_info);
            promise_array.push(TwitterStorage(JSPLib.storage.saveData,'tisas-database-info',import_package.database_info));
            ImportData.debuglog("Database length:",Object.keys(import_package.tweet_database).length);
            promise_array.push(Timer.SaveDatabase(import_package.tweet_database,"#tisas-import-counter"));
            Promise.all(promise_array).then(()=>{
                Danbooru.Utility.notice("Database imported! Refreshing page...");
                //It's easier to just reload the page instead of re-rendering everything
                setTimeout(()=>{window.location = window.location;},page_refresh_timeout);
                ImportData.is_running = false;
            });
        }).catch((error)=>{
            ImportData.is_running = false;
        });
    }
    event.preventDefault();
}
ImportData.is_running = false;

//Main execution functions

function RegularCheck() {
    let prev_pagetype = TISAS.page;
    let [pagetype,pageid] = GetPageType();
    if (pagetype === null) {
        return;
    }
    //Process events on a page change
    if (TISAS.page !== pagetype || TISAS.addon !== pageid) {
        let params;
        TISAS.page = pagetype;
        TISAS.addon = pageid;
        switch(TISAS.page) {
            case "home":
                RegularCheck.debuglog("Home timeline");
                TISAS.account = undefined;
                TISAS.user_id = undefined;
                break;
            case "main":
            case "likes":
            case "replies":
                RegularCheck.debuglog("Main timeline:",TISAS.addon);
                TISAS.account = TISAS.addon;
                TISAS.user_id = $(".ProfileNav").data('user-id');
                if (TISAS.account === "following" || TISAS.account === "lists") {
                    return;
                }
                break;
            case "media":
                RegularCheck.debuglog("Media timeline:",TISAS.addon);
                TISAS.account = TISAS.addon;
                TISAS.user_id = $(".ProfileNav").data('user-id');
                break;
            case "list":
                RegularCheck.debuglog("List timeline:",TISAS.addon);
                TISAS.account = undefined;
                TISAS.user_id = undefined;
                break;
            case "hashtag":
                RegularCheck.debuglog("Hashtag timeline:",TISAS.addon);
                TISAS.account = undefined;
                TISAS.user_id = undefined;
                break;
            case "search":
                RegularCheck.debuglog("Search timeline:",TISAS.addon);
                params = JSPLib.utility.parseParams(TISAS.addon);
                TISAS.queries = ParseQueries(params.q);
                TISAS.account = ('from' in TISAS.queries ? TISAS.queries.from : undefined);
                TISAS.user_id = (TISAS.account ? $(".original-tweet").data('user-id') : undefined);
                break;
            case "tweet":
                RegularCheck.debuglog("Tweet ID:",TISAS.addon);
                TISAS.account = undefined;
                TISAS.user_id = undefined;
                break;
            default:
                //Do nothing
        }
        //Only render pages with attachment points
        if (["home","main","likes","replies","media","list","search","hashtag"].includes(TISAS.page)) {
            if ($("#tisas-side-menu").length === 0) {
                if (TISAS.page === "search" || TISAS.page === "hashtag") {
                    $(".SidebarFilterModule").after(RenderMenu());
                } else if (TISAS.page === "list") {
                    $(".dashboard-left").append(RenderMenu());
                } else if (TISAS.page === "home") {
                    $(".DashboardProfileCard").after(RenderMenu());
                } else {
                    $(".ProfileSidebar--withLeftAlignment").append(RenderMenu());
                }
                InitializeDatabaseLink();
            }
            //Bind events for creation/rebind
            if (!JSPLib.utility.isNamespaceBound("#tisas-open-settings",'click','tisas')) {
                $("#tisas-current-records").on('click.tisas',CurrentRecords);
                $("#tisas-enable-highlights,#tisas-disable-highlights").on('click.tisas',ToggleArtistHilights);
                $("#tisas-enable-autoiqdb,#tisas-disable-autoiqdb").on('click.tisas',ToggleAutoclickIQDB);
                $("#tisas-enable-indicators,#tisas-disable-indicators").on('click.tisas',ToggleTweetIndicators);
                $("#tisas-open-settings").on('click.tisas',OpenSettingsMenu);
                //These will only get bound here on a rebind
                $("#tisas-install").on('click.tisas',InstallDatabase);
                $("#tisas-upgrade").on('click.tisas',UpgradeDatabase);
            }
            InitializeCounter(prev_pagetype);
        }
        UpdateHighlightControls();
        UpdateIQDBControls();
        UpdateIndicatorControls();
        SetCheckPostvers();
        if (prev_pagetype !== undefined) {
            UpdateArtistHighlights();
            UpdateTweetIndicators();
        }
    }
    //Process events at each interval
    if (TISAS.user_settings.autoclick_IQDB_enabled) {
        if (TISAS.artist_iqdb_enabled && ((TISAS.page === "media") || (TISAS.page === "search" && TISAS.queries.filter === "images"))) {
            $(".tisas-check-iqdb").click();
        } else if (TISAS.page === "tweet") {
            $(`.permalink-tweet[data-tweet-id=${TISAS.addon}] .tisas-check-iqdb`).click();
        }
    }
    if (TISAS.user_settings.display_upload_link) {
        let $popup_tweets = $(".Tweet--invertedColors:not([tisas])");
        $popup_tweets.each((i,entry)=>{
            let $media_image = $(".media-image");
            if ($media_image.length) {
                let image_url = $media_image[0].src.replace(/:(small|medium|large|orig)/,'') + ':orig';
                let tweet_url = "https://twitter.com" + $(entry).data('permalink-path');
                let url_addons = $.param({url: image_url, ref: tweet_url});
                $(".ProfileTweet-action--more",entry).before(`<div class="ProfileTweet-action tisas-upload" ><a target="_blank" href="${TISAS.domain}/uploads/new?${url_addons}">Upload</a></div>`);
            }
            $(entry).attr('tisas','done');
        });
    }
    //Process events on new tweets
    let $tweets = $(".tweet:not(.Tweet--invertedColors,.RetweetDialog-tweet):not([tisas])");
    let $image_tweets = $tweets.filter((i,entry)=>{return $(entry).find(".AdaptiveMedia:not(.is-video)").length;});
    if ($tweets.length === 0) {
        return;
    }
    RegularCheck.debuglog("Unprocessed:",$tweets.length);
    let timeline_class = "tisas-logged-out";
    if($("body").hasClass("logged-in")) {
        timeline_class = "tisas-logged-in";
    }
    if (["home","main","likes","replies","list","hashtag"].includes(TISAS.page)) {
        ProcessTweets($image_tweets,null,".ProfileTweet-actionList",`<div class="ProfileTweet-action tisas-timeline-menu ${timeline_class}"></div>`);
    } else if (TISAS.page === "search") {
        ProcessTweets($image_tweets,"[data-has-cards]:not([data-card2-type])",".ProfileTweet-actionList",`<div class="ProfileTweet-action tisas-timeline-menu {timeline_class}"></div>`);
        if (TISAS.account && TISAS.queries.filter === "images") {
            HighlightTweets();
        }
    } else if (TISAS.page === "media") {
        ProcessTweets($image_tweets,null,".ProfileTweet-actionList",`<div class="ProfileTweet-action tisas-timeline-menu ${timeline_class}"></div>`);
        HighlightTweets();
    } else if (TISAS.page === "tweet") {
        let $tweet = $image_tweets.filter(`[data-tweet-id=${TISAS.addon}][data-has-cards]:not(.dismissible-content,[data-card2-type])`);
        if ($tweet.length) {
            ProcessTweets($tweet,null,".client-and-actions",'<span class="tisas-tweet-menu"></span>');
            if (TISAS.user_settings.original_download_enabled) {
                let download_html = RenderDownloadLinks($tweet,TISAS.user_settings.download_position[0]);
                if (TISAS.user_settings.download_position[0] === "above") {
                    $(".tweet-text",$tweet).append(download_html);
                } else if (TISAS.user_settings.download_position[0] === "below") {
                    $(".AdaptiveMediaOuterContainer",$tweet).after(download_html);
                }
            }
            if (TISAS.user_settings.display_media_link) {
                let screen_name = String($tweet.data('screen-name'));
                let js_nav = (prev_pagetype !== undefined ? "js-nav" : "js-navigateBack");
                $tweet.find('.permalink-header .time').before(`<a class="tisas-media-link EdgeButton--secondary ${js_nav}" href="/${screen_name}/media">Media</a>`);
                $tweet.find(".ProfileTweet-action--more").css('grid-column', '4 / auto');
            }
        }
    }
    if (TISAS.user_settings.auto_unhide_tweets_enabled) {
        UnhideTweets();
    }
    if (TISAS.user_settings.display_retweet_id) {
        let $retweets = $tweets.filter("[data-retweet-id]");
        $retweets.each((i,entry)=>{
            let retweet_id = String($(entry).data('retweet-id'));
            $(".tweet-context",entry).append(`<span>${retweet_id}</span>`);
        });
    }
    if (TISAS.user_settings.tweet_indicators_enabled) {
        $tweets.each((i,entry)=>{
            if ($(entry).closest(".permalink-tweet-container").length) {
                $(".FullNameGroup",entry).append(tweet_indicators);
            } else if ($(entry).closest(".permalink-replies").length) {
                $(".time",entry).append(tweet_indicators);
                $(".stream-item-header",entry).css('position','relative');
                $(".tisas-indicators",entry).css('position','absolute').css('top','-3px');
            } else {
                if ($(".context div",entry).length === 0) {
                    $(".context",entry).append("<div></div>");
                }
                $(".context div",entry).append(tweet_indicators);
            }
            $(".stream-item-footer",entry).append(indicator_links);
        });
        UpdateTweetIndicators();
    }
    $tweets.attr("tisas", "done");
}

function HighlightTweets() {
    if (!TISAS.user_settings.score_highlights_enabled) {
        return;
    }
    var $tweets = $(".stream-item:not(.tisas-highlight) > .tweet");
    $tweets.each((i,entry)=>{
        var $entry = $(entry);
        $entry.parent().addClass('tisas-highlight');
        var tweetid = String($entry.data("tweet-id"));
        var replies = Number($(".ProfileTweet-action--reply .ProfileTweet-actionCount",entry).data("tweet-stat-count"));
        var retweets = Number($(".ProfileTweet-action--retweet .ProfileTweet-actionCount",entry).data("tweet-stat-count"));
        var favorites = Number($(".ProfileTweet-action--favorite .ProfileTweet-actionCount",entry).data("tweet-stat-count"));
        HighlightTweets.tweetarray.push({
            id: tweetid,
            replies: replies,
            retweets: retweets,
            favorites: favorites,
            entry: entry
        });
        TISAS.tweet_pos.push(tweetid);
        TISAS.tweet_faves.push(favorites);
    });
    HighlightTweets.debuglog("Tweets:",TISAS.tweet_pos);
    HighlightTweets.debuglog("Faves:",TISAS.tweet_faves);
    HighlightTweets.debuglog("Finish:",TISAS.tweet_finish);
    var current_count = $.extend({},...score_levels.map((level)=>{return {[level]: 0}}));
    HighlightTweets.tweetarray.forEach((tweet)=>{
        let quartile = GetTweetQuartile(tweet.id);
        let level = score_levels[quartile];
        current_count[level]++;
        if (tweet.id in TISAS.tweet_finish) {
            return;
        }
        var $container = $(tweet.entry).parent();
        $container.removeClass(JSPLib.utility.joinList(score_levels,'tisas-',' ')).addClass(`tisas-${level}`);
    });
    UpdateArtistHighlights();
    HighlightTweets.debuglog("Excellent:",current_count.excellent,"Good:",current_count.good,"Above average:",current_count.aboveavg,"Fair:",current_count.fair,"Belowavg:",current_count.belowavg,"Poor:",current_count.poor);
}
HighlightTweets.tweetarray = [];

function UnhideTweets() {
    let $hidden_tweets = $(".Tombstone-action.js-display-this-media.btn-link:not(.clicked)");
    if ($hidden_tweets.length) {
        UnhideTweets.debuglog("Found hidden tweets:", $hidden_tweets.length);
        $hidden_tweets.click();
        $hidden_tweets.addClass("clicked");
    }
}

//Settings functions

////Need a Broadcast function here

function OpenSettingsMenu(event) {
    if ($("#twitter-image-searches-and-stuff").length === 0) {
        Timer.RenderSettingsMenu();
        let $close = $( "#twitter-image-searches-and-stuff" ).closest(".ui-dialog").find(".ui-dialog-titlebar-close");
        $close.attr('title',"Close (Shortcut: Alt+C)");
    }
    $( "#twitter-image-searches-and-stuff" ).dialog("open");
    FixDialogPosition();
}

function CloseSettingsMenu(event) {
    let $close_link = $("#twitter-image-searches-and-stuff").closest('.ui-dialog').find(".ui-dialog-titlebar-close");
    $close_link.click();
}

function FixDialogPosition() {
    let $container = $( "#twitter-image-searches-and-stuff" ).closest(".ui-dialog");
    let match = $(".ui-dialog").css('top').match(/(.+)px/);
    if (["main","likes","replies","media"].includes(TISAS.page)) {
        let min_height = $(".ProfileCanopy-header")[0].clientHeight + $(".ProfileCanopy-navBar")[0].clientHeight + 100;
        if (!match || parseFloat(match[1]) < min_height) {
            $container.css('top', min_height + "px");
            window.scrollTo(document.body.clientWidth / 2, min_height - 100);
        }
    } else if (["search","hashtag"].includes(TISAS.page)) {
        if (!match || parseFloat(match[1]) < 200) {
            $container.css('top',"200px");
        }
    } else if (["home","list"].includes(TISAS.page)) {
        if (!match || parseFloat(match[1]) < 100) {
            $container.css('top',"100px");
        }
    }
}

function SetQueryDomain() {
    TISAS.domain = 'https://' + TISAS.user_settings.query_subdomain + '.donmai.us';
}

//Only render the settings menu on demand
function RenderSettingsMenu() {
    //Create the dialog
    $("body").append(`<div id="twitter-image-searches-and-stuff" title="TISAS Settings"></div>`);
    $( "#twitter-image-searches-and-stuff" ).dialog({ autoOpen: false , width: 1000 });
    //Standard menu creation
    $("#twitter-image-searches-and-stuff").append(tisas_menu);
    $("#tisas-display-settings").append(JSPLib.menu.renderCheckbox('tisas','advanced_tooltips_enabled'));
    $("#tisas-display-settings").append(JSPLib.menu.renderCheckbox('tisas','auto_unhide_tweets_enabled'));
    $("#tisas-display-settings").append(JSPLib.menu.renderCheckbox('tisas','display_retweet_id'));
    $("#tisas-display-settings").append(JSPLib.menu.renderCheckbox('tisas','display_media_link'));
    $("#tisas-display-settings").append(JSPLib.menu.renderCheckbox('tisas','display_upload_link'));
    $("#tisas-display-settings").append(JSPLib.menu.renderCheckbox('tisas','tweet_indicators_enabled'));
    $("#tisas-highlight-settings").append(JSPLib.menu.renderCheckbox('tisas','score_highlights_enabled'));
    $("#tisas-highlight-settings").append(JSPLib.menu.renderTextinput('tisas','score_window_size',5));
    $("#tisas-highlight-settings").append(JSPLib.menu.renderInputSelectors('tisas','score_levels_faded','checkbox'));
    $("#tisas-highlight-settings").append(JSPLib.menu.renderInputSelectors('tisas','score_levels_hidden','checkbox'));
    $("#tisas-database-settings").append(JSPLib.menu.renderCheckbox('tisas','confirm_delete_enabled'));
    $("#tisas-database-settings").append(JSPLib.menu.renderCheckbox('tisas','confirm_IQDB_enabled'));
    $("#tisas-database-settings").append(JSPLib.menu.renderCheckbox('tisas','autosave_IQDB_enabled'));
    $("#tisas-database-settings").append(JSPLib.menu.renderCheckbox('tisas','autocheck_IQDB_enabled'));
    $("#tisas-database-settings").append(JSPLib.menu.renderCheckbox('tisas','autoclick_IQDB_enabled'));
    $("#tisas-network-settings").append(JSPLib.menu.renderCheckbox('tisas','URL_wildcards_enabled'));
    $("#tisas-network-settings").append(JSPLib.menu.renderCheckbox('tisas','custom_order_enabled'));
    $("#tisas-network-settings").append(JSPLib.menu.renderTextinput('tisas','recheck_interval',5));
    $("#tisas-network-settings").append(JSPLib.menu.renderInputSelectors('tisas','query_subdomain','radio'));
    $("#tisas-download-settings").append(JSPLib.menu.renderCheckbox('tisas','original_download_enabled'));
    $("#tisas-download-settings").append(JSPLib.menu.renderInputSelectors('tisas','download_position','radio'));
    $("#tisas-download-settings").append(JSPLib.menu.renderTextinput('tisas','filename_prefix_format',80));
    $("#tisas-cache-settings").append(`<div class="jsplib-menu-item"><h4>Import file</h4><input size="50" type="file" name="tisas-import-file" id="tisas-import-file"></div>`);
    $("#tisas-cache-settings").append(JSPLib.menu.renderLinkclick("tisas",'import_data',`Import data (<span id="tisas-import-counter">...</span>)`,"Click to import","Imports a JSON file containing cache and program data."));
    $("#tisas-cache-settings").append(JSPLib.menu.renderLinkclick("tisas",'export_data',`Export data (<span id="tisas-export-counter">...</span>)`,"Click to export","Exports cache and program data to a JSON file."));
    $("#tisas-cache-settings").append(JSPLib.menu.renderLinkclick("tisas",'cache_info',"Cache info","Click to populate","Calculates the cache usage of the program and compares it to the total usage. Does not include tweet data."));
    $("#tisas-cache-settings").append(`<div id="tisas-cache-info-table" style="display:none"></div>`);
    $("#tisas-cache-settings").append(JSPLib.menu.renderLinkclick("tisas",'purge_cache',`Purge cache (<span id="tisas-purge-counter">...</span>)`,"Click to purge","Dumps all TISAS data with expirations. Does not include tweet data."));
    JSPLib.menu.engageUI('tisas',true);
    JSPLib.menu.saveUserSettingsClick('tisas','TISAS');
    JSPLib.menu.resetUserSettingsClick('tisas','TISAS',localstorage_keys,program_reset_keys);
    $("#tisas-control-import-data").on('click.tisas',ImportData);
    $("#tisas-control-export-data").on('click.tisas',ExportData);
    JSPLib.menu.cacheInfoClick('tisas',program_cache_regex,"#tisas-cache-info-table");
    JSPLib.menu.purgeCacheClick('tisas','TISAS',program_cache_regex,"#tisas-purge-counter");
    //Fixup forum links
    $(".tisas-forum-topic-link").attr('href',TISAS.domain + "/forum_topics/15976");
    //Add CSS stylings
    JSPLib.utility.setCSSStyle(menu_css,'menu');
    const jquery_ui_css = GM_getResourceText("jquery_ui_css");
    JSPLib.utility.setCSSStyle(jquery_ui_css,'jquery');
    //Fix for home page
    $("body link[href*=twitter_profile_editing]").remove();
}

//Main function

function Main() {
    Danbooru.TISAS = TISAS = {
        tweet_pos: [],
        tweet_faves: [],
        tweet_finish: {},
        counted_artists: [],
        counted_tweets: [],
        artist_iqdb_enabled: false,
        settings_config: settings_config
    };
    TISAS.user_settings = JSPLib.menu.loadUserSettings('tisas');
    SetQueryDomain();
    RegularCheck.timer = setInterval(RegularCheck,program_recheck_interval);
    $(document).on("click.tisas",".tisas-check-url",CheckUrl);
    $(document).on("click.tisas",".tisas-check-iqdb",CheckIQDB);
    $(document).on("click.tisas",".tisas-manual-add",ManualAdd);
    $(document).on("click.tisas",".tisas-confirm-iqdb",ConfirmIQDB);
    $(document).on("click.tisas",".tisas-confirm-delete",ConfirmDelete);
    $(document).on("click.tisas",".tisas-reset-iqdb",ResetIQDB);
    $(document).on("click.tisas",".tisas-help-info",HelpInfo);
    $(document).on("click.tisas",".tisas-download-original",DownloadOriginal);
    $(document).on("click.tisas",".tisas-download-all",DownloadAll);
    $(document).on("click.tisas",".tisas-footer-entries .tisas-mark-artist",MarkArtist);
    $(document).on("click.tisas",".tisas-footer-entries .tisas-mark-tweet",MarkTweet);
    $(document).on("click.tisas",".tisas-footer-entries .tisas-count-artist",CountArtist);
    $(document).on("click.tisas",".tisas-footer-entries .tisas-count-tweet",CountTweet);
    $(document).on("keydown.tisas", null, 'alt+h', ToggleArtistHilights);
    $(document).on("keydown.tisas", null, 'alt+q', ToggleAutoclickIQDB);
    $(document).on("keydown.tisas", null, 'alt+i', ToggleTweetIndicators);
    $(document).on("keydown.tisas", null, 'alt+m', OpenSettingsMenu);
    $(document).on("keydown.tisas", null, 'alt+c', CloseSettingsMenu);
    $("body").append(notice_banner);
    $("#tisas-close-notice-link").on("click.tisas",Danbooru.Utility.closeNotice);
    JSPLib.utility.setCSSStyle(program_css,'program');
    JSPLib.utility.setCSSStyle(GM_getResourceText('jquery_qtip_css'),'qtip');
    if (JSPLib.storage.getStorageData('tisas-remote-database', localStorage) === null) {
        CheckDatabaseInfo(true).then(()=>{
            Danbooru.Utility.notice("TISAS will momentarily refresh the page to finish initializing.");
            setTimeout(()=>{window.location = window.location;},page_refresh_timeout);
            JSPLib.concurrency.setRecheckTimeout('tisas-database-recheck',database_recheck_expires);
        });
    } else {
        setTimeout(()=>{
            CheckDatabaseInfo();
            JSPLib.storage.pruneEntries('tisas',program_cache_regex,prune_recheck_expires);
        },JSPLib.utility.one_minute);
    }
    JSPLib.debug.debugExecute(()=>{
        window.addEventListener('beforeunload',function () {
            JSPLib.statistics.outputAdjustedMean("CurrentUploads");
        });
    });
    Main.debuglog("Hi!",window.location.href);
}

/****Function decoration****/

JSPLib.debug.addFunctionTimers(Timer,false,[
    RenderSettingsMenu
]);

JSPLib.debug.addFunctionTimers(Timer,true,[
    PurgeBadTweets,SaveDatabase,GetSavePackage,CheckPostvers
]);

JSPLib.debug.addFunctionLogs([
    Main,UnhideTweets,HighlightTweets,RegularCheck,ImportData,DownloadOriginal,ConfirmIQDB,ManualAdd,
    CheckIQDB,CheckUrl,PurgeBadTweets,UpgradeDatabase,SaveDatabase,LoadDatabase,CheckPostvers,
    InitializeSimilarContainer,ReadFileAsync,ProcessPostvers,ProcessTweets,CorrectStringArray,ValidateEntry
]);

/****Execution start****/

JSPLib.load.programInitialize(Main,'TISAS',program_load_required_variables,program_load_required_selectors);
