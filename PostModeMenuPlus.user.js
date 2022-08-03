// ==UserScript==
// @name         PostModeMenu+
// @namespace    https://gist.github.com/BrokenEagle
// @version      5.1
// @description  Provide additional functions on the post mode menu.
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        *://*.donmai.us/
// @match        *://*.donmai.us/posts*
// @match        *://*.donmai.us/settings
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

JSPLib.danbooru.pending_update_count = 0;

//Variables for load.js
const PROGRAM_LOAD_REQUIRED_VARIABLES = ['window.jQuery', 'window.Danbooru', 'Danbooru.Utility'];
const PROGRAM_LOAD_OPTIONAL_SELECTORS = ['#c-posts #a-index #mode-box', '#c-users #a-edit'];

//Program name constants
const PROGRAM_NAME = 'PostModeMenu';
const PROGRAM_SHORTCUT = 'pmm';
const PROGRAM_CLICK = 'click.pmm';

//Program variable
const PMM = {};

//Available setting values
const SUPPORTED_MODES = ['copy_ID', 'upvote', 'downvote', 'unvote', 'tag_script'];
const ID_SEPARATORS = ['comma', 'space', 'return'];

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
    drag_select_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Turns on being able to drag select, allowing multiple posts to be processed at once."
    },
};

const MENU_CONFIG = {
    topic_id: null,
    settings: [{
        name: 'general',
    }, {
        name: 'mode',
    }, {
        name: 'network',
    }, {
        name: 'select',
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
#posts {
    margin: -1em -2em;
    padding: 2em;
}
.post-preview {
    border: solid 1px transparent;
    padding-top: 5px;
}
.pmm-selected {
    background-color: var(--default-border-color);
    border: solid 1px var(--form-input-border-color);
}`;

const MENU_CSS = `
.jsplib-selectors.pmm-selectors[data-setting="available_modes"] label {
    width: 120px;
}`;

// Other constants

const SEPARATOR_DICT = {
    comma: ',',
    space: ' ',
    return: '\n',
};

/****Functions****/

//Library functions

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
        .always(() => {
            this.num_network_requests -= 1;
            this.pending_update_count -= 1;
        })
        .then(
            //Success
            () => {
                this.showPendingUpdateNotice();
            },
            //Failure
            (error) => {
                JSPLib.notice.error(`Network error: HTTP ${error.status}`);
            }
        );
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
        .always(() => {
            JSPLib.danbooru.pending_update_count -= 1;
            JSPLib.danbooru.num_network_requests -= 1;
        })
        .then(
            //Success
            () => {
                JSPLib.danbooru.showPendingUpdateNotice();
            },
            //Failure
            (error) => {
                if ('responseJSON' in error && 'message' in error.responseJSON) {
                    Danbooru.Utility.error(error.responseJSON.message);
                } else {
                    Danbooru.Utility.error(`Unable to vote on post #${post_id}!`);
                }
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
        .always(() => {
            JSPLib.danbooru.pending_update_count -= 1;
            JSPLib.danbooru.num_network_requests -= 1;
        })
        .then(
            //Success
            () => {
                JSPLib.danbooru.showPendingUpdateNotice();
                let $score_link = $post_article.find('.post-score a');
                let current_score = Number($score_link.text());
                $score_link.text(current_score - score);
                $post_article.find('.active-link').toggleClass('active-link inactive-link');
            },
            //Failure
            (error) => {
                if ('responseJSON' in error && 'message' in error.responseJSON) {
                    Danbooru.Utility.error(error.responseJSON.message);
                } else {
                    Danbooru.Utility.error(`Unable to unvote on post #${post_id}!`);
                }
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
    post_ids.forEach((post_id) => {
        switch (PMM.mode) {
            case 'copy-id':
                Danbooru.Utility.copyToClipboard(post_ids.join(PMM.id_separator));
                return;
            case 'upvote':
            case 'downvote':
                VotePost(post_id, (PMM.mode === 'upvote' ? 1 : (PMM.mode === 'downvote' ? -1 : 0)));
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

//Render functions

function RenderPostModeMenuAddons() {
    let html = "";
    PMM.user_settings.available_modes.forEach((mode) => {
        if (mode === 'tag_script') return;
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
        let post_id = $link.closest("article").data("id");
        PMM.modified.add(post_id);
        if (PMM.mode === 'tag-script') {
            PMM.dragger.removeSelectables($link.find('img'), true);
        }
        MenuFunctions([post_id]);
        event.preventDefault();
        event.stopImmediatePropagation();
    }
}

function ChangeModeMenu() {
    PMM.mode = $("#mode-box select").val();
    if (PMM.available_modes.has(PMM.mode)) {
        JSPLib.storage.setStorageData('pmm-mode', PMM.mode, localStorage);
    } else {
        JSPLib.storage.removeStorageData('pmm-mode', localStorage);
    }
    $('.pmm-selected').removeClass('pmm-selected');
    PMM.modified.clear();
    UpdateDraggerStatus();
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
    PMM.init_timer = setTimeout(() => {
        PMM.dragger.SelectableSet._initElements = [...document.querySelectorAll('.post-preview img')];
        PMM.dragger.SelectableSet.clear();
        PMM.dragger.SelectedSet.clear();
        PMM.dragger.setSelectables(document.querySelectorAll('.post-preview img'));
        PMM.init_timer = null;
    }, 1000);
}

function DragSelectCallback({items}) {
    if (!PMM.available_modes.has(PMM.mode)) return;
    JSPLib.debug.debuglog('DragSelectCallback', items);
    let click_coords = PMM.dragger.getInitialCursorPosition();
    let mouseup_coords = PMM.dragger.getCurrentCursorPosition();
    if (mouseup_coords.x === click_coords.x && mouseup_coords.y === click_coords.y) {
        JSPLib.debug.debuglog("Drag callback: click.");
        return;
    }
    if (items.length === 1) {
        let box = JSPLib.utility.getElemPosition(items[0]);
        box.bottom = box.top + items[0].offsetHeight;
        box.right = box.left + items[0].offsetWidth;
        if (CoordinateInBox(click_coords, box) && CoordinateInBox(mouseup_coords, box)) {
            JSPLib.debug.debuglog("Drag callback: click-in-element.");
            return;
        }
    }
    let articles = items.map((entry) => $(entry).closest('article').get(0));
    let post_ids = articles.map((entry) => $(entry).data('id'));
    $(articles).addClass('pmm-selected');
    post_ids.forEach(PMM.modified.add, PMM.modified);
    MenuFunctions(post_ids);
    document.getSelection().removeAllRanges();
}

//Settings functions

function InitializeProgramValues() {
    Object.assign(PMM, {
        mode: JSPLib.storage.getStorageData('pmm-mode', localStorage),
        available_modes: new Set(PMM.user_settings.available_modes.map((mode) => JSPLib.utility.kebabCase(mode.toLocaleLowerCase()))),
        id_separator: SEPARATOR_DICT[PMM.user_settings.id_separator[0]],
    });
    if (PMM.user_settings.drag_select_enabled) {
        PMM.dragger = new DragSelect({
            selectables: GetAllPreviews(),
            area: document.querySelector('#posts'),
            draggability: false,
            immediateDrag: false
        });
    }
    JSPLib.danbooru.max_network_requests = PMM.user_settings.maximum_concurrent_requests;
    return true;
}

function RenderSettingsMenu() {
    $('#post-mode-menu').append(JSPLib.menu.renderMenuFramework(MENU_CONFIG));
    $('#pmm-general-settings').append(JSPLib.menu.renderDomainSelectors());
    $('#pmm-mode-settings').append(JSPLib.menu.renderInputSelectors('available_modes', 'checkbox'));
    $("#pmm-network-settings").append(JSPLib.menu.renderTextinput('maximum_concurrent_requests', 10));
    $('#pmm-select-settings').append(JSPLib.menu.renderInputSelectors('id_separator', 'radio'));
    $('#pmm-select-settings').append(JSPLib.menu.renderCheckbox('drag_select_enabled'));
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
    $("#mode-box select option[value=tag-script]").after(RenderPostModeMenuAddons());
    $(".post-preview a.post-preview-link").on(PROGRAM_CLICK, PostModeMenu);
    $("#mode-box select").on("change.pmm", ChangeModeMenu);
    $(document).on('danbooru:post-preview-updated.pmm', PostPreviewUpdated);
    PMM.dragger.subscribe('callback', DragSelectCallback);
    UpdateDraggerStatus();
    if (PMM.mode) {
        setTimeout(() => {$("#mode-box select").val(PMM.mode);}, JSPLib.utility.one_second);
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
