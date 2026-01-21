/****DEPENDENCIES****/

/**External dependencies**/
// localforage.js (optional)

/**Internal dependencies**/
// JSPLib.utility
// JSPLib.concurrency

/****SETUP****/

//Linter configuration
/* global JSPLib localforage */

(function (debug, notice, utility, concurrency) {

const storage = JSPLib.storage;

/****GLOBAL VARIABLES****/

//Gets own instance in case forage is used in another script
storage.danboorustorage = window.localforage?.createInstance({
    name: 'Danbooru storage',
    driver: [
        localforage.INDEXEDDB,
        localforage.LOCALSTORAGE
    ]
});

storage.localSessionValidator = null;
storage.indexedDBValidator = null;

/****PRIVATE VARIABLES****/

const LOCALFORAGE_AVAILABLE = Boolean(storage.danboorustorage);
const USE_INDEXED_DB = LOCALFORAGE_AVAILABLE && storage.danboorustorage.supports(storage.danboorustorage.INDEXEDDB);
const USE_LOCAL_STORAGE = LOCALFORAGE_AVAILABLE && !USE_INDEXED_DB && storage.danboorustorage.supports(storage.danboorustorage.LOCALSTORAGE);
const USE_STORAGE = USE_INDEXED_DB || USE_LOCAL_STORAGE;

const MEMORY_STORAGE = {sessionStorage: {}, localStorage: {}};

const CHANNEL = new BroadcastChannel('storage');

/****FUNCTIONS****/

// localStorage/sessionStorage

//// General

storage.getStorageData = function (key, store, {default_val = null, bypass = false} = {}) {
    let storage_type = _getStorageType(store);
    var return_val;
    if (!bypass && key in MEMORY_STORAGE[storage_type]) {
        return_val = MEMORY_STORAGE[storage_type][key];
    } else if (key in store) {
        let record_key = _getUID(key);
        debug.recordTime(record_key, 'Storage');
        let data = store.getItem(key);
        debug.recordTimeEnd(record_key, 'Storage');
        try {
            return_val = MEMORY_STORAGE[storage_type][key] = JSON.parse(data);
        } catch (e) {
            //swallow exception
        }
    }
    if (return_val === undefined){
        return_val = default_val;
    }
    return utility.dataCopy(return_val);
};

storage.setStorageData = function (key, data, store) {
    const printer = debug.getFunctionPrint('storage.setStorageData');
    let storage_type = _getStorageType(store);
    MEMORY_STORAGE[storage_type][key] = utility.dataCopy(data);
    try {
        store.setItem(key, JSON.stringify(data));
    } catch (e) {
        printer.debugerrorLevel("Error saving data!", e, debug.ERROR);
        if (store === sessionStorage) {
            sessionStorage.clear();
        }
    }
};

storage.removeStorageData = function (key, store) {
    storage.invalidateStorageData(key, store);
    store.removeItem(key);
};

storage.invalidateStorageData = function (key, store) {
    let storage_type = _getStorageType(store);
    delete MEMORY_STORAGE[storage_type][key];
};

//// Local

storage.getLocalData = function (key, {default_val = null, bypass = false} = {}) {
    return storage.getStorageData(key, localStorage, {default_val, bypass});
};

storage.setLocalData = function (key, data) {
    storage.setStorageData(key, data, localStorage);
};

storage.removeLocalData = function (key) {
    storage.removeStorageData(key, localStorage);
};

storage.invalidateLocalData = function (key) {
    storage.invalidateStorageData(key, localStorage);
};

//// Session

storage.getSessionData = function (key, {default_val = null, bypass = false} = {}) {
    return storage.getStorageData(key, sessionStorage, {default_val, bypass});
};

storage.setSessionData = function (key, data) {
    storage.setStorageData(key, data, sessionStorage);
};

storage.removeSessionData = function (key) {
    storage.removeStorageData(key, sessionStorage);
};

storage.invalidateSessionData = function (key) {
    storage.invalidateStorageData(key, sessionStorage);
};

//// Indexed session

storage.getIndexedSessionData = function (key, {default_val = null, bypass = false, database = storage.danboorustorage} = {}) {
    let session_key = _getSessionKey(key, database);
    return storage.getSessionData(session_key, {default_val, bypass});
};

storage.setIndexedSessionData = function (key, data, {database = storage.danboorustorage} = {}) {
    let session_key = _getSessionKey(key, database);
    storage.setSessionData(session_key, data);
};

storage.removeIndexedSessionData = function (key, {database = storage.danboorustorage} = {}) {
    let session_key = _getSessionKey(key, database);
    storage.removeSessionData(session_key);
};

storage.invalidateIndexedSessionData = function (key, {database = storage.danboorustorage} = {}) {
    let session_key = _getSessionKey(key, database);
    storage.invalidateSessionData(session_key);
};

// Indexed DB

storage.retrieveData = async function (key, {bypass_cache = false, database = storage.danboorustorage} = {}) {
    const printer = debug.getFunctionPrint('storage.retrieveData');
    if (!(USE_STORAGE)) {
        return null;
    }
    if (!bypass_cache) {
        let data = storage.getIndexedSessionData(key, {default_val: null, database});
        if (data) {
            printer.debuglogLevel("Found item (Session):", key, debug.VERBOSE);
            return data;
        }
    }
    let database_type = USE_INDEXED_DB ? "IndexDB" : "LocalStorage";
    let record_key = _getUID(key);
    debug.recordTime(record_key, database_type);
    let data = await database.getItem(key);
    debug.recordTimeEnd(record_key, database_type);
    if (data !== null) {
        printer.debuglogLevel(`Found item (${database_type}):`, key, debug.VERBOSE);
        storage.setIndexedSessionData(key, data, {database});
    }
    return data;
};

storage.saveData = function (key, value, {database = storage.danboorustorage} = {}) {
    if (USE_STORAGE) {
        storage.setIndexedSessionData(key, value, {database});
        return database.setItem(key, value);
    }
};

storage.removeData = function (key, {broadcast = true, database = storage.danboorustorage} = {}) {
    if (USE_STORAGE) {
        storage.removeIndexedSessionData(key, {database});
        let session_key = _getSessionKey(key, database);
        if (broadcast) {
            CHANNEL.postMessage({type: 'remove_session_data', from: JSPLib.UID.value, keys: [session_key]});
        }
        return database.removeItem(key);
    }
};

// Batch Indexed DB

storage.batchRetrieveData = async function (keylist, {database = storage.danboorustorage} = {}) {
    var found_session, found_database;
    const printer = debug.getFunctionPrint('storage.batchRetrieveData');
    printer.debuglogLevel("Querying", keylist.length, "items:", keylist, debug.VERBOSE);
    let database_type = USE_INDEXED_DB ? "IndexDB" : "LocalStorage";
    let session_items = {};
    let missing_keys = [];
    keylist.forEach((key) => {
        let data = storage.getIndexedSessionData(key, {default_val: null, database});
        if (data) {
            session_items[key] = data;
        } else {
            missing_keys.push(key);
        }
    });
    debug.debugExecute(() => {
        found_session = Object.keys(session_items);
        if (found_session.length) {
            printer.debuglog("Found", found_session.length, "items (Session):", found_session, debug.VERBOSE);
        }
    }, debug.VERBOSE);
    if (missing_keys.length === 0) {
        return session_items;
    }
    let record_key = _getUID(keylist);
    debug.recordTime(record_key, database_type);
    let database_items = await database.getItems(missing_keys);
    debug.recordTimeEnd(record_key, database_type);
    debug.debugExecute(() => {
        found_database = Object.keys(database_items);
        if (found_database.length) {
            printer.debuglog(`Found ${found_database.length} items (${database_type}):`, found_database);
        }
        var missing_list = utility.arrayDifference(keylist, utility.concat(found_session, found_database));
        if (missing_list.length) {
            printer.debuglog("Missing", missing_list.length, "items:", missing_list);
        }
    }, debug.VERBOSE);
    for (let key in database_items) {
        storage.setIndexedSessionData(key, database_items[key], {database});
    }
    return Object.assign(session_items, database_items);
};

storage.batchSaveData = function (data_items, {database = storage.danboorustorage} = {}) {
    for (let key in data_items) {
        storage.setIndexedSessionData(key, data_items[key], {database});
    }
    return database.setItems(data_items);
};

storage.batchRemoveData = function (keylist, {database = storage.danboorustorage} = {}) {
    keylist.forEach((key) => {
        storage.removeIndexedSessionData(key, {database});
    });
    let session_keylist = keylist.map((key) => _getSessionKey(key, database));
    CHANNEL.postMessage({type: 'remove_session_data', from: JSPLib.UID.value, keys: session_keylist});
    return database.removeItems(keylist);
};

// Validate

storage.checkStorageData = function (key, store, {validator = storage.localSessionValidator, default_val = null, bypass = false} = {}) {
    const printer = debug.getFunctionPrint('storage.checkStorageData');
    let storage_type = _getStorageType(store);
    printer.debuglogLevel("Checking storage", key, debug.ALL);
    if (!bypass && key in MEMORY_STORAGE[storage_type]) {
        printer.debuglogLevel("Memory hit", key, debug.VERBOSE);
        return MEMORY_STORAGE[storage_type][key];
    }
    if (!(key in store)) {
        printer.debuglogLevel("Storage miss", key, debug.VERBOSE);
        return default_val;
    }
    let data = storage.getStorageData(key, store, {bypass});
    if (validator?.(key, data)) {
        printer.debuglogLevel("Data validated", key, debug.ALL);
        return data;
    }
    printer.debuglogLevel("Data corrupted", key, debug.DEBUG);
    return default_val;
};

storage.checkLocalData = function (key, {validator = storage.localSessionValidator, default_val = null, bypass = false} = {}) {
    return storage.checkStorageData(key, localStorage, {validator, default_val, bypass});
};

storage.checkSessionData = function (key, {validator = storage.localSessionValidator, default_val = null, bypass = false} = {}) {
    return storage.checkStorageData(key, sessionStorage, {validator, default_val, bypass});
};

storage.checkIndexedSessionData = function (key, {validator = storage.localSessionValidator, default_val = null, bypass = false, database = storage.danboorustorage} = {}) {
    let session_key = _getSessionKey(key, database);
    return storage.checkSessionData(session_key, {validator, default_val, bypass});
};

storage.checkLocalDB = async function (key, {validator = storage.indexedDBValidator, default_val = null, max_expires = null, database = storage.danboorustorage} = {}) {
    const printer = debug.getFunctionPrint('storage.checkLocalDB');
    if (USE_STORAGE) {
        var cached = await storage.retrieveData(key, {bypass_cache: false, database});
        if (cached === null) {
            printer.debuglogLevel("Missing key", key, debug.DEBUG);
            return default_val;
        }
        printer.debuglogLevel("Checking DB", key, debug.VERBOSE);
        if (validator?.(key, cached) && !storage.hasDataExpired(key, cached, max_expires)) {
            printer.debuglogLevel("DB Hit", key, debug.VERBOSE);
            return cached;
        }
        printer.debuglogLevel("DB Miss", key, debug.DEBUG);
    }
    return default_val;
};

storage.batchCheckLocalDB = async function (keylist, {validator = storage.indexedDBValidator, expiration = null, database = storage.danboorustorage} = {}) {
    const printer = debug.getFunctionPrint('storage.batchCheckLocalDB');
    var cached = await storage.batchRetrieveData(keylist, {database});
    for (let key in cached) {
        let max_expires = null;
        if (Number.isInteger(expiration)) {
            max_expires = expiration;
        } else if (typeof expiration === 'function') {
            max_expires = expiration(key, cached[key]);
        }
        printer.debuglogLevel("Checking DB", key, debug.VERBOSE);
        if (!validator?.(key, cached[key]) || storage.hasDataExpired(key, cached[key], max_expires)) {
            printer.debuglogLevel("DB Miss", key, debug.DEBUG);
            delete cached[key];
        } else {
            printer.debuglogLevel("DB Hit", key, debug.VERBOSE);
        }
    }
    return cached;
};

// Prune/purge

storage.pruneCache = async function (regex, {database = storage.danboorustorage} = {}) {
    const printer = debug.getFunctionPrint('storage.pruneCache');
    if (!database.removeItems) {
        return;
    }
    let pruned_keys = [];
    await database.iterate((value, key) => {
        if (key.match(regex)) {
            if (storage.hasDataExpired(key, value)) {
                printer.debuglogLevel("Deleting", key, debug.DEBUG);
                pruned_keys.push(key);
            }
        }
    });
    debug.debugExecute(async () => {
        let all_keys = await database.keys();
        let program_keys = all_keys.filter((key) => key.match(regex));
        printer.debuglogLevel(`Pruning ${pruned_keys.length}/${program_keys.length} items!`, debug.INFO);
    });
    await storage.batchRemoveData(pruned_keys, {database});
};

storage.purgeCache = async function (regex, {database = storage.danboorustorage} = {}) {
    const printer = debug.getFunctionPrint('storage.purgeCache');
    notice.notice("Starting cache deletion...");
    let all_keys = await database.keys();
    let purge_keys = all_keys.filter((key) => key.match(regex));
    notice.notice(`Deleting ${purge_keys.length} items...`);
    printer.debuglogLevel(`Deleting ${purge_keys.length} items...`, debug.INFO);
    await storage.batchRemoveData(purge_keys, {database});
    //Wait at least 5 seconds
    await utility.sleep(5000);
    notice.notice("Finished deleting cached data!");
    printer.debuglogLevel("Finished deleting cached data!", debug.INFO);
    CHANNEL.postMessage({type: 'remove_session_data', from: JSPLib.UID.value, keys: purge_keys});
};

// Program

storage.programCacheInfo = async function (data_regex, {database = storage.danboorustorage} = {}) {
    let cache_info = Object.assign({}, ...['index', 'session', 'local'].map((name) => ({[name]: {total_items: 0, total_size: 0, program_items: 0, program_size: 0}})));
    var session_regex;
    var index_wait;
    if (typeof data_regex === 'object' && data_regex !== null && 'exec' in data_regex) {
        let database_re = '^' + _getDatabaseKey(database) + '-' + (data_regex.source[0] === '^' ? data_regex.source.slice(1) : data_regex.source);
        session_regex = RegExp(`(${database_re})|(${JSPLib.program_regex.source})`);
        index_wait = database.iterate((value, key) => {
            if (value === undefined) return;
            _addItemCacheInfo(cache_info.index, key, JSON.stringify(value), data_regex);
        });
    } else {
        session_regex = JSPLib.program_regex;
        index_wait = Promise.resolve(null);
    }
    Object.keys(sessionStorage).forEach((key) => {
        _addItemCacheInfo(cache_info.session, key, sessionStorage[key], session_regex);
    });
    Object.keys(localStorage).forEach((key) => {
        _addItemCacheInfo(cache_info.local, key, localStorage[key], JSPLib.program_regex);
    });
    await index_wait;
    return cache_info;
};

storage.pruneProgramCache = function (regex, prune_expires, {database = storage.danboorustorage} = {}) {
    const printer = debug.getFunctionPrint('storage.pruneProgramCache');
    let expire_name = JSPLib.program_shortcut + '-prune-expires';
    if (!concurrency.checkTimeout(expire_name, prune_expires)) {
        printer.debuglogLevel("No prune of entries.", debug.DEBUG);
        return;
    }
    if (!concurrency.reserveSemaphore('prune')) {
        printer.debuglogLevel("Pruning detected in another script/tab.", debug.WARNING);
        return;
    }
    debug.debugTime("pruneModuleEntries");
    printer.debuglogLevel("Pruning entries...", debug.INFO);
    let promise_resp = storage.pruneCache(regex, {database}).then(() => {
        printer.debuglogLevel("Pruning complete!", debug.INFO);
        debug.debugTimeEnd("pruneModuleEntries");
        concurrency.freeSemaphore('prune');
    });
    //Have up to a 10% swing so that all scripts don't prune at the same time
    let adjusted_prune_expires = prune_expires + (-Math.random() * prune_expires / 10);
    concurrency.setRecheckTimeout(expire_name, adjusted_prune_expires, localStorage);
    return promise_resp;
};

//Helper functions

storage.hasDataExpired = function (key, storeditem, max_expires) {
    const printer = debug.getFunctionPrint('storage.hasDataExpired');
    if (typeof storeditem !== "object" || storeditem == null || (!('expires' in storeditem))) {
        printer.debuglogLevel(key, "has no expires!", debug.INFO);
        return true;
    }
    if (storeditem.expires !== 0 && !utility.validateExpires(storeditem.expires, max_expires)) {
        printer.debuglogLevel(key, "has expired!", debug.VERBOSE);
        return true;
    }
    return false;
};

storage.inMemoryStorage = function (key, store, database = null) {
    if (database !== null) {
        key = _getSessionKey(key, database);
    }
    let storage_type = _getStorageType(store);
    return key in MEMORY_STORAGE[storage_type];
};

/****PRIVATE FUNCTIONS****/

function _getDatabaseKey(database) {
    database._jsplib_key ??= database._config.name.toLowerCase().replace(" ", '-');
    return database._jsplib_key;
}

function _getSessionKey(datakey, database) {
    return _getDatabaseKey(database) + '-' + datakey;
}

function _getUID(input = null) {
    let UID = "";
    debug.debugExecute(() => {
        if (typeof input === 'string' || typeof input === 'number' || input === null) {
            UID = input;
        } else if (Array.isArray(input)) {
            UID = input.join(',');
        } else if (typeof input === 'object') {
            UID = Object.keys(input).join(',');
        }
        UID += ';' + utility.getUniqueID();
    });
    return UID;
}

function _addItemCacheInfo(entry, key, value, regex) {
    let current_size = value.length;
    entry.total_items++;
    entry.total_size += current_size;
    if (key.match(regex)) {
        entry.program_items++;
        entry.program_size += current_size;
    }
}

function _getStorageType(store) {
    if (store === localStorage) return 'localStorage';
    if (store === sessionStorage) return 'sessionStorage';
    return 'unknownStorage';
}

function _broadcastRX() {
    let iteration = 1;
    return function (event) {
        if (JSPLib._active_script && event.data.from !== JSPLib.UID.value) {
            debug.debuglogLevel(`storage.broadcastRX[${iteration++}]`, `(${event.data.type}):`, event.data, debug.INFO);
            if (event.data.type === 'remove_session_data') {
                event.data.keys.forEach((key) => {
                    storage.removeStorageData(key, sessionStorage);
                });
            }
        }
    };
}

/****INITIALIZATION****/

CHANNEL.onmessage = _broadcastRX();

JSPLib.initializeModule('storage', {
    nonwritable: ['danboorustorage']
});

})(JSPLib.debug, JSPLib.notice, JSPLib.utility, JSPLib.concurrency);
