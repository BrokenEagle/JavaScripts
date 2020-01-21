// ==UserScript==
// @name         ValidateTagInput
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      28.3
// @description  Validates tag add/remove inputs on a post edit or upload, plus several other post validations.
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        *://*.donmai.us/
// @match        *://*.donmai.us/posts*
// @match        *://*.donmai.us/uploads/new*
// @match        *://*.donmai.us/settings
// @exclude      /^https?://\w+\.donmai\.us/.*\.(xml|json|atom)(\?|$)/
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/validatetaginput.user.js
// @require      https://cdn.jsdelivr.net/npm/core-js-bundle@3.2.1/minified.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.5.2/localforage.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.12.0/validate.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20191221/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20191221/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20191221/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20191221/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20191221/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20191221/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20191221/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20191221/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20191221/lib/menu.js
// ==/UserScript==

/* global JSPLib $ jQuery Danbooru */

/****Global variables****/

//Exterior script variables
const DANBOORU_TOPIC_ID = '14474';
const JQUERY_TAB_WIDGET_URL = 'https://cdn.jsdelivr.net/gh/jquery/jquery-ui@1.12.1/ui/widgets/tabs.js';

//Variables for load.js
const program_load_required_variables = ['window.jQuery','window.Danbooru'];
const program_load_required_selectors = ['#page'];

//Program name constants
const PROGRAM_SHORTCUT = 'vti';
const PROGRAM_CLICK = 'click.vti';
const PROGRAM_NAME = 'ValidateTagInput';

//Program data constants
const PROGRAM_DATA_REGEX = /^(ti|ta|are)-/; //Regex that matches the prefix of all program cache data
const PROGRAM_DATA_KEY = {
    tag_alias: 'ta',
    tag_implication: 'ti',
    artist_entry: 'are'
};

//Main program variable
var VTI;

//Timer function hash
const Timer = {};

//Main settings
const SETTINGS_CONFIG = {
    alias_check_enabled: {
        default: true,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Checks and removes aliased tags from tag add validation."
    },
    implication_check_enabled: {
        default: true,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Turns off querying implications for tag remove validation."
    },
    upload_check_enabled: {
        default: false,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Performs the same rating and source checks that Danbooru does."
    },
    artist_check_enabled: {
        default: true,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Does a check for any artist tags or artist entries."
    },
    copyright_check_enabled: {
        default: true,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: 'Checks for the existence of any copyright tag or the <a href="/wiki_pages/show_or_new?title=copyright_request">copyright request</a> tag.'
    },
    general_check_enabled: {
        default: true,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Performs a general tag count with up to three warning thresholds."
    },
    general_minimum_threshold: {
        default: 10,
        parse: parseInt,
        validate: (data)=>{return Number.isInteger(data) && data > 0;},
        hint: "The bare minimum number of general tags."
    },
    general_low_threshold: {
        default: 20,
        parse: parseInt,
        validate: (data)=>{return Number.isInteger(data) && data >= 0;},
        hint: "Threshold for a low amount of general tags. Enter 0 to disable this threshold."
    },
    general_moderate_threshold: {
        default: 30,
        parse: parseInt,
        validate: (data)=>{return Number.isInteger(data) && data >= 0;},
        hint: "Threshold for a moderate amount of general tags. Enter 0 to disable this threshold."
    },
    single_session_warning: {
        default: true,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Pre-edit warnings will only appear once per post per tab session."
    }
}

const all_source_types = ['indexed_db','local_storage'];
const all_data_types = ['tag_alias','tag_implication','artist_entry','custom'];

const CONTROL_CONFIG = {
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
        buttons: ['get', 'save', 'delete'],
        hint: "Click <b>Get</b> to see the data, <b>Save</b> to edit it, and <b>Delete</b> to remove it.",
    },
};

//CSS constants

const PROGRAM_CSS = `
#validation-input > label {
   font-weight: bold;
}
#validation-input > * {
    margin: 5px;
    display: block;
}`;

//HTML constants

const submit_button = `
<input id="validate-tags" type="button" class="ui-button ui-widget ui-corner-all" value="Submit">
<input id="check-tags" type="button" class="ui-button ui-widget ui-corner-all" value="Check">`;

const input_validator = `
<div id="validation-input" style="display:none">
<label for="skip-validate-tags">Skip Validation</label>
<input type="checkbox" id="skip-validate-tags">
</div>`;

const warning_messages = `
<div id="warning-bad-upload" class="notice notice-error" style="padding:0.5em;display:none"></div>
<div id="warning-new-tags" class="notice notice-error" style="padding:0.5em;display:none"></div>
<div id="warning-bad-removes" class="notice notice-info" style="padding:0.5em;display:none"></div>`;

const HOW_TO_TAG = `Read <a href="/wiki_pages/howto:tag">howto:tag</a> for how to tag.`;

const CACHE_INFO_TABLE = '<div id="vti-cache-info-table" style="display:none"></div>';

const vti_menu = `
<div id="vti-script-message" class="prose">
    <h2>${PROGRAM_NAME}</h2>
    <p>Check the forum for the latest on information and updates (<a class="dtext-link dtext-id-link dtext-forum-topic-id-link" href="/forum_topics/${DANBOORU_TOPIC_ID}">topic #${DANBOORU_TOPIC_ID}</a>).</p>
</div>
<div id="vti-console" class="jsplib-console">
    <div id="vti-settings" class="jsplib-outer-menu">
        <div id="vti-general-settings" class="jsplib-settings-grouping">
            <div id="vti-general-message" class="prose">
                <h4>General settings</h4>
            </div>
        </div>
        <div id="vti-pre-edit-settings" class="jsplib-settings-grouping">
            <div id="vti-pre-edit-message" class="prose">
                <h4>Pre edit settings</h4>
                <p>These settings affect validations when a post page is initially loaded.</p>
                <div class="expandable">
                    <div class="expandable-header">
                        <span>Additional setting details</span>
                        <input type="button" value="Show" class="expandable-button">
                    </div>
                    <div class="expandable-content">
                        <ul>
                            <li><b>Artist check enabled:</b>
                                <ul>
                                    <li>Posts with <a href="/wiki_pages/artist_request">artist request</a> or <a href="/wiki_pages/official_art">official art</a> are ignored.</li>
                                    <li>All artist tags on a post get checked for artist entries.</li>
                                </ul>
                            </li>
                            <li><b>General check enabled:</b>
                                <ul>
                                    <li>The only difference between the thresholds is in the warning message given.</li>
                                </ul>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        <div id="vti-post-edit-settings" class="jsplib-settings-grouping">
            <div id="vti-post-edit-message" class="prose">
                <h4>Post edit settings</h4>
                <p>These settings affect validations when submitting a post edit.</p>
                <div class="expandable">
                    <div class="expandable-header">
                        <span>Additional setting details</span>
                        <input type="button" value="Show" class="expandable-button">
                    </div>
                    <div class="expandable-content">
                        <ul>
                            <li><b>Implications check enabled:</b>
                                <ul>
                                    <li>Turning this off effectively turns off tag remove validation.</li>
                                </ul>
                            </li>
                            <li><b>Upload check enabled:</b>
                                <ul>
                                    <li>The main benefit is it moves the warning message closer to the submit button.</li>
                                    <li>I.e in the same location as the other <i>${PROGRAM_NAME}</i> warning messages.</li>
                                </ul>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        <div id="vti-cache-settings" class="jsplib-settings-grouping">
            <div id="vti-cache-message" class="prose">
                <h4>Cache settings</h4>
                <div class="expandable">
                    <div class="expandable-header">
                        <span>Cache Data details</span>
                        <input type="button" value="Show" class="expandable-button">
                    </div>
                    <div class="expandable-content">
                        <ul>
                            <li><b>Tag aliases (ta):</b> Used to determine if an added tag is bad or an alias.</li>
                            <li><b>Tag implications (ti):</b> Used to determine which tag removes are bad.</li>
                            <li><b>Artist entry (are):</b> Created if an artist entry exists.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        <hr>
        <div id="vti-settings-buttons" class="jsplib-settings-buttons">
            <input type="button" id="vti-commit" value="Save">
            <input type="button" id="vti-resetall" value="Factory Reset">
        </div>
    </div>
    <div id="vti-cache-editor" class="jsplib-outer-menu">
        <div id="vti-editor-message" class="prose">
            <h4>Cache editor</h4>
            <p>See the <b><a href="#vti-cache-message">Cache Data</a></b> details for the list of all cache data and what they do.</p>
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
                    </ul>
                </div>
            </div>
        </div>
        <div id="vti-cache-editor-controls"></div>
        <div id="vti-cache-editor-errors" class="jsplib-cache-editor-errors"></div>
        <div id="vti-cache-viewer" class="jsplib-cache-viewer">
            <textarea></textarea>
        </div>
    </div>
</div>`;

//Wait time for quick edit box
// 1. Let box close before reenabling the submit button
// 2. Let box open before querying the implications
const quickedit_wait_time = 1000;

//Polling interval for checking program status
const timer_poll_interval = 100;

//Expiration time is one month
const prune_expires = JSPLib.utility.one_day;
const noncritical_recheck = JSPLib.utility.one_minute;
const relation_expiration = JSPLib.utility.one_month;
const artist_expiration = JSPLib.utility.one_month;

//Tag regexes
const metatags_regex = /^(?:rating|-?parent|source|-?locked|-?pool|newpool|-?fav|child|-?favgroup|upvote|downvote):/i;
const typetags_regex = /^-?(?:general|gen|artist|art|copyright|copy|co|character|char|ch|meta):/i;
const negative_regex = /^-/;
const striptype_regex = /^(-?)(?:general:|gen:|artist:|art:|copyright:|copy:|co:|character:|char:|ch:|meta:)?(.*)/i
const cosplay_regex = /^(.+)_\(cosplay\)$/;
const school_regex = /^(.+)_school_uniform$/;

//Network constants

const QUERY_LIMIT = 100;
const MAX_RESULTS_LIMIT = 1000;

//Other constants

const tag_fields = "id,name";
const relation_fields = "id,antecedent_name,consequent_name";

//Validate constants

const relation_constraints = {
    entry: JSPLib.validate.arrayentry_constraints(),
    value: JSPLib.validate.basic_stringonly_validator
};

const artist_constraints = {
    expires : JSPLib.validate.expires_constraints,
    value: JSPLib.validate.inclusion_constraints([true])
}

/****Functions****/

//Validate functions

function ValidateEntry(key,entry) {
    if (!JSPLib.validate.validateIsHash(key, entry)) {
        return false;
    }
    if (key.match(/^(ti|ta)-/)) {
        return ValidateRelationEntry(key, entry);
    } else if (key.match(/^are-/)) {
        return JSPLib.validate.validateHashEntries(key, entry, artist_constraints);
    }
    ValidateEntry.debuglog("Bad key!");
    return false;
}

function ValidateRelationEntry(key,entry) {
    if (!JSPLib.validate.validateHashEntries(key, entry, relation_constraints.entry)) {
        return false;
    }
    return JSPLib.validate.validateArrayValues(key + '.value', entry.value, relation_constraints.value);
}

function ValidateProgramData(key,entry) {
    var checkerror=[];
    switch (key) {
        case 'vti-user-settings':
            checkerror = JSPLib.menu.validateUserSettings(entry,SETTINGS_CONFIG);
            break;
        case 'vti-prune-expires':
            if (!Number.isInteger(entry)) {
                checkerror = ["Value is not an integer."];
            }
            break;
        default:
            checkerror = ["Not a valid program data key."];
    }
    if (checkerror.length) {
        JSPLib.validate.outputValidateError(key,checkerror);
        return false;
    }
    return true;
}

//Library functions

JSPLib.danbooru.submitRequest = async function (type,url_addons={},default_val=null,long_query=false,key,domain='',notify_user=false) {
    key = key || String(JSPLib.utility.getUniqueID());
    if (JSPLib.danbooru.num_network_requests >= JSPLib.danbooru.max_network_requests) {
        await JSPLib.network.rateLimit('danbooru');
    }
    JSPLib.network.incrementCounter('danbooru');
    JSPLib.debug.recordTime(key,'Network');
    if (long_query) {
        url_addons._method = 'get';
    }
    let func = (long_query ? jQuery.post : jQuery.getJSON);
    try {
        return await func(`${domain}/${type}.json`,url_addons
        ).always(()=>{
            JSPLib.debug.recordTimeEnd(key,'Network');
            JSPLib.network.decrementCounter('danbooru');
        });
    } catch(e) {
        //Swallow exception... will return default value
        e = JSPLib.network.processError(e,"danbooru.submitRequest");
        let error_key = `${domain}/${type}.json?${jQuery.param(url_addons)}`;
        JSPLib.network.logError(error_key,e);
        if (notify_user) {
            JSPLib.network.notifyError(e);
        }
        return default_val;
    }
};

JSPLib.danbooru.getAllItems = async function (type,limit,batches,options) {
    let url_addons = options.addons || {};
    let reverse = options.reverse || false;
    let long_format = options.long_format || false;
    let page_modifier = (reverse ? 'a' : 'b');
    let page_addon = (Number.isInteger(options.page) ? {page:`${page_modifier}${options.page}`} : {});
    let limit_addon = {limit: limit};
    let batch_num = 1;
    var return_items = [];
    while (true) {
        let request_addons = JSPLib.utility.joinArgs(url_addons,page_addon,limit_addon);
        let temp_items = await JSPLib.danbooru.submitRequest(type,request_addons,[],long_format,null,options.domain,options.notify);
        return_items = JSPLib.utility.concat(return_items, temp_items);
        if (temp_items.length < limit || (batches && batch_num >= batches)) {
            return return_items;
        }
        let lastid = JSPLib.danbooru.getNextPageID(temp_items,reverse);
        page_addon = {page:`${page_modifier}${lastid}`};
        JSPLib.debug.debuglogLevel("danbooru.getAllItems - #",batch_num++,"Rechecking",type,"@",lastid,JSPLib.debug.INFO);
    }
};

//Helper functions

function GetTagList() {
    return JSPLib.utility.filterEmpty(StripQuoteSourceMetatag($("#upload_tag_string,#post_tag_string").val() || "").split(/[\s\n]+/).map(tag=>{return tag.toLowerCase();}));
}

function StripQuoteSourceMetatag(str) {
    return str.replace(/source:"[^"]+"\s?/g,'');
}

function GetNegativetags(array) {
    return JSPLib.utility.filterRegex(array,negative_regex,false).map((value)=>{return value.substring(1);});
}

function TransformTypetags(array) {
    return array.map((value)=>{return value.match(striptype_regex).splice(1).join('');});
}

function GetCurrentTags() {
    return JSPLib.utility.filterRegex(JSPLib.utility.filterRegex(GetTagList(),metatags_regex,true),typetags_regex,true);
}

function GetAutoImplications() {
    VTI.preedittags.forEach((tag)=>{
        let match = tag.match(cosplay_regex);
        if (match) {
            let base_tag = match[1];
            GetAutoImplications.debuglog("Found:",tag,'->','cosplay');
            GetAutoImplications.debuglog("Found:",tag,'->',base_tag);
            VTI.implicationdict.cosplay = VTI.implicationdict.cosplay || [];
            VTI.implicationdict.cosplay.push(tag);
            VTI.implicationdict[base_tag] = VTI.implicationdict[base_tag] || [];
            VTI.implicationdict[base_tag].push(tag);
        }
        match = tag.match(school_regex);
        if (match) {
            let base_tag = match[1];
            GetAutoImplications.debuglog("Found:",tag,'->','school_uniform');
            VTI.implicationdict.school_uniform = VTI.implicationdict.school_uniform || [];
            VTI.implicationdict.school_uniform.push(tag);
        }
    });
}

function GetAllRelations(tag,implicationdict) {
    var tmp = [];
    if (tag in implicationdict) {
        for(let i=0;i<implicationdict[tag].length;i++) {
            tmp.push(implicationdict[tag][i]);
            let tmp2 = GetAllRelations(implicationdict[tag][i],implicationdict);
            tmp = tmp.concat(tmp2);
        }
        return tmp;
    } else {
        return [];
    }
}

function IsSkipValidate() {
    return $("#skip-validate-tags")[0].checked;
}

function DisableUI(type) {
    $("#validate-tags")[0].setAttribute('disabled','true');
    $("#check-tags")[0].setAttribute('disabled','true');
    if (type === "submit") {
        $("#validate-tags")[0].setAttribute('value','Submitting...');
    } else if (type === "check") {
        $("#check-tags")[0].setAttribute('value','Checking...');
    }
}

function EnableUI(type) {
    $("#validate-tags")[0].removeAttribute('disabled');
    $("#check-tags")[0].removeAttribute('disabled');
    if (type === "submit") {
        $("#validate-tags")[0].setAttribute('value','Submit');
    } else if (type === "check") {
        $("#check-tags")[0].setAttribute('value','Check');
    }
}

//Network functions

//Queries aliases of added tags... can be called multiple times
async function QueryTagAliases(taglist) {
    let unseen_tags = JSPLib.utility.setDifference(taglist, VTI.seenlist);
    let [cached_aliases,uncached_aliases] = await JSPLib.storage.batchStorageCheck(unseen_tags, ValidateEntry, relation_expiration, 'ta');
    QueryTagAliases.debuglog("Cached aliases:", cached_aliases);
    QueryTagAliases.debuglog("Uncached aliases:", uncached_aliases);
    if (uncached_aliases.length) {
        let options = {addons: {search: {antecedent_name_space: uncached_aliases.join(' '), status:'active'}, only: relation_fields}, long_format: true};
        let all_aliases = await JSPLib.danbooru.getAllItems('tag_aliases', QUERY_LIMIT, null, options);
        let found_aliases = [];
        all_aliases.forEach((alias)=>{
            found_aliases.push(alias.antecedent_name);
            JSPLib.storage.saveData('ta-' + alias.antecedent_name, {value: [alias.consequent_name], expires: JSPLib.utility.getExpires(relation_expiration)});
        });
        let unfound_aliases = JSPLib.utility.setDifference(uncached_aliases, found_aliases);
        unfound_aliases.forEach((tag)=>{
            JSPLib.storage.saveData('ta-' + tag, {value: [], expires: JSPLib.utility.getExpires(relation_expiration)});
        });
        VTI.aliastags = JSPLib.utility.concat(VTI.aliastags, found_aliases);
        QueryTagAliases.debuglog("Found aliases:", found_aliases);
        QueryTagAliases.debuglog("Unfound aliases:", unfound_aliases);
    }
    cached_aliases.forEach((tag)=>{
        let data = JSPLib.storage.getStorageData('ta-' + tag, sessionStorage).value;
        if (data.length) {
            VTI.aliastags.push(tag);
        }
    });
    VTI.seenlist = JSPLib.utility.concat(VTI.seenlist, unseen_tags);
    QueryTagAliases.debuglog("Aliases:", VTI.aliastags);
}

//Queries implications of preexisting tags... called once per image
async function QueryTagImplications(taglist) {
    let [cached_implications,uncached_implications] = await JSPLib.storage.batchStorageCheck(taglist, ValidateEntry, relation_expiration, 'ti');
    QueryTagImplications.debuglog("Cached implications:", cached_implications);
    QueryTagImplications.debuglog("Uncached implications:", uncached_implications);
    if (uncached_implications.length) {
        let options = {addons: {search: {consequent_name_space: uncached_implications.join(' '), status:'active'}, only: relation_fields}, long_format: true};
        let all_implications = await JSPLib.danbooru.getAllItems('tag_implications', QUERY_LIMIT, null, options);
        all_implications.forEach((implication)=>{
            let tag = implication.consequent_name;
            VTI.implicationdict[tag] = VTI.implicationdict[tag] || [];
            VTI.implicationdict[tag].push(implication.antecedent_name);
        });
        for (let tag in VTI.implicationdict) {
            JSPLib.storage.saveData('ti-' + tag, {value: VTI.implicationdict[tag], expires: JSPLib.utility.getExpires(relation_expiration)});
        }
        let found_implications = Object.keys(VTI.implicationdict);
        let unfound_implications = JSPLib.utility.setDifference(uncached_implications, found_implications);
        unfound_implications.forEach((tag)=>{
            JSPLib.storage.saveData('ti-' + tag, {value: [], expires: JSPLib.utility.getExpires(relation_expiration)});
        });
        QueryTagImplications.debuglog("Found implications:", found_implications);
        QueryTagImplications.debuglog("Unfound implications:", unfound_implications);
    }
    cached_implications.forEach((tag)=>{
        let data = JSPLib.storage.getStorageData('ti-' + tag, sessionStorage).value;
        if (data.length) {
            VTI.implicationdict[tag] = data;
        }
    });
    QueryTagImplications.debuglog("Implications:", VTI.implicationdict);
}

//Event handlers

function PostModeMenu(event) {
    let s = $("#mode-box select").val();
    if (s === "edit") {
        $("#validation-input,#warning-bad-upload,#warning-new-tags,#warning-bad-removes").hide();
        let post_id = $(event.target).closest("article").data("id");
        let $post = $("#post_" + post_id);
        VTI.preedittags = $post.data("tags").split(' ');
        PostModeMenu.debuglog("Preedit tags:",VTI.preedittags);
        //Wait until the edit box loads before querying implications
        if (VTI.user_settings.implication_check_enabled) {
            setTimeout(()=>{
                VTI.implications_promise = Timer.QueryTagImplications(VTI.preedittags);
                VTI.implications_promise.then(()=>{
                    PostModeMenu.debuglog("Adding auto implications");
                    GetAutoImplications();
                });
            },quickedit_wait_time);
        }
        event.preventDefault();
    }
}

async function CheckTags(event) {
    //Prevent code from being reentrant until finished processing
    if (CheckTags.isready) {
        CheckTags.isready = false;
        DisableUI("check");
        let statuses = (await Promise.all([Timer.ValidateTagAdds(),Timer.ValidateTagRemoves(),ValidateUpload()]));
        if (statuses.every((item)=>{return item;})) {
            Danbooru.Utility.notice("Tags good to submit!");
        } else {
            Danbooru.Utility.error("Tag validation failed!");
        }
        EnableUI("check");
        CheckTags.isready = true;
    }
}
CheckTags.isready = true;

async function ValidateTags(event) {
    //Prevent code from being reentrant until finished processing
    if (ValidateTags.isready) {
        ValidateTags.isready = false;
        DisableUI("submit");
        let statuses = await Promise.all([Timer.ValidateTagAdds(),Timer.ValidateTagRemoves(),ValidateUpload()]);
        if (statuses.every((item)=>{return item;})) {
            ValidateTags.debuglog("Submit request!");
            $("#form,#quick-edit-form").trigger("submit");
            if ((VTI.controller === 'uploads' && VTI.action === 'new') || (VTI.controller === 'posts' && VTI.controller === 'show')) {
                ValidateTags.debuglog("Disabling return key!");
                $("#upload_tag_string,#post_tag_string").off("keydown.vti");
            }
            if (VTI.is_upload) {
                //Check for the triggering of Danbooru's client validation (file/source/rating)
                ReenableSubmitCallback();
                $("#client-errors").hide();
            } else if (VTI.controller === 'posts' && VTI.action === 'index') {
                //Wait until the edit box closes to reenable the submit button click
                setTimeout(()=>{
                    ValidateTags.debuglog("Ready for next edit!");
                    EnableUI("submit");
                    $("#skip-validate-tags")[0].checked = false;
                    ValidateTags.isready = true;
                },quickedit_wait_time);
            }
        } else {
            ValidateTags.debuglog("Validation failed!");
            EnableUI("submit");
            ValidateTags.isready = true;
        }
    }
}
ValidateTags.isready = true;

//Timer/callback functions

function ReenableSubmitCallback() {
    JSPLib.utility.recheckTimer({
        check: ()=>{return $("#client-errors").css("display") !== "none";},
        exec: ()=>{
            ReenableSubmitCallback.debuglog("Danbooru's client validation failed!");
            EnableUI("submit");
            $("#upload_tag_string").on("keydown.vti", null, "return", (e)=>{
                $("#validate-tags").click();
                e.preventDefault();
            });
            ValidateTags.isready = true;
        }
    },timer_poll_interval);
}

function RebindHotkey() {
    JSPLib.utility.recheckTimer({
        check: ()=>{return JSPLib.utility.isNamespaceBound("#upload_tag_string,#post_tag_string",'keydown','danbooru.submit');},
        exec: ()=>{
            $("#upload_tag_string,#post_tag_string").off("keydown.danbooru.submit").on("keydown.vti", null, "return", (e)=>{
                $("#validate-tags").click();
                e.preventDefault();
            });
        }
    },timer_poll_interval);
}

//Main execution functions

async function ValidateTagAdds() {
    let postedittags = GetCurrentTags();
    let positivetags = JSPLib.utility.filterRegex(postedittags,negative_regex,true);
    let useraddtags = JSPLib.utility.setDifference(positivetags,VTI.preedittags);
    VTI.addedtags = JSPLib.utility.setDifference(useraddtags,GetNegativetags(postedittags));
    ValidateTagAdds.debuglog("Added tags:",VTI.addedtags);
    if ((VTI.addedtags.length === 0) || IsSkipValidate()) {
        ValidateTagAdds.debuglog("Skipping!");
        $("#warning-new-tags").hide();
        return true;
    }
    let options = {addons: {search: {name_space: VTI.addedtags.join(' '), hide_empty: 'yes'}, only: tag_fields}, long_format: true}
    let all_aliases = await JSPLib.danbooru.getAllItems('tags', QUERY_LIMIT, null, options);
    VTI.checktags = all_aliases.map(entry=>{return entry.name;});
    let nonexisttags = JSPLib.utility.setDifference(VTI.addedtags,VTI.checktags);
    if (VTI.user_settings.alias_check_enabled) {
        await Timer.QueryTagAliases(nonexisttags);
        nonexisttags = JSPLib.utility.setDifference(nonexisttags,VTI.aliastags);
    }
    if (nonexisttags.length > 0) {
        ValidateTagAdds.debuglog("Nonexistant tags!");
        nonexisttags.forEach((tag,i)=>{ValidateTagAdds.debuglog(i,tag);});
        $("#validation-input").show();
        $("#warning-new-tags").show();
        let taglist = nonexisttags.join(', ');
        $("#warning-new-tags")[0].innerHTML = '<strong>Warning</strong>: The following new tags will be created:  ' + taglist;
        return false;
    }
    ValidateTagAdds.debuglog("Free and clear to submit!");
    $("#warning-new-tags").hide();
    return true;
}

async function ValidateTagRemoves() {
    if (!VTI.user_settings.implication_check_enabled || IsSkipValidate()) {
        ValidateTagRemoves.debuglog("Skipping!");
        $("#warning-bad-removes").hide();
        return true;
    }
    await VTI.implications_promise;
    let postedittags = TransformTypetags(GetCurrentTags());
    let deletedtags = JSPLib.utility.setDifference(VTI.preedittags,postedittags);
    let negatedtags = JSPLib.utility.setIntersection(GetNegativetags(postedittags),postedittags);
    let removedtags = deletedtags.concat(negatedtags);
    let finaltags = JSPLib.utility.setDifference(postedittags,removedtags);
    ValidateTagRemoves.debuglog("Final tags:",finaltags);
    ValidateTagRemoves.debuglog("Removed tags:",deletedtags,negatedtags);
    let allrelations = [];
    removedtags.forEach((tag)=>{
        let badremoves = JSPLib.utility.setIntersection(GetAllRelations(tag,VTI.implicationdict),finaltags);
        if (badremoves.length) {
            allrelations.push(badremoves.toString() + ' -> ' + tag);
        }
    });
    if (allrelations.length) {
        JSPLib.debug.debugExecute(()=>{
            ValidateTagRemoves.debuglog("Badremove tags!");
            allrelations.forEach((relation,i)=>{ValidateTagRemoves.debuglog(i,relation);});
        });
        $("#validation-input").show();
        $("#warning-bad-removes").show();
        let removelist = allrelations.join('<br>');
        $("#warning-bad-removes")[0].innerHTML = '<strong>Notice</strong>: The following implication relations prevent certain tag removes:<br>' + removelist;
        return false;
    }
    ValidateTagRemoves.debuglog("Free and clear to submit!");
    $("#warning-bad-removes").hide();
    return true;
}

function ValidateUpload() {
    if (!VTI.user_settings.upload_check_enabled || !VTI.is_upload || IsSkipValidate()) {
        ValidateUpload.debuglog("Skipping!");
        $("#warning-bad-upload").hide();
        return true;
    }
    let errormessages = [];
    let ratingtag = Boolean(JSPLib.utility.filterRegex(GetTagList(),/^rating:[sqe]/i).length);
    let ratingradio = $(".upload_rating input").toArray().some((input)=>{return input.checked;});
    if (!ratingtag && !ratingradio) {
        errormessages.push("Must specify a rating.");
    }
    if ($("#upload_file,#upload_source,#upload_md5_confirmation").toArray().every((input)=>{return $(input).val() === "";})) {
        errormessages.push("Must choose file or specify source.");
    }
    if (errormessages.length) {
        ValidateUpload.debuglog("Errors: " + errormessages.join(' '));
        $("#validation-input").show();
        $("#warning-bad-upload").show();
        $("#warning-bad-upload")[0].innerHTML = '<strong>Warning</strong>: ' + errormessages.join(' ');
        return false;
    }
    ValidateUpload.debuglog("Free and clear to submit!");
    $("#warning-bad-upload").hide();
    return true;
}

async function ValidateArtist() {
    let source_url = $("#post_source").val();
    let artist_names = $(".artist-tag-list .category-1 .wiki-link").map((i,entry)=>{return decodeURIComponent(entry.search.split("=")[1]);}).toArray();
    if (artist_names.length === 0 && !VTI.preedittags.includes('official_art')) {
        //Validate no artist tag
        let option_html = "";
        if (!source_url.match(/https?:\/\//)) {
            ValidateArtist.debuglog("Not a URL.");
            return;
        }
        let source_resp = await JSPLib.danbooru.submitRequest('source',{url: source_url},{artist: {name: null}});
        if (source_resp.artist.name === null) {
            ValidateArtist.debuglog("Not a first-party source.");
            return;
        }
        if (source_resp.artists.length) {
            let artist_list = source_resp.artists.map((artist)=>{return `<a href="/artists/show_or_new?name=${artist.name}">${artist.name}</a>`;});
            let artist_html = `There is an available artist tag for this post [${artist_list.join(', ')}]. Open the edit menu and consider adding it.`;
            VTI.validate_lines.push(artist_html);
        } else {
            if (!VTI.preedittags.includes('artist_request')) {
                option_html = `<br>...or, consider adding at least <a href="/wiki_pages/artist_request">artist request</a> or <a href="/wiki_pages/official_art">official art</a> as applicable.`;
            }
            let new_artist_addons = $.param({artist: {source: source_url}});
            let artist_html = `Artist tag is required. <a href="/artists/new?${new_artist_addons}">Create new artist entry</a>. Ask on the forum if you need naming help.`;
            VTI.validate_lines = VTI.validate_lines.concat([artist_html + option_html]);
        }
    } else {
        //Validate artists have entry
        let [cached_artists,uncached_artists] = await JSPLib.storage.batchStorageCheck(artist_names,ValidateEntry,artist_expiration,'are')
        if (uncached_artists.length === 0) {
            ValidateArtist.debuglog("No missing artists. [cache hit]");
            return;
        }
        let tag_resp = await JSPLib.danbooru.submitRequest('tags', {search: {name_space: uncached_artists.join(' '), has_artist: true}, only: tag_fields}, []);
        tag_resp.forEach((entry)=>{
            JSPLib.storage.saveData('are-' + entry.name,{value: true, expires: JSPLib.utility.getExpires(artist_expiration)});
        });
        let found_artists = JSPLib.utility.getObjectAttributes(tag_resp,'name');
        let missing_artists = JSPLib.utility.setDifference(uncached_artists,found_artists);
        if (missing_artists.length === 0) {
            ValidateArtist.debuglog("No missing artists. [cache miss]");
            return;
        }
        let artist_lines = missing_artists.map((artist)=>{
            let new_artist_addons = $.param({artist: {source: source_url, name: artist}});
            return `
            Artist <a href="/artists/show_or_new?name=${artist}">${artist}</a> requires an artist entry.
            <a href="/artists/new?${new_artist_addons}">Create new artist entry</a>`;
        });
        VTI.validate_lines = VTI.validate_lines.concat(artist_lines);
    }
    Danbooru.Utility.notice(VTI.validate_lines.join('<hr>'),true);
}

function ValidateCopyright() {
    let copyright_names_length = $(".copyright-tag-list .category-3 .wiki-link").length;
    if (copyright_names_length) {
        ValidateCopyright.debuglog("Has a copyright.");
        return;
    } else if (VTI.preedittags.includes('copyright_request')) {
        ValidateCopyright.debuglog("Has copyright request.");
        return;
    }
    let copyright_html = `Copyright tag is required. Consider adding <a href="/wiki_pages/copyright_request">copyright request</a> or <a href="/wiki_pages/original">original</a>.`
    VTI.validate_lines.push(copyright_html);
    Danbooru.Utility.notice(VTI.validate_lines.join('<br>'),true);
}

function ValidateGeneral() {
    let general_tags_length = $(".general-tag-list .category-0 .wiki-link").length;
    if (general_tags_length < VTI.user_settings.general_minimum_threshold) {
        VTI.validate_lines.push("Posts must have at least 10 general tags. Please add some more tags. " + HOW_TO_TAG);
    } else if (VTI.user_settings.general_low_threshold && general_tags_length < VTI.user_settings.general_low_threshold) {
        VTI.validate_lines.push("The post has a low amount of general tags. Consider adding more. " + HOW_TO_TAG);
    } else if (VTI.user_settings.general_moderate_threshold && general_tags_length < VTI.user_settings.general_moderate_threshold) {
        VTI.validate_lines.push("The post has a moderate amount of general tags, but could potentially need more. " + HOW_TO_TAG);
    } else {
        ValidateGeneral.debuglog("Has enough tags.");
        return;
    }
    Danbooru.Utility.notice(VTI.validate_lines.join('<br>'),true);
}

//Settings functions

function RenderSettingsMenu() {
    $("#validate-tag-input").append(vti_menu);
    $("#vti-general-settings").append(JSPLib.menu.renderDomainSelectors());
    $("#vti-pre-edit-settings").append(JSPLib.menu.renderCheckbox('single_session_warning'));
    $("#vti-pre-edit-settings").append(JSPLib.menu.renderCheckbox('artist_check_enabled'));
    $("#vti-pre-edit-settings").append(JSPLib.menu.renderCheckbox('copyright_check_enabled'));
    $("#vti-pre-edit-settings").append(JSPLib.menu.renderCheckbox('general_check_enabled'));
    $("#vti-pre-edit-settings").append(JSPLib.menu.renderTextinput('general_minimum_threshold',10));
    $("#vti-pre-edit-settings").append(JSPLib.menu.renderTextinput('general_low_threshold',10));
    $("#vti-pre-edit-settings").append(JSPLib.menu.renderTextinput('general_moderate_threshold',10));
    $("#vti-post-edit-settings").append(JSPLib.menu.renderCheckbox('alias_check_enabled'));
    $("#vti-post-edit-settings").append(JSPLib.menu.renderCheckbox('implication_check_enabled'));
    $("#vti-post-edit-settings").append(JSPLib.menu.renderCheckbox('upload_check_enabled'));
    $("#vti-cache-settings").append(JSPLib.menu.renderLinkclick('cache_info', true));
    $("#vti-cache-settings").append(CACHE_INFO_TABLE);
    $("#vti-cache-settings").append(JSPLib.menu.renderLinkclick('purge_cache', true));
    $("#vti-cache-editor-controls").append(JSPLib.menu.renderKeyselect('data_source', true));
    $("#vti-cache-editor-controls").append(JSPLib.menu.renderDataSourceSections());
    $("#vti-section-indexed-db").append(JSPLib.menu.renderKeyselect('data_type', true));
    $("#vti-section-local-storage").append(JSPLib.menu.renderCheckbox('raw_data', true));
    $("#vti-cache-editor-controls").append(JSPLib.menu.renderTextinput('data_name', 20, true));
    JSPLib.menu.engageUI(true);
    JSPLib.menu.saveUserSettingsClick();
    JSPLib.menu.resetUserSettingsClick();
    JSPLib.menu.cacheInfoClick();
    JSPLib.menu.purgeCacheClick();
    JSPLib.menu.dataSourceChange();
    JSPLib.menu.rawDataChange();
    JSPLib.menu.getCacheClick();
    JSPLib.menu.saveCacheClick(ValidateProgramData,ValidateEntry);
    JSPLib.menu.deleteCacheClick();
    JSPLib.menu.cacheAutocomplete();
}

//Main program

function Main() {
    Danbooru.VTI = VTI = {
        controller: document.body.dataset.controller,
        action: document.body.dataset.action,
        aliastags: [],
        seenlist: [],
        implicationdict: {},
        implications_promise: null,
        validate_lines: [],
        settings_config: SETTINGS_CONFIG,
        control_config: CONTROL_CONFIG,
    };
    Object.assign(VTI, {
        user_settings: JSPLib.menu.loadUserSettings(),
    });
    if (JSPLib.danbooru.isSettingMenu()) {
        JSPLib.menu.loadStorageKeys();
        JSPLib.utility.installScript(JQUERY_TAB_WIDGET_URL).done(()=>{
            JSPLib.menu.installSettingsMenu();
            Timer.RenderSettingsMenu();
        });
        return;
    }
    if (!JSPLib.menu.isScriptEnabled()) {
        Main.debuglog("Script is disabled on", window.location.hostname);
        return;
    }
    Object.assign(VTI, {
        is_upload: VTI.controller === 'uploads' && VTI.action === 'new',
        was_upload: JSPLib.storage.getStorageData('vti-was-upload',sessionStorage,false),
    });
    if (VTI.is_upload) {
        //Upload tags will always start out blank
        VTI.preedittags = [];
        JSPLib.storage.setStorageData('vti-was-upload',true,sessionStorage);
    } else {
        JSPLib.storage.setStorageData('vti-was-upload',false,sessionStorage);
    }
    if (VTI.controller === 'posts' && VTI.action === 'show') {
        VTI.preedittags = $("#image-container").data('tags').split(' ');
        Main.debuglog("Preedit tags:",VTI.preedittags);
        if (VTI.user_settings.implication_check_enabled) {
            VTI.implications_promise = Timer.QueryTagImplications(VTI.preedittags);
            VTI.implications_promise.then(()=>{
                Main.debuglog("Adding auto implications");
                GetAutoImplications();
            });
        }
        let post_id = parseInt(JSPLib.utility.getMeta('post-id'));
        let seen_post_list = JSPLib.storage.getStorageData('vti-seen-postlist',sessionStorage,[]);
        if (!VTI.was_upload && (!VTI.user_settings.single_session_warning || !seen_post_list.includes(post_id))) {
            if (VTI.user_settings.artist_check_enabled) {
                Timer.ValidateArtist();
            }
            if (VTI.user_settings.copyright_check_enabled) {
                ValidateCopyright();
            }
            if (VTI.user_settings.general_check_enabled) {
                ValidateGeneral();
            }
        } else {
            Main.debuglog("Already pre-validated post.");
        }
        JSPLib.storage.setStorageData('vti-seen-postlist',JSPLib.utility.setUnique(seen_post_list.concat(post_id)),sessionStorage);
    } else if (VTI.controller === 'posts' && VTI.action === 'index') {
        $(".post-preview a").on(PROGRAM_CLICK, PostModeMenu);
    } else if (!VTI.is_upload) {
        Main.debuglog("No validation needed!");
        return;
    }
    $("#form [type=submit],#quick-edit-form [type=submit][value=Submit]").after(submit_button);
    $("#form [type=submit],#quick-edit-form [type=submit][value=Submit]").hide();
    if (VTI.controller === 'posts' && VTI.action === 'index') {
        $("#quick-edit-form [type=submit][value=Cancel]").after(input_validator);
        $("#quick-edit-form").after(warning_messages);
    } else {
        $("#check-tags").after(input_validator);
        $("#related-tags-container").before(warning_messages);
    }
    $("#validate-tags").on(PROGRAM_CLICK, Timer.ValidateTags);
    $("#check-tags").on(PROGRAM_CLICK, Timer.CheckTags);
    RebindHotkey();
    JSPLib.utility.setCSSStyle(PROGRAM_CSS, 'program');
    JSPLib.statistics.addPageStatistics(PROGRAM_NAME);
    setTimeout(()=>{
        JSPLib.storage.pruneEntries(PROGRAM_SHORTCUT, PROGRAM_DATA_REGEX, prune_expires);
    }, noncritical_recheck);
}

/****Function decoration****/

JSPLib.debug.addFunctionTimers(Timer,false,[RenderSettingsMenu]);

JSPLib.debug.addFunctionTimers(Timer,true,[
    QueryTagAliases,QueryTagImplications,ValidateTagAdds,ValidateTagRemoves,ValidateArtist,
    ValidateTags,CheckTags
]);

JSPLib.debug.addFunctionLogs([
    Main, ValidateEntry, PostModeMenu, ValidateTags, ReenableSubmitCallback, GetAutoImplications,
    QueryTagAliases, QueryTagImplications, ValidateTagAdds, ValidateTagRemoves, ValidateUpload,
    ValidateArtist, ValidateCopyright, ValidateGeneral
]);

/****Initialization****/

//Variables for debug.js
JSPLib.debug.debug_console = false;
JSPLib.debug.pretext = "VTI:";
JSPLib.debug.pretimer = "VTI-";
JSPLib.debug.level = JSPLib.debug.INFO;

//Variables for menu.js
JSPLib.menu.program_shortcut = PROGRAM_SHORTCUT;
JSPLib.menu.program_name = PROGRAM_NAME;
JSPLib.menu.program_data_regex = PROGRAM_DATA_REGEX;
JSPLib.menu.program_data_key = PROGRAM_DATA_KEY;

//Export JSPLib
if (JSPLib.debug.debug_console) {
    window.JSPLib.lib = window.JSPLib.lib || {};
    window.JSPLib.lib[PROGRAM_NAME] = JSPLib;
}

/****Execution start****/

JSPLib.load.programInitialize(Main,'VTI',program_load_required_variables,program_load_required_selectors);
