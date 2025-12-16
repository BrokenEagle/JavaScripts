// ==UserScript==
// @name         PostModeMenu+
// @namespace    https://github.com/BrokenEagle
// @version      9.2
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

JSPLib.utility.recheckInterval = function ({check = null, exec = null, debug = null, fail = null, always = null, duration = null, interval = null} = {}) {
    let expires = Number.isInteger(duration) && this.getExpires(duration);
    var timeobj = {};
    var timer = null;
    timer = timeobj.timer = this.initializeInterval(() => {
        if (check?.()) {
            exec?.();
            timeobj.timer = true;
        } else if (!expires || this.validateExpires(expires)) {
            debug?.();
            return false;
        } else {
            fail?.();
            timeobj.timer = false;
        }
        always?.();
        if (Number.isInteger(timer)) {
            clearInterval(timer);
        }
        return true;
    }, interval);
    return timeobj;
};

JSPLib.utility.namespaceWaitExecute = function ({root = null, type = null, namespace = null, selector = null, found = null, interval = null, duration = null, presence = true} = {}) {
    let target = selector ?? root.nodeName ?? root;
    this.recheckInterval({
        check: () => this.not(this.isNamespaceBound(root, type, namespace, selector), !presence),
        debug: () => JSPLib.debug.debuglogLevel(`Event handler wait: ${type}.${namespace} for ${target}.`, JSPLib.debug.VERBOSE),
        fail: () => JSPLib.debug.debuglogLevel(`Event handler not found: ${type}.${namespace} for ${target}.`, JSPLib.debug.WARNING),
        exec: found,
        interval,
        duration,
    });
};

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

JSPLib.utility.setDataAttribute = function ($obj, key, value) {
    $obj.attr('data-' + key, value);
    $obj.data(key, value);
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

JSPLib.danbooru.successCallback = function (post_id, func_name, success) {
    const context = this;
    return function (data) {
        JSPLib.debug.debuglogLevel(`${func_name}-success:`, data, JSPLib.debug.INFO);
        if (typeof success === 'function') {
            success(data);
        }
        context.showPendingUpdateNotice();
        context.highlightPost(post_id, false);
        return true;
    };
};

JSPLib.danbooru.errorCallback = function (post_id, func_name, params) {
    const context = this;
    return function (error) {
        error = JSPLib.network.processError(error, func_name);
        let error_key = `${func_name}-${post_id}`;
        if (params) {
            error_key += '-' + JSPLib._jQuery.param(params);
        }
        JSPLib.network.logError(error_key, error);
        JSPLib.network.notifyError(error);
        context.highlightPost(post_id, true);
        return false;
    };
};

JSPLib.danbooru._updatePostVotes = function (params, post_data, $post_votes) {
    let fav_matches = JSPLib.utility.findAll(params.post.tag_string ?? "", /(?<=^| )-?fav:me(?= |$)/g);
    if (fav_matches.length) {
        let last_match = fav_matches.at(-1);
        if (last_match === 'fav:me' && $post_votes.find('.post-upvote-link.active-link').length === 0) {
            $post_votes.find('.post-score a').text(post_data.score + 1);
        } else if (last_match === '-fav:me' && $post_votes.find('.post-upvote-link.inactive-link').length === 0) {
            $post_votes.find('.post-score a').text(post_data.score - 1);
        } else {
            $post_votes.find('.post-score a').text(post_data.score);
        }
    } else {
        $post_votes.find('.post-score a').text(post_data.score);
    }
    if (/(?:^| )(?:upvote:self|downvote:self|-?fav:me)(?: |$)/.test(params.post.tag_string)) {
        this.submitRequest('post_votes', {search: {post_id: post_data.id, user_id: JSPLib._Danbooru.CurrentUser.data('id')}, limit: 1})
            .then((vote_data) => {
                $post_votes.find('.active-link').toggleClass('active-link inactive-link');
                if (vote_data.length) {
                    let vote_selector = (vote_data[0].score > 0 ? '.post-upvote-link' : '.post-downvote-link');
                    let $vote = $post_votes.find(vote_selector);
                    $vote.toggleClass('active-link inactive-link');
                    $vote.addClass('post-unvote-link');
                    JSPLib.utility.setDataAttribute($vote, 'method', 'delete');
                    $vote.attr('href', `/post_votes/${vote_data[0].id}`);
                }
            });
    }
};

JSPLib.danbooru.updatePost = async function (post_id, params) {
    if (!JSPLib.utility.isHash(params?.post)) return;
    await this.networkSetup();
    return JSPLib.network.put(`/posts/${post_id}.json`, {data: {...params}})
        .always(this.alwaysCallback())
        .then(
            this.successCallback(post_id, 'danbooru.updatePost', (post_data) => {
                let $post_article = JSPLib._jQuery(`#post_${post_data.id}`);
                JSPLib.utility.setDataAttribute($post_article, 'tags', post_data.tag_string);
                JSPLib.utility.setDataAttribute($post_article, 'rating', post_data.rating);
                JSPLib.utility.setDataAttribute($post_article, 'score', post_data.score);
                if (post_data.has_children) {
                    $post_article.addClass('post-status-has-children');
                } else {
                    $post_article.removeClass('post-status-has-children');
                }
                if (post_data.parent_id !== null) {
                    $post_article.addClass('post-status-has-parent');
                } else {
                    $post_article.removeClass('post-status-has-parent');
                }
                let $img = $post_article.find('img');
                let title = `${post_data.tag_string} rating:${post_data.rating} score:${post_data.score}`;
                if ($img.attr('title')) {
                    $img.attr('title', title);
                } else if ($img.data('title')) {
                    JSPLib.utility.setDataAttribute($img, 'title', title);
                }
                let $post_votes = $post_article.find('.post-votes');
                if ($post_votes.length) {
                    this._updatePostVotes(params, post_data, $post_votes);
                }
                $post_article.find('.post-preview-image').get(0)._tippy?.destroy();
            }),
            this.errorCallback(post_id, 'danbooru.updatePost', params)
        );
};

JSPLib.load.setProgramGetter = function (program_value, other_program_key, other_program_name, min_version = null) {
    Object.defineProperty(program_value, other_program_key, { get() {return JSPLib._window_jsp.exports[other_program_name] ?? {};}});
    Object.defineProperty(program_value, 'has_' + other_program_key, { get() {return other_program_name in JSPLib._window_jsp.program;}});
    if (min_version !== null) {
        Object.defineProperty(program_value, other_program_key + '_version', { get() {return Number(JSPLib._window_jsp.program[other_program_name].version);}});
        Object.defineProperty(program_value, 'use_' + other_program_key, { get() {return program_value['has_' + other_program_key] && program_value[other_program_key + '_version'] >= min_version;}});
    }
};

JSPLib.load.scriptWaitExecute = function (program_data, other_program_key, {version = true, available = null, fallback = null}) {
    //For script dependent code which may used at the beginning of program execution
    JSPLib.utility.recheckInterval({
        check: () => (version && program_data['use_' + other_program_key] || !version && program_data['has_' + other_program_key]),
        exec: available,
        fail: fallback,
        interval: JSPLib.load.script_wait_interval,
        duration: JSPLib.load.fallback_wait_duration,
    });
};

JSPLib.load.script_wait_interval = 500;
JSPLib.load.fallback_wait_duration = JSPLib.utility.one_second * 5;

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
const DRAGGABLE_MODES = ['tag-script', 'commentary', 'copy-id', 'copy-short', 'copy-link', 'vote-up', 'vote-down', 'unvote', 'favorite', 'unfavorite'];
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
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Groups tags the same way as on the post's main page. (network: 1)"
    },
    autoload_post_commentary_enabled: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Autoloads the commentary when a single post is selected. (network: 1)"
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

//Default values

const DEFAULT_VALUES = {
    pinned: false,
    post_votes: {},
    post_favorites: {},
};

//CSS constants

const PROGRAM_CSS = `
/**GENERAL**/
div#c-posts div#a-index aside#sidebar {
    min-width: 20em;
}
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

//HTML constants

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
        <input placeholder="Enter tag script" style="margin: 0.25em 0;" autocomplete="off">
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
    <div id="pmm-fetch">
        <label>Post ID</label>
        <input type="text" placeholder="Enter a post ID">
        <button name="post" title="Loads the commentary of the post ID entered.">Fetch post</button>
        <button name="parent" title="Loads the parent post's commentary amongst all of the selected posts.">Fetch parent</button>
        <button name="pool" title="Loads the first post's commentary of a pool amongst all of the selected posts.">Fetch pool</button>
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

const MODE_SETTINGS_DETAILS = `
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
        JSPLib.notice.error(`post #${post_id} has ${GetAction()}.`);
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
    const printer = JSPLib.debug.getFunctionPrint('ParentPostCheck');
    let parent_id = null;
    let child_ids = [];
    for (let i = 0; i < post_ids.length; i++) {
        let $post = $(`#post_${post_ids[i]}`);
        if ($post.hasClass('post-status-has-children')) {
            //Can include at most one parent into the selection
            if (parent_id !== null) {
                printer.debuglogLevel("Multiple parents found.", JSPLib.debug.INFO);
                return null;
            }
            parent_id = post_ids[i];
        } else if ($post.hasClass('post-status-has-parent')) {
            child_ids.push(post_ids[i]);
        } else {
            //Early bail when post has no parent or children
            printer.debuglogLevel("Post found without parent/child:", post_ids[i], JSPLib.debug.INFO);
            return null;
        }
    }
    if (child_ids.length === 0) {
        printer.debuglogLevel("No children found.", JSPLib.debug.INFO);
        return null;
    }
    let posts = await JSPLib.danbooru.submitRequest('posts', {tags: `id:${child_ids.join(',')} status:any`, limit: child_ids.length, only: POST_PARENT_FIELDS});
    printer.debuglogLevel("Parents found:", posts, JSPLib.debug.DEBUG);
    let parent_ids = JSPLib.utility.getObjectAttributes(posts, 'parent_id');
    //Must have only a single parent
    if (JSPLib.utility.arrayUnique(parent_ids).length !== 1) {
        printer.debuglogLevel("Multiple parents found.", JSPLib.debug.INFO);
        return null;
    }
    //If the parent was included, it must match the children
    if (parent_id !== null && parent_id !== parent_ids[0]) {
        printer.debuglogLevel("Parent does not match children:", parent_id, parent_ids[0], JSPLib.debug.INFO);
        return null;
    }
    return parent_ids[0];
}

async function PoolPostCheck(post_ids) {
    const printer = JSPLib.debug.getFunctionPrint('PoolPostCheck');
    let pools = await JSPLib.danbooru.submitRequest('pools', {search: {post_ids_include_all: post_ids.join(' '), category: 'series'}, only: POOL_FIELDS});
    printer.debuglogLevel("Pools found:", pools, JSPLib.debug.DEBUG);
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
        JSPLib.storage.setLocalData('pmm-mode', PMM.mode);
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
        JSPLib.storage.setLocalData('pmm-select-only', PMM.select_only);
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
        JSPLib.utility.setDataAttribute($vote, 'method', 'delete');
        if (vote_id === null) {
            JSPLib.danbooru.submitRequest('post_votes', {search: {post_id, user_id: PMM.user_id}, limit: 1, only: POST_VOTE_FIELDS}).then((data) => {
                $vote.attr('href', `/post_votes/${data.id}`);
            });
        } else {
            $vote.attr('href', `/post_votes/${vote_id}`);
        }
    } else {
        let link_score = (type === 'upvote' ? 1 : -1);
        $vote.removeClass('post-unvote-link');
        JSPLib.utility.setDataAttribute($vote, 'method', 'post');
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
    const printer = JSPLib.debug.getFunctionPrint('UpdateDraggerStatus');
    if (DRAGGABLE_MODES.includes(PMM.mode) && PMM.dragger.stopped) {
        printer.debuglogLevel("Dragger started.", JSPLib.debug.DEBUG);
        PMM.dragger.start();
    } else if (!DRAGGABLE_MODES.includes(PMM.mode) && !PMM.dragger.stopped) {
        PMM.dragger.stop();
        printer.debuglogLevel("Dragger stopped.", JSPLib.debug.DEBUG);
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
        if (!PMM.available_mode_keys.has(key)) return;
        let name = JSPLib.utility.displayCase(mode);
        html += `<option value="${key}">${name}</option>`;
    });
    return html;
}

//Initialize functions

function InitializeModeMenu() {
    $('#mode-box').replaceWith(RenderPostModeMenu());
    $('#pmm-mode-box select').on(PROGRAM_CHANGE, () => UpdateModeMenu());
    $('#pmm-select-only').on(PROGRAM_CHANGE, () => UpdateSelectOnly());
    $('.pmm-select').on(PROGRAM_CLICK, BatchSelection);
    $('#pmm-apply-all button').on(PROGRAM_CLICK, BatchApply);
    $('#pmm-undock').on(PROGRAM_CLICK, UndockModeMenu);
    $('.post-preview a.post-preview-link').on(PROGRAM_CLICK, PostModeMenu);
    $('.post-preview a.post-upvote-link').on(PROGRAM_CLICK, PostUpvote);
    $('.post-preview a.post-downvote-link').on(PROGRAM_CLICK, PostDownvote);
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
        PMM.edit_dialog.dialog(Object.assign({
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
        PMM.commentary_dialog.dialog(Object.assign({
            buttons: {
                Submit: SubmitCommentary,
                Cancel: CloseDialog,
            },
            open: CommentaryDialogOpen,
            close: CommentaryDialogClose,
        }, COMMENTARY_DIALOG_SETTINGS));
        PMM.commentary_dialog.find('#pmm-fetch button[name=post]').on(PROGRAM_CLICK, FetchPostCommentary);
        PMM.commentary_dialog.find('#pmm-fetch button[name=parent]').on(PROGRAM_CLICK, FetchParentCommentary);
        PMM.commentary_dialog.find('#pmm-fetch button[name=pool]').on(PROGRAM_CLICK, FetchPoolCommentary);
        PMM.commentary_dialog.find('.pmm-commentary-tag input').on(PROGRAM_CHANGE, ChangeCommentaryTag);
        PMM.commentary_dialog.closest('.pmm-dialog').find('.ui-button').each((_, entry) => {
            let button_id = 'pmm-commentary-' + entry.innerText.toLowerCase();
            $(entry).attr('id', button_id);
        });
    }
    PMM.commentary_dialog.dialog('open');
}

function SetupAutocomplete(selector) {
    const printer = JSPLib.debug.getFunctionPrint('SetupAutocomplete');
    JSPLib.load.scriptWaitExecute(PMM, 'IAC', {
        available: () => {
            PMM.IAC.InitializeTagQueryAutocompleteIndexed(selector, null);
            printer.debuglogLevel(`Initialized IAC autocomplete on ${selector}.`, JSPLib.debug.DEBUG);
        },
        fallback: () => {
            JSPLib.utility.setDataAttribute($(selector), 'autocomplete', 'tag-query');
            $(selector).autocomplete({
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
            printer.debuglogLevel(`Initialized Danbooru autocomplete on ${selector}.`, JSPLib.debug.DEBUG);
        },
    });
}

function UnbindEventHandlers() {
    const printer = JSPLib.debug.getFunctionPrint('UnbindEventHandlers');
    JSPLib.utility.namespaceWaitExecute({
        root: document,
        type: 'keydown',
        namespace: 'danbooru.change_tag_script',
        presence: true,
        interval: 100,
        duration: JSPLib.utility.one_second * 5,
        found () {
            $(document).off('keydown.danbooru.change_tag_script');
            $(document).off('click.danbooru', '.post-preview-container a');
            printer.debuglogLevel("Unbound Danbooru event handlers.", JSPLib.debug.VERBOSE);
        },
    });
    JSPLib.utility.namespaceWaitExecute({
        root: '.post-preview a',
        type: 'click',
        namespace: 'vti',
        presence: true,
        interval: 100,
        duration: JSPLib.utility.one_second * 5,
        found () {
            $('.post-preview a').off('click.vti');
            printer.debuglogLevel("Unbound VTI event handlers.", JSPLib.debug.VERBOSE);
        },
    });
}

//Network functions

async function VotePost(post_id, score, singular) {
    let selector = (score > 0 ? '.post-upvote-link.active-link' : '.post-downvote-link.active-link');
    if ($(`#post_${post_id} ${selector}`).length) {
        AlreadyActionNotice(post_id, singular);
        return false;
    }
    const printer = JSPLib.debug.getFunctionPrint('VotePost');
    printer.debuglogLevel(post_id, JSPLib.debug.DEBUG);
    await JSPLib.danbooru.networkSetup();
    JSPLib.network.post(`/posts/${post_id}/votes.json?score=${score}`)
        .always(JSPLib.danbooru.alwaysCallback())
        .then(
            JSPLib.danbooru.successCallback(post_id, 'VotePost', (data) => {
                let score_change = score - (PMM.post_votes[post_id]?.score ?? 0);
                UpdatePostPreview(post_id, score, {score_change, vote_id: data.id});
                PMM.post_votes[post_id] = {id: data.id, score};
            }),
            JSPLib.danbooru.errorCallback(post_id, 'VotePost', {score})
        );
    return true;
}

async function UnvotePost(post_id, singular) {
    if ($(`#post_${post_id} .post-votes .active-link`).length === 0) {
        AlreadyActionNotice(post_id, singular);
        return false;
    }
    const printer = JSPLib.debug.getFunctionPrint('UnvotePost');
    printer.debuglogLevel(post_id, JSPLib.debug.DEBUG);
    await PMM.post_vote_promise;
    let vote_id = PMM.post_votes[post_id].id;
    await JSPLib.danbooru.networkSetup();
    //eslint-disable-next-line dot-notation
    JSPLib.network.delete(`/post_votes/${vote_id}.json`)
        .always(JSPLib.danbooru.alwaysCallback())
        .then(
            JSPLib.danbooru.successCallback(post_id, 'UnvotePost', () => {
                let score_change = -PMM.post_votes[post_id].score;
                UpdatePostPreview(post_id, 0, {score_change});
                delete PMM.post_votes[post_id];
            }),
            JSPLib.danbooru.errorCallback(post_id, 'UnvotePost')
        );
    return true;
}

async function FavoritePost(post_id, singular) {
    if (PMM.post_favorites[post_id]) {
        AlreadyActionNotice(post_id, singular);
        return false;
    }
    const printer = JSPLib.debug.getFunctionPrint('FavoritePost');
    printer.debuglogLevel(post_id, JSPLib.debug.DEBUG);
    await JSPLib.danbooru.networkSetup();
    JSPLib.network.post(`/favorites.json?post_id=${post_id}`)
        .always(JSPLib.danbooru.alwaysCallback())
        .then(
            JSPLib.danbooru.successCallback(post_id, 'FavoritePost', (data) => {
                UpdatePostPreview(post_id, 1, {post_score: data.score});
                PMM.post_favorites[post_id] = true;
                JSPLib.utility.setDataAttribute($(`#post_${post_id}`), 'is-favorited', true);
            }),
            JSPLib.danbooru.errorCallback(post_id, 'FavoritePost')
        );
    return true;
}

async function UnfavoritePost(post_id, singular) {
    await PMM.post_favorite_promise;
    if (!PMM.post_favorites[post_id]) {
        AlreadyActionNotice(post_id, singular);
        return false;
    }
    const printer = JSPLib.debug.getFunctionPrint('UnfavoritePost');
    printer.debuglogLevel(post_id, JSPLib.debug.DEBUG);
    await JSPLib.danbooru.networkSetup();
    //eslint-disable-next-line dot-notation
    JSPLib.network.delete(`/favorites/${post_id}.json`)
        .always(JSPLib.danbooru.alwaysCallback())
        .then(
            JSPLib.danbooru.successCallback(post_id, 'UnfavoritePost', () => {
                UpdatePostPreview(post_id, 0, {score_change: -1});
                PMM.post_favorites[post_id] = false;
                JSPLib.utility.setDataAttribute($(`#post_${post_id}`), 'is-favorited', false);
            }),
            JSPLib.danbooru.errorCallback(post_id, 'UnfavoritePost')
        );
    return true;
}

async function UpdatePostCommentary(post_id, artist_commentary, tag_changes) {
    const printer = JSPLib.debug.getFunctionPrint('UpdatePostCommentary');
    printer.debuglogLevel(post_id, artist_commentary, tag_changes, JSPLib.debug.DEBUG);
    await JSPLib.danbooru.networkSetup();
    return JSPLib.network.put(`/posts/${post_id}/artist_commentary/create_or_update.json`, {data: {artist_commentary}})
        .always(JSPLib.danbooru.alwaysCallback())
        .then(
            JSPLib.danbooru.successCallback(post_id, 'UpdatePostCommentary', () => {
                let $post = $(`#post_${post_id}`);
                let tags = $post.data('tags').split(' ');
                let updated_tags = JSPLib.utility.arrayUnion(tags, tag_changes.adds);
                updated_tags = JSPLib.utility.arrayDifference(updated_tags, tag_changes.removes);
                JSPLib.utility.setDataAttribute($post, 'tags', updated_tags.toSorted().join(' '));
            }),
            JSPLib.danbooru.errorCallback(post_id, 'UpdatePostCommentary', artist_commentary)
        );
}

function TagscriptPost(post_id) {
    const printer = JSPLib.debug.getFunctionPrint('TagscriptPost');
    let tag_script = $('#pmm-tag-script-field input').val().trim();
    if (tag_script) {
        printer.debuglogLevel(post_id, {tag_script}, JSPLib.debug.DEBUG);
        JSPLib.danbooru.updatePost(post_id, {post: {old_tag_string: "", tag_string: tag_script}}).then(() => {
            DestroyTooltip(post_id);
        });
    } else {
        JSPLib.notice.error('No tag script set!');
    }
}

function GetCommentary(post_id) {
    const printer = JSPLib.debug.getFunctionPrint('GetCommentary');
    printer.debuglogLevel(post_id, JSPLib.debug.DEBUG);
    return JSPLib.danbooru.submitRequest(`posts/${post_id}/artist_commentary`, {only: ARTIST_COMMENTARY_FIELDS}).then((artist_commentary) => {
        if (artist_commentary !== null) {
            ['original_title', 'original_description', 'translated_title', 'translated_description'].forEach((field) => {
                PMM.commentary_dialog.find(`[name="${field}"]`).val(artist_commentary[field]);
            });
            UpdateCommentaryTags(artist_commentary.post.tag_string_meta);
        } else {
            JSPLib.notice.error("No commentary found.");
        }
    });
}

async function PreloadPostVotes() {
    if (Object.keys(PMM.post_votes).length) return;
    const printer = JSPLib.debug.getFunctionPrint('PreloadPostVotes');
    let p = JSPLib.utility.createPromise();
    PMM.post_vote_promise = p.promise;
    let $post_votes = $('.post-votes');
    if ($post_votes.length) {
        printer.debuglog("Loading votes from DOM.");
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
        printer.debuglog("Loading votes from network.");
        let post_ids = JSPLib.utility.getDOMAttributes($('.post-votes .active-link').closest('.post-preview'), 'id', Number);
        if (post_ids.length) {
            let post_votes = await JSPLib.danbooru.submitRequest('post_votes', {search: {post_id: post_ids.join(','), user_id: PMM.user_id}, limit: post_ids.length, only: POST_VOTE_FIELDS});
            post_votes.forEach((vote) => {
                PMM.post_votes[vote.post_id] = {id: vote.id, score: vote.score};
            });
        }
    }
    p.resolve(null);
}

function PreloadPostFavorites() {
    if (Object.keys(PMM.post_favorites).length) return;
    const printer = JSPLib.debug.getFunctionPrint('PreloadPostFavorites');
    let p = JSPLib.utility.createPromise();
    PMM.post_favorite_promise = p.promise;
    JSPLib.load.scriptWaitExecute(PMM, 'DPI', {
        version: false,
        available: () => {
            printer.debuglog("Loading favorites from DOM.");
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
            printer.debuglog("Loading favorites from network.");
            let post_ids = JSPLib.utility.getDOMAttributes($('.post-preview'), 'id', Number);
            if (post_ids.length) {
                JSPLib.danbooru.submitRequest('favorites', {search: {post_id: post_ids.join(','), user_id: PMM.user_id}, limit: post_ids.length, only: POST_VOTE_FIELDS}).then((post_favorites) => {
                    let favorite_post_ids = JSPLib.utility.getObjectAttributes(post_favorites, 'post_id');
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
    let post_ids = JSPLib.utility.getDOMAttributes($selected_posts, 'id', Number);
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
            JSPLib.storage.setLocalData('current_tag_script_id', change_script_id);
            JSPLib.notice.notice(`Switched to tag script #${event.key}. To switch tag scripts, use the number keys.`);
        }
        $("#pmm-tag-script-field input").val(GetCurrentTagScript());
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
    const printer = JSPLib.debug.getFunctionPrint('SubmitEdit');
    if (AreTagsEdited()) {
        $('#pmm-edit-submit, #pmm-edit-validate').attr('disabled', 'disabled');
        DisableEditInterface();
        ValidateTags().then((status) => {
            if (status) {
                let tag_string = $('#pmm-tag-string textarea').val();
                let old_tag_string = $(`#post_${PMM.edit_post_id}`).data('tags');
                printer.debuglogLevel({old_tag_string, tag_string}, JSPLib.debug.DEBUG);
                JSPLib.danbooru.updatePost(PMM.edit_post_id, {post: {old_tag_string, tag_string}}).then(() => {
                    DestroyTooltip(PMM.edit_post_id);
                });
                CloseDialog(event);
            } else {
                JSPLib.notice.error("Tag validation failed!");
            }
            $('#pmm-edit-submit, #pmm-edit-validate').attr('disabled', null);
            EnableEditInterface('#pmm-edit-dialog');
        });
    } else {
        printer.debuglogLevel("Tags not edited.", JSPLib.debug.VERBOSE);
        CloseDialog(event);
    }
}

function ValidateEdit() {
    if (AreTagsEdited()) {
        $('#pmm-edit-submit, #pmm-edit-validate').attr('disabled', 'disabled');
        DisableEditInterface();
        ValidateTags().then((status) => {
            if (status) {
                JSPLib.notice.notice("Tags good to submit!");
            } else {
                JSPLib.notice.error("Tag validation failed!");
            }
            $('#pmm-edit-submit, #pmm-edit-validate').attr('disabled', null);
            EnableEditInterface();
        });
    } else {
        $("#warning-new-tags, #warning-bad-removes, #warning-deprecated-tags").hide();
        JSPLib.notice.notice("Tags good to submit!");
    }
}

function EditDialogOpen() {
    let tag_string = $(`#post_${PMM.edit_post_id}`).data('tags');
    if (PMM.edit_tag_grouping_enabled) {
        let $text_area = $('#pmm-tag-string textarea');
        $text_area.val('loading...');
        $text_area.attr('disabled', 'disabled');
        JSPLib.danbooru.submitRequest('posts/' + PMM.edit_post_id, {only: POST_CATEGORY_FIELDS}).then((data) => {
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
        $('#pmm-tag-string textarea').val(tag_string + ' ');
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
    if (JSPLib.validate.validateID(post_id)) {
        JSPLib.notice.notice("Loading commentary data.");
        DisableCommentaryInterface();
        GetCommentary(post_id).then(() => {
            JSPLib.notice.notice("Commentary loaded.");
            EnableCommentaryInterface();
        });
    } else {
        JSPLib.notice.error("Must enter a valid post ID.");
    }
}

function FetchParentCommentary() {
    JSPLib.notice.notice("Checking parent/child relationship.");
    DisableCommentaryInterface();
    ParentPostCheck(PMM.commentary_post_ids).then((post_id) => {
        if (post_id !== null) {
            JSPLib.notice.notice("Loading commentary data.");
            $('#pmm-fetch input').val(post_id);
            GetCommentary(post_id).then(() => {
                JSPLib.notice.notice("Commentary loaded.");
                EnableCommentaryInterface();
            });
        } else {
            JSPLib.notice.error("Parent/child relationship not found.");
            EnableCommentaryInterface();
        }
    });
}

function FetchPoolCommentary() {
    JSPLib.notice.notice("Checking pool relationship.");
    DisableCommentaryInterface();
    PoolPostCheck(PMM.commentary_post_ids).then((post_id) => {
        if (post_id !== null) {
            JSPLib.notice.notice("Loading commentary data.");
            $('#pmm-fetch input').val(post_id);
            GetCommentary(post_id).then(() => {
                JSPLib.notice.notice("Commentary loaded.");
                EnableCommentaryInterface();
            });
        } else {
            JSPLib.notice.error("Pool relationship not found.");
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
            JSPLib.notice.notice("All posts updated.");
        } else {
            let successes = responses.reduce((acc, val) => acc + Number(val), 0);
            let failures = responses.length - successes;
            JSPLib.notice.error(`Error updating posts:<br><ul><li>successes: ${successes}</li><li>failures: ${failures}</li></ul>`);
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
            JSPLib.notice.notice("Loading commentary data.");
            DisableCommentaryInterface();
            GetCommentary(PMM.commentary_post_ids[0]).then(() => {
                JSPLib.notice.notice("Commentary loaded.");
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
    const printer = JSPLib.debug.getFunctionPrint('DragSelectCallback');
    //Only process drag select events when the primary (left) and only the primary mouse button is used.
    if (!event.button !== 0 && event.buttons !== 0) return;
    printer.debuglogLevel("Parameters:", {items, event}, JSPLib.debug.DEBUG);
    let click_coords = PMM.dragger.getInitialCursorPositionArea();
    let mouseup_coords = PMM.dragger.getCurrentCursorPositionArea();
    if (mouseup_coords.x === click_coords.x && mouseup_coords.y === click_coords.y) {
        printer.debuglog("Click event.");
        return;
    }
    if (items.length === 1) {
        let area_coords = JSPLib.utility.getElemPosition(PMM.$drag_area);
        let page_click_coords = {x: click_coords.x + area_coords.left, y: click_coords.y + area_coords.top};
        let page_mouseup_coords = {x: mouseup_coords.x + area_coords.left, y: mouseup_coords.y + area_coords.top};
        let box = JSPLib.utility.getElemPosition(items[0]);
        box.bottom = box.top + items[0].offsetHeight;
        box.right = box.left + items[0].offsetWidth;
        printer.debuglogLevel('Coordinates:', {page_click_coords, page_mouseup_coords, box}, JSPLib.debug.DEBUG);
        if (CoordinateInBox(page_click_coords, box) && CoordinateInBox(page_mouseup_coords, box)) {
            printer.debuglog("Click-drag within element.");
            return;
        }
    }
    let articles = items.map((entry) => $(entry).closest('article').get(0));
    let post_ids = articles.map((entry) => $(entry).data('id'));
    printer.debuglog('Drag Select IDs:', post_ids);
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
                    JSPLib.notice.error(`All selected posts have ${GetAction()}.`);
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
    const printer = JSPLib.debug.getFunctionPrint('BroadcastPMM');
    printer.debuglog(`(${ev.data.type}):`, ev.data);
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
    PMM.user_id = Danbooru.CurrentUser.data('id');
    if (!JSPLib.validate.validateID(PMM.user_id) || Danbooru.CurrentUser.data('level') < GOLD_LEVEL || Danbooru.CurrentUser.data('is-banned')) return false;
    Object.assign(PMM, {
        mode: JSPLib.storage.getLocalData('pmm-mode'),
        available_mode_keys: new Set(PMM.available_modes.map((mode) => JSPLib.utility.kebabCase(mode.toLocaleLowerCase()))),
        id_separator_char: SEPARATOR_DICT[PMM.id_separator[0]],
        select_only: JSPLib.storage.getLocalData('pmm-select-only', {default_val: false}),
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
    JSPLib.danbooru.max_network_requests = PMM.maximum_concurrent_requests;
    JSPLib.danbooru.highlight_post_enabled = PMM.highlight_errors_enabled;
    JSPLib.load.setProgramGetter(PMM, 'VTI', 'ValidateTagInput', 29.13);
    JSPLib.load.setProgramGetter(PMM, 'IAC', 'IndexedAutocomplete', 29.25);
    JSPLib.load.setProgramGetter(PMM, 'DPI', 'DisplayPostInfo');
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
    $('#pmm-option-settings').append(JSPLib.menu.renderCheckbox('autoload_post_commentary_enabled'));
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
    const preload = {
        run_on_settings: false,
        default_data: DEFAULT_VALUES,
        initialize_func: InitializeProgramValues,
        broadcast_func: BroadcastPMM,
        render_menu_func: RenderSettingsMenu,
        program_css: PROGRAM_CSS,
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
    }
    if (PMM.available_mode_keys.has('edit')) {
        $('#quick-edit-div').remove();
    }
    UnbindEventHandlers();
    JSPLib.utility.setCSSStyle(JSPLib.utility.renderColorScheme(LIGHT_MODE_CSS, 'light'), 'lightmode');
    JSPLib.utility.setCSSStyle(JSPLib.utility.renderColorScheme(DARK_MODE_CSS, 'dark'), 'darkmode');
}

/****Initialization****/

//Variables for debug.js
JSPLib.debug.level = JSPLib.storage.checkLocalData(PROGRAM_SHORTCUT + '-debug-level', {validator: ((_, data) => Number.isInteger(data)), default_val: JSPLib.debug.INFO});
JSPLib.debug.debug_console = JSPLib.storage.checkLocalData(PROGRAM_SHORTCUT + '-debug-mode', {validator: ((_, data) => typeof data === 'boolean'), default_val: false});
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
