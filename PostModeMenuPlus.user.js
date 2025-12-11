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
        if (/^[ \/}]/.test(line)) {
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

/****Global variables****/

//Exterior script variables
const DANBOORU_TOPIC_ID = '21812';

//Variables for load.js
const PROGRAM_LOAD_REQUIRED_VARIABLES = ['window.jQuery', 'window.Danbooru', 'Danbooru.Utility', 'Danbooru.CurrentUser'];
const PROGRAM_LOAD_OPTIONAL_SELECTORS = ['#c-posts #a-index #mode-box', '#c-users #a-edit'];

//Program name constants
const PROGRAM_NAME = 'PostModeMenu';
const PROGRAM_SHORTCUT = 'pmm';
const PROGRAM_CLICK = 'click.pmm';
const PROGRAM_CHANGE = 'change.pmm';

//Program variable
const PMM = {};

//Available setting values
const SUPPORTED_MODES = ['edit', 'copy_ID', 'copy_short', 'copy_link', 'vote_up', 'vote_down', 'unvote', 'tag_script', 'commentary', 'favorite', 'unfavorite'];
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
        hint: "Set the order for how actions appear in the mode menu. <b>Note:</b>View will still always be first."
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
        hint: "Choose how to separate multiple post IDs copied with Copy ID."
    },
    commentary_relations_check_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Turns on checking selected posts for parent/child or pool relationships, and loads the post ID if found."
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
    modified: new Set(),
    post_votes: {},
    post_favorites: new Set(),
};

// CSS constants

const PROGRAM_CSS = `
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
#pmm-commentary-dialog label {
    display: block;
    font-weight: bold;
}
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

const SELECT_CONTROLS = `
<div id="pmm-select-controls" style="display: %SHOWN%;">
    <div id="pmm-select-only-input">
        <label for="pmm-select-only">
            Select Only
            <input type="checkbox" id="pmm-select-only" %CHECKED%>
        </label>
    </div>
    <div id="pmm-selection-buttons">
        <button class="pmm-select" %DISABLED% data-type="all">All</button>
        <button class="pmm-select" %DISABLED% data-type="none">None</button>
        <button class="pmm-select" %DISABLED% data-type="invert">Invert</button>
    </div>
</div>`;

const UNDOCK_PIN = `
<button id="pmm-undock" class="ui-button ui-corner-all ui-widget" title="pin" style="padding: 0 5px; position: absolute; top: 4px; left: 4px;">
    <span class="ui-button-icon ui-icon ui-icon-pin-w"></span>
</button>`;

const APPLY_BUTTON = `
<div id="pmm-long-inputs" style="display: %s;">
    <button id="pmm-apply-all" %s>Apply</button>
</div>`;


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


// Other constants

const EDIT_DIALOG_SETTINGS = {
    title: "Post edit",
    width: 1000,
    height: 300,
    modal: false,
    resizable: true,
    autoOpen: true,
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

function CoordinateInBox(coord, box) {
    return coord.x > box.left && coord.x < box.right && coord.y > box.top && coord.y < box.bottom;
}

function GetAllPreviews() {
    return document.querySelectorAll('.post-preview img');
}

// Auxiliary functions

function UpdateDraggerStatus() {
    if (PMM.available_mode_keys.has(PMM.mode) && PMM.dragger.stopped) {
        PMM.dragger.start();
    } else if (!PMM.available_mode_keys.has(PMM.mode) && !PMM.dragger.stopped) {
        PMM.dragger.stop();
    }
}

function UpdateSelectControls() {
    console.log('UpdateSelectControls', PMM.mode, ['edit', 'view'].includes(PMM.mode));
    if (PMM.mode === 'tag-script') {
        $('#pmm-tag-script-field').show();
    } else {
        $('#pmm-tag-script-field').hide();
    }
    if (['edit', 'view'].includes(PMM.mode)) {
        $('#pmm-mode-box input, #pmm-mode-box button').attr('disabled', 'disabled');
        $('#pmm-select-only-input label').addClass('pmm-disabled');
    } else {
        $('#pmm-mode-box input, #pmm-mode-box button').attr('disabled', null);
        $('#pmm-select-only-input label').removeClass('pmm-disabled');
    }
}

//Network helpers

async function NetworkSetup() {
    JSPLib.danbooru.pending_update_count += 1;
    JSPLib.danbooru.showPendingUpdateNotice();
    if (JSPLib.danbooru.num_network_requests >= JSPLib.danbooru.max_network_requests) {
        await JSPLib.network.rateLimit('danbooru');
    }
    JSPLib.danbooru.num_network_requests += 1;
}

function AlwaysCallback(_data, _message, resp) {
    JSPLib.danbooru.pending_update_count -= 1;
    JSPLib.danbooru.num_network_requests -= 1;
    JSPLib.danbooru.checkAPIRateLimit(resp);
}

function SuccessCallback(post_id, func) {
    return function (data) {
        if (typeof func === 'function') {
            func(data);
        }
        JSPLib.danbooru.showPendingUpdateNotice();
        JSPLib.danbooru.highlightPost(post_id, false);
    };
}

function ErrorCallback(post_id, func_name, ...args) {
    return function (error) {
        error = JSPLib.network.processError(error, func_name);
        let error_key = `${func_name}-${post_id}` + (args.length ? '-' + args.join('-') : "");
        JSPLib.network.logError(error_key, error);
        JSPLib.network.notifyError(error);
        JSPLib.danbooru.highlightPost(post_id, true);
    };
}

//Network functions

async function VotePost(post_id, score) {
    NetworkSetup();
    JSPLib.network.post(`/posts/${post_id}/votes.json?score=${score}`)
        .always(AlwaysCallback)
        .then(
            //Success
            SuccessCallback(post_id, (data) => {
                let $post_article = $(`#post_${post_id}`);
                let $score_link = $post_article.find('.post-score a');
                let current_score = Number($score_link.text());
                $score_link.text(current_score + score);
                let vote_selector = (score > 0 ? 'post-upvote-link' : 'post-downvote-link');
                $post_article.find(vote_selector).toggleClass('active-link inactive-link');
            }),
            //Failure
            ErrorCallback(post_id, 'VotePost', score)
        );
}

async function UnvotePost(post_id) {
    await PMM.post_vote_promise;
    if (!(post_id in PMM.post_votes)) return;
    let vote_id = PMM.post_votes[post_id];
    let $post_article = $(`#post_${post_id}`);
    let $active_link = $post_article.find('.active-link');
    var score = 0;
    if ($active_link.hasClass('post-upvote-link')) {
        score = 1;
    } else if ($active_link.hasClass('post-downvote-link')) {
        score = -1;
    } else {
        return;
    }
    await NetworkSetup();
    // eslint-disable-next-line dot-notation
    JSPLib.network.delete(`/post_votes/${vote_id}.json`)
        .always(AlwaysCallback)
        .then(
            //Success
            SuccessCallback(post_id, () => {
                let $score_link = $post_article.find('.post-score a');
                let current_score = Number($score_link.text());
                $score_link.text(current_score - score);
                $post_article.find('.active-link').toggleClass('active-link inactive-link');
            }),
            //Failure
            ErrorCallback(post_id, 'UnvotePost')
        );
}

async function FavoritePost(post_id) {
    await NetworkSetup();
    JSPLib.network.post(`/favorites.json?post_id=${post_id}`)
        .always(AlwaysCallback)
        .then(
            //Success
            SuccessCallback(post_id, (data) => {
                let $post_article = $(`#post_${post_id}`);
                $post_article.find('.post-score a').text(data.score);
                $post_article.find('post-upvote-link').toggleClass('active-link inactive-link');
                PMM.post_favorites.add(post_id);
            }),
            //Failure
            ErrorCallback(post_id, 'FavoritePost')
        );
}

async function UnfavoritePost(post_id) {
    await PMM.post_favorite_promise;
    if (!PMM.post_favorites.has(post_id)) return;
    await NetworkSetup();
    // eslint-disable-next-line dot-notation
    JSPLib.network.delete(`/favorites/${post_id}.json`)
        .always(AlwaysCallback)
        .then(
            //Success
            SuccessCallback(post_id, () => {
                let $post_article = $(`#post_${post_id}`);
                let $score_link = $post_article.find('.post-score a');
                let current_score = Number($score_link.text());
                $score_link.text(current_score - 1);
                $post_article.find('post-upvote-link').toggleClass('active-link inactive-link');
                // eslint-disable-next-line dot-notation
                PMM.post_favorites.delete(post_id);
            }),
            //Failure
            ErrorCallback(post_id, 'UnfavoritePost')
        );
}

function TagscriptPost(post_id) {
    let current_script_id = JSPLib.storage.getLocalData("current_tag_script_id");
    let tag_string = localStorage.getItem("tag-script-" + current_script_id);
    if (tag_string === undefined) {
        JSPLib.notice.error('No tag script set!');
    } else {
        let params = {post: {old_tag_string: "", tag_string}};
        return JSPLib.danbooru.updatePost(post_id, 'tag-script', params);
    }
}

async function UpdatePostVotes(post_ids) {
    let p = JSPLib.utility.createPromise();
    PMM.post_vote_promise = p.promise;
    let post_votes = await JSPLib.danbooru.submitRequest('post_votes', {search: {post_id: post_ids.join(','), user_id: Danbooru.CurrentUser.data('id')}, limit: post_ids.length, only: POST_VOTE_FIELDS});
    post_votes.forEach((vote) => {
        PMM.post_votes[vote.post_id] = vote.id;
    });
    p.resolve(null);
}

async function UpdatePostFavorites(post_ids) {
    let p = JSPLib.utility.createPromise();
    PMM.post_favorite_promise = p.promise;
    let query_ids = post_ids.filter((post_id) => !PMM.post_favorites.has(post_id));
    if (query_ids.length) {
        let post_favorites = await JSPLib.danbooru.submitRequest('favorites', {search: {post_id: post_ids.join(','), user_id: Danbooru.CurrentUser.data('id')}, limit: post_ids.length, only: POST_VOTE_FIELDS});
        let favorite_post_ids = JSPLib.utility.getObjectAttributes(post_favorites, 'id');
        PMM.post_favorites = JSPLib.utility.setUnion(PMM.post_favorites, favorite_post_ids);
    }
    p.resolve(null);
}

function SubmitCommentary(post_ids) {
    let artist_commentary = {};
    $('.pmm-commentary-input input, .pmm-commentary-input textarea').each((_, input) => {
        artist_commentary[input.name] = input.value;
    });
    console.log("Artist_commentary:", artist_commentary);
    let promise_array = [];
    post_ids.forEach((post_id) => {
        let p = JSPLib.network.put(`/posts/${post_id}/artist_commentary/create_or_update.json`, {data: {artist_commentary}})
            .always((_data, _message, resp) => {
                JSPLib.danbooru.pending_update_count -= 1;
                JSPLib.danbooru.num_network_requests -= 1;
                JSPLib.danbooru.checkAPIRateLimit(resp);
            })
            .then(
                //Success
                () => {
                    JSPLib.danbooru.showPendingUpdateNotice();
                    JSPLib.danbooru.highlightPost(post_id, false);
                    return true;
                },
                //Failure
                (error) => {
                    error = JSPLib.network.processError(error, "Commentary");
                    let error_key = `Commentary-${post_id}`;
                    JSPLib.network.logError(error_key, error);
                    JSPLib.network.notifyError(error);
                    JSPLib.danbooru.highlightPost(post_id, true);
                    return false;
                }
            );
        promise_array.push(p);
    });
    Promise.all(promise_array).then((responses) => {
        if (responses.every(Boolean)) {
            JSPLib.notice.notice("All posts updated.");
        } else {
            let successes = responses.reduce((acc, val) => acc + Number(val), 0);
            let failures = responses.length - successes;
            JSPLib.notice.error(`Error updating posts:<br><ul><li>successes: ${successes}</li><li>failures: ${failures}</li></ul>`);
        }
    });
}

function OpenCommentaryDialog(post_ids) {
    console.log('OpenCommentaryDialog', post_ids);
    if (!OpenCommentaryDialog.$commentary_dialog) {
        let $commentary_dialog = $(COMMENTARY_DIALOG_HTML);
        $commentary_dialog.dialog({
            title: 'Copy Commentaries',
            autoOpen: false,
            modal: true,
            width: 700,
            buttons: {
                "Submit": function() {
                    SubmitCommentary(PMM.commentary_post_ids);
                    $(this).dialog("close");
                },
                "Cancel": function() {
                    $(this).dialog("close");
                },
            }
        });
        $commentary_dialog.find('#pmm-fetch-post button').on(PROGRAM_CLICK, (event) => {
            let $button = $(event.target);
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
        });
        OpenCommentaryDialog.$commentary_dialog = $commentary_dialog;
    }
    OpenCommentaryDialog.$commentary_dialog.find('input, textarea').val("");
    let $fetch_input = OpenCommentaryDialog.$commentary_dialog.find('#pmm-fetch-post input');
    if (post_ids.length === 1) {
        $fetch_input.val(post_ids[0]);
    } else if (PMM.commentary_relations_check_enabled) {
        let $fetch_button = OpenCommentaryDialog.$commentary_dialog.find('#pmm-fetch-post button');
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
    } else {
        $fetch_input.val("");
    }
    OpenCommentaryDialog.$commentary_dialog.dialog('open');
    PMM.commentary_post_ids = post_ids;
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

//Initialize functions

function InitializeModeMenu() {
    $('#mode-box').replaceWith(RenderPostModeMenu());
    $("#pmm-mode-box select").on(PROGRAM_CHANGE, ChangeModeMenu);
    $('#pmm-select-only').on(PROGRAM_CHANGE, ChangeSelectOnly);
    $('.pmm-select').on(PROGRAM_CLICK, BatchSelection);
    $('#pmm-apply-all button').on(PROGRAM_CLICK, BatchApply);
    $('#pmm-undock').on(PROGRAM_CLICK, UndockModeMenu);
    $(".post-preview a.post-preview-link").on(PROGRAM_CLICK, PostModeMenu);
    $(document).on('danbooru:post-preview-updated.pmm', PostPreviewUpdated);
    $("#pmm-mode-controls select").val(PMM.mode);
    $("#pmm-select-only").prop('checked', PMM.select_only);
    if (PMM.long_tagscript_enabled) {
        $('#pmm-tag-script-field input').addClass('pmm-long-focus');
    }
    if (PMM.drag_select_enabled) {
        PMM.dragger.subscribe('callback', DragSelectCallback);
        UpdateDraggerStatus();
    }
    UpdateSelectControls();
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

//Event handlers

function PostModeMenu(event) {
    if (PMM.available_mode_keys.has(PMM.mode)) {
        let $link = $(event.currentTarget);
        let $article = $link.closest("article");
        let post_id = $article.data("id");
        if (PMM.mode === 'edit') {
            var $post = $("#post_" + post_id);
            $("#quick-edit-form").attr("data-post-id", post_id);
            $("#post_tag_string").val($post.data("tags") + " ").focus().selectEnd();
            $('#quick-edit-div').dialog(EDIT_DIALOG_SETTINGS);
        } else if (PMM.select_only) {
            $article.toggleClass('pmm-selected');
            // eslint-disable-next-line dot-notation
            let toggle_func = (PMM.modified.has(post_id) ? PMM.modified.delete : PMM.modified.add);
            toggle_func.call(PMM.modified, post_id);
        } else {
            $article.addClass('pmm-selected');
            PMM.modified.add(post_id);
            MenuFunctions([post_id]);
        }
        event.preventDefault();
        event.stopImmediatePropagation();
    }
}

function BatchSelection(event) {
    let type = $(event.currentTarget).data('type');
    if (type === 'all') {
        PMM.modified = JSPLib.utility.copySet(PMM.all_post_ids);
        $('.post-preview').addClass('pmm-selected');
    } else if (type === 'none') {
        PMM.modified.clear();
        $('.post-preview').removeClass('pmm-selected');
    } else if (type === 'invert') {
        PMM.modified = JSPLib.utility.setDifference(PMM.all_post_ids, PMM.modified);
        $('.post-preview').toggleClass('pmm-selected');
    }
}

function BatchApply() {
    MenuFunctions([...PMM.modified]);
}

function ChangeModeMenu() {
    PMM.mode = $("#pmm-mode-box select").val();
    console.log('ChangeModeMenu', PMM.mode);
    JSPLib.storage.setLocalData('pmm-mode', PMM.mode);
    UpdateSelectControls();
    if (!PMM.select_only) {
        $('.pmm-selected').removeClass('pmm-selected');
        PMM.modified.clear();
    }
    if (PMM.drag_select_enabled) {
        UpdateDraggerStatus();
    }
}

function ChangeSelectOnly(event) {
    PMM.select_only = event.currentTarget.checked;
    JSPLib.storage.setLocalData('pmm-select-only', PMM.select_only);
    let $modify_controls = $('#pmm-apply-all button, .pmm-select');
    $modify_controls.prop('disabled', !PMM.select_only);
    $('.pmm-selected').removeClass('pmm-selected');
    PMM.modified.clear();
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

function CloseEditDialog() {
    $('#quick-edit-div').dialog('close');
}

function PostPreviewUpdated(event, post) {
    let $post = $(`#post_${post.id}`);
    $post.find('a.post-preview-link').on(PROGRAM_CLICK, PostModeMenu);
    if (PMM.modified.has(post.id)) {
        $post.addClass('pmm-selected');
    }
    if (Number.isInteger(PMM.init_timer)) {
        clearTimeout(PMM.init_timer);
    }
    if (PMM.drag_select_enabled) {
        PMM.init_timer = setTimeout(() => {
            PMM.dragger.SelectableSet._initElements = [...document.querySelectorAll('.post-preview img')];
            PMM.dragger.SelectableSet.clear();
            PMM.dragger.SelectedSet.clear();
            PMM.dragger.setSelectables(document.querySelectorAll('.post-preview img'));
            PMM.init_timer = null;
        }, 1000);
    }
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
    let set_post_ids = JSPLib.utility.arrayToSet(post_ids);
    JSPLib.debug.debuglog('Drag Select IDs', set_post_ids);
    if (PMM.select_only) {
        $(articles).toggleClass('pmm-selected');
        PMM.modified = JSPLib.utility.setSymmetricDifference(PMM.modified, set_post_ids);
    } else {
        $(articles).addClass('pmm-selected');
        PMM.modified = JSPLib.utility.setUnion(PMM.modified, set_post_ids);
        MenuFunctions(post_ids);
    }
    document.getSelection().removeAllRanges();
}

// Main execution functions

function MenuFunctions(post_ids) {
    const copyToClipboard = function (post_ids, prefix, suffix, separator, afterspace) {
        if (afterspace && !['\n', ' '].includes(separator)) {
            separator += " ";
        }
        let post_string = JSPLib.utility.joinList(post_ids, prefix, suffix, separator);
        Danbooru.Utility.copyToClipboard(post_string);
    };

    var prefix;
    var post_string;
    if (PMM.mode === 'unvote') {
        UpdatePostVotes(post_ids);
    }
    if (PMM.mode === 'unfavorite') {
        UpdatePostFavorites(post_ids);
    }
    for (let i = 0; i < post_ids.length; i++) {
        let post_id = post_ids[i];
        switch (PMM.mode) {
            case 'copy-id':
                return copyToClipboard(post_ids, "", "", PMM.id_separator_char, false);
            case 'copy-short':
                return copyToClipboard(post_ids, "post #", "", PMM.id_separator_char, true);
            case 'copy-link':
                return copyToClipboard(post_ids, "https://danbooru.donmai.us/posts/", " ", PMM.id_separator_char, true);
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
            case 'unvaforite':
                UnfavoritePost(post_id);
                break;
            case 'tag-script':
                TagscriptPost(post_id);
                break;
            case 'commentary':
                return OpenCommentaryDialog(post_ids);
            default:
                //Do nothing
        }
    }
}

//Settings functions

function InitializeProgramValues() {
    Object.assign(PMM, {
        mode: JSPLib.storage.getLocalData('pmm-mode'),
        available_mode_keys: new Set(PMM.available_modes.map((mode) => JSPLib.utility.kebabCase(mode.toLocaleLowerCase()))),
        id_separator_char: SEPARATOR_DICT[PMM.id_separator[0]],
        select_only: JSPLib.storage.getLocalData('pmm-select-only', {default_val: false}),
        all_post_ids: new Set(JSPLib.utility.getDOMAttributes($('.post-preview'), 'id', parseInt)),
        $drag_area: document.querySelector('#posts'),
    });
    if (PMM.safe_tag_script_enabled && PMM.mode === 'tag-script') {
        JSPLib.storage.removeLocalData('mode', 'view');
        JSPLib.storage.removeLocalData('pmm-mode', 'view');
        PMM.mode = 'view';
    }
    if (PMM.drag_select_enabled) {
        PMM.dragger = new DragSelect({
            selectables: GetAllPreviews(),
            area: PMM.$drag_area,
            draggability: false,
            immediateDrag: false
        });
    }
    JSPLib.danbooru.max_network_requests = PMM.maximum_concurrent_requests;
    JSPLib.danbooru.highlight_post_enabled = PMM.highlight_errors_enabled;
    return true;
}

function RenderSettingsMenu() {
    $('#post-mode-menu').append(JSPLib.menu.renderMenuFramework(MENU_CONFIG));
    $('#pmm-general-settings').append(JSPLib.menu.renderDomainSelectors());
    $('#pmm-mode-settings').append(JSPLib.menu.renderInputSelectors('available_modes', 'checkbox'));
    $('#pmm-mode-settings').append(JSPLib.menu.renderSortlist('mode_order'));
    $('#pmm-mode-settings').append(JSPLib.menu.renderInputSelectors('id_separator', 'radio'));
    $('#pmm-mode-settings').append(JSPLib.menu.renderCheckbox('safe_tag_script_enabled'));
    $("#pmm-network-settings").append(JSPLib.menu.renderTextinput('maximum_concurrent_requests', 10));
    $('#pmm-network-settings').append(JSPLib.menu.renderCheckbox('highlight_errors_enabled'));
    $('#pmm-select-settings').append(JSPLib.menu.renderCheckbox('drag_select_enabled'));
    $('#pmm-interface-settings').append(JSPLib.menu.renderCheckbox('long_searchbar_enabled'));
    $('#pmm-interface-settings').append(JSPLib.menu.renderCheckbox('long_tagscript_enabled'));
    JSPLib.menu.engageUI(true, true);
    JSPLib.menu.saveUserSettingsClick();
    JSPLib.menu.resetUserSettingsClick();
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
    if (PMM.available_mode_keys.has('edit')) {
        $('#validate-tags, button[name=cancel]').off('click.danbooru').on('click.pmm', CloseEditDialog);
    }
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
