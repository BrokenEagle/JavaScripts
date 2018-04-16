/****SETUP****/

//Has debug.js been loaded?
if (debuglog === undefined) {
    var debuglog = ()=>{};
    var recordTime = ()=>{};
    var recordTimeEnd = ()=>{};
}

/****GLOBAL VARIABLES****/

//Gets own instance in case forage is used in another script
var danboorustorage = localforage.createInstance({
    name: 'Danbooru storage',
    driver: [localforage.INDEXEDDB,
             localforage.LOCALSTORAGE]
});

//Set state variables that indicate which database is being used
const use_indexed_db = danboorustorage.supports(danboorustorage.INDEXEDDB);
const use_local_storage = !use_indexed_db && danboorustorage.supports(danboorustorage.LOCALSTORAGE);

/****FUNCTIONS****/

//Data interface functions

function getSessionData(key) {
    if (key in sessionStorage) {
        recordTime(key,'Session');
        let data = sessionStorage.getItem(key);
        recordTimeEnd(key,'Session');
        try {
            return JSON.parse(data);
        } catch (e) {
            //Swallow exception
        }
    }
}

async function retrieveData(key) {
    if (!(use_indexed_db || use_local_storage)) {
        return null;
    }
    let database = use_indexed_db ? "IndexDB" : "LocalStorage";
    let data = getSessionData(key);
    if (data) {
        debuglog("Found item (Session):",key);
        return data;
    }
    recordTime(key,database);
    data = await danboorustorage.getItem(key);
    recordTimeEnd(key,database);
    if (data !== null) {
        debuglog(`Found item (${database}):`,key);
        sessionStorage.setItem(key,JSON.stringify(data));
    }
    return data;
}

function saveData(key,value) {
    danboorustorage.setItem(key,value);
    sessionStorage.setItem(key,JSON.stringify(value));
}

//Input expects the attribute expires, so data should be vaidated first
function hasDataExpired(storeditem) {
    if (Date.now() > storeditem.expires) {
        debuglog("Data has expired!");
        return true;
    }
    return false;
}

//The validator returns true for valid data, false for invalid data
async function checkLocalDB(key,validator) {
    if (use_indexed_db || use_local_storage) {
        var cached = await retrieveData(key);
        debuglog("Checking",key);
        if (!validator(key,cached) || hasDataExpired(cached)) {
            debuglog("DB Miss",key);
            danboorustorage.removeItem(key);
        } else {
            debuglog("DB Hit",key);
            return cached;
        }
    }
}
