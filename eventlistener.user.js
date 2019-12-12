// ==UserScript==
// @name         EventListener
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      17.2
// @description  Informs users of new events (flags,appeals,dmails,comments,forums,notes,commentaries,post edits,wikis,pools)
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @exclude      /^https?://\w+\.donmai\.us/.*\.(xml|json|atom)(\?|$)/
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/eventlistener.user.js
// @require      https://cdn.jsdelivr.net/npm/core-js-bundle@3.2.1/minified.js
// @require      https://cdn.jsdelivr.net/npm/xregexp@4.2.4/xregexp-all.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jsdiff/4.0.1/diff.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.4.4/lz-string.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190929/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190929/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190929/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190929/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190929/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190929/lib/concurrency.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190929/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190929/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190929/lib/menu.js
// ==/UserScript==

/* global JSPLib jQuery $ Danbooru Diff XRegExp LZString */

/****Global variables****/

//Exterior script variables

const DANBOORU_TOPIC_ID = '14747';
const JQUERY_TAB_WIDGET_URL = 'https://cdn.jsdelivr.net/gh/jquery/jquery-ui@1.12.1/ui/widgets/tabs.js';

//Variables for debug.js
JSPLib.debug.debug_console = false;
JSPLib.debug.level = JSPLib.debug.INFO;
JSPLib.debug.pretext = 'EL:';
JSPLib.debug.pretimer = 'EL-';

//Variables for load.js
const PROGRAM_LOAD_REQUIRED_VARIABLES = ['window.jQuery','window.Danbooru'];
const PROGRAM_LOAD_REQUIRED_SELECTORS = ['#nav', '#page'];

//Program name constants

const PROGRAM_NAME = 'EventListener';
const PROGRAM_SHORTCUT = 'el';
const PROGRAM_CLICK = 'click.el';

//Main program variable
const EL = {};

//Timer function hash
const TIMER = {};

//For factory reset
const POST_QUERY_EVENTS = ['comment', 'note', 'commentary', 'approval', 'flag', 'appeal'];
const SUBSCRIBE_EVENTS = ['comment', 'note', 'commentary', 'post', 'approval', 'forum', 'wiki', 'pool'];
const OTHER_EVENTS = ['dmail', 'spam', 'ban', 'feedback', 'mod_action'];
const ALL_EVENTS = JSPLib.utility.setUnique(POST_QUERY_EVENTS.concat(SUBSCRIBE_EVENTS).concat(OTHER_EVENTS));
const LASTID_KEYS = Array.prototype.concat(
    POST_QUERY_EVENTS.map((type)=>{return `el-pq-${type}lastid`;}),
    SUBSCRIBE_EVENTS.map((type)=>{return `el-${type}lastid`;}),
    OTHER_EVENTS.map((type)=>{return `el-ot-${type}lastid`;}),
);
const SAVED_KEYS = Array.prototype.concat(
    POST_QUERY_EVENTS.map((type)=>{return [`el-pq-saved${type}lastid`, `el-pq-saved${type}list`];}),
    SUBSCRIBE_EVENTS.map((type)=>{return [`el-saved${type}lastid`, `el-saved${type}list`];}),
    OTHER_EVENTS.map((type)=>{return [`el-ot-saved${type}lastid`, `el-ot-saved${type}list`];}),
);
const SUBSCRIBE_KEYS = SUBSCRIBE_EVENTS.map((type)=>{return [`el-${type}list`, `el-${type}overflow`];}).flat();
const LOCALSTORAGE_KEYS = LASTID_KEYS.concat(SAVED_KEYS).concat(SUBSCRIBE_KEYS).concat([
    'el-process-semaphore',
    'el-overflow',
    'el-event-timeout',
    'el-saved-timeout',
    'el-last-seen',
    'el-saved-notice',
]);
const PROGRAM_RESET_KEYS = {
    storage_keys: {local_storage: []},
};

//Available setting values
const ENABLE_EVENTS = ['flag', 'appeal', 'dmail', 'comment', 'note', 'commentary', 'forum'];
const POST_QUERY_ENABLE_EVENTS = ['flag', 'appeal'];
const SUBSCRIBE_ENABLE_EVENTS = ['comment', 'note', 'commentary', 'forum'];
const OTHER_ENABLE_EVENTS = ['dmail'];
const AUTOSUBSCRIBE_EVENTS = ['comment', 'note', 'commentary', 'post', 'approval'];
const MODACTION_EVENTS = [
    'user_delete', 'user_ban', 'user_unban', 'user_name_change', 'user_level_change', 'user_approval_privilege', 'user_upload_privilege', 'user_account_upgrade',
    'user_feedback_update', 'user_feedback_delete', 'post_delete', 'post_undelete', 'post_ban', 'post_unban', 'post_permanent_delete', 'post_move_favorites',
    'pool_delete', 'pool_undelete', 'artist_ban', 'artist_unban', 'comment_update', 'comment_delete', 'forum_topic_delete', 'forum_topic_undelete', 'forum_topic_lock',
    'forum_post_update', 'forum_post_delete', 'tag_alias_create', 'tag_alias_update', 'tag_implication_create', 'tag_implication_update', 'ip_ban_create', 'ip_ban_delete',
    'mass_update', 'bulk_revert', 'other'
];

//Main settings
const SETTINGS_CONFIG = {
    autolock_notices: {
        default: false,
        validate: (data)=>{return typeof data === 'boolean';},
        hint: "Closing a notice will no longer close all other notices."
    },
    mark_read_topics: {
        default: true,
        validate: (data)=>{return typeof data === 'boolean';},
        hint: "Reading a forum post from the notice will mark the topic as read."
    },
    autoclose_dmail_notice: {
        default: false,
        validate: (data)=>{return typeof data === 'boolean';},
        hint: "Will automatically close the DMail notice provided by Danbooru."
    },
    filter_user_events: {
        default: true,
        validate: (data)=>{return typeof data === 'boolean';},
        hint: "Only show events not created by the user."
    },
    filter_untranslated_commentary: {
        default: true,
        validate: (data)=>{return typeof data === 'boolean';},
        hint: "Only show new commentary that has translated sections."
    },
    filter_autobans: {
        default: true,
        validate: (data)=>{return typeof data === 'boolean';},
        hint: 'Only show bans not created by <a class="user-moderator with-style" style="color:var(--user-moderator-color)" href="/users/502584">DanbooruBot</a>.'
    },
    filter_autofeedback: {
        default: true,
        validate: (data)=>{return typeof data === 'boolean';},
        hint: 'Only show feedback not created by an administrative action, e.g. bans or promotions.'
    },
    recheck_interval: {
        default: 5,
        parse: parseInt,
        validate: (data)=>{return Number.isInteger(data) && data > 0;},
        hint: "How often to check for new events (# of minutes)."
    },
    post_query_events_enabled: {
        allitems: POST_QUERY_EVENTS,
        default: POST_QUERY_ENABLE_EVENTS,
        validate: (data)=>{return JSPLib.menu.validateCheckboxRadio(data, 'checkbox', POST_QUERY_EVENTS);},
        hint: "Select to enable event type."
    },
    subscribe_events_enabled: {
        allitems: SUBSCRIBE_EVENTS,
        default: SUBSCRIBE_ENABLE_EVENTS,
        validate: (data)=>{return JSPLib.menu.validateCheckboxRadio(data, 'checkbox', SUBSCRIBE_EVENTS);},
        hint: "Select to enable event type."
    },
    other_events_enabled: {
        allitems: OTHER_EVENTS,
        default: OTHER_ENABLE_EVENTS,
        validate: (data)=>{return JSPLib.menu.validateCheckboxRadio(data, 'checkbox', OTHER_EVENTS);},
        hint: "Select to enable event type."
    },
    autosubscribe_enabled: {
        allitems: AUTOSUBSCRIBE_EVENTS,
        default: [],
        validate: (data)=>{return JSPLib.menu.validateCheckboxRadio(data, 'checkbox', AUTOSUBSCRIBE_EVENTS);},
        hint: "Select to autosubscribe event type."
    },
    subscribed_mod_actions: {
        allitems: MODACTION_EVENTS,
        default: [],
        validate: (data)=>{return JSPLib.menu.validateCheckboxRadio(data, 'checkbox', MODACTION_EVENTS);},
        hint: "Select which mod action categories to subscribe to."
    },
    flag_query: {
        default: "###INITIALIZE###",
        parse: String,
        validate: JSPLib.validate.isString,
        hint: 'Enter a post search query to check.'
    },
    appeal_query: {
        default: "###INITIALIZE###",
        parse: String,
        validate: JSPLib.validate.isString,
        hint: 'Enter a post search query to check.'
    },
    comment_query: {
        default: "",
        parse: String,
        validate: JSPLib.validate.isString,
        hint: 'Enter a post search query to check.'
    },
    note_query: {
        default: "",
        parse: String,
        validate: JSPLib.validate.isString,
        hint: 'Enter a post search query to check.'
    },
    commentary_query: {
        default: "",
        parse: String,
        validate: JSPLib.validate.isString,
        hint: 'Enter a post search query to check.'
    },
    approval_query: {
        default: "",
        parse: String,
        validate: JSPLib.validate.isString,
        hint: 'Enter a post search query to check.'
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
    data_name: {
        value: "",
        buttons: ['get', 'save', 'delete'],
        hint: "Click <b>Get</b> to see the data, <b>Save</b> to edit it, and <b>Delete</b> to remove it.",
    },
};

//CSS Constants

const PROGRAM_CSS = `
#el-event-notice {
    padding: 0.5em;
}
#page #c-comments #a-index .preview {
    height: 170px;
    display: flex;
    flex-direction: column;
}
#c-comments #a-index #p-index-by-comment .preview {
    margin-right: 0;
}
.striped .el-monospace-link:link,
.striped .el-monospace-link:visited,
.post-preview .el-monospace-link:link,
.post-preview .el-monospace-link:visited {
    font-family: monospace;
    color: var(--link-color);
}
.striped .el-monospace-link:hover,
.post-preview .el-monospace-link:hover {
    color: var(--link-hover-color);
}
.el-subscribe-pool-container .el-subscribe-dual-links .el-monospace-link {
    color: var(--muted-text-color);
}
.el-subscribe-pool-container .el-subscribe-dual-links .el-monospace-link:hover {
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
#el-lock-event-notice,
#el-read-event-notice {
    font-weight: bold;
    color: mediumseagreen;
}
#el-lock-event-notice:not(.el-locked):hover ,
#el-read-event-notice:not(.el-read):hover {
    filter: brightness(1.5);
}
#el-lock-event-notice.el-locked,
#el-read-event-notice.el-read {
    color: red;
}
#el-reload-event-notice {
    font-weight: bold;
    color: orange;
}
#el-reload-event-notice:hover {
    filter: brightness(1.5);
}
#el-absent-section {
    margin: 0.5em;
    border: solid 1px grey;
    padding: 0.5em;
}
.el-error-notice {
    color: var(--muted-text-color);
    font-weight: bold;
    margin-left: 1em;
}`;

const COMMENT_CSS = `
#el-event-notice #el-comment-section #el-comment-table .post-preview {
    display: flex;
    flex-direction: row;
    margin-bottom: 1em;
    border-bottom: var(--dtext-blockquote-border);
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
#el-event-notice #el-wiki-section ins {
    background: #cfc;
    text-decoration: none;
}
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
    background-color: rgba(0, 255, 0, 0.2);
}
#el-event-notice #el-pool-section .el-full-item[data-type="poolposts"] .el-rem-pool-posts {
    background-color: rgba(255, 0, 0, 0.2);
}
#el-event-notice #el-pool-section .el-full-item[data-type="poolposts"] .post-preview {
    width: 154px;
    height: 154px;
    margin: 5px;
    padding: 5px;
    border: var(--dtext-blockquote-border);
}
.el-paragraph-mark {
    opacity: 0.25;
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
    border: var(--dtext-blockquote-border);
    padding: 0.5em;
    width: 7.5em;
}
#event-listener .jsplib-selectors label {
    text-align: left;
    width: 175px;
}
#event-listener .ui-checkboxradio-icon-space {
    margin-right: 5px;
}`;

//Temporary CSS
const JSPLIB_CSS = `
#userscript-settings-menu {
    border: var(--footer-border);
}
#userscript-settings-menu,
#userscript-settings-menu .ui-widget-content {
    color: var(--text-color);
    background: var(--body-background-color);
}
#userscript-settings-menu .ui-button {
    color: var(--form-button-text-color);
    border: var(--form-button-border);
    background: var(--form-button-background);
}
#userscript-settings-menu .ui-button:hover {
    filter: brightness(1.1);
}
#userscript-settings-menu .ui-widget-header {
    border: var(--post-notice-border);
    background: var(--form-button-background);
    color: var(--text-color);
}
#userscript-settings-menu .ui-state-default {
    background: var(--form-button-hover-background);
}
#userscript-settings-menu .ui-state-default a,
#userscript-settings-menu .ui-state-default a:link,
#userscript-settings-menu .ui-state-default a:visited {
    color: black;
}
#userscript-settings-menu .ui-state-hover,
#userscript-settings-menu .ui-state-focus  {
    filter: brightness(1.1);
}
#userscript-settings-menu .ui-state-active {
    border: 1px solid #003eff;
    background: #007fff;
    border-bottom-width: 0;
    color: #ffffff;
}
#userscript-settings-menu .ui-state-active a,
#userscript-settings-menu .ui-state-active a:link,
#userscript-settings-menu .ui-state-active a:visited {
    color: #ffffff;
}
#userscript-settings-menu .jsplib-console hr {
    border: var(--footer-border);
}
#userscript-settings-menu .jsplib-console .expandable {
    border: var(--dtext-expand-border);
}
#userscript-settings-menu .jsplib-block-tooltip,
#userscript-settings-menu .jsplib-inline-tooltip {
    color: var(--muted-text-color);
}
`;

//HTML constants

const NOTICE_BOX = `
<div id="el-event-notice" style="display:none" class="notice notice-info">
    <div id="el-absent-section" style="display:none"></div>
    <div id="el-dmail-section"></div>
    <div id="el-flag-section"></div>
    <div id="el-appeal-section"></div>
    <div id="el-forum-section"></div>
    <div id="el-comment-section"  class="comments-for-post"></div>
    <div id="el-note-section"></div>
    <div id="el-commentary-section"></div>
    <div id="el-wiki-section"></div>
    <div id="el-pool-section"></div>
    <div id="el-approval-section"></div>
    <div id="el-post-section"></div>
    <div id="el-feedback-section"></div>
    <div id="el-ban-section"></div>
    <div id="el-mod-action-section"></div>
    <div id="el-spam-section"></div>
    <div style="margin-top:1em">
        <a href="javascript:void(0)" id="el-hide-event-notice">Close this</a>
        [
        <a href="javascript:void(0)" id="el-lock-event-notice" title="Keep notice from being closed by other tabs.">LOCK</a>
        |
        <a href="javascript:void(0)" id="el-read-event-notice" title="Mark all items as read.">READ</a>
        |
        <a href="javascript:void(0)" id="el-reload-event-notice" title="Mark all items as read.">RELOAD</a>
        ]
    </div>
</div>`;

const DISPLAY_COUNTER = `
<div id="el-search-query-display" style="display:none">
    Pages left: <span id="el-search-query-counter">...</span>
</div>`;

const REGULAR_NOTICE = `
<div id="el-%s-regular">
    <h1>You've got %s!</h1>
    <div id="el-%s-table"></div>
</div>`;

const ERROR_NOTICE = `
<div id="el-%s-error">
    <h2>Error getting %s!</h2>
    <div class="el-error-notice">Refresh page to try again.</div>
</div>`;

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

const CACHE_INFO_TABLE = '<div id="el-cache-info-table" style="display:none"></div>';

const CONTROL_DATA_SOURCE = '<input id="el-control-data-source" type="hidden" value="local_storage">';

const PARAGRAPH_MARK = `<span class="el-paragraph-mark">¶</span><br>`;

const EL_MENU = `
<div id="el-script-message" class="prose">
    <h2>EventListener</h2>
    <p>Check the forum for the latest on information and updates (<a class="dtext-link dtext-id-link dtext-forum-topic-id-link" href="/forum_topics/${DANBOORU_TOPIC_ID}">topic #${DANBOORU_TOPIC_ID}</a>).</p>
</div>
<div id="el-console" class="jsplib-console">
    <div id="el-settings" class="jsplib-outer-menu">
        <div id="el-general-settings" class="jsplib-settings-grouping">
            <div id="el-general-message" class="prose">
                <h4>General settings</h4>
            </div>
        </div>
        <div id="el-notice-settings" class="jsplib-settings-grouping">
            <div id="el-network-message" class="prose">
                <h4>Notice settings</h4>
            </div>
        </div>
        <div id="el-filter-settings" class="jsplib-settings-grouping">
            <div id="el-filter-message" class="prose">
                <h4>Filter settings</h4>
            </div>
        </div>
        <div id="el-post-query-event-settings" class="jsplib-settings-grouping">
            <div id="el-post-query-event-message" class="prose">
                <h4>Post query event settings</h4>
                <p>These events can be searched with a post query. A blank query line will return all events. See <a href="/wiki_pages/43049">Help:Cheatsheet</a> for more info.</p>
            </div>
        </div>
        <div id="el-subscribe-event-settings" class="jsplib-settings-grouping">
            <div id="el-subscribe-event-message" class="prose">
                <h4>Subscribe event settings</h4>
                <p>These events will not be checked unless there are one or more subscribed items.</p>
                <div class="expandable">
                    <div class="expandable-header">
                        <span>Additional setting details</span>
                        <input type="button" value="Show" class="expandable-button">
                    </div>
                    <div class="expandable-content">
                        <ul>
                            <li><b>Autosubscribe enabled:</b>
                                <ul>
                                    <li>Which events on a user's own uploads will be automatically subscribed.</li>
                                    <li>Events will only be subscribed on the post page for that upload.</li>
                                </ul>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        <div id="el-other-event-settings" class="jsplib-settings-grouping">
            <div id="el-other-event-message" class="prose">
                <h4>Other event settings</h4>
                <p>Except for some exceptions noted below, all events of this type are shown.</p>
                <div class="expandable">
                    <div class="expandable-header">
                        <span>Event exceptions</span>
                        <input type="button" value="Show" class="expandable-button">
                    </div>
                    <div class="expandable-content">
                        <ul>
                            <li><b>dmail:</b> Received from another user.</li>
                            <li><b>spam:</b> Received from another user.</li>
                            <li><b>ban:</b> None.</li>
                            <li><b>feedback:</b> No ban feedbacks.</li>
                            <li><b>mod action:</b> Specific categories must be subscribed.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        <div id="el-network-settings" class="jsplib-settings-grouping">
            <div id="el-network-message" class="prose">
                <h4>Network settings</h4>
            </div>
        </div>
        <div id="el-subscribe-controls" class="jsplib-settings-grouping">
            <div id="el-subscribe-message" class="prose">
                <h4>Subscribe controls</h4>
                <p>Subscribe to events using search queries instead of individually.</p>
                <p><span style="color:red"><b>Warning!</b></span> Very large lists have issues:</p>
                <ul>
                    <li>Higher performance delays.</li>
                    <li>Could fill up the cache.</li>
                    <li>Which could crash the program or other scripts.</li>
                    <li>I.e. don't subscribe to <b><u>ALL</u></b> of Danbooru!</li>
                </ul>
            </div>
        </div>
        <div id="el-cache-settings" class="jsplib-settings-grouping">
            <div id="el-cache-message" class="prose">
                <h4>Cache controls</h4>
            </div>
        </div>
        <hr>
        <div id="el-settings-buttons" class="jsplib-settings-buttons">
            <input type="button" id="el-commit" value="Save">
            <input type="button" id="el-resetall" value="Factory Reset">
        </div>
    </div>
    <div id="el-cache-editor" class="jsplib-outer-menu">
        <div id="el-editor-message" class="prose">
            <h4>Cache editor</h4>
            <div class="expandable">
                <div class="expandable-header">
                    <span>Program Data details</span>
                    <input type="button" value="Show" class="expandable-button">
                </div>
                <div class="expandable-content">
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
                </div>
            </div>
        </div>
        <div id="el-cache-editor-controls"></div>
        <div id="el-cache-editor-errors" class="jsplib-cache-editor-errors"></div>
        <div id="el-cache-viewer" class="jsplib-cache-viewer">
            <textarea></textarea>
        </div>
    </div>
</div>`;

//Time constants

const TIMER_POLL_INTERVAL = 100; //Polling interval for checking program status
const JQUERY_DELAY = 1; //For jQuery updates that should not be done synchronously
const NONSYNCHRONOUS_DELAY = 1; //For operations too costly in events to do synchronously
const MAX_ABSENCE = 30.0; //# of days before reset links get shown

//The max number of items to grab with each network call
const QUERY_LIMIT = 100;

//Regex constants

const DMAILS_REGEX = XRegExp.tag()`/dmails/(\d+)`;
const POSTS_REGEX = XRegExp.tag()`/posts/(\d+)`;
const WIKI_PAGES_REGEX = XRegExp.tag()`/wiki_pages/(\d+)`;
const WIKI_PAGE_VERSIONS_REGEX = XRegExp.tag()`/wiki_page_versions/(\d+)`;
const WIKI_PAGE_HISTORY_REGEX = XRegExp.tag()`/wiki_page_versions\?search%5Bwiki_page_id%5D=(\d+)`
const POOLS_REGEX = XRegExp.tag()`/pools/(\d+)`;
const POOL_DESC_REGEX = /(Old|New) Desc: /;
const FORUM_TOPICS_REGEX = XRegExp.tag()`/forum_topics/(\d+)`;
const EMPTY_REGEX = /^$/;

//Other constants

const ALL_POST_EVENTS = ['post', 'approval', 'comment', 'note', 'commentary'];
const ALL_TRANSLATE_EVENTS = ['note', 'commentary'];
const ALL_MAIL_EVENTS = ['dmail', 'spam'];

//Type configurations
const TYPEDICT = {
    flag: {
        controller: 'post_flags',
        addons: {search: {category: 'normal'}},
        only: 'id,creator_id',
        filter: (array)=>{return array.filter((val)=>{return IsShownData(val, [], 'creator_id', null);})},
        insert: InsertEvents,
        plural: 'flags',
        useritem: false,
    },
    appeal: {
        controller: 'post_appeals',
        only: 'id,creator_id',
        filter: (array)=>{return array.filter((val)=>{return IsShownData(val, [], 'creator_id', null);})},
        insert: InsertEvents,
        plural: 'appeals',
        useritem: false,
    },
    dmail: {
        controller: 'dmails',
        addons: {search: {is_spam: false}},
        only: 'id,from_id',
        filter: (array)=>{return array.filter((val)=>{return IsShownData(val, [], 'from_id', null, (val)=>{return !val.is_read});})},
        insert: InsertDmails,
        plural: 'mail',
        useritem: true,
        open: ()=>{OpenItemClick('dmail', 3, AddDmail);},
    },
    spam: {
        controller: 'dmails',
        addons: {search: {is_spam: true}},
        only: 'id,from_id',
        filter: (array)=>{return array.filter((val)=>{return IsShownData(val, [], 'from_id', null, (val)=>{return !val.is_read});})},
        insert: InsertDmails,
        plural: 'spam',
        useritem: true,
        open: ()=>{OpenItemClick('dmail', 3, AddDmail);},
    },
    comment: {
        controller: 'comments',
        addons: {group_by: 'comment'},
        only: 'id,creator_id,post_id',
        limit: 10,
        filter: (array, typelist)=>{return array.filter((val)=>{return IsShownData(val, typelist, 'creator_id', 'post_id');})},
        insert: InsertComments,
        process: ()=>{JSPLib.utility.setCSSStyle(COMMENT_CSS, 'comment');},
        plural: 'comments',
        display: "Comments",
        subscribe: InitializeCommentPartialCommentLinks,
    },
    forum: {
        controller: 'forum_posts',
        only: 'id,creator_id,topic_id',
        limit: 10,
        filter: (array,typelist)=>{return array.filter((val)=>{return IsShownData(val, typelist, 'creator_id', 'topic_id');})},
        insert: InsertForums,
        process: ()=>{JSPLib.utility.setCSSStyle(FORUM_CSS, 'forum');},
        plural: 'forums',
        useritem: false,
        open: ()=>{OpenItemClick('forum', 4, AddForumPost);},
        subscribe: InitializeTopicIndexLinks,
    },
    note: {
        controller: 'note_versions',
        only: 'id,updater_id,post_id',
        limit: 10,
        filter: (array, typelist)=>{return array.filter((val)=>{return IsShownData(val, typelist, 'updater_id', 'post_id');})},
        insert: InsertNotes,
        plural: 'notes',
        display: "Notes",
        useritem: false,
        open: ()=>{OpenItemClick('note', 5, AddRenderedNote, AdjustRowspan);},
        subscribe: (table)=>{InitializePostNoteIndexLinks('note', table, false);},
    },
    commentary: {
        controller: 'artist_commentary_versions',
        only: 'id,updater_id,post_id',
        limit: 10,
        filter: (array,typelist)=>{return array.filter((val)=>{return IsShownData(val, typelist, 'updater_id', 'post_id', IsShownCommentary);})},
        insert: InsertEvents,
        plural: 'commentaries',
        display: "Artist commentary",
        useritem: false,
    },
    post: {
        controller: 'post_versions',
        only: 'id,updater_id,post_id',
        limit: 2,
        filter: (array,typelist)=>{return array.filter((val)=>{return IsShownData(val, typelist, 'updater_id', 'post_id');})},
        insert: InsertPosts,
        plural: 'edits',
        display: "Edits",
        useritem: false,
        subscribe: (table)=>{InitializePostNoteIndexLinks('post', table, false);},
    },
    approval: {
        controller: 'post_approvals',
        only: 'id,user_id,post_id',
        limit: 10,
        filter: (array,typelist)=>{return array.filter((val)=>{return IsShownData(val, typelist, 'user_id', 'post_id');})},
        insert: InsertEvents,
        plural: 'approvals',
        display: "Approval",
        useritem: false,
    },
    wiki: {
        controller: 'wiki_page_versions',
        only: 'id,updater_id,wiki_page_id',
        limit: 10,
        filter: (array,typelist)=>{return array.filter((val)=>{return IsShownData(val, typelist, 'updater_id', 'wiki_page_id');})},
        insert: InsertWikis,
        process: ()=>{JSPLib.utility.setCSSStyle(WIKI_CSS, 'wiki');},
        plural: 'wikis',
        useritem: false,
        open: ()=>{OpenItemClick('wiki', 4, AddWiki);},
        subscribe: InitializeWikiIndexLinks,
    },
    pool: {
        controller: 'pool_versions',
        only: 'id,updater_id,pool_id',
        limit: 2,
        filter: (array,typelist)=>{return array.filter((val)=>{return IsShownData(val, typelist, 'updater_id', 'pool_id');})},
        insert: InsertPools,
        process: ()=>{JSPLib.utility.setCSSStyle(POOL_CSS, 'pool');},
        plural: 'pools',
        useritem: false,
        open: ()=>{
            OpenItemClick('pooldiff', 3, AddPoolDiff);
            OpenItemClick('poolposts', 3, AddPoolPosts);
        },
        subscribe: InitializePoolIndexLinks,
    },
    feedback: {
        controller: 'user_feedbacks',
        only: 'id,creator_id,body',
        filter: (array)=>{return array.filter((val)=>{return IsShownData(val, [], 'creator_id', null, IsShownFeedback);})},
        insert: InsertEvents,
        process: ()=>{JSPLib.utility.setCSSStyle(FEEDBACK_CSS, 'feedback');},
        plural: 'feedbacks',
        useritem: false,
    },
    ban: {
        controller: 'bans',
        only: 'id,banner_id',
        filter: (array)=>{return array.filter((val)=>{return IsShownData(val, [], 'banner_id', null, IsShownBan);})},
        insert: InsertEvents,
        process: ()=>{JSPLib.utility.setCSSStyle(BAN_CSS, 'ban');},
        plural: 'bans',
        useritem: false,
    },
    mod_action: {
        controller: 'mod_actions',
        only: 'id,category',
        filter: (array)=>{return array.filter((val)=>{return IsCategorySubscribed(val.category);})},
        insert: InsertEvents,
        plural: 'mod actions',
        useritem: false,
    },
};

//Validate constants

const TYPE_GROUPING = '(?:' + ALL_EVENTS.join('|') + ')';
const SUBSCRIBE_GROUPING = '(?:' + SUBSCRIBE_EVENTS.join('|') + ')';

const ALL_VALIDATE_REGEXES = {
    setting: 'el-user-settings',
    bool: [
        `el-${SUBSCRIBE_GROUPING}overflow`,
        'el-overflow',
    ],
    time: [
        'el-last-seen',
        'el-process-semaphore',
        'el-event-timeout',
        'el-saved-timeout',
    ],
    id: [
        `el-(?:pq-|ot-)?${TYPE_GROUPING}lastid`,
        `el-(?:pq-|ot-)?saved${TYPE_GROUPING}lastid`,
    ],
    idlist: [
        `el-${SUBSCRIBE_GROUPING}list`,
        `el-(?:pq-|ot-)?saved${TYPE_GROUPING}list`,
    ],
};

const VALIDATE_REGEX = XRegExp.build(
    Object.keys(ALL_VALIDATE_REGEXES).map(type => ` ({{${type}}}) `).join('|'),
    Object.assign({}, ...Object.keys(ALL_VALIDATE_REGEXES).map((type)=>{
        let format = "";
        if (typeof ALL_VALIDATE_REGEXES[type] === "string") {
            format = ALL_VALIDATE_REGEXES[type];
        }
        if (Array.isArray(ALL_VALIDATE_REGEXES[type])) {
            format = ALL_VALIDATE_REGEXES[type].join('|');
        }
        return {[type]: format};
    })),
'x');

/****Functions****/

//Validate functions

function ValidateProgramData(key,entry) {
    var checkerror=[];
    let match = XRegExp.exec(key, VALIDATE_REGEX) || {};
    switch (key) {
        case match.setting:
            checkerror = JSPLib.menu.validateUserSettings(entry, SETTINGS_CONFIG);
            break;
        case match.bool:
            if (!JSPLib.validate.isBoolean(entry)) {
                checkerror = ["Value is not a boolean."];
            }
            break;
        case match.time:
            if (!Number.isInteger(entry)) {
                checkerror = ["Value is not an integer."];
            } else if (entry < 0) {
                checkerror = ["Value is not greater than or equal to zero."];
            }
            break;
        case match.id:
            if (!JSPLib.validate.validateID(entry)) {
                checkerror = ["Value is not a valid ID."];
            }
            break;
        case match.idlist:
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

function CorrectList(type,typelist) {
    let error_messages = [];
    if (!JSPLib.validate.validateIDList(typelist[type])) {
        error_messages.push([`Corrupted data on ${type} list!`]);
        let oldlist = JSPLib.utility.dataCopy(typelist[type]);
        typelist[type] = (Array.isArray(typelist[type]) ? typelist[type].filter(id => JSPLib.validate.validateID(id)) : []);
        JSPLib.debug.debugExecute(()=>{
            let validation_error = (Array.isArray(oldlist) ? JSPLib.utility.setDifference(oldlist, typelist[type]) : typelist[type]);
            error_messages.push(["Validation error:", validation_error]);
        });
    }
    if (error_messages.length) {
        error_messages.forEach((error)=>{CorrectList.debuglog(...error);});
        return true;
    }
    return false;
}

//Library functions

JSPLib.utility.createBroadcastChannel = function (name,func) {
    let channel = new BroadcastChannel(name);
    channel.onmessage = func;
    return channel;
};

JSPLib.debug._getFuncTimerName = function (func,args,nameindex) {
   let timer_name = func.name;
    if (Number.isInteger(nameindex) && args[nameindex] !== undefined) {
        timer_name += '.' + args[nameindex];
    } else if (Array.isArray(nameindex)) {
        for (let i = 0; i < nameindex.length; i++) {
            let argindex = nameindex[i];
            if (args[argindex] !== undefined) {
                timer_name += '.' + args[argindex];
            } else {
                break;
            }
        }
    }
    return timer_name;
};

JSPLib.debug.debugSyncTimer = function (func,nameindex) {
    return function(...args) {
        let timer_name = JSPLib.debug._getFuncTimerName(func,args,nameindex);
        JSPLib.debug.debugTime(timer_name);
        let ret = func(...args);
        JSPLib.debug.debugTimeEnd(timer_name);
        return ret;
    }
};

JSPLib.debug.debugAsyncTimer = function (func,nameindex) {
    return async function(...args) {
        let timer_name = JSPLib.debug._getFuncTimerName(func,args,nameindex);
        JSPLib.debug.debugTime(timer_name);
        let ret = await func(...args);
        JSPLib.debug.debugTimeEnd(timer_name);
        return ret;
    }
};

JSPLib.debug.addFunctionTimers = function (hash,is_async,itemlist) {
    let timerFunc = (is_async ? JSPLib.debug.debugAsyncTimer : JSPLib.debug.debugSyncTimer);
    itemlist.forEach((item)=>{
        let func = item;
        let nameindex = null;
        if (Array.isArray(item)) {
            if (typeof item[0] === 'function' && item.length > 1 && item.slice(1).every(val => Number.isInteger(val))) {
                func = item[0];
                if (item.length === 2) {
                    nameindex = item[1];
                } else {
                    nameindex = item.slice(1);
                }
            } else {
                throw "JSPLib.debug.addFunctionTimers: Invalid array parameter";
            }
        } else if (typeof item !== 'function') {
            throw "JSPLib.debug.addFunctionTimers: Item is not a function";
        }
        hash[func.name] = timerFunc(func,nameindex);
        func.debuglog = function (...args) {
            JSPLib.debug.debuglog(`${func.name} -`,...args);
        };
    });
};

JSPLib.menu.getProgramValues = function (program_shortcut,setting_name,is_control=false) {
    let program_key = program_shortcut.toUpperCase();
    let config = (!is_control ? Danbooru[program_key].settings_config: Danbooru[program_key].control_config);
    let setting_key = JSPLib.utility.kebabCase(setting_name);
    let display_name = JSPLib.utility.displayCase(setting_name);
    let item = (!is_control ? Danbooru[program_key].user_settings[setting_name] : config[setting_name].value);
    return [config,setting_key,display_name,item];
};

JSPLib.menu.renderInputSelectors = function (program_shortcut,setting_name,type,is_control=false,has_submit=false) {
    let [config,setting_key,display_name,enabled_selectors] = JSPLib.menu.getProgramValues(program_shortcut,setting_name,is_control);
    //The name must be the same for all selectors for radio buttons to work properly
    let selection_name = `${program_shortcut}-${setting_key}`;
    let menu_type = (is_control ? 'control' : 'setting');
    let submit_control = (is_control && has_submit ? JSPLib.menu.renderControlGet(program_shortcut,setting_key,2) : '');
    let hint_html = JSPLib.menu.renderSettingHint(program_shortcut,"block",config[setting_name].hint);
    let html = "";
    config[setting_name].allitems.forEach((selector)=>{
        let checked = (enabled_selectors.includes(selector) ? "checked" : "");
        let display_selection = JSPLib.utility.displayCase(selector);
        let selection_key = `${program_shortcut}-select-${setting_key}-${selector}`;
        html += `
            <label for="${selection_key}">${display_selection}</label>
            <input type="${type}" ${checked} class="${program_shortcut}-${menu_type} jsplib-${menu_type}" name="${selection_name}" id="${selection_key}" data-selector="${selector}" data-parent="2">`;
    });
    return `
<div class="${program_shortcut}-selectors jsplib-selectors jsplib-menu-item" data-setting="${setting_name}">
    <h4>${display_name}</h4>
    <div>
        ${html}
        ${submit_control}
        ${hint_html}
    </div>
</div>`;
};

JSPLib.menu.renderTextinput = function (program_shortcut,setting_name,length=20,is_control=false) {
    let [config,setting_key,display_name,value] = JSPLib.menu.getProgramValues(program_shortcut,setting_name,is_control);
    let textinput_key = `${program_shortcut}-setting-${setting_key}`;
    let menu_type = (is_control ? 'control' : 'setting');
    let submit_control = "";
    if (is_control && config[setting_name].buttons.length) {
        config[setting_name].buttons.forEach((button)=>{
            submit_control += JSPLib.menu.renderControlButton(program_shortcut,setting_key,button,2);
        });
    }
    let hint_html = JSPLib.menu.renderSettingHint(program_shortcut,"block",config[setting_name].hint);
    return `
<div class="${program_shortcut}-textinput jsplib-textinput jsplib-menu-item" data-setting="${setting_name}">
    <h4>${display_name}</h4>
    <div>
        <input type="text" class="${program_shortcut}-${menu_type} jsplib-${menu_type}" name="${textinput_key}" id="${textinput_key}" value="${value}" size="${length}" autocomplete="off" data-parent="2">
        ${submit_control}
        ${hint_html}
    </div>
</div>`;
};

JSPLib.menu.renderLinkclick = function (program_shortcut,setting_name) {
    let [config,setting_key,display_name,link_text] = JSPLib.menu.getProgramValues(program_shortcut,setting_name,true);
    let hint_html = JSPLib.menu.renderSettingHint(program_shortcut,"inline",config[setting_name].hint);
    return `
<div class="${program_shortcut}-linkclick jsplib-linkclick jsplib-menu-item">
    <h4>${display_name}</h4>
    <div>
        <b>
            <span class="${program_shortcut}-control jsplib-control">
                [ <a href="javascript:void(0)" id="${program_shortcut}-control-${setting_key}">${link_text}</a> ]
            </span>
        </b>
        &emsp;
        ${hint_html}
    </div>
</div>`;
};

JSPLib.danbooru.getPostsCountdown = async function (searchstring,limit,domname) {
    let tag_addon = {tags: searchstring};
    let limit_addon = {limit: limit};
    let page_addon = {};
    var return_items = [];
    let page_num = 0;
    if (domname) {
        let total_posts = (await JSPLib.danbooru.submitRequest('counts/posts',tag_addon,{counts:{posts: 0}})).counts.posts;
        page_num = Math.ceil(total_posts/limit);
    }
    while (true) {
        JSPLib.debug.debuglogLevel("JSPLib.danbooru.getPostsCountdown: Pages left #",page_num,JSPLib.debug.INFO);
        if (domname) {
            jQuery(domname).html(page_num);
        }
        let request_addons = JSPLib.utility.joinArgs(tag_addon,limit_addon,page_addon);
        let request_key = 'posts-' + jQuery.param(request_addons);
        let temp_items = await JSPLib.danbooru.submitRequest('posts',request_addons,[],request_key);
        return_items = JSPLib.utility.concat(return_items, temp_items);
        if (temp_items.length < limit) {
            return return_items;
        }
        let lastid = JSPLib.danbooru.getNextPageID(temp_items,false);
        page_addon = {page:`b${lastid}`};
        page_num -= 1;
    }
};

JSPLib.danbooru.getAllItems = async function (type,limit,batches,options) {
    let url_addons = options.addons || {};
    let reverse = options.reverse || false;
    let page_modifier = (reverse ? 'a' : 'b');
    let page_addon = (Number.isInteger(options.page) ? {page:`${page_modifier}${options.page}`} : {});
    let limit_addon = {limit: limit};
    let batch_num = 1;
    var return_items = [];
    while (true) {
        let request_addons = JSPLib.utility.joinArgs(url_addons,page_addon,limit_addon);
        let temp_items = await JSPLib.danbooru.submitRequest(type,request_addons,[],null,options.domain,options.notify);
        return_items = JSPLib.utility.concat(return_items, temp_items);
        if (temp_items.length < limit || (batches && batch_num >= batches)) {
            return return_items;
        }
        let lastid = JSPLib.danbooru.getNextPageID(temp_items,reverse);
        page_addon = {page:`${page_modifier}${lastid}`};
        JSPLib.debug.debuglogLevel("#",batch_num++,"Rechecking",type,"@",lastid,JSPLib.debug.INFO);
    }
};

JSPLib.danbooru.getShowID = function() {
    return (document.body.dataset.action === "show" && parseInt(JSPLib.utility.findAll(window.location.pathname,/\d+\/?$/)[0])) || 0;
};

//Helper functions

async function SetRecentDanbooruID(type,qualifier) {
    let type_addon = TYPEDICT[type].addons || {};
    let url_addons = JSPLib.utility.joinArgs(type_addon, {only: 'id', limit: 1});
    let jsonitem = await JSPLib.danbooru.submitRequest(TYPEDICT[type].controller, url_addons, []);
    if (jsonitem.length) {
        SaveLastID(type, JSPLib.danbooru.getNextPageID(jsonitem, true), qualifier);
    } else if (TYPEDICT[type].useritem) {
        SaveLastID(type, 1, qualifier);
    }
}

function IsEventEnabled(type,event_type) {
    return EL.user_settings[event_type].includes(type);
}

function IsAnyEventEnabled(event_list,event_type) {
    return Boolean(JSPLib.utility.setIntersection(event_list, EL.user_settings[event_type]).length);
}

function AreAllEventsEnabled(event_list,event_type) {
    return !JSPLib.utility.setDifference(event_list, EL.user_settings[event_type]).length;
}

function IsCategorySubscribed(type) {
    return EL.user_settings.subscribed_mod_actions.includes(type);
}

function GetTypeQuery(type) {
    return EL.user_settings[type + '_query'];
}

function HideDmailNotice() {
    let $dmail_notice = $('#dmail-notice');
    if ($dmail_notice.length) {
        $dmail_notice.hide();
        let dmail_id = $dmail_notice.data('id');
        JSPLib.utility.createCookie('hide_dmail_notice', dmail_id);
    }
}

function GetInstanceID(type,func) {
    try {
        if (EL.controller === type) {
            return (EL.showid > 0 ? EL.showid : JSPLib.utility.throw(0));
        } else {
            return (func ? func() : JSPLib.utility.throw(-1));
        }
    } catch (e) {
        //Bail if page is not as expected
        if (Number.isInteger(e)) {
            if (e === 0) {
                JSPLib.utility.error("Warning: URL is malformed!");
            } else {
                JSPLib.utility.error("Warning: Wrong action for URL!");
            }
        } else {
            JSPLib.utility.error("Warning: Page missing required elements!");
            GetInstanceID.debuglog("Exception:", e);
        }
        return false;
    }
}

//Data storage functions

function GetList(type) {
    if (EL.subscribelist[type]) {
        return EL.subscribelist[type];
    }
    EL.subscribelist[type] = JSPLib.storage.getStorageData(`el-${type}list`, localStorage, []);
    if (CorrectList(type, EL.subscribelist)) {
        setTimeout(()=>{JSPLib.storage.setStorageData(`el-${type}list`, EL.subscribelist[type], localStorage);}, 1);
    }
    return EL.subscribelist[type];
}

function SetList(type,input) {
    let typelist = GetList(type);
    let was_subscribed, itemid;
    if (input[0] == '-') {
        itemid = parseInt(input.slice(1));
        typelist = JSPLib.utility.setDifference(typelist, [itemid]);
        was_subscribed = true;
    } else {
        itemid = parseInt(input);
        typelist.push(itemid);
        was_subscribed = false;
    }
    EL.subscribelist[type] = JSPLib.utility.setUnique(typelist);
    JSPLib.storage.setStorageData(`el-${type}list`, EL.subscribelist[type], localStorage);
    EL.channel.postMessage({type: 'subscribe', eventtype: type, was_subscribed: was_subscribed, itemid: itemid, eventlist: EL.subscribelist[type]});
}

//Quicker way to check list existence; avoids unnecessarily parsing very long lists
function CheckList(type) {
    let typelist = localStorage.getItem(`el-${type}list`);
    return typelist && typelist !== '[]';
}

//Auxiliary functions

function SaveLastID(type,lastid,qualifier='') {
    if (!JSPLib.validate.validateID(lastid)) {
        return;
    }
    qualifier += (qualifier.length > 0 ? '-' : '');
    let key = `el-${qualifier}${type}lastid`;
    let previousid = JSPLib.storage.checkStorageData(key, ValidateProgramData, localStorage, 1);
    lastid = Math.max(previousid, lastid);
    JSPLib.storage.setStorageData(key, lastid, localStorage);
    SaveLastID.debuglog(`Set last ${qualifier}${type} ID:`, lastid);
}

function WasOverflow() {
    return JSPLib.storage.checkStorageData('el-overflow', ValidateProgramData, localStorage, false);
}

function SetLastSeenTime() {
    JSPLib.storage.setStorageData('el-last-seen', Date.now(), localStorage);
}

//Return true if there was no overflow at all, or overflow for the input type
function CheckOverflow(inputtype) {
    if (Object.keys(CheckOverflow.all_overflows).length == 0) {
        let enabled_events = JSPLib.utility.setIntersection(SUBSCRIBE_EVENTS, EL.user_settings.subscribe_events_enabled);
        enabled_events.forEach((type)=>{
            CheckOverflow.all_overflows[type] = JSPLib.storage.checkStorageData(`el-${type}overflow`, ValidateProgramData, localStorage, false);
            CheckOverflow.any_overflow = CheckOverflow.any_overflow || CheckOverflow.all_overflows[type];
        });
    }
    if (!SUBSCRIBE_EVENTS.includes(inputtype)) {
        return false;
    }
    return !(Object.values(CheckOverflow.all_overflows).reduce((total,entry)=>{return total || entry;}, false)) || CheckOverflow.all_overflows[inputtype];
}
CheckOverflow.all_overflows = {};

function ProcessEvent(inputtype, optype) {
    if (!JSPLib.menu.isSettingEnabled('EL', optype, inputtype)) {
        return false;
    }
    if (optype === 'subscribe_events_enabled' && !CheckList(inputtype)) {
        return false;
    }
    //Waits always have priority over overflows
    JSPLib.debug.debugExecute(()=>{
        ProcessEvent.debuglog(inputtype,
                              (CheckOverflow(inputtype) && CheckOverflow.any_overflow),
                              (!CheckOverflow.any_overflow));
    });
    if ((CheckOverflow(inputtype) && CheckOverflow.any_overflow) || /*Check for any overflow event but not a wait event*/
        (!CheckOverflow.any_overflow) /*Check for no overflows*/) {
        switch(optype) {
            case 'post_query_events_enabled':
                return TIMER.CheckPostQueryType(inputtype);
            case 'subscribe_events_enabled':
                return TIMER.CheckSubscribeType(inputtype);
            case 'other_events_enabled':
                return TIMER.CheckOtherType(inputtype);
        }
    }
    return false;
}

function CheckAbsence() {
    let last_seen = JSPLib.storage.getStorageData('el-last-seen', localStorage, 0);
    let time_absent = Date.now() - last_seen;
    if (last_seen === 0 || (time_absent < JSPLib.utility.one_day)) {
        return true;
    }
    EL.days_absent = JSPLib.utility.setPrecision(time_absent / JSPLib.utility.one_day, 2);
    return false;
}

//Table row functions

//Get single instance of various types and insert into table row

async function AddForumPost(forumid,rowelement) {
    let forum_page = await JSPLib.network.getNotify(`/forum_posts/${forumid}`);
    if (!forum_page) {
        return;
    }
    let $forum_page = $.parseHTML(forum_page);
    let $forum_post = $(`#forum_post_${forumid}`, $forum_page);
    let $outerblock = $.parseHTML(RenderOpenItemContainer('forum', forumid, 4));
    $('td', $outerblock).append($forum_post);
    $(rowelement).after($outerblock);
    if (EL.user_settings.mark_read_topics) {
        let topic_link = $('td:first-of-type > a', rowelement);
        let topic_path = topic_link.length && topic_link[0].pathname;
        let topic_match = topic_path && topic_path.match(FORUM_TOPICS_REGEX);
        if (topic_match && !EL.marked_topic.includes(topic_match[1])) {
            ReadForumTopic(topic_match[1]);
            EL.marked_topic.push(topic_match[1]);
        }
    }
}

function AddRenderedNote(noteid,rowelement) {
    let notehtml = $('.el-note-body', rowelement).html();
    notehtml = notehtml && $.parseHTML(notehtml.trim())[0].textContent;
    let $outerblock = $.parseHTML(RenderOpenItemContainer('note', noteid, 7));
    $('td', $outerblock).append(notehtml);
    $(rowelement).after($outerblock);
}

async function AddDmail(dmailid,rowelement) {
    let dmail = await JSPLib.network.getNotify(`/dmails/${dmailid}`);
    if (!dmail) {
        return;
    }
    let $dmail = $.parseHTML(dmail);
    $('.dmail h1:first-of-type', $dmail).hide();
    let $outerblock = $.parseHTML(RenderOpenItemContainer('dmail', dmailid, 4));
    $('td', $outerblock).append($('.dmail', $dmail));
    $(rowelement).after($outerblock);
}

async function AddWiki(wikiverid,rowelement) {
    let wikiid = rowelement.innerHTML.match(WIKI_PAGES_REGEX)[1];
    let url_addons = {search: {wiki_page_id: wikiid}, page: `b${wikiverid}`, only: 'id', limit: 1};
    let prev_wiki = await JSPLib.danbooru.submitRequest('wiki_page_versions', url_addons);
    if (prev_wiki.length) {
        let wiki_diff_page = await JSPLib.network.getNotify('/wiki_page_versions/diff', {otherpage: wikiverid, thispage: prev_wiki[0].id});
        if (!wiki_diff_page) {
            return;
        }
        let $wiki_diff_page = $.parseHTML(wiki_diff_page);
        let $outerblock = $.parseHTML(RenderOpenItemContainer('wiki', wikiverid, 4));
        $('td', $outerblock).append($('#a-diff #content p', $wiki_diff_page));
        let wiki_diff= $('#a-diff #content div', $wiki_diff_page).html().replace(/<br>/g, PARAGRAPH_MARK);
        $('td', $outerblock).append(wiki_diff);
        $(rowelement).after($outerblock);
    } else {
        JSPLib.utility.notice("Wiki creations have no diff!");
    }
}

async function AddPoolDiff(poolverid,rowelement) {
    let pool_diff = await JSPLib.network.getNotify(`/pool_versions/${poolverid}/diff`);
    let $pool_diff = $.parseHTML(pool_diff);
    let old_desc = $('#a-diff li:nth-of-type(2)', $pool_diff).text().replace(POOL_DESC_REGEX, "");
    let new_desc = $('#a-diff li:nth-of-type(3)', $pool_diff).text().replace(POOL_DESC_REGEX, "");
    //Description creations will have no new descriptions
    if (new_desc === "") {
        new_desc = old_desc;
        old_desc = "";
    }
    let desc_diffs = Diff.diffWords(old_desc,new_desc);
    let diff_desc = desc_diffs.map((entry)=>{
        if (entry.added) {
            return `<ins>${entry.value}</ins>`;
        } else if (entry.removed) {
            return `<del>${entry.value}</del>`;
        } else {
            return entry.value;
        }
    }).join("").replace(/\n/g, PARAGRAPH_MARK);
    let $outerblock = $.parseHTML(RenderOpenItemContainer('pooldiff', poolverid, 6));
    $('td', $outerblock).append(diff_desc);
    $(rowelement).after($outerblock);
}

async function AddPoolPosts(poolverid,rowelement) {
    let $post_changes = $('td:nth-of-type(2)', rowelement);
    let add_posts = String($post_changes.data('add-posts') || "").split(',');
    let rem_posts = String($post_changes.data('rem-posts') || "").split(',');
    let total_posts = JSPLib.utility.concat(add_posts, rem_posts);
    let missing_posts = JSPLib.utility.setDifference(total_posts, Object.keys(EL.thumbs));
    if (missing_posts.length) {
        let thumbnails = await JSPLib.network.getNotify(`/posts`, {tags: 'id:' + missing_posts.join(',') + ' status:any'});
        let $thumbnails = $.parseHTML(thumbnails);
        $('.post-preview', $thumbnails).each((i,thumb)=>{InitializeThumb(thumb);});
    }
    let $outerblock = $.parseHTML(RenderOpenItemContainer('poolposts', poolverid, 6));
    $('td', $outerblock).append(`<div class="el-add-pool-posts" style="display:none"></div><div class="el-rem-pool-posts" style="display:none"></div>`);
    if (add_posts.length) {
        let $container = $('.el-add-pool-posts', $outerblock).show();
        add_posts.forEach((post_id)=>{
            let thumb_copy = $(EL.thumbs[post_id]).clone();
            $container.append(thumb_copy);
        });
    }
    if (rem_posts.length) {
        let $container = $('.el-rem-pool-posts', $outerblock).show();
        rem_posts.forEach((post_id)=>{
            let thumb_copy = $(EL.thumbs[post_id]).clone();
            $container.append(thumb_copy);
        });
    }
    $(rowelement).after($outerblock);
}

//Update links

function UpdateMultiLink(typelist,subscribed,itemid) {
    let current_subscribed = JSPLib.utility.setUnique($('#el-subscribe-events .el-subscribed').map((i,entry)=>{return entry.dataset.type.split(',');}).toArray());
    let new_subscribed = (subscribed ? JSPLib.utility.setDifference(current_subscribed, typelist) : JSPLib.utility.setUnion(current_subscribed, typelist));
    $(`#el-subscribe-events[data-id="${itemid}"] .el-subscribed, #el-subscribe-events[data-id="${itemid}"] .el-unsubscribed`).each((i,entry)=>{
        let entry_typelist = entry.dataset.type.split(',');
        if (JSPLib.utility.setIntersection(entry_typelist, new_subscribed).length === entry_typelist.length) {
            $(entry).removeClass().addClass('el-subscribed');
        } else {
            $(entry).removeClass().addClass('el-unsubscribed');
        }
    });
}

function UpdateDualLink(type,subscribed,itemid) {
    let show = (subscribed ? 'subscribe' : 'unsubscribe');
    let hide = (subscribed ? 'unsubscribe' : 'subscribe');
    JSPLib.utility.fullHide(`.el-subscribe-dual-links[data-type="${type}"][data-id="${itemid}"] .el-${hide}`);
    JSPLib.utility.clearHide(`.el-subscribe-dual-links[data-type="${type}"][data-id="${itemid}"] .el-${show}`);
}

function ToggleSubscribeLinks() {
    SUBSCRIBE_EVENTS.forEach((type)=>{
        if (IsEventEnabled(type, 'subscribe_events_enabled')) {
            $(`.el-subscribe-${type}-container`).show();
        } else {
            $(`.el-subscribe-${type}-container`).hide();
        }
    });
    if (EL.controller === 'posts' && EL.action === 'show') {
        if (AreAllEventsEnabled(ALL_TRANSLATE_EVENTS, 'subscribe_events_enabled')) {
            $('.el-subscribe-translated-container').show();
        } else {
            $('.el-subscribe-translated-container').hide();
        }
        if (IsAnyEventEnabled(ALL_POST_EVENTS, 'subscribe_events_enabled')) {
            $('#el-subscribe-events').show();
            let enabled_post_events = JSPLib.utility.setIntersection(ALL_POST_EVENTS, EL.user_settings.subscribe_events_enabled);
            $('#el-all-link').attr('data-type', enabled_post_events);
        } else {
            $('#el-subscribe-events').hide();
        }
    }
}

//Insert and process HTML onto page for various types

function InsertEvents($eventpage,type) {
    $(`#el-${type}-table`).append($('.striped', $eventpage));
    $(`#el-${type}-table .post-preview`).addClass('blacklisted');
}

function InsertDmails($dmailpage,type) {
    DecodeProtectedEmail($dmailpage);
    $('tr.read-false', $dmailpage).css('font-weight', 'bold');
    let $dmails_table = $(`#el-${type}-table`);
    $dmails_table.append($('.striped', $dmailpage));
    InitializeOpenDmailLinks($dmails_table[0]);
}

function InsertComments($commentpage) {
    DecodeProtectedEmail($commentpage);
    $('.post-preview', $commentpage).addClass('blacklisted');
    let $commentsection = $('.list-of-comments', $commentpage);
    $('#el-comment-table').append($commentsection);
    InitializeCommentPartialCommentLinks($commentsection);
}

function InsertForums($forumpage) {
    DecodeProtectedEmail($forumpage);
    let $forums_table = $('#el-forum-table');
    $forums_table.append($('.striped', $forumpage));
    InitializeTopicIndexLinks($forums_table[0]);
    InitializeOpenForumLinks($forums_table[0]);
}

function InsertNotes($notepage) {
    DecodeProtectedEmail($notepage);
    let $notes_table = $('#el-note-table');
    $notes_table.append($('.striped', $notepage));
    $('th:first-of-type, td:first-of-type', $notes_table[0]).remove();
    $('td:nth-of-type(1)', $notes_table[0]).addClass('el-post-id');
    $('td:nth-of-type(2)', $notes_table[0]).addClass('el-note-id');
    $('td:nth-of-type(3)', $notes_table[0]).addClass('el-note-body');
    AddThumbnails($notes_table[0]);
    InitializePostNoteIndexLinks('note', $notes_table[0]);
    InitializeOpenNoteLinks($notes_table[0]);
}

function InsertPosts($postpage) {
    let $posts_table = $('#el-post-table');
    $posts_table.append($('.striped', $postpage));
    $('.striped th:first-of-type, .striped td:first-of-type', $posts_table[0]).remove();
    $('.striped tr[id]', $posts_table[0]).each((i,row)=>{
        let post_link = $('td:first-of-type a', row).attr('href');
        let match = post_link && post_link.match(POSTS_REGEX);
        if (!match) {
            return;
        }
        $('td:first-of-type', row).html(`<a href="${post_link}">post #${match[1]}</a>`);
    });
    AddThumbnails($posts_table[0]);
    InitializePostNoteIndexLinks('post', $posts_table[0]);
}

function InsertWikis($wikipage) {
    DecodeProtectedEmail($wikipage);
    let $wikis_table = $('#el-wiki-table');
    $wikis_table.append($('.striped', $wikipage));
    InitializeWikiIndexLinks($wikis_table[0]);
    InitializeOpenWikiLinks($wikis_table[0]);
}

function InsertPools($poolpage) {
    DecodeProtectedEmail($poolpage);
    let $pools_table = $('#el-pool-table');
    $pools_table.append($('.striped', $poolpage));
    $('.pool-category-collection, .pool-category-series', $pools_table[0]).each((i,entry)=>{
        let short_pool_title = JSPLib.utility.maxLengthString(entry.innerText, 50);
        $(entry).attr('title', entry.innerText);
        entry.innerText = short_pool_title;
    });
    InitializePoolIndexLinks($pools_table[0]);
    InitializeOpenPoolLinks($pools_table[0]);
}

function InitializeThumb(thumb) {
    let $thumb = $(thumb);
    $thumb.addClass('blacklisted');
    let postid = String($thumb.data('id'));
    let $link = $('a', thumb);
    let post_url = $link.attr('href').split('?')[0];
    $link.attr('href', post_url);
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
    $('[data-cfemail]', obj).each((i,entry)=>{
        let encoded_email = $(entry).data('cfemail');
        let percent_decode = "";
        let xorkey = '0x' + encoded_email.substr(0, 2) | 0;
        for(let n = 2; encoded_email.length - n; n += 2) {
            percent_decode+= '%' + ( '0' + ('0x' + encoded_email.substr(n, 2) ^ xorkey).toString(16)).slice(-2);
        }
        entry.outerHTML = decodeURIComponent(percent_decode);
    });
}

function AddThumbnails(dompage) {
    $('.striped thead tr', dompage).prepend('<th>Thumb</th>');
    var row_save = {};
    var post_ids = [];
    $('.striped tr[id]', dompage).each((i,row)=>{
        let $postlink = $('td:first-of-type a:first-of-type', row);
        let match = $postlink.length && $postlink.attr('href').match(/\/posts\/(\d+)/);
        if (!match) {
            //Something is wrong... break loop
            return false;
        }
        let postid = parseInt(match[1]);
        post_ids.push(postid);
        row_save[postid] = row_save[postid] || [];
        row_save[postid].push($(row).detach());
    });
    post_ids = JSPLib.utility.setUnique(post_ids).sort().reverse();
    var $body = $('.striped tbody', dompage);
    post_ids.forEach((postid)=>{
        row_save[postid][0].prepend(`<td rowspan="${row_save[postid].length}" class="el-post-thumbnail" data-postid="${postid}"></td>`);
        row_save[postid].forEach((row)=>{
            $body.append(row);
        });
    });
    EL.post_ids = JSPLib.utility.setUnion(EL.post_ids, post_ids);
}

async function GetThumbnails() {
    let found_post_ids = Object.keys(EL.thumbs).map(Number);
    for (let i = 0; i < EL.post_ids.length; i += QUERY_LIMIT) {
        let post_ids = EL.post_ids.slice(i, i + QUERY_LIMIT);
        let missing_post_ids = JSPLib.utility.setDifference(post_ids, found_post_ids);
        if (missing_post_ids.length === 0) {
            continue;
        }
        var url_addon = {tags: `id:${missing_post_ids} limit:${missing_post_ids.length}`};
        var html = await JSPLib.network.getNotify('/posts', url_addon);
        var $posts = $.parseHTML(html);
        var $thumbs = $('.post-preview', $posts);
        $thumbs.each((i,thumb)=>{
            InitializeThumb(thumb);
        });
    }
}

function InsertThumbnails() {
    $('#el-event-notice .el-post-thumbnail').each((i,marker)=>{
        let $marker = $(marker);
        let post_id = String($marker.data('postid'));
        let thumb_copy = $(EL.thumbs[post_id]).clone();
        $marker.prepend(thumb_copy);
    });
}

function ProcessThumbnails() {
    $('#el-event-notice .post-preview').each((i,thumb)=>{
        let $thumb = $(thumb);
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

function AdjustRowspan(rowelement,openitem) {
    let postid = $('.el-post-id a:first-of-type', rowelement).html();
    let $thumb_cont = $(`#el-note-table .el-post-thumbnail[data-postid="${postid}"]`);
    let current_rowspan = $thumb_cont.attr('rowspan');
    let new_rowspan = parseInt(current_rowspan) + (openitem ? 1 : -1);
    $thumb_cont.attr('rowspan', new_rowspan);
}

//Render functions

function RenderMultilinkMenu(itemid,all_types) {
    let shown = (all_types.length === 0 || IsAnyEventEnabled(all_types, 'subscribe_events_enabled') ? "" : 'style="display:none"');
    return `
<menu id="el-subscribe-events" data-id="${itemid}" ${shown}>
    Subscribe (<span id="el-add-links"></span>)
</menu>`;
}

function RenderSubscribeDualLinks(type,itemid,tag,separator,ender,right=false) {
    let typelist = GetList(type);
    let subscribe = (typelist.includes(itemid) ? 'style="display:none !important"' : 'style');
    let unsubscribe = (typelist.includes(itemid) ? 'style' : 'style="display:none !important"');
    let spacer = (right ? "&nbsp;&nbsp;" : "");
    return `
<${tag} class="el-subscribe-dual-links"  data-type="${type}" data-id="${itemid}">
    <${tag} class="el-subscribe" ${subscribe}><a class="el-monospace-link" href="javascript:void(0)">${spacer}Subscribe${separator}${ender}</a></${tag}>
    <${tag} class="el-unsubscribe" ${unsubscribe}"><a class="el-monospace-link" href="javascript:void(0)">Unsubscribe${separator}${ender}</a></${tag}>
</${tag}>`;
}

function RenderSubscribeMultiLinks(name,typelist,itemid) {
    let itemdict = {};
    typelist.forEach((type)=>{
        itemdict[type] = GetList(type);
    });
    let is_subscribed = typelist.every((type)=>itemdict[type].includes(itemid));
    let classname = (is_subscribed ? 'el-subscribed' : 'el-unsubscribed');
    let keyname = JSPLib.utility.kebabCase(name);
    let idname = 'el-' + keyname + '-link';
    return `<li id="${idname}" data-type="${typelist}" class="${classname}"><a href="javascript:void(0)">${name}</a></li>`;
}

function RenderOpenItemLinks(type,itemid,showtext="Show",hidetext="Hide") {
    return `
<span class="el-show-hide-links" data-type="${type}" data-id="${itemid}">
    <span data-action="show" style><a class="el-monospace-link" href="javascript:void(0)">${showtext}</a></span>
    <span data-action="hide" style="display:none !important"><a class="el-monospace-link" href="javascript:void(0)">${hidetext}</a></span>
</span>`;
}

function RenderOpenItemContainer(type,itemid,columns) {
    return `
<tr class="el-full-item" data-type="${type}" data-id="${itemid}">
    <td colspan="${columns}"></td>
</tr>`;
}

//Initialize functions

function InitializeNoticeBox(notice_html) {
    $('#page').prepend(NOTICE_BOX);
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
}

function InitializeOpenForumLinks(table) {
    $('.striped tbody tr', table).each((i,row)=>{
        let match = row.id.match(/(\d+)$/);
        if (!match) {
            return;
        }
        let forumid = match[1];
        let link_html = RenderOpenItemLinks('forum',forumid);
        $('.forum-post-excerpt', row).prepend(link_html + '&nbsp;|&nbsp;');
    });
    OpenItemClick('forum', 4, AddForumPost);
}

function InitializeOpenNoteLinks(table) {
    $('.striped tr[id]', table).each((i,row)=>{
        let noteid = $('.el-note-id a', row).html();
        noteid = noteid && noteid.replace('.', '-');
        if (!noteid) {
            return;
        }
        let link_html = RenderOpenItemLinks('note', noteid, "Render note", "Hide note");
        $('.el-note-body', row).append(`<p style="text-align:center">${link_html}</p>`);
    });
    OpenItemClick('note', 5, AddRenderedNote, AdjustRowspan);
}

function InitializeOpenDmailLinks(table) {
    $('.striped tbody tr', table).each((i,row)=>{
        let match = row.innerHTML.match(DMAILS_REGEX);
        if (!match) {
            return;
        }
        let dmailid = match[1];
        let link_html = RenderOpenItemLinks('dmail', dmailid);
        $('td:nth-of-type(4)', row).prepend(link_html + '&nbsp;|&nbsp;');
    });
    OpenItemClick('dmail', 3, AddDmail);
}

function InitializeOpenWikiLinks(table) {
    $('.striped tbody tr', table).each((i,row)=>{
        let match = row.innerHTML.match(WIKI_PAGE_VERSIONS_REGEX);
        if (!match) {
            return;
        }
        let wikiverid = parseInt(match[1]);
        let link_html = RenderOpenItemLinks('wiki', wikiverid, "Show diff", "Hide diff");
        $('.category-0, .category-1, .category-3, .category-4, .category-5', row).append(`<span style="float:right">(${link_html})</span>`);
    });
    OpenItemClick('wiki', 4, AddWiki);
}

function InitializeOpenPoolLinks(table) {
    $('.striped tbody tr', table).each((i,row)=>{
        let match = row.id.match(/\d+$/);
        if (!match) {
            return;
        }
        let poolverid = parseInt(match[0]);
        let $post_changes = $('td:nth-of-type(2)', row);
        let add_posts = $('.diff-list ins a[href^="/posts"]', $post_changes[0]).map((i,entry)=>{return entry.innerText;}).toArray();
        let rem_posts = $('.diff-list del a[href^="/posts"]', $post_changes[0]).map((i,entry)=>{return entry.innerText;}).toArray();
        if (add_posts.length || rem_posts.length) {
            let link_html = RenderOpenItemLinks('poolposts', poolverid, 'Show posts', 'Hide posts');
            $post_changes.prepend(link_html + '&nbsp;|&nbsp;');
            $post_changes.attr('data-add-posts', add_posts);
            $post_changes.attr('data-rem-posts', rem_posts);
        }
        let $desc_changed = $('td:nth-of-type(4)', row);
        if ($desc_changed.html() !== 'false') {
            let link_html = RenderOpenItemLinks('pooldiff', poolverid, 'Show diff', 'Hide diff');
            $desc_changed.append(`&nbsp;(${link_html})`);
        }
    });
    OpenItemClick('pooldiff', 3, AddPoolDiff);
    OpenItemClick('poolposts', 3, AddPoolPosts);
}

//#C-POSTS #A-SHOW
function InitializePostShowMenu() {
    let postid = GetInstanceID('posts');
    if (!postid) {
        return;
    }
    let $menu_obj = $.parseHTML(RenderMultilinkMenu(postid, ALL_POST_EVENTS));
    ALL_POST_EVENTS.forEach((type)=>{
        let linkhtml = RenderSubscribeMultiLinks(TYPEDICT[type].display, [type], postid);
        let shownhtml = (IsEventEnabled(type, 'subscribe_events_enabled') ? "" : 'style="display:none"');
        $('#el-add-links', $menu_obj).append(`<span class="el-subscribe-${type}-container" ${shownhtml}>${linkhtml} | </span>`);
    });
    let shownhtml = (AreAllEventsEnabled(ALL_TRANSLATE_EVENTS, 'subscribe_events_enabled') ? "" : 'style="display:none"');
    let linkhtml = RenderSubscribeMultiLinks("Translations", ALL_TRANSLATE_EVENTS, postid);
    $('#el-add-links', $menu_obj).append(`<span class="el-subscribe-translated-container" ${shownhtml}>${linkhtml} | </span>`);
    //The All link is always shown when the outer menu is shown, so no need to individually hide it
    let enabled_post_events = JSPLib.utility.setIntersection(ALL_POST_EVENTS, EL.user_settings.subscribe_events_enabled);
    linkhtml = RenderSubscribeMultiLinks("All", enabled_post_events, postid);
    $('#el-add-links', $menu_obj).append(`<span class="el-subscribe-all-container">${linkhtml}</span>`);
    $('#nav').append($menu_obj);
    $('#el-subscribe-events a').off(PROGRAM_CLICK).on(PROGRAM_CLICK, SubscribeMultiLink);
}

//#C-FORUM-TOPICS #A-SHOW
function InitializeTopicShowMenu() {
    let topicid = GetInstanceID('forum-topics', ()=>{
        return parseInt($('#subnav-subscribe-link, #subnav-unsubscribe-link').attr('href').match(FORUM_TOPICS_REGEX)[1]);
    });
    if (!topicid) {
        return;
    }
    let $menu_obj = $.parseHTML(RenderMultilinkMenu(topicid, ['forum']));
    let linkhtml = RenderSubscribeMultiLinks("Topic", ['forum'], topicid, "");
    let shownhtml = (IsEventEnabled('forum', 'subscribe_events_enabled') ? "" : 'style="display:none"');
    $('#el-add-links', $menu_obj).append(`<span class="el-subscribe-forum-container "${shownhtml}>${linkhtml} | </span>`);
    let $email = $('#subnav-subscribe, #subnav-unsubscribe').detach().find('a').text("Email");
    $('#el-add-links', $menu_obj).append($email);
    $('#nav').append($menu_obj);
    $('#el-subscribe-events a').off(PROGRAM_CLICK).on(PROGRAM_CLICK, SubscribeMultiLink);
}

//#C-FORUM-TOPICS #A-INDEX
function InitializeTopicIndexLinks(table,render=true) {
    let typelist = GetList('forum');
    $('.striped tr td:first-of-type', table).each((i,entry)=>{
        let match = entry.innerHTML.match(FORUM_TOPICS_REGEX);
        if (!match) {
            return;
        }
        let topicid = parseInt(match[1]);
        if (render) {
            let linkhtml = RenderSubscribeDualLinks('forum', topicid, 'span', "", "", true);
            let shownhtml = (IsEventEnabled('forum', 'subscribe_events_enabled') ? "" : 'style="display:none"');
            $(entry).prepend(`<span class="el-subscribe-forum-container "${shownhtml}>${linkhtml}&nbsp|&nbsp</span>`);
        } else {
            let subscribed = !typelist.includes(topicid);
            UpdateDualLink('forum', subscribed, topicid);
        }
        $('.el-subscribe-dual-links a', entry).off(PROGRAM_CLICK).on(PROGRAM_CLICK, SubscribeDualLink);
    });
}

//#C-WIKI-PAGES #A-SHOW
function InitializeWikiShowMenu() {
    let [selector,regex] = (EL.controller === 'wiki-pages' ? ['#subnav-history-link', WIKI_PAGE_HISTORY_REGEX] : ['#subnav-newest-link', WIKI_PAGES_REGEX]);
    let url = $(selector).attr('href');
    let wikiid = url && JSPLib.utility.findAll(url, regex);
    if (wikiid.length === 0) {
        return;
    }
    wikiid = parseInt(wikiid[1]);
    let $menu_obj = $.parseHTML(RenderMultilinkMenu(wikiid, ['wiki']));
    let linkhtml = RenderSubscribeMultiLinks("Wiki", ['wiki'], wikiid, "");
    let shownhtml = (IsEventEnabled('wiki', 'subscribe_events_enabled') ? "" : 'style="display:none"');
    $('#el-add-links', $menu_obj).append(`<span class="el-subscribe-wiki-container "${shownhtml}>${linkhtml}</span>`);
    $('#nav').append($menu_obj);
    $('#el-subscribe-events a').off(PROGRAM_CLICK).on(PROGRAM_CLICK, SubscribeMultiLink);
}

//#C-WIKI-PAGES #A-INDEX
function InitializeWikiIndexLinks(table,render=true) {
    let typelist = GetList('wiki');
    $('.striped tbody tr', table).each((i,row)=>{
        let match = row.innerHTML.match(WIKI_PAGES_REGEX);
        if (!match) {
            return;
        }
        let wikiid = parseInt(match[1]);
        if (render) {
            let linkhtml = RenderSubscribeDualLinks('wiki', wikiid, 'span', "", "", true);
            let shownhtml = (IsEventEnabled('wiki', 'subscribe_events_enabled') ? "" : 'style="display:none"');
            $('td.category-0, td.category-1, td.category-3, td.category-4, td.category-5', row).prepend(`<span class="el-subscribe-wiki-container "${shownhtml}>${linkhtml}&nbsp|&nbsp</span>`);
        } else {
            let subscribed = !typelist.includes(wikiid);
            UpdateDualLink('wiki', subscribed, wikiid);
        }
        $('.el-subscribe-dual-links a', row).off(PROGRAM_CLICK).on(PROGRAM_CLICK, SubscribeDualLink);
    });
}

//#C-POOLS #A-SHOW
function InitializePoolShowMenu() {
    let poolid = GetInstanceID('pools');
    if (!poolid) {
        return;
    }
    let $menu_obj = $.parseHTML(RenderMultilinkMenu(poolid, ['pool']));
    let linkhtml = RenderSubscribeMultiLinks("Pool", ['pool'], poolid, "");
    let shownhtml = (IsEventEnabled('pool', 'subscribe_events_enabled') ? "" : 'style="display:none"');
    $('#el-add-links', $menu_obj).append(`<span class="el-subscribe-pool-container "${shownhtml}>${linkhtml}</span>`);
    $('#nav').append($menu_obj);
    $('#el-subscribe-events a').off(PROGRAM_CLICK).on(PROGRAM_CLICK, SubscribeMultiLink);
}

//#C-POOLS #A-INDEX
function InitializePoolIndexLinks(table,render=true) {
    let typelist = GetList('pool');
    $('.striped tbody tr', table).each((i,row)=>{
        let match = row.innerHTML.match(POOLS_REGEX);
        if (!match) {
            return;
        }
        let poolid = parseInt(match[1]);
        if (render) {
            let linkhtml = RenderSubscribeDualLinks('pool', poolid, 'span', "", "", true);
            let shownhtml = (IsEventEnabled('pool', 'subscribe_events_enabled') ? "" : 'style="display:none"');
            $('td:first-of-type', row).prepend(`<span class="el-subscribe-pool-container "${shownhtml}>${linkhtml}&nbsp|&nbsp</span>`);
        } else {
            let subscribed = !typelist.includes(poolid);
            UpdateDualLink('pool', subscribed, poolid);
        }
        $('.el-subscribe-dual-links a', row).off(PROGRAM_CLICK).on(PROGRAM_CLICK, SubscribeDualLink);
    });
}

//#C-POOLS #A-GALLERY
function InitializePoolGalleryLinks() {
    $('#c-pools #a-gallery .post-preview > a').each((i,entry)=>{
        let match = entry.href.match(POOLS_REGEX);
        if (!match) {
            return;
        }
        let poolid = parseInt(match[1]);
        let linkhtml = RenderSubscribeDualLinks('pool', poolid, 'div', " ", 'pool');
        let shownhtml = (IsEventEnabled('pool', 'subscribe_events_enabled') ? "" : 'style="display:none"');
        $(entry).before(`<div class="el-subscribe-pool-container "${shownhtml}>${linkhtml}</div>`);
        $('.el-subscribe-dual-links a', entry.parentElement).off(PROGRAM_CLICK).on(PROGRAM_CLICK, SubscribeDualLink);
    });
}
//EVENT NOTICE

function InitializePostNoteIndexLinks(type,table,render=true) {
    let typelist = GetList(type);
    $('.striped tr[id]', table).each((i,row)=>{
        let postid = parseInt($('.el-post-thumbnail', row).data('postid'));
        if (!postid) {
            return;
        }
        if (render) {
            let linkhtml = RenderSubscribeDualLinks(type, postid, 'span', " ", type, true);
            $('td:first-of-type', row).prepend(`<div style="text-align:center">${linkhtml}</div>`);
        } else {
            let subscribed = !typelist.includes(postid);
            UpdateDualLink(type, subscribed, postid);
        }
        $('.el-subscribe-dual-links a', row).off(PROGRAM_CLICK).on(PROGRAM_CLICK, SubscribeDualLink);
    });
}

//#C-COMMENTS #P-INDEX-BY-POST
function InitializeCommentPartialPostLinks() {
    $('#c-comments #a-index #p-index-by-post .comments-for-post').each((i,entry)=>{
        let postid = parseInt($(entry).data('post-id'));
        if (!postid) {
            return;
        }
        let linkhtml = RenderSubscribeDualLinks('comment', postid, 'div', " ", 'comments');
        let shownhtml = (IsEventEnabled('comment', 'subscribe_events_enabled') ? "" : 'style="display:none"');
        $('.header', entry).after(`<div class="el-subscribe-comment-container "${shownhtml}>${linkhtml}</div>`);
        $('.el-subscribe-dual-links a', entry).off(PROGRAM_CLICK).on(PROGRAM_CLICK, SubscribeDualLink);
    });
}

//#C-COMMENTS #P-INDEX-BY-COMMENT
function InitializeCommentPartialCommentLinks($obj,render=true) {
    let typelist = GetList('comment');
    $('.post-preview', $obj).each((i,entry)=>{
        var postid = parseInt($(entry).data('id'));
        if (!postid) {
            return;
        }
        if (render) {
            var linkhtml = RenderSubscribeDualLinks('comment', postid, 'div', " ", 'comments');
            let shownhtml = (IsEventEnabled('comment', 'subscribe_events_enabled') ? "" : 'style="display:none"');
            let $subscribe = $.parseHTML(`<div class="el-subscribe-comment-container "${shownhtml}>${linkhtml}</div>`);
            $('.preview', entry).append($subscribe);
        } else {
            let subscribed = !typelist.includes(postid);
            UpdateDualLink('comment', subscribed, postid);
        }
        $('.el-subscribe-dual-links a', entry).off(PROGRAM_CLICK).on(PROGRAM_CLICK, SubscribeDualLink);
    });
}

//Event handlers

function HideEventNotice(event) {
    $('#el-event-notice').hide();
    MarkAllAsRead();
    EL.channel.postMessage({type: 'hide'});
}

function LockEventNotice(event) {
    $(event.target).addClass('el-locked');
    EL.locked_notice = true;
}

function ReadEventNotice(event) {
    $(event.target).addClass('el-read');
    MarkAllAsRead();
}

function ReloadEventNotice(event) {
    $("#el-event-notice").remove();
    InitializeNoticeBox();
    let promise_array = [];
    Object.keys(localStorage).forEach((key)=>{
        let match = key.match(/el-((ot|pq)-)?saved(\S+)list/);
        if (!match) {
            return;
        }
        let savedlist = JSPLib.storage.getStorageData(key, localStorage, null);
        if (!JSPLib.validate.validateIDList(savedlist)) {
            return;
        }
        promise_array.push(LoadHTMLType(match[3], savedlist));
    });
    Promise.all(promise_array).then(()=>{
        ProcessThumbnails();
        let finish_promise = $.Deferred().resolve();
        if (EL.post_ids.length) {
            finish_promise = TIMER.GetThumbnails();
        }
        finish_promise.then(()=>{
            InsertThumbnails();
            localStorage['el-saved-notice'] = LZString.compressToUTF16($("#el-event-notice").html());
            JSPLib.concurrency.setRecheckTimeout('el-saved-timeout', EL.timeout_expires);
        });
    });
}

function UpdateAll(event) {
    JSPLib.network.counter_domname = '#el-activity-indicator';
    EL.no_limit = true;
    ProcessAllEvents(()=>{
        JSPLib.concurrency.setRecheckTimeout('el-event-timeout', EL.timeout_expires);
        SetLastSeenTime();
        JSPLib.utility.notice("All events checked!");
    });
    $('#el-reset-all').off(PROGRAM_CLICK);
}

function ResetAll(event) {
    LASTID_KEYS.forEach((key)=>{
        localStorage.removeItem(key);
    });
    ProcessAllEvents(()=>{
        JSPLib.concurrency.setRecheckTimeout('el-event-timeout', EL.timeout_expires);
        SetLastSeenTime();
        JSPLib.utility.notice("All event positions reset!");
    });
    $('#el-update-all').off(PROGRAM_CLICK);
}

function SubscribeMultiLink(event) {
    let $menu = $(JSPLib.utility.getNthParent(event.target, 4));
    let $container = $(event.target.parentElement);
    let itemid = $menu.data('id');
    let typelist = $container.data('type').split(',');
    let subscribed = ($container.hasClass('el-subscribed') ? true : false);
    let prefix = (subscribed ? '-' : "");
    typelist.forEach((type)=>{
        setTimeout(()=>{TIMER.SetList(type, prefix + itemid);}, NONSYNCHRONOUS_DELAY);
        UpdateDualLink(type, subscribed, itemid);
    });
    UpdateMultiLink(typelist, subscribed, itemid);
}

function SubscribeDualLink(event) {
    let $container = $(JSPLib.utility.getNthParent(event.target, 2));
    let type = $container.data('type');
    let itemid = $container.data('id');
    let subscribed = GetList(type).includes(itemid);
    let prefix = (subscribed ? '-' : "");
    setTimeout(()=>{TIMER.SetList(type, prefix + itemid);}, NONSYNCHRONOUS_DELAY);
    UpdateDualLink(type, subscribed, itemid);
    UpdateMultiLink([type], subscribed, itemid);
}

async function PostEventPopulateControl(event) {
    let post_events = JSPLib.menu.getCheckboxRadioSelected(`[data-setting="post_events"] [data-selector]`);
    let operation = JSPLib.menu.getCheckboxRadioSelected(`[data-setting="operation"] [data-selector]`);
    let search_query = $('#el-setting-search-query').val();
    if (post_events.length === 0 || operation.length === 0) {
        JSPLib.utility.notice("Must select at least one post event type!");
    } else if (search_query === "") {
        JSPLib.utility.notice("Must have at least one search term!");
    } else {
        $('#el-search-query-display').show();
        let posts = await JSPLib.danbooru.getPostsCountdown(search_query, 100, '#el-search-query-counter');
        let postids = JSPLib.utility.getObjectAttributes(posts, 'id');
        let post_changes = [];
        let was_subscribed = [];
        let new_subscribed = [];
        post_events.forEach((eventtype)=>{
            let typelist = GetList(eventtype);
            switch (operation[0]) {
                case 'add':
                    new_subscribed = JSPLib.utility.setDifference(postids, typelist);
                    was_subscribed = [];
                    post_changes = JSPLib.utility.concat(post_changes, new_subscribed);
                    typelist = JSPLib.utility.setUnion(typelist, postids);
                    break;
                case 'subtract':
                    new_subscribed = [];
                    was_subscribed = JSPLib.utility.setIntersection(postids, typelist);
                    post_changes = JSPLib.utility.concat(post_changes, was_subscribed)
                    typelist = JSPLib.utility.setDifference(typelist, postids);
                    break;
                case 'overwrite':
                    was_subscribed = JSPLib.utility.setDifference(typelist, postids);
                    new_subscribed = JSPLib.utility.setDifference(postids, typelist);
                    post_changes = JSPLib.utility.concat(post_changes, postids);
                    typelist = postids;
            }
            EL.subscribelist[eventtype] = typelist;
            setTimeout(()=>{JSPLib.storage.setStorageData(`el-${eventtype}list`, EL.subscribelist[eventtype], localStorage);}, 1);
            EL.channel.postMessage({type: 'reload', eventtype: eventtype, was_subscribed: was_subscribed, new_subscribed: new_subscribed, eventlist: EL.subscribelist[eventtype]});
        });
        $('#el-search-query-counter').html(0);
        post_changes = JSPLib.utility.setUnique(post_changes);
        JSPLib.utility.notice(`Subscriptions were changed by ${post_changes.length} posts!`);
    }
}

//Event setup functions

function OpenItemClick(type,parentlevel,htmlfunc,otherfunc) {
    $(`.el-show-hide-links[data-type="${type}"] a`).off(PROGRAM_CLICK).on(PROGRAM_CLICK, (event)=>{
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
        JSPLib.utility.fullHide(`.el-show-hide-links[data-id="${itemid}"] [data-action="${hide}"]`);
        JSPLib.utility.clearHide(`.el-show-hide-links[data-id="${itemid}"] [data-action="${show}"]`);
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
//Callback functions

function SubscribeMultiLinkCallback() {
    EL.user_settings.autosubscribe_enabled.forEach((type)=>{
        $(`#el-subscribe-events .el-unsubscribed[data-type="${type}"] a`).click();
    });
}

//Rebind functions

function RebindMenuAutocomplete() {
    JSPLib.utility.rebindTimer({
        check: ()=>{return JSPLib.utility.hasDOMDataKey('#user_blacklisted_tags, #user_favorite_tags', 'uiAutocomplete');},
        exec: ()=>{
            $('#user_blacklisted_tags, #user_favorite_tags').autocomplete('destroy').off('keydown.Autocomplete.tab');
            $('#el-setting-search-query,' + JSPLib.utility.joinList(POST_QUERY_EVENTS, '#el-setting-', '-query', ',')).attr('data-autocomplete', 'tag-query');
            setTimeout(Danbooru.Autocomplete.initialize_tag_autocomplete, JQUERY_DELAY);
        }
    }, TIMER_POLL_INTERVAL);
}

//Main execution functions

async function CheckPostQueryType(type) {
    let lastidkey = `el-pq-${type}lastid`;
    let typelastid = JSPLib.storage.checkStorageData(lastidkey, ValidateProgramData, localStorage, 0);
    if (typelastid) {
        let savedlistkey = `el-pq-saved${type}list`;
        let savedlastidkey = `el-pq-saved${type}lastid`;
        let type_addon = TYPEDICT[type].addons || {};
        let post_query = GetTypeQuery(type);
        //Check if the post query has any non-operator text
        let query_addon = (post_query.replace(/[\s-*~]+/g, '').length ? {search: {post_tags_match: post_query}} : {});
        let url_addons = JSPLib.utility.joinArgs(type_addon, query_addon, {only: TYPEDICT[type].only});
        let batches = (EL.no_limit ? null : 1);
        let jsontype = await JSPLib.danbooru.getAllItems(TYPEDICT[type].controller, QUERY_LIMIT, batches, {addons: url_addons, page: typelastid, reverse: true});
        let filtertype = TYPEDICT[type].filter(jsontype);
        let lastusertype = (jsontype.length ? JSPLib.danbooru.getNextPageID(jsontype, true) : null);
        if (filtertype.length) {
            CheckPostQueryType.debuglog(`Found ${TYPEDICT[type].plural}!`, lastusertype);
            let idlist = JSPLib.utility.getObjectAttributes(filtertype, 'id');
            await LoadHTMLType(type, idlist);
            JSPLib.storage.setStorageData(savedlastidkey, lastusertype, localStorage);
            JSPLib.storage.setStorageData(savedlistkey, idlist, localStorage);
            return true;
        } else {
            CheckPostQueryType.debuglog(`No ${TYPEDICT[type].plural}!`);
            if (lastusertype && (typelastid !== lastusertype)) {
                SaveLastID(type, lastusertype, 'pq');
            }
        }
    } else {
        TIMER.SetRecentDanbooruID(type, 'pq');
    }
    return false;
}

async function CheckSubscribeType(type) {
    let lastidkey = `el-${type}lastid`;
    let typelastid = JSPLib.storage.checkStorageData(lastidkey, ValidateProgramData, localStorage, 0);
    if (typelastid) {
        let typelist = GetList(type);
        let savedlistkey = `el-saved${type}list`;
        let savedlastidkey = `el-saved${type}lastid`;
        let overflowkey = `el-${type}overflow`;
        let type_addon = TYPEDICT[type].addons || {};
        let urladdons = JSPLib.utility.joinArgs(type_addon, {only: TYPEDICT[type].only});
        let batches = TYPEDICT[type].limit;
        let batch_limit = TYPEDICT[type].limit * QUERY_LIMIT;
        if (EL.no_limit) {
            batches = null;
            batch_limit = Infinity;
        }
        let jsontype = await JSPLib.danbooru.getAllItems(TYPEDICT[type].controller, QUERY_LIMIT, batches, {page: typelastid, addons: urladdons, reverse: true});
        if (jsontype.length === batch_limit) {
            CheckSubscribeType.debuglog(`${batch_limit} ${type} items; overflow detected!`);
            JSPLib.storage.setStorageData(overflowkey, true, localStorage);
            EL.item_overflow = true;
        } else {
            JSPLib.storage.setStorageData(overflowkey, false, localStorage);
        }
        let filtertype = TYPEDICT[type].filter(jsontype, typelist);
        let lastusertype = (jsontype.length ? JSPLib.danbooru.getNextPageID(jsontype, true) : null);
        if (filtertype.length) {
            CheckSubscribeType.debuglog(`Found ${TYPEDICT[type].plural}!`, lastusertype);
            let idlist = JSPLib.utility.getObjectAttributes(filtertype, 'id');
            await LoadHTMLType(type, idlist);
            JSPLib.storage.setStorageData(savedlastidkey, lastusertype, localStorage);
            JSPLib.storage.setStorageData(savedlistkey, idlist, localStorage);
            return true;
        } else {
            CheckSubscribeType.debuglog(`No ${TYPEDICT[type].plural}!`);
            if (lastusertype && (typelastid !== lastusertype)) {
                SaveLastID(type, lastusertype);
            }
        }
    } else {
        TIMER.SetRecentDanbooruID(type);
    }
    return false;
}

async function CheckOtherType(type) {
    let lastidkey = `el-ot-${type}lastid`;
    let typelastid = JSPLib.storage.checkStorageData(lastidkey, ValidateProgramData, localStorage, 0);
    if (typelastid) {
        let savedlistkey = `el-ot-saved${type}list`;
        let savedlastidkey = `el-ot-saved${type}lastid`;
        let type_addon = TYPEDICT[type].addons || {};
        let url_addons = JSPLib.utility.joinArgs(type_addon, {only: TYPEDICT[type].only});
        let batches = (EL.no_limit ? null : 1);
        let jsontype = await JSPLib.danbooru.getAllItems(TYPEDICT[type].controller, QUERY_LIMIT, batches, {addons: url_addons, page: typelastid, reverse: true});
        let filtertype = TYPEDICT[type].filter(jsontype);
        let lastusertype = (jsontype.length ? JSPLib.danbooru.getNextPageID(jsontype, true) : null);
        if (filtertype.length) {
            CheckOtherType.debuglog(`Found ${TYPEDICT[type].plural}!`, lastusertype);
            let idlist = JSPLib.utility.getObjectAttributes(filtertype, 'id');
            await LoadHTMLType(type, idlist);
            JSPLib.storage.setStorageData(savedlistkey, idlist, localStorage);
            JSPLib.storage.setStorageData(savedlastidkey, lastusertype, localStorage);
            return true;
        } else {
            CheckOtherType.debuglog(`No ${TYPEDICT[type].plural}!`);
            if (lastusertype && (typelastid !== lastusertype)) {
                SaveLastID(type, lastusertype, 'ot');
            }
        }
    } else {
        TIMER.SetRecentDanbooruID(type, 'ot');
    }
    return false;
}

async function LoadHTMLType(type,idlist) {
    let section_selector = '#el-' + JSPLib.utility.kebabCase(type) + '-section';
    let type_addon = TYPEDICT[type].addons || {};
    for (let i = 0; i < idlist.length; i += QUERY_LIMIT) {
        let querylist = idlist.slice(i, i + QUERY_LIMIT);
        let url_addons = JSPLib.utility.joinArgs(type_addon, {search: {id: querylist.join(',')}, limit: querylist.length});
        let typehtml = await JSPLib.network.getNotify(`/${TYPEDICT[type].controller}`, url_addons);
        if (typehtml) {
            if ($(`#el-${type}-regular`).length === 0) {
                $(section_selector).prepend(JSPLib.utility.sprintf(REGULAR_NOTICE, type, TYPEDICT[type].plural, type));
            }
            let $typepage = $.parseHTML(typehtml);
            TYPEDICT[type].insert($typepage, type);
        } else if ($(`#el-${type}-error`).length === 0) {
            $(section_selector).append(JSPLib.utility.sprintf(ERROR_NOTICE, type, TYPEDICT[type].plural));
        }
    }
    if (TYPEDICT[type].process) {
        TYPEDICT[type].process();
    }
    $('#el-event-notice').show();
}

async function CheckAllEvents(promise_array) {
    let hasevents_all = await Promise.all(promise_array);
    let hasevents = hasevents_all.some(val => val);
    ProcessThumbnails();
    let finish_promise = hasevents && $.Deferred().resolve();
    if (EL.post_ids.length) {
        finish_promise = TIMER.GetThumbnails();
    }
    if (hasevents) {
        finish_promise.then(()=>{
            InsertThumbnails();
            localStorage['el-saved-notice'] = LZString.compressToUTF16($("#el-event-notice").html());
            JSPLib.concurrency.setRecheckTimeout('el-saved-timeout', EL.timeout_expires);
        });
    }
    JSPLib.storage.setStorageData('el-overflow', EL.item_overflow, localStorage);
    if (!EL.user_settings.autoclose_dmail_notice) {
        $('#dmail-notice').show();
    }
}

function ProcessAllEvents(func) {
    let promise_array = [];
    POST_QUERY_EVENTS.forEach((inputtype)=>{
        promise_array.push(ProcessEvent(inputtype, 'post_query_events_enabled'));
    });
    SUBSCRIBE_EVENTS.forEach((inputtype)=>{
        promise_array.push(ProcessEvent(inputtype, 'subscribe_events_enabled'));
    });
    OTHER_EVENTS.forEach((inputtype)=>{
        promise_array.push(ProcessEvent(inputtype, 'other_events_enabled'));
    });
    TIMER.CheckAllEvents(promise_array).then(()=>{
        func();
    });
}

function MarkAllAsRead() {
    Object.keys(localStorage).forEach((key)=>{
        let match = key.match(/el-(ot|pq)?-?saved(\S+)list/);
        if (match) {
            localStorage.removeItem(key);
            return;
        }
        match = key.match(/el-(ot|pq)?-?saved(\S+)lastid/);
        if (!match) {
            return;
        }
        let savedlastid = JSPLib.storage.getStorageData(key, localStorage, null);
        localStorage.removeItem(key);
        if (!JSPLib.validate.validateID(savedlastid)) {
            return;
        }
        SaveLastID(match[2], savedlastid, match[1]);
    });
    localStorage.removeItem('el-saved-notice');
    if (IsAnyEventEnabled(ALL_MAIL_EVENTS, 'other_events_enabled')) {
        HideDmailNotice();
    } else if (!EL.user_settings.autoclose_dmail_notice) {
        $('#dmail-notice').show();
    }
    SetLastSeenTime();
}

function EventStatusCheck() {
    let disabled_events = JSPLib.utility.setDifference(POST_QUERY_EVENTS, EL.user_settings.post_query_events_enabled);
    disabled_events.forEach((type)=>{
        //Delete every associated value but the list
        localStorage.removeItem(`el-pq-${type}lastid`);
        localStorage.removeItem(`el-pq-saved${type}lastid`);
    });
    disabled_events = JSPLib.utility.setDifference(SUBSCRIBE_EVENTS, EL.user_settings.subscribe_events_enabled);
    disabled_events.forEach((type)=>{
        //Delete every associated value but the list
        localStorage.removeItem(`el-${type}lastid`);
        localStorage.removeItem(`el-saved${type}lastid`);
        localStorage.removeItem(`el-${type}overflow`);
    });
    disabled_events = JSPLib.utility.setDifference(OTHER_EVENTS, EL.user_settings.other_events_enabled);
    disabled_events.forEach((type)=>{
        //Delete every associated value but the list
        localStorage.removeItem(`el-ot-${type}lastid`);
        localStorage.removeItem(`el-ot-saved${type}lastid`);
    });
}

//Settings functions

function BroadcastEL(ev) {
    var menuid, linkid;
    BroadcastEL.debuglog(`(${ev.data.type}):`, ev.data);
    switch (ev.data.type) {
        case 'hide':
            if (!EL.locked_notice) {
                $('#el-event-notice').hide();
            }
            break;
        case 'subscribe':
            EL.subscribelist[ev.data.eventtype] = ev.data.eventlist;
            UpdateMultiLink([ev.data.eventtype], ev.data.was_subscribed, ev.data.itemid);
            UpdateDualLink(ev.data.eventtype, ev.data.was_subscribed, ev.data.itemid);
            break;
        case 'reload':
            EL.subscribelist[ev.data.eventtype] = ev.data.eventlist;
            menuid = $('#el-subscribe-events').data('id');
            if (ev.data.was_subscribed.includes(menuid)) {
                UpdateMultiLink([ev.data.eventtype], true, menuid);
            } else if (ev.data.new_subscribed.includes(menuid)) {
                UpdateMultiLink([ev.data.eventtype], false, menuid);
            }
            $(`.el-subscribe-${ev.data.eventtype}[data-id]`).each((i,entry)=>{
                linkid = $(entry).data('id');
                if (ev.data.was_subscribed.includes(linkid)) {
                    UpdateDualLink(ev.data.eventtype, true, linkid);
                } else if (ev.data.new_subscribed.includes(linkid)) {
                    UpdateDualLink(ev.data.eventtype, false, linkid);
                }
            });
            break;
        case 'reset':
            Object.assign(EL, PROGRAM_RESET_KEYS);
            JSPLib.utility.fullHide('#el-event-notice, #el-subscribe-events, .el-subscribe-dual-links');
            //falls through
        case 'settings':
            EL.user_settings = ev.data.user_settings;
            if (JSPLib.danbooru.isSettingMenu()) {
                JSPLib.menu.updateUserSettings(PROGRAM_SHORTCUT);
            }
            ToggleSubscribeLinks();
            //falls through
        default:
            //do nothing
    }
}

function IsShownData(val,typelist,user_key=null,subscribe_key=null,other_filters=null) {
    if (EL.user_settings.filter_user_events && user_key && val[user_key] === EL.userid) {
        return false;
    }
    if (subscribe_key && typelist && !typelist.includes(val[subscribe_key])) {
        return false;
    }
    if (other_filters && !other_filters(val)) {
        return false;
    }
    return true;
}

function IsShownCommentary(val) {
    if (!EL.user_settings.filter_untranslated_commentary) {
        return true;
    }
    return (Boolean(val.translated_title) || Boolean(val.translated_description));
}

function IsShownFeedback(val) {
    if (!EL.user_settings.filter_autofeedback) {
        return true;
    }
    return (val.body.match(/^Banned for ((almost|over|about) )?\d+ (days?|months?|years?):/) === null)
        && (val.body.match(/^You have been (promoted|demoted) to a \S+ level account from \S+\./) === null)
        && (val.body.match(/\bYou (gained|lost) the ability to (approve posts|upload posts without limit|give user feedback|flag posts)\./) === null);
}

function IsShownBan(val) {
    if (!EL.user_settings.filter_autobans) {
        return true;
    }
    return val.banner_id !== 502584;
}

function GetRecheckExpires() {
    return EL.user_settings.recheck_interval * JSPLib.utility.one_minute;
}

function RenderSettingsMenu() {
    $('#event-listener').append(EL_MENU);
    $('#el-general-settings').append(JSPLib.menu.renderDomainSelectors(PROGRAM_SHORTCUT, PROGRAM_NAME));
    $('#el-notice-settings').append(JSPLib.menu.renderCheckbox(PROGRAM_SHORTCUT, 'autolock_notices'));
    $('#el-notice-settings').append(JSPLib.menu.renderCheckbox(PROGRAM_SHORTCUT, 'mark_read_topics'));
    $('#el-notice-settings').append(JSPLib.menu.renderCheckbox(PROGRAM_SHORTCUT, 'autoclose_dmail_notice'));
    $('#el-filter-settings').append(JSPLib.menu.renderCheckbox(PROGRAM_SHORTCUT, 'filter_user_events'));
    $('#el-filter-settings').append(JSPLib.menu.renderCheckbox(PROGRAM_SHORTCUT, 'filter_untranslated_commentary'));
    $('#el-filter-settings').append(JSPLib.menu.renderCheckbox(PROGRAM_SHORTCUT, 'filter_autofeedback'));
    $('#el-filter-settings').append(JSPLib.menu.renderCheckbox(PROGRAM_SHORTCUT, 'filter_autobans'));
    $('#el-post-query-event-settings').append(JSPLib.menu.renderInputSelectors(PROGRAM_SHORTCUT, 'post_query_events_enabled', 'checkbox'));
    $('#el-post-query-event-settings').append(JSPLib.menu.renderTextinput(PROGRAM_SHORTCUT, 'comment_query', 80));
    $('#el-post-query-event-settings').append(JSPLib.menu.renderTextinput(PROGRAM_SHORTCUT, 'note_query', 80));
    $('#el-post-query-event-settings').append(JSPLib.menu.renderTextinput(PROGRAM_SHORTCUT, 'commentary_query', 80));
    $('#el-post-query-event-settings').append(JSPLib.menu.renderTextinput(PROGRAM_SHORTCUT, 'approval_query', 80));
    $('#el-post-query-event-settings').append(JSPLib.menu.renderTextinput(PROGRAM_SHORTCUT, 'flag_query', 80));
    $('#el-post-query-event-settings').append(JSPLib.menu.renderTextinput(PROGRAM_SHORTCUT, 'appeal_query', 80));
    $('#el-subscribe-event-settings').append(JSPLib.menu.renderInputSelectors(PROGRAM_SHORTCUT, 'subscribe_events_enabled', 'checkbox'));
    $('#el-subscribe-event-settings').append(JSPLib.menu.renderInputSelectors(PROGRAM_SHORTCUT, 'autosubscribe_enabled', 'checkbox'));
    $('#el-other-event-settings').append(JSPLib.menu.renderInputSelectors(PROGRAM_SHORTCUT, 'other_events_enabled', 'checkbox'));
    $('#el-other-event-settings').append(JSPLib.menu.renderInputSelectors(PROGRAM_SHORTCUT, 'subscribed_mod_actions', 'checkbox'));
    $('#el-network-settings').append(JSPLib.menu.renderTextinput(PROGRAM_SHORTCUT, 'recheck_interval', 10));
    $('#el-subscribe-controls').append(JSPLib.menu.renderInputSelectors(PROGRAM_SHORTCUT, 'post_events', 'checkbox', true));
    $('#el-subscribe-controls').append(JSPLib.menu.renderInputSelectors(PROGRAM_SHORTCUT, 'operation','radio',true));
    $('#el-subscribe-controls').append(JSPLib.menu.renderTextinput(PROGRAM_SHORTCUT, 'search_query', 50, true));
    $('#el-subscribe-controls').append(DISPLAY_COUNTER);
    $('#el-cache-settings').append(JSPLib.menu.renderLinkclick(PROGRAM_SHORTCUT, 'cache_info'));
    $('#el-cache-settings').append(CACHE_INFO_TABLE);
    $('#el-cache-editor-controls').append(CONTROL_DATA_SOURCE);
    $('#el-cache-editor-controls').append(JSPLib.menu.renderTextinput(PROGRAM_SHORTCUT, 'data_name', 20, true));
    JSPLib.menu.engageUI(PROGRAM_SHORTCUT, true);
    JSPLib.menu.saveUserSettingsClick(PROGRAM_SHORTCUT, PROGRAM_NAME);
    JSPLib.menu.resetUserSettingsClick(PROGRAM_SHORTCUT, PROGRAM_NAME, LOCALSTORAGE_KEYS, PROGRAM_RESET_KEYS);
    $('#el-search-query-get').off(PROGRAM_CLICK).on(PROGRAM_CLICK, PostEventPopulateControl);
    JSPLib.menu.cacheInfoClick(PROGRAM_SHORTCUT, EMPTY_REGEX, '#el-cache-info-table');
    JSPLib.menu.getCacheClick(PROGRAM_SHORTCUT);
    JSPLib.menu.saveCacheClick(PROGRAM_SHORTCUT, ValidateProgramData);
    JSPLib.menu.deleteCacheClick(PROGRAM_SHORTCUT);
    JSPLib.menu.cacheAutocomplete(PROGRAM_SHORTCUT);
    RebindMenuAutocomplete();
}

//Main program

function Main() {
    $('#dmail-notice').hide();
    Danbooru.EL = Object.assign(EL, {
        controller: document.body.dataset.controller,
        action: document.body.dataset.action,
        showid: JSPLib.danbooru.getShowID(),
        username: document.body.dataset.userName,
        userid: parseInt(document.body.dataset.userId),
        subscribelist: {},
        openlist: {},
        marked_topic: [],
        item_overflow: false,
        no_limit: false,
        post_ids: [],
        thumbs: {},
        storage_keys: {local_storage: []},
        settings_config: SETTINGS_CONFIG,
        control_config: CONTROL_CONFIG,
        channel: JSPLib.utility.createBroadcastChannel(PROGRAM_NAME, BroadcastEL),
    });
    if (EL.username === 'Anonymous') {
        Main.debuglog("User must log in!");
        return;
    } else if (!JSPLib.validate.isString(EL.username) || !JSPLib.validate.validateID(EL.userid)) {
        Main.debuglog("Invalid meta variables!");
        return;
    }
    //Temporary transition code
    if (!localStorage['el-transition-17.0']) {
        let user_settings = JSPLib.storage.getStorageData('el-user-settings', localStorage);
        if (JSPLib.validate.isHash(user_settings) && ('events_enabled' in user_settings) && Array.isArray(user_settings.events_enabled)) {
            user_settings.post_query_events_enabled = JSPLib.utility.setIntersection(['flag', 'appeal'] , user_settings.events_enabled);
            user_settings.subscribe_events_enabled = JSPLib.utility.setIntersection(SUBSCRIBE_EVENTS , user_settings.events_enabled);
            user_settings.other_events_enabled = JSPLib.utility.setIntersection(['dmail', 'spam'] , user_settings.events_enabled);
            JSPLib.storage.setStorageData('el-user-settings', user_settings, localStorage);
        }
        localStorage['el-transition-17.0'] = true;
    }
    Object.assign(EL, {
        user_settings: JSPLib.menu.loadUserSettings(PROGRAM_SHORTCUT),
    });
    if (EL.user_settings.flag_query === "###INITIALIZE###" || EL.user_settings.appeal_query === "###INITIALIZE###") {
        EL.user_settings.flag_query = EL.user_settings.appeal_query = 'user:' + EL.username;
        JSPLib.storage.setStorageData('el-user-settings', EL.user_settings, localStorage);
    }
    if (EL.user_settings.flag_query === "###INITIALIZE###" || EL.user_settings.appeal_query === "###INITIALIZE###") {
        EL.user_settings.flag_query = EL.user_settings.appeal_query = 'user:' + EL.username;
        JSPLib.storage.setStorageData('el-user-settings', EL.user_settings, localStorage);
    }
    if (JSPLib.danbooru.isSettingMenu()) {
        JSPLib.validate.dom_output = '#el-cache-editor-errors';
        JSPLib.menu.loadStorageKeys(PROGRAM_SHORTCUT);
        JSPLib.utility.installScript(JQUERY_TAB_WIDGET_URL).done(()=>{
            JSPLib.menu.installSettingsMenu(PROGRAM_NAME);
            RenderSettingsMenu();
        });
        JSPLib.utility.setCSSStyle(MENU_CSS, 'menu');
        //Temporary style until JSPLib gets updated
        JSPLib.utility.setCSSStyle(JSPLIB_CSS, 'jsplib_temp');
    }
    if (!JSPLib.menu.isScriptEnabled(PROGRAM_NAME)) {
        Main.debuglog("Script is disabled on", window.location.hostname);
        return;
    }
    Object.assign(EL, {
        timeout_expires: GetRecheckExpires(),
        locked_notice: EL.user_settings.autolock_notices,
    });
    EventStatusCheck();
    if (!document.hidden && localStorage['el-saved-notice'] !== undefined && !JSPLib.concurrency.checkTimeout('el-saved-timeout', EL.timeout_expires)) {
        let notice_html = LZString.decompressFromUTF16(localStorage['el-saved-notice']);
        InitializeNoticeBox(notice_html);
        for (let type in TYPEDICT) {
            let $section = $(`#el-${type}-section`);
            if($section.length) {
                TYPEDICT[type].open && TYPEDICT[type].open($section);
                TYPEDICT[type].subscribe && TYPEDICT[type].subscribe($section, false);
                TYPEDICT[type].process && TYPEDICT[type].process();
            }
        }
        $("#el-event-notice").show();
        let any_blacklisted = document.querySelector("#el-event-notice .blacklisted");
        if (any_blacklisted) {
            new MutationObserver((mutations,observer)=>{
                $('#el-event-notice .blacklisted-active').removeClass('blacklisted-active');
                observer.disconnect();
            }).observe(any_blacklisted, {
                attributes: true,
                attributefilter: ['class']
            });
        }
    } else if (!document.hidden && (JSPLib.concurrency.checkTimeout('el-event-timeout', EL.timeout_expires) || WasOverflow()) && JSPLib.concurrency.reserveSemaphore(PROGRAM_SHORTCUT)) {
        InitializeNoticeBox();
        if (CheckAbsence()) {
            JSPLib.concurrency.setRecheckTimeout('el-event-timeout', EL.timeout_expires);
            ProcessAllEvents(()=>{
                SetLastSeenTime();
                JSPLib.concurrency.freeSemaphore(PROGRAM_SHORTCUT);
            });
        } else {
            $('#el-absent-section').html(ABSENT_NOTICE).show();
            $('#el-update-all').one(PROGRAM_CLICK, UpdateAll);
            if (EL.days_absent > MAX_ABSENCE) {
                $('#el-absent-section').append(EXCESSIVE_NOTICE);
                $('#el-reset-all').one(PROGRAM_CLICK, ResetAll);
            }
            $('#el-days-absent').html(EL.days_absent);
            $('#el-event-notice').show();
            JSPLib.concurrency.freeSemaphore(PROGRAM_SHORTCUT);
        }
    } else {
        if (!EL.user_settings.autoclose_dmail_notice) {
            $('#dmail-notice').show();
        }
        Main.debuglog("Waiting...");
    }
    let $main_section = $('#c-' + Danbooru.EL.controller);
    if (EL.controller === 'posts' && EL.action === 'show') {
        InitializePostShowMenu();
        if ($(`#image-container[data-uploader-id="${EL.userid}"]`).length) {
            SubscribeMultiLinkCallback();
        }
    } else if (EL.controller === 'comments' && EL.action === 'index') {
        InitializeCommentPartialCommentLinks($main_section);
    } else if (['forum-topics', 'forum-posts'].includes(EL.controller)) {
        if (EL.action === 'show') {
            InitializeTopicShowMenu();
        } else if (EL.action === 'index') {
            InitializeTopicIndexLinks($main_section);
        }
    } else if (['wiki-pages', 'wiki-page-versions'].includes(EL.controller)) {
        if (EL.action === 'show') {
            InitializeWikiShowMenu();
        } else if (EL.action === 'index') {
            InitializeWikiIndexLinks($main_section);
        }
    } else if (['pools', 'pool-versions'].includes(EL.controller)) {
        if (EL.action === 'show') {
            InitializePoolShowMenu();
        } else if (EL.action === 'index') {
            InitializePoolIndexLinks($main_section);
        } else if (EL.action === 'gallery') {
            InitializePoolGalleryLinks();
        }
    }
    if (EL.user_settings.autoclose_dmail_notice) {
        HideDmailNotice();
    }
    JSPLib.utility.setCSSStyle(PROGRAM_CSS, 'program');
}

/****Function decoration****/

JSPLib.debug.addFunctionTimers(TIMER, false, [
    RenderSettingsMenu,
    [SetList, 0],
]);

JSPLib.debug.addFunctionTimers(TIMER, true, [
    GetThumbnails, CheckAllEvents, PostEventPopulateControl,
    [CheckPostQueryType, 0],
    [CheckSubscribeType, 0],
    [CheckOtherType, 0],
    [SetRecentDanbooruID, 0, 1]
]);

JSPLib.debug.addFunctionLogs([
    Main, BroadcastEL, CheckSubscribeType, MarkAllAsRead, ProcessEvent, SaveLastID, CorrectList, GetInstanceID,
    CheckPostQueryType, CheckOtherType,
]);

/****Execution start****/

JSPLib.load.programInitialize(Main, 'EL', PROGRAM_LOAD_REQUIRED_VARIABLES, PROGRAM_LOAD_REQUIRED_SELECTORS);
