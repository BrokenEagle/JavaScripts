/****DEPENDENCIES****/

/**External dependencies**/
// localforage.js (optional)

/**Internal dependencies**/
// JSPLib.utility
// JSPLib.concurrency

/****SETUP****/

//Linter configuration
/* global JSPLib localforage */

JSPLib.storage = {};

/****GLOBAL VARIABLES****/

//Gets own instance in case forage is used in another script
JSPLib.storage.danboorustorage = window.localforage?.createInstance({
    name: 'Danbooru storage',
    driver: [
        localforage.INDEXEDDB,
        localforage.LOCALSTORAGE
    ]
});

//Set state variables that indicate which database is being used
JSPLib.storage.localforage_available = Boolean(JSPLib.storage.danboorustorage);
JSPLib.storage.use_indexed_db = JSPLib.storage.localforage_available && JSPLib.storage.danboorustorage.supports(JSPLib.storage.danboorustorage.INDEXEDDB);
JSPLib.storage.use_local_storage = JSPLib.storage.localforage_available && !JSPLib.storage.use_indexed_db && JSPLib.storage.danboorustorage.supports(JSPLib.storage.danboorustorage.LOCALSTORAGE);
JSPLib.storage.use_storage = JSPLib.storage.use_indexed_db || JSPLib.storage.use_local_storage;

JSPLib.storage.memory_storage = {sessionStorage: {}, localStorage: {}};

JSPLib.storage.localSessionValidator = null;
JSPLib.storage.indexedDBValidator = null;

/****FUNCTIONS****/

// localStorage/sessionStorage

//// General

JSPLib.storage.getStorageData = function (key, storage, {default_val = null} = {}) {
    let storage_type = this._getStorageType(storage);
    if (!(key in this.memory_storage[storage_type]) && key in storage) {
        let record_key = this._getUID(key);
        JSPLib.debug.recordTime(record_key, 'Storage');
        let data = storage.getItem(key);
        JSPLib.debug.recordTimeEnd(record_key, 'Storage');
        try {
            this.memory_storage[storage_type][key] = JSON.parse(data);
        } catch (e) {
            //swallow exception
        }
    }
    if (this.memory_storage[storage_type][key] === undefined){
        this.memory_storage[storage_type][key] = default_val;
    }
    return JSPLib.utility.dataCopy(this.memory_storage[storage_type][key]);
};

JSPLib.storage.setStorageData = function (self, key, data, storage) {
    let storage_type = this._getStorageType(storage);
    this.memory_storage[storage_type][key] = JSPLib.utility.dataCopy(data);
    try {
        storage.setItem(key, JSON.stringify(data));
    } catch (e) {
        self.debug('errorLevel', "Error saving data!", e, JSPLib.debug.ERROR);
        if (storage === sessionStorage) {
            sessionStorage.clear();
        }
    }
};

JSPLib.storage.removeStorageData = function (key, storage) {
    this.invalidateStorageData(key, storage);
    storage.removeItem(key);
};

JSPLib.storage.invalidateStorageData = function (key, storage) {
    let storage_type = this._getStorageType(storage);
    delete this.memory_storage[storage_type][key];
};

//// Local

JSPLib.storage.getLocalData = function (key, {default_val = null} = {}) {
    return this.getStorageData(key, localStorage, {default_val});
};

JSPLib.storage.setLocalData = function (key, data) {
    this.setStorageData(key, data, localStorage);
};

JSPLib.storage.removeLocalData = function (key) {
    this.removeStorageData(key, localStorage);
};

JSPLib.storage.invalidateLocalData = function (key) {
    this.invalidateStorageData(key, localStorage);
};

//// Session

JSPLib.storage.getSessionData = function (key, {default_val = null} = {}) {
    return this.getStorageData(key, sessionStorage, {default_val});
};

JSPLib.storage.setSessionData = function (key, data) {
    this.setStorageData(key, data, sessionStorage);
};

JSPLib.storage.removeSessionData = function (key) {
    this.removeStorageData(key, sessionStorage);
};

JSPLib.storage.invalidateSessionData = function (key) {
    this.invalidateStorageData(key, sessionStorage);
};

//// Indexed session

JSPLib.storage.getIndexedSessionData = function (key, {default_val = null, database = JSPLib.storage.danboorustorage} = {}) {
    let session_key = this._getSessionKey(key, database);
    return this.getSessionData(session_key, {default_val});
};

JSPLib.storage.setIndexedSessionData = function (key, data, {database = JSPLib.storage.danboorustorage} = {}) {
    let session_key = this._getSessionKey(key, database);
    this.setSessionData(session_key, data);
};

JSPLib.storage.removeIndexedSessionData = function (key, {database = JSPLib.storage.danboorustorage} = {}) {
    let session_key = this._getSessionKey(key, database);
    this.removeSessionData(session_key);
};

JSPLib.storage.invalidateIndexedSessionData = function (key, {database = JSPLib.storage.danboorustorage} = {}) {
    let session_key = this._getSessionKey(key, database);
    this.invalidateSessionData(session_key);
};

// Indexed DB

JSPLib.storage.retrieveData = async function (self, key, {bypass_cache = false, database = JSPLib.storage.danboorustorage} = {}) {
    if (!(this.use_storage)) {
        return null;
    }
    if (!bypass_cache) {
        let data = this.getIndexedSessionData(key, {default_val: null, database});
        if (data) {
            self.debug('logLevel', "Found item (Session):", key, JSPLib.debug.VERBOSE);
            return data;
        }
    }
    let database_type = this.use_indexed_db ? "IndexDB" : "LocalStorage";
    let record_key = this._getUID(key);
    JSPLib.debug.recordTime(record_key, database_type);
    let data = await database.getItem(key);
    JSPLib.debug.recordTimeEnd(record_key, database_type);
    if (data !== null) {
        self.debug('logLevel', `Found item (${database_type}):`, key, JSPLib.debug.VERBOSE);
        this.setIndexedSessionData(key, data, {database});
    }
    return data;
};

JSPLib.storage.saveData = function (key, value, {database = JSPLib.storage.danboorustorage} = {}) {
    if (this.use_storage) {
        this.setIndexedSessionData(key, value, {database});
        return database.setItem(key, value);
    }
};

JSPLib.storage.removeData = function (key, {broadcast = true, database = JSPLib.storage.danboorustorage} = {}) {
    if (this.use_storage) {
        this.removeIndexedSessionData(key, database);
        let session_key = this._getSessionKey(key, database);
        if (broadcast) {
            this._channel.postMessage({type: 'remove_session_data', from: JSPLib.UID.value, keys: [session_key]});
        }
        return database.removeItem(key);
    }
};

// Batch Indexed DB

JSPLib.storage.batchRetrieveData = async function (self, keylist, {database = JSPLib.storage.danboorustorage} = {}) {
    var found_session, found_database;
    self.debug('logLevel', "Querying", keylist.length, "items:", keylist, JSPLib.debug.VERBOSE);
    let database_type = this.use_indexed_db ? "IndexDB" : "LocalStorage";
    let session_items = {};
    let missing_keys = [];
    keylist.forEach((key) => {
        let data = this.getIndexedSessionData(key, {default_val: null, database});
        if (data) {
            session_items[key] = data;
        } else {
            missing_keys.push(key);
        }
    });
    JSPLib.debug.debugExecute(() => {
        found_session = Object.keys(session_items);
        if (found_session.length) {
            self.debug('log', "Found", found_session.length, "items (Session):", found_session, JSPLib.debug.VERBOSE);
        }
    }, JSPLib.debug.VERBOSE);
    if (missing_keys.length === 0) {
        return session_items;
    }
    let record_key = this._getUID(keylist);
    JSPLib.debug.recordTime(record_key, database_type);
    let database_items = await database.getItems(missing_keys);
    JSPLib.debug.recordTimeEnd(record_key, database_type);
    JSPLib.debug.debugExecute(() => {
        found_database = Object.keys(database_items);
        if (found_database.length) {
            self.debug('log', `Found ${found_database.length} items (${database_type}):`, found_database);
        }
        var missing_list = JSPLib.utility.arrayDifference(keylist, JSPLib.utility.concat(found_session, found_database));
        if (missing_list.length) {
            self.debug('log', "Missing", missing_list.length, "items:", missing_list);
        }
    }, JSPLib.debug.VERBOSE);
    for (let key in database_items) {
        this.setIndexedSessionData(key, database_items[key], {database});
    }
    return Object.assign(session_items, database_items);
};

JSPLib.storage.batchSaveData = function (data_items, {database = JSPLib.storage.danboorustorage} = {}) {
    for (let key in data_items) {
        this.setIndexedSessionData(key, data_items[key], {database});
    }
    return database.setItems(data_items);
};

JSPLib.storage.batchRemoveData = function (keylist, {database = JSPLib.storage.danboorustorage} = {}) {
    keylist.forEach((key) => {
        this.removeIndexedSessionData(key, database);
    });
    let session_keylist = keylist.map((key) => this._getSessionKey(key, database));
    this._channel.postMessage({type: 'remove_session_data', from: JSPLib.UID.value, keys: session_keylist});
    return database.removeItems(keylist);
};

// Validate

JSPLib.storage.checkStorageData = function (self, key, storage, {validator = JSPLib.storage.localSessionValidator, default_val = null} = {}) {
    let storage_type = this._getStorageType(storage);
    self.debug('logLevel', "Checking storage", key, JSPLib.debug.VERBOSE);
    if (key in this.memory_storage[storage_type]) {
        self.debug('logLevel', "Memory hit", key, JSPLib.debug.DEBUG);
        return this.memory_storage[storage_type][key];
    }
    if (!(key in storage)) {
        self.debug('logLevel', "Storage miss", key, JSPLib.debug.DEBUG);
        return default_val;
    }
    let data = this.getStorageData(key, storage);
    if (validator?.(key, data)) {
        self.debug('logLevel', "Data validated", key, JSPLib.debug.VERBOSE);
        return data;
    }
    self.debug('logLevel', "Data corrupted", key, JSPLib.debug.DEBUG);
    return default_val;
};

JSPLib.storage.checkLocalData = function (key, {validator = JSPLib.storage.localSessionValidator, default_val = null} = {}) {
    return this.checkStorageData(key, localStorage, {validator, default_val});
};

JSPLib.storage.checkSessionData = function (key, {validator = JSPLib.storage.localSessionValidator, default_val = null} = {}) {
    return this.checkStorageData(key, sessionStorage, {validator, default_val});
};

JSPLib.storage.checkLocalDB = async function (self, key, max_expires, {validator = JSPLib.storage.indexedDBValidator, database = JSPLib.storage.danboorustorage} = {}) {
    if (this.use_storage) {
        var cached = await this.retrieveData(key, false, database);
        if (cached === null) {
            self.debug('logLevel', "Missing key", key, JSPLib.debug.DEBUG);
            return cached;
        }
        self.debug('logLevel', "Checking DB", key, JSPLib.debug.VERBOSE);
        if (validator?.(key, cached) && !this.hasDataExpired(key, cached, max_expires)) {
            self.debug('logLevel', "DB Hit", key, JSPLib.debug.VERBOSE);
            return cached;
        }
        self.debug('logLevel', "DB Miss", key, JSPLib.debug.DEBUG);
    }
    return null;
};

JSPLib.storage.batchCheckLocalDB = async function (self, keylist, expiration, {validator = JSPLib.storage.indexedDBValidator, database = JSPLib.storage.danboorustorage} = {}) {
    var cached = await this.batchRetrieveData(keylist, database);
    for (let key in cached) {
        let max_expires = 0;
        if (Number.isInteger(expiration)) {
            max_expires = expiration;
        } else if (typeof expiration === 'function') {
            max_expires = expiration(key, cached[key]);
        }
        self.debug('logLevel', "Checking DB", key, JSPLib.debug.VERBOSE);
        if (!validator?.(key, cached[key]) || this.hasDataExpired(key, cached[key], max_expires)) {
            self.debug('logLevel', "DB Miss", key, JSPLib.debug.DEBUG);
            delete cached[key];
        } else {
            self.debug('logLevel', "DB Hit", key, JSPLib.debug.VERBOSE);
        }
    }
    return cached;
};

// Prune/purge

JSPLib.storage.pruneCache = async function (self, regex, {database = JSPLib.storage.danboorustorage} = {}) {
    if (!database.removeItems) {
        return;
    }
    let pruned_keys = [];
    await database.iterate((value, key) => {
        if (key.match(regex)) {
            if (this.hasDataExpired(key, value)) {
                self.debug('logLevel', "Deleting", key, JSPLib.debug.DEBUG);
                pruned_keys.push(key);
            }
        }
    });
    JSPLib.debug.debugExecute(async () => {
        let all_keys = await database.keys();
        let program_keys = all_keys.filter((key) => key.match(regex));
        self.debug('logLevel', `Pruning ${pruned_keys.length}/${program_keys.length} items!`, JSPLib.debug.INFO);
    });
    await this.batchRemoveData(pruned_keys, database);
};

JSPLib.storage.purgeCache = async function (self, regex, {database = JSPLib.storage.danboorustorage} = {}) {
    JSPLib.notice.notice("Starting cache deletion...");
    let all_keys = await database.keys();
    let purge_keys = all_keys.filter((key) => key.match(regex));
    JSPLib.notice.notice(`Deleting ${purge_keys.length} items...`);
    self.debug('logLevel', `Deleting ${purge_keys.length} items...`, JSPLib.debug.INFO);
    await this.batchRemoveData(purge_keys, {database});
    //Wait at least 5 seconds
    await JSPLib.utility.sleep(5000);
    JSPLib.notice.notice("Finished deleting cached data!");
    self.debug('logLevel', "Finished deleting cached data!", JSPLib.debug.INFO);
    this._channel.postMessage({type: 'remove_session_data', from: JSPLib.UID.value, keys: purge_keys});
};

// Program

JSPLib.storage.programCacheInfo = async function (program_shortcut, data_regex, {database = JSPLib.storage.danboorustorage} = {}) {
    let cache_info = Object.assign({}, ...['index', 'session', 'local'].map((name) => ({[name]: {total_items: 0, total_size: 0, program_items: 0, program_size: 0}})));
    let program_regex = RegExp(`^${program_shortcut}-`);
    var session_regex;
    var index_wait;
    if (typeof data_regex === 'object' && data_regex !== null && 'exec' in data_regex) {
        let database_re = '^' + this._getDatabaseKey(database) + '-' + (data_regex.source[0] === '^' ? data_regex.source.slice(1) : data_regex.source);
        session_regex = RegExp(`(${database_re})|(${program_regex.source})`);
        index_wait = database.iterate((value, key) => {
            if (value === undefined) return;
            this._addItemCacheInfo(cache_info.index, key, JSON.stringify(value), data_regex);
        });
    } else {
        session_regex = program_regex;
        index_wait = Promise.resolve(null);
    }
    Object.keys(sessionStorage).forEach((key) => {
        this._addItemCacheInfo(cache_info.session, key, sessionStorage[key], session_regex);
    });
    Object.keys(localStorage).forEach((key) => {
        this._addItemCacheInfo(cache_info.local, key, localStorage[key], program_regex);
    });
    await index_wait;
    return cache_info;
};

JSPLib.storage.pruneProgramCache = function (self, programname, regex, prune_expires, {database = JSPLib.storage.danboorustorage} = {}) {
    let expire_name = programname + '-prune-expires';
    if (!JSPLib.concurrency.checkTimeout(expire_name, prune_expires)) {
        self.debug('logLevel', "No prune of entries.", JSPLib.debug.DEBUG);
        return;
    }
    if (!JSPLib.concurrency.reserveSemaphore('jsplib-storage', 'prune')) {
        self.debug('logLevel', "Pruning detected in another script/tab.", JSPLib.debug.WARNING);
        return;
    }
    JSPLib.debug.debugTime("pruneModuleEntries");
    self.debug('logLevel', "Pruning entries...", JSPLib.debug.INFO);
    let promise_resp = this.pruneCache(regex, database).then(() => {
        self.debug('logLevel', "Pruning complete!", JSPLib.debug.INFO);
        JSPLib.debug.debugTimeEnd("pruneModuleEntries");
        JSPLib.concurrency.freeSemaphore('jsplib-storage', 'prune');
    });
    //Have up to a 10% swing so that all scripts don't prune at the same time
    let adjusted_prune_expires = prune_expires + (-Math.random() * prune_expires / 10);
    JSPLib.concurrency.setRecheckTimeout(expire_name, adjusted_prune_expires, localStorage);
    return promise_resp;
};

//Helper functions

JSPLib.storage.hasDataExpired = function (self, key, storeditem, max_expires) {
    if (typeof storeditem !== "object" || storeditem == null || (!('expires' in storeditem))) {
        self.debug('logLevel', key, "has no expires!", JSPLib.debug.INFO);
        return true;
    }
    if (storeditem.expires !== 0 && !JSPLib.utility.validateExpires(storeditem.expires, max_expires)) {
        self.debug('logLevel', key, "has expired!", JSPLib.debug.VERBOSE);
        return true;
    }
    return false;
};

/****PRIVATE DATA****/

//Variables

JSPLib.storage._channel = new BroadcastChannel('JSPLib.storage');

//Functions

JSPLib.storage._getDatabaseKey = function (database) {
    database._jsplib_key = database._jsplib_key || database._config.name.toLowerCase().replace(" ", '-');
    return database._jsplib_key;
};

JSPLib.storage._getSessionKey = function (datakey, database) {
    return this._getDatabaseKey(database) + '-' + datakey;
};

JSPLib.storage._getUID = function (input = null) {
    let UID = "";
    JSPLib.debug.debugExecute(() => {
        if (typeof input === 'string' || typeof input === 'number' || input === null) {
            UID = input;
        } else if (Array.isArray(input)) {
            UID = input.join(',');
        } else if (typeof input === 'object') {
            UID = Object.keys(input).join(',');
        }
        UID += ';' + JSPLib.utility.getUniqueID();
    });
    return UID;
};

JSPLib.storage._adjustCounter = function (counter_domname, count) {
    if (counter_domname && document.querySelector(counter_domname)) {
        document.querySelector(counter_domname).innerText = count;
    }
};

JSPLib.storage._addItemCacheInfo = function (entry, key, value, regex) {
    let current_size = value.length;
    entry.total_items++;
    entry.total_size += current_size;
    if (key.match(regex)) {
        entry.program_items++;
        entry.program_size += current_size;
    }
};

JSPLib.storage._getStorageType = function (storage) {
    if (storage === localStorage) return 'localStorage';
    if (storage === sessionStorage) return 'sessionStorage';
    return 'unknownStorage';
};

JSPLib.storage._broadcastRX = function () {
    let context = this;
    let iteration = 1;
    return function (event) {
        if (JSPLib._active_script && event.data.from !== JSPLib.UID.value) {
            JSPLib.debug.debuglogLevel(`storage._broadcastRX[${iteration++}]`, `(${event.data.type}):`, event.data, JSPLib.debug.INFO);
            if (event.data.type === 'remove_session_data') {
                event.data.keys.forEach((key) => {
                    context.removeStorageData(key, sessionStorage);
                });
            }
        }
    };
};

/****INITIALIZATION****/
JSPLib.storage._channel.onmessage = JSPLib.storage._broadcastRX();
JSPLib.storage._configuration = {
    nonenumerable: [],
    nonwritable: ['_channel', 'danboorustorage', 'use_indexed_db', 'use_local_storage', 'use_storage']
};
JSPLib.initializeModule('storage');
JSPLib.debug.addModuleLogs('storage', ['setStorageData', 'retrieveData', 'checkStorageData', 'hasDataExpired', 'checkLocalDB', 'pruneCache', 'pruneProgramCache', 'purgeCache', 'batchRetrieveData', 'batchCheckLocalDB', '_broadcastRX']);
