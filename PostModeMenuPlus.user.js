// ==UserScript==
// @name         PostModeMenu+
// @namespace    https://github.com/BrokenEagle
// @version      7.0
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
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/module.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/notice.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/menu.js
// ==/UserScript==

/* global $ Danbooru JSPLib DragSelect */

/****Global variables****/

//Library variables

JSPLib.danbooru.rate_limited = false;
JSPLib.danbooru.min_rate_limit = 10;
JSPLib.danbooru.pending_update_count = 0;
JSPLib.danbooru.post_highlight_dict = {};
JSPLib.danbooru.highlight_post_enabled = true;
JSPLib.danbooru.highlight_css = `
div.danbooru-post-highlight {
    top: 0;
    left: 0;
    position: absolute;
    background: repeating-linear-gradient( 45deg, #FF0000, rgba(0,0,0, 0) 5px,rgba(0,0,0, 0) 50px);
    pointer-events: none;
}`;
/* Commented out for now since the property cannot be reconfigured. */
//Object.defineProperty(JSPLib.danbooru, 'max_network_requests', {get: () => (this.rate_limited ? 1 : this._max_network_requests), set: (val) => (this._max_network_requests = val)});

//Exterior script variables
const DANBOORU_TOPIC_ID = '21812';

//Variables for load.js
const PROGRAM_LOAD_REQUIRED_VARIABLES = ['window.jQuery', 'window.Danbooru', 'Danbooru.Utility'];
const PROGRAM_LOAD_OPTIONAL_SELECTORS = ['#c-posts #a-index #mode-box', '#c-users #a-edit'];

//Program name constants
const PROGRAM_NAME = 'PostModeMenu';
const PROGRAM_SHORTCUT = 'pmm';
const PROGRAM_CLICK = 'click.pmm';
const PROGRAM_CHANGE = 'change.pmm';

//Program variable
const PMM = {};

//Available setting values
const SUPPORTED_MODES = ['copy_ID', 'copy_short', 'copy_link', 'vote_up', 'vote_down', 'unvote', 'tag_script', 'favorite', 'unfavorite'];
const SITE_MODES = ['view', 'edit', 'tag_script', 'favorite', 'unfavorite'];
const ID_SEPARATORS = ['comma', 'colon', 'semicolon', 'space', 'return'];

//Main settings
const SETTINGS_CONFIG = {
    available_modes: {
        allitems: SUPPORTED_MODES,
        reset: SUPPORTED_MODES,
        validate: (data) => JSPLib.menu.validateCheckboxRadio(data, 'checkbox', SUPPORTED_MODES),
        hint: "Select to enable script support/availability on selected modes."
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
    select_only_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Turns on being able to select posts before applying the desired function."
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
    modified: new Set(),
};

// CSS constants

const PROGRAM_CSS = `
div#posts {
    margin: -1em;
    padding: 1em;
}
article.post-preview {
    border: solid 1px transparent;
    padding-top: 10px;
}
article.pmm-selected {
    background-color: var(--default-border-color);
    border: solid 1px var(--form-input-border-color);
}
div#pmm-select-controls {
    margin: 0.2em 0 0 0.5em;
}
div#pmm-select-only-input {
    border: 1px dotted #ddd;
    padding: 1px 5px;
    margin: 1px;
}
div#pmm-select-only-input label {
    font-size: 14px;
    font-weight: bold;
    padding-right: 0.75em;
}
button.pmm-select {
    font-size: 11px;
    margin: 0 1px;
}
button.pmm-select:disabled {
    cursor: default;
}
input#tag-script-field {
    width: 100%;
}
input#tag-script-field.pmm-long-focus:focus {
    width: 95vw;
    z-index: 10;
    position: relative;
}
button#pmm-apply-all {
    width: 100%;
    margin: 0.2em 0;
    border: 1px solid green;
    background: forestgreen;
    color: white;
    font-weight: bold;
    border-radius: 10px;
}
button#pmm-apply-all:hover {
    filter: brightness(1.25);
    box-shadow: 0 0 2px var(--form-button-hover-box-shadow-color);
}
button#pmm-apply-all:disabled {
    background: darkseagreen;
    color: #EEE;
    cursor: default;
    filter: none;
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
    width: 120px;
}`;

// HTML constants

const SELECT_CONTROLS = `
<div id="pmm-select-controls" style="display: %SHOWN%;">
    <div id="pmm-select-only-input">
        <label for="pmm-select-only">Select Only</label>
        <input type="checkbox" id="pmm-select-only" %CHECKED%>
    </div>
    <div id="pmm-selection-buttons">
        <button class="pmm-select" %DISABLED% data-type="all">All</button>
        <button class="pmm-select" %DISABLED% data-type="none">None</button>
        <button class="pmm-select" %DISABLED% data-type="invert">Invert</button>
    </div>
</div>`;

const APPLY_BUTTON = `
<div id="pmm-long-inputs" style="display: %s;">
    <button id="pmm-apply-all" %s>Apply</button>
</div>`;

// Other constants

const SEPARATOR_DICT = {
    comma: ',',
    colon: ':',
    semicolon: ';',
    space: ' ',
    return: '\n',
};

/****Functions****/

//Library functions

JSPLib.network.rateLimit = async function (self, module) {
    while (JSPLib[module].num_network_requests >= JSPLib[module].max_network_requests) {
        self.debug('logLevel', "Max simultaneous network requests exceeded! Sleeping...", JSPLib.debug.WARNING);
        let rate_limit_wait = JSPLib[module].rate_limit_wait || this.rate_limit_wait;
        await new Promise((resolve) => setTimeout(resolve, rate_limit_wait)); //Sleep
    }
};

JSPLib.debug.addModuleLogs('network', ['rateLimit']);

JSPLib.danbooru.showPendingUpdateNotice = function() {
    if (this.pending_update_count === 0) {
        JSPLib.notice.notice("Posts updated");
    } else {
        JSPLib.notice.notice(`Updating posts (${this.pending_update_count} pending)...`, true);
    }
};

JSPLib.danbooru.updatePost = async function (post_id, mode, params) {
    this.pending_update_count += 1;
    this.showPendingUpdateNotice();
    if (this.num_network_requests >= this.max_network_requests) {
        await JSPLib.network.rateLimit('danbooru');
    }
    let url_params = new URLSearchParams(window.location.search);
    let show_votes = url_params.get("show_votes");
    let size = url_params.get("size");
    this.num_network_requests += 1;
    return JSPLib.network.put(`/posts/${post_id}.js`, {data: {mode, show_votes, size, ...params}})
        .always((_data, _message, resp) => {
            this.num_network_requests -= 1;
            this.pending_update_count -= 1;
            JSPLib.danbooru.checkAPIRateLimit(resp);
        })
        .then(
            //Success
            () => {
                this.showPendingUpdateNotice();
                JSPLib.danbooru.highlightPost(post_id, false);
            },
            //Failure
            (error) => {
                error = JSPLib.network.processError(error, "danbooru.updatePost");
                let error_key = `updatePost-${post_id}-${mode}-${JSPLib._jQuery.param(params)}`;
                JSPLib.network.logError(error_key, error);
                JSPLib.network.notifyError(error);
                JSPLib.danbooru.highlightPost(post_id, true);
            }
        );
};

JSPLib.danbooru.highlightPost = function (post_id, highlight_on) {
    if (!JSPLib.danbooru.highlight_post_enabled) return;
    if (highlight_on && !(post_id in JSPLib.danbooru.post_highlight_dict)) {
        let $post = JSPLib._jQuery('#post_' + post_id);
        let $highlight = JSPLib.danbooru.post_highlight_dict[post_id] = JSPLib._jQuery('<div class="danbooru-post-highlight"></div>');
        $highlight.css({height: $post[0].offsetHeight, width: $post[0].offsetWidth});
        $post.css('position', 'relative');
        $post.append($highlight);
    }
    if (highlight_on) {
        JSPLib.danbooru.post_highlight_dict[post_id].show();
    } else {
        JSPLib.danbooru.post_highlight_dict[post_id]?.hide();
    }
};

JSPLib.danbooru.checkAPIRateLimit = function (resp) {
    try {
        var data = JSON.parse(resp.getResponseHeader('x-rate-limit'))
    } catch (error) {
        JSPLib.debug.debugerrorLevel('danbooru.checkAPIRateLimit', "Unable to get response rate limit.", JSPLib.debug.ERROR);
        return;
    }
    if (!JSPLib.validate.isHash(data.limits)) return;
    let current_limit = JSPLib.danbooru.current_limit = Math.min(...Object.values(data.limits));
    let rate_limited = current_limit < this.min_rate_limit;
    JSPLib.debug.debuglogLevel('danbooru.checkAPIRateLimit', current_limit, rate_limited, JSPLib.debug.DEBUG);
    // Temporary (maybe)... will use getter/setter at the top of the script for the library release
    if (rate_limited !== this.rate_limited) {
        if (rate_limited) {
            JSPLib.debug.debugwarnLevel('danbooru.checkAPIRateLimit', "Throttling connection.", JSPLib.debug.WARNING);
            this._max_network_requests = this.max_network_requests;
            this.max_network_requests = 1;
            this._rate_limit_wait = this.rate_limit_wait;
            this.rate_limit_wait = JSPLib.utility.one_second * 2;
        } else {
            JSPLib.debug.debugwarnLevel('danbooru.checkAPIRateLimit', "Releasing rate limit.", JSPLib.debug.INFO);
            this.max_network_requests = this._max_network_requests;
            this.rate_limit_wait = this._rate_limit_wait;
        }
        this.rate_limited = rate_limited;
    }
};

// Helper functions

function CoordinateInBox(coord, box) {
    return coord.x > box.left && coord.x < box.right && coord.y > box.top && coord.y < box.bottom;
}

function GetAllPreviews() {
    return document.querySelectorAll('.post-preview img');
}

// Auxiliary functions

function UpdateDraggerStatus() {
    if (PMM.available_modes.has(PMM.mode) && PMM.dragger.stopped) {
        PMM.dragger.start();
    } else if (!PMM.available_modes.has(PMM.mode) && !PMM.dragger.stopped) {
        PMM.dragger.stop();
    }
}

//Network functions

async function VotePost(post_id, score) {
    JSPLib.danbooru.pending_update_count += 1;
    JSPLib.danbooru.showPendingUpdateNotice();
    if (JSPLib.danbooru.num_network_requests >= JSPLib.danbooru.max_network_requests) {
        await JSPLib.network.rateLimit('danbooru');
    }
    JSPLib.danbooru.num_network_requests += 1;
    JSPLib.network.post(`/posts/${post_id}/votes?score=${score}`)
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
            },
            //Failure
            (error) => {
                error = JSPLib.network.processError(error, "VotePost");
                let error_key = `VotePost-${post_id}-${score}`;
                JSPLib.network.logError(error_key, error);
                JSPLib.network.notifyError(error);
                JSPLib.danbooru.highlightPost(post_id, true);
            }
        );
}

async function UnvotePost(post_id) {
    JSPLib.danbooru.pending_update_count += 1;
    JSPLib.danbooru.showPendingUpdateNotice();
    if (JSPLib.danbooru.num_network_requests >= JSPLib.danbooru.max_network_requests) {
        await JSPLib.network.rateLimit('danbooru');
    }
    let $post_article = $(`#post_${post_id}`);
    let $active_link = $post_article.find('.active-link');
    var score = 0;
    if ($active_link.hasClass('post-upvote-link')) {
        score = 1;
    } else if ($active_link.hasClass('post-downvote-link')) {
        score = -1;
    }
    JSPLib.danbooru.num_network_requests += 1;
    // eslint-disable-next-line dot-notation
    JSPLib.network.delete(`/posts/${post_id}/votes.json`)
        .always((_data, _message, resp) => {
            JSPLib.danbooru.pending_update_count -= 1;
            JSPLib.danbooru.num_network_requests -= 1;
            JSPLib.danbooru.checkAPIRateLimit(resp);
        })
        .then(
            //Success
            () => {
                JSPLib.danbooru.showPendingUpdateNotice();
                let $score_link = $post_article.find('.post-score a');
                let current_score = Number($score_link.text());
                $score_link.text(current_score - score);
                $post_article.find('.active-link').toggleClass('active-link inactive-link');
                JSPLib.danbooru.highlightPost(post_id, false);
            },
            //Failure
            (error) => {
                error = JSPLib.network.processError(error, "UnvotePost");
                let error_key = `UnvotePost-${post_id}`;
                JSPLib.network.logError(error_key, error);
                JSPLib.network.notifyError(error);
                JSPLib.danbooru.highlightPost(post_id, true);
            }
        );
}

function TagscriptPost(post_id) {
    let current_script_id = JSPLib.storage.getStorageData("current_tag_script_id", localStorage);
    let tag_string = localStorage.getItem("tag-script-" + current_script_id);
    if (tag_string === undefined) {
        JSPLib.notice.error('No tag script set!');
    } else {
        let params = {post: {old_tag_string: "", tag_string}};
        JSPLib.danbooru.updatePost(post_id, 'tag-script', params);
    }
}

// Main execution functions

function MenuFunctions(post_ids) {
    const copyToClipboard = function (post_ids, prefix, suffix, separator) {
        let post_string = JSPLib.utility.joinList(post_ids, prefix, suffix, separator);
        Danbooru.Utility.copyToClipboard(post_string);
    };
    var prefix;
    var post_string;
    post_ids.forEach((post_id) => {
        switch (PMM.mode) {
            case 'copy-id':
                return copyToClipboard(post_ids, "", "", PMM.id_separator);
            case 'copy-short':
                return copyToClipboard(post_ids, " post #", "", PMM.id_separator);
            case 'copy-link':
                return copyToClipboard(post_ids, " https://danbooru.donmai.us/posts/", " ", PMM.id_separator);
            case 'vote-up':
            case 'vote-down':
                VotePost(post_id, (PMM.mode === 'vote-up' ? 1 : (PMM.mode === 'vote-down' ? -1 : 0)));
                break;
            case 'unvote':
                UnvotePost(post_id);
                break;
            case 'tag-script':
                TagscriptPost(post_id);
                break;
            default:
                //Do nothing
        }
    });
}

//Initialize functions

function InitializeModeMenu() {
    $("#mode-box select option[value=tag-script]").after(RenderPostModeMenuAddons());
    if (PMM.user_settings.long_tagscript_enabled) {
        $('#tag-script-field').addClass('pmm-long-focus').css('width', "");
    }
    $(".post-preview a.post-preview-link").on(PROGRAM_CLICK, PostModeMenu);
    $("#mode-box select").on(PROGRAM_CHANGE, ChangeModeMenu);
    $(document).on('danbooru:post-preview-updated.pmm', PostPreviewUpdated);
    if (PMM.user_settings.drag_select_enabled) {
        PMM.dragger.subscribe('callback', DragSelectCallback);
        UpdateDraggerStatus();
    }
    if (PMM.mode) {
        let set_mode = (PMM.available_modes.has(PMM.mode) ? PMM.mode : 'view');
        setTimeout(() => {$("#mode-box select").val(set_mode);}, JSPLib.utility.one_second);
    }
}

function InitializeSelectOnly() {
    //Reorganize and apply additional controls to mode menu box
    let $tag_script = $('#tag-script-field').detach();
    let $mode_select = $('#mode-box').children().detach();
    let $mode_select_div = $('<div style="display: flex;"></div>');
    let $mode_select_container = $('<div></div>');
    $mode_select_container.append($mode_select);
    $mode_select_div.append($mode_select_container);
    let disabled = (PMM.select_only ? "" : 'disabled');
    let shown = (PMM.available_modes.has(PMM.mode) ? 'block' : 'none');
    $mode_select_div.append(JSPLib.utility.regexReplace(SELECT_CONTROLS, {
        SHOWN: shown,
        DISABLED: disabled,
        CHECKED: (PMM.select_only ? 'checked' : ""),
    }));
    $('#mode-box').append($mode_select_div);
    $('#mode-box').append(JSPLib.utility.sprintf(APPLY_BUTTON, shown, disabled));
    $('#pmm-long-inputs').prepend($tag_script);
    //Initialize all event handlers
    $('#pmm-select-only').on(PROGRAM_CHANGE, ChangeSelectOnly);
    $('.pmm-select').on(PROGRAM_CLICK, BatchSelection);
    $('#pmm-apply-all').on(PROGRAM_CLICK, BatchApply);
}

//Render functions

function RenderPostModeMenuAddons() {
    let html = "";
    PMM.user_settings.available_modes.forEach((mode) => {
        if (SITE_MODES.includes(mode)) return;
        let key = JSPLib.utility.kebabCase(mode);
        let name = JSPLib.utility.displayCase(mode);
        html += `<option value="${key}">${name}</option>`;
    });
    return html;
}

//Event handlers

function PostModeMenu(event) {
    if (PMM.available_modes.has(PMM.mode)) {
        let $link = $(event.currentTarget);
        let $article = $link.closest("article");
        let post_id = $article.data("id");
        if (PMM.select_only) {
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
    PMM.mode = $("#mode-box select").val();
    if (PMM.available_modes.has(PMM.mode)) {
        JSPLib.storage.setStorageData('pmm-mode', PMM.mode, localStorage);
        $('#pmm-select-controls, #pmm-long-inputs').show();
    } else {
        JSPLib.storage.removeStorageData('pmm-mode', localStorage);
        $('#pmm-select-controls, #pmm-long-inputs').hide();
    }
    if (!PMM.select_only) {
        $('.pmm-selected').removeClass('pmm-selected');
        PMM.modified.clear();
    }
    if (PMM.user_settings.drag_select_enabled) {
        UpdateDraggerStatus();
    }
}

function ChangeSelectOnly(event) {
    PMM.select_only = event.currentTarget.checked;
    JSPLib.storage.setStorageData('pmm-select-only', PMM.select_only, localStorage);
    let $modify_controls = $('#pmm-apply-all, .pmm-select');
    $modify_controls.prop('disabled', !PMM.select_only);
    $('.pmm-selected').removeClass('pmm-selected');
    PMM.modified.clear();
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
    if (PMM.user_settings.drag_select_enabled) {
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
    if (!PMM.available_modes.has(PMM.mode) || (event.button !== 0 && event.buttons !== 0)) return;
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

//Settings functions

function InitializeProgramValues() {
    Object.assign(PMM, {
        mode: JSPLib.storage.getStorageData('pmm-mode', localStorage),
        available_modes: new Set(PMM.user_settings.available_modes.map((mode) => JSPLib.utility.kebabCase(mode.toLocaleLowerCase()))),
        id_separator: SEPARATOR_DICT[PMM.user_settings.id_separator[0]],
        select_only: JSPLib.storage.getStorageData('pmm-select-only', localStorage, false),
        all_post_ids: new Set(JSPLib.utility.getDOMAttributes($('.post-preview'), 'id', parseInt)),
        $drag_area: document.querySelector('#posts'),
    });
    if (PMM.user_settings.drag_select_enabled) {
        PMM.dragger = new DragSelect({
            selectables: GetAllPreviews(),
            area: PMM.$drag_area,
            draggability: false,
            immediateDrag: false
        });
    }
    JSPLib.danbooru.max_network_requests = PMM.user_settings.maximum_concurrent_requests;
    JSPLib.danbooru.highlight_post_enabled = PMM.user_settings.highlight_errors_enabled;
    return true;
}

function RenderSettingsMenu() {
    $('#post-mode-menu').append(JSPLib.menu.renderMenuFramework(MENU_CONFIG));
    $('#pmm-general-settings').append(JSPLib.menu.renderDomainSelectors());
    $('#pmm-mode-settings').append(JSPLib.menu.renderInputSelectors('available_modes', 'checkbox'));
    $('#pmm-mode-settings').append(JSPLib.menu.renderInputSelectors('id_separator', 'radio'));
    $("#pmm-network-settings").append(JSPLib.menu.renderTextinput('maximum_concurrent_requests', 10));
    $('#pmm-network-settings').append(JSPLib.menu.renderCheckbox('highlight_errors_enabled'));
    $('#pmm-select-settings').append(JSPLib.menu.renderCheckbox('select_only_enabled'));
    $('#pmm-select-settings').append(JSPLib.menu.renderCheckbox('drag_select_enabled'));
    $('#pmm-interface-settings').append(JSPLib.menu.renderCheckbox('long_searchbar_enabled'));
    $('#pmm-interface-settings').append(JSPLib.menu.renderCheckbox('long_tagscript_enabled'));
    JSPLib.menu.engageUI(true);
    JSPLib.menu.saveUserSettingsClick();
    JSPLib.menu.resetUserSettingsClick();
}

//Main function

function Main() {
    JSPLib.debug.debuglog("Initialize start:", JSPLib.utility.getProgramTime());
    const preload = {
        run_on_settings: false,
        default_data: DEFAULT_VALUES,
        initialize_func: InitializeProgramValues,
        menu_css: MENU_CSS,
    };
    if (!JSPLib.menu.preloadScript(PMM, RenderSettingsMenu, preload)) return;
    InitializeModeMenu();
    if (PMM.user_settings.select_only_enabled) {
        InitializeSelectOnly();
    }
    if (PMM.user_settings.long_searchbar_enabled) {
        JSPLib.utility.setCSSStyle(SEARCHBAR_CSS, 'searchbar');
    }
    if (PMM.user_settings.highlight_errors_enabled) {
        JSPLib.utility.setCSSStyle(JSPLib.danbooru.highlight_css, 'highlight');
    }
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
JSPLib.menu.program_data = PMM;
JSPLib.menu.settings_config = SETTINGS_CONFIG;

//Export JSPLib
JSPLib.load.exportData(PROGRAM_NAME, PMM);

/****Execution start****/

JSPLib.load.programInitialize(Main, {program_name: PROGRAM_NAME, required_variables: PROGRAM_LOAD_REQUIRED_VARIABLES, optional_selectors: PROGRAM_LOAD_OPTIONAL_SELECTORS});
