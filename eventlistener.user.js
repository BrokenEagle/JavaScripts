// ==UserScript==
// @name         EventListener
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      5
// @source       https://danbooru.donmai.us/users/23799
// @description  Informs users of new events (flags,appeals,dmails,comments)
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
    <div id="comments-section"  class="comments-for-post" style="display:none">
        <h1>You've got comments!</h1>
        <div id="comments-table"></div>
    </div>
  <p><a href="#" id="hide-event-notice">Close this</a></p>
</div>
`;

//HTML for subscribe links
const comment_links = `
<li id="subscribe-comments" style="display:none !important"><a href="#">Subscribe Comments</a></li>
<li id="unsubscribe-comments" style="display:none !important"><a href="#">Unsubscribe Comments</a></li>
`;

const comment_css = `
#event-notice #comments-section #comments-table .preview {
    float: left;
    width: 154px;
    height: 154px;
    margin-right: 30px;
    overflow: hidden;
    text-align; center;
}
#event-notice #comments-section #comments-table .comment {
    margin-left: 184px;
    margin-bottom: 2em;
    word-wrap: break-word;
    padding: 5px;
    display: block;
}
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

function setCSSStyle(csstext) {
    var css_dom = document.createElement('style');
    css_dom.type = 'text/css';
    css_dom.innerHTML = csstext;
    document.head.appendChild(css_dom);
}

function FullHide(selector) {
    $(selector).attr('style','display: none !important');
}

function ClearHide(selector) {
    $(selector).attr('style','');
}

function GetSetCommentList(input = null) {
    if (!input) {
        if (!GetSetCommentList.list) {
            let commentlist = localStorage['el-commentlist'];
            if (commentlist) {
                GetSetCommentList.list = JSON.parse(commentlist);
            } else {
                GetSetCommentList.list = [];
            }
        }
        return GetSetCommentList.list;
    } else {
        let commentlist = GetSetCommentList();
        if (input[0] == '-') {
            commentlist = commentlist.filter((val)=>{return val != input.slice(1);});
        } else {
            commentlist.push(parseInt(input));
        }
        localStorage['el-commentlist'] = JSON.stringify(commentlist);
        GetSetCommentList.list = commentlist;
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

function HideNonsubscribeComments($comments) {
    let commentlist = GetSetCommentList();
    $(".post-preview",$comments).addClass("blacklisted");
    $(".edit_comment",$comments).hide();
    $.each($(".post-preview",$comments), (i,entry)=>{
        let $entry = $(entry);
        if (commentlist.indexOf($entry.data('id')) < 0) {
            $entry.addClass("blacklisted-active");
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
            CheckFlags.hasevents = true;
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
    CheckFlags.isdone = true;
}
CheckFlags.lastid = 0;
CheckFlags.hasevents = false;
CheckFlags.isdone = false;

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
            CheckAppeals.hasevents = true;
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
    CheckAppeals.isdone = true;
}
CheckAppeals.lastid = 0;
CheckAppeals.hasevents = false;
CheckAppeals.isdone = false;

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
            CheckDmails.hasevents = true;
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
            CheckDmails.hasevents = true;
        } else {
            debuglog("No spam dmails!");
        }
        if (!hamjsondmail.length && !spamjsondmail.length && jsondmail.length && (dmaillastid !== jsondmail[0].id.toString())) {
            localStorage['el-dmaillastid'] = jsondmail[0].id;
            debuglog("Setting DMail last ID:",localStorage['el-dmaillastid']);
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
    CheckDmails.isdone = true;
}
CheckDmails.lastid = 0;
CheckDmails.hasevents = false;
CheckDmails.isdone = false;

async function CheckComments() {
    let commentlastid = localStorage['el-commentlastid'];
    let commentlist = GetSetCommentList();
    if (commentlastid) {
        var jsoncomments = [], subscribecomments = [];
        if (!localStorage['el-savedcommentlist']) {
            let tempcomments;
            while (true) {
                tempcomments = jsoncomments;
                jsoncomments = await $.getJSON("/comments", {group_by: 'comment', page: 'a' + commentlastid, limit: display_limit});
                subscribecomments = jsoncomments.filter((val)=>{return (val.creator_id !== userid) && (commentlist.indexOf(val.post_id) >= 0);}).concat(subscribecomments);
                if (jsoncomments.length === display_limit) {
                    commentlastid = jsoncomments[0].id.toString();
                    debuglog("Rechecking @",commentlastid);
                    continue;
                } else if (jsoncomments.length === 0) {
                    jsoncomments = tempcomments;
                }
                break;
            }
            if (subscribecomments.length) {
                subscribecomments = subscribecomments.map((val)=>{return val.id;});
                localStorage['el-savedcommentlist'] = JSON.stringify(subscribecomments);
            }
            if (jsoncomments.length) {
                jsoncomments = [jsoncomments[0].id];
                localStorage['el-savedcommentlastid'] = JSON.stringify(jsoncomments);
            }
        } else {
            subscribecomments = JSON.parse(localStorage['el-savedcommentlist']);
            jsoncomments = JSON.parse(localStorage['el-savedcommentlastid']);
        }
        if (subscribecomments.length) {
            debuglog("Found comments!",jsoncomments[0]);
            CheckComments.lastid = jsoncomments[0];
            let commentshtml = await $.get("/comments", {group_by: 'comment', search: {id: subscribecomments.join(',')}, limit: subscribecomments.length});
            let $comments = $(commentshtml);
            HideNonsubscribeComments($comments);
            $("#comments-table").append($(".list-of-comments",$comments));
            $("#event-notice").show();
            $("#comments-section").show();
            CheckComments.hasevents = true;
        } else {
            debuglog("No comments!");
            if (jsoncomments.length && (localStorage['el-commentlastid'] !== jsoncomments[0].toString())) {
                localStorage['el-commentlastid'] = jsoncomments[0];
                debuglog("Setting comment last ID:",localStorage['el-commentlastid']);
            }
        }
    } else {
        let jsoncomment = await $.getJSON("/comments", {group_by: 'comment', limit: 1});
        if (jsoncomment.length) {
            localStorage['el-commentlastid'] = jsoncomment[0].id;
        } else {
            localStorage['el-commentlastid'] = 0;
        }
        debuglog("Set comment last ID:",localStorage['el-commentlastid']);
    }
    CheckComments.isdone = true;
}
CheckComments.lastid = 0;
CheckComments.hasevents = false;
CheckComments.isdone = false;

function CheckAllEvents() {
    if (CheckFlags.isdone && CheckAppeals.isdone && CheckDmails.isdone && CheckComments.isdone) {
        clearInterval(CheckAllEvents.timer);
        if (CheckFlags.hasevents || CheckAppeals.hasevents || CheckDmails.hasevents || CheckComments.hasevents) {
            localStorage['el-events'] = true;
        } else {
            localStorage['el-events'] = false;
        }
    }
}

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
        if (CheckComments.lastid) {
            localStorage['el-commentlastid'] = CheckComments.lastid;
            debuglog("Set last comment ID:",localStorage['el-commentlastid']);
            delete localStorage['el-savedcommentlist'];
            delete localStorage['el-savedcommentlastid'];
            debuglog("Deleted saved values!");
        }
        localStorage['el-events'] = false;
        e.preventDefault();
    });
}

function InitializeCommentSubscribe() {
    $("#nav > menu:nth-child(2)").append(comment_links);
    SubscribeCommentsClick();
    UnsubscribeCommentsClick();
    let commentlist = GetSetCommentList();
    let postid = parseInt(Danbooru.meta('post-id'));
    if (commentlist.indexOf(postid) < 0) {
        ClearHide("#subscribe-comments");
    } else {
        ClearHide("#unsubscribe-comments");
    }
}

function SubscribeCommentsClick() {
    $("#subscribe-comments a").click((e)=>{
        GetSetCommentList(Danbooru.meta('post-id'));
        FullHide("#subscribe-comments");
        ClearHide("#unsubscribe-comments");
    });
}

function UnsubscribeCommentsClick() {
    $("#unsubscribe-comments a").click((e)=>{
        GetSetCommentList('-' + Danbooru.meta('post-id'));
        FullHide("#unsubscribe-comments");
        ClearHide$("#subscribe-comments");
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
        if (GetSetCommentList().length) {
            setCSSStyle(comment_css);
            CheckComments();
        } else {
            CheckComments.isdone = true;
        }
        CheckAllEvents.timer = setInterval(CheckAllEvents,timer_poll_interval);
    } else {
        debuglog("Waiting...");
    }
    if ($("#c-posts #a-show").length) {
        InitializeCommentSubscribe();
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
