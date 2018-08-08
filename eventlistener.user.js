// ==UserScript==
// @name         EventListener
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      9.5
// @source       https://danbooru.donmai.us/users/23799
// @description  Informs users of new events (flags,appeals,dmails,comments,forums,notes)
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/eventlistener.user.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180723/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180723/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180723/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180723/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180723/lib/danbooru.js
// ==/UserScript==

/****Global variables****/

//Variables for debug.js
JSPLib.debug.debug_console = false;
JSPLib.debug.level = JSPLib.debug.INFO;
JSPLib.debug.pretext = "EL:";

//Variables for load.js
const program_load_required_variables = ['window.jQuery'];
const program_load_required_ids = ["page"];

//The max number of items to grab with each network call
const query_limit = 100;

//Various program expirations
const recheck_event_expires = 5 * JSPLib.utility.one_minute;
const process_semaphore_expires = 5 * JSPLib.utility.one_minute;

//Placeholder for setting later;
var username;
var userid;
var usertype_lastids = {};
var subscribetype_lastids = {};
var type_alllist = {};

//Type configurations
const typedict = {
    flag: {
        controller: 'post_flags',
        addons: {},
        useraddons: function (username) {return {search: {category: 'normal',post_tags_match: "user:" + username}};},
        filter: function (array) {return array.filter((val)=>{return !('creator_id' in val);});},
        insert: InsertEvents
    },
    appeal: {
        controller: 'post_appeals',
        addons: {},
        useraddons: function (username) {return {search: {post_tags_match: "user:" + username}};},
        filter: function (array) {return array.filter((val)=>{return val.creator_id !== userid;});},
        insert: InsertEvents
    },
    dmail: {
        controller: 'dmails',
        addons: {search: {is_spam: false}},
        useraddons: function (username) {return {};},
        filter: function (array) {return array.filter((val)=>{return !val.is_read;});},
        insert: InsertDmails
    },
    spam: {
        controller: 'dmails',
        addons: {search: {is_spam: true}},
        useraddons: function (username) {return {};},
        filter: function (array) {return array.filter((val)=>{return !val.is_read;});},
        insert: InsertDmails
    },
    comment: {
        controller: 'comments',
        addons: {group_by: 'comment'},
        filter: function (array,typelist) {return array.filter((val)=>{return (val.creator_id !== userid) && (typelist.indexOf(val.post_id) >= 0);});},
        insert: InsertComments
    },
    forum: {
        controller: 'forum_posts',
        addons: {},
        filter: function (array,typelist) {return array.filter((val)=>{return (val.creator_id !== userid) && (typelist.indexOf(val.topic_id) >= 0);});},
        insert: InsertForums
    },
    note: {
        controller: 'note_versions',
        addons: {},
        filter: function (array,typelist) {return array.filter((val)=>{return (val.updater_id !== userid) && (typelist.indexOf(val.post_id) >= 0);});},
        insert: InsertNotes
    },
};

//HTML for the notice block
const notice_box = `
<div class="ui-corner-all ui-state-highlight" id="event-notice" style="display:none">
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
    <div id="spam-section"  style="display:none">
        <h1>You've got spam!</h1>
        <div id="spam-table"></div>
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
.ui-state-highlight a {
    color: #0073ff;
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

/****Functions****/

//Library functions

function GetMeta(key) {
  return $("meta[name=" + key + "]").attr("content");
}

function FullHide(selector) {
    $(selector).attr('style','display: none !important');
}

function ClearHide(selector) {
    $(selector).attr('style','');
}

function GetExpiration(expires) {
    return Date.now() + expires;
}

function ValidateExpires(actual_expires,expected_expires) {
    //Resolve to true if the actual_expires is bogus, has expired, or the expiration is too long
    return !Number.isInteger(actual_expires) || (Date.now() > actual_expires) || ((actual_expires - Date.now()) > expected_expires);
}

function ValidateID(num) {
    return Number.isInteger(num) && (num > 0);
}

function ValidateIDList(array) {
    return Array.isArray(array) && (array.length > 0) && array.reduce((total,val)=>{return ValidateID(val) && total;},true);
}

function CheckSemaphore() {
    let semaphore = JSPLib.storage.getStorageData('el-process-semaphore',localStorage,0);
    return ValidateExpires(semaphore, process_semaphore_expires);
}

function FreeSemaphore() {
    $(window).off('beforeunload.el.semaphore');
    JSPLib.storage.setStorageData('el-process-semaphore',0,localStorage);
}

async function ReserveSemaphore() {
    if (CheckSemaphore()) {
        //Guarantee that leaving/closing tab reverts the semaphore
        $(window).on('beforeunload.el.semaphore',function () {
            JSPLib.storage.setStorageData('el-process-semaphore',0,localStorage);
        });
        //Set semaphore with an expires in case the program crashes
        let semaphore = GetExpiration(process_semaphore_expires);
        JSPLib.storage.setStorageData('el-process-semaphore', semaphore, localStorage);
        return semaphore;
    }
    return null;
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

//Data storage functions

function GetList(type) {
    type_alllist[type] = type_alllist[type] || JSPLib.storage.getStorageData(`el-${type}list`,localStorage,[]);
    return type_alllist[type];
}

function SetList(type,input) {
    let typelist = GetList(type);
    if (input[0] == '-') {
        typelist = JSPLib.utility.setDifference(typelist,[parseInt(input.slice(1))]);
    } else {
        typelist.push(parseInt(input));
    }
    type_alllist[type] = JSPLib.utility.setUnique(typelist);
    JSPLib.storage.setStorageData(`el-${type}list`,type_alllist[type],localStorage);
}

//Quicker way to check list existence; avoids unnecessarily parsing very long lists
function CheckList(type) {
    let typelist = localStorage.getItem(`el-${type}list`);
    return typelist && typelist !== "[]";
}

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

function CheckTimeout() {
    let expires = JSPLib.storage.getStorageData('el-timeout',localStorage,0);
    return ValidateExpires(expires,recheck_event_expires);
}

function SetRecheckTimeout() {
    JSPLib.storage.setStorageData('el-timeout',GetExpiration(recheck_event_expires),localStorage);
}

//Return true if there are no saved events at all, or saved events for the input type
function CheckWaiting(inputtype) {
    CheckWaiting.all_waits = CheckWaiting.all_waits || {};
    if (Object.keys(CheckWaiting.all_waits).length == 0) {
        $.each(['dmail','flag','appeal','spam','comment','forum','note'],(i,type)=>{
            CheckWaiting.all_waits[type] = JSPLib.storage.getStorageData(`el-saved${type}lastid`,localStorage,[]).length > 0;
        });
    }
    return !(Object.values(CheckWaiting.all_waits).reduce((total,entry)=>{return total || entry;},false)) || CheckWaiting.all_waits[inputtype];
}

/****Auxiliary functions****/

//Get single instance of various types and insert into table row

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

//Insert and process HTML onto page for various types

function InsertEvents($eventpage,type) {
    $(`#${type}-table`).append($(".striped",$eventpage));
    $(`#${type}-table .post-preview`).addClass("blacklisted");
}

function InsertDmails($dmailpage,type) {
    $("tr.read-false", $dmailpage).css("font-weight","bold");
    $(`#${type}-table`).append($(".striped",$dmailpage));
    let $dmails_table = $(`#${type}-table`);
    InitializeOpenDmailLinks($dmails_table);
}

function InsertComments($commentpage) {
    $(".post-preview",$commentpage).addClass("blacklisted");
    $(".edit_comment",$commentpage).hide();
    $("#comments-table").append($(".list-of-comments",$commentpage));
    InitializeEventNoticeCommentLinks();
}

function InsertForums($forumpage) {
    let $forums_table = $("#forums-table");
    $forums_table.append($(".striped",$forumpage));
    InitializeTopicIndexLinks($forums_table);
    InitializeOpenForumLinks($forums_table);
}

function InsertNotes($notepage) {
    let $notes_table = $("#notes-table");
    $notes_table.append($(".striped",$notepage));
    InitializeNoteIndexLinks($notes_table);
    InitializeOpenNoteLinks($notes_table);
}

/****Main execution functions****/

async function CheckUserType(type) {
    let lastidkey = `el-${type}lastid`;
    let typelastid = JSPLib.storage.getStorageData(lastidkey,localStorage,0);
    if (ValidateID(typelastid)) {
        let url_addons = JSPLib.danbooru.joinArgs(typedict[type].addons,typedict[type].useraddons(username));
        let jsontype = await JSPLib.danbooru.getAllItems(typedict[type].controller,query_limit,{addons:url_addons,page:typelastid,reverse:true});
        let filtertype = typedict[type].filter(jsontype);
        let lastusertype = (jsontype.length ? [JSPLib.danbooru.getNextPageID(jsontype,true)] : []);
        if (filtertype.length) {
            usertype_lastids[type] = lastusertype[0];
            JSPLib.debug.debuglog(`Found ${type}s!`,usertype_lastids[type]);
            let idlist = JSPLib.utility.getObjectAttributes(filtertype,'id');
            url_addons = JSPLib.danbooru.joinArgs(typedict[type].addons,{search: {id: idlist.join(',')}, limit: idlist.length});
            let typehtml = await $.get(`/${typedict[type].controller}`, url_addons);
            let $typepage = $(typehtml);
            typedict[type].insert($typepage,type);
            $("#event-notice").show();
            $(`#${type}-section`).show();
            return true;
        } else {
            JSPLib.debug.debuglog(`No ${type}s!`);
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
    if (ValidateID(typelastid)) {
        let typelist = GetList(type);
        let savedlistkey = `el-saved${type}list`;
        let savedlastidkey = `el-saved${type}lastid`;
        var subscribetypelist = [], jsontypelist = [];
        let savedlastid = JSPLib.storage.getStorageData(savedlastidkey,localStorage);
        let savedlist = JSPLib.storage.getStorageData(savedlistkey,localStorage);
        if (!ValidateIDList(savedlastid) || !ValidateIDList(savedlist)) {
            let jsontype = await JSPLib.danbooru.getAllItems(typedict[type].controller,query_limit,{page:typelastid,addons:typedict[type].addons,reverse:true});
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
            subscribetype_lastids[type] = jsontypelist[0];
            JSPLib.debug.debuglog(`Found ${type}s!`,subscribetype_lastids[type]);
            let url_addons = JSPLib.danbooru.joinArgs(typedict[type].addons,{search: {id: subscribetypelist.join(',')}, limit: subscribetypelist.length});
            let typehtml = await $.get(`/${typedict[type].controller}`, url_addons);
            let $typepage = $(typehtml);
            typedict[type].insert($typepage);
            $("#event-notice").show();
            $(`#${type}s-section`).show();
            return true;
        } else {
            JSPLib.debug.debuglog(`No ${type}s!`);
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
    var postid = parseInt(GetMeta('post-id'));
    $("#nav > menu:nth-child(2)").append(RenderCommentPartialPostLinks(postid,"li"," "));
    SubscribeCommentsClick();
    UnsubscribeCommentsClick();
}

function InitializePostNoteLinks() {
    var postid = parseInt(GetMeta('post-id'));
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
        $.each(usertype_lastids,(type,value)=>{
            SaveLastID(type,value);
        });
        $.each(subscribetype_lastids,(type,value)=>{
            SaveLastID(type,value);
            delete localStorage[`el-saved${type}list`];
            delete localStorage[`el-saved${type}lastid`];
            JSPLib.debug.debuglog(`Deleted saved values! (${type}s)`);
        });
        if ($("#hide-dmail-notice").length) {
            $("#hide-dmail-notice").click();
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
    username = GetMeta('current-user-name');
    userid = parseInt(GetMeta('current-user-id'));
    if (username === "Anonymous") {
        JSPLib.debug.debuglog("User must log in!");
        return;
    } else if ((typeof username !== "string") || !ValidateID(userid)) {
        JSPLib.debug.debuglog("Invalid meta variables!");
        return;
    }
    $("#dmail-notice").hide();
    InitializeNoticeBox();
    var promise_array = [];
    if ((CheckTimeout() || HasEvents()) && ReserveSemaphore()) {
        SetRecheckTimeout();
        CheckWaiting('dmail') && promise_array.push(CheckUserType('dmail'));
        CheckWaiting('flag') && promise_array.push(CheckUserType('flag'));
        CheckWaiting('appeal') && promise_array.push(CheckUserType('appeal'));
        CheckWaiting('spam') && promise_array.push(CheckUserType('spam'));
        if (CheckList('comment') && CheckWaiting('comment')) {
            JSPLib.utility.setCSSStyle(comment_css,'comment');
            promise_array.push(CheckSubscribeType('comment'));
        }
        if (CheckList('forum') && CheckWaiting('forum')) {
            JSPLib.utility.setCSSStyle(forum_css,'forum');
            promise_array.push(CheckSubscribeType('forum'));
        }
        if (CheckList('note') && CheckWaiting('note')) {
            promise_array.push(CheckSubscribeType('note'));
        }
        CheckAllEvents(promise_array).then(()=>{
            FreeSemaphore();
        });
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
    } else if ($("#c-forum-topics #a-show").length) {
        InitializeTopicShowLinks();
        $('a[href$="/subscribe"]').text("Subscribe email");
        $('a[href$="/unsubscribe"]').text("Unsubscribe email");
    } else if ($("#c-forum-topics #a-index,#c-forum-posts #a-index").length) {
        InitializeTopicIndexLinks(document);
    }
    JSPLib.utility.setCSSStyle(eventlistener_css,'program');
}

/****Execution start****/

JSPLib.load.programInitialize(main,'EL',program_load_required_variables,program_load_required_ids);
