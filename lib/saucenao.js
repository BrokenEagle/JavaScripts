/****DEPENDENCIES****/

/**External dependencies**/
// jQuery

/****SETUP****/

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
JSPLib.saucenao.rate_limit_wait = 500;  // half second
JSPLib.saucenao.query_url = "https://saucenao.com/search.php";
JSPLib.saucenao.api_key = null;
JSPLib.saucenao.num_requested_items = 10;
JSPLib.saucenao.counter_domname = null;
JSPLib.saucenao.error_domname = null;
JSPLib.saucenao.error_messages = [];
JSPLib.saucenao.http_error_messages = {
    502: "Bad gateway"
};
JSPLib.saucenao.sauce_wait = 0;
JSPLib.saucenao.no_sauce = false;

JSPLib.saucenao.sources = [
    "hmags", "reserved", "hcg", "ddbobjects", "ddbsamples", "pixiv", "pixivhistorical", "reserved", "seigaillust",
    "danbooru", "drawr", "nijie", "yandere", "animeop", "reserved", "shutterstock", "fakku", "hmisc", "2dmarket",
    "medibang", "anime", "hanime", "movies", "shows", "gelbooru", "konachan", "sankaku", "animepictures", "e621",
    "idolcomplex", "bcyillust", "bcycosplay", "portalgraphics", "da", "pawoo", "madokami", "mangadex"
];

JSPLib.saucenao.index = Object.assign(...JSPLib.saucenao.sources.map((key)=>{return {[key]: '0'};}));

/****FUNCTIONS****/

JSPLib.saucenao.getBitmask = function() {
    let bitstring = JSPLib.saucenao.sources.map((key)=>{return JSPLib.saucenao.index[key];}).reverse().join('');
    return parseInt(bitstring,2);
};

JSPLib.saucenao.getDBIndex = function(db_name) {
    return JSPLib.saucenao.sources.indexOf(db_name);
};

JSPLib.saucenao.getSauce = async function (url,database=null,notify_user=false) {
    if (!JSPLib.saucenao.api_key) {
        JSPLib.saucenao.notifyUser("GetSauce error: Must set the API key!",'error');
        return false;
    }
    let key = JSPLib.saucenao.randomDummyTag();
    if (JSPLib.saucenao.sauce_wait > Date.now()) {
        let time_remaining = Math.ceil(JSPLib.saucenao.sauce_wait > Date.now());
        JSPLib.saucenao.notifyUser(`GetSauce warning: Must wait ${time_remaining} seconds to get sauce!`,'notice');
        return false;
    }
    if (JSPLib.saucenao.num_network_requests >= JSPLib.saucenao.max_network_requests) {
        await JSPLib.saucenao.rateLimit();
    }
    JSPLib.saucenao.incrementCounter();
    let url_addons = {
        output_type: 2,
        numres: JSPLib.saucenao.num_requested_items,
        api_key: JSPLib.saucenao.api_key,
        url: url
    };
    if (database) {
        Object.assign(url_addons,{db: database});
    } else {
        Object.assign(url_addons,{dbmask: JSPLib.saucenao.getBitmask()});
    }
    JSPLib.debug.recordTime(key,'Network');
    return await jQuery.getJSON(JSPLib.saucenao.query_url,url_addons)
    .always(()=>{
        JSPLib.debug.recordTimeEnd(key,'Network');
        JSPLib.saucenao.decrementCounter();
    })
    .catch((e)=>{
        //Swallow exception... will return default value
        e = (typeof e === "object" && 'status' in e && 'responseText' in e ? e : {status: 999, responseText: "Bad error code!"});
        JSPLib.debug.debuglogLevel("SubmitRequest error:",e.status,e.responseText,JSPLib.debug.ERROR);
        let error_key = `${jQuery.param(url_addons)}`;
        JSPLib.saucenao.error_messages.push([error_key,e.status,e.responseText]);
        JSPLib.saucenao.error_domname && jQuery(JSPLib.saucenao.error_domname).html(JSPLib.saucenao.error_messages.length);
        if (notify_user) {
            let message = e.responseText;
            if (message.match(/<!doctype html>/i)) {
                message = (JSPLib.saucenao.http_error_messages[e.status] ? JSPLib.saucenao.http_error_messages[e.status] + " - " : "") + "&lt;HTML response&gt;";
            } else {
                try {
                    let parse_message = JSON.parse(message);
                    if (JSPLib.validate.isHash(parse_message)) {
                        if ('reason' in parse_message) {
                            message = parse_message.reason;
                        } else if ('message' in parse_message) {
                            message = parse_message.message;
                        }
                    }
                } catch (e) {
                    //Swallow
                }
            }
            JSPLib.saucenao.notifyUser(`HTTP ${e.status}: ${message}`, 'error');
        }
        return null;
    });
};

JSPLib.saucenao.checkSauce = function(resp) {
    if (!resp) {
        JSPLib.saucenao.notifyUser("SauceNAO server error: (60 second wait)",'error');
        console.log("Server error!");
        JSPLib.saucenao.no_sauce = true;
        JSPLib.saucenao.sauce_wait = Date.now() + (JSPLib.utility.one_second * 60);
        return false;
    } else {
        JSPLib.saucenao.sauce_wait = 0;
    }
    if (resp.header.long_remaining == 0) {
        JSPLib.saucenao.notifyUser("No more sauce!",'error');
        console.log("No more sauce!");
        JSPLib.saucenao.no_sauce = true;
        JSPLib.saucenao.sauce_wait = Date.now() + (JSPLib.utility.one_minute * 5);
    } else {
        JSPLib.saucenao.no_sauce = false;
        JSPLib.saucenao.sauce_wait = 0;
    }
    if (resp.header.long_remaining > 0 && resp.header.short_remaining == 0) {
        JSPLib.saucenao.notifyUser("Too much sauce! (30 second wait)",'notice');
        JSPLib.saucenao.sauce_wait = Date.now() + (JSPLib.utility.one_second * 30);
    } else {
        JSPLib.saucenao.sauce_wait = 0;
    }
    if (resp.header.status < 0) {
        resp.header.message && JSPLib.saucenao.notifyUser(`SauceNAO error: ${resp.header.message}`,'error');
        return false;
    }
    if (!resp.results) {
        JSPLib.saucenao.notifyUser("No SauceNao results.",'notice');
        console.log("No results!");
        return false;
    }
    return true;
}
//Helper functions

JSPLib.saucenao.incrementCounter = function () {
    JSPLib.saucenao.num_network_requests += 1;
    JSPLib.saucenao.counter_domname && jQuery(JSPLib.saucenao.counter_domname).html(JSPLib.saucenao.num_network_requests);
};

JSPLib.saucenao.decrementCounter = function () {
    JSPLib.saucenao.num_network_requests -= 1;
    JSPLib.saucenao.counter_domname && jQuery(JSPLib.saucenao.counter_domname).html(JSPLib.saucenao.num_network_requests);
};

JSPLib.saucenao.rateLimit = async function () {
    while (JSPLib.saucenao.num_network_requests >= JSPLib.saucenao.max_network_requests) {
        JSPLib.debug.debuglogLevel("Max simultaneous network requests exceeded! Sleeping...",JSPLib.debug.WARNING);
        await JSPLib.utility.sleep(JSPLib.saucenao.rate_limit_wait);
    }
};

JSPLib.saucenao.randomDummyTag = function () {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    var result = '';
    for (var i = 8; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
    return 'dummytag-' + result;
};

JSPLib.saucenao.notifyUser = function (message,type) {
    JSPLib.debug.debuglogLevel(message,JSPLib.debug.ERROR);
    window.Danbooru && Danbooru.Utility && Danbooru.Utility[type](message);
};

