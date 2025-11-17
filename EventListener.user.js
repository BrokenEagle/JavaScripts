// ==UserScript==
// @name         EventListener
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      25.0
// @description  Informs users of new events (flags,appeals,dmails,comments,forums,notes,commentaries,post edits,wikis,pools,bans,feedbacks,mod actions)
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @exclude      /^https?://\w+\.donmai\.us/.*\.(xml|json|atom)(\?|$)/
// @grant        none
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/EventListener.user.js
// @updateURL    https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/EventListener.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.13.1/validate.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/module.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/notice.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/concurrency.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/menu.js
// ==/UserScript==

/* global JSPLib $ Danbooru */

/****Library updates****/

JSPLib.debug.getFunctionPrint2 = function (func) {
    if (!func.printer) {
        let printer = {};
        if (this.debug_console) {
            let func_name = func.name.replace(/^bound /, "");
            let context = this;
            context._func_iteration ??= {};
            context._func_iteration[func_name] ??= 0;
            context._func_iteration[func_name]++;
            ['debuglog', 'debugwarn', 'debugerror', 'debuglogLevel', 'debugwarnLevel', 'debugerrorLevel'].forEach((debugfunc) => {
                printer[debugfunc] = function (...args) {
                    let iteration = context._func_iteration[func_name];
                    context[debugfunc](`${func_name}[${iteration}] -`, ...args);
                };
            });
        } else {
            ['debuglog', 'debugwarn', 'debugerror', 'debuglogLevel', 'debugwarnLevel', 'debugerrorLevel'].forEach((debugfunc) => {
                printer[debugfunc] = (() => {});
            });
        }
        func.printer = printer;
    }
    return func.printer;
};

JSPLib.utility.toTimeStamp = function (time_value) {
    while (typeof time_value === 'string') {
        var tmp;
        try {
            tmp = JSON.parse(time_value);
        } catch(e) {
            break;
        }
        time_value = tmp;
    }
    return (typeof time_value === 'string' ? new Date(time_value).getTime() : time_value);
};

JSPLib.utility.timeAgo = function (time_value, {precision = 2, compare_time = null, recent_duration = null} = {}) {
    let timestamp = this.toTimeStamp(time_value);
    if (!this.isTimestamp(timestamp)) return "N/A";
    compare_time ??= Date.now();
    let time_interval = compare_time - timestamp;
    if (this.isTimestamp(recent_duration) && time_interval < recent_duration) {
        return "recently";
    }
    if (time_interval < JSPLib.utility.one_hour) {
        return this.setPrecision(time_interval / JSPLib.utility.one_minute, precision) + " minutes ago";
    }
    if (time_interval < JSPLib.utility.one_day) {
        return this.setPrecision(time_interval / JSPLib.utility.one_hour, precision) + " hours ago";
    }
    if (time_interval < JSPLib.utility.one_month) {
        return this.setPrecision(time_interval / JSPLib.utility.one_day, precision) + " days ago";
    }
    if (time_interval < JSPLib.utility.one_year) {
        return this.setPrecision(time_interval / JSPLib.utility.one_month, precision) + " months ago";
    }
    return this.setPrecision(time_interval / JSPLib.utility.one_year, precision) + " years ago";
};

JSPLib.utility.timeFromNow = function (time_value, {precision = 2, compare_time = null, recent_duration = null} = {}) {
    let timestamp = this.toTimeStamp(time_value);
    if (!this.isTimestamp(timestamp)) return "N/A";
    compare_time ??= Date.now();
    let time_interval = timestamp - compare_time;
    if (this.isTimestamp(recent_duration) && time_interval < recent_duration) {
        return "soon";
    }
    if (time_interval < 0) {
        return "already passed";
    }
    if (time_interval < JSPLib.utility.one_hour) {
        return "in " + this.setPrecision(time_interval / JSPLib.utility.one_minute, precision) + " minutes";
    }
    if (time_interval < JSPLib.utility.one_day) {
        return "in " + this.setPrecision(time_interval / JSPLib.utility.one_hour, precision) + " hours";
    }
    if (time_interval < JSPLib.utility.one_month) {
        return "in " + this.setPrecision(time_interval / JSPLib.utility.one_day, precision) + " days";
    }
    if (time_interval < JSPLib.utility.one_year) {
        return "in " + this.setPrecision(time_interval / JSPLib.utility.one_month, precision) + " months";
    }
    return "in " + this.setPrecision(time_interval / JSPLib.utility.one_year, precision) + " years";
};

JSPLib.utility.isHash = function (value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
};

JSPLib.utility.isString = function (value) {
    return typeof value === "string";
};

JSPLib.utility.isNumber = function (value) {
    return typeof value === 'number' && !isNaN(value);
};

JSPLib.storage.inMemoryStorage = function (key, storage) {
    let storage_type = this._getStorageType(storage);
    return key in this.memory_storage[storage_type];
};

JSPLib.storage.getStorageData = function (key, storage, {default_val = null, bypass = false} = {}) {
    let storage_type = this._getStorageType(storage);
    var return_val;
    if (!bypass && key in this.memory_storage[storage_type]) {
        return_val = this.memory_storage[storage_type][key];
    } else if (key in storage) {
        let record_key = this._getUID(key);
        JSPLib.debug.recordTime(record_key, 'Storage');
        let data = storage.getItem(key);
        JSPLib.debug.recordTimeEnd(record_key, 'Storage');
        try {
            return_val = this.memory_storage[storage_type][key] = JSON.parse(data);
        } catch (e) {
            //swallow exception
        }
    }
    if (return_val === undefined){
        return_val = default_val;
    }
    return JSPLib.utility.dataCopy(return_val);
};

JSPLib.storage.getLocalData = function (key, {default_val = null, bypass = false} = {}) {
    return this.getStorageData(key, localStorage, {default_val, bypass});
};

JSPLib.concurrency.setRecheckTimeout = function (storage_key, expires_time, jitter = null) {
    if (JSPLib.utility.isNumber(jitter) && jitter < expires_time) {
        expires_time += -Math.random() * jitter;
    }
    let expires_timestamp = JSPLib.utility.getExpires(expires_time);
    JSPLib.storage.setLocalData(storage_key, expires_timestamp);
    return expires_timestamp;
};

/****Global variables****/

//Exterior script variables
const DANBOORU_TOPIC_ID = '14747';
const SERVER_USER_ID = 502584;

//Variables for load.js
const PROGRAM_LOAD_REQUIRED_VARIABLES = ['window.jQuery', 'window.Danbooru', 'Danbooru.CurrentUser'];
const PROGRAM_LOAD_REQUIRED_SELECTORS = ['#nav', '#top'];

//Program name constants
const PROGRAM_SHORTCUT = 'el';
const PROGRAM_CLICK = 'click.el';
const PROGRAM_NAME = 'EventListener';

//Main program variable
const EL = {};

//Event types
const POST_QUERY_EVENTS = ['comment', 'note', 'commentary', 'post', 'approval', 'flag', 'appeal'];
const SUBSCRIBE_EVENTS = ['comment', 'note', 'commentary', 'post', 'approval', 'flag', 'appeal', 'forum', 'wiki', 'pool', 'artist'];
const USER_EVENTS = ['comment', 'note', 'commentary', 'post', 'approval', 'appeal', 'forum', 'wiki', 'pool', 'artist'];
const ALL_SUBSCRIBES = JSPLib.utility.arrayUnion(SUBSCRIBE_EVENTS, USER_EVENTS);
const OTHER_EVENTS = ['dmail', 'ban', 'feedback', 'mod_action'];
const ALL_EVENTS = JSPLib.utility.arrayUnique(JSPLib.utility.multiConcat(POST_QUERY_EVENTS, SUBSCRIBE_EVENTS, OTHER_EVENTS));

//For factory reset
const LAST_ID_KEYS = JSPLib.utility.multiConcat(
    POST_QUERY_EVENTS.map((type) => `el-${type}-post-query-last-id`),
    SUBSCRIBE_EVENTS.map((type) => `el-${type}-subscribe-last-id`),
    OTHER_EVENTS.map((type) => `el-${type}-other-last-id`),
);
const OVERFLOW_KEYS = JSPLib.utility.multiConcat(
    POST_QUERY_EVENTS.map((type) => `el-${type}-post-query-overflow`),
    SUBSCRIBE_EVENTS.map((type) => `el-${type}-subscribe-overflow`),
    OTHER_EVENTS.map((type) => `el-${type}-other-overflow`),
);
const SUBSCRIBE_KEYS = SUBSCRIBE_EVENTS.map((type) => ([`el-${type}-item-list`, `el-${type}-user-list`])).flat();
const LOCALSTORAGE_KEYS = JSPLib.utility.multiConcat(LAST_ID_KEYS, OVERFLOW_KEYS, SUBSCRIBE_KEYS);

//Available setting values
const POST_QUERY_ENABLE_EVENTS = ['flag', 'appeal'];
const SUBSCRIBE_ENABLE_EVENTS = ['comment', 'note', 'commentary', 'forum'];
const USER_ENABLE_EVENTS = [];
const OTHER_ENABLE_EVENTS = ['dmail'];
const MODACTION_EVENTS = [
    'user_delete', 'user_ban', 'user_unban', 'user_name_change', 'user_level_change', 'user_approval_privilege', 'user_upload_privilege', 'user_feedback_update',
    'user_feedback_delete', 'post_delete', 'post_undelete', 'post_ban', 'post_unban', 'post_permanent_delete', 'post_move_favorites', 'post_regenerate', 'post_regenerate_iqdb',
    'post_note_lock_create', 'post_note_lock_delete', 'post_rating_lock_create', 'post_rating_lock_delete', 'post_vote_delete', 'post_vote_undelete', 'pool_delete',
    'pool_undelete', 'artist_ban', 'artist_unban', 'comment_update', 'comment_delete', 'comment_vote_delete', 'comment_vote_undelete', 'forum_topic_delete', 'forum_topic_undelete',
    'forum_topic_lock', 'forum_post_update', 'forum_post_delete', 'moderation_report_handled', 'moderation_report_rejected', 'tag_alias_create', 'tag_alias_update', 'tag_alias_delete',
    'tag_implication_create', 'tag_implication_update', 'tag_implication_delete', 'ip_ban_create', 'ip_ban_delete', 'ip_ban_undelete', 'other',
];

//Main settings
const SETTINGS_CONFIG = {
    autolock_notices: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Closing a notice will no longer close all other notices."
    },
    mark_read_topics: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Reading a forum post from the notice will mark the topic as read."
    },
    mark_read_dmail: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Reading a dmail from the notice will mark the dmail as read."
    },
    autoclose_dmail_notice: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Will automatically close the DMail notice provided by Danbooru."
    },
    overflow_only_notice_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Will display the event notice even when no events are found but more can be queried."
    },
    filter_user_events: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Only show events not created by the user."
    },
    show_creator_events: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Show subscribe events regardless of subscribe status on the item's page when the creator is the user.<br>&emsp;<i>(See <b>Additional setting details</b> for more clarifying info)</i>."
    },
    show_parent_events: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Show post events when a subscribed post is parented by another post."
    },
    filter_untranslated_commentary: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Only show new commentary that has translated sections."
    },
    filter_autobans: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: `Only show bans not created by <a class="user-moderator with-style" style="color:var(--user-moderator-color)" href="/users/${SERVER_USER_ID}">DanbooruBot</a>.`
    },
    filter_autofeedback: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: 'Only show feedback not created by an administrative action, e.g. bans or promotions.'
    },
    filter_post_edits: {
        reset: "",
        parse: String,
        validate: JSPLib.utility.isString,
        hint: "Enter a list of tags to filter out edits when added to or removed from a post.",
    },
    filter_BUR_edits: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: `Only show edits not created by <a class="user-moderator with-style" style="color:var(--user-moderator-color)" href="/users/${SERVER_USER_ID}">DanbooruBot</a>.`
    },
    filter_users: {
        reset: "",
        parse: (input) => (JSPLib.utility.arrayUnique(input.split(/\s*,\s*/).map(Number).filter(JSPLib.validate.validateID))),
        validate: (input) => (JSPLib.validate.validateIDList(input)),
        hint: 'Enter a list of user IDs to filter (comma separated).'
    },
    recheck_interval: {
        reset: 60,
        parse: parseInt,
        validate: (data) => (Number.isInteger(data) && data > 0),
        hint: "How often to check for new events (# of minutes)."
    },
    post_query_events_enabled: {
        allitems: POST_QUERY_EVENTS,
        reset: POST_QUERY_ENABLE_EVENTS,
        validate: (data) => (JSPLib.menu.validateCheckboxRadio(data, 'checkbox', POST_QUERY_EVENTS)),
        hint: "Select to enable event type."
    },
    subscribe_events_enabled: {
        allitems: SUBSCRIBE_EVENTS,
        reset: SUBSCRIBE_ENABLE_EVENTS,
        validate: (data) => (JSPLib.menu.validateCheckboxRadio(data, 'checkbox', SUBSCRIBE_EVENTS)),
        hint: "Select to enable event type."
    },
    user_events_enabled: {
        allitems: USER_EVENTS,
        reset: USER_ENABLE_EVENTS,
        validate: (data) => (JSPLib.menu.validateCheckboxRadio(data, 'checkbox', USER_EVENTS)),
        hint: "Select to enable event type."
    },
    other_events_enabled: {
        allitems: OTHER_EVENTS,
        reset: OTHER_ENABLE_EVENTS,
        validate: (data) => (JSPLib.menu.validateCheckboxRadio(data, 'checkbox', OTHER_EVENTS)),
        hint: "Select to enable event type."
    },
    subscribed_mod_actions: {
        allitems: MODACTION_EVENTS,
        reset: [],
        validate: (data) => (JSPLib.menu.validateCheckboxRadio(data, 'checkbox', MODACTION_EVENTS)),
        hint: "Select which mod action categories to subscribe to."
    },
    flag_query: {
        reset: "###INITIALIZE###",
        parse: String,
        validate: JSPLib.utility.isString,
        hint: 'Enter a post search query to check.'
    },
    appeal_query: {
        reset: "###INITIALIZE###",
        parse: String,
        validate: JSPLib.utility.isString,
        hint: 'Enter a post search query to check.'
    },
    comment_query: {
        reset: "",
        parse: String,
        validate: JSPLib.utility.isString,
        hint: 'Enter a post search query to check.'
    },
    note_query: {
        reset: "",
        parse: String,
        validate: JSPLib.utility.isString,
        hint: 'Enter a post search query to check.'
    },
    commentary_query: {
        reset: "",
        parse: String,
        validate: JSPLib.utility.isString,
        hint: 'Enter a post search query to check.'
    },
    approval_query: {
        reset: "",
        parse: String,
        validate: JSPLib.utility.isString,
        hint: 'Enter a post search query to check.'
    },
    post_query: {
        display: "Edit query",
        reset: "",
        parse: String,
        validate: JSPLib.utility.isString,
        hint: 'Enter a list of tags to check. See <a href="#el-post-query-event-message">Additional setting details</a> for more info.'
    },
};

const CONTROL_CONFIG = {
    post_events: {
        allitems: ['post', 'comment', 'note', 'commentary', 'approval'],
        value: [],
        hint: "Select which events to populate.",
    },
    operation: {
        allitems: ['add', 'subtract', 'overwrite'],
        value: ['add'],
        hint: "Select how the query will affect existing subscriptions.",
    },
    search_query: {
        value: "",
        buttons: ['get'],
        hint: 'Enter a post search query to populate. See <a href="/wiki_pages/43049">Help:Cheatsheet</a> for more info.',
    },
    cache_info: {
        value: "Click to populate",
        hint: "Calculates the cache usage of the program and compares it to the total usage.",
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
        name: 'network',
    }, {
        name: 'notice',
    }, {
        name: 'filter',
    }, {
        name: 'subscribe-event',
        message: "These events will not be checked unless there are one or more subscribed items.",
    }, {
        name: 'post-query-event',
        message: "These events can be searched with a post query. A blank query line will return all events. See <a href=\"/wiki_pages/help:cheatsheet\">Help:Cheatsheet</a> for more info.",
    }, {
        name: 'user-event',
        message: "These events will not be checked unless there are one or more subscribed users.",
    }, {
        name: 'other-event',
        message: "Except for some exceptions noted below, all events of this type are shown.",
    }],
    controls: [{
        name: 'subscribe',
    }],
};

// Default values

const DEFAULT_VALUES = {
    subscribeset: {},
    userset: {},
    openlist: {},
    new_events_found: false,
    pages: {},
};

//CSS Constants

const SUBSCRIBED_COLOR = 'mediumseagreen';
const UNSUBSCRIBED_COLOR = 'darkorange';

const PROGRAM_CSS = `
.el-link-disabled {
    color: var(--text-color);
    pointer-events: none;
}
.el-comments-pane {
    height: calc(100vh - 15em);
    overflow-y: auto;
}
.el-table-pane {
    height: calc(100vh - 13em);
    overflow-y: auto;
}
.el-table-container {
    position: relative;
}
.el-home-section.el-has-new-events h4 {
    background-color: lawngreen;
}
#el-nav-events {
    cursor: pointer;
}
#el-nav-events.el-has-new-events {
    color: red;
}
#el-page .el-full-item[data-type="pooldiff"] {
    overflow-x: auto;
    max-width: 90vw;
}
#el-page .el-full-item[data-type="pooldiff"] ins {
    background: #cfc;
    text-decoration: none;
}
#el-page .el-full-item[data-type="pooldiff"] del {
    background: #fcc;
    text-decoration: none;
}
#el-page .el-full-item[data-type="poolposts"] .el-add-pool-posts {
    display: flex;
    flex-wrap: wrap;
    background-color: rgba(0, 255, 0, 0.2);
}
#el-page .el-full-item[data-type="poolposts"] .el-rem-pool-posts {
    display: flex;
    background-color: rgba(255, 0, 0, 0.2);
}
#el-page .el-full-item[data-type="poolposts"] .post-preview {
    margin: 5px;
    padding: 5px;
    border: 1px solid var(--dtext-blockquote-border-color);
}
#el-page .el-full-item[data-type="poolposts"] .post-preview-150 {
    width: 155px;
    height: 175px;
}
#el-page .el-full-item[data-type="poolposts"] .post-preview-180 {
    width: 185px;
    height: 205px;
}
#el-page .el-full-item[data-type="poolposts"] .post-preview-225 {
    width: 230px;
    height: 250px;
}
#el-page .el-full-item[data-type="poolposts"] .post-preview-270 {
    width: 275px;
    height: 300px;
}
#el-page .el-full-item[data-type="poolposts"] .post-preview-360 {
    width: 365px;
    height: 390px;
}
.el-more {
    color: blue;
    font-weight: bold;
}
.el-none {
    color: red;
}
.el-event-header {
    padding: 8px;
    background-color: #EEE;
    border: 1px solid #DDD;
    font-weight: bold;
    font-size: 20px;
    margin-right: 2px;
}
.el-event-header a {
    cursor: pointer;
}
.el-event-header[data-type="close"] a {
    color: var(--red-5);
}
.el-event-header[data-type="close"] a:hover {
    color: var(--red-3);
}
.el-event-header.el-header-active {
    background-color: var(--blue-4);
    border-color: var(--blue-6);
}
.el-event-header.el-header-active:hover {
    background-color: var(--blue-3);
}
.el-event-header.el-header-active a {
    color: white;
}
.el-event-header.el-header-active a:hover
#dmail-notice {
    display: none;
}
#el-event-notice {
    padding: 0.5em;
}
.el-post-thumbnail article.post-preview {
    width: 160px;
}
.striped .el-monospace-link:link,
.striped .el-monospace-link:visited,
.post-preview .el-monospace-link:link,
.post-preview .el-monospace-link:visited {
    font-family: monospace;
    color: var(--muted-text-color);
}
.striped .el-monospace-link:hover,
.post-preview .el-monospace-link:hover {
    filter: brightness(1.5);
}
#nav #el-subscribe-events {
    padding-left: 2em;
    font-weight: bold;
}
#el-subscribe-events #el-add-links li {
    margin: 0 -6px;
}
#el-subscribe-events .el-subscribed a,
#subnav-unsubscribe-link {
    color: ${SUBSCRIBED_COLOR};
}
#el-subscribe-events .el-subscribed a:hover,
#subnav-unsubscribe-link:hover {
    filter: brightness(1.5);
}
#el-subscribe-events .el-unsubscribed a,
#subnav-subscribe-link {
    color: ${UNSUBSCRIBED_COLOR};
}
#el-subscribe-events .el-unsubscribed a:hover,
#subnav-subscribe-link:hover {
    filter: brightness(1.5);
}
#el-loading-message,
#el-event-controls {
    margin-top: 1em;
}
#el-lock-event-notice,
#el-read-event-notice {
    font-weight: bold;
    color: mediumseagreen;
}
#el-lock-event-notice:not(.el-locked):hover ,
#el-read-event-notice:not(.el-read):hover {
    filter: brightness(1.5);
}
.el-overflow-notice {
    border-top: 1px solid #DDD;
    font-weight: bold;
}
#el-lock-event-notice.el-locked,
#el-read-event-notice.el-read {
    color: red;
}
#el-reload-event-notice {
    font-weight: bold;
    color: orange;
}
#el-snooze-event-notice {
    font-weight: bold;
    color: darkviolet;
}
#el-reload-event-notice:hover {
    filter: brightness(1.2);
}
#el-snooze-event-notice:hover {
    filter: brightness(1.5);
}
#el-absent-section {
    margin: 0.5em;
    border: solid 1px grey;
    padding: 0.5em;
}
.el-error-message {
    color: var(--muted-text-color);
    font-weight: bold;
    margin-left: 1em;
}
.el-horizontal-rule {
    border-top: 4px dashed tan;
    margin: 10px 0;
}
div#el-notice {
    top: unset;
    bottom: 2em;
}
.el-paragraph-mark {
    opacity: 0.25;
}
/**DMAIL**/
tr[data-read="false"] {
    font-weight: bold;
}
tr[data-deleted="true"],
tr[data-deleted="true"] a {
    text-decoration: line-through;
}`;

const MENU_CSS = `
#el-search-query-display {
    margin: 0.5em;
    font-size: 150%;
    border: 1px solid var(--dtext-blockquote-border-color);
    padding: 0.5em;
    width: 8.5em;
}
#event-listener .jsplib-settings-grouping:not(#el-general-settings) .jsplib-selectors label,
#event-listener #el-subscribe-controls .jsplib-selectors label {
    text-align: left;
    width: 200px;
    letter-spacing: -1px;
}
#event-listener .jsplib-settings-grouping:not(#el-general-settings) .ui-checkboxradio-icon-space {
    margin-right: 5px;
}`;

//HTML constants

const DISPLAY_COUNTER = `
<div id="el-search-query-display" style="display:none">
    Pages left: <span id="el-search-query-counter">...</span>
</div>`;

const SUBSCRIBE_EVENT_SETTINGS_DETAILS = `
<p>
When the <code>show_creator_events</code> setting is enabled, it will automatically show events for items (post, forum_topic) where the user is the creator, but only if
those events are also enabled under the <code>subscribe_events_enabled</code> setting. Meaning, events for that event type will be shown to the user whether they are
<span style="color: ${SUBSCRIBED_COLOR}; font-weight: bold;">SUBSCRIBED</span> or <span style="color: ${UNSUBSCRIBED_COLOR}; font-weight: bold;">UNSUBSCRIBED</span>
to an individual item (post, forum_topic) on the item's page.
</p>
<p>
The following is the list of event types and the relation the user needs to have to an item to be automatically subscribed to that item when that event type is enabled.
</p>
<table class="striped">
	<thead>
		<tr>
			<th>Event type</th>
            <th>Item type</th>
			<th>User relation</th>
		</tr>
	</thead>
	<tbody>
		<tr>
			<td>note</td>
            <td>post</td>
			<td>uploader</td>
		</tr>
		<tr>
			<td>commentary</td>
            <td>post</td>
			<td>uploader</td>
		</tr>
		<tr>
			<td>comment</td>
            <td>post</td>
			<td>uploader</td>
		</tr>
		<tr>
			<td>post (edit)</td>
            <td>post</td>
			<td>uploader</td>
		</tr>
		<tr>
			<td>flag</td>
            <td>post</td>
			<td>uploader</td>
		</tr>
		<tr>
			<td>appeal</td>
            <td>post</td>
			<td>uploader</td>
		</tr>
		<tr>
			<td>approval</td>
            <td>post</td>
			<td>uploader</td>
		</tr>
		<tr>
			<td>forum topic</td>
            <td>forum_topic</td>
			<td>forum topic OP</td>
		</tr>
	</tbody>
</table>`;

const POST_QUERY_EVENT_SETTINGS_DETAILS = `
<ul>
    <li><b>Edit query:</b>
        <ul>
            <li>Prepend tags with a "-" to add a search for removed tags.</li>
            <li>Prepend tags with a "~" to add a search for any changed tags.</li>
            <li>Any other tags will add a search for added tags.</li>
            <li>At least one tag from added/removed must be in the post edit.</li>
            <li>Having no tags for either group removes that requirement.</li>
        </ul>
    </li>
</ul>`;

const OTHER_EVENT_SETTINGS_DETAILS = `
<ul>
    <li><b>dmail:</b> Only dmail <u>received</u> from another user.</li>
    <li><b>ban:</b> None.</li>
    <li><b>feedback:</b> No ban feedbacks.</li>
    <li><b>mod action:</b> Specific categories must be subscribed.</li>
</ul>`;

const SUBSCRIBE_CONTROLS_DETAILS = `
<p>Subscribe to events using search queries instead of individually.</p>
<p><span style="color:red"><b>Warning!</b></span> Very large lists have issues:</p>
<ul>
    <li>Higher performance delays.</li>
    <li>Could fill up the cache.</li>
    <li>Which could crash the program or other scripts.</li>
    <li>I.e. don't subscribe to <b><u>ALL</u></b> of Danbooru!</li>
</ul>`;

const PROGRAM_DATA_DETAILS = `
<p class="tn">All timestamps are in milliseconds since the epoch (<a href="https://www.epochconverter.com">Epoch converter</a>).</p>
<ul>
    <li>General data
        <ul>
            <li><b>last-seen:</b> When was the last recheck? This controls when the absence tracker will launch.</li>
            <li><b>overflow:</b> Did any of the events overflow last page refresh? This controls whether or not the script will do a recheck at the next page refresh regardless of the timeout.</li>
            <li><b>process-semaphore:</b> Prevents two tabs from processing the same data at the same time.</li>
            <li><b>event-timeout:</b> When the script is scheduled next to do a recheck.</li>
            <li><b>saved-timeout:</b> When the saved notice will be discarded if there is one.</li>
            <li><b>user-settings:</b> All configurable settings.</li>
        </ul>
    </li>
    <li>Type data: <code>TYPE</code> is a placeholder for all available event types. <code>SOURCE</code> is a placeholder for the type of operation (subscribe, post-query, other).
        <ul>
            <li><b>TYPE-item-list:</b> The list of all item IDs that are subscribed.</li>
            <li><b>TYPE-user-list:</b> The list of all user IDs that are subscribed.</li>
            <li><b>TYPE-SOURCE-last-id:</b> Bookmark for the ID of the last seen event. This is where the script starts searching when it does a recheck.</li>
            <li><b>TYPE-SOURCE-overflow:</b> Did this event reach the query limit last page load? Absence of this key indicates false. This controls whether or not and event will process at the next page refresh.</li>
        </ul>
    </li>
</ul>
<p><b>Note:</b> The raw format of all data keys begins with "el-". which is unused by the cache editor controls.</p>`;

let EVENTS_NAV_HTML = '<a id="el-nav-events" class="py-1.5 px-3">Events(<span id="el-events-total">...</span>)</a>';

const MORE_HTML = '<span class="el-more">more</span>';
const NONE_HTML = '<span class="el-none">none</span>';

//Time constants

const TIMER_POLL_INTERVAL = 100; //Polling interval for checking program status
const JQUERY_DELAY = 1; //For jQuery updates that should not be done synchronously
const NONSYNCHRONOUS_DELAY = 1; //For operations too costly in events to do synchronously

//Network constants

const QUERY_LIMIT = 100; //The max number of items to grab with each network call
const ID_FIELD = 'id';

//Other constants

const ALL_POST_EVENTS = ['post', 'approval', 'comment', 'note', 'commentary'];
const ALL_TRANSLATE_EVENTS = ['note', 'commentary'];

//Type configurations

const TYPEDICT = {
    flag: {
        controller: 'post_flags',
        addons: {search: {category: 'normal'}},
        user: 'creator_id',
        creator: ['post', 'uploader_id'],
        item: 'post_id',
        only: 'id,created_at,creator_id,post_id',
        find_events: FindEvents,
        insert_events: InsertTableEvents,
        plural: 'flags',
        display: "Flags",
        includes: 'post[uploader_id]',
    },
    appeal: {
        controller: 'post_appeals',
        user: 'creator_id',
        creator: ['post', 'uploader_id'],
        item: 'post_id',
        only: 'id,created_at,creator_id,post_id',
        find_events: FindEvents,
        insert_events: InsertTableEvents,
        plural: 'appeals',
        display: "Appeals",
        includes: 'post[uploader_id]',
    },
    dmail: {
        controller: 'dmails',
        addons: {search: {is_deleted: false}},
        only: 'id,created_at,from_id',
        user: 'from_id',
        find_events: FindEvents,
        other_filter: (val) => (!val.is_read),
        insert_events: InsertTableEvents,
        insert_postprocess: DmailPostprocess,
        plural: 'mail',
    },
    comment: {
        controller: 'comments',
        addons: {group_by: 'comment', search: {is_deleted: false}},
        user: 'creator_id',
        creator: ['post', 'uploader_id'],
        item: 'post_id',
        only: 'id,created_at,creator_id,post_id',
        limit: 10,
        find_events: FindEvents,
        insert_events: InsertCommentEvents,
        plural: 'comments',
        display: "Comments",
        includes: 'post[uploader_id]',
    },
    forum: {
        controller: 'forum_posts',
        user: 'creator_id',
        creator: ['topic', 'creator_id'],
        item: 'topic_id',
        only: 'id,created_at,creator_id,topic_id',
        limit: 10,
        find_events: FindEvents,
        insert_events: InsertTableEvents,
        insert_postprocess: ForumPostprocess,
        plural: 'forums',
        display: "Forums",
        includes: 'topic[creator_id]',
    },
    note: {
        controller: 'note_versions',
        user: 'updater_id',
        creator: ['post', 'uploader_id'],
        item: 'post_id',
        only: 'id,created_at,updater_id,post_id',
        limit: 10,
        find_events: FindEvents,
        insert_events: InsertTableEvents,
        add_thumbnail: true,
        plural: 'notes',
        display: "Notes",
        includes: 'post[uploader_id]',
    },
    commentary: {
        controller: 'artist_commentary_versions',
        user: 'updater_id',
        creator: ['post', 'uploader_id'],
        item: 'post_id',
        only: 'id,created_at,updater_id,post_id,translated_title,translated_description',
        limit: 10,
        find_events: FindEvents,
        other_filter: IsShownCommentary,
        insert_events: InsertTableEvents,
        column_widths: {
            'original-column': '35%',
            'translated-column': '35%',
        },
        plural: 'commentaries',
        display: "Artist commentary",
        includes: 'post[uploader_id]',
    },
    post: {
        controller: 'post_versions',
        get addons() {
            let addons = {search: {is_new: false}};
            if (EL.filter_BUR_edits) {
                addons.search.updater_id_not_eq = SERVER_USER_ID;
            }
            return addons;
        },
        user: 'updater_id',
        creator: ['post', 'uploader_id'],
        item: 'post_id',
        only: 'id,created_at,updater_id,post_id,added_tags,removed_tags,parent_changed,unchanged_tags',
        limit: 2,
        find_events: FindEvents,
        other_filter: IsShownPostEdit,
        insert_events: InsertTableEvents,
        column_widths: {
            'tags-column': '35%',
            'edit-column': '35%',
        },
        plural: 'edits',
        display: "Edits",
        includes: 'post[uploader_id,parent_id]',
        custom_query: PostCustomQuery,
    },
    approval: {
        controller: 'post_approvals',
        user: 'user_id',
        creator: ['post', 'uploader_id'],
        item: 'post_id',
        only: 'id,created_at,user_id,post_id',
        limit: 10,
        find_events: FindEvents,
        insert_events: InsertTableEvents,
        plural: 'approvals',
        display: "Approval",
        includes: 'post[uploader_id]',
    },
    wiki: {
        controller: 'wiki_page_versions',
        user: 'updater_id',
        item: 'wiki_page_id',
        only: 'id,created_at,updater_id,wiki_page_id',
        limit: 10,
        find_events: FindEvents,
        insert_events: InsertTableEvents,
        insert_postprocess: WikiPostprocess,
        column_widths: {
            'diff-column': '5%',
        },
        plural: 'wikis',
        display: "Wikis",
    },
    artist: {
        controller: 'artist_versions',
        user: 'updater_id',
        item: 'artist_id',
        only: 'id,created_at,updater_id,artist_id',
        limit: 10,
        find_events: FindEvents,
        insert_events: InsertTableEvents,
        plural: 'artists',
        display: "Artists",
    },
    pool: {
        controller: 'pool_versions',
        user: 'updater_id',
        item: 'pool_id',
        only: 'id,created_at,updater_id,pool_id',
        limit: 2,
        find_events: FindEvents,
        insert_events: InsertTableEvents,
        insert_postprocess: PoolPostprocess,
        plural: 'pools',
        display: "Pools",
    },
    feedback: {
        controller: 'user_feedbacks',
        user: 'creator_id',
        only: 'id,created_at,creator_id,body',
        find_events: FindEvents,
        other_filter: IsShownFeedback,
        insert_events: InsertTableEvents,
        plural: 'feedbacks',
    },
    ban: {
        controller: 'bans',
        user: 'banner_id',
        only: 'id,created_at,banner_id',
        find_events: FindEvents,
        other_filter: IsShownBan,
        insert_events: InsertTableEvents,
        plural: 'bans',
    },
    mod_action: {
        controller: 'mod_actions',
        get addons() {
            return {search: {category: EL.subscribed_mod_actions.join(',')}};
        },
        only: 'id,created_at,category',
        find_events: FindCategoryEvents,
        insert_events: InsertTableEvents,
        plural: 'mod actions',
    },
};

//Validate constants

const TYPE_GROUPING = '(?:' + ALL_EVENTS.join('|') + ')';
const SUBSCRIBE_GROUPING = '(?:' + ALL_SUBSCRIBES.join('|') + ')';
const SOURCE_GROUPING = '(?:subscribe|post-query|other)';

const BOOL_SETTING_REGEX = RegExp([
    `el-${SUBSCRIBE_GROUPING}-${SOURCE_GROUPING}-overflow`,
].join('|'));
const TIME_SETTING_REGEX = RegExp([
    'el-process-semaphore',
    'el-event-timeout',
    'el-saved-timeout',
].join('|'));
const ID_SETTING_REGEX = RegExp([
    `el-${TYPE_GROUPING}-${SOURCE_GROUPING}-last-id`,
].join('|'));
const ID_LIST_SETTING_REGEX = RegExp([
    `el-${SUBSCRIBE_GROUPING}-(?:item|user)-list`,
].join('|'));

const VALIDATE_REGEXES = {
    setting: /el-user-settings/,
    bool: BOOL_SETTING_REGEX,
    time: TIME_SETTING_REGEX,
    id: ID_SETTING_REGEX,
    idlist: ID_LIST_SETTING_REGEX,
};

const EVENT_CONSTRAINTS = {
    id: JSPLib.validate.id_constraints,
    match: JSPLib.validate.array_constraints,
    seen: JSPLib.validate.boolean_constraints,
};

/****Functions****/

//Validate functions

function ValidateProgramData(key, entry) {
    var checkerror = [];
    let validate_type = GetValidateType(key);
    switch (validate_type) {
        case 'setting':
            checkerror = JSPLib.menu.validateUserSettings(entry);
            break;
        case 'bool':
            if (!JSPLib.validate.isBoolean(entry)) {
                checkerror = ["Value is not a boolean."];
            }
            break;
        case 'time':
            if (!Number.isInteger(entry)) {
                checkerror = ["Value is not an integer."];
            } else if (entry < 0) {
                checkerror = ["Value is not greater than or equal to zero."];
            }
            break;
        case 'id':
            if (!JSPLib.validate.validateID(entry)) {
                checkerror = ["Value is not a valid ID."];
            }
            break;
        case 'idlist':
            if (!JSPLib.validate.validateIDList(entry)) {
                checkerror = ["Value is not a valid ID list."];
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

function GetValidateType(key) {
    for (let validate_type in VALIDATE_REGEXES) {
        let match = VALIDATE_REGEXES[validate_type].exec(key);
        if (match) {
            return validate_type;
        }
    }
    return 'other';
}

function CorrectEvents(key, events) {
    const printer = JSPLib.debug.getFunctionPrint('CorrectEvents');
    const known_matches = ['subscribe', 'user', 'creator', 'post-query', 'any', 'category'];
    let valid_events = [];
    if (!Array.isArray(events)) {
        JSPLib.storage.removeLocalData(key);
        printer.debuglog(`${key} is not an array.`);
        return true;
    }
    let is_dirty = false;
    for (let i = 0; i < events.length; i++) {
        let event = events[i];
        if (!JSPLib.utility.isHash(event)) {
            printer.debuglog(`${key}[${i}] is not a hash.`);
            continue;
        }
        if (!JSPLib.validate.validateHashEntries(key, event, EVENT_CONSTRAINTS)) {
            printer.debuglog(`${key}[${i}] is not formatted correctly.`);
            continue;
        }
        let unknown_matches = JSPLib.utility.arrayDifference(event.match, known_matches);
        if (unknown_matches.length) {
            printer.debuglog(`Removing invalid matches from ${key}[${i}]:`, unknown_matches);
            event.match = JSPLib.utility.arrayIntersection(event.match, known_matches);
            is_dirty = true;
        }
        valid_events.push(event);
    }
    if (valid_events.length < events.length || is_dirty) {
        printer.debuglog(`${key} updated with valid events.`);
        JSPLib.storage.setLocalData(key, valid_events);
        return true;
    }
    return false;
}

function CorrectList(type, typelist) {
    let printer = JSPLib.debug.getFunctionPrint('CorrectList');
    let error_messages = [];
    if (!JSPLib.validate.validateIDList(typelist[type])) {
        error_messages.push([`Corrupted data on ${type} list!`]);
        let oldlist = JSPLib.utility.dataCopy(typelist[type]);
        typelist[type] = (Array.isArray(typelist[type]) ? typelist[type].filter((id) => JSPLib.validate.validateID(id)) : []);
        JSPLib.debug.debugExecute(() => {
            let validation_error = (Array.isArray(oldlist) ? JSPLib.utility.arrayDifference(oldlist, typelist[type]) : typelist[type]);
            error_messages.push(["Validation error:", validation_error]);
        });
    }
    if (error_messages.length) {
        error_messages.forEach((error) => {printer.debuglog(...error);});
        return true;
    }
    return false;
}

//Helper functions

function GetPageValues(page) {
    let page_min = ((page - 1) * 20) + 1;
    let page_max = page * 20;
    return {page_min, page_max};
}

function AnyEventEnabled(type) {
    return EL.post_query_events_enabled.includes(type) || EL.all_subscribe_events.includes(type) || EL.other_events_enabled.includes(type);
}

function IsEventEnabled(type, event_type) {
    return EL.user_settings[event_type].includes(type);
}

function IsAnyEventEnabled(event_list, event_type) {
    return JSPLib.utility.arrayHasIntersection(event_list, EL.user_settings[event_type]);
}

function AreAllEventsEnabled(event_list, event_type) {
    return JSPLib.utility.isSubArray(EL.user_settings[event_type], event_list);
}

function GetTypeQuery(type) {
    return EL.user_settings[type + '_query'];
}

function GetCheckVars(event) {
    let $link = $(event.currentTarget);
    let source = $link.data('source');
    let $container = $link.closest('.el-home-section');
    let type = $container.data('type');
    let selector = `.el-home-section[data-type=${type}] .el-pages-left[data-source="${source}"] span`;
    return {type, source, selector};
}

function DecodeProtectedEmail(obj) {
    $('[data-cfemail]', obj).each((_, entry) => {
        let encoded_email = $(entry).data('cfemail');
        let percent_decode = "";
        let xorkey = '0x' + encoded_email.substr(0, 2) | 0;
        for(let n = 2; encoded_email.length - n; n += 2) {
            percent_decode += '%' + ( '0' + ('0x' + encoded_email.substr(n, 2) ^ xorkey).toString(16)).slice(-2);
        }
        entry.outerHTML = decodeURIComponent(percent_decode);
    });
    return obj;
}

function PostCustomQuery(query) {
    let parameters = {search: {}};
    let taglist = query.trim().split(/\s+/);
    let tagchanges = taglist.filter((tag) => !tag.match(/^[+~-]/));
    if (tagchanges.length) {
        parameters.search.all_changed_tags = tagchanges.join(' ');
    }
    let tagadds = taglist.filter((tag) => tag.startsWith('+')).map((tag) => tag.slice(1));
    if (tagadds.length) {
        parameters.search.added_tags_include_any = tagadds.join(' ');
    }
    let tagremoves = taglist.filter((tag) => tag.startsWith('-')).map((tag) => tag.slice(1));
    if (tagremoves.length) {
        parameters.search.removed_tags_include_any = tagremoves.join(' ');
    }
    let tagoptional = taglist.filter((tag) => tag.startsWith('~')).map((tag) => tag.slice(1));
    if (tagoptional.length) {
        parameters.search.any_changed_tags = tagoptional.join(' ');
    }
    return (Object.keys(parameters.search).length > 0 ? parameters : {});
}

//Data functions

function GetEvents(type, bypass = false) {
    let storage_key = `el-${type}-saved-events`;
    if (JSPLib.storage.inMemoryStorage(storage_key, localStorage) && !bypass) {
        //It's already in memory, so it should be good with the current userscript version.
        return JSPLib.storage.getLocalData(storage_key);
    }
    //Events on local storage need to be checked and corrected if possible.
    let events = JSPLib.storage.getLocalData(storage_key, {default_val: [], bypass});
    if (CorrectEvents(storage_key, events)) {
        //Get the corrected events.
        events = JSPLib.storage.getLocalData(storage_key);
    }
    return events;
}

function GetItemList(type) {
    if (!IsEventEnabled(type, 'subscribe_events_enabled')) {
        return new Set();
    }
    if (EL.subscribeset[type]) {
        return EL.subscribeset[type];
    }
    EL.subscribeset[type] = JSPLib.storage.getLocalData(`el-${type}-item-list`, {default_val: []});
    if (CorrectList(type, EL.subscribeset)) {
        setTimeout(() => {
            JSPLib.storage.setLocalData(`el-${type}-item-list`, EL.subscribeset[type]);
        }, NONSYNCHRONOUS_DELAY);
    }
    EL.subscribeset[type] = new Set(EL.subscribeset[type]);
    return EL.subscribeset[type];
}

function SetItemList(type, remove_item, itemid) {
    if (!IsEventEnabled(type, 'subscribe_events_enabled')) {
        return;
    }
    let typeset = GetItemList(type);
    if (remove_item) {
        // eslint-disable-next-line dot-notation
        typeset.delete(itemid);
    } else {
        typeset.add(itemid);
    }
    JSPLib.storage.setLocalData(`el-${type}-item-list`, [...typeset]);
    EL.channel.postMessage({type: 'subscribe', eventtype: type, was_subscribed: remove_item, itemid, eventset: typeset});
    EL.subscribeset[type] = typeset;
}

function GetUserList(type) {
    if (!IsEventEnabled(type, 'user_events_enabled')) {
        return new Set();
    }
    if (EL.userset[type]) {
        return EL.userset[type];
    }
    EL.userset[type] = JSPLib.storage.getLocalData(`el-${type}-user-list`, {default_val: []});
    if (CorrectList(type, EL.userset)) {
        setTimeout(() => {
            JSPLib.storage.setLocalData(`el-${type}-user-list`, EL.userset);
        }, NONSYNCHRONOUS_DELAY);
    }
    EL.userset[type] = new Set(EL.userset[type]);
    return EL.userset[type];
}

function SetUserList(type, remove_item, userid) {
    if (!IsEventEnabled(type, 'user_events_enabled')) {
        return;
    }
    let typeset = GetUserList(type);
    if (remove_item) {
        // eslint-disable-next-line dot-notation
        typeset.delete(userid);
    } else {
        typeset.add(userid);
    }
    JSPLib.storage.setLocalData(`el-${type}-user-list`, [...typeset]);
    EL.channel.postMessage({type: 'subscribe_user', eventtype: type, was_subscribed: remove_item, userid, eventset: typeset});
    EL.userset[type] = typeset;
}

function CheckItemList(type) {
    if (!JSPLib.menu.isSettingEnabled('subscribe_events_enabled', type)) {
        return false;
    }
    let typelist = localStorage.getItem(`el-${type}-item-list`);
    return Boolean(typelist) && typelist !== '[]';
}

function CheckUserList(type) {
    if (!JSPLib.menu.isSettingEnabled('user_events_enabled', type)) {
        return false;
    }
    let typelist = localStorage.getItem(`el-${type}-user-list`);
    return Boolean(typelist) && typelist !== '[]';
}

//Save functions

function SaveLastID(type, source, last_id) {
    let printer = JSPLib.debug.getFunctionPrint('SaveLastID');
    if (!JSPLib.validate.validateID(last_id)) {
        printer.debugwarn("Last ID for", type, "is not valid!", last_id);
        return;
    }
    let storage_key = `el-${type}-${source}-last-id`;
    let previous_id = JSPLib.storage.checkLocalData(storage_key, {default_val: 1});
    last_id = Math.max(previous_id, last_id);
    JSPLib.storage.setLocalData(storage_key, last_id);
    printer.debuglog(`Set last ${source} ${type} ID:`, last_id);
}

async function SaveRecentDanbooruID(type, source) {
    let type_addon = TYPEDICT[type].addons || {};
    let url_addons = JSPLib.utility.mergeHashes(type_addon, {only: ID_FIELD, limit: 1});
    let items = await JSPLib.danbooru.submitRequest(TYPEDICT[type].controller, url_addons, {default_val: []});
    if (items.length) {
        SaveLastID(type, source, JSPLib.danbooru.getNextPageID(items, true));
    } else if (type === 'dmail') {
        SaveLastID(type, source, 1);
    }
}

function SaveLastChecked(type, source) {
    let last_checked = Date.now();
    JSPLib.storage.setLocalData(`el-${type}-${source}-last-checked`, last_checked);
    let time_ago = JSPLib.utility.timeAgo(last_checked);
    UpdateHomeText(type, source, '.el-last-checked', time_ago);
}

function SaveOverflow(type, source, network_data, batch_limit) {
    let printer = JSPLib.debug.getFunctionPrint('SaveOverflow');
    if (network_data.length === batch_limit) {
        printer.debuglog(`${batch_limit} ${type} items on ${source} query; overflow detected!`);
        JSPLib.storage.setLocalData(`el-${type}-${source}-overflow`, true);
    } else {
        JSPLib.storage.setLocalData(`el-${type}-${source}-overflow`, false);
    }
}

function SaveEventRecheck(type, source) {
    let updated_timeout = JSPLib.concurrency.setRecheckTimeout(`el-${type}-${source}-event-timeout`, EL.timeout_expires, EL.timeout_jitter);
    let next_check = JSPLib.utility.timeFromNow(updated_timeout);
    UpdateHomeText(type, source, '.el-next-check', next_check);
}

function SaveFoundEvents(type, source, found_events, all_data) {
    let saved_events = GetEvents(type);
    let updated_events = [];
    var last_found_event;
    found_events.forEach((event) => {
        let saved_event = saved_events.find((ev) => ev.id === event.id);
        if (saved_event) {
            saved_event.match = JSPLib.utility.arrayUnion(saved_event.match, event.match);
            updated_events.push(saved_event);
        } else {
            updated_events.push(event);
            EL.new_events_found = true;
        }
        if (!last_found_event || event.id > last_found_event.id) {
            last_found_event = event;
        }
    });
    saved_events.forEach((event) => {
        let found_event = found_events.find((ev) => ev.id === event.id);
        if (!found_event) {
            updated_events.push(event);
        }
    });
    updated_events.sort((eva, evb) => evb.id - eva.id);
    JSPLib.storage.setLocalData(`el-${type}-saved-events`, updated_events);
    let last_record = all_data.find((item) => item.id === last_found_event.id);
    let last_timestamp = JSPLib.utility.toTimeStamp(last_record.created_at);
    JSPLib.storage.setLocalData(`el-${type}-${source}-last-seen`, last_timestamp);
}

function PruneSavedEvents(type, item_ids) {
    let events = GetEvents(type);
    let pruned_events = events.filter((ev) => !item_ids.includes(ev.id));
    console.log("Pruned events:", type, item_ids, pruned_events);
    //JSPLib.storage.setLocalData(`el-${type}-saved-events`, pruned_events);
}

//Update functions

function UpdateHomeText(type, source, classname, text) {
    if (source) {
        $(`.el-home-section[data-type=${type}] ${classname}[data-source="${source}"] span`).html(text);
    } else {
        $(`.el-home-section[data-type=${type}] ${classname} span`).html(text);
    }
}

function UpdateNavigation(primary = true) {
    let events_total = 0;
    let new_events = false;
    ALL_EVENTS.forEach((type) => {
        if (!AnyEventEnabled(type)) return;
        let events = GetEvents(type, !primary);
        events_total += events.length;
        new_events ||= events.some((event) => !event.seen);
    });
    $('#el-events-total').text(events_total);
    if (new_events) {
        $('#el-nav-events').addClass('el-has-new-events');
    } else {
        $('#el-nav-events').removeClass('el-has-new-events');
    }
    if (primary) {
        EL.channel.postMessage({type: 'update_navigation'});
    }
}

function UpdateHomeEvent(type, primary = true) {
    if ($('#el-page').length) {
        let saved_events = GetEvents(type, !primary);
        let new_events = saved_events.filter((ev) => !ev.seen);
        UpdateHomeText(type, null, '.el-new-events', new_events.length);
        UpdateHomeText(type, null, '.el-available-events', saved_events.length);
        let $home_section = $(`.el-home-section[data-type="${type}"]`);
        if (new_events.length) {
            $home_section.addClass('el-has-new-events');
        } else {
            $home_section.removeClass('el-has-new-events');
        }
    }
    if (primary) {
        EL.channel.postMessage({type: 'update_event', event_type: type});
    }
}

function UpdateHomeSource(type, source, primary = true) {
    if ($('#el-page').length) {
        let last_seen = JSPLib.storage.getLocalData(`el-${type}-${source}-last-seen`, {bypass: !primary});
        let last_checked = JSPLib.storage.getLocalData(`el-${type}-${source}-last-checked`, {bypass: !primary});
        let event_timeout = JSPLib.storage.getLocalData(`el-${type}-${source}-event-timeout`, {bypass: !primary});
        let overflowed = JSPLib.storage.getLocalData(`el-${type}-${source}-overflow`, {default_val: false, bypass: !primary});
        let seen_ago = JSPLib.utility.timeAgo(last_seen);
        let checked_ago = JSPLib.utility.timeAgo(last_checked);
        let next_check = JSPLib.utility.timeFromNow(event_timeout);
        let pages_checked = (overflowed ? MORE_HTML : NONE_HTML);
        UpdateHomeText(type, source, '.el-last-seen', seen_ago);
        UpdateHomeText(type, source, '.el-last-checked', checked_ago);
        UpdateHomeText(type, source, '.el-next-check', next_check);
        UpdateHomeText(type, source, '.el-pages-left', pages_checked);
    }
    if (primary) {
        EL.channel.postMessage({type: 'update_source', event_type: type, event_source: source});
    }
}

function UpdateSectionPage(type, page) {
    let events = GetEvents(type);
    let {page_min, page_max} = GetPageValues(page);
    let max_page = Math.floor((events.length - 1) / 20) + 1;
    let $body_header = $(`.el-event-body[data-type="${type}"] .el-body-header`);
    let first_event = JSPLib.utility.padNumber(page_min, 3);
    let last_event = JSPLib.utility.padNumber(Math.min(page_max, events.length), 3);
    if (page === 1) {
        $body_header.find('.el-paginator-prev').addClass('el-link-disabled');
    } else {
        $body_header.find('.el-paginator-prev').removeClass('el-link-disabled');
    }
    if (page === max_page) {
        $body_header.find('.el-paginator-next').addClass('el-link-disabled');
    } else {
        $body_header.find('.el-paginator-next').removeClass('el-link-disabled');
    }
    $body_header.find('.el-first-event').text(first_event);
    $body_header.find('.el-last-event').text(last_event);
    TYPEDICT[type].insert_events(page, type).then(() => {
        UpdateMarkReadLinks(type);
    });
}

function UpdateMarkReadLinks(type) {
    let events = GetEvents(type);
    let $event_body = $(`.el-event-body[data-type="${type}"]`);
    $event_body.find('.el-mark-read-links a').removeClass('el-link-disabled');
    if (events.length === 0) {
        $event_body.find('.el-mark-read-links a').addClass('el-link-disabled');
    } else if ($event_body.find('.el-mark-read input').length === 0) {
        $event_body.find('.el-mark-selected, .el-mark-page').addClass('el-link-disabled');
    }
}

function UpdatePostPreviews($obj) {
    $obj.find('.post-preview').each((_, entry) => {
        entry.style.setProperty('display', 'flex', 'important');
        entry.style.setProperty('visibility', 'visible', 'important');
        entry.style.setProperty('justify-content', 'center');
        entry.style.setProperty('width', '225px');
    });
}

function UpdateUserOnNewEvents(primary = true) {
    if (!document.hidden) {
        console.log("Not hidden, showing notice immediately.");
        JSPLib.notice.notice("<b>EventListener:</b> New events available.", true);
        JSPLib.storage.setLocalData('el-new-events-notice', false);
    } else {
        console.log("Hidden, setting up a focus window event.");
        $(window).one('focus.el.new-events', () => {
            let show_notice = JSPLib.storage.getLocalData('el-new-events-notice', {default_val: false, bypass: true});
            console.log("Focus event triggered:", show_notice);
            if (show_notice) {
                JSPLib.notice.notice("<b>EventListener:</b> New events available.", true);
                JSPLib.storage.setLocalData('el-new-events-notice', false);
            }
        });
        if (primary) {
            JSPLib.storage.setLocalData('el-new-events-notice', true);
            EL.channel.postMessage({type: 'new_events'});
        }
    }
}

//Render functions

function RenderMultilinkMenu(itemid, event_type) {
    return `
<div id="el-subscribe-events" data-id="${itemid}" data-type="${event_type}">
    Subscribe (<span id="el-add-links"></span>)
</div>`;
}

function RenderSubscribeMultiLinks(name, typelist, itemid, event_type) {
    var subscribe_func;
    if (event_type === 'subscribe_events_enabled') {
        subscribe_func = GetItemList;
    } else if (event_type === 'user_events_enabled') {
        subscribe_func = GetUserList;
    }
    subscribe_func = subscribe_func || (event_type === 'user_events_enabled' ? GetItemList : null);
    let is_subscribed = typelist.every((type) => (subscribe_func(type).has(itemid)));
    let classname = (is_subscribed ? 'el-subscribed' : 'el-unsubscribed');
    let title = (is_subscribed ? 'subscribed' : 'unsubscribed');
    let keyname = JSPLib.utility.kebabCase(name);
    let idname = 'el-' + keyname + '-link';
    return `<span id="${idname}" data-type="${typelist}" class="el-multi-link ${classname}"><a title="${title}" href="javascript:void(0)">${name}</a></span>`;
}

function RenderOpenItemLinks(type, itemid, showtext = "Show", hidetext = "Hide") {
    return `
<span class="el-show-hide-links" data-type="${type}" data-id="${itemid}">
    <span data-action="show" style><a class="el-monospace-link" href="javascript:void(0)">${showtext}</a></span>
    <span data-action="hide" style="display:none !important"><a class="el-monospace-link" href="javascript:void(0)">${hidetext}</a></span>
</span>`;
}

function RenderOpenItemContainer(type, itemid, columns) {
    return `
<tr class="el-full-item" data-type="${type}" data-id="${itemid}">
    <td colspan="${columns}"><span style="font-size: 24px; font-weight: bold;">Loading...</span></td>
</tr>`;
}

function RenderEventsPage() {
    let home_body = RenderEventsHome();
    let header_html = '<div class="el-event-header el-header-active" data-type="home"><a>Home</a></div>';
    let body_html = `<div class="el-event-body" data-type="home" style="display: flex; flex-wrap: wrap;">${home_body}</div>`;
    ALL_EVENTS.forEach((type) => {
        if (!AnyEventEnabled(type)) return;
        let available_events = GetEvents(type);
        if (available_events.length) {
            let {header, body} = RenderEventsSection(type);
            header_html += header;
            body_html += body;
        }
    });
    header_html += '<div class="el-event-header" data-type="close"><a>Close</a></div>';
    return `
<div id="el-page" style="margin-left: 2.5em; margin-top: 2em; display: none;">
    <div id="el-header" style="display: flex;">${header_html}</div>
    <div id="el-body" style="min-height: 50em;">${body_html}</div>
</div>`;
}

function RenderEventsSection(type) {
    let title = JSPLib.utility.properCase(type);
    let header = `<div class="el-event-header" data-type="${type}"><a>${title}</a></div>`;
    let body = `<div class="el-event-body" data-type="${type}" style="margin: 1em;"></div>`;
    return {header, body};
}

function RenderEventsHome() {
    let body_html = "";
    ALL_EVENTS.forEach((type) => {
        if (!AnyEventEnabled(type)) return;
        let section_html = `<li class="el-new-events"><b>New:</b> <span></span></li>`;
        section_html += `<li class="el-available-events"><b>Available:</b> <span></span></li>`;
        if (EL.all_subscribe_events.includes(type)) {
            let subsection_html = RenderHomeSubsection('subscribe');
            if (EL.post_query_events_enabled.includes(type)) {
                section_html += `
<li><u>Subscribe</u>
    <ul>${subsection_html}</ul>
</li>`;
            } else {
                section_html += subsection_html;
            }
        }
        if (EL.post_query_events_enabled.includes(type)) {
            let subsection_html = RenderHomeSubsection('post-query');
            if (EL.all_subscribe_events.includes(type)) {
                section_html += `
<li><u>Post query</u>
    <ul>${subsection_html}</ul>
</li>`;
            } else {
                section_html += subsection_html;
            }
        }
        if (EL.other_events_enabled.includes(type)) {
            section_html += RenderHomeSubsection('other');
        }
        let title = JSPLib.utility.properCase(type);
        body_html += `
<div class="el-home-section prose" data-type="${type}" style="width: 25em; padding: 2em;">
    <h4>${title}</h4>
    <ul>${section_html}</ul>
</div>`;
    });
    return body_html;
}

function RenderHomeSubsection(source) {
    return `
<li class="el-last-seen" data-source="${source}"><b>Last seen:</b> <span></span></li>
<li class="el-last-checked" data-source="${source}"><b>Last checked:</b> <span></span></li>
<li class="el-next-check" data-source="${source}"><b>Next check:</b> <span></span></li>
<li class="el-pages-left" data-source="${source}"><b>Pages left:</b> (&thinsp;<span></span>&thinsp;)</li>
<li class="el-check-more" data-source="${source}">
    <a style="cursor: pointer; font-weight: bold; color: green;">Check more</a>
</li>
<li class="el-check-all" data-source="${source}">
    <a style="cursor: pointer; font-weight: bold; color: green;">Check all</a>
</li>`;
}

//Initialize functions

function InstallSubscribeLinks() {
    if (EL.action === 'show') {
        switch (EL.controller) {
            case 'posts':
                InitializePostShowMenu();
                break;
            case 'forum-topics':
                InitializeTopicShowMenu();
                break;
            case 'wiki-pages':
            case 'wiki-page-versions':
                InitializeWikiShowMenu();
                break;
            case 'artists':
                InitializeArtistShowMenu();
                break;
            case 'pools':
                InitializePoolShowMenu();
                break;
            case 'users':
                InitializeUserShowMenu();
                //falls through
            default:
                //do nothing
        }
    }
    $('#el-subscribe-events a').on(PROGRAM_CLICK, SubscribeMultiLink);
}

function InstallEventsNavigation() {
    $('#nav-more').before(EVENTS_NAV_HTML);
    UpdateNavigation();
    $('#el-nav-events').on(PROGRAM_CLICK, OpenEventsPage);
}

function InstallEventSection(type) {
    let {header, body} = RenderEventsSection(type);
    $('.el-event-header[data-type="close"]').before(header);
    $('#el-body').append(body);
}

function LoadEventsPage() {
    $('#page').after(RenderEventsPage());
    ALL_EVENTS.forEach((type) => {
        if (!AnyEventEnabled(type)) return;
        UpdateHomeEvent(type);
        if (EL.all_subscribe_events.includes(type)) {
            UpdateHomeSource(type, 'subscribe');
        }
        if (EL.post_query_events_enabled.includes(type)) {
            UpdateHomeSource(type, 'post-query');
        }
        if (EL.other_events_enabled.includes(type)) {
            UpdateHomeSource(type, 'other');
        }
    });
    $('#el-page .el-event-header a').on(PROGRAM_CLICK, EventTab);
    $('#el-page .el-check-more').on(PROGRAM_CLICK, CheckMore);
    $('#el-page .el-check-all').on(PROGRAM_CLICK, CheckAll);
}

function LoadEventSection(type) {
    let $body = $(`.el-event-body[data-type=${type}]`);
    if ($body.children().length > 0) return;
    let events = GetEvents(type);
    let total_events = JSPLib.utility.padNumber(events.length, 3);
    let mark_page_html = (events.length > 20 ? '| <a class="el-mark-page" title="Mark all items on page as read." style="cursor: pointer;">page</a>' : "");
    let body_html = `
<div class="el-body-header" style="margin-bottom: 1em; font-size: 16px;">
    <div style="margin-bottom: 1em;">
        Showing events <span class="el-first-event" style="font-family: monospace;"></span> - <span class="el-last-event" style="font-family: monospace;"></span> of <span class="el-total-events" style="font-family: monospace;">${total_events}</span>.&emsp;
        <span class="el-paginator">
            <a class="el-paginator-prev" style="cursor: pointer;">&ltprev&gt</a>
            |
            <a class="el-paginator-next" style="cursor: pointer;">&ltnext&gt</a>
        </span>
    </div>
    <div style="font-weight: bold;">
        <span class="el-select-links">Select [ <a class="el-select-all" title="Select all on current page." style="cursor: pointer;">all</a> | <a class="el-select-none" title="Select none on current page." style="cursor: pointer;">none</a> | <a class="el-select-invert" title="Invert selection on current page." style="cursor: pointer;">invert</a> ]</span>&emsp;
        <span class="el-mark-read-links">Mark Read [ <a class="el-mark-selected" title="Mark all selected items on page as read." style="cursor: pointer;">selected</a> ${mark_page_html} | <a class="el-mark-all" title="Mark all items across all pages as read." style="cursor: pointer;">all</a> ]</span>
    </div>
</div>
<div class="el-body-section" data-page="1"></div>`;
    $body.append(body_html);
    $body.find('.el-paginator-prev').on(PROGRAM_CLICK, PaginatorPrevious);
    $body.find('.el-paginator-next').on(PROGRAM_CLICK, PaginatorNext);
    $body.find('.el-select-all').on(PROGRAM_CLICK, SelectAll);
    $body.find('.el-select-none').on(PROGRAM_CLICK, SelectNone);
    $body.find('.el-select-invert').on(PROGRAM_CLICK, SelectInvert);
    $body.find('.el-mark-selected').on(PROGRAM_CLICK, MarkSelected);
    $body.find('.el-mark-page').on(PROGRAM_CLICK, MarkPage);
    $body.find('.el-mark-all').on(PROGRAM_CLICK, MarkAll);
    UpdateSectionPage(type, 1);
}

function AppendFloatingHeader($container, $table) {
    // Must wait until the table is attached to the dom before measuring the header, otherwise the height/width will be null.
    // Additionally, must wait for any asynchronously added post previews, since those affect the column widths.
    let header_html = "";
    $table.find('thead th').each((_, th) => {
        let {width, height} = getComputedStyle(th);
        header_html += `<div class="el-floating-cell" style="padding: 4px 6px; width: ${width}; height: ${height}">${th.innerText}</div>`;
        EL.th_observer.observe(th);
    });
    let header_width = getComputedStyle($table.find('thead').get(0)).width;
    let $header = $(`<div class="el-floating-header" style="width: ${header_width}; display: flex; background: var(--body-background-color); position: absolute; top: 0; font-weight: bold; border-bottom: 2px solid var(--table-header-border-color); z-index: 10;">${header_html}</div>`);
    $container.append($header);
    EL.thead_observer.observe($table.find('thead').get(0));
}

//Filter functions

function FindEvents(array, source, subscribe_set, user_set) {
    let printer = JSPLib.debug.getFunctionPrint('FindData');
    let found_events = [];
    for (let i = 0; i < array.length; i++) {
        let val = array[i];
        if (!Number.isInteger(val.id)) {
            continue;
        }
        if ((EL.filter_user_events && this.user && (val[this.user] === EL.userid)) || EL.filter_users.includes(val[this.user])) {
            continue;
        }
        if (this.other_filter && !this.other_filter(val)) {
            continue;
        }
        let item = {
            id: array[i].id,
            match: [],
            seen: false,
        };
        if (source === 'subscribe') {
            if (user_set.size && user_set.has(val[this.user])) {
                printer.debuglogLevel('user_set', this.controller, val, JSPLib.debug.DEBUG);
                item.match.push('user');
            }
            if (subscribe_set.size && subscribe_set.has(val[this.item])) {
                printer.debuglogLevel('subscribe_set', this.controller, val, JSPLib.debug.DEBUG);
                item.match.push('subscribe');
            }
            if (EL.show_creator_events && this.creator && JSPLib.utility.getNestedAttribute(val, this.creator) === EL.userid) {
                printer.debuglogLevel('creator_event', this.controller, val, JSPLib.debug.DEBUG);
                item.match.push('creator');
            }
            if (EL.show_parent_events && this.controller === 'post_versions') {
                if (EL.show_creator_events && val.post.parent?.uploader_id === EL.userid) {
                    printer.debuglogLevel('creator_parent_event', this.controller, val, JSPLib.debug.DEBUG);
                    item.match.push('creator');
                }
                if (subscribe_set.has(val.post.parent?.id)) {
                    printer.debuglogLevel('subscribe_parent_event', this.controller, val, JSPLib.debug.DEBUG);
                    item.match.push('subscribe');
                }
            }
        } else {
            printer.debuglogLevel('post_query-other', this.controller, val, JSPLib.debug.DEBUG);
            let match = (source === 'post-query' ? 'post-query' : 'any');
            item.match.push(match);
        }
        if (item.match.length) {
            found_events.push(item);
        }
    }
    return found_events;
}

function FindCategoryEvents(array) {
    let found_events = [];
    for (let i = 0; i < array.length; i ++) {
        if(EL.subscribed_mod_actions.includes(array[i].category)) {
            found_events.push({
                id: array[i].id,
                match: ['category'],
                seen: false,
            });
        }
    }
    return found_events;
}

function IsShownCommentary(val) {
    if (!EL.filter_untranslated_commentary) {
        return true;
    }
    return (Boolean(val.translated_title) || Boolean(val.translated_description));
}

function IsShownPostEdit(val) {
    if (EL.filter_BUR_edits && val.updater_id === SERVER_USER_ID) {
        return false;
    }
    if (EL.filter_post_edits === "") {
        return true;
    }
    let changed_tags = new Set(JSPLib.utility.concat(val.added_tags, val.removed_tags));
    return !JSPLib.utility.setHasIntersection(changed_tags, EL.post_filter_tags);
}

function IsShownFeedback(val) {
    if (!EL.filter_autofeedback) {
        return true;
    }
    return (val.body.match(/^Banned forever:/) === null)
    && (val.body.match(/^Banned \d+ (days?|weeks|months?|years?):/) === null)
    && (val.body.match(/^You have been (promoted|demoted) to a \S+ level account from \S+\./) === null)
    && (val.body.match(/\bYou (gained|lost) the ability to (approve posts|upload posts without limit|give user feedback|flag posts)\./) === null);
}

function IsShownBan(val) {
    if (!EL.filter_autobans) {
        return true;
    }
    return val.banner_id !== SERVER_USER_ID;
}


//Insert functions

async function InsertTableEvents(page, type) {
    EL.pages[type] ??= {};
    let $body_section = $(`.el-event-body[data-type="${type}"] .el-body-section`);
    if (!EL.pages[type][page]) {
        let events = GetEvents(type);
        $body_section.html('<span style="font-size: 24px; font-weight: bold;">Loading...</span>');
        let $page = await GetHTMLPage(type, page, events);
        if ($page) {
            let $table = $('table.striped', $page);
            let table_header = '<th width="2%"></th><th width="8%">Found with</th>';
            table_header += (TYPEDICT[type].add_thumbnail ? '<th width="1%">Preview</th>' : "");
            $table.find('thead tr').prepend(table_header);
            let post_ids = new Set();
            $table.find('tbody tr').each((_, row) => {
                let $row = $(row);
                let id = $row.data('id');
                let event = events.find((ev) => ev.id === id);
                let match_html = event.match.map((m) => m.replace('-', ' ')).join('&ensp;&amp;<br>');
                let row_addon = `<td class="el-mark-read"><input type="checkbox"></td><td class="el-found-with" style="color: orange;">${match_html}</td>`;
                if (TYPEDICT[type].add_thumbnail) {
                    let post_id = $row.data('post-id');
                    post_ids.add(post_id);
                    row_addon += '<td class="el-post-preview"></td>';
                }
                $row.prepend(row_addon);
            });
            $table.find('time').each((_, entry) => {
                entry.innerText = JSPLib.utility.timeAgo(entry.dateTime);
            });
            let $container = $('<div class="el-table-container"></div>');
            let $pane = $('<div class="el-table-pane"></div>');
            if (post_ids.size) {
                GetEventThumbnails([...post_ids]).then((thumbnails) => {
                    thumbnails.forEach((entry) => {
                        let $entry = $(entry);
                        let post_id = $entry.data('id');
                        $table.find(`tr[data-post-id="${post_id}"] .el-post-preview`).append($entry.clone());
                    });
                    UpdatePostPreviews($table);
                });
            } else {
                UpdatePostPreviews($table);
            }
            if (TYPEDICT[type].column_widths) {
                for (let classname in TYPEDICT[type].column_widths) {
                    $table.find(`thead th.${classname}`).attr('width', TYPEDICT[type].column_widths[classname]);
                }
            }
            $pane.append($table.detach());
            $container.append($pane);
            TYPEDICT[type].insert_postprocess?.($table);
            EL.pages[type][page] = $container;
            $body_section.empty().append($container);
            AppendFloatingHeader($container, $table);
            UpdateHomeEvent(type);
            UpdateNavigation();
        } else {
            $body_section.html(`<span style="color: red; font-size: 24px; font-weight: bold;">ERROR LOADING TABLE FOR ${TYPEDICT[type].plural.toUpperCase()}!</span>`);
        }
    } else {
        $body_section.empty().append(EL.pages[type][page]);
    }
    $body_section.data('page', page);
}

async function InsertCommentEvents(page) {
    EL.pages.comment ??= {};
    let $body_section = $('.el-event-body[data-type="comment"] .el-body-section');
    if (!EL.pages.comment[page]) {
        $body_section.html('<span style="font-size: 24px; font-weight: bold;">Loading...</span>');
        let events = GetEvents('comment');
        let $page = await GetHTMLPage('comment', page, events);
        if ($page) {
            let $section = $('.list-of-comments', $page);
            $section.find('article.comment').each((_, entry) => {
                let $entry = $(entry);
                let id = $entry.data('id');
                let event = events.find((ev) => ev.id === id);
                let match_html = event.match.map((m) => m.replace('-', ' ')).join('&ensp;&amp;<br>');
                $entry.closest('div.post').prepend(`<div class="el-mark-read" style="width: 2em;"><input type="checkbox"></div><div class="el-found-with" style="color: orange; width: 10em; padding-left: 0.5em;">${match_html}</div>`);
            });
            $section.find('time').each((_, entry) => {
                entry.innerText = JSPLib.utility.timeAgo(entry.dateTime);
            });
            $section.children().slice(0, -1).css({
                'border-bottom': '1px solid lightgrey',
                'padding-bottom': '10px',
            });
            $section.addClass('el-comments-pane');
            let $container = $('<div><div style="display: flex; font-weight: bold; gap: 1rem;"><div style="width: 2em; text-decoration: underline;"></div><div style="width: 10em; text-decoration: underline"><span style="font-size: 18px;">Found with</span></div><div style="padding-left: 1em; text-decoration: underline;"><span style="font-size: 18px;">Comments</span></div></div></div>');
            $container.append($section);
            $section.find('.post-preview').each((_, entry) => {
                entry.style.setProperty('display', 'flex', 'important');
                entry.style.setProperty('visibility', 'visible', 'important');
            });
            EL.pages.comment[page] = $container;
            $body_section.empty().append($container);
            UpdateHomeEvent('comment');
            UpdateNavigation();
        } else {
            $body_section.html(`<span style="color: red; font-size: 24px; font-weight: bold;">ERROR LOADING TABLE FOR ${TYPEDICT.comment.plural.toUpperCase()}!</span>`);
        }
    } else {
        $body_section.empty().append(EL.pages.comment[page]);
    }
    $body_section.data('page', page);
}

//Postprocess functions

function ForumPostprocess($table) {
    $table.find('tbody tr').each((_, row) => {
        let $row = $(row);
        let forum_id = $row.data('id');
        let link_html = RenderOpenItemLinks('forum', forum_id);
        $row.find('.forum-post-excerpt').prepend(link_html + '&nbsp;|&nbsp;');
    });
    OpenEventClick('forum', $table, AddForumPostRow);
}

function DmailPostprocess($table) {
    $table.find('tbody tr').each((_, row) => {
        let $row = $(row);
        let dmail_id = $(row).data('id');
        let link_html = RenderOpenItemLinks('dmail', dmail_id);
        $row.find('.subject-column').prepend(link_html + '&nbsp;|&nbsp;');
    });
    OpenEventClick('dmail', $table, AddDmailRow);
}

function PoolPostprocess($table) {
    $table.find('tbody tr').each((_, row) => {
        let $row = $(row);
        let pool_version_id = $row.data('id');
        let $post_changes = $row.find('.post-changes-column');
        let add_posts = $post_changes.find('.diff-list ins a[href^="/posts"]').map((_, entry) => entry.innerText).toArray();
        let rem_posts = $post_changes.find('.diff-list del a[href^="/posts"]').map((_, entry) => entry.innerText).toArray();
        let $post_count = $row.find('.post-count-column');
        if (add_posts.length || rem_posts.length) {
            let link_html = RenderOpenItemLinks('poolposts', pool_version_id, 'Show posts', 'Hide posts');
            $post_count.prepend(link_html, '&nbsp;|&nbsp;');
            $post_count.attr('data-add-posts', add_posts);
            $post_count.attr('data-rem-posts', rem_posts);
        } else {
            $post_count.prepend('<span style="font-family:monospace">&nbsp;&nbsp;No posts&nbsp;|&nbsp;</span>');
        }
        let $desc_changed_link = $row.find('.diff-column a[href$="/diff"]');
        if ($desc_changed_link.length !== 0) {
            let link_html = RenderOpenItemLinks('pooldiff', pool_version_id, 'Show diff', 'Hide diff');
            $desc_changed_link.replaceWith(link_html);
        } else {
            $row.find('.diff-column').html('<span style="font-family:monospace">&nbsp;&nbsp;No diff</span>');
        }
    });
    OpenEventClick('pooldiff', $table, AddPoolDiffRow);
    OpenEventClick('poolposts', $table, AddPoolPostsRow);
}

function WikiPostprocess($table) {
    $table.find('tbody tr').each((_, row) => {
        let $row = $(row);
        let $column = $row.find('.diff-column');
        let $diff_link = $column.find('a');
        if ($diff_link.length) {
            let wiki_version_id = $row.data('id');
            let link_html = RenderOpenItemLinks('wiki', wiki_version_id, "Show diff", "Hide diff");
            $diff_link.replaceWith(`${link_html}`);
        } else {
            $column.html('&nbsp&nbspNo diff');
        }
    });
    OpenEventClick('wiki', $table, AddWikiDiffRow);
}

//Table row functions

async function AddDmailRow(dmail_id, $row) {
    let $outerblock = $(RenderOpenItemContainer('dmail', dmail_id, 7));
    let $td = $outerblock.find('td');
    $row.after($outerblock);
    let dmail = await JSPLib.network.getNotify(`/dmails/${dmail_id}`);
    if (dmail) {
        let $dmail = $.parseHTML(dmail);
        $('.dmail h1:first-of-type', $dmail).hide();
        $td.empty().append($('.dmail', $dmail));
    } else {
        $td.empty().append('<span style="font-weight: bold; font-size: 24px; color: red;">ERROR LOADING DMAIL!</span>');
    }
}

async function AddForumPostRow(forum_id, $row) {
    let $outerblock = $(RenderOpenItemContainer('forum', forum_id, 6));
    let $td = $outerblock.find('td');
    $row.after($outerblock);
    let forum_page = await JSPLib.network.getNotify(`/forum_posts/${forum_id}`);
    if (forum_page) {
        let $forum_page = $.parseHTML(forum_page);
        let $forum_post = $(`#forum_post_${forum_id}`, $forum_page);
        $td.empty().append($forum_post);
    } else {
        $td.empty().append('<span style="font-weight: bold; font-size: 24px; color: red;">ERROR LOADING FORUM POST!</span>');
    }
}

async function AddWikiDiffRow(wiki_version_id, $row) {
    let $outerblock = $(RenderOpenItemContainer('wiki', wiki_version_id, 6));
    let $td = $outerblock.find('td');
    $row.after($outerblock);
    let wiki_diff_page = await JSPLib.network.getNotify('/wiki_page_versions/diff', {url_addons: {thispage: wiki_version_id, type: 'previous'}});
    if (wiki_diff_page) {
        let $wiki_diff_page = $.parseHTML(wiki_diff_page);
        $td.empty().append($('#a-diff #content', $wiki_diff_page));
        $outerblock.find('.fixed-width-container').removeClass('.fixed-width-container');
    } else {
        $td.empty().append('<span style="font-weight: bold; font-size: 24px; color: red;">ERROR LOADING WIKI PAGE DIFF!</span>');
    }
}

async function AddPoolDiffRow(pool_version_id, $row) {
    let $outerblock = $(RenderOpenItemContainer('pooldiff', pool_version_id, 9));
    let $td = $outerblock.find('td');
    $row.after($outerblock);
    let pool_diff = await JSPLib.network.getNotify(`/pool_versions/${pool_version_id}/diff`);
    if (pool_diff) {
        let $pool_diff = $.parseHTML(pool_diff);
        $td.empty().append($('#a-diff', $pool_diff));
        $outerblock.find('#a-diff > h1').hide();
    } else {
        $td.empty().append('<span style="font-weight: bold; font-size: 24px; color: red;">ERROR LOADING POOL DIFF!</span>');
    }
}

async function AddPoolPostsRow(pool_version_id, $row) {
    const insertPostPreviews = function ($container, thumbnails, post_ids) {
        if (post_ids.length) {
            post_ids.forEach((post_id) => {
                let preview = thumbnails.find((entry) => $(entry).data('id') === post_id);
                $container.append($(preview).clone());
            });
            $container.show();
        }
    };
    let $outerblock = $(RenderOpenItemContainer('poolposts', pool_version_id, 9));
    let $td = $outerblock.find('td');
    $row.after($outerblock);
    let $post_count = $row.find('.post-count-column');
    let add_posts = String($post_count.data('add-posts') || "").split(',').sort().reverse().map(Number);
    let rem_posts = String($post_count.data('rem-posts') || "").split(',').sort().reverse().map(Number);
    let post_ids = JSPLib.utility.arrayUnion(add_posts, rem_posts);
    let thumbnails = await GetEventThumbnails(post_ids);
    if (thumbnails.length) {
        $td.empty().append(`<div class="el-add-pool-posts" style="display:none"></div><div class="el-rem-pool-posts" style="display:none"></div>`);
        insertPostPreviews($outerblock.find('.el-add-pool-posts'), thumbnails, add_posts);
        insertPostPreviews($outerblock.find('.el-rem-pool-posts'), thumbnails, rem_posts);
        UpdatePostPreviews($outerblock);
    } else {
        $td.empty().append('<span style="font-weight: bold; font-size: 24px; color: red;">ERROR LOADING POOL POSTS!</span>');
    }
}

//Update links

function UpdateMultiLink(typelist, subscribed, itemid) {
    let typeset = new Set(typelist);
    let current_subscribed = new Set($('#el-subscribe-events .el-subscribed').map((_, entry) => entry.dataset.type.split(',')));
    let new_subscribed = (subscribed ? JSPLib.utility.setDifference(current_subscribed, typeset) : JSPLib.utility.setUnion(current_subscribed, typeset));
    $(`#el-subscribe-events[data-id="${itemid}"] .el-multi-link`).each((_, entry) => {
        let entry_typelist = new Set(entry.dataset.type.split(','));
        if (JSPLib.utility.isSuperSet(entry_typelist, new_subscribed)) {
            $(entry).removeClass('el-unsubscribed').addClass('el-subscribed');
            $('a', entry).attr('title', 'subscribed');
        } else {
            $(entry).removeClass('el-subscribed').addClass('el-unsubscribed');
            $('a', entry).attr('title', 'unsubscribed');
        }
    });
}

//Network functions

async function GetHTMLPage(type, page, events) {
    let {page_min, page_max} = GetPageValues(page);
    let page_events = events.slice(page_min - 1, page_max);
    let query_ids = JSPLib.utility.getObjectAttributes(page_events, 'id');
    let type_addon = TYPEDICT[type].addons ?? {};
    let url_addons = JSPLib.utility.mergeHashes(type_addon, {search: {id: query_ids.join(','), order: 'custom'}, type: 'previous', limit: query_ids.length});
    let type_html = await JSPLib.network.getNotify(`/${TYPEDICT[type].controller}`, {url_addons});
    if (type_html) {
        page_events.forEach((event) => {event.seen = true;});
        JSPLib.storage.setLocalData(`el-${type}-saved-events`, events);
        let $parse = $.parseHTML(type_html);
        return DecodeProtectedEmail($parse);
    }
    return false;
}

async function AddParentInclude(versions) {
    let parent_ids = versions.map((version) => {
        if (!version.parent_changed) return null;
        let changed_tags = JSPLib.utility.concat(version.added_tags, version.removed_tags);
        let parent_tag = changed_tags.find((tag) => (/parent:\d+/.test(tag)));
        if (!parent_tag) return null;
        return Number(parent_tag.slice(7));
    });
    parent_ids = JSPLib.utility.arrayUnique(parent_ids.filter((id) => id !== null));
    if (parent_ids.length > 0) {
        let url_addons = {
            tags: `id:${parent_ids.join(',')} status:any`,
            limit: parent_ids.length,
            only: 'id,uploader_id',
        };
        let parent_posts = await JSPLib.danbooru.getAllItems('posts', 200, {url_addons, long_format: true});
        for (let i = 0; i < versions.length; i++) {
            let version = versions[i];
            if (version.parent_changed) {
                let parent_id = version.post.parent_id;
                let parent_post = parent_posts.find((post) => post.id === parent_id);
                if (parent_post) {
                    version.post.parent = parent_post;
                }
            }
        }
    }
    return versions;
}

async function GetEventThumbnails(post_ids) {
    let thumbnails = [];
    for (let i = 0; i < post_ids.length; i += QUERY_LIMIT) {
        let query_ids = post_ids.slice(i, i + QUERY_LIMIT);
        let url_addons = {tags: `id:${query_ids.join(',')} status:any limit:${query_ids.length}`, size: 225, show_votes: false};
        let html = await JSPLib.network.getNotify('/posts', {url_addons});
        if (html) {
            let $posts = $.parseHTML(html);
            thumbnails = JSPLib.utility.concat(thumbnails, [...$('.post-preview', $posts)]);
        }
    }
    return thumbnails;
}

//Initialize pages

function InitializeUserShowMenu() {
    //#C-USERS #A-SHOW
    if (!IsAnyEventEnabled(USER_EVENTS, 'user_events_enabled')) return;
    let userid = $(document.body).data('user-id');
    let $menu_obj = $.parseHTML(RenderMultilinkMenu(userid, 'user_events_enabled'));
    let menu_links = [];
    USER_EVENTS.forEach((type) => {
        if (!IsEventEnabled(type, 'user_events_enabled')) return;
        let linkhtml = RenderSubscribeMultiLinks(TYPEDICT[type].display, [type], userid, 'user_events_enabled');
        menu_links.push(`<span class="el-user-${type}-container">${linkhtml}</span>`);
    });
    if (AreAllEventsEnabled(ALL_TRANSLATE_EVENTS, 'user_events_enabled')) {
        let linkhtml = RenderSubscribeMultiLinks("Translations", ALL_TRANSLATE_EVENTS, userid, 'user_events_enabled');
        menu_links.push(`<span class="el-user-translated-container">${linkhtml}</span>`);
    }
    let enabled_user_events = JSPLib.utility.arrayIntersection(USER_EVENTS, EL.user_events_enabled);
    if (enabled_user_events.length > 1) {
        let linkhtml = RenderSubscribeMultiLinks("All", enabled_user_events, userid, 'user_events_enabled');
        menu_links.push(`<span class="el-user-all-container">${linkhtml}</span>`);
    }
    $('#el-add-links', $menu_obj).append(menu_links.join(' | '));
    $('#nav').append($menu_obj);
}

function InitializePostShowMenu() {
    //#C-POSTS #A-SHOW
    if (!IsAnyEventEnabled(ALL_POST_EVENTS, 'subscribe_events_enabled')) return;
    let postid = $('.image-container').data('id');
    let $menu_obj = $.parseHTML(RenderMultilinkMenu(postid, 'subscribe_events_enabled'));
    let menu_links = [];
    ALL_POST_EVENTS.forEach((type) => {
        if (!IsEventEnabled(type, 'subscribe_events_enabled')) return;
        let linkhtml = RenderSubscribeMultiLinks(TYPEDICT[type].display, [type], postid, 'subscribe_events_enabled');
        menu_links.push(`<span class="el-subscribe-${type}-container">${linkhtml}</span>`);
    });
    if (AreAllEventsEnabled(ALL_TRANSLATE_EVENTS, 'subscribe_events_enabled')) {
        let linkhtml = RenderSubscribeMultiLinks("Translations", ALL_TRANSLATE_EVENTS, postid, 'subscribe_events_enabled');
        menu_links.push(`<span class="el-subscribe-translated-container">${linkhtml}</span>`);
    }
    let enabled_post_events = JSPLib.utility.arrayIntersection(ALL_POST_EVENTS, EL.subscribe_events_enabled);
    if (enabled_post_events.length > 1) {
        let linkhtml = RenderSubscribeMultiLinks("All", enabled_post_events, postid, 'subscribe_events_enabled');
        menu_links.push(`<span class="el-subscribe-all-container">${linkhtml}</span>`);
    }
    $('#el-add-links', $menu_obj).append(menu_links.join(' | '));
    $('#nav').append($menu_obj);
}

function InitializeTopicShowMenu() {
    //#C-FORUM-TOPICS #A-SHOW
    if (!IsEventEnabled('forum', 'subscribe_events_enabled')) return;
    let topicid = $('body').data('forum-topic-id');
    let $menu_obj = $.parseHTML(RenderMultilinkMenu(topicid, 'subscribe_events_enabled'));
    let linkhtml = RenderSubscribeMultiLinks("Topic", ['forum'], topicid, 'subscribe_events_enabled');
    $('#el-add-links', $menu_obj).append(`<span class="el-subscribe-forum-container">${linkhtml}</span>`);
    $('#nav').append($menu_obj);
}

function InitializeWikiShowMenu() {
    //#C-WIKI-PAGES #A-SHOW / #C-WIKI-PAGE-VERSIONS #A-SHOW
    if (!IsEventEnabled('wiki', 'subscribe_events_enabled')) return;
    let data_selector = (EL.controller === 'wiki-pages' ? 'wiki-page-id' : 'wiki-page-version-wiki-page-id');
    let wikiid = $('body').data(data_selector);
    let $menu_obj = $.parseHTML(RenderMultilinkMenu(wikiid, 'subscribe_events_enabled'));
    let linkhtml = RenderSubscribeMultiLinks("Wiki", ['wiki'], wikiid, 'subscribe_events_enabled');
    $('#el-add-links', $menu_obj).append(`<span class="el-subscribe-wiki-container">${linkhtml}</span>`);
    $('#nav').append($menu_obj);
}

function InitializeArtistShowMenu() {
    //#C-ARTISTS #A-SHOW
    if (!IsEventEnabled('artist', 'subscribe_events_enabled')) return;
    let artistid = $('body').data('artist-id');
    let $menu_obj = $.parseHTML(RenderMultilinkMenu(artistid, 'subscribe_events_enabled'));
    let linkhtml = RenderSubscribeMultiLinks("Artist", ['artist'], artistid, 'subscribe_events_enabled');
    $('#el-add-links', $menu_obj).append(`<span class="el-subscribe-artist-container">${linkhtml}</span>`);
    $('#nav').append($menu_obj);
}

function InitializePoolShowMenu() {
    //#C-POOLS #A-SHOW
    if (!IsEventEnabled('pool', 'subscribe_events_enabled')) return;
    let poolid = $('body').data('pool-id');
    let $menu_obj = $.parseHTML(RenderMultilinkMenu(poolid, 'subscribe_events_enabled'));
    let linkhtml = RenderSubscribeMultiLinks("Pool", ['pool'], poolid, 'subscribe_events_enabled');
    $('#el-add-links', $menu_obj).append(`<span class="el-subscribe-pool-container">${linkhtml}</span>`);
    $('#nav').append($menu_obj);
}

//Event handlers

function OpenEventsPage() {
    $('#page-footer').hide();
    $('#page').hide();
    $('#top').hide();
    if ($('#el-page').length === 0) {
        LoadEventsPage();
    }
    $('#el-page').show();
    $('#el-close-notice-link').trigger('click');
}

function EventTab(event) {
    let type = $(event.currentTarget).parent().data('type');
    if (type !== 'close') {
        $('.el-event-body').hide();
        $(`.el-event-body[data-type="${type}"]`).show();
        $('.el-event-header').removeClass('el-header-active');
        $(`.el-event-header[data-type="${type}"]`).addClass('el-header-active');
        if (type !== 'home') {
            LoadEventSection(type);
        }
    } else {
        $('#el-page').hide();
        $('#top').show();
        $('#page').show();
        $('#page-footer').show();
    }
}

function CheckMore(event) {
    let {type, source, selector} = GetCheckVars(event);
    CheckType(type, source, false, selector);
}

function CheckAll(event) {
    let {type, source, selector} = GetCheckVars(event);
    CheckType(type, source, true, selector);
}

function PaginatorPrevious(event) {
    let $body = $(event.currentTarget).closest('.el-event-body');
    let type = $body.data('type');
    let page = $body.find('.el-body-section').data('page') - 1;
    UpdateSectionPage(type, page);
}

function PaginatorNext(event) {
    let $body = $(event.currentTarget).closest('.el-event-body');
    let type = $body.data('type');
    let page = $body.find('.el-body-section').data('page') + 1;
    UpdateSectionPage(type, page);
}

function SelectAll(event) {
    $(event.currentTarget).closest('.el-event-body').find('.el-mark-read input').prop('checked', true);
}

function SelectNone(event) {
    $(event.currentTarget).closest('.el-event-body').find('.el-mark-read input').prop('checked', false);
}

function SelectInvert(event) {
    $(event.currentTarget).closest('.el-event-body').find('.el-mark-read input').each((_, input) => {
        input.checked = !input.checked;
    });
}

function MarkSelected(event) {
    let $event_body = $(event.currentTarget).closest('.el-event-body');
    let selected_ids = [];
    let type = $event_body.data('type');
    if (type === 'comment') {
        $event_body.find('.post').each((_, entry) => {
            let $entry = $(entry);
            if ($entry.find('.el-mark-read input').prop('checked')) {
                let item_id = $entry.find('.comment').data('id');
                selected_ids.push(item_id);
            }
        });
        selected_ids.forEach((id) => {
            $event_body.find(`.comment[data-id="${id}"]`).closest('.post').detach();
        });
    } else {
        $event_body.find('tbody tr').each((_, row) => {
            let $row = $(row);
            if ($row.find('.el-mark-read input').prop('checked')) {
                let item_id = $row.data('id');
                selected_ids.push(item_id);
            }
        });
        selected_ids.forEach((id) => {
            $event_body.find(`tbody tr[data-id="${id}"]`).detach();
        });
    }
    if (selected_ids.length) {
        PruneSavedEvents(type, selected_ids);
        UpdateMarkReadLinks(type);
    } else {
        JSPLib.notice.notice(`No ${TYPEDICT[type].plural} selected!`);
    }
}

function MarkPage(event) {
    let $event_body = $(event.currentTarget).closest('.el-event-body');
    let type = $event_body.data('type');
    var selected_ids;
    if (type === 'comment') {
        selected_ids = JSPLib.utility.getDOMAttributes($event_body.find('.comment'), 'id', Number);
        $event_body.find('.post').detach();
    } else {
        selected_ids = JSPLib.utility.getDOMAttributes($event_body.find('tbody tr'), 'id', Number);
        $event_body.find('tbody tr').detach();
    }
    PruneSavedEvents(type, selected_ids);
    UpdateMarkReadLinks(type);
}

function MarkAll(event) {
    let $event_body = $(event.currentTarget).closest('.el-event-body');
    let type = $event_body.data('type');
    if (type === 'comment') {
        $event_body.find('.post').detach();
    } else {
        $event_body.find('tbody tr').detach();
    }
    $event_body.find('.el-paginator').detach();
    let events = GetEvents(type);
    let selected_ids = JSPLib.utility.getObjectAttributes(events, 'id');
    PruneSavedEvents(type, selected_ids);
    UpdateMarkReadLinks(type);
}

function SubscribeMultiLink(event) {
    let $menu = $(JSPLib.utility.getNthParent(event.target, 4));
    let $container = $(event.target.parentElement);
    let itemid = $menu.data('id');
    let eventtype = $menu.data('type');
    let typelist = $container.data('type').split(',');
    let subscribed = ($container.hasClass('el-subscribed') ? true : false);
    typelist.forEach((type) => {
        setTimeout(() => {
            if (eventtype === 'subscribe_events_enabled') {
                SetItemList_T(type, subscribed, itemid);
            } else if (eventtype === 'user_events_enabled') {
                SetUserList_T(type, subscribed, itemid);
            }
        }, NONSYNCHRONOUS_DELAY);
    });
    UpdateMultiLink(typelist, subscribed, itemid);
}

async function PostEventPopulateControl() {
    let post_events = JSPLib.menu.getCheckboxRadioSelected(`[data-setting="post_events"] [data-selector]`);
    let operation = JSPLib.menu.getCheckboxRadioSelected(`[data-setting="operation"] [data-selector]`);
    let search_query = $('#el-control-search-query').val();
    if (post_events.length === 0 || operation.length === 0) {
        JSPLib.notice.error("Must select at least one post event type!");
    } else if (search_query === "") {
        JSPLib.notice.error("Must have at least one search term!");
    } else {
        $('#el-search-query-display').show();
        let posts = await JSPLib.danbooru.getPostsCountdown(search_query, 100, ID_FIELD, '#el-search-query-counter');
        let postids = new Set(JSPLib.utility.getObjectAttributes(posts, 'id'));
        let post_changes = new Set();
        let was_subscribed, new_subscribed;
        post_events.forEach((eventtype) => {
            let typeset = GetItemList(eventtype);
            switch (operation[0]) {
                case 'add':
                    new_subscribed = JSPLib.utility.setDifference(postids, typeset);
                    was_subscribed = new Set();
                    post_changes = JSPLib.utility.setUnion(post_changes, new_subscribed);
                    typeset = JSPLib.utility.setUnion(typeset, postids);
                    break;
                case 'subtract':
                    new_subscribed = new Set();
                    was_subscribed = JSPLib.utility.setIntersection(postids, typeset);
                    post_changes = JSPLib.utility.setUnion(post_changes, was_subscribed);
                    typeset = JSPLib.utility.setDifference(typeset, postids);
                    break;
                case 'overwrite':
                default:
                    was_subscribed = JSPLib.utility.setDifference(typeset, postids);
                    new_subscribed = JSPLib.utility.setDifference(postids, typeset);
                    post_changes = JSPLib.utility.setUnion(post_changes, postids);
                    typeset = postids;
            }
            EL.subscribeset[eventtype] = typeset;
            setTimeout(() => {
                JSPLib.storage.setLocalData(`el-${eventtype}-item-list`, [...EL.subscribeset[eventtype]]);
            }, NONSYNCHRONOUS_DELAY);
            EL.channel.postMessage({type: 'reload', eventtype, was_subscribed, new_subscribed, eventset: EL.subscribeset[eventtype]});
        });
        $('#el-search-query-counter').html(0);
        JSPLib.notice.notice(`Subscriptions were changed by ${post_changes.size} posts!`);
    }
}

function OpenEventClick(type, $table, func) {
    $table.find(`.el-show-hide-links[data-type="${type}"] a`).off(PROGRAM_CLICK).on(PROGRAM_CLICK, (event) => {
        EL.openlist[type] ??= [];
        let $row = $(event.currentTarget).closest('tr');
        let item_id = $row.data('id');
        let is_open = $(event.currentTarget.parentElement).data('action') === 'show';
        if (is_open && !EL.openlist[type].includes(item_id)) {
            func(item_id, $row);
            EL.openlist[type].push(item_id);
        }
        let hide = (is_open ? 'show' : 'hide');
        let show = (is_open ? 'hide' : 'show');
        JSPLib.utility.fullHide(`.el-show-hide-links[data-type="${type}"][data-id="${item_id}"] [data-action="${hide}"]`);
        JSPLib.utility.clearHide(`.el-show-hide-links[data-type="${type}"][data-id="${item_id}"] [data-action="${show}"]`);
        if (is_open) {
            $(`.el-full-item[data-type="${type}"][data-id="${item_id}"]`).show();
        } else {
            $(`.el-full-item[data-type="${type}"][data-id="${item_id}"]`).hide();
        }
    });
}

function AdjustFloatingTHEAD(entries) {
    let $thead = $(entries[0].target);
    let $floating = $(entries[0].target).closest('.el-body-section').find('.el-floating-header');
    let width = getComputedStyle($thead.get(0)).width;
    console.log("THEAD width change:", $floating.css('width'), '->', width);
    $floating.css('width', width);
}

function AdjustFloatingTH(entries) {
    for (let i = 0; i < entries.length; i++) {
        let $th = $(entries[i].target);
        let index = $th.index();
        let $floating = $(entries[i].target).closest('.el-body-section').find('.el-floating-header').children().eq(index);
        let width = getComputedStyle($th.get(0)).width;
        console.log("TH width change:", $floating.css('width'), '->', width);
        $floating.css('width', width);
    }
}

//Check event functions

function CheckAllEventsReady() {
    if (!JSPLib.concurrency.reserveSemaphore(PROGRAM_SHORTCUT)) return;
    let printer = JSPLib.debug.getFunctionPrint('CheckAllEventsReady');
    let promise_array = [];
    POST_QUERY_EVENTS.forEach((type) => {
        if (EL.post_query_events_enabled.includes(type) && JSPLib.concurrency.checkTimeout(`el-${type}-post-query-event-timeout`, EL.timeout_expires)) {
            promise_array.push(CheckPostQueryType_T(type));
        } else {
            printer.debuglogLevel("Hard disable:", 'post-query', type, JSPLib.debug.DEBUG);
        }
    });
    SUBSCRIBE_EVENTS.forEach((type) => {
        if (EL.all_subscribe_events.includes(type) && JSPLib.concurrency.checkTimeout(`el-${type}-subscribe-event-timeout`, EL.timeout_expires)) {
            if ((EL.subscribe_events_enabled.includes(type) && (EL.show_creator_events || CheckItemList(type))) ||
                (EL.user_events_enabled.includes(type) && CheckUserList(type))) {
                promise_array.push(CheckSubscribeType_T(type));
            } else {
                printer.debuglogLevel("Soft disable:", 'subscribe', type, JSPLib.debug.DEBUG);
            }
        } else {
            printer.debuglogLevel("Hard disable:", 'subscribe', type, JSPLib.debug.DEBUG);
        }
    });
    OTHER_EVENTS.forEach((type) => {
        if (EL.other_events_enabled.includes(type) && JSPLib.concurrency.checkTimeout(`el-${type}-other-event-timeout`, EL.timeout_expires)) {
            promise_array.push(CheckOtherType_T(type));
        } else {
            printer.debuglogLevel("Hard disable:", 'other', type, JSPLib.debug.DEBUG);
        }
    });
    Promise.all(promise_array).then(() => {
        if (EL.new_events_found) {
            UpdateUserOnNewEvents();
        }
        JSPLib.concurrency.freeSemaphore(PROGRAM_SHORTCUT);
    });
}

function CheckType(type, source, no_limit, selector) {
    switch(source) {
        case 'subscribe':
            CheckSubscribeType(type, no_limit, selector);
            break;
        case 'post-query':
            CheckPostQueryType(type, no_limit, selector);
            break;
        case 'other':
            CheckOtherType(type, no_limit, selector);
            //falls through
        default:
            //do nothing
    }
}

async function CheckPostQueryType(type, no_limit = false, selector = null) {
    let printer = JSPLib.debug.getFunctionPrint('CheckPostQueryType');
    let last_id = JSPLib.storage.checkLocalData(`el-${type}-post-query-last-id`, {default_val: 0});
    if (last_id) {
        let type_addon = TYPEDICT[type].addons ?? {};
        let post_query = GetTypeQuery(type);
        let query_addon = {};
        //Check if the post query has any non-operator text
        if (post_query.replace(/[\s-*~]+/g, '').length > 0) {
            query_addon = TYPEDICT[type].custom_query?.(post_query) ?? {search: {post_tags_match: post_query}};
        }
        let url_addons = JSPLib.utility.mergeHashes(type_addon, query_addon, {only: TYPEDICT[type].only});
        let batches = (no_limit ? null : 1);
        let items = await JSPLib.danbooru.getAllItems(TYPEDICT[type].controller, QUERY_LIMIT, {url_addons, batches, page: last_id, reverse: true, domname: selector});
        SaveLastChecked(type, 'post-query');
        if (items.length) {
            let batch_limit = (!no_limit ? QUERY_LIMIT : Infinity);
            SaveOverflow(type, 'post-query', items, batch_limit);
            let updated_last_id = JSPLib.danbooru.getNextPageID(items, true);
            SaveLastID(type, 'post-query', updated_last_id);
            last_id = updated_last_id;
        }
        let found_events = TYPEDICT[type].find_events(items, 'post-query');
        if (found_events.length) {
            printer.debuglog(`Available ${TYPEDICT[type].plural}:`, found_events.length, last_id);
            SaveFoundEvents(type, 'post-query', found_events, items);
            UpdateHomeEvent(type);
            UpdateNavigation();
            if ($(`.el-event-header[data-type="${type}"]`).length === 0) {
                InstallEventSection(type);
            }
        } else {
            printer.debuglog(`No ${TYPEDICT[type].plural}`, last_id);
        }
        SaveEventRecheck(type, 'post-query');
        UpdateHomeSource(type, 'post-query');
    } else {
        SaveRecentDanbooruID_T(type, 'post-query');
    }
}

async function CheckSubscribeType(type, no_limit = false, selector = null) {
    let printer = JSPLib.debug.getFunctionPrint('CheckSubscribeType');
    let last_id = JSPLib.storage.checkLocalData(`el-${type}-subscribe-last-id`, {default_val: 0});
    if (last_id) {
        let subscribe_set = GetItemList(type);
        let user_set = GetUserList(type);
        let type_addon = TYPEDICT[type].addons ?? {};
        let only_attribs = TYPEDICT[type].only;
        if (EL.show_creator_events) {
            only_attribs += (TYPEDICT[type].includes ? ',' + TYPEDICT[type].includes : "");
        }
        let url_addons = JSPLib.utility.mergeHashes(type_addon, {only: only_attribs});
        let batches = (no_limit ? TYPEDICT[type].limit : null);
        let items = await JSPLib.danbooru.getAllItems(TYPEDICT[type].controller, QUERY_LIMIT, {url_addons, batches, page: last_id, reverse: true, domname: selector});
        if (EL.show_parent_events && type === 'post') {
            items = await AddParentInclude(items);
        }
        SaveLastChecked(type, 'subscribe');
        if (items.length) {
            let batch_limit = (!no_limit ? TYPEDICT[type].limit * QUERY_LIMIT : Infinity);
            SaveOverflow(type, 'subscribe', items, batch_limit);
            let updated_last_id = JSPLib.danbooru.getNextPageID(items, true);
            SaveLastID(type, 'subscribe', updated_last_id);
            last_id = updated_last_id;
        }
        let found_events = TYPEDICT[type].find_events(items, 'subscribe', subscribe_set, user_set);
        if (found_events.length) {
            printer.debuglog(`Available ${TYPEDICT[type].plural}:`, found_events.length, last_id);
            SaveFoundEvents(type, 'subscribe', found_events, items);
            UpdateHomeEvent(type);
            UpdateNavigation();
            if ($(`.el-event-header[data-type="${type}"]`).length === 0) {
                InstallEventSection(type);
            }
        } else {
            printer.debuglog(`No ${TYPEDICT[type].plural}`, last_id);
        }
        SaveEventRecheck(type, 'subscribe');
        UpdateHomeSource(type, 'subscribe');
    } else {
        SaveRecentDanbooruID_T(type, 'subscribe');
    }
}

async function CheckOtherType(type, no_limit = false, selector = null) {
    let printer = JSPLib.debug.getFunctionPrint('CheckOtherType');
    let last_id = JSPLib.storage.checkLocalData(`el-${type}-other-last-id`, {default_val: 0});
    if (last_id) {
        let type_addon = TYPEDICT[type].addons ?? {};
        let url_addons = JSPLib.utility.mergeHashes(type_addon, {only: TYPEDICT[type].only});
        let batches = (no_limit ? null : 1);
        let items = await JSPLib.danbooru.getAllItems(TYPEDICT[type].controller, QUERY_LIMIT, {url_addons, batches, page: last_id, reverse: true, domname: selector});
        SaveLastChecked(type, 'other');
        if (items.length) {
            let batch_limit = (!no_limit ? QUERY_LIMIT : Infinity);
            SaveOverflow(type, 'other', items, batch_limit);
            let updated_last_id = JSPLib.danbooru.getNextPageID(items, true);
            SaveLastID(type, 'other', updated_last_id);
            last_id = updated_last_id;
        }
        let found_events = TYPEDICT[type].find_events(items, 'other');
        if (found_events.length) {
            printer.debuglog(`Available ${TYPEDICT[type].plural}:`, found_events.length, last_id);
            SaveFoundEvents(type, 'other', found_events, items);
            UpdateHomeEvent(type);
            UpdateNavigation();
            if ($(`.el-event-header[data-type="${type}"]`).length === 0) {
                InstallEventSection(type);
            }
        } else {
            printer.debuglog(`No ${TYPEDICT[type].plural}`, last_id);
        }
        SaveEventRecheck(type, 'other');
        UpdateHomeSource(type, 'other');
    } else {
        SaveRecentDanbooruID_T(type, 'other');
    }
}

//Settings functions

function BroadcastEL(ev) {
    let printer = JSPLib.debug.getFunctionPrint('BroadcastEL');
    var menuid;
    printer.debuglog(`(${ev.data.type}):`, ev.data);
    switch (ev.data.type) {
        case 'subscribe':
            EL.subscribeset[ev.data.eventtype] = ev.data.eventset;
            UpdateMultiLink([ev.data.eventtype], ev.data.was_subscribed, ev.data.itemid);
            break;
        case 'subscribe_user':
            EL.userset[ev.data.eventtype] = ev.data.eventset;
            UpdateMultiLink([ev.data.eventtype], ev.data.was_subscribed, ev.data.userid);
            break;
        case 'update_navigation':
            UpdateNavigation(false);
            break;
        case 'update_event':
            UpdateHomeEvent(ev.data.event_type, false);
            break;
        case 'update_source':
            UpdateHomeSource(ev.data.event_type, ev.data.event_source, false);
            break;
        case 'new_events':
            UpdateUserOnNewEvents(false);
            break;
        case 'reload':
            EL.subscribeset[ev.data.eventtype] = ev.data.eventset;
            menuid = $('#el-subscribe-events').data('id');
            if (ev.data.was_subscribed.has(menuid)) {
                UpdateMultiLink([ev.data.eventtype], true, menuid);
            } else if (ev.data.new_subscribed.has(menuid)) {
                UpdateMultiLink([ev.data.eventtype], false, menuid);
            }
            //falls through
        default:
            //do nothing
    }
}

function CleanupTasks() {
    let disabled_events = JSPLib.utility.arrayDifference(POST_QUERY_EVENTS, EL.post_query_events_enabled);
    disabled_events.forEach((type) => {
        JSPLib.storage.removeLocalData(`el-${type}-post-query-last-id`);
    });
    disabled_events = JSPLib.utility.arrayDifference(ALL_SUBSCRIBES, EL.all_subscribe_events);
    EL.subscribe_events_enabled.forEach((inputtype) => {
        if (!EL.show_creator_events && !CheckItemList(inputtype) && !CheckUserList(inputtype)) {
            disabled_events.push(inputtype);
        }
    });
    disabled_events.forEach((type) => {
        JSPLib.storage.removeLocalData(`el-${type}-subscribe-last-id`);
    });
    disabled_events = JSPLib.utility.arrayDifference(OTHER_EVENTS, EL.other_events_enabled);
    disabled_events.forEach((type) => {
        JSPLib.storage.removeLocalData(`el-${type}-other-last-id`);
    });
}

function InitializeChangedSettings() {
    if (EL.user_settings.flag_query === "###INITIALIZE###" || EL.user_settings.appeal_query === "###INITIALIZE###") {
        EL.user_settings.flag_query = EL.user_settings.appeal_query = 'user:' + EL.username;
        JSPLib.menu.updateUserSettings();
        JSPLib.storage.setLocalData('el-user-settings', EL.user_settings);
    }
}

function InitializeAllSubscribes() {
    EL.all_subscribe_events = JSPLib.utility.arrayUnion(EL.subscribe_events_enabled, EL.user_events_enabled);
}

function LocalResetCallback() {
    InitializeChangedSettings();
}

function RemoteSettingsCallback() {
    JSPLib.utility.fullHide('#el-event-notice, #el-subscribe-events');
}

function RemoteResetCallback() {
    JSPLib.utility.fullHide('#el-event-notice, #el-subscribe-events');
}

function GetRecheckExpires() {
    return EL.recheck_interval * JSPLib.utility.one_minute;
}

function GetRecheckJitter() {
    // 25% swing, with a minimum of one minute, and maximum of 10 minutes
    return JSPLib.utility.clamp(EL.recheck_interval * JSPLib.utility.one_minute * 0.25, JSPLib.utility.one_minute, JSPLib.utility.one_minute * 10);
}

function GetPostFilterTags() {
    return new Set(EL.filter_post_edits.trim().split(/\s+/));
}

function RebindMenuAutocomplete() {
    JSPLib.utility.recheckTimer({
        check: () => JSPLib.utility.hasDOMDataKey('#user_blacklisted_tags, #user_favorite_tags', 'uiAutocomplete'),
        exec: () => {
            $('#user_blacklisted_tags, #user_favorite_tags').autocomplete('destroy').off('keydown.Autocomplete.tab');
            $('#el-control-search-query, #el-setting-filter-post-edits, ' + JSPLib.utility.joinList(POST_QUERY_EVENTS, '#el-setting-', '-query', ',')).attr('data-autocomplete', 'tag-query');
            setTimeout(Danbooru.Autocomplete.initialize_tag_autocomplete, JQUERY_DELAY);
        }
    }, TIMER_POLL_INTERVAL);
}

function MigrateLocalData() {
    let migrated = JSPLib.storage.getLocalData('el-migration-25.0', {default_val: false});
    if (migrated) return;
    console.log('migrating data');
    EL.all_subscribe_events.forEach((type) => {
        let last_id = JSPLib.storage.getLocalData(`el-${type}lastid`);
        if (last_id) {
            JSPLib.storage.setLocalData(`el-${type}-subscribe-last-id`, last_id);
            JSPLib.storage.removeLocalData(`el-${type}lastid`);
        }
    });
    EL.post_query_events_enabled.forEach((type) => {
        let last_id = JSPLib.storage.getLocalData(`el-pq-${type}lastid`);
        if (last_id) {
            JSPLib.storage.setLocalData(`el-${type}-post-query-last-id`, last_id);
            JSPLib.storage.removeLocalData(`el-pq-${type}lastid`);
        }
    });
    EL.other_events_enabled.forEach((type) => {
        let last_id = JSPLib.storage.getLocalData(`el-ot-${type}lastid`);
        if (last_id) {
            JSPLib.storage.setLocalData(`el-${type}-other-last-id`, last_id);
            JSPLib.storage.removeLocalData(`el-ot-${type}lastid`);
        }
    });
    SUBSCRIBE_EVENTS.forEach((type) => {
        let item_list = JSPLib.storage.getLocalData(`el-${type}list`);
        if (item_list) {
            JSPLib.storage.setLocalData(`el-${type}-item-list`, item_list);
            JSPLib.storage.removeLocalData(`el-${type}list`);
        }
        JSPLib.storage.removeLocalData(`el-${type}overflow`);
    });
    USER_EVENTS.forEach((type) => {
        let user_list = JSPLib.storage.getLocalData(`el-us-${type}list`);
        if (user_list) {
            JSPLib.storage.setLocalData(`el-${type}-user-list`, user_list);
            JSPLib.storage.removeLocalData(`el-us-${type}list`);
        }
    });
    JSPLib.storage.removeData('el-saved-timeout');
    JSPLib.storage.removeData('el-event-timeout');
    JSPLib.storage.removeData('el-overflow');
    JSPLib.storage.removeData('el-last-seen');
    JSPLib.storage.setLocalData('el-migration-25.0', true);
}

function InitializeProgramValues() {
    let printer = JSPLib.debug.getFunctionPrint('InitializeProgramValues');
    Object.assign(EL, {
        username: Danbooru.CurrentUser.data('name'),
        userid: Danbooru.CurrentUser.data('id'),
    });
    if (EL.username === 'Anonymous') {
        printer.debuglog("User must log in!");
        return false;
    }
    if (!JSPLib.utility.isString(EL.username) || !JSPLib.validate.validateID(EL.userid)) {
        printer.debuglog("Invalid meta variables!");
        return false;
    }
    Object.assign(EL, {
        dmail_notice: $('#dmail-notice'),
        dmail_promise: JSPLib.utility.createPromise(),
    });
    //Only used on new installs
    InitializeChangedSettings();
    InitializeAllSubscribes();
    Object.assign(EL, {
        timeout_expires: GetRecheckExpires(),
        timeout_jitter: GetRecheckJitter(),
        locked_notice: EL.autolock_notices,
        post_filter_tags: GetPostFilterTags(),
        recheck: JSPLib.concurrency.checkTimeout('el-event-timeout', EL.timeout_expires),
        thead_observer: new ResizeObserver(AdjustFloatingTHEAD),
        th_observer: new ResizeObserver(AdjustFloatingTH),
        get not_snoozed () {
            return EL.recheck || (EL.hide_dmail_notice && Boolean(this.dmail_notice.length));
        },
        get hide_dmail_notice () {
            return EL.autoclose_dmail_notice && IsEventEnabled('dmail', 'other_events_enabled');
        },
    });
    return true;
}

function RenderSettingsMenu() {
    $('#event-listener').append(JSPLib.menu.renderMenuFramework(MENU_CONFIG));
    $('#el-general-settings').append(JSPLib.menu.renderDomainSelectors());
    $('#el-notice-settings').append(JSPLib.menu.renderCheckbox('autolock_notices'));
    $('#el-notice-settings').append(JSPLib.menu.renderCheckbox('mark_read_dmail'));
    $('#el-notice-settings').append(JSPLib.menu.renderCheckbox('mark_read_topics'));
    $('#el-notice-settings').append(JSPLib.menu.renderCheckbox('autoclose_dmail_notice'));
    $('#el-notice-settings').append(JSPLib.menu.renderCheckbox('overflow_only_notice_enabled'));
    $('#el-filter-settings').append(JSPLib.menu.renderCheckbox('filter_user_events'));
    $('#el-filter-settings').append(JSPLib.menu.renderCheckbox('filter_untranslated_commentary'));
    $('#el-filter-settings').append(JSPLib.menu.renderCheckbox('filter_autofeedback'));
    $('#el-filter-settings').append(JSPLib.menu.renderCheckbox('filter_BUR_edits'));
    $('#el-filter-settings').append(JSPLib.menu.renderCheckbox('filter_autobans'));
    $('#el-filter-settings').append(JSPLib.menu.renderTextinput('filter_post_edits', 80));
    $('#el-filter-settings').append(JSPLib.menu.renderTextinput('filter_users', 80));
    $('#el-post-query-event-settings-message').append(JSPLib.menu.renderExpandable("Additional setting details", POST_QUERY_EVENT_SETTINGS_DETAILS));
    $('#el-post-query-event-settings').append(JSPLib.menu.renderInputSelectors('post_query_events_enabled', 'checkbox'));
    $('#el-post-query-event-settings').append(JSPLib.menu.renderTextinput('comment_query', 80));
    $('#el-post-query-event-settings').append(JSPLib.menu.renderTextinput('note_query', 80));
    $('#el-post-query-event-settings').append(JSPLib.menu.renderTextinput('commentary_query', 80));
    $('#el-post-query-event-settings').append(JSPLib.menu.renderTextinput('post_query', 80));
    $('#el-post-query-event-settings').append(JSPLib.menu.renderTextinput('approval_query', 80));
    $('#el-post-query-event-settings').append(JSPLib.menu.renderTextinput('flag_query', 80));
    $('#el-post-query-event-settings').append(JSPLib.menu.renderTextinput('appeal_query', 80));
    $('#el-subscribe-event-settings-message').append(JSPLib.menu.renderExpandable("Additional setting details", SUBSCRIBE_EVENT_SETTINGS_DETAILS));
    $('#el-subscribe-event-settings').append(JSPLib.menu.renderInputSelectors('subscribe_events_enabled', 'checkbox'));
    $('#el-subscribe-event-settings').append(JSPLib.menu.renderCheckbox('show_creator_events'));
    $('#el-subscribe-event-settings').append(JSPLib.menu.renderCheckbox('show_parent_events'));
    $('#el-user-event-settings').append(JSPLib.menu.renderInputSelectors('user_events_enabled', 'checkbox'));
    $('#el-other-event-settings-message').append(JSPLib.menu.renderExpandable("Event exceptions", OTHER_EVENT_SETTINGS_DETAILS));
    $('#el-other-event-settings').append(JSPLib.menu.renderInputSelectors('other_events_enabled', 'checkbox'));
    $('#el-other-event-settings').append(JSPLib.menu.renderInputSelectors('subscribed_mod_actions', 'checkbox'));
    $('#el-network-settings').append(JSPLib.menu.renderTextinput('recheck_interval', 10));
    $('#el-subscribe-controls-message').append(SUBSCRIBE_CONTROLS_DETAILS);
    $('#el-subscribe-controls').append(JSPLib.menu.renderInputSelectors('post_events', 'checkbox', true));
    $('#el-subscribe-controls').append(JSPLib.menu.renderInputSelectors('operation', 'radio', true));
    $('#el-subscribe-controls').append(JSPLib.menu.renderTextinput('search_query', 50, true));
    $('#el-subscribe-controls').append(DISPLAY_COUNTER);
    $('#el-controls').append(JSPLib.menu.renderCacheControls());
    $('#el-cache-controls').append(JSPLib.menu.renderLinkclick('cache_info'));
    $('#el-cache-controls').append(JSPLib.menu.renderCacheInfoTable());
    $('#el-controls').append(JSPLib.menu.renderCacheEditor());
    $('#el-cache-editor-message').append(JSPLib.menu.renderExpandable("Program Data details", PROGRAM_DATA_DETAILS));
    $('#el-cache-editor-controls').append(JSPLib.menu.renderLocalStorageSource());
    $("#el-cache-editor-controls").append(JSPLib.menu.renderCheckbox('raw_data', true));
    $('#el-cache-editor-controls').append(JSPLib.menu.renderTextinput('data_name', 20, true));
    JSPLib.menu.engageUI(true);
    JSPLib.menu.saveUserSettingsClick();
    JSPLib.menu.resetUserSettingsClick(LOCALSTORAGE_KEYS, LocalResetCallback);
    $('#el-search-query-get').on(PROGRAM_CLICK, PostEventPopulateControl_T);
    JSPLib.menu.cacheInfoClick();
    JSPLib.menu.expandableClick();
    JSPLib.menu.rawDataChange();
    JSPLib.menu.getCacheClick(ValidateProgramData);
    JSPLib.menu.saveCacheClick(ValidateProgramData);
    JSPLib.menu.deleteCacheClick();
    JSPLib.menu.listCacheClick();
    JSPLib.menu.refreshCacheClick();
    JSPLib.menu.cacheAutocomplete();
    RebindMenuAutocomplete();
}

//Main program

function Main() {
    const preload = {
        run_on_settings: true,
        default_data: DEFAULT_VALUES,
        initialize_func: InitializeProgramValues,
        broadcast_func: BroadcastEL,
        render_menu_func: RenderSettingsMenu_T,
        program_css: PROGRAM_CSS,
        menu_css: MENU_CSS,
    };
    if (!JSPLib.menu.preloadScript(EL, preload)) return;
    JSPLib.notice.installBanner(PROGRAM_SHORTCUT);
    MigrateLocalData();
    CheckAllEventsReady();
    InstallSubscribeLinks();
    InstallEventsNavigation();
    JSPLib.load.noncriticalTasks(CleanupTasks);
}

/****Function decoration****/

const [
    RenderSettingsMenu_T, SetItemList_T, SetUserList_T,
    PostEventPopulateControl_T,
    CheckPostQueryType_T, CheckSubscribeType_T, CheckOtherType_T, SaveRecentDanbooruID_T,
] = JSPLib.debug.addFunctionTimers([
    //Sync
    RenderSettingsMenu,
    [SetItemList, 0],
    [SetUserList, 0],
    //Async
    PostEventPopulateControl,
    [CheckPostQueryType, 0],
    [CheckSubscribeType, 0],
    [CheckOtherType, 0],
    [SaveRecentDanbooruID, 0, 1]
]);

/****Initialization****/

//Variables for debug.js
JSPLib.debug.debug_console = true;
JSPLib.debug.level = JSPLib.debug.INFO;
JSPLib.debug.program_shortcut = PROGRAM_SHORTCUT;

//Variables for menu.js
JSPLib.menu.program_shortcut = PROGRAM_SHORTCUT;
JSPLib.menu.program_name = PROGRAM_NAME;
JSPLib.menu.program_data = EL;
JSPLib.menu.settings_callback = RemoteSettingsCallback;
JSPLib.menu.reset_callback = RemoteResetCallback;
JSPLib.menu.settings_config = SETTINGS_CONFIG;
JSPLib.menu.control_config = CONTROL_CONFIG;

//Export JSPLib
JSPLib.load.exportData(PROGRAM_NAME, EL, {other_data: ALL_EVENTS});
JSPLib.load.exportFuncs(PROGRAM_NAME, {debuglist: [GetItemList, SetItemList, GetEvents]});

//Variables for storage.js
JSPLib.storage.localSessionValidator = ValidateProgramData;

/****Execution start****/

JSPLib.load.programInitialize(Main, {program_name: PROGRAM_NAME, required_variables: PROGRAM_LOAD_REQUIRED_VARIABLES, required_selectors: PROGRAM_LOAD_REQUIRED_SELECTORS});
