// ==UserScript==
// @name         EventListener
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      10.0
// @source       https://danbooru.donmai.us/users/23799
// @description  Informs users of new events (flags,appeals,dmails,comments,forums,notes)
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/eventlistener.user.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180827/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180827/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180827/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180827/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180827/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180827/lib/danbooru.js
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

//The max number of items to grab with each network call
const query_limit = 100;

//Various program expirations
const recheck_event_expires = 5 * JSPLib.utility.one_minute;
const process_semaphore_expires = 5 * JSPLib.utility.one_minute;

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
        filter: function (array) {return array.filter((val)=>{return val.creator_id !== Danbooru.EL.userid;});},
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
        filter: function (array,typelist) {return array.filter((val)=>{return (val.creator_id !== Danbooru.EL.userid) && (typelist.indexOf(val.post_id) >= 0);});},
        insert: InsertComments
    },
    forum: {
        controller: 'forum_posts',
        addons: {},
        filter: function (array,typelist) {return array.filter((val)=>{return (val.creator_id !== Danbooru.EL.userid) && (typelist.indexOf(val.topic_id) >= 0);});},
        insert: InsertForums
    },
    note: {
        controller: 'note_versions',
        addons: {},
        filter: function (array,typelist) {return array.filter((val)=>{return (val.updater_id !== Danbooru.EL.userid) && (typelist.indexOf(val.post_id) >= 0);});},
        insert: InsertNotes
    },
    commentary: {
        controller: 'artist_commentary_versions',
        addons: {},
        filter: function (array,typelist) {return array.filter((val)=>{return (val.updater_id !== Danbooru.EL.userid) && typelist.includes(val.post_id);});},
        insert: InsertEvents
    }
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
    <div id="spam-section"  style="display:none">
        <h1>You've got spam!</h1>
        <div id="spam-table"></div>
    </div>
    <p><a href="#" id="hide-event-notice">Close this</a></p>
</div>
`;

const menu_html = `
<menu id="el-subscribe-events">
    Subscribe (<span id="el-add-links"></span>)
</menu>`;

//Program CSS
const eventlistener_css = `
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
.ui-state-highlight a {
    color: #0073ff;
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
`;

//Fix for showing comments
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

//Fix for showing forum posts
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

/****Functions****/

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
    if (Danbooru.EL.subscribelist[type]) {
        return Danbooru.EL.subscribelist[type];
    }
    Danbooru.EL.subscribelist[type] = JSPLib.storage.getStorageData(`el-${type}list`,localStorage,[]);
    if (!JSPLib.validate.validateIDList(Danbooru.EL.subscribelist[type])) {
        JSPLib.debug.debuglog(`Corrupted data on ${type} list!`);
        Danbooru.EL.old_subscribelist = Danbooru.EL.old_subscribelist || {};
        Danbooru.EL.old_subscribelist[type] = Danbooru.EL.subscribelist[type];
        Danbooru.EL.subscribelist[type] = (Array.isArray(Danbooru.EL.subscribelist[type]) ? Danbooru.EL.subscribelist[type].filter((id)=>{return JSPLib.validate.validateID(id);}) : []);
        JSPLib.debug.debugExecute(()=>{
            let validation_error = (Array.isArray(Danbooru.EL.old_subscribelist[type]) ? JSPLib.utility.setDifference(Danbooru.EL.old_subscribelist[type],Danbooru.EL.subscribelist[type]) : Danbooru.EL.old_subscribelist[type]);
            JSPLib.debug.debuglog("Validation error:",validation_error);
        });
        setTimeout(()=>{JSPLib.storage.setStorageData(`el-${type}list`,Danbooru.EL.subscribelist[type],localStorage);}, 1);
    }
    return Danbooru.EL.subscribelist[type];
}

function SetList(type,input) {
    let typelist = GetList(type);
    if (input[0] == '-') {
        typelist = JSPLib.utility.setDifference(typelist,[parseInt(input.slice(1))]);
    } else {
        typelist.push(parseInt(input));
    }
    Danbooru.EL.subscribelist[type] = JSPLib.utility.setUnique(typelist);
    JSPLib.storage.setStorageData(`el-${type}list`,Danbooru.EL.subscribelist[type],localStorage);
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
    return !JSPLib.validate.validateExpires(expires,recheck_event_expires);
}

function SetRecheckTimeout() {
    JSPLib.storage.setStorageData('el-timeout',JSPLib.utility.getExpiration(recheck_event_expires),localStorage);
}

//Return true if there are no saved events at all, or saved events for the input type
function CheckWaiting(inputtype) {
    CheckWaiting.all_waits = CheckWaiting.all_waits || {};
    if (Object.keys(CheckWaiting.all_waits).length == 0) {
        $.each(typedict,(type)=>{
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
    $("#comment-table").append($(".list-of-comments",$commentpage));
    InitializeCommentPartialCommentLinks("#event-notice #comments-section .post-preview");
}

function InsertForums($forumpage) {
    let $forums_table = $("#forum-table");
    $forums_table.append($(".striped",$forumpage));
    InitializeTopicIndexLinks($forums_table);
    InitializeOpenForumLinks($forums_table);
}

function InsertNotes($notepage) {
    let $notes_table = $("#note-table");
    $notes_table.append($(".striped",$notepage));
    InitializeNoteIndexLinks($notes_table);
    InitializeOpenNoteLinks($notes_table);
}

/****Main execution functions****/

async function CheckUserType(type) {
    let lastidkey = `el-${type}lastid`;
    let typelastid = JSPLib.storage.getStorageData(lastidkey,localStorage,0);
    if (JSPLib.validate.validateID(typelastid)) {
        let url_addons = JSPLib.danbooru.joinArgs(typedict[type].addons,typedict[type].useraddons(Danbooru.EL.username));
        let jsontype = await JSPLib.danbooru.getAllItems(typedict[type].controller,query_limit,{addons:url_addons,page:typelastid,reverse:true});
        let filtertype = typedict[type].filter(jsontype);
        let lastusertype = (jsontype.length ? [JSPLib.danbooru.getNextPageID(jsontype,true)] : []);
        if (filtertype.length) {
            Danbooru.EL.lastids.user[type] = lastusertype[0];
            JSPLib.debug.debuglog(`Found ${type}(s)!`,Danbooru.EL.lastids.user[type]);
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
        var subscribetypelist = [], jsontypelist = [];
        let savedlastid = JSPLib.storage.getStorageData(savedlastidkey,localStorage);
        let savedlist = JSPLib.storage.getStorageData(savedlistkey,localStorage);
        if (!JSPLib.validate.validateIDList(savedlastid) || !JSPLib.validate.validateIDList(savedlist)) {
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
            Danbooru.EL.lastids.subscribe[type] = jsontypelist[0];
            JSPLib.debug.debuglog(`Found ${type}(s)!`,Danbooru.EL.lastids.subscribe[type]);
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
}

/****Render functions****/

function RenderSubscribeDualLinks(type,itemid,tag,separator,ender,right=false) {
    let typelist = GetList(type);
    let subscribe = (typelist.includes(itemid) ? 'style="display:none !important"' : 'style');
    let unsubscribe = (typelist.includes(itemid) ? 'style' : 'style="display:none !important"');
    let spacer = (right ? "&nbsp;&nbsp;" : "");
    return `<${tag} data-id="${itemid}" class="subscribe-${type}" ${subscribe}><a href="#">${spacer}Subscribe${separator}${ender}</a></${tag}>` +
           `<${tag} data-id="${itemid}" class="unsubscribe-${type}" ${unsubscribe}"><a href="#">Unsubscribe${separator}${ender}</a></${tag}>`;
}

function RenderSubscribeMultiLinks(name,typelist,itemid,separator) {
    let itemdict = {};
    $.each(typelist,(i,type)=>{
        itemdict[type] = GetList(type);
    });
    let classname = (typelist.reduce((total,type)=>{return total && itemdict[type].includes(itemid);},true) ? 'el-subscribed' : 'el-unsubscribed');
    let idname = 'el-' + name.toLowerCase().replace(/[ _]/g,'-') + '-link';
    return `${separator}<li id="${idname}" data-id="${itemid}" data-type="${typelist}" class="${classname}"><a href="#">${name}</a></li>`;
}

function RenderOpenItemLinks(type,itemid,showtext="Show",hidetext="Hide") {
    return `<span data-id="${itemid}" class="show-full-${type}" style><a href="#">${showtext}</a></span>` +
           `<span data-id="${itemid}" class="hide-full-${type}" style="display:none !important"><a href="#">${hidetext}</a></span>`;
}

/****Initialize functions****/

function InitializeNoticeBox() {
    $("#page").prepend(notice_box);
    HideEventNoticeClick();
}

function InitializeOpenForumLinks($obj) {
    $.each($(".striped tbody tr",$obj),(i,$row)=>{
        let forumid = $row.id.match(/(\d+)$/)[1];
        $(".forum-post-excerpt",$row).prepend(RenderOpenItemLinks('forum',forumid) + '&nbsp;|&nbsp;');
    });
    OpenItemClick('forum',$obj,3,AddForumPost);
}

function InitializeOpenNoteLinks($obj) {
    $.each($(".striped tbody tr",$obj),(i,$row)=>{
        let noteid = $("td:nth-of-type(3) a:first-of-type",$row)[0].innerHTML.replace('.','-');
        $("td:nth-of-type(4)",$row).append('<p style="text-align:center">' + RenderOpenItemLinks('note',noteid,"Render note","Hide note") + '</p>');
    });
    OpenItemClick('note',$obj,4,AddRenderedNote);
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
    let menu_obj = $.parseHTML(menu_html);
    var postid = parseInt(JSPLib.utility.getMeta('post-id'));
    $("#el-add-links",menu_obj).append(RenderSubscribeMultiLinks("Comments",['comment'],postid,''));
    $("#el-add-links",menu_obj).append(RenderSubscribeMultiLinks("Notes",['note'],postid,' | '));
    $("#el-add-links",menu_obj).append(RenderSubscribeMultiLinks("Artist commentary",['commentary'],postid,' | '));
    $("#el-add-links",menu_obj).append(RenderSubscribeMultiLinks("Translations",['note','commentary'],postid,' | '));
    $("#el-add-links",menu_obj).append(RenderSubscribeMultiLinks("All",['comment','note','commentary'],postid,' | '));
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
    let menu_obj = $.parseHTML(menu_html);
    $("#el-add-links",menu_obj).append(RenderSubscribeMultiLinks("Topic",['forum'],topicid,'') + ' | ');
    $('a[href$="/subscribe"],a[href$="/unsubscribe"]').text("Email");
    let $email = $('a[href$="/subscribe"],a[href$="/unsubscribe"]').parent().detach();
    $("#el-add-links",menu_obj).append($email);
    $("nav#nav").append(menu_obj);
    SubscribeMultiLinkClick();
}

//#C-FORUM-TOPICS #A-INDEX
function InitializeTopicIndexLinks($obj) {
    $.each($(".striped tr td:first-of-type",$obj), (i,entry)=>{
        let topicid = parseInt(entry.innerHTML.match(/\/forum_topics\/(\d+)/)[1]);
        let linkhtml = RenderSubscribeDualLinks('forum',topicid,"span","","",true);
        $(entry).prepend(linkhtml + '&nbsp|&nbsp');
    });
    SubscribeDualLinkClick('forum');
}

//EVENT NOTICE
function InitializeNoteIndexLinks($obj) {
    $.each($(".striped tbody tr",$obj), (i,entry)=>{
        let postid = parseInt($("td:nth-of-type(2)",entry)[0].innerHTML.match(/\/posts\/(\d+)/)[1]);
        let linkhtml = RenderSubscribeDualLinks('note',postid,"span","","",true);
        $("td:nth-of-type(1)",entry).prepend(linkhtml);
    });
    SubscribeDualLinkClick('note');
}

//#C-COMMENTS #P-INDEX-BY-POST
function InitializeCommentPartialPostLinks() {
    $.each($("#p-index-by-post .comments-for-post"), (i,$entry)=>{
        let postid = parseInt($($entry).data('post-id'));
        let linkhtml = RenderSubscribeDualLinks('comment',postid,"div"," ","comments");
        $(".header",$entry).after(linkhtml);
    });
    SubscribeDualLinkClick('comment');
}

//#C-COMMENTS #P-INDEX-BY-COMMENT
function InitializeCommentPartialCommentLinks(selector) {
    $.each($(selector), (i,$entry)=>{
        var postid = parseInt($($entry).data('id'));
        var linkhtml = RenderSubscribeDualLinks('comment',postid,"div","<br>","comments");
        var $table = $.parseHTML(`<table><tbody><tr><td></td></tr><tr><td>${linkhtml}</td></tr></tbody></table>`);
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
        $.each(Danbooru.EL.lastids.user,(type,value)=>{
            SaveLastID(type,value);
        });
        $.each(Danbooru.EL.lastids.subscribe,(type,value)=>{
            SaveLastID(type,value);
            delete localStorage[`el-saved${type}list`];
            delete localStorage[`el-saved${type}lastid`];
            JSPLib.debug.debuglog(`Deleted saved values! (${type})`);
        });
        if ($("#hide-dmail-notice").length) {
            $("#hide-dmail-notice").click();
        }
        localStorage['el-events'] = false;
        Danbooru.EL.channel.postMessage({type: "hide"});
        e.preventDefault();
    });
}

function SubscribeMultiLinkClick() {
    $("#el-subscribe-events a").off().click((e)=>{
        let $container = $(e.target.parentElement);
        let post = $container.data('id');
        let typelist = $container.data('type').split(',');
        let subscribed = ($container.hasClass('el-subscribed') ? true : false);
        let current_subscribed = JSPLib.utility.setUnique($("#el-subscribe-events .el-subscribed").map((i,entry)=>{return entry.dataset.type.split(',');}).toArray());
        let new_subscribed = (subscribed ? JSPLib.utility.setDifference(current_subscribed,typelist) : JSPLib.utility.setUnion(current_subscribed,typelist));
        $.each($("#el-subscribe-events .el-subscribed,#el-subscribe-events .el-unsubscribed"),(i,entry)=>{
            let entry_typelist = entry.dataset.type.split(',');
            if (JSPLib.utility.setIntersection(entry_typelist,new_subscribed).length === entry_typelist.length) {
                $(entry).removeClass().addClass('el-subscribed');
            } else {
                $(entry).removeClass().addClass('el-unsubscribed');
            }
        });
        let prefix = (subscribed ? '-' : '');
        $.each(typelist,(i,type)=>{
            setTimeout(()=>{SetList(type,prefix + post);},1);
        });
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
        let show = (subscribed ? 'subscribe' : 'unsubscribe');
        let hide = (subscribed ? 'unsubscribe' : 'subscribe');
        JSPLib.utility.fullHide(`.${hide}-${type}[data-id="${itemid}"]`);
        JSPLib.utility.clearHide(`.${show}-${type}[data-id="${itemid}"]`);
        e.preventDefault();
    });
}

function OpenItemClick(type,$obj,parentlevel,htmlfunc) {
    $(`.show-full-${type} a,.hide-full-${type} a`).off().click(function(e){
        Danbooru.EL.openlist[type] = Danbooru.EL.openlist[type] || [];
        let $container = $(e.target.parentElement);
        let itemid = $container.data('id');
        let openitem = $container.hasClass(`show-full-${type}`);
        if (openitem && !Danbooru.EL.openlist[type].includes(itemid)) {
            let rowelement = JSPLib.utility.getNthParent(e.target,parentlevel);
            htmlfunc(itemid,rowelement);
            Danbooru.EL.openlist[type].push(itemid);
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
        e.preventDefault();
    });
}

/****Main****/

function main() {
    Danbooru.EL = {
        username: JSPLib.utility.getMeta('current-user-name'),
        userid: parseInt(JSPLib.utility.getMeta('current-user-id')),
        lastids: {
            user: {},
            subscribe: {}
        },
        subscribelist: {},
        openlist: {}
    };
    if (Danbooru.EL.username === "Anonymous") {
        JSPLib.debug.debuglog("User must log in!");
        return;
    } else if ((typeof Danbooru.EL.username !== "string") || !JSPLib.validate.validateID(Danbooru.EL.userid)) {
        JSPLib.debug.debuglog("Invalid meta variables!");
        return;
    }
    $("#dmail-notice").hide();
    Danbooru.EL.channel = new BroadcastChannel('EventListener');
    Danbooru.EL.channel.onmessage = (ev)=>{
        if (ev.data.type === "hide") {
            $("#event-notice").hide();
        }
    };
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
        if (CheckList('commentary') && CheckWaiting('commentary')) {
            promise_array.push(CheckSubscribeType('commentary'));
        }
        CheckAllEvents(promise_array).then(()=>{
            FreeSemaphore();
        });
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
    JSPLib.utility.setCSSStyle(eventlistener_css,'program');
}

/****Execution start****/

JSPLib.load.programInitialize(main,'EL',program_load_required_variables,program_load_required_selectors);
