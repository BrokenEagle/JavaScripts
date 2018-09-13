// ==UserScript==
// @name         IndexedAutocomplete
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      18.4
// @source       https://danbooru.donmai.us/users/23799
// @description  Uses indexed DB for autocomplete
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/indexedautocomplete.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.5.2/localforage.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.12.0/validate.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180827/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180827/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180827/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180827/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180827/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180827/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180827/lib/danbooru.js
// ==/UserScript==

/***Global variables***/

//Variables for debug.js
JSPLib.debug.debug_console = false;
JSPLib.debug.pretext = "IAC:";
JSPLib.debug.pretimer = "IAC-";
JSPLib.debug.level = JSPLib.debug.INFO;

//Variables for load.js
const program_load_required_variables = ['window.jQuery','window.Danbooru','Danbooru.Autocomplete','Danbooru.RelatedTag'];

//Polling interval for checking program status
const timer_poll_interval = 100;

//Interval for fixup callback functions
const callback_interval = 1000;

//Main function expires
const prune_expires = JSPLib.utility.one_day;

//Regex that matches the prefix of all program cache data
const program_cache_regex = /^(?:ac|pl|us|fg|ss|ar|wp|ft|rt(?:gen|char|copy|art)?)-/;

//For factory reset
const localstorage_keys = [
    'iac-prune-expires',
    'iac-choice-order',
    'iac-choice-data'
];
const program_reset_keys = {
    choice_order:{},
    choice_data:{}
};

const autocomplete_userlist = [
    "#search_to_name",
    "#search_from_name",
    "#dmail_to_name",
    "#search_user_name",
    "#search_banner_name",
    "#search_creator_name",
    "#search_approver_name",
    "#search_updater_name",
    "#search_uploader_name",
    ".c-users #search_name_matches",
    ".c-users #quick_search_name_matches",
    ".c-user-upgrades #quick_search_name_matches",
    "#user_feedback_user_name"
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
    "#add-to-pool-dialog input[type=text]",
    "#quick_search_body_matches",
    "#search_topic_title_matches",
    "#saved_search_label_string"
    ].concat(autocomplete_userlist);

const forum_topic_search = `
<li>
    <form action="/forum_topics" accept-charset="UTF-8" method="get">
        <input name="utf8" type="hidden" value="✓">
        <input id="quick_search_title_matches" placeholder="Search topic" type="text" name="search[title_matches]" class="ui-autocomplete-input" data-autocomplete="forum-topic" autocomplete="off">
    </form>
</li>`;

const forum_css = `
.ui-menu-item .forum-topic-category-0 {
    color: blue;
}
.ui-menu-item .forum-topic-category-1 {
    color: green;
}
.ui-menu-item .forum-topic-category-2 {
    color: red;
}`;

const program_css = `
.iac-user-choice {
    font-weight: bold;
}
.iac-tag-alias {
    font-style: italic;
}
`;

//Expiration variables

const expiration_config = {
    tag: {
        logarithmic_start: 100,
        minimum: JSPLib.utility.one_week,
        maximum: JSPLib.utility.one_month
    },
    pool: {
        logarithmic_start: 10,
        minimum: JSPLib.utility.one_week,
        maximum: JSPLib.utility.one_month
    },
    user: {
        minimum: JSPLib.utility.one_month
    },
    favgroup: {
        minimum: JSPLib.utility.one_week
    },
    search: {
        minimum: JSPLib.utility.one_week
    },
    relatedtag: {
        minimum: JSPLib.utility.one_week
    },
    wikipage: {
        logarithmic_start: 100,
        minimum: JSPLib.utility.one_week,
        maximum: JSPLib.utility.one_month
    },
    artist: {
        logarithmic_start: 10,
        minimum: JSPLib.utility.one_week,
        maximum: JSPLib.utility.one_month
    },
    forumtopic: {
        minimum: JSPLib.utility.one_week
    },
};

//Validation variables

const autocomplete_constraints = {
    entry: {
        expires : JSPLib.validate.expires_constraints,
        value: {
            presence: true,
            array: true,
            length: {
                maximum : 10,
                minimum: 1,
                tooShort: "array is too short (minimum is %{count} items)",
                tooLong : "array is too long (maximum is %{count} items)"
            }
        }
    },
    tag: {
        antecedent: JSPLib.validate.stringnull_constraints,
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
        post_count: JSPLib.validate.counting_constraints,
        name: JSPLib.validate.stringonly_constraints
    },
    search: {
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
    },
    forumtopic: {
        value: JSPLib.validate.stringonly_constraints,
        category: JSPLib.validate.inclusion_constraints([0,1,2])
    }
};

const relatedtag_constraints = {
    entry: {
        expires : JSPLib.validate.expires_constraints,
        value : JSPLib.validate.hash_constraints
    },
    value: {
        category: JSPLib.validate.inclusion_constraints(["","general","character","copyright","artist"]),
        query: JSPLib.validate.stringonly_constraints,
        tags: JSPLib.validate.tagentryarray_constraints,
        wiki_page_tags: JSPLib.validate.tagentryarray_constraints,
        other_wikis: JSPLib.validate.array_constraints
    },
    other_wikis: {
        title: JSPLib.validate.stringonly_constraints,
        wiki_page_tags: JSPLib.validate.tagentryarray_constraints
    }
};

const usage_constraints = {
    expires: JSPLib.validate.expires_constraints,
    use_count: {
        numericality: {
            greaterThanOrEqualTo: 0
        }
    }
};

//Source variables

const source_key = {
    ac: 'tag',
    pl: 'pool',
    us: 'user',
    fg: 'favgroup',
    ss: 'search',
    ar: 'artist',
    wp: 'wikipage',
    ft: 'forumtopic'
};

const source_config = {
    tag1: {
        url: "tags/autocomplete",
        data: (term)=>{
            return {
                search: {
                    name_matches: term
                }
            };
        },
        map: (tag)=>{
            return {
                type: "tag",
                label: tag.name.replace(/_/g, " "),
                antecedent: tag.antecedent_name || null,
                value: tag.name,
                category: tag.category,
                post_count: tag.post_count
            };
        },
        expiration: (d)=>{
            return (d.length ? ExpirationTime('tag',d[0].post_count) : MinimumExpirationTime('tag'));
        },
        fixupmetatag: false,
        fixupexpiration: false,
        searchstart: true
    },
    tag2: {
        url: "tags",
        data: (term)=>{
            return {
                search: {
                    name_matches: term + "*",
                    hide_empty: true,
                    order: "count"
                },
                limit: 10
            };
        },
        map: (tag)=>{
            return {
                type: "tag",
                label: tag.name.replace(/_/g, " "),
                antecedent: null,
                value: tag.name,
                category: tag.category,
                post_count: tag.post_count
            };
        },
        expiration: (d)=>{
            return (d.length ? ExpirationTime('tag',d[0].post_count) : MinimumExpirationTime('tag'));
        },
        fixupmetatag: false,
        fixupexpiration: false,
        searchstart: true
    },
    pool: {
        url: "pools",
        data: (term)=>{
            return {
                search: {
                    order: "post_count",
                    name_matches: term
                },
                limit: 10
            };
        },
        map: (pool)=>{
            return {
                type: "pool",
                name: pool.name,
                post_count: pool.post_count,
                category: pool.category
            };
        },
        expiration: (d)=>{
            return (d.length ? ExpirationTime('pool',d[0].post_count) : MinimumExpirationTime('pool'));
        },
        fixupmetatag: true,
        fixupexpiration: false,
        searchstart: false,
        render: RenderListItem(($domobj,item)=>{return $domobj.addClass("pool-category-" + item.category).text(item.label);})
    },
    user: {
        url: "users",
        data: (term)=>{
            return {
                search: {
                    order: "post_upload_count",
                    current_user_first: true,
                    name_matches: term + "*"
                },
                limit: 10
            };
        },
        map: (user)=>{
            return {
                type: "user",
                name: user.name,
                level: user.level_string
            };
        },
        expiration: (d)=>{
            return MinimumExpirationTime('user');
        },
        fixupmetatag: true,
        fixupexpiration: false,
        searchstart: true,
        render: RenderListItem(($domobj,item)=>{return $domobj.addClass("user-" + item.level.toLowerCase()).addClass("with-style").text(item.label);})
    },
    favgroup: {
        url: "favorite_groups",
        data: (term)=>{
            return {
                search: {
                    name_matches: term
                },
                limit: 10
            };
        },
        map: (favgroup)=>{
            return {
                name: favgroup.name,
                post_count: favgroup.post_count
            };
        },
        expiration: (d)=>{
            return MinimumExpirationTime('favgroup');
        },
        fixupmetatag: true,
        fixupexpiration: false,
        searchstart: false
    },
    search: {
        url: "saved_searches/labels",
        data: (term)=>{
            return {
                search: {
                    label: term + "*"
                },
                limit: 10
            };
        },
        map: (label)=>{
            return {
                name: label
            };
        },
        expiration: (d)=>{
            return MinimumExpirationTime('search');
        },
        fixupmetatag: true,
        fixupexpiration: false,
        searchstart: true
    },
    wikipage: {
        url: "wiki_pages",
        data: (term)=>{
            return {
                search: {
                    order: "post_count",
                    hide_deleted: true,
                    title: term + "*"
                },
                limit: 10
            };
        },
        map: (wikipage)=>{
            return {
                label: wikipage.title.replace(/_/g, " "),
                value: wikipage.title,
                category: wikipage.category_name
            };
        },
        expiration: (d)=>{
            return MinimumExpirationTime('wikipage');
        },
        fixupmetatag: false,
        fixupexpiration: true,
        searchstart: true,
        render: RenderListItem(($domobj,item)=>{return $domobj.addClass("tag-type-" + item.category).text(item.label);})
    },
    artist: {
        url: "artists",
        data: (term)=>{
            return {
                search: {
                    order: "post_count",
                    is_active: true,
                    name: term + "*"
                },
                limit: 10
            };
        },
        map: (artist)=>{
            return {
                label: artist.name.replace(/_/g, " "),
                value: artist.name
            };
        },
        expiration: (d)=>{
            return MinimumExpirationTime('artist');
        },
        fixupmetatag: false,
        fixupexpiration: true,
        searchstart: true,
        render: RenderListItem(($domobj,item)=>{return $domobj.addClass("tag-type-1").text(item.label);})
    },
    forumtopic: {
        url: "forum_topics",
        data: (term)=>{
            return {
                search: {
                    order: "sticky",
                    title_matches: "*" + term + "*"
                },
                limit: 10
            };
        },
        map: (forumtopic)=>{
            return {
                value: forumtopic.title,
                category: forumtopic.category_id
            };
        },
        expiration: (d)=>{
            return MinimumExpirationTime('forumtopic');
        },
        fixupmetatag: false,
        fixupexpiration: false,
        searchstart: false,
        render: RenderListItem(($domobj,item)=>{return $domobj.addClass("forum-topic-category-" + item.category).text(item.value);})
    }
};

/***Misc functions***/

//Library functions

function RegexpEscape(string) {
  return string.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
}

function GetDOMDataKeys(selector) {
    return Object.keys($(selector).data());
}

function HasDOMDataKey(selector,key) {
    return GetDOMDataKeys(selector).includes(key);
}

function IsNamespaceBound(selector,eventtype,namespace) {
    let namespaces = GetBoundEventNames(selector,eventtype);
    return namespaces.includes(namespace);
}

function GetBoundEventNames(selector,eventtype) {
    let $obj = $(selector);
    if ($obj.length === 0) {
        return [];
    }
    let boundevents = $._data($obj[0], "events");
    if (!boundevents || !(eventtype in boundevents)) {
        return [];
    }
    return $.map(boundevents[eventtype],(entry)=>{return entry.namespace;});
}

function AddStyleSheet(url,title='') {
    AddStyleSheet.cssstyle = AddStyleSheet.cssstyle || {};
    if (title in AddStyleSheet.cssstyle) {
        AddStyleSheet.cssstyle[title].href = url;
    } else {
        AddStyleSheet.cssstyle[title] = document.createElement('link');
        AddStyleSheet.cssstyle[title].rel = 'stylesheet';
        AddStyleSheet.cssstyle[title].type = 'text/css';
        AddStyleSheet.cssstyle[title].href = url;
        document.head.appendChild(AddStyleSheet.cssstyle[title]);
    }
}

function InstallScript(url) {
    return $.ajax({
        url: url,
        dataType: "script",
        cache: true
    });
}

function KebabCase(string) {
    return string.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g,'-').toLowerCase();
}

function DisplayCase(string) {
    return JSPLib.utility.titleizeString(string.toLowerCase().replace(/[_]/g,' '));
}

//Time functions

function MinimumExpirationTime(type) {
    return expiration_config[type].minimum;
}

function MaximumExpirationTime(type) {
    return (expiration_config[type].maximum ? expiration_config[type].maximum : expiration_config[type].minimum);
}

//Logarithmic increase of expiration time based upon a count
function ExpirationTime(type,count) {
    let config = expiration_config[type];
    let expiration = Math.log10(10 * count/config.logarithmic_start) * config.minimum;
    expiration = Math.max(expiration, config.minimum);
    expiration = Math.min(expiration, config.maximum);
    return Math.round(expiration);
}

//Validation functions

function ValidateEntry(key,entry) {
    if (!JSPLib.validate.validateIsHash(key,entry)) {
        return false
    }
    if (key.match(/^(?:ac|pl|us|fg|ss|ar|wp|ft)-/)) {
        return ValidateAutocompleteEntry(key,entry);
    } else if (key.match(/^rt(?:gen|char|copy|art)?-/)) {
        return ValidateRelatedtagEntry(key,entry);
    }
    JSPLib.debug.debuglog("Shouldn't get here");
    return false;
}

function ValidateAutocompleteEntry(key,entry) {
    let check = validate(entry,autocomplete_constraints.entry);
    if (check !== undefined) {
        JSPLib.validate.printValidateError(key,check);
        return false;
    }
    let type = source_key[key.slice(0,2)];
    for (let i=0;i < entry.value.length; i++) {
        check = validate(entry.value[i],autocomplete_constraints[type]);
        if (check !== undefined) {
            JSPLib.debug.debuglog("value["+i.toString()+"]");
            JSPLib.validate.printValidateError(key,check);
            return false;
        }
    }
    return true;
}

function ValidateRelatedtagEntry(key,entry) {
    let check = validate(entry,relatedtag_constraints.entry);
    if (check !== undefined) {
        JSPLib.validate.printValidateError(key,check);
        return false;
    }
    check = validate(entry.value,relatedtag_constraints.value);
    if (check !== undefined) {
        JSPLib.validate.printValidateError(key,check);
        return false;
    }
    for (let i = 0;i < entry.value.other_wikis.length; i++) {
        check = validate(entry.value.other_wikis[i],relatedtag_constraints.other_wikis);
        if (check !== undefined) {
            JSPLib.debug.debuglog("value["+i.toString()+"]");
            JSPLib.validate.printValidateError(key,check);
            return false;
        }
    }
    return true;
}

//Scalpel validation... removes only data that is bad instead of tossing everything
function CorrectUsageData() {
    let choice_order = Danbooru.IAC.choice_order;
    let choice_data = Danbooru.IAC.choice_data;
    let old_choice_order = Danbooru.IAC.old_choice_order = JSPLib.utility.dataCopy(choice_order);
    let old_choice_data = Danbooru.IAC.old_choice_data = JSPLib.utility.dataCopy(choice_data);
    if (!validate.isHash(choice_order) || !validate.isHash(choice_data)) {
        JSPLib.debug.debuglog("Usage data is corrupted beyond repair!",choice_order,!validate.isHash(choice_data));
        Danbooru.IAC.choice_order = {};
        Danbooru.IAC.choice_data = {};
        StoreUsageData('reset');
        return;
    }
    //Validate choice order
    for (let type in choice_order) {
        if (!validate.isArray(choice_order[type])) {
            JSPLib.debug.debuglog(`choice_order[${type}] is not an array`)
            delete choice_order[type];
            continue;
        }
        for (let i = 0; i < choice_order[type].length; i++) {
            if (!validate.isString(choice_order[type][i])) {
                JSPLib.debug.debuglog(`choice_order[${type}][${i}] is not a string`)
                choice_order[type].splice(i,1);
                i--;
            }
        }
    }
    //Validate choice data
    for (let type in choice_data) {
        if (!validate.isHash(choice_data[type])) {
            JSPLib.debug.debuglog(`choice_data[${type}] is not a hash`)
            delete choice_data[type];
            continue;
        }
        for (let key in choice_data[type]) {
            let validator = Object.assign({},autocomplete_constraints[type],usage_constraints);
            let check = validate(choice_data[type][key],validator);
            if (check !== undefined) {
                JSPLib.debug.debuglog(`choice_data[${type}][${key}]`);
                JSPLib.validate.printValidateError(key,check);
                delete choice_data[type][key];
            }
        }
    }
    //Validate same types between both
    let type_diff = JSPLib.utility.setSymmetricDifference(Object.keys(choice_order),Object.keys(choice_data));
    if (type_diff.length) {
        JSPLib.debug.debuglog("Type difference!",type_diff);
        $.each(type_diff,(i,type)=>{
            delete choice_order[type];
            delete choice_data[type];
        });
    }
    //Validate same keys between both
    for (let type in choice_order) {
        let key_diff = JSPLib.utility.setSymmetricDifference(choice_order[type],Object.keys(choice_data[type]));
        if (key_diff.length) {
            JSPLib.debug.debuglog("Key difference!",type,key_diff);
            $.each(key_diff,(i,key)=>{
                choice_order[type] = JSPLib.utility.setDifference(choice_order[type],[key]);
                delete choice_data[type][key];
            });
        }
    }

    if ((JSON.stringify(choice_order) !== JSON.stringify(old_choice_order)) || (JSON.stringify(choice_data) !== JSON.stringify(old_choice_data))) {
        JSPLib.debug.debuglog("Corrections to usage data detected!");
        StoreUsageData('correction');
    } else {
        JSPLib.debug.debuglog("Usage data is valid.");
    }
}

/***Main helper functions***/

function RenderListItem(alink_func) {
    return (list, item)=>{
        var $link = alink_func($("<a/>"), item);
        var $container = $("<div/>").append($link);
        HighlightSelected($container, list, item);
        return $("<li/>").data("item.autocomplete", item).append($container).appendTo(list);
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

function MoveAliases(type,data) {
    if (type !== 'tag') {
        return;
    }
    let length = data.length;
    for (let i = 0; i < length; i++) {
        if (data[i].antecedent) {
            let item = data.splice(i,1);
            data.push(item[0]);
            length--;
            i--;
        }
    }
}

function FixExpirationCallback(key,value,tagname,type) {
    JSPLib.debug.debuglog("Fixing expiration:",tagname);
    JSPLib.danbooru.submitRequest('tags',{search: {name: tagname}}).then((data)=>{
        if (!data.length) {
            return;
        }
        var expiration_time = ExpirationTime(type,data[0].post_count);
        JSPLib.storage.saveData(key, {value: value, expires: JSPLib.utility.getExpiration(expiration_time)});
    });
}

//Usage functions

function KeepSourceData(type,metatag,data) {
    let slicepos = (metatag === '' ? 0 : metatag.length + 1);
    Danbooru.IAC.source_data[type] = Danbooru.IAC.source_data[type] || {};
    $.each(data, (i,val)=>{
        let key = (val.antecedent ? val.antecedent : val.value.slice(slicepos));
        Danbooru.IAC.source_data[type][key] = val;
    });
}

function GetChoiceOrder(type,query) {
    let queryterm = query.toLowerCase();
    let available_choices = Danbooru.IAC.choice_order[type].filter((tag)=>{
        let tagterm = tag.toLowerCase();
        let queryindex = tagterm.indexOf(queryterm);
        return queryindex === 0 || (!source_config[type].searchstart && queryindex > 0);
    });
    let sortable_choices = available_choices.filter((tag)=>{return Danbooru.IAC.choice_data[type][tag].use_count > 0});
    sortable_choices.sort((a,b)=>{
        return Danbooru.IAC.choice_data[type][b].use_count - Danbooru.IAC.choice_data[type][a].use_count;
    });
    return JSPLib.utility.setUnique(sortable_choices.concat(available_choices));
}

function AddUserSelected(type,metatag,term,data) {
    let order = Danbooru.IAC.choice_order[type];
    let choice = Danbooru.IAC.choice_data[type];
    if (!order || !choice) {
        return;
    }
    Danbooru.IAC.shown_data = [];
    let user_order = GetChoiceOrder(type,term);
    for (let i = user_order.length - 1; i >= 0; i--) {
        let checkterm = (metatag === '' ? user_order[i] : metatag + ':' + user_order[i]);
        //Splice out Danbooru data if it exists
        for (let j = 0; j < data.length; j++) {
            let compareterm = (data[j].antecedent ? data[j].antecedent : data[j].value);
            if (compareterm === checkterm) {
                data.splice(j,1);
                //Should only be one of these at most
                break;
            }
        }
        let add_data = choice[user_order[i]];
        if (source_config[type].fixupmetatag) {
            FixupMetatag(add_data, metatag);
        }
        data.unshift(add_data);
        Danbooru.IAC.shown_data.push(user_order[i]);
    }
    data.splice(10);
}

//For autocomplete select
function InsertUserSelected(data,input,selected) {
    var type,item,term,source_data;
    //Being hamstrung by Danbooru's select function of the multi-source tag complete
    if (typeof selected === "string") {
        let autocomplete = $(input).autocomplete("instance");
        let list_container = autocomplete.menu.element[0];
        let $links = $('.ui-state-active',list_container).parent();
        if ($links.length === 0) {
            $links = $(".ui-menu-item:first-of-type",list_container);
        }
        item = $links.data("item.autocomplete");
        if (!item) {
            JSPLib.debug.debuglog("Error: No autocomplete data found!",$links,item);
            return;
        }
        type = item.type;
        if (!type) {
            let autocomplete_type = $(input).data('autocomplete');
            if (autocomplete_type == 'tag-query') {
                let match = selected.match(Danbooru.Autocomplete.METATAGS_REGEX);
                type = (match ? match[1] : 'tag');
            } else {
                type = autocomplete_type.replace(/-/g,'');
            }
        }
    } else {
        item = selected;
        type = source_key[data];
    }
    if (item.antecedent) {
        term = item.antecedent;
    } else if (item.name) {
        term = item.name;
    } else {
        term = item.value;
    }
    //Final failsafe
    if (!Danbooru.IAC.source_data[type] || !Danbooru.IAC.source_data[type][term]) {
        if (!Danbooru.IAC.choice_data[type] || !Danbooru.IAC.choice_data[type][term]) {
            JSPLib.debug.debuglog("Error: Bad data selector!",type,term,selected,data,item);
            return;
        }
        source_data = Danbooru.IAC.choice_data[type][term];
    } else {
        source_data = Danbooru.IAC.source_data[type][term];
    }
    Danbooru.IAC.choice_order[type] = Danbooru.IAC.choice_order[type] || [];
    Danbooru.IAC.choice_data[type] = Danbooru.IAC.choice_data[type] || {};
    Danbooru.IAC.choice_order[type].unshift(term);
    Danbooru.IAC.choice_order[type] = JSPLib.utility.setUnique(Danbooru.IAC.choice_order[type]);
    //So the use count doesn't get squashed by the new variable assignment
    let use_count = (Danbooru.IAC.choice_data[type][term] && Danbooru.IAC.choice_data[type][term].use_count) || 0;
    Danbooru.IAC.choice_data[type][term] = source_data;
    Danbooru.IAC.choice_data[type][term].expires = JSPLib.utility.getExpiration(Danbooru.IAC.user_settings.usage_expires * JSPLib.utility.one_day);
    Danbooru.IAC.choice_data[type][term].use_count = use_count + 1, Danbooru.IAC.user_settings.usage_maximum;
    if (Danbooru.IAC.user_settings.usage_maximum > 0) {
        Danbooru.IAC.choice_data[type][term].use_count = Math.min(Danbooru.IAC.choice_data[type][term].use_count, Danbooru.IAC.user_settings.usage_maximum);
    }
    $.each(Danbooru.IAC.shown_data,(i,key)=>{
        if (key !== term) {
            Danbooru.IAC.choice_data[type][key].use_count = Danbooru.IAC.choice_data[type][key].use_count || 0;
            Danbooru.IAC.choice_data[type][key].use_count *= Danbooru.IAC.user_settings.usage_multiplier;
        }
    });
    StoreUsageData('insert',term);
}

//For autocomplete render
function HighlightSelected($link,list,item) {
    if (item.expires) {
        $('a',$link).addClass('iac-user-choice');
    }
    if (item.antecedent) {
        $('a',$link).addClass('iac-tag-alias');
    }
    return $link;
}

function PruneUsageData() {
    let is_dirty = false;
    $.each(Danbooru.IAC.choice_data,(type_key,type_entry)=>{
        $.each(type_entry,(key,entry)=>{
            if (!JSPLib.validate.validateExpires(entry.expires, Danbooru.IAC.user_settings.usage_expires * JSPLib.utility.one_day)) {
                JSPLib.debug.debuglog("Pruning choice data!",type_key,key);
                Danbooru.IAC.choice_order[type_key] = JSPLib.utility.setDifference(Danbooru.IAC.choice_order[type_key],[key])
                delete type_entry[key];
                is_dirty = true;
            }
        });
    });
    if (is_dirty) {
        StoreUsageData("prune");
    }
}

function StoreUsageData(name,key='') {
    JSPLib.storage.setStorageData('iac-choice-order',Danbooru.IAC.choice_order,localStorage);
    JSPLib.storage.setStorageData('iac-choice-data',Danbooru.IAC.choice_data,localStorage);
    Danbooru.IAC.channel.postMessage({type: "reload", name: name, key: key, choice_order: Danbooru.IAC.choice_order, choice_data: Danbooru.IAC.choice_data});
}

function BroadcastIAC(ev) {
    JSPLib.debug.debuglog(`BroadcastChannel (${ev.data.type}):`,(ev.data.type === "reload" ? `${ev.data.name} ${ev.data.key}` : ev.data));
    if (ev.data.type === "reload") {
        Danbooru.IAC.choice_order = ev.data.choice_order;
        Danbooru.IAC.choice_data = ev.data.choice_data;
    } else if (ev.data.type === "settings") {
        Danbooru.IAC.user_settings = ev.data.user_settings;
        SetTagAutocompleteSource();
    } else if (ev.data.type === "reset") {
        Danbooru.IAC.user_settings = ev.data.user_settings;
        SetTagAutocompleteSource();
        Object.assign(Danbooru.IAC,program_reset_keys);
    } else if (ev.data.type === "purge") {
        $.each(sessionStorage,(key)=>{
            if (key.match(program_cache_regex)) {
                sessionStorage.removeItem(key);
            }
        });
    }
}

/***Main execution functions***/

function NetworkSource(type,key,term,resp,metatag) {
    JSPLib.debug.debuglog("Querying",type,':',term);
    JSPLib.danbooru.submitRequest(source_config[type].url,source_config[type].data(term)).then((data)=>{
        var d = $.map(data, source_config[type].map);
        var expiration_time = source_config[type].expiration(d);
        var save_data = JSPLib.utility.dataCopy(d);
        JSPLib.storage.saveData(key, {value: save_data, expires: JSPLib.utility.getExpiration(expiration_time)});
        if (source_config[type].fixupexpiration && d.length) {
            setTimeout(()=>{FixExpirationCallback(key, save_data, save_data[0].value, type);}, callback_interval);
        }
        ProcessSourceData(type,metatag,term,d,resp);
    });
}

function AnySourceIndexed(keycode,default_metatag='',multiple=false) {
    var type = source_key[keycode];
    return async function (req, resp, input_metatag) {
        var term;
        //Only for instances set with InitializeAutocompleteIndexed, i.e. not the hooked "tag-query" source functions
        if (multiple) {
            term = Danbooru.Autocomplete.parse_query(req.term, this.element.get(0).selectionStart).term;
            if (!term) {
                resp([]);
                return;
            }
        } else {
            term = (req.term ? req.term : req);
            if (term.match(/\S\s/)) {
                resp([]);
                return;
            }
            term = term.trim();
        }
        var key = (keycode + "-" + term).toLowerCase();
        var use_metatag = (input_metatag ? input_metatag : default_metatag);
        if (!Danbooru.IAC.user_settings.network_only_mode) {
            var max_expiration = MaximumExpirationTime(type);
            var cached = await JSPLib.storage.checkLocalDB(key,ValidateEntry,max_expiration);
            if (cached) {
                ProcessSourceData(type, use_metatag, term, cached.value, resp);
                return;
            }
        }
        NetworkSource(type, key, term, resp, use_metatag);
    }
}

function ProcessSourceData(type,metatag,term,data,resp) {
    if (source_config[type].fixupmetatag) {
        $.each(data, (i,val)=> {FixupMetatag(val,metatag);});
    }
    KeepSourceData(type, metatag, data);
    if (Danbooru.IAC.user_settings.move_aliases) {
        MoveAliases(type, data);
    }
    if (Danbooru.IAC.user_settings.usage_enabled) {
        AddUserSelected(type, metatag, term, data);
    }
    resp(data);
}

//Non-autocomplete storage

function CommonBindIndexed(button_name, category) {
    $(button_name).on('click.IAC',async (e)=>{
        var $dest = $("#related-tags");
        $dest.empty();
        Danbooru.RelatedTag.build_recent_and_frequent($dest);
        $dest.append("<em>Loading...</em>");
        $("#related-tags-container").show();
        var currenttag = $.trim(Danbooru.RelatedTag.current_tag());
        var keymodifier = (category.length ? JSPLib.danbooru.getShortName(category) : "");
        var key = ("rt" + keymodifier + "-" + currenttag).toLowerCase();
        var max_expiration = MaximumExpirationTime('relatedtag');
        var cached = await JSPLib.storage.checkLocalDB(key,ValidateEntry,max_expiration);
        if (cached) {
            Danbooru.RelatedTag.process_response(cached.value);
        } else {
            JSPLib.debug.debuglog("Querying relatedtag:",currenttag,category);
            var data = await JSPLib.danbooru.submitRequest("related_tag", {query: currenttag, category: category});
            JSPLib.storage.saveData(key, {value: data, expires: JSPLib.utility.getExpiration(MinimumExpirationTime('relatedtag'))});
            Danbooru.RelatedTag.process_response(data);
        }
        $("#artist-tags-container").hide();
        e.preventDefault();
    });
}

function CheckSource(domobj) {
    if (domobj.val()) {
        let key = 'af-' + domobj.val();
        JSPLib.debug.debuglog("Checking artist",key);
        let data = JSPLib.storage.getStorageData(key,sessionStorage);
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
    JSPLib.danbooru.submitRequest("artists/finder", {url: url.val(), referer_url: referer_url.val()})
        .then((data)=>{
            Danbooru.RelatedTag.process_artist(data);
            if (url.val()) {
                JSPLib.storage.setStorageData('af-' + url.val(), data, sessionStorage);
            }
            if ((url.val() !== referer_url.val()) && referer_url.val()) {
                JSPLib.storage.setStorageData('af-' + referer_url.val(), data, sessionStorage);
            }
        });
    e.preventDefault();
}

/***Setup functions***/

//Rebind callback functions

function rebindRelatedTags() {
    //Only need to check one of them, since they're all bound at the same time
    if (IsNamespaceBound("#related-tags-button",'click','danbooru')) {
        clearInterval(rebindRelatedTags.timer);
        $("#related-tags-button").off('click.danbooru');
        CommonBindIndexed("#related-tags-button", "");
        $.each(['general','artist','character','copyright'], (i,category)=>{
            $(`#related-${category}-button`).off('click.danbooru');
            CommonBindIndexed("#related-" + category + "-button", category);
        });
        rebindRelatedTags.timer = true;
    }
}

function rebindFindArtist() {
    if (IsNamespaceBound("#find-artist-button",'click','danbooru')) {
        clearInterval(rebindFindArtist.timer);
        $("#find-artist-button").off('click.danbooru').on('click.IAC',FindArtistSession);
        rebindFindArtist.timer = true;
    }
}

function rebindAnyAutocomplete(selector, keycode, multiple) {
    if (HasDOMDataKey(selector,'uiAutocomplete')) {
        clearInterval(rebindAnyAutocomplete.timer[keycode]);
        $(selector).autocomplete("destroy").off('keydown.Autocomplete.tab');
        InitializeAutocompleteIndexed(selector, keycode, multiple);
    }
}
rebindAnyAutocomplete.timer = {};

function setRebindInterval(selector, keycode, multiple) {
    rebindAnyAutocomplete.timer[keycode] = setInterval(()=>{rebindAnyAutocomplete(selector,keycode,multiple)},timer_poll_interval);
}

//Initialization functions

function InitializeAutocompleteIndexed(selector, keycode, multiple=false) {
    let type = source_key[keycode];
    var $fields = $(selector);
    $fields.autocomplete({
        minLength: 1,
        delay: 100,
        source: AnySourceIndexed(keycode,'',multiple),
        search: function() {
            $(this).data("uiAutocomplete").menu.bindings = $();
        },
        select: function(event,ui) {
            InsertUserSelected(keycode, this, ui.item);
            if (multiple) {
                if (event.key === "Enter") {
                    event.stopImmediatePropagation();
                }
                Danbooru.Autocomplete.insert_completion(this, ui.item.value);
                return false;
            }
            return ui.item.value;
        }
    });
    if (source_config[type].render) {
        $fields.each((i, field)=>{
            $(field).data("uiAutocomplete")._renderItem = source_config[type].render;
        });
    } else {
        $fields.each((i, field)=>{
            $(field).data("uiAutocomplete")._renderItem = RenderListItem(($domobj,item)=>{return $domobj.text(item.value);});
        });
    }
    if (!IsNamespaceBound(selector,'keydown','Autocomplete.tab')) {
        $fields.on("keydown.Autocomplete.tab", null, "tab", Danbooru.Autocomplete.on_tab);
    }
    $fields.data('autocomplete',type);
}

///Settings menu

function RenderTextinput(program_shortcut,setting_name,length=20) {
    let program_key = program_shortcut.toUpperCase();
    let setting_key = KebabCase(setting_name);
    let display_name = DisplayCase(setting_name);
    let value = Danbooru[program_key].user_settings[setting_name];
    let hint = settings_config[setting_name].hint;
    return `
<div class="${program_shortcut}-textinput" data-setting="${setting_name}" style="margin:0.5em">
    <h4>${display_name}</h4>
    <div style="margin-left:0.5em">
        <input type="text" class="${program_shortcut}-setting" name="${program_shortcut}-setting-${setting_key}" id="${program_shortcut}-setting-${setting_key}" value="${value}" size="${length}" autocomplete="off" class="text" style="padding:1px 0.5em">
        <span class="${program_shortcut}-setting-tooltip" style="display:block;font-style:italic;color:#666">${hint}</span>
    </div>
</div>`;
}

function RenderCheckbox(program_shortcut,setting_name) {
    let program_key = program_shortcut.toUpperCase();
    let setting_key = KebabCase(setting_name);
    let display_name = DisplayCase(setting_name);
    let checked = (Danbooru[program_key].user_settings[setting_name] ? "checked" : "");
    let hint = settings_config[setting_name].hint;
    return `
<div class="${program_shortcut}-checkbox" data-setting="${setting_name}" style="margin:0.5em">
    <h4>${display_name}</h4>
    <div style="margin-left:0.5em">
        <input type="checkbox" ${checked} class="${program_shortcut}-setting" name="${program_shortcut}-enable-${setting_key}" id="${program_shortcut}-enable-${setting_key}">
        <span class="${program_shortcut}-setting-tooltip" style="display:inline;font-style:italic;color:#666">${hint}</span>
    </div>
</div>`;
}

function RenderLinkclick(program_shortcut,setting_name,display_name,link_text) {
    let setting_key = KebabCase(setting_name);
    return `
<div class="${program_shortcut}-linkclick" style="margin:0.5em">
    <h4>${display_name}</h4>
    <div style="margin-left:0.5em">
        <span class="${program_shortcut}-control-linkclick" style="display:block"><a href="#" id="${program_shortcut}-setting-${setting_key}" style="color:#0073ff">${link_text}</a></span>
    </div>
</div>`;
}
const usage_settings = `
<div id="iac-settings" style="float:left;width:50%">
    <div id="iac-script-message" class="prose">
        <h2>IndexedAutocomplete</h2>
        <p>Check the forum for the latest on information and updates (<a class="dtext-link dtext-id-link dtext-forum-topic-id-link" href="/forum_topics/14701" style="color:#0073ff">topic #14701</a>).</p>
    </div>
    <div id="iac-usage-settings" style="margin-bottom:2em">
        <div id="iac-usage-message" class="prose">
            <h4>Usage settings</h4>
            <p>These settings control how items get sorted in the autocomplete popup.</p>
            <h5>Equations</h5>
            <ul>
                <li><b>Hit:</b> <span style="font-family:monospace;font-size:125%">usage_count = Max( usage_count + 1 , usage_maximum)</span>
                <li><b>Miss:</b> <span style="font-family:monospace;font-size:125%">usage_count = usage_count * usage_multiplier</span>
            </ul>
        </div>
    </div>
    <div id="iac-display-settings" style="margin-bottom:2em">
        <div id="iac-display-message" class="prose">
            <h4>Display settings</h4>
        </div>
    </div>
    <div id="iac-network-settings" style="margin-bottom:2em">
        <div id="iac-network-message" class="prose">
            <h4>Network settings</h4>
            <ul>
                <li><b>Alternate tag source:</b> Uses the <code>/tags</code> controller instead of the normal autocomplete source.
                    <ul>
                        <li>No aliases.</li>
                        <li>No fuzzy or intelligent autocomplete.</li>
                        <li>All results will be exact matches.</li>
                    </ul>
                </li>
                <li><b>Network only mode:</b> Always goes to network.
                    <ul>
                        <li>Can be used to correct cache data that has been changed on the server.</li>
                        <li><span style="color:red;font-weight:bold">Warning!</span> <span style="font-style:italic">As this negates the benefits of using local cached data, it should only be used sparingly.</span></li>
                    </ul>
                </li>
            </ul>
        </div>
    </div>
    <div id="iac-cache-settings" style="margin-bottom:2em">
        <div id="iac-cache-message" class="prose">
            <h4>Cache settings</h4>
            <h5>Cache data</h5>
            <ul>
                <li><b>Autocomplete data:</b> Data from every combination of keys in the text input.
                    <ul style="font-size:80%">
                        <li>tags</li>
                        <li>pools</li>
                        <li>users</li>
                        <li>favorite groups</li>
                        <li>saved searches</li>
                        <li>wiki pages</li>
                        <li>artists</li>
                        <li>forum topics</li>
                    </ul>
                </li>
                <li><b>Related tag data:</b> Data from every use of the related tag functions (<span style="font-size:80%"><i>right beneath the tag edit box</i></span>).
                    <ul style="font-size:80%">
                        <li>related tags</li>
                        <li>general</li>
                        <li>artists</li>
                        <li>characters</li>
                        <li>copyrights</li>
                    </ul>
                </li>
            </ul>
            <h5>Cache controls</h5>
            <ul>
                <li><b>Purge cache:</b> Dumps all of the cached data related to IndexedAutocomplete.</li>
            </ul>
        </div>
    </div>
    <hr>
    <div id="iac-settings-buttons" style="margin-top:1em">
        <input type="button" id="iac-commit" value="Save">
        <input type="button" id="iac-resetall" value="Factory Reset">
    </div>
</div>`;

const settings_config = {
    usage_multiplier: {
        default: 0.9,
        parse: parseFloat,
        validate: (data)=>{return validate.isNumber(data) && data >= 0.0 && data <= 1.0;},
        hint: "Valid values: 0.0 - 1.0."
    },
    usage_maximum: {
        default: 20,
        parse: parseFloat,
        validate: (data)=>{return validate.isNumber(data) && data >= 0.0;},
        hint: "Set to 0 for no maximum."
    },
    usage_expires: {
        default: 2,
        parse: parseInt,
        validate: (data)=>{return Number.isInteger(data) && data > 0;},
        hint: "Number of days."
    },
    usage_enabled: {
        default: true,
        validate: (data)=>{return validate.isBoolean(data);},
        hint: "Uncheck to turn off usage mechanism."
    },
    move_aliases: {
        default: true,
        validate: (data)=>{return validate.isBoolean(data);},
        hint: "Check to move aliases to the end of the autocomplete list."
    },
    alternate_tag_source: {
        default: false,
        validate: (data)=>{return validate.isBoolean(data);},
        hint: "Check to turn on."
    },
    network_only_mode: {
        default: false,
        validate: (data)=>{return validate.isBoolean(data);},
        hint: "Check to turn on."
    }
}

function SetTagAutocompleteSource() {
    if (Danbooru.IAC.user_settings.alternate_tag_source) {
        source_config.tag = source_config.tag2;
    } else {
        source_config.tag = source_config.tag1;
    }
}

function LoadUserSettings(program_shortcut) {
    let user_settings = JSPLib.storage.getStorageData(`${program_shortcut}-user-settings`,localStorage,{});
    let is_dirty = false;
    $.each(settings_config,(setting)=>{
        if (!(setting in user_settings) || !settings_config[setting].validate(user_settings[setting])) {
            JSPLib.debug.debuglog("Loading default:",setting,user_settings[setting]);
            user_settings[setting] = settings_config[setting].default;
            is_dirty = true;
        }
    });
    let valid_settings = Object.keys(settings_config);
    $.each(user_settings,(setting)=>{
        if (!valid_settings.includes(setting)) {
            JSPLib.debug.debuglog("Deleting invalid setting:",setting,user_settings[setting]);
            delete user_settings[setting];
            is_dirty = true;
        }
    });
    if (is_dirty) {
        JSPLib.debug.debuglog("Saving change to user settings!");
        JSPLib.storage.setStorageData(`${program_shortcut}-user-settings`,user_settings,localStorage);
    }
    return user_settings;
}

function SaveUserSettingsClick(program_shortcut,program_name) {
    let program_key = program_shortcut.toUpperCase();
    $(`#${program_shortcut}-commit`).click((e)=>{
        let invalid_setting = false;
        let temp_selectors = {};
        $(`#${program_shortcut}-settings .${program_shortcut}-setting[id]`).each((i,entry)=>{
            let setting_name = $(entry).parent().parent().data('setting');
            if (entry.type === "checkbox") {
                let selector = $(entry).data('selector');
                if (selector) {
                    temp_selectors[setting_name] = temp_selectors[setting_name] || [];
                    if (entry.checked) {
                        temp_selectors[setting_name].push(selector);
                    }
                } else {
                    Danbooru[program_key].user_settings[setting_name] = entry.checked;
                }
            } else if (entry.type === "text") {
                 let user_setting = settings_config[setting_name].parse($(entry).val());
                 if (settings_config[setting_name].validate(user_setting)) {
                    Danbooru[program_key].user_settings[setting_name] = user_setting;
                 } else {
                    invalid_setting = true;
                 }
                 $(entry).val(Danbooru[program_key].user_settings[setting_name]);
            }
        });
        $.each(temp_selectors,(setting_name)=>{
            Danbooru[program_key].user_settings[setting_name] = temp_selectors[setting_name];
        });
        JSPLib.storage.setStorageData(`${program_shortcut}-user-settings`,Danbooru[program_key].user_settings,localStorage);
        Danbooru[program_key].channel && Danbooru[program_key].channel.postMessage({type: "settings", user_settings: Danbooru[program_key].user_settings});
        if (!invalid_setting) {
            Danbooru.Utility.notice(`${program_name}: Settings updated!`);
        } else {
            Danbooru.Utility.error("Error: Some settings were invalid!")
        }
    });
}

function ResetUserSettingsClick(program_shortcut,program_name,delete_keys,reset_settings) {
    let program_key = program_shortcut.toUpperCase();
    $(`#${program_shortcut}-resetall`).click((e)=>{
        if (confirm(`This will reset all of ${program_name}'s settings.\n\nAre you sure?`)) {
            $.each(settings_config,(setting)=>{
                Danbooru[program_key].user_settings[setting] = settings_config[setting].default;
            });
            $(`#${program_shortcut}-settings .${program_shortcut}-setting[id]`).each((i,entry)=>{
                let $input = $(entry);
                let setting_name = $input.parent().parent().data('setting');
                if (entry.type === "checkbox") {
                    let selector = $input.data('selector');
                    if (selector) {
                        $input.prop('checked', IsSettingEnabled(setting_name,selector));
                        $input.checkboxradio("refresh");
                    } else {
                        $input.prop('checked', Danbooru[program_key].user_settings[setting_name]);
                    }
                } else if (entry.type === "text") {
                     $input.val(Danbooru[program_key].user_settings[setting_name]);
                }
            });
            $.each(delete_keys,(i,key)=>{
                localStorage.removeItem(key);
            });
            Object.assign(Danbooru[program_key],reset_settings);
            JSPLib.storage.setStorageData(`${program_shortcut}-user-settings`,Danbooru[program_key].user_settings,localStorage);
            Danbooru[program_key].channel && Danbooru[program_key].channel.postMessage({type: "reset", user_settings: Danbooru[program_key].user_settings});
            Danbooru.Utility.notice(`${program_name}: Settings reset to defaults!`);
        }
    });
}

async function PurgeCache(regex,domname) {
    Danbooru.Utility.notice("Starting cache deletion...");
    let promise_array = [];
    let purged_count = 0;
    let remaining_count = 0;
    await JSPLib.storage.danboorustorage.iterate((value,key)=>{
        if (key.match(regex)) {
            JSPLib.debug.debuglogLevel("Deleting",key,JSPLib.debug.DEBUG);
            let resp = JSPLib.storage.removeData(key).then(()=>{
                domname && $(domname).html(--remaining_count);
            });
            promise_array.push(resp);
            purged_count += 1;
            domname && $(domname).html(++remaining_count);
        }
    });
    Danbooru.Utility.notice(`Deleting ${purged_count} items...`);
    JSPLib.debug.debuglogLevel(`Deleting ${purged_count} items...`,JSPLib.debug.INFO);
    //Wait at least 5 seconds
    await JSPLib.utility.sleep(5000);
    await Promise.all(promise_array);
    Danbooru.Utility.notice("Finished deleting cached data!");
    JSPLib.debug.debuglogLevel("Finished deleting cached data!",JSPLib.debug.INFO);
}

function PurgeCacheClick(program_shortcut,program_name,regex,domname) {
    let program_key = program_shortcut.toUpperCase();
    $(`#${program_shortcut}-setting-purge-cache`).click((e)=>{
        if (!PurgeCacheClick.is_started && confirm(`This will delete all of ${program_name}'s cached data.\n\nAre you sure?`)) {
            PurgeCacheClick.is_started = true;
            PurgeCache(regex,domname).then(()=>{
                Danbooru[program_key].channel && Danbooru[program_key].channel.postMessage({type: "purge"});
                PurgeCacheClick.is_started = false;
            });;
        }
        e.preventDefault();
    });
}

function RenderSettingsMenu() {
    $("#indexed-autocomplete").append(usage_settings);
    $("#iac-usage-settings").append(RenderTextinput("iac",'usage_multiplier'));
    $("#iac-usage-settings").append(RenderTextinput("iac",'usage_maximum'));
    $("#iac-usage-settings").append(RenderTextinput("iac",'usage_expires'));
    $("#iac-usage-settings").append(RenderCheckbox("iac",'usage_enabled'));
    $("#iac-display-settings").append(RenderCheckbox("iac",'move_aliases'));
    $("#iac-network-settings").append(RenderCheckbox("iac",'alternate_tag_source'));
    $("#iac-network-settings").append(RenderCheckbox("iac",'network_only_mode'));
    $("#iac-cache-settings").append(RenderLinkclick("iac",'purge_cache',`Purge cache (<span id="iac-purge-counter">...</span>)`,"Click to purge"));
    SaveUserSettingsClick('iac','IndexedAutocomplete');
    ResetUserSettingsClick('iac','IndexedAutocomplete',localstorage_keys,program_reset_keys);
    PurgeCacheClick('iac','IndexedAutocomplete',program_cache_regex,"#iac-purge-counter");
}

//Main menu tabs

const css_themes_url = 'https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/themes/base/jquery-ui.css';

const settings_field = `
<fieldset id="userscript-settings-menu" style="display:none">
  <ul id="userscript-settings-tabs">
  </ul>
  <div id="userscript-settings-sections">
  </div>
</fieldset>`;

function RenderTab(program_name,program_key) {
    return `<li><a href="#${program_key}">${program_name}</a></li>`;
}

function RenderSection(program_key) {
    return `<div id="${program_key}"></div>`;
}

function MainSettingsClick() {
    if (!IsNamespaceBound(`[href="#userscript-menu"`,'click','jsplib.menuchange')) {
        $(`[href="#userscript-menu"`).on('click.jsplib.menuchange',(e)=>{
            $(`#edit-options a[href$="settings"]`).removeClass("active");
            $(e.target).addClass("active");
            $(".edit_user > fieldset").hide();
            $("#userscript-settings-menu").show();
            $('[name=commit]').hide();
            e.preventDefault();
        });
    }
}
function OtherSettingsClicks() {
    if (!IsNamespaceBound("#edit-options a[href$=settings]",'click','jsplib.menuchange')) {
        $("#edit-options a[href$=settings]").on('click.jsplib.menuchange',(e)=>{
            $(`[href="#userscript-menu"`).removeClass('active');
            $("#userscript-settings-menu").hide();
            $('[name=commit]').show();
            e.preventDefault()
        });
    }
}

function InstallSettingsMenu(program_name) {
    let program_key = KebabCase(program_name);
    if ($("#userscript-settings-menu").length === 0) {
        $(`input[name="commit"]`).before(settings_field);
        $("#edit-options").append('| <a href="#userscript-menu">Userscript Menus</a>');
        //Periodic recheck in case other programs remove/rebind click events
        setInterval(()=>{
            MainSettingsClick();
            OtherSettingsClicks();
        },1000);
        AddStyleSheet(css_themes_url);
    } else {
        $("#userscript-settings-menu").tabs("destroy");
    }
    $("#userscript-settings-tabs").append(RenderTab(program_name,program_key));
    $("#userscript-settings-sections").append(RenderSection(program_key));
    //Sort the tabs alphabetically
    $("#userscript-settings-tabs li").sort(function(a, b) {
        try {
            return a.children[0].innerText.localeCompare(b.children[0].innerText);
        } catch (e) {
            return 0;
        }
    }).each(function() {
        var elem = $(this);
        elem.remove();
        $(elem).appendTo("#userscript-settings-tabs");
    });
    $("#userscript-settings-menu").tabs();
}


//Main program
function main() {
    if (!JSPLib.storage.use_indexed_db) {
        JSPLib.debug.debuglog("No Indexed DB! Exiting...");
        return;
    }
    if ($(autocomplete_domlist.join(',')).length === 0) {
        JSPLib.debug.debuglog("No autocomplete inputs! Exiting...");
        return;
    }
    JSPLib.utility.setCSSStyle(program_css,'program');
    Danbooru.IAC = {source_data: {},
        choice_order: JSPLib.storage.getStorageData('iac-choice-order',localStorage,{}),
        choice_data: JSPLib.storage.getStorageData('iac-choice-data',localStorage,{}),
        user_settings: LoadUserSettings('iac'),
        channel: new BroadcastChannel('IndexedAutocomplete')
    };
    SetTagAutocompleteSource();
    Danbooru.IAC.channel.onmessage = BroadcastIAC;
    CorrectUsageData();
    PruneUsageData();
    Danbooru.Autocomplete.normal_source = AnySourceIndexed('ac');
    Danbooru.Autocomplete.pool_source = AnySourceIndexed('pl');
    Danbooru.Autocomplete.user_source = AnySourceIndexed('us');
    Danbooru.Autocomplete.favorite_group_source = AnySourceIndexed('fg');
    Danbooru.Autocomplete.saved_search_source = AnySourceIndexed('ss','search');
    Danbooru.Autocomplete.insert_completion = JSPLib.utility.hijackFunction(Danbooru.Autocomplete.insert_completion,InsertUserSelected);
    Danbooru.Autocomplete.render_item = JSPLib.utility.hijackFunction(Danbooru.Autocomplete.render_item,HighlightSelected);
    if ($("#c-posts #a-show,#c-uploads #a-new").length) {
        rebindRelatedTags.timer = setInterval(rebindRelatedTags,timer_poll_interval);
        //Need to fix this so it captures fetch source instead
        //rebindFindArtist.timer = setInterval(rebindFindArtist,timer_poll_interval);
    }
    if ($("#c-wiki-pages,#c-wiki-page-versions").length) {
        setRebindInterval("#search_title,#quick_search_title", 'wp');
    }
    if ($("#c-artists,#c-artist-versions").length) {
        setRebindInterval("#search_name,#quick_search_name", 'ar');
    }
    if ($("#c-pools,#c-pool-versions").length) {
        setRebindInterval("#search_name_matches,#quick_search_name_matches", 'pl');
    }
    if ($("#c-posts #a-show").length) {
        setRebindInterval("#add-to-pool-dialog input[type=text]", 'pl');
    }
    if ($("#c-posts #a-index").length) {
        setRebindInterval("#saved_search_label_string", 'ss', true);
    }
    if ($("#c-saved-searches #a-edit").length) {
        InitializeAutocompleteIndexed("#saved_search_label_string", 'ss', true);
    }
    if ($("#c-forum-topics").length) {
        JSPLib.utility.setCSSStyle(forum_css);
        $("#quick_search_body_matches").parent().parent().after(forum_topic_search);
        InitializeAutocompleteIndexed("#quick_search_title_matches", 'ft');
    }
    if ($("#c-forum-posts #a-search").length) {
        JSPLib.utility.setCSSStyle(forum_css,'forum');
        InitializeAutocompleteIndexed("#search_topic_title_matches", 'ft');
    }
    if ($("#c-uploads #a-index").length) {
        $("#search_post_tags_match").attr('data-autocomplete','tag-query');
        //The initialize code doesn't work properly unless some time has elapsed after setting the attribute
        setTimeout(Danbooru.Autocomplete.initialize_tag_autocomplete, timer_poll_interval);
    }
    if ($(autocomplete_userlist.join(',')).length) {
        InitializeAutocompleteIndexed(autocomplete_userlist.join(','), 'us');
    }
    if ($("#c-users #a-edit").length) {
        InstallScript("https://cdn.rawgit.com/jquery/jquery-ui/1.12.1/ui/widgets/tabs.js").done(()=>{
            InstallSettingsMenu("IndexedAutocomplete");
            RenderSettingsMenu();
        });
    }
    JSPLib.debug.debugExecute(()=>{
        window.addEventListener('beforeunload', ()=>{
            JSPLib.statistics.outputAdjustedMean("IndexedAutocomplete");
        });
    });
    //Take care of other non-critical tasks at a later time
    setTimeout(()=>{
        JSPLib.storage.pruneEntries('cu',program_cache_regex,prune_expires);
    },JSPLib.utility.one_minute);
}

/***Execution start***/

JSPLib.load.programInitialize(main,'IAC',program_load_required_variables);
