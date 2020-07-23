// ==UserScript==
// @name         EventListener
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      20.0
// @description  Informs users of new events (flags,appeals,dmails,comments,forums,notes,commentaries,post edits,wikis,pools,bans,feedbacks,mod actions)
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @exclude      /^https?://\w+\.donmai\.us/.*\.(xml|json|atom)(\?|$)/
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/eventlistener.user.js
// @require      https://cdn.jsdelivr.net/npm/core-js-bundle@3.6.5/minified.js
// @require      https://cdn.jsdelivr.net/npm/xregexp@4.3.0/xregexp-all.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.4.4/lz-string.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200507-utility/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200506-storage/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/concurrency.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/menu.js
// ==/UserScript==

/* global JSPLib jQuery $ Danbooru Diff XRegExp LZString */

/****Global variables****/

//Library constants

// Added here since global variables use this function
JSPLib.utility.multiConcat = function (...arrays) {
    if (arrays.length < 1) {
        return arrays[0];
    }
    let merged_array = arrays[0];
    for (let i = 1; i < arrays.length; i++) {
        merged_array = JSPLib.utility.concat(merged_array, arrays[i]);
    }
    return merged_array;
};

//Exterior script variables
const DANBOORU_TOPIC_ID = '14747';
const SERVER_USER_ID = 502584;
const JQUERY_TAB_WIDGET_URL = 'https://cdn.jsdelivr.net/gh/jquery/jquery-ui@1.12.1/ui/widgets/tabs.js';

//Variables for load.js
const PROGRAM_LOAD_REQUIRED_VARIABLES = ['window.jQuery','window.Danbooru'];
const PROGRAM_LOAD_REQUIRED_SELECTORS = ['#nav', '#page'];

//Program name constants
const PROGRAM_SHORTCUT = 'el';
const PROGRAM_CLICK = 'click.el';
const PROGRAM_NAME = 'EventListener';

//Main program variable
const EL = {};

//Timer function hash
const TIMER = {};

//Event types
const POST_QUERY_EVENTS = ['comment', 'note', 'commentary', 'post', 'approval', 'flag', 'appeal'];
const SUBSCRIBE_EVENTS = ['comment', 'note', 'commentary', 'post', 'approval', 'flag', 'appeal', 'forum', 'wiki', 'pool'];
const OTHER_EVENTS = ['dmail', 'ban', 'feedback', 'mod_action'];
const ALL_EVENTS = JSPLib.utility.setUnique(JSPLib.utility.multiConcat(POST_QUERY_EVENTS, SUBSCRIBE_EVENTS, OTHER_EVENTS));

//For factory reset
const LASTID_KEYS = JSPLib.utility.multiConcat(
    POST_QUERY_EVENTS.map((type)=>{return `el-pq-${type}lastid`;}),
    SUBSCRIBE_EVENTS.map((type)=>{return `el-${type}lastid`;}),
    OTHER_EVENTS.map((type)=>{return `el-ot-${type}lastid`;}),
);
const SAVED_KEYS = JSPLib.utility.multiConcat(
    POST_QUERY_EVENTS.map((type)=>{return [`el-pq-saved${type}lastid`, `el-pq-saved${type}list`];}),
    SUBSCRIBE_EVENTS.map((type)=>{return [`el-saved${type}lastid`, `el-saved${type}list`];}),
    OTHER_EVENTS.map((type)=>{return [`el-ot-saved${type}lastid`, `el-ot-saved${type}list`];}),
).flat();
const SUBSCRIBE_KEYS = SUBSCRIBE_EVENTS.map((type) => ([`el-${type}list`, `el-${type}overflow`])).flat();
const LOCALSTORAGE_KEYS = JSPLib.utility.multiConcat(LASTID_KEYS, SAVED_KEYS, SUBSCRIBE_KEYS, [
    'el-overflow',
    'el-last-seen',
    'el-saved-notice',
]);

//Available setting values
const ENABLE_EVENTS = ['flag', 'appeal', 'dmail', 'comment', 'note', 'commentary', 'forum'];
const POST_QUERY_ENABLE_EVENTS = ['flag', 'appeal'];
const SUBSCRIBE_ENABLE_EVENTS = ['comment', 'note', 'commentary', 'forum'];
const OTHER_ENABLE_EVENTS = ['dmail'];
const AUTOSUBSCRIBE_EVENTS = ['comment', 'note', 'commentary', 'post', 'approval', 'flag', 'appeal'];
const MODACTION_EVENTS = [
    'user_delete', 'user_ban', 'user_unban', 'user_name_change', 'user_level_change', 'user_approval_privilege', 'user_upload_privilege', 'user_account_upgrade',
    'user_feedback_update', 'user_feedback_delete', 'post_delete', 'post_undelete', 'post_ban', 'post_unban', 'post_permanent_delete', 'post_move_favorites',
    'pool_delete', 'pool_undelete', 'artist_ban', 'artist_unban', 'comment_update', 'comment_delete', 'forum_topic_delete', 'forum_topic_undelete', 'forum_topic_lock',
    'forum_post_update', 'forum_post_delete', 'tag_alias_create', 'tag_alias_update', 'tag_implication_create', 'tag_implication_update', 'ip_ban_create', 'ip_ban_delete',
    'ip_ban_undelete', 'mass_update', 'bulk_revert', 'other'
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
    show_creator_events: {
        default: false,
        validate: (data)=>{return typeof data === 'boolean';},
        hint: "Show subscribe events regardless of subscribe status when creator is the user."
    },
    filter_untranslated_commentary: {
        default: true,
        validate: (data)=>{return typeof data === 'boolean';},
        hint: "Only show new commentary that has translated sections."
    },
    filter_autobans: {
        default: true,
        validate: (data)=>{return typeof data === 'boolean';},
        hint: `Only show bans not created by <a class="user-moderator with-style" style="color:var(--user-moderator-color)" href="/users/${SERVER_USER_ID}">DanbooruBot</a>.`
    },
    filter_autofeedback: {
        default: true,
        validate: (data)=>{return typeof data === 'boolean';},
        hint: 'Only show feedback not created by an administrative action, e.g. bans or promotions.'
    },
    filter_post_edits: {
        default: "",
        parse: String,
        validate: JSPLib.validate.isString,
        hint: "Enter a list of tags to filter out edits when added to or removed from a post.",
    },
    filter_BUR_edits: {
        default: true,
        validate: (data)=>{return typeof data === 'boolean';},
        hint: `Only show edits not created by <a class="user-moderator with-style" style="color:var(--user-moderator-color)" href="/users/${SERVER_USER_ID}">DanbooruBot</a>.`
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
    post_query: {
        display: "Edit query",
        default: "",
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
.el-event-hidden {
    display: none;
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

const POST_CSS = `
#el-event-notice #el-post-section #el-post-table .col-expand {
    width: unset;
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
    display: flex;
    flex-wrap: wrap;
    background-color: rgba(0, 255, 0, 0.2);
}
#el-event-notice #el-pool-section .el-full-item[data-type="poolposts"] .el-rem-pool-posts {
    display: flex;
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
    letter-spacing: -1px;
}
#event-listener .jsplib-selectors[data-setting="domain_selector"] label {
    width: 125px;
}
#event-listener .ui-checkboxradio-icon-space {
    margin-right: 5px;
}`;

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
    <div id="el-loading-message"><b>Loading...</b></div>
    <div id="el-event-controls" style="display:none">
        <a href="javascript:void(0)" id="el-hide-event-notice">Close this</a>
        [
        <a href="javascript:void(0)" id="el-lock-event-notice" title="Keep notice from being closed by other tabs.">LOCK</a>
        |
        <a href="javascript:void(0)" id="el-read-event-notice" title="Mark all items as read.">READ</a>
        |
        <a href="javascript:void(0)" id="el-reload-event-notice" title="Reload events when the server errors.">RELOAD</a>
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
                <div class="expandable">
                    <div class="expandable-header">
                        <span>Additional setting details</span>
                        <input type="button" value="Show" class="expandable-button">
                    </div>
                    <div class="expandable-content">
                        <ul>
                            <li><b>Edit query:</b>
                                <ul>
                                    <li>Prepend tags with a "-" to add a search for removed tags.</li>
                                    <li>Any other tags will add a search for added tags.</li>
                                    <li>At least one tag from added/removed must be in the post edit.</li>
                                    <li>Having no tags for either group removes that requirement.</li>
                                </ul>
                            </li>
                        </ul>
                    </div>
                </div>
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
                    <p><b>Note:</b> The raw format of all data keys begins with "el-". which is unused by the cache editor controls.</p>
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

//Network constants

const QUERY_LIMIT = 100; //The max number of items to grab with each network call
const ID_FIELD = 'id';

//Regex constants

const POOLS_REGEX = XRegExp.tag()`/pools/(\d+)`;

//Other constants

const ALL_POST_EVENTS = ['post', 'approval', 'comment', 'note', 'commentary'];
const ALL_TRANSLATE_EVENTS = ['note', 'commentary'];
const ALL_MAIL_EVENTS = ['dmail'];

//Type configurations
const TYPEDICT = {
    flag: {
        controller: 'post_flags',
        addons: {search: {category: 'normal'}},
        only: 'id,creator_id,post_id',
        filter: (array) => (array.filter((val) => (IsShownData(val, 'creator_id', ['post', 'uploader_id'])))),
        insert: InsertEvents,
        plural: 'flags',
        display: "Flags",
        includes: 'post[uploader_id]',
        useritem: false,
    },
    appeal: {
        controller: 'post_appeals',
        only: 'id,creator_id,post_id',
        filter: (array) => (array.filter((val) => (IsShownData(val, 'creator_id', ['post', 'uploader_id'])))),
        insert: InsertEvents,
        plural: 'appeals',
        display: "Appeals",
        includes: 'post[uploader_id]',
        useritem: false,
    },
    dmail: {
        controller: 'dmails',
        addons: {search: {is_deleted: false}},
        only: 'id,from_id',
        filter: (array) => (array.filter((val) => (IsShownData(val, 'from_id', null, null, null, (val)=>{return !val.is_read})))),
        insert: InsertDmails,
        plural: 'mail',
        useritem: true,
        open: ()=>{OpenItemClick('dmail', AddDmail);},
    },
    comment: {
        controller: 'comments',
        addons: {group_by: 'comment', search: {is_deleted: false}},
        only: 'id,creator_id,post_id',
        limit: 10,
        filter: (array,typeset) => (array.filter((val) => (IsShownData(val, 'creator_id', ['post', 'uploader_id'], 'post_id', typeset)))),
        insert: InsertComments,
        process: ()=>{JSPLib.utility.setCSSStyle(COMMENT_CSS, 'comment');},
        plural: 'comments',
        display: "Comments",
        includes: 'post[uploader_id]',
        useritem: false,
        subscribe: InitializeCommentIndexLinks,
    },
    forum: {
        controller: 'forum_posts',
        only: 'id,creator_id,topic_id',
        limit: 10,
        filter: (array,typeset) => (array.filter((val) => (IsShownData(val, 'creator_id', ['topic', 'creator_id'], 'topic_id', typeset)))),
        insert: InsertForums,
        process: ()=>{JSPLib.utility.setCSSStyle(FORUM_CSS, 'forum');},
        plural: 'forums',
        includes: 'topic[creator_id]',
        useritem: false,
        open: ()=>{OpenItemClick('forum', AddForumPost);},
        subscribe: InitializeTopicIndexLinks,
    },
    note: {
        controller: 'note_versions',
        only: 'id,updater_id,post_id',
        limit: 10,
        filter: (array,typeset) => (array.filter((val) => (IsShownData(val, 'updater_id', ['post', 'uploader_id'], 'post_id', typeset)))),
        insert: InsertNotes,
        plural: 'notes',
        display: "Notes",
        includes: 'post[uploader_id]',
        useritem: false,
        open: ()=>{OpenItemClick('note', AddRenderedNote, AdjustRowspan);},
        subscribe: (table)=>{InitializePostNoteIndexLinks('note', table, false);},
    },
    commentary: {
        controller: 'artist_commentary_versions',
        only: 'id,updater_id,post_id',
        limit: 10,
        filter: (array,typeset) => (array.filter((val) => (IsShownData(val, 'updater_id', ['post', 'uploader_id'], 'post_id', typeset, IsShownCommentary)))),
        insert: InsertEvents,
        plural: 'commentaries',
        display: "Artist commentary",
        includes: 'post[uploader_id]',
        useritem: false,
    },
    post: {
        controller: 'post_versions',
        addons: {search: {is_new: false}},
        only: 'id,updater_id,post_id,added_tags,removed_tags',
        limit: 4,
        filter: (array,typeset) => (array.filter((val) => (IsShownData(val, 'updater_id', ['post', 'uploader_id'], 'post_id', typeset, IsShownPostEdit)))),
        insert: InsertPosts,
        process: ()=>{JSPLib.utility.setCSSStyle(POST_CSS, 'post');},
        plural: 'edits',
        display: "Edits",
        includes: 'post[uploader_id]',
        useritem: false,
        customquery: PostCustomQuery,
        subscribe: (table)=>{InitializePostNoteIndexLinks('post', table, false);},
    },
    approval: {
        controller: 'post_approvals',
        only: 'id,user_id,post_id',
        limit: 10,
        filter: (array,typeset) => (array.filter((val) => (IsShownData(val, 'user_id', ['post', 'uploader_id'], 'post_id', typeset)))),
        insert: InsertEvents,
        plural: 'approvals',
        display: "Approval",
        includes: 'post[uploader_id]',
        useritem: false,
    },
    wiki: {
        controller: 'wiki_page_versions',
        only: 'id,updater_id,wiki_page_id',
        limit: 10,
        filter: (array,typeset) => (array.filter((val) => (IsShownData(val, 'updater_id', null, 'wiki_page_id', typeset)))),
        insert: InsertWikis,
        process: ()=>{JSPLib.utility.setCSSStyle(WIKI_CSS, 'wiki');},
        plural: 'wikis',
        useritem: false,
        open: ()=>{OpenItemClick('wiki', AddWiki);},
        subscribe: InitializeWikiIndexLinks,
    },
    pool: {
        controller: 'pool_versions',
        only: 'id,updater_id,pool_id',
        limit: 2,
        filter: (array,typeset) => (array.filter((val) => (IsShownData(val, 'updater_id', null, 'pool_id', typeset)))),
        insert: InsertPools,
        process: ()=>{JSPLib.utility.setCSSStyle(POOL_CSS, 'pool');},
        plural: 'pools',
        useritem: false,
        open: ()=>{
            OpenItemClick('pooldiff', AddPoolDiff);
            OpenItemClick('poolposts', AddPoolPosts);
        },
        subscribe: InitializePoolIndexLinks,
    },
    feedback: {
        controller: 'user_feedbacks',
        only: 'id,creator_id,body',
        filter: (array) => (array.filter((val) => (IsShownData(val, 'creator_id', null, null, null, IsShownFeedback)))),
        insert: InsertEvents,
        process: ()=>{JSPLib.utility.setCSSStyle(FEEDBACK_CSS, 'feedback');},
        plural: 'feedbacks',
        useritem: false,
    },
    ban: {
        controller: 'bans',
        only: 'id,banner_id',
        filter: (array) => (array.filter((val) => (IsShownData(val, 'banner_id', null, null, null, IsShownBan)))),
        insert: InsertEvents,
        process: ()=>{JSPLib.utility.setCSSStyle(BAN_CSS, 'ban');},
        plural: 'bans',
        useritem: false,
    },
    mod_action: {
        controller: 'mod_actions',
        only: 'id,category',
        filter: (array) => (array.filter((val) => (IsCategorySubscribed(val.category)))),
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
            let validation_error = (Array.isArray(oldlist) ? JSPLib.utility.arrayDifference(oldlist, typelist[type]) : typelist[type]);
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

JSPLib.load._getWindow = function () {
    return (typeof unsafeWindow !== "undefined" ? unsafeWindow : window);
};

JSPLib.load.exportData = function (program_name, program_value, other_data = null) {
    let window_value = JSPLib.load._getWindow();
    if (JSPLib.debug.debug_console) {
        window_value.JSPLib.lib = window_value.JSPLib.lib || {};
        window_value.JSPLib.lib[program_name] = JSPLib;
        window_value.JSPLib.value = window_value.JSPLib.value || {};
        window_value.JSPLib.value[program_name] = program_value;
        window_value.JSPLib.other = window_value.JSPLib.other || {};
        window_value.JSPLib.other[program_name] = other_data;
    }
};

JSPLib.utility._setOperation = function (iterator,comparator,result=new Set()) {
    for (let val of iterator) {
        if (comparator(val)) {
            result.add(val);
        }
    }
    return result;
};

JSPLib.utility.getNestedAttribute = function (data,attributes) {
    for (let i = 0; i < attributes.length; i++) {
        let attribute = attributes[i];
        data = data[attribute]
        if (data === undefined) {
            return null;
        }
    }
    return data;
};

JSPLib.utility.isSet = function (data) {
    return data && data.constructor && data.constructor.name === "Set";
};

JSPLib.utility.setUnionN = function (set1,set2) {
    let [small,large] = this._orderSets(set1,set2);
    const comparator = ()=>(true);
    return this._setOperation(small,comparator,new Set(large));
};

JSPLib.utility.setDifferenceN = function (set1,set2) {
    const comparator = (val) => !set2.has(val);
    return this._setOperation(set1,comparator);
};

JSPLib.utility.setIntersectionN = function (set1,set2) {
    let [small,large] = this._orderSets(set1,set2);
    const comparator = (val) => large.has(val);
    return this._setOperation(small,comparator);
};

JSPLib.utility.setSymmetricDifferenceN = function (set1,set2) {
    let combined = this.setUnionN(set1,set2);
    let comparator = (val) => !(set1.has(val) && set2.has(val));
    return this._setOperation(combined,comparator);
};

JSPLib.utility.setEqualsN = function (set1,set2) {
    if (!this.isSet(set1) || !this.isSet(set2)) {
        return false;
    }
    if (set1.size !== set2.size) {
        return false;
    }
    let [small,large] = this._orderSets(set1,set2);
    return [...small].every(val => large.has(val));
};

JSPLib.utility.isSubSetN = function (set1,set2) {
    return set2.every(val => set1.has(val));
};

JSPLib.utility.isSuperSetN = function (set1,set2) {
    return this.isSubset(set2,set1);
};

JSPLib.utility.arrayUnique = function (array) {
    return [...(new Set(array))];
};

JSPLib.utility.arrayUnion = function (array1,array2) {
    let [set1,set2] = this._makeSets(array1,array2);
    return [...this.setUnionN(set1,set2)];
};

JSPLib.utility.arrayDifference = function (array1,array2) {
    let [set1,set2] = this._makeSets(array1,array2);
    return [...this.setDifferenceN(set1,set2)];
};

JSPLib.utility.arrayIntersection = function (array1,array2) {
    let [set1,set2] = this._makeSets(array1,array2);
    return [...this.setIntersectionN(set1,set2)];
};

JSPLib.utility.arraySymmetricDifference = function (array1,array2) {
    let [set1,set2] = this._makeSets(array1,array2);
    return [...this.setSymmetricDifferenceN(set1,set2)];
};

JSPLib.utility.isSubArray = function (array1,array2) {
    let [set1,set2] = this._makeSets(array1,array2);
    return this.isSubSetN(set1,set2);
};

JSPLib.utility.isSuperArray = function (array1,array2) {
    return this.isSubArray(array2,array1);
};

JSPLib.utility.setHasIntersection = function (set1,set2) {
    let [small,large] = this._orderSets(set1,set2);
    return small.some(val => large.has(val));
};

JSPLib.utility.arrayHasIntersection = function (array1,array2) {
    let [set1,set2] = this._makeSets(array1,array2);
    return this.setHasIntersection(set1,set2);
};

JSPLib.menu.loadStorageKeys = async function () {
    let program_data_regex = this.program_data_regex;
    let storage_keys = this.program_data.storage_keys = {};
    if (program_data_regex) {
        this._storage_keys_promise = JSPLib.storage.danboorustorage.keys();
        let cache_keys = await this._storage_keys_promise;
        this._storage_keys_loaded = true;
        storage_keys.indexed_db = cache_keys.filter((key)=>{return key.match(program_data_regex);});
        let program_keys = cache_keys.filter((key)=>{return key.match(this.program_regex);});
        storage_keys.indexed_db = JSPLib.utility.concat(program_keys,storage_keys.indexed_db);
    } else {
        this._storage_keys_loaded = true;
    }
    let keys = Object.keys(localStorage);
    storage_keys.local_storage = keys.filter((key)=>{return key.match(this.program_regex);});
};

JSPLib.utility._combineArgs = function (results,data) {
    for (let key in data) {
        if (!(key in results) || !((typeof results[key] === "object") && (typeof data[key] === "object"))) {
            results[key] = (typeof data[key] === "object" ? JSPLib.utility.dataCopy(data[key]) : data[key]);
        } else {
            JSPLib.utility._combineArgs(results[key],data[key]);
        }
    }
};

//Helper functions

async function SetRecentDanbooruID(type,qualifier) {
    let type_addon = TYPEDICT[type].addons || {};
    let url_addons = JSPLib.utility.joinArgs(type_addon, {only: ID_FIELD, limit: 1});
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
    return JSPLib.utility.arrayHasIntersection(event_list, EL.user_settings[event_type]);
}

function AreAllEventsEnabled(event_list,event_type) {
    return JSPLib.utility.isSubArray(EL.user_settings[event_type], event_list);
}

function IsCategorySubscribed(type) {
    return EL.user_settings.subscribed_mod_actions.includes(type);
}

function GetTypeQuery(type) {
    return EL.user_settings[type + '_query'];
}

function GetTableType(container) {
    return $('.striped tbody tr', container).attr('id').replace(/-\d+$/, '');
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
    if (EL.subscribeset[type]) {
        return EL.subscribeset[type];
    }
    EL.subscribeset[type] = JSPLib.storage.getStorageData(`el-${type}list`, localStorage, []);
    if (CorrectList(type, EL.subscribeset)) {
        setTimeout(()=>{
            JSPLib.storage.setStorageData(`el-${type}list`, EL.subscribeset, localStorage);
        }, NONSYNCHRONOUS_DELAY);
    }
    EL.subscribeset[type] = new Set(EL.subscribeset[type]);
    return EL.subscribeset[type];
}

function SetList(type,remove_item,itemid) {
    let typeset = GetList(type);
    if (remove_item) {
        typeset.delete(itemid);
    } else {
        typeset.add(itemid);
    }
    JSPLib.storage.setStorageData(`el-${type}list`, [...typeset], localStorage);
    EL.channel.postMessage({type: 'subscribe', eventtype: type, was_subscribed: remove_item, itemid: itemid, eventlist: typeset});
    EL.subscribeset[type] = typeset;
}

//Quicker way to check list existence; avoids unnecessarily parsing very long lists
function CheckList(type) {
    let typelist = localStorage.getItem(`el-${type}list`);
    return typelist && typelist !== '[]';
}

//Auxiliary functions

function IsShownData(val,user_key=null,creator_keys=null,subscribe_key=null,typeset=null,other_filters=null) {
    if (EL.user_settings.filter_user_events && user_key && val[user_key] === EL.userid) {
        return false;
    }
    if (typeset && subscribe_key) {
        let is_creator_event = EL.user_settings.show_creator_events && creator_keys && JSPLib.utility.getNestedAttribute(val, creator_keys) === EL.userid;
        if (!is_creator_event && typeset.has(val[subscribe_key]) === false) {
            return false;
        }
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

function IsShownPostEdit(val) {
    if (EL.user_settings.filter_BUR_edits && val.updater_id === SERVER_USER_ID) {
        return false;
    }
    if (EL.user_settings.filter_post_edits === "") {
        return true;
    }
    let changed_tags = new Set(JSPLib.utility.concat(val.added_tags, val.removed_tags));
    return !JSPLib.utility.setHasIntersection(changed_tags, EL.post_filter_tags);
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
    return val.banner_id !== SERVER_USER_ID;
}

function PostCustomQuery(query) {
    let parameters = {}
    let taglist = query.trim().split(/\s+/);
    let tagadds = taglist.filter(tag => !tag.startsWith('-'));
    if (tagadds.length) {
        parameters.search = {};
        parameters.search.added_tags_include_any = tagadds.join(' ');
    }
    let tagremoves = taglist.filter(tag => tag.startsWith('-'));
    if (tagremoves.length) {
        parameters.search = parameters.search || {};
        parameters.search.removed_tags_include_any = tagremoves.join(' ');
    }
    return parameters;
}

function InsertPostPreview($container, post_id, query_string) {
    let $thumb_copy = $(EL.thumbs[post_id]).clone();
    let $thumb_copy_link = $thumb_copy.find('a');
    let thumb_url = $thumb_copy_link.attr('href') + query_string;
    $thumb_copy_link.attr('href', thumb_url);
    $container.append($thumb_copy);
}

function SaveLastID(type,lastid,qualifier='') {
    if (!JSPLib.validate.validateID(lastid)) {
        SaveLastID.debuglog("Last ID for", type, "is not valid!", lastid);
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
        let enabled_events = JSPLib.utility.arrayIntersection(SUBSCRIBE_EVENTS, EL.user_settings.subscribe_events_enabled);
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
    if (!JSPLib.menu.isSettingEnabled(optype, inputtype)) {
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
    let $rowelement = $(rowelement);
    $rowelement.after($outerblock);
    if (EL.user_settings.mark_read_topics) {
        let topic_id = $rowelement.data('topic-id');
        if (!EL.marked_topic.includes(topic_id)) {
            ReadForumTopic(topic_id);
            EL.marked_topic.push(topic_id);
        }
    }
}

function AddRenderedNote(noteid,rowelement) {
    let notehtml = $('.body-column', rowelement).html();
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
    let $outerblock = $.parseHTML(RenderOpenItemContainer('dmail', dmailid, 5));
    $('td', $outerblock).append($('.dmail', $dmail));
    $(rowelement).after($outerblock);
}

async function AddWiki(wikiverid,rowelement) {
    let $rowelement = $(rowelement);
    let wikiid = $rowelement.data('wiki-page-id');
    let url_addons = {search: {wiki_page_id: wikiid}, page: `b${wikiverid}`, only: ID_FIELD, limit: 1};
    let prev_wiki = await JSPLib.danbooru.submitRequest('wiki_page_versions', url_addons, []);
    if (prev_wiki.length) {
        let wiki_diff_page = await JSPLib.network.getNotify('/wiki_page_versions/diff', {otherpage: wikiverid, thispage: prev_wiki[0].id});
        if (!wiki_diff_page) {
            return;
        }
        let $wiki_diff_page = $.parseHTML(wiki_diff_page);
        let $outerblock = $.parseHTML(RenderOpenItemContainer('wiki', wikiverid, 4));
        $('td', $outerblock).append($('#a-diff #content', $wiki_diff_page));
        $rowelement.after($outerblock);
    } else {
        JSPLib.utility.notice("Wiki creations have no diff!");
    }
}

async function AddPoolDiff(poolverid,rowelement) {
    let pool_diff = await JSPLib.network.getNotify(`/pool_versions/${poolverid}/diff`);
    let $pool_diff = $.parseHTML(pool_diff);
    $('#a-diff > h1', $pool_diff).hide();
    let $outerblock = $.parseHTML(RenderOpenItemContainer('pooldiff', poolverid, 7));
    $('td', $outerblock).append($('#a-diff', $pool_diff));
    $(rowelement).after($outerblock);
}

async function AddPoolPosts(poolverid,rowelement) {
    let $post_count = $('.post-count-column', rowelement);
    let add_posts = String($post_count.data('add-posts') || "").split(',').sort().reverse();
    let rem_posts = String($post_count.data('rem-posts') || "").split(',').sort().reverse();
    let total_posts = JSPLib.utility.concat(add_posts, rem_posts);
    let missing_posts = JSPLib.utility.arrayDifference(total_posts, Object.keys(EL.thumbs));
    if (missing_posts.length) {
        let thumbnails = await JSPLib.network.getNotify(`/posts`, {tags: 'id:' + missing_posts.join(',') + ' status:any'});
        let $thumbnails = $.parseHTML(thumbnails);
        $('.post-preview', $thumbnails).each((i,thumb)=>{InitializeThumb(thumb);});
    }
    let $outerblock = $.parseHTML(RenderOpenItemContainer('poolposts', poolverid, 7));
    $('td', $outerblock).append(`<div class="el-add-pool-posts" style="display:none"></div><div class="el-rem-pool-posts" style="display:none"></div>`);
    if (add_posts.length) {
        let $container = $('.el-add-pool-posts', $outerblock).show();
        let query_string = '?q=id%3A' + add_posts.join('%2C');
        add_posts.forEach((post_id)=>{InsertPostPreview($container, post_id, query_string);});
    }
    if (rem_posts.length) {
        let $container = $('.el-rem-pool-posts', $outerblock).show();
        let query_string = '?q=id%3A' + rem_posts.join('%2C');
        rem_posts.forEach((post_id)=>{InsertPostPreview($container, post_id, query_string);});
    }
    $(rowelement).after($outerblock);
}

//Update links

function UpdateMultiLink(typelist,subscribed,itemid) {
    let typeset = new Set(typelist);
    let current_subscribed = new Set($('#el-subscribe-events .el-subscribed').map((i, entry) => entry.dataset.type.split(',')));
    let new_subscribed = (subscribed ?
        JSPLib.utility.setDifferenceN(current_subscribed, typeset) :
        JSPLib.utility.setUnionN(current_subscribed, typeset));
    $(`#el-subscribe-events[data-id="${itemid}"] span:not(.el-event-hidden) > .el-multi-link`).each((i, entry)=>{
        let entry_typelist = new Set(entry.dataset.type.split(','));
        if (JSPLib.utility.isSuperSetN(entry_typelist, new_subscribed)) {
            $(entry).removeClass('el-unsubscribed').addClass('el-subscribed');
        } else {
            $(entry).removeClass('el-subscribed').addClass('el-unsubscribed');
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
            let enabled_post_events = JSPLib.utility.arrayIntersection(ALL_POST_EVENTS, EL.user_settings.subscribe_events_enabled);
            $('#el-all-link').attr('data-type', enabled_post_events);
        } else {
            $('#el-subscribe-events').hide();
        }
    }
}

//Insert and process HTML onto page for various types

function InsertEvents($event_page,type) {
    InitializeTypeDiv(type, $('.striped', $event_page));
}

function InsertDmails($dmail_page,type) {
    DecodeProtectedEmail($dmail_page);
    let $dmail_table = $('.striped', $dmail_page);
    $('tr[data-is-read="false"]', $dmail_table).css('font-weight', 'bold');
    let $dmail_div = InitializeTypeDiv(type, $dmail_table);
    InitializeOpenDmailLinks($dmail_div[0]);
}

function InsertComments($comment_page) {
    DecodeProtectedEmail($comment_page);
    let $comment_section = $('.list-of-comments', $comment_page);
    let $comment_div = InitializeTypeDiv('comment', $comment_section);
    InitializeCommentIndexLinks($comment_div);
}

function InsertForums($forum_page) {
    DecodeProtectedEmail($forum_page);
    let $forum_table = $('.striped', $forum_page);
    let $forum_div = InitializeTypeDiv('forum', $forum_table);
    InitializeTopicIndexLinks($forum_div[0]);
    InitializeOpenForumLinks($forum_div[0]);
}

function InsertNotes($note_page) {
    DecodeProtectedEmail($note_page);
    let $note_table = $('.striped', $note_page);
    $('th:first-of-type, td:first-of-type', $note_table[0]).remove();
    let $note_div = InitializeTypeDiv('note', $note_table);
    AddThumbnails($note_div[0]);
    InitializePostNoteIndexLinks('note', $note_div[0]);
    InitializeOpenNoteLinks($note_div[0]);
}

function InsertPosts($post_page) {
    let $post_table = $('.striped', $post_page);
    $('.post-version-select-column', $post_table[0]).remove();
    $('tbody tr', $post_table[0]).each((i,row)=>{
        let post_id = $(row).data('post-id');
        $('td:first-of-type', row).html(`<a href="/posts/${post_id}">post #${post_id}</a>`);
    });
    let $post_div = InitializeTypeDiv('post', $post_table);
    AddThumbnails($post_div[0]);
    InitializePostNoteIndexLinks('post', $post_div[0]);
}

function InsertWikis($wiki_page) {
    DecodeProtectedEmail($wiki_page);
    let $wiki_table = $('.striped', $wiki_page);
    let $wiki_div = InitializeTypeDiv('wiki', $wiki_table);
    InitializeWikiIndexLinks($wiki_div[0]);
    InitializeOpenWikiLinks($wiki_div[0]);
}

function InsertPools($pool_page) {
    DecodeProtectedEmail($pool_page);
    let $pool_table = $('.striped', $pool_page);
    $('.pool-category-collection, .pool-category-series', $pool_table[0]).each((i,entry)=>{
        let short_pool_title = JSPLib.utility.maxLengthString(entry.innerText, 50);
        $(entry).attr('title', entry.innerText);
        entry.innerText = short_pool_title;
    });
    let $pool_div = InitializeTypeDiv('pool', $pool_table);
    InitializePoolIndexLinks($pool_div[0]);
    InitializeOpenPoolLinks($pool_div[0]);
}

function InitializeTypeDiv(type,$type_page) {
    let $type_table = $(`#el-${type}-table`);
    if ($('>div', $type_table[0]).length) {
        $('thead', $type_page[0]).hide();
    }
    let $type_div = $('<div></div>').append($type_page);
    $('.post-preview', $type_div).addClass('blacklisted');
    $type_table.append($type_div);
    return $type_div;
}

function InitializeThumb(thumb,query_string="") {
    let $thumb = $(thumb);
    $thumb.addClass('blacklisted');
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
    var post_ids = new Set();
    $('.striped tr[id]', dompage).each((i,row)=>{
        let $postlink = $('td:first-of-type a:first-of-type', row);
        let match = $postlink.length && $postlink.attr('href').match(/\/posts\/(\d+)/);
        if (!match) {
            //Something is wrong... break loop
            return false;
        }
        let postid = parseInt(match[1]);
        post_ids.add(postid);
        row_save[postid] = row_save[postid] || [];
        row_save[postid].push($(row).detach());
    });
    let display_ids = [...post_ids].sort().reverse();
    var $body = $('.striped tbody', dompage);
    post_ids.forEach((postid)=>{
        row_save[postid][0].prepend(`<td rowspan="${row_save[postid].length}" class="el-post-thumbnail" data-postid="${postid}"></td>`);
        row_save[postid].forEach((row)=>{
            $body.append(row);
        });
    });
    EL.post_ids = JSPLib.utility.setUnionN(EL.post_ids, post_ids);
}

async function GetThumbnails() {
    let found_post_ids = new Set(Object.keys(EL.thumbs).map(Number));
    let missing_post_ids = [...JSPLib.utility.setDifferenceN(EL.post_ids, found_post_ids)];
    for (let i = 0; i < missing_post_ids.length; i += QUERY_LIMIT) {
        let post_ids = missing_post_ids.slice(i, i + QUERY_LIMIT);
        let url_addon = {tags: `id:${post_ids} limit:${post_ids.length}`};
        let html = await JSPLib.network.getNotify('/posts', url_addon);
        let $posts = $.parseHTML(html);
        $('.post-preview', $posts).each((i,thumb)=>{
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
    let postid = $(rowelement).data('id');
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
    let typeset = GetList(type);
    let subscribe = (typeset.has(itemid) ? 'style="display:none !important"' : 'style');
    let unsubscribe = (typeset.has(itemid) ? 'style' : 'style="display:none !important"');
    let spacer = (right ? "&nbsp;&nbsp;" : "");
    return `
<${tag} class="el-subscribe-dual-links"  data-type="${type}" data-id="${itemid}">
    <${tag} class="el-subscribe" ${subscribe}><a class="el-monospace-link" href="javascript:void(0)">${spacer}Subscribe${separator}${ender}</a></${tag}>
    <${tag} class="el-unsubscribe" ${unsubscribe}"><a class="el-monospace-link" href="javascript:void(0)">Unsubscribe${separator}${ender}</a></${tag}>
</${tag}>`;
}

function RenderSubscribeMultiLinks(name,typelist,itemid) {
    let is_subscribed = typelist.every((type) => (GetList(type).has(itemid)));
    let classname = (is_subscribed ? 'el-subscribed' : 'el-unsubscribed');
    let keyname = JSPLib.utility.kebabCase(name);
    let idname = 'el-' + keyname + '-link';
    return `<li id="${idname}" data-type="${typelist}" class="el-multi-link ${classname}"><a href="javascript:void(0)">${name}</a></li>`;
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
        let forumid = $(row).data('id');
        let link_html = RenderOpenItemLinks('forum',forumid);
        $('.forum-post-excerpt', row).prepend(link_html + '&nbsp;|&nbsp;');
    });
    OpenItemClick('forum', AddForumPost);
}

function InitializeOpenNoteLinks(table) {
    $('.striped tr[id]', table).each((i,row)=>{
        let noteid = $(row).data('id');
        let link_html = RenderOpenItemLinks('note', noteid, "Render note", "Hide note");
        $('.body-column', row).append(`<p style="text-align:center">${link_html}</p>`);
    });
    OpenItemClick('note', AddRenderedNote, AdjustRowspan);
}

function InitializeOpenDmailLinks(table) {
    $('.striped tbody tr', table).each((i,row)=>{
        let dmailid = $(row).data('id');
        let link_html = RenderOpenItemLinks('dmail', dmailid);
        $('.subject-column', row).prepend(link_html + '&nbsp;|&nbsp;');
    });
    OpenItemClick('dmail', AddDmail);
}

function InitializeOpenWikiLinks(table) {
    $('.striped thead .diff-column').attr('width', '5%');
    $('.striped tbody tr', table).each((i,row)=>{
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
    $('.striped tbody tr', table).each((i,row)=>{
        let poolverid = $(row).data('id');
        let $post_changes = $('.post-changes-column', row);
        let add_posts = $('.diff-list ins a[href^="/posts"]', $post_changes[0]).map((i,entry)=>{return entry.innerText;}).toArray();
        let rem_posts = $('.diff-list del a[href^="/posts"]', $post_changes[0]).map((i,entry)=>{return entry.innerText;}).toArray();
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

//#C-POSTS #A-SHOW
function InitializePostShowMenu() {
    let postid = $('.image-container').data('id');
    let $menu_obj = $.parseHTML(RenderMultilinkMenu(postid, ALL_POST_EVENTS));
    ALL_POST_EVENTS.forEach((type)=>{
        let linkhtml = RenderSubscribeMultiLinks(TYPEDICT[type].display, [type], postid);
        let shownclass = (IsEventEnabled(type, 'subscribe_events_enabled') ? "" : 'el-event-hidden');
        $('#el-add-links', $menu_obj).append(`<span class="el-subscribe-${type}-container ${shownclass}">${linkhtml} | </span>`);
    });
    let shownclass = (AreAllEventsEnabled(ALL_TRANSLATE_EVENTS, 'subscribe_events_enabled') ? "" : ' el-event-hidden');
    let linkhtml = RenderSubscribeMultiLinks("Translations", ALL_TRANSLATE_EVENTS, postid);
    $('#el-add-links', $menu_obj).append(`<span class="el-subscribe-translated-container ${shownclass}">${linkhtml} | </span>`);
    //The All link is always shown when the outer menu is shown, so no need to individually hide it
    let enabled_post_events = JSPLib.utility.arrayIntersection(ALL_POST_EVENTS, EL.user_settings.subscribe_events_enabled);
    linkhtml = RenderSubscribeMultiLinks("All", enabled_post_events, postid);
    $('#el-add-links', $menu_obj).append(`<span class="el-subscribe-all-container">${linkhtml}</span>`);
    $('#nav').append($menu_obj);
}

//#C-FORUM-TOPICS #A-SHOW
function InitializeTopicShowMenu() {
    let topicid = $('body').data('forum-topic-id');
    let $menu_obj = $.parseHTML(RenderMultilinkMenu(topicid, ['forum']));
    let linkhtml = RenderSubscribeMultiLinks("Topic", ['forum'], topicid, "");
    let shownclass = (IsEventEnabled('forum', 'subscribe_events_enabled') ? "" : 'el-event-hidden');
    $('#el-add-links', $menu_obj).append(`<span class="el-subscribe-forum-container ${shownclass}">${linkhtml}</span>`);
    $('#nav').append($menu_obj);
}

//#C-FORUM-TOPICS #A-INDEX / #C-FORUM-POSTS #A-INDEX / EVENT-NOTICE
function InitializeTopicIndexLinks(container,render=true) {
    let type = GetTableType(container);
    let typeset = GetList('forum');
    $('.striped tbody tr', container).each((i,row)=>{
        let data_selector = (type === 'forum-topic' ? 'id' : 'topic-id');
        let topicid = $(row).data(data_selector);
        let entry = $("td:first-of-type", row).get(0);
        if (render) {
            let linkhtml = RenderSubscribeDualLinks('forum', topicid, 'span', "", "", true);
            let shownclass = (IsEventEnabled('forum', 'subscribe_events_enabled') ? "" : 'el-event-hidden');
            $(".title-column, .topic-column", row).prepend(`<span class="el-subscribe-forum-container ${shownclass}">${linkhtml}&nbsp|&nbsp</span>`);
        } else {
            let subscribed = !typeset.has(topicid);
            UpdateDualLink('forum', subscribed, topicid);
        }
    });
}

//#C-WIKI-PAGES #A-SHOW / #C-WIKI-PAGE-VERSIONS #A-SHOW
function InitializeWikiShowMenu() {
    let data_selector = (EL.controller === 'wiki-pages' ? 'wiki-page-id' : 'wiki-page-version-wiki-page-id');
    let wikiid = $('body').data(data_selector);
    let $menu_obj = $.parseHTML(RenderMultilinkMenu(wikiid, ['wiki']));
    let linkhtml = RenderSubscribeMultiLinks("Wiki", ['wiki'], wikiid, "");
    let shownclass = (IsEventEnabled('wiki', 'subscribe_events_enabled') ? "" : 'el-event-hidden');
    $('#el-add-links', $menu_obj).append(`<span class="el-subscribe-wiki-container ${shownclass}">${linkhtml}</span>`);
    $('#nav').append($menu_obj);
}

//#C-WIKI-PAGES #A-INDEX / #C-WIKI-PAGE-VERSIONS #A-INDEX / EVENT-NOTICE
function InitializeWikiIndexLinks(container,render=true) {
    let type = GetTableType(container);
    let typeset = GetList('wiki');
    $('.striped tbody tr', container).each((i,row)=>{
        let data_selector = (type === 'wiki-page' ? 'id' : 'wiki-page-id');
        let wikiid = $(row).data(data_selector);
        if (render) {
            let linkhtml = RenderSubscribeDualLinks('wiki', wikiid, 'span', "", "", true);
            let shownclass = (IsEventEnabled('wiki', 'subscribe_events_enabled') ? "" : 'el-event-hidden');
            $(' .title-column', row).prepend(`<span class="el-subscribe-wiki-container ${shownclass}">${linkhtml}&nbsp|&nbsp</span>`);
        } else {
            let subscribed = !typeset.has(wikiid);
            UpdateDualLink('wiki', subscribed, wikiid);
        }
    });
}

//#C-POOLS #A-SHOW
function InitializePoolShowMenu() {
    let poolid = $('body').data('pool-id');
    let $menu_obj = $.parseHTML(RenderMultilinkMenu(poolid, ['pool']));
    let linkhtml = RenderSubscribeMultiLinks("Pool", ['pool'], poolid, "");
    let shownclass = (IsEventEnabled('pool', 'subscribe_events_enabled') ? "" : 'el-event-hidden');
    $('#el-add-links', $menu_obj).append(`<span class="el-subscribe-pool-container ${shownclass}">${linkhtml}</span>`);
    $('#nav').append($menu_obj);
}

//#C-POOLS #A-INDEX / #C-POOL-VERSIONS #A-INDEX / EVENT-NOTICE
function InitializePoolIndexLinks(container,render=true) {
    let type = GetTableType(container);
    let typeset = GetList('pool');
    $('.striped tbody tr', container).each((i,row)=>{
        let data_selector = (type === 'pool' ? 'id' : 'pool-id');
        let poolid = $(row).data(data_selector);
        if (render) {
            let linkhtml = RenderSubscribeDualLinks('pool', poolid, 'span', "", "", true);
            let shownclass = (IsEventEnabled('pool', 'subscribe_events_enabled') ? "" : 'el-event-hidden');
            $('.name-column, .pool-column', row).prepend(`<span class="el-subscribe-pool-container ${shownclass}">${linkhtml}&nbsp|&nbsp</span>`);
        } else {
            let subscribed = !typeset.has(poolid);
            UpdateDualLink('pool', subscribed, poolid);
        }
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
        let shownclass = (IsEventEnabled('pool', 'subscribe_events_enabled') ? "" : 'el-event-hidden');
        $(entry).before(`<div class="el-subscribe-pool-container ${shownclass}">${linkhtml}</div>`);
    });
}
//EVENT NOTICE
function InitializePostNoteIndexLinks(type,table,render=true) {
    let typeset = GetList(type);
    let seenlist = [];
    $('.striped tr[id]', table).each((i,row)=>{
        let postid = $(row).data('post-id');
        //Since posts and notes are aggragated by post, only process the first row for each post ID
        if (seenlist.includes(postid)) {
            return;
        }
        seenlist.push(postid);
        if (render) {
            let linkhtml = RenderSubscribeDualLinks(type, postid, 'span', " ", type, true);
            $('td:first-of-type', row).prepend(`<div style="text-align:center">${linkhtml}</div>`);
        } else {
            let subscribed = !typeset.has(postid);
            UpdateDualLink(type, subscribed, postid);
        }
    });
}

//#C-COMMENTS #A-INDEX / EVENT-NOTICE
function InitializeCommentIndexLinks($obj,render=true) {
    let typeset = GetList('comment');
    $('.post-preview', $obj).each((i,entry)=>{
        var postid = $(entry).data('id');
        if (render) {
            var linkhtml = RenderSubscribeDualLinks('comment', postid, 'div', " ", 'comments');
            let shownclass = (IsEventEnabled('comment', 'subscribe_events_enabled') ? "" : 'el-event-hidden');
            let $subscribe = $.parseHTML(`<div class="el-subscribe-comment-container ${shownclass}">${linkhtml}</div>`);
            $('.preview', entry).append($subscribe);
        } else {
            let subscribed = !typeset.has(postid);
            UpdateDualLink('comment', subscribed, postid);
        }
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
            ReloadEventNotice.debuglog(key, "is not a list!", savedlist);
            return;
        }
        promise_array.push(LoadHTMLType(match[3], savedlist));
    });
    Promise.all(promise_array).then(()=>{
        ProcessThumbnails();
        FinalizeEventNotice();
        JSPLib.utility.notice("Notice reloaded.");
        $("#el-event-controls").show();
        $("#el-loading-message").hide();
    });
}

function UpdateAll(event) {
    JSPLib.network.counter_domname = '#el-activity-indicator';
    EL.no_limit = true;
    ProcessAllEvents(()=>{
        JSPLib.concurrency.setRecheckTimeout('el-event-timeout', EL.timeout_expires);
        SetLastSeenTime();
        JSPLib.utility.notice("All events checked!");
        $("#el-event-controls").show();
        $("#el-loading-message").hide();
    });
}

function ResetAll(event) {
    LASTID_KEYS.forEach((key)=>{
        localStorage.removeItem(key);
    });
    ProcessAllEvents(()=>{
        JSPLib.concurrency.setRecheckTimeout('el-event-timeout', EL.timeout_expires);
        SetLastSeenTime();
        JSPLib.utility.notice("All event positions reset!");
        $("#el-event-controls").show();
        $("#el-loading-message").hide();
    });
}

function SubscribeMultiLink(event) {
    let $menu = $(JSPLib.utility.getNthParent(event.target, 4));
    let $container = $(event.target.parentElement);
    let itemid = $menu.data('id');
    let typelist = $container.data('type').split(',');
    let subscribed = ($container.hasClass('el-subscribed') ? true : false);
    typelist.forEach((type)=>{
        setTimeout(()=>{
            TIMER.SetList(type, subscribed, itemid);
        }, NONSYNCHRONOUS_DELAY);
        UpdateDualLink(type, subscribed, itemid);
    });
    UpdateMultiLink(typelist, subscribed, itemid);
}

function SubscribeDualLink(event) {
    let $container = $(JSPLib.utility.getNthParent(event.target, 2));
    let type = $container.data('type');
    let itemid = $container.data('id');
    let subscribed = GetList(type).has(itemid);
    setTimeout(()=>{
        TIMER.SetList(type, subscribed, itemid);
    }, NONSYNCHRONOUS_DELAY);
    UpdateDualLink(type, subscribed, itemid);
    UpdateMultiLink([type], subscribed, itemid);
}

async function PostEventPopulateControl(event) {
    let post_events = JSPLib.menu.getCheckboxRadioSelected(`[data-setting="post_events"] [data-selector]`);
    let operation = JSPLib.menu.getCheckboxRadioSelected(`[data-setting="operation"] [data-selector]`);
    let search_query = $('#el-control-search-query').val();
    if (post_events.length === 0 || operation.length === 0) {
        JSPLib.utility.notice("Must select at least one post event type!");
    } else if (search_query === "") {
        JSPLib.utility.notice("Must have at least one search term!");
    } else {
        $('#el-search-query-display').show();
        let posts = await JSPLib.danbooru.getPostsCountdown(search_query, 100, ID_FIELD, '#el-search-query-counter');
        let postids = new Set(JSPLib.utility.getObjectAttributes(posts, 'id'));
        let post_changes = new Set();
        let was_subscribed, new_subscribed;
        post_events.forEach((eventtype)=>{
            let typeset = GetList(eventtype);
            switch (operation[0]) {
                case 'add':
                    new_subscribed = JSPLib.utility.setDifferenceN(postids, typeset);
                    was_subscribed = new Set();
                    post_changes = JSPLib.utility.setUnionN(post_changes, new_subscribed);
                    typeset = JSPLib.utility.setUnionN(typeset, postids);
                    break;
                case 'subtract':
                    new_subscribed = new Set();
                    was_subscribed = JSPLib.utility.setIntersectionN(postids, typeset);
                    post_changes = JSPLib.utility.setUnionN(post_changes, was_subscribed)
                    typeset = JSPLib.utility.setDifferenceN(typeset, postids);
                    break;
                case 'overwrite':
                    was_subscribed = JSPLib.utility.setDifferenceN(typeset, postids);
                    new_subscribed = JSPLib.utility.setDifferenceN(postids, typeset);
                    post_changes = JSPLib.utility.setUnionN(post_changes, postids);
                    typeset = postids;
            }
            EL.subscribeset[eventtype] = typeset;
            setTimeout(()=>{
                JSPLib.storage.setStorageData(`el-${eventtype}list`, [...EL.subscribeset[eventtype]], localStorage);
            }, NONSYNCHRONOUS_DELAY);
            EL.channel.postMessage({type: 'reload', eventtype: eventtype, was_subscribed: was_subscribed, new_subscribed: new_subscribed, eventlist: EL.subscribeset[eventtype]});
        });
        $('#el-search-query-counter').html(0);
        JSPLib.utility.notice(`Subscriptions were changed by ${post_changes.size} posts!`);
    }
}

//Event setup functions

function OpenItemClick(type,htmlfunc,otherfunc) {
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
//Callback functions

function SubscribeMultiLinkCallback() {
    EL.user_settings.autosubscribe_enabled.forEach((type)=>{
        $(`#el-subscribe-events .el-unsubscribed[data-type="${type}"] a`).click();
    });
}

//Rebind functions

function RebindMenuAutocomplete() {
    JSPLib.utility.recheckTimer({
        check: ()=>{return JSPLib.utility.hasDOMDataKey('#user_blacklisted_tags, #user_favorite_tags', 'uiAutocomplete');},
        exec: ()=>{
            $('#user_blacklisted_tags, #user_favorite_tags').autocomplete('destroy').off('keydown.Autocomplete.tab');
            $('#el-control-search-query, #el-setting-filter-post-edits, ' + JSPLib.utility.joinList(POST_QUERY_EVENTS, '#el-setting-', '-query', ',')).attr('data-autocomplete', 'tag-query');
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
        let query_addon = {};
        //Check if the post query has any non-operator text
        if (post_query.replace(/[\s-*~]+/g, '').length > 0) {
            query_addon = (TYPEDICT[type].customquery ? TYPEDICT[type].customquery(post_query) : {search: {post_tags_match: post_query}});
        }
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
        let typeset = GetList(type);
        let savedlistkey = `el-saved${type}list`;
        let savedlastidkey = `el-saved${type}lastid`;
        let overflowkey = `el-${type}overflow`;
        let type_addon = TYPEDICT[type].addons || {};
        let only_attribs = TYPEDICT[type].only;
        if (EL.user_settings.show_creator_events) {
            only_attribs += (TYPEDICT[type].includes ? ',' + TYPEDICT[type].includes : "");
        }
        let urladdons = JSPLib.utility.joinArgs(type_addon, {only: only_attribs});
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
        let filtertype = TYPEDICT[type].filter(jsontype, typeset);
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
    EL.renderedlist[type] = EL.renderedlist[type] || [];
    let displaylist = JSPLib.utility.arrayDifference(idlist, EL.renderedlist[type]);
    if (displaylist.length === 0) {
        return;
    }
    EL.renderedlist[type] = JSPLib.utility.concat(EL.renderedlist[type], displaylist);
    for (let i = 0; i < displaylist.length; i += QUERY_LIMIT) {
        let querylist = displaylist.slice(i, i + QUERY_LIMIT);
        let url_addons = JSPLib.utility.joinArgs(type_addon, {search: {id: querylist.join(',')}, type: 'previous', limit: querylist.length});
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

function FinalizeEventNotice() {
    let thumb_promise = Promise.resolve(null);
    if (EL.post_ids.size) {
        thumb_promise = TIMER.GetThumbnails();
    }
    thumb_promise.then(()=>{
        InsertThumbnails();
        $("#el-event-controls").show();
        $("#el-loading-message").hide();
        localStorage['el-saved-notice'] = LZString.compressToUTF16($("#el-event-notice").html());
        JSPLib.concurrency.setRecheckTimeout('el-saved-timeout', EL.timeout_expires);
    });
}

async function CheckAllEvents(promise_array) {
    let hasevents_all = await Promise.all(promise_array);
    let hasevents = hasevents_all.some(val => val);
    ProcessThumbnails();
    if (hasevents) {
        FinalizeEventNotice();
    }
    JSPLib.storage.setStorageData('el-overflow', EL.item_overflow, localStorage);
    if (!EL.user_settings.autoclose_dmail_notice) {
        EL.dmail_notice.show();
    }
    return hasevents;
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
    TIMER.CheckAllEvents(promise_array).then((hasevents)=>{
        func(hasevents);
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
            MarkAllAsRead.debuglog(key, "is not a valid ID!", savedlastid);
            return;
        }
        SaveLastID(match[2], savedlastid, match[1]);
    });
    localStorage.removeItem('el-saved-notice');
    if (!EL.user_settings.autoclose_dmail_notice) {
        EL.dmail_notice.show();
    }
    SetLastSeenTime();
}

function EventStatusCheck() {
    let disabled_events = JSPLib.utility.arrayDifference(POST_QUERY_EVENTS, EL.user_settings.post_query_events_enabled);
    disabled_events.forEach((type)=>{
        //Delete every associated value but the list
        localStorage.removeItem(`el-pq-${type}lastid`);
        localStorage.removeItem(`el-pq-saved${type}lastid`);
    });
    disabled_events = JSPLib.utility.arrayDifference(SUBSCRIBE_EVENTS, EL.user_settings.subscribe_events_enabled);
    disabled_events.forEach((type)=>{
        //Delete every associated value but the list
        localStorage.removeItem(`el-${type}lastid`);
        localStorage.removeItem(`el-saved${type}lastid`);
        localStorage.removeItem(`el-${type}overflow`);
    });
    disabled_events = JSPLib.utility.arrayDifference(OTHER_EVENTS, EL.user_settings.other_events_enabled);
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
            EL.subscribeset[ev.data.eventtype] = ev.data.eventset;
            UpdateMultiLink([ev.data.eventtype], ev.data.was_subscribed, ev.data.itemid);
            UpdateDualLink(ev.data.eventtype, ev.data.was_subscribed, ev.data.itemid);
            break;
        case 'reload':
            EL.subscribeset[ev.data.eventtype] = ev.data.eventset;
            menuid = $('#el-subscribe-events').data('id');
            if (ev.data.was_subscribed.has(menuid)) {
                UpdateMultiLink([ev.data.eventtype], true, menuid);
            } else if (ev.data.new_subscribed.has(menuid)) {
                UpdateMultiLink([ev.data.eventtype], false, menuid);
            }
            $(`.el-subscribe-${ev.data.eventtype}[data-id]`).each((i,entry)=>{
                linkid = $(entry).data('id');
                if (ev.data.was_subscribed.has(linkid)) {
                    UpdateDualLink(ev.data.eventtype, true, linkid);
                } else if (ev.data.new_subscribed.has(linkid)) {
                    UpdateDualLink(ev.data.eventtype, false, linkid);
                }
            });
            //falls through
        default:
            //do nothing
    }
}

function InitializeChangedSettings() {
    if (EL.user_settings.flag_query === "###INITIALIZE###" || EL.user_settings.appeal_query === "###INITIALIZE###") {
        EL.user_settings.flag_query = EL.user_settings.appeal_query = 'user:' + EL.username;
        JSPLib.menu.updateUserSettings();
        JSPLib.storage.setStorageData('el-user-settings', EL.user_settings, localStorage);
    }
}

function RemoteSettingsCallback() {
    ToggleSubscribeLinks();
}

function RemoteResetCallback() {
    JSPLib.utility.fullHide('#el-event-notice, #el-subscribe-events, .el-subscribe-dual-links');
}

function GetRecheckExpires() {
    return EL.user_settings.recheck_interval * JSPLib.utility.one_minute;
}

function GetPostFilterTags() {
    return new Set(EL.user_settings.filter_post_edits.trim().split(/\s+/));
}

function RenderSettingsMenu() {
    $('#event-listener').append(EL_MENU);
    $('#el-general-settings').append(JSPLib.menu.renderDomainSelectors());
    $('#el-notice-settings').append(JSPLib.menu.renderCheckbox('autolock_notices'));
    $('#el-notice-settings').append(JSPLib.menu.renderCheckbox('mark_read_topics'));
    $('#el-notice-settings').append(JSPLib.menu.renderCheckbox('autoclose_dmail_notice'));
    $('#el-filter-settings').append(JSPLib.menu.renderCheckbox('filter_user_events'));
    $('#el-filter-settings').append(JSPLib.menu.renderCheckbox('filter_untranslated_commentary'));
    $('#el-filter-settings').append(JSPLib.menu.renderCheckbox('filter_autofeedback'));
    $('#el-filter-settings').append(JSPLib.menu.renderCheckbox('filter_BUR_edits'));
    $('#el-filter-settings').append(JSPLib.menu.renderCheckbox('filter_autobans'));
    $('#el-filter-settings').append(JSPLib.menu.renderTextinput('filter_post_edits', 80));
    $('#el-post-query-event-settings').append(JSPLib.menu.renderInputSelectors('post_query_events_enabled', 'checkbox'));
    $('#el-post-query-event-settings').append(JSPLib.menu.renderTextinput('comment_query', 80));
    $('#el-post-query-event-settings').append(JSPLib.menu.renderTextinput('note_query', 80));
    $('#el-post-query-event-settings').append(JSPLib.menu.renderTextinput('commentary_query', 80));
    $('#el-post-query-event-settings').append(JSPLib.menu.renderTextinput('post_query', 80));
    $('#el-post-query-event-settings').append(JSPLib.menu.renderTextinput('approval_query', 80));
    $('#el-post-query-event-settings').append(JSPLib.menu.renderTextinput('flag_query', 80));
    $('#el-post-query-event-settings').append(JSPLib.menu.renderTextinput('appeal_query', 80));
    $('#el-subscribe-event-settings').append(JSPLib.menu.renderInputSelectors('subscribe_events_enabled', 'checkbox'));
    $('#el-subscribe-event-settings').append(JSPLib.menu.renderInputSelectors('autosubscribe_enabled', 'checkbox'));
    $('#el-subscribe-event-settings').append(JSPLib.menu.renderCheckbox('show_creator_events'));
    $('#el-other-event-settings').append(JSPLib.menu.renderInputSelectors('other_events_enabled', 'checkbox'));
    $('#el-other-event-settings').append(JSPLib.menu.renderInputSelectors('subscribed_mod_actions', 'checkbox'));
    $('#el-network-settings').append(JSPLib.menu.renderTextinput('recheck_interval', 10));
    $('#el-subscribe-controls').append(JSPLib.menu.renderInputSelectors('post_events', 'checkbox', true));
    $('#el-subscribe-controls').append(JSPLib.menu.renderInputSelectors('operation', 'radio', true));
    $('#el-subscribe-controls').append(JSPLib.menu.renderTextinput('search_query', 50, true));
    $('#el-subscribe-controls').append(DISPLAY_COUNTER);
    $('#el-cache-settings').append(JSPLib.menu.renderLinkclick('cache_info'));
    $('#el-cache-settings').append(CACHE_INFO_TABLE);
    $('#el-cache-editor-controls').append(CONTROL_DATA_SOURCE);
    $("#el-cache-editor-controls").append(JSPLib.menu.renderCheckbox('raw_data', true));
    $('#el-cache-editor-controls').append(JSPLib.menu.renderTextinput('data_name', 20, true));
    JSPLib.menu.engageUI(true);
    JSPLib.menu.saveUserSettingsClick();
    JSPLib.menu.resetUserSettingsClick(LOCALSTORAGE_KEYS, InitializeChangedSettings);
    $('#el-search-query-get').on(PROGRAM_CLICK, PostEventPopulateControl);
    JSPLib.menu.cacheInfoClick();
    JSPLib.menu.rawDataChange();
    JSPLib.menu.getCacheClick();
    JSPLib.menu.saveCacheClick(ValidateProgramData);
    JSPLib.menu.deleteCacheClick();
    JSPLib.menu.listCacheClick();
    JSPLib.menu.refreshCacheClick();
    JSPLib.menu.cacheAutocomplete();
    RebindMenuAutocomplete();
}

//Main program

function Main() {
    Danbooru.EL = Object.assign(EL, {
        controller: document.body.dataset.controller,
        action: document.body.dataset.action,
        username: Danbooru.CurrentUser.data('name'),
        userid: Danbooru.CurrentUser.data('id'),
        dmail_notice: $('#dmail-notice').hide(),
        subscribeset: {},
        openlist: {},
        renderedlist: {},
        marked_topic: [],
        item_overflow: false,
        no_limit: false,
        events_checked: false,
        post_ids: new Set(),
        thumbs: {},
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
    Object.assign(EL, {
        user_settings: JSPLib.menu.loadUserSettings(),
    });
    //Only used on new installs
    InitializeChangedSettings();
    if (JSPLib.danbooru.isSettingMenu()) {
        JSPLib.menu.loadStorageKeys();
        JSPLib.utility.installScript(JQUERY_TAB_WIDGET_URL).done(()=>{
            JSPLib.menu.installSettingsMenu();
            RenderSettingsMenu();
        });
        JSPLib.utility.setCSSStyle(MENU_CSS, 'menu');
    }
    if (!JSPLib.menu.isScriptEnabled()) {
        Main.debuglog("Script is disabled on", window.location.hostname);
        return;
    }
    Object.assign(EL, {
        timeout_expires: GetRecheckExpires(),
        locked_notice: EL.user_settings.autolock_notices,
        post_filter_tags: GetPostFilterTags(),
    });
    EventStatusCheck();
    if (!document.hidden && localStorage['el-saved-notice'] !== undefined && !JSPLib.concurrency.checkTimeout('el-saved-timeout', EL.timeout_expires)) {
        let notice_html = LZString.decompressFromUTF16(localStorage['el-saved-notice']);
        InitializeNoticeBox(notice_html);
        for (let type in TYPEDICT) {
            let $section = $(`#el-${type}-section`);
            if($section.children().length) {
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
    } else if (!document.hidden && (JSPLib.concurrency.checkTimeout('el-event-timeout', EL.timeout_expires) || WasOverflow() || EL.dmail_notice.length) && JSPLib.concurrency.reserveSemaphore(PROGRAM_SHORTCUT)) {
        InitializeNoticeBox();
        if (CheckAbsence()) {
            EL.events_checked = true;
            JSPLib.concurrency.setRecheckTimeout('el-event-timeout', EL.timeout_expires);
            ProcessAllEvents((hasevents)=>{
                SetLastSeenTime();
                JSPLib.concurrency.freeSemaphore(PROGRAM_SHORTCUT);
                if (hasevents) {
                    JSPLib.utility.notice("Events are ready for viewing!");
                    $("#el-event-controls").show();
                    $("#el-loading-message").hide();
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
            $('#el-event-notice').show();
            JSPLib.concurrency.freeSemaphore(PROGRAM_SHORTCUT);
        }
    } else {
        if (!EL.user_settings.autoclose_dmail_notice) {
            EL.dmail_notice.show();
        }
        Main.debuglog("Waiting...");
    }
    $(document).on(PROGRAM_CLICK, '.el-subscribe-dual-links a', SubscribeDualLink);
    $(document).on(PROGRAM_CLICK, '#el-subscribe-events a', SubscribeMultiLink);
    let $main_section = $('#c-' + Danbooru.EL.controller);
    if (EL.controller === 'posts' && EL.action === 'show') {
        InitializePostShowMenu();
        if ($(`.image-container[data-uploader-id="${EL.userid}"]`).length) {
            SubscribeMultiLinkCallback();
        }
    } else if (EL.controller === 'comments' && EL.action === 'index') {
        InitializeCommentIndexLinks($main_section);
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
    if (EL.user_settings.autoclose_dmail_notice && EL.events_checked) {
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
    Main, BroadcastEL, CheckSubscribeType, MarkAllAsRead, ProcessEvent, SaveLastID, CorrectList,
    CheckPostQueryType, CheckOtherType, ReloadEventNotice,
]);

/****Initialization****/

//Variables for debug.js
JSPLib.debug.debug_console = false;
JSPLib.debug.level = JSPLib.debug.INFO;
JSPLib.debug.pretext = 'EL:';
JSPLib.debug.pretimer = 'EL-';

//Variables for menu.js
JSPLib.menu.program_shortcut = PROGRAM_SHORTCUT;
JSPLib.menu.program_name = PROGRAM_NAME;
JSPLib.menu.settings_callback = RemoteSettingsCallback;
JSPLib.menu.reset_callback = RemoteResetCallback;

//Export JSPLib
JSPLib.load.exportData(PROGRAM_NAME, EL);

/****Execution start****/

JSPLib.load.programInitialize(Main, 'EL', PROGRAM_LOAD_REQUIRED_VARIABLES, PROGRAM_LOAD_REQUIRED_SELECTORS);
