// ==UserScript==
// @name         SiteTagSearches
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      4.15
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
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/module.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240223-menu/lib/menu.js
// ==/UserScript==

/* global $ JSPLib */

/****Global variables****/

//Library constants

////NONE

//Exterior script variables
const DANBOORU_TOPIC_ID = '14958';

//Variables for load.js
const PROGRAM_LOAD_REQUIRED_VARIABLES = ['window.jQuery'];
const PROGRAM_LOAD_OPTIONAL_SELECTORS = ['#c-wiki-pages #a-show', '#c-posts #a-index', '#c-users #a-edit'];

//Program name constants
const PROGRAM_SHORTCUT = 'sts';
const PROGRAM_CLICK = 'click.sts';
const PROGRAM_NAME = 'SiteTagSearches';

//Main program variable
const STS = {};

//Available setting values
const BOORU_SITES = ['gelbooru', 'yandere', 'sankaku', 'konachan'];
const SOURCE_SITES = ['pixiv', 'twitter', 'tumblr', 'deviantart', 'E-Hentai', 'nijie', 'artstation', 'nicoseiga', 'naver', 'lofter', 'skeb', 'tinami'];

//Main settings
const SETTINGS_CONFIG = {
    booru_sites_enabled: {
        allitems: BOORU_SITES,
        reset: BOORU_SITES,
        validate: (data) => JSPLib.menu.validateCheckboxRadio(data, 'checkbox', BOORU_SITES),
        hint: "Select to show booru type."
    },
    source_sites_enabled: {
        allitems: SOURCE_SITES,
        reset: SOURCE_SITES,
        validate: (data) => JSPLib.menu.validateCheckboxRadio(data, 'checkbox', SOURCE_SITES),
        hint: "Select to show source type."
    },
};

//CSS constants

const PROGRAM_CSS = `
.wiki-other-name {
    display: inline-block;
    position: relative;
}
.sts-links {
    position: absolute;
    background-color: var(--body-background-color);
    border: var(--footer-border);
    display: none;
    z-index: 1;
}
.sts-source-links {
    right: 0;
}
.sts-booru-links {
    left: 0;
}
.wiki-other-name .sts-links ul {
    padding: 5px;
    margin: 0;
}
.wiki-other-name .sts-links li {
    list-style-type: none;
}
.sts-main-tagtext {
    display: inline-block;
    min-width: 8em;
}
.sts-other-tagtext {
    display: inline-block;
    min-width: 4.25em;
}
#wiki-page-body,
#excerpt .prose {
    min-height: 15em;
}`

const MENU_CSS = `
.sts-selectors.jsplib-selectors label {
    width: 120px;
}`;

//HTML constants

const MENU_CONFIG = {
    topic_id: DANBOORU_TOPIC_ID,
    settings: [{
        name: 'general',
    },{
        name: 'source',
    }],
    controls: [],
};

//Site constants

const SITE_CONFIG = {
    pixiv: {
        url: 'https://www.pixiv.net/en/tags/%s/artworks',
    },
    nicoseiga: {
        url: 'https://seiga.nicovideo.jp/tag/%s?sort=image_created',
    },
    nijie: {
        url: 'https://nijie.info/search.php?word=%s',
    },
    tinami: {
        url: 'https://www.tinami.com/search/list?keyword=%s',
    },
    deviantart: {
        url: 'https://www.deviantart.com/tag/%s',
    },
    artstation: {
        url: 'https://www.artstation.com/search?q=%s',
    },
    tumblr: {
        url: 'https://www.tumblr.com/tagged/%s',
    },
    twitter: {
        url: 'https://twitter.com/hashtag/%s?src=hashtag_click&f=live',
    },
    'E-Hentai': {
        url: 'https://e-hentai.org/?f_search=%s',
    },
    naver: {
        url: 'https://section.blog.naver.com/Search/Post.naver?keyword=%s',
    },
    lofter: {
        url: 'https://www.lofter.com/tag/%s',
    },
    skeb: {
        url: 'https://skeb.jp/search?q=%s',
    },
    gelbooru: {
        url: 'https://gelbooru.com/index.php?page=post&s=list&tags=%s',
    },
    yandere: {
        url: 'https://yande.re/post?tags=%s',
    },
    sankaku: {
        url: 'https://chan.sankakucomplex.com/?tags=%s',
    },
    konachan: {
        url: 'https://konachan.com/post?tags=%s',
    },
};

/***Functions***/

//Library functions

////NONE

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
    } else if (STS.controller === 'wiki-pages') {
        return $('#wiki-page-title a').html();
    }
}

function AnySite(type) {
    return Boolean(STS.user_settings[type + '_sites_enabled'].length);
}

//Render functions

function RenderSiteLinks(type,tagname,searchtag,num) {
    let site_list = STS.user_settings[type + '_sites_enabled'].map((site)=>{
        let url = JSPLib.utility.sprintf(SITE_CONFIG[site].url, searchtag);
        let display_name = JSPLib.utility.displayCase(site);
        return `<li class="sts-${type}-link"><a target="_blank" href="${url}">${display_name}</a></li>`;
    });
    return `
<div class="sts-links sts-${type}-links" data-id="${num}">
    <ul class="sts-${type}-link-list">
        ${site_list.join('')}
    </ul>
</div>`;
}

function RenderSiteToggle(type,num,direction) {
    if (AnySite(type)) {
        return `<a class="ui-icon sts-collapsible-${type}-links ui-icon-triangle-1-${direction}" data-id="${num}"></a>`;
    }
    return "";
}

function RenderTranslatedTags(tagname,num) {
    let rendered_source_tags = RenderSiteLinks('source', tagname, encodeURIComponent(tagname), num);
    let source_toggle = RenderSiteToggle('source', num, 'e');
    return `
<div class="wiki-other-name sts-other-tag">
    <span class="sts-other-tagtext">${tagname}</span>
    ${source_toggle}
    ${rendered_source_tags}
</div>`;
}

function RenderMainTag() {
    let tagname = GetWikiName();
    let rendered_source_tags = RenderSiteLinks('source', tagname, encodeURIComponent(tagname), 0);
    let rendered_booru_tags = RenderSiteLinks('booru', tagname, tagname.replace(/ /g, '_'), 'a');
    let source_toggle = RenderSiteToggle('source', 0, 'e');
    let booru_toggle = RenderSiteToggle('booru', 'a', 'w');
    return `
<div class="wiki-other-name sts-main-tag">
    ${booru_toggle}
    <span class="sts-main-tagtext">${tagname}</span>
    ${source_toggle}
    ${rendered_booru_tags}
    ${rendered_source_tags}
</div>`;
}

//Event handlers

function SiteLinkToggle(type,direction) {
    return function (event) {
        let id = $(event.target).data('id');
        $(`.sts-collapsible-${type}-links[data-id=${id}]`).toggleClass(`ui-icon-triangle-1-${direction} ui-icon-triangle-1-s`);
        $(`.sts-${type}-links[data-id=${id}]`).slideToggle(100);
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
    $('#sts-source-settings').append(JSPLib.menu.renderInputSelectors('source_sites_enabled', 'checkbox'));
    JSPLib.menu.engageUI(true);
    JSPLib.menu.saveUserSettingsClick();
    JSPLib.menu.resetUserSettingsClick();
}

//Main function

function Main() {
    JSPLib.debug.debuglog("Initialize start:", JSPLib.utility.getProgramTime());
    const preload = {
        run_on_settings: false,
        initialize_func: InitializeProgramValues,
        menu_css: MENU_CSS,
    };
    if (!JSPLib.menu.preloadScript(STS, RenderSettingsMenu, preload)) return;
    let $wiki_other_names = $('.wiki-other-name');
    if ($wiki_other_names.length) {
        let $wiki_container = $wiki_other_names.parent();
        $wiki_other_names.each((i,entry)=>{
            entry.outerHTML = RenderTranslatedTags(entry.innerText, i + 1);
        });
        $wiki_container.prepend(RenderMainTag());
    } else {
        let $elem = $('<p></p>').prepend(RenderMainTag());
        $('#wiki-page-body, #c-posts #a-index .prose').prepend($elem);
    }
    $('.sts-collapsible-source-links').on(PROGRAM_CLICK, SiteLinkToggle('source', 'e'));
    $('.sts-collapsible-booru-links').on(PROGRAM_CLICK, SiteLinkToggle('booru', 'w'));
    JSPLib.utility.setCSSStyle(PROGRAM_CSS, 'program');
}

/****Function decoration****/

////NONE

/****Initialization****/

//Variables for debug.js
JSPLib.debug.debug_console = false;
JSPLib.debug.level = JSPLib.debug.INFO;
JSPLib.debug.program_shortcut = PROGRAM_SHORTCUT;

//Variables for menu.js
JSPLib.menu.program_shortcut = PROGRAM_SHORTCUT;
JSPLib.menu.program_name = PROGRAM_NAME;
JSPLib.menu.program_data = STS;
JSPLib.menu.settings_config = SETTINGS_CONFIG;

//Export JSPLib
JSPLib.load.exportData(PROGRAM_NAME, STS);

/****Execution start****/

JSPLib.load.programInitialize(Main, {program_name: PROGRAM_NAME, required_variables: PROGRAM_LOAD_REQUIRED_VARIABLES, optional_selectors: PROGRAM_LOAD_OPTIONAL_SELECTORS});
