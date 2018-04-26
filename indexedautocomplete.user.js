// ==UserScript==
// @name         IndexedAutocomplete
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      14
// @source       https://danbooru.donmai.us/users/23799
// @description  Uses indexed DB for autocomplete
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/indexedautocomplete.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.5.2/localforage.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.12.0/validate.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180421/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180421/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180421/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180421/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180421/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180421/lib/statistics.js
// ==/UserScript==

/***Global variables***/

//Variables for debug.js
JSPLib.debug.debug_console = true;

//Variables for load.js
const program_load_required_variables = ['window.jQuery','window.Danbooru','window.Danbooru.Autocomplete'];


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

const autocomplete_constraints = {
    entry: {
        expires : JSPLib.validate.expires_constraints,
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
        category: JSPLib.validate.inclusion_constraints([0,1,3,4,5]),
        label: JSPLib.validate.stringonly_constraints,
        post_count: JSPLib.validate.postcount_constraints,
        type: JSPLib.validate.inclusion_constraints(["tag"]),
        value: JSPLib.validate.stringonly_constraints
    },
    pool: {
        category: JSPLib.validate.inclusion_constraints(["collection","series"]),
        post_count: JSPLib.validate.postcount_constraints,
        type: JSPLib.validate.inclusion_constraints(["pool"]),
        name: JSPLib.validate.stringonly_constraints
    },
    user: {
        level: JSPLib.validate.inclusion_constraints(["Member","Gold","Platinum","Builder","Moderator","Admin"]),
        type: JSPLib.validate.inclusion_constraints(["user"]),
        name: JSPLib.validate.stringonly_constraints
    },
    favgroup: {
        post_count: JSPLib.validate.postcount_constraints,
        name: JSPLib.validate.stringonly_constraints
    },
    savedsearch: {
        name: JSPLib.validate.stringonly_constraints
    },
    artist: {
        label: JSPLib.validate.stringonly_constraints,
        value: JSPLib.validate.stringonly_constraints
    },
    wikipage: {
        label: JSPLib.validate.stringonly_constraints,
        value: JSPLib.validate.stringonly_constraints,
        category: JSPLib.validate.inclusion_constraints([0,1,3,4,5])
    }
};

const relatedtag_constraints = {
    entry: {
        expires : JSPLib.validate.expires_constraints,
        value : {
            presence: true
        }
    },
    value: {
        category: JSPLib.validate.inclusion_constraints(["","general","character","copyright","artist"]),
        query: JSPLib.validate.stringonly_constraints,
        tags: JSPLib.validate.tagentryarray_constraints,
        wiki_page_tags: JSPLib.validate.tagentryarray_constraints,
        other_wikis: {
            presence: true,
            array: true
        }
    },
    other_wikis: {
        title: JSPLib.validate.stringonly_constraints,
        wiki_page_tags: JSPLib.validate.tagentryarray_constraints
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

//Validation functions

function ValidateEntry(key,entry) {
    if (entry === null) {
        JSPLib.debug.debuglog(key,"entry not found!");
        return false;
    }
    if (key.match(/^(?:ac|pl|us|fg|ss|ar|wp)-/)) {
        return ValidateAutocompleteEntry(key,entry);
    } else if (key.match(/^rt(?:gen|char|copy|art)?-/)) {
        return ValidateRelatedtagEntry(key,entry);
    }
    JSPLib.debug.debuglog("Shouldn't get here");
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
            JSPLib.debug.debuglog("value["+i.toString()+"]");
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
            JSPLib.debug.debuglog("value["+i.toString()+"]");
            PrintValidateError(key,check);
            return false;
        }
    }
    return true;
}

/***Main helper functions***/

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
    JSPLib.debug.debuglog("Fixing expiration:",tagname);
    JSPLib.debug.recordTime(key + 'callback',"Network");
    $.ajax({
        url: "/tags.json",
        data: {
            "search[name]": tagname,
        },
        method: "get",
        success: function(data) {
            JSPLib.debug.recordTimeEnd(key + 'callback',"Network");
            if (!data.length) {
                return;
            }
            var expiration_time = ExpirationTime(type,data[0].post_count);
            JSPLib.storage.saveData(key, {"value": value, "expires": Date.now() + expiration_time});
        }
    });
}

/***Main execution functions***/

//Autocomplete functions

function NetworkSource(type,key,term,resp,metatag) {
    JSPLib.debug.debuglog("Querying",type,':',term);
    JSPLib.debug.recordTime(key,"Network");
    $.ajax({
        url: source_config[type].url,
        data: source_config[type].data(term),
        method: "get",
        success: function(data) {
            JSPLib.debug.recordTimeEnd(key,"Network");
            var d = $.map(data, source_config[type].map);
            var expiration_time = source_config[type].expiration(d);
            JSPLib.storage.saveData(key, {"value": JSPLib.utility.dataCopy(d), "expires": Date.now() + expiration_time});
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
    var cached = await JSPLib.storage.checkLocalDB(key,ValidateEntry);
    if (cached.value) {
        resp(cached.value);
        return;
    }
    NetworkSource('tag',key,term,resp,"");
}

async function PoolSourceIndexed(term, resp, metatag) {
    var key = ("pl-" + term).toLowerCase();
    var cached = await JSPLib.storage.checkLocalDB(key,ValidateEntry);
    if (cached.value) {
        $.each(cached.value, (i,val)=> {FixupMetatag(val,metatag);});
        resp(cached.value);
        return;
    }
    NetworkSource('pool',key,term,resp,metatag);
}

async function UserSourceIndexed(term, resp, metatag) {
    var key = ("us-" + term).toLowerCase();
    var cached = await JSPLib.storage.checkLocalDB(key,ValidateEntry);
    if (cached) {
        $.each(cached.value, (i,val)=> {FixupMetatag(val,metatag);});
        resp(cached.value);
        return;
    }
    NetworkSource('user',key,term,resp,metatag);
}

async function FavoriteGroupSourceIndexed(term, resp, metatag) {
    var key = ("fg-" + term).toLowerCase();
    var cached = await JSPLib.storage.checkLocalDB(key,ValidateEntry);
    if (cached) {
        $.each(cached.value, (i,val)=> {FixupMetatag(val,metatag);});
        resp(cached.value);
        return;
    }
    NetworkSource('favgroup',key,term,resp,metatag);
}

async function SavedSearchSourceIndexed(term, resp, metatag = "search") {
    var key = ("ss-" + term).toLowerCase();
    var cached = await JSPLib.storage.checkLocalDB(key,ValidateEntry);
    if (cached.value) {
        $.each(cached.value, (i,val)=> {FixupMetatag(val,metatag);});
        resp(cached.value);
        return;
    }
    NetworkSource('search',key,term,resp,metatag);
}

async function WikiPageIndexed(req, resp) {
    var key = ("wp-" + req.term).toLowerCase();
    var cached = await JSPLib.storage.checkLocalDB(key,ValidateEntry);
    if (cached) {
        resp(cached.value);
        return;
    }
    NetworkSource('wikipage',key,req.term,resp,"");
}

async function ArtistIndexed(req, resp) {
    var key = ("ar-" + req.term).toLowerCase();
    var cached = await JSPLib.storage.checkLocalDB(key,ValidateEntry);
    if (cached) {
        resp(cached.value);
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
        var cached = await JSPLib.storage.checkLocalDB(key,ValidateEntry);
        if (cached) {
            Danbooru.RelatedTag.process_response(cached.value);
        } else {
            JSPLib.debug.debuglog("Querying relatedtag:",currenttag,category);
            JSPLib.debug.recordTime(key,"Network");
            var data = await $.get("/related_tag.json", {
                "query": currenttag,
                "category": category
            });
            JSPLib.debug.recordTimeEnd(key,"Network");
            JSPLib.storage.saveData(key, {"value": data, "expires": Date.now() + MinimumExpirationTime('relatedtag')});
            Danbooru.RelatedTag.process_response(data);
        }
        $("#artist-tags-container").hide();
        e.preventDefault();
    });
}

function SaveSessionData(url,data) {
    let key = 'af-' + url;
    JSPLib.debug.debuglog("Saving",key);
    sessionStorage.setItem(key,JSON.stringify(data));
}

function CheckSource(domobj) {
    if (domobj.val()) {
        let key = 'af-' + domobj.val();
        JSPLib.debug.debuglog("Checking artist",key);
        let data = JSPLib.storage.getSessionData(key);
        if (data) {
            JSPLib.debug.debuglog("Found artist data",key);
            Danbooru.RelatedTag.process_artist(data);
            return true;
        }
        JSPLib.debug.debuglog("Missing artist data",key);
    }
    return false;
}

function FindArtistSession(e) {
    $("#artist-tags").html("<em>Loading...</em>");
    var url = $("#upload_source,#post_source");
    if (CheckSource(url)) {
        return;
    }
    var referer_url = $("#upload_referer_url");
    if ((url.val() !== referer_url.val()) && CheckSource(referer_url)) {
        return;
    }
    JSPLib.debug.debuglog("Checking network",url.val(),referer_url.val());
    $.get("/artists/finder.json", {"url": url.val(), "referer_url": referer_url.val()}).
        then((data)=>{
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
    JSPLib.debug.debuglog("Bound items (RT):",Object.keys(bounditems));
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
    JSPLib.debug.debuglog("Bound items (FA):",Object.keys(bounditems));
    if (!$.isEmptyObject(bounditems) && bounditems.events.click.length) {
        clearInterval(rebindFindArtist.timer);
        $("#find-artist-button").off();
        //$("#find-artist-button").click(Danbooru.RelatedTag.find_artist);
        $("#find-artist-button").click(FindArtistSession);
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
        SavedSearchInitializeAutocompleteIndexed("#saved_search_label_string");
    }
    if ($(autocomplete_userlist.join(',')).length) {
        UserInitializeAutocompleteIndexed(autocomplete_userlist.join(','));
    }
    if ($('[placeholder="Search users"]').length) {
        UserInitializeAutocompleteIndexed("#search_name_matches,#quick_search_name_matches");
    }
    if (JSPLib.debug.debug_console) {
        window.addEventListener('beforeunload',function () {
            JSPLib.statistics.outputAdjustedMean("IndexedAutocomplete");
        });
    }
}

/***Execution start***/

JSPLib.load.programInitialize(main,'IAC',program_load_required_variables);
