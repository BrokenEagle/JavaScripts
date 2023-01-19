// ==UserScript==
// @name         RecentTagsCalc
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      7.27
// @description  Use different mechanism to calculate RecentTags.
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        *://*.donmai.us/uploads/*
// @match        *://*.donmai.us/posts/*
// @match        *://*.donmai.us/settings
// @exclude      /^https?://\w+\.donmai\.us/.*\.(xml|json|atom)(\?|$)/
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/RecentTagsCalc.user.js
// @updateURL    https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/RecentTagsCalc.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.10.0/localforage.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.13.1/validate.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/module.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/concurrency.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20230118-menu/lib/menu.js
// ==/UserScript==

/* global JSPLib $ Danbooru */

/****Global variables****/

//Library constants

////NONE

//Exterior script variables
const DANBOORU_TOPIC_ID = '15851';

//Variables for load.js
const PROGRAM_LOAD_REQUIRED_VARIABLES = ['window.jQuery','window.Danbooru','Danbooru.CurrentUser'];
const PROGRAM_LOAD_OPTIONAL_SELECTORS = ['#c-uploads #a-show', '#c-upload-media-assets #a-show', '#c-posts #a-show', '#c-users #a-edit'];

//Program name constants
const PROGRAM_SHORTCUT = 'rtc';
const PROGRAM_CLICK = 'click.rtc';
const PROGRAM_NAME = 'RecentTagsCalc';

//Program data constants
const PROGRAM_DATA_REGEX = /^(ta|tag)-/; //Regex that matches the prefix of all program cache data
const PROGRAM_DATA_KEY = {
    tag_data: 'tag',
    tag_alias: 'ta'
};

//Main program variable
const RTC = {};

//For factory reset
const localstorage_keys = [
    'rtc-pinned-tags',
    'rtc-recent-tags',
    'rtc-other-recent',
    'rtc-frequent-tags',
    'rtc-frequent-tags-expires',
    'rtc-was-upload',
];
const PROGRAM_RESET_KEYS = {
    pinned_tags: [],
    recent_tags: [],
    other_recent: [],
    frequent_tags: [],
    tag_data: {},
};

const order_types = ['alphabetic','form_order','post_count','category','tag_usage'];
const category_orders = ['general','artist','copyright','character','meta','alias','metatag'];
const list_types = ['queue','single','multiple'];
const disabled_order_types = ['tag_usage'];

const SETTINGS_CONFIG = {
    uploads_order: {
        allitems: order_types,
        reset: ['form_order'],
        validate: (data) => JSPLib.menu.validateCheckboxRadio(data, 'radio', order_types),
        hint: "Select the type of order to be applied on recent tags from an upload."
    },
    post_edits_order: {
        allitems: order_types,
        reset: ['alphabetic'],
        validate: (data) => JSPLib.menu.validateCheckboxRadio(data, 'radio', order_types),
        hint: "Select the type of order to be applied on recent tags from a post edit."
    },
    metatags_first: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Sets the post count high for metatags. Only effective with the <b>Post Count</b> order type."
    },
    aliases_first: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Sets the post count high for aliases. Only effective with the <b>Post Count</b> order type."
    },
    category_order: {
        allitems: category_orders,
        reset: category_orders,
        sortvalue: true,
        validate: (data) => JSPLib.utility.arrayEquals(data, category_orders),
        hint: "Drag and drop the categories to determine the group order for the <b>Category</b> order type."
    },
    list_type: {
        allitems: list_types,
        reset: ['queue'],
        validate: (data) => JSPLib.menu.validateCheckboxRadio(data, 'radio', list_types),
        hint: "Select how to store tags after each upload/edit."
    },
    maximum_tags: {
        reset: 25,
        parse: parseInt,
        validate: (data) => JSPLib.menu.validateNumber(data, true, 1),
        hint: "The number of recent tags to store and show."
    },
    maximum_tag_groups: {
        reset: 5,
        parse: parseInt,
        validate: (data) => JSPLib.menu.validateNumber(data, true, 1),
        hint: "Number of recent tag groups to store and show. Only affects the <b>Multiple</b> list type."
    },
    include_metatags: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Does not filter out metatags."
    },
    include_unchanged_tags: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Does not filter out unchanged tags."
    },
    include_removed_tags: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Does not filter out removed tags."
    },
    include_deleted_tags: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Does not filter out unaliased tags with a post count of 0."
    },
    cache_frequent_tags: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Saves the user's favorite tags locally."
    }
};

const all_source_types = ['indexed_db','local_storage'];
const all_data_types = ['tag_data', 'tag_alias', 'custom'];

const CONTROL_CONFIG = {
    refresh_frequent_tags: {
        value: "Click to refresh",
        hint: "Gets the latest favorite tags from the user's profile.",
    },
    cache_info: {
        value: "Click to populate",
        hint: "Calculates the cache usage of the program and compares it to the total usage.",
    },
    purge_cache: {
        display: `Purge cache (<span id="${PROGRAM_SHORTCUT}-purge-counter">...</span>)`,
        value: "Click to purge",
        hint: `Dumps all of the cached data related to ${PROGRAM_NAME}.`,
    },
    data_source: {
        allitems: all_source_types,
        value: 'indexed_db',
        hint: "Indexed DB is <b>Cache Data</b> and Local Storage is <b>Program Data</b>.",
    },
    data_type: {
        allitems: all_data_types,
        value: 'tag',
        hint: "Select type of data. Use <b>Custom</b> for querying by keyname.",
    },
    raw_data: {
        value: false,
        hint: "Select to import/export all program data",
    },
    data_name: {
        value: "",
        buttons: ['get', 'save', 'delete', 'list', 'refresh'],
        hint: "Click <b>Get</b> to see the data, <b>Save</b> to edit it, and <b>Delete</b> to remove it.<br><b>List</b> shows keys in their raw format, and <b>Refresh</b> checks the keys again.",
    },
};

const MENU_CONFIG = {
    topic_id: DANBOORU_TOPIC_ID,
    settings: [{
        name: 'general',
    },{
        name: 'order',
    },{
        name: 'list',
    },{
        name: 'inclusion',
    },{
        name: 'frequent',
    }],
    controls: [{
        name: 'frequent',
    }],
};

const DEFAULT_VALUES = PROGRAM_RESET_KEYS;

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
.tag-type-${metatags_category} a:link,
.tag-type-${metatags_category} a:visited {
    color: darkgoldenrod;
    font-weight: bold;
}
.tag-type-${metatags_category} a:hover {
    color: goldenrod;
    font-weight: bold;
}
.tag-type-${alias_tag_category} a:link,
.tag-type-${alias_tag_category} a:visited {
    color: #0CC;
    font-weight: bold;
}
.tag-type-${alias_tag_category} a:hover {
    color: aqua;
    font-weight: bold;
}
.tag-type-${deleted_tag_category} a:link,
.tag-type-${deleted_tag_category} a:visited {
    color: black;
    background-color: red;
    font-weight: bold;
}
.tag-type-${deleted_tag_category} a:hover {
    color: black;
    background-color: white;
    font-weight: bold;
}
.tag-type-${notfound_tag_category} a {
    text-decoration: underline dotted grey;
}
.tag-column {
    overflow: hidden;
}
.rtc-user-related-tags-columns .frequent-related-tags-column li:before {
    content: "*";
    font-family: monospace;
    font-weight: bold;
    visibility: hidden;
    padding-right: 0.2em;
}
.rtc-user-related-tags-columns .frequent-related-tags-column li.selected:before {
    visibility: visible;
}
.user-related-tags-columns .frequent-related-tags-column,
.user-related-tags-columns .recent-related-tags-column {
    display: none;
}
`;

const MENU_CSS = `
#recent-tags-calc .rtc-sortlist li {
    width: 150px;
}
#recent-tags-calc .jsplib-settings-grouping:not(#rtc-general-settings) .rtc-selectors label {
    width: 120px;
}`;

//HTML Constants

const usertag_columns_html = `
<div class="tag-column recent-related-tags-column is-empty-false"></div>
<div class="tag-column frequent-related-tags-column is-empty-false"></div>`;

const ORDER_SETTINGS_DETAILS = `
<ul>
    <li>Order types: for <b>Uploads Order</b> and <b>Post Edits Order</b>
        <ul>
            <li><b>Alphabetic:</b> A to Z.</li>
            <li><b>Form order:</b> The order of tags in the tag edit box.</li>
            <li><b>Post count:</b> Highest to lowest.
                <ul>
                    <li>Metatags are rated higher than aliases.</li>
                    <li>Only when both <b>Metatags First</b> and <b>Aliases First</b> are set.</li>
                </ul>
            </li>
            <li><b>Category:</b> Tag category.</li>
            <li><b>Tag usage:</b> Ordered by recent tag usage.
                <ul>
                    <li><i>Not implemented yet.</i></li>
                </ul>
            </li>
        </ul>
    </li>
</ul>`;

const LIST_SETTINGS_DETAILS = `
<ul>
    <li><b>List type:</b>
        <ul>
            <li><b>Queue:</b> First in, first out.</li>
            <li><b>Single:</b> Only the tags from the last upload/edit.</li>
            <li><b>Multiple:</b> Each upload/edit gets its own list.</li>
        </ul>
    </li>
</ul>`;

const INCLUSION_SETTINGS_DETAILS = `
<ul>
    <li><b>Include removed tags:</b>
        <ul>
            <li>This includes both tags removed through deletion and through negative tags.</li>
            <li>When <b>Form Order</b> is being used, tag deletions get appended onto the new set of recent tags.</li>
        </ul>
    </li>
</ul>`;

const FREQUENT_SETTINGS_DETAILS = `
<ul>
    <li><b>Cache frequent tags:</b>
        <ul>
            <li>Makes for quicker loading of recent/frequent tags.</li>
            <li>Tags are automatically refreshed once a week.</li>
        </ul>
    </li>
</ul>`;

const CACHE_DATA_DETAILS = `
<ul>
    <li><b>Tag data (tag):</b> Used to determine a tag's post count and category.</li>
    <li><b>Tag aliases (ta):</b> Used to determine which tags are aliases or deleted.</li>
</ul>`;

const PROGRAM_DATA_DETAILS = `
<p class="tn">All timestamps are in milliseconds since the epoch (<a href="https://www.epochconverter.com">Epoch converter</a>).</p>
<ul>
    <li>General data
        <ul>
            <li><b>prune-expires:</b> When the program will next check for cache data that has expired.</li>
            <li><b>user-settings:</b> All configurable settings.</li>
        </ul>
    </li>
    <li>Recent tags
        <ul>
            <li><b>recent-tags:</b> The current list of recent tags.</li>
            <li><b>pinned-tags:</b> The current list of pinned tags.</li>
            <li>Used when the <b>Multiple</b> type list is selected:
                <ul>
                    <li><b>other-recent:</b> Groups of the most recent tags used, set with the type of post event.</li>
                    <li><b>was-upload:</b> Determines whether the current recent tags were from an upload or edit.</li>
                </ul>
            </li>
            <li><b>process-semaphore-recent:</b> Prevents two tabs from processing the same recent data at the same time.</li>
        </ul>
    </li>
    <li>Frequent tags
        <ul>
            <li><b>frequent-tags:</b> List of all favorite tags from the user.</li>
            <li><b>frequent-tags-expires:</b> When to next query the user's profile.</li>
            <li><b>process-semaphore-frequent:</b> Prevents two tabs from processing the same frequency data at the same time.</li>
        </ul>
    </li>
</ul>`;

//Expirations
const prune_expires = JSPLib.utility.one_day;
const noncritical_recheck = JSPLib.utility.one_minute;
const tag_expires = JSPLib.utility.one_week;
const frequent_tags_expires = JSPLib.utility.one_week;

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

const tag_fields = "id,name,category,post_count";
const user_fields = "favorite_tags";

//Validation values

const relation_constraints = {
    entry: JSPLib.validate.arrayentry_constraints,
    value: JSPLib.validate.basic_stringonly_validator
};

const tag_constraints = {
    entry: JSPLib.validate.hashentry_constraints,
    value: {
        category: JSPLib.validate.inclusion_constraints([0,1,2,3,4,5,alias_tag_category,deleted_tag_category]),
        postcount: JSPLib.validate.counting_constraints,
        is_alias: JSPLib.validate.boolean_constraints,
        is_deleted: JSPLib.validate.boolean_constraints
    }
};

const other_recent_constraints = {
    tags: JSPLib.validate.array_constraints,
    was_upload: JSPLib.validate.boolean_constraints,
};

/****Functions****/

//Library functions

////NONE

//Validation functions

function ValidateEntry(key,entry) {
    if (!JSPLib.validate.validateIsHash(key,entry)) {
        return false;
    }
    if (key.match(/^tag-/)) {
        return ValidateTagEntry(key,entry);
    } else if (key.match(/^ta-/)) {
        return ValidateRelationEntry(key,entry);
    }
    this.debug('log',"Bad key!");
    return false;
}

function ValidateTagEntry(key,entry) {
    if (!JSPLib.validate.validateHashEntries(key, entry, tag_constraints.entry)) {
        return false;
    }
    if (!JSPLib.validate.validateHashEntries(key + '.value', entry.value, tag_constraints.value)) {
        return false;
    }
    return true;
}

function ValidateRelationEntry(key,entry) {
    if (!JSPLib.validate.validateHashEntries(key, entry, relation_constraints.entry)) {
        return false;
    }
    return JSPLib.validate.validateArrayValues(key + '.value', entry.value, relation_constraints.value);
}

function ValidateProgramData(key,entry) {
    var checkerror = [],maximum_validator;
    switch (key) {
        case 'rtc-user-settings':
            checkerror = JSPLib.menu.validateUserSettings(entry,SETTINGS_CONFIG);
            break;
        case 'rtc-prune-expires':
        case 'rtc-frequent-tags-expires':
        case 'rtc-process-semaphore-recent':
        case 'rtc-process-semaphore-frequent':
            if (!Number.isInteger(entry)) {
                checkerror = ["Value is not an integer."];
            }
            break;
        case 'rtc-was-upload':
            if (!JSPLib.validate.isBoolean(entry)) {
                checkerror = ['Value is not a boolean.'];
            }
            break;
        case 'rtc-recent-tags':
        case 'rtc-pinned-tags':
        case 'rtc-frequent-tags':
            maximum_validator = (key === 'rtc-recent-tags' ? {maximum: RTC.user_settings.maximum_tags} : undefined);
            if (!JSPLib.validate.validateIsArray(key,entry,maximum_validator)) {
                return false;
            }
            return JSPLib.validate.validateArrayValues(key,entry,JSPLib.validate.basic_stringonly_validator);
        case 'rtc-other-recent':
            if (!JSPLib.validate.validateIsArray(key,entry,{maximum: RTC.user_settings.maximum_tag_groups})) {
                return false;
            }
            for (let i = 0;i < entry.length; i++) {
                let entry_key = `${key}[${i}]`;
                if (!JSPLib.validate.validateIsHash(entry_key,entry[i])) {
                    return false;
                }
                if (!JSPLib.validate.validateHashEntries(entry_key, entry[i], other_recent_constraints)) {
                    return false;
                }
                if (!JSPLib.validate.validateArrayValues(entry_key+'.tags',entry[i].tags,JSPLib.validate.basic_stringonly_validator)) {
                    return false;
                }
            }
            return true;
        default:
            checkerror = ["Not a valid program data key."];
    }
    if (checkerror.length) {
        JSPLib.validate.outputValidateError(key,checkerror);
        return false;
    }
    return true;
}

//Auxiliary functions

function GetTagList() {
    return JSPLib.utility.filterEmpty(StripQuoteSourceMetatag($("#upload_tag_string,#post_tag_string").val()).split(/[\s\n]+/).map((tag) => tag.toLowerCase()));
}

function StripQuoteSourceMetatag(str) {
    return str.replace(/source:"[^"]+"\s?/g,'');
}

function GetNegativetags(array) {
    return JSPLib.utility.filterRegex(array,negative_regex,false).map((value) => value.substring(1));
}

function FilterMetatags(array) {
    return JSPLib.utility.filterRegex(array,metatags_regex,true);
}

function NormalizeTags(array) {
    return array.map((entry) => entry.replace(/^-/, ''));
}

function TransformTypetags(array) {
    return array.map((value) => value.match(striptype_regex).splice(1).join(''));
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
        let postcount = (RTC.user_settings.metatags_first ? metatags_first_post_count : 0);
        return {postcount:postcount,category:metatags_category};
    }
    if (!(tag in RTC.tag_data) || RTC.tag_data[tag].category === notfound_tag_category) {
        RTC.tag_data[tag] = JSPLib.storage.getIndexedSessionData('tag-'+tag,{value:default_tag_data}).value;
    }
    if (RTC.tag_data[tag].is_alias) {
        RTC.tag_data[tag].category = alias_tag_category;
        RTC.tag_data[tag].postcount = (RTC.user_settings.aliases_first ? aliases_first_post_count : 0);
    } else if (RTC.tag_data[tag].is_deleted) {
        RTC.tag_data[tag].category = deleted_tag_category;
    }
    return RTC.tag_data[tag];
}

function GetTagColumnList(name) {
    if (name === "frequent") {
        return RTC.frequent_tags;
    } else if (name === "recent") {
        let all_tags = RTC.recent_tags;
        if (RTC.user_settings.list_type[0] === "multiple") {
            RTC.other_recent.forEach((recent_entry)=>{
                all_tags = JSPLib.utility.arrayUnion(all_tags,recent_entry.tags);
            });
        }
        return all_tags;
    }
    return [];
}

function GetStartingTags() {
    return Object.keys(sessionStorage).filter((key) => key.match(/^danbooru-storage-tag-/)).map((tag) => tag.replace(/^danbooru-storage-tag-/, ''));
}

//Display functions

async function DisplayRecentTags() {
    await RTC.pageload_recentcheck;
    let $tag_column = $(".rtc-user-related-tags-columns .recent-related-tags-column");
    let html = RenderTaglist(RTC.recent_tags,"Recent",RTC.pinned_tags);
    if (RTC.user_settings.list_type[0] === "multiple") {
        let upload = 1, edit = 1;
        let shown_tags = JSPLib.utility.arrayUnion(RTC.recent_tags,RTC.pinned_tags);
        RTC.other_recent.forEach((recent_entry)=>{
            let title = (recent_entry.was_upload ? `Upload ${upload++}` : `Edit ${edit++}`);
            let display_tags = JSPLib.utility.arrayDifference(recent_entry.tags,shown_tags);
            if (display_tags.length) {
                html += RenderTaglist(display_tags,title,[]);
            }
            shown_tags = JSPLib.utility.arrayUnion(shown_tags,display_tags);
        });
    }
    $tag_column.html(html);
    $tag_column.removeClass("is-empty-true").addClass("is-empty-false");
    Danbooru.RelatedTag.update_selected();
    $(".recent-related-tags-column .ui-icon").on(PROGRAM_CLICK,PinnedTagsToggle);
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
    JSPLib.storage.batchStorageCheck(FilterMetatags(GetTagColumnList(name)),ValidateEntry,tag_expires,'tag')
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

function RecheckDisplaySemaphore(name) {
    JSPLib.utility.recheckTimer({
        check: ()=>{return JSPLib.concurrency.checkSemaphore(PROGRAM_SHORTCUT, name);},
        exec: ()=>{
            this.debug('log',"Callback:",name);
            RecheckAndDisplay(name);
        }
    },timer_poll_interval);
}

function RenderTaglines(taglist,addon) {
    return taglist.map((tag)=>{
        let category = GetTagCategory(tag);
        let escaped_tag = JSPLib.utility.HTMLEscape(tag);
        let search_link = JSPLib.danbooru.postSearchLink(tag,tag.replace(/_/g,' '),`class="search-tag" data-tag-name="${escaped_tag}"`);
        return `    <li class="tag-type-${category}">${addon}${search_link}</li>\n`;
    }).join('');
}

function RenderTaglist(taglist,columnname,pinned_tags) {
    let html = "";
    if (pinned_tags && pinned_tags.length) {
        html += RenderTaglines(pinned_tags,`<span class="ui-icon ui-icon-pin-s" style="min-width:unset"></span>&thinsp;`);
        taglist = JSPLib.utility.arrayDifference(taglist,pinned_tags);
    }
    let pin_html = (pinned_tags ? `<span class="ui-icon ui-icon-radio-off" style="min-width:unset"></span>&thinsp;` : '');
    html += RenderTaglines(taglist,pin_html);
    return `
<h6>${columnname}</h6>
<ul>
${html.slice(0,-1)}
</ul>
`;
}

//Event handlers

function ReloadFrequentTags(event) {
    QueryFrequentTags().then(()=>{
        JSPLib.notice.notice(`${PROGRAM_NAME}: Frequent tags reloaded!`);
    });
    event.preventDefault();
}

function PinnedTagsToggle(event) {
    $(event.target).toggleClass("ui-icon-radio-off ui-icon-pin-s");
    let tag_name = $(".search-tag",event.target.parentElement).text().replace(/\s/g,'_');
    RTC.pinned_tags = JSPLib.utility.arraySymmetricDifference(RTC.pinned_tags,[tag_name]);
    JSPLib.storage.setStorageData('rtc-pinned-tags',RTC.pinned_tags,localStorage);
    RTC.channel.postMessage({type: "reload_recent", recent_tags: RTC.recent_tags, pinned_tags: RTC.pinned_tags, other_recent: RTC.other_recent, updated_pin_tag: tag_name});
}

function CaptureTagSubmission() {
    RTC.postedittags = GetCurrentTags();
    RTC.new_recent_tags = NormalizeTags(RTC.postedittags);
    RTC.positivetags = JSPLib.utility.filterRegex(RTC.postedittags,negative_regex,true);
    RTC.negativetags = GetNegativetags(RTC.postedittags);
    RTC.userremovetags = JSPLib.utility.arrayDifference(RTC.preedittags,RTC.positivetags);
    RTC.removedtags = JSPLib.utility.arrayUnion(RTC.userremovetags,RTC.negativetags);
    RTC.unchangedtags = JSPLib.utility.arrayDifference(JSPLib.utility.arrayIntersection(RTC.preedittags,RTC.positivetags),RTC.negativetags);
    if (!RTC.user_settings.include_unchanged_tags) {
        RTC.new_recent_tags = JSPLib.utility.arrayDifference(RTC.new_recent_tags,RTC.unchangedtags);
    }
    if (!RTC.user_settings.include_removed_tags) {
        RTC.new_recent_tags = JSPLib.utility.arrayDifference(RTC.new_recent_tags,RTC.removedtags);
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
    this.debug('log',"New recent tags:",RTC.new_recent_tags);
    AddRecentTags(RTC.new_recent_tags);
}

//Main helper functions

async function CheckMissingTags(tag_list,list_name="") {
    this.debug('log',"Checking tag list:", tag_list);
    let network_tags = [];
    let [found_tags,missing_tags] = await JSPLib.storage.batchStorageCheck(tag_list,ValidateEntry,tag_expires,'tag');
    if (missing_tags.length) {
        this.debug('log',"Missing tags:",missing_tags);
        network_tags = await QueryMissingTags(missing_tags);
    } else {
        this.debug('log',`No missing tags in DB [${list_name}]!`);
    }
    let unavailable_tags = JSPLib.utility.arrayDifference(found_tags, RTC.starting_tags);
    this.debug('log',"Unavailable tags:", unavailable_tags);
    if (network_tags.length || unavailable_tags.length) {
        let reload_tags = JSPLib.utility.arrayUnion(network_tags, unavailable_tags);
        reload_tags.forEach((tag)=>{
            let category = GetTagCategory(tag);
            let escaped_tag = JSPLib.utility.HTMLEscape(tag);
            $(`li.tag-type-${notfound_tag_category} a[href$="${escaped_tag}"]`).closest('li').removeClass().addClass(`tag-type-${category}`);
        });
    }
    return [unavailable_tags,missing_tags];
}

async function QueryMissingTags(missing_taglist) {
    let promise_array = [];
    let tag_query = missing_taglist.join(' ');
    let url_addons = {search: {name_space: tag_query, hide_empty: false}, only: tag_fields};
    let queried_tags = await JSPLib.danbooru.getAllItems('tags', max_item_limit, {url_addons});
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
    let network_tags = JSPLib.utility.getObjectAttributes(queried_tags, 'name');
    let unfound_tags = JSPLib.utility.arrayDifference(missing_taglist, network_tags);
    this.debug('log',"Network tags:", network_tags);
    this.debug('log',"Unfound tags:", unfound_tags);
    unfound_tags.forEach((tag)=>{
        let entryname = 'tag-' + tag;
        RTC.tag_data[tag] = deleted_tag_data;
        promise_array.push(JSPLib.storage.saveData(entryname, {value: deleted_tag_data, expires: Date.now() + tag_expires}));
    });
    await Promise.all(promise_array);
    RTC.channel.postMessage({type: "update_category", network_tags: network_tags});
    return network_tags;
}

function FilterDeletedTags() {
    JSPLib.debug.debugExecute(()=>{
        RTC.deleted_saved_recent_tags = RTC.saved_recent_tags.filter((tag) => (GetTagCategory(tag) === deleted_tag_category));
        RTC.deleted_recent_tags = RTC.recent_tags.filter((tag) => (GetTagCategory(tag) === deleted_tag_category));
        if (RTC.deleted_saved_recent_tags.length || RTC.deleted_recent_tags.length) {
            this.debug('log',"Deleting tags:",RTC.deleted_saved_recent_tags,RTC.deleted_recent_tags);
        }
    });
    RTC.saved_recent_tags = RTC.saved_recent_tags.filter((tag) => (GetTagCategory(tag) !== deleted_tag_category));
    RTC.recent_tags = RTC.recent_tags.filter((tag) => (GetTagCategory(tag) !== deleted_tag_category));
}

function SortTagData(tag_list,type) {
    this.debug('log',"Pre-sort:",tag_list);
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
    this.debug('log',"Post-sort:",tag_list);
}

//Main execution functions

////Recent tags

async function CheckAllRecentTags() {
    if (!JSPLib.concurrency.reserveSemaphore(PROGRAM_SHORTCUT, 'recent')) {
        RecheckDisplaySemaphore("recent");
        return;
    }
    let original_recent_tags = JSPLib.utility.dataCopy(RTC.recent_tags);
    RTC.saved_recent_tags = [];
    let tag_list = RTC.recent_tags.concat(RTC.pinned_tags);
    if (RTC.tag_order === "post_count" || RTC.tag_order === "category") {
        RTC.saved_recent_tags = JSPLib.storage.checkStorageData('rtc-new-recent-tags',ValidateProgramData,localStorage,[]);
        tag_list = JSPLib.utility.arrayUnion(tag_list,RTC.saved_recent_tags);
    }
    if (RTC.user_settings.list_type[0] === "multiple") {
        RTC.other_recent.forEach((recent_entry)=>{
            tag_list = JSPLib.utility.arrayUnion(tag_list,recent_entry.tags);
        });
    }
    RTC.missing_recent_tags = await CheckMissingTags(FilterMetatags(tag_list), "Recent");
    if (!RTC.user_settings.include_deleted_tags) {
        FilterDeletedTags();
    }
    if ((RTC.tag_order === "post_count" || RTC.tag_order === "category") && RTC.saved_recent_tags.length) {
        SortTagData(RTC.saved_recent_tags,RTC.tag_order);
    }
    JSPLib.storage.removeStorageData('rtc-new-recent-tags', localStorage);
    if (JSPLib.utility.arraySymmetricDifference(original_recent_tags,RTC.recent_tags).length || RTC.saved_recent_tags.length) {
        AddRecentTags(RTC.saved_recent_tags);
    }
    JSPLib.concurrency.freeSemaphore(PROGRAM_SHORTCUT, 'recent');
}

function AddRecentTags(newtags) {
    switch (RTC.user_settings.list_type[0]) {
        case "multiple":
            RTC.was_upload = JSPLib.storage.checkStorageData('rtc-was-upload',ValidateProgramData,localStorage,false);
            if (newtags.length && RTC.recent_tags.length) {
                RTC.other_recent.unshift({
                    was_upload: RTC.was_upload,
                    tags: RTC.recent_tags
                });
                RTC.other_recent = RTC.other_recent.slice(0,RTC.user_settings.maximum_tag_groups);
                JSPLib.storage.setStorageData('rtc-other-recent',RTC.other_recent,localStorage);
            }
            JSPLib.storage.setStorageData('rtc-was-upload',RTC.is_upload,localStorage);
            //falls through
        case "single":
            if (newtags.length) {
                RTC.recent_tags = newtags;
            }
            break;
        case "queue":
        default:
            RTC.recent_tags = JSPLib.utility.concatUnique(newtags,RTC.recent_tags);
    }
    RTC.recent_tags = RTC.recent_tags.slice(0,RTC.user_settings.maximum_tags);
    JSPLib.storage.setStorageData('rtc-recent-tags',RTC.recent_tags,localStorage);
    RTC.channel.postMessage({type: "reload_recent", recent_tags: RTC.recent_tags, pinned_tags: RTC.pinned_tags, other_recent: RTC.other_recent, new_recent_tags: newtags});
}

////Frequent tags

async function LoadFrequentTags() {
    if (!RTC.userid) {
        //User must have an account to have frequent tags
        return;
    }
    if (RTC.user_settings.cache_frequent_tags) {
        RTC.frequent_tags = JSPLib.storage.checkStorageData('rtc-frequent-tags',ValidateProgramData,localStorage,[]);
        if (JSPLib.concurrency.checkTimeout('rtc-frequent-tags-expires',frequent_tags_expires)) {
            if (JSPLib.concurrency.reserveSemaphore(PROGRAM_SHORTCUT, 'frequent')) {
                await QueryFrequentTags();
                JSPLib.concurrency.freeSemaphore(PROGRAM_SHORTCUT, 'frequent');
            } else {
                return false;
            }
        }
    } else {
        if (RTC.controller === 'posts' && RTC.action === 'show') {
            await new Promise((resolve)=>{
                $(document).one("rtc:get-frequent-tags", () => resolve(null));
            });
        }
        await QueryFrequentTags();
    }
    return true;
}

async function QueryFrequentTags() {
    let user_account = await JSPLib.danbooru.submitRequest('users',{search: {id: RTC.userid}, only: user_fields, expires_in: '300s'});
    if (!user_account || user_account.length === 0) {
        //Should never get here, but just in case
        return;
    }
    RTC.frequent_tags = user_account[0].favorite_tags.split(/\s+/).map((tag) => tag.trim());
    this.debug('log',"Found tags:",RTC.frequent_tags);
    if (RTC.user_settings.cache_frequent_tags) {
        JSPLib.storage.setStorageData('rtc-frequent-tags',RTC.frequent_tags,localStorage);
        JSPLib.concurrency.setRecheckTimeout('rtc-frequent-tags-expires',frequent_tags_expires);
    } else {
        JSPLib.storage.removeStorageData('rtc-frequent-tags', localStorage);
    }
    RTC.channel.postMessage({type: "reload_frequent", frequent_tags: RTC.frequent_tags});
}

async function CheckAllFrequentTags() {
    let status = await LoadFrequentTags();
    if (!status) {
        return;
    }
    if (JSPLib.concurrency.reserveSemaphore(PROGRAM_SHORTCUT, 'frequent')) {
        RTC.missing_frequent_tags = await CheckMissingTags(RTC.frequent_tags, "Frequent");
        JSPLib.concurrency.freeSemaphore(PROGRAM_SHORTCUT, 'frequent');
    } else {
        RecheckDisplaySemaphore("frequent");
    }
}

////Other

function CleanupTasks() {
    JSPLib.storage.pruneEntries(PROGRAM_SHORTCUT, PROGRAM_DATA_REGEX, prune_expires);
}

//Initialization functions

function InitializeRelatedTagColumns() {
    $(".user-related-tags-columns").before(`<div class="rtc-user-related-tags-columns">${usertag_columns_html}</div>`);
    if (RTC.controller === 'posts' && RTC.action === 'show') {
        // Load the AI tags as well
        Danbooru.RelatedTag.initialize_recent_and_favorite_tags();
    }
}

function RebindShowRelatedTags() {
    if (RTC.controller === 'posts' && RTC.action === 'show') {
        JSPLib.utility.recheckTimer({
            check: () => JSPLib.utility.isGlobalFunctionBound('danbooru:show-related-tags'),
            exec: ()=> {
                RTC.cached_data = true;
                let old_handlers = JSPLib.utility.saveEventHandlers(document, 'danbooru:show-related-tags');
                $(document).off("danbooru:show-related-tags");
                if (!RTC.IAC.cached_data) {
                    $(document).one("danbooru:show-related-tags", Danbooru.Upload.fetch_data_manual);
                }
                let timer = JSPLib.utility.initializeInterval(()=>{
                    if (!JSPLib.utility.isNamespaceBound(document, 'danbooru:show-related-tags', 'rtc')) {
                        $(document).one("danbooru:show-related-tags.rtc", () => {
                            $(document).trigger("rtc:get-frequent-tags");
                            clearInterval(timer);
                        });
                    } else if (JSPLib.utility.getProgramTime() > (JSPLib.utility.one_second * 10)) {
                        clearInterval(timer);
                    }
                }, 100);
                JSPLib.utility.rebindEventHandlers(document, "danbooru:show-related-tags", old_handlers, ['iac']);
            }
        }, 100);
    }
}

//Settings functions

function BroadcastRTC(ev) {
    this.debug('log',`(${ev.data.type}):`, ev.data);
    switch (ev.data.type) {
        case "update_category":
            JSPLib.storage.batchStorageCheck(ev.data.network_tags, ValidateEntry, tag_expires, 'tag').then(()=>{
                ev.data.network_tags.forEach((tag)=>{
                    let category = GetTagCategory(tag);
                    let escaped_tag = JSPLib.utility.HTMLEscape(tag);
                    $(`li.tag-type-${notfound_tag_category} a[href$="${escaped_tag}"]`).closest('li').removeClass().addClass(`tag-type-${category}`);
                });
            });
            break;
        case "reload_recent":
            RTC.pinned_tags = ev.data.pinned_tags;
            RTC.recent_tags = ev.data.recent_tags;
            RTC.other_recent = ev.data.other_recent;
            !RTC.is_setting_menu && RecheckAndDisplay("recent");
            break;
        case "reload_frequent":
            RTC.frequent_tags = ev.data.frequent_tags;
            !RTC.is_setting_menu && RecheckAndDisplay("frequent");
            //falls through
        default:
            //do nothing
    }
}

function RemoteSettingsCallback() {
    RTC.tag_order = GetTagOrderType();
}

function GetTagOrderType() {
    if (RTC.is_upload) {
        return RTC.user_settings.uploads_order[0];
    } else {
        return RTC.user_settings.post_edits_order[0];
    }
}

function InitializeProgramValues() {
    Object.assign(RTC, {
        userid: Danbooru.CurrentUser.data('id'),
        is_upload: (RTC.controller === 'uploads' && RTC.action === 'show') || (RTC.controller === 'upload-media-assets' && RTC.action === 'show'),
        is_setting_menu: JSPLib.danbooru.isSettingMenu(),
    });
    Object.assign(RTC, {
        tag_order: GetTagOrderType(),
        preedittags: GetTagList(),
        starting_tags: GetStartingTags(),
        recent_tags: JSPLib.storage.checkStorageData('rtc-recent-tags', ValidateProgramData,localStorage, []),
        pinned_tags: JSPLib.storage.checkStorageData('rtc-pinned-tags', ValidateProgramData,localStorage, []),
    });
    if (RTC.user_settings.list_type[0] === "multiple") {
        RTC.other_recent = JSPLib.storage.checkStorageData('rtc-other-recent',ValidateProgramData,localStorage,[]);
    } else {
        JSPLib.storage.removeStorageData('rtc-other-recent', localStorage);
        JSPLib.storage.removeStorageData('rtc-was-upload', localStorage);
    }
    RTC.pageload_recentcheck = CheckAllRecentTags();
    RTC.pageload_frequentcheck = CheckAllFrequentTags();
    JSPLib.load.setProgramGetter(RTC, 'IAC', 'IndexedAutocomplete');
    return true;
}

function RenderSettingsMenu() {
    $("#recent-tags-calc").append(JSPLib.menu.renderMenuFramework(MENU_CONFIG));
    $("#rtc-general-settings").append(JSPLib.menu.renderDomainSelectors());
    $('#rtc-order-settings-message').append(JSPLib.menu.renderExpandable("Additional setting details", ORDER_SETTINGS_DETAILS));
    $("#rtc-order-settings").append(JSPLib.menu.renderInputSelectors('uploads_order','radio'));
    $("#rtc-order-settings").append(JSPLib.menu.renderInputSelectors('post_edits_order','radio'));
    $("#rtc-order-settings").append(JSPLib.menu.renderCheckbox('metatags_first'));
    $("#rtc-order-settings").append(JSPLib.menu.renderCheckbox('aliases_first'));
    $("#rtc-order-settings").append(JSPLib.menu.renderSortlist('category_order'));
    $('#rtc-list-settings-message').append(JSPLib.menu.renderExpandable("Additional setting details", LIST_SETTINGS_DETAILS));
    $("#rtc-list-settings").append(JSPLib.menu.renderInputSelectors('list_type','radio'));
    $("#rtc-list-settings").append(JSPLib.menu.renderTextinput('maximum_tags',5));
    $("#rtc-list-settings").append(JSPLib.menu.renderTextinput('maximum_tag_groups',5));
    $('#rtc-inclusion-settings-message').append(JSPLib.menu.renderExpandable("Additional setting details", INCLUSION_SETTINGS_DETAILS));
    $("#rtc-inclusion-settings").append(JSPLib.menu.renderCheckbox('include_metatags'));
    $("#rtc-inclusion-settings").append(JSPLib.menu.renderCheckbox('include_unchanged_tags'));
    $("#rtc-inclusion-settings").append(JSPLib.menu.renderCheckbox('include_removed_tags'));
    $("#rtc-inclusion-settings").append(JSPLib.menu.renderCheckbox('include_deleted_tags'));
    $('#rtc-frequent-settings-message').append(JSPLib.menu.renderExpandable("Additional setting details", FREQUENT_SETTINGS_DETAILS));
    $("#rtc-frequent-settings").append(JSPLib.menu.renderCheckbox('cache_frequent_tags'));
    $("#rtc-frequent-controls").append(JSPLib.menu.renderLinkclick('refresh_frequent_tags', true));
    $('#rtc-controls').append(JSPLib.menu.renderCacheControls());
    $('#rtc-cache-controls-message').append(JSPLib.menu.renderExpandable("Cache Data details", CACHE_DATA_DETAILS));
    $("#rtc-cache-controls").append(JSPLib.menu.renderLinkclick('cache_info', true));
    $('#rtc-cache-controls').append(JSPLib.menu.renderCacheInfoTable());
    $("#rtc-cache-controls").append(JSPLib.menu.renderLinkclick('purge_cache', true));
    $('#rtc-controls').append(JSPLib.menu.renderCacheEditor(true));
    $('#rtc-cache-editor-message').append(JSPLib.menu.renderExpandable("Program Data details", PROGRAM_DATA_DETAILS));
    $("#rtc-cache-editor-controls").append(JSPLib.menu.renderKeyselect('data_source', true));
    $("#rtc-cache-editor-controls").append(JSPLib.menu.renderDataSourceSections());
    $("#rtc-section-indexed-db").append(JSPLib.menu.renderKeyselect('data_type', true));
    $("#rtc-section-local-storage").append(JSPLib.menu.renderCheckbox('raw_data', true));
    $("#rtc-cache-editor-controls").append(JSPLib.menu.renderTextinput('data_name', 20, true));
    JSPLib.menu.engageUI(true,true);
    disabled_order_types.forEach((type)=>{
        $(`#rtc-select-uploads-order-${type}`).checkboxradio("disable");
        $(`#rtc-select-post-edits-order-${type}`).checkboxradio("disable");
    });
    $("#rtc-control-refresh-frequent-tags").on(PROGRAM_CLICK, ReloadFrequentTags);
    JSPLib.menu.saveUserSettingsClick();
    JSPLib.menu.resetUserSettingsClick(localstorage_keys);
    JSPLib.menu.cacheInfoClick();
    JSPLib.menu.purgeCacheClick();
    JSPLib.menu.expandableClick();
    JSPLib.menu.dataSourceChange();
    JSPLib.menu.rawDataChange();
    JSPLib.menu.getCacheClick(ValidateProgramData);
    JSPLib.menu.saveCacheClick(ValidateProgramData, ValidateEntry);
    JSPLib.menu.deleteCacheClick();
    JSPLib.menu.listCacheClick();
    JSPLib.menu.refreshCacheClick();
    JSPLib.menu.cacheAutocomplete();
}

//Main program

function Main() {
    this.debug('log',"Initialize start:", JSPLib.utility.getProgramTime());
    const preload = {
        run_on_settings: false,
        default_data: DEFAULT_VALUES,
        initialize_func: InitializeProgramValues,
        broadcast_func: BroadcastRTC,
        menu_css: MENU_CSS,
    };
    if (!JSPLib.menu.preloadScript(RTC, RenderSettingsMenu, preload)) return;
    RebindShowRelatedTags();
    InitializeRelatedTagColumns();
    DisplayRecentTags();
    DisplayFrequentTags();
    $("#form").on('submit.rtc', CaptureTagSubmission);
    JSPLib.utility.setCSSStyle(program_css,'program');
    JSPLib.statistics.addPageStatistics(PROGRAM_NAME);
    JSPLib.load.noncriticalTasks(CleanupTasks);
}

/****Function decoration****/

[
    Main,BroadcastRTC,QueryFrequentTags,CaptureTagSubmission,SortTagData,FilterDeletedTags,
    QueryMissingTags,CheckMissingTags,RecheckDisplaySemaphore,ValidateEntry,
] = JSPLib.debug.addFunctionLogs([
    Main,BroadcastRTC,QueryFrequentTags,CaptureTagSubmission,SortTagData,FilterDeletedTags,
    QueryMissingTags,CheckMissingTags,RecheckDisplaySemaphore,ValidateEntry,
]);

[
    RenderSettingsMenu,CaptureTagSubmission,
    CheckAllRecentTags,CheckAllFrequentTags,QueryFrequentTags,CheckMissingTags,
] = JSPLib.debug.addFunctionTimers([
    //Sync
    RenderSettingsMenu,CaptureTagSubmission,
    //Async
    CheckAllRecentTags,CheckAllFrequentTags,QueryFrequentTags,
    [CheckMissingTags, 1],
]);

/****Initialization****/

//Variables for debug.js
JSPLib.debug.debug_console = false;
JSPLib.debug.level = JSPLib.debug.INFO;
JSPLib.debug.program_shortcut = PROGRAM_SHORTCUT;

//Variables for menu.js
JSPLib.menu.program_shortcut = PROGRAM_SHORTCUT;
JSPLib.menu.program_name = PROGRAM_NAME;
JSPLib.menu.program_data = RTC;
JSPLib.menu.program_reset_data = PROGRAM_RESET_KEYS;
JSPLib.menu.program_data_regex = PROGRAM_DATA_REGEX;
JSPLib.menu.program_data_key = PROGRAM_DATA_KEY;
JSPLib.menu.settings_callback = RemoteSettingsCallback;
JSPLib.menu.reset_callback = RemoteSettingsCallback;
JSPLib.menu.settings_config = SETTINGS_CONFIG;
JSPLib.menu.control_config = CONTROL_CONFIG;

//Export JSPLib
JSPLib.load.exportData(PROGRAM_NAME, RTC, {datalist: ['cached_data']});

/****Execution start****/

JSPLib.load.programInitialize(Main, {program_name: PROGRAM_NAME, required_variables: PROGRAM_LOAD_REQUIRED_VARIABLES, optional_selectors: PROGRAM_LOAD_OPTIONAL_SELECTORS});
