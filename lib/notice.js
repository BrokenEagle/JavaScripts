/****DEPENDENCIES****/

/**External dependencies**/
// jQuery

/**Internal dependencies**/
// JSPLib.Debug (optional)
// JSPLib.Utility

/****SETUP****/

//Linter configuration
/* global JSPLib */

(function (Debug, Utility) {

const Notice = JSPLib.Notice;

/****GLOBAL VARIABLES****/

Notice.notice_duration = Utility.one_second * 6;

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

Notice.notice = function (message, {permanent = false, append = false} = {}) {
    if (BANNER_INSTALLED) {
        _notice(message, permanent, append);
    } else if (Notice.danbooru_notice_installed && !BANNER_INSTALLED) {
        JSPLib._Danbooru.Utility.notice(message);
    }
};

Notice.error = function (message, {append = false} = {}) {
    if (BANNER_INSTALLED) {
        _error(message, append);
    } else if (Notice.danbooru_notice_installed) {
        JSPLib._Danbooru.Utility.error(message);
    }
};

Notice.close = function () {
    if (BANNER_INSTALLED) {
        _closeNoticeClick();
    }
    else if (Notice.danbooru_notice_installed) {
        JSPLib._document.getElementById('close-notice-link')?.click();
    }
};

Notice.installBanner = function () {
    let notice_banner = `<div id="${JSPLib.program_shortcut}-notice"><span>.</span><a id="${JSPLib.program_shortcut}-close-notice-link">close</a></div>`;
    let css_shortcuts = NOTICE_CSS.match(/%s/g).length;
    let notice_css = Utility.sprintf(NOTICE_CSS, ...Array(css_shortcuts).fill(JSPLib.program_shortcut));
    Utility.setCSSStyle(notice_css, 'notice');
    JSPLib._jQuery('body').append(notice_banner);
    JSPLib._jQuery(`#${JSPLib.program_shortcut}-close-notice-link`).on(JSPLib.program_click, _closeNoticeClick);
    BANNER_INSTALLED = true;
};

//Debug functions

Notice.debugNotice = function (...args) {
    _noticeOutput(Notice.notice, args);
};

Notice.debugError = function (...args) {
    _noticeOutput(Notice.error, args);
};

Notice.debugNoticeLevel = function (...args) {
    _noticeOutputLevel(Notice.notice, args);
};

Notice.debugErrorLevel = function (...args) {
    _noticeOutputLevel(Notice.error, args);
};

/****PRIVATE DATA****/

//Functions

function _closeNoticeClick() {
    JSPLib._jQuery(`#${JSPLib.program_shortcut}-notice`).fadeOut('fast').children('span').html(".");
}

function _noticeOutput(output_func, args) {
    Debug.execute(() => {
        output_func(...args);
    });
}

function _noticeOutputLevel(output_func, args) {
    let level = args.at(-1);
    Debug.execute(() => {
        output_func(...args.slice(0, -1));
    }, level);
}

function _notice(msg, permanent = false, append = true) {
    _processNotice('ui-state-highlight', 'ui-state-error', msg, append);
    if (!permanent) {
        Notice.notice_timeout_id = setTimeout(() => {
            JSPLib._jQuery(`#${JSPLib.program_shortcut}-close-notice-link`).click();
            Notice.notice_timeout_id = undefined;
        }, Notice.notice_duration);
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
    if (Notice.notice_timeout_id !== undefined) {
        clearTimeout(Notice.notice_timeout_id);
    }
}

//Data



/****INITIALIZATION****/
Object.defineProperty(Notice, 'danbooru_notice_installed', {
    get() {
        DANBOORU_NOTICE_INSTALLED ||= typeof JSPLib._Danbooru.Utility === 'object' && typeof JSPLib._Danbooru.Utility.notice === 'function' && typeof JSPLib._Danbooru.Utility.error === 'function';
        return DANBOORU_NOTICE_INSTALLED;
    },
});

JSPLib.initializeModule('Notice');

})(JSPLib.Debug, JSPLib.Utility);
