// ==UserScript==
// @name         SafelistPlus
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      4.26
// @description  Alternate Danbooru blacklist handler.
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        https://*.donmai.us/*
// @exclude      /^https://\w+\.donmai\.us/.*\.(xml|json|atom)(\?|$)/
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/SafelistPlus.user.js
// @updateURL    https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/SafelistPlus.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.13.1/validate.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/ece7ee0fb90dfa2c90874bd6eea467b5295d15dd/lib/module.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/ece7ee0fb90dfa2c90874bd6eea467b5295d15dd/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/ece7ee0fb90dfa2c90874bd6eea467b5295d15dd/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/ece7ee0fb90dfa2c90874bd6eea467b5295d15dd/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/ece7ee0fb90dfa2c90874bd6eea467b5295d15dd/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/ece7ee0fb90dfa2c90874bd6eea467b5295d15dd/lib/template.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/ece7ee0fb90dfa2c90874bd6eea467b5295d15dd/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/ece7ee0fb90dfa2c90874bd6eea467b5295d15dd/lib/menu.js
// ==/UserScript==

/* global JSPLib $ */

/****Module import****/

(({DanbooruProxy, ValidateJS, Debug, Notice, Utility, Storage, Template, Validate, Load, Menu}) => {

const PROGRAM_NAME = 'SafelistPlus';
const PROGRAM_SHORTCUT = 'sl';

/****Library updates****/

////NONE

/****Global variables****/

//Exterior script variables
const DANBOORU_TOPIC_ID = '14221';

//Variables for Load.js
const program_load_required_variables = ['window.jQuery', 'window.Danbooru', 'Danbooru.CurrentUser'];
const program_load_required_selectors = ["#page"];

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
        reset: false,
        validate: Utility.isBoolean,
        hint: "Enable writes to your Danbooru blacklist with the <b><u>Push</u></b> button."
    },
    validate_mode_enabled: {
        reset: false,
        validate: Utility.isBoolean,
        hint: "Currently disabled."
    },
    order_mode_enabled: {
        reset: false,
        validate: Utility.isBoolean,
        hint: "Currently disabled."
    },
    session_use_enabled: {
        reset: false,
        validate: Utility.isBoolean,
        hint: "Have a different state of enabled on every page tab."
    },
    session_level_enabled: {
        reset: false,
        validate: Utility.isBoolean,
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
        name: 'display',
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

const PROGRAM_CSS = Template.normalizeCSS()`
/**GENERAL**/
.sl-link {
    cursor: pointer;
}
a.safelist-help.sl-link {
    color: hotpink;
    &:hover {
        filter: brightness(1.5);
    }
}
/**CONTROLS**/
#safelist-box.sidebar-safelist {
    margin-bottom: 0.5em;
    h1 {
        margin-left: -4px;
        font-size: 1.16667em;
    }
    ul {
        margin-bottom: 0.5em;
        margin-left: 2em;
        li {
            list-style-type: disc;
        }
        .safelist-pending:after {
            content: "(Loading)";
            padding-left: 4px;
        }
    }
}

#safelist-box.inline-safelist {
    margin-bottom: 1.5em;
    h1 {
        font-size: 1em;
        display: inline;
        &:after {
            content: ":";
        }
    }
    ul {
        display: inline;
        li {
            display: inline;
            position: relative;
            &.safelist-pending:before {
                content: "(Loading)";
                top: 18px;
                left: 2px;
                position: absolute;
            }
            &:after {
                content: "|";
                font-weight: normal;
            }
        }
    }
}
#sl-collapsible-list {
    margin-right: -4px;
    &.ui-icon {
        display: inline-block;
        height: 16px;
        width: 16px;
    }
    &.ui-icon-triangle-1-e {
        background-position: -32px -14px;
    }
    &.ui-icon-triangle-1-s {
        background-position: -64px -14px;
    }
}
.safelist-active,
.safelist-pending {
    font-style: italic;
}
.safelist-allnone {
    font-weight: bold;
}
#enable-safelist {
    color: mediumseagreen;
}
#disable-safelist {
    color: red;
}
/**LEVEL MENU**/
#safelist-settings {
    display: block;
    & > div {
        margin-bottom: 1em;
    }
    input.btn {
        margin-right: 1em;
        margin-top: 1em;
        min-width: 4em;
    }
    textarea {
        width: 90%;
        height: 10em;
    }
}
.safelist-namerow {
    height: 2em;
    h2 {
        display: inline-block;
        margin-right: 0.5em;
    }
}
.safelist-name {
    margin: 0.5em;
    padding-left: 0.5em;
    line-height:150%;
}
.safelist-edit {
    margin-right: 0;
    margin-top: 0;
    margin-bottom: 0.5em;
}
.safelist-input {
    border: 2px solid grey;
    padding: 0.8em;
    border-radius: 10px;
    display: grid;
    grid-template-columns: 50% 50%;
    label {
        display: block;
        font-weight: bold;
        line-height: 1.5em;
        font-size: 100%;
    }
    span {
        display: block;
        max-width: 90%;
    }
}
.safelist-textblock {
    li {
        list-style-type: disc;
    }
    ul {
        margin-left: 1.5em;
    }
    div {
        padding: 0 0.5em;
        border: 2px solid lightgrey;
        width: 90%;
        height: 10em;
        font-size: 0.8em;
        overflow: auto;
    }
}
.safelist-checkbox input {
    margin-top: 1em;
}
.safelist-textblock,
.safelist-checkbox,
.safelist-textinput,
.safelist-namerow  {
    float: left;
    margin-top: 0.5em;
    position: relative;
}
.safelist-selection,
.safelist-halfcheckbox {
    width: 50%;
    float: left;
    margin-top: 0.5em;
    position: relative;
}`;

const CSS_ENABLED = `
#page #blacklist-box,
#enable-safelist {
    display: none !important;
}`;

const CSS_DISABLED = `
#safelist,
#disable-safelist {
    display: none !important;
}
#blacklist-box.inline-blacklist {
    margin-bottom: 4px;
}`;

//HTML constants

const PROGRAM_DATA_DETAILS = Template.normalizeHTML()`
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

const SIDEMENU_TEMPLATE = Template.normalizeHTML({template: true})`
<section id="safelist-box" class="${'classname'}">
    <h1>
        <a id="sl-collapsible-list" class="sl-link ui-icon ui-icon-triangle-1-${'direction'}"></a>&nbsp;${{PROGRAM_NAME}}
    </h1>
    <ul id="safelist">
        ${'all_side'}
        ${'variable_sides'}
        ${'none_side'}
    </ul>
    <a id="enable-safelist" class="sl-link">Enable</a>
    <a id="disable-safelist" class="sl-link">Disable</a>
</section>`;

const SIDE_TEMPLATE = Template.normalizeHTML({template: true})`
<li class="${'classname'}" data-level="${'level'}">
    <a class="sl-link">${'name'}</a>
</li>`;

const LEVEL_MENU_TEMPLATE = Template.normalizeHTML({template: true})`
<fieldset id="safelist-settings">
    ${'all_menu'}
    ${'none_menu'}
    ${'variable_menus'}
    <hr>
    <div id="safelist-controls">
        <input type="submit" id="safelist-commit" value="Submit" class="btn">
        <input type="submit" id="safelist-add" value="Add" class="btn">
        <input type="submit" id="safelist-resetall" value="Reset All" class="btn">
    </div>
</fieldset>`;

const LEVEL_SETTING_TEMPLATE = Template.normalizeHTML({template: true})`
<div class="safelist-input" data-level="${'level'}">
    ${'namerow'}
    <span style="display:inline-block">
        ${'keyselect'}
        ${'background'}
    </span>
    ${'mainblock'}
    ${'cssblock'}
    ${'buttons'}
</div>`;

const NAMEROW_TEMPLATE = Template.normalizeHTML({template: true})`
<div class="safelist-namerow">
    <h2>${'name'}</h2>
    <input type="text" value="${'name'}" size="40" autocomplete="off" class="safelist-name" style="display: none;">
    ${'button'}
</div>`;

const KEYSELECT_TEMPLATE = Template.normalizeHTML({template: true})`
<div class="safelist-selection">
    <label for="safelist_modifier_level_${'level'}">Hotkey (${'help'})</label>
    <select id="safelist_modifier_level_${'level'}" class="safelist-modifier">
        ${'select1'}
    </select>
    <select id="safelist_keyselect_level_${'level'}" class="safelist-keyselect">
        ${'select2'}
    </select>
</div>`;

const BACKGROUND_OPTION_TEMPLATE = Template.normalizeHTML({template: true})`
<div class="safelist-halfcheckbox">
    <label for="safelist_background_level_${'level'}">Background Process (${'help'})</label>
    <input type="checkbox" ${'checked'} id="safelist_process_level_${'level'}" class="safelist-background">
</div>`;

const ENABLE_CHECKBOX_TEMPLATE = Template.normalizeHTML({template: true})`
<div class="safelist-checkbox">
    <label for="safelist_enable_level_${'level'}">${'label'} list enabled (${'help'})</label>
    <input type="checkbox" ${'checked'} id="safelist_enable_level_${'level'}" class="safelist-enable">
</div>`;

const TAG_BLOCK_TEMPLATE = Template.normalizeHTML({template: true})`
<div class="safelist-textblock">
    <label for="safelist_tags_level_${'level'}">Blacklisted tags (${'help'})</label>
    <textarea id="safelist_tags_level_${'level'}" cols="40" rows="5" autocomplete="off" class="safelist-tags">${'tagstring'}</textarea>
</div>`;

const CSS_BLOCK_TEMPLATE = Template.normalizeHTML({template: true})`
<div class="safelist-textblock">
    <label for="safelist_css_level_${'level'}">Custom CSS (${'help'})</label>
    <textarea id="safelist_css_level_${'level'}" cols="40" rows="5" autocomplete="off" class="safelist-css">${'css'}</textarea>
</div>`;

const LEVEL_BUTTONS_TEMPLATE = Template.normalizeHTML({template: true})`
<div class="safelist-setting-buttons">
    ${'buttons'}
</div>`;

//Message constants

const KEYSELECT_HELP = `Changes list when ${PROGRAM_NAME} is active.\nKeep in mind existing Danbooru hotkeys.`;
const BACKGROUND_HELP = "Process this list in the background so that changing lists is more responsive.";
const TAGBLOCK_HELP = "Put any tag combinations you never want to see here.\nEach combination should go on a separate line.";
const CSSBLOCK_HELP = "Style to apply to the whole site.";

const BUTTON_HINTS = {
    pull: "Populate tag box with your Danbooru blacklist.",
    push: "Save tag box to your Danbooru blacklist.",
};

//Other constants

const TIMEOUT_POLLING_INTERVAL = 1000;

//Class constants

const SAFELIST_DEFAULTS = {
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

const SAFELIST_KEYS = Object.keys(SAFELIST_DEFAULTS).filter((key) => !key.match(/^_/));

const LEVEL_BUTTONS = ['pull', 'push', 'delete'];
const MODIFIER_KEYS = ['', 'alt', 'shift', 'ctrl'];
const KEYSELECT_KEYS = [''].concat('abcdefghijklmnopqrstuvwxyz1234567890'.split(''));

const _PRIVATE_DATA = new WeakMap();

//Classes

class Safelist {
    constructor(level) {
        SAFELIST_DEFAULTS.level = level;
        SAFELIST_KEYS.forEach((key)=>{this[key] = SAFELIST_DEFAULTS[key];});
        _PRIVATE_DATA.set(this, {});
        this.setupPrivateData('menu');
        this.setupPrivateData('side');
    }

    correctData(level) {
        let error_messages = [];
        SAFELIST_DEFAULTS.level = level;
        let check = ValidateJS(this,level_constraints);
        if (check !== undefined) {
            error_messages.push([`level_data[${level}]:`, JSON.stringify(check, null, 2)]);
            for (let key in check) {
                this[key] = SAFELIST_DEFAULTS[key];
            }
        }
        check = ValidateJS(this.hotkey,hotkey_constraints);
        if (check !== undefined) {
            error_messages.push([`level_data[${level}].hotkey:`, JSON.stringify(check, null, 2)]);
            for (let key in check) {
                this.hotkey[key] = SAFELIST_DEFAULTS.hotkey[key];
            }
        }
        let nonstring_list = this.list.filter((entry) => !Utility.isString(entry));
        if (nonstring_list.length > 0) {
            error_messages.push([`level_data[${level}].list: bad values found - `, nonstring_list]);
            if (nonstring_list.length === this.list.length) {
                this.list = SAFELIST_DEFAULTS.list;
            } else {
                this.list = Utility.arrayDifference(this.list, nonstring_list);
            }
        }
        let extra_keys = Utility.arrayDifference(Object.keys(this), Object.keys(SAFELIST_DEFAULTS));
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
        this.list = Utility.filterEmpty(str.split('\n').map($.trim));
        this.list = (this.list.length === 0 ? [''] : this.list);
    }
    /***Need to see how this works***/
    get escaped_name() {
        return Utility.HTMLEscape(this.name);
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
                let data = _PRIVATE_DATA.get(this);
                data[name] = x;
                _PRIVATE_DATA.set(this, data);
            },
            get: () => _PRIVATE_DATA.get(this)[name],
        });
    }

    /////////////////////////
    //Render HTML functions

    //Links in the side menu
    get renderedSide() {
        if (!this.enabled) return "";
        return SIDE_TEMPLATE({
            level: this.level,
            name: this.escaped_name,
            classname: (this.isVariable ? "" : 'safelist-allnone'),
        });
    }
    //Sections in the setting menu
    get renderedLevelSetting() {
        return LEVEL_SETTING_TEMPLATE({
            level: this.level,
            namerow: this.renderedNamerow,
            keyselect: this.renderedKeyselect,
            background: this.renderedBackgroundOption,
            mainblock: (this.isVariable ? this.renderedTagBlock : this.renderedEnableCheckbox),
            cssblock: this.renderedCSSBlock,
            buttons: this.renderedLevelButtons,
        });
    }
    //List name, edit button and textbox
    get renderedNamerow() {
        return NAMEROW_TEMPLATE({
            name: this.escaped_name,
            button: RenderButton('edit'),
        });
    }
    //Hotkey dropdowns
    get renderedKeyselect() {
        let select1_items = MODIFIER_KEYS.map((key)=>{
            return Utility.renderHTMLTag('option', Utility.titleizeString(key), {
                value: key,
                selected: (this.hotkey[0] === key ? null : undefined),
            });
        });
        let select2_items = KEYSELECT_KEYS.map((key)=>{
            return Utility.renderHTMLTag('option', key.toUpperCase(), {
                value: key,
                selected: (this.hotkey[1] === key ? null : undefined),
            });
        });
        return KEYSELECT_TEMPLATE({
            level: this.level,
            select1: select1_items.join(""),
            select2: select2_items.join(""),
            help: RenderHelp(KEYSELECT_HELP),
        });
    }
    //Background process options
    get renderedBackgroundOption() {
        if (!this.isVariable) return "";
        const value = (this.background ? "checked" : "");
        return BACKGROUND_OPTION_TEMPLATE({
            level: this.level,
            checked: (this.background ? "checked" : ""),
            help: RenderHelp(BACKGROUND_HELP),
        });
    }
    //For constant levels all and none... takes place of taglist
    get renderedEnableCheckbox() {
        return ENABLE_CHECKBOX_TEMPLATE({
            level: this.level,
            label: (this.level === 'a' ? "All" : "None"),
            checked: (this.enabled ? "checked" : ""),
            help: RenderHelp(this.level === 'a' ? "Shows everything." : "Shows nothing."),
        });
    }
    //For custom levels
    get renderedTagBlock() {
        return TAG_BLOCK_TEMPLATE({
            level: this.level,
            tagstring: this.tagstring.replaceAll('\n', '&#13;').replaceAll(' ', '&#32;'),
            help: RenderHelp(TAGBLOCK_HELP),
        });
    }
    //Custom style per level
    get renderedCSSBlock() {
        return CSS_BLOCK_TEMPLATE({
            level: this.level,
            css: this.css.replaceAll('\n', '&#13;').replaceAll(' ', '&#32;'),
            help: RenderHelp(CSSBLOCK_HELP),
        });
    }

    //Renders all level buttons
    get renderedLevelButtons() {
        if (!this.isVariable) return "";
        let button_items = LEVEL_BUTTONS.map((type) => RenderButton(type, BUTTON_HINTS[type]));
        return LEVEL_BUTTONS_TEMPLATE({
            buttons: button_items.join(""),
        });
    }

    ////////////////////
    //Event functions

    //Document level

    //Activate hotkey for level if it exists
    setKeypress() {
        const printer = Debug.getFunctionPrint('setKeypress');
        let namespace = "keydown.sl-level_" + this.level;
        $(document).off(namespace);
        if (!this.enabled || !this.hasActiveHotkey) {
            return;
        }
        let context = this;
        let combokey = (this.hotkey[0] === '' ? this.hotkey[1] : this.hotkey.join('+'));
        printer.log('setKeypress',`Level ${this.level} hotkey: ${combokey}`);
        $(document).on(namespace, null, combokey,(event)=>{
            if (SL.enable_safelist) {
                event.preventDefault();
                if (HasBlacklist()) {
                    $("a", context.side).click();
                } else {
                    Utility.setCSSStyle(context.renderedCSS, 'safelist_user_css');
                    SaveLevel(context.level);
                }
            }
        });
    }

    //Side menu

    setSideClick() {
        let context = this;
        $("a", this.side).off(JSPLib.event.click).on(JSPLib.event.click,(event)=>{
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
        $(".safelist-edit", context.menu).off(JSPLib.event.click).on(JSPLib.event.click,()=>{
            $("h2", context.menu).hide();
            $(".safelist-edit", context.menu).hide();
            $(".safelist-name", context.menu).show();
        });
    }
    setPullButtonClick() {
        let context = this;
        $(".safelist-pull", context.menu).off(JSPLib.event.click).on(JSPLib.event.click,()=>{
            $(".safelist-tags", context.menu).val(
                Utility.getMeta("blacklisted-tags")
                ?.replace(/(rating:[qes])\w+/ig, "$1")
                .toLowerCase().split(/,/).join('\n')
                || ""
            );
        });
    }
    setPushButtonClick() {
        const printer = Debug.getFunctionPrint('setPushButtonClick');
        let context = this;
        $(".safelist-push", context.menu).off(JSPLib.event.click).on(JSPLib.event.click,()=>{
            if (confirm("Update your blacklist on Danbooru?")) {
                let tagdata = $(".safelist-tags", context.menu).val().replace(/\n/g, '\r\n');
                let senddata = {'user': {'blacklisted_tags': tagdata}};
                let url = Utility.sprintf(`/users/%s.json`, SL.user_id);
                $.ajax({
                  type: "PUT",
                  url,
                  data: senddata,
                  success: function(data) {
                    printer.log('setPushButtonClick',"Success", data);
                    Notice.notice("Settings updated.");
                  },
                  error: function(data) {
                    printer.log('setPushButtonClick',"Failure", data);
                    Notice.notice("Error updating settings!");
                  }
                });
            }
        });
    }
    setDeleteButtonClick() {
        let context = this;
        $('.safelist-delete', context.menu).off(JSPLib.event.click).on(JSPLib.event.click,()=>{
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
        SL.validate_mode_enabled && $(".safelist-validate", this.menu).removeAttr('disabled');
        SL.order_mode_enabled && $(".safelist-order", this.menu).removeAttr('disabled');
    }
}

//Validate constants

const level_constraints = {
    level: Validate.string_constraints(true, {minimum: 1}),
    name: Validate.string_constraints(true, {minimum: 1}),
    css: Validate.stringonly_constraints,
    enabled: Validate.boolean_constraints,
    background: Validate.boolean_constraints,
    list: Validate.array_constraints({minimum: 1}),
    hotkey: Validate.array_constraints({is: 2}),
};

const hotkey_constraints = [
    Validate.inclusion_constraints(MODIFIER_KEYS),
    Validate.inclusion_constraints(KEYSELECT_KEYS)
];

/****Functions****/

//Validate functions

function ValidateProgramData(key,entry) {
    var checkerror = [];
    switch (key) {
        case 'sl-user-settings':
            checkerror = Menu.validateUserSettings(entry, SETTINGS_CONFIG);
            break;
        case 'sl-level-data':
            checkerror = ValidateLevelData();
            break;
        case 'sl-script-enabled':
        case 'sl-show-menu':
            if (!Utility.isBoolean(entry)) {
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
        Validate.outputValidateError(key,checkerror);
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
                error_messages = Utility.concat(error_messages, level_error);
            }
        }
    }
    return error_messages;
}

function CorrectLevelData() {
    const printer = Debug.getFunctionPrint('CorrectLevelData');
    let error_messages = ValidateLevelData();
    if (error_messages.length) {
        printer.log("Corrections to level data detected!");
        error_messages.forEach((error)=>{printer.log(...error);});
        SaveLevelData();
        SL.channel.postMessage({type: "correction", level_data: SL.level_data});
    } else {
        printer.log("Level data is valid.");
    }
}

//Helper functions

function HasBlacklist() {
    return Boolean(SL.blacklist_box.length);
}

function GetEnabledStorage() {
    return (SL.session_use_enabled ? sessionStorage : localStorage);
}

function GetActiveStorage() {
    return (SL.session_level_enabled ? sessionStorage : localStorage);
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

function SplitWords(string) {
    return string?.match(/\S+/g) || [];
}

//Auxiliary functions

function GetPostTags(post) {
    let $post = $(post);
    let tags = $post.data('safelist-tags');
    if (!tags) {
        tags = new Set([
            ...SplitWords($post.attr("data-tags")),
            ...SplitWords($post.attr("data-flags")).map(s => `status:${s}`),
            `rating:${$post.attr("data-rating")}`,
            `uploaderid:${$post.attr("data-uploader-id")}`,
        ]);
        $post.data('safelist-tags', tags);
    }
    return tags;
}

function PostExclude(post, entry) {
    if (entry.disabled) return false;
    let tags = GetPostTags(post);
    return entry.passthrough.intersection(tags).size > 0;
}

function PostMatch(post, entry) {
    if (entry.disabled || entry.passthrough.size > 0) return false;
    var $post = $(post);
    var score = parseInt($post.attr("data-score"));
    var score_test = entry.min_score === null || score < entry.min_score;
    var tags = GetPostTags(post);
    return (entry.require.isSubsetOf(tags) && score_test)
    && (entry.optional.size === 0 || !entry.optional.isDisjointFrom(tags))
    && entry.exclude.isDisjointFrom(tags);
}

function ParseEntry(string) {
    var entry = {
        tags: string,
        require: new Set(),
        exclude: new Set(),
        optional: new Set(),
        passthrough: new Set(),
        disabled: false,
        hits: 0,
        min_score: null,
    };
    let tags = SplitWords(string);
    tags.forEach(function(tag) {
        if (tag.charAt(0) === '-') {
            entry.exclude.add(tag.slice(1));
        } else if (tag.charAt(0) === '~') {
            entry.optional.add(tag.slice(1));
        } else if (tag.charAt(0) === '+') {
            entry.passthrough.add(tag.slice(1));
        } else if (tag.match(/^score:<.+/)) {
            var score = tag.match(/^score:<(.+)/)[1];
            entry.min_score = parseInt(score);
        } else {
            entry.require.add(tag);
        }
    });
    return entry;
}

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
                var entry = ParseEntry(val.list[i]);
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

//Render functions

function RenderHelp(help_text) {
    return Utility.renderHTMLTag('a', '&nbsp;?&nbsp;', {class: 'safelist-help sl-link', title: help_text});
}

function RenderButton(type, hint) {
    return Utility.renderHTMLTag('input', null, {
        type: 'submit',
        value: Utility.titleizeString(type),
        title: hint,
        class: `btn safelist-${type}`,
    });
}

function RenderSidemenu() {
    return SIDEMENU_TEMPLATE({
        classname: (SL.blacklist_box.hasClass("sidebar-blacklist") ? "sidebar-safelist" : "inline-safelist"),
        all_side: SL.level_data.a.renderedSide,
        none_side: SL.level_data.n.renderedSide,
        variable_sides: SL.menu_items.variable_menus.map((level) => SL.level_data[level].renderedSide).join(""),
        direction: (SL.is_shown ? "s" : "e"),
    });
}

function RenderSettingMenuLink() {
    return Utility.renderHTMLTag('a', PROGRAM_NAME, {id: 'display-safelist-settings', class: 'sl-link'});
}

function RenderLevelMenu() {
    return LEVEL_MENU_TEMPLATE({
        all_menu: SL.level_data.a.renderedLevelSetting,
        none_menu: SL.level_data.n.renderedLevelSetting,
        variable_menus: SL.menu_items.variable_menus.map((level) => SL.level_data[level].renderedLevelSetting).join(""),
    });
}


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
    $("#enable-safelist").off(JSPLib.event.click).on(JSPLib.event.click, EnableSafelist);
    $("#disable-safelist").off(JSPLib.event.click).on(JSPLib.event.click, DisableSafelist);
    $("#sl-collapsible-list").off(JSPLib.event.click).on(JSPLib.event.click, ToggleSafelist);
}

function InitializeSettingsMenu() {
    if ($(".active #display-safelist-settings").length === 0) {
        $("#safelist-settings").hide();
    }
    InitializeSettingsDOMs();
    InitializeSettingEvents();
    !SL.write_mode_enabled && $(".safelist-push").attr('disabled', true).hide();
    !SL.validate_mode_enabled && $(".safelist-validate").attr('disabled', true);
    !SL.order_mode_enabled && $(".safelist-order").attr('disabled', true);
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
    $(".safelist-help").off(JSPLib.event.click).on(JSPLib.event.click, HelpInfo);
    $("#safelist-commit").off(JSPLib.event.click).on(JSPLib.event.click, MenuSaveButton);
    $("#safelist-add").off(JSPLib.event.click).on(JSPLib.event.click, MenuAddButton);
    $("#safelist-resetall").off(JSPLib.event.click).on(JSPLib.event.click, MenuResetAllButton);
}

function InitializeActiveCSS() {
    let value = SL.level_data[SL.active_list];
    value && Utility.setCSSStyle(value.renderedCSS, 'safelist_user_css');
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

//Storage functions

function LoadLevelData() {
    SL.level_data = Storage.getLocalData('sl-level-data');
    if (!SL.level_data) {
        InitializeProgramData();
    } else {
        InitializeSafelistData();
    }
}

function SaveLevelData() {
    Storage.setLocalData('sl-level-data', SL.level_data);
}

function LoadSessionData() {
    SL.enable_safelist = Storage.checkStorageData('sl-script-enabled', GetEnabledStorage());
    if (!SL.enable_safelist && SL.session_use_enabled) {
        SL.enable_safelist = Storage.checkLocalData('sl-script-enabled', {default_val: true});
    }
    SL.active_list = Storage.checkStorageData('sl-active-list', GetEnabledStorage());
    if (!SL.active_list && SL.session_level_enabled) {
        SL.active_list = Storage.checkLocalData('sl-active-list');
    }
}

function SaveSessionData() {
    Storage.setStorageData('sl-script-enabled', SL.enable_safelist, GetEnabledStorage());
    Storage.setStorageData('sl-active-list', SL.active_list, GetActiveStorage());
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
    } else if (SL.controller === "comments" || (post.parentElement && Utility.DOMtoArray(post.parentElement.classList).includes('list-of-comments'))) {
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

//Calculate list functions

//Asynchronous function that calculates inactive lists in the background
function CalculatePassiveLists(deadline) {
    const printer = Debug.getFunctionPrint('CalculatePassiveLists');
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
            let update_list = Utility.arrayDifference(SL.menu_items.process_menus, Object.keys(SL.post_lists))[0];
            //Main exit condition
            if (update_list === undefined) {
                printer.log("Done!");
                return;
            }
            if (SL.passive_lists_processed === 0) {
                printer.log("Passive list start:", Utility.getProgramTime());
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
                if (PostExclude(SL.$safelist_posts[i], SL.custom_entries[index][j])) {
                    //Bail when the post is passthrough
                    break;
                }
                if (PostMatch(SL.$safelist_posts[i], SL.custom_entries[index][j])) {
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
        printer.log(`Complete[${index}]:`, performance.now() - SL.passive_background_work.start_time);
        SL.passive_background_work = {};
    }
}

//Like CalculatePassiveLists, but for the active list, plus it has higher priority
function CalculateActiveList() {
    const printer = Debug.getFunctionPrint('CalculateActiveList');
    SL.$safelist_posts = SL.$safelist_posts || SafelistPosts();
    if (('level' in SL.active_background_work) && (SL.active_list !== SL.active_background_work.level)) {
        printer.log("Changing list...");
        SL.active_background_work = {};
    }
    if ((SL.active_list in SL.post_lists) || (!SL.enable_safelist)) {
        printer.log("Bailing on work...");
        SL.active_background_work = {};
        SetActiveList(SL.active_list,'active');
        return;
    }
    if (!('level' in SL.active_background_work)) {
        printer.log("Active list start:", Utility.getProgramTime());
        SL.active_background_work.level = SL.active_list;
        SL.active_background_work.start_id = 0;
        SL.active_background_work.update_array = [];
        SL.active_background_work.start_time = performance.now();
    }
    let level = SL.active_background_work.level;
    let iteration_time = performance.now();
    for (let i = SL.active_background_work.start_id; i < SL.$safelist_posts.length; i++) {
        for (let j = 0; j < SL.custom_entries[level].length; j++){
            if (PostExclude(SL.$safelist_posts[i], SL.custom_entries[level][j])) {
                //Bail when the post is passthrough
                break;
            }
            if (PostMatch(SL.$safelist_posts[i], SL.custom_entries[level][j])) {
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
    printer.log("Complete:",performance.now() - SL.active_background_work.start_time);
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

// Event functions

function HelpInfo(event) {
    let help_text = $(event.target).attr('title');
    alert(help_text);
    event.preventDefault();
}

function EnableSafelist(event) {
    Utility.setCSSStyle(CSS_ENABLED, "blacklist_css");
    if (SL.menu_items.rendered_menus.includes(SL.active_list)){
        let value = SL.level_data[SL.active_list];
        value && $("a", value.side).click();
    }
    SaveStatus(true);
    event.preventDefault();
}

function DisableSafelist(event) {
    Utility.setCSSStyle(CSS_DISABLED, "blacklist_css");
    Utility.setCSSStyle("", 'safelist_user_css');
    RemovePostStyles();
    SaveStatus(false);
    event.preventDefault();
}

function ToggleSafelist(event) {
    $(event.target).toggleClass("ui-icon-triangle-1-e ui-icon-triangle-1-s");
    $('#safelist').slideToggle(100);
    SL.is_shown = !SL.is_shown;
    Storage.setLocalData('sl-show-menu', SL.is_shown);
    SL.channel.postMessage({type: "toggle", is_shown: SL.is_shown});
}

function SetSafelistSettingsClick() {
    if (!Utility.isNamespaceBound({root: "#display-safelist-settings", eventtype: 'click', namespace: PROGRAM_SHORTCUT})) {
        $("#display-safelist-settings").on(JSPLib.event.click,(event)=>{
            $("#post-sections li a").removeClass('active');
            $("#display-safelist-settings").addClass('active');
            $("#content > *:not(#post-sections)").hide();
            $("#safelist-settings").show();
            event.preventDefault();
        });
    }
}

//These actions get executed along with any other existing click events
function SetOtherSectionsClick() {
    if (!Utility.isNamespaceBound({root: "#show-posts-link,#show-excerpt-link", eventtype: 'click', namespace: PROGRAM_SHORTCUT})) {
        $("#show-posts-link,#show-excerpt-link").on(JSPLib.event.click, ()=>{
            $("#display-safelist-settings").removeClass('active');
            $('#safelist-settings').hide();
        });
    }
}

function MenuAddButton() {
    let index = GetNextLevel().toString();
    let addlist = SL.level_data[index] = new Safelist(index);
    addlist.menu = $(addlist.renderedLevelSetting).insertBefore("#safelist-settings > hr");
    !SL.write_mode_enabled && $(".safelist-push", addlist.menu).attr('disabled', true).hide();
    !SL.validate_mode_enabled && $(".safelist-validate", addlist.menu).attr('disabled', true);
    !SL.order_mode_enabled && $(".safelist-order", addlist.menu).attr('disabled', true);
    addlist.initializeLevelMenuEvents();
}

function MenuResetAllButton() {
    if (confirm("Reset all Safelist settings?")) {
        InitializeProgramData();
        ResetAllSettings();
        SL.channel.postMessage({type: "reset_levels", level_data: SL.level_data, enable_safelist: SL.enable_safelist, active_list: SL.active_list});
    }
}

function MenuSaveButton() {
    const printer = Debug.getFunctionPrint('MenuSaveButton');
    //Save presettings change for comparison later
    var preconfig = Utility.dataCopy(SL.level_data);
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
    Notice.notice("Settings saved.");
    let changed_settings = Utility.recurseCompareObjects(preconfig, SL.level_data);
    SL.menu_items = CalculateRenderedMenus();
    let changed_menus = Boolean(Utility.arraySymmetricDifference(premenu.rendered_menus, SL.menu_items.rendered_menus).length);
    printer.log(changed_settings, changed_menus);
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
            if (PostExclude($post, SL.custom_entries[level][j])) {
                //Bail when the post is passthrough
                break;
            }
            if (PostMatch($post, SL.custom_entries[level][j])) {
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

//Main execution functions

function SetSideLevel(context) {
    const printer = Debug.getFunctionPrint('SetSideLevel');
    if (SL.post_lists[context.level] === undefined){
        printer.log("List not ready!");
        //If no lists are being actively calculated...?
        if ($.isEmptyObject(SL.active_background_work)) {
            //Don't start calculating the list in the click event
            SL.active_timer = setTimeout(CalculateActiveList, 1);
        }
        SetActiveList(context.level,'pending');
        //Else CalculateActiveList will automatically switch over
    } else {
        printer.log("Precalculated list change");
        ShowHidePosts(SL.post_lists[context.level]);
        SetActiveList(context.level, 'active');
    }
    Utility.setCSSStyle(context.renderedCSS, 'safelist_user_css');
    SaveLevel(context.level);
}

function ReloadSafelist(changed_settings,changed_menus) {
    const printer = Debug.getFunctionPrint('ReloadSafelist');
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
            printer.log("Updating custom entries...");
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
                        Utility.setCSSStyle(value.renderedCSS, 'safelist_user_css');
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

//Settings functions

function BroadcastSL(ev) {
    const printer = Debug.getFunctionPrint('BroadcastSL');
    printer.log(`(${ev.data.type}):`, ev.data);
    if (((ev.data.type === "level_change") && SL.session_level_enabled) &&
        ((ev.data.type === "status_change") && SL.session_use_enabled)) {
        return;
    }
    if ('level_data' in ev.data) {
        SL.old_level_data = SL.level_data;
        SL.level_data = ev.data.level_data;
        let removed_menus = Utility.arrayDifference(Object.keys(SL.old_level_data), Object.keys(SL.level_data));
        removed_menus.forEach((level)=>{
            SL.old_level_data[level].disableLevel();
            delete SL.post_lists[level];
        });
        InitializeSafelistData();
        InitializeSideDOMs();
        InitializeSettingsDOMs();
        SL.menu_items = CalculateRenderedMenus();
    }
    if (('active_list' in ev.data) && !SL.session_level_enabled) {
        SL.active_list = ev.data.active_list;
    }
    if (('enable_safelist' in ev.data) && !SL.session_use_enabled) {
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
        Utility.setCSSStyle("", 'safelist_user_css');
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
        if (Menu.hasSettingChanged('write_mode_enabled')) {
            if (SL.write_mode_enabled) {
                $(".safelist-push").removeAttr('disabled').show();
            } else {
                $(".safelist-push").attr('disabled',true).hide();
            }
        }
    }
}

function InitializeProgramValues() {
    Object.assign(SL, {
        blacklist_box: $("#blacklist-box"),
        has_video: Boolean($(".image-container video").length),
        is_shown: Storage.checkLocalData('sl-show-menu', ValidateProgramData, {default_val: true}),
        user_id: DanbooruProxy.CurrentUser.data('id'),
    });
    return true;
}

function RenderSettingsMenu() {
    $('#safelist-plus').append(Menu.renderMenuFramework(MENU_CONFIG));
    $('#sl-general-settings').append(Menu.renderDomainSelectors());
    $('#sl-mode-settings').append(Menu.renderCheckbox('write_mode_enabled'));
    $('#sl-session-settings').append(Menu.renderCheckbox('session_use_enabled'));
    $('#sl-session-settings').append(Menu.renderCheckbox('session_level_enabled'));
    $('#sl-controls').append(Menu.renderCacheControls());
    $('#sl-cache-controls').append(Menu.renderLinkclick('cache_info'));
    $('#sl-cache-controls').append(Menu.renderCacheInfoTable());
    $('#sl-controls').append(Menu.renderCacheEditor());
    $('#sl-cache-editor-message').append(Menu.renderExpandable("Program Data details", PROGRAM_DATA_DETAILS));
    $('#sl-cache-editor-controls').append(Menu.renderLocalStorageSource());
    $('#sl-cache-editor-controls').append(Menu.renderCheckbox('raw_data', true));
    $('#sl-cache-editor-controls').append(Menu.renderTextinput('data_name', 20, true));
    Menu.engageUI({checkboxradio: true});
    Menu.saveUserSettingsClick();
    Menu.resetUserSettingsClick({delete_keys: LOCALSTORAGE_KEYS});
    Menu.cacheInfoClick();
    Menu.expandableClick();
    Menu.rawDataChange();
    Menu.getCacheClick(ValidateProgramData);
    Menu.saveCacheClick(ValidateProgramData);
    Menu.deleteCacheClick();
    Menu.listCacheClick();
    Menu.refreshCacheClick();
    Menu.cacheAutocomplete();
}

//Main functions

function Main() {
    const preload = {
        run_on_settings: true,
        default_data: DEFAULT_VALUES,
        initialize_func: InitializeProgramValues,
        broadcast_func: BroadcastSL,
        render_menu_func: RenderSettingsMenu,
    };
    if (!Menu.preloadScript(SL, preload)) return;
    LoadLevelData();
    CorrectLevelData();
    LoadSessionData();
    if (HasBlacklist()) {
        Utility.setCSSStyle(PROGRAM_CSS, "PROGRAM_CSS");
        SL.menu_items = CalculateRenderedMenus();
        SL.blacklist_box.after(RenderSidemenu());
        InitializeSide();
        SL.passive_handle = requestIdleCallback(CalculatePassiveLists);
    } else if (SL.enable_safelist) {
        InitializeNonpost();
    }
    //Render level menu only from post index page
    //Since it starts out hidden, we are doing it last
    if(IsLevelMenu()) {
        $("#post-sections > li:first-of-type").append(RenderSettingMenuLink());
        $("#excerpt").before(RenderLevelMenu());
        InitializeSettingsMenu();
        //Accounts for other userscripts binding the same links
        Utility.initializeInterval(()=>{
            SetSafelistSettingsClick();
            SetOtherSectionsClick();
        }, TIMEOUT_POLLING_INTERVAL);
        $(document).on('danbooru:post-preview-updated.sl', PostPreviewUpdated);
    }
}

/****Initialization****/

//Variables for JSPLib
JSPLib.name = PROGRAM_NAME;
JSPLib.shortcut = PROGRAM_SHORTCUT;
JSPLib.data = SL;

//Variables for debug.js
Debug.mode = false;
Debug.level = Debug.VERBOSE;

//Variables for Storage.js
Storage.localSessionValidator = ValidateProgramData;

//Variables for menu.js
Menu.reset_data = PROGRAM_RESET_KEYS;
Menu.settings_callback = RemoteSettingsCallback;
Menu.reset_callback = RemoteResetCallback;
Menu.settings_config = SETTINGS_CONFIG;
Menu.control_config = CONTROL_CONFIG;

//Export JSPLib
Load.exportData();

/****Execution start****/

Load.programInitialize(Main, {required_variables: program_load_required_variables, required_selectors: program_load_required_selectors});

})(JSPLib);
