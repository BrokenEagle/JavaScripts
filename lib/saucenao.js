/****DEPENDENCIES****/

/**External dependencies**/
// jQuery (from Network.js)

/**Internal dependencies**/
// JSPLib.Debug (optional)
// JSPLib.Notice (optional)
// JSPLib.Utility
// JSPlib.Network

/****SETUP****/

//Linter configuration
/* global JSPLib */

(function ({Debug, Notice, Utility, Network}) {

const Saucenao = JSPLib.Saucenao;

/****PUBLIC VARIABLES****/

Saucenao.api_key = null;
Saucenao.max_read_requests = 1;

/****PRIVATE VARIABLES****/

var NUM_READ_REQUESTS = 0;
var SAUCE_WAIT = 0;

const DANBOORU_INDEX = 9;

/****PUBLIC FUNCTIONS****/

Saucenao.getSauce = async function (image_url, {limit = 10, notify = false} = {}) {
    const printer = Debug.getFunctionPrint('Saucenao.getSauce');
    if (!Saucenao.api_key) {
        Notice.error("GetSauce error: Must set the API key!");
        return false;
    }
    let key = String(Utility.getUniqueID());
    if (SAUCE_WAIT > Date.now()) {
        let time_remaining = Math.ceil(SAUCE_WAIT > Date.now());
        Notice.notice(`GetSauce warning: Must wait ${time_remaining} seconds to get sauce!`);
        return false;
    }
    const waitCondition = () => (NUM_READ_REQUESTS >= Saucenao.max_read_requests);
    if (waitCondition()) {
        printer.warnLevel("Network read requests exceeded!", Debug.WARNING);
        await Network.waitNetwork(waitCondition);
    }
    NUM_READ_REQUESTS++;
    let url_addons = {
        db: DANBOORU_INDEX,
        output_type: 2,
        numres: limit,
        api_key: Saucenao.api_key,
        url: image_url
    };
    Debug.recordTime(key, 'Network');
    return Network.getJSON('https://saucenao.com/search.php', {data: url_addons}).then(
        //Success
        (data) => data,
        //Failure
        (error) => {
            let process_error = Network.processError(error, "Saucenao.getSauce");
            let error_key = Utility.renderParams(url_addons);
            Network.logError(error_key, process_error);
            if (notify) {
                Network.notifyError(process_error);
            }
            return null;
        },
    ).always(() => {
        Debug.recordTimeEnd(key, 'Network');
        NUM_READ_REQUESTS--;
    });
};

Saucenao.checkSauce = function (resp) {
    const printer = Debug.getFunctionPrint('Saucenao.checkSauce');
    if (!resp) {
        Notice.error("SauceNAO server error! (60 second wait)");
        printer.errorLevel("SauceNAO server error!", Debug.ERROR);
        SAUCE_WAIT = Date.now() + (Utility.one_second * 60);
        return false;
    }
    SAUCE_WAIT = 0;
    if (resp.header.long_remaining === 0) {
        Notice.error("No more sauce!");
        printer.warnLevel("No more sauce!", Debug.ERROR);
        SAUCE_WAIT = Date.now() + (Utility.one_minute * 5);
    } else {
        SAUCE_WAIT = 0;
    }
    if (resp.header.long_remaining > 0 && resp.header.short_remaining === 0) {
        Notice.notice("Too much sauce! (30 second wait)");
        printer.logLevel("Too much sauce!", Debug.WARNING);
        SAUCE_WAIT = Date.now() + (Utility.one_second * 30);
    } else {
        SAUCE_WAIT = 0;
    }
    if (resp.header.status < 0) {
        if (resp.header.message) {
            Notice.error(`SauceNAO error: ${resp.header.message}`);
            printer.warnLevel("Error:", resp.header.message, Debug.WARNING);
        }
        return false;
    }
    if (!resp.results) {
        Notice.notice("No SauceNao results.");
        printer.warnLevel("No SauceNao results.", Debug.WARNING);
        return false;
    }
    return true;
};

/****INITIALIZATION****/

JSPLib.initializeModule('saucenao');

})(JSPLib);
