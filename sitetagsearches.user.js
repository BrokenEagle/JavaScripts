// ==UserScript==
// @name         SiteTagSearches
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      3.1
// @source       https://danbooru.donmai.us/users/23799
// @description  Presents additional site links for the wiki tag(s)
// @author       BrokenEagle
// @match        *://*.donmai.us/wiki_pages/*
// @match        *://*.donmai.us/posts?*
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/sitetagsearches.user.js
// ==/UserScript==

/***Global variables***/

const program_css = `
    .wiki-other-name {
        display: inline-block;
        position: relative;
    }

    .wiki-other-name .image-links,
    .wiki-other-name .booru-links {
        position: absolute;
        background: white;
        border: lightgrey solid 1px;
        display: none;
    }

    .wiki-other-name .image-links {
        right: 0;
        z-index: 20;
    }

    .wiki-other-name .booru-links {
        left: 0;
        z-index: 30;
    }

    .wiki-other-name .image-links ul,
    .wiki-other-name .booru-links ul    {
        padding: 5px;
        margin: 0;
    }

    .wiki-other-name .image-links li,
    .wiki-other-name .booru-links li    {
        list-style-type: none;
    }

    .ui-icon {
        display: inline-block;
    }

`;

/***Functions***/

function setCSSStyle(csstext) {
    var css_dom = document.createElement('style');
    css_dom.type = 'text/css';
    css_dom.innerHTML = csstext;
    document.head.appendChild(css_dom);
}

function RenderImageSiteLinks(encoded_tagname,num) {
    return `
    <div class="image-links" data-id="${num}">
        <ul class="site-link-list">
            <li class="site-link"><a href="http://www.pixiv.net/search.php?s_mode=s_tag_full&amp;word=${encoded_tagname}">Pixiv</a></li>
            <li class="site-link"><a href="http://seiga.nicovideo.jp/tag/${encoded_tagname}">Nicoseiga</a></li>
            <li class="site-link"><a href="http://nijie.info/search.php?word=${encoded_tagname}">Nijie</a></li>
            <li class="site-link"><a href="http://www.tinami.com/search/list?keyword=${encoded_tagname}">Tinami</a></li>
            <li class="site-link"><a href="http://bcy.net/tags/name/${encoded_tagname}">BCY.net</a></li>
            <li class="site-link"><a href="http://www.deviantart.com/tag/${encoded_tagname}">Deviantart</a></li>
            <li class="site-link"><a href="http://www.artstation.com/search?q=${encoded_tagname}">Artstation</a></li>
            <li class="site-link"><a href="http://www.tumblr.com/tagged/${encoded_tagname}">Tumblr</a></li>
            <li class="site-link"><a href="http://twitter.com/hashtag/${encoded_tagname}">Twitter</a></li>
            <li class="site-link"><a href="http://e-hentai.org/?f_search=${encoded_tagname}">E-Hentai</a></li>
        </ul>
    </div>`;
}

function RenderBooruLinks(tagname,num) {
    return `
    <div class="booru-links" data-id="${num}">
        <ul class="booru-link-list">
            <li class="booru-link"><a href="http://gelbooru.com/index.php?page=post&s=list&tags=${tagname.replace(/ /g,'_')}">Gelbooru</a></li>
            <li class="booru-link"><a href="http://yande.re/post?tags=${tagname.replace(/ /g,'_')}">Yandere</a></li>
            <li class="booru-link"><a href="http://chan.sankakucomplex.com/?tags=${tagname.replace(/ /g,'_')}">Sankaku</a></li>
            <li class="booru-link"><a href="http://konachan.com/post?tags=${tagname.replace(/ /g,'_')}">Konachan</a></li>
        </ul>
    </div>`;
}

function RenderTranslatedTags(tagname,encoded_tagname,num) {
    return `
<div class="wiki-other-name">
    <span class="other-name-tagtext">${tagname}</span>
    <a class="ui-icon collapsible-image-links ui-icon-triangle-1-e" data-id="${num}"></a>` +
    RenderImageSiteLinks(encoded_tagname,num) + `
</div>`;
}

function RenderMainTag(tagname) {
    return `
<div class="wiki-other-name">
    <a class="ui-icon collapsible-booru-links ui-icon-triangle-1-w" data-id="a"></a>
    <span class="other-name-tagtext">${tagname}</span>
    <a class="ui-icon collapsible-image-links ui-icon-triangle-1-e" data-id="0"></a>` +
    RenderImageSiteLinks(encodeURIComponent(tagname),0) +
    RenderBooruLinks(tagname,'a') + `
</div>`;
}

function isWikiPage() {
    return ($("#wiki-page-title").length) || (($("#show-excerpt-link").html() === "Wiki") && ($("#excerpt .prose").length > 0));
}

function GetWikiName() {
    if (isWikiPage()) {
        if ($("#c-posts #a-index").length) {
            let tagname = $('title').html().trim();
            return tagname.slice(0,tagname.lastIndexOf('-')-1);
        } else if ($("#c-wiki-pages #a-show")) {
            return $("#wiki-page-title a").html();
        }
    }
}

/***Program start***/

function main() {
    if (!isWikiPage()) {
        return;
    }
    setCSSStyle(program_css);

    $(".wiki-other-name").each((i,entry)=>{
        let tagname = entry.innerHTML;
        let elem = document.createElement('textarea');
        elem.innerHTML = tagname;
        let decoded = elem.value;
        let encoded_tagname = encodeURIComponent(decoded);
        entry.outerHTML = RenderTranslatedTags(tagname,encoded_tagname,i+1);
    });

    if ($(".wiki-other-name").length) {
        $(".wiki-other-name").parent().prepend(RenderMainTag(GetWikiName()));
    } else {
        let $elem = $('<p></p>').prepend(RenderMainTag(GetWikiName()));
        $("#wiki-page-body").prepend($elem);
    }

    $(".collapsible-image-links").click((e)=>{
        let id = $(e.target).data('id');
        $(`.collapsible-image-links[data-id=${id}]`).toggleClass("ui-icon-triangle-1-e ui-icon-triangle-1-s");
        $(`.image-links[data-id=${id}]`).slideToggle(100);
        e.preventDefault();
    });

    $(".collapsible-booru-links").click((e)=>{
        let id = $(e.target).data('id');
        $(`.collapsible-booru-links[data-id=${id}]`).toggleClass("ui-icon-triangle-1-w ui-icon-triangle-1-s");
        $(`.booru-links[data-id=${id}]`).slideToggle(100);
        e.preventDefault();
    });
}

if ($("#c-wiki-pages #a-show,#c-posts #a-index").length) {
    main();
}
