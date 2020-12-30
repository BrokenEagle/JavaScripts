// ==UserScript==
// @name         SafelistPlus
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      4.10
// @description  Alternate Danbooru blacklist handler.
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @exclude      /^https?://\w+\.donmai\.us/.*\.(xml|json|atom)(\?|$)/
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/safelist_plus.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/core-js/3.8.1/minified.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.13.1/validate.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201230-module/lib/module.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/notice.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201230-menu/lib/menu.js
// ==/UserScript==

/* global JSPLib $ Danbooru validate */

/****Global variables****/

//Library constants

////NONE

//Exterior script variables
const DANBOORU_TOPIC_ID = '14221';

//Variables for load.js
const program_load_required_variables = ['window.jQuery', 'window.Danbooru', 'window.Danbooru.Blacklist'];
const program_load_required_selectors = ["#page"];

//Program name constants
const PROGRAM_SHORTCUT = 'sl';
const PROGRAM_CLICK = 'click.sl';
const PROGRAM_NAME = 'SafelistPlus';

//Main program variable
const SL = {};

//For factory reset
const LOCALSTORAGE_KEYS = [
    'sl-script-enabled',
    'sl-show-menu',
    'sl-active-list',
];
const PROGRAM_RESET_KEYS = {
    enable_safelist: true,
    is_shown: true,
};

//Main settings
const SETTINGS_CONFIG = {
    write_mode_enabled: {
        default: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Enable writes to your Danbooru blacklist with the <b><u>Push</u></b> button."
    },
    validate_mode_enabled: {
        default: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Currently disabled."
    },
    order_mode_enabled: {
        default: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Currently disabled."
    },
    session_use_enabled: {
        default: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Have a different state of enabled on every page tab."
    },
    session_level_enabled: {
        default: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Have a different active list on every page tab."
    }
};

const CONTROL_CONFIG = {
    cache_info: {
        value: "Click to populate",
        hint: "Calculates the cache usage of the program and compares it to the total usage.",
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
        name: 'mode',
    },{
        name: 'session',
    }],
    controls: [],
};

// Default values

const DEFAULT_VALUES = {
    $safelist_posts: null,
    active_background_work: {},
    passive_background_work: {},
    passive_lists_processed: 0,
};

//CSS Constants

const safelist_css = `
/*SafelistPlus controls*/
#page #safelist-box #safelist .safelist-active,
#page #safelist-box #safelist .safelist-pending {
    font-style: italic;
}
#page #safelist-box #safelist .safelist-allnone {
    font-weight: bold;
}
#page #safelist-box #enable-safelist {
    color: mediumseagreen;
}
#page #safelist-box #disable-safelist {
    color: red;
}
    /*Sidebar list*/
#page #sidebar #safelist-box.sidebar-safelist {
    margin-bottom: 0.5em;
}
#page #sidebar #safelist-box.sidebar-safelist h1 {
    margin-left: -4px;
    font-size: 1.16667em;
}
#page #sidebar #sl-collapsible-list {
    margin-right: -4px;
}
[data-user-theme="dark"] .ui-icon {
    background-image: url(/packs/media/images/ui-icons_ffffff_256x240-bf27228a.png);
}
#page #sidebar #safelist-box.sidebar-safelist #safelist {
    margin-bottom: 0.5em;
    margin-left: 2em;
}
#page #sidebar #safelist-box.sidebar-safelist #safelist li {
    list-style-type: disc;
}
#page #sidebar #safelist-box.sidebar-blacklist #safelist .safelist-pending:after {
    content: "(Loading)";
    padding-left: 4px;
}
    /*Topbar list*/
#page #safelist-box.inline-safelist {
    margin-bottom: 0.5em;
}
#page #safelist-box.inline-safelist h1 {
    font-size: 1em;
    display: inline;
}
#page #safelist-box.inline-safelist h1:after {
    content: ":";
}
#page #safelist-box.inline-safelist #safelist {
    display: inline;
}
#page #safelist-box.inline-safelist #safelist li {
    display: inline;
    position: relative;
}
#page #safelist-box.inline-safelist #safelist li:after {
    content: "|";
    font-weight: normal;
}
#page #safelist-box.inline-safelist #safelist li.safelist-pending:before {
    content: "(Loading)";
    top: 20px;
    left: -5px;
    position: absolute;
}

/*Level settings*/
    /*General settings*/
#safelist-settings {
    display: block;
}
#safelist-settings input.btn {
    margin-right: 1em;
    margin-top: 1em;
    min-width: 4em;
}
    /*Name row*/
#safelist-settings .safelist-namerow {
    height: 2em;
}
#safelist-settings .safelist-namerow h2 {
    display: inline-block;
    margin-right: 0.5em;
}
#safelist-settings .safelist-namerow .safelist-name {
    margin: 0.5em;
    padding-left: 0.5em;
    line-height:150%;
}
#safelist-settings .safelist-namerow .safelist-edit {
    margin-right: 0;
    margin-top: 0;
    margin-bottom: 0.5em;
}
#safelist-settings > div {
    margin-bottom: 1em;
}
    /*Input groupings*/
#safelist-settings .safelist-input {
    border: 2px solid grey;
    padding: 0.8em;
    border-radius: 10px;
    display: grid;
    grid-template-columns: 50% 50%;
}
#safelist-settings .safelist-input label {
    display: block;
    font-weight: bold;
    line-height: 1.5em;
    font-size: 100%;
}
#safelist-settings .safelist-input span {
    display: block;
    max-width: 90%;
}
    /*Textblock(s)*/
#safelist-settings textarea {
    width: 90%;
    height: 10em;
}
#safelist-settings .safelist-textblock li {
    list-style-type: disc;
}
#safelist-settings .safelist-textblock ul {
    margin-left: 1.5em;
}
#safelist-settings .safelist-textblock div {
    padding: 0 0.5em;
    border: 2px solid lightgrey;
    width: 90%;
    height: 10em;
    font-size: 0.8em;
    overflow: auto;
}
    /*Checkbox input*/
#safelist-settings .safelist-checkbox input {
    margin-top: 1em;
}
#safelist-settings .safelist-checkbox .hint {
    margin: 1em 0;
}
    /*Fit and placement settings*/
#safelist-settings .safelist-textblock,
#safelist-settings .safelist-checkbox,
#safelist-settings .safelist-textinput,
#safelist-settings .safelist-namerow  {
    float: left;
    margin-top: 0.5em;
    position: relative;
}
#safelist-settings .safelist-selection,
#safelist-settings .safelist-halfcheckbox {
    width: 50%;
    float: left;
    margin-top: 0.5em;
    position: relative;
}
    /*Tooltip*/
#safelist-settings .safelist-input .safelist-help {
    color: hotpink;
}
    /*Hide settings*/
#safelist-settings .safelist-name {
    display: none;
}`;

const css_enabled = `
#page #blacklist-box,
#enable-safelist {
    display: none !important;
}`;

const css_disabled = `
#safelist,
#disable-safelist {
    display: none !important;
}
#blacklist-box.inline-blacklist {
    margin-bottom: 4px;
}`;

//HTML constants

const PROGRAM_DATA_DETAILS = `
<p class="tn">All timestamps are in milliseconds since the epoch (<a href="https://www.epochconverter.com">Epoch converter</a>).</p>
<ul>
    <li>Blacklist data
        <ul>
            <li><b>level-data:</b> All configurable settings for each ${PROGRAM_NAME} level.</li>
            <li><b>active-list:</b> Current ${PROGRAM_NAME} level (only with session level disabled).</li>
        </ul>
    </li>
    <li>General data
        <ul>
            <li><b>user-settings:</b> All program configurable settings.</li>
            <li><b>script-enabled:</b> Whether the ${PROGRAM_NAME} is active or not (only with session use disabled).</li>
            <li><b>show-menu:</b> Whether the ${PROGRAM_NAME} menu is shown or not.</li>
        </ul>
    </li>
</ul>`;

//Message constants

const keyselect_help = `Changes list when ${PROGRAM_NAME} is active.\nKeep in mind existing Danbooru hotkeys.`;
const background_help = "Process this list in the background so that changing lists is more responsive.";
const tagblock_help = "Put any tag combinations you never want to see here.\nEach combination should go on a separate line.";
const cssblock_help = "Style to apply to the whole site.";

const button_hints = {
    pull: "Populate tag box with your Danbooru blacklist.",
    push: "Save tag box to your Danbooru blacklist.",
};

//Other constants

const timeout_polling_interval = 1000;

//Class constants

const safelist_defaults = {
    set level(level) {
        this._level = level;
    },
    get level() {
        return this._level;
    },
    get name() {
        return "Level " + this._level.toUpperCase();
    },
    list: [''],
    css: "",
    hotkey: ['',''],
    enabled: true,
    background: true,
};

const safelist_keys = Object.keys(safelist_defaults).filter((key) => !key.match(/^_/));

const level_buttons = ['pull', 'push', 'delete'];
const modifier_keys = ['', 'alt', 'shift', 'ctrl'];
const keyselect_keys = [''].concat('abcdefghijklmnopqrstuvwxyz1234567890'.split(''));

const _private_data = new WeakMap();

//Classes

class Safelist {
    constructor(level) {
        safelist_defaults.level = level;
        safelist_keys.forEach((key)=>{this[key] = safelist_defaults[key];});
        _private_data.set(this, {});
        this.setupPrivateData('menu');
        this.setupPrivateData('side');
    }

    correctData(level) {
        let error_messages = [];
        safelist_defaults.level = level;
        let check = validate(this,level_constraints);
        if (check !== undefined) {
            error_messages.push([`level_data[${level}]:`, JSON.stringify(check, null, 2)]);
            for (let key in check) {
                this[key] = safelist_defaults[key];
            }
        }
        check = validate(this.hotkey,hotkey_constraints);
        if (check !== undefined) {
            error_messages.push([`level_data[${level}].hotkey:`, JSON.stringify(check, null, 2)]);
            for (let key in check) {
                this.hotkey[key] = safelist_defaults.hotkey[key];
            }
        }
        let nonstring_list = this.list.filter((entry) => !JSPLib.validate.isString(entry));
        if (nonstring_list.length > 0) {
            error_messages.push([`level_data[${level}].list: bad values found - `, nonstring_list]);
            if (nonstring_list.length === this.list.length) {
                this.list = safelist_defaults.list;
            } else {
                this.list = JSPLib.utility.arrayDifference(this.list, nonstring_list);
            }
        }
        let extra_keys = JSPLib.utility.arrayDifference(Object.keys(this), Object.keys(safelist_defaults));
        if (extra_keys.length) {
            error_messages.push([`level_data[${level}]: bad keys found - `, extra_keys]);
            extra_keys.forEach((key)=>{delete this[key];});
        }
        return error_messages;
    }

    /////////////////////////
    //Getter/setter functions

    get isVariable() {
        return !isNaN(this.level);
    }
    get isPrunable() {
        return (this.isVariable && !this.enabled);
    }
    get isEmpty() {
        return (this.list.length === 1) && (this.list[0] === '');
    }
    get hasActiveHotkey() {
        return !((!Array.isArray(this.hotkey)) || (this.hotkey.length < 2) || (this.hotkey[1] === ''));
    }
    get tagstring() {
        return this.list.join('\n');
    }
    set tagstring(str) {
        this.list = JSPLib.utility.filterEmpty(str.split('\n').map($.trim));
        this.list = (this.list.length === 0 ? [''] : this.list);
    }
    /***Need to see how this works***/
    get escaped_name() {
        return JSPLib.utility.HTMLEscape(this.name);
    }
    //Copied code from Danbooru on adding !important to every entry
    get renderedCSS() {
        return '\r\n' + this.css
            .split('\n')
            .map(function(str) {
                return str.replace(
                    /(\S)\s*(?:!important)?\s*(;|})/,
                    "$1 !important$2");
                })
            .join('\n') + '\r\n';
    }

    setupPrivateData(name) {
        Object.defineProperty(this, name, {
            set: (x)=>{
                let data = _private_data.get(this);
                data[name] = x;
                _private_data.set(this, data);
            },
            get: () => _private_data.get(this)[name],
        });
    }

    /////////////////////////
    //Render HTML functions

    //Links in the side menu
    get renderedSide() {
        if (!this.enabled) {
            return "";
        }
        const constantaddon = (this.isVariable ? "" : 'class="safelist-allnone"');
        return `
        <li ${constantaddon} data-level="${this.level}"><a href="#">${this.escaped_name}</a></li>`;
    }
    //Sections in the setting menu
    get renderedLevelSetting() {
        let namerow = this.renderedNamerow;
        let keyselect = this.renderedKeyselect;
        let background = (this.isVariable ? this.renderedBackgroundOption : "");
        let mainblock = (this.isVariable ? this.renderedTagBlock : this.renderedEnableCheckbox);
        let cssblock = this.renderedCSSBlock;
        let buttons = (this.isVariable ? this.renderedLevelButtons : "");
        return `
        <div class="safelist-input" data-level="${this.level}">
            ${namerow}
            <span style="display:inline-block">
                ${keyselect}
                ${background}
            </span>
            ${mainblock}
            ${cssblock}
            ${buttons}
        </div>`;
    }
    //List name, edit button and textbox
    get renderedNamerow() {
        return `
            <div class="safelist-namerow">
                <h2>${this.escaped_name}</h2>
                <input type="text" value="${this.escaped_name}" size="40" autocomplete="off" class="safelist-name">
                ${RenderButton('edit')}
            </div>`;
    }
    //Hotkey dropdowns
    get renderedKeyselect() {
        let select1 = modifier_keys.map((key)=>{
            let selected = (this.hotkey[0] === key ? 'selected="selected"' : "");
            let ucase = JSPLib.utility.titleizeString(key);
            return `<option ${selected} value="${key}">${ucase}</option>`;
        }).join("");
        let select2 = keyselect_keys.map((key)=>{
            let selected = (this.hotkey[1] === key ? 'selected="selected"' : "");
            let ucase = key.toUpperCase();
            return `<option ${selected} value="${key}">${ucase}</option>`;
        }).join("");
        return `
    <div class="safelist-selection">
        <label for="safelist_modifier_level_${this.level}">Hotkey (${RenderHelp(keyselect_help)})</label>
        <select id="safelist_modifier_level_${this.level}" class="safelist-modifier">
            ${select1}
        </select>
        <select id="safelist_keyselect_level_${this.level}" class="safelist-keyselect">
            ${select2}
        </select>
    </div>`;
    }
    //Background process options
    get renderedBackgroundOption() {
        const value = (this.background ? "checked" : "");
        return `
    <div class="safelist-halfcheckbox">
        <label for="safelist_background_level_${this.level}">Background Process (${RenderHelp(background_help)})</label>
        <input type="checkbox" ${value} id="safelist_process_level_${this.level}" class="safelist-background">
    </div>`;
    }
    //For constant levels all and none... takes place of taglist
    get renderedEnableCheckbox() {
        const value = (this.enabled ? "checked" : "");
        const label = (this.level === 'a' ? "All" : "None");
        const hint = (this.level === 'a' ? "Shows everything." : "Shows nothing.");
        return `
    <div class="safelist-checkbox">
        <label for="safelist_enable_level_${this.level}">${label} list enabled (${RenderHelp(hint)})</label>
        <input type="checkbox" ${value} id="safelist_enable_level_${this.level}" class="safelist-enable">
    </div>`;
    }
    //For custom levels
    get renderedTagBlock() {
        return `
    <div class="safelist-textblock">
        <label for="safelist_tags_level_${this.level}">Blacklisted tags (${RenderHelp(tagblock_help)})</label>
        <textarea id="safelist_tags_level_${this.level}" cols="40" rows="5" autocomplete="off" class="safelist-tags">${this.tagstring}</textarea>
    </div>`;
    }
    //Custom style per level
    get renderedCSSBlock() {
        return `
    <div class="safelist-textblock">
        <label for="safelist_css_level_${this.level}">Custom CSS (${RenderHelp(cssblock_help)})</label>
        <textarea id="safelist_css_level_${this.level}" cols="40" rows="5" autocomplete="off" class="safelist-css">${this.css}</textarea>
    </div>`;
    }

    //Renders all level buttons
    get renderedLevelButtons() {
        let buttons1 = level_buttons.map((type) => RenderButton(type, button_hints[type])).join("");
        return `
    <div class="safelist-setting-buttons">
        ${buttons1}
    </div>`;
    }

    ////////////////////
    //Event functions

    //Document level

    //Activate hotkey for level if it exists
    setKeypress() {
        let namespace = "keydown.sl-level_" + this.level;
        $(document).off(namespace);
        if (!this.enabled || !this.hasActiveHotkey) {
            return;
        }
        let context = this;
        let combokey = (this.hotkey[0] === '' ? this.hotkey[1] : this.hotkey.join('+'));
        JSPLib.debug.debuglog('setKeypress',`Level ${this.level} hotkey: ${combokey}`);
        $(document).on(namespace, null, combokey,(event)=>{
            if (SL.enable_safelist) {
                event.preventDefault();
                if (HasBlacklist()) {
                    $("a", context.side).click();
                } else {
                    JSPLib.utility.setCSSStyle(context.renderedCSS, 'safelist_user_css');
                    SaveLevel(context.level);
                }
            }
        });
    }

    //Side menu

    setSideClick() {
        let context = this;
        $("a", this.side).off(PROGRAM_CLICK).on(PROGRAM_CLICK,(event)=>{
            SetSideLevel(context);
            event.preventDefault();
        });
    }

    //Level menu

    initializeLevelMenuEvents() {
        this.setNameChangeClick();
        this.setPullButtonClick();
        this.setPushButtonClick();
        this.setDeleteButtonClick();
    }
    setNameChangeClick() {
        let context = this;
        $(".safelist-edit", context.menu).off(PROGRAM_CLICK).on(PROGRAM_CLICK,()=>{
            $("h2", context.menu).hide();
            $(".safelist-edit", context.menu).hide();
            $(".safelist-name", context.menu).show();
        });
    }
    setPullButtonClick() {
        let context = this;
        $(".safelist-pull", context.menu).off(PROGRAM_CLICK).on(PROGRAM_CLICK,()=>{
            $(".safelist-tags", context.menu).val(
                JSPLib.utility.getMeta("blacklisted-tags")
                .replace(/(rating:[qes])\w+/ig, "$1")
                .toLowerCase().split(/,/).join('\n')
            );
        });
    }
    setPushButtonClick() {
        let context = this;
        $(".safelist-push", context.menu).off(PROGRAM_CLICK).on(PROGRAM_CLICK,()=>{
            if (confirm("Update your blacklist on Danbooru?")) {
                let tagdata = $(".safelist-tags", context.menu).val().replace(/\n/g, '\r\n');
                let senddata = {'user': {'blacklisted_tags': tagdata}};
                $.ajax({
                  type: "PUT",
                  url: `/users/${SL.userid}.json`,
                  data: senddata,
                  success: function(data) {
                    JSPLib.debug.debuglog('setPushButtonClick',"Success", data);
                    JSPLib.notice.notice("Settings updated.");
                  },
                  error: function(data) {
                    JSPLib.debug.debuglog('setPushButtonClick',"Failure", data);
                    JSPLib.notice.notice("Error updating settings!");
                  }
                });
            }
        });
    }
    setDeleteButtonClick() {
        let context = this;
        $('.safelist-delete', context.menu).off(PROGRAM_CLICK).on(PROGRAM_CLICK,()=>{
            $(context.side).hide();
            $(context.menu).hide();
            context.enabled = false;
        });
    }

    /////////////////////
    //Helper functions

    disableLevel() {
        this.enabled = false;
        //This will remove all HTML objects and events
        $(this.side).remove();
        $(this.menu).remove();
        //This will remove the keypress when disabled
        this.setKeypress();
    }
    resetButtons() {
        $(".safelist-validate", this.menu).show();
        $(".safelist-order", this.menu).show();
        SL.user_settings.validate_mode_enabled && $(".safelist-validate", this.menu).removeAttr('disabled');
        SL.user_settings.order_mode_enabled && $(".safelist-order", this.menu).removeAttr('disabled');
    }
}

//Validate constants

const level_constraints = {
    level: JSPLib.validate.string_constraints(true, {minimum: 1}),
    name: JSPLib.validate.string_constraints(true, {minimum: 1}),
    css: JSPLib.validate.stringonly_constraints,
    enabled: JSPLib.validate.boolean_constraints,
    background: JSPLib.validate.boolean_constraints,
    list: JSPLib.validate.array_constraints({minimum: 1}),
    hotkey: JSPLib.validate.array_constraints({is: 2}),
};

const hotkey_constraints = [
    JSPLib.validate.inclusion_constraints(modifier_keys),
    JSPLib.validate.inclusion_constraints(keyselect_keys)
];

/****Functions****/

//Validate functions

function ValidateProgramData(key,entry) {
    var checkerror = [];
    switch (key) {
        case 'sl-user-settings':
            checkerror = JSPLib.menu.validateUserSettings(entry, SETTINGS_CONFIG);
            break;
        case 'sl-level-data':
            checkerror = ValidateLevelData();
            break;
        case 'sl-script-enabled':
        case 'sl-show-menu':
            if (!JSPLib.validate.isBoolean(entry)) {
                checkerror = ["Value is not a boolean."];
            }
            break;
        case 'sl-active-list':
            if (!Object.keys(SL.level_data).includes(entry)) {
                checkerror = ["Value is not a valid list key."];
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

function ValidateLevelData() {
    let error_messages = [];
    for (let level in SL.level_data) {
        if (!(SL.level_data[level] instanceof Safelist)) {
            error_messages.push(['Invalid Safelist:', level]);
            SL.level_data[level] = new Safelist(level);
        } else {
            let level_error = SL.level_data[level].correctData(level);
            if (level_error.length) {
                error_messages = JSPLib.utility.concat(error_messages, level_error);
            }
        }
    }
    return error_messages;
}

function CorrectLevelData() {
    let error_messages = ValidateLevelData();
    if (error_messages.length) {
        this.debug('log',"Corrections to level data detected!");
        error_messages.forEach((error)=>{this.debug('log',...error);});
        SaveLevelData();
        SL.channel.postMessage({type: "correction", level_data: SL.level_data});
    } else {
        this.debug('log',"Level data is valid.");
    }
}

///////////////////////////
//Library functions

////None

/////////////////////
//Helper functions

function HasBlacklist() {
    return Boolean(SL.blacklist_box.length);
}

function GetEnabledStorage() {
    return (SL.user_settings.session_use_enabled ? sessionStorage : localStorage);
}

function GetActiveStorage() {
    return (SL.user_settings.session_level_enabled ? sessionStorage : localStorage);
}

function CheckPriority() {
    return (SL.enable_safelist && (SL.active_list !== undefined) && (!(SL.active_list in SL.post_lists)));
}

function IsLevelMenu() {
    return SL.controller === "posts" && SL.action === "index";
}

function GetNextLevel() {
    if (!GetNextLevel.level) {
        GetNextLevel.level = Math.max(...SL.menu_items.variable_menus);
    }
    return ++GetNextLevel.level;
}

///////////////////////////
//Auxiliary functions

//Create the same structure that Danbooru uses for each custom list
function CreateEntryArray(){
    let custom_entries = {};
    for (let level in SL.level_data) {
        let val = SL.level_data[level];
        if(val.isVariable) {
            var array = [];
            for (let i = 0; i < val.list.length; i++) {
                if (val.list[i] === "") {
                    continue;
                }
                var entry = Danbooru.Blacklist.parse_entry(val.list[i]);
                array.push(entry);
            }
            custom_entries[level] = array;
        }
    }
    return custom_entries;
}

//Get the current state of the menus for other functions to use
function CalculateRenderedMenus() {
    var menu = {'rendered_menus': [], 'variable_menus': [], 'process_menus': []};
    for (let level in SL.level_data) {
        let val = SL.level_data[level];
        if (val.enabled) {
            if (val.isVariable) {
                menu.variable_menus.push(parseInt(val.level));
                if (val.background) {
                    menu.process_menus.push(parseInt(val.level));
                }
            }
            menu.rendered_menus.push(val.level);
        }
    }
    //Sort from lowest to highest, and then set to string
    menu.variable_menus = menu.variable_menus.sort((a,b) => (a - b)).map(String);
    menu.process_menus = menu.process_menus.sort((a,b) => (a - b)).map(String);
    return menu;
}

////////////////////
//Render functions

function RenderHelp(help_text) {
    return `<a class="safelist-help" title="${help_text}">&nbsp;?&nbsp;</a>`;
}

function RenderButton(type,hint) {
    const value = JSPLib.utility.titleizeString(type);
    const hint_html = (hint ? `title="${hint}"` : "");
    return `<input type="submit" value="${value}" ${hint_html} class="btn safelist-${type}">`;
}

function RenderSidemenu() {
    let all_side = SL.level_data.a.renderedSide;
    let none_side = SL.level_data.n.renderedSide;
    let variable_sides = SL.menu_items.variable_menus.map((level) => SL.level_data[level].renderedSide).join("");
    let safelist_type = (SL.blacklist_box.hasClass("sidebar-blacklist") ? "sidebar-safelist" : "inline-safelist");
    let direction = (SL.is_shown ? "s" : "e");
    return `
<section id="safelist-box" class="${safelist_type}">
    <h1><a id="sl-collapsible-list" class="ui-icon ui-icon-triangle-1-${direction}"></a>&nbsp;${PROGRAM_NAME}</h1>
    <ul id="safelist">
        ${all_side}
        ${variable_sides}
        ${none_side}
    </ul>
    <a href="#" id="enable-safelist">Enable</a>
    <a href="#" id="disable-safelist">Disable</a>
</section>`;
}

function RenderSettingMenuLink() {
    return `
<li><a href="#" id="display-safelist-settings">${PROGRAM_NAME}</a></li>`;
}

function RenderLevelMenu() {
    let all_menu = SL.level_data.a.renderedLevelSetting;
    let none_menu = SL.level_data.n.renderedLevelSetting;
    let variable_menus = SL.menu_items.variable_menus.map((level) => SL.level_data[level].renderedLevelSetting).join("");
    return `
<fieldset id="safelist-settings">
    ${all_menu}
    ${none_menu}
    ${variable_menus}
    <hr>
    <div id="safelist-controls">
        <input type="submit" id="safelist-commit" value="Submit" class="btn">
        <input type="submit" id="safelist-add" value="Add" class="btn">
        <input type="submit" id="safelist-resetall" value="Reset All" class="btn">
    </div>
</fieldset>
`;
}


///////////////////////////
//Initialize functions

function InitializeSafelistData() {
    for (let level in SL.level_data) {
        SL.level_data[level] = Object.assign(new Safelist(""), SL.level_data[level]);
    }
}

function InitializeProgramData() {
    SL.level_data = $.extend({},...['a','n','1'].map((level) => ({[level]: new Safelist(level)})));
    SaveLevelData();
    SL.enable_safelist = true;
    SL.active_list = null;
    SaveSessionData();
}

function InitializeSide() {
    if (!SL.is_shown) {
        $("#safelist").hide();
    }
    SL.post_lists = {};
    SL.post_lists.a = [];
    SL.post_lists.n = SafelistPosts().toArray();
    SL.custom_entries = CreateEntryArray();
    InitializeSideDOMs();
    InitializeSideEvents();
    SetListCount('a');
    SetListCount('n');
    if (SL.enable_safelist) {
        $("#enable-safelist").click();
    } else {
        $("#disable-safelist").click();
    }
}

function InitializeSideDOMs() {
    $("#safelist > li").each((i,entry)=>{
        let level = $(entry).data('level');
        SL.level_data[level].side = entry;
    });
}

function InitializeSideEvents() {
    for (let level in SL.level_data) {
        SL.level_data[level].setSideClick();
        SL.level_data[level].setKeypress();
    }
    $("#enable-safelist").off(PROGRAM_CLICK).on(PROGRAM_CLICK, EnableSafelist);
    $("#disable-safelist").off(PROGRAM_CLICK).on(PROGRAM_CLICK, DisableSafelist);
    $("#sl-collapsible-list").off(PROGRAM_CLICK).on(PROGRAM_CLICK, ToggleSafelist);
}

function InitializeSettingsMenu() {
    if ($(".active #display-safelist-settings").length === 0) {
        $("#safelist-settings").hide();
    }
    InitializeSettingsDOMs();
    InitializeSettingEvents();
    !SL.user_settings.write_mode_enabled && $(".safelist-push").attr('disabled', true).hide();
    !SL.user_settings.validate_mode_enabled && $(".safelist-validate").attr('disabled', true);
    !SL.user_settings.order_mode_enabled && $(".safelist-order").attr('disabled', true);
}

function InitializeSettingsDOMs() {
    $(".safelist-input").each((i,entry)=>{
        let level = $(entry).data('level');
        SL.level_data[level].menu = entry;
    });
}

function InitializeSettingEvents() {
    for (let level in SL.level_data) {
        SL.level_data[level].initializeLevelMenuEvents();
    }
    $(".safelist-help").off(PROGRAM_CLICK).on(PROGRAM_CLICK, HelpInfo);
    $("#safelist-commit").off(PROGRAM_CLICK).on(PROGRAM_CLICK, MenuSaveButton);
    $("#safelist-add").off(PROGRAM_CLICK).on(PROGRAM_CLICK, MenuAddButton);
    $("#safelist-resetall").off(PROGRAM_CLICK).on(PROGRAM_CLICK, MenuResetAllButton);
}

function InitializeActiveCSS() {
    let value = SL.level_data[SL.active_list];
    value && JSPLib.utility.setCSSStyle(value.renderedCSS, 'safelist_user_css');
}

function InitializeNonpost() {
    InitializeActiveCSS();
    for (let level in SL.level_data) {
        SL.level_data[level].setKeypress();
    }
}

function ResetAllSettings() {
    //Cancel any list calculations
    SignalActiveList();
    RestartLists();
    //Side menu items
    SL.menu_items = CalculateRenderedMenus();
    $("#safelist-box").replaceWith(RenderSidemenu());
    InitializeSide();
    //Settings menu
    $("#safelist-settings").replaceWith(RenderLevelMenu());
    InitializeSettingsMenu();
}

///////////////////////////
//Storage functions

function LoadLevelData() {
    SL.level_data = JSPLib.storage.getStorageData('sl-level-data', localStorage);
    if (!SL.level_data) {
        InitializeProgramData();
    } else {
        InitializeSafelistData();
    }
}

function SaveLevelData() {
    JSPLib.storage.setStorageData('sl-level-data', SL.level_data, localStorage);
}

function LoadSessionData() {
    SL.enable_safelist = JSPLib.storage.checkStorageData('sl-script-enabled', ValidateProgramData, GetEnabledStorage());
    if (!SL.enable_safelist && SL.user_settings.session_use_enabled) {
        SL.enable_safelist = JSPLib.storage.checkStorageData('sl-script-enabled', ValidateProgramData, localStorage, true);
    }
    SL.active_list = JSPLib.storage.checkStorageData('sl-active-list', ValidateProgramData, GetActiveStorage());
    if (!SL.active_list && SL.user_settings.session_level_enabled) {
        SL.active_list = JSPLib.storage.checkStorageData('sl-active-list', ValidateProgramData, localStorage);
    }
}

function SaveSessionData() {
    JSPLib.storage.setStorageData('sl-script-enabled', SL.enable_safelist, GetEnabledStorage());
    JSPLib.storage.setStorageData('sl-active-list', SL.active_list, GetActiveStorage());
}

function SaveStatus(status) {
    if (SL.enable_safelist !== status) {
        SL.enable_safelist = status;
        SaveSessionData();
        SL.channel.postMessage({type: "status_change", enable_safelist: SL.enable_safelist});
    }
}

function SaveLevel(level) {
    if (SL.active_list !== level) {
        SL.active_list = level;
        SaveSessionData();
        SL.channel.postMessage({type: "level_change", active_list: SL.active_list});
    }
}

///////////////////////////
//DOM functions

//Set the style for the active list in the side menu
function SetActiveList(level,type) {
    if (!level || !(level in SL.level_data)) {
        return;
    }
    $("#safelist li").removeClass("safelist-active safelist-pending");
    $(SL.level_data[level].side).addClass(`safelist-${type}`);
}

function SetListCount(level) {
    let value = SL.level_data[level];
    let count = SL.post_lists[level];
    if (value && count) {
        $("a", value.side).attr('title', `${count.length} posts`);
    }
}

//A faster way to show and hide posts using precalcuated lists
function ShowHidePosts(postlist) {
    postlist.forEach((post)=>{
        SafelistHide(post);
    });
    SafelistPosts().not(postlist).each((i,post)=>{
        SafelistUnhide(post);
    });
}

//Copy of Danbooru's functions since we're using a different class to hide items
function SafelistHide(post) {
    post.style.setProperty('display', 'none', 'important');
    if (SL.has_video) {
        var $video = $(post).find("video")[0];
        if ($video) {
            $video.pause();
            $video.currentTime = 0;
        }
    }
}

function SafelistUnhide(post) {
    var type = 'inline-block';
    if (post.id === "image-container") {
        type = 'block';
    } else if (SL.controller === "comments" || JSPLib.utility.DOMtoArray(post.parentElement.classList).includes('list-of-comments')) {
        type = 'flex';
    }
    post.style.setProperty('display', type, 'important');
    if (SL.has_video && document.hasFocus()) {
        var $video = $(post).find("video")[0];
        if ($video) {
            $video.play();
        }
    }
}

function RemovePostStyles() {
    SafelistPosts().each((i,post)=>{post.style.removeProperty('display');});
}

function SafelistPosts() {
    if (!('posts' in SafelistPosts)) {
        let post_preview_selector = `#c-${SL.controller} #a-${SL.action} .post-preview`;
        SafelistPosts.posts = $(`${post_preview_selector}, .image-container, #c-comments .post`);
    }
    return SafelistPosts.posts;
}

///////////////////////////
//Calculate list functions

//Asynchronous function that calculates inactive lists in the background
function CalculatePassiveLists(deadline) {
    //Only start calculating once the active enabled list is done
    if (CheckPriority()) {
        SL.passive_handle = requestIdleCallback(CalculatePassiveLists);
        return;
    }
    SL.$safelist_posts = SL.$safelist_posts || SafelistPosts();
    while (true) {
        //Are we starting a new job?
        if (!('update_list' in SL.passive_background_work)) {
            //Get the next uncalculated list
            let update_list = JSPLib.utility.arrayDifference(SL.menu_items.process_menus, Object.keys(SL.post_lists))[0];
            //Main exit condition
            if (update_list === undefined) {
                this.debug('log',"Done!");
                return;
            }
            if (SL.passive_lists_processed === 0) {
                this.debug('log',"Passive list start:", JSPLib.utility.getProgramTime());
            }
            SL.passive_lists_processed++;
            //Initialize FOR loop and other variables
            SL.passive_background_work.update_list = update_list;
            SL.passive_background_work.start_id = 0;
            SL.passive_background_work.update_array = [];
            SL.passive_background_work.start_time = performance.now();
        } else if (SL.passive_background_work.update_list in SL.post_lists) {
            //User has changed list from inactive to active midst calculating
            SL.passive_background_work = {};
            continue;
        }
        let index = SL.passive_background_work.update_list;
        //Restart the FOR loop where we left off
        for (let i=SL.passive_background_work.start_id;i < SL.$safelist_posts.length;i++) {
            for (let j=0;j<SL.custom_entries[index].length;j++){
                if (Danbooru.Blacklist.post_match(SL.$safelist_posts[i], SL.custom_entries[index][j])) {
                    SL.passive_background_work.update_array.push(SL.$safelist_posts[i]);
                    //Bail early on any entry match
                    break;
                }
            }
            SL.passive_background_work.start_id++;
            if (deadline.timeRemaining() <= 0.0) {
                //Release function back to idle pool
                SL.passive_handle = requestIdleCallback(CalculatePassiveLists);
                return;
            }
        }
        //Add finished list to global variable
        SL.post_lists[index] = SL.passive_background_work.update_array;
        SetListCount(index);
        this.debug('log',`Complete[${index}]:`, performance.now() - SL.passive_background_work.start_time);
        SL.passive_background_work = {};
    }
}

//Like CalculatePassiveLists, but for the active list, plus it has higher priority
function CalculateActiveList() {
    SL.$safelist_posts = SL.$safelist_posts || SafelistPosts();
    if (('level' in SL.active_background_work) && (SL.active_list !== SL.active_background_work.level)) {
        this.debug('log',"Changing list...");
        SL.active_background_work = {};
    }
    if ((SL.active_list in SL.post_lists) || (!SL.enable_safelist)) {
        this.debug('log',"Bailing on work...");
        SL.active_background_work = {};
        SetActiveList(SL.active_list,'active');
        return;
    }
    if (!('level' in SL.active_background_work)) {
        this.debug('log',"Active list start:", JSPLib.utility.getProgramTime());
        SL.active_background_work.level = SL.active_list;
        SL.active_background_work.start_id = 0;
        SL.active_background_work.update_array = [];
        SL.active_background_work.start_time = performance.now();
    }
    let level = SL.active_background_work.level;
    let iteration_time = performance.now();
    for (let i = SL.active_background_work.start_id; i < SL.$safelist_posts.length; i++) {
        for (let j = 0; j < SL.custom_entries[level].length; j++){
            if (Danbooru.Blacklist.post_match(SL.$safelist_posts[i], SL.custom_entries[level][j])) {
                SL.active_background_work.update_array.push(SL.$safelist_posts[i]);
                //Bail early on any entry match
                break;
            }
        }
        SL.active_background_work.start_id++;
        //Pass control back every once in a while to avoid locking up the browser
        if ((performance.now() - iteration_time) > 50.0) {
            SL.active_timer = setTimeout(CalculateActiveList, 1);
            return ;
        }
    }
    SL.post_lists[level] = SL.active_background_work.update_array;
    this.debug('log',"Complete:",performance.now() - SL.active_background_work.start_time);
    SetActiveList(SL.active_list, 'active');
    ShowHidePosts(SL.post_lists[level]);
    SetListCount(level);
    SL.active_background_work = {};
}

//Signal CalculatePassiveLists to stop and restart work
function RestartLists() {
    cancelIdleCallback(SL.passive_handle);
    SL.passive_background_work = {};
    SL.passive_handle = requestIdleCallback(CalculatePassiveLists);
}

//Signal CalculateActiveList to stop, with an alternative restart
function SignalActiveList(restart=false) {
    clearTimeout(SL.active_timer);
    if (CheckPriority()) {
        SL.active_background_work = {};
        if (restart) {
            SL.active_timer = setTimeout(CalculateActiveList, 1);
        }
    }
}

////////////////////
// Event functions

function HelpInfo(event) {
    let help_text = $(event.target).attr('title');
    alert(help_text);
    event.preventDefault();
}

function EnableSafelist(event) {
    JSPLib.utility.setCSSStyle(css_enabled, "blacklist_css");
    if (SL.menu_items.rendered_menus.includes(SL.active_list)){
        let value = SL.level_data[SL.active_list];
        value && $("a", value.side).click();
    }
    SaveStatus(true);
    event.preventDefault();
}

function DisableSafelist(event) {
    JSPLib.utility.setCSSStyle(css_disabled, "blacklist_css");
    JSPLib.utility.setCSSStyle("", 'safelist_user_css');
    RemovePostStyles();
    SaveStatus(false);
    event.preventDefault();
}

function ToggleSafelist(event) {
    $(event.target).toggleClass("ui-icon-triangle-1-e ui-icon-triangle-1-s");
    $('#safelist').slideToggle(100);
    SL.is_shown = !SL.is_shown;
    JSPLib.storage.setStorageData('sl-show-menu', SL.is_shown, localStorage);
    SL.channel.postMessage({type: "toggle", is_shown: SL.is_shown});
}

function SetSafelistSettingsClick() {
    if (!JSPLib.utility.isNamespaceBound("#display-safelist-settings", 'click', PROGRAM_SHORTCUT)) {
        $("#display-safelist-settings").on(PROGRAM_CLICK,(event)=>{
            $("#post-sections li").removeClass('active');
            $("#display-safelist-settings").parent().addClass('active');
            $("#content > *:not(#post-sections)").hide();
            $("#safelist-settings").show();
            event.preventDefault();
        });
    }
}

//These actions get executed along with any other existing click events
function SetOtherSectionsClick() {
    if (!JSPLib.utility.isNamespaceBound("#show-posts-link,#show-excerpt-link", 'click', PROGRAM_SHORTCUT)) {
        $("#show-posts-link,#show-excerpt-link").on(PROGRAM_CLICK, ()=>{
            $("#display-safelist-settings").parent().removeClass('active');
            $('#safelist-settings').hide();
        });
    }
}

function MenuAddButton() {
    let index = GetNextLevel().toString();
    let addlist = SL.level_data[index] = new Safelist(index);
    addlist.menu = $(addlist.renderedLevelSetting).insertBefore("#safelist-settings > hr");
    !SL.user_settings.write_mode_enabled && $(".safelist-push", addlist.menu).attr('disabled', true).hide();
    !SL.user_settings.validate_mode_enabled && $(".safelist-validate", addlist.menu).attr('disabled', true);
    !SL.user_settings.order_mode_enabled && $(".safelist-order", addlist.menu).attr('disabled', true);
    addlist.initializeLevelMenuEvents();
}

function MenuResetAllButton() {
    if (confirm("Reset all Safelist settings?")) {
        JSPLib.debug.debugTime("MenuResetAllButton");
        InitializeProgramData();
        ResetAllSettings();
        SL.channel.postMessage({type: "reset_levels", level_data: SL.level_data, enable_safelist: SL.enable_safelist, active_list: SL.active_list});
        JSPLib.debug.debugTimeEnd("MenuResetAllButton");
    }
}

function MenuSaveButton() {
    //Save presettings change for comparison later
    var preconfig = JSPLib.utility.dataCopy(SL.level_data);
    var premenu = SL.menu_items;
    for (let level in SL.level_data) {
        let value = SL.level_data[level];
        if (['a','n'].includes(level)) {
            value.enabled = $(".safelist-enable", value.menu).prop('checked');
        } else {
            value.tagstring = $(".safelist-tags", value.menu).val();
            value.background = $(".safelist-background", value.menu).prop('checked');
        }
        value.css = $(".safelist-css", value.menu).val();
        value.name = $(".safelist-name", value.menu).val();
        value.hotkey[0] = $(".safelist-modifier", value.menu).val();
        value.hotkey[1] = $(".safelist-keyselect", value.menu).val();
        if (value.isPrunable) {
            value.disableLevel();
            delete SL.level_data[level];
            delete preconfig[level];
            SL.post_lists[level];
        }
    }
    $(".safelist-namerow .safelist-name").hide();
    $(".safelist-namerow h2").show();
    $(".safelist-namerow .btn").show();
    SaveLevelData();
    JSPLib.notice.notice("Settings saved.");
    let changed_settings = JSPLib.utility.recurseCompareObjects(preconfig, SL.level_data);
    SL.menu_items = CalculateRenderedMenus();
    let changed_menus = Boolean(JSPLib.utility.arraySymmetricDifference(premenu.rendered_menus, SL.menu_items.rendered_menus).length);
    this.debug('log',changed_settings, changed_menus);
    if (!$.isEmptyObject(changed_settings) || changed_menus) {
        ReloadSafelist(changed_settings, changed_menus);
        SL.channel.postMessage({type: "reload", level_data: SL.level_data, changed_settings: changed_settings, changed_menus: changed_menus});
    }
}

function PostPreviewUpdated(event,post) {
    delete SafelistPosts.posts;
    SL.$safelist_posts = SafelistPosts();
    let $post = $(`#post_${post.id}`).get(0);
    for (let level in SL.post_lists) {
        if (level === 'a') {
            continue;
        } else if (level === 'n') {
            SL.post_lists.n = SafelistPosts().toArray();
            continue;
        }
        SL.post_lists[level] = SL.post_lists[level].filter((entry) => ($(entry).data('id') !== post.id));
        for (let j = 0; j < SL.custom_entries[level].length; j++){
            if (Danbooru.Blacklist.post_match($post, SL.custom_entries[level][j])) {
                SL.post_lists[level].push($post);
                //Bail early on any entry match
                break;
            }
        }
    }
    if (SL.enable_safelist) {
        if (SL.post_lists[SL.active_list].some((entry) => ($(entry).data('id') === post.id))) {
            SafelistHide($post);
        } else {
            SafelistUnhide($post);
        }
    }
}

////////////////////
//Main execution functions

function SetSideLevel(context) {
    if (SL.post_lists[context.level] === undefined){
        this.debug('log',"List not ready!");
        //If no lists are being actively calculated...?
        if ($.isEmptyObject(SL.active_background_work)) {
            //Don't start calculating the list in the click event
            SL.active_timer = setTimeout(CalculateActiveList, 1);
        }
        SetActiveList(context.level,'pending');
        //Else CalculateActiveList will automatically switch over
    } else {
        this.debug('log',"Precalculated list change");
        ShowHidePosts(SL.post_lists[context.level]);
        SetActiveList(context.level, 'active');
    }
    JSPLib.utility.setCSSStyle(context.renderedCSS, 'safelist_user_css');
    SaveLevel(context.level);
}

function ReloadSafelist(changed_settings,changed_menus) {
    if (changed_menus) {
        //The side menu has changed, so rerender it
        $("#safelist-box").replaceWith(RenderSidemenu());
        InitializeSideDOMs();
        InitializeSideEvents();
        SetActiveList(SL.active_list, 'active');
        SL.custom_entries = CreateEntryArray();
        if (IsLevelMenu()) {
            $("#safelist-settings").replaceWith(RenderLevelMenu());
            InitializeSettingsMenu();
        }
    } else if (!$.isEmptyObject(changed_settings)) {
        //A list has changed, so recreate the entry array
        if (Object.keys(changed_settings).some((level) => ('list' in changed_settings[level]))) {
            this.debug('log',"Updating custom entries...");
            SL.custom_entries = CreateEntryArray();
        }
        for (let level in changed_settings) {
            let changed_value = changed_settings[level];
            let value = SL.level_data[level];
            for (let key in changed_value) {
                if (key === 'list') {
                    delete SL.post_lists[level];
                }
                if (SL.enable_safelist && (SL.active_list === level)) {
                    if (key === 'list') {
                        SetActiveList(level, 'pending');
                        SignalActiveList(true);
                    } else if (key === 'css') {
                        JSPLib.utility.setCSSStyle(value.renderedCSS, 'safelist_user_css');
                    }
                }
                if (IsLevelMenu()) {
                    switch (key) {
                        case 'list':
                            $(".safelist-tags", value.menu).val(value.tagstring);
                            break;
                        case 'css':
                            $(".safelist-css", value.menu).val(value.css);
                            break;
                        case 'name':
                            $("h2", value.menu).text(value.name);
                            $(".safelist-name", value.menu).val(value.name);
                            $("a", value.side).text(value.name);
                            break;
                        case 'background':
                            $(".safelist-background", value.menu).prop('checked',value.background);
                            break;
                        case 'enabled':
                            $(".safelist-enable", value.menu).prop('checked',value.enabled);
                            //falls through
                        default:
                            //Do nothing
                    }
                }
                if (key === 'hotkey') {
                    value.setKeypress();
                }
            }
        }
    }
    RestartLists();
}

////////////////////
//Settings functions

function BroadcastSL(ev) {
    this.debug('log',`(${ev.data.type}):`, ev.data);
    if (((ev.data.type === "level_change") && SL.user_settings.session_level_enabled) &&
        ((ev.data.type === "status_change") && SL.user_settings.session_use_enabled)) {
        return;
    }
    if ('level_data' in ev.data) {
        SL.old_level_data = SL.level_data;
        SL.level_data = ev.data.level_data;
        let removed_menus = JSPLib.utility.arrayDifference(Object.keys(SL.old_level_data), Object.keys(SL.level_data));
        removed_menus.forEach((level)=>{
            SL.old_level_data[level].disableLevel();
            delete SL.post_lists[level];
        });
        InitializeSafelistData();
        InitializeSideDOMs();
        InitializeSettingsDOMs();
        SL.menu_items = CalculateRenderedMenus();
    }
    if (('active_list' in ev.data) && !SL.user_settings.session_level_enabled) {
        SL.active_list = ev.data.active_list;
    }
    if (('enable_safelist' in ev.data) && !SL.user_settings.session_use_enabled) {
        SL.enable_safelist = ev.data.enable_safelist;
    }
    if (HasBlacklist()) {
        switch (ev.data.type) {
            case "level_change":
                if (SL.enable_safelist) {
                    $("#enable-safelist").click();
                }
                break;
            case "status_change":
                if (SL.enable_safelist) {
                    $("#enable-safelist").click();
                } else {
                    $("#disable-safelist").click();
                }
                break;
            case "correction":
                ReloadSafelist({}, true);
                break;
            case "reload":
                ReloadSafelist(ev.data.changed_settings, ev.data.changed_menus);
                break;
            case "reset_levels":
                ResetAllSettings();
                //falls through
            default:
                //do nothing
        }
    } else if (SL.enable_safelist) {
        switch (ev.data.type) {
            case "level_change":
                InitializeActiveCSS();
                break;
            case "status_change":
            case "reload":
            case "reset_levels":
                InitializeNonpost();
                //falls through
            default:
                //do nothing
        }
    } else if (ev.data.type === "status_change") {
        JSPLib.utility.setCSSStyle("", 'safelist_user_css');
    }
    if (ev.data.type === 'toggle') {
        SL.is_shown = ev.data.is_shown;
        if (SL.is_shown) {
            $("#safelist").show();
            $("#sl-collapsible-list").addClass("ui-icon-triangle-1-s").removeClass("ui-icon-triangle-1-e");
        } else {
            $("#safelist").hide();
            $("#sl-collapsible-list").addClass("ui-icon-triangle-1-e").removeClass("ui-icon-triangle-1-s");
        }
    }
}

function RemoteSettingsCallback() {
    InitializeChangedSettings();
}

function RemoteResetCallback() {
    InitializeSide();
    RemoteSettingsCallback();
}

function InitializeChangedSettings() {
    if (IsLevelMenu()) {
        if (JSPLib.menu.hasSettingChanged('write_mode_enabled')) {
            if (SL.user_settings.write_mode_enabled) {
                $(".safelist-push").removeAttr('disabled').show();
            } else {
                $(".safelist-push").attr('disabled',true).hide();
            }
        }
    }
}

function RenderSettingsMenu() {
    $('#safelist-plus').append(JSPLib.menu.renderMenuFramework(MENU_CONFIG));
    $('#sl-general-settings').append(JSPLib.menu.renderDomainSelectors());
    $('#sl-mode-settings').append(JSPLib.menu.renderCheckbox('write_mode_enabled'));
    $('#sl-session-settings').append(JSPLib.menu.renderCheckbox('session_use_enabled'));
    $('#sl-session-settings').append(JSPLib.menu.renderCheckbox('session_level_enabled'));
    $('#sl-controls').append(JSPLib.menu.renderCacheControls());
    $('#sl-cache-controls').append(JSPLib.menu.renderLinkclick('cache_info'));
    $('#sl-cache-controls').append(JSPLib.menu.renderCacheInfoTable());
    $('#sl-controls').append(JSPLib.menu.renderCacheEditor());
    $('#sl-cache-editor-message').append(JSPLib.menu.renderExpandable("Program Data details", PROGRAM_DATA_DETAILS));
    $('#sl-cache-editor-controls').append(JSPLib.menu.renderLocalStorageSource());
    $('#sl-cache-editor-controls').append(JSPLib.menu.renderCheckbox('raw_data', true));
    $('#sl-cache-editor-controls').append(JSPLib.menu.renderTextinput('data_name', 20, true));
    JSPLib.menu.engageUI(true);
    JSPLib.menu.saveUserSettingsClick();
    JSPLib.menu.resetUserSettingsClick(LOCALSTORAGE_KEYS);
    JSPLib.menu.cacheInfoClick();
    JSPLib.menu.expandableClick();
    JSPLib.menu.rawDataChange();
    JSPLib.menu.getCacheClick(ValidateProgramData);
    JSPLib.menu.saveCacheClick(ValidateProgramData);
    JSPLib.menu.deleteCacheClick();
    JSPLib.menu.listCacheClick();
    JSPLib.menu.refreshCacheClick();
    JSPLib.menu.cacheAutocomplete();
}

////////////////////
//Main function

function Main() {
    this.debug('log',"Initialize start:", JSPLib.utility.getProgramTime());
    JSPLib.debug.debugTime("Main-Load");
    Object.assign(SL, {
        controller: document.body.dataset.controller,
        action: document.body.dataset.action,
        userid: Danbooru.CurrentUser.data('id'),
        settings_config: SETTINGS_CONFIG,
        control_config: CONTROL_CONFIG,
        channel: JSPLib.utility.createBroadcastChannel(PROGRAM_NAME, BroadcastSL),
        user_settings: JSPLib.menu.loadUserSettings(),
    }, DEFAULT_VALUES);
    if (JSPLib.danbooru.isSettingMenu()) {
        JSPLib.menu.initializeSettingsMenu(RenderSettingsMenu);
    }
    if (!JSPLib.menu.isScriptEnabled()) {
        this.debug('log',"Script is disabled on", window.location.hostname);
        return;
    }
    Object.assign(SL, {
        blacklist_box: $("#blacklist-box"),
        has_video: Boolean($(".image-container video").length),
        is_shown: JSPLib.storage.checkStorageData('sl-show-menu', ValidateProgramData, localStorage, true),
    });
    LoadLevelData();
    CorrectLevelData();
    LoadSessionData();
    JSPLib.debug.debugTimeEnd("Main-Load");
    if (HasBlacklist()) {
        JSPLib.debug.debugTime("Main-Post");
        JSPLib.utility.setCSSStyle(safelist_css, "safelist_css");
        SL.menu_items = CalculateRenderedMenus();
        SL.blacklist_box.after(RenderSidemenu());
        InitializeSide();
        SL.passive_handle = requestIdleCallback(CalculatePassiveLists);
        JSPLib.debug.debugTimeEnd("Main-Post");
    } else if (SL.enable_safelist) {
        InitializeNonpost();
    }
    //Render level menu only from post index page
    //Since it starts out hidden, we are doing it last
    if(IsLevelMenu()) {
        JSPLib.debug.debugTime("Main-Menu");
        $("#post-sections li:last-child").after(RenderSettingMenuLink());
        $("#excerpt").before(RenderLevelMenu());
        InitializeSettingsMenu();
        //Accounts for other userscripts binding the same links
        JSPLib.utility.initializeInterval(()=>{
            SetSafelistSettingsClick();
            SetOtherSectionsClick();
        },timeout_polling_interval);
        $(document).on('danbooru:post-preview-updated.temp', PostPreviewUpdated);
        JSPLib.debug.debugTimeEnd("Main-Menu");
    }
}

/****Function decoration****/

[
    Main,SetSideLevel,MenuSaveButton,CalculateActiveList,CalculatePassiveLists,ReloadSafelist,CorrectLevelData,BroadcastSL,
] = JSPLib.debug.addFunctionLogs([
    Main,SetSideLevel,MenuSaveButton,CalculateActiveList,CalculatePassiveLists,ReloadSafelist,CorrectLevelData,BroadcastSL,
]);

[
    SetSideLevel,EnableSafelist,DisableSafelist,ShowHidePosts,InitializeSide,InitializeSettingsMenu,ReloadSafelist,
    RenderLevelMenu,MenuSaveButton,MenuAddButton,
] = JSPLib.debug.addFunctionTimers([
    //Sync
    SetSideLevel,EnableSafelist,DisableSafelist,ShowHidePosts,InitializeSide,InitializeSettingsMenu,ReloadSafelist,
    RenderLevelMenu,MenuSaveButton,MenuAddButton,
    //Async
    ////NONE
]);

/****Initialization****/

//Variables for debug.js
JSPLib.debug.debug_console = false;
JSPLib.debug.level = JSPLib.debug.INFO;
JSPLib.debug.program_shortcut = PROGRAM_SHORTCUT;

//Variables for menu.js
JSPLib.menu.program_shortcut = PROGRAM_SHORTCUT;
JSPLib.menu.program_name = PROGRAM_NAME;
JSPLib.menu.program_data = SL;
JSPLib.menu.program_reset_data = PROGRAM_RESET_KEYS;
JSPLib.menu.settings_callback = RemoteSettingsCallback;
JSPLib.menu.reset_callback = RemoteResetCallback;
JSPLib.menu.settings_config = SETTINGS_CONFIG;
JSPLib.menu.control_config = CONTROL_CONFIG;

//Export JSPLib
JSPLib.load.exportData(PROGRAM_NAME, SL);

/****Execution start****/

JSPLib.load.programInitialize(Main,'SL',program_load_required_variables,program_load_required_selectors);
