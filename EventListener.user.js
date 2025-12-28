// ==UserScript==
// @name         EventListener
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      25.11
// @description  Informs users of new events.
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @exclude      /^https?://\w+\.donmai\.us/.*\.(xml|json|atom)(\?|$)/
// @grant        none
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/EventListener.user.js
// @updateURL    https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/EventListener.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.13.1/validate.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251218/lib/module.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251218/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251218/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251218/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251218/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251218/lib/notice.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251218/lib/concurrency.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251218/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251218/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251218/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251218/lib/menu.js
// ==/UserScript==

/* global JSPLib $ Danbooru */

/****Library updates****/

////NONE

/****Global variables****/

//Exterior script variables
const DANBOORU_TOPIC_ID = '14747';
const SERVER_USER_ID = 502584;

//Variables for load.js
const PROGRAM_LOAD_REQUIRED_VARIABLES = ['window.jQuery', 'window.Danbooru', 'Danbooru.CurrentUser'];
const PROGRAM_LOAD_REQUIRED_SELECTORS = ['#nav', '#page'];

//Program name constants
const PROGRAM_SHORTCUT = 'el';
const PROGRAM_NAME = 'EventListener';

//Main program variable
const EL = {};

//Event types
const SUBSCRIBE_EVENTS = ['comment', 'note', 'commentary', 'post', 'approval', 'flag', 'appeal', 'forum', 'wiki', 'pool', 'artist'];
const USER_EVENTS = ['comment', 'note', 'commentary', 'post', 'approval', 'appeal', 'forum', 'wiki', 'pool', 'artist'];
const ALL_SUBSCRIBES = JSPLib.utility.arrayUnion(SUBSCRIBE_EVENTS, USER_EVENTS);
const POST_QUERY_EVENTS = ['comment', 'note', 'commentary', 'post', 'approval', 'flag', 'appeal'];
const OTHER_EVENTS = ['dmail', 'ban', 'feedback', 'mod_action'];
const ALL_EVENTS = JSPLib.utility.arrayUnique(JSPLib.utility.multiConcat(POST_QUERY_EVENTS, SUBSCRIBE_EVENTS, OTHER_EVENTS));
const ALL_SOURCES = ['subscribe', 'post-query', 'other'];

//For factory reset
const SOURCE_SUFFIXES = ['last-id', 'overflow', 'event-timeout', 'last-checked', 'last-seen', 'last-found'];
const TYPE_KEYS = ALL_EVENTS.map((type) => [`el-${type}-saved-events`]);
const SOURCE_KEYS = JSPLib.utility.multiConcat(
    SUBSCRIBE_EVENTS.map((type) => SOURCE_SUFFIXES.map((suffix) => `el-${type}-subscribe-${suffix}`)).flat(),
    POST_QUERY_EVENTS.map((type) => SOURCE_SUFFIXES.map((suffix) => `el-${type}-post-query-${suffix}`)).flat(),
    OTHER_EVENTS.map((type) => SOURCE_SUFFIXES.map((suffix) => `el-${type}-other-${suffix}`)).flat(),
);
const SUBSCRIBE_KEYS = SUBSCRIBE_EVENTS.map((type) => ([`el-${type}-item-list`, `el-${type}-user-list`])).flat();
const OTHER_KEYS = ['el-show-subscribe-links', 'el-new-events-notice', 'el-event-notice-shown'];
const LOCALSTORAGE_KEYS = JSPLib.utility.multiConcat(TYPE_KEYS, SOURCE_KEYS, SUBSCRIBE_KEYS, OTHER_KEYS);

//Available setting values
const SUBSCRIBE_ENABLE_EVENTS = ['comment', 'note', 'commentary', 'forum'];
const USER_ENABLE_EVENTS = [];
const POST_QUERY_ENABLE_EVENTS = [];
const OTHER_ENABLE_EVENTS = ['dmail'];
const MODACTION_EVENTS = [
    'user_delete', 'user_undelete', 'user_ban', 'user_unban', 'user_name_change', 'user_level_change', 'user_approval_privilege', 'user_upload_privilege', 'user_ban_update',
    'user_feedback_update', 'user_feedback_delete',
    'post_delete', 'post_undelete', 'post_ban', 'post_unban', 'post_permanent_delete', 'post_move_favorites', 'post_regenerate', 'post_regenerate_iqdb',
    'post_note_lock_create', 'post_note_lock_delete',
    'post_rating_lock_create', 'post_rating_lock_delete',
    'post_vote_delete', 'post_vote_undelete',
    'pool_delete', 'pool_undelete',
    'media_asset_delete', 'media_asset_expunge',
    'artist_ban', 'artist_unban',
    'comment_update', 'comment_delete',
    'comment_vote_delete', 'comment_vote_undelete',
    'forum_topic_delete', 'forum_topic_undelete', 'forum_topic_lock',
    'forum_post_update', 'forum_post_delete',
    'moderation_report_handled', 'moderation_report_rejected',
    'tag_alias_create', 'tag_alias_update', 'tag_alias_delete',
    'tag_implication_create', 'tag_implication_update', 'tag_implication_delete',
    'tag_deprecate', 'tag_undeprecate',
    'ip_ban_create', 'ip_ban_delete', 'ip_ban_undelete',
    'news_update_create', 'news_update_update', 'news_update_delete', 'news_update_undelete',
    'site_credential_create', 'site_credential_delete', 'site_credential_enable', 'site_credential_disable',
    'email_address_update', 'backup_code_send',
];

//Main settings
const SETTINGS_CONFIG = {
    display_event_notice: {
        reset: true,
        validate: JSPLib.utility.isBoolean,
        hint: "Will trigger a popup notice when there are new events."
    },
    display_event_panel: {
        reset: false,
        validate: JSPLib.utility.isBoolean,
        hint: "Will display a notice panel on new events, similar to the old version."
    },
    page_size: {
        reset: 20,
        parse: parseInt,
        validate: (data) => (JSPLib.utility.isInteger(data) && data >= 5 && data <= 200),
        hint: "The amount of items to display on each page of events (min 5, max 200)."
    },
    events_order: {
        allitems: ALL_EVENTS,
        reset: ALL_EVENTS,
        sortvalue: true,
        validate: (data) => JSPLib.utility.arrayEquals(data, ALL_EVENTS),
        hint: "Set the order for how events appear on the home tab of the events page, as well as their placement in the tab list."
    },
    ascending_order: {
        reset: false,
        validate: JSPLib.utility.isBoolean,
        hint: "Changes the order of events: oldest -> newest."
    },
    filter_user_events: {
        reset: true,
        validate: JSPLib.utility.isBoolean,
        hint: "Only show events not created by the user."
    },
    show_creator_events: {
        reset: false,
        validate: JSPLib.utility.isBoolean,
        hint: "Show subscribe events regardless of subscribe status on the item's page when the creator is the user.<br>&emsp;<i>(See <b>Additional setting details</b> for more clarifying info)</i>."
    },
    show_parent_events: {
        reset: false,
        validate: JSPLib.utility.isBoolean,
        hint: "Show post events when a subscribed post is parented by another post."
    },
    filter_untranslated_commentary: {
        reset: true,
        validate: JSPLib.utility.isBoolean,
        hint: "Only show new commentary that has translated sections."
    },
    filter_autobans: {
        reset: true,
        validate: JSPLib.utility.isBoolean,
        hint: `Only show bans not created by <a class="user-moderator with-style" style="color:var(--user-moderator-color)" href="/users/${SERVER_USER_ID}">DanbooruBot</a>.`
    },
    filter_autofeedback: {
        reset: true,
        validate: JSPLib.utility.isBoolean,
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
        validate: JSPLib.utility.isBoolean,
        hint: `Only show edits not created by <a class="user-moderator with-style" style="color:var(--user-moderator-color)" href="/users/${SERVER_USER_ID}">DanbooruBot</a>.`
    },
    filter_users: {
        reset: "",
        parse: (input) => (JSPLib.utility.arrayUnique(input.split(/\s*,\s*/).map(Number).filter(JSPLib.utility.validateID))),
        validate: (input) => (JSPLib.utility.validateIDList(input)),
        hint: 'Enter a list of user IDs to filter (comma separated).'
    },
    recheck_interval: {
        reset: 60,
        parse: parseInt,
        validate: (data) => (Number.isInteger(data) && data >= 5),
        hint: "How often to check for new events (# of minutes, min 5)."
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
        reset: "",
        parse: String,
        validate: JSPLib.utility.isString,
        hint: 'Enter a post search query to check.'
    },
    appeal_query: {
        reset: "",
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
        hint: 'Enter a list of tags to check. See <a href="#el-post-query-event-settings-message">Additional setting details</a> for more info.'
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
        name: 'display',
    }, {
        name: 'network',
    }, {
        name: 'filter',
    }, {
        name: 'subscribe-event',
        message: "These events will not be checked unless there are one or more subscribed items, unless the <code>show_creator_events</code> setting is enabled, or if a user is subscribed. (see <b>User event settings</b>)",
    }, {
        name: 'user-event',
        message: "These events will not be checked unless there are one or more subscribed users, unless an item is subscribed. (see <b>Subscibe event settings</b>)",
    }, {
        name: 'post-query-event',
        message: "These events can be searched with a post query. A blank query line will return all events. See <a href=\"/wiki_pages/help:cheatsheet\">Help:Cheatsheet</a> for more info.",
    }, {
        name: 'other-event',
        message: "Except for some exceptions noted below, all events of this type are shown.",
    }],
    controls: [],
};

// Default values

const DEFAULT_VALUES = {
    events_page_open: false,
    item_set: {},
    user_set: {},
    open_list: {},
    page_events: {},
    pages: {},
    observed: {},
};

//CSS Constants

const SUBSCRIBED_COLOR = 'mediumseagreen';
const UNSUBSCRIBED_COLOR = 'darkorange';
const NEW_EVENTS_COLOR = 'var(--green-4)';
const NEW_EVENTS_DARK = 'var(--green-6)';
const NEW_EVENTS_BORDER = `1px solid ${NEW_EVENTS_DARK}`;

const PROGRAM_CSS = `
/**GENERAL**/
.el-monospace {
    font-family: monospace;
}
.el-link {
    cursor: pointer;
}
.el-link-disabled {
    color: var(--text-color);
    pointer-events: none;
}
.el-loading {
    font-size: 24px;
    font-weight: bold;
}
/**NAVIGATION**/
#el-nav-events.el-has-new-events {
    color: red;
}
#el-display-subscribe {
    font-weight: bold;
}
#el-display-subscribe a {
    font-weight: normal;
}
#el-display-subscribe a[data-action="show"] {
    color: green;
}
#el-display-subscribe a[data-action="hide"] {
    color: red;
}
/**EVENT PAGE**/
#el-page {
    margin-left: 2.5em;
    margin-top: 2em;
}
#el-header {
    display: flex;
}
#el-body {
    min-height: calc(100vh - 6em);
}
.el-event-body {
    margin: 1em;
}
.el-event-header {
    padding: 8px;
    background-color: var(--form-button-background);
    border: 1px solid var(--form-button-border-color);
    font-weight: bold;
    font-size: 20px;
    white-space: nowrap;
    margin: 0 2px 2px 0;
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
.el-event-header.el-has-new-events {
    background-color: ${NEW_EVENTS_COLOR};
    border: ${NEW_EVENTS_BORDER};
}
.el-event-header.el-has-new-events a {
    color: white;
}
.el-event-header.el-header-active {
    background-color: var(--blue-4) !important;
    border-color: var(--blue-6) !important;
}
.el-event-header.el-header-active:hover {
    background-color: var(--blue-3) !important;
}
.el-event-header.el-header-active a {
    color: white;
}
/**HOME**/
.el-event-body[data-type="home"] {
    display: flex;
    flex-wrap: wrap;
    overflow-y: auto;
    height: calc(100vh - 7.5em);
    border: 1px solid var(--default-border-color);
}
.el-home-section {
    width: 25em;
    height: 32em;
    padding: 1em 2em;
}
.el-home-section h4 {
    padding: 2px;
}
.el-home-section.el-has-new-events h4 {
    color: var(--body-background-color);
    background-color: ${NEW_EVENTS_COLOR};
}
.el-section-controls {
    list-style-type: none !important;
    margin-bottom: 5px !important;
}
.el-section-controls > div {
    display: grid;
    grid-template-columns: 50% 50%;
}
.el-section-link a {
    text-align: center;
    padding: 4px 6px;
    display: block;
    border: 1px solid var(--text-color);
    border-radius: 25px;
    width: 90%;
    height: 90%;
    margin: 4px 0;
    font-weight: bold;
}
.el-section-link a:hover {
    background-color: var(--default-border-color);
}
.el-more {
    color: blue;
    font-weight: bold;
}
.el-none {
    color: red;
}
.el-check-more a,
.el-check-all a {
    color: mediumseagreen;
}
.el-reset-event a {
    color: red;
}
.el-refresh-event a {
    color: mediumpurple;
}
/**BODY HEADER**/
.el-body-header {
    margin-bottom: 1em;
    font-size: 16px;
}
.el-body-page-info {
    margin-bottom: 1em;
}
.el-body-controls {
    font-weight: bold;
}
/**BODY SECTION**/
.el-mark-read > a {
    display: flex;
    border: 1px solid #888;
    border-radius: 5px;
    background-color: var(--default-border-color);
    height: 30px;
    width: 30px;
    justify-content: center;
    align-items: center;
}
.el-mark-read > a:hover {
    background-color: var(--muted-text-color);
}
.el-new-event .el-mark-read > a {
    background-color: ${NEW_EVENTS_COLOR};
    border: ${NEW_EVENTS_BORDER};
}
.el-new-event .el-mark-read > a:hover {
    background-color: ${NEW_EVENTS_DARK}
}
div.el-found-with.el-comment-column,
td.el-found-with {
    color: orange;
}
/**TABLE**/
.el-floating-header {
     display: flex;
     background: var(--body-background-color);
     position: absolute;
     top: 0;
     font-weight: bold;
     border-bottom: 2px solid var(--table-header-border-color);
     box-shadow: 0px 1px var(--body-background-color);
     z-index: 10;
}
.el-floating-cell {
    padding: 4px 6px;
}
.el-table-pane {
    height: calc(100vh - 13em);
    overflow-y: auto;
}
.el-table-container {
    position: relative;
}
/**COMMENT**/
.el-comments-header {
    display: flex;
    font-weight: bold;
    gap: 1rem;
}
.el-comments-header > div {
    text-decoration: underline;
}
.el-comments-header > div > span {
    font-size: 18px;
}
.el-comments-header .el-found-with {
    text-align: center;
}
.el-comments-header .el-comments-column {
    padding-left: 2.5em;
}
.el-comments-body {
    height: calc(100vh - 15em);
    overflow-y: auto;
}
.el-comments-body .el-found-width {
    padding-left: 0.5em;
}
.el-event-body[data-type="comment"] .el-mark-read {
    width: 5em;
}
.el-event-body[data-type="comment"] .el-found-with {
    width: 10em;
}
.el-event-body[data-type="comment"] .el-comments-body .el-comment-column {
    display: flex;
    justify-content: center;
}
.el-event-notice-section[data-type="comment"] .post {
    border-bottom: 1px solid var(--default-border-color);
    padding: 5px 0;
}
/**POST**/
.el-event-body[data-type="post"] td.tags-column,
.el-event-body[data-type="post"] td.edits-column {
    width: 35%;
}
/**POOL**/
.el-pool-posts {
    display: flex;
    flex-wrap: wrap;
}
.el-add-pool-posts {
    background-color: rgba(0, 255, 0, 0.2);
}
.el-rem-pool-posts {
    background-color: rgba(255, 0, 0, 0.2);
}
.el-pool-posts .post-preview {
    margin: 5px;
    padding: 5px;
    border: 1px solid var(--dtext-blockquote-border-color);
}
/**WIKI**/
.el-event-body[data-type="wiki"] ul.wiki-other-names-diff-list li.added {
    background: var(--wiki-page-versions-diff-ins-background);
}
.el-event-body[data-type="wiki"] ul.wiki-other-names-diff-list li.removed {
    background: var(--wiki-page-versions-diff-del-background);
}
/**DMAIL**/
.el-event-body[data-type="dmail"] tr[data-is-read="false"] {
    font-weight: bold;
}
.el-event-body[data-type="dmail"] tr[data-is-deleted="true"],
.el-event-body[data-type="dmail"] tr[data-is-deleted="true"] a {
    text-decoration: line-through;
}
/**SUBSCRIBE LINKS**/
#el-subscribe-events {
    padding-left: 2em;
    font-weight: bold;
}
#el-subscribe-events .el-subscribed a {
    color: ${SUBSCRIBED_COLOR};
}
#el-subscribe-events .el-unsubscribed a {
    color: ${UNSUBSCRIBED_COLOR};
}
#el-subscribe-events .el-subscribed a:hover,
#el-subscribe-events .el-unsubscribed a:hover {
    filter: brightness(1.5);
}
/**NOTICE PANEL**/
#el-event-notice {
    padding: 5px;
}
.el-event-notice-section {
    margin: 1em 0;
    border-bottom: 2px solid grey;
}
#el-event-controls {
    font-size: 20px;
    margin-top: 1em;
}
#el-read-event-notice {
    font-weight: bold;
    color: red;
}
/**OTHER**/
div#el-notice {
    top: unset;
    bottom: 4em;
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

////Settings menu

const SUBSCRIBE_EVENT_SETTINGS_DETAILS = JSPLib.utility.normalizeHTML()`
<p>
When the&ensp;<code>show_creator_events</code>&ensp;setting is enabled, it will automatically show events for items (post, forum_topic) where the user is the creator, but only if
those events are also enabled under the&ensp;<code>subscribe_events_enabled</code>&ensp;setting. Meaning, events for that event type will be shown to the user whether they are&ensp;
<span style="color: ${SUBSCRIBED_COLOR}; font-weight: bold;">SUBSCRIBED</span>&ensp;or&ensp;<span style="color: ${UNSUBSCRIBED_COLOR}; font-weight: bold;">UNSUBSCRIBED</span>
&ensp;to an individual item (post, forum_topic) on the item's page.
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

const POST_QUERY_EVENT_SETTINGS_DETAILS = JSPLib.utility.normalizeHTML()`
<ul>
    <li><b>Edit query:</b>
        <ul>
            <li>Tags prepended with a "+" adds a search using&ensp;<code>added_tags_include_any</code>.</li>
            <li>Tags prepended with a "-" adds a search using&ensp;<code>removed_tags_include_any</code>.</li>
            <li>Tags prepended with a "~" adds a search using&ensp;<code>any_changed_tags</code>.</li>
            <li>Non-prepended tags adds a search using&ensp;<code>all_changed_tags</code>.</li>
            <li>See&ensp;<a href="/wiki_pages/api:post_versions">API:Post versions</a>&ensp;for search details.</li>
        </ul>
    </li>
</ul>`;

const OTHER_EVENT_SETTINGS_DETAILS = JSPLib.utility.normalizeHTML()`
<ul>
    <li><b>dmail:</b>&ensp;Unread, undeleted dmail.</li>
    <li><b>ban:</b>&ensp;None.</li>
    <li><b>feedback:</b>&ensp;No ban feedbacks.</li>
    <li><b>mod action:</b>&ensp;Specific categories must be subscribed.</li>
</ul>`;

const PROGRAM_DATA_DETAILS = JSPLib.utility.normalizeHTML()`
<p class="tn">All timestamps are in milliseconds since the epoch (<a href="https://www.epochconverter.com">Epoch converter</a>).</p>
<ul>
    <li>General data
        <ul>
            <li><b>process-semaphore-main:</b> Prevents two tabs from processing the same data at the same time.</li>
            <li><b>show-subscribe-links:</b> Whether to display subscribe links on available pages.</li>
            <li><b>new-events-notice:</b> Whether to show a new events notice to the user once a tab gets focus.</li>
            <li><b>event-notice-shown:</b> Whether the event notice is currently shown.</li>
            <li><b>user-settings:</b> All configurable settings.</li>
        </ul>
    </li>
    <li>Type data:&ensp;<code>TYPE</code>&ensp;is a placeholder for all available event types.&ensp;<code>SOURCE</code>&ensp;is a placeholder for the type of operation (subscribe, post-query, other).
        <ul>
            <li><b>TYPE-item-list:</b>&ensp;The list of all item IDs that are subscribed.</li>
            <li><b>TYPE-user-list:</b>&ensp;The list of all user IDs that are subscribed.</li>
            <li><b>TYPE-saved-events:</b>&ensp;The list of all available events.</li>
            <li><b>TYPE-SOURCE-last-id:</b>&ensp;Bookmark for the ID of the last seen event. This is where the script starts searching when it does a recheck.</li>
            <li><b>TYPE-SOURCE-overflow:</b>&ensp;Did this event reach the query limit last page load? Absence of this key indicates false. This controls whether or not and event will process at the next page refresh.</li>
            <li><b>TYPE-SOURCE-last-checked:</b>&ensp;When the userscript last did a check.</li>
            <li><b>TYPE-SOURCE-last-seen:</b>&ensp;Timestamp of the most recent item seen from Danbooru.</li>
            <li><b>TYPE-SOURCE-last-found:</b>&ensp;Timestamp of the last found item.</li>
            <li><b>TYPE-SOURCE-event-timeout:</b>&ensp;Timestamp of the next check.</li>
            <li><b>process-semaphore-TYPE-SOURCE:</b>&ensp;Prevents events from being checked during an ongoing manual check.</li>
        </ul>
    </li>
</ul>
<p><b>Note:</b>&ensp;The raw format of all data keys begins with "el-". which is unused by the cache editor controls.</p>`;

////Notice

const NOTICE_PANEL = JSPLib.utility.normalizeHTML()`
<div id="el-event-notice" class="notice notice-info">
    <div id="el-event-notice-pane">
    </div>
    <div id="el-event-controls">
        <a id="el-close-event-notice" class="el-link">Close this</a>
        &ensp;[&ensp;
        <a id="el-read-event-notice" class="el-link el-monospace" title="Mark all items as read.">READ</a>
        &ensp;]
    </div>
</div>`;

////Navigation

const EVENTS_NAV_HTML = JSPLib.utility.normalizeHTML()`
<a id="el-nav-events" class="el-link py-1.5 px-3">
    Events
    (&thinsp;
        <span id="el-events-total">...</span>
    &thinsp;)
</a>`;
const SUBSCRIBE_CONTROLS_HTML = JSPLib.utility.normalizeHTML()`
<span id="el-display-subscribe" class="py-1.5 px-3">
    Subscribe links
    [&thinsp;
        <a class="el-link el-monospace" data-action="show" style="display: none;">Show</a>
        <a class="el-link el-monospace" data-action="hide" style="display: none;">Hide</a>
    &thinsp;]
</span>`;

const MULTI_LINK_MENU_HTML = JSPLib.utility.normalizeHTML()`
<div id="el-subscribe-events" data-id="%ITEMID%" data-setting="%EVENTSETTING%" style="display: none;">
    Subscribe (&ensp;<span id="el-add-links"></span>&ensp;)
</div>`;

const SUBSCRIBE_MULTI_LINK_HTML = JSPLib.utility.normalizeHTML()`
<span class="el-multi-link %CLASSNAME%" data-type="%TYPELIST%">
    <a class="el-link" title="%TITLE%">%NAME%</a>
</span>`;

////Events page

const EVENTS_PAGE_HTML = JSPLib.utility.normalizeHTML()`
<div id="el-page" style="display: none;">
    <div id="el-header">%HEADER%</div>
    <div id="el-body">%BODY%</div>
</div>`;

const EVENT_HEADER_HTML = '<div class="el-event-header" data-type="%TYPE%"><a>%NAME%</a></div>';
const EVENT_BODY_HTML = '<div class="el-event-body" data-type="%TYPE%">%BODY%</div>';

////Home page

const HOME_SECTION_HTML = JSPLib.utility.normalizeHTML()`
<div class="el-home-section prose" data-type="%TYPE%">
    <h4>%TITLE%</h4>
    <ul>
        <li class="el-new-events"><b>New:</b>&ensp;<span></span></li>
        <li class="el-available-events"><b>Available:</b>&ensp;<span></span></li>
        %SUBSECTIONS%
    </ul>
</div>`;

const HOME_SUBSECTION_HTML = JSPLib.utility.normalizeHTML()`
<li class="el-last-found" data-source="%SOURCE%" title="Time of last item found.">
    <b>Last found:</b>&ensp;<span></span>
</li>
<li class="el-last-seen" data-source="%SOURCE%" title="Time of last item seen by check.">
    <b>Last seen:</b>&ensp;<span></span>
</li>
<li class="el-last-checked" data-source="%SOURCE%" title="Time last check occurred.">
    <b>Last checked:</b>&ensp;<span></span>
</li>
<li class="el-next-check" data-source="%SOURCE%" title="Time of next check.">
    <b>Next check:</b>&ensp;<span></span>
</li>
<li class="el-pages-left" data-source="%SOURCE%" title="How many pages left to check. Used as a counter for check more and check all.">
    <b>Pages left:</b>&ensp;(&thinsp;<span></span>&thinsp;)
</li>
<li class="el-section-controls">
    <div>
        <div class="el-check-more el-section-link" data-source="%SOURCE%" title="Check the same amount of events as a normal check.">
            <a class="el-link">Check more</a>
        </div>
        <div class="el-check-all el-section-link" data-source="%SOURCE%" title="Check all events until the latest is reached.">
            <a class="el-link">Check all</a>
        </div>
        <div class="el-reset-event el-section-link" data-source="%SOURCE%" title="Reset the event position to the latest item.">
            <a class="el-link">Reset</a>
        </div>
        <div class="el-refresh-event el-section-link" data-source="%SOURCE%" title="Refresh the time values.">
            <a class="el-link">Refresh</a>
        </div>
    </div>
</li>`;

const SUBSCRIBE_SUBSECTION_HTML = JSPLib.utility.normalizeHTML()`
<li><u>Subscribe</u>
    <ul>%s</ul>
</li>`;

const POST_QUERY_SUBSECTION_HTML = JSPLib.utility.normalizeHTML()`
<li><u>Post query</u>
    <ul>%s</ul>
</li>`;


const HOME_CONTROLS = JSPLib.utility.normalizeHTML()`
<div class="el-home-section prose" data-type="controls">
    <h4>Controls</h4>
    <div>
        <div class="el-check-all el-section-link" title="Check all events for all types.">
            <a class="el-link">Check all available</a>
        </div>
        <div class="el-reset-event el-section-link" title="Reset the event positions of all types.">
            <a class="el-link">Reset all</a>
        </div>
        <div class="el-refresh-event el-section-link" title="Refresh the time values of all types.">
            <a class="el-link">Refresh all</a>
        </div>
    </div>
</div>`;

const MORE_HTML = '<span class="el-more">more</span>';
const NONE_HTML = '<span class="el-none">none</span>';

////Event page

const EVENT_SECTION_HTML = JSPLib.utility.normalizeHTML()`
<div class="el-body-header">
    <div class="el-body-page-info">
        Showing events&ensp;<span class="el-first-event el-monospace"></span>&ensp;-&ensp;<span class="el-last-event el-monospace"></span>&ensp;of&ensp;<span class="el-total-events el-monospace">%TOTAL%</span>.&emsp;
        %PAGINATOR%
    </div>
    <div class="el-body-controls">
        <span class="el-select-links">
            Select [&ensp;
                <a class="el-select-all el-link" title="Select all on current page.">all</a>
                &ensp;|&ensp;
                <a class="el-select-none el-link" title="Select none on current page.">none</a>
                &ensp;|&ensp;
                <a class="el-select-invert el-link" title="Invert selection on current page.">invert</a>
            &ensp;]
        </span>&emsp;
        <span class="el-mark-read-links">
            Mark Read [&ensp;
                <a class="el-mark-selected el-link" title="Mark all selected items on page as read.">selected</a>
                %MARKPAGE%
                |&ensp;
                <a class="el-mark-all el-link" title="Mark all items across all pages as read.">all</a>
            &ensp;]
        </span>
    </div>
</div>
<div class="el-body-section" data-page="1">
</div>`;

const PAGINATOR_HTML = JSPLib.utility.normalizeHTML()`
<span class="el-paginator">
    <a class="el-paginator-prev el-link">&ltprev&gt</a>
    &ensp;|&ensp;
    <a class="el-paginator-next el-link">&ltnext&gt</a>
</span>`;

const MARK_PAGE_HTML = ' | <a class="el-mark-page el-link" title="Mark all items on page as read.">page</a>';

////Event table

const TABLE_HEADER_ADDONS_HTML = JSPLib.utility.normalizeHTML()`
<th class="el-mark-read" width="2%"></th>
<th class="el-found-with" width="8%">Found with</th>`;
const TABLE_HEADER_PREVIEW_HTML = '<th width="1%">Preview</th>';

const TABLE_BODY_ADDONS_HTML = JSPLib.utility.normalizeHTML()`
<td class="el-mark-read">
    <a>
        <input type="checkbox">
    </a>
</td>
<td class="el-found-with">
    %s
</td>`;
const TABLE_BODY_PREVIEW_HTML = '<td class="el-post-preview"></td>';


////Open item

const OPEN_ITEM_CONTAINER_HTML = JSPLib.utility.normalizeHTML()`
<tr class="el-full-item" data-type="%TYPE%" data-id="%ITEMID%">
    <td colspan="%COLUMNS%"><span class="el-loading">Loading...</span></td>
</tr>`;

const OPEN_ITEM_LINKS_HTML = JSPLib.utility.normalizeHTML()`
<span class="el-show-hide-links" data-type="%TYPE%" data-id="%ITEMID%">
    <span data-action="show" style><a class="el-link el-monospace">%SHOWTEXT%</a></span>
    <span data-action="hide" style="display:none !important"><a class="el-link el-monospace">%HIDETEXT%</a></span>
</span>`;

////Error page

const ERROR_PAGE_HTML = JSPLib.utility.normalizeHTML()`
<div style="font-size: 24px;">
    <div style="color: red; font-weight: bold;">
        ERROR LOADING EVENTS FOR %PLURAL%!
    </div>
    <div style="margin-top: 0.5em;">
        Visit the following page to view these events manually:&ensp;<a class="el-events-page-url" href="%PAGEURL%" target="_blank">*PAGE LINK*</a>
    </div>
    <div style="margin-top: 0.5em;">
        Or you can click the following to try reloading the page:&ensp;<a class="el-events-reload el-link">*RELOAD PAGE*</a>
    </div>
    <div style="margin-top: 2em;">
        Click the following link to clear the page when finished:&ensp;<a class="el-mark-page-read el-link">*MARK PAGE*</a>
    </div>
</div>`;

//Time constants

const TIMER_POLL_INTERVAL = 100; //Polling interval for checking program status
const JQUERY_DELAY = 1; //For jQuery updates that should not be done synchronously
const NONSYNCHRONOUS_DELAY = 1; //For operations too costly in events to do synchronously
const MIN_JITTER = JSPLib.utility.one_minute;
const MAX_JITTER = JSPLib.utility.one_minute * 10;

//Network constants

const QUERY_LIMIT = 100; //The max number of items to grab with each network call

//Other constants

const ALL_POST_EVENTS = ['post', 'approval', 'flag', 'appeal', 'comment', 'note', 'commentary'];
const ALL_TRANSLATE_EVENTS = ['note', 'commentary'];

//Type configurations

const TYPEDICT = {
    flag: {
        controller: 'post_flags',
        json_addons: {search: {category: 'normal'}},
        user: 'creator_id',
        creator: ['post', 'uploader_id'],
        item: 'post_id',
        timeval: 'created_at',
        only: 'id,created_at,creator_id,post_id',
        limit: 2,
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
        timeval: 'created_at',
        only: 'id,created_at,creator_id,post_id',
        limit: 2,
        find_events: FindEvents,
        insert_events: InsertTableEvents,
        plural: 'appeals',
        display: "Appeals",
        includes: 'post[uploader_id]',
    },
    dmail: {
        controller: 'dmails',
        json_addons: {search: {is_deleted: false}},
        timeval: 'created_at',
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
        json_addons: {group_by: 'comment', search: {is_deleted: false}},
        html_addons: {group_by: 'comment'},
        user: 'creator_id',
        creator: ['post', 'uploader_id'],
        item: 'post_id',
        timeval: 'created_at',
        only: 'id,created_at,creator_id,post_id',
        limit: 2,
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
        timeval: 'created_at',
        only: 'id,created_at,creator_id,topic_id',
        limit: 2,
        find_events: FindEvents,
        insert_events: InsertTableEvents,
        insert_postprocess: ForumPostprocess,
        plural: 'forums',
        display: "Forums",
        includes: 'topic[creator_id]',
    },
    note: {
        controller: 'note_versions',
        html_addons: {type: 'previous'},
        user: 'updater_id',
        creator: ['post', 'uploader_id'],
        item: 'post_id',
        timeval: 'created_at',
        only: 'id,created_at,updater_id,post_id',
        limit: 2,
        find_events: FindEvents,
        insert_events: InsertTableEvents,
        add_thumbnail: true,
        plural: 'notes',
        display: "Notes",
        includes: 'post[uploader_id]',
    },
    commentary: {
        controller: 'artist_commentary_versions',
        html_addons: {type: 'previous'},
        user: 'updater_id',
        creator: ['post', 'uploader_id'],
        item: 'post_id',
        timeval: 'created_at',
        only: 'id,created_at,updater_id,post_id,translated_title,translated_description',
        limit: 5,
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
        html_addons: {type: 'previous'},
        get json_addons() {
            let addons = {search: {is_new: false}};
            if (EL.filter_BUR_edits) {
                addons.search.updater_id_not_eq = SERVER_USER_ID;
            }
            return addons;
        },
        user: 'updater_id',
        creator: ['post', 'uploader_id'],
        item: 'post_id',
        timeval: 'updated_at',
        only: 'id,updated_at,updater_id,post_id,added_tags,removed_tags,parent_changed,unchanged_tags',
        limit: 2,
        find_events: FindEvents,
        other_filter: IsShownPostEdit,
        insert_events: InsertTableEvents,
        insert_postprocess: PostEditPostprocess,
        column_widths: {
            'tags-column': '35%',
            'edits-column': '35%',
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
        timeval: 'created_at',
        only: 'id,created_at,user_id,post_id',
        limit: 5,
        find_events: FindEvents,
        insert_events: InsertTableEvents,
        plural: 'approvals',
        display: "Approval",
        includes: 'post[uploader_id]',
    },
    wiki: {
        controller: 'wiki_page_versions',
        html_addons: {type: 'previous'},
        user: 'updater_id',
        item: 'wiki_page_id',
        timeval: 'created_at',
        only: 'id,created_at,updater_id,wiki_page_id',
        limit: 2,
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
        html_addons: {type: 'previous'},
        user: 'updater_id',
        item: 'artist_id',
        timeval: 'created_at',
        only: 'id,created_at,updater_id,artist_id',
        limit: 2,
        find_events: FindEvents,
        insert_events: InsertTableEvents,
        plural: 'artists',
        display: "Artists",
    },
    pool: {
        controller: 'pool_versions',
        html_addons: {type: 'previous'},
        user: 'updater_id',
        item: 'pool_id',
        timeval: 'updated_at',
        only: 'id,updated_at,updater_id,pool_id',
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
        timeval: 'created_at',
        only: 'id,created_at,creator_id,body',
        find_events: FindEvents,
        other_filter: IsShownFeedback,
        insert_events: InsertTableEvents,
        plural: 'feedbacks',
    },
    ban: {
        controller: 'bans',
        user: 'banner_id',
        timeval: 'created_at',
        only: 'id,created_at,banner_id',
        find_events: FindEvents,
        other_filter: IsShownBan,
        insert_events: InsertTableEvents,
        plural: 'bans',
    },
    mod_action: {
        controller: 'mod_actions',
        get json_addons() {
            return {search: {category: EL.subscribed_mod_actions.join(',')}};
        },
        timeval: 'created_at',
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
    'el-show-subscribe-links',
    'el-new-events-notice',
    'el-event-notice-shown',
    'el-migration-25.0',
    `el-${TYPE_GROUPING}-${SOURCE_GROUPING}-overflow`,
].join('|'));
const TIME_SETTING_REGEX = RegExp([
    'el-process-semaphore-main',
    `el-process-semaphore-${TYPE_GROUPING}-${SOURCE_GROUPING}`,
    `el-${TYPE_GROUPING}-${SOURCE_GROUPING}-last-seen`,
    `el-${TYPE_GROUPING}-${SOURCE_GROUPING}-last-found`,
    `el-${TYPE_GROUPING}-${SOURCE_GROUPING}-last-checked`,
    `el-${TYPE_GROUPING}-${SOURCE_GROUPING}-event-timeout`,
].join('|'));
const ID_SETTING_REGEX = RegExp(`el-${TYPE_GROUPING}-${SOURCE_GROUPING}-last-id`);
const ID_LIST_SETTING_REGEX = RegExp(`el-${SUBSCRIBE_GROUPING}-(?:item|user)-list`);
const EVENTS_SETTING_REGEX = RegExp(`el-${TYPE_GROUPING}-saved-events`);

const VALIDATE_REGEXES = {
    setting: /el-user-settings/,
    bool: BOOL_SETTING_REGEX,
    time: TIME_SETTING_REGEX,
    id: ID_SETTING_REGEX,
    idlist: ID_LIST_SETTING_REGEX,
    events: EVENTS_SETTING_REGEX,
    notice: /el-new-events/,
};

const EVENT_CONSTRAINTS = {
    id: JSPLib.validate.id_constraints,
    match: JSPLib.validate.array_constraints,
    seen: JSPLib.validate.boolean_constraints,
};

const KNOWN_MATCHES = ['subscribe', 'user', 'creator', 'post-query', 'other', 'category'];

/****Functions****/

//Validate functions

function ValidateProgramData(key, entry) {
    var error_messages = [];
    let validate_type = GetValidateType(key);
    switch (validate_type) {
        case 'setting':
            error_messages = JSPLib.menu.validateUserSettings(entry);
            break;
        case 'bool':
            if (!JSPLib.utility.isBoolean(entry)) {
                error_messages = ["Value is not a boolean."];
            }
            break;
        case 'time':
            if (!JSPLib.utility.isInteger(entry)) {
                error_messages = ["Value is not an integer."];
            } else if (entry < 0) {
                error_messages = ["Value is not greater than or equal to zero."];
            }
            break;
        case 'id':
            if (!JSPLib.utility.validateID(entry)) {
                error_messages = ["Value is not a valid ID."];
            }
            break;
        case 'idlist':
            if (!JSPLib.utility.validateIDList(entry)) {
                error_messages = ["Value is not a valid ID list."];
            }
            break;
        case 'notice':
            error_messages = ValidateNotice(key, entry);
            break;
        case 'events':
            error_messages = ValidateEvents(key, entry);
            break;
        default:
            error_messages = ["Not a valid program data key."];
    }
    if (error_messages.length) {
        JSPLib.validate.outputValidateError(key, error_messages);
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

function ValidateNotice(key, entry) {
    if (!JSPLib.utility.isHash(entry)) {
        return [`${key} is not a hash.`];
    }
    let messages = [];
    for (let type in entry) {
        if (!JSPLib.utility.validateIDList(entry[type])) {
            messages.push([`${key}.${type} is not a valid ID list.`]);
        }
    }
    return messages;
}

function ValidateEvents(key, events) {
    if (!Array.isArray(events)) {
        return [`${key} is not an array.`];
    }
    let messages = [];
    for (let i = 0; i < events.length; i++) {
        let event = events[i];
        if (!JSPLib.utility.isHash(event)) {
            messages.push(`${key}[${i}] is not a hash.`);
            continue;
        }
        if (!JSPLib.validate.validateHashEntries(key, event, EVENT_CONSTRAINTS)) {
            messages.push(`${key}[${i}] is not formatted correctly.`);
            continue;
        }
        let unknown_matches = JSPLib.utility.arrayDifference(event.match, KNOWN_MATCHES);
        if (unknown_matches.length) {
            messages.push(`Invalid matches in ${key}[${i}].match:`, unknown_matches);
        }
    }
    return messages;
}

function CorrectEvents(key, events) {
    const printer = JSPLib.debug.getFunctionPrint('CorrectEvents');
    let valid_events = [];
    if (!Array.isArray(events)) {
        JSPLib.storage.removeLocalData(key);
        printer.debugwarn(`${key} is not an array.`);
        return true;
    }
    let is_dirty = false;
    for (let i = 0; i < events.length; i++) {
        let event = events[i];
        if (!JSPLib.utility.isHash(event)) {
            printer.debugwarn(`${key}[${i}] is not a hash.`);
            continue;
        }
        if (!JSPLib.validate.validateHashEntries(key, event, EVENT_CONSTRAINTS)) {
            printer.debugwarn(`${key}[${i}] is not formatted correctly.`);
            continue;
        }
        let unknown_matches = JSPLib.utility.arrayDifference(event.match, KNOWN_MATCHES);
        if (unknown_matches.length) {
            printer.debuglog(`Removing invalid matches from ${key}[${i}].match:`, unknown_matches);
            event.match = JSPLib.utility.arrayIntersection(event.match, KNOWN_MATCHES);
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
    const printer = JSPLib.debug.getFunctionPrint('CorrectList');
    let error_messages = [];
    if (!JSPLib.utility.validateIDList(typelist[type])) {
        error_messages.push([`Corrupted data on ${type} list!`]);
        let oldlist = JSPLib.utility.dataCopy(typelist[type]);
        typelist[type] = (Array.isArray(typelist[type]) ? typelist[type].filter((id) => JSPLib.utility.validateID(id)) : []);
        JSPLib.debug.debugExecute(() => {
            let validation_error = (Array.isArray(oldlist) ? JSPLib.utility.arrayDifference(oldlist, typelist[type]) : typelist[type]);
            error_messages.push(["Validation error:", validation_error]);
        });
    }
    if (error_messages.length) {
        error_messages.forEach((error) => {printer.debugwarn(...error);});
        return true;
    }
    return false;
}

//Helper functions

async function PromiseHashAll(promise_hash) {
    let promise_array = [];
    for (let type in promise_hash) {
        for (let source in promise_hash[type]) {
            promise_array.push(promise_hash[type][source]);
        }
    }
    let results = await Promise.all(promise_array);
    let results_hash = {};
    let index = 0;
    for (let type in promise_hash) {
        results_hash[type] = {};
        for (let source in promise_hash[type]) {
            results_hash[type][source] = results[index++];
        }
    }
    return results_hash;
}

function GetNewEventsHash(results_hash) {
    let new_events_hash = {};
    for (let type in results_hash) {
        let event_ids = [];
        for (let source in results_hash[type]) {
            let source_ids = JSPLib.utility.getObjectAttributes(results_hash[type][source], 'id');
            event_ids = JSPLib.utility.arrayUnion(event_ids, source_ids);
        }
        if (event_ids.length) {
            new_events_hash[type] = event_ids;
        }
    }
    return new_events_hash;
}

function GetPageValues(page) {
    let page_min = ((page - 1) * EL.page_size) + 1;
    let page_max = page * EL.page_size;
    return {page_min, page_max};
}

function GetPageEvents(type, page) {
    if (!EL.page_events[type]) {
        EL.page_events[type] = {};
        let events = GetEvents(type);
        let page = 1;
        while (true) {
            let {page_min, page_max} = GetPageValues(page);
            EL.page_events[type][page] = events.slice(page_min - 1, page_max);
            if (page_max >= events.length) break;
            page++;
        }
    }
    return EL.page_events[type][page];
}

function GetHTMLAddons(type, events) {
    let query_ids = JSPLib.utility.getObjectAttributes(events, 'id');
    let type_addon = TYPEDICT[type].html_addons ?? {};
    return JSPLib.utility.mergeHashes(type_addon, {search: {id: query_ids.join(','), order: 'custom'}, limit: query_ids.length});
}

function AnyEventEnabled(type) {
    return IsSubscribeEnabled(type) || IsPostQueryEnabled(type) || IsOtherEnabled(type);
}

function AreAnyEventsEnabled(event_list, event_setting) {
    return JSPLib.utility.arrayHasIntersection(event_list, EL.user_settings[event_setting]);
}

function AreAllEventsEnabled(event_list, event_setting) {
    return JSPLib.utility.isSubArray(EL.user_settings[event_setting], event_list);
}

function IsSubscribeEnabled(type) {
    return EL.all_subscribe_events.includes(type);
}

function IsItemSubscribeEnabled(type) {
    return EL.subscribe_events_enabled.includes(type);
}

function IsUserSubscribeEnabled(type) {
    return EL.user_events_enabled.includes(type);
}

function IsPostQueryEnabled(type) {
    return EL.post_query_events_enabled.includes(type);
}

function IsOtherEnabled(type) {
    return EL.other_events_enabled.includes(type);
}

function CheckSubscribeEnabled(type) {
    return EL.subscribe_events_enabled.includes(type) && (EL.show_creator_events || CheckItemList(type));
}

function CheckUserEnabled(type) {
    return EL.user_events_enabled.includes(type) && CheckUserList(type);
}

function CheckEventSemaphore(type, source) {
    return JSPLib.concurrency.checkSemaphore(`${type}-${source}`);
}

function ReserveEventSemaphore(type, source) {
    return JSPLib.concurrency.reserveSemaphore(`${type}-${source}`);
}

function FreeEventSemaphore(type, source) {
    return JSPLib.concurrency.freeSemaphore(`${type}-${source}`);
}

function CheckEventTimeout(type, source) {
    return JSPLib.concurrency.checkTimeout(`el-${type}-${source}-event-timeout`, EL.timeout_expires);
}

function GetTypeQuery(type) {
    return EL.user_settings[type + '_query'];
}

function GetCheckVars(event) {
    let $link = $(event.currentTarget).parent();
    let source = $link.data('source');
    let $container = $link.closest('.el-home-section');
    let type = $container.data('type');
    return {type, source};
}

function ClearPages(type) {
    delete EL.pages[type];
    if (!Array.isArray(EL.observed[type])) return;
    EL.observed[type].forEach((entry) => {
        if (entry.nodeName === 'TH') {
            EL.th_observer.unobserve(entry);
        } else {
            EL.thead_observer.unobserve(entry);
        }
    });
    delete EL.observed[type];
}

function UpdateHomeText(type, source, classname, text) {
    if (source) {
        $(`.el-home-section[data-type=${type}] ${classname}[data-source="${source}"] span`).html(text);
    } else {
        $(`.el-home-section[data-type=${type}] ${classname} span`).html(text);
    }
}

function UpdateTimestamps($obj) {
    $obj.find('time').each((_, entry) => {
        entry.innerText = JSPLib.utility.timeAgo(entry.dateTime);
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
    return obj;
}

function PostCustomQuery(query) {
    let parameters = {search: {}};
    let taglist = query.trim().split(/\s+/);
    let tag_changes = taglist.filter((tag) => !tag.match(/^[+~-]/));
    if (tag_changes.length) {
        parameters.search.all_changed_tags = tag_changes.join(' ');
    }
    let tag_adds = taglist.filter((tag) => tag.startsWith('+')).map((tag) => tag.slice(1));
    if (tag_adds.length) {
        parameters.search.added_tags_include_any = tag_adds.join(' ');
    }
    let tag_removes = taglist.filter((tag) => tag.startsWith('-')).map((tag) => tag.slice(1));
    if (tag_removes.length) {
        parameters.search.removed_tags_include_any = tag_removes.join(' ');
    }
    let tag_optional = taglist.filter((tag) => tag.startsWith('~')).map((tag) => tag.slice(1));
    if (tag_optional.length) {
        parameters.search.any_changed_tags = tag_optional.join(' ');
    }
    return (Object.keys(parameters.search).length > 0 ? parameters : {});
}

//Data functions

function GetEvents(type) {
    var events;
    let storage_key = `el-${type}-saved-events`;
    if (JSPLib.storage.inMemoryStorage(storage_key, localStorage)) {
        //It's already in memory, so it should be good with the current userscript version.
        events = JSPLib.storage.getLocalData(storage_key);
    } else {
        //Events on local storage need to be checked and corrected if possible.
        events = JSPLib.storage.getLocalData(storage_key, {default_val: []});
        if (CorrectEvents(storage_key, events)) {
            //Get the corrected events.
            events = JSPLib.storage.getLocalData(storage_key);
        }
    }
    if (EL.ascending_order) {
        events.reverse();
    }
    return events;
}

function SaveEvents(type, events) {
    events.sort((eva, evb) => evb.id - eva.id);
    JSPLib.storage.setLocalData(`el-${type}-saved-events`, events);
    UpdateEventType(type, {broadcast: true});
    UpdateNavigation({broadcast: true});
}

function GetItemList(type) {
    if (!IsItemSubscribeEnabled(type)) {
        return new Set();
    }
    if (EL.item_set[type]) {
        return EL.item_set[type];
    }
    EL.item_set[type] = JSPLib.storage.getLocalData(`el-${type}-item-list`, {default_val: []});
    if (CorrectList(type, EL.item_set)) {
        setTimeout(() => {
            JSPLib.storage.setLocalData(`el-${type}-item-list`, EL.item_set[type]);
        }, NONSYNCHRONOUS_DELAY);
    }
    EL.item_set[type] = new Set(EL.item_set[type]);
    return EL.item_set[type];
}

function SetItemList(type, remove_item, item_id) {
    if (!IsItemSubscribeEnabled(type)) return;
    let item_set = GetItemList(type);
    if (remove_item) {
        // eslint-disable-next-line dot-notation
        item_set.delete(item_id);
    } else {
        item_set.add(item_id);
    }
    JSPLib.storage.setLocalData(`el-${type}-item-list`, [...item_set]);
    EL.channel.postMessage({type: 'subscribe_item', event_type: type, was_subscribed: remove_item, item_id, event_set: item_set});
    EL.item_set[type] = item_set;
}

function GetUserList(type) {
    if (!IsUserSubscribeEnabled(type)) {
        return new Set();
    }
    if (EL.user_set[type]) {
        return EL.user_set[type];
    }
    EL.user_set[type] = JSPLib.storage.getLocalData(`el-${type}-user-list`, {default_val: []});
    if (CorrectList(type, EL.user_set)) {
        setTimeout(() => {
            JSPLib.storage.setLocalData(`el-${type}-user-list`, EL.user_set[type]);
        }, NONSYNCHRONOUS_DELAY);
    }
    EL.user_set[type] = new Set(EL.user_set[type]);
    return EL.user_set[type];
}

function SetUserList(type, remove_item, user_id) {
    if (!IsUserSubscribeEnabled(type)) return;
    let user_set = GetUserList(type);
    if (remove_item) {
        // eslint-disable-next-line dot-notation
        user_set.delete(user_id);
    } else {
        user_set.add(user_id);
    }
    JSPLib.storage.setLocalData(`el-${type}-user-list`, [...user_set]);
    EL.channel.postMessage({type: 'subscribe_user', event_type: type, was_subscribed: remove_item, user_id, event_set: user_set});
    EL.user_set[type] = user_set;
}

function CheckItemList(type) {
    let item_list = localStorage.getItem(`el-${type}-item-list`);
    return Boolean(item_list) && item_list.startsWith('[') && item_list.endsWith(']') && item_list !== '[]';
}

function CheckUserList(type) {
    let user_list = localStorage.getItem(`el-${type}-user-list`);
    return Boolean(user_list) && user_list.startsWith('[') && user_list.endsWith(']') && user_list !== '[]';
}

//Save functions

function SaveLastID(type, source, last_id) {
    const printer = JSPLib.debug.getFunctionPrint('SaveLastID');
    if (!JSPLib.utility.validateID(last_id)) {
        printer.debugwarnLevel("Last ID for", type, "is not valid!", last_id, JSPLib.debug.WARNING);
        return;
    }
    let storage_key = `el-${type}-${source}-last-id`;
    let previous_id = JSPLib.storage.checkLocalData(storage_key, {default_val: 1});
    last_id = Math.max(previous_id, last_id);
    JSPLib.storage.setLocalData(storage_key, last_id);
    printer.debuglogLevel(`Set last ${source} ${type} ID:`, last_id, JSPLib.debug.INFO);
}

async function SaveRecentDanbooruID(type, source) {
    let type_addon = TYPEDICT[type].json_addons ?? {};
    let url_addons = JSPLib.utility.mergeHashes(type_addon, {only: 'id,' + TYPEDICT[type].timeval, limit: 1});
    let items = await JSPLib.danbooru.submitRequest(TYPEDICT[type].controller, url_addons, {default_val: []});
    if (items.length) {
        JSPLib.storage.setLocalData(`el-${type}-${source}-overflow`, false);
        SaveLastID(type, source, JSPLib.danbooru.getNextPageID(items, true));
        SaveLastSeen(type, source, items);
        SaveEventRecheck(type, source);
    } else if (type === 'dmail') {
        SaveLastID(type, source, 1);
    }
}

function SaveLastChecked(type, source) {
    let last_checked = Date.now();
    JSPLib.storage.setLocalData(`el-${type}-${source}-last-checked`, last_checked);
}

function SaveLastSeen(type, source, items) {
    let last_item = items.toSorted((a, b) => b.id - a.id)[0];
    let last_seen = JSPLib.utility.toTimeStamp(last_item[TYPEDICT[type].timeval]);
    JSPLib.storage.setLocalData(`el-${type}-${source}-last-seen`, last_seen);
}

function SaveOverflow(type, source, network_data, batch_limit) {
    const printer = JSPLib.debug.getFunctionPrint('SaveOverflow');
    if (network_data.length === batch_limit) {
        printer.debuglogLevel(`${batch_limit} ${type} items on ${source} query; overflow detected!`, JSPLib.debug.INFO);
        JSPLib.storage.setLocalData(`el-${type}-${source}-overflow`, true);
    } else {
        JSPLib.storage.setLocalData(`el-${type}-${source}-overflow`, false);
    }
}

function SaveEventRecheck(type, source) {
    let overflow = JSPLib.storage.checkLocalData(`el-${type}-${source}-overflow`);
    if (!overflow) {
        let updated_timeout = JSPLib.concurrency.setRecheckTimeout(`el-${type}-${source}-event-timeout`, EL.timeout_expires, EL.timeout_jitter);
        let next_check = JSPLib.utility.timeFromNow(updated_timeout);
        UpdateHomeText(type, source, '.el-next-check', next_check);
    }
}

function SaveFoundEvents(type, source, found_events, all_data) {
    let saved_events = GetEvents(type);
    let updated_events = [];
    var last_found_event;
    var new_events = [];
    found_events.forEach((event) => {
        let saved_event = saved_events.find((ev) => ev.id === event.id);
        if (saved_event) {
            saved_event.match = JSPLib.utility.arrayUnion(saved_event.match, event.match);
            updated_events.push(saved_event);
        } else {
            updated_events.push(event);
            new_events.push(event);
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
    let last_timestamp = JSPLib.utility.toTimeStamp(last_record[TYPEDICT[type].timeval]);
    JSPLib.storage.setLocalData(`el-${type}-${source}-last-found`, last_timestamp);
    if (new_events.length) {
        delete EL.page_events[type];
    }
    return new_events;
}

function PruneSavedEvents(type, item_ids) {
    let events = GetEvents(type);
    let pruned_events = events.filter((ev) => !item_ids.includes(ev.id));
    SaveEvents(type, pruned_events);
    UpdateMarkReadLinks(type);
}

//Update functions

function UpdateSubscribeLinks() {
    let show_links = JSPLib.storage.checkLocalData('el-show-subscribe-links', {default_val: true});
    let [action, show] = (show_links ? ['show', 'hide'] : ['hide', 'show']);
    $('#el-subscribe-events')[action]();
    $('#el-display-subscribe a').hide();
    $(`#el-display-subscribe a[data-action=${show}]`).show();
}

function UpdateMultiLink(type_list, subscribed, item_id) {
    let type_set = new Set(type_list);
    let current_subscribed = new Set($('#el-subscribe-events .el-subscribed').map((_, entry) => entry.dataset.type.split(',')));
    let new_subscribed = (subscribed ? JSPLib.utility.setDifference(current_subscribed, type_set) : JSPLib.utility.setUnion(current_subscribed, type_set));
    $(`#el-subscribe-events[data-id="${item_id}"] .el-multi-link`).each((_, entry) => {
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

function UpdateNavigation({events_total = 0, has_new = false, broadcast = false} = {}) {
    const printer = JSPLib.debug.getFunctionPrint('UpdateNavigation');
    if (events_total === 0) {
        ALL_EVENTS.forEach((type) => {
            if (!AnyEventEnabled(type)) return;
            let events = GetEvents(type);
            events_total += events.length;
            let any_new = events.some((event) => !event.seen);
            has_new ||= any_new;
            printer.debuglogLevel(type, events.length, any_new, JSPLib.debug.DEBUG);
        });
    }
    $('#el-events-total').text(events_total);
    if (has_new) {
        $('#el-nav-events').addClass('el-has-new-events');
    } else {
        $('#el-nav-events').removeClass('el-has-new-events');
    }
    printer.debuglogLevel({has_new, events_total, broadcast}, JSPLib.debug.DEBUG);
    if (broadcast) {
        EL.channel.postMessage({type: 'update_navigation', event_data: {events_total, has_new}});
    }
}

function UpdateEventType(type, {saved_total = 0, new_total = 0, has_new = false, broadcast = false} = {}) {
    const printer = JSPLib.debug.getFunctionPrint('UpdateEventType');
    if (saved_total === 0) {
        let saved_events = GetEvents(type);
        let new_events = saved_events.filter((ev) => !ev.seen);
        saved_total = saved_events.length;
        new_total = new_events.length;
    }
    printer.debuglogLevel(type, {saved_total, new_total, has_new, broadcast}, JSPLib.debug.DEBUG);
    if ($('#el-page').length) {
        if (has_new) {
            if ($(`.el-event-header[data-type="${type}"]`).length === 0) {
                printer.debuglogLevel('Installing header/body for', type, JSPLib.debug.INFO);
                var $anchor_header;
                let target_index = EL.events_order.indexOf(type);
                $('.el-event-header').each((_, header) => {
                    let $header = $(header);
                    let type = $header.data('type');
                    let type_index = EL.events_order.indexOf(type);
                    if (type_index > target_index) {
                        $anchor_header = $header;
                        return false;
                    }
                });
                $anchor_header ??= $('.el-event-header[data-type="close"]');
                $anchor_header.before(RenderEventHeader(type));
                $('#el-body').append(RenderEventBody(type));
                $(`#el-page .el-event-header[data-type=${type}] a`).on(JSPLib.program_click, EventTab);
            } else {
                printer.debuglogLevel('Emptying body for', type, JSPLib.debug.INFO);
                $(`.el-event-body[data-type="${type}"]`).children().remove();
                $('.el-event-header[data-type="home"] a').trigger('click');
                ClearPages(type);
            }
        }
        UpdateHomeText(type, null, '.el-new-events', new_total);
        UpdateHomeText(type, null, '.el-available-events', saved_total);
        let $event_tab = $(`.el-event-header[data-type="${type}"]`);
        let $home_section = $(`.el-home-section[data-type="${type}"]`);
        if (new_total > 0) {
            $event_tab.addClass('el-has-new-events');
            $home_section.addClass('el-has-new-events');
        } else {
            $event_tab.removeClass('el-has-new-events');
            $home_section.removeClass('el-has-new-events');
        }
    }
    if (broadcast) {
        EL.channel.postMessage({type: 'update_type', event_type: type, event_data: {saved_total, new_total, has_new}});
    }
}

function UpdateEventSource(type, source, {last_found = null, last_seen = null, last_checked = null, event_timeout = null, overflow = null, broadcast = false} = {}) {
    const printer = JSPLib.debug.getFunctionPrint('UpdateEventSource');
    last_found ??= JSPLib.storage.checkLocalData(`el-${type}-${source}-last-found`);
    last_seen ??= JSPLib.storage.checkLocalData(`el-${type}-${source}-last-seen`);
    last_checked ??= JSPLib.storage.checkLocalData(`el-${type}-${source}-last-checked`);
    event_timeout ??= JSPLib.storage.checkLocalData(`el-${type}-${source}-event-timeout`);
    overflow ??= JSPLib.storage.checkLocalData(`el-${type}-${source}-overflow`, {default_val: false});
    printer.debuglogLevel(type, source, {last_found, last_seen, last_checked, event_timeout, overflow, broadcast}, JSPLib.debug.DEBUG);
    if ($('#el-page').length) {
        let found_ago = JSPLib.utility.timeAgo(last_found);
        let seen_ago = JSPLib.utility.timeAgo(last_seen);
        let checked_ago = JSPLib.utility.timeAgo(last_checked);
        let next_check = JSPLib.utility.timeFromNow(event_timeout);
        let counter_text = $(`.el-home-section[data-type=${type}] .el-pages-left[data-source="${source}"] span`).text();
        let pages_checked = (counter_text.length ? Number(counter_text) : null);
        if (!Number.isInteger(pages_checked)) {
            pages_checked = (overflow ? MORE_HTML : NONE_HTML);
        }
        UpdateHomeText(type, source, '.el-last-found', found_ago);
        UpdateHomeText(type, source, '.el-last-seen', seen_ago);
        UpdateHomeText(type, source, '.el-last-checked', checked_ago);
        UpdateHomeText(type, source, '.el-next-check', next_check);
        UpdateHomeText(type, source, '.el-pages-left', pages_checked);
    }
    if (broadcast) {
        EL.channel.postMessage({type: 'update_source', event_type: type, event_source: source, event_data: {last_found, last_seen, last_checked, event_timeout, overflow}});
    }
}

function UpdateSectionPage(type, page) {
    let events = GetPageEvents(type, page);
    let {page_min, page_max} = GetPageValues(page);
    let $body_header = $(`.el-event-body[data-type="${type}"] .el-body-header`);
    let first_event = JSPLib.utility.padNumber(page_min, 3);
    let last_index = events.length + page_min - 1;
    let last_event = JSPLib.utility.padNumber(Math.min(page_max, last_index), 3);
    if (page === 1) {
        $body_header.find('.el-paginator-prev').addClass('el-link-disabled');
    } else {
        $body_header.find('.el-paginator-prev').removeClass('el-link-disabled');
    }
    if (!EL.page_events[type][page + 1]) {
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

function UpdateFloatingTHEAD(thead, observed = false) {
    const printer = JSPLib.debug.getFunctionPrint('UpdateFloatingTHEAD');
    let $thead = $(thead);
    let $floating = $thead.closest('.el-body-section').find('.el-floating-header');
    let {width, height} = getComputedStyle($thead.get(0));
    if (observed) {
        printer.debuglogLevel("THEAD width change:", $floating.css('width'), '->', width, JSPLib.debug.DEBUG);
    }
    $floating.css({width, height});
}

function UpdateFloatingTH(th_entries, observed = false) {
    const printer = JSPLib.debug.getFunctionPrint('UpdateFloatingTH');
    for (let i = 0; i < th_entries.length; i++) {
        let $th = $(th_entries[i]);
        let index = $th.index();
        let $floating = $th.closest('.el-body-section').find('.el-floating-header').children().eq(index);
        let {width, height} = getComputedStyle($th.get(0));
        if (observed) {
            printer.debuglogLevel("TH width change:", $floating.css('width'), '->', width, JSPLib.debug.DEBUG);
        }
        $floating.css({width, height});
    }
}

function UpdatePostPreviews($obj) {
    $obj.find('.post-preview').each((_, entry) => {
        entry.style.setProperty('display', 'flex', 'important');
        entry.style.setProperty('visibility', 'visible', 'important');
        entry.style.setProperty('justify-content', 'center');
        entry.style.setProperty('width', '180px');
    });
}

function UpdateUserOnNewEvents(primary) {
    if (!EL.display_event_notice) return;
    if (document.hidden) {
        $(window).off('focus.el.new-events').one('focus.el.new-events', () => {
            let show_notice = JSPLib.storage.checkLocalData('el-new-events-notice', {default_val: false, bypass: true});
            if (show_notice) {
                TriggerEventsNotice();
            }
        });
        if (primary) {
            JSPLib.storage.setLocalData('el-new-events-notice', true);
            EL.channel.postMessage({type: 'new_events'});
        }
    } else {
        TriggerEventsNotice();
    }
}

function TriggerEventsNotice() {
    JSPLib.notice.notice("<b>EventListener:</b> New events available.", {permanent: true});
    JSPLib.storage.setLocalData('el-new-events-notice', false);
    JSPLib.storage.setLocalData('el-event-notice-shown', true);
}

function CloseEventsNotice() {
    let event_notice_shown = JSPLib.storage.checkLocalData('el-event-notice-shown', {default_val: false, bypass: true});
    if (event_notice_shown) {
        $('#el-close-notice-link').trigger('click');
        JSPLib.storage.setLocalData('el-event-notice-shown', false);
        EL.channel.postMessage({type: 'close_notice'});
    }
}

function UpdateAfterCheck(type, source, new_events) {
    UpdateEventSource(type, source, {broadcast: true});
    if (new_events.length) {
        UpdateEventType(type, {has_new: true, broadcast: true});
        UpdateNavigation({broadcast: true});
    }
}

//Render functions

function RenderMultilinkMenu(item_id, event_setting) {
    return JSPLib.utility.regexReplace(MULTI_LINK_MENU_HTML, {
        ITEMID: item_id,
        EVENTSETTING: event_setting,
    });
}

function RenderSubscribeMultiLink(name, type_list, item_id, event_setting) {
    let subscribe_func = (event_setting === 'subscribe_events_enabled' ? GetItemList : GetUserList);
    let is_subscribed = type_list.every((type) => (subscribe_func(type).has(item_id)));
    let class_name = (is_subscribed ? 'el-subscribed' : 'el-unsubscribed');
    let title = (is_subscribed ? 'subscribed' : 'unsubscribed');
    return JSPLib.utility.regexReplace(SUBSCRIBE_MULTI_LINK_HTML, {
        CLASSNAME: class_name,
        TITLE: title,
        NAME: name,
        TYPELIST: type_list,
    });
}

function RenderOpenItemContainer(type, item_id, columns) {
    return JSPLib.utility.regexReplace(OPEN_ITEM_CONTAINER_HTML, {
        TYPE: type,
        ITEMID: item_id,
        COLUMNS: columns,
    });
}

function RenderOpenItemLinks(type, item_id, show_text = "Show", hide_text = "Hide") {
    return JSPLib.utility.regexReplace(OPEN_ITEM_LINKS_HTML, {
        TYPE: type,
        ITEMID: item_id,
        SHOWTEXT: show_text,
        HIDETEXT: hide_text,
    });
}

function RenderEventsPage() {
    let home_body = RenderEventsHome();
    let header_html = RenderEventHeader('home');
    let body_html = RenderEventBody('home', home_body);
    EL.events_order.forEach((type) => {
        if (!AnyEventEnabled(type)) return;
        let available_events = GetEvents(type);
        if (available_events.length) {
            header_html += RenderEventHeader(type);
            body_html += RenderEventBody(type);
        }
    });
    header_html += RenderEventHeader('close');
    return JSPLib.utility.regexReplace(EVENTS_PAGE_HTML, {
        HEADER: header_html,
        BODY: body_html,
    });
}

function RenderEventHeader(type) {
    let title = JSPLib.utility.displayCase(type);
    return JSPLib.utility.regexReplace(EVENT_HEADER_HTML, {TYPE: type, NAME: title});
}

function RenderEventBody(type, body = "") {
    return JSPLib.utility.regexReplace(EVENT_BODY_HTML, {TYPE: type, BODY: body});
}

function RenderEventsHome() {
    let body_html = HOME_CONTROLS;
    EL.events_order.forEach((type) => {
        if (!AnyEventEnabled(type)) return;
        body_html += RenderHomeSection(type);
    });
    return body_html;
}

function RenderHomeSection(type) {
    let section_html = "";
    if (IsSubscribeEnabled(type)) {
        let subsection_html = RenderHomeSubsection('subscribe');
        section_html += (POST_QUERY_EVENTS.includes(type) ? JSPLib.utility.sprintf(SUBSCRIBE_SUBSECTION_HTML, subsection_html) : subsection_html);
    }
    if (IsPostQueryEnabled(type)) {
        let subsection_html = RenderHomeSubsection('post-query');
        section_html += JSPLib.utility.sprintf(POST_QUERY_SUBSECTION_HTML, subsection_html);
    }
    if (IsOtherEnabled(type)) {
        section_html += RenderHomeSubsection('other');
    }
    let title = JSPLib.utility.displayCase(type);
    return JSPLib.utility.regexReplace(HOME_SECTION_HTML, {
        TYPE: type,
        TITLE: title,
        SUBSECTIONS: section_html,
    });
}

function RenderHomeSubsection(source) {
    return JSPLib.utility.regexReplace(HOME_SUBSECTION_HTML, {SOURCE: source});
}

//Initialize functions

function InitializeUserShowMenu() {
    //#C-USERS #A-SHOW
    if (!AreAnyEventsEnabled(USER_EVENTS, 'user_events_enabled')) return false;
    let user_id = $(document.body).data('user-id');
    let $menu_obj = $.parseHTML(RenderMultilinkMenu(user_id, 'user_events_enabled'));
    let menu_links = [];
    USER_EVENTS.forEach((type) => {
        if (!IsUserSubscribeEnabled(type)) return;
        menu_links.push(RenderSubscribeMultiLink(TYPEDICT[type].display, [type], user_id, 'user_events_enabled'));
    });
    if (AreAllEventsEnabled(ALL_TRANSLATE_EVENTS, 'user_events_enabled')) {
        menu_links.push(RenderSubscribeMultiLink("Translations", ALL_TRANSLATE_EVENTS, user_id, 'user_events_enabled'));
    }
    let enabled_user_events = JSPLib.utility.arrayIntersection(USER_EVENTS, EL.user_events_enabled);
    if (enabled_user_events.length > 1) {
        menu_links.push(RenderSubscribeMultiLink("All", enabled_user_events, user_id, 'user_events_enabled'));
    }
    $('#el-add-links', $menu_obj).append(menu_links.join(' | '));
    $('#nav').append($menu_obj);
    return true;
}

function InitializePostShowMenu() {
    //#C-POSTS #A-SHOW
    if (!AreAnyEventsEnabled(ALL_POST_EVENTS, 'subscribe_events_enabled')) return false;
    let post_id = $('.image-container').data('id');
    let $menu_obj = $.parseHTML(RenderMultilinkMenu(post_id, 'subscribe_events_enabled'));
    let menu_links = [];
    ALL_POST_EVENTS.forEach((type) => {
        if (!IsItemSubscribeEnabled(type)) return;
        menu_links.push(RenderSubscribeMultiLink(TYPEDICT[type].display, [type], post_id, 'subscribe_events_enabled'));
    });
    if (AreAllEventsEnabled(ALL_TRANSLATE_EVENTS, 'subscribe_events_enabled')) {
        menu_links.push(RenderSubscribeMultiLink("Translations", ALL_TRANSLATE_EVENTS, post_id, 'subscribe_events_enabled'));
    }
    let enabled_post_events = JSPLib.utility.arrayIntersection(ALL_POST_EVENTS, EL.subscribe_events_enabled);
    if (enabled_post_events.length > 1) {
        menu_links.push(RenderSubscribeMultiLink("All", enabled_post_events, post_id, 'subscribe_events_enabled'));
    }
    $('#el-add-links', $menu_obj).append(menu_links.join(' | '));
    $('#nav').append($menu_obj);
    return true;
}

function InitializeTopicShowMenu() {
    //#C-FORUM-TOPICS #A-SHOW
    if (!IsItemSubscribeEnabled('forum')) return false;
    let topic_id = $('body').data('forum-topic-id');
    let $menu_obj = $.parseHTML(RenderMultilinkMenu(topic_id, 'subscribe_events_enabled'));
    $('#el-add-links', $menu_obj).append(RenderSubscribeMultiLink("Topic", ['forum'], topic_id, 'subscribe_events_enabled'));
    $('#nav').append($menu_obj);
    return true;
}

function InitializeWikiShowMenu() {
    //#C-WIKI-PAGES #A-SHOW / #C-WIKI-PAGE-VERSIONS #A-SHOW
    if (!IsItemSubscribeEnabled('wiki')) return false;
    let data_selector = (EL.controller === 'wiki-pages' ? 'wiki-page-id' : 'wiki-page-version-wiki-page-id');
    let wiki_id = $('body').data(data_selector);
    let $menu_obj = $.parseHTML(RenderMultilinkMenu(wiki_id, 'subscribe_events_enabled'));
    $('#el-add-links', $menu_obj).append(RenderSubscribeMultiLink("Wiki", ['wiki'], wiki_id, 'subscribe_events_enabled'));
    $('#nav').append($menu_obj);
    return true;
}

function InitializeArtistShowMenu() {
    //#C-ARTISTS #A-SHOW
    if (!IsItemSubscribeEnabled('artist')) return false;
    let artist_id = $('body').data('artist-id');
    let $menu_obj = $.parseHTML(RenderMultilinkMenu(artist_id, 'subscribe_events_enabled'));
    $('#el-add-links', $menu_obj).append(RenderSubscribeMultiLink("Artist", ['artist'], artist_id, 'subscribe_events_enabled'));
    $('#nav').append($menu_obj);
    return true;
}

function InitializePoolShowMenu() {
    //#C-POOLS #A-SHOW
    if (!IsItemSubscribeEnabled('pool')) return false;
    let pool_id = $('body').data('pool-id');
    let $menu_obj = $.parseHTML(RenderMultilinkMenu(pool_id, 'subscribe_events_enabled'));
    $('#el-add-links', $menu_obj).append(RenderSubscribeMultiLink("Pool", ['pool'], pool_id, 'subscribe_events_enabled'));
    $('#nav').append($menu_obj);
    return true;
}

function InstallSubscribeLinks() {
    if (EL.action !== 'show') return;
    var show_submenu;
    switch (EL.controller) {
        case 'posts':
            show_submenu = InitializePostShowMenu();
            break;
        case 'forum-topics':
            show_submenu = InitializeTopicShowMenu();
            break;
        case 'wiki-pages':
        case 'wiki-page-versions':
            show_submenu = InitializeWikiShowMenu();
            break;
        case 'artists':
            show_submenu = InitializeArtistShowMenu();
            break;
        case 'pools':
            show_submenu = InitializePoolShowMenu();
            break;
        case 'users':
            show_submenu = InitializeUserShowMenu();
            //falls through
        default:
            //do nothing
    }
    if (show_submenu) {
        $('#subnav-menu').append(SUBSCRIBE_CONTROLS_HTML);
        $('#el-display-subscribe a').on(JSPLib.program_click, ToggleSubscribeLinks);
        UpdateSubscribeLinks();
        $('#el-subscribe-events a').on(JSPLib.program_click, SubscribeMultiLink);
    }
}

function InstallNoticePanel(new_events_hash) {
    if (!EL.display_event_panel) return;
    $('#top').after(NOTICE_PANEL);
    EL.events_order.forEach((type) => {
        if ((!(type in new_events_hash)) || (new_events_hash[type].length === 0)) return;
        let $event_section = $(`<div class="el-event-notice-section" data-type="${type}"></div>`);
        $('#el-event-notice-pane').append($event_section);
        let saved_events = GetEvents(type);
        let new_events = saved_events.filter((ev) => new_events_hash[type].includes(ev.id));
        $event_section.append(`<span class="el-loading">Loading ${TYPEDICT[type].plural}...</span>`);
        GetHTMLPage(type, new_events).then(($page) => {
            $event_section.children().remove();
            if ($page) {
                let $events = (type === 'comment' ? $('.list-of-comments', $page) : $('table.striped', $page));
                $event_section.append($events);
                if (type === 'comment') {
                    $events.find('.post-preview').each((_, entry) => {
                        entry.style.setProperty('display', 'flex', 'important');
                        entry.style.setProperty('visibility', 'visible', 'important');
                    });
                } else {
                    UpdatePostPreviews($events);
                }
            } else {
                let plural = TYPEDICT[type].plural.toUpperCase();
                $event_section.append(`<div style="font-size: 24px;">ERROR LOADING EVENTS FOR ${plural}</div>`);
            }
        });
        new_events.forEach((ev) => {ev.seen = true;});
        SaveEvents(type, saved_events);
    });
    EL.new_events = new_events_hash;
    $('#el-close-event-notice').one(JSPLib.program_click, CloseEventPanel);
    $('#el-read-event-notice').one(JSPLib.program_click, ReadEventPanel);
    JSPLib.storage.setLocalData('el-new-events', new_events_hash);
}

function InstallEventsNavigation() {
    $('#nav-more').before(EVENTS_NAV_HTML);
    $('#el-nav-events').on(JSPLib.program_click, OpenEventsPage);
    UpdateNavigation();
}

function LoadEventsPage() {
    $('#page').after(RenderEventsPage());
    ALL_EVENTS.forEach((type) => {
        if (!AnyEventEnabled(type)) return;
        UpdateEventType(type);
        if (IsSubscribeEnabled(type)) {
            UpdateEventSource(type, 'subscribe');
        }
        if (IsPostQueryEnabled(type)) {
            UpdateEventSource(type, 'post-query');
        }
        if (IsOtherEnabled(type)) {
            UpdateEventSource(type, 'other');
        }
    });
    $('#el-page .el-event-header a').on(JSPLib.program_click, EventTab);
    $('#el-page .el-check-more a').on(JSPLib.program_click, CheckMore);
    $('#el-page .el-check-all a').on(JSPLib.program_click, CheckAll);
    $('#el-page .el-reset-event a').on(JSPLib.program_click, ResetEvent);
    $('#el-page .el-refresh-event a').on(JSPLib.program_click, RefreshEvent);
}

function LoadEventSection(type) {
    let $body = $(`.el-event-body[data-type=${type}]`);
    if ($body.children().length > 0) return;
    let events = GetEvents(type);
    let body_html = JSPLib.utility.regexReplace(EVENT_SECTION_HTML, {
        TOTAL: JSPLib.utility.padNumber(events.length, 3),
        MARKPAGE: (events.length > EL.page_size ? MARK_PAGE_HTML : ""),
        PAGINATOR: (events.length > EL.page_size ? PAGINATOR_HTML : ""),
    });
    $body.append(body_html);
    $body.find('.el-paginator-prev').on(JSPLib.program_click, PaginatorPrevious);
    $body.find('.el-paginator-next').on(JSPLib.program_click, PaginatorNext);
    $body.find('.el-select-all').on(JSPLib.program_click, SelectAll);
    $body.find('.el-select-none').on(JSPLib.program_click, SelectNone);
    $body.find('.el-select-invert').on(JSPLib.program_click, SelectInvert);
    $body.find('.el-mark-selected').on(JSPLib.program_click, MarkSelected);
    $body.find('.el-mark-page').on(JSPLib.program_click, MarkPage);
    $body.find('.el-mark-all').on(JSPLib.program_click, MarkAll);
    UpdateSectionPage(type, 1);
}

function AppendFloatingHeader(type, $container, $table) {
    // Must wait until the table is attached to the dom before measuring the header, otherwise the height/width will be null.
    // Additionally, must wait for any asynchronously added post previews, since those affect the column widths.
    let header_html = "";
    EL.observed[type] ??= [];
    $table.find('thead th').each((_, th) => {
        let classname = th.className ?? "";
        header_html += `<div class="el-floating-cell ${classname}">${th.innerText}</div>`;
        EL.th_observer.observe(th);
        EL.observed[type].push(th);
    });
    let $header = $(`<div class="el-floating-header">${header_html}</div>`);
    $container.append($header);
    UpdateFloatingTHEAD($table.find('thead').get(0));
    UpdateFloatingTH([...$table.find('th')]);
    let thead = $table.find('thead').get(0);
    EL.thead_observer.observe(thead);
    EL.observed[type].push(thead);
}

function InstallErrorPage(type, page) {
    let $body_section = $(`.el-event-body[data-type="${type}"] .el-body-section`);
    let events = GetEvents(type);
    let page_events = GetPageEvents(type, page);
    let url_addons = GetHTMLAddons(type, page_events);
    let error_html = JSPLib.utility.regexReplace(ERROR_PAGE_HTML, {
        PLURAL: TYPEDICT[type].plural.toUpperCase(),
        PAGEURL: '/' + TYPEDICT[type].controller + '?' + $.param(url_addons),
    });
    $body_section.html(error_html);
    $body_section.find('.el-events-page-url').one(JSPLib.program_click, () => {
        page_events.forEach((page_ev) => {
            let event = events.find((ev) => ev.id === page_ev.id);
            event.seen = true;
        });
        SaveEvents(type, events);
    });
    $body_section.find('.el-events-reload').one(JSPLib.program_click, () => {
        UpdateSectionPage(type, page);
    });
    let $mark_page = $body_section.find('.el-mark-page-read');
    $mark_page.one(JSPLib.program_click, () => {
        let selected_ids = JSPLib.utility.getObjectAttributes(page_events, 'id');
        PruneSavedEvents(type, selected_ids);
        $mark_page.addClass('el-link-disabled');
        JSPLib.notice.notice("Page marked as read.");
    });
}

function SetupMenuAutocomplete() {
    const printer = JSPLib.debug.getFunctionPrint('SetupAutocomplete');
    let selector = '#el-setting-filter-post-edits,' + JSPLib.utility.joinList(POST_QUERY_EVENTS, '#el-setting-', '-query', ',');
    JSPLib.load.scriptWaitExecute(EL, 'IAC', {
        available: () => {
            EL.IAC.InitializeTagQueryAutocompleteIndexed(selector, null);
            printer.debuglogLevel(`Initialized IAC autocomplete on ${selector}.`, JSPLib.debug.DEBUG);
        },
        fallback: () => {
            JSPLib.utility.setDataAttribute($(selector), 'autocomplete', 'tag-query');
            $(selector).autocomplete({
                select (_event, ui) {
                    Danbooru.Autocomplete.insert_completion(this, ui.item.value);
                    return false;
                },
                async source(_req, resp) {
                    let term = Danbooru.Autocomplete.current_term(this.element);
                    let results = await Danbooru.Autocomplete.autocomplete_source(term, "tag_query");
                    resp(results);
                },
            });
            printer.debuglogLevel(`Initialized Danbooru autocomplete on ${selector}.`, JSPLib.debug.DEBUG);
        },
    });
}

//Filter functions

function FindEvents(array, source, subscribe_set, user_set) {
    const printer = JSPLib.debug.getFunctionPrint('FindData');
    let found_events = [];
    for (let i = 0; i < array.length; i++) {
        let val = array[i];
        if (!Number.isInteger(val.id)) {
            continue;
        }
        if ((EL.filter_user_events && this.user && (val[this.user] === EL.user_id)) || EL.filter_users.includes(val[this.user])) {
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
            if (EL.show_creator_events && this.creator && JSPLib.utility.getNestedAttribute(val, this.creator) === EL.user_id) {
                printer.debuglogLevel('creator_event', this.controller, val, JSPLib.debug.DEBUG);
                item.match.push('creator');
            }
            if (EL.show_parent_events && this.controller === 'post_versions') {
                if (EL.show_creator_events && val.post.parent?.uploader_id === EL.user_id) {
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
            item.match.push(source);
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
    && (val.body.match(/^Banned \d+ (days?|weeks?|months?|years?):/) === null)
    && (val.body.match(/^You have been (promoted|demoted) to a \S+ level account from \S+\./) === null)
    && (val.body.match(/^Lost approval privileges/) === null);
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
        let page_events = GetPageEvents(type, page);
        $body_section.html('<span class="el-loading">Loading...</span>');
        let $page = await GetHTMLPage(type, page_events);
        if ($page) {
            let $table = $('table.striped', $page);
            let table_header = TABLE_HEADER_ADDONS_HTML;
            table_header += (TYPEDICT[type].add_thumbnail ? TABLE_HEADER_PREVIEW_HTML : "");
            $table.find('thead tr').prepend(table_header);
            let post_ids = new Set();
            let save_events = false;
            $table.find('tbody tr').each((_, row) => {
                let $row = $(row);
                let id = $row.data('id');
                let event = events.find((ev) => ev.id === id);
                let match_html = event.match.map((m) => m.replace('-', ' ')).join('&ensp;&amp;<br>');
                let row_addon = JSPLib.utility.sprintf(TABLE_BODY_ADDONS_HTML, match_html);
                if (TYPEDICT[type].add_thumbnail) {
                    let post_id = $row.data('post-id');
                    post_ids.add(post_id);
                    row_addon += TABLE_BODY_PREVIEW_HTML;
                }
                $row.prepend(row_addon);
                if (!event.seen) {
                    $row.addClass('el-new-event');
                    save_events = event.seen = true;
                }
            });
            if (save_events) {
                SaveEvents(type, events);
            }
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
            $table.find('.el-mark-read > a').on(JSPLib.program_click, SelectEvent);
            EL.pages[type][page] = $container;
            $body_section.empty().append($container);
            AppendFloatingHeader(type, $container, $table);
        } else {
            InstallErrorPage(type, page);
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
        let page_events = GetPageEvents('comment', page);
        let $page = await GetHTMLPage('comment', page_events);
        if ($page) {
            let $section = $('.list-of-comments', $page);
            $section.addClass('el-comments-body');
            let save_events = false;
            $section.find('article.comment').each((_, entry) => {
                let $entry = $(entry);
                let id = $entry.data('id');
                let event = events.find((ev) => ev.id === id);
                let match_html = event.match.map((m) => m.replace('-', ' ')).join('&ensp;&amp;<br>');
                let $post = $entry.closest('div.post');
                $post.prepend(`<div class="el-mark-read el-comment-column"><a><input type="checkbox"></div></a><div class="el-found-with el-comment-column">${match_html}</div>`);
                $post.addClass('el-comments-column');
                if (!event.seen) {
                    $post.addClass('el-new-event');
                    save_events = event.seen = true;
                }
            });
            if (save_events) {
                SaveEvents('comment', events);
            }
            UpdateTimestamps($section);
            $section.children().slice(0, -1).css({
                'border-bottom': '1px solid lightgrey',
                'padding-bottom': '10px',
            });
            let $container = $('<div class="el-comments-section"><div class="el-comments-header"><div class="el-mark-read"></div><div class="el-found-with"><span>Found with</span></div><div class="el-comments-column"><span>Comments</span></div></div></div>');
            $container.append($section);
            $section.find('.post-preview').each((_, entry) => {
                entry.style.setProperty('display', 'flex', 'important');
                entry.style.setProperty('visibility', 'visible', 'important');
            });
            $section.find('.el-mark-read > a').on(JSPLib.program_click, SelectEvent);
            EL.pages.comment[page] = $container;
            $body_section.empty().append($container);
        } else {
            InstallErrorPage('comment', page);
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

function PostEditPostprocess($table) {
    $table.find('.post-version-select-column').remove();
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
    let ajax_options = {
        beforeSend (request) {
            request.setRequestHeader('accept', 'text/html');
        },
    };
    let forum_page = await JSPLib.network.getNotify(`/forum_posts/${forum_id}`, {ajax_options});
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
    let add_posts = String($post_count.data('add-posts') ?? "").split(',').sort().reverse().map(Number);
    let rem_posts = String($post_count.data('rem-posts') ?? "").split(',').sort().reverse().map(Number);
    let post_ids = JSPLib.utility.arrayUnion(add_posts, rem_posts);
    let thumbnails = await GetEventThumbnails(post_ids);
    if (thumbnails.length) {
        $td.empty().append(`<div class="el-add-pool-posts el-pool-posts" style="display:none"></div><div class="el-rem-pool-posts el-pool-posts" style="display:none"></div>`);
        insertPostPreviews($outerblock.find('.el-add-pool-posts'), thumbnails, add_posts);
        insertPostPreviews($outerblock.find('.el-rem-pool-posts'), thumbnails, rem_posts);
        UpdatePostPreviews($outerblock);
    } else {
        $td.empty().append('<span style="font-weight: bold; font-size: 24px; color: red;">ERROR LOADING POOL POSTS!</span>');
    }
}

//Network functions

async function GetHTMLPage(type, events) {
    let url_addons = GetHTMLAddons(type, events);
    let type_html = await JSPLib.network.getNotify(`/${TYPEDICT[type].controller}.html`, {url_addons});
    if (type_html) {
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
        let url_addons = {tags: `id:${query_ids.join(',')} status:any limit:${query_ids.length}`, size: 180, show_votes: false};
        let html = await JSPLib.network.getNotify('/posts', {url_addons});
        if (html) {
            let $posts = $.parseHTML(html);
            thumbnails = JSPLib.utility.concat(thumbnails, [...$('.post-preview', $posts)]);
        }
    }
    return thumbnails;
}

//Event handlers

function ToggleSubscribeLinks(event) {
    let action = $(event.currentTarget).data('action');
    let show_links = action === 'show';
    JSPLib.storage.setLocalData('el-show-subscribe-links', show_links);
    UpdateSubscribeLinks();
}

function SubscribeMultiLink(event) {
    let $menu = $('#el-subscribe-events');
    let $container = $(event.target.parentElement);
    let item_id = $menu.data('id');
    let event_setting = $menu.data('setting');
    let type_list = $container.data('type').split(',');
    let subscribed = ($container.hasClass('el-subscribed') ? true : false);
    type_list.forEach((type) => {
        setTimeout(() => {
            if (event_setting === 'subscribe_events_enabled') {
                SetItemList(type, subscribed, item_id);
            } else if (event_setting === 'user_events_enabled') {
                SetUserList(type, subscribed, item_id);
            }
        }, NONSYNCHRONOUS_DELAY);
    });
    UpdateMultiLink(type_list, subscribed, item_id);
}

function OpenEventsPage(event) {
    $('#page-footer').hide();
    $('#page').hide();
    $('#top').hide();
    if ($('#el-page').length === 0) {
        LoadEventsPage();
        $('.el-event-header[data-type="home"]').addClass('el-header-active');
    }
    $('#el-page').show();
    EL.events_page_open = true;
    if (typeof event !== 'undefined') {
        CloseEventsNotice();
    }
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
            CloseEventsNotice();
        }
    } else {
        $('#el-page').hide();
        $('#top').show();
        $('#page').show();
        $('#page-footer').show();
        EL.events_page_open = false;
    }
}

function CheckMore(event) {
    let {type, source} = GetCheckVars(event);
    if (ReserveEventSemaphore(type, source)) {
        JSPLib.notice.notice(`Checking more ${TYPEDICT[type].plural}.`);
        let selector = `.el-home-section[data-type=${type}] .el-pages-left[data-source="${source}"] span`;
        ProcessEventType(type, source, false, selector).then((new_events) => {
            UpdateAfterCheck(type, source, new_events);
            FreeEventSemaphore(type, source);
        });
    }
}

function CheckAll(event) {
    let {type, source} = GetCheckVars(event);
    if (type === 'controls') {
        if (JSPLib.concurrency.reserveSemaphore('controls')) {
            JSPLib.notice.notice("Starting events check.");
            let promise_hash = {};
            ALL_EVENTS.forEach((type) => {
                ['subscribe', 'post-query', 'other'].forEach((source) => {
                    let overflow = JSPLib.storage.checkLocalData(`el-${type}-${source}-overflow`, {default_val: false});
                    if (overflow) {
                        if (ReserveEventSemaphore(type, source)) {
                            promise_hash[type] ??= {};
                            let selector = `.el-home-section[data-type=${type}] .el-pages-left[data-source="${source}"] span`;
                            promise_hash[type][source] = ProcessEventType(type, source, true, selector);
                        }
                    }
                });
            });
            PromiseHashAll(promise_hash).then((results_hash) => {
                for (let type in results_hash) {
                    for (let source in results_hash[type]) {
                        UpdateAfterCheck(type, source, results_hash[type][source]);
                        FreeEventSemaphore(type, source);
                    }
                }
                JSPLib.notice.notice("All events have been checked.", {append: true});
                JSPLib.concurrency.freeSemaphore('controls');
            });
        }
    } else {
        if (ReserveEventSemaphore(type, source)) {
            JSPLib.notice.notice(`Checking all ${TYPEDICT[type].plural}.`);
            let selector = `.el-home-section[data-type=${type}] .el-pages-left[data-source="${source}"] span`;
            ProcessEventType(type, source, true, selector).then((new_events) => {
                UpdateAfterCheck(type, source, new_events);
                FreeEventSemaphore(type, source);
            });
        }
    }
}

function ResetEvent(event) {
    let {type, source} = GetCheckVars(event);
    if (type === 'controls') {
        if (confirm("This will reset the event position on all events. Continue?")) {
            let promise_hash = {};
            ALL_EVENTS.forEach((type) => {
                ALL_SOURCES.forEach((source) => {
                    let overflow = JSPLib.storage.checkLocalData(`el-${type}-${source}-overflow`, {default_val: false});
                    if (overflow) {
                        promise_hash[type] ??= {};
                        promise_hash[type][source] = SaveRecentDanbooruID(type, source);
                    }
                });
            });
            PromiseHashAll(promise_hash).then((results_hash) => {
                for (let type in results_hash) {
                    for (let source in results_hash[type]) {
                        UpdateEventSource(type, source, {broadcast: true});
                    }
                }
                JSPLib.notice.notice("All events have been reset.");
            });
        }
    } else {
        if (confirm("This will reset the event position to the latest available item. Continue?")) {
            SaveRecentDanbooruID(type, source).then(() => {
                UpdateEventSource(type, source, {broadcast: true});
                JSPLib.notice.notice("Positions reset.");
            });
        }
    }
}

function RefreshEvent(event) {
    let {type, source} = GetCheckVars(event);
    if (type === 'controls') {
        $('.el-refresh-event[data-source] a').trigger('click');
    } else {
        UpdateEventSource(type, source);
    }
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

function SelectEvent(event) {
    if (event.target.nodeName === 'INPUT') return;
    let $input = $(event.currentTarget).find('input');
    let checked = $input.prop('checked');
    $input.prop('checked', !checked);
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
}

function MarkAll(event) {
    let $event_body = $(event.currentTarget).closest('.el-event-body');
    let type = $event_body.data('type');
    if (type === 'comment') {
        $event_body.find('.post').detach();
    } else {
        $event_body.find('tbody tr').detach();
    }
    $event_body.find('.el-paginator a').addClass('el-link-disabled');
    let events = GetEvents(type);
    let selected_ids = JSPLib.utility.getObjectAttributes(events, 'id');
    PruneSavedEvents(type, selected_ids);
}

function OpenEventClick(type, $table, func) {
    $table.find(`.el-show-hide-links[data-type="${type}"] a`).off(JSPLib.program_click).on(JSPLib.program_click, (event) => {
        EL.open_list[type] ??= [];
        let $row = $(event.currentTarget).closest('tr');
        let item_id = $row.data('id');
        let is_open = $(event.currentTarget.parentElement).data('action') === 'show';
        if (is_open && !EL.open_list[type].includes(item_id)) {
            func(item_id, $row);
            EL.open_list[type].push(item_id);
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
    UpdateFloatingTHEAD(entries[0].target, true);
}

function AdjustFloatingTH(entries) {
    let th_entries = JSPLib.utility.getObjectAttributes(entries, 'target');
    UpdateFloatingTH(th_entries, true);
}

function ReadEventPanel() {
    for (let type in EL.new_events) {
        let saved_events = GetEvents(type);
        let updated_events = saved_events.filter((ev) => !EL.new_events[type].includes(ev.id));
        SaveEvents(type, updated_events);
    }
    JSPLib.notice.notice("All shown events have been cleared.");
}

function CloseEventPanel() {
    $('#el-event-notice').hide();
    JSPLib.storage.removeLocalData('el-new-events');
    EL.channel.postMessage({type: 'close_panel'});
    CloseEventsNotice();
}

//Process event functions

function ProcessAllReadyEvents() {
    if (!JSPLib.concurrency.reserveSemaphore('main')) return;
    const printer = JSPLib.debug.getFunctionPrint('ProcessAllReadyEvents');
    let promise_hash = {};
    SUBSCRIBE_EVENTS.forEach((type) => {
        if (CheckEventTimeout(type, 'subscribe') && CheckEventSemaphore(type, 'subscribe')) {
            if (!IsSubscribeEnabled(type)) {
                printer.debuglogLevel("Hard disable:", 'subscribe', type, JSPLib.debug.DEBUG);
            } else if (!CheckSubscribeEnabled(type) && !CheckUserEnabled(type)) {
                printer.debuglogLevel("Soft disable:", 'subscribe', type, JSPLib.debug.DEBUG);
            } else {
                promise_hash[type] ??= {};
                promise_hash[type].subscribe = ProcessEventType(type, 'subscribe');
            }
        }
    });
    POST_QUERY_EVENTS.forEach((type) => {
        if (CheckEventTimeout(type, 'post-query') && CheckEventSemaphore(type, 'post-query')) {
            if (!IsPostQueryEnabled(type)) {
                printer.debuglogLevel("Hard disable:", 'post-query', type, JSPLib.debug.DEBUG);
            } else {
                promise_hash[type] ??= {};
                promise_hash[type]['post-query'] = ProcessEventType(type, 'post-query');
            }
        }
    });
    OTHER_EVENTS.forEach((type) => {
        if (CheckEventTimeout(type, 'other') && CheckEventSemaphore(type, 'other')) {
            if (!IsOtherEnabled(type)) {

                printer.debuglogLevel("Hard disable:", 'other', type, JSPLib.debug.DEBUG);
            } else {
                promise_hash[type] ??= {};
                promise_hash[type].other = ProcessEventType(type, 'other');
            }
        }
    });
    PromiseHashAll(promise_hash).then((results_hash) => {
        printer.debuglog(results_hash);
        let all_new_events = false;
        for (let type in results_hash) {
            let type_new_events = false;
            for (let source in results_hash[type]) {
                type_new_events ||= Boolean(results_hash[type][source].length);
                UpdateEventSource(type, source, {broadcast: true});
            }
            if (type_new_events) {
                UpdateEventType(type, {has_new: true, broadcast: true});
                all_new_events = true;
            }
        }
        if (all_new_events) {
            UpdateNavigation({broadcast: true});
            UpdateUserOnNewEvents(true);
            let new_events_hash = GetNewEventsHash(results_hash);
            InstallNoticePanel(new_events_hash);
        }
        JSPLib.concurrency.freeSemaphore('main');
    });
}

async function ProcessEventType(type, source, no_limit = false, selector = null) {
    const printer = JSPLib.debug.getFunctionPrint('ProcessEventType');
    let last_id = JSPLib.storage.checkLocalData(`el-${type}-${source}-last-id`, {default_val: 0});
    let new_events = [];
    if (last_id) {
        let item_set = (source === 'subscribe' ? GetItemList(type) : null);
        let user_set = (source === 'subscribe' ? GetUserList(type) : null);
        let type_addon = TYPEDICT[type].json_addons ?? {};
        let query_addon = {};
        if (source === 'post-query') {
            let post_query = GetTypeQuery(type);
            //Check if the post query has any non-operator text
            if (post_query.replace(/[\s-*~]+/g, '').length > 0) {
                query_addon = TYPEDICT[type].custom_query?.(post_query) ?? {search: {post_tags_match: post_query}};
            }
        }
        let only_attribs = TYPEDICT[type].only;
        if (EL.show_creator_events && source === 'subscribe') {
            only_attribs += (TYPEDICT[type].includes ? ',' + TYPEDICT[type].includes : "");
        }
        let url_addons = JSPLib.utility.mergeHashes(type_addon, query_addon, {only: only_attribs});
        let batches = 1;
        if (no_limit) {
            batches = null;
        } else if (source === 'subscribe') {
            batches = TYPEDICT[type].limit;
        }
        let items = await JSPLib.danbooru.getAllItems(TYPEDICT[type].controller, QUERY_LIMIT, {url_addons, batches, page: last_id, reverse: true, domname: selector});
        if (EL.show_parent_events && type === 'post' && source === 'subscribe') {
            items = await AddParentInclude(items);
        }
        SaveLastChecked(type, source);
        if (items.length) {
            let batch_limit = (Number.isInteger(batches) ? batches * QUERY_LIMIT : Infinity);
            SaveOverflow(type, source, items, batch_limit);
            SaveLastSeen(type, source, items);
            let updated_last_id = JSPLib.danbooru.getNextPageID(items, true);
            SaveLastID(type, source, updated_last_id);
            last_id = updated_last_id;
        }
        let found_events = TYPEDICT[type].find_events(items, source, item_set, user_set);
        if (found_events.length) {
            printer.debuglog(`Available ${TYPEDICT[type].plural} [${source}]:`, found_events.length, last_id);
            new_events = SaveFoundEvents(type, source, found_events, items);
        } else {
            printer.debuglog(`No ${TYPEDICT[type].plural} [${source}]:`, last_id);
        }
        SaveEventRecheck(type, source);
    } else {
        SaveRecentDanbooruID(type, source);
    }
    return new_events;
}

//Settings functions

function BroadcastEL(ev) {
    const printer = JSPLib.debug.getFunctionPrint('BroadcastEL');
    printer.debuglog(`(${ev.data.type}):`, ev.data);
    switch (ev.data.type) {
        case 'subscribe_item':
            EL.item_set[ev.data.event_type] = ev.data.event_set;
            UpdateMultiLink([ev.data.event_type], ev.data.was_subscribed, ev.data.item_id);
            break;
        case 'subscribe_user':
            EL.user_set[ev.data.event_type] = ev.data.event_set;
            UpdateMultiLink([ev.data.event_type], ev.data.was_subscribed, ev.data.user_id);
            break;
        case 'update_navigation':
            UpdateNavigation(ev.data.event_data);
            break;
        case 'update_type':
            UpdateEventType(ev.data.event_type, ev.data.event_data);
            JSPLib.storage.invalidateLocalData(`el-${ev.data.event_type}-saved-events`);
            break;
        case 'update_source':
            UpdateEventSource(ev.data.event_type, ev.data.event_source, ev.data.event_data);
            JSPLib.storage.invalidateLocalData(`el-${ev.data.event_type}-${ev.data.event_source}-last-found`);
            JSPLib.storage.invalidateLocalData(`el-${ev.data.event_type}-${ev.data.event_source}-last-seen`);
            JSPLib.storage.invalidateLocalData(`el-${ev.data.event_type}-${ev.data.event_source}-last-checked`);
            JSPLib.storage.invalidateLocalData(`el-${ev.data.event_type}-${ev.data.event_source}-event-timeout`);
            JSPLib.storage.invalidateLocalData(`el-${ev.data.event_type}-${ev.data.event_source}-overflow`);
            break;
        case 'new_events':
            UpdateUserOnNewEvents(false);
            break;
        case 'close_panel':
            $('#el-event-notice').hide();
            break;
        case 'close_notice':
            $('#el-close-notice-link').trigger('click');
            //falls through
        default:
            //do nothing
    }
}

function CleanupTasks() {
    ALL_SUBSCRIBES.forEach((type) => {
        if (CheckSubscribeEnabled(type)) return;
        if (CheckUserEnabled(type)) return;
        SOURCE_SUFFIXES.forEach((suffix) => {
            JSPLib.storage.removeLocalData(`el-${type}-post-query-${suffix}`);
        });
    });
    POST_QUERY_EVENTS.forEach((type) => {
        if (IsPostQueryEnabled(type)) return;
        SOURCE_SUFFIXES.forEach((suffix) => {
            JSPLib.storage.removeLocalData(`el-${type}-post-query-${suffix}`);
        });
    });
    OTHER_EVENTS.forEach((type) => {
        if (IsOtherEnabled(type)) return;
        SOURCE_SUFFIXES.forEach((suffix) => {
            JSPLib.storage.removeLocalData(`el-${type}-other-${suffix}`);
        });
    });
    ALL_EVENTS.forEach((type) => {
        if (CheckSubscribeEnabled(type)) return;
        if (CheckUserEnabled(type)) return;
        if (IsPostQueryEnabled(type)) return;
        if (IsOtherEnabled(type)) return;
        JSPLib.storage.removeLocalData(`el-${type}-saved-events`);
    });
    JSPLib.storage.removeLocalData('el-new-events');
}

function MigrateLocalData() {
    let migrated = JSPLib.storage.getLocalData('el-migration-25.0', {default_val: false});
    if (migrated) return;
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
    JSPLib.storage.removeLocalData('el-process-semaphoref');
    JSPLib.storage.removeLocalData('el-saved-timeout');
    JSPLib.storage.removeLocalData('el-event-timeout');
    JSPLib.storage.removeLocalData('el-overflow');
    JSPLib.storage.removeLocalData('el-last-seen');
    JSPLib.storage.setLocalData('el-migration-25.0', true);
}

function InitializeChangedSettings() {
    $('#el-nav-events, #el-display-subscribe, #el-subscribe-events, #el-page').remove();
    InitializeUserSettings();
    if (EL.events_page_open) {
        OpenEventsPage();
    }
    InstallSubscribeLinks();
    InstallEventsNavigation();
    ALL_EVENTS.forEach((type) => {
        ClearPages(type);
    });
}

function InitializeUserSettings() {
    Object.assign(EL, {
        all_subscribe_events: JSPLib.utility.arrayUnion(EL.subscribe_events_enabled, EL.user_events_enabled),
        timeout_expires: EL.recheck_interval * JSPLib.utility.one_minute,
        post_filter_tags: new Set(EL.filter_post_edits.trim().split(/\s+/)),
    });
    // 25% swing, with a minimum and maximum
    EL.timeout_jitter = JSPLib.utility.clamp(EL.timeout_expires * 0.25, MIN_JITTER, MAX_JITTER);
}

function InitializeProgramValues() {
    const printer = JSPLib.debug.getFunctionPrint('InitializeProgramValues');
    Object.assign(EL, {
        user_name: Danbooru.CurrentUser.data('name'),
        user_id: Danbooru.CurrentUser.data('id'),
    });
    if (EL.user_name === 'Anonymous') {
        printer.debugwarnLevel("User must log in!", JSPLib.debug.WARNING);
        return false;
    }
    if (!JSPLib.utility.isString(EL.user_name) || !JSPLib.utility.validateID(EL.user_id)) {
        printer.debugwarnLevel("Invalid meta variables!", JSPLib.debug.WARNING);
        return false;
    }
    InitializeUserSettings();
    Object.assign(EL, {
        thead_observer: new ResizeObserver(AdjustFloatingTHEAD),
        th_observer: new ResizeObserver(AdjustFloatingTH),
        new_events: JSPLib.storage.checkLocalData('el-new-events', {default_val: {}}),
    });
    JSPLib.load.setProgramGetter(EL, 'IAC', 'IndexedAutocomplete', 29.25);
    return true;
}

function RenderSettingsMenu() {
    $('#event-listener').append(JSPLib.menu.renderMenuFramework(MENU_CONFIG));
    $('#el-general-settings').append(JSPLib.menu.renderDomainSelectors());
    $('#el-display-settings').append(JSPLib.menu.renderCheckbox('display_event_notice'));
    $('#el-display-settings').append(JSPLib.menu.renderCheckbox('display_event_panel'));
    $('#el-display-settings').append(JSPLib.menu.renderTextinput('page_size', 10));
    $('#el-display-settings').append(JSPLib.menu.renderCheckbox('ascending_order'));
    $('#el-display-settings').append(JSPLib.menu.renderSortlist('events_order'));
    $('#el-network-settings').append(JSPLib.menu.renderTextinput('recheck_interval', 10));
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
    $('#el-controls').append(JSPLib.menu.renderCacheControls());
    $('#el-cache-controls').append(JSPLib.menu.renderLinkclick('cache_info'));
    $('#el-cache-controls').append(JSPLib.menu.renderCacheInfoTable());
    $('#el-controls').append(JSPLib.menu.renderCacheEditor());
    $('#el-cache-editor-message').append(JSPLib.menu.renderExpandable("Program Data details", PROGRAM_DATA_DETAILS));
    $('#el-cache-editor-controls').append(JSPLib.menu.renderLocalStorageSource());
    $("#el-cache-editor-controls").append(JSPLib.menu.renderCheckbox('raw_data', true));
    $('#el-cache-editor-controls').append(JSPLib.menu.renderTextinput('data_name', 20, true));
    JSPLib.menu.engageUI(true, true);
    JSPLib.menu.saveUserSettingsClick(InitializeChangedSettings);
    JSPLib.menu.resetUserSettingsClick(LOCALSTORAGE_KEYS, InitializeChangedSettings);
    JSPLib.menu.cacheInfoClick();
    JSPLib.menu.expandableClick();
    JSPLib.menu.rawDataChange();
    JSPLib.menu.getCacheClick(ValidateProgramData);
    JSPLib.menu.saveCacheClick(ValidateProgramData);
    JSPLib.menu.deleteCacheClick();
    JSPLib.menu.listCacheClick();
    JSPLib.menu.refreshCacheClick();
    JSPLib.menu.cacheAutocomplete();
    SetupMenuAutocomplete();
}

//Main program

function Main() {
    const preload = {
        run_on_settings: true,
        default_data: DEFAULT_VALUES,
        initialize_func: InitializeProgramValues,
        broadcast_func: BroadcastEL,
        render_menu_func: RenderSettingsMenu,
        program_css: PROGRAM_CSS,
        menu_css: MENU_CSS,
    };
    if (!JSPLib.menu.preloadScript(EL, preload)) return;
    JSPLib.notice.installBanner();
    MigrateLocalData();
    InstallSubscribeLinks();
    InstallEventsNavigation();
    if (Object.keys(EL.new_events).length && EL.display_event_panel) {
        InstallNoticePanel(EL.new_events);
    } else {
        ProcessAllReadyEvents();
    }
    let show_notice = JSPLib.storage.checkLocalData('el-new-events-notice', {default_val: false});
    if (show_notice) {
        TriggerEventsNotice();
    }
    JSPLib.load.noncriticalTasks(CleanupTasks);
}

/****Initialization****/

//Variables for JSPLib

JSPLib.program_name = PROGRAM_NAME;
JSPLib.program_shortcut = PROGRAM_SHORTCUT;
JSPLib.program_data = EL;

//Variables for debug.js
JSPLib.debug.mode = false;
JSPLib.debug.level = JSPLib.debug.INFO;

//Variables for menu.js
JSPLib.menu.settings_callback = InitializeChangedSettings;
JSPLib.menu.reset_callback = InitializeChangedSettings;
JSPLib.menu.settings_config = SETTINGS_CONFIG;
JSPLib.menu.control_config = CONTROL_CONFIG;

//Variables for storage.js
JSPLib.storage.localSessionValidator = ValidateProgramData;

//Export JSPLib
JSPLib.load.exportData();

/****Execution start****/

JSPLib.load.programInitialize(Main, {required_variables: PROGRAM_LOAD_REQUIRED_VARIABLES, required_selectors: PROGRAM_LOAD_REQUIRED_SELECTORS});
