// ==UserScript==
// @name         SiteTagSearches
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      5.4
// @description  Presents additional site links for the wiki tag(s).
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        *://*.donmai.us/posts?*
// @match        *://*.donmai.us/wiki_pages/*
// @match        *://*.donmai.us/settings
// @exclude      /^https?://\w+\.donmai\.us/.*\.(xml|json|atom)(\?|$)/
// @grant        none
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/SiteTagSearches.user.js
// @updateURL    https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/SiteTagSearches.user.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251218/lib/module.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251218/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251218/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251218/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251218/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251218/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20251218/lib/menu.js
// ==/UserScript==

/* global $ JSPLib */

/****Library updates****/

////NONE

/****Global variables****/

//Exterior script variables
const DANBOORU_TOPIC_ID = '14958';

//Variables for load.js
const PROGRAM_LOAD_REQUIRED_VARIABLES = ['window.jQuery'];
const PROGRAM_LOAD_OPTIONAL_SELECTORS = ['#c-wiki-pages #a-show', '#c-posts #a-index', '#c-users #a-edit'];

//Program name constants
const PROGRAM_SHORTCUT = 'sts';
const PROGRAM_NAME = 'SiteTagSearches';

//Main program variable
const STS = {};

//Setting values
const BOORU_SITES = ['gelbooru', 'yandere', 'sankaku', 'konachan'];
const SOURCE_SITES = ['pixiv', 'twitter', 'tumblr', 'deviantart', 'E-Hentai', 'nijie', 'artstation', 'fanbox', 'naver', 'lofter', 'skeb', 'tinami'];

const CUSTOM_SITES_TOTAL = JSPLib.storage.checkLocalData('sts-custom-sites-total', {
    default_val: 5,
    validator: (_, num) => (Number.isInteger(num) && num >= 1 && num <= 20),
});

//Main settings
const SETTINGS_CONFIG = {
    booru_sites_enabled: {
        allitems: BOORU_SITES,
        reset: BOORU_SITES,
        validate: (data) => JSPLib.menu.validateCheckboxRadio(data, 'checkbox', BOORU_SITES),
        hint: "Select to show booru type."
    },
    booru_sites_order: {
        allitems: BOORU_SITES,
        reset: BOORU_SITES,
        sortvalue: true,
        validate: (data) => JSPLib.utility.arrayEquals(data, BOORU_SITES),
        hint: "Set the order for how the booru sites appear in the tag popup."
    },
    source_sites_enabled: {
        allitems: SOURCE_SITES,
        reset: SOURCE_SITES,
        validate: (data) => JSPLib.menu.validateCheckboxRadio(data, 'checkbox', SOURCE_SITES),
        hint: "Select to show source type."
    },
    source_sites_order: {
        allitems: SOURCE_SITES,
        reset: SOURCE_SITES,
        sortvalue: true,
        validate: (data) => JSPLib.utility.arrayEquals(data, SOURCE_SITES),
        hint: "Set the order for how the source sites appear in the tag and other names popups."
    },
};

for (let index = 1; index <= CUSTOM_SITES_TOTAL; index++) {
    Object.assign(SETTINGS_CONFIG, {
        [`custom_site_${index}_enabled`]: {
            reset: false,
            validate: JSPLib.utility.isBoolean,
            hint: `Enable custom site ${index}.`
        },
        [`custom_site_${index}_url`]: {
            reset: "",
            parse: String,
            validate: JSPLib.utility.isString,
            hint: `Tag URL for custom site ${index}.`
        },
        [`custom_site_${index}_name`]: {
            reset: "",
            parse: String,
            validate: JSPLib.utility.isString,
            hint: `Entry name for custom site ${index}.`
        },
        [`custom_site_${index}_icon`]: {
            reset: "",
            parse: String,
            validate: JSPLib.utility.isString,
            hint: `Icon URL for custom site ${index}. (optional)`
        }
    });
}

const MENU_CONFIG = {
    topic_id: DANBOORU_TOPIC_ID,
    settings: [{
        name: 'general',
    }, {
        name: 'source',
    }, {
        name: 'custom',
        message: "Additional sites that can be setup for the right-hand popup for both the main tags and the other names. They will always appear below the regular sites and according to their number.",
    }],
    controls: [],
};

//CSS constants

const PROGRAM_CSS = `
.sts-tag {
    border: 1px solid var(--default-border-color);
    padding: 2px 5px;
    display: flex;
    position: relative;
    text-align: center;
}
.sts-tag-text {
    display: inline-block;
    width: 100%;
    text-align: center;
}
.sts-links {
    position: absolute;
    background-color: var(--body-background-color);
    border: 1px solid var(--post-tooltip-border-color);
    display: none;
    z-index: 1;
    left: 50%;
    transform: translate(-50%);
}
.sts-links[data-type="source"] {
    top: 1.55em;
}
.sts-links[data-type="booru"] {
    bottom: 1.55em;
}
.sts-links ul.sts-link-list {
    padding: 5px;
    margin: 0;
}
.sts-links ul.sts-link-list li.sts-link {
    list-style-type: none;
    white-space: nowrap;
}
/*JQUERY-UI*/
.ui-icon {
    display: inline-block;
    height: 16px;
    width: 16px;
}
.ui-icon-triangle-1-e {
    background-position: -32px -14px;
}
.ui-icon-triangle-1-w {
    background-position: -100px -14px;
}
.ui-icon-triangle-1-n {
    background-position: -2px -14px;
}
.ui-icon-triangle-1-s {
    background-position: -64px -14px;
}`;

const MENU_CSS = `
.sts-selectors.jsplib-selectors label {
    width: 120px;
}`;

//HTML constants

const CUSTOM_SITE_URL_DETAILS = `
<p>Site URL format needs to include a <code>%s</code> where the tag should go.</p>
<p>For instance, the site URL for Pixiv is the following:</p>
<p><code>https://www.pixiv.net/en/tags/%s/artworks</code></p>`;

const CUSTOM_SITE_CONFIGURATION_DETAILS = `
<p>The total number of custom sites available can be altered by setting the <b>localStorage</b> variable <code>sts-custom-sites-total</code> in the dev console (<b>F12</b>).</p>
<p><pre>localStorage['sts-custom-sites-total'] = 10;</pre></p>
<p>The default value is 5; the minimum value is 1; the maximum value is 20.</p>`;

const NO_ICON = '<div style="height: 15px; width: 15px; margin-right: 0.5em;"></div>';

//Site constants

const SITE_CONFIG = {
    pixiv: {
        url: 'https://www.pixiv.net/en/tags/%s/artworks',
        icon: 'https://www.pixiv.net/favicon.ico',
    },
    fanbox: {
        url: 'https://www.fanbox.cc/tags/%s',
        icon: 'https://www.fanbox.cc/favicon.ico',
    },
    nijie: {
        url: 'https://nijie.info/search.php?word=%s',
        icon: 'https://nijie.info/icon/favicon.ico',
    },
    tinami: {
        url: 'https://www.tinami.com/search/list?keyword=%s',
        icon: 'https://www.tinami.com/favicon.ico',
    },
    deviantart: {
        url: 'https://www.deviantart.com/tag/%s',
        icon: 'https://www.deviantart.com/favicon.ico',
    },
    artstation: {
        url: 'https://www.artstation.com/search?q=%s',
        icon: 'https://www.artstation.com/favicon.ico',
    },
    tumblr: {
        url: 'https://www.tumblr.com/tagged/%s',
        icon: 'https://www.tumblr.com/favicon.ico',
    },
    twitter: {
        url: 'https://x.com/hashtag/%s?src=hashtag_click&f=live',
        icon: 'https://abs.twimg.com/favicons/twitter.2.ico',
    },
    'E-Hentai': {
        url: 'https://e-hentai.org/?f_search=%s',
        icon: 'https://e-hentai.org/favicon.ico',
    },
    naver: {
        url: 'https://section.blog.naver.com/Search/Post.naver?keyword=%s',
        icon: 'https://section.blog.naver.com/favicon.ico',
    },
    lofter: {
        url: 'https://www.lofter.com/tag/%s',
        icon: 'https://www.lofter.com/favicon.ico',
    },
    skeb: {
        url: 'https://skeb.jp/search?q=%s',
        icon: 'https://fcdn.skeb.jp/assets/v1/commons/favicon.ico',
    },
    gelbooru: {
        url: 'https://gelbooru.com/index.php?page=post&s=list&tags=%s',
        icon: 'https://gelbooru.com/favicon.ico',
    },
    yandere: {
        url: 'https://yande.re/post?tags=%s',
        icon: 'https://yande.re/favicon.ico',
    },
    sankaku: {
        url: 'https://chan.sankakucomplex.com/?tags=%s',
        icon: 'https://chan.sankakucomplex.com/favicon.ico',
    },
    konachan: {
        url: 'https://konachan.com/post?tags=%s',
        icon: 'https://konachan.com/favicon.ico',
    },
};

/***Functions***/

//Helper functions

function GetWikiName() {
    if (STS.controller === 'posts') {
        let wiki_name = "";
        let url = $('#show-excerpt-link').attr('href');
        let match = url.match(/^\/wiki_pages\/([^/]+)/);
        if (match) {
            wiki_name = match[1];
        }
        return decodeURIComponent(wiki_name);
    }
    if (STS.controller === 'wiki-pages') {
        return $('#wiki-page-title a').html().replace(/ /g, '_');
    }
}

function AnySiteEnabled(type) {
    return Boolean(STS.user_settings[`${type}_sites_enabled`].length);
}

function IsSiteEnabled(site, type) {
    return STS.user_settings[`${type}_sites_enabled`].includes(site);
}

function GetCustomSetting(setting, index) {
    return STS.user_settings[`custom_site_${index}_${setting}`];
}

//Render functions

function RenderSiteLinks(type, searchtag, num) {
    let site_list = STS.user_settings[`${type}_sites_order`].map((site) => {
        if (!IsSiteEnabled(site, type)) return;
        let url = JSPLib.utility.sprintf(SITE_CONFIG[site].url, searchtag);
        let display_name = JSPLib.utility.displayCase(site);
        let icon = (SITE_CONFIG[site].icon ? `<img style="height: 15px; width: 15px; margin-right: 0.5em;" src="${SITE_CONFIG[site].icon}">` : NO_ICON);
        return `<li class="sts-link"><a target="_blank" href="${url}" style="display: flex; align-items: center;">${icon} ${display_name}</a></li>`;
    });
    if (type === 'source') {
        for (let index = 1; index <= CUSTOM_SITES_TOTAL; index++) {
            if (!GetCustomSetting('enabled', index)) continue;
            let template_url = GetCustomSetting('url', index);
            if (template_url.length === 0) continue;
            let url = JSPLib.utility.sprintf(template_url, searchtag);
            let name = GetCustomSetting('name', index);
            let display_name = (name.length ? JSPLib.utility.displayCase(name) : "Custom #" + index);
            let icon_url = GetCustomSetting('icon', index);
            let icon = (icon_url.length ? `<img style="height: 15px; width: 15px; margin-right: 0.5em;" src="${icon_url}">` : NO_ICON);
            site_list.push(`<li class="sts-link"><a target="_blank" href="${url}" style="display: flex; align-items: center;">${icon} ${display_name}</a></li>`);
        }
    }
    return `
<div class="sts-links" data-type="${type}" data-id="${num}">
    <ul class="sts-link-list">
        ${site_list.join('')}
    </ul>
</div>`;
}

function RenderSiteToggle(type, num, direction) {
    if (AnySiteEnabled(type)) {
        return `<a class="ui-icon sts-collapsible-links ui-icon-triangle-1-${direction}" data-type="${type}" data-id="${num}"></a>`;
    }
    return "";
}

function RenderTranslatedTags(tag_name, num) {
    let rendered_source_tags = RenderSiteLinks('source', encodeURIComponent(tag_name), num);
    let source_toggle = RenderSiteToggle('source', num, 'e');
    return `
<div class="sts-tag">
    <span class="sts-tag-text">${tag_name}</span>
    ${source_toggle}
    ${rendered_source_tags}
</div>`;
}

function RenderMainTag() {
    let tag_name = GetWikiName();
    let rendered_source_tags = RenderSiteLinks('source', encodeURIComponent(tag_name), 0);
    let rendered_booru_tags = RenderSiteLinks('booru', tag_name, 'a');
    let source_toggle = RenderSiteToggle('source', 0, 'e');
    let booru_toggle = RenderSiteToggle('booru', 'a', 'w');
    return `
<div class="wiki-other-name sts-tag">
    ${booru_toggle}
    <span class="sts-tag-text">${tag_name}</span>
    ${source_toggle}
    ${rendered_booru_tags}
    ${rendered_source_tags}
</div>`;
}

//Event handlers

function SiteLinkToggle(close_direction, open_direction) {
    return function (event) {
        let id = $(event.target).data('id');
        let type = $(event.target).data('type');
        $(`.sts-collapsible-links[data-type=${type}][data-id=${id}]`).toggleClass(`ui-icon-triangle-1-${close_direction} ui-icon-triangle-1-${open_direction}`);
        $(`.sts-links[data-type=${type}][data-id=${id}]`).slideToggle(250);
    };
}

//Settings functions

function InitializeProgramValues() {
    Object.assign(STS, {
        is_wiki_page: (STS.controller === 'wiki-pages') || ((STS.controller === 'posts') && document.querySelector('.wiki-excerpt-link') !== null),
    });
    if (!STS.is_wiki_page) {
        JSPLib.debug.debuglog("No wiki page bodies!");
        return false;
    }
    return true;
}

function RenderSettingsMenu() {
    $('#site-tag-searches').append(JSPLib.menu.renderMenuFramework(MENU_CONFIG));
    $('#sts-general-settings').append(JSPLib.menu.renderDomainSelectors());
    $('#sts-source-settings').append(JSPLib.menu.renderInputSelectors('booru_sites_enabled', 'checkbox'));
    $('#sts-source-settings').append(JSPLib.menu.renderSortlist('booru_sites_order'));
    $('#sts-source-settings').append(JSPLib.menu.renderInputSelectors('source_sites_enabled', 'checkbox'));
    $('#sts-source-settings').append(JSPLib.menu.renderSortlist('source_sites_order'));
    $('#sts-custom-settings-message').append(JSPLib.menu.renderExpandable("Custom site configuration", CUSTOM_SITE_CONFIGURATION_DETAILS));
    $('#sts-custom-settings-message').append(JSPLib.menu.renderExpandable("Site URL format", CUSTOM_SITE_URL_DETAILS));
    for (let index = 1; index <= CUSTOM_SITES_TOTAL; index++) {
        $('#sts-custom-settings').append(JSPLib.menu.renderCheckbox(`custom_site_${index}_enabled`));
        let custom_id = 'sts-custom-setting-' + index;
        let custom_selector = '#' + custom_id;
        let custom_show = (GetCustomSetting('enabled', index) ? "" : 'display: none;');
        $('#sts-custom-settings').append(`<div id="${custom_id}" style="${custom_show}"></div>`);
        $(custom_selector).append(JSPLib.menu.renderTextinput(`custom_site_${index}_name`, 10));
        $(custom_selector).append(JSPLib.menu.renderTextinput(`custom_site_${index}_url`, 80));
        $(custom_selector).append(JSPLib.menu.renderTextinput(`custom_site_${index}_icon`, 80));
        $(`#sts-enable-custom-site-${index}-enabled`).on('change.sts', (event) => {
            if (event.target.checked) {
                $(custom_selector).show();
            } else {
                $(custom_selector).hide();
            }
        });
    }
    JSPLib.menu.engageUI(true, true);
    JSPLib.menu.expandableClick();
    JSPLib.menu.saveUserSettingsClick();
    JSPLib.menu.resetUserSettingsClick();
}

//Main function

function Main() {
    const preload = {
        run_on_settings: false,
        initialize_func: InitializeProgramValues,
        render_menu_func: RenderSettingsMenu,
        program_css: PROGRAM_CSS,
        menu_css: MENU_CSS,
    };
    if (!JSPLib.menu.preloadScript(STS, preload)) return;
    let $wiki_other_names = $('.wiki-other-name');
    if ($wiki_other_names.length) {
        let $wiki_container = $wiki_other_names.parent();
        $wiki_other_names.each((i, entry) => {
            entry.outerHTML = RenderTranslatedTags(entry.innerText, i + 1);
        });
        $wiki_container.prepend(RenderMainTag());
    } else {
        let $elem = $('<p class="flex"></p>').prepend(RenderMainTag());
        $('#wiki-page-body, #c-posts #a-index .prose').prepend($elem);
    }
    $('.sts-collapsible-links[data-type=source]').on(JSPLib.program_click, SiteLinkToggle('e', 's'));
    $('.sts-collapsible-links[data-type=booru]').on(JSPLib.program_click, SiteLinkToggle('w', 'n'));
}

/****Initialization****/

//Variables for JSPLib

JSPLib.program_name = PROGRAM_NAME;
JSPLib.program_shortcut = PROGRAM_SHORTCUT;
JSPLib.program_data = STS;

//Variables for debug.js
JSPLib.debug.mode = false;
JSPLib.debug.level = JSPLib.debug.INFO;

//Variables for menu.js
JSPLib.menu.settings_config = SETTINGS_CONFIG;

//Export JSPLib
JSPLib.load.exportData();

/****Execution start****/

JSPLib.load.programInitialize(Main, {required_variables: PROGRAM_LOAD_REQUIRED_VARIABLES, optional_selectors: PROGRAM_LOAD_OPTIONAL_SELECTORS});
