// ==UserScript==
// @name         New Pixiv Image Searches and Stuff (ALPHA)
// @version      0.13
// @description  Searches Danbooru database for artwork IDs, adds image search links.
// @match        *://www.pixiv.net/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/core-js/3.11.0/minified.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js
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

/* eslint-disable no-unused-vars */

// eslint-disable-next-line no-redeclare
/* global $ jQuery JSPLib validate localforage saveAs GM_getResourceText */

/****Global variables****/

//Library constants

////NONE

//Variables for load.js
const PROGRAM_LOAD_REQUIRED_VARIABLES = [];
const PROGRAM_LOAD_REQUIRED_SELECTORS = [];

//Program name constants
const PROGRAM_FULL_NAME = "New Pixiv Image Searches and Stuff";
const PROGRAM_NAME = 'NPISAS';
const PROGRAM_SHORTCUT = 'npisas';
const PROGRAM_CLICK = 'click.npisas';
const PROGRAM_KEYDOWN = 'keydown.npisas';

//Variables for network.js
const API_DATA = {'users': {}, 'artworks': {}, has_data: false, raw_data: []};

//Variables for storage.js
JSPLib.storage.pixivstorage = localforage.createInstance({
    name: 'Pixiv storage',
    driver: [localforage.INDEXEDDB]
});

//Main program variable
var NPISAS = {};

const PROGRAM_DATA_REGEX = /^(post|view|iqdb|sauce|video|npisas-available-sauce)-/; //Regex that matches the prefix of all program cache data

//For factory reset !!!These need to be set!!!
const LOCALSTORAGE_KEYS = [];
const PROGRAM_RESET_KEYS = {};
const PROGRAM_DEFAULT_VALUES = {
    artwork_data: {},
    post_data: {},
    artwork_image_info: {},
    no_url_results: [],
    merge_results: [],
    similar_results: {},
    preview_dialog: {},
    multi_expanded: false,
};

//Settings constants
const COMMON_QUERY_SETTINGS = ['pick_image', 'confirm_save', 'auto_save'];
const DEFAULT_QUERY_SETTINGS = ['pick_image', 'confirm_save'];
const SUBDOMAINS = ['danbooru', 'kagamihara', 'saitou', 'shima'];

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
    bookmark_settings: {
        allitems: COMMON_QUERY_SETTINGS,
        default: DEFAULT_QUERY_SETTINGS,
        validate: (data) => JSPLib.menu.validateCheckboxRadio(data, 'checkbox', COMMON_QUERY_SETTINGS),
        hint: "Check/uncheck to turn on/off setting."
    },
    bookmarks_enabled: {
        default: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Whether bookmarking via Prebooru is enabled or not."
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
    custom_order_enabled: {
        default: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Multi-post results will use <span class=\"npisas-code\">order:custom</span>, showing results with Twitter's order. <b>Note:</b> This will break the tag limit for non-Gold+."
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
    merge_results_enabled: {
        default: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays a merge link that allows a new query merging the old results with the new."
    },
    display_artwork_views: {
        default: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays the the number of times an artwork has been seen."
    },
    display_profile_views: {
        default: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays the the number of times a user/page has been seen."
    },
    display_user_id: {
        default: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays the user ID above the username on the Artwork view. <b>Note:</b> Only available with access to Twitter's API."
    },
    advanced_tooltips_enabled: {
        default: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Displays extra information and thumbnails on IQDB results. <b>Note:</b> Only when the data is not auto-saved."
    },
};

//CSS constants
const FONT_FAMILY = '\'Segoe UI\', Arial, sans-serif';
const BASE_PREVIEW_WIDTH = 160;
const POST_PREVIEW_DIMENSION = 150;

const PROGRAM_CSS = `
.npisas-popup-media-image {
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
.npisas-query-button {
    display: inline-block;
    text-align: center;
    border: 1px solid;
    padding: 4px;
}
.npisas-micro-menu .npisas-query-button {
    min-width: 1em;
    margin: 0 -5px;
}
.npisas-micro-menu  .npisas-query-results,
.npisas-micro-menu  .npisas-query-postid {
    border-radius: 25px 0 0 25px;
    margin-left: 0;
}
.npisas-micro-menu  .npisas-query-results {
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
.npisas-help-info,
.npisas-help-info:hover {
    color: hotpink;
}
.npisas-artwork {
   border-top: 4px solid transparent;
   padding-top: 5px;
}
.npisas-artwork.npisas-preview-artwork {
   overflow: visible;
   -webkit-mask-image: none;
}
.npisas-artwork[data-ai="true"] {
   border-top-color: grey;
}
.npisas-artwork-header {
    font-size: 1.4em;
    display: inline-block;
    font-weight: bold;
    padding: 6px 1.8em 6px 6px;
    border-right: 1px solid grey;
}
.npisas-artwork-image-menu-links {
    font-weight: bold;
    font-family: ${FONT_FAMILY};
    display: inline-block;
    padding: 5px;
}
.npisas-artwork .npisas-manual-add,
.npisas-artwork .npisas-manual-add:hover,
.npisas-artwork .npisas-database-no-match,
.npisas-artwork .npisas-database-no-match:hover,
.npisas-artwork .npisas-cancel-merge,
.npisas-artwork .npisas-cancel-merge:hover {
    color: red;
}
.npisas-artwork .npisas-database-match {
    color: green;
}
[npisas-artwork] [npisas-similar-match=great],
[npisas-artwork] [npisas-similar-match=great]:hover,
[npisas-artwork] [npisas-similar-match=great]:focus {
    color: green;
}
[npisas-artwork] [npisas-similar-match=good],
[npisas-artwork] [npisas-similar-match=good]:hover,
[npisas-artwork] [npisas-similar-match=good]:focus {
    color: blue;
}
[npisas-artwork] [npisas-similar-match=fair],
[npisas-artwork] [npisas-similar-match=fair]:hover,
[npisas-artwork] [npisas-similar-match=fair]:focus {
    color: orange;
}
[npisas-artwork] [npisas-similar-match=poor],
[npisas-artwork] [npisas-similar-match=poor]:hover,
[npisas-artwork] [npisas-similar-match=poor]:focus {
    color: red;
}
.npisas-preview-artwork .npisas-check-link {
    display: inline-block;
    min-width: 64px;
    text-align: center;
}
.npisas-preview-artwork .npisas-check-link {
    display: inline-block;
    min-width: 15px;
    text-align: center;
}
.npi
.npisas-artwork .npisas-check-url,
.npisas-artwork .npisas-check-url:hover,
.npisas-artwork .npisas-check-iqdb,
.npisas-artwork .npisas-check-iqdb:hover,
.npisas-artwork .npisas-check-sauce,
.npisas-artwork .npisas-check-sauce:hover,
.npisas-artwork .npisas-merge-results,
.npisas-artwork .npisas-merge-results:hover {
    color: grey;
}
.npisas-image-menu {
    text-align:center;
    font-weight: bold;
    font-size: 1.2em;
    margin: 0.5em;
}
.npisas-bookmark-entry {
    font-size: 16px;
    font-weight: bold;
    font-family: ${FONT_FAMILY};
}
.npisas-bookmark-entry {
    display: flex;
    border: 2px solid black;
    padding: 0.5em;
}
.npisas-bookmark-header {
    font-size: 1.4em;
}
.npisas-bookmark-section {
    padding-left: 0.5em;
}
.npisas-bookmark-section > div {
    padding: 0.25em;
}
.npisas-bookmark-controls a {
    padding: 10px;
}
.npisas-bookmark-controls .npisas-help-info {
    padding: 8px;
}
.npisas-bookmark-info {
    font-size: 0.8em;
}
.npisas-bookmark-info > a:not(.npisas-help-info) {
    display: inline-block;
    min-width: 65px;
    text-align: center;
}
.npisas-main-tweet .npisas-footer-entries {
    border-top-width: 1px;
    border-top-style: solid;
    padding: 5px 0 5px;
}
.npisas-stream-tweet .npisas-footer-entries,
.npisas-stream-tweet .npisas-bookmark-entry,
.npisas-stream-tweet .npisas-bookmark-stub {
    margin-top: 10px;
}
.npisas-check-bookmark,
.npisas-check-bookmark:hover {
    color: hotpink;
}
.npisas-all-bookmark,
.npisas-select-bookmark,
.npisas-bookmark-thumbs {
    color: rgb(27, 149, 224);
}
.npisas-activated,
.npisas-activated:hover {
    color: unset;
}
.npisas-force-download {
    color: goldenrod;
}
.npisas-force-download.npisas-activated {
    color: red;
}
.npisas-bookmark-upload {
    color: green;
}
.npisas-bookmark-section {
    padding-left: 0.5em;
}
.npisas-bookmark-controls {
    border-bottom: 1px solid lightgrey; font-size: 0.9em;
}
.npisas-create-uploads,
.npisas-create-illusts,
.npisas-create-artists {
    display: inline-block;
    margin-right: 0.25em;
    padding: 2.5px 5px;
    background: #EEE;
    border: 1px solid black;
}
.npisas-create-uploads {
    margin-left: -2px;
    border-radius: 10px;
}
.npisas-create-illusts,
.npisas-create-artists {
    border-radius: 25px;
}
`;

//HTML constants

const MAIN_ARTWORK_MENU = `
<div class="npisas-artwork-controls">
    <div class="npisas-artwork-image-menu" style="border: 2px solid black;">
        <div class="npisas-artwork-header">NPISAS</div>
        <div class="npisas-artwork-image-menu-links npisas-links">
        </div>
    </div>
</div>
`;

const MICRO_MAIN_MENU_HTML = `
<div class="npisas-main-menu npisas-micro-menu" style="height: 30px;">
    <div class="npisas-link-menu npisas-preview-menu npisas-links">
        <span style="font-weight:bold; vertical-align: center;">( Loading... )</span>
    </div>
</div>
<div class="npisas-auxiliar-menu npisas-micro-menu" style="display: flex; margin: 5px 0;">
    (
    <div class="npisas-links" style="padding: 0 2px;">
        <a class="npisas-show-previews npisas-expanded-link">Previews</a> |
        <a class="npisas-upload-artwork npisas-expanded-link" target="_blank">Upload</a>
    </div>
    )
</div>`;

//Message constants

const CONFIRM_SAVE_PROMPT = "Save the following post IDs? (separate by comma, empty to reset link)";
const MANUAL_ADD_PROMPT = "Enter the post IDs of matches. (separated by commas)";
const CONFIRM_DELETE_PROMPT = JSPLib.utility.trim`
The following posts will be deleted: %s

Save the following post IDs? (separate by comma, empty to delete)`;

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
const SAVE_HELP = "L-Click to save current settings. (Shortcut: Alt+S)";
const RESET_HELP = "L-Click to reset settings to default. (Shortcut: Alt+R)";
const SETTINGS_HELP = "L-Click to open settings menu. (Shortcut: Alt+M)";
const CLOSE_HELP = "L-Click to close. (Shortcut: Alt+C)";

const BOOKMARK_MENU_HELP = "All: L-click, submit post for bookmark\nSelect: L-click, choose images to submit for bookmark\nForce: L-click, toggle forcing upload even if one already exists\n    (yellow = default, red = force)";
const BOOKMARK_INFO_HELP = "thumbs: L-click, display post thumbnails (if exist)\nuploadlink: L-click, show/query upload(s) JSON\npostlink: L-click, show/query post(s) JSON\n";

//Regex constants

const PIXIV_HOST = String.raw`^https?://www\.pixiv\.net`;

var PIXIV_ACCOUNT = String.raw`[\w-]+`;
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

const QUERY_LIMIT = 100;
const QUERY_BATCH_NUM = 5;
const QUERY_BATCH_SIZE = QUERY_LIMIT * QUERY_BATCH_NUM;

const POST_FIELDS = 'id,pixiv_id,uploader_id,score,fav_count,rating,tag_string,created_at,preview_file_url,source,file_ext,file_size,image_width,image_height,uploader[name]';
const POSTVER_FIELDS = 'id,updated_at,post_id,version,source,source_changed,added_tags,removed_tags';
const PROFILE_FIELDS = 'id,level';

//Queue constants

const QUEUED_STORAGE_REQUESTS = [];
const SAVED_STORAGE_REQUESTS = [];
const CACHED_STORAGE_REQUESTS = {};
const CACHE_STORAGE_TYPES = ['get','check'];
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
        selector: 'section > div > div > ul > li div:not(.npisas-artwork) > div > div > a > div > div > img',
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
        'Close' () {
            $(this).dialog('close');
        }
    }
};

//Time constants

const USER_EXPIRES = JSPLib.utility.one_month;
const MIN_POST_EXPIRES = JSPLib.utility.one_day;
const MAX_POST_EXPIRES = JSPLib.utility.one_month;
const SIMILAR_EXPIRES = JSPLib.utility.one_day;
const SAUCE_EXPIRES = JSPLib.utility.one_hour;

//Other constants

const GOLD_LEVEL = 30;

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

const PROFILE_CONSTRAINTS = {
    id: JSPLib.validate.id_constraints,
    level: JSPLib.validate.id_constraints,
};

/****FUNCTIONS****/

//Library functions

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

//Validation functions

function ValidateEntry() {
    return true;
}

function ValidateExpiration() {
    return null;
}

function ValidateProgramData() {
    return true;
}

//Helper functions

function GetSessionPixivData(artwork_id) {
    return JSPLib.storage.getIndexedSessionData('artwork-' + artwork_id, {default_val: [], database: STORAGE_DATABASES.pixiv});
}

function JSONNotice(data) {
    JSPLib.notice.notice('<pre>' + JSON.stringify(data, null, 2) + '</pre>', false, true);
}

function GetAPIData(key,id,value) {
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

function LogarithmicExpiration(count, max_count, time_divisor, multiplier) {
    let time_exponent = Math.pow(10, (1 / time_divisor));
    return Math.round(Math.log10(time_exponent + (10 - time_exponent) * (count / max_count)) * multiplier);
}

function RemoveDuplicates(obj_array,attribute){
    const attribute_index = JSPLib.utility.getObjectAttributes(obj_array, attribute);
    return obj_array.filter((obj,index) => (attribute_index.indexOf(obj[attribute]) === index));
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
    posts.forEach((post)=>{
        let age = JSPLib.utility.HTMLEscape(`age:"${JSPLib.utility.timeAgo(post.created)}"`);
        title.push(`post #${post.id} - user:${post.uploadername} score:${post.score} favcount:${post.favcount} rating:${post.rating} ${age}`);
    });
    return title.join('\n');
}

function GetCustomQuery() {
    return (NPISAS.user_settings.custom_order_enabled && (NPISAS.user_data.level >= GOLD_LEVEL) ? '+order%3Acustom' : '');
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
    } else if (created_interval < JSPLib.utility.one_month) {
        let day_interval = (created_interval / JSPLib.utility.one_day) - 1; //Start at 0 days and go to 29 days
        let day_slots = 29; //There are 29 day slots between 1 day and 30 days
        let days_month = 30;
        return LogarithmicExpiration(day_interval, day_slots, days_month, MAX_POST_EXPIRES);
    } else {
        return MAX_POST_EXPIRES;
    }
}

function ProcessSimilarData(type, artwork_id, $artwork, $replace, image_url, similar_data, preview) {
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
        $replace.html(RenderSimilarIDsLink(similar_post_ids, similar_data, level, type));
        NPISAS.similar_results[artwork_id] = similar_post_ids;
    } else {
        SaveData(type + '-' + artwork_id, {value: true, expires: JSPLib.utility.getExpires(SIMILAR_EXPIRES)}, 'danbooru');
        InitializeNoMatchesLinks(artwork_id, $replace, image_url, preview);
    }
}

//Data functions

function LoadHTMLData() {
    let $global_data = $("#meta-global-data");
    if ($global_data.length) {
        API_DATA.global_data = JSON.parse($global_data.attr('content'));
    }
    let $preload_data = $("#meta-preload-data");
    if ($preload_data.length) {
        API_DATA.preload_data = JSON.parse($preload_data.attr('content'));
        if ('illust' in API_DATA.preload_data) {
            for (let key in API_DATA.preload_data.illust) {
                API_DATA.artworks[key] = API_DATA.preload_data.illust[key];
            }
        }
        if ('user' in API_DATA.preload_data) {
            for (let key in API_DATA.preload_data.user) {
                API_DATA.users[key] = API_DATA.preload_data.user[key];
            }
        }
    }
}

function MapArtwork(artwork_id, mapped_posts) {
    let artwork_posts = mapped_posts.filter((post) => post.pixivid === artwork_id);
    let post_ids = JSPLib.utility.getObjectAttributes(artwork_posts, 'id');
    let post_sources = JSPLib.utility.getObjectAttributes(artwork_posts, 'source');
    return {
        id: artwork_id,
        posts: post_ids,
        sources: post_sources,
        queried: Date.now(),
    }
}

function MergeArtwork(original, merge) {
    let original_posts = original.posts || [];
    let merge_posts = merge.posts || [];
    original.posts = JSPLib.utility.arrayUnion(original_posts, merge_posts);
    if (original.posts.length === 0) {
        delete original.posts;
    }
    original.sources = merge.sources;
    if (!original.sources || original.sources.length === 0) {
        delete original.sources;
    }
    original.queried = merge.queried;
    return original;
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
        let artwork_id = String($artwork.data('artwork-id'));
        let user_id = String($artwork.data('user-id') || "");
        let artwork_type = $artwork.attr('npisas-artwork');
        let preview = artwork_type === 'preview';
        let $image = $artwork.find('.npisas-image');
        let image_data = $image.get(0)?.dataset || {};
        if (Object.keys(image_data).length === 0 || !image_data.date) {
            //JSPLib.notice.debugNotice("GetArtworkInfo: Dataset empty.");
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

function GetEventPreload(event, classname) {
    let $link = $(event.target);
    let $artwork = $link.closest('[npisas-artwork]');
    let {artwork_id, user_id, artwork_type, preview, image_url, image_count} = GetArtworkInfo($artwork);
    let $replace = $(`[data-artwork-id=${artwork_id}] .${classname}`);
    let replace_level = $replace.data('replace') || 1;
    $replace = $(JSPLib.utility.getNthParent($replace.get(0), replace_level));
    return {$link, $artwork, artwork_id, user_id, artwork_type, preview, image_url, $replace, image_count};
}

function SetRotatingIcon($link) {
    const icons = ['|', '/', '―', '\\'];
    let index = 0;
    return JSPLib.utility.initializeInterval(() => {
        $link.text(icons[index]);
        index = (index + 1) % icons.length;
    }, 100);
}

function PromptSavePostIDs($link, $artwork, artwork_id, $replace, message, initial_post_ids, preview) {
    let prompt_string = prompt(message, initial_post_ids.join(', '));
    if (prompt_string !== null) {
        let confirm_post_ids = JSPLib.utility.arrayUnique(
            prompt_string.split(',')
                .map(Number)
                .filter((num) => JSPLib.validate.validateID(num))
        );
        JSPLib.debug.debuglog('log', "Confirmed IDs:", confirm_post_ids);
        if (confirm_post_ids.length === 0) {
            RemoveData('artwork-' + artwork_id, 'pixiv');
        } else {
            let artwork = GetSessionPixivData(artwork_id);
            artwork.posts = JSPLib.utility.arrayUnion(artwork.posts || [], confirm_post_ids);
            SaveData('artwork-' + artwork_id, artwork, 'pixiv');
        }
        UpdatePostIDsLink(artwork_id, confirm_post_ids);
    }
}

//Render functions

function RenderPostIDsLink(posts, classname, preview) {
    let mergelink = "";
    let helpinfo = CONFIRM_DELETE_HELP;
    if (NPISAS.user_settings.merge_results_enabled) {
        let text = preview ? 'M' : 'Merge';
        mergelink = `<a class="npisas-merge-results npisas-expanded-link" data-replace="2">${text}</a>`;
        helpinfo += '\n' + MERGE_RESULTS_HELP;
    }
    let helplink = RenderHelp(helpinfo);
    let post_ids = JSPLib.utility.getObjectAttributes(posts, 'id');
    var title, href, text;
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

function RenderSimilarIDsLink(post_ids, similar_data, level, type, preview) {
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
(
<span class="npisas-query-button" style="border-radius: 25px 0 0 25px; min-width: 8em;">${idlink}</span>
|
<span class="npisas-query-button" style="border-radius: 0 25px 25px 0; min-width: 2em;">${helplink}</span>
)
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
                    `<a class="npisas-check-iqdb npisas-expanded-link npisas-check-link" href="https://danbooru.donmai.us/iqdb_queries?url=${encoded_image_path}" title="Query Danbooru using image" data-replace="2">${iqdb_text}</a>`;
    let no_sauce_text = preview ? '⛔' : 'no results';
    let sauce_text = preview ? 'S' : 'Sauce';
    let sauce_link = no_sauce_results ?
                     `<a class="npisas-reset-results npisas-database-no-match npisas-expanded-link npisas-check-link" data-type="sauce" data-replace="2">${no_sauce_text}</a>` :
                     `<a class="npisas-check-sauce npisas-expanded-link npisas-check-link" href="https://saucenao.com/search.php?db=999&url=${image_path}" title="Query SauceNAO using image" data-replace="2">${sauce_text}</a>`;
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
    return `
<span class="npisas-query-button npisas-query-results">${results_link}</span>
    |
<span class="npisas-query-button npisas-query-url">${url_link}</span>
    |
<span class="npisas-query-button npisas-query-iqdb">${iqdb_link}</span>
    |
<span class="npisas-query-button npisas-query-sauce">${sauce_link}</span>
    |
<span class="npisas-query-button npisas-query-help">${RenderHelp(help_info)}</span>
`;
}

function RenderHelp(help_text) {
    return `<a class="npisas-help-info npisas-expanded-link" title="${help_text}">&nbsp;?&nbsp;</a>`;
}

//Initialize functions

async function InitializeImageMainMenu($artworks,append_selector,menu_class) {
    let artwork = $artworks.get(0)
    let artwork_id = JSPLib.utility.getDOMAttributes($artworks, 'artwork-id', Number)[0];
    let $container = $(`<div style="display: flex;"><div class="npisas-link-menu ${menu_class} npisas-links"></div></div>`);
    let $link_container = $container.find('.' + menu_class);
    $(append_selector, artwork).append($container);
    let artwork_data = await GetArtworks([artwork_id]);
    let {image_url} = GetArtworkInfo($artworks);
    if (artwork_data[0]?.posts) {
        InitializePostIDsLink(artwork_id, $link_container, artwork, artwork_data[0].posts, false, image_url);
    } else {
        InitializeNoMatchesLinks(artwork_id, $link_container, image_url, false);
    }
}

function InitializeMainArtwork(artwork) {
    let $button = $('.pixiv-show-all-button', artwork);
    let $button_container = $('.pixiv-buttons-container', artwork);
    let $artwork_controls = $('.pixiv-artwork-controls', artwork);
    let menu_html = JSPLib.utility.regexReplace(MAIN_ARTWORK_MENU, {BOOKMARK_MENU_HELP: RenderHelp(BOOKMARK_MENU_HELP)});
    $artwork_controls.before(`<div class="npisas-controls-container" style="width: 36em; height: 110px; position: relative; z-index: 100;">${menu_html}</div>`);
    AdjustArtworkControls();
    InitializeImageMainMenu($(artwork), '.npisas-artwork-image-menu-links', 'npisas-artwork-menu');
}

async function InitializePreviewArtwork(artwork) {
    const $artwork = $(artwork);
    let artwork_id = Number($artwork.data('artwork-id'));
    let $container = $(MICRO_MAIN_MENU_HTML);
    $container.find('.npisas-upload-artwork').attr('href', 'https://danbooru.donmai.us/uploads/new?url=' + encodeURIComponent('https://www.pixiv.net/artworks/' + artwork_id));
    let $link_container = $container.find('.npisas-preview-menu');
    $artwork.find('.npisas-artwork-menu').append($container);
    GetArtworks([artwork_id]).then(([data]) => {
        let {image_url, image_count} = GetArtworkInfo($artwork);
        if (data.posts) {
            InitializePostIDsLink(artwork_id, $link_container, artwork, data.posts, true, image_url, image_count);
        } else {
            InitializeNoMatchesLinks(artwork_id, $link_container, image_url, true);
        }
    });
}

async function InitializePostIDsLink(artwork_id, $link_container, artwork, post_ids, preview, image_url, image_count) {
    let posts_data = await GetPosts(post_ids);
    let image_info = GetImageURLInfo(image_url);
    let database_match = true;
    if (image_info) {
        let current_date = image_info.date
        let image_dict = {};
        posts_data.forEach((post) => {
            let post_info = GetImageURLInfo(post.source);
            if (post_info) {
                image_dict[post_info.order] ??= [];
                image_dict[post_info.order].push(post_info.date);
            } else {
                JSPLib.notice.debugNotice("Found non-matching image from Danbooru.");
                JSPLib.debug.debugwarn("Non-matching image:", post, post.source);
            }
        });
        for (let order in image_dict) {
            if (image_count && Number(order) >= image_count) break;
            if (!image_dict[order].includes(current_date)) {
                database_match = false;
                break;
            }
        }
        console.log('InitializePostIDsLink-1', artwork_id, image_dict, database_match);
    }
    let link_class = database_match ? 'npisas-database-match' : 'npisas-database-mismatch';
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

//Update functions

function UpdatePostIDsLink(artwork_id, post_ids) {
    let $artwork = $(`[data-artwork-id=${artwork_id}]`);
    if ($artwork.length === 0) {
        return;
    }
    let $link_container = $('.npisas-link-menu', $artwork[0]);
    let preview = $artwork.attr('npisas-artwork') === 'preview';
    let {image_url} = GetArtworkInfo($artwork);
    if (post_ids.length === 0) {
        InitializeNoMatchesLinks(artwork_id, $link_container, image_url, preview);
    } else {
        InitializePostIDsLink(artwork_id, $link_container, $artwork[0], post_ids, preview, image_url);
    }
}

//Page functions

function PageNavigation(pagetype) {
    //Use all non-URL matching groups as a page key to detect page changes
    let page_key = JSPLib.utility.arrayUnique(Object.values(NPISAS.page_match)).join(',');
    if (NPISAS.page === pagetype && NPISAS.page_key === page_key) {
        return;
    }
    var params;
    let page_id = Number(NPISAS.page_match.id);
    NPISAS.prev_page = NPISAS.page;
    NPISAS.page = pagetype;
    NPISAS.page_key = page_key;
    ['user_id', 'type', 'tag', 'artwork_id'].forEach((key)=>{delete NPISAS[key];});
    switch (NPISAS.page) {
        case 'users':
        case 'illusts':
        case 'tagillusts':
        case 'bookmarks':
            JSPLib.debug.debuglog(`User pages [${NPISAS.page}]:`, page_id);
            NPISAS.user_id = page_id;
            NPISAS.type = NPISAS.page_match.type
            NPISAS.tag = NPISAS.page_match.tag
            break;
        case 'artworks':
            JSPLib.debug.debuglog(`Artworks page [${NPISAS.page}]:`, page_id);
            NPISAS.artwork_id = page_id;
            break;
        default:
            //Do nothing
    }
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
    let data_artwork = GetAPIData('artworks', NPISAS.artwork_id);
    if (data_artwork) {
        $artwork.attr('data-user-id', data_artwork.userId);
        $artwork.attr('data-pages', data_artwork.pageCount);
        NPISAS.multi_artwork = data_artwork.pageCount > 1;
        let page_class = (NPISAS.multi_artwork ? 'npisas-multi-artwork' : 'npisas-single-artwork');
        $artwork.addClass(page_class);
    } else {
        //Query for this data
    }
    $artwork.find('>figure').addClass('npisas-image-container');
    $artwork.find('>figcaption').addClass('npisas-captions');
    $artwork.find('>div').each((_,entry)=>{
        let $entry = $(entry);
        if ($entry.find('button').length > 1) {
            $entry.addClass('pixiv-artwork-controls');
            return false;
        }
    });
    let $controls = $artwork.find('.pixiv-artwork-controls');
    $controls.find('button').each((_,entry)=>{
        let $entry = $(entry);
        if (entry.innerText === "See all") {
            $entry.addClass('pixiv-show-all-button');
            let $parent = $entry.parent().addClass('pixiv-buttons-container');
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
    $artwork.append('<div class="npisas-artwork-menu" style="border: 1px #888 solid; padding: 5px; margin: 5px -5px; font-weight: bold; border-radius: 5px;"></div>');
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
        let artwork = NPISAS.artwork_data[NPISAS.artwork_id];
        let post_ids = (artwork && artwork.posts) || [];
        let artwork_posts = post_ids.map((post_id) => NPISAS.post_data[post_id]);
        $unprocessed_images.each((_,image)=>{
            let $image = $(image);
            let image_url = $image.data('image');
            let image_info = GetImageURLInfo(image_url)
            let image_key = image_info.id + '-' + image_info.order;
            let posts = artwork_posts.filter((post) => {
                let normalized_url = NormalizeSource(post.source);
                let post_info = GetImageURLInfo(normalized_url);
                if (post_info) {
                    let post_key = post_info.id + '-' + post_info.order;
                    console.log(NPISAS.artwork_id, post.id, image_key, post_key);
                    return post_key === image_key;
                }
                 return false;
            });
            if (posts.length === 1) {
                let post_url = NPISAS.domain + '/posts/' + posts[0].id;
                let title = GetLinkTitle(posts[0]);
                let text = 'post #' + posts[0].id;
                let match_class = (NormalizeSource(posts[0].source) === NormalizeSource(image_url) ? 'npisas-database-match' : 'npisas-database-mismatch');
                var html = `<a class="${match_class} npisas-expanded-link" href="${post_url}" title="${title}" target="_blank">${text}</a>`;
            } else if (posts.length > 1) {
                let matching_post = posts.find((post) => post.source == image_url);
                let post_url = NPISAS.domain + '/posts?tags=status%3Aany+id%3A' + post_ids.join(',');
                let title = GetMultiLinkTitle(posts);
                let text = post_ids.length + ' sources';
                let match_class = (matching_post ? 'npisas-database-match' : 'npisas-database-mismatch');
                html = `<a class="${match_class} npisas-expanded-link" href="${post_url}" title="${title}" target="_blank">${text}</a>`;
            } else {
                html = `<span class="npisas-database-no-match">not uploaded</span>`;
            }
            $image.append(`<div class="npisas-image-menu">( ${html} )</div>`);
        });
        $unprocessed_images.attr('pisas', 'done');
    }
}

//Storage functions

////Queue

function QueueStorageRequest(type,key,value,database) {
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
        JSPLib.debug.debugExecute(()=>{
            SAVED_STORAGE_REQUESTS.push(request);
        });
    }
    return CACHED_STORAGE_REQUESTS[queue_key];
}

function IntervalStorageHandler() {
    if (QUEUED_STORAGE_REQUESTS.length === 0) {
        return;
    }
    JSPLib.debug.debuglogLevel(()=>["Queued requests:",JSPLib.utility.dataCopy(QUEUED_STORAGE_REQUESTS)], JSPLib.debug.VERBOSE);
    for (let database in STORAGE_DATABASES) {
        let requests = QUEUED_STORAGE_REQUESTS.filter((request) => (request.database === database));
        let save_requests = requests.filter((request) => (request.type === 'save'));
        if (save_requests.length) {
             JSPLib.debug.debuglogLevel("Save requests:", save_requests, JSPLib.debug.DEBUG);
            let save_data = Object.assign(...save_requests.map((request) => ({[request.key]: request.value})));
            JSPLib.storage.batchSaveData(save_data, {database: STORAGE_DATABASES[database]}).then(()=>{
                save_requests.forEach((request)=>{
                    request.promise.resolve(null);
                    request.endtime = performance.now();
                });
            });
        }
        let remove_requests = requests.filter((request) => (request.type === 'remove'));
        if (remove_requests.length) {
            JSPLib.debug.debuglogLevel("Remove requests:", remove_requests, JSPLib.debug.DEBUG);
            let remove_keys = remove_requests.map((request) => request.key);
            JSPLib.storage.batchRemoveData(remove_keys, {database: STORAGE_DATABASES[database]}).then(()=>{
                remove_requests.forEach((request)=>{
                    request.promise.resolve(null);
                    request.endtime = performance.now();
                });
            });
        }
        let check_requests = requests.filter((request) => (request.type === 'check'));
        if (check_requests.length) {
            JSPLib.debug.debuglogLevel("Check requests:", check_requests, JSPLib.debug.DEBUG);
            let check_keys = check_requests.map((request) => request.key);
            JSPLib.storage.batchCheckLocalDB(check_keys, ValidateExpiration, {database: STORAGE_DATABASES[database]}).then((check_data)=>{
                FulfillStorageRequests(check_keys,check_data,check_requests);
            });
        }
        let noncheck_requests = requests.filter((request) => (request.type === 'get'));
        if (noncheck_requests.length) {
            JSPLib.debug.debuglogLevel("Noncheck requests:", noncheck_requests, JSPLib.debug.DEBUG);
            let noncheck_keys = noncheck_requests.map((request) => request.key);
            JSPLib.storage.batchRetrieveData(noncheck_keys, {database: STORAGE_DATABASES[database]}).then((noncheck_data)=>{
                FulfillStorageRequests(noncheck_keys,noncheck_data,noncheck_requests);
            });
        }
    }
    QUEUED_STORAGE_REQUESTS.length = 0;
}

function FulfillStorageRequests(keylist,data_items,requests) {
    keylist.forEach((key)=>{
        let data = (key in data_items ? data_items[key] : null);
        let request = requests.find((request) => (request.key === key));
        request.promise.resolve(data);
        request.data = data;
        JSPLib.debug.recordTimeEnd(key, 'Storage-queue');
    });
}

////Access

//////General

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


//////Danbooru

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

function SaveArtworks(mapped_artworks) {
    mapped_artworks.forEach((artwork) => {
        SaveData('artwork-' + artwork.id, artwork, 'pixiv');
    });
}

////Helpers

function InvalidateCache(key,database) {
    CACHE_STORAGE_TYPES.forEach((type)=>{
        let queue_key = type + '-' + key + '-' + database;
        delete CACHED_STORAGE_REQUESTS[queue_key];
    });
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
    JSPLib.debug.debugExecute(()=>{
        SAVED_NETWORK_REQUESTS.push(request);
    });
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
            const controller = NETWORK_REQUEST_DICT[type].controller || type;
            JSPLib.danbooru.submitRequest(controller, params, {default_val: [], domain: NPISAS.domain}).then((data_items)=>{
                requests.forEach((request)=>{
                    let request_data = data_items.filter((data) => request.item.includes(data[data_key]));
                    request.promise.resolve(request_data);
                    request.data = request_data;
                    JSPLib.debug.recordTimeEnd(request.request_key, 'Network-queue');
                });
            });
        }
    });
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
    posts_data.sort((a,b) => (post_ids.indexOf(a.id) - post_ids.indexOf(b.id)));
    posts_data.forEach((post)=>{
        NPISAS.post_data[post.id] = post;
    });
    return posts_data;
}

async function GetArtworks(artwork_ids) {
    let storage_data = await Promise.all(artwork_ids.map((id) => GetData('artwork-' + id, 'pixiv')));
    storage_data = storage_data.filter((data) => data !== null);
    let nonfound_ids = JSPLib.utility.arrayDifference(artwork_ids, JSPLib.utility.getObjectAttributes(storage_data, 'id'));
    let artworks_data = [], expired_artworks = [];
    storage_data.forEach((artwork) => {
        let expires = Math.round(artwork.queried + (JSPLib.utility.one_minute * 5));
        if(JSPLib.utility.validateExpires(expires)) {
            artworks_data.push(artwork);
        } else {
            expired_artworks.push(artwork);
        }
    });
    let expired_ids = JSPLib.utility.getObjectAttributes(expired_artworks, 'id');
    let lookup_ids = JSPLib.utility.arrayUnion(nonfound_ids, expired_ids);
    if (lookup_ids.length) {
        let network_posts = await QueueNetworkRequest('artworks', lookup_ids);
        let found_ids = [];
        if (network_posts.length) {
            let mapped_posts = network_posts.map(MapPost)
            SavePosts(mapped_posts);
            SavePostUsers(mapped_posts);
            let artwork_ids = JSPLib.utility.arrayUnique(JSPLib.utility.getObjectAttributes(mapped_posts, 'pixivid'));
            let mapped_artworks = artwork_ids.map((artwork_id) => MapArtwork(artwork_id, mapped_posts));
            let merged_artworks = JSPLib.utility.dataCopy(expired_artworks);
            mapped_artworks.forEach((merge) => {
                let original = merged_artworks.find((artwork) => artwork.id === merge.id);
                if (original) {
                    MergeArtwork(original, merge);
                } else {
                    merged_artworks.push(merge);
                }
            });
            SaveArtworks(merged_artworks);
            artworks_data = JSPLib.utility.concat(artworks_data, merged_artworks);
            found_ids = JSPLib.utility.getObjectAttributes(merged_artworks, 'id');
        }
        let missing_ids = JSPLib.utility.arrayDifference(lookup_ids, found_ids);
        if (missing_ids.length) {
            let notfound_artworks = missing_ids.map((artwork_id) => ({id: artwork_id, queried: Date.now()}));
            SaveArtworks(notfound_artworks);
            artworks_data = JSPLib.utility.concat(artworks_data, notfound_artworks);
        }
    }
    artworks_data.sort((a,b) => (artwork_ids.indexOf(a.id) - artwork_ids.indexOf(b.id)));
    artworks_data.forEach((artwork)=>{
        NPISAS.artwork_data[artwork.id] = artwork;
    });
    return artworks_data;
}

////Pixiv

async function GetIllusts(images_info) {
    GetIllusts.illusts ??= {};
    let artwork_ids = JSPLib.utility.getObjectAttributes(images_info, 'id');
    let missing_ids = JSPLib.utility.arrayDifference(artwork_ids, Object.keys(GetIllusts.illusts).map(Number));
    if (missing_ids.length) {
        let storage_data = await Promise.all(missing_ids.map((artwork_id) => GetData('illust-' + artwork_id, 'pixiv')));
        let storage_ids = storage_data.filter((data) => data !== null).map((data) => {
            let current_info = images_info.find((info) => info.id === data.id);
            if (current_info.date === data.date) {
                GetIllusts.illusts[data.id] = data;
                return current_info.id;
            }
        });
        let query_ids = JSPLib.utility.arrayDifference(missing_ids, storage_ids);
        if (query_ids.length) {
            let network_data = await JSPLib.network.getJSON('/ajax/user/1/illusts', {ids: query_ids});
            if (!network_data.error) {
                for (let i = 0; i < query_ids.length; i++) {
                    let artwork_id = query_ids[i];
                    let artwork_info = images_info.find((info) => info.id === artwork_id);
                    let is_ai = network_data.body[artwork_id]?.aiType === 2
                    GetIllusts.illusts[artwork_id] = {id: artwork_id, date: artwork_info.date, is_ai};
                    SaveData('illust-' + artwork_id, GetIllusts.illusts[artwork_id], 'pixiv');
                }
            }
        }
    }
    return JSPLib.utility.mergeHashes(...artwork_ids.map((artwork_id) => ({[artwork_id]: GetIllusts.illusts[artwork_id] ?? {}})));
}

async function GetIllustUrls(artwork_id, image_url) {
    GetIllustUrls.pages ??= {};
    if (!GetIllustUrls.pages[artwork_id]) {
        let image_info = GetImageURLInfo(image_url);
        let storage_data = await GetData('pages-' + artwork_id, 'pixiv');
        if (!storage_data || storage_data.date != image_info.date) {
            let network_data = await JSPLib.network.getJSON(`/ajax/illust/${artwork_id}/pages`);
            if (!network_data.body.error) {
                let image_info = GetImageURLInfo(network_data.body[0].urls.original);
                GetIllustUrls.pages[artwork_id] = JSPLib.utility.mergeHashes({id: image_info.id, date: image_info.date, urls: network_data.body});
                SaveData('pages-' + artwork_id, GetIllustUrls.pages[artwork_id], 'pixiv');
            } else {
                GetIllustUrls.pages[artwork_id] = {};
            }
        } else {
            GetIllustUrls.pages[artwork_id] = storage_data;
        }
    }
    return GetIllustUrls.pages[artwork_id];
};

//Event handlers

//// Click

async function CheckURL(event) {
    event.preventDefault();
    let {$link, artwork_id} = GetEventPreload(event, 'npisas-check-url');
    let timer = SetRotatingIcon($link);
    let data = await JSPLib.danbooru.submitRequest('posts', {tags: 'status:any pixiv_id:' + artwork_id, only: POST_FIELDS}, {default_val: [], domain: NPISAS.domain, notify: true});
    let post_ids = [];
    let update_promise = JSPLib.utility.createPromise();
    if (data.length === 0) {
        NPISAS.no_url_results.push(artwork_id);
        update_promise.resolve([]);
    } else {
        let mapped_posts = data.map(MapPost)
        SavePosts(mapped_posts);
        SavePostUsers(mapped_posts);
        let mapped_artwork = MapArtwork(artwork_id, mapped_posts);
        GetData('artwork-' + artwork_id, 'pixiv').then((artwork)=>{
            if (artwork) {
                artwork = MergeArtwork(artwork, mapped_artwork);
            } else {
                artwork = mapped_artwork;
            }
            SaveArtworks([artwork]);
            update_promise.resolve(artwork.posts);
        });
    }
    update_promise.promise.then((post_ids)=>{
        clearInterval(timer);
        UpdatePostIDsLink(artwork_id, post_ids);
    });
}

async function CheckIQDB(event) {
    event.preventDefault();
    let {$link, $artwork, artwork_id, preview, image_url, $replace} = GetEventPreload(event, 'npisas-check-iqdb');
    let timer = SetRotatingIcon($link);
    let iqdb_results = await JSPLib.danbooru.submitRequest('iqdb_queries', {url: image_url, similarity: NPISAS.user_settings.similarity_cutoff, limit: NPISAS.user_settings.results_returned}, {default_val: [], domain: NPISAS.domain, notify: true});
    let post_data = JSPLib.utility.getObjectAttributes(iqdb_results, 'post');
    let unique_posts = RemoveDuplicates(post_data, 'id');
    let mapped_posts = unique_posts.map(MapPost)
    let uploader_ids = JSPLib.utility.arrayUnique(JSPLib.utility.getObjectAttributes(mapped_posts, 'uploaderid'));
    let [user_data, network_users] = await GetItems(uploader_ids, 'user', 'users', 'danbooru');
    user_data = user_data.concat(network_users);
    mapped_posts.forEach((post) => {
        let user = user_data.find((user) => (user.id === post.uploaderid));
        post.uploadername = user.name;
    });
    SavePosts(mapped_posts);
    SaveUsers(network_users);
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
    clearInterval(timer);
    ProcessSimilarData('iqdb', artwork_id, $artwork, $replace, image_url, similar_data, preview);
}

async function CheckSauce(event) {
    event.preventDefault();
    NPISAS.user_settings.SauceNAO_API_key = JSPLib.saucenao.api_key = '7614ddf8db8f709dacf94b3f66a9efab87ed46d7';
    if (!NPISAS.user_settings.SauceNAO_API_key) {
        JSPLib.notice.error("<b>Error!</b> Must set SauceNAO API key in user settings.");
        return;
    }
    let {$link, $artwork, artwork_id, preview, image_url, $replace} = GetEventPreload(event, 'npisas-check-sauce');
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
    clearInterval(timer);
    ProcessSimilarData('sauce', artwork_id, $artwork, $replace, image_url, similar_data, preview);
    let sauce_remaining = sauce_results.header.long_remaining;
    $('#npisas-available-sauce').text(sauce_remaining);
    JSPLib.storage.saveData('npisas-available-sauce', {value: sauce_remaining, expires: JSPLib.utility.getExpires(SAUCE_EXPIRES)});
}

function ManualAdd(event) {
    let {$link, $artwork, artwork_id, preview, $replace} = GetEventPreload(event, 'npisas-manual-add');
    PromptSavePostIDs($link, $artwork, artwork_id, $replace, MANUAL_ADD_PROMPT, [], preview);
}

function ConfirmDelete(event) {
    let {$link, $artwork, artwork_id, preview, $replace} = GetEventPreload(event, 'npisas-confirm-delete');
    let all_post_ids = GetSessionPixivData(artwork_id);
    let message = JSPLib.utility.sprintf(CONFIRM_DELETE_PROMPT, all_post_ids);
    PromptSavePostIDs($link, $artwork, artwork_id, $replace, message, [], preview);
    event.preventDefault();
}

function ConfirmSave(event) {
    let {$link, $artwork, artwork_id, preview, $replace} = GetEventPreload(event, 'npisas-confirm-save');
    let save_post_ids = NPISAS.similar_results[artwork_id];
    if (NPISAS.merge_results.includes(artwork_id)) {
        let artwork = GetSessionPixivData(artwork_id);
        save_post_ids = JSPLib.utility.arrayUnion(artwork.posts, save_post_ids);
    }
    PromptSavePostIDs($link, $artwork, artwork_id, $replace, CONFIRM_SAVE_PROMPT, save_post_ids, preview);
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
    let {$artwork, artwork_id, preview, image_url, $replace} = GetEventPreload(event, 'npisas-cancel-merge');
    NPISAS.merge_results = JSPLib.utility.arrayDifference(NPISAS.merge_results, [artwork_id]);
    let artwork = GetSessionPixivData(artwork_id);
    InitializePostIDsLink(artwork_id, $replace, $artwork[0], artwork.posts, preview, image_url);
}

function HelpInfo(event) {
    let help_text = $(event.target).attr('title');
    alert(help_text);
}

function ShowPreviews(event) {
    let {artwork_id, image_url} = GetEventPreload(event, 'npisas-show-previews');
    if (!NPISAS.preview_dialog[artwork_id]) {
        InitializeUIStyle();
        GetIllustUrls(artwork_id, image_url).then((page_data) => {
            JSPLib.debug.debuglog("ShowPreviews-page_data", page_data);
            let $dialog = $('<div></div>');
            let $menu = $('<div></div>');
            //PREBOORU-start
            let encoded_url = encodeURIComponent('https://www.pixiv.net/en/artworks/' + artwork_id);
            $menu.append(`
                <div style="font-size: 16px; font-weight: bold; height: 2em;">
                    <a href="http://127.0.0.1:5000/uploads/all?upload[request_url]=${encoded_url}" target="_blank">All</a> |
                    <a href="http://127.0.0.1:5000/uploads/select?upload[request_url]=${encoded_url}" target="_blank">Select</a>
                </div>
                `);
            //PREBOORU-end
            let $images = $('<div style="display: flex; flex-wrap: wrap; overflow-y: auto; max-height: 65vh; overscroll-behavior: contain;"></div>');
            $menu.append($images);
            page_data.urls.forEach((url_data)=>{
                let $img_container = $('<div style="padding: 5px; height: 300px; width: 300px; text-align: center;"></div>');
                let $img = url_data.width > url_data.height ? $(`<img style="width: 300px; height: auto;" src=${url_data.urls.small}>`) : $(`<img style="width: auto; height: 300px;" src=${url_data.urls.small}>`);
                $img_container.on(PROGRAM_CLICK, (event) => {
                    let html = `
                <div class="npisas-popup-media-image">
                    <img src="${url_data.urls.regular}">
                </div>`;
                    let $popup = $(html);
                    $popup.appendTo(document.body);
                    $popup.on('mouseleave.npisas', () => {
                        $popup.remove();
                    });
                });
                $img_container.append($img);
                $images.append($img_container);
            });
            $dialog.append($menu);
            $dialog.dialog(PREVIEW_DIALOG_SETTINGS);
            $dialog.dialog('open');
            NPISAS.preview_dialog[artwork_id] = $dialog;
        });
    } else {
        NPISAS.preview_dialog[artwork_id].dialog('open');
    }
}

////Scroll

function AdjustArtworkControls() {
    if (NPISAS.page === 'artworks') {
        let $controls_container = $('.npisas-controls-container');
        if ($controls_container.length) {
            let $controls = $('.pixiv-artwork-controls');
            let is_viewable = JSPLib.utility.isScrolledIntoView($controls_container.get(0));//, 0.10);
            NPISAS.artwork_controls_translate = (NPISAS.artwork_controls_translate === undefined ? !is_viewable : NPISAS.artwork_controls_translate);
            if (!NPISAS.artwork_controls_translate && is_viewable) {
                $controls.css('transform', 'translateY(-225%)');
                NPISAS.artwork_controls_translate = true;
            } else if (NPISAS.artwork_controls_translate && !is_viewable) {
                $controls.css('transform', 'translateY(0%)');
                NPISAS.artwork_controls_translate = false;
            }
        }
    }
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
}

function ProcessArtworkImages() {
    let $unprocessed_images = $('.npisas-image:not([npisas-image]):not(.npisas-unhandled-image) img');
    if ($unprocessed_images.length) {
        JSPLib.debug.debuglog("Images found:", $unprocessed_images.length);
    }
    let images_info = [];
    $unprocessed_images.each((i, image) => {
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
            images_info.push(image_info);
        } else {
            $container.addClass('npisas-unhandled-image');
            if (JSPLib.validate.isBoolean(image_info)) {
                JSPLib.notice.debugNoticeLevel("New unhandled image found (see debug console)", JSPLib.debug.INFO);
                JSPLib.debug.debugwarn("Unhandled image", image.src, artwork_id);
            }
        }
    });
    if (images_info.length > 0) {
        JSPLib.debug.debuglog("Tweets updated:", images_info.length);
        GetIllusts(images_info).then((illusts) => {
            for (let artwork_id in illusts) {
                let $artwork = $(`.npisas-artwork[data-artwork-id="${artwork_id}"]`);
                $artwork.attr('data-ai', illusts[artwork_id].is_ai ?? false);
            }
        });
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
    let $image_containers = $landmarks.map((_,entry) => JSPLib.utility.getNthParent(entry, page_attr.imageparent))
                                      .filter((_,entry) => !entry.classList.contains('npisas-image'));
    $image_containers.each((_,image)=>{MarkupImageArtwork(image);});
    let $artwork_containers = $landmarks.map((_,entry) => JSPLib.utility.getNthParent(entry, page_attr.artworkparent))
                                        .filter((_,entry) => !entry.classList.contains('npisas-artwork'));
    $artwork_containers.each((_,entry)=>{
        $(entry).addClass('npisas-artwork').attr('viewed', 'false');
        if (NPISAS.page === 'artworks' && $('[href*="img-original"]', entry).length) {
            MarkupMainArtwork(entry);
            InitializeMainArtwork(entry);
            return false;
        } else {
            MarkupPreviewArtwork(entry);
            InitializePreviewArtwork(entry);
        }
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

function InitializeProgram() {
    NPISAS.domain = 'https://' + NPISAS.query_subdomain + '.donmai.us';
    JSPLib.saucenao.api_key = NPISAS.SauceNAO_API_key;
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
    $(document).on(PROGRAM_CLICK, '.npisas-help-info', HelpInfo);
    $(document).on('scroll.npisas.check_menu', AdjustArtworkControls);
    setInterval(IntervalStorageHandler, 500);
    setInterval(IntervalNetworkHandler, 500);
    JSPLib.utility.setCSSStyle(PROGRAM_CSS, 'program');
    JSPLib.utility.initializeInterval(RegularCheck, JSPLib.utility.one_second);
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
JSPLib.storage.localSessionValidator = ValidateProgramData;
JSPLib.storage.indexedDBValidator = ValidateEntry;
JSPLib.storage.prune_limit = 2000;

//Variables for validate.js
JSPLib.validate.dom_output = '#npisas-import-data-errors';

//variables for network.js
JSPLib.network.error_domname = '#npisas-error-messages';
JSPLib.network.rate_limit_wait = JSPLib.utility.one_second;

//Variables for danbooru.js
JSPLib.danbooru.max_network_requests = 10;

//Variables for notice.js
JSPLib.notice.program_shortcut = PROGRAM_SHORTCUT;

//Export JSPLib
JSPLib.load.exportData(PROGRAM_NAME, NPISAS, {other_data: {jQuery, API_DATA, SAVED_STORAGE_REQUESTS, SAVED_NETWORK_REQUESTS, HANDLED_IMAGES, PAGE_REGEXES}});
JSPLib.load.exportFuncs(PROGRAM_NAME, {debuglist: [GetPosts, GetItems, GetArtworks, GetIllustUrls, GetImageURLInfo, GetPageType, GetIllusts]});

/****Execution start****/

LoadHTMLData();
JSPLib.load.programInitialize(Main, {program_name: PROGRAM_NAME, required_variables: PROGRAM_LOAD_REQUIRED_VARIABLES, required_selectors: PROGRAM_LOAD_REQUIRED_SELECTORS, max_retries: 100, timer_interval: 500});
