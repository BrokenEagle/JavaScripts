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

JSPLib.saucenao.getSauce = async function (image_url,database=null,numres=null,notify_user=false) {
    if (!this.api_key) {
        JSPLib.utility.error("GetSauce error: Must set the API key!");
        return false;
    }
    let key = String(JSPLib.utility.getUniqueID());
    if (this._sauce_wait > Date.now()) {
        let time_remaining = Math.ceil(this._sauce_wait > Date.now());
        JSPLib.utility.notice(`GetSauce warning: Must wait ${time_remaining} seconds to get sauce!`);
        return false;
    }
    if (this.num_network_requests >= this.max_network_requests) {
        await JSPLib.network.rateLimit('saucenao');
    }
    JSPLib.network.incrementCounter('saucenao');
    let url_addons = {
        output_type: 2,
        numres: this.num_requested_items + 1,
        api_key: this.api_key,
        url: image_url
    };
    if (database) {
        url_addons.db = database;
    } else {
        url_addons.dbmask = this._getBitmask();
    }
    if (numres) {
        url_addons.numres = numres + 1;
    }
    JSPLib.debug.recordTime(key,'Network');
    try {
        return await jQuery.getJSON(this.query_url,url_addons)
        .always(()=>{
            JSPLib.debug.recordTimeEnd(key,'Network');
            JSPLib.network.decrementCounter('saucenao');
        });
    } catch(error) {
        //Swallow exception... will return null
        error = JSPLib.network.processError(error,"saucenao.getSauce");
        let error_key = `${jQuery.param(url_addons)}`;
        JSPLib.network.logError(error_key,error);
        if (notify_user) {
            JSPLib.network.notifyError(error);
        }
        return null;
    }
};

//Helper functions

JSPLib.saucenao.getDBIndex = function(db_name) {
    return this.sources.indexOf(db_name);
};

JSPLib.saucenao.checkSauce = function(resp) {
    if (!resp) {
        JSPLib.utility.error("SauceNAO server error! (60 second wait)");
        JSPLib.debug.debuglogLevel("saucenao.checkSauce - SauceNAO server error!",JSPLib.debug.ERROR);
        this.no_sauce = true;
        this._sauce_wait = Date.now() + (JSPLib.utility.one_second * 60);
        return false;
    } else {
        this._sauce_wait = 0;
    }
    if (resp.header.long_remaining == 0) {
        JSPLib.utility.error("No more sauce!");
        JSPLib.debug.debuglogLevel("saucenao.checkSauce - No more sauce!",JSPLib.debug.ERROR);
        this.no_sauce = true;
        this._sauce_wait = Date.now() + (JSPLib.utility.one_minute * 5);
    } else {
        this.no_sauce = false;
        this._sauce_wait = 0;
    }
    if (resp.header.long_remaining > 0 && resp.header.short_remaining == 0) {
        JSPLib.utility.notice("Too much sauce! (30 second wait)");
        JSPLib.debug.debuglogLevel("saucenao.checkSauce - Too much sauce!",JSPLib.debug.WARNING);
        this._sauce_wait = Date.now() + (JSPLib.utility.one_second * 30);
    } else {
        this._sauce_wait = 0;
    }
    if (resp.header.status < 0) {
        if (resp.header.message) {
            JSPLib.utility.error(`SauceNAO error: ${resp.header.message}`);
            JSPLib.debug.debuglogLevel("saucenao.checkSauce - error:",resp.header.message,JSPLib.debug.WARNING);
        }
        return false;
    }
    if (!resp.results) {
        JSPLib.utility.notice("No SauceNao results.");
        JSPLib.debug.debuglogLevel("saucenao.checkSauce - No SauceNao results.",JSPLib.debug.WARNING);
        return false;
    }
    return true;
}

/****PRIVATE DATA****/

//Variables

JSPLib.saucenao._sauce_wait = 0;

//Functions

JSPLib.saucenao._getBitmask = function() {
    let bitstring = this.sources.map((key)=>{return this.index[key];}).reverse().join('');
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
