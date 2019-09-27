/****DEPENDENCIES****/

/**External dependencies**/
// jQuery
// JSPLib.utility

/****SETUP****/

//Linter configuration
/* global JSPLib Danbooru jQuery */

var Danbooru = Danbooru || {};
Danbooru.Utility = Danbooru.Utility || {};

/****GLOBAL VARIABLES****/

Danbooru.Utility.program_shortcut = null;

Danbooru.Utility.notice_css = `
#%s-notice {
    padding: .25em;
    position: fixed;
    top: 4em;
    left: 25%;
    width: 50%;
    z-index: 1002;
    display: none;
}
#%s-close-notice-link {
    right: 1em;
    position: absolute;
}
#%s-close-notice-link,
#%s-close-notice-link:hover {
    color: #0073ff;
}
`;

/****FUNCTIONS****/

Danbooru.Utility.notice = function(msg,permanent,append=true) {
    Danbooru.Utility._processNotice('ui-state-highlight', 'ui-state-error', msg, append);
    if (!permanent) {
        Danbooru.Utility.notice_timeout_id = setTimeout(function() {
            jQuery(`#${Danbooru.Utility.program_shortcut}-close-notice-link`).click();
            Danbooru.Utility.notice_timeout_id = undefined;
        }, 6000);
    }
};

Danbooru.Utility.error = function(msg,append=true) {
    Danbooru.Utility._processNotice('ui-state-error', 'ui-state-highlight', msg, append);
};

Danbooru.Utility.closeNotice = function (event) {
    jQuery(`#${Danbooru.Utility.program_shortcut}-notice`).fadeOut('fast').children('span').html(".");
    event.preventDefault();
};

Danbooru.Utility.installBanner = function (program_shortcut) {
    Danbooru.Utility.program_shortcut = program_shortcut;
    let notice_banner = `<div id="${program_shortcut}-notice"><span>.</span><a href="#" id="${program_shortcut}-close-notice-link">close</a></div>`;
    let css_shortcuts = Danbooru.Utility.notice_css.match(/%s/g).length;
    let notice_css = JSPLib.utility.sprintf(Danbooru.Utility.notice_css, ...Array(css_shortcuts).fill(program_shortcut));
    JSPLib.utility.setCSSStyle(notice_css, 'Danbooru.Utility.notice');
    jQuery('body').append(notice_banner);
    jQuery(`#${program_shortcut}-close-notice-link`).on(`click.${program_shortcut}`, Danbooru.Utility.closeNotice);
};

/****PRIVATE DATA****/

//Functions

Danbooru.Utility._processNotice = function(add_class,remove_class,msg,append) {
    let $notice = jQuery(`#${Danbooru.Utility.program_shortcut}-notice`);
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
    if (Danbooru.Utility.notice_timeout_id !== undefined) {
        clearTimeout(Danbooru.Utility.notice_timeout_id);
    }
};

/****INITIALIZATION****/

Danbooru.Utility._configuration = {
    nonenumerable: ['_processNotice','_configuration'],
    nonwritable: ['_configuration']
};
Object.defineProperty(Danbooru,'Utility',{configurable:false,writable:false});
for (let property in Danbooru.Utility) {
    if (Danbooru.Utility._configuration.nonenumerable.includes(property)) {
        Object.defineProperty(Danbooru.Utility,property,{enumerable:false});
    }
    if (Danbooru.Utility._configuration.nonwritable.includes(property)) {
        Object.defineProperty(Danbooru.Utility,property,{writable:false});
    }
    Object.defineProperty(Danbooru.Utility,property,{configurable:false});
}
