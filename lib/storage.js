/****DEPENDENCIES****/

/**External dependencies**/
// localforage.js (optional)
// Danbooru

/****SETUP****/

var JSPLib = JSPLib || {};
JSPLib.storage = JSPLib.storage || {};

//Has debug.js been loaded?
JSPLib.debug = JSPLib.debug || {};
JSPLib.debug.debuglogLevel = JSPLib.debug.debuglogLevel || (()=>{});
JSPLib.debug.recordTime = JSPLib.debug.recordTime || (()=>{});
JSPLib.debug.recordTimeEnd = JSPLib.debug.recordTimeEnd || (()=>{});
JSPLib.debug.debugTime = JSPLib.debug.debugTime || (()=>{});
JSPLib.debug.debugTimeEnd = JSPLib.debug.debugTimeEnd || (()=>{});

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

//Maximum number of items to prune per function execution
JSPLib.storage.prune_limit = 1000;

/****FUNCTIONS****/

//localStorage/sessionStorage interface functions

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
    try {
        storage.setItem(key,JSON.stringify(data));
    } catch (e) {
        JSPLib.debug.debuglogLevel("Error saving data!",e,JSPLib.debug.ERROR);
        JSPLib.storage.pruneStorageData(storage);
    }
};

//Data interface functions

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

//Auxiliary functions

JSPLib.storage.checkStorageData = function (key,validator,storage,default_val) {
    let data = JSPLib.storage.getStorageData(key,storage);
    JSPLib.debug.debuglogLevel("Checking Storage",key,JSPLib.debug.VERBOSE);
    if (validator(key,data)) {
        JSPLib.debug.debuglogLevel("Storage Hit",key,JSPLib.debug.DEBUG);
        return data;
    }
    JSPLib.debug.debuglogLevel("Storage Miss",key,JSPLib.debug.DEBUG);
    return default_val;
};

JSPLib.storage.pruneStorageData = function (storage) {
    let storage_type = (storage === window.localStorage ? 'localStorage' : 'sessionStorage');
    JSPLib.debug.debuglogLevel("Pruning",storage_type,JSPLib.debug.WARNING);
    let removed_storage = 0;
    let nonremoved_storage = 0;
    let nonexpires_storage = 0;
    let items_removed = 0;
    Object.keys(storage).forEach((key)=>{
        let data = JSPLib.storage.getStorageData(key,storage);
        let datasize = JSON.stringify(data).length;
        if (JSPLib.storage.hasDataExpired(key,data,null,true)) {
            JSPLib.debug.debuglogLevel("Deleting",key,JSPLib.debug.VERBOSE);
            storage.removeItem(key);
            removed_storage += datasize;
            items_removed++;
        } else if (JSPLib.storage.hasDataExpired(key,data,null,false)) {
            nonexpires_storage += datasize;
        } else {
            nonremoved_storage += datasize;
        }
    });
    JSPLib.debug.debuglogLevel(`Pruned ${items_removed} items from ${storage_type}`,JSPLib.debug.INFO);
    JSPLib.debug.debuglogLevel(`Removed: ${removed_storage} ; Nonremoved: ${nonremoved_storage} ; Nonexpires: ${nonexpires_storage}`,JSPLib.debug.INFO);
};

JSPLib.storage.hasDataExpired = function (key,storeditem,max_expires,ignore_expires=false) {
    if (typeof storeditem !== "object" || storeditem == null || (!('expires' in storeditem))) {
        if (ignore_expires) {
            return false;
        } else {
            JSPLib.debug.debuglogLevel(key,"has no expires!",JSPLib.debug.INFO);
            return true;
        }
    } else if (storeditem.expires !== 0 && !JSPLib.storage._validateExpires(storeditem.expires,max_expires)) {
        JSPLib.debug.debuglogLevel(key,"has expired!",JSPLib.debug.VERBOSE);
        return true;
    }
    return false;
};

//The validator returns true for valid data, false for invalid data
JSPLib.storage.checkLocalDB = async function (key,validator,max_expires) {
    if (JSPLib.storage.use_storage) {
        var cached = await JSPLib.storage.retrieveData(key);
        JSPLib.debug.debuglogLevel("Checking DB",key,JSPLib.debug.VERBOSE);
        if (validator(key,cached) && !JSPLib.storage.hasDataExpired(key,cached,max_expires)) {
            JSPLib.debug.debuglogLevel("DB Hit",key,JSPLib.debug.VERBOSE);
            return cached;
        }
        JSPLib.debug.debuglogLevel("DB Miss",key,JSPLib.debug.DEBUG);
    }
    return null;
};

JSPLib.storage.batchStorageCheck = async function (keyarray,validator,max_expires,prefix) {
    let promise_array = [];
    if (prefix) {
        keyarray = JSPLib.storage.nameToKeyTransform(keyarray,prefix);
    }
    keyarray.forEach((key)=>{
        promise_array.push(JSPLib.storage.checkLocalDB(key,validator,max_expires));
    });
    let result_array = await Promise.all(promise_array);
    let missing_array = [];
    result_array.forEach((result,i)=>{
        if (!result) {
            missing_array.push(keyarray[i]);
        }
    });
    if (prefix) {
        missing_array = JSPLib.storage.keyToNameTransform(missing_array,prefix);
    }
    return missing_array;
};

JSPLib.storage.pruneStorage = async function (regex) {
    if (JSPLib.storage.use_storage) {
        let pruned_items = 0;
        let total_items = 0;
        let promise_array = [];
        await JSPLib.storage.danboorustorage.iterate((value,key)=>{
            if (key.match(regex)) {
                if (JSPLib.storage.hasDataExpired(key,value)) {
                    JSPLib.debug.debuglogLevel("Deleting",key,JSPLib.debug.DEBUG);
                    promise_array.push(JSPLib.storage.removeData(key));
                    pruned_items += 1;
                }
                total_items += 1;
                if (pruned_items >= JSPLib.storage.prune_limit) {
                    JSPLib.debug.debuglogLevel("Prune limit reached!",JSPLib.debug.WARNING);
                    return true;
                }
            }
        });
        JSPLib.debug.debuglogLevel(`Pruning ${pruned_items}/${total_items} items!`,JSPLib.debug.INFO);
        return Promise.all(promise_array);
    }
};

JSPLib.storage.pruneEntries = function (modulename,regex,prune_expires) {
    let expire_name = modulename + '-prune-expires';
    JSPLib.debug.debugTime("PruneEntries");
    let expires = JSPLib.storage.getStorageData(expire_name,localStorage,0);
    if (!JSPLib.storage._validateExpires(expires,prune_expires)) {
        JSPLib.debug.debuglogLevel("Pruning entries...",JSPLib.debug.INFO);
        let promise_resp = JSPLib.storage.pruneStorage(regex).then(()=>{
            JSPLib.debug.debuglogLevel("Pruning complete!",JSPLib.debug.INFO);
            JSPLib.debug.debugTimeEnd("PruneEntries");
        });
        JSPLib.storage.setStorageData(expire_name, Date.now() + prune_expires, localStorage);
        return promise_resp;
    } else {
        JSPLib.debug.debuglogLevel("No prune of entries!",JSPLib.debug.DEBUG);
    }
};

JSPLib.storage.purgeCache = async function (regex,counter_domname) {
    window.Danbooru && Danbooru.Utility.notice("Starting cache deletion...");
    let promise_array = [];
    let purged_count = 0;
    let remaining_count = 0;
    await JSPLib.storage.danboorustorage.iterate((value,key)=>{
        if (key.match(regex)) {
            JSPLib.debug.debuglogLevel("Deleting",key,JSPLib.debug.DEBUG);
            let resp = JSPLib.storage.removeData(key).then(()=>{
                JSPLib.storage._adjustCounter(counter_domname,--remaining_count);
            });
            promise_array.push(resp);
            purged_count += 1;
            JSPLib.storage._adjustCounter(counter_domname,++remaining_count);
        }
    });
    window.Danbooru && Danbooru.Utility.notice(`Deleting ${purged_count} items...`);
    JSPLib.debug.debuglogLevel(`Deleting ${purged_count} items...`,JSPLib.debug.INFO);
    //Wait at least 5 seconds
    await JSPLib.storage._sleep(5000);
    await Promise.all(promise_array);
    window.Danbooru && Danbooru.Utility.notice("Finished deleting cached data!");
    JSPLib.debug.debuglogLevel("Finished deleting cached data!",JSPLib.debug.INFO);
};

JSPLib.storage.programCacheInfo = async function (program_shortcut,regex) {
    let cache_info = Object.assign({},...['index','session','local'].map((name)=>{return {[name]: {total_items:0,total_size:0,program_items:0,program_size:0}};}));
    let index_wait = JSPLib.storage.danboorustorage.iterate((value,key)=>{
        JSPLib.storage._addItemCacheInfo(cache_info.index, key, JSON.stringify(value), regex);
    });
    Object.keys(sessionStorage).forEach((key)=>{
        JSPLib.storage._addItemCacheInfo(cache_info.session, key, sessionStorage[key], RegExp(`(${regex.source})|(^${program_shortcut}-)`));
    });
    Object.keys(localStorage).forEach((key)=>{
        JSPLib.storage._addItemCacheInfo(cache_info.local, key, localStorage[key], RegExp(`^${program_shortcut}-`));
    });
    await index_wait;
    return cache_info;
};

//Helper functions

JSPLib.storage.nameToKeyTransform = function (namelist,prefix) {
    return namelist.map((value)=>{return prefix + '-' + value;});
};

JSPLib.storage.keyToNameTransform = function (keylist,prefix) {
    return keylist.map((key)=>{return key.replace(RegExp('^' + prefix + '-'),'');});
};

//Private functions

JSPLib.storage._sleep = function (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
};

JSPLib.storage._adjustCounter = function (counter_domname,count) {
    if (counter_domname && document.querySelector(counter_domname)) {
        document.querySelector(counter_domname).innerText = count;
    }
};

JSPLib.storage._validateExpires = function (actual_expires,expected_expires) {
    //Resolve to false if the actual_expires is bogus, has expired, or the expiration is too long
    return Number.isInteger(actual_expires) && (Date.now() <= actual_expires) && (!Number.isInteger(expected_expires) || ((actual_expires - Date.now()) <= expected_expires));
};

JSPLib.storage._addItemCacheInfo = function (entry,key,value,regex) {
    let current_size = value.length;
    entry.total_items++;
    entry.total_size += current_size;
    if (key.match(regex)) {
        entry.program_items++;
        entry.program_size += current_size;
    }
};
