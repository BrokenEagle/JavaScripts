/****DEPENDENCIES****/

/**External dependencies**/
// localforage.js (optional)

/****SETUP****/

var JSPLib = JSPLib || {};
JSPLib.storage = JSPLib.storage || {};

//Has debug.js been loaded?
JSPLib.debug = JSPLib.debug || {};
JSPLib.debug.debuglogLevel = JSPLib.debug.debuglogLevel || (()=>{});
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
        JSPLib.debug.debuglogLevel("Found item (Session):",key,JSPLib.debug.VERBOSE);
        return data;
    }
    JSPLib.debug.recordTime(key,database);
    data = await JSPLib.storage.danboorustorage.getItem(key);
    JSPLib.debug.recordTimeEnd(key,database);
    if (data !== null) {
        JSPLib.debug.debuglogLevel(`Found item (${database}):`,key,JSPLib.debug.VERBOSE);
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
        JSPLib.debug.debuglogLevel("Data has no expires!",JSPLib.debug.INFO);
        return true;
    } else if (storeditem.expires > 0 && Date.now() > storeditem.expires) {
        JSPLib.debug.debuglogLevel("Data has expired!",JSPLib.debug.DEBUG);
        return true;
    }
    return false;
};

//The validator returns true for valid data, false for invalid data
JSPLib.storage.checkLocalDB = async function (key,validator) {
    if (JSPLib.storage.use_storage) {
        var cached = await JSPLib.storage.retrieveData(key);
        JSPLib.debug.debuglogLevel("Checking",key,JSPLib.debug.VERBOSE);
        if (!validator(key,cached) || JSPLib.storage.hasDataExpired(cached)) {
            JSPLib.debug.debuglogLevel("DB Miss",key,JSPLib.debug.DEBUG);
        } else {
            JSPLib.debug.debuglogLevel("DB Hit",key,JSPLib.debug.VERBOSE);
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
                    JSPLib.debug.debuglogLevel("Deleting",key,JSPLib.debug.DEBUG);
                    JSPLib.storage.removeData(key);
                    pruned_items += 1;
                }
                total_items += 1;
            }
        });
        JSPLib.debug.debuglogLevel(`Pruned ${pruned_items}/${total_items} items!`,JSPLib.debug.INFO);
    }
};
