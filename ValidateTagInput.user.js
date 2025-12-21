// ==UserScript==
// @name         ValidateTagInput
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      29.15
// @description  Validates tag add/remove inputs on a post edit or upload, plus several other post validations.
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        *://*.donmai.us/
// @match        *://*.donmai.us/posts*
// @match        *://*.donmai.us/uploads/*
// @match        *://*.donmai.us/settings
// @exclude      /^https?://\w+\.donmai\.us/.*\.(xml|json|atom)(\?|$)/
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/ValidateTagInput.user.js
// @updateURL    https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/ValidateTagInput.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.10.0/localforage.min.js
// @require      https://cdn.jsdelivr.net/npm/localforage-getitems@1.4.2/dist/localforage-getitems.min.js
// @require      https://cdn.jsdelivr.net/npm/localforage-setitems@1.4.0/dist/localforage-setitems.min.js
// @require      https://cdn.jsdelivr.net/npm/localforage-removeitems@1.4.0/dist/localforage-removeitems.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.13.1/validate.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251218/lib/module.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251218/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251218/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251218/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251218/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251218/lib/concurrency.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251218/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251218/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251218/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251218/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251218/lib/menu.js
// ==/UserScript==

/* global JSPLib $ */

/****Library updates****/

////NONE

/****Global variables****/

//Exterior script variables
const DANBOORU_TOPIC_ID = '14474';

//Variables for load.js
const PROGRAM_LOAD_REQUIRED_VARIABLES = ['window.jQuery', 'window.Danbooru'];
const PROGRAM_LOAD_OPTIONAL_SELECTORS = ['#c-posts #a-show', '#c-posts #a-index', '#c-uploads #a-show', '#c-upload-media-assets #a-show', '#c-users #a-edit'];

//Program name constants
const PROGRAM_SHORTCUT = 'vti';
const PROGRAM_NAME = 'ValidateTagInput';

//Program data constants
const PROGRAM_DATA_REGEX = /^(ti|ta|td|are)-/; //Regex that matches the prefix of all program cache data
const PROGRAM_DATA_KEY = {
    tag_alias: 'ta',
    tag_implication: 'ti',
    tag_deprecation: 'td',
    artist_entry: 'are'
};

//Main program variable
const VTI = {};

//Main settings
const SETTINGS_CONFIG = {
    implication_check_enabled: {
        reset: true,
        validate: JSPLib.utility.isBoolean,
        hint: "Turns off querying implications for tag remove validation."
    },
    upload_check_enabled: {
        reset: false,
        validate: JSPLib.utility.isBoolean,
        hint: "Performs the same rating and source checks that Danbooru does."
    },
    approval_check_enabled: {
        reset: false,
        validate: JSPLib.utility.isBoolean,
        hint: "Confirms sending an upload for approval (Contributors only)."
    },
    artist_check_enabled: {
        reset: true,
        validate: JSPLib.utility.isBoolean,
        hint: "Does a check for any artist tags or artist entries."
    },
    copyright_check_enabled: {
        reset: true,
        validate: JSPLib.utility.isBoolean,
        hint: 'Checks for the existence of any copyright tag or the <a href="/wiki_pages/show_or_new?title=copyright_request">copyright request</a> tag.'
    },
    general_check_enabled: {
        reset: false,
        validate: JSPLib.utility.isBoolean,
        hint: "Performs a general tag count with up to three warning thresholds."
    },
    general_minimum_threshold: {
        reset: 10,
        parse: parseInt,
        validate: (data) => (Number.isInteger(data) && data > 0),
        hint: "The bare minimum number of general tags."
    },
    general_low_threshold: {
        reset: 20,
        parse: parseInt,
        validate: (data) => (Number.isInteger(data) && data >= 0),
        hint: "Threshold for a low amount of general tags. Enter 0 to disable this threshold."
    },
    general_moderate_threshold: {
        reset: 30,
        parse: parseInt,
        validate: (data) => (Number.isInteger(data) && data >= 0),
        hint: "Threshold for a moderate amount of general tags. Enter 0 to disable this threshold."
    },
    single_session_warning: {
        reset: true,
        validate: JSPLib.utility.isBoolean,
        hint: "Pre-edit warnings will only appear once per post per tab session."
    }
};

const ALL_SOURCE_TYPES = ['indexed_db', 'local_storage'];
const ALL_DATA_TYPES = ['tag_alias', 'tag_implication', 'artist_entry', 'custom'];

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
        allitems: ALL_SOURCE_TYPES,
        value: 'indexed_db',
        hint: "Indexed DB is <b>Cache Data</b> and Local Storage is <b>Program Data</b>.",
    },
    data_type: {
        allitems: ALL_DATA_TYPES,
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
    }, {
        name: 'pre-edit',
        message: "These settings affect validations when a post page is initially loaded.",
    }, {
        name: 'post-edit',
        message: "These settings affect validations when submitting a post edit.",
    }],
    controls: [],
};

// Default values

const DEFAULT_VALUES = {
    implicationdict: {},
    implications_promise: null,
    validate_lines: [],
    is_check_ready: true,
    is_validate_ready: true,
};

//CSS constants

const PROGRAM_CSS = `
#validation-input > label {
   font-weight: bold;
}
#validation-input > * {
    margin: 5px;
    display: block;
}
#check-tags {
    width: 7em;
    margin-right: 2em;
}`;

//HTML constants

const SUBMIT_BUTTON = `
<input id="validate-tags" type="button" class="ui-button ui-widget ui-corner-all" value="Submit">
<input id="check-tags" type="button" class="ui-button ui-widget ui-corner-all" value="Check">`;

const INPUT_VALIDATOR = `
<div id="validation-input" style="display:none">
<label for="skip-validate-tags">Skip Validation</label>
<input type="checkbox" id="skip-validate-tags">
</div>`;

const WARNING_MESSAGES = `
<div id="warning-bad-upload" class="notice notice-error" style="padding:0.5em;display:none"></div>
<div id="warning-new-tags" class="notice notice-error" style="padding:0.5em;display:none"></div>
<div id="warning-deprecated-tags" class="notice notice-error" style="padding:0.5em;display:none"></div>
<div id="warning-bad-removes" class="notice notice-info" style="padding:0.5em;display:none"></div>`;

const HOW_TO_TAG = `Read <a href="/wiki_pages/howto:tag">howto:tag</a> for how to tag.`;

const PREEDIT_SETTINGS_DETAILS = `
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
</ul>`;

const POSTEDIT_SETTINGS_DETAILS = `
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
</ul>`;

const CACHE_DATA_DETAILS = `
<ul>
    <li><b>Tag aliases (ta):</b> Used to determine if an added tag is bad or an alias.</li>
    <li><b>Tag implications (ti):</b> Used to determine which tag removes are bad.</li>
    <li><b>Artist entry (are):</b> Created if an artist entry exists.</li>
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
</ul>`;

//Wait time for quick edit box
// 1. Let box close before reenabling the submit button
// 2. Let box open before querying the implications
const QUICKEDIT_WAIT_TIME = 1000;

const UPLOAD_SUBMIT_WAIT_TIME = JSPLib.utility.one_second * 5;

//Polling interval for checking program status
const TIMER_POLL_INTERVAL = 100;

//Expiration time is one month
const PRUNE_EXPIRES = JSPLib.utility.one_day;
const TAG_EXPIRATION = JSPLib.utility.one_month;
const ARTIST_EXPIRATION = JSPLib.utility.one_month;

//Tag regexes
const METATAGS_REGEX = /^(?:rating|-?parent|source|-?locked|-?pool|newpool|-?fav|child|-?favgroup|upvote|downvote):/i;
const TYPETAGS_REGEX = /^-?(?:general|gen|artist|art|copyright|copy|co|character|char|ch|meta):/i;
const NEGATIVE_REGEX = /^-/;
const STRIPTYPE_REGEX = /^(-?)(?:general:|gen:|artist:|art:|copyright:|copy:|co:|character:|char:|ch:|meta:)?(.*)/i;
const COSPLAY_REGEX = /^(.+)_\(cosplay\)$/;
const SCHOOL_REGEX = /^(.+)_school_uniform$/;

//Network constants

const QUERY_LIMIT = 100;

//Other constants

const TAG_FIELDS = "id,name,is_deprecated";
const ALIAS_FIELDS = "id,name,post_count,is_deprecated,antecedent_alias[consequent_name]";
const RELATION_FIELDS = "id,antecedent_name,consequent_name";

//Validate constants

const ALIAS_CONSTRAINTS = {
    expires: JSPLib.validate.expires_constraints,
    value: JSPLib.validate.stringonly_constraints,
};

const IMPLICATION_CONSTRAINTS = {
    entry: JSPLib.validate.arrayentry_constraints(),
    value: JSPLib.validate.basic_stringonly_validator,
};

const DEPRECATION_CONSTRAINTS = {
    expires: JSPLib.validate.expires_constraints,
    value: JSPLib.validate.boolean_constraints,
};

const ARTIST_CONSTRAINTS = {
    expires: JSPLib.validate.expires_constraints,
    value: JSPLib.validate.inclusion_constraints([true]),
};

/****Functions****/

//Validate functions

function ValidateEntry(key, entry) {
    const printer = JSPLib.debug.getFunctionPrint('ValidateEntry');
    if (!JSPLib.validate.validateIsHash(key, entry)) {
        return false;
    }
    if (key.match(/^ta-/)) {
        return JSPLib.validate.validateHashEntries(key, entry, ALIAS_CONSTRAINTS);
    }
    if (key.match(/^ti-/)) {
        if (!JSPLib.validate.validateHashEntries(key, entry, IMPLICATION_CONSTRAINTS.entry)) {
            return false;
        }
        return JSPLib.validate.validateArrayValues(key + '.value', entry.value, IMPLICATION_CONSTRAINTS.value);
    }
    if (key.match(/^td-/)) {
        return JSPLib.validate.validateHashEntries(key, entry, DEPRECATION_CONSTRAINTS);
    }
    if (key.match(/^are-/)) {
        return JSPLib.validate.validateHashEntries(key, entry, ARTIST_CONSTRAINTS);
    }
    printer.debuglog("Bad key:", key);
    return false;
}

function ValidateProgramData(key, entry) {
    var checkerror = [];
    switch (key) {
        case 'vti-user-settings':
            checkerror = JSPLib.menu.validateUserSettings(entry, SETTINGS_CONFIG);
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
        JSPLib.validate.outputValidateError(key, checkerror);
        return false;
    }
    return true;
}

//Helper functions

function GetTagList() {
    return JSPLib.utility.filterEmpty(StripQuoteSourceMetatag($("#upload_tag_string,#post_tag_string").val() || "").split(/[\s\n]+/).map((tag) => tag.toLowerCase()));
}

function StripQuoteSourceMetatag(str) {
    return str.replace(/source:"[^"]+"\s?/g, '');
}

function GetNegativetags(array) {
    return JSPLib.utility.filterRegex(array, NEGATIVE_REGEX, false).map((value) => value.substring(1));
}

function TransformTypetags(array) {
    return array.map((value) => value.match(STRIPTYPE_REGEX).splice(1).join(''));
}

function GetCurrentTags() {
    return JSPLib.utility.filterRegex(JSPLib.utility.filterRegex(GetTagList(), METATAGS_REGEX, true), TYPETAGS_REGEX, true);
}

function GetAutoImplications() {
    const printer = JSPLib.debug.getFunctionPrint('GetAutoImplications');
    VTI.preedit_tags.forEach((tag) => {
        let match = tag.match(COSPLAY_REGEX);
        if (match) {
            let base_tag = match[1];
            printer.debuglog("Found:", tag, '->', 'cosplay');
            printer.debuglog("Found:", tag, '->', base_tag);
            VTI.implicationdict.cosplay = VTI.implicationdict.cosplay || [];
            VTI.implicationdict.cosplay.push(tag);
            VTI.implicationdict[base_tag] = VTI.implicationdict[base_tag] || [];
            VTI.implicationdict[base_tag].push(tag);
        }
        match = tag.match(SCHOOL_REGEX);
        if (match) {
            printer.debuglog("Found:", tag, '->', 'school_uniform');
            VTI.implicationdict.school_uniform = VTI.implicationdict.school_uniform || [];
            VTI.implicationdict.school_uniform.push(tag);
        }
    });
}

function GetAllRelations(tag, implicationdict) {
    var tmp = [];
    if (tag in implicationdict) {
        for(let i = 0;i < implicationdict[tag].length;i++) {
            tmp.push(implicationdict[tag][i]);
            let tmp2 = GetAllRelations(implicationdict[tag][i], implicationdict);
            tmp = tmp.concat(tmp2);
        }
        return tmp;
    }
    return [];
}

function IsSkipValidate() {
    return $("#skip-validate-tags")[0].checked;
}

function DisableUI(type) {
    $("#validate-tags")[0].setAttribute('disabled', 'true');
    $("#check-tags")[0].setAttribute('disabled', 'true');
    if (type === "submit") {
        $("#validate-tags")[0].setAttribute('value', 'Submitting...');
    } else if (type === "check") {
        $("#check-tags")[0].setAttribute('value', 'Checking...');
    }
}

function EnableUI(type) {
    $("#validate-tags")[0].removeAttribute('disabled');
    $("#check-tags")[0].removeAttribute('disabled');
    if (type === "submit") {
        $("#validate-tags")[0].setAttribute('value', 'Submit');
    } else if (type === "check") {
        $("#check-tags")[0].setAttribute('value', 'Check');
    }
}

function PreloadImplications() {
    const printer = JSPLib.debug.getFunctionPrint('PreloadImplications');
    if (VTI.implication_check_enabled) {
        VTI.implications_promise = QueryTagImplications(VTI.preedit_tags);
        VTI.implications_promise.then(() => {
            printer.debuglog("Adding auto implications");
            GetAutoImplications();
        });
    }
}

//Network functions

//Queries aliases of added tags... can be called multiple times
async function QueryTags(taglist) {
    const printer = JSPLib.debug.getFunctionPrint('QueryTags');
    QueryTags.alias_tags ??= [];
    QueryTags.deprecated_tags ??= [];
    QueryTags.empty_tags ??= [];
    QueryTags.populated_tags ??= [];
    let check_tags = JSPLib.utility.arrayDifference(taglist, JSPLib.utility.multiConcat(QueryTags.alias_tags, QueryTags.deprecated_tags, QueryTags.empty_tags, QueryTags.populated_tags));
    if (check_tags.length > 0) {
        let alias_keys = check_tags.map((tag) => 'ta-' + tag);
        let deprecated_keys = check_tags.map((tag) => 'td-' + tag);
        let tag_keys = JSPLib.utility.concat(alias_keys, deprecated_keys);
        let cached = await JSPLib.storage.batchCheckLocalDB(tag_keys, TAG_EXPIRATION);
        let found_names = [];
        for (let key in cached) {
            if (key.startsWith('ta-')) {
                let tag_name = key.replace(/^ta-/, "");
                QueryTags.alias_tags.push(tag_name);
                found_names.push(tag_name);
            } else if (cached[key].is_deprecated) {
                let tag_name = key.replace(/^td-/, "");
                QueryTags.deprecated_tags.push(tag_name);
                found_names.push(tag_name);
            }
        }
        let missing_names = JSPLib.utility.arrayDifference(check_tags, found_names);
        printer.debuglog("Cached tags:", found_names);
        printer.debuglog("Uncached tags:", missing_names);
        if (missing_names.length) {
            let options = {url_addons: {search: {name_space: missing_names.join(' ')}, only: ALIAS_FIELDS}, long_format: true};
            let tags = await JSPLib.danbooru.getAllItems('tags', QUERY_LIMIT, options);
            let found_aliases = [];
            let found_deprecations = [];
            let mapped_data = {};
            tags.forEach((tag) => {
                if (tag.antecedent_alias && !tag.is_deprecated) {
                    let consequent = tag.antecedent_alias.consequent_name;
                    found_aliases.push(tag.name);
                    mapped_data['ta-' + tag.name] = {value: [consequent], expires: JSPLib.utility.getExpires(TAG_EXPIRATION)};
                } else if (tag.is_deprecated) {
                    mapped_data['td-' + tag.name] = {value: tag.is_deprecated, expires: JSPLib.utility.getExpires(TAG_EXPIRATION)};
                    found_deprecations.push(tag.name);
                } else if (tag.post_count > 0) {
                    QueryTags.populated_tags.push(tag.name);
                } else {
                    QueryTags.empty_tags.push(tag.name);
                }
            });
            JSPLib.storage.batchSaveData(mapped_data);
            printer.debuglog("Network aliases:", found_aliases);
            printer.debuglog("Network deprecations:", found_deprecations);
            printer.debuglog("Network populated:", QueryTags.populated_tags);
            printer.debuglog("Network empty:", QueryTags.empty_tags);
            QueryTags.alias_tags = JSPLib.utility.concat(QueryTags.alias_tags, found_aliases);
            QueryTags.deprecated_tags = JSPLib.utility.concat(QueryTags.deprecated_tags, found_deprecations);
        }
        for (let key in cached) {
            if (key.startsWith('ta-') && cached[key].value.length) {
                QueryTags.alias_tags.push(key.replace(/^ta-/, ""));
            } else if (key.startsWith('td-') && cached[key].value) {
                QueryTags.deprecated_tags.push(key.replace(/^td-/, ""));
            }
        }
    }
    return {deprecated_tags: QueryTags.deprecated_tags, empty_tags: QueryTags.empty_tags};
}

//Queries implications of preexisting tags... called once per image
async function QueryTagImplications(taglist) {
    const printer = JSPLib.debug.getFunctionPrint('QueryTagImplications');
    let tag_keys = taglist.map((tag) => 'ti-' + tag);
    let cached = await JSPLib.storage.batchCheckLocalDB(tag_keys, TAG_EXPIRATION);
    let found_keys = JSPLib.utility.arrayIntersection(tag_keys, Object.keys(cached));
    let missing_keys = JSPLib.utility.arrayDifference(tag_keys, Object.keys(cached));
    printer.debuglog("Cached implications:", found_keys);
    printer.debuglog("Uncached implications:", missing_keys);
    if (missing_keys.length) {
        let missing_implications = missing_keys.map((key) => key.replace(/^ti-/, ""));
        let options = {url_addons: {search: {consequent_name_space: missing_implications.join(' '), status: 'active'}, only: RELATION_FIELDS}, long_format: true};
        let all_implications = await JSPLib.danbooru.getAllItems('tag_implications', QUERY_LIMIT, options);
        let network_data = {};
        all_implications.forEach((implication) => {
            let tag = implication.consequent_name;
            network_data[tag] = network_data[tag] || [];
            network_data[tag].push(implication.antecedent_name);
        });
        let mapped_implications = {};
        for (let tag in network_data) {
            mapped_implications['ti-' + tag] = {value: network_data[tag], expires: JSPLib.utility.getExpires(TAG_EXPIRATION)};
        }
        let found_implications = Object.keys(network_data);
        let unfound_implications = JSPLib.utility.arrayDifference(missing_implications, found_implications);
        unfound_implications.forEach((tag) => {
            mapped_implications['ti-' + tag] = {value: [], expires: JSPLib.utility.getExpires(TAG_EXPIRATION)};
        });
        JSPLib.storage.batchSaveData(mapped_implications);
        printer.debuglog("Found implications:", found_implications);
        printer.debuglog("Unfound implications:", unfound_implications);
        VTI.implicationdict = JSPLib.utility.mergeHashes(VTI.implicationdict, network_data);
    }
    for (let key in cached) {
        VTI.implicationdict[key.replace(/^ti-/, "")] = cached[key].value;
    }
    printer.debuglog("Implications:", VTI.implicationdict);
}

//Event handlers

function PostModeMenu(event) {
    const printer = JSPLib.debug.getFunctionPrint('PostModeMenu');
    let s = $("#mode-box select").val();
    if (s === "edit") {
        $("#validation-input,#warning-bad-upload,#warning-new-tags,#warning-bad-removes,#warning-deprecated-tags").hide();
        let post_id = $(event.target).closest("article").data("id");
        let $post = $("#post_" + post_id);
        VTI.preedit_tags = $post.data("tags").split(' ');
        printer.debuglog("Preedit tags:", VTI.preedit_tags);
        //Wait until the edit box loads before querying implications
        setTimeout(PreloadImplications, QUICKEDIT_WAIT_TIME);
        event.preventDefault();
    }
}

async function CheckTags() {
    //Prevent code from being reentrant until finished processing
    if (VTI.is_check_ready) {
        VTI.is_check_ready = false;
        DisableUI("check");
        let statuses = await Promise.all([ValidateTagAdds(), ValidateTagRemoves(), ValidateUpload()]);
        if (statuses.every((item) => item)) {
            JSPLib.notice.notice("Tags good to submit!");
        } else {

            JSPLib.notice.error("Tag validation failed!");
        }
        EnableUI("check");
        VTI.is_check_ready = true;
    }
}

async function ValidateTags() {
    const printer = JSPLib.debug.getFunctionPrint('ValidateTags');
    //Prevent code from being reentrant until finished processing
    if (VTI.is_validate_ready) {
        VTI.is_validate_ready = false;
        DisableUI("submit");
        let statuses = await Promise.all([ValidateTagAdds(), ValidateTagRemoves(), ValidateUpload()]);
        if (statuses.every((item) => item)) {
            if (VTI.approval_check_enabled && $('#post_is_pending').prop('checked') && !confirm("Submit upload for approval?")) {
                VTI.is_validate_ready = true;
                EnableUI("submit");
                return;
            }
            printer.debuglog("Submit request!");
            $("#form [name=commit],#quick-edit-form [name=commit]").click();
            if ((VTI.controller === 'uploads' && VTI.action === 'new') || (VTI.controller === 'posts' && VTI.controller === 'show')) {
                printer.debuglog("Disabling return key!");
                $("#upload_tag_string, #post_tag_string").off(JSPLib.program_keydown);
            }
            if (VTI.is_upload) {
                setTimeout(() => {
                    EnableUI("submit");
                    RebindHotkey();
                    VTI.is_validate_ready = true;
                    JSPLib.notice.error('Submission timed out: check client form for errors. (<a href="#client-errors">navigate</a>)');
                }, UPLOAD_SUBMIT_WAIT_TIME);
            } else if (VTI.controller === 'posts' && VTI.action === 'index') {
                //Wait until the edit box closes to reenable the submit button click
                setTimeout(() => {
                    printer.debuglog("Ready for next edit!");
                    EnableUI("submit");
                    $("#skip-validate-tags")[0].checked = false;
                    VTI.is_validate_ready = true;
                }, QUICKEDIT_WAIT_TIME);
            }
        } else {
            printer.debuglog("Validation failed!");
            EnableUI("submit");
            VTI.is_validate_ready = true;
        }
    }
}

//Timer/callback functions

function RebindHotkey() {
    JSPLib.utility.namespaceWaitExecute({
        root: '#upload_tag_string, #post_tag_string',
        type: 'keydown',
        namespace: 'danbooru.submit_form',
        presence: true,
        interval: TIMER_POLL_INTERVAL,
        duration: JSPLib.utility.one_second * 5,
        found () {
            $('#upload_tag_string, #post_tag_string').off("keydown.danbooru.submit").off("keydown.danbooru.submit_form").on(JSPLib.program_keydown, null, "ctrl+return", (event) => {
                $("#validate-tags").click();
                event.preventDefault();
            });
        },
    });
}

//Main execution functions

async function ValidateTagAdds() {
    const printer = JSPLib.debug.getFunctionPrint('ValidateTagAdds');
    let post_edit_tags = GetCurrentTags();
    let positive_tags = JSPLib.utility.filterRegex(post_edit_tags, NEGATIVE_REGEX, true);
    let useraddtags = JSPLib.utility.arrayDifference(positive_tags, VTI.preedit_tags);
    let added_tags = JSPLib.utility.arrayDifference(useraddtags, GetNegativetags(post_edit_tags));
    printer.debuglog("Added tags:", added_tags);
    if ((added_tags.length === 0) || IsSkipValidate()) {
        printer.debuglog("Skipping!");
        $("#warning-new-tags, #warning-deprecated-tags").hide();
        return true;
    }
    let status = true;
    let {deprecated_tags, empty_tags} = await QueryTags(added_tags);
    let final_empty = JSPLib.utility.arrayIntersection(added_tags, empty_tags);
    if (final_empty.length > 0) {
        printer.debuglog("Empty tags:", final_empty);
        $("#validation-input").show();
        $("#warning-new-tags").show();
        $("#warning-new-tags")[0].innerHTML = '<strong>Warning</strong>: The following new tags will be created:  ' + final_empty.join(', ');
        status = false;
    } else {
        $("#warning-new-tags").hide();
    }
    let final_deprecated = JSPLib.utility.arrayIntersection(added_tags, deprecated_tags);
    if (final_deprecated.length > 0) {
        printer.debuglog("Deprecated tags:", final_deprecated);
        $("#validation-input").show();
        $("#warning-deprecated-tags").show();
        $("#warning-deprecated-tags")[0].innerHTML = '<strong>Warning</strong>: The following tags are deprecated:  ' + final_deprecated.join(', ');
        status = false;
    } else {
        $("#warning-deprecated-tags").hide();
    }
    if (status) {
        printer.debuglog("Free and clear to submit!");
        $("#warning-new-tags").hide();
    }
    return status;
}

async function ValidateTagRemoves() {
    const printer = JSPLib.debug.getFunctionPrint('ValidateTagRemoves');
    if (!VTI.implication_check_enabled || IsSkipValidate()) {
        printer.debuglog("Skipping!");
        $("#warning-bad-removes").hide();
        return true;
    }
    await VTI.implications_promise;
    let post_edit_tags = TransformTypetags(GetCurrentTags());
    let deleted_tags = JSPLib.utility.arrayDifference(VTI.preedit_tags, post_edit_tags);
    let negated_tags = JSPLib.utility.arrayIntersection(GetNegativetags(post_edit_tags), post_edit_tags);
    let removed_tags = deleted_tags.concat(negated_tags);
    let final_tags = JSPLib.utility.arrayDifference(post_edit_tags, removed_tags);
    printer.debuglog("Final tags:", final_tags);
    printer.debuglog("Removed tags:", deleted_tags, negated_tags);
    let all_relations = [];
    removed_tags.forEach((tag) => {
        let bad_removes = JSPLib.utility.arrayIntersection(GetAllRelations(tag, VTI.implicationdict), final_tags);
        if (bad_removes.length) {
            all_relations.push(bad_removes.toString() + ' -> ' + tag);
        }
    });
    if (all_relations.length) {
        printer.debuglog("Bad removes:\n" + all_relations.join('\n'));
        $("#validation-input").show();
        $("#warning-bad-removes").show();
        $("#warning-bad-removes")[0].innerHTML = '<strong>Notice</strong>: The following implication relations prevent certain tag removes:<br>' + all_relations.join('<br>');
        return false;
    }
    printer.debuglog("Free and clear to submit!");
    $("#warning-bad-removes").hide();
    return true;
}

async function ValidateTagDeprecations() {
    //Temporarily needed since it was exported
    return true;
}

function ValidateUpload() {
    const printer = JSPLib.debug.getFunctionPrint('ValidateUpload');
    if (!VTI.upload_check_enabled || !VTI.is_upload || IsSkipValidate()) {
        printer.debuglog("Skipping!");
        $("#warning-bad-upload").hide();
        return true;
    }
    let errormessages = [];
    let ratingtag = Boolean(JSPLib.utility.filterRegex(GetTagList(), /^rating:\w/).length);
    let ratingradio = $(".post_rating input").toArray().some((input) => input.checked);
    if (!ratingtag && !ratingradio) {
        errormessages.push("Must specify a rating.");
    }
    if (errormessages.length) {
        printer.debuglog("Errors: " + errormessages.join(' '));
        $("#validation-input").show();
        $("#warning-bad-upload").show();
        $("#warning-bad-upload")[0].innerHTML = '<strong>Warning</strong>: ' + errormessages.join(' ');
        return false;
    }
    printer.debuglog("Free and clear to submit!");
    $("#warning-bad-upload").hide();
    return true;
}

async function ValidateArtist() {
    const printer = JSPLib.debug.getFunctionPrint('ValidateArtist');
    let source_url = $("#post_source").val();
    let artist_names = $(".artist-tag-list .tag-type-1 .wiki-link").map((_i, entry) => decodeURIComponent(JSPLib.utility.parseParams(entry.search.slice(1)).name)).toArray();
    if (artist_names.length === 0 && !VTI.preedit_tags.includes('official_art')) {
        //Validate no artist tag
        let option_html = "";
        if (!source_url.match(/https?:\/\//)) {
            printer.debuglog("Not a URL.");
            return;
        }
        let source_resp = await JSPLib.danbooru.submitRequest('source', {url: source_url}, {default_val: {artist: {name: null}}});
        if (source_resp.artist.name === null) {
            printer.debuglog("Not a first-party source.");
            return;
        }
        if (source_resp.artists.length) {
            let artist_list = source_resp.artists.map((artist) => `<a href="/artists/show_or_new?name=${artist.name}">${artist.name}</a>`);
            let artist_html = `There is an available artist tag for this post [${artist_list.join(', ')}]. Open the edit menu and consider adding it.`;
            VTI.validate_lines.push(artist_html);
        } else {
            if (!VTI.preedit_tags.includes('artist_request')) {
                option_html = `<br>...or, consider adding at least <a href="/wiki_pages/artist_request">artist request</a> or <a href="/wiki_pages/official_art">official art</a> as applicable.`;
            }
            let new_artist_addons = $.param({artist: {source: source_url}});
            let artist_html = `Artist tag is required. <a href="/artists/new?${new_artist_addons}">Create new artist entry</a>. Ask on the forum if you need naming help.`;
            VTI.validate_lines = VTI.validate_lines.concat([artist_html + option_html]);
        }
    } else {
        //Validate artists have entry
        let artist_keys = artist_names.map((name) => 'are-' + name);
        let cached = await JSPLib.storage.batchCheckLocalDB(artist_keys, ARTIST_EXPIRATION, 'are');
        let missing_keys = JSPLib.utility.arrayDifference(artist_keys, Object.keys(cached));
        if (missing_keys.length === 0) {
            printer.debuglog("No missing artists. [cache hit]");
            return;
        }
        let missing_artists = missing_keys.map((key) => key.replace(/^are-/, ""));
        let tag_resp = await JSPLib.danbooru.submitRequest('tags', {search: {name_space: missing_artists.join(' '), has_artist: true}, only: TAG_FIELDS}, {default_val: []});
        let mapped_artists = {};
        tag_resp.forEach((entry) => {
            mapped_artists['are-' + entry.name] = {value: true, expires: JSPLib.utility.getExpires(ARTIST_EXPIRATION)};
        });
        JSPLib.storage.batchSaveData(mapped_artists);
        let found_artists = JSPLib.utility.getObjectAttributes(tag_resp, 'name');
        let unfound_artists = JSPLib.utility.arrayDifference(missing_artists, found_artists);
        if (unfound_artists.length === 0) {
            printer.debuglog("No missing artists. [cache miss]");
            return;
        }
        let artist_lines = unfound_artists.map((artist) => {
            let new_artist_addons = $.param({artist: {source: source_url, name: artist}});
            return `
            Artist <a href="/artists/show_or_new?name=${artist}">${artist}</a> requires an artist entry.
            <a href="/artists/new?${new_artist_addons}">Create new artist entry</a>`;
        });
        VTI.validate_lines = VTI.validate_lines.concat(artist_lines);
    }
    JSPLib.notice.notice(VTI.validate_lines.join('<hr>'), true);
}

function ValidateCopyright() {
    const printer = JSPLib.debug.getFunctionPrint('ValidateCopyright');
    let copyright_names_length = $(".copyright-tag-list .tag-type-3 .wiki-link").length;
    if (copyright_names_length) {
        printer.debuglog("Has a copyright.");
        return;
    } if (VTI.preedit_tags.includes('copyright_request')) {
        printer.debuglog("Has copyright request.");
        return;
    }
    let copyright_html = `Copyright tag is required. Consider adding <a href="/wiki_pages/copyright_request">copyright request</a> or <a href="/wiki_pages/original">original</a>.`;
    VTI.validate_lines.push(copyright_html);
    JSPLib.notice.notice(VTI.validate_lines.join('<br>'), true);
}

function ValidateGeneral() {
    const printer = JSPLib.debug.getFunctionPrint('ValidateGeneral');
    let general_tags_length = $(".general-tag-list .tag-type-0 .wiki-link").length;
    if (general_tags_length < VTI.general_minimum_threshold) {
        VTI.validate_lines.push("Posts must have at least 10 general tags. Please add some more tags. " + HOW_TO_TAG);
    } else if (VTI.general_low_threshold && general_tags_length < VTI.general_low_threshold) {
        VTI.validate_lines.push("The post has a low amount of general tags. Consider adding more. " + HOW_TO_TAG);
    } else if (VTI.general_moderate_threshold && general_tags_length < VTI.general_moderate_threshold) {
        VTI.validate_lines.push("The post has a moderate amount of general tags, but could potentially need more. " + HOW_TO_TAG);
    } else {
        printer.debuglog("Has enough tags.");
        return;
    }
    JSPLib.notice.notice(VTI.validate_lines.join('<br>'), true);
}

function CleanupTasks() {
    JSPLib.storage.pruneProgramCache(PROGRAM_DATA_REGEX, PRUNE_EXPIRES);
}

//Settings functions

function InitializeProgramValues() {
    Object.assign(VTI, {
        is_upload: (VTI.action === 'show' && (VTI.controller === 'uploads' || VTI.controller === 'upload-media-assets')),
        is_post_show: (VTI.controller === 'posts' && VTI.action === 'show'),
        is_post_index: (VTI.controller === 'posts' && VTI.action === 'index'),
        was_upload: JSPLib.storage.getSessionData('vti-was-upload', {default_val: false}),
    });
    Object.assign(VTI, {
        preedit_tags: (VTI.is_post_show ? $(".image-container").data('tags').split(' ') : [] ),
    });
    if (VTI.is_upload) {
        JSPLib.storage.setSessionData('vti-was-upload', true);
    } else {
        JSPLib.storage.setSessionData('vti-was-upload', false);
    }
    return true;
}

function RenderSettingsMenu() {
    $('#validate-tag-input').append(JSPLib.menu.renderMenuFramework(MENU_CONFIG));
    $("#vti-general-settings").append(JSPLib.menu.renderDomainSelectors());
    $('#vti-pre-edit-settings-message').append(JSPLib.menu.renderExpandable("Additional setting details", PREEDIT_SETTINGS_DETAILS));
    $("#vti-pre-edit-settings").append(JSPLib.menu.renderCheckbox('single_session_warning'));
    $("#vti-pre-edit-settings").append(JSPLib.menu.renderCheckbox('artist_check_enabled'));
    $("#vti-pre-edit-settings").append(JSPLib.menu.renderCheckbox('copyright_check_enabled'));
    $("#vti-pre-edit-settings").append(JSPLib.menu.renderCheckbox('general_check_enabled'));
    $("#vti-pre-edit-settings").append(JSPLib.menu.renderTextinput('general_minimum_threshold', 10));
    $("#vti-pre-edit-settings").append(JSPLib.menu.renderTextinput('general_low_threshold', 10));
    $("#vti-pre-edit-settings").append(JSPLib.menu.renderTextinput('general_moderate_threshold', 10));
    $('#vti-post-edit-settings-message').append(JSPLib.menu.renderExpandable("Additional setting details", POSTEDIT_SETTINGS_DETAILS));
    $("#vti-post-edit-settings").append(JSPLib.menu.renderCheckbox('implication_check_enabled'));
    $("#vti-post-edit-settings").append(JSPLib.menu.renderCheckbox('upload_check_enabled'));
    $("#vti-post-edit-settings").append(JSPLib.menu.renderCheckbox('approval_check_enabled'));
    $('#vti-controls').append(JSPLib.menu.renderCacheControls());
    $('#vti-cache-controls-message').append(JSPLib.menu.renderExpandable("Cache Data details", CACHE_DATA_DETAILS));
    $("#vti-cache-controls").append(JSPLib.menu.renderLinkclick('cache_info', true));
    $('#vti-cache-controls').append(JSPLib.menu.renderCacheInfoTable());
    $("#vti-cache-controls").append(JSPLib.menu.renderLinkclick('purge_cache', true));
    $('#vti-controls').append(JSPLib.menu.renderCacheEditor(true));
    $('#vti-cache-editor-message').append(JSPLib.menu.renderExpandable("Program Data details", PROGRAM_DATA_DETAILS));
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
    const printer = JSPLib.debug.getFunctionPrint('Main');
    const preload = {
        run_on_settings: false,
        default_data: DEFAULT_VALUES,
        initialize_func: InitializeProgramValues,
        render_menu_func: RenderSettingsMenu,
        program_css: PROGRAM_CSS,
    };
    if (!JSPLib.menu.preloadScript(VTI, preload)) return;
    $("#form [name=commit],#quick-edit-form [name=commit]").after(SUBMIT_BUTTON).hide();
    if (VTI.is_post_index) {
        $(".post-preview a").on(JSPLib.program_click, PostModeMenu);
        $("#quick-edit-form").append(INPUT_VALIDATOR);
        $("#quick-edit-form").after(WARNING_MESSAGES);
    } else {
        $("#related-tags-container").before(INPUT_VALIDATOR);
        $("#related-tags-container").before(WARNING_MESSAGES);
    }
    if (VTI.is_post_show) {
        printer.debuglog("Preedit tags:", VTI.preedit_tags);
        if (VTI.implication_check_enabled) {
            $(document).on('danbooru:open-post-edit-tab.vti danbooru:open-post-edit-dialog.vti', () => {
                VTI.implications_promise = QueryTagImplications(VTI.preedit_tags);
                VTI.implications_promise.then(() => {
                    printer.debuglog("Adding auto implications");
                    GetAutoImplications();
                });
                $(document).off('danbooru:open-post-edit-tab.vti danbooru:open-post-edit-dialog.vti');
            });
        }
        let post_id = parseInt(JSPLib.utility.getMeta('post-id'));
        let seen_post_list = JSPLib.storage.getSessionData('vti-seen-postlist', {default_val: []});
        if (!VTI.was_upload && (!VTI.single_session_warning || !seen_post_list.includes(post_id))) {
            if (VTI.artist_check_enabled) {
                ValidateArtist();
            }
            if (VTI.copyright_check_enabled) {
                ValidateCopyright();
            }
            if (VTI.general_check_enabled) {
                ValidateGeneral();
            }
        } else {
            printer.debuglog("Already pre-validated post.");
        }
        JSPLib.storage.setSessionData('vti-seen-postlist', JSPLib.utility.arrayUnique(seen_post_list.concat(post_id)));
    } else if (VTI.is_upload) {
        let $pending_input = $('.post_is_pending').detach();
        $("#check-tags").after($pending_input);
    }
    $("#validate-tags").on(JSPLib.program_click, ValidateTags);
    $("#check-tags").on(JSPLib.program_click, CheckTags);
    RebindHotkey();
    JSPLib.statistics.addPageStatistics();
    JSPLib.load.noncriticalTasks(CleanupTasks);
}

/****Initialization****/

//Variables for JSPLib

JSPLib.program_name = PROGRAM_NAME;
JSPLib.program_shortcut = PROGRAM_SHORTCUT;
JSPLib.program_data = VTI;

//Variables for debug.js
JSPLib.debug.mode = false;
JSPLib.debug.level = JSPLib.debug.INFO;

//Variables for menu.js
JSPLib.menu.program_data_regex = PROGRAM_DATA_REGEX;
JSPLib.menu.program_data_key = PROGRAM_DATA_KEY;
JSPLib.menu.settings_config = SETTINGS_CONFIG;
JSPLib.menu.control_config = CONTROL_CONFIG;

//Variables for storage.js
JSPLib.storage.indexedDBValidator = ValidateEntry;

//Export JSPLib
JSPLib.load.exportData({write_list: ['preedit_tags']});
JSPLib.load.exportFuncs({always_list: [ValidateTagAdds, ValidateTagRemoves, ValidateTagDeprecations, ValidateUpload, PreloadImplications]});

/****Execution start****/

JSPLib.load.programInitialize(Main, {required_variables: PROGRAM_LOAD_REQUIRED_VARIABLES, optional_selectors: PROGRAM_LOAD_OPTIONAL_SELECTORS});
