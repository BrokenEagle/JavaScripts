/****DEPENDENCIES****/

/**External dependencies**/
// jQuery

/**Internal dependencies**/
// JSPLib.utility
// JSPLib.network

/****SETUP****/

//Linter configuration
/* global JSPLib */

JSPLib.saucenao = {};

/****GLOBAL VARIABLES****/

JSPLib.saucenao.num_read_requests = 0;
JSPLib.saucenao.num_write_requests = 0;
JSPLib.saucenao.max_read_requests = 1;
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

JSPLib.saucenao.index = Object.assign(...JSPLib.saucenao.sources.map((key) => ({[key]: '0'})));

/****FUNCTIONS****/

JSPLib.saucenao.getSauce = async function (image_url, database = null, numres = null, notify_user = false) {
    if (!this.api_key) {
        JSPLib.notice.error("GetSauce error: Must set the API key!");
        return false;
    }
    let key = String(JSPLib.utility.getUniqueID());
    if (this._sauce_wait > Date.now()) {
        let time_remaining = Math.ceil(this._sauce_wait > Date.now());
        JSPLib.notice.notice(`GetSauce warning: Must wait ${time_remaining} seconds to get sauce!`);
        return false;
    }
    if (this.num_network_requests >= this.max_network_requests) {
        await JSPLib.network.rateLimit('saucenao');
    }
    JSPLib.network.incrementCounter('saucenao', 'read');
    let url_addons = {
        output_type: 2,
        numres: this.num_requested_items,
        api_key: this.api_key,
        url: image_url
    };
    if (database) {
        url_addons.db = database;
    } else {
        url_addons.dbmask = this._getBitmask();
    }
    if (numres) {
        url_addons.numres = numres;
    }
    JSPLib.debug.recordTime(key, 'Network');
    return JSPLib.network.getJSON(this.query_url, {data: url_addons}).then(
        //Success
        (data) => data,
        //Failure
        (error) => {
            let process_error = JSPLib.network.processError(error, "saucenao.getSauce");
            let error_key = JSPLib.utility.renderParams(url_addons);
            JSPLib.network.logError(error_key, process_error);
            if (notify_user) {
                JSPLib.network.notifyError(process_error);
            }
            return null;
        },
    ).always(() => {
        JSPLib.debug.recordTimeEnd(key, 'Network');
        JSPLib.network.decrementCounter('saucenao', 'read');
    });
};

//Helper functions

JSPLib.saucenao.getDBIndex = function(db_name) {
    return this.sources.indexOf(db_name);
};

JSPLib.saucenao.checkSauce = function(resp) {
    const printer = JSPLib.debug.getFunctionPrint('saucenao.checkSauce');
    if (!resp) {
        JSPLib.notice.error("SauceNAO server error! (60 second wait)");
        printer.debugerrorLevel("SauceNAO server error!", JSPLib.debug.ERROR);
        this.no_sauce = true;
        this._sauce_wait = Date.now() + (JSPLib.utility.one_second * 60);
        return false;
    } 
    this._sauce_wait = 0;
    
    if (resp.header.long_remaining === 0) {
        JSPLib.notice.error("No more sauce!");
        printer.debugwarnLevel("No more sauce!", JSPLib.debug.ERROR);
        this.no_sauce = true;
        this._sauce_wait = Date.now() + (JSPLib.utility.one_minute * 5);
    } else {
        this.no_sauce = false;
        this._sauce_wait = 0;
    }
    if (resp.header.long_remaining > 0 && resp.header.short_remaining === 0) {
        JSPLib.notice.notice("Too much sauce! (30 second wait)");
        printer.debuglogLevel("Too much sauce!", JSPLib.debug.WARNING);
        this._sauce_wait = Date.now() + (JSPLib.utility.one_second * 30);
    } else {
        this._sauce_wait = 0;
    }
    if (resp.header.status < 0) {
        if (resp.header.message) {
            JSPLib.notice.error(`SauceNAO error: ${resp.header.message}`);
            printer.debugwarnLevel("Error:", resp.header.message, JSPLib.debug.WARNING);
        }
        return false;
    }
    if (!resp.results) {
        JSPLib.notice.notice("No SauceNao results.");
        printer.debugwarnLevel("No SauceNao results.", JSPLib.debug.WARNING);
        return false;
    }
    return true;
};

/****PRIVATE DATA****/

//Variables

JSPLib.saucenao._sauce_wait = 0;

//Functions

JSPLib.saucenao._getBitmask = function() {
    let bitstring = this.sources.map((key) => this.index[key]).reverse().join('');
    return parseInt(bitstring, 2);
};

/****INITIALIZATION****/

JSPLib.saucenao._configuration = {
    nonenumerable: [],
    nonwritable: []
};
JSPLib.initializeModule('saucenao');
