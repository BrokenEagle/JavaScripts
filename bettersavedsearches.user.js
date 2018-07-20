// ==UserScript==
// @name         BetterSavedSearches
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      2.0
// @source       https://danbooru.donmai.us/users/23799
// @description  Provides an alternative mechanism and UI for saved searches
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/bettersavedsearches.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.5.2/localforage.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.12.0/validate.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180723/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180723/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180723/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180723/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180723/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180723/lib/danbooru.js
// ==/UserScript==

//Variables for debug.js
JSPLib.debug.debug_console = true;
JSPLib.debug.level = JSPLib.debug.INFO;
JSPLib.debug.pretext = "BSS:";

//Variables for utility.js
JSPLib.utility.max_column_characters = 15;

//Variables for danbooru.js
JSPLib.danbooru.counter_domname = "#bss-initialize-counter";

//Variables for load.js
const program_load_required_variables = ['window.jQuery','window.Danbooru'];

//Shouldn't be larger than the query size
const max_posts_size = 200;

//At around 1000 the URI becomes too long and errors out on Danbooru
//At around 500 Hijiribe/Sonohara refuses the connection
const html_query_size = 500;
const api_query_size = 100;

//Main function expires
const post_check_expires = 5 * JSPLib.utility.one_minute;
const query_recheck_expires = JSPLib.utility.one_hour;
const saved_search_expires = JSPLib.utility.one_day;
const normalize_expires = JSPLib.utility.one_week;

//Semaphore expires
const user_timeout_expires = 5 * JSPLib.utility.one_second;
const write_semaphore_expires = 5 * JSPLib.utility.one_second;
const process_semaphore_expires = JSPLib.utility.one_minute;

//Data expires
const pool_data_expires = JSPLib.utility.one_month;
const alias_data_expires =JSPLib.utility.one_month;

//Query expires
const metatag_minimum_expires = 16 * JSPLib.utility.one_hour;
const metatag_window_expires = 8 * JSPLib.utility.one_hour;

//Timeouts/intervals
const noncritical_tasks_timeout = JSPLib.utility.one_minute;
const polling_interval = 100;

//Only includes those metatags that aren't being handled
const META_TAGS = new RegExp('^(commenter|comm|noter|noteupdater|artcomm|ordpool|' +
                    '-?favgroup|-?fav|ordfav|md5|-?locked|width|height|mpixels|' +
                    'ratio|score|favcount|filesize|-?source|-?id|date|age|order|limit|' +
                    '-?approver|tagcount|pixiv_id|pixiv|search|upvote|downvote|' +
                    '-?flagger|-?appealer|gentags|chartags|copytags|arttags|metatags):(.*)$','i');

const saved_search_box = `
<section id="bss-saved-search-box">
    <h1>
        <a class="bss-link">Saved Searches</a>
        <a href="/posts?tags=search%3Aall">&raquo;</a>
        (<a class="bss-count" title="...">...</a>)
    </h1>
    <ul id="bss-saved-search-list" style="display:none">
    </ul>
    <div id="bss-message" style="display:none">Loading (<span id="bss-initialize-counter">0</span>)</div>
    <a id="toggle-bss-saved-searches" href="#">Toggle List</a>
</section>`;

const refresh_link = `
<li id="bss-refresh-saved-searches"><a href="#">Refresh BetterSavedSearches (<span id="bss-refresh-count">...</span>)</a></li>
<li id="bss-loading-saved-searches" style="display:none !important">BetterSavedSearches: Loading (<span id="bss-initialize-counter">0</span>)</li>`;

const validate_link = `<li id="bss-validate-saved-searches"><a href="#">Validate saved searches<span style="display:none"> (<span id="bss-initialize-counter">0</span>)</span></a></li>`;

const add_search_form = `
    <form class="simple_form" id="bss-new-saved-search">
        <div class="input">
            <label for="saved_search_query">Query</label>
            <input data-autocomplete="tag-query" type="text" id="saved_search_query" size="100">
        </div>
        <div class="input">
            <label for="saved_search_label_string">Labels</label>
            <input type="text" id="saved_search_label_string" size="40">
            <span class="hint">A list of tags to help categorize this search. Space delimited.</span>
        </div>
        <button type="button" class="ui-button ui-corner-all ui-widget">Submit</button>
    </form>`;

const program_css = `
#bss-saved-search-box {
    width: 200px;
}
#bss-message {
    font-size: 200%;
    margin: 10px;
}
.bss-clear {
    color: red;
    font-weight: bold;
}
.bss-reset {
    margin-left: -5px;
}
.bss-disabled > .bss-link {
    text-decoration: underline;
}
.bss-active > .bss-link {
    font-weight: bold;
}
.bss-metatags > .bss-link {
    color: green;
}
#bss-new-saved-search #saved_search_query {
    max-width: unset;
}
#bss-refresh-saved-searches a {
    color: green;
}
`;

validate.validators.boolean = function(value, options, key, attributes) {
    if (options !== false) {
        if (validate.isBoolean(value)) {
            return;
        }
        return "is not a boolean";
    }
};

validate.validators.hash = function(value, options, key, attributes) {
    if (options !== false) {
        if (validate.isHash(value)) {
            return;
        }
        return "is not a hash";
    }
};

const boolean_constraints = {
    presence: true,
    boolean: true
}

const hash_constraints = {
    presence: true,
    hash: true
}

const query_constraints = {
    queries: JSPLib.validate.array_constraints,
    queryentry: {
        id: JSPLib.validate.integer_constraints,
        checked: JSPLib.validate.integer_constraints,
        expires: JSPLib.validate.integer_constraints,
        seeded: JSPLib.validate.integer_constraints,
        updated: JSPLib.validate.integer_constraints,
        posts: JSPLib.validate.array_constraints,
        unseen: JSPLib.validate.array_constraints,
        exclude: JSPLib.validate.array_constraints,
        optional: JSPLib.validate.array_constraints,
        require: JSPLib.validate.array_constraints,
        labels: JSPLib.validate.array_constraints,
        tags: JSPLib.validate.stringonly_constraints,
        original: {
            string: {
                allowNull: true
            }
        },
        disabled: boolean_constraints,
        dirty: boolean_constraints,
        duplicate: boolean_constraints,
        metatags: boolean_constraints
    },
    postdata: JSPLib.validate.integer_constraints,
    tagdata: JSPLib.validate.stringonly_constraints
};

const relation_constraints = {
    entry: {
        expires : JSPLib.validate.expires_constraints,
        value: JSPLib.validate.array_constraints
    },
    value: JSPLib.validate.stringonly_constraints
};

const pool_constraints = {
    entry: {
        expires : JSPLib.validate.expires_constraints,
        value: hash_constraints
    },
    value: {
        id: JSPLib.validate.integer_constraints,
        name: JSPLib.validate.stringonly_constraints
    }
};

const posttime_constraints = {
    id: JSPLib.validate.integer_constraints,
    created: JSPLib.validate.integer_constraints
}

/****FUNCTIONS****/

//Validate functions

//For validating the base object
function ValidateIsArray(key,entry) {
    let check = validate({value: entry}, {value: JSPLib.validate.array_constraints});
    if (check !== undefined) {
        JSPLib.validate.printValidateError(key,check);
        return false;
    }
    return true;
}

function ValidateIsHash(key,entry) {
    let check = validate({value: entry}, {value: hash_constraints});
    if (check !== undefined) {
        JSPLib.validate.printValidateError(key,check);
        return false;
    }
    return true;
}

//For basic objects only, i.e. string, integer, etc.
function ValidateArrayValues(key,array,validator) {
    for (let i = 0;i < array.length; i++) {
        let check = validate({value: array[i]},{value: validator});
        if (check !== undefined) {
            JSPLib.debug.debuglog(key,`[${i}]`,array[i]);
            JSPLib.validate.printValidateError(key,check);
            return false;
        }
    }
    return true;
}

function ValidateQueriesTimer(key,queries) {
    JSPLib.debug.debugTime('BSS-ValidateQueries');
    let ret = ValidateQueries(key,queries);
    JSPLib.debug.debugTimeEnd('BSS-ValidateQueries');
    return ret;
}

function ValidateQueries(key,queries) {
    if (!ValidateIsArray(key,queries)) {
        return false;
    }
    for (let i = 0;i < queries.length;i++){
        if (!ValidateIsHash(key+`[${i}]`,queries[i])) {
            return false
        }
        let check = validate(queries[i],query_constraints.queryentry);
        if (check !== undefined) {
            JSPLib.debug.debuglog(key,`[${i}]`,queries[i]);
            JSPLib.validate.printValidateError(key,check);
            return false;
        }
        if (!ValidateArrayValues(key + '.posts',queries[i].posts,query_constraints.postdata) ||
            !ValidateArrayValues(key + '.unseen',queries[i].unseen,query_constraints.postdata) ||
            !ValidateArrayValues(key + '.exclude',queries[i].exclude,query_constraints.tagdata) ||
            !ValidateArrayValues(key + '.optional',queries[i].optional,query_constraints.tagdata) ||
            !ValidateArrayValues(key + '.require',queries[i].require,query_constraints.tagdata) ||
            !ValidateArrayValues(key + '.labels',queries[i].labels,JSPLib.validate.stringonly_constraints)) {
            return false;
        }
    }
    return true;
}

function ValidateRelationEntry(key,entry) {
    if (!ValidateIsHash(key,entry)) {
        return false
    }
    let check = validate(entry,relation_constraints.entry);
    if (check !== undefined) {
        JSPLib.validate.printValidateError(key,check);
        return false
    }
    return ValidateArrayValues(key+'.value',entry.value,relation_constraints.value)
}

function ValidatePoolEntry(key,entry) {
    if (!ValidateIsHash(key,entry)) {
        return false
    }
    let check = validate(entry,pool_constraints.entry);
    if (check !== undefined) {
        JSPLib.validate.printValidateError(key,check);
        return false
    }
    check = validate(entry.value,pool_constraints.value);
    if (check !== undefined) {
        JSPLib.validate.printValidateError(key,check);
        return false
    }
    return true;
}

function ValidatePostTimeEntry(key,entry) {
    if (!ValidateIsArray(key,entry)) {
        return false
    }
    for (let i = 0;i < entry.length;i++){
        if (!ValidateIsHash(key+`[${i}]`,entry[i])) {
            return false
        }
        let check = validate(entry[i],posttime_constraints);
        if (check !== undefined) {
            JSPLib.debug.debuglog(key,`[${i}]`,entry[i]);
            JSPLib.validate.printValidateError(key,check);
            return false;
        }
    }
    return true;
}

function ValidateExpires(actual_expires,expected_expires) {
    //Resolve to true if the actual_expires is bogus, has expired, or the expiration is too long
    return !Number.isInteger(actual_expires) || (Date.now() > actual_expires) || ((actual_expires - Date.now()) > expected_expires);
}

//Library functions

function DebugExecute(func) {
    if (JSPLib.debug.debug_console) {
        func();
    }
}

function GetExpiration(expires) {
    return Date.now() + expires;
}

function FullHide(selector) {
    $(selector).attr('style','display:none !important');
}

function FullShow(selector) {
    $(selector).attr('style','');
}

function ReverseIDFilter(items,idlist) {
    return items.filter((item)=>{return !idlist.includes(item.id);});
}

function TagOnlyRegExp (str) {
    return RegExp('^'+str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1") +'$','i');
}

//Helper functions

function ChooseAll() {
    return true;
}

function ChooseLabel(query,label) {
    return query.labels.includes(label);
}

function ChooseID(query,id) {
    return query.id == id;
}

function ClearPosts(type,choose,id) {
    QueryIterator((i,entry)=>{
        if (choose(entry,id)) {
            entry[type].length = 0
            if (type == 'posts') {
                entry.dirty = true;
                entry.disabled = true;
            }
        }
    });
}

function QueryIterator(func) {
    $.each(Danbooru.BSS.entries,(i,entry)=>{
        if (entry.duplicate) {
            return;
        }
        return func(i,entry);
    });
}

function QueryFilter(func) {
    return Danbooru.BSS.entries.filter((entry)=>{
        if (entry.duplicate) {
            return;
        }
        return func(entry);
    });
}

function QueryReduce(func,initial) {
    return Danbooru.BSS.entries.reduce((accumulator,entry)=>{
        if (entry.duplicate) {
            return accumulator;
        }
        return func(accumulator,entry);
    },initial);
}

function GetLabelEntry(label) {
    return {
        id: label,
        dirty: GetAnyDirty(label),
        unseen: GetPosts('unseen',ChooseLabel,label),
        posts: GetPosts('posts',ChooseLabel,label),
        disabled: GetAllDisabled(label),
        metatags: GetAnyMetatags(label)
    };
}

function GetPosts(type,choose,id) {
    return NormalizePosts(QueryReduce((total_posts,entry)=>{return (choose(entry,id) ? total_posts.concat(entry[type]) : total_posts);},[]));
}

function GetAnyDirty(label) {
    return QueryReduce((dirty,entry)=>{return (ChooseLabel(entry,label) ? dirty || entry.dirty : dirty);},false);
}

function GetAnyMetatags(label) {
    return QueryReduce((metatags,entry)=>{return (ChooseLabel(entry,label) ? metatags || entry.metatags : metatags);},false);
}

function GetAnyActive(label) {
    return QueryReduce((active,entry)=>{return (ChooseLabel(entry,label) ? active || (Danbooru.BSS.active_query == entry.id) : active);},false);
}

function GetAllDisabled(label) {
    return QueryReduce((disabled,entry)=>{return (ChooseLabel(entry,label) ? disabled && entry.disabled : disabled);},true);
}

function GetAllTags() {
    return JSPLib.utility.setUnique(QueryReduce((all_tags,entry)=>{return all_tags.concat(GetAllEntryTags(entry));},[]));
}

function GetAllEntryTags(entry) {
    return entry.require.concat(entry.exclude).concat(entry.optional);
}

//Storage functions

function CurrentDataIndex() {
    return JSPLib.storage.getStorageData('bss-dataindex', sessionStorage, 0);
}

function ActualDataIndex() {
    return JSPLib.storage.getStorageData('bss-dataindex', localStorage, 0);
}

function ReadCheckBSSEntries() {
    if (CurrentDataIndex() != ActualDataIndex()) {
        JSPLib.debug.debuglog("ReadCheckBSSEntries: Data has changed!");
        return true;
    }
    JSPLib.debug.debuglog("ReadCheckBSSEntries: Data has not changed!");
    return false;
}

function WriteCheckBSSEntries() {
    if (JSON.stringify(Danbooru.BSS.entries) !== JSON.stringify(Danbooru.BSS.old_entries)) {
        JSPLib.debug.debuglog("WriteCheckBSSEntries: Data has changed!");
        return true;
    }
    JSPLib.debug.debuglog("WriteCheckBSSEntries: Data has not changed!");
    return false;
}

async function LoadBSSEntries(global=false) {
    if (global) {
        Danbooru.BSS.entries = await JSPLib.storage.danboorustorage.getItem('bss-queries');
        StoreBSSEntries();
    } else {
        Danbooru.BSS.entries = await JSPLib.storage.retrieveData('bss-queries');
    }
    if (!ValidateQueriesTimer('bss-queries',Danbooru.BSS.entries)) {
        JSPLib.debug.debuglog("Data is invalid!");
        Danbooru.BSS.entries = [];
        Danbooru.BSS.dirty = true;
        await StoreBSSEntries(true);
    }
    Danbooru.BSS.dataindex = CurrentDataIndex();
}

async function StoreBSSEntries(global=false) {
    JSPLib.debug.debuglog("StoreBSSEntries", (global ? '(global)' : '(local)'), CurrentDataIndex(), '<==>', ActualDataIndex() + (global ? 1 : 0));
    if (global) {
        await JSPLib.storage.saveData('bss-queries', Danbooru.BSS.entries);
    } else {
        JSPLib.storage.setStorageData('bss-queries', Danbooru.BSS.entries, sessionStorage);
    }
    Danbooru.BSS.dataindex = ActualDataIndex();
    if (global) {
        Danbooru.BSS.dataindex += 1;
        JSPLib.storage.setStorageData('bss-dataindex', Danbooru.BSS.dataindex, localStorage);
        if (Danbooru.BSS.dirty) {
            Danbooru.BSS.channel.postMessage({type:"reinstall",entries:Danbooru.BSS.entries, dataindex:Danbooru.BSS.dataindex});
        } else {
            Danbooru.BSS.channel.postMessage({type:"reload",entries:Danbooru.BSS.entries, dataindex:Danbooru.BSS.dataindex});
        }
        Danbooru.BSS.dirty = false;
    }
    JSPLib.storage.setStorageData('bss-dataindex', Danbooru.BSS.dataindex, sessionStorage);
}

//Concurrency functions

function WriteCheck() {
    let semaphore = JSPLib.storage.getStorageData('bss-write-semaphore',localStorage,0);
    return ValidateExpires(semaphore, write_semaphore_expires);
}

async function WriteBlock(func) {
    JSPLib.debug.debuglog("WriteBlock - (ENTER)");
    JSPLib.storage.setStorageData('bss-write-semaphore', GetExpiration(write_semaphore_expires), localStorage);
    await func();
    JSPLib.storage.setStorageData('bss-write-semaphore', 0, localStorage);
    JSPLib.debug.debuglog("WriteBlock - (EXIT)");
}

function VerifySemaphore(transaction_semaphore) {
    let current_semaphore = JSPLib.storage.getStorageData('bss-query-semaphore',localStorage,0);
    return transaction_semaphore == current_semaphore;
}

function CheckSemaphore() {
    let semaphore = JSPLib.storage.getStorageData('bss-query-semaphore',localStorage,0);
    return ValidateExpires(semaphore, process_semaphore_expires);
}

function FreeSemaphore() {
    $(window).off('beforeunload.bss.semaphore');
    JSPLib.storage.setStorageData('bss-query-semaphore',0,localStorage);
}

async function ReserveSemaphore(blocking=false,user_initiated=false) {
    var timeout = (user_initiated ? GetExpiration(user_timeout_expires) : Infinity);
    if (Date.now() > timeout) {
        JSPLib.debug.debuglog("ReserveSemaphore: User initiated action!");
    }
    while (true) {
        let can_write = WriteCheck();
        let can_process = CheckSemaphore();
        if ((can_process || Date.now() > timeout) && can_write) {
            //Guarantee that leaving/closing tab reverts the semaphore
            $(window).on('beforeunload.bss.semaphore',function () {
                JSPLib.storage.setStorageData('bss-query-semaphore',0,localStorage);
            });
            //Set semaphore with an expires in case the program crashes
            let semaphore = GetExpiration(process_semaphore_expires);
            JSPLib.storage.setStorageData('bss-query-semaphore', semaphore, localStorage);
            return semaphore;
        }
        if (!blocking) {
            break;
        }
        JSPLib.debug.debuglog("ReserveSemaphore: Waiting on semaphore:",
            (can_process ? '' : '[process]'), (can_write ? '' : '[write]'));
        await JSPLib.utility.sleep(polling_interval);
    }
    return null;
}

//Passing in a failure callback makes this a non-blocking function
async function SafeTransaction(callbacks,user_initiated=false) {
    JSPLib.debug.debuglog("SafeTransaction - (ENTER)");
    let blocking = callbacks.failure == undefined;
    let semaphore = await ReserveSemaphore(blocking,user_initiated);
    if (semaphore) {
        if (ReadCheckBSSEntries()) {
            await LoadBSSEntries(true);
        }
        Danbooru.BSS.old_entries = JSPLib.utility.dataCopy(Danbooru.BSS.entries);
        let writes = [];
        await callbacks.success(writes);
        if (!VerifySemaphore(semaphore)) {
            JSPLib.debug.debuglog("SafeTransaction (ABORT): Lost the semaphore while processing!");
            return;
        }
        await WriteBlock(async ()=>{
            $.each(writes,(i,func)=>{
                func();
            });
            if (WriteCheckBSSEntries()) {
                await StoreBSSEntries(true);
            }
        });
        FreeSemaphore();
    } else {
        JSPLib.debug.debuglog("SafeTransaction (FAILED): Another tab holds the semaphore!");
        callbacks.failure.timer = setInterval(()=>{
            let can_write = WriteCheck();
            let can_process = CheckSemaphore();
            if (can_process && can_write) {
                clearInterval(callbacks.failure.timer);
                callbacks.failure();
            } else {
                JSPLib.debug.debuglog("SafeTransaction (failure): Waiting on semaphore:",
                    (can_process ? '' : '[process]'), (can_write ? '' : '[write]'));
            }
        },polling_interval);
    }
    JSPLib.debug.debuglog("SafeTransaction - (EXIT)");
}

//Render functions

//#C-POSTS #A-INDEX

function RenderSavedSearchList() {
    let posthtml = '';
    $.each(Danbooru.BSS.labels,(i,label)=>{
        posthtml += RenderSavedSearchLabel(label);
    });
    return posthtml;
}

function RenderSavedSearchLabel(label) {
    let posthtml = "";
    let label_queries = QueryFilter((entry)=>{return ChooseLabel(entry,label);}).sort((a,b)=>{return a.tags.localeCompare(b.tags);});
    $.each(label_queries,(i,query)=>{
        let options = SetLineOptions(query);
        let updated_string = new Date(0);
        updated_string.setUTCMilliseconds(query.checked);
        let preicon_html = `<span class="ui-icon collapsible-saved-search-links ui-icon-calendar" title="${updated_string.toString()}"></span>`;
        let query_string = (query.original ? query.original : query.tags);
        let pool_ids = GetPoolIDs(query_string);
        posthtml += RenderQueryLine("bss-detailed-query",query,options,pool_ids,preicon_html,query_string,query_string,true) + '\n        </li>';
    });
    let label_entry = GetLabelEntry(label);
    let label_options = SetLineOptions(label_entry);
    let preicon_html = `<a class="ui-icon collapsible-saved-search-links ui-icon-triangle-1-e"></a>`;
    let prehtml = RenderQueryLine("bss-label-query",label_entry,label_options,[],preicon_html,label,`search:${label}`,false);
    let display = (GetAnyActive(label) ? "" : "display:none");
    return prehtml + `\n    <ul style="${display}">` + posthtml + `\n    </ul>\n</li>`;
}

function SetLineOptions(entry) {
    return {
        count_enabled: (entry.unseen.length ? "" : "display:none"),
        clear_enabled: (!entry.unseen.length && entry.posts.length ? "" : "display:none"),
        reset_enabled: (!entry.unseen.length && !entry.posts.length ? "" : "display:none"),
        active_class: (Danbooru.BSS.active_query == entry.id ? " bss-active" : ''),
        disabled_class: (entry.disabled ? " bss-disabled" : ''),
        metatag_class: (entry.metatags ? " bss-metatags" : ''),
    };
}

function RenderQueryLine(classname,entry,options,pool_ids,preicon_html,linetext,linksearch,detailed) {
    let spacing = (detailed ? '        ' : '');
    let data_pools = (pool_ids.length ? ` data-pools="${pool_ids.join(',')}"` : '');
    return `
<li class="${classname}${options.active_class}${options.disabled_class}${options.metatag_class}" data-id="${entry.id}"${data_pools}>
    ${preicon_html}
    <a class="bss-link" title="${linetext}">${JSPLib.utility.maxLengthString(linetext)}</a>
    ${JSPLib.danbooru.postSearchLink(linksearch,'&raquo;')}
    <span class="bss-last-control">
        <span class="bss-count" style="${options.count_enabled}">(<a title="${entry.posts.length}">${entry.unseen.length}</a>)</span>
        <span class="bss-clear" style="${options.clear_enabled}"><a title="${entry.posts.length}">X</a></span>
        <span class="bss-reset" style="${options.reset_enabled}"><a class="ui-icon ui-icon-arrowrefresh-1-w"></a></span>
    </span>`.replace(/\n/g,'\n'+spacing);
}

//Rerenders all affected stats
function RecalculateTree() {
    JSPLib.debug.debugTime("BSS-RecalculateTree");
    QueryIterator((i,entry)=>{
        RecalculateLine(entry,'bss-detailed-query');
    });
    $.each(Danbooru.BSS.labels,(i,label)=>{
        RecalculateLine(GetLabelEntry(label),'bss-label-query');
    });
    if (QueryReduce((dirty,entry)=>{return dirty || entry.dirty;},false)) {
        JSPLib.debug.debuglog("Dirty BSS entries!");
        RecalculateMain();
        QueryIterator((i,entry)=>{entry.dirty = false});
    }
    JSPLib.debug.debugTimeEnd("BSS-RecalculateTree");
}

function RecalculateLine(entry,classname) {
    if (!entry.dirty) {
        return;
    }
    JSPLib.debug.debuglog("Dirty item:",entry.id);
    $(`.${classname}[data-id=${entry.id}] > span > .bss-count a`).html(entry.unseen.length);
    $(`.${classname}[data-id=${entry.id}] > span > .bss-count a`).attr('title',entry.posts.length);
    $(`.${classname}[data-id=${entry.id}] > span > .bss-clear a`).attr('title',entry.posts.length);
    $(`.${classname}[data-id=${entry.id}] > .bss-last-control > span`).hide();
    let show_control = 'bss-count';
    if (!entry.unseen.length && entry.posts.length) {
        show_control = 'bss-clear';
    } else if (!entry.unseen.length && !entry.posts.length) {
        show_control = 'bss-reset';
    }
    $(`.${classname}[data-id=${entry.id}]  > span > .${show_control}`).show();
    if (entry.disabled) {
        $(`.${classname}[data-id=${entry.id}]`).addClass('bss-disabled');
    } else {
        $(`.${classname}[data-id=${entry.id}]`).removeClass('bss-disabled');
    }
}

function RecalculateMain() {
    $("h1 > .bss-count").html(GetPosts('unseen',ChooseAll).length);
    $("h1 > .bss-count").attr('title',GetPosts('posts',ChooseAll).length);
}

//#C-SAVED-SEARCHES #A-INDEX

function RenderTableRow(saved_search) {
    let rowclass = $(".striped tr").length % 2 ? "even" : "odd";
    let rowlabels = saved_search.labels.map((label)=>{return JSPLib.danbooru.postSearchLink(`search:${label}`,label);}).join('\n        ');
    return `
<tr id="saved-search-${saved_search.id}" class="${rowclass}">
    <td>${JSPLib.danbooru.postSearchLink(saved_search.query,saved_search.query)}</td>
    <td>
        ${rowlabels}
    </td>
    <td class="links">
        <a href="/saved_searches/${saved_search.id}/edit">edit</a>
        | <a data-remote="true" rel="nofollow" data-method="delete" href="/saved_searches/${saved_search.id}">delete</a>
    </td>
</tr>`;
}

function RefreshLinkCount() {
    let program_queries = Danbooru.BSS.entries.map((entry)=>{return (entry.original ? entry.original : entry.tags);});
    let actual_queries = $(".striped td:first-of-type a").map((i,entry)=>{return entry.innerText;}).toArray();
    let query_difference = JSPLib.utility.setSymmetricDifference(program_queries,actual_queries);
    JSPLib.debug.debuglog("RefreshLinkCount:",query_difference);
    $("#bss-refresh-count").html(query_difference.length);
}

//Alias functions

async function QueryTagAlias(tag) {
    let consequent = [];
    let entryname = 'ta-'+tag;
    let storeditem = await JSPLib.storage.checkLocalDB(entryname,ValidateRelationEntry);
    if (!storeditem) {
        JSPLib.debug.debuglog("Querying alias:",tag);
        let data = await JSPLib.danbooru.submitRequest('tag_aliases',{search:{antecedent_name:tag,status:'active'}},[],entryname);
        if (data.length) {
            //Alias antecedents are unique, so no need to check the size
            JSPLib.debug.debuglog("Alias:",tag,data[0].consequent_name);
            consequent = [data[0].consequent_name];
        }
        JSPLib.storage.saveData(entryname,{value: consequent, expires: GetExpiration(alias_data_expires)});
    } else {
        consequent = storeditem.value;
        if (consequent.length) {
            JSPLib.debug.debuglog("Alias:",tag,consequent[0]);
        }
    }
    return {[tag]: consequent};
}

function GetLastConsequent(tag,tag_aliases) {
    if (!(tag in tag_aliases) || tag_aliases[tag].length == 0) {
        return tag;
    }
    return GetLastConsequent(tag_aliases[tag][0],tag_aliases);
}

//Pool functions

function GetPoolIDs(str) {
    return str.split(' ').filter((tag)=>{return tag.match(/^pool:\d+$/);}).map((pooltag)=>{return parseInt(pooltag.match(/:(\d+)/)[1]);});
}

async function GetPoolNameFromID(poolid) {
    let key = 'plid-' + poolid.toString();
    let storeditem = await JSPLib.storage.checkLocalDB(key,ValidatePoolEntry);
    if (storeditem) {
        return storeditem.value;
    } else {
        let pool = await JSPLib.danbooru.submitRequest(`pools/${poolid}`,{},{});
        let data = {};
        if (!$.isEmptyObject(pool)) {
            data = {id: pool.id, name: pool.name};
            JSPLib.storage.saveData('plname-' + data.name, {value: data, expires: GetExpiration(pool_data_expires)});
        } else {
            data = {id: poolid, name: "XXXXXXXX"};
        }
        JSPLib.storage.saveData(key, {value: data, expires: GetExpiration(pool_data_expires)});
        return data;
    }
}

async function GetPoolIDFromName(poolname) {
    let key = 'plname-' + poolname;
    let storeditem = await JSPLib.storage.checkLocalDB(key,ValidatePoolEntry);
    if (storeditem) {
        return storeditem.value;
    } else {
        let pools = await JSPLib.danbooru.submitRequest('pools',{ search:{order: "post_count", name_matches: poolname}, limit: 10},[]);
        pools = pools.filter((pool)=>{return pool.name.match(TagOnlyRegExp(poolname));});
        let data = {};
        if (pools.length) {
            data = {id: pools[0].id, name: pools[0].name};
            JSPLib.storage.saveData('plid-' + data.id, {value: data, expires: GetExpiration(pool_data_expires)});
        } else {
            data = {id: 0, name: poolname};
        }
        JSPLib.storage.saveData(key, {value: data, expires: GetExpiration(pool_data_expires)});
        return data;
    }
}

//Event handlers

//#C-POSTS #A-INDEX

function SearchClick(selector,level,posttype,choosepost) {
    $(selector).off().click(async (e)=>{
        if (!SearchClick.reserved) {
            let id = $(JSPLib.utility.getNthParent(e.target,level)).data('id');
            let posts = GetPosts(posttype,choosepost,id);
            JSPLib.debug.debuglog("SearchClick",id,posts.length);
            if (posts.length > 0) {
                await SafeTransaction({success:()=>{
                    ClearPosts('unseen',choosepost,id);
                }},true);
                JSPLib.storage.setStorageData('bss-active-query',id,sessionStorage);
                let idstring = "id:" + PostIDString(posts);
                window.location = window.location.origin + "/posts?tags=" + idstring;
            }
            SearchClick.reserved = false;
        }
        e.preventDefault();
    });
}

function ClearClick(selector,level,choosepost) {
    $(selector).click(async (e)=>{
        if (!ClearClick.reserved) {
            ClearClick.reserved = true;
            let $dom = $(JSPLib.utility.getNthParent(e.target,level));
            let id = $dom.data('id');
            JSPLib.debug.debuglog("ClearClick",id);
            await SafeTransaction({success:()=>{
                ClearPosts('posts',choosepost,id);
                ClearPosts('unseen',choosepost,id);
                RecalculateTree();
            }},true);
            $dom.addClass('bss-disabled');
            ClearClick.reserved = false;
        }
        e.preventDefault();
    });
}

function ResetClick(selector,level,choosepost) {
    $(selector).click(async (e)=>{
        if (!ResetClick.reserved) {
            ResetClick.reserved = true;
            let $dom = $(JSPLib.utility.getNthParent(e.target,level));
            let id = $dom.data('id');
            JSPLib.debug.debuglog("ResetClick!",id);
            $("#bss-saved-search-list").hide();
            $("#bss-message").show();
            await SafeTransaction({success:async ()=>{
                let promise_array = [];
                QueryIterator((i,entry)=>{
                    if (choosepost(entry,id)) {
                        entry.dirty = true;
                        entry.disabled = false;
                        promise_array.push(SeedQuery(entry));
                    }
                });
                await Promise.all(promise_array);
                RecalculateTree();
            }},true);
            $("#bss-message").hide();
            $("#bss-saved-search-list").show();
            ResetClick.reserved = false;
        }
        e.preventDefault();
    });
}

function DetailedSearchesToggle() {
    $(".collapsible-saved-search-links").click((e)=>{
        let label = $(e.target.parentElement).data('id');
        $(e.target).toggleClass("ui-icon-triangle-1-e ui-icon-triangle-1-s");
        $(`.bss-label-query[data-id=${label}] > ul`).slideToggle(100);
        e.preventDefault;
    });
}

function MainToggle() {
    $("#toggle-bss-saved-searches").off().click((e)=>{
        $("#bss-saved-search-list").slideToggle(100);
        if (Danbooru.Cookie.get('bss-hide-saved-searches') !== "1") {
            Danbooru.Cookie.put('bss-hide-saved-searches',1);
        } else {
            Danbooru.Cookie.put('bss-hide-saved-searches',0);
        }
        e.preventDefault();
    });
}

function BSSLinkHover() {
    $(".bss-detailed-query[data-pools] .bss-link").hover(async (e)=>{
        let $link = $(e.target);
        $link.unbind("mouseenter mouseleave");
        let pool_ids = $(e.target.parentElement).data('pools').toString().split(',').map((x)=>{return parseInt(x);});
        let title = $link.attr('title');
        JSPLib.debug.debuglog("BSSLinkHover:",title,pool_ids);
        let promise_array = pool_ids.map((poolid)=>{return GetPoolNameFromID(poolid);});
        let pools = await Promise.all(promise_array);
        $.each(pools,(i,pool)=>{
            title = title.split(' ').map((tag)=>{return tag.replace(TagOnlyRegExp(`pool:${pool.id}`),`pool:${pool.name}`);}).join(' ');
        });
        $link.attr('title',title);
    });
}

function PostIndexBroadcast(ev) {
    JSPLib.debug.debuglog("BroadcastChannel (index):",ev.data.type,Danbooru.BSS.dataindex,'->',ev.data.dataindex,':::',ActualDataIndex());
    if (ev.data.type == "reload") {
        QueryIterator((i,entry)=>{
            if (JSON.stringify(entry) !== JSON.stringify(ev.data.entries[i])) {
                ev.data.entries[i].dirty = true;
            }
        });
        Danbooru.BSS.entries = ev.data.entries;
        RecalculateTree();
    } else if (ev.data.type = "reinstall") {
        Danbooru.BSS.entries = ev.data.entries;
        InitializeUI();
    }
    Danbooru.BSS.dataindex = ev.data.dataindex;
    StoreBSSEntries();
}

//#C-SAVED-SEARCHES #A-INDEX

function RefreshLinkClick() {
    $("#bss-refresh-saved-searches a").click(async (e)=>{
        if (!RefreshLinkClick.reserved) {
            RefreshLinkClick.reserved = true;
            FullHide("#bss-refresh-saved-searches");
            FullShow("#bss-loading-saved-searches");
            await SafeTransaction({success:async (writes)=>{
                await CheckUserSavedSearches(writes,true);
                await NormalizeBSSEntries(writes,true);
            }},true);
            RefreshLinkCount();
            FullHide("#bss-loading-saved-searches");
            FullShow("#bss-refresh-saved-searches");
            Danbooru.notice("Saved searches updated.");
            RefreshLinkClick.reserved = false;
        }
        e.preventDefault;
    });
}

function SubmitNewQueryClick() {
    $("#bss-new-saved-search button").click(async (e)=>{
        let labels = $("#saved_search_label_string").val();
        let query = $("#saved_search_query").val();
        try {
            var saved_search = await $.post('/saved_searches.json',{saved_search:{query: query, label_string: labels}});
        } catch (e) {
            e = (typeof e === "object" && 'status' in e && 'responseText' in e ? e : {status: 999, responseText: "Bad error code!"});
            JSPLib.debug.debuglog("POST error:",e.status,e.responseText);
            Danbooru.notice(`HTTP Error ${e.status} creating saved search!`);
            return;
        }
        let html = RenderTableRow(saved_search);
        $(".striped tbody").append(html);
        SubmitDeleteClick();
        RefreshLinkCount();
        Danbooru.notice(`Saved search "${saved_search.query}" has been added.`);
    });
}

function SubmitDeleteClick() {
    //Add an extra event to the Delete click
    //Wait a bit for the table to be updated
    $(".striped [data-method=delete]").off().click((e)=>{
        setTimeout(()=>{RefreshLinkCount();}, 2 * JSPLib.utility.one_second);
    });
}

//#ALL OTHER PAGES

function NonPostIndexBroadcast(ev){
    JSPLib.debug.debuglog("BroadcastChannel (non-index):",ev.data.type,Danbooru.BSS.dataindex,'->',ev.data.dataindex,':::',ActualDataIndex());
    Danbooru.BSS.dataindex = ev.data.dataindex;
    Danbooru.BSS.entries = ev.data.entries;
    StoreBSSEntries();
}

//Query functions

function ParseQuery(string) {
    let entry = {
        "tags": string,
        "require": [],
        "optional": [],
        "exclude": [],
        "posts": [],
        "unseen": [],
        "metatags": false,
        "dirty": false,
        "disabled": false,
        "expires": 0,
        "duplicate": false,
        "original": null
    };
    let matches = string.match(/\S+/g) || [];
    $.each(matches, function(i, tag) {
        if (tag.match(META_TAGS)) {
            entry.metatags = true;
        } else if (tag.charAt(0) === '-') {
            entry.exclude.push(tag.slice(1));
        } else if (tag.charAt(0) === '~') {
            entry.optional.push(tag.slice(1));
        } else {
            entry.require.push(tag);
        }
    });
    return entry;
}

function UpdateQuery(post,query) {
    JSPLib.debug.debuglog("UpdateQuery",post.id,query);
    query.posts = NormalizePostsSlice(query.posts.concat(post.id));
    query.unseen = NormalizePostsSlice(query.unseen.concat(post.id));
    query.checked = Date.now();
}

async function SeedQuery(query,merge=false) {
    JSPLib.debug.debuglog("SeedQuery:",query);
    let addons = {tags: query.tags}
    let posts = await JSPLib.danbooru.submitRequest('posts',addons,[]);
    let post_ids = JSPLib.utility.getObjectAttributes(posts,'id');
    if (post_ids.length) {
        if (merge) {
            let unseen_posts = JSPLib.utility.setDifference(post_ids,query.posts);
            JSPLib.debug.debuglog("SeedQuery-Merge:",unseen_posts);
            query.unseen = NormalizePostsSlice(query.unseen.concat(unseen_posts));
            query.posts = NormalizePostsSlice(query.posts.concat(post_ids));
        } else {
            query.posts = post_ids;
            query.unseen = [];
        }
        if (query.metatags) {
            //Choose a random time between 16 - 24 hours
            query.expires = GetExpiration(Math.floor(metatag_minimum_expires + (Math.random() * metatag_window_expires)));
        }
    } else {
        query.unseen = [];
        query.posts = [];
        query.disabled = true;
    }
    query.checked = Date.now();
    query.seeded = Date.now();
}

function MergeQuery(oldquery,newquery) {
    oldquery.original = oldquery.tags;
    oldquery.tags = newquery.tags;
    oldquery.require = newquery.require;
    oldquery.exclude = newquery.exclude;
    oldquery.optional = newquery.optional;
}

//Select a query with a higher weight towards those with an older seed time
function ChooseRandomQuery() {
    let random_distance = {};
    let total_distance = 0;
    QueryIterator((i,entry)=>{
        if (entry.disabled || entry.metatags) {
            return;
        }
        let distance = Date.now() - entry.seeded;
        total_distance += distance;
        random_distance[entry.id] = {delta: distance};
    });
    let total_spread = 0;
    $.each(random_distance,(i,entry)=>{
        entry.begin = total_spread;
        entry.end = total_spread + Math.floor(1000 * (entry.delta / total_distance));
        total_spread = entry.end;
    });
    Danbooru.BSS.random_distance = random_distance;
    Danbooru.BSS.total_spread = total_spread;
    let random_pick = Danbooru.BSS.random_pick = Math.floor(total_spread * Math.random());
    let random_entry = null;
    QueryIterator((i,entry)=>{
        if (entry.disabled || entry.metatags) {
            return;
        }
        let id = entry.id;
        if ((random_pick >= random_distance[id].begin) && (random_pick < random_distance[id].end)) {
            random_entry = entry;
            return false;
        }
    });
    return random_entry;
}

function GeneratePostTags(post) {
    let tags = [post.tag_string,post.pool_string].join(' ').match(/\S+/g) || [];
    tags.push(`rating:{post.rating}`);
    tags.push(`user:post.uploader_name`);
    tags.push(post.has_children ? 'child:any' : 'child:none');
    tags.push(post.parent_id ? 'parent:any' : 'parent:none');
    tags.push(`filetype:${post.file_ext}`);
    post.is_deleted && tags.push('status:deleted');
    post.is_pending && tags.push('status:pending');
    post.is_flagged && tags.push('status:flagged');
    post.is_banned && tags.push('status:banned');
    !post.is_deleted && !post.is_pending && !post.is_flagged && tags.push('status:active');
    return tags;
}

function CheckPost(tags,query) {
    if (query.require.length && JSPLib.utility.setIntersection(tags,query.require).length != query.require.length) {
        return false;
    }
    if (query.optional.length && JSPLib.utility.setIntersection(tags,query.optional).length == 0) {
        return false;
    }
    if (query.exclude.length && JSPLib.utility.setIntersection(tags,query.exclude).length > 0) {
        return false;
    }
    return true;
}

function ProcessPosts(posts) {
    let all_tags = GetAllTags();
    $.each(posts,(i,post)=>{
        let post_tags = GeneratePostTags(post);
        if (JSPLib.utility.setIntersection(all_tags,post_tags).length > 0) {
            QueryIterator((j,query)=>{
                if (query.metatags || query.posts.includes(post.id)) {
                    return;
                }
                if (CheckPost(post_tags,query)) {
                    UpdateQuery(post,query);
                }
            });
        }
    });
}

//Normalize functions

async function NormalizeBSSEntries(writes,overide=false) {
    let expires = JSPLib.storage.getStorageData('bss-normalize-expires',localStorage,0);
    if (expires === 0) {
        //Doing this along with regular initialization ends up being a lot of network calls, so do it later
        JSPLib.debug.debuglog("NormalizeBSSEntries: Will intialize after one hour");
        writes.push(()=>{JSPLib.storage.setStorageData('bss-normalize-expires', GetExpiration(JSPLib.utility.one_hour), localStorage);});
    } else if(ValidateExpires(expires, normalize_expires) || overide) {
        JSPLib.debug.debuglog("NormalizeBSSEntries: Network");
        let old_entries = JSPLib.utility.dataCopy(Danbooru.BSS.entries);
        ResetBSSEntries();
        await UnaliasBSSEntries();
        await ReplacePoolNamesWithIDs();
        RemoveDuplicateBSSEntries();
        DebugExecute(()=>{
            for (let i = 0; JSPLib.debug.debug_console && i < old_entries.length; i++) {
                if (JSON.stringify(old_entries[i]) != JSON.stringify(Danbooru.BSS.entries[i])) {
                    JSPLib.debug.debuglog("NormalizeBSSEntries: Changed Entry!",old_entries[i],'->',Danbooru.BSS.entries[i]);
                }
            }
        });
        writes.push(()=>{JSPLib.storage.setStorageData('bss-normalize-expires', GetExpiration(normalize_expires), localStorage);});
    } else {
        JSPLib.debug.debuglog("No normalization of entries!");
    }
}

function ResetBSSEntries() {
    $.each(Danbooru.BSS.entries,(i,entry)=>{
        let reset_entry = ParseQuery(entry.original ? entry.original : entry.tags);
        MergeQuery(entry,reset_entry);
        entry.duplicate = false;
        entry.original = null;
    });
}

async function UnaliasBSSEntries() {
    JSPLib.debug.debuglog("UnaliasBSSEntries");
    let all_tags = GetAllTags().filter((tag)=>{return !tag.match(Danbooru.Autocomplete.METATAGS);});
    let alias_entries = await Promise.all(all_tags.map((tag)=>{return QueryTagAlias(tag);}));
    //Convert array of hashes into one hash
    let tag_aliases = alias_entries.reduce((a,b)=>{return Object.assign(a,b);});
    let change_tags = all_tags.reduce((changes,tag)=>{return (tag != GetLastConsequent(tag,tag_aliases) ? changes.concat(tag) : changes);},[]);
    if (!change_tags.length) {
        JSPLib.debug.debuglog("No tags to unalias!")
        return;
    }
    $.each(Danbooru.BSS.entries,(i,entry)=>{
        let affected_tags = JSPLib.utility.setIntersection(change_tags,GetAllEntryTags(entry));
        if (affected_tags.length == 0) {
            return;
        }
        JSPLib.debug.debuglog("UnaliasBSSEntries: Found affected entry",entry);
        let query_string = entry.tags;
        $.each(affected_tags,(j,tag)=>{
            query_string = query_string.split(' ').map((tag)=>{return tag.replace(TagOnlyRegExp(tag),GetLastConsequent(tag,tag_aliases));}).join(' ');
        });
        JSPLib.debug.debuglog("UnaliasBSSEntries: Query change",entry.tags,"->",query_string);
        MergeQuery(entry,ParseQuery(query_string));
    });
}

async function ReplacePoolNamesWithIDs() {
    JSPLib.debug.debuglog("ReplacePoolNamesWithIDs");
    let all_pools = JSPLib.utility.filterRegex(GetAllTags(),/^pool:(?!\d*$)/);
    if (!all_pools.length) {
        JSPLib.debug.debuglog("No pool names to replace!")
        return;
    }
    let pools = await Promise.all(all_pools.map((pooltag)=>{return GetPoolIDFromName(pooltag.match(/:(.*)/)[1]);}));
    $.each(Danbooru.BSS.entries,(i,entry)=>{
        let affected_tags = JSPLib.utility.setIntersection(all_pools,GetAllEntryTags(entry));
        if (affected_tags.length == 0) {
            return;
        }
        JSPLib.debug.debuglog("ReplacePoolNamesWithIDs: Found affected pool entry",entry);
        let query_string = entry.tags;
        $.each(affected_tags,(j,pooltag)=>{
            let pool_id = pools.filter((pool)=>{return pooltag.match(TagOnlyRegExp('pool:' + pool.name));});
            if (pool_id.length == 0 || pool_id[0].id == 0) {
                return;
            }
            query_string = query_string.split(' ').map((tag)=>{return tag.replace(TagOnlyRegExp(pooltag),'pool:' + pool_id[0].id);}).join(' ');
        });
        JSPLib.debug.debuglog("ReplacePoolNamesWithIDs: Query change",entry.tags,"->",query_string);
        MergeQuery(entry,ParseQuery(query_string));
    });
}


function RemoveDuplicateBSSEntries() {
    JSPLib.debug.debuglog("RemoveDuplicateBSSEntries");
    for (let i = 0;i < Danbooru.BSS.entries.length - 1; i++) {
        let entry_a = Danbooru.BSS.entries[i];
        for (let j = i + 1;j < Danbooru.BSS.entries.length; j++) {
            let entry_b = Danbooru.BSS.entries[j];
            let metatag_queries = entry_a.metatags && entry_b.metatags;
            let require_match = !metatag_queries && !JSPLib.utility.setSymmetricDifference(entry_a.require,entry_b.require).length;
            let exclude_match = !metatag_queries && !JSPLib.utility.setSymmetricDifference(entry_a.exclude,entry_b.exclude).length;
            let optional_match = !metatag_queries && !JSPLib.utility.setSymmetricDifference(entry_a.optional,entry_b.optional).length;
            if (require_match && exclude_match && optional_match || (entry_a.tags == entry_b.tags)) {
                JSPLib.debug.debuglog("Duplicate entries found:", entry_a);
                entry_a.unseen = NormalizePosts(entry_a.unseen.concat(entry_b.unseen));
                entry_a.posts = NormalizePosts(entry_a.posts.concat(entry_b.posts));
                entry_b.duplicate = true;
            }
        }
    }
}

//Post helper functions

function NormalizePosts(postids) {
    return JSPLib.utility.setUnique(postids).sort(function(a, b){return b - a});
}

function NormalizePostsSlice(postids) {
    return NormalizePosts(postids).slice(0,max_posts_size);
}

function PostIDString(postids) {
    return postids.slice(0,html_query_size).join(',');
}

function TimePostsFilter(posts,key,time,compare) {
    switch (compare) {
        case "gt": return posts.filter((post)=>{return (new Date(post[key]).getTime() + time) < Date.now();});
        case "lt": return posts.filter((post)=>{return (new Date(post[key]).getTime() + time) > Date.now();});
    }
}

//Post check functions

//Process all posts more than 5 minutes old; setup secondary pass for posts newer than 1 hour
//This will catch most of the uploads from good taggers
async function InitialPass(writes) {
    let options = {reverse: true};
    let pageid = JSPLib.storage.getStorageData('bss-first-pass-resume',localStorage);
    if (Number.isInteger(pageid) && (pageid > 0)) {
        options.page = pageid;
    }
    JSPLib.debug.debuglog("InitialPass: Network",pageid);
    let posts = await JSPLib.danbooru.getAllItems('posts', api_query_size, options);
    let initial_posts = TimePostsFilter(posts, 'created_at', 5 * JSPLib.utility.one_minute, "gt");
    if (initial_posts.length) {
        ProcessPosts(initial_posts);
        let secondary_posts = TimePostsFilter(initial_posts, 'created_at', JSPLib.utility.one_hour, "lt");
        secondary_posts = secondary_posts.map((post)=>{return {id: post.id, created: new Date(post.created_at).getTime()};});
        JSPLib.debug.debuglog("Initial -> Secondary",secondary_posts);
        if (secondary_posts.length) {
            let storage_posts = JSPLib.storage.getStorageData('bss-secondary-pass',localStorage,[]);
            storage_posts = (ValidatePostTimeEntry('bss-secondary-pass',storage_posts) ? storage_posts : []);
            Danbooru.BSS.secondary_pass = storage_posts.concat(secondary_posts);
            writes.push(()=>{JSPLib.storage.setStorageData('bss-secondary-pass',Danbooru.BSS.secondary_pass,localStorage);});
        }
        writes.push(()=>{JSPLib.storage.setStorageData('bss-first-pass-resume',JSPLib.danbooru.getNextPageID(initial_posts,true),localStorage);});
    } else {
        JSPLib.debug.debuglog("No initial pass!");
    }
}

//Process all posts more than one hour old that were set aside during installation or InitialPass
//This will catch most uploads that get tagged better by other users
async function SecondaryPass(writes) {
    if (!Danbooru.BSS.secondary_pass) {
        let saved_posts = JSPLib.storage.getStorageData('bss-secondary-pass',localStorage,[]);
        Danbooru.BSS.secondary_pass = (ValidatePostTimeEntry('bss-secondary-pass',saved_posts) ? saved_posts : []);
    }
    let process_posts = TimePostsFilter(Danbooru.BSS.secondary_pass, 'created', JSPLib.utility.one_hour, "gt");
    if (process_posts.length) {
        let process_ids = NormalizePostsSlice(JSPLib.utility.getObjectAttributes(process_posts,'id'));
        let options = {addons: {tags: "id:" + PostIDString(process_ids)}};
        JSPLib.debug.debuglog("SecondaryPass: Network",process_ids);
        let posts = await JSPLib.danbooru.getAllItems('posts', api_query_size, options);
        ProcessPosts(posts);
        let remaining_posts = ReverseIDFilter(Danbooru.BSS.secondary_pass,process_ids);
        JSPLib.debug.debuglog("SecondaryPass: Remaining",remaining_posts);
        writes.push(()=>{JSPLib.storage.setStorageData('bss-secondary-pass',remaining_posts,localStorage);});
    } else {
        JSPLib.debug.debuglog("No secondary pass!");
    }

}

//Selects a random query every time period and runs a fresh reseed + merge
//This should catch any posts that slip by the one hour mark
async function RandomQueryRecheck(writes) {
    let expires = JSPLib.storage.getStorageData('bss-query-recheck-expires',localStorage,0);
    if (ValidateExpires(expires, query_recheck_expires)) {
        //Don't process right after initialization
        if (expires > 0) {
            JSPLib.debug.debuglog("Network: RandomQueryRecheck");
            let query = ChooseRandomQuery();
            if (query) {
                await SeedQuery(query,true);
            }
        }
        writes.push(()=>{JSPLib.storage.setStorageData('bss-query-recheck-expires', GetExpiration(query_recheck_expires), localStorage);});
    } else {
        JSPLib.debug.debuglog("No random query recheck!");
    }
}

//Processes one metatag query per page load if the entry has expired
async function DailyMetatagRecheck() {
    let promise_array = [];
    QueryIterator((i,entry)=>{
        if (entry.metatags && !entry.disabled && Date.now() > entry.expires) {
            JSPLib.debug.debuglog("Network: DailyMetatagRecheck");
            promise_array.push(SeedQuery(entry,true));
            return false;
        }
    });
    if (!promise_array.length) {
        JSPLib.debug.debuglog("No daily metatag recheck!");
    }
    await Promise.all(promise_array);
}

//Main execution functions

async function CheckUserSavedSearches(writes,overide=false) {
    let expires = JSPLib.storage.getStorageData('bss-saved-search-expires',localStorage,0);
    if (ValidateExpires(expires, saved_search_expires) || overide || Danbooru.BSS.entries.length == 0) {
        JSPLib.debug.debuglog("Network: CheckUserSavedSearches");
        let saved_searches = await JSPLib.danbooru.submitRequest('saved_searches',[]);
        let query_ids = JSPLib.utility.getObjectAttributes(Danbooru.BSS.entries,'id');
        let promise_array = [];
        Danbooru.BSS.dirty = false;
        $.each(saved_searches,(i,entry)=>{
            let entry_time = new Date(entry.updated_at).getTime();
            let index = query_ids.indexOf(entry.id);
            if (index >= 0) {
                if (entry_time > Danbooru.BSS.entries[index].updated) {
                    JSPLib.debug.debuglog("Splicing out old entry",Danbooru.BSS.entries[index]);
                    Danbooru.BSS.entries.splice(index,1);
                    query_ids = JSPLib.utility.getObjectAttributes(Danbooru.BSS.entries,'id');
                } else{
                    return;
                }
            }
            JSPLib.debug.debuglog("Adding search:",entry);
            let query = ParseQuery(entry.query);
            query.updated = entry_time;
            query.id = entry.id;
            query.labels = entry.labels;
            Danbooru.BSS.entries.push(query);
            promise_array.push(SeedQuery(query));
            Danbooru.BSS.dirty = true;
        });
        await Promise.all(promise_array);
        let current_ids = JSPLib.utility.getObjectAttributes(saved_searches,'id');
        let removed_ids = JSPLib.utility.setDifference(query_ids,current_ids);
        if (removed_ids.length) {
            JSPLib.debug.debuglog("Removing old entries!",removed_ids);
            Danbooru.BSS.entries = ReverseIDFilter(Danbooru.BSS.entries,removed_ids);
            Danbooru.BSS.dirty = true;
        }
        writes.push(()=>{JSPLib.storage.setStorageData('bss-saved-search-expires', GetExpiration(saved_search_expires), localStorage);});
    } else {
        JSPLib.debug.debuglog("No check of user saved searches!");
    }
}

async function CheckRecentUploads(writes) {
    let expires = JSPLib.storage.getStorageData('bss-post-check-expires',localStorage,0);
    if (ValidateExpires(expires, post_check_expires)) {
        if (expires === 0) {
            //Only gets executed upon first install
            let resumewait = JSPLib.danbooru.submitRequest('posts',{tags: "age:>5mi",limit: 1},[]).then((data)=>{
                if (data.length) {
                    writes.push(()=>{JSPLib.storage.setStorageData('bss-first-pass-resume',data[0].id,localStorage);});
                }
            });
            let secondarywait = JSPLib.danbooru.submitRequest('posts',{tags: "age:5mi..60mi"},[]).then((data)=>{
                let secondpass_data = data.map(val=>{
                    let entry_time = new Date(val.created_at).getTime();
                    return {id: val.id, created: entry_time}
                });
                writes.push(()=>{JSPLib.storage.setStorageData('bss-secondary-pass',secondpass_data,localStorage);});
            });
            await Promise.all([resumewait,secondarywait]);
        } else if (Danbooru.BSS.entries.length) {
            //Main execution portion
            await InitialPass(writes);
            await SecondaryPass(writes);
            await Promise.all([
                RandomQueryRecheck(writes),
                DailyMetatagRecheck()
            ]);
        }
        writes.push(()=>{JSPLib.storage.setStorageData('bss-post-check-expires', GetExpiration(post_check_expires), localStorage);});
    } else {
        JSPLib.debug.debuglog("No check of recent uploads!");
    }
}

function InitializeUI() {
    JSPLib.debug.debuglog("Initializing user interface!");
    JSPLib.debug.debugTime('BSS-InitializeUI');
    Danbooru.BSS.labels = QueryReduce((a,b,result)=>{return a.concat(b.labels);},[]);
    Danbooru.BSS.labels = JSPLib.utility.setUnique(Danbooru.BSS.labels).sort();
    Danbooru.BSS.active_query = Danbooru.BSS.active_query || JSPLib.storage.getStorageData('bss-active-query',sessionStorage);
    sessionStorage.removeItem('bss-active-query');
    $("#bss-saved-search-list").html(RenderSavedSearchList());
    RecalculateMain();
    if (Danbooru.Cookie.get('bss-hide-saved-searches') !== "1") {
        $("#bss-saved-search-list").show();
        $("#bss-message").hide();
    }
    SearchClick("h1 > .bss-link",0,'posts',ChooseAll);
    SearchClick("h1 > .bss-count",0,'unseen',ChooseAll);
    SearchClick(".bss-label-query > .bss-link",1,'posts',ChooseLabel);
    SearchClick(".bss-label-query > span > .bss-count a",3,'unseen',ChooseLabel);
    ClearClick(".bss-label-query > span > .bss-clear a",3,ChooseLabel);
    ResetClick(".bss-label-query > span > .bss-reset a",3,ChooseLabel);
    SearchClick(".bss-detailed-query .bss-link",1,'posts',ChooseID);
    SearchClick(".bss-detailed-query .bss-count a",3,'unseen',ChooseID);
    ClearClick(".bss-detailed-query .bss-clear a",3,ChooseID);
    ResetClick(".bss-detailed-query .bss-reset a",3,ChooseID);
    MainToggle();
    DetailedSearchesToggle();
    BSSLinkHover();
    JSPLib.debug.debugTimeEnd('BSS-InitializeUI');
}

//Main function
async function main() {
    if (Danbooru.meta('current-user-name') === "Anonymous") {
        JSPLib.debug.debuglog("User must log in!");
        return;
    }

    JSPLib.debug.debugTime("BSS-Main");
    var post_index = Boolean($("#c-posts #a-index").length);
    var searches_index = Boolean($("#c-saved-searches #a-index").length);

    //Render the barebones HTML early on
    if (post_index || searches_index) {
        JSPLib.utility.setCSSStyle(program_css);
    }
    if (post_index) {
        JSPLib.debug.debuglog("Adding user interface!");
        $("#tag-box").before(saved_search_box);
        if (Danbooru.Cookie.get('bss-hide-saved-searches') !== "1") {
            $("#bss-message").show();
        }
    } else if (searches_index) {
        $("#nav menu:last-of-type").append(refresh_link);
        $(".striped").after(add_search_form);
        RefreshLinkClick();
        SubmitNewQueryClick();
        SubmitDeleteClick();
    }

    //Load and/or process the data
    Danbooru.BSS = Danbooru.BSS || {};
    Danbooru.BSS.channel = new BroadcastChannel('BetterSavedSearches');
    await LoadBSSEntries();
    await SafeTransaction({success:async (writes)=>{
        await CheckUserSavedSearches(writes);
        await CheckRecentUploads(writes);
    },
    failure:async ()=>{
        JSPLib.debug.debuglog("Main: SafeTransaction->Failure");
        if (ReadCheckBSSEntries()) {
            //Should never get here if broadcast message is working!!
            JSPLib.debug.debuglog("Main: Failsafe reload!!");
            await LoadBSSEntries(true);
            if (post_index) {
                InitializeUI();
            }
        }
        if (searches_index) {
            //There's no huge cost, so execute this regardless
            RefreshLinkCount();
        }
    }});

    //Initialize UI after getting data
    if (post_index) {
        InitializeUI();
        Danbooru.BSS.channel.onmessage = PostIndexBroadcast;
    } else {
        Danbooru.BSS.channel.onmessage = NonPostIndexBroadcast;
    }
    if (searches_index) {
        RefreshLinkCount();
    }

    //Take care of other non-critical tasks at a later time
    setTimeout(()=>{
        SafeTransaction({success:async (writes)=>{
            await NormalizeBSSEntries(writes);
        }});
    },JSPLib.utility.one_minute);

    JSPLib.debug.debugTimeEnd("BSS-Main");
}

/****Execution start****/

JSPLib.load.programInitialize(main,'BSS',program_load_required_variables);
