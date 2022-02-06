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

JSPLib.notice.program_shortcut = null;
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

JSPLib.notice.notice = function (...args) {
    if (this.danbooru_installed) {
        JSPLib._Danbooru.Utility.notice(...args);
    } else {
        this._notice(...args);
    }
};

JSPLib.notice.error = function (...args) {
    if (this.danbooru_installed) {
        JSPLib._Danbooru.Utility.error(...args);
    } else {
        this._error(...args);
    }
};

JSPLib.notice.closeNotice = function (event) {
    let context = this;
    return function (event) {
        JSPLib._jQuery(`#${context.program_shortcut}-notice`).fadeOut('fast').children('span').html(".");
        event.preventDefault();
    }
};

JSPLib.notice.installBanner = function (program_shortcut) {
    this.program_shortcut = program_shortcut;
    let notice_banner = `<div id="${program_shortcut}-notice"><span>.</span><a href="#" id="${program_shortcut}-close-notice-link">close</a></div>`;
    let css_shortcuts = this.notice_css.match(/%s/g).length;
    let notice_css = JSPLib.utility.sprintf(this.notice_css, ...Array(css_shortcuts).fill(program_shortcut));
    JSPLib.utility.setCSSStyle(notice_css, 'JSPLib.notice');
    JSPLib._jQuery('body').append(notice_banner);
    JSPLib._jQuery(`#${program_shortcut}-close-notice-link`).on(`click.${program_shortcut}`, this.closeNotice());
    this.banner_installed = true;
};

//Debug functions

JSPLib.notice.debugNotice = function(...args) {
    this._noticeOutput(this.notice,...args);
};

JSPLib.notice.debugError = function(...args) {
    this._noticeOutput(this.error,...args);
};

JSPLib.notice.debugNoticeLevel = function(...args) {
    this._noticeOutputLevel(this.notice,...args);
};

JSPLib.notice.debugErrorLevel = function(...args) {
    this._noticeOutputLevel(this.error,...args);
};

/****PRIVATE DATA****/

//Functions

JSPLib.notice._noticeOutput = function (output_func, ...args) {
    if (JSPLib.debug.debug_console) {
        output_func.call(this,...args);
    }
};

JSPLib.notice._noticeOutputLevel = function (output_func, ...args) {
    let level = args.slice(-1)[0];
    if (Number.isInteger(level) && level >= JSPLib.debug.level) {
        this._noticeOutput(output_func,...args.slice(0,-1));
    }
};

JSPLib.notice._notice = function (msg,permanent=false,append=true) {
    this._processNotice('ui-state-highlight', 'ui-state-error', msg, append);
    let context = this;
    if (!permanent) {
        context.notice_timeout_id = setTimeout(function() {
            JSPLib._jQuery(`#${context.program_shortcut}-close-notice-link`).click();
            context.notice_timeout_id = undefined;
        }, 6000);
    }
};

JSPLib.notice._error = function (msg,append=true) {
    this._processNotice('ui-state-error', 'ui-state-highlight', msg, append);
};

JSPLib.notice._processNotice = function (add_class,remove_class,msg,append) {
    let $notice = JSPLib._jQuery(`#${this.program_shortcut}-notice`);
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

JSPLib.notice._is_danbooru_installed = function () {
    return typeof JSPLib._Danbooru.Utility === 'object' && typeof JSPLib._Danbooru.Utility.notice === 'function' && typeof JSPLib._Danbooru.Utility.error === 'function';
};

//Data

JSPLib.notice._danbooru_installed = false;

/****INITIALIZATION****/
Object.defineProperty(JSPLib.notice, 'danbooru_installed', {get: function(){return this._danbooru_installed || (this._danbooru_installed = this._is_danbooru_installed());}});

JSPLib.notice._configuration = {
    nonenumerable: ['_notice','_error','_noticeOutput','_noticeOutputLevel','_processNotice','_is_danbooru_installed','_danbooru_installed','_configuration'],
    nonwritable: ['notice_css','_configuration']
};
JSPLib.initializeModule('notice');
