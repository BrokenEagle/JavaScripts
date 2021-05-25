// ==UserScript==
// @name         New Pixiv Image Searches and Stuff
// @version      0.5
// @description  Alpha.
// @match        *://www.pixiv.net/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/core-js/3.11.0/minified.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.9.0/localforage.min.js
// @require      https://cdn.jsdelivr.net/npm/localforage-getitems@1.4.2/dist/localforage-getitems.min.js
// @require      https://cdn.jsdelivr.net/npm/localforage-setitems@1.4.0/dist/localforage-setitems.min.js
// @require      https://cdn.jsdelivr.net/npm/localforage-removeitems@1.4.0/dist/localforage-removeitems.min.js
// @require      https://cdn.jsdelivr.net/npm/xregexp@4.4.1/xregexp-all.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201230-module/lib/module.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/notice.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/concurrency.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/saucenao.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/menu.js
// @grant        GM.xmlHttpRequest
// @connect      donmai.us
// @run-at       document-body
// @noframes
// ==/UserScript==

/* eslint-disable no-unused-vars */

/* eslint-disable no-redeclare */
/* global $ jQuery JSPLib validate localforage saveAs XRegExp GM_getResourceText */
/* eslint-enable no-redeclare */

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
JSPLib.storage.bookmarkstorage = localforage.createInstance({
    name: 'Bookmark storage',
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
    no_url_results: [],
    merge_results: [],
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
.npisas-artwork .npisas-check-url,
.npisas-artwork .npisas-check-iqdb,
.npisas-artwork .npisas-check-sauce {
    display: inline-block;
    min-width: 64px;
    text-align: center;
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

//Message constants

const SAVE_HELP = "L-Click to save current settings. (Shortcut: Alt+S)";
const RESET_HELP = "L-Click to reset settings to default. (Shortcut: Alt+R)";
const SETTINGS_HELP = "L-Click to open settings menu. (Shortcut: Alt+M)";
const CLOSE_HELP = "L-Click to close. (Shortcut: Alt+C)";

const BOOKMARK_MENU_HELP = "All: L-click, submit post for bookmark\nSelect: L-click, choose images to submit for bookmark\nForce: L-click, toggle forcing upload even if one already exists\n    (yellow = default, red = force)";
const BOOKMARK_INFO_HELP = "thumbs: L-click, display post thumbnails (if exist)\nuploadlink: L-click, show/query upload(s) JSON\npostlink: L-click, show/query post(s) JSON\n";

//Regex constants

const IMAGE_REGEX = XRegExp.tag('x')`
^https?://[^.]+\.pximg\.net             # Hostname
(?:/c/\w+)?                             # Size 1
/img-(?:original|master)/img/           # Path
\d{4}/\d{2}/\d{2}/\d{2}/\d{2}/\d{2}/    # Date
(\d+)_                                  # ID
p(\d+)                                  # Order
(?:_(?:master|square)1200)?             # Size 2
\.(jpg|png|gif|mp4|zip)                 # Extension
`;

var PIXIV_ACCOUNT = String.raw`[\w-]+`;
var PIXIV_ID = String.raw`\d+`;
var PIXIV_USERS = String.raw`en/users/`;
var PIXIV_ARTWORKS = String.raw`en/artworks/`;
var QUERY_END = String.raw`(?:\?|$)`;

var ALL_PAGE_REGEXES = {
    users: {
        format: ' {{users}} ({{users_id}}) {{end}} ',
        subs: {
            users_id: PIXIV_ID,
            users: PIXIV_USERS,
            end: QUERY_END,
        }
    },
    illusts: {
        format: ' {{users}} ({{illusts_id}}) / ({{illusts_type}}) {{end}} ',
        subs: {
            illusts_id: PIXIV_ID,
            users: PIXIV_USERS,
            illusts_type: 'illustrations|manga|novels',
            end: QUERY_END,
        }
    },
    tagillusts: {
        format: ' {{users}} ({{tagillusts_id}}) / ({{tagillusts_type}}) / ({{tagillusts_tag}}) {{end}} ',
        subs: {
            tagillusts_id: PIXIV_ID,
            users: PIXIV_USERS,
            tagillusts_type: 'illustrations|manga|novels',
            tagillusts_tag: '[^?]+',
            end: QUERY_END,
        }
    },
    bookmarks: {
        format: ' {{users}} ({{bookmarks_id}}) {{bookmarks}} ({{bookmarks_type}}) {{end}} ',
        subs: {
            bookmarks_id: PIXIV_ID,
            users: PIXIV_USERS,
            bookmarks: '/bookmarks/',
            bookmarks_type: 'artworks|novels',
            end: QUERY_END,
        }
    },
    artworks: {
        format: ' {{artworks}} ({{artworks_id}}) {{end}} ',
        subs: {
            artworks_id: PIXIV_ID,
            artworks: PIXIV_ARTWORKS,
            end: QUERY_END,
        }
    },
};

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
    bookmark: JSPLib.storage.bookmarkstorage,
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

//Other constants

const GOLD_LEVEL = 30;

//UI constants

const PREVIEW_QTIP_SETTINGS = {
    style: {
        classes: 'qtiptisas-twitter npisas-preview-tooltip',
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
        classes: 'qtiptisas-twitter npisas-image-tooltip',
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
    resizable:false,
    autoOpen: false,
    classes: {
        'ui-dialog': 'npisas-dialog',
        'ui-dialog-titlebar-close': 'npisas-dialog-close'
    },
    open: function () {
        this.promiseConfirm = new Promise((resolve)=>{this.resolveConfirm = resolve;});
    },
    close: function () {
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

const BOOKMARK_DIALOG_SETTINGS = {
    title: "Bookmark thumbnails",
    modal: true,
    resizable:false,
    autoOpen: false,
    classes: {
        'ui-dialog': 'npisas-dialog',
        'ui-dialog-titlebar-close': 'npisas-dialog-close'
    },
    buttons: {
        'Close': function () {
            $(this).dialog('close');
        },
    }
};

const MENU_DIALOG_SETTINGS = {
    modal: true,
    resizable:false,
    autoOpen: false,
    width: 1000,
    height: 800,
    classes: {
        'ui-dialog': 'npisas-dialog',
        'ui-dialog-titlebar-close': 'npisas-dialog-close'
    },
    open: ()=>{
        NPISAS.opened_menu = true;
    },
    close: ()=>{
        NPISAS.opened_menu = false;
    },
    buttons: {
        //Save and reset are bound separately
        'Save': (()=>{}),
        'Factory reset': (()=>{}),
        'Close': function () {
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

const USER_EXPIRES = JSPLib.utility.one_month;

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

function GetLocalData(key,default_val) {
    return JSPLib.storage.getStorageData(key, localStorage, default_val);
}

function CheckLocalData(key,default_val) {
    return JSPLib.storage.checkStorageData(key, ValidateProgramData, localStorage, default_val);
}

function SetLocalData(key,data) {
    JSPLib.storage.setStorageData(key, data, localStorage);
}

function InvalidateLocalData(key) {
    JSPLib.storage.invalidateStorageData(key, localStorage);
}

function GetSessionTwitterData(tweet_id) {
    return JSPLib.storage.getIndexedSessionData('tweet-' + tweet_id, STORAGE_DATABASES.twitter, []);
}

function GetDomDataIds($obj, key) {
    let data = $obj.data(key);
    if (Number.isInteger(data)) {
        return [data];
    }
    if (Array.isArray(data)) {
        return data;
    }
    if (!data) {
        return [];
    }
    try {
        return data.split(',').map(Number);
    } catch (e) {
        JSPLib.notice.error("Error: GetDomDataIds");
        console.log("Bad data", data, e);
        return [];
    }
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

function PageRegex() {
    if (!NPISAS.page_regex) {
        let built_regexes = Object.assign({}, ...Object.keys(ALL_PAGE_REGEXES).map((page)=>{
            //Match at beginning of string with Twitter URL
            let regex = XRegExp.build(`^ https://www.pixiv.net/ ` + ALL_PAGE_REGEXES[page].format, ALL_PAGE_REGEXES[page].subs, 'x');
            //Add page named capturing group
            return {[page]: XRegExp.build(' ( {{' + page + '}} ) ', {[page]: regex}, 'x')};
        }));
        //Combine all regexes
        let all_format = Object.keys(built_regexes).map((page) => (' {{' + page + '}} ')).join('|');
        let all_regex = XRegExp.build(all_format, built_regexes, 'x');
        //Add overall capturing group...
        NPISAS.page_regex = XRegExp.build(' ( {{site}} )', {site: all_regex}, 'x');
    }
    return NPISAS.page_regex;
}

function GetPageType() {
    NPISAS.page_match = XRegExp.exec(window.location.href.split('#')[0], PageRegex());
    if (!NPISAS.page_match) {
        return 'other';
    }
    switch (NPISAS.page_match.site) {
        case NPISAS.page_match.users:
            return 'users';
        case NPISAS.page_match.illusts:
            return 'illusts';
        case NPISAS.page_match.tagillusts:
            return 'tagillusts';
        case NPISAS.page_match.bookmarks:
            return 'bookmarks';
        case NPISAS.page_match.artworks:
            return 'artworks';
        default:
            JSPLib.debug.debugwarn("Regex error:", window.location.href, NPISAS.page_match);
            return 'default';
    }
}

const PAGE_ATTRIBUTES = {
    'artworks': {
        selector: 'div:not(.npisas-image) > div[role="presentation"] > a > img',
        imageparent: 3,
        artworkparent: 6,
    },
};


function OriginalImageUrl(image_url) {
    image_url = image_url.replace('img-master', 'img-original');
    image_url = image_url.replace(XRegExp.tag()`_(?:master|square)1200`, "");
    image_url = image_url.replace(XRegExp.tag()`(?:/c/\w+)`, "");
    return image_url;
}

function MarkupImageArtwork(image) {
    let $image = $(image);
    $image.addClass('npisas-image');
    let $link = $image.find('a');
    let image_url = $link.attr('href');
    let image_match = image_url && IMAGE_REGEX.exec(image_url);
    if (image_match) {
        $image.attr('data-image', image_url);
        $image.attr('data-num', image_match[2]);
    }
}

const MAIN_ARTWORK_MENU = `
<div class="npisas-artwork-controls">
<div class="npisas-artwork-image-menu" style="border: 2px solid black;">
    <div class="npisas-artwork-header">NPISAS</div>
    <div class="npisas-artwork-image-menu-links npisas-links">
    </div>
</div>
<div class="npisas-bookmark-entry npisas-links" data-upload-ids="" data-post-ids="" data-illust-ids="" data-artist-ids="134" style="display: flex; border: 2px solid black; padding: 0.5em; font-size: 16px; font-weight: bold; font-family: 'Segoe UI', Arial, sans-serif;">
    <div style="border-right: 1px solid grey; padding-right: 0.25em;">
        <div class="npisas-bookmark-header" style="font-size: 1.4em;">Prebooru</div>
        <div style="margin: 0.25em -0.5em 0;">〈&thinsp;<a class="npisas-bookmark-thumbs npisas-expanded-link">thumbs</a>&thinsp;〉</div>
    </div>
    <div class="npisas-bookmark-section">
        <div class="npisas-bookmark-controls">
            Upload
            <span class="npisas-create-uploads">
                <a class="npisas-all-bookmark npisas-expanded-link">All</a> |
                <a class="npisas-select-bookmark npisas-expanded-link">Select</a> |
                <a class="npisas-force-download npisas-expanded-link">Force</a>
            </span>
            <span class="npisas-create-illusts">
                <a class="npisas-expanded-link">Illust</a>
            </span>
            <span class="npisas-create-artists">
                <a class="npisas-expanded-link">Artist</a>
            </span>
            ( %BOOKMARK_MENU_HELP% )
        </div>
        <div class="npisas-bookmark-progress" style="width: 360px; height: 28px; display: none;"></div>
        <div class="npisas-bookmark-info"></div>
    </div>
</div>
</div>
`;


//Database functions



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

function InvalidateCache(key,database) {
    CACHE_STORAGE_TYPES.forEach((type)=>{
        let queue_key = type + '-' + key + '-' + database;
        delete CACHED_STORAGE_REQUESTS[queue_key];
    });
}

function FulfillStorageRequests(keylist,data_items,requests) {
    console.log("FulfillStorageRequests-1", data_items, requests);
    keylist.forEach((key)=>{
        let data = (key in data_items ? data_items[key] : null);
        let request = requests.find((request) => (request.key === key));
        console.log("FulfillStorageRequests-2", data, request);
        request.promise.resolve(data);
        request.data = data;
        JSPLib.debug.recordTimeEnd(key, 'Storage-queue');
    });
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
            JSPLib.storage.batchSaveData(save_data, STORAGE_DATABASES[database]).then(()=>{
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
            JSPLib.storage.batchRemoveData(remove_keys, STORAGE_DATABASES[database]).then(()=>{
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
            JSPLib.storage.batchCheckLocalDB(check_keys, ValidateEntry, ValidateExpiration, STORAGE_DATABASES[database]).then((check_data)=>{
                FulfillStorageRequests(check_keys,check_data,check_requests);
            });
        }
        let noncheck_requests = requests.filter((request) => (request.type === 'get'));
        if (noncheck_requests.length) {
            JSPLib.debug.debuglogLevel("Noncheck requests:", noncheck_requests, JSPLib.debug.DEBUG);
            let noncheck_keys = noncheck_requests.map((request) => request.key);
            JSPLib.storage.batchRetrieveData(noncheck_keys, STORAGE_DATABASES[database]).then((noncheck_data)=>{
                FulfillStorageRequests(noncheck_keys,noncheck_data,noncheck_requests);
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
            JSPLib.danbooru.submitRequest(controller, params, [], false, null, NPISAS.domain).then((data_items)=>{
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

function RenderHelp(help_text) {
    return `<a class="npisas-help-info npisas-expanded-link" title="${help_text}">&nbsp;?&nbsp;</a>`;
}

async function InitializeNoMatchesLinks(pixiv_id,$obj) {
    let [iqdb_results,sauce_results] = await Promise.all([
        GetData('iqdb-' + pixiv_id, 'danbooru'),
        GetData('sauce-' + pixiv_id, 'danbooru'),
    ]);
    let merge_results = NPISAS.merge_results.includes(pixiv_id);
    console.log("InitializeNoMatchesLinks:", iqdb_results, sauce_results, merge_results);
    $obj.html(RenderNomatchLinks(pixiv_id, iqdb_results !== null && iqdb_results.value, sauce_results !== null && sauce_results.value, merge_results));
}

function RenderNomatchLinks(pixiv_id,no_iqdb_results,no_sauce_results,merge_results=false) {
    let results_link = (!merge_results ? '<a class="npisas-manual-add npisas-database-no-match npisas-expanded-link">no sources</a>' : '<a class="npisas-cancel-merge npisas-expanded-link">Cancel</a>');
    let no_url_results = NPISAS.no_url_results.includes(pixiv_id);
    let iqdb_link = (no_iqdb_results ? '<a class="npisas-reset-results npisas-database-no-match npisas-expanded-link" data-type="iqdb">no results</a>' : '<a class="npisas-check-iqdb npisas-expanded-link">IQDB</a>');
    let url_link = (no_url_results ? '<a class="npisas-manual-add npisas-database-no-match npisas-expanded-link">no sources</a>' : '<a class="npisas-check-url npisas-expanded-link">URL</a>');
    let sauce_link = (no_sauce_results ? '<a class="npisas-reset-results npisas-database-no-match npisas-expanded-link" data-type="sauce">no results</a>' : '<a class="npisas-check-sauce npisas-expanded-link">Sauce</a>');
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

function InitializeMainArtwork(artwork) {
    let $button = $('.pixiv-show-all-button', artwork);
    let $button_container = $('.pixiv-buttons-container', artwork);
    let $artwork_controls = $('.pixiv-artwork-controls', artwork);
    /*
    let $section = $('<section class="pixiv-show-all-section" style="display: flex; justify-content: center; position: absolute;"></section>');
    $section.append($button);
    $button.css({padding: '0px', position: 'unset', width: 'unset'});
    $button_container.css('flex-direction', 'column');
    $button_container.append($section);
    */
    let menu_html = JSPLib.utility.regexReplace(MAIN_ARTWORK_MENU, {BOOKMARK_MENU_HELP: RenderHelp(BOOKMARK_MENU_HELP)});
    $artwork_controls.before(`<div class="npisas-controls-container" style="width: 35em; height: 110px; position: relative; z-index: 100;">${menu_html}</div>`);
    AdjustArtworkControls();
    InitializeImageMenu($(artwork), '.npisas-artwork-image-menu-links', 'npisas-artwork-menu');
}

async function InitializePostIDsLink(tweet_id, $link_container, tweet, post_ids) {
    let posts_data = await GetPosts(post_ids);
    $link_container.html(RenderPostIDsLink(posts_data, 'npisas-database-match'));
    if (NPISAS.user_settings.advanced_tooltips_enabled) {
        let $link = $('.npisas-database-match, .npisas-confirm-save', tweet);
    }
}


function GetImageLinks(tweet) {
    let $obj = $('[data-image-url]', tweet).sort((entrya,entryb)=>($(entrya).data('image-num') - $(entryb).data('image-num')));
    return JSPLib.utility.getDOMAttributes($obj, 'image-url');
}


function GetLinkTitle(post) {
    let tags = JSPLib.utility.HTMLEscape(post.tags);
    let age = JSPLib.utility.HTMLEscape(`age:"${TimeAgo(post.created)}"`);
    return `user:${post.uploadername} score:${post.score} favcount:${post.favcount} rating:${post.rating} ${age} ${tags}`;
}

function GetMultiLinkTitle(posts) {
    let title = [];
    posts.forEach((post)=>{
        let age = JSPLib.utility.HTMLEscape(`age:"${TimeAgo(post.created)}"`);
        title.push(`post #${post.id} - user:${post.uploadername} score:${post.score} favcount:${post.favcount} rating:${post.rating} ${age}`);
    });
    return title.join('\n');
}

function GetCustomQuery() {
    return (NPISAS.user_settings.custom_order_enabled && (NPISAS.user_data.level >= GOLD_LEVEL) ? '+order%3Acustom' : '');
}

function RenderPostIDsLink(posts,classname) {
    let mergelink = "";
    let helpinfo = CONFIRM_DELETE_HELP;
    if (NPISAS.user_settings.merge_results_enabled) {
        mergelink = ' | <a class="npisas-merge-results npisas-expanded-link">Merge</a>';
        helpinfo += '\n' + MERGE_RESULTS_HELP;
    }
    let helplink = RenderHelp(helpinfo);
    let post_ids = JSPLib.utility.getObjectAttributes(posts, 'id');
    if (posts.length === 1) {
        let title = GetLinkTitle(posts[0]);
        return `( <a class="npisas-confirm-delete ${classname} npisas-expanded-link" target="_blank" title="${title}" href="${NPISAS.domain}/posts/${post_ids[0]}">post #${post_ids[0]}</a>${mergelink} | ${helplink} )`;
    } else {
        let title = GetMultiLinkTitle(posts);
        return `( <a class="npisas-confirm-delete ${classname} npisas-expanded-link" target="_blank" title="${title}" href="${NPISAS.domain}/posts?tags=status%3Aany+id%3A${post_ids.join(',')}${GetCustomQuery()}">${post_ids.length} sources</a>${mergelink} | ${helplink} ) `;
    }
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
    posts_data.forEach((post)=>{
        NPISAS.post_data[post.id] = post;
    });
    return posts_data;
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

function MapPostData(posts) {
    return posts.map(MapPost);
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
        created: new Date(post.created_at).getTime(),
        thumbnail: post.preview_file_url,
        source: post.source,
        ext: post.file_ext,
        size: post.file_size,
        width: post.image_width,
        height: post.image_height
    };
}

const MIN_POST_EXPIRES = JSPLib.utility.one_day;
const MAX_POST_EXPIRES = JSPLib.utility.one_month;

function LogarithmicExpiration(count, max_count, time_divisor, multiplier) {
    let time_exponent = Math.pow(10, (1 / time_divisor));
    return Math.round(Math.log10(time_exponent + (10 - time_exponent) * (count / max_count)) * multiplier);
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

function RemoveDuplicates(obj_array,attribute){
    const attribute_index = JSPLib.utility.getObjectAttributes(obj_array, attribute);
    return obj_array.filter((obj,index) => (attribute_index.indexOf(obj[attribute]) === index));
}

function SavePosts(mapped_posts) {
    mapped_posts.forEach((mapped_post)=>{
        let expires_duration = PostExpiration(mapped_post.created);
        let data_expires = JSPLib.utility.getExpires(expires_duration);
        console.log("SavePosts-1", expires_duration, GetDateString(mapped_post.created, data_expires));
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
    for (let artwork_id in mapped_artworks) {
        SaveData('artwork-' + artwork_id, mapped_artworks[artwork_id], 'pixiv');
    }
}

function MapArtworkData(mapped_posts) {
    let artwork_ids = JSPLib.utility.getObjectAttributes(mapped_posts, 'pixivid');
    let retdata = {};
    artwork_ids.forEach((artwork_id)=>{
        let artwork_posts = mapped_posts.filter((post) => post.pixivid === artwork_id);
        let post_ids = JSPLib.utility.getObjectAttributes(mapped_posts, 'id');
        let post_sources = JSPLib.utility.getObjectAttributes(mapped_posts, 'source');
        retdata[artwork_id] = {
            posts: post_ids,
            sources: post_sources,
            queried: Date.now(),
        }
    });
    console.log("MapArtworkData-1", artwork_ids, retdata);
    return retdata
}

async function GetArtworks(artwork_ids) {
    let storage_promises = artwork_ids.map((id) => GetData('artwork-' + id, 'pixiv'));
    let storage_data = await Promise.all(storage_promises);
    let retdata = {};
    for (let i = 0; i < storage_data.length; i++ ) {
        let artwork_id = artwork_ids[i];
        if (storage_data[i] !== null) {
            retdata[artwork_id] = storage_data[i];
        }
    }
    let found_ids = Object.keys(retdata).map(Number);
    let missing_ids = JSPLib.utility.arrayDifference(artwork_ids, found_ids);
    if (missing_ids.length) {
        console.log("GetArtworks-0a");
        var network_posts = await QueueNetworkRequest('artworks', missing_ids);
        if (network_posts.length) {
            console.log("GetArtworks-0b");
            let mapped_posts = MapPostData(network_posts);
            SavePosts(mapped_posts);
            SavePostUsers(mapped_posts);
            let mapped_artworks = MapArtworkData(mapped_posts);
            SaveArtworks(mapped_artworks);
            Object.assign(retdata, mapped_artworks);
        }
        let network_ids = JSPLib.utility.getObjectAttributes(network_posts, 'id');
        let notfound_ids = JSPLib.utility.arrayDifference(missing_ids, network_ids);
        if (notfound_ids.length) {
            let mapped_missing = {};
            notfound_ids.forEach((artwork_id)=>{
                mapped_missing[artwork_id] = {queried: Date.now()};
            });
            SaveArtworks(mapped_missing);
            Object.assign(retdata, mapped_missing);
        }
    }
    console.log("GetArtworks-1", storage_data, retdata, found_ids, missing_ids, network_posts);
    Object.assign(NPISAS.artwork_data, retdata);
    return retdata;
}



async function InitializeImageMenu($artworks,append_selector,menu_class) {
    let artwork_ids = JSPLib.utility.arrayUnique(JSPLib.utility.getDOMAttributes($artworks, 'artwork-id', Number));
    let artwork_data = await GetArtworks(artwork_ids);
    console.log("InitializeImageMenu-1", artwork_data);
    let promise_array = [];
    $artworks.each((_,artwork)=>{
        //$(append_selector, artwork).addClass('npisas-image-menu');
        let artwork_id = String($(artwork).data('artwork-id'));
        let $link_container = $(`<div class="npisas-link-menu ${menu_class} npisas-links"><span style="font-weight:bold">Loading...</span></div>`);
        $(append_selector, artwork).append($link_container);
        if (artwork_id in artwork_data && artwork_data[artwork_id].posts) {
            InitializePostIDsLink(artwork_id, $link_container, artwork, artwork_data[artwork_id].posts);
        } else {
            InitializeNoMatchesLinks(artwork_id, $link_container);
        }
    });
}


function PageNavigation(pagetype) {
    //Use all non-URL matching groups as a page key to detect page changes
    let page_key = JSPLib.utility.arrayUnique(
        Object.values(NPISAS.page_match).filter((val) => (JSPLib.validate.isString(val) && !val.startsWith('https:')))
    ).join(',');
    if (NPISAS.page === pagetype && NPISAS.page_key === page_key) {
        return;
    }
    var params;
    let page_id = NPISAS.page_match[pagetype + '_id'];
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
            NPISAS.type = NPISAS.page_match[pagetype + '_type'];
            NPISAS.tag = NPISAS.page_match[pagetype + '_tag'];
            break;
        case 'artworks':
            JSPLib.debug.debuglog(`Artworks page [${NPISAS.page}]:`, page_id);
            NPISAS.artwork_id = page_id;
            break;
        default:
            //Do nothing
    }
}



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

function AdjustArtworkControls() {
    if (NPISAS.page === 'artworks') {
        let $controls_container = $('.npisas-controls-container');
        if ($controls_container.length) {
            let $controls = $('.pixiv-artwork-controls');
            //let $show_all = $(".pixiv-show-all-section");
            let is_viewable = JSPLib.utility.isScrolledIntoView($controls_container.get(0));//, 0.10);
            NPISAS.artwork_controls_translate = (NPISAS.artwork_controls_translate === undefined ? !is_viewable : NPISAS.artwork_controls_translate);
            //console.log(NPISAS.artwork_controls_translate, is_viewable, $controls);
            if (!NPISAS.artwork_controls_translate && is_viewable) {
                //let translate_percent = (NPISAS.multi_expanded ? 150 : );
                $controls.css('transform', 'translateY(-225%)');
//                $show_all.css({top: '-2.5em', right: 0});
                NPISAS.artwork_controls_translate = true;
            } else if (NPISAS.artwork_controls_translate && !is_viewable) {
                $controls.css('transform', 'translateY(0%)');
  //              $show_all.css({top: '4px', right: '15em'});
                NPISAS.artwork_controls_translate = false;
            }
        }
    }
}


//Markup functions

function MarkupMainArtwork(artwork) {
    let $artwork = $(artwork);
    console.log("#0", artwork, $artwork);
    $artwork.addClass('npisas-artwork npisas-main-artwork');
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
}

function CheckExpandedImages() {
    if (!NPISAS.multi_expanded) {
        let $artwork_images = $('.npisas-main-artwork.npisas-multi-artwork .npisas-image');
        if ($artwork_images.length > 1) {
            console.log("Multi-expansion detected!");
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
        let posts = post_ids.map((post_id) => NPISAS.post_data[post_id]);
        $unprocessed_images.each((_,image)=>{
            let $image = $(image);
            let image_url = $image.data('image');
            let image_key = image_url.match(IMAGE_REGEX)[2];
            let posts = posts.filter((post) => JSPLib.utility.safeMatch(post.source, IMAGE_REGEX, 2) === image_key);
            if (post.length === 1) {
                let post_url = NPISAS.domain + '/posts/' + post.id;
                let title = GetLinkTitle(post);
                let text = 'post #' + post.id;
                let match_class = (posts[0].source === image_url ? 'npisas-database-match' : 'npisas-database-mismatch');
                var html = `<a class="${match_class} npisas-expanded-link" href="${post_url}" title="${title}" target="_blank">${text}</a>`;
            } else if (posts.length > 1) {
                let matching_post = posts.find((post) => post.source == image_url);
                let post_url = NPISAS.domain + '/posts?tags=status%3Aany+id%3A' + post_ids.join(',');
                let title = GetMultiLinkTitle(posts);
                let text = post_ids.length + ' sources';
                let match_class = (matching_post ?  'npisas-database-match' : 'npisas-database-mismatch');
                html = `<a class="${match_class} npisas-expanded-link" href="${post_url}" title="${title}" target="_blank">${text}</a>`;
            } else {
                html = `<span class="npisas-database-no-match">not uploaded</span>`;
            }
            $image.append(`<div class="npisas-image-menu">( ${html} )</div>`);
        });
        $unprocessed_images.attr('pisas', 'done');
    }
}

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
    //Process events on newly rendered posts that should only be done once
    if (!ProcessNewArtworks()) {
        //Only process further if there are new posts
        return;
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
    JSPLib.debug.debuglog(NPISAS.uniqueid);
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
        } else {
            //MarkupPreviewArtwork(entry);
        }
    });
    JSPLib.debug.debuglog(`[${NPISAS.uniqueid}]`, "New:", $artwork_containers.length, "Image:", $image_containers.length);
    if ($image_containers.length && NPISAS.page === 'artworks') {
        //Add individual image menus for multi-images on artworks view when multi images are shown
        //Like with old PISAS
    }
    return true;
}

//Settings functions

function BroadcastTISAS(ev) {
    JSPLib.debug.debuglog(`(${ev.data.type}):`, ev.data);
}

function SetQueryDomain() {
    NPISAS.domain = 'https://' + NPISAS.user_settings.query_subdomain + '.donmai.us';
}

function SetSauceAPIKey() {
    JSPLib.saucenao.api_key = NPISAS.user_settings.SauceNAO_API_key;
}

//Main function

function Main() {
    JSPLib.network.jQuerySetup();
    JSPLib.notice.installBanner(PROGRAM_SHORTCUT);
    Object.assign(NPISAS, {
        channel: JSPLib.utility.createBroadcastChannel(PROGRAM_NAME, BroadcastTISAS),
        user_settings: JSPLib.menu.loadUserSettings(),
    }, PROGRAM_DEFAULT_VALUES, PROGRAM_RESET_KEYS);
    SetQueryDomain();
    SetSauceAPIKey();
    //await InstallUserProfileData();
    /*
    $(document).on(PROGRAM_CLICK, '.npisas-check-url', CheckURL);
    $(document).on(PROGRAM_CLICK, '.npisas-check-iqdb', CheckIQDB);
    $(document).on(PROGRAM_CLICK, '.npisas-check-sauce', CheckSauce);
    $(document).on(PROGRAM_CLICK, '.npisas-manual-add', ManualAdd);
    $(document).on(PROGRAM_CLICK, '.npisas-confirm-save', ConfirmSave);
    $(document).on(PROGRAM_CLICK, '.npisas-confirm-delete', ConfirmDelete);
    $(document).on(PROGRAM_CLICK, '.npisas-reset-results', ResetResults);
    $(document).on(PROGRAM_CLICK, '.npisas-merge-results', MergeResults);
    $(document).on(PROGRAM_CLICK, '.npisas-cancel-merge', CancelMerge);
    $(document).on(PROGRAM_CLICK, '.npisas-help-info', HelpInfo);
    $(document).on(PROGRAM_CLICK, '.npisas-post-preview a', SelectPreview);
    $(document).on(PROGRAM_CLICK, '.npisas-force-download', ToggleForceDownload);
    $(document).on(PROGRAM_CLICK, '.npisas-all-bookmark', BookmarkAll);
    $(document).on(PROGRAM_CLICK, '.npisas-select-bookmark', BookmarkSelect);
    $(document).on(PROGRAM_CLICK, '.npisas-bookmark-uploads', BookmarkUploads);
    $(document).on(PROGRAM_CLICK, '.npisas-bookmark-posts', BookmarkPosts);
    $(document).on(PROGRAM_CLICK, '.npisas-bookmark-illusts', BookmarkIllusts);
    $(document).on(PROGRAM_CLICK, '.npisas-bookmark-artists', BookmarkArtists);
    $(document).on(PROGRAM_CLICK, '.npisas-bookmark-thumbs', BookmarkThumbs);
    $(document).on('scroll.npisas.check_views', CheckViews);
    $(window).on('focus.npisas.check_views', CheckViews);
    */
    $(document).on('scroll.npisas.check_menu', AdjustArtworkControls);
    setInterval(IntervalStorageHandler, 500);
    setInterval(IntervalNetworkHandler, 500);
    JSPLib.utility.setCSSStyle(PROGRAM_CSS, 'program');
    JSPLib.utility.initializeInterval(RegularCheck, JSPLib.utility.one_second);
    NPISAS.pending_uploads = GetLocalData('npisas-pending-bookmarks', []);
    //JSPLib.utility.initializeInterval(BookmarkServerRecheck, JSPLib.utility.one_second * 2.5);
    //InitializeCleanupTasks();
}

/****Initialization****/

//Variables for debug.js
JSPLib.debug.debug_console = true;
JSPLib.debug.level = JSPLib.debug.ALL;
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
JSPLib.load.exportData(PROGRAM_NAME, NPISAS, {XRegExp, jQuery, API_DATA, IMAGE_REGEX, SAVED_STORAGE_REQUESTS, SAVED_NETWORK_REQUESTS});

/****Execution start****/

LoadHTMLData();
//JSPLib.network.installXHRHook([TweetUserData]);
JSPLib.load.programInitialize(Main, PROGRAM_NAME, PROGRAM_LOAD_REQUIRED_VARIABLES, PROGRAM_LOAD_REQUIRED_SELECTORS, [], 100);

