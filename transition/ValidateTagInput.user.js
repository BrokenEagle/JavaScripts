// ==UserScript==
// @name         ValidateTagInput
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      29.4
// @description  Validates tag add/remove inputs on a post edit or upload, plus several other post validations.
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        *://*.donmai.us/
// @match        *://*.donmai.us/posts*
// @match        *://*.donmai.us/uploads/*
// @match        *://*.donmai.us/settings
// @exclude      /^https?://\w+\.donmai\.us/.*\.(xml|json|atom)(\?|$)/
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/transition/ValidateTagInput.user.js
// @updateURL    https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/transition/ValidateTagInput.user.js
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
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/menu.js
// ==/UserScript==

/* global JSPLib $ */

/****Global variables****/

//Library constants

////NONE

//Exterior script variables
const DANBOORU_TOPIC_ID = '14474';

//Variables for load.js
const PROGRAM_LOAD_REQUIRED_VARIABLES = ['window.jQuery','window.Danbooru'];
const PROGRAM_LOAD_OPTIONAL_SELECTORS = ['#c-posts #a-show', '#c-posts #a-index', '#c-uploads #a-show', '#c-upload-media-assets #a-show', '#c-users #a-edit'];

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
const VTI = {};

//Main settings
const SETTINGS_CONFIG = {
    alias_check_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Checks and removes aliased tags from tag add validation."
    },
    implication_check_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Turns off querying implications for tag remove validation."
    },
    upload_check_enabled: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Performs the same rating and source checks that Danbooru does."
    },
    approval_check_enabled: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Confirms sending an upload for approval (Contributors only)."
    },
    artist_check_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Does a check for any artist tags or artist entries."
    },
    copyright_check_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: 'Checks for the existence of any copyright tag or the <a href="/wiki_pages/show_or_new?title=copyright_request">copyright request</a> tag.'
    },
    general_check_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
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
        validate: JSPLib.validate.isBoolean,
        hint: "Pre-edit warnings will only appear once per post per tab session."
    }
};

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
        buttons: ['get', 'save', 'delete', 'list', 'refresh'],
        hint: "Click <b>Get</b> to see the data, <b>Save</b> to edit it, and <b>Delete</b> to remove it.<br><b>List</b> shows keys in their raw format, and <b>Refresh</b> checks the keys again.",
    },
};

const MENU_CONFIG = {
    topic_id: DANBOORU_TOPIC_ID,
    settings: [{
        name: 'general',
    },{
        name: 'pre-edit',
        message: "These settings affect validations when a post page is initially loaded.",
    },{
        name: 'post-edit',
        message: "These settings affect validations when submitting a post edit.",
    }],
    controls: [],
};

// Default values

const DEFAULT_VALUES = {
    aliastags: [],
    seenlist: [],
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
const quickedit_wait_time = 1000;

const UPLOAD_SUBMIT_WAIT_TIME = JSPLib.utility.one_second * 5;

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
const striptype_regex = /^(-?)(?:general:|gen:|artist:|art:|copyright:|copy:|co:|character:|char:|ch:|meta:)?(.*)/i;
const cosplay_regex = /^(.+)_\(cosplay\)$/;
const school_regex = /^(.+)_school_uniform$/;

//Network constants

const QUERY_LIMIT = 100;

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
};

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
    this.debug('log',"Bad key!");
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

////NONE

//Helper functions

function GetTagList() {
    return JSPLib.utility.filterEmpty(StripQuoteSourceMetatag($("#upload_tag_string,#post_tag_string").val() || "").split(/[\s\n]+/).map((tag) => tag.toLowerCase()));
}

function StripQuoteSourceMetatag(str) {
    return str.replace(/source:"[^"]+"\s?/g,'');
}

function GetNegativetags(array) {
    return JSPLib.utility.filterRegex(array,negative_regex,false).map((value) => value.substring(1));
}

function TransformTypetags(array) {
    return array.map((value) => value.match(striptype_regex).splice(1).join(''));
}

function GetCurrentTags() {
    return JSPLib.utility.filterRegex(JSPLib.utility.filterRegex(GetTagList(),metatags_regex,true),typetags_regex,true);
}

function GetAutoImplications() {
    VTI.preedittags.forEach((tag)=>{
        let match = tag.match(cosplay_regex);
        if (match) {
            let base_tag = match[1];
            this.debug('log',"Found:",tag,'->','cosplay');
            this.debug('log',"Found:",tag,'->',base_tag);
            VTI.implicationdict.cosplay = VTI.implicationdict.cosplay || [];
            VTI.implicationdict.cosplay.push(tag);
            VTI.implicationdict[base_tag] = VTI.implicationdict[base_tag] || [];
            VTI.implicationdict[base_tag].push(tag);
        }
        match = tag.match(school_regex);
        if (match) {
            this.debug('log',"Found:",tag,'->','school_uniform');
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
    let unseen_tags = JSPLib.utility.arrayDifference(taglist, VTI.seenlist);
    let [cached_aliases,uncached_aliases] = await JSPLib.storage.batchStorageCheck(unseen_tags, ValidateEntry, relation_expiration, 'ta');
    this.debug('log',"Cached aliases:", cached_aliases);
    this.debug('log',"Uncached aliases:", uncached_aliases);
    if (uncached_aliases.length) {
        let options = {url_addons: {search: {antecedent_name_space: uncached_aliases.join(' '), status:'active'}, only: relation_fields}, long_format: true};
        let all_aliases = await JSPLib.danbooru.getAllItems('tag_aliases', QUERY_LIMIT, options);
        let found_aliases = [];
        all_aliases.forEach((alias)=>{
            found_aliases.push(alias.antecedent_name);
            JSPLib.storage.saveData('ta-' + alias.antecedent_name, {value: [alias.consequent_name], expires: JSPLib.utility.getExpires(relation_expiration)});
        });
        let unfound_aliases = JSPLib.utility.arrayDifference(uncached_aliases, found_aliases);
        unfound_aliases.forEach((tag)=>{
            JSPLib.storage.saveData('ta-' + tag, {value: [], expires: JSPLib.utility.getExpires(relation_expiration)});
        });
        VTI.aliastags = JSPLib.utility.concat(VTI.aliastags, found_aliases);
        this.debug('log',"Found aliases:", found_aliases);
        this.debug('log',"Unfound aliases:", unfound_aliases);
    }
    cached_aliases.forEach((tag)=>{
        let data = JSPLib.storage.getIndexedSessionData('ta-' + tag, {value: []}).value;
        if (data.length) {
            VTI.aliastags.push(tag);
        }
    });
    VTI.seenlist = JSPLib.utility.concat(VTI.seenlist, unseen_tags);
    this.debug('log',"Aliases:", VTI.aliastags);
}

//Queries implications of preexisting tags... called once per image
async function QueryTagImplications(taglist) {
    let [cached_implications,uncached_implications] = await JSPLib.storage.batchStorageCheck(taglist, ValidateEntry, relation_expiration, 'ti');
    this.debug('log',"Cached implications:", cached_implications);
    this.debug('log',"Uncached implications:", uncached_implications);
    if (uncached_implications.length) {
        let options = {url_addons: {search: {consequent_name_space: uncached_implications.join(' '), status:'active'}, only: relation_fields}, long_format: true};
        let all_implications = await JSPLib.danbooru.getAllItems('tag_implications', QUERY_LIMIT, options);
        all_implications.forEach((implication)=>{
            let tag = implication.consequent_name;
            VTI.implicationdict[tag] = VTI.implicationdict[tag] || [];
            VTI.implicationdict[tag].push(implication.antecedent_name);
        });
        for (let tag in VTI.implicationdict) {
            JSPLib.storage.saveData('ti-' + tag, {value: VTI.implicationdict[tag], expires: JSPLib.utility.getExpires(relation_expiration)});
        }
        let found_implications = Object.keys(VTI.implicationdict);
        let unfound_implications = JSPLib.utility.arrayDifference(uncached_implications, found_implications);
        unfound_implications.forEach((tag)=>{
            JSPLib.storage.saveData('ti-' + tag, {value: [], expires: JSPLib.utility.getExpires(relation_expiration)});
        });
        this.debug('log',"Found implications:", found_implications);
        this.debug('log',"Unfound implications:", unfound_implications);
    }
    cached_implications.forEach((tag)=>{
        let data = JSPLib.storage.getIndexedSessionData('ti-' + tag).value;
        if (data.length) {
            VTI.implicationdict[tag] = data;
        }
    });
    this.debug('log',"Implications:", VTI.implicationdict);
}

//Event handlers

function PostModeMenu(event) {
    let s = $("#mode-box select").val();
    if (s === "edit") {
        $("#validation-input,#warning-bad-upload,#warning-new-tags,#warning-bad-removes").hide();
        let post_id = $(event.target).closest("article").data("id");
        let $post = $("#post_" + post_id);
        VTI.preedittags = $post.data("tags").split(' ');
        this.debug('log',"Preedit tags:",VTI.preedittags);
        //Wait until the edit box loads before querying implications
        if (VTI.user_settings.implication_check_enabled) {
            setTimeout(()=>{
                VTI.implications_promise = QueryTagImplications(VTI.preedittags);
                VTI.implications_promise.then(()=>{
                    this.debug('log',"Adding auto implications");
                    GetAutoImplications();
                });
            },quickedit_wait_time);
        }
        event.preventDefault();
    }
}

async function CheckTags() {
    //Prevent code from being reentrant until finished processing
    if (VTI.is_check_ready) {
        VTI.is_check_ready = false;
        DisableUI("check");
        let statuses = (await Promise.all([ValidateTagAdds(),ValidateTagRemoves(),ValidateUpload()]));
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
    //Prevent code from being reentrant until finished processing
    if (VTI.is_validate_ready) {
        VTI.is_validate_ready = false;
        DisableUI("submit");
        let statuses = await Promise.all([ValidateTagAdds(),ValidateTagRemoves(),ValidateUpload()]);
        if (statuses.every((item) => item)) {
            if (VTI.user_settings.approval_check_enabled && $('#post_is_pending').prop('checked') && !confirm("Submit upload for approval?")) {
                VTI.is_validate_ready = true;
                EnableUI("submit");
                return;
            }
            this.debug('log',"Submit request!");
            $("#form [name=commit],#quick-edit-form [name=commit]").click();
            if ((VTI.controller === 'uploads' && VTI.action === 'new') || (VTI.controller === 'posts' && VTI.controller === 'show')) {
                this.debug('log',"Disabling return key!");
                $("#upload_tag_string,#post_tag_string").off("keydown.vti");
            }
            if (VTI.is_upload) {
                setTimeout(()=>{
                    EnableUI("submit");
                    RebindHotkey();
                    VTI.is_validate_ready = true;
                    JSPLib.notice.error('Submission timed out: check client form for errors. (<a href="#client-errors">navigate</a>)');
                }, UPLOAD_SUBMIT_WAIT_TIME);
            } else if (VTI.controller === 'posts' && VTI.action === 'index') {
                //Wait until the edit box closes to reenable the submit button click
                setTimeout(()=>{
                    this.debug('log',"Ready for next edit!");
                    EnableUI("submit");
                    $("#skip-validate-tags")[0].checked = false;
                    VTI.is_validate_ready = true;
                },quickedit_wait_time);
            }
        } else {
            this.debug('log',"Validation failed!");
            EnableUI("submit");
            VTI.is_validate_ready = true;
        }
    }
}

//Timer/callback functions

function RebindHotkey() {
    JSPLib.utility.recheckTimer({
        check: ()=>{return JSPLib.utility.isNamespaceBound("#upload_tag_string,#post_tag_string",'keydown','danbooru.submit_form');},
        exec: ()=>{
            $("#upload_tag_string,#post_tag_string").off("keydown.danbooru.submit").off("keydown.danbooru.submit_form").on("keydown.vti", null, "ctrl+return", (event)=>{
                $("#validate-tags").click();
                event.preventDefault();
            });
        }
    },timer_poll_interval);
}

//Main execution functions

async function ValidateTagAdds() {
    let postedittags = GetCurrentTags();
    let positivetags = JSPLib.utility.filterRegex(postedittags,negative_regex,true);
    let useraddtags = JSPLib.utility.arrayDifference(positivetags,VTI.preedittags);
    VTI.addedtags = JSPLib.utility.arrayDifference(useraddtags,GetNegativetags(postedittags));
    this.debug('log',"Added tags:",VTI.addedtags);
    if ((VTI.addedtags.length === 0) || IsSkipValidate()) {
        this.debug('log',"Skipping!");
        $("#warning-new-tags").hide();
        return true;
    }
    let options = {url_addons: {search: {name_space: VTI.addedtags.join(' '), hide_empty: 'yes'}, only: tag_fields}, long_format: true};
    let all_aliases = await JSPLib.danbooru.getAllItems('tags', QUERY_LIMIT, options);
    VTI.checktags = JSPLib.utility.getObjectAttributes(all_aliases, 'name');
    let nonexisttags = JSPLib.utility.arrayDifference(VTI.addedtags,VTI.checktags);
    if (VTI.user_settings.alias_check_enabled) {
        await QueryTagAliases(nonexisttags);
        nonexisttags = JSPLib.utility.arrayDifference(nonexisttags,VTI.aliastags);
    }
    if (nonexisttags.length > 0) {
        this.debug('log',"Nonexistant tags!");
        nonexisttags.forEach((tag,i)=>{this.debug('log',i,tag);});
        $("#validation-input").show();
        $("#warning-new-tags").show();
        let taglist = nonexisttags.join(', ');
        $("#warning-new-tags")[0].innerHTML = '<strong>Warning</strong>: The following new tags will be created:  ' + taglist;
        return false;
    }
    this.debug('log',"Free and clear to submit!");
    $("#warning-new-tags").hide();
    return true;
}

async function ValidateTagRemoves() {
    if (!VTI.user_settings.implication_check_enabled || IsSkipValidate()) {
        this.debug('log',"Skipping!");
        $("#warning-bad-removes").hide();
        return true;
    }
    await VTI.implications_promise;
    let postedittags = TransformTypetags(GetCurrentTags());
    let deletedtags = JSPLib.utility.arrayDifference(VTI.preedittags,postedittags);
    let negatedtags = JSPLib.utility.arrayIntersection(GetNegativetags(postedittags),postedittags);
    let removedtags = deletedtags.concat(negatedtags);
    let finaltags = JSPLib.utility.arrayDifference(postedittags,removedtags);
    this.debug('log',"Final tags:",finaltags);
    this.debug('log',"Removed tags:",deletedtags,negatedtags);
    let allrelations = [];
    removedtags.forEach((tag)=>{
        let badremoves = JSPLib.utility.arrayIntersection(GetAllRelations(tag,VTI.implicationdict),finaltags);
        if (badremoves.length) {
            allrelations.push(badremoves.toString() + ' -> ' + tag);
        }
    });
    if (allrelations.length) {
        JSPLib.debug.debugExecute(()=>{
            this.debug('log',"Badremove tags!");
            allrelations.forEach((relation,i)=>{this.debug('log',i,relation);});
        });
        $("#validation-input").show();
        $("#warning-bad-removes").show();
        let removelist = allrelations.join('<br>');
        $("#warning-bad-removes")[0].innerHTML = '<strong>Notice</strong>: The following implication relations prevent certain tag removes:<br>' + removelist;
        return false;
    }
    this.debug('log',"Free and clear to submit!");
    $("#warning-bad-removes").hide();
    return true;
}

function ValidateUpload() {
    if (!VTI.user_settings.upload_check_enabled || !VTI.is_upload || IsSkipValidate()) {
        this.debug('log',"Skipping!");
        $("#warning-bad-upload").hide();
        return true;
    }
    let errormessages = [];
    let ratingtag = Boolean(JSPLib.utility.filterRegex(GetTagList(),/^rating:\w/).length);
    let ratingradio = $(".post_rating input").toArray().some((input) => input.checked);
    if (!ratingtag && !ratingradio) {
        errormessages.push("Must specify a rating.");
    }
    if (errormessages.length) {
        this.debug('log',"Errors: " + errormessages.join(' '));
        $("#validation-input").show();
        $("#warning-bad-upload").show();
        $("#warning-bad-upload")[0].innerHTML = '<strong>Warning</strong>: ' + errormessages.join(' ');
        return false;
    }
    this.debug('log',"Free and clear to submit!");
    $("#warning-bad-upload").hide();
    return true;
}

async function ValidateArtist() {
    let source_url = $("#post_source").val();
    let artist_names = $(".artist-tag-list .tag-type-1 .wiki-link").map((i,entry) => decodeURIComponent(JSPLib.utility.parseParams(entry.search.slice(1)).name)).toArray();
    if (artist_names.length === 0 && !VTI.preedittags.includes('official_art')) {
        //Validate no artist tag
        let option_html = "";
        if (!source_url.match(/https?:\/\//)) {
            this.debug('log',"Not a URL.");
            return;
        }
        let source_resp = await JSPLib.danbooru.submitRequest('source', {url: source_url}, {default_val: {artist: {name: null}}});
        if (source_resp.artist.name === null) {
            this.debug('log',"Not a first-party source.");
            return;
        }
        if (source_resp.artists.length) {
            let artist_list = source_resp.artists.map((artist) => `<a href="/artists/show_or_new?name=${artist.name}">${artist.name}</a>`);
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
        let [,uncached_artists] = await JSPLib.storage.batchStorageCheck(artist_names,ValidateEntry,artist_expiration,'are');
        if (uncached_artists.length === 0) {
            this.debug('log',"No missing artists. [cache hit]");
            return;
        }
        let tag_resp = await JSPLib.danbooru.submitRequest('tags', {search: {name_space: uncached_artists.join(' '), has_artist: true}, only: tag_fields}, {default_val: []});
        tag_resp.forEach((entry)=>{
            JSPLib.storage.saveData('are-' + entry.name,{value: true, expires: JSPLib.utility.getExpires(artist_expiration)});
        });
        let found_artists = JSPLib.utility.getObjectAttributes(tag_resp,'name');
        let missing_artists = JSPLib.utility.arrayDifference(uncached_artists,found_artists);
        if (missing_artists.length === 0) {
            this.debug('log',"No missing artists. [cache miss]");
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
    JSPLib.notice.notice(VTI.validate_lines.join('<hr>'),true);
}

function ValidateCopyright() {
    let copyright_names_length = $(".copyright-tag-list .tag-type-3 .wiki-link").length;
    if (copyright_names_length) {
        this.debug('log',"Has a copyright.");
        return;
    } else if (VTI.preedittags.includes('copyright_request')) {
        this.debug('log',"Has copyright request.");
        return;
    }
    let copyright_html = `Copyright tag is required. Consider adding <a href="/wiki_pages/copyright_request">copyright request</a> or <a href="/wiki_pages/original">original</a>.`;
    VTI.validate_lines.push(copyright_html);
    JSPLib.notice.notice(VTI.validate_lines.join('<br>'),true);
}

function ValidateGeneral() {
    let general_tags_length = $(".general-tag-list .tag-type-0 .wiki-link").length;
    if (general_tags_length < VTI.user_settings.general_minimum_threshold) {
        VTI.validate_lines.push("Posts must have at least 10 general tags. Please add some more tags. " + HOW_TO_TAG);
    } else if (VTI.user_settings.general_low_threshold && general_tags_length < VTI.user_settings.general_low_threshold) {
        VTI.validate_lines.push("The post has a low amount of general tags. Consider adding more. " + HOW_TO_TAG);
    } else if (VTI.user_settings.general_moderate_threshold && general_tags_length < VTI.user_settings.general_moderate_threshold) {
        VTI.validate_lines.push("The post has a moderate amount of general tags, but could potentially need more. " + HOW_TO_TAG);
    } else {
        this.debug('log',"Has enough tags.");
        return;
    }
    JSPLib.notice.notice(VTI.validate_lines.join('<br>'),true);
}

function CleanupTasks() {
    JSPLib.storage.pruneEntries(PROGRAM_SHORTCUT, PROGRAM_DATA_REGEX, prune_expires);
}

//Settings functions

function InitializeProgramValues() {
    Object.assign(VTI, {
        is_upload: (VTI.action === 'show' && (VTI.controller === 'uploads' || VTI.controller === 'upload-media-assets')),
        is_post_show: (VTI.controller === 'posts' && VTI.action === 'show'),
        is_post_index: (VTI.controller === 'posts' && VTI.action === 'index'),
        was_upload: JSPLib.storage.getStorageData('vti-was-upload',sessionStorage,false),
    });
    Object.assign(VTI, {
        preedittags: (VTI.is_post_show ? $(".image-container").data('tags').split(' ') : [] ),
    });
    if (VTI.is_upload) {
        JSPLib.storage.setStorageData('vti-was-upload',true,sessionStorage);
    } else {
        JSPLib.storage.setStorageData('vti-was-upload',false,sessionStorage);
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
    $("#vti-pre-edit-settings").append(JSPLib.menu.renderTextinput('general_minimum_threshold',10));
    $("#vti-pre-edit-settings").append(JSPLib.menu.renderTextinput('general_low_threshold',10));
    $("#vti-pre-edit-settings").append(JSPLib.menu.renderTextinput('general_moderate_threshold',10));
    $('#vti-post-edit-settings-message').append(JSPLib.menu.renderExpandable("Additional setting details", POSTEDIT_SETTINGS_DETAILS));
    $("#vti-post-edit-settings").append(JSPLib.menu.renderCheckbox('alias_check_enabled'));
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
    JSPLib.menu.saveCacheClick(ValidateProgramData,ValidateEntry);
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
    };
    if (!JSPLib.menu.preloadScript(VTI, RenderSettingsMenu, preload)) return;
    $("#form [name=commit],#quick-edit-form [name=commit]").after(submit_button).hide();
    if (VTI.is_post_index) {
        $(".post-preview a").on(PROGRAM_CLICK, PostModeMenu);
        $("#quick-edit-form").append(input_validator);
        $("#quick-edit-form").after(warning_messages);
    } else {
        $("#related-tags-container").before(input_validator);
        $("#related-tags-container").before(warning_messages);
    }
    if (VTI.is_post_show) {
        this.debug('log',"Preedit tags:",VTI.preedittags);
        if (VTI.user_settings.implication_check_enabled) {
            VTI.implications_promise = QueryTagImplications(VTI.preedittags);
            VTI.implications_promise.then(()=>{
                this.debug('log',"Adding auto implications");
                GetAutoImplications();
            });
        }
        let post_id = parseInt(JSPLib.utility.getMeta('post-id'));
        let seen_post_list = JSPLib.storage.getStorageData('vti-seen-postlist',sessionStorage,[]);
        if (!VTI.was_upload && (!VTI.user_settings.single_session_warning || !seen_post_list.includes(post_id))) {
            if (VTI.user_settings.artist_check_enabled) {
                ValidateArtist();
            }
            if (VTI.user_settings.copyright_check_enabled) {
                ValidateCopyright();
            }
            if (VTI.user_settings.general_check_enabled) {
                ValidateGeneral();
            }
        } else {
            this.debug('log',"Already pre-validated post.");
        }
        JSPLib.storage.setStorageData('vti-seen-postlist',JSPLib.utility.arrayUnique(seen_post_list.concat(post_id)),sessionStorage);
    } else if (VTI.is_upload) {
        let $pending_input = $('.post_is_pending').detach();
        $("#check-tags").after($pending_input);
    }
    $("#validate-tags").on(PROGRAM_CLICK, ValidateTags);
    $("#check-tags").on(PROGRAM_CLICK, CheckTags);
    RebindHotkey();
    JSPLib.utility.setCSSStyle(PROGRAM_CSS, 'program');
    JSPLib.statistics.addPageStatistics(PROGRAM_NAME);
    JSPLib.load.noncriticalTasks(CleanupTasks);
}

/****Function decoration****/

[
    Main, ValidateEntry, PostModeMenu, ValidateTags, GetAutoImplications,
    QueryTagAliases, QueryTagImplications, ValidateTagAdds, ValidateTagRemoves, ValidateUpload,
    ValidateArtist, ValidateCopyright, ValidateGeneral,
] = JSPLib.debug.addFunctionLogs([
    Main, ValidateEntry, PostModeMenu, ValidateTags, GetAutoImplications,
    QueryTagAliases, QueryTagImplications, ValidateTagAdds, ValidateTagRemoves, ValidateUpload,
    ValidateArtist, ValidateCopyright, ValidateGeneral,
]);

[
    RenderSettingsMenu,
    QueryTagAliases,QueryTagImplications,ValidateTagAdds,ValidateTagRemoves,ValidateArtist,
    ValidateTags,CheckTags,
] = JSPLib.debug.addFunctionTimers([
    //Sync
    RenderSettingsMenu,
    //Async
    QueryTagAliases,QueryTagImplications,ValidateTagAdds,ValidateTagRemoves,ValidateArtist,
    ValidateTags,CheckTags,
]);

/****Initialization****/

//Variables for debug.js
JSPLib.debug.debug_console = false;
JSPLib.debug.level = JSPLib.debug.INFO;
JSPLib.debug.program_shortcut = PROGRAM_SHORTCUT;

//Variables for menu.js
JSPLib.menu.program_shortcut = PROGRAM_SHORTCUT;
JSPLib.menu.program_name = PROGRAM_NAME;
JSPLib.menu.program_data = VTI;
JSPLib.menu.program_data_regex = PROGRAM_DATA_REGEX;
JSPLib.menu.program_data_key = PROGRAM_DATA_KEY;
JSPLib.menu.settings_config = SETTINGS_CONFIG;
JSPLib.menu.control_config = CONTROL_CONFIG;

//Export JSPLib
JSPLib.load.exportData(PROGRAM_NAME, VTI);

/****Execution start****/

JSPLib.load.programInitialize(Main, {program_name: PROGRAM_NAME, required_variables: PROGRAM_LOAD_REQUIRED_VARIABLES, optional_selectors: PROGRAM_LOAD_OPTIONAL_SELECTORS});
