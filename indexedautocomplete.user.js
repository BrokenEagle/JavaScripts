// ==UserScript==
// @name         IndexedAutocomplete
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      2
// @source       https://danbooru.donmai.us/users/23799
// @description  Uses indexed DB for autocomplete
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/indexedautocomplete.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.5.2/localforage.min.js
// ==/UserScript==

//Set to true to switch the debug info on
const debug_console = true;

//Polling interval for checking program status
const timer_poll_interval = 100;

//Expiration time for autocomplete
const milliseconds_per_day = 1000 * 60 * 60 * 24;
const autocomplete_expiration_days = 7;
const autocomplete_expiration_time =  milliseconds_per_day * autocomplete_expiration_days;

//Gets own instance in case forage is used in another script
var danboorustorage = localforage.createInstance({
    name: 'Danbooru storage',
    driver: [localforage.INDEXEDDB,
             localforage.LOCALSTORAGE]
    });

//Set state variables that indicate which database is being used
const use_indexed_db = danboorustorage.supports(danboorustorage.INDEXEDDB);
const use_local_storage = !use_indexed_db && danboorustorage.supports(danboorustorage.LOCALSTORAGE);

//Debug output functions

function debuglog(args) {
    if (debug_console) {
        console.log.apply(this,arguments);
    }
}

function debugTime(str) {
    if (debug_console) {
        console.time(str);
    }
}

function debugTimeEnd(str) {
    if (debug_console) {
        console.timeEnd(str);
    }
}

//Data recording functions

function recordTime(entryname,type) {
    if (debug_console) {
        let index = entryname + ',' + type;
        recordTime.records[index] = {
            entryname: entryname,
            type: type,
            starttime: performance.now(),
            endtime: 0};
    }
}
recordTime.records = {};

function recordTimeEnd(entryname,type) {
    if (debug_console) {
        let index = entryname + ',' + type;
        if (!(index in recordTime.records)) {
            return;
        }
        if (recordTime.records[index].endtime === 0) {
            recordTime.records[index].endtime = performance.now();
        }
    }
}

//Statistics functions

function outputAdjustedMean() {
    let outputtime = {};
    $.each(recordTime.records,(i,val)=>{
        if (!(val.type in outputtime)) {
            outputtime[val.type] = [];
        }
        outputtime[val.type].push(val.endtime-val.starttime);
    });
    $.each(outputtime,(type,values)=>{
        let adjvalues = removeOutliers(values);
        debuglog(type + ':',"num",values.length,"avg",Math.round(100*average(adjvalues))/100,"rem",values.length-adjvalues.length);
    });
}

function removeOutliers(values) {
    do {
        var length = values.length;
        let avg = average(values);
        let stddev = standardDeviation(values);
        let adjvalues = values.filter(val=>{return (Math.abs(val-avg) < (2 * stddev));});
        var newlength = adjvalues.length;
        if (newlength === 0) {
            return values;
        }
        values = adjvalues;
    } while (length != newlength);
    return values;
}

function standardDeviation(values) {
    var avg = average(values);
    return Math.sqrt(average(values.map(value=>{let diff = value - avg; return diff * diff;})));
}

function average(values) {
    return values.reduce(function(a, b) { return a + b; })/values.length;
}

//Data interface functions

async function retrieveData(key) {
    if (!(use_indexed_db || use_local_storage)) {
        return null;
    }
    let database = use_indexed_db ? "IndexDB" : "LocalStorage";
    if (key in sessionStorage) {
        debuglog("Found item (Session):",key);
        recordTime(key,'Session');
        let data = sessionStorage.getItem(key);
        recordTimeEnd(key,'Session');
        try {
            return JSON.parse(data);
        } catch (e) {
            //Swallow exception
        }
    }
    recordTime(key,database);
    let value = await danboorustorage.getItem(key);
    recordTimeEnd(key,database);
    if (value !== null) {
        debuglog(`Found item (${database}):`,key);
        sessionStorage[key] = JSON.stringify(value);
    }
    return value;
}

function saveData(key,value) {
    danboorustorage.setItem(key,value);
    sessionStorage.setItem(key,JSON.stringify(value));
}

function hasDataExpired(storeditem) {
    if (Date.now() > storeditem.expires) {
        debuglog("Data has expired!");
        return true;
    }
    return false;
}

function checkDataModel(storeditem) {
    if (storeditem === null) {
        debuglog("Item not found!");
        return false;
    }
    if (!('value' in storeditem) || !('expires' in storeditem)) {
        debuglog("Missing data properties!");
        return false;
    }
    if (typeof(storeditem.expires) !== "number") {
        debuglog("Expires is not a number!");
        return false;
    }
    if (!$.isArray(storeditem.value)) {
        debuglog("Value is not an array!");
        return false;
    }
    return true;
}

//Main execution functions

//Function to rebind Autocomplete normal source function
async function NormalSourceIndexed(term, resp) {
    var key = ("ac-" + term).toLowerCase();
    if (use_indexed_db || use_local_storage) {
        var cached = await retrieveData(key);
        debuglog("Checking",key);
        if (!checkDataModel(cached) || hasDataExpired(cached)) {
            danboorustorage.removeItem(key);
        } else {
            resp(cached.value);
            return;
        }
    }

    debuglog("Querying tags:",term);
    recordTime(key,"Network");
    $.ajax({
        url: "/tags/autocomplete.json",
        data: {
            "search[name_matches]": term + "*"
        },
        method: "get",
        success: function(data) {
            recordTimeEnd(key,"Network");
            var d = $.map(data, function(tag) {
                return {
                    type: "tag",
                    label: tag.name.replace(/_/g, " "),
                    antecedent: tag.antecedent_name,
                    value: tag.name,
                    category: tag.category,
                    post_count: tag.post_count
                };
            });
            saveData(key, {"value": d, "expires": Date.now() + autocomplete_expiration_time});
            resp(d);
        }
    });
}

//Main program
function main() {
    Danbooru.Autocomplete.normal_source = NormalSourceIndexed;
    if (debug_console) {
        window.onbeforeunload = function () {
            outputAdjustedMean();
        };
    }
}

//Wait until program is ready before executing
function programLoad() {
    if (typeof window.jQuery === undefined) {
        debuglog("jQuery not installed yet!");
        return;
    }
    if (typeof window.Danbooru === undefined) {
        debuglog("Danbooru not installed yet!");
        return;
    }
    if (typeof window.Danbooru.Autocomplete === undefined) {
        debuglog("Danbooru Autocomplete not installed yet!");
        return;
    }
    clearInterval(programLoad.timer);
    if ($("[data-autocomplete=tag-query],[data-autocomplete=tag-edit],[data-autocomplete=tag]").length) {
        use_indexed_db && main();
    }
    debugTimeEnd("IAC-programLoad");
}

//Execution start

debugTime("IAC-programLoad");
programLoad.timer = setInterval(programLoad,timer_poll_interval);
