/****DEPENDENCIES****/

/**External dependencies**/
// jQuery
// JSPLib.utility
// JSPLib.network

/****SETUP****/

//Linter configuration
/* global JSPLib jQuery */

var JSPLib = JSPLib || {};
JSPLib.danbooru = JSPLib.danbooru || {};

//Has debug.js been loaded?
JSPLib.debug = JSPLib.debug || {};
JSPLib.debug.debuglogLevel = JSPLib.debug.debuglogLevel || (()=>{});
JSPLib.debug.recordTime = JSPLib.debug.recordTime || (()=>{});
JSPLib.debug.recordTimeEnd = JSPLib.debug.recordTimeEnd || (()=>{});

/****GLOBAL VARIABLES****/

JSPLib.danbooru.num_network_requests = 0;
JSPLib.danbooru.max_network_requests = 25;

/****FUNCTIONS****/

JSPLib.danbooru.submitRequest = async function (type,url_addons={},default_val=null,key,domain='',notify_user=false) {
    key = key || String(JSPLib.utility.getUniqueID());
    if (JSPLib.danbooru.num_network_requests >= JSPLib.danbooru.max_network_requests) {
        await JSPLib.network.rateLimit('danbooru');
    }
    JSPLib.network.incrementCounter('danbooru');
    JSPLib.debug.recordTime(key,'Network');
    try {
        return await jQuery.getJSON(`${domain}/${type}.json`,url_addons
        ).always(()=>{
            JSPLib.debug.recordTimeEnd(key,'Network');
            JSPLib.network.decrementCounter('danbooru');
        });
    } catch(e) {
        //Swallow exception... will return default value
        e = e = JSPLib.network.processError(e,"danbooru.submitRequest");
        let error_key = `${domain}/${type}.json?${jQuery.param(url_addons)}`;
        JSPLib.network.logError(error_key,e);
        if (notify_user) {
            JSPLib.network.notifyError(e);
        }
        return default_val;
    }
};

JSPLib.danbooru.getAllItems = async function (type,limit,batches,options) {
    let url_addons = options.addons || {};
    let reverse = options.reverse || false;
    let page_modifier = (reverse ? 'a' : 'b');
    let page_addon = (Number.isInteger(options.page) ? {page:`${page_modifier}${options.page}`} : {});
    let limit_addon = {limit: limit};
    let batch_num = 1;
    var return_items = [];
    while (true) {
        let request_addons = JSPLib.utility.joinArgs(url_addons,page_addon,limit_addon);
        let temp_items = await JSPLib.danbooru.submitRequest(type,request_addons,[],null,options.domain,options.notify);
        return_items = JSPLib.utility.concat(return_items, temp_items);
        if (temp_items.length < limit || (batches && batch_num >= batches)) {
            return return_items;
        }
        let lastid = JSPLib.danbooru.getNextPageID(temp_items,reverse);
        page_addon = {page:`${page_modifier}${lastid}`};
        JSPLib.debug.debuglogLevel("danbooru.getAllItems - #",batch_num++,"Rechecking",type,"@",lastid,JSPLib.debug.INFO);
    }
};

JSPLib.danbooru.getPostsCountdown = async function (query,limit,only,domname) {
    let tag_addon = {tags: query};
    let only_addon = (only ? {only: only} : {});
    let limit_addon = {limit: limit};
    let page_addon = {};
    var return_items = [];
    let page_num = 0;
    if (domname) {
        let count_resp = await JSPLib.danbooru.submitRequest('counts/posts',tag_addon,{counts:{posts: 0}});
        try {
            page_num = Math.ceil(count_resp.counts.posts/limit);
        } catch (e) {
            JSPLib.debug.debuglogLevel("danbooru.getPostsCountdown - Malformed count response",count_resp,e,JSPLib.debug.ERROR);
            page_num = '<span title="Malformed count response" style="color:red">Error!</span>';
        }
    }
    while (true) {
        JSPLib.debug.debuglogLevel("danbooru.getPostsCountdown - Pages left #",page_num,JSPLib.debug.INFO);
        if (domname) {
            jQuery(domname).html(page_num);
        }
        let request_addons = JSPLib.utility.joinArgs(tag_addon,limit_addon,only_addon,page_addon);
        let request_key = 'posts-' + jQuery.param(request_addons);
        let temp_items = await JSPLib.danbooru.submitRequest('posts',request_addons,[],request_key);
        return_items = JSPLib.utility.concat(return_items, temp_items);
        if (temp_items.length < limit) {
            return return_items;
        }
        let lastid = JSPLib.danbooru.getNextPageID(temp_items,false);
        page_addon = {page:`b${lastid}`};
        if (Number.isInteger(page_num)) {
            page_num -= 1;
        }
    }
};

//Helper functions

JSPLib.danbooru.getNextPageID = function (array,reverse) {
    let ChooseID = (reverse ? Math.max : Math.min);
    return ChooseID(...array.map(val=>{return val.id;}));
};

//Tag functions

JSPLib.danbooru.getShortName = function (category) {
    let shortnames = ['art','char','copy','gen','meta'];
    for (let i = 0;i < shortnames.length ; i++) {
        if (category.search(RegExp(shortnames[i])) === 0) {
            return shortnames[i];
        }
    }
};

JSPLib.danbooru.randomDummyTag = function () {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    var result = '';
    for (var i = 8; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
    return 'dummytag-' + result;
};

JSPLib.danbooru.tagOnlyRegExp = function (str) {
    return RegExp('^' + str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1") + '$','i');
};

//Note: Currently doesn't work on Firefox
JSPLib.danbooru.tagRegExp = function (str) {
    return RegExp('(?<=(?:^|\\s))' + str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1") + '(?=(?:$|\\s))', 'gi');
};

//Page functions

JSPLib.danbooru.getShowID = function() {
    return (document.body.dataset.action === "show" && parseInt(JSPLib.utility.findAll(window.location.pathname,/\d+\/?$/)[0])) || 0;
};

JSPLib.danbooru.isProfilePage = function() {
    return window.location.pathname === '/profile' || (document.body.dataset.controller === "users" && JSPLib.danbooru.getShowID() === parseInt(JSPLib.utility.getMeta('current-user-id')));
};

JSPLib.danbooru.isSettingMenu = function () {
    return document.body.dataset.controller === "users" && document.body.dataset.action === "edit";
};

//Render functions

JSPLib.danbooru.postSearchLink = function (tag_string,text,options="") {
    let tag_param = jQuery.param({tags:tag_string}).replace(/%20/g,'+');
    return `<a ${options} href="/posts?${tag_param}">${text}</a>`;
};

JSPLib.danbooru.wikiLink = function (tag,text,options="") {
    return `<a ${options} href="/wiki_pages/show_or_new?title=${encodeURIComponent(tag)}">${text}</a>`;
};

/****INITIALIZATION****/

JSPLib.danbooru._configuration = {
    nonenumerable: ['_configuration'],
    nonwritable: ['_configuration']
};
Object.defineProperty(JSPLib,'danbooru',{configurable:false,writable:false});
for (let property in JSPLib.danbooru) {
    if (property in JSPLib.danbooru._configuration.nonenumerable) {
        Object.defineProperty(JSPLib.danbooru,property,{enumerable:false});
    }
    if (property in JSPLib.danbooru._configuration.nonwritable) {
        Object.defineProperty(JSPLib.danbooru,property,{writable:false});
    }
    Object.defineProperty(JSPLib.danbooru,property,{configurable:false});
}
