// ==UserScript==
// @name         SiteTagSearches
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      2
// @source       https://danbooru.donmai.us/users/23799
// @description  Presents additional site links for the translated other wiki tags
// @author       BrokenEagle
// @match        *://*.donmai.us/wiki_pages/*
// @match        *://*.donmai.us/posts?tags=*
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/sitetagsearches.user.js
// ==/UserScript==

/***Global variables***/

const program_css = `
    .wiki-other-name,
    .image-links {
        display: inline-block;
    }

    .wiki-other-name {
        position: relative;
    }

    .image-links {
        max-width: 100px;
        overflow: visible;
        position: absolute;
        right: 0;
        z-index: 20;
        background: white;
        border: lightgrey solid 1px;
        display: none;
    }

    .image-links a {
        padding: 5px;
        white-space: nowrap;
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

function RenderSiteLinks(tagname,encoded_tagname,num) {
    return `
<div class="wiki-other-name">
    <span class="other-name-tagtext">${tagname}</span>
    <a class="ui-icon collapsible-image-links ui-icon-triangle-1-e" data-id="${num}"></a>
    <div class="image-links" data-id="${num}">
        <a href="http://www.pixiv.net/search.php?s_mode=s_tag_full&amp;word=${encoded_tagname}">Pixiv</a>
        <a href="http://seiga.nicovideo.jp/tag/${encoded_tagname}">Seiga</a>
        <a href="http://nijie.info/search.php?word=${encoded_tagname}">Nijie</a>
        <a href="http://www.tinami.com/search/list?keyword=${encoded_tagname}">Tinami</a>
        <a href="http://bcy.net/tags/name/${encoded_tagname}">BCY.net</a>
        <a href="http://www.deviantart.com/tag/${encoded_tagname}">Deviantart</a>
        <a href="http://www.artstation.com/search?q=${encoded_tagname}">Artstation</a>
        <a href="http://www.tumblr.com/tagged/${encoded_tagname}">Tumblr</a>
        <a href="http://twitter.com/hashtag/${encoded_tagname}">Twitter</a>
        <a href="http://e-hentai.org/?f_search=${encoded_tagname}">E-Hentai</a>
    </div>
</div>`;
}

/***Program start***/

if ($("#c-wiki-pages #a-show,#c-posts #a-index").length) {
    setCSSStyle(program_css);

    $(".wiki-other-name").each((i,entry)=>{
        let tagname = entry.innerHTML;
        let encoded_tagname = encodeURI(tagname);
        entry.outerHTML = RenderSiteLinks(tagname,encoded_tagname,i);
    });

    $(".collapsible-image-links").click((e)=>{
        let id = $(e.target).data('id');
        $(`.collapsible-image-links[data-id=${id}]`).toggleClass("ui-icon-triangle-1-e ui-icon-triangle-1-s");
        $(`.image-links[data-id=${id}]`).slideToggle(100);
        e.preventDefault();
    });
}
