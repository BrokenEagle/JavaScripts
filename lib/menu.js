/****DEPENDENCIES****/

/**Page dependencies**/
// *://.donmai.us/users/####/edit
// *://.donmai.us/settings
//
// Pages not listed above require some additional steps to work.

/**External dependencies**/
// jQuery
// jQuery-UI: tabs, checkboxradio, sortable

/**Internal dependencies**/
// JSPLib.utility
// JSPLib.validate
// JSPLib.storage

/****SETUP****/

//Linter configuration
/* global JSPLib */

JSPLib.menu = {};

/****GLOBAL VARIABLES****/

JSPLib.menu.version = 10;
JSPLib.menu.program_shortcut = null;
JSPLib.menu.program_name = null;
JSPLib.menu.program_data = null;
JSPLib.menu.program_data_regex = null;
JSPLib.menu.program_data_key = null;

//Menu-install data

JSPLib.menu.tab_widget_url = 'https://cdn.jsdelivr.net/gh/jquery/jquery-ui@1.12.1/ui/widgets/tabs.js';
JSPLib.menu.css_themes_url = "https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/themes/base/jquery-ui.css";
JSPLib.menu.css_debug_url = null;

JSPLib.menu.settings_css = `
#userscript-menu-link {
    padding: 0.25rem;
}
.ui-tabs {
    position: inherit;
}
.jsplib-outer-menu {
    float: left;
    width: 50%;
    min-width: 50em;
}
.jsplib-settings-grouping {
    margin-bottom: 2em;
}
.jsplib-controls-grouping {
    margin-bottom: 2em;
}
.jsplib-settings-buttons {
    margin: 1em 0;
}
.jsplib-settings-buttons input {
    font-weight: bold;
}
.jsplib-menu-item {
    margin: 0.5em;
}
.jsplib-menu-item > div {
    margin-left: 0.5em;
}
.jsplib-inline-tooltip {
    display: inline;
    font-style: italic;
}
.jsplib-block-tooltip {
    display: block;
    font-style: italic;
}
.jsplib-textinput .jsplib-setting {
    padding: 2px 8px;
}
.jsplib-sortlist li {
    width: 8em;
    font-size: 125%;
}
.jsplib-sortlist li > div {
    padding: 5px;
}
.jsplib-textinput-control .jsplib-control {
    padding: 1px 0.5em;
}
.jsplib-selectors label {
    text-align: left;
    width: 100px;
    margin-right: 5px;
    margin-bottom: 5px;
}
.jsplib-selectors .ui-checkboxradio-icon {
    margin-left: -5px;
}
.jsplib-selectors .ui-checkboxradio-icon-space {
    margin-right: 5px;
}
.jsplib-selectors[data-setting="domain_selector"] label {
    width: 200px;
    margin-right: 50px;
}
.jsplib-linkclick .jsplib-control {
    display: inline;
}
.jsplib-console {
    width: 100%;
    min-width: 100em;
    margin-top: 1em;
}
.jsplib-prose {
    line-height: 1.4em;
    word-break: break-word;
}
div.jsplib-console hr,
div.jsplib-expandable.jsplib-prose {
    width: 90%;
    margin-left: 0;
    margin-bottom: 1.5em;
}
.jsplib-expandable-header {
    padding: .4em;
}
.jsplib-expandable-header span {
    margin-right: .5em;
    font-weight: 700;
}
.jsplib-expandable-content {
    display: none;
    padding: .4em;
}
.jsplib-cache-viewer textarea {
    width: 100%;
    min-width: 40em;
    height: 50em;
    padding: 5px;
}
.jsplib-cache-editor-errors {
    display: none;
    margin: 0.5em;
    padding: 0.5em;
}
.jsplib-striped {
    border-collapse: collapse;
    border-spacing: 0;
}
.jsplib-striped thead tr {
    border-bottom: 2px solid #666;
}
.jsplib-striped thead th {
    font-weight: 700;
    text-align: left;
}
.jsplib-striped tbody tr {
    border-bottom: 1px solid #CCC;
}
.jsplib-striped tbody td {
    text-align: right;
}
.jsplib-striped tbody th {
    text-align: left;
}
.jsplib-striped td, .jsplib-striped th {
    padding: 4px 20px;
}
/***FIXES***/
/*Fix for not using href on links*/
#userscript-settings-menu a {
    cursor: pointer;
}
/*Fix for setting the border with the color CSS*/
#userscript-settings-menu #userscript-settings-tabs .ui-state-active {
    border-bottom-width: 0;
}
/*Fix for autocomplete on settings page*/
ul.ui-menu .ui-state-focus,
ul.ui-menu .ui-state-active {
    margin: 0;
}
/*Fix for margins removed between prose sections*/
#userscript-settings-menu div.prose > *:last-child:not(.jsplib-expandable) {
    margin-bottom: 0.5em;
}`;

JSPLib.menu.color_css = `
/***JQUERY-UI***/
#userscript-settings-menu {
    color: var(--text-color);
    background: var(--body-background-color);
    border: 1px solid var(--footer-border-color);
}
#userscript-settings-menu .ui-widget-content {
    color: var(--text-color);
    background: var(--body-background-color);
}
#userscript-settings-menu .ui-widget-content a,
#userscript-settings-menu .ui-widget-content a:link,
#userscript-settings-menu .ui-widget-content a:visited {
    color: var(--link-color);
}
#userscript-settings-menu .ui-button,
#userscript-settings-menu .ui-sortable .ui-sortable-handle {
    color: var(--form-button-text-color);
    background: var(--form-button-background);
    border: 1px solid var(--form-button-border-color);
}
#userscript-settings-menu .ui-widget-header {
    color: var(--text-color);
    background: var(--form-button-background);
    border: 1px solid var(--form-button-border-color);
}
#userscript-settings-menu .ui-state-default {
    background: var(--form-button-hover-background);
}
#userscript-settings-menu .ui-state-default a,
#userscript-settings-menu .ui-state-default a:link,
#userscript-settings-menu .ui-state-default a:visited {
    color: black;
}
#userscript-settings-menu .ui-state-active {
    color: #ffffff;
    background: #007fff;
    border: 1px solid #003eff;
}
#userscript-settings-menu .ui-state-active a,
#userscript-settings-menu .ui-state-active a:link,
#userscript-settings-menu .ui-state-active a:visited {
    color: #ffffff;
}
/***JSPLIB***/
#userscript-settings-menu .jsplib-console hr {
    border: 1px solid var(--footer-border-color);
}
#userscript-settings-menu .jsplib-expandable {
  border: var(--dtext-expand-border);
}
#userscript-settings-menu .jsplib-expandable-content {
    border-top: var(--dtext-expand-border);
}
#userscript-settings-menu .jsplib-block-tooltip,
#userscript-settings-menu .jsplib-inline-tooltip {
    color: var(--muted-text-color);
}
#userscript-settings-menu .jsplib-cache-editor-errors {
    border: 1px solid var(--form-button-border-color);
}
#userscript-settings-menu .jsplib-settings-buttons input {
    color: var(--button-primary-text-color);
}
/***HOVER***/
#userscript-settings-menu .ui-state-hover,
#userscript-settings-menu .ui-state-focus,
#userscript-settings-menu .ui-button:hover,
#userscript-settings-menu .ui-sortable-handle:hover {
    filter: brightness(1.1);
}
#userscript-settings-menu .jsplib-console input[type=button]:hover {
    background: var(--form-button-background);
}
#userscript-settings-menu .ui-widget-content a:hover {
    color: var(--link-hover-color);
}
.jsplib-settings-buttons input {
    color: var(--button-primary-text-color);
}
#page #userscript-settings-menu .jsplib-settings-buttons {
    color: white;
}
#page #userscript-settings-menu .jsplib-settings-buttons .jsplib-commit {
    background-color: var(--green-5);
}
#page #userscript-settings-menu .jsplib-settings-buttons .jsplib-resetall {
    background-color: var(--red-5);
}
#userscript-settings-menu .jsplib-settings-buttons .jsplib-commit:hover,
#userscript-settings-menu .jsplib-settings-buttons .jsplib-resetall:hover {
    filter: brightness(1.25);
}
/***FIXES***/
/*Fix for autocomplete on settings page*/
ul.ui-widget-content {
    background: var(--jquery-ui-widget-content-background);
    color: var(--jquery-ui-widget-content-text-color);
}
ul.ui-autocomplete.ui-widget {
    border: 1px solid var(--autocomplete-border-color);
}`;

JSPLib.menu.settings_field = `
<fieldset id="userscript-settings-menu" data-version="${JSPLib.menu.version}" style="display:none">
  <ul id="userscript-settings-tabs">
  </ul>
  <div id="userscript-settings-sections">
  </div>
</fieldset>`;

JSPLib.menu.settings_selector = '[href="#userscript-menu"]';
JSPLib.menu.other_selectors = '.tab-list > .tab';
JSPLib.menu.other_tabs = '.tab-panel';

JSPLib.menu.domains = ['danbooru', 'safebooru', 'betabooru', 'kagamihara', 'saitou', 'shima'];

/****FUNCTIONS****/

////Menu functions

//Menu-install functions
JSPLib.menu.renderTab = function () {
    return `<li><a href="#${this.program_selector}">${this.program_name}</a></li>`;
};

JSPLib.menu.renderSection = function () {
    return `<div id="${this.program_selector}"></div>`;
};

JSPLib.menu.mainSettingsClick = function (self, override) {
    if (override || !JSPLib.utility.isNamespaceBound(this.settings_selector, 'click', 'jsplib')) {
        self.debug('logLevel', "Installing main setting click", JSPLib.debug.DEBUG);
        JSPLib._jQuery(this.settings_selector).on('click.jsplib', (event) => {
            JSPLib._jQuery(this.other_selectors).removeClass('active-tab');
            JSPLib._jQuery(event.target).addClass('active');
            JSPLib._jQuery(this.other_tabs).hide();
            JSPLib._jQuery('#userscript-settings-menu').show();
            event.preventDefault();
        });
    }
};

//These actions get executed along with any other existing click events
JSPLib.menu.otherSettingsClicks = function (self, override) {
    if (override || !JSPLib.utility.isNamespaceBound(this.other_selectors, 'click', 'jsplib')) {
        self.debug('logLevel', "Installing other setting click", JSPLib.debug.DEBUG);
        JSPLib._jQuery(this.other_selectors).on('click.jsplib', (event) => {
            JSPLib._jQuery(this.settings_selector).removeClass('active');
            JSPLib._jQuery('#userscript-settings-menu').hide();
            JSPLib._jQuery(this.other_tabs).css('display', "");
            event.preventDefault();
        });
    }
};

JSPLib.menu.saveMenuHotkey = function (event) {
    JSPLib._jQuery('#userscript-settings-sections [aria-hidden=false] .jsplib-settings-buttons [id$="-commit"]').click();
    event.preventDefault();
};

JSPLib.menu.switchMenuHotkey = function (event) {
    let menu_number = (event.originalEvent.key === "0" ? "10" : event.originalEvent.key);
    JSPLib._jQuery(`#userscript-settings-tabs li:nth-of-type(${menu_number}) a`).click();
};

JSPLib.menu.installSettingsMenu = function (self) {
    let jQuery = JSPLib._jQuery;
    let window_JSPLib = JSPLib._window.JSPLib;
    if (jQuery("#userscript-settings-menu").length === 0) {
        //Perform initial install of menu framework
        jQuery('.tab-panels').append(this.settings_field);
        jQuery('.tab-list').append('<a id="userscript-menu-link" href="#userscript-menu">Userscript Menus</a>');
        window_JSPLib.menu_click_timer = JSPLib.utility.initializeInterval(() => {
            this.mainSettingsClick();
            this.otherSettingsClicks();
        }, 1000);
        JSPLib.utility.addStyleSheet(this.css_themes_url);
        window_JSPLib.menu_settings_css = JSPLib.utility.setCSSStyle(this.debug_settings_css || this.settings_css, 'menu_settings');
        window_JSPLib.menu_color_css = JSPLib.utility.setCSSStyle(this.debug_color_css || this.color_css, 'menu_color');
        jQuery('.tab-panel-component').css('max-width', '100%');
        jQuery('.tab-list, .security-tab').css('max-width', '60rem');
        if (JSPLib.menu.css_debug_url) {
            JSPLib.storage.removeSessionData('jsplib-debug-css');
        }
    } else {
        //Restore to pre-UI state
        jQuery("#userscript-settings-menu").tabs("destroy");
        //Check the version and adjust as needed
        let version = Number(jQuery("#userscript-settings-menu").data('version'));
        if (version < this.version) {
            self.debug('logLevel', "Lower menu version installed", version || 0, ", installing version", this.version, JSPLib.debug.INFO);
            //The menu items need to be moved around for th 7- -> 8+ version transition
            let settings_tab = jQuery('#userscript-menu-link').detach();
            let settings_section = jQuery('#userscript-settings-menu').detach();
            //Multiple sections with the same ID get added due to the recent settings menu change
            jQuery('#userscript-settings-menu').each((i, entry) => jQuery(entry).remove());
            jQuery('.tab-list').append(settings_tab);
            jQuery('.tab-panel-component').append(settings_section);
            //Manually redo the settings click
            jQuery(this.settings_selector).off('click.jsplib');
            jQuery(this.other_selectors).off('click.jsplib');
            this.mainSettingsClick(true);
            this.otherSettingsClicks(true);
            //The interval timer ID is only saved on version 8+, so just leave the old interval going so as not to have multiple intervals running
            if (Number.isInteger(JSPLib._window.JSPLib.menu_click_timer)) {
                clearInterval(JSPLib._window.JSPLib.menu_click_timer);
                JSPLib._window.JSPLib.menu_click_timer = JSPLib.utility.initializeInterval(() => {
                    this.mainSettingsClick();
                    this.otherSettingsClicks();
                }, 1000);
            }
            //There is no way to specifically target a specific style using DOM controls, so this hackish approach needs to be used for now
            jQuery('style').filter((i, entry) => entry.textContent.match(/#userscript-menu-link/)).remove();
            jQuery('style').filter((i, entry) => entry.textContent.match(/\/\*\*\*JQUERY-UI\*\*\*\//)).remove();
            //New way to remove old CSS styles (version 9+). Will remove the above at the next library release.
            window_JSPLib.menu_settings_css?.remove();
            window_JSPLib.menu_color_css?.remove();
            window_JSPLib.menu_settings_css = JSPLib.utility.setCSSStyle(this.settings_css, 'menu_settings');
            window_JSPLib.menu_color_css = JSPLib.utility.setCSSStyle(this.color_css, 'menu_color');
            jQuery('.tab-panel-component').css('max-width', '100%');
            jQuery('.tab-list, .security-tab').css('max-width', '60rem');
            jQuery("#userscript-settings-menu").attr('data-version', this.version).data('version', this.version);
            jQuery(document).off('keydown.jsplib');
        }
    }
    if (!JSPLib.utility.isNamespaceBound(document, 'keydown', 'jsplib')) {
        jQuery(document).on('keydown.jsplib', null, 'alt+s', this.saveMenuHotkey);
        jQuery(document).on('keydown.jsplib', null, 'alt+1 alt+2 alt+3 alt+4 alt+5 alt+6 alt+7 alt+8 alt+9 alt+0', this.switchMenuHotkey);
    }
    jQuery("#userscript-settings-tabs").append(this.renderTab());
    jQuery("#userscript-settings-sections").append(this.renderSection());
    //Sort the tabs alphabetically
    jQuery("#userscript-settings-tabs li").sort((a, b) => {
        try {
            return a.children[0].innerText.localeCompare(b.children[0].innerText);
        } catch (error) {
            return 0;
        }
    }).each(function() {
        var elem = jQuery(this);
        elem.remove();
        jQuery(elem).appendTo("#userscript-settings-tabs");
    });
    jQuery("#userscript-settings-menu").tabs();
};

JSPLib.menu.initializeSettingsMenu = function (self, RenderSettingsMenu, menu_CSS) {
    this.loadStorageKeys();
    let install_promise = null;
    let css_promise = null;
    if (typeof JSPLib._jQuery.fn.tabs !== 'function') {
        if (!JSPLib.utility.getPublicData(document.body).jsplibInstalling) {
            if (JSPLib.network) {
                self.debug('logLevel', "Installing script with network.", JSPLib.debug.INFO);
                install_promise = JSPLib.network.getScript(this.tab_widget_url);
            } else {
                self.debug('logLevel', "Installing script with DOM.", JSPLib.debug.INFO);
                JSPLib.utility.installScriptDOM(this.tab_widget_url);
            }
            JSPLib._jQuery(document.body).data('jsplib-installing', true);
        } else {
            self.debug('logLevel', "Script is installing.", JSPLib.debug.INFO);
        }
    } else {
        self.debug('logLevel', "Script already installed.", JSPLib.debug.INFO);
        install_promise = Promise.resolve(null);
    }
    if (install_promise === null) {
        install_promise = new Promise((resolve) => {
            let timer = setInterval(() => {
                if (typeof JSPLib._jQuery.fn.tabs === 'function') {
                    self.debug('logLevel', "Script detected.", JSPLib.debug.VERBOSE);
                    clearInterval(timer);
                    resolve(null);
                }
            }, 100);
        });
    }
    if (JSPLib.menu.css_debug_url !== null) {
        if (JSPLib.network && !JSPLib.utility.getPublicData(document.body).jsplibDebugCss) {
            css_promise = JSPLib.network.getNotify(JSPLib.menu.css_debug_url, {custom_error: "Unable to load debug CSS."})
                .then((data) => {
                    JSPLib.storage.setSessionData('jsplib-debug-css', data);
                    Object.assign(JSPLib.menu, data);
                });
            JSPLib._jQuery(document.body).data('jsplib-debug-css', true);
        } else {
            css_promise = new Promise((resolve) => {
                JSPLib.utility.recheckTimer({
                    check: () => JSPLib.utility.getPublicData(document.body).jsplibDebugCss && JSPLib.storage.getSessionData('jsplib-debug-css'),
                    exec: () => {
                        Object.assign(JSPLib.menu, JSPLib.storage.getSessionData('jsplib-debug-css'));
                    },
                    always: () => {
                        resolve(null);
                    },
                },
                100, JSPLib.utility.one_second * 5);
            });
        }
    } else {
        css_promise = Promise.resolve(null);
    }
    Promise.all([install_promise, css_promise]).then(() => {
        self.debug('logLevel', "Script is installed.", JSPLib.debug.DEBUG);
        this.installSettingsMenu();
        RenderSettingsMenu();
    });
    if (menu_CSS) {
        JSPLib.utility.setCSSStyle(menu_CSS, 'menu');
    }
};

//Menu render functions

JSPLib.menu.renderTextinput = function (setting_name, length = 20, is_control = false) {
    let program_shortcut = this.program_shortcut;
    let [config, setting_key, display_name, value] = this.getProgramValues(setting_name, is_control);
    let menu_type = (is_control ? 'control' : 'setting');
    let textinput_key = `${program_shortcut}-${menu_type}-${setting_key}`;
    let submit_control = "";
    if (is_control && config[setting_name].buttons.length) {
        config[setting_name].buttons.forEach((button) => {
            submit_control += this.renderControlButton(setting_key, button, 2);
        });
    }
    let hint_html = this.renderSettingHint("block", config[setting_name].hint);
    return `
<div class="${program_shortcut}-textinput jsplib-textinput jsplib-menu-item" data-setting="${setting_name}">
    <h4>${display_name}</h4>
    <div>
        <input type="text" class="${program_shortcut}-${menu_type} jsplib-${menu_type}" name="${textinput_key}" id="${textinput_key}" value="${value}" size="${length}" autocomplete="off" data-parent="2">
        ${submit_control}
        ${hint_html}
    </div>
</div>`;
};

JSPLib.menu.renderCheckbox = function (setting_name, is_control = false) {
    let program_shortcut = this.program_shortcut;
    let [config, setting_key, display_name, setting_enabled] = this.getProgramValues(setting_name, is_control);
    let menu_type = (is_control ? 'control' : 'setting');
    let checked = (setting_enabled ? "checked" : "");
    let hint_html = this.renderSettingHint("inline", config[setting_name].hint);
    return `
<div class="${program_shortcut}-checkbox jsplib-checkbox jsplib-menu-item" data-setting="${setting_name}">
    <h4>${display_name}</h4>
    <div>
        <input type="checkbox" ${checked} class="${program_shortcut}-${menu_type} jsplib-${menu_type}" name="${program_shortcut}-enable-${setting_key}" id="${program_shortcut}-enable-${setting_key}"  data-parent="2">
        ${hint_html}
    </div>
</div>`;
};

JSPLib.menu.renderSortlist = function (setting_name) {
    let program_shortcut = this.program_shortcut;
    let [config, setting_key, display_name, sort_list] = this.getProgramValues(setting_name);
    let hint_html = this.renderSettingHint("inline", config[setting_name].hint);
    let html = "";
    sort_list.forEach((sortitem) => {
        let sortitem_display = JSPLib.utility.displayCase(sortitem);
        let sortitem_key = `${program_shortcut}-enable-${setting_key}-${JSPLib.utility.kebabCase(sortitem)}`;
        html += `
<li class="ui-state-default">
    <input type="hidden" class="${program_shortcut}-setting jsplib-setting" name="${sortitem_key}" id="${sortitem_key}" data-sort="${sortitem}" data-parent="4">
    <div>
        <span class="ui-icon ui-icon-arrowthick-2-n-s"></span>
        ${sortitem_display}
    </div>
</li>`;
    });
    return `
<div class="${program_shortcut}-sortlist jsplib-sortlist jsplib-menu-item" data-setting="${setting_name}">
    <h4>${display_name}</h4>
    <div>
        <ul>
            ${html}
        </ul>
        ${hint_html}
    </div>
</div>`;
};

JSPLib.menu.renderInputSelectors = function (setting_name, type, is_control = false, has_submit = false) {
    let program_shortcut = this.program_shortcut;
    let [config, setting_key, display_name, enabled_selectors] = this.getProgramValues(setting_name, is_control);
    //The name must be the same for all selectors for radio buttons to work properly
    let menu_type = (is_control ? 'control' : 'setting');
    let selection_name = `${program_shortcut}-${menu_type}-${setting_key}`;
    let submit_control = (is_control && has_submit ? this.renderControlGet(setting_key, 2) : '');
    let hint_html = this.renderSettingHint("block", config[setting_name].hint);
    let html = "";
    config[setting_name].allitems.forEach((selector) => {
        let checked = (enabled_selectors.includes(selector) ? "checked" : "");
        let display_selection = JSPLib.utility.displayCase(selector);
        let selection_key = `${program_shortcut}-select-${setting_key}-${selector}`;
        html += `
            <label for="${selection_key}">${display_selection}</label>
            <input type="${type}" ${checked} class="${program_shortcut}-${menu_type} jsplib-${menu_type}" name="${selection_name}" id="${selection_key}" data-selector="${selector}" data-parent="2">`;
    });
    return `
<div class="${program_shortcut}-selectors jsplib-selectors jsplib-menu-item" data-setting="${setting_name}">
    <h4>${display_name}</h4>
    <div>
        ${html}
        ${submit_control}
        ${hint_html}
    </div>
</div>`;
};

JSPLib.menu.renderDomainSelectors = function () {
    let program_shortcut = this.program_shortcut;
    let selection_name = `${program_shortcut}-domain-selector`;
    let enabled_selectors = this.getEnabledDomains();
    let hint_html = this.renderSettingHint("block", "Select which domain the script should be active on.");
    let html = "";
    this.domains.forEach((selector) => {
        let checked = (enabled_selectors.includes(selector) ? "checked" : "");
        let display_selection = JSPLib.utility.displayCase(selector);
        let selection_key = `${program_shortcut}-select-domain-${selector}`;
        html += `
            <label for="${selection_key}">${display_selection}</label>
            <input type="checkbox" ${checked} class="${program_shortcut}-global jsplib-global" name="${selection_name}" id="${selection_key}" data-selector="${selector}" data-parent="2">`;
    });
    return `
<div class="${program_shortcut}-selectors jsplib-selectors jsplib-menu-item" data-setting="domain_selector">
    <h4>Script enabled</h4>
    <div>
        ${html}
        ${hint_html}
    </div>
</div>`;
};

JSPLib.menu.renderKeyselect = function (setting_name, is_control = false) {
    let program_shortcut = this.program_shortcut;
    let [config, setting_key, display_name, value] = this.getProgramValues(setting_name, is_control);
    let menu_type = (is_control ? 'control' : 'setting');
    let selection_name = `${program_shortcut}-${menu_type}-${setting_key}`;
    let hint_html = this.renderSettingHint("inline", config[setting_name].hint);
    let html = "";
    config[setting_name].allitems.forEach((option) => {
        let selected = (option === value ? 'selected="selected"' : '');
        let display_option = JSPLib.utility.displayCase(option);
        html += `<option ${selected} value="${option}">${display_option}</option>`;
    });
    return `
<div class="${program_shortcut}-options jsplib-options jsplib-menu-item" data-setting="${setting_name}">
    <h4>${display_name}</h4>
    <div>
        <select name="${selection_name}" id="${selection_name}" class="${program_shortcut}-${menu_type} jsplib-${menu_type}" data-parent="2">;
            ${html}
        </select>
        ${hint_html}
    </div>
</div>
`;
};

JSPLib.menu.renderLinkclick = function (setting_name) {
    let program_shortcut = this.program_shortcut;
    let [config, setting_key, display_name, link_text] = this.getProgramValues(setting_name, true);
    let hint_html = this.renderSettingHint("inline", config[setting_name].hint);
    return `
<div class="${program_shortcut}-linkclick jsplib-linkclick jsplib-menu-item">
    <h4>${display_name}</h4>
    <div>
        <b>
            <span class="${program_shortcut}-control jsplib-control">
                [ <a id="${program_shortcut}-control-${setting_key}">${link_text}</a> ]
            </span>
        </b>
        &emsp;
        ${hint_html}
    </div>
</div>`;
};

JSPLib.menu.renderDataSourceSections = function () {
    let program_shortcut = this.program_shortcut;
    let allitems = this.control_config.data_source.allitems;
    let value = this.control_config.data_source.value;
    let section_class = `${program_shortcut}-section-data-source`;
    let html = "";
    allitems.forEach((source) => {
        let style = (source !== value ? `style="display:none"` : "");
        let source_key = `${program_shortcut}-section-${JSPLib.utility.kebabCase(source)}`;
        html += `<div id="${source_key}" class="${section_class} jsplib-section-data-source" ${style}></div>`;
    });
    return html;
};

JSPLib.menu.renderControlButton = function (setting_key, button_name, parent_level) {
    let program_shortcut = this.program_shortcut;
    let button_key = `${program_shortcut}-${setting_key}-${button_name}`;
    let display_name = JSPLib.utility.displayCase(button_name);
    return `<input type="button" class="jsplib-control ${program_shortcut}-control" name="${button_key}" id="${button_key}" value="${display_name}" data-parent="${parent_level}">`;
};

JSPLib.menu.renderSettingHint = function (type, hint) {
    return `<span class="${this.program_shortcut}-menu-tooltip jsplib-${type}-tooltip">${hint}</span>`;
};

JSPLib.menu.renderExpandable = function (header, content) {
    return `
    <div class="${this.program_shortcut}-expandable jsplib-expandable jsplib-prose">
        <div class="jsplib-expandable-header">
            <span>${header}</span>
            <input type="button" value="Show" class="jsplib-expandable-button">
        </div>
        <div class="jsplib-expandable-content" style="display: none;">${content}</div>
    </div>
</div>`;
};

JSPLib.menu.renderCacheControls = function () {
    return `
<div id="${this.program_shortcut}-cache-controls" class="jsplib-controls-grouping">
    <div id="${this.program_shortcut}-cache-controls-message" class="prose">
        <h4>Cache controls</h4>
    </div>
</div>
<hr>`;
};

JSPLib.menu.renderCacheInfoTable = function () {
    return `<div id="${this.program_shortcut}-cache-info-table" style="display:none"></div>`;
};

JSPLib.menu.renderLocalStorageSource = function () {
    return `<input id="${this.program_shortcut}-control-data-source" type="hidden" value="local_storage">`;
};

JSPLib.menu.renderCacheEditor = function (has_cache_data) {
    let message = (has_cache_data ? `<p>See the <b><a href="#${this.program_shortcut}-cache-controls-message">Cache Data</a></b> details for the list of all cache data and what they do.</p>` : "");
    return `
<div id="${this.program_shortcut}-cache-editor">
    <div id="${this.program_shortcut}-cache-editor-message" class="prose">
        <h4>Cache editor</h4>
        ${message}
    </div>
    <div id="${this.program_shortcut}-cache-editor-controls"></div>
    <div id="${this.program_shortcut}-cache-editor-errors" class="jsplib-cache-editor-errors"></div>
    <div id="${this.program_shortcut}-cache-viewer" class="jsplib-cache-viewer">
        <textarea></textarea>
    </div>
</div>`;
};

JSPLib.menu.renderMenuSection = function (value, type) {
    let message = (value.message ? `<p>${value.message}</p>` : "");
    let section_key = JSPLib.utility.kebabCase(value.name);
    let section_name = JSPLib.utility.displayCase(value.name);
    return `
<div id="${this.program_shortcut}-${section_key}-${type}" class="jsplib-${type}-grouping">
    <div id="${this.program_shortcut}-${section_key}-${type}-message" class="prose">
        <h4>${section_name} ${type}</h4>
        ${message}
    </div>
</div>
<hr>`;
};

JSPLib.menu.renderMenuFramework = function (menu_config) {
    let settings_html = menu_config.settings.map((setting) => this.renderMenuSection(setting, 'settings')).join('\n');
    let control_html = menu_config.controls.map((control) => this.renderMenuSection(control, 'controls')).join('\n');
    let topic_message = (menu_config.topic_id ? `<p>Check the forum for the latest on information and updates (<a class="dtext-link dtext-id-link dtext-forum-topic-id-link" href="/forum_topics/${menu_config.topic_id}">topic #${menu_config.topic_id}</a>).</p>` : "");
    let wiki_message = (menu_config.wiki_page ? `<p>Visit the wiki page for usage information (<a rel="external noreferrer" target="_blank" href="${menu_config.wiki_page}">${menu_config.wiki_page}</a>).</p>` : "");
    return `
<div id="${this.program_shortcut}-script-message" class="prose">
    <h2>${this.program_name}</h2>
    ${topic_message}
    ${wiki_message}
</div>
<div id="${this.program_shortcut}-console" class="jsplib-console">
    <div id="${this.program_shortcut}-settings" class="jsplib-outer-menu">
        ${settings_html}
        <div id="${this.program_shortcut}-settings-buttons" class="jsplib-settings-buttons">
            <input type="button" id="${this.program_shortcut}-commit" class="jsplib-commit" value="Save">
            <input type="button" id="${this.program_shortcut}-resetall" class="jsplib-resetall" value="Factory Reset">
        </div>
    </div>
    <div id="${this.program_shortcut}-controls" class="jsplib-outer-menu">
        ${control_html}
    </div>
</div>`;
};

//Menu auxiliary functions
JSPLib.menu.getProgramValues = function (setting_name, is_control = false) {
    let program_data = this.program_data;
    let config = (!is_control ? this.settings_config : this.control_config);
    let setting_key = JSPLib.utility.kebabCase(setting_name);
    let display_name = (config[setting_name].display ? config[setting_name].display : JSPLib.utility.displayCase(setting_name));
    let item = (!is_control ? program_data.user_settings[setting_name] : config[setting_name].value);
    return [config, setting_key, display_name, item];
};

JSPLib.menu.isSettingEnabled = function (setting_name, selector) {
    return Boolean(this.program_data.user_settings[setting_name]) && this.program_data.user_settings[setting_name].includes(selector);
};

JSPLib.menu.getCheckboxRadioSelected = function (selector) {
    return JSPLib._jQuery(selector).map((i, input) => (input.checked ? JSPLib._jQuery(input).data('selector') : undefined)).toArray();
};

JSPLib.menu.engageUI = function (is_checkbox = false, is_sortable = false) {
    let program_shortcut = this.program_shortcut;
    if (is_checkbox) {
        JSPLib._jQuery(`.${program_shortcut}-selectors input`).checkboxradio();
    }
    if (is_sortable) {
        JSPLib._jQuery(`.${program_shortcut}-sortlist ul`).sortable();
    }
    JSPLib._jQuery(".jsplib-selectors .ui-state-hover").removeClass('ui-state-hover');
};

//Settings auxiliary functions

JSPLib.menu.preloadScript = function (self, program_value, render_menu_func, {run_on_settings = false, default_data = {}, reset_data = {}, initialize_func = null, broadcast_func = null, menu_css = null} = {}) {
    program_value.user_settings = this.loadUserSettings();
    for (let key in program_value.user_settings) {
        Object.defineProperty(program_value, key, {get() {return program_value.user_settings[key];}});
    }
    if (this._isSettingMenu()) {
        this.initializeSettingsMenu(render_menu_func, menu_css);
        if (!run_on_settings) return false;
    }
    if (!this.isScriptEnabled()) {
        self.debug('logLevel', "Script is disabled on", JSPLib._window.location.hostname, JSPLib.debug.INFO);
        return false;
    }
    Object.assign(
        program_value,
        {
            controller: document.body.dataset.controller,
            action: document.body.dataset.action,
        },
        JSPLib.utility.dataCopy(default_data),
        JSPLib.utility.dataCopy(reset_data)
    );
    if (typeof broadcast_func == 'function') {
        program_value.channel = JSPLib.utility.createBroadcastChannel(this.program_name, broadcast_func);
    }
    if (typeof initialize_func == 'function') {
        return initialize_func();
    }
    return true;
};

JSPLib.menu.getEnabledDomains = function (self) {
    if (this._current_domains !== null) {
        return this._current_domains;
    }
    let program_name = this.program_name;
    let domains = JSPLib.utility.readCookie(program_name);
    if (!domains) {
        return this.domains;
    }
    if (domains === 'none') {
        return [];
    }
    let cookie_domains = domains.split(',');
    this._current_domains = JSPLib.utility.arrayIntersection(this.domains, cookie_domains);
    if (this._current_domains.length === 0) {
        self.debug('logLevel', "Invalid cookie found!", JSPLib.debug.WARNING);
        JSPLib.utility.eraseCookie(program_name, 'donmai.us');
        this._current_domains = JSPLib.utility.dataCopy(this.domains);
    } else if (this._current_domains.length !== cookie_domains.length) {
        self.debug('logLevel', "Invalid domains found on cookie!", JSPLib.debug.WARNING);
        JSPLib.utility.createCookie(program_name, this._current_domains.join(','), null, 'donmai.us');
    }
    return this._current_domains;
};

JSPLib.menu.isScriptEnabled = function () {
    let enabled_subdomains = this.getEnabledDomains();
    return enabled_subdomains.includes(this._current_subdomain);
};

JSPLib.menu.loadUserSettings = function (self) {
    let program_shortcut = this.program_shortcut;
    let config = this.settings_config;
    let settings = JSPLib.storage.getLocalData(`${program_shortcut}-user-settings`, {default_val: {}});
    let dirty = false;
    if (Array.isArray(this.settings_migrations)) {
        this.settings_migrations.forEach((migration) => {
            if (config[migration.to].validate((settings[migration.from]))) {
                self.debug('logLevel', "Migrating setting: ", migration.from, "->", migration.to, JSPLib.debug.INFO);
                settings[migration.to] = settings[migration.from];
                delete settings[migration.from];
                dirty = true;
            }
        });
    }
    if (!JSPLib.validate.isHash(settings)) {
        self.debug('warnLevel', "User settings are not a hash!", JSPLib.debug.ERROR);
        settings = {};
    }
    let errors = this.validateUserSettings(settings);
    if (errors.length) {
        self.debug('logLevel', "Errors found:\n", errors.join('\n'), JSPLib.debug.WARNING);
        dirty = true;
    }
    if (dirty) {
        self.debug('logLevel', "Saving updated changes to user settings!", JSPLib.debug.INFO);
        JSPLib.storage.setLocalData(`${program_shortcut}-user-settings`, settings);
    }
    self.debug('logLevel', "Returning settings:", settings, JSPLib.debug.DEBUG);
    return settings;
};

JSPLib.menu.validateUserSettings = function (self, settings) {
    let error_messages = [];
    //This check is for validating settings through the cache editor
    if (!JSPLib.validate.isHash(settings)) {
        return ["User settings are not a hash."];
    }
    let config = this.settings_config;
    for (let setting in config) {
        if (!(setting in settings) || !config[setting].validate(settings[setting])) {
            if (!(setting in settings)) {
                error_messages.push(`'${setting}' setting not found.`);
            } else {
                error_messages.push(`'${setting}' contains invalid data.`);
            }
            let old_setting = settings[setting];
            let message = "";
            if (Array.isArray(config[setting].allitems) && Array.isArray(settings[setting]) && !config[setting].sortvalue) {
                settings[setting] = JSPLib.utility.arrayIntersection(config[setting].allitems, settings[setting]);
                message = "Removing bad items";
            } else {
                settings[setting] = config[setting].reset;
                message = "Loading default";
            }
            self.debug('logLevel', `${message}:`, setting, old_setting, "->", settings[setting], JSPLib.debug.WARNING);
        }
    }
    let valid_settings = Object.keys(config);
    for (let setting in settings) {
        if (!valid_settings.includes(setting)) {
            self.debug('logLevel', "Deleting invalid setting:", setting, settings[setting], JSPLib.debug.WARNING);
            delete settings[setting];
            error_messages.push(`'${setting}' is an invalid setting.`);
        }
    }
    return error_messages;
};

JSPLib.menu.validateCheckboxRadio = function (data, type, allitems) {
    return Array.isArray(data)
        && data.every((val) => JSPLib.validate.isString(val))
        && JSPLib.utility.isSubArray(allitems, data)
        && (type !== 'radio' || data.length === 1);
};

JSPLib.menu.validateNumber = function (data, is_integer, min, max) {
    const validator = (is_integer ? Number.isInteger : JSPLib.validate.isNumber);
    min = min || -Infinity;
    max = max || Infinity;
    return validator(data) && data >= min && data <= max;
};

//For updating inputs based upon the current settings
JSPLib.menu.updateUserSettings = function () {
    let program_shortcut = this.program_shortcut;
    let settings = this.program_data.user_settings;
    JSPLib._jQuery(`#${program_shortcut}-settings .${program_shortcut}-setting[id]`).each((i, entry) => {
        let $input = JSPLib._jQuery(entry);
        let parent_level = $input.data('parent');
        let container = JSPLib.utility.getNthParent(entry, parent_level);
        let setting_name = JSPLib._jQuery(container).data('setting');
        if (entry.type === "checkbox" || entry.type === "radio") {
            let selector = $input.data('selector');
            if (selector) {
                $input.prop('checked', this.isSettingEnabled(setting_name, selector));
                $input.checkboxradio("refresh");
            } else {
                $input.prop('checked', settings[setting_name]);
            }
        } else if (entry.type === "text") {
            $input.val(settings[setting_name]);
        } else if (entry.type === "hidden") {
            if (!JSPLib._jQuery(container).hasClass("sorted")) {
                JSPLib._jQuery("ul", container).sortable("destroy");
                let sortlist = JSPLib._jQuery("li", container).detach();
                sortlist.sort((a, b) => {
                    let sort_a = JSPLib._jQuery("input", a).data('sort');
                    let sort_b = JSPLib._jQuery("input", b).data('sort');
                    return settings[setting_name].indexOf(sort_a) - settings[setting_name].indexOf(sort_b);
                }).each((i, entry) => {
                    JSPLib._jQuery("ul", container).append(entry);
                });
                JSPLib._jQuery("ul", container).sortable();
                JSPLib._jQuery(container).addClass("sorted");
            }
        }
    });
    JSPLib._jQuery(".jsplib-sortlist").removeClass("sorted");
};

//For updating domain selectors based upon the current cookies
JSPLib.menu.updateGlobalSettings = function () {
    let program_shortcut = this.program_shortcut;
    let current_domains = this.getEnabledDomains();
    JSPLib._jQuery(`#${program_shortcut}-settings .${program_shortcut}-global[id]`).each((i, entry) => {
        let $input = JSPLib._jQuery(entry);
        let parent_level = $input.data('parent');
        let container = JSPLib.utility.getNthParent(entry, parent_level);
        let setting_name = JSPLib._jQuery(container).data('setting');
        if (setting_name !== 'domain_selector') {
            return;
        }
        let selector = $input.data('selector');
        $input.prop('checked', current_domains.includes(selector));
        $input.checkboxradio("refresh");
    });
};

JSPLib.menu.hasSettingChanged = function (setting_name) {
    let program_data = this.program_data;
    return JSON.stringify(program_data.user_settings[setting_name]) !== JSON.stringify(program_data.old_settings[setting_name]);
};

//Menu control functions

JSPLib.menu.saveUserSettingsClick = function (local_callback = null) {
    let program_shortcut = this.program_shortcut;
    let program_name = this.program_name;
    let program_data = this.program_data;
    let current_domains = this.getEnabledDomains();
    JSPLib._jQuery(`#${program_shortcut}-commit`).on(this.program_click, () => {
        let config = this.settings_config;
        let settings = program_data.user_settings;
        program_data.old_settings = JSPLib.utility.dataCopy(settings);
        let invalid_setting = JSPLib.menu._collectSettingsInputs(program_shortcut, config, settings);
        JSPLib.storage.setLocalData(`${program_shortcut}-user-settings`, settings);
        this._channel.postMessage({type: "settings", program_shortcut, from: JSPLib.UID.value, user_settings: settings});
        if (JSPLib._jQuery(`#${program_shortcut}-settings .${program_shortcut}-global`).length) {
            let selected_domains = this.getCheckboxRadioSelected(`#${program_shortcut}-settings .${program_shortcut}-global`);
            if (JSPLib.utility.arrayEquals(this.domains, selected_domains)) {
                //Don't bother storing a cookie if all of the domains are active
                JSPLib.utility.eraseCookie(program_name, 'donmai.us');
            } else if (selected_domains.length === 0) {
                JSPLib.utility.createCookie(program_name, 'none', 365, 'donmai.us');
            } else {
                JSPLib.utility.createCookie(program_name, selected_domains.join(','), 365, 'donmai.us');
            }
            let enabled_domains = JSPLib.utility.arrayDifference(selected_domains, current_domains);
            let disabled_domains = JSPLib.utility.arrayDifference(current_domains, selected_domains);
            if (enabled_domains.length || disabled_domains.length) {
                this._channel.postMessage({type: 'domain', program_shortcut, from: JSPLib.UID.value, enabled_domains, disabled_domains, current_domains: selected_domains});
            }
            this._current_domains = selected_domains;
        }
        if (!invalid_setting) {
            JSPLib.notice.notice(`<b>${program_name}:</b> Settings updated!`);
        } else {
            JSPLib.notice.error("<b>Error:</b> Some settings were invalid!");
            this.updateUserSettings();
        }
        if (typeof local_callback === 'function') {
            local_callback();
        }
    });
};

JSPLib.menu.resetUserSettingsClick = function (delete_keys = [], local_callback = null) {
    let program_shortcut = this.program_shortcut;
    let program_name = this.program_name;
    let program_data = this.program_data;
    JSPLib._jQuery(`#${program_shortcut}-resetall`).on(this.program_click, () => {
        let config = this.settings_config;
        let settings = program_data.user_settings;
        program_data.old_settings = JSPLib.utility.dataCopy(settings);
        if (confirm(`This will reset all of ${program_name}'s settings.\n\nAre you sure?`)) {
            for (let setting in config) {
                settings[setting] = config[setting].reset;
            }
            JSPLib._jQuery(`#${program_shortcut}-settings .${program_shortcut}-setting[id]`).each((i, entry) => {
                let $input = JSPLib._jQuery(entry);
                let parent_level = $input.data('parent');
                let container = JSPLib.utility.getNthParent(entry, parent_level);
                let setting_name = JSPLib._jQuery(container).data('setting');
                if (entry.type === "checkbox" || entry.type === "radio") {
                    let selector = $input.data('selector');
                    if (selector) {
                        $input.prop('checked', this.isSettingEnabled(setting_name, selector));
                        $input.checkboxradio("refresh");
                    } else {
                        $input.prop('checked', settings[setting_name]);
                    }
                } else if (entry.type === "text") {
                    $input.val(settings[setting_name]);
                } else if (entry.type === "hidden") {
                    if (!JSPLib._jQuery(container).hasClass("sorted")) {
                        JSPLib._jQuery("ul", container).sortable("destroy");
                        let sortlist = JSPLib._jQuery("li", container).detach();
                        sortlist.sort((a, b) => {
                            let sort_a = JSPLib._jQuery("input", a).data('sort');
                            let sort_b = JSPLib._jQuery("input", b).data('sort');
                            return settings[setting_name].indexOf(sort_a) - settings[setting_name].indexOf(sort_b);
                        }).each((i, entry) => {
                            JSPLib._jQuery("ul", container).append(entry);
                        });
                        JSPLib._jQuery("ul", container).sortable();
                        JSPLib._jQuery(container).addClass("sorted");
                    }
                }
            });
            JSPLib._jQuery(".jsplib-sortlist").removeClass("sorted");
            delete_keys.forEach((key) => {
                JSPLib.storage.removeLocalData(key);
            });
            Object.assign(program_data, JSPLib.utility.dataCopy(this.program_reset_data), {storage_keys: {local_storage: []}});
            JSPLib.storage.setLocalData(`${program_shortcut}-user-settings`, settings);
            this._channel.postMessage({type: 'reset', program_shortcut, from: JSPLib.UID.value, user_settings: settings});
            JSPLib.notice.notice(`<b>${program_name}:</b> Settings reset to defaults!`);
        }
        if (typeof local_callback === 'function') {
            local_callback();
        }
    });
};

JSPLib.menu.purgeCacheClick = function () {
    let program_shortcut = this.program_shortcut;
    JSPLib._jQuery(`#${program_shortcut}-control-purge-cache`).on(this.program_click, (event) => {
        if (!this._purge_is_started && confirm(`This will delete all of ${this.program_name}'s cached data.\n\nAre you sure?`)) {
            this._purge_is_started = true;
            JSPLib.storage.purgeCache(this.program_data_regex).then(() => {
                this._purge_is_started = false;
            });
        }
        event.preventDefault();
    });
};

JSPLib.menu.cacheInfoClick = function () {
    let program_shortcut = this.program_shortcut;
    JSPLib._jQuery(`#${program_shortcut}-control-cache-info`).on(this.program_click, (event) => {
        JSPLib.notice.notice("Calculating cache information...");
        JSPLib.storage.programCacheInfo(program_shortcut, this.program_data_regex).then((cache_info) => {
            let html = `
<table class="jsplib-striped">
    <thead>
        <tr>
            <th>Source</th>
            <th>Items</th>
            <th>Size</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <th>Local storage</th>
            <td>${cache_info.local.program_items} / ${cache_info.local.total_items}</td>
            <td>${cache_info.local.program_size} / ${cache_info.local.total_size}</td>
        </tr>
        <tr>
            <th>Session storage</th>
            <td>${cache_info.session.program_items} / ${cache_info.session.total_items}</td>
            <td>${cache_info.session.program_size} / ${cache_info.session.total_size}</td>
        </tr>
        <tr>
            <th>Indexed DB</th>
            <td>${cache_info.index.program_items} / ${cache_info.index.total_items}</td>
            <td>${cache_info.index.program_size} / ${cache_info.index.total_size}</td>
        </tr>
    </tbody>
</table>
`;
            JSPLib._jQuery(`#${program_shortcut}-cache-info-table`).html(html).show();
        });
        event.preventDefault();
    });
};

JSPLib.menu.expandableClick = function () {
    JSPLib._jQuery(`.${this.program_shortcut}-expandable .jsplib-expandable-button`).on(this.program_click, (event) => {
        let $container = JSPLib._jQuery(event.target).closest('.jsplib-expandable');
        let $button = $container.find('.jsplib-expandable-button');
        let new_value = ($button.attr('value') === "Show" ? "Hide" : "Show");
        $button.attr('value', new_value);
        $container.find('.jsplib-expandable-content').slideToggle(100);
    });
};

////Cache functions

//Cache auxiliary functions

JSPLib.menu.loadStorageKeys = async function () {
    let program_data_regex = this.program_data_regex;
    let storage_keys = this.program_data.storage_keys = {};
    if (program_data_regex) {
        this._storage_keys_promise = JSPLib.storage.danboorustorage.keys();
        let cache_keys = await this._storage_keys_promise;
        this._storage_keys_loaded = true;
        storage_keys.indexed_db = cache_keys.filter((key) => key.match(program_data_regex));
        let program_keys = cache_keys.filter((key) => key.match(this.program_regex));
        storage_keys.indexed_db = JSPLib.utility.concat(program_keys, storage_keys.indexed_db);
    } else {
        this._storage_keys_loaded = true;
    }
    let keys = Object.keys(localStorage);
    storage_keys.local_storage = keys.filter((key) => key.match(this.program_regex));
};

JSPLib.menu.getCacheDatakey = function () {
    let program_shortcut = this.program_shortcut;
    let program_data = this.program_data;
    program_data.data_source = JSPLib._jQuery(`#${program_shortcut}-control-data-source`).val();
    program_data.data_type = JSPLib._jQuery(`#${program_shortcut}-control-data-type`).val();
    let data_key = program_data.data_value = JSPLib._jQuery(`#${program_shortcut}-control-data-name`).val().trim();
    if (program_data.data_source === "local_storage") {
        program_data.raw_data = JSPLib._jQuery(`#${program_shortcut}-enable-raw-data`).prop('checked');
        data_key = program_shortcut + '-' + program_data.data_value;
    } else if (program_data.data_type !== "custom") {
        if (typeof this.program_data_key === "function") {
            data_key = this.program_data_key(program_data.data_type, program_data.data_value);
        } else if (typeof this.program_data_key === "object") {
            data_key = this.program_data_key[program_data.data_type] + '-' + program_data.data_value;
        }
    }
    return data_key.toLowerCase();
};

JSPLib.menu.saveLocalData = function (key, data, validator, localupdater) {
    let program_shortcut = this.program_shortcut;
    if (validator(key, data)) {
        JSPLib.storage.setLocalData(key, data);
        if (key === `${program_shortcut}-user-settings`) {
            this.program_data.user_settings = data;
            this.updateUserSettings();
            this._channel.postMessage({type: "settings", program_shortcut, from: JSPLib.UID.value, user_settings: data});
        } else if (typeof localupdater === 'function') {
            localupdater(key, data);
        }
        return true;
    }
    return false;

};

//Cache event functions

JSPLib.menu.adjust_data_name = function (disable = true) {
    let name_selector = `#${this.program_shortcut}-control-data-name`;
    if (disable && this._data_name_disabled) {
        JSPLib._jQuery(name_selector).val("");
        JSPLib._jQuery(name_selector).prop('disabled', true);
    } else {
        JSPLib._jQuery(name_selector).prop('disabled', false);
    }
};

JSPLib.menu.dataSourceChange = function () {
    let program_shortcut = this.program_shortcut;
    JSPLib._jQuery(`#${program_shortcut}-control-data-source`).on(`change.${program_shortcut}`, () => {
        let data_source = JSPLib._jQuery(`#${program_shortcut}-control-data-source`).val();
        JSPLib._jQuery(`.${program_shortcut}-section-data-source`).hide();
        let shown_key = `#${program_shortcut}-section-${JSPLib.utility.kebabCase(data_source)}`;
        JSPLib._jQuery(shown_key).show();
        let can_disable = data_source === 'local_storage';
        this.adjust_data_name(can_disable);
    });
};

JSPLib.menu.rawDataChange = function () {
    let program_shortcut = this.program_shortcut;
    JSPLib._jQuery(`#${program_shortcut}-enable-raw-data`).on(`change.${program_shortcut}`, (event) => {
        this._data_name_disabled = event.target.checked;
        this.adjust_data_name();
    });
};

JSPLib.menu.getCacheClick = function (localvalidator) {
    let program_shortcut = this.program_shortcut;
    let program_data = this.program_data;
    JSPLib._jQuery(`#${program_shortcut}-data-name-get`).on(this.program_click, () => {
        let storage_key = this.getCacheDatakey();
        if (program_data.data_source === "local_storage") {
            let data = {};
            if (program_data.raw_data) {
                for (let key in localStorage) {
                    let match = key.match(this.program_regex);
                    if (!match) continue;
                    let save_key = match[1];
                    let temp_data = JSPLib.storage.getLocalData(key);
                    if (localvalidator && !localvalidator(key, temp_data)) {
                        continue;
                    }
                    data[save_key] = JSPLib.storage.getLocalData(key);
                }
            } else {
                data = JSPLib.storage.getLocalData(storage_key);
            }
            JSPLib._jQuery(`#${program_shortcut}-cache-viewer textarea`).val(JSON.stringify(data, null, 2));
        } else {
            JSPLib.storage.retrieveData(storage_key, {bypass_cache: true}).then((data) => {
                JSPLib._jQuery(`#${program_shortcut}-cache-viewer textarea`).val(JSON.stringify(data, null, 2));
            });
        }
        JSPLib.validate.hideValidateError();
        JSPLib._jQuery("#close-notice-link").click();
    });
};

JSPLib.menu.saveCacheClick = function (localvalidator, indexvalidator, localupdater) {
    let program_shortcut = this.program_shortcut;
    let program_data = this.program_data;
    JSPLib._jQuery(`#${program_shortcut}-data-name-save`).on(this.program_click, () => {
        var data;
        try {
            data = JSON.parse(JSPLib._jQuery(`#${program_shortcut}-cache-viewer textarea`).val());
        } catch (error) {
            JSPLib.notice.error("Invalid JSON data! Unable to save.");
            return;
        }
        JSPLib.validate.dom_output = `#${program_shortcut}-cache-editor-errors`;
        let storage_key = this.getCacheDatakey();
        if (program_data.data_source === "local_storage") {
            if (program_data.raw_data) {
                let error_messages = [];
                let $cache_errors = JSPLib._jQuery(`#${program_shortcut}-cache-editor-errors`);
                for (let key in data) {
                    let data_key = program_shortcut + '-' + key;
                    if (!this.saveLocalData(data_key, data[key], localvalidator, localupdater)) {
                        error_messages.push('<div>' + $cache_errors.html() + '</div>');
                    }
                }
                if (error_messages.length) {
                    JSPLib.notice.error("Some data was invalid! They were unable to be imported.");
                    $cache_errors.html(error_messages.join('<div>--------------------</div>'));
                } else {
                    JSPLib.notice.notice("Data was imported.");
                    JSPLib.validate.hideValidateError();
                }
            } else if (this.saveLocalData(storage_key, data, localvalidator, localupdater)) {
                JSPLib.notice.notice("Data was saved.");
                JSPLib.validate.hideValidateError();
            } else {
                JSPLib.notice.error("Data is invalid! Unable to save.");
            }
        } else {
            if (indexvalidator(storage_key, data)) {
                JSPLib.storage.saveData(storage_key, data).then(() => {
                    JSPLib.notice.notice("Data was saved.");
                    JSPLib.validate.hideValidateError();
                });
            } else {
                JSPLib.notice.error("Data is invalid! Unable to save.");
            }
        }
        JSPLib.validate.dom_output = null;
    });
};

JSPLib.menu.deleteCacheClick = function () {
    JSPLib._jQuery(`#${this.program_shortcut}-data-name-delete`).on(this.program_click, () => {
        let storage_key = this.getCacheDatakey();
        if (this.program_data.data_source === "local_storage") {
            if (confirm("This will delete program data that may cause problems until the page can be refreshed.\n\nAre you sure?")) {
                JSPLib.storage.removeLocalData(storage_key);
                JSPLib.notice.notice("Data has been deleted.");
                JSPLib.validate.hideValidateError();
            }
        } else {
            JSPLib.storage.removeData(storage_key).then(() => {
                JSPLib.notice.notice("Data has been deleted.");
                JSPLib.validate.hideValidateError();
            });
        }
    });
};

JSPLib.menu.listCacheClick = function () {
    let program_data = this.program_data;
    let program_shortcut = this.program_shortcut;
    JSPLib._jQuery(`#${this.program_shortcut}-data-name-list`).on(this.program_click, () => {
        this.getCacheDatakey();
        if (!this._storage_keys_loaded) {
            JSPLib.notice.notice("Waiting for keys to load...");
        }
        this._storage_keys_promise.then(() => {
            JSPLib._jQuery(`#${program_shortcut}-cache-viewer textarea`).val(JSON.stringify(program_data.storage_keys[program_data.data_source], null, 2));
        });
    });
};

JSPLib.menu.refreshCacheClick = function () {
    JSPLib._jQuery(`#${this.program_shortcut}-data-name-refresh`).on(this.program_click, () => {
        this.loadStorageKeys().then(() => {
            JSPLib.notice.notice("Data names have been refreshed.");
        });
    });
};

//Cache autocomplete

JSPLib.menu.cacheSource = function () {
    let program_data = this.program_data;
    let context = this;
    return function (req, resp) {
        let check_key = context.getCacheDatakey();
        if ((program_data.data_source === "indexed_db" && program_data.data_value.length === 0) || !context._storage_keys_loaded) {
            resp([]);
            return;
        }
        let source_keys = program_data.storage_keys[program_data.data_source];
        let available_keys = source_keys.filter((key) => key.toLowerCase().startsWith(check_key));
        let transformed_keys = available_keys.slice(0, 10);
        if (program_data.data_source === 'local_storage') {
            transformed_keys = context._keyToNameTransform(transformed_keys, context.program_shortcut);
        } else if (program_data.data_type !== "custom") {
            let program_keys = transformed_keys.filter((key) => key.match(context.program_regex));
            let program_names = context._keyToNameTransform(program_keys, context.program_shortcut);
            let cache_keys = JSPLib.utility.arrayDifference(transformed_keys, program_keys);
            let cache_names = cache_keys.map((key) => key.replace(context.program_data_regex, ''));
            transformed_keys = JSPLib.utility.concat(program_names, cache_names).sort();
        }
        resp(transformed_keys);
    };
};

JSPLib.menu.cacheAutocomplete = function () {
    let $control_data = JSPLib._jQuery(`#${this.program_shortcut}-control-data-name`);
    $control_data.autocomplete({
        minLength: 0,
        delay: 0,
        source: JSPLib.menu.cacheSource(),
    }).off('keydown.Autocomplete.tab');
    let autocomplete = $control_data.data('uiAutocomplete');
    autocomplete._renderItem = function (menu, item) {
        return JSPLib._jQuery("<li>").append(JSPLib._jQuery("<div>").text(item.label)).appendTo(menu);
    };
};

/****PRIVATE DATA****/

//Variables

JSPLib.menu._purge_is_started = false;
JSPLib.menu._data_name_disabled = false;
JSPLib.menu._storage_keys_loaded = false;
JSPLib.menu._storage_keys_promise = Promise.resolve(null);

JSPLib.menu._channel = new BroadcastChannel('JSPLib.menu');

JSPLib.menu.program_reset_data = {};
JSPLib.menu.settings_callback = null;
JSPLib.menu.reset_callback = null;
JSPLib.menu.disable_callback = null;

JSPLib.menu._current_subdomain = [...JSPLib._window.location.hostname.matchAll(/^[^.]+/g)].flat()[0];
JSPLib.menu._current_domains = null;

//Functions

JSPLib.menu._isSettingMenu = function () {
    return document.body.dataset.controller === "users" && document.body.dataset.action === "edit";
};

JSPLib.menu._keyToNameTransform = function (keylist, prefix) {
    return keylist.map((key) => key.replace(RegExp('^' + prefix + '-'), ''));
};

////Save

JSPLib.menu._collectSettingsInputs = function (program_shortcut, config, settings) {
    let invalid_setting = false;
    let temp_selectors = {};
    let settings_inputs = JSPLib._jQuery(`#${program_shortcut}-settings .${program_shortcut}-setting[id]`);
    for (let i = 0; i < settings_inputs.length; i++) {
        let entry = settings_inputs[i];
        let $input = JSPLib._jQuery(entry);
        let parent_level = $input.data('parent');
        let container = JSPLib.utility.getNthParent(entry, parent_level);
        let setting_name = JSPLib._jQuery(container).data('setting');
        if (entry.type === "checkbox" || entry.type === "radio") {
            JSPLib.menu._collectCheckboxRadio(setting_name, settings, entry, $input, temp_selectors);
        } else if (entry.type === "text") {
            invalid_setting ||= JSPLib.menu._collectText(config, settings, setting_name, entry);
        } else if (entry.type === "hidden") {
            JSPLib.menu._collectHidden(setting_name, entry, temp_selectors);
        }
    }
    for (let setting_name in temp_selectors) {
        if (config[setting_name].validate(temp_selectors[setting_name])) {
            settings[setting_name] = temp_selectors[setting_name];
        } else {
            invalid_setting = true;
        }
    }
    return invalid_setting;
};

JSPLib.menu._collectCheckboxRadio = function (setting_name, settings, entry, $input, temp_selectors) {
    let selector = $input.data('selector');
    if (selector) {
        //Multiple checkboxes/radio
        temp_selectors[setting_name] = temp_selectors[setting_name] || [];
        if (entry.checked) {
            temp_selectors[setting_name].push(selector);
        }
    } else {
        //Single checkbox
        settings[setting_name] = entry.checked;
    }
};

JSPLib.menu._collectText = function (config, settings, setting_name, entry) {
    let user_setting = config[setting_name].parse(JSPLib._jQuery(entry).val());
    if (config[setting_name].validate(user_setting)) {
        settings[setting_name] = user_setting;
    } else {
        return true;
    }
};

JSPLib.menu._collectHidden = function (setting_name, entry, temp_selectors) {
    let sortitem = JSPLib._jQuery(entry).data('sort');
    if (sortitem) {
        temp_selectors[setting_name] = temp_selectors[setting_name] || [];
        temp_selectors[setting_name].push(sortitem);
    }
};

////Broadcast

JSPLib.menu._broadcastRX = function () {
    let context = this;
    let iteration = 1;
    return function (event) {
        if (event.data.program_shortcut !== context.program_shortcut) {
            return;
        }
        JSPLib.debug.debuglogLevel(`menu._broadcastRX[${iteration++}]`, `(${event.data.type}):`, event.data, JSPLib.debug.INFO);
        switch (event.data.type) {
            case 'domain':
                context._broadcastDomain(event, context);
                break;
            case 'reset':
                context._broadcastReset(event, context);
                break;
            case 'settings':
                context._broadcastSettings(event, context);
                //falls through
            default:
                //do nothing
        }
    };
};

JSPLib.menu._broadcastDomain = function (event, menu) {
    menu._current_domains = event.data.current_domains;
    if (event.data.enabled_domains.includes(menu._current_subdomain)) {
        menu.program_data.is_enabled = true;
        if (typeof menu.enable_callback === 'function') {
            menu.enable_callback();
        }
    }
    if (event.data.disabled_domains.includes(menu._current_subdomain)) {
        menu.program_data.is_enabled = false;
        if (typeof menu.disable_callback === 'function') {
            menu.disable_callback();
        }
    }
    if (menu._isSettingMenu()) {
        menu.updateGlobalSettings();
    }
};

JSPLib.menu._broadcastReset = function (event, menu) {
    Object.assign(menu.program_data, JSPLib.utility.dataCopy(menu.program_reset_data));
    menu.loadStorageKeys();
    if (typeof menu.reset_callback === 'function') {
        menu.reset_callback();
    }
    JSPLib.menu._updateSettingsFromBroadcast(event.data.user_settings);
};

JSPLib.menu._broadcastSettings = function (event, menu) {
    if (typeof menu.settings_callback === 'function') {
        menu.settings_callback();
    }
    JSPLib.menu._updateSettingsFromBroadcast(event.data.user_settings);
};

JSPLib.menu._updateSettingsFromBroadcast = function (new_settings) {
    this.program_data.old_settings = this.program_data.user_settings;
    this.program_data.user_settings = new_settings;
    if (this._isSettingMenu()) {
        this.updateUserSettings();
    }
};

/****INITIALIZATION****/
JSPLib.menu._channel.onmessage = JSPLib.menu._broadcastRX();

Object.defineProperty(JSPLib.menu, 'program_click', {get() {return this.program_shortcut && 'click.' + this.program_shortcut;}});
Object.defineProperty(JSPLib.menu, 'program_regex', {get() {return this.program_shortcut && RegExp(`^${this.program_shortcut}-(.*)`);}});
Object.defineProperty(JSPLib.menu, 'program_selector', {get() {return this.program_name && JSPLib.utility.kebabCase(this.program_name);}});

JSPLib.menu._configuration = {
    nonenumerable: [],
    nonwritable: ['_channel', '_current_subdomain', 'css_themes_url', 'settings_css', 'color_css', 'settings_field', 'settings_selector']
};
JSPLib.initializeModule('menu');
JSPLib.debug.addModuleLogs('menu', ['mainSettingsClick', 'otherSettingsClicks', 'installSettingsMenu', 'initializeSettingsMenu', 'preloadScript', 'getEnabledDomains', 'loadUserSettings', 'validateUserSettings']);
