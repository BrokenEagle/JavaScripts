// ==UserScript==
// @name         RecentTagsCalc
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      5.0
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
JSPLib.debug.debug_console = false;
JSPLib.debug.pretext = "RTC:";
JSPLib.debug.pretimer = "RTC-";
JSPLib.debug.level = JSPLib.debug.INFO;

//Variables for load.js
const program_load_required_variables = ['window.jQuery','window.Danbooru'];
const program_load_required_selectors = ['#page'];

//Main program variable
var RTC;

//Regex that matches the prefix of all program cache data
const program_cache_regex = /^(?:ta|tag)-/;

//Main program expires
const prune_expires = JSPLib.utility.one_day;

//For factory reset
const localstorage_keys = [
    'rtc-recent-tags',
    'rtc-frequent-tags',
    'rtc-frequent-tags-expires'
];
const program_reset_keys = {
    recent_tags:[],
    frequent_tags:[],
    tag_data:{}
};

const order_types = ['alphabetic','form_order','post_count','category','tag_usage'];
const category_orders = ['general','artist','copyright','character','meta','alias','metatag'];
const disabled_order_types = ['tag_usage'];
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
    category_order: {
        allitems: category_orders,
        default: category_orders,
        validate: (data)=>{return Array.isArray(data) && JSPLib.utility.setSymmetricDifference(data,category_orders).length === 0},
        hint: "Drag and drop the categories to determine the group order."
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
    maximum_tag_groups: {
        default: 5,
        parse: parseInt,
        validate: (data)=>{return Number.isInteger(data) && data > 0;},
        hint: "Number of tag groups to store and show. Only affects the <b>Multiple</b> list type."
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
    },
    cache_frequent_tags: {
        default: true,
        validate: (data)=>{return typeof data === "boolean";},
        hint: "Check to turn off."
    }
}

//Misc tag categories
const alias_tag_category = 100;
const deleted_tag_category = 200;
const notfound_tag_category = 300;
const metatags_category = 400;
const category_name = {
    0: "general",
    1: "artist",
    3: "copyright",
    4: "character",
    5: "meta",
    [alias_tag_category]: "alias",
    [metatags_category]: "metatag",
    [deleted_tag_category]: "deleted"
};

//CSS Constants
let program_css = `
.rtc-user-related-tags-columns {
    display: flex;
}
.category-${metatags_category} a:link,
.category-${metatags_category} a:visited {
    color: darkgoldenrod;
    font-weight: bold;
}
.category-${metatags_category} a:hover {
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
.category-${notfound_tag_category} a {
    text-decoration: underline dotted grey;
}
`;

const menu_css = `
#rtc-settings .rtc-sortlist li {
    width: 6.5em;
}
#rtc-settings #rtc-order-type {
    padding-left: 0.5em;
    margin: 0.5em;
    width: 30em;
    border: lightgrey solid 1px;
}
`;

//HTML Constants

const usertag_columns_html = `
<div class="tag-column recent-related-tags-column is-empty-false"></div>
<div class="tag-column frequent-related-tags-column is-empty-false"></div>`;

const rtc_menu = `
<div id="rtc-settings" class="jsplib-outer-menu">
    <div id="rtc-script-message" class="prose">
        <h2>RecentTagsCalc</h2>
        <p>Check the forum for the latest on information and updates (<a class="dtext-link dtext-id-link dtext-forum-topic-id-link" href="/forum_topics/15851" style="color:#0073ff">topic #15851</a>).</p>
    </div>
    <div id="rtc-order-settings" class="jsplib-settings-grouping">
        <div id="rtc-order-message" class="prose">
            <h4>Order settings</h4>
            <ul>
                <li><b>Uploads order:</b> Sets the order to use on tags from an upload.</li>
                <li><b>Post edits order:</b> Sets the order to use on tags from a post edit.</li>
                <li><b>Metatags first:</b> Sets the post count high for metatags.
                    <ul>
                        <li><i>Only effective with the <u>post count</u> order type.</i></li>
                    </ul>
                </li>
                <li><b>Aliases first:</b> Sets the post count high for aliases.
                    <ul>
                        <li><i>Only effective with the <u>post count</u> order type.</i></li>
                    </ul>
                </li>
                <li><b>Category order:</b> Sets the order for the <u>category</u> order type.</li>
            </ul>
            <span><i><b>Note:</b> With <u>post count</u>, metatags are rated higher than aliases.</i></span>
            <div id="rtc-order-type">
                <h5>Order types</h5>
                <ul>
                    <li><b>Alphabetic</b></li>
                    <li><b>Form order:</b> The order of tags in the tag edit box.</li>
                    <li><b>Post count:</b> Highest to lowest.</li>
                    <li><b>Category:</b> Tag category.</li>
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
    <div id="rtc-frequent-settings" class="jsplib-settings-grouping">
        <div id="rtc-frequent-message" class="prose">
            <h4>Frequent tags settings</h4>
            <ul>
                <li><b>Cache frequent tags:</b> Saves the user's favorite tags locally.
                    <ul>
                        <li>Makes for quicker loading of recent/frequent tags.</li>
                        <li>Tags are automatically refreshed once a week.</li>
                    </ul>
                </li>
            </ul>
            <h5>Frequent tags controls</h5>
            <ul>
                <li><b>Refresh frequent tags:</b> Manually refreshes the frequent tags for <i>RecentTagsCalc</i>.</li>
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

//Expirations
const tag_expires = JSPLib.utility.one_week;
const tagalias_expires = JSPLib.utility.one_month;
const frequent_tags_expires = JSPLib.utility.one_week;
const process_semaphore_expires = JSPLib.utility.one_minute;

//Tag regexes
const negative_regex = /^-/;
const metatags_regex = /^(?:rating|-?parent|source|-?locked|-?pool|newpool|-?fav|child|-?favgroup|upvote|downvote):/i;
const striptype_regex = /^(-?)(?:general:|gen:|artist:|art:|copyright:|copy:|co:|character:|char:|ch:|meta:)?(.*)/i;

//For when new data has yet to be loaded by another tab
const default_tag_data = {
    category: notfound_tag_category,
    is_alias: false,
    is_deleted: false,
    postcount: 0
};

const deleted_tag_data = {
    category: deleted_tag_category,
    postcount: 0,
    is_alias: false,
    is_deleted: true
};

//Misc constants
const timer_poll_interval = 100;
const max_item_limit = 100;
const aliases_first_post_count = 1000000000;
const metatags_first_post_count = 2000000000;

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

function CheckTimeout(storage_key,expires_time) {
    let expires = JSPLib.storage.getStorageData(storage_key,localStorage,0);
    return !JSPLib.validate.validateExpires(expires,frequent_tags_expires);
}

function SetRecheckTimeout(storage_key,expires_time) {
    JSPLib.storage.setStorageData(storage_key,JSPLib.utility.getExpiration(expires_time),localStorage);
}

function CheckSemaphore(name) {
    let semaphore = JSPLib.storage.getStorageData(`rtc-process-semaphore-${name}`,localStorage,0);
    return !JSPLib.validate.validateExpires(semaphore, process_semaphore_expires);
}

function FreeSemaphore(name) {
    $(window).off(`beforeunload.rtc.semaphore.${name}`);
    JSPLib.storage.setStorageData(`rtc-process-semaphore-${name}`,0,localStorage);
}

function ReserveSemaphore(name) {
    if (CheckSemaphore(name)) {
        JSPLib.debug.debuglog(name + " - Tab got the semaphore !");
        //Guarantee that leaving/closing tab reverts the semaphore
        $(window).on(`beforeunload.rtc.semaphore.${name}`,()=>{
            JSPLib.storage.setStorageData('rtc-process-semaphore',0,localStorage);
        });
        //Set semaphore with an expires in case the program crashes
        let semaphore = JSPLib.utility.getExpiration(process_semaphore_expires);
        JSPLib.storage.setStorageData(`rtc-process-semaphore-${name}`, semaphore, localStorage);
        return semaphore;
    }
    JSPLib.debug.debuglog(name + " - Tab missed the semaphore !");
    return null;
}

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

function UpdateUserSettings(program_shortcut) {
    let program_key = program_shortcut.toUpperCase();
    let settings = Danbooru[program_key].user_settings;
    jQuery(`#${program_shortcut}-settings .${program_shortcut}-setting[id]`).each((i,entry)=>{
        let $input = jQuery(entry);
        let parent_level = $input.data('parent');
        let container = JSPLib.utility.getNthParent(entry,parent_level);
        let setting_name = jQuery(container).data('setting');
        if (entry.type === "checkbox" || entry.type === "radio") {
            let selector = $input.data('selector');
            if (selector) {
                $input.prop('checked', JSPLib.menu.isSettingEnabled(program_key,setting_name,selector));
                $input.checkboxradio("refresh");
            } else {
                $input.prop('checked', settings[setting_name]);
            }
        } else if (entry.type === "text") {
             $input.val(settings[setting_name]);
        } else if (entry.type === "hidden") {
            if (!$(container).hasClass("sorted")) {
                $("ul",container).sortable("destroy");
                let sortlist = $("li",container).detach();
                sortlist.sort((a, b)=>{
                    let sort_a = $("input",a).data('sort');
                    let sort_b = $("input",b).data('sort');
                    return settings[setting_name].indexOf(sort_a) - settings[setting_name].indexOf(sort_b);
                });
                sortlist.each((i,entry)=>{
                    $("ul",container).append(entry);
                });
                $("ul",container).sortable();
                $(container).addClass("sorted");
            }
        }
    });
    $(".jsplib-sortlist").removeClass("sorted");
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

function TagToKeyTransform(taglist) {
    return taglist.map((value)=>{return 'tag-' + value;});
}

function KeyToTagTransform(keylist) {
    return keylist.map((key)=>{return key.replace(/^tag-/,'');});
}

function GetCurrentTags() {
    let tag_list = GetTagList();
    if (!RTC.user_settings.include_metatags) {
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
        let postcount = (RTC.user_settings.metatags_first ? metatags_first_post_count : 0)
        return {postcount:postcount,category:metatags_category};
    }
    if (!(tag in RTC.tag_data) || RTC.tag_data[tag].category === notfound_tag_category) {
        RTC.tag_data[tag] = JSPLib.storage.getStorageData('tag-'+tag,sessionStorage,{value:default_tag_data}).value;
    }
    if (RTC.tag_data[tag].is_alias) {
        RTC.tag_data[tag].category = alias_tag_category;
        RTC.tag_data[tag].postcount = (RTC.user_settings.aliases_first ? aliases_first_post_count : 0);
    } else if (RTC.tag_data[tag].is_deleted) {
        RTC.tag_data[tag].category = deleted_tag_category;
    }
    return RTC.tag_data[tag];
}

//Display functions

function PinnedTagsClick() {
    $(".recent-related-tags-column .ui-icon").click((e)=>{
        $(e.target).toggleClass("ui-icon-radio-off ui-icon-pin-s");
        let tag_name = $(".search-tag",e.target.parentElement).text().replace(/\s/g,'_');
        RTC.pinned_tags = JSPLib.utility.setSymmetricDifference(RTC.pinned_tags,[tag_name]);
        JSPLib.storage.setStorageData('rtc-pinned-tags',RTC.pinned_tags,localStorage);
        RTC.channel.postMessage({type: "reload_recent", recent_tags: RTC.recent_tags, pinned_tags: RTC.pinned_tags, updated_pin_tag: tag_name});
    });
}

async function DisplayRecentTags() {
    await RTC.pageload_recentcheck;
    let $tag_column = $(".rtc-user-related-tags-columns .recent-related-tags-column");
    let html = RenderTaglist(RTC.recent_tags,"Recent",RTC.pinned_tags);
    if (RTC.user_settings.list_type[0] === "multiple") {
        let upload = 1, edit = 1;
        let shown_tags = JSPLib.utility.setUnion(RTC.recent_tags,RTC.pinned_tags);
        RTC.other_recent.forEach((recent_entry)=>{
            let title = (recent_entry.was_upload ? `Upload ${upload++}` : `Edit ${edit++}`);
            let display_tags = JSPLib.utility.setDifference(recent_entry.tags,shown_tags);
            if (display_tags.length) {
                html += RenderTaglist(display_tags,title,[]);
            }
            shown_tags = JSPLib.utility.setUnion(shown_tags,display_tags);
        });
    }
    $tag_column.html(html);
    $tag_column.removeClass("is-empty-true").addClass("is-empty-false");
    Danbooru.RelatedTag.update_selected();
    PinnedTagsClick();
}

async function DisplayFrequentTags() {
    await RTC.pageload_frequentcheck;
    let $tag_column = $(".rtc-user-related-tags-columns .frequent-related-tags-column");
    let html = RenderTaglist(RTC.frequent_tags,"Frequent");
    $tag_column.html(html);
    $tag_column.removeClass("is-empty-true").addClass("is-empty-false");
    Danbooru.RelatedTag.update_selected();
}

function RecheckAndDisplay(name) {
    BatchStorageCheck(TagToKeyTransform(FilterMetatags(RTC[name+'_tags'])),ValidateEntry,tag_expires)
    .then(()=>{
        switch(name) {
            case "recent":
                DisplayRecentTags();
                break;
            case "frequent":
                DisplayFrequentTags();
                break;
            default:
                //do nothing
        }
    });
}

function RecheckDisplaySemaphoreCallback(name) {
    if (CheckSemaphore(name)) {
        clearInterval(RecheckDisplaySemaphoreCallback.timers[name]);
        JSPLib.debug.debuglog("RecheckDisplaySemaphoreCallback:",name);
        RecheckAndDisplay(name);
    }
}
RecheckDisplaySemaphoreCallback.timers = {};

function SetRecheckDisplayInterval(name) {
    RecheckDisplaySemaphoreCallback.timers[name] = setInterval(()=>{RecheckDisplaySemaphoreCallback(name);},timer_poll_interval);
}

function RenderTaglines(taglist,addon) {
    return taglist.map((tag)=>{
        let category = GetTagCategory(tag);
        let search_link = JSPLib.danbooru.postSearchLink(tag,tag.replace(/_/g,' '),`class="search-tag"`);
        return `    <li class="category-${category}">${addon}${search_link}</li>\n`;
    }).join('');
}

function RenderTaglist(taglist,columnname,pinned_tags) {
    let html = "";
    if (pinned_tags && pinned_tags.length) {
        html += RenderTaglines(pinned_tags,`<a class="ui-icon ui-icon-pin-s" style="min-width:unset"></a>&thinsp;`);
        taglist = JSPLib.utility.setDifference(taglist,pinned_tags);
    }
    let pin_html = (pinned_tags ? `<a class="ui-icon ui-icon-radio-off" style="min-width:unset"></a>&thinsp;` :  '');
    html += RenderTaglines(taglist,pin_html);
    return `
<h6>${columnname}</h6>
<ul>
${html.slice(0,-1)}
</ul>
`;
}

//Setup functions

function SetFormSubmit() {
    $("#form").submit((e)=>{
        CaptureTagSubmission();
    });
}

function SetupMutationObserver() {
    return new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type == "childList" && mutation.removedNodes.length === 1 && mutation.removedNodes[0].className === "user-related-tags-columns") {
                JSPLib.debug.debuglog("Server: User related tags have been added!");
                DisplayRecentTags();
                RTC.mutation_observer.disconnect();
            }
        });
    });
}

function SetReloadFrequentTagsClick() {
    $("#rtc-setting-refresh-frequent-tags").click((e)=>{
        QueryFrequentTags();
        Danbooru.Utility.notice("RecentTagsCalc: Frequent tags reloaded!");
        e.preventDefault();
    });
}

//Main helper functions

async function CheckMissingTags(tag_list,list_name="") {
    let missing_keys = await BatchStorageCheck(TagToKeyTransform(tag_list),ValidateEntry,tag_expires);
    if (missing_keys.length) {
        JSPLib.debug.debuglog("CheckMissingTags: missing_keys",missing_keys);
        await QueryMissingTags(KeyToTagTransform(missing_keys));
    } else {
        JSPLib.debug.debuglog(`${list_name} - No missing tags in DB!`);
    }
    return missing_keys;
}

async function QueryMissingTags(missing_taglist) {
    let promise_array = [];
    let tag_query = missing_taglist.join(',');
    let queried_tags = await JSPLib.danbooru.getAllItems('tags',max_item_limit,{addons:{search:{name:tag_query,hide_empty:'no'}}});
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
    let unfound_tags = JSPLib.utility.setDifference(missing_taglist,JSPLib.utility.getObjectAttributes(queried_tags,'name'));
    JSPLib.debug.debuglog("QueryMissingTags: unfound_tags",unfound_tags);
    unfound_tags.forEach((tag)=>{
        let entryname = 'tag-' + tag;
        RTC.tag_data[tag] = deleted_tag_data;
        promise_array.push(JSPLib.storage.saveData(entryname, {value: deleted_tag_data, expires: Date.now() + tag_expires}));
    });
    return Promise.all(promise_array);
}

async function CheckTagDeletion() {
    let promise_array = [];
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
}

function FilterDeletedTags() {
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

function SortTagData(tag_list,type) {
    JSPLib.debug.debuglog("SortTagData (pre):",tag_list);
    if (type === "post_count") {
        tag_list.sort((a,b)=>{
            let a_data = GetTagData(a);
            let b_data = GetTagData(b);
            return b_data.postcount - a_data.postcount;
        });
    } else if (type === "category") {
        let category_order = RTC.user_settings.category_order.concat(['deleted']);
        tag_list.sort((a,b)=>{
            let a_data = GetTagCategory(a);
            let b_data = GetTagCategory(b);
            return category_order.indexOf(category_name[a_data]) - category_order.indexOf(category_name[b_data]);
        });
    }
    JSPLib.debug.debuglog("SortTagData (post):",tag_list);
}

//Main execution functions

////Recent tags

function CaptureTagSubmission(submit=true) {
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
        case "category":
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
    if (!ReserveSemaphore("recent")) {
        SetRecheckDisplayInterval("recent");
        return;
    }
    JSPLib.debug.debugTime("CheckAllRecentTags");
    let original_recent_tags = JSPLib.utility.dataCopy(RTC.recent_tags);
    RTC.saved_recent_tags = [];
    let tag_list = FilterMetatags(RTC.recent_tags);
    if (RTC.tag_order === "post_count" || RTC.tag_order === "category") {
        RTC.saved_recent_tags = JSPLib.storage.getStorageData('rtc-new-recent-tags',localStorage,[]);
        tag_list = JSPLib.utility.setUnion(tag_list,FilterMetatags(RTC.saved_recent_tags));
    }
    if (RTC.user_settings.list_type[0] === "multiple") {
        RTC.other_recent = JSPLib.storage.getStorageData('rtc-other-recent',localStorage,[]);
        RTC.other_recent.forEach((recent_entry)=>{
            tag_list = JSPLib.utility.setUnion(tag_list,recent_entry.tags);
        });
    }
    RTC.missing_recent_tags = await CheckMissingTags(tag_list,"Recent");
    await CheckTagDeletion();
    if (!RTC.user_settings.include_deleted_tags) {
        FilterDeletedTags();
    }
    if ((RTC.tag_order === "post_count" || RTC.tag_order === "category") && RTC.saved_recent_tags.length) {
        SortTagData(RTC.saved_recent_tags,RTC.tag_order);
    }
    localStorage.removeItem('rtc-new-recent-tags');
    if (JSPLib.utility.setSymmetricDifference(original_recent_tags,RTC.recent_tags).length || RTC.saved_recent_tags.length) {
        AddRecentTags(RTC.saved_recent_tags);
    }
    JSPLib.debug.debugTimeEnd("CheckAllRecentTags");
    FreeSemaphore("recent");
}

function AddRecentTags(newtags) {
    switch (RTC.user_settings.list_type[0]) {
        case "multiple":
            RTC.was_upload = JSPLib.storage.getStorageData('rtc-was-upload',localStorage,false);
            if (newtags.length && RTC.recent_tags.length) {
                RTC.other_recent.unshift({
                    was_upload: RTC.was_upload,
                    tags: RTC.recent_tags
                });
                RTC.other_recent = RTC.other_recent.slice(0,RTC.user_settings.maximum_tag_groups);
                JSPLib.storage.setStorageData('rtc-other-recent',RTC.other_recent,localStorage);
            }
            JSPLib.storage.setStorageData('rtc-was-upload',RTC.is_upload,localStorage);
        case "single":
            if (newtags.length) {
                RTC.recent_tags = newtags;
            }
            break;
        case "queue":
        default:
            RTC.recent_tags = JSPLib.utility.setUnion(newtags,RTC.recent_tags);
    }
    RTC.recent_tags = RTC.recent_tags.slice(0,RTC.user_settings.maximum_tags);
    JSPLib.storage.setStorageData('rtc-recent-tags',RTC.recent_tags,localStorage);
    RTC.channel.postMessage({type: "reload_recent", recent_tags: RTC.recent_tags, pinned_tags: RTC.pinned_tags, new_recent_tags: newtags});
}

////Frequent tags

async function LoadFrequentTags() {
    if (!RTC.userid) {
        //User must have an account to have frequent tags
        return;
    }
    RTC.frequent_tags = JSPLib.storage.getStorageData('rtc-frequent-tags',localStorage);
    if (RTC.frequent_tags === null || CheckTimeout('rtc-frequent-tags-expires',frequent_tags_expires)) {
        QueryFrequentTags();
    }
}

async function QueryFrequentTags() {
    let user_account = await JSPLib.danbooru.submitRequest('users/'+RTC.userid);
    if (!user_account) {
        //Should never get here, but just in case
        return;
    }
    RTC.frequent_tags = user_account.favorite_tags.split('\r\n').map((tag)=>{return tag.trim();});
    JSPLib.debug.debuglog("QueryFrequentTags:",RTC.frequent_tags);
    JSPLib.storage.setStorageData('rtc-frequent-tags',RTC.frequent_tags,localStorage);
    SetRecheckTimeout('rtc-frequent-tags-expires',frequent_tags_expires);
    RTC.channel.postMessage({type: "reload_frequent", frequent_tags: RTC.frequent_tags});
}

async function CheckAllFrequentTags() {
    await LoadFrequentTags();
    if (ReserveSemaphore("frequent")) {
        RTC.missing_frequent_keys = await CheckMissingTags(RTC.frequent_tags,"Frequent");
        FreeSemaphore("frequent");
    } else {
        SetRecheckDisplayInterval("frequent");
    }
}

//Settings functions

function BroadcastRTC(ev) {
    JSPLib.debug.debuglog(`BroadcastChannel (${ev.data.type}):`, ev.data);
    switch (ev.data.type) {
        case "reload_recent":
            RTC.pinned_tags = ev.data.pinned_tags;
            RTC.recent_tags = ev.data.recent_tags;
            !RTC.is_setting_menu && RecheckAndDisplay("recent");
            break;
        case "reload_frequent":
            RTC.frequent_tags = ev.data.frequent_tags;
            !RTC.is_setting_menu && RecheckAndDisplay("frequent");
            break;
        case "reset":
            Object.assign(RTC,program_reset_keys);
        case "settings":
            RTC.user_settings = ev.data.user_settings;
            RTC.tag_order = GetTagOrderType();
            RTC.is_setting_menu && UpdateUserSettings('rtc');
            break;
        case "purge":
            $.each(sessionStorage,(key)=>{
                if (key.match(program_cache_regex)) {
                    sessionStorage.removeItem(key);
                }
            });
        default:
            //do nothing
    }
}

function GetTagOrderType() {
    if (RTC.is_upload) {
        return RTC.user_settings.uploads_order[0];
    } else {
        return RTC.user_settings.post_edits_order[0];
    }
}

function RenderSettingsMenu() {
    $("#recent-tags-calc").append(rtc_menu);
    $("#rtc-order-settings").append(JSPLib.menu.renderInputSelectors("rtc",'uploads_order','radio'));
    $("#rtc-order-settings").append(JSPLib.menu.renderInputSelectors("rtc",'post_edits_order','radio'));
    $("#rtc-order-settings").append(JSPLib.menu.renderCheckbox("rtc",'metatags_first'));
    $("#rtc-order-settings").append(JSPLib.menu.renderCheckbox("rtc",'aliases_first'));
    $("#rtc-order-settings").append(JSPLib.menu.renderSortlist("rtc",'category_order'));
    $("#rtc-list-settings").append(JSPLib.menu.renderInputSelectors("rtc",'list_type','radio'));
    $("#rtc-list-settings").append(JSPLib.menu.renderTextinput("rtc",'maximum_tags',5));
    $("#rtc-inclusion-settings").append(JSPLib.menu.renderCheckbox("rtc",'include_metatags'));
    $("#rtc-inclusion-settings").append(JSPLib.menu.renderCheckbox("rtc",'include_unchanged_tags'));
    $("#rtc-inclusion-settings").append(JSPLib.menu.renderCheckbox("rtc",'include_removed_tags'));
    $("#rtc-inclusion-settings").append(JSPLib.menu.renderCheckbox("rtc",'include_deleted_tags'));
    $("#rtc-frequent-settings").append(JSPLib.menu.renderCheckbox("rtc",'cache_frequent_tags'));
    $("#rtc-frequent-settings").append(JSPLib.menu.renderLinkclick("rtc",'refresh_frequent_tags',"Refresh frequent tags","Click to refresh"));
    $("#rtc-cache-settings").append(JSPLib.menu.renderLinkclick("rtc",'purge_cache',`Purge cache (<span id="rtc-purge-counter">...</span>)`,"Click to purge"));
    JSPLib.menu.engageUI('rtc',true,true);
    disabled_order_types.forEach((type)=>{
        $(`#rtc-select-uploads-order-${type}`).checkboxradio("disable");
        $(`#rtc-select-post-edits-order-${type}`).checkboxradio("disable");
    });
    disabled_list_types.forEach((type)=>{
        $(`#rtc-select-list-type-${type}`).checkboxradio("disable");
    });
    SetReloadFrequentTagsClick();
    JSPLib.menu.saveUserSettingsClick('rtc','RecentTagsCalc');
    JSPLib.menu.resetUserSettingsClick('rtc','RecentTagsCalc',localstorage_keys,program_reset_keys);
    JSPLib.menu.purgeCacheClick('rtc','RecentTagsCalc',program_cache_regex,"#rtc-purge-counter");
}

//Main function

function main() {
    Danbooru.RTC = RTC = {
        userid: JSPLib.utility.getMeta("current-user-id"),
        is_setting_menu: Boolean($("#c-users #a-edit").length),
        settings_config: settings_config,
        channel: new BroadcastChannel('RecentTagsCalc'),
        tag_data: {}
    };
    RTC.user_settings = JSPLib.menu.loadUserSettings('rtc');
    RTC.channel.onmessage = BroadcastRTC;
    if (RTC.is_setting_menu) {
        JSPLib.utility.installScript("https://cdn.jsdelivr.net/gh/jquery/jquery-ui@1.12.1/ui/widgets/tabs.js").done(()=>{
            JSPLib.menu.installSettingsMenu("RecentTagsCalc");
            RenderSettingsMenu();
        });
        JSPLib.utility.setCSSStyle(menu_css,'menu');
        return;
    }
    RTC.tag_order = GetTagOrderType();
    RTC.preedittags = GetTagList();
    RTC.is_upload = Boolean($("#c-uploads #a-new").length);
    RTC.recent_tags = JSPLib.storage.getStorageData('rtc-recent-tags',localStorage,[]);
    RTC.pinned_tags = JSPLib.storage.getStorageData('rtc-pinned-tags',localStorage,[]);
    RTC.frequent_tags = [];
    RTC.pageload_recentcheck = CheckAllRecentTags();
    RTC.pageload_frequentcheck = CheckAllFrequentTags();
    SetFormSubmit();
    if (RTC.user_settings.cache_frequent_tags) {
        if ($("#c-posts #a-show").length) {
            Danbooru.RTC.cached_data = true;
            $(document).off("danbooru:show-related-tags");
            if (!Danbooru.IAC || !Danbooru.IAC.cached_data) {
                $(document).one("danbooru:show-related-tags", Danbooru.Upload.fetch_data_manual);
            } else {
                $(document).one("danbooru:show-related-tags", Danbooru.IAC.FindArtistSession);
            }
        }
        $(".user-related-tags-columns")
            .addClass("rtc-user-related-tags-columns")
            .removeClass("user-related-tags-columns")
            .html(usertag_columns_html);
        DisplayRecentTags();
        DisplayFrequentTags();
    } else if ($(".recent-related-tags-column").length) {
        DisplayRecentTags();
    } else {
        RTC.mutation_observer = SetupMutationObserver();
        RTC.mutation_observer.observe($(".related-tags")[0], {
            childList: true
        });
    }
    if (RTC.user_settings.list_type[0] !== "multiple") {
        localStorage.removeItem('rtc-other-recent');
        localStorage.removeItem('rtc-was-upload');
    }
    JSPLib.utility.setCSSStyle(program_css,'program');
    setTimeout(()=>{
        JSPLib.storage.pruneEntries('rtc',program_cache_regex,prune_expires);
    },JSPLib.utility.one_minute);
}

JSPLib.load.programInitialize(main,'RTC',program_load_required_variables,program_load_required_selectors);
