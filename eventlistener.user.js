// ==UserScript==
// @name         EventListener
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      9
// @source       https://danbooru.donmai.us/users/23799
// @description  Informs users of new events (flags,appeals,dmails,comments,forums,notes)
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/eventlistener.user.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180421/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180421/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180421/lib/utility.js
// ==/UserScript==

/****Global variables****/

//Variables for debug.js
JSPLib.debug.debug_console = true;

//Variables for load.js
const program_load_required_variables = ['window.jQuery','window.Danbooru'];

//Polling interval for checking program status
const timer_poll_interval = 100;

//The default number of items displayed per page
const display_limit = 20;

//The max number of items to grab with each network call
const query_limit = 100;

//Minimum amount of time between rechecks in milliseconds
const recheck_event_interval = 1000 * 60;

//Controller lookup values
const controller_dict = {
    flag: 'post_flags',
    appeal: 'post_appeals',
    dmail: 'dmails',
    comment: 'comments',
    forum: 'forum_posts',
    note: 'note_versions'
};

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
    <div id="notes-section"  style="display:none">
        <h1>You've got notes!</h1>
        <div id="notes-table"></div>
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
.striped .subscribe-topic,
.striped .unsubscribe-topic,
.striped .subscribe-notes,
.striped .unsubscribe-notes,
#event-notice .show-full-forum,
#event-notice .hide-full-forum,
#event-notice .show-full-dmail,
#event-notice .hide-full-dmail,
#event-notice .show-rendered-note,
#event-notice .hide-rendered-note {
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

function FullHide(selector) {
    $(selector).attr('style','display: none !important');
}

function ClearHide(selector) {
    $(selector).attr('style','');
}

function DanbooruArrayMaxID(array) {
    return ValuesMax(GetObjectAttributes(array,'id'));
}

function GetObjectAttributes(array,attribute) {
    return array.map(val=>{return val[attribute];});
}

function ValuesMax(array) {
    return array.reduce(function(a, b) { return Math.max(a,b); });
}

function ValuesMin(array) {
    return array.reduce(function(a, b) { return Math.min(a,b); });
}

async function GetAllDanbooru(type,limit,options) {
    var url_addons = options.addons || {};
    var reverse = options.reverse || false;
    var ChoooseID = (reverse ? ValuesMax : ValuesMin);
    var page_modifier = (reverse ? 'a' : 'b');
    var page_addon = (options.page ? {page:`${page_modifier}${options.page}`} : {});
    var limit_addon = {limit: limit};
    var return_items = [];
    while (true) {
        let request_addons = Object.assign({},url_addons,page_addon,limit_addon);
        let request_key = $.param(request_addons);
        JSPLib.debug.recordTime(request_key,'Network');
        let temp_items = await $.getJSON(`/${type}`,request_addons);
        JSPLib.debug.recordTimeEnd(request_key,'Network');
        return_items = return_items.concat(temp_items);
        if (temp_items.length < limit) {
            return return_items;
        }
        let lastid = ChoooseID(GetObjectAttributes(temp_items,'id'));
        page_addon = {page:`${page_modifier}${lastid}`};
        JSPLib.debug.debuglog("Rechecking",type,"@",lastid);
    }
}

async function SetRecentDanbooruID(type,useritem=false) {
    let controller = controller_dict[type];
    let jsonitem = await $.getJSON(`/${controller}`, {limit: 1});
    if (jsonitem.length) {
        SaveLastID(type,DanbooruArrayMaxID(jsonitem));
    } else if (useritem) {
        SaveLastID(type,0);
    }
}

//Data storage functions

function GetList(type) {
    let typelist = localStorage.getItem(`el-${type}list`);
    if (typelist) {
        try {
            return JSON.parse(typelist);
        } catch (e) {
            //Swallow exception
        }
    }
    return [];
}

function SetList(type,input) {
    let typelist = GetList(type);
    if (input[0] == '-') {
        typelist = JSPLib.utility.setDifference(typelist,[parseInt(input.slice(1))]);
    } else {
        typelist.push(parseInt(input));
    }
    typelist = JSPLib.utility.setUnique(typelist);
    localStorage.setItem(`el-${type}list`,JSON.stringify(typelist));
}

function SaveLastID(type,lastid) {
    let key = `el-${type}lastid`;
    let previousid = localStorage.getItem(key);
    if (previousid) {
        lastid = Math.max(parseInt(previousid),lastid);
    }
    localStorage.setItem(key,lastid);
    JSPLib.debug.debuglog(`Set last ${type} ID:`,localStorage.getItem(key));
}

function CheckTimeout() {
    let timeout = localStorage.getItem('el-timeout');
    if (timeout === null || isNaN(timeout) || (Date.now() > parseInt(timeout))) {
        return true;
    }
    return false;
}

function HasEvents() {
    if (localStorage.getItem('el-events') === "true") {
        return true;
    }
    return false;
}

function SetRecheckTimeout() {
    localStorage.setItem('el-timeout',Date.now() + recheck_event_interval);
}

async function AddForumPost(forumid,$rowelement) {
    let forum_post = await $.get(`/forum_posts/${forumid}`);
    let $forum_post = $.parseHTML(forum_post);
    let $outerblock = $.parseHTML(`<tr id="full-forum-id-${forumid}"><td colspan="4"></td></tr>`);
    $("td",$outerblock).append($(".forum-post",$forum_post));
    $($rowelement).after($outerblock);
}

function AddRenderedNote(noteid,$rowelement) {
    let notehtml = $.parseHTML($.trim($("td:nth-of-type(4)",$rowelement)[0].innerHTML))[0].data;
    let $outerblock = $.parseHTML(`<tr id="rendered-note-id-${noteid}"><td colspan="7">${notehtml}</td></tr>`);
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
        let url_addons = {search: {category: 'normal',post_tags_match: "user:" + username}};
        let jsonflag = await GetAllDanbooru('post_flags',query_limit,{addons:url_addons,page:flaglastid,reverse:true});
        let otherjsonflag = jsonflag.filter((val)=>{return !('creator_id' in val);});
        if (otherjsonflag.length) {
            CheckFlags.lastid = DanbooruArrayMaxID(jsonflag);
            JSPLib.debug.debuglog("Found flags!",CheckFlags.lastid);
            let flaglist = GetObjectAttributes(otherjsonflag,'id');
            let flaghtml = await $.get("/post_flags", {search: {id: flaglist.join(',')}, limit: flaglist.length});
            let $flag = $(flaghtml);
            $("#flag-table").append($(".striped",$flag));
            $("#flag-table .post-preview").addClass("blacklisted");
            $("#event-notice").show();
            $("#flag-section").show();
            CheckFlags.hasevents = true;
        } else {
            JSPLib.debug.debuglog("No flags!");
        }
    } else {
        SetRecentDanbooruID('flag',true);
    }
    CheckFlags.isdone = true;
}
CheckFlags.lastid = 0;
CheckFlags.hasevents = false;
CheckFlags.isdone = false;

async function CheckAppeals() {
    let appeallastid = localStorage['el-appeallastid'];
    if (appeallastid) {
        let url_addons = {search: {post_tags_match: "user:" + username}};
        let jsonappeal = await GetAllDanbooru('post_appeals',query_limit,{addons:url_addons,page:appeallastid,reverse:true});
        otherjsonappeal = jsonappeal.filter((val)=>{return val.creator_id !== userid;});
        if (otherjsonappeal.length) {
            CheckAppeals.lastid = DanbooruArrayMaxID(jsonappeal);
            JSPLib.debug.debuglog("Found appeals!",CheckAppeals.lastid);
            let appeallist = GetObjectAttributes(otherjsonappeal,'id');
            let appealhtml = await $.get("/post_appeals", {search: {id: appeallist.join(',')}, limit: appeallist.length});
            let $appeal = $(appealhtml);
            $("#appeal-table").append($(".striped",$appeal));
            $("#appeal-table .post-preview").addClass("blacklisted");
            $("#event-notice").show();
            $("#appeal-section").show();
            CheckAppeals.hasevents = true;
        } else {
            JSPLib.debug.debuglog("No appeals!");
        }
    } else {
        SetRecentDanbooruID('appeal',true);
    }
    CheckAppeals.isdone = true;
}
CheckAppeals.lastid = 0;
CheckAppeals.hasevents = false;
CheckAppeals.isdone = false;

async function CheckDmails() {
    let dmaillastid = localStorage['el-dmaillastid'];
    if (dmaillastid) {
        let jsondmail = await GetAllDanbooru('dmails',query_limit,{page:dmaillastid,reverse:true});
        let hamjsondmail = jsondmail.filter((val)=>{return !val.is_read && !val.is_spam;});
        let spamjsondmail = jsondmail.filter((val)=>{return !val.is_read && val.is_spam;});
        if (jsondmail.length) {
            CheckDmails.lastid = DanbooruArrayMaxID(jsondmail);
        }
        if (hamjsondmail.length) {
            JSPLib.debug.debuglog("Found ham dmails!",CheckDmails.lastid);
            let hamdmaillist = GetObjectAttributes(hamjsondmail,'id');
            let hamdmailhtml = await $.get("/dmails", {search: {id: hamdmaillist.join(',')}, limit: hamdmaillist.length});
            let $hamdmail = $(hamdmailhtml);
            $("tr.read-false", $hamdmail).css("font-weight","bold");
            $("#ham-dmail-table").append($(".striped",$hamdmail));
            let $dmails_table = $("#ham-dmail-table");
            InitializeOpenDmailLinks($dmails_table);
            $("#event-notice").show();
            $("#ham-dmail-section").show();
            CheckDmails.hasevents = true;
        } else {
            JSPLib.debug.debuglog("No ham dmails!");
        }
        if (spamjsondmail.length) {
            JSPLib.debug.debuglog("Found spam dmails!",CheckDmails.lastid);
            let spammaillist = GetObjectAttributes(spamjsondmail,'id');
            let spamdmailhtml = await $.get("/dmails", {search: {id: spammaillist.join(','),is_spam: true}, limit: spammaillist.length});
            let $spamdmail = $(spamdmailhtml);
            $("tr.read-false", $spamdmail).css("font-weight","bold");
            $("#spam-dmail-table").append($(".striped",$spamdmail));
            let $dmails_table = $("#spam-dmail-table");
            InitializeOpenDmailLinks($dmails_table);
            $("#event-notice").show();
            $("#spam-dmail-section").show();
            CheckDmails.hasevents = true;
        } else {
            JSPLib.debug.debuglog("No spam dmails!");
        }
        if (!hamjsondmail.length && !spamjsondmail.length && jsondmail.length && (dmaillastid !== CheckDmails.lastid.toString())) {
            SaveLastID('dmail',CheckDmails.lastid);
        }
    } else {
        SetRecentDanbooruID('dmail',true);
    }
    CheckDmails.isdone = true;
}
CheckDmails.lastid = 0;
CheckDmails.hasevents = false;
CheckDmails.isdone = false;

async function CheckComments() {
    let commentlastid = localStorage['el-commentlastid'];
    let commentlist = GetList('comment');
    if (commentlastid) {
        var jsoncomments = [], subscribecomments = [];
        if (!localStorage['el-savedcommentlist']) {
            let tempcomments;
            while (true) {
                tempcomments = jsoncomments;
                jsoncomments = await $.getJSON("/comments", {group_by: 'comment', page: 'a' + commentlastid, limit: display_limit});
                subscribecomments = jsoncomments.filter((val)=>{return (val.creator_id !== userid) && (commentlist.indexOf(val.post_id) >= 0);}).concat(subscribecomments);
                if (jsoncomments.length === display_limit) {
                    commentlastid = DanbooruArrayMaxID(jsoncomments).toString();
                    JSPLib.debug.debuglog("Rechecking @",commentlastid);
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
                jsoncomments = [DanbooruArrayMaxID(jsoncomments)];
                localStorage['el-savedcommentlastid'] = JSON.stringify(jsoncomments);
            }
        } else {
            subscribecomments = JSON.parse(localStorage['el-savedcommentlist']);
            subscribecomments = subscribecomments.filter(value=>{return commentlist.indexOf(value.post) >= 0;});
            jsoncomments = JSON.parse(localStorage['el-savedcommentlastid']);
            if (!subscribecomments.length) {
                JSPLib.debug.debuglog("Deleting saved comment values");
                delete localStorage['el-savedcommentlist'];
                delete localStorage['el-savedcommentlastid'];
            } else {
                subscribecomments = subscribecomments.map((val)=>{return val.id;});
            }
        }
        if (subscribecomments.length) {
            JSPLib.debug.debuglog("Found comments!",jsoncomments[0]);
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
            JSPLib.debug.debuglog("No comments!");
            if (jsoncomments.length && (localStorage['el-commentlastid'] !== jsoncomments[0].toString())) {
                SaveLastID('comment',jsoncomments[0]);
            }
        }
    } else {
        SetRecentDanbooruID('comment');
    }
    CheckComments.isdone = true;
}
CheckComments.lastid = 0;
CheckComments.hasevents = false;
CheckComments.isdone = false;

async function CheckForums() {
    let forumlastid = localStorage['el-forumlastid'];
    let forumlist = GetList('forum');
    if (forumlastid) {
        var jsonforums = [], subscribeforums = [];
        if (!localStorage['el-savedforumlist']) {
            let tempforums;
            while (true) {
                tempforums = jsonforums;
                jsonforums = await $.getJSON("/forum_posts", {page: 'a' + forumlastid, limit: display_limit});
                subscribeforums = jsonforums.filter((val)=>{return (val.creator_id !== userid) && (forumlist.indexOf(val.topic_id) >= 0);}).concat(subscribeforums);
                if (jsonforums.length === display_limit) {
                    forumlastid = DanbooruArrayMaxID(jsonforums).toString();
                    JSPLib.debug.debuglog("Rechecking @",forumlastid);
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
                jsonforums = [DanbooruArrayMaxID(jsonforums)];
                localStorage['el-savedforumlastid'] = JSON.stringify(jsonforums);
            }
        } else {
            subscribeforums = JSON.parse(localStorage['el-savedforumlist']);
            subscribeforums = subscribeforums.filter(value=>{return forumlist.indexOf(value.topic) >= 0;});
            jsonforums = JSON.parse(localStorage['el-savedforumlastid']);
            if (!subscribeforums.length) {
                JSPLib.debug.debuglog("Deleting saved forum values");
                delete localStorage['el-savedforumlist'];
                delete localStorage['el-savedforumlastid'];
            } else {
                subscribeforums = subscribeforums.map((val)=>{return val.id;});
            }
        }
        if (subscribeforums.length) {
            JSPLib.debug.debuglog("Found forums!",jsonforums[0]);
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
            JSPLib.debug.debuglog("No forums!");
            if (jsonforums.length && (localStorage['el-forumlastid'] !== jsonforums[0].toString())) {
                SaveLastID('forum',jsonforums[0]);
            }
        }
    } else {
        SetRecentDanbooruID('forum');
    }
    CheckForums.isdone = true;
}
CheckForums.lastid = 0;
CheckForums.hasevents = false;
CheckForums.isdone = false;

async function CheckNotes() {
    let notelastid = localStorage['el-notelastid'];
    let notelist = GetList('note');
    if (notelastid) {
        var jsonnotes = [], subscribenotes = [];
        if (!localStorage['el-savednotelist']) {
            let tempnotes;
            while (true) {
                tempnotes = jsonnotes;
                jsonnotes = await $.getJSON("/note_versions", {page: 'a' + notelastid, limit: display_limit});
                subscribenotes = jsonnotes.filter((val)=>{return (val.updater_id !== userid) && (notelist.indexOf(val.post_id) >= 0);}).concat(subscribenotes);
                if (jsonnotes.length === display_limit) {
                    notelastid = DanbooruArrayMaxID(jsonnotes).toString();
                    JSPLib.debug.debuglog("Rechecking @",notelastid);
                    continue;
                } else if (jsonnotes.length === 0) {
                    jsonnotes = tempnotes;
                }
                break;
            }
            if (subscribenotes.length) {
                localStorage['el-savednotelist'] = JSON.stringify(subscribenotes.map((val)=>{return {id:val.id,post:val.post_id};}));
                subscribenotes = subscribenotes.map((val)=>{return val.id;});
            }
            if (jsonnotes.length) {
                jsonnotes = [DanbooruArrayMaxID(jsonnotes)];
                localStorage['el-savednotelastid'] = JSON.stringify(jsonnotes);
            }
        } else {
            subscribenotes = JSON.parse(localStorage['el-savednotelist']);
            subscribenotes = subscribenotes.filter(value=>{return notelist.indexOf(value.post) >= 0;});
            jsonnotes = JSON.parse(localStorage['el-savednotelastid']);
            if (!subscribenotes.length) {
                JSPLib.debug.debuglog("Deleting saved note values");
                delete localStorage['el-savednotelist'];
                delete localStorage['el-savednotelastid'];
            } else {
                subscribenotes = subscribenotes.map((val)=>{return val.id;});
            }
        }
        if (subscribenotes.length) {
            JSPLib.debug.debuglog("Found notes!",jsonnotes[0]);
            CheckNotes.lastid = jsonnotes[0];
            let noteshtml = await $.get("/note_versions", {search: {id: subscribenotes.join(',')}, limit: subscribenotes.length});
            let $notes = $(noteshtml);
            let $notes_table = $("#notes-table");
            $notes_table.append($(".striped",$notes));
            InitializeNoteIndexLinks($notes_table);
            InitializeOpenNoteLinks($notes_table);
            $("#event-notice").show();
            $("#notes-section").show();
            CheckNotes.hasevents = true;
        } else {
            JSPLib.debug.debuglog("No notes!");
            if (jsonnotes.length && (localStorage['el-notelastid'] !== jsonnotes[0].toString())) {
                SaveLastID('note',jsonnotes[0]);
            }
        }
    } else {
        SetRecentDanbooruID('note');
    }
    CheckNotes.isdone = true;
}
CheckNotes.lastid = 0;
CheckNotes.hasevents = false;
CheckNotes.isdone = false;

/****Callback functions****/

function CheckAllEvents() {
    if (CheckFlags.isdone && CheckAppeals.isdone && CheckDmails.isdone && CheckComments.isdone && CheckForums.isdone && CheckNotes.isdone) {
        clearInterval(CheckAllEvents.timer);
        if (CheckFlags.hasevents || CheckAppeals.hasevents || CheckDmails.hasevents || CheckComments.hasevents || CheckForums.hasevents || CheckNotes.hasevents) {
            localStorage['el-events'] = true;
        } else {
            localStorage['el-events'] = false;
        }
    }
}

/****Render functions****/

function RenderCommentPartialPostLinks(postid,tag,separator) {
    let commentlist = GetList('comment');
    let subscribe = (commentlist.indexOf(postid) < 0 ? "style": 'style="display:none !important"');
    let unsubscribe = (commentlist.indexOf(postid) < 0 ? 'style="display:none !important"' : "style");
    return `<${tag} data-post-id="${postid}" class="subscribe-comments" ${subscribe}><a href="#">Subscribe${separator}comments</a></${tag}>` +
           `<${tag} data-post-id="${postid}" class="unsubscribe-comments" ${unsubscribe}"><a href="#">Unsubscribe${separator}comments</a></${tag}>`;
}

function RenderForumTopicLinks(topicid,tag,ender,right=false) {
    let forumlist = GetList('forum');
    let subscribe = (forumlist.indexOf(topicid) < 0 ? "style": 'style="display:none !important"');
    let unsubscribe = (forumlist.indexOf(topicid) < 0 ? 'style="display:none !important"' : "style");
    let spacer = (right ? "&nbsp;&nbsp;" : "");
    return `<${tag} data-topic-id="${topicid}" class="subscribe-topic" ${subscribe}><a href="#">${spacer}Subscribe${ender}</a></${tag}>` +
           `<${tag} data-topic-id="${topicid}" class="unsubscribe-topic" ${unsubscribe}"><a href="#">Unsubscribe${ender}</a></${tag}>`;
}

function RenderNoteLinks(postid,tag,ender,right=false) {
    let notelist = GetList('note');
    let subscribe = (notelist.indexOf(postid) < 0 ? "style": 'style="display:none !important"');
    let unsubscribe = (notelist.indexOf(postid) < 0 ? 'style="display:none !important"' : "style");
    let spacer = (right ? "&nbsp;&nbsp;" : "");
    return `<${tag} data-post-id="${postid}" class="subscribe-notes" ${subscribe}><a href="#">${spacer}Subscribe${ender}</a></${tag}>` +
           `<${tag} data-post-id="${postid}" class="unsubscribe-notes" ${unsubscribe}"><a href="#">Unsubscribe${ender}</a></${tag}>`;
}

function RenderOpenForumLinks(forumid) {
    return `<span data-forum-id="${forumid}" class="show-full-forum" style><a href="#">Show</a></span>` +
           `<span data-forum-id="${forumid}" class="hide-full-forum" style="display:none !important"><a href="#">Hide</a></span>&nbsp;|&nbsp;`;
}

function RenderOpenNoteLinks(noteid) {
    return `<p style="text-align:center">
                <span data-note-id="${noteid}" class="show-rendered-note" style><a href="#">Render note</a></span>` +
               `<span data-note-id="${noteid}" class="hide-rendered-note" style="display:none !important"><a href="#">Hide note</a></span>
            </p>`;
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

function InitializeOpenNoteLinks($obj) {
    $.each($(".striped tbody tr",$obj),(i,$row)=>{
        let noteid = $("td:nth-of-type(3) a:first-of-type",$row)[0].innerHTML.replace('.','-');
        $("td:nth-of-type(4)",$row).append(RenderOpenNoteLinks(noteid));
    });
    ShowRenderedNoteClick($obj);
    HideRenderedNoteClick($obj);
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

function InitializePostNoteLinks() {
    var postid = parseInt(Danbooru.meta('post-id'));
    $("#nav > menu:nth-child(2)").append(RenderNoteLinks(postid,"li"," notes"));
    SubscribeNotesClick();
    UnsubscribeNotesClick();
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

function InitializeNoteIndexLinks($obj) {
    $.each($(".striped tbody tr",$obj), (i,entry)=>{
        let postid = parseInt($("td:nth-of-type(2)",entry)[0].innerHTML.match(/\/posts\/(\d+)/)[1]);
        $("td:nth-of-type(1)",entry).prepend(RenderNoteLinks(postid,"span","",true));
    });
    SubscribeNotesClick();
    UnsubscribeNotesClick();
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
    $.each($("#event-notice #comments-section .post-preview"), (i,$entry)=>{
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
            SaveLastID('flag',CheckFlags.lastid);
        }
        if (CheckAppeals.lastid) {
            SaveLastID('appeal',CheckAppeals.lastid);
        }
        if (CheckDmails.lastid) {
            SaveLastID('dmail',CheckDmails.lastid);
            $("#hide-dmail-notice").click();
        }
        if (CheckComments.lastid) {
            SaveLastID('comment',CheckComments.lastid);
            delete localStorage['el-savedcommentlist'];
            delete localStorage['el-savedcommentlastid'];
            JSPLib.debug.debuglog("Deleted saved values! (comments)");
        }
        if (CheckForums.lastid) {
            SaveLastID('forum',CheckForums.lastid);
            delete localStorage['el-savedforumlist'];
            delete localStorage['el-savedforumlastid'];
            JSPLib.debug.debuglog("Deleted saved values! (forums)");
        }
        if (CheckNotes.lastid) {
            SaveLastID('note',CheckNotes.lastid);
            delete localStorage['el-savednotelist'];
            delete localStorage['el-savednotelastid'];
            JSPLib.debug.debuglog("Deleted saved values! (notes)");
        }
        localStorage['el-events'] = false;
        e.preventDefault();
    });
}

function SubscribeCommentsClick() {
    $(".subscribe-comments a").off().click((e)=>{
        let post = $(e.target.parentElement).data('post-id');
        setTimeout(()=>{SetList('comment',post);},1);
        FullHide(`.subscribe-comments[data-post-id=${post}]`);
        ClearHide(`.unsubscribe-comments[data-post-id=${post}]`);
        e.preventDefault();
    });
}

function UnsubscribeCommentsClick() {
    $(".unsubscribe-comments a").off().click((e)=>{
        let post = $(e.target.parentElement).data('post-id');
        setTimeout(()=>{SetList('comment','-' + post);},1);
        FullHide(`.unsubscribe-comments[data-post-id=${post}]`);
        ClearHide(`.subscribe-comments[data-post-id=${post}]`);
        e.preventDefault();
    });
}

function SubscribeNotesClick() {
    $(".subscribe-notes a").off().click((e)=>{
        let post = $(e.target.parentElement).data('post-id');
        setTimeout(()=>{SetList('note',post);},1);
        FullHide(`.subscribe-notes[data-post-id=${post}]`);
        ClearHide(`.unsubscribe-notes[data-post-id=${post}]`);
        e.preventDefault();
    });
}

function UnsubscribeNotesClick() {
    $(".unsubscribe-notes a").off().click((e)=>{
        let post = $(e.target.parentElement).data('post-id');
        setTimeout(()=>{SetList('note','-' + post);},1);
        FullHide(`.unsubscribe-notes[data-post-id=${post}]`);
        ClearHide(`.subscribe-notes[data-post-id=${post}]`);
        e.preventDefault();
    });
}

function SubscribeTopicClick() {
    $(".subscribe-topic a").off().click((e)=>{
        let topic = $(e.target.parentElement).data('topic-id');
        setTimeout(()=>{SetList('forum',topic);},1);
        FullHide(`.subscribe-topic[data-topic-id=${topic}]`);
        ClearHide(`.unsubscribe-topic[data-topic-id=${topic}]`);
        e.preventDefault();
    });
}

function UnsubscribeTopicClick() {
    $(".unsubscribe-topic a").off().click((e)=>{
        let topic = $(e.target.parentElement).data('topic-id');
        setTimeout(()=>{SetList('forum','-' + topic);},1);
        FullHide(`.unsubscribe-topic[data-topic-id=${topic}]`);
        ClearHide(`.subscribe-topic[data-topic-id=${topic}]`);
        e.preventDefault();
    });
}

function ShowFullForumClick($obj) {
    $(".show-full-forum a").off().click(function(e){
        let forumid = $(e.target.parentElement).data('forum-id');
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
        FullHide(`.hide-full-forum[data-forum-id=${forumid}]`);
        ClearHide(`.show-full-forum[data-forum-id=${forumid}]`);
        $(`#full-forum-id-${forumid}`).hide();
        e.preventDefault();
    });
}

function ShowRenderedNoteClick($obj) {
    $(".show-rendered-note a").off().click(function(e){
        let noteid = $(e.target.parentElement).data('note-id');
        if (ShowRenderedNoteClick.openlist.indexOf(noteid) < 0) {
            let $rowelement = e.target.parentElement.parentElement.parentElement.parentElement;
            AddRenderedNote(noteid,$rowelement);
            ShowRenderedNoteClick.openlist.push(noteid);
        }
        FullHide(`.show-rendered-note[data-note-id="${noteid}"]`);
        ClearHide(`.hide-rendered-note[data-note-id="${noteid}"]`);
        $(`#rendered-note-id-${noteid}`).show();
        e.preventDefault();
    });
}
ShowRenderedNoteClick.openlist = [];

function HideRenderedNoteClick($obj) {
    $(".hide-rendered-note a").off().click(function(e){
        let noteid = $(e.target.parentElement).data('note-id');
        FullHide(`.hide-rendered-note[data-note-id="${noteid}"]`);
        ClearHide(`.show-rendered-note[data-note-id="${noteid}"]`);
        $(`#rendered-note-id-${noteid}`).hide();
        e.preventDefault();
    });
}

function ShowFullDmailClick($obj) {
    $(".show-full-dmail a").off().click(function(e){
        let dmailid = $(e.target.parentElement).data('dmail-id');
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
        JSPLib.debug.debuglog("Invalid meta variables!");
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
        if (GetList('comment').length) {
            JSPLib.utility.setCSSStyle(comment_css,'comment');
            CheckComments();
        } else {
            CheckComments.isdone = true;
        }
        if (GetList('forum').length) {
            JSPLib.utility.setCSSStyle(forum_css,'forum');
            CheckForums();
        } else {
            CheckForums.isdone = true;
        }
        if (GetList('note').length) {
            CheckNotes();
        } else {
            CheckNotes.isdone = true;
        }
        CheckAllEvents.timer = setInterval(CheckAllEvents,timer_poll_interval);
    } else {
        JSPLib.debug.debuglog("Waiting...");
    }
    if ($("#c-posts #a-show").length) {
        InitializePostCommentLinks();
        InitializePostNoteLinks();
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
    JSPLib.utility.setCSSStyle(eventlistener_css,'program');
}

/****Execution start****/

JSPLib.load.programInitialize(main,'EL',program_load_required_variables);
