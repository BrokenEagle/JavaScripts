// ==UserScript==
// @name         PrebooruFileUpload
// @namespace    https://gist.github.com/BrokenEagle
// @version      1.0
// @description  Facilitates uploading dead illusts through file uploads.
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        *://*.donmai.us/uploads/new*
// @exclude      /^https?://\w+\.donmai\.us/.*\.(xml|json|atom)(\?|$)/
// @grant        none
// @run-at       document-body
// @downloadURL  https://gist.github.com/BrokenEagle/35f46ecfb4f9c13bc97efc968bcf396e/raw/PrebooruFileUpload.user.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201230-module/lib/module.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/notice.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/concurrency.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/load.js
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
const PROGRAM_CLICK = 'click.pfu';
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

const UPLOAD_PREVIEW = `
<p id="upload-image-metadata">
    <span id="upload-image-metadata-filesize"></span>
    <span id="upload-image-metadata-resolution"></span>
    <span id="upload-image-metadata-size-links">
        (
        <a id="upload-image-view-small" href="">small</a>
        |
        <a id="upload-image-view-large" href="">large</a>
        |
        <a id="upload-image-view-full" href="">full</a>
        )
    </span>
</p>
<div id="upload-image">
    <img src="%s" title="Shortcut is z" id="image" referrerpolicy="no-referrer" class="fit-width fit-height" onerror="Danbooru.Upload.no_image_available()" data-shortcut="z">
    <div id="pfu-prebooru-progress" style="width: 1000px; height: 50px;"></div>
</div>
`;

const RELATED_TAG_COLUMN = `<div class="source-related-tags-columns">
    <div class="tag-column translated-tags-related-tags-column" style="width: 12em;">
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

function RenderPreview(post) {
    return JSPLib.utility.sprintf(UPLOAD_PREVIEW, post.file_url);
}

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
        html += RenderTagSelector(name, String(other_tags[name].category));
        let category = other_tags[name].category;
    }
    return JSPLib.utility.sprintf(RELATED_TAG_COLUMN, html);
}

//Danbooru network functions

function QueryArtistUrlData(preprocess_data) {
    let artist_query = {
        search: {
            url_lower_array: preprocess_data.profile_urls,
        },
        only: 'artist[name]',
    };
    return JSPLib.danbooru.submitRequest('artist_urls', artist_query);
}

function QueryWikiData(preprocess_data) {
    // Add the tags as they are
    let other_names = new Set(preprocess_data.illust.tags);
    // Add the tags with common appelations discarded
    preprocess_data.illust.tags.forEach((other_name)=>{
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
    }
    return JSPLib.danbooru.submitRequest('tags', tag_query);
}

// Auxiliary functions

function GetRelatedTagData(preprocess_data) {
    let promise_array = [];
    promise_array.push(QueryArtistUrlData(preprocess_data));
    if (preprocess_data.illust.tags.length) {
        promise_array.push(QueryWikiData(preprocess_data));
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

function InitializeRelatedTags(preprocess_data) {
    Promise.all(GetRelatedTagData(preprocess_data)).then(([artist_urls, wikis, tags])=>{
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

async function InitializeUploadForm(post_id) {
    let preprocess_data = await $.post(PREBOORU_SERVER_URL + '/proxy/danbooru_upload_data.json', {post_id});
    if (preprocess_data.error) {
        JSPLib.notice.error('Prebooru post data: ' + preprocess_data.message);
        return false
    }
    $('#filedropzone, .source-data, .upload_source').hide();
    let current_tag_string = $('#upload_tag_string').val();
    let updated_tag_string = ['source:' + preprocess_data.post_url, preprocess_data.tags.join(' '), current_tag_string].join(' ');
    $('#upload_tag_string').val(updated_tag_string);
    let commentary_string = preprocess_data.illust_commentaries.join('\r\n\r\n--------------------------------------------------\r\n\r\n');
    if (commentary_string.length) {
        $('#upload_artist_commentary_desc').val(commentary_string);
        setTimeout(()=>{$('#toggle-artist-commentary').click();}, 1000);
    }
    $('#upload_md5_confirmation').val(preprocess_data.post.md5);
    $('#upload-guide-notice').after(RenderPreview(preprocess_data.post));
    $('#pfu-prebooru-progress').progressbar({value: false}).show();
    Danbooru.Upload.update_scale();
    InitializeRelatedTags(preprocess_data);
    return true;
}

function PreprocessFileUpload(post_id) {
    $.post(PREBOORU_SERVER_URL + '/proxy/danbooru_preprocess_upload.json', {post_id}).then((upload_status)=>{
        $('#pfu-prebooru-progress').progressbar('destroy').hide();
        if (upload_status.error) {
            JSPLib.notice.error('Prebooru file upload: ' + upload_status.message);
            return;
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
    let result = await InitializeUploadForm(post_id);
    if (!result) {
        return;
    }
    PreprocessFileUpload(post_id);
}

/****Initialization****/

//Variables for debug.js
JSPLib.debug.debug_console = false;
JSPLib.debug.level = JSPLib.debug.INFO;
JSPLib.debug.program_shortcut = PROGRAM_SHORTCUT;

//Export JSPLib
JSPLib.load.exportData(PROGRAM_NAME, PFU);

/****Execution start****/

JSPLib.load.programInitialize(Main, 'PFU', PROGRAM_LOAD_REQUIRED_VARIABLES, PROGRAM_LOAD_REQUIRED_SELECTORS);
