/****DEPENDENCIES****/

/**Page dependencies**/
// *://.donmai.us/users/####/edit
// *://.donmai.us/settings

/**External dependencies**/
// jQuery
// jQuery-UI: tabs, checkboxradio, sortable
// Danbooru
// JSPLib.utility
// JSPLib.storage
// JSPLib.validate

/****SETUP****/

/* global JSPLib jQuery Danbooru */

var JSPLib = JSPLib || {};
JSPLib.menu = JSPLib.menu || {};

//Has debug.js been loaded?
JSPLib.debug = JSPLib.debug || {};
JSPLib.debug.debuglogLevel = JSPLib.debug.debuglogLevel || (()=>{});

/****GLOBAL VARIABLES****/

JSPLib.menu.version = 2;
JSPLib.menu.program_shortcut = null;
JSPLib.menu.program_name = null;
JSPLib.menu.program_data_regex = null;
JSPLib.menu.program_data_key = null;

//Menu-install data

JSPLib.menu.css_themes_url = "https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/themes/base/jquery-ui.css";

JSPLib.menu.settings_css = `
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
.jsplib-settings-buttons {
    margin-top: 1em;
}
.jsplib-menu-item {
    margin: 0.5em;
}
.jsplib-menu-item > div,
.jsplib-menu-item > ul {
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
.jsplib-textinput jsplib-setting {
    padding: 1px 0.5em;
}
.jsplib-sortlist li {
    width: 5.5em;
    font-size: 125%;
}
.jsplib-sortlist li > div {
    padding: 5px;
}
.jsplib-textinput-control .jsplib-control {
    padding: 1px 0.5em;
}
.jsplib-selectors label {
    width: 100px;
}
.jsplib-linkclick .jsplib-control {
    display: inline;
}
.jsplib-console {
    width: 100%;
    min-width: 100em;
}
.jsplib-console hr,
.jsplib-console .expandable {
    width: 90%;
    margin-left: 0;
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
/*Fix for setting the border with the color CSS*
#userscript-settings-menu .ui-state-active {
    border-bottom-width: 0;
}
`;

JSPLib.menu.color_css = `
/***JQUERY-UI***/
#userscript-settings-menu {
    color: var(--text-color);
    background: var(--body-background-color);
    border: var(--footer-border);
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
    border: var(--form-button-border);
}
#userscript-settings-menu .ui-widget-header {
    color: var(--text-color);
    background: var(--form-button-background);
    border: var(--post-notice-border);
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
    border: var(--footer-border);
}
#userscript-settings-menu .jsplib-console .expandable {
    border: var(--dtext-expand-border);
}
#userscript-settings-menu .jsplib-block-tooltip,
#userscript-settings-menu .jsplib-inline-tooltip {
    color: var(--muted-text-color);
}
#userscript-settings-menu .jsplib-cache-editor-errors {
    border: var(--form-input-border);
}
/***HOVER***/
#userscript-settings-menu .ui-state-hover,
#userscript-settings-menu .ui-state-focus,
#userscript-settings-menu .ui-button:hover,
#userscript-settings-menu .ui-sortable-handle:hover {
    filter: brightness(1.1);
}
#userscript-settings-menu .jsplib-console input[type=button]:hover {
    //background: var(--form-button-background);
}
#userscript-settings-menu .ui-widget-content a:hover {
    color: var(--link-hover-color);
}
`;

JSPLib.menu.settings_field = `
<fieldset id="userscript-settings-menu" data-version="${JSPLib.menu.version}" style="display:none">
  <ul id="userscript-settings-tabs">
  </ul>
  <div id="userscript-settings-sections">
  </div>
</fieldset>
`;

JSPLib.menu.settings_selector = '[href="#userscript-menu"]';
JSPLib.menu.other_selectors = '#edit-options a[href$=settings]';

JSPLib.menu.domains = ['danbooru','safebooru','kagamihara','saitou','shima'];

/****FUNCTIONS****/

////Menu functions

//Menu-install functions
JSPLib.menu.renderTab = function () {
    return `<li><a href="#${this.program_selector}">${this.program_name}</a></li>`;
};

JSPLib.menu.renderSection = function () {
    return `<div id="${this.program_selector}"></div>`;
};

JSPLib.menu.mainSettingsClick = function () {
    if (!JSPLib.utility.isNamespaceBound(this.settings_selector,'click','jsplib')) {
        JSPLib.debug.debuglogLevel("menu.mainSettingsClick - Installing main setting click",JSPLib.debug.DEBUG);
        jQuery(this.settings_selector).on('click.jsplib',(event)=>{
            jQuery(this.other_selectors).removeClass("active");
            jQuery(event.target).addClass("active");
            jQuery('.edit_user > fieldset').hide();
            jQuery('#userscript-settings-menu').show();
            jQuery('input[name=commit]').hide();
            event.preventDefault();
        });
    }
};

//These actions get executed along with any other existing click events
JSPLib.menu.otherSettingsClicks = function () {
    if (!JSPLib.utility.isNamespaceBound(this.other_selectors,'click','jsplib')) {
        JSPLib.debug.debuglogLevel("menu.otherSettingsClicks - Installing other setting click",JSPLib.debug.DEBUG);
        jQuery(this.other_selectors).on('click.jsplib',(event)=>{
            jQuery(this.settings_selector).removeClass('active');
            jQuery('#userscript-settings-menu').hide();
            jQuery('input[name=commit]').show();
            event.preventDefault()
        });
    }
};

JSPLib.menu.installSettingsMenu = function () {
    if (jQuery("#userscript-settings-menu").length === 0) {
        //Perform initial install of menu framework
        jQuery('input[name=commit]').before(this.settings_field);
        jQuery("#edit-options").append('| <a href="#userscript-menu">Userscript Menus</a>');
        JSPLib.utility.initializeInterval(()=>{
            this.mainSettingsClick();
            this.otherSettingsClicks();
        },1000);
        JSPLib.utility.addStyleSheet(this.css_themes_url);
        JSPLib.utility.setCSSStyle(this.settings_css,'menu_settings');
        JSPLib.utility.setCSSStyle(this.color_css,'menu_color');
    } else {
        //Restore to pre-UI state
        jQuery("#userscript-settings-menu").tabs("destroy");
        //Check the version and adjust as needed
        let version = Number(jQuery("#userscript-settings-menu").data('version'));
        if (version !== this.version) {
            JSPLib.debug.debuglogLevel("menu.installSettingsMenu - Lower menu version installed", version || 0, ", installing version", this.version, JSPLib.debug.INFO);
            JSPLib.utility.setCSSStyle(this.settings_css,'menu_settings');
            JSPLib.utility.setCSSStyle(this.color_css,'menu_color');
            jQuery("#userscript-settings-menu").attr('data-version',this.version);
        }
    }
    jQuery("#userscript-settings-tabs").append(this.renderTab());
    jQuery("#userscript-settings-sections").append(this.renderSection());
    //Sort the tabs alphabetically
    jQuery("#userscript-settings-tabs li").sort(function(a, b) {
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

//Menu render functions

JSPLib.menu.renderTextinput = function (setting_name,length=20,is_control=false) {
    let program_shortcut = this.program_shortcut;
    let [config,setting_key,display_name,value] = this.getProgramValues(setting_name,is_control);
    let menu_type = (is_control ? 'control' : 'setting');
    let textinput_key = `${program_shortcut}-${menu_type}-${setting_key}`;
    let submit_control = "";
    if (is_control && config[setting_name].buttons.length) {
        config[setting_name].buttons.forEach((button)=>{
            submit_control += this.renderControlButton(setting_key,button,2);
        });
    }
    let hint_html = this.renderSettingHint("block",config[setting_name].hint);
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

JSPLib.menu.renderCheckbox = function (setting_name,is_control=false) {
    let program_shortcut = this.program_shortcut;
    let [config,setting_key,display_name,setting_enabled] = this.getProgramValues(setting_name,is_control);
    let menu_type = (is_control ? 'control' : 'setting');
    let checked = (setting_enabled ? "checked" : "");
    let hint_html = this.renderSettingHint("inline",config[setting_name].hint);
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
    let [config,setting_key,display_name,sort_list] = this.getProgramValues(setting_name);
    let hint_html = this.renderSettingHint("inline",config[setting_name].hint);
    let html = "";
    sort_list.forEach((sortitem)=>{
        let sortitem_display = JSPLib.utility.displayCase(sortitem);
        let sortitem_key = `${program_shortcut}-enable-${setting_key}-${JSPLib.utility.kebabCase(sortitem)}`;
        html += `
<li class="ui-state-default">
    <input type="hidden" class="${program_shortcut}-setting jsplib-setting" name="${sortitem_key}" id="${sortitem_key}" data-sort="${sortitem}" data-parent="3">
    <div>
        <span class="ui-icon ui-icon-arrowthick-2-n-s"></span>
        ${sortitem_display}
    </div>
</li>`;
    });
    return `
<div class="${program_shortcut}-sortlist jsplib-sortlist jsplib-menu-item" data-setting="${setting_name}">
    <h4>${display_name}</h4>
    <ul>
        ${html}
    </ul>
    ${hint_html}
</div>`;
};

JSPLib.menu.renderInputSelectors = function (setting_name,type,is_control=false,has_submit=false) {
    let program_shortcut = this.program_shortcut;
    let [config,setting_key,display_name,enabled_selectors] = this.getProgramValues(setting_name,is_control);
    //The name must be the same for all selectors for radio buttons to work properly
    let menu_type = (is_control ? 'control' : 'setting');
    let selection_name = `${program_shortcut}-${menu_type}-${setting_key}`;
    let submit_control = (is_control && has_submit ? this.renderControlGet(setting_key,2) : '');
    let hint_html = this.renderSettingHint("block",config[setting_name].hint);
    let html = "";
    config[setting_name].allitems.forEach((selector)=>{
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
    let hint_html = this.renderSettingHint("block","Select which domain the script should be active on.");
    let html = "";
    this.domains.forEach((selector)=>{
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

JSPLib.menu.renderKeyselect = function (setting_name,is_control=false) {
    let program_shortcut = this.program_shortcut;
    let [config,setting_key,display_name,value] = this.getProgramValues(setting_name,is_control);
    let menu_type = (is_control ? 'control' : 'setting');
    let selection_name = `${program_shortcut}-${menu_type}-${setting_key}`;
    let hint_html = this.renderSettingHint("inline",config[setting_name].hint);
    let html = "";
    config[setting_name].allitems.forEach((option)=>{
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
}

JSPLib.menu.renderLinkclick = function (setting_name) {
    let program_shortcut = this.program_shortcut;
    let [config,setting_key,display_name,link_text] = this.getProgramValues(setting_name,true);
    let hint_html = this.renderSettingHint("inline",config[setting_name].hint);
    return `
<div class="${program_shortcut}-linkclick jsplib-linkclick jsplib-menu-item">
    <h4>${display_name}</h4>
    <div>
        <b>
            <span class="${program_shortcut}-control jsplib-control">
                [ <a href="javascript:void(0)" id="${program_shortcut}-control-${setting_key}">${link_text}</a> ]
            </span>
        </b>
        &emsp;
        ${hint_html}
    </div>
</div>`;
};

JSPLib.menu.renderDataSourceSections = function () {
    let program_shortcut = this.program_shortcut;
    let allitems = this.program_data.control_config.data_source.allitems;
    let value = this.program_data.control_config.data_source.value;
    let section_class = `${program_shortcut}-section-data-source`;
    let html = "";
    allitems.forEach((source)=>{
        let style = (source !== value ? `style="display:none"` : "");
        let source_key = `${program_shortcut}-section-${JSPLib.utility.kebabCase(source)}`;
        html += `<div id="${source_key}" class="${section_class} jsplib-section-data-source" ${style}></div>`;
    });
    return html;
};

//Menu auxiliary functions
JSPLib.menu.renderControlButton = function (setting_key,button_name,parent_level) {
    let program_shortcut = this.program_shortcut;
    let button_key = `${program_shortcut}-${setting_key}-${button_name}`;
    let display_name = JSPLib.utility.displayCase(button_name);
    return `<input type="button" class="jsplib-control ${program_shortcut}-control" name="${button_key}" id="${button_key}" value="${display_name}" data-parent="${parent_level}">`;
};

JSPLib.menu.renderSettingHint = function (type,hint) {
    return `<span class="${this.program_shortcut}-menu-tooltip jsplib-${type}-tooltip">${hint}</span>`;
};

JSPLib.menu.getProgramValues = function (setting_name,is_control=false) {
    let program_data = this.program_data;
    let config = (!is_control ? program_data.settings_config: program_data.control_config);
    let setting_key = JSPLib.utility.kebabCase(setting_name);
    let display_name = (config[setting_name].display ? config[setting_name].display : JSPLib.utility.displayCase(setting_name));
    let item = (!is_control ? program_data.user_settings[setting_name] : config[setting_name].value);
    return [config,setting_key,display_name,item];
};

JSPLib.menu.isSettingEnabled = function (setting_name,selector) {
    return this.program_data.user_settings[setting_name].includes(selector);
};

JSPLib.menu.getCheckboxRadioSelected = function (selector) {
    return jQuery(selector).map((i,input)=>{return (input.checked ? jQuery(input).data('selector') : undefined);}).toArray();
};

JSPLib.menu.engageUI = function (is_checkbox=false,is_sortable=false) {
    let program_shortcut = this.program_shortcut;
    if (is_checkbox) {
        jQuery(`.${program_shortcut}-selectors input`).checkboxradio();
    }
    if (is_sortable) {
        jQuery(`.${program_shortcut}-sortlist ul`).sortable();
    }
    jQuery(".jsplib-selectors .ui-state-hover").removeClass('ui-state-hover');
};

//Settings auxiliary functions

JSPLib.menu.getEnabledDomains = function () {
    let program_name = this.program_name;
    let domains = JSPLib.utility.readCookie(program_name);
    if (!domains) {
        return this.domains;
    }
    if (domains === 'none') {
        return [];
    }
    let cookie_domains = domains.split(',');
    let valid_domains = JSPLib.utility.setIntersection(this.domains,cookie_domains);
    if (valid_domains.length === 0) {
        JSPLib.debug.debuglogLevel("menu.getEnabledDomains - Invalid cookie found!",JSPLib.debug.WARNING);
        JSPLib.utility.eraseCookie(program_name,'donmai.us');
        return this.domains;
    } else if (valid_domains.length != cookie_domains.length) {
        JSPLib.debug.debuglogLevel("menu.getEnabledDomains - Invalid domains found on cookie!",JSPLib.debug.WARNING);
        JSPLib.utility.createCookie(program_name,valid_domains.join(','),null,'donmai.us');
    }
    return valid_domains;
}

JSPLib.menu.isScriptEnabled = function () {
    let enabled_subdomains = this.getEnabledDomains();
    return enabled_subdomains.includes(this._current_subdomain);
};

JSPLib.menu.loadUserSettings = function () {
    let program_shortcut = this.program_shortcut;
    let config = this.program_data.settings_config;
    let settings = JSPLib.storage.getStorageData(`${program_shortcut}-user-settings`,localStorage,{});
    let errors = this.validateUserSettings(settings,config);
    if (errors.length) {
        JSPLib.debug.debuglogLevel("menu.loadUserSettings - Saving change to user settings!",JSPLib.debug.INFO);
        JSPLib.storage.setStorageData(`${program_shortcut}-user-settings`,settings,localStorage);
    }
    JSPLib.debug.debuglogLevel("menu.loadUserSettings - Returning settings:",settings,JSPLib.debug.DEBUG);
    return settings;
};

JSPLib.menu.validateUserSettings = function (settings,config) {
    let error_messages = [];
    if (!JSPLib.validate.isHash(settings)) {
        return ["User settings are not a hash."];
    }
    for (let setting in config) {
        if (!(setting in settings) || !config[setting].validate(settings[setting])) {
            if (!(setting in settings)) {
                error_messages.push(`'${setting}' setting not found.`);
            } else {
                error_messages.push(`'${setting}' contains invalid data.`);
            }
            JSPLib.debug.debuglogLevel("menu.validateUserSettings - Loading default:",setting,settings[setting],JSPLib.debug.WARNING);
            settings[setting] = config[setting].default;
        }
    }
    let valid_settings = Object.keys(config);
    for (let setting in settings) {
        if (!valid_settings.includes(setting)) {
            JSPLib.debug.debuglogLevel("menu.validateUserSettings - Deleting invalid setting:",setting,settings[setting],JSPLib.debug.WARNING);
            delete settings[setting];
            error_messages.push(`'${setting}' is an invalid setting.`);
        }
    }
    return error_messages;
};

JSPLib.menu.validateCheckboxRadio = function (data,type,allitems) {
    return Array.isArray(data)
        && data.every(val => JSPLib.validate.isString(val))
        && JSPLib.utility.isSubset(allitems, data)
        && (type !== 'radio' || data.length == 1);
};

//For updating settings not changed by the menu, e.g. cache editor or broadcast
JSPLib.menu.updateUserSettings = function () {
    let program_shortcut = this.program_shortcut;
    let settings = this.program_data.user_settings;
    jQuery(`#${program_shortcut}-settings .${program_shortcut}-setting[id]`).each((i,entry)=>{
        let $input = jQuery(entry);
        let parent_level = $input.data('parent');
        let container = JSPLib.utility.getNthParent(entry,parent_level);
        let setting_name = jQuery(container).data('setting');
        if (entry.type === "checkbox" || entry.type === "radio") {
            let selector = $input.data('selector');
            if (selector) {
                $input.prop('checked', this.isSettingEnabled(setting_name,selector));
                $input.checkboxradio("refresh");
            } else {
                $input.prop('checked', settings[setting_name]);
            }
        } else if (entry.type === "text") {
             $input.val(settings[setting_name]);
        } else if (entry.type === "hidden") {
            if (!jQuery(container).hasClass("sorted")) {
                jQuery("ul",container).sortable("destroy");
                let sortlist = jQuery("li",container).detach();
                sortlist.sort((a, b)=>{
                    let sort_a = jQuery("input",a).data('sort');
                    let sort_b = jQuery("input",b).data('sort');
                    return settings[setting_name].indexOf(sort_a) - settings[setting_name].indexOf(sort_b);
                }).each((i,entry)=>{
                    jQuery("ul",container).append(entry);
                });
                jQuery("ul",container).sortable();
                jQuery(container).addClass("sorted");
            }
        }
    });
    jQuery(".jsplib-sortlist").removeClass("sorted");
};

JSPLib.menu.hasSettingChanged = function (setting_name) {
    let program_data = this.program_data;
    return JSON.stringify(program_data.user_settings[setting_name]) !== JSON.stringify(program_data.old_settings[setting_name]);
};

//Menu control functions

JSPLib.menu.saveUserSettingsClick = function (local_callback=null) {
    let program_shortcut = this.program_shortcut;
    let program_name = this.program_name;
    let program_data = this.program_data;
    this._current_domains = this.getEnabledDomains();
    jQuery(`#${program_shortcut}-commit`).on(this.program_click,(event)=>{
        let invalid_setting = false;
        let config = program_data.settings_config;
        let settings = program_data.user_settings;
        program_data.old_settings = JSPLib.utility.dataCopy(settings);
        let temp_selectors = {};
        jQuery(`#${program_shortcut}-settings .${program_shortcut}-setting[id]`).each((i,entry)=>{
            let $input = jQuery(entry);
            let parent_level = $input.data('parent');
            let container = JSPLib.utility.getNthParent(entry,parent_level);
            let setting_name = jQuery(container).data('setting');
            if (entry.type === "checkbox" || entry.type === "radio") {
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
            } else if (entry.type === "text") {
                 let user_setting = config[setting_name].parse(jQuery(entry).val());
                 if (config[setting_name].validate(user_setting)) {
                    settings[setting_name] = user_setting;
                 } else {
                    invalid_setting = true;
                 }
                 jQuery(entry).val(settings[setting_name]);
            } else if (entry.type === "hidden") {
                let sortitem = jQuery(entry).data('sort');
                if (sortitem) {
                    temp_selectors[setting_name] = temp_selectors[setting_name] || [];
                    temp_selectors[setting_name].push(sortitem);
                }
            }
        });
        for (let setting_name in temp_selectors) {
            settings[setting_name] = temp_selectors[setting_name];
        }
        JSPLib.storage.setStorageData(`${program_shortcut}-user-settings`,settings,localStorage);
        this._channel.postMessage({type: "settings", program_shortcut: program_shortcut, from: this.UID, user_settings: settings});
        if (jQuery(`#${program_shortcut}-settings .${program_shortcut}-global`).length) {
            let selected_domains = this.getCheckboxRadioSelected(`#${program_shortcut}-settings .${program_shortcut}-global`);
            if (JSPLib.utility.arrayEquals(this.domains,selected_domains)) {
                //Don't bother storing a cookie if all of the domains are active
                JSPLib.utility.eraseCookie(program_name,'donmai.us');
            } else if (selected_domains.length === 0) {
                JSPLib.utility.createCookie(program_name,'none',365,'donmai.us');
            } else {
                JSPLib.utility.createCookie(program_name,selected_domains.join(','),365,'donmai.us');
            }
            let enabled_domains = JSPLib.utility.setDifference(selected_domains,this._current_domains);
            let disabled_domains = JSPLib.utility.setDifference(this._current_domains,selected_domains);
            if (enabled_domains.length || disabled_domains.length) {
                this._channel.postMessage({type: 'domain', program_shortcut: program_shortcut, from: this.UID, enabled_domains: enabled_domains, disabled_domains: disabled_domains, current_domains: selected_domains});
            }
            this._current_domains = selected_domains;
        }
        if (!invalid_setting) {
            JSPLib.utility.notice(`${program_name}: Settings updated!`);
        } else {
            JSPLib.utility.error("Error: Some settings were invalid!")
        }
        if (typeof local_callback === 'function') {
            local_callback();
        }
    });
};

JSPLib.menu.resetUserSettingsClick = function (delete_keys=[],local_callback=null) {
    let program_shortcut = this.program_shortcut;
    let program_name = this.program_name;
    let program_data = this.program_data;
    jQuery(`#${program_shortcut}-resetall`).on(this.program_click,(event)=>{
        let config = program_data.settings_config;
        let settings = program_data.user_settings;
        program_data.old_settings = JSPLib.utility.dataCopy(settings);
        if (confirm(`This will reset all of ${program_name}'s settings.\n\nAre you sure?`)) {
            for (let setting in config) {
                settings[setting] = config[setting].default;
            }
            jQuery(`#${program_shortcut}-settings .${program_shortcut}-setting[id]`).each((i,entry)=>{
                let $input = jQuery(entry);
                let parent_level = $input.data('parent');
                let container = JSPLib.utility.getNthParent(entry,parent_level);
                let setting_name = jQuery(container).data('setting');
                if (entry.type === "checkbox" || entry.type === "radio") {
                    let selector = $input.data('selector');
                    if (selector) {
                        $input.prop('checked', this.isSettingEnabled(setting_name,selector));
                        $input.checkboxradio("refresh");
                    } else {
                        $input.prop('checked', settings[setting_name]);
                    }
                } else if (entry.type === "text") {
                     $input.val(settings[setting_name]);
                } else if (entry.type === "hidden") {
                    if (!jQuery(container).hasClass("sorted")) {
                        jQuery("ul",container).sortable("destroy");
                        let sortlist = jQuery("li",container).detach();
                        sortlist.sort((a, b)=>{
                            let sort_a = jQuery("input",a).data('sort');
                            let sort_b = jQuery("input",b).data('sort');
                            return settings[setting_name].indexOf(sort_a) - settings[setting_name].indexOf(sort_b);
                        }).each((i,entry)=>{
                            jQuery("ul",container).append(entry);
                        });
                        jQuery("ul",container).sortable();
                        jQuery(container).addClass("sorted");
                    }
                }
            });
            jQuery(".jsplib-sortlist").removeClass("sorted");
            delete_keys.forEach((key)=>{
                localStorage.removeItem(key);
            });
            Object.assign(program_data,JSPLib.menu.program_reset_data,{storage_keys: {local_storage: []}});
            JSPLib.storage.setStorageData(`${program_shortcut}-user-settings`,settings,localStorage);
            this._channel.postMessage({type: 'reset', program_shortcut: program_shortcut, from: this.UID, user_settings: settings});
            JSPLib.utility.notice(`${program_name}: Settings reset to defaults!`);
        }
        if (typeof local_callback === 'function') {
            local_callback();
        }
    });
};

JSPLib.menu.purgeCacheClick = function () {
    let program_shortcut = this.program_shortcut;
    let counter_domname = `#${program_shortcut}-purge-counter`;
    jQuery(`#${program_shortcut}-control-purge-cache`).on(this.program_click,(event)=>{
        if (!this._purge_is_started && confirm(`This will delete all of ${this.program_name}'s cached data.\n\nAre you sure?`)) {
            this._purge_is_started = true;
            jQuery(counter_domname).html(0);
            JSPLib.storage.purgeCache(this.program_data_regex,counter_domname).then(()=>{
                this._purge_is_started = false;
            });
        }
        event.preventDefault();
    });
};

JSPLib.menu.cacheInfoClick = function () {
    let program_shortcut = this.program_shortcut;
    jQuery(`#${program_shortcut}-control-cache-info`).on(this.program_click,(event)=>{
        JSPLib.utility.notice("Calculating cache information...");
        JSPLib.storage.programCacheInfo(program_shortcut,this.program_data_regex).then((cache_info)=>{
            let html = `
<table class="striped">
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
            jQuery(`#${program_shortcut}-cache-info-table`).html(html).show();
        });
        event.preventDefault();
    });
};

////Cache functions

//Cache auxiliary functions

JSPLib.menu.loadStorageKeys = async function () {
    let program_data_regex = this.program_data_regex;
    let storage_keys = this.program_data.storage_keys = {};
    if (program_data_regex) {
        let cache_keys = await JSPLib.storage.danboorustorage.keys();
        storage_keys.indexed_db = cache_keys.filter((key)=>{return key.match(program_data_regex);});
        let program_keys = cache_keys.filter((key)=>{return key.match(this.program_regex);});
        storage_keys.indexed_db = JSPLib.utility.concat(program_keys,storage_keys.indexed_db);
    }
    let keys = Object.keys(localStorage);
    storage_keys.local_storage = keys.filter((key)=>{return key.match(this.program_regex);});
};

JSPLib.menu.getCacheDatakey = function () {
    let program_shortcut = this.program_shortcut;
    let program_data = this.program_data;
    program_data.data_source = jQuery(`#${program_shortcut}-control-data-source`).val();
    program_data.data_type = jQuery(`#${program_shortcut}-control-data-type`).val();
    let data_key = program_data.data_value = jQuery(`#${program_shortcut}-control-data-name`).val().trim();
    if (program_data.data_source === "local_storage") {
        program_data.raw_data = jQuery(`#${program_shortcut}-enable-raw-data`).prop('checked');
        data_key = program_shortcut + '-' + program_data.data_value;
    } else if (program_data.data_type !== "custom") {
        if (typeof this.program_data_key === "function") {
            data_key = this.program_data_key(program_data.data_type,program_data.data_value);
        } else if (typeof this.program_data_key === "object") {
            data_key = this.program_data_key[program_data.data_type] + '-' + program_data.data_value;
        }
    }
    return data_key.toLowerCase();
};

JSPLib.menu.saveLocalData = function (key,data,validator,localupdater) {
    let program_shortcut = this.program_shortcut;
    if (validator(key,data)) {
        JSPLib.storage.setStorageData(key,data,localStorage);
        if (key === `${program_shortcut}-user-settings`) {
            this.program_data.user_settings = data;
            this.updateUserSettings();
            this._channel.postMessage({type: "settings", program_shortcut: program_shortcut, from: this.UID, user_settings: data});
        } else if (typeof localupdater === 'function') {
            localupdater(key,data);
        }
        return true;
    } else {
        return false;
    }
};

//Cache event functions

JSPLib.menu.adjust_data_name = function (disable=true) {
    let name_selector = `#${this.program_shortcut}-control-data-name`;
    if (disable && this._data_name_disabled) {
        jQuery(name_selector).val("");
        jQuery(name_selector).prop('disabled',true);
    } else {
        jQuery(name_selector).prop('disabled',false);
    }
};

JSPLib.menu.dataSourceChange = function () {
    let program_shortcut = this.program_shortcut;
    jQuery(`#${program_shortcut}-control-data-source`).on(`change.${program_shortcut}`,(event)=>{
        let data_source = jQuery(`#${program_shortcut}-control-data-source`).val();
        jQuery(`.${program_shortcut}-section-data-source`).hide();
        let shown_key = `#${program_shortcut}-section-${JSPLib.utility.kebabCase(data_source)}`;
        jQuery(shown_key).show();
        let can_disable = data_source === 'local_storage';
        this.adjust_data_name(can_disable);
    });
};

JSPLib.menu.rawDataChange = function () {
    let program_shortcut = this.program_shortcut;
    jQuery(`#${program_shortcut}-enable-raw-data`).on(`change.${program_shortcut}`,(event)=>{
        this._data_name_disabled = event.target.checked;
        this.adjust_data_name();
    });
}

JSPLib.menu.getCacheClick = function () {
    let program_shortcut = this.program_shortcut;
    let program_data = this.program_data;
    jQuery(`#${program_shortcut}-data-name-get`).on(this.program_click,(event)=>{
        let storage_key = this.getCacheDatakey();
        if (program_data.data_source === "local_storage") {
            let data = {};
            if (program_data.raw_data) {
                for (let key in localStorage) {
                    let match = key.match(this.program_regex);
                    if (match) {
                        let save_key = match[1];
                        data[save_key] = JSPLib.storage.getStorageData(key,localStorage);
                    }
                }
            } else {
                data = JSPLib.storage.getStorageData(storage_key,localStorage);
            }
            jQuery(`#${program_shortcut}-cache-viewer textarea`).val(JSON.stringify(data,null,2));
        } else {
            JSPLib.storage.retrieveData(storage_key).then((data)=>{
                jQuery(`#${program_shortcut}-cache-viewer textarea`).val(JSON.stringify(data,null,2));
            });
        }
        JSPLib.validate.hideValidateError();
        jQuery("#close-notice-link").click();
    });
};

JSPLib.menu.saveCacheClick = function (localvalidator,indexvalidator,localupdater) {
    let program_shortcut = this.program_shortcut;
    let program_data = this.program_data;
    jQuery(`#${program_shortcut}-data-name-save`).on(this.program_click,(event)=>{
        try {
            var data = JSON.parse(jQuery(`#${program_shortcut}-cache-viewer textarea`).val());
        } catch (error) {
            JSPLib.utility.error("Invalid JSON data! Unable to save.");
            return;
        }
        JSPLib.validate.dom_output = `#${program_shortcut}-cache-editor-errors`;
        let storage_key = this.getCacheDatakey();
        if (program_data.data_source === "local_storage") {
            if (program_data.raw_data) {
                let error_messages = [];
                let $cache_errors = jQuery(`#${program_shortcut}-cache-editor-errors`);
                for (let key in data) {
                    let data_key = program_shortcut + '-' + key;
                    if (!JSPLib.menu.saveLocalData(data_key,data[key],localvalidator,localupdater)) {
                        error_messages.push('<div>' + $cache_errors.html() + '</div>');
                    }
                }
                if (error_messages.length) {
                    JSPLib.utility.error("Some data was invalid! They were unable to be imported.");
                    $cache_errors.html(error_messages.join('<div>--------------------</div>'));
                } else {
                    JSPLib.utility.notice("Data was imported.");
                    JSPLib.validate.hideValidateError();
                }
            } else if (JSPLib.menu.saveLocalData(storage_key,data,localvalidator,localupdater)) {
                JSPLib.utility.notice("Data was saved.");
                JSPLib.validate.hideValidateError();
            } else {
                JSPLib.utility.error("Data is invalid! Unable to save.");
            }
        } else {
            if (indexvalidator(storage_key,data)) {
                JSPLib.storage.saveData(storage_key,data).then(()=>{
                    JSPLib.utility.notice("Data was saved.");
                    JSPLib.validate.hideValidateError();
                });
            } else {
                JSPLib.utility.error("Data is invalid! Unable to save.");
            }
        }
        JSPLib.validate.dom_output = null;
    });
};

JSPLib.menu.deleteCacheClick = function () {
    jQuery(`#${this.program_shortcut}-data-name-delete`).on(this.program_click,(event)=>{
        let storage_key = this.getCacheDatakey();
        if (this.program_data.data_source === "local_storage") {
            if (confirm("This will delete program data that may cause problems until the page can be refreshed.\n\nAre you sure?")) {
                localStorage.removeItem(storage_key);
                JSPLib.utility.notice("Data has been deleted.");
                JSPLib.validate.hideValidateError();
            }
        } else {
            JSPLib.storage.removeData(storage_key).then((data)=>{
                JSPLib.utility.notice("Data has been deleted.");
                JSPLib.validate.hideValidateError();
            });
        }
    });
};

//Cache autocomplete

JSPLib.menu.cacheSource = function () {
    let program_data = this.program_data;
    let context = this;
    return function (req,resp) {
        let check_key = context.getCacheDatakey();
        if (program_data.data_source === "indexed_db" && program_data.data_value.length === 0) {
            resp([]);
            return;
        }
        let source_keys = program_data.storage_keys[program_data.data_source];
        let available_keys = source_keys.filter((key)=>{return key.toLowerCase().startsWith(check_key);});
        let transformed_keys = available_keys.slice(0,10);
        if (program_data.data_source === 'local_storage') {
            transformed_keys = JSPLib.storage.keyToNameTransform(transformed_keys,context.program_shortcut);
        } else if (program_data.data_type !== "custom") {
            let program_keys = transformed_keys.filter((key)=>{return key.match(context.program_regex);});
            let program_names = JSPLib.storage.keyToNameTransform(program_keys,context.program_shortcut);
            let cache_keys = JSPLib.utility.setDifference(transformed_keys,program_keys);
            let cache_names = cache_keys.map((key)=>{return key.replace(context.program_data_regex,'');});
            transformed_keys = JSPLib.utility.concat(program_names,cache_names).sort();
        }
        resp(transformed_keys);
    }
};

JSPLib.menu.cacheAutocomplete = function () {
    jQuery(`#${this.program_shortcut}-control-data-name`).autocomplete({
        minLength: 0,
        delay: 0,
        source: this.cacheSource(),
    }).off('keydown.Autocomplete.tab');
};

/****PRIVATE DATA****/

//Variables

JSPLib.menu._purge_is_started = false;
JSPLib.menu._data_name_disabled = false;

JSPLib.menu._active_script = false;
JSPLib.menu._window = (typeof unsafeWindow !== "undefined" ? unsafeWindow : window);
JSPLib.menu._channel = new BroadcastChannel('JSPLib.menu');

JSPLib.menu.program_reset_data = {};
JSPLib.menu.settings_callback = null;
JSPLib.menu.reset_callback = null;
JSPLib.menu.disable_callback = null;

JSPLib.menu._current_subdomain = [...window.location.hostname.matchAll(/^[^.]+/g)].flat()[0];
JSPLib.menu._current_domains = [];

//Functions

JSPLib.menu._isSettingMenu = function () {
    return document.body.dataset.controller === "users" && document.body.dataset.action === "edit";
};

JSPLib.menu._broadcastRX = function () {
    let context = this;
    return function (event) {
        if (event.data.program_shortcut !== context.program_shortcut) {
            return;
        }
        JSPLib.debug.debuglogLevel('JSPLib.menu [broadcast] -',`(${event.data.type}):`,event.data,JSPLib.debug.INFO);
        switch (event.data.type) {
            case 'domain':
                context._current_domains = event.data.current_domains;
                if (event.data.disabled_domains.includes(context._current_subdomain)) {
                    context.program_data.is_enabled = false;
                    if (typeof context.disable_callback === 'function') {
                        context.disable_callback();
                    }
                }
                break;
            case 'reset':
                Object.assign(context.program_data,context.program_reset_data);
                context.loadStorageKeys();
                if (typeof context.reset_callback === 'function') {
                    context.reset_callback();
                }
                //falls through
            case 'settings':
                context.program_data.old_settings = context.program_data.user_settings;
                context.program_data.user_settings = event.data.user_settings;
                if (context._isSettingMenu()) {
                    context.updateUserSettings();
                }
                if (typeof context.settings_callback === 'function') {
                    context.settings_callback();
                }
                //falls through
            default:
                //do nothing
        }
    };
};

/****INITIALIZATION****/

JSPLib.menu._channel.onmessage = JSPLib.menu._broadcastRX();
JSPLib.menu._window.JSPLib = JSPLib.menu._window.JSPLib || {};
JSPLib.menu._window.JSPLib.UID = JSPLib.menu._window.JSPLib.UID || {};
if (!('menu' in JSPLib.menu._window.JSPLib.UID)) {
    JSPLib.menu._active_script = true;
    JSPLib.menu._window.JSPLib.UID.menu = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
}
Object.defineProperty(JSPLib.menu, 'UID', {get: function() {return this._window.JSPLib.UID.menu;}});

Object.defineProperty(JSPLib.menu, 'program_key', {get: function() {return this.program_shortcut && this.program_shortcut.toUpperCase();}});
Object.defineProperty(JSPLib.menu, 'program_click', {get: function() {return this.program_shortcut && 'click.' + this.program_shortcut;}});
Object.defineProperty(JSPLib.menu, 'program_regex', {get: function() {return this.program_shortcut && RegExp(`^${this.program_shortcut}-(.*)`);}});
Object.defineProperty(JSPLib.menu, 'program_selector', {get: function() {return this.program_name && JSPLib.utility.kebabCase(this.program_name);}});
Object.defineProperty(JSPLib.menu, 'program_data', {get: function() {return this.program_key && (typeof Danbooru === 'object') && Danbooru[this.program_key];}});

JSPLib.menu._configuration = {
    nonenumerable: ['_purge_is_started','_data_name_disabled','_active_script','_window','_channel','_current_subdomain','_current_domains','_isSettingMenu','_broadcastRX','_configuration'],
    nonwritable: ['_window','_channel','_current_subdomain','css_themes_url','settings_css','color_css','settings_field','settings_selector','_configuration']
};
Object.defineProperty(JSPLib,'menu',{configurable:false,writable:false});
for (let property in JSPLib.menu) {
    if (property in JSPLib.menu._configuration.nonenumerable) {
        Object.defineProperty(JSPLib.menu,property,{enumerable:false});
    }
    if (property in JSPLib.menu._configuration.nonwritable) {
        Object.defineProperty(JSPLib.menu,property,{writable:false});
    }
    Object.defineProperty(JSPLib.menu,property,{configurable:false});
}
