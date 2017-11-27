// ==UserScript==
// @name         EventListener
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      2
// @source       https://danbooru.donmai.us/users/23799
// @description  Informs users of new events (flags)
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/eventlistener.user.js
// ==/UserScript==

//Set to true to switch the debug info on
const debug_console = true;

//The number of retries before abandoning program load
const program_load_max_retries = 100;

//Polling interval for checking program status
const timer_poll_interval = 100;

//The default number of items displayed per page
const display_limit = 20;

//Minimum amount of time between rechecks
const recheck_event_interval = 1000 * 60;

//Placeholder for the current user's name
var username;

//HTML for the notice block
const notice_box = `
<div class="ui-corner-all ui-state-highlight" id="event-notice" style="display:none">
    <div id="flag-section"  style="display:none">
        <h1>You've got flags!</h1>
        <div id="flag-table"></div>
    </div>
  <p><a href="#" id="hide-event-notice">Close this</a></p>
</div>
`;

//Helper functions

function debuglog(args) {
    if (debug_console) {
        console.log.apply(this,arguments);
    }
}

function debugTime(str) {
    if (debug_console) {
        console.time(str);
    }
}

function debugTimeEnd(str) {
    if (debug_console) {
        console.timeEnd(str);
    }
}

function CheckTimeout() {
    let timeout = localStorage['el-timeout'];
    if (isNaN(timeout) || (Date.now() > parseInt(timeout))) {
        return true;
    }
    return false;
}

function HasEvents() {
    if (localStorage['el-events'] === "true") {
        return true;
    }
    return false;
}

function SetTimeout() {
    localStorage['el-timeout'] = Date.now() + recheck_event_interval;
}

//Main functions

async function CheckFlags() {
    let flaglastid = localStorage['el-flaglastid'];
    if (flaglastid) {
        let jsonflag = await $.getJSON("/post_flags", {search: {category: 'normal',is_resolved: false, post_tags_match: "status:flagged user:" + username},page: 'a' + flaglastid,limit: display_limit});
        if (jsonflag.length) {
            debuglog("Found flags!",jsonflag[0].id);
            CheckFlags.lastid = jsonflag[0].id;
            let flaghtml = await $.get("/post_flags", {search: {category: 'normal',is_resolved: false, post_tags_match: "status:flagged user:" + username},page: 'a' + flaglastid});
            let $flag = $(flaghtml);
            $("#flag-table").append($(".striped",$flag));
            $("#flag-table .post-preview").addClass("blacklisted");
            $("#event-notice").show();
            $("#flag-section").show();
            localStorage['el-events'] = true;
        } else {
            debuglog("No flags!");
        }
    } else {
        let jsonflag = await $.getJSON("/post_flags", {limit: 1});
        if (jsonflag.length) {
            localStorage['el-flaglastid'] = jsonflag[0].id;
        } else {
            localStorage['el-flaglastid'] = 0;
        }
        debuglog("Set last flag ID:",localStorage['el-flaglastid']);
    }
}
CheckFlags.lastid = 0;

function InitializeNoticeBox() {
    $("#page").prepend(notice_box);
    $("#hide-event-notice").click((e)=>{
        $("#event-notice").hide();
        if (CheckFlags.lastid) {
            localStorage['el-flaglastid'] = CheckFlags.lastid;
            debuglog("Set last flag ID:",localStorage['el-flaglastid']);
        }
        localStorage['el-events'] = false;
        e.preventDefault();
    });
}

function main() {
    username = Danbooru.meta('current-user-name');
    if (!username) {
        return;
    }
    InitializeNoticeBox();
    if (CheckTimeout() || HasEvents()) {
        SetTimeout();
        CheckFlags();
    } else {
        debuglog("Waiting...");
    }
}

//Wait until program is ready before executing
function programLoad() {
    if (programLoad.retries >= program_load_max_retries) {
        debuglog("Abandoning program load!");
        clearInterval(programLoad.timer);
        return;
    }
    if (window.jQuery === undefined) {
        debuglog("jQuery not installed yet!");
        programLoad.retries += 1;
        return;
    }
    if (window.Danbooru === undefined) {
        debuglog("Danbooru not installed yet!");
        programLoad.retries += 1;
        return;
    }
    clearInterval(programLoad.timer);
    main();
    debugTimeEnd("EL-programLoad");
}
programLoad.retries = 0;

//Execution start

debugTime("EL-programLoad");
programLoad.timer = setInterval(programLoad,timer_poll_interval);
