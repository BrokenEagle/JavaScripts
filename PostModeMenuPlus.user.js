// ==UserScript==
// @name         PostModeMenu+
// @namespace    https://github.com/BrokenEagle
// @version      8.9
// @description  Provide additional functions on the post mode menu.
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        *://*.donmai.us/
// @match        *://*.donmai.us/posts*
// @match        *://*.donmai.us/settings
// @exclude      /^https?://\w+\.donmai\.us/posts/\d+(\?|$)/
// @exclude      /^https?://\w+\.donmai\.us/.*\.(xml|json|atom)(\?|$)/
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/PostModeMenuPlus.user.js
// @updateURL    https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/PostModeMenuPlus.user.js
// @require      https://cdn.jsdelivr.net/npm/dragselect@2.3.1/dist/ds.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/module.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/notice.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251105/lib/menu.js
// ==/UserScript==

/* global $ Danbooru JSPLib DragSelect */

/****Library updates****/

JSPLib.utility.renderColorScheme = function (css_text, mode) {
    let lines = css_text.trim().split('\n');
    let theme_lines = [];
    let auto_lines = [];
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (/^[ /}]/.test(line)) {
            theme_lines.push(line);
            auto_lines.push('    ' + line);
        } else {
            theme_lines.push(`body[data-current-user-theme=${mode}] ${line}`);
            auto_lines.push(`    body[data-current-user-theme=auto] ${line}`);
        }
    }
    let theme_css = theme_lines.join('\n');
    let auto_css = `@media (prefers-color-scheme: ${mode}) {\n${auto_lines.join('\n')}\n}`;
    return '\n' + theme_css + '\n' + auto_css;
};

JSPLib.utility.isHash = function (value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
};

JSPLib.utility.isNamespaceBound = function (root, eventtype, namespace, selector) {
    let event_namespaces = this.getBoundEventNames(root, eventtype, selector);
    let name_parts = namespace.split('.');
    return event_namespaces.some((name) => this.isSubArray(name.split('.'), name_parts));
};

JSPLib.danbooru.networkSetup = async function () {
    this.pending_update_count += 1;
    this.showPendingUpdateNotice();
    if (this.num_network_requests >= this.max_network_requests) {
        await JSPLib.network.rateLimit('danbooru');
    }
    this.num_network_requests += 1;
};

JSPLib.danbooru.alwaysCallback = function () {
    const context = this;
    return function (_data, _message, resp) {
        context.pending_update_count -= 1;
        context.num_network_requests -= 1;
        context.checkAPIRateLimit(resp);
    };
};

JSPLib.danbooru.successCallback = function (post_id, func) {
    const context = this;
    return function (data) {
        if (typeof func === 'function') {
            func(data);
        }
        context.showPendingUpdateNotice();
        context.highlightPost(post_id, false);
        return true;
    };
};

JSPLib.danbooru.errorCallback = function (post_id, func_name, params) {
    const context = this;
    return function (error) {
        error = context.processError(error, func_name);
        let error_key = `${func_name}-${post_id}`;
        if (params) {
            error_key += '-' + JSPLib._jQuery.param(params);
        }
        context.logError(error_key, error);
        context.notifyError(error);
        context.highlightPost(post_id, true);
        return false;
    };
};

JSPLib.danbooru.updatePost = async function (post_id, params) {
    if (!JSPLib.utility.isHash(params?.post)) return;
    await this.networkSetup();
    return JSPLib.network.put(`/posts/${post_id}.json`, {data: {...params}})
        .always(this.alwaysCallback())
        .then(
            this.successCallback(post_id, (data) => {
                console.log("postUpdate-successCallback", this);
                let $post_article = JSPLib._jQuery(`#post_${data.id}`);
                $post_article.attr('data-tags', data.tag_string);
                $post_article.attr('data-rating', data.rating);
                $post_article.attr('data-score', data.score);
                $post_article.data({tags: data.tag_string, rating: data.rating, score: data.score});
                if (data.has_children) {
                    $post_article.addClass('post-status-has-children');
                } else {
                    $post_article.removeClass('post-status-has-children');
                }
                if (data.parent_id !== null) {
                    $post_article.addClass('post-status-has-parent');
                } else {
                    $post_article.removeClass('post-status-has-parent');
                }
                let $img = $post_article.find('img');
                let title = `${data.tag_string} rating:${data.rating} score:${data.score}`;
                if ($img.attr('title')) {
                    $img.attr('title', title);
                } else if ($img.data('title')) {
                    $img.data('title', title);
                }
                let $post_votes = $post_article.find('.post-votes');
                if ($post_votes.length) {
                    $post_votes.find('.post-score a').text(data.score);
                    if (params.post.tag_string?.match(/upvote:self|downvote:self/)) {
                        //`this` will not be JSPlib.danbooru, so the full name must be specified
                        this.submitRequest('post_votes', {search: {post_id: data.id, user_id: JSPLib._Danbooru.CurrentUser.data('id')}, limit: 1})
                            .then((post_votes) => {
                                $post_votes.find('.active-link').toggleClass('active-link inactive-link');
                                if (post_votes.length) {
                                    let vote_selector = (post_votes[0].score > 0 ? '.post-upvote-link' : '.post-downvote-link');
                                    $post_votes.find(vote_selector).toggleClass('active-link inactive-link');
                                }
                            });
                    }
                }
            }),
            this.errorCallback(post_id, 'updatePost', params)
        );
};

JSPLib.load.setProgramGetter = function (program_value, other_program_key, other_program_name, min_version) {
    Object.defineProperty(program_value, other_program_key, { get() {return JSPLib.load.getExport(other_program_name) ?? {};}});
    Object.defineProperty(program_value, 'has_' + other_program_key, { get() {return Object.keys(program_value[other_program_key]).length > 0;}});
    Object.defineProperty(program_value, other_program_key + '_version', { get() {return Number(JSPLib._window_jsp.program[other_program_name].version);}});
    Object.defineProperty(program_value, 'use_' + other_program_key, { get() {return program_value['has_' + other_program_key] && program_value[other_program_key + '_version'] >= min_version;}});
};

/****Global variables****/

//Exterior script variables
const DANBOORU_TOPIC_ID = '21812';

//Variables for load.js
const PROGRAM_LOAD_REQUIRED_VARIABLES = ['window.jQuery', 'window.Danbooru', 'Danbooru.Utility', 'Danbooru.CurrentUser', 'Danbooru.Autocomplete'];
const PROGRAM_LOAD_OPTIONAL_SELECTORS = ['#c-posts #a-index #mode-box', '#c-users #a-edit'];

//Program name constants
const PROGRAM_NAME = 'PostModeMenu';
const PROGRAM_SHORTCUT = 'pmm';
const PROGRAM_CLICK = 'click.pmm';
const PROGRAM_CHANGE = 'change.pmm';

//Program variable
const PMM = {};

//Available setting values
const SUPPORTED_MODES = ['edit', 'tag_script', 'commentary', 'copy_ID', 'copy_short', 'copy_link', 'vote_up', 'vote_down', 'unvote', 'favorite', 'unfavorite'];
const ID_SEPARATORS = ['comma', 'colon', 'semicolon', 'space', 'return'];

//Main settings
const SETTINGS_CONFIG = {
    available_modes: {
        allitems: SUPPORTED_MODES,
        reset: SUPPORTED_MODES,
        validate: (data) => JSPLib.menu.validateCheckboxRadio(data, 'checkbox', SUPPORTED_MODES),
        hint: "Select to enable script support/availability on selected modes."
    },
    mode_order: {
        allitems: SUPPORTED_MODES,
        reset: SUPPORTED_MODES,
        sortvalue: true,
        validate: (data) => JSPLib.utility.arrayEquals(data, SUPPORTED_MODES),
        hint: "Set the order for how actions appear in the mode menu. <b>Note:</b> <code>view</code> will still always be first."
    },
    maximum_concurrent_requests: {
        reset: 5,
        parse: parseInt,
        validate: (data) => (Number.isInteger(data) && data > 0),
        hint: "Determines how many requests will be sent at a time, while the remaining requests wait their turn."
    },
    id_separator: {
        display: "ID Separator",
        allitems: ID_SEPARATORS,
        reset: ['comma'],
        validate: (data) => JSPLib.menu.validateCheckboxRadio(data, 'radio', ID_SEPARATORS),
        hint: "Choose how to separate multiple post IDs copied with Copy ID, Copy Short, or Copy Link."
    },
    edit_tag_grouping_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Groups tags the same way as on the post's main page. (network: 1)"
    },
    commentary_relations_check_enabled: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Checks selected posts for parent/child or pool relationships, and loads the post ID if found. (network: 1 - 2)"
    },
    safe_tag_script_enabled: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Unsets the tag script mode when navigating to a new page."
    },
    long_searchbar_enabled: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Adds additional CSS which repositions the searchbar and has it span the entire screen."
    },
    long_tagscript_enabled: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Adds additional CSS which makes the tagscript bar span the entire screen when selected."
    },
    highlight_errors_enabled: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Adds visualization to the specific posts when network errors occur."
    },
    drag_select_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
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

// Default values

const DEFAULT_VALUES = {
    init_timer: null,
    pinned: false,
    post_votes: {},
    post_favorites: new Set(),
};

// CSS constants

const PROGRAM_CSS = `
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
}
div#pmm-mode-controls h2 {
    text-align: right;
}
/**SELECT CONTROLS**/
div#pmm-select-controls {
    display: block;
    margin-left: 0.2em;
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
    gap: 2px;
}
div#pmm-selection-buttons button.pmm-select {
    font-size: 11px;
    width: 4em;
    padding: 2px;
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
    color: white;
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
    height: 20em;
}
#pmm-fetch-post input {
    width: 25%;
}
#pmm-commentary-dialog input[disabled],
#pmm-commentary-dialog button[disabled] {
    cursor: not-allowed;
}`;

const LIGHT_MODE_CSS = `
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
    color: var(--grey-4);
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
}`;

const DARK_MODE_CSS = `
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
    color: var(--grey-7);
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
}`;

const SEARCHBAR_CSS = `
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

// HTML constants

const MODE_CONTROLS_HTML = `
<section id="pmm-mode-box">
    <div id="pmm-mode-controls">
        <div>
            <h2>Mode</h2>
            <form action="/">
                <select name="mode">%s</select>
            </form>
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
        <input data-autocomplete="tag-edit" placeholder="Enter tag script" style="margin: 0.25em 0;" class="ui-autocomplete-input iac-autocomplete" autocomplete="off">
    </div>
    <div id="pmm-apply-all">
        <button>Apply</button>
    </div>
    <button id="pmm-undock" class="ui-button ui-corner-all ui-widget" title="pin">
        <span class="ui-button-icon ui-icon ui-icon-pin-w"></span>
    </button>
</section>
<section id="pmm-placeholder" style="display: none;">
</section>`;

const EDIT_DIALOG_HTML = `
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

const COMMENTARY_DIALOG_HTML = `
<div id="pmm-commentary-dialog">
    <div id="pmm-fetch-post">
        <label>Load from post #</label>
        <input type="text" title="Enter a post ID">
        <button>Fetch</button>
    </div>
    <div class="pmm-commentary-input">
        <label for="pmm-artist-commentary-original-title">Original title</label>
        <input id="pmm-artist-commentary-original-title" name="original_title" type="text">
    </div>
    <div class="pmm-commentary-input">
        <label for="pmm-artist-commentary-original-description">Original description</label>
        <textarea id="pmm-artist-commentary-original-description" name="original_description"></textarea>
    </div>
    <div class="pmm-commentary-input">
        <label class="string optional" for="pmm-artist-commentary-translated-title">Translated title</label>
        <input id="pmm-artist-commentary-translated-title" name="translated_title" type="text">
    </div>
    <div class="pmm-commentary-input">
        <label class="text optional" for="pmm-artist-commentary-translated-description">Translated description</label>
        <textarea name="translated_description" id="pmm-artist-commentary-translated-description"></textarea>
    </div>
</div>`;

const MODE_SETTINGS_DETAILS = `
<ul>
    <li><b>Copy ID:</b> Copies just the post ID.</li>
    <li><b>Copy short:</b> Copies the short link for posts, e.g. <code>post #1234</code>.</li>
    <li><b>Copy link:</b> Copies the full post URL.</li>
</ul>`;

// Other constants

const EDIT_DIALOG_SETTINGS = {
    title: "Post Edit",
    classes: {
        'ui-dialog': 'pmm-dialog',
    },
    autoOpen: false,
    width: 1000,
};

const SEPARATOR_DICT = {
    comma: ',',
    colon: ':',
    semicolon: ';',
    space: ' ',
    return: '\n',
};

const POST_VOTE_FIELDS = 'id,post_id';

/****Functions****/

// Helper functions

function GetCurrentScriptID() {
    return JSPLib.storage.getLocalData('current_tag_script_id', {default_val: 1});
}

function GetCurrentTagScript() {
    return localStorage.getItem("tag-script-" + GetCurrentScriptID());
}

function CopyToClipboard(post_ids, prefix, suffix, separator, afterspace) {
    if (afterspace && !['\n', ' '].includes(separator)) {
        separator += " ";
    }
    let post_string = JSPLib.utility.joinList(post_ids, prefix, suffix, separator);
    Danbooru.Utility.copyToClipboard(post_string);
}

function CoordinateInBox(coord, box) {
    return coord.x > box.left && coord.x < box.right && coord.y > box.top && coord.y < box.bottom;
}

async function ParentPostCheck(post_ids) {
    let parent_id = null;
    let child_ids = [];
    for (let i = 0; i < post_ids.length; i++) {
        let $post = $(`#post_${post_ids[i]}`);
        if ($post.hasClass('post-status-has-children')) {
            //Can include at most one parent into the selection
            if (parent_id !== null) {
                return null;
            }
            parent_id = post_ids[i];
        } else if ($post.hasClass('post-status-has-parent')) {
            child_ids.push(post_ids[i]);
        } else {
            //Early bail when post has no parent or children
            return null;
        }
    }
    let posts = await JSPLib.danbooru.submitRequest('posts', {tags: `id:${child_ids.join(',')} status:any`, limit: child_ids.length, only: 'id,parent_id'});
    let parent_ids = JSPLib.utility.getObjectAttributes(posts, 'parent_id');
    //Must have only a single parent
    if (JSPLib.utility.arrayUnique(parent_ids).length !== 1) {
        return null;
    }
    //If the parent was included, it must match the children
    if (parent_id !== null && parent_id !== parent_ids[0]) {
        return null;
    }
    return parent_ids[0];
}

async function PoolPostCheck(post_ids) {
    let pools = await JSPLib.danbooru.submitRequest('pools', {search: {post_ids_include_all: post_ids.join(' '), category: 'series'}, only: 'id,post_ids'});
    if (pools.length !== 1) {
        return null;
    }
    return pools[0].post_ids[0];
}

async function RelationshipCheck(post_ids) {
    let parent_id = await ParentPostCheck(post_ids);
    if (parent_id !== null) {
        return parent_id;
    }
    let first_post_id = await PoolPostCheck(post_ids);
    return first_post_id;
}

async function NetworkSetup() {
    JSPLib.danbooru.pending_update_count += 1;
    JSPLib.danbooru.showPendingUpdateNotice();
    if (JSPLib.danbooru.num_network_requests >= JSPLib.danbooru.max_network_requests) {
        await JSPLib.network.rateLimit('danbooru');
    }
    JSPLib.danbooru.num_network_requests += 1;
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

// Update functions

function UpdatePostPreview(post_id, score, {score_change = null, post_score = null} = {}) {
    let $post_article = $(`#post_${post_id}`);
    let $score_link = $post_article.find('.post-score a');
    if ($score_link.length) {
        if (!post_score) {
            let current_score = Number($score_link.text());
            post_score = current_score + score_change;
        }
        $score_link.text(post_score);
        var vote_selector;
        if (score !== 0) {
            vote_selector = (score > 0 ? '.post-upvote-link' : '.post-downvote-link');
        } else {
            vote_selector = '.active-link';
        }
        $post_article.find(vote_selector).toggleClass('active-link inactive-link');
    }
}

function UpdateDraggerStatus() {
    if (PMM.available_mode_keys.has(PMM.mode) && PMM.dragger.stopped) {
        PMM.dragger.start();
    } else if (!PMM.available_mode_keys.has(PMM.mode) && !PMM.dragger.stopped) {
        PMM.dragger.stop();
    }
}

function UpdateSelectControls() {
    if (PMM.mode === 'tag-script') {
        $('#pmm-tag-script-field').show();
    } else {
        $('#pmm-tag-script-field').hide();
    }
    if (['edit', 'view'].includes(PMM.mode)) {
        $('#pmm-select-only input, #pmm-selection-buttons button, #pmm-apply-all button').attr('disabled', 'disabled');
        $('#pmm-select-only-input label').addClass('pmm-disabled');
    } else {
        $('#pmm-select-only input, #pmm-selection-buttons button, #pmm-apply-all button').attr('disabled', null);
        $('#pmm-select-only-input label').removeClass('pmm-disabled');
        if (!PMM.select_only) {
            $('#pmm-selection-buttons button, #pmm-apply-all button').attr('disabled', 'disabled');
        }
    }
}

//Render functions

function RenderPostModeMenu() {
    let selection_options = RenderPostModeMenuAddons();
    return JSPLib.utility.sprintf(MODE_CONTROLS_HTML, selection_options);
}

function RenderPostModeMenuAddons() {
    let html = '<option value="view">View</option>';
    PMM.mode_order.forEach((mode) => {
        let key = JSPLib.utility.kebabCase(mode);
        let name = JSPLib.utility.displayCase(mode).replace(' id', ' ID');
        html += `<option value="${key}">${name}</option>`;
    });
    return html;
}

//Initialize functions

function InitializeModeMenu() {
    $('#mode-box').replaceWith(RenderPostModeMenu());
    $('#pmm-mode-box select').on(PROGRAM_CHANGE, ChangeModeMenu);
    $('#pmm-select-only').on(PROGRAM_CHANGE, ChangeSelectOnly);
    $('.pmm-select').on(PROGRAM_CLICK, BatchSelection);
    $('#pmm-apply-all button').on(PROGRAM_CLICK, BatchApply);
    $('#pmm-undock').on(PROGRAM_CLICK, UndockModeMenu);
    $('.post-preview a.post-preview-link').on(PROGRAM_CLICK, PostModeMenu);
    $('#pmm-tag-script-field input').on('blur.pmm', SaveTagScript);
    $(document).on('keydown.pmm.change_tag_script', null, "0 1 2 3 4 5 6 7 8 9", ChangeTagScript);
    $("#pmm-mode-controls select").val(PMM.mode);
    $("#pmm-select-only").prop('checked', PMM.select_only);
    $('#pmm-tag-script-field input').val(GetCurrentTagScript());
    UpdateSelectControls();
    if (PMM.long_tagscript_enabled) {
        $('#pmm-tag-script-field input').addClass('pmm-long-focus');
    }
}

function OpenEditDialog(post_ids) {
    if (post_ids.length !== 1) return;
    let post_id = post_ids[0];
    if (!OpenEditDialog.dialog) {
        let $edit_dialog = $(EDIT_DIALOG_HTML);
        let buttons = {Submit: SubmitEditDialog};
        if (PMM.use_VTI) {
            buttons.Validate = ValidateEditDialog;
        }
        buttons.Cancel = CloseDialog;
        $edit_dialog.dialog(Object.assign({buttons, close: CloseEditDialog}, EDIT_DIALOG_SETTINGS));
        if (PMM.use_IAC) {
            let $textarea = $edit_dialog.find('#pmm-tag-string textarea');
            PMM.IAC.InitializeTagQueryAutocompleteIndexed($textarea, null);
        } else {
            $('#pmm-tag-string textarea').autocomplete({
                select (_event, ui) {
                    Danbooru.Autocomplete.insert_completion(this, ui.item.value);
                    return false;
                },
                async source(_req, resp) {
                    let term = Danbooru.Autocomplete.current_term(this.element);
                    let results = await Danbooru.Autocomplete.autocomplete_source(term, "tag_query");
                    resp(results);
                },
            });
        }
        $edit_dialog.closest('.pmm-dialog').find('.ui-button').each((_, entry) => {
            let button_id = 'pmm-edit-' + entry.innerText.toLowerCase();
            $(entry).attr('id', button_id);
        });
        OpenEditDialog.dialog = $edit_dialog;
        PMM.edit_dialog_open = true;
    }
    let $edit_dialog = OpenEditDialog.dialog;
    let tag_string = $(`#post_${post_id}`).data('tags');
    if (PMM.edit_tag_grouping_enabled) {
        let $text_area = $edit_dialog.find('#pmm-tag-string textarea');
        $text_area.val('loading...');
        $text_area.attr('disabled', 'disabled');
        JSPLib.danbooru.submitRequest('posts/' + post_id, {only: 'tag_string_artist,tag_string_copyright,tag_string_character,tag_string_meta,tag_string_general'}).then((data) => {
            let grouped_tag_string = "";
            ['artist', 'copyright', 'character', 'meta', 'general'].forEach((type) => {
                let type_tag_string = data['tag_string_' + type];
                if (type_tag_string.length) {
                    grouped_tag_string += type_tag_string + '\n';
                }
            });
            $text_area.val(grouped_tag_string.trim() + " ");
            $text_area.attr('disabled', null);
        });
    } else {
        $edit_dialog.find('#pmm-tag-string textarea').val(tag_string + ' ');
    }
    if (PMM.use_VTI) {
        PMM.VTI.preedit_tags = tag_string.split(' ');
        PMM.VTI.PreloadImplications();
    }
    $('.pmm-editing').removeClass('pmm-editing');
    $(`#post_${post_id}`).addClass('pmm-editing');
    $edit_dialog.dialog('open');
    PMM.edit_post_id = post_id;
}

function OpenCommentaryDialog(post_ids) {
    if (!OpenCommentaryDialog.dialog) {
        let $commentary_dialog = $(COMMENTARY_DIALOG_HTML);
        $commentary_dialog.dialog({
            title: 'Copy Commentaries',
            classes: {
                'ui-dialog': 'pmm-dialog',
            },
            autoOpen: false,
            modal: true,
            width: 700,
            buttons: {
                Submit: SubmitCommentary,
                Cancel: CloseDialog,
            }
        });
        $commentary_dialog.find('#pmm-fetch-post button').on(PROGRAM_CLICK, FetchCommentary);
        OpenCommentaryDialog.dialog = $commentary_dialog;
    }
    let $commentary_dialog = OpenCommentaryDialog.dialog;
    $commentary_dialog.find('input, textarea').val("");
    let $fetch_input = $commentary_dialog.find('#pmm-fetch-post input');
    if (post_ids.length === 1) {
        $fetch_input.val(post_ids[0]);
    } else if (PMM.commentary_relations_check_enabled) {
        let $fetch_button = $commentary_dialog.find('#pmm-fetch-post button');
        $fetch_input.attr('disabled', 'disabled');
        $fetch_button.attr('disabled', 'disabled');
        RelationshipCheck(post_ids).then((post_id) => {
            if (post_id !== null) {
                $fetch_input.val(post_id);
            } else {
                $fetch_input.val("");
            }
            $fetch_input.attr('disabled', null);
            $fetch_button.attr('disabled', null);
        });
        $fetch_input.val("loading...");
    }
    $commentary_dialog.dialog('open');
    PMM.commentary_post_ids = post_ids;
}

function UnbindDanbooruHandlers() {
    JSPLib.utility.recheckTimer({
        check: () => !JSPLib.utility.isNamespaceBound(document, 'keydown', 'danbooru.change_tag_script', {ordered: false}),
        exec: () => {
            $(document).off('keydown.danbooru.change_tag_script');
            $(document).off('click.danbooru', '.post-preview-container a');
        },
    }, 100, JSPLib.utility.one_second * 5);
}

//Network functions

async function VotePost(post_id, score) {
    if (PMM.post_votes[post_id]?.score === score) return true;
    await NetworkSetup();
    return JSPLib.network.post(`/posts/${post_id}/votes.json?score=${score}`)
        .always(JSPLib.danbooru.alwaysCallback())
        .then(
            JSPLib.danbooru.successCallback(post_id, (data) => {
                let score_change = score - (PMM.post_votes[post_id]?.score ?? 0);
                UpdatePostPreview(post_id, score, {score_change});
                PMM.post_votes[post_id] = {id: data.id, score};
            }),
            JSPLib.danbooru.errorCallback(post_id, 'VotePost', {score})
        );
}

async function UnvotePost(post_id) {
    await PMM.post_vote_promise;
    if (!(post_id in PMM.post_votes)) return true;
    let vote_id = PMM.post_votes[post_id].id;
    await NetworkSetup();
    // eslint-disable-next-line dot-notation
    return JSPLib.network.delete(`/post_votes/${vote_id}.json`)
        .always(JSPLib.danbooru.alwaysCallback())
        .then(
            JSPLib.danbooru.successCallback(post_id, () => {
                let score_change = -PMM.post_votes[post_id].score;
                UpdatePostPreview(post_id, 0, {score_change});
                delete PMM.post_votes[post_id];
            }),
            JSPLib.danbooru.errorCallback(post_id, 'UnvotePost')
        );
}

async function FavoritePost(post_id) {
    if (PMM.post_favorites.has(post_id)) return true;
    await NetworkSetup();
    return JSPLib.network.post(`/favorites.json?post_id=${post_id}`)
        .always(JSPLib.danbooru.alwaysCallback())
        .then(
            JSPLib.danbooru.successCallback(post_id, (data) => {
                UpdatePostPreview(post_id, 1, {post_score: data.score});
                PMM.post_favorites.add(post_id);
            }),
            JSPLib.danbooru.errorCallback(post_id, 'FavoritePost')
        );
}

async function UnfavoritePost(post_id) {
    await PMM.post_favorite_promise;
    if (!PMM.post_favorites.has(post_id)) return true;
    await NetworkSetup();
    // eslint-disable-next-line dot-notation
    JSPLib.network.delete(`/favorites/${post_id}.json`)
        .always(JSPLib.danbooru.alwaysCallback())
        .then(
            JSPLib.danbooru.successCallback(post_id, () => {
                UpdatePostPreview(post_id, 0, {score_change: -1});
                // eslint-disable-next-line dot-notation
                PMM.post_favorites.delete(post_id);
            }),
            JSPLib.danbooru.errorCallback(post_id, 'UnfavoritePost')
        );
}

async function UpdatePostCommentary(post_id, artist_commentary) {
    await NetworkSetup();
    return JSPLib.network.put(`/posts/${post_id}/artist_commentary/create_or_update.json`, {data: {artist_commentary}})
        .always(JSPLib.danbooru.alwaysCallback())
        .then(
            JSPLib.danbooru.successCallback(post_id),
            JSPLib.danbooru.errorCallback(post_id, 'UpdatePostCommentary', artist_commentary)
        );
}

function TagscriptPost(post_id) {
    let tag_script = $('#pmm-tag-script-field input').val().trim();
    if (tag_script) {
        let params = {post: {old_tag_string: "", tag_string: tag_script}};
        JSPLib.danbooru.updatePost(post_id, params);
    } else {
        JSPLib.notice.error('No tag script set!');
    }
}

async function PreloadPostVotes(post_ids) {
    let p = JSPLib.utility.createPromise();
    PMM.post_vote_promise = p.promise;
    let post_votes = await JSPLib.danbooru.submitRequest('post_votes', {search: {post_id: post_ids.join(','), user_id: Danbooru.CurrentUser.data('id')}, limit: post_ids.length, only: POST_VOTE_FIELDS});
    post_votes.forEach((vote) => {
        PMM.post_votes[vote.post_id] = {id: vote.id, score: vote.score};
    });
    p.resolve(null);
}

async function PreloadPostFavorites(post_ids) {
    let p = JSPLib.utility.createPromise();
    PMM.post_favorite_promise = p.promise;
    let query_ids = post_ids.filter((post_id) => !PMM.post_favorites.has(post_id));
    if (query_ids.length) {
        let post_favorites = await JSPLib.danbooru.submitRequest('favorites', {search: {post_id: post_ids.join(','), user_id: Danbooru.CurrentUser.data('id')}, limit: post_ids.length, only: POST_VOTE_FIELDS});
        let favorite_post_ids = JSPLib.utility.getObjectAttributes(post_favorites, 'post_id');
        PMM.post_favorites = JSPLib.utility.setUnion(PMM.post_favorites, JSPLib.utility.arrayToSet(favorite_post_ids));
    }
    p.resolve(null);
}

//Event handlers

function PostModeMenu(event) {
    if (PMM.available_mode_keys.has(PMM.mode)) {
        let $article = $(event.currentTarget).closest("article");
        let post_id = $article.data("id");
        if (PMM.select_only && PMM.mode !== 'edit') {
            $article.toggleClass('pmm-selected');
        } else {
            $article.addClass('pmm-selected');
            MenuFunctions([post_id]);
        }
        event.preventDefault();
        event.stopImmediatePropagation();
    }
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
    let post_ids = JSPLib.utility.getDOMAttributes($selected_posts, 'id', Number);
    MenuFunctions(post_ids);
}

function ChangeModeMenu() {
    PMM.mode = $("#pmm-mode-box select").val();
    JSPLib.storage.setLocalData('pmm-mode', PMM.mode);
    UpdateSelectControls();
    $('.pmm-selected').removeClass('pmm-selected');
    if (PMM.drag_select_enabled) {
        UpdateDraggerStatus();
    }
    PMM.channel.postMessage({type: 'change_mode', mode: PMM.mode});
}

function ChangeSelectOnly(event) {
    PMM.select_only = event.currentTarget.checked;
    JSPLib.storage.setLocalData('pmm-select-only', PMM.select_only);
    UpdateSelectControls();
    $('.pmm-selected').removeClass('pmm-selected');
    PMM.channel.postMessage({type: 'change_select_only', select_only: PMM.select_only});
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
        $("#pmm-tag-script-field input").val(GetCurrentTagScript());
        let current_script_id = GetCurrentScriptID();
        let change_script_id = Number(event.key);
        if (current_script_id !== change_script_id) {
            JSPLib.storage.setLocalData('current_tag_script_id', change_script_id);
            JSPLib.notice.notice(`Switched to tag script #${event.key}. To switch tag scripts, use the number keys.`);
        }
        event.preventDefault();
    }
}

function UndockModeMenu() {
    let $mode_box = $('#pmm-mode-box');
    let $placeholder = $('#pmm-placeholder');
    let {height, width} = getComputedStyle($mode_box.get(0));
    if (PMM.pinned) {
        $mode_box.css({top: "", left: "", width: "", position: 'relative'});
        $placeholder.hide();
        PMM.pinned = false;
    } else {
        let {top, left} = $mode_box.get(0).getBoundingClientRect();
        $mode_box.css({top, left, width, position: 'fixed'});
        $placeholder.show();
        PMM.pinned = true;
    }
    $('#pmm-placeholder').css('height', height);
    $('#pmm-undock span').toggleClass('ui-icon-pin-w ui-icon-pin-s');
}

function SubmitEditDialog(event) {
    if (AreTagsEdited()) {
        $('#pmm-edit-submit, #pmm-edit-validate').attr('disabled', 'disabled');
        ValidateTags().then((status) => {
            if (status) {
                let tag_string = $('#pmm-tag-string textarea').val();
                let old_tag_string = $(`#post_${PMM.edit_post_id}`).data('tags');
                JSPLib.danbooru.updatePost(PMM.edit_post_id, {post: {old_tag_string, tag_string}});
                CloseDialog(event);
            } else {
                JSPLib.notice.error("Tag validation failed!");
            }
            $('#pmm-edit-submit, #pmm-edit-validate').attr('disabled', null);
        });
    } else {
        CloseDialog(event);
    }
}

function ValidateEditDialog() {
    if (AreTagsEdited()) {
        $('#pmm-edit-submit, #pmm-edit-validate').attr('disabled', 'disabled');
        ValidateTags().then((status) => {
            if (status) {
                JSPLib.notice.notice("Tags good to submit!");
            } else {
                JSPLib.notice.error("Tag validation failed!");
            }
            $('#pmm-edit-submit, #pmm-edit-validate').attr('disabled', null);
        });
    } else {
        $("#warning-new-tags, #warning-bad-removes, #warning-deprecated-tags").hide();
        JSPLib.notice.notice("Tags good to submit!");
    }
}

function CloseEditDialog() {
    $(`#post_${PMM.edit_post_id}`).removeClass('pmm-editing');
    $("#validation-input, #warning-new-tags, #warning-bad-removes, #warning-deprecated-tags").hide();
}

function FetchCommentary(event) {
    let $button = $(event.target);
    let $commentary_dialog = $button.closest('.ui-dialog-content');
    let post_id = Number($commentary_dialog.find('#pmm-fetch-post input').val());
    if (JSPLib.validate.validateID(post_id)) {
        $button.attr('disabled', 'disabled');
        JSPLib.danbooru.submitRequest(`posts/${post_id}/artist_commentary`).then((artist_commentary) => {
            ['original_title', 'original_description', 'translated_title', 'translated_description'].forEach((field) => {
                $commentary_dialog.find(`[name="${field}"]`).val(artist_commentary[field]);
            });
            $button.attr('disabled', null);
        });
    } else {
        JSPLib.notice.error("Must enter a valid post ID.");
    }
}

function SubmitCommentary(event) {
    let post_ids = PMM.commentary_post_ids;
    let artist_commentary = {};
    $('.pmm-commentary-input input, .pmm-commentary-input textarea').each((_, input) => {
        artist_commentary[input.name] = input.value;
    });
    let promise_array = post_ids.map((post_id) => UpdatePostCommentary(post_id, artist_commentary));
    Promise.all(promise_array).then((responses) => {
        if (responses.every(Boolean)) {
            JSPLib.notice.notice("All posts updated.");
        } else {
            let successes = responses.reduce((acc, val) => acc + Number(val), 0);
            let failures = responses.length - successes;
            JSPLib.notice.error(`Error updating posts:<br><ul><li>successes: ${successes}</li><li>failures: ${failures}</li></ul>`);
        }
    });
    CloseDialog(event);
}

function CloseDialog(event) {
    let $dialog = $(event.target).closest('.ui-dialog').find('.ui-dialog-content');
    $dialog.dialog('close');
}

function DragSelectCallback({items, event}) {
    // Only process drag select events when the primary (left) and only the primary mouse button is used.
    if (!PMM.available_mode_keys.has(PMM.mode) || (event.button !== 0 && event.buttons !== 0)) return;
    JSPLib.debug.debuglog('DragSelectCallback', items, event);
    let click_coords = PMM.dragger.getInitialCursorPositionArea();
    let mouseup_coords = PMM.dragger.getCurrentCursorPositionArea();
    if (mouseup_coords.x === click_coords.x && mouseup_coords.y === click_coords.y) {
        JSPLib.debug.debuglog("Drag callback: click.");
        return;
    }
    if (items.length === 1) {
        let area_coords = JSPLib.utility.getElemPosition(PMM.$drag_area);
        let page_click_coords = {x: click_coords.x + area_coords.left, y: click_coords.y + area_coords.top};
        let page_mouseup_coords = {x: mouseup_coords.x + area_coords.left, y: mouseup_coords.y + area_coords.top};
        let box = JSPLib.utility.getElemPosition(items[0]);
        box.bottom = box.top + items[0].offsetHeight;
        box.right = box.left + items[0].offsetWidth;
        JSPLib.debug.debuglog('DragSelectCallback', page_click_coords, page_mouseup_coords, box);
        if (CoordinateInBox(page_click_coords, box) && CoordinateInBox(page_mouseup_coords, box)) {
            JSPLib.debug.debuglog("Drag callback: click-in-element.");
            return;
        }
    }
    let articles = items.map((entry) => $(entry).closest('article').get(0));
    let post_ids = articles.map((entry) => $(entry).data('id'));
    JSPLib.debug.debuglog('Drag Select IDs', post_ids);
    if (PMM.select_only) {
        $(articles).toggleClass('pmm-selected');
    } else {
        $(articles).addClass('pmm-selected');
        MenuFunctions(post_ids);
    }
    document.getSelection().removeAllRanges();
}

// Menu function

function MenuFunctions(post_ids) {
    if (PMM.mode === 'unvote') {
        PreloadPostVotes(post_ids);
    }
    if (PMM.mode === 'unfavorite') {
        PreloadPostFavorites(post_ids);
    }
    if (['edit', 'copy-id', 'copy-short', 'copy-link', 'commentary'].includes(PMM.mode)) {
        MenuFunctionsMulti(post_ids);
    } else {
        for (let i = 0; i < post_ids.length; i++) {
            MenuFunctionsSingle(post_ids[i]);
        }
    }
}

function MenuFunctionsSingle(post_id) {
    switch (PMM.mode) {
        case 'vote-up':
            VotePost(post_id, 1);
            break;
        case 'vote-down':
            VotePost(post_id, -1);
            break;
        case 'unvote':
            UnvotePost(post_id);
            break;
        case 'favorite':
            FavoritePost(post_id);
            break;
        case 'unfavorite':
            UnfavoritePost(post_id);
            break;
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
            OpenEditDialog(post_ids);
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
            OpenCommentaryDialog(post_ids);
            //falls through
        default:
            //do nothing
    }
}

//Settings functions

function BroadcastPMM(ev) {
    const printer = JSPLib.debug.getFunctionPrint('BroadcastPMM');
    printer.debuglog(`(${ev.data.type}):`, ev.data);
    switch (ev.data.type) {
        case 'change_mode':
            PMM.mode = ev.data.mode;
            $("#pmm-mode-controls select").val(PMM.mode);
            UpdateSelectControls();
            break;
        case 'change_select_only':
            PMM.select_only = ev.data.select_only;
            $('#pmm-select-only-input input').prop('checked', PMM.select_only);
            UpdateSelectControls();
            //falls through
        default:
            //do nothing
    }
}

function InitializeProgramValues() {
    Object.assign(PMM, {
        mode: JSPLib.storage.getLocalData('pmm-mode'),
        available_mode_keys: new Set(PMM.available_modes.map((mode) => JSPLib.utility.kebabCase(mode.toLocaleLowerCase()))),
        id_separator_char: SEPARATOR_DICT[PMM.id_separator[0]],
        select_only: JSPLib.storage.getLocalData('pmm-select-only', {default_val: false}),
        $drag_area: document.querySelector('#posts'),
        get use_VTI() {return PMM.has_VTI && PMM.VTI_version >= 29.13;},
        get use_IAC() {return PMM.has_IAC && PMM.IACS_version >= 29.25;},
    });
    if (PMM.safe_tag_script_enabled && PMM.mode === 'tag-script') {
        PMM.mode = 'view';
    }
    if (PMM.drag_select_enabled) {
        PMM.dragger = new DragSelect({
            selectables: document.querySelectorAll('.post-preview img'),
            area: PMM.$drag_area,
            draggability: false,
            immediateDrag: false
        });
    }
    JSPLib.danbooru.max_network_requests = PMM.maximum_concurrent_requests;
    JSPLib.danbooru.highlight_post_enabled = PMM.highlight_errors_enabled;
    JSPLib.load.setProgramGetter(PMM, 'VTI', 'ValidateTagInput', 29.13);
    JSPLib.load.setProgramGetter(PMM, 'IAC', 'IndexedAutocomplete', 29.25);
    return true;
}

function RenderSettingsMenu() {
    $('#post-mode-menu').append(JSPLib.menu.renderMenuFramework(MENU_CONFIG));
    $('#pmm-general-settings').append(JSPLib.menu.renderDomainSelectors());
    $('#pmm-mode-settings-message').append(JSPLib.menu.renderExpandable("Additional setting details", MODE_SETTINGS_DETAILS));
    $('#pmm-mode-settings').append(JSPLib.menu.renderInputSelectors('available_modes', 'checkbox'));
    $('#pmm-mode-settings').append(JSPLib.menu.renderSortlist('mode_order'));
    $('#pmm-option-settings').append(JSPLib.menu.renderCheckbox('edit_tag_grouping_enabled'));
    $('#pmm-option-settings').append(JSPLib.menu.renderCheckbox('safe_tag_script_enabled'));
    $('#pmm-option-settings').append(JSPLib.menu.renderCheckbox('commentary_relations_check_enabled'));
    $('#pmm-option-settings').append(JSPLib.menu.renderInputSelectors('id_separator', 'radio'));
    $("#pmm-network-settings").append(JSPLib.menu.renderTextinput('maximum_concurrent_requests', 10));
    $('#pmm-network-settings').append(JSPLib.menu.renderCheckbox('highlight_errors_enabled'));
    $('#pmm-select-settings').append(JSPLib.menu.renderCheckbox('drag_select_enabled'));
    $('#pmm-interface-settings').append(JSPLib.menu.renderCheckbox('long_searchbar_enabled'));
    $('#pmm-interface-settings').append(JSPLib.menu.renderCheckbox('long_tagscript_enabled'));
    JSPLib.menu.engageUI(true, true);
    JSPLib.menu.saveUserSettingsClick();
    JSPLib.menu.resetUserSettingsClick();
    JSPLib.menu.expandableClick();
}

//Main function

function Main() {
    let css_text = PROGRAM_CSS +
                   JSPLib.utility.renderColorScheme(LIGHT_MODE_CSS, 'light') +
                   JSPLib.utility.renderColorScheme(DARK_MODE_CSS, 'dark');
    const preload = {
        run_on_settings: false,
        default_data: DEFAULT_VALUES,
        initialize_func: InitializeProgramValues,
        broadcast_func: BroadcastPMM,
        render_menu_func: RenderSettingsMenu,
        program_css: css_text,
        menu_css: MENU_CSS,
    };
    if (!JSPLib.menu.preloadScript(PMM, preload)) return;
    InitializeModeMenu();
    if (PMM.long_searchbar_enabled) {
        JSPLib.utility.setCSSStyle(SEARCHBAR_CSS, 'searchbar');
    }
    if (PMM.highlight_errors_enabled) {
        JSPLib.utility.setCSSStyle(JSPLib.danbooru.highlight_css, 'highlight');
    }
    if (PMM.drag_select_enabled) {
        PMM.dragger.subscribe('callback', DragSelectCallback);
        UpdateDraggerStatus();
    }
    if (PMM.available_mode_keys.has('edit')) {
        $('#quick-edit-div').remove();
    }
    UnbindDanbooruHandlers();
}

/****Initialization****/

//Variables for debug.js
JSPLib.debug.debug_console = true;
JSPLib.debug.level = JSPLib.debug.INFO;
JSPLib.debug.program_shortcut = PROGRAM_SHORTCUT;

//Variables for menu.js
JSPLib.menu.program_shortcut = PROGRAM_SHORTCUT;
JSPLib.menu.program_name = PROGRAM_NAME;
JSPLib.menu.program_data = PMM;
JSPLib.menu.settings_config = SETTINGS_CONFIG;

//Export JSPLib
JSPLib.load.exportData(PROGRAM_NAME, PMM);

/****Execution start****/

JSPLib.load.programInitialize(Main, {program_name: PROGRAM_NAME, required_variables: PROGRAM_LOAD_REQUIRED_VARIABLES, optional_selectors: PROGRAM_LOAD_OPTIONAL_SELECTORS});
