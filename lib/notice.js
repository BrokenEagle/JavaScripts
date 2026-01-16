/****DEPENDENCIES****/

/**External dependencies**/
// jQuery

/**Internal dependencies**/
// JSPLib.debug
// JSPLib.utility

/****SETUP****/

//Linter configuration
/* global JSPLib */

JSPLib.notice = {};

/****GLOBAL VARIABLES****/

JSPLib.notice.banner_installed = false;

JSPLib.notice.notice_css = `
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
}
#%s-close-notice-link {
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

JSPLib.notice.notice = function (message, {permanent = false, append = false} = {}) {
    if (this.danbooru_notice_installed && !this.banner_installed) {
        JSPLib._Danbooru.Utility.notice(message);
    } else {
        this._notice(message, permanent, append);
    }
};

JSPLib.notice.error = function (message, {append = false} = {}) {
    if (this.danbooru_notice_installed && !this.banner_installed) {
        JSPLib._Danbooru.Utility.error(message);
    } else {
        this._error(message, append);
    }
};

JSPLib.notice.close = function () {
    if (this.danbooru_notice_installed && !this.banner_installed) {
        JSPLib.notice._closeNoticeClick();
    } else {
        JSPLib._document.getElementById('close-notice-link')?.click();
    }
};

JSPLib.notice.installBanner = function () {
    let notice_banner = `<div id="${JSPLib.program_shortcut}-notice"><span>.</span><a id="${JSPLib.program_shortcut}-close-notice-link">close</a></div>`;
    let css_shortcuts = this.notice_css.match(/%s/g).length;
    let notice_css = JSPLib.utility.sprintf(this.notice_css, ...Array(css_shortcuts).fill(JSPLib.program_shortcut));
    JSPLib.utility.setCSSStyle(notice_css, 'JSPLib.notice');
    JSPLib._jQuery('body').append(notice_banner);
    JSPLib._jQuery(`#${JSPLib.program_shortcut}-close-notice-link`).on(JSPLib.program_click, JSPLib.notice._closeNoticeClick);
    this.banner_installed = true;
};

//Debug functions

JSPLib.notice.debugNotice = function (...args) {
    this._noticeOutput(this.notice, args);
};

JSPLib.notice.debugError = function (...args) {
    this._noticeOutput(this.error, args);
};

JSPLib.notice.debugNoticeLevel = function (...args) {
    this._noticeOutputLevel(this.notice, args);
};

JSPLib.notice.debugErrorLevel = function (...args) {
    this._noticeOutputLevel(this.error, args);
};

/****PRIVATE DATA****/

//Functions

JSPLib.notice._closeNoticeClick = function () {
    JSPLib._jQuery(`#${JSPLib.program_shortcut}-notice`).fadeOut('fast').children('span').html(".");
};

JSPLib.notice._noticeOutput = function (output_func, args) {
    if (JSPLib.debug.mode) {
        output_func.call(this, ...args);
    }
};

JSPLib.notice._noticeOutputLevel = function (output_func, args) {
    if (JSPLib.debug.mode) {
        let level = args.at(-1);
        if (Number.isInteger(level) && level >= JSPLib.debug.level) {
            output_func.call(this, ...args.slice(0, -1));
        }
    }
};

JSPLib.notice._notice = function (msg, permanent = false, append = true) {
    this._processNotice('ui-state-highlight', 'ui-state-error', msg, append);
    let context = this;
    if (!permanent) {
        context.notice_timeout_id = setTimeout(() => {
            JSPLib._jQuery(`#${JSPLib.program_shortcut}-close-notice-link`).click();
            context.notice_timeout_id = undefined;
        }, 6000);
    }
};

JSPLib.notice._error = function (msg, append = true) {
    this._processNotice('ui-state-error', 'ui-state-highlight', msg, append);
};

JSPLib.notice._processNotice = function (add_class, remove_class, msg, append) {
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
    if (this.notice_timeout_id !== undefined) {
        clearTimeout(this.notice_timeout_id);
    }
};

JSPLib.notice._is_danbooru_notice_installed = function () {
    return typeof JSPLib._Danbooru.Utility === 'object' && typeof JSPLib._Danbooru.Utility.notice === 'function' && typeof JSPLib._Danbooru.Utility.error === 'function';
};

//Data

JSPLib.notice._danbooru_notice_installed = false;

/****INITIALIZATION****/
Object.defineProperty(JSPLib.notice, 'danbooru_notice_installed', {get() {return this._danbooru_notice_installed || (this._danbooru_notice_installed = this._is_danbooru_notice_installed());}});

JSPLib.notice._configuration = {
    nonenumerable: [],
    nonwritable: ['notice_css']
};
JSPLib.initializeModule('notice');
