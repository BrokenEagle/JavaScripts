/****DEPENDENCIES****/

/**External dependencies**/
// jQuery
// JSPLib.utility
// JSPLib.network

/****SETUP****/

//Linter configuration
/* global JSPLib jQuery */

var JSPLib = JSPLib || {};
JSPLib.saucenao = JSPLib.saucenao || {};

//Has debug.js been loaded?
JSPLib.debug = JSPLib.debug || {};
JSPLib.debug.debuglogLevel = JSPLib.debug.debuglogLevel || (()=>{});
JSPLib.debug.recordTime = JSPLib.debug.recordTime || (()=>{});
JSPLib.debug.recordTimeEnd = JSPLib.debug.recordTimeEnd || (()=>{});

/****GLOBAL VARIABLES****/

JSPLib.saucenao.num_network_requests = 0;
JSPLib.saucenao.max_network_requests = 1;
JSPLib.saucenao.query_url = "https://saucenao.com/search.php";
JSPLib.saucenao.api_key = null;
JSPLib.saucenao.num_requested_items = 10;
JSPLib.saucenao.no_sauce = false;

JSPLib.saucenao.sources = [
    "hmags", "reserved", "hcg", "ddbobjects", "ddbsamples", "pixiv", "pixivhistorical", "reserved", "seigaillust",
    "danbooru", "drawr", "nijie", "yandere", "animeop", "reserved", "shutterstock", "fakku", "hmisc", "2dmarket",
    "medibang", "anime", "hanime", "movies", "shows", "gelbooru", "konachan", "sankaku", "animepictures", "e621",
    "idolcomplex", "bcyillust", "bcycosplay", "portalgraphics", "da", "pawoo", "madokami", "mangadex"
];

JSPLib.saucenao.index = Object.assign(...JSPLib.saucenao.sources.map((key)=>{return {[key]: '0'};}));

/****FUNCTIONS****/

JSPLib.saucenao.getSauce = async function (image_url,database=null,notify_user=false) {
    if (!JSPLib.saucenao.api_key) {
        JSPLib.utility.error("GetSauce error: Must set the API key!");
        return false;
    }
    let key = String(JSPLib.utility.getUniqueID());
    if (JSPLib.saucenao._sauce_wait > Date.now()) {
        let time_remaining = Math.ceil(JSPLib.saucenao._sauce_wait > Date.now());
        JSPLib.utility.notice(`GetSauce warning: Must wait ${time_remaining} seconds to get sauce!`);
        return false;
    }
    if (JSPLib.saucenao.num_network_requests >= JSPLib.saucenao.max_network_requests) {
        await JSPLib.network.rateLimit('saucenao');
    }
    JSPLib.network.incrementCounter('saucenao');
    let url_addons = {
        output_type: 2,
        numres: JSPLib.saucenao.num_requested_items,
        api_key: JSPLib.saucenao.api_key,
        url: image_url
    };
    if (database) {
        url_addons = JSPLib.utility.joinArgs(url_addons,{db: database});
    } else {
        url_addons = JSPLib.utility.joinArgs(url_addons,{dbmask: JSPLib.saucenao._getBitmask()});
    }
    JSPLib.debug.recordTime(key,'Network');
    try {
        return await jQuery.getJSON(JSPLib.saucenao.query_url,url_addons)
        .always(()=>{
            JSPLib.debug.recordTimeEnd(key,'Network');
            JSPLib.network.decrementCounter('saucenao');
        });
    } catch(e) {
        //Swallow exception... will return null
        e = e = JSPLib.network.processError(e,"getSauce");
        let error_key = `${jQuery.param(url_addons)}`;
        JSPLib.network.logError(error_key,e);
        if (notify_user) {
            JSPLib.network.notifyError(e);
        }
        return null;
    }
};

//Helper functions

JSPLib.saucenao.getDBIndex = function(db_name) {
    return JSPLib.saucenao.sources.indexOf(db_name);
};

JSPLib.saucenao.checkSauce = function(resp) {
    if (!resp) {
        JSPLib.utility.error("SauceNAO server error! (60 second wait)");
        JSPLib.debug.debuglogLevel("SauceNAO server error!",JSPLib.debug.ERROR);
        JSPLib.saucenao.no_sauce = true;
        JSPLib.saucenao._sauce_wait = Date.now() + (JSPLib.utility.one_second * 60);
        return false;
    } else {
        JSPLib.saucenao._sauce_wait = 0;
    }
    if (resp.header.long_remaining == 0) {
        JSPLib.utility.error("No more sauce!");
        JSPLib.debug.debuglogLevel("No more sauce!",JSPLib.debug.ERROR);
        JSPLib.saucenao.no_sauce = true;
        JSPLib.saucenao._sauce_wait = Date.now() + (JSPLib.utility.one_minute * 5);
    } else {
        JSPLib.saucenao.no_sauce = false;
        JSPLib.saucenao._sauce_wait = 0;
    }
    if (resp.header.long_remaining > 0 && resp.header.short_remaining == 0) {
        JSPLib.utility.notice("Too much sauce! (30 second wait)");
        JSPLib.debug.debuglogLevel("Too much sauce!",JSPLib.debug.WARNING);
        JSPLib.saucenao._sauce_wait = Date.now() + (JSPLib.utility.one_second * 30);
    } else {
        JSPLib.saucenao._sauce_wait = 0;
    }
    if (resp.header.status < 0) {
        if (resp.header.message) {
            JSPLib.utility.error(`SauceNAO error: ${resp.header.message}`);
            JSPLib.debug.debuglogLevel("SauceNAO error:",resp.header.message,JSPLib.debug.WARNING);
        }
        return false;
    }
    if (!resp.results) {
        JSPLib.utility.notice("No SauceNao results.");
        JSPLib.debug.debuglogLevel("No SauceNao results.",JSPLib.debug.WARNING);
        return false;
    }
    return true;
}

/****PRIVATE DATA****/

//Variables

JSPLib.saucenao._sauce_wait = 0;

//Functions

JSPLib.saucenao._getBitmask = function() {
    let bitstring = JSPLib.saucenao.sources.map((key)=>{return JSPLib.saucenao.index[key];}).reverse().join('');
    return parseInt(bitstring,2);
};

/****INITIALIZATION****/

JSPLib.saucenao._configuration = {
    nonenumerable: ['_sauce_wait','_getBitmask','_configuration '],
    nonwritable: ['_configuration ']
};
Object.defineProperty(JSPLib,'saucenao',{configurable:false,writable:false});
for (let property in JSPLib.saucenao) {
    if (JSPLib.saucenao._configuration.nonenumerable.includes(property)) {
        Object.defineProperty(JSPLib.saucenao,property,{enumerable:false});
    }
    if (JSPLib.saucenao._configuration.nonwritable.includes(property)) {
        Object.defineProperty(JSPLib.saucenao,property,{writable:false});
    }
    Object.defineProperty(JSPLib.saucenao,property,{configurable:false});
}
