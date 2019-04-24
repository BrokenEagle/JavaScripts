/****DEPENDENCIES****/

/**External dependencies**/
// jQuery
// JSPLib.utility

/****SETUP****/

window.Danbooru = window.Danbooru || {};
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

Danbooru.Utility.notice = function(msg, permanent) {
    jQuery(`#${Danbooru.Utility.program_shortcut}-notice`).addClass("ui-state-highlight").removeClass("ui-state-error").fadeIn("fast").children("span").html(msg);
    if (Danbooru.Utility.notice_timeout_id !== undefined) {
        clearTimeout(Danbooru.Utility.notice_timeout_id);
    }
    if (!permanent) {
        Danbooru.Utility.notice_timeout_id = setTimeout(function() {
            jQuery(`#${Danbooru.Utility.program_shortcut}-close-notice-link`).click();
            Danbooru.Utility.notice_timeout_id = undefined;
        }, 6000);
    }
};

Danbooru.Utility.error = function(msg) {
    jQuery(`#${Danbooru.Utility.program_shortcut}-notice`).removeClass("ui-state-highlight").addClass("ui-state-error").fadeIn("fast").children("span").html(msg);
    if (Danbooru.Utility.notice_timeout_id !== undefined) {
        clearTimeout(Danbooru.Utility.notice_timeout_id);
    }
};

Danbooru.Utility.closeNotice = function (event) {
    jQuery(`#${Danbooru.Utility.program_shortcut}-notice`).fadeOut("fast");
    event.preventDefault();
};

Danbooru.Utility.installBanner = function (program_shortcut) {
    Danbooru.Utility.program_shortcut = program_shortcut;
    let notice_banner = `<div id="${program_shortcut}-notice"><span>.</span><a href="#" id="${program_shortcut}-close-notice-link">close</a></div>`;
    let css_shortcuts = Danbooru.Utility.notice_css.match(/%s/g).length;
    let notice_css = JSPLib.utility.sprintf(Danbooru.Utility.notice_css,...Array(css_shortcuts).fill(program_shortcut));
    JSPLib.utility.setCSSStyle(notice_css,'notice');
    jQuery("body").append(notice_banner);
    jQuery(`#${program_shortcut}-close-notice-link`).on(`click.${program_shortcut}`,Danbooru.Utility.closeNotice);
};
