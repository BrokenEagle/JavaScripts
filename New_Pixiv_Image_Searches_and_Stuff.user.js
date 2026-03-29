// ==UserScript==
// @name         New Pixiv Image Searches and Stuff (library)
// @version      2.P
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
// @require      https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20260225/lib/module.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20260225/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20260225/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20260225/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20260225/lib/notice.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20260225/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20260225/lib/template.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20260225/lib/concurrency.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20260225/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20260225/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20260225/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20260225/lib/saucenao.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20260225/lib/menu.js
// @resource     jquery_ui_css https://raw.githubusercontent.com/BrokenEagle/JavaScripts/custom-20190305/custom/jquery_ui_custom.css
// @grant        GM.xmlHttpRequest
// @grant        GM_getResourceText
// @connect      donmai.us
// @connect      saucenao.com
// @connect      pximg.net
// @run-at       document-body
// @noframes
// ==/UserScript==

// eslint-disable-next-line no-redeclare
/* global $ jQuery JSPLib validate localforage GM_getResourceText saveAs */

(({Debug, Notice, Utility, Storage, Validate, Template, Concurrency, Network, Danbooru, Saucenao, Load, Menu}) => {

const PROGRAM_FULL_NAME = "New Pixiv Image Searches and Stuff";
const PROGRAM_SHORT_NAME = "New PISAS";
const PROGRAM_NAME = 'NPISAS';
const PROGRAM_SHORTCUT = 'npisas';
const DANBOORU_TOPIC_ID = null;
const GITHUB_WIKI_PAGE = 'https://github.com/BrokenEagle/JavaScripts/wiki/New-Pixiv-Image-Searches-and-Stuff';

/****Library updates****/

Utility.setHasDifference = function (set1, set2) {
    return Utility.setSome(set1, (val) => !set2.has(val));
};

Utility.arrayHasDifference = function (array1, array2) {
    //_makeSets
    let set1 = new Set(array1);
    let set2 = new Set(array2);
    return Utility.setHasDifference(set1, set2);
};

Utility.nullIfEmpty = function (string) {
    return typeof string === 'string' && string.length > 0 ? string : null;
};

Template.renderTheme = function(css_text, outerselector) {
    let lines = css_text.trim().split('\n');
    var theme_css;
    if ('CSSNestedDeclarations' in JSPLib._window) {
        let theme_lines = lines.map((line) => '    ' + line);
        theme_css = `${outerselector} {\n${theme_lines.join('\n')}\n}`;
    } else {
        let theme_lines = [];
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if (/^[ \/}]|^\s*$/.test(line)) {
                theme_lines.push(line);
            } else {
                theme_lines.push(`${outerselector} ${line}`);
            }
        }
        theme_css = theme_lines.join('\n');
    }
    return '\n' + theme_css + '\n';
};

Validate.nullable_nonnegative_integer_constraints = {
    integer: {
        greaterThanOrEqual: 0,
        allowNull: true,
    },
};

/****Global variables****/

//Module constants

var NPISAS = {};

const PROGRAM_DEFAULT_VALUES = {
    opened_menu: false,
    artwork_data: {},
    post_data: {},
    user_data: {},
    artwork_image_info: {},
    no_url_results: [],
    merge_results: [],
    similar_results: {},
    info_dialog: {},
    previews_dialog: {},
    image_search: {},
    multi_expanded: false,
    search_running: new Set(),
    recorded_views: new Set(),
    skipped_views: new Set(),
    storage_data: {danbooru: {}, pixiv: {}},
};

const PROGRAM_RESET_KEYS = {};

const STORAGE_RESET_KEYS = [];

const PROGRAM_DATA_REGEX = /^(?:post|user|view|danbooru|local|page|info|illust|tag|image-size)-/;

const LOAD_REQUIRED_SELECTORS = ['#__next'];

Storage.pixivstorage = localforage.createInstance({
    name: 'Pixiv storage',
    driver: [localforage.INDEXEDDB]
});

//Settings constants

const COMMON_QUERY_SETTINGS = ['auto_save'];
const DEFAULT_QUERY_SETTINGS = [];

const SETTINGS_CONFIG = {
    IQDB_settings: {
        allitems: COMMON_QUERY_SETTINGS,
        reset: DEFAULT_QUERY_SETTINGS,
        validate: (data) => Menu.validateCheckboxRadio(data, 'checkbox', COMMON_QUERY_SETTINGS),
        hint: "Check/uncheck to turn on/off setting."
    },
    similarity_cutoff: {
        reset: 80.0,
        parse: parseFloat,
        validate: (data) => Menu.validateNumber(data, {integer: false, minimum: 0, maximum: 100}),
        hint: "Minimum similiarity score of an image match to return. Valid values: 0 - 100."
    },
    results_returned: {
        reset: 5,
        parse: parseInt,
        validate: (data) => Menu.validateNumber(data, {integer: true, minimum: 1, maximum: 20}),
        hint: "Maximum number of results to return per image. Valid values: 1 - 20."
    },
    custom_order_enabled: {
        reset: false,
        validate: Utility.isBoolean,
        hint: "Multi-post results will use <span class=\"npisas-code\">order:custom</span>, showing results with Twitter's order. <b>Note:</b> This will break the tag limit for non-Gold+."
    },
    query_subdomain: {
        allitems: JSPLib.domains,
        reset: ['danbooru'],
        validate: (data) => Menu.validateCheckboxRadio(data, 'radio', JSPLib.domains),
        hint: "Select which subdomain of Danbooru to query from. <b>Note:</b> The chosen subdomain must be logged into or the script will fail to work."
    },
    display_network_errors: {
        reset: false,
        validate: Utility.isBoolean,
        hint: "Displays network error count and controls in the side menu."
    },
    display_ai_status: {
        display: "Display AI status",
        reset: true,
        validate: Utility.isBoolean,
        hint: "Adds indicators for artworks marked as AI or with AI tags."
    },
    display_artwork_views: {
        reset: true,
        validate: Utility.isBoolean,
        hint: "Displays the the number of times an artwork has been seen."
    },
    image_indicators_toggle: {
        reset: true,
        validate: Utility.isBoolean,
        hint: "Adds control to the side menu to show/hide image indicators."
    },
    artwork_statistics: {
        reset: true,
        validate: Utility.isBoolean,
        hint: "Adds a statistics panel to the side menu."
    },
    artwork_tags: {
        reset: true,
        validate: Utility.isBoolean,
        hint: "Adds a tags panel to the side menu."
    },
    advanced_tooltips: {
        reset: true,
        validate: Utility.isBoolean,
        hint: "Not implemented yet."
    },
};

//CSS constants

const FONT_FAMILY = '\'Segoe UI\', Arial, sans-serif';

const PROGRAM_CSS = Template.normalizeCSS()`
/**GENERAL**/
.npisas-flex-center {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
}
.npisas-horizontal-rule {
    border-top: 1px solid;
    margin: 10px;
}
.npisas-expanded-link {
   display: inline-block;
   position: relative;
   z-index: 1;
   padding: 8px;
   margin: -8px;
}
.npisas-link,
.npisas-links a {
    cursor: pointer;
    text-decoration: none;
    &:hover {
        text-decoration: underline;
    }
}
.npisas-button {
    cursor: pointer;
}
.npisas-control-button {
    user-select: none;
}
/**SIDE MENU**/
#npisas-side-menu {
    position: fixed;
    top: 1.5em;
    left: 1.5em;
    width: 300px;
    height: auto;
    font-size: 14px;
    font-family: ${FONT_FAMILY};
    z-index: 100;
    border: 1px solid;
}
#npisas-menu-header {
    padding: 2px;
    font-size: 18px;
    font-weight: bold;
    letter-spacing: -1px;
    text-align: center;
    cursor: move;
    border-bottom: solid 1px;
}
#npisas-menu-selection {
    user-select: none;
    font-weight: bold;
    margin: 0 1em;
    padding: 0.1em;
    a {
        padding: 5px;
    }
}
#npisas-menu-info,
#npisas-menu-controls {
    margin-left: 5px;
    font-weight: bold;
    line-height: 18px;
    td {
        padding: 0 2px;
        &:nth-of-type(1) {
            width: 140px;
        }
        &:nth-of-type(2) {
            width: 100px;
        }
    }
}
#npisas-open-settings {
    margin: 0.5em;
    input {
        font-weight: bold;
        width: 100%;
        cursor: pointer;
    }
}
#npisas-artwork-stats-table {
    &:has(table) {
        padding: 0.5em;
    }
    table {
        width: 100%;
        text-align: center;
    }
    tr:nth-of-type(odd) th {
        padding: 5px 0;
    }
    tr:first-of-type th {
        padding: 0 0 5px;
    }
    td {
        border: 1px solid;
    }
}
#npisas-artwork-tags-list ul {
    list-style: none;
    padding: 0;
    margin: 0.5em;
}
div.npisas-menu-unavailable {
    font-size: 16px;
    font-weight: bold;
    padding: 0.5em 1em;
}
/**ARTWORK**/
.npisas-debug-marker,
.npisas-ai-marker,
.npisas-viewed-marker,
.npisas-pixiv-markers,
.npisas-like-button {
    display: none;
}
.npisas-show-indicators {
    .npisas-pixiv-markers {
        display: flex;
    }
    .npisas-like-button {
        display: block;
    }
    .npisas-artwork[data-ai="false"] .npisas-ai-marker {
        display: none;
    }
    .npisas-artwork[data-ai="true"] .npisas-ai-marker {
       display: initial;
    }
    .npisas-artwork[data-viewed="false"] .npisas-viewed-marker {
        display: none;
    }
    .npisas-artwork[data-viewed="true"] .npisas-viewed-marker {
       display: initial;
    }
    .npisas-artwork[viewed="false"] .npisas-debug-marker {
        display: none;
    }
    .npisas-artwork[viewed="true"] .npisas-debug-marker {
       display: initial;
    }
}
/**ARTWORK MENU**/
div.npisas-artwork-header > div {
    cursor: pointer;
}
/**MAIN MENU**/
div.npisas-main-menu {
    width: 18em;
    border: 1px solid;
    border-radius: 5px;
    font-size: 16px;
    font-weight: bold;
    div.npisas-toggle-menu {
        width: 85%;
        border-radius: 4px 0 0 0;
    }
    div.npisas-menu-help {
        width: auto;
        min-width: 15%;
        border-radius: 0 4px 0 0;
    }
    div.npisas-control-upload {
        border-radius: 0 0 0 4px;
    }
    div.npisas-control-download {
        border-radius: 0 0 4px 0;
    }
    & > div:not(:first-of-type) {
        border-top: 1px solid;
        height: 2em;
        & > div:first-of-type {
            width: 50%;
        }
        & > div:last-of-type {
            width: auto;
            min-width: 50%;
        }
    }
    & > div > div:first-of-type {
        border-right: 1px solid;
    }
}
/**MINI MENU**/
div.npisas-mini-menu {
    margin: 5px -5px;
    font-weight: bold;
    border: 1px solid;
    border-radius: 5px;
    div.npisas-preview-header {
        border-bottom: 1px solid;
        & > div:not(:last-of-type) {
            border-right: 1px solid;
        }
    }
    div.npisas-toggle-menu {
        width: 50%;
        border-radius: 4px 0 0 0;
    }
    div.npisas-show-info {
        width: 40%;
    }
    div.npisas-menu-help {
        width: auto;
        min-width: 10%;
        border-radius: 0 4px 0 0;
    }
    div.npisas-local-results {
        border-radius: 0 0 0 4px;
    }
    div.npisas-control-download {
        border-radius: 0 0 4px 0;
    }
}
div.npisas-artwork-controls {
    display: flex;
    & > div {
        flex-direction: column;
        height: initial;
        &:not(:last-of-type) {
            border-right: 1px solid;
        }
        & > div {
            min-height: 1.5em;
            &:not(.npisas-control-search):first-of-type {
                border-bottom: 1px solid;
            }
        }
    }
    div.npisas-results-column {
        width: 50%;
    }
    div.npisas-search-column {
        width: 20%;
    }
    div.npisas-transfer-column {
        width: auto;
        min-width: 30%;
    }
}
/**DIALOGS**/
div.npisas-dialog {
    a:focus-visible,
    button:focus-visible {
        outline: none;
    }
}
div.npisas-queried {
    font-size: 0.8em;
}
/**PREVIEWS DIALOG**/
div.npisas-preview-selectors {
    font-family: monospace;
    font-size: 16px;
    margin-bottom: 1em;
    user-select: none;
}
a.npisas-preview-selector.npisas-selector-active {
    font-weight: bold;
}
div.npisas-preview-section {
    display: flex;
    flex-wrap: wrap;
    overflow-y: auto;
    max-height: 65vh;
    overscroll-behavior: contain;
    margin-bottom: 1em;
}
div.npisas-preview-container {
    padding: 5px;
    width: 300px;
    text-align: center;
    margin-bottom: 2em;
}
div.npisas-preview-image {
    height: 300px;
    width: 300px;
}
div.npisas-preview-info {
    font-size: 1.4em;
    font-weight: bold;
    font-family: monospace;
    padding: 0.25em 0;
    span.npisas-image-size.npisas-load-size::before {
        content: "(";
    }
    span.npisas-image-size.npisas-load-size::after {
        content: ")";
    }
}
div.npisas-preview-addons {
    height: 2em;
}
div.npisas-preview-source,
div.npisas-preview-unified {
    font-size: 16px;
    font-weight: bold;
}
div.npisas-preview-unified {
    font-family: monospace;
}
div.npisas-preview-search div.npisas-image-search-menu {
    span.npisas-local-results {
        border-radius: 25px 0 0 25px;
        width: 70%;
    }
    span.npisas-control-search {
        border-radius: 0 25px 25px 0;
        border-left: 1px solid;
        width: auto;
        min-width: 30%;
    }
}
div.npisas-image-search-menu,
div.npisas-image-upload-menu,
div.npisas-image-download-menu {
    flex-wrap: nowrap;
    font-size: 16px;
    font-weight: bold;
    line-height: 100%;
    border: 1px solid;
    height: 1.65em;
    border-radius: 25px;
    width: 80%;
    cursor: pointer;
}
div.npisas-preview-popup {
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
div.npisas-info-title {
    font-size: 24px;
    font-weight: bold;
    border-bottom: solid 2px;
    margin-bottom: 0.5em;
    width: fit-content;
}
div.npisas-info-description {
    font-size: 14px;
    overflow-y: auto;
    max-height: 250px;
    overscroll-behavior: contain;
}
div.npisas-info-details {
    border: 1px solid;
    padding: 0.5em 0 0.5em 2em;
    ul {
        padding-left: 1em;
    }
}
/**LOADING**/
div.npisas-dialog-loading {
    height: 65vh;
}
div.npisas-menu-loading {
    height: 10em;
}
div.npisas-loading > span {
    font-size: 32px;
    font-weight: bold;
}
/**MARKERS**/
div.npisas-marker {
    line-height: 100%;
    padding: 4px;
    border: 1px solid;
    border-radius: 10px;
    font-weight: bold;
    position: absolute;
    &.npisas-viewed-marker {
        &.npisas-illust-marker {
            top: 0;
            left: 0;
        }
        &.npisas-preview-marker {
            bottom: 0;
            left: 0;
        }
    }
    &.npisas-ai-marker {
        &.npisas-illust-marker {
            top: 30px;
            left: 0;
        }
        &.npisas-preview-marker {
            bottom: 25px;
            left: 0;
        }
    }
    &.npisas-debug-marker {
        bottom: 50px;
        left: 0;
    }
    &.npisas-illust-marker {
        font-size: 16px;
    }
    &.npisas-preview-marker {
        font-size: 12px;
    }
}
/**REACTIVE**/
@media (min-width: 1366px) {
    aside.npisas-related-works {
        margin-left: -240px;
    }
}`

const LIGHT_CSS = Template.normalizeCSS()`
/**GENERAL**/
.npisas-button {
    color: black;
    background-color: #FFF;
    &.npisas-active,
    &.npisas-active:hover {
        background-color: #48F;
        a {
            color: white;
        }
    }
    &:hover {
        background-color: #f0f0f0;
    }
}
.npisas-on {
    color: green !important;
}
.npisas-off {
    color: red !important;
}
.npisas-default {
    color: blue !important;
}
.npisas-links a.npisas-link {
    color: blue !important
}
li.npisas-translated a.npisas-link {
    color: green !important;
}
.npisas-horizontal-rule {
    border-top-color: grey;
}
.npisas-database-no-match {
    &, &:hover {
        color: red !important;
    }
}
.npisas-database-match {
    &, &:hover {
        color: green !important;
    }
}
.npisas-database-mismatch {
    &, &:hover {
        color: purple !important;
    }
}
/**SIDE MENU**/
#npisas-side-menu {
    background-color: white;
    border-color: #888;
}
#npisas-menu-header {
    color: black;
    border-color: #888;
    background-color: rgb(200, 240, 255);
}
#npisas-menu-selection {
    background-color: #EEE;
    a {
        color: #AAA;
        &.npisas-selected {
            color: rgb(29, 155, 240);
        }
    }
}
#npisas-artwork-stats-table td {
    color: grey;
    border-color: grey;
}
.npisas-help-info {
    &, &:hover {
        color: hotpink;
    }
}
/**ARTWORK MENU**/
div.npisas-toggle-menu {
    background-color: #000;
    color: white;
    &:hover {
        background-color: #555;
    }
}
div.npisas-menu-help {
    background-color: #f7b;
    color: white;
    &:hover {
        background-color: #f9d;
    }
}
div.npisas-control-download.npisas-download-set a {
    color: #0bf;
}
/**MAIN MENU**/
div.npisas-main-menu {
    border-color: #444;
    & > div:not(:first-of-type) {
        border-top-color: #AAA;
    }
    & > div > div:first-of-type {
        border-right-color: #AAA;
    }
}
/**MINI MENU**/
div.npisas-mini-menu {
    border-color: #444;
    div.npisas-preview-header {
        border-bottom-color: #AAA;
        & > div:not(:last-of-type) {
            border-right-color: #AAA;
        }
        a {
            color: white;
        }
    }
    div.npisas-show-info {
        background-color: #BBB;
        color: white;
        &:hover {
            background-color: #CCC;
        }
    }
}
div.npisas-artwork-controls {
    & > div:not(:last-of-type) {
        border-right-color: #AAA;
    }
    & > div > div:first-of-type {
        border-bottom-color: #AAA;
    }
}
/**DIALOGS**/
div.npisas-queried {
    color: #888;
}
/**PREVIEWS DIALOG**/
a.npisas-preview-selector {
    color: blue !important;
}
div.npisas-preview-info span.npisas-image-size.npisas-load-size {
    color: orange;
}
div.npisas-preview-search div.npisas-image-search-menu span.npisas-control-search {
    border-left-color: #AAA;
}
div.npisas-image-search-menu,
div.npisas-image-upload-menu,
div.npisas-image-download-menu {
    border-color: #AAA;
}
div.npisas-preview-popup {
    background-color: white;
}
/**INFO DIALOG**/
div.npisas-info-title {
    border-bottom-color: #AAA;
}
div.npisas-info-details {
    border-color: #111;
}
/**MARKERS**/
div.npisas-marker {
    border-color: black;
    &.npisas-viewed-marker {
        color: grey;
        background-color: white;
    }
    &.npisas-ai-marker {
        color: white;
        background-color: red;
    }
    &.npisas-debug-marker {
        background-color: green;
        color: white;
    }
}
/**SETTINGS**/
#new-pixiv-image-searches-and-stuff .jsplib-expandable {
    border: 1px solid #BBB;
}
#new-pixiv-image-searches-and-stuff .jsplib-expandable-content {
    border-top: 1px solid #DDD;
}`;

const DARK_CSS = Template.normalizeCSS()`
/**GENERAL**/
.npisas-button {
    color: white;
    background-color: #222;
    &.npisas-active,
    &.npisas-active:hover {
        background-color: #04F;
    }
    &:hover {
        background-color: #333;
    }
}
.npisas-default {
    color: #06f !important;
}
.npisas-on {
    color: green !important;
}
.npisas-off {
    color: red !important;
}
.npisas-links a.npisas-link {
    color: #06f !important
}
li.npisas-translated a.npisas-link {
    color: green !important;
}
.npisas-horizontal-rule {
    border-top-color: grey;
}
.npisas-database-no-match {
    &, &:hover {
        color: red !important;
    }
}
.npisas-database-match {
    &, &:hover {
        color: green !important;
    }
}
.npisas-database-mismatch {
    &, &:hover {
        color: purple !important;
    }
}
/**SIDE MENU**/
#npisas-side-menu {
    background-color: black;
    border-color: #CCC;
}
#npisas-menu-header {
    border-bottom-color: #CCC;
    background-color: rgb(0, 115, 200);
}
#npisas-menu-selection {
    background-color: #333;
    a {
        color: #CCC;
        &.npisas-selected {
            color: rgb(29, 155, 240);
        }
    }
}
#npisas-artwork-stats-table td {
    color: #CCC;
    border-color: #444;
}
.npisas-help-info {
    &, &:hover {
        color: hotpink;
    }
}
/**ARTWORK MENU**/
div.npisas-toggle-menu {
    background-color: #000;
    &:hover {
        background-color: #222;
    }
}
div.npisas-menu-help {
    background-color: #f7b;
    color: white;
    &:hover {
        background-color: #f9d;
    }
}
div.npisas-control-download.npisas-download-set a {
    color: #0bf;
}
/**MAIN MENU**/
div.npisas-main-menu {
    border-color: #CCC;
    & > div:not(:first-of-type) {
        border-top-color: #666;
    }
    & > div > div:first-of-type {
        border-right-color: #666;
    }
}
/**MINI MENU**/
div.npisas-mini-menu {
    border-color: #CCC;
    div.npisas-preview-header {
        border-bottom-color: #666;
        & > div:not(:last-of-type) {
            border-right-color: #666;
        }
        a {
            color: white;
        }
    }
    div.npisas-show-info {
        background-color: #777;
        &:hover {
            background-color: #888;
        }
    }
}
div.npisas-artwork-controls {
    & > div:not(:last-of-type) {
        border-right-color: #666;
    }
    & > div > div:first-of-type {
        border-bottom-color: #666;
    }
}
/**DIALOGS**/
div.npisas-queried {
    color: #888;
}
/**PREVIEWS DIALOG**/
a.npisas-preview-selector {
    color: #88F !important;
}
div.npisas-preview-info span.npisas-image-size.npisas-load-size {
    color: orange;
}
div.npisas-preview-search div.npisas-image-search-menu span.npisas-control-search {
    border-left-color: #666;
}
div.npisas-image-search-menu,
div.npisas-image-upload-menu,
div.npisas-image-download-menu {
    border-color: #666;
}
div.npisas-preview-popup {
    background-color: white;
}
/**INFO DIALOG**/
div.npisas-info-title {
    border-bottom-color: #666;
}
div.npisas-info-details {
    border-color: #CCC;
}
/**MARKERS**/
div.npisas-marker {
    border-color: black;
    &.npisas-viewed-marker {
        color: grey;
        background-color: white;
    }
    &.npisas-ai-marker {
        color: white;
        background-color: red;
    }
    &.npisas-debug-marker {
        background-color: green;
        color: white;
    }
}
/**SETTINGS MENU**/
#new-pixiv-image-searches-and-stuff #npisas-tabs li.ui-tabs-active.ui-state-active a {
    color: #FFF;
}
#new-pixiv-image-searches-and-stuff #npisas-settings label.ui-checkboxradio-label.ui-state-active {
    color: #FFF;
}
#new-pixiv-image-searches-and-stuff .jsplib-expandable {
    border: 1px solid #666;
}
#new-pixiv-image-searches-and-stuff .jsplib-expandable-content {
    border-top: 1px solid #444;
}`;

const JQUERY_DARK_CSS = Template.normalizeCSS()`
.ui-dialog.ui-dialog-pixiv.npisas-dialog {
    &, .ui-widget-content, .ui-state-default {
        color: #FFF;
        background: #222;
    }
    &, .ui-tabs, .ui-state-default {
        border: 1px solid #888;
    }
    .ui-tabs-nav, .ui-dialog-titlebar, .ui-dialog-buttonpane {
        border: 1px solid #333;
    }
    .ui-checkboxradio-radio-label.ui-state-active .ui-icon-background {
        border: 4px solid rgb(0, 0, 224);
    }
    .ui-widget-header {
        color: #FFF;
        background-color: rgba(0, 0, 255, 0.5);
    }
    .ui-button {
        color: #FFF;
        background-color: rgba(0, 0, 255, 0.2);
        border: 1px solid rgba(0, 0, 255, 0.5);
    }
    .ui-button:hover, .ui-tab:hover {
        background-color: rgba(0, 0, 255, 0.5);
        border: 1px solid rgb(0, 0, 255);
    }
    .ui-widget-content .ui-state-active, .ui-widget-content .ui-state-active:focus {
        color: #222;
        background-color: rgb(0, 0, 255);
        border: 1px solid rgb(0, 0, 224);
    }
    .ui-button:hover, .ui-widget-content .ui-state-active:active, .ui-widget-content .ui-state-active:focus {
        box-shadow: 0 0 0 2px #222, 0 0 0 4px rgb(0, 0, 255);
    }
    .ui-widget-content a {
        color: #FFF;
    }
}
.ui-widget-overlay {
    background: black;
    opacity: 0.5;
}`;

const MENU_CSS = Template.normalizeCSS()`
#new-pixiv-image-searches-and-stuff {
    z-index: 1001;
    font-size: 14px;
    p {
        margin-bottom: 1em;
    }
    h4 {
        font-size: 1.16667em;
        line-height: 1.5em;
        margin: 0;
    }
    .prose {
        h2 {
            font-size: 1.8em;
            padding: 0.25em;
            line-height: 1em;
            margin: 0;
        }
        h4 {
            font-size: 1.4em;
            padding: .8em 0 .25em;
            margin: 0;
        }
        a {
            font-weight:bold;
            text-decoration: none;
            cursor: pointer;
        }
    }
    .prose a:hover,
    .npisas-menu-tooltip a:hover,
    .npisas-linkclick a:hover {
        text-decoration: underline;
    }
    b {
        font-weight: bold;
    }
    #npisas-tabs a {
        color: unset;
    }
    ul:not(#npisas-tabs) {
        margin-left: 1em;
        padding-left: 0;
        li {
            list-style-type: disc;
            margin-left: 0.5em;
        }
    }
    .npisas-striped {
        border-collapse: collapse;
        border-spacing: 0;
        td, th {
            padding: 4px 6px;
        }
        thead th {
            font-weight: 700;
            text-align: left;
        }
    }
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
    & > div {
        overflow-y: auto;
        height: 460px;
        overscroll-behavior: contain;
    }
    .npisas-selectors label {
        width: 140px;
    }
    .npisas-selectors[data-setting="query_subdomain"] label {
        width: 100px;
    }
}
#npisas-script-message > div {
    display: inline-block;
}
#npisas-forum-message {
    padding: 0 1em;
}
#npisas-available-hotkeys {
    position: absolute;
    right: 2em;
    top: 0;
}
#npisas-available-hotkeys-title {
    font-size: 125%;
    padding-left: 0.5em;
    margin-bottom: -0.2em;
}
#npisas-settings-buttons input,
.npisas-textinput input {
    color: black;
    background-color: white;
}
/**MENU.JS**/
.jsplib-outer-menu {
    float: left;
    width: 50%;
    min-width: 50em;
}
.jsplib-settings-grouping {
    margin-bottom: 2em;
}
.jsplib-menu-item {
    margin: 0.5em;
    & > div {
        margin-left: 0.5em;
    }
}
.jsplib-inline-tooltip {
    display: inline;
    font-style: italic;
}
.jsplib-block-tooltip {
    display: block;
    font-style: italic;
}
.jsplib-textinput input[type="text"] {
    padding: 2px 8px;
    margin-right: 0.5em;
}
.jsplib-checkbox input {
    margin-right: 0.5em;
}
.jsplib-sortlist li {
    width: 8em;
    font-size: 125%;
    white-space: nowrap;
    & > div {
        padding: 5px;
    }
}
.jsplib-selectors {
    label {
        text-align: left;
        width: 100px;
        margin-right: 5px;
        margin-bottom: 5px;
    }
    .ui-checkboxradio-icon {
        margin-left: -5px;
    }
    .ui-checkboxradio-icon-space {
        margin-right: 5px;
    }
}
.jsplib-console {
    width: 100%;
    min-width: 100em;
    margin-top: 1em;
}
.jsplib-prose {
    line-height: 1.4em;
    word-break: break-word;
}
.jsplib-expandable-header {
    padding: .4em;
}
.jsplib-expandable-header span {
    margin-right: .5em;
    font-weight: 700;
}
.jsplib-expandable-content {
    display: none;
    padding: .4em;
}
.jsplib-striped {
    border-collapse: collapse;
    border-spacing: 0;
    thead {
        tr {
            border-bottom: 2px solid #666;
        }
        th {
            font-weight: 700;
            text-align: left;
        }
    }
    tbody {
        tr {
            border-bottom: 1px solid #CCC;
        }
        td {
            text-align: right;
        }
        th {
            text-align: left;
        }
    }
    td, th {
        padding: 4px 20px;
    }
}`;

//HTML constants

const HORIZONTAL_RULE = '<div class="npisas-horizontal-rule"></div>';

const SETTINGS_MENU = `<div id="new-pixiv-image-searches-and-stuff" title="${PROGRAM_NAME} Settings"></div>`;

const NPISAS_MENU = Template.normalizeHTML()`
<div id="npisas-script-message" class="prose">
    <h2>${PROGRAM_FULL_NAME}</h2>
    <div id="npisas-forum-message" class="npisas-links">
        <p>Check the forum for the latest on information and updates (<a id="npisas-forum-topic-link" class="npisas-link" target="_blank">topic #${DANBOORU_TOPIC_ID}</a>).</p>
        <p>Visit the wiki page for usage information (<a class="npisas-link" href="${GITHUB_WIKI_PAGE}" target="_blank">${GITHUB_WIKI_PAGE}</a>).</p>
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

const QUERY_SETTINGS_DETAILS = Template.normalizeHTML()`
<ul>
    <li><b>Auto save:</b> Automatically saves any matches from the results.</li>
</ul>`;

const SIDE_MENU = Template.normalizeHTML()`
<div id="npisas-side-menu" class="npisas-links" style="display: none;">
    <div id="npisas-menu-header">${PROGRAM_FULL_NAME}</div>
    <div id="npisas-menu-selection">
        <a data-selector="info">Info</a>
        <a data-selector="controls">Controls</a>
        <a data-selector="statistics" style="display: none;">Statistics</a>
        <a data-selector="tags" style="display: none;">Tags</a>
    </div>
    ${HORIZONTAL_RULE}
    <div id="npisas-content">
        <div id="npisas-menu-info" data-selector="info" style="display:none">
            <table>
                <tbody>
                <tr style="display: none;">
                    <td><span>Danbooru mode:</span></td>
                    <td><span id="npisas-danbooru-status" class="npisas-link">...</span></td>
                    <td>(%DANBOORUHELP%)</td>
                </tr>
                <tr>
                    <td><span>Page max:</span></td>
                    <td><span id="npisas-page-max">...</span></td>
                    <td>(%MAXIDHELP%)</td>
                </tr>
                <tr>
                    <td><span>Page min:</span></td>
                    <td><span id="npisas-page-min">...</span></td>
                    <td>(%MINIDHELP%)</td>
                </tr>
                <tr>
                    <td><span>Time range:</span></td>
                    <td><span id="npisas-time-range">...</span></td>
                    <td>(%TIMERANGEHELP%)</td>
                </tr>
                <tr>
                    <td><span>Local records:</span></td>
                    <td><span id="npisas-local-records" class="npisas-link npisas-default">...</span></td>
                    <td>(%RECORDSHELP%)</td>
                </tr>
                <tr data-setting="display_network_errors">
                    <td><span>Network errors:</span></td>
                    <td><span id="npisas-error-messages" class="npisas-link npisas-default">%ERRORMESSAGES%</span></td>
                    <td>(%ERRORMESSAGESHELP%)</td>
                </tr>
                </tbody>
            </table>
        </div>
        <div id="npisas-menu-controls" data-selector="controls" style="display:none">
            <table>
                <tbody>
                <tr>
                    <td><span>Confirm upload:</span></td>
                    <td>%CONFIRM_UPLOAD%</td>
                    <td>(%CONFIRM_UPLOAD_HELP%)</td>
                </tr>
                <tr>
                    <td><span>Confirm download:</span></td>
                    <td>%CONFIRM_DOWNLOAD%</td>
                    <td>(%CONFIRM_DOWNLOAD_HELP%)</td>
                </tr>
                <tr data-setting="image_indicators_toggle">
                    <td><span>Image indicators:</span></td>
                    <td>%IMAGE_INDICATORS%</td>
                    <td>(%IMAGE_INDICATORS_HELP%)</td>
                </tr>
                <tr data-setting="display_artwork_views">
                    <td><span>Count views:</span></td>
                    <td>%VIEW_COUNTS%</td>
                    <td>(%VIEW_COUNTS_HELP%)</td>
                </tr>
                </tbody>
            </table>
        </div>
        <div id="npisas-menu-statistics" data-selector="statistics" style="display:none">
            <div>
                <div id="npisas-artwork-statistics">
                    <div id="npisas-artwork-stats-table"></div>
                </div>
            </div>
        </div>
        <div id="npisas-menu-tags" data-selector="tags" style="display:none">
            <div>
                <div id="npisas-artwork-tags">
                    <div id="npisas-artwork-tags-list"></div>
                </div>
            </div>
        </div>
    </div>
    <div id="npisas-open-settings">
        <input type="button" title="%SETTINGSHELP%" value="Settings">
    </div>
</div>`;

const SIDE_MENU_STATISTICS = Template.normalizeHTML()`
<table>
    <tbody>
    <tr>
        <th data-key="total">Total</th>
        <th data-key="retweet">Single</th>
        <th data-key="tweet">Multi</th>
    </tr>
    <tr>
        <td data-key="total">%TOTALARTWORKS%</td>
        <td data-key="single">%SINGLEARTWORKS%</td>
        <td data-key="multi">%MULTIARTWORKS%</td>
    </tr>
   <tr>
        <th data-key="illust">Illust</th>
        <th data-key="manga">Manga</th>
        <th data-key="ugoira">Ugoira</th>
    </tr>
    <tr>
        <td data-key="image">%ILLUSTARTWORKS%</td>
        <td data-key="video">%MANGAARTWORKS%</td>
        <td data-key="text">%UGOIRAARTWORKS%</td>
    </tr>
    <tr>
        <th data-key="ai">AI</th>
        <th data-key="ero">Ero</th>
        <th data-key="guro">Guro</th>
    </tr>
    <tr>
        <td data-key="image">%AIARTWORKS%</td>
        <td data-key="video">%EROARTWORKS%</td>
        <td data-key="text">%GUROARTWORKS%</td>
    </tr>
    </tbody>
</table>`;

const NPISAS_MAIN_MENU = Template.normalizeHTML()`
<div class="npisas-main-menu npisas-artwork-menu">
    <div class="npisas-main-header npisas-artwork-header npisas-flex-center">
        <div class="npisas-toggle-menu npisas-flex-center npisas-control-button">${PROGRAM_SHORT_NAME}</div>
        <div class="npisas-menu-help npisas-flex-center npisas-control-button">?</div>
    </div>
    <div class="npisas-danbooru-results npisas-flex-center npisas-button">
        loading...
    </div>
    <div class="npisas-local-results npisas-flex-center npisas-button">
        loading...
    </div>
    <div class="npisas-search-info-row npisas-flex-center">
        <div class="npisas-control-search npisas-flex-center npisas-button npisas-control-button">
            <a class="npisas-expanded-link npisas-block-link" target="_blank">Search</a>
        </div>
        <div class="npisas-show-info npisas-flex-center npisas-button npisas-control-button">Info</div>
    </div>
    <div class="npisas-flex-center">
        <div class="npisas-control-upload npisas-flex-center npisas-button npisas-control-button">
            <a class="npisas-expanded-link npisas-block-link" target="_blank">Upload</a>
        </div>
        <div class="npisas-control-download npisas-flex-center npisas-button npisas-control-button">
            <a class="npisas-expanded-link npisas-block-link" target="_blank">Download</a>
        </div>
    </div>
</div>`;

const MINI_ARTWORK_MENU_HTML = Template.normalizeHTML()`
<div class="npisas-mini-menu npisas-artwork-menu" data-artwork-id="%ARTWORKID%">
    <div class="npisas-preview-header npisas-artwork-header npisas-flex-center">
        <div class="npisas-toggle-menu npisas-control-button npisas-flex-center">${PROGRAM_SHORT_NAME}</div>
        <div class="npisas-show-info npisas-control-button npisas-flex-center">Info</div>
        <div class="npisas-menu-help npisas-control-button npisas-flex-center" title="%MENUHELP%">?</div>
    </div>
    <div class="npisas-artwork-controls">
        <div class="npisas-results-column npisas-flex-center">
            <div class="npisas-danbooru-results npisas-button npisas-flex-center">loading...</div>
            <div class="npisas-local-results npisas-button npisas-flex-center">loading...</div>
        </div>
        <div class="npisas-search-column npisas-flex-center">
            <div class="npisas-control-search npisas-button npisas-control-button npisas-flex-center">
                <a class="npisas-expanded-link npisas-block-link" href="%SEARCHURL%" target="_blank">Search</a>
            </div>
        </div>
        <div class="npisas-transfer-column npisas-flex-center">
            <div class="npisas-control-upload npisas-button npisas-control-button npisas-flex-center">
                <a class="npisas-expanded-link npisas-block-link" href="%UPLOADURL%" target="_blank">Upload</a>
            </div>
            <div class="npisas-control-download npisas-button npisas-control-button npisas-flex-center">
                <a class="npisas-expanded-link npisas-block-link" target="_blank">Download</a>
            </div>
        </div>
    </div>
</div>`;

const PREVIEWS_DIALOG_HTML = Template.normalizeHTML()`
<div class="npisas-illust-previews" data-artwork-id="%ARTWORK_ID%" data-user-id="%USER_ID%" data-image-url="%IMAGE_URL%">
    <div class="npisas-preview-selectors npisas-links">
        <a class="npisas-preview-selector npisas-expanded-link" data-type="source">source</a>&ensp;|&ensp;
        <a class="npisas-preview-selector npisas-expanded-link" data-type="search">search</a>&ensp;|&ensp;
        <a class="npisas-preview-selector npisas-expanded-link" data-type="upload">upload</a>&ensp;|&ensp;
        <a class="npisas-preview-selector npisas-expanded-link" data-type="download">download</a>&ensp;|&ensp;
        <a class="npisas-preview-selector npisas-expanded-link" data-type="unified">unified</a>
    </div>
    <div class="npisas-preview-section"></div>
    <div class="npisas-queried">Last queried: %QUERIED%</div>
    <a class="npisas-upload-all" href="%UPLOAD_URL%" target="_blank" style="display: none;"></a>
</div>`;

const PREVIEW_CONTAINER_TEMPLATE = Template.normalizeHTML({template: true})`
<div
    class="npisas-preview-container"
    data-original="${'original'}"
    data-regular="${'regular'}"
    data-small="${'small'}"
    data-index="${'index'}"
    >
    <div class="npisas-preview-image npisas-flex-center">
        <a href="${'original'}" onclick="return false">
            <img
                style="width: ${'width'}; height: ${'height'};"
                alt="image #${'index'}"
                ${'src_attr'}
                >
        </a>
    </div>
    <div class="npisas-preview-info"></div>
    <div class="npisas-preview-addons">
        <div class="npisas-preview-source npisas-flex-center" style="display: none;"></div>
        <div class="npisas-preview-search npisas-flex-center" style="display: none;"></div>
        <div class="npisas-preview-upload npisas-flex-center" style="display: none;"></div>
        <div class="npisas-preview-download npisas-flex-center" style="display: none;"></div>
        <div class="npisas-preview-unified npisas-flex-center" style="display: none;"></div>
    </div>
</div>`;

const PREVIEW_ATTRIBUTES_TEMPLATE = Template.normalizeHTML({template: true})`
<div class="npisas-image-attributes">
    ${'size'} ${'extension'} : ${'width'} x ${'height'}
</div>`;

const PREVIEW_MATCH_TEMPLATE = Template.normalizeHTML({template: true})`
<div class="npisas-search-match">
    Danbooru: <span class="npisas-danbooru-results">${'link'}</span>
</div>`;

const PREVIEW_SEARCH_TEMPLATE = Template.normalizeHTML({template: true})`
<div class="npisas-image-search-menu npisas-flex-center">
    <span class="npisas-button npisas-flex-center npisas-local-results" title="Click to manually add posts.">
        ${'result_link'}
    </span>
    <span class="npisas-button npisas-control-button npisas-flex-center npisas-control-search" title="Click to seach image on Danbooru.">
        <a href="${'search_url'}" target="_blank">Search</a>
    </span>
</div>`;

const PREVIEW_UPLOAD_TEMPLATE = Template.normalizeHTML({template: true})`
<div class="npisas-button npisas-control-button npisas-image-upload-menu npisas-flex-center" title="Click to upload image.">
    <a href="${'upload_url'}" target="_blank">Upload</a>
</div>`;

const PREVIEW_DOWNLOAD_TEMPLATE = Template.normalizeHTML({template: true})`
<div class="npisas-button npisas-control-button npisas-image-download-menu npisas-flex-center"  title="Click to download image." data-id="${'artwork_id'}" data-original="${'original'}" data-index="${'index'}">
    <a href="${'original'}">Download</a>
</div>`;

const PREVIEW_UNIFIED_TEMPLATE = Template.normalizeHTML({template: true})`
<div class="npisas-unified-sources">
    <span class="npisas-danbooru-count ${'source_class'}">Danbooru(<span>${'sources'}</span>)</span>&ensp;<->&ensp;
    <span class="npisas-local-count ${'local_class'}">Local(<span>${'locals'}</span>)</span>
</div>`;

const INFO_DIALOG_TEMPLATE = Template.normalizeHTML()`
<div class="npisas-illust-info" data-artwork-id="%ARTWORK_ID%">
    <div class="npisas-info-section">
        <div class="npisas-info-title">%TITLE%</div>
        <div class="npisas-info-description npisas-links">%DESCRIPTION%</div>
        <ul class="npisas-info-details">
            <li><b>Uploaded:</b> %DATE%</li>
            <li><b>Bookmarks:</b> %BOOKMARKS%</li>
            <li><b>Type:</b> %TYPE%</li>
            %READING%
            <li class="npisas-links"><b>Request:</b> %REQUEST%</li>
            <li><b>Original:</b> %ORIGINAL%</li>
            <li><b>AI:</b> %AI%</li>
            <li class="npisas-links"><b>Tags:</b>
                <ul>%TAGS%</ul>
            </li>
            <li class="npisas-links"><b><a class="npisas-link" href="/users/%USER_ID%" target="_blank">pxuser #%USER_ID%</a></b>
                <ul>
                    <li><b>Name:</b> %USER_NAME%</li>
                    <li><b>Account:</b> %USER_ACCOUNT%</li>
                    <li><a class="npisas-link" href="/users/%USER_ID%/artworks" target="_blank">View all artworks</a></li>
                    <li><a class="npisas-link" href="/users/%USER_ID%/bookmarks/artworks" target="_blank">View all bookmarks</a></li>
                </ul>
            </li>
        </ul>
    </div>
    <div class="npisas-queried">Last queried: %QUERIED%</div>
</div>`;

const POST_IDS_TEMPLATE = Template.normalizeHTML({template: true})`
<a
    class="${'classname'} npisas-expanded-link"
    data-has-posts="true"
    target="_blank"
    title="${'title'}"
    href="${'href'}"
>
    ${'text'}
</a>`;

const DANBOORU_NO_MATCH_LINK = '<span class="npisas-database-no-match" data-has-posts="false">no sources</span>';
const LOCAL_NO_MATCH_LINK = '<span class="npisas-database-no-match" data-has-posts="false">no local</span>';

const IMAGE_INDICATORS_HTML = Template.normalizeHTML()`
<span id="npisas-image-indicators-toggle">
    <a id="npisas-shown-image-indicators" class="npisas-expanded-link npisas-on">Shown</a>
    <a id="npisas-hidden-image-indicators" class="npisas-expanded-link npisas-off">Hidden</a>
</span>`;

const VIEW_COUNTS_HTML = Template.normalizeHTML()`
<span id="npisas-view-counts-toggle">
    <a id="npisas-enabled-view-counts" class="npisas-expanded-link npisas-on">Enabled</a>
    <a id="npisas-disabled-view-counts" class="npisas-expanded-link npisas-off">Disabled</a>
</span>`;

const CONFIRM_UPLOAD_HTML = Template.normalizeHTML()`
<span id="npisas-confirm-upload-toggle">
    <a id="npisas-yes-confirm-upload" class="npisas-expanded-link npisas-on">Yes</a>
    <a id="npisas-no-confirm-upload" class="npisas-expanded-link npisas-off">No</a>
</span>`;

const CONFIRM_DOWNLOAD_HTML = Template.normalizeHTML()`
<span id="npisas-confirm-download-toggle">
    <a id="npisas-yes-confirm-download" class="npisas-expanded-link npisas-on">Yes</a>
    <a id="npisas-no-confirm-download" class="npisas-expanded-link npisas-off">No</a>
</span>`;

const PREVIEW_AI_INDICATOR ='<div class="npisas-ai-marker npisas-preview-marker npisas-marker">AI</div>';
const PREVIEW_VIEW_INDICATOR = '<div class="npisas-viewed-marker npisas-preview-marker npisas-marker">Viewed</div>';
const DEBUG_INDICATORS = '<div class="npisas-debug-marker npisas-preview-marker npisas-marker">Debug</div>';
const ILLUST_AI_INDICATOR = '<div class="npisas-ai-marker npisas-illust-marker npisas-marker">AI</div>';
const ILLUST_VIEW_INDICATOR = '<div class="npisas-viewed-marker npisas-illust-marker npisas-marker">Viewed</div>';

const MENU_LOADING_HTML = '<div class="npisas-menu-loading npisas-loading npisas-flex-center"><span>loading...</span></div>';
const MENU_UNAVAILABLE_HTML = '<div class="npisas-menu-unavailable">Unavailable on artwork view.</div>';
const DIALOG_LOADING_HTML = '<div class="npisas-dialog-loading npisas-loading npisas-flex-center"><span>loading...</span></div>';

//Message constants

const SHOW_MENU_HELP = `[${PROGRAM_SHORT_NAME}] L-click to toggle the menu.`;
const SHOW_INFO_HELP = "[Info] L-click to show extra artwork information.";
const DANBOORU_RESULTS_HELP = "[Danbooru results] L-click to show previews with matches.";
const LOCAL_RESULTS_SINGLE_HELP = "[Local results] L-click to add posts manually.";
const LOCAL_RESULTS_MULTI_HELP = "[Local results] L-click opens a menu to add posts manually to images.";
const SEARCH_SINGLE_HELP = "[Search] L-click for IQDB; R-click for URL.";
const SEARCH_MULTI_HELP = "[Search] L-click opens a menu for individual searches; R-click for URL.";
const UPLOAD_SINGLE_HELP = "[Upload] L/R-click to upload artwork.";
const UPLOAD_MULTI_HELP = "[Upload] L-click opens a menu for individual uploads; R-click to upload artwork.";
const DOWNLOAD_SINGLE_HELP = "[Download] L/R-click to download all.";
const DOWNLOAD_MULTI_HELP = "[Download] L-click opens a menu for individual downloads; R-click to download all.";

const ILLUST_MENU_HELP = `
Header:
${SHOW_MENU_HELP}

1st row:
${DANBOORU_RESULTS_HELP}

2nd row:
%LOCAL_RESULTS_HELP%

3rd row:
%SEARCH_HELP%
${SHOW_INFO_HELP}

4th row:
%UPLOAD_HELP%
%DOWNLOAD_HELP%
`.trim();

const PREVIEW_MENU_HELP = `
Header:
${SHOW_MENU_HELP}
${SHOW_INFO_HELP}

1st column:
${DANBOORU_RESULTS_HELP}
%LOCAL_RESULTS_HELP%

2nd column:
%SEARCH_HELP%

3rd column:
%UPLOAD_HELP%
%DOWNLOAD_HELP%
`.trim();

const CONFIRM_UPLOAD_HELP = "L-click to turn on/off confirmation for uploading the full artwork.";
const CONFIRM_DOWNLOAD_HELP = "L-click to turn on/off confirmation for downloading the full artwork.";

const CONFIRM_SAVE_PROMPT = "Save the following post IDs? (separate by comma, local matches only)";
const MANUAL_ADD_PROMPT = "Enter the post IDs to save. (separate by commas, local matches only)";

const SAVE_HELP = "L-Click to save current settings. (Shortcut: Alt+S)";
const RESET_HELP = "L-Click to reset settings to default. (Shortcut: Alt+R)";
const SETTINGS_HELP = "L-Click to open settings menu. (Shortcut: Alt+M)";
const CLOSE_HELP = "L-Click to close. (Shortcut: Alt+C)";

const REFRESH_RECORDS_HELP = "L-click to reload count (automatically checked once per day).";
const IMAGE_INDICATORS_HELP = "L-Click to toggle visibility of preview indicators (AI, Viewed, R-18, image count).";
const VIEWS_COUNTS_HELP = "L-Click to toggle whether artworks are being counted as viewed.";
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
const USERS_REGEX = Template.verboseRegex('i')`
${PIXIV_HOST}
${PIXIV_USERS}
(?<id>${PIXIV_ID})
${QUERY_END}
`;

// https://www.pixiv.net/en/users/1234/illustrations
// https://www.pixiv.net/en/users/1234/manga
// https://www.pixiv.net/en/users/1234/novels
// https://www.pixiv.net/en/users/1234/artworks
const USER_WORKS_REGEX = Template.verboseRegex('i')`
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
const USER_TAG_WORKS_REGEX = Template.verboseRegex('i')`
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
const BOOKMARKS_REGEX = Template.verboseRegex('i')`
${PIXIV_HOST}
${PIXIV_USERS}
(?<id>${PIXIV_ID})
/
bookmarks
/
(?<type>artworks|novels)
${QUERY_END}
`;

// https://www.pixiv.net/en/users/1234/bookmarks/artworks/original
// https://www.pixiv.net/en/users/1234/bookmarks/novels/original
const TAG_BOOKMARKS_REGEX = Template.verboseRegex('i')`
${PIXIV_HOST}
${PIXIV_USERS}
(?<id>${PIXIV_ID})
/
bookmarks
/
(?<type>artworks|novels)
/
(?<tag>[^?/]+)
${QUERY_END}
`;

// https://www.pixiv.net/user/1234/series/5678
const SERIES_REGEX = Template.verboseRegex('i')`
${PIXIV_HOST}
/user/
(?<id>${PIXIV_ID})
/series/
(?<series>${PIXIV_ID})
${QUERY_END}
`;

// https://www.pixiv.net/en/artworks/1234
const ARTWORKS_REGEX = Template.verboseRegex('i')`
${PIXIV_HOST}
${PIXIV_ARTWORKS}
(?<id>${PIXIV_ID})
${QUERY_END}
`;


// https://www.pixiv.net/en/tags/original
const TAGS_REGEX = Template.verboseRegex('i')`
${PIXIV_HOST}
${PIXIV_TAGS}
(?<tag>[^?/]+)
${QUERY_END}
`;

// https://www.pixiv.net/en/tags/original/artworks
// https://www.pixiv.net/en/tags/original/illustrations
// https://www.pixiv.net/en/tags/original/manga
// https://www.pixiv.net/en/tags/original/novels
const TAG_WORKS_REGEX = Template.verboseRegex('i')`
${PIXIV_HOST}
${PIXIV_TAGS}
(?<tag>[^/]+)
/
(?<type>artworks|illustrations|manga|novels)
${QUERY_END}
`;

const PXIMG_HOST_RG = String.raw`^https?://i\d?\.(?:pixiv|pximg)\.net`;

const PIXIV_IMAGE = Template.verboseRegex('i')`
${PXIMG_HOST_RG}
(?:/c/\w+)?
/(?:img-original|img-master|custom-thumb|img-zip-ugoira)
/img
/(?<date>\d{4}/\d{2}/\d{2}/\d{2}/\d{2}/\d{2})
/(?<id>\d+)
(?:-[a-f0-9]{32})?
(?:_p(?<order>\d+))
(?:_(?:master|square|custom)1200|_ugoira1920x1080)?
\.
(?<ext>jpg|png|gif|mp4|zip)
(?:$|\?)`;

const PIXIV_UGOIRA = Template.verboseRegex('i')`
${PXIMG_HOST_RG}
(?:/c/\w+)?
/(?:img-original|img-master)
/img
/(?<date>\d{4}/\d{2}/\d{2}/\d{2}/\d{2}/\d{2})
/(?<id>\d+)
(?:-[a-f0-9]{32})?
(?:_(?:master|square)1200|_ugoira\d+)?
\.
(?<ext>jpg|png|gif)
(?:$|\?)`;

const PIXIV_ZIP = Template.verboseRegex('i')`
${PXIMG_HOST_RG}
/img-zip-ugoira/img
/(?<date>\d{4}/\d{2}/\d{2}/\d{2}/\d{2}/\d{2})
/(?<id>\d+)
(?:-[a-f0-9]{32})?
_ugoira1920x1080\.zip
(?:\?original)?`;

const HANDLED_MEDIA = {
    image: PIXIV_IMAGE,
    ugoira: PIXIV_UGOIRA,
    zip: PIXIV_ZIP,
};

//Network constants

const POST_FIELDS = 'id,pixiv_id,uploader_id,score,fav_count,rating,tag_string,created_at,preview_file_url,source,file_ext,file_size,image_width,image_height,uploader[name]';

//Queue constants

const QUEUED_STORAGE_REQUESTS = [];
const SAVED_STORAGE_REQUESTS = [];
const CACHED_STORAGE_REQUESTS = {};
const CACHE_STORAGE_TYPES = ['get', 'check'];
const STORAGE_DATABASES = {
    danbooru: Storage.danboorustorage,
    pixiv: Storage.pixivstorage,
};

const QUEUED_NETWORK_REQUESTS = [];
const SAVED_NETWORK_REQUESTS = [];
const NETWORK_REQUEST_DICT = {
    artworks: {
        controller: 'posts',
        data_key: 'pixiv_id',
        params (artwork_ids) {
            return {
                tags: 'status:any pixiv_id:' + Utility.arrayUnique(artwork_ids).join(','),
                only: POST_FIELDS,
                limit: 200,
            };
        },
    },
    posts: {
        data_key: "id",
        params (post_ids) {
            return {
                tags: 'status:any id:' + Utility.arrayUnique(post_ids).join(','),
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
                    id: Utility.arrayUnique(user_ids).join(','),
                },
                only: 'id,name',
                limit: 1000,
            };
        },
    },
};

//Page constants

const PAGE_ATTRIBUTES = {
    artwork: {
        regex: ARTWORKS_REGEX,
        sections: [{
            selector: 'div#__next > div > div > div > div > div > aside > div > section > div > div > div > ul > li > div:not(.npisas-artwork) > div > div > a > div > div > img',
            imageparent: 5,
            artworkparent: 6,
            gridparent: 9,
        }],
    },
    user: {
        regex: USERS_REGEX,
        sections: [{
            selector: 'div#__next > div > div > div > div > div > div > div > div > div > div > ul > li > div:not(.npisas-artwork) > div > div > a > div > div > img',
            imageparent: 5,
            artworkparent: 6,
            gridparent: 11,
        }],
    },
    user_works: {
        regex: USER_WORKS_REGEX,
        sections: [{
            selector: 'div#__next > div > div > div > div > div > div > div > div > div > div > ul > li > div:not(.npisas-artwork) > div > div > a > div > div > img',
            imageparent: 5,
            artworkparent: 6,
            gridparent: 11,
        }],
    },
    user_tag_works: {
        regex: USER_TAG_WORKS_REGEX,
        sections: [{
            selector: 'div#__next > div > div > div > div > div > div > div > div > div > div > ul > li > div:not(.npisas-artwork) > div > div > a > div > div > img',
            imageparent: 5,
            artworkparent: 6,
            gridparent: 11,
        }],
    },
    bookmarks: {
        regex: BOOKMARKS_REGEX,
        sections: [{
            selector: 'div#__next > div > div > div > div > div > div > div > div > div > section > div > div > ul > li > div:not(.npisas-artwork) > div > div > a > div > div > img',
            imageparent: 5,
            artworkparent: 6,
            gridparent: 12,
        }],
    },
    tag_bookmarks: {
        regex: TAG_BOOKMARKS_REGEX,
        sections: [{
            selector: 'div#__next > div > div > div > div > div > div > div > div > div > section > div > div > ul > li > div:not(.npisas-artwork) > div > div > a > div > div > img',
            imageparent: 5,
            artworkparent: 6,
            gridparent: 12,
        }],
    },
    series: {
        regex: SERIES_REGEX,
        sections: [{
            selector: 'div#__next > div > div > div > div > div > div > main > div > section > div > div#seriesContents > div > div > div > div > ul > li > div:not(.npisas-artwork) > div > div > a > div > div > img',
            imageparent: 5,
            artworkparent: 6,
            gridparent: 9,
        }],
    },
    tags: {
        range: 'section:nth-of-type(2) > div > ul',
        regex: TAGS_REGEX,
        sections: [{
            selector: 'div#__next > div > div > div > div > div > div > div > section > div > ul > li > div:not(.npisas-artwork) > div > div > a > div > div > img',
            imageparent: 5,
            artworkparent: 6,
            gridparent: 11,
        }],
    },
    tag_works: {
        regex: TAG_WORKS_REGEX,
        sections: [{
            selector: 'div#__next > div > div > div > div > div > div > section > div > div > ul > li > div:not(.npisas-artwork) > div > div > a > div > div > img',
            imageparent: 5,
            artworkparent: 6,
            gridparent: 9,
        }],
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
        'ui-dialog': 'npisas-dialog ui-dialog-pixiv',
        'ui-dialog-titlebar-close': 'npisas-dialog-close',
    },
    buttons: {},
};

const INFO_DIALOG_SETTINGS = {
    title: "Artwork information",
    modal: true,
    resizable: false,
    autoOpen: false,
    width: 670,
    classes: {
        'ui-dialog': 'npisas-dialog ui-dialog-pixiv',
        'ui-dialog-titlebar-close': 'npisas-dialog-close',
    },
    buttons: {
        'Reload' (event) {
            DialogReloadInfo(event);
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
        'ui-dialog': 'npisas-dialog ui-dialog-pixiv',
        'ui-dialog-titlebar-close': 'npisas-dialog-close',
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

const PROGRAM_RECHECK_INTERVAL = Utility.one_second;
const PRUNE_RECHECK_EXPIRES = Utility.one_hour * 6;

const USER_EXPIRES = Utility.one_month;
const MIN_POST_EXPIRES = Utility.one_day;
const MAX_POST_EXPIRES = Utility.one_month;

const FOUND_ARTWORK_EXPIRES = Utility.one_day;
const MISSING_ARTWORK_EXPIRES = Utility.one_hour;
const PAGE_EXPIRES = Utility.one_week;
const INFO_EXPIRES = Utility.one_month;
const ILLUST_EXPIRES = Utility.one_month;
const TAG_EXPIRES = Utility.one_year;

const LENGTH_RECHECK_INTERVAL = Utility.one_day;

const RECENT_DURATION = Utility.one_minute * 5;

//Other constants

const DANBOORU_MODES = ['default', 'on', 'off'];
const UPLOADS_PATH = '/uploads/new';

const PREVIEW_INDICATOR_CONTROLS = ['shown', 'hidden'];
const VIEW_COUNT_CONTROLS = ['enabled', 'disabled'];
const CONFIRM_UPLOAD_CONTROLS = ['yes', 'no'];
const CONFIRM_DOWNLOAD_CONTROLS = ['yes', 'no'];

const AI_TAGS = [
    'AI', 'AI-generated', 'AIArt', 'AIArtCommunity', 'AIArtSociety', 'AIArtistCommunity', 'AIArtwork', 'AIArtworks', 'AIGenerated',
    'AI_Generated', 'AI_generated', 'AIillustration', 'AIphoto', 'AIねこみみ部', 'AIねこ部', 'AIイラスト', 'AIケモミ', 'AI作品', 'AI使用',
    'AI挿絵', 'AI生成', 'AI生成イラスト', 'AI生成画像', 'Ai绘画', 'Alイラスト', 'AnythingV3', 'Artbreeder', 'BingImageCreator', 'ComfyUI',
    'CopilotDesigner', 'Craiyon', 'DALL-E3', 'DALLE', 'DALLE2', 'DiscoDiffusion', 'MidJourney', 'NovelAI', 'NovelAIDiffusion',
    'NovelAIDiffusionV4', 'PixVerse', 'PonyDiffusion', 'PonyXL', 'SDXL', 'StableDiffusion', 'Stable_Diffusion', 'Stablediffusion',
    'TrinArt', 'WaifuDiffiusion', 'WaifuDiffusion', 'WaifuLabs', 'ai-created', 'ai-generated', 'ai_art', 'ai_artist', 'ai_artwork',
    'ai_generated', 'ai_generated_art', 'ai_image', 'aiart', 'aiartists', 'aigenerated', 'aigeneratedart', 'aigirl', 'ai绘画', 'anything_v3',
    'cuteAI', 'midjourneyv61', 'nai3', 'nanobanana', 'nijijourney', 'nijijourneyv5', 'novelai', 'にじジャーニー', 'アイ', 'aigc',
    'AI-assisted', 'AI補助', 'AI+手書き', 'ai辅助绘画', 'ai辅助', 'aiassisted', 'ai_assisted', 'イラストAI加筆あり', 'イラストAI加筆',
    'AI制作',
];

const GOLD_LEVEL = 30;

//Classes

class DanbooruSource {
    constructor(data, type) {
        if (type === 'post') {
            this.data = DanbooruSource.map(data);
        } else {
            this.data = data;
        }
    }

    get indexes() {
        return Utility.arrayUnique(Utility.getObjectAttributes(this.data, 'order')).sort();
    }

    get post_ids() {
        return Utility.arrayUnique(Utility.getObjectAttributes(this.data, 'id'));
    }

    has_post(post) {
        let post_info = DanbooruSource.convert(post);
        return Boolean(this.data.find((source) => (source.id === post_info.id && source.date === post_info.date && source.order === post_info.order)));
    }

    index_sources(index) {
        return this.data.filter((source) => source.order === index);
    }

    index_post_ids(index) {
        return Utility.getObjectAttributes(this.index_sources(index), 'id');
    }

    image_sources(image_url) {
        let image_info = DanbooruSource.image_info(image_url);
        return this.data.filter((source) => source.order === image_info.order);
    }

    image_post_ids(image_url) {
        return Utility.getObjectAttributes(this.image_sources(image_url), 'id');
    }

    image_match(image_url) {
        let image_info = DanbooruSource.image_info(image_url);
        let matching_sources = this.index_sources(image_info.order);
        if (matching_sources.length > 0) {
            let matching_dates = Utility.getObjectAttributes(matching_sources, 'date');
            return matching_dates.includes(image_info.date);
        }
        return true;
    }

    artwork_match(image_url) {
        let image_info = DanbooruSource.image_info(image_url);
        let expired = {};
        this.data.forEach((source) => {
            expired[source.order] ||= source.date === image_info.date;
        });
        return Object.values(expired).every((val) => val);
    }

    merge(posts) {
        for (let post of posts) {
            if (!this.has_post(post)) {
                this.data.push(DanbooruSource.convert(post));
            }
        }
    }

    static image_info(image_url) {
        let image_info = GetImageURLInfo(image_url);
        return {
            date: image_info.date,
            order: image_info.order ?? null,
        };
    }

    static map(posts) {
        return posts.map(DanbooruSource.convert);
    }

    static convert(post) {
        return Utility.assignObjects({
            id: post.id,
        }, DanbooruSource.image_info(post.source));
    }
}

class LocalSource {
    constructor(data) {
        this.data = data;
    }

    index_posts(index) {
        return this.data.filter((a) => a.order === index);
    }

    index_post_ids(index) {
        return Utility.getObjectAttributes(this.index_posts(index), 'id');
    }

    merge(post_ids, order) {
        let other_results = this.data.filter((a) => a.order !== order);
        let image_results = post_ids.map((id) => ({id, order}));
        this.data = Utility.concat(other_results, image_results);
    }

    get post_ids() {
        return Utility.getObjectAttributes(this.data, 'id');
    }
}

//Validate constants

const POST_CONSTRAINTS = {
    id: Validate.positive_integer_constraints,
    pixivid: Validate.nullable_nonnegative_integer_constraints,
    uploaderid: Validate.positive_integer_constraints,
    uploadername: Validate.stringnull_constraints,
    score: Validate.integer_constraints,
    favcount: Validate.nonnegative_integer_constraints,
    rating: Validate.inclusion_constraints(['g', 's', 'q', 'e']),
    tags: Validate.stringonly_constraints,
    created: Validate.positive_integer_constraints,
    thumbnail: Validate.stringonly_constraints,
    source: Validate.stringonly_constraints,
    ext: Validate.inclusion_constraints(['jpg', 'png', 'gif', 'mp4', 'webm', 'zip']),
    size: Validate.positive_integer_constraints,
    width: Validate.positive_integer_constraints,
    height: Validate.positive_integer_constraints,
};

const USER_CONSTRAINTS = {
    id: Validate.positive_integer_constraints,
    name: Validate.stringonly_constraints,
};

const VIEW_CONSTRAINTS = {
    count: Validate.positive_integer_constraints,
    viewed: Validate.positive_integer_constraints,
};

const DANBOORU_CONSTRAINTS = {
    id: Validate.positive_integer_constraints,
    order: Validate.nullable_nonnegative_integer_constraints,
    date: Validate.stringonly_constraints,
};

const LOCAL_CONSTRAINTS = {
    id: Validate.positive_integer_constraints,
    order: Validate.integer_constraints,
};

const PAGE_CONSTRAINTS = {
    value: {
        id: Validate.positive_integer_constraints,
        date: Validate.stringonly_constraints,
        queried: Validate.nonnegative_integer_constraints,
        page: Validate.array_constraints(),
    },
    page: {
        urls: Validate.hash_constraints,
        height: Validate.integer_constraints,
        width: Validate.integer_constraints,
    },
    urls: {
        thumb_mini: Validate.stringonly_constraints,
        small: Validate.stringonly_constraints,
        regular: Validate.stringonly_constraints,
        original: Validate.stringonly_constraints,
    },
};

const ILLUST_CONSTRAINTS = {
    value: {
        id: Validate.positive_integer_constraints,
        ai: Validate.boolean_constraints,
        ero: Validate.boolean_constraints,
        guro: Validate.boolean_constraints,
        single: Validate.boolean_constraints,
        type: Validate.inclusion_constraints([0, 1, 2]),
        tags: Validate.array_constraints(),
        timestamp: Validate.positive_integer_constraints,
    },
    tags: Validate.basic_stringonly_validator,
};

const INFO_CONSTRAINTS = {
    value: {
        id: Validate.positive_integer_constraints,
        title: Validate.stringonly_constraints,
        description: Validate.stringonly_constraints,
        user_id: Validate.positive_integer_constraints,
        user_name: Validate.stringonly_constraints,
        user_account: Validate.stringonly_constraints,
        date: Validate.stringonly_constraints,
        bookmarks: Validate.nonnegative_integer_constraints,
        type: Validate.inclusion_constraints(['illust', 'manga']),
        reading: Validate.inclusion_constraints(['scroll', 'book']),
        original: Validate.boolean_constraints,
        request: Validate.nullable_nonnegative_integer_constraints,
        ai: Validate.boolean_constraints,
        tags: Validate.array_constraints(),
        queried: Validate.nonnegative_integer_constraints,
    },
    tags: {
        name: Validate.stringonly_constraints,
        deletable: Validate.boolean_constraints,
        translation: Validate.stringnull_constraints,
    },
};

const TAG_CONSTRAINTS = {
    translation: Validate.stringnull_constraints,
    image: Validate.stringnull_constraints,
    abstract: Validate.stringnull_constraints,
};

const IMAGE_SIZE_CONSTRAINTS = {
    expires: Validate.nonnegative_integer_constraints,
    value: Validate.positive_integer_constraints,
};

/****Functions****/

//Validate functions

function ValidateEntry(key, data) {
    let printer = Debug.getFunctionPrint('ValidateEntry');
    if (!Validate.validateIsHash(key, data)) {
        return false;
    }
    if (key.match(/^image-size-/)) {
        return Validate.validateHashEntries(key, data, IMAGE_SIZE_CONSTRAINTS);
    }
    if (key.match(/^(?:post|user|view)-/)) {
        return ValidateDanbooruData(key, data);
    }
    if (key.match(/^(?:danbooru|local|page|info|illust|tag|image-size)-/)) {
        return ValidatePixivData(key, data);
    }
    printer.warn("Bad key!");
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
        return Utility.one_year;
    }
    if (key.match(/^(?:danbooru|local)-/)) {
        return FOUND_ARTWORK_EXPIRES;
    }
    if (key.match(/^page-/)) {
        return PAGE_EXPIRES;
    }
    if (key.match(/^info-/)) {
        return INFO_EXPIRES;
    }
    if (key.match(/^tag-/)) {
        return TAG_EXPIRES;
    }
    return 0;
}

function ValidateDanbooruData(key, data) {
    if (!Validate.validateHashEntries(key, data, Validate.hashentry_constraints)) {
        return false;
    }
    if (key.match(/^post-/)) {
        return Validate.validateHashEntries(key + '.value', data.value, POST_CONSTRAINTS);
    }
    if (key.match(/^user-/)) {
        return Validate.validateHashEntries(key + '.value', data.value, USER_CONSTRAINTS);
    }
    if (key.match(/^view-/)) {
        return Validate.validateHashEntries(key + '.value', data.value, VIEW_CONSTRAINTS);
    }
}

function ValidatePixivData(key, data) {
    let is_array = /^(?:danbooru|local)-/.test(key);
    if (is_array && !Validate.validateHashEntries(key, data, Validate.arrayentry_constraints())) {
        return false;
    }
    if (!is_array && !Validate.validateHashEntries(key, data, Validate.hashentry_constraints)) {
        return false;
    }
    let value_key = key + '.value';
    let value = data.value;
    if (key.match(/^danbooru-/)) {
        return Validate.validateHashArrayEntries(value_key, value, DANBOORU_CONSTRAINTS);
    }
    if (key.match(/^local-/)) {
        return Validate.validateHashArrayEntries(value_key, value, LOCAL_CONSTRAINTS);
    }
    if (key.match(/^page-/)) {
        return Validate.validateHashEntries(value_key, value, PAGE_CONSTRAINTS.value)
            && Validate.validateHashArrayEntries(value_key + '.page', value.page, PAGE_CONSTRAINTS.page)
            && value.page.every((page, i) => Validate.validateHashEntries(value_key + `.page[${i}].urls`, page.urls, PAGE_CONSTRAINTS.urls));
    }
    if (key.match(/^info-/)) {
        return Validate.validateHashEntries(value_key, value, INFO_CONSTRAINTS.value)
            && Validate.validateHashArrayEntries(value_key + '.tags', value.tags, INFO_CONSTRAINTS.tags);
    }
    if (key.match(/^illust-/)) {
        return Validate.validateHashEntries(value_key, value, ILLUST_CONSTRAINTS.value)
            && Validate.validateArrayValues(value_key + '.tags', value.tags, ILLUST_CONSTRAINTS.tags);
    }
    if (key.match(/^tag-/)) {
        return Validate.validateHashEntries(value_key, value, TAG_CONSTRAINTS);
    }
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
            deferred: Utility.createPromise(),
            error: Debug.createError(),
        };
        if (CACHE_STORAGE_TYPES.includes(type)) {
            Debug.recordTime(key, 'Storage-queue');
        }
        QUEUED_STORAGE_REQUESTS.push(request);
        CACHED_STORAGE_REQUESTS[queue_key] = request.deferred.promise;
        Debug.execute(() => {
            SAVED_STORAGE_REQUESTS.push(request);
        });
    }
    return CACHED_STORAGE_REQUESTS[queue_key];
}

function IntervalStorageHandler() {
    const printer = Debug.getFunctionPrint('IntervalStorageHandler');
    if (QUEUED_STORAGE_REQUESTS.length === 0) {
        return;
    }
    Debug.execute(() => {
        printer.log("Queued requests:", Utility.deepCopy(QUEUED_STORAGE_REQUESTS));
    }, Debug.VERBOSE);
    for (let database in STORAGE_DATABASES) {
        let requests = QUEUED_STORAGE_REQUESTS.filter((request) => (request.database === database));
        let save_requests = requests.filter((request) => (request.type === 'save'));
        if (save_requests.length) {
            printer.logLevel("Save requests:", save_requests, Debug.DEBUG);
            let save_data = Object.assign(...save_requests.map((request) => ({[request.key]: request.value})));
            Storage.batchSaveData(save_data, {database: STORAGE_DATABASES[database]}).then(() => {
                save_requests.forEach((request) => {
                    request.deferred.resolve(null);
                    request.endtime = performance.now();
                });
            });
        }
        let remove_requests = requests.filter((request) => (request.type === 'remove'));
        if (remove_requests.length) {
            printer.logLevel("Remove requests:", remove_requests, Debug.DEBUG);
            let remove_keys = remove_requests.map((request) => request.key);
            Storage.batchRemoveData(remove_keys, {database: STORAGE_DATABASES[database]}).then(() => {
                remove_requests.forEach((request) => {
                    request.deferred.resolve(null);
                    request.endtime = performance.now();
                });
            });
        }
        let check_requests = requests.filter((request) => (request.type === 'check'));
        if (check_requests.length) {
            printer.logLevel("Check requests:", check_requests, Debug.DEBUG);
            let check_keys = check_requests.map((request) => request.key);
            Storage.batchCheckData(check_keys, {validation: ValidateExpiration, database: STORAGE_DATABASES[database]}).then((check_data) => {
                FulfillStorageRequests(check_keys, check_data, check_requests);
            });
        }
        let noncheck_requests = requests.filter((request) => (request.type === 'get'));
        if (noncheck_requests.length) {
            printer.logLevel("Noncheck requests:", noncheck_requests, Debug.DEBUG);
            let noncheck_keys = noncheck_requests.map((request) => request.key);
            Storage.batchRetrieveData(noncheck_keys, {database: STORAGE_DATABASES[database]}).then((noncheck_data) => {
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
        request.deferred.resolve(data);
        request.data = data;
        Debug.recordTimeEnd(key, 'Storage-queue');
    });
}

function QueueNetworkRequest(type, item, server) {
    const request_key = type + ',' + item.toString();
    const request = {
        type,
        item,
        server,
        request_key,
        deferred: Utility.createPromise(),
        error: (Debug.mode ? new Error() : null),
    };
    Debug.recordTime(request_key, 'Network-queue');
    QUEUED_NETWORK_REQUESTS.push(request);
    Debug.execute(() => {
        SAVED_NETWORK_REQUESTS.push(request);
    });
    return request.deferred.promise;
}

function IntervalNetworkHandler () {
    if (QUEUED_NETWORK_REQUESTS.length === 0) {
        return;
    }
    for (let type in NETWORK_REQUEST_DICT) {
        const requests = QUEUED_NETWORK_REQUESTS.filter((request) => (request.type === type && request.server === 'danbooru'));
        if (requests.length > 0) {
            const items = requests.map((request) => request.item).flat();
            const params = NETWORK_REQUEST_DICT[type].params(items);
            const data_key = NETWORK_REQUEST_DICT[type].data_key;
            const controller = NETWORK_REQUEST_DICT[type].controller || type;
            Danbooru.query(controller, params, {default_val: [], domain: NPISAS.domain}).then((data_items) => {
                for (let i = 0; i < requests.length; i++) {
                    let request = requests[i];
                    let request_data = data_items.filter((data) => request.item.includes(data[data_key]));
                    request.deferred.resolve(request_data);
                    request.data = request_data;
                    Debug.recordTimeEnd(request.request_key, 'Network-queue');
                }
            });
        }
    }
    let pixiv_requests = QUEUED_NETWORK_REQUESTS.filter((request) => request.server === 'pixiv');
    if (pixiv_requests.length) {
        let query_ids = pixiv_requests.map((request) => request.item);
        Network.getJSON('/ajax/user/1/illusts', {data: {ids: query_ids}}).then((network_data) => {
            for (let request of pixiv_requests) {
                let request_data = network_data.body[request.item] ?? null;
                request.deferred.resolve(request_data);
                request.data = request_data;
                Debug.recordTimeEnd(request.request_key, 'Network-queue');
            }
        });
    }
    QUEUED_NETWORK_REQUESTS.length = 0;
}

//Auxiliary functions

function GetSessionLocalResultData(artwork_id) {
    return Storage.getIndexedSessionData('local-' + artwork_id, {database: STORAGE_DATABASES.pixiv});
}

function GetSessionLocalResult(artwork_id) {
    let storage_data = GetSessionLocalResultData(artwork_id);
    return new LocalSource(storage_data.value);
}

function GetSessionDanbooruResultData(artwork_id) {
    return Storage.getIndexedSessionData('danbooru-' + artwork_id, {database: STORAGE_DATABASES.pixiv});
}

function GetSessionDanbooruResult(artwork_id) {
    let storage_data = GetSessionDanbooruResultData(artwork_id);
    return new DanbooruSource(storage_data.value);
}

function GetSessionPosts(post_ids) {
    let posts = [];
    post_ids.forEach((post_id) => {
        let post_data = Storage.getIndexedSessionData('post-' + post_id, {database: STORAGE_DATABASES.danbooru});
        if (post_data) {
            posts.push(post_data.value);
        }
    });
    return posts;
}

function GetSessionPageData(artwork_id) {
    return Storage.getIndexedSessionData('page-' + artwork_id, {database: STORAGE_DATABASES.pixiv});
}

function LogarithmicExpiration(count, max_count, time_divisor, multiplier) {
    let time_exponent = Math.pow(10, (1 / time_divisor));
    return Math.round(Math.log10(time_exponent + (10 - time_exponent) * (count / max_count)) * multiplier);
}

function PostExpiration(created_timestamp) {
    let created_interval = Date.now() - created_timestamp;
    if (created_interval < Utility.one_day) {
        return MIN_POST_EXPIRES;
    }
    if (created_interval < Utility.one_month) {
        let day_interval = (created_interval / Utility.one_day) - 1; //Start at 0 days and go to 29 days
        let day_slots = 29; //There are 29 day slots between 1 day and 30 days
        let days_month = 30;
        return LogarithmicExpiration(day_interval, day_slots, days_month, MAX_POST_EXPIRES);
    }
    return MAX_POST_EXPIRES;
}

function RemoveDuplicates(obj_array, attribute){
    const attribute_index = Utility.getObjectAttributes(obj_array, attribute);
    return obj_array.filter((obj, index) => (attribute_index.indexOf(obj[attribute]) === index));
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
        created: Utility.toTimeStamp(post.created_at),
        thumbnail: post.preview_file_url,
        source: post.source,
        ext: post.file_ext,
        size: post.file_size,
        width: post.image_width,
        height: post.image_height
    };
}

function GetImageURLInfo(image_url) {
    GetImageURLInfo.memoized ??= {};
    if (GetImageURLInfo.memoized[image_url] === undefined) {
        GetImageURLInfo.memoized[image_url] = null;
        for (let type in HANDLED_MEDIA) {
            let match = HANDLED_MEDIA[type].exec(image_url);
            if (match) {
                let data = {url: image_url};
                for (let key in match.groups) {
                    if (/^\d+$/.test(match.groups[key])) {
                        data[key] = Number(match.groups[key]);
                    } else {
                        data[key] = match.groups[key];
                    }
                }
                GetImageURLInfo.memoized[image_url] = data;
                GetImageURLInfo.memoized[image_url].type = type;
                break;
            }
        }
    }
    return GetImageURLInfo.memoized[image_url];
}

function GetNthParent(obj, levels) {
    let $element = obj;
    for (let i = 0;i < levels;i++) {
        $element = $element.parentElement;
    }
    return $element;
}

function GetPreviewDimensions(image_width, image_height, base_dimension) {
    let scale = Math.min(base_dimension / image_width, base_dimension / image_height);
    scale = Math.min(1, scale);
    let width = Math.round(image_width * scale);
    let height = Math.round(image_height * scale);
    return [width, height];
}

function PromptPostIDs(artwork_id, message, save_post_ids, index) {
    const printer = Debug.getFunctionPrint('PromptPostIDs');
    let local = GetSessionLocalResult(artwork_id);
    let image_post_ids = local.index_post_ids(index);
    let confirm_post_ids = Utility.arrayUnion(save_post_ids, image_post_ids);
    if (confirm_post_ids.length !== image_post_ids) {
        let prompt_string = prompt(message, confirm_post_ids.join(', '));
        if (prompt_string !== null) {
            let confirmed_post_ids = Utility.arrayUnique(
                prompt_string.split(',')
                    .map(Number)
                    .filter((num) => Utility.isID(num))
            );
            printer.log("Confirmed IDs:", confirmed_post_ids);
            if (!Utility.arrayEquals(confirmed_post_ids, image_post_ids)) {
                local.merge(confirmed_post_ids, index);
                Storage.saveData('local-' + artwork_id, {value: local.data, expires: 0}, {database: Storage.pixivstorage});
            }
        }
    }
    return local;
}

function DisplayControl(control, all_controls, type) {
    let all_selectors = Utility.joinList(all_controls, {prefix: '#npisas-', suffix: '-' + type, joiner: ','});
    $(all_selectors).hide();
    setTimeout(() => {$(`#npisas-${control}-${type}`).show();}, 1);
}

function DestroyPreviewsDialog(artwork_id) {
    if (NPISAS.previews_dialog[artwork_id]) {
        NPISAS.previews_dialog[artwork_id].dialog('destroy');
        NPISAS.previews_dialog[artwork_id].remove();
        delete NPISAS.previews_dialog[artwork_id];
    }
}

function TimeRange(timestamp1, timestamp2) {
    let time_interval = timestamp1 - timestamp2;
    if (time_interval < Utility.one_hour) {
        return Utility.setPrecision(time_interval / Utility.one_minute, 2) + " minutes";
    }
    if (time_interval < Utility.one_day) {
        return Utility.setPrecision(time_interval / Utility.one_hour, 2) + " hours";
    }
    if (time_interval < Utility.one_month) {
        return Utility.setPrecision(time_interval / Utility.one_day, 2) + " days";
    }
    if (time_interval < Utility.one_year) {
        return Utility.setPrecision(time_interval / Utility.one_month, 2) + " months";
    }
    return Utility.setPrecision(time_interval / Utility.one_year, 2) + " years";
}

//Render functions

function RenderSideMenu() {
    return Utility.regexReplace(SIDE_MENU, {
        DANBOORUHELP: RenderHelp('Click to turn Danbooru queries on/off.'),
        MAXIDHELP: RenderHelp('The artwork max on the current page.\nHover to show the time string.'),
        MINIDHELP: RenderHelp('The artwork min on the current page.\nHover to show the time string.'),
        TIMERANGEHELP: RenderHelp('The artwork time range on the current page.'),
        RECORDSHELP: RenderHelp(REFRESH_RECORDS_HELP),
        CONFIRM_UPLOAD: CONFIRM_UPLOAD_HTML,
        CONFIRM_UPLOAD_HELP: RenderHelp(CONFIRM_UPLOAD_HELP),
        CONFIRM_DOWNLOAD: CONFIRM_DOWNLOAD_HTML,
        CONFIRM_DOWNLOAD_HELP: RenderHelp(CONFIRM_DOWNLOAD_HELP),
        IMAGE_INDICATORS: IMAGE_INDICATORS_HTML,
        IMAGE_INDICATORS_HELP: RenderHelp(IMAGE_INDICATORS_HELP),
        VIEW_COUNTS: VIEW_COUNTS_HTML,
        VIEW_COUNTS_HELP: RenderHelp(VIEWS_COUNTS_HELP),
        ERRORMESSAGES: Network.error_messages.length,
        ERRORMESSAGESHELP: RenderHelp(ERROR_MESSAGES_HELP),
        SETTINGSHELP: SETTINGS_HELP,
        STATISTICSHELP: RenderHelp(STATISTICS_HELP),
    });
}

function RenderStatsTable(page_artworks) {
    let total_artworks = page_artworks.length;
    let single_artworks = page_artworks.filter((artwork) => artwork.single).length;
    let illust_artworks = page_artworks.filter((artwork) => artwork.type === 0).length;
    let manga_artworks = page_artworks.filter((artwork) => artwork.type === 1).length;
    let ugoira_artworks = page_artworks.filter((artwork) => artwork.type === 2).length;
    let ai_artworks = page_artworks.filter((artwork) => artwork.ai).length;
    let ero_artworks = page_artworks.filter((artwork) => artwork.ero).length;
    let guro_artworks = page_artworks.filter((artwork) => artwork.guro).length;
    return Utility.regexReplace(SIDE_MENU_STATISTICS, {
        TOTALARTWORKS: total_artworks,
        SINGLEARTWORKS: single_artworks,
        MULTIARTWORKS: total_artworks - single_artworks,
        ILLUSTARTWORKS: illust_artworks,
        MANGAARTWORKS: manga_artworks,
        UGOIRAARTWORKS: ugoira_artworks,
        AIARTWORKS: ai_artworks,
        EROARTWORKS: ero_artworks,
        GUROARTWORKS: guro_artworks,
    });
}

function RenderTagsList(tags, tag_count) {
    let tags_html = "";
    for (let i = 0; i < tags.length; i++) {
        let tag = tags[i];
        let count = tag_count[tag];
        let display_name = Utility.maxLengthString(tag, 15);
        let encoded_name = encodeURIComponent(tag);
        let index = (i < 9 ? '&ensp;' : "") + (i + 1);
        let link = Utility.renderHTMLTag('a', display_name, {
            class: 'npisas-link',
            href: `/tags/${encoded_name}/artworks`,
            target: '_blank',
        });
        tags_html += Utility.renderHTMLTag('li', `<b>${index}.</b> ${link} (${count})`, {'data-tag': tag});
    }
    return Utility.renderHTMLTag('ul', tags_html, {class: 'npisas-links'});
}

function RenderMiniMenu(artwork_id, image_count, image_url) {
    let menu_help = RenderPreviewHelp(image_count);
    let encoded_url = encodeURIComponent('https://www.pixiv.net/artworks/' + artwork_id);
    let upload_url = `${NPISAS.domain}${UPLOADS_PATH}?url=${encoded_url}`;
    var search_url = "";
    if (image_count === 1) {
        let encoded_image_url = encodeURIComponent(image_url);
        search_url = `${NPISAS.domain}/iqdb_queries?url=${encoded_image_url}`;
    }
    return Utility.regexReplace(MINI_ARTWORK_MENU_HTML, {
        ARTWORKID: artwork_id,
        MENUHELP: menu_help,
        SEARCHURL: search_url,
        UPLOADURL: upload_url,
    });
}

function RenderInfoDialog(illust_data) {
    let reading_html = illust_data.type === 'manga' ? `<li><b>Reading:</b> ${illust_data.reading}</li>` : "";
    let tags_html = illust_data.tags.map((tag_data) => {
        let prepend = tag_data.deletable ? 'X' : 'O';
        let translation = tag_data.translation ? `<small>(${tag_data.translation})</small>` : "";
        let line_class = tag_data.translation ? 'npisas-translated' : "";
        return `<li class="${line_class}">[${prepend}] <a class="npisas-link" href="/tags/${encodeURIComponent(tag_data.name)}/artworks">${tag_data.name}</a> ${translation}</li>`;
    }).join("");
    let $description = $(`<div>${illust_data.description}</div>`);
    $description.find('a').addClass('npisas-link');
    var request_html;
    if (Number.isInteger(illust_data.request)) {
        let href = `https://www.pixiv.net/requests/${illust_data.request}`;
        request_html = Utility.renderHTMLTag('a', href, {class: 'npisas-link', href});
    } else {
        request_html = "none";
    }
    return Utility.regexReplace(INFO_DIALOG_TEMPLATE, {
        ARTWORK_ID: illust_data.id,
        USER_ID: illust_data.user_id,
        USER_NAME: illust_data.user_name,
        USER_ACCOUNT: illust_data.user_account,
        TITLE: illust_data.title,
        DESCRIPTION: $description.get(0).innerHTML,
        DATE: illust_data.date,
        BOOKMARKS: illust_data.bookmarks,
        TYPE: illust_data.type,
        READING: reading_html,
        REQUEST: request_html,
        ORIGINAL: illust_data.original,
        AI: illust_data.ai,
        TAGS: tags_html,
        QUERIED: Utility.timeAgo(illust_data.queried, {recent_duration: RECENT_DURATION}),
    });
}

function RenderPreviewsDialog(artwork_id, user_id, image_url, queried) {
    let encoded_url = encodeURIComponent('https://www.pixiv.net/artworks/' + artwork_id);
    let upload_url = `${NPISAS.domain}${UPLOADS_PATH}?url=${encoded_url}`;
    return Utility.regexReplace(PREVIEWS_DIALOG_HTML, {
        ARTWORK_ID: artwork_id,
        USER_ID: user_id,
        IMAGE_URL: image_url,
        UPLOAD_URL: upload_url,
        QUERIED: Utility.timeAgo(queried, {recent_duration: RECENT_DURATION}),
    });
}

function RenderPreviewContainer(url_data, source, index) {
    let [width, height] = url_data.width > url_data.height ? ['300px', 'auto'] : ['auto', '300px'];
    return PREVIEW_CONTAINER_TEMPLATE({
        original: url_data.urls.original,
        regular: url_data.urls.regular,
        small: url_data.urls.small,
        width,
        height,
        index,
        src_attr: (source ? `src="${source}"` : ""),
    });
}

function RenderPreviewAttributes(url_data, image_info) {
    return PREVIEW_ATTRIBUTES_TEMPLATE({
        size: (image_info.type === 'image' ? '<span class="npisas-image-size">(loading...)</span>' : ""),
        width: url_data.width,
        height: url_data.height,
        extension: (image_info.type === 'image' ? image_info.ext.toUpperCase() : 'ugoira'),
    });
}

function RenderPreviewMatch(danbooru, url_data) {
    let image_url = url_data.urls.original;
    let link_class = danbooru.image_match(image_url) ? 'npisas-database-match' : 'npisas-database-mismatch';
    let post_ids = danbooru.image_post_ids(image_url);
    let posts = GetSessionPosts(post_ids);
    var link;
    if (posts.length > 0) {
        link = RenderPostIDsLink(posts, link_class, "Danbooru results:\n");
    } else {
        link = DANBOORU_NO_MATCH_LINK;
    }
    return PREVIEW_MATCH_TEMPLATE({link});
}

function RenderPreviewSearch(local, url_data, index) {
    let post_ids = local.index_post_ids(index);
    let posts = GetSessionPosts(post_ids);
    var result_link;
    if (posts.length) {
        result_link = RenderPostIDsLink(posts, 'npisas-database-match', "Local results:\n");
    } else {
        result_link = LOCAL_NO_MATCH_LINK;
    }
    let encoded_image_url = encodeURIComponent(url_data.urls.small);
    let search_url = `${NPISAS.domain}/iqdb_queries?url=${encoded_image_url}`;
    return PREVIEW_SEARCH_TEMPLATE({result_link, search_url});
}

function RenderPreviewUpload(artwork_id, url_data) {
    let encoded_artwork_url = encodeURIComponent('https://www.pixiv.net/artworks/' + artwork_id);
    let encoded_image_url = encodeURIComponent(url_data.urls.original);
    let upload_url = `${NPISAS.domain}${UPLOADS_PATH}?url=${encoded_image_url}&ref=${encoded_artwork_url}`;
    return PREVIEW_UPLOAD_TEMPLATE({upload_url});
}

function RenderPreviewDownload(artwork_id, url_data, index) {
    return PREVIEW_DOWNLOAD_TEMPLATE({
        artwork_id,
        index,
        original: url_data.urls.original,
    });
}

function RenderUnified(danbooru, local, image_url, index) {
    let source_ids = danbooru.index_post_ids(index);
    let local_ids = local.index_post_ids(index);
    let source_class = (
        source_ids.length > 0 ?
        (danbooru.image_match(image_url) ? 'npisas-database-match' : 'npisas-database-mismatch') :
        'npisas-database-no-match'
        );
    let local_class = (local_ids.length > 0 ? 'npisas-database-match' : 'npisas-database-no-match');
    return PREVIEW_UNIFIED_TEMPLATE({sources: source_ids.length, locals: local_ids.length, source_class, local_class});
}

function RenderPostIDsLink(posts, classname, title = "") {
    var href, text;
    if (posts.length === 1) {
        let post_id = posts[0].id;
        title += (posts.length > 0 ? RenderLinkTitle(posts[0]) : "");
        href = `${NPISAS.domain}/posts/${post_id}`;
        text = 'post #' + post_id;
    } else {
        title += (posts.length > 0 ? RenderMultiLinkTitle(posts) : "");
        let query = (NPISAS.custom_order_enabled && (NPISAS.user_data.level >= GOLD_LEVEL) ? '+order%3Acustom' : '');
        let post_ids_string = Utility.getObjectAttributes(posts, 'id').join(',');
        href = `${NPISAS.domain}/posts?tags=status%3Aany+id%3A${post_ids_string}${query}`;
        text = posts.length + ' sources';
    }
    return POST_IDS_TEMPLATE({
        classname,
        title: Template.normalizeText(title),
        href,
        text,
    });
}

function RenderIllustHelp(image_count) {
    if (image_count > 1) {
        return Utility.regexReplace(ILLUST_MENU_HELP, {
            LOCAL_RESULTS_HELP: LOCAL_RESULTS_MULTI_HELP,
            SEARCH_HELP: SEARCH_MULTI_HELP,
            UPLOAD_HELP: UPLOAD_MULTI_HELP,
            DOWNLOAD_HELP: DOWNLOAD_MULTI_HELP,
        });
    }
    return Utility.regexReplace(ILLUST_MENU_HELP, {
        LOCAL_RESULTS_HELP: LOCAL_RESULTS_SINGLE_HELP,
        SEARCH_HELP: SEARCH_SINGLE_HELP,
        UPLOAD_HELP: UPLOAD_SINGLE_HELP,
        DOWNLOAD_HELP: DOWNLOAD_SINGLE_HELP,
    });
}

function RenderPreviewHelp(image_count) {
    if (image_count > 1) {
        return Utility.regexReplace(PREVIEW_MENU_HELP, {
            LOCAL_RESULTS_HELP: LOCAL_RESULTS_MULTI_HELP,
            SEARCH_HELP: SEARCH_MULTI_HELP,
            UPLOAD_HELP: UPLOAD_MULTI_HELP,
            DOWNLOAD_HELP: DOWNLOAD_MULTI_HELP,
        });
    }
    return Utility.regexReplace(PREVIEW_MENU_HELP, {
        LOCAL_RESULTS_HELP: LOCAL_RESULTS_SINGLE_HELP,
        SEARCH_HELP: SEARCH_SINGLE_HELP,
        UPLOAD_HELP: UPLOAD_SINGLE_HELP,
        DOWNLOAD_HELP: DOWNLOAD_SINGLE_HELP,
    });
}

function RenderLinkTitle(post) {
    let tags = Utility.HTMLEscape(post.tags);
    let age = Utility.HTMLEscape(`age:"${Utility.timeAgo(post.created)}"`);
    let bytes = Utility.HTMLEscape(`size:"${Utility.readableBytes(post.size)}"`);
    let dimensions = Utility.HTMLEscape(`dimensions:"${post.width}x${post.height}"`);
    return `user:${post.uploadername} score:${post.score} favcount:${post.favcount} rating:${post.rating} ${age} ${bytes} ${dimensions} file_ext:${post.ext}&#13;${tags}`;
}

function RenderMultiLinkTitle(posts) {
    let title = [];
    posts.forEach((post) => {
        let age = Utility.HTMLEscape(`age:"${Utility.timeAgo(post.created)}"`);
        let bytes = Utility.HTMLEscape(`size:"${Utility.readableBytes(post.size)}"`);
        let dimensions = Utility.HTMLEscape(`dimensions:"${post.width}x${post.height}"`);
        title.push(`post #${post.id} - user:${post.uploadername} score:${post.score} favcount:${post.favcount} rating:${post.rating} ${age} ${bytes} ${dimensions} file_ext:${post.ext}`);
    });
    return title.join('&#13;');
}

function RenderHelp(help_text) {
    return `<a class="npisas-help-info npisas-expanded-link" title="${help_text}">&nbsp;?&nbsp;</a>`;
}

//Initialize functions

function InitializeUIStyle() {
    if (!Utility.hasStyle('jquery')) {
        const jquery_ui_css = GM_getResourceText('jquery_ui_css');
        Utility.setCSSStyle(jquery_ui_css, 'jquery');
    }
}

function InitializeSideMenu() {
    let $side_menu = $('#npisas-side-menu');
    $side_menu.find('[data-setting]').each((_, entry) => {
        let setting = $(entry).data('setting');
        if (NPISAS.user_settings[setting]) {
            $(entry).show();
        } else {
            $(entry).hide();
        }
    });
    if (NPISAS.artwork_statistics) {
        $('#npisas-menu-selection a[data-selector=statistics]').show();
    }
    if (NPISAS.artwork_tags) {
        $('#npisas-menu-selection a[data-selector=tags]').show();
    }
    let selected_menu = Storage.checkLocalData('npisas-side-selection', {default_val: 'info'});
    $side_menu.find(`#npisas-menu-selection a[data-selector=${selected_menu}]`).addClass('npisas-selected');
    $side_menu.find(`#npisas-content div[data-selector=${selected_menu}]`).show();
    let positions = Storage.getLocalData('npisas-menu-position');
    if (Utility.isHash(positions)) {
        $side_menu.css(positions);
    }
    GetManualRecords().then((total) => {
        $side_menu.find('#npisas-local-records').text(total);
    });
    UpdateDanbooruStatus();
}

function InitializeArtworkStats(page_artworks) {
    let table_html = RenderStatsTable(page_artworks);
    $('#npisas-artwork-stats-table').html(table_html);
}

function InitializeArtworkTags(page_artworks) {
    let tag_count = {};
    for (let artwork of page_artworks) {
        for (let tag of artwork.tags) {
            if (['R-18', 'R-18G'].includes(tag)) continue;
            tag_count[tag] ??= 0;
            tag_count[tag] += 1;
        }
    }
    let tags = Object.keys(tag_count).sort((a, b) => (tag_count[b] - tag_count[a])).slice(0, 10);
    var list_html = RenderTagsList(tags, tag_count);
    $('#npisas-artwork-tags-list').html(list_html);
    for (let tag of tags) {
        GetTag(tag).then((tag_data) => {
            if (tag_data.translation) {
                let $li = $(`#npisas-artwork-tags-list li[data-tag="${tag}"]`);
                $li.attr('title', tag_data.translation);
                $li.addClass('npisas-translated');
            }
        });
    }
}

function InitializeMainArtwork() {
    let $artwork = $('.npisas-main-artwork');
    let $aside = $('main + aside');
    Utility.recheckInterval({
        check: () => ($aside.find('img').length > 0 && $artwork.data('artwork-id') === NPISAS.artwork_id),
        success () {
            let last_visible = $aside.children().toArray().reverse().find((entry) => !['0px', ""].includes(getComputedStyle(entry).height));
            let top_offset = 20 + Utility.getElemPosition(last_visible).top - Utility.getElemPosition($aside.get(0)).top + last_visible.offsetHeight;
            let $container = $(`<div style="position: absolute; top: ${top_offset}px; left: 0;">${NPISAS_MAIN_MENU}</div>`);
            $container.find('.npisas-artwork-menu').attr('data-artwork-id', NPISAS.artwork_id);
            $('main + aside').css('position', 'relative').append($container);
            let {artwork_id, image_url, image_count} = GetArtworkInfo($artwork);
            $container.find('.npisas-menu-help').attr('title', RenderIllustHelp(image_count));
            let encoded_url = encodeURIComponent('https://www.pixiv.net/artworks/' + artwork_id);
            $container.find('.npisas-control-upload a').attr('href', `${NPISAS.domain}${UPLOADS_PATH}?url=${encoded_url}`);
            GetDanbooruResult(artwork_id).then((danbooru) => {
                InitializeResult($container, 'danbooru', image_url, danbooru);
            });
            GetLocalResult(artwork_id).then((local) => {
                InitializeResult($container, 'local', image_url, local);
            });
            if (NPISAS.count_views) {
                let storage_data = Storage.getIndexedSessionData('view-' + artwork_id, {default_val: {value: {count: 0}}});
                storage_data.expires = Utility.getExpires(Utility.one_year);
                storage_data.value.viewed = Date.now();
                storage_data.value.count += 1;
                SaveData('view-' + artwork_id, storage_data, 'danbooru');
            }
            if (NPISAS.display_ai_status) {
                $artwork.append(ILLUST_AI_INDICATOR);
            }
            if (NPISAS.display_artwork_views) {
                $artwork.append(ILLUST_VIEW_INDICATOR);
            }
        },
        interval: Utility.one_second,
    });
}

function DeinitializeMainArtwork() {
    let $artwork = $('.npisas-main-artwork');
    for (let name of $artwork.get(0).getAttributeNames()) {
        if (name.startsWith('data-')) {
            $artwork.attr(name, null);
        }
    }
    $artwork.removeData();
    delete $artwork[0].npisas_artwork_info;
    $artwork.attr({'npisas-artwork': null, viewed: null}).removeClass('npisas-artwork npisas-main-artwork npisas-illust-artwork npisas-single-artwork npisas-multi-artwork');
    let $image = $artwork.find('.npisas-image');
    for (let name of $image.get(0).getAttributeNames()) {
        if (name.startsWith('data-')) {
            $image.attr(name, null);
        }
    }
    $image.removeData();
    $image.attr('npisas-image', null).removeClass('npisas-image');
    $artwork.find('.npisas-captions').removeClass('npisas-captions');
    $artwork.find('.npisas-ai-marker, .npisas-viewed-marker').remove();
    $artwork.find('.npisas-image-container').removeClass('npisas-image-container');
    $('.npisas-main-menu').remove();
}

function InitializeGridArtwork(artwork) {
    //Query
    const $artwork = $(artwork);
    let artwork_id = Number($artwork.data('artwork-id'));
    let $image_container = $artwork.find('.npisas-image > div');
    let $image = $artwork.find('.npisas-image img');
    let {image_url, image_count} = GetArtworkInfo($artwork);
    let $preview_controls = $artwork.find('.npisas-preview-controls');
    //Container
    let $container = $(RenderMiniMenu(artwork_id, image_count, image_url));
    if (image_count === 1) {
        GetData('page-' + artwork_id, 'pixiv').then((storage_data) => {
            let image_info = GetImageURLInfo(image_url);
            if (storage_data && storage_data.value.date === image_info.date) {
                UpdateDownloadLink(artwork_id, storage_data.value);
            }
        });
    }
    GetDanbooruResult(artwork_id).then((danbooru) => {
        InitializeResult($container, 'danbooru', image_url, danbooru);
    });
    GetLocalResult(artwork_id).then((local) => {
        InitializeResult($container, 'local', image_url, local);
    });
    //Modify
    $artwork.parent().css('width', '300px');
    $artwork.css('width', '300px');
    $image_container.css({width: '300px', height: '300px'});
    if (NPISAS.display_ai_status) {
        $image_container.append(PREVIEW_AI_INDICATOR);
    }
    if (NPISAS.display_artwork_views) {
        $image_container.append(PREVIEW_VIEW_INDICATOR);
    }
    Debug.execute(() => {
        $image_container.append(DEBUG_INDICATORS);
    }, Debug.DEBUG);
    $image.each((_, image) => {
        image.onload = function () {
            let [preview_width, preview_height] = GetPreviewDimensions(image.naturalWidth, image.naturalHeight, 300);
            $image.css({width: preview_width + 'px', height: preview_height + 'px'});
        };
    });
    $image.attr('src', image_url);
    $preview_controls.append($container);
}

async function InitializeResult($menu, type, image_url, source, index = null) {
    let uniqueid = Utility.getUniqueID();
    var link_class;
    if (type === 'danbooru') {
        let funcname = (index ? 'image_match' : 'artwork_match');
        link_class = (source[funcname](image_url) ? 'npisas-database-match' : 'npisas-database-mismatch');
    } else {
        link_class = 'npisas-database-match';
    }
    let post_ids = (Utility.isInteger(index) ? source.index_post_ids(index) : source.post_ids);
    var html;
    if (post_ids.length) {
        let posts = await GetPosts(post_ids);
        let title = (type === 'danbooru' ? "Danbooru results:\n" : "Local results:\n");
        link_class += (index === null ? ' npisas-block-link' : "");
        html = RenderPostIDsLink(posts, link_class, title);
    } else {
        html = (type === 'danbooru' ? DANBOORU_NO_MATCH_LINK : LOCAL_NO_MATCH_LINK);
    }
    $menu.find(`.npisas-${type}-results`).html(html);
    $menu.find('.npisas-control-search').removeClass('npisas-active');
}

function InitializeUnified($container, type, image_url, source, index) {
    let post_ids = source.index_post_ids(index);
    var link_class;
    if (post_ids.length === 0) {
        link_class = 'npisas-database-no-match';
    } else if (type === 'danbooru') {
        link_class = (source.image_match(image_url) ? 'npisas-database-match' : 'npisas-database-mismatch');
    } else {
        link_class = 'npisas-database-match';
    }
    let $entry = $container.find(`.npisas-${type}-count`);
    $entry.removeClass('npisas-database-match npisas-database-mismatch npisas-database-no-match').addClass(link_class);
    $entry.children().text(post_ids.length);
}

async function InitializePreviewsDialog($dialog, artwork_id, image_url, user_id, tab, force) {
    let page_data = await GetIllustUrls(artwork_id, image_url, force);
    let danbooru = GetSessionDanbooruResult(artwork_id);
    let local = GetSessionLocalResult(artwork_id);
    let image_count = page_data.page.length;
    let $section = $(RenderPreviewsDialog(artwork_id, user_id, image_url, page_data.queried));
    let $images = $section.find('.npisas-preview-section');
    page_data.page.forEach((url_data, i) => {
        let image_info = GetImageURLInfo(url_data.urls.original);
        if (image_info === null) {
            Notice.error(`Unrecognized media: {url_data.urls.original}`);
            return;
        }
        let source = i < 4 ? url_data.urls.small : null;
        let $img_container = $(RenderPreviewContainer(url_data, source, i));
        $img_container.find('img').on(JSPLib.event.click, PopupMediaArtworkImage);
        $img_container.find('.npisas-preview-info').append(RenderPreviewAttributes(url_data, image_info));
        if (image_count > 1) {
            $img_container.find('.npisas-preview-source').append(RenderPreviewMatch(danbooru, url_data));
            $img_container.find('.npisas-preview-search').append(RenderPreviewSearch(local, url_data, i));
            $img_container.find('.npisas-preview-download').append(RenderPreviewDownload(artwork_id, url_data, i));
            $img_container.find('.npisas-preview-upload').append(RenderPreviewUpload(artwork_id, url_data));
            $img_container.find('.npisas-preview-unified').append(RenderUnified(danbooru, local, image_url, i));
        }
        $img_container.find(`.npisas-preview-${tab}`).show();
        $images.append($img_container);
        if (source !== null && image_info.type === 'image') {
            InitializeInfoSize($img_container, url_data.urls.original);
        }
    });
    if (image_count > 1) {
        $section.find(`.npisas-preview-selector[data-type="${tab}"]`).addClass('npisas-selector-active');
        $section.find('.npisas-preview-selectors a').on(JSPLib.event.click, DialogSectionSelect);
        if (image_count > 4) {
            $images.on('scroll.npisas', LoadPreviewImages);
        }
    } else {
        $section.find('.npisas-preview-selectors').hide();
        UpdateDownloadLink(artwork_id, page_data);
    }
    $dialog.children().remove();
    $dialog.append($section);
}

function InitializeInfoSize($img_container, original_url) {
    GetPixivImageSize(original_url).then((size) => {
        let $link = $img_container.find('.npisas-image-size');
        if (size > 0) {
            $link.text(`${Utility.readableBytes(size)}`);
        } else {
            $link.addClass('npisas-load-size').html('<span class="npisas-link">load size</span>');
        }
    });
}

//Dialog functions

function ShowPreviewsDialog(artwork_id, image_count, image_url, user_id, tab) {
    let danbooru_data = GetSessionDanbooruResultData(artwork_id);
    let local_data = GetSessionLocalResultData(artwork_id);
    if (danbooru_data === null || local_data === null) {
        Notice.notice("Data not loaded yet. Try again later.");
        return;
    }
    if (!NPISAS.previews_dialog[artwork_id]) {
        InitializeUIStyle();
        let $dialog = $(`<div class="npisas-search-dialog">${DIALOG_LOADING_HTML}</div>`);
        InitializePreviewsDialog($dialog, artwork_id, image_url, user_id, tab, false);
        let dialog_settings = Utility.deepCopy(PREVIEW_DIALOG_SETTINGS);
        if (image_count > 1) {
            dialog_settings.buttons = {
                'Check Danbooru' (event) {
                    DialogCheckPixivID(event);
                },
                'Upload artwork' (event) {
                    DialogUploadArtwork(event);
                },
                'Download all' (event) {
                    DialogDownloadAll(event);
                },
            };
            Utility.assignObjects(dialog_settings, {
                open () {
                    NPISAS.active_dialog = this;
                },
                close () {
                    NPISAS.active_dialog = null;
                },
            });
        }
        Utility.assignObjects(dialog_settings.buttons, {
            'Reload' () {
                DialogReloadPreviews(event);
            },
            'Close' () {
                $(this).dialog('close');
            },
        });
        $dialog.dialog(dialog_settings);
        NPISAS.previews_dialog[artwork_id] = $dialog;
        NPISAS.previews_tab = tab;
    } else {
        NPISAS.previews_dialog[artwork_id].find(`.npisas-preview-selector[data-type="${tab}"]`).click();
    }
    NPISAS.previews_dialog[artwork_id].dialog('open');
}

function ShowInfoDialog(artwork_id) {
    const printer = Debug.getFunctionPrint('ShowInfoDialog');
    if (!NPISAS.info_dialog[artwork_id]) {
        InitializeUIStyle();
        let $dialog = $(`<div class="npisas-info-dialog">${DIALOG_LOADING_HTML}</div>`);
        GetIllustInfo(artwork_id).then((illust_data) => {
            printer.log(illust_data);
            $dialog.children().remove();
            $dialog.append(RenderInfoDialog(illust_data));
        });
        $dialog.dialog(INFO_DIALOG_SETTINGS);
        NPISAS.info_dialog[artwork_id] = $dialog;
    }
    NPISAS.info_dialog[artwork_id].dialog('open');
}

//Update functions

function UpdateSideMenu() {
    let menu_shown = Storage.getLocalData('npisas-side-menu', {default_val: true});
    let $side_menu = $('#npisas-side-menu');
    if (menu_shown) {
        if (!NPISAS.side_menu_draggable) {
            $side_menu.draggable({
                handle: '#npisas-menu-header',
                stop: SaveMenuPosition,
            });
            NPISAS.side_menu_draggable = true;
        }
        $side_menu.show();
    } else {
        if (NPISAS.side_menu_draggable) {
            $side_menu.draggable('destroy');
            NPISAS.side_menu_draggable = false;
            Storage.removeLocalData('npisas-menu-position');
            $side_menu.css({top: "", left: ""});
        }
        $side_menu.hide();
    }
}

function UpdateDanbooruStatus() {
    let mode = Storage.getLocalData('npisas-danbooru-mode', {default_val: 'default'});
    $('#npisas-danbooru-status').text(mode);
    $('#npisas-danbooru-status').removeClass('npisas-default npisas-on npisas-off').addClass(`npisas-${mode}`);
}

function UpdatePreviewIndicatorControls() {
    let image_indicators = Storage.getLocalData('npisas-image-indicators', {default_val: true});
    let switch_type = (image_indicators ? 'shown' : 'hidden');
    DisplayControl(switch_type, PREVIEW_INDICATOR_CONTROLS, 'image-indicators');
}

function UpdateViewCountControls() {
    let count_views = NPISAS.count_views = Storage.getLocalData('npisas-view-counts', {default_val: true});
    let switch_type = (count_views ? 'enabled' : 'disabled');
    DisplayControl(switch_type, VIEW_COUNT_CONTROLS, 'view-counts');
}

function UpdateConfirmUploadControls() {
    NPISAS.confirm_upload = Storage.getLocalData('npisas-confirm-upload', {default_val: false});
    let switch_type = (NPISAS.confirm_upload ? 'yes' : 'no');
    DisplayControl(switch_type, CONFIRM_UPLOAD_CONTROLS, 'confirm-upload');
}

function UpdateConfirmDownloadControls() {
    NPISAS.confirm_download = Storage.getLocalData('npisas-confirm-download', {default_val: false});
    let switch_type = (NPISAS.confirm_download ? 'yes' : 'no');
    DisplayControl(switch_type, CONFIRM_DOWNLOAD_CONTROLS, 'confirm-download');
}

function UpdateImageIndicators() {
    let image_indicators = Storage.getLocalData('npisas-image-indicators', {default_val: true});
    let jquery_action = (image_indicators ? 'addClass' : 'removeClass');
    $('.npisas-grid')[jquery_action]('npisas-show-indicators');
    if (NPISAS.page === 'artwork') {
        $('main')[jquery_action]('npisas-show-indicators');
    }
}

function UpdateDownloadLink(artwork_id, page_data) {
    let $menu = $(`.npisas-artwork-menu[data-artwork-id="${artwork_id}"]`);
    $menu.find('.npisas-control-download a').attr('href', page_data.page[0].urls.original);
    $menu.find('.npisas-control-download').addClass('npisas-download-set');
}

//Database functions

function GetData(key, database, type = 'check') {
    if (!(key in NPISAS.storage_data[database])) {
        NPISAS.storage_data[database][key] = QueueStorageRequest(type, key, null, database);
    }
    return NPISAS.storage_data[database][key];
}

function SaveData(key, value, database, invalidate = true) {
    if (invalidate) {
        InvalidateCache(key, database);
        NPISAS.storage_data[database][key] = Promise.resolve(value);
    } else {
        NPISAS.storage_data[database][key] ??= Promise.resolve(value);
    }
    return QueueStorageRequest('save', key, value, database);
}

function SavePosts(mapped_posts) {
    mapped_posts.forEach((mapped_post) => {
        let expires_duration = PostExpiration(mapped_post.created);
        let data_expires = Utility.getExpires(expires_duration);
        SaveData('post-' + mapped_post.id, {value: mapped_post, expires: data_expires}, 'danbooru');
    });
}

function SaveUsers(mapped_users) {
    mapped_users.forEach((mapped_user) => {
        let data_expires = Utility.getExpires(USER_EXPIRES);
        SaveData('user-' + mapped_user.id, {value: mapped_user, expires: data_expires}, 'danbooru');
    });
}

function SavePostUsers(mapped_posts) {
    let all_users = mapped_posts.map((post) => ({id: post.uploaderid, name: post.uploadername}));
    let unique_users = RemoveDuplicates(all_users, 'id');
    SaveUsers(unique_users);
}

function InvalidateCache(key, database) {
    CACHE_STORAGE_TYPES.forEach((type) => {
        let queue_key = type + '-' + key + '-' + database;
        delete CACHED_STORAGE_REQUESTS[queue_key];
    });
}

async function GetItems(item_ids, storage_key, network_key, storage_database) {
    const printer = Debug.getFunctionPrint('GetItems');
    let storage_promises = item_ids.map((id) => GetData(storage_key + '-' + id, storage_database));
    let storage_data = await Promise.all(storage_promises);
    storage_data = storage_data.filter((data) => (data !== null));
    storage_data = Utility.getObjectAttributes(storage_data, 'value');
    let found_ids = Utility.getObjectAttributes(storage_data, 'id');
    let missing_ids = Utility.arrayDifference(item_ids, found_ids);
    let network_data = [];
    if (missing_ids.length) {
        network_data = await QueueNetworkRequest(network_key, missing_ids, 'danbooru');
        printer.log(network_key, missing_ids, network_data);
    }
    return [storage_data, network_data];
}

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

function GetIllust(artwork_id) {
    const printer = Debug.getFunctionPrint('GetIllust');
    GetIllust.memoized ??= {};
    if (!GetIllust.memoized[artwork_id]) {
        let p = GetIllust.memoized[artwork_id] = Utility.createPromise();
        GetData('illust-' + artwork_id, 'pixiv').then(async (storage_data) => {
            if (!storage_data) {
                let network_data = await QueueNetworkRequest('illust', String(artwork_id), 'pixiv');
                let is_ai = network_data.aiType === 2 || Utility.arrayHasIntersection(network_data.tags, AI_TAGS);
                let value = {
                    id: artwork_id,
                    ai: is_ai,
                    ero: network_data.xRestrict === 1,
                    guro: network_data.xRestrict === 2,
                    single: network_data.pageCount === 1,
                    //0 = illust; 1 = manga; 2 = ugoira;
                    type: network_data.illustType,
                    tags: network_data.tags,
                    timestamp: Utility.toTimeStamp(network_data.createDate),
                };
                SaveData('illust-' + artwork_id, {value, expires: Utility.getExpires(ILLUST_EXPIRES)}, 'pixiv');
                p.resolve(value);
                printer.log(artwork_id, value);
            } else {
                p.resolve(storage_data.value);
            }
        });
    }
    return GetIllust.memoized[artwork_id].promise;
}

async function GetIllustUrls(artwork_id, image_url = null, force_network = false) {
    const printer = Debug.getFunctionPrint('GetIllustUrls');
    GetIllustUrls.pages ??= {};
    if (!GetIllustUrls.pages[artwork_id] || force_network) {
        let storage_data = null;
        if (!force_network) {
            storage_data = await Storage.checkData('page-' + artwork_id, {max_expires: PAGE_EXPIRES, timeout: Utility.one_second, database: Storage.pixivstorage});
        }
        if (!storage_data || (image_url && storage_data.value.date !== GetImageURLInfo(image_url).date)) {
            let network_data = await Network.getJSON(`/ajax/illust/${artwork_id}/pages`);
            if (!network_data.body.error) {
                let image_info = GetImageURLInfo(network_data.body[0].urls.original);
                GetIllustUrls.pages[artwork_id] = {
                    value: {
                        id: image_info.id,
                        date: image_info.date,
                        page: network_data.body,
                        queried: Date.now(),
                    },
                    expires: Utility.getExpires(PAGE_EXPIRES),
                };
                SaveData('page-' + artwork_id, GetIllustUrls.pages[artwork_id], 'pixiv');
                printer.log(artwork_id, GetIllustUrls.pages[artwork_id]);
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
    const printer = Debug.getFunctionPrint('GetIllustInfo');
    GetIllustInfo.memoized ??= {};
    if (!GetIllustInfo.memoized[artwork_id] || force_network) {
        let storage_data = !force_network ?
            (await GetData('info-' + artwork_id, 'pixiv')) :
            null;
        if (!storage_data) {
            let network_data = await Network.getJSON(`/ajax/illust/${artwork_id}`);
            if (!network_data.body.error) {
                let tags = network_data.body.tags.tags.map((tag_data) => {
                    return {
                        name: tag_data.tag,
                        deletable: tag_data.deletable,
                        translation: Utility.nullIfEmpty(tag_data.translation?.en),
                    };
                });
                let date = network_data.body.userIllusts[String(artwork_id)]?.createDate ?? network_data.body.createDate;
                GetIllustInfo.memoized[artwork_id] = {
                    value: {
                        id: artwork_id,
                        user_id: Number(network_data.body.userId),
                        user_name: network_data.body.userName,
                        user_account: network_data.body.userAccount,
                        title: network_data.body.title,
                        description: network_data.body.description,
                        date: new Date(date).toISOString(),
                        bookmarks: network_data.body.bookmarkCount,
                        type: network_data.body.illustType === 0 ? 'illust' : 'manga',
                        reading: network_data.body.bookStyle === 0 ? 'scroll' : 'book',
                        original: network_data.body.isOriginal,
                        request: Number(network_data.body.request?.request.requestId) || null,
                        ai: network_data.body.aiType === 2,
                        queried: Date.now(),
                        tags,
                    },
                    expires: Utility.getExpires(INFO_EXPIRES),
                };
                SaveData('info-' + artwork_id, GetIllustInfo.memoized[artwork_id], 'pixiv');
                printer.log(artwork_id, GetIllustInfo.memoized[artwork_id]);
            } else {
                GetIllustInfo.memoized[artwork_id] = {};
            }
        } else {
            GetIllustInfo.memoized[artwork_id] = storage_data;
        }
    }
    return GetIllustInfo.memoized[artwork_id].value;
}

function GetTag(tag) {
    GetTag.memoized ??= {};
    if (!GetTag.memoized[tag]) {
        let p = GetTag.memoized[tag] = Utility.createPromise();
        GetData('tag-' + tag, 'pixiv').then(async (storage_data) => {
            if (!storage_data) {
                let network_data = await Network.getJSON(`/ajax/search/tags/${tag}`);
                if (!network_data.body.error) {
                    let tag_translation = network_data.body.tagTranslation[tag] ?? {};
                    let value = {
                        translation: Utility.nullIfEmpty(tag_translation.en),
                        image: Utility.nullIfEmpty(network_data.body.pixpedia.image),
                        // eslint-disable-next-line dot-notation
                        abstract: Utility.nullIfEmpty(network_data.body.pixpedia.abstract),
                    };
                    SaveData('tag-' + tag, {value, expires: Utility.getExpires(TAG_EXPIRES)}, 'pixiv');
                    p.resolve(value);
                } else {
                    p.resolve({translation: null});
                }
            } else {
                p.resolve(storage_data.value);
            }
        });
    }
    return GetTag.memoized[tag].promise;
}

async function GetPixivImageSize(image_url) {
    GetPixivImageSize.memoized ??= {};
    if (!GetPixivImageSize.memoized[image_url]) {
        let data = await Storage.checkData('image-size-' + image_url, {validator: () => true, max_expires: Utility.one_month, database: Storage.pixivstorage});
        if (!data) {
            let ajax_options = {
                beforeSend (request) {
                    request.setRequestHeader('referer', 'https://www.pixiv.net/');
                },
            };
            let size = await Network.getDataSize(image_url, {ajax_options});
            if (size > 0) {
                Storage.saveData('image-size-' + image_url, {expires: Utility.getExpires(Utility.one_month), value: size}, {database: Storage.pixivstorage});
            }
            GetPixivImageSize.memoized[image_url] = size;
        } else {
            GetPixivImageSize.memoized[image_url] = data.value;
        }
    }
    return GetPixivImageSize.memoized[image_url];
}

async function GetManualRecords(force = false) {
    if (force || Concurrency.checkTimeout('npisas-length-recheck', LENGTH_RECHECK_INTERVAL)) {
        let manual_records = 0;
        await Storage.pixivstorage.iterate((data, key) => {
            if (key.startsWith('local-') && data.value.length > 0) {
                manual_records++;
            }
        });
        Storage.setLocalData('npisas-database-length', manual_records);
        Concurrency.setRecheckTimeout('npisas-length-recheck', LENGTH_RECHECK_INTERVAL);
    }
    return Storage.getLocalData('npisas-database-length', {default_val: 0});
}

async function GetDanbooruResult(artwork_id) {
    const printer = Debug.getFunctionPrint('GetDanbooruResult');
    GetDanbooruResult.memoized ??= {};
    let storage_data = await QueueStorageRequest('check', 'danbooru-' + artwork_id, null, 'pixiv');
    if (!storage_data) {
        let network_posts = await QueueNetworkRequest('artworks', [artwork_id], 'danbooru');
        if (network_posts.length) {
            let mapped_posts = network_posts.map(MapPost);
            SavePosts(mapped_posts);
            SavePostUsers(mapped_posts);
            GetDanbooruResult.memoized[artwork_id] = {value: DanbooruSource.map(mapped_posts), expires: Utility.getExpires(FOUND_ARTWORK_EXPIRES)};
        } else {
            GetDanbooruResult.memoized[artwork_id] = {value: [], expires: Utility.getExpires(MISSING_ARTWORK_EXPIRES)};
        }
        SaveData('danbooru-' + artwork_id, GetDanbooruResult.memoized[artwork_id], 'pixiv');
        printer.log(artwork_id, GetDanbooruResult.memoized[artwork_id]);
    } else {
        GetDanbooruResult.memoized[artwork_id] = storage_data;
    }
    return new DanbooruSource(GetDanbooruResult.memoized[artwork_id].value);
}

async function GetLocalResult(artwork_id) {
    const printer = Debug.getFunctionPrint('GetLocalResult');
    GetLocalResult.memoized ??= {};
    let storage_data = await QueueStorageRequest('check', 'local-' + artwork_id, null, 'pixiv');
    if (!storage_data) {
        GetLocalResult.memoized[artwork_id] = {value: [], expires: 0};
        SaveData('local-' + artwork_id, GetLocalResult.memoized[artwork_id], 'pixiv');
        printer.log(artwork_id, GetLocalResult.memoized[artwork_id]);
    } else {
        GetLocalResult.memoized[artwork_id] = storage_data;
    }
    return new LocalSource(GetLocalResult.memoized[artwork_id].value);
}

//Network functions

function DownloadMediaFile(file_url, download_name, extension) {
    const printer = Debug.getFunctionPrint('DownloadMediaFile');
    const mime_types = {
        jpg: 'image/jpeg',
        png: 'image/png',
        mp4: 'video/mp4',
    };
    let p = Utility.createPromise();
    let mime_type = mime_types[extension];
    let ajax_options = {
        beforeSend (request) {
            request.setRequestHeader('referer', 'https://www.pixiv.net/');
        },
        timeout: 0,
    };
    if (mime_type) {
        printer.log("Saving", file_url, '->', download_name);
        Network.getData(file_url, {ajax_options}).then(
            //Success
            (blob) => {
                let image_blob = blob.slice(0, blob.size, mime_type);
                saveAs(image_blob, download_name);
                printer.log("Saved", extension, "file as", mime_type, "with size of", blob.size);
                p.resolve(true);
            },
            //Failure
            (e) => {
                let error_text = 'Check the debug console.';
                if (Utility.isInteger(e)) {
                    error_text = 'HTTP ' + e;
                } else {
                    Debug.error("DownloadMediaFile error:", e);
                }
                Notice.error(`Error downloading image: ${error_text}`);
            }
        ).always(() => {
            p.resolve(null);
        });
    } else {
        p.resolve(null);
    }
    return p.promise;
}

async function CheckSimilar(artwork_id, image_url, index) {
    let {danbooru_results, local_results} = await CheckIQDB(image_url);
    let iqdb_post_ids = Utility.getNestedObjectAttributes(local_results, ['post', 'id']) ?? [];
    var local;
    if (!IsQuerySettingEnabled('auto_save')) {
        local = PromptPostIDs(artwork_id, CONFIRM_SAVE_PROMPT, iqdb_post_ids, index);
    } else {
        local = GetSessionLocalResult(artwork_id);
        if (Utility.arrayHasDifference(iqdb_post_ids, local.index_post_ids(index))) {
            local.merge(iqdb_post_ids, index);
            Storage.saveData('local-' + artwork_id, {value: local.data, expires: 0}, {database: Storage.pixivstorage});
        }
    }
    let danbooru = GetSessionDanbooruResult(artwork_id);
    if (danbooru_results.length) {
        //For when a match is found in-between danbooru requeries
        let initial_size = danbooru.data.length;
        danbooru.merge(danbooru_results);
        if (danbooru.data.length !== initial_size) {
            Storage.saveData('danbooru-' + artwork_id, {value: danbooru.data, expires: Utility.getExpires(FOUND_ARTWORK_EXPIRES)}, {database: Storage.pixivstorage});
        } else {
            danbooru = null;
        }
    }
    return {local, danbooru};
}

async function CheckPixivID(artwork_id) {
    let data = await Danbooru.queryPageItems('posts', 100, {url_addons: {tags: 'status:any pixiv_id:' + artwork_id, only: POST_FIELDS}, domain: NPISAS.domain, notify: true});
    var danbooru;
    if (data.length > 0) {
        let mapped_posts = data.map(MapPost);
        SavePosts(mapped_posts);
        SavePostUsers(mapped_posts);
        danbooru = new DanbooruSource(mapped_posts, 'post');
        Storage.saveData('danbooru-' + artwork_id, {value: danbooru.data, expires: Utility.getExpires(FOUND_ARTWORK_EXPIRES)}, {database: Storage.pixivstorage});
    } else {
        danbooru = new DanbooruSource([]);
        Storage.saveData('danbooru-' + artwork_id, {value: danbooru.data, expires: Utility.getExpires(MISSING_ARTWORK_EXPIRES)}, {database: Storage.pixivstorage});
    }
    return danbooru;
}

async function CheckIQDB(image_url) {
    let params = {
        url: image_url,
        similarity: NPISAS.similarity_cutoff,
        limit: NPISAS.results_returned,
        expires_in: '300s',
    };
    let image_info = GetImageURLInfo(image_url);
    let iqdb_results = await Danbooru.query('iqdb_queries', params, {default_val: [], domain: NPISAS.domain, notify: true});
    let post_data = Utility.getObjectAttributes(iqdb_results, 'post');
    let unique_posts = RemoveDuplicates(post_data, 'id');
    let mapped_posts = unique_posts.map(MapPost);
    let uploader_ids = Utility.arrayUnique(Utility.getObjectAttributes(mapped_posts, 'uploaderid'));
    let user_data = await GetUsers(uploader_ids);
    mapped_posts.forEach((post) => {
        let user = user_data.find((user) => (user.id === post.uploaderid));
        post.uploadername = user.name;
    });
    SavePosts(mapped_posts);
    let valid_results = iqdb_results.filter((result) => (result.post !== undefined && result.post.id !== undefined));
    let filter_results = valid_results.filter((result) => (parseFloat(result.score) >= NPISAS.similarity_cutoff));
    let sorted_results = filter_results.sort((resulta, resultb) => (resultb.score - resulta.score)).slice(0, NPISAS.results_returned);
    let danbooru_results = [];
    let local_results = [];
    sorted_results.forEach((similar_result) => {
        let score = similar_result.score;
        let post_id = similar_result.post.id;
        let post = mapped_posts.find((post) => (post.id === post_id));
        let result = {
            score,
            post,
        };
        let domain = Utility.getDomainName(post.source, {level: 2});
        if (domain === 'pximg.net') {
            let post_info = GetImageURLInfo(post.source);
            if (post_info?.id === image_info.id) {
                danbooru_results.push(post);
            } else {
                local_results.push(result);
            }
        } else {
            local_results.push(result);
        }
    });
    return {danbooru_results, local_results};
}

//DOM data functions

function GetArtworkInfo($artwork) {
    if (!$artwork[0].npisas_artwork_info) {
        let artwork_id = Number($artwork.data('artwork-id'));
        let user_id = Number($artwork.data('user-id') || "");
        let artwork_type = $artwork.attr('npisas-artwork');
        let preview = artwork_type === 'preview';
        let $image = $artwork.find('.npisas-image');
        let image_data = $image.data();
        if (Object.keys(image_data).length === 0 || !image_data.date) {
            let image = $image.find('img').get(0);
            if (!image) {
                return {artwork_id, user_id, artwork_type, preview, image_url: null};
            }
            image_data = GetImageURLInfo(image.src);
        }
        var image_format;
        if (Utility.isInteger(image_data.order)) {
            image_format = preview ? 'https://i.pximg.net/c/540x540_70/img-master/img/%s/%s_p0_master1200.jpg' : 'https://i.pximg.net/img-master/img/%s/%s_p0_master1200.jpg';
        } else {
            image_format = preview ? 'https://i.pximg.net/c/540x540_70/img-master/img/%s/%s_master1200.jpg' : 'https://i.pximg.net/img-master/img/%s/%s_master1200.jpg';
        }
        let image_url = Utility.sprintf(image_format, image_data.date, artwork_id);
        let image_count = $image.data('image-count') ?? $artwork.data('pages');
        let image_type = $image.data('type') ?? 'unknown';
        $artwork[0].npisas_artwork_info = {artwork_id, user_id, artwork_type, preview, image_url, image_count, image_type};
    }
    return $artwork[0].npisas_artwork_info;
}

function GetArtworkTimestamp(artwork) {
    let date = $(artwork).find('.npisas-image').data('date');
    let [year, month, day, hour, minute, second] = date.split('/');
    let timestring = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
    return Utility.toTimeStamp(timestring);
}

function GetMenuPreload(event) {
    let $link = $(event.currentTarget);
    let $menu = $link.closest('.npisas-artwork-menu');
    let artwork_id = Number($menu.data('artwork-id'));
    let $artwork = $(`.npisas-artwork[data-artwork-id="${artwork_id}"]`);
    let {user_id, artwork_type, preview, image_url, image_count} = GetArtworkInfo($artwork);
    return {$link, $menu, $artwork, artwork_id, user_id, artwork_type, preview, image_url, image_count};
}

function GetPreviewPreload(event) {
    let $link = $(event.currentTarget);
    let $container = $link.closest('.npisas-preview-container');
    let $previews = $container.closest('.npisas-preview-section');
    let $dialog = $previews.closest('.npisas-illust-previews');
    let $content = $dialog.closest('.ui-dialog-content');
    let $window = $content.closest('.npisas-dialog');
    let artwork_id = $dialog.data('artwork-id');
    let $menu = $(`.npisas-artwork-menu[data-artwork-id="${artwork_id}"]`);
    let dialog = $content.dialog('instance');
    let {original: original_url, regular: regular_url, small: small_url, index} = $container.data();
    return {$link, $container, $previews, $dialog, $content, $window, $menu, artwork_id, dialog, original_url, regular_url, small_url, index};
}

function GetDialogPreload(event) {
    let $button = $(event.currentTarget);
    let $window = $button.closest('.npisas-dialog');
    let $content = $window.find('.ui-dialog-content');
    let instance = $content.dialog('instance');
    let $dialog = $content.find('.npisas-illust-previews');
    let $section = $dialog.find('.npisas-preview-section');
    let $previews = $section.find('.npisas-preview-container');
    let {artworkId: artwork_id, userId: user_id, imageUrl: image_url} = $dialog.data();
    let $menu = $(`.npisas-artwork-menu[data-artwork-id="${artwork_id}"]`);
    return {$button, $previews, $section, $dialog, $content, $window, $menu, artwork_id, user_id, image_url, instance};
}

//Event handlers

function ToggleSideMenu() {
    let menu_shown = Storage.getLocalData('npisas-side-menu', {default_val: true});
    Storage.setLocalData('npisas-side-menu', !menu_shown);
    UpdateSideMenu();
}

function SaveMenuPosition() {
    let {left, top} = $('#npisas-side-menu').get(0).style;
    if (left !== "" && top !== "") {
        Storage.setLocalData('npisas-menu-position', {left, top});
    }
}

function SideMenuSelection(event) {
    let $link = $(event.target);
    let selected_menu = $link.data('selector');
    $('#npisas-menu-selection > a').removeClass('npisas-selected');
    $(`#npisas-menu-selection a[data-selector=${selected_menu}]`).addClass('npisas-selected');
    $('#npisas-content > div').hide();
    $(`#npisas-content div[data-selector=${selected_menu}]`).show();
    Storage.setLocalData('npisas-side-selection', selected_menu);
}

function ToggleDanbooruStatus() {
    let old_mode = Storage.getLocalData('npisas-danbooru-mode', {default_val: 'default'});
    let old_index = DANBOORU_MODES.indexOf(old_mode);
    let new_index = (old_index + 1) % DANBOORU_MODES.length;
    let new_mode = DANBOORU_MODES[new_index];
    Storage.setLocalData('npisas-danbooru-mode', new_mode);
    Storage.removeLocalData('npisas-danbooru-down');
    if (['default', 'on'].includes(new_mode)) {
        Danbooru.down = false;
    } else {
        Danbooru.down = true;
    }
    if (['on', 'off'].includes(new_mode)) {
        Storage.setLocalData('npisas-danbooru-down', new_mode === 'off');
    }
    UpdateDanbooruStatus();
}

function QueryLocalRecords() {
    Notice.notice("Querying records.");
    GetManualRecords(true).then((total) => {
        $('#npisas-local-records').text(total);
        Notice.notice("Records updated.");
    });
}

function ErrorMessages() {
    if (Network.error_messages.length) {
        let help_text = Network.error_messages.map((entry) => `HTTP Error ${entry[1]}: ${entry[2]}<br>&emsp;&emsp;=> ${entry[0]}`).join('<br><br>');
        Notice.error(help_text);
    } else {
        Notice.notice("No error messages.");
    }
}

function ToggleConfirmUpload() {
    Storage.setLocalData('npisas-confirm-upload', !NPISAS.confirm_upload);
    UpdateConfirmUploadControls();
}

function ToggleConfirmDownload() {
    Storage.setLocalData('npisas-confirm-download', !NPISAS.confirm_download);
    UpdateConfirmDownloadControls();
}

function ToggleImageIndicators() {
    let image_indicators = Storage.getLocalData('npisas-image-indicators', {default_val: true});
    Storage.setLocalData('npisas-image-indicators', !image_indicators);
    UpdateImageIndicators();
    UpdatePreviewIndicatorControls();
}

function ToggleViewCounts() {
    let count_views = Storage.getLocalData('npisas-view-counts', {default_val: true});
    Storage.setLocalData('npisas-view-counts', !count_views);
    UpdateViewCountControls();
    if (!count_views) {
        for (let artwork_id of NPISAS.skipped_views) {
            let $artwork = $(`.npisas-artwork[data-artwork-id="${artwork_id}"][viewed="disabled"]`);
            NPISAS.intersection_observer.observe($artwork.get(0));
            $artwork.attr('viewed', 'false');
        }
        NPISAS.skipped_views.clear();
    }
}

function MenuShowInfo(event) {
    let {artwork_id} = GetMenuPreload(event, 'npisas-show-info');
    ShowInfoDialog(artwork_id);
}

function MenuDanbooruResultsControl(event) {
    if (event.ctrlKey) return;
    let {artwork_id, image_count, image_url, user_id} = GetMenuPreload(event);
    ShowPreviewsDialog(artwork_id, image_count, image_url, user_id, 'source');
}

function MenuLocalResultsControl(event) {
    if (event.ctrlKey) return;
    let {$menu, artwork_id, image_url, user_id, image_count} = GetMenuPreload(event);
    if (image_count === 1) {
        let storage_data = GetSessionLocalResultData(artwork_id);
        let local = PromptPostIDs(artwork_id, MANUAL_ADD_PROMPT, [], 0);
        if (storage_data.value.length !== local.post_ids.length) {
            InitializeResult($menu, 'local', image_url, local);
        }
    } else {
        ShowPreviewsDialog(artwork_id, image_count, image_url, user_id, 'unified');
    }
    event.preventDefault();
}

function MenuSearchControl(event) {
    if (event.ctrlKey) return;
    let {$link, $menu, artwork_id, image_url, image_count, user_id} = GetMenuPreload(event);
    if (image_count > 1) {
        ShowPreviewsDialog(artwork_id, image_count, image_url, user_id, 'search');
    } else {
        if (!NPISAS.search_running.has(artwork_id)) {
            NPISAS.search_running.add(artwork_id);
            $menu.find('.npisas-local-results').html('loading...');
            $link.addClass('npisas-active');
            CheckSimilar(artwork_id, image_url, 0).then(async ({local, danbooru}) => {
                let p1 = InitializeResult($menu, 'local', image_url, local);
                var p2;
                if (danbooru) {
                    p2 = InitializeResult($menu, 'danbooru', image_url, danbooru);
                } else {
                    p2 = Promise.resolve(null);
                }
                await Promise.all([p1, p2]);
                // eslint-disable-next-line
                NPISAS.search_running.delete(artwork_id);
            });
        }
    }
    event.preventDefault();
}

function MenuSearchAlternate(event) {
    if (event.ctrlKey) return;
    let {$link, $menu, artwork_id, image_url} = GetMenuPreload(event);
    if (!NPISAS.search_running.has(artwork_id)) {
        NPISAS.search_running.add(artwork_id);
        DestroyPreviewsDialog(artwork_id);
        $menu.find('.npisas-danbooru-results').html('loading...');
        $link.addClass('npisas-active');
        CheckPixivID(artwork_id).then(async (danbooru) => {
            await InitializeResult($menu, 'danbooru', image_url, danbooru);
            // eslint-disable-next-line
            NPISAS.search_running.delete(artwork_id);
        });
    }
    event.preventDefault();
}

function MenuUploadControl(event) {
    if (event.ctrlKey) return;
    let {$menu, artwork_id, image_url, image_count, user_id} = GetMenuPreload(event);
    if (image_count > 1) {
        ShowPreviewsDialog(artwork_id, image_count, image_url, user_id, 'upload');
    } else {
        if (!NPISAS.confirm_upload || confirm("Upload artwork?")) {
            $menu.find('.npisas-control-upload a').get(0).cloneNode().click();
        }
    }
    event.preventDefault();
}

function MenuUploadAlternate(event) {
    if (event.ctrlKey) return;
    let {$menu} = GetMenuPreload(event);
    if (!NPISAS.confirm_upload || confirm("Upload artwork?")) {
        $menu.find('.npisas-control-upload a').get(0).cloneNode().click();
    }
    event.preventDefault();
}

function MenuDownloadControl(event) {
    let {$link, artwork_id, image_url, image_count, user_id} = GetMenuPreload(event);
    if (event.ctrlKey) {
        if (image_count === 1 && $link.find('a[href]').length === 0) {
            $link.addClass('npisas-active');
            GetIllustUrls(artwork_id, image_url).then((page_data) => {
                UpdateDownloadLink(artwork_id, page_data);
                $link.removeClass('npisas-active');
            });
        }
        return;
    }
    if (image_count > 1) {
        ShowPreviewsDialog(artwork_id, image_count, image_url, user_id, 'download');
    } else if (!NPISAS.confirm_download || confirm("Download all?")) {
        $link.addClass('npisas-active');
        DownloadAll(artwork_id, image_url).then((page_data) => {
            UpdateDownloadLink(artwork_id, page_data);
            $link.removeClass('npisas-active');
        });
    }
}

function MenuDownloadAlternate(event) {
    if (event.ctrlKey) return;
    let {$link, artwork_id, image_url} = GetMenuPreload(event);
    if (!NPISAS.confirm_download || confirm("Download all?")) {
        $link.addClass('npisas-active');
        DownloadAll(artwork_id, image_url).then((page_data) => {
            UpdateDownloadLink(artwork_id, page_data);
            $link.removeClass('npisas-active');
        });
    }
    event.preventDefault();
}

function DialogSectionSelect(event) {
    let type = $(event.target).data('type');
    let $section = $(event.target).closest('.npisas-illust-previews');
    $section.find('.npisas-preview-addons > div').hide();
    $section.find(`.npisas-preview-${type}`).show();
    $section.find('.npisas-preview-selector').removeClass('npisas-selector-active');
    $(event.target).addClass('npisas-selector-active');
    NPISAS.previews_tab = type;
}

function PreviewLocalResultsControl(event) {
    if (event.ctrlKey) return;
    let {$container, $menu, artwork_id, index, small_url} = GetPreviewPreload(event);
    let storage_data = GetSessionLocalResultData(artwork_id);
    let local = PromptPostIDs(artwork_id, MANUAL_ADD_PROMPT, [], index);
    if (storage_data.value.length !== local.post_ids.length) {
        InitializeResult($menu, 'local', small_url, local);
        InitializeResult($container, 'local', small_url, local, index);
        InitializeUnified($container, 'local', small_url, local, index);
    }
    event.preventDefault();
}

function PreviewSearchControl(event) {
    if (event.ctrlKey) return;
    let {$link, $container, $previews, $menu, artwork_id, small_url, index} = GetPreviewPreload(event);
    NPISAS.image_search[artwork_id] ??= new Set();
    if (!NPISAS.image_search[artwork_id].has(index)) {
        NPISAS.image_search[artwork_id].add(index);
        $container.find('.npisas-local-results').html('loading...');
        $link.addClass('npisas-active');
        CheckSimilar(artwork_id, small_url, index).then(async ({local, danbooru}) => {
            let p1 = InitializeResult($menu, 'local', small_url, local);
            let p2 = InitializeResult($container, 'local', small_url, local, index);
            InitializeUnified($container, 'local', small_url, local, index);
            var p3, p4;
            if (danbooru) {
                p3 = InitializeResult($menu, 'danbooru', small_url, danbooru);
                for (let idx of danbooru.indexes) {
                    let $preview = $previews.find(`.npisas-preview-container[data-index="${idx}"]`);
                    p3 = InitializeResult($preview, 'danbooru', small_url, danbooru, idx);
                    InitializeUnified($preview, 'danbooru', small_url, danbooru, idx);
                }
            } else {
                p3 = p4 = Promise.resolve(null);
            }
            await Promise.all([p1, p2, p3, p4]);
            // eslint-disable-next-line
            NPISAS.image_search[artwork_id].delete(index);
            $link.removeClass('npisas-active');
        });
    }
    event.preventDefault();
}

function PreviewDownloadControl(event) {
    if (event.ctrlKey) return;
    let {$link, original_url} = GetPreviewPreload(event);
    let image_info = GetImageURLInfo(original_url);
    let download_file = `${image_info.id}_p${image_info.order}.${image_info.ext}`;
    $link.addClass('npisas-active');
    DownloadMediaFile(original_url, download_file, image_info.ext).then(() => {
        $link.removeClass('npisas-active');
    });
    event.preventDefault();
}

function PreviewUploadControl(event) {
    if (event.ctrlKey) return;
    let {$link} = GetPreviewPreload(event);
    $link.find('a').get(0).cloneNode().click();
    event.preventDefault();
}

function DialogCheckPixivID(event) {
    let {artwork_id, image_url, $button, $menu, $previews} = GetDialogPreload(event);
    if (!NPISAS.search_running.has(artwork_id)) {
        NPISAS.search_running.add(artwork_id);
        $button.addClass('ui-state-active').attr('disabled', 'disabled');
        CheckPixivID(artwork_id).then((danbooru) => {
            let promise_array = [];
            promise_array.push(InitializeResult($menu, 'danbooru', image_url, danbooru));
            $previews.each((index, container) => {
                let $container = $(container);
                InitializeUnified($container, 'danbooru', image_url, danbooru, index);
                promise_array.push(InitializeResult($container, 'danbooru', image_url, danbooru, index));
            });
            Promise.all(promise_array).then(() => {
                $button.removeClass('ui-state-active').attr('disabled', null);
                // eslint-disable-next-line
                NPISAS.search_running.delete(artwork_id);
            });
        });
    }
}

function DialogUploadArtwork(event) {
    let {$content} = GetDialogPreload(event);
    $content.find('.npisas-upload-all').get(0).click();
}

function DialogDownloadAll(event) {
    let {$button, artwork_id, $menu} = GetDialogPreload(event);
    $button.addClass('ui-state-active').attr('disabled', 'disabled');
    DownloadAll(artwork_id).then((page_data) => {
        $button.removeClass('ui-state-active').attr('disabled', null);
        UpdateDownloadLink(artwork_id, page_data);
    });
}

function DialogReloadPreviews(event) {
    let {$button, $content, artwork_id, image_url, user_id} = GetDialogPreload(event);
    $content.children().remove();
    $content.append(DIALOG_LOADING_HTML);
    $button.addClass('ui-state-active').attr('disabled', 'disabled');
    InitializePreviewsDialog($content, artwork_id, image_url, user_id, NPISAS.previews_tab, true).then(() => {
        $button.removeClass('ui-state-active').attr('disabled', null);
    });
}

function DialogReloadInfo(event) {
    const printer = Debug.getFunctionPrint('DialogReloadInfo');
    let $container = $(event.currentTarget).closest('.npisas-dialog').find('.npisas-illust-info');
    let artwork_id = $container.data('artwork-id');
    GetIllustInfo(artwork_id, true).then((illust_data) => {
        printer.log(illust_data);
        $container.html(RenderInfoDialog(illust_data));
    });
}

async function DownloadAll(artwork_id, image_url) {
    let data = await GetIllustUrls(artwork_id, image_url);
    for (let i = 0; i < data.page.length; i++) {
        let original_url = data.page[i].urls.original;
        let image_info = GetImageURLInfo(original_url);
        let download_file = `${image_info.id}_p${image_info.order}.${image_info.ext}`;
        await DownloadMediaFile(original_url, download_file, image_info.ext);
    }
    return data;
}

function PreviewLoadSize(event) {
    let {$link, original_url} = GetPreviewPreload(event);
    let ajax_options = {
        beforeSend (request) {
            request.setRequestHeader('referer', 'https://www.pixiv.net/');
        },
    };
    Network.getData(original_url, {ajax_options}).then((data) => {
        if (Utility.isInteger(data?.size)) {
            Storage.saveData('image-size-' + original_url, {expires: Utility.getExpires(Utility.one_month), value: data.size}, {database: Storage.pixivstorage});
            $link.text(Utility.readableBytes(data.size));
        } else {
            $link.text('(error)').css('color', 'red');
        }
    });
    $link.removeClass('npisas-load-size').text('(loading...)');
}

function PopupMediaArtworkImage(event) {
    let $container = $(event.currentTarget).closest('.npisas-preview-container');
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
        let $img_container = $(image).closest('.npisas-preview-container');
        let {small, original} = $img_container.data();
        if (i < load_images && !image.src) {
            $(image).attr('src', small);
            InitializeInfoSize($img_container, original);
        }
    });
    if (load_images >= $images.length) {
        $(event.currentTarget).closest('.npisas-dialog').find('.npisas-preview-section').off('scroll.npisas');
    }
}

function CheckViews(entries, observer) {
    let printer = Debug.getFunctionPrint('CheckViews');
    entries.forEach((entry) => {
        let expires = Utility.getExpires(Utility.one_year);
        let viewed = Date.now();
        if (entry.isIntersecting) {
            let $artwork = $(entry.target);
            let artwork_id = $artwork.attr('data-artwork-id');
            printer.logLevel("Viewable tweet:", artwork_id, entry, Debug.DEBUG);
            if (NPISAS.count_views) {
                if (!NPISAS.recorded_views.has(artwork_id)) {
                    GetData('view-' + artwork_id, 'danbooru').then((storage_data) => {
                        storage_data ??= {value: {count: 0}};
                        storage_data.expires = expires;
                        storage_data.value.viewed = viewed;
                        storage_data.value.count += 1;
                        SaveData('view-' + artwork_id, storage_data, 'danbooru');
                    });
                    NPISAS.recorded_views.add(artwork_id);
                }
                $artwork.attr('viewed', 'true');
            } else {
                NPISAS.skipped_views.add(artwork_id);
                $artwork.attr('viewed', 'disabled');
            }
            observer.unobserve(entry.target);
        }
    });
}

function BlockEvent(event) {
    if (event.ctrlKey) return;
    event.preventDefault();
}

function HelpInfo(event) {
    let help_text = $(event.target).attr('title');
    alert(help_text);
}

function PreviewDialogHotkeys(event) {
    if (NPISAS.active_dialog) {
        switch (event.originalEvent.key) {
            case 'q':
                $(NPISAS.active_dialog).find('.npisas-preview-selector[data-type="source"]').click();
                break;
            case 'w':
                $(NPISAS.active_dialog).find('.npisas-preview-selector[data-type="search"]').click();
                break;
            case 'e':
                $(NPISAS.active_dialog).find('.npisas-preview-selector[data-type="upload"]').click();
                break;
            case 'r':
                $(NPISAS.active_dialog).find('.npisas-preview-selector[data-type="download"]').click();
                break;
            case 't':
                $(NPISAS.active_dialog).find('.npisas-preview-selector[data-type="unified"]').click();
                break;
            default:
                //do nothing
        }
        event.preventDefault();
        event.stopImmediatePropagation();
    }
}

//Markup functions

function MarkupMainArtwork() {
    const printer = Debug.getFunctionPrint('MarkupMainArtwork');
    let $artwork = $('div:has(> figure > div[role="presentation"] > div > div > a > img)');
    if ($artwork.find('a[href*="img-original"]').length === 0) {
        printer.log("Artwork image URL not set yet.");
        return false;
    }
    let $image = $artwork.find('div:has(> div[role="presentation"] > a > img)');
    let $link = $image.find('a');
    let image_url = $link.attr('href');
    let image_info = GetImageURLInfo(image_url);
    if (image_info.id !== NPISAS.artwork_id) {
        printer.log("Artwork image URL not changed yet:", image_info.id, NPISAS.artwork_id);
        return false;
    }
    MarkupImageArtwork($image);
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
    //Query
    let artwork_id = null;
    let $artwork = $(artwork);
    let $artwork_children = $artwork.children();
    let $image = $artwork_children.eq(0);
    //innerText is much slower, so navigate to the text node and use it instead
    let artwork_counter = $image.find('div:has(> span > span > svg)').children().get(-1);
    let image_text = artwork_counter?.childNodes[0].nodeValue ?? "";
    let image_count = image_text.split('\n').at(-1);
    let $pixiv_markers = $image.find('a > div:nth-of-type(2)');
    let $button = $image.find('button');
    let $captions = $artwork_children.eq(1);
    let $artist = $artwork_children.eq(2);
    let artwork_link = $artwork.find('a').get(0)?.href;
    let artist_link = $artist.find('a').get(0)?.href;
    //Modify
    $artwork.addClass('npisas-artwork npisas-preview-artwork');
    $artwork.attr({
        'npisas-artwork': 'preview',
        'data-ai': 'false',
        'data-viewed': 'false',
    });
    if (image_count.match(/^\d+$/)) {
        $image.addClass('npisas-multi-image');
        $image.attr('data-image-count', image_count);
    } else {
        $image.addClass('npisas-single-image');
        $image.attr('data-image-count', 1);
    }
    $image.addClass('npisas-image');
    $pixiv_markers.addClass('npisas-pixiv-markers');
    $button.addClass('npisas-like-button');
    $captions.addClass('npisas-captions');
    $artist.addClass('npisas-artist');
    if (artwork_link) {
        let match = GetPageMatch(artwork_link);
        if (match?.key === 'artwork') {
            artwork_id = Number(match.id);
            $artwork.attr('data-artwork-id', artwork_id);
        }
    }
    if (['user', 'user_works', 'user_tag_works'].includes(NPISAS.page)) {
        $artwork.attr('data-user-id', NPISAS.user_id);
    } else if (artist_link) {
        let match = GetPageMatch(artist_link);
        if (['user', 'user_works', 'user_tag_works', 'bookmarks', 'tag_bookmarks'].includes(match?.key)) {
            $artwork.attr('data-user-id', Number(match.id));
        }
    }
    $artwork.append('<div class="npisas-preview-controls"></div>');
    return artwork_id;
}

function MarkupImageArtwork(image) {
    let $image = $(image);
    let $link = $image.find('a');
    let image_url = $link.attr('href');
    let image_info = image_url && GetImageURLInfo(image_url);
    if (image_info) {
        $image.attr('data-image', image_url);
        $image.attr('data-order', image_info.order);
    }
    $image.addClass('npisas-image');
}

//Page functions

function GetPageMatch(url) {
    for (let key in PAGE_ATTRIBUTES) {
        let match = PAGE_ATTRIBUTES[key].regex.exec(url);
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

function PageNavigation(pagetype) {
    const printer = Debug.getFunctionPrint('PageNavigation');
    //Use all non-URL matching groups as a page key to detect page changes
    let page_key = Utility.arrayUnique(Object.values(NPISAS.page_match)).join(',');
    if (NPISAS.page === pagetype && NPISAS.page_key === page_key) {
        return;
    }
    let page_id = Number(NPISAS.page_match.id);
    NPISAS.prev_page = NPISAS.page;
    NPISAS.page = pagetype;
    NPISAS.page_key = page_key;
    ['user_id', 'type', 'tag', 'artwork_id'].forEach((key) => {delete NPISAS[key];});
    switch (NPISAS.page) {
        case 'user':
        case 'illusts':
        case 'tagillusts':
        case 'bookmarks':
            printer.log(`User pages [${NPISAS.page}]:`, page_id);
            NPISAS.user_id = page_id;
            NPISAS.type = NPISAS.page_match.type;
            NPISAS.tag = NPISAS.page_match.tag;
            $(document).off('scroll.npisas.check_menu');
            break;
        case 'artwork':
            printer.log(`Artworks page [${NPISAS.page}]:`, page_id);
            NPISAS.artwork_id = page_id;
            break;
        default:
            //Do nothing
    }
    if ($('.npisas-side-menu').length === 0) {
        $(document.body).append(RenderSideMenu());
        InitializeSideMenu();
        if (!Utility.isNamespaceBound({root: '#npisas-open-settings', eventtype: 'click', namespace: PROGRAM_SHORTCUT})) {
            $('#npisas-open-settings').on(JSPLib.event.click, OpenSettingsMenu);
            $('#npisas-danbooru-status').on(JSPLib.event.click, ToggleDanbooruStatus);
            $('#npisas-local-records').on(JSPLib.event.click, QueryLocalRecords);
            $('#npisas-error-messages').on(JSPLib.event.click, ErrorMessages);
            $('#npisas-menu-selection a').on(JSPLib.event.click, SideMenuSelection);
            $('#npisas-image-indicators-toggle a').on(JSPLib.event.click, ToggleImageIndicators);
            $('#npisas-view-counts-toggle a').on(JSPLib.event.click, ToggleViewCounts);
            $('#npisas-confirm-upload-toggle a').on(JSPLib.event.click, ToggleConfirmUpload);
            $('#npisas-confirm-download-toggle a').on(JSPLib.event.click, ToggleConfirmDownload);
        }
    }
    UpdateSideMenu();
    UpdatePreviewIndicatorControls();
    UpdateViewCountControls();
    UpdateConfirmUploadControls();
    UpdateConfirmDownloadControls();
    if (NPISAS.page === 'artwork' && NPISAS.prev_page === 'artwork') {
        setTimeout(DeinitializeMainArtwork, 1);
    }
    if (['user', 'user_works', 'user_tag_works', 'tags', 'tag_works'].includes(NPISAS.page)) {
        $('#npisas-page-min').html('loading...');
        $('#npisas-page-max').html('loading...');
        $('#npisas-time-range').html('loading...');
    } else {
        $('#npisas-page-min').html('N/A');
        $('#npisas-page-max').html('N/A');
        $('#npisas-time-range').html('N/A');
    }
    if (NPISAS.page === 'artwork') {
        $('#npisas-artwork-stats-table').html(MENU_UNAVAILABLE_HTML);
        $('#npisas-artwork-tags-list').html(MENU_UNAVAILABLE_HTML);
    } else {
        $('#npisas-artwork-stats-table').html(MENU_LOADING_HTML);
        $('#npisas-artwork-tags-list').html(MENU_LOADING_HTML);
    }
    for (let artwork_id in NPISAS.previews_dialog) {
        DestroyPreviewsDialog(artwork_id);
    }
    for (let artwork_id in NPISAS.info_dialog) {
        NPISAS.info_dialog[artwork_id].dialog('destroy');
        NPISAS.info_dialog[artwork_id].remove();
        delete NPISAS.info_dialog[artwork_id];
    }
}

//Main execution functions

function RegularCheck() {
    //Get current page and previous page info
    NPISAS.prev_pagetype = NPISAS.page;
    let pagetype = GetPageType();
    if (pagetype === "other") {
        $('#npisas-side-menu').hide();
        return;
    }
    //Process events on a page change
    PageNavigation(pagetype);
    ProcessArtworkImages();
    //Process events on newly rendered posts that should only be done once
    if (!ProcessNewArtworks()) {
        //Only process further if there are new posts
        return;
    }
    if (['user', 'user_works', 'user_tag_works', 'tags', 'tag_works'].includes(NPISAS.page)) {
        CollectArtworkRanges();
    }
    if (NPISAS.page !== 'artwork' && (NPISAS.artwork_statistics || NPISAS.artwork_tags)) {
        CollectArtworkStatsAndTags();
    }
}

function ProcessArtworkImages() {
    const printer = Debug.getFunctionPrint('ProcessArtworkImages');
    let unique_id = Utility.getUniqueID();
    let $unprocessed_images = $('.npisas-image:not([npisas-image]):not(.npisas-unhandled-image) img');
    if ($unprocessed_images.length) {
        printer.log(`Images found[${unique_id}]:`, $unprocessed_images.length);
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
            GetIllust(artwork_id).then((illust) => {
                if (NPISAS.display_ai_status) {
                    $artwork.attr('data-ai', illust.ai);
                }
            });
            if (NPISAS.display_artwork_views) {
                GetData('view-' + artwork_id, 'danbooru').then((views) => {
                    if (views?.value.count > 0) {
                        let $artwork = $(`.npisas-artwork[data-artwork-id="${artwork_id}"]`);
                        $artwork.attr('data-viewed', 'true');
                        let $marker = $artwork.find('.npisas-viewed-marker');
                        let count = views.value.count;
                        let timestring = Utility.timeAgo(views.value.viewed);
                        let title = `Viewed ${count} times, ${timestring}.`;
                        $marker.attr('title', title);
                    }
                });
            }
            NPISAS.intersection_observer.observe($artwork.get(0));
        } else {
            $container.addClass('npisas-unhandled-image');
            if (Utility.isBoolean(image_info)) {
                Notice.debugNoticeLevel("New unhandled image found (see debug console)", Debug.INFO);
                printer.warn(`Unhandled image[${unique_id}]:`, image.src, artwork_id);
            }
        }
    });
}

function ProcessNewArtworks() {
    const printer = Debug.getFunctionPrint('ProcessNewArtworks');
    let unique_id = Utility.getUniqueID();
    let page_attr = PAGE_ATTRIBUTES[NPISAS.page];
    if (page_attr === undefined) {
        return false;
    }
    if (NPISAS.page === 'artwork' && $('.npisas-main-artwork').length === 0) {
        if (!MarkupMainArtwork()) {
            return false;
        }
        InitializeMainArtwork();
        UpdateImageIndicators();
    }
    let has_new = false;
    for (let i = 0; i < page_attr.sections.length; i++) {
        let section = page_attr.sections[i];
        let $landmarks = $(section.selector);
        if ($landmarks.length === 0) {
            continue;
        }
        has_new = true;
        let $image_containers = $landmarks.map((_, entry) => GetNthParent(entry, section.imageparent))
            .filter((_, entry) => !entry.classList.contains('npisas-image'));
        $image_containers.each((_, image) => {MarkupImageArtwork(image);});
        let $artwork_containers = $landmarks.map((_, entry) => GetNthParent(entry, section.artworkparent))
            .filter((_, entry) => !entry.classList.contains('npisas-artwork'));
        let $artwork_grid = $landmarks.map((_, entry) => GetNthParent(entry, section.gridparent))
            .filter((_, entry) => !entry.classList.contains('npisas-grid'));
        $artwork_containers.each((j, entry) => {
            $(entry).addClass('npisas-artwork').attr('viewed', 'false');
            MarkupPreviewArtwork(entry);
            InitializeGridArtwork(entry);
        });
        if ($artwork_grid.length) {
            let side_padding = window.screen.width - 200;
            let column_gap = (['user', 'user_works', 'user_tag_works', 'bookmarks', 'tag_bookmarks', 'artwork'].includes(NPISAS.page) ? '2em' : '3.5em');
            $artwork_grid.find('ul').css({
                'display': 'flex',
                'justify-content': 'flex-start',
                'column-gap': column_gap,
                'row-gap': '2em',
                'flex-wrap': 'wrap',
            });
            if (['tag_works', 'tags', 'user', 'user_works', 'user_tag_works', 'bookmarks', 'tag_bookmarks', 'artwork'].includes(NPISAS.page)) {
                let width_classes = [...$artwork_grid.get(0).classList].filter((c) => c.indexOf('-') < 0);
                width_classes.forEach((width_class) => {
                    $('.' + width_class).css('width', side_padding + 'px');
                });
            }
            if (NPISAS.page === 'artwork') {
                $artwork_grid.closest('aside').addClass('npisas-related-works');
            }
            if (['user', 'user_works', 'user_tag_works', 'bookmarks', 'tag_bookmarks'].includes(NPISAS.page)) {
                $('nav:not(:has(button))').parent().eq(0).css('max-width', side_padding);
                $artwork_grid.find('ul').parent().eq(0).css('width', side_padding + 'px');
            }
            if (['tag_works', 'tags'].includes(NPISAS.page)) {
                $('a[href^="/en/tags/"]').closest('ul').eq(0).children().css('padding', '0px 100px');
            }
            if (['user_works', 'user_tag_works'].includes(NPISAS.page)) {
                $('a[href*="/illustrations/"], a[href*="/manga/"], a[href*="/artworks/"]').parent().parent().parent().eq(0).css('max-width', side_padding + 'px');
            }
            $artwork_grid.addClass('npisas-grid');
            UpdateImageIndicators();
        }
        if ($artwork_containers.length) {
            printer.log(`[${unique_id}]`, "New:", $image_containers.length);
            if (['bookmarks', 'tag_bookmarks'].includes(NPISAS.page)) {
                $('.npisas-grid ul > li:not(.npisas-unknown)').each((_, li) => {
                    let $li = $(li);
                    if ($li.find('.npisas-artwork').length === 0) {
                        $li.css({
                            'width': '300px',
                            'display': 'flex',
                            'justify-content': 'center',
                            'align-items': 'center',
                        });
                        $li.addClass('npisas-unknown');
                    }
                });
            }
        }
    }
    return has_new;
}

function CollectArtworkStatsAndTags() {
    let $grid = $('.npisas-grid ' + (PAGE_ATTRIBUTES[NPISAS.page].range ?? ""));
    let artwork_ids = Utility.getDOMArrayDataValues($grid.find('.npisas-artwork:has(.npisas-image:not(.npisas-unhandled-image))'), 'artwork-id', {parser: Number});
    if (artwork_ids.length === 0) return;
    let promise_array = artwork_ids.map((artwork_id) => GetIllust(artwork_id));
    Promise.all(promise_array).then((page_artworks) => {
        if (NPISAS.artwork_statistics) {
            InitializeArtworkStats(page_artworks);
        }
        if (NPISAS.artwork_tags) {
            InitializeArtworkTags(page_artworks);
        }
    });
}

function CollectArtworkRanges() {
    let $grid = $('.npisas-grid ' + (PAGE_ATTRIBUTES[NPISAS.page].range ?? ""));
    let $artworks = $grid.find('.npisas-artwork');
    if ($artworks.length === 0) return;
    let artwork_ids = Utility.getDOMArrayDataValues($artworks, 'artwork-id', {parser: Number});
    let max_id = Math.max(...artwork_ids)
    let min_id = Math.min(...artwork_ids);
    $('#npisas-page-max').html(`<span>${max_id}</span>`);
    $('#npisas-page-min').html(`<span>${min_id}</span>`);
    if (Utility.isHash(CollectArtworkRanges.timeobj)) {
        clearInterval(CollectArtworkRanges.timeobj.timer);
    }
    CollectArtworkRanges.timeobj = Utility.recheckInterval({
        check: () => $artworks.length === $artworks.find('.npisas-image[data-date]').length,
        success: () => {
            let timestamps = $artworks.map((_, entry) => GetArtworkTimestamp(entry)).toArray();
            let max_timestamp = Math.max(...timestamps);
            let min_timestamp = Math.min(...timestamps);
            let timerange = TimeRange(max_timestamp, min_timestamp);
            $('#npisas-page-max span').attr('title', new Date(max_timestamp).toString());
            $('#npisas-page-min span').attr('title', new Date(min_timestamp).toString());
            $('#npisas-time-range').html(timerange);
        },
        interval: Utility.one_second,
    });
}

//Settings functions

function IsQuerySettingEnabled(setting) {
    return NPISAS.IQDB_settings.includes(setting);
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
        $('#new-pixiv-image-searches-and-stuff').dialog('close');
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

function InitializeDialogButtons() {
    $('.npisas-dialog .ui-dialog-buttonset .ui-button').each((_, entry) => {
        let key = entry.innerText;
        for (let attribute in MENU_DIALOG_BUTTONS[key]) {
            $(entry).attr(attribute, MENU_DIALOG_BUTTONS[key][attribute]);
        }
    });
    GetMenuCloseButton().attr('title', CLOSE_HELP);
}

//Only render the settings menu on demand
function BuildSettingsMenu() {
    //Create the dialog
    $('body').append(SETTINGS_MENU);
    $('#new-pixiv-image-searches-and-stuff').dialog(MENU_DIALOG_SETTINGS);
    InitializeDialogButtons();
    //Standard menu creation
    $('#new-pixiv-image-searches-and-stuff').append(NPISAS_MENU);
    $('#npisas-display-settings').append(Menu.renderCheckbox('display_network_errors'));
    $('#npisas-display-settings').append(Menu.renderCheckbox('display_ai_status'));
    $('#npisas-display-settings').append(Menu.renderCheckbox('display_artwork_views'));
    $('#npisas-display-settings').append(Menu.renderCheckbox('image_indicators_toggle'));
    $('#npisas-function-settings').append(Menu.renderCheckbox('artwork_statistics'));
    $('#npisas-function-settings').append(Menu.renderCheckbox('artwork_tags'));
    $('#npisas-function-settings').append(Menu.renderCheckbox('advanced_tooltips'));
    $('#npisas-query-settings').append(Menu.renderInputSelectors('IQDB_settings', 'checkbox'));
    $("#npisas-query-message").append(Menu.renderExpandable("Additional setting details", QUERY_SETTINGS_DETAILS));
    $('#npisas-query-settings').append(Menu.renderTextinput('similarity_cutoff', 10));
    $('#npisas-query-settings').append(Menu.renderTextinput('results_returned', 10));
    $('#npisas-network-settings').append(Menu.renderCheckbox('custom_order_enabled'));
    $('#npisas-network-settings').append(Menu.renderInputSelectors('query_subdomain', 'radio'));
    //Fixup forum links
    $('#npisas-forum-topic-link').attr('href', `${NPISAS.domain}/forum_topics/${DANBOORU_TOPIC_ID}`);
    //Engage jQuery UI
    Menu.engageUI({checkboxradio: true});
    $('#npisas-settings').tabs();
    //Set event handlers
    Menu.saveUserSettingsClick();
    Menu.resetUserSettingsClick({delete_keys: STORAGE_RESET_KEYS});
    Menu.expandableClick();
    //Add CSS stylings
    InitializeUIStyle();
    //Utility.setCSSStyle(Menu.settings_css, 'menu_settings'); Doesn't work
    Utility.setCSSStyle(MENU_CSS, 'menu');
}

function InitializeProgram() {
    NPISAS.domain = 'https://' + NPISAS.query_subdomain + '.donmai.us';
    NPISAS.intersection_observer = new IntersectionObserver(CheckViews, {threshold: 0.75});
    Saucenao.api_key = NPISAS.SauceNAO_API_key;
}

async function CleanupTasks() {
    await Storage.pruneProgramCache({prune_expires: PRUNE_RECHECK_EXPIRES, database: Storage.danboorustorage});
    await Storage.pruneProgramCache({prune_expires: PRUNE_RECHECK_EXPIRES, database: Storage.pixivstorage});
}

//Main function

function Main() {
    Load.preloadScript({
        danbooru_userscript: false,
    });
    InitializeProgram();
    Network.jQuerySetup();
    jQuery.ajaxSetup({timeout: Utility.one_second * 5});
    Notice.installBanner(PROGRAM_SHORTCUT);
    $(document).on(JSPLib.event.click, '.npisas-toggle-menu', ToggleSideMenu);
    $(document).on(JSPLib.event.click, '.npisas-show-info', MenuShowInfo);
    $(document).on(JSPLib.event.click, '.npisas-artwork-menu .npisas-danbooru-results', MenuDanbooruResultsControl);
    $(document).on(JSPLib.event.contextmenu, '.npisas-artwork-menu .npisas-danbooru-results', BlockEvent);
    $(document).on(JSPLib.event.click, '.npisas-artwork-menu .npisas-local-results', MenuLocalResultsControl);
    $(document).on(JSPLib.event.contextmenu, '.npisas-artwork-menu .npisas-local-results', BlockEvent);
    $(document).on(JSPLib.event.click, '.npisas-artwork-menu .npisas-control-search', MenuSearchControl);
    $(document).on(JSPLib.event.contextmenu, '.npisas-artwork-menu .npisas-control-search', MenuSearchAlternate);
    $(document).on(JSPLib.event.click, '.npisas-artwork-menu .npisas-control-upload', MenuUploadControl);
    $(document).on(JSPLib.event.contextmenu, '.npisas-artwork-menu .npisas-control-upload', MenuUploadAlternate);
    $(document).on(JSPLib.event.click, '.npisas-artwork-menu .npisas-control-download', MenuDownloadControl);
    $(document).on(JSPLib.event.contextmenu, '.npisas-artwork-menu .npisas-control-download', MenuDownloadAlternate);
    $(document).on(JSPLib.event.click, '.npisas-preview-container .npisas-local-results', PreviewLocalResultsControl);
    $(document).on(JSPLib.event.click, '.npisas-preview-container .npisas-control-search', PreviewSearchControl);
    $(document).on(JSPLib.event.click, '.npisas-preview-container .npisas-image-download-menu', PreviewDownloadControl);
    $(document).on(JSPLib.event.click, '.npisas-preview-container .npisas-image-upload-menu', PreviewUploadControl);
    $(document).on(JSPLib.event.click, '.npisas-preview-container .npisas-load-size', PreviewLoadSize);
    $(document).on(JSPLib.event.click, '.npisas-menu-help, .npisas-help-info', HelpInfo);
    $(document).on(JSPLib.event.click, '.npisas-block-link', BlockEvent);
    $(document).on(JSPLib.event.keydown, null, 'q w e r t', PreviewDialogHotkeys);
    $(document).on(JSPLib.event.keydown, null, 'alt+0', ToggleSideMenu);
    $(document).on(JSPLib.event.keydown, null, 'alt+m', OpenSettingsMenu);
    $(document).on(JSPLib.event.keydown, null, 'alt+c', CloseSettingsMenu);
    $(document).on(JSPLib.event.keydown, null, 'alt+s', SaveSettingsMenu);
    $(document).on(JSPLib.event.keydown, null, 'alt+r', ResetSettingsMenu);
    setInterval(IntervalStorageHandler, 500);
    setInterval(IntervalNetworkHandler, 500);
    Utility.setCSSStyle(PROGRAM_CSS, 'program');
    Utility.setCSSStyle(Template.renderTheme(LIGHT_CSS, 'html[data-theme="light"]'), 'light');
    Utility.setCSSStyle(Template.renderTheme(DARK_CSS, 'html[data-theme="dark"]'), 'dark');
    Utility.setCSSStyle(Template.renderTheme(JQUERY_DARK_CSS, 'html[data-theme="dark"]'), 'jquery_dark');
    Utility.initializeInterval(RegularCheck, PROGRAM_RECHECK_INTERVAL);
    Load.noncriticalTasks(CleanupTasks);
}

/****Initialization****/

JSPLib.name = PROGRAM_NAME;
JSPLib.shortcut = PROGRAM_SHORTCUT;
JSPLib.data = NPISAS;
JSPLib.data_regex = PROGRAM_DATA_REGEX;
JSPLib.default_data = PROGRAM_DEFAULT_VALUES;
JSPLib.reset_data = PROGRAM_RESET_KEYS;
JSPLib.settings_config = SETTINGS_CONFIG;

Debug.mode = true;
Debug.level = Debug.INFO;

Storage.indexedDBValidator = ValidateEntry;

Network.error_domname = '#npisas-error-messages';
Network.wait_interval = Utility.one_second;

Danbooru.max_read_requests = 10;
Danbooru.down = false;

Load.exportData({other_data: {jQuery, validate, SAVED_STORAGE_REQUESTS, SAVED_NETWORK_REQUESTS, HANDLED_MEDIA, PAGE_ATTRIBUTES}});
Load.exportFuncs({debug_list: [CheckPixivID, GetImageURLInfo]});

/****Execution start****/

Load.programInitialize(Main, {required_selectors: LOAD_REQUIRED_SELECTORS, max_retries: 100, timer_interval: 500});

})(JSPLib);
