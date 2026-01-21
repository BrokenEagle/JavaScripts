/****DEPENDENCIES****/

/**External dependencies**/
// jQuery

/**Internal dependencies**/
// JSPLib.utility
// JSPlib.network

/****SETUP****/

//Linter configuration
/* global JSPLib */

(function (debug, utility, network, notice) {

const saucenao = JSPLib.saucenao;

/****GLOBAL VARIABLES****/

saucenao.api_key = null;
saucenao.max_read_requests = 1;
saucenao.num_requested_items = 10;

/****PRIVATE VARIABLES****/

var NUM_READ_REQUESTS = 0;
var SAUCE_WAIT = 0;

const SOURCES = [
    "hmags", "reserved", "hcg", "ddbobjects", "ddbsamples", "pixiv", "pixivhistorical", "reserved", "seigaillust",
    "danbooru", "drawr", "nijie", "yandere", "animeop", "reserved", "shutterstock", "fakku", "hmisc", "2dmarket",
    "medibang", "anime", "hanime", "movies", "shows", "gelbooru", "konachan", "sankaku", "animepictures", "e621",
    "idolcomplex", "bcyillust", "bcycosplay", "portalgraphics", "da", "pawoo", "madokami", "mangadex"
];
const SOURCE_INDEX = Object.assign(...SOURCES.map((key) => ({[key]: '0'})));

/****FUNCTIONS****/

saucenao.getSauce = async function (image_url, database = null, numres = null, notify_user = false) {
    const printer = debug.getFunctionPrint('saucenao.getSauce');
    if (!saucenao.api_key) {
        notice.error("GetSauce error: Must set the API key!");
        return false;
    }
    let key = String(utility.getUniqueID());
    if (SAUCE_WAIT > Date.now()) {
        let time_remaining = Math.ceil(SAUCE_WAIT > Date.now());
        notice.notice(`GetSauce warning: Must wait ${time_remaining} seconds to get sauce!`);
        return false;
    }
    const waitCondition = () => (NUM_READ_REQUESTS >= saucenao.max_read_requests);
    if (waitCondition()) {
        printer.debugwarnLevel("Network read requests exceeded!", debug.WARNING);
        await network.waitNetwork(waitCondition);
    }
    NUM_READ_REQUESTS++;
    let url_addons = {
        output_type: 2,
        numres: numres ?? saucenao.num_requested_items,
        api_key: saucenao.api_key,
        url: image_url
    };
    if (database) {
        url_addons.db = database;
    } else {
        url_addons.dbmask = _getBitmask();
    }
    debug.recordTime(key, 'Network');
    return network.getJSON('https://saucenao.com/search.php', {data: url_addons}).then(
        //Success
        (data) => data,
        //Failure
        (error) => {
            let process_error = network.processError(error, "saucenao.getSauce");
            let error_key = utility.renderParams(url_addons);
            network.logError(error_key, process_error);
            if (notify_user) {
                network.notifyError(process_error);
            }
            return null;
        },
    ).always(() => {
        debug.recordTimeEnd(key, 'Network');
        NUM_READ_REQUESTS--;
    });
};

//Helper functions

saucenao.getDBIndex = function(db_name) {
    return SOURCES.indexOf(db_name);
};

saucenao.checkSauce = function(resp) {
    const printer = debug.getFunctionPrint('saucenao.checkSauce');
    if (!resp) {
        notice.error("SauceNAO server error! (60 second wait)");
        printer.debugerrorLevel("SauceNAO server error!", debug.ERROR);
        SAUCE_WAIT = Date.now() + (utility.one_second * 60);
        return false;
    } 
    SAUCE_WAIT = 0;
    if (resp.header.long_remaining === 0) {
        notice.error("No more sauce!");
        printer.debugwarnLevel("No more sauce!", debug.ERROR);
        SAUCE_WAIT = Date.now() + (utility.one_minute * 5);
    } else {
        SAUCE_WAIT = 0;
    }
    if (resp.header.long_remaining > 0 && resp.header.short_remaining === 0) {
        notice.notice("Too much sauce! (30 second wait)");
        printer.debuglogLevel("Too much sauce!", debug.WARNING);
        SAUCE_WAIT = Date.now() + (utility.one_second * 30);
    } else {
        SAUCE_WAIT = 0;
    }
    if (resp.header.status < 0) {
        if (resp.header.message) {
            notice.error(`SauceNAO error: ${resp.header.message}`);
            printer.debugwarnLevel("Error:", resp.header.message, debug.WARNING);
        }
        return false;
    }
    if (!resp.results) {
        notice.notice("No SauceNao results.");
        printer.debugwarnLevel("No SauceNao results.", debug.WARNING);
        return false;
    }
    return true;
};

/****PRIVATE FUNCTIONS****/

function _getBitmask() {
    let bitstring = SOURCES.map((key) => SOURCE_INDEX[key]).reverse().join('');
    return parseInt(bitstring, 2);
}

/****INITIALIZATION****/

JSPLib.initializeModule('saucenao');

})(JSPLib.debug, JSPLib.utility, JSPLib.network, JSPLib.notice);
