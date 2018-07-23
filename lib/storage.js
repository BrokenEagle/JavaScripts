/****DEPENDENCIES****/

/**External dependencies**/
// localforage.js (optional)

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
JSPLib.storage.danboorustorage = window.localforage && localforage.createInstance({
    name: 'Danbooru storage',
    driver: [localforage.INDEXEDDB,
             localforage.LOCALSTORAGE]
});

//Set state variables that indicate which database is being used
JSPLib.storage.use_indexed_db = window.localforage && JSPLib.storage.danboorustorage.supports(JSPLib.storage.danboorustorage.INDEXEDDB);
JSPLib.storage.use_local_storage = window.localforage && !JSPLib.storage.use_indexed_db && JSPLib.storage.danboorustorage.supports(JSPLib.storage.danboorustorage.LOCALSTORAGE);
JSPLib.storage.use_storage = JSPLib.storage.use_indexed_db || JSPLib.storage.use_local_storage;

/****FUNCTIONS****/

//Data interface functions

JSPLib.storage.getStorageData = function (key,storage,default_val=null) {
    if (key in storage) {
        JSPLib.debug.recordTime(key,'Storage');
        let data = storage.getItem(key);
        JSPLib.debug.recordTimeEnd(key,'Storage');
        try {
            return JSON.parse(data);
        } catch (e) {
            //Swallow exception
        }
    }
    return default_val;
};

JSPLib.storage.setStorageData = function (key,data,storage) {
    storage.setItem(key,JSON.stringify(data));
};

JSPLib.storage.retrieveData = async function (key) {
    if (!(JSPLib.storage.use_storage)) {
        return null;
    }
    let database = JSPLib.storage.use_indexed_db ? "IndexDB" : "LocalStorage";
    let data = JSPLib.storage.getStorageData(key,sessionStorage);
    if (data) {
        JSPLib.debug.debuglog("Found item (Session):",key);
        return data;
    }
    JSPLib.debug.recordTime(key,database);
    data = await JSPLib.storage.danboorustorage.getItem(key);
    JSPLib.debug.recordTimeEnd(key,database);
    if (data !== null) {
        JSPLib.debug.debuglog(`Found item (${database}):`,key);
        JSPLib.storage.setStorageData(key,data,sessionStorage);
    }
    return data;
};

JSPLib.storage.saveData = function (key,value) {
    if (JSPLib.storage.use_storage) {
        JSPLib.storage.setStorageData(key,value,sessionStorage);
        return JSPLib.storage.danboorustorage.setItem(key,value);
    }
};

JSPLib.storage.removeData = function (key) {
    if (JSPLib.storage.use_storage) {
        sessionStorage.removeItem(key);
        return JSPLib.storage.danboorustorage.removeItem(key);
    }
};

JSPLib.storage.hasDataExpired = function (storeditem) {
    if (typeof storeditem !== "object" || !('expires' in storeditem)) {
        JSPLib.debug.debuglog("Data has no expires!");
        return true;
    } else if (storeditem.expires > 0 && Date.now() > storeditem.expires) {
        JSPLib.debug.debuglog("Data has expired!");
        return true;
    }
    return false;
};

//The validator returns true for valid data, false for invalid data
JSPLib.storage.checkLocalDB = async function (key,validator) {
    if (JSPLib.storage.use_storage) {
        var cached = await JSPLib.storage.retrieveData(key);
        JSPLib.debug.debuglog("Checking",key);
        if (!validator(key,cached) || JSPLib.storage.hasDataExpired(cached)) {
            JSPLib.debug.debuglog("DB Miss",key);
        } else {
            JSPLib.debug.debuglog("DB Hit",key);
            return cached;
        }
    }
    return null;
};

JSPLib.storage.pruneLocalDB = async function (regex) {
    let pruned_items = 0;
    let total_items = 0;
    if (JSPLib.storage.use_storage) {
        await JSPLib.storage.danboorustorage.iterate((value,key)=>{
            if (key.match(regex)) {
                if (JSPLib.storage.hasDataExpired(value)) {
                    JSPLib.debug.debuglog("Deleting",key);
                    JSPLib.storage.removeData(key);
                    pruned_items += 1;
                }
                total_items += 1;
            }
        });
        JSPLib.debug.debuglog(`Pruned ${pruned_items}/${total_items} items!`);
    }
};
