/****DEPENDENCIES****/

/**Page dependencies**/
// *://.donmai.us/users/####/edit

/**External dependencies**/
// jQuery
// Danbooru
// JSPLib.utility
// JSPLib.storage
// JSPLib.validate

/****SETUP****/

var JSPLib = JSPLib || {};
JSPLib.menu = JSPLib.menu || {};

//Has debug.js been loaded?
JSPLib.debug = JSPLib.debug || {};
JSPLib.debug.debuglogLevel = JSPLib.debug.debuglogLevel || (()=>{});

/****GLOBAL VARIABLES****/

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
    color: #666;
}
.jsplib-block-tooltip {
    display: block;
    font-style: italic;
    color: #666;
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
    border: solid lightgrey 1px;
    margin: 0.5em;
    padding: 0.5em;
}
/*Fix for styles changed by the imported CSS sheet*/
#userscript-settings-menu .ui-widget-content a,
#notice .ui-widget-content a {
    color:#0073ff
}
#notice.ui-state-highlight {
    color: #363636;
}
`;

JSPLib.menu.settings_field = `
<fieldset id="userscript-settings-menu" style="display:none">
  <ul id="userscript-settings-tabs">
  </ul>
  <div id="userscript-settings-sections">
  </div>
</fieldset>
`;

JSPLib.menu.settings_selector = '[href="#userscript-menu"]';
JSPLib.menu.other_selectors = '#edit-options a[href$=settings]';

JSPLib.menu.purge_is_started = false;

/****FUNCTIONS****/

////Menu functions

//Menu-install functions

JSPLib.menu.renderTab = function (program_name,program_key) {
    return `<li><a href="#${program_key}">${program_name}</a></li>`;
};

JSPLib.menu.renderSection = function (program_key) {
    return `<div id="${program_key}"></div>`;
};

JSPLib.menu.mainSettingsClick = function () {
    if (!JSPLib.utility.isNamespaceBound(JSPLib.menu.settings_selector,'click','jsplib.menuchange')) {
        jQuery(JSPLib.menu.settings_selector).on('click.jsplib.menuchange',(e)=>{
            jQuery(JSPLib.menu.other_selectors).removeClass("active");
            jQuery(e.target).addClass("active");
            jQuery('.edit_user > fieldset').hide();
            jQuery('#userscript-settings-menu').show();
            jQuery('input[name=commit]').hide();
            e.preventDefault();
        });
    }
};

//These actions get executed along with any other existing click events
JSPLib.menu.otherSettingsClicks = function () {
    if (!JSPLib.utility.isNamespaceBound(JSPLib.menu.other_selectors,'click','jsplib.menuchange')) {
        jQuery(JSPLib.menu.other_selectors).on('click.jsplib.menuchange',(e)=>{
            jQuery(JSPLib.menu.settings_selector).removeClass('active');
            jQuery('#userscript-settings-menu').hide();
            jQuery('input[name=commit]').show();
            e.preventDefault()
        });
    }
};

JSPLib.menu.installSettingsMenu = function (program_name) {
    let program_key = JSPLib.utility.kebabCase(program_name);
    if (jQuery("#userscript-settings-menu").length === 0) {
        //Perform initial install of menu framework
        jQuery('input[name=commit]').before(JSPLib.menu.settings_field);
        jQuery("#edit-options").append('| <a href="#userscript-menu">Userscript Menus</a>');
        JSPLib.utility.initializeInterval(()=>{
            JSPLib.menu.mainSettingsClick();
            JSPLib.menu.otherSettingsClicks();
        },1000);
        JSPLib.utility.addStyleSheet(JSPLib.menu.css_themes_url);
        JSPLib.utility.setCSSStyle(JSPLib.menu.settings_css,'settings');
    } else {
        //Restore to pre-UI state
        jQuery("#userscript-settings-menu").tabs("destroy");
    }
    jQuery("#userscript-settings-tabs").append(JSPLib.menu.renderTab(program_name,program_key));
    jQuery("#userscript-settings-sections").append(JSPLib.menu.renderSection(program_key));
    //Sort the tabs alphabetically
    jQuery("#userscript-settings-tabs li").sort(function(a, b) {
        try {
            return a.children[0].innerText.localeCompare(b.children[0].innerText);
        } catch (e) {
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

JSPLib.menu.renderTextinput = function (program_shortcut,setting_name,length=20,control=false,hint='',buttons=[]) {
    let config, setting_key, display_name, item;
    [config,setting_key,display_name,item] = JSPLib.menu.getProgramValues(program_shortcut,setting_name);
    let textinput_key = `${program_shortcut}-setting-${setting_key}`;
    let menu_type = (control ? "control" : "setting");
    let submit_control = '';
    if (control && buttons.length) {
        buttons.forEach((button)=>{
            submit_control += JSPLib.menu.renderControlButton(program_shortcut,setting_key,button,2);
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
};

JSPLib.menu.renderCheckbox = function (program_shortcut,setting_name) {
    let config, setting_key, display_name, setting_enabled;
    [config,setting_key,display_name,setting_enabled] = JSPLib.menu.getProgramValues(program_shortcut,setting_name);
    let checked = (setting_enabled ? "checked" : "");
    let hint_html = JSPLib.menu.renderSettingHint(program_shortcut,"inline",config[setting_name].hint);
    return `
<div class="${program_shortcut}-checkbox jsplib-checkbox jsplib-menu-item" data-setting="${setting_name}">
    <h4>${display_name}</h4>
    <div>
        <input type="checkbox" ${checked} class="${program_shortcut}-setting jsplib-setting" name="${program_shortcut}-enable-${setting_key}" id="${program_shortcut}-enable-${setting_key}"  data-parent="2">
        ${hint_html}
    </div>
</div>`;
};

JSPLib.menu.renderSortlist = function (program_shortcut,setting_name) {
    let config, setting_key, display_name, sort_list;
    [config,setting_key,display_name,sort_list] = JSPLib.menu.getProgramValues(program_shortcut,setting_name);
    let hint_html = JSPLib.menu.renderSettingHint(program_shortcut,"inline",config[setting_name].hint);
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

JSPLib.menu.renderInputSelectors = function (program_shortcut,setting_name,type,control=false,all_selectors=[],enabled_selectors=[],hint='',submit=false) {
    let config, setting_key, display_name, item;
    [config,setting_key,display_name,item] = JSPLib.menu.getProgramValues(program_shortcut,setting_name);
    //The name must be the same for all selectors for radio buttons to work properly
    let selection_name = `${program_shortcut}-${setting_key}`;
    let menu_type = (control ? "control" : "setting");
    let submit_control = (control && submit ? JSPLib.menu.renderControlGet(program_shortcut,setting_key,2) : '');
    if (!control) {
        all_selectors = config[setting_name].allitems;
        hint = config[setting_name].hint;
        enabled_selectors = item;
    }
    let hint_html = JSPLib.menu.renderSettingHint(program_shortcut,"block",hint);
    let html = "";
    all_selectors.forEach((selector)=>{
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
</div>
`;
};

JSPLib.menu.renderKeyselect = function (program_shortcut,setting_name,control=false,value='',all_options=[],hint='') {
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

JSPLib.menu.renderLinkclick = function (program_shortcut,setting_name,display_name,link_text,hint) {
    let setting_key = JSPLib.utility.kebabCase(setting_name);
    let hint_html = JSPLib.menu.renderSettingHint(program_shortcut,"inline",hint);
    return `
<div class="${program_shortcut}-linkclick jsplib-linkclick jsplib-menu-item">
    <h4>${display_name}</h4>
    <div>
        <b>
            <span class="${program_shortcut}-control jsplib-control">
                [ <a href="#" id="${program_shortcut}-control-${setting_key}">${link_text}</a> ]
            </span>
        </b>
        &emsp;
        ${hint_html}
    </div>
</div>`;
};

//Menu auxiliary functions

JSPLib.menu.renderControlButton = function (program_shortcut,setting_key,button_name,parent_level) {
    let button_key = `${program_shortcut}-${setting_key}-${button_name}`;
    let display_name = JSPLib.utility.displayCase(button_name);
    return `<input type="button" class="jsplib-control ${program_shortcut}-control" name="${button_key}" id="${button_key}" value="${display_name}" data-parent="${parent_level}">`;
};

JSPLib.menu.renderSettingHint = function (program_shortcut,type,hint) {
    return `<span class="${program_shortcut}-menu-tooltip jsplib-${type}-tooltip">${hint}</span>`;
};

JSPLib.menu.getProgramValues = function (program_shortcut,setting_name) {
    let program_key = program_shortcut.toUpperCase();
    let config = Danbooru[program_key].settings_config;
    let setting_key = JSPLib.utility.kebabCase(setting_name);
    let display_name = JSPLib.utility.displayCase(setting_name);
    let item = Danbooru[program_key].user_settings[setting_name];
    return [config,setting_key,display_name,item];
};

JSPLib.menu.isSettingEnabled = function (program_key,setting_name,selector) {
    return Danbooru[program_key].user_settings[setting_name].includes(selector);
};

JSPLib.menu.getCheckboxRadioSelected = function (selector) {
    return jQuery(selector).map((i,input)=>{return (input.checked ? jQuery(input).data('selector') : undefined);}).toArray();
};

JSPLib.menu.engageUI = function (program_key,is_checkbox=false,is_sortable=false) {
    if (is_checkbox) {
        jQuery(`.${program_key}-selectors input`).checkboxradio();
    }
    if (is_sortable) {
        jQuery(`.${program_key}-sortlist ul`).sortable();
    }
    jQuery(".jsplib-selectors .ui-state-hover").removeClass('ui-state-hover');
};

//Settings auxiliary functions

JSPLib.menu.loadUserSettings = function (program_shortcut) {
    let program_key = program_shortcut.toUpperCase();
    let config = Danbooru[program_key].settings_config;
    let settings = JSPLib.storage.getStorageData(`${program_shortcut}-user-settings`,localStorage,{});
    let errors = JSPLib.menu.validateUserSettings(settings,config);
    if (errors.length) {
        JSPLib.debug.debuglogLevel("Saving change to user settings!",JSPLib.debug.INFO);
        JSPLib.storage.setStorageData(`${program_shortcut}-user-settings`,settings,localStorage);
    }
    JSPLib.debug.debuglogLevel("Returning settings:",settings,JSPLib.debug.DEBUG);
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
};

//For updating settings not changed by the menu, e.g. cache editor or broadcast
JSPLib.menu.updateUserSettings = function (program_shortcut) {
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

//Menu control functions

JSPLib.menu.saveUserSettingsClick = function (program_shortcut,program_name) {
    let program_key = program_shortcut.toUpperCase();
    jQuery(`#${program_shortcut}-commit`).click((e)=>{
        let invalid_setting = false;
        let config = Danbooru[program_key].settings_config;
        let settings = Danbooru[program_key].user_settings;
        let temp_selectors = {};
        jQuery(`#${program_shortcut}-settings .${program_shortcut}-setting[id]`).each((i,entry)=>{
            let parent_level = jQuery(entry).data('parent');
            let container = JSPLib.utility.getNthParent(entry,parent_level);
            let setting_name = jQuery(container).data('setting');
            if (entry.type === "checkbox" || entry.type === "radio") {
                let selector = jQuery(entry).data('selector');
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
        Danbooru[program_key].channel && Danbooru[program_key].channel.postMessage({type: "settings", user_settings: settings});
        if (!invalid_setting) {
            Danbooru.Utility.notice(`${program_name}: Settings updated!`);
        } else {
            Danbooru.Utility.error("Error: Some settings were invalid!")
        }
    });
};

JSPLib.menu.resetUserSettingsClick = function (program_shortcut,program_name,delete_keys,reset_settings) {
    let program_key = program_shortcut.toUpperCase();
    jQuery(`#${program_shortcut}-resetall`).click((e)=>{
        let config = Danbooru[program_key].settings_config;
        let settings = Danbooru[program_key].user_settings;
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
                        $input.prop('checked', JSPLib.menu.isSettingEnabled(program_key,setting_name,selector));
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
            Object.assign(Danbooru[program_key],reset_settings);
            JSPLib.storage.setStorageData(`${program_shortcut}-user-settings`,settings,localStorage);
            Danbooru[program_key].channel && Danbooru[program_key].channel.postMessage({type: "reset", user_settings: settings});
            Danbooru.Utility.notice(`${program_name}: Settings reset to defaults!`);
        }
    });
};

JSPLib.menu.purgeCacheClick = function (program_shortcut,program_name,regex,counter_domname) {
    let program_key = program_shortcut.toUpperCase();
    jQuery(`#${program_shortcut}-control-purge-cache`).click((e)=>{
        if (!JSPLib.menu.purge_is_started && confirm(`This will delete all of ${program_name}'s cached data.\n\nAre you sure?`)) {
            JSPLib.menu.purge_is_started = true;
            JSPLib.storage.purgeCache(regex,counter_domname).then(()=>{
                Danbooru[program_key].channel && Danbooru[program_key].channel.postMessage({type: "purge"});
                JSPLib.menu.purge_is_started = false;
            });
        }
        e.preventDefault();
    });
};

JSPLib.menu.cacheInfoClick = function (program_shortcut,regex,info_domname) {
    let program_key = program_shortcut.toUpperCase();
    jQuery(`#${program_shortcut}-control-cache-info`).click((e)=>{
        Danbooru.Utility.notice("Calculating cache information...");
        JSPLib.storage.programCacheInfo(program_shortcut,regex).then((cache_info)=>{
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
            jQuery(info_domname).html(html).show();
        });
        e.preventDefault();
    });
};

////Cache functions

//Cache auxiliary functions

JSPLib.menu.loadStorageKeys = async function (program_shortcut,data_regex) {
    let program_key = program_shortcut.toUpperCase();
    if (data_regex) {
        var storage_keys = await JSPLib.storage.danboorustorage.keys();
        Danbooru[program_key].storage_keys.indexed_db = storage_keys.filter((key)=>{return key.match(data_regex);});
    }
    storage_keys = Object.keys(localStorage);
    Danbooru[program_key].storage_keys.local_storage = storage_keys.filter((key)=>{return key.startsWith(program_shortcut + "-");});
};

JSPLib.menu.getCacheDatakey = function (program_shortcut,option) {
    let program_key = program_shortcut.toUpperCase();
    let program_data = Danbooru[program_key];
    program_data.data_source = jQuery(`#${program_shortcut}-control-data-source`).val();
    program_data.data_type = jQuery(`#${program_shortcut}-control-data-type`).val();
    let data_key = program_data.data_value = jQuery(`#${program_shortcut}-setting-data-name`).val().trim();
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
};

//Cache event functions

JSPLib.menu.getCacheClick = function (program_shortcut,option) {
    let program_key = program_shortcut.toUpperCase();
    jQuery(`#${program_shortcut}-data-name-get`).on(`click.${program_shortcut}`,(e)=>{
        let storage_key = JSPLib.menu.getCacheDatakey(program_shortcut,option);
        if (Danbooru[program_key].data_source === "local_storage") {
            let data = JSPLib.storage.getStorageData(storage_key,localStorage);
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

JSPLib.menu.saveCacheClick = function (program_shortcut,localvalidator,indexvalidator,option,localupdater) {
    let program_key = program_shortcut.toUpperCase();
    jQuery(`#${program_shortcut}-data-name-save`).on(`click.${program_shortcut}`,(e)=>{
        try {
            var data = JSON.parse(jQuery(`#${program_shortcut}-cache-viewer textarea`).val());
        } catch (e) {
            Danbooru.Utility.error("Invalid JSON data! Unable to save.");
            return;
        }
        let storage_key = JSPLib.menu.getCacheDatakey(program_shortcut,option);
        if (Danbooru[program_key].data_source === "local_storage") {
            if (localvalidator(storage_key,data)) {
                JSPLib.storage.setStorageData(storage_key,data,localStorage);
                Danbooru.Utility.notice("Data was saved.");
                JSPLib.validate.hideValidateError();
                if (storage_key === `${program_shortcut}-user-settings`) {
                    Danbooru[program_key].user_settings = data;
                    JSPLib.menu.updateUserSettings(program_shortcut);
                } else if (localupdater) {
                    localupdater(storage_key,data);
                }
            } else {
                Danbooru.Utility.error("Data is invalid! Unable to save.");
            }
        } else {
            if (indexvalidator(storage_key,data)) {
                JSPLib.storage.saveData(storage_key,data).then(()=>{
                    Danbooru.Utility.notice("Data was saved.");
                    JSPLib.validate.hideValidateError();
                });
            } else {
                Danbooru.Utility.error("Data is invalid! Unable to save.");
            }
        }
    });
};

JSPLib.menu.deleteCacheClick = function (program_shortcut,option) {
    let program_key = program_shortcut.toUpperCase();
    jQuery(`#${program_shortcut}-data-name-delete`).on(`click.${program_shortcut}`,(e)=>{
        let storage_key = JSPLib.menu.getCacheDatakey(program_shortcut,option);
        if (Danbooru[program_key].data_source === "local_storage") {
            if (confirm("This will delete program data that may cause problems until the page can be refreshed.\n\nAre you sure?")) {
                localStorage.removeItem(storage_key);
                Danbooru.Utility.notice("Data has been deleted.");
                JSPLib.validate.hideValidateError();
            }
        } else {
            JSPLib.storage.removeData(storage_key).then((data)=>{
                Danbooru.Utility.notice("Data has been deleted.");
                JSPLib.validate.hideValidateError();
            });
        }
    });
};

//Cache autocomplete

JSPLib.menu.cacheSource = function (program_shortcut,data_regex,option) {
    let program_key = program_shortcut.toUpperCase();
    let program_data = Danbooru[program_key];
    return function (req,resp) {
        let check_key = JSPLib.menu.getCacheDatakey(program_shortcut,option);
        if (program_data.data_source === "indexed_db" && program_data.data_value.length === 0) {
            resp([]);
            return;
        }
        let source_keys = program_data.storage_keys[program_data.data_source];
        let available_keys = source_keys.filter((key)=>{return key.toLowerCase().startsWith(check_key.toLowerCase());});
        let transformed_keys = available_keys.slice(0,10);
        if (program_data.data_source === 'local_storage') {
            transformed_keys = JSPLib.storage.keyToNameTransform(transformed_keys,program_shortcut);
        } else if (program_data.data_type !== "custom") {
            transformed_keys = transformed_keys.map((key)=>{return key.replace(data_regex,'');});
        }
        resp(transformed_keys);
    }
};

JSPLib.menu.cacheAutocomplete = function (program_shortcut,data_regex,option) {
    let program_key = program_shortcut.toUpperCase();
    jQuery(`#${program_shortcut}-setting-data-name`).autocomplete({
        minLength: 0,
        delay: 0,
        source: JSPLib.menu.cacheSource(program_shortcut,data_regex,option),
        search: function() {
            jQuery(this).data("uiAutocomplete").menu.bindings = jQuery();
        }
    }).off('keydown.Autocomplete.tab');
};
