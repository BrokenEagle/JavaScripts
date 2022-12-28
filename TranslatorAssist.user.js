// ==UserScript==
// @name         TranslatorAssist
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      6.0
// @description  Provide information and tools for help with translations.
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        https://*.donmai.us/posts/*
// @match        https://*.donmai.us/settings
// @exclude      /^https?://\w+\.donmai\.us/.*\.(xml|json|atom)(\?|$)/
// @grant        GM.xmlHttpRequest
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/TranslatorAssist.user.js
// @updateURL    https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/TranslatorAssist.user.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/module.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/menu.js
// @connect      validator.nu
// ==/UserScript==

/* global $ JSPLib Danbooru */

/****Global variables****/

//Library constants

////NONE

//Exterior script variables
const DANBOORU_TOPIC_ID = '20687';
const GITHUB_WIKI_PAGE = 'https://github.com/BrokenEagle/JavaScripts/wiki/TranslatorAssist';

//Variables for load.js
const PROGRAM_LOAD_REQUIRED_VARIABLES = ['window.jQuery', 'window.Danbooru', 'Danbooru.CurrentUser', 'Danbooru.Note'];
const PROGRAM_LOAD_OPTIONAL_SELECTORS = ['#c-posts #a-show .image-container', '#c-users #a-edit'];

//Program name constants
const PROGRAM_SHORTCUT = 'ta';
const PROGRAM_CLICK = 'click.ta';
const PROGRAM_KEYDOWN = 'keydown.ta';
const PROGRAM_KEYUP = 'keyup.ta';
const PROGRAM_NAME = 'TranslatorAssist';

//Main program variable
const TA = {};

const DEFAULT_VALUES = {
    initialized: false,
    close_notice_shown: false,
    last_noter_queried: false,
    side_menu_open: false,
    noter_detected: false,
    missed_poll: false,
    last_id: 0,
    save_data: null,
    shadow_grid: {},
    $load_dialog: {},
};

//Available setting values
const HTML_STYLE_TAGS = ['div', 'span'];
const HTML_ONLY_TAGS = ['b', 'i', 'u', 's', 'tn', 'small', 'big', 'code', 'center', 'p'];
const HTML_TAGS = JSPLib.utility.concat(HTML_STYLE_TAGS, HTML_ONLY_TAGS);
const HTML_STYLES = ['color', 'font-size', 'font-family', 'font-weight', 'font-style', 'font-variant', 'text-align', 'text-decoration', 'line-height', 'letter-spacing', 'margin', 'padding', 'white-space', 'background-color', 'transform'];
const OUTER_RUBY_STYLES = ['color', 'font-size', 'font-family', 'font-weight', 'font-style', 'font-variant', 'text-decoration', 'line-height', 'letter-spacing', 'padding', 'white-space', 'background-color'];
const INNER_RUBY_STYLES = ['color', 'font-size', 'font-family', 'font-weight', 'font-style', 'font-variant', 'text-decoration', 'letter-spacing'];
const RUBY_STYLES = OUTER_RUBY_STYLES;
const EMBEDDED_STYLES = ['border-radius', 'rotate', 'background-color', 'justify-content', 'align-items'];

//Main settings
const SETTINGS_CONFIG = {
    close_notice_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Show a notice when closing the side menu."
    },
    check_last_noted_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Show a notice when navigating to a post if the post has been noted within a cutoff period."
    },
    last_noted_cutoff: {
        reset: 15,
        parse: parseInt,
        validate: (data) => (Number.isInteger(data) && data > 0),
        hint: "Number of minutes used as a cutoff when determining whether to show the last noted notice (greater than 0)."
    },
    query_last_noter_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Query for the last noter when opening the side menu."
    },
    last_noter_cache_time: {
        reset: 5,
        parse: parseInt,
        validate: (data) => (Number.isInteger(data) && data >= 0),
        hint: "Number of minutes to cache the query last noter data (greater than 0; setting to zero disables caching)."
    },
    filter_last_noter_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Filter out self edits when checking for the last noter."
    },
    new_noter_check_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Poll for new noters when the side menu is open."
    },
    new_noter_check_interval: {
        reset: 5,
        parse: parseInt,
        validate: (data) => (Number.isInteger(data) && data > 0),
        hint: "How often to check for new noters (# of minutes)."
    },
    available_html_tags: {
        allitems: HTML_TAGS,
        reset: HTML_TAGS,
        display: "Available HTML tags",
        validate: (data) => (JSPLib.menu.validateCheckboxRadio(data, 'checkbox', HTML_TAGS) && data.length > 0),
        hint: "Select the list of available HTML tags to be shown. Must have at least one."
    },
    available_css_styles: {
        allitems: HTML_STYLES,
        reset: HTML_STYLES,
        display: "Available CSS styles",
        validate: (data) => (JSPLib.menu.validateCheckboxRadio(data, 'checkbox', HTML_STYLES) && data.length > 0),
        hint: "Select the list of available HTML styles to be shown. Must have at least one."
    },
    text_shadow_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Uncheck to removed text shadow section."
    },
    ruby_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Uncheck to removed ruby section."
    },
    available_ruby_styles: {
        allitems: RUBY_STYLES,
        reset: RUBY_STYLES,
        validate: (data) => (JSPLib.menu.validateCheckboxRadio(data, 'checkbox', RUBY_STYLES) && data.length > 0),
        hint: "Select the list of available ruby styles to be shown. Must have at least one."
    },
    embedded_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Uncheck to removed embedded tab."
    },
    available_embedded_styles: {
        allitems: EMBEDDED_STYLES,
        reset: EMBEDDED_STYLES,
        validate: (data) => (JSPLib.menu.validateCheckboxRadio(data, 'checkbox', EMBEDDED_STYLES) && data.length > 0),
        hint: "Select the list of available embedded styles to be shown. Must have at least one."
    },
    controls_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Uncheck to removed controls tab."
    },
    codes_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Uncheck to removed codes tab."
    },
};

const MENU_CONFIG = {
    topic_id: DANBOORU_TOPIC_ID,
    wiki_page: GITHUB_WIKI_PAGE,
    settings: [{
        name: 'general',
    }, {
        name: 'last_noted',
    }, {
        name: 'main',
    }, {
        name: 'constructs',
    }, {
        name: 'embedded',
    }, {
        name: 'controls',
    }, {
        name: 'codes',
    }],
    controls: [],
};

//CSS constants

const PROGRAM_CSS = `
/** General **/
.ta-header {
    font-size: 1.4em;
    font-weight: bold;
    margin-bottom: 0.5em;
}
.ta-subheader {
    font-size: 1.2em;
    font-weight: bold;
}
.ta-text-input label {
    font-weight: bold;
    display: inline-block;
    width: 10em;
}
.ta-text-input input {
    width: 10em;
    height: 1.75em;
}
.ta-button-svg {
    position: relative;
}
.ta-button-svg img {
    position: absolute;
}
.ta-menu-tab {
    border: 1px solid #888;
    border-radius: 0.7em 0.7em 0 0;
    background: var(--subnav-menu-background-color);
    padding: 0.5em;
    margin: 0 -0.2em;
    display: inline-block;
}
.ta-menu-tab.ta-active {
    color: white;
    background: blue;
    text-shadow: 1px 0px 0px;
}
/** Side menu **/
#ta-side-menu {
    position: fixed;
    top: clamp(1rem, 100vh - 54.5rem, 8rem);
    left: 0.7em;
    width: 20.6em;
    height: auto;
    z-index: 100;
    background: var(--body-background-color);
}
#ta-side-menu > div {
    position: relative;
    border: 1px solid var(--text-color);
    padding: 0.35em;
}
#ta-side-menu #ta-side-menu-header {
    font-size: 1.4em;
    font-weight: bold;
    text-decoration: underline;
    margin-bottom: 0.75em;
    letter-spacing: -1px;
    transform: scaleX(0.95);
    margin-left: -0.4em;
    margin-bottom: 4.5em;
}
#ta-side-menu #ta-side-menu-text {
    position: absolute;
    top: 3.3em;
    font-size: 0.85em;
    border: 1px dashed #DDD;
    padding: 0.35em;
    min-height: 5em;
    line-height: 1.4em;
    width: 23em;
}
#ta-side-menu #ta-embedded-status-text {
    font-weight: bold;
    font-variant: small-caps;
}
#ta-side-menu .ta-control-button {
    position: absolute;
    top: 0.25em;
    padding: 0.25em;
    font-weight: bold;
    font-size: 1em;
}
#ta-side-menu #ta-side-menu-close {
    right: 0.25em;
}
#ta-side-menu #ta-side-menu-reset {
    right: 4em;
}
#ta-side-menu #ta-size-controls {
    position: absolute;
    top: 2.75em;
    right: 0.5em;
    padding: 0.25em 0.75em;
    background: #f0f0f0;
}
#ta-side-menu #ta-size-controls img {
    width: 1.5em;
}
#ta-side-menu #ta-side-menu-tabs {
    letter-spacing: -1px;
    border-bottom: 1px solid #F0F0F0;
}
#ta-side-menu button {
    font-weight: bold;
}
/** Sections **/
#ta-sections > div {
    font-size: 0.85em;
    padding: 0.35em;
}
#ta-sections .ta-subsection {
    padding-left: 0.5em;
    margin-bottom: 1em;
    display: inline-block;
}
#ta-sections button {
    font-size: 1em;
    padding: 0.5em 0.9em;
}
#ta-sections hr {
    border: 1px solid var(--default-border-color);
}
/**** Main section ****/
/****** Block subsection ******/
button.ta-html-style-tag {
    background-color: cadetblue;
    border-color: darkcyan;
    color: white;
}
button.ta-html-style-tag:hover {
    background-color: cadetblue;
    filter: brightness(1.25);
}
/****** Styles subsection ******/
#ta-main-styles-subsection .ta-text-input {
    line-height: 1em;
}
/**** Constructs section ****/
/****** Text shadow subsection ******/
#ta-constructs-text-shadow-subsection #ta-text-shadow-attribs {
    margin-left: 1em;
}
#ta-constructs-text-shadow-subsection #ta-text-shadow-attribs .ta-text-input label {
    font-size: 1.2em;
    width: 6em;
}
#ta-constructs-text-shadow-subsection #ta-text-shadow-attribs .ta-text-input input {
    width: 10em;
    height: 1.75em;
}
#ta-constructs-text-shadow-subsection #ta-text-shadow-grid-controls {
    display: flex;
}
#ta-constructs-text-shadow-subsection #ta-text-shadow-controls {
    margin: 1em 1em 0 0
}
#ta-constructs-text-shadow-subsection #ta-text-shadow-controls a {
    display: block;
    font-size: 1.5em;
    padding: 0.2em;
}
#ta-constructs-text-shadow-subsection #ta-text-shadow-grid {
    border: 1px solid #CCC;
    margin-top: 1em;
}
#ta-constructs-text-shadow-subsection #ta-text-shadow-grid .ta-grid-item {
    position: absolute;
    width: 2em;
    height: 2em;
}
#ta-constructs-text-shadow-subsection #ta-text-shadow-options {
    margin-top: 1em;
}
#ta-constructs-text-shadow-subsection #ta-text-shadow-options label {
    font-size: 1.35em;
    font-weight: bold;
    padding-right: 1em;
}
/****** Ruby subsection ******/
#ta-constructs-ruby-subsection ruby {
    font-size: 1.5em;
    border: 1px solid var(--form-button-border-color);
    padding: 0.6em 0.2em 0.1em;
}
#ta-constructs-ruby-subsection #ta-ruby-text {
    margin: 0.25em 3em 1em 1em;
    padding: 2em 1em 1em;
    background-color: var(--subnav-background-color);
    border: 1px solid var(--footer-border-color);
}
#ta-constructs-ruby-subsection #ta-ruby-dialog-open {
    width: 90%;
    font-size: 1.25em;
    font-weight: bold;
    letter-spacing: 0.1em;
}
/**** Embedded section ****/
#ta-section-embedded #ta-embedded-mode {
    font-size: 1.2em;
    padding: 5px;
    border: 4px dashed var(--default-border-color);
    margin: 1em;
    width: 15.5em;
    box-shadow: 0 0 0 4px var(--subnav-menu-background-color);
    background: var(--subnav-menu-background-color);
}
/****** Embedded block subsection ******/
#ta-embedded-block-subsection {
    font-size: 1.2em;
}
#ta-embedded-block-subsection button {
    font-weight: bold;
}
#ta-embedded-block-subsection #ta-embedded-actions {
    margin-bottom: 1em;
    padding-left: 0.35em;
}
#ta-embedded-block-subsection #ta-embedded-level {
    margin-bottom: 1em;
    padding-left: 0.35em;
}
#ta-embedded-block-subsection #ta-embedded-level label {
    font-weight: bold;
    margin-right: 1em;
}
#ta-embedded-block-subsection #ta-embedded-level-select {
    padding: 0 1em;
}
/**** Controls section ****/
#ta-section-controls button {
    margin: 4px;
    display: inline-block;
    vertical-align: top;
}
#ta-section-controls button img {
    width: 2em;
}
/****** Placement subsection ******/
#ta-controls-placement-subsection #ta-placement-controls {
    padding-left: 0.5em;
    width: 16em;
}
#ta-controls-placement-subsection #ta-placement-controls button {
    width: 4em;
    height: 4em;
}
#ta-controls-placement-subsection #ta-placement-controls button div {
    font-size: 2em;
}
#ta-controls-placement-subsection #ta-placement-info {
    border: 1px solid var(--footer-border-color);
    padding: 5px 5px 0 5px;
}
#ta-controls-placement-subsection #ta-placement-info > div:not(:nth-last-child(1)) {
    padding-bottom: 0.6em;
}
#ta-controls-placement-subsection #ta-placement-info span {
    font-size: 0.8em;
}
/****** Actions subsection ******/
#ta-controls-actions-subsection button {
    font-weight: bold;
    width: 5.15em;
    font-size: 1.2em;
    padding: 0.5em 0em;
}
/**** Codes section ****/
#ta-section-codes button {
    font-size: 1.25em;
    font-weight: bold;
    width: 3.03em;
    padding: 0.28em;
    margin: 2px;
}
/****** HTML characters subsection ******/
#ta-section-codes #ta-codes-html-subsection button {
    width: 2.55em;
}
/****** Special characters subsection ******/
#ta-section-codes #ta-codes-special-subsection button {
    font-size: 1.5em;
    width: 2.13em;
    height: 2.13em;
}
/** Menu options **/
#ta-menu-options {
    margin-bottom: 1em;
}
#ta-menu-options > div {
    display: inline-block;
    position: relative;
    width: 9em;
    height: 1em;
}
#ta-menu-options label {
    font-weight: bold;
    position: absolute;
}
#ta-menu-options input {
    position: absolute;
}
#ta-css-style-overwrite {
    left: 7em;
    top: 0.15em;
}
#ta-css-style-initialize {
    left: 7em;
    top: 0.15em;
}
/** Menu controls **/
#ta-menu-controls button {
    font-size: 0.9em;
    padding: 0.25em 1em;
    margin: 0.1em;
}
/** Ruby dialog **/
#ta-ruby-dialog {
    display: flex;
}
#ta-ruby-styles {
    margin-right: 2em;
}
#ta-ruby-dialog-tabs {
    border-bottom: 1px solid #DDD;
    margin-bottom: 0.5em;
}
#ta-ruby-editor {
    width: 55%;
}
#ta-ruby-editor > div:not(:nth-last-child(1)) {
    margin-bottom: 0.6em;
}
#ta-ruby-editor .ta-ruby-textarea textarea {
    height: 7em;
}
/** Load dialog **/
.ta-load-message ul {
    font-size: 90%;
    list-style: disc;
}
.ta-load-saved-controls {
    margin-bottom: 1em;
}
.ta-load-sessions {
    height: 26em;
    border: 1px solid #DDD;
    overflow-y: auto;
    overflow-x: hidden;
}
.ta-load-sessions ul {
    margin: 0 !important;
}
.ta-load-sessions li {
    white-space: nowrap;
}
.ta-load-sessions label {
    padding: 5px;
}
.ta-load-session-item {
    padding: 5px;
    display: inline-block;
}
/** Post options **/
#ta-side-menu-open {
    color: green;
}
/** Cursor **/
#ta-side-menu button[disabled],
#ta-ruby-dialog ~ div button[disabled] {
    cursor: default;
}
#ta-side-menu *:not(a, button, input, select) {
    cursor: move;
}
#ta-side-menu .ta-cursor-initial,
#ta-side-menu .ta-cursor-initial *:not(a, button) {
    cursor: initial;
}
#ta-side-menu .ta-cursor-text,
#ta-side-menu .ta-cursor-text * {
    cursor: text;
}
#ta-side-menu .ta-cursor-pointer,
#ta-side-menu .ta-cursor-pointer *,
#ta-side-menu button {
    cursor: pointer;
}
/** Focus **/
#ta-main-blocks-subsection button:focus-visible,
#ta-main-styles-subsection input:focus-visible,
#ta-text-shadow-attribs input:focus-visible,
#ta-embedded-style-subsection input:focus-visible,
#ta-ruby-dialog input:focus-visible {
    position: relative; /* Hack so that the focus border isn't clobbered by neighbors (e.g. on Firefox) */
}`;

const MENU_CSS = `
.jsplib-selectors.ta-selectors:not([data-setting="available_html_tags"], [data-setting="domain_selector"]) label {
    width: 165px;
}`;

//HTML constants

const EXPAND_LR_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="15" viewBox="0 0 22 16"><path d="M17 0v3h-5v4h5v3l5-5-5-5zM5 10V7h5V3H5V0L0 5l5 5z"></path></svg>';
const EXPAND_TB_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="15" viewBox="0 0 22 16" transform="rotate(90)"><path d="M17 0v3h-5v4h5v3l5-5-5-5zM5 10V7h5V3H5V0L0 5l5 5z"></path></svg>';
const CONTRACT_LR_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="15" viewBox="0 0 22 16"><path d="M22 3h-5V0l-5 5 5 5V7h5V3zM0 7h5v3l5-5-5-5v3H0v4z"/></svg>';
const CONTRACT_TB_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="15" viewBox="0 0 22 16" transform="rotate(90)"><path d="M22 3h-5V0l-5 5 5 5V7h5V3zM0 7h5v3l5-5-5-5v3H0v4z"/></svg>';
const PLUS_SIGN = `
<svg xmlns="http://www.w3.org/2000/svg"  width="15" height="15" viewBox="-20 -40 240 240">
    <path d="M75,0 V75 H0 V125 H75 V200 H125 V125 H200 V75 H125 V0 H75 z" fill="#080" />
</svg>`;
const MINUS_SIGN = `
<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="-20 -40 240 240">
    <path d="M 0,75 L 0,125 L 200,125 L 200,75 L 0,75 z" fill="#F00" />
</svg>`;

const SIDE_MENU = `
<div id="ta-side-menu" style="display: none;">
    <div>
        <div id="ta-side-menu-header">Translator Assist</div>
        <div id="ta-side-menu-text" class="ta-cursor-text"></div>
        <div id="ta-side-menu-tabs">
            <a href="javascript:void(0)" class="ta-menu-tab ta-cursor-pointer ta-active" data-value="main" style="letter-spacing: 1px;">Main</a>
            <a href="javascript:void(0)" class="ta-menu-tab ta-cursor-pointer" data-value="constructs" style="display: none;">Construct</a>
            <a href="javascript:void(0)" class="ta-menu-tab ta-cursor-pointer" data-value="embedded" style="display: none;">Embed</a>
            <a href="javascript:void(0)" class="ta-menu-tab ta-cursor-pointer" data-value="controls" style="display: none;">Control</a>
            <a href="javascript:void(0)" class="ta-menu-tab ta-cursor-pointer" data-value="codes" style="display: none;">&hearts;</a>
        </div>
        <div id="ta-sections">
            <div id="ta-section-main">
                <div class="ta-header ta-cursor-text">Blocks:</div>
                <div id="ta-main-blocks-subsection" class="ta-subsection ta-cursor-initial">%BLOCKHTML%</div>
                <div class="ta-header ta-cursor-text">Styles:</div>
                <div id="ta-main-styles-subsection" class="ta-subsection ta-cursor-initial">%BLOCKCSS%</div>
                <div class="ta-header ta-cursor-text">Actions:</div>
                <div id="ta-main-actions-subsection" class="ta-subsection ta-cursor-initial">
                    <button id="ta-delete-block" title="Delete HTML tag">Delete</button>
                    <button id="ta-undo-action" title="Undo the last action">Undo</button>
                    <button id="ta-redo-action" title="Redo the last action">Redo</button>
                </div>
                <div class="ta-header ta-cursor-text">Process:</div>
                <div id="ta-main-process-subsection" class="ta-subsection ta-cursor-initial">
                    <button id="ta-normalize-note" title="Fix missing HTML tags">Fix</button>
                    <button id="ta-sanitize-note" title="Have Danbooru render HTML">Sanitize</button>
                    <button id="ta-validate-note" title="Validate HTML contents">Validate</button>
                </div>
                <hr>
            </div>
            <div id="ta-section-constructs" style="display: none;">%CONSTRUCTSTAB%</div>
            <div id="ta-section-embedded" style="display: none;">%EMBEDDEDTAB%</div>
            <div id="ta-section-controls" style="display: none;">%CONTROLSTAB%</div>
            <div id="ta-section-codes" style="display: none;">%CODESTAB%</div>
        </div>
        <div id="ta-menu-options" class="ta-cursor-initial">%CSSOPTIONS%</div>
        <div id="ta-menu-controls">
            <button id="ta-side-menu-load" title="Load custom values">Load</button>
            <button id="ta-side-menu-clear" title="Clear the inputs">Clear</button>
            <button id="ta-side-menu-copy" title="Copy styles from HTML tag to inputs">Copy</button>
            <button id="ta-side-menu-apply" title="Apply styles from inputs to HTML tag">Apply</button>
        </div>
        <div id="ta-size-controls" class="ta-cursor-pointer">
            <a data-add="1" title="Increase the size of the menu"><img src="data:image/svg+xml,${JSPLib.utility.fullEncodeURIComponent(PLUS_SIGN)}"></a>&nbsp;&nbsp;
            <a data-add="-1" title="Decrease the size of the menu"><img src="data:image/svg+xml,${JSPLib.utility.fullEncodeURIComponent(MINUS_SIGN)}"></a>
        </div>
        <button id="ta-side-menu-reset" class="ta-control-button" title="Reset the side menu size/position (Hotkey: alt+r)">Reset</button>
        <button id="ta-side-menu-close" class="ta-control-button" title="Close the side menu (Hotkey: alt+t)">Close</button>
    </div>
</div>`;

const TEXT_SHADOW_SUBSECTION = `
<div class="ta-header ta-cursor-text">Text shadow:</div>
<div id="ta-constructs-text-shadow-subsection" class="ta-subsection ta-cursor-initial">
    <div id="ta-text-shadow-attribs">%SHADOWCSS%</div>
    <div id="ta-text-shadow-grid-controls">
        <div id="ta-text-shadow-controls">
            <a class="ta-cursor-pointer" href="javascript:void(0)" data-value="all">All</a>
            <a class="ta-cursor-pointer" href="javascript:void(0)" data-value="sides">Sides</a>
            <a class="ta-cursor-pointer" href="javascript:void(0)" data-value="corners">Corners</a>
            <a class="ta-cursor-pointer" href="javascript:void(0)" data-value="none">None</a>
        </div>
        <div id="ta-text-shadow-grid">%SHADOWGRID%</div>
    </div>
    <div id="ta-text-shadow-options">%SHADOWOPTIONS%</div>
</div>`;

const RUBY_SUBSECTION = `
<div class="ta-header ta-cursor-text">Ruby:</div>
<div id="ta-constructs-ruby-subsection" class="ta-subsection ta-cursor-initial">
    <div id="ta-ruby-text" class="ta-cursor-text">
        <b><i>I.e. =&gt;</i></b> <ruby><rb>bottom&ensp;</rb><rt>top</rt><rb>text</rb><rt>text</rt></ruby>
    </div>
    <button id="ta-ruby-dialog-open">Open Ruby Editor</button>
</div>`;

const EMBEDDED_SECTION = `
<div id="ta-embedded-mode" class="ta-cursor-text">
    <span style="font-size: 1.1em; font-weight: bold;">Change mode:</span>
    (&thinsp;<a id="ta-toggle-embedded-mode" class="ta-cursor-pointer" href="javascript:void(0)">toggle</a>&thinsp;)
</div>
<div id="ta-side-embedded-sections" style="display: none;">
    <div class="ta-header ta-cursor-text">Embedded Block:</div>
    <div id="ta-embedded-block-subsection" class="ta-subsection ta-cursor-initial">
        <div id="ta-embedded-actions">
            <button id="ta-add-embedded-element" title="Adds embedded control element">Add</button>
            <button id="ta-remove-embedded-element" title="Removes embedded control element">Remove</button>
            <button id="ta-set-embedded-level" title="Sets the stacking level, where higher levels will appear over lower levels (default is 0)">Set level</button>
        </div>
        <div id="ta-embedded-level">
            <label>Level</label>
            <select id="ta-embedded-level-select">
                <option value="" selected="selected"></option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
            </select>
        </div>
    </div>
    <div class="ta-header ta-cursor-text">Embedded Styles:</div>
    <div id="ta-embedded-style-subsection" class="ta-subsection ta-cursor-initial">%EMBEDDEDCSS%</div>
</div>
<hr>`;

const CONTROLS_SECTION = `
<div class="ta-header ta-cursor-text">Placement:</div>
<div id="ta-controls-placement-subsection" style="display: flex;" class="ta-subsection ta-cursor-initial">
    <div id="ta-placement-controls">
        <button class="ta-button-placement ta-button-svg" data-action="expand-width" title="Expand width">
            <img style="top: 0.75em; left: 1em;" src="data:image/svg+xml,${JSPLib.utility.fullEncodeURIComponent(EXPAND_LR_SVG)}">
        </button>
        <button class="ta-button-placement" data-action="move-up" title="Move up">
            <div style="transform: rotate(270deg);">➜</div>
        </button>
        <button class="ta-button-placement ta-button-svg" data-action="expand-height" title="Expand height">
            <img style="top: 0.5em; left: 0.75em;" src="data:image/svg+xml,${JSPLib.utility.fullEncodeURIComponent(EXPAND_TB_SVG)}">
        </button>
        <button class="ta-button-placement move-left" data-action="move-left" title="Move left">
            <div style="transform: rotate(180deg);">➜</div>
        </button>
        <button id="ta-get-placement" title="Get coordinate and size info">
            <div style="font-size: 1.5em;font-weight: bold; margin-left: -0.2em;">Get</div>
        </button>
        <button class="ta-button-placement" data-action="move-right" title="Move right">
            <div>➜</div>
        </button>
        <button class="ta-button-placement ta-button-svg" data-action="contract-width" title="Contract width">
            <img style="top: 0.75em; left: 1em;" src="data:image/svg+xml,${JSPLib.utility.fullEncodeURIComponent(CONTRACT_LR_SVG)}">
        </button>
        <button class="ta-button-placement" data-action="move-down" title="Move down">
            <div style="transform: rotate(90deg);">➜</div>
        </button>
        <button class="ta-button-placement ta-button-svg" data-action="contract-height" title="Contract height">
            <img style="top: 0.5em; left: 0.75em;" src="data:image/svg+xml,${JSPLib.utility.fullEncodeURIComponent(CONTRACT_TB_SVG)}">
        </button>
    </div>
    <div id="ta-placement-info">
        <div>
            <b>X:</b><br>
            &nbsp;<span id="ta-placement-info-x">N/A</span>
        </div>
        <div>
            <b>Y:</b><br>
            &nbsp;<span id="ta-placement-info-y">N/A</span>
        </div>
        <div>
            <b>Width:</b><br>
            &nbsp;<span id="ta-placement-info-w">N/A</span>
        </div>
        <div>
            <b>Height:</b><br>
            &nbsp;<span id="ta-placement-info-h">N/A</span>
        </div>
    </div>
</div>
<div class="ta-header ta-cursor-text">Actions:</div>
<div id="ta-controls-actions-subsection" class="ta-subsection ta-cursor-initial">
    <button id="ta-save-note" title="Save current note">Save</button>
    <button id="ta-edit-note" title="Open edit dialog of current note">Edit</button>
    <button id="ta-delete-note" title="Delete current note">Delete</button>
    <button id="ta-reset-note" title="Reset current note to info on server">Reset</button>
    <button id="ta-show-note" title="Show current note">Show</button>
    <button id="ta-hide-note" title="Hide current note">Hide</button>
    <button id="ta-next-note" title="Select next note">Next</button>
    <button id="ta-previous-note" title="Select previous note">Previous</button>
    <button id="ta-unselect-note" title="Unselect current note" style="letter-spacing: -1px;">Unselect</button>
    <button id="ta-copy-note" title="Copy the current note">Copy</button>
</div>`;

const CODES_SUBSECTION = `
<div class="ta-header ta-cursor-text">HTML characters:</div>
<div id="ta-codes-html-subsection" class="ta-subsection ta-cursor-initial">%HTMLCHARS%</div>
<div class="ta-header ta-cursor-text">Special characters:</div>
<div id="ta-codes-special-subsection" class="ta-subsection ta-cursor-initial">%SPECIALCHARS%</div>
<div class="ta-header ta-cursor-text">Dash characters:</div>
<div id="ta-codes-dash-subsection" class="ta-subsection ta-cursor-initial">%DASHCHARS%</div>
<div class="ta-header ta-cursor-text">Space characters:</div>
<div id="ta-codes-space-subsection" class="ta-subsection ta-cursor-initial">%SPACECHARS%</div>`;

const NOTICE_INFO = `
<b>Last noted:</b> %LASTUPDATED%<br>&emsp;by %LASTUPDATER%<br>
<b>Total notes:</b> %TOTALNOTES%&nbsp;&nbsp;
<b>Embedded:</b> <span id="ta-embedded-status-text" style="color: %EMBEDDEDCOLOR%;">%EMBEDDEDSTATUS%</span>`;

const MENU_OPTION = `
<li id="post-option-translator-assist" style="display: none;">
    <a id="ta-side-menu-open" href="javascript:void(0)" title="Open the side menu (Hotkey: alt+t)">Translator Assist</a>
</li>`;

const RUBY_DIALOG = `
<div id="ta-ruby-dialog">
    <div id="ta-ruby-styles">
        <div class="ta-header ta-cursor-text">Styles:</div>
        <div id="ta-ruby-dialog-tabs">
            <a href="javascript:void(0)" class="ta-menu-tab ta-cursor-pointer ta-active" data-value="overall">Overall</a>
            <a href="javascript:void(0)" class="ta-menu-tab ta-cursor-pointer" data-value="top">Top</a>
            <a href="javascript:void(0)" class="ta-menu-tab ta-cursor-pointer" data-value="bottom">Bottom</a>
        </div>
        <div id="ta-ruby-dialog-style_sections">
            <div id="ta-ruby-dialog-styles-overall">%RUBYSTYLEOVERALL%</div>
            <div id="ta-ruby-dialog-styles-top" style="display: none;">%RUBYSTYLETOP%</div>
            <div id="ta-ruby-dialog-styles-bottom" style="display: none;">%RUBYSTYLEBOTTOM%</div>
        </div>
    </div>
    <div id="ta-ruby-editor">
        <div><span class="ta-header" style="display: inline;">Text:</span></div>
        <div>
            <span style="font-size: 0.8em;">
                Add top segments to the <b>Top</b> section and bottom segments to the <b>Bottom</b> section.
                Separate each segment with a carriage return. Top/bottom segments can be separated by adding spaces to the lines.
                <span style="color: red; font-weight: bold;">Note:</span> The number of top segments and bottom segments must match.
            </span>
        </div>
        <div><span class="ta-subheader">Top</span></div>
        <div id="ta-ruby-top" class="ta-ruby-textarea"><textarea></textarea></div>
        <div><span class="ta-subheader">Bottom</span></div>
        <div id="ta-ruby-bottom" class="ta-ruby-textarea"><textarea></textarea></div>
    </div>
</div>`;


const LOAD_DIALOG = `
<div class="ta-load-dialog">
    <div class="ta-header">Saved sessions (%LOADNAME%):</div>
    <div class="ta-load-saved">
        <div class="ta-load-message">
            <ul>
                <li>Click an item to load that session into the current set of inputs.</li>
                <li>Click <b>Delete</b> to delete selected sessions.</li>
                <li>Click <b>Save</b> to save the current inputs as a new session.</li>
            </ul>
        </div>
        <div class="ta-load-saved-controls">
            <a href="javascript:void(0)" data-value="all">All</a> |
            <a href="javascript:void(0)" data-value="none">None</a> |
            <a href="javascript:void(0)" data-value="invert">Invert</a>
        </div>
        <div class="ta-load-sessions">%LOADSAVED%</div>
    </div>
</div>`;

const NO_SESSIONS = '<div style="font-style: italic; padding: 0.5em;">There are no sessions saved.</div>';

const HTML_DOC_HEADER = '<!DOCTYPE html><html lang="en"><head><title>Blah</title></head><body>\n';
const HTML_DOC_FOOTER = '\n</body></html>';

//Menu constants

const TEXT_SHADOW_ATTRIBS = ['size', 'blur', 'color'];
const CSS_OPTIONS = ['overwrite', 'initialize'];

const HTML_CHARS = [{
    display: '&amp;',
    char: '&amp;amp;',
    title: 'ampersand',
}, {
    display: '&lt;',
    char: '&amp;lt;',
    title: 'less than',
}, {
    display: '&gt;',
    char: '&amp;gt;',
    title: 'greater than',
}, {
    display: '&quot;',
    char: '&amp;quot;',
    title: 'quotation',
}, {
    display: '&#x27;',
    char: '&amp;#x27;',
    title: 'apostrophe',
}, {
    display: '&#x60;',
    char: '&amp;#x60;',
    title: 'backtick',
}];

const SPECIAL_CHARS = [{
    char: '♥',
    title: 'black heart',
}, {
    char: '\u2661',
    title: 'white heart',
}, {
    char: '♦',
    title: 'black diamond',
}, {
    char: '\u2662',
    title: 'white diamond',
}, {
    char: '♠',
    title: 'black spade',
}, {
    char: '\u2664',
    title: 'white spade',
}, {
    char: '♣',
    title: 'black club',
}, {
    char: '\u2667',
    title: 'white club',
}, {
    char: '\u2669',
    title: 'quarter note',
}, {
    char: '♪',
    title: 'eighth note',
}, {
    char: '♫',
    title: 'beamed eighth notes',
}, {
    char: '\u266C',
    title: 'beamed sixteenth notes',
}, {
    char: '←',
    title: 'leftwards arrow',
}, {
    char: '→',
    title: 'rightwards arrow',
}, {
    char: '↓',
    title: 'downwards arrow',
}, {
    char: '↑',
    title: 'upwards arrow',
}, {
    char: '✓',
    title: 'check mark',
}, {
    char: '✔',
    title: 'heavy check mark',
}, {
    char: '★',
    title: 'black star',
}, {
    char: '☆',
    title: 'white star',
}, {
    char: '■',
    title: 'black square',
}, {
    char: '□',
    title: 'white square',
}, {
    char: '◆',
    title: 'black diamond',
}, {
    char: '◇',
    title: 'white diamond',
}, {
    char: '▲',
    title: 'black up triangle',
}, {
    char: '△',
    title: 'white up triangle',
}, {
    char: '▼',
    title: 'black down triangle',
}, {
    char: '▽',
    title: 'white down triangle',
}, {
    char: '❤',
    title: 'heavy black heart',
}, {
    char: '💕',
    title: 'two hearts',
}, {
    char: '•',
    title: 'bullet',
}, {
    char: '●',
    title: 'black circle',
}, {
    char: '○',
    title: 'white circle',
}, {
    char: '◯',
    title: 'large circle',
}, {
    char: '〇',
    title: 'ideographic number zero',
}, {
    char: '💢',
    title: 'anger vein',
}, {
    char: '…',
    title: 'horizontal ellipsis',
}, {
    char: '\u22EE',
    title: 'vertical ellipsis',
}, {
    char: '\u22EF',
    title: 'midline horizontalk ellipsis',
}, {
    char: '\u22F0',
    title: 'up right diagonal ellipsis',
}, {
    char: '\u22F1',
    title: 'down right diagonal ellipsis',
}, {
    char: '￥',
    title: 'yen sign',
}, {
    char: '＊',
    title: 'fullwidth asterisk',
}, {
    char: '※',
    title: 'reference mark',
}, {
    char: '♂',
    title: 'Mars symbol',
}, {
    char: '♀',
    title: 'Venus symbol',
}, {
    char: '█',
    title: 'full block',
}, {
    char: '░',
    title: 'light shade',
}, {
    char: '\u223F',
    title: 'sine wave',
}, {
    char: '〜',
    title: 'wave dash',
}, {
    char: '〰',
    title: 'wavy dash',
}, {
    char: '～',
    title: 'fullwidth tilde',
}, {
    char: '\u299a',
    title: 'vertical zigzag',
}, {
    char: '\u2307',
    title: 'wavy line',
}];

const DASH_CHARS = [{
    display: 'en',
    char: '–',
    title: 'en dash',
}, {
    display: 'em',
    char: '—',
    title: 'em dash',
}, {
    display: 'jp',
    char: 'ー',
    title: 'Katakana extension mark',
}, {
    display: 'bar',
    char: '―',
    title: 'horizontal bar',
}, {
    display: 'box',
    char: '─',
    title: 'box light horizontal',
}];

const SPACE_CHARS = [{
    display: 'en',
    char: '&amp;ensp;',
    title: 'en space',
}, {
    display: 'em',
    char: '&amp;emsp;',
    title: 'em space',
}, {
    display: 'thin',
    char: '&amp;thinsp;',
    title: 'thin space'
}, {
    display: 'nb',
    char: '&amp;nbsp;',
    title: 'non-breaking space',
}, {
    display: 'zero',
    char: '&amp;ZeroWidthSpace;',
    title: 'zero-width space',
}];

//UI constants

const RUBY_DIALOG_SETTINGS = {
    title: "Ruby Editor",
    width: 750,
    height: 500,
    modal: false,
    resizable: false,
    autoOpen: false,
    position: {my: 'left top', at: 'left top'},
    classes: {
        'ui-dialog': 'ta-dialog',
        'ui-dialog-titlebar-close': 'ta-dialog-close'
    },
    buttons: [
        {
            'text': 'Load',
            'click': LoadRubyStyles,
        }, {
            'text': 'Clear',
            'click'() {
                ClearInputs('#ta-ruby-dialog input, #ta-ruby-dialog textarea');
            },
        }, {
            'text': 'Copy',
            'click': CopyRubyTag,
        }, {
            'text': 'Apply',
            'click': ApplyRubyTag,
        }, {
            'text': 'Undo',
            'click': UndoAction,
        }, {
            'text': 'Redo',
            'click': RedoAction,
        }, {
            'text': 'Close',
            'click' () {
                $(this).dialog('close');
            },
        },
    ]
};

const LOAD_DIALOG_SETTINGS = {
    title: "Load Sessions",
    width: 500,
    height: 600,
    modal: false,
    draggable: true,
    resizable: false,
    autoOpen: false,
    position: {my: 'center', at: 'center'},
    classes: {
        'ui-dialog': 'ta-dialog',
        'ui-dialog-titlebar-close': 'ta-dialog-close'
    },
    buttons: [
        {
            'text': 'Save',
            'click': SaveSession,
        }, {
            'text': 'Rename',
            'click': RenameSession,
        }, {
            'text': 'Delete',
            'click': DeleteSessions,
        }, {
            'text': 'Close',
            'click' () {
                $(this).dialog('close');
            },
        },
    ]
};

// Config constants

const FAMILY_DICT = {
    margin: ['margin', 'margin-left', 'margin-right', 'margin-top', 'margin-bottom'],
    padding: ['padding', 'padding-left', 'padding-right', 'padding-top', 'padding-bottom'],
};

const STYLE_CONFIG = {
    'font-family': {
        normalize (text) {
            return this._fixup(text, '"');
        },
        finalize (text) {
            return this._fixup(text, "'");
        },
        _fixup (text, char) {
            let family_list = text.split(',');
            let normalized_list = family_list.map((name) => {
                name = name.replace(/\s+/g, ' ').trim();
                if (name.match(/^['"][^'"]+['"]$/)) {
                    name = name.replace(/['"]/g, "");
                }
                if (name.match(/ /)) {
                    name = char + name + char;
                }
                return name;
            });
            return normalized_list.join(', ');
        },
    },
    'font-size': {
        normalize: NormalizeSize,
    },
    direction_styles: {
        parse: ParseDirection,
        normalize (text) {
            return this._collapse(NormalizeSize(text).split(/\s+/));
        },
        finalize (text) {
            return this._collapse(text.split(/\s+/));
        },
        _collapse (size_list) {
            if (size_list.length === 0) return "";
            if (size_list.every((size) => (size === size_list[0]))) return size_list[0];
            size_list[3] = (size_list[3] === size_list[1] ? undefined : size_list[3]);
            size_list[2] = (size_list[2] === size_list[0] && size_list[3] === undefined ? undefined : size_list[2]);
            return size_list.filter((size) => (size !== undefined)).join(' ');
        },
    },
    color: {
        normalize: NormalizeColor,
        finalize: FinalizeColor,
    },
    'background-color': {
        normalize: NormalizeColor,
        finalize: FinalizeColor,
        label: 'letter-spacing: -1px;',
    },
    rotate: {
        parse (_, value) {
            return (value !== "" ? ['transform', `rotate(${value})`] : ['transform', ""]);
        },
        use_parse: true,
    }
};

STYLE_CONFIG['line-height'] = STYLE_CONFIG['letter-spacing'] = STYLE_CONFIG['font-size'];

STYLE_CONFIG['border-radius'] = JSPLib.utility.dataCopy(STYLE_CONFIG.direction_styles);

['margin', 'padding'].forEach((family) => {
    STYLE_CONFIG[family] = JSPLib.utility.dataCopy(STYLE_CONFIG.direction_styles);
    STYLE_CONFIG[family].family = FAMILY_DICT[family];
    ['top', 'right', 'bottom', 'left'].forEach((direction) => {
        let style_name = family + '-' + direction;
        STYLE_CONFIG[style_name] = {
            copy: CopyDirection,
            family: FAMILY_DICT[family],
        };
    });
});

const OPTION_CONFIG = {
    overwrite: {
        title: "Select to overwrite all styles; unselect to merge.",
    },
    initialize: {
        title: "Select for blocks to be created with styles; unselect for blocks to be created empty.",
    },
};


// Regex constants

const HTML_REGEX = /<(\/?)([a-z0-9]+)([^>]*)>/i;

// Other constants

const INPUT_SECTIONS = {
    'main': '#ta-main-styles-subsection input',
    'embedded': '#ta-embedded-style-subsection input',
    'constructs': '#ta-text-shadow-attribs input',
    'text-shadow-grid': '#ta-text-shadow-grid input',
    'text-shadow-options': '#ta-text-shadow-options input',
    'css-options': '#ta-menu-options input',
    'ruby-overall-style': '#ta-ruby-dialog-styles-overall input',
    'ruby-top-style': '#ta-ruby-dialog-styles-top input',
    'ruby-bottom-style': '#ta-ruby-dialog-styles-bottom input',
    'ruby-top-text': '#ta-ruby-top textarea',
    'ruby-bottom-text': '#ta-ruby-bottom textarea',
};

const LOAD_PANEL_KEYS = {
    main: ['main'],
    embedded: ['embedded'],
    constructs: ['constructs', 'text-shadow-grid'],
    ruby: ['ruby-overall-style', 'ruby-top-style', 'ruby-bottom-style'],
};

/****Functions****/

//Library functions

JSPLib.utility.clamp = function (value, low, high) {
    return Math.max(low, Math.min(value, high));
};

// Helper functions

function ShowErrorMessages(error_messages, header = 'Error') {
    let header_name = (error_messages.length === 1 ? header : header + 's');
    let error_html = error_messages.map((message) => ('* ' + message)).join('<br>');
    JSPLib.notice.error(`<div class="prose"><b>${header_name}:</b><br><div style="padding-left: 1em;">${error_html}</div></div>`, true);
}

function ShowStyleErrors(style_errors) {
    ShowErrorMessages(style_errors, 'Invalid style');
}

// Render functions

function RenderSideMenu() {
    let shadow_section = (TA.user_settings.text_shadow_enabled ?
        JSPLib.utility.regexReplace(TEXT_SHADOW_SUBSECTION, {
            SHADOWCSS: RenderSectionTextInputs('text-shadow', TEXT_SHADOW_ATTRIBS, {}),
            SHADOWGRID: RenderTextShadowGrid(),
            SHADOWOPTIONS: RenderSectionCheckboxes('text-shadow', ['append'], {})
        }) : "");
    let ruby_section = (TA.user_settings.ruby_enabled ? RUBY_SUBSECTION : "");
    let constructs_section = (TA.user_settings.text_shadow_enabled || TA.user_settings.ruby_enabled ? shadow_section + ruby_section + '<hr>' : "");
    let embedded_section = (TA.user_settings.embedded_enabled ?
        JSPLib.utility.regexReplace(EMBEDDED_SECTION, {
            EMBEDDEDCSS: RenderSectionTextInputs('embedded-style', TA.user_settings.available_embedded_styles, STYLE_CONFIG),
        }) : "");
    let codes_section = (TA.user_settings.codes_enabled ?
        JSPLib.utility.regexReplace(CODES_SUBSECTION, {
            HTMLCHARS: RenderCharButtons(HTML_CHARS),
            SPECIALCHARS: RenderCharButtons(SPECIAL_CHARS),
            DASHCHARS: RenderCharButtons(DASH_CHARS),
            SPACECHARS: RenderCharButtons(SPACE_CHARS),
        }) : "");
    let html = JSPLib.utility.regexReplace(SIDE_MENU, {
        BLOCKHTML: RenderHTMLBlockButtons(),
        BLOCKCSS: RenderSectionTextInputs('block-style', TA.user_settings.available_css_styles, STYLE_CONFIG),
        CONSTRUCTSTAB: constructs_section,
        EMBEDDEDTAB: embedded_section,
        CONTROLSTAB: CONTROLS_SECTION,
        CODESTAB: codes_section,
        CSSOPTIONS: RenderSectionCheckboxes('css-style', CSS_OPTIONS, OPTION_CONFIG),
    });
    return html;
}

function RenderRubyDialog() {
    let available_inner_styles = JSPLib.utility.arrayIntersection(INNER_RUBY_STYLES, TA.user_settings.available_ruby_styles);
    return JSPLib.utility.regexReplace(RUBY_DIALOG, {
        RUBYSTYLEOVERALL: RenderSectionTextInputs('ruby-overall-style', TA.user_settings.available_ruby_styles, STYLE_CONFIG),
        RUBYSTYLETOP: RenderSectionTextInputs('ruby-top-style', available_inner_styles, STYLE_CONFIG),
        RUBYSTYLEBOTTOM: RenderSectionTextInputs('ruby-bottom-style', available_inner_styles, STYLE_CONFIG),
    });
}

function RenderLoadDialog(panel) {
    let sessions = JSPLib.storage.getStorageData('ta-load-session-' + panel, localStorage, []);
    return JSPLib.utility.regexReplace(LOAD_DIALOG, {
        LOADNAME: panel,
        LOADSAVED: RenderLoadSessions(panel, sessions),
    });
}

function RenderLoadSessions(panel, sessions) {
    let html = "";
    let updated_list = [];
    sessions.forEach((item) => {
        if (item.key) {
            html += RenderLoadItem(item);
            updated_list.push(item);
        } else {
            JSPLib.debug.debugerror("Malformed item found:", item);
        }
    });
    if (updated_list.length !== sessions.length) {
        JSPLib.storage.setStorageData('ta-load-session-' + panel, updated_list, localStorage);
    }
    return (html === "" ? NO_SESSIONS : `<ul>${html}</ul>`);
}

function RenderLoadItem(item) {
    let checkbox_key = 'ta-delete-' + item.key;
    let escaped_name = JSPLib.utility.HTMLEscape(item.name);
    return `<li><label for="${checkbox_key}"><input id="${checkbox_key}" type="checkbox"></label><a href="javascript:void(0)" class="ta-load-session-item" data-name="${escaped_name}" data-key="${item.key}">${escaped_name}</a></li>`;
}

function RenderHTMLBlockButtons() {
    let block_html = "";
    TA.user_settings.available_html_tags.forEach((tag) => {
        let button_class = (HTML_STYLE_TAGS.includes(tag) ? 'ta-html-style-tag' : 'ta-html-only-tag');
        block_html += `<button class="ta-apply-block-element ${button_class}" value="${tag}">${tag}</button>`;
    });
    return block_html;
}

function RenderSectionTextInputs(section_class, section_names, config) {
    let html = "";
    section_names.forEach((name) => {
        let display_name = JSPLib.utility.displayCase(name);
        let input_name = section_class + '-' + JSPLib.utility.kebabCase(name);
        let label_style = config[name]?.label || "";
        let value = TA.save_data[input_name] || "";
        html += `<div class="ta-${section_class}-input ta-text-input"><label style="${label_style}">${display_name}</label><input name="${input_name}" data-name="${name}" value="${value}"></div>`;
    });
    return html;
}

function RenderSectionCheckboxes(section_class, section_names, config) {
    let html = "";
    section_names.forEach((name) => {
        let display_name = JSPLib.utility.displayCase(name);
        let input_name = section_class + '-' + JSPLib.utility.kebabCase(name);
        let title = (config[name]?.title ? `title="${config[name].title}"` : "");
        let checked = (TA.save_data[input_name] !== true ? "" : 'checked');
        html += `<div class="ta-${section_class} ta-checkbox" ${title}><label>${display_name}:</label><input type="checkbox" ${checked} name="${input_name}" id="ta-${input_name}"></div>`;
    });
    return html;
}

function RenderTextShadowGrid() {
    let grid_html = "";
    let right_em = 9;
    let col_val = -1;
    ['left', 'center', 'right'].forEach((colname) => {
        let top_em = 1;
        let row_val = -1;
        ['top', 'middle', 'bottom'].forEach((rowname) => {
            if (colname === 'center' && rowname === 'middle') {
                grid_html += `<div class="ta-grid-item" style="top: ${top_em}em; right: ${right_em}em; background-color: var(--text-color);"></div>`;
            } else {
                let input_name = 'shadow-grid-' + rowname + '-' + colname;
                let classname = (row_val === 0 || col_val === 0 ? 'ta-grid-side' : 'ta-grid-corner');
                TA.shadow_grid[input_name] = TA.save_data[input_name] !== false;
                let checked = (TA.shadow_grid[input_name] ? "checked" : "");
                grid_html += `<input name="${input_name}" class="${classname} ta-grid-item" type="checkbox" ${checked} value="[${col_val},${row_val}]" style="top: ${top_em}em; right: ${right_em}em;">`;
            }
            top_em += 4;
            row_val += 1;
        });
        right_em -= 4;
        col_val += 1;
    });
    return `<div style="position: relative; height: 12em; width: 12em;">${grid_html}</div>`;
}

function RenderCharButtons(char_list) {
    let html = "";
    char_list.forEach((item) => {
        let display = item.display || item["char"];
        html += `<button value="${item["char"]}" title="${item.title}">${display}</button>`;
    });
    return html;
}

function RenderHTMLError(iteration, message, input_html) {
    let number = JSPLib.utility.padNumber(iteration + 1, 2);
    if (!('firstColumn' in message)) {
        return `<li><b>${number}.</b> ${message.message}</li>`;
    }
    var highlight_html, row, column;
    let line = input_html.split('\n')[message.lastLine - 2];
    if (line !== undefined) {
        highlight_html = '<code>' + JSPLib.utility.HTMLEscape(line.slice(message.firstColumn - 1, message.lastColumn)) + '</code>';
        row = message.lastLine - 1;
        column = message.firstColumn;
    } else {
        highlight_html = row = column = '<em>N/A</em>';
    }
    return `
<li><b>${number}.</b> ${message.message}
    <ul style="list-style: inside;">
        <li>Line: ${row}</li>
        <li>Column: ${column}</li>
        <li>HTML: ${highlight_html}</li>
    </ul>
</li>`;
}

function RenderCSSError(iteration, error) {
    let highlight_html = JSPLib.utility.HTMLEscape(error.excerpt);
    let message_html = JSPLib.utility.HTMLEscape(error.message);
    let letter = String.fromCharCode(65 + iteration);
    return `
<li><b>${letter}.</b> ${message_html}
    <ul style="list-style: inside;">
        <li>Position: ${error.index}</li>
        <li>CSS: <code>${highlight_html}</code></li>
    </ul>
</li>`;
}

function RenderUserLink(user) {
    let user_name = JSPLib.utility.maxLengthString(user.name);
    return `
<a  class="user user-${user.level_string.toLowerCase()} ta-cursor-pointer"
    data-user-id="${user.id}"
    data-user-name="${user_name}"
    data-user-level="${user.level}"
    href="/users/${user.id}"
    aria-expanded="false"
    >
        ${user_name}
</a>`;
}

//Network functions

function QueryNoteVersions(search_options, query_options) {
    let send_options = {search: {post_id: TA.post_id}, limit: 1};
    Object.assign(send_options.search, search_options);
    Object.assign(send_options, query_options);
    return JSPLib.danbooru.submitRequest('note_versions', send_options);
}

function QueryNewNotations() {
    QueryNoteVersions({id_gt: TA.last_id, updater_id_not_eq: TA.user_id}, {only: 'id,updated_at'}).then((data) => {
        if (data.length > 0) {
            JSPLib.debug.debuglog("New note record:", data);
            alert("New noter detected: " + JSPLib.utility.timeAgo(data[0].updated_at));
            TA.noter_detected = true;
        } else {
            JSPLib.debug.debuglog("No new noter detected.");
        }
    });
}

function QueryLastNotation() {
    let query_options = {only: 'id,updated_at,updater[id,name,level,level_string]'};
    if (TA.user_settings.last_noter_cache_time > 0) {
        query_options.expires_in = TA.user_settings.last_noter_cache_time + 'min';
    }
    let search_options = (TA.user_settings.filter_last_noter_enabled ? {updater_id_not_eq: TA.user_id} : {});
    QueryNoteVersions(search_options, query_options).then((data) => {
        JSPLib.debug.debuglog("Last note record:", data);
        TA.last_noter_queried = true;
        let timeago_timestamp = (data.length ? JSPLib.utility.timeAgo(data[0].updated_at) : 'N/A');
        let last_updater = (data.length ? RenderUserLink(data[0].updater) : 'N/A');
        let total_notes = $('#notes > article').length;
        let [embedded_status, embedded_color] = (TA.has_embedded ? ['Enabled', 'green'] : ['Disabled', 'red']);
        let html = JSPLib.utility.regexReplace(NOTICE_INFO, {
            LASTUPDATED: timeago_timestamp,
            LASTUPDATER: last_updater,
            TOTALNOTES: total_notes,
            EMBEDDEDSTATUS: embedded_status,
            EMBEDDEDCOLOR: embedded_color,
        });
        TA.$text_box.html(html);
        ToggleSideMenu(true, false);
        TA.last_id = data[0]?.id || TA.last_id;
    });
}

async function ValidateHTML(input_html) {
    let send_html = HTML_DOC_HEADER + input_html + HTML_DOC_FOOTER;
    try {
        //Replace this with a JSPLib.network.post version
        var resp = await GM.xmlHttpRequest({
            method: 'POST',
            url: 'https://validator.nu?out=json',
            headers: {'Content-Type': "text/html; charset=UTF-8"},
            data: send_html,
        });
    } catch(e) {
        JSPLib.notice.error("Error querying validation server <code>validator.nu</code>");
        JSPLib.debug.debugerror("Server error:", e);
        return null;
    }
    try {
        var data = JSON.parse(resp.response);
    } catch(e) {
        JSPLib.notice.error("Unable to parse validation response!");
        JSPLib.debug.debugerror("Parse error:", e, resp.response);
        return null;
    }
    if (!JSPLib.validate.isHash(data) || !('messages' in data)) {
        JSPLib.notice.error("Unexpected response format!");
        JSPLib.debug.debugerror("Unexpected format:", data);
        return null;
    }
    return data;
}

//// HTML functions

function IsInsideHTMLTag(html_text, cursor) {
    let c = cursor;
    let d = cursor - 1;
    return (((html_text.indexOf('<', c) < 0) && (html_text.indexOf('>', c) >= 0)) || (html_text.indexOf('<', c) > html_text.indexOf('>', c))) &&
    (((html_text.lastIndexOf('>', d) < 0) && (html_text.lastIndexOf('<', d) >= 0)), (html_text.lastIndexOf('>', d) < html_text.lastIndexOf('<', d)));
}

function BuildHTMLTag(tag_name, attrib_dict, style_dict, blank_style = false) {
    let style_pairs = Object.entries(style_dict).filter((style_pair) => (style_pair[1] !== ""));
    if (style_pairs.length){
        attrib_dict.style = style_pairs.map((style_pair) => (style_pair[0] + ": " + style_pair[1])).join('; ') + ';';
    } else if (blank_style) {
        attrib_dict.style = "";
    } else {
        delete attrib_dict.style;
    }
    let attrib_html = Object.entries(attrib_dict).map((attrib_pair) => (attrib_pair[0] + '="' + attrib_pair[1] + '"')).join(' ');
    attrib_html = (attrib_html ? " " : "") + attrib_html;
    return '<' + tag_name + attrib_html + '>';
}

function ParseTagAttributes(html_tag) {
    let attrib_items = JSPLib.utility.findAll(html_tag, /\w+="[^"]+"/g);
    let attrib_pairs = attrib_items.map((attrib) => JSPLib.utility.findAll(attrib, /(\w+)="([^"]+)"/g).filter((_item, i) => (i % 3)));
    let attrib_dict = Object.assign({}, ...attrib_pairs.map((attrib_pair) => ({[attrib_pair[0]]: attrib_pair[1]})));
    var style_dict;
    if ('style' in attrib_dict) {
        let style_pairs = attrib_dict.style.split(';').filter((style) => (!style.match(/^\s*$/))).map((style) => (style.split(':').map((str) => str.trim())));
        style_dict = Object.assign({}, ...style_pairs.map((style) => ({[style[0]]: style[1]})));
    } else {
        style_dict = {};
    }
    JSPLib.debug.debuglog("ParseTagAttributes", {attrib_dict, style_dict});
    return {attrib_dict, style_dict};
}

function TokenizeHTML(html_string) {
    if (TokenizeHTML.tags) return TokenizeHTML.tags;
    let html_length = html_string.length;
    let html_tags = [];
    let tag_stack = [];
    let unclosed_tags = [];
    let position = 0;
    let match = null;
    while (match = html_string.match(HTML_REGEX)) {
        let start_pos = position + match.index;
        let end_pos = start_pos + match[0].length;
        if (match[1]) {
            let html_tag = tag_stack.pop();
            if (html_tag) {
                if (html_tag.tag_name === match[2]) {
                    html_tag.close_tag_start = start_pos;
                    html_tag.close_tag_end = end_pos;
                    unclosed_tags.forEach((tag) => {
                        tag.close_tag_start = tag.close_tag_end = start_pos;
                    });
                    unclosed_tags.length = 0;
                } else {
                    unclosed_tags.push(html_tag);
                }
            }
        } else {
            let html_tag = {
                tag_name: match[2],
                open_tag_start: start_pos,
                open_tag_end: end_pos
            };
            html_tags.push(html_tag);
            tag_stack.push(html_tag);
        }
        let increment = match.index + match[0].length;
        position += increment;
        html_string = html_string.slice(increment);
    }
    tag_stack.concat(unclosed_tags).forEach((tag) => {
        tag.close_tag_start = tag.close_tag_end = html_length;
    });
    html_tags.forEach((tag) => {
        tag.ancestor_tags = html_tags.filter((outer_tag) => {
            if (tag === outer_tag) return false;
            return outer_tag.open_tag_end <= tag.open_tag_start && outer_tag.close_tag_start >= tag.close_tag_end;
        });
        tag.descendant_tags = html_tags.filter((inner_tag) => {
            if (tag === inner_tag) return false;
            return tag.open_tag_end <= inner_tag.open_tag_start && tag.close_tag_start >= inner_tag.close_tag_end;
        });
    });
    return html_tags;
}

function GetParentTag(html_tags, cursor) {
    let ancestor_tags = html_tags.filter((tag) => tag.open_tag_end <= cursor && tag.close_tag_start >= cursor);
    return ancestor_tags.reduce((acc, tag) => (!acc || (tag.ancestor_tags.length > acc.ancestor_tags.length) ? tag : acc), null);
}

function GetTag(html_text, cursor, warning = true) {
    let tag;
    if (TA.mode === 'main' || TA.mode === 'constructs') {
        tag = GetHTMLTag(html_text, cursor);
        if (!tag && warning) {
            ShowErrorMessages(["No open tag selected."]);
        }
    } else if (TA.mode === 'embedded') {
        tag = GetEmbeddedTag(html_text);
        if (!tag && warning) {
            ShowErrorMessages(["No tag with class <code>note-box-attributes</code> ."]);
        }
    } else if (warning) {
        ShowErrorMessages([`Mode <code>${TA.mode}</code> not implement for current function.`]);
    }
    return tag;
}

function GetHTMLTag(html_text, cursor) {
    let html_tags = TokenizeHTML(html_text);
    let html_tag = html_tags.filter((tag) => (cursor >= tag.open_tag_start && cursor < tag.open_tag_end))[0];
    if (!html_tag) return;
    html_tag.open_tag = html_text.slice(html_tag.open_tag_start, html_tag.open_tag_end);
    html_tag.close_tag = html_text.slice(html_tag.close_tag_start, html_tag.open_tag_end);
    html_tag.inner_html = html_text.slice(html_tag.open_tag_end, html_tag.close_tag_start);
    html_tag.full_tag = html_text.slice(html_tag.open_tag_start, html_tag.close_tag_end);
    html_tag.tag_name = html_tag.open_tag.match(/<(\w+)/)[1];
    Object.assign(html_tag, ParseTagAttributes(html_tag.open_tag));
    JSPLib.debug.debuglog("GetHTMLTag", html_tag);
    return html_tag;
}

function GetEmbeddedTag(html_text) {
    let html_tags = TokenizeHTML(html_text);
    let embedded_tag = html_tags.find((html_tag) => {
        html_tag.open_tag = html_text.slice(html_tag.open_tag_start, html_tag.open_tag_end);
        if (!html_tag.open_tag.match(/ class="[^"]+"/)) return;
        Object.assign(html_tag, ParseTagAttributes(html_tag.open_tag));
        if (html_tag.attrib_dict["class"].split(' ').includes('note-box-attributes')) return html_tag;
    });
    if (!embedded_tag) return;
    embedded_tag.close_tag = html_text.slice(embedded_tag.close_tag_start, embedded_tag.open_tag_end);
    embedded_tag.inner_html = html_text.slice(embedded_tag.open_tag_end, embedded_tag.close_tag_start);
    embedded_tag.full_tag = html_text.slice(embedded_tag.open_tag_start, embedded_tag.close_tag_end);
    embedded_tag.tag_name = embedded_tag.open_tag.match(/<(\w+)/)[1];
    JSPLib.debug.debuglog("GetEmbeddedTag", embedded_tag);
    return embedded_tag;
}

function GetRubyTag(html_text, cursor) {
    let html_tags = TokenizeHTML(html_text);
    let overall_ruby_tag = html_tags.find((html_tag) => {
        if (html_tag.open_tag_start > cursor || html_tag.open_tag_end <= cursor) return;
        html_tag.open_tag = html_text.slice(html_tag.open_tag_start, html_tag.open_tag_end);
        html_tag.tag_name = html_tag.open_tag.match(/<(\w+)/)[1];
        if (html_tag.tag_name !== 'ruby') return;
        html_tag.close_tag = html_text.slice(html_tag.close_tag_start, html_tag.open_tag_end);
        html_tag.inner_html = html_text.slice(html_tag.open_tag_end, html_tag.close_tag_start);
        html_tag.full_tag = html_text.slice(html_tag.open_tag_start, html_tag.close_tag_end);
        Object.assign(html_tag, ParseTagAttributes(html_tag.open_tag));
        return html_tag;
    });
    if (!overall_ruby_tag) return;
    let inner_tags = html_tags.filter((html_tag) => ((html_tag.open_tag_start >= overall_ruby_tag.open_tag_end) && (html_tag.close_tag_end <= overall_ruby_tag.close_tag_start)))
        .sort((a, b) => (a.open_tag_start - b.open_tag_start));
    let temp_inner_tags = [...inner_tags];
    let base_inner_tags = [];
    var next_inner_tag;
    const _unshift_tags = function (current_tag, html_tags) {return html_tags.filter((html_tag) => (html_tag.open_tag_start >= next_inner_tag.close_tag_end));};
    while (next_inner_tag = inner_tags.shift()) {
        inner_tags = _unshift_tags(next_inner_tag, inner_tags);
        next_inner_tag.open_tag = html_text.slice(next_inner_tag.open_tag_start, next_inner_tag.open_tag_end);
        next_inner_tag.tag_name = next_inner_tag.open_tag.match(/<(\w+)/)[1];
        if (next_inner_tag.tag_name !== 'rt' && next_inner_tag.tag_name !== 'span') continue;
        next_inner_tag.close_tag = html_text.slice(next_inner_tag.close_tag_start, next_inner_tag.open_tag_end);
        next_inner_tag.inner_html = html_text.slice(next_inner_tag.open_tag_end, next_inner_tag.close_tag_start);
        next_inner_tag.full_tag = html_text.slice(next_inner_tag.open_tag_start, next_inner_tag.close_tag_end);
        Object.assign(next_inner_tag, ParseTagAttributes(next_inner_tag.open_tag));
        base_inner_tags.push(next_inner_tag);
    }
    let top_ruby_tags = base_inner_tags.filter((html_tag) => (html_tag.tag_name === 'rt'));
    let bottom_ruby_tags = base_inner_tags.filter((html_tag) => (html_tag.tag_name === 'span'));
    return {overall: overall_ruby_tag, top: top_ruby_tags, bottom: bottom_ruby_tags, temp_inner_tags, html_tags};
}

function ValidateCSS(input_html) {
    let $validator = $('<div></div>');
    let valid_styles = Object.keys($validator[0].style).map(JSPLib.utility.kebabCase);
    let error_array = [];
    for (let match of input_html.matchAll(/(style\s*=\s*")([^"]+)"/g)) {
        let style_index = match.index + match[1].length + 1; // One-based positioning
        let styles = match[2].replace(/\s*;\s*$/, '').split(';'); // Remove the final semi-colon
        for (let i = 0; i < styles.length; style_index += styles[i++].length + 1) {
            let error = {
                excerpt: styles[i],
                index: style_index,
            };
            let [attr,value,...misc] = styles[i].split(':');
            if (misc.length) {
                error_array.push(Object.assign({message: "Extra colons found."}, error));
                continue;
            }
            attr = attr.trim();
            if (value === undefined) {
                if (attr.length === 0) {
                    error.excerpt += ';';
                    error_array.push(Object.assign({message: "Extra-semi colon found."}, error));
                } else {
                    error_array.push(Object.assign({message: "No colons found."}, error));
                }
                continue;
            }
            if (!valid_styles.includes(attr)) {
                error_array.push(Object.assign({message: "Invalid style attribute: " + attr}, error));
                continue;
            }
            let attr_key = JSPLib.utility.camelCase(attr);
            value = value.replace(/\s*!important\s*$/, "").trim();
            $validator[0].style[attr_key] = value;
            if ($validator[0].style[attr_key] === "") {
                error_array.push(Object.assign({message: "Invalid style value: " + value}, error));
            }
        }
    }
    return error_array;
}

// DOM functions

function UpdateHTMLStyles(text_area, add_styles) {
    //Add styles to an existing HTML tag
    let html_tag = GetTag(text_area.value, text_area.selectionStart);
    if (!html_tag) return;
    let style_dict = MergeCSSStyles(html_tag.style_dict, add_styles);
    let final_tag = BuildHTMLTag(html_tag.tag_name, html_tag.attrib_dict, style_dict);
    text_area.value = text_area.value.slice(0, html_tag.open_tag_start) + final_tag + text_area.value.slice(html_tag.open_tag_end);
    text_area.focus();
    text_area.setSelectionRange(html_tag.open_tag_start, html_tag.open_tag_start + final_tag.length);
}

function InsertHTMLBlock(text_area, tag_name, style_dict) {
    //Insert a new HTML tag
    let prefix = BuildHTMLTag(tag_name, {}, style_dict);
    let suffix = '</' + tag_name + '>';
    let fixtext = "";
    let select_start = text_area.selectionStart;
    fixtext = text_area.value.slice(0, text_area.selectionStart);
    let valueselection = text_area.value.slice(text_area.selectionStart, text_area.selectionEnd);
    fixtext += prefix + valueselection + suffix;
    let caretPos = fixtext.length;
    fixtext += text_area.value.slice(text_area.selectionEnd);
    text_area.value = fixtext;
    text_area.focus();
    text_area.setSelectionRange(select_start, caretPos);
}

function AddBlockElement(text_area, tag_name) {
    let html_text = text_area.value;
    let cursor = text_area.selectionStart;
    let cursor_end = text_area.selectionEnd;
    if (IsInsideHTMLTag(html_text, cursor_end)) {
        ShowErrorMessages(["Cannot end selection inside another tag."]);
        return;
    }
    let html_tags = TokenizeHTML(html_text);
    if (GetParentTag(html_tags, cursor) !== GetParentTag(html_tags, cursor_end)) {
        ShowErrorMessages(["Selection end cannot end inside a sibling tag."]);
        return;
    }
    let initialize = $('#ta-css-style-initialize').get(0)?.checked;
    let [create_styles, invalid_styles] = (initialize && HTML_STYLE_TAGS.includes(tag_name) ? GetCSSStyles(false, INPUT_SECTIONS[TA.mode]) : [{}, {}]);
    InsertHTMLBlock(text_area, tag_name, create_styles);
    let style_errors = Object.entries(invalid_styles).map((style_pair) => (`<code>${style_pair[0]}</code> => "${style_pair[1]}"`));
    if (style_errors.length) {
        ShowStyleErrors(style_errors);
    } else {
        TA.$close_notice_link.click();
    }
}

function ChangeBlockElement(text_area, tag_name) {
    let cursor = text_area.selectionStart;
    let html_string = text_area.value;
    let html_tags = TokenizeHTML(html_string);
    let html_tag = html_tags.filter((tag) => ((cursor > tag.open_tag_start && cursor < tag.open_tag_end) || (cursor > tag.close_tag_start && cursor < tag.close_tag_end)))[0];
    if (!html_tag) return;
    if (html_tag.close_tag_start) {
        //Open tags may not have a close tag
        let end_tag = html_string.slice(html_tag.close_tag_start, html_tag.close_tag_end);
        end_tag = end_tag.replace(HTML_REGEX, `<$1${tag_name}$3>`);
        html_string = html_string.slice(0, html_tag.close_tag_start) + end_tag + html_string.slice(html_tag.close_tag_end);
    }
    let start_tag = html_string.slice(html_tag.open_tag_start, html_tag.open_tag_end);
    start_tag = start_tag.replace(HTML_REGEX, `<$1${tag_name}$3>`);
    html_string = html_string.slice(0, html_tag.open_tag_start) + start_tag + html_string.slice(html_tag.open_tag_end);
    text_area.value = html_string;
    text_area.focus();
    let start_pos = html_tag.open_tag_start + 1;
    text_area.setSelectionRange(start_pos, start_pos + tag_name.length);
    TA.$close_notice_link.click();
}

function DeleteBlockElement(text_area) {
    let cursor = text_area.selectionStart;
    let html_string = text_area.value;
    let html_tags = TokenizeHTML(html_string);
    let html_tag = html_tags.filter((tag) => ((cursor > tag.open_tag_start && cursor < tag.open_tag_end) || (cursor > tag.close_tag_start && cursor < tag.close_tag_end)))[0];
    if (!html_tag) return;
    if (html_tag.close_tag_start) {
        //Open tags may not have a close tag
        html_string = html_string.slice(0, html_tag.close_tag_start) + html_string.slice(html_tag.close_tag_end);
    }
    html_string = html_string.slice(0, html_tag.open_tag_start) + html_string.slice(html_tag.open_tag_end);
    text_area.value = html_string;
    text_area.focus();
    text_area.setSelectionRange(cursor, cursor);
    TA.$close_notice_link.click();
}

//// Input functions

function GetInputs(key) {
    let save_data = {};
    let selector = INPUT_SECTIONS[key];
    $(selector).each((_i, input) => {
        if (input.tagName === 'INPUT' && input.type === 'checkbox') {
            save_data[input.name] = input.checked;
        } else {
            save_data[input.name] = input.value;
        }
    });
    return save_data;
}

function SetInputs(key, load_data) {
    let selector = INPUT_SECTIONS[key];
    $(selector).each((_i, input) => {
        if (!(input.name in load_data)) return;
        if (input.tagName === 'INPUT' && input.type === 'checkbox') {
            input.checked = load_data[input.name];
        } else {
            input.value = load_data[input.name];
        }
    });
}

function SaveMenuState() {
    for (let key in INPUT_SECTIONS) {
        TA.save_data = Object.assign(TA.save_data, GetInputs(key));
    }
    JSPLib.storage.setStorageData('ta-saved-inputs', TA.save_data, localStorage);
    JSPLib.storage.setStorageData('ta-mode', TA.mode, localStorage);
    let {left, top, fontSize} = $('#ta-side-menu').get(0).style;
    JSPLib.storage.setStorageData('ta-position', {left, top, fontSize}, localStorage);
}

function ClearInputs(selector) {
    $(selector).each((_i, input) => {
        input.value = "";
    });
}

function GetActiveTextArea(close_notice = true) {
    let text_area = $('.note-edit-dialog').filter((_i, entry) => (entry.style.display !== 'none')).find('textarea').get(0);
    if (!text_area) {
        JSPLib.notice.error("No active note edit box!");
        return;
    }
    if (close_notice) {
        TA.$close_notice_link.click();
    }
    TokenizeHTML.tags = null;
    return text_area;
}

// Note functions

function ReloadNotes() {
    Danbooru.Note.notes.clear();
    $('.note-box, .note-body').remove();
    Danbooru.Note.load_all();
    Danbooru.Note.Box.scale_all();
}

function GetMovableNote() {
    let note = [...Danbooru.Note.notes].filter((note) => note.is_selected())[0];
    if (!note) {
        JSPLib.notice.error("No selected note!");
    } else {
        TA.$close_notice_link.click();
    }
    return note;
}

function GetAllNotesOrdered() {
    let [new_notes, saved_notes] = [...Danbooru.Note.notes].reduce((total, note) => ((note.id === null ? total[0].push(note) : total[1].push(note)) && total), [[], []]);
    saved_notes.sort((a, b) => (a.id - b.id));
    return JSPLib.utility.concat(saved_notes, new_notes);
}

function GetNotePlacement(note) {
    $('#ta-placement-info-x').text(note.x);
    $('#ta-placement-info-y').text(note.y);
    $('#ta-placement-info-w').text(note.w);
    $('#ta-placement-info-h').text(note.h);
}

function SetNotePlacement(note) {
    note.box.place_note(note.x, note.y, note.w, note.h, true);
    Danbooru.Note.Body.hide_all();
    note.box.$note_box.addClass("unsaved");
}

function SelectNote(callback) {
    if (Danbooru.Note.notes.size === 0) {
        JSPLib.notice.error("No notes to select!");
    }
    let all_notes = GetAllNotesOrdered();
    let current_note = all_notes.filter((note) => note.is_selected())[0];
    let select_note = callback(current_note, all_notes);
    if (current_note) {
        current_note.unselect();
    }
    select_note.select();
    select_note.box.$note_box[0].scrollIntoView({
        behavior: 'auto',
        block: 'center',
        inline: 'nearest'
    });
    if (!TA.has_embedded) {
        select_note.body.show();
    }
}

// CSS functions

function GetCSSStyles(overwrite, selector) {
    let add_styles = {};
    let invalid_styles = {};
    let test_div = document.createElement('div');
    $(selector).each((_i, input) => {
        let value = input.value.trim(/\s/);
        if (value === "" && !overwrite) return;
        let style_name = input.dataset.name;
        let [parse_style_name, parse_value] = STYLE_CONFIG[style_name]?.parse?.(style_name, value) || [style_name, value];
        let normalized_value = STYLE_CONFIG[style_name]?.normalize?.(parse_value) || parse_value;
        let use_style_name = (STYLE_CONFIG[style_name]?.use_parse ? parse_style_name : style_name);
        test_div.style.setProperty(use_style_name, normalized_value);
        if (test_div.style.getPropertyValue(use_style_name) === normalized_value) {
            let final_value = STYLE_CONFIG[style_name]?.finalize?.(parse_value) || parse_value;
            add_styles[parse_style_name] = final_value;
        } else {
            JSPLib.debug.debugwarn(`Invalid style [${style_name}]: ${value} => ${parse_value} -> ${normalized_value} != ${test_div.style.getPropertyValue(style_name)}`);
            invalid_styles[parse_style_name] = parse_value;
        }
    });
    JSPLib.debug.debuglog('GetCSSStyles', {add_styles, invalid_styles});
    return [add_styles, invalid_styles];
}

function MergeCSSStyles(style_dict, add_styles) {
    let copy_style_dict = JSPLib.utility.dataCopy(style_dict);
    let copy_keys = Object.keys(copy_style_dict);
    for (let style_name in add_styles) {
        copy_keys.forEach((key) => {
            if (STYLE_CONFIG[style_name]?.family?.includes(key)) {
                delete copy_style_dict[key];
            }
        });
        copy_style_dict[style_name] = add_styles[style_name];
    }
    return copy_style_dict;
}

//// CSS color

function ValidateColor(text) {
    let test_div = document.createElement('div');
    let normalized_color = NormalizeColor(text);
    test_div.style.color = normalized_color;
    return test_div.style.color === normalized_color;
}

function NormalizeColor(text) {
    var match;
    if (match = text.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i)) {
        text = '#' + match[1] + match[1] + match[2] + match[2] + match[3] + match[3];
    } else if (match = text.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])$/i)) {
        text = '#' + match[1] + match[1] + match[2] + match[2] + match[3] + match[3] + match[4] + match[4];
    }
    if (match = text.match(/^#([0-9a-f][0-9a-f])([0-9a-f][0-9a-f])([0-9a-f][0-9a-f])$/i)) {
        let [r, g, b] = [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
        return `rgb(${r}, ${g}, ${b})`;
    }
    if (match = text.match(/^#([0-9a-f][0-9a-f])([0-9a-f][0-9a-f])([0-9a-f][0-9a-f])([0-9a-f][0-9a-f])$/i)) {
        let [r, g, b, a] = [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16), parseFloat((parseInt(match[4], 16) / 255).toFixed(3))];
        if (a === 1) {
            return `rgb(${r}, ${g}, ${b})`;
        }
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
    return FinalizeColor(text);
}

function FinalizeColor(text) {
    var match;
    let compressed_text = text.split(/\s+/).join('');
    if (match = compressed_text.match(/^rgb\(([0-9]{1,3}),([0-9]{1,3}),([0-9]{1,3})\)$/)) {
        return `rgb(${match[1]}, ${match[2]}, ${match[3]})`;
    }
    if (match = compressed_text.match(/^rgba\(([0-9]{1,3}),([0-9]{1,3}),([0-9]{1,3}),([0-9.]{1,5})\)$/)) {
        if (parseFloat(match[4]) === 1) {
            return `rgb(${match[1]}, ${match[2]}, ${match[3]})`;
        }
        return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${match[4]})`;
    }
    return text;
}

//// CSS size

function ValidateSize(text) {
    let test_div = document.createElement('div');
    let normalized_size = NormalizeSize(text);
    test_div.style.top = normalized_size;
    return test_div.style.top === normalized_size;
}

function NormalizeSize(text) {
    return text.replace(/(?<=^|\s)0(?=$|\s)/g, '0px');
}

//// CSS direction

function ParseDirection(style_name, text) {
    let match = text.match(/^\s*(top|bottom|left|right)\s+(\S+)/);
    return (match ? [style_name + '-' + match[1], match[2]] : [style_name, text]);
}

function CopyDirection(style_name, text) {
    let [ , name, direction] = style_name.match(/(\S+)-(top|bottom|left|right)/);
    return [name, direction + ' ' + text];
}

function ParseDirectionStyles(style_dict) {
    let copy_style_dict = {};
    for (let style_name in style_dict) {
        let [copy_style_name, copy_value] = STYLE_CONFIG[style_name]?.copy?.(style_name, style_dict[style_name]) || [];
        if (copy_style_name) {
            copy_style_dict[copy_style_name] = copy_value;
        } else {
            copy_style_dict[style_name] = style_dict[style_name];
        }
    }
    return copy_style_dict;
}

//// CSS text shadow

function BuildTextShadowStyle(append, style_dict) {
    let errors = [];
    let attribs = Object.assign(...$('#ta-text-shadow-attribs input').map((i, entry) => ({[entry.dataset.name.trim()]: entry.value})));
    let initial_shadow = (append && style_dict['text-shadow']) || ""
    if (attribs.size === "") {
        return initial_shadow;
    }
    if (!ValidateSize(attribs.size)) errors.push("Invalid size specified.");
    if ((attribs.color !== "") && !ValidateColor(attribs.color)) errors.push("Invalid color specified.");
    if ((attribs.blur !== "") && !ValidateSize(attribs.blur)) errors.push("Invalid blur specified.");
    if (errors.length) {
        JSPLib.notice.error(errors.join('<br>'));
        return false;
    }
    attribs.color = FinalizeColor(attribs.color);
    let grid_points = $('#ta-text-shadow-grid input').filter((i, entry) => entry.checked).map((i, entry) => entry.value).toArray().map(JSON.parse);
    let text_shadows = grid_points.map((grid_point) => {
        let horizontal = (grid_point[0] === 0 ? '0' : "") || ((grid_point[0] === -1 ? '-' : "") + attribs.size);
        let vertical = (grid_point[1] === 0 ? '0' : "") || ((grid_point[1] === -1 ? '-' : "") + attribs.size);
        let text_shadow = horizontal + ' ' + vertical;
        text_shadow += (attribs.blur !== "" ? ' ' + attribs.blur : "");
        text_shadow += (attribs.color !== "" ? ' ' + attribs.color : "");
        return text_shadow;
    });
    return (initial_shadow ? initial_shadow + ', ' : "") + text_shadows.join(', ');
}

function TokenizeTextShadow(shadow) {
    let shadow_tokens = shadow.split(/\s+/);
    if (shadow_tokens.length < 2) return;
    if (!ValidateSize(shadow_tokens[0]) || !ValidateSize(shadow_tokens[1])) return;
    let size = (shadow_tokens[0].match(/^-?(?:0\.|[1-9]).*/) || shadow_tokens[1].match(/^-?(?:0\.|[1-9]).*/) || [])[0];
    if (!size) return;
    size = (size[0] === '-' ? size.slice(1) : size);
    let shadow_style = {size};
    if (shadow_tokens.length === 3) {
        if (ValidateSize(shadow_tokens[2])) {
            shadow_style.blur = shadow_tokens[2];
        } else if (ValidateColor(shadow_tokens[2])) {
            shadow_style.color = shadow_tokens[2];
        }
    } else if (shadow_tokens.length === 4) {
        if (ValidateSize(shadow_tokens[2])) {
            shadow_style.blur = shadow_tokens[2];
        }
        if (ValidateColor(shadow_tokens[3])) {
            shadow_style.color = shadow_tokens[3];
        }
    }
    return shadow_style;
}

function ParseTextShadows(style_dict) {
    if (!style_dict['text-shadow']) return;
    let text_shadows = style_dict['text-shadow'].split(',').map((str) => str.trim());
    //The first shadow is used for style parsing
    let shadow_style = TokenizeTextShadow(text_shadows[0]);
    if (!shadow_style) return;
    ['left', 'center', 'right'].forEach((colname) => {
        ['top', 'middle', 'bottom'].forEach((rowname) => {
            let input_name = 'shadow-grid-' + rowname + '-' + colname;
            TA.shadow_grid[input_name] = false;
        });
    });
    text_shadows.forEach((shadow) => {
        let style = TokenizeTextShadow(shadow);
        if (!style) return;
        //Break out of the loop when a new style is detected
        if (style.blur !== shadow_style.blur || style.color !== shadow_style.color) return false;
        let match = shadow.match(/^\s*(-)?(\d)\S*\s+(-)?(\d)/);
        if (!match) return null;
        let colname = (match[1] ? 'left' : (match[2] === '0' ? 'center' : 'right'));
        let rowname = (match[3] ? 'top' : (match[4] === '0' ? 'middle' : 'bottom'));
        let input_name = 'shadow-grid-' + rowname + '-' + colname;
        TA.shadow_grid[input_name] = true;
    });
    JSPLib.debug.debuglog('ParseTextShadows', {shadow_style, shadow_grid: TA.shadow_grid});
    return shadow_style;
}

// Dialogs

function OpenLoadDialog(panel) {
    if (!TA.$load_dialog[panel]) {
        let $dialog = $(RenderLoadDialog(panel));
        $dialog.find('.ta-load-session-item').on(PROGRAM_CLICK, LoadSessionInput);
        $dialog.find('.ta-load-saved-controls a').on(PROGRAM_CLICK, LoadControls);
        $dialog.dialog(LOAD_DIALOG_SETTINGS);
        TA.$load_dialog[panel] = $dialog;
    }
    TA.active_panel = panel;
    TA.$load_dialog[panel].dialog('open');
}

function OpenRubyDialog() {
    if (!TA.$ruby_dialog) {
        TA.$ruby_dialog = $(RenderRubyDialog());
        TA.$ruby_dialog.find('#ta-ruby-dialog-tabs > .ta-menu-tab').on(PROGRAM_CLICK, SwitchRubySections);
        TA.$ruby_dialog.dialog(RUBY_DIALOG_SETTINGS);
        TA.$pin_button = $("<button/>").button({icons: {primary: "ui-icon-pin-w"}, label: "pin", text: false});
        TA.$pin_button.css({width: "20px", height: "20px", position: "absolute", right: "28.4px"});
        TA.$ruby_dialog.parent().children(".ui-dialog-titlebar").append(TA.$pin_button);
        TA.$pin_button.on(PROGRAM_CLICK, PinRubyDialog);
    }
    TA.$ruby_dialog.dialog('open');
}

// Event handlers

//// Side menu handlers

function OpenSideMenu() {
    if ($("body").hasClass("mode-translation")) {
        ToggleSideMenu(true);
    }
}

function CloseSideMenu() {
    ToggleSideMenu(false);
    if (!TA.close_notice_shown && TA.user_settings.close_notice_enabled) {
        JSPLib.notice.notice("The Translator Assist menu can be reopened by clicking <u>Translator Assist</u> in the <b>Post options</b> menu (Alt+T).");
        TA.close_notice_shown = true;
    } else {
        TA.$close_notice_link.click();
    }
}

function ResetSideMenu() {
    TA.$side_menu.css({top: '', left: '', fontSize: ''});
}

function ResizeSideMenu(event) {
    let additive = $(event.currentTarget).data('add');
    let font_size_str = window.getComputedStyle(TA.$side_menu[0]).fontSize;
    let font_size = Number(font_size_str.match(/^\d+/)[0]);
    TA.$side_menu[0].style.fontSize = JSPLib.utility.clamp(font_size + additive, 9, 18) + 'px';
}

function KeyboardMenuToggle() {
    if ($("body").hasClass("mode-translation")) {
        ToggleSideMenu(!TA.side_menu_open);
    }
}

function SwitchSections(event) {
    $('#ta-side-menu-tabs .ta-menu-tab').removeClass('ta-active');
    $(event.currentTarget).addClass('ta-active');
    let value = $(event.currentTarget).data('value');
    let selector = '#ta-section-' + value;
    $('#ta-sections > div').hide();
    $(selector).show();
    if (value === 'main' || value === 'embedded') {
        $('#ta-menu-options').show();
    } else {
        $('#ta-menu-options').hide();
    }
    if (value === 'controls' || value === 'codes') {
        $('#ta-menu-controls').hide();
    } else {
        $('#ta-menu-controls').show();
    }
    TA.mode = value;
}

function ToggleSideNotice() {
    if (!TA.initialized) {
        InitializeSideMenu();
    }
    if(!$("body").hasClass("mode-translation")) {
        if (!TA.last_noter_queried && TA.user_settings.query_last_noter_enabled) {
            QueryLastNotation();
        } else {
            ToggleSideMenu(true, false);
        }
        if (TA.user_settings.new_noter_check_enabled) {
            let interval_period = TA.user_settings.new_noter_check_interval * JSPLib.utility.one_minute;
            TA.poll_timer = setInterval(() => {PollForNewNotations();}, interval_period);
        }
    } else {
        if (TA.side_menu_open) {
            ToggleSideMenu(false, false);
        }
        if (TA.user_settings.new_noter_check_enabled) {
            clearInterval(TA.poll_timer);
        }
    }
    TA.$post_option.hide();
}

//// Main handlers

function CopyTagStyles() {
    let text_area = GetActiveTextArea(false);
    if (!text_area) return;
    let html_tag = GetTag(text_area.value, text_area.selectionStart);
    if (!html_tag) return;
    let style_dict = ParseDirectionStyles(html_tag.style_dict);
    if (TA.mode === 'constructs') {
        let shadow_style = ParseTextShadows(style_dict);
        if (!shadow_style) {
            ShowErrorMessages(["No valid text shadows found."]);
            return;
        }
        style_dict = shadow_style;
        $('#ta-text-shadow-grid input').each((_i, input) => {
            let input_name = input.name;
            let input_value = TA.shadow_grid[input_name];
            input.checked = input_value;
        });
    }
    let selector = INPUT_SECTIONS[TA.mode];
    $(selector).each((_i, input) => {
        let style_name = input.dataset.name;
        let style_value = style_dict[style_name] || "";
        input.value = style_value;
    });
}

function ApplyTagStyles() {
    let text_area = GetActiveTextArea(false);
    if (!text_area) return;
    SaveHTML(text_area);
    let html_tag = GetTag(text_area.value, text_area.selectionStart);
    if (!html_tag) return;
    let overwrite = $('#ta-css-style-overwrite').get(0)?.checked;
    var add_styles = {};
    var invalid_styles = {};
    if (TA.mode === 'constructs') {
        let append = $('#ta-text-shadow-append').get(0)?.checked;
        let text_shadow_style = BuildTextShadowStyle(append, html_tag.style_dict);
        if (text_shadow_style === false) return;
        add_styles['text-shadow'] = text_shadow_style;
    } else {
        [add_styles, invalid_styles] = GetCSSStyles(overwrite, INPUT_SECTIONS[TA.mode]);
    }
    let style_errors = Object.entries(invalid_styles).map((style_pair) => (`<code>${style_pair[0]}</code> => "${style_pair[1]}"`));
    if (Object.keys(add_styles).length) {
        UpdateHTMLStyles(text_area, add_styles);
    } else if (!overwrite && style_errors.length === 0) {
        ShowErrorMessages(["No styles entered."]);
        return;
    }
    if (style_errors.length) {
        ShowStyleErrors(style_errors);
    } else {
        TA.$close_notice_link.click();
    }
}

function ClearTagStyles() {
    ClearInputs(INPUT_SECTIONS[TA.mode]);
}

function LoadTagStyles() {
    OpenLoadDialog(TA.mode);
}

//// Main section handlers

function ApplyBlock(event) {
    let text_area = GetActiveTextArea(false);
    if (!text_area) return;
    SaveHTML(text_area);
    if (IsInsideHTMLTag(text_area.value, text_area.selectionStart)) {
        ChangeBlockElement(text_area, event.currentTarget.value);
    } else {
        AddBlockElement(text_area, event.currentTarget.value);
    }
}

function DeleteBlock() {
    let text_area = GetActiveTextArea(false);
    if (!text_area) return;
    if (IsInsideHTMLTag(text_area.value, text_area.selectionStart)) {
        SaveHTML(text_area);
        DeleteBlockElement(text_area);
    } else {
        JSPLib.notice.error("No tag selected!");
    }
}

function SaveHTML(text_area) {
    let $text_area = $(text_area);
    let undo_actions = $text_area.data('undo_actions') || [];
    let undo_index = $text_area.data('undo_index') || 0;
    undo_actions = undo_actions.slice(0, undo_index);
    undo_actions.push(text_area.value);
    $text_area.data('undo_actions', undo_actions);
    $text_area.data('undo_index', undo_actions.length);
    $text_area.data('undo_saved', true);
    JSPLib.debug.debuglog('SaveMarkup', {undo_actions, undo_index});
}

function UndoAction() {
    let text_area = GetActiveTextArea(false);
    if (!text_area) return;
    let $text_area = $(text_area);
    let {undo_actions = [], undo_index = 0, undo_saved} = $text_area.data();
    if (undo_saved) {
        undo_actions.push(text_area.value);
        $text_area.data('undo_actions', undo_actions);
    }
    let undo_html = undo_actions.slice(undo_index - 1, undo_index)[0];
    if (JSPLib.validate.isString(undo_html)) {
        text_area.value = undo_html;
    } else {
        JSPLib.notice.notice("Beginning of actions buffer reached.");
    }
    let new_index = Math.max(0, undo_index - 1);
    $text_area.data('undo_index', new_index);
    $text_area.data('undo_saved', false);
    JSPLib.debug.debuglog('UndoAction', {undo_actions, undo_index, new_index});
    return Boolean(undo_html);
}

function RedoAction() {
    let text_area = GetActiveTextArea(false);
    if (!text_area) return;
    let $text_area = $(text_area);
    let {undo_actions = [], undo_index = 0} = $text_area.data();
    let undo_html = undo_actions.slice(undo_index + 1, undo_index + 2)[0];
    if (undo_html) {
        text_area.value = undo_html;
    } else {
        JSPLib.notice.notice("End of actions buffer reached.");
    }
    let new_index = Math.min(undo_actions.length - 1, undo_index + 1);
    $text_area.data('undo_index', new_index);
    $text_area.data('undo_saved', false);
    JSPLib.debug.debuglog('RedoAction', {undo_actions, undo_index, new_index});
    return Boolean(undo_html);
}

function ClearActions(event) {
    let $text_area = $(event.currentTarget);
    $text_area.data('undo_actions', []);
    $text_area.data('undo_index', 0);
    $text_area.data('undo_saved', false);
    JSPLib.debug.debuglog('Cleared actions.');
}

function NormalizeNote() {
    let text_area = GetActiveTextArea();
    if (!text_area) return;
    SaveHTML(text_area);
    let html_text = text_area.value;
    let normalized_text = $('<div>' + html_text + '</div>').html();
    text_area.value = normalized_text;
    text_area.focus();
}

async function SanitizeNote() {
    let text_area = GetActiveTextArea();
    if (!text_area) return;
    SaveHTML(text_area);
    let data = await JSPLib.danbooru.submitRequest('note_previews', {body: text_area.value});
    text_area.value = data.body;
    text_area.focus();
}

async function ValidateNote() {
    let text_area = GetActiveTextArea();
    if (!text_area) return;
    let transform_html = text_area.value.replace(/<tn>/g, '<p class="tn">').replace(/<\/tn>/g, '</p>');
    let html_errors = await ValidateHTML(transform_html);
    if (html_errors === null) {
        return;
    }
    let error_lines = [];
    if (html_errors.messages.length) {
        JSPLib.debug.debuglog("HTML errors:", html_errors);
        error_lines = html_errors.messages.map((message,i) => RenderHTMLError(i, message, transform_html));
    }
    let css_errors = ValidateCSS(text_area.innerHTML);
    if (css_errors.length) {
        JSPLib.debug.debuglog("CSS errors:", css_errors);
        error_lines = JSPLib.utility.concat(error_lines, css_errors.map((error, i) => RenderCSSError(i, error)));
    }
    if (error_lines.length) {
        JSPLib.notice.error('<ul>' + error_lines.join('') + '</ul>');
    }
}

//// Constructs section handlers

function TextShadowControls(event) {
    let value = $(event.currentTarget).data('value');
    switch (value) {
        case 'all':
            $('#ta-text-shadow-grid input').each((i, entry) => {$(entry).prop('checked', true);});
            break;
        case 'sides':
            $('#ta-text-shadow-grid .ta-grid-side').each((i, entry) => {$(entry).prop('checked', true);});
            $('#ta-text-shadow-grid .ta-grid-corner').each((i, entry) => {$(entry).prop('checked', false);});
            break;
        case 'corners':
            $('#ta-text-shadow-grid .ta-grid-corner').each((i, entry) => {$(entry).prop('checked', true);});
            $('#ta-text-shadow-grid .ta-grid-side').each((i, entry) => {$(entry).prop('checked', false);});
            break;
        case 'none':
            $('#ta-text-shadow-grid input').each((i, entry) => {$(entry).prop('checked', false);});
            //falls through
        default:
            //do nothing
    }
}

//// Embedded section handlers

function ToggleEmbeddedMode() {
    if (TA.has_embedded) {
        $('meta[name=post-has-embedded-notes]').attr('content', 'false');
        $('#ta-embedded-status-text').text('Disabled').css('color', 'red');
        $('#ta-side-embedded-sections').hide();
        $('#post_has_embedded_notes').attr('checked', false);
    } else {
        $('meta[name=post-has-embedded-notes]').attr('content', 'true');
        $('#ta-embedded-status-text').text('Enabled').css('color', 'green');
        $('#ta-side-embedded-sections').show();
        $('#post_has_embedded_notes').attr('checked', true);
    }
    let $notes = $('#notes');
    Danbooru.Note.notes.forEach((note) => {
        if (note.id === null) return;
        let santized_html = (note.body.$note_body.html() === '<em>Click to edit</em>' ? note.box.$inner_border.html() : note.body.$note_body.html());
        let original_html = note.original_body;
        if (TA.starting_notes.has(note.id)) {
            let $note = $notes.find(`[data-id="${note.id}"]`);
            $note.attr({
                'data-width': note.w,
                'data-height': note.h,
                'data-x': note.x,
                'data-y': note.y,
                'data-id': note.id,
                'data-body': JSPLib.utility.HTMLEscape(original_html),
            });
            $note.html(santized_html);
        } else {
            let html = `<article data-width="${note.w}" data-height="${note.h}" data-x="${note.x}" data-y="${note.y}" data-id="${note.id}" data-body="${JSPLib.utility.HTMLEscape(original_html)}">${santized_html}</article>`;
            $notes.append(html);
            TA.starting_notes.add(note.id);
        }
    });
    ReloadNotes();
    TA.has_embedded = !TA.has_embedded;
    JSPLib.network.put(`/posts/${TA.post_id}.json`, {data: {post: {has_embedded_notes: TA.has_embedded}}}).then(
        () => {JSPLib.notice.notice("Settings updated.");},
        () => {JSPLib.notice.error("Error updating settings.");},
    );
}

function AddEmbeddedElement() {
    let text_area = GetActiveTextArea(false);
    if (!text_area) return;
    SaveHTML(text_area);
    let html_text = text_area.value;
    let html_tag = GetTag(html_text, text_area.selectionStart, false);
    if (html_tag) {
        ShowErrorMessages(['Tag with class <code>note-box-attributes</code> already exists.']);
        return;
    }
    let note_html = (html_tag ? html_text.replace(html_tag.full_tag, "") : html_text);
    let initialize = $('#ta-css-style-initialize').get(0)?.checked;
    let [add_styles, invalid_styles] = (initialize ? GetCSSStyles(false, INPUT_SECTIONS[TA.mode]) : [{}, {}]);
    let embedded_tag = BuildHTMLTag('div', {class: 'note-box-attributes'}, add_styles, true) + '</div>';
    note_html += embedded_tag;
    text_area.value = note_html;
    let style_errors = Object.entries(invalid_styles).map((style_pair) => (`<code>${style_pair[0]}</code> => "${style_pair[1]}"`));
    if (style_errors.length) {
        ShowStyleErrors(style_errors);
    } else {
        TA.$close_notice_link.click();
    }
}

function RemoveEmbeddedElement() {
    let text_area = GetActiveTextArea();
    if (!text_area) return;
    SaveHTML(text_area);
    let html_text = text_area.value;
    let html_tag = GetTag(html_text, text_area.selectionStart);
    if (!html_tag) return;
    text_area.value = html_text.replace(html_tag.full_tag, "");
}

function SetEmbeddedLevel() {
    let text_area = GetActiveTextArea();
    if (!text_area) return;
    SaveHTML(text_area);
    let html_text = text_area.value;
    let html_tag = GetTag(html_text, text_area.selectionStart);
    if (!html_tag) return;
    let classlist = html_tag.attrib_dict["class"].split(/\s+/).filter((classname) => (!classname.match(/level-[1-5]/)));
    let level = $('#ta-embedded-level-select').val();
    if (level.match(/^[1-5]$/)){
        classlist.push('level-' + level);
    }
    html_tag.attrib_dict["class"] = classlist.join(' ');
    let final_tag = BuildHTMLTag(html_tag.tag_name, html_tag.attrib_dict, html_tag.style_dict);
    text_area.value = html_text.replace(html_tag.open_tag, final_tag);
}

//// Controls section handlers

function GetPlacement() {
    let note = GetMovableNote();
    if (!note) return;
    GetNotePlacement(note);
}

function PlacementControl(event) {
    let note = GetMovableNote();
    if (!note) return;
    let action = $(event.currentTarget).data('action');
    switch (action) {
        case 'move-up':
            note.y -= 1;
            break;
        case 'move-down':
            note.y += 1;
            break;
        case 'move-left':
            note.x -= 1;
            break;
        case 'move-right':
            note.x += 1;
            break;
        case 'contract-width':
            note.w -= 1;
            break;
        case 'expand-width':
            note.w += 1;
            break;
        case 'contract-height':
            note.h -= 1;
            break;
        case 'expand-height':
            note.h += 1;
            //falls through
        default:
            //do nothing
    }
    SetNotePlacement(note);
    GetNotePlacement(note);
}

function SaveNote() {
    let note = GetMovableNote();
    if (!note) return;
    let params = {
        x: note.x,
        y: note.y,
        width: note.w,
        height: note.h,
    };
    var note_promise;
    if (note.is_new()) {
        // The body is only saveable this way for new notes; otherwise use the edit dialog.
        params.body = note.original_body;
        params.post_id = note.post_id;
        note_promise = JSPLib.network.post(`/notes.json`, {data: {note: params }});
    } else {
        note_promise = JSPLib.network.put(`/notes/${note.id}.json`, {data: {note: params }});
    }
    note_promise.then(
        (response) => {
            if (note.is_new()) {
                note.id = response.id;
            }
            note.box.$note_box.removeClass("unsaved");
            JSPLib.notice.notice(`Note #${note.id} saved.`);
        },
        () => {JSPLib.notice.error(`Error saving note #${note.id}`);}
    );
}

function ResetNote() {
    let note = GetMovableNote();
    if (!note) return;
    if (!note.is_new()) {
        JSPLib.network.getJSON(`/notes/${note.id}.json`).then((data) => {
            note.box.place_note(data.x, data.y, data.width, data.height);
            let text_area = GetActiveTextArea();
            if (text_area) {
                text_area.value = data.body;
            }
            note.body.preview_text(data.body).then(() => {
                JSPLib.notice.notice(`Note #${note.id} reset.`);
                note.box.$note_box.removeClass("unsaved");
            });
        });
    } else {
        JSPLib.notice.error("Reset not available for new unsaved notes.");
    }
}

function DeleteNote() {
    let note = GetMovableNote();
    if (!note) return;
    if (!note.is_new()) {
        if (!confirm("Do you really want to delete this note?")) return;
        JSPLib.network["delete"](`/notes/${note.id}.json`).then(
            () => {JSPLib.notice.notice(`Note #${note.id} deleted.`);},
            () => {JSPLib.notice.error(`Error deleting note #${note.id}.`);},
        );
    }
    note.box.$note_box.remove();
    note.body.$note_body.remove();
    Danbooru.Note.notes["delete"](note);
    TA.starting_notes["delete"](note.id);
}

function EditNote() {
    let note = GetMovableNote();
    if (!note) return;
    Danbooru.Note.Edit.show(note);
}

function ShowNote() {
    let note = GetMovableNote();
    if (!note) return;
    note.box.$note_box.show();
    note.body.$note_body.show();
}

function HideNote() {
    let note = GetMovableNote();
    if (!note) return;
    note.box.$note_box.hide();
    note.body.$note_body.hide();
}

function NextNote() {
    SelectNote((current_note, all_notes) => {
        if (current_note) {
            let next_index = (all_notes.indexOf(current_note) + 1) % Danbooru.Note.notes.size ;
            return all_notes[next_index];
        }
        return all_notes[0];
    });
}

function PreviousNote() {
    SelectNote((current_note, all_notes) => {
        if (current_note) {
            let previous_index = all_notes.indexOf(current_note) - 1;
            previous_index = (previous_index < 0 ? (Danbooru.Note.notes.size - 1) : previous_index);
            return all_notes[previous_index];
        }
        return all_notes.slice(-1)[0];
    });
}

function UnselectNote() {
    let note = GetMovableNote();
    if (!note) return;
    note.unselect();
}

function CopyNote() {
    let note = GetMovableNote();
    let copy_note = new Danbooru.Note({
        // Randomly place note within random width/height distance
        x: JSPLib.utility.clamp(2 * note.w * (Math.random() - 0.5) + note.x, 0, note.post_width - note.w),
        y: JSPLib.utility.clamp(2 * note.h * (Math.random() - 0.5) + note.y, 0, note.post_height - note.h),
        w: note.w,
        h: note.h,
        original_body: note.original_body,
        sanitized_body: (TA.has_embedded ? note.box.$inner_border.html() : note.body.$note_body.html()),
    });
    copy_note.select();
}

//// Codes section handlers

function InsertCharacter(event) {
    let text_area = GetActiveTextArea();
    if (!text_area) return;
    let value = event.currentTarget.value;
    let cursor = text_area.selectionStart;
    let html_text = text_area.value;
    text_area.value = html_text.slice(0, cursor) + value + html_text.slice(text_area.selectionEnd);
    text_area.focus();
    text_area.setSelectionRange(cursor + value.length, cursor + value.length);
}

//// Ruby dialog handlers

function SwitchRubySections(event) {
    $('#ta-ruby-dialog-tabs .ta-menu-tab').removeClass('ta-active');
    $(event.currentTarget).addClass('ta-active');
    let value = $(event.currentTarget).data('value');
    let selector = '#ta-ruby-dialog-styles-' + value;
    $('#ta-ruby-dialog-style_sections > div').hide();
    $(selector).show();
}

function PinRubyDialog() {
    let $dialog_widget = TA.$ruby_dialog.closest('.ui-dialog');
    let pos = $dialog_widget.offset();
    if ($dialog_widget.css("position") === "absolute") {
        pos.left -= $(window).scrollLeft();
        pos.top -= $(window).scrollTop();
        $dialog_widget.offset(pos).css({ position: "fixed" });
        TA.$ruby_dialog.dialog("option", "resize", () => { $dialog_widget.css({ position: "fixed" }); });
        TA.$pin_button.button("option", "icons", {primary: "ui-icon-pin-s"});
    } else {
        pos.left += $(window).scrollLeft();
        pos.top += $(window).scrollTop();
        $dialog_widget.offset(pos).css({ position: "absolute" });
        TA.$ruby_dialog.dialog("option", "resize", () => { /* do nothing */ });
        TA.$pin_button.button("option", "icons", {primary: "ui-icon-pin-w"});
    }
}

function CopyRubyTag() {
    let text_area = GetActiveTextArea();
    if (!text_area) return;
    let ruby_tag = GetRubyTag(text_area.value, text_area.selectionStart);
    if (!ruby_tag) {
        ShowErrorMessages(["No open ruby tag selected."]);
        return;
    }
    let overall_style_dict = ParseDirectionStyles(ruby_tag.overall.style_dict);
    $('#ta-ruby-dialog-styles-overall input').each((_i, input) => {
        let style_name = input.dataset.name;
        let style_value = overall_style_dict[style_name] || "";
        input.value = style_value;
    });
    ['top', 'bottom'].forEach((direction) => {
        if (ruby_tag[direction].length) {
            let style_dict = ruby_tag[direction][0].style_dict;
            $(`#ta-ruby-dialog-styles-${direction} input`).each((_i, input) => {
                let style_name = input.dataset.name;
                let style_value = style_dict[style_name] || "";
                input.value = style_value;
            });
            let segments = JSPLib.utility.getObjectAttributes(ruby_tag[direction], 'inner_html');
            $(`#ta-ruby-${direction} textarea`).val(segments.join('\n'));
        }
    });
}

function ApplyRubyTag() {
    let text_area = GetActiveTextArea(false);
    if (!text_area) return;
    SaveHTML(text_area);
    let ruby_tag = GetRubyTag(text_area.value, text_area.selectionStart);
    if (!ruby_tag && IsInsideHTMLTag(text_area.value, text_area.selectionStart)) {
        JSPLib.notice.error(`Invalid selection range at cursor start... cannot create a ruby tag inside another tag.`);
        return;
    }
    let top_segments = $('#ta-ruby-top textarea').val().split(/\r?\n/).filter((line) => line.trim() !== "");
    let bottom_segments = $('#ta-ruby-bottom textarea').val().split(/\r?\n/).filter((line) => line.trim() !== "");
    if (top_segments.length !== bottom_segments.length) {
        JSPLib.notice.error(`The number of segments (lines) do not match: <b>Top:</b> ${top_segments.length} <b>Bottom:</b> ${bottom_segments.length}`);
        return;
    }
    let [overall_add_styles, overall_invalid_styles] = GetCSSStyles(false, '#ta-ruby-dialog-styles-overall input');
    let [top_add_styles, top_invalid_styles] = GetCSSStyles(false, '#ta-ruby-dialog-styles-top input');
    let [bottom_add_styles, bottom_invalid_styles] = GetCSSStyles(false, '#ta-ruby-dialog-styles-bottom input');
    let ruby_segments = [];
    for (let i = 0; i < top_segments.length; i++) {
        let top_segment = BuildHTMLTag('rt', {}, top_add_styles) + top_segments[i].replace(' ', '\u2002') + '</rt>';
        let bottom_segment = BuildHTMLTag('span', {}, bottom_add_styles) + bottom_segments[i].replace(' ', '\u2002') + '</span>';
        ruby_segments.push(bottom_segment + top_segment);
    }
    let overall_segment = BuildHTMLTag('ruby', {}, overall_add_styles) + ruby_segments.join("") + '</ruby>';
    let select_start = (ruby_tag ? ruby_tag.overall.open_tag_start : text_area.selectionStart);
    let final_text = text_area.value.slice(0, select_start);
    final_text += overall_segment;
    let select_end = final_text.length;
    let slice_end = (ruby_tag ? ruby_tag.overall.close_tag_end : select_start);
    final_text += text_area.value.slice(slice_end);
    text_area.value = final_text;
    text_area.focus();
    text_area.setSelectionRange(select_start, select_end);
    let style_errors = Object.entries(overall_invalid_styles).map((style_pair) => (`<b>Overall</b> - <code>${style_pair[0]}</code> => "${style_pair[1]}"`));
    style_errors = JSPLib.utility.concat(style_errors, Object.entries(top_invalid_styles).map((style_pair) => (`<b>Top</b> - <code>${style_pair[0]}</code> => "${style_pair[1]}"`)));
    style_errors = JSPLib.utility.concat(style_errors, Object.entries(bottom_invalid_styles).map((style_pair) => (`<b>Bottom</b> - <code>${style_pair[0]}</code> => "${style_pair[1]}"`)));
    if (style_errors.length) {
        ShowStyleErrors(style_errors);
    } else {
        TA.$close_notice_link.click();
    }
}

function LoadRubyStyles() {
    OpenLoadDialog('ruby');
}

//// Load dialog handlers

function SaveSession() {
    var name, key, isnew;
    let panel = TA.active_panel;
    let $dialog = TA.$load_dialog[panel];
    let checked_sessions = $dialog.find('li').filter((i, entry) => $(entry).find('input').prop('checked'));
    if (checked_sessions.length > 1) {
        JSPLib.notice.error("Multiple sessions selected... select only 1 to edit, or none to create a new.");
        return;
    }
    if (checked_sessions.length === 0) {
        name = prompt("Enter a name for this session:");
        if (!name) return;
        name = JSPLib.utility.maxLengthString(name, 50);
        key = JSPLib.utility.getUniqueID();
        let session_list = JSPLib.storage.getStorageData('ta-load-session-' + panel, localStorage, []);
        session_list.push({key, name});
        JSPLib.storage.setStorageData('ta-load-session-' + panel, session_list, localStorage);
        isnew = true;
    } else {
        ({key, name} = checked_sessions.find('a')[0].dataset);
        isnew = false;
    }
    let section_keys = LOAD_PANEL_KEYS[panel];
    let save_inputs = {};
    section_keys.forEach((key) => {
        save_inputs = Object.assign(save_inputs, GetInputs(key));
    });
    JSPLib.storage.setStorageData('ta-session-' + key, save_inputs, localStorage);
    if (isnew) {
        let $load_item = $(RenderLoadItem({key, name}));
        $load_item.find('a').on(PROGRAM_CLICK, LoadSessionInput);
        let $list = TA.$load_dialog[panel].find('.ta-load-sessions ul');
        if ($list.length === 0) {
            $list = $('<ul></ul>');
            TA.$load_dialog[panel].find('.ta-load-sessions').html("").append($list);
        }
        $list.append($load_item);
    }
    JSPLib.notice.notice('Session saved.');
}

function RenameSession() {
    let panel = TA.active_panel;
    let $dialog = TA.$load_dialog[panel];
    let checked_sessions = $dialog.find('li').filter((i, entry) => $(entry).find('input').prop('checked'));
    if (checked_sessions.length === 0) {
        JSPLib.notice.error("Must select at least 1 session to rename.");
        return;
    }
    if (checked_sessions.length > 1) {
        JSPLib.notice.error("Must select only 1 session to rename.");
        return;
    }
    let $link = checked_sessions.find('a');
    let key = Number($link[0].dataset.key);
    let name = prompt("Enter a name for this session:");
    if (!name) return;
    let session_list = JSPLib.storage.getStorageData('ta-load-session-' + panel, localStorage, []);
    let rename_item = session_list.find((item) => item.key === key);
    rename_item.name = name;
    JSPLib.storage.setStorageData('ta-load-session-' + panel, session_list, localStorage);
    $link.attr('data-name', name);
    $link.text(name);
    JSPLib.notice.notice('Session renamed.');
}

function DeleteSessions() {
    let panel = TA.active_panel;
    let $dialog = TA.$load_dialog[panel];
    let update_items = [];
    $dialog.find('.ta-load-sessions input').each((_i, input) => {
        let key = input.id.match(/^ta-delete-(.*)/)[1];
        let $link = $dialog.find(`.ta-load-session-item[data-key=${key}]`);
        let item = $link.data();
        if (input.checked) {
            $link.closest('li').addClass('ta-delete');
            JSPLib.storage.removeStorageData('ta-session-' + item.key, localStorage);
        } else {
            update_items.push(item);
        }
    });
    let session_list = JSPLib.storage.getStorageData('ta-load-session-' + panel, localStorage, []);
    if (update_items.length !== session_list.length) {
        $dialog.find('.ta-delete').remove();
        JSPLib.storage.setStorageData('ta-load-session-' + panel, update_items, localStorage);
        JSPLib.notice.notice('Sessions deleted.');
        if (update_items.length === 0) {
            TA.$load_dialog[panel].find('.ta-load-sessions').html(NO_SESSIONS);
        }
    } else {
        JSPLib.notice.error('No sessions selected!');
    }
}

function LoadSessionInput(event) {
    let panel = TA.active_panel;
    let {key} = $(event.currentTarget).data();
    let session_list = JSPLib.storage.getStorageData('ta-load-session-' + panel, localStorage);
    let session_item = session_list.find((item) => item.key === key);
    let load_inputs = JSPLib.storage.getStorageData('ta-session-' + key, localStorage);
    if (!load_inputs) {
        JSPLib.debug.debugerror('Missing session:', panel, key, session_item);
        session_list = session_list.filter((item) => item.key !== key);
        JSPLib.storage.setStorageData('ta-load-session-' + panel, session_list, localStorage);
        $(event.currentTarget).closest('li').remove();
        return;
    }
    let section_keys = LOAD_PANEL_KEYS[panel];
    section_keys.forEach((section_key) => {
        SetInputs(section_key, load_inputs);
    });
    JSPLib.notice.notice("Inputs loaded.");
}

function LoadControls(event) {
    let panel = TA.active_panel;
    let $dialog = TA.$load_dialog[panel];
    let value = $(event.currentTarget).data('value');
    switch (value) {
        case 'all':
            $dialog.find('.ta-load-sessions input').each((_i, input) => {input.checked = true;});
            break;
        case 'none':
            $dialog.find('.ta-load-sessions input').each((_i, input) => {input.checked = false;});
            break;
        case 'invert':
            $dialog.find('.ta-load-sessions input').each((_i, input) => {input.checked = !input.checked;});
            //falls through
        default:
            //do nothing
    }
}

// Last noted functions

function CheckLastNoted() {
    let seen_key = 'ta-post-seen-' + TA.post_id;
    let last_noted_cutoff = TA.user_settings.last_noted_cutoff * JSPLib.utility.one_minute;
    if ((Date.now() - TA.last_noted) < last_noted_cutoff) {
        let post_seen = JSPLib.storage.getStorageData(seen_key, sessionStorage, false);
        if (!post_seen) {
            alert("Post was noted: " + JSPLib.utility.timeAgo(TA.last_noted));
        }
    }
    JSPLib.storage.setStorageData(seen_key, true, sessionStorage);
}

function CheckMissedLastNoterPolls() {
    if (TA.missed_poll && !TA.noter_detected && !document.hidden) {
        QueryNewNotations();
        TA.missed_poll = false;
    }
}

function PollForNewNotations() {
    if (!TA.noter_detected && !document.hidden) {
        QueryNewNotations();
        TA.missed_poll = false;
    } else {
        TA.missed_poll = true;
    }
}

// Side menu functions

function ToggleSideMenu(open_menu, toggle_link = true) {
    if (open_menu) {
        TA.$side_menu.show();
        TA.$side_menu.draggable({cancel: 'a, button, input, select, label, .ta-cursor-text'});
        if (toggle_link) {
            TA.$post_option.hide();
        }
        $(window).on('beforeunload.ta', SaveMenuState);
    } else {
        TA.$side_menu.hide();
        TA.$side_menu.draggable('destroy');
        if (toggle_link) {
            TA.$post_option.show();
        }
        $(window).off('beforeunload.ta');
        SaveMenuState();
    }
    TA.side_menu_open = open_menu;
}

function InitializeSideMenu() {
    TA.save_data = JSPLib.storage.getStorageData('ta-saved-inputs', localStorage, {});
    $('#page').append(RenderSideMenu());
    if (TA.user_settings.text_shadow_enabled || TA.user_settings.ruby_enabled) {
        $('#ta-side-menu-tabs [data-value=constructs]').show();
    }
    if (TA.user_settings.embedded_enabled) {
        $('#ta-side-menu-tabs [data-value=embedded]').show();
        if (TA.has_embedded) {
            $('#ta-side-embedded-sections').show();
        }
    }
    if (TA.user_settings.controls_enabled) {
        $('#ta-side-menu-tabs [data-value=controls]').show();
    }
    if (TA.user_settings.codes_enabled) {
        $('#ta-side-menu-tabs [data-value=codes]').show();
    }
    $('#post-option-add-note').after(MENU_OPTION);
    $('#ta-side-menu-tabs .ta-menu-tab').on(PROGRAM_CLICK, SwitchSections);
    $('#ta-toggle-embedded-mode').on(PROGRAM_CLICK, ToggleEmbeddedMode);
    $('#ta-add-embedded-element').on(PROGRAM_CLICK, AddEmbeddedElement);
    $('#ta-remove-embedded-element').on(PROGRAM_CLICK, RemoveEmbeddedElement);
    $('#ta-set-embedded-level').on(PROGRAM_CLICK, SetEmbeddedLevel);
    $('.ta-apply-block-element').on(PROGRAM_CLICK, ApplyBlock);
    $('#ta-delete-block').on(PROGRAM_CLICK, DeleteBlock);
    $('#ta-undo-action').on(PROGRAM_CLICK, UndoAction);
    $('#ta-redo-action').on(PROGRAM_CLICK, RedoAction);
    $(document).on(PROGRAM_KEYUP, '.note-edit-dialog textarea', ClearActions);
    $('#ta-normalize-note').on(PROGRAM_CLICK, NormalizeNote);
    $('#ta-sanitize-note').on(PROGRAM_CLICK, SanitizeNote);
    $('#ta-validate-note').on(PROGRAM_CLICK, ValidateNote);
    $('#ta-text-shadow-controls a').on(PROGRAM_CLICK, TextShadowControls);
    $('#ta-ruby-dialog-open').on(PROGRAM_CLICK, OpenRubyDialog);
    JSPLib.utility.clickAndHold('#ta-placement-controls .ta-button-placement', PlacementControl, PROGRAM_SHORTCUT);
    $('#ta-get-placement').on(PROGRAM_CLICK, GetPlacement);
    $('#ta-save-note').on(PROGRAM_CLICK, SaveNote);
    $('#ta-edit-note').on(PROGRAM_CLICK, EditNote);
    $('#ta-delete-note').on(PROGRAM_CLICK, DeleteNote);
    $('#ta-show-note').on(PROGRAM_CLICK, ShowNote);
    $('#ta-hide-note').on(PROGRAM_CLICK, HideNote);
    $('#ta-reset-note').on(PROGRAM_CLICK, ResetNote);
    $('#ta-next-note').on(PROGRAM_CLICK, NextNote);
    $('#ta-previous-note').on(PROGRAM_CLICK, PreviousNote);
    $('#ta-unselect-note').on(PROGRAM_CLICK, UnselectNote);
    $('#ta-copy-note').on(PROGRAM_CLICK, CopyNote);
    $('#ta-section-codes button').on(PROGRAM_CLICK, InsertCharacter);
    $('#ta-side-menu-copy').on(PROGRAM_CLICK, CopyTagStyles);
    $('#ta-side-menu-clear').on(PROGRAM_CLICK, ClearTagStyles);
    $('#ta-side-menu-apply').on(PROGRAM_CLICK, ApplyTagStyles);
    $('#ta-size-controls > a').on(PROGRAM_CLICK , ResizeSideMenu);
    $('#ta-side-menu-reset').on(PROGRAM_CLICK, ResetSideMenu);
    $('#ta-side-menu-close').on(PROGRAM_CLICK, CloseSideMenu);
    $('#ta-side-menu-load').on(PROGRAM_CLICK, LoadTagStyles);
    $('#ta-side-menu-open').on(PROGRAM_CLICK, OpenSideMenu);
    $(document).on(PROGRAM_KEYDOWN, null, 'alt+t', KeyboardMenuToggle);
    $(document).on(PROGRAM_KEYDOWN, null, 'alt+r', ResetSideMenu);
    $(document).on('visibilitychange.ta', CheckMissedLastNoterPolls);
    let positions = JSPLib.storage.getStorageData('ta-position', localStorage, {});
    TA.$side_menu = $('#ta-side-menu');
    for (let key in positions) {
        if (positions[key]) {
            TA.$side_menu.css(key, positions[key]);
        }
    }
    TA.$text_box = $('#ta-side-menu-text');
    TA.$post_option = $('#post-option-translator-assist');
    TA.$close_notice_link = $('#close-notice-link');
    if (TA.mode !== 'main') {
        $(`.ta-menu-tab[data-value="${TA.mode}"]`).click();
    }
    TA.starting_notes = JSPLib.utility.getObjectAttributes(Danbooru.Note.notes, 'id');
    TA.initialized = true;
    JSPLib.utility.setCSSStyle(PROGRAM_CSS, 'program');
    JSPLib.storage.setStorageData('ta-post-seen', true, sessionStorage);
}

// Settings functions

function InitializeProgramValues() {
    Object.assign(TA, {
        post_id: JSPLib.danbooru.getShowID(),
        user_id: Danbooru.CurrentUser.data('id'),
        has_embedded: JSPLib.utility.getMeta('post-has-embedded-notes') === 'true',
        last_noted: JSPLib.utility.toTimeStamp(document.body.dataset.postLastNotedAt),
        mode: JSPLib.storage.getStorageData('ta-mode', localStorage, 'main'),
    });
    return true;
}

function RenderSettingsMenu() {
    $('#translator-assist').append(JSPLib.menu.renderMenuFramework(MENU_CONFIG));
    $("#ta-general-settings").append(JSPLib.menu.renderDomainSelectors());
    $('#ta-general-settings').append(JSPLib.menu.renderCheckbox('close_notice_enabled'));
    $('#ta-last-noted-settings').append(JSPLib.menu.renderCheckbox('check_last_noted_enabled'));
    $('#ta-last-noted-settings').append(JSPLib.menu.renderTextinput('last_noted_cutoff', 10));
    $('#ta-last-noted-settings').append(JSPLib.menu.renderCheckbox('query_last_noter_enabled'));
    $('#ta-last-noted-settings').append(JSPLib.menu.renderCheckbox('filter_last_noter_enabled'));
    $('#ta-last-noted-settings').append(JSPLib.menu.renderTextinput('last_noter_cache_time', 10));
    $('#ta-last-noted-settings').append(JSPLib.menu.renderCheckbox('new_noter_check_enabled'));
    $('#ta-last-noted-settings').append(JSPLib.menu.renderTextinput('new_noter_check_interval', 10));
    $("#ta-main-settings").append(JSPLib.menu.renderInputSelectors('available_html_tags', 'checkbox'));
    $("#ta-main-settings").append(JSPLib.menu.renderInputSelectors('available_css_styles', 'checkbox'));
    $('#ta-constructs-settings').append(JSPLib.menu.renderCheckbox('text_shadow_enabled'));
    $('#ta-constructs-settings').append(JSPLib.menu.renderCheckbox('ruby_enabled'));
    $("#ta-constructs-settings").append(JSPLib.menu.renderInputSelectors('available_ruby_styles', 'checkbox'));
    $('#ta-embedded-settings').append(JSPLib.menu.renderCheckbox('embedded_enabled'));
    $("#ta-embedded-settings").append(JSPLib.menu.renderInputSelectors('available_embedded_styles', 'checkbox'));
    $('#ta-controls-settings').append(JSPLib.menu.renderCheckbox('controls_enabled'));
    $('#ta-codes-settings').append(JSPLib.menu.renderCheckbox('codes_enabled'));
    JSPLib.menu.engageUI(true);
    JSPLib.menu.saveUserSettingsClick();
    JSPLib.menu.resetUserSettingsClick();
}

// Main function

function Main() {
    JSPLib.debug.debuglog("Initialize start:", JSPLib.utility.getProgramTime());
    const preload = {
        run_on_settings: false,
        default_data: DEFAULT_VALUES,
        initialize_func: InitializeProgramValues,
        menu_css: MENU_CSS,
    };
    if (!JSPLib.menu.preloadScript(TA, RenderSettingsMenu, preload)) return;
    $('#translate').on(PROGRAM_CLICK, ToggleSideNotice);
    if (TA.user_settings.check_last_noted_enabled) {
        CheckLastNoted();
    }
}

/****Initialization****/

//Variables for debug.js
JSPLib.debug.debug_console = false;
JSPLib.debug.level = JSPLib.debug.INFO;
JSPLib.debug.program_shortcut = PROGRAM_SHORTCUT;

//Variables for menu.js
JSPLib.menu.program_shortcut = PROGRAM_SHORTCUT;
JSPLib.menu.program_name = PROGRAM_NAME;
JSPLib.menu.program_data = TA;
JSPLib.menu.settings_migrations = [
    {from: 'available_html_styles', to: 'available_css_styles'},
];
JSPLib.menu.settings_config = SETTINGS_CONFIG;

//Export JSPLib
JSPLib.load.exportData(PROGRAM_NAME, TA);

/****Execution start****/

JSPLib.load.programInitialize(Main, {program_name: PROGRAM_NAME, required_variables: PROGRAM_LOAD_REQUIRED_VARIABLES, optional_selectors: PROGRAM_LOAD_OPTIONAL_SELECTORS});
