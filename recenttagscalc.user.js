// ==UserScript==
// @name         RecentTagsCalc
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      5.1
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
const list_types = ['queue','single','multiple'];
const disabled_order_types = ['tag_usage'];
const all_source_types = ['indexed_db','local_storage'];
const all_data_types = ['tag_data','tag_alias','custom'];
const reverse_data_key = {
    tag_data: 'tag',
    tag_alias: 'ta'
};

const settings_config = {
    uploads_order: {
        allitems: order_types,
        default: ['form_order'],
        validate: (data)=>{return Array.isArray(data) && data.length === 1 && order_types.includes(data[0])},
        hint: "Select the type of order to be applied on recent tags from an upload."
    },
    post_edits_order: {
        allitems: order_types,
        default: ['alphabetic'],
        validate: (data)=>{return Array.isArray(data) && data.length === 1 && order_types.includes(data[0])},
        hint: "Select the type of order to be applied on recent tags from a post edit."
    },
    metatags_first: {
        default: true,
        validate: (data)=>{return typeof data === "boolean";},
        hint: "Sets the post count high for metatags. Only effective with the <b>Post Count</b> order type."
    },
    aliases_first: {
        default: true,
        validate: (data)=>{return typeof data === "boolean";},
        hint: "Sets the post count high for aliases. Only effective with the <b>Post Count</b> order type."
    },
    category_order: {
        allitems: category_orders,
        default: category_orders,
        validate: (data)=>{return Array.isArray(data) && JSPLib.utility.setSymmetricDifference(data,category_orders).length === 0},
        hint: "Drag and drop the categories to determine the group order for the <b>Category</b> order type."
    },
    list_type: {
        allitems: list_types,
        default: ['queue'],
        validate: (data)=>{return Array.isArray(data) && data.length === 1 && list_types.includes(data[0])},
        hint: "Select how to store tags after each upload/edit."
    },
    maximum_tags: {
        default: 25,
        parse: parseInt,
        validate: (data)=>{return Number.isInteger(data) && data > 0;},
        hint: "The number of recent tags to store and show."
    },
    maximum_tag_groups: {
        default: 5,
        parse: parseInt,
        validate: (data)=>{return Number.isInteger(data) && data > 0;},
        hint: "Number of recent tag groups to store and show. Only affects the <b>Multiple</b> list type."
    },
    include_metatags: {
        default: true,
        validate: (data)=>{return typeof data === "boolean";},
        hint: "Does not filter out metatags."
    },
    include_unchanged_tags: {
        default: true,
        validate: (data)=>{return typeof data === "boolean";},
        hint: "Does not filter out unchanged tags."
    },
    include_removed_tags: {
        default: false,
        validate: (data)=>{return typeof data === "boolean";},
        hint: "Does not filter out removed tags."
    },
    include_deleted_tags: {
        default: false,
        validate: (data)=>{return typeof data === "boolean";},
        hint: "Does not filter out unaliased tags with a post count of 0."
    },
    cache_frequent_tags: {
        default: true,
        validate: (data)=>{return typeof data === "boolean";},
        hint: "Saves the user's favorite tags locally."
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
#rtc-settings hr,
#rtc-console .expandable {
    width: 90%;
    margin-left: 0;
}
#rtc-cache-viewer textarea {
    width: 100%;
    min-width: 40em;
    height: 50em;
    padding: 5px;
}
#rtc-cache-editor-errors {
    display: none;
    border: solid lightgrey 1px;
    margin: 0.5em;
    padding: 0.5em;
}
.jsplib-console {
    width: 100%;
    min-width: 100em;
}
.rtc-linkclick.jsplib-linkclick .rtc-control.jsplib-control {
    display: inline;
}
#userscript-settings-menu .ui-widget-content a,
#notice .ui-widget-content a {
    color:#0073ff
}
#notice.ui-state-highlight {
    color: #363636;
}
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
<div id="rtc-script-message" class="prose">
    <h2>RecentTagsCalc</h2>
    <p>Check the forum for the latest on information and updates (<a class="dtext-link dtext-id-link dtext-forum-topic-id-link" href="/forum_topics/15851" style="color:#0073ff">topic #15851</a>).</p>
</div>
<div id="cu-console" class="jsplib-console">
    <div id="rtc-settings" class="jsplib-outer-menu">
        <div id="rtc-order-settings" class="jsplib-settings-grouping">
            <div id="rtc-order-message" class="prose">
                <h4>Order settings</h4>
                <div class="expandable">
                    <div class="expandable-header">
                        <span>Additional setting details</span>
                        <input type="button" value="Show" class="expandable-button">
                    </div>
                    <div class="expandable-content">
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
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        <div id="rtc-list-settings" class="jsplib-settings-grouping">
            <div id="rtc-list-message" class="prose">
                <h4>List settings</h4>
                <div class="expandable">
                    <div class="expandable-header">
                        <span>Additional setting details</span>
                        <input type="button" value="Show" class="expandable-button">
                    </div>
                    <div class="expandable-content">
                        <ul>
                            <li><b>List type:</b>
                                <ul>
                                    <li><b>Queue:</b> First in, first out.</li>
                                    <li><b>Single:</b> Only the tags from the last upload/edit.</li>
                                    <li><b>Multiple:</b> Each upload/edit gets its own list.</li>
                                </ul>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        <div id="rtc-inclusion-settings" class="jsplib-settings-grouping">
            <div id="rtc-inclusion-message" class="prose">
                <h4>Inclusion settings</h4>
                <div class="expandable">
                    <div class="expandable-header">
                        <span>Additional setting details</span>
                        <input type="button" value="Show" class="expandable-button">
                    </div>
                    <div class="expandable-content">
                        <ul>
                            <li><b>Include removed tags:</b>
                                <ul>
                                    <li>This includes both tags removed through deletion and through negative tags.</li>
                                    <li>When <b>Form Order</b> is being used, tag deletions get appended onto the new set of recent tags.</li>
                                </ul>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        <div id="rtc-frequent-settings" class="jsplib-settings-grouping">
            <div id="rtc-frequent-message" class="prose">
                <h4>Frequent tags settings</h4>
                <div class="expandable">
                    <div class="expandable-header">
                        <span>Additional setting details</span>
                        <input type="button" value="Show" class="expandable-button">
                    </div>
                    <div class="expandable-content">
                        <ul>
                            <li><b>Cache frequent tags:</b>
                                <ul>
                                    <li>Makes for quicker loading of recent/frequent tags.</li>
                                    <li>Tags are automatically refreshed once a week.</li>
                                </ul>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        <div id="rtc-cache-settings" class="jsplib-settings-grouping">
            <div id="rtc-cache-message" class="prose">
                <h4>Cache settings</h4>
                <div class="expandable">
                    <div class="expandable-header">
                        <span>Cache Data details</span>
                        <input type="button" value="Show" class="expandable-button">
                    </div>
                    <div class="expandable-content">
                        <ul>
                            <li><b>Tag data:</b> Used to determine a tag's post count and category.</li>
                            <li><b>Tag aliases:</b> Used to determine which tags are aliases or deleted.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        <hr>
        <div id="rtc-settings-buttons" class="jsplib-settings-buttons">
            <input type="button" id="rtc-commit" value="Save">
            <input type="button" id="rtc-resetall" value="Factory Reset">
        </div>
    </div>
    <div id="rtc-cache-editor" class="jsplib-outer-menu">
        <div id="rtc-editor-message" class="prose">
            <h4>Cache editor</h4>
            <p>See the <b><a href="#rtc-cache-message">Cache settings</a></b> settings for the list of all cache data and what they do.</p>
            <div class="expandable">
                <div class="expandable-header">
                    <span>Program Data details</span>
                    <input type="button" value="Show" class="expandable-button">
                </div>
                <div class="expandable-content">
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
                    </ul>
                </div>
            </div>
        </div>
        <div id="rtc-cache-editor-controls"></div>
        <div id="rtc-cache-editor-errors"></div>
        <div id="rtc-cache-viewer">
            <textarea></textarea>
        </div>
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

const other_recent_constraints = {
    tags: JSPLib.validate.array_constraints,
    was_upload: JSPLib.validate.boolean_constraints,
};

/***functions***/

//Validation functions

function ValidateEntry(key,entry) {
    if (!FixValidateIsHash(key,entry)) {
        return false;
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
        OutputValidateError(key,check);
        return false;
    }
    check = validate(entry.value,tag_constraints.value);
    if (check !== undefined) {
        OutputValidateError(key,check);
        return false;
    }
    return true;
}

function ValidateRelationEntry(key,entry) {
    let check = validate(entry,relation_constraints.entry);
    if (check !== undefined) {
        OutputValidateError(key,check);
        return false
    }
    return FixValidateArrayValues(key + '.value', entry.value, relation_constraints.value);
}

function ValidateProgramData(key,entry) {
    var checkerror = [];
    switch (key) {
        case 'rtc-user-settings':
            var checkerror = ValidateUserSettings(entry,settings_config);
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
            if (!validate.isBoolean(entry)) {
                checkerror = ['Value is not a boolean.'];
            }
            break;
        case 'rtc-recent-tags':
        case 'rtc-pinned-tags':
        case 'rtc-frequent-tags':
            let maximum_validator = (key === 'rtc-recent-tags' ? {maximum: RTC.user_settings.maximum_tags} : undefined);
            if (!FixValidateIsArray(key,entry,maximum_validator)) {
                return false;
            }
            return FixValidateArrayValues(key,entry,JSPLib.validate.stringonly_constraints);
        case 'rtc-other-recent':
            if (!FixValidateIsArray(key,entry,{maximum: RTC.user_settings.maximum_tag_groups})) {
                return false;
            }
            for (let i = 0;i < entry.length; i++) {
                let entry_key = `${key}[${i}]`
                if (!FixValidateIsHash(entry_key,entry[i])) {
                    return false;
                }
                let check = validate(entry[i],other_recent_constraints);
                if (check !== undefined) {
                    OutputValidateError(entry_key,check);
                    return false
                }
                if (!FixValidateArrayValues(entry_key+'.tags',entry[i].tags,JSPLib.validate.stringonly_constraints)) {
                    return false;
                }
            }
            break;
        default:
            checkerror = ["Not a valid program data key."];
    }
    if (checkerror.length) {
        OutputValidateError(key,checkerror);
        return false;
    }
    return true;
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
            JSPLib.storage.setStorageData(`rtc-process-semaphore-${name}`,0,localStorage);
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

validate.validators.array = function(value, options, key, attributes) {
    if (options !== false) {
        if (!validate.isArray(value)) {
            return "is not an array";
        }
        if (JSPLib.validate.checkOptions(options,'length')) {
            const usage_messages = {
                wrongLength: "array is wrong length (should be %{count} items)",
                tooShort: "array is too short (minimum is %{count} items)",
                tooLong : "array is too long (maximum is %{count} items)"
            };
            let validator = Object.assign({},options.length,usage_messages);
            let checkerror = validate({[key]:value},{[key]:{length: validator}});
            if (checkerror !== undefined) {
                return checkerror[key][0].slice(key.length+1);
            }
        }
    }
};

function OutputValidateError(key,checkerror) {
    JSPLib.validate.printValidateError(key,checkerror);
    JSPLib.validate.dom_output && RenderValidateError(key,JSON.stringify(checkerror,null,2));
}

function RenderValidateError(key,error_message) {
    if (JSPLib.validate.dom_output) {
        let output_text = `<b>${key}:</b>\r\n<pre>${error_message}</pre>`;
        $(JSPLib.validate.dom_output).html(output_text).show();
    }
}

function HideValidateError() {
    JSPLib.validate.dom_output && $(JSPLib.validate.dom_output).hide();
}

function FixValidateIsHash(key,entry) {
    let check = validate({[key]: entry}, {[key]: JSPLib.validate.hash_constraints});
    if (check !== undefined) {
        OutputValidateError(key,check);
        return false;
    }
    return true;
}

function FixValidateIsArray(key,entry,length) {
    let array_validator = {
        presence: true,
        array: (length ? {length: length} : true)
     };
    let check = validate({[key]: entry}, {[key]: array_validator});
    if (check !== undefined) {
        OutputValidateError(key,check);
        return false;
    }
    return true;
}

function FixValidateArrayValues(key,array,validator) {
    for (let i = 0;i < array.length; i++) {
        let check = validate({value: array[i]},{value: validator});
        if (check !== undefined) {
            OutputValidateError(key + `[${i}]`,check);
            return false;
        }
    }
    return true;
}

function RenderKeyselect(program_shortcut,setting_name,control=false,value='',all_options=[],hint='') {
    let config, setting_key, display_name, item;
    [config,setting_key,display_name,item] = JSPLib.menu.getProgramValues(program_shortcut,setting_name);
    let menu_type = (control ? "control" : "setting");
    let keyselect_key = `${program_shortcut}-${menu_type}-${setting_key}`;
    if (!control) {
        all_options = config[setting_name].allitems;
        hint = config[setting_name].hint;
        value = item;
    }
    let hint_html = JSPLib.menu.renderSettingHint(program_shortcut,"inline",hint);
    let html = "";
    all_options.forEach((option)=>{
        let selected = (option === value ? 'selected="selected"' : '');
        let display_option = JSPLib.utility.displayCase(option);
        html += `<option ${selected} value="${option}">${display_option}</option>`;
    });
    return `
<div class="${program_shortcut}-options jsplib-options jsplib-menu-item" data-setting="${setting_name}">
    <h4>${display_name}</h4>
    <div>
        <select name="${keyselect_key}" id="${keyselect_key}" data-parent="2">;
            ${html}
        </select>
        ${hint_html}
    </div>
</div>
`;
}

function FixRenderTextinput(program_shortcut,setting_name,length=20,control=false,hint='',buttons=[]) {
    let config, setting_key, display_name, item;
    [config,setting_key,display_name,item] = JSPLib.menu.getProgramValues(program_shortcut,setting_name);
    let textinput_key = `${program_shortcut}-setting-${setting_key}`;
    let menu_type = (control ? "control" : "setting");
    let submit_control = '';
    if (control && buttons.length) {
        buttons.forEach((button)=>{
            submit_control += FixRenderControlButton(program_shortcut,setting_key,button,2);
        });
    }
    let value = '';
    if (!control) {
        hint = config[setting_name].hint;
        value = item;
    }
    let hint_html = JSPLib.menu.renderSettingHint(program_shortcut,"block",hint);
    return `
<div class="${program_shortcut}-textinput jsplib-textinput jsplib-menu-item" data-setting="${setting_name}">
    <h4>${display_name}</h4>
    <div>
        <input type="text" class="${program_shortcut}-${menu_type} jsplib-${menu_type}" name="${textinput_key}" id="${textinput_key}" value="${value}" size="${length}" autocomplete="off" data-parent="2">
        ${submit_control}
        ${hint_html}
    </div>
</div>`;
}

function FixRenderControlButton(program_shortcut,setting_key,button_name,parent_level) {
    let button_key = `${program_shortcut}-${setting_key}-${button_name}`;
    let display_name = JSPLib.utility.displayCase(button_name);
    return `<input type="button" class="jsplib-control ${program_shortcut}-control" name="${button_key}" id="${button_key}" value="${display_name}" data-parent="${parent_level}">`;
}

function FixRenderLinkclick(program_shortcut,setting_name,display_name,link_text,hint) {
    let setting_key = JSPLib.utility.kebabCase(setting_name);
    return `
<div class="${program_shortcut}-linkclick jsplib-linkclick jsplib-menu-item">
    <h4>${display_name}</h4>
    <div>
        <b>[
            <span class="${program_shortcut}-control jsplib-control">
                <a href="#" id="${program_shortcut}-setting-${setting_key}">${link_text}</a>
            </span>
        ]</b>
        &emsp;
        <span class="${program_shortcut}-setting-tooltip jsplib-inline-tooltip">${hint}</span>
    </div>
</div>`;
}

function ValidateUserSettings(settings,config) {
    let error_messages = [];
    if (!validate.isHash(settings)) {
        return ["User settings are not a hash."];
    }
    for (let setting in config) {
        if (!(setting in settings) || !config[setting].validate(settings[setting])) {
            if (!(setting in settings)) {
                error_messages.push(`'${setting}' setting not found.`);
            } else {
                error_messages.push(`'${setting}' contains invalid data.`);
            }
            JSPLib.debug.debuglogLevel("Loading default:",setting,settings[setting],JSPLib.debug.WARNING);
            settings[setting] = config[setting].default;
        }
    }
    let valid_settings = Object.keys(config);
    for (let setting in settings) {
        if (!valid_settings.includes(setting)) {
            JSPLib.debug.debuglogLevel("Deleting invalid setting:",setting,settings[setting],JSPLib.debug.WARNING);
            delete settings[setting];
            error_messages.push(`'${setting}' is an invalid setting.`);
        }
    }
    return error_messages;
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

function GetTagColumnList(name) {
    if (name === "frequent") {
        return RTC.frequent_tags;
    } else if (name === "recent") {
        let all_tags = RTC.recent_tags;
        if (RTC.user_settings.list_type[0] === "multiple") {
            RTC.other_recent.forEach((recent_entry)=>{
                all_tags = JSPLib.utility.setUnion(all_tags,recent_entry.tags);
            });
        }
        return all_tags;
    }
    return [];
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
    BatchStorageCheck(TagToKeyTransform(FilterMetatags(GetTagColumnList(name))),ValidateEntry,tag_expires)
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
    let tag_list = RTC.recent_tags.concat(RTC.pinned_tags);
    if (RTC.tag_order === "post_count" || RTC.tag_order === "category") {
        RTC.saved_recent_tags = JSPLib.storage.getStorageData('rtc-new-recent-tags',localStorage,[]);
        tag_list = JSPLib.utility.setUnion(tag_list,RTC.saved_recent_tags);
    }
    if (RTC.user_settings.list_type[0] === "multiple") {
        RTC.other_recent.forEach((recent_entry)=>{
            tag_list = JSPLib.utility.setUnion(tag_list,recent_entry.tags);
        });
    }
    RTC.missing_recent_tags = await CheckMissingTags(FilterMetatags(tag_list),"Recent");
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

////Cache editor

//Program cache function

function OptionCacheDataKey(data_type,data_value) {
    CU.data_period = $("#cu-control-data-period").val();
    if (data_type === "reverse_implication") {
        return 'rti-' + data_value;
    }
    if (data_type === "count") {
        if (CU.data_period == "previous") {
            CU.data_value = "";
            return "";
        }
        let shortkey = (CU.data_period !== "" ? longname_key[CU.data_period] : "");
        return `ct${shortkey}-${data_value}`;
    } else {
        return `${CU.data_period}-${data_type}-${data_value}`;
    }
}

//Cache helper functions

async function LoadStorageKeys(program_shortcut) {
    let program_key = program_shortcut.toUpperCase();
    let storage_keys = await JSPLib.storage.danboorustorage.keys();
    Danbooru[program_key].storage_keys.indexed_db = storage_keys.filter((key)=>{return key.match(program_cache_regex);});
    storage_keys = Object.keys(localStorage);
    Danbooru[program_key].storage_keys.local_storage = storage_keys.filter((key)=>{return key.startsWith(program_shortcut + "-");});
}

function GetCacheDatakey(program_shortcut,option) {
    let program_key = program_shortcut.toUpperCase();
    let program_data = Danbooru[program_key];
    program_data.data_source = $(`#${program_shortcut}-control-data-source`).val();
    program_data.data_type = $(`#${program_shortcut}-control-data-type`).val();
    program_data.data_value = data_key = $(`#${program_shortcut}-setting-data-name`).val().trim().replace(/\s+/g,'_');
    if (program_data.data_source === "local_storage") {
        data_key = program_shortcut + '-' + program_data.data_value;
    } else if (program_data.data_type !== "custom") {
        if (typeof option === "function") {
            data_key = option(program_data.data_type,program_data.data_value);
        } else if (typeof option === "object") {
            data_key = option[program_data.data_type] + '-' + program_data.data_value;
        }
    }
    return data_key;
}

function CacheSource(program_shortcut,data_regex,option) {
    let program_key = program_shortcut.toUpperCase();
    let program_data = Danbooru[program_key];
    return function (req,resp) {
        let check_key = GetCacheDatakey(program_shortcut,option);
        if (program_data.data_source === "indexed_db" && program_data.data_value.length === 0) {
            resp([]);
            return;
        }
        let source_keys = program_data.storage_keys[program_data.data_source];
        let available_keys = source_keys.filter((key)=>{return key.toLowerCase().startsWith(check_key.toLowerCase());});
        let transformed_keys = available_keys.slice(0,10);
        if (program_data.data_source === 'local_storage') {
            transformed_keys = transformed_keys.map((key)=>{return key.replace(RegExp(`^${program_shortcut}-`),'');});
        } else if (program_data.data_type !== "custom") {
            transformed_keys = transformed_keys.map((key)=>{return key.replace(data_regex,'');});
        }
        resp(transformed_keys);
    }
}

//Cache event functions

function GetCacheClick(program_shortcut,option) {
    let program_key = program_shortcut.toUpperCase();
    $(`#${program_shortcut}-data-name-get`).on(`click.${program_shortcut}`,(e)=>{
        let storage_key = GetCacheDatakey(program_shortcut,option);
        if (Danbooru[program_key].data_source === "local_storage") {
            let data = JSPLib.storage.getStorageData(storage_key,localStorage);
            $(`#${program_shortcut}-cache-viewer textarea`).val(JSON.stringify(data,null,2));
        } else {
            JSPLib.storage.retrieveData(storage_key).then((data)=>{
                $(`#${program_shortcut}-cache-viewer textarea`).val(JSON.stringify(data,null,2));
            });
        }
        HideValidateError();
        $("#close-notice-link").click();
    });
}

function SaveCacheClick(program_shortcut,localvalidator,indexvalidator,option) {
    let program_key = program_shortcut.toUpperCase();
    $(`#${program_shortcut}-data-name-save`).on(`click.${program_shortcut}`,(e)=>{
        try {
            var data = JSON.parse($(`#${program_shortcut}-cache-viewer textarea`).val());
        } catch (e) {
            Danbooru.Utility.error("Invalid JSON data! Unable to save.");
            return;
        }
        let storage_key = GetCacheDatakey(program_shortcut,option);
        if (Danbooru[program_key].data_source === "local_storage") {
            if (localvalidator(storage_key,data)) {
                JSPLib.storage.setStorageData(storage_key,data,localStorage);
                Danbooru.Utility.notice("Data was saved.");
                HideValidateError();
                if (storage_key === `${program_shortcut}-user-settings`) {
                    CU.user_settings = data;
                    UpdateUserSettings(program_shortcut);
                }
            } else {
                Danbooru.Utility.error("Data is invalid! Unable to save.");
            }
        } else {
            if (indexvalidator(storage_key,data)) {
                JSPLib.storage.saveData(storage_key,data).then(()=>{
                    Danbooru.Utility.notice("Data was saved.");
                    HideValidateError();
                });
            } else {
                Danbooru.Utility.error("Data is invalid! Unable to save.");
            }
        }
    });
}

function DeleteCacheClick(program_shortcut,option) {
    let program_key = program_shortcut.toUpperCase();
    $(`#${program_shortcut}-data-name-delete`).on(`click.${program_shortcut}`,(e)=>{
        let storage_key = GetCacheDatakey(program_shortcut,option);
        if (Danbooru[program_key].data_source === "local_storage") {
            if (confirm("This will delete program data that may cause problems until the page can be refreshed.\n\nAre you sure?")) {
                localStorage.removeItem(storage_key);
                Danbooru.Utility.notice("Data has been deleted.");
                HideValidateError();
            }
        } else {
            JSPLib.storage.removeData(storage_key).then((data)=>{
                Danbooru.Utility.notice("Data has been deleted.");
                HideValidateError();
            });
        }
    });
}

function CacheAutocomplete(program_shortcut,data_regex,option) {
    let program_key = program_shortcut.toUpperCase();
    $(`#${program_shortcut}-setting-data-name`).autocomplete({
        minLength: 0,
        delay: 0,
        source: CacheSource(program_shortcut,data_regex,option),
        search: function() {
            $(this).data("uiAutocomplete").menu.bindings = $();
        }
    }).off('keydown.Autocomplete.tab');
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
    $("#rtc-list-settings").append(JSPLib.menu.renderTextinput("rtc",'maximum_tag_groups',5));
    $("#rtc-inclusion-settings").append(JSPLib.menu.renderCheckbox("rtc",'include_metatags'));
    $("#rtc-inclusion-settings").append(JSPLib.menu.renderCheckbox("rtc",'include_unchanged_tags'));
    $("#rtc-inclusion-settings").append(JSPLib.menu.renderCheckbox("rtc",'include_removed_tags'));
    $("#rtc-inclusion-settings").append(JSPLib.menu.renderCheckbox("rtc",'include_deleted_tags'));
    $("#rtc-frequent-settings").append(JSPLib.menu.renderCheckbox("rtc",'cache_frequent_tags'));
    $("#rtc-frequent-settings").append(FixRenderLinkclick("rtc",'refresh_frequent_tags',"Refresh frequent tags","Click to refresh","Gets the latest favorite tags from the user's profile."));
    $("#rtc-cache-settings").append(FixRenderLinkclick("rtc",'purge_cache',`Purge cache (<span id="rtc-purge-counter">...</span>)`,"Click to purge","Dumps all of the cached data related to RecentTagsCalc."));
    $("#rtc-cache-editor-controls").append(RenderKeyselect('rtc','data_source',true,'indexed_db',all_source_types,"Indexed DB is <b>Cache Data</b> and Local Storage is <b>Program Data</b>."));
    $("#rtc-cache-editor-controls").append(RenderKeyselect('rtc','data_type',true,'tag_data',all_data_types,"Only applies to Indexed DB.  Use <b>Custom</b> for querying by keyname."));
    $("#rtc-cache-editor-controls").append(FixRenderTextinput('rtc','data_name',20,true,"Click <b>Get</b> to see the data, <b>Save</b> to edit it, and <b>Delete</b> to remove it.",['get','save','delete']));
    JSPLib.menu.engageUI('rtc',true,true);
    disabled_order_types.forEach((type)=>{
        $(`#rtc-select-uploads-order-${type}`).checkboxradio("disable");
        $(`#rtc-select-post-edits-order-${type}`).checkboxradio("disable");
    });
    SetReloadFrequentTagsClick();
    JSPLib.menu.saveUserSettingsClick('rtc','RecentTagsCalc');
    JSPLib.menu.resetUserSettingsClick('rtc','RecentTagsCalc',localstorage_keys,program_reset_keys);
    JSPLib.menu.purgeCacheClick('rtc','RecentTagsCalc',program_cache_regex,"#rtc-purge-counter");
    GetCacheClick('rtc',reverse_data_key);
    SaveCacheClick('rtc',ValidateProgramData,ValidateEntry,reverse_data_key);
    DeleteCacheClick('rtc',reverse_data_key);
    CacheAutocomplete('rtc',program_cache_regex,reverse_data_key);
}

//Main function

function main() {
    Danbooru.RTC = RTC = {
        userid: JSPLib.utility.getMeta("current-user-id"),
        tag_data: {},
        frequent_tags: [],
        is_upload: Boolean($("#c-uploads #a-new").length),
        is_setting_menu: Boolean($("#c-users #a-edit").length),
        storage_keys: {indexed_db: [], local_storage: []},
        settings_config: settings_config,
        channel: new BroadcastChannel('RecentTagsCalc'),
    };
    RTC.user_settings = JSPLib.menu.loadUserSettings('rtc');
    RTC.channel.onmessage = BroadcastRTC;
    if (RTC.is_setting_menu) {
        JSPLib.validate.dom_output = "#rtc-cache-editor-errors";
        LoadStorageKeys('rtc');
        JSPLib.utility.installScript("https://cdn.jsdelivr.net/gh/jquery/jquery-ui@1.12.1/ui/widgets/tabs.js").done(()=>{
            JSPLib.menu.installSettingsMenu("RecentTagsCalc");
            RenderSettingsMenu();
        });
        JSPLib.utility.setCSSStyle(menu_css,'menu');
        return;
    }
    RTC.tag_order = GetTagOrderType();
    RTC.preedittags = GetTagList();
    RTC.recent_tags = JSPLib.storage.getStorageData('rtc-recent-tags',localStorage,[]);
    RTC.pinned_tags = JSPLib.storage.getStorageData('rtc-pinned-tags',localStorage,[]);
    if (RTC.user_settings.list_type[0] === "multiple") {
        RTC.other_recent = JSPLib.storage.getStorageData('rtc-other-recent',localStorage,[]);
    } else {
        localStorage.removeItem('rtc-other-recent');
        localStorage.removeItem('rtc-was-upload');
    }
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
    JSPLib.utility.setCSSStyle(program_css,'program');
    setTimeout(()=>{
        JSPLib.storage.pruneEntries('rtc',program_cache_regex,prune_expires);
    },JSPLib.utility.one_minute);
}

JSPLib.load.programInitialize(main,'RTC',program_load_required_variables,program_load_required_selectors);
