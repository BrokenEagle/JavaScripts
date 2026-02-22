// ==UserScript==
// @name         SiteTagSearches
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      5.5
// @description  Presents additional site links for the wiki tag(s).
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        https://*.donmai.us/*
// @exclude      /^(?!https:\/\/\w+\.donmai\.us\/(posts|wiki_pages\/[^\/?]+|settings)?\/?(\?|$)).*/
// @exclude      /^https:\/\/\w+\.donmai\.us\/[^.]*\.(xml|json|atom)(\?|$)/
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/SiteTagSearches.user.js
// @updateURL    https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/SiteTagSearches.user.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/57229c06cc6314a770f055049d167505ea07885c/lib/module.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/57229c06cc6314a770f055049d167505ea07885c/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/57229c06cc6314a770f055049d167505ea07885c/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/57229c06cc6314a770f055049d167505ea07885c/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/57229c06cc6314a770f055049d167505ea07885c/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/57229c06cc6314a770f055049d167505ea07885c/lib/template.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/57229c06cc6314a770f055049d167505ea07885c/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/57229c06cc6314a770f055049d167505ea07885c/lib/menu.js
// ==/UserScript==

/* global $ JSPLib */

(({Debug, Utility, Storage, Template, Load, Menu}) => {

const PROGRAM_NAME = 'SiteTagSearches';
const PROGRAM_SHORTCUT = 'sts';
const DANBOORU_TOPIC_ID = 14958;

/****Library updates****/

////NONE

/****Global variables****/

//Module constants

const STS = {};

const LOAD_REQUIRED_VARIABLES = ['window.jQuery'];
const LOAD_OPTIONAL_SELECTORS = ['#c-wiki-pages #a-show', '#c-posts #a-index', '#c-users #a-edit'];

const BOORU_SITES = ['gelbooru', 'yandere', 'sankaku', 'konachan'];
const SOURCE_SITES = ['pixiv', 'twitter', 'tumblr', 'deviantart', 'E-Hentai', 'nijie', 'artstation', 'fanbox', 'naver', 'lofter', 'skeb', 'tinami'];

const SETTINGS_CONFIG = {
    booru_sites_enabled: {
        allitems: BOORU_SITES,
        get reset() {return this.allitems;},
        validate (data) {return Menu.validateCheckboxRadio(data, 'checkbox', this.allitems);},
        hint: "Select to show booru type."
    },
    booru_sites_order: {
        allitems: BOORU_SITES,
        get reset() {return this.allitems;},
        sortvalue: true,
        validate (data) {return Utility.arrayEquals(data, this.allitems);},
        hint: "Set the order for how the booru sites appear in the tag popup."
    },
    source_sites_enabled: {
        allitems: SOURCE_SITES,
        get reset() {return this.allitems;},
        validate (data) {return Menu.validateCheckboxRadio(data, 'checkbox', this.allitems);},
        hint: "Select to show source type."
    },
    source_sites_order: {
        allitems: SOURCE_SITES,
        get reset() {return this.allitems;},
        sortvalue: true,
        validate (data) {return Utility.arrayEquals(data, this.allitems);},
        hint: "Set the order for how the source sites appear in the tag and other names popups."
    },
};
const CUSTOM_SITES_TOTAL = Storage.checkLocalData('sts-custom-sites-total', {
    default_val: 5,
    validator: (_, num) => (Utility.isInteger(num) && num >= 1 && num <= 20),
});
for (let index = 1; index <= CUSTOM_SITES_TOTAL; index++) {
    Utility.assignObjects(SETTINGS_CONFIG, {
        [`custom_site_${index}_enabled`]: {
            reset: false,
            validate: Utility.isBoolean,
            hint: `Enable custom site ${index}.`
        },
        [`custom_site_${index}_url`]: {
            reset: "",
            parse: String,
            validate: Utility.isString,
            hint: `Tag URL for custom site ${index}.`
        },
        [`custom_site_${index}_name`]: {
            reset: "",
            parse: String,
            validate: Utility.isString,
            hint: `Entry name for custom site ${index}.`
        },
        [`custom_site_${index}_icon`]: {
            reset: "",
            parse: String,
            validate: Utility.isString,
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
};

//CSS constants

const PROGRAM_CSS = Template.normalizeCSS()`
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
.sts-selectors:not([data-setting="domain_selector"]) label {
    width: 120px;
}`;

//HTML constants

const CUSTOM_SITE_URL_DETAILS = Template.normalizeHTML()`
<p>Site URL format needs to include a <code>%s</code> where the tag should go.</p>
<p>For instance, the site URL for Pixiv is the following:</p>
<p><code>https://www.pixiv.net/en/tags/%s/artworks</code></p>`;

const CUSTOM_SITE_CONFIGURATION_DETAILS = Template.normalizeHTML()`
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

//Validate functions

function ValidateProgramData(key, entry) {
    const printer = Debug.getFunctionPrint('ValidateProgramData');
    var error_messages = [];
    switch (key) {
        case 'sts-user-settings':
            error_messages = Load.validateUserSettings(entry);
            break;
        case 'sts-custom-sites-total':
            if (!Utility.isInteger(entry) || entry < 1 || entry > 20) {
                error_messages = ['Must be an integer between 1 and 20.'];
            }
            break;
        default:
            error_messages = ["Is not exportable/importable."];
    }
    let $error_display = $('#sts-cache-editor-errors');
    if (error_messages.length) {
        let error_text = JSON.stringify(error_messages, null, 2);
        printer.logLevel(key, ':\r\n', error_text, Debug.INFO);
        $error_display.css('display', 'block').html(`<b>${key}:</b><br><pre>${error_text}</pre>`);
        return false;
    }
    $error_display.css('display', 'none');
    return true;
}

//Helper functions

function IsWikiPage() {
    let result = (STS.controller === 'wiki-pages') || ((STS.controller === 'posts') && document.querySelector('.wiki-excerpt-link') !== null);
    if (!result) {
        Debug.warn("No wiki page bodies!");
    }
    return result;
}

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
        let url = Utility.sprintf(SITE_CONFIG[site].url, searchtag);
        let display_name = Utility.displayCase(site);
        let icon = (SITE_CONFIG[site].icon ? `<img style="height: 15px; width: 15px; margin-right: 0.5em;" src="${SITE_CONFIG[site].icon}">` : NO_ICON);
        return `<li class="sts-link"><a target="_blank" href="${url}" style="display: flex; align-items: center;">${icon} ${display_name}</a></li>`;
    });
    if (type === 'source') {
        for (let index = 1; index <= CUSTOM_SITES_TOTAL; index++) {
            if (!GetCustomSetting('enabled', index)) continue;
            let template_url = GetCustomSetting('url', index);
            if (template_url.length === 0) continue;
            let url = Utility.sprintf(template_url, searchtag);
            let name = GetCustomSetting('name', index);
            let display_name = (name.length ? Utility.displayCase(name) : "Custom #" + index);
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

function RenderSettingsMenu() {
    $('#site-tag-searches').append(Menu.renderMenuFramework(MENU_CONFIG));
    $('#sts-general-settings').append(Menu.renderDomainSelectors());
    $('#sts-source-settings').append(Menu.renderInputSelectors('booru_sites_enabled', 'checkbox'));
    $('#sts-source-settings').append(Menu.renderSortlist('booru_sites_order'));
    $('#sts-source-settings').append(Menu.renderInputSelectors('source_sites_enabled', 'checkbox'));
    $('#sts-source-settings').append(Menu.renderSortlist('source_sites_order'));
    $('#sts-custom-settings-message').append(Menu.renderExpandable("Custom site configuration", CUSTOM_SITE_CONFIGURATION_DETAILS));
    $('#sts-custom-settings-message').append(Menu.renderExpandable("Site URL format", CUSTOM_SITE_URL_DETAILS));
    for (let index = 1; index <= CUSTOM_SITES_TOTAL; index++) {
        $('#sts-custom-settings').append(Menu.renderCheckbox(`custom_site_${index}_enabled`));
        let custom_id = 'sts-custom-setting-' + index;
        let custom_selector = '#' + custom_id;
        let custom_show = (GetCustomSetting('enabled', index) ? "" : 'display: none;');
        $('#sts-custom-settings').append(`<div id="${custom_id}" style="${custom_show}"></div>`);
        $(custom_selector).append(Menu.renderTextinput(`custom_site_${index}_name`, 10));
        $(custom_selector).append(Menu.renderTextinput(`custom_site_${index}_url`, 80));
        $(custom_selector).append(Menu.renderTextinput(`custom_site_${index}_icon`, 80));
        $(`#sts-enable-custom-site-${index}-enabled`).on('change.sts', (event) => {
            if (event.target.checked) {
                $(custom_selector).show();
            } else {
                $(custom_selector).hide();
            }
        });
    }
    $('#sts-controls').append(Menu.renderCacheEditor({name: 'Cache data'}));
    $('#sts-cache-editor-controls').append(Menu.renderLocalStorageSource());
    $('#sts-cache-editor-controls').append(Menu.renderRawData());
    Menu.engageUI({checkboxradio: true, sortable: true});
    Menu.expandableClick();
    Menu.getCacheClick();
    Menu.saveCacheClick();
    Menu.saveUserSettingsClick();
    Menu.resetUserSettingsClick();
}

//Main function

function Main() {
    Load.preloadScript({
        program_css: PROGRAM_CSS,
    });
    Menu.preloadMenu({
        menu_func: RenderSettingsMenu,
        menu_css: MENU_CSS,
    });
    if (!Load.isScriptEnabled() || Menu.isSettingsMenu() || !IsWikiPage()) return;
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
    $('.sts-collapsible-links[data-type=source]').on(JSPLib.event.click, SiteLinkToggle('e', 's'));
    $('.sts-collapsible-links[data-type=booru]').on(JSPLib.event.click, SiteLinkToggle('w', 'n'));
}

/****Initialization****/

JSPLib.data = STS;
JSPLib.name = PROGRAM_NAME;
JSPLib.shortcut = PROGRAM_SHORTCUT;
JSPLib.settings_config = SETTINGS_CONFIG;

Debug.mode = false;
Debug.level = Debug.INFO;

Storage.localSessionValidator = ValidateProgramData;

Load.exportData();

/****Execution start****/

Load.programInitialize(Main, {required_variables: LOAD_REQUIRED_VARIABLES, optional_selectors: LOAD_OPTIONAL_SELECTORS});

})(JSPLib);
