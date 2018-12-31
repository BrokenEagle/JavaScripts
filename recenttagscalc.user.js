// ==UserScript==
// @name         RecentTagsCalc
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      2.0
// @source       https://danbooru.donmai.us/users/23799
// @description  Use different mechanism to calculate RecentTags
// @author       BrokenEagle
// @match        *://*.donmai.us/uploads/new*
// @match        *://*.donmai.us/posts/*
// @match        *://*.donmai.us/users/*/edit
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/recenttagscalc.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.5.2/localforage.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.12.0/validate.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/menu.js
// ==/UserScript==

/***Global variables***/

//Variables for debug.js
JSPLib.debug.debug_console = true;
JSPLib.debug.pretext = "RTC:";
JSPLib.debug.pretimer = "RTC-";
JSPLib.debug.level = JSPLib.debug.INFO;

//Variables for load.js
const program_load_required_variables = ['window.jQuery','window.Danbooru'];
const program_load_required_selectors = ['#page'];

//For factory reset
const localstorage_keys = [
    'rtc-recent-tags'
];
const program_reset_keys = {
    recent_tags:[]
};

//Regex that matches the prefix of all program cache data
const program_cache_regex = /^(?:ta|tag)-/;

//Expirations
const tag_expires = JSPLib.utility.one_week;
const tagalias_expires = JSPLib.utility.one_month;
const prune_expires = JSPLib.utility.one_day;

//Tag regexes
const negative_regex = /^-/;
const metatags_regex = /^(?:rating|-?parent|source|-?locked|-?pool|newpool|-?fav|child|-?favgroup|upvote|downvote):/i;
const striptype_regex = /^(-?)(?:general:|gen:|artist:|art:|copyright:|copy:|co:|character:|char:|ch:|meta:)?(.*)/i;

//Misc tag categories
const alias_tag_category = 100;
const deleted_tag_category = 200;

let program_css = `
.category-2 a:link,
.category-2 a:visited {
    color: darkgoldenrod;
    font-weight: bold;
}
.category-2 a:hover {
    color: goldenrod;
    font-weight: bold;
}
.category-${alias_tag_category} a:link,
.category-${alias_tag_category} a:visited {
    color: #0CC;
    font-weight: bold;
}
.category-${alias_tag_category} a:hover {
    color: aqua;
    font-weight: bold;
}
.category-${deleted_tag_category} a:link,
.category-${deleted_tag_category} a:visited {
    color: black;
    background-color: red;
    font-weight: bold;
}
.category-${deleted_tag_category} a:hover {
    color: black;
    background-color: white;
    font-weight: bold;
}
`;

//Menu values

const rtc_menu = `
<div id="rtc-settings" class="jsplib-outer-menu">
    <div id="rtc-script-message" class="prose">
        <h2>RecentTagsCalc</h2>
        <p>Check the forum for the latest on information and updates (TO BE ADDED LATER).</p>
    </div>
    <div id="rtc-order-settings" class="jsplib-settings-grouping">
        <div id="rtc-order-message" class="prose">
            <h4>Order settings</h4>
            <ul>
                <li><b>Uploads order:</b> Sets the order to use on tags from an upload.</li>
                <li><b>Post edits order:</b> Sets the order to use on tags from a post edit.</li>
                <li><b>Metatags first:</b> Sets the post count high for metatags.
                    <ul>
                        <li><i>Only effective with the post count order.</i></li>
                    </ul>
                </li>
                <li><b>Aliases first:</b> Sets the post count high for aliases.
                    <ul>
                        <li><i>Only effective with the post count order.</i></li>
                    </ul>
                </li>
            </ul>
            <span><i><b>Note:</b> With post count, metatags are rated higher than aliases.</i></span>
            <div style="margin-left:0.5em">
                <h5>Order types</h5>
                <ul>
                    <li><b>Alphabetic</b></li>
                    <li><b>Form order:</b> The order of tags in the tag edit box.</li>
                    <li><b>Post count:</b> Highest to lowest.
                        <ul>
                            <li><i>Not implemented yet.</i></li>
                        </ul>
                    </li>
                    <li><b>Category:</b> Tag category.
                        <ul>
                            <li><i>Not implemented yet.</i></li>
                        </ul>
                    </li>
                    <li><b>Tag usage:</b> Ordered by recent tag usage.
                        <ul>
                            <li><i>Not implemented yet.</i></li>
                        </ul>
                    </li>
                </ul>
            </div>
        </div>
    </div>
    <div id="rtc-list-settings" class="jsplib-settings-grouping">
        <div id="rtc-list-message" class="prose">
            <h4>List settings</h4>
            <ul>
                <li><b>Maximum tags:</b> The number of recent tags to show.</li>
                <li><b>List type:</b> How to store tags after each upload/edit.</li>
            </ul>
            <div style="margin-left:0.5em">
                <h5>List types</h5>
                <ul>
                    <li><b>Queue:</b> First in, first out.</li>
                    <li><b>Single:</b> Only the tags from the last upload/edit.</li>
                    <li><b>Multiple:</b> Each upload/edit gets its own list.
                        <ul>
                            <li><i>Not implemented yet.</i></li>
                        </ul>
                    </li>
                </ul>
            </div>
        </div>
    </div>
    <div id="rtc-inclusion-settings" class="jsplib-settings-grouping">
        <div id="rtc-inclusion-message" class="prose">
            <h4>Inclusion settings</h4>
            <ul>
                <li><b>Maximum tags:</b> The number of recent tags to show.</li>
                <li><b>Include metatags:</b> Does not filter out metatags.</li>
                <li><b>Include unchanged tags:</b> Does not filter out unchanged tags.</li>
                <li><b>Include removed tags:</b> Does not filter out removed tags.
                    <ul>
                        <li>This includes both tags removed through deletion and through negative tags.</li>
                        <li>When <b>form order</b> is being used, tag deletions get appended onto the new set of recent tags.</li>
                    </ul>
                </li>
                <li><b>Include deleted tags:</b> Filters out unaliased tags with a post count of 0.</li>
            </ul>
        </div>
    </div>
    <div id="rtc-cache-settings" class="jsplib-settings-grouping">
        <div id="rtc-cache-message" class="prose">
            <h4>Cache settings</h4>
            <h5>Cache data</h5>
            <ul>
                <li><b>Tag aliases:</b> Used to determine which tags are aliases or deleted.</li>
                <li><b>Tag data:</b> Used to determine a tag's post count and category.</li>
            </ul>
            <h5>Cache controls</h5>
            <ul>
                <li><b>Purge cache:</b> Dumps all of the cached data related to RecentTagsCalc.</li>
            </ul>
        </div>
    </div>
    <hr>
    <div id="rtc-settings-buttons" class="jsplib-settings-buttons">
        <input type="button" id="rtc-commit" value="Save">
        <input type="button" id="rtc-resetall" value="Factory Reset">
    </div>
</div>`;

const order_types = ['alphabetic','form_order','post_count','category','tag_usage'];
const disabled_order_types = ['category','tag_usage'];
const list_types = ['queue','single','multiple'];
const disabled_list_types = ['multiple'];

const settings_config = {
    uploads_order: {
        allitems: order_types,
        default: ['form_order'],
        validate: (data)=>{return Array.isArray(data) && data.length === 1 && order_types.includes(data[0])},
        hint: "Select the type of order to be applied on tags from an upload."
    },
    post_edits_order: {
        allitems: order_types,
        default: ['alphabetic'],
        validate: (data)=>{return Array.isArray(data) && data.length === 1 && order_types.includes(data[0])},
        hint: "Select the type of order to be applied on tags from a post edit."
    },
    metatags_first: {
        default: true,
        validate: (data)=>{return typeof data === "boolean";},
        hint: "Uncheck to turn off."
    },
    aliases_first: {
        default: true,
        validate: (data)=>{return typeof data === "boolean";},
        hint: "Uncheck to turn off."
    },
    list_type: {
        allitems: list_types,
        default: ['queue'],
        validate: (data)=>{return Array.isArray(data) && data.length === 1 && list_types.includes(data[0])},
        hint: "Select the type of list to use when adding recent tags."
    },
    maximum_tags: {
        default: 25,
        parse: parseInt,
        validate: (data)=>{return Number.isInteger(data) && data > 0;},
        hint: "Number of tags to show."
    },
    include_metatags: {
        default: true,
        validate: (data)=>{return typeof data === "boolean";},
        hint: "Uncheck to turn off."
    },
    include_unchanged_tags: {
        default: true,
        validate: (data)=>{return typeof data === "boolean";},
        hint: "Uncheck to turn off."
    },
    include_removed_tags: {
        default: false,
        validate: (data)=>{return typeof data === "boolean";},
        hint: "Check to turn on."
    },
    include_deleted_tags: {
        default: false,
        validate: (data)=>{return typeof data === "boolean";},
        hint: "Check to turn on."
    }
}

//Validation values

const relation_constraints = {
    entry: JSPLib.validate.arrayentry_constraints,
    value: JSPLib.validate.stringonly_constraints
};

const tag_constraints = {
    entry: JSPLib.validate.hashentry_constraints,
    value: {
        category: JSPLib.validate.inclusion_constraints([0,1,2,3,4,5,alias_tag_category,deleted_tag_category]),
        postcount: JSPLib.validate.counting_constraints,
        is_alias: JSPLib.validate.boolean_constraints,
        is_deleted: JSPLib.validate.boolean_constraints
    }
}

/***functions***/

//Validation functions

function ValidateEntry(key,entry) {
    if (!JSPLib.validate.validateIsHash(key,entry)) {
        return false
    }
    if (key.match(/^tag-/)) {
        return ValidateTagEntry(key,entry);
    } else if (key.match(/^ta-/)) {
        return ValidateRelationEntry(key,entry);
    }
    JSPLib.debug.debuglog("Shouldn't get here");
    return false;
}

function ValidateTagEntry(key,entry) {
    let check = validate(entry,tag_constraints.entry);
    if (check !== undefined) {
        JSPLib.validate.printValidateError(key,check);
        return false;
    }
    check = validate(entry.value,tag_constraints.value);
    if (check !== undefined) {
        JSPLib.validate.printValidateError(key,check);
        return false;
    }
    return true;
}

function ValidateRelationEntry(key,entry) {
    if (!JSPLib.validate.validateIsHash(key,entry)) {
        return false
    }
    let check = validate(entry,relation_constraints.entry);
    if (check !== undefined) {
        JSPLib.validate.printValidateError(key,check);
        return false
    }
    return JSPLib.validate.validateArrayValues(key + '.value', entry.value, relation_constraints.value);
}

//Library functions

async function BatchStorageCheck(keyarray,validator,expires) {
    let promise_array = [];
    keyarray.forEach((key)=>{
        promise_array.push(JSPLib.storage.checkLocalDB(key,validator,expires));
    });
    let result_array = await Promise.all(promise_array);
    let missing_array = [];
    result_array.forEach((result,i)=>{
        if (!result) {
            missing_array.push(keyarray[i]);
        }
    });
    return missing_array;
}

//Menu functions

function RenderSettingsMenu() {
    $("#recent-tags-calc").append(rtc_menu);
    $("#rtc-order-settings").append(JSPLib.menu.renderInputSelectors("rtc",'uploads_order','radio'));
    $("#rtc-order-settings").append(JSPLib.menu.renderInputSelectors("rtc",'post_edits_order','radio'));
    $("#rtc-order-settings").append(JSPLib.menu.renderCheckbox("rtc",'metatags_first'));
    $("#rtc-order-settings").append(JSPLib.menu.renderCheckbox("rtc",'aliases_first'));
    $("#rtc-list-settings").append(JSPLib.menu.renderInputSelectors("rtc",'list_type','radio'));
    $("#rtc-list-settings").append(JSPLib.menu.renderTextinput("rtc",'maximum_tags',5));
    $("#rtc-inclusion-settings").append(JSPLib.menu.renderCheckbox("rtc",'include_metatags'));
    $("#rtc-inclusion-settings").append(JSPLib.menu.renderCheckbox("rtc",'include_unchanged_tags'));
    $("#rtc-inclusion-settings").append(JSPLib.menu.renderCheckbox("rtc",'include_removed_tags'));
    $("#rtc-inclusion-settings").append(JSPLib.menu.renderCheckbox("rtc",'include_deleted_tags'));
    $("#rtc-cache-settings").append(JSPLib.menu.renderLinkclick("rtc",'purge_cache',`Purge cache (<span id="rtc-purge-counter">...</span>)`,"Click to purge"));
    JSPLib.menu.engageUI('rtc',true);
    disabled_order_types.forEach((type)=>{
        $(`#rtc-select-uploads-order-${type}`).checkboxradio("disable");
        $(`#rtc-select-post-edits-order-${type}`).checkboxradio("disable");
    });
    disabled_list_types.forEach((type)=>{
        $(`#rtc-select-list-type-${type}`).checkboxradio("disable");
    });
    JSPLib.menu.saveUserSettingsClick('rtc','RecentTagsCalc');
    JSPLib.menu.resetUserSettingsClick('rtc','RecentTagsCalc',localstorage_keys,program_reset_keys);
    JSPLib.menu.purgeCacheClick('rtc','RecentTagsCalc',program_cache_regex,"#rtc-purge-counter");
}

function BroadcastRTC(ev) {
    JSPLib.debug.debuglog(`BroadcastChannel (${ev.data.type}):`, ev.data);
    if (ev.data.type === "settings") {
        Danbooru.RTC.user_settings = ev.data.user_settings;
        Danbooru.RTC.tag_order = GetTagOrderType();
    } else if (ev.data.type === "reset") {
        Danbooru.RTC.user_settings = ev.data.user_settings;
        Danbooru.RTC.tag_order = GetTagOrderType();
        Object.assign(Danbooru.RTC,program_reset_keys);
    } else if (ev.data.type === "purge") {
        $.each(sessionStorage,(key)=>{
            if (key.match(program_cache_regex)) {
                sessionStorage.removeItem(key);
            }
        });
    }
}

//Auxiliary functions

function GetTagList() {
    return JSPLib.utility.filterEmpty(StripQuoteSourceMetatag($("#upload_tag_string,#post_tag_string").val()).split(/[\s\n]+/).map(tag=>{return tag.toLowerCase();}));
}

function StripQuoteSourceMetatag(str) {
    return str.replace(/source:"[^"]+"\s?/g,'');
}

function GetNegativetags(array) {
    return JSPLib.utility.filterRegex(array,negative_regex,false).map((value)=>{return value.substring(1);});
}

function FilterMetatags(array) {
    return JSPLib.utility.filterRegex(array,metatags_regex,true);
}

function NormalizeTags(array) {
    return array.map((entry)=>{return entry.replace(/^-/,'')});
}

function TransformTypetags(array) {
    return array.map((value)=>{return value.match(striptype_regex).splice(1).join('');});
}

function GetCurrentTags() {
    let tag_list = GetTagList();
    if (!Danbooru.RTC.user_settings.include_metatags) {
        tag_list = JSPLib.utility.filterRegex(GetTagList(),metatags_regex,true);
    }
    return TransformTypetags(tag_list);
}

function GetTagCategory(tag) {
    let tag_data = GetTagData(tag);
    if (!tag_data) {
        return 0;
    }
    return tag_data.category;
}

function GetTagData(tag) {
    if (tag.match(metatags_regex)) {
        let postcount = (Danbooru.RTC.user_settings.metatags_first ? 2000000000 : 0)
        return {postcount:postcount,category:2};
    }
    if (!(tag in Danbooru.RTC.tag_data)) {
        Danbooru.RTC.tag_data[tag] = JSPLib.storage.getStorageData('tag-'+tag,sessionStorage).value;
    }
    if (Danbooru.RTC.tag_data[tag].is_alias) {
        Danbooru.RTC.tag_data[tag].category = 100;
        Danbooru.RTC.tag_data[tag].postcount = (Danbooru.RTC.user_settings.aliases_first ? 1000000000 : 0);
    } else if (Danbooru.RTC.tag_data[tag].is_deleted) {
        Danbooru.RTC.tag_data[tag].category = deleted_tag_category;
    }
    return Danbooru.RTC.tag_data[tag];
}

//Display functions

async function DisplayRecentTags() {
    await Danbooru.RTC.pageload_tagcheck;
    let $tag_column = $(".recent-related-tags-column");
    let html = RenderRecentTags();
    $tag_column.html(html);
    $tag_column.removeClass("is-empty-true").addClass("is-empty-false");
    Danbooru.RelatedTag.update_selected();
}

function RenderRecentTags() {
    let html = "";
    Danbooru.RTC.recent_tags.forEach((tag)=>{
        let category = GetTagCategory(tag);
        let search_link = JSPLib.danbooru.postSearchLink(tag,tag.replace(/_/g,' '),`class="search-tag"`);
        html += `    <li class="category-${category}">${search_link}</li>\n`;
    });
    return `
<h6>Recent</h6>
<ul>
${html.slice(0,-1)}
</ul>
`;
}

//Setup functions

function GetTagOrderType() {
    if (Danbooru.RTC.is_upload) {
        return Danbooru.RTC.user_settings.uploads_order[0];
    } else {
        return Danbooru.RTC.user_settings.post_edits_order[0];
    }
}

function SetFormSubmit() {
    $("#form").submit((e)=>{
        CaptureTagSubmission();
        JSPLib.storage.setStorageData('rtc-recent-tags',Danbooru.RTC.recent_tags,localStorage);
    });
}

function SetupMutationObserver() {
    return new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type == "childList" && mutation.removedNodes.length === 1 && mutation.removedNodes[0].className === "user-related-tags-columns") {
                JSPLib.debug.debuglog("Server: User related tags have been added!");
                DisplayRecentTags();
                Danbooru.RTC.mutation_observer.disconnect();
            }
        });
    });
}

//Main execution functions

function CaptureTagSubmission(submit=true) {
    let RTC = Danbooru.RTC;
    RTC.postedittags = GetCurrentTags();
    RTC.new_recent_tags = NormalizeTags(RTC.postedittags);
    RTC.positivetags = JSPLib.utility.filterRegex(RTC.postedittags,negative_regex,true);
    RTC.negativetags = GetNegativetags(RTC.postedittags);
    RTC.userremovetags = JSPLib.utility.setDifference(RTC.preedittags,RTC.positivetags);
    RTC.removedtags = JSPLib.utility.setUnion(RTC.userremovetags,RTC.negativetags);
    RTC.unchangedtags = JSPLib.utility.setDifference(JSPLib.utility.setIntersection(RTC.preedittags,RTC.positivetags),RTC.negativetags);
    if (!RTC.user_settings.include_unchanged_tags) {
        RTC.new_recent_tags = JSPLib.utility.setDifference(RTC.new_recent_tags,RTC.unchangedtags);
    }
    if (!RTC.user_settings.include_removed_tags) {
        RTC.new_recent_tags = JSPLib.utility.setDifference(RTC.new_recent_tags,RTC.removedtags);
    } else {
        RTC.new_recent_tags = RTC.new_recent_tags.concat(RTC.userremovetags);
    }
    switch(RTC.tag_order) {
        case "alphabetic":
            RTC.new_recent_tags.sort();
            break;
        case "post_count":
            JSPLib.storage.setStorageData('rtc-new-recent-tags',RTC.new_recent_tags,localStorage);
            RTC.new_recent_tags = RTC.recent_tags;
            break;
        case "form_order":
        default:
            //Do nothing
    }
    JSPLib.debug.debuglog("New recent tags:",RTC.new_recent_tags);
    if(submit) {
        AddRecentTags(RTC.new_recent_tags);
    }
}

async function CheckAllRecentTags() {
    JSPLib.debug.debugTime("CheckAllRecentTags");
    let RTC = Danbooru.RTC;
    let promise_array = [];
    RTC.saved_recent_tags = [];
    let tag_list = FilterMetatags(RTC.recent_tags);
    if (RTC.tag_order === "post_count") {
        RTC.saved_recent_tags = JSPLib.storage.getStorageData('rtc-new-recent-tags',localStorage,[]);
        tag_list = JSPLib.utility.setUnion(tag_list,FilterMetatags(RTC.saved_recent_tags));
    }
    let keyarray = tag_list.map((value)=>{return 'tag-' + value;});
    JSPLib.debug.debugTime("BatchStorageCheck");
    RTC.missing_keys = await BatchStorageCheck(keyarray,ValidateEntry,tag_expires);
    JSPLib.debug.debugTimeEnd("BatchStorageCheck");
    if (RTC.missing_keys.length) {
        RTC.missing_array = RTC.missing_keys.map((key)=>{return key.replace(/^tag-/,'');});
        let tag_query = RTC.missing_array.join(',');
        let queried_tags = await JSPLib.danbooru.getAllItems('tags',100,{addons:{search:{name:tag_query,hide_empty:'no'}}});
        queried_tags.forEach((tagentry)=>{
            let entryname = 'tag-' + tagentry.name;
            let value = {
                category: tagentry.category,
                postcount: tagentry.post_count,
                is_alias: tagentry.post_count === 0,
                is_deleted: false
            };
            RTC.tag_data[tagentry.name] = value;
            promise_array.push(JSPLib.storage.saveData(entryname, {value: value, expires: Date.now() + tag_expires}));
        });
        RTC.unfound_tags = JSPLib.utility.setDifference(RTC.missing_array,JSPLib.utility.getObjectAttributes(queried_tags,'name'));
        JSPLib.debug.debuglog("Unfound tags:",RTC.unfound_tags);
        RTC.unfound_tags.forEach((tag)=>{
            let entryname = 'tag-' + tag;
            let value = {
                category: deleted_tag_category,
                postcount: 0,
                is_alias: false,
                is_deleted: true
            };
            RTC.tag_data[tag] = value;
            promise_array.push(JSPLib.storage.saveData(entryname, {value: value, expires: Date.now() + tag_expires}));
        });
    } else {
        JSPLib.debug.debuglog("No missing tags in DB!");
    }
    //Wait for all tag checks to save
    await Promise.all(promise_array);
    for (let tag in RTC.tag_data) {
        if (RTC.tag_data[tag].is_alias) {
            let alias_entryname = 'ta-' + tag;
            let promise_entry = JSPLib.storage.checkLocalDB(alias_entryname,ValidateEntry,tagalias_expires)
            .then((data)=>{
                JSPLib.debug.debuglog("Step 1: Check local DB for alias",data);
                if (data) {
                    return data;
                }
                return JSPLib.danbooru.submitRequest('tag_aliases',{search:{antecedent_name:tag,status:'active'}},[],alias_entryname)
                .then((data)=>{
                    JSPLib.debug.debuglog("Step 2 (optional): Check server for alias",data);
                    let savedata = {value: [], expires: Date.now() + tagalias_expires};
                    if (data.length) {
                        //Alias antecedents are unique, so no need to check the size
                        JSPLib.debug.debuglog("Alias:",tag,data[0].consequent_name);
                        savedata.value = [data[0].consequent_name];
                    }
                    JSPLib.debug.debuglog("Saving",alias_entryname,savedata);
                    return JSPLib.storage.saveData(alias_entryname,savedata);
                });
            })
            .then((data)=>{
                let tag_entryname = 'tag-' + tag;
                JSPLib.debug.debuglog("Step 3: Save tag data (if deleted)",data);
                if (data.value.length == 0) {
                    RTC.tag_data[tag].is_alias = false;
                    RTC.tag_data[tag].is_deleted = true;
                    let savedata = {value: RTC.tag_data[tag], expires: Date.now() + tag_expires};
                    JSPLib.debug.debuglog("Saving",tag_entryname,savedata);
                    return JSPLib.storage.saveData(tag_entryname,savedata);
                }
            });
            promise_array.push(promise_entry);
        }
    }
    //Wait for all alias checks to save
    await Promise.all(promise_array);
    if (!RTC.user_settings.include_deleted_tags) {
        JSPLib.debug.debugExecute(()=>{
            RTC.deleted_saved_recent_tags = RTC.saved_recent_tags.filter((tag)=>{return GetTagCategory(tag) === deleted_tag_category;});
            RTC.deleted_recent_tags = RTC.recent_tags.filter((tag)=>{return GetTagCategory(tag) === deleted_tag_category;});
            if (RTC.deleted_saved_recent_tags.length || RTC.deleted_recent_tags.length) {
                JSPLib.debug.debuglog("Deleting tags:",RTC.deleted_saved_recent_tags,RTC.deleted_recent_tags);
            }
        });
        RTC.saved_recent_tags = RTC.saved_recent_tags.filter((tag)=>{return GetTagCategory(tag) !== deleted_tag_category;});
        RTC.recent_tags = RTC.recent_tags.filter((tag)=>{return GetTagCategory(tag) !== deleted_tag_category;});
    }
    if (RTC.tag_order === "post_count" && RTC.saved_recent_tags.length) {
        RTC.saved_recent_tags.sort((a,b)=>{
            let a_data = GetTagData(a);
            let b_data = GetTagData(b);
            if (a_data.post_count === b_data.post_count) {
                return a.localeCompare(b);
            } else {
                return b_data.postcount - a_data.postcount;
            }
        });
        JSPLib.debug.debuglog("Saved recent tags:",RTC.saved_recent_tags);
    }
    localStorage.removeItem('rtc-new-recent-tags');
    //Do this each time incase recent tags were changed
    AddRecentTags(RTC.saved_recent_tags);
    JSPLib.debug.debugTimeEnd("CheckAllRecentTags");
}

function AddRecentTags(newtags) {
    let RTC = Danbooru.RTC;
    switch (RTC.user_settings.list_type[0]) {
        case "single":
            RTC.recent_tags = newtags;
            break;
        case "queue":
        default:
            RTC.recent_tags = JSPLib.utility.setUnion(newtags,RTC.recent_tags);
    }
    RTC.recent_tags = RTC.recent_tags.slice(0,RTC.user_settings.maximum_tags);
    JSPLib.storage.setStorageData('rtc-recent-tags',RTC.recent_tags,localStorage);
}

//Main function

function main() {
    Danbooru.RTC = {
        settings_config: settings_config,
        channel: new BroadcastChannel('RecentTagsCalc'),
        tag_data: {}
    };
    Danbooru.RTC.user_settings = JSPLib.menu.loadUserSettings('rtc');
    Danbooru.RTC.channel.onmessage = BroadcastRTC;
    if ($("#c-users #a-edit").length) {
        JSPLib.utility.installScript("https://cdn.jsdelivr.net/gh/jquery/jquery-ui@1.12.1/ui/widgets/tabs.js").done(()=>{
            JSPLib.menu.installSettingsMenu("RecentTagsCalc");
            RenderSettingsMenu();
        });
        return;
    }
    Danbooru.RTC.tag_order = GetTagOrderType();
    Danbooru.RTC.preedittags = GetTagList();
    Danbooru.RTC.is_upload = Boolean($("#c-uploads #a-new").length);
    Danbooru.RTC.recent_tags = JSPLib.storage.getStorageData('rtc-recent-tags',localStorage,[]);
    Danbooru.RTC.pageload_tagcheck = CheckAllRecentTags();
    SetFormSubmit();
    if ($(".recent-related-tags-column").length) {
        DisplayRecentTags();
    } else {
        Danbooru.RTC.mutation_observer = SetupMutationObserver();
        Danbooru.RTC.mutation_observer.observe($(".related-tags")[0], {
            childList: true
        });
    }
    JSPLib.utility.setCSSStyle(program_css,'program');
    setTimeout(()=>{
        JSPLib.storage.pruneEntries('rtc',program_cache_regex,prune_expires);
    },JSPLib.utility.one_minute);
}

JSPLib.load.programInitialize(main,'RTC',program_load_required_variables,program_load_required_selectors);
