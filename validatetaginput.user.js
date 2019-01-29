// ==UserScript==
// @name         ValidateTagInput
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      26.0
// @source       https://danbooru.donmai.us/users/23799
// @description  Validates tag add/remove inputs on a post edit or upload.
// @author       BrokenEagle
// @match        *://*.donmai.us/posts*
// @match        *://*.donmai.us/uploads*
// @match        *://*.donmai.us/users/*/edit
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/validatetaginput.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.5.2/localforage.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.12.0/validate.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/menu.js
// ==/UserScript==

/***Global variables***/

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

//Regex that matches the prefix of all program cache data
const program_cache_regex = /^(?:ti|ta)-/;

//Main program expires
const prune_expires = JSPLib.utility.one_day;

//For factory reset
const localstorage_keys = [];
const program_reset_keys = {};

//Main settings
const settings_config = {
    alias_check_enabled: {
        default: true,
        validate: (data)=>{return validate.isBoolean(data);},
        hint: "Checks and removes aliased tags from tag add validation."
    },
    implication_check_enabled: {
        default: true,
        validate: (data)=>{return validate.isBoolean(data);},
        hint: "Turns off querying implications for tag remove validation."
    },
    upload_check_enabled: {
        default: false,
        validate: (data)=>{return validate.isBoolean(data);},
        hint: "Performs the same rating and source checks that Danbooru does."
    },
    artist_check_enabled: {
        default: true,
        validate: (data)=>{return validate.isBoolean(data);},
        hint: "Does a check for any artist tags or artist entries."
    },
    copyright_check_enabled: {
        default: true,
        validate: (data)=>{return validate.isBoolean(data);},
        hint: 'Checks for the existence of any copyright tag or the <a href="/wiki_pages/show_or_new?title=copyright_request">copyright request</a> tag.'
    },
    general_check_enabled: {
        default: true,
        validate: (data)=>{return validate.isBoolean(data);},
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
        validate: (data)=>{return validate.isBoolean(data);},
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

const reset_storage = `
<div class="input">
    <label>Site data</label>
    <p><a href="#" id="reset-storage-link">Reset cached data</a></p>
</div>`;

const warning_messages = `
<div id="warning-bad-upload" class="error-messages ui-state-error ui-corner-all" style="display:none"></div>
<div id="warning-new-tags" class="error-messages ui-state-error ui-corner-all" style="display:none"></div>
<div id="warning-bad-removes" class="error-messages ui-state-highlight ui-corner-all" style="display:none"></div>`;

const menu_css = `
#vti-console .expandable {
    width: 90%;
}
#vti-cache-viewer textarea {
    width: 100%;
    min-width: 40em;
    height: 50em;
    padding: 5px;
}
#vti-cache-editor-errors {
    display: none;
    border: solid lightgrey 1px;
    margin: 0.5em;
    padding: 0.5em;
}
.jsplib-console {
    width: 100%;
    min-width: 100em;
}
.vti-linkclick.jsplib-linkclick .vti-control.jsplib-control {
    display: inline;
}
#userscript-settings-menu .ui-widget-content a,
#notice .ui-widget-content a {
    color:#0073ff
}
#notice.ui-state-highlight {
    color: #363636;
}
`;

const vti_menu = `
<div id="vti-script-message" class="prose">
    <h2>ValidateTagInput</h2>
    <p>Check the forum for the latest on information and updates (<a class="dtext-link dtext-id-link dtext-forum-topic-id-link" href="/forum_topics/14474">topic #14474</a>).</p>
</div>
<div id="vti-console" class="jsplib-console">
    <div id="vti-settings" class="jsplib-outer-menu">
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
                            <li><b>Tag aliases:</b> Used to determine if an added tag is bad or an alias.</li>
                            <li><b>Tag implications:</b> Used to determine which tag removes are bad.</li>
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
            <p>See the <b><a href="#vti-cache-message">Cache settings</a></b> settings for the list of all cache data and what they do.</p>
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
        <div id="vti-cache-editor-errors"></div>
        <div id="vti-cache-viewer">
            <textarea></textarea>
        </div>
    </div>
</div>`;

const all_source_types = ['indexed_db','local_storage'];
const all_data_types = ['tag_alias','tag_implication','custom'];
const reverse_data_key = {
    tag_alias: 'ta',
    tag_implication: 'ti'
};

//Wait time for quick edit box
// 1. Let box close before reenabling the submit button
// 2. Let box open before querying the implications
const quickedit_wait_time = 1000;

//Polling interval for checking program status
const timer_poll_interval = 100;

//Expiration time is one month
const validatetag_expiration_time = JSPLib.utility.one_month;

//Tag regexes
const metatags_regex = /^(?:rating|-?parent|source|-?locked|-?pool|newpool|-?fav|child|-?favgroup|upvote|downvote):/i;
const typetags_regex = /^-?(?:general|gen|artist|art|copyright|copy|co|character|char|ch|meta):/i;
const negative_regex = /^-/;
const striptype_regex = /^(-?)(?:general:|gen:|artist:|art:|copyright:|copy:|co:|character:|char:|ch:|meta:)?(.*)/i

//Validate constants

const relation_constraints = {
    entry: JSPLib.validate.arrayentry_constraints,
    value: JSPLib.validate.stringonly_constraints
};

/***Functions***/

//Validate functions

function ValidateRelationEntry(key,entry) {
    if (!JSPLib.validate.validateIsHash(key,entry)) {
        RenderValidateError(key,["Data is not a hash."]);
        return false;
    }
    let check = validate(entry,relation_constraints.entry);
    if (check !== undefined) {
        OutputValidateError(key,check);
        return false;
    }
    let extra_keys = JSPLib.utility.setDifference(Object.keys(entry),Object.keys(relation_constraints.entry));
    if (extra_keys.length) {
        OutputValidateError(key,["Hash contains extra keys.",extra_keys]);
        return false;
    }
    return FixValidateArrayValues(key + '.value', entry.value, relation_constraints.value);
}

function ValidateProgramData(key,entry) {
    var checkerror;
    switch (key) {
        case 'vti-user-settings':
            var checkerror = ValidateUserSettings(entry,VTI.settings_config);
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
        OutputValidateError(key,checkerror);
        return false;
    }
    return true;
}

//Library functions

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

//Helper functions

function GetTagList() {
    return JSPLib.utility.filterEmpty(StripQuoteSourceMetatag($("#upload_tag_string,#post_tag_string").val()).split(/[\s\n]+/).map(tag=>{return tag.toLowerCase();}));
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
    let storeditem = await JSPLib.storage.checkLocalDB(entryname,ValidateRelationEntry,validatetag_expiration_time);
    if (!storeditem) {
        JSPLib.debug.debuglog("Querying alias:",tag);
        let data = await JSPLib.danbooru.submitRequest('tag_aliases',{search:{antecedent_name:tag,status:'active'}},[],entryname);
        if (data.length) {
            //Alias antecedents are unique, so no need to check the size
            JSPLib.debug.debuglog("Alias:",tag,data[0].consequent_name);
            VTI.aliastags.push(tag);
            consequent = [data[0].consequent_name];
        } else {
            consequent = [];
        }
        JSPLib.storage.saveData(entryname, {value: consequent, expires: Date.now() + validatetag_expiration_time});
    } else {
        consequent = storeditem.value;
        if (consequent.length) {
            JSPLib.debug.debuglog("Alias:",tag,consequent[0]);
            VTI.aliastags.push(tag);
        }
    }
}

//Queries aliases of added tags... can be called multiple times
const QueryTagAliases = JSPLib.debug.debugAsyncTimer(async (taglist)=>{
    for (let i = 0;i < taglist.length;i++) {
        if (VTI.seenlist.includes(taglist[i])) {
            continue;
        }
        VTI.seenlist.push(taglist[i]);
        VTI.aliases_promise_array.push(QueryTagAlias(taglist[i]));
    }
    await Promise.all(VTI.aliases_promise_array);
    JSPLib.debug.debuglog("Aliases:",VTI.aliastags);
},"QueryTagAliases");

async function QueryTagImplication(tag) {
    let entryname = 'ti-'+tag;
    let storeditem = await JSPLib.storage.checkLocalDB(entryname,ValidateRelationEntry,validatetag_expiration_time);
    if (!storeditem) {
        JSPLib.debug.debuglog("Querying implication:",tag);
        let data = await JSPLib.danbooru.submitRequest('tag_implications',{limit:100,search:{consequent_name:tag,status:'active'}},[],entryname);
        let implications = data.map(entry=>{return entry.antecedent_name;});
        VTI.implicationdict[tag] = implications;
        JSPLib.storage.saveData(entryname, {value: implications, expires: Date.now() + validatetag_expiration_time});
    } else {
        VTI.implicationdict[tag] = storeditem.value;
    }
}

//Queries implications of preexisting tags... called once per image
const QueryTagImplications = JSPLib.debug.debugAsyncTimer(async (taglist)=>{
    for (let i = 0;i < taglist.length;i++) {
        VTI.implications_promise_array.push(QueryTagImplication(taglist[i]));
    }
    await Promise.all(VTI.implications_promise_array);
    JSPLib.debug.debuglog("Implications:",VTI.implicationdict);
},"QueryTagImplications");

//Click functions

function PostModeMenuClick(e) {
    let s = $("#mode-box select").val();
    if (s === "edit") {
        $("#validation-input,#warning-bad-upload,#warning-new-tags,#warning-bad-removes").hide();
        let post_id = $(e.target).closest("article").data("id");
        let $post = $("#post_" + post_id);
        VTI.preedittags = $post.data("tags").split(' ');
        JSPLib.debug.debuglog("Preedit tags:",VTI.preedittags);
        //Wait until the edit box loads before querying implications
        if (VTI.user_settings.implication_check_enabled) {
            setTimeout(()=>{QueryTagImplications(VTI.preedittags);},quickedit_wait_time);
        }
        e.preventDefault();
    }
}

async function CheckTagsClick(e) {
    //Prevent code from being reentrant until finished processing
        JSPLib.debug.debugTime("CheckTagsClick");
        DisableUI("check");
        let statuses = (await Promise.all([ValidateTagAdds(),ValidateTagRemoves(),ValidateUpload()]));
        if (statuses.every((item)=>{return item;})) {
            Danbooru.Utility.notice("Tags good to submit!");
        } else {
            Danbooru.Utility.error("Tag validation failed!");
        }
        EnableUI("check");
        JSPLib.debug.debugTimeEnd("CheckTagsClick");
}

async function ValidateTagsClick(e) {
    //Prevent code from being reentrant until finished processing
    if (ValidateTagsClick.isready) {
        ValidateTagsClick.isready = false;
        JSPLib.debug.debugTime("ValidateTagsClick");
        DisableUI("submit");
        let statuses = await Promise.all([ValidateTagAdds(),ValidateTagRemoves(),ValidateUpload()]);
        if (statuses.every((item)=>{return item;})) {
            JSPLib.debug.debuglog("Submit request!");
            $("#form,#quick-edit-form").trigger("submit");
            if ($("#c-uploads #a-new,#c-posts #a-show").length) {
                JSPLib.debug.debuglog("Disabling return key!");
                $("#upload_tag_string,#post_tag_string").off("keydown.danbooru.submit");
            }
            if (VTI.is_upload) {
                //Check for the triggering of Danbooru's client validation (file/source/rating)
                ReenableSubmitCallback.timer = setInterval(ReenableSubmitCallback,timer_poll_interval);
            } else if ($("#c-posts #a-index").length) {
                //Wait until the edit box closes to reenable the submit button click
                setTimeout(()=>{
                    JSPLib.debug.debuglog("Ready for next edit!");
                    EnableUI("submit");
                    $("#skip-validate-tags")[0].checked = false;
                    ValidateTagsClick.isready = true;
                },quickedit_wait_time);
            }
        } else {
            JSPLib.debug.debuglog("Validation failed!");
            EnableUI("submit");
            ValidateTagsClick.isready = true;
        }
        JSPLib.debug.debugTimeEnd("ValidateTagsClick");
    }
}
ValidateTagsClick.isready = true;

//Timer/callback functions

function ReenableSubmitCallback() {
    if ($("#client-errors").css("display") !== "none") {
        clearInterval(ReenableSubmitCallback.timer);
        JSPLib.debug.debuglog("Danbooru's client validation failed!");
        EnableUI("submit");
        $("#upload_tag_string").on("keydown.danbooru.submit", null, "return", (e)=>{
            $("#validate-tags").click();
            e.preventDefault();
        });
        ValidateTagsClick.isready = true;
    }
}

function RebindHotkey() {
    if (JSPLib.utility.isNamespaceBound("#upload_tag_string,#post_tag_string",'keydown','danbooru.submit')) {
        clearInterval(RebindHotkey.timer);
        $("#upload_tag_string,#post_tag_string").off("keydown.danbooru.submit").on("keydown.danbooru.submit", null, "return", (e)=>{
            $("#validate-tags").click();
            e.preventDefault();
        });
    }
}

//Main execution functions

const ValidateTagAdds = JSPLib.debug.debugAsyncTimer(async ()=>{
    let postedittags = GetCurrentTags();
    let positivetags = JSPLib.utility.filterRegex(postedittags,negative_regex,true);
    let useraddtags = JSPLib.utility.setDifference(positivetags,VTI.preedittags);
    VTI.addedtags = JSPLib.utility.setDifference(useraddtags,GetNegativetags(postedittags));
    JSPLib.debug.debuglog("Added tags:",VTI.addedtags);
    if ((VTI.addedtags.length === 0) || IsSkipValidate()) {
        JSPLib.debug.debuglog("Tag Add Validation - Skipping!");
        $("#warning-new-tags").hide();
        return true;
    }
    let alltags = await JSPLib.danbooru.getAllItems('tags',100,{addons:{search:{name:VTI.addedtags.join(','),hide_empty:'yes'}}});
    VTI.checktags = alltags.map(entry=>{return entry.name;});
    let nonexisttags = JSPLib.utility.setDifference(VTI.addedtags,VTI.checktags);
    if (VTI.user_settings.alias_check_enabled) {
        await QueryTagAliases(VTI.addedtags);
        nonexisttags = JSPLib.utility.setDifference(nonexisttags,VTI.aliastags);
    }
    if (nonexisttags.length > 0) {
        JSPLib.debug.debuglog("Tag Add Validation - Nonexistant tags!");
        $.each(nonexisttags,(i,tag)=>{JSPLib.debug.debuglog(i,tag);});
        $("#validation-input").show();
        $("#warning-new-tags").show();
        let taglist = nonexisttags.join(', ');
        $("#warning-new-tags")[0].innerHTML = '<strong>Warning</strong>: The following new tags will be created:  ' + taglist;
        return false;
    }
    JSPLib.debug.debuglog("Tag Add Validation - Free and clear to submit!");
    $("#warning-new-tags").hide();
    return true;
},"ValidateTagAdds");

const ValidateTagRemoves = JSPLib.debug.debugAsyncTimer(async ()=>{
    if (!VTI.user_settings.implication_check_enabled || IsSkipValidate()) {
        JSPLib.debug.debuglog("Tag Remove Validation - Skipping!");
        $("#warning-bad-removes").hide();
        return true;
    }
    await Promise.all(VTI.implications_promise_array);
    let postedittags = TransformTypetags(GetCurrentTags());
    let deletedtags = JSPLib.utility.setDifference(VTI.preedittags,postedittags);
    let negatedtags = JSPLib.utility.setIntersection(GetNegativetags(postedittags),postedittags);
    let removedtags = deletedtags.concat(negatedtags);
    let finaltags = JSPLib.utility.setDifference(postedittags,removedtags);
    JSPLib.debug.debuglog("Final tags:",finaltags);
    JSPLib.debug.debuglog("Removed tags:",deletedtags,negatedtags);
    let allrelations = [];
    $.each(removedtags,(i,tag)=>{
        let badremoves = JSPLib.utility.setIntersection(GetAllRelations(tag,VTI.implicationdict),finaltags);
        if (badremoves.length) {
            allrelations.push(badremoves.toString() + ' -> ' + tag);
        }
    });
    if (allrelations.length) {
        JSPLib.debug.debugExecute(()=>{
            JSPLib.debug.debuglog("Tag Remove Validation - Badremove tags!");
            $.each(allrelations,(i,relation)=>{JSPLib.debug.debuglog(i,relation);});
        });
        $("#validation-input").show();
        $("#warning-bad-removes").show();
        let removelist = allrelations.join('<br>');
        $("#warning-bad-removes")[0].innerHTML = '<strong>Notice</strong>: The following implication relations prevent certain tag removes:<br>' + removelist;
        return false;
    }
    JSPLib.debug.debuglog("Tag Remove Validation - Free and clear to submit!");
    $("#warning-bad-removes").hide();
    return true;
},"ValidateTagRemoves");

function ValidateUpload() {
    if (!VTI.user_settings.upload_check_enabled || !VTI.is_upload || IsSkipValidate()) {
        JSPLib.debug.debuglog("Upload Validation - Skipping!");
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
        JSPLib.debug.debuglog("Upload Validation: " + errormessages.join(' '));
        $("#validation-input").show();
        $("#warning-bad-upload").show();
        $("#warning-bad-upload")[0].innerHTML = '<strong>Warning</strong>: ' + errormessages.join(' ');
        return false;
    }
    JSPLib.debug.debuglog("Upload Validation - Free and clear to submit!");
    $("#warning-bad-upload").hide();
    return true;
}

async function ValidateArtist() {
    let source_url = $("#post_source").val();
    let new_artist_source = $.param({artist: {source: source_url}});
    let artist_names = $(".artist-tag-list .category-1 .wiki-link").map((i,entry)=>{return decodeURI(entry.search.split("=")[1]);}).toArray();
    if (artist_names.length === 0) {
        //Validate no artist tag
        let option_html = "";
        if (!source_url.match(/https?:\/\//)) {
            JSPLib.debug.debuglog("ValidateArtist: Not a URL.");
            return;
        }
        let source_resp = await JSPLib.danbooru.submitRequest('source',{url: source_url},{artist: {name: null}});
        if (source_resp.artist.name === null) {
            JSPLib.debug.debuglog("ValidateArtist: Not a first-party source.");
            return;
        }
        if (source_resp.artists.length) {
            let artist_list = source_resp.artists.map((artist)=>{return `<a href="/artists/show_or_new?name=${artist.name}">${artist.name}</a>`;});
            let artist_html = `There is an available artist tag for this post [${artist_list.join(', ')}]. Open the edit menu and consider adding it.`;
            VTI.validate_lines.push(artist_html);
        } else {
            if (JSPLib.utility.setIntersection(VTI.preedittags,['artist_request','official_art']).length === 0) {
                option_html = `<br>...or, consider adding at least <a href="/wiki_pages/show_or_new?title=artist_request">artist request</a> or <a href="/wiki_pages/show_or_new?title=official_art">official art</a> as applicable.`;
            }
            let artist_html = `Artist tag is required. <a href="/artists/new?${new_artist_source}">Create new artist entry</a>. Ask on the forum if you need naming help.`;
            VTI.validate_lines = VTI.validate_lines.concat([artist_html + option_html]);
        }
    } else {
        //Validate artists have entry
        let promise_array = artist_names.map((name)=>{return JSPLib.danbooru.submitRequest('artists',{search: {name_like: name}});});
        let artists = (await Promise.all(promise_array)).flat();
        if (artists.includes(null)) {
            JSPLib.debug.debuglog("ValidateArtist: Bad HTTP request.");
            return;
        }
        let found_artists = JSPLib.utility.getObjectAttributes(artists,'name');
        let missing_artists = JSPLib.utility.setDifference(artist_names,found_artists);
        if (missing_artists.length === 0) {
            JSPLib.debug.debuglog("ValidateArtist: No missing artists.");
            return;
        }
        let artist_lines = artist_names.map((artist)=>{
            return  `
            Artist <a href="/artists/show_or_new?name=${artist}">${artist}</a> requires an artist entry.
            <a href="/artists/new?${new_artist_source}">Create new artist entry</a>`;
        });
        VTI.validate_lines = VTI.validate_lines.concat(artist_lines);
    }
    Danbooru.Utility.notice(VTI.validate_lines.join('<hr>'),true);
}

function ValidateCopyright() {
    let copyright_names_length = $(".copyright-tag-list .category-3 .wiki-link").length;
    if (copyright_names_length) {
        JSPLib.debug.debuglog("ValidateCopyright: Has a copyright.");
        return;
    } else if (VTI.preedittags.includes('copyright_request')) {
        JSPLib.debug.debuglog("ValidateCopyright: Has copyright request.");
        return;
    }
    let copyright_html = `Copyright tag is required. Consider adding <a href="/wiki_pages/show_or_new?title=copyright_request">copyright request</a> or <a href="/wiki_pages/show_or_new?title=original">original</a>.`
    VTI.validate_lines.push(copyright_html);
    Danbooru.Utility.notice(VTI.validate_lines.join('<br>'),true);
}

let how_to_tag = `Read <a href="/wiki_pages/show_or_new?title=howto%3atag">howto:tag</a> for how to tag.`;

function ValidateGeneral() {
    let general_tags_length = $(".general-tag-list .category-0 .wiki-link").length;
    if (general_tags_length < VTI.user_settings.general_minimum_threshold) {
        VTI.validate_lines.push("Posts must have at least 10 general tags. Please add some more tags. " + how_to_tag);
    } else if (VTI.user_settings.general_low_threshold && general_tags_length < VTI.user_settings.general_low_threshold) {
        VTI.validate_lines.push("The post has a low amount of general tags. Consider adding more. " + how_to_tag);
    } else if (VTI.user_settings.general_moderate_threshold && general_tags_length < VTI.user_settings.general_moderate_threshold) {
        VTI.validate_lines.push("The post has a moderate amount of general tags, but could potentially need more. " + how_to_tag);
    } else {
        JSPLib.debug.debuglog("ValidateGeneral: Has enough tags.");
        return;
    }
    Danbooru.Utility.notice(VTI.validate_lines.join('<br>'),true);
}

////Cache editor

//Cache helper functions

async function LoadStorageKeys(program_shortcut) {
    let program_key = program_shortcut.toUpperCase();
    let storage_keys = await JSPLib.storage.danboorustorage.keys();
    Danbooru[program_key].storage_keys.indexed_db = storage_keys.filter((key)=>{return key.match(program_cache_regex);});
    storage_keys = Object.keys(localStorage);
    Danbooru[program_key].storage_keys.local_storage = storage_keys.filter((key)=>{return key.startsWith(program_shortcut + "-");});
}

function GetCacheDatakey(program_shortcut) {
    let program_key = program_shortcut.toUpperCase();
    let program_data = Danbooru[program_key];
    program_data.data_source = $(`#${program_shortcut}-control-data-source`).val();
    program_data.data_type = $(`#${program_shortcut}-control-data-type`).val();
    program_data.category = $(`#${program_shortcut}-control-related-tag-type`).val();
    program_data.data_value = data_key = $(`#${program_shortcut}-setting-data-name`).val().trim().replace(/\s+/g,'_');
    if (program_data.data_source === "local_storage") {
        data_key = program_shortcut + '-' + program_data.data_value;
    } else if (program_data.data_type !== "custom") {
        let key_modifier = program_data.reverse_data_key[program_data.data_type];
        data_key = key_modifier + '-' + program_data.data_value;
    }
    return data_key;
}

function CacheSource(program_shortcut) {
    let program_key = program_shortcut.toUpperCase();
    let program_data = Danbooru[program_key];
    return function (req,resp) {
        let check_key = GetCacheDatakey(program_shortcut);
        if (program_data.data_source === "indexed_db" && program_data.data_value.length === 0) {
            resp([]);
            return;
        }
        let source_keys = program_data.storage_keys[program_data.data_source];
        let available_keys = source_keys.filter((key)=>{return key.startsWith(check_key);});
        let transformed_keys = available_keys.slice(0,10);
        if (program_data.data_source === 'local_storage' || program_data.data_type !== "custom") {
            transformed_keys = transformed_keys.map((key)=>{return key.slice(key.indexOf('-')+1);});
        }
        resp(transformed_keys);
    }
}

//Cache event functions

function GetCacheClick(program_shortcut) {
    let program_key = program_shortcut.toUpperCase();
    $(`#${program_shortcut}-data-name-get`).on(`click.${program_shortcut}`,(e)=>{
        let storage_key = GetCacheDatakey(program_shortcut);
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

function SaveCacheClick(program_shortcut,localvalidator,indexvalidator) {
    let program_key = program_shortcut.toUpperCase();
    $(`#${program_shortcut}-data-name-save`).on(`click.${program_shortcut}`,(e)=>{
        try {
            var data = JSON.parse($(`#${program_shortcut}-cache-viewer textarea`).val());
        } catch (e) {
            Danbooru.Utility.error("Invalid JSON data! Unable to save.");
            return;
        }
        let storage_key = GetCacheDatakey(program_shortcut);
        if (Danbooru[program_key].data_source === "local_storage") {
            if (localvalidator(storage_key,data)) {
                JSPLib.storage.setStorageData(storage_key,data,localStorage);
                Danbooru.Utility.notice("Data was saved.");
                HideValidateError();
                if (storage_key === `${program_shortcut}-user-settings`) {
                    VTI.user_settings = data;
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

function DeleteCacheClick(program_shortcut) {
    let program_key = program_shortcut.toUpperCase();
    $(`#${program_shortcut}-data-name-delete`).on(`click.${program_shortcut}`,(e)=>{
        let storage_key = GetCacheDatakey(program_shortcut);
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

function CacheAutocomplete(program_shortcut) {
    let program_key = program_shortcut.toUpperCase();
    $(`#${program_shortcut}-setting-data-name`).autocomplete({
        minLength: 0,
        delay: 0,
        source: CacheSource(program_shortcut),
        search: function() {
            $(this).data("uiAutocomplete").menu.bindings = $();
        }
    }).off('keydown.Autocomplete.tab');
}

//Settings functions

function BroadcastVTI(ev) {
    JSPLib.debug.debuglog(`BroadcastChannel (${ev.data.type}):`,ev.data);
    switch (ev.data.type) {
        case "reset":
            Object.assign(VTI,program_reset_keys);
        case "settings":
            VTI.user_settings = ev.data.user_settings;
            VTI.is_setting_menu && UpdateUserSettings('vti');
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

function RenderSettingsMenu() {
    $("#validate-tag-input").append(vti_menu);
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
    $("#vti-cache-settings").append(FixRenderLinkclick("vti",'purge_cache',`Purge cache (<span id="vti-purge-counter">...</span>)`,"Click to purge","Dumps all of the cached data related to ValidateTagInput."));
    $("#vti-cache-editor-controls").append(RenderKeyselect('vti','data_source',true,'indexed_db',all_source_types,"Indexed DB is <b>Cache Data</b> and Local Storage is <b>Program Data</b>."));
    $("#vti-cache-editor-controls").append(RenderKeyselect('vti','data_type',true,'tag',all_data_types,"Only applies to Indexed DB.  Use <b>Custom</b> for querying by keyname."));
    $("#vti-cache-editor-controls").append(FixRenderTextinput('vti','data_name',20,true,"Click <b>Get</b> to see the data, <b>Save</b> to edit it, and <b>Delete</b> to remove it.",['get','save','delete']));
    JSPLib.menu.saveUserSettingsClick('vti','ValidateTagInput');
    JSPLib.menu.resetUserSettingsClick('vti','ValidateTagInput',localstorage_keys,program_reset_keys);
    JSPLib.menu.purgeCacheClick('vti','ValidateTagInput',program_cache_regex,"#vti-purge-counter");
    GetCacheClick('vti');
    SaveCacheClick('vti',ValidateProgramData,ValidateRelationEntry);
    DeleteCacheClick('vti');
    CacheAutocomplete('vti');
}

//Main program

function main() {
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
        reverse_data_key: reverse_data_key,
        storage_keys: {indexed_db: [], local_storage: []},
        is_setting_menu: Boolean($("#c-users #a-edit").length),
        settings_config: settings_config
    }
    VTI.user_settings = JSPLib.menu.loadUserSettings('vti');
    VTI.channel.onmessage = BroadcastVTI;
    if (VTI.is_setting_menu) {
        JSPLib.validate.dom_output = "#vti-cache-editor-errors";
        LoadStorageKeys('vti');
        JSPLib.utility.installScript("https://cdn.jsdelivr.net/gh/jquery/jquery-ui@1.12.1/ui/widgets/tabs.js").done(()=>{
            JSPLib.menu.installSettingsMenu("ValidateTagInput");
            RenderSettingsMenu();
        });
        JSPLib.utility.setCSSStyle(menu_css,'menu');
        return;
    }
    if (VTI.is_upload) {
        //Upload tags will always start out blank
        VTI.preedittags = [];
        JSPLib.storage.setStorageData('vti-was-upload',true,sessionStorage);
    } else if ($("#c-posts #a-show").length) {
        VTI.preedittags = GetTagList();
        JSPLib.debug.debuglog("Preedit tags:",VTI.preedittags);
        if (VTI.user_settings.implication_check_enabled) {
            QueryTagImplications(VTI.preedittags);
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
            JSPLib.debug.debuglog("Already pre-validated post.");
        }
        JSPLib.storage.setStorageData('vti-seen-postlist',seen_post_list.concat(post_id),sessionStorage);
        JSPLib.storage.setStorageData('vti-was-upload',false,sessionStorage);
    } else if ($("#c-posts #a-index #mode-box").length){
        $(".post-preview a").click(PostModeMenuClick);
    } else {
        JSPLib.debug.debuglog("Nothing found!");
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
    $("#validate-tags").click(ValidateTagsClick);
    $("#check-tags").click(CheckTagsClick);
    RebindHotkey.timer = setInterval(RebindHotkey,timer_poll_interval);
    JSPLib.debug.debugExecute(()=>{
        window.addEventListener('beforeunload',function () {
            JSPLib.statistics.outputAdjustedMean("ValidateTagInput");
        });
    });
    setTimeout(()=>{
        JSPLib.storage.pruneEntries('vti',program_cache_regex,prune_expires);
    },JSPLib.utility.one_minute);
}

//Execution start

JSPLib.load.programInitialize(main,'VTI',program_load_required_variables,program_load_required_selectors);
