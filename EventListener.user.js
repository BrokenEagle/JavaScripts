// ==UserScript==
// @name         EventListener
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      24.2
// @description  Informs users of new events (flags,appeals,dmails,comments,forums,notes,commentaries,post edits,wikis,pools,bans,feedbacks,mod actions)
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @exclude      /^https?://\w+\.donmai\.us/.*\.(xml|json|atom)(\?|$)/
// @grant        none
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/EventListener.user.js
// @updateURL    https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/EventListener.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.4.4/lz-string.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/module.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/notice.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/concurrency.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/menu.js
// ==/UserScript==

/* global JSPLib $ Danbooru LZString */

/****Global variables****/

//Library constants

////NONE

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
const LASTID_KEYS = JSPLib.utility.multiConcat(
    POST_QUERY_EVENTS.map((type) => `el-pq-${type}lastid`),
    SUBSCRIBE_EVENTS.map((type) => `el-${type}lastid`),
    OTHER_EVENTS.map((type) => `el-ot-${type}lastid`),
);
const SAVED_KEYS = JSPLib.utility.multiConcat(
    POST_QUERY_EVENTS.map((type) => [`el-pq-saved${type}lastid`, `el-pq-saved${type}list`]),
    SUBSCRIBE_EVENTS.map((type) => [`el-saved${type}lastid`, `el-saved${type}list`]),
    OTHER_EVENTS.map((type) => [`el-ot-saved${type}lastid`, `el-ot-saved${type}list`]),
).flat();
const SUBSCRIBE_KEYS = SUBSCRIBE_EVENTS.map((type) => ([`el-${type}list`, `el-${type}overflow`])).flat();
const LOCALSTORAGE_KEYS = JSPLib.utility.multiConcat(LASTID_KEYS, SAVED_KEYS, SUBSCRIBE_KEYS, [
    'el-overflow',
    'el-last-seen',
    'el-saved-notice',
]);

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
        hint: "Show subscribe events regardless of subscribe status when creator is the user."
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
        validate: JSPLib.validate.isString,
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
        reset: 5,
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
        validate: JSPLib.validate.isString,
        hint: 'Enter a post search query to check.'
    },
    appeal_query: {
        reset: "###INITIALIZE###",
        parse: String,
        validate: JSPLib.validate.isString,
        hint: 'Enter a post search query to check.'
    },
    comment_query: {
        reset: "",
        parse: String,
        validate: JSPLib.validate.isString,
        hint: 'Enter a post search query to check.'
    },
    note_query: {
        reset: "",
        parse: String,
        validate: JSPLib.validate.isString,
        hint: 'Enter a post search query to check.'
    },
    commentary_query: {
        reset: "",
        parse: String,
        validate: JSPLib.validate.isString,
        hint: 'Enter a post search query to check.'
    },
    approval_query: {
        reset: "",
        parse: String,
        validate: JSPLib.validate.isString,
        hint: 'Enter a post search query to check.'
    },
    post_query: {
        display: "Edit query",
        reset: "",
        parse: String,
        validate: JSPLib.validate.isString,
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
    marked_topic: [],
    item_overflow: false,
    no_limit: false,
    events_checked: false,
    post_ids: new Set(),
    thumbs: {},
};

//CSS Constants

const PROGRAM_CSS = `
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
    color: mediumseagreen;
}
#el-subscribe-events .el-subscribed a:hover,
#subnav-unsubscribe-link:hover {
    filter: brightness(1.5);
}
#el-subscribe-events .el-unsubscribed a,
#subnav-subscribe-link {
    color: darkorange;
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
}`;

const POST_CSS = `
#el-event-notice #el-post-section #el-post-table .col-expand {
    width: unset;
}`;

const COMMENT_CSS = `
#el-event-notice #el-comment-section #el-comment-table article.post-preview,
#el-event-notice #el-commentary-section #el-commentary-table article.post-preview {
    display: flex !important;
    flex-direction: row;
    margin-bottom: 1em;
    border-bottom: 1px solid var(--dtext-blockquote-border-color);
    min-height: 14em;
}
#el-event-notice #el-comment-section #el-comment-table .preview {
    flex-direction: column;
    display: flex;
    width: 154px;
    height: 170px;
    text-align: center;
    margin-right: 0;
}
#el-event-notice #el-comment-section #el-comment-table .comment {
    padding: 1em;
    margin-top: 0;
    word-wrap: break-word;
    display: flex;
}`;

const FORUM_CSS = `
#el-event-notice #el-forum-section #el-forum-table .author {
    padding: 1em 1em 0 1em;
    width: 12em;
    float: left;
}
#el-event-notice #el-forum-section #el-forum-table .content {
    padding: 1em;
    margin-left: 14em;
}`;

const WIKI_CSS = `
#el-event-notice #el-wiki-section li.added,
#el-event-notice #el-wiki-section ins {
    background: #cfc;
    text-decoration: none;
}
#el-event-notice #el-wiki-section li.removed,
#el-event-notice #el-wiki-section del {
    background: #fcc;
    text-decoration: none;
}
.el-paragraph-mark {
    opacity: 0.25;
}`;

const POOL_CSS = `
#el-event-notice #el-pool-section .el-full-item[data-type="pooldiff"] {
    overflow-x: auto;
    max-width: 90vw;
}
#el-event-notice #el-pool-section .el-full-item[data-type="pooldiff"] ins {
    background: #cfc;
    text-decoration: none;
}
#el-event-notice #el-pool-section .el-full-item[data-type="pooldiff"] del {
    background: #fcc;
    text-decoration: none;
}
#el-event-notice #el-pool-section .el-full-item[data-type="poolposts"] .el-add-pool-posts {
    display: flex;
    flex-wrap: wrap;
    background-color: rgba(0, 255, 0, 0.2);
}
#el-event-notice #el-pool-section .el-full-item[data-type="poolposts"] .el-rem-pool-posts {
    display: flex;
    background-color: rgba(255, 0, 0, 0.2);
}
#el-event-notice #el-pool-section .el-full-item[data-type="poolposts"] .post-preview {
    margin: 5px;
    padding: 5px;
    border: 1px solid var(--dtext-blockquote-border-color);
}
#el-event-notice #el-pool-section .el-full-item[data-type="poolposts"] .post-preview-150 {
    width: 155px;
    height: 175px;
}
#el-event-notice #el-pool-section .el-full-item[data-type="poolposts"] .post-preview-180 {
    width: 185px;
    height: 205px;
}
#el-event-notice #el-pool-section .el-full-item[data-type="poolposts"] .post-preview-225 {
    width: 230px;
    height: 250px;
}
#el-event-notice #el-pool-section .el-full-item[data-type="poolposts"] .post-preview-270 {
    width: 275px;
    height: 300px;
}
#el-event-notice #el-pool-section .el-full-item[data-type="poolposts"] .post-preview-360 {
    width: 365px;
    height: 390px;
}
.el-paragraph-mark {
    opacity: 0.25;
}`;

const DMAIL_CSS = `
tr.el-unread {
    font-weight: bold;
}
tr.el-deleted,
tr.el-deleted a {
    text-decoration: line-through;
}`;

const FEEDBACK_CSS = `
#el-event-notice #el-feedback-section .feedback-category-positive {
    background: var(--success-background-color);
}
#el-event-notice #el-feedback-section .feedback-category-negative {
    background: var(--error-background-color);
}
#el-event-notice #el-feedback-section .feedback-category-neutral {
    background: unset;
}`;

const BAN_CSS = `
#el-event-notice #el-ban-section tr[data-expired=true] {
    background-color: var(--success-background-color);
}
#el-event-notice #el-ban-section tr[data-expired=false] {
    background-color: var(--error-background-color);
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

const NOTICE_BOX = `
<div id="el-event-notice" style="display:none" class="notice notice-info">
    <div id="el-absent-section" style="display:none"></div>
    <div id="el-dmail-section" style="display:none"></div>
    <div id="el-flag-section" style="display:none"></div>
    <div id="el-appeal-section" style="display:none"></div>
    <div id="el-forum-section" style="display:none"></div>
    <div id="el-comment-section" style="display:none" class="comments-for-post"></div>
    <div id="el-note-section" style="display:none"></div>
    <div id="el-commentary-section" style="display:none"></div>
    <div id="el-wiki-section" style="display:none"></div>
    <div id="el-artist-section" style="display:none"></div>
    <div id="el-pool-section" style="display:none"></div>
    <div id="el-approval-section" style="display:none"></div>
    <div id="el-post-section" style="display:none"></div>
    <div id="el-feedback-section" style="display:none"></div>
    <div id="el-ban-section" style="display:none"></div>
    <div id="el-mod-action-section" style="display:none"></div>
    <div id="el-loading-message" style="display:none"><b>Loading...</b></div>
    <div id="el-event-controls" style="display:none">
        <a href="javascript:void(0)" id="el-hide-event-notice">Close this</a>
        [
        <a href="javascript:void(0)" id="el-lock-event-notice" title="Keep notice from being closed by other tabs.">LOCK</a>
        |
        <a href="javascript:void(0)" id="el-read-event-notice" title="Mark all items as read.">READ</a>
        |
        <a href="javascript:void(0)" id="el-reload-event-notice" title="Reload events when the server errors.">RELOAD</a>
        |
        <a href="javascript:void(0)" id="el-snooze-event-notice" title="Hides notices for 1 hour or 2x recheck interval, whichever is greater.">SNOOZE</a>
        ]
    </div>
</div>`;

const DISPLAY_COUNTER = `
<div id="el-search-query-display" style="display:none">
    Pages left: <span id="el-search-query-counter">...</span>
</div>`;

const SECTION_NOTICE = `
<div class="el-found-notice" data-type="%TYPE%" style="display:none">
    <h1>You've got %PLURAL%!</h1>
    <div id="el-%TYPE%-table"></div>
</div>
<div class="el-missing-notice" style="display:none">
    <h2>No %PLURAL% found!</h2>
</div>
<div class="el-overflow-notice" data-type="%TYPE%" style="display:none">
    <b>Check %PLURAL% controls:</b>
    <a data-type="more" href="javascript:void(0)">CHECK MORE</a>
    |
    <a data-type="all" href="javascript:void(0)">CHECK ALL</a>
    |
    <a data-type="skip" href="javascript:void(0)">SKIP</a>
    ( <span class="el-%TYPE%-counter">...</span> )
</div>
<div class="el-error-notice" style="display:none">
    <h2>Error getting %PLURAL%!</h2>
    <div class="el-error-message">Refresh page to try again.</div>
</div>
<div class="el-horizontal-rule"></div>`;

const ABSENT_NOTICE = `
<p>You have been gone for <b><span id="el-days-absent"></span></b> days.
<p>This can cause delays and multiple page refreshes for the script to finish processing all updates.</p>
<p>To process them all now, click the "<b>Update</b>" link below, or click "<b>Close this</b>" to process them normally.</p>
<p style="font-size:125%"><b><a id="el-update-all" href="javascript:void(0)">Update</a> (<span id="el-activity-indicator">...</span>)</b></p>`;

const EXCESSIVE_NOTICE = `
<hr>
<p><b><span style="color:red;font-size:150%">WARNING!</span> You have been gone longer than a month.</b></p>
<p>Consider resetting the event positions to their most recent values instead by clicking "<b>Reset</b>".
<p style="font-size:125%"><b><a id="el-reset-all" href="javascript:void(0)">Reset</a></b></p>`;

const DISMISS_NOTICE = `
<div id="el-dismiss-notice"><button type="button" class="ui-button ui-corner-all ui-widget">Dismiss</button></div>`;

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
    <li>Type data: <code>TYPE</code> is a placeholder for all available event types. <code>OP</code> is a placeholder for the type of operation (pq = post query, ot = other, subscribe has neither a designator nor the dash afterwards).
        <ul>
            <li><b>TYPElist:</b> The list of all posts/topic IDs that are subscribed.</li>
            <li><b>OP-TYPElastid:</b> Bookmark for the ID of the last seen event. This is where the script starts searching when it does a recheck.</li>
            <li><b>OP-savedTYPElist:</b> Used to temporarily store found values for the event notice when events are found.</li>
            <li><b>OP-savedTYPElastid:</b> Used to temporarily store found values for the event notice when events are found.</li>
            <li><b>TYPEoverflow:</b> Did this event reach the query limit last page load? Absence of this key indicates false. This controls whether or not and event will process at the next page refresh.</li>
        </ul>
    </li>
</ul>
<p><b>Note:</b> The raw format of all data keys begins with "el-". which is unused by the cache editor controls.</p>`;

//Time constants

const TIMER_POLL_INTERVAL = 100; //Polling interval for checking program status
const JQUERY_DELAY = 1; //For jQuery updates that should not be done synchronously
const NONSYNCHRONOUS_DELAY = 1; //For operations too costly in events to do synchronously
const MAX_ABSENCE = 30.0; //# of days before reset links get shown
const MAX_SNOOZE_DURATION = JSPLib.utility.one_hour;

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
        only: 'id,creator_id,post_id',
        filter: FilterData,
        insert: InsertEvents,
        plural: 'flags',
        display: "Flags",
        includes: 'post[uploader_id]',
        useritem: false,
        multiinsert: true,
    },
    appeal: {
        controller: 'post_appeals',
        user: 'creator_id',
        creator: ['post', 'uploader_id'],
        item: 'post_id',
        only: 'id,creator_id,post_id',
        filter: FilterData,
        insert: InsertEvents,
        plural: 'appeals',
        display: "Appeals",
        includes: 'post[uploader_id]',
        useritem: false,
        multiinsert: true,
    },
    dmail: {
        controller: 'dmails',
        addons: {search: {is_deleted: false}},
        only: 'id,from_id',
        user: 'from_id',
        filter: FilterData,
        other_filter: (val) => (!val.is_read),
        insert: InsertDmails,
        plural: 'mail',
        useritem: true,
        open: () => {OpenItemClick('dmail', AddDmail);},
        process: () => {
            $(document).on(PROGRAM_CLICK, '.el-dmail-read', MarkDmailRead);
            $(document).on(PROGRAM_CLICK, '.el-dmail-unread', MarkDmailUnread);
            $(document).on(PROGRAM_CLICK, '.el-dmail-delete', MarkDmailDeleted);
            $(document).on(PROGRAM_CLICK, '.el-dmail-undelete', MarkDmailUndeleted);
            JSPLib.utility.setCSSStyle(DMAIL_CSS, 'dmail');
        },
    },
    comment: {
        controller: 'comments',
        addons: {group_by: 'comment', search: {is_deleted: false}},
        user: 'creator_id',
        creator: ['post', 'uploader_id'],
        item: 'post_id',
        only: 'id,creator_id,post_id',
        limit: 10,
        filter: FilterData,
        insert: InsertComments,
        process: () => {JSPLib.utility.setCSSStyle(COMMENT_CSS, 'comment');},
        plural: 'comments',
        display: "Comments",
        includes: 'post[uploader_id]',
        useritem: false,
    },
    forum: {
        controller: 'forum_posts',
        user: 'creator_id',
        creator: ['topic', 'creator_id'],
        item: 'topic_id',
        only: 'id,creator_id,topic_id',
        limit: 10,
        filter: FilterData,
        insert: InsertForums,
        process: () => {JSPLib.utility.setCSSStyle(FORUM_CSS, 'forum');},
        plural: 'forums',
        display: "Forums",
        includes: 'topic[creator_id]',
        useritem: false,
        open: () => {OpenItemClick('forum', AddForumPost);},
    },
    note: {
        controller: 'note_versions',
        user: 'updater_id',
        creator: ['post', 'uploader_id'],
        item: 'post_id',
        only: 'id,updater_id,post_id',
        limit: 10,
        filter: FilterData,
        insert: InsertNotes,
        plural: 'notes',
        display: "Notes",
        includes: 'post[uploader_id]',
        useritem: false,
        open: () => {OpenItemClick('note', AddRenderedNote, AdjustRowspan);},
    },
    commentary: {
        controller: 'artist_commentary_versions',
        user: 'updater_id',
        creator: ['post', 'uploader_id'],
        item: 'post_id',
        only: 'id,updater_id,post_id,translated_title,translated_description',
        limit: 10,
        filter: FilterData,
        other_filter: IsShownCommentary,
        insert: InsertEvents,
        plural: 'commentaries',
        display: "Artist commentary",
        includes: 'post[uploader_id]',
        useritem: false,
        multiinsert: true,
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
        only: 'id,updater_id,post_id,added_tags,removed_tags',
        limit: 2,
        filter: FilterData,
        other_filter: IsShownPostEdit,
        insert: InsertPosts,
        process: () => {JSPLib.utility.setCSSStyle(POST_CSS, 'post');},
        plural: 'edits',
        display: "Edits",
        includes: 'post[uploader_id]',
        useritem: false,
        customquery: PostCustomQuery,
    },
    approval: {
        controller: 'post_approvals',
        user: 'user_id',
        creator: ['post', 'uploader_id'],
        item: 'post_id',
        only: 'id,user_id,post_id',
        limit: 10,
        filter: FilterData,
        insert: InsertEvents,
        plural: 'approvals',
        display: "Approval",
        includes: 'post[uploader_id]',
        useritem: false,
        multiinsert: true,
    },
    wiki: {
        controller: 'wiki_page_versions',
        user: 'updater_id',
        item: 'wiki_page_id',
        only: 'id,updater_id,wiki_page_id',
        limit: 10,
        filter: FilterData,
        insert: InsertWikis,
        process: () => {JSPLib.utility.setCSSStyle(WIKI_CSS, 'wiki');},
        plural: 'wikis',
        display: "Wikis",
        useritem: false,
        open: () => {OpenItemClick('wiki', AddWiki);},
    },
    artist: {
        controller: 'artist_versions',
        user: 'updater_id',
        item: 'artist_id',
        only: 'id,updater_id,artist_id',
        limit: 10,
        filter: FilterData,
        insert: InsertEvents,
        plural: 'artists',
        display: "Artists",
        useritem: false,
        multiinsert: false,
    },
    pool: {
        controller: 'pool_versions',
        user: 'updater_id',
        item: 'pool_id',
        only: 'id,updater_id,pool_id',
        limit: 2,
        filter: FilterData,
        insert: InsertPools,
        process: () => {JSPLib.utility.setCSSStyle(POOL_CSS, 'pool');},
        plural: 'pools',
        display: "Pools",
        useritem: false,
        open: () => {
            OpenItemClick('pooldiff', AddPoolDiff);
            OpenItemClick('poolposts', AddPoolPosts);
        },
    },
    feedback: {
        controller: 'user_feedbacks',
        user: 'creator_id',
        only: 'id,creator_id,body',
        filter: FilterData,
        other_filter: IsShownFeedback,
        insert: InsertEvents,
        process: () => {JSPLib.utility.setCSSStyle(FEEDBACK_CSS, 'feedback');},
        plural: 'feedbacks',
        useritem: false,
        multiinsert: false,
    },
    ban: {
        controller: 'bans',
        user: 'banner_id',
        only: 'id,banner_id',
        filter: FilterData,
        other_filter: IsShownBan,
        insert: InsertEvents,
        process: () => {JSPLib.utility.setCSSStyle(BAN_CSS, 'ban');},
        plural: 'bans',
        useritem: false,
        multiinsert: false,
    },
    mod_action: {
        controller: 'mod_actions',
        get addons() {
            return {search: {category: EL.subscribed_mod_actions.join(',')}};
        },
        only: 'id,category',
        filter: (array) => (array.filter((val) => (IsCategorySubscribed(val.category)))),
        insert: InsertEvents,
        plural: 'mod actions',
        useritem: false,
        multiinsert: false,
    },
};

//Validate constants

const TYPE_GROUPING = '(?:' + ALL_EVENTS.join('|') + ')';
const SUBSCRIBE_GROUPING = '(?:' + ALL_SUBSCRIBES.join('|') + ')';

const BOOL_SETTING_REGEX = RegExp([
    `el-${SUBSCRIBE_GROUPING}overflow`,
    'el-overflow',
    ].join('|')
)
const TIME_SETTING_REGEX = RegExp([
        'el-last-seen',
        'el-process-semaphore',
        'el-event-timeout',
        'el-saved-timeout',
    ].join('|')
)
const ID_SETTING_REGEX = RegExp([
        `el-(?:pq-|ot-)?${TYPE_GROUPING}lastid`,
        `el-(?:pq-|ot-)?saved${TYPE_GROUPING}lastid`,
    ].join('|')
)
const ID_LIST_SETTING_REGEX = RegExp([
        `el-(?:us-)?${SUBSCRIBE_GROUPING}list`,
        `el-(?:pq-|ot-|us-)?saved${TYPE_GROUPING}list`,
    ].join('|')
)

const VALIDATE_REGEXES = {
    setting: /el-user-settings/,
    bool: BOOL_SETTING_REGEX,
    time: TIME_SETTING_REGEX,
    id: ID_SETTING_REGEX,
    idlist: ID_LIST_SETTING_REGEX,
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

function CorrectList(type, typelist) {
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
        error_messages.forEach((error) => {this.debug('log', ...error);});
        return true;
    }
    return false;
}

//Library functions

////NONE

//Helper functions

async function SetRecentDanbooruID(type, qualifier) {
    let type_addon = TYPEDICT[type].addons || {};
    let url_addons = JSPLib.utility.mergeHashes(type_addon, {only: ID_FIELD, limit: 1});
    let jsonitem = await JSPLib.danbooru.submitRequest(TYPEDICT[type].controller, url_addons, {default_val: []});
    if (jsonitem.length) {
        SaveLastID(type, JSPLib.danbooru.getNextPageID(jsonitem, true), qualifier);
    } else if (TYPEDICT[type].useritem) {
        SaveLastID(type, 1, qualifier);
    }
}

function AnyRenderedEvents() {
    return Object.keys(EL.renderedlist).some((type) => (EL.renderedlist[type].length > 0));
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

function IsCategorySubscribed(type) {
    return EL.subscribed_mod_actions.includes(type);
}

function GetTypeQuery(type) {
    return EL.user_settings[type + '_query'];
}

function HideDmailNotice() {
    if (EL.dmail_notice.length) {
        EL.dmail_notice.hide();
        let dmail_id = EL.dmail_notice.data('id');
        JSPLib.utility.createCookie('hide_dmail_notice', dmail_id);
    }
}

//Data storage functions

function GetList(type) {
    if (!IsEventEnabled(type, 'subscribe_events_enabled')) {
        return new Set();
    }
    if (EL.subscribeset[type]) {
        return EL.subscribeset[type];
    }
    EL.subscribeset[type] = JSPLib.storage.getLocalData(`el-${type}list`, {default_val: []});
    if (CorrectList(type, EL.subscribeset)) {
        setTimeout(() => {
            JSPLib.storage.setLocalData(`el-${type}list`, EL.subscribeset[type]);
        }, NONSYNCHRONOUS_DELAY);
    }
    EL.subscribeset[type] = new Set(EL.subscribeset[type]);
    return EL.subscribeset[type];
}

function SetList(type, remove_item, itemid) {
    if (!IsEventEnabled(type, 'subscribe_events_enabled')) {
        return;
    }
    let typeset = GetList(type);
    if (remove_item) {
        // eslint-disable-next-line dot-notation
        typeset.delete(itemid);
    } else {
        typeset.add(itemid);
    }
    JSPLib.storage.setLocalData(`el-${type}list`, [...typeset]);
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
    EL.userset[type] = JSPLib.storage.getLocalData(`el-us-${type}list`, {default_val: []});
    if (CorrectList(type, EL.userset)) {
        setTimeout(() => {
            JSPLib.storage.setLocalData(`el-us-${type}list`, EL.userset);
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
    JSPLib.storage.setLocalData(`el-us-${type}list`, [...typeset]);
    EL.channel.postMessage({type: 'subscribe_user', eventtype: type, was_subscribed: remove_item, userid, eventset: typeset});
    EL.userset[type] = typeset;
}

//Quicker way to check list existence; avoids unnecessarily parsing very long lists
function CheckList(type) {
    if (!JSPLib.menu.isSettingEnabled('subscribe_events_enabled', type)) {
        return false;
    }
    let typelist = localStorage.getItem(`el-${type}list`);
    return Boolean(typelist) && typelist !== '[]';
}

function CheckUserList(type) {
    if (!JSPLib.menu.isSettingEnabled('user_events_enabled', type)) {
        return false;
    }
    let typelist = localStorage.getItem(`el-us-${type}list`);
    return Boolean(typelist) && typelist !== '[]';
}

//Auxiliary functions

function FilterData(array, subscribe_set, user_set) {
    return array.filter((val) => IsShownData.call(this, val, subscribe_set, user_set));
}

function IsShownData(val, subscribe_set, user_set) {
    if ((EL.filter_user_events && this.user && (val[this.user] === EL.userid)) || EL.filter_users.includes(val[this.user])) {
        return false;
    }
    if (user_set && this.user && user_set.has(val[this.user])) {
        return true;
    }
    if (subscribe_set && this.item) {
        let is_creator_event = EL.show_creator_events && this.creator && JSPLib.utility.getNestedAttribute(val, this.creator) === EL.userid;
        if (!is_creator_event && !subscribe_set.has(val[this.item])) {
            return false;
        }
    }
    if (this.other_filter && !this.other_filter(val)) {
        return false;
    }
    return true;
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

function InsertPostPreview($container, post_id, query_string) {
    let $thumb_copy = $(EL.thumbs[post_id]).clone();
    let $thumb_copy_link = $thumb_copy.find('a');
    let thumb_url = $thumb_copy_link.attr('href') + query_string;
    $thumb_copy_link.attr('href', thumb_url);
    $container.append($thumb_copy);
}

function SaveLastID(type, lastid, qualifier = '') {
    if (!JSPLib.validate.validateID(lastid)) {
        this.debug('log', "Last ID for", type, "is not valid!", lastid);
        return;
    }
    qualifier += (qualifier.length > 0 ? '-' : '');
    let key = `el-${qualifier}${type}lastid`;
    let previousid = JSPLib.storage.checkLocalData(key, {default_val: 1});
    lastid = Math.max(previousid, lastid);
    JSPLib.storage.setLocalData(key, lastid);
    this.debug('log', `Set last ${qualifier}${type} ID:`, lastid);
}

function WasOverflow() {
    return JSPLib.storage.checkLocalData('el-overflow', {default_val: false});
}

function SetLastSeenTime() {
    JSPLib.storage.setLocalData('el-last-seen', Date.now());
}

function CalculateOverflow(recalculate = false) {
    if (EL.any_overflow === undefined || recalculate) {
        EL.all_overflows = {};
        EL.any_overflow = false;
        let enabled_events = JSPLib.utility.arrayIntersection(ALL_SUBSCRIBES, EL.all_subscribe_events);
        enabled_events.forEach((type) => {
            EL.all_overflows[type] = (EL.all_overflows[type] === undefined ? JSPLib.storage.checkLocalData(`el-${type}overflow`, {default_val: false}) : EL.all_overflows[type]);
            EL.any_overflow = EL.any_overflow || EL.all_overflows[type];
        });
    }
}

function CheckOverflow(inputtype) {
    if (!ALL_SUBSCRIBES.includes(inputtype)) {
        return false;
    }
    return EL.all_overflows[inputtype];
}

function ProcessEvent(inputtype, optype) {
    if ((optype !== 'all_subscribe_events' && !JSPLib.menu.isSettingEnabled(optype, inputtype)) || (optype === 'all_subscribe_events' && !EL.all_subscribe_events.includes(inputtype))) {
        this.debug('log', "Hard disable:", inputtype, optype);
        return false;
    }
    if (optype === 'all_subscribe_events'
            && !(JSPLib.menu.isSettingEnabled('subscribe_events_enabled', inputtype) && (EL.show_creator_events || CheckList(inputtype)))
            && !(JSPLib.menu.isSettingEnabled('user_events_enabled', inputtype) && CheckUserList(inputtype))) {
        this.debug('log', "Soft disable:", inputtype, optype);
        return false;
    }
    JSPLib.debug.debugExecute(() => {
        this.debug('log', inputtype, optype, CheckOverflow(inputtype), !EL.any_overflow);
    });
    if ((optype === 'all_subscribe_events') && CheckOverflow(inputtype)) {
        return CheckSubscribeType(inputtype);
    }
    if (!EL.any_overflow) {
        switch(optype) {
            case 'post_query_events_enabled':
                return CheckPostQueryType(inputtype);
            case 'all_subscribe_events':
                return CheckSubscribeType(inputtype);
            case 'other_events_enabled':
                return CheckOtherType(inputtype);
            default:
                return false;
        }
    }
    return false;
}

function CheckAbsence() {
    let last_seen = JSPLib.storage.getLocalData('el-last-seen', {default_val: 0});
    let time_absent = Date.now() - last_seen;
    if (last_seen === 0 || (time_absent < JSPLib.utility.one_day)) {
        return true;
    }
    EL.days_absent = JSPLib.utility.setPrecision(time_absent / JSPLib.utility.one_day, 2);
    return false;
}

//Table row functions

//Get single instance of various types and insert into table row

async function AddForumPost(forumid, rowelement) {
    let forum_page = await JSPLib.network.getNotify(`/forum_posts/${forumid}`);
    if (!forum_page) {
        return;
    }
    let $forum_page = $.parseHTML(forum_page);
    let $forum_post = $(`#forum_post_${forumid}`, $forum_page);
    let $outerblock = $.parseHTML(RenderOpenItemContainer('forum', forumid, 4));
    $('td', $outerblock).append($forum_post);
    let $rowelement = $(rowelement);
    $rowelement.after($outerblock);
    if (EL.mark_read_topics) {
        let topic_id = $rowelement.data('topic-id');
        if (!EL.marked_topic.includes(topic_id)) {
            ReadForumTopic(topic_id);
            EL.marked_topic.push(topic_id);
        }
    }
}

function AddRenderedNote(noteid, rowelement) {
    let notehtml = $('.body-column', rowelement).html();
    notehtml = notehtml && $.parseHTML(notehtml.trim())[0].textContent;
    let $outerblock = $.parseHTML(RenderOpenItemContainer('note', noteid, 7));
    $('td', $outerblock).append(notehtml);
    $(rowelement).after($outerblock);
}

async function AddDmail(dmailid, rowelement) {
    let dmail = await JSPLib.network.getNotify(`/dmails/${dmailid}`);
    if (!dmail) {
        return;
    }
    let $dmail = $.parseHTML(dmail);
    $('.dmail h1:first-of-type', $dmail).hide();
    let $outerblock = $.parseHTML(RenderOpenItemContainer('dmail', dmailid, 5));
    $('td', $outerblock).append($('.dmail', $dmail));
    $(rowelement).after($outerblock);
    if (EL.mark_read_dmail) {
        ReadDmail(dmailid);
    }
}

async function AddWiki(wikiverid, rowelement) {
    let $rowelement = $(rowelement);
    let wikiid = $rowelement.data('wiki-page-id');
    let url_addons = {search: {wiki_page_id: wikiid}, page: `b${wikiverid}`, only: ID_FIELD, limit: 1};
    let prev_wiki = await JSPLib.danbooru.submitRequest('wiki_page_versions', url_addons, {default_val: []});
    if (prev_wiki.length) {
        let wiki_diff_page = await JSPLib.network.getNotify('/wiki_page_versions/diff', {url_addons: {otherpage: wikiverid, thispage: prev_wiki[0].id}});
        if (!wiki_diff_page) {
            return;
        }
        let $wiki_diff_page = $.parseHTML(wiki_diff_page);
        let $outerblock = $.parseHTML(RenderOpenItemContainer('wiki', wikiverid, 4));
        $('td', $outerblock).append($('#a-diff #content', $wiki_diff_page));
        $rowelement.after($outerblock);
    } else {
        JSPLib.notice.error("Wiki creations have no diff!");
    }
}

async function AddPoolDiff(poolverid, rowelement) {
    let pool_diff = await JSPLib.network.getNotify(`/pool_versions/${poolverid}/diff`);
    let $pool_diff = $.parseHTML(pool_diff);
    $('#a-diff > h1', $pool_diff).hide();
    let $outerblock = $.parseHTML(RenderOpenItemContainer('pooldiff', poolverid, 7));
    $('td', $outerblock).append($('#a-diff', $pool_diff));
    $(rowelement).after($outerblock);
}

async function AddPoolPosts(poolverid, rowelement) {
    let $post_count = $('.post-count-column', rowelement);
    let add_posts = String($post_count.data('add-posts') || "").split(',').sort().reverse();
    let rem_posts = String($post_count.data('rem-posts') || "").split(',').sort().reverse();
    let total_posts = JSPLib.utility.concat(add_posts, rem_posts);
    let missing_posts = JSPLib.utility.arrayDifference(total_posts, Object.keys(EL.thumbs));
    if (missing_posts.length) {
        let thumbnails = await JSPLib.network.getNotify(`/posts`, {url_addons: {tags: 'id:' + missing_posts.join(',') + ' status:any'}});
        let $thumbnails = $.parseHTML(thumbnails);
        $('.post-preview', $thumbnails).each((_, thumb) => {InitializeThumb(thumb);});
    }
    let $outerblock = $.parseHTML(RenderOpenItemContainer('poolposts', poolverid, 7));
    $('td', $outerblock).append(`<div class="el-add-pool-posts" style="display:none"></div><div class="el-rem-pool-posts" style="display:none"></div>`);
    if (add_posts.length) {
        let $container = $('.el-add-pool-posts', $outerblock).show();
        let query_string = '?q=id%3A' + add_posts.join('%2C');
        add_posts.forEach((post_id) => {InsertPostPreview($container, post_id, query_string);});
    }
    if (rem_posts.length) {
        let $container = $('.el-rem-pool-posts', $outerblock).show();
        let query_string = '?q=id%3A' + rem_posts.join('%2C');
        rem_posts.forEach((post_id) => {InsertPostPreview($container, post_id, query_string);});
    }
    $(rowelement).after($outerblock);
}

//Update links

function UpdateMultiLink(typelist, subscribed, itemid) {
    let typeset = new Set(typelist);
    let current_subscribed = new Set($('#el-subscribe-events .el-subscribed').map((_, entry) => entry.dataset.type.split(',')));
    let new_subscribed = (subscribed ?
        JSPLib.utility.setDifference(current_subscribed, typeset) :
        JSPLib.utility.setUnion(current_subscribed, typeset));
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

//Insert and process HTML onto page for various types

function InsertEvents($event_page, type) {
    let $table = $('.striped', $event_page);
    if (TYPEDICT[type].multiinsert) {
        AdjustColumnWidths($table[0]);
    }
    InitializeTypeDiv(type, $table);
}

function InsertDmails($dmail_page, type) {
    DecodeProtectedEmail($dmail_page);
    let $dmail_table = $('.striped', $dmail_page);
    $('tr[data-is-read="false"]', $dmail_table).addClass('el-unread');
    $('tr[data-is-delted="true"]', $dmail_table).addClass('el-deleted');
    $('tbody tr', $dmail_table).each((_, row) => {
        let dmailid = $(row).data('id');
        $('a[data-params="dmail[is_read]=true"]', row).replaceWith(`<a class="el-dmail-read" data-id="${dmailid}" href="javascript:void(0)">Read</a>`);
        $('a[data-params="dmail[is_read]=false"]', row).replaceWith(`<a class="el-dmail-unread" data-id="${dmailid}" href="javascript:void(0)">Unread</a>`);
        $('a[data-params="dmail[is_deleted]=true"]', row).replaceWith(`<a class="el-dmail-delete" data-id="${dmailid}" href="javascript:void(0)">Delete</a>`);
        $('a[data-params="dmail[is_deleted]=false"]', row).replaceWith(`<a class="el-dmail-undelete" data-id="${dmailid}" href="javascript:void(0)">Undelete</a>`);
    });
    let $dmail_div = InitializeTypeDiv(type, $dmail_table);
    InitializeOpenDmailLinks($dmail_div[0]);
}

function InsertComments($comment_page) {
    DecodeProtectedEmail($comment_page);
    let $comment_section = $('.list-of-comments', $comment_page);
    $comment_section.find('> form').remove();
    InitializeTypeDiv('comment', $comment_section);
}

function InsertForums($forum_page) {
    DecodeProtectedEmail($forum_page);
    let $forum_table = $('.striped', $forum_page);
    let $forum_div = InitializeTypeDiv('forum', $forum_table);
    InitializeOpenForumLinks($forum_div[0]);
}

function InsertNotes($note_page) {
    DecodeProtectedEmail($note_page);
    let $note_table = $('.striped', $note_page);
    $('th:first-of-type, td:first-of-type', $note_table[0]).remove();
    AdjustColumnWidths($note_table[0]);
    let $note_div = InitializeTypeDiv('note', $note_table);
    AddThumbnailStubs($note_div[0]);
    InitializeOpenNoteLinks($note_div[0]);
}

function InsertPosts($post_page) {
    let $post_table = $('.striped', $post_page);
    $('.post-version-select-column', $post_table[0]).remove();
    $('tbody tr', $post_table[0]).each((_, row) => {
        let post_id = $(row).data('post-id');
        let $preview = $('td.post-column .post-preview', row).detach();
        if ($preview.length) {
            InitializeThumb($preview[0]);
        }
        $('td.post-column', row).html(`<a href="/posts/${post_id}">post #${post_id}</a>`);
    });
    AdjustColumnWidths($post_table[0]);
    let $post_div = InitializeTypeDiv('post', $post_table);
    AddThumbnailStubs($post_div[0]);
}

function InsertWikis($wiki_page) {
    DecodeProtectedEmail($wiki_page);
    let $wiki_table = $('.striped', $wiki_page);
    let $wiki_div = InitializeTypeDiv('wiki', $wiki_table);
    InitializeOpenWikiLinks($wiki_div[0]);
}

function InsertPools($pool_page) {
    DecodeProtectedEmail($pool_page);
    let $pool_table = $('.striped', $pool_page);
    $('.pool-category-collection, .pool-category-series', $pool_table[0]).each((_, entry) => {
        let short_pool_title = JSPLib.utility.maxLengthString(entry.innerText, 50);
        $(entry).attr('title', entry.innerText);
        entry.innerText = short_pool_title;
    });
    let $pool_div = InitializeTypeDiv('pool', $pool_table);
    InitializeOpenPoolLinks($pool_div[0]);
}

function InitializeTypeDiv(type, $type_page) {
    let $type_table = $(`#el-${type}-table`);
    if ($('>div', $type_table[0]).length) {
        $('thead', $type_page[0]).hide();
    }
    let $type_div = $('<div></div>').append($type_page);
    $('.post-preview', $type_div).addClass('blacklisted');
    $type_table.append($type_div);
    return $type_div;
}

function InitializeThumb(thumb, query_string = "") {
    let $thumb = $(thumb);
    $thumb.addClass('blacklisted');
    $thumb.find('.post-preview-score').remove();
    let postid = String($thumb.data('id'));
    let $link = $('a', thumb);
    let post_url = $link.attr('href').split('?')[0];
    $link.attr('href', post_url + query_string);
    let $comment = $('.comment', thumb);
    if ($comment.length) {
        $comment.hide();
        $('.el-subscribe-comment-container ', thumb).hide();
    }
    thumb.style.setProperty('display', 'block', 'important');
    thumb.style.setProperty('text-align', 'center', 'important');
    EL.thumbs[postid] = thumb;
}

//Misc functions

function ReadDmail(dmailid) {
    return JSPLib.network.put(`/dmails/${dmailid}.json`, {data: {dmail: {is_read: true}}});
}

function UnreadDmail(dmailid) {
    return JSPLib.network.put(`/dmails/${dmailid}.json`, {data: {dmail: {is_read: false}}});
}

function DeleteDmail(dmailid) {
    return JSPLib.network.put(`/dmails/${dmailid}.json`, {data: {dmail: {is_deleted: true}}});
}

function UndeleteDmail(dmailid) {
    JSPLib.network.put(`/dmails/${dmailid}.json`, {data: {dmail: {is_deleted: false}}});
}

function ReadForumTopic(topicid) {
    $.ajax({
        type: 'HEAD',
        url: '/forum_topics/' + topicid,
        headers: {
            Accept: 'text/html',
        }
    });
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
}

function AddThumbnailStubs(dompage) {
    $('.striped thead tr', dompage).prepend('<th>Thumb</th>');
    var row_save = {};
    var post_ids = new Set();
    $('.striped tr[id]', dompage).each((_, row) => {
        let $row = $(row);
        let postid = $row.data('post-id');
        post_ids.add(postid);
        row_save[postid] = row_save[postid] || [];
        row_save[postid].push($(row).detach());
    });
    let display_ids = [...post_ids].sort().reverse();
    var $body = $('.striped tbody', dompage);
    display_ids.forEach((postid) => {
        row_save[postid][0].prepend(`<td rowspan="${row_save[postid].length}" class="el-post-thumbnail" data-postid="${postid}"></td>`);
        row_save[postid].forEach((row) => {
            $body.append(row);
        });
    });
    EL.post_ids = JSPLib.utility.setUnion(EL.post_ids, post_ids);
}

async function GetThumbnails() {
    let found_post_ids = new Set(Object.keys(EL.thumbs).map(Number));
    let missing_post_ids = [...JSPLib.utility.setDifference(EL.post_ids, found_post_ids)];
    for (let i = 0; i < missing_post_ids.length; i += QUERY_LIMIT) {
        let post_ids = missing_post_ids.slice(i, i + QUERY_LIMIT);
        let url_addons = {tags: `id:${post_ids} status:any limit:${post_ids.length}`};
        let html = await JSPLib.network.getNotify('/posts', {url_addons});
        let $posts = $.parseHTML(html);
        $('.post-preview', $posts).each((_, thumb) => {
            InitializeThumb(thumb);
        });
    }
}

function InsertThumbnails() {
    $('#el-event-notice .el-post-thumbnail').each((_, marker) => {
        if ($('.post-preview', marker).length) {
            return;
        }
        let $marker = $(marker);
        let post_id = String($marker.data('postid'));
        let thumb_copy = $(EL.thumbs[post_id]).clone();
        $marker.prepend(thumb_copy);
    });
}

function ProcessThumbnails() {
    $('#el-event-notice article.post-preview').each((_, thumb) => {
        let $thumb = $(thumb);
        $thumb.addClass('blacklisted');
        let post_id = String($thumb.data('id'));
        if (!(post_id in EL.thumbs)) {
            let thumb_copy = $thumb.clone();
            //Clone returns a node array and InitializeThumb is expecting a node
            InitializeThumb(thumb_copy[0]);
        }
        let display_style = window.getComputedStyle(thumb).display;
        thumb.style.setProperty('display', display_style, 'important');
    });
}

function AdjustRowspan(rowelement, openitem) {
    let postid = $(rowelement).data('id');
    let $thumb_cont = $(`#el-note-table .el-post-thumbnail[data-postid="${postid}"]`);
    let current_rowspan = $thumb_cont.attr('rowspan');
    let new_rowspan = parseInt(current_rowspan) + (openitem ? 1 : -1);
    $thumb_cont.attr('rowspan', new_rowspan);
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
        subscribe_func = GetList;
    } else if (event_type === 'user_events_enabled') {
        subscribe_func = GetUserList;
    }
    subscribe_func = subscribe_func || (event_type === 'user_events_enabled' ? GetList : null);
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
    <td colspan="${columns}"></td>
</tr>`;
}

//Initialize functions

function InitializeNoticeBox(notice_html) {
    $('#top').after(NOTICE_BOX);
    if (notice_html) {
        $("#el-event-notice").html(notice_html);
    }
    if (EL.locked_notice) {
        $('#el-lock-event-notice').addClass('el-locked');
    } else {
        $('#el-lock-event-notice').one(PROGRAM_CLICK, LockEventNotice);
    }
    $('#el-hide-event-notice').one(PROGRAM_CLICK, HideEventNotice);
    $('#el-read-event-notice').one(PROGRAM_CLICK, ReadEventNotice);
    $('#el-reload-event-notice').one(PROGRAM_CLICK, ReloadEventNotice);
    $('#el-snooze-event-notice').one(PROGRAM_CLICK, SnoozeEventNotice);
}

function InitializeOpenForumLinks(table) {
    $('.striped tbody tr', table).each((_, row) => {
        let forumid = $(row).data('id');
        let link_html = RenderOpenItemLinks('forum', forumid);
        $('.forum-post-excerpt', row).prepend(link_html + '&nbsp;|&nbsp;');
    });
    OpenItemClick('forum', AddForumPost);
}

function InitializeOpenNoteLinks(table) {
    $('.striped tr[id]', table).each((_, row) => {
        let noteid = $(row).data('id');
        let link_html = RenderOpenItemLinks('note', noteid, "Render note", "Hide note");
        $('.body-column', row).append(`<p style="text-align:center">${link_html}</p>`);
    });
    OpenItemClick('note', AddRenderedNote, AdjustRowspan);
}

function InitializeOpenDmailLinks(table) {
    $('.striped tbody tr', table).each((_, row) => {
        let dmailid = $(row).data('id');
        let link_html = RenderOpenItemLinks('dmail', dmailid);
        $('.subject-column', row).prepend(link_html + '&nbsp;|&nbsp;');
    });
    OpenItemClick('dmail', AddDmail);
}

function InitializeOpenWikiLinks(table) {
    $('.striped thead .diff-column').attr('width', '5%');
    $('.striped tbody tr', table).each((_, row) => {
        let $column = $('.diff-column', row);
        let $diff_link = $('a', $column[0]);
        if ($diff_link.length) {
            let wikiverid = $(row).data('id');
            let link_html = RenderOpenItemLinks('wiki', wikiverid, "Show diff", "Hide diff");
            $diff_link.replaceWith(`${link_html}`);
        } else {
            $column.html('&nbsp&nbspNo diff');
        }
    });
    OpenItemClick('wiki', AddWiki);
}

function InitializeOpenPoolLinks(table) {
    $('.striped tbody tr', table).each((_, row) => {
        let poolverid = $(row).data('id');
        let $post_changes = $('.post-changes-column', row);
        let add_posts = $('.diff-list ins a[href^="/posts"]', $post_changes[0]).map((_, entry) => entry.innerText).toArray();
        let rem_posts = $('.diff-list del a[href^="/posts"]', $post_changes[0]).map((_, entry) => entry.innerText).toArray();
        let $post_count = $('.post-count-column', row);
        if (add_posts.length || rem_posts.length) {
            let link_html = RenderOpenItemLinks('poolposts', poolverid, 'Show posts', 'Hide posts');
            $post_count.prepend(link_html, '&nbsp;|&nbsp;');
            $post_count.attr('data-add-posts', add_posts);
            $post_count.attr('data-rem-posts', rem_posts);
        } else {
            $post_count.prepend('<span style="font-family:monospace">&nbsp;&nbsp;No posts&nbsp;|&nbsp;</span>');
        }
        let $desc_changed_link = $('.diff-column a[href$="/diff"]', row);
        if ($desc_changed_link.length !== 0) {
            let link_html = RenderOpenItemLinks('pooldiff', poolverid, 'Show diff', 'Hide diff');
            $desc_changed_link.replaceWith(link_html);
        } else {
            $('.diff-column', row).html('<span style="font-family:monospace">&nbsp;&nbsp;No diff</span>');
        }
    });
    OpenItemClick('pooldiff', AddPoolDiff);
    OpenItemClick('poolposts', AddPoolPosts);
}

function AdjustColumnWidths(table) {
    let width_dict = Object.assign({}, ...$("thead th", table).map((_, entry) => {
        let classname = JSPLib.utility.findAll(entry.className, /\S+column/g)[0];
        let width = $(entry).attr('width');
        return {[classname]: width};
    }));
    $('tbody td', table).each((_, entry) => {
        let classname = JSPLib.utility.findAll(entry.className, /\S+column/g)[0];
        if (!classname || !(classname in width_dict)) {
            return;
        }
        $(entry).css('width', width_dict[classname]);
    });
}

//#C-USERS #A-SHOW
function InitializeUserShowMenu() {
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

//#C-POSTS #A-SHOW
function InitializePostShowMenu() {
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

//#C-FORUM-TOPICS #A-SHOW
function InitializeTopicShowMenu() {
    if (!IsEventEnabled('forum', 'subscribe_events_enabled')) return;
    let topicid = $('body').data('forum-topic-id');
    let $menu_obj = $.parseHTML(RenderMultilinkMenu(topicid, 'subscribe_events_enabled'));
    let linkhtml = RenderSubscribeMultiLinks("Topic", ['forum'], topicid, 'subscribe_events_enabled');
    $('#el-add-links', $menu_obj).append(`<span class="el-subscribe-forum-container">${linkhtml}</span>`);
    $('#nav').append($menu_obj);
}

//#C-WIKI-PAGES #A-SHOW / #C-WIKI-PAGE-VERSIONS #A-SHOW
function InitializeWikiShowMenu() {
    if (!IsEventEnabled('wiki', 'subscribe_events_enabled')) return;
    let data_selector = (EL.controller === 'wiki-pages' ? 'wiki-page-id' : 'wiki-page-version-wiki-page-id');
    let wikiid = $('body').data(data_selector);
    let $menu_obj = $.parseHTML(RenderMultilinkMenu(wikiid, 'subscribe_events_enabled'));
    let linkhtml = RenderSubscribeMultiLinks("Wiki", ['wiki'], wikiid, 'subscribe_events_enabled');
    $('#el-add-links', $menu_obj).append(`<span class="el-subscribe-wiki-container">${linkhtml}</span>`);
    $('#nav').append($menu_obj);
}

//#C-ARTISTS #A-SHOW
function InitializeArtistShowMenu() {
    if (!IsEventEnabled('artist', 'subscribe_events_enabled')) return;
    let artistid = $('body').data('artist-id');
    let $menu_obj = $.parseHTML(RenderMultilinkMenu(artistid, 'subscribe_events_enabled'));
    let linkhtml = RenderSubscribeMultiLinks("Artist", ['artist'], artistid, 'subscribe_events_enabled');
    $('#el-add-links', $menu_obj).append(`<span class="el-subscribe-artist-container">${linkhtml}</span>`);
    $('#nav').append($menu_obj);
}

//#C-POOLS #A-SHOW
function InitializePoolShowMenu() {
    if (!IsEventEnabled('pool', 'subscribe_events_enabled')) return;
    let poolid = $('body').data('pool-id');
    let $menu_obj = $.parseHTML(RenderMultilinkMenu(poolid, 'subscribe_events_enabled'));
    let linkhtml = RenderSubscribeMultiLinks("Pool", ['pool'], poolid, 'subscribe_events_enabled');
    $('#el-add-links', $menu_obj).append(`<span class="el-subscribe-pool-container">${linkhtml}</span>`);
    $('#nav').append($menu_obj);
}

//Event handlers

function MarkDmailRead(event) {
    let dmailid = $(event.currentTarget).data('id');
    let $link = $(event.currentTarget);
    ReadDmail(dmailid).then(
        () => {
            $link.closest('tr').removeClass('el-unread');
            $link.toggleClass('el-dmail-read el-dmail-unread').text('Unread');
            JSPLib.notice.notice("Dmail updated.");
        },
        () => {
            JSPLib.notice.error('Unable to mark dmail as read.');
        });
}

function MarkDmailUnread(event) {
    let dmailid = $(event.currentTarget).data('id');
    let $link = $(event.currentTarget);
    UnreadDmail(dmailid).then(
        () => {
            $link.closest('tr').addClass('el-unread');
            $link.toggleClass('el-dmail-unread el-dmail-read').text('Read');
            JSPLib.notice.notice("Dmail updated.");
        },
        () => {
            JSPLib.notice.error('Unable to mark dmail as unread.');
        });
}

function MarkDmailDeleted(event) {
    let dmailid = $(event.currentTarget).data('id');
    if (confirm("Are you sure you want to delete this dmail?")) {
        let $link = $(event.currentTarget);
        DeleteDmail(dmailid).then(
            () => {
                $link.closest('tr').addClass('el-deleted');
                $link.toggleClass('el-dmail-delete el-dmail-undelete').text('Undelete');
                JSPLib.notice.notice("Dmail deleted.");
            },
            () => {
                JSPLib.notice.error('Unable to delete dmail.');
            });
    }
}

function MarkDmailUndeleted(event) {
    let dmailid = $(event.currentTarget).data('id');
    let $link = $(event.currentTarget);
    UndeleteDmail(dmailid).then(
        () => {
            $link.closest('tr').removeClass('el-deleted');
            $(event.currentTarget).toggleClass('el-dmail-undelete el-dmail-delete').text('Delete');
            JSPLib.notice.notice("Dmail undeleted.");
        },
        () => {
            JSPLib.notice.error('Unable to undelete dmail.');
        });
}

function HideEventNotice(settimeout = true) {
    $('#el-close-notice-link').click();
    $('#el-event-notice').hide();
    MarkAllAsRead();
    if (settimeout) {
        JSPLib.concurrency.setRecheckTimeout('el-event-timeout', EL.timeout_expires);
    }
    EL.channel.postMessage({type: 'hide'});
}

function SnoozeEventNotice() {
    HideEventNotice(false);
    JSPLib.concurrency.setRecheckTimeout('el-event-timeout', Math.max(EL.timeout_expires * 2, MAX_SNOOZE_DURATION));
}

function LockEventNotice(event) {
    $(event.target).addClass('el-locked');
    EL.locked_notice = true;
}

function ReadEventNotice(event) {
    $('#el-close-notice-link').click();
    $(event.target).addClass('el-read');
    MarkAllAsRead();
    $('#el-event-notice .el-overflow-notice').hide();
    $('#el-reload-event-notice').off(PROGRAM_CLICK);
    JSPLib.concurrency.setRecheckTimeout('el-event-timeout', EL.timeout_expires);
}

function ReloadEventNotice() {
    $("#el-event-notice").remove();
    InitializeNoticeBox();
    CalculateOverflow();
    EL.renderedlist = {};
    let promise_array = [];
    ALL_EVENTS.forEach((type) => {
        let savedlist = JSPLib.utility.multiConcat(
            JSPLib.storage.getLocalData(`el-saved${type}list`, {default_val: []}),
            JSPLib.storage.getLocalData(`el-ot-saved${type}list`, {default_val: []}),
            JSPLib.storage.getLocalData(`el-pq-saved${type}list`, {default_val: []}),
        );
        let is_overflow = CheckOverflow(type);
        if (savedlist.length || is_overflow) {
            promise_array.push(LoadHTMLType(type, JSPLib.utility.arrayUnique(savedlist), CheckOverflow(type)));
        }
    });
    Promise.all(promise_array).then(() => {
        ProcessThumbnails();
        FinalizeEventNotice(true);
        JSPLib.notice.notice("Notice reloaded.");
    });
}

function UpdateAll() {
    JSPLib.network.counter_domname = '#el-activity-indicator';
    $("#el-dismiss-notice").hide();
    $("#el-loading-message").show();
    EL.no_limit = true;
    ProcessAllEvents(() => {
        JSPLib.concurrency.setRecheckTimeout('el-event-timeout', EL.timeout_expires);
        SetLastSeenTime();
        JSPLib.notice.notice("All events checked!");
        $("#el-event-controls").show();
        $("#el-loading-message").hide();
    });
}

function ResetAll() {
    LASTID_KEYS.forEach((key) => {
        JSPLib.storage.removeLocalData(key);
    });
    $("#el-dismiss-notice").hide();
    ProcessAllEvents(() => {
        JSPLib.concurrency.setRecheckTimeout('el-event-timeout', EL.timeout_expires);
        SetLastSeenTime();
        JSPLib.notice.notice("All event positions reset!");
        $("#el-event-controls").show();
    });
}

function DismissNotice() {
    SetLastSeenTime();
    $('#el-event-notice').hide();
}

function LoadMore(event) {
    let $link = $(event.currentTarget);
    let optype = $link.data('type');
    let $notice = $(event.currentTarget).closest('.el-overflow-notice');
    let type = $notice.data('type');
    if (optype === 'skip') {
        SetRecentDanbooruID(type).then(() => {
            JSPLib.notice.notice("Event position has been reset!");
            $notice.hide();
            JSPLib.storage.setLocalData(`el-${type}overflow`, false);
            JSPLib.storage.removeLocal(`el-saved${type}lastid`);
            JSPLib.storage.removeLocalData(`el-saved${type}list`);
            CalculateOverflow(true);
            JSPLib.storage.setLocalData('el-overflow', EL.any_overflow);
        });
        return;
    }
    EL.no_limit = (optype === 'all');
    EL.item_overflow = false;
    CalculateOverflow();
    CheckSubscribeType(type, `.el-${type}-counter`).then((founditems) => {
        if (founditems) {
            JSPLib.notice.notice("More events found!");
            ProcessThumbnails();
        } else if (EL.item_overflow) {
            JSPLib.notice.notice("No events found, but more can be queried...");
        } else {
            JSPLib.notice.notice("No events found, nothing more to query!");
            $notice.hide();
        }
        $('#el-event-controls').show();
        FinalizeEventNotice();
        CalculateOverflow(true);
        JSPLib.storage.setLocalData('el-overflow', EL.any_overflow);
    });
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
                SetList(type, subscribed, itemid);
            } else if (eventtype === 'user_events_enabled') {
                SetUserList(type, subscribed, itemid);
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
            let typeset = GetList(eventtype);
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
                JSPLib.storage.setLocalData(`el-${eventtype}list`, [...EL.subscribeset[eventtype]]);
            }, NONSYNCHRONOUS_DELAY);
            EL.channel.postMessage({type: 'reload', eventtype, was_subscribed, new_subscribed, eventset: EL.subscribeset[eventtype]});
        });
        $('#el-search-query-counter').html(0);
        JSPLib.notice.notice(`Subscriptions were changed by ${post_changes.size} posts!`);
    }
}

//Event setup functions

function OpenItemClick(type, htmlfunc, otherfunc) {
    $(`.el-show-hide-links[data-type="${type}"] a`).off(PROGRAM_CLICK).on(PROGRAM_CLICK, (event) => {
        EL.openlist[type] = EL.openlist[type] || [];
        let itemid = $(event.target.parentElement.parentElement).data('id');
        let openitem = $(event.target.parentElement).data('action') === 'show';
        let rowelement = $(event.target).closest('tr')[0];
        if (openitem && !EL.openlist[type].includes(itemid)) {
            htmlfunc(itemid, rowelement);
            EL.openlist[type].push(itemid);
        }
        let hide = (openitem ? 'show' : 'hide');
        let show = (openitem ? 'hide' : 'show');
        JSPLib.utility.fullHide(`.el-show-hide-links[data-type="${type}"][data-id="${itemid}"] [data-action="${hide}"]`);
        JSPLib.utility.clearHide(`.el-show-hide-links[data-type="${type}"][data-id="${itemid}"] [data-action="${show}"]`);
        if (openitem) {
            $(`.el-full-item[data-type="${type}"][data-id="${itemid}"]`).show();
        } else {
            $(`.el-full-item[data-type="${type}"][data-id="${itemid}"]`).hide();
        }
        if (typeof otherfunc === 'function') {
            otherfunc(rowelement, openitem);
        }
    });
}

//Rebind functions

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

//Main execution functions

async function CheckPostQueryType(type) {
    let lastidkey = `el-pq-${type}lastid`;
    let typelastid = JSPLib.storage.checkLocalData(lastidkey, {default_val: 0});
    if (typelastid) {
        let savedlistkey = `el-pq-saved${type}list`;
        let savedlastidkey = `el-pq-saved${type}lastid`;
        let type_addon = TYPEDICT[type].addons || {};
        let post_query = GetTypeQuery(type);
        let query_addon = {};
        //Check if the post query has any non-operator text
        if (post_query.replace(/[\s-*~]+/g, '').length > 0) {
            query_addon = (TYPEDICT[type].customquery ? TYPEDICT[type].customquery(post_query) : {search: {post_tags_match: post_query}});
        }
        let url_addons = JSPLib.utility.mergeHashes(type_addon, query_addon, {only: TYPEDICT[type].only});
        let batches = (EL.no_limit ? null : 1);
        let jsontype = await JSPLib.danbooru.getAllItems(TYPEDICT[type].controller, QUERY_LIMIT, {url_addons, batches, page: typelastid, reverse: true});
        let filtertype = TYPEDICT[type].filter(jsontype);
        let lastusertype = (jsontype.length ? JSPLib.danbooru.getNextPageID(jsontype, true) : null);
        if (filtertype.length) {
            this.debug('log', `Found ${TYPEDICT[type].plural}!`, lastusertype);
            let idlist = JSPLib.utility.getObjectAttributes(filtertype, 'id');
            await LoadHTMLType(type, idlist);
            JSPLib.storage.setLocalData(savedlastidkey, lastusertype);
            JSPLib.storage.setLocalData(savedlistkey, idlist);
            return true;
        }
        this.debug('log', `No ${TYPEDICT[type].plural}!`);
        if (lastusertype && (typelastid !== lastusertype)) {
            SaveLastID(type, lastusertype, 'pq');
        }
    } else {
        SetRecentDanbooruID(type, 'pq');
    }
    return false;
}

async function CheckSubscribeType(type, domname = null) {
    let lastidkey = `el-${type}lastid`;
    let savedlastidkey = `el-saved${type}lastid`;
    let savedlastid = JSPLib.storage.getLocalData(savedlastidkey);
    let typelastid = savedlastid || JSPLib.storage.checkLocalData(lastidkey, {default_val: 0});
    if (typelastid) {
        let subscribe_set = GetList(type);
        let user_set = GetUserList(type);
        let savedlistkey = `el-saved${type}list`;
        let overflowkey = `el-${type}overflow`;
        let isoverflow = false;
        let type_addon = TYPEDICT[type].addons || {};
        let only_attribs = TYPEDICT[type].only;
        if (EL.show_creator_events) {
            only_attribs += (TYPEDICT[type].includes ? ',' + TYPEDICT[type].includes : "");
        }
        let url_addons = JSPLib.utility.mergeHashes(type_addon, {only: only_attribs});
        let batches = TYPEDICT[type].limit;
        let batch_limit = TYPEDICT[type].limit * QUERY_LIMIT;
        if (EL.no_limit) {
            batches = null;
            batch_limit = Infinity;
        }
        let jsontype = await JSPLib.danbooru.getAllItems(TYPEDICT[type].controller, QUERY_LIMIT, {url_addons, batches, page: typelastid, reverse: true, domname});
        if (jsontype.length === batch_limit) {
            this.debug('log', `${batch_limit} ${type} items; overflow detected!`);
            JSPLib.storage.setLocalData(overflowkey, true);
            EL.item_overflow = isoverflow = EL.all_overflows[type] = true;
        } else {
            JSPLib.storage.setLocalData(overflowkey, false);
            EL.all_overflows[type] = false;
        }
        let filtertype = TYPEDICT[type].filter(jsontype, subscribe_set, user_set);
        let lastusertype = (jsontype.length ? JSPLib.danbooru.getNextPageID(jsontype, true) : typelastid);
        if (filtertype.length || savedlastid) {
            let rendered_added = false;
            let idlist = JSPLib.utility.getObjectAttributes(filtertype, 'id');
            let previouslist = JSPLib.storage.getLocalData(savedlistkey, {default_val: []});
            idlist = JSPLib.utility.concat(previouslist, idlist);
            if (EL.not_snoozed) {
                this.debug('log', `Displaying ${TYPEDICT[type].plural}:`, idlist.length, lastusertype);
                rendered_added = await LoadHTMLType(type, idlist, isoverflow);
            } else {
                this.debug('log', `Available ${TYPEDICT[type].plural}:`, idlist.length, filtertype.length, lastusertype);
            }
            JSPLib.storage.setLocalData(savedlastidkey, lastusertype);
            JSPLib.storage.setLocalData(savedlistkey, idlist);
            return rendered_added;
        }
        this.debug('log', `No ${TYPEDICT[type].plural}:`, lastusertype);
        SaveLastID(type, lastusertype);
        if (EL.not_snoozed && isoverflow) {
            await LoadHTMLType(type, [], isoverflow);
        }
    } else {
        SetRecentDanbooruID(type);
    }
    return false;
}

async function CheckOtherType(type) {
    let lastidkey = `el-ot-${type}lastid`;
    let typelastid = JSPLib.storage.checkLocalData(lastidkey, {default_val: 0});
    if (typelastid) {
        let savedlistkey = `el-ot-saved${type}list`;
        let savedlastidkey = `el-ot-saved${type}lastid`;
        let type_addon = TYPEDICT[type].addons || {};
        let url_addons = JSPLib.utility.mergeHashes(type_addon, {only: TYPEDICT[type].only});
        let batches = (EL.no_limit ? null : 1);
        let jsontype = await JSPLib.danbooru.getAllItems(TYPEDICT[type].controller, QUERY_LIMIT, {url_addons, batches, page: typelastid, reverse: true});
        let filtertype = TYPEDICT[type].filter(jsontype);
        let lastusertype = (jsontype.length ? JSPLib.danbooru.getNextPageID(jsontype, true) : null);
        if (filtertype.length) {
            this.debug('log', `Found ${TYPEDICT[type].plural}!`, lastusertype);
            let idlist = JSPLib.utility.getObjectAttributes(filtertype, 'id');
            await LoadHTMLType(type, idlist);
            JSPLib.storage.setLocalData(savedlistkey, idlist);
            JSPLib.storage.setLocalData(savedlastidkey, lastusertype);
            return true;
        }
        this.debug('log', `No ${TYPEDICT[type].plural}!`);
        if (lastusertype && (typelastid !== lastusertype)) {
            SaveLastID(type, lastusertype, 'ot');
        }
    } else {
        SetRecentDanbooruID(type, 'ot');
    }
    return false;
}

async function LoadHTMLType(type, idlist, isoverflow = false) {
    let section_selector = '#el-' + JSPLib.utility.kebabCase(type) + '-section';
    let $section = $(section_selector);
    if ($section.children().length === 0) {
        $section.prepend(JSPLib.utility.regexReplace(SECTION_NOTICE, {
            TYPE: type,
            PLURAL: JSPLib.utility.titleizeString(TYPEDICT[type].plural),
        }));
    }
    if (isoverflow) {
        $section.find('.el-overflow-notice').show();
    } else {
        $section.find('.el-overflow-notice').hide();
    }
    EL.renderedlist[type] = EL.renderedlist[type] || [];
    let displaylist = JSPLib.utility.arrayDifference(idlist, EL.renderedlist[type]);
    if (EL.renderedlist[type].length === 0 && displaylist.length === 0) {
        $section.find('.el-missing-notice').show();
    } else {
        $section.find('.el-missing-notice').hide();
    }
    if (displaylist.length === 0) {
        $section.show();
        if (EL.overflow_only_notice_enabled) {
            $('#el-event-notice').show();
        }
        return false;
    }
    EL.renderedlist[type] = JSPLib.utility.concat(EL.renderedlist[type], displaylist);
    let type_addon = TYPEDICT[type].addons || {};
    for (let i = 0; i < displaylist.length; i += QUERY_LIMIT) {
        let querylist = displaylist.slice(i, i + QUERY_LIMIT);
        let url_addons = JSPLib.utility.mergeHashes(type_addon, {search: {id: querylist.join(',')}, type: 'previous', limit: querylist.length});
        if (querylist.length > 1) {
            url_addons.search.order = 'custom';
        }
        let typehtml = await JSPLib.network.getNotify(`/${TYPEDICT[type].controller}`, {url_addons});
        if (typehtml) {
            let $typepage = $.parseHTML(typehtml);
            TYPEDICT[type].insert($typepage, type);
            $section.find('.el-found-notice').show();
        } else {
            $section.find('.el-error-notice').show();
        }
    }
    if (TYPEDICT[type].process) {
        TYPEDICT[type].process();
    }
    $section.show();
    $('#el-event-notice').show();
    return true;
}

function FinalizeEventNotice(initial = false) {
    let thumb_promise = Promise.resolve(null);
    if (EL.post_ids.size) {
        thumb_promise = GetThumbnails();
    }
    thumb_promise.then(() => {
        InsertThumbnails();
        if (!initial) {
            $("#el-read-event-notice").removeClass("el-read");
            $('#el-read-event-notice').off(PROGRAM_CLICK).one(PROGRAM_CLICK, ReadEventNotice);
        } else {
            $("#el-event-controls").show();
            $("#el-loading-message").hide();
        }
        if (AnyRenderedEvents()) {
            localStorage['el-saved-notice'] = LZString.compressToUTF16($("#el-event-notice").html());
            JSPLib.storage.setLocalData('el-rendered-list', EL.renderedlist);
            JSPLib.concurrency.setRecheckTimeout('el-saved-timeout', EL.timeout_expires);
        }
    });
}

async function CheckAllEvents(promise_array) {
    let hasevents_all = await Promise.all(promise_array);
    let hasevents = hasevents_all.some((val) => val);
    ProcessThumbnails();
    if (hasevents) {
        FinalizeEventNotice(true);
    } else if (EL.item_overflow && EL.overflow_only_notice_enabled) {
        //Don't save the notice when only overflow notice, since that prevents further network gets
        $("#el-event-controls").show();
        $("#el-loading-message").hide();
    } else {
        JSPLib.storage.removeLocalData('el-rendered-list');
        JSPLib.storage.removeLocalData('el-saved-notice');
    }
    JSPLib.storage.setLocalData('el-overflow', EL.item_overflow);
    EL.dmail_promise.resolve(null);
    return hasevents;
}

function ProcessAllEvents(func) {
    CalculateOverflow();
    let promise_array = [];
    POST_QUERY_EVENTS.forEach((inputtype) => {
        promise_array.push(ProcessEvent(inputtype, 'post_query_events_enabled'));
    });
    SUBSCRIBE_EVENTS.forEach((inputtype) => {
        promise_array.push(ProcessEvent(inputtype, 'all_subscribe_events'));
    });
    OTHER_EVENTS.forEach((inputtype) => {
        promise_array.push(ProcessEvent(inputtype, 'other_events_enabled'));
    });
    CheckAllEvents(promise_array).then((hasevents) => {
        func(hasevents);
    });
}

function MarkAllAsRead() {
    Object.keys(localStorage).forEach((key) => {
        let match = key.match(/el-(ot|pq)?-?saved(\S+)list/);
        if (match) {
            JSPLib.storage.removeLocalData(key);
            return;
        }
        match = key.match(/el-(ot|pq)?-?saved(\S+)lastid/);
        if (!match) {
            return;
        }
        let savedlastid = JSPLib.storage.getLocalData(key, {default_val: null});
        JSPLib.storage.removeLocalData(key);
        if (!JSPLib.validate.validateID(savedlastid)) {
            this.debug('log', key, "is not a valid ID!", savedlastid);
            return;
        }
        SaveLastID(match[2], savedlastid, match[1]);
    });
    JSPLib.storage.removeLocalData('el-rendered-list');
    JSPLib.storage.removeLocalData('el-saved-notice');
    SetLastSeenTime();
    EL.dmail_promise.resolve(null);
}

function EventStatusCheck() {
    let disabled_events = JSPLib.utility.arrayDifference(POST_QUERY_EVENTS, EL.post_query_events_enabled);
    disabled_events.forEach((type) => {
        //Delete every associated value but the list
        JSPLib.storage.removeLocalData(`el-pq-${type}lastid`);
        JSPLib.storage.removeLocalData(`el-pq-saved${type}lastid`);
    });
    disabled_events = JSPLib.utility.arrayDifference(ALL_SUBSCRIBES, EL.all_subscribe_events);
    EL.subscribe_events_enabled.forEach((inputtype) => {
        if (!EL.show_creator_events && !CheckList(inputtype) && !CheckUserList(inputtype)) {
            disabled_events.push(inputtype);
        }
    });
    disabled_events.forEach((type) => {
        //Delete every associated value but the list
        JSPLib.storage.removeLocalData(`el-${type}lastid`);
        JSPLib.storage.removeLocalData(`el-saved${type}lastid`);
        JSPLib.storage.removeLocalData(`el-${type}overflow`);
    });
    disabled_events = JSPLib.utility.arrayDifference(OTHER_EVENTS, EL.other_events_enabled);
    disabled_events.forEach((type) => {
        //Delete every associated value but the list
        JSPLib.storage.removeLocalData(`el-ot-${type}lastid`);
        JSPLib.storage.removeLocalData(`el-ot-saved${type}lastid`);
    });
}

//Settings functions

function BroadcastEL(ev) {
    var menuid;
    this.debug('log', `(${ev.data.type}):`, ev.data);
    switch (ev.data.type) {
        case 'hide':
            if (!EL.locked_notice) {
                $('#el-event-notice').hide();
            }
            JSPLib.notice.closeNotice();
            break;
        case 'subscribe':
            EL.subscribeset[ev.data.eventtype] = ev.data.eventset;
            UpdateMultiLink([ev.data.eventtype], ev.data.was_subscribed, ev.data.itemid);
            break;
        case 'subscribe_user':
            EL.userset[ev.data.eventtype] = ev.data.eventset;
            UpdateMultiLink([ev.data.eventtype], ev.data.was_subscribed, ev.data.userid);
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

function GetPostFilterTags() {
    return new Set(EL.filter_post_edits.trim().split(/\s+/));
}

function InitializeProgramValues() {
    Object.assign(EL, {
        username: Danbooru.CurrentUser.data('name'),
        userid: Danbooru.CurrentUser.data('id'),
    });
    if (EL.username === 'Anonymous') {
        this.debug('log', "User must log in!");
        return false;
    }
    if (!JSPLib.validate.isString(EL.username) || !JSPLib.validate.validateID(EL.userid)) {
        this.debug('log', "Invalid meta variables!");
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
        locked_notice: EL.autolock_notices,
        post_filter_tags: GetPostFilterTags(),
        recheck: JSPLib.concurrency.checkTimeout('el-event-timeout', EL.timeout_expires),
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
    $('#el-subscribe-event-settings').append(JSPLib.menu.renderInputSelectors('subscribe_events_enabled', 'checkbox'));
    $('#el-subscribe-event-settings').append(JSPLib.menu.renderCheckbox('show_creator_events'));
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
    $('#el-search-query-get').on(PROGRAM_CLICK, PostEventPopulateControl);
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
    this.debug('log', "Initialize start:", JSPLib.utility.getProgramTime());
    const preload = {
        run_on_settings: true,
        default_data: DEFAULT_VALUES,
        initialize_func: InitializeProgramValues,
        broadcast_func: BroadcastEL,
        menu_css: MENU_CSS,
    };
    if (!JSPLib.menu.preloadScript(EL, RenderSettingsMenu, preload)) return;
    JSPLib.notice.installBanner(PROGRAM_SHORTCUT);
    EventStatusCheck();
    if (!document.hidden && localStorage['el-saved-notice'] !== undefined && !JSPLib.concurrency.checkTimeout('el-saved-timeout', EL.timeout_expires)) {
        EL.renderedlist = JSPLib.storage.getLocalData('el-rendered-list', {default_val: {}}); //Add a validation check to this
        let notice_html = LZString.decompressFromUTF16(localStorage['el-saved-notice']);
        InitializeNoticeBox(notice_html);
        for (let type in TYPEDICT) {
            let $section = $(`#el-${type}-section`);
            if($section.children().length) {
                TYPEDICT[type].open?.($section);
                TYPEDICT[type].process?.();
            }
        }
        $("#el-event-notice").show();
        let any_blacklisted = document.querySelector("#el-event-notice .blacklisted");
        if (any_blacklisted) {
            new MutationObserver((_, observer) => {
                $('#el-event-notice .blacklisted-active').removeClass('blacklisted-active');
                observer.disconnect();
            }).observe(any_blacklisted, {
                attributes: true,
                attributefilter: ['class']
            });
        }
    } else if (!document.hidden && (EL.not_snoozed || WasOverflow()) && JSPLib.concurrency.reserveSemaphore(PROGRAM_SHORTCUT)) {
        EL.renderedlist = {};
        InitializeNoticeBox();
        if (CheckAbsence()) {
            $("#el-loading-message").show();
            EL.events_checked = true;
            ProcessAllEvents((hasevents) => {
                SetLastSeenTime();
                JSPLib.concurrency.freeSemaphore(PROGRAM_SHORTCUT);
                if (hasevents) {
                    JSPLib.notice.notice("<b>EventListener:</b> Events are ready for viewing!", true);
                    $("#el-event-controls").show();
                    $("#el-loading-message").hide();
                } else if (EL.item_overflow && EL.not_snoozed && EL.overflow_only_notice_enabled) {
                    JSPLib.notice.notice("<b>EventListener:</b> No events found, but more can be queried...", true);
                } else {
                    JSPLib.concurrency.setRecheckTimeout('el-event-timeout', EL.timeout_expires);
                }
            });
        } else {
            $('#el-absent-section').html(ABSENT_NOTICE).show();
            $('#el-update-all').one(PROGRAM_CLICK, UpdateAll);
            if (EL.days_absent > MAX_ABSENCE) {
                $('#el-absent-section').append(EXCESSIVE_NOTICE);
                $('#el-reset-all').one(PROGRAM_CLICK, ResetAll);
            }
            $('#el-days-absent').html(EL.days_absent);
            $('#el-absent-section').append(DISMISS_NOTICE);
            $('#el-dismiss-notice button').one(PROGRAM_CLICK, DismissNotice);
            $('#el-event-notice').show();
            JSPLib.concurrency.freeSemaphore(PROGRAM_SHORTCUT);
        }
    } else {
        this.debug('log', "Waiting...");
        EL.dmail_promise.resolve(null);
    }
    $(document).on(PROGRAM_CLICK, '#el-subscribe-events a', SubscribeMultiLink);
    $(document).on(PROGRAM_CLICK, '.el-overflow-notice a', LoadMore);
    if (EL.controller === 'posts' && EL.action === 'show') {
        InitializePostShowMenu();
    } else if (EL.controller === 'forum-topics' && EL.action === 'show') {
        InitializeTopicShowMenu();
    } else if (['wiki-pages', 'wiki-page-versions'].includes(EL.controller)) {
        InitializeWikiShowMenu();
    } else if (EL.controller === 'artists' && EL.action === 'show') {
        InitializeArtistShowMenu();
    } else if (EL.controller === 'pool' && EL.action === 'show') {
        InitializePoolShowMenu();
    } else if (EL.controller === 'users' && EL.action === 'show') {
        InitializeUserShowMenu();
    }
    if (EL.hide_dmail_notice) {
        if (EL.events_checked) HideDmailNotice();
    } else {
        EL.dmail_promise.promise.then(() => {
            EL.dmail_notice.show();
        });
    }
    JSPLib.utility.setCSSStyle(PROGRAM_CSS, 'program');
}

/****Function decoration****/

[
    Main, BroadcastEL, CheckSubscribeType, MarkAllAsRead, ProcessEvent, SaveLastID, CorrectList,
    CheckPostQueryType, CheckOtherType, ReloadEventNotice,
] = JSPLib.debug.addFunctionLogs([
    Main, BroadcastEL, CheckSubscribeType, MarkAllAsRead, ProcessEvent, SaveLastID, CorrectList,
    CheckPostQueryType, CheckOtherType, ReloadEventNotice,
]);

[
    RenderSettingsMenu, SetList, SetUserList,
    GetThumbnails, CheckAllEvents, PostEventPopulateControl,
    CheckPostQueryType, CheckSubscribeType, CheckOtherType, SetRecentDanbooruID,
] = JSPLib.debug.addFunctionTimers([
    //Sync
    RenderSettingsMenu,
    [SetList, 0],
    [SetUserList, 0],
    //Async
    GetThumbnails, CheckAllEvents, PostEventPopulateControl,
    [CheckPostQueryType, 0],
    [CheckSubscribeType, 0],
    [CheckOtherType, 0],
    [SetRecentDanbooruID, 0, 1]
]);

/****Initialization****/

//Variables for debug.js
JSPLib.debug.debug_console = false;
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
JSPLib.load.exportData(PROGRAM_NAME, EL);
JSPLib.load.exportFuncs(PROGRAM_NAME, {debuglist: [GetList, SetList]});

//Variables for storage.js
JSPLib.storage.localSessionValidator = ValidateProgramData;

/****Execution start****/

JSPLib.load.programInitialize(Main, {program_name: PROGRAM_NAME, required_variables: PROGRAM_LOAD_REQUIRED_VARIABLES, required_selectors: PROGRAM_LOAD_REQUIRED_SELECTORS});
