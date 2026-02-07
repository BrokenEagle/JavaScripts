/****DEPENDENCIES****/

/**Page dependencies**/
// *://.donmai.us/users/####/edit
// *://.donmai.us/settings
//
// Pages not listed above require some additional steps to work.

/**External dependencies**/
// jQuery
// jQuery-UI: checkboxradio, sortable

/**Internal dependencies**/
// JSPLib.Debug (optional)
// JSPLib.Notice (optional)
// JSPLib.Utility
// JSPLib.Validate
// JSPLib.Storage
// JSPLib.Template

/****SETUP****/

//Linter configuration
/* global JSPLib */

(function ({jQueryProxy, Debug, Notice, Utility, Validate, Storage, Template}) {

const Menu = JSPLib.Menu;

/****PUBLIC VARIABLES****/

Menu.data_key = null;
Menu.css_debug_url = null;
Menu.settings_callback = null;
Menu.reset_callback = null;
Menu.enable_callback = null;
Menu.disable_callback = null;
Menu.domains = Object.freeze(['danbooru', 'safebooru', 'betabooru', 'kagamihara', 'saitou', 'shima']);

/****PRIVATE VARIABLES****/

const VERSION = 11;

//CSS constants

const CSS_THEMES_URL = "https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.12.1/themes/base/jquery-ui.css";

const SETTINGS_CSS = Template.normalizeCSS()`
#userscript-menus {
    padding-top: 0.4em;
    border-width: 1px;
}
#userscript-menus .tab:not(.active-tab) {
    color: var(--grey-5);
    &:hover {
        color: var(--grey-4);
    }
}
#userscript-menus .tab.active-tab {
    color: var(--green-5);
    &:hover {
        color: var(--green-4);
    }
}
.jsplib-section {
    overflow-y: auto;
    padding: 0.5em;
}
#userscript-menu-link {
    padding: 0.25rem;
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
    display: flex;
    gap: 0.5em;
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
.jsplib-textinput input[type="text"] {
    padding: 2px 8px;
    margin-right: 0.5em;
}
.jsplib-textinput input[type="button"],
.jsplib-rawdata input[type="button"] {
    margin-right: 2px;
}
.jsplib-checkbox input {
    margin-right: 0.5em;
}
.jsplib-sortlist li {
    width: 8em;
    font-size: 125%;
    white-space: nowrap;
}
.jsplib-sortlist li > div {
    padding: 5px;
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
.jsplib-options select {
    margin-right: 0.25em;
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
.jsplib-control[type=button]:disabled {
    cursor: default;
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
#userscript-menus a {
    cursor: pointer;
}
/*Fix for setting the border with the color CSS*/
#userscript-menus #userscript-settings-tabs .ui-state-active {
    border-bottom-width: 0;
}
/*Fix for autocomplete on settings page*/
ul.ui-menu .ui-state-focus,
ul.ui-menu .ui-state-active {
    margin: 0;
}
/*Fix for margins removed between prose sections*/
#userscript-menus div.prose > *:last-child:not(.jsplib-expandable) {
    margin-bottom: 0.5em;
}`;

const COLOR_CSS = `
/***JQUERY-UI***/
#userscript-menus {
    color: var(--text-color);
    background: var(--body-background-color);
}
#userscript-menus .ui-widget-content {
    color: var(--text-color);
    background: var(--body-background-color);
}
#userscript-menus .ui-widget-content a,
#userscript-menus .ui-widget-content a:link,
#userscript-menus .ui-widget-content a:visited {
    color: var(--link-color);
}
#userscript-menus .ui-button,
#userscript-menus .ui-sortable .ui-sortable-handle {
    color: var(--form-button-text-color);
    background: var(--form-button-background);
    border: 1px solid var(--form-button-border-color);
}
#userscript-menus .ui-widget-header {
    color: var(--text-color);
    background: var(--form-button-background);
    border: 1px solid var(--form-button-border-color);
}
#userscript-menus .ui-state-default {
    background: var(--form-button-hover-background);
}
#userscript-menus .ui-state-default a,
#userscript-menus .ui-state-default a:link,
#userscript-menus .ui-state-default a:visited {
    color: black;
}
#userscript-menus .ui-state-active {
    color: #ffffff;
    background: #007fff;
    border: 1px solid #003eff;
}
#userscript-menus .ui-state-active a,
#userscript-menus .ui-state-active a:link,
#userscript-menus .ui-state-active a:visited {
    color: #ffffff;
}
/***JSPLIB***/
.jsplib-script-message {
    border-bottom: 1px solid var(--default-border-color);
}
#userscript-menus .jsplib-console hr {
    border: 1px solid var(--default-border-color);
}
#userscript-menus .jsplib-expandable {
  border: 1px solid var(--default-border-color);
}
#userscript-menus .jsplib-expandable-content {
    border-top: 1px solid var(--default-border-color);
}
#userscript-menus .jsplib-block-tooltip,
#userscript-menus .jsplib-inline-tooltip {
    color: var(--muted-text-color);
}
#userscript-menus .jsplib-cache-editor-errors {
    border: 1px solid var(--form-button-border-color);
}
#userscript-menus .jsplib-settings-buttons input {
    color: white;
}
#userscript-menus .jsplib-settings-buttons input.jsplib-commit {
    background-color: var(--green-5);
}
#userscript-menus .jsplib-settings-buttons input.jsplib-resetall {
    background-color: var(--red-5);
}
/***HOVER***/
#userscript-menus .ui-state-hover,
#userscript-menus .ui-state-focus,
#userscript-menus .ui-button:hover,
#userscript-menus .ui-sortable-handle:hover {
    filter: brightness(1.1);
}
#userscript-menus .ui-widget-content a:hover {
    color: var(--link-hover-color);
}
#userscript-menus .jsplib-settings-buttons .jsplib-commit:hover,
#userscript-menus .jsplib-settings-buttons .jsplib-resetall:hover {
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
}
ul.ui-autocomplete div.ui-menu-item-wrapper.ui-state-active {
    color: var(--text-color);
    border: none;
}`;

//HTML constants

const SETTINGS_FIELD = Template.normalizeHTML()`
<div
    id="userscript-menus"
    class="tab-panel-component horizontal-tab-panel"
    x-data="{ active: 0 }"
    data-version="${VERSION}"
>
    <div class="tab-list thin-x-scrollbar"></div>
    <div class="tab-panels"></div>
</div>`;

const TAB_TEMPLATE = Template.normalizeHTML({template: true})`
<a
    x-on:click.prevent="active = ${'index'}"
    x-bind:class="{ 'active-tab': active === ${'index'} }"
    href="#"
    class="tab"
>
    ${'text'}
</a>`;

const SECTION_TEMPLATE = Template.normalizeHTML({template: true})`
<div
    x-bind:class="{ 'active-tab': active === ${'index'} }"
    class="tab-panel"
>
    ${'html'}
</div>`;

const RAWDATA_TEMPLATE = Template.normalizeHTML({template: true})`
<div
    class="${'shortcut'}-rawdata jsplib-rawdata jsplib-menu-item jsplib-control-item"
    data-setting="data-type"
    data-type="text"
>
    <div>
        <input
            id="${'shortcut'}-enable-raw-data"
            class="${'shortcut'}-control jsplib-control"
            name="${'shortcut'}-enable-raw-data"
            type="checkbox"
            checked
            style="display: none;"
        >
        ${'submit_control'}
        <span class="${'shortcut'}-menu-tooltip jsplib-block-tooltip">
            Click <b>Get</b> to export the settings, <b>Save</b> to import them.
        </span>
    </div>
</div>`;

const TEXTINPUT_TEMPLATE = Template.normalizeHTML({template: true})`
<div
    class="${'shortcut'}-textinput jsplib-textinput jsplib-menu-item jsplib-${'menu_type'}-item"
    data-setting="${'setting_name'}"
    data-type="text"
>
    <h4>${'display_name'}</h4>
    <div>
        <input
            id="${'textinput_key'}"
            class="${'shortcut'}-${'menu_type'} jsplib-${'menu_type'}"
            name="${'textinput_key'}"
            value="${'value'}"
            type="text"
            size="${'length'}"
            autocomplete="off"
        >
        ${'submit_control'}
        ${'hint'}
    </div>
</div>`;

const CHECKBOX_TEMPLATE = Template.normalizeHTML({template: true})`
<div
    class="${'shortcut'}-checkbox jsplib-checkbox jsplib-menu-item jsplib-${'menu_type'}-item"
    data-setting="${'setting_name'}"
    data-type="checkbox"
>
    <h4>${'display_name'}</h4>
    <div>
        <input
            id="${'shortcut'}-enable-${'setting_key'}"
            class="${'shortcut'}-${'menu_type'} jsplib-${'menu_type'}"
            name="${'shortcut'}-enable-${'setting_key'}"
            ${'checked'}
            type="checkbox"
        >
        ${'hint'}
    </div>
</div>`;

const SORTLIST_TEMPLATE = Template.normalizeHTML({template: true})`
<div
    class="${'shortcut'}-sortlist jsplib-sortlist jsplib-menu-item jsplib-setting-item"
    data-setting="${'setting_name'}"
    data-type="sortlist"
>
    <h4>${'display_name'}</h4>
    <div>
        <ul>
            ${'html'}
        </ul>
        ${'hint'}
    </div>
</div>`;

const SORTITEM_TEMPLATE = Template.normalizeHTML({template: true})`
<li class="ui-state-default">
    <input
        id="${'key'}"
        class="${'shortcut'}-setting jsplib-setting"
        name="${'key'}"
        type="hidden"
        data-sort="${'sortitem'}"
    >
    <div>
        <span class="ui-icon ui-icon-arrowthick-2-n-s"></span>
        ${'display'}
    </div>
</li>`;

const SELECTORS_TEMPLATE = Template.normalizeHTML({template: true})`
<div
    class="${'shortcut'}-selectors jsplib-selectors jsplib-menu-item jsplib-${'menu_type'}-item"
    data-setting="${'setting_name'}"
    data-type="selector"
>
    <h4>${'display_name'}</h4>
    <div>
        ${'html'}
        ${'submit_control'}
        ${'hint'}
    </div>
</div>`;

const SELECTOR_ITEM_TEMPLATE = Template.normalizeHTML({template: true})`
<label for="${'key'}">
    ${'display'}
</label>
<input
    id="${'key'}"
    class="${'shortcut'}-${'menu_type'} jsplib-${'menu_type'}"
    name="${'name'}"
    ${'checked'}
    type="${'type'}"
    data-selector="${'selector'}"
>`;

const KEYSELECT_TEMPLATE = Template.normalizeHTML({template: true})`
<div
    class="${'shortcut'}-options jsplib-options jsplib-menu-item jsplib-${'menu_type'}-item"
    data-setting="${'setting_name'}"
>
    <h4>${'display_name'}</h4>
    <div>
        <select
            id="${'selection_name'}"
            class="${'shortcut'}-${'menu_type'} jsplib-${'menu_type'}"
            name="${'selection_name'}"
        >
            ${'html'}
        </select>
        ${'hint'}
    </div>
</div>`;

const KEYSELECT_ITEM_TEMPLATE = Template.normalizeHTML({template: true})`
<option value="${'option'}" ${'selected'}>
    ${'display'}
</option>`;

const LINKCLICK_TEMPLATE = Template.normalizeHTML({template: true})`
<div class="${'shortcut'}-linkclick jsplib-linkclick jsplib-menu-item jsplib-control-item">
    <h4>${'display_name'}</h4>
    <div>
        <b>
            <span class="${'shortcut'}-control jsplib-control">
                [ <a id="${'shortcut'}-control-${'setting_key'}">${'link_text'}</a> ]
            </span>
        </b>
        &emsp;
        ${'hint'}
    </div>
</div>`;

const DOMAIN_TEMPLATE = Template.normalizeHTML({template: true})`
<div
    class="${'shortcut'}-selectors jsplib-selectors jsplib-menu-item jsplib-global-item"
    data-setting="domain_selector"
>
    <h4>Script enabled</h4>
    <div>
        ${'html'}
        ${'hint'}
    </div>
</div>`;

const DOMAIN_ITEM_TEMPLATE = Template.normalizeHTML({template: true})`
<label for="${'key'}">
    ${'display'}
</label>
<input
    id="${'key'}"
    class="${'shortcut'}-global jsplib-global"
    name="${'name'}"
    ${'checked'}
    type="checkbox"
    data-selector="${'selector'}"
>`;

const DATASOURCE_SECTION_TEMPLATE = Template.normalizeHTML({template: true})`
<div
    id="${'shortcut'}-section-${'source_key'}"
    class="${'shortcut'}-section-data-source jsplib-section-data-source"
    style="${'style'}"
>
</div>`;

const CONTROL_BUTTON_TEMPLATE = Template.normalizeHTML({template: true})`
<input
    id="${'key'}"
    class="jsplib-control ${'shortcut'}-control"
    name="${'key'}"
    value="${'display'}"
    type="button"
>`;

const SETTING_HINT_TEMPLATE = Template.normalizeHTML({template: true})`
<span class="${'shortcut'}-menu-tooltip jsplib-${'type'}-tooltip">
    ${'text'}
</span>`;

const EXPANDABLE_TEMPLATE = Template.normalizeHTML({template: true})`
<div class="${'shortcut'}-expandable jsplib-expandable jsplib-prose">
    <div class="jsplib-expandable-header">
        <span>${'header'}</span>
        <input type="button" value="Show" class="jsplib-expandable-button">
    </div>
    <div class="jsplib-expandable-content" style="display: none;">
        ${'content'}
    </div>
</div>`;

const CACHE_CONTROLS_TEMPLATE = Template.normalizeHTML({template: true})`
<div id="${'shortcut'}-cache-controls" class="jsplib-controls-grouping ${'shortcut'}-controls-grouping">
    <div id="${'shortcut'}-cache-controls-message" class="prose">
        <h4>Cache controls</h4>
    </div>
</div>
<hr>`;

const CACHE_INFO_TABLE_TEMPLATE = Template.normalizeHTML({template: true})`
<div
    id="${'shortcut'}-cache-info-table" style="display: none;"
>
</div>`;

const LOCAL_STORAGE_SOURCE_TEMPLATE = Template.normalizeHTML({template: true})`
<input
    id="${'shortcut'}-control-data-source"
    type="hidden"
    value="local_storage"
>`;

const CACHE_EDITOR_TEMPLATE = Template.normalizeHTML({template: true})`
<div id="${'shortcut'}-cache-editor">
    <div id="${'shortcut'}-cache-editor-message" class="prose">
        <h4>${'name'}</h4>
        ${'message'}
    </div>
    <div id="${'shortcut'}-cache-editor-controls"></div>
    <div id="${'shortcut'}-cache-editor-errors" class="jsplib-cache-editor-errors"></div>
    <div id="${'shortcut'}-cache-viewer" class="jsplib-cache-viewer">
        <textarea></textarea>
    </div>
</div>`;

const MENU_SECTION_TEMPLATE = Template.normalizeHTML({template: true})`
<div id="${'shortcut'}-${'key'}-${'type'}" class="jsplib-${'type'}-grouping ${'shortcut'}-${'type'}-grouping">
    <div id="${'shortcut'}-${'key'}-${'type'}-message" class="prose">
        <h4>${'name'} ${'type'}</h4>
        ${'message'}
    </div>
</div>
<hr>`;

const MENU_FRAMEWORK_TEMPLATE = Template.normalizeHTML({template: true})`
<div id="${'shortcut'}-script-message" class="prose jsplib-script-message">
    <h2>${'name'}</h2>
    ${'topic'}
    ${'wiki'}
</div>
<div id="${'shortcut'}-console" class="jsplib-console ${'shortcut'}-console">
    <div id="${'shortcut'}-settings" class="jsplib-outer-menu ${'shortcut'}-outer-menu">
        ${'settings'}
        <div id="${'shortcut'}-settings-buttons" class="jsplib-settings-buttons ${'shortcut'}-settings-buttons">
            <input type="button" id="${'shortcut'}-commit" class="jsplib-commit ${'shortcut'}-commit" value="Save">
            <input type="button" id="${'shortcut'}-resetall" class="jsplib-resetall ${'shortcut'}-resetall" value="Factory Reset">
        </div>
    </div>
    <div id="${'shortcut'}-controls" class="jsplib-outer-menu ${'shortcut'}-outer-menu">
        ${'controls'}
    </div>
</div>`;

const MENU_TOPIC_MESSAGE_TEMPLATE = Template.normalizeHTML({template: true})`
<p>
    Check the forum for the latest on information and updates
    (<a class="dtext-link dtext-id-link dtext-forum-topic-id-link" href="/forum_topics/${'topic_id'}">topic #${'topic_id'}</a>).
</p>`;

const MENU_WIKI_MESSAGE_TEMPLATE = Template.normalizeHTML({template: true})`
<p>
    Visit the wiki page for usage information
    (<a rel="external noreferrer" target="_blank" href="${'wiki_page'}">${'wiki_page'}</a>).
</p>`;

const CACHE_EDITOR_MESSAGE_TEMPLATE = Template.normalizeHTML({template: true})`
<p>
    See the <b><a href="#${'shortcut'}-cache-controls-message">Cache Data</a></b> details
    for the list of all cache data and what they do.
</p>`;

const CACHE_INFO_TEMPLATE = Template.normalizeHTML({template: true})`
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
            <td>${'local_program_items'} / ${'local_total_items'}</td>
            <td>${'local_program_size'} / ${'local_total_size'}</td>
        </tr>
        <tr>
            <th>Session storage</th>
            <td>${'session_program_items'} / ${'session_total_items'}</td>
            <td>${'session_program_size'} / ${'session_total_size'}</td>
        </tr>
        <tr>
            <th>Indexed DB</th>
            <td>${'index_program_items'} / ${'index_total_items'}</td>
            <td>${'index_program_size'} / ${'index_total_size'}</td>
        </tr>
    </tbody>
</table>`;

//Other constants

var PURGE_IS_STARTED = false;
var RAW_DATA_CHECKED = false;
var STORAGE_KEYS_LOADED = false;
var STORAGE_KEYS_PROMISE = Promise.resolve(null);

var CURRENT_DOMAINS = null;

/****PUBLIC FUNCTIONS****/

////Menu functions

//Menu-install functions

Menu.installSettingsMenu = function () {
    const printer = Debug.getFunctionPrint('Menu.installSettingsMenu');
    let window_JSPLib = JSPLib._window.JSPLib;
    if (jQueryProxy("#userscript-menus").length === 0) {
        //Perform initial install of menu framework
        printer.logLevel("Installing menu framework.", Debug.DEBUG);
        let $tab_list = jQueryProxy('.tab-list:has(> .basic-tab)');
        let $tab_panel_component = $tab_list.parent();
        let $tab_panels = $tab_panel_component.find('.tab-panels');
        let index = $tab_list.children().length;
        $tab_list.append(TAB_TEMPLATE({text: "Userscripts", index}));
        $tab_panels.append(SECTION_TEMPLATE({html: SETTINGS_FIELD, index}));
        Utility.addStyleSheet(CSS_THEMES_URL);
        window_JSPLib.menu_settings_css = Utility.setCSSStyle(Menu.debug_settings_css || SETTINGS_CSS, 'Menu.settings');
        window_JSPLib.menu_color_css = Utility.setCSSStyle(Menu.debug_color_css || COLOR_CSS, 'Menu.color');
        $tab_panel_component.css('max-width', '100%');
        $tab_panel_component.find('> .tab-list, .security-tab').css('max-width', '60rem');
        if (Menu.css_debug_url) {
            Storage.removeSessionData('jsplib-debug-css');
        }
        jQueryProxy(document).on(JSPLib.event.keydown, null, 'alt+s', _saveMenuHotkey);
        // Userscripts using a previous version of the menu library clobber the UI
        let $userscript_menus = jQueryProxy('#userscript-menus');
        new MutationObserver((mutations, _observer) => {
            for (let mutation of mutations) {
                if (mutation.type === 'childList') {
                    for (let node of mutation.addedNodes) {
                        if (!node.classList.contains('tab')) {
                            node.remove();
                        }
                    }
                } else if (mutation.type === 'attributes' && mutation.target.hasAttribute('style')) {
                    mutation.target.removeAttribute('style');
                }
            }
        }).observe($userscript_menus.find('.tab-list').get(0), {
            childList: true,
            attributeFilter: ['style'],
        });
        new MutationObserver((mutations, _observer) => {
            for (let mutation of mutations) {
                for (let node of mutation.addedNodes) {
                    if (node.id === 'userscript-settings-menu') {
                        let $old_settings = jQueryProxy(node).detach();
                        jQueryProxy('body #userscript-settings-menu').replaceWith($old_settings);
                    } else if (node.nodeName === '#text' || !node.classList.contains('tab-panel')) {
                        node.remove();
                    }
                }
            }
        }).observe($userscript_menus.find('.tab-panels').get(0), {
            childList: true,
        });
    }
    let $settings_component = jQueryProxy('#userscript-menus');
    let $settings_tab_list = $settings_component.find('.tab-list');
    let $settings_tab_panels = $settings_component.find('.tab-panels');
    let index = $settings_tab_list.children().length;
    let settings_tabs = $settings_tab_list.find('.jsplib-tab').detach().toArray();
    let settings_panels = $settings_tab_panels.find('.jsplib-section').detach().toArray();
    settings_tabs.push(jQueryProxy(`<span class="jsplib-tab" data-name="${JSPLib.id}">${JSPLib.name}</span>`).get(0));
    settings_panels.push(jQueryProxy(`<div id="${JSPLib.id}" class="jsplib-section" data-name="${JSPLib.id}"></div>`).get(0));
    settings_tabs.sort((a, b) => a.dataset.name.localeCompare(b.dataset.name));
    $settings_tab_list.append(TAB_TEMPLATE({index}));
    $settings_tab_panels.append(SECTION_TEMPLATE({index}));
    for (let i = 0; i < settings_tabs.length; i++) {
        $settings_tab_list.children().eq(i).append(settings_tabs[i]);
        let panel = settings_panels.find((panel) => panel.dataset.name === settings_tabs[i].dataset.name);
        $settings_tab_panels.children().eq(i).append(panel);
    }
};

//Menu render functions

Menu.renderControlButton = function (setting_key, button_name) {
    return CONTROL_BUTTON_TEMPLATE({
        shortcut: JSPLib.shortcut,
        display: Utility.displayCase(button_name),
        key: `${JSPLib.shortcut}-control-${setting_key}-${button_name}`,
    });
};

Menu.renderRawData = function () {
    return RAWDATA_TEMPLATE({
        shortcut: JSPLib.shortcut,
        submit_control: ['get', 'save'].map((button) => Menu.renderControlButton('data-name', button, 2)).join(""),
    });
};

Menu.renderTextinput = function (setting_name, length = 20, is_control = false) {
    let [config, setting_key, display_name, value] = _getProgramValues(setting_name, is_control);
    let menu_type = (is_control ? 'control' : 'setting');
    let submit_control = "";
    if (is_control) {
        submit_control = config[setting_name].buttons.map((button) => Menu.renderControlButton(setting_key, button, 2)).join("");
    }
    return TEXTINPUT_TEMPLATE({
        shortcut: JSPLib.shortcut,
        setting_name,
        display_name,
        value,
        length,
        menu_type,
        submit_control,
        textinput_key: `${JSPLib.shortcut}-${menu_type}-${setting_key}`,
        hint: _renderSettingHint("block", config[setting_name].hint),
    });
};

Menu.renderCheckbox = function (setting_name, is_control = false) {
    let [config, setting_key, display_name, setting_enabled] = _getProgramValues(setting_name, is_control);
    return CHECKBOX_TEMPLATE({
        shortcut: JSPLib.shortcut,
        setting_name,
        setting_key,
        display_name,
        menu_type: (is_control ? 'control' : 'setting'),
        checked: (setting_enabled ? "checked" : ""),
        hint: _renderSettingHint("inline", config[setting_name].hint),
    });
};

Menu.renderSortlist = function (setting_name) {
    let [config, setting_key, display_name, sort_list] = _getProgramValues(setting_name);
    let html_items = sort_list.map((sortitem) => SORTITEM_TEMPLATE({
        shortcut: JSPLib.shortcut,
        display: Utility.displayCase(sortitem),
        sortitem,
        key: `${JSPLib.shortcut}-enable-${setting_key}-${Utility.kebabCase(sortitem)}`,
    }));
    return SORTLIST_TEMPLATE({
        shortcut: JSPLib.shortcut,
        setting_name,
        display_name,
        html: html_items.join(''),
        hint: _renderSettingHint("inline", config[setting_name].hint),
    });
};

Menu.renderInputSelectors = function (setting_name, type, is_control = false, has_submit = false) {
    let [config, setting_key, display_name, enabled_selectors] = _getProgramValues(setting_name, is_control);
    //The name must be the same for all selectors for radio buttons to work properly
    let menu_type = (is_control ? 'control' : 'setting');
    let html_items = config[setting_name].allitems.map((selector) => SELECTOR_ITEM_TEMPLATE({
        shortcut: JSPLib.shortcut,
        selector,
        type,
        menu_type,
        display: Utility.displayCase(selector),
        key: `${JSPLib.shortcut}-select-${setting_key}-${selector}`,
        name: `${JSPLib.shortcut}-${menu_type}-${setting_key}`,
        checked: (enabled_selectors.includes(selector) ? "checked" : ""),
    }));
    return SELECTORS_TEMPLATE({
        shortcut: JSPLib.shortcut,
        setting_name,
        display_name,
        menu_type,
        type,
        html: html_items.join(''),
        hint: _renderSettingHint("block", config[setting_name].hint),
        submit_control: (is_control && has_submit ? Menu.renderControlGet(setting_key, 2) : ''),
    });
};

Menu.renderDomainSelectors = function () {
    let enabled_selectors = _getEnabledDomains();
    let html_items = Menu.domains.map((selector) => DOMAIN_ITEM_TEMPLATE({
        shortcut: JSPLib.shortcut,
        selector,
        display: Utility.displayCase(selector),
        key: `${JSPLib.shortcut}-select-domain-${selector}`,
        name: `${JSPLib.shortcut}-domain-selector`,
        checked: (enabled_selectors.includes(selector) ? "checked" : ""),
    }));
    return DOMAIN_TEMPLATE({
        shortcut: JSPLib.shortcut,
        html: html_items.join(''),
        hint: _renderSettingHint("block", "Select which domain the script should be active on."),
    });
};

Menu.renderKeyselect = function (setting_name, is_control = false) {
    let [config, setting_key, display_name, value] = _getProgramValues(setting_name, is_control);
    let menu_type = (is_control ? 'control' : 'setting');
    let html_items = config[setting_name].allitems.map((option) => KEYSELECT_ITEM_TEMPLATE({
        option,
        selected: (option === value ? 'selected' : ''),
        display: Utility.displayCase(option),
    }));
    return KEYSELECT_TEMPLATE({
        shortcut: JSPLib.shortcut,
        setting_name,
        display_name,
        menu_type,
        selection_name: `${JSPLib.shortcut}-${menu_type}-${setting_key}`,
        html: html_items.join(''),
        hint: _renderSettingHint("inline", config[setting_name].hint),
    });
};

Menu.renderLinkclick = function (setting_name) {
    let [config, setting_key, display_name, link_text] = _getProgramValues(setting_name, true);
    return LINKCLICK_TEMPLATE({
        shortcut: JSPLib.shortcut,
        display_name,
        setting_key,
        link_text,
        hint: _renderSettingHint("inline", config[setting_name].hint),
    });
};

Menu.renderDataSourceSections = function () {
    let allitems = Menu.control_config.data_source.allitems;
    let value = Menu.control_config.data_source.value;
    let html_items = allitems.map((source) => DATASOURCE_SECTION_TEMPLATE({
        shortcut: JSPLib.shortcut,
        source_key: Utility.kebabCase(source),
        style: (source !== value ? 'display: none;' : "")
    }));
    return html_items.join('');
};

Menu.renderExpandable = function (header, content) {
    return EXPANDABLE_TEMPLATE({
        shortcut: JSPLib.shortcut,
        header,
        content,
    });
};

Menu.renderCacheControls = function () {
    return CACHE_CONTROLS_TEMPLATE({
        shortcut: JSPLib.shortcut,
    });
};

Menu.renderCacheInfoTable = function () {
    return CACHE_INFO_TABLE_TEMPLATE({
        shortcut: JSPLib.shortcut,
    });
};

Menu.renderLocalStorageSource = function () {
    return LOCAL_STORAGE_SOURCE_TEMPLATE({
        shortcut: JSPLib.shortcut,
    });
};

Menu.renderCacheEditor = function ({name = 'Cache editor', has_cache_data = false} = {}) {
    return CACHE_EDITOR_TEMPLATE({
        shortcut: JSPLib.shortcut,
        name,
        message: (has_cache_data ? CACHE_EDITOR_MESSAGE_TEMPLATE({shortcut: JSPLib.shortcut}) : ""),
    });
};

Menu.renderMenuFramework = function (menu_config) {
    return MENU_FRAMEWORK_TEMPLATE({
        name: JSPLib.name,
        shortcut: JSPLib.shortcut,
        settings: menu_config.settings.map((setting) => _renderMenuSection(setting, 'settings')).join('\n'),
        controls: menu_config.controls?.map((control) => _renderMenuSection(control, 'controls')).join('\n') ?? "",
        topic: (menu_config.topic_id ? MENU_TOPIC_MESSAGE_TEMPLATE({topic_id: menu_config.topic_id}) : ""),
        wiki: (menu_config.wiki_page ? MENU_WIKI_MESSAGE_TEMPLATE({wiki_page: menu_config.wiki_page}) : ""),
    });
};

//Menu auxiliary functions

Menu.engageUI = function ({checkboxradio = false, sortable = false} = {}) {
    if (checkboxradio) {
        jQueryProxy(`.${JSPLib.shortcut}-selectors input`).checkboxradio();
    }
    if (sortable) {
        jQueryProxy(`.${JSPLib.shortcut}-sortlist ul`).sortable();
    }
    jQueryProxy(".jsplib-selectors .ui-state-hover").removeClass('ui-state-hover');
};

//Settings auxiliary functions

Menu.isSettingsMenu = function () {
    return document.body.dataset.controller === "users" && document.body.dataset.action === "edit";
};

Menu.preloadMenu = function ({menu_func = null, menu_css = null} = {}) {
    const printer = Debug.getFunctionPrint('Menu.preloadMenu');
    if (Menu.isSettingsMenu() && typeof menu_func === 'function') {
        _loadStorageKeys();
        _checkDebugCSS().then(() => {
            printer.logLevel("Script is installed.", Debug.DEBUG);
            Menu.installSettingsMenu();
            menu_func();
        });
        if (menu_css) {
            Utility.setCSSStyle(menu_css, 'menu');
        }
    }
};

Menu.validateCheckboxRadio = function (data, type, items, {min_length = 0} = {}) {
    return Utility.isArray(data)
        && data.every((val) => Utility.isString(val))
        && Utility.isSubArray(items, data)
        && ((type !== 'radio' && data.length >= min_length) ||
            (type === 'radio' && data.length === 1));
};

Menu.validateNumber = function (data, {integer = false, min = -Infinity, max = Infinity} = {}) {
    const validator = (integer ? Utility.isInteger : Utility.isNumber);
    return validator(data) && data >= min && data <= max;
};

Menu.hasSettingChanged = function (setting_name) {
    return JSON.stringify(JSPLib.data.user_settings[setting_name]) !== JSON.stringify(JSPLib.data.old_settings[setting_name]);
};

//Menu control functions

Menu.saveUserSettingsClick = function ({local_callback = null} = {}) {
    jQueryProxy(`#${JSPLib.shortcut}-commit`).on(JSPLib.event.click, () => {
        const printer = Debug.getFunctionPrint('Menu.saveUserSettingsClick');
        let config = JSPLib.settings_config;
        let settings = JSPLib.data.user_settings;
        JSPLib.data.old_settings = Utility.deepCopy(settings);
        let invalid_setting = false;
        jQueryProxy(`#${JSPLib.shortcut}-settings .jsplib-setting-item[data-setting][data-type]`).each((_, entry) => {
            let $entry = jQueryProxy(entry);
            let {setting, type} = entry.dataset;
            var value;
            switch (type) {
                case 'text':
                    value = $entry.find('input').val();
                    break;
                case 'checkbox':
                    value = $entry.find('input').prop('checked');
                    break;
                case 'selector':
                    value = $entry.find('input').map((_, input) => (input.checked ? input.dataset.selector : undefined)).toArray();
                    break;
                case 'sortlist':
                    value = $entry.find('input').map((_, input) => input.dataset.sort).toArray();
                    // falls through
                default:
                    // do nothing
            }
            if (config[setting].parse) {
                value = config[setting].parse(value);
            }
            if (config[setting].validate(value)) {
                settings[setting] = value;
            } else {
                invalid_setting = true;
            }
        });
        printer.logLevel("Settings updated:", {new_settings: settings, old_settings: JSPLib.data.old_settings, invalid_setting}, Debug.VERBOSE);
        Storage.setLocalData(`${JSPLib.shortcut}-user-settings`, settings);
        CHANNEL.postMessage({type: 'settings', shortcut: JSPLib.shortcut, from: JSPLib.UID.value, user_settings: settings});
        if (!invalid_setting) {
            Notice.notice(`<b>${JSPLib.name}:</b> Settings updated!`);
        } else {
            Notice.error("<b>Error:</b> Some settings were invalid!");
            _updateUserSettings();
        }
        if (typeof local_callback === 'function') {
            local_callback();
        }
        let $domain_inputs = jQueryProxy(`#${JSPLib.shortcut}-settings .${JSPLib.shortcut}-global`);
        if ($domain_inputs.length) {
            let selected_domains = $domain_inputs.map((_, input) => (input.checked ? input.dataset.selector : undefined)).toArray();
            if (!Utility.arrayEquals(CURRENT_DOMAINS, selected_domains)) {
                if (Utility.arrayEquals(Menu.domains, selected_domains)) {
                    //Don't bother storing a cookie if all of the domains are active
                    Utility.eraseCookie(JSPLib.name, 'donmai.us');
                } else if (selected_domains.length === 0) {
                    Utility.createCookie(JSPLib.name, 'none', 365, 'donmai.us');
                } else {
                    Utility.createCookie(JSPLib.name, selected_domains.join(','), 365, 'donmai.us');
                }
                let enabled_domains = Utility.arrayDifference(selected_domains, CURRENT_DOMAINS);
                let disabled_domains = Utility.arrayDifference(CURRENT_DOMAINS, selected_domains);
                if (enabled_domains.length || disabled_domains.length) {
                    CHANNEL.postMessage({type: 'domain', shortcut: JSPLib.shortcut, from: JSPLib.UID.value, enabled_domains, disabled_domains, current_domains: selected_domains});
                }
                printer.logLevel("Domains updated:", {new_domains: selected_domains, old_domains: CURRENT_DOMAINS}, Debug.VERBOSE);
                CURRENT_DOMAINS = selected_domains;
            }
        }
    });
};

Menu.resetUserSettingsClick = function ({delete_keys = [], local_callback = null} = {}) {
    jQueryProxy(`#${JSPLib.shortcut}-resetall`).on(JSPLib.event.click, () => {
        let config = JSPLib.settings_config;
        let settings = JSPLib.data.user_settings;
        JSPLib.data.old_settings = Utility.deepCopy(settings);
        if (confirm(`This will reset all of ${JSPLib.name}'s settings.\n\nAre you sure?`)) {
            for (let setting in config) {
                settings[setting] = config[setting].reset;
            }
            _updateUserSettings();
            delete_keys.forEach((key) => {
                Storage.removeLocalData(key);
            });
            Utility.assignObjects(JSPLib.data, Utility.deepCopy(JSPLib.reset_data), {storage_keys: {local_storage: []}});
            Storage.setLocalData(`${JSPLib.shortcut}-user-settings`, settings);
            CHANNEL.postMessage({type: 'reset', shortcut: JSPLib.shortcut, from: JSPLib.UID.value, user_settings: settings});
            Notice.notice(`<b>${JSPLib.name}:</b> Settings reset to defaults!`);
            if (typeof local_callback === 'function') {
                local_callback();
            }
        }
    });
};

Menu.purgeCacheClick = function () {
    jQueryProxy(`#${JSPLib.shortcut}-control-purge-cache`).on(JSPLib.event.click, () => {
        if (!PURGE_IS_STARTED && confirm(`This will delete all of ${JSPLib.name}'s cached data.\n\nAre you sure?`)) {
            PURGE_IS_STARTED = true;
            Storage.purgeCache(JSPLib.data_regex).then(() => {
                PURGE_IS_STARTED = false;
            });
        }
    });
};

Menu.cacheInfoClick = function () {
    jQueryProxy(`#${JSPLib.shortcut}-control-cache-info`).on(JSPLib.event.click, () => {
        Notice.notice("Calculating cache information...");
        Storage.programCacheInfo(JSPLib.data_regex).then((cache_info) => {
            let template_data = {};
            for (let source in cache_info) {
                for (let key in cache_info[source]) {
                    template_data[source + '_' + key] = cache_info[source][key];
                }
            }
            jQueryProxy(`#${JSPLib.shortcut}-cache-info-table`).html(CACHE_INFO_TEMPLATE(template_data)).show();
        });
    });
};

Menu.expandableClick = function () {
    jQueryProxy(`.${JSPLib.shortcut}-expandable .jsplib-expandable-button`).on(JSPLib.event.click, (event) => {
        let $container = jQueryProxy(event.target).closest('.jsplib-expandable');
        let $button = $container.find('.jsplib-expandable-button');
        let new_value = ($button.attr('value') === "Show" ? "Hide" : "Show");
        $button.attr('value', new_value);
        $container.find('.jsplib-expandable-content').slideToggle(100);
    });
};

////Cache functions

Menu.dataSourceChange = function () {
    jQueryProxy(`#${JSPLib.shortcut}-control-data-source`).on(JSPLib.event.change, () => {
        let data_source = jQueryProxy(`#${JSPLib.shortcut}-control-data-source`).val();
        jQueryProxy(`.${JSPLib.shortcut}-section-data-source`).hide();
        let shown_key = `#${JSPLib.shortcut}-section-${Utility.kebabCase(data_source)}`;
        jQueryProxy(shown_key).show();
        let disable = data_source === 'local_storage';
        _adjustDataControls(disable);
    });
};

Menu.rawDataChange = function () {
    jQueryProxy(`#${JSPLib.shortcut}-enable-raw-data`).on(JSPLib.event.change, (event) => {
        RAW_DATA_CHECKED = event.target.checked;
        _adjustDataControls(RAW_DATA_CHECKED);
    });
};

Menu.getCacheClick = function () {
    jQueryProxy(`#${JSPLib.shortcut}-control-data-name-get`).on(JSPLib.event.click, () => {
        let storage_key = _getCacheDatakey();
        if (JSPLib.data.data_source === "local_storage") {
            let data = {};
            if (JSPLib.data.raw_data) {
                for (let key in localStorage) {
                    let match = key.match(JSPLib.regex);
                    if (!match) continue;
                    let save_key = match[1];
                    let temp_data = Storage.getLocalData(key);
                    if (Storage.localSessionValidator && !Storage.localSessionValidator(key, temp_data)) {
                        continue;
                    }
                    data[save_key] = Storage.getLocalData(key);
                }
            } else {
                data = Storage.getLocalData(storage_key);
            }
            jQueryProxy(`#${JSPLib.shortcut}-cache-viewer textarea`).val(JSON.stringify(data, null, 2));
        } else {
            Storage.retrieveData(storage_key, {bypass_cache: true}).then((data) => {
                jQueryProxy(`#${JSPLib.shortcut}-cache-viewer textarea`).val(JSON.stringify(data, null, 2));
            });
        }
        Validate.hideValidateError();
        jQueryProxy("#close-notice-link").click();
    });
};

Menu.saveCacheClick = function (localupdater) {
    jQueryProxy(`#${JSPLib.shortcut}-control-data-name-save`).on(JSPLib.event.click, () => {
        var data;
        try {
            data = JSON.parse(jQueryProxy(`#${JSPLib.shortcut}-cache-viewer textarea`).val());
        } catch (error) {
            Notice.error("Invalid JSON data! Unable to save.");
            return;
        }
        Validate.dom_output = `#${JSPLib.shortcut}-cache-editor-errors`;
        let storage_key = _getCacheDatakey();
        if (JSPLib.data.data_source === "local_storage") {
            if (JSPLib.data.raw_data) {
                let error_messages = [];
                let $cache_errors = jQueryProxy(`#${JSPLib.shortcut}-cache-editor-errors`);
                for (let key in data) {
                    let data_key = JSPLib.shortcut + '-' + key;
                    if (!_saveLocalData(data_key, data[key], localupdater)) {
                        error_messages.push('<div>' + $cache_errors.html() + '</div>');
                    }
                }
                if (error_messages.length) {
                    Notice.error("Some data was invalid! They were unable to be imported.");
                    $cache_errors.html(error_messages.join('<div>--------------------</div>'));
                } else {
                    Notice.notice("Data was imported.");
                    Validate.hideValidateError();
                }
            } else if (_saveLocalData(storage_key, data, localupdater)) {
                Notice.notice("Data was saved.");
                Validate.hideValidateError();
            } else {
                Notice.error("Data is invalid! Unable to save.");
            }
        } else {
            if (Storage.indexedDBValidator(storage_key, data)) {
                Storage.saveData(storage_key, data).then(() => {
                    Notice.notice("Data was saved.");
                    Validate.hideValidateError();
                });
            } else {
                Notice.error("Data is invalid! Unable to save.");
            }
        }
        Validate.dom_output = null;
    });
};

Menu.deleteCacheClick = function () {
    jQueryProxy(`#${JSPLib.shortcut}-control-data-name-delete`).on(JSPLib.event.click, () => {
        let storage_key = _getCacheDatakey();
        if (JSPLib.data.data_source === "local_storage") {
            localStorage.removeItem(storage_key);
            Notice.notice("Data has been deleted.");
            Validate.hideValidateError();
        } else {
            Storage.removeData(storage_key).then(() => {
                Notice.notice("Data has been deleted.");
                Validate.hideValidateError();
            });
        }
    });
};

Menu.listCacheClick = function () {
    jQueryProxy(`#${JSPLib.shortcut}-control-data-name-list`).on(JSPLib.event.click, () => {
        _getCacheDatakey();
        if (!STORAGE_KEYS_LOADED) {
            Notice.notice("Waiting for keys to load...");
        }
        STORAGE_KEYS_PROMISE.then(() => {
            let regex = new RegExp('^' + JSPLib.data.data_prefix);
            let valid_keys = JSPLib.data.storage_keys[JSPLib.data.data_source].filter((key) => key.startsWith(JSPLib.data.data_prefix)).map((key) => key.replace(regex, "")).toSorted();
            jQueryProxy(`#${JSPLib.shortcut}-cache-viewer textarea`).val(JSON.stringify(valid_keys, null, 2));
        });
    });
};

Menu.refreshCacheClick = function () {
    jQueryProxy(`#${JSPLib.shortcut}-control-data-name-refresh`).on(JSPLib.event.click, () => {
        _loadStorageKeys().then(() => {
            Notice.notice("Data names have been refreshed.");
        });
    });
};

//Cache autocomplete

Menu.cacheAutocomplete = function () {
    let $control_data = jQueryProxy(`#${JSPLib.shortcut}-control-data-name`);
    $control_data.autocomplete({
        minLength: 0,
        delay: 0,
        source: _cacheSource(),
    }).off('keydown.Autocomplete.tab');
    let autocomplete = $control_data.data('uiAutocomplete');
    autocomplete._renderItem = function (menu, item) {
        return jQueryProxy("<li>").append(jQueryProxy("<div>").text(item.label)).appendTo(menu);
    };
};

/****PRIVATE FUNCTIONS****/

function _saveMenuHotkey(event) {
    jQueryProxy('#userscript-menus .tab-panel.active-tab .jsplib-settings-buttons [id$="-commit"]').click();
    event.preventDefault();
}

function _checkDebugCSS() {
    if (Menu.css_debug_url !== null) {
        if (JSPLib.network && document.body.dataset.jsplibDebugCss !== 'true') {
            Utility.setDataAttribute(document.body, 'jsplib-debug-css', 'true');
            Storage.removeSessionData('jsplib-debug-css');
            return JSPLib.network.getNotify(Menu.css_debug_url, {custom_error: "Unable to load debug CSS."}).then((data) => {
                Storage.setSessionData('jsplib-debug-css', data);
                Utility.assignObjects(Menu, data);
            });
        }
        let p = Utility.createPromise();
        Utility.recheckInterval({
            check: () => document.body.dataset.jsplibDebugCss !== 'true' && Storage.getSessionData('jsplib-debug-css'),
            success: () => {
                Utility.assignObjects(Menu, Storage.getSessionData('jsplib-debug-css'));
            },
            always: () => {
                p.resolve(null);
            },
            interval: 100,
            duration: Utility.one_second * 5,
        });
        return p.promise;
    }
    return Promise.resolve(null);
}

function _renderSettingHint(type, text) {
    return SETTING_HINT_TEMPLATE({
        shortcut: JSPLib.shortcut,
        type,
        text,
    });
}

function _renderMenuSection(value, type) {
    return MENU_SECTION_TEMPLATE({
        shortcut: JSPLib.shortcut,
        type,
        key: Utility.kebabCase(value.name),
        name: Utility.displayCase(value.name),
        message: (value.message ? `<p>${value.message}</p>` : ""),
    });
}

function _getProgramValues(setting_name, is_control = false) {
    let config = (!is_control ? JSPLib.settings_config : Menu.control_config);
    let setting_key = Utility.kebabCase(setting_name);
    let display_name = (config[setting_name].display ? config[setting_name].display : Utility.displayCase(setting_name));
    let item = (!is_control ? JSPLib.data.user_settings[setting_name] : config[setting_name].value);
    return [config, setting_key, display_name, item];
}

function _getEnabledDomains() {
    const printer = Debug.getFunctionPrint('Menu.getEnabledDomains');
    if (CURRENT_DOMAINS !== null) {
        return CURRENT_DOMAINS;
    }
    let domains = Utility.readCookie(JSPLib.name);
    if (!domains) {
        CURRENT_DOMAINS = Menu.domains;
    } else if (domains === 'none') {
        CURRENT_DOMAINS = [];
    } else {
        let cookie_domains = domains.split(',');
        CURRENT_DOMAINS = Utility.arrayIntersection(Menu.domains, cookie_domains);
        if (CURRENT_DOMAINS.length === 0) {
            printer.logLevel("Invalid cookie found!", Debug.WARNING);
            Utility.eraseCookie(JSPLib.name, 'donmai.us');
            CURRENT_DOMAINS = Utility.deepCopy(Menu.domains);
        } else if (CURRENT_DOMAINS.length !== cookie_domains.length) {
            printer.logLevel("Invalid domains found on cookie!", Debug.WARNING);
            Utility.createCookie(JSPLib.name, CURRENT_DOMAINS.join(','), null, 'donmai.us');
        }
    }
    return CURRENT_DOMAINS;
}

function _updateUserSettings() {
    let settings = JSPLib.data.user_settings;
    jQueryProxy(`#${JSPLib.shortcut}-settings .jsplib-setting-item[data-setting][data-type]`).each((_, entry) => {
        let $entry = jQueryProxy(entry);
        let {setting, type} = entry.dataset;
        switch (type) {
            case 'text':
                $entry.find('input').val(settings[setting]);
                break;
            case 'checkbox':
                $entry.find('input').prop('checked', settings[setting]);
                break;
            case 'selector':
                $entry.find('input').each((_, input) => {
                    input.checked = settings[setting].includes(input.dataset.selector);
                    jQueryProxy(input).checkboxradio('refresh');
                });
                break;
            case 'sortlist':
                jQueryProxy("ul", entry).sortable("destroy");
                jQueryProxy("li", entry).detach().sort((a, b) => {
                    let sort_a = jQueryProxy("input", a).data('sort');
                    let sort_b = jQueryProxy("input", b).data('sort');
                    return settings[setting].indexOf(sort_a) - settings[setting].indexOf(sort_b);
                }).each((_, li) => {
                    jQueryProxy("ul", entry).append(li);
                });
                jQueryProxy("ul", entry).sortable();
                // falls through
            default:
                // do nothing
        }
    });
}

function _updateGlobalSettings() {
    let current_domains = _getEnabledDomains();
    jQueryProxy(`#${JSPLib.shortcut}-settings .jsplib-selectors[data-setting="domain_selector"] input`).each((_, entry) => {
        let $input = jQueryProxy(entry);
        let selector = $input.data('selector');
        $input.prop('checked', current_domains.includes(selector));
        $input.checkboxradio("refresh");
    });
}

async function _loadStorageKeys() {
    let storage_keys = JSPLib.data.storage_keys = {};
    if (JSPLib.data_regex !== null && typeof Storage.danboorustorage?.keys === 'function') {
        STORAGE_KEYS_PROMISE = Storage.danboorustorage.keys();
        let cache_keys = await STORAGE_KEYS_PROMISE;
        STORAGE_KEYS_LOADED = true;
        storage_keys.indexed_db = cache_keys.filter((key) => key.match(JSPLib.data_regex));
        let program_keys = cache_keys.filter((key) => key.match(JSPLib.regex));
        storage_keys.indexed_db = Utility.concat(program_keys, storage_keys.indexed_db);
    } else {
        STORAGE_KEYS_LOADED = true;
    }
    let keys = Object.keys(localStorage);
    storage_keys.local_storage = keys.filter((key) => key.match(JSPLib.regex));
}

function _getCacheDatakey() {
    JSPLib.data.data_source = jQueryProxy(`#${JSPLib.shortcut}-control-data-source`).val();
    JSPLib.data.data_type = jQueryProxy(`#${JSPLib.shortcut}-control-data-type`).val();
    JSPLib.data.data_value = jQueryProxy(`#${JSPLib.shortcut}-control-data-name`).val()?.trim();
    if (JSPLib.data.data_source === "local_storage") {
        JSPLib.data.raw_data = jQueryProxy(`#${JSPLib.shortcut}-enable-raw-data`).prop('checked');
        JSPLib.data.data_prefix = JSPLib.shortcut + '-';
    } else if (JSPLib.data.data_type !== "custom") {
        if (typeof Menu.data_key === "function") {
            JSPLib.data.data_prefix = Menu.data_key(JSPLib.data.data_type);
        } else if (typeof Menu.data_key === "object") {
            JSPLib.data.data_prefix = Menu.data_key[JSPLib.data.data_type] + '-';
        }
    } else {
        JSPLib.data.data_prefix = "";
    }
    return (JSPLib.data.data_value ? JSPLib.data.data_prefix + JSPLib.data.data_value.toLowerCase() : null);
}

function _saveLocalData(key, data, localupdater) {
    if (Storage.localSessionValidator(key, data)) {
        Storage.setLocalData(key, data);
        if (key === `${JSPLib.shortcut}-user-settings`) {
            JSPLib.data.user_settings = data;
            _updateUserSettings();
            CHANNEL.postMessage({type: 'settings', shortcut: JSPLib.shortcut, from: JSPLib.UID.value, user_settings: data});
        } else if (typeof localupdater === 'function') {
            localupdater(key, data);
        }
        return true;
    }
    return false;
}

function _adjustDataControls(disable = true) {
    ['delete', 'list', 'refresh'].forEach((name) => {
        jQueryProxy(`#${JSPLib.shortcut}-control-data-name-${name}`).prop('disabled', disable && RAW_DATA_CHECKED);
    });
    jQueryProxy(`#${JSPLib.shortcut}-control-data-name`).prop('disabled', disable && RAW_DATA_CHECKED);
    if (disable && RAW_DATA_CHECKED) {
        jQueryProxy(`#${JSPLib.shortcut}-control-data-name`).val("");
    }
}

function _cacheSource() {
    return function (_, resp) {
        let check_key = _getCacheDatakey();
        if (JSPLib.data.data_value.length === 0 || !STORAGE_KEYS_LOADED) {
            resp([]);
            return;
        }
        let source_keys = JSPLib.data.storage_keys[JSPLib.data.data_source];
        let available_keys = source_keys.filter((key) => key.toLowerCase().startsWith(check_key));
        let transformed_keys = available_keys.slice(0, 10);
        if (JSPLib.data.data_source === 'local_storage') {
            transformed_keys = _keyToNameTransform(transformed_keys, JSPLib.shortcut);
        } else if (JSPLib.data.data_type !== "custom") {
            let program_keys = transformed_keys.filter((key) => key.match(JSPLib.regex));
            let program_names = _keyToNameTransform(program_keys, JSPLib.shortcut);
            let cache_keys = Utility.arrayDifference(transformed_keys, program_keys);
            let cache_names = cache_keys.map((key) => key.replace(JSPLib.data_regex, ''));
            transformed_keys = Utility.concat(program_names, cache_names).sort();
        }
        resp(transformed_keys);
    };
}

function _keyToNameTransform(keylist, prefix) {
    return keylist.map((key) => key.replace(RegExp('^' + prefix + '-'), ''));
}

function _broadcastRX() {
    const printer = Debug.getFunctionPrint('Menu.broadcastRX');
    return function (event) {
        if (event.data.shortcut !== JSPLib.shortcut) {
            return;
        }
        printer.logLevel(`(${event.data.type}):`, event.data, Debug.INFO);
        switch (event.data.type) {
            case 'domain':
                _broadcastDomain(event);
                break;
            case 'reset':
                _broadcastReset(event);
                break;
            case 'settings':
                _broadcastSettings(event);
                //falls through
            default:
                //do nothing
        }
    };
}

function _broadcastDomain(event) {
    CURRENT_DOMAINS = event.data.current_domains;
    if (event.data.enabled_domains.includes(JSPLib._current_subdomain)) {
        if (typeof Menu.enable_callback === 'function') {
            Menu.enable_callback();
        }
    }
    if (event.data.disabled_domains.includes(JSPLib._current_subdomain)) {
        if (typeof Menu.disable_callback === 'function') {
            Menu.disable_callback();
        }
    }
    if (Menu.isSettingsMenu()) {
        _updateGlobalSettings();
    }
}

function _broadcastReset(event) {
    Utility.assignObjects(JSPLib.data, Utility.deepCopy(JSPLib.reset_data));
    _loadStorageKeys();
    _updateSettingsFromBroadcast(event.data.user_settings);
    if (typeof Menu.reset_callback === 'function') {
        Menu.reset_callback();
    }
}

function _broadcastSettings(event) {
    _updateSettingsFromBroadcast(event.data.user_settings);
    if (typeof Menu.settings_callback === 'function') {
        Menu.settings_callback();
    }
}

function _updateSettingsFromBroadcast(new_settings) {
    JSPLib.data.old_settings = JSPLib.data.user_settings;
    JSPLib.data.user_settings = new_settings;
    if (Menu.isSettingsMenu()) {
        _updateUserSettings();
    }
}

/****INITIALIZATION****/

const CHANNEL = Utility.createBroadcastChannel('JSPLib.menu', _broadcastRX());

JSPLib.writeOnceReadMany(Menu, 'control_config', {});

Object.defineProperties(Menu, {
    program_selector: {get: () => '#' + JSPLib.id}
});

JSPLib.initializeModule('Menu', 'domains');

})(JSPLib);
