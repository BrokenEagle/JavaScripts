// ==UserScript==
// @name         IndexedAutocomplete
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      8.1
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

//The number of retries before abandoning program load
const program_load_max_retries = 100;

//Polling interval for checking program status
const timer_poll_interval = 100;

//Interval for fixup callback functions
const callback_interval = 1000;

//Used for expiration time calculations
const milliseconds_per_day = 1000 * 60 * 60 * 24;

//DOM elements with autocomplete
const autocomplete_domlist = [
    "[data-autocomplete=tag-query]",
    "[data-autocomplete=tag-edit]",
    "[data-autocomplete=tag]",
    ".autocomplete-mentions textarea",
    "#search_title,#quick_search_title"
];

//Gets own instance in case forage is used in another script
var danboorustorage = localforage.createInstance({
    name: 'Danbooru storage',
    driver: [localforage.INDEXEDDB,
             localforage.LOCALSTORAGE]
    });

//Set state variables that indicate which database is being used
const use_indexed_db = danboorustorage.supports(danboorustorage.INDEXEDDB);
const use_local_storage = !use_indexed_db && danboorustorage.supports(danboorustorage.LOCALSTORAGE);

//Expiration variables

const expiration_config = {
    'tag' : {
        'logarithmic_start': 100,
        'minimum_days': 7,
        'maximum_days': 28
    },
    'pool' : {
        'logarithmic_start': 10,
        'minimum_days': 7,
        'maximum_days': 28
    },
    'user' : {
        'minimum_days': 28
    },
    'favgroup' : {
        'minimum_days': 7
    },
    'search' : {
        'minimum_days': 7
    },
    'relatedtag' : {
        'minimum_days': 7
    },
    'wikipage' : {
        'minimum_days': 7
    }
};

//Time functions

function MinimumExpirationTime(type) {
    return expiration_config[type].minimum_days * milliseconds_per_day;
}

//Logarithmic increase of expiration time based upon a count
function ExpirationTime(type,count) {
    let config = expiration_config[type];
    let expiration = Math.log10(10 * count/config.logarithmic_start) * config.minimum_days;
    expiration = Math.max(expiration,config.minimum_days);
    expiration = Math.min(expiration,config.maximum_days);
    return Math.round(expiration * milliseconds_per_day);
}

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

function checkDataModel(storeditem,key) {
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
    if ((key.search(RegExp('^rt(' + ShortNameRegexString() + ')?-')) < 0) && !$.isArray(storeditem.value)) {
        debuglog("Value is not an array!");
        return false;
    }
    //Temporary fix
    if ((key.search(/^us-/) >= 0) && !('name' in storeditem.value[0])) {
        debuglog("Incorrect user value!");
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
        if (!checkDataModel(cached,key) || hasDataExpired(cached)) {
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
            var expiration_time = (d.length ? ExpirationTime('tag',d[0].post_count) : MinimumExpirationTime('tag'));
            saveData(key, {"value": d, "expires": Date.now() + expiration_time});
            resp(d);
        }
    });
}

async function PoolSourceIndexed(term, resp, metatag) {
    var key = ("pl-" + term).toLowerCase();
    if (use_indexed_db || use_local_storage) {
        var cached = await retrieveData(key);
        debuglog("Checking",key);
        if (!checkDataModel(cached,key) || hasDataExpired(cached)) {
            danboorustorage.removeItem(key);
        } else {
            resp(cached.value);
            return;
        }
    }

    debuglog("Querying pools:",term);
    recordTime(key,"Network");
    $.ajax({
        url: "/pools.json",
        data: {
          "search[order]": "post_count",
          "search[name_matches]": term,
          "limit": 10
        },
        method: "get",
        success: function(data) {
            recordTimeEnd(key,"Network");
            var d = $.map(data, function(pool) {
                return {
                    type: "pool",
                    label: pool.name.replace(/_/g, " "),
                    value: metatag + ":" + pool.name,
                    post_count: pool.post_count,
                    category: pool.category
                };
            });
            var expiration_time = (d.length ? ExpirationTime('pool',d[0].post_count) : MinimumExpirationTime('pool'));
            saveData(key, {"value": d, "expires": Date.now() + expiration_time});
            resp(d);
        }
    });
}

async function UserSourceIndexed(term, resp, metatag) {
    var key = ("us-" + term).toLowerCase();
    if (use_indexed_db || use_local_storage) {
        var cached = await retrieveData(key);
        debuglog("Checking",key);
        if (!checkDataModel(cached,key) || hasDataExpired(cached)) {
            danboorustorage.removeItem(key);
        } else {
            $.each(cached.value, (i,val)=> {FixupUserMetatag(val,metatag);});
            resp(cached.value);
            return;
        }
    }

    debuglog("Querying users:",term);
    recordTime(key,"Network");
    $.ajax({
        url: "/users.json",
        data: {
            "search[order]": "post_upload_count",
            "search[current_user_first]": "true",
            "search[name_matches]": term + "*",
            "limit": 10
        },
        method: "get",
        success: function(data) {
            recordTimeEnd(key,"Network");
            var prefix;
            var display_name;

            var d = $.map(data, function(user) {
                return {
                    type: "user",
                    name: user.name,
                    level: user.level_string
                };
            });
            $.each(d, (i,val)=> {FixupUserMetatag(val,metatag);});
            saveData(key, {"value": d, "expires": Date.now() + MinimumExpirationTime('user')});
            resp(d);
        }
    });
}

function FixupUserMetatag(value,metatag) {
    if (metatag === "@") {
        value.value = "@" + value.name;
        value.label = value.name;
    } else {
        value.value = metatag + ":" + value.name;
        value.label = value.name.replace(/_/g, " ");
    }
}

async function FavoriteGroupSourceIndexed(term, resp, metatag) {
    var key = ("fg-" + term).toLowerCase();
    if (use_indexed_db || use_local_storage) {
        var cached = await retrieveData(key);
        debuglog("Checking",key);
        if (!checkDataModel(cached,key) || hasDataExpired(cached)) {
            danboorustorage.removeItem(key);
        } else {
            resp(cached.value);
            return;
        }
    }

    debuglog("Querying favgroups:",term);
    recordTime(key,"Network");
    $.ajax({
        url: "/favorite_groups.json",
        data: {
            "search[name_matches]": term,
            "limit": 10
        },
        method: "get",
        success: function(data) {
            recordTimeEnd(key,"Network");
            var d = $.map(data, function(favgroup) {
                return {
                    label: favgroup.name.replace(/_/g, " "),
                    value: metatag + ":" + favgroup.name,
                    post_count: favgroup.post_count
                };
            });
            saveData(key, {"value": d, "expires": Date.now() + MinimumExpirationTime('favgroup')});
            resp(d);
        }
    });
}

async function SavedSearchSourceIndexed(term, resp, metatag) {
    var key = ("ss-" + term).toLowerCase();
    if (use_indexed_db || use_local_storage) {
        var cached = await retrieveData(key);
        debuglog("Checking",key);
        if (!checkDataModel(cached,key) || hasDataExpired(cached)) {
            danboorustorage.removeItem(key);
        } else {
            resp(cached.value);
            return;
        }
    }

    debuglog("Querying savedsearch:",term);
    recordTime(key,"Network");
    $.ajax({
        url: "/saved_searches/labels.json",
        data: {
            "search[label]": term + "*",
            "limit": 10
        },
        method: "get",
        success: function(data) {
            recordTimeEnd(key,"Network");
            var d = $.map(data, function(label) {
                return {
                    label: label.replace(/_/g, " "),
                    value: "search:" + label,
                };
            });
            saveData(key, {"value": d, "expires": Date.now() + MinimumExpirationTime('search')});
            resp(d);
        }
    });
}

async function WikiPageIndexed(req, resp) {
    var key = ("wp-" + req.term).toLowerCase();
    if (use_indexed_db || use_local_storage) {
        var cached = await retrieveData(key);
        debuglog("Checking",key);
        if (!checkDataModel(cached,key) || hasDataExpired(cached)) {
            danboorustorage.removeItem(key);
        } else {
            resp(cached.value);
            return;
        }
    }

    debuglog("Querying wikipage:",req.term);
    recordTime(key,"Network");
    $.ajax({
        url: "/wiki_pages.json",
        data: {
            "search[title]": req.term + "*",
            "search[hide_deleted]": "Yes",
            "search[order]": "post_count",
            "limit": 10
        },
        method: "get",
        success: function(data) {
            recordTimeEnd(key,"Network");
            var d = $.map(data, function(wiki_page) {
                return {
                    label: wiki_page.title.replace(/_/g, " "),
                    value: wiki_page.title,
                    category: wiki_page.category_name
                };
            });
            saveData(key, {"value": d, "expires": Date.now() + MinimumExpirationTime('wikipage')});
            if (d.length) {
                setTimeout(()=>{FixExpirationCallback(key,d,d[0].value);},callback_interval);
            }
            resp(d);
        }
    });
}

function FixExpirationCallback(key,value,tagname) {
    debuglog("Fixing expiration:",tagname);
    recordTime(key + 'callback',"Network");
    $.ajax({
        url: "/tags.json",
        data: {
            "search[name]": tagname,
        },
        method: "get",
        success: function(data) {
            recordTimeEnd(key + 'callback',"Network");
            if (!data.length) {
                return
            }
            var expiration_time = ExpirationTime('tag',data[0].post_count);
            saveData(key, {"value": value, "expires": Date.now() + expiration_time});
        }
    });
}

//Non-autocomplete storage

function CommonBindIndexed(button_name, category) {
    $(button_name).click(async function(e) {
        var $dest = $("#related-tags");
        $dest.empty();
        Danbooru.RelatedTag.build_recent_and_frequent($dest);
        $dest.append("<em>Loading...</em>");
        $("#related-tags-container").show();
        var currenttag = $.trim(Danbooru.RelatedTag.current_tag());
        var keymodifier = (category.length ? GetShortName(category) : "");
        var key = ("rt" + keymodifier + "-" + currenttag).toLowerCase();
        var cached = await retrieveData(key);
        debuglog("Checking",key);
        if (!checkDataModel(cached,key) || hasDataExpired(cached)) {
            danboorustorage.removeItem(key);
            debuglog("Querying relatedtag:",currenttag,category);
            recordTime(key,"Network");
            var data = await $.get("/related_tag.json", {
                "query": currenttag,
                "category": category
            });
            recordTimeEnd(key,"Network");
            saveData(key, {"value": data, "expires": Date.now() + MinimumExpirationTime('relatedtag')});
            Danbooru.RelatedTag.process_response(data);
        } else {
            Danbooru.RelatedTag.process_response(cached.value);
        }
        $("#artist-tags-container").hide();
        e.preventDefault();
    });
}

//Rebind callback functions

function rebindRelatedTags() {
    //Only need to check one of them, since they're all bound at the same time
    let bounditems = $._data($("#related-tags-button")[0]);
    debuglog("Bound items:",Object.keys(bounditems));
    if (!$.isEmptyObject(bounditems) && bounditems.events.click.length) {
        clearInterval(rebindRelatedTags.timer);
        $("#related-tags-button").off();
        Danbooru.RelatedTag.common_bind("#related-tags-button", "");
        var related_buttons = JSON.parse(Danbooru.meta("related-tag-button-list"));
        $.each(related_buttons, function(i,category) {
            $(`#related-${category}-button`).off();
            Danbooru.RelatedTag.common_bind("#related-" + category + "-button", category);
        });
    }
}

function rebindWikiPageAutocomplete() {
    var $fields = $("#search_title,#quick_search_title");
    if ($fields.length && (('uiAutocomplete' in $.data($fields[0])) || $("#c-wiki-page-versions").length)) {
        clearInterval(rebindWikiPageAutocomplete.timer);
        $("#search_title,#quick_search_title").off().removeData();
        Danbooru.WikiPage.initialize_autocomplete();
    }
}

//Initialization functions

function WikiPageInitializeAutocompleteIndexed() {
    var $fields = $("#search_title,#quick_search_title");

    $fields.autocomplete({
        minLength: 1,
        delay: 100,
        source: WikiPageIndexed
    });

    var render_wiki_page = function(list, wiki_page) {
        var $link = $("<a/>").addClass("tag-type-" + wiki_page.category).text(wiki_page.label);
        return $("<li/>").data("item.autocomplete", wiki_page).append($link).appendTo(list);
    };

    $fields.each(function(i, field) {
        $(field).data("uiAutocomplete")._renderItem = render_wiki_page;
    });
}

//Name functions

function GetShortNames() {
    if (GetShortName.shortnames === undefined) {
        GetShortName.shortnames = JSON.parse(Danbooru.meta("short-tag-category-names"));
    }
    return GetShortName.shortnames;
}

function GetShortName(category) {
    let shortnames = GetShortNames();
    for (let i = 0;i < shortnames.length ; i++) {
        if (category.search(RegExp(shortnames[i])) === 0) {
            return shortnames[i];
        }
    }
}

function ShortNameRegexString() {
    return GetShortNames().join('|') ;
}

//Main program
function main() {
    Danbooru.Autocomplete.normal_source = NormalSourceIndexed;
    Danbooru.Autocomplete.pool_source = PoolSourceIndexed;
    Danbooru.Autocomplete.user_source = UserSourceIndexed;
    Danbooru.Autocomplete.favorite_group_source = FavoriteGroupSourceIndexed;
    Danbooru.Autocomplete.saved_search_source = SavedSearchSourceIndexed;
    if ($("#c-posts #a-show,#c-uploads #a-new").length) {
        Danbooru.RelatedTag.common_bind = CommonBindIndexed;
        rebindRelatedTags.timer = setInterval(rebindRelatedTags,timer_poll_interval);
    }
    if ($("#c-wiki-pages,#c-wiki-page-versions").length) {
        Danbooru.WikiPage.initialize_autocomplete = WikiPageInitializeAutocompleteIndexed;
        rebindWikiPageAutocomplete.timer = setInterval(rebindWikiPageAutocomplete,timer_poll_interval);
    }
    if (debug_console) {
        window.onbeforeunload = function () {
            outputAdjustedMean();
        };
    }
}

//Wait until program is ready before executing
function programLoad() {
    if (programLoad.retries >= program_load_max_retries) {
        debuglog("Abandoning program load!");
        clearInterval(programLoad.timer);
        return;
    }
    if (window.jQuery === undefined) {
        debuglog("jQuery not installed yet!");
        programLoad.retries += 1;
        return;
    }
    if (window.Danbooru === undefined) {
        debuglog("Danbooru not installed yet!");
        programLoad.retries += 1;
        return;
    }
    if (window.Danbooru.Autocomplete === undefined) {
        debuglog("Danbooru Autocomplete not installed yet!");
        programLoad.retries += 1;
        return;
    }
    clearInterval(programLoad.timer);
    if ($(autocomplete_domlist.join(',')).length) {
        use_indexed_db && main();
    }
    debugTimeEnd("IAC-programLoad");
}
programLoad.retries = 0;

//Execution start

debugTime("IAC-programLoad");
programLoad.timer = setInterval(programLoad,timer_poll_interval);
