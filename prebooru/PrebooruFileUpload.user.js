// ==UserScript==
// @name         PrebooruFileUpload (Library 15)
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      2.0.a
// @description  Facilitates uploading dead illusts through file uploads.
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        *://*.donmai.us/uploads/*
// @exclude      /^https?://\w+\.donmai\.us/.*\.(xml|json|atom)(\?|$)/
// @grant        none
// @run-at       document-body
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/ntisas-prebooru/preboorufileupload.user.js
// @updateURL    https://raw.githubusercontent.com/BrokenEagle/JavaScripts/ntisas-prebooru/preboorufileupload.user.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/module.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/notice.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/concurrency.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/load.js
// ==/UserScript==

/* global JSPLib $ Danbooru */

/****Global variables****/

const PREBOORU_SERVER_URL = 'http://127.0.0.1:5000';

//Library constants

////NONE

//Variables for load.js
const PROGRAM_LOAD_REQUIRED_VARIABLES = ['window.jQuery','window.Danbooru','Danbooru.Upload','Danbooru.RelatedTag'];
const PROGRAM_LOAD_REQUIRED_SELECTORS = ['#page'];

//Program name constants
const PROGRAM_SHORTCUT = 'pfu';
const PROGRAM_NAME = 'PrebooruFileUpload';

//Main program variable
const PFU = {};

//Regex constants

const COMMON_HASHTAG_REGEXES = [
    /生誕祭\d*$/,
    /誕生祭\d*$/,
    /版もうひとつの深夜の真剣お絵描き60分一本勝負(?:_\d+$|$)/,
    /版深夜の真剣お絵描き60分一本勝負(?:_\d+$|$)/,
    /深夜の真剣お絵描き60分一本勝負(?:_\d+$|$)/,
    /版深夜のお絵描き60分一本勝負(?:_\d+$|$)/,
    /版真剣お絵描き60分一本勝負(?:_\d+$|$)/,
    /版真剣お絵描き60分一本勝(?:_\d+$|$)/,
    /版お絵描き60分一本勝負(?:_\d+$|$)/,
];

//HTML constants

const PROGRESS_BAR = `
<div id="upload-file">
    <div id="pfu-prebooru-progress" style="width: 800px; height: 50px;"></div>
</div>`;

const RELATED_TAG_COLUMN = `<div class="source-related-tags-columns">
    <div class="tag-column translated-tags-related-tags-column" style="width: 18em;">
        <h3 class="flex items-center space-x-1">
            <input type="checkbox" class="invisible">
            <span>Translated Tags</span>
        </h3>
        <ul class="tag-list simple-tag-list">
            %s
        </ul>
    </div>
</div>`;

const TAG_SELECTOR = `
<li class="flex items-center space-x-1">
    <input type="checkbox" tabindex="-1">
    <a class="search-tag tag-type-%CATEGORY%" data-tag-name="%NAME%" href="/posts?tags=%ENCODED_NAME%">%NAME%</a>
</li>`;

/****Functions****/

//Helper functions

function fixedEncodeURIComponent(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, function(c) {
    return '%' + c.charCodeAt(0).toString(16);
  });
}

//Render functions

function RenderTagSelector(name, category) {
    return JSPLib.utility.regexReplace(TAG_SELECTOR, {
        NAME: name,
        ENCODED_NAME: fixedEncodeURIComponent(name),
        CATEGORY: category,
    });
}

function RenderTranslatedTagsColumn(artist_names, other_tags) {
    let html = '';

    artist_names.forEach((name)=>{
        html += RenderTagSelector(name, '1');
    });

    for (let name in other_tags) {
        let category = String(other_tags[name]);
        html += RenderTagSelector(name, category);
    }
    return JSPLib.utility.sprintf(RELATED_TAG_COLUMN, html);
}

//Danbooru network functions

function QueryArtistUrlData(profile_urls) {
    let artist_query = {
        search: {
            artist: {
                is_deleted: false,
            },
            url_lower_array: profile_urls,
        },
        only: 'artist[name]',
    };
    return JSPLib.danbooru.submitRequest('artist_urls', artist_query);
}

function QueryWikiData(tags) {
    // Add the tags as they are
    let other_names = new Set();
    // Add the tags with common appelations discarded
    tags.forEach((other_name)=>{
        for (let regexp of COMMON_HASHTAG_REGEXES) {
            let normalized_name = other_name.replace(regexp, "");
            if (normalized_name != other_name) {
                other_names.add(normalized_name);
                break;
            }
        }
    });
    let wiki_query = {
        search: {
            other_names_include_any_lower_array: [...other_names],
            is_deleted: false
        },
        only: 'title,other_names,tag[category]',
    };
    return JSPLib.danbooru.submitRequest('wiki_pages', wiki_query);
}

function QueryTagData(tags) {
    let tag_query = {
        search: {
            name_lower_comma: tags.join(','),
        },
        only: 'name,category,post_count',
    };
    return JSPLib.danbooru.submitRequest('tags', tag_query);
}

// Auxiliary functions

function GetRelatedTagData(preprocess_data) {
    let promise_array = [];
    promise_array.push(QueryArtistUrlData(preprocess_data.profile_urls));
    if (preprocess_data.illust.tags.length) {
        promise_array.push(QueryWikiData(preprocess_data.illust.tags));
    } else {
        promise_array.push(Promise.resolve([]));
    }
    let valid_tags = preprocess_data.illust.tags.filter((tag) => tag.match(/^[\u0020-\u0024\u0026-\u0029\u002B\u002D-\u007F]+$/)).map((tag) => tag.toLowerCase());
    if (valid_tags.length) {
        promise_array.push(QueryTagData(valid_tags));
    } else {
        promise_array.push(Promise.resolve([]));
    }
    return promise_array;
}

function InitializeRelatedTags(data) {
    Promise.all(GetRelatedTagData(data)).then(([artist_urls, wikis, tags])=>{
        JSPLib.debug.debuglog('InitializeRelatedTags', {artist_urls, wikis, tags});
        let artist_names = JSPLib.utility.arrayUnique(artist_urls.map((artist_url) => artist_url.artist.name));
        let other_tags = {};
        wikis.forEach((wiki)=>{
            other_tags[wiki.title] = (wiki.tag && wiki.tag.category) || 0;
        });
        tags.forEach((tag)=>{
            other_tags[tag.name] = tag.category;
        });
        $('#related-tags-container .source-related-tags-columns').replaceWith(RenderTranslatedTagsColumn(artist_names, other_tags));
        Danbooru.RelatedTag.update_selected();
    });
}

//Main execution functions

function InitializeUploadForm(post_id, illust_id) {
    JSPLib.network.post(PREBOORU_SERVER_URL + '/proxy/danbooru_upload_data.json', {post_id, illust_id}).then((data)=>{
        JSPLib.debug.debuglog('InitializeUploadForm', {post_id, illust_id, data});
        if (data.error) {
            JSPLib.notice.error('Prebooru post data: ' + data.message);
        }
        $('#post_source').val(data.post_url);
        let current_tag_string = $('#post_tag_string').val();
        let updated_tag_string = [data.tags.join(' '), current_tag_string].join(' ');
        $('#post_tag_string').val(updated_tag_string);
        let commentary_string = data.illust_commentaries.join('\r\n\r\n--------------------------------------------------\r\n\r\n');
        if (commentary_string.length) {
            $('#post_artist_commentary_desc').val(commentary_string);
            setTimeout(()=>{$('#toggle-artist-commentary').click();}, 1000);
        }
        InitializeRelatedTags(data);
    });
}

function PreprocessFileUpload(post_id) {
    JSPLib.network.post(PREBOORU_SERVER_URL + '/proxy/danbooru_preprocess_upload.json', {post_id}).then((data)=>{
        JSPLib.debug.debuglog('PreprocessFileUpload', {post_id, data});
        $('#pfu-prebooru-progress').progressbar('destroy').hide();
        if (data.error) {
            JSPLib.notice.error('Prebooru file upload: ' + data.message);
        } else {
            window.location.replace(`/uploads/${data.upload.id}` + window.location.search);
        }
    });
}

//Main function

async function Main() {
    let url_params = JSPLib.utility.parseParams(location.search.slice(1));
    if (!('prebooru_post_id' in url_params)) {
        JSPLib.debug.debuglog("Prebooru parameters not found.", url_params);
        return;
    }
    let post_id = parseInt(url_params.prebooru_post_id);
    if (!JSPLib.validate.validateID(post_id)) {
        JSPLib.debug.debugwarn("Post id must be a valid ID:", url_params.prebooru_post_id, post_id);
        return;
    }
    JSPLib.debug.debuglog('Main', {url_params});
    if (document.body.dataset.action === 'new') {
        $('.file-upload-component').css('width', '50rem').append(PROGRESS_BAR);
        $('#pfu-prebooru-progress').progressbar({value: false}).show();
        PreprocessFileUpload(post_id);
    } else if (document.body.dataset.action === 'show') {
        let illust_id = parseInt(url_params.prebooru_illust_id);
        InitializeUploadForm(post_id, illust_id);
    }
}

/****Initialization****/

//Variables for debug.js
JSPLib.debug.debug_console = true;
JSPLib.debug.level = JSPLib.debug.INFO;
JSPLib.debug.program_shortcut = PROGRAM_SHORTCUT;

//Export JSPLib
JSPLib.load.exportData(PROGRAM_NAME, PFU);

/****Execution start****/

JSPLib.load.programInitialize(Main, 'PFU', {required_variables: PROGRAM_LOAD_REQUIRED_VARIABLES, required_selectors: PROGRAM_LOAD_REQUIRED_SELECTORS});
