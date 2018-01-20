// ==UserScript==
// @name         IndexedAutocomplete
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      13
// @source       https://danbooru.donmai.us/users/23799
// @description  Uses indexed DB for autocomplete
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/indexedautocomplete.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.5.2/localforage.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.12.0/validate.min.js
// ==/UserScript==

/***Global variables***/

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

const autocomplete_userlist = [
    "#search_to_name",
    "#search_from_name",
    "#dmail_to_name",
    "#search_user_name",
    "#search_banner_name",
    "#search_creator_name",
    "#search_approver_name",
    "#search_updater_name"
];
//DOM elements with autocomplete
const autocomplete_domlist = [
    "[data-autocomplete=tag-query]",
    "[data-autocomplete=tag-edit]",
    "[data-autocomplete=tag]",
    ".autocomplete-mentions textarea",
    "#search_title,#quick_search_title",
    "#search_name,#quick_search_name",
    "#search_name_matches,#quick_search_name_matches",
    "#add-to-pool-dialog input[type=text]"
    ].concat(autocomplete_userlist);

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
        'logarithmic_start': 100,
        'minimum_days': 7,
        'maximum_days': 28
    },
    'artist' : {
        'logarithmic_start': 10,
        'minimum_days': 7,
        'maximum_days': 28
    }
};

//Validation variables

const postcount_constraints = {
    presence: true,
    numericality: {
        noStrings: true,
        onlyInteger: true,
        greaterThan: 0,
    }
};

const expires_constraints = {
    presence: true,
    numericality: {
        onlyInteger: true,
        greaterThan: 0,
    }
};

const stringonly_constraints = {
    string: true
};

const tagentryarray_constraints = {
    presence: true,
    tagentryarray: true
};

function inclusion_constraints(array) {
    return { presence: true, inclusion: array };
}

const autocomplete_constraints = {
    entry: {
        expires : expires_constraints,
        value: {
            presence: true,
            array: {
                length: {
                    maximum : 10,
                    tooLong : "array is too long (maximum is %{count} items"
                }
            }
        }
    },
    tag: {
        antecedent: {
            string: {
                allowNull: true
            }
        },
        category: inclusion_constraints([0,1,3,4,5]),
        label: stringonly_constraints,
        post_count: postcount_constraints,
        type: inclusion_constraints(["tag"]),
        value: stringonly_constraints
    },
    pool: {
        category: inclusion_constraints(["collection","series"]),
        post_count: postcount_constraints,
        type: inclusion_constraints(["pool"]),
        name: stringonly_constraints
    },
    user: {
        level: inclusion_constraints(["Member","Gold","Platinum","Builder","Moderator","Admin"]),
        type: inclusion_constraints(["user"]),
        name: stringonly_constraints
    },
    favgroup: {
        post_count: postcount_constraints,
        name: stringonly_constraints
    },
    savedsearch: {
        name: stringonly_constraints
    },
    artist: {
        label: stringonly_constraints,
        value: stringonly_constraints
    },
    wikipage: {
        label: stringonly_constraints,
        value: stringonly_constraints,
        category: inclusion_constraints([0,1,3,4,5])
    }
};

const relatedtag_constraints = {
    entry: {
        expires : expires_constraints,
        value : {
            presence: true
        }
    },
    value: {
        category: inclusion_constraints(["","general","character","copyright","artist"]),
        query: stringonly_constraints,
        tags: tagentryarray_constraints,
        wiki_page_tags: tagentryarray_constraints,
        other_wikis: {
            presence: true,
            array: true
        }
    },
    other_wikis: {
        title: stringonly_constraints,
        wiki_page_tags: tagentryarray_constraints
    }
};

//Source variables

const source_key = {
    ac: 'tag',
    pl: 'pool',
    us: 'user',
    fg: 'favgroup',
    ss: 'savedsearch',
    ar: 'artist',
    wp: 'wikipage'
};

const source_config = {
    tag: {
        url: "/tags/autocomplete.json",
        data: function(term) {
            return {
                "search[name_matches]": term + "*"
            };
        },
        map: function(tag) {
            return {
                type: "tag",
                label: tag.name.replace(/_/g, " "),
                antecedent: tag.antecedent_name || null,
                value: tag.name,
                category: tag.category,
                post_count: tag.post_count
            };
        },
        expiration: function(d) {
            return (d.length ? ExpirationTime('tag',d[0].post_count) : MinimumExpirationTime('tag'));
        },
        fixupmetatag: false,
        fixupexpiration: false
    },
    pool: {
        url: "/pools.json",
        data: function(term) {
            return {
                "search[order]": "post_count",
                "search[name_matches]": term,
                "limit": 10
            };
        },
        map: function(pool) {
            return {
                type: "pool",
                name: pool.name,
                post_count: pool.post_count,
                category: pool.category
            };
        },
        expiration: function(d) {
            return (d.length ? ExpirationTime('pool',d[0].post_count) : MinimumExpirationTime('pool'));
        },
        fixupmetatag: true,
        fixupexpiration: false,
        render: function(list, pool) {
            var $link = $("<a/>").addClass("pool-category-" + pool.category).text(pool.label);
            return $("<li/>").data("item.autocomplete", pool).append($link).appendTo(list);
        }
    },
    user: {
        url: "/users.json",
        data: function(term) {
            return {
                "search[order]": "post_upload_count",
                "search[current_user_first]": "true",
                "search[name_matches]": term + "*",
                "limit": 10
            };
        },
        map: function(user) {
            return {
                type: "user",
                name: user.name,
                level: user.level_string
            };
        },
        expiration: function(d) {
            return MinimumExpirationTime('user');
        },
        fixupmetatag: true,
        fixupexpiration: false,
        render: function(list, user) {
            var $link = $("<a/>").addClass("user-" + user.level.toLowerCase()).addClass("with-style").text(user.label);
            return $("<li/>").data("item.autocomplete", user).append($link).appendTo(list);
        }
    },
    favgroup: {
        url: "/favorite_groups.json",
        data: function(term) {
            return {
                "search[name_matches]": term,
                "limit": 10
            };
        },
        map: function(favgroup) {
            return {
                name: favgroup.name,
                post_count: favgroup.post_count
            };
        },
        expiration: function(d) {
            return MinimumExpirationTime('favgroup');
        },
        fixupmetatag: true,
        fixupexpiration: false
    },
    search: {
        url: "/saved_searches/labels.json",
        data: function(term) {
            return {
                "search[label]": term + "*",
                "limit": 10
            };
        },
        map: function(label) {
            return {
                name: label
            };
        },
        expiration: function(d) {
            return MinimumExpirationTime('search');
        },
        fixupmetatag: true,
        fixupexpiration: false
    },
    wikipage: {
        url: "/wiki_pages.json",
        data: function(term) {
            return {
                "search[title]": term + "*",
                "search[hide_deleted]": "Yes",
                "search[order]": "post_count",
                "limit": 10
            };
        },
        map: function(wikipage) {
            return {
                label: wikipage.title.replace(/_/g, " "),
                value: wikipage.title,
                category: wikipage.category_name
            };
        },
        expiration: function(d) {
            return MinimumExpirationTime('wikipage');
        },
        fixupmetatag: false,
        fixupexpiration: true,
        render: function(list, wiki_page) {
            var $link = $("<a/>").addClass("tag-type-" + wiki_page.category).text(wiki_page.label);
            return $("<li/>").data("item.autocomplete", wiki_page).append($link).appendTo(list);
        }
    },
    artist: {
        url: "/artists.json",
        data: function(term) {
            return {
                "search[name]": term + "*",
                "search[is_active]": true,
                "search[order]": "post_count",
                "limit": 10
            };
        },
        map: function(artist) {
            return {
                label: artist.name.replace(/_/g, " "),
                value: artist.name
            };
        },
        expiration: function(d) {
            return MinimumExpirationTime('artist');
        },
        fixupmetatag: false,
        fixupexpiration: true,
        render: function(list, artist) {
            var $link = $("<a/>").addClass("tag-type-1").text(artist.label);
            return $("<li/>").data("item.autocomplete", artist).append($link).appendTo(list);
        }
    }
};

/***Misc functions***/

//Name functions

function GetShortName(category) {
    let shortnames = ['art','char','copy','gen','meta'];
    for (let i = 0;i < shortnames.length ; i++) {
        if (category.search(RegExp(shortnames[i])) === 0) {
            return shortnames[i];
        }
    }
}

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

function DataCopy(olddata) {
    let newdata = [];
    $.each(olddata, (i,data)=>{
        newdata.push(jQuery.extend(true, {}, data));
    });
    return newdata;
}

//Validation functions

validate.validators.array = function(value, options, key, attributes) {
    if (options !== false) {
        if (!validate.isArray(value)) {
            return "is not an array";
        }
        if (options !== true && 'length' in options) {
            let checkerror = validate({val:value},{val:{length: options.length}});
            if (checkerror !== undefined) {
                return JSON.stringify(checkerror,null,2);
            }
        }
    }
};

validate.validators.tagentryarray = function(value, options, key, attributes) {
    if (options !== false) {
        if (!validate.isArray(value)) {
            return "is not an array";
        }
        for (let i=0;i < value.length;i++) {
            if (value[i].length !== 2) {
                return "must have 2 entries in tag entry ["+i.toString()+"]";
            }
            if (!validate.isString(value[i][0])) {
                return "must be a string ["+i.toString()+"][0]";
            }
            if ([0,1,3,4,5].indexOf(value[i][1]) < 0) {
                return "must be a valid tag category ["+i.toString()+"][1]";
            }
        }
    }
};

validate.validators.string = function(value, options, key, attributes) {
    if (options !== false) {
        var message = "";
        //Can't use presence validator so must catch it here
        if (value === undefined) {
            return "can't be missing";
        }
        if (validate.isString(value)) {
            return;
        }
        message += "is not a string";
        if (validate.isHash(options) && 'allowNull' in options && options.allowNull === true) {
            if (value === null) {
                return;
            }
            message += " or null";
        }
        return message;
    }
};

function PrintValidateError(key,checkerror) {
    debuglog(key,':\r\n',JSON.stringify(checkerror,null,2));
}

function ValidateEntry(key,entry) {
    if (entry === null) {
        debuglog(key,"entry not found!");
        return false;
    }
    if (key.match(/^(?:ac|pl|us|fg|ss|ar|wp)-/)) {
        return ValidateAutocompleteEntry(key,entry);
    } else if (key.match(/^rt(?:gen|char|copy|art)?-/)) {
        return ValidateRelatedtagEntry(key,entry);
    }
    debuglog("Shouldn't get here");
    return false;
}

function ValidateAutocompleteEntry(key,entry) {
    check = validate(entry,autocomplete_constraints.entry);
    if (check !== undefined) {
        PrintValidateError(key,check);
        return false;
    }
    for (let i=0;i < entry.value.length; i++) {
        let type = source_key[key.slice(0,2)];
        check = validate(entry.value[i],autocomplete_constraints[type]);
        if (check !== undefined) {
            debuglog("value["+i.toString()+"]");
            PrintValidateError(key,check);
            return false;
        }
    }
    return true;
}

function ValidateRelatedtagEntry(key,entry) {
    check = validate(entry,relatedtag_constraints.entry);
    if (check !== undefined) {
        PrintValidateError(key,check);
        return false;
    }
    check = validate(entry.value,relatedtag_constraints.value);
    if (check !== undefined) {
        PrintValidateError(key,check);
        return false;
    }
    for (let i = 0;i < entry.value.other_wikis.length; i++) {
        check = validate(entry.value.other_wikis[i],relatedtag_constraints.other_wikis);
        if (check !== undefined) {
            debuglog("value["+i.toString()+"]");
            PrintValidateError(key,check);
            return false;
        }
    }
    return true;
}

/***Main helper functions***/

async function CheckLocalDB(key) {
    if (use_indexed_db || use_local_storage) {
        var cached = await retrieveData(key);
        debuglog("Checking",key);
        if (!ValidateEntry(key,cached) || hasDataExpired(cached)) {
            danboorustorage.removeItem(key);
        } else {
            return cached.value;
        }
    }
}

function FixupMetatag(value,metatag) {
    switch(metatag) {
        case "@":
            value.value = "@" + value.name;
            value.label = value.name;
            break;
        case "":
            value.value = value.name;
            value.label = value.name.replace(/_/g, " ");
            break;
        default:
            value.value = metatag + ":" + value.name;
            value.label = value.name.replace(/_/g, " ");
    }
}

function FixExpirationCallback(key,value,tagname,type) {
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
                return;
            }
            var expiration_time = ExpirationTime(type,data[0].post_count);
            saveData(key, {"value": value, "expires": Date.now() + expiration_time});
        }
    });
}

/***Main execution functions***/

//Autocomplete functions

function NetworkSource(type,key,term,resp,metatag) {
    debuglog("Querying",type,':',term);
    recordTime(key,"Network");
    $.ajax({
        url: source_config[type].url,
        data: source_config[type].data(term),
        method: "get",
        success: function(data) {
            recordTimeEnd(key,"Network");
            var d = $.map(data, source_config[type].map);
            var expiration_time = source_config[type].expiration(d);
            saveData(key, {"value": DataCopy(d), "expires": Date.now() + expiration_time});
            if (source_config[type].fixupmetatag) {
                $.each(d, (i,val)=> {FixupMetatag(val,metatag);});
            }
            if (source_config[type].fixupexpiration && d.length) {
                setTimeout(()=>{FixExpirationCallback(key,d,d[0].value,type);},callback_interval);
            }
            resp(d);
        }
    });
}

async function NormalSourceIndexed(term, resp) {
    var key = ("ac-" + term).toLowerCase();
    var value = await CheckLocalDB(key);
    if (value) {
        resp(value);
        return;
    }
    NetworkSource('tag',key,term,resp,"");
}

async function PoolSourceIndexed(term, resp, metatag) {
    var key = ("pl-" + term).toLowerCase();
    var value = await CheckLocalDB(key);
    if (value) {
        $.each(value, (i,val)=> {FixupMetatag(val,metatag);});
        resp(value);
        return;
    }
    NetworkSource('pool',key,term,resp,metatag);
}

async function UserSourceIndexed(term, resp, metatag) {
    var key = ("us-" + term).toLowerCase();
    var value = await CheckLocalDB(key);
    if (value) {
        $.each(value, (i,val)=> {FixupMetatag(val,metatag);});
        resp(value);
        return;
    }
    NetworkSource('user',key,term,resp,metatag);
}

async function FavoriteGroupSourceIndexed(term, resp, metatag) {
    var key = ("fg-" + term).toLowerCase();
    var value = await CheckLocalDB(key);
    if (value) {
        $.each(value, (i,val)=> {FixupMetatag(val,metatag);});
        resp(value);
        return;
    }
    NetworkSource('favgroup',key,term,resp,metatag);
}

async function SavedSearchSourceIndexed(term, resp, metatag = "search") {
    var key = ("ss-" + term).toLowerCase();
    var value = await CheckLocalDB(key);
    if (value) {
        $.each(value, (i,val)=> {FixupMetatag(val,metatag);});
        resp(value);
        return;
    }
    NetworkSource('search',key,term,resp,metatag);
}

async function WikiPageIndexed(req, resp) {
    var key = ("wp-" + req.term).toLowerCase();
    var value = await CheckLocalDB(key);
    if (value) {
        resp(value);
        return;
    }
    NetworkSource('wikipage',key,req.term,resp,"");
}

async function ArtistIndexed(req, resp) {
    var key = ("ar-" + req.term).toLowerCase();
    var value = await CheckLocalDB(key);
    if (value) {
        resp(value);
        return;
    }
    NetworkSource('artist',key,req.term,resp,"");
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
        if (!ValidateEntry(key,cached) || hasDataExpired(cached)) {
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

function GetSessionData(url) {
    let key = 'af-' + url;
    if (key in sessionStorage) {
        try {
            debuglog("Found data",key);
            return JSON.parse(sessionStorage.getItem(key));
        } catch(e) {
            debuglog("Data error",key);
            return;
        }
    }
    debuglog("Data not found",key);
}

function SaveSessionData(url,data) {
    let key = 'af-' + url;
    debuglog("Saving",key);
    sessionStorage.setItem(key,JSON.stringify(data));
}

function CheckSource(domobj) {
    if (domobj.val()) {
        let data = GetSessionData(domobj.val());
        if (data) {
            Danbooru.RelatedTag.process_artist(data);
            return true
        }
    }
    return false
}

async function FindArtistSession(e) {
    $("#artist-tags").html("<em>Loading...</em>");
    var url = $("#upload_source,#post_source");
    if (CheckSource(url)) {
        return;
    }
    var referer_url = $("#upload_referer_url");
    if ((url.val() !== referer_url.val()) && CheckSource(referer_url)) {
        return;
    }
    debuglog("Checking network",url.val(),referer_url.val());
    $.get("/artists/finder.json", {"url": url.val(), "referer_url": referer_url.val()}).
        success((data)=>{
            Danbooru.RelatedTag.process_artist(data);
            if (url.val()) {
                SaveSessionData(url.val(),data);
            }
            if ((url.val() !== referer_url.val()) && referer_url.val()) {
                SaveSessionData(referer_url.val(),data);
            }
        });
    e.preventDefault();
}

/***Setup functions***/

//Rebind callback functions

function rebindRelatedTags() {
    //Only need to check one of them, since they're all bound at the same time
    let bounditems = $._data($("#related-tags-button")[0]);
    debuglog("Bound items (RT):",Object.keys(bounditems));
    if (!$.isEmptyObject(bounditems) && bounditems.events.click.length) {
        clearInterval(rebindRelatedTags.timer);
        $("#related-tags-button").off();
        Danbooru.RelatedTag.common_bind("#related-tags-button", "");
        var related_buttons = ['general','artist','character','copyright'];
        $.each(related_buttons, function(i,category) {
            $(`#related-${category}-button`).off();
            Danbooru.RelatedTag.common_bind("#related-" + category + "-button", category);
        });
    }
}

function rebindFindArtist() {
    //Only need to check one of them, since they're all bound at the same time
    let bounditems = $._data($("#find-artist-button")[0]);
    debuglog("Bound items (FA):",Object.keys(bounditems));
    if (!$.isEmptyObject(bounditems) && bounditems.events.click.length) {
        clearInterval(rebindFindArtist.timer);
        $("#find-artist-button").off();
        $("#find-artist-button").click(Danbooru.RelatedTag.find_artist);
    }
}

function rebindWikiPageAutocomplete() {
    var $fields = $("#search_title,#quick_search_title");
    if ($fields.length && ('uiAutocomplete' in $.data($fields[0]))) {
        clearInterval(rebindWikiPageAutocomplete.timer);
        $fields.off().removeData();
        Danbooru.WikiPage.initialize_autocomplete();
    }
}

function rebindArtistAutocomplete() {
    var $fields = $("#search_name,#quick_search_name");
    if ($fields.length && (('uiAutocomplete' in $.data($fields[0])) || $("#c-artist-versions").length) ) {
        clearInterval(rebindArtistAutocomplete.timer);
        $fields.off().removeData();
        Danbooru.Artist.initialize_autocomplete();
    }
}

function rebindPoolAutocomplete() {
    var $fields = $("#search_name_matches,#quick_search_name_matches");
    if ($fields.length && (('uiAutocomplete' in $.data($fields[0])) || $("#c-pool-versions").length)) {
        clearInterval(rebindPoolAutocomplete.timer);
        $fields.off().removeData();
        Danbooru.Pool.initialize_autocomplete_for("#search_name_matches,#quick_search_name_matches");
    }
}

function rebindPostPoolAutocomplete() {
    var $fields = $("#add-to-pool-dialog input[type=text]");
    if ($fields.length && ('uiAutocomplete' in $.data($fields[0]))) {
        clearInterval(rebindPostPoolAutocomplete.timer);
        $fields.off().removeData();
        Danbooru.Pool.initialize_autocomplete_for("#add-to-pool-dialog input[type=text]");
    }
}

function rebindSavedSearchAutocomplete() {
    var $fields = $("#saved_search_labels");
    if ($fields.length && ('uiAutocomplete' in $.data($fields[0]))) {
        clearInterval(rebindSavedSearchAutocomplete.timer);
        $fields.off().removeData();
        SavedSearchInitializeAutocompleteIndexed("#saved_search_labels");
    }
}

//Initialization functions

function InitializeAutocompleteIndexed(selector,sourcefunc,type) {
    var $fields = $(selector);
    $fields.autocomplete({
        minLength: 1,
        delay: 100,
        source: sourcefunc
    });
    if (source_config[type].render) {
        $fields.each(function(i, field) {
            $(field).data("uiAutocomplete")._renderItem = source_config[type].render;
        });
    }
}

function WikiPageInitializeAutocompleteIndexed() {
    InitializeAutocompleteIndexed("#search_title,#quick_search_title",WikiPageIndexed,'wikipage');
}

function ArtistInitializeAutocompleteIndexed() {
    InitializeAutocompleteIndexed("#search_name,#quick_search_name",ArtistIndexed,'artist');
}

function PoolInitializeAutocompleteIndexed(selector) {
    InitializeAutocompleteIndexed(selector,function (req, resp) { PoolSourceIndexed(req.term, resp, ""); },'pool');
}

function UserInitializeAutocompleteIndexed(selector) {
    InitializeAutocompleteIndexed(selector,function (req, resp) { UserSourceIndexed(req.term, resp, ""); },'user');
}

function SavedSearchInitializeAutocompleteIndexed(selector) {
    InitializeAutocompleteIndexed(selector,function (req, resp) { SavedSearchSourceIndexed(req.term, resp, ""); },'search');
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
        Danbooru.RelatedTag.find_artist = FindArtistSession;
        rebindRelatedTags.timer = setInterval(rebindRelatedTags,timer_poll_interval);
        rebindFindArtist.timer = setInterval(rebindFindArtist,timer_poll_interval);
    }
    if ($("#c-wiki-pages,#c-wiki-page-versions").length) {
        Danbooru.WikiPage.initialize_autocomplete = WikiPageInitializeAutocompleteIndexed;
        rebindWikiPageAutocomplete.timer = setInterval(rebindWikiPageAutocomplete,timer_poll_interval);
    }
    if ($("#c-artists,#c-artist-versions").length) {
        Danbooru.Artist.initialize_autocomplete = ArtistInitializeAutocompleteIndexed;
        rebindArtistAutocomplete.timer = setInterval(rebindArtistAutocomplete,timer_poll_interval);
    }
    if ($("#c-pools,#c-pool-versions").length) {
        Danbooru.Pool.initialize_autocomplete_for = PoolInitializeAutocompleteIndexed;
        rebindPoolAutocomplete.timer = setInterval(rebindPoolAutocomplete,timer_poll_interval);
    }
    if ($("#c-posts #a-show").length) {
        Danbooru.Pool.initialize_autocomplete_for = PoolInitializeAutocompleteIndexed;
        rebindPostPoolAutocomplete.timer = setInterval(rebindPostPoolAutocomplete,timer_poll_interval);
    }
    if ($("#c-posts #a-index").length) {
        rebindSavedSearchAutocomplete.timer = setInterval(rebindSavedSearchAutocomplete,timer_poll_interval);
    }
    if ($(autocomplete_userlist.join(',')).length) {
        UserInitializeAutocompleteIndexed(autocomplete_userlist.join(','));
    }
    if ($('[placeholder="Search users"]').length) {
        UserInitializeAutocompleteIndexed("#search_name_matches,#quick_search_name_matches");
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

/***Execution start***/

debugTime("IAC-programLoad");
programLoad.timer = setInterval(programLoad,timer_poll_interval);
