// ==UserScript==
// @name         EventListener
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      16.2
// @description  Informs users of new events (flags,appeals,dmails,comments,forums,notes,commentaries,post edits,wikis,pools)
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @exclude      /^https?://\w+\.donmai\.us/.*\.(xml|json|atom)(\?|$)/
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/eventlistener.user.js
// @require      https://cdn.jsdelivr.net/npm/core-js-bundle@3.2.1/minified.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jsdiff/4.0.1/diff.min.js
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

/* global JSPLib jQuery $ Danbooru Diff */

/****Global variables****/

//Variables for debug.js
JSPLib.debug.debug_console = false;
JSPLib.debug.level = JSPLib.debug.INFO;
JSPLib.debug.pretext = 'EL:';
JSPLib.debug.pretimer = 'EL-';

//Variables for load.js
const PROGRAM_LOAD_REQUIRED_VARIABLES = ['window.jQuery','window.Danbooru'];
const PROGRAM_LOAD_REQUIRED_SELECTORS = ['#nav', '#page'];

//Main program variable
var EL;

//Timer function hash
const TIMER = {};

//For factory reset
const USER_EVENTS = ['flag', 'appeal', 'dmail', 'spam'];
const SUBSCRIBE_EVENTS = ['comment', 'forum', 'note', 'commentary', 'post', 'wiki', 'pool'];
const ALL_EVENTS = USER_EVENTS.concat(SUBSCRIBE_EVENTS);
const LASTID_KEYS = ALL_EVENTS.map((type)=>{return `el-${type}lastid`;});
const OTHER_KEYS = SUBSCRIBE_EVENTS.map((type)=>{return [`el-${type}list`, `el-saved${type}list`, `el-saved${type}lastid`, `el-${type}overflow`];}).flat();
const LOCALSTORAGE_KEYS = LASTID_KEYS.concat(OTHER_KEYS).concat([
    'el-process-semaphore',
    'el-events',
    'el-overflow',
    'el-timeout',
    'el-last-seen'
]);
//Not handling reset event yet
const PROGRAM_RESET_KEYS = {};

//Available setting values
const ENABLE_EVENTS = ['flag', 'appeal', 'dmail', 'comment', 'note', 'commentary', 'forum'];
const AUTOSUBSCRIBE_EVENTS = ['post', 'comment', 'note', 'commentary'];

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
    recheck_interval: {
        default: 5,
        parse: parseInt,
        validate: (data)=>{return Number.isInteger(data) && data > 0;},
        hint: "How often to check for new events (# of minutes)."
    },
    events_enabled: {
        allitems: ALL_EVENTS,
        default: ENABLE_EVENTS,
        validate: (data)=>{return JSPLib.menu.validateCheckboxRadio(data, 'checkbox', ALL_EVENTS);},
        hint: "Uncheck to turn off event type."
    },
    autosubscribe_enabled: {
        allitems: AUTOSUBSCRIBE_EVENTS,
        default: [],
        validate: (data)=>{return JSPLib.menu.validateCheckboxRadio(data, 'checkbox', AUTOSUBSCRIBE_EVENTS);},
        hint: "Check to autosubscribe event type."
    }
}

//CSS Constants

const PROGRAM_CSS = `
#event-notice {
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
    color: grey;
}
.el-subscribe-pool-container .el-subscribe-dual-links .el-monospace-link:hover {
    color: lightgrey;
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
    color: green;
}
#el-subscribe-events .el-subscribed a:hover,
#subnav-unsubscribe-link:hover {
    color: #6b6;
}
#el-subscribe-events .el-unsubscribed a,
#subnav-subscribe-link {
    color: darkorange;
}
#el-subscribe-events .el-unsubscribed a:hover,
#subnav-subscribe-link:hover {
    color: #fb6;
}
#lock-event-notice,
#read-event-notice {
    font-weight: bold;
    color: green;
}
#lock-event-notice:not(.el-locked):hover ,
#read-event-notice:not(.el-read):hover {
    color: #6b6;
}
#lock-event-notice.el-locked,
#read-event-notice.el-read {
    color: red;
}
#el-absent-section {
    margin: 0.5em;
    border: solid 1px grey;
    padding: 0.5em;
}
`;

const COMMENT_CSS = `
#event-notice #comment-section #comment-table .post-preview {
    display: flex;
    flex-direction: row;
    margin-bottom: 1em;
    border-bottom: 1px solid lightgrey;
    min-height: 14em;
}
#event-notice #comment-section #comment-table .preview {
    flex-direction: column;
    display: flex;
    width: 154px;
    height: 170px;
    text-align: center;
    margin-right: 0;
}
#event-notice #comment-section #comment-table .comment {
    padding: 1em;
    margin-top: 0;
    word-wrap: break-word;
    display: flex;
}
`;

const FORUM_CSS = `
#event-notice #forum-section #forum-table .author {
    padding: 1em 1em 0 1em;
    width: 12em;
    float: left;
}
#event-notice #forum-section #forum-table .content {
    padding: 1em;
    margin-left: 14em;
}`;

const WIKI_CSS = `
#event-notice #wiki-section ins {
    background: #cfc;
    text-decoration: none;
}
#event-notice #wiki-section del {
    background: #fcc;
    text-decoration: none;
}
.el-paragraph-mark {
    opacity: 0.25;
}
`;

const POOL_CSS = `
#event-notice #pool-section .el-pool-diff {
    overflow-x: auto;
    max-width: 90vw;
}
#event-notice #pool-section .el-pool-diff ins {
    background: #cfc;
    text-decoration: none;
}
#event-notice #pool-section .el-pool-diff del {
    background: #fcc;
    text-decoration: none;
}
#event-notice #pool-section .el-add-pool-posts {
    background-color: rgba(0, 255, 0, 0.2);
}
#event-notice #pool-section .el-rem-pool-posts {
    background-color: rgba(255, 0, 0, 0.2);
}
#event-notice #pool-section .el-pool-posts .post-preview {
    width: 154px;
    height: 154px;
    margin: 5px;
    padding: 5px;
    border: 1px solid #AAA;
}
.el-paragraph-mark {
    opacity: 0.25;
}
`;

//HTML constants

const NOTICE_BOX = `
<div id="event-notice" style="display:none" class="notice notice-info">
    <div id="el-absent-section" style="display:none">
        <p>You have been gone for <b><span id="el-days-absent"></span></b> days.
        <p>This can cause delays and multiple page refreshes for the script to finish processing all updates.</p>
        <p>To process them all now, click the "<b>Update</b>" link below, or click "<b>Close this</b>" to process them normally.</p>
        <p style="font-size:125%"><b><a id="el-update-all" href="#">Update</a> (<span id="el-activity-indicator">...</span>)</b></p>
        <div id="el-excessive-absent" style="display:none">
            <hr>
            <p><b><span style="color:red;font-size:150%">WARNING!</span> You have been gone longer than a month.</b></p>
            <p>Consider resetting the event positions to their most recent values instead by clicking "<b>Reset</b>".
            <p style="font-size:125%"><b><a id="el-reset-all" href="#">Reset</a></b></p>
        </div>
    </div>
    <div id="dmail-section"  style="display:none">
        <h1>You've got mail!</h1>
        <div id="dmail-table"></div>
    </div>
    <div id="flag-section"  style="display:none">
        <h1>You've got flags!</h1>
        <div id="flag-table"></div>
    </div>
    <div id="appeal-section"  style="display:none">
        <h1>You've got appeals!</h1>
        <div id="appeal-table"></div>
    </div>
    <div id="forum-section"  style="display:none">
        <h1>You've got forums!</h1>
        <div id="forum-table"></div>
    </div>
    <div id="comment-section"  class="comments-for-post" style="display:none">
        <h1>You've got comments!</h1>
        <div id="comment-table"></div>
    </div>
    <div id="note-section"  style="display:none">
        <h1>You've got notes!</h1>
        <div id="note-table"></div>
    </div>
    <div id="commentary-section"  style="display:none">
        <h1>You've got commentaries!</h1>
        <div id="commentary-table"></div>
    </div>
    <div id="wiki-section"  style="display:none">
        <h1>You've got wikis!</h1>
        <div id="wiki-table"></div>
    </div>
    <div id="pool-section"  style="display:none">
        <h1>You've got pools!</h1>
        <div id="pool-table"></div>
    </div>
    <div id="post-section"  style="display:none">
        <h1>You've got edits!</h1>
        <div id="post-table"></div>
    </div>
    <div id="spam-section"  style="display:none">
        <h1>You've got spam!</h1>
        <div id="spam-table"></div>
    </div>
    <div style="margin-top:1em">
        <a href="#" id="hide-event-notice">Close this</a>
        [
        <a href="javascript:void(0)" id="lock-event-notice" title="Keep notice from being closed by other tabs.">LOCK</a>
        |
        <a href="javascript:void(0)" id="read-event-notice" title="Mark all items as read.">READ</a>
        ]
    </div>
</div>
`;

//Since append is primarily used, these need to be separate ***CSS THE STYLING!!!***
const DISPLAY_COUNTER = `
<div id="el-search-query-display" style="margin:0.5em;font-size:150%;border:lightgrey solid 1px;padding:0.5em;width:7.5em;display:none">
    Pages left: <span id="el-search-query-counter">...</span>
</div>`;

const PARAGRAPH_MARK = `<span class="el-paragraph-mark">¶</span><br>`;

const EL_MENU = `
<div id="el-script-message" class="prose">
    <h2>EventListener</h2>
    <p>Check the forum for the latest on information and updates (<a class="dtext-link dtext-id-link dtext-forum-topic-id-link" href="/forum_topics/14747" style="color:#0073ff">topic #14747</a>).</p>
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
        <div id="el-event-settings" class="jsplib-settings-grouping">
            <div id="el-event-message" class="prose">
                <h4>Event settings</h4>
                <div class="expandable">
                    <div class="expandable-header">
                        <span>Additional setting details</span>
                        <input type="button" value="Show" class="expandable-button">
                    </div>
                    <div class="expandable-content">
                        <ul>
                            <li><b>Events enabled:</b>
                                <ul>
                                    <li>Subscription-type events will not be checked unless there is more than one subscribed item.</li>
                                    <li>These include comments, notes, commentaries, and forums.</li>
                                </ul>
                            </li>
                            <li><b>Autosubscribe enabled:</b>
                                <ul>
                                    <li>Which events on a user's uploads will be automatically subscribed.</li>
                                    <li>Events will only be subscribed on the post page for that upload.</li>
                                </ul>
                            </li>
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
                <h4>Cache settings</h4>
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
                    <p class="tn">All timestamps are in milliseconds since the epoch (<a href="https://www.epochconverter.com" style="color:#0073ff">Epoch converter</a>).</p>
                    <ul>
                        <li>General data
                            <ul>
                                <li><b>events:</b> Were events found and showing up in the event notice? This controls whether or not the script will do a reload at the next page refresh regardless of the timeout.</li>
                                <li><b>last-seen:</b> When was the last recheck? This controls when the absence tracker will launch.</li>
                                <li><b>overflow:</b> Did any of the events overflow last page refresh? This controls whether or not the script will do a recheck at the next page refresh regardless of the timeout.</li>
                                <li><b>process-semaphore:</b> Prevents two tabs from processing the same data at the same time.</li>
                                <li><b>timeout:</b> When the script is scheduled next to do a recheck.</li>
                                <li><b>user-settings:</b> All configurable settings.</li>
                            </ul>
                        </li>
                        <li>Type data: <code>TYPE</code> is a placeholder for all available event types.
                            <ul>
                                <li><b>TYPElist:</b> The list of all posts/topic IDs that are subscribed.</li>
                                <li><b>TYPElastid:</b> Bookmark for the ID of the last seen event. This is where the script starts searching when it does a recheck.</li>
                                <li><b>savedTYPElist:</b> Used to temporarily store found values for the event notice when events are found.</li>
                                <li><b>savedTYPElastid:</b> Used to temporarily store found values for the event notice when events are found.</li>
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

//Polling interval for checking program status
const TIMER_POLL_INTERVAL = 100;

const JQUERY_DELAY = 1; //For jQuery updates that should not be done synchronously

//The max number of items to grab with each network call
const QUERY_LIMIT = 100;

//Regexes
const DMAILS_REGEX = /\/dmails\/(\d+)/;
const WIKI_PAGES_REGEX = /\/wiki_pages\/(\d+)/;
const WIKI_PAGE_VERSIONS_REGEX = /\/wiki_page_versions\/(\d+)/;
const POOLS_REGEX = /\/pools\/(\d+)/;
const POOL_DESC_REGEX = /(Old|New) Desc: /;
const FORUM_TOPICS_REGEX = /\/forum_topics\/(\d+)/;

//Subscribe menu constants
const POST_DISPLAY_NAMES = {
    post: 'Edits',
    comment: 'Comments',
    note: 'Notes',
    commentary: 'Artist commentary'
};
const ALL_POST_EVENTS = ['post', 'comment', 'note', 'commentary'];
const ALL_TRANSLATE_EVENTS = ['note', 'commentary'];
const ALL_MAIL_EVENTS = ['dmail', 'spam'];

//Type configurations
const TYPEDICT = {
    flag: {
        controller: 'post_flags',
        addons: {},
        only: 'id,creator_id',
        useraddons: function (username) {return {search: {category: 'normal', post_tags_match: 'user:' + username}};},
        filter: (array)=>{return array.filter((val)=>{return IsShownData(val, [], 'creator_id', null);})},
        insert: InsertEvents
    },
    appeal: {
        controller: 'post_appeals',
        addons: {},
        only: 'id,creator_id',
        useraddons: function (username) {return {search: {post_tags_match: 'user:' + username}};},
        filter: (array)=>{return array.filter((val)=>{return IsShownData(val, [], 'creator_id', null);})},
        insert: InsertEvents
    },
    dmail: {
        controller: 'dmails',
        addons: {search: {is_spam: false}},
        only: 'id,from_id',
        useraddons: function (username) {return {};},
        filter: (array)=>{return array.filter((val)=>{return IsShownData(val, [], 'from_id', null, (val)=>{return !val.is_read});})},
        insert: InsertDmails
    },
    spam: {
        controller: 'dmails',
        addons: {search: {is_spam: true}},
        only: 'id,from_id',
        useraddons: function (username) {return {};},
        filter: (array)=>{return array.filter((val)=>{return IsShownData(val, [], 'from_id', null, (val)=>{return !val.is_read});})},
        insert: InsertDmails
    },
    comment: {
        controller: 'comments',
        addons: {group_by: 'comment'},
        only: 'id,creator_id,post_id',
        limit: 999,
        filter: (array, typelist)=>{return array.filter((val)=>{return IsShownData(val, typelist, 'creator_id', 'post_id');})},
        insert: InsertComments,
        process: function () {JSPLib.utility.setCSSStyle(COMMENT_CSS, 'comment');}
    },
    forum: {
        controller: 'forum_posts',
        addons: {},
        only: 'id,creator_id,topic_id',
        limit: 999,
        filter: (array,typelist)=>{return array.filter((val)=>{return IsShownData(val, typelist, 'creator_id', 'topic_id');})},
        insert: InsertForums,
        process: function () {JSPLib.utility.setCSSStyle(FORUM_CSS, 'forum');}
    },
    note: {
        controller: 'note_versions',
        addons: {},
        only: 'id,updater_id,post_id',
        limit: 999,
        filter: (array, typelist)=>{return array.filter((val)=>{return IsShownData(val, typelist, 'updater_id', 'post_id');})},
        insert: InsertNotes
    },
    commentary: {
        controller: 'artist_commentary_versions',
        addons: {},
        only: 'id,updater_id,post_id',
        limit: 999,
        filter: (array,typelist)=>{return array.filter((val)=>{return IsShownData(val, typelist, 'updater_id', 'post_id', IsShownCommentary);})},
        insert: InsertEvents
    },
    post: {
        controller: 'post_versions',
        addons: {},
        only: 'id,updater_id,post_id',
        limit: 199,
        filter: (array,typelist)=>{return array.filter((val)=>{return IsShownData(val, typelist, 'updater_id', 'post_id');})},
        insert: InsertPosts
    },
    wiki: {
        controller: 'wiki_page_versions',
        addons: {},
        only: 'id,updater_id,wiki_page_id',
        limit: 999,
        filter: (array,typelist)=>{return array.filter((val)=>{return IsShownData(val, typelist, 'updater_id', 'wiki_page_id');})},
        insert: InsertWikis,
        process: function () {JSPLib.utility.setCSSStyle(WIKI_CSS, 'wiki');}
    },
    pool: {
        controller: 'pool_versions',
        addons: {},
        only: 'id,updater_id,pool_id',
        limit: 199,
        filter: (array,typelist)=>{return array.filter((val)=>{return IsShownData(val, typelist, 'updater_id', 'pool_id');})},
        insert: InsertPools,
        process: function () {JSPLib.utility.setCSSStyle(POOL_CSS, 'pool');}
    }
};

//Validate constants

const TYPE_GROUPING = '(?:' + ALL_EVENTS.join('|') + ')';
const SUBSCRIBE_GROUPING = '(?:' + SUBSCRIBE_EVENTS.join('|') + ')';
const SETTING_GROUPING = '(el-user-settings)';
const BOOL_GROUPING = `(el-${SUBSCRIBE_GROUPING}overflow|el-events|el-overflow)`;
const TIME_GROUPING = `(el-last-seen|el-process-semaphore|el-timeout)`;
const ID_GROUPING = `(el-${TYPE_GROUPING}lastid)`;
const IDLIST_GROUPING = `(el-${TYPE_GROUPING}list|el-saved${SUBSCRIBE_GROUPING}lastid|el-saved${SUBSCRIBE_GROUPING}list)`;
const VALIDATE_REGEX = RegExp(`^(${SETTING_GROUPING}|${BOOL_GROUPING}|${TIME_GROUPING}|${ID_GROUPING}|${IDLIST_GROUPING})$`);

/****Functions****/

//Validate functions

function ValidateProgramData(key,entry) {
    var checkerror=[];
    var check = VALIDATE_REGEX.exec(key);
    switch (check && check[1]) {
        case check[2]:
            checkerror = JSPLib.menu.validateUserSettings(entry, SETTINGS_CONFIG);
            break;
        case check[3]:
            if (!JSPLib.validate.isBoolean(entry)) {
                checkerror = ["Value is not a boolean."];
            }
            break;
        case check[4]:
            if (!Number.isInteger(entry)) {
                checkerror = ["Value is not an integer."];
            } else if (entry < 0) {
                checkerror = ["Value is not greater than or equal to zero."];
            }
            break;
        case check[5]:
            if (!JSPLib.validate.validateID(entry)) {
                checkerror = ["Value is not a valid ID."];
            }
            break;
        case check[6]:
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
        error_messages.push(`Corrupted data on ${type} list!`);
        let oldlist = typelist[type];
        typelist[type] = (Array.isArray(typelist) ? typelist.filter((id)=>{return JSPLib.validate.validateID(id);}) : []);
        JSPLib.debug.debugExecute(()=>{
            let validation_error = (Array.isArray(oldlist) ? JSPLib.utility.setDifference(oldlist, typelist[type]) : typelist[type]);
            error_messages.push("Validation error:", validation_error);
        });
    }
    if (error_messages.length) {
        error_messages.forEach((error)=>{CorrectList.debuglog(error);});
        return true;
    }
    return false;
}

//Library functions

////None

//Helper functions

async function SetRecentDanbooruID(type,useritem=false) {
    let jsonitem = await JSPLib.danbooru.submitRequest(TYPEDICT[type].controller, JSPLib.utility.joinArgs(TYPEDICT[type].addons, {limit: 1}), []);
    if (jsonitem.length) {
        SaveLastID(type, JSPLib.danbooru.getNextPageID(jsonitem, true));
    } else if (useritem) {
        SaveLastID(type, 0);
    }
}

function IsEventEnabled(type) {
    return EL.user_settings.events_enabled.includes(type);
}

function IsAnyEventEnabled(event_list) {
    return Boolean(JSPLib.utility.setIntersection(event_list, EL.user_settings.events_enabled).length);
}

function AreAllEventsEnabled(event_list) {
    return !JSPLib.utility.setDifference(event_list, EL.user_settings.events_enabled).length;
}

function HideDmailNotice() {
    let $hide_link = $('#hide-dmail-notice');
    if ($hide_link.length) {
        setTimeout(()=>{$hide_link.click();}, JQUERY_DELAY);
    }
}

function GetInstanceID(type,func) {
    try {
        if (EL.controller === type) {
            return (EL.showid > 0 ? EL.showid : JSPLib.utility.throw(EL.showid));
        } else {
            return (func ? func() : JSPLib.utility.throw(0));
        }
    } catch (e) {
        //Bail if page is not as expected
        if (Number.isInteger(e)) {
            if (e === 0) {
                Danbooru.Utility.error("Warning: Wrong action for URL!");
            } else {
                Danbooru.Utility.error("Warning: URL is malformed!");
            }
        } else {
            Danbooru.Utility.error("Warning: Page missing required elements!");
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

function SaveLastID(type, lastid) {
    let key = `el-${type}lastid`;
    let previousid = JSPLib.storage.checkStorageData(key, ValidateProgramData, localStorage, 1);
    lastid = Math.max(previousid, lastid);
    JSPLib.storage.setStorageData(key, lastid, localStorage);
    SaveLastID.debuglog(`Set last ${type} ID:`, lastid);
}

function HasEvents() {
    return JSPLib.storage.checkStorageData('el-events', ValidateProgramData, localStorage, false);
}

function WasOverflow() {
    return JSPLib.storage.checkStorageData('el-overflow', ValidateProgramData, localStorage, false);
}

function SetLastSeenTime() {
    JSPLib.storage.setStorageData('el-last-seen', Date.now(), localStorage);
}

//Return true if there are no saved events at all, or saved events for the input type
function CheckWaiting(inputtype) {
    if (Object.keys(CheckWaiting.all_waits).length == 0) {
        let enabled_events = JSPLib.utility.setIntersection(SUBSCRIBE_EVENTS, EL.user_settings.events_enabled);
        enabled_events.forEach((type)=>{
            CheckWaiting.all_waits[type] = JSPLib.storage.checkStorageData(`el-saved${type}lastid`, ValidateProgramData, localStorage, []).length > 0;
            CheckWaiting.any_waits = CheckWaiting.any_waits || CheckWaiting.all_waits[type];
        });
    }
    if (!SUBSCRIBE_EVENTS.includes(inputtype)) {
        return false;
    }
    return !(Object.values(CheckWaiting.all_waits).reduce((total,entry)=>{return total || entry;}, false)) /*No waits*/ || CheckWaiting.all_waits[inputtype];
}
CheckWaiting.all_waits = {};

//Return true if there was no overflow at all, or overflow for the input type
function CheckOverflow(inputtype) {
    if (Object.keys(CheckOverflow.all_overflows).length == 0) {
        let enabled_events = JSPLib.utility.setIntersection(SUBSCRIBE_EVENTS, EL.user_settings.events_enabled);
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

function ProcessEvent(inputtype) {
    if (!JSPLib.menu.isSettingEnabled('EL', 'events_enabled', inputtype)) {
        return [];
    }
    if (SUBSCRIBE_EVENTS.includes(inputtype) && !CheckList(inputtype)) {
        return [];
    }
    //Waits always have priority over overflows
    JSPLib.debug.debugExecute(()=>{
        ProcessEvent.debuglog(inputtype,
                              (CheckWaiting(inputtype) && CheckWaiting.any_waits),
                              (CheckOverflow(inputtype) && !CheckWaiting.any_waits && CheckOverflow.any_overflow),
                              (!CheckWaiting.any_waits && !CheckOverflow.any_overflow));
    });
    if ((CheckWaiting(inputtype) && CheckWaiting.any_waits) || /*Check for any wait event*/
        (CheckOverflow(inputtype) && !CheckWaiting.any_waits && CheckOverflow.any_overflow) || /*Check for any overflow event but not a wait event*/
        (!CheckWaiting.any_waits && !CheckOverflow.any_overflow) /*Check for neither waits nor overflows*/) {
        if (USER_EVENTS.includes(inputtype)) {
            return TIMER.CheckUserType(inputtype);
        } else if (SUBSCRIBE_EVENTS.includes(inputtype)) {
            return TIMER.CheckSubscribeType(inputtype);
        }
    }
    return [];
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

async function AddForumPost(forumid,$rowelement) {
    let forum_topic = await JSPLib.network.getNotify(`/forum_posts/${forumid}`);
    if (!forum_topic) {
        return;
    }
    let $forum_topic = $.parseHTML(forum_topic);
    let $outerblock = $.parseHTML(`<tr id="full-forum-id-${forumid}"><td colspan="4"></td></tr>`);
    let $forum_post = $(`#forum_post_${forumid}`, $forum_topic)
    $('td', $outerblock).append($forum_post);
    $($rowelement).after($outerblock);
    if (EL.user_settings.mark_read_topics) {
        let topic_link = $('td:first-of-type > a', $rowelement);
        let topic_path = topic_link.length && topic_link[0].pathname;
        let topic_match = topic_path && topic_path.match(FORUM_TOPICS_REGEX);
        if (topic_match && !EL.marked_topic.includes(topic_match[1])) {
            ReadForumTopic(topic_match[1]);
            EL.marked_topic.push(topic_match[1]);
        }
    }
}

function AddRenderedNote(noteid,$rowelement) {
    let notehtml = $.parseHTML($.trim($('.el-note-body', $rowelement)[0].innerHTML))[0].data;
    let $outerblock = $.parseHTML(`<tr id="full-note-id-${noteid}"><td colspan="7">${notehtml}</td></tr>`);
    $($rowelement).after($outerblock);
}

async function AddDmail(dmailid,$rowelement) {
    let dmail = await JSPLib.network.getNotify(`/dmails/${dmailid}`);
    if (!dmail) {
        return;
    }
    let $dmail = $.parseHTML(dmail);
    $('.dmail h1:first-of-type', $dmail).hide();
    let $outerblock = $.parseHTML(`<tr id="full-dmail-id-${dmailid}"><td colspan="4"></td></tr>`);
    $('td', $outerblock).append($('.dmail', $dmail));
    $($rowelement).after($outerblock);
}

async function AddWiki(wikiverid,$rowelement) {
    let wikiid = $rowelement.innerHTML.match(WIKI_PAGES_REGEX)[1];
    let url_addons = {search: {wiki_page_id: wikiid}, page: `b${wikiverid}`, only: 'id', limit: 1};
    let prev_wiki = await JSPLib.danbooru.submitRequest('wiki_page_versions', url_addons);
    if (prev_wiki.length) {
        let wiki_diff = await JSPLib.network.getNotify('/wiki_page_versions/diff', {otherpage: wikiverid, thispage: prev_wiki[0].id});
        if (!wiki_diff) {
            return;
        }
        let $wiki_diff = $.parseHTML(wiki_diff);
        let $outerblock = $.parseHTML(`<tr id=full-wiki-id-${wikiverid}><td colspan="4"></td></tr>`);
        $('td', $outerblock).append($('#a-diff p', $wiki_diff));
        $('td', $outerblock).append($('#a-diff div', $wiki_diff).html().replace(/<br>/g, PARAGRAPH_MARK));
        $($rowelement).after($outerblock);
    } else {
        Danbooru.Utility.notice("Wiki creations have no diff!");
    }
}

async function AddPoolDiff(poolverid,$rowelement) {
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
    let $outerblock = $.parseHTML(`<tr id=full-pooldiff-id-${poolverid}><td class="el-pool-diff" colspan="6">${diff_desc}</td></tr>`);
    $($rowelement).after($outerblock);
}

async function AddPoolPosts(poolverid,$rowelement) {
    console.log(poolverid);
    let $post_changes = $('td:nth-of-type(2)', $rowelement);
    let add_posts = $post_changes.data('add-posts');
    let rem_posts = $post_changes.data('rem-posts');
    let total_posts = JSPLib.utility.setUnion(add_posts, rem_posts);
    let thumbnails = await JSPLib.network.getNotify(`/posts`, {tags: 'id:' + total_posts.join(',') + ' status:any'});
    let $thumbnails = $.parseHTML(thumbnails);
    $('.post-preview', $thumbnails).each((i,entry)=>{$(entry).addClass('blacklisted');}); //Mark thumbnails as blacklist processed
    let $outerblock = $.parseHTML(`<tr id=full-poolposts-id-${poolverid}><td class="el-pool-posts" colspan="6"><div class="el-add-pool-posts" style="display:none"></div><div class="el-rem-pool-posts" style="display:none"></div></td></tr>`);
    if (add_posts.length) {
        let $container = $('.el-add-pool-posts', $outerblock).show();
        add_posts.forEach((post_id)=>{
            let $thumb = $(`#post_${post_id}`, $thumbnails);
            $container.append($thumb);
        });
    }
    if (rem_posts.length) {
        let $container = $('.el-rem-pool-posts', $outerblock).show();
        rem_posts.forEach((post_id)=>{
            let $thumb = $(`#post_${post_id}`, $thumbnails);
            $container.append($thumb);
        });
    }
    $($rowelement).after($outerblock);
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
    JSPLib.utility.fullHide(`.${hide}-${type}[data-id="${itemid}"]`);
    JSPLib.utility.clearHide(`.${show}-${type}[data-id="${itemid}"]`);
}

function ToggleSubscribeLinks() {
    SUBSCRIBE_EVENTS.forEach((type)=>{
        if (IsEventEnabled(type)) {
            $(`.el-subscribe-${type}-container`).show();
        } else {
            $(`.el-subscribe-${type}-container`).hide();
        }
    });
    if ($('#c-posts #a-show').length) {
        if (AreAllEventsEnabled(ALL_TRANSLATE_EVENTS)) {
            $('.el-subscribe-translated-container').show();
        } else {
            $('.el-subscribe-translated-container').hide();
        }
        if (IsAnyEventEnabled(ALL_POST_EVENTS)) {
            $('#el-subscribe-events').show();
            let enabled_post_events = JSPLib.utility.setIntersection(ALL_POST_EVENTS, EL.user_settings.events_enabled);
            $('#el-all-link').attr('data-type', enabled_post_events);
        } else {
            $('#el-subscribe-events').hide();
        }
    }
}

//Insert and process HTML onto page for various types

function InsertEvents($eventpage,type) {
    $(`#${type}-table`).append($('.striped', $eventpage));
    $(`#${type}-table .post-preview`).addClass('blacklisted');
}

function InsertDmails($dmailpage,type) {
    DecodeProtectedEmail($dmailpage);
    $('tr.read-false', $dmailpage).css('font-weight', 'bold');
    $(`#${type}-table`).append($('.striped', $dmailpage));
    let $dmails_table = $(`#${type}-table`);
    InitializeOpenDmailLinks($dmails_table);
}

function InsertComments($commentpage) {
    DecodeProtectedEmail($commentpage);
    $('.post-preview', $commentpage).addClass('blacklisted');
    $('.edit_comment', $commentpage).hide();
    $('#comment-table').append($('.list-of-comments', $commentpage));
    InitializeCommentPartialCommentLinks('#event-notice #comment-section .post-preview');
}

function InsertForums($forumpage) {
    DecodeProtectedEmail($forumpage);
    let $forums_table = $('#forum-table');
    $forums_table.append($('.striped', $forumpage));
    InitializeTopicIndexLinks($forums_table);
    InitializeOpenForumLinks($forums_table);
}

function InsertNotes($notepage) {
    DecodeProtectedEmail($notepage);
    let $notes_table = $('#note-table');
    $notes_table.append($('.striped', $notepage));
    $('th:first-of-type, td:first-of-type', $notes_table).remove();
    $('td:nth-of-type(1)', $notes_table).addClass('el-post-id');
    $('td:nth-of-type(2)', $notes_table).addClass('el-note-id');
    $('td:nth-of-type(3)', $notes_table).addClass('el-note-body');
    AddThumbnails($notes_table);
    InitializePostNoteIndexLinks('note', $notes_table);
    InitializeOpenNoteLinks($notes_table);
}

function InsertPosts($postpage) {
    let $posts_table = $('#post-table');
    $posts_table.append($('.striped', $postpage));
    $('.striped th:first-of-type, .striped td:first-of-type', $posts_table).remove();
    $('.striped tr[id]', $posts_table).each((i,row)=>{
        let post_link = $('td:first-of-type a', row).attr('href');
        if (!post_link) {
            return;
        }
        let match = post_link.match(/\/posts\/(\d+)/);
        if (!match) {
            return;
        }
        $('td:first-of-type', row).html(`<a href="${post_link}">post #${match[1]}</a>`);
    });
    AddThumbnails($posts_table);
    InitializePostNoteIndexLinks('post', $posts_table);
}

function InsertWikis($wikipage) {
    DecodeProtectedEmail($wikipage);
    let $wikis_table = $('#wiki-table');
    $wikis_table.append($('.striped', $wikipage));
    InitializeWikiIndexLinks($wikis_table);
    InitializeOpenWikiLinks($wikis_table);
}

function InsertPools($poolpage) {
    DecodeProtectedEmail($poolpage);
    let $pools_table = $('#pool-table');
    $pools_table.append($('.striped', $poolpage));
    $('.pool-category-collection, .pool-category-series', $pools_table).each((i,entry)=>{
        let short_pool_title = JSPLib.utility.maxLengthString(entry.innerText, 50);
        $(entry).attr('title', entry.innerText);
        entry.innerText = short_pool_title;
    });
    InitializePoolIndexLinks($pools_table);
    InitializeOpenPoolLinks($pools_table);
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

function AddThumbnails($dompage) {
    $('.striped thead tr', $dompage).prepend('<th>Thumb</th>');
    var row_save = {};
    var post_ids = [];
    $('.striped tr[id]', $dompage).each((i,row)=>{
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
    var $body = $('.striped tbody', $dompage);
    post_ids.forEach((postid)=>{
        row_save[postid][0].prepend(`<td rowspan="${row_save[postid].length}" class="el-post-thumbnail" data-postid="${postid}"></td>`);
        row_save[postid].forEach((row)=>{
            $body.append(row);
        });
    });
    EL.post_ids = JSPLib.utility.setUnion(EL.post_ids, post_ids);
}

async function GetThumbnails() {
    var url_addon = {tags: `id:${EL.post_ids.join(',')} limit:${EL.post_ids.length}`};
    var html = await $.get('/posts', url_addon);
    var $posts = $.parseHTML(html);
    var $thumbs = $('.post-preview', $posts);
    $thumbs.each((i,thumb)=>{
        let $thumb = $(thumb);
        $thumb.addClass('blacklisted');
        let postid = $thumb.data('id');
        $(`.striped .el-post-thumbnail[data-postid="${postid}"]`).prepend(thumb);
    });
}

function AdjustRowspan(rowelement,openitem) {
    let postid = $('.el-post-id a:first-of-type', rowelement).html();
    let $thumb_cont = $(`#note-table .el-post-thumbnail[data-postid="${postid}"]`);
    let current_rowspan = $thumb_cont.attr('rowspan');
    let new_rowspan = parseInt(current_rowspan) + (openitem ? 1 : -1);
    $thumb_cont.attr('rowspan', new_rowspan);
}

async function GetPostsCountdown(limit,searchstring,domname) {
    let tag_addon = {tags: searchstring};
    let limit_addon = {limit: limit};
    let page_addon = {};
    var return_items = [];
    let page_num = 0;
    if (domname) {
        let total_posts = (await JSPLib.danbooru.submitRequest('counts/posts', tag_addon, {counts: {posts: 0}})).counts.posts;
        page_num = Math.ceil(total_posts/limit);
    }
    while (true) {
        if (domname) {
            GetPostsCountdown.debuglog("Pages left #", page_num);
            domname && jQuery(domname).html(page_num);
        }
        let request_addons = JSPLib.utility.joinArgs(tag_addon, limit_addon, page_addon);
        let request_key = 'posts-' + jQuery.param(request_addons);
        let temp_items = await JSPLib.danbooru.submitRequest('posts', request_addons, [], request_key);
        return_items = return_items.concat(temp_items);
        if (temp_items.length < limit) {
            return return_items;
        }
        let lastid = JSPLib.danbooru.getNextPageID(temp_items, false);
        page_addon = {page: `b${lastid}`};
        page_num -= 1;
    }
}

//Render functions

function RenderMultilinkMenu(itemid,all_types=[]) {
    let shown = (all_types.length === 0 || IsAnyEventEnabled(all_types) ? "" : 'style="display:none"');
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
<${tag} class="el-subscribe-dual-links">
    <${tag} data-id="${itemid}" class="subscribe-${type}" ${subscribe}><a class="el-monospace-link" href="#">${spacer}Subscribe${separator}${ender}</a></${tag}>
    <${tag} data-id="${itemid}" class="unsubscribe-${type}" ${unsubscribe}"><a class="el-monospace-link" href="#">Unsubscribe${separator}${ender}</a></${tag}>
</${tag}>
`;
}

function RenderSubscribeMultiLinks(name,typelist,itemid) {
    let itemdict = {};
    typelist.forEach((type)=>{
        itemdict[type] = GetList(type);
    });
    let classname = (typelist.reduce((total,type)=>{return total && itemdict[type].includes(itemid);}, true) ? 'el-subscribed' : 'el-unsubscribed');
    let idname = 'el-' + name.toLowerCase().replace(/[ _]/g, '-') + '-link';
    return `<li id="${idname}" data-type="${typelist}" class="${classname}"><a href="#">${name}</a></li>`;
}

function RenderOpenItemLinks(type,itemid,showtext="Show",hidetext="Hide") {
    return `<span data-id="${itemid}" class="show-full-${type}" style><a class="el-monospace-link" href="#">${showtext}</a></span>` +
           `<span data-id="${itemid}" class="hide-full-${type}" style="display:none !important"><a class="el-monospace-link" href="#">${hidetext}</a></span>`;
}

//Initialize functions

function InitializeNoticeBox() {
    $('#page').prepend(NOTICE_BOX);
    if (EL.locked_notice) {
        $('#lock-event-notice').addClass('el-locked');
    } else {
        $('#lock-event-notice').one('click.el', LockEventNotice);
    }
    $('#hide-event-notice').one('click.el', HideEventNotice);
    $('#read-event-notice').one('click.el', ReadEventNotice);
}

function InitializeOpenForumLinks($obj) {
    $('.striped tbody tr', $obj).each((i,$row)=>{
        let forumid = $row.id.match(/(\d+)$/)[1];
        $('.forum-post-excerpt', $row).prepend(RenderOpenItemLinks('forum', forumid) + '&nbsp;|&nbsp;');
    });
    OpenItemClick('forum', $obj, 3, AddForumPost);
}

function InitializeOpenNoteLinks($obj) {
    $('.striped tr[id]', $obj).each((i,$row)=>{
        let noteid = $('.el-note-id a', $row)[0].innerHTML.replace('.', '-');
        $('.el-note-body', $row).append('<p style="text-align:center">' + RenderOpenItemLinks('note', noteid, "Render note", "Hide note") + '</p>');
    });
    OpenItemClick('note', $obj, 4, AddRenderedNote, AdjustRowspan);
}

function InitializeOpenDmailLinks($obj) {
    $('.striped tbody tr', $obj).each((i,$row)=>{
        let dmailid = $row.innerHTML.match(DMAILS_REGEX)[1];
        $('td:nth-of-type(4)', $row).prepend(RenderOpenItemLinks('dmail', dmailid) + '&nbsp;|&nbsp;');
    });
    OpenItemClick('dmail', $obj, 3, AddDmail);
}

function InitializeOpenWikiLinks($obj) {
    $('.striped tbody tr', $obj).each((i,$row)=>{
        let wikiverid = parseInt($row.innerHTML.match(WIKI_PAGE_VERSIONS_REGEX)[1]);
        $('.category-0, .category-1, .category-3, .category-4, .category-5', $row).append('<span style="float:right">(' + RenderOpenItemLinks('wiki', wikiverid, 'Show diff', 'Hide diff') + ')</span>');
    });
    OpenItemClick('wiki', $obj, 4, AddWiki);
}

function InitializeOpenPoolLinks($obj) {
    $('.striped tbody tr', $obj).each((i,$row)=>{
        let poolverid = parseInt($row.id.match(/\d+$/)[0]);
        let $post_changes = $('td:nth-of-type(2)', $row);
        let add_posts = $('.diff-list:first-of-type a[href^="/posts"]', $post_changes[0]).map((i,entry)=>{return entry.innerText;}).toArray();
        let rem_posts = $('.diff-list:last-of-type a[href^="/posts"]', $post_changes[0]).map((i,entry)=>{return entry.innerText;}).toArray();
        if (add_posts.length || rem_posts.length) {
            $post_changes.prepend(RenderOpenItemLinks('poolposts', poolverid, 'Show posts', 'Hide posts') + '&nbsp|&nbsp');
            $post_changes.data('add-posts', add_posts);
            $post_changes.data('rem-posts', rem_posts);
        }
        let $desc_changed = $('td:nth-of-type(4)', $row);
        if ($desc_changed.html() !== 'false') {
            $desc_changed.append(' (' + RenderOpenItemLinks('pooldiff', poolverid, 'Show diff', 'Hide diff') + ')');
        }
    });
    OpenItemClick('pooldiff', $obj, 3, AddPoolDiff);
    OpenItemClick('poolposts', $obj, 3, AddPoolPosts);
}

//#C-POSTS #A-SHOW
function InitializePostShowMenu() {
    var postid = parseInt(JSPLib.utility.getMeta('post-id'));
    let menu_obj = $.parseHTML(RenderMultilinkMenu(postid, ALL_POST_EVENTS));
    ALL_POST_EVENTS.forEach((type)=>{
        let linkhtml = RenderSubscribeMultiLinks(POST_DISPLAY_NAMES[type], [type], postid);
        let shownhtml = (IsEventEnabled(type) ? "" : 'style="display:none"');
        $('#el-add-links', menu_obj).append(`<span class="el-subscribe-${type}-container" ${shownhtml}>${linkhtml} | </span>`);
    });
    let shownhtml = (AreAllEventsEnabled(ALL_TRANSLATE_EVENTS) ? "" : 'style="display:none"');
    let linkhtml = RenderSubscribeMultiLinks("Translations", ALL_TRANSLATE_EVENTS, postid);
    $('#el-add-links', menu_obj).append(`<span class="el-subscribe-translated-container" ${shownhtml}>${linkhtml} | </span>`);
    //The All link is always shown when the outer menu is shown, so no need to individually hide it
    let enabled_post_events = JSPLib.utility.setIntersection(ALL_POST_EVENTS, EL.user_settings.events_enabled);
    linkhtml = RenderSubscribeMultiLinks("All", enabled_post_events, postid);
    $('#el-add-links', menu_obj).append(`<span class="el-subscribe-all-container">${linkhtml}</span>`);
    $('nav#nav').append(menu_obj);
    $('#el-subscribe-events a').on('click.el', SubscribeMultiLink);
}

//#C-FORUM-TOPICS #A-SHOW
function InitializeTopicShowMenu() {
    let topicid = GetInstanceID('forum-topics', ()=>{
        return parseInt($('#subnav-subscribe-link, #subnav-unsubscribe-link').attr('href').match(FORUM_TOPICS_REGEX)[1]);
    });
    if (!topicid) {
        return;
    }
    let menu_obj = $.parseHTML(RenderMultilinkMenu(topicid, ['forum']));
    let linkhtml = RenderSubscribeMultiLinks("Topic", ['forum'], topicid, "");
    let shownhtml = (IsEventEnabled('forum') ? "" : 'style="display:none"');
    $('#el-add-links', menu_obj).append(`<span class="el-subscribe-forum-container "${shownhtml}>${linkhtml} | </span>`);
    let $email = $('#subnav-subscribe, #subnav-unsubscribe').detach().find('a').text("Email");
    $('#el-add-links', menu_obj).append($email);
    $('nav#nav').append(menu_obj);
    $('#el-subscribe-events a').on('click.el', SubscribeMultiLink);
}

//#C-FORUM-TOPICS #A-INDEX
function InitializeTopicIndexLinks($obj) {
    $('.striped tr td:first-of-type', $obj).each((i,entry)=>{
        let topicid = parseInt(entry.innerHTML.match(FORUM_TOPICS_REGEX)[1]);
        let linkhtml = RenderSubscribeDualLinks('forum', topicid, 'span', "", "", true);
        let shownhtml = (IsEventEnabled('forum') ? "" : 'style="display:none"');
        $(entry).prepend(`<span class="el-subscribe-forum-container "${shownhtml}>${linkhtml}&nbsp|&nbsp</span>`);
        $('.subscribe-forum a, .unsubscribe-forum a', entry).on('click.el', SubscribeDualLink);
    });
}

//#C-WIKI-PAGES #A-SHOW
function InitializeWikiShowMenu() {
    let wikiid = GetInstanceID('wiki-pages', ()=>{
        return parseInt($('#subnav-newest-link').attr('href').match(WIKI_PAGES_REGEX)[1]);
    });
    if (!wikiid) {
        return;
    }
    let menu_obj = $.parseHTML(RenderMultilinkMenu(wikiid, ['wiki']));
    let linkhtml = RenderSubscribeMultiLinks("Wiki", ['wiki'], wikiid, "");
    let shownhtml = (IsEventEnabled('wiki') ? "" : 'style="display:none"');
    $('#el-add-links', menu_obj).append(`<span class="el-subscribe-wiki-container "${shownhtml}>${linkhtml}</span>`);
    $('nav#nav').append(menu_obj);
    $('#el-subscribe-events a').on('click.el', SubscribeMultiLink);
}

//#C-WIKI-PAGES #A-INDEX
function InitializeWikiIndexLinks($obj) {
    $(`.striped tbody tr`, $obj).each((i,row)=>{
        let wikiid = parseInt(row.innerHTML.match(WIKI_PAGES_REGEX)[1]);
        let linkhtml = RenderSubscribeDualLinks('wiki', wikiid, 'span', "", "", true);
        let shownhtml = (IsEventEnabled('wiki') ? "" : 'style="display:none"');
        $('td.category-0, td.category-1, td.category-3, td.category-4, td.category-5', row).prepend(`<span class="el-subscribe-wiki-container "${shownhtml}>${linkhtml}&nbsp|&nbsp</span>`);
        $('.subscribe-wiki a, .unsubscribe-wiki a', row).on('click.el', SubscribeDualLink);
    });
}

//#C-POOLS #A-SHOW
function InitializePoolShowMenu() {
    let poolid = GetInstanceID('pools');
    if (!poolid) {
        return;
    }
    let menu_obj = $.parseHTML(RenderMultilinkMenu(poolid, ['pool']));
    let linkhtml = RenderSubscribeMultiLinks("Pool", ['pool'], poolid, "");
    let shownhtml = (IsEventEnabled('pool') ? "" : 'style="display:none"');
    $('#el-add-links', menu_obj).append(`<span class="el-subscribe-pool-container "${shownhtml}>${linkhtml}</span>`);
    $('nav#nav').append(menu_obj);
    $('#el-subscribe-events a').on('click.el', SubscribeMultiLink);
}

//#C-POOLS #A-INDEX
function InitializePoolIndexLinks($obj) {
    $(`.striped tbody tr`, $obj).each((i,row)=>{
        let poolid = parseInt(row.innerHTML.match(POOLS_REGEX)[1]);
        let linkhtml = RenderSubscribeDualLinks('pool', poolid, 'span', "", "", true);
        let shownhtml = (IsEventEnabled('pool') ? "" : 'style="display:none"');
        $('td:first-of-type', row).prepend(`<span class="el-subscribe-pool-container "${shownhtml}>${linkhtml}&nbsp|&nbsp</span>`);
        $('.subscribe-pool a, .unsubscribe-pool a', row).on('click.el', SubscribeDualLink);
    });
}

//#C-POOLS #A-GALLERY
function InitializePoolGalleryLinks() {
    $(`.post-preview > a`).each((i,entry)=>{
        let poolid = parseInt(entry.href.match(/\/pools\/(\d+)/)[1]);
        let linkhtml = RenderSubscribeDualLinks('pool', poolid, 'div', " ", 'pool');
        let shownhtml = (IsEventEnabled('pool') ? "" : 'style="display:none"');
        $(entry).before(`<div class="el-subscribe-pool-container "${shownhtml}>${linkhtml}</div>`);
        $('.subscribe-pool a, .unsubscribe-pool a', entry.parentElement).on('click.el', SubscribeDualLink);
    });
}
//EVENT NOTICE

function InitializePostNoteIndexLinks(type,$obj) {
    $('.striped tr[id]', $obj).each((i,row)=>{
        if ($('.el-post-thumbnail', row).length === 0) {
            return;
        }
        let postid = $('.el-post-thumbnail', row).data('postid');
        let linkhtml = RenderSubscribeDualLinks(type, postid, 'span', "", "", true);
        $('td:first-of-type', row).prepend(`<div style="text-align:center">${linkhtml}</div>`);
        $(`.subscribe-${type} a, .unsubscribe-${type} a`, row).on('click.el', SubscribeDualLink);
    });
}

//#C-COMMENTS #P-INDEX-BY-POST
function InitializeCommentPartialPostLinks() {
    $('#p-index-by-post .comments-for-post').each((i,entry)=>{
        let postid = parseInt($(entry).data('post-id'));
        let linkhtml = RenderSubscribeDualLinks('comment', postid, 'div', " ", 'comments');
        let shownhtml = (IsEventEnabled('comment') ? "" : 'style="display:none"');
        $('.header', entry).after(`<div class="el-subscribe-comment-container "${shownhtml}>${linkhtml}</div>`);
        $('.subscribe-comment a, .unsubscribe-comment a', entry).on('click.el', SubscribeDualLink);
    });
}

//#C-COMMENTS #P-INDEX-BY-COMMENT
function InitializeCommentPartialCommentLinks(selector) {
    $(selector).each((i,entry)=>{
        var postid = parseInt($(entry).data('id'));
        var linkhtml = RenderSubscribeDualLinks('comment', postid, 'div', " ", 'comments');
        let shownhtml = (IsEventEnabled('comment') ? "" : 'style="display:none"');
        let $subscribe = $.parseHTML(`<div class="el-subscribe-comment-container "${shownhtml}>${linkhtml}</div>`);
        $('.preview', entry).append($subscribe);
        $('.subscribe-comment a, .unsubscribe-comment a', entry).off('click.el').on('click.el', SubscribeDualLink);
    });
}

//Event handlers

function HideEventNotice(event) {
    $('#event-notice').hide();
    MarkAllAsRead();
    EL.channel.postMessage({type: 'hide'});
    event.preventDefault();
}

function LockEventNotice(event) {
    $(event.target).addClass('el-locked');
    EL.locked_notice = true;
}

function ReadEventNotice(event) {
    $(event.target).addClass('el-read');
    MarkAllAsRead();
}

function UpdateAll(event) {
    if (!UpdateAll.run_once && !ResetAll.run_once) {
        JSPLib.network.counter_domname = '#el-activity-indicator';
        EL.no_limit = true;
        ProcessAllEvents(()=>{
            JSPLib.concurrency.setRecheckTimeout('el-timeout', EL.timeout_expires);
            Danbooru.Utility.notice("All events checked!");
        });
    }
    UpdateAll.run_once = true;
    event.preventDefault();
}
UpdateAll.run_once = false;

function ResetAll(event) {
    if (!UpdateAll.run_once && !ResetAll.run_once) {
        LASTID_KEYS.forEach((key)=>{
            localStorage.removeItem(key);
        });
        ProcessAllEvents(()=>{
            JSPLib.concurrency.setRecheckTimeout('el-timeout', EL.timeout_expires);
            Danbooru.Utility.notice("All event positions reset!");
        });
    }
    ResetAll.run_once = true;
    event.preventDefault();
}
ResetAll.run_once = false;

function SubscribeMultiLink(event) {
    let $menu = $(JSPLib.utility.getNthParent(event.target, 4));
    let $container = $(event.target.parentElement);
    let itemid = $menu.data('id');
    let typelist = $container.data('type').split(',');
    let subscribed = ($container.hasClass('el-subscribed') ? true : false);
    let prefix = (subscribed ? '-' : "");
    typelist.forEach((type)=>{
        setTimeout(()=>{TIMER.SetList(type, prefix + itemid);}, 1);
        UpdateDualLink(type, subscribed, itemid);
    });
    UpdateMultiLink(typelist, subscribed, itemid);
    event.preventDefault();
}

function SubscribeDualLink(event) {
    let classname = event.target.parentElement.className
    let type = classname.match(RegExp(`(?:un)?subscribe-(${ALL_EVENTS.join('|')})`))[1];
    let itemid = $(event.target.parentElement).data('id');
    let subscribed = GetList(type).includes(itemid);
    let prefix = (subscribed ? '-' : "");
    setTimeout(()=>{TIMER.SetList(type, prefix + itemid);}, 1);
    UpdateDualLink(type, subscribed, itemid);
    UpdateMultiLink([type], subscribed, itemid);
    event.preventDefault();
}

async function PostEventPopulateControl(event) {
    let post_events = JSPLib.menu.getCheckboxRadioSelected(`[data-setting="post_events"] [data-selector]`);
    let operation = JSPLib.menu.getCheckboxRadioSelected(`[data-setting="operation"] [data-selector]`);
    let search_query = $('#el-setting-search-query').val();
    if (post_events.length === 0 || operation.length === 0) {
        Danbooru.Utility.notice("Must select at least one post event type!");
    } else if (search_query === "") {
        Danbooru.Utility.notice("Must have at least one search term!");
    } else {
        $('#el-search-query-display').show();
        let posts = await GetPostsCountdown(100, search_query, '#el-search-query-counter');
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
                    post_changes = post_changes.concat(new_subscribed);
                    typelist = JSPLib.utility.setUnion(typelist, postids);
                    break;
                case 'subtract':
                    new_subscribed = [];
                    was_subscribed = JSPLib.utility.setIntersection(postids, typelist);
                    post_changes = post_changes.concat(was_subscribed)
                    typelist = JSPLib.utility.setDifference(typelist, postids);
                    break;
                case 'overwrite':
                    was_subscribed = JSPLib.utility.setDifference(typelist, postids);
                    new_subscribed = JSPLib.utility.setDifference(postids, typelist);
                    post_changes = post_changes.concat(postids);
                    typelist = postids;
            }
            EL.subscribelist[eventtype] = typelist;
            setTimeout(()=>{JSPLib.storage.setStorageData(`el-${eventtype}list`, EL.subscribelist[eventtype], localStorage);}, 1);
            EL.channel.postMessage({type: 'reload', eventtype: eventtype, was_subscribed: was_subscribed, new_subscribed: new_subscribed, eventlist: EL.subscribelist[eventtype]});
        });
        $('#el-search-query-counter').html(0);
        post_changes = JSPLib.utility.setUnique(post_changes);
        Danbooru.Utility.notice(`Subscriptions were changed by ${post_changes.length} posts!`);
    }
}

//Event setup functions

function OpenItemClick(type,$obj,parentlevel,htmlfunc,otherfunc=(()=>{})) {
    $(`.show-full-${type} a, .hide-full-${type} a`).on('click.el', (e)=>{
        EL.openlist[type] = EL.openlist[type] || [];
        let $container = $(e.target.parentElement);
        let itemid = $container.data('id');
        let openitem = $container.hasClass(`show-full-${type}`);
        let rowelement = JSPLib.utility.getNthParent(e.target, parentlevel);
        if (openitem && !EL.openlist[type].includes(itemid)) {
            htmlfunc(itemid, rowelement);
            EL.openlist[type].push(itemid);
        }
        let hide = (openitem ? 'show' : 'hide');
        let show = (openitem ? 'hide' : 'show');
        JSPLib.utility.fullHide(`.${hide}-full-${type}[data-id="${itemid}"]`);
        JSPLib.utility.clearHide(`.${show}-full-${type}[data-id="${itemid}"]`);
        if (openitem) {
            $(`#full-${type}-id-${itemid}`).show();
        } else {
            $(`#full-${type}-id-${itemid}`).hide();
        }
        otherfunc(rowelement, openitem);
        e.preventDefault();
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
            $('#el-setting-search-query').attr('data-autocomplete', 'tag-query');
            setTimeout(Danbooru.Autocomplete.initialize_tag_autocomplete, JQUERY_DELAY);
        }
    }, TIMER_POLL_INTERVAL);
}

//Main execution functions

async function CheckUserType(type) {
    let lastidkey = `el-${type}lastid`;
    let typelastid = JSPLib.storage.checkStorageData(lastidkey, ValidateProgramData, localStorage, 0);
    if (typelastid) {
        let url_addons = JSPLib.utility.joinArgs(TYPEDICT[type].addons, TYPEDICT[type].useraddons(EL.username), {only: TYPEDICT[type].only});
        let jsontype = await JSPLib.danbooru.getAllItems(TYPEDICT[type].controller, QUERY_LIMIT, {addons: url_addons, page: typelastid, reverse: true});
        let filtertype = TYPEDICT[type].filter(jsontype);
        let lastusertype = (jsontype.length ? [JSPLib.danbooru.getNextPageID(jsontype, true)] : []);
        if (filtertype.length) {
            EL.lastids.user[type] = lastusertype[0];
            CheckUserType.debuglog(`Found ${type}(s)!`, EL.lastids.user[type]);
            let idlist = JSPLib.utility.getObjectAttributes(filtertype, 'id');
            url_addons = JSPLib.utility.joinArgs(TYPEDICT[type].addons, {search: {id: idlist.join(',')}, limit: idlist.length});
            let typehtml = await $.get(`/${TYPEDICT[type].controller}`, url_addons);
            let $typepage = $(typehtml);
            TYPEDICT[type].insert($typepage, type);
            if (TYPEDICT[type].process) {
                TYPEDICT[type].process();
            }
            $(`#${type}-section`).show();
            $('#event-notice').show();
            return true;
        } else {
            CheckUserType.debuglog(`No ${type}(s)!`);
            if (lastusertype.length && (typelastid !== lastusertype[0])) {
                SaveLastID(type, lastusertype[0]);
            }
        }
    } else {
        TIMER.SetRecentDanbooruID(type, true);
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
        var subscribetypelist = [], jsontypelist = [];
        let savedlastid = JSPLib.storage.checkStorageData(savedlastidkey, ValidateProgramData, localStorage, []);
        let savedlist = JSPLib.storage.checkStorageData(savedlistkey, ValidateProgramData, localStorage, []);
        if (!savedlastid.length || !savedlist.length) {
            let urladdons = JSPLib.utility.joinArgs(TYPEDICT[type].addons, {only: TYPEDICT[type].only});
            if (!EL.no_limit) {
                urladdons = JSPLib.utility.joinArgs(urladdons, {search: {id: `${typelastid}..${typelastid+TYPEDICT[type].limit}`}});
            }
            let jsontype = await JSPLib.danbooru.getAllItems(TYPEDICT[type].controller, QUERY_LIMIT, {page: typelastid, addons: urladdons, reverse: true});
            if (jsontype.length === TYPEDICT[type].limit) {
                CheckSubscribeType.debuglog(`${TYPEDICT[type].limit} ${type} items; overflow detected!`);
                JSPLib.storage.setStorageData(overflowkey, true, localStorage);
                EL.item_overflow = true;
            } else {
                JSPLib.storage.setStorageData(overflowkey, false, localStorage);
            }
            let subscribetype = TYPEDICT[type].filter(jsontype, typelist);
            if (jsontype.length) {
                jsontypelist = [JSPLib.danbooru.getNextPageID(jsontype, true)];
            }
            if (subscribetype.length) {
                subscribetypelist = JSPLib.utility.getObjectAttributes(subscribetype, 'id');
                JSPLib.storage.setStorageData(savedlistkey, subscribetypelist, localStorage);
                JSPLib.storage.setStorageData(savedlastidkey, jsontypelist, localStorage);
            } else {
                JSPLib.storage.setStorageData(savedlistkey, [], localStorage);
                JSPLib.storage.setStorageData(savedlastidkey, [], localStorage);
            }
        } else {
            jsontypelist = savedlastid;
            subscribetypelist = savedlist;
        }
        if (subscribetypelist.length) {
            EL.lastids.subscribe[type] = jsontypelist[0];
            CheckSubscribeType.debuglog(`Found ${type}(s)!`, EL.lastids.subscribe[type]);
            let url_addons = JSPLib.utility.joinArgs(TYPEDICT[type].addons, {search: {id: subscribetypelist.join(',')}, limit: subscribetypelist.length});
            let typehtml = await $.get(`/${TYPEDICT[type].controller}`, url_addons);
            let $typepage = $(typehtml);
            TYPEDICT[type].insert($typepage, type);
            if (TYPEDICT[type].process) {
                TYPEDICT[type].process();
            }
            $(`#${type}-section`).show();
            $('#event-notice').show();
            return true;
        } else {
            CheckSubscribeType.debuglog(`No ${type}(s)!`);
            if (jsontypelist.length && (typelastid !== jsontypelist[0])) {
                SaveLastID(type, jsontypelist[0]);
            }
        }
    } else {
        TIMER.SetRecentDanbooruID(type);
    }
    return false;
}

async function CheckAllEvents(promise_array) {
    let hasevents_all = await Promise.all(promise_array);
    let hasevents = hasevents_all.reduce((a,b)=>{return a || b;});
    JSPLib.storage.setStorageData('el-events', hasevents, localStorage);
    if (EL.post_ids.length) {
        TIMER.GetThumbnails();
    }
    if (!EL.had_events) {
        //Only save overflow if it wasn't just a display reload
        JSPLib.storage.setStorageData('el-overflow', EL.item_overflow, localStorage);
        if (!EL.user_settings.autoclose_dmail_notice) {
            $('#dmail-notice').show();
        }
    }
}

function ProcessAllEvents(func) {
    let promise_array = [];
    ALL_EVENTS.forEach((inputtype)=>{
        promise_array = promise_array.concat(ProcessEvent(inputtype));
    });
    TIMER.CheckAllEvents(promise_array).then(()=>{
        func();
    });
}

function MarkAllAsRead() {
    for (let type in EL.lastids.user) {
        SaveLastID(type, EL.lastids.user[type]);
    }
    for (let type in EL.lastids.subscribe) {
        SaveLastID(type, EL.lastids.subscribe[type]);
        JSPLib.storage.setStorageData(`el-saved${type}list`, [], localStorage);
        JSPLib.storage.setStorageData(`el-saved${type}lastid`, [], localStorage);
        HideEventNotice.debuglog(`Removed saved values [${type}]!`);
    }
    if (IsAnyEventEnabled(ALL_MAIL_EVENTS)) {
        HideDmailNotice();
    } else if (!EL.user_settings.autoclose_dmail_notice) {
        $('#dmail-notice').show();
    }
    JSPLib.storage.setStorageData('el-events', false, localStorage);
    SetLastSeenTime();
}

function EventStatusCheck() {
    let disabled_events = JSPLib.utility.setDifference(ALL_EVENTS, EL.user_settings.events_enabled);
    disabled_events.forEach((type)=>{
        //Delete every associated value but the list
        localStorage.removeItem(`el-${type}lastid`);
        localStorage.removeItem(`el-saved${type}lastid`);
        localStorage.removeItem(`el-saved${type}list`);
        localStorage.removeItem(`el-${type}overflow`);
    });
}

//Settings functions

function BroadcastEL(ev) {
    var menuid, linkid;
    BroadcastEL.debuglog(`(${ev.data.type}):`, ev.data);
    switch (ev.data.type) {
        case 'hide':
            !EL.locked_notice && $('#event-notice').hide();
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
            $(`.subscribe-${ev.data.eventtype}[data-id]`).each((i,entry)=>{
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
            JSPLib.utility.fullHide('#event-notice, #el-subscribe-events, .el-subscribe-dual-links');
            //falls through
        case 'settings':
            EL.user_settings = ev.data.user_settings;
            EL.is_setting_menu && JSPLib.menu.updateUserSettings('el');
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
    if (subscribe_key && !typelist.includes(val[subscribe_key])) {
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

function GetRecheckExpires() {
    return EL.user_settings.recheck_interval * JSPLib.utility.one_minute;
}

function RenderSettingsMenu() {
    $('#event-listener').append(EL_MENU);
    $('#el-general-settings').append(JSPLib.menu.renderDomainSelectors('el', 'EventListener'));
    $('#el-notice-settings').append(JSPLib.menu.renderCheckbox('el', 'autolock_notices'));
    $('#el-notice-settings').append(JSPLib.menu.renderCheckbox('el', 'mark_read_topics'));
    $('#el-notice-settings').append(JSPLib.menu.renderCheckbox('el', 'autoclose_dmail_notice'));
    $('#el-event-settings').append(JSPLib.menu.renderCheckbox('el', 'filter_user_events'));
    $('#el-event-settings').append(JSPLib.menu.renderCheckbox('el', 'filter_untranslated_commentary'));
    $('#el-event-settings').append(JSPLib.menu.renderInputSelectors('el', 'events_enabled', 'checkbox'));
    $('#el-event-settings').append(JSPLib.menu.renderInputSelectors('el', 'autosubscribe_enabled', 'checkbox'));
    $('#el-network-settings').append(JSPLib.menu.renderTextinput('el', 'recheck_interval', 10));
    $('#el-subscribe-controls').append(JSPLib.menu.renderInputSelectors('el', 'post_events', 'checkbox', true, ['post', 'comment', 'note', 'commentary'], [], 'Select which events to populate.'));
    $('#el-subscribe-controls').append(JSPLib.menu.renderInputSelectors('el', 'operation', 'radio', true, ['add', 'subtract', 'overwrite'], ['add'], 'Select how the query will affect existing subscriptions.'));
    $('#el-subscribe-controls').append(JSPLib.menu.renderTextinput('el', 'search_query', 50, true, 'Enter a tag search query to populate. See <a href="/wiki_pages/43049" style="color:#0073ff">Help:Cheatsheet</a> for more info.', ['get']));
    $('#el-subscribe-controls').append(DISPLAY_COUNTER);
    $('#el-cache-settings').append(JSPLib.menu.renderLinkclick('el', 'cache_info', "Cache info", "Click to populate", "Calculates the cache usage of the program and compares it to the total usage."));
    $('#el-cache-settings').append(`<div id="el-cache-info-table" style="display:none"></div>`);
    $('#el-cache-editor-controls').append(`<input id="el-control-data-source" type="hidden" value="local_storage">`);
    $('#el-cache-editor-controls').append(JSPLib.menu.renderTextinput('el', 'data_name', 20, true, 'Click <b>Get</b> to see the data, <b>Save</b> to edit it, and <b>Delete</b> to remove it.', ['get', 'save', 'delete']));
    JSPLib.menu.engageUI('el', true);
    JSPLib.menu.saveUserSettingsClick('el', 'EventListener');
    JSPLib.menu.resetUserSettingsClick('el', 'EventListener', LOCALSTORAGE_KEYS, PROGRAM_RESET_KEYS);
    $('#el-search-query-get').on('click.el', PostEventPopulateControl);
    JSPLib.menu.cacheInfoClick('el', /^$/, '#el-cache-info-table');
    JSPLib.menu.getCacheClick('el');
    JSPLib.menu.saveCacheClick('el', ValidateProgramData);
    JSPLib.menu.deleteCacheClick('el');
    JSPLib.menu.cacheAutocomplete('el');
    RebindMenuAutocomplete();
}

//Main program

function Main() {
    $('#dmail-notice').hide();
    Danbooru.EL = EL = {
        controller: document.body.dataset.controller,
        action: document.body.dataset.action,
        showid: JSPLib.danbooru.getShowID(),
        username: JSPLib.utility.getMeta('current-user-name'),
        userid: parseInt(JSPLib.utility.getMeta('current-user-id')),
        lastids: {user: {}, subscribe: {}},
        subscribelist: {},
        openlist: {},
        marked_topic: [],
        item_overflow: false,
        had_events: HasEvents(),
        no_limit: false,
        post_ids: [],
        storage_keys: {local_storage: []},
        is_setting_menu: Boolean($('#c-users #a-edit').length),
        settings_config: SETTINGS_CONFIG,
        channel: new BroadcastChannel('EventListener')
    };
    if (EL.username === 'Anonymous') {
        Main.debuglog("User must log in!");
        return;
    } else if ((typeof EL.username !== 'string') || !JSPLib.validate.validateID(EL.userid)) {
        Main.debuglog("Invalid meta variables!");
        return;
    }
    EL.user_settings = JSPLib.menu.loadUserSettings('el');
    EL.channel.onmessage = BroadcastEL;
    if (EL.is_setting_menu) {
        JSPLib.validate.dom_output = '#el-cache-editor-errors';
        JSPLib.menu.loadStorageKeys('el');
        JSPLib.utility.installScript('https://cdn.jsdelivr.net/gh/jquery/jquery-ui@1.12.1/ui/widgets/tabs.js').done(()=>{
            JSPLib.menu.installSettingsMenu('EventListener');
            RenderSettingsMenu();
        });
    }
    if (!JSPLib.menu.isScriptEnabled('EventListener')) {
        Main.debuglog("Script is disabled on", window.location.hostname);
        return;
    }
    EL.timeout_expires = GetRecheckExpires();
    EventStatusCheck();
    EL.locked_notice = EL.user_settings.autolock_notices;
    InitializeNoticeBox();
    var promise_array = [];
    if ((JSPLib.concurrency.checkTimeout('el-timeout', EL.timeout_expires) || HasEvents() || WasOverflow()) && JSPLib.concurrency.reserveSemaphore('el')) {
        if (CheckAbsence()) {
            JSPLib.concurrency.setRecheckTimeout('el-timeout', EL.timeout_expires);
            ProcessAllEvents(()=>{
                SetLastSeenTime();
                JSPLib.concurrency.freeSemaphore('el');
            });
        } else {
            $('#el-update-all').on('click.el', UpdateAll);
            if (EL.days_absent > 30.0) {
                $('#el-reset-all').on('click.el', ResetAll);
                $('#el-excessive-absent').show();
            }
            $('#el-days-absent').html(EL.days_absent);
            $('#el-absent-section').show();
            $('#event-notice').show();
            JSPLib.concurrency.freeSemaphore('el');
        }
    } else {
        if (!EL.user_settings.autoclose_dmail_notice) {
            $('#dmail-notice').show();
        }
        Main.debuglog("Waiting...");
    }
    if (EL.controller === 'posts' && EL.action === 'show') {
        InitializePostShowMenu();
        if ($(`#image-container[data-uploader-id="${EL.userid}"]`).length) {
            SubscribeMultiLinkCallback();
        }
    } else if (EL.controller === 'comments' && EL.action === 'index') {
        InitializeCommentPartialCommentLinks('#c-comments .post-preview');
    } else if (['forum-topics', 'forum-posts'].includes(EL.controller)) {
        if (EL.action === 'show') {
            InitializeTopicShowMenu();
        } else if (EL.action === 'index') {
            InitializeTopicIndexLinks(document);
        }
    } else if (['wiki-pages', 'wiki-page-versions'].includes(EL.controller)) {
        if (EL.action === 'show') {
            InitializeWikiShowMenu();
        } else if (EL.action === 'index') {
            InitializeWikiIndexLinks(document);
        }
    } else if (['pools', 'pool-versions'].includes(EL.controller)) {
        if (EL.action === 'show') {
            InitializePoolShowMenu();
        } else if (EL.action === 'index') {
            InitializePoolIndexLinks(document);
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

JSPLib.debug.addFunctionTimers(TIMER, false, [RenderSettingsMenu]);

JSPLib.debug.addFunctionTimers(TIMER, true, [
    GetThumbnails, CheckAllEvents, PostEventPopulateControl
]);

TIMER.SetList = JSPLib.debug.debugSyncTimer(SetList, 0);
TIMER.CheckUserType = JSPLib.debug.debugAsyncTimer(CheckUserType, 0);
TIMER.CheckSubscribeType = JSPLib.debug.debugAsyncTimer(CheckSubscribeType, 0);
TIMER.SetRecentDanbooruID = JSPLib.debug.debugAsyncTimer(SetRecentDanbooruID, 0);

JSPLib.debug.addFunctionLogs([
    Main, BroadcastEL, CheckSubscribeType, CheckUserType, HideEventNotice, GetPostsCountdown, ProcessEvent, SaveLastID, CorrectList, GetInstanceID
]);

/****Execution start****/

JSPLib.load.programInitialize(Main, 'EL', PROGRAM_LOAD_REQUIRED_VARIABLES, PROGRAM_LOAD_REQUIRED_SELECTORS);
