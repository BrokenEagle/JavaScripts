/****DEPENDENCIES****/

/**External dependencies**/
// jQuery

/****SETUP****/

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
JSPLib.danbooru.rate_limit_wait = 1000;  // 1 second
JSPLib.danbooru.counter_domname = null;

/****FUNCTIONS****/

JSPLib.danbooru.submitRequest = async function (type,url_addons,default_val=null,key) {
    key = key || JSPLib.danbooru.randomDummyTag();
    if (JSPLib.danbooru.num_network_requests >= JSPLib.danbooru.max_network_requests) {
        await JSPLib.danbooru.rateLimit();
    }
    JSPLib.danbooru.incrementCounter();
    JSPLib.debug.recordTime(key,'Network');
    try {
        return await jQuery.getJSON(`/${type}`,url_addons
        ).always(()=>{
            JSPLib.debug.recordTimeEnd(key,'Network');
            JSPLib.danbooru.decrementCounter();
        });
    } catch(e) {
        //Swallow exception... will return undefined
        e = (typeof e === "object" && 'status' in e && 'responseText' in e ? e : {status: 999, responseText: "Bad error code!"});
        JSPLib.debug.debuglogLevel("SubmitRequest error:",e.status,e.responseText,JSPLib.debug.ERROR);
        return default_val;
    }
}

JSPLib.danbooru.getAllItems = async function (type,limit,options) {
    let url_addons = options.addons || {};
    let reverse = options.reverse || false;
    let page_modifier = (reverse ? 'a' : 'b');
    let page_addon = (options.page ? {page:`${page_modifier}${options.page}`} : {});
    let limit_addon = {limit: limit};
    var return_items = [];
    while (true) {
        let request_addons = JSPLib.danbooru.joinArgs(url_addons,page_addon,limit_addon);
        let request_key = jQuery.param(request_addons);
        let temp_items = await JSPLib.danbooru.submitRequest(type,request_addons,[],request_key);
        return_items = return_items.concat(temp_items);
        if (temp_items.length < limit) {
            return return_items;
        }
        let lastid = JSPLib.danbooru.getNextPageID(temp_items,reverse);
        page_addon = {page:`${page_modifier}${lastid}`};
        JSPLib.debug.debuglogLevel("Rechecking",type,"@",lastid,JSPLib.debug.INFO);
    }
}

//Helper functions

JSPLib.danbooru.joinArgs = function () {
    return jQuery.extend(true,{},...arguments);
}

JSPLib.danbooru.getNextPageID = function (array,reverse) {
    let ChooseID = (reverse ? Math.max : Math.min);
    return ChooseID(...array.map(val=>{return val.id;}));
}

JSPLib.danbooru.incrementCounter = function () {
    JSPLib.danbooru.num_network_requests += 1;
    JSPLib.danbooru.counter_domname && jQuery(JSPLib.danbooru.counter_domname).html(JSPLib.danbooru.num_network_requests);
}

JSPLib.danbooru.decrementCounter = function () {
    JSPLib.danbooru.num_network_requests -= 1;
    JSPLib.danbooru.counter_domname && jQuery(JSPLib.danbooru.counter_domname).html(JSPLib.danbooru.num_network_requests);
}

JSPLib.danbooru.rateLimit = async function () {
    while (JSPLib.danbooru.num_network_requests >= JSPLib.danbooru.max_network_requests) {
        JSPLib.debug.debuglogLevel("Max simultaneous network requests exceeded! Sleeping...",JSPLib.debug.WARNING);
        await new Promise(resolve => setTimeout(resolve, JSPLib.danbooru.rate_limit_wait)); //Sleep
    }
}

//Tag functions

JSPLib.danbooru.getShortName = function (category) {
    let shortnames = ['art','char','copy','gen','meta'];
    for (let i = 0;i < shortnames.length ; i++) {
        if (category.search(RegExp(shortnames[i])) === 0) {
            return shortnames[i];
        }
    }
}

JSPLib.danbooru.randomDummyTag = function () {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    var result = '';
    for (var i = 8; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
    return 'dummytag-' + result;
}

JSPLib.danbooru.tagRegExp = function (str) {
    return RegExp('(?<=(?:^|\\s))'+str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1") +'(?=(?:$|\\s))','gi');
}

//Render functions

JSPLib.danbooru.postSearchLink = function (tag_string,text) {
    let tag_param = jQuery.param({tags:tag_string}).replace(/%20/g,'+');
    return `<a href="/posts?${tag_param}">${text}</a>`;
}
