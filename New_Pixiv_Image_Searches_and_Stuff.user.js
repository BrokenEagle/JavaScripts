// ==UserScript==
// @name         New Pixiv Image Searches and Stuff
// @version      1.2
// @description  Searches Danbooru database for artwork IDs, adds image search links.
// @match        *://www.pixiv.net/*
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/npisas/New_Pixiv_Image_Searches_and_Stuff.user.js
// @updateURL    https://raw.githubusercontent.com/BrokenEagle/JavaScripts/npisas/New_Pixiv_Image_Searches_and_Stuff.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
// @require      https://cdn.jsdelivr.net/npm/jquery-hotkeys@0.2.2/jquery-hotkeys.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.13.1/validate.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.9.0/localforage.min.js
// @require      https://cdn.jsdelivr.net/npm/localforage-getitems@1.4.2/dist/localforage-getitems.min.js
// @require      https://cdn.jsdelivr.net/npm/localforage-setitems@1.4.0/dist/localforage-setitems.min.js
// @require      https://cdn.jsdelivr.net/npm/localforage-removeitems@1.4.0/dist/localforage-removeitems.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/module.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/notice.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/concurrency.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/saucenao.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/menu.js
// @resource     jquery_ui_css https://raw.githubusercontent.com/BrokenEagle/JavaScripts/custom-20190305/custom/jquery_ui_custom.css
// @grant        GM.xmlHttpRequest
// @grant        GM_getResourceText
// @connect      donmai.us
// @connect      saucenao.com
// @run-at       document-body
// @noframes
// ==/UserScript==

// eslint-disable-next-line no-redeclare
/* global $ jQuery JSPLib validate localforage GM_getResourceText */

/****Global variables****/

//Library constants

JSPLib.validate.integer_constraints = {
    integer: true,
};

JSPLib.validate.counting_constraints = JSPLib.validate.timestamp_constraints = JSPLib.validate.expires_constraints = {
    integer: {
        greaterThanOrEqual: 0,
    },
};

JSPLib.validate.id_constraints = {
    integer: {
        greaterThan: 0,
    },
};

JSPLib.validate.hashentry_constraints = {
    expires: JSPLib.validate.expires_constraints,
    value: JSPLib.validate.hash_constraints,
};

//Variables for load.js
const PROGRAM_LOAD_REQUIRED_VARIABLES = [];
const PROGRAM_LOAD_REQUIRED_SELECTORS = [];

//Program name constants
const PROGRAM_FULL_NAME = "New Pixiv Image Searches and Stuff";
const PROGRAM_SHORT_NAME = "New PISAS";
const PROGRAM_NAME = 'NPISAS';
const PROGRAM_SHORTCUT = 'npisas';
const PROGRAM_CLICK = 'click.npisas';
const PROGRAM_KEYDOWN = 'keydown.npisas';

//Variables for storage.js
JSPLib.storage.pixivstorage = localforage.createInstance({
    name: 'Pixiv storage',
    driver: [localforage.INDEXEDDB]
});

//Main program variable
var NPISAS = {};

const PROGRAM_DATA_REGEX = /^(post|user|iqdb|sauce)-/;
const PIXIV_DATA_REGEX = /^(artwork|page|info|ai)-/;

//For factory reset !!!These need to be set!!!
const LOCALSTORAGE_KEYS = [];
const PROGRAM_RESET_KEYS = {};
const PROGRAM_DEFAULT_VALUES = {
    opened_menu: false,
    artwork_data: {},
    post_data: {},
    user_data: {},
    artwork_image_info: {},
    no_url_results: [],
    merge_results: [],
    similar_results: {},
    preview_dialog: {},
    info_dialog: {},
    multi_expanded: false,
};

//Settings constants
const COMMON_QUERY_SETTINGS = ['auto_save'];
const DEFAULT_QUERY_SETTINGS = [];
const SUBDOMAINS = ['danbooru', 'kagamihara', 'saitou', 'shima'];

//Main settings
const SETTINGS_CONFIG = {
    check_for_ai: {
        display: "Check for AI",
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Queries and adds highlights for artworks marked as AI."
    },
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
    custom_order_enabled: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Multi-post results will use <span class=\"npisas-code\">order:custom</span>, showing results with Twitter's order. <b>Note:</b> This will break the tag limit for non-Gold+."
    },
    query_subdomain: {
        allitems: SUBDOMAINS,
        reset: ['danbooru'],
        validate: (data) => JSPLib.menu.validateCheckboxRadio(data, 'radio', SUBDOMAINS),
        hint: "Select which subdomain of Danbooru to query from. <b>Note:</b> The chosen subdomain must be logged into or the script will fail to work."
    },
    display_network_errors: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays network error count and controls in the side menu."
    },
    display_available_sauce: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays the number of available sauce in the side menu."
    },
};

//CSS constants
const FONT_FAMILY = '\'Segoe UI\', Arial, sans-serif';

const PROGRAM_CSS = `
/*SIDE MENU*/
#npisas-side-menu {
    font-family: ${FONT_FAMILY};
    width: 22em;
    position: fixed;
    top: 25%;
    left: 1em;
    background: white;
    padding: 4px;
}
#npisas-side-border {
    border: 1px solid black;
}
#npisas-menu-header {
    font-size: 20px;
    font-weight: bold;
    text-decoration: underline;
    letter-spacing: -1px;
    background-color: rgb(29, 155, 240, 0.1);
}
#npisas-menu-selection {
    font-weight: bold;
    margin: 0 1em;
    padding: 0.1em;
    background-color: rgb(15, 20, 25, 0.1);
}
#npisas-menu-selection a {
    padding: 5px;
    color: rgb(15, 20, 25, 0.5);
}
#npisas-menu-selection a.npisas-selected {
    padding: 5px;
    color: rgb(29, 155, 240);
}
#npisas-menu-info,
#npisas-menu-controls {
    margin-left: 5px;
    font-weight: bold;
    line-height: 18px;
}
#npisas-menu-info td,
#npisas-menu-controls td {
    padding: 0 2px;
}
#npisas-menu-info td:nth-of-type(1),
#npisas-menu-info td:nth-of-type(2),
#npisas-menu-controls td:nth-of-type(1),
#npisas-menu-controls td:nth-of-type(2) {
    width: 115px;
}
#npisas-open-settings {
    margin: 0.5em;
}
#npisas-open-settings input {
    font-weight: bold;
    width: 21em;
}
/*ARTWORK*/
.npisas-artwork {
   border-top: 4px solid transparent;
   padding-top: 5px;
}
.npisas-artwork[data-ai="true"] {
   border-top-color: grey;
}
.npisas-artwork.npisas-preview-artwork {
   overflow: visible;
   -webkit-mask-image: none;
}
/*MICRO MENU*/
.npisas-preview-controls {
    border: 1px #888 solid;
    margin: 5px -5px;
    font-weight: bold;
    border-radius: 5px;
}
.npisas-micro-menu .npisas-preview-header {
    border-bottom: 1px solid black;
    padding: 2px 10px;
    margin-bottom: 5px;
    background-color: #8CF;
}
.npisas-micro-menu .npisas-preview-header:hover {
    background-color: #48F;
}
.npisas-micro-menu .npisas-preview-header a {
    color: white;
    letter-spacing: 5px;
    text-align: center;
    display: block;
    width: 100%;
}
.npisas-micro-menu .npisas-query-menu {
    height: 30px;
    padding: 0 5px;
}
.npisas-micro-menu .npisas-query-button {
    min-width: 1em;
    margin: 0 -5px;
}
.npisas-micro-menu .npisas-query-results,
.npisas-micro-menu .npisas-query-postid {
    border-radius: 25px 0 0 25px;
    margin-left: 0;
}
.npisas-micro-menu .npisas-query-results {
    min-width: 3.5em;
}
.npisas-micro-menu .npisas-query-postid {
    min-width: 7.5em;
}
.npisas-micro-menu .npisas-query-idlink {
    border-radius: 25px 0 0 25px;
}
.npisas-micro-menu .npisas-query-help {
    border-radius: 0 25px 25px 0;
    min-width: 1.5em;
    margin-right: 0;
}
.npisas-micro-menu .npisas-check-link {
    display: inline-block;
    min-width: 15px;
    text-align: center;
}
.npisas-micro-menu .npisas-auxiliar-menu {
    display: flex;
    margin: 5px 0;
    padding: 0 5px;
}
.npisas-micro-menu .npisas-auxiliar-menu > div {
    padding: 0 2px;
}
/**FULLSIZE MENU**/
.npisas-fullsize-controls {
    width: 36em;
    height: 110px;
    position: relative;
    z-index: 100;
    padding: 0.5em;
}
.npisas-fullsize-menu {
    border: 2px solid black;
    height: 40px; display:
    flex; align-items: center;
}
.npisas-fullsize-menu .npisas-header {
    font-size: 1.4em;
    display: flex;
    font-weight: bold;
    height: 100%;
    border-right: 1px solid black;
}
.npisas-fullsize-menu .npisas-header > div {
    display: flex;
    align-items: center;
    padding: 6px 0.8em;
}
.npisas-fullsize-menu .npisas-query-menu {
    margin: 5px;
    font-weight: bold;
    white-space: nowrap;
}
.npisas-fullsize-menu .npisas-query-button {
    min-width: 4em;
    margin: 0 -5px;
}
.npisas-fullsize-menu  .npisas-query-results,
.npisas-fullsize-menu  .npisas-query-postid {
    border-radius: 25px 0 0 25px;
    margin-left: 0;
}
.npisas-fullsize-menu  .npisas-query-results {
    min-width: 7em;
}
.npisas-fullsize-menu .npisas-query-postid {
    min-width: 10em;
}
.npisas-fullsize-menu .npisas-query-idlink {
    border-radius: 25px 0 0 25px;
}
.npisas-fullsize-menu .npisas-query-help {
    border-radius: 0 25px 25px 0;
    min-width: 3em;
    margin-right: 0;
}
/*PREVIEWS DIALOG*/
.npisas-preview-section {
    display: flex;
    flex-wrap: wrap;
    overflow-y: auto;
    max-height: 65vh;
    overscroll-behavior: contain;
    margin-bottom: 1em;
}
.npisas-preview-section .npisas-preview-container {
    padding: 5px;
    height: 350px;
    width: 300px;
    text-align: center;
}
.npisas-preview-section .npisas-preview-image {
    height: 300px;
    width: 300px;
    display: flex;
    align-items: end;
    justify-content: center;
}
.npisas-preview-section .npisas-preview-info {
    font-size: 1.4em;
    font-weight: bold;
    font-family: monospace;
}
.npisas-preview-section .npisas-preview-match {
    font-size: 20px;
    font-weight: bold;
}
.npisas-preview-popup {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    max-width: 80vw;
    max-height: 80vh;
    overflow: auto;
    z-index: 2000;
    overscroll-behavior: contain;
    background: white;
}
/*INFO DIALOG*/
.npisas-info-title {
    font-size: 24px;
    font-weight: bold;
    border-bottom: solid 2px black;
    margin-bottom: 0.5em;
    width: fit-content;
}
.npisas-info-description {
    font-size: 14px;
    overflow-y: auto;
    max-height: 250px;
    overscroll-behavior: contain;
}
.npisas-info-section a {
    color: blue !important;
}
.npisas-info-details {
    border: 1px solid #CCC;
    padding: 0.5em 0 0.5em 2em;
}
/*GENERAL*/
.npisas-dialog a:focus-visible,
.npisas-dialog button:focus-visible {
    outline: none;
}
.npisas-horizontal-rule {
    border-top: 1px solid grey;
    margin: 10px;
}
.npisas-expanded-link {
   display: inline-block;
   position: relative;
   z-index: 1;
   padding: 8px;
   margin: -8px;
}
.npisas-links a {
    cursor: pointer;
    text-decoration: none;
}
.npisas-links a:hover {
    text-decoration: underline;
}
.npisas-query-button {
    display: inline-block;
    text-align: center;
    border: 1px solid;
    padding: 4px;
}
.npisas-queried {
    font-size: 0.8em;
    color: #888;
}
.npisas-expanded-image-info {
    text-align:center;
    font-weight: bold;
    font-size: 1.2em;
    margin: 0.5em;
}
/*COLORS*/
.npisas-help-info,
.npisas-help-info:hover {
    color: hotpink;
}
.npisas-artwork .npisas-manual-add,
.npisas-artwork .npisas-manual-add:hover,
.npisas-artwork .npisas-database-no-match,
.npisas-artwork .npisas-database-no-match:hover,
.npisas-artwork .npisas-cancel-merge,
.npisas-artwork .npisas-cancel-merge:hover {
    color: red;
}
.npisas-artwork .npisas-database-match,
.npisas-preview-container .npisas-database-match {
    color: green;
}
.npisas-artwork .npisas-database-mismatch,
.npisas-preview-container .npisas-database-mismatch {
    color: purple;
}
.npisas-query-postid [npisas-similar-match=great],
.npisas-query-postid [npisas-similar-match=great]:hover,
.npisas-query-postid [npisas-similar-match=great]:focus {
    color: green;
}
.npisas-query-postid [npisas-similar-match=good],
.npisas-query-postid [npisas-similar-match=good]:hover,
.npisas-query-postid [npisas-similar-match=good]:focus {
    color: blue;
}
.npisas-query-postid [npisas-similar-match=fair],
.npisas-query-postid [npisas-similar-match=fair]:hover,
.npisas-query-postid [npisas-similar-match=fair]:focus {
    color: orange;
}
.npisas-query-postid [npisas-similar-match=poor],
.npisas-query-postid [npisas-similar-match=poor]:hover,
.npisas-query-postid [npisas-similar-match=poor]:focus {
    color: red;
}
.npisas-artwork .npisas-check-url,
.npisas-artwork .npisas-check-url:hover,
.npisas-artwork .npisas-check-iqdb,
.npisas-artwork .npisas-check-iqdb:hover,
.npisas-artwork .npisas-check-sauce,
.npisas-artwork .npisas-check-sauce:hover,
.npisas-artwork .npisas-merge-results,
.npisas-artwork .npisas-merge-results:hover {
    color: grey;
}`;

const MENU_CSS = `
#new-pixiv-image-searches-and-stuff {
    z-index: 1001;
    font-size: 14px;
}
#new-pixiv-image-searches-and-stuff p {
    margin-bottom: 1em;
}
#new-pixiv-image-searches-and-stuff h4 {
    font-size: 1.16667em;
    line-height: 1.5em;
    margin: 0;
}
#new-pixiv-image-searches-and-stuff .prose h2 {
    font-size: 1.8em;
    padding: 0.25em;
    line-height: 1em;
    margin: 0;
}
#new-pixiv-image-searches-and-stuff .prose h4 {
    font-size: 1.4em;
    padding: .8em 0 .25em;
    margin: 0;
}
#new-pixiv-image-searches-and-stuff a {
    font-weight:bold;
    text-decoration: none;
    cursor: pointer;
}
#new-pixiv-image-searches-and-stuff .prose a:hover,
#new-pixiv-image-searches-and-stuff .npisas-menu-tooltip a:hover,
#new-pixiv-image-searches-and-stuff .npisas-linkclick a:hover {
    text-decoration: underline;
}
#new-pixiv-image-searches-and-stuff b {
    font-weight: bold;
}
#new-pixiv-image-searches-and-stuff #npisas-tabs a {
    color: unset;
}
#new-pixiv-image-searches-and-stuff ul:not(#npisas-tabs) {
    margin-left: 1em;
    padding-left: 0;
}
#new-pixiv-image-searches-and-stuff ul:not(#npisas-tabs) li {
    list-style-type: disc;
    margin-left: 0.5em;
}
.npisas-textinput input {
    width: unset;
}
#npisas-console {
    width: unset;
    min-width: unset;
}
#npisas-settings {
    width: 100%;
    min-width: unset;
}
#npisas-settings > div {
    overflow-y: auto;
    height: 460px;
    overscroll-behavior: contain;
}
#npisas-import-file,
#npisas-settings-buttons input,
.npisas-textinput input{
    color: black;
    background-color: white;
}
#npisas-import-data-errors {
    border: 1px solid grey;
}
#new-pixiv-image-searches-and-stuff .npisas-selectors label {
    width: 140px;
}
#new-pixiv-image-searches-and-stuff .npisas-striped {
    border-collapse: collapse;
    border-spacing: 0;
}
#new-pixiv-image-searches-and-stuff .npisas-striped td,
#new-pixiv-image-searches-and-stuff .npisas-striped th {
    padding: 4px 6px;
}
#new-pixiv-image-searches-and-stuff .npisas-striped thead th {
    font-weight: 700;
    text-align: left;
}
#npisas-script-message > div {
    display: inline-block;
}
#npisas-forum-message {
    padding: 0 1em;
}
#npisas-available-hotkeys {
    float: right;
    margin-bottom: -1px;
}
#npisas-available-hotkeys-title {
    font-size: 125%;
    padding-left: 0.5em;
    color: rgb(29, 155, 240, 0.5);
}`;

//HTML constants

const HORIZONTAL_RULE = '<div class="npisas-horizontal-rule"></div>';

const SETTINGS_MENU = `<div id="new-pixiv-image-searches-and-stuff" title="${PROGRAM_NAME} Settings"></div>`;

const NTISAS_MENU = `
<div id="npisas-script-message" class="prose">
    <h2>${PROGRAM_FULL_NAME}</h2>
    <div id="npisas-forum-message">
        <p>Check the forum for the latest on information and updates (<a class="npisas-forum-topic-link" target="_blank">topic $DANBOORU_TOPIC_ID$</a>).</p>
    </div>
    <div id="npisas-available-hotkeys">
        <div id="npisas-available-hotkeys-title"><b>Available hotkeys</b>:</div>
        <table class="npisas-striped">
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
<div id="npisas-console" class="jsplib-console">
    <div id="npisas-settings" class="jsplib-outer-menu">
        <ul id="npisas-tabs">
            <li><a href="#npisas-display-settings">Display</a></li>
            <li><a href="#npisas-function-settings">Function</a></li>
            <li><a href="#npisas-query-settings">Query</a></li>
            <li><a href="#npisas-network-settings">Network</a></li>
        </ul>
        <div id="npisas-display-settings" class="jsplib-settings-grouping">
            <div id="npisas-display-message" class="prose">
                <h4>Display settings</h4>
            </div>
        </div>
        <div id="npisas-function-settings" class="jsplib-settings-grouping">
            <div id="npisas-function-message" class="prose">
                <h4>Function settings</h4>
            </div>
        </div>
        <div id="npisas-query-settings" class="jsplib-settings-grouping">
            <div id="npisas-query-message" class="prose">
                <h4>Query settings</h4>
            </div>
        </div>
        <div id="npisas-network-settings" class="jsplib-settings-grouping">
            <div id="npisas-network-message" class="prose">
                <h4>Network settings</h4>
            </div>
        </div>
    </div>
</div>`;

const SIDE_MENU = `
<div id="npisas-side-menu" class="npisas-links" style="display: none;">
<div id="npisas-side-border">
    <div id="npisas-menu-header">${PROGRAM_FULL_NAME}</div>
    <div id="npisas-menu-selection">
        <a id="npisas-select-info" data-selector="info">Info</a>
        <a id="npisas-select-controls" data-selector="controls">Controls</a>
        <a id="npisas-select-info" data-selector="statistics">Statistics</a>
    </div>
    ${HORIZONTAL_RULE}
    <div id="npisas-content">
        <div id="npisas-menu-info" data-selector="info" style="display:none">
            <table>
                <tbody>
                <tr>
                    <td><span>Manual records:</span></td>
                    <td><span id="npisas-manual-records">...</span></td>
                    <td>(%RECORDSHELP%)</td>
                </tr>
                <tr data-setting="display_available_sauce">
                    <td><span>Available sauce:</span></td>
                    <td><span id="npisas-available-sauce">N/A</span></td>
                    <td>(%SAUCEHELP%)</td>
                </tr>
                <tr data-setting="display_network_errors">
                    <td><span>Network errors:</span></td>
                    <td><a id="npisas-error-messages">%ERRORMESSAGES%</a></td>
                    <td>(%ERRORMESSAGESHELP%)</td>
                </tr>
                </tbody>
            </table>
        </div>
        <div id="npisas-menu-controls" data-selector="controls" style="display:none">
            <table>
                <tbody>
                <tr data-setting="original_download_enabled">
                    <td><span>Download links:</span></td>
                    <td>%DOWNLOADS%</td>
                    <td>(%DOWNLOADSHELP%)</td>
                </tr>
                <tr data-setting="display_illust_views">
                    <td><span>View indicators:</span></td>
                    <td>%VIEW_HIGHLIGHTS%</td>
                    <td>(%VIEW_HIGHLIGHTS_HELP%)</td>
                </tr>
                <tr data-setting="display_illust_views">
                    <td><span>Count views:</span></td>
                    <td>%VIEW_COUNTS%</td>
                    <td>(%VIEW_COUNTS_HELP%)</td>
                </tr>
                </tbody>
            </table>
        </div>
        <div id="npisas-menu-statistics" data-selector="statistics" style="display:none">
            <div data-setting="display_tweet_statistics">
                <div id="npisas-stats-header"><span>Tweet Statistics</span> (%STATISTICSHELP%)</div>
                <div id="npisas-tweet-stats-table"></div>
                <div id="npisas-tweet-stats-message">Unavailable on Tweet view.</div>
            </div>
        </div>
    </div>
    <div id="npisas-open-settings">
        <input type="button" title="%SETTINGSHELP%" value="Settings">
    </div>
</div>
</div>`;

const FULLSIZE_ARTWORK_MENU_HTML = `
<div class="npisas-fullsize-menu">
    <div class="npisas-header">
        <div>
            NPISAS
        </div>
    </div>
    <div class="npisas-query-menu npisas-links">
        <span style="vertical-align: center;">( Loading... )</span>
    </div>
</div>`;

const MICRO_ARTWORK_MENU_HTML = `
<div class="npisas-micro-menu">
    <div class="npisas-preview-header">
        <a class="npisas-expanded-link">${PROGRAM_SHORT_NAME}</a>
    </div>
    <div class="npisas-query-menu npisas-links">
        <span style="font-weight:bold; vertical-align: center;">( Loading... )</span>
    </div>
    <div class="npisas-auxiliar-menu npisas-links">
        (
        <div>
            <a class="npisas-show-previews npisas-expanded-link">Previews</a> |
            <a class="npisas-show-info npisas-expanded-link">Info</a> |
            <a class="npisas-upload-artwork npisas-expanded-link" target="_blank">Upload</a>
        </div>
        )
    </div>
</div>`;

const ILLUST_PREVIEWS_HTML = `
<div class="npisas-illust-previews" data-artwork-id="%ARTWORK_ID%">
    <div class="npisas-preview-section"></div>
    <div class="npisas-queried">Last queried: %QUERIED%</div>
</div>`;

const ILLUST_INFO_HTML = `
<div class="npisas-illust-info" data-artwork-id="%ARTWORK_ID%">
    <div class="npisas-info-section">
        <div class="npisas-info-title">%TITLE%</div>
        <div class="npisas-info-description">%DESCRIPTION%</div>
        <ul class="npisas-info-details">
            <li><b>Uploaded:</b> %DATE%</li>
            <li><b>Bookmarks:</b> %BOOKMARKS%</li>
            <li><b>Type:</b> %TYPE%</li>
            %READING%
            <li><b>Request:</b> %REQUEST%</li>
            <li><b>Original:</b> %ORIGINAL%</li>
            <li><b>AI:</b> %AI%</li>
            <li><b>Tags:</b>
                <ul>%TAGS%</ul>
            </li>
        </ul>
    </div>
    <div class="npisas-queried">Last queried: %QUERIED%</div>
</div>`;

const VIEW_HIGHLIGHTS_HTML = `
<span id="npisas-view-highlights-toggle">
    <a id="npisas-enable-view-highlights" class="npisas-expanded-link">Show</a>
    <a id="npisas-disable-view-highlights" class="npisas-expanded-link">Hide</a>
</span>`;

const VIEW_COUNTS_HTML = `
<span id="npisas-view-counts-toggle">
    <a id="npisas-enable-view-counts" class="npisas-expanded-link">Enable</a>
    <a id="npisas-disable-view-counts" class="npisas-expanded-link">Disable</a>
</span>`;

//Message constants

const CONFIRM_SAVE_PROMPT = "Save the following post IDs? (separate by comma, local matches only)";
const MANUAL_ADD_PROMPT = "Enter the post IDs to save. (separate by commas, local matches only)";

const NO_MATCH_HELP = ": L-click, manual add posts";
const CANCEL_HELP = ": L-click, cancel merge operation";
const NO_RESULTS_HELP = ": L-click, reset IQDB/Sauce results";
const CHECK_URL_HELP = ": L-click, query Danbooru for URL match";
const CHECK_IQDB_HELP = ": L-click, query Danbooru for image match";
const CHECK_SAUCE_HELP = ": L-click, query SauceNAO for image match";
const CONFIRM_DELETE_HELP = "postlink: L-click, add/delete info; R-click, open postlink";
const CONFIRM_IQDB_HELP = "postlink: L-click, confirm results; R-click open postlink";
const MERGE_RESULTS_HELP = ": L-click, perform another query and merge with current results";
const SAVE_HELP = "L-Click to save current settings. (Shortcut: Alt+S)";
const RESET_HELP = "L-Click to reset settings to default. (Shortcut: Alt+R)";
const SETTINGS_HELP = "L-Click to open settings menu. (Shortcut: Alt+M)";
const CLOSE_HELP = "L-Click to close. (Shortcut: Alt+C)";

const REFRESH_RECORDS_HELP = "The number of records manually set by the user.";
const AVAILABLE_SAUCE_HELP = "Shows the number of API requests remaining.\nOnly shown after use of the Sauce link.\nResults are kept for only 1 hour.";
const VIEWS_HIGHLIGHTS_HELP = "L-Click to toggle borders on viewed Tweets. (Shortcut: Alt+V)";
const VIEWS_COUNTS_HELP = "L-Click to toggle whether tweets are being counted as viewed.";
const ERROR_MESSAGES_HELP = "L-Click to see full error messages.";
const STATISTICS_HELP = 'L-Click any category heading to narrow down results.\nL-Click &quot;Total&quot; category to reset results.';

//Regex constants

const PIXIV_HOST = String.raw`^https?://www\.pixiv\.net`;

var PIXIV_ID = String.raw`\d+`;
var PIXIV_USERS = String.raw`(?:/en)?/users/`;
var PIXIV_ARTWORKS = String.raw`(?:/en)?/artworks/`;
var PIXIV_TAGS = String.raw`(?:/en)?/tags/`;
var QUERY_END = String.raw`(?:\?|$)`;

// https://www.pixiv.net/en/users/1234
const USERS_PAGE_REGEX = JSPLib.utility.verboseRegex('i')`
${PIXIV_HOST}
${PIXIV_USERS}
(?<id>${PIXIV_ID})
${QUERY_END}
`;

// https://www.pixiv.net/en/users/1234/illustrations
// https://www.pixiv.net/en/users/1234/manga
// https://www.pixiv.net/en/users/1234/novels
// https://www.pixiv.net/en/users/1234/artworks
const USER_ILLUSTS_PAGE_REGEX = JSPLib.utility.verboseRegex('i')`
${PIXIV_HOST}
${PIXIV_USERS}
(?<id>${PIXIV_ID})
/
(?<type>artworks|illustrations|manga|novels)
${QUERY_END}
`;

// https://www.pixiv.net/en/users/1234/illustrations/original
// https://www.pixiv.net/en/users/1234/manga/original
// https://www.pixiv.net/en/users/1234/novels/original
// https://www.pixiv.net/en/users/1234/artworks/original
const USER_TAG_ILLUSTS_PAGE_REGEX = JSPLib.utility.verboseRegex('i')`
${PIXIV_HOST}
${PIXIV_USERS}
(?<id>${PIXIV_ID})
/
(?<type>artworks|illustrations|manga|novels)
/
(?<tag>[^?/]+)
${QUERY_END}
`;

// https://www.pixiv.net/en/users/1234/bookmarks/artworks
// https://www.pixiv.net/en/users/1234/bookmarks/novels
const USER_BOOKMARKS_PAGE_REGEX = JSPLib.utility.verboseRegex('i')`
${PIXIV_HOST}
${PIXIV_USERS}
(?<id>${PIXIV_ID})
/
bookmarks
/
(?<type>artworks|novels)
${QUERY_END}
`;

// https://www.pixiv.net/en/artworks/1234
const ARTWORKS_PAGE_REGEX = JSPLib.utility.verboseRegex('i')`
${PIXIV_HOST}
${PIXIV_ARTWORKS}
(?<id>${PIXIV_ID})
${QUERY_END}
`;


// https://www.pixiv.net/en/tags/original
const TAGS_PAGE_REGEX = JSPLib.utility.verboseRegex('i')`
${PIXIV_HOST}
${PIXIV_TAGS}
(?<tag>[^?/]+)
${QUERY_END}
`;

// https://www.pixiv.net/en/tags/original/artworks
// https://www.pixiv.net/en/tags/original/illustrations
// https://www.pixiv.net/en/tags/original/manga
// https://www.pixiv.net/en/tags/original/novels
const TAGS_ILLUSTS_PAGE_REGEX = JSPLib.utility.verboseRegex('i')`
${PIXIV_HOST}
${PIXIV_TAGS}
(?<tag>[^/]+)
/
(?<type>artworks|illustrations|manga|novels)
${QUERY_END}
`;


const PAGE_REGEXES = {
    users: USERS_PAGE_REGEX,
    user_illusts: USER_ILLUSTS_PAGE_REGEX,
    user_tag_illusts: USER_TAG_ILLUSTS_PAGE_REGEX,
    user_bookmarks: USER_BOOKMARKS_PAGE_REGEX,
    artworks: ARTWORKS_PAGE_REGEX,
    tags: TAGS_PAGE_REGEX,
    tag_illusts: TAGS_ILLUSTS_PAGE_REGEX,
};

const PXIMG_HOST_RG = String.raw`^https?://i\.pximg\.net`;
const PIXIV_IMAGE1 = JSPLib.utility.verboseRegex('i')`
${PXIMG_HOST_RG}
(?:/c/\w+)?
/(?:img-original|img-master|custom-thumb)
/img
/(?<date>\d{4}/\d{2}/\d{2}/\d{2}/\d{2}/\d{2})
/(?<id>\d+)
(?:_p(?<order>\d+))?
(?:_(?:master|square|custom)1200)?
\.
(?<ext>jpg|png|gif|mp4|zip)
$`;

const HANDLED_IMAGES = [
    PIXIV_IMAGE1,
];

const UNHANDLED_IMAGES = [
];

//Network constants

const POST_FIELDS = 'id,pixiv_id,uploader_id,score,fav_count,rating,tag_string,created_at,preview_file_url,source,file_ext,file_size,image_width,image_height,uploader[name]';

//Queue constants

const QUEUED_STORAGE_REQUESTS = [];
const SAVED_STORAGE_REQUESTS = [];
const CACHED_STORAGE_REQUESTS = {};
const CACHE_STORAGE_TYPES = ['get', 'check'];
const STORAGE_DATABASES = {
    danbooru: JSPLib.storage.danboorustorage,
    pixiv: JSPLib.storage.pixivstorage,
};

const QUEUED_NETWORK_REQUESTS = [];
const SAVED_NETWORK_REQUESTS = [];
const NETWORK_REQUEST_DICT = {
    artworks: {
        controller: 'posts',
        data_key: 'pixiv_id',
        params (artwork_ids) {
            return {
                tags: 'status:any pixiv_id:' + artwork_ids.join(','),
                only: POST_FIELDS,
                limit: 200,
            };
        },
    },
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

//DOM constants

const PAGE_ATTRIBUTES = {
    artworks: {
        selector: 'div:not(.npisas-image) > div[role="presentation"] > a > img',
        imageparent: 3,
        artworkparent: 6,
    },
    users: {
        selector: 'div > div > ul > li > div:not(.npisas-artwork) > div > div > a > div > div > img',
        imageparent: 5,
        artworkparent: 6,
    },
    user_illusts: {
        selector: 'div:not(.npisas-image) > div > div > a > div > div > img',
        imageparent: 5,
        artworkparent: 6,
    },
    user_tag_illusts: {
        selector: 'div:not(.npisas-image) > div > div > a > div > div > img',
        imageparent: 5,
        artworkparent: 6,
    },
    bookmarks: {
        selector: 'div:not(.npisas-image) > div > div> a > div > div > img',
        imageparent: 4,
        artworkparent: 5,
    },
    tags: {
        selector: 'section > div > ul > li div:not(.npisas-artwork) > div > div > a > div > div > img',
        imageparent: 5,
        artworkparent: 6,
    },
    tag_illusts: {
        selector: 'section > div > div > ul > li div:not(.npisas-artwork) > div > div > a > div > div > img',
        imageparent: 5,
        artworkparent: 6,
    },
};

//UI constants

const PREVIEW_DIALOG_SETTINGS = {
    title: "Artwork previews",
    modal: true,
    resizable: false,
    autoOpen: false,
    width: 670,
    classes: {
        'ui-dialog': 'npisas-dialog',
        'ui-dialog-titlebar-close': 'npisas-dialog-close'
    },
    buttons: {
        'Reload' () {
            ReloadPreviews(event);
        },
        'Close' () {
            $(this).dialog('close');
        },
    }
};

const INFO_DIALOG_SETTINGS = {
    title: "Artwork information",
    modal: true,
    resizable: false,
    autoOpen: false,
    width: 670,
    classes: {
        'ui-dialog': 'npisas-dialog',
        'ui-dialog-titlebar-close': 'npisas-dialog-close'
    },
    buttons: {
        'Reload' (event) {
            ReloadInfo(event);
        },
        'Close' () {
            $(this).dialog('close');
        },
    }
};

const MENU_DIALOG_SETTINGS = {
    modal: true,
    resizable: false,
    autoOpen: false,
    width: 1000,
    height: 800,
    classes: {
        'ui-dialog': 'npisas-dialog',
        'ui-dialog-titlebar-close': 'npisas-dialog-close'
    },
    open: () => {
        NPISAS.opened_menu = true;
    },
    close: () => {
        NPISAS.opened_menu = false;
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
        id: 'npisas-commit',
        title: SAVE_HELP
    },
    'Factory reset': {
        id: 'npisas-resetall',
        title: RESET_HELP
    },
    'Close': {
        id: null,
        title: CLOSE_HELP
    }
};

//Time constants

const PROGRAM_RECHECK_INTERVAL = JSPLib.utility.one_second;
const PRUNE_RECHECK_EXPIRES = JSPLib.utility.one_hour * 6;

const USER_EXPIRES = JSPLib.utility.one_month;
const MIN_POST_EXPIRES = JSPLib.utility.one_day;
const MAX_POST_EXPIRES = JSPLib.utility.one_month;
const SIMILAR_EXPIRES = JSPLib.utility.one_day;
const SAUCE_EXPIRES = JSPLib.utility.one_hour;

const FOUND_ARTWORK_EXPIRES = JSPLib.utility.one_day;
const MISSING_ARTWORK_EXPIRES = JSPLib.utility.one_hour;
const PAGE_EXPIRES = JSPLib.utility.one_week;
const INFO_EXPIRES = JSPLib.utility.one_month;
const AI_EXPIRES = JSPLib.utility.one_month;

const LENGTH_RECHECK_INTERVAL = JSPLib.utility.one_day;

const RECENT_DURATION = JSPLib.utility.one_minute * 5;

//Other constants

const GOLD_LEVEL = 30;

//Classes

class Artwork {
    constructor(data) {
        Object.assign(this, data);
    }

    get danbooru_ids() {
        return JSPLib.utility.getObjectAttributes(this.danbooru, 'id');
    }

    get post_ids() {
        return JSPLib.utility.concat(this.danbooru_ids, this.local).sort();
    }

    image_expired(image_url) {
        let image_info = GetImageURLInfo(image_url);
        let matching_sources = this.danbooru.filter((source) => source.order === image_info.order);
        if (matching_sources.length > 0) {
            let matching_dates = JSPLib.utility.getObjectAttributes(matching_sources, 'date');
            return !matching_dates.includes(image_info.date);
        }
        return false;
    }

    is_expired(image_url) {
        let image_info = GetImageURLInfo(image_url);
        let expired = {};
        this.danbooru.forEach((source) => {
            expired[source.order] ||= source.date === image_info.date;
        });
        return !Object.values(expired).every((val) => val);
    }
}

//Validate constants

const POST_CONSTRAINTS = {
    id: JSPLib.validate.id_constraints,
    pixivid: {
        integer: {
            greaterThan: 0,
            allowNull: true,
        }
    },
    uploaderid: JSPLib.validate.id_constraints,
    uploadername: JSPLib.validate.stringnull_constraints,
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
    height: JSPLib.validate.counting_constraints,
};

const USER_CONSTRAINTS = {
    id: JSPLib.validate.id_constraints,
    name: JSPLib.validate.stringonly_constraints,
};

const SIMILAR_CONSTRAINTS = {
    expires: JSPLib.validate.expires_constraints,
    value: JSPLib.validate.boolean_constraints
};

const ARTWORK_CONSTRAINTS = {
    value: {
        id: JSPLib.validate.id_constraints,
        danbooru: JSPLib.validate.array_constraints(),
        local: JSPLib.validate.array_constraints(),
        expires: {
            integer: {
                greaterThan: 0,
                allowNull: true,
            }
        },
    },
    danbooru: {
        id: JSPLib.validate.id_constraints,
        order: JSPLib.validate.integer_constraints,
        date: JSPLib.validate.stringonly_constraints,
    },
    local: JSPLib.validate.basic_number_validator,
};

const AI_CONSTRAINTS = {
    id: JSPLib.validate.id_constraints,
    is_ai: JSPLib.validate.boolean_constraints,
};

const PAGE_CONSTRAINTS = {
    value: {
        id: JSPLib.validate.id_constraints,
        date: JSPLib.validate.stringonly_constraints,
        queried: JSPLib.validate.timestamp_constraints,
        page: JSPLib.validate.array_constraints(),
    },
    page: {
        urls: JSPLib.validate.hash_constraints,
        height: JSPLib.validate.integer_constraints,
        width: JSPLib.validate.integer_constraints,
    },
    urls: {
        thumb_mini: JSPLib.validate.stringonly_constraints,
        small: JSPLib.validate.stringonly_constraints,
        regular: JSPLib.validate.stringonly_constraints,
        original: JSPLib.validate.stringonly_constraints,
    },
};

const INFO_CONSTRAINTS = {
    value: {
        id: JSPLib.validate.id_constraints,
        title: JSPLib.validate.stringonly_constraints,
        description: JSPLib.validate.stringonly_constraints,
        date: JSPLib.validate.stringonly_constraints,
        bookmarks: JSPLib.validate.counting_constraints,
        type: JSPLib.validate.inclusion_constraints(['illust', 'manga']),
        reading: JSPLib.validate.inclusion_constraints(['scroll', 'book']),
        original: JSPLib.validate.boolean_constraints,
        request: JSPLib.validate.boolean_constraints,
        ai: JSPLib.validate.boolean_constraints,
        tags: JSPLib.validate.array_constraints(),
        queried: JSPLib.validate.timestamp_constraints,
    },
    tags: {
        name: JSPLib.validate.stringonly_constraints,
        deletable: JSPLib.validate.boolean_constraints,
        translation: JSPLib.validate.stringnull_constraints,
    },
};

/****Functions****/

//Library functions

JSPLib.utility.isTimestamp = function (timestamp) {
    //This includes epoch timestamps as well as durations, which must be integer/float and greater than zero
    return typeof timestamp === 'number' && !Number.isNaN(timestamp) && timestamp >= 0;
};

JSPLib.utility.timeAgo = function (time_value, {precision = 2, compare_time = null, recent_duration = null} = {}) {
    let timestamp = Number(time_value) || this.toTimeStamp(time_value);
    if (!this.isTimestamp(timestamp)) return "N/A";
    compare_time ||= Date.now();
    let time_interval = compare_time - timestamp;
    if (this.isTimestamp(recent_duration) && time_interval < recent_duration) {
        return "recently";
    }
    if (time_interval < JSPLib.utility.one_hour) {
        return JSPLib.utility.setPrecision(time_interval / JSPLib.utility.one_minute, precision) + " minutes ago";
    }
    if (time_interval < JSPLib.utility.one_day) {
        return JSPLib.utility.setPrecision(time_interval / JSPLib.utility.one_hour, precision) + " hours ago";
    }
    if (time_interval < JSPLib.utility.one_month) {
        return JSPLib.utility.setPrecision(time_interval / JSPLib.utility.one_day, precision) + " days ago";
    }
    if (time_interval < JSPLib.utility.one_year) {
        return JSPLib.utility.setPrecision(time_interval / JSPLib.utility.one_month, precision) + " months ago";
    }
    return JSPLib.utility.setPrecision(time_interval / JSPLib.utility.one_year, precision) + " years ago";
};

JSPLib.menu.preloadProgram = function (program_value, {default_data = {}, reset_data = {}, initialize_func = null, broadcast_func = null, program_css = null} = {}) {
    program_value.user_settings = this.loadUserSettings();
    for (let key in program_value.user_settings) {
        Object.defineProperty(program_value, key, {get() {return program_value.user_settings[key];}});
    }
    Object.assign(
        program_value,
        JSPLib.utility.dataCopy(default_data),
        JSPLib.utility.dataCopy(reset_data),
    );
    if (typeof broadcast_func == 'function') {
        program_value.channel = JSPLib.utility.createBroadcastChannel(this.program_name, broadcast_func);
    }
    if (typeof initialize_func == 'function') {
        return initialize_func();
    }
    if (program_css) {
        JSPLib.utility.setCSSStyle(program_css, 'program');
    }
    return true;
};

JSPLib.validate.validateHashArrayEntries = function (key, data, constraints) {
    for (let i = 0; i < data.length; i++) {
        if (!JSPLib.validate.validateHashEntries(`${key}[${i}]`, data[i], constraints)) {
            return false;
        }
    }
    return true;
};

validate.validators.integer = function(value, options) {
    if (options === false) return;
    var message = "";
    //Can't use presence validator so must catch it here
    if (value === undefined) {
        return "can't be missing";
    }
    if (!Number.isInteger(value)) {
        message = "is not an integer";
        if (JSPLib.validate.checkOptions(options, 'allowNull')) {
            if (options.allowNull !== true || value === null) return;
            message += " or null";
        }
    } else if (JSPLib.validate.checkOptions(options, 'greaterThan') && options.greaterThan >= value) {
        message = "is not greater than " + options.greaterThan;
    } else if (JSPLib.validate.checkOptions(options, 'greaterThanOrEqual') && options.greaterThanOrEqual > value) {
        message = "is not greater than or equal to " + options.greaterThanOrEqual;
    } else if (JSPLib.validate.checkOptions(options, 'lessThan') && options.lessThan <= value) {
        message = "is not less than " + options.lessThan;
    } else if (JSPLib.validate.checkOptions(options, 'lessThanOrEqual') && options.lessThanOrEqual < value) {
        message = "is not less than or equal to " + options.lessThanOrEqual;
    }
    return message.length ? message : null;
};

JSPLib.storage.batchCheckLocalDB = async function (self, keylist, expiration, {validator = JSPLib.storage.indexedDBValidator, database = JSPLib.storage.danboorustorage} = {}) {
    var cached = await this.batchRetrieveData(keylist, {database});
    for (let key in cached) {
        let max_expires = 0;
        if (Number.isInteger(expiration)) {
            max_expires = expiration;
        } else if (typeof expiration === 'function') {
            max_expires = expiration(key, cached[key]);
        }
        self.debug('logLevel', "Checking DB", key, JSPLib.debug.VERBOSE);
        if (!validator?.(key, cached[key]) || this.hasDataExpired(key, cached[key], max_expires)) {
            self.debug('logLevel', "DB Miss", key, JSPLib.debug.DEBUG);
            delete cached[key];
        } else {
            self.debug('logLevel', "DB Hit", key, JSPLib.debug.VERBOSE);
        }
    }
    return cached;
};

JSPLib.debug.addModuleLogs('storage', ['batchCheckLocalDB']);

//Validate functions

function ValidateEntry(key, data) {
    if (!JSPLib.validate.validateIsHash(key, data)) {
        return false;
    }
    if (key.match(/^(?:post|user|iqdb|sauce)-/)) {
        return ValidateDanbooruData(key, data);
    }
    if (key.match(/^(?:artwork|ai|page|info)-/)) {
        return ValidatePixivData(key, data);
    }
    JSPLib.debug.debuglog("ValidateEntry - Bad key:", key);
    return false;
}

function ValidateExpiration(key) {
    if (key.match(/^post-/)) {
        return MAX_POST_EXPIRES;
    }
    if (key.match(/^user-\d+/)) {
        return USER_EXPIRES;
    }
    if (key.match(/^(iqdb|sauce)-/)) {
        return SIMILAR_EXPIRES;
    }
    if (key.match(/^artwork-/)) {
        return FOUND_ARTWORK_EXPIRES;
    }
    if (key.match(/^page-/)) {
        return PAGE_EXPIRES;
    }
    if (key.match(/^info-/)) {
        return INFO_EXPIRES;
    }
    if (key.match(/^ai-/)) {
        return AI_EXPIRES;
    }
    return 0;
}

function ValidateDanbooruData(key, data) {
    if (key.match(/^(?:iqdb|sauce)-/)) {
        return JSPLib.validate.validateHashEntries(key, data, SIMILAR_CONSTRAINTS);
    }
    if (!JSPLib.validate.validateHashEntries(key, data, JSPLib.validate.hashentry_constraints)) {
        return false;
    }
    let value_key = key + '.value';
    let value = data.value;
    if (key.match(/^post-/)) {
        return JSPLib.validate.validateHashEntries(value_key, value, POST_CONSTRAINTS);
    }
    if (key.match(/^user-/)) {
        return JSPLib.validate.validateHashEntries(value_key, value, USER_CONSTRAINTS);
    }
}

function ValidatePixivData(key, data) {
    if (!JSPLib.validate.validateHashEntries(key, data, JSPLib.validate.hashentry_constraints)) {
        return false;
    }
    let value_key = key + '.value';
    let value = data.value;
    if (key.match(/^artwork-/)) {
        return JSPLib.validate.validateHashEntries(value_key, value, ARTWORK_CONSTRAINTS.value)
            && JSPLib.validate.validateArrayValues(value_key + '.local', value.local, ARTWORK_CONSTRAINTS.local)
            && JSPLib.validate.validateHashArrayEntries(value_key + '.danbooru', value.danbooru, ARTWORK_CONSTRAINTS.danbooru);
    }
    if (key.match(/^page-/)) {
        return JSPLib.validate.validateHashEntries(value_key, value, PAGE_CONSTRAINTS.value)
            && JSPLib.validate.validateHashArrayEntries(value_key + '.page', value.page, PAGE_CONSTRAINTS.page)
            && value.page.every((page, i) => JSPLib.validate.validateHashEntries(value_key + `.page[${i}].urls`, page.urls, PAGE_CONSTRAINTS.urls));
    }
    if (key.match(/^info-/)) {
        return JSPLib.validate.validateHashEntries(value_key, value, INFO_CONSTRAINTS.value)
            && JSPLib.validate.validateHashArrayEntries(value_key + '.tags', value.tags, INFO_CONSTRAINTS.tags);
    }
    if (key.match(/^ai-/)) {
        return JSPLib.validate.validateHashEntries(value_key, value, AI_CONSTRAINTS);
    }
}

//Helper functions

function GetSessionArtworkData(artwork_id) {
    return JSPLib.storage.getIndexedSessionData('artwork-' + artwork_id, {database: STORAGE_DATABASES.pixiv});
}

function GetSessionArtwork(artwork_id) {
    let storage_data = GetSessionArtworkData(artwork_id);
    return new Artwork(storage_data.value);
}

function LogarithmicExpiration(count, max_count, time_divisor, multiplier) {
    let time_exponent = Math.pow(10, (1 / time_divisor));
    return Math.round(Math.log10(time_exponent + (10 - time_exponent) * (count / max_count)) * multiplier);
}

function RemoveDuplicates(obj_array, attribute){
    const attribute_index = JSPLib.utility.getObjectAttributes(obj_array, attribute);
    return obj_array.filter((obj, index) => (attribute_index.indexOf(obj[attribute]) === index));
}

function NormalizeSource(source) {
    return 'https://i.pximg.net' + (new URL(source)).pathname;
}

//Auxiliary functions

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

function GetCustomQuery() {
    return (NPISAS.user_settings.custom_order_enabled && (NPISAS.user_data.level >= GOLD_LEVEL) ? '+order%3Acustom' : '');
}

function SetRotatingIcon($link) {
    const icons = ['|', '/', '―', '\\'];
    let index = 0;
    return JSPLib.utility.initializeInterval(() => {
        $link.text(icons[index]);
        index = (index + 1) % icons.length;
    }, 100);
}

function MapPost(post) {
    return {
        id: post.id,
        pixivid: post.pixiv_id,
        uploaderid: post.uploader_id,
        uploadername: ('uploader' in post ? post.uploader.name : null),
        score: post.score,
        favcount: post.fav_count,
        rating: post.rating,
        tags: post.tag_string,
        created: JSPLib.utility.toTimeStamp(post.created_at),
        thumbnail: post.preview_file_url,
        source: post.source,
        ext: post.file_ext,
        size: post.file_size,
        width: post.image_width,
        height: post.image_height
    };
}

function PostExpiration(created_timestamp) {
    let created_interval = Date.now() - created_timestamp;
    if (created_interval < JSPLib.utility.one_day) {
        return MIN_POST_EXPIRES;
    }
    if (created_interval < JSPLib.utility.one_month) {
        let day_interval = (created_interval / JSPLib.utility.one_day) - 1; //Start at 0 days and go to 29 days
        let day_slots = 29; //There are 29 day slots between 1 day and 30 days
        let days_month = 30;
        return LogarithmicExpiration(day_interval, day_slots, days_month, MAX_POST_EXPIRES);
    }
    return MAX_POST_EXPIRES;
}

function ProcessSimilarData(type, artwork_id, $replace, image_url, similar_data, preview) {
    var promise_return;
    if (similar_data.length > 0) {
        let max_score = Math.max(...JSPLib.utility.getObjectAttributes(similar_data, 'score'));
        let level = 'poor';
        if (max_score > 95.0) {
            level = 'great';
        } else if (max_score > 90.0) {
            level = 'good';
        } else if (max_score > 85.0) {
            level = 'fair';
        }
        let similar_post_ids = JSPLib.utility.arrayUnique(JSPLib.utility.getNestedObjectAttributes(similar_data, ['post', 'id']));
        if (IsQuerySettingEnabled('auto_save', type)) {
            let artwork = UpdateArtworkLocalIDs(artwork_id, similar_post_ids);
            promise_return = InitializePostIDsLink(artwork, $replace, preview, image_url);
            NPISAS.channel.postMessage({type: 'postlink', artwork_id, post_ids: similar_post_ids});
        } else {
            $replace.html(RenderSimilarIDsLink(similar_post_ids, similar_data, level, type));
            NPISAS.similar_results[artwork_id] = similar_post_ids;
            promise_return = Promise.resolve(null);
        }
    } else {
        SaveData(type + '-' + artwork_id, {value: true, expires: JSPLib.utility.getExpires(SIMILAR_EXPIRES)}, 'danbooru');
        promise_return = InitializeNoMatchesLinks(artwork_id, $replace, image_url, preview);
    }
    return promise_return;
}

function UpdateSideMenu() {
    let menu_shown = JSPLib.storage.getLocalData('npisas-side-menu', {default_val: true});
    if (menu_shown) {
        $('#npisas-side-menu').show();
    } else {
        $('#npisas-side-menu').hide();
    }
}

function BuildPreviewDialog(page_data, $previews) {
    let artwork = GetSessionArtwork(page_data.id);
    let $images = $previews.find('.npisas-preview-section');
    page_data.page.forEach((url_data, i) => {
        let image_info = GetImageURLInfo(url_data.urls.original);
        let source = i < 6 ? url_data.urls.small : null;
        let $img_container = $(RenderImagePreview(url_data, source, i));
        $img_container.on(PROGRAM_CLICK, PopupMediaArtworkImage);
        $img_container.append(RenderImagePreviewInfo(url_data, image_info));
        $img_container.append(RenderImagePreviewMatch(artwork, image_info, i));
        $images.append($img_container);
    });
    if (page_data.page.length > 4) {
        $images.on('scroll.npisas', LoadPreviewImages);
    }
}

//Data functions

function MapArtwork(artwork_id, mapped_posts) {
    let posts_info = MapSourceUrls(mapped_posts);
    return {
        value: {
            id: artwork_id,
            danbooru: posts_info,
            local: [],
            expires: null,
        },
        expires: JSPLib.utility.getExpires(FOUND_ARTWORK_EXPIRES),
    };
}

function NullArtwork(artwork_id) {
    return {
        value: {
            id: artwork_id,
            danbooru: [],
            local: [],
            expires: null,
        },
        expires: JSPLib.utility.getExpires(MISSING_ARTWORK_EXPIRES),
    };
}

function MapSourceUrls(mapped_posts) {
    return mapped_posts.map((post) => {
        let image_info = GetImageURLInfo(post.source);
        return {
            id: post.id,
            date: image_info.date,
            order: image_info.order,
        };
    });
}

function GetImageURLInfo(image_url) {
    for (let i = 0; i < HANDLED_IMAGES.length; i++) {
        let match = HANDLED_IMAGES[i].exec(image_url);
        if (match) {
            let data = {url: image_url};
            for (let key in match.groups) {
                if (JSPLib.utility.isDigit(match.groups[key])) {
                    data[key] = Number(match.groups[key]);
                } else {
                    data[key] = match.groups[key];
                }
            }
            return data;
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

function GetArtworkInfo($artwork) {
    if (!$artwork[0].npisas_artwork_info) {
        let artwork_id = Number($artwork.data('artwork-id'));
        let user_id = Number($artwork.data('user-id') || "");
        let artwork_type = $artwork.attr('npisas-artwork');
        let preview = artwork_type === 'preview';
        let $image = $artwork.find('.npisas-image');
        let image_data = $image.get(0)?.dataset || {};
        if (Object.keys(image_data).length === 0 || !image_data.date) {
            let image = $image.find('img').get(0);
            if (!image) {
                return {artwork_id, user_id, artwork_type, preview, image_url: null};
            }
            image_data = GetImageURLInfo(image.src);
        }
        let image_format = preview ? 'https://i.pximg.net/c/540x540_70/img-master/img/%s/%s_p0_master1200.jpg' : 'https://i.pximg.net/img-master/img/%s/%s_p0_master1200.jpg';
        let image_url = JSPLib.utility.sprintf(image_format, image_data.date, artwork_id);
        let image_count = $image.data('image-count');
        $artwork[0].npisas_artwork_info = {artwork_id, user_id, artwork_type, preview, image_url, image_count};
    }
    return $artwork[0].npisas_artwork_info;
}

function UpdatePostIDsLink(artwork) {
    let $artwork = $(`[data-artwork-id=${artwork.id}]`);
    if ($artwork.length === 0) {
        return;
    }
    let $link_container = $('.npisas-query-menu', $artwork[0]);
    let preview = $artwork.attr('npisas-artwork') === 'preview';
    let {image_url} = GetArtworkInfo($artwork);
    return artwork.post_ids.length === 0 ?
        InitializeNoMatchesLinks(artwork.id, $link_container, image_url, preview) :
        InitializePostIDsLink(artwork, $link_container, preview, image_url);
}

//Render functions

function RenderSideMenu() {
    return JSPLib.utility.regexReplace(SIDE_MENU, {
        RECORDSHELP: RenderHelp(REFRESH_RECORDS_HELP),
        SAUCEHELP: RenderHelp(AVAILABLE_SAUCE_HELP),
        VIEW_HIGHLIGHTS: VIEW_HIGHLIGHTS_HTML,
        VIEW_HIGHLIGHTS_HELP: RenderHelp(VIEWS_HIGHLIGHTS_HELP),
        VIEW_COUNTS: VIEW_COUNTS_HTML,
        VIEW_COUNTS_HELP: RenderHelp(VIEWS_COUNTS_HELP),
        ERRORMESSAGES: JSPLib.network.error_messages.length,
        ERRORMESSAGESHELP: RenderHelp(ERROR_MESSAGES_HELP),
        SETTINGSHELP: SETTINGS_HELP,
        STATISTICSHELP: RenderHelp(STATISTICS_HELP),
    });
}

function RenderPostIDsLink(posts, classname, preview) {
    let mergelink = "";
    let helpinfo = CONFIRM_DELETE_HELP;
    let text = preview ? 'M' : 'Merge';
    mergelink = `<a class="npisas-merge-results npisas-expanded-link" data-replace="2">${text}</a>`;
    helpinfo += '\n' + text + MERGE_RESULTS_HELP;
    let helplink = RenderHelp(helpinfo);
    let post_ids = JSPLib.utility.getObjectAttributes(posts, 'id');
    var title, href;
    if (posts.length === 1) {
        title = GetLinkTitle(posts[0]);
        href = `${NPISAS.domain}/posts/${post_ids[0]}`;
        text = 'post #' + post_ids[0];
    } else {
        title = GetMultiLinkTitle(posts);
        href = `${NPISAS.domain}/posts?tags=status%3Aany+id%3A${post_ids.join(',')}${GetCustomQuery()}`;
        text = post_ids.length + ' sources';
    }
    let idlink = `
<a
    class="npisas-confirm-delete ${classname} npisas-expanded-link"
    target="_blank"
    title="${title}"
    href="${href}"
    data-replace="2"
    >
    ${text}
</a>
`;
    return `
<span class="npisas-query-button npisas-query-postid">${idlink}</span>
|
<span class="npisas-query-button npisas-query-merge">${mergelink}</span>
|
<span class="npisas-query-button npisas-query-help">${helplink}</span>
`;
}

function RenderSimilarIDsLink(post_ids, similar_data, level, type) {
    let helplink = RenderHelp(CONFIRM_IQDB_HELP);
    var title, href, text;
    if (similar_data.length === 1) {
        title = GetLinkTitle(similar_data[0].post);
        href = `${NPISAS.domain}/posts/${post_ids[0]}`;
        text = 'post #' + post_ids[0];
    } else {
        let all_posts = JSPLib.utility.getObjectAttributes(similar_data, 'post');
        let unique_posts = RemoveDuplicates(all_posts, 'id');
        title = GetMultiLinkTitle(unique_posts);
        href = `${NPISAS.domain}/posts?tags=status%3Aany+id%3A${post_ids.join(',')}${GetCustomQuery()}`;
        text = post_ids.length + ' sources';
    }
    let idlink = `
<a
    class="npisas-confirm-save npisas-expanded-link"
    npisas-similar-match="${level}"
    data-type="${type}"
    target="_blank"
    title="${title}"
    href="${href}"
    data-replace="2"
    >
    ${text}
</a>`;
    return `
<span class="npisas-query-button npisas-query-postid">${idlink}</span>
|
<span class="npisas-query-button npisas-query-help">${helplink}</span>
`;
}

function RenderNomatchLinks(pixiv_id, no_iqdb_results, no_sauce_results, merge_results, image_path, preview) {
    let encoded_image_path = encodeURIComponent(image_path);
    let results_text = preview ? 'none' : 'no sources';
    let merge_text = preview ? 'Cancel' : 'Cancel';
    let results_link = !merge_results ?
        `<a class="npisas-manual-add npisas-database-no-match npisas-expanded-link" data-replace="2">${results_text}</a>` :
        `<a class="npisas-cancel-merge npisas-expanded-link" data-replace="2">${merge_text}</a>`;
    let no_url_results = NPISAS.no_url_results.includes(pixiv_id);
    let no_url_text = preview ? '⛔' : 'no sources';
    let url_text = preview ? 'U' : 'URL';
    let url_link = no_url_results ?
        `<a class="npisas-manual-add npisas-database-no-match npisas-expanded-link npisas-check-link" data-type="url" data-replace="2">${no_url_text}</a>` :
        `<a class="npisas-check-url npisas-expanded-link npisas-check-link" title="Query Danbooru using URL" data-replace="2">${url_text}</a>`;
    let no_iqdb_text = preview ? '⛔' : 'no results';
    let iqdb_text = preview ? 'I' : 'IQDB';
    let iqdb_link = no_iqdb_results ?
        `<a class="npisas-reset-results npisas-database-no-match npisas-expanded-link npisas-check-link" data-type="iqdb" data-replace="2">${no_iqdb_text}</a>` :
        `<a class="npisas-check-iqdb npisas-expanded-link npisas-check-link" href="${NPISAS.domain}/iqdb_queries?url=${encoded_image_path}" title="Query Danbooru using image" data-replace="2">${iqdb_text}</a>`;
    let no_sauce_text = preview ? '⛔' : 'no results';
    let sauce_text = preview ? 'S' : 'Sauce';
    let sauce_link = no_sauce_results ?
        `<a class="npisas-reset-results npisas-database-no-match npisas-expanded-link npisas-check-link" data-type="sauce" data-replace="2">${no_sauce_text}</a>` :
        `<a class="npisas-check-sauce npisas-expanded-link npisas-check-link" href="https://saucenao.com/search.php?db=999&url=${image_path}" title="Query SauceNAO using image" data-replace="2">${sauce_text}</a>`;
    let help_info = !merge_results ? [results_text + NO_MATCH_HELP] : [merge_text + CANCEL_HELP];
    if (no_iqdb_results || no_sauce_results) {
        help_info.push(no_iqdb_text + NO_RESULTS_HELP);
    }
    if (!no_url_results) {
        help_info.push(url_text + CHECK_URL_HELP);
    }
    if (!no_iqdb_results) {
        help_info.push(iqdb_text + CHECK_IQDB_HELP);
    }
    if (!no_sauce_results) {
        help_info.push(sauce_text + CHECK_SAUCE_HELP);
    }
    return `
<span class="npisas-query-button npisas-query-results">${results_link}</span>
    |
<span class="npisas-query-button npisas-query-url">${url_link}</span>
    |
<span class="npisas-query-button npisas-query-iqdb">${iqdb_link}</span>
    |
<span class="npisas-query-button npisas-query-sauce">${sauce_link}</span>
    |
<span class="npisas-query-button npisas-query-help">${RenderHelp(help_info.join('\n'))}</span>
`;
}

function RenderHelp(help_text) {
    return `<a class="npisas-help-info npisas-expanded-link" title="${help_text}">&nbsp;?&nbsp;</a>`;
}

function RenderImagePreview(url_data, source, index) {
    let [img_width, img_height] = url_data.width > url_data.height ? ['300px', 'auto'] : ['auto', '300px'];
    let image_src = source ? `src="${source}"` : "";
    return `
<div
    class="npisas-preview-container"
    data-original="${url_data.urls.original}"
    data-regular="${url_data.urls.regular}"
    data-small="${url_data.urls.small}"
    >
    <div class="npisas-preview-image">
        <a href="${url_data.urls.original}" onclick="return false">
            <img
                style="width: ${img_width}; height: ${img_height};"
                alt="image #${index}"
                ${image_src}
                >
        </a>
    </div>
</div>`;
}

function RenderImagePreviewInfo(url_data, image_info) {
    let extension = image_info.ext.toUpperCase();
    return `
<div class="npisas-preview-info">
    ${extension} [${url_data.width} x ${url_data.height}]
</div>`;
}

function RenderImagePreviewMatch(artwork, image_info, index) {
    let sources = artwork.danbooru.filter((source) => source.order === index);
    let is_match = Boolean(sources.find((source) => source.date === image_info.date));
    let link_class = is_match ? 'npisas-database-match' : 'npisas-database-mismatch';
    var link;
    if (sources.length > 0) {
        var href, text;
        if (sources.length === 1) {
            href = `${NPISAS.domain}/posts/${sources[0].id}`;
            text = 'post #' + sources[0].id;
        } else {
            let post_ids = JSPLib.utility.getObjectAttributes(sources, 'id');
            href = `${NPISAS.domain}/posts?tags=status%3Aany+id%3A${post_ids.join(',')}${GetCustomQuery()}`;
            text = sources.length + ' sources';
        }
        link = `<a class="npisas-expanded-link ${link_class}" href="${href}">${text}</a>`;
    } else {
        link = '(<span style="color: red;">no sources</span>)';
    }
    return `
<div class="npisas-preview-match">
    ${link}
</div>`;
}

function RenderIllustPreviews(page_data) {
    return JSPLib.utility.regexReplace(ILLUST_PREVIEWS_HTML, {
        ARTWORK_ID: page_data.id,
        QUERIED: JSPLib.utility.timeAgo(page_data.queried, {recent_duration: RECENT_DURATION}),
    });
}

function RenderIllustInfo(illust_data) {
    let reading_html = illust_data.type === 'manga' ? `<li><b>Reading:</b> ${illust_data.reading}</li>` : "";
    let tags_html = illust_data.tags.map((tag_data) => {
        let prepend = tag_data.deletable ? 'X' : 'O';
        let translation = tag_data.translation ? `<small>(${tag_data.translation})</small>` : "";
        return `<li>[${prepend}] <a href="/tags/${tag_data.name}/artworks">${tag_data.name}</a> ${translation}</li>`;
    }).join("");
    return JSPLib.utility.regexReplace(ILLUST_INFO_HTML, {
        ARTWORK_ID: illust_data.id,
        TITLE: illust_data.title,
        DESCRIPTION: illust_data.description,
        DATE: illust_data.date,
        BOOKMARKS: illust_data.bookmarks,
        TYPE: illust_data.type,
        READING: reading_html,
        REQUEST: illust_data.request,
        ORIGINAL: illust_data.original,
        AI: illust_data.ai,
        TAGS: tags_html,
        QUERIED: JSPLib.utility.timeAgo(illust_data.queried, {recent_duration: RECENT_DURATION}),
    });
}

//Initialize functions

async function InitializeMainArtwork(container) {
    let $artwork = $(container);
    let $artwork_controls = $('.pixiv-artwork-controls', container);
    $artwork_controls.before(`<div class="npisas-fullsize-controls">${FULLSIZE_ARTWORK_MENU_HTML}</div>`);
    AdjustArtworkControls();
    let $link_container = $artwork.find('.npisas-query-menu');
    let artwork_id = Number($artwork.data('artwork-id'));
    let {image_url} = GetArtworkInfo($artwork);
    let artwork = await GetArtwork(artwork_id);
    if (artwork.post_ids.length) {
        InitializePostIDsLink(artwork, $link_container, false, image_url);
    } else {
        InitializeNoMatchesLinks(artwork_id, $link_container, image_url, false);
    }
}

async function InitializePreviewArtwork(container) {
    const $artwork = $(container);
    let artwork_id = Number($artwork.data('artwork-id'));
    let $container = $(MICRO_ARTWORK_MENU_HTML);
    let encoded_url = encodeURIComponent('https://www.pixiv.net/artworks/' + artwork_id);
    $container.find('.npisas-upload-artwork').attr('href', `${NPISAS.domain}/uploads/new?url=${encoded_url}`);
    let $link_container = $container.find('.npisas-query-menu');
    $artwork.find('.npisas-preview-controls').append($container);
    let artwork = await GetArtwork(artwork_id);
    let {image_url} = GetArtworkInfo($artwork);
    if (artwork.post_ids.length) {
        InitializePostIDsLink(artwork, $link_container, true, image_url);
    } else {
        InitializeNoMatchesLinks(artwork_id, $link_container, image_url, true);
    }
}

function InitializeSideMenu() {
    $('#npisas-side-menu [data-setting]').each((_, entry) => {
        let setting = $(entry).data('setting');
        if (NPISAS.user_settings[setting]) {
            $(entry).show();
        } else {
            $(entry).hide();
        }
    });
    let selected_menu = JSPLib.storage.checkLocalData('npisas-side-selection', {default_val: 'info'});
    $(`#npisas-menu-selection a[data-selector=${selected_menu}]`).addClass('npisas-selected');
    $(`#npisas-content div[data-selector=${selected_menu}]`).show();
    JSPLib.storage.retrieveData('npisas-available-sauce', SAUCE_EXPIRES).then((data) => {
        if (data) {
            $('#npisas-available-sauce').text(data.value);
        }
    });
    GetManualRecords().then((total) => {
        $('#npisas-manual-records').text(total);
    });
}

async function InitializePostIDsLink(artwork, $link_container, preview, image_url, expanded = false) {
    let posts_data = await GetPosts(artwork.post_ids);
    let is_expired = expanded ? artwork.image_expired(image_url) : artwork.is_expired(image_url);
    let link_class = !is_expired ? 'npisas-database-match' : 'npisas-database-mismatch';
    $link_container.html(RenderPostIDsLink(posts_data, link_class, preview));
}

async function InitializeNoMatchesLinks(pixiv_id, $obj, image_path, preview) {
    let [iqdb_results, sauce_results] = await Promise.all([
        GetData('iqdb-' + pixiv_id, 'danbooru'),
        GetData('sauce-' + pixiv_id, 'danbooru'),
    ]);
    let merge_results = NPISAS.merge_results.includes(pixiv_id);
    $obj.html(RenderNomatchLinks(pixiv_id, iqdb_results !== null && iqdb_results.value, sauce_results !== null && sauce_results.value, merge_results, image_path, preview));
}

function InitializeUIStyle() {
    if (!JSPLib.utility.hasStyle('jquery')) {
        const jquery_ui_css = GM_getResourceText('jquery_ui_css');
        JSPLib.utility.setCSSStyle(jquery_ui_css, 'jquery');
    }
}

//Page functions

function PageNavigation(pagetype) {
    //Use all non-URL matching groups as a page key to detect page changes
    let page_key = JSPLib.utility.arrayUnique(Object.values(NPISAS.page_match)).join(',');
    if (NPISAS.page === pagetype && NPISAS.page_key === page_key) {
        return;
    }
    let page_id = Number(NPISAS.page_match.id);
    NPISAS.prev_page = NPISAS.page;
    NPISAS.page = pagetype;
    NPISAS.page_key = page_key;
    ['user_id', 'type', 'tag', 'artwork_id'].forEach((key) => {delete NPISAS[key];});
    switch (NPISAS.page) {
        case 'users':
        case 'illusts':
        case 'tagillusts':
        case 'bookmarks':
            JSPLib.debug.debuglog(`User pages [${NPISAS.page}]:`, page_id);
            NPISAS.user_id = page_id;
            NPISAS.type = NPISAS.page_match.type;
            NPISAS.tag = NPISAS.page_match.tag;
            $(document).off('scroll.npisas.check_menu');
            break;
        case 'artworks':
            JSPLib.debug.debuglog(`Artworks page [${NPISAS.page}]:`, page_id);
            NPISAS.artwork_id = page_id;
            $(document).on('scroll.npisas.check_menu', AdjustArtworkControls);
            break;
        default:
            //Do nothing
    }
    if ($('.npisas-side-menu').length === 0) {
        $(document.body).append(RenderSideMenu());
        InitializeSideMenu();
        if (!JSPLib.utility.isNamespaceBound('#npisas-open-settings', 'click', PROGRAM_SHORTCUT)) {
            $('#npisas-open-settings').on(PROGRAM_CLICK, OpenSettingsMenu);
            $('#npisas-menu-selection a').on(PROGRAM_CLICK, SideMenuSelection);
        }
    }
    UpdateSideMenu();
}

function GetPageMatch(url) {
    for (let key in PAGE_REGEXES) {
        let match = PAGE_REGEXES[key].exec(url);
        if (match) {
            return Object.assign({key, url}, match.groups);
        }
    }
    return null;
}

function GetPageType() {
    let page_url = window.location.href.split('#')[0];
    NPISAS.page_match = GetPageMatch(page_url);
    if (NPISAS.page_match) {
        return NPISAS.page_match.key;
    }
    return 'other';
}

//Markup functions

function MarkupMainArtwork(artwork) {
    let $artwork = $(artwork);
    $artwork.addClass('npisas-artwork npisas-main-artwork');
    $artwork.attr('npisas-artwork', 'main');
    $artwork.attr('data-artwork-id', NPISAS.artwork_id);
    let user_id = $('[data-click-label="follow"]').data('gtm-user-id');
    $artwork.attr('data-user-id', user_id);
    let $count = $('.gtm-manga-viewer-open-preview');
    let artwork_type = $count.length ? 'manga' : 'illust';
    $artwork.addClass(`npisas-${artwork_type}-artwork`);
    if ($count.length === 0) {
        $count = $('.gtm-manga-viewer-preview-modal-open');
    }
    let page_count = $count.length ? $count.text().match(/1\/(\d+)/)?.[1] ?? 1 : 1;
    $artwork.attr('data-pages', page_count);
    NPISAS.multi_artwork = page_count > 1;
    let page_class = (NPISAS.multi_artwork ? 'npisas-multi-artwork' : 'npisas-single-artwork');
    $artwork.addClass(page_class);
    $artwork.find('>figure').addClass('npisas-image-container');
    $artwork.find('>figcaption').addClass('npisas-captions');
    $artwork.find('>div').each((_, entry) => {
        let $entry = $(entry);
        if ($entry.find('button').length > 1) {
            $entry.addClass('pixiv-artwork-controls');
            return false;
        }
    });
    let $controls = $artwork.find('.pixiv-artwork-controls');
    $controls.find('button').each((_, entry) => {
        let $entry = $(entry);
        if (entry.innerText === "See all") {
            $entry.addClass('pixiv-show-all-button');
            $entry.parent().addClass('pixiv-buttons-container');
            return false;
        }
    });
    return NPISAS.artwork_id;
}

function MarkupPreviewArtwork(artwork) {
    let artwork_id = null;
    let $artwork = $(artwork);
    $artwork.addClass('npisas-artwork npisas-preview-artwork');
    $artwork.attr('npisas-artwork', 'preview');
    let $artwork_children = $artwork.children();
    let $image = $artwork_children.eq(0);
    let image_count = $image.get(0).innerText;
    if (image_count.match(/^\d+$/)) {
        $image.addClass('npisas-multi-image');
        $image.attr('data-image-count', image_count);
    } else {
        $image.addClass('npisas-single-image');
        $image.attr('data-image-count', 1);
    }
    $image.addClass('npisas-image');
    $artwork_children.eq(1).addClass('npisas-captions');
    let $artist = $artwork_children.eq(2);
    $artist.addClass('npisas-artist');
    let link = $artwork.find('a').get(0);
    if (link) {
        let match = GetPageMatch(link.href);
        if (match?.key === 'artworks') {
            artwork_id = Number(match.id);
            $artwork.attr('data-artwork-id', artwork_id);
        }
    }
    if (NPISAS.user_id) {
        $artwork.attr('data-user-id', NPISAS.user_id);
    } else if ($artist.length) {
        link = $artist.find('a').get(0);
        if (link) {
            let match = GetPageMatch(link.href);
            if (['users', 'user_illusts', 'user_tag_illusts', 'bookmarks'].includes(match?.key)) {
                $artwork.attr('data-user-id', Number(match.id));
            }
        }
    }
    $artwork.append('<div class="npisas-preview-controls"></div>');
    return artwork_id;
}

function MarkupImageArtwork(image) {
    let $image = $(image);
    $image.addClass('npisas-image');
    let $link = $image.find('a');
    let image_url = $link.attr('href');
    let image_info = image_url && GetImageURLInfo(image_url);
    if (image_info) {
        $image.attr('data-image', image_url);
        $image.attr('data-num', image_info.order);
    }
}

function CheckExpandedImages() {
    if (!NPISAS.multi_expanded) {
        let $artwork_images = $('.npisas-main-artwork.npisas-multi-artwork .npisas-image');
        if ($artwork_images.length > 1) {
            NPISAS.multi_expanded = true;
        }
    }
    if (NPISAS.multi_expanded) {
        let $unprocessed_images = $('.npisas-main-artwork.npisas-multi-artwork .npisas-image:not([pisas])');
        if ($unprocessed_images.length === 0) {
            return;
        }
        let artwork = GetSessionArtwork(NPISAS.artwork_id);
        let post_ids = (artwork?.post_ids) || [];
        let artwork_posts = post_ids.map((post_id) => NPISAS.post_data[post_id]);
        $unprocessed_images.each((_, image) => {
            let $image = $(image);
            let image_url = $image.data('image');
            let image_info = GetImageURLInfo(image_url);
            let image_key = image_info.id + '-' + image_info.order;
            let posts = artwork_posts.filter((post) => {
                let normalized_url = NormalizeSource(post.source);
                let post_info = GetImageURLInfo(normalized_url);
                if (post_info) {
                    let post_key = post_info.id + '-' + post_info.order;
                    return post_key === image_key;
                }
                return false;
            });
            var html;
            if (posts.length === 1) {
                let post_url = `${NPISAS.domain}/posts/${posts[0].id}`;
                let title = GetLinkTitle(posts[0]);
                let text = 'post #' + posts[0].id;
                let match_class = (NormalizeSource(posts[0].source) === NormalizeSource(image_url) ? 'npisas-database-match' : 'npisas-database-mismatch');
                html = `<a class="${match_class} npisas-expanded-link" href="${post_url}" title="${title}" target="_blank">${text}</a>`;
            } else if (posts.length > 1) {
                let matching_post = posts.find((post) => post.source === image_url);
                let post_url = `${NPISAS.domain}/posts?tags=status%3Aany+id%3A${post_ids.join(',')}`;
                let title = GetMultiLinkTitle(posts);
                let text = post_ids.length + ' sources';
                let match_class = (matching_post ? 'npisas-database-match' : 'npisas-database-mismatch');
                html = `<a class="${match_class} npisas-expanded-link" href="${post_url}" title="${title}" target="_blank">${text}</a>`;
            } else {
                html = `<span class="npisas-database-no-match">not uploaded</span>`;
            }
            $image.append(`<div class="npisas-expanded-image-info">( ${html} )</div>`);
        });
        $unprocessed_images.attr('pisas', 'done');
    }
}

//Storage functions

////Queue

function QueueStorageRequest(type, key, value, database) {
    let queue_key = type + '-' + key + '-' + database;
    if (!CACHE_STORAGE_TYPES.includes(type) || !(queue_key in CACHED_STORAGE_REQUESTS)) {
        const request = {
            type,
            key,
            value,
            database,
            promise: $.Deferred(),
            error: (JSPLib.debug.debug_console ? new Error() : null),
        };
        if (CACHE_STORAGE_TYPES.includes(type)) {
            JSPLib.debug.recordTime(key, 'Storage-queue');
        }
        QUEUED_STORAGE_REQUESTS.push(request);
        CACHED_STORAGE_REQUESTS[queue_key] = request.promise;
        JSPLib.debug.debugExecute(() => {
            SAVED_STORAGE_REQUESTS.push(request);
        });
    }
    return CACHED_STORAGE_REQUESTS[queue_key];
}

function IntervalStorageHandler() {
    if (QUEUED_STORAGE_REQUESTS.length === 0) {
        return;
    }
    JSPLib.debug.debuglogLevel(() => ["Queued requests:", JSPLib.utility.dataCopy(QUEUED_STORAGE_REQUESTS)], JSPLib.debug.VERBOSE);
    for (let database in STORAGE_DATABASES) {
        let requests = QUEUED_STORAGE_REQUESTS.filter((request) => (request.database === database));
        let save_requests = requests.filter((request) => (request.type === 'save'));
        if (save_requests.length) {
            JSPLib.debug.debuglogLevel("Save requests:", save_requests, JSPLib.debug.DEBUG);
            let save_data = Object.assign(...save_requests.map((request) => ({[request.key]: request.value})));
            JSPLib.storage.batchSaveData(save_data, {database: STORAGE_DATABASES[database]}).then(() => {
                save_requests.forEach((request) => {
                    request.promise.resolve(null);
                    request.endtime = performance.now();
                });
            });
        }
        let remove_requests = requests.filter((request) => (request.type === 'remove'));
        if (remove_requests.length) {
            JSPLib.debug.debuglogLevel("Remove requests:", remove_requests, JSPLib.debug.DEBUG);
            let remove_keys = remove_requests.map((request) => request.key);
            JSPLib.storage.batchRemoveData(remove_keys, {database: STORAGE_DATABASES[database]}).then(() => {
                remove_requests.forEach((request) => {
                    request.promise.resolve(null);
                    request.endtime = performance.now();
                });
            });
        }
        let check_requests = requests.filter((request) => (request.type === 'check'));
        if (check_requests.length) {
            JSPLib.debug.debuglogLevel("Check requests:", check_requests, JSPLib.debug.DEBUG);
            let check_keys = check_requests.map((request) => request.key);
            JSPLib.storage.batchCheckLocalDB(check_keys, ValidateExpiration, {database: STORAGE_DATABASES[database]}).then((check_data) => {
                FulfillStorageRequests(check_keys, check_data, check_requests);
            });
        }
        let noncheck_requests = requests.filter((request) => (request.type === 'get'));
        if (noncheck_requests.length) {
            JSPLib.debug.debuglogLevel("Noncheck requests:", noncheck_requests, JSPLib.debug.DEBUG);
            let noncheck_keys = noncheck_requests.map((request) => request.key);
            JSPLib.storage.batchRetrieveData(noncheck_keys, {database: STORAGE_DATABASES[database]}).then((noncheck_data) => {
                FulfillStorageRequests(noncheck_keys, noncheck_data, noncheck_requests);
            });
        }
    }
    QUEUED_STORAGE_REQUESTS.length = 0;
}

function FulfillStorageRequests(keylist, data_items, requests) {
    keylist.forEach((key) => {
        let data = (key in data_items ? data_items[key] : null);
        let request = requests.find((request) => (request.key === key));
        request.promise.resolve(data);
        request.data = data;
        JSPLib.debug.recordTimeEnd(key, 'Storage-queue');
    });
}

////Access

//////General

async function GetData(key, database) {
    //let type = (database === 'danbooru' || database? 'check' : 'get');
    let data = await QueueStorageRequest('check', key, null, database);
    return data;
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

//////Danbooru

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

function MergeArtwork(artwork, merge, duration) {
    if (merge.value.local.length) {
        artwork.value.local = merge.value.local;
        artwork.value.expires = JSPLib.utility.getExpires(duration);
        artwork.expires = 0;
    }
}

////Helpers

function InvalidateCache(key, database) {
    CACHE_STORAGE_TYPES.forEach((type) => {
        let queue_key = type + '-' + key + '-' + database;
        delete CACHED_STORAGE_REQUESTS[queue_key];
    });
}

////Other

async function GetManualRecords() {
    if (JSPLib.concurrency.checkTimeout('npisas-length-recheck', LENGTH_RECHECK_INTERVAL)) {
        let manual_records = 0;
        await JSPLib.storage.pixivstorage.iterate((value, key) => {
            if (key.startsWith('artwork-') && value.expires === 0) {
                manual_records++;
            }
        });
        JSPLib.storage.setLocalData('npisas-database-length', manual_records);
        JSPLib.concurrency.setRecheckTimeout('npisas-length-recheck', LENGTH_RECHECK_INTERVAL);
    }
    return JSPLib.storage.getLocalData('npisas-database-length', {default_val: 0});
}

//Network functions

function QueueNetworkRequest (type, item) {
    const request_key = type + ',' + item.toString();
    const request = {
        type,
        item,
        request_key,
        promise: $.Deferred(),
        error: (JSPLib.debug.debug_console ? new Error() : null),
    };
    JSPLib.debug.recordTime(request_key, 'Network-queue');
    QUEUED_NETWORK_REQUESTS.push(request);
    JSPLib.debug.debugExecute(() => {
        SAVED_NETWORK_REQUESTS.push(request);
    });
    return request.promise;
}

function IntervalNetworkHandler () {
    if (QUEUED_NETWORK_REQUESTS.length === 0) {
        return;
    }
    for (let type in NETWORK_REQUEST_DICT) {
        const requests = QUEUED_NETWORK_REQUESTS.filter((request) => (request.type === type));
        if (requests.length > 0) {
            const items = requests.map((request) => request.item).flat();
            const params = NETWORK_REQUEST_DICT[type].params(items);
            const data_key = NETWORK_REQUEST_DICT[type].data_key;
            const controller = NETWORK_REQUEST_DICT[type].controller || type;
            JSPLib.danbooru.submitRequest(controller, params, {default_val: [], domain: NPISAS.domain}).then((data_items) => {
                for (let i = 0; i < requests.length; i++) {
                    let request = requests[i];
                    let request_data = data_items.filter((data) => request.item.includes(data[data_key]));
                    request.promise.resolve(request_data);
                    request.data = request_data;
                    JSPLib.debug.recordTimeEnd(request.request_key, 'Network-queue');
                }
            });
        }
    }
    QUEUED_NETWORK_REQUESTS.length = 0;
}

//Data query functions

////General

async function GetItems(item_ids, storage_key, network_key, storage_database) {
    let storage_promises = item_ids.map((id) => GetData(storage_key + '-' + id, storage_database));
    let storage_data = await Promise.all(storage_promises);
    storage_data = storage_data.filter((data) => (data !== null));
    storage_data = JSPLib.utility.getObjectAttributes(storage_data, 'value');
    let found_ids = JSPLib.utility.getObjectAttributes(storage_data, 'id');
    let missing_ids = JSPLib.utility.arrayDifference(item_ids, found_ids);
    let network_data = [];
    if (missing_ids.length) {
        network_data = await QueueNetworkRequest(network_key, missing_ids);
        JSPLib.debug.debuglog('GetItems', network_key, missing_ids, network_data);
    }
    return [storage_data, network_data];
}

////Danbooru

async function GetPosts(post_ids) {
    let [posts_data, network_posts] = await GetItems(post_ids, 'post', 'posts', 'danbooru');
    if (network_posts.length) {
        let mapped_posts = network_posts.map(MapPost);
        SavePosts(mapped_posts);
        SavePostUsers(mapped_posts);
        posts_data = posts_data.concat(mapped_posts);
    }
    posts_data.sort((a, b) => (post_ids.indexOf(a.id) - post_ids.indexOf(b.id)));
    posts_data.forEach((post) => {
        NPISAS.post_data[post.id] = post;
    });
    return posts_data;
}

async function GetUsers(user_ids) {
    let [users_data, network_users] = await GetItems(user_ids, 'user', 'users', 'danbooru');
    if (network_users.length) {
        let mapped_users = network_users.map((data) => ({id: data.id, name: data.name}));
        SaveUsers(mapped_users);
        users_data = users_data.concat(mapped_users);
    }
    users_data.sort((a, b) => (user_ids.indexOf(a.id) - user_ids.indexOf(b.id)));
    users_data.forEach((user) => {
        NPISAS.user_data[user.id] = user;
    });
    return users_data;
}

async function GetArtwork(artwork_id) {
    GetArtwork.artworks ??= {};
    let storage_data = await GetData('artwork-' + artwork_id, 'pixiv');
    if (!storage_data || (storage_data.expires === 0 && !JSPLib.utility.validateExpires(storage_data.value.expires))) {
        let network_posts = await QueueNetworkRequest('artworks', [artwork_id]);
        var duration;
        if (network_posts.length) {
            let mapped_posts = network_posts.map(MapPost);
            SavePosts(mapped_posts);
            SavePostUsers(mapped_posts);
            GetArtwork.artworks[artwork_id] = MapArtwork(artwork_id, mapped_posts);
            duration = FOUND_ARTWORK_EXPIRES;
        } else {
            GetArtwork.artworks[artwork_id] = NullArtwork(artwork_id);
            duration = MISSING_ARTWORK_EXPIRES;
        }
        if (storage_data) {
            MergeArtwork(GetArtwork.artworks[artwork_id], storage_data, duration);
        }
        SaveData('artwork-' + artwork_id, GetArtwork.artworks[artwork_id], 'pixiv');
        JSPLib.debug.debuglog('GetArtwork', artwork_id, GetArtwork.artworks[artwork_id]);
    } else {
        GetArtwork.artworks[artwork_id] = storage_data;
    }
    return new Artwork(GetArtwork.artworks[artwork_id].value);
}

////Pixiv

async function CheckIllustsForAI(artwork_ids) {
    CheckIllustsForAI.illusts ??= {};
    let missing_ids = JSPLib.utility.arrayDifference(artwork_ids, Object.keys(CheckIllustsForAI.illusts).map(Number));
    if (missing_ids.length) {
        let storage_ids = [];
        let storage_data = await Promise.all(missing_ids.map((artwork_id) => GetData('ai-' + artwork_id, 'pixiv')));
        storage_data.forEach((data) => {
            if (data) {
                CheckIllustsForAI.illusts[data.value.id] = data;
                storage_ids.push(data.value.id);
            }
        });
        let query_ids = JSPLib.utility.arrayDifference(missing_ids, storage_ids);
        if (query_ids.length) {
            let network_data = await JSPLib.network.getJSON('/ajax/user/1/illusts', {data: {ids: query_ids}});
            if (!network_data.error) {
                for (let i = 0; i < query_ids.length; i++) {
                    let artwork_id = query_ids[i];
                    let is_ai = network_data.body[artwork_id]?.aiType === 2;
                    CheckIllustsForAI.illusts[artwork_id] = {
                        value: {
                            id: artwork_id,
                            is_ai,
                        },
                        expires: JSPLib.utility.getExpires(AI_EXPIRES),
                    };
                    SaveData('ai-' + artwork_id, CheckIllustsForAI.illusts[artwork_id], 'pixiv');
                }
            }
            JSPLib.debug.debuglog('CheckIllustsForAI', query_ids);
        }
    }
    return JSPLib.utility.mergeHashes(...artwork_ids.map((artwork_id) => ({[artwork_id]: CheckIllustsForAI.illusts[artwork_id].value ?? {}})));
}

async function GetIllustUrls(artwork_id, image_url, force_network = false) {
    GetIllustUrls.pages ??= {};
    if (!GetIllustUrls.pages[artwork_id] || force_network) {
        let storage_data = !force_network ?
            (await GetData('page-' + artwork_id, 'pixiv')) :
            null;
        if (!storage_data || storage_data.value.date !== GetImageURLInfo(image_url).date) {
            let network_data = await JSPLib.network.getJSON(`/ajax/illust/${artwork_id}/pages`);
            if (!network_data.body.error) {
                let image_info = GetImageURLInfo(network_data.body[0].urls.original);
                GetIllustUrls.pages[artwork_id] = {
                    value: {
                        id: image_info.id,
                        date: image_info.date,
                        page: network_data.body,
                        queried: Date.now(),
                    },
                    expires: JSPLib.utility.getExpires(PAGE_EXPIRES),
                };
                SaveData('page-' + artwork_id, GetIllustUrls.pages[artwork_id], 'pixiv');
                JSPLib.debug.debuglog('GetIllustUrls', artwork_id, GetIllustUrls.pages[artwork_id]);
            } else {
                GetIllustUrls.pages[artwork_id] = {};
            }
        } else {
            GetIllustUrls.pages[artwork_id] = storage_data;
        }
    }
    return GetIllustUrls.pages[artwork_id].value;
}

async function GetIllustInfo(artwork_id, force_network = false) {
    GetIllustInfo.illusts ??= {};
    if (!GetIllustInfo.illusts[artwork_id] || force_network) {
        let storage_data = !force_network ?
            (await GetData('info-' + artwork_id, 'pixiv')) :
            null;
        if (!storage_data) {
            let network_data = await JSPLib.network.getJSON(`/ajax/illust/${artwork_id}`);
            if (!network_data.body.error) {
                let tags = network_data.body.tags.tags.map((tag_data) => {
                    let translation = tag_data.translation?.en ?? null;
                    return {
                        name: tag_data.tag,
                        deletable: tag_data.deletable,
                        translation,
                    };
                });
                let date = network_data.body.userIllusts[String(artwork_id)]?.createDate ?? network_data.body.createDate;
                GetIllustInfo.illusts[artwork_id] = {
                    value: {
                        id: artwork_id,
                        title: network_data.body.title,
                        description: network_data.body.description,
                        date: new Date(date).toISOString(),
                        bookmarks: network_data.body.bookmarkCount,
                        type: network_data.body.illustType === 0 ? 'illust' : 'manga',
                        reading: network_data.body.bookStyle === 0 ? 'scroll' : 'book',
                        original: network_data.body.isOriginal,
                        request: Boolean(network_data.body.request),
                        ai: network_data.body.aiType === 2,
                        queried: Date.now(),
                        tags,
                    },
                    expires: JSPLib.utility.getExpires(INFO_EXPIRES),
                };
                SaveData('info-' + artwork_id, GetIllustInfo.illusts[artwork_id], 'pixiv');
                JSPLib.debug.debuglog('GetIllustInfo', artwork_id, GetIllustInfo.illusts[artwork_id]);
            } else {
                GetIllustInfo.illusts[artwork_id] = {};
            }
        } else {
            GetIllustInfo.illusts[artwork_id] = storage_data;
        }
    }
    return GetIllustInfo.illusts[artwork_id].value;
}

//Event handlers

////Side menu

function ToggleSideMenu() {
    let menu_shown = JSPLib.storage.getLocalData('npisas-side-menu', {default_val: true});
    JSPLib.storage.setLocalData('npisas-side-menu', !menu_shown);
    UpdateSideMenu();
}

function SideMenuSelection(event) {
    let $link = $(event.target);
    let selected_menu = $link.data('selector');
    $('#npisas-menu-selection > a').removeClass('npisas-selected');
    $(`#npisas-menu-selection a[data-selector=${selected_menu}]`).addClass('npisas-selected');
    $('#npisas-content > div').hide();
    $(`#npisas-content div[data-selector=${selected_menu}]`).show();
    JSPLib.storage.setLocalData('npisas-side-selection', selected_menu);
}

////Query menu

async function CheckURL(event) {
    event.preventDefault();
    let {$link, artwork_id} = GetEventPreload(event, 'npisas-check-url');
    let timer = SetRotatingIcon($link);
    let data = await JSPLib.danbooru.submitRequest('posts', {tags: 'status:any pixiv_id:' + artwork_id, only: POST_FIELDS}, {default_val: [], domain: NPISAS.domain, notify: true});
    let storage_artwork = GetSessionArtworkData(artwork_id);
    var mapped_artwork, duration;
    if (data.length === 0) {
        NPISAS.no_url_results.push(artwork_id);
        mapped_artwork = NullArtwork(artwork_id);
        duration = MISSING_ARTWORK_EXPIRES;
    } else {
        let mapped_posts = data.map(MapPost);
        SavePosts(mapped_posts);
        SavePostUsers(mapped_posts);
        mapped_artwork = MapArtwork(artwork_id, mapped_posts);
        duration = FOUND_ARTWORK_EXPIRES;
    }
    MergeArtwork(mapped_artwork, storage_artwork, duration);
    SaveData('artwork-' + artwork_id, mapped_artwork, 'pixiv');
    let artwork = new Artwork(mapped_artwork.value);
    UpdatePostIDsLink(artwork).then(() => {
        clearInterval(timer);
    });
}

async function CheckIQDB(event) {
    event.preventDefault();
    let {$link, artwork_id, preview, image_url, $replace} = GetEventPreload(event, 'npisas-check-iqdb');
    let timer = SetRotatingIcon($link);
    let iqdb_results = await JSPLib.danbooru.submitRequest('iqdb_queries', {url: image_url, similarity: NPISAS.user_settings.similarity_cutoff, limit: NPISAS.user_settings.results_returned}, {default_val: [], domain: NPISAS.domain, notify: true});
    let post_data = JSPLib.utility.getObjectAttributes(iqdb_results, 'post');
    let unique_posts = RemoveDuplicates(post_data, 'id');
    let mapped_posts = unique_posts.map(MapPost);
    let uploader_ids = JSPLib.utility.arrayUnique(JSPLib.utility.getObjectAttributes(mapped_posts, 'uploaderid'));
    let user_data = await GetUsers(uploader_ids);
    mapped_posts.forEach((post) => {
        let user = user_data.find((user) => (user.id === post.uploaderid));
        post.uploadername = user.name;
    });
    SavePosts(mapped_posts);
    let valid_results = iqdb_results.filter((result) => (result.post !== undefined && result.post.id !== undefined));
    let filter_results = valid_results.filter((result) => (parseFloat(result.score) >= NPISAS.user_settings.similarity_cutoff));
    let sorted_results = filter_results.sort((resulta, resultb) => (resultb.score - resulta.score)).slice(0, NPISAS.user_settings.results_returned);
    let similar_data = sorted_results.map((result) => {
        let score = result.score;
        let post_id = result.post.id;
        let post = mapped_posts.find((post) => (post.id === post_id));
        return {
            score,
            post,
        };
    });
    ProcessSimilarData('iqdb', artwork_id, $replace, image_url, similar_data, preview).then(() => {
        clearInterval(timer);
    });
}

async function CheckSauce(event) {
    event.preventDefault();
    if (!NPISAS.user_settings.SauceNAO_API_key) {
        JSPLib.notice.error("<b>Error!</b> Must set SauceNAO API key in user settings.");
        return;
    }
    let {$link, artwork_id, preview, image_url, $replace} = GetEventPreload(event, 'npisas-check-sauce');
    let timer = SetRotatingIcon($link);
    let sauce_results = await JSPLib.saucenao.getSauce(image_url, JSPLib.saucenao.getDBIndex('danbooru'), NPISAS.user_settings.results_returned);
    if (!JSPLib.saucenao.checkSauce(sauce_results)) {
        return;
    }
    let filtered_data = sauce_results.results.filter((result) => (parseFloat(result.header.similarity) >= NPISAS.user_settings.similarity_cutoff));
    let similar_data = [];
    if (filtered_data.length) {
        JSPLib.debug.debuglog(`Found ${filtered_data.length} results.`);
        let danbooru_ids = JSPLib.utility.arrayUnique(JSPLib.utility.getNestedObjectAttributes(filtered_data, ['data', 'danbooru_id']));
        var posts_data = await GetPosts(danbooru_ids);
        let filter_results = sauce_results.results.filter((result) => (parseFloat(result.header.similarity) >= NPISAS.user_settings.similarity_cutoff));
        let sorted_results = filter_results.sort((resulta, resultb) => (resultb.score - resulta.score)).slice(0, NPISAS.user_settings.results_returned);
        similar_data = sorted_results.map((result) => {
            let score = parseFloat(result.header.similarity);
            let post_id = result.data.danbooru_id;
            let post = posts_data.find((post) => (post.id === post_id));
            return {
                score,
                post,
            };
        });
    } else {
        JSPLib.debug.debuglog("No results found.");
    }
    ProcessSimilarData('sauce', artwork_id, $replace, image_url, similar_data, preview);
    let sauce_remaining = sauce_results.header.long_remaining;
    $('#npisas-available-sauce').text(sauce_remaining);
    JSPLib.storage.saveData('npisas-available-sauce', {value: sauce_remaining, expires: JSPLib.utility.getExpires(SAUCE_EXPIRES)}).then(() => {
        clearInterval(timer);
    });
}

function ManualAdd(event) {
    let {artwork_id} = GetEventPreload(event, 'npisas-manual-add');
    PromptSavePostIDs(artwork_id, MANUAL_ADD_PROMPT, []);
}

function ConfirmDelete(event) {
    let {artwork_id} = GetEventPreload(event, 'npisas-confirm-delete');
    let artwork = GetSessionArtwork(artwork_id);
    PromptSavePostIDs(artwork_id, CONFIRM_SAVE_PROMPT, artwork.local);
    event.preventDefault();
}

function ConfirmSave(event) {
    let {artwork_id} = GetEventPreload(event, 'npisas-confirm-save');
    let save_post_ids = NPISAS.similar_results[artwork_id];
    if (NPISAS.merge_results.includes(artwork_id)) {
        let artwork = GetSessionArtwork(artwork_id);
        save_post_ids = JSPLib.utility.arrayUnion(artwork.local, save_post_ids);
    }
    PromptSavePostIDs(artwork_id, CONFIRM_SAVE_PROMPT, save_post_ids);
    event.preventDefault();
}

function ResetResults(event) {
    let {$link, artwork_id, preview, image_url, $replace} = GetEventPreload(event, 'npisas-reset-results');
    let type = $link.data('type');
    RemoveData(type + '-' + artwork_id, 'danbooru');
    InitializeNoMatchesLinks(artwork_id, $replace, image_url, preview);
}

function MergeResults(event) {
    let {artwork_id, preview, image_url, $replace} = GetEventPreload(event, 'npisas-merge-results');
    NPISAS.merge_results = JSPLib.utility.arrayUnion(NPISAS.merge_results, [artwork_id]);
    InitializeNoMatchesLinks(artwork_id, $replace, image_url, preview);
}

function CancelMerge(event) {
    let {artwork_id, preview, image_url, $replace} = GetEventPreload(event, 'npisas-cancel-merge');
    NPISAS.merge_results = JSPLib.utility.arrayDifference(NPISAS.merge_results, [artwork_id]);
    let artwork = GetSessionArtwork(artwork_id);
    InitializePostIDsLink(artwork, $replace, preview, image_url);
}

////Secondary menu

function ShowPreviews(event) {
    let {artwork_id, image_url} = GetEventPreload(event, 'npisas-show-previews');
    if (!NPISAS.preview_dialog[artwork_id]) {
        InitializeUIStyle();
        GetIllustUrls(artwork_id, image_url).then((page_data) => {
            JSPLib.debug.debuglog("ShowPreviews", page_data);
            let $dialog = $('<div class="npisas-previews-dialog"></div>');
            let $previews = $(RenderIllustPreviews(page_data));
            BuildPreviewDialog(page_data, $previews);
            $dialog.append($previews);
            $dialog.dialog(PREVIEW_DIALOG_SETTINGS);
            $dialog.dialog('open');
            NPISAS.preview_dialog[artwork_id] = $dialog;
        });
    } else {
        NPISAS.preview_dialog[artwork_id].dialog('open');
    }
}

function ReloadPreviews(event) {
    let $container = $(event.currentTarget).closest('.npisas-dialog').find('.npisas-illust-previews');
    let artwork_id = $container.data('artwork-id');
    GetIllustUrls(artwork_id, null, true).then((page_data) => {
        $container.children().remove();
        JSPLib.debug.debuglog("ReloadPreviews", page_data);
        let $previews = $(RenderIllustPreviews(page_data));
        BuildPreviewDialog(page_data, $previews);
        $container.append($previews);
    });
}

function PopupMediaArtworkImage(event) {
    let $container = $(event.currentTarget);
    let {original, regular} = $container.data();
    let html = `
        <div class="npisas-preview-popup">
            <a href="${original}" onclick="return false"><img src="${regular}"></a>
        </div>`;
    let $popup = $(html);
    $popup.appendTo(document.body);
    $popup.on('mouseleave.npisas', () => {
        $popup.remove();
    });
}

function LoadPreviewImages(event) {
    let rows = Math.round(event.currentTarget.scrollTop / 360) + 3;
    let load_images = rows * 2;
    let $images = $('img', event.currentTarget);
    $images.each((i, image) => {
        let small_url = $(image).closest('.npisas-preview-container').data('small');
        if (i < load_images && !image.src) {
            $(image).attr('src', small_url);
        }
    });
    if (load_images >= $images.length) {
        $(event.currentTarget).closest('.npisas-dialog').find('.npisas-preview-section').off('scroll.npisas');
    }
}

function ShowInfo(event) {
    let {artwork_id} = GetEventPreload(event, 'npisas-show-info');
    if (!NPISAS.info_dialog[artwork_id]) {
        InitializeUIStyle();
        GetIllustInfo(artwork_id).then((illust_data) => {
            JSPLib.debug.debuglog("ShowInfo", illust_data);
            let $dialog = $('<div class="npisas-info-dialog"></div>');
            $dialog.append(RenderIllustInfo(illust_data));
            $dialog.dialog(INFO_DIALOG_SETTINGS);
            $dialog.dialog('open');
            NPISAS.info_dialog[artwork_id] = $dialog;
        });
    } else {
        NPISAS.info_dialog[artwork_id].dialog('open');
    }
}

function ReloadInfo(event) {
    let $container = $(event.currentTarget).closest('.npisas-dialog').find('.npisas-illust-info');
    let artwork_id = $container.data('artwork-id');
    GetIllustInfo(artwork_id, true).then((illust_data) => {
        JSPLib.debug.debuglog("ReloadInfo", illust_data);
        $container.html(RenderIllustInfo(illust_data));
    });
}

////Main artwork

function AdjustArtworkControls() {
    if (NPISAS.page === 'artworks') {
        let $controls_container = $('.npisas-fullsize-controls');
        if ($controls_container.length) {
            let $controls = $('.pixiv-artwork-controls');
            let is_viewable = JSPLib.utility.isScrolledIntoView($controls_container.get(0));//, 0.10);
            NPISAS.artwork_controls_translate = (NPISAS.artwork_controls_translate === undefined ? !is_viewable : NPISAS.artwork_controls_translate);
            if (!NPISAS.artwork_controls_translate && is_viewable) {
                $controls.css('transform', 'translateY(-245%)');
                NPISAS.artwork_controls_translate = true;
            } else if (NPISAS.artwork_controls_translate && !is_viewable) {
                $controls.css('transform', 'translateY(0%)');
                NPISAS.artwork_controls_translate = false;
            }
        }
    }
}

////Other

function HelpInfo(event) {
    let help_text = $(event.target).attr('title');
    alert(help_text);
}

////Event helpers

function GetEventPreload(event, classname) {
    let $link = $(event.target);
    let $artwork = $link.closest('[npisas-artwork]');
    let {artwork_id, user_id, artwork_type, preview, image_url, image_count} = GetArtworkInfo($artwork);
    let $replace = $(`[data-artwork-id=${artwork_id}] .${classname}`);
    let replace_level = $replace.data('replace') || 1;
    $replace = $(JSPLib.utility.getNthParent($replace.get(0), replace_level));
    return {$link, $artwork, artwork_id, user_id, artwork_type, preview, image_url, $replace, image_count};
}

function PromptSavePostIDs(artwork_id, message, save_post_ids) {
    let artwork = GetSessionArtwork(artwork_id);
    save_post_ids = JSPLib.utility.arrayDifference(save_post_ids, artwork.danbooru_ids);
    let prompt_string = prompt(message, save_post_ids.join(', '));
    if (prompt_string !== null) {
        let confirm_post_ids = JSPLib.utility.arrayUnique(
            prompt_string.split(',')
                .map(Number)
                .filter((num) => JSPLib.validate.validateID(num))
        );
        JSPLib.debug.debuglog("Confirmed IDs:", confirm_post_ids);
        artwork = UpdateArtworkLocalIDs(artwork_id, confirm_post_ids);
        UpdatePostIDsLink(artwork);
    }
}

function UpdateArtworkLocalIDs(artwork_id, save_ids) {
    let save_data = GetSessionArtworkData(artwork_id);
    if (NPISAS.merge_results.includes(artwork_id)) {
        save_data.value.local = JSPLib.utility.arrayUnion(save_data.value.local, save_ids);
    } else {
        save_data.value.local = save_ids;
    }
    if (save_data.value.local.length) {
        save_data.value.expires ??= save_data.expires;
        save_data.expires = 0;
    } else {
        save_data.expires ||= save_data.value.danbooru.length ? FOUND_ARTWORK_EXPIRES : MISSING_ARTWORK_EXPIRES;
        save_data.value.expires = null;
    }
    SaveData('artwork-' + artwork_id, save_data, 'pixiv');
    NPISAS.merge_results = JSPLib.utility.arrayDifference(NPISAS.merge_results, [artwork_id]);
    return new Artwork(save_data.value);
}

//Main execution functions

function RegularCheck() {
    //Get current page and previous page info
    NPISAS.prev_pagetype = NPISAS.page;
    let pagetype = GetPageType();
    if (pagetype === "other") {
        return;
    }
    //Process events on a page change
    PageNavigation(pagetype);
    if (NPISAS.page === 'artworks' && NPISAS.multi_artwork) {
        CheckExpandedImages();
    }
    ProcessArtworkImages();
    //Process events on newly rendered posts that should only be done once
    if (!ProcessNewArtworks()) {
        //Only process further if there are new posts
        return;
    }
    //There will be more stuff here
}

function ProcessArtworkImages() {
    let $unprocessed_images = $('.npisas-image:not([npisas-image]):not(.npisas-unhandled-image) img');
    if ($unprocessed_images.length) {
        JSPLib.debug.debuglog("Images found:", $unprocessed_images.length);
    }
    let artwork_ids = [];
    $unprocessed_images.each((_, image) => {
        let image_info = GetImageURLInfo(image.src);
        let $image = $(image);
        let $container = $image.closest('.npisas-image');
        let $artwork = $container.closest('[npisas-artwork]');
        let artwork_id = $artwork.data('artwork-id');
        if (image_info) {
            let dom_attributes = Object.assign(
                {'npisas-image': ""},
                ...Object.entries(image_info)
                    .map(([key, value]) => ({['data-' + key]: value})),
            );
            $container.attr(dom_attributes);
            NPISAS.artwork_image_info[artwork_id] = image_info;
            artwork_ids.push(artwork_id);
        } else {
            $container.addClass('npisas-unhandled-image');
            if (JSPLib.validate.isBoolean(image_info)) {
                JSPLib.notice.debugNoticeLevel("New unhandled image found (see debug console)", JSPLib.debug.INFO);
                JSPLib.debug.debugwarn("Unhandled image", image.src, artwork_id);
            }
        }
    });
    if (artwork_ids.length > 0) {
        JSPLib.debug.debuglog("Artworks updated:", artwork_ids);
        if (NPISAS.check_for_ai) {
            CheckIllustsForAI(artwork_ids).then((ai_info) => {
                for (let artwork_id in ai_info) {
                    let $artwork = $(`.npisas-artwork[data-artwork-id="${artwork_id}"]`);
                    $artwork.attr('data-ai', ai_info[artwork_id]?.is_ai);
                }
            });
        }
    }
}

function ProcessNewArtworks() {
    let page_attr = PAGE_ATTRIBUTES[NPISAS.page];
    if (page_attr === undefined) {
        return false;
    }
    let $landmarks = $(page_attr.selector);
    if ($landmarks.length === 0) {
        return false;
    }
    NPISAS.uniqueid = JSPLib.utility.getUniqueID();
    let $image_containers = $landmarks.map((_, entry) => JSPLib.utility.getNthParent(entry, page_attr.imageparent))
        .filter((_, entry) => !entry.classList.contains('npisas-image'));
    $image_containers.each((_, image) => {MarkupImageArtwork(image);});
    let $artwork_containers = $landmarks.map((_, entry) => JSPLib.utility.getNthParent(entry, page_attr.artworkparent))
        .filter((_, entry) => !entry.classList.contains('npisas-artwork'));
    $artwork_containers.each((_, entry) => {
        $(entry).addClass('npisas-artwork').attr('viewed', 'false');
        if (NPISAS.page === 'artworks' && $('[href*="img-original"]', entry).length) {
            MarkupMainArtwork(entry);
            InitializeMainArtwork(entry);
            return false;
        }
        MarkupPreviewArtwork(entry);
        InitializePreviewArtwork(entry);
    });
    //Initialize tweets with images
    if ($artwork_containers.length) {
        JSPLib.debug.debuglog(`[${NPISAS.uniqueid}]`, "New:", $image_containers.length);
    }
    return true;
}

//Settings functions

function BroadcastPISAS(ev) {
    JSPLib.debug.debuglog(`(${ev.data.type}):`, ev.data);
}

function IsQuerySettingEnabled(setting, type) {
    let type_key = (type === 'iqdb' ? 'IQDB' : type) + '_settings';
    return NPISAS.user_settings[type_key].includes(setting);
}

function OpenSettingsMenu() {
    if (!NPISAS.opened_menu) {
        if ($('#new-pixiv-image-searches-and-stuff').length === 0) {
            BuildSettingsMenu();
        }
        $('#new-pixiv-image-searches-and-stuff').dialog('open');
    }
}

function CloseSettingsMenu() {
    if (NPISAS.opened_menu) {
        GetMenuCloseButton().click();
    }
}

function SaveSettingsMenu() {
    if (NPISAS.opened_menu) {
        $('#npisas-commit').click();
    }
}

function ResetSettingsMenu() {
    if (NPISAS.opened_menu) {
        $('#npisas-resetall').click();
    }
}

function GetMenuCloseButton() {
    return $('#new-pixiv-image-searches-and-stuff').closest('.npisas-dialog').find('.npisas-dialog-close');
}

//Only render the settings menu on demand
function BuildSettingsMenu() {
    //Create the dialog
    $('body').append(SETTINGS_MENU);
    $('#new-pixiv-image-searches-and-stuff').dialog(MENU_DIALOG_SETTINGS);
    $('.npisas-dialog .ui-dialog-buttonset .ui-button').each((_, entry) => {
        let key = entry.innerText;
        for (let attribute in MENU_DIALOG_BUTTONS[key]) {
            $(entry).attr(attribute, MENU_DIALOG_BUTTONS[key][attribute]);
        }
    });
    GetMenuCloseButton().attr('title', CLOSE_HELP);
    //Standard menu creation
    $('#new-pixiv-image-searches-and-stuff').append(NTISAS_MENU);
    $('#npisas-display-settings').append(JSPLib.menu.renderCheckbox('display_available_sauce'));
    $('#npisas-display-settings').append(JSPLib.menu.renderCheckbox('display_network_errors'));
    $('#npisas-function-settings').append(JSPLib.menu.renderCheckbox('check_for_ai'));
    $('#npisas-query-settings').append(JSPLib.menu.renderInputSelectors('IQDB_settings', 'checkbox'));
    $('#npisas-query-settings').append(JSPLib.menu.renderInputSelectors('sauce_settings', 'checkbox'));
    $('#npisas-query-settings').append(JSPLib.menu.renderTextinput('similarity_cutoff', 10));
    $('#npisas-query-settings').append(JSPLib.menu.renderTextinput('results_returned', 10));
    $('#npisas-query-settings').append(JSPLib.menu.renderTextinput('SauceNAO_API_key', 80));
    $('#npisas-network-settings').append(JSPLib.menu.renderCheckbox('custom_order_enabled'));
    $('#npisas-network-settings').append(JSPLib.menu.renderInputSelectors('query_subdomain', 'radio'));
    //Engage jQuery UI
    JSPLib.menu.engageUI(true);
    $('#npisas-settings').tabs();
    //Set event handlers
    JSPLib.menu.saveUserSettingsClick();
    JSPLib.menu.resetUserSettingsClick(LOCALSTORAGE_KEYS);
    //Add CSS stylings
    JSPLib.utility.setCSSStyle(JSPLib.menu.settings_css, 'menu_settings');
    JSPLib.utility.setCSSStyle(MENU_CSS, 'menu');
    InitializeUIStyle();
}

function InitializeProgram() {
    NPISAS.domain = 'https://' + NPISAS.query_subdomain + '.donmai.us';
    JSPLib.saucenao.api_key = NPISAS.SauceNAO_API_key;
}

function CleanupTasks() {
    JSPLib.storage.pruneProgramCache(PROGRAM_SHORTCUT, PROGRAM_DATA_REGEX, PRUNE_RECHECK_EXPIRES);
    JSPLib.storage.pruneProgramCache(PROGRAM_SHORTCUT + '-pixiv', PIXIV_DATA_REGEX, PRUNE_RECHECK_EXPIRES, {database: JSPLib.storage.pixivstorage});
}

//Main function

function Main() {
    const preload = {
        default_data: PROGRAM_DEFAULT_VALUES,
        reset_data: PROGRAM_RESET_KEYS,
        initialize_func: InitializeProgram,
        broadcast_func: BroadcastPISAS,
        program_css: PROGRAM_CSS,
    };
    JSPLib.menu.preloadProgram(NPISAS, preload);
    JSPLib.network.jQuerySetup();
    JSPLib.notice.installBanner(PROGRAM_SHORTCUT);
    $(document).on(PROGRAM_CLICK, '.npisas-preview-header a', ToggleSideMenu);
    $(document).on(PROGRAM_CLICK, '.npisas-manual-add', ManualAdd);
    $(document).on(PROGRAM_CLICK, '.npisas-check-url', CheckURL);
    $(document).on(PROGRAM_CLICK, '.npisas-check-iqdb', CheckIQDB);
    $(document).on(PROGRAM_CLICK, '.npisas-check-sauce', CheckSauce);
    $(document).on(PROGRAM_CLICK, '.npisas-confirm-save', ConfirmSave);
    $(document).on(PROGRAM_CLICK, '.npisas-confirm-delete', ConfirmDelete);
    $(document).on(PROGRAM_CLICK, '.npisas-reset-results', ResetResults);
    $(document).on(PROGRAM_CLICK, '.npisas-merge-results', MergeResults);
    $(document).on(PROGRAM_CLICK, '.npisas-cancel-merge', CancelMerge);
    $(document).on(PROGRAM_CLICK, '.npisas-show-previews', ShowPreviews);
    $(document).on(PROGRAM_CLICK, '.npisas-show-info', ShowInfo);
    $(document).on(PROGRAM_CLICK, '.npisas-help-info', HelpInfo);
    $(document).on(PROGRAM_KEYDOWN, null, 'alt+m', OpenSettingsMenu);
    $(document).on(PROGRAM_KEYDOWN, null, 'alt+c', CloseSettingsMenu);
    $(document).on(PROGRAM_KEYDOWN, null, 'alt+s', SaveSettingsMenu);
    $(document).on(PROGRAM_KEYDOWN, null, 'alt+r', ResetSettingsMenu);
    setInterval(IntervalStorageHandler, 500);
    setInterval(IntervalNetworkHandler, 500);
    JSPLib.utility.setCSSStyle(PROGRAM_CSS, 'program');
    JSPLib.utility.initializeInterval(RegularCheck, PROGRAM_RECHECK_INTERVAL);
    JSPLib.load.noncriticalTasks(CleanupTasks);
}

/****Initialization****/

//Variables for debug.js
JSPLib.debug.debug_console = true;
JSPLib.debug.level = JSPLib.debug.INFO;
JSPLib.debug.program_shortcut = PROGRAM_SHORTCUT;

//Variables for menu.js
JSPLib.menu.program_shortcut = PROGRAM_SHORTCUT;
JSPLib.menu.program_name = PROGRAM_NAME;
JSPLib.menu.program_data = NPISAS;
JSPLib.menu.program_reset_data = PROGRAM_RESET_KEYS;
JSPLib.menu.program_data_regex = PROGRAM_DATA_REGEX;
JSPLib.menu.settings_callback = null;
JSPLib.menu.settings_config = SETTINGS_CONFIG;
JSPLib.menu.control_config = {};

//Variables for storage.js
JSPLib.storage.indexedDBValidator = ValidateEntry;
JSPLib.storage.prune_limit = 2000;

//variables for network.js
JSPLib.network.error_domname = '#npisas-error-messages';
JSPLib.network.rate_limit_wait = JSPLib.utility.one_second;

//Variables for danbooru.js
JSPLib.danbooru.max_network_requests = 10;

//Variables for notice.js
JSPLib.notice.program_shortcut = PROGRAM_SHORTCUT;

//Export JSPLib
JSPLib.load.exportData(PROGRAM_NAME, NPISAS, {other_data: {jQuery, validate, SAVED_STORAGE_REQUESTS, SAVED_NETWORK_REQUESTS, HANDLED_IMAGES, PAGE_REGEXES}});
JSPLib.load.exportFuncs(PROGRAM_NAME, {debuglist: [GetPosts, GetItems, GetArtwork, GetIllustUrls, GetImageURLInfo, GetPageType, CheckIllustsForAI, ValidatePixivData]});

/****Execution start****/

JSPLib.load.programInitialize(Main, {program_name: PROGRAM_NAME, required_variables: PROGRAM_LOAD_REQUIRED_VARIABLES, required_selectors: PROGRAM_LOAD_REQUIRED_SELECTORS, max_retries: 100, timer_interval: 500});
