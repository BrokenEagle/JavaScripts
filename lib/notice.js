/****DEPENDENCIES****/

/**External dependencies**/
// jQuery

/**Internal dependencies**/
// JSPLib.debug
// JSPLib.utility

/****SETUP****/

//Linter configuration
/* global JSPLib */

(function (debug, utility) {

const notice = JSPLib.notice;

/****GLOBAL VARIABLES****/

notice.notice_duration = utility.one_second * 6;

/****PRIVATE VARIABLES****/

var BANNER_INSTALLED = false;
var DANBOORU_NOTICE_INSTALLED = false;

const NOTICE_CSS = `
#%s-notice {
    padding: .25em;
    position: fixed;
    top: 2em;
    left: 25%;
    width: 50%;
    z-index: 1050;
    display: none;
}
#%s-close-notice-link {
    right: 1em;
    bottom: 0;
    position: absolute;
    cursor: pointer;
}
#%s-close-notice-link,
#%s-close-notice-link:hover {
    color: #0073ff;
}
div#%s-notice.ui-state-highlight {
    color: #5f3f3f;
    background-color: #fffbbf;
    border: 1px solid #ccc999;
}
div#%s-notice.ui-state-error {
    color: #5f3f3f;
    background-color: #fddfde;
    border: 1px solid #fbc7c6;
}`;

/****FUNCTIONS****/

notice.notice = function (message, {permanent = false, append = false} = {}) {
    if (BANNER_INSTALLED) {
        _notice(message, permanent, append);
    } else if (notice.danbooru_notice_installed && !BANNER_INSTALLED) {
        JSPLib._Danbooru.Utility.notice(message);
    }
};

notice.error = function (message, {append = false} = {}) {
    if (BANNER_INSTALLED) {
        _error(message, append);
    } else if (notice.danbooru_notice_installed) {
        JSPLib._Danbooru.Utility.error(message);
    }
};

notice.close = function () {
    if (BANNER_INSTALLED) {
        _closeNoticeClick();
    }
    else if (notice.danbooru_notice_installed) {
        JSPLib._document.getElementById('close-notice-link')?.click();
    }
};

notice.installBanner = function () {
    let notice_banner = `<div id="${JSPLib.program_shortcut}-notice"><span>.</span><a id="${JSPLib.program_shortcut}-close-notice-link">close</a></div>`;
    let css_shortcuts = NOTICE_CSS.match(/%s/g).length;
    let notice_css = utility.sprintf(NOTICE_CSS, ...Array(css_shortcuts).fill(JSPLib.program_shortcut));
    utility.setCSSStyle(notice_css, 'notice');
    JSPLib._jQuery('body').append(notice_banner);
    JSPLib._jQuery(`#${JSPLib.program_shortcut}-close-notice-link`).on(JSPLib.program_click, _closeNoticeClick);
    BANNER_INSTALLED = true;
};

//Debug functions

notice.debugNotice = function (...args) {
    _noticeOutput(notice.notice, args);
};

notice.debugError = function (...args) {
    _noticeOutput(notice.error, args);
};

notice.debugNoticeLevel = function (...args) {
    _noticeOutputLevel(notice.notice, args);
};

notice.debugErrorLevel = function (...args) {
    _noticeOutputLevel(notice.error, args);
};

/****PRIVATE DATA****/

//Functions

function _closeNoticeClick() {
    JSPLib._jQuery(`#${JSPLib.program_shortcut}-notice`).fadeOut('fast').children('span').html(".");
}

function _noticeOutput(output_func, args) {
    if (debug.mode) {
        output_func(...args);
    }
}

function _noticeOutputLevel(output_func, args) {
    if (debug.mode) {
        let level = args.at(-1);
        if (Number.isInteger(level) && level >= debug.level) {
            output_func(...args.slice(0, -1));
        }
    }
}

function _notice(msg, permanent = false, append = true) {
    _processNotice('ui-state-highlight', 'ui-state-error', msg, append);
    if (!permanent) {
        notice.notice_timeout_id = setTimeout(() => {
            JSPLib._jQuery(`#${JSPLib.program_shortcut}-close-notice-link`).click();
            notice.notice_timeout_id = undefined;
        }, notice.notice_duration);
    }
}

function _error(msg, append = true) {
    _processNotice('ui-state-error', 'ui-state-highlight', msg, append);
}

function _processNotice(add_class, remove_class, msg, append) {
    let $notice = JSPLib._jQuery(`#${JSPLib.program_shortcut}-notice`);
    $notice.addClass(add_class).removeClass(remove_class).fadeIn('fast');
    if (append) {
        let current_message = $notice.children('span').html();
        if (current_message !== ".") {
            current_message += "<br>--------------------------------------------------<br>";
        } else {
            current_message = "";
        }
        $notice.children('span').html(current_message + msg);
    } else {
        $notice.children('span').html(msg);
    }
    if (notice.notice_timeout_id !== undefined) {
        clearTimeout(notice.notice_timeout_id);
    }
}

//Data



/****INITIALIZATION****/
Object.defineProperty(JSPLib.notice, 'danbooru_notice_installed', {
    get() {
        DANBOORU_NOTICE_INSTALLED ||= typeof JSPLib._Danbooru.Utility === 'object' && typeof JSPLib._Danbooru.Utility.notice === 'function' && typeof JSPLib._Danbooru.Utility.error === 'function';
        return DANBOORU_NOTICE_INSTALLED;
    },
});

JSPLib.initializeModule('notice');

})(JSPLib.debug, JSPLib.utility);
