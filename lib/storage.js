/****DEPENDENCIES****/

/**External dependencies**/
// localforage.js

/****SETUP****/

var JSPLib = JSPLib || {};
JSPLib.storage = JSPLib.storage || {};

//Has debug.js been loaded?
JSPLib.debug = JSPLib.debug || {};
JSPLib.debug.debuglog = JSPLib.debug.debuglog || (()=>{});
JSPLib.debug.recordTime = JSPLib.debug.recordTime || (()=>{});
JSPLib.debug.recordTimeEnd = JSPLib.debug.recordTimeEnd || (()=>{});

/****GLOBAL VARIABLES****/

//Gets own instance in case forage is used in another script
JSPLib.storage.danboorustorage = localforage.createInstance({
    name: 'Danbooru storage',
    driver: [localforage.INDEXEDDB,
             localforage.LOCALSTORAGE]
});

//Set state variables that indicate which database is being used
JSPLib.storage.use_indexed_db = JSPLib.storage.danboorustorage.supports(JSPLib.storage.danboorustorage.INDEXEDDB);
JSPLib.storage.use_local_storage = !JSPLib.storage.use_indexed_db && JSPLib.storage.danboorustorage.supports(JSPLib.storage.danboorustorage.LOCALSTORAGE);
JSPLib.storage.use_storage = JSPLib.storage.use_indexed_db || JSPLib.storage.use_local_storage;

/****FUNCTIONS****/

//Data interface functions

JSPLib.storage.getSessionData = function (key) {
    if (key in sessionStorage) {
        JSPLib.debug.recordTime(key,'Session');
        let data = sessionStorage.getItem(key);
        JSPLib.debug.recordTimeEnd(key,'Session');
        try {
            return JSON.parse(data);
        } catch (e) {
            //Swallow exception
        }
    }
}

JSPLib.storage.retrieveData = async function (key) {
    if (!(JSPLib.storage.use_storage)) {
        return null;
    }
    let database = JSPLib.storage.use_indexed_db ? "IndexDB" : "LocalStorage";
    let data = JSPLib.storage.getSessionData(key);
    if (data) {
        JSPLib.debug.debuglog("Found item (Session):",key);
        return data;
    }
    JSPLib.debug.recordTime(key,database);
    data = await JSPLib.storage.danboorustorage.getItem(key);
    JSPLib.debug.recordTimeEnd(key,database);
    if (data !== null) {
        JSPLib.debug.debuglog(`Found item (${database}):`,key);
        sessionStorage.setItem(key,JSON.stringify(data));
    }
    return data;
}

JSPLib.storage.saveData = function (key,value) {
    JSPLib.storage.danboorustorage.setItem(key,value);
    sessionStorage.setItem(key,JSON.stringify(value));
}

//Input expects the attribute expires, so data should be vaidated first
JSPLib.storage.hasDataExpired = function (storeditem) {
    if (Date.now() > storeditem.expires) {
        JSPLib.debug.debuglog("Data has expired!");
        return true;
    }
    return false;
}

//The validator returns true for valid data, false for invalid data
JSPLib.storage.checkLocalDB = async function (key,validator) {
    if (JSPLib.storage.use_storage) {
        var cached = await JSPLib.storage.retrieveData(key);
        JSPLib.debug.debuglog("Checking",key);
        if (!validator(key,cached) || JSPLib.storage.hasDataExpired(cached)) {
            JSPLib.debug.debuglog("DB Miss",key);
            JSPLib.storage.danboorustorage.removeItem(key);
        } else {
            JSPLib.debug.debuglog("DB Hit",key);
            return cached;
        }
    }
}
