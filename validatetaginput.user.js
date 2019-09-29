// ==UserScript==
// @name         ValidateTagInput
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      27.7
// @description  Validates tag add/remove inputs on a post edit or upload, plus several other post validations.
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        *://*.donmai.us/
// @match        *://*.donmai.us/posts*
// @match        *://*.donmai.us/uploads/new*
// @match        *://*.donmai.us/settings
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/validatetaginput.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.5.2/localforage.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.12.0/validate.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190929/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190929/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190929/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190929/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190929/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190929/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190929/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190929/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190929/lib/menu.js
// ==/UserScript==

/* global JSPLib $ Danbooru */

/****Global variables****/

//Variables for debug.js
JSPLib.debug.debug_console = false;
JSPLib.debug.pretext = "VTI:";
JSPLib.debug.pretimer = "VTI-";
JSPLib.debug.level = JSPLib.debug.INFO;

//Variables for load.js
const program_load_required_variables = ['window.jQuery','window.Danbooru'];
const program_load_required_selectors = ['#page'];

//Main program variable
var VTI;

//Timer function hash
const Timer = {};

//Regex that matches the prefix of all program cache data
const program_cache_regex = /^(ti|ta|are)-/;

//Main program expires
const prune_expires = JSPLib.utility.one_day;

//For factory reset
const localstorage_keys = [];
const program_reset_keys = {};

//Main settings
const settings_config = {
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

const how_to_tag = `Read <a href="/wiki_pages/show_or_new?title=howto%3atag">howto:tag</a> for how to tag.`;

const vti_menu = `
<div id="vti-script-message" class="prose">
    <h2>ValidateTagInput</h2>
    <p>Check the forum for the latest on information and updates (<a class="dtext-link dtext-id-link dtext-forum-topic-id-link" href="/forum_topics/14474">topic #14474</a>).</p>
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
                                    <li>Posts with <a href="/wiki_pages/show_or_new?title=artist_request">artist request</a> or <a href="/wiki_pages/show_or_new?title=official_art">official art</a> are ignored.</li>
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
                                    <li>I.e in the same location as the other <i>ValidateTagInput</i> warning messages.</li>
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

const all_source_types = ['indexed_db','local_storage'];
const all_data_types = ['tag_alias','tag_implication','artist_entry','custom'];
const reverse_data_key = {
    tag_alias: 'ta',
    tag_implication: 'ti',
    artist_entry: 'are'
};

//Wait time for quick edit box
// 1. Let box close before reenabling the submit button
// 2. Let box open before querying the implications
const quickedit_wait_time = 1000;

//Polling interval for checking program status
const timer_poll_interval = 100;

//Expiration time is one month
const relation_expiration = JSPLib.utility.one_month;
const artist_expiration = JSPLib.utility.one_month;

//Tag regexes
const metatags_regex = /^(?:rating|-?parent|source|-?locked|-?pool|newpool|-?fav|child|-?favgroup|upvote|downvote):/i;
const typetags_regex = /^-?(?:general|gen|artist|art|copyright|copy|co|character|char|ch|meta):/i;
const negative_regex = /^-/;
const striptype_regex = /^(-?)(?:general:|gen:|artist:|art:|copyright:|copy:|co:|character:|char:|ch:|meta:)?(.*)/i
const cosplay_regex = /^(.+)_\(cosplay\)$/;
const school_regex = /^(.+)_school_uniform$/;

//Other constants

const tag_fields = "id,name";
const alias_fields = "consequent_name";
const implication_fields = "antecedent_name";

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
            checkerror = JSPLib.menu.validateUserSettings(entry,settings_config);
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

async function QueryTagAlias(tag) {
    let consequent = "";
    let entryname = 'ta-'+tag;
    let storeditem = await JSPLib.storage.checkLocalDB(entryname,ValidateEntry,relation_expiration);
    if (!storeditem) {
        QueryTagAlias.debuglog("Querying alias:",tag);
        let data = await JSPLib.danbooru.submitRequest('tag_aliases', {search: {antecedent_name: tag, status: 'active'}, only: alias_fields}, [], entryname);
        if (data.length) {
            //Alias antecedents are unique, so no need to check the size
            QueryTagAlias.debuglog("Alias:",tag,data[0].consequent_name);
            VTI.aliastags.push(tag);
            consequent = [data[0].consequent_name];
        } else {
            consequent = [];
        }
        JSPLib.storage.saveData(entryname, {value: consequent, expires: Date.now() + relation_expiration});
    } else {
        consequent = storeditem.value;
        if (consequent.length) {
            QueryTagAlias.debuglog("Alias:",tag,consequent[0]);
            VTI.aliastags.push(tag);
        }
    }
}

//Queries aliases of added tags... can be called multiple times
async function QueryTagAliases(taglist) {
    for (let i = 0;i < taglist.length;i++) {
        if (VTI.seenlist.includes(taglist[i])) {
            continue;
        }
        VTI.seenlist.push(taglist[i]);
        VTI.aliases_promise_array.push(QueryTagAlias(taglist[i]));
    }
    await Promise.all(VTI.aliases_promise_array);
    QueryTagAliases.debuglog("Aliases:",VTI.aliastags);
}

async function QueryTagImplication(tag) {
    let entryname = 'ti-'+tag;
    let storeditem = await JSPLib.storage.checkLocalDB(entryname,ValidateEntry,relation_expiration);
    if (!storeditem) {
        QueryTagImplication.debuglog("Querying implication:",tag);
        let data = await JSPLib.danbooru.submitRequest('tag_implications', {limit:200, search:{ consequent_name:tag, status:'active'}, only: implication_fields}, [], entryname);
        let implications = data.map(entry=>{return entry.antecedent_name;});
        VTI.implicationdict[tag] = implications;
        JSPLib.storage.saveData(entryname, {value: implications, expires: Date.now() + relation_expiration});
    } else {
        VTI.implicationdict[tag] = storeditem.value;
    }
}

//Queries implications of preexisting tags... called once per image
async function QueryTagImplications(taglist) {
    for (let i = 0;i < taglist.length;i++) {
        VTI.implications_promise_array.push(QueryTagImplication(taglist[i]));
    }
    await Promise.all(VTI.implications_promise_array);
    QueryTagImplications.debuglog("Implications:",VTI.implicationdict);
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
            setTimeout(()=>{Timer.QueryTagImplications(VTI.preedittags);},quickedit_wait_time);
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
            if ($("#c-uploads #a-new,#c-posts #a-show").length) {
                ValidateTags.debuglog("Disabling return key!");
                $("#upload_tag_string,#post_tag_string").off("keydown.danbooru.submit");
            }
            if (VTI.is_upload) {
                //Check for the triggering of Danbooru's client validation (file/source/rating)
                ReenableSubmitCallback();
            } else if ($("#c-posts #a-index").length) {
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
    JSPLib.utility.rebindTimer({
        check: ()=>{return $("#client-errors").css("display") !== "none";},
        exec: ()=>{
            ReenableSubmitCallback.debuglog("Danbooru's client validation failed!");
            EnableUI("submit");
            $("#upload_tag_string").on("keydown.danbooru.submit", null, "return", (e)=>{
                $("#validate-tags").click();
                e.preventDefault();
            });
            ValidateTags.isready = true;
        }
    },timer_poll_interval);
}

function RebindHotkey() {
    JSPLib.utility.rebindTimer({
        check: ()=>{return JSPLib.utility.isNamespaceBound("#upload_tag_string,#post_tag_string",'keydown','danbooru.submit');},
        exec: ()=>{
            $("#upload_tag_string,#post_tag_string").off("keydown.danbooru.submit").on("keydown.danbooru.submit", null, "return", (e)=>{
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
    let url_addons = {search: {name: VTI.addedtags.join(','), hide_empty: 'yes'}, only: tag_fields};
    let alltags = await JSPLib.danbooru.getAllItems('tags', 100, {addons: url_addons});
    VTI.checktags = alltags.map(entry=>{return entry.name;});
    let nonexisttags = JSPLib.utility.setDifference(VTI.addedtags,VTI.checktags);
    if (VTI.user_settings.alias_check_enabled) {
        await Timer.QueryTagAliases(nonexisttags);
        nonexisttags = JSPLib.utility.setDifference(nonexisttags,VTI.aliastags);
    }
    if (nonexisttags.length > 0) {
        ValidateTagAdds.debuglog("Nonexistant tags!");
        $.each(nonexisttags,(i,tag)=>{ValidateTagAdds.debuglog(i,tag);});
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
    await Promise.all(VTI.implications_promise_array);
    let postedittags = TransformTypetags(GetCurrentTags());
    let deletedtags = JSPLib.utility.setDifference(VTI.preedittags,postedittags);
    let negatedtags = JSPLib.utility.setIntersection(GetNegativetags(postedittags),postedittags);
    let removedtags = deletedtags.concat(negatedtags);
    let finaltags = JSPLib.utility.setDifference(postedittags,removedtags);
    ValidateTagRemoves.debuglog("Final tags:",finaltags);
    ValidateTagRemoves.debuglog("Removed tags:",deletedtags,negatedtags);
    let allrelations = [];
    $.each(removedtags,(i,tag)=>{
        let badremoves = JSPLib.utility.setIntersection(GetAllRelations(tag,VTI.implicationdict),finaltags);
        if (badremoves.length) {
            allrelations.push(badremoves.toString() + ' -> ' + tag);
        }
    });
    if (allrelations.length) {
        JSPLib.debug.debugExecute(()=>{
            ValidateTagRemoves.debuglog("Badremove tags!");
            $.each(allrelations,(i,relation)=>{ValidateTagRemoves.debuglog(i,relation);});
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
    let ratingradio = $(".ratings input").toArray().some((input)=>{return input.checked;});
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
                option_html = `<br>...or, consider adding at least <a href="/wiki_pages/show_or_new?title=artist_request">artist request</a> or <a href="/wiki_pages/show_or_new?title=official_art">official art</a> as applicable.`;
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
        let tag_resp = await JSPLib.danbooru.submitRequest('tags',{search: {name: uncached_artists.join(','), has_artist: true}, only: tag_fields});
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
    let copyright_html = `Copyright tag is required. Consider adding <a href="/wiki_pages/show_or_new?title=copyright_request">copyright request</a> or <a href="/wiki_pages/show_or_new?title=original">original</a>.`
    VTI.validate_lines.push(copyright_html);
    Danbooru.Utility.notice(VTI.validate_lines.join('<br>'),true);
}

function ValidateGeneral() {
    let general_tags_length = $(".general-tag-list .category-0 .wiki-link").length;
    if (general_tags_length < VTI.user_settings.general_minimum_threshold) {
        VTI.validate_lines.push("Posts must have at least 10 general tags. Please add some more tags. " + how_to_tag);
    } else if (VTI.user_settings.general_low_threshold && general_tags_length < VTI.user_settings.general_low_threshold) {
        VTI.validate_lines.push("The post has a low amount of general tags. Consider adding more. " + how_to_tag);
    } else if (VTI.user_settings.general_moderate_threshold && general_tags_length < VTI.user_settings.general_moderate_threshold) {
        VTI.validate_lines.push("The post has a moderate amount of general tags, but could potentially need more. " + how_to_tag);
    } else {
        ValidateGeneral.debuglog("Has enough tags.");
        return;
    }
    Danbooru.Utility.notice(VTI.validate_lines.join('<br>'),true);
}

//Settings functions

function BroadcastVTI(ev) {
    BroadcastVTI.debuglog(`(${ev.data.type}):`,ev.data);
    switch (ev.data.type) {
        case "reset":
            Object.assign(VTI,program_reset_keys);
            //falls through
        case "settings":
            VTI.user_settings = ev.data.user_settings;
            VTI.is_setting_menu && JSPLib.menu.updateUserSettings('vti');
            break;
        case "purge":
            Object.keys(sessionStorage).forEach((key)=>{
                if (key.match(program_cache_regex)) {
                    sessionStorage.removeItem(key);
                }
            });
            //falls through
        default:
            //do nothing
    }
}

function RenderSettingsMenu() {
    $("#validate-tag-input").append(vti_menu);
    $("#vti-general-settings").append(JSPLib.menu.renderDomainSelectors('vti', 'ValidateTagInput'));
    $("#vti-pre-edit-settings").append(JSPLib.menu.renderCheckbox("vti",'single_session_warning'));
    $("#vti-pre-edit-settings").append(JSPLib.menu.renderCheckbox("vti",'artist_check_enabled'));
    $("#vti-pre-edit-settings").append(JSPLib.menu.renderCheckbox("vti",'copyright_check_enabled'));
    $("#vti-pre-edit-settings").append(JSPLib.menu.renderCheckbox("vti",'general_check_enabled'));
    $("#vti-pre-edit-settings").append(JSPLib.menu.renderTextinput("vti",'general_minimum_threshold',10));
    $("#vti-pre-edit-settings").append(JSPLib.menu.renderTextinput("vti",'general_low_threshold',10));
    $("#vti-pre-edit-settings").append(JSPLib.menu.renderTextinput("vti",'general_moderate_threshold',10));
    $("#vti-post-edit-settings").append(JSPLib.menu.renderCheckbox("vti",'alias_check_enabled'));
    $("#vti-post-edit-settings").append(JSPLib.menu.renderCheckbox("vti",'implication_check_enabled'));
    $("#vti-post-edit-settings").append(JSPLib.menu.renderCheckbox("vti",'upload_check_enabled'));
    $("#vti-cache-settings").append(JSPLib.menu.renderLinkclick("vti",'cache_info',"Cache info","Click to populate","Calculates the cache usage of the program and compares it to the total usage."));
    $("#vti-cache-settings").append(`<div id="vti-cache-info-table" style="display:none"></div>`);
    $("#vti-cache-settings").append(JSPLib.menu.renderLinkclick("vti",'purge_cache',`Purge cache (<span id="vti-purge-counter">...</span>)`,"Click to purge","Dumps all of the cached data related to ValidateTagInput."));
    $("#vti-cache-editor-controls").append(JSPLib.menu.renderKeyselect('vti','data_source',true,'indexed_db',all_source_types,"Indexed DB is <b>Cache Data</b> and Local Storage is <b>Program Data</b>."));
    $("#vti-cache-editor-controls").append(JSPLib.menu.renderKeyselect('vti','data_type',true,'tag',all_data_types,"Only applies to Indexed DB.  Use <b>Custom</b> for querying by keyname."));
    $("#vti-cache-editor-controls").append(JSPLib.menu.renderTextinput('vti','data_name',20,true,"Click <b>Get</b> to see the data, <b>Save</b> to edit it, and <b>Delete</b> to remove it.",['get','save','delete']));
    JSPLib.menu.engageUI('vti',true);
    JSPLib.menu.saveUserSettingsClick('vti','ValidateTagInput');
    JSPLib.menu.resetUserSettingsClick('vti','ValidateTagInput',localstorage_keys,program_reset_keys);
    JSPLib.menu.cacheInfoClick('vti',program_cache_regex,"#vti-cache-info-table");
    JSPLib.menu.purgeCacheClick('vti','ValidateTagInput',program_cache_regex,"#vti-purge-counter");
    JSPLib.menu.getCacheClick('vti',reverse_data_key);
    JSPLib.menu.saveCacheClick('vti',ValidateProgramData,ValidateEntry,reverse_data_key);
    JSPLib.menu.deleteCacheClick('vti',reverse_data_key);
    JSPLib.menu.cacheAutocomplete('vti',program_cache_regex,reverse_data_key);
}

//Main program

function Main() {
    Danbooru.VTI = VTI = {
        channel: new BroadcastChannel('ValidateTagInput'),
        aliastags: [],
        seenlist: [],
        aliases_promise_array: [],
        implicationdict: {},
        implications_promise_array: [],
        is_upload: Boolean($("#c-uploads #a-new").length),
        was_upload: JSPLib.storage.getStorageData('vti-was-upload',sessionStorage,false),
        validate_lines: [],
        storage_keys: {indexed_db: [], local_storage: []},
        is_setting_menu: JSPLib.danbooru.isSettingMenu(),
        settings_config: settings_config
    }
    VTI.user_settings = JSPLib.menu.loadUserSettings('vti');
    VTI.channel.onmessage = BroadcastVTI;
    if (VTI.is_setting_menu) {
        JSPLib.validate.dom_output = "#vti-cache-editor-errors";
        JSPLib.menu.loadStorageKeys('vti',program_cache_regex);
        JSPLib.utility.installScript("https://cdn.jsdelivr.net/gh/jquery/jquery-ui@1.12.1/ui/widgets/tabs.js").done(()=>{
            JSPLib.menu.installSettingsMenu("ValidateTagInput");
            Timer.RenderSettingsMenu();
        });
        return;
    }
    if (!JSPLib.menu.isScriptEnabled('ValidateTagInput')) {
        Main.debuglog("Script is disabled on", window.location.hostname);
        return;
    }
    if (VTI.is_upload) {
        //Upload tags will always start out blank
        VTI.preedittags = [];
        JSPLib.storage.setStorageData('vti-was-upload',true,sessionStorage);
    } else {
        JSPLib.storage.setStorageData('vti-was-upload',false,sessionStorage);
    }
    if ($("#c-posts #a-show").length) {
        VTI.preedittags = GetTagList();
        Main.debuglog("Preedit tags:",VTI.preedittags);
        if (VTI.user_settings.implication_check_enabled) {
            Timer.QueryTagImplications(VTI.preedittags).then(()=>{
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
    } else if ($("#c-posts #a-index #mode-box").length){
        $(".post-preview a").click(PostModeMenu);
    } else if (!VTI.is_upload) {
        Main.debuglog("Nothing found!");
        return;
    }
    $("#form [type=submit],#quick-edit-form [type=submit][value=Submit]").after(submit_button);
    $("#form [type=submit],#quick-edit-form [type=submit][value=Submit]").hide();
    if ($("#c-posts #a-index").length) {
        $("#quick-edit-form [type=submit][value=Cancel]").after(input_validator);
        $("#quick-edit-form").after(warning_messages);
    } else{
        $("#check-tags").after(input_validator);
        $("#related-tags-container").before(warning_messages);
    }
    $("#validate-tags").on('click.vti',Timer.ValidateTags);
    $("#check-tags").on('click.vti',Timer.CheckTags);
    RebindHotkey();
    JSPLib.debug.debugExecute(()=>{
        window.addEventListener('beforeunload',function () {
            JSPLib.statistics.outputAdjustedMean("ValidateTagInput");
        });
    });
    setTimeout(()=>{
        JSPLib.storage.pruneEntries('vti',program_cache_regex,prune_expires);
    },JSPLib.utility.one_minute);
}

/****Function decoration****/

JSPLib.debug.addFunctionTimers(Timer,false,[RenderSettingsMenu]);

JSPLib.debug.addFunctionTimers(Timer,true,[
    QueryTagAliases,QueryTagImplications,ValidateTagAdds,ValidateTagRemoves,ValidateArtist,
    ValidateTags,CheckTags
]);

JSPLib.debug.addFunctionLogs([
    Main, ValidateEntry, BroadcastVTI, PostModeMenu,ValidateTags,ReenableSubmitCallback,
    GetAutoImplications, QueryTagAlias, QueryTagAliases, QueryTagImplication, QueryTagImplications,
    ValidateTagAdds,ValidateTagRemoves,ValidateUpload,ValidateArtist,ValidateCopyright,ValidateGeneral
]);

/****Execution start****/

JSPLib.load.programInitialize(Main,'VTI',program_load_required_variables,program_load_required_selectors);
