/****DEPENDENCIES****/

/**External dependencies**/
// localforage.js (optional)

/**Internal dependencies**/
// JSPLib.Debug (optional)
// JSPLib.Notice (optional)
// JSPLib.Utility
// JSPLib.Concurrency

/****SETUP****/

//Linter configuration
/* global JSPLib localforage */

(function ({Debug, Notice, Utility, Concurrency}) {

const Storage = JSPLib.Storage;

/****GLOBAL VARIABLES****/

//Gets own instance in case forage is used in another script
Storage.danboorustorage = window.localforage?.createInstance({
    name: 'Danbooru storage',
    driver: [
        localforage.INDEXEDDB,
        localforage.LOCALSTORAGE
    ]
});

/****PRIVATE VARIABLES****/

const LOCALFORAGE_AVAILABLE = Boolean(Storage.danboorustorage);
const USE_INDEXED_DB = LOCALFORAGE_AVAILABLE && Storage.danboorustorage.supports(Storage.danboorustorage.INDEXEDDB);
const USE_LOCAL_STORAGE = LOCALFORAGE_AVAILABLE && !USE_INDEXED_DB && Storage.danboorustorage.supports(Storage.danboorustorage.LOCALSTORAGE);
const USE_STORAGE = USE_INDEXED_DB || USE_LOCAL_STORAGE;

const MEMORY_STORAGE = {sessionStorage: {}, localStorage: {}};

/****FUNCTIONS****/

// localStorage/sessionStorage

//// General

Storage.getStorageData = function (key, store, {default_val = null, bypass = false} = {}) {
    let storage_type = _getStorageType(store);
    var return_val;
    if (!bypass && key in MEMORY_STORAGE[storage_type]) {
        return_val = MEMORY_STORAGE[storage_type][key];
    } else if (key in store) {
        let record_key = _getUID(key);
        Debug.recordTime(record_key, 'Storage');
        let data = store.getItem(key);
        Debug.recordTimeEnd(record_key, 'Storage');
        try {
            return_val = MEMORY_STORAGE[storage_type][key] = JSON.parse(data);
        } catch (e) {
            //swallow exception
        }
    }
    if (return_val === undefined){
        return_val = default_val;
    }
    return Utility.deepCopy(return_val);
};

Storage.setStorageData = function (key, data, store) {
    const printer = Debug.getFunctionPrint('Storage.setStorageData');
    let storage_type = _getStorageType(store);
    MEMORY_STORAGE[storage_type][key] = Utility.deepCopy(data);
    try {
        store.setItem(key, JSON.stringify(data));
    } catch (e) {
        printer.errorLevel("Error saving data!", e, Debug.ERROR);
        if (store === sessionStorage) {
            sessionStorage.clear();
        }
    }
};

Storage.removeStorageData = function (key, store) {
    Storage.invalidateStorageData(key, store);
    store.removeItem(key);
};

Storage.invalidateStorageData = function (key, store) {
    let storage_type = _getStorageType(store);
    delete MEMORY_STORAGE[storage_type][key];
};

//// Local

Storage.getLocalData = function (key, {default_val = null, bypass = false} = {}) {
    return Storage.getStorageData(key, localStorage, {default_val, bypass});
};

Storage.setLocalData = function (key, data) {
    Storage.setStorageData(key, data, localStorage);
};

Storage.removeLocalData = function (key) {
    Storage.removeStorageData(key, localStorage);
};

Storage.invalidateLocalData = function (key) {
    Storage.invalidateStorageData(key, localStorage);
};

//// Session

Storage.getSessionData = function (key, {default_val = null, bypass = false} = {}) {
    return Storage.getStorageData(key, sessionStorage, {default_val, bypass});
};

Storage.setSessionData = function (key, data) {
    Storage.setStorageData(key, data, sessionStorage);
};

Storage.removeSessionData = function (key) {
    Storage.removeStorageData(key, sessionStorage);
};

Storage.invalidateSessionData = function (key) {
    Storage.invalidateStorageData(key, sessionStorage);
};

//// Indexed session

Storage.getIndexedSessionData = function (key, {default_val = null, bypass = false, database = Storage.danboorustorage} = {}) {
    let session_key = _getSessionKey(key, database);
    return Storage.getSessionData(session_key, {default_val, bypass});
};

Storage.setIndexedSessionData = function (key, data, {database = Storage.danboorustorage} = {}) {
    let session_key = _getSessionKey(key, database);
    Storage.setSessionData(session_key, data);
};

Storage.removeIndexedSessionData = function (key, {database = Storage.danboorustorage} = {}) {
    let session_key = _getSessionKey(key, database);
    Storage.removeSessionData(session_key);
};

Storage.invalidateIndexedSessionData = function (key, {database = Storage.danboorustorage} = {}) {
    let session_key = _getSessionKey(key, database);
    Storage.invalidateSessionData(session_key);
};

// Indexed DB

Storage.retrieveData = async function (key, {bypass_cache = false, database = Storage.danboorustorage} = {}) {
    const printer = Debug.getFunctionPrint('Storage.retrieveData');
    if (!(USE_STORAGE)) {
        return null;
    }
    if (!bypass_cache) {
        let data = Storage.getIndexedSessionData(key, {default_val: null, database});
        if (data) {
            printer.logLevel("Found item (Session):", key, Debug.VERBOSE);
            return data;
        }
    }
    let database_type = USE_INDEXED_DB ? "IndexDB" : "LocalStorage";
    let record_key = _getUID(key);
    Debug.recordTime(record_key, database_type);
    let data = await database.getItem(key);
    Debug.recordTimeEnd(record_key, database_type);
    if (data !== null) {
        printer.logLevel(`Found item (${database_type}):`, key, Debug.VERBOSE);
        Storage.setIndexedSessionData(key, data, {database});
    }
    return data;
};

Storage.saveData = function (key, value, {database = Storage.danboorustorage} = {}) {
    if (USE_STORAGE) {
        Storage.setIndexedSessionData(key, value, {database});
        return database.setItem(key, value);
    }
};

Storage.removeData = function (key, {broadcast = true, database = Storage.danboorustorage} = {}) {
    if (USE_STORAGE) {
        Storage.removeIndexedSessionData(key, {database});
        let session_key = _getSessionKey(key, database);
        if (broadcast) {
            CHANNEL.postMessage({type: 'remove_session_data', from: JSPLib.UID.value, keys: [session_key]});
        }
        return database.removeItem(key);
    }
};

// Batch Indexed DB

Storage.batchRetrieveData = async function (keylist, {database = Storage.danboorustorage} = {}) {
    var found_session, found_database;
    const printer = Debug.getFunctionPrint('Storage.batchRetrieveData');
    printer.logLevel("Querying", keylist.length, "items:", keylist, Debug.VERBOSE);
    let database_type = USE_INDEXED_DB ? "IndexDB" : "LocalStorage";
    let session_items = {};
    let missing_keys = [];
    keylist.forEach((key) => {
        let data = Storage.getIndexedSessionData(key, {default_val: null, database});
        if (data) {
            session_items[key] = data;
        } else {
            missing_keys.push(key);
        }
    });
    Debug.execute(() => {
        found_session = Object.keys(session_items);
        if (found_session.length) {
            printer.log("Found", found_session.length, "items (Session):", found_session);
        }
    }, Debug.VERBOSE);
    if (missing_keys.length === 0) {
        return session_items;
    }
    let record_key = _getUID(keylist);
    Debug.recordTime(record_key, database_type);
    let database_items = await database.getItems(missing_keys);
    Debug.recordTimeEnd(record_key, database_type);
    Debug.execute(() => {
        found_database = Object.keys(database_items);
        if (found_database.length) {
            printer.log(`Found ${found_database.length} items (${database_type}):`, found_database);
        }
    }, Debug.VERBOSE);
    Debug.execute(() => {
        var missing_list = Utility.arrayDifference(keylist, Utility.concat(found_session, Object.keys(database_items)));
        if (missing_list.length) {
            printer.log("Missing", missing_list.length, "items:", missing_list);
        }
    }, Debug.VERBOSE);
    for (let key in database_items) {
        Storage.setIndexedSessionData(key, database_items[key], {database});
    }
    return Utility.assignObjects(session_items, database_items);
};

Storage.batchSaveData = function (data_items, {database = Storage.danboorustorage} = {}) {
    for (let key in data_items) {
        Storage.setIndexedSessionData(key, data_items[key], {database});
    }
    return database.setItems(data_items);
};

Storage.batchRemoveData = function (keylist, {database = Storage.danboorustorage} = {}) {
    keylist.forEach((key) => {
        Storage.removeIndexedSessionData(key, {database});
    });
    let session_keylist = keylist.map((key) => _getSessionKey(key, database));
    CHANNEL.postMessage({type: 'remove_session_data', from: JSPLib.UID.value, keys: session_keylist});
    return database.removeItems(keylist);
};

// Validate

Storage.checkStorageData = function (key, store, {validator = Storage.localSessionValidator, default_val = null, bypass = false} = {}) {
    const printer = Debug.getFunctionPrint('Storage.checkStorageData');
    let storage_type = _getStorageType(store);
    printer.logLevel("Checking storage", key, Debug.ALL);
    if (!bypass && key in MEMORY_STORAGE[storage_type]) {
        printer.logLevel("Memory hit", key, Debug.VERBOSE);
        return MEMORY_STORAGE[storage_type][key];
    }
    if (!(key in store)) {
        printer.logLevel("Storage miss", key, Debug.VERBOSE);
        return default_val;
    }
    let data = Storage.getStorageData(key, store, {bypass});
    if (validator?.(key, data)) {
        printer.logLevel("Data validated", key, Debug.ALL);
        return data;
    }
    printer.logLevel("Data corrupted", key, Debug.DEBUG);
    return default_val;
};

Storage.checkLocalData = function (key, {validator = Storage.localSessionValidator, default_val = null, bypass = false} = {}) {
    return Storage.checkStorageData(key, localStorage, {validator, default_val, bypass});
};

Storage.checkSessionData = function (key, {validator = Storage.localSessionValidator, default_val = null, bypass = false} = {}) {
    return Storage.checkStorageData(key, sessionStorage, {validator, default_val, bypass});
};

Storage.checkIndexedSessionData = function (key, {validator = Storage.localSessionValidator, default_val = null, bypass = false, database = Storage.danboorustorage} = {}) {
    let session_key = _getSessionKey(key, database);
    return Storage.checkSessionData(session_key, {validator, default_val, bypass});
};

Storage.checkLocalDB = async function (key, {validator = Storage.indexedDBValidator, default_val = null, max_expires = null, database = Storage.danboorustorage} = {}) {
    const printer = Debug.getFunctionPrint('Storage.checkLocalDB');
    if (USE_STORAGE) {
        var cached = await Storage.retrieveData(key, {bypass_cache: false, database});
        if (cached === null) {
            printer.logLevel("Missing key", key, Debug.DEBUG);
            return default_val;
        }
        printer.logLevel("Checking DB", key, Debug.VERBOSE);
        if (validator?.(key, cached) && !Storage.hasDataExpired(key, cached, max_expires)) {
            printer.logLevel("DB Hit", key, Debug.VERBOSE);
            return cached;
        }
        printer.logLevel("DB Miss", key, Debug.DEBUG);
    }
    return default_val;
};

Storage.batchCheckLocalDB = async function (keylist, {validator = Storage.indexedDBValidator, expiration = null, database = Storage.danboorustorage} = {}) {
    const printer = Debug.getFunctionPrint('Storage.batchCheckLocalDB');
    var cached = await Storage.batchRetrieveData(keylist, {database});
    for (let key in cached) {
        let max_expires = null;
        if (Utility.isInteger(expiration)) {
            max_expires = expiration;
        } else if (typeof expiration === 'function') {
            max_expires = expiration(key, cached[key]);
        }
        printer.logLevel("Checking DB", key, Debug.VERBOSE);
        if (!validator?.(key, cached[key]) || Storage.hasDataExpired(key, cached[key], max_expires)) {
            printer.logLevel("DB Miss", key, Debug.DEBUG);
            delete cached[key];
        } else {
            printer.logLevel("DB Hit", key, Debug.VERBOSE);
        }
    }
    return cached;
};

// Prune/purge

Storage.pruneCache = async function (regex, {database = Storage.danboorustorage} = {}) {
    const printer = Debug.getFunctionPrint('Storage.pruneCache');
    if (!database.removeItems) {
        return;
    }
    let pruned_keys = [];
    await database.iterate((value, key) => {
        if (key.match(regex)) {
            if (Storage.hasDataExpired(key, value)) {
                printer.logLevel("Deleting", key, Debug.DEBUG);
                pruned_keys.push(key);
            }
        }
    });
    Debug.execute(async () => {
        let all_keys = await database.keys();
        let program_keys = all_keys.filter((key) => key.match(regex));
        printer.log(`Pruning ${pruned_keys.length}/${program_keys.length} items!`);
    }, Debug.INFO);
    await Storage.batchRemoveData(pruned_keys, {database});
};

Storage.purgeCache = async function (regex, {database = Storage.danboorustorage} = {}) {
    const printer = Debug.getFunctionPrint('Storage.purgeCache');
    Notice.notice("Starting cache deletion...");
    let all_keys = await database.keys();
    let purge_keys = all_keys.filter((key) => key.match(regex));
    Notice.notice(`Deleting ${purge_keys.length} items...`);
    printer.logLevel(`Deleting ${purge_keys.length} items...`, Debug.INFO);
    await Storage.batchRemoveData(purge_keys, {database});
    //Wait at least 5 seconds
    await Utility.sleep(5000);
    Notice.notice("Finished deleting cached data!");
    printer.logLevel("Finished deleting cached data!", Debug.INFO);
    CHANNEL.postMessage({type: 'remove_session_data', from: JSPLib.UID.value, keys: purge_keys});
};

// Program

Storage.programCacheInfo = async function (data_regex, {database = Storage.danboorustorage} = {}) {
    let cache_info = Utility.assignObjects(...['index', 'session', 'local'].map((name) => ({[name]: {total_items: 0, total_size: 0, program_items: 0, program_size: 0}})));
    var session_regex;
    var index_wait;
    if (typeof data_regex === 'object' && data_regex !== null && 'exec' in data_regex) {
        let database_re = '^' + _getDatabaseKey(database) + '-' + (data_regex.source[0] === '^' ? data_regex.source.slice(1) : data_regex.source);
        session_regex = RegExp(`(${database_re})|(${JSPLib.regex.source})`);
        index_wait = database.iterate((value, key) => {
            if (value === undefined) return;
            _addItemCacheInfo(cache_info.index, key, JSON.stringify(value), data_regex);
        });
    } else {
        session_regex = JSPLib.regex;
        index_wait = Promise.resolve(null);
    }
    Object.keys(sessionStorage).forEach((key) => {
        _addItemCacheInfo(cache_info.session, key, sessionStorage[key], session_regex);
    });
    Object.keys(localStorage).forEach((key) => {
        _addItemCacheInfo(cache_info.local, key, localStorage[key], JSPLib.regex);
    });
    await index_wait;
    return cache_info;
};

Storage.pruneProgramCache = function ({prune_expires = Utility.one_day, database = Storage.danboorustorage} = {}) {
    const printer = Debug.getFunctionPrint('Storage.pruneProgramCache');
    let expire_name = JSPLib.shortcut + '-prune-expires';
    if (!Concurrency.checkTimeout(expire_name, prune_expires)) {
        printer.logLevel("No prune of entries.", Debug.DEBUG);
        return;
    }
    if (!Concurrency.reserveSemaphore('prune')) {
        printer.logLevel("Pruning detected in another script/tab.", Debug.WARNING);
        return;
    }
    Debug.time("pruneModuleEntries");
    printer.logLevel("Pruning entries...", Debug.INFO);
    let promise_resp = Storage.pruneCache(JSPLib.data_regex, {database}).then(() => {
        printer.logLevel("Pruning complete!", Debug.INFO);
        Debug.timeEnd("pruneModuleEntries");
        Concurrency.freeSemaphore('prune');
    });
    //Have up to a 10% swing so that all scripts don't prune at the same time
    let adjusted_prune_expires = prune_expires + (-Math.random() * prune_expires / 10);
    Concurrency.setRecheckTimeout(expire_name, adjusted_prune_expires, localStorage);
    return promise_resp;
};

//Helper functions

Storage.hasDataExpired = function (key, storeditem, max_expires) {
    const printer = Debug.getFunctionPrint('Storage.hasDataExpired');
    if (typeof storeditem !== "object" || storeditem == null || (!('expires' in storeditem))) {
        printer.logLevel(key, "has no expires!", Debug.INFO);
        return true;
    }
    if (storeditem.expires !== 0 && !Utility.validateExpires(storeditem.expires, max_expires)) {
        printer.logLevel(key, "has expired!", Debug.VERBOSE);
        return true;
    }
    return false;
};

Storage.inMemoryStorage = function (key, store, database = null) {
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
    Debug.execute(() => {
        if (typeof input === 'string' || typeof input === 'number' || input === null) {
            UID = input;
        } else if (Utility.isArray(input)) {
            UID = input.join(',');
        } else if (typeof input === 'object') {
            UID = Object.keys(input).join(',');
        }
        UID += ';' + Utility.getUniqueID();
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
    const printer = Debug.getFunctionPrint('Menu.broadcastRX');
    return function (event) {
        if (!JSPLib._active_script || event.data.from === JSPLib.UID.value) return;
        printer.logLevel(`(${event.data.type}):`, event.data, Debug.INFO);
        if (event.data.type === 'remove_session_data') {
            event.data.keys.forEach((key) => {
                Storage.removeStorageData(key, sessionStorage);
            });
        }
    };
}

/****INITIALIZATION****/

JSPLib.writeOnceReadMany(Storage, 'localSessionValidator', () => true);
JSPLib.writeOnceReadMany(Storage, 'indexedDBValidator', () => true);

const CHANNEL = Utility.createBroadcastChannel('JSPLib.storage', _broadcastRX());

JSPLib.initializeModule('Storage', ['danboorustorage']);

})(JSPLib);
