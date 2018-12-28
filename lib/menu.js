/****DEPENDENCIES****/

/**Page dependencies**/
// *://.donmai.us/users/####/edit

/**External dependencies**/
// jQuery
// JSPLib.debug
// JSPLib.utility
// JSPLib.storage

/****SETUP****/

var JSPLib = JSPLib || {};
JSPLib.menu = JSPLib.menu || {};

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
    display: block;
}
.jsplib-linkclick .jsplib-control a {
    color: #0073ff;
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
        $("#userscript-settings-menu").tabs("destroy");
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

JSPLib.menu.renderTextinput = function (program_shortcut,setting_name,length=20,control=false,hint='',submit=false) {
    let config, setting_key, display_name, item;
    [config,setting_key,display_name,item] = JSPLib.menu.getProgramValues(program_shortcut,setting_name);
    let textinput_key = `${program_shortcut}-setting-${setting_key}`;
    let menu_type = (control ? "control" : "setting");
    let submit_control = (control && submit ? JSPLib.menu.renderControlGet(program_shortcut,setting_key,2) : '');
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
    $.each(sort_list,(i,sortitem)=>{
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
    $.each(all_selectors,(i,selector)=>{
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

JSPLib.menu.renderLinkclick = function (program_shortcut,setting_name,display_name,link_text) {
    let setting_key = JSPLib.utility.kebabCase(setting_name);
    return `
<div class="${program_shortcut}-linkclick jsplib-linkclick jsplib-menu-item">
    <h4>${display_name}</h4>
    <div>
        <span class="${program_shortcut}-control jsplib-control">
            <a href="#" id="${program_shortcut}-setting-${setting_key}">${link_text}</a>
        </span>
    </div>
</div>`;
};

//Menu auxiliary functions

JSPLib.menu.renderControlGet = function (program_shortcut,setting_key,parent_level) {
    return `<input type="button" class="${program_shortcut}-control" name="${program_shortcut}-${setting_key}-get" id="${program_shortcut}-${setting_key}-get" value="Get" data-parent="${parent_level}">`;
};

JSPLib.menu.renderSettingHint = function (program_shortcut,type,hint) {
    return `<span class="${program_shortcut}-setting-tooltip jsplib-${type}-tooltip">${hint}</span>`;
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
    return jQuery(selector).map((i,input)=>{return (input.checked ? $(input).data('selector') : undefined);}).toArray();
};

JSPLib.menu.engageUI = function (program_key,is_checkbox=false,is_sortable=false) {
    if (is_checkbox) {
        $(`.${program_key}-selectors input`).checkboxradio();
    }
    if (is_sortable) {
        $(`.${program_key}-sortlist ul`).sortable();
    }
    $(".jsplib-selectors .ui-state-hover").removeClass('ui-state-hover');
};

//Menu control functions

JSPLib.menu.loadUserSettings = function (program_shortcut) {
    let program_key = program_shortcut.toUpperCase();
    let config = Danbooru[program_key].settings_config;
    let settings = JSPLib.storage.getStorageData(`${program_shortcut}-user-settings`,localStorage,{});
    let is_dirty = false;
    for (let setting in config) {
        if (!(setting in settings) || !config[setting].validate(settings[setting])) {
            JSPLib.debug.debuglogLevel("Loading default:",setting,settings[setting],JSPLib.debug.WARNING);
            settings[setting] = config[setting].default;
            is_dirty = true;
        }
    }
    let valid_settings = Object.keys(config);
    for (let setting in settings) {
        if (!valid_settings.includes(setting)) {
            JSPLib.debug.debuglogLevel("Deleting invalid setting:",setting,settings[setting],JSPLib.debug.WARNING);
            delete settings[setting];
            is_dirty = true;
        }
    }
    if (is_dirty) {
        JSPLib.debug.debuglogLevel("Saving change to user settings!",JSPLib.debug.INFO);
        JSPLib.storage.setStorageData(`${program_shortcut}-user-settings`,settings,localStorage);
    }
    JSPLib.debug.debuglogLevel("Returning settings:",settings,JSPLib.debug.DEBUG);
    return settings;
};

JSPLib.menu.saveUserSettingsClick = function (program_shortcut,program_name) {
    let program_key = program_shortcut.toUpperCase();
    jQuery(`#${program_shortcut}-commit`).click((e)=>{
        let invalid_setting = false;
        let config = Danbooru[program_key].settings_config;
        let settings = Danbooru[program_key].user_settings;
        let temp_selectors = {};
        $(`#${program_shortcut}-settings .${program_shortcut}-setting[id]`).each((i,entry)=>{
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
    jQuery(`#${program_shortcut}-setting-purge-cache`).click((e)=>{
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
