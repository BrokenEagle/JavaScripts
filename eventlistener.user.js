// ==UserScript==
// @name         EventListener
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      13.0
// @source       https://danbooru.donmai.us/users/23799
// @description  Informs users of new events (flags,appeals,dmails,comments,forums,notes,commentaries)
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/eventlistener.user.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/menu.js
// ==/UserScript==

/****Global variables****/

//Variables for debug.js
JSPLib.debug.debug_console = false;
JSPLib.debug.level = JSPLib.debug.INFO;
JSPLib.debug.pretext = "EL:";
JSPLib.debug.pretimer = "EL-";

//Variables for load.js
const program_load_required_variables = ['window.jQuery','window.Danbooru'];
const program_load_required_selectors = ["#nav","#page"];

//Main program variable
var EL;

//For factory reset
const user_events = ['flag','appeal','dmail','spam'];
const subscribe_events = ['comment','forum','note','commentary','post'];
const all_events = user_events.concat(subscribe_events);
const lastid_keys = all_events.map((type)=>{return `el-${type}lastid`;});
const other_keys = subscribe_events.map((type)=>{return [`el-${type}list`,`el-saved${type}list`,`el-saved${type}lastid`,`el-${type}overflow`];}).flat();
const localstorage_keys = lastid_keys.concat(other_keys).concat([
    'el-process-semaphore',
    'el-events',
    'el-overflow',
    'el-timeout',
    'el-last-seen'
]);
//Not handling reset event yet
const program_reset_keys = {};

//Available setting values
const enable_events = ['flag','appeal','dmail','comment','note','commentary','forum'];
const autosubscribe_events = ['post','comment','note','commentary'];

//Main settings
const settings_config = {
    autolock_notices: {
        default: false,
        validate: (data)=>{return typeof data === "boolean";},
        hint: "Closing a notice will no longer close all other notices."
    },
    mark_read_topics: {
        default: true,
        validate: (data)=>{return typeof data === "boolean";},
        hint: "Reading a forum post from the notice will mark the topic as read."
    },
    autoclose_dmail_notice: {
        default: false,
        validate: (data)=>{return typeof data === "boolean";},
        hint: "Will automatically close the DMail notice provided by Danbooru."
    },
    filter_user_events: {
        default: true,
        validate: (data)=>{return typeof data === "boolean";},
        hint: "Only show events not created by the user."
    },
    filter_untranslated_commentary: {
        default: true,
        validate: (data)=>{return typeof data === "boolean";},
        hint: "Only show new commentary that has translated sections."
    },
    recheck_interval: {
        default: 5,
        parse: parseInt,
        validate: (data)=>{return Number.isInteger(data) && data > 0;},
        hint: "How often to check for new events (# of minutes)."
    },
    events_enabled: {
        allitems: all_events,
        default: enable_events,
        validate: (data)=>{return Array.isArray(data) && data.reduce((is_string,val)=>{return is_string && (typeof val === 'string') && all_events.includes(val);},true)},
        hint: "Uncheck to turn off event type."
    },
    autosubscribe_enabled: {
        allitems: autosubscribe_events,
        default: [],
        validate: (data)=>{return Array.isArray(data) && data.reduce((is_string,val)=>{return is_string && (typeof val === 'string') && autosubscribe_events.includes(val);},true)},
        hint: "Check to autosubscribe event type."
    }
}

//CSS Constants

const program_css = `
#event-notice {
    background: #fdf5d9;
    border: 1px solid #fceec1;
}
#c-comments #a-index #p-index-by-post .subscribe-comment,
#c-comments #a-index #p-index-by-post .unsubscribe-comment {
    margin: 1em 0;
}
#c-comments #a-index #p-index-by-comment table,
#event-notice #comments-section #comment-table table {
    float: left;
    text-align: center;
}
#c-comments #a-index #p-index-by-comment .preview,
#event-notice #comments-section #comments-table .preview {
    margin-right: 0;
}
.striped .subscribe-forum,
.striped .unsubscribe-forum,
.striped .subscribe-note,
.striped .unsubscribe-note,
#event-notice .show-full-forum,
#event-notice .hide-full-forum,
#event-notice .show-full-dmail,
#event-notice .hide-full-dmail,
#event-notice .show-full-note,
#event-notice .hide-full-note {
    font-family: monospace;
}
#nav #el-subscribe-events {
    padding-left: 2em;
    font-weight: bold;
}
#el-subscribe-events #el-add-links li {
    margin: 0 -6px;
}
#el-subscribe-events .el-subscribed a,
#el-subscribe-events a[href$="/unsubscribe"] {
    color: green;
}
#el-subscribe-events .el-unsubscribed a,
#el-subscribe-events a[href$="/subscribe"] {
    color: darkorange;
}
#lock-event-notice {
    font-weight: bold;
    color: green;
}
#lock-event-notice.el-locked {
    color: red;
}
#el-absent-section {
    margin: 0.5em;
    border: solid 1px grey;
    padding: 0.5em;
}
`;

const comment_css = `
#event-notice #comment-section #comment-table .preview {
    float: left;
    width: 154px;
    height: 154px;
    margin-right: 30px;
    overflow: hidden;
    text-align; center;
}
#event-notice #comment-section #comment-table .comment {
    margin-left: 184px;
    margin-bottom: 2em;
    word-wrap: break-word;
    padding: 5px;
    display: block;
}
`;

const forum_css = `
#event-notice #forum-section #forum-table .author {
    padding: 1em 1em 0 1em;
    width: 12em;
    float: left;
}
#event-notice #forum-section #forum-table .content {
    padding: 1em;
    margin-left: 14em;
}`;

const menu_css = `
#el-cache-viewer textarea {
    width: 100%;
    min-width: 40em;
    height: 50em;
    padding: 5px;
}
#el-console {
    width: 100%;
    min-width: 100em;
}`;

//HTML constants

const notice_box = `
<div id="event-notice" style="display:none">
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
    <div id="post-section"  style="display:none">
        <h1>You've got edits!</h1>
        <div id="post-table"></div>
    </div>
    <div id="spam-section"  style="display:none">
        <h1>You've got spam!</h1>
        <div id="spam-table"></div>
    </div>
    <p><a href="#" id="hide-event-notice">Close this</a> [<a href="#" id="lock-event-notice">LOCK</a>]</p>
</div>
`;

//Since append is primarily used, these need to be separate ***CSS THE STYLING!!!***
const display_counter = `
<div id="el-search-query-display" style="margin:0.5em;font-size:150%;border:lightgrey solid 1px;padding:0.5em;width:7.5em;display:none">
    Pages left: <span id="el-search-query-counter">...</span>
</div>`;

const el_menu = `
<div id="el-script-message" class="prose">
    <h2>EventListener</h2>
    <p>Check the forum for the latest on information and updates (<a class="dtext-link dtext-id-link dtext-forum-topic-id-link" href="/forum_topics/14747" style="color:#0073ff">topic #14747</a>).</p>
</div>
<div id="el-console" class="jsplib-console">
    <div id="el-settings" class="jsplib-outer-menu">
        <div id="el-notice-settings" class="jsplib-settings-grouping">
            <div id="el-network-message" class="prose">
                <h4>Notice settings</h4>
            </div>
        </div>
        <div id="el-event-settings" class="jsplib-settings-grouping">
            <div id="el-event-message" class="prose">
                <h4>Event settings</h4>
                <ul>
                    <li><b>Events enabled:</b> Select which events to check for.
                        <ul>
                            <li>Subscription-type events will not be checked unless there is more than one subscribed item.</li>
                            <li>These include comments, notes, commentaries, and forums.</li>
                        </ul>
                    </li>
                    <li><b>Autosubscribe enabled:</b> Select which events on items created by the user will be automatically subscribed.
                        <ul>
                            <li>This will be the uploader for comments, notes and commentaries.</li>
                            <li>Events will only be subscribed on the post page for that upload.</li>
                        </ul>
                    </li>
                </ul>
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
        <hr>
        <div id="el-settings-buttons" class="jsplib-settings-buttons">
            <input type="button" id="el-commit" value="Save">
            <input type="button" id="el-resetall" value="Factory Reset">
        </div>
    </div>
    <div id="el-cache-editor" class="jsplib-outer-menu">
        <div id="el-editor-message" class="prose">
            <h4>Cache editor</h4>
            <p><b>Program Data</b> currently cannot be edited; just viewed or deleted.</p>
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
        <div id="el-cache-viewer">
            <textarea readonly></textarea>
        </div>
    </div>
</div>`;

//Polling interval for checking program status
const timer_poll_interval = 100;

//The max number of items to grab with each network call
const query_limit = 100;

//Various program expirations
const process_semaphore_expires = 5 * JSPLib.utility.one_minute;

//Subscribe menu constants
const post_display_names = {
    post: "Edits",
    comment: "Comments",
    note: "Notes",
    commentary: "Artist commentary"
}
const all_post_events = ['post','comment','note','commentary'];
const all_translate_events = ['note','commentary'];

//Type configurations
const typedict = {
    flag: {
        controller: 'post_flags',
        addons: {},
        useraddons: function (username) {return {search: {category: 'normal',post_tags_match: "user:" + username}};},
        filter: (array)=>{return array.filter((val)=>{return IsShownData(val,[],'creator_id',null);})},
        insert: InsertEvents
    },
    appeal: {
        controller: 'post_appeals',
        addons: {},
        useraddons: function (username) {return {search: {post_tags_match: "user:" + username}};},
        filter: (array)=>{return array.filter((val)=>{return IsShownData(val,[],'creator_id',null);})},
        insert: InsertEvents
    },
    dmail: {
        controller: 'dmails',
        addons: {search: {is_spam: false}},
        useraddons: function (username) {return {};},
        filter: (array)=>{return array.filter((val)=>{return IsShownData(val,[],'from_id',null,(val)=>{return !val.is_read});})},
        insert: InsertDmails
    },
    spam: {
        controller: 'dmails',
        addons: {search: {is_spam: true}},
        useraddons: function (username) {return {};},
        filter: (array)=>{return array.filter((val)=>{return IsShownData(val,[],'from_id',null,(val)=>{return !val.is_read});})},
        insert: InsertDmails
    },
    comment: {
        controller: 'comments',
        addons: {group_by: 'comment'},
        limit: 999,
        filter: (array,typelist)=>{return array.filter((val)=>{return IsShownData(val,typelist,'creator_id','post_id');})},
        insert: InsertComments,
        process: function () {JSPLib.utility.setCSSStyle(comment_css,'comment');}
    },
    forum: {
        controller: 'forum_posts',
        addons: {},
        limit: 999,
        filter: (array,typelist)=>{return array.filter((val)=>{return IsShownData(val,typelist,'creator_id','topic_id');})},
        insert: InsertForums,
        process: function () {JSPLib.utility.setCSSStyle(forum_css,'forum');}
    },
    note: {
        controller: 'note_versions',
        addons: {},
        limit: 999,
        filter: (array,typelist)=>{return array.filter((val)=>{return IsShownData(val,typelist,'updater_id','post_id');})},
        insert: InsertNotes
    },
    commentary: {
        controller: 'artist_commentary_versions',
        addons: {},
        limit: 999,
        filter: (array,typelist)=>{return array.filter((val)=>{return IsShownData(val,typelist,'updater_id','post_id',IsShownCommentary);})},
        insert: InsertEvents
    },
    post: {
        controller: 'post_versions',
        addons: {},
        limit: 199,
        filter: (array,typelist)=>{return array.filter((val)=>{return IsShownData(val,typelist,'updater_id','post_id');})},
        insert: InsertPosts
    }
};

/***Functions***/

//Library functions

function CheckSemaphore() {
    let semaphore = JSPLib.storage.getStorageData('el-process-semaphore',localStorage,0);
    return !JSPLib.validate.validateExpires(semaphore, process_semaphore_expires);
}

function FreeSemaphore() {
    $(window).off('beforeunload.el.semaphore');
    JSPLib.storage.setStorageData('el-process-semaphore',0,localStorage);
}

function ReserveSemaphore() {
    if (CheckSemaphore()) {
        //Guarantee that leaving/closing tab reverts the semaphore
        $(window).on('beforeunload.el.semaphore',function () {
            JSPLib.storage.setStorageData('el-process-semaphore',0,localStorage);
        });
        //Set semaphore with an expires in case the program crashes
        let semaphore = JSPLib.utility.getExpiration(process_semaphore_expires);
        JSPLib.storage.setStorageData('el-process-semaphore', semaphore, localStorage);
        return semaphore;
    }
    return null;
}

function FixRenderTextinput(program_shortcut,setting_name,length=20,control=false,hint='',buttons=[]) {
    let config, setting_key, display_name, item;
    [config,setting_key,display_name,item] = JSPLib.menu.getProgramValues(program_shortcut,setting_name);
    let textinput_key = `${program_shortcut}-setting-${setting_key}`;
    let menu_type = (control ? "control" : "setting");
    let submit_control = '';
    if (control && buttons.length) {
        buttons.forEach((button)=>{
            submit_control += FixRenderControlButton(program_shortcut,setting_key,button,2);
        });
    }
    let value = '';
    if (!control) {
        hint = config[setting_name].hint;
        value = item;
    }
    let hint_html = JSPLib.menu.renderSettingHint(program_shortcut,"block",hint);
    return `
<div class="${program_shortcut}-textinput jsplib-textinput jsplib-menu-item" data-setting="${setting_name}">
    <h4>${display_name}</h4>
    <div>
        <input type="text" class="${program_shortcut}-${menu_type} jsplib-${menu_type}" name="${textinput_key}" id="${textinput_key}" value="${value}" size="${length}" autocomplete="off" data-parent="2">
        ${submit_control}
        ${hint_html}
    </div>
</div>`;
}

function FixRenderControlButton(program_shortcut,setting_key,button_name,parent_level) {
    let button_key = `${program_shortcut}-${setting_key}-${button_name}`;
    let display_name = JSPLib.utility.displayCase(button_name);
    return `<input type="button" class="jsplib-control ${program_shortcut}-control" name="${button_key}" id="${button_key}" value="${display_name}" data-parent="${parent_level}">`;
}

//Helper functions

async function SetRecentDanbooruID(type,useritem=false) {
    let jsonitem = await JSPLib.danbooru.submitRequest(typedict[type].controller,JSPLib.danbooru.joinArgs(typedict[type].addons,{limit: 1}),[]);
    if (jsonitem.length) {
        SaveLastID(type,JSPLib.danbooru.getNextPageID(jsonitem,true));
    } else if (useritem) {
        SaveLastID(type,0);
    }
}

function IsEventEnabled(type) {
    return EL.user_settings.events_enabled.includes(type);
}

function IsAnyEventEnabled(event_list) {
    return Boolean(JSPLib.utility.setIntersection(event_list,EL.user_settings.events_enabled).length);
}

function AreAllEventsEnabled(event_list) {
    return !JSPLib.utility.setDifference(event_list,EL.user_settings.events_enabled).length;
}

function HideDmailNotice() {
    if ($("#hide-dmail-notice").length) {
        $("#hide-dmail-notice").click();
    }
}

//Data storage functions

function GetList(type) {
    if (EL.subscribelist[type]) {
        return EL.subscribelist[type];
    }
    let typelist = EL.subscribelist[type] = JSPLib.storage.getStorageData(`el-${type}list`,localStorage,[]);
    if (!Array.isArray(typelist) || (typelist.length && !JSPLib.validate.validateIDList(typelist))) {
        JSPLib.debug.debuglog(`Corrupted data on ${type} list!`);
        EL.old_subscribelist = EL.old_subscribelist || {};
        EL.old_subscribelist[type] = typelist;
        EL.subscribelist[type] = (Array.isArray(typelist) ? typelist.filter((id)=>{return JSPLib.validate.validateID(id);}) : []);
        JSPLib.debug.debugExecute(()=>{
            let validation_error = (Array.isArray(typelist) ? JSPLib.utility.setDifference(typelist,EL.subscribelist[type]) : typelist);
            JSPLib.debug.debuglog("Validation error:",validation_error);
        });
        setTimeout(()=>{JSPLib.storage.setStorageData(`el-${type}list`,EL.subscribelist[type],localStorage);}, 1);
    }
    return EL.subscribelist[type];
}

function SetList(type,input) {
    let typelist = GetList(type);
    let was_subscribed, itemid;
    if (input[0] == '-') {
        itemid = parseInt(input.slice(1));
        typelist = JSPLib.utility.setDifference(typelist,[itemid]);
        was_subscribed = true;
    } else {
        itemid = parseInt(input);
        typelist.push(itemid);
        was_subscribed = false;
    }
    EL.subscribelist[type] = JSPLib.utility.setUnique(typelist);
    JSPLib.storage.setStorageData(`el-${type}list`,EL.subscribelist[type],localStorage);
    EL.channel.postMessage({type: "subscribe", eventtype: type, was_subscribed: was_subscribed, itemid: itemid, eventlist: EL.subscribelist[type]});
}

//Quicker way to check list existence; avoids unnecessarily parsing very long lists
function CheckList(type) {
    let typelist = localStorage.getItem(`el-${type}list`);
    return typelist && typelist !== "[]";
}

//Auxiliary functions

function SaveLastID(type,lastid) {
    let key = `el-${type}lastid`;
    let previousid = JSPLib.storage.getStorageData(key,localStorage,0);
    lastid = Math.max(previousid,lastid);
    JSPLib.storage.setStorageData(key,lastid,localStorage);
    JSPLib.debug.debuglog(`Set last ${type} ID:`,lastid);
}

function HasEvents() {
    return JSPLib.storage.getStorageData('el-events',localStorage,false);
}

function WasOverflow() {
    return JSPLib.storage.getStorageData('el-overflow',localStorage,false);
}

function CheckTimeout() {
    let expires = JSPLib.storage.getStorageData('el-timeout',localStorage,0);
    return !JSPLib.validate.validateExpires(expires,GetRecheckExpires());
}

function SetRecheckTimeout() {
    SetLastSeenTime();
    JSPLib.storage.setStorageData('el-timeout',JSPLib.utility.getExpiration(GetRecheckExpires()),localStorage);
}

function SetLastSeenTime() {
    JSPLib.storage.setStorageData('el-last-seen',Date.now(),localStorage);
}

//Return true if there are no saved events at all, or saved events for the input type
function CheckWaiting(inputtype) {
    if (Object.keys(CheckWaiting.all_waits).length == 0) {
        $.each(typedict,(type)=>{
            CheckWaiting.all_waits[type] = JSPLib.storage.getStorageData(`el-saved${type}lastid`,localStorage,[]).length > 0;
            CheckWaiting.any_waits = CheckWaiting.any_waits || CheckWaiting.all_waits[type];
        });
    }
    return !(Object.values(CheckWaiting.all_waits).reduce((total,entry)=>{return total || entry;},false)) || CheckWaiting.all_waits[inputtype];
}
CheckWaiting.all_waits = {};
CheckWaiting.any_waits = false;

//Return true if there was no overflow at all, or overflow for the input type
function CheckOverflow(inputtype) {
    if (Object.keys(CheckOverflow.all_overflows).length == 0) {
        $.each(typedict,(type)=>{
            CheckOverflow.all_overflows[type] = JSPLib.storage.getStorageData(`el-${type}overflow`,localStorage,false);
            CheckOverflow.any_overflow = CheckOverflow.any_overflow || CheckOverflow.all_overflows[type];
        });
    }
    return !(Object.values(CheckOverflow.all_overflows).reduce((total,entry)=>{return total || entry;},false)) || CheckOverflow.all_overflows[inputtype];
}
CheckOverflow.all_overflows = {};

function ProcessEvent(inputtype) {
    if (!JSPLib.menu.isSettingEnabled('EL','events_enabled',inputtype)) {
        return [];
    }
    if (subscribe_events.includes(inputtype) && !CheckList(inputtype)) {
        return [];
    }
    //Waits always have priority over overflows
    JSPLib.debug.debuglog("ProcessEvent:",inputtype,
                          (CheckWaiting(inputtype) && CheckWaiting.any_waits),
                          (CheckOverflow(inputtype) && !CheckWaiting.any_waits && CheckOverflow.any_overflow),
                          (!CheckWaiting.any_waits && !CheckOverflow.any_overflow));
    if ((CheckWaiting(inputtype) && CheckWaiting.any_waits) || /*Check for any wait event*/
        (CheckOverflow(inputtype) && !CheckWaiting.any_waits && CheckOverflow.any_overflow) || /*Check for any overflow event but not a wait event*/
        (!CheckWaiting.any_waits && !CheckOverflow.any_overflow) /*Check for neither waits nor overflows*/) {
        typedict[inputtype].process && typedict[inputtype].process();
        if (user_events.includes(inputtype)) {
            return CheckUserType(inputtype);
        } else if (subscribe_events.includes(inputtype)) {
            return CheckSubscribeType(inputtype);
        }
    }
    return [];
}

function CheckAbsence() {
    let last_seen = JSPLib.storage.getStorageData('el-last-seen',localStorage,0);
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
    let forum_post = await $.get(`/forum_posts/${forumid}`);
    let $forum_post = $.parseHTML(forum_post);
    let $outerblock = $.parseHTML(`<tr id="full-forum-id-${forumid}"><td colspan="4"></td></tr>`);
    $("td",$outerblock).append($(".forum-post",$forum_post));
    $($rowelement).after($outerblock);
    if (EL.user_settings.mark_read_topics) {
        let topic_link = $("td:first-of-type > a",$rowelement);
        let topic_path = topic_link.length && topic_link[0].pathname;
        let topic_match = topic_path && topic_path.match(/^\/forum_topics\/(\d+)/);
        if (topic_match && !EL.marked_topic.includes(topic_match[1])) {
            ReadForumTopic(topic_match[1]);
            EL.marked_topic.push(topic_match[1]);
        }
    }
}

function AddRenderedNote(noteid,$rowelement) {
    let notehtml = $.parseHTML($.trim($(".el-note-body",$rowelement)[0].innerHTML))[0].data;
    let $outerblock = $.parseHTML(`<tr id="full-note-id-${noteid}"><td colspan="7">${notehtml}</td></tr>`);
    $($rowelement).after($outerblock);
}

async function AddDmail(dmailid,$rowelement) {
    let dmail = await $.get(`/dmails/${dmailid}`);
    let $dmail = $.parseHTML(dmail);
    $(".dmail h1:first-of-type",$dmail).hide();
    let $outerblock = $.parseHTML(`<tr id="full-dmail-id-${dmailid}"><td colspan="4"></td></tr>`);
    $("td",$outerblock).append($(".dmail",$dmail));
    $($rowelement).after($outerblock);
}

//Update links

function UpdateMultiLink(typelist,subscribed,itemid) {
    let current_subscribed = JSPLib.utility.setUnique($("#el-subscribe-events .el-subscribed").map((i,entry)=>{return entry.dataset.type.split(',');}).toArray());
    let new_subscribed = (subscribed ? JSPLib.utility.setDifference(current_subscribed,typelist) : JSPLib.utility.setUnion(current_subscribed,typelist));
    $.each($(`#el-subscribe-events[data-id="${itemid}"] .el-subscribed,#el-subscribe-events[data-id="${itemid}"] .el-unsubscribed`),(i,entry)=>{
        let entry_typelist = entry.dataset.type.split(',');
        if (JSPLib.utility.setIntersection(entry_typelist,new_subscribed).length === entry_typelist.length) {
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
    subscribe_events.forEach((type)=>{
        if (IsEventEnabled(type)) {
            $(`.el-subscribe-${type}-container`).show();
        } else {
            $(`.el-subscribe-${type}-container`).hide();
        }
    });
    if ($("#c-posts #a-show").length) {
        if (AreAllEventsEnabled(all_translate_events)) {
            $(".el-subscribe-translated-container").show();
        } else {
            $(".el-subscribe-translated-container").hide();
        }
        if (IsAnyEventEnabled(all_post_events)) {
            $("#el-subscribe-events").show();
            let enabled_post_events = JSPLib.utility.setIntersection(all_post_events,EL.user_settings.events_enabled);
            $("#el-all-link").attr('data-type',enabled_post_events);
        } else {
            $("#el-subscribe-events").hide();
        }
    }
}

//Insert and process HTML onto page for various types

function InsertEvents($eventpage,type) {
    $(`#${type}-table`).append($(".striped",$eventpage));
    $(`#${type}-table .post-preview`).addClass("blacklisted");
}

function InsertDmails($dmailpage,type) {
    DecodeProtectedEmail($dmailpage);
    $("tr.read-false", $dmailpage).css("font-weight","bold");
    $(`#${type}-table`).append($(".striped",$dmailpage));
    let $dmails_table = $(`#${type}-table`);
    InitializeOpenDmailLinks($dmails_table);
}

function InsertComments($commentpage) {
    DecodeProtectedEmail($commentpage);
    $(".post-preview",$commentpage).addClass("blacklisted");
    $(".edit_comment",$commentpage).hide();
    $("#comment-table").append($(".list-of-comments",$commentpage));
    InitializeCommentPartialCommentLinks("#event-notice #comments-section .post-preview");
}

function InsertForums($forumpage) {
    DecodeProtectedEmail($forumpage);
    let $forums_table = $("#forum-table");
    $forums_table.append($(".striped",$forumpage));
    InitializeTopicIndexLinks($forums_table);
    InitializeOpenForumLinks($forums_table);
}

function InsertNotes($notepage) {
    DecodeProtectedEmail($notepage);
    let $notes_table = $("#note-table");
    $notes_table.append($(".striped",$notepage));
    $("th:first-of-type,td:first-of-type",$notes_table).remove();
    $("td:nth-of-type(1)",$notes_table).addClass("el-post-id");
    $("td:nth-of-type(2)",$notes_table).addClass("el-note-id");
    $("td:nth-of-type(3)",$notes_table).addClass("el-note-body");
    AddThumbnails($notes_table);
    InitializePostNoteIndexLinks('note',$notes_table);
    InitializeOpenNoteLinks($notes_table);
}

function InsertPosts($postpage) {
    let $posts_table = $("#post-table");
    $posts_table.append($(".striped",$postpage));
    AddThumbnails($posts_table);
    InitializePostNoteIndexLinks('post',$posts_table);
}

//Misc functions

function ReadForumTopic(topicid) {
    $.ajax({
        type: "HEAD",
        url:'/forum_topics/' + topicid,
        headers: {
            Accept: "text/html",
        }
    });
}

function DecodeProtectedEmail(obj) {
    $('[data-cfemail]',obj).each((i,entry)=>{
        let encoded_email = $(entry).data('cfemail');
        let percent_decode = '';
        let xorkey = '0x'+encoded_email.substr(0,2) | 0;
        for(let n = 2; encoded_email.length - n; n += 2) {
            percent_decode+='%'+('0'+('0x'+encoded_email.substr(n,2)^xorkey).toString(16)).slice(-2);
        }
        entry.outerHTML = decodeURIComponent(percent_decode);
    });
}

function AddThumbnails($dompage) {
    $(".striped thead tr",$dompage).prepend("<th>Thumb</th>");
    var row_save = {};
    var post_ids = [];
    $(".striped tr[id]",$dompage).each((i,row)=>{
        let $postlink = $("td:first-of-type a:first-of-type",row);
        let match = $postlink && $postlink[0].href.match(/https?:\/\/[^.]+\.donmai\.us\/posts\/(\d+)/);
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
    var $body = $(".striped tbody",$dompage);
    post_ids.forEach((postid)=>{
        row_save[postid][0].prepend(`<td rowspan="${row_save[postid].length}" class="el-post-thumbnail" data-postid="${postid}"></td>`);
        row_save[postid].forEach((row)=>{
            $body.append(row);
        });
    });
    EL.post_ids = JSPLib.utility.setUnion(EL.post_ids, post_ids);
}

function GetThumbnails() {
    if (EL.post_ids.length === 0) {
        return;
    }
    var url_addon = {tags: `id:${EL.post_ids.join(',')} limit:${EL.post_ids.length}`};
    $.get("/posts",url_addon).then((resp)=>{
        var $posts = $.parseHTML(resp);
        var $thumbs = $(".post-preview",$posts);
        $thumbs.each((i,thumb)=>{
            let $thumb = $(thumb);
            $thumb.addClass("blacklisted");
            let postid = $thumb.data('id');
            $(`.striped .el-post-thumbnail[data-postid=${postid}]`).prepend(thumb);
        });
    });
}

function AdjustRowspan(rowelement,openitem) {
    let postid = $(".el-post-id a:first-of-type",rowelement).html();
    let $thumb_cont = $(`#note-table .el-post-thumbnail[data-postid=${postid}]`);
    let current_rowspan = $thumb_cont.attr("rowspan");
    let new_rowspan = parseInt(current_rowspan) + (openitem ? 1 : -1);
    $thumb_cont.attr("rowspan",new_rowspan);
}

async function GetPostsCountdown(limit,searchstring,domname) {
    let tag_addon = {tags: searchstring};
    let limit_addon = {limit: limit};
    let page_addon = {};
    var return_items = [];
    let page_num = 0;
    if (domname) {
        let total_posts = (await JSPLib.danbooru.submitRequest('counts/posts',tag_addon,{counts: {posts: 0}})).counts.posts;
        page_num = Math.ceil(total_posts/limit);
    }
    while (true) {
        if (domname) {
            JSPLib.debug.debuglog("Pages left #",page_num);
            domname && jQuery(domname).html(page_num);
        }
        let request_addons = JSPLib.danbooru.joinArgs(tag_addon,limit_addon,page_addon);
        let request_key = 'posts-' + jQuery.param(request_addons);
        let temp_items = await JSPLib.danbooru.submitRequest('posts',request_addons,[],request_key);
        return_items = return_items.concat(temp_items);
        if (temp_items.length < limit) {
            return return_items;
        }
        let lastid = JSPLib.danbooru.getNextPageID(temp_items,false);
        page_addon = {page:`b${lastid}`};
        page_num -= 1;
    }
}

//Render functions

function RenderMultilinkMenu(itemid,all_types=[]) {
    let shown = (all_types.length === 0 || IsAnyEventEnabled(all_types) ? '' : 'style="display:none"');
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
    <${tag} data-id="${itemid}" class="subscribe-${type}" ${subscribe}><a href="#">${spacer}Subscribe${separator}${ender}</a></${tag}>
    <${tag} data-id="${itemid}" class="unsubscribe-${type}" ${unsubscribe}"><a href="#">Unsubscribe${separator}${ender}</a></${tag}>
</${tag}>
`;
}

function RenderSubscribeMultiLinks(name,typelist,itemid) {
    let itemdict = {};
    $.each(typelist,(i,type)=>{
        itemdict[type] = GetList(type);
    });
    let classname = (typelist.reduce((total,type)=>{return total && itemdict[type].includes(itemid);},true) ? 'el-subscribed' : 'el-unsubscribed');
    let idname = 'el-' + name.toLowerCase().replace(/[ _]/g,'-') + '-link';
    return `<li id="${idname}" data-type="${typelist}" class="${classname}"><a href="#">${name}</a></li>`;
}

function RenderOpenItemLinks(type,itemid,showtext="Show",hidetext="Hide") {
    return `<span data-id="${itemid}" class="show-full-${type}" style><a href="#">${showtext}</a></span>` +
           `<span data-id="${itemid}" class="hide-full-${type}" style="display:none !important"><a href="#">${hidetext}</a></span>`;
}

//Initialize functions

function InitializeNoticeBox() {
    $("#page").prepend(notice_box);
    if (EL.locked_notice) {
        $("#lock-event-notice").addClass("el-locked");
    }
    HideEventNoticeClick();
    LockEventNoticeClick();
}

function InitializeOpenForumLinks($obj) {
    $.each($(".striped tbody tr",$obj),(i,$row)=>{
        let forumid = $row.id.match(/(\d+)$/)[1];
        $(".forum-post-excerpt",$row).prepend(RenderOpenItemLinks('forum',forumid) + '&nbsp;|&nbsp;');
    });
    OpenItemClick('forum',$obj,3,AddForumPost);
}

function InitializeOpenNoteLinks($obj) {
    $.each($(".striped tr[id]",$obj),(i,$row)=>{
        let noteid = $(".el-note-id a",$row)[0].innerHTML.replace('.','-');
        $(".el-note-body",$row).append('<p style="text-align:center">' + RenderOpenItemLinks('note',noteid,"Render note","Hide note") + '</p>');
    });
    OpenItemClick('note',$obj,4,AddRenderedNote,AdjustRowspan);
}

function InitializeOpenDmailLinks($obj) {
    $.each($(".striped tbody tr",$obj),(i,$row)=>{
        let dmailid = $row.innerHTML.match(/\/dmails\/(\d+)/)[1];
        $("td:nth-of-type(4)",$row).prepend(RenderOpenItemLinks('dmail',dmailid) + '&nbsp;|&nbsp;');
    });
    OpenItemClick('dmail',$obj,3,AddDmail);
}

//#C-POSTS #A-SHOW
function InitializePostShowMenu() {
    var postid = parseInt(JSPLib.utility.getMeta('post-id'));
    let menu_obj = $.parseHTML(RenderMultilinkMenu(postid,all_post_events));
    all_post_events.forEach((type)=>{
        let linkhtml = RenderSubscribeMultiLinks(post_display_names[type],[type],postid);
        let shownhtml = (IsEventEnabled(type) ? '' : 'style="display:none"');
        $("#el-add-links",menu_obj).append(`<span class="el-subscribe-${type}-container "${shownhtml}>${linkhtml} | </span>`);
    });
    let shownhtml = (AreAllEventsEnabled(all_translate_events) ? '' : 'style="display:none"');
    let linkhtml = RenderSubscribeMultiLinks("Translations",all_translate_events,postid,' | ');
    $("#el-add-links",menu_obj).append(`<span class="el-subscribe-translated-container "${shownhtml}>${linkhtml} | </span>`);
    //The All link is always shown when the outer menu is shown, so no need to individually hide it
    let enabled_post_events = JSPLib.utility.setIntersection(all_post_events,EL.user_settings.events_enabled);
    $("#el-add-links",menu_obj).append(RenderSubscribeMultiLinks("All",enabled_post_events,postid,' | '));
    $("nav#nav").append(menu_obj);
    SubscribeMultiLinkClick();
}

//#C-FORUM-TOPICS #A-SHOW
function InitializeTopicShowMenu() {
    var topicid = parseInt($("#forum_post_topic_id").attr("value"));
    if (!topicid) {
        let $obj = $('a[href$="/subscribe"],a[href$="/unsubscribe"]');
        let match = $obj.attr("href").match(/\/forum_topics\/(\d+)\/(?:un)?subscribe/);
        if (!match) {
            return;
        }
        topicid = parseInt(match[1]);
    }
    let menu_obj = $.parseHTML(RenderMultilinkMenu(topicid,['forum']));
    let linkhtml = RenderSubscribeMultiLinks("Topic",['forum'],topicid,'');
    let shownhtml = (IsEventEnabled('forum') ? '' : 'style="display:none"');
    $("#el-add-links",menu_obj).append(`<span class="el-subscribe-forum-container "${shownhtml}>${linkhtml} | </span>`);
    let $email = $('#subnav-subscribe').detach().find("a").text("Email");
    $("#el-add-links",menu_obj).append($email);
    $("nav#nav").append(menu_obj);
    SubscribeMultiLinkClick();
}

//#C-FORUM-TOPICS #A-INDEX
function InitializeTopicIndexLinks($obj) {
    $.each($(".striped tr td:first-of-type",$obj), (i,entry)=>{
        let topicid = parseInt(entry.innerHTML.match(/\/forum_topics\/(\d+)/)[1]);
        let linkhtml = RenderSubscribeDualLinks('forum',topicid,"span","","",true);
        let shownhtml = (IsEventEnabled('forum') ? '' : 'style="display:none"');
        $(entry).prepend(`<span class="el-subscribe-forum-container "${shownhtml}>${linkhtml}&nbsp|&nbsp</span>`);
    });
    SubscribeDualLinkClick('forum');
}

//EVENT NOTICE

function InitializePostNoteIndexLinks(type,$obj) {
    $(".striped tr[id]",$obj).each((i,row)=>{
        if ($(".el-post-thumbnail",row).length === 0) {
            return;
        }
        let postid = $(".el-post-thumbnail",row).data('postid');
        let linkhtml = RenderSubscribeDualLinks(type,postid,"span","","",true);
        $("td:first-of-type",row).prepend(`<div style="text-align:center">${linkhtml}</div>`);
    });
    SubscribeDualLinkClick(type);
}

//#C-COMMENTS #P-INDEX-BY-POST
function InitializeCommentPartialPostLinks() {
    $.each($("#p-index-by-post .comments-for-post"), (i,$entry)=>{
        let postid = parseInt($($entry).data('post-id'));
        let linkhtml = RenderSubscribeDualLinks('comment',postid,"div"," ","comments");
        let shownhtml = (IsEventEnabled('comment') ? '' : 'style="display:none"');
        $(".header",$entry).after(`<div class="el-subscribe-comment-container "${shownhtml}>${linkhtml}</div>`);
    });
    SubscribeDualLinkClick('comment');
}

//#C-COMMENTS #P-INDEX-BY-COMMENT
function InitializeCommentPartialCommentLinks(selector) {
    $.each($(selector), (i,$entry)=>{
        var postid = parseInt($($entry).data('id'));
        var linkhtml = RenderSubscribeDualLinks('comment',postid,"div","<br>","comments");
        let shownhtml = (IsEventEnabled('comment') ? '' : 'style="display:none"');
        /****NEED TO SEE IF I CAN DO THIS WITHOUT A TABLE****/
        var $table = $.parseHTML(`<table><tbody><tr><td></td></tr><tr><td class="el-subscribe-comment-container "${shownhtml}>${linkhtml}</td></tr></tbody></table>`);
        var $preview = $(".preview",$entry).detach();
        $("tr:nth-of-type(1) td",$table).append($preview);
        $entry.prepend($table[0]);
    });
    SubscribeDualLinkClick('comment');
}

/****Click functions****/

function HideEventNoticeClick() {
    $("#hide-event-notice").click((e)=>{
        $("#event-notice").hide();
        $.each(EL.lastids.user,(type,value)=>{
            SaveLastID(type,value);
        });
        $.each(EL.lastids.subscribe,(type,value)=>{
            SaveLastID(type,value);
            delete localStorage[`el-saved${type}list`];
            delete localStorage[`el-saved${type}lastid`];
            JSPLib.debug.debuglog(`Deleted saved values! (${type})`);
        });
        HideDmailNotice();
        JSPLib.storage.setStorageData('el-events',false,localStorage);
        SetLastSeenTime();
        EL.channel.postMessage({type: "hide"});
        e.preventDefault();
    });
}

function LockEventNoticeClick() {
    $("#lock-event-notice").click((e)=>{
        $(e.target).addClass("el-locked");
        EL.locked_notice = true;
        e.preventDefault();
    });
}

function UpdateAllClick() {
    $("#el-update-all").click((e)=>{
        if (!UpdateAllClick.run_once && !ResetAllClick.run_once) {
            JSPLib.danbooru.counter_domname = "#el-activity-indicator";
            EL.no_limit = true;
            ProcessAllEvents(()=>{
                SetRecheckTimeout();
                Danbooru.Utility.notice("All events checked!");
            });
        }
        UpdateAllClick.run_once = true;
        e.preventDefault();
    });
}
UpdateAllClick.run_once = false;

function ResetAllClick() {
    $("#el-reset-all").click((e)=>{
        if (!UpdateAllClick.run_once && !ResetAllClick.run_once) {
            lastid_keys.forEach((key)=>{
                localStorage.removeItem(key);
            });
            ProcessAllEvents(()=>{
                SetRecheckTimeout();
                Danbooru.Utility.notice("All event positions reset!");
            });
        }
        ResetAllClick.run_once = true;
        e.preventDefault();
    });
}
ResetAllClick.run_once = false;

function SubscribeMultiLinkClick() {
    $("#el-subscribe-events a").off().click((e)=>{
        let $menu = $(JSPLib.utility.getNthParent(e.target,4));
        let $container = $(e.target.parentElement);
        let itemid = $menu.data('id');
        let typelist = $container.data('type').split(',');
        let subscribed = ($container.hasClass('el-subscribed') ? true : false);
        let prefix = (subscribed ? '-' : '');
        $.each(typelist,(i,type)=>{
            setTimeout(()=>{SetList(type,prefix + itemid);},1);
            UpdateDualLink(type,subscribed,itemid);
        });
        UpdateMultiLink(typelist,subscribed,itemid);
        e.preventDefault();
    });
}

function SubscribeDualLinkClick(type) {
    $(`.subscribe-${type} a,.unsubscribe-${type} a`).off().click((e)=>{
        let $container = $(e.target.parentElement);
        let itemid = $container.data('id');
        let subscribed = GetList(type).includes(itemid);
        let prefix = (subscribed ? '-' : '');
        setTimeout(()=>{SetList(type,prefix + itemid);},1);
        UpdateDualLink(type,subscribed,itemid);
        UpdateMultiLink([type],subscribed,itemid);
        e.preventDefault();
    });
}

function OpenItemClick(type,$obj,parentlevel,htmlfunc,otherfunc=(()=>{})) {
    $(`.show-full-${type} a,.hide-full-${type} a`).off().click(function(e){
        EL.openlist[type] = EL.openlist[type] || [];
        let $container = $(e.target.parentElement);
        let itemid = $container.data('id');
        let openitem = $container.hasClass(`show-full-${type}`);
        let rowelement = JSPLib.utility.getNthParent(e.target,parentlevel);
        if (openitem && !EL.openlist[type].includes(itemid)) {
            htmlfunc(itemid,rowelement);
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
        otherfunc(rowelement,openitem);
        e.preventDefault();
    });
}

function SubscribeMultiLinkCallback() {
    $.each(EL.user_settings.autosubscribe_enabled,(i,type)=>{
        $(`#el-subscribe-events .el-unsubscribed[data-type="${type}"] a`).click();
    });
}

function PostEventPopulateControl() {
    $("#el-search-query-get").click(async (e)=>{
        let post_events = JSPLib.menu.getCheckboxRadioSelected(`[data-setting="post_events"] [data-selector]`);
        let operation = JSPLib.menu.getCheckboxRadioSelected(`[data-setting="operation"] [data-selector]`);
        let search_query = $("#el-setting-search-query").val();
        if (post_events.length === 0 || operation.length === 0) {
            Danbooru.Utility.notice("Must select at least one post event type!");
        } else if (search_query === "") {
            Danbooru.Utility.notice("Must have at least one search term!");
        } else {
            $("#el-search-query-display").show();
            let posts = await GetPostsCountdown(100,search_query,"#el-search-query-counter");
            let postids = JSPLib.utility.getObjectAttributes(posts,'id');
            let post_changes = [];
            let was_subscribed = [];
            let new_subscribed = [];
            $.each(post_events,(i,eventtype)=>{
                let typelist = GetList(eventtype);
                switch (operation[0]) {
                    case "add":
                        new_subscribed = JSPLib.utility.setDifference(postids,typelist);
                        was_subscribed = [];
                        post_changes = post_changes.concat(new_subscribed);
                        typelist = JSPLib.utility.setUnion(typelist,postids);
                        break;
                    case "subtract":
                        new_subscribed = [];
                        was_subscribed = JSPLib.utility.setIntersection(postids,typelist);
                        post_changes = post_changes.concat(was_subscribed)
                        typelist = JSPLib.utility.setDifference(typelist,postids);
                        break;
                    case "overwrite":
                        was_subscribed = JSPLib.utility.setDifference(typelist,postids);
                        new_subscribed = JSPLib.utility.setDifference(postids,typelist);
                        post_changes = post_changes.concat(postids);
                        typelist = postids;
                }
                EL.subscribelist[eventtype] = typelist;
                setTimeout(()=>{JSPLib.storage.setStorageData(`el-${eventtype}list`,EL.subscribelist[eventtype],localStorage);}, 1);
                EL.channel.postMessage({type: "reload", eventtype: eventtype, was_subscribed: was_subscribed, new_subscribed: new_subscribed, eventlist: EL.subscribelist[eventtype]});
            });
            $("#el-search-query-counter").html(0);
            post_changes = JSPLib.utility.setUnique(post_changes);
            Danbooru.Utility.notice(`Subscriptions were changed by ${post_changes.length} posts!`);
        }
    });
}

function RebindMenuAutocomplete() {
    if (JSPLib.utility.hasDOMDataKey("#user_blacklisted_tags,#user_favorite_tags",'uiAutocomplete')) {
        clearInterval(RebindMenuAutocomplete.timer);
        $("#user_blacklisted_tags,#user_favorite_tags").autocomplete("destroy").off('keydown.Autocomplete.tab');
        $("#el-setting-search-query").attr('data-autocomplete','tag-query');
        setTimeout(Danbooru.Autocomplete.initialize_tag_autocomplete, timer_poll_interval);
    }
}
RebindMenuAutocomplete.timer = {};

//Main execution functions

async function CheckUserType(type) {
    let lastidkey = `el-${type}lastid`;
    let typelastid = JSPLib.storage.getStorageData(lastidkey,localStorage,0);
    if (JSPLib.validate.validateID(typelastid)) {
        let url_addons = JSPLib.danbooru.joinArgs(typedict[type].addons,typedict[type].useraddons(EL.username));
        let jsontype = await JSPLib.danbooru.getAllItems(typedict[type].controller,query_limit,{addons:url_addons,page:typelastid,reverse:true});
        let filtertype = typedict[type].filter(jsontype);
        let lastusertype = (jsontype.length ? [JSPLib.danbooru.getNextPageID(jsontype,true)] : []);
        if (filtertype.length) {
            EL.lastids.user[type] = lastusertype[0];
            JSPLib.debug.debuglog(`Found ${type}(s)!`,EL.lastids.user[type]);
            let idlist = JSPLib.utility.getObjectAttributes(filtertype,'id');
            url_addons = JSPLib.danbooru.joinArgs(typedict[type].addons,{search: {id: idlist.join(',')}, limit: idlist.length});
            let typehtml = await $.get(`/${typedict[type].controller}`, url_addons);
            let $typepage = $(typehtml);
            typedict[type].insert($typepage,type);
            $("#event-notice").show();
            $(`#${type}-section`).show();
            return true;
        } else {
            JSPLib.debug.debuglog(`No ${type}(s)!`);
            if (lastusertype.length && (typelastid !== lastusertype[0])) {
                SaveLastID(type,lastusertype[0]);
            }
        }
    } else {
        SetRecentDanbooruID(type,true);
    }
    return false;
}

async function CheckSubscribeType(type) {
    let lastidkey = `el-${type}lastid`;
    let typelastid = JSPLib.storage.getStorageData(lastidkey,localStorage,0);
    if (JSPLib.validate.validateID(typelastid)) {
        let typelist = GetList(type);
        let savedlistkey = `el-saved${type}list`;
        let savedlastidkey = `el-saved${type}lastid`;
        let overflowkey = `el-${type}overflow`;
        var subscribetypelist = [], jsontypelist = [];
        let savedlastid = JSPLib.storage.getStorageData(savedlastidkey,localStorage);
        let savedlist = JSPLib.storage.getStorageData(savedlistkey,localStorage);
        if (!JSPLib.validate.validateIDList(savedlastid) || !JSPLib.validate.validateIDList(savedlist)) {
            let urladdons = typedict[type].addons;
            if (!EL.no_limit) {
                urladdons = JSPLib.danbooru.joinArgs(urladdons,{search:{id:`${typelastid}..${typelastid+typedict[type].limit}`}});
            }
            let jsontype = await JSPLib.danbooru.getAllItems(typedict[type].controller,query_limit,{page:typelastid,addons:urladdons,reverse:true});
            if (jsontype.length === typedict[type].limit) {
                JSPLib.debug.debuglog(`${typedict[type].limit} ${type} items; overflow detected!`);
                JSPLib.storage.setStorageData(overflowkey,true,localStorage);
                EL.item_overflow = true;
            } else {
                localStorage.removeItem(overflowkey);
            }
            let subscribetype = typedict[type].filter(jsontype,typelist);
            if (jsontype.length) {
                jsontypelist = [JSPLib.danbooru.getNextPageID(jsontype,true)];
            }
            if (subscribetype.length) {
                subscribetypelist = JSPLib.utility.getObjectAttributes(subscribetype,'id');
                JSPLib.storage.setStorageData(savedlistkey,subscribetypelist,localStorage);
                JSPLib.storage.setStorageData(savedlastidkey,jsontypelist,localStorage);
            }
        } else {
            jsontypelist = savedlastid;
            subscribetypelist = savedlist;
        }
        if (subscribetypelist.length) {
            EL.lastids.subscribe[type] = jsontypelist[0];
            JSPLib.debug.debuglog(`Found ${type}(s)!`,EL.lastids.subscribe[type]);
            let url_addons = JSPLib.danbooru.joinArgs(typedict[type].addons,{search: {id: subscribetypelist.join(',')}, limit: subscribetypelist.length});
            let typehtml = await $.get(`/${typedict[type].controller}`, url_addons);
            let $typepage = $(typehtml);
            typedict[type].insert($typepage,type);
            $("#event-notice").show();
            $(`#${type}-section`).show();
            return true;
        } else {
            JSPLib.debug.debuglog(`No ${type}(s)!`);
            if (jsontypelist.length && (typelastid !== jsontypelist[0])) {
                SaveLastID(type,jsontypelist[0]);
            }
        }
    } else {
        SetRecentDanbooruID(type);
    }
    return false;
}

async function CheckAllEvents(promise_array) {
    let hasevents_all = await Promise.all(promise_array);
    let hasevents = hasevents_all.reduce((a,b)=>{return a || b;});
    JSPLib.storage.setStorageData('el-events',hasevents,localStorage);
    GetThumbnails();
    //Only save overflow if it wasn't just a display reload
    if (!EL.had_events) {
        JSPLib.storage.setStorageData('el-overflow',EL.item_overflow,localStorage);
    }
}

function ProcessAllEvents(func) {
    let promise_array = [];
    all_events.forEach((inputtype)=>{
        promise_array = promise_array.concat(ProcessEvent(inputtype));
    });
    CheckAllEvents(promise_array).then(()=>{
        func();
    });
}

function EventStatusCheck() {
    let disabled_events = JSPLib.utility.setDifference(all_events,EL.user_settings.events_enabled);
    disabled_events.forEach((type)=>{
        //Delete every associated value but the list
        localStorage.removeItem(`el-${type}lastid`);
        localStorage.removeItem(`el-saved${type}lastid`);
        localStorage.removeItem(`el-saved${type}list`);
    });
}

////Cache editor

//Cache helper functions

async function LoadStorageKeys() {
    storage_keys = Object.keys(localStorage);
    EL.storage_keys.local_storage = storage_keys.filter((key)=>{return key.startsWith("el-");});
}

function GetCacheDatakey() {
    EL.data_value = $("#el-setting-data-name").val().trim().replace(/\s+/g,'_');
    return 'el-' + EL.data_value;
}

function CacheSource(req,resp) {
    let check_key = GetCacheDatakey();
    let source_keys = EL.storage_keys.local_storage;
    let available_keys = source_keys.filter((key)=>{return key.startsWith(check_key);});
    let transformed_keys = available_keys.slice(0,20);
    transformed_keys = transformed_keys.map((key)=>{return key.slice(key.indexOf('-')+1);});
    resp(transformed_keys);
}

//Cache event functions

function GetCacheClick() {
    $("#el-data-name-get").on("click.el",(e)=>{
        let storage_key = GetCacheDatakey();
        let data = JSPLib.storage.getStorageData(storage_key,localStorage);
        $("#el-cache-viewer textarea").val(JSON.stringify(data,null,2));
    });
}

function DeleteCacheClick() {
    $("#el-data-name-delete").on("click.el",(e)=>{
        let storage_key = GetCacheDatakey();
        if (confirm("This will delete program data that may cause problems until the page can be refreshed.\n\nAre you sure?")) {
            localStorage.removeItem(storage_key);
            Danbooru.Utility.notice("Data has been deleted.");
        }
    });
}

function CacheAutocomplete() {
    $("#el-setting-data-name").autocomplete({
        minLength: 0,
        delay: 0,
        source: CacheSource,
        search: function() {
            $(this).data("uiAutocomplete").menu.bindings = $();
        }
    }).off('keydown.Autocomplete.tab');
}


//Settings functions

function BroadcastEL(ev) {
    JSPLib.debug.debuglog("Broadcast",ev.data);
    if (ev.data.type === "hide" && !EL.locked_notice) {
        $("#event-notice").hide();
    } else if (ev.data.type === "settings") {
        EL.user_settings = ev.data.user_settings;
        ToggleSubscribeLinks();
    } else if (ev.data.type === "reset") {
        //Not handling this yet, so just hide everything until the next page refresh
        JSPLib.utility.fullHide("#event-notice,#el-subscribe-events,.el-subscribe-dual-links");
    } else if (ev.data.type === "subscribe") {
        EL.subscribelist[ev.data.eventtype] = ev.data.eventlist;
        UpdateMultiLink([ev.data.eventtype],ev.data.was_subscribed,ev.data.itemid);
        UpdateDualLink(ev.data.eventtype,ev.data.was_subscribed,ev.data.itemid);
    } else if (ev.data.type === "reload") {
        EL.subscribelist[ev.data.eventtype] = ev.data.eventlist;
        let menuid = $("#el-subscribe-events").data('id');
        if (ev.data.was_subscribed.includes(menuid)) {
            UpdateMultiLink([ev.data.eventtype],true,menuid);
        } else if (ev.data.new_subscribed.includes(menuid)) {
            UpdateMultiLink([ev.data.eventtype],false,menuid);
        }
        $(`.subscribe-${ev.data.eventtype}[data-id]`).each((i,entry)=>{
            let linkid = $(entry).data('id');
            if (ev.data.was_subscribed.includes(linkid)) {
                UpdateDualLink(ev.data.eventtype,true,linkid);
            } else if (ev.data.new_subscribed.includes(linkid)) {
                UpdateDualLink(ev.data.eventtype,false,linkid);
            }
        });
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
    $("#event-listener").append(el_menu);
    $("#el-notice-settings").append(JSPLib.menu.renderCheckbox("el",'autolock_notices'));
    $("#el-notice-settings").append(JSPLib.menu.renderCheckbox("el",'mark_read_topics'));
    $("#el-notice-settings").append(JSPLib.menu.renderCheckbox("el",'autoclose_dmail_notice'));
    $("#el-event-settings").append(JSPLib.menu.renderCheckbox("el",'filter_user_events'));
    $("#el-event-settings").append(JSPLib.menu.renderCheckbox("el",'filter_untranslated_commentary'));
    $("#el-event-settings").append(JSPLib.menu.renderInputSelectors("el",'events_enabled','checkbox'));
    $("#el-event-settings").append(JSPLib.menu.renderInputSelectors("el",'autosubscribe_enabled','checkbox'));
    $("#el-network-settings").append(JSPLib.menu.renderTextinput("el",'recheck_interval',10));
    $("#el-subscribe-controls").append(JSPLib.menu.renderInputSelectors('el','post_events','checkbox',true,['post','comment','note','commentary'],[],'Select which events to populate.'));
    $("#el-subscribe-controls").append(JSPLib.menu.renderInputSelectors('el','operation','radio',true,['add','subtract','overwrite'],['add'],'Select how the query will affect existing subscriptions.'));
    $("#el-subscribe-controls").append(JSPLib.menu.renderTextinput('el','search_query',50,true,'Enter a tag search query to populate. See <a href="/wiki_pages/43049" style="color:#0073ff">Help:Cheatsheet</a> for more info.',true));
    $("#el-subscribe-controls").append(display_counter);
    $("#el-cache-editor-controls").append(FixRenderTextinput('el','data_name',20,true,"Click <b>Get</b> to see the data and <b>Delete</b> to remove it.",['get','delete']));
    JSPLib.menu.engageUI('el',true);
    JSPLib.menu.saveUserSettingsClick('el','EventListener');
    JSPLib.menu.resetUserSettingsClick('el','EventListener',localstorage_keys,program_reset_keys);
    PostEventPopulateControl();
    GetCacheClick();
    DeleteCacheClick();
    CacheAutocomplete();
    RebindMenuAutocomplete.timer = setInterval(()=>{RebindMenuAutocomplete();},timer_poll_interval);
}

/****Main****/

function main() {
    $("#dmail-notice").hide();
    Danbooru.EL = EL = {
        username: JSPLib.utility.getMeta('current-user-name'),
        userid: parseInt(JSPLib.utility.getMeta('current-user-id')),
        lastids: {
            user: {},
            subscribe: {}
        },
        subscribelist: {},
        openlist: {},
        marked_topic: [],
        item_overflow: false,
        had_events: HasEvents(),
        no_limit: false,
        post_ids: [],
        storage_keys: {local_storage: []},
        settings_config: settings_config
    };
    if (EL.username === "Anonymous") {
        JSPLib.debug.debuglog("User must log in!");
        return;
    } else if ((typeof EL.username !== "string") || !JSPLib.validate.validateID(EL.userid)) {
        JSPLib.debug.debuglog("Invalid meta variables!");
        return;
    }
    EL.user_settings = JSPLib.menu.loadUserSettings('el');
    EventStatusCheck();
    EL.locked_notice = EL.user_settings.autolock_notices;
    EL.channel = new BroadcastChannel('EventListener');
    EL.channel.onmessage = BroadcastEL;
    InitializeNoticeBox();
    var promise_array = [];
    if ((CheckTimeout() || HasEvents() || WasOverflow()) && ReserveSemaphore()) {
        if (CheckAbsence()) {
            SetRecheckTimeout();
            ProcessAllEvents(()=>{
                FreeSemaphore();
            });
        } else {
            UpdateAllClick();
            if (EL.days_absent > 30.0) {
                ResetAllClick();
                $("#el-excessive-absent").show();
            }
            $("#el-days-absent").html(EL.days_absent);
            $("#el-absent-section").show();
            $("#event-notice").show();
            FreeSemaphore();
        }
    } else {
        JSPLib.debug.debuglog("Waiting...");
    }
    if ($("#c-posts #a-show").length) {
        InitializePostShowMenu();
    } else if ($("#c-comments #a-index #p-index-by-post").length) {
        InitializeCommentPartialPostLinks();
    } else if ($("#c-comments #a-index #p-index-by-comment").length) {
        InitializeCommentPartialCommentLinks("#p-index-by-comment .post-preview");
    } else if ($("#c-forum-topics #a-show,#c-forum-posts #a-show").length) {
        InitializeTopicShowMenu();
    } else if ($("#c-forum-topics #a-index,#c-forum-posts #a-index").length) {
        InitializeTopicIndexLinks(document);
    }
    if ($("#c-users #a-edit").length) {
        LoadStorageKeys();
        JSPLib.utility.installScript("https://cdn.jsdelivr.net/gh/jquery/jquery-ui@1.12.1/ui/widgets/tabs.js").done(()=>{
            JSPLib.menu.installSettingsMenu("EventListener");
            RenderSettingsMenu();
        });
        JSPLib.utility.setCSSStyle(menu_css,'menu');
    }
    if (EL.user_settings.autoclose_dmail_notice) {
        HideDmailNotice();
    }
    if ($(`#image-container[data-uploader-id="${EL.userid}"]`).length) {
        SubscribeMultiLinkCallback();
    }
    JSPLib.utility.setCSSStyle(program_css,'program');
}

/****Execution start****/

JSPLib.load.programInitialize(main,'EL',program_load_required_variables,program_load_required_selectors);
