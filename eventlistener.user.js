// ==UserScript==
// @name         EventListener
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      4
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

//Placeholder for the current user
var username;
var userid;

//HTML for the notice block
const notice_box = `
<div class="ui-corner-all ui-state-highlight" id="event-notice" style="display:none">
    <div id="ham-dmail-section"  style="display:none">
        <h1>You've got mail!</h1>
        <div id="ham-dmail-table"></div>
    </div>
    <div id="flag-section"  style="display:none">
        <h1>You've got flags!</h1>
        <div id="flag-table"></div>
    </div>
    <div id="appeal-section"  style="display:none">
        <h1>You've got appeals!</h1>
        <div id="appeal-table"></div>
    </div>
    <div id="spam-dmail-section"  style="display:none">
        <h1>You've got spam!</h1>
        <div id="spam-dmail-table"></div>
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

function HideUsersAppeals($appeal) {
    $.each($("tr",$appeal),(i,row)=>{
        if (i === 0) {
            return;
        }
        if ($("td:nth-of-type(6) a",row)[0].innerHTML === username) {
            $(row).hide();
        }
    });
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

async function CheckAppeals() {
    let appeallastid = localStorage['el-appeallastid'];
    if (appeallastid) {
        let jsonappeal = await $.getJSON("/post_appeals", {search: {is_resolved: false, post_tags_match: "status:deleted user:" + username},page: 'a' + appeallastid,limit: display_limit});
        jsonappeal = jsonappeal.filter((val)=>{return val.creator_id !== userid;});
        if (jsonappeal.length) {
            debuglog("Found appeals!",jsonappeal[0].id);
            CheckAppeals.lastid = jsonappeal[0].id;
            let appealhtml = await $.get("/post_appeals", {search: {is_resolved: false, post_tags_match: "status:deleted user:" + username},page: 'a' + appeallastid});
            let $appeal = $(appealhtml);
            HideUsersAppeals($appeal);
            $("#appeal-table").append($(".striped",$appeal));
            $("#appeal-table .post-preview").addClass("blacklisted");
            $("#event-notice").show();
            $("#appeal-section").show();
            localStorage['el-events'] = true;
        } else {
            debuglog("No appeals!");
        }
    } else {
        let jsonappeal = await $.getJSON("/post_appeals", {limit: 1});
        if (jsonappeal.length) {
            localStorage['el-appeallastid'] = jsonappeal[0].id;
        } else {
            localStorage['el-appeallastid'] = 0;
        }
        debuglog("Set last appeal ID:",localStorage['el-appeallastid']);
    }
}
CheckAppeals.lastid = 0;

async function CheckDmails() {
    let dmaillastid = localStorage['el-dmaillastid'];
    if (dmaillastid) {
        let jsondmail = await $.getJSON("/dmails", {page: 'a' + dmaillastid,limit: display_limit});
        let hamjsondmail = jsondmail.filter((val)=>{return !val.is_read && !val.is_spam;});
        let spamjsondmail = jsondmail.filter((val)=>{return !val.is_read && val.is_spam;});
        if (hamjsondmail.length) {
            debuglog("Found ham dmails!",jsondmail[0].id);
            CheckDmails.lastid = jsondmail[0].id;
            let hamdmailhtml = await $.get("/dmails", {search: {read: false},page: 'a' + dmaillastid});
            let $hamdmail = $(hamdmailhtml);
            $("tr.read-false", $hamdmail).css("font-weight","bold");
            $("#ham-dmail-table").append($(".striped",$hamdmail));
            $("#event-notice").show();
            $("#ham-dmail-section").show();
            localStorage['el-events'] = true;
        } else {
            debuglog("No ham dmails!");
        }
        if (spamjsondmail.length) {
            debuglog("Found spam dmails!",jsondmail[0].id);
            CheckDmails.lastid = jsondmail[0].id;
            let spamdmailhtml = await $.get("/dmails", {search: {read: false, is_spam: true},page: 'a' + dmaillastid});
            let $spamdmail = $(spamdmailhtml);
            $("tr.read-false", $spamdmail).css("font-weight","bold");
            $("#spam-dmail-table").append($(".striped",$spamdmail));
            $("#event-notice").show();
            $("#spam-dmail-section").show();
            localStorage['el-events'] = true;
        } else {
            debuglog("No spam dmails!");
        }
    } else {
        let jsondmail = await $.getJSON("/dmails", {limit: 1});
        if (jsondmail.length) {
            localStorage['el-dmaillastid'] = jsondmail[0].id;
        } else {
            localStorage['el-dmaillastid'] = 0;
        }
        debuglog("Set last dmail ID:",localStorage['el-dmaillastid']);
    }
}
CheckDmails.lastid = 0;

function InitializeNoticeBox() {
    $("#page").prepend(notice_box);
    $("#hide-event-notice").click((e)=>{
        $("#event-notice").hide();
        if (CheckFlags.lastid) {
            localStorage['el-flaglastid'] = CheckFlags.lastid;
            debuglog("Set last flag ID:",localStorage['el-flaglastid']);
        }
        if (CheckAppeals.lastid) {
            localStorage['el-appeallastid'] = CheckAppeals.lastid;
            debuglog("Set last appeal ID:",localStorage['el-appeallastid']);
        }
        if (CheckDmails.lastid) {
            localStorage['el-dmaillastid'] = CheckDmails.lastid;
            debuglog("Set last dmail ID:",localStorage['el-dmaillastid']);
            $("#hide-dmail-notice").click();
        }
        localStorage['el-events'] = false;
        e.preventDefault();
    });
}

function main() {
    username = Danbooru.meta('current-user-name');
    userid = Danbooru.meta('current-user-id');
    if (!username || !userid || isNaN(userid)) {
        debuglog("Invalid meta variables!");
        return;
    }
    userid = parseInt(userid);
    $("#dmail-notice").hide();
    InitializeNoticeBox();
    if (CheckTimeout() || HasEvents()) {
        SetTimeout();
        CheckDmails();
        CheckFlags();
        CheckAppeals();
    } else {
        debuglog("Waiting...");
    }
}

//Wait until program is ready before executing
function programLoad() {
    if (programLoad.retries >= program_load_max_retries) {
        debuglog("Abandoning program load!");
        clearInterval(programLoad.timer);
        return false;
    }
    if (window.jQuery === undefined) {
        debuglog("jQuery not installed yet!");
        programLoad.retries += 1;
        return false;
    }
    if (window.Danbooru === undefined) {
        debuglog("Danbooru not installed yet!");
        programLoad.retries += 1;
        return false;
    }
    clearInterval(programLoad.timer);
    main();
    debugTimeEnd("EL-programLoad");
    return true;
}
programLoad.retries = 0;

//Execution start

debugTime("EL-programLoad");
if (!programLoad()) {
    programLoad.timer = setInterval(programLoad,timer_poll_interval);
}
