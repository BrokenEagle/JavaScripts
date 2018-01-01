// ==UserScript==
// @name         EventListener
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      7
// @source       https://danbooru.donmai.us/users/23799
// @description  Informs users of new events (flags,appeals,dmails,comments,forums)
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/eventlistener.user.js
// ==/UserScript==

/****Global variables****/

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
    <div id="forums-section"  style="display:none">
        <h1>You've got forums!</h1>
        <div id="forums-table"></div>
    </div>
    <div id="comments-section"  class="comments-for-post" style="display:none">
        <h1>You've got comments!</h1>
        <div id="comments-table"></div>
    </div>
    <div id="spam-dmail-section"  style="display:none">
        <h1>You've got spam!</h1>
        <div id="spam-dmail-table"></div>
    </div>
    <p><a href="#" id="hide-event-notice">Close this</a></p>
</div>
`;

//Program CSS
const eventlistener_css = `
#c-comments #a-index #p-index-by-post .subscribe-comments,
#c-comments #a-index #p-index-by-post .unsubscribe-comments {
    margin: 1em 0;
}
#c-comments #a-index #p-index-by-comment table,
#event-notice #comments-section #comments-table table {
    float: left;
    text-align: center;
}
#c-comments #a-index #p-index-by-comment .preview,
#event-notice #comments-section #comments-table .preview {
    margin-right: 0;
}
.striped .subscribe-topic a,
.striped .unsubscribe-topic,
#event-notice .show-full-forum,
#event-notice .hide-full-forum,
#event-notice .show-full-dmail,
#event-notice .hide-full-dmail {
    font-family: monospace;
}
`;

//Fix for showing comments
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

//Fix for showing forum posts
const forum_css = `
#event-notice #forums-section #forums-table .author {
    padding: 1em 1em 0 1em;
    width: 12em;
    float: left;
}
#event-notice #forums-section #forums-table .content {
    padding: 1em;
    margin-left: 14em;
}`;

/****Helper functions****/

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

function GetCommentList() {
    let commentlist = localStorage['el-commentlist'];
    if (commentlist) {
        return JSON.parse(commentlist);
    } else {
        return [];
    }
}

function SetCommentList(input) {
    let commentlist = GetCommentList();
    if (input[0] == '-') {
        commentlist = commentlist.filter((val)=>{return val != input.slice(1);});
    } else {
        commentlist.push(parseInt(input));
    }
    commentlist = $.unique(commentlist);
    localStorage['el-commentlist'] = JSON.stringify(commentlist);
}

function GetForumList() {
    let forumlist = localStorage['el-forumlist'];
    if (forumlist) {
        return JSON.parse(forumlist);
    } else {
        return [];
    }
}

function SetForumList(input) {
    let forumlist = GetForumList();
    if (input[0] == '-') {
        forumlist = forumlist.filter((val)=>{return val != input.slice(1);});
    } else {
        forumlist.push(parseInt(input));
    }
    forumlist = $.unique(forumlist);
    localStorage['el-forumlist'] = JSON.stringify(forumlist);
}

function SaveLastID(key,lastid) {
    let previousid = localStorage[key];
    if (previousid) {
        lastid = Math.max(parseInt(previousid),lastid);
    }
    localStorage[key] = lastid;
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

function SetRecheckTimeout() {
    localStorage['el-timeout'] = Date.now() + recheck_event_interval;
}

async function AddForumPost(forumid,$rowelement) {
    let forum_post = await $.get(`/forum_posts/${forumid}`);
    let $forum_post = $.parseHTML(forum_post);
    let $outerblock = $.parseHTML(`<tr id="full-forum-id-${forumid}"><td colspan="4"></td></tr>`);
    $("td",$outerblock).append($(".forum-post",$forum_post));
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

/****Main execution functions****/

async function CheckFlags() {
    let flaglastid = localStorage['el-flaglastid'];
    if (flaglastid) {
        let jsonflag = await $.getJSON("/post_flags", {search: {category: 'normal',post_tags_match: "user:" + username},page: 'a' + flaglastid,limit: display_limit});
        jsonflag = jsonflag.filter((val)=>{return !('creator_id' in val);});
        if (jsonflag.length) {
            debuglog("Found flags!",jsonflag[0].id);
            CheckFlags.lastid = jsonflag[0].id;
            let flaglist = jsonflag.map((val)=>{return val.id;});
            let flaghtml = await $.get("/post_flags", {search: {id: flaglist.join(',')}, limit: flaglist.length});
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
            SaveLastID('el-flaglastid',jsonflag[0].id);
        } else {
            SaveLastID('el-flaglastid',0);
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
        let jsonappeal = await $.getJSON("/post_appeals", {search: {post_tags_match: "user:" + username},page: 'a' + appeallastid,limit: display_limit});
        jsonappeal = jsonappeal.filter((val)=>{return val.creator_id !== userid;});
        if (jsonappeal.length) {
            debuglog("Found appeals!",jsonappeal[0].id);
            CheckAppeals.lastid = jsonappeal[0].id;
            let appeallist = jsonappeal.map((val)=>{return val.id;});
            let appealhtml = await $.get("/post_appeals", {search: {id: appeallist.join(',')}, limit: appeallist.length});
            let $appeal = $(appealhtml);
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
            SaveLastID('el-appeallastid',jsonappeal[0].id);
        } else {
            SaveLastID('el-appeallastid',0);
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
            let $dmails_table = $("#ham-dmail-table");
            InitializeOpenDmailLinks($dmails_table);
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
            let $dmails_table = $("#spam-dmail-table");
            InitializeOpenDmailLinks($dmails_table);
            $("#event-notice").show();
            $("#spam-dmail-section").show();
            CheckDmails.hasevents = true;
        } else {
            debuglog("No spam dmails!");
        }
        if (!hamjsondmail.length && !spamjsondmail.length && jsondmail.length && (dmaillastid !== jsondmail[0].id.toString())) {
            SaveLastID('el-dmaillastid',jsondmail[0].id);
            debuglog("Setting DMail last ID:",localStorage['el-dmaillastid']);
        }
    } else {
        let jsondmail = await $.getJSON("/dmails", {limit: 1});
        if (jsondmail.length) {
            SaveLastID('el-dmaillastid',jsondmail[0].id);
        } else {
            SaveLastID('el-dmaillastid',0);
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
    let commentlist = GetCommentList();
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
                localStorage['el-savedcommentlist'] = JSON.stringify(subscribecomments.map((val)=>{return {id:val.id,post:val.post_id};}));
                subscribecomments = subscribecomments.map((val)=>{return val.id;});
            }
            if (jsoncomments.length) {
                jsoncomments = [jsoncomments[0].id];
                localStorage['el-savedcommentlastid'] = JSON.stringify(jsoncomments);
            }
        } else {
            subscribecomments = JSON.parse(localStorage['el-savedcommentlist']);
            subscribecomments = subscribecomments.filter(value=>{return commentlist.indexOf(value.post) >= 0;});
            jsoncomments = JSON.parse(localStorage['el-savedcommentlastid']);
            if (!subscribecomments.length) {
                debuglog("Deleting saved comment values");
                delete localStorage['el-savedcommentlist'];
                delete localStorage['el-savedcommentlastid'];
            } else {
                subscribecomments = subscribecomments.map((val)=>{return val.id;});
            }
        }
        if (subscribecomments.length) {
            debuglog("Found comments!",jsoncomments[0]);
            CheckComments.lastid = jsoncomments[0];
            let commentshtml = await $.get("/comments", {group_by: 'comment', search: {id: subscribecomments.join(',')}, limit: subscribecomments.length});
            let $comments = $(commentshtml);
            $(".post-preview",$comments).addClass("blacklisted");
            $(".edit_comment",$comments).hide();
            $("#comments-table").append($(".list-of-comments",$comments));
            InitializeEventNoticeCommentLinks();
            $("#event-notice").show();
            $("#comments-section").show();
            CheckComments.hasevents = true;
        } else {
            debuglog("No comments!");
            if (jsoncomments.length && (localStorage['el-commentlastid'] !== jsoncomments[0].toString())) {
                SaveLastID('el-commentlastid',jsoncomments[0]);
                debuglog("Setting comment last ID:",localStorage['el-commentlastid']);
            }
        }
    } else {
        let jsoncomment = await $.getJSON("/comments", {group_by: 'comment', limit: 1});
        if (jsoncomment.length) {
            SaveLastID('el-commentlastid',jsoncomment[0].id);
        } else {
            SaveLastID('el-commentlastid',0);
        }
        debuglog("Set comment last ID:",localStorage['el-commentlastid']);
    }
    CheckComments.isdone = true;
}
CheckComments.lastid = 0;
CheckComments.hasevents = false;
CheckComments.isdone = false;

async function CheckForums() {
    let forumlastid = localStorage['el-forumlastid'];
    let forumlist = GetForumList();
    if (forumlastid) {
        var jsonforums = [], subscribeforums = [];
        if (!localStorage['el-savedforumlist']) {
            let tempforums;
            while (true) {
                tempforums = jsonforums;
                jsonforums = await $.getJSON("/forum_posts", {page: 'a' + forumlastid, limit: display_limit});
                subscribeforums = jsonforums.filter((val)=>{return (val.creator_id !== userid) && (forumlist.indexOf(val.topic_id) >= 0);}).concat(subscribeforums);
                if (jsonforums.length === display_limit) {
                    forumlastid = jsonforums[0].id.toString();
                    debuglog("Rechecking @",forumlastid);
                    continue;
                } else if (jsonforums.length === 0) {
                    jsonforums = tempforums;
                }
                break;
            }
            if (subscribeforums.length) {
                localStorage['el-savedforumlist'] = JSON.stringify(subscribeforums.map((val)=>{return {id:val.id,topic:val.topic_id};}));
                subscribeforums = subscribeforums.map((val)=>{return val.id;});
            }
            if (jsonforums.length) {
                jsonforums = [jsonforums[0].id];
                localStorage['el-savedforumlastid'] = JSON.stringify(jsonforums);
            }
        } else {
            subscribeforums = JSON.parse(localStorage['el-savedforumlist']);
            subscribeforums = subscribeforums.filter(value=>{return forumlist.indexOf(value.topic) >= 0;});
            jsonforums = JSON.parse(localStorage['el-savedforumlastid']);
            if (!subscribeforums.length) {
                debuglog("Deleting saved forum values");
                delete localStorage['el-savedforumlist'];
                delete localStorage['el-savedforumlastid'];
            } else {
                subscribeforums = subscribeforums.map((val)=>{return val.id;});
            }
        }
        if (subscribeforums.length) {
            debuglog("Found forums!",jsonforums[0]);
            CheckForums.lastid = jsonforums[0];
            let forumshtml = await $.get("/forum_posts", {search: {id: subscribeforums.join(',')}, limit: subscribeforums.length});
            let $forums = $(forumshtml);
            let $forums_table = $("#forums-table");
            $forums_table.append($(".striped",$forums));
            InitializeTopicIndexLinks($forums_table);
            InitializeOpenForumLinks($forums_table);
            $("#event-notice").show();
            $("#forums-section").show();
            CheckForums.hasevents = true;
        } else {
            debuglog("No forums!");
            if (jsonforums.length && (localStorage['el-forumlastid'] !== jsonforums[0].toString())) {
                SaveLastID('el-forumlastid',jsonforums[0]);
                debuglog("Setting forum last ID:",localStorage['el-forumlastid']);
            }
        }
    } else {
        let jsonforum = await $.getJSON("/forum_posts", {limit: 1});
        if (jsonforum.length) {
            SaveLastID('el-forumlastid',jsonforum[0].id);
        } else {
            SaveLastID('el-forumlastid',0);
        }
        debuglog("Set forum last ID:",localStorage['el-forumlastid']);
    }
    CheckForums.isdone = true;
}
CheckForums.lastid = 0;
CheckForums.hasevents = false;
CheckForums.isdone = false;

/****Callback functions****/

function CheckAllEvents() {
    if (CheckFlags.isdone && CheckAppeals.isdone && CheckDmails.isdone && CheckComments.isdone && CheckForums.isdone) {
        clearInterval(CheckAllEvents.timer);
        if (CheckFlags.hasevents || CheckAppeals.hasevents || CheckDmails.hasevents || CheckComments.hasevents || CheckForums.hasevents) {
            localStorage['el-events'] = true;
        } else {
            localStorage['el-events'] = false;
        }
    }
}

/****Render functions****/

function RenderCommentPartialPostLinks(postid,tag,separator) {
    let commentlist = GetCommentList();
    let subscribe = (commentlist.indexOf(postid) < 0 ? "style": 'style="display:none !important"');
    let unsubscribe = (commentlist.indexOf(postid) < 0 ? 'style="display:none !important"' : "style");
    return `<${tag} data-post-id="${postid}" class="subscribe-comments" ${subscribe}><a href="#">Subscribe${separator}comments</a></${tag}>` +
           `<${tag} data-post-id="${postid}" class="unsubscribe-comments" ${unsubscribe}"><a href="#">Unsubscribe${separator}comments</a></${tag}>`;
}

function RenderForumTopicLinks(topicid,tag,ender,right=false) {
    let forumlist = GetForumList();
    let subscribe = (forumlist.indexOf(topicid) < 0 ? "style": 'style="display:none !important"');
    let unsubscribe = (forumlist.indexOf(topicid) < 0 ? 'style="display:none !important"' : "style");
    let spacer = (right ? "&nbsp;&nbsp;" : "");
    return `<${tag} data-topic-id="${topicid}" class="subscribe-topic" ${subscribe}><a href="#">${spacer}Subscribe${ender}</a></${tag}>` +
           `<${tag} data-topic-id="${topicid}" class="unsubscribe-topic" ${unsubscribe}"><a href="#">Unsubscribe${ender}</a></${tag}>`;
}

function RenderOpenForumLinks(forumid) {
    return `<span data-forum-id="${forumid}" class="show-full-forum" style><a href="#">Show</a></span>` +
           `<span data-forum-id="${forumid}" class="hide-full-forum" style="display:none !important"><a href="#">Hide</a></span>&nbsp;|&nbsp;`;
}

function RenderOpenDmailLinks(dmailid) {
    return `<span data-dmail-id="${dmailid}" class="show-full-dmail" style><a href="#">Show</a></span>` +
           `<span data-dmail-id="${dmailid}" class="hide-full-dmail" style="display:none !important"><a href="#">Hide</a></span>&nbsp;|&nbsp;`;
}

/****Initialize functions****/

function InitializeNoticeBox() {
    $("#page").prepend(notice_box);
    HideEventNoticeClick();
}

function InitializeOpenForumLinks($obj) {
    $.each($(".striped tbody tr",$obj),(i,$row)=>{
        let forumid = $row.id.match(/(\d+)$/)[1];
        $(".forum-post-excerpt",$row).prepend(RenderOpenForumLinks(forumid));
    });
    ShowFullForumClick($obj);
    HideFullForumClick($obj);
}

function InitializeOpenDmailLinks($obj) {
    $.each($(".striped tbody tr",$obj),(i,$row)=>{
        let dmailid = $row.innerHTML.match(/\/dmails\/(\d+)/)[1];
        $("td:nth-of-type(4)",$row).prepend(RenderOpenDmailLinks(dmailid));
    });
    ShowFullDmailClick($obj);
    HideFullDmailClick($obj);
}

function InitializePostCommentLinks() {
    var postid = parseInt(Danbooru.meta('post-id'));
    $("#nav > menu:nth-child(2)").append(RenderCommentPartialPostLinks(postid,"li"," "));
    SubscribeCommentsClick();
    UnsubscribeCommentsClick();
}

function InitializeTopicShowLinks() {
    var topicid = parseInt($("#forum_post_topic_id").attr("value"));
    if (!topicid) {
        let $obj = $('a[href$="/subscribe"],a[href$="/unsubscribe"]');
        let match = $obj.attr("href").match(/\/forum_topics\/(\d+)\/(?:un)?subscribe/);
        if (!match) {
            return;
        }
        topicid = parseInt(match[1]);
    }
    $("#nav > menu:nth-child(2)").append(RenderForumTopicLinks(topicid,"li"," topic"));
    SubscribeTopicClick();
    UnsubscribeTopicClick();
}

function InitializeTopicIndexLinks($obj) {
    $.each($(".striped tr td:first-of-type",$obj), (i,entry)=>{
        let topicid = parseInt(entry.innerHTML.match(/\/forum_topics\/(\d+)/)[1]);
        $(entry).prepend(RenderForumTopicLinks(topicid,"span","",true)+'&nbsp|&nbsp');
    });
    SubscribeTopicClick();
    UnsubscribeTopicClick();
}

function InitializeCommentPartialPostLinks() {
    $.each($("#p-index-by-post .comments-for-post"), (i,$entry)=>{
        let postid = parseInt($($entry).data('post-id'));
        $(".header",$entry).after(RenderCommentPartialPostLinks(postid,"div"," "));
    });
    SubscribeCommentsClick();
    UnsubscribeCommentsClick();
}

function InitializeCommentPartialCommentLinks() {
    $.each($("#p-index-by-comment .post-preview"), (i,$entry)=>{
        var postid = parseInt($($entry).data('id'));
        var linkhtml = RenderCommentPartialPostLinks(postid,"div","<br>");
        var $table = $.parseHTML(`<table><tbody><tr><td></td></tr><tr><td>${linkhtml}</td></tr></tbody></table>`);
        var $preview = $(".preview",$entry).detach();
        $("tr:nth-of-type(1) td",$table).append($preview);
        $entry.prepend($table[0]);
    });
    SubscribeCommentsClick();
    UnsubscribeCommentsClick();
}

function InitializeEventNoticeCommentLinks() {
    $.each($("#event-notice .post-preview"), (i,$entry)=>{
        var postid = parseInt($($entry).data('id'));
        var linkhtml = RenderCommentPartialPostLinks(postid,"div","<br>");
        var $table = $.parseHTML(`<table><tbody><tr><td></td></tr><tr><td>${linkhtml}</td></tr></tbody></table>`);
        var $preview = $(".preview",$entry).detach();
        $("tr:nth-of-type(1) td",$table).append($preview);
        $entry.prepend($table[0]);
    });
    SubscribeCommentsClick();
    UnsubscribeCommentsClick();
}

/****Click functions****/

function HideEventNoticeClick() {
    $("#hide-event-notice").click((e)=>{
        $("#event-notice").hide();
        if (CheckFlags.lastid) {
            SaveLastID('el-flaglastid',CheckFlags.lastid);
            debuglog("Set last flag ID:",localStorage['el-flaglastid']);
        }
        if (CheckAppeals.lastid) {
            SaveLastID('el-appeallastid',CheckAppeals.lastid);
            debuglog("Set last appeal ID:",localStorage['el-appeallastid']);
        }
        if (CheckDmails.lastid) {
            SaveLastID('el-dmaillastid',CheckDmails.lastid);
            debuglog("Set last dmail ID:",localStorage['el-dmaillastid']);
            $("#hide-dmail-notice").click();
        }
        if (CheckComments.lastid) {
            SaveLastID('el-commentlastid',CheckComments.lastid);
            debuglog("Set last comment ID:",localStorage['el-commentlastid']);
            delete localStorage['el-savedcommentlist'];
            delete localStorage['el-savedcommentlastid'];
            debuglog("Deleted saved values!");
        }
        if (CheckForums.lastid) {
            SaveLastID('el-forumlastid',CheckForums.lastid);
            debuglog("Set last comment ID:",localStorage['el-forumlastid']);
            delete localStorage['el-savedforumlist'];
            delete localStorage['el-savedforumlastid'];
            debuglog("Deleted saved values!");
        }
        localStorage['el-events'] = false;
        e.preventDefault();
    });
}

function SubscribeCommentsClick() {
    $(".subscribe-comments a").off().click((e)=>{
        let post = $(e.target.parentElement).data('post-id');
        setTimeout(()=>{SetCommentList(post);},1);
        FullHide(`.subscribe-comments[data-post-id=${post}]`);
        ClearHide(`.unsubscribe-comments[data-post-id=${post}]`);
        e.preventDefault();
    });
}

function UnsubscribeCommentsClick() {
    $(".unsubscribe-comments a").off().click((e)=>{
        let post = $(e.target.parentElement).data('post-id');
        setTimeout(()=>{SetCommentList('-' + post);},1);
        FullHide(`.unsubscribe-comments[data-post-id=${post}]`);
        ClearHide(`.subscribe-comments[data-post-id=${post}]`);
        e.preventDefault();
    });
}

function SubscribeTopicClick() {
    $(".subscribe-topic a").off().click((e)=>{
        let topic = $(e.target.parentElement).data('topic-id');
        console.log("topic");
        setTimeout(()=>{SetForumList(topic);},1);
        FullHide(`.subscribe-topic[data-topic-id=${topic}]`);
        ClearHide(`.unsubscribe-topic[data-topic-id=${topic}]`);
        e.preventDefault();
    });
}

function UnsubscribeTopicClick() {
    $(".unsubscribe-topic a").off().click((e)=>{
        let topic = $(e.target.parentElement).data('topic-id');
        console.log("topic",topic);
        setTimeout(()=>{SetForumList('-' + topic);},1);
        FullHide(`.unsubscribe-topic[data-topic-id=${topic}]`);
        ClearHide(`.subscribe-topic[data-topic-id=${topic}]`);
        e.preventDefault();
    });
}

function ShowFullForumClick($obj) {
    $(".show-full-forum a").off().click(function(e){
        let forumid = $(e.target.parentElement).data('forum-id');
        console.log(forumid);
        if (ShowFullForumClick.openlist.indexOf(forumid) < 0) {
            let $rowelement = e.target.parentElement.parentElement.parentElement;
            AddForumPost(forumid,$rowelement);
            ShowFullForumClick.openlist.push(forumid);
        }
        FullHide(`.show-full-forum[data-forum-id=${forumid}]`);
        ClearHide(`.hide-full-forum[data-forum-id=${forumid}]`);
        $(`#full-forum-id-${forumid}`).show();
        e.preventDefault();
    });
}
ShowFullForumClick.openlist = [];

function HideFullForumClick($obj) {
    $(".hide-full-forum a").off().click(function(e){
        let forumid = $(e.target.parentElement).data('forum-id');
        console.log(forumid);
        FullHide(`.hide-full-forum[data-forum-id=${forumid}]`);
        ClearHide(`.show-full-forum[data-forum-id=${forumid}]`);
        $(`#full-forum-id-${forumid}`).hide();
        e.preventDefault();
    });
}

function ShowFullDmailClick($obj) {
    $(".show-full-dmail a").off().click(function(e){
        let dmailid = $(e.target.parentElement).data('dmail-id');
        console.log(dmailid);
        if (ShowFullDmailClick.openlist.indexOf(dmailid) < 0) {
            let $rowelement = e.target.parentElement.parentElement.parentElement;
            AddDmail(dmailid,$rowelement);
            ShowFullDmailClick.openlist.push(dmailid);
        }
        FullHide(`.show-full-dmail[data-dmail-id=${dmailid}]`);
        ClearHide(`.hide-full-dmail[data-dmail-id=${dmailid}]`);
        $(`#full-dmail-id-${dmailid}`).show();
        e.preventDefault();
    });
}
ShowFullDmailClick.openlist = [];

function HideFullDmailClick($obj) {
    $(".hide-full-dmail a").off().click(function(e){
        let dmailid = $(e.target.parentElement).data('dmail-id');
        console.log(dmailid);
        FullHide(`.hide-full-dmail[data-dmail-id=${dmailid}]`);
        ClearHide(`.show-full-dmail[data-dmail-id=${dmailid}]`);
        $(`#full-dmail-id-${dmailid}`).hide();
        e.preventDefault();
    });
}

/****Main****/

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
        SetRecheckTimeout();
        CheckDmails();
        CheckFlags();
        CheckAppeals();
        if (GetCommentList().length) {
            setCSSStyle(comment_css);
            CheckComments();
        } else {
            CheckComments.isdone = true;
        }
        if (GetForumList().length) {
            setCSSStyle(forum_css);
            CheckForums();
        } else {
            CheckForums.isdone = true;
        }
        CheckAllEvents.timer = setInterval(CheckAllEvents,timer_poll_interval);
    } else {
        debuglog("Waiting...");
    }
    if ($("#c-posts #a-show").length) {
        InitializePostCommentLinks();
    } else if ($("#c-comments #a-index #p-index-by-post").length) {
        InitializeCommentPartialPostLinks();
    } else if ($("#c-comments #a-index #p-index-by-comment").length) {
        InitializeCommentPartialCommentLinks();
    }
    if ($("#c-forum-topics #a-show").length) {
        InitializeTopicShowLinks();
        $('a[href$="/subscribe"]').text("Subscribe email");
        $('a[href$="/unsubscribe"]').text("Unsubscribe email");
    } else if ($("#c-forum-topics #a-index,#c-forum-posts #a-index").length) {
        InitializeTopicIndexLinks(document);
    }
    setCSSStyle(eventlistener_css);
}

/****Program load****/

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

/****Execution start****/

debugTime("EL-programLoad");
if (!programLoad()) {
    programLoad.timer = setInterval(programLoad,timer_poll_interval);
}
