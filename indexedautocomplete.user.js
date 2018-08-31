// ==UserScript==
// @name         IndexedAutocomplete
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      17.4
// @source       https://danbooru.donmai.us/users/23799
// @description  Uses indexed DB for autocomplete
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/indexedautocomplete.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.5.2/localforage.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.12.0/validate.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180723/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180723/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180723/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180723/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180723/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180723/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180723/lib/danbooru.js
// ==/UserScript==

/***Global variables***/

//Variables for debug.js
JSPLib.debug.debug_console = false;
JSPLib.debug.pretext = "IAC:";
JSPLib.debug.level = JSPLib.debug.INFO;

//Variables for load.js
const program_load_required_variables = ['window.jQuery','window.Danbooru','Danbooru.Autocomplete','Danbooru.RelatedTag'];

//Polling interval for checking program status
const timer_poll_interval = 100;

//Interval for fixup callback functions
const callback_interval = 1000;

//Main function expires
const prune_expires = JSPLib.utility.one_day;

//Maximum number of entries to prune in one go
const prune_limit = 1000;

//Usage order variables
const usage_multiplier = 0.9;
const usage_maximum = 20;
const usage_expires = 2 * JSPLib.utility.one_day;

const autocomplete_userlist = [
    "#search_to_name",
    "#search_from_name",
    "#dmail_to_name",
    "#search_user_name",
    "#search_banner_name",
    "#search_creator_name",
    "#search_approver_name",
    "#search_updater_name",
    "#search_uploader_name"
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
    "#search_topic_title_matches"
    ].concat(autocomplete_userlist);

const forum_topic_search = `
<li>
    <form action="/forum_topics" accept-charset="UTF-8" method="get">
        <input name="utf8" type="hidden" value="✓">
        <input id="quick_search_title_matches" placeholder="Search topic" type="text" name="search[title_matches]" class="ui-autocomplete-input" autocomplete="off">
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
        post_count: {
            presence: true,
            numericality: {
                noStrings: true,
                onlyInteger: true,
                greaterThan: -1,
            }
        },
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
        value : {presence: true}
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
    tag: {
        url: "tags",
        data: (term)=>{
            return {
                search: {
                    name_matches: term + "*",
                    hide_empty: true,
                    order: "count"
                }
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

function DebugExecute(func) {
    if (JSPLib.debug.debug_console) {
        func();
    }
}

function RegexpEscape(string) {
  return string.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
}

function CreateCookie(name, value, days) {
    var expires = "";
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toGMTString();
    }

    document.cookie = name + "=" + value + expires + "; path=/";
}

function ReadCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1, c.length)
        }
        if (c.indexOf(nameEQ) == 0) {
            return decodeURIComponent(c.substring(nameEQ.length, c.length).replace(/\+/g, " "));
        }
    }
    return null;
}

 function EraseCookie(name) {
    CreateCookie(name, "", -1);
}

function GetExpiration(expires) {
    return Date.now() + expires;
}

function ValidateExpires(actual_expires,expected_expires) {
    //Resolve to true if the actual_expires is bogus, has expired, or the expiration is too long
    return !Number.isInteger(actual_expires) || (Date.now() > actual_expires) || ((actual_expires - Date.now()) > expected_expires);
}

async function PruneStorage(regex) {
    if (JSPLib.storage.use_storage) {
        let pruned_items = 0;
        let total_items = 0;
        let promise_array = [];
        await JSPLib.storage.danboorustorage.iterate((value,key)=>{
            if (key.match(regex)) {
                if (JSPLib.storage.hasDataExpired(value)) {
                    JSPLib.debug.debuglog("Deleting",key);
                    promise_array.push(JSPLib.storage.removeData(key));
                    pruned_items += 1;
                }
                total_items += 1;
                if (pruned_items >= prune_limit) {
                    JSPLib.debug.debuglog("Prune limit reached!");
                    return true;
                }
            }
        });
        JSPLib.debug.debuglog(`Pruning ${pruned_items}/${total_items} items!`);
        return Promise.all(promise_array);
    }
}

function HijackFunction(oldfunc,newfunc) {
    return function() {
        let data = oldfunc(...arguments);
        data = newfunc(data,...arguments);
        return data;
    }
}

//Time functions

function MinimumExpirationTime(type) {
    return expiration_config[type].minimum;
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
    if (entry === null) {
        JSPLib.debug.debuglog(key,"entry not found!");
        return false;
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
    for (let i=0;i < entry.value.length; i++) {
        let type = source_key[key.slice(0,2)];
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
        JSPLib.storage.saveData(key, {value: value, expires: Date.now() + expiration_time});
    });
}

function PruneIACEntries() {
    JSPLib.debug.debugTime('IAC-PruneIACEntries');
    let expires = JSPLib.storage.getStorageData('iac-prune-expires',localStorage,0);
    if (ValidateExpires(expires, prune_expires)) {
        JSPLib.debug.debuglog("PruneIACEntries");
        PruneStorage(/^(?:ac|pl|us|fg|ss|ar|wp|ft|rt(?:gen|char|copy|art)?)-/).then(()=>{
            JSPLib.debug.debuglog("Pruning complete!");
            JSPLib.debug.debugTimeEnd('IAC-PruneIACEntries');
        });
        JSPLib.storage.setStorageData('iac-prune-expires', GetExpiration(prune_expires), localStorage);;
    } else {
        JSPLib.debug.debuglog("No prune of autocomplete entries!");
    }
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
            let match = selected.match(Danbooru.Autocomplete.METATAGS_REGEX);
            type = (match ? match[1] : 'tag');
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
    Danbooru.IAC.choice_data[type][term].expires = GetExpiration(usage_expires);
    Danbooru.IAC.choice_data[type][term].use_count = Math.min(use_count + 1,usage_maximum);
    $.each(Danbooru.IAC.shown_data,(i,key)=>{
        if (key !== term) {
            Danbooru.IAC.choice_data[type][key].use_count = (Danbooru.IAC.choice_data[type][key].use_count ? usage_multiplier * Danbooru.IAC.choice_data[type][key].use_count : 0);
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
            if (ValidateExpires(entry.expires, usage_expires)) {
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

function UsageBroadcast(ev) {
    JSPLib.debug.debuglog(`BroadcastChannel (${ev.data.type}):`,ev.data.name,ev.data.key);
    if (ev.data.type == "reload") {
        Danbooru.IAC.choice_order = ev.data.choice_order;
        Danbooru.IAC.choice_data = ev.data.choice_data;
    }
}

/***Main execution functions***/

function NetworkSource(type,key,term,resp,metatag) {
    JSPLib.debug.debuglog("Querying",type,':',term);
    JSPLib.danbooru.submitRequest(source_config[type].url,source_config[type].data(term)).then((data)=>{
        var d = $.map(data, source_config[type].map);
        var expiration_time = source_config[type].expiration(d);
        var save_data = JSPLib.utility.dataCopy(d);
        JSPLib.storage.saveData(key, {value: save_data, expires: GetExpiration(expiration_time)});
        if (source_config[type].fixupexpiration && d.length) {
            setTimeout(()=>{FixExpirationCallback(key, save_data, save_data[0].value, type);}, callback_interval);
        }
        ProcessSourceData(type,metatag,term,d,resp);
    });
}

function AnySourceIndexed(keycode,default_metatag='') {
    var type = source_key[keycode];
    return async function (req, resp, input_metatag) {
        var term = (req.term ? req.term : req);
        var key = (keycode + "-" + term).toLowerCase();
        var use_metatag = (input_metatag ? input_metatag : default_metatag);
        var cached = await JSPLib.storage.checkLocalDB(key,ValidateEntry);
        if (cached) {
            ProcessSourceData(type, use_metatag, term, cached.value, resp);
            return;
        }
        NetworkSource(type, key, term, resp, use_metatag);
    }
}

function ProcessSourceData(type,metatag,term,data,resp) {
    if (source_config[type].fixupmetatag) {
        $.each(data, (i,val)=> {FixupMetatag(val,metatag);});
    }
    KeepSourceData(type, metatag, data);
    MoveAliases(type, data)
    AddUserSelected(type, metatag, term, data);
    resp(data);
}

//Non-autocomplete storage

function CommonBindIndexed(button_name, category) {
    $(button_name).click(async (e)=>{
        var $dest = $("#related-tags");
        $dest.empty();
        Danbooru.RelatedTag.build_recent_and_frequent($dest);
        $dest.append("<em>Loading...</em>");
        $("#related-tags-container").show();
        var currenttag = $.trim(Danbooru.RelatedTag.current_tag());
        var keymodifier = (category.length ? JSPLib.danbooru.getShortName(category) : "");
        var key = ("rt" + keymodifier + "-" + currenttag).toLowerCase();
        var cached = await JSPLib.storage.checkLocalDB(key,ValidateEntry);
        if (cached) {
            Danbooru.RelatedTag.process_response(cached.value);
        } else {
            JSPLib.debug.debuglog("Querying relatedtag:",currenttag,category);
            var data = await JSPLib.danbooru.submitRequest("related_tag", {query: currenttag, category: category});
            JSPLib.storage.saveData(key, {value: data, expires: Date.now() + MinimumExpirationTime('relatedtag')});
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
    let bounditems = $._data($("#related-tags-button")[0]);
    JSPLib.debug.debuglog("Bound items (RT):",Object.keys(bounditems));
    if (!$.isEmptyObject(bounditems) && bounditems.events.click.length) {
        clearInterval(rebindRelatedTags.timer);
        $("#related-tags-button").off();
        CommonBindIndexed("#related-tags-button", "");
        var related_buttons = ['general','artist','character','copyright'];
        $.each(related_buttons, (i,category)=>{
            $(`#related-${category}-button`).off();
            CommonBindIndexed("#related-" + category + "-button", category);
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
        $("#find-artist-button").click(FindArtistSession);
        rebindFindArtist.timer = true;
    }
}

function rebindAnyAutocomplete(selector, keycode) {
    var $fields = $(selector);
    if ($fields.length && ('uiAutocomplete' in $.data($fields[0]))) {
        clearInterval(rebindAnyAutocomplete.timer[keycode]);
        $fields.off().removeData();
        InitializeAutocompleteIndexed(selector, keycode);
    }
}
rebindAnyAutocomplete.timer = {};

function setRebindInterval(selector, keycode, alt_choose) {
    rebindAnyAutocomplete.timer[keycode] = setInterval(()=>{rebindAnyAutocomplete(selector,keycode,alt_choose)},timer_poll_interval);
}

//Initialization functions

function InitializeAutocompleteIndexed(selector, keycode) {
    let type = source_key[keycode];
    var $fields = $(selector);
    $fields.autocomplete({
        minLength: 1,
        delay: 100,
        source: AnySourceIndexed(keycode),
        search: function() {
            $(this).data("uiAutocomplete").menu.bindings = $();
        },
        select: function(event,ui) {
            InsertUserSelected(keycode, this, ui.item);
            return ui.item.value;
        }
    });
    if (source_config[type].render) {
        $fields.each((i, field)=>{
            $(field).data("uiAutocomplete")._renderItem = source_config[type].render;
        });
    }
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
        channel: new BroadcastChannel('IndexedAutocomplete')
    };
    Danbooru.IAC.channel.onmessage = UsageBroadcast;
    CorrectUsageData();
    PruneUsageData();
    Danbooru.Autocomplete.normal_source = AnySourceIndexed('ac');
    Danbooru.Autocomplete.pool_source = AnySourceIndexed('pl');
    Danbooru.Autocomplete.user_source = AnySourceIndexed('us');
    Danbooru.Autocomplete.favorite_group_source = AnySourceIndexed('fg');
    Danbooru.Autocomplete.saved_search_source = AnySourceIndexed('ss','search');
    Danbooru.Autocomplete.insert_completion = HijackFunction(Danbooru.Autocomplete.insert_completion,InsertUserSelected);
    Danbooru.Autocomplete.render_item = HijackFunction(Danbooru.Autocomplete.render_item,HighlightSelected);
    if ($("#c-posts #a-show,#c-uploads #a-new").length) {
        rebindRelatedTags.timer = setInterval(rebindRelatedTags,timer_poll_interval);
        rebindFindArtist.timer = setInterval(rebindFindArtist,timer_poll_interval);
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
        InitializeAutocompleteIndexed("#saved_search_label_string",'ss');
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
    if ($('[data-autocomplete="tag"]').length) {
        setRebindInterval('[data-autocomplete="tag"]', 'ac');
    }
    if ($(autocomplete_userlist.join(',')).length) {
        InitializeAutocompleteIndexed(autocomplete_userlist.join(','), 'us');
    }
    if ($('[placeholder="Search users"]').length) {
        InitializeAutocompleteIndexed("#search_name_matches,#quick_search_name_matches", 'us');
    }
    DebugExecute(()=>{
        window.addEventListener('beforeunload', ()=>{
            JSPLib.statistics.outputAdjustedMean("IndexedAutocomplete");
        });
    });
    //Take care of other non-critical tasks at a later time
    setTimeout(()=>{
        PruneIACEntries();
    },JSPLib.utility.one_minute);
}

/***Execution start***/

JSPLib.load.programInitialize(main,'IAC',program_load_required_variables);
