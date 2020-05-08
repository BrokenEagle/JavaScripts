// ==UserScript==
// @name         SiteTagSearches
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      4.3
// @description  Presents additional site links for the wiki tag(s).
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        *://*.donmai.us/posts?*
// @match        *://*.donmai.us/wiki_pages/*
// @match        *://*.donmai.us/settings
// @exclude      /^https?://\w+\.donmai\.us/.*\.(xml|json|atom)(\?|$)/
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/sitetagsearches.user.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200507-utility/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200506-storage/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/menu.js
// ==/UserScript==

/* global $ JSPLib Danbooru */

/****Global variables****/

//Library constants

////NONE

//Exterior script variables
const DANBOORU_TOPIC_ID = '14958';
const JQUERY_TAB_WIDGET_URL = 'https://cdn.jsdelivr.net/gh/jquery/jquery-ui@1.12.1/ui/widgets/tabs.js';

//Variables for load.js
const PROGRAM_LOAD_REQUIRED_VARIABLES = ['window.jQuery'];
const PROGRAM_LOAD_OPTIONAL_SELECTORS = ['#c-wiki-pages #a-show', '#c-posts #a-index', '#c-users #a-edit'];

//Program name constants
const PROGRAM_SHORTCUT = 'sts';
const PROGRAM_CLICK = 'click.sts';
const PROGRAM_NAME = 'SiteTagSearches';

//Main program variable
var STS;

//Available setting values
const BOORU_SITES = ['gelbooru', 'yandere', 'sankaku', 'konachan'];
const SOURCE_SITES = ['pixiv', 'nicoseiga', 'twitter', 'deviantart', 'tumblr', 'artstation', 'E-Hentai', 'tinami'];

//Main settings
const SETTINGS_CONFIG = {
    booru_sites_enabled: {
        allitems: BOORU_SITES,
        default: BOORU_SITES,
        validate: (data)=>{return JSPLib.menu.validateCheckboxRadio(data, 'checkbox', BOORU_SITES);},
        hint: "Select to show booru type."
    },
    source_sites_enabled: {
        allitems: SOURCE_SITES,
        default: SOURCE_SITES,
        validate: (data)=>{return JSPLib.menu.validateCheckboxRadio(data, 'checkbox', SOURCE_SITES);},
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
}`;

//HTML constants

const STS_MENU = `
<div id="sts-script-message" class="prose">
    <h2>${PROGRAM_NAME}</h2>
    <p>Check the forum for the latest on information and updates (<a class="dtext-link dtext-id-link dtext-forum-topic-id-link" href="/forum_topics/${DANBOORU_TOPIC_ID}">topic #${DANBOORU_TOPIC_ID}</a>).</p>
</div>
<div id="sts-console" class="jsplib-console">
    <div id="sts-settings" class="jsplib-outer-menu">
        <div id="sts-general-settings" class="jsplib-settings-grouping">
            <div id="sts-general-message" class="prose">
                <h4>General settings</h4>
            </div>
        </div>
        <div id="sts-source-settings" class="jsplib-settings-grouping">
            <div id="sts-source-message" class="prose">
                <h4>Source settings</h4>
            </div>
        </div>
        <hr>
        <div id="sts-settings-buttons" class="jsplib-settings-buttons">
            <input type="button" id="sts-commit" value="Save">
            <input type="button" id="sts-resetall" value="Factory Reset">
        </div>
    </div>
</div>`;

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
        url: 'https://twitter.com/hashtag/%s',
    },
    'E-Hentai': {
        url: 'https://e-hentai.org/?f_search=%s',
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

function IsWikiPage() {
    return (STS.controller === 'wiki-pages') ||
        ((STS.controller === 'posts') &&
         ($('#show-excerpt-link').html() === "Wiki") &&
         ($('#excerpt .prose').length > 0));
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
    }
}

//Settings functions

function RenderSettingsMenu() {
    $('#site-tag-searches').append(STS_MENU);
    $('#sts-general-settings').append(JSPLib.menu.renderDomainSelectors());
    $('#sts-source-settings').append(JSPLib.menu.renderInputSelectors('booru_sites_enabled', 'checkbox'));
    $('#sts-source-settings').append(JSPLib.menu.renderInputSelectors('source_sites_enabled', 'checkbox'));
    JSPLib.menu.engageUI(true);
    JSPLib.menu.saveUserSettingsClick();
    JSPLib.menu.resetUserSettingsClick();
}

//Main function

function Main() {
    Danbooru.STS = STS = {
        controller: document.body.dataset.controller,
        action: document.body.dataset.action,
        settings_config: SETTINGS_CONFIG,
    };
    Object.assign(STS, {
        user_settings: JSPLib.menu.loadUserSettings(),
    });
    if (JSPLib.danbooru.isSettingMenu()) {
        JSPLib.menu.loadStorageKeys();
        JSPLib.utility.installScript(JQUERY_TAB_WIDGET_URL).done(()=>{
            JSPLib.menu.installSettingsMenu();
            RenderSettingsMenu();
        });
    }
    if (!JSPLib.menu.isScriptEnabled()) {
        Main.debuglog("Script is disabled on", window.location.hostname);
        return;
    }
    if (!IsWikiPage()) {
        Main.debuglog("No wiki page bodies!");
        return;
    }
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
    JSPLib.utility.setCSSStyle(PROGRAM_CSS);
}

/****Function decoration****/

JSPLib.debug.addFunctionLogs([
    Main
]);

/****Initialization****/

//Variables for debug.js
JSPLib.debug.debug_console = false;
JSPLib.debug.level = JSPLib.debug.INFO;
JSPLib.debug.pretext = 'STS:';
JSPLib.debug.pretimer = 'STS-';

//Variables for menu.js
JSPLib.menu.program_shortcut = PROGRAM_SHORTCUT;
JSPLib.menu.program_name = PROGRAM_NAME;

//Export JSPLib
if (JSPLib.debug.debug_console) {
    window.JSPLib.lib = window.JSPLib.lib || {};
    window.JSPLib.lib[PROGRAM_NAME] = JSPLib;
}

/****Execution start****/

JSPLib.load.programInitialize(Main, 'STS', PROGRAM_LOAD_REQUIRED_VARIABLES, [], PROGRAM_LOAD_OPTIONAL_SELECTORS);
