// ==UserScript==
// @name         DTextStyler
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      5.0
// @description  Danbooru DText UI addon.
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @exclude      /^https?://\w+\.donmai\.us/.*\.(xml|json|atom)(\?|$)/
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/DTextStyler.user.js
// @updateURL    https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/DTextStyler.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.2/papaparse.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220212/lib/module.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220212/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220212/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220212/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220212/lib/notice.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220212/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220212/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220212/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220212/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220212/lib/menu.js
// ==/UserScript==

/* global JSPLib $ Danbooru Papa */

/****Global variables****/

// Library constants

////NONE

//Exterior script variables
const DANBOORU_TOPIC_ID = '14229';
const GITHUB_WIKI_PAGE = 'https://github.com/BrokenEagle/JavaScripts/wiki/DtextStyler';

//Variables for load.js
const PROGRAM_LOAD_REQUIRED_VARIABLES = ['window.jQuery', 'window.Danbooru', 'Danbooru.Upload'];
const PROGRAM_LOAD_OPTIONAL_SELECTORS = ['.dtext-previewable textarea', '#add-commentary-dialog', '.upload_artist_commentary_container', '#c-users #a-edit'];

//Program name constants
const PROGRAM_SHORTCUT = 'ds';
const PROGRAM_CLICK = 'click.ds';
const PROGRAM_KEYUP = 'keyup.ds';
const PROGRAM_NAME = 'DTextStyler';

//Main program variable
const DS = {};

const DEFAULT_VALUES = {
    mode: 'edit',
};

//Available setting values
const ALL_TYPES = ['comment', 'forum', 'wiki', 'pool', 'dmail'];
const ALL_MARKUP = ['bold', 'italic', 'underline', 'strikethrough', 'translation', 'spoiler', 'code', 'nodtext', 'quote', 'expand', 'textile_link', 'wiki_link', 'named_link', 'search_link', 'full_table', 'headless_table'];
const ALL_ACTIONS = ['undo', 'redo'];

//Main settings
const SETTINGS_CONFIG = {
    post_commentary_enabled: {
        default: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Show dtext controls on the post commentary dialog."
    },
    upload_commentary_enabled: {
        default: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Show dtext controls above the upload commentary inputs."
    },
    dtext_types_handled: {
        allitems: ALL_TYPES,
        default: ALL_TYPES,
        validate: (data) => JSPLib.menu.validateCheckboxRadio(data, 'checkbox', ALL_TYPES),
        hint: "Show dtext controls above the preview area for the available types.",
    },
    available_dtext_markup: {
        allitems: ALL_MARKUP,
        default: ALL_MARKUP,
        validate: (data) => (console.log("validate", data, data.length > 0) || (JSPLib.menu.validateCheckboxRadio(data, 'checkbox', ALL_MARKUP) && (data.length > 0))),
        hint: "Select the list of available DText tags to be shown. Must have at least one.",
    },
    available_dtext_actions: {
        allitems: ALL_ACTIONS,
        default: ALL_ACTIONS,
        validate: (data) => JSPLib.menu.validateCheckboxRadio(data, 'checkbox', ALL_ACTIONS),
        hint: "Select the list of available DText actions to be shown.",
    },
}

const MENU_CONFIG = {
    topic_id: DANBOORU_TOPIC_ID,
    wiki_page: GITHUB_WIKI_PAGE,
    settings: [{
        name: 'general',
    },{
        name: 'main',
    },{
        name: 'commentary',
    },{
        name: 'controls',
    }],
    controls: [],
};

//CSS constants

const PROGRAM_CSS = `
/** General **/
/**** Preview ****/
.ds-preview-display {
    max-height: 300px;
    overflow-y: auto;
}
.ds-preview-display .ds-section {
    border: 1px solid #EEE;
    padding: 5px;
}
.ds-preview-display .ds-section-header {
    font-size: var(--text-lg);
    font-weight: bold;
    text-decoration: underline;
    margin: 0.5rem 0;
}
/**** Markup buttons ****/
.ds-markup-headers > div,
.ds-markup-headers > div > div,
.ds-buttons > div,
.ds-buttons > div > div {
    display: inline-block;
}
.ds-markup-headers > div > div {
    text-align: center;
    font-weight: bold;
}
.dtext-button {
    width: 40px;
    height: 40px;
    position: relative;
}
.dtext-button > * {
    position: absolute;
}
.ds-translate-content {
    font-size: 16px;
    font-weight: bold;
    white-space: nowrap;
}`;

const POST_CSS = `
/** Posts page **/
form#fetch-commentary input#commentary_source {
    max-width: 75%;
}
form#edit-commentary input#artist_commentary_original_title,
form#edit-commentary input#artist_commentary_translated_title {
    max-width: 100%;
}
button.ds-dialog-button[name=Cancel] {
    color: white;
    background: red;
}
button.ds-dialog-button[name=Submit] {
    color: white;
    background: green;
}`;

const UPLOAD_CSS = `
/** Uploads page **/
#ds-commentary-container {
    width: 65rem;
    background: #F8F8F8;
    border: 2px solid #EEE;
    box-shadow: 0 0 0 2px #DEF;
    padding: 10px;
    margin: 10px 0;
}
#ds-commentary-container .ds-markup-controls {
    border-bottom: 1px solid #DDD;
    padding-bottom: 5px;
    margin-bottom: 10px;
}
#edit-dialog #ds-commentary-container {
    display: none; /* Hide commentary when the tag box is detached */
}
#ds-commentary-buttons {
    border-top: 2px solid #DDD;
    padding-top: 5px;
}
.ds-commentary-button {
    display: inline-block;
}
#ds-remove-button {
    color: white;
    background: red;
}`;

const MENU_CSS = `
.jsplib-selectors.ds-selectors[data-setting="dtext_types_handled"] label {
    width: 120px;
}
.jsplib-selectors.ds-selectors[data-setting="available_dtext_markup"] label {
    width: 150px;
}`;

//HTML constants

const BOLD_CONTENT = '<svg height="16" width="10" viewBox="0 0 10 16"><path fill-rule="evenodd" d="M1 2h3.83c2.48 0 4.3.75 4.3 2.95 0 1.14-.63 2.23-1.67 2.61v.06c1.33.3 2.3 1.23 2.3 2.86 0 2.39-1.97 3.52-4.61 3.52H1V2zm3.66 4.95c1.67 0 2.38-.66 2.38-1.69 0-1.17-.78-1.61-2.34-1.61H3.13v3.3h1.53zm.27 5.39c1.77 0 2.75-.64 2.75-1.98 0-1.27-.95-1.81-2.75-1.81h-1.8v3.8h1.8v-.01z"></path></svg>';
const ITALIC_CONTENT = '<svg height="16" width="6" viewBox="0 0 6 16"><path fill-rule="evenodd" d="M2.81 5h1.98L3 14H1l1.81-9zm.36-2.7c0-.7.58-1.3 1.33-1.3.56 0 1.13.38 1.13 1.03 0 .75-.59 1.3-1.33 1.3-.58 0-1.13-.38-1.13-1.03z"></path></svg>';
const UNDERLINE_CONTENT = '<svg height="16" width="20" viewBox="4 4 16 16"><path fill-rule="evenodd" d="M7.5,6.5h2v5.959c-0.104,1.707,0.695,2.002,2,2.041c1.777,0.062,2.002-0.879,2-2.041V6.5h2v6.123 c0,1.279-0.338,2.245-1.016,2.898c-0.672,0.651-1.666,0.979-2.98,0.979c-1.32,0-2.319-0.326-2.996-0.979 C7.836,14.868,7.5,13.902,7.5,12.623V6.5 M6.5,17.5h10v1h-10V17.5z"></path></svg>';
const STRIKETHROUGH_CONTENT = '<svg height="16" width="20" viewBox="4 4 16 16"><path fill-rule="evenodd" d="M4.833,12.5h12v1h-12V12.5z M10.927,6.5c-1.133,0-2.076,0.287-2.75,0.9c-0.67,0.613-1,1.49-1,2.52c0,0.889,0.221,1.602,0.719,2.13 c0.498,0.528,1.279,0.91,2.312,1.14l0.812,0.182v-0.03c0.656,0.147,1.128,0.375,1.375,0.63c0.252,0.256,0.375,0.607,0.375,1.11 c0,0.573-0.172,0.97-0.531,1.26c-0.358,0.291-0.894,0.45-1.625,0.45c-0.477,0-0.969-0.074-1.469-0.24 c-0.502-0.166-1.031-0.417-1.562-0.75l-0.375-0.238v0.448v1.53v0.18l0.156,0.062c0.58,0.237,1.143,0.417,1.688,0.54 c0.549,0.121,1.07,0.18,1.562,0.18c1.286,0,2.297-0.293,3-0.9c0.709-0.605,1.062-1.486,1.062-2.608 c0-0.943-0.256-1.726-0.781-2.312c-0.521-0.592-1.305-1-2.344-1.229l-0.812-0.181c-0.716-0.148-1.204-0.352-1.406-0.539 C9.128,10.532,9.021,10.25,9.021,9.8c0-0.533,0.162-0.899,0.5-1.17c0.342-0.271,0.836-0.42,1.531-0.42 c0.395,0,0.818,0.052,1.25,0.181c0.433,0.127,0.908,0.333,1.406,0.6l0.375,0.18V7.13c0,0-1.188-0.383-1.688-0.479 C11.896,6.553,11.411,6.5,10.927,6.5z"></path></svg>';
const TRANSLATION_CONTENT = '<div class="ds-translate-content">Aあ</div>';
const QUOTE_CONTENT = '<svg height="16" width="14" viewBox="0 0 14 16"><path fill-rule="evenodd" d="M6.16 3.5C3.73 5.06 2.55 6.67 2.55 9.36c.16-.05.3-.05.44-.05 1.27 0 2.5.86 2.5 2.41 0 1.61-1.03 2.61-2.5 2.61-1.9 0-2.99-1.52-2.99-4.25 0-3.8 1.75-6.53 5.02-8.42L6.16 3.5zm7 0c-2.43 1.56-3.61 3.17-3.61 5.86.16-.05.3-.05.44-.05 1.27 0 2.5.86 2.5 2.41 0 1.61-1.03 2.61-2.5 2.61-1.89 0-2.98-1.52-2.98-4.25 0-3.8 1.75-6.53 5.02-8.42l1.14 1.84h-.01z"></path></svg>';
const EXPAND_CONTENT = '<svg height="16" width="20" viewBox="4 4 16 16"><path fill-rule="evenodd" id="left-bracket" d="M4,12v-1h1c1,0,1,0,1-1V7.614C6,7.1,6.024,6.718,6.073,6.472C6.127,6.22,6.212,6.009,6.33,5.839 C6.534,5.56,6.803,5.364,7.138,5.255C7.473,5.14,8.01,5,8.973,5H10v1H9.248c-0.457,0-0.77,0.191-0.936,0.408 C8.145,6.623,8,6.853,8,7.476v1.857c0,0.729-0.041,1.18-0.244,1.493c-0.2,0.307-0.562,0.529-1.09,0.667 c0.535,0.155,0.9,0.385,1.096,0.688C7.961,12.484,8,12.938,8,13.665v1.862c0,0.619,0.145,0.848,0.312,1.062 c0.166,0.22,0.479,0.407,0.936,0.407L10,17l0,0v1H8.973c-0.963,0-1.5-0.133-1.835-0.248c-0.335-0.109-0.604-0.307-0.808-0.591 c-0.118-0.165-0.203-0.374-0.257-0.625C6.024,16.283,6,15.9,6,15.387V13c0-1,0-1-1-1H4z"/><use transform="matrix(-1,0,0,1,24,0)" id="right-bracket" x="0" y="0" width="24" height="24" xlink:href="#left-bracket"/></svg></svg>';
const SPOILER_CONTENT = '<svg height="16" width="20" viewBox="4 4 16 16"><path fill-rule="evenodd" d="M11.999 5.022c-3.853 0-6.977 3.124-6.977 6.978 0 3.853 3.124 6.978 6.977 6.978 3.854 0 6.979-3.125 6.979-6.978 0-3.854-3.125-6.978-6.979-6.978zm-5.113 6.978c0-1.092.572-3.25.93-2.929l7.113 7.113c.488.525-1.837.931-2.93.931-2.825-.001-5.113-2.291-5.113-5.115zm9.298 2.929l-7.114-7.113c-.445-.483 1.837-.931 2.929-.931 2.827 0 5.115 2.289 5.115 5.114 0 1.093-.364 3.543-.93 2.93z"></path></svg>';
const CODE_CONTENT = '<svg height="16" width="14" viewBox="0 0 14 16"><path fill-rule="evenodd" d="M9.5 3L8 4.5 11.5 8 8 11.5 9.5 13 14 8 9.5 3zm-5 0L0 8l4.5 5L6 11.5 2.5 8 6 4.5 4.5 3z"></path></svg>';
const NODTEXT_CONTENT = '<svg width="32" height="32" viewBox="0 0 100 100"><g><polygon fill="#000000" points="66.666,36.67 61.953,41.383 70.572,50.003 61.95,58.623 66.663,63.336 80,50.003 	"></polygon>	<polygon fill="#000000" points="33.333,63.336 38.047,58.623 29.427,50.003 38.05,41.383 33.336,36.67 20,50.003 "></polygon><rect x="19.836" y="46.667" transform="matrix(0.2588 -0.9659 0.9659 0.2588 -11.2367 85.3574)" fill="#000000" width="60.328" height="6.667"></rect></g></svg>';
const TEXTILELINK_CONTENT = '<svg height="16" width="16" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M4 9h1v1H4c-1.5 0-3-1.69-3-3.5S2.55 3 4 3h4c1.45 0 3 1.69 3 3.5 0 1.41-.91 2.72-2 3.25V8.59c.58-.45 1-1.27 1-2.09C10 5.22 8.98 4 8 4H4c-.98 0-2 1.22-2 2.5S3 9 4 9zm9-3h-1v1h1c1 0 2 1.22 2 2.5S13.98 12 13 12H9c-.98 0-2-1.22-2-2.5 0-.83.42-1.64 1-2.09V6.25c-1.09.53-2 1.84-2 3.25C6 11.31 7.55 13 9 13h4c1.45 0 3-1.69 3-3.5S14.5 6 13 6z"></path></svg>';
const NAMEDLINK_CONTENT = '<svg width="18" height="18" viewBox="0 0 24 24"><g><polygon points="22 12.506 20 12.506 20 20.506 2 20.506 2 2.506 9.999 2.506 9.999 0.506 0 0.506 0 22.506 22 22.506 22 12.506"></polygon><polygon points="19.586 0 12.598 6.988 10 4.414 10.002 12.341 18 12.341 15.439 9.803 22.414 2.828 19.586 0"></polygon></g></svg>';
const WIKILINK_CONTENT = '<svg height="16" width="20" viewBox="4 4 26 26"><path fill-rule="evenodd" d="M29 6.428c0 .098-.03.188-.094.27-.062.08-.13.122-.205.122-.612.058-1.115.257-1.505.595-.39.338-.793.983-1.21 1.935L19.63 23.667c-.042.133-.16.2-.35.2a.39.39 0 0 1-.348-.2l-3.568-7.438-4.096 7.435a.39.39 0 0 1-.35.2c-.182 0-.303-.067-.36-.2L4.315 9.35c-.39-.894-.802-1.518-1.234-1.873-.43-.355-1.03-.574-1.804-.658-.066 0-.13-.037-.187-.106a.36.36 0 0 1-.09-.24c0-.226.066-.34.2-.34.556 0 1.14.025 1.746.075.565.05 1.097.072 1.596.072.507 0 1.105-.025 1.796-.075a28.2 28.2 0 0 1 1.92-.076c.132 0 .198.115.198.344 0 .228-.04.342-.124.342-.557.04-.995.183-1.315.425-.32.243-.48.56-.48.953 0 .2.067.45.2.75l5.092 11.68 2.99-5.56-2.732-5.718c-.49-1.028-.894-1.69-1.21-1.986-.315-.297-.793-.478-1.432-.545-.06 0-.116-.035-.17-.104a.377.377 0 0 1-.08-.24c0-.226.057-.34.174-.34.556 0 1.067.024 1.533.074.448.05.926.074 1.433.074.498 0 1.025-.026 1.582-.076a19.55 19.55 0 0 1 1.694-.076c.133 0 .2.115.2.343 0 .23-.042.342-.125.342-1.113.075-1.67.392-1.67.952 0 .25.13.64.386 1.166l1.806 3.665 1.8-3.345c.248-.477.373-.878.373-1.204 0-.768-.557-1.177-1.67-1.227-.1 0-.15-.117-.15-.346 0-.08.025-.16.075-.232.05-.074.1-.11.15-.11.4 0 .89.024 1.47.074.557.05 1.014.075 1.37.075.258 0 .636-.02 1.135-.06.63-.058 1.16-.087 1.582-.087.1 0 .15.097.15.293 0 .26-.092.392-.274.392-.645.065-1.17.244-1.56.536-.396.293-.888.957-1.478 1.99l-2.39 4.43 3.236 6.6 4.79-11.128c.166-.41.25-.786.25-1.128 0-.82-.558-1.253-1.67-1.303-.1 0-.15-.115-.15-.344 0-.227.074-.34.224-.34.406 0 .887.025 1.444.075.515.048.947.073 1.296.073.365 0 .79-.026 1.27-.075.498-.05.946-.076 1.345-.076.117 0 .175.097.175.293z"></path></svg>';
const SEARCHLINK_CONTENT = '<svg height="16" width="20" viewBox="0 0 500 500"><path fill="none" stroke="#000" stroke-width="36" stroke-linecap="round" d="m280,278a153,153 0 1,0-2,2l170,170m-91-117 110,110-26,26-110-110"></path></svg>';
const FULL_TABLE_CONTENT = '<svg height="16" width="20" viewBox="0 0 500 500"><path fill-rule="evenodd" d="M507.948,46.021c-1.367-16.368-14.588-30.13-31.21-30.13H31.782 c-16.622,0-29.844,13.762-31.242,30.13H0v414.825c0,17.544,14.239,31.782,31.782,31.782h444.955 c17.544,0,31.782-14.239,31.782-31.782V46.021H507.948z M158.912,460.846H31.782v-95.347h127.13V460.846z M158.912,336.354 H31.782v-97.985h127.13V336.354z M158.912,206.586H31.782v-95.347h127.13V206.586z M317.825,460.846h-127.13v-95.347h127.13 V460.846z M317.825,336.354h-127.13v-97.985h127.13V336.354z M317.825,206.586h-127.13v-95.347h127.13V206.586z M476.737,460.846 h-127.13v-95.347h127.13V460.846z M476.737,336.354h-127.13v-97.985h127.13V336.354z M476.737,206.586h-127.13v-95.347h127.13 V206.586z"></path></svg>';
const HEADLESS_TABLE_CONTENT = '<svg height="20" width="20" viewBox="-10 -10 150 150"><defs><style>.cls-1,.cls-2{fill:none;stroke:#000;stroke-linecap:round;stroke-miterlimit:10;}.cls-1{stroke-width:2px;}.cls-2{stroke-width:4px;}.cls-3{fill:#000;}</style></defs><g><line class="cls-1" x1="32" y1="7" x2="32" y2="117"></line><line class="cls-1" x1="62" y1="7" x2="62" y2="117"></line><line class="cls-1" x1="92" y1="7" x2="92" y2="117"></line><path class="cls-2" d="M122,46.59v64.16A11.28,11.28,0,0,1,110.75,122H13.25A11.28,11.28,0,0,1,2,110.75V13.25A11.28,11.28,0,0,1,13.25,2h97.5A11.28,11.28,0,0,1,122,13.25V25.09"></path><circle class="cls-3" cx="122" cy="33" r="2"></circle></g></svg>';
const UNDO_CONTENT = '<svg height="24" width="24" viewBox="0 0 24 24"><path d="M12,3A8.959,8.959,0,0,0,5,6.339V4H3v6H9V8H6.274A6.982,6.982,0,1,1,5.22,13.751l-1.936.5A9,9,0,1,0,12,3Z"/></svg>';
const REDO_CONTENT = '<svg height="24" width="24" viewBox="0 0 24 24" style="transform: scaleX(-1);"><path d="M12,3A8.959,8.959,0,0,0,5,6.339V4H3v6H9V8H6.274A6.982,6.982,0,1,1,5.22,13.751l-1.936.5A9,9,0,1,0,12,3Z"/></svg>';

const MARKUP_CONTROLS = `
<div class="ds-markup-controls" style="width: %spx;">
    <div class="ds-markup-headers">
        %s
    </div>
    <div class="ds-buttons">
        %s
    </div>
</div>`;

const PREVIEW_SECTION = `
<div class="ds-preview-display dtext-preview" data-section="%s">
    %s
    <section class="ds-section"></section>
</div>`;

const PREVIEW_BUTTONS = `
<div id="ds-commentary-buttons">
    <button type="button" id="ds-preview-button" class="ds-commentary-button ui-button ui-corner-all ui-widget">Preview</button>
    <button type="button" id="ds-edit-button" class="ds-commentary-button ui-button ui-corner-all ui-widget">Edit</button>
    <button type="button" id="ds-remove-button" class="ds-commentary-button ui-button ui-corner-all ui-widget">Remove</button>
</div>`;

//Config constants

const MARKUP_BUTTON_CONFIG = {
    bold: {
        stripped: false,
        inline: true,
        block: false,
        prefix: '[b]',
        suffix: '[/b]',
        top: '12px',
        left: '15px',
        content: BOLD_CONTENT,
    },
    italic: {
        stripped: false,
        inline: true,
        block: false,
        prefix: '[i]',
        suffix: '[/i]',
        top: '12px',
        left: '16px',
        content: ITALIC_CONTENT,
    },
    underline: {
        stripped: false,
        inline: true,
        block: false,
        prefix: '[u]',
        suffix: '[/u]',
        top: '12px',
        left: '11px',
        content: UNDERLINE_CONTENT,
    },
    strikethrough: {
        stripped: false,
        inline: true,
        block: false,
        prefix: '[s]',
        suffix: '[/s]',
        top: '12px',
        left: '11px',
        content: STRIKETHROUGH_CONTENT,
    },
    translation: {
        stripped: true,
        inline: true,
        block: true,
        prefix: '[tn]',
        suffix: '[/tn]',
        top: '10px',
        left: '6px',
        content: TRANSLATION_CONTENT,
    },
    spoiler: {
        stripped: true,
        inline: true,
        block: true,
        prefix: '[spoiler]',
        suffix: '[/spoiler]',
        top: '12px',
        left: '10px',
        content: SPOILER_CONTENT,
    },
    code: {
        stripped: false,
        inline: true,
        block: true,
        prefix: '[code]',
        suffix: '[/code]',
        top: '12px',
        left: '14px',
        content: CODE_CONTENT,
    },
    nodtext: {
        stripped: false,
        inline: true,
        block: true,
        prefix: '[nodtext]',
        suffix: '[/nodtext]',
        top: '4px',
        left: '5px',
        content: NODTEXT_CONTENT,
    },
    quote: {
        stripped: true,
        inline: false,
        block: true,
        prefix: '[quote]',
        suffix: '[/quote]',
        top: '12px',
        left: '14px',
        content: QUOTE_CONTENT,
    },
    expand: {
        stripped: true,
        inline: false,
        block: true,
        prefix: '[expand]',
        suffix: '[/expand]',
        top: '12px',
        left: '10px',
        content: EXPAND_CONTENT,
    },
    textile_link: {
        stripped: false,
        inline: true,
        block: false,
        prefix: '"',
        suffix: '":[url]',
        select_func: (text_area, _cursor_start, cursor_end)=>{
            text_area.setSelectionRange(cursor_end - 4, cursor_end - 1);
        },
        top: '12px',
        left: '12px',
        content: TEXTILELINK_CONTENT,
    },
    wiki_link: {
        stripped: false,
        inline: true,
        block: false,
        prefix: '[[',
        suffix: ']]',
        top: '13px',
        left: '11px',
        content: WIKILINK_CONTENT,
    },
    named_link: {
        stripped: false,
        inline: true,
        block: false,
        prefix: '[[',
        suffix: '|wiki_name]]',
        select_func: (text_area, _cursor_start, cursor_end)=>{
            text_area.setSelectionRange(cursor_end - 11, cursor_end - 2);
        },
        top: '11px',
        left: '12px',
        content: NAMEDLINK_CONTENT,
    },
    search_link: {
        stripped: false,
        inline: true,
        block: false,
        prefix: '{{',
        suffix: '}}',
        top: '13px',
        left: '10px',
        content: SEARCHLINK_CONTENT,
    },
    full_table: {
        markup: (text_area)=>{TableMarkup(text_area, true);},
        top: '12px',
        left: '10px',
        content: FULL_TABLE_CONTENT,
    },
    headless_table: {
        markup: (text_area)=>{TableMarkup(text_area, false);},
        top: '10px',
        left: '10px',
        content: HEADLESS_TABLE_CONTENT,
    },
};

const ACTION_BUTTON_CONFIG = {
    undo: {
        action: (text_area)=>{UndoAction(text_area);},
        top: '9px',
        left: '9px',
        content: UNDO_CONTENT,
    },
    redo: {
        action: (text_area)=>{RedoAction(text_area);},
        top: '9px',
        left: '9px',
        content: REDO_CONTENT,
    },
};

const MARKUP_SECTION_CONFIG = {
    font: {
        color: 'beige',
        buttons: ['bold', 'italic', 'underline', 'strikethrough'],
    },
    special: {
        color: 'lightgreen',
        buttons: ['translation', 'spoiler', 'code', 'nodtext'],
    },
    blocks: {
        color: 'orange',
        buttons: ['quote', 'expand'],
    },
    links: {
        color: 'lightblue',
        buttons: ['textile_link', 'wiki_link', 'named_link', 'search_link'],
    },
    tables: {
        color: 'pink',
        buttons: ['full_table', 'headless_table'],
    },
};

const ACTION_SECTION_CONFIG = {
    actions: {
        color: 'lightgrey',
        buttons: ['undo', 'redo'],
    },
};

const DIALOG_CONFIG = {
    Preview: function() {
        DS.$dialog_buttons.filter('[name=Preview]').hide();
        DS.$dialog_buttons.filter('[name=Edit]').show();
        DtextPreview();
    },
    Edit: function() {
        DS.$dialog_buttons.filter('[name=Preview]').show();
        DS.$dialog_buttons.filter('[name=Edit]').hide();
        DtextEdit();
    },
};

//Other

const DTEXT_SELECTORS = {
    comment: ['comment_body'],
    forum: ['forum_topic_original_post_body', 'forum_post_body'],
    wiki: ['wiki_page_body'],
    pool: ['pool_description'],
    dmail: ['dmail_body'],
};

/****Functions****/

//Library functions

JSPLib.utility.blockActiveElementSwitch = function (selector) {
    $(selector).each((_i , elem)=>{
        // Allows the use of document.activeElement to get the last selected text input or textarea
        elem.onmousedown = (e)=>{(e || window.event).preventDefault();};
    });
};

JSPLib.menu.renderMenuFramework = function (menu_config) {
    let settings_html = menu_config.settings.map((setting) => this.renderMenuSection(setting,'settings')).join('\n');
    let control_html = menu_config.controls.map((control) => this.renderMenuSection(control,'controls')).join('\n');
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

JSPLib.menu.renderMenuSection = function (value,type) {
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

//Auxiliary functions

function GetTextArea($obj) {
    let $text_areas = $obj.closest('.ds-container').find('textarea, input');
    if ($text_areas.length <= 1) {
        var text_area = $text_areas.get(0);
    } else {
        text_area = (['TEXTAREA', 'INPUT'].includes(document.activeElement.tagName) && [...document.activeElement.classList].includes('ds-commentary-input') ? document.activeElement : null);
    }
    if (!text_area) {
        JSPLib.notice.error("No text input selected.");
    } else {
        DS.$close_notice.click();
    }
    return text_area;
}

function MarkupSelectionText(text_area, config) {
    if ([...text_area.classList].includes('string') && config.stripped) {
        JSPLib.notice.notice("Block elements not available for inline DText.");
        return false;
    }
    SaveMarkup(text_area);
    let {prefix, suffix, block, inline, select_func} = config;
    let start_text = text_area.value.slice(0, text_area.selectionStart);
    let selection_text = text_area.value.slice(text_area.selectionStart, text_area.selectionEnd);
    let end_text = text_area.value.slice(text_area.selectionEnd);
    if ((block && !inline) || ((block && inline) && (selection_text.search('\n') >= 0))) {
        let starting_CRs = start_text.replace(/ /g, "").match(/\n*$/)[0].length;
        let ending_CRs = end_text.replace(/ /g, "").match(/^\n*/)[0].length;
        start_text = start_text + '\n'.repeat(Math.max(2 - starting_CRs));
        end_text = '\n'.repeat(Math.max(2 - ending_CRs)) + end_text;
        var markup_text = prefix + '\n\n' + selection_text.trim() + '\n\n' + suffix;
    } else {
        markup_text = prefix + selection_text + suffix;
    }
    let cursor_start = start_text.length;
    let cursor_end = cursor_start + markup_text.length;
    let final_text = start_text + markup_text + end_text;
    final_text = final_text.replace(/^\s+/, "");
    text_area.value = final_text;
    text_area.focus();
    if (select_func) {
        select_func(text_area, cursor_start, cursor_end);
    } else {
        text_area.setSelectionRange(cursor_start, cursor_end);
    }
    return true;
}

function TableMarkup(text_area, has_header) {
    if ([...text_area.classList].includes('string')) {
        JSPLib.notice.notice("Block elements not available for inline DText.");
        return false;
    }
    SaveMarkup(text_area);
    let final_text = text_area.value.slice(0, text_area.selectionStart);
    let selection_text = text_area.value.slice(text_area.selectionStart, text_area.selectionEnd);
    final_text += CSVtoDtextTable(selection_text, has_header);
    final_text = final_text.replace(/^\s+/, "");
    let cursor = final_text.length;
    final_text += text_area.value.slice(text_area.selectionEnd);
    text_area.value = final_text;
    text_area.focus();
    text_area.setSelectionRange(cursor, cursor);
    return true;
}

function SaveMarkup(text_area) {
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

function UndoAction(text_area) {
    let $text_area = $(text_area);
    let {undo_actions = [], undo_index = 0, undo_saved} = $text_area.data();
    if (undo_saved) {
        undo_actions.push(text_area.value);
        $text_area.data('undo_actions', undo_actions);
    }
    let undo_html = undo_actions.slice(undo_index - 1, undo_index)[0];
    if (undo_html) {
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

function RedoAction(text_area) {
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

function DisplayUploadCommentary(open) {
    if (open) {
        DS.$commentary_buttons.show();
        DS.$markup_controls.show();
        DS.$remove_button.show();
        DS.$preview_button.show();
        DS.$edit_button.hide();
    } else {
        DS.$commentary_buttons.hide();
        DS.$markup_controls.hide();
        DS.$preview_display.hide();
    }
}

//Render functions

function RenderMarkupButton(type, name, config) {
    let title = JSPLib.utility.displayCase(name);
    return `<button title="${title}" name="${name}" type="button" class="dtext-button dtext-${type}" tabindex="-1">${config.content}</button>`;
}

function RenderSectionControls(type, section_config, button_config, available_controls) {
    let header_html = "";
    let button_html = "";
    for (let section in section_config) {
        let html = "";
        let button_length = 0;
        for (let i = 0; i < section_config[section].buttons.length; i++) {
            let button = section_config[section].buttons[i];
            if (!available_controls.includes(button)) continue;
            html += RenderMarkupButton(type, button, button_config[button]);
            button_length++;
        }
        if (button_length === 0) continue;
        button_html += `<div>${html}</div>`;
        let width = (button_length * 40);
        let color = section_config[section].color;
        let name = (button_length > 1 ? JSPLib.utility.displayCase(section) : "&ensp;");
        header_html += `<div style="width: ${width}px; background: ${color};" title="${section}">${name}</div>`;
    }
    return [header_html, button_html];
}

function RenderMarkupControls() {
    if (DS.user_settings.available_dtext_markup.length === 0 && DS.user_settings.available_dtext_actions.length === 0) return;
    let header_html = "";
    let button_html = "";
    if (DS.user_settings.available_dtext_markup.length) {
        let [markup_header, markup_buttons] = RenderSectionControls('markup', MARKUP_SECTION_CONFIG, MARKUP_BUTTON_CONFIG, DS.user_settings.available_dtext_markup);
        header_html += `<div>${markup_header}</div>`;
        button_html += `<div>${markup_buttons}</div>`;
    }
    if (DS.user_settings.available_dtext_actions.length > 0) {
        let [action_header, action_buttons] = RenderSectionControls('action', ACTION_SECTION_CONFIG, ACTION_BUTTON_CONFIG, DS.user_settings.available_dtext_actions);
        header_html += `<div style="margin-left: 10px;">${action_header}</div>`;
        button_html += `<div style="margin-left: 10px;">${action_buttons}</div>`;
    }
    let width = ((DS.user_settings.available_dtext_markup.length + DS.user_settings.available_dtext_actions.length) * 40) + 20;
    return JSPLib.utility.sprintf(MARKUP_CONTROLS, String(width), header_html, button_html);
}

function RenderPreviewSection(name, has_header=false) {
    let section_header = (has_header ? `<div class="ds-section-header">${JSPLib.utility.displayCase(name)}</div>` : "");
    return JSPLib.utility.sprintf(PREVIEW_SECTION, name, section_header);
}

//Dtext functions

function CSVtoDtextTable(csvtext, has_header) {
    let tabletext = "";
    let sectiontext = "";
    let csvdata = Papa.parse(csvtext);
    JSPLib.debug.debuglog('CSVtoDtextTable', {csvdata, has_header});
    csvdata.data.forEach((row, i)=>{
        let rowtext = "";
        row.forEach((col)=>{
            if (i === 0 && has_header) {
                rowtext += AddTableHeader(col);
            } else {
                rowtext += AddTableData(col);
            }
        });
        sectiontext += AddTableRow(rowtext);
        if (i === 0 && has_header) {
            tabletext += AddTableHead(sectiontext);
            sectiontext = "";
        }
    });
    tabletext += AddTableBody(sectiontext);
    return AddTable(tabletext);
}

function AddTable(input) {
    return '[table]\n' + input + '[/table]\n';
}

function AddTableHead(input) {
    return '[thead]\n' + input + '[/thead]\n';
}

function AddTableBody(input) {
    return '[tbody]\n' + input + '[/tbody]\n';
}

function AddTableRow(input) {
    return '[tr]\n' + input + '[/tr]\n';
}

function AddTableHeader(input) {
    return '[th]' + input + '[/th]\n';
}

function AddTableData(input) {
    return '[td]' + input + '[/td]\n';
}

//Event handlers

function DtextMarkup(event) {
    let $button = $(event.currentTarget);
    let text_area = GetTextArea($button);
    if (!text_area) return;
    let name = $button.attr('name');
    let markup_func = (MARKUP_BUTTON_CONFIG[name].markup ? MARKUP_BUTTON_CONFIG[name].markup : MarkupSelectionText);
    if (markup_func(text_area, MARKUP_BUTTON_CONFIG[name])) {
        DS.$close_notice.click();
    }
}

function DtextAction(event) {
    let $button = $(event.currentTarget);
    let text_area = GetTextArea($button);
    if (!text_area) return;
    let name = $button.attr('name');
    let action_func = ACTION_BUTTON_CONFIG[name].action;
    if (action_func(text_area, ACTION_BUTTON_CONFIG[name])) {
        DS.$close_notice.click();
    }
}

function OpenDialog() {
    if (!DS.$add_commentary_dialog.data('initialized')) {
        (DS.$dialog_buttons = DS.$add_commentary_dialog.closest('.ui-dialog').find('.ui-dialog-buttonset button'))
            .each((_i, button)=>{
                $(button).addClass('ds-dialog-button').attr('name', button.innerText);
            });
        DS.$add_commentary_dialog.data('initialized', true);
    }
    DS.$dialog_buttons.filter('[name=Preview]').show();
    DS.$dialog_buttons.filter('[name=Edit]').hide();
    DS.$edit_commentary = $('.ds-edit-commentary');
    DS.$preview_display = $('.ds-preview-display');
    DtextEdit();
}

function DtextPreview() {
    DS.$edit_commentary.hide();
    let promise_array = [];
    let preview_array = [];
    (DS.$commentary_input ||= $('.ds-commentary-input')).each((_i, input)=>{
        let {section, part} = $(input).data();
        let preview = {section, part};
        let inline = preview.inline = [...input.classList].includes('string');
        let body = preview.body = input.value;
        let promise = (body.trim(/\s+/).length > 0 ? JSPLib.network.post('/dtext_preview', {body, inline}) : Promise.resolve(null));
        promise_array.push(promise);
        preview_array.push(preview);
    });
    Promise.all(promise_array).then((data)=>{
        data.forEach((body, i)=>{
            preview_array[i].body = body;
        });
        ['original', 'artist', 'translated'].forEach((section)=>{
            let $display = DS.$preview_display.filter(`[data-section=${section}]`);
            if ($display.length === 0) return;
            let is_shown = false;
            let $section = $display.find('.ds-section').html("");
            ['title', 'description', 'desc'].forEach((part)=>{
                let preview = preview_array.find((item) => (item.section === section && item.part === part));
                if (!preview?.body) return;
                if (part === 'title') {
                    $section.append(`<h3><span class="prose">${preview.body}</span></h3>`);
                } else if (part === 'description' || part === 'desc') {
                    $section.append(`<div class="prose">${preview.body}</div>`);
                }
                is_shown = true;
            });
            let action = (is_shown ? 'show' : 'hide');
            $display[action]();
        });
        JSPLib.debug.debuglog('DtextPreview', preview_array);
    });
    DS.mode = 'preview';
}

function DtextEdit() {
    DS.$preview_display.hide();
    DS.$edit_commentary.show();
    DS.mode = 'edit';
}

function ToggleCommentary() {
    if (DS.commentary_open) {
        DS.$toggle_artist_commentary.text('show »');
        DS.$artist_commentary.slideUp();
        DS.$upload_commentary_translation_container.slideUp();
        DisplayUploadCommentary(false);
    } else {
        DS.$toggle_artist_commentary.text('« hide');
        DS.$artist_commentary.slideDown();
        DS.$upload_commentary_translation_container.slideDown();
        DisplayUploadCommentary(true);
    }
    DS.commentary_open = !DS.commentary_open;
    DS.mode = 'edit';
}

function ToggleTranslation() {
    if (DS.translation_open) {
        DS.$toggle_commentary_translation.text('show »');
        DS.$edit_commentary.slideUp();
        DS.$preview_display.slideUp();
    } else {
        DS.$toggle_commentary_translation.text('« hide');
        if (DS.mode === 'preview') {
            DS.$preview_display.slideDown();
        } else if (DS.mode === 'edit') {
            DS.$edit_commentary.slideDown();
        }
    }
    DS.translation_open = !DS.translation_open;
}

//Initialize

function InitializeButtons($button_container) {
    let all_configs = Object.assign({}, MARKUP_BUTTON_CONFIG, ACTION_BUTTON_CONFIG);
    for (let key in all_configs) {
        let {top, left} = all_configs[key];
        $button_container.find(`button[name=${key}] > *:first-of-type`)
            .css({top, left});
    }
}

function InitializeDtextPreviews() {
    let containers = JSPLib.utility.multiConcat(...DS.user_settings.dtext_types_handled.map((type) => DTEXT_SELECTORS[type]));
    let final_selector = JSPLib.utility.joinList(containers, '.', ' .dtext-previewable textarea', ', ');
    $(final_selector).each((_i, textarea)=>{
        let $container = $(textarea).closest('.input.dtext');
        $container.addClass('ds-container');
        $container.find('.dtext-previewable').before(RenderMarkupControls());
        InitializeButtons($container.find('.ds-buttons'));
        $(textarea).on(PROGRAM_KEYUP, ClearActions);
    });
}

function InitializeCommentaryDialog() {
    DS.$add_commentary_dialog = $('#add-commentary-dialog');
    if (DS.$add_commentary_dialog.length === 0) return;
    DS.$add_commentary_dialog.addClass('ds-container');
    DS.$add_commentary_dialog.find('#fetch-commentary')
        .after(RenderMarkupControls());
    InitializeButtons(DS.$add_commentary_dialog.find('.ds-buttons'));
    $('#edit-commentary')
        .addClass('ds-edit-commentary')
        .after(RenderPreviewSection('original', true) + RenderPreviewSection('translated', true));
    DS.$add_commentary_dialog.data('initialized', false);
    ['original', 'translated'].forEach((section)=>{
        ['title', 'description'].forEach((part)=>{
            $(`#artist_commentary_${section}_${part}`).data({section, part}).addClass('ds-commentary-input');
        });
    });
    //Wait for the dialog to be initialized before performing the final step
    JSPLib.utility.recheckTimer({
        check: () => JSPLib.utility.hasDOMDataKey('#add-commentary-dialog', 'uiDialog'),
        exec: ()=>{
            let buttons = DS.$add_commentary_dialog.dialog('option', 'buttons');
            buttons = Object.assign(DIALOG_CONFIG, buttons);
            let dialog_width = Math.max((DS.user_settings.available_dtext_markup.length + DS.user_settings.available_dtext_actions.length) * 40 + 50, DS.$add_commentary_dialog.dialog('option', 'width'));
            DS.$add_commentary_dialog.dialog('option', 'buttons', buttons);
            DS.$add_commentary_dialog.dialog('option', 'width', dialog_width);
            DS.$add_commentary_dialog.on('dialogopen.ds', OpenDialog);
        },
    }, 500, JSPLib.utility.one_second * 15);
    DS.$add_commentary_dialog.find('.ds-commentary-input').on(PROGRAM_KEYUP, ClearActions);
}

function InitializeUploadCommentary() {
    //Move existing sections and add controls
    DS.$upload_artist_commentary_container = $('.upload_artist_commentary_container').detach();
    if (DS.$upload_artist_commentary_container.length === 0) return;
    DS.$upload_artist_commentary_container
        .addClass('ds-container')
        .prepend(RenderMarkupControls());
    InitializeButtons(DS.$upload_artist_commentary_container.find('.ds-buttons'));
    (DS.$artist_commentary = DS.$upload_artist_commentary_container.find('.artist-commentary'))
        .addClass('ds-edit-commentary')
        .after(RenderPreviewSection('artist'));
    DS.$upload_commentary_translation_container = $('.upload_commentary_translation_container').detach();
    (DS.$commentary_translation = DS.$upload_commentary_translation_container.find('.commentary-translation'))
        .addClass('ds-edit-commentary')
        .after(RenderPreviewSection('translated'));
    ['artist', 'translated'].forEach((section)=>{
        let $container = (section === 'artist' ? DS.$upload_artist_commentary_container : DS.$upload_commentary_translation_container);
        ['title', 'desc'].forEach((part)=>{
            $container.find(`#post_${section}_commentary_${part}`).data({section, part}).addClass('ds-commentary-input');
        });
    });
    (DS.$overall_container = $('<div id="ds-commentary-container"></div>'))
        .append(DS.$upload_artist_commentary_container)
        .append(DS.$upload_commentary_translation_container).
        append(PREVIEW_BUTTONS);
    $('#tags-container').before(DS.$overall_container);
    //Initialize commentary handlers
    (DS.$preview_button = $('#ds-preview-button')).on(PROGRAM_CLICK, ()=>{
        DtextPreview();
        DS.$preview_button.hide();
        DS.$edit_button.show();
    });
    (DS.$edit_button = $('#ds-edit-button')).on(PROGRAM_CLICK, ()=>{
        DtextEdit();
        DS.$preview_button.show();
        DS.$edit_button.hide();
    });
    (DS.$remove_button = $('#ds-remove-button')).on(PROGRAM_CLICK, ()=>{
        DS.$overall_container.remove();
    });
    //Wait until Danbooru binds the click, otherwise 2 click handlers will be bound
    JSPLib.utility.recheckTimer({
        check: () => JSPLib.utility.isNamespaceBound('#toggle-artist-commentary', 'click', 'danbooru'),
        exec: ()=>{
            DS.commentary_open = DS.$artist_commentary.is(':visible');
            Danbooru.Upload.toggle_commentary = ToggleCommentary;
            if (DS.commentary_open) {
                DisplayUploadCommentary(true);
            }
            (DS.$toggle_artist_commentary = $('#toggle-artist-commentary')).off('click.danbooru').on(PROGRAM_CLICK, function(event) {
                Danbooru.Upload.toggle_commentary();
                event.preventDefault();
            });
            DS.translation_open = DS.$commentary_translation.is(':visible');
            Danbooru.Upload.toggle_translation = ToggleTranslation;
            (DS.$toggle_commentary_translation = $('#toggle-commentary-translation')).off('click.danbooru').on(PROGRAM_CLICK, function(event) {
                Danbooru.Upload.toggle_translation();
                event.preventDefault();
            });
        },
    }, 500, JSPLib.utility.one_second * 15);
    DS.$edit_commentary = $('.ds-edit-commentary');
    DS.$preview_display = $('.ds-preview-display');
    DS.$commentary_buttons = $('#ds-commentary-buttons');
    DS.$markup_controls = $('.ds-markup-controls');
    DS.$overall_container.find('.ds-commentary-input').on(PROGRAM_KEYUP, ClearActions);
}

// Settings functions

function RenderSettingsMenu() {
    $('#dtext-styler').append(JSPLib.menu.renderMenuFramework(MENU_CONFIG));
    $("#ds-general-settings").append(JSPLib.menu.renderDomainSelectors());
    $("#ds-main-settings").append(JSPLib.menu.renderInputSelectors('dtext_types_handled', 'checkbox'));
    $('#ds-commentary-settings').append(JSPLib.menu.renderCheckbox('post_commentary_enabled'));
    $('#ds-commentary-settings').append(JSPLib.menu.renderCheckbox('upload_commentary_enabled'));
    $("#ds-controls-settings").append(JSPLib.menu.renderInputSelectors('available_dtext_markup', 'checkbox'));
    $("#ds-controls-settings").append(JSPLib.menu.renderInputSelectors('available_dtext_actions', 'checkbox'));
    JSPLib.menu.engageUI(true);
    JSPLib.menu.saveUserSettingsClick();
    JSPLib.menu.resetUserSettingsClick();
}

//Main program

function Main() {
    Object.assign(DS, {
        controller: document.body.dataset.controller,
        action: document.body.dataset.action,
        $close_notice: $('#close-notice-link'),
        user_settings: JSPLib.menu.loadUserSettings(),
    } , DEFAULT_VALUES);
    if (JSPLib.danbooru.isSettingMenu()) {
        JSPLib.menu.initializeSettingsMenu(RenderSettingsMenu);
        JSPLib.utility.setCSSStyle(MENU_CSS, 'menu');
        return;
    }
    if (!JSPLib.menu.isScriptEnabled()) {
        JSPLib.debug.debuglog("Script is disabled on", window.location.hostname);
        return;
    }
    if (DS.user_settings.dtext_types_handled.length) {
        InitializeDtextPreviews();
    }
    if (DS.user_settings.post_commentary_enabled && DS.controller === 'posts' && DS.action === 'show') {
        InitializeCommentaryDialog();
        JSPLib.utility.setCSSStyle(POST_CSS, 'post');
    } else if (DS.user_settings.upload_commentary_enabled && ((DS.controller === 'uploads' && DS.action === 'show') || (DS.controller === 'upload-media-assets' && DS.action === 'show'))) {
        InitializeUploadCommentary();
        JSPLib.utility.setCSSStyle(UPLOAD_CSS, 'upload');
    }
    $('.dtext-markup').on(PROGRAM_CLICK, DtextMarkup);
    $('.dtext-action').on(PROGRAM_CLICK, DtextAction);
    JSPLib.utility.blockActiveElementSwitch('.dtext-markup, .dtext-action');
    JSPLib.utility.setCSSStyle(PROGRAM_CSS, 'program');
}

/****Initialization****/

//Variables for debug.js
JSPLib.debug.debug_console = false;
JSPLib.debug.level = JSPLib.debug.INFO;
JSPLib.debug.program_shortcut = PROGRAM_SHORTCUT;

//Variables for menu.js
JSPLib.menu.program_shortcut = PROGRAM_SHORTCUT;
JSPLib.menu.program_name = PROGRAM_NAME;
JSPLib.menu.program_data = DS;
JSPLib.menu.settings_config = SETTINGS_CONFIG;

//Export JSPLib
JSPLib.load.exportData(PROGRAM_NAME, DS);

/****Execution start****/

JSPLib.load.programInitialize(Main, 'DS', PROGRAM_LOAD_REQUIRED_VARIABLES, [], PROGRAM_LOAD_OPTIONAL_SELECTORS);
