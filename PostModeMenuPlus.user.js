// ==UserScript==
// @name         PostModeMenu+
// @namespace    https://github.com/BrokenEagle
// @version      9.10
// @description  Provide additional functions on the post mode menu.
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        https://*.donmai.us/*
// @exclude      /^(?!https:\/\/\w+\.donmai\.us\/?(posts|settings)?\/?(\?|$)).*/
// @exclude      /^https://\w+\.donmai\.us/.*\.(xml|json|atom)(\?|$)/
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/PostModeMenuPlus.user.js
// @updateURL    https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/PostModeMenuPlus.user.js
// @require      https://cdn.jsdelivr.net/npm/dragselect@2.3.1/dist/ds.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/a732f8cb07173c58f573252366bbda0dadc3bc1d/lib/module.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/a732f8cb07173c58f573252366bbda0dadc3bc1d/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/a732f8cb07173c58f573252366bbda0dadc3bc1d/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/a732f8cb07173c58f573252366bbda0dadc3bc1d/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/a732f8cb07173c58f573252366bbda0dadc3bc1d/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/a732f8cb07173c58f573252366bbda0dadc3bc1d/lib/notice.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/a732f8cb07173c58f573252366bbda0dadc3bc1d/lib/template.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/a732f8cb07173c58f573252366bbda0dadc3bc1d/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/a732f8cb07173c58f573252366bbda0dadc3bc1d/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/a732f8cb07173c58f573252366bbda0dadc3bc1d/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/a732f8cb07173c58f573252366bbda0dadc3bc1d/lib/menu.js
// ==/UserScript==

/* global $ JSPLib DragSelect */

(({DanbooruProxy, Debug, Notice, Utility, Storage, Template, Network, Danbooru, Load, Menu}) => {

const PROGRAM_NAME = 'PostModeMenu';
const PROGRAM_SHORTCUT = 'pmm';

/****Library updates****/

////NONE

/****Global variables****/

//Exterior script variables
const DANBOORU_TOPIC_ID = '21812';

//Variables for load.js
const PROGRAM_LOAD_REQUIRED_VARIABLES = ['window.jQuery', 'window.Danbooru', 'Danbooru.Utility', 'Danbooru.CurrentUser'];
const PROGRAM_LOAD_OPTIONAL_SELECTORS = ['#c-posts #a-index #mode-box', '#c-users #a-edit'];

//Program variable
const PMM = {};

//Available setting values
const SUPPORTED_MODES = ['edit', 'tag_script', 'commentary', 'copy_ID', 'copy_short', 'copy_link', 'vote_up', 'vote_down', 'unvote', 'favorite', 'unfavorite'];
const DRAGGABLE_MODES = ['tag-script', 'commentary', 'copy-id', 'copy-short', 'copy-link', 'vote-up', 'vote-down', 'unvote', 'favorite', 'unfavorite'];
const ID_SEPARATORS = ['comma', 'colon', 'semicolon', 'space', 'return'];

//Main settings
const SETTINGS_CONFIG = {
    available_modes: {
        allitems: SUPPORTED_MODES,
        reset: SUPPORTED_MODES,
        validate: (data) => Menu.validateCheckboxRadio(data, 'checkbox', SUPPORTED_MODES),
        hint: "Select to enable script support/availability on selected modes."
    },
    mode_order: {
        allitems: SUPPORTED_MODES,
        reset: SUPPORTED_MODES,
        sortvalue: true,
        validate: (data) => Utility.arrayEquals(data, SUPPORTED_MODES),
        hint: "Set the order for how actions appear in the mode menu. <b>Note:</b> <code>view</code> will still always be first."
    },
    maximum_concurrent_requests: {
        reset: 5,
        parse: parseInt,
        validate: (data) => (Utility.isInteger(data) && data > 0),
        hint: "Determines how many requests will be sent at a time, while the remaining requests wait their turn."
    },
    id_separator: {
        display: "ID Separator",
        allitems: ID_SEPARATORS,
        reset: ['comma'],
        validate: (data) => Menu.validateCheckboxRadio(data, 'radio', ID_SEPARATORS),
        hint: "Choose how to separate multiple post IDs copied with Copy ID, Copy Short, or Copy Link."
    },
    edit_tag_grouping_enabled: {
        reset: false,
        validate: Utility.isBoolean,
        hint: "Groups tags the same way as on the post's main page. (network: 1)"
    },
    autoload_post_commentary_enabled: {
        reset: false,
        validate: Utility.isBoolean,
        hint: "Autoloads the commentary when a single post is selected. (network: 1)"
    },
    safe_tag_script_enabled: {
        reset: false,
        validate: Utility.isBoolean,
        hint: "Unsets the tag script mode when navigating to a new page."
    },
    long_searchbar_enabled: {
        reset: false,
        validate: Utility.isBoolean,
        hint: "Adds additional CSS which repositions the searchbar and has it span the entire screen."
    },
    long_tagscript_enabled: {
        reset: false,
        validate: Utility.isBoolean,
        hint: "Adds additional CSS which makes the tagscript bar span the entire screen when selected."
    },
    highlight_errors_enabled: {
        reset: false,
        validate: Utility.isBoolean,
        hint: "Adds visualization to the specific posts when network errors occur."
    },
    drag_select_enabled: {
        reset: true,
        validate: Utility.isBoolean,
        hint: "Turns on being able to drag select, allowing multiple posts to be processed at once."
    },
};

const MENU_CONFIG = {
    topic_id: DANBOORU_TOPIC_ID,
    settings: [{
        name: 'general',
    }, {
        name: 'mode',
    }, {
        name: 'option',
        message: "Some options require additional networks calls, which can add latency to the process. These are denoted when present, as well as the sequential amount."
    }, {
        name: 'network',
    }, {
        name: 'select',
    }, {
        name: 'interface',
    }],
    controls: [],
};

//Default values

const DEFAULT_VALUES = {
    pinned: false,
    post_votes: {},
    post_favorites: {},
};

//CSS constants

const PROGRAM_CSS = Template.normalizeCSS()`
/**GENERAL**/
.pmm-dialog label {
    display: block;
    font-weight: bold;
}
/**POSTS**/
div#posts {
    margin: -1em;
    padding: 1em;
}
article.post-preview {
    border: solid 1px transparent;
    padding-top: 10px;
}
article.pmm-selected {
    border: solid 1px;
}
/**MODE BOX**/
section#pmm-mode-box {
    position: relative;
    padding: 5px;
    border: 1px solid;
}
div#pmm-mode-controls {
    display: flex;
    align-items: flex-end;
    margin-bottom: 2px;
    justify-content: space-between;
}
div#pmm-mode-select {
    width: 44%;
}
div#pmm-mode-select h2 {
    text-align: right;
}
div#pmm-mode-select select {
    width: 100%;
    font-size: 12px;
}
/**SELECT CONTROLS**/
div#pmm-select-controls {
    width: 54%;
}
div#pmm-select-only-input label {
    cursor: pointer;
    user-select: none;
    display: block;
    font-size: 12px;
    font-weight: bold;
    border: 1px solid;
    border-radius: 25px;
    padding: 3px;
    margin: 3px;
    text-align: center;
}
div#pmm-select-only-input label.pmm-disabled {
    cursor: default;
}
div#pmm-select-only-input input {
    margin-left: 0.25em;
    vertical-align: middle;
}
div#pmm-selection-buttons {
    display: flex;
    justify-content: space-around;
}
div#pmm-selection-buttons button.pmm-select {
    font-size: 10px;
    width: 30%;
    padding: 1px;
    border-radius: 3px;
    border: 1px solid;
}
div#pmm-selection-buttons button.pmm-select:disabled {
    cursor: default;
}
/**EDIT**/
#pmm-edit-dialog textarea {
    height: 20em;
}
/**TAG SCRIPT**/
div#pmm-tag-script-field input {
    width: 100%;
}
div#pmm-tag-script-field input.pmm-long-focus:focus {
    width: 95vw;
    z-index: 10;
    position: relative;
}
/**APPLY**/
div#pmm-apply-all button {
    width: 100%;
    margin: 0.2em 0;
    border: 2px solid;
    font-weight: bold;
    border-radius: 10px;
}
div#pmm-apply-all button:disabled {
    cursor: default;
}
/**PIN**/
button#pmm-undock {
    padding: 0 5px;
    position: absolute;
    top: 4px;
    left: 4px;
}
button#pmm-undock > span {
    height: 16px;
    width: 16px;
    display: inline-block;
}
/**COMMENTARY**/
#pmm-commentary-dialog > div {
    margin-bottom: 0.5em;
}
#pmm-commentary-dialog textarea {
    height: 15em;
}
#pmm-fetch input {
    width: 25%;
}
div#pmm-commentary-tags {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
}
div.pmm-commentary-tag {
    width: 36%;
    margin-left: 1em;
}
div.pmm-commentary-tag label {
    cursor: pointer;
    user-select: none;
    display: block;
    font-size: 12px;
    font-weight: bold;
    border: 1px solid;
    border-radius: 25px;
    padding: 3px 5.5em 3px 3px;
    margin: 3px;
    text-align: right;
    position: relative;
}
div.pmm-commentary-tag input {
    position: absolute;
    right: 3em;
    top: 25%;
}`;

const LIGHT_MODE_CSS = Template.normalizeCSS({theme: 'light'})`
article.pmm-selected {
    background-color: var(--grey-1);
    border-color: var(--grey-2);
}
article.pmm-selected.pmm-editing {
    background-color: var(--red-1);
    border-color: var(--red-2);
}
section#pmm-mode-box {
    background-color: var(--white);
    border-color: var(--grey-2);
}
div#pmm-select-only-input label {
    border-color: var(--blue-3);
    background-color: var(--blue-2);
}
div#pmm-select-only-input label:hover {
    border-color: var(--blue-4);
    background-color: var(--blue-3);
}
div#pmm-select-only-input label.pmm-disabled {
    color: var(--grey-5);
    border-color: var(--blue-2);
    background-color: var(--blue-1);
}
button#pmm-undock,
div#pmm-selection-buttons button.pmm-select {
    color: var(--black);
    background-color: var(--grey-1);
    border-color: var(--grey-2);
}
button#pmm-undock:hover,
div#pmm-selection-buttons button.pmm-select:hover {
    background-color: var(--white);
}
div#pmm-selection-buttons button.pmm-select:disabled {
    color: var(--grey-5);
    background-color: var(--white);
    border-color: var(--grey-1);
}
div#pmm-apply-all button {
    border-color: var(--green-5);
    background-color: var(--green-4);
    color: var(--white);
}
div#pmm-apply-all button:hover {
    border-color: var(--green-3);
    background-color: var(--green-3);
    box-shadow: 0 0 0 1px var(--green-4);
}
div#pmm-apply-all button:disabled {
    color: var(--grey-3);
    border-color: var(--green-2);
    background-color: var(--green-1);
    box-shadow: none;
}
button#pmm-undock {
    border-color: var(--grey-2);
    background-color: var(--grey-1);
}
button#pmm-undock:hover {
    background-color: var(--white);
}
section#pmm-placeholder {
    background-color: var(--grey-1);
}
div.pmm-commentary-tag label {
    border-color: var(--grey-2);
    background-color: var(--grey-1);
}
div.pmm-commentary-tag label:hover {
    border-color: var(--grey-3);
    background-color: var(--grey-2);
}
div.pmm-commentary-tag.pmm-disabled label {
    color: var(--grey-4);
    border-color: var(--grey-1);
    background-color: var(--grey-0);
    cursor: wait;
}
div.pmm-commentary-tag.pmm-active label {
    color: var(--white);
    border-color: var(--blue-6);
    background-color: var(--blue-5);
}
div.pmm-commentary-tag.pmm-active label:hover {
    border-color: var(--blue-7);
    background-color: var(--blue-6);
}
div.pmm-commentary-tag.pmm-active.pmm-disabled label {
    color: var(--grey-1);
    border-color: var(--blue-4);
    background-color: var(--blue-3);
}`;

const DARK_MODE_CSS = Template.normalizeCSS({theme: 'dark'})`
article.pmm-selected {
    background-color: var(--grey-8);
    border-color: var(--grey-7);
}
article.pmm-selected.pmm-editing {
    background-color: var(--red-9);
    border-color: var(--red-8);
}
section#pmm-mode-box {
    background-color: var(--grey-9);
    border-color: var(--grey-7);
}
div#pmm-select-only-input label {
    border-color: var(--blue-7);
    background-color: var(--blue-8);
}
div#pmm-select-only-input label:hover {
    border-color: var(--blue-6);
    background-color: var(--blue-7);
}
div#pmm-select-only-input label.pmm-disabled {
    color: var(--grey-5);
    border-color: var(--blue-8);
    background-color: var(--blue-9);
}
div#pmm-selection-buttons button.pmm-select {
    color: var(--white);
    background-color: var(--grey-7);
    border-color: var(--grey-6);
}
div#pmm-selection-buttons button.pmm-select:hover {
    background-color: var(--grey-6);
}
div#pmm-selection-buttons button.pmm-select:disabled {
    color: var(--grey-5);
    background-color: var(--grey-9);
    border-color: var(--grey-8);
}
div#pmm-apply-all button {
    color: var(--white);
    border-color: var(--green-5);
    background-color: var(--green-6);
}
div#pmm-apply-all button:hover {
    border-color: var(--green-4);
    background-color: var(--green-5);
    box-shadow: 0 0 0 1px var(--green-4);
}
div#pmm-apply-all button:disabled {
    color: var(--grey-5);
    border-color: var(--green-8);
    background-color: var(--green-9);
    box-shadow: none;
}
button#pmm-undock {
    border-color: var(--grey-4);
    background-color: var(--grey-3);
}
button#pmm-undock:hover {
    background-color: var(--grey-2);
}
section#pmm-placeholder {
    background-color: var(--grey-8);
}
div.pmm-commentary-tag label {
    border-color: var(--grey-5);
    background-color: var(--grey-6);
}
div.pmm-commentary-tag label:hover {
    border-color: var(--grey-4);
    background-color: var(--grey-5);
}
div.pmm-commentary-tag.pmm-disabled label {
    color: var(--grey-4);
    border-color: var(--grey-6);
    background-color: var(--grey-7);
    cursor: wait;
}
div.pmm-commentary-tag.pmm-active label {
    color: var(--white);
    border-color: var(--blue-6);
    background-color: var(--blue-5);
}
div.pmm-commentary-tag.pmm-active label:hover {
    border-color: var(--blue-5);
    background-color: var(--blue-4);
}
div.pmm-commentary-tag.pmm-active.pmm-disabled label {
    color: var(--grey-2);
    border-color: var(--blue-8);
    background-color: var(--blue-7);
}`;

const SEARCHBAR_CSS = Template.normalizeCSS()`
@media screen and (min-width: 661px){
    /* Position the main side bar down and make it relative to allow absolute positioning. */
    #c-posts #sidebar {
        margin-top: 4em;
        position: relative;
    }
    /* Push the content area down so that it doesn't overlap with the search bar. */
    #c-posts #content {
        margin-top: 4em;
    }
    /* Move the search box down. */
    #c-posts #search-box {
        position: absolute;
        top: -4em;
    }
    /*Screen-wide search bar*/
    #c-posts #search-box-form,
    #c-posts #tags {
        width: 95vw;
    }
}`;

const MENU_CSS = `
.jsplib-selectors.pmm-selectors[data-setting="available_modes"] label {
    width: 132px;
}
.jsplib-selectors.pmm-selectors[data-setting="id_separator"] label {
    width: 120px;
}`;

//HTML constants

const MODE_CONTROLS_HTML = Template.normalizeHTML()`
<section id="pmm-mode-box">
    <div id="pmm-mode-controls">
        <div id="pmm-mode-select">
            <h2>Mode</h2>
            <select name="mode">%s</select>
        </div>
        <div id="pmm-select-controls">
            <div id="pmm-select-only-input">
                <label for="pmm-select-only">
                    Select Only
                    <input type="checkbox" id="pmm-select-only">
                </label>
            </div>
            <div id="pmm-selection-buttons">
                <button class="pmm-select" data-type="all">All</button>
                <button class="pmm-select" data-type="none">None</button>
                <button class="pmm-select" data-type="invert">Invert</button>
            </div>
        </div>
    </div>
    <div id="pmm-tag-script-field">
        <input placeholder="Enter tag script" style="margin: 0.25em 0;" autocomplete="off" id="tag-script-field">
    </div>
    <div id="pmm-apply-all">
        <button>Apply</button>
    </div>
    <button id="pmm-undock" title="pin">
        <svg x="0" y="0" viewBox="0 0 128 128" style="transform: rotate(63deg);" width="18" height="18"><style>.st0,.st1{display:none;fill:#191919}.st1,.st4{fill-rule:evenodd;clip-rule:evenodd}.st4,.st5{display:inline;fill:#191919}</style><g id="row2"><path id="nav:4_1_" d="M36.1 55.8 75.9 76c4.9 2.5 6.8 8.4 4.3 13.2-2.5 4.8-8.5 6.7-13.4 4.2L26.9 73.2c-4.9-2.5-6.8-8.4-4.3-13.2s8.6-6.7 13.5-4.2zm1.8 28.5 13.3 6.8L23.9 127l14-42.7zM68.2 2l33.7 17.1c4.1 2.1 5.8 7.1 3.6 11.2-2.1 4.1-7.2 5.7-11.4 3.6L60.5 16.7c-4.1-2.1-5.8-7.1-3.6-11.2C59 1.5 64.1-.1 68.2 2zm7.9 69.1c2.3-6.8 5.4-14 9.2-21.1 2.1-4 4.3-7.8 6.6-11.4l-34-17.3c-1.7 3.9-3.5 7.9-5.6 11.9-3.8 7.2-7.9 13.8-12.2 19.6l36 18.3z" style="fill-rule:evenodd;clip-rule:evenodd;fill:#191919"></path></g></svg>
    </button>
</section>
<section id="pmm-placeholder" style="display: none;">
</section>`;

const EDIT_DIALOG_HTML = Template.normalizeHTML()`
<div id="pmm-edit-dialog">
    <div id="pmm-tag-string">
        <label for="post_tag_string">Tags</label>
        <textarea class="text-sm" id="post_tag_string" autocomplete="off"></textarea>
    </div>
    <div id="validation-input" style="display:none">
        <label for="skip-validate-tags">Skip Validation</label>
        <input type="checkbox" id="skip-validate-tags">
    </div>
    <div id="warning-bad-upload" class="notice notice-error" style="display:none;"></div>
    <div id="warning-new-tags" class="notice notice-error" style="display:none;"></div>
    <div id="warning-deprecated-tags" class="notice notice-error" style="display:none;"></div>
    <div id="warning-bad-removes" class="notice notice-info" style="display:none;"></div>
</div>`;

const COMMENTARY_DIALOG_HTML = Template.normalizeHTML()`
<div id="pmm-commentary-dialog">
    <div id="pmm-fetch">
        <label>Post ID</label>
        <input type="text" placeholder="Enter a post ID" autocomplete="off">
        <button name="post" title="Loads the commentary of the post ID entered.">Fetch post</button>
        <button name="parent" title="Loads the parent post's commentary amongst all of the selected posts.">Fetch parent</button>
        <button name="pool" title="Loads the first post's commentary of a pool amongst all of the selected posts.">Fetch pool</button>
    </div>
    <div class="pmm-commentary-input">
        <label for="pmm-artist-commentary-original-title">Original title</label>
        <input id="pmm-artist-commentary-original-title" name="original_title" type="text" autocomplete="off">
    </div>
    <div class="pmm-commentary-input">
        <label for="pmm-artist-commentary-original-description">Original description</label>
        <textarea id="pmm-artist-commentary-original-description" name="original_description" autocomplete="off"></textarea>
    </div>
    <div class="pmm-commentary-input">
        <label class="string optional" for="pmm-artist-commentary-translated-title">Translated title</label>
        <input id="pmm-artist-commentary-translated-title" name="translated_title" type="text" autocomplete="off">
    </div>
    <div class="pmm-commentary-input">
        <label class="text optional" for="pmm-artist-commentary-translated-description">Translated description</label>
        <textarea name="translated_description" id="pmm-artist-commentary-translated-description" autocomplete="off"></textarea>
    </div>
    <div id="pmm-commentary-tags">
        <div class="pmm-commentary-tag" data-tag="commentary">
            <label>
                Commentary
                <input type="checkbox" name="commentary">
            </label>
        </div>
        <div class="pmm-commentary-tag" data-tag="commentary_request">
            <label>
                Commentary request
                <input type="checkbox" name="commentary_request">
            </label>
        </div>
        <div class="pmm-commentary-tag" data-tag="commentary_check">
            <label>
                Commentary check
                <input type="checkbox" name="commentary_check">
            </label>
        </div>
        <div class="pmm-commentary-tag" data-tag="partial_commentary">
            <label>
                Partial commentary
                <input type="checkbox" name="partial_commentary">
            </label>
        </div>
    </div>
</div>`;

const MODE_SETTINGS_DETAILS = Template.normalizeHTML()`
<ul>
    <li><b>Copy ID:</b> Copies just the post ID.</li>
    <li><b>Copy short:</b> Copies the short link for posts, e.g. <code>post #1234</code>.</li>
    <li><b>Copy link:</b> Copies the full post URL.</li>
</ul>`;

//Other constants

const EDIT_DIALOG_SETTINGS = {
    title: "Post Edit",
    classes: {
        'ui-dialog': 'pmm-dialog',
    },
    autoOpen: false,
    modal: false,
    width: 1000,
};

const COMMENTARY_DIALOG_SETTINGS = {
    title: 'Edit Commentaries',
    classes: {
        'ui-dialog': 'pmm-dialog',
    },
    autoOpen: false,
    modal: true,
    width: 700,
};

const SEPARATOR_DICT = {
    comma: ',',
    colon: ':',
    semicolon: ';',
    space: ' ',
    return: '\n',
};

const ACTION_DICT = {
    'vote-up': 'already been voted up',
    'vote-down': 'already been voted down',
    'unvote': 'not been voted on',
    'favorite': 'already been favorited',
    'unfavorite': 'not been favorited',
};

const POST_PARENT_FIELDS = 'parent_id';
const POST_CATEGORY_FIELDS = 'tag_string_artist,tag_string_copyright,tag_string_character,tag_string_meta,tag_string_general';
const POST_VOTE_FIELDS = 'id,post_id,score';
const POOL_FIELDS = 'post_ids';
const ARTIST_COMMENTARY_FIELDS = 'original_title,original_description,translated_title,translated_description,post[tag_string_meta]';

const GOLD_LEVEL = 30;

/****Functions****/

//Helper functions

function GetAction() {
    return ACTION_DICT[PMM.mode];
}

function AlreadyActionNotice(post_id, singular) {
    if (singular) {
        Notice.error(`post #${post_id} has ${GetAction()}.`);
    }
}

function EnableEditInterface() {
    PMM.edit_dialog.find('input, button, textarea').attr('disabled', null);
    $('#pmm-edit-submit, #pmm-edit-validate').attr('disabled', null);
}

function DisableEditInterface() {
    PMM.edit_dialog.find('input, button, textarea').attr('disabled', 'disabled');
    $('#pmm-edit-submit, #pmm-edit-validate').attr('disabled', 'disabled');
}

function EnableCommentaryInterface() {
    PMM.commentary_dialog.find('input, button, textarea').attr('disabled', null);
    PMM.commentary_dialog.find('.pmm-commentary-tag').removeClass('pmm-disabled');
    $('#pmm-commentary-submit').attr('disabled', null);
}

function DisableCommentaryInterface() {
    PMM.commentary_dialog.find('input, button, textarea').attr('disabled', 'disabled');
    PMM.commentary_dialog.find('.pmm-commentary-tag').addClass('pmm-disabled');
    $('#pmm-commentary-submit').attr('disabled', 'disabled');
}

function GetCurrentScriptID() {
    return Storage.getLocalData('current_tag_script_id', {default_val: 1});
}

function GetCurrentTagScript() {
    return localStorage.getItem("tag-script-" + GetCurrentScriptID());
}

function CopyToClipboard(post_ids, prefix, suffix, joiner, afterspace) {
    if (afterspace && !['\n', ' '].includes(joiner)) {
        joiner += " ";
    }
    let post_string = Utility.joinList(post_ids, {prefix, suffix, joiner});
    DanbooruProxy.Utility.copyToClipboard(post_string);
}

function CoordinateInBox(coord, box) {
    return coord.x > box.left && coord.x < box.right && coord.y > box.top && coord.y < box.bottom;
}

function AreTagsEdited() {
    let tag_string = $('#pmm-tag-string textarea').val();
    let old_tag_string = $(`#post_${PMM.edit_post_id}`).data('tags');
    let normalized_tag_string = tag_string.trim().split(/\s+/).toSorted().join(' ');
    return normalized_tag_string !== old_tag_string;
}

async function ValidateTags() {
    if (!PMM.use_VTI) return true;
    let statuses = await Promise.all([PMM.VTI.ValidateTagAdds(), PMM.VTI.ValidateTagRemoves(), PMM.VTI.ValidateTagDeprecations()]);
    return statuses.every((item) => item);
}

//Relationship functions

async function ParentPostCheck(post_ids) {
    const printer = Debug.getFunctionPrint('ParentPostCheck');
    let parent_id = null;
    let child_ids = [];
    for (let i = 0; i < post_ids.length; i++) {
        let $post = $(`#post_${post_ids[i]}`);
        if ($post.hasClass('post-status-has-children')) {
            //Can include at most one parent into the selection
            if (parent_id !== null) {
                printer.logLevel("Multiple parents found.", Debug.INFO);
                return null;
            }
            parent_id = post_ids[i];
        } else if ($post.hasClass('post-status-has-parent')) {
            child_ids.push(post_ids[i]);
        } else {
            //Early bail when post has no parent or children
            printer.logLevel("Post found without parent/child:", post_ids[i], Debug.INFO);
            return null;
        }
    }
    if (child_ids.length === 0) {
        printer.logLevel("No children found.", Debug.INFO);
        return null;
    }
    let posts = await Danbooru.query('posts', {tags: `id:${child_ids.join(',')} status:any`, limit: child_ids.length, only: POST_PARENT_FIELDS});
    printer.logLevel("Parents found:", posts, Debug.DEBUG);
    let parent_ids = Utility.getObjectAttributes(posts, 'parent_id');
    //Must have only a single parent
    if (Utility.arrayUnique(parent_ids).length !== 1) {
        printer.logLevel("Multiple parents found.", Debug.INFO);
        return null;
    }
    //If the parent was included, it must match the children
    if (parent_id !== null && parent_id !== parent_ids[0]) {
        printer.logLevel("Parent does not match children:", parent_id, parent_ids[0], Debug.INFO);
        return null;
    }
    return parent_ids[0];
}

async function PoolPostCheck(post_ids) {
    const printer = Debug.getFunctionPrint('PoolPostCheck');
    let pools = await Danbooru.query('pools', {search: {post_ids_include_all: post_ids.join(' '), category: 'series'}, only: POOL_FIELDS});
    printer.logLevel("Pools found:", pools, Debug.DEBUG);
    if (pools.length !== 1) {
        return null;
    }
    return pools[0].post_ids[0];
}

function DestroyTooltip(post_id) {
    $(`#post_${post_id} .post-preview-image`).get(0)._tippy?.destroy();
}

//Update functions

function UpdateModeMenu(primary = true) {
    PMM.mode = $("#pmm-mode-box select").val();
    UpdateSelectControls();
    $('.pmm-selected').removeClass('pmm-selected');
    if (PMM.drag_select_enabled) {
        UpdateDraggerStatus();
    }
    if (PMM.edit_dialog?.dialog('isOpen')) {
        PMM.edit_dialog.dialog('close');
    }
    if (['favorite', 'unfavorite'].includes(PMM.mode)) {
        PreloadPostFavorites();
    }
    if (PMM.mode === 'unvote') {
        PreloadPostVotes();
    }
    if (primary) {
        Storage.setLocalData('pmm-mode', PMM.mode);
        PMM.channel.postMessage({type: 'change_mode', mode: PMM.mode});
    }
}

function UpdateSelectControls() {
    if (PMM.mode === 'tag-script') {
        $('#pmm-tag-script-field').show();
    } else {
        $('#pmm-tag-script-field').hide();
    }
    if (['edit', 'view'].includes(PMM.mode)) {
        $('#pmm-select-only-input input, #pmm-selection-buttons button, #pmm-apply-all button').attr('disabled', 'disabled');
        $('#pmm-select-only-input label').addClass('pmm-disabled');
    } else {
        $('#pmm-select-only-input input, #pmm-selection-buttons button, #pmm-apply-all button').attr('disabled', null);
        $('#pmm-select-only-input label').removeClass('pmm-disabled');
        if (!PMM.select_only) {
            $('#pmm-selection-buttons button, #pmm-apply-all button').attr('disabled', 'disabled');
        }
    }
}

function UpdateSelectOnly(primary = true) {
    PMM.select_only = $('#pmm-select-only-input input').prop('checked');
    UpdateSelectControls();
    $('.pmm-selected').removeClass('pmm-selected');
    if (primary) {
        Storage.setLocalData('pmm-select-only', PMM.select_only);
        PMM.channel.postMessage({type: 'change_select_only', select_only: PMM.select_only});
    }
}

function UpdatePostPreview(post_id, score, {score_change = null, post_score = null, vote_id = null} = {}) {
    let $post_article = $(`#post_${post_id}`);
    let $score_link = $post_article.find('.post-score a');
    if ($score_link.length) {
        if (!post_score) {
            let current_score = Number($score_link.text());
            post_score = current_score + score_change;
        }
        $score_link.text(post_score);
        $post_article.find('.post-votes .active-link').toggleClass('active-link inactive-link');
        UpdatePostVoteLink($post_article.find('.post-upvote-link'), 'upvote', post_id, score, vote_id);
        UpdatePostVoteLink($post_article.find('.post-downvote-link'), 'downvote', post_id, score, vote_id);
    }
    DestroyTooltip(post_id);
}

function UpdatePostVoteLink($vote, type, post_id, score, vote_id) {
    if ((type === 'upvote' && score === 1) || (type === 'downvote' && score === -1)) {
        $vote.toggleClass('active-link inactive-link');
        $vote.addClass('post-unvote-link');
        Utility.setDataAttribute($vote, 'method', 'delete');
        if (vote_id === null) {
            Danbooru.query('post_votes', {search: {post_id, user_id: PMM.user_id}, limit: 1, only: POST_VOTE_FIELDS}).then((data) => {
                $vote.attr('href', `/post_votes/${data.id}`);
            });
        } else {
            $vote.attr('href', `/post_votes/${vote_id}`);
        }
    } else {
        let link_score = (type === 'upvote' ? 1 : -1);
        $vote.removeClass('post-unvote-link');
        Utility.setDataAttribute($vote, 'method', 'post');
        $vote.attr('href', `/posts/${post_id}/votes?score=${link_score}`);
    }
}

function UpdateCommentaryTags(tag_string) {
    let tags = tag_string.split(' ');
    $('.pmm-commentary-tag.pmm-active').removeClass('pmm-active');
    $('.pmm-commentary-tag input').prop('checked', false);
    ['commentary', 'commentary_request', 'commentary_check', 'partial_commentary'].forEach((tag_name) => {
        if (tags.includes(tag_name)) {
            $(`.pmm-commentary-tag[data-tag="${tag_name}"]`).addClass('pmm-active');
            $(`.pmm-commentary-tag input[name="${tag_name}"]`).prop('checked', true);
        }
    });
}

function UpdateDraggerStatus() {
    const printer = Debug.getFunctionPrint('UpdateDraggerStatus');
    if (DRAGGABLE_MODES.includes(PMM.mode) && PMM.dragger.stopped) {
        printer.logLevel("Dragger started.", Debug.DEBUG);
        PMM.dragger.start();
    } else if (!DRAGGABLE_MODES.includes(PMM.mode) && !PMM.dragger.stopped) {
        PMM.dragger.stop();
        printer.logLevel("Dragger stopped.", Debug.DEBUG);
    }
}

//Render functions

function RenderPostModeMenu() {
    let selection_options = RenderPostModeMenuAddons();
    return Utility.sprintf(MODE_CONTROLS_HTML, selection_options);
}

function RenderPostModeMenuAddons() {
    let html = '<option value="view">View</option>';
    PMM.mode_order.forEach((mode) => {
        let key = Utility.kebabCase(mode);
        if (!PMM.available_mode_keys.has(key)) return;
        let name = Utility.displayCase(mode);
        html += `<option value="${key}">${name}</option>`;
    });
    return html;
}

//Initialize functions

function InitializeModeMenu() {
    $('#mode-box').replaceWith(RenderPostModeMenu());
    $('#pmm-mode-box select').on(JSPLib.event.change, () => UpdateModeMenu());
    $('#pmm-select-only').on(JSPLib.event.change, () => UpdateSelectOnly());
    $('.pmm-select').on(JSPLib.event.click, BatchSelection);
    $('#pmm-apply-all button').on(JSPLib.event.click, BatchApply);
    $('#pmm-undock').on(JSPLib.event.click, UndockModeMenu);
    $('.post-preview a.post-preview-link').on(JSPLib.event.click, PostModeMenu);
    $('.post-preview a.post-upvote-link').on(JSPLib.event.click, PostUpvote);
    $('.post-preview a.post-downvote-link').on(JSPLib.event.click, PostDownvote);
    $('#pmm-tag-script-field input').on('blur.pmm', SaveTagScript);
    $(document).on('keydown.pmm.change_tag_script', null, "0 1 2 3 4 5 6 7 8 9", ChangeTagScript);
    $("#pmm-mode-controls select").val(PMM.mode);
    $("#pmm-select-only").prop('checked', PMM.select_only);
    $('#pmm-tag-script-field input').val(GetCurrentTagScript());
    SetupAutocomplete('#pmm-tag-script-field input');
    if (PMM.long_tagscript_enabled) {
        $('#pmm-tag-script-field input').addClass('pmm-long-focus');
    }
    UpdateModeMenu(false);
}

function EditDialog(post_ids) {
    if (post_ids.length !== 1) return;
    PMM.edit_post_id = post_ids[0];
    if (!PMM.edit_dialog) {
        PMM.edit_dialog = $(EDIT_DIALOG_HTML);
        let buttons = {Submit: SubmitEdit};
        if (PMM.use_VTI) {
            buttons.Validate = ValidateEdit;
        }
        buttons.Cancel = CloseDialog;
        PMM.edit_dialog.dialog(Utility.assignObjects({
            buttons,
            open: EditDialogOpen,
            close: EditDialogClose
        }, EDIT_DIALOG_SETTINGS));
        SetupAutocomplete('#pmm-tag-string textarea');
        PMM.edit_dialog.find('#pmm-tag-string textarea').on('keydown.pmm', null, 'ctrl+return', SubmitEdit);
        PMM.edit_dialog.closest('.pmm-dialog').find('.ui-button').each((_, entry) => {
            let button_id = 'pmm-edit-' + entry.innerText.toLowerCase();
            $(entry).attr('id', button_id);
        });
    }
    if (PMM.edit_dialog.dialog('isOpen')) {
        //Trigger a close that the the close/open handlers get called
        PMM.edit_dialog.dialog('close');
    }
    PMM.edit_dialog.dialog('open');
}

function CommentaryDialog(post_ids) {
    PMM.commentary_post_ids = post_ids;
    if (!PMM.commentary_dialog) {
        PMM.commentary_dialog = $(COMMENTARY_DIALOG_HTML);
        PMM.commentary_dialog.dialog(Utility.assignObjects({
            buttons: {
                Submit: SubmitCommentary,
                Cancel: CloseDialog,
            },
            open: CommentaryDialogOpen,
            close: CommentaryDialogClose,
        }, COMMENTARY_DIALOG_SETTINGS));
        PMM.commentary_dialog.find('#pmm-fetch button[name=post]').on(JSPLib.event.click, FetchPostCommentary);
        PMM.commentary_dialog.find('#pmm-fetch button[name=parent]').on(JSPLib.event.click, FetchParentCommentary);
        PMM.commentary_dialog.find('#pmm-fetch button[name=pool]').on(JSPLib.event.click, FetchPoolCommentary);
        PMM.commentary_dialog.find('.pmm-commentary-tag input').on(JSPLib.event.change, ChangeCommentaryTag);
        PMM.commentary_dialog.closest('.pmm-dialog').find('.ui-button').each((_, entry) => {
            let button_id = 'pmm-commentary-' + entry.innerText.toLowerCase();
            $(entry).attr('id', button_id);
        });
    }
    PMM.commentary_dialog.dialog('open');
}

function SetupAutocomplete(selector) {
    const printer = Debug.getFunctionPrint('SetupAutocomplete');
    Load.scriptWaitExecute(PMM, 'IAC', {
        available: () => {
            $(selector).data('autocomplete', 'tag-edit');
            PMM.IAC.InitializeTagQueryAutocompleteIndexed(selector, null);
            printer.logLevel(`Initialized IAC autocomplete on ${selector}.`, Debug.DEBUG);
        },
        fallback: () => {
            Danbooru.initializeAutocomplete(selector, 'tag-edit');
        },
    });
}

function UnbindEventHandlers() {
    const printer = Debug.getFunctionPrint('UnbindEventHandlers');
    Utility.DOMWaitExecute({
        namespace_check: {
            root: document,
            type: 'keydown',
            namespace: 'danbooru.change_tag_script',
            presence: true,
        },
        found () {
            $(document).off('keydown.danbooru.change_tag_script');
            $(document).off('click.danbooru', '.post-preview-container a');
            printer.logLevel("Unbound Danbooru event handlers.", Debug.VERBOSE);
        },
        interval: 100,
        duration: Utility.one_second * 5,
    });
    Utility.DOMWaitExecute({
        namespace_check: {
            root: '.post-preview a',
            type: 'click',
            namespace: 'vti',
            presence: true,
        },
        found () {
            $('.post-preview a').off('click.vti');
            printer.logLevel("Unbound VTI event handlers.", Debug.VERBOSE);
        },
        interval: 100,
        duration: Utility.one_second * 5,
    });
}

//Network functions

async function VotePost(post_id, score, singular) {
    let selector = (score > 0 ? '.post-upvote-link.active-link' : '.post-downvote-link.active-link');
    if ($(`#post_${post_id} ${selector}`).length) {
        AlreadyActionNotice(post_id, singular);
        return false;
    }
    const printer = Debug.getFunctionPrint('VotePost');
    printer.logLevel(post_id, Debug.DEBUG);
    await Danbooru.updateSetup();
    Network.post(`/posts/${post_id}/votes.json?score=${score}`)
        .always(Danbooru.alwaysCallback())
        .then(
            Danbooru.successCallback(post_id, 'VotePost', (data) => {
                let score_change = score - (PMM.post_votes[post_id]?.score ?? 0);
                UpdatePostPreview(post_id, score, {score_change, vote_id: data.id});
                PMM.post_votes[post_id] = {id: data.id, score};
            }),
            Danbooru.errorCallback(post_id, 'VotePost', {score})
        );
    return true;
}

async function UnvotePost(post_id, singular) {
    if ($(`#post_${post_id} .post-votes .active-link`).length === 0) {
        AlreadyActionNotice(post_id, singular);
        return false;
    }
    const printer = Debug.getFunctionPrint('UnvotePost');
    printer.logLevel(post_id, Debug.DEBUG);
    await PMM.post_vote_promise;
    let vote_id = PMM.post_votes[post_id].id;
    await Danbooru.updateSetup();
    //eslint-disable-next-line dot-notation
    Network.delete(`/post_votes/${vote_id}.json`)
        .always(Danbooru.alwaysCallback())
        .then(
            Danbooru.successCallback(post_id, 'UnvotePost', () => {
                let score_change = -PMM.post_votes[post_id].score;
                UpdatePostPreview(post_id, 0, {score_change});
                delete PMM.post_votes[post_id];
            }),
            Danbooru.errorCallback(post_id, 'UnvotePost')
        );
    return true;
}

async function FavoritePost(post_id, singular) {
    if (PMM.post_favorites[post_id]) {
        AlreadyActionNotice(post_id, singular);
        return false;
    }
    const printer = Debug.getFunctionPrint('FavoritePost');
    printer.logLevel(post_id, Debug.DEBUG);
    await Danbooru.updateSetup();
    Network.post(`/favorites.json?post_id=${post_id}`)
        .always(Danbooru.alwaysCallback())
        .then(
            Danbooru.successCallback(post_id, 'FavoritePost', (data) => {
                UpdatePostPreview(post_id, 1, {post_score: data.score});
                PMM.post_favorites[post_id] = true;
                Utility.setDataAttribute($(`#post_${post_id}`), 'is-favorited', true);
            }),
            Danbooru.errorCallback(post_id, 'FavoritePost')
        );
    return true;
}

async function UnfavoritePost(post_id, singular) {
    await PMM.post_favorite_promise;
    if (!PMM.post_favorites[post_id]) {
        AlreadyActionNotice(post_id, singular);
        return false;
    }
    const printer = Debug.getFunctionPrint('UnfavoritePost');
    printer.logLevel(post_id, Debug.DEBUG);
    await Danbooru.updateSetup();
    //eslint-disable-next-line dot-notation
    Network.delete(`/favorites/${post_id}.json`)
        .always(Danbooru.alwaysCallback())
        .then(
            Danbooru.successCallback(post_id, 'UnfavoritePost', () => {
                UpdatePostPreview(post_id, 0, {score_change: -1});
                PMM.post_favorites[post_id] = false;
                Utility.setDataAttribute($(`#post_${post_id}`), 'is-favorited', false);
            }),
            Danbooru.errorCallback(post_id, 'UnfavoritePost')
        );
    return true;
}

async function UpdatePostCommentary(post_id, artist_commentary, tag_changes) {
    const printer = Debug.getFunctionPrint('UpdatePostCommentary');
    printer.logLevel(post_id, artist_commentary, tag_changes, Debug.DEBUG);
    await Danbooru.updateSetup();
    return Network.put(`/posts/${post_id}/artist_commentary/create_or_update.json`, {data: {artist_commentary}})
        .always(Danbooru.alwaysCallback())
        .then(
            Danbooru.successCallback(post_id, 'UpdatePostCommentary', () => {
                let $post = $(`#post_${post_id}`);
                let tags = $post.data('tags').split(' ');
                let updated_tags = Utility.arrayUnion(tags, tag_changes.adds);
                updated_tags = Utility.arrayDifference(updated_tags, tag_changes.removes);
                Utility.setDataAttribute($post, 'tags', updated_tags.toSorted().join(' '));
                DestroyTooltip(post_id);
            }),
            Danbooru.errorCallback(post_id, 'UpdatePostCommentary', artist_commentary)
        );
}

function TagscriptPost(post_id) {
    const printer = Debug.getFunctionPrint('TagscriptPost');
    let tag_script = $('#pmm-tag-script-field input').val().trim();
    if (tag_script) {
        printer.logLevel(post_id, {tag_script}, Debug.DEBUG);
        Danbooru.updatePost(post_id, {post: {old_tag_string: "", tag_string: tag_script}}).then(() => {
            DestroyTooltip(post_id);
        });
    } else {
        Notice.error('No tag script set!');
    }
}

function GetCommentary(post_id) {
    const printer = Debug.getFunctionPrint('GetCommentary');
    printer.logLevel(post_id, Debug.DEBUG);
    return Danbooru.query(`posts/${post_id}/artist_commentary`, {only: ARTIST_COMMENTARY_FIELDS}).then((artist_commentary) => {
        if (artist_commentary !== null) {
            ['original_title', 'original_description', 'translated_title', 'translated_description'].forEach((field) => {
                PMM.commentary_dialog.find(`[name="${field}"]`).val(artist_commentary[field]);
            });
            UpdateCommentaryTags(artist_commentary.post.tag_string_meta);
        } else {
            Notice.error("No commentary found.");
        }
    });
}

async function PreloadPostVotes() {
    if (Object.keys(PMM.post_votes).length) return;
    const printer = Debug.getFunctionPrint('PreloadPostVotes');
    let p = Utility.createPromise();
    PMM.post_vote_promise = p.promise;
    let $post_votes = $('.post-votes');
    if ($post_votes.length) {
        printer.log("Loading votes from DOM.");
        $post_votes.each((_, entry) => {
            let $entry = $(entry);
            let post_id = $entry.closest('.post-preview').data('id');
            let $active_link = $entry.find('.active-link');
            if ($active_link.length) {
                let score = ($active_link.hasClass('post-upvote-link') ? 1 : -1);
                let vote_id = Number($active_link.attr('href').match(/\d+/));
                PMM.post_votes[post_id] = {id: vote_id, score};
            }
        });
    } else {
        printer.log("Loading votes from network.");
        let post_ids = Utility.getDOMArrayDataValues($('.post-votes .active-link').closest('.post-preview'), 'id', {parser: Number});
        if (post_ids.length) {
            let post_votes = await Danbooru.query('post_votes', {search: {post_id: post_ids.join(','), user_id: PMM.user_id}, limit: post_ids.length, only: POST_VOTE_FIELDS});
            post_votes.forEach((vote) => {
                PMM.post_votes[vote.post_id] = {id: vote.id, score: vote.score};
            });
        }
    }
    p.resolve(null);
}

function PreloadPostFavorites() {
    if (Object.keys(PMM.post_favorites).length) return;
    const printer = Debug.getFunctionPrint('PreloadPostFavorites');
    let p = Utility.createPromise();
    PMM.post_favorite_promise = p.promise;
    Load.scriptWaitExecute(PMM, 'DPI', {
        version: false,
        available: () => {
            printer.log("Loading favorites from DOM.");
            let post_ids = [];
            $('.post-preview').each((_, entry) => {
                let $entry = $(entry);
                let favorited = $entry.data('is-favorited');
                if (typeof favorited === 'boolean') {
                    let post_id = $entry.data('id');
                    post_ids.push(post_id);
                    PMM.post_favorites[post_id] = favorited;
                }
            });
            p.resolve(null);
        },
        fallback: () => {
            printer.log("Loading favorites from network.");
            let post_ids = Utility.getDOMArrayDataValues($('.post-preview'), 'id', {parser: Number});
            if (post_ids.length) {
                Danbooru.query('favorites', {search: {post_id: post_ids.join(','), user_id: PMM.user_id}, limit: post_ids.length, only: POST_VOTE_FIELDS}).then((post_favorites) => {
                    let favorite_post_ids = Utility.getObjectAttributes(post_favorites, 'post_id');
                    post_ids.forEach((post_id) => {
                        PMM.post_favorites[post_id] = favorite_post_ids.includes(post_id);
                    });
                    p.resolve(null);
                });
            } else {
                p.resolve(null);
            }
        },
    });
}

//Event handlers

function PostModeMenu(event) {
    let $article = $(event.currentTarget).closest("article");
    if (PMM.select_only && DRAGGABLE_MODES.includes(PMM.mode)) {
        $article.toggleClass('pmm-selected');
    } else if (PMM.mode !== 'view') {
        let post_id = $article.data("id");
        $article.addClass('pmm-selected');
        MenuFunctions([post_id]);
    } else {
        return;
    }
    event.preventDefault();
}

function BatchSelection(event) {
    let type = $(event.currentTarget).data('type');
    switch (type) {
        case 'all':
            $('.post-preview').addClass('pmm-selected');
            break;
        case 'none':
            $('.post-preview').removeClass('pmm-selected');
            break;
        case 'invert':
            $('.post-preview').toggleClass('pmm-selected');
            //falls through
        default:
            //do nothing
    }
}

function BatchApply() {
    let $selected_posts = $('.pmm-selected');
    let post_ids = Utility.getDOMArrayDataValues($selected_posts, 'id', {parser: Number});
    MenuFunctions(post_ids);
}

function SaveTagScript(event) {
    let tag_script = $(event.target).val();
    let current_script_id = GetCurrentScriptID();
    if (tag_script) {
        localStorage.setItem("tag-script-" + current_script_id, tag_script);
    } else {
        localStorage.removeItem("tag-script-" + current_script_id);
    }
}

function ChangeTagScript(event) {
    if (PMM.mode === 'tag-script') {
        let current_script_id = GetCurrentScriptID();
        let change_script_id = Number(event.key);
        if (current_script_id !== change_script_id) {
            Storage.setLocalData('current_tag_script_id', change_script_id);
            Notice.notice(`Switched to tag script #${event.key}. To switch tag scripts, use the number keys.`);
        }
        $("#pmm-tag-script-field input").val(GetCurrentTagScript());
        event.preventDefault();
    }
}

function UndockModeMenu() {
    let $mode_box = $('#pmm-mode-box');
    let $placeholder = $('#pmm-placeholder');
    let $pin_svg = $('#pmm-undock > svg');
    let {height, width} = getComputedStyle($mode_box.get(0));
    if (PMM.pinned) {
        $mode_box.css({top: "", left: "", width: "", position: 'relative'});
        $pin_svg.css('transform', 'rotate(63deg)');
        $placeholder.hide();
        PMM.pinned = false;
    } else {
        let {top, left} = $mode_box.get(0).getBoundingClientRect();
        $mode_box.css({top, left, width, position: 'fixed'});
        $pin_svg.css('transform', 'rotate(-27deg)');
        $placeholder.show();
        PMM.pinned = true;
    }
    $('#pmm-placeholder').css('height', height);
}

function PostUpvote(event) {
    let $link = $(event.currentTarget);
    let $post = $link.closest('.post-preview');
    let is_voted = $link.hasClass('active-link');
    let post_id = $post.data('id');
    if (is_voted) {
        let vote_id = Number($link.attr('href').match(/\d+/));
        PMM.post_votes[post_id] = {id: vote_id, score: 1};
        UnvotePost(post_id, true);
    } else {
        VotePost(post_id, 1, true);
    }
    event.preventDefault();
    event.stopImmediatePropagation();
}

function PostDownvote(event) {
    let $link = $(event.currentTarget);
    let $post = $link.closest('.post-preview');
    let is_voted = $link.hasClass('active-link');
    let post_id = $post.data('id');
    if (is_voted) {
        let vote_id = Number($link.attr('href').match(/\d+/));
        PMM.post_votes[post_id] = {id: vote_id, score: -1};
        UnvotePost(post_id, true);
    } else {
        VotePost(post_id, -1, true);
    }
    event.preventDefault();
    event.stopImmediatePropagation();
}

function SubmitEdit(event) {
    const printer = Debug.getFunctionPrint('SubmitEdit');
    if (AreTagsEdited()) {
        $('#pmm-edit-submit, #pmm-edit-validate').attr('disabled', 'disabled');
        DisableEditInterface();
        ValidateTags().then((status) => {
            if (status) {
                let tag_string = $('#pmm-tag-string textarea').val();
                let old_tag_string = $(`#post_${PMM.edit_post_id}`).data('tags');
                printer.logLevel({old_tag_string, tag_string}, Debug.DEBUG);
                Danbooru.updatePost(PMM.edit_post_id, {post: {old_tag_string, tag_string}}).then(() => {
                    DestroyTooltip(PMM.edit_post_id);
                });
                CloseDialog(event);
            } else {
                Notice.error("Tag validation failed!");
            }
            $('#pmm-edit-submit, #pmm-edit-validate').attr('disabled', null);
            EnableEditInterface('#pmm-edit-dialog');
        });
    } else {
        printer.logLevel("Tags not edited.", Debug.VERBOSE);
        CloseDialog(event);
    }
}

function ValidateEdit() {
    if (AreTagsEdited()) {
        $('#pmm-edit-submit, #pmm-edit-validate').attr('disabled', 'disabled');
        DisableEditInterface();
        ValidateTags().then((status) => {
            if (status) {
                Notice.notice("Tags good to submit!");
            } else {
                Notice.error("Tag validation failed!");
            }
            $('#pmm-edit-submit, #pmm-edit-validate').attr('disabled', null);
            EnableEditInterface();
        });
    } else {
        $("#warning-new-tags, #warning-bad-removes, #warning-deprecated-tags").hide();
        Notice.notice("Tags good to submit!");
    }
}

function EditDialogOpen() {
    let tag_string = $(`#post_${PMM.edit_post_id}`).data('tags');
    let $text_area = PMM.edit_dialog.find('#pmm-tag-string textarea');
    if (PMM.edit_tag_grouping_enabled) {
        $text_area.val('loading...');
        $text_area.attr('disabled', 'disabled');
        Danbooru.query('posts/' + PMM.edit_post_id, {only: POST_CATEGORY_FIELDS}).then((data) => {
            let grouped_tag_string = "";
            ['artist', 'copyright', 'character', 'meta', 'general'].forEach((type) => {
                let type_tag_string = data['tag_string_' + type];
                if (type_tag_string.length) {
                    grouped_tag_string += type_tag_string + '\n';
                }
            });
            $text_area.val(grouped_tag_string.trim() + " ");
            $text_area.attr('disabled', null);
            $text_area.get(0).focus();
        });
    } else {
        $text_area.val(tag_string + ' ');
        $text_area.get(0).focus();
    }
    if (PMM.use_VTI) {
        PMM.VTI.preedit_tags = tag_string.split(' ');
        PMM.VTI.PreloadImplications();
    }
    $('.pmm-editing').removeClass('pmm-editing');
    $(`#post_${PMM.edit_post_id}`).addClass('pmm-editing');
}

function EditDialogClose() {
    $(`#post_${PMM.edit_post_id}`).removeClass('pmm-editing');
    $("#validation-input, #warning-new-tags, #warning-bad-removes, #warning-deprecated-tags").hide();
}

function FetchPostCommentary() {
    let post_id = Number($('#pmm-fetch input').val());
    if (Utility.validateID(post_id)) {
        Notice.notice("Loading commentary data.");
        DisableCommentaryInterface();
        GetCommentary(post_id).then(() => {
            Notice.notice("Commentary loaded.");
            EnableCommentaryInterface();
        });
    } else {
        Notice.error("Must enter a valid post ID.");
    }
}

function FetchParentCommentary() {
    Notice.notice("Checking parent/child relationship.");
    DisableCommentaryInterface();
    ParentPostCheck(PMM.commentary_post_ids).then((post_id) => {
        if (post_id !== null) {
            Notice.notice("Loading commentary data.");
            $('#pmm-fetch input').val(post_id);
            GetCommentary(post_id).then(() => {
                Notice.notice("Commentary loaded.");
                EnableCommentaryInterface();
            });
        } else {
            Notice.error("Parent/child relationship not found.");
            EnableCommentaryInterface();
        }
    });
}

function FetchPoolCommentary() {
    Notice.notice("Checking pool relationship.");
    DisableCommentaryInterface();
    PoolPostCheck(PMM.commentary_post_ids).then((post_id) => {
        if (post_id !== null) {
            Notice.notice("Loading commentary data.");
            $('#pmm-fetch input').val(post_id);
            GetCommentary(post_id).then(() => {
                Notice.notice("Commentary loaded.");
                EnableCommentaryInterface();
            });
        } else {
            Notice.error("Pool relationship not found.");
            EnableCommentaryInterface();
        }
    });
}

function ChangeCommentaryTag(event) {
    $(event.currentTarget).closest('.pmm-commentary-tag').toggleClass('pmm-active');
}

function SubmitCommentary(event) {
    let post_ids = PMM.commentary_post_ids;
    let artist_commentary = {};
    $('.pmm-commentary-input input, .pmm-commentary-input textarea').each((_, input) => {
        artist_commentary[input.name] = input.value;
    });
    let tag_changes = {adds: [], removes: []};
    $('.pmm-commentary-tag input').each((_, input) => {
        let field_name = (input.checked ? 'add_' : 'remove_') + input.name + '_tag';
        artist_commentary[field_name] = 1;
        if (input.checked) {
            tag_changes.adds.push(input.name);
        } else {
            tag_changes.removes.push(input.name);
        }
    });
    let promise_array = post_ids.map((post_id) => UpdatePostCommentary(post_id, artist_commentary, tag_changes));
    Promise.all(promise_array).then((responses) => {
        if (responses.every(Boolean)) {
            Notice.notice("All posts updated.");
        } else {
            let successes = responses.reduce((acc, val) => acc + Number(val), 0);
            let failures = responses.length - successes;
            Notice.error(`Error updating posts:<br><ul><li>successes: ${successes}</li><li>failures: ${failures}</li></ul>`);
        }
    });
    CloseDialog(event);
}

function CommentaryDialogOpen() {
    let post_ids = PMM.commentary_post_ids;
    if (PMM.commentary_post_ids.length === 1) {
        $('#pmm-fetch input').val(PMM.commentary_post_ids[0]);
        UpdateCommentaryTags($(`#post_${post_ids[0]}`).data('tags'));
        if (PMM.autoload_post_commentary_enabled) {
            Notice.notice("Loading commentary data.");
            DisableCommentaryInterface();
            GetCommentary(PMM.commentary_post_ids[0]).then(() => {
                Notice.notice("Commentary loaded.");
                EnableCommentaryInterface();
            });
        }
    }
}

function CommentaryDialogClose() {
    $('#pmm-commentary-dialog').find('input, textarea').val("");
    $('#pmm-commentary-dialog').find('.pmm-commentary-tag.pmm-active').removeClass('pmm-active');
    $('#pmm-commentary-dialog').find('.pmm-commentary-tag input').prop('checked', false);
}

function CloseDialog(event) {
    $('#close-notice-link').get(0).click();
    let $dialog = $(event.target).closest('.ui-dialog').find('.ui-dialog-content');
    $dialog.dialog('close');
}

function DragSelectCallback({items, event}) {
    const printer = Debug.getFunctionPrint('DragSelectCallback');
    //Only process drag select events when the primary (left) and only the primary mouse button is used.
    if (!event.button !== 0 && event.buttons !== 0) return;
    printer.logLevel("Parameters:", {items, event}, Debug.DEBUG);
    let click_coords = PMM.dragger.getInitialCursorPositionArea();
    let mouseup_coords = PMM.dragger.getCurrentCursorPositionArea();
    if (mouseup_coords.x === click_coords.x && mouseup_coords.y === click_coords.y) {
        printer.log("Click event.");
        return;
    }
    if (items.length === 1) {
        let area_coords = Utility.getElemPosition(PMM.$drag_area);
        let page_click_coords = {x: click_coords.x + area_coords.left, y: click_coords.y + area_coords.top};
        let page_mouseup_coords = {x: mouseup_coords.x + area_coords.left, y: mouseup_coords.y + area_coords.top};
        let box = Utility.getElemPosition(items[0]);
        box.bottom = box.top + items[0].offsetHeight;
        box.right = box.left + items[0].offsetWidth;
        printer.logLevel('Coordinates:', {page_click_coords, page_mouseup_coords, box}, Debug.DEBUG);
        if (CoordinateInBox(page_click_coords, box) && CoordinateInBox(page_mouseup_coords, box)) {
            printer.log("Click-drag within element.");
            return;
        }
    }
    let articles = items.map((entry) => $(entry).closest('article').get(0));
    let post_ids = articles.map((entry) => $(entry).data('id'));
    printer.log('Drag Select IDs:', post_ids);
    if (PMM.select_only) {
        $(articles).toggleClass('pmm-selected');
    } else {
        $(articles).addClass('pmm-selected');
        MenuFunctions(post_ids);
    }
    document.getSelection().removeAllRanges();
}

//Menu function

function MenuFunctions(post_ids) {
    if (['edit', 'copy-id', 'copy-short', 'copy-link', 'commentary'].includes(PMM.mode)) {
        MenuFunctionsMulti(post_ids);
    } else {
        let singular = post_ids.length === 1;
        let promise_array = [];
        for (let i = 0; i < post_ids.length; i++) {
            promise_array.push(MenuFunctionsSingle(post_ids[i], singular));
        }
        if (['vote-up', 'vote-down', 'unvote', 'favorite', 'unfavorite'].includes(PMM.mode) && post_ids.length > 1) {
            Promise.all(promise_array).then((statuses) => {
                if (!statuses.some((status) => status)) {
                    Notice.error(`All selected posts have ${GetAction()}.`);
                }
            });
        }
    }
}

function MenuFunctionsSingle(post_id, singular) {
    switch (PMM.mode) {
        case 'vote-up':
            return VotePost(post_id, 1, singular);
        case 'vote-down':
            return VotePost(post_id, -1, singular);
        case 'unvote':
            return UnvotePost(post_id, singular);
        case 'favorite':
            return FavoritePost(post_id, singular);
        case 'unfavorite':
            return UnfavoritePost(post_id, singular);
        case 'tag-script':
            TagscriptPost(post_id);
            //falls through
        default:
            //do nothing
    }
}

function MenuFunctionsMulti(post_ids) {
    switch (PMM.mode) {
        case 'edit':
            EditDialog(post_ids);
            break;
        case 'copy-id':
            CopyToClipboard(post_ids, "", "", PMM.id_separator_char, false);
            break;
        case 'copy-short':
            CopyToClipboard(post_ids, "post #", "", PMM.id_separator_char, true);
            break;
        case 'copy-link':
            CopyToClipboard(post_ids, "https://danbooru.donmai.us/posts/", " ", PMM.id_separator_char, true);
            break;
        case 'commentary':
            CommentaryDialog(post_ids);
            //falls through
        default:
            //do nothing
    }
}

//Settings functions

function BroadcastPMM(ev) {
    const printer = Debug.getFunctionPrint('BroadcastPMM');
    printer.log(`(${ev.data.type}):`, ev.data);
    switch (ev.data.type) {
        case 'change_mode':
            $("#pmm-mode-controls select").val(ev.data.mode);
            UpdateModeMenu(false);
            break;
        case 'change_select_only':
            $('#pmm-select-only-input input').prop('checked', ev.data.select_only);
            UpdateSelectOnly(false);
            //falls through
        default:
            //do nothing
    }
}

function InitializeProgramValues() {
    PMM.user_id = DanbooruProxy.CurrentUser.data('id');
    if (!Utility.validateID(PMM.user_id) || DanbooruProxy.CurrentUser.data('level') < GOLD_LEVEL || DanbooruProxy.CurrentUser.data('is-banned')) return false;
    Utility.assignObjects(PMM, {
        mode: Storage.getLocalData('pmm-mode'),
        available_mode_keys: new Set(PMM.available_modes.map((mode) => Utility.kebabCase(mode.toLocaleLowerCase()))),
        id_separator_char: SEPARATOR_DICT[PMM.id_separator[0]],
        select_only: Storage.getLocalData('pmm-select-only', {default_val: false}),
        $drag_area: document.querySelector('#posts'),
    });
    if ((PMM.safe_tag_script_enabled && PMM.mode === 'tag-script') || !PMM.available_mode_keys.has(PMM.mode)) {
        PMM.mode = 'view';
    }
    if (PMM.drag_select_enabled) {
        PMM.dragger = new DragSelect({
            selectables: document.querySelectorAll('.post-preview img'),
            area: PMM.$drag_area,
            draggability: false,
            immediateDrag: false,
        });
    }
    Danbooru.max_write_requests = PMM.maximum_concurrent_requests;
    Load.setProgramGetter(PMM, 'VTI', 'ValidateTagInput', 29.13);
    Load.setProgramGetter(PMM, 'IAC', 'IndexedAutocomplete', 29.25);
    Load.setProgramGetter(PMM, 'DPI', 'DisplayPostInfo');
    return true;
}

function RenderSettingsMenu() {
    $('#post-mode-menu').append(Menu.renderMenuFramework(MENU_CONFIG));
    $('#pmm-general-settings').append(Menu.renderDomainSelectors());
    $('#pmm-mode-settings-message').append(Menu.renderExpandable("Additional setting details", MODE_SETTINGS_DETAILS));
    $('#pmm-mode-settings').append(Menu.renderInputSelectors('available_modes', 'checkbox'));
    $('#pmm-mode-settings').append(Menu.renderSortlist('mode_order'));
    $('#pmm-option-settings').append(Menu.renderCheckbox('edit_tag_grouping_enabled'));
    $('#pmm-option-settings').append(Menu.renderCheckbox('safe_tag_script_enabled'));
    $('#pmm-option-settings').append(Menu.renderCheckbox('autoload_post_commentary_enabled'));
    $('#pmm-option-settings').append(Menu.renderInputSelectors('id_separator', 'radio'));
    $("#pmm-network-settings").append(Menu.renderTextinput('maximum_concurrent_requests', 10));
    $('#pmm-network-settings').append(Menu.renderCheckbox('highlight_errors_enabled'));
    $('#pmm-select-settings').append(Menu.renderCheckbox('drag_select_enabled'));
    $('#pmm-interface-settings').append(Menu.renderCheckbox('long_searchbar_enabled'));
    $('#pmm-interface-settings').append(Menu.renderCheckbox('long_tagscript_enabled'));
    Menu.engageUI({checkboxradio: true, sortable: true});
    Menu.saveUserSettingsClick();
    Menu.resetUserSettingsClick();
    Menu.expandableClick();
}

//Main function

function Main() {
    Load.preloadScript({
        broadcast_func: BroadcastPMM,
        program_css: PROGRAM_CSS,
        light_css: LIGHT_MODE_CSS,
        dark_css: DARK_MODE_CSS,
    });
    Menu.preloadMenu({
        menu_func: RenderSettingsMenu,
        menu_css: MENU_CSS,
    });
    if (!Load.isScriptEnabled() || Menu.isSettingsMenu() || !InitializeProgramValues()) return;
    InitializeModeMenu();
    if (PMM.long_searchbar_enabled) {
        Utility.setCSSStyle(SEARCHBAR_CSS, 'searchbar');
    }
    if (PMM.highlight_errors_enabled) {
        Danbooru.initializeHighlights();
    }
    if (PMM.drag_select_enabled) {
        PMM.dragger.subscribe('callback', DragSelectCallback);
    }
    if (PMM.available_mode_keys.has('edit')) {
        $('#quick-edit-div').remove();
    }
    localStorage.removeItem('mode');
    UnbindEventHandlers();
}

/****Initialization****/

//Variables for JSPLib
JSPLib.data = PMM;
JSPLib.name = PROGRAM_NAME;
JSPLib.shortcut = PROGRAM_SHORTCUT;
JSPLib.default_data = DEFAULT_VALUES;
JSPLib.settings_config = SETTINGS_CONFIG;

//Variables for debug.js
Debug.mode = false;
Debug.level = Debug.INFO;

//Export JSPLib
Load.exportData();

/****Execution start****/

Load.programInitialize(Main, {required_variables: PROGRAM_LOAD_REQUIRED_VARIABLES, optional_selectors: PROGRAM_LOAD_OPTIONAL_SELECTORS});

})(JSPLib);
