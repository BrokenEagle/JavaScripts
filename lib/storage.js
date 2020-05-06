/****DEPENDENCIES****/

/**External dependencies**/
// localforage.js (optional)
// JSPLib.utility

/****SETUP****/

//Linter configuration
/* global JSPLib localforage */

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
    driver: [
        localforage.INDEXEDDB,
        localforage.LOCALSTORAGE
    ]
});

//Set state variables that indicate which database is being used
JSPLib.storage.use_indexed_db = window.localforage && JSPLib.storage.danboorustorage.supports(JSPLib.storage.danboorustorage.INDEXEDDB);
JSPLib.storage.use_local_storage = window.localforage && !JSPLib.storage.use_indexed_db && JSPLib.storage.danboorustorage.supports(JSPLib.storage.danboorustorage.LOCALSTORAGE);
JSPLib.storage.use_storage = JSPLib.storage.use_indexed_db || JSPLib.storage.use_local_storage;

//Maximum number of items to prune per function execution
JSPLib.storage.prune_limit = 1000;

JSPLib.storage.memory_storage = {sessionStorage: {}, localStorage: {}};

/****FUNCTIONS****/

//localStorage/sessionStorage interface functions

JSPLib.storage.getStorageData = function (key,storage,default_val=null) {
    let storage_type = this._getStorageType(storage);
    if (key in this.memory_storage[storage_type]) {
        return JSPLib.utility.dataCopy(this.memory_storage[storage_type][key]);
    } else if (key in storage) {
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
    let storage_type = this._getStorageType(storage);
    this.memory_storage[storage_type][key] = JSPLib.utility.dataCopy(data);
    try {
        storage.setItem(key,JSON.stringify(data));
    } catch (e) {
        JSPLib.debug.debuglogLevel("storage.setStorageData: Error saving data!",e,JSPLib.debug.ERROR);
        this.pruneStorageData(storage);
    }
};

JSPLib.storage.removeStorageData = function (key,storage) {
    let storage_type = this._getStorageType(storage);
    delete this.memory_storage[storage_type][key];
    storage.removeItem(key);
};

//Data interface functions

JSPLib.storage.retrieveData = async function (key,bypass_cache=false,database=JSPLib.storage.danboorustorage) {
    if (!(this.use_storage)) {
        return null;
    }
    let data;
    let database_type = this.use_indexed_db ? "IndexDB" : "LocalStorage";
    if (!bypass_cache) {
        data = this.getStorageData(key,sessionStorage);
        if (data) {
            JSPLib.debug.debuglogLevel("storage.retrieveData - Found item (Session):",key,JSPLib.debug.VERBOSE);
            return data;
        }
    }
    JSPLib.debug.recordTime(key,database_type);
    data = await database.getItem(key);
    JSPLib.debug.recordTimeEnd(key,database_type);
    if (data !== null) {
        JSPLib.debug.debuglogLevel(`storage.retrieveData - Found item (${database_type}):`,key,JSPLib.debug.VERBOSE);
        this.setStorageData(key,data,sessionStorage);
    }
    return data;
};

JSPLib.storage.saveData = function (key,value,database=JSPLib.storage.danboorustorage) {
    if (this.use_storage) {
        this.setStorageData(key,value,sessionStorage);
        return database.setItem(key,value);
    }
};

JSPLib.storage.removeData = function (key,broadcast=true,database=JSPLib.storage.danboorustorage) {
    if (this.use_storage) {
        this.removeStorageData(key,sessionStorage);
        if (broadcast) {
            this._channel.postMessage({type: 'remove_session_data', from: this.UID, keys: [key]});
        }
        return database.removeItem(key);
    }
};

//Auxiliary functions

JSPLib.storage.checkStorageData = function (key,validator,storage,default_val=null) {
    let storage_type = this._getStorageType(storage);
    JSPLib.debug.debuglogLevel("storage.checkStorageData - Checking storage",key,JSPLib.debug.VERBOSE);
    if (key in this.memory_storage[storage_type]) {
        JSPLib.debug.debuglogLevel("storage.checkStorageData - Memory hit",key,JSPLib.debug.DEBUG);
        return this.memory_storage[storage_type][key];
    }
    if (!(key in storage)) {
        JSPLib.debug.debuglogLevel("storage.checkStorageData - Storage miss",key,JSPLib.debug.DEBUG);
        return default_val;
    }
    let data = this.getStorageData(key,storage);
    if (validator(key,data)) {
        JSPLib.debug.debuglogLevel("storage.checkStorageData - Data validated",key,JSPLib.debug.VERBOSE);
        return data;
    }
    JSPLib.debug.debuglogLevel("storage.checkStorageData - Data corrupted",key,JSPLib.debug.DEBUG);
    return default_val;
};

JSPLib.storage.pruneStorageData = function (storage) {
    let storage_type = JSPLib.storage._getStorageType(storage);
    JSPLib.debug.debuglogLevel("storage.pruneStorageData - Pruning",storage_type,JSPLib.debug.WARNING);
    let removed_storage = 0;
    let nonremoved_storage = 0;
    let nonexpires_storage = 0;
    let items_removed = 0;
    Object.keys(storage).forEach((key)=>{
        let data = this.getStorageData(key,storage);
        let datasize = JSON.stringify(data).length;
        if (this.hasDataExpired(key,data,null,true)) {
            JSPLib.debug.debuglogLevel("storage.pruneStorageData - Deleting",key,JSPLib.debug.VERBOSE);
            this.removeStorageData(key,storage);
            removed_storage += datasize;
            items_removed++;
        } else if (this.hasDataExpired(key,data,null,false)) {
            nonexpires_storage += datasize;
        } else {
            nonremoved_storage += datasize;
        }
    });
    JSPLib.debug.debuglogLevel(`storage.pruneStorageData - Pruned ${items_removed} items from ${storage_type}`,JSPLib.debug.INFO);
    JSPLib.debug.debuglogLevel(`storage.pruneStorageData - Removed: ${removed_storage} ; Nonremoved: ${nonremoved_storage} ; Nonexpires: ${nonexpires_storage}`,JSPLib.debug.INFO);
};

JSPLib.storage.hasDataExpired = function (key,storeditem,max_expires,ignore_expires=false) {
    if (typeof storeditem !== "object" || storeditem == null || (!('expires' in storeditem))) {
        if (ignore_expires) {
            return false;
        } else {
            JSPLib.debug.debuglogLevel("storage.hasDataExpired - ",key,"has no expires!",JSPLib.debug.INFO);
            return true;
        }
    } else if (storeditem.expires !== 0 && !JSPLib.utility.validateExpires(storeditem.expires,max_expires)) {
        JSPLib.debug.debuglogLevel("storage.hasDataExpired - ",key,"has expired!",JSPLib.debug.VERBOSE);
        return true;
    }
    return false;
};

//The validator returns true for valid data, false for invalid data
JSPLib.storage.checkLocalDB = async function (key,validator,max_expires,database=JSPLib.storage.danboorustorage) {
    if (this.use_storage) {
        var cached = await this.retrieveData(key,false,database);
        if (cached === null) {
            JSPLib.debug.debuglogLevel("storage.checkLocalDB - Missing key",key,JSPLib.debug.DEBUG);
            return cached;
        }
        JSPLib.debug.debuglogLevel("storage.checkLocalDB - Checking DB",key,JSPLib.debug.VERBOSE);
        if (validator(key,cached) && !this.hasDataExpired(key,cached,max_expires)) {
            JSPLib.debug.debuglogLevel("storage.checkLocalDB - DB Hit",key,JSPLib.debug.VERBOSE);
            return cached;
        }
        JSPLib.debug.debuglogLevel("storage.checkLocalDB - DB Miss",key,JSPLib.debug.DEBUG);
    }
    return null;
};

JSPLib.storage.batchStorageCheck = async function (keyarray,validator,max_expires,prefix,database=JSPLib.storage.danboorustorage) {
    let promise_array = [];
    if (prefix) {
        keyarray = this.nameToKeyTransform(keyarray, prefix);
    }
    keyarray.forEach((key)=>{
        promise_array.push(this.checkLocalDB(key, validator, max_expires, database));
    });
    let result_array = await Promise.all(promise_array);
    let found_array = [];
    let missing_array = [];
    result_array.forEach((result,i)=>{
        if (result) {
            found_array.push(keyarray[i]);
        } else {
            missing_array.push(keyarray[i]);
        }
    });
    if (prefix) {
        found_array = this.keyToNameTransform(found_array, prefix);
        missing_array = this.keyToNameTransform(missing_array, prefix);
    }
    return [found_array, missing_array];
};

JSPLib.storage.pruneStorage = async function (regex,database=JSPLib.storage.danboorustorage) {
    if (!this.use_storage) {
        return;
    }
    let pruned_keys = [];
    let promise_array = [];
    await database.iterate((value,key)=>{
        if (key.match(regex)) {
            if (this.hasDataExpired(key,value)) {
                JSPLib.debug.debuglogLevel("storage.pruneStorage - Deleting",key,JSPLib.debug.DEBUG);
                if (!database.removeItems) {
                    promise_array.push(this.removeData(key,false,database));
                }
                pruned_keys.push(key);
            }
            if (!database.removeItems && pruned_keys.length >= this.prune_limit) {
                JSPLib.debug.debuglogLevel("storage.pruneStorage - Prune limit reached!",JSPLib.debug.WARNING);
                return true;
            }
        }
    });
    if (JSPLib.debug.debug_console) {
        let all_keys = await database.keys();
        let program_keys = all_keys.filter(key => key.match(regex));
        JSPLib.debug.debuglogLevel(`storage.pruneStorage - Pruning ${pruned_keys.length}/${program_keys.length} items!`,JSPLib.debug.INFO);
    }
    if (database.removeItems) {
        return JSPLib.storage.batchRemoveData(pruned_keys, database);
    } else {
        this._channel.postMessage({type: 'remove_session_data', from: this.UID, keys: pruned_keys});
        return Promise.all(promise_array);
    }
};

JSPLib.storage.pruneEntries = function (modulename,regex,prune_expires,database=JSPLib.storage.danboorustorage) {
    let expire_name = modulename + '-prune-expires';
    JSPLib.debug.debugTime("PruneEntries");
    let expires = this.getStorageData(expire_name,localStorage,0);
    if (!JSPLib.utility.validateExpires(expires,prune_expires)) {
        JSPLib.debug.debuglogLevel("storage.pruneEntries - Pruning entries...",JSPLib.debug.INFO);
        let promise_resp = this.pruneStorage(regex,database).then(()=>{
            JSPLib.debug.debuglogLevel("storage.pruneEntries - Pruning complete!",JSPLib.debug.INFO);
            JSPLib.debug.debugTimeEnd("PruneEntries");
        });
        //Have up to a 10% swing so that all scripts don't prune at the same time
        let adjusted_prune_expires = prune_expires + (-Math.random() * prune_expires / 10);
        this.setStorageData(expire_name, JSPLib.utility.getExpires(adjusted_prune_expires), localStorage);
        return promise_resp;
    } else {
        JSPLib.debug.debuglogLevel("storage.pruneEntries - No prune of entries!",JSPLib.debug.DEBUG);
    }
};

JSPLib.storage.purgeCache = async function (regex,counter_domname,database=JSPLib.storage.danboorustorage) {
    JSPLib.utility.notice("Starting cache deletion...");
    let remaining_count = 0;
    let promise_array = [];
    let all_keys = await database.keys();
    let purge_keys = all_keys.filter(key => key.match(regex));
    purge_keys.forEach((key)=>{
        JSPLib.debug.debuglogLevel("storage.purgeCache - Deleting",key,JSPLib.debug.DEBUG);
        let resp = this.removeData(key,false,database).then(()=>{
            this._adjustCounter(counter_domname,--remaining_count);
        });
        promise_array.push(resp);
        this._adjustCounter(counter_domname,++remaining_count);
    });
    this._channel.postMessage({type: 'remove_session_data', from: this.UID, keys: purge_keys});
    JSPLib.utility.notice(`Deleting ${purge_keys.length} items...`);
    JSPLib.debug.debuglogLevel(`storage.purgeCache - Deleting ${purge_keys.length} items...`,JSPLib.debug.INFO);
    //Wait at least 5 seconds
    await JSPLib.utility.sleep(5000);
    await Promise.all(promise_array);
    JSPLib.utility.notice("Finished deleting cached data!");
    JSPLib.debug.debuglogLevel("storage.purgeCache - Finished deleting cached data!",JSPLib.debug.INFO);
};

JSPLib.storage.programCacheInfo = async function (program_shortcut,data_regex,database=JSPLib.storage.danboorustorage) {
    let cache_info = Object.assign({},...['index','session','local'].map((name)=>{return {[name]: {total_items:0,total_size:0,program_items:0,program_size:0}};}));
    let has_regex = typeof data_regex === 'object' && data_regex !== null && 'exec' in data_regex;
    let program_regex = RegExp(`^${program_shortcut}-`);
    let session_regex = (has_regex ? RegExp(`(${data_regex.source})|(^${program_shortcut}-)`) : program_regex);
    let index_wait = Promise.resolve(null);
    if (has_regex) {
        index_wait = database.iterate((value,key)=>{
            this._addItemCacheInfo(cache_info.index, key, JSON.stringify(value), data_regex);
        });
    }
    Object.keys(sessionStorage).forEach((key)=>{
        this._addItemCacheInfo(cache_info.session, key, sessionStorage[key], session_regex);
    });
    Object.keys(localStorage).forEach((key)=>{
        this._addItemCacheInfo(cache_info.local, key, localStorage[key], program_regex);
    });
    await index_wait;
    return cache_info;
};

//Batch functions

JSPLib.storage.batchRetrieveData = async function (keylist,database=JSPLib.storage.danboorustorage) {
    if (!this.use_storage || !database.getItems) {
        return {};
    }
    let database_type = this.use_indexed_db ? "IndexDB" : "LocalStorage";
    let session_items = {};
    let missing_keys = [];
    keylist.forEach((key)=>{
        let data = this.getStorageData(key,sessionStorage);
        if (data) {
            session_items[key] = data;
        } else {
            missing_keys.push(key);
        }
    });
    JSPLib.debug.debuglogLevel("storage.batchRetrieveData - Found items (Session):",Object.keys(session_items),JSPLib.debug.VERBOSE);
    if (missing_keys.length === 0) {
        return session_items;
    }
    let record_key = keylist.join(',');
    JSPLib.debug.recordTime(record_key,database_type);
    let database_items = await database.getItems(missing_keys);
    JSPLib.debug.recordTimeEnd(record_key,database_type);
    JSPLib.debug.debuglogLevel(`storage.retrieveData - Found item (${database_type}):`,Object.keys(database_items),JSPLib.debug.VERBOSE);
    for (let key in database_items) {
        this.setStorageData(key,database_items[key],sessionStorage);
    }
    return Object.assign(session_items,database_items);
};

JSPLib.storage.batchSaveData = function (data_items,database=JSPLib.storage.danboorustorage) {
    if (!this.use_storage || !database.setItems) {
        return;
    }
    for (let key in data_items) {
        this.setStorageData(key,data_items[key],sessionStorage);
    }
    return database.setItems(data_items);
};

JSPLib.storage.batchRemoveData = function (keylist,database=JSPLib.storage.danboorustorage) {
    if (!this.use_storage || !database.removeItems) {
        return;
    }
    keylist.forEach((key)=>{
        this.removeStorageData(key,sessionStorage);
    });
    this._channel.postMessage({type: 'remove_session_data', from: this.UID, keys: keylist});
    return database.removeItems(keylist);
};

JSPLib.storage.batchCheckLocalDB = async function (keylist,validator,expiration,database=JSPLib.storage.danboorustorage) {
    if (!this.use_storage || !database.getItems) {
        return {};
    }
    var cached = await this.batchRetrieveData(keylist,database);
    for (let key in cached) {
        let max_expires = 0;
        if (Number.isInteger(expiration)) {
            max_expires = expiration;
        } else if (typeof expiration === 'function') {
            max_expires = expiration(key,cached[key]);
        }
        JSPLib.debug.debuglogLevel("storage.batchCheckLocalDB - Checking DB",key,JSPLib.debug.VERBOSE);
        if (!validator(key,cached[key]) || this.hasDataExpired(key,cached[key],max_expires)) {
            JSPLib.debug.debuglogLevel("storage.batchCheckLocalDB - DB Miss",key,JSPLib.debug.DEBUG);
            delete cached[key];
        } else {
            JSPLib.debug.debuglogLevel("storage.checkLocalDB - DB Hit",key,JSPLib.debug.VERBOSE);
        }
    }
    return cached;
};

//Helper functions

JSPLib.storage.nameToKeyTransform = function (namelist,prefix) {
    return namelist.map((value)=>{return prefix + '-' + value;});
};

JSPLib.storage.keyToNameTransform = function (keylist,prefix) {
    return keylist.map((key)=>{return key.replace(RegExp('^' + prefix + '-'),'');});
};

/****PRIVATE DATA****/

//Variables

JSPLib.storage._active_script = false;

JSPLib.storage._window = (typeof unsafeWindow !== "undefined" ? unsafeWindow : window);

JSPLib.storage._channel = new BroadcastChannel('JSPLib.storage');

//Functions

JSPLib.storage._adjustCounter = function (counter_domname,count) {
    if (counter_domname && document.querySelector(counter_domname)) {
        document.querySelector(counter_domname).innerText = count;
    }
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

JSPLib.storage._getStorageType = function (storage) {
    return (storage === window.localStorage ? 'localStorage' : 'sessionStorage');
};

JSPLib.storage._broadcastRX = function () {
    let context = this;
    return function (event) {
        if (context._active_script && event.data.from !== context.UID) {
            JSPLib.debug.debuglogLevel('JSPLib.storage [broadcast] -',`(${event.data.type}):`,event.data,JSPLib.debug.INFO);
            if (event.data.type === 'remove_session_data') {
                event.data.keys.forEach((key)=>{
                    context.removeStorageData(key,sessionStorage);
                });
            }
        }
    };
};

/****INITIALIZATION****/

JSPLib.storage._channel.onmessage = JSPLib.storage._broadcastRX();
JSPLib.storage._window.JSPLib = JSPLib.storage._window.JSPLib || {};
JSPLib.storage._window.JSPLib.UID = JSPLib.storage._window.JSPLib.UID || {};
if (!('storage' in JSPLib.storage._window.JSPLib.UID)) {
    JSPLib.storage._active_script = true;
    JSPLib.storage._window.JSPLib.UID.storage = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
}
Object.defineProperty(JSPLib.storage, 'UID', {get: function() {return this._window.JSPLib.UID.storage;}});

JSPLib.storage._configuration = {
    nonenumerable: ['_active_script','_window','_channel','_adjustCounter','_addItemCacheInfo','_getStorageType','_configuration'],
    nonwritable: ['_active_script','_window','_channel','danboorustorage','use_indexed_db','use_local_storage','use_storage','_configuration']
};
Object.defineProperty(JSPLib,'storage',{configurable:false,writable:false});
for (let property in JSPLib.storage) {
    if (JSPLib.storage._configuration.nonenumerable.includes(property)) {
        Object.defineProperty(JSPLib.storage,property,{enumerable:false});
    }
    if (JSPLib.storage._configuration.nonwritable.includes(property)) {
        Object.defineProperty(JSPLib.storage,property,{writable:false});
    }
    Object.defineProperty(JSPLib.storage,property,{configurable:false});
}
