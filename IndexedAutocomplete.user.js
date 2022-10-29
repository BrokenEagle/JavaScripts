// ==UserScript==
// @name         IndexedAutocomplete
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      29.16
// @description  Uses Indexed DB for autocomplete, plus caching of other data.
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @exclude      /^https?://\w+\.donmai\.us/.*\.(xml|json|atom)(\?|$)/
// @grant        none
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/IndexedAutocomplete.user.js
// @updateURL    https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/IndexedAutocomplete.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.10.0/localforage.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.13.1/validate.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.4.4/lz-string.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/module.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/concurrency.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20220515/lib/menu.js
// ==/UserScript==

/* global JSPLib $ Danbooru validate LZString */

/****Global variables****/

//Library constants

const LIBRARY_MENU_CSS = `
/* LIBRARY FIXES */
#userscript-settings-menu .jsplib-settings-buttons input {
    color: var(--button-primary-text-color);
}
#page #userscript-settings-menu .jsplib-settings-buttons .jsplib-commit:hover {
    background-color: var(--green-5);
}
#page #userscript-settings-menu .jsplib-settings-buttons .jsplib-resetall:hover {
    background-color: var(--red-5);
}
#userscript-settings-menu .jsplib-settings-buttons .jsplib-commit:hover,
#userscript-settings-menu .jsplib-settings-buttons .jsplib-resetall:hover {
    filter: brightness(1.25);
}`;

//Exterior script variables
const DANBOORU_TOPIC_ID = '14701';

//Variables for load.js
const PROGRAM_LOAD_REQUIRED_VARIABLES = ['window.jQuery', 'window.Danbooru', 'Danbooru.Autocomplete', 'Danbooru.RelatedTag', 'Danbooru.CurrentUser'];
const PROGRAM_LOAD_REQUIRED_SELECTORS = ['#top', '#page'];

//Program name constants
const PROGRAM_SHORTCUT = 'iac';
const PROGRAM_KEYDOWN = 'keydown.iac';
const PROGRAM_MOUSEENTER = 'mouseenter.iac';
const PROGRAM_MOUSELEAVE = 'mouseleave.iac';
const PROGRAM_SCROLL = 'scroll.iac';
const PROGRAM_NAME = 'IndexedAutocomplete';

//Program data constants
const PROGRAM_DATA_REGEX = /^(af|ref|ac|pl|us|fg|ss|ar|wp|ft|rt(s|f)(gen|char|copy|art)?)-/; //Regex that matches the prefix of all program cache data
const PROGRAM_DATA_KEY = {
    tag: 'ac',
    pool: 'pl',
    user: 'us',
    artist: 'ar',
    wiki: 'wp',
    forum: 'ft',
    saved_search: 'ss',
    favorite_group: 'fg',
};

//Main program variable
const IAC = {};

//For factory reset
const LOCALSTORAGE_KEYS = [
    'iac-choice-info',
];
const PROGRAM_RESET_KEYS = {
    choice_order: {},
    choice_data: {},
    source_data: {},
};

//Available setting values
const TAG_SOURCES = ['metatag', 'tag', 'tag-word', 'tag-abbreviation', 'tag-alias', 'tag-correction', 'tag-other-name'];
const SCALE_TYPES = ['linear', 'square_root', 'logarithmic'];
const RELATED_QUERY_TYPES = ['default', 'frequent', 'similar', 'like'];

//Main settings
const SETTINGS_CONFIG = {
    usage_multiplier: {
        reset: 0.9,
        parse: parseFloat,
        validate: (data) => JSPLib.menu.validateNumber(data, false, 0.0, 1.0),
        hint: "Valid values: 0.0 - 1.0."
    },
    usage_maximum: {
        reset: 20,
        parse: parseFloat,
        validate: (data) => JSPLib.menu.validateNumber(data, false, 0.0),
        hint: "Set to 0 for no maximum."
    },
    usage_expires: {
        reset: 2,
        parse: parseInt,
        validate: (data) => JSPLib.menu.validateNumber(data, true, 1),
        hint: "Number of days."
    },
    usage_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Uncheck to turn off usage mechanism."
    },
    alternate_sorting_enabled: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Check to use alternate weights and/or scales for sorting calculations."
    },
    postcount_scale: {
        allitems: SCALE_TYPES,
        reset: ['linear'],
        validate: (data) => JSPLib.menu.validateCheckboxRadio(data, 'radio', SCALE_TYPES),
        hint: "Select the type of scaling to be applied to the post count."
    },
    exact_source_weight: {
        reset: 1.0,
        parse: parseFloat,
        validate: (data) => JSPLib.menu.validateNumber(data, false, 0.0, 1.0),
        hint: "Valid values: 0.0 - 1.0."
    },
    prefix_source_weight: {
        reset: 0.8,
        parse: parseFloat,
        validate: (data) => JSPLib.menu.validateNumber(data, false, 0.0, 1.0),
        hint: "Valid values: 0.0 - 1.0."
    },
    alias_source_weight: {
        reset: 0.2,
        parse: parseFloat,
        validate: (data) => JSPLib.menu.validateNumber(data, false, 0.0, 1.0),
        hint: "Valid values: 0.0 - 1.0."
    },
    correct_source_weight: {
        reset: 0.1,
        parse: parseFloat,
        validate: (data) => JSPLib.menu.validateNumber(data, false, 0.0, 1.0),
        hint: "Valid values: 0.0 - 1.0."
    },
    metatag_source_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Adds metatags to autocomplete results on all post tag search inputs."
    },
    BUR_source_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Adds BUR script elements to autocomplete results on bulk update requests, tag aliases, and tag implications."
    },
    source_results_returned: {
        reset: 10,
        parse: parseInt,
        validate: (data) => JSPLib.menu.validateNumber(data, true, 5, 20),
        hint: "Number of results to return (5 - 20)."
    },
    source_highlight_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Adds highlights and stylings to the HTML classes set by the program."
    },
    highlight_words_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Underlines word matches on word match results."
    },
    source_grouping_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Groups the results by tag autocomplete sources."
    },
    source_order: {
        allitems: TAG_SOURCES,
        reset: TAG_SOURCES,
        sortvalue: true,
        validate: (data) => JSPLib.utility.arrayEquals(data, TAG_SOURCES),
        hint: "Used when source grouping is enabled. Drag and drop the sources to determine the group order."
    },
    alternate_tag_source: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Uses the <code>/tags</code> controller instead of the normal autocomplete source."
    },
    alternate_tag_wildcards: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Allows using a wildcard anywhere in a string with a wildcard always being added to the end."
    },
    word_start_matches: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Always adds a wildcard to the end, which forces the old behavior of searching from the beginning only."
    },
    network_only_mode: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: `Always goes to network. <b><span style="color:red">Warning:</span> This negates the benefit of cached data!</b>`
    },
    recheck_data_interval: {
        reset: 1,
        parse: parseInt,
        validate: (data) => JSPLib.menu.validateNumber(data, true, 0, 3),
        hint: "Number of days (0 - 3). Data expiring within this period gets automatically requeried. Setting to 0 disables this."
    },
    related_results_limit: {
        reset: 0,
        parse: parseInt,
        validate: (data) => JSPLib.menu.validateNumber(data, true, 0, 50),
        hint: "Number of results to show (1 - 50) for the primary <b>Tags</b> column. Setting to 0 uses Danbooru's default limit."
    },
    related_statistics_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Show tag overlap statistics for related tag results (<b>Tags</b> column only)."
    },
    related_query_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Show controls that allow for alternate query types on related tags."
    },
    related_query_default: {
        allitems: RELATED_QUERY_TYPES,
        reset: ['default'],
        validate: (data) => JSPLib.menu.validateCheckboxRadio(data, 'radio', RELATED_QUERY_TYPES),
        hint: "Select the default query type selected on the related tag controls."
    },
    expandable_related_section_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Places all related tag columns on the same row, with top/bottom scrollbars and arrow keys to support scrolling."
    },
    text_input_autocomplete_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Enables autocomplete in non-autocomplete text fields (Alt+A to enable/disable), inserting a wiki link upon completion."
    },
    forum_quick_search_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Adds a quick search bar where applicable using forum topic titles."
    },
    comment_quick_search_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Adds a quick search bar where applicable using post search queries."
    },
};

//Available config values
const ALL_SOURCE_TYPES = ['indexed_db', 'local_storage'];
const ALL_DATA_TYPES = ['tag', 'pool', 'user', 'artist', 'wiki', 'forum', 'saved_search', 'favorite_group', 'related_tag', 'custom'];
const ALL_RELATED = ["", 'general', 'copyright', 'character', 'artist'];

const CONTROL_CONFIG = {
    cache_info: {
        value: "Click to populate",
        hint: "Calculates the cache usage of the program and compares it to the total usage.",
    },
    purge_cache: {
        display: `Purge cache (<span id="iac-purge-counter">...</span>)`,
        value: "Click to purge",
        hint: `Dumps all of the cached data related to ${PROGRAM_NAME}.`,
    },
    data_source: {
        allitems: ALL_SOURCE_TYPES,
        value: 'indexed_db',
        hint: "Indexed DB is <b>Cache Data</b> and Local Storage is <b>Program Data</b>.",
    },
    data_type: {
        allitems: ALL_DATA_TYPES,
        value: 'tag',
        hint: "Select type of data. Use <b>Custom</b> for querying by keyname.",
    },
    related_tag_type: {
        allitems: ALL_RELATED,
        value: "",
        hint: "Select type of related tag data. Blank selects uncategorized data.",
    },
    raw_data: {
        value: false,
        hint: "Select to import/export all program data",
    },
    data_name: {
        value: "",
        buttons: ['get', 'save', 'delete', 'list', 'refresh'],
        hint: "Click <b>Get</b> to see the data, <b>Save</b> to edit it, and <b>Delete</b> to remove it.<br><b>List</b> shows keys in their raw format, and <b>Refresh</b> checks the keys again.",
    },
};

const MENU_CONFIG = {
    topic_id: DANBOORU_TOPIC_ID,
    settings: [{
        name: 'general',
    }, {
        name: 'source',
    }, {
        name: 'usage',
        message: "How items get sorted that are selected by the user.",
    }, {
        name: 'display',
        message: "Affects the presentation of autocomplete data to the user.",
    }, {
        name: 'sort',
        message: "Affects the order of tag autocomplete data.",
    }, {
        name: 'related-tag',
        message: "Affects the related tags shown in the post/upload edit menu.",
    }, {
        name: 'network',
    }],
    controls: [],
};

// Default values

const DEFAULT_VALUES = Object.assign({
    query_UID: {},
}, PROGRAM_RESET_KEYS);

//Pre-CSS/HTML constants

const BUR_TAG_CATEGORY = 400;
const METATAG_TAG_CATEGORY = 500;

//CSS Constants

const PROGRAM_CSS = `
.iac-line-entry {
    display: flex;
    width: 100%;
    white-space: nowrap;
}
.iac-line-entry a {
    white-space: normal;
}
.iac-query > span:first-of-type,
.iac-pool > span:first-of-type,
.iac-favgroup > span:first-of-type,
.iac-artist > span:first-of-type,
.iac-forum-topic > span:first-of-type {
    flex-basis: 90%;
}
.iac-query > span:last-of-type,
.iac-pool > span:last-of-type,
.iac-favgroup > span:last-of-type,
.iac-artist > span:last-of-type,
.iac-forum-topic > span:last-of-type {
    flex-basis: 10%;
    text-align: right;
}
.iac-wiki-page > span:first-of-type {
    flex-basis: 85%;
}
.iac-wiki-page > span:last-of-type {
    flex-basis: 15%;
    text-align: right;
}
.iac-user > span,
iac-search > span {
    flex-basis: 100%;
}
.iac-user-choice .autocomplete-item {
    box-shadow: 0px 2px 0px #000;
    padding-bottom: 1px;
    line-height: 150%;
}
.iac-tag-alias a {
    font-style: italic;
}
.iac-tag-highlight {
    margin-top: -5px;
    margin-bottom: 5px;
}
.iac-tag-highlight > div:before {
    content: "●";
    padding-right: 4px;
    font-weight: bold;
    font-size: 150%;
}
.iac-tag-bur > div:before {
    color: #000;
}
.iac-tag-exact > div:before {
    color: #DDD;
}
.iac-tag-word > div:before {
    color: #888;
}
.iac-tag-abbreviation > div:before {
    color: hotpink;
}
.iac-tag-alias > div:before {
    color: gold;
}
.iac-tag-autocorrect > div:before {
    color: cyan;
}
.iac-tag-other-name > div:before {
    color: orange;
}
.iac-tag-bur > div:before,
.iac-tag-highlight .tag-type-${BUR_TAG_CATEGORY}:link,
.iac-tag-highlight .tag-type-${BUR_TAG_CATEGORY}:visited,
.iac-tag-highlight .tag-type-${BUR_TAG_CATEGORY}:hover {
    color: #888;
}
.iac-highlight-match {
    font-weight: bold;
}
.related-tags .current-related-tags-columns li:before {
    content: "*";
    font-family: monospace;
    font-weight: bold;
    visibility: hidden;
    padding-right: 0.2em;
}
.related-tags .current-related-tags-columns li.selected:before {
    visibility: visible;
}
/** DARK/LIGHT Color Setup **/
body[data-current-user-theme=light] .iac-already-used {
    background-color: #FFFFAA;
}
body[data-current-user-theme=light] .iac-tag-metatag > div:before,
body[data-current-user-theme=light] .iac-tag-highlight .tag-type-${METATAG_TAG_CATEGORY}:link,
body[data-current-user-theme=light] .iac-tag-highlight .tag-type-${METATAG_TAG_CATEGORY}:visited,
body[data-current-user-theme=light] .iac-tag-highlight .tag-type-${METATAG_TAG_CATEGORY}:hover {
    color: #000;
}
body[data-current-user-theme=light] .iac-highlight-match {
    filter: brightness(0.75);
}
body[data-current-user-theme=dark] .iac-already-used {
    background-color: #666622;
}
body[data-current-user-theme=dark] .iac-tag-metatag > div:before,
body[data-current-user-theme=dark] .iac-tag-highlight .tag-type-${METATAG_TAG_CATEGORY}:link,
body[data-current-user-theme=dark] .iac-tag-highlight .tag-type-${METATAG_TAG_CATEGORY}:visited,
body[data-current-user-theme=dark] .iac-tag-highlight .tag-type-${METATAG_TAG_CATEGORY}:hover {
    color: #FFF;
}
body[data-current-user-theme=dark] .iac-highlight-match {
    filter: brightness(1.25);
}
@media (prefers-color-scheme: light) {
    body[data-current-user-theme=auto] .iac-already-used {
        background-color: #FFFFAA;
    }
    body[data-current-user-theme=auto] .iac-tag-metatag > div:before,
    body[data-current-user-theme=auto] .iac-tag-highlight .tag-type-${METATAG_TAG_CATEGORY}:link,
    body[data-current-user-theme=auto] .iac-tag-highlight .tag-type-${METATAG_TAG_CATEGORY}:visited,
    body[data-current-user-theme=auto] .iac-tag-highlight .tag-type-${METATAG_TAG_CATEGORY}:hover {
        color: #000;
    }
    body[data-current-user-theme=auto] .iac-highlight-match {
        filter: brightness(0.75);
    }
}
@media (prefers-color-scheme: dark) {
    body[data-current-user-theme=auto] .iac-already-used {
        background-color: #666622;
    }
    body[data-current-user-theme=auto] .iac-tag-metatag > div:before,
    body[data-current-user-theme=auto] .iac-tag-highlight .tag-type-${METATAG_TAG_CATEGORY}:link,
    body[data-current-user-theme=auto] .iac-tag-highlight .tag-type-${METATAG_TAG_CATEGORY}:visited,
    body[data-current-user-theme=auto] .iac-tag-highlight .tag-type-${METATAG_TAG_CATEGORY}:hover {
        color: #FFF;
    }
    body[data-current-user-theme=auto] .iac-highlight-match {
        filter: brightness(1.25);
    }
}
`;

const RELATED_QUERY_CONTROL_CSS = `
#iac-related-query-type label {
    color: black;
    background-color: lightgrey;
    margin-left: 0.5em;
    font-weight: bold;
}
#iac-related-query-type .ui-checkboxradio-radio-label.ui-checkboxradio-checked .ui-icon,
#iac-related-query-type .ui-checkboxradio-radio-label.ui-checkboxradio-checked:hover .ui-icon {
    background-image: none;
    width: 8px;
    height: 8px;
    border-width: 4px;
    border-style: solid;
}
#iac-related-query-type .ui-state-active .ui-icon-background {
    border: black;
    background-color: white;
}
#iac-related-query-type .ui-visual-focus,
#iac-related-query-type .ui-state-active,
#iac-related-query-type .ui-widget-content .ui-state-active,
#iac-related-query-type .ui-button.ui-state-active:hover,
#iac-related-query-type .ui-button.ui-state-active:focus,
#iac-related-query-type .ui-button:focus,
#iac-related-query-type .ui-button:active {
    border: 1px solid white;
    background: lightgrey;
    outline: none;
    box-shadow: none;
}`;

const EXPANDABLE_RELATED_SECTION_CSS = `
#iac-edit-scroll-wrapper {
    height: 20px;
    overflow-x: scroll;
    overflow-y: hidden;
    display: none;
}
#iac-edit-scroll-bar {
    height: 20px;
}
.iac-tag-statistic {
    color: hotpink;
}
div#related-tags-container div.related-tags {
    overflow-x: hidden;
    flex-wrap: nowrap;
    max-width: calc(100% - 2em);
}
div#related-tags-container div.related-tags.scrollable {
    overflow-x: scroll;
}
div#related-tags-container div.related-tags div.tag-column {
    width: 15em;
    max-width: unset;
}
div#related-tags-container div.related-tags div.tag-column.general-related-tags-column.is-empty-false {
    width: 18em;
}
div#related-tags-container div.related-tags div.tag-column.is-empty-true {
    display: none;
}`;

const FORUM_CSS = `
body[data-current-user-theme=light] .ui-menu-item .forum-topic-category-0 {
    color: blue;
}
body[data-current-user-theme=light] .ui-menu-item .forum-topic-category-1 {
    color: green;
}
body[data-current-user-theme=light] .ui-menu-item .forum-topic-category-2 {
    color: red;
}
body[data-current-user-theme=dark] .ui-menu-item .forum-topic-category-0 {
    color: var(--blue-3);
}
body[data-current-user-theme=dark] .ui-menu-item .forum-topic-category-1 {
    color: var(--green-3);
}
body[data-current-user-theme=dark] .ui-menu-item .forum-topic-category-2 {
    color: var(--red-3);
}
@media (prefers-color-scheme: light) {
    .ui-menu-item .forum-topic-category-0 {
        color: blue;
    }
    .ui-menu-item .forum-topic-category-1 {
        color: green;
    }
    .ui-menu-item .forum-topic-category-2 {
        color: red;
    }
}
@media (prefers-color-scheme: dark) {
    .ui-menu-item .forum-topic-category-0 {
        color: var(--blue-3);
    }
    .ui-menu-item .forum-topic-category-1 {
        color: var(--green-3);
    }
    .ui-menu-item .forum-topic-category-2 {
        color: var(--red-3);
    }
}`;

const SETTINGS_MENU_CSS = `
#indexed-autocomplete .jsplib-settings-grouping:not(#iac-general-settings) .iac-selectors label {
    width: 150px;
}
#indexed-autocomplete .iac-sortlist li {
    width: 10em;
}
#indexed-autocomplete .iac-formula {
    font-family: mono;
}`;

//HTML Constants

const FORUM_TOPIC_SEARCH = `
<li>
    <form autocomplete="off" class="simple_form search-form quick-search-form one-line-form" novalidate="novalidate" action="/forum_topics" accept-charset="UTF-8" method="get">
        <div class="input string optional">
            <input id="quick_search_title_matches" placeholder="Search topics" type="text" name="search[title_ilike]" class="string optional" data-autocomplete="forum-topic" autocomplete="off">
        </div>
        <input type="hidden" name="redirect" value="true">
    </form>
</li>`;

const POST_COMMENT_SEARCH = `
<li>
    <form autocomplete="off" class="simple_form search-form quick-search-form one-line-form" novalidate="novalidate" action="/comments" accept-charset="UTF-8" method="get">
        <div class="input string optional">
            <input type="hidden" name="group_by" id="group_by" value="post">
            <input id="quick_search_post_matches" placeholder="Search posts" type="text" name="tags" class="string optional" data-autocomplete="tag-query" autocomplete="off">
        </div>
    </form>
</li>`;

const TEXT_AUTOCOMPLETE_DETAILS = `
<ul>
    <li><b>Source (Alt+1):</b>
        <ul>
            <li><code>tag</code> - Will search tags.</li>
            <li><code>wiki</code> - Will search wikis.</li>
        </ul>
    </li>
    <li><b>Mode (Alt+2):</b>
        <ul>
            <li><code>tag</code> - Spaces appear as underscores.</li>
            <li><code>normal</code> - Spaces appear as spaces, uses the entire value.</li>
            <li><code>pipe</code> - Spaces appear as spaces, places a pipe "|" at the end.
                <ul>
                    <li>This will remove a final parentheses value.</li>
                    <li>E.g. "pokemon_(game)" will appear as "pokemon".</li>
                </ul>
            </li>
            <li><code>custom</code> - Default "insert text" in place for custom text by user.</li>
        </ul>
    </li>
    <li><b>Capitalization (Alt+3):</b>
        <ul>
            <li><code>lowercase</code> - All lowercase letters.</li>
            <li><code>uppercase</code> - All uppercase letters.</li>
            <li><code>titlecase</code> - Only first letter capitalized.</li>
            <li><code>propercase</code> - First letter of every word capitalized.</li>
            <li><code>exceptcase</code> - Propercase except for "a", "an", "of", "the", "is".</li>
            <li><code>romancase</code> - Exceptcase plus capitalize all letters in Roman numerals.</li>
        </ul>
    </li>
</ul>`;

const USAGE_SETTINGS_DETAILS = `
<h5>Equations</h5>
<ul>
    <li><span style="width:5em;display:inline-block"><b>Hit:</b></span><span class="iac-formula">usage_count = Min( usage_count + 1 , usage_maximum )</span></li>
    <li><span style="width:5em;display:inline-block"><b>Miss:</b></span><span class="iac-formula">usage_count = usage_count * usage_multiplier</span></li>
</ul>`;

const DISPLAY_SETTINGS_DETAILS = `
<ul>
    <li><b>Source highlight enabled:</b> The following are the CSS classes and default styling.
        <ul>
            <li><code>.iac-user-choice</code> - bold text</li>
            <li><code>.iac-tag-exact</code> - light grey dot</li>
            <li><code>.iac-tag-word</code> - dark grey dot</li>
            <li><code>.iac-tag-abbreviation</code> - pink dot</li>
            <li><code>.iac-tag-alias</code> - gold dot, italic text</li>
            <li><code>.iac-tag-other-name</code> - orange dot</li>
            <li><code>.iac-tag-autocorrect</code> - cyan dot</li>
        </ul>
    </li>
    <li><b>Source highlight enabled:</b> Class and default style: <code>.iac-word-match</code> - underline</li>
    <li><b>Source grouping enabled:</b>
        <ul>
            <li>When not enabled, the default is to order using the post count and a weighting scheme.</li>
            <li><code>sort_value = post_count x weight_value</code></li>
            <li>The different weights are: (Exact: 1.0), (Prefix: 0.8), (Alias: 0.2), (Correct: 0.1).</li>
        </ul>
    </li>
    <li><b>Source order:</b>
        <ul>
            <li><b>Exact:</b> Matches exactly letter for letter.</li>
            <li><b>Prefix:</b> Matches the first letter of each word.</li>
            <li><b>Alias:</b> Same as exact, but it checks aliases.</li>
            <li><b>Correct:</b> Tags off by 1-3 letters, i.e. mispellings.</li>
        </ul>
    </li>
</ul>`;

const SORT_SETTINGS_DETAILS = `
<ul>
    <li>Alternate sorting must be enabled to use the alternate scales/weights.</li>
    <li>These settings won't affect anything if source grouping is enabled.</li>
</ul>
<h5>Equations</h5>
<ul>
    <li><span style="width:8em;display:inline-block"><b>Linear:</b></span><span class="iac-formula">tag_weight = source_weight x post_count</span></li>
    <li><span style="width:8em;display:inline-block"><b>Square root:</b></span><span class="iac-formula">tag_weight = source_weight x Sqrt( post_count )</span></li>
    <li><span style="width:8em;display:inline-block"><b>Logarithmic:</b></span><span class="iac-formula">tag_weight = source_weight x Log( post_count )</span></li>
</ul>`;

const RELATED_TAG_SETTINGS_DETAILS = `
<ul>
    <li><b>Related query types:</b>
        <ul>
            <li><b>Default:</b> Uses the similar query type when no category is used, and frequent when a category is used.</li>
            <li><b>Frequent:</b> Uses the frequency of tags that appear with the queried tag from a sample of 1000 posts.</li>
            <li><b>Similar:</b> Applies a cosine similarity to the results which is the interelation of the frequency between all tags.
                <ul>
                    <li>I.e. it rates tags x and y, where tag x appears with high frequecy with tag y, and tag y appears with high frequency with tag x.</li>
                </ul>
            </li>
            <li><b>Like:</b> Performs a wildcard search of the tag.
                <ul>
                    <li>E.g. searching <code>military</code> will use the wildcard search <code>*military*</code> to find all tags with "military" in them.</li>
                </ul>
            </li>
        </ul>
    </li>
</ul>
<div style="font-size:80%"><b>Note:</b> Each related query type is stored separately, so results can be repeated with different values. The default query will save as either frequent or similar, depending on whether categories are used or not.</div>`;

const NETWORK_SETTINGS_DETAILS = `
<ul>
    <li><b>Alternate tag source:</b> No tag correct or tag prefix matches.</li>
    <li><b>Alternate tag wildcards:</b> This uses the <code>/tags</code> endpoint instead of the usual <code>/autocomplete</code> one when wildcards are used, though that shouldn't change the results being returned.
        <ul><b>[Different wildcard bedhavior]</b>
            <li>No wildcards - A wildcard always gets appended to the end of the string.</li>
            <li>Danbooru wildcards - The wildcards get used as they are input, and no wildcard is appended at the end.</li>
            <li>Alternate wildcards - A wildcard always gets appended to the end of the string.</li>
        </ul>
    </li>
    <li><b>Network only mode:</b>
        <ul>
            <li>Can be used to correct cache data that has been changed on the server.</li>
            <li><span style="color:red;font-weight:bold">Warning!</span> <span style="font-style:italic">As this negates the benefits of using local cached data, it should only be used sparingly.</span></li>
        </ul>
    </li>
</ul>`;

const CACHE_DATA_DETAILS = `
<ul>
    <li><b>Autocomplete data:</b> Data from every combination of keys in the text input.
        <ul style="font-size:80%">
            <li>tags (ac)</li>
            <li>pools (pl)</li>
            <li>users (us)</li>
            <li>favorite groups (fg)</li>
            <li>saved searches (ss)</li>
            <li>wiki pages (wp)</li>
            <li>artists (ar)</li>
            <li>forum topics (ft)</li>
        </ul>
    </li>
    <li><b>Related tag data:</b> Data from every use of the related tag functions (<span style="font-size:80%"><i>right beneath the tag edit box</i></span>).
        <ul style="font-size:80%">
            <li>related tags (rt)</li>
            <li>general (rtgen)</li>
            <li>artists (rtart)</li>
            <li>characters (rtchar)</li>
            <li>copyrights (rtcopy)</li>
        </ul>
    </li>
</ul>`;

const PROGRAM_DATA_DETAILS = `
<p class="tn">All timestamps are in milliseconds since the epoch (<a href="https://www.epochconverter.com">Epoch converter</a>).</p>
<ul>
    <li><u>General data</u>
        <ul>
            <li><b>prune-expires:</b> When the program will next check for cache data that has expired.</li>
            <li><b>user-settings:</b> All configurable settings.</li>
        </ul>
    </li>
    <li><u>Text autocomplete data</u>
        <ul>
            <li><b>ac-source:</b> Numerical value designating the current source.</li>
            <li><b>ac-mode:</b> Numerical value designating the current mode.</li>
            <li><b>ac-caps:</b> Numerical value designating the current capitalization.</li>
        </ul>
    </li>
    <li><u>Usage data</u>
        <ul>
            <li><b>choice-info:</b> Comprised of choice order and choice data
                <ul>
                    <li><b>choice_order:</b> The search terms per source ordered by last use.
                        <ul>
                            <li>The order in this list only affects things when the usage counts of two terms are equal.</li>
                        </ul>
                    </li>
                    <li><b>choice_data:</b> The search terms per source with the autocomplete data.
                        <ul>
                            <li>The <b>use_count</b> affects how terms get sorted against each other.</li>
                            <li>The <b>expiration</b> affects when data gets pruned, and gets renewed each time a term is selected.</li>
                        </ul>
                    </li>
                </ul>
            </li>
        </ul>
    </li>
</ul>`;

const IAC_SCROLL_WRAPPER = `
<div id="iac-edit-scroll-wrapper">
    <div id="iac-edit-scroll-bar"></div>
</div>`;

const AUTOCOMPLETE_MESSAGE = `
<b>Autocomplete turned on!</b>
<hr>
<table>
    <tbody>
        <tr>
            <td style="text-align:right;font-weight:bold">Source:&emsp;</td><td>%s</td>
        </tr>
        <tr>
            <td style="text-align:right;font-weight:bold">Mode:&emsp;</td><td>%s</td>
        </tr>
            <td style="text-align:right;font-weight:bold">Capitalization:&emsp;</td><td>%s</td>
        </tr>
   </tbody>
</table>`;

//Autocomplete constants

const AUTOCOMPLETE_SOURCE = ['tag', 'wiki'];
const AUTOCOMPLETE_MODE = ['tag', 'normal', 'pipe', 'custom'];
const AUTOCOMPLETE_CAPITALIZATION = ['lowercase', 'uppercase', 'titlecase', 'propercase', 'exceptcase', 'romancase'];

//Danbooru constants

const COUNT_METATAGS = [
    'comment_count', 'deleted_comment_count', 'active_comment_count', 'note_count', 'deleted_note_count', 'active_note_count',
    'flag_count', 'child_count', 'deleted_child_count', 'active_child_count', 'pool_count', 'deleted_pool_count', 'active_pool_count',
    'series_pool_count', 'collection_pool_count', 'appeal_count', 'approval_count', 'replacement_count',
];

const COUNT_METATAG_SYNONYMS = COUNT_METATAGS.map((metatag) => {
    metatag = metatag.replace(/_count/, "");
    if (metatag.match(/child$/)) {
        metatag = metatag.replace(/child$/, 'children');
    } else {
        metatag += 's';
    }
    return metatag;
});

const CATEGORY_COUNT_METATAGS = ['gentags', 'arttags', 'copytags', 'chartags', 'metatags'];

const ALL_METATAGS = JSPLib.utility.multiConcat([
    'user', 'approver', 'commenter', 'comm', 'noter', 'noteupdater', 'artcomm', 'commentaryupdater',
    'flagger', 'appealer', 'upvote', 'downvote', 'fav', 'ordfav', 'favgroup', 'ordfavgroup', 'pool',
    'ordpool', 'note', 'comment', 'commentary', 'id', 'rating', 'locked', 'source', 'status', 'filetype',
    'disapproved', 'parent', 'child', 'search', 'embedded', 'md5', 'width', 'height', 'mpixels', 'ratio',
    'score', 'favcount', 'filesize', 'date', 'age', 'order', 'limit', 'tagcount', 'pixiv_id', 'pixiv',
    'unaliased', 'exif', 'duration', 'random', 'is', 'has'
], COUNT_METATAGS, COUNT_METATAG_SYNONYMS, CATEGORY_COUNT_METATAGS);

const ORDER_METATAGS = JSPLib.utility.multiConcat([
    'id', 'id_desc',
    'md5', 'md5_asc',
    'score', 'score_asc',
    'upvotes', 'upvotes_asc',
    'downvotes', 'downvotes_asc',
    'favcount', 'favcount_asc',
    'created_at', 'created_at_asc',
    'change', 'change_asc',
    'comment', 'comment_asc',
    'comment_bumped', 'comment_bumped_asc',
    'note', 'note_asc',
    'artcomm', 'artcomm_asc',
    'mpixels', 'mpixels_asc',
    'portrait', 'landscape',
    'filesize', 'filesize_asc',
    'tagcount', 'tagcount_asc',
    'duration', 'duration_asc',
    'rank',
    'curated',
    'modqueue',
    'random',
    'custom',
    'none',
], COUNT_METATAGS,
COUNT_METATAG_SYNONYMS.flatMap((metatag) => [metatag, metatag + '_asc']),
CATEGORY_COUNT_METATAGS.flatMap((metatag) => [metatag, metatag + '_asc'])
);

const POST_STATUSES = ['active', 'deleted', 'pending', 'flagged', 'appealed', 'banned', 'modqueue', 'unmoderated'];
const POST_RATINGS = ['general', 'sensitive', 'questionable', 'explicit'];
const FILE_TYPES = ['jpg', 'png', 'gif', 'swf', 'zip', 'webm', 'mp4'];

const STATIC_METATAGS = {
    is: JSPLib.utility.multiConcat(['parent', 'child', 'sfw', 'nsfw'], POST_STATUSES, FILE_TYPES, POST_RATINGS),
    has: ['parent', 'children', 'source', 'appeals', 'flags', 'replacements', 'comments', 'commentary', 'notes', 'pools'],
    status: JSPLib.utility.concat(['any'], POST_STATUSES),
    child: JSPLib.utility.concat(['any', 'none'], POST_STATUSES),
    parent: JSPLib.utility.concat(['any', 'none'], POST_STATUSES),
    rating: POST_RATINGS,
    embedded: ['true', 'false'],
    filetype: FILE_TYPES,
    commentary: ['true', 'false', 'translated', 'untranslated'],
    disapproved: ['breaks_rules', 'poor_quality', 'disinterest'],
    order: ORDER_METATAGS,
};

const TYPE_TAGS = ['ch', 'co', 'gen', 'char', 'copy', 'art', 'meta', 'general', 'character', 'copyright', 'artist'];

//Regex constants

const TERM_REGEX = RegExp('([-~]*)(?:(' + JSPLib.utility.concat(ALL_METATAGS, TYPE_TAGS).join('|') + '):)?(\\S*)$', 'i');

const WORD_DELIMITERS = '_+:;!./()-';
const DELIMITER_GROUP = `[${WORD_DELIMITERS}]`;
const DELIMITER_NOT_GROUP = `[^${WORD_DELIMITERS}]`;
const DELIMITER_LOOKBEHIND = `(?<=^|${DELIMITER_GROUP})`;
const DELIMITER_GROUP_RG = new RegExp(DELIMITER_GROUP);
const ALL_DELIMTER_RG = new RegExp(DELIMITER_GROUP + '|' + DELIMITER_NOT_GROUP + '+', 'g');

//BUR constants
const BUR_KEYWORDS = ['alias', 'unalias', 'imply', 'unimply', 'rename', 'update', 'deprecate', 'undeprecate', 'nuke', 'category'];
const BUR_DATA = BUR_KEYWORDS.map((tag) => ({
    type: 'tag',
    label: tag,
    name: tag,
    post_count: 'BUR',
    source: 'bur',
    category: BUR_TAG_CATEGORY,
    key: null,
}));

//Time constants
const PRUNE_EXPIRES = JSPLib.utility.one_day;
const JQUERY_DELAY = 500; //Delay for calling functions after initialization
const TIMER_POLL_INTERVAL = 100; //Polling interval for checking program status
const CALLBACK_INTERVAL = 1000; //Interval for fixup callback functions

//Data inclusion lists
const ALL_CATEGORIES = [0, 1, 3, 4, 5];
const ALL_TOPICS = [0, 1, 2];
const ALL_POOLS = ['collection', 'series'];
const ALL_USERS = ['Member', 'Gold', 'Platinum', 'Builder', 'Moderator', 'Admin'];

//All of the following are used to determine when to run the script
const AUTOCOMPLETE_USERLIST = [
    '[data-autocomplete=user]',
];
//DOM elements with race condition
const AUTOCOMPLETE_REBINDLIST = [
    '[data-autocomplete=tag-query]',
    '[data-autocomplete=tag-edit]',
    '.autocomplete-mentions textarea',
];
//DOM elements with autocomplete
const AUTOCOMPLETE_DOMLIST = [
    '#bulk_update_request_script',
    '[data-autocomplete=tag]',
    '[data-autocomplete=wiki-page]',
    '[data-autocomplete=artist]',
    '[data-autocomplete=pool]',
    '[data-autocomplete=saved-search-label]',
    '[data-autocomplete=forum-topic]',
].concat(AUTOCOMPLETE_REBINDLIST).concat(AUTOCOMPLETE_USERLIST);

const AUTOCOMPLETE_ALL_SELECTORS = AUTOCOMPLETE_DOMLIST.join(',');
const AUTOCOMPLETE_USER_SELECTORS = AUTOCOMPLETE_USERLIST.join(',');
const AUTOCOMPLETE_REBIND_SELECTORS = AUTOCOMPLETE_REBINDLIST.join(',');
const AUTOCOMPLETE_MULTITAG_SELECTORS = ['tag-query', 'tag-edit'].map((ac_type)=>{
    return ['nav', 'page'].map((id_select)=>{
        return `#${id_select} [data-autocomplete=${ac_type}]`;
    }).join(', ');
}).join(', ');

//Expiration variables

const EXPIRATION_CONFIG = {
    tag: {
        logarithmic_start: 100,
        minimum: JSPLib.utility.one_week,
        maximum: JSPLib.utility.one_month,
    },
    pool: {
        logarithmic_start: 10,
        minimum: JSPLib.utility.one_week,
        maximum: JSPLib.utility.one_month,
    },
    user: {
        minimum: JSPLib.utility.one_month,
    },
    favgroup: {
        minimum: JSPLib.utility.one_week,
    },
    search: {
        minimum: JSPLib.utility.one_week,
    },
    wikipage: {
        logarithmic_start: 100,
        minimum: JSPLib.utility.one_week,
        maximum: JSPLib.utility.one_month,
    },
    artist: {
        logarithmic_start: 10,
        minimum: JSPLib.utility.one_week,
        maximum: JSPLib.utility.one_month,
    },
    forumtopic: {
        minimum: JSPLib.utility.one_week,
    },
};

const POST_COUNT_EXPIRES = JSPLib.utility.one_month;
const RELATED_TAG_EXPIRES = JSPLib.utility.one_week;

//Source variables

const SOURCE_KEY = {
    ac: 'tag',
    pl: 'pool',
    us: 'user',
    fg: 'favgroup',
    ss: 'search',
    ar: 'artist',
    wp: 'wikipage',
    ft: 'forumtopic'
};

const SOURCE_CONFIG = {
    tag1: {
        url: 'autocomplete',
        data: (term) => (
            {
                search: {
                    type: 'tag_query',
                    query: term,
                }
            }
        ),
        map: (tag) => (
            {
                antecedent: tag.antecedent ?? null,
                name: tag.value,
                category: tag.category,
                post_count: tag.post_count,
                source: tag.type,
            }
        ),
        expiration: (d) => (d.length ? ExpirationTime('tag', d[0].post_count) : MinimumExpirationTime('tag')),
        fixupexpiration: false,
        searchstart: true,
        spacesallowed: false
    },
    tag2: {
        url: 'tags',
        data: (term) => (
            {
                search: {
                    name_or_alias_matches: term,
                    hide_empty: true,
                    order: 'count',
                },
                only: 'name,category,post_count,consequent_aliases[antecedent_name]',
            }
        ),
        map: (tag, term) =>
            Object.assign({
                name: tag.name,
                category: tag.category,
                post_count: tag.post_count,
            }, GetConsequentMatch(term, tag))
        ,
        expiration: (d) => (d.length ? ExpirationTime('tag', d[0].post_count) : MinimumExpirationTime('tag')),
        fixupexpiration: false,
        searchstart: true,
        spacesallowed: false
    },
    metatag: {},
    pool: {
        url: 'pools',
        data: (term) => ({
            search: {
                order: 'post_count',
                name_matches: term
            },
            only: 'name,category,post_count'
        }),
        map: (pool) => ({
            name: pool.name,
            post_count: pool.post_count,
            category: pool.category
        }),
        expiration: (d) => (d.length ? ExpirationTime('pool', d[0].post_count) : MinimumExpirationTime('pool')),
        fixupexpiration: false,
        searchstart: false,
        spacesallowed: true,
        render: ($domobj, item) => {
            let html = `
<div class="iac-line-entry iac-pool">
    <span>
        <a class="pool-category-${item.category} autocomplete-item">${item.label}</a>
    </span>
    <span class="post-count">${item.post_count}</span>
</div>`;
            return $(html);
        },
    },
    user: {
        url: 'users',
        data: (term) => ({
            search: {
                order: 'post_upload_count',
                current_user_first: true,
                name_matches: term,
            },
            only: 'name,level_string'
        }),
        map: (user) => ({
            name: user.name,
            level: user.level_string
        }),
        expiration: () => MinimumExpirationTime('user'),
        fixupexpiration: false,
        searchstart: true,
        spacesallowed: false,
        render: ($domobj, item) => {
            let html = `
<div class="iac-line-entry iac-user">
    <span>
        <a class="user-${item.level.toLowerCase()} autocomplete-item">${item.label}</a>
    </span>
</div>`;
            return $(html);
        },
    },
    favgroup: {
        url: 'favorite_groups',
        data: (term) => ({
            search: {
                name_matches: term,
                creator_id: IAC.userid,
            },
            only: 'name,post_ids'
        }),
        map: (favgroup) => ({
            name: favgroup.name,
            post_count: favgroup.post_ids.length,
        }),
        expiration: () => MinimumExpirationTime('favgroup'),
        fixupexpiration: false,
        searchstart: false,
        spacesallowed: true,
        render: ($domobj, item) => {
            let html = `
<div class="iac-line-entry iac-favgroup">
    <span>
        <a class="autocomplete-item">${item.label}</a>
    </span>
    <span class="post-count" style="flex-basis: 10%; text-align: right">${item.post_count}</span>
</div>`;
            return $(html);
        },
    },
    search: {
        url: 'autocomplete',
        data: (term) => ({
            search: {
                type: 'saved_search_label',
                query: term,
            }
        }),
        map: (label) => ({
            name: label.value,
        }),
        expiration: () => MinimumExpirationTime('search'),
        fixupexpiration: false,
        searchstart: true,
        spacesallowed: false,
        render: ($domobj, item) => {
            let html = `
<div class="iac-line-entry iac-search">
    <span>
        <a class="autocomplete-item">${item.label}</a>
    </span>
</div>`;
            return $(html);
        },
    },
    wikipage: {
        url: 'wiki_pages',
        data: (term) => ({
            search: {
                order: 'post_count',
                hide_deleted: true,
                title_ilike: term.replace(/ /g, '_'),
            },
            only: 'title,tag[category,post_count]'
        }),
        map: (wikipage) => ({
            name: wikipage.title,
            category: wikipage.tag?.category || 0,
            post_count: wikipage.tag?.post_count || 0,
            no_tag: !wikipage.tag,
        }),
        expiration: () => MinimumExpirationTime('wikipage'),
        fixupexpiration: true,
        searchstart: true,
        spacesallowed: true,
        render: ($domobj, item) => {
            let count = (item.no_tag ? 'No tag' : item.post_count);
            let html = `
<div class="iac-line-entry iac-wiki-page">
    <span>
        <a class="tag-type-${item.category} autocomplete-item">${item.label}</a>
    </span>
    <span class="post-count">${count}</span>
</div>`;
            return $(html);
        },
    },
    artist: {
        url: 'artists',
        data: (term) => ({
            search: {
                order: 'post_count',
                is_active: true,
                name_like: term.trim().replace(/\s+/g, '_')
            },
            only: 'name,tag[post_count]'
        }),
        map: (artist) => ({
            post_count: artist.tag?.post_count,
            name: artist.name,
            no_tag: !artist.tag,
        }),
        expiration: () => MinimumExpirationTime('artist'),
        fixupexpiration: true,
        searchstart: true,
        spacesallowed: false,
        render: ($domobj, item) => {
            let count = (item.no_tag ? 'No tag' : item.post_count);
            let html = `
<div class="iac-line-entry iac-artist">
    <span>
        <a class="tag-type-1 autocomplete-item">${item.label}</a>
    </span>
    <span class="post-count">${count}</span>
</div>`;
            return $(html);
        },
    },
    forumtopic: {
        url: 'forum_topics',
        data: (term) => ({
            search: {
                order: 'sticky',
                title_ilike: term,
            },
            only: 'title,category_id,response_count'
        }),
        map: (forumtopic) => ({
            response_count: forumtopic.response_count,
            category: forumtopic.category_id,
            name: forumtopic.title,
        }),
        expiration: () => MinimumExpirationTime('forumtopic'),
        fixupexpiration: false,
        searchstart: false,
        spacesallowed: true,
        render: ($domobj, item) => {
            let html = `
<div class="iac-line-entry iac-forum-topic">
    <span>
        <a class="forum-topic-category-${item.category} autocomplete-item">${item.label}</a>
    </span>
    <span class="response-count">${item.response_count}</span>
</div>`;
            return $(html);
        },
    }
};

//Validate constants

const AUTOCOMPLETE_CONSTRAINTS = {
    entry: JSPLib.validate.arrayentry_constraints({maximum: 20}),
    tag: {
        antecedent: JSPLib.validate.stringnull_constraints,
        category: JSPLib.validate.inclusion_constraints(ALL_CATEGORIES.concat(METATAG_TAG_CATEGORY)),
        post_count: JSPLib.validate.postcount_constraints,
        name: JSPLib.validate.stringonly_constraints,
        source: JSPLib.validate.inclusion_constraints(TAG_SOURCES),
    },
    get metatag() {
        return this.tag;
    },
    pool: {
        category: JSPLib.validate.inclusion_constraints(ALL_POOLS),
        post_count: JSPLib.validate.counting_constraints,
        name: JSPLib.validate.stringonly_constraints,
    },
    user: {
        level: JSPLib.validate.inclusion_constraints(ALL_USERS),
        name: JSPLib.validate.stringonly_constraints,
    },
    favgroup: {
        post_count: JSPLib.validate.counting_constraints,
        name: JSPLib.validate.stringonly_constraints,
    },
    search: {
        name: JSPLib.validate.stringonly_constraints,
    },
    artist: {
        post_count: JSPLib.validate.counting_constraints,
        name: JSPLib.validate.stringonly_constraints,
        no_tag: JSPLib.validate.boolean_constraints,
    },
    wikipage: {
        post_count: JSPLib.validate.counting_constraints,
        name: JSPLib.validate.stringonly_constraints,
        category: JSPLib.validate.inclusion_constraints(ALL_CATEGORIES),
        no_tag: JSPLib.validate.boolean_constraints,
    },
    forumtopic: {
        response_count: JSPLib.validate.counting_constraints,
        name: JSPLib.validate.stringonly_constraints,
        category: JSPLib.validate.inclusion_constraints(ALL_TOPICS),
    },
};

const RELATEDTAG_CONSTRAINTS = {
    entry: JSPLib.validate.hashentry_constraints,
    value: {
        category: JSPLib.validate.inclusion_constraints(ALL_RELATED),
        query: JSPLib.validate.stringonly_constraints,
        tags: JSPLib.validate.tagentryarray_constraints,
        tags_overlap: JSPLib.validate.hash_constraints,
        wiki_page_tags: JSPLib.validate.tagentryarray_constraints,
        other_wikis: JSPLib.validate.hash_constraints,
    },
    tags_overlap: JSPLib.validate.basic_integer_validator,
    other_wiki_title: JSPLib.validate.stringonly_constraints,
    other_wiki_value: JSPLib.validate.tagentryarray_constraints,
};

const USAGE_CONSTRAINTS = {
    expires: JSPLib.validate.expires_constraints,
    use_count: {
        numericality: {
            greaterThanOrEqualTo: 0,
        },
    },
};

const COUNT_CONSTRAINTS = {
    expires: JSPLib.validate.expires_constraints,
    value: JSPLib.validate.counting_constraints,
};

/****Functions****/

//Library functions

JSPLib.menu.preloadScript = function (self, program_value, render_menu_func, {run_on_settings = false, default_data = {}, reset_data = {}, initialize_func = null, broadcast_func = null, menu_css = null} = {}) {
    program_value.user_settings = this.loadUserSettings();
    for (let key in program_value.user_settings) {
        Object.defineProperty(program_value, key, {get() {return program_value.user_settings[key];}});
    }
    if (this._isSettingMenu()) {
        this.initializeSettingsMenu(render_menu_func, menu_css);
        if (!run_on_settings) return false;
    }
    if (!this.isScriptEnabled()) {
        self.debug('logLevel', "Script is disabled on", window.location.hostname, JSPLib.debug.INFO);
        return false;
    }
    Object.assign(program_value, {
        controller: document.body.dataset.controller,
        action: document.body.dataset.action,
    }, JSPLib.utility.dataCopy(default_data), JSPLib.utility.dataCopy(reset_data));
    if (typeof broadcast_func == 'function') {
        program_value.channel = JSPLib.utility.createBroadcastChannel(this.program_name, broadcast_func);
    }
    if (typeof initialize_func == 'function') {
        return initialize_func();
    }
    return true;
};

JSPLib.debug.addModuleLogs('menu', ['preloadScript']);

//Validate functions

function ValidateEntry(key, entry) {
    if (!JSPLib.validate.validateIsHash(key, entry)) {
        return false;
    }
    if (key.match(/^(?:ac|pl|us|fg|ss|ar|wp|ft)-/)) {
        return ValidateAutocompleteEntry(key, entry);
    } if (key.match(/^rt[fsl](gen|char|copy|art)?-/)) {
        return ValidateRelatedtagEntry(key, entry);
    } if (key.startsWith('ctat-')) {
        return JSPLib.validate.validateHashEntries(key, entry, COUNT_CONSTRAINTS);
    }
    this.debug('log', "Bad key!");
    return false;
}

function ValidateAutocompleteEntry(key, entry) {
    if (!JSPLib.validate.validateHashEntries(key, entry, AUTOCOMPLETE_CONSTRAINTS.entry)) {
        return false;
    }
    let type = SOURCE_KEY[key.slice(0, 2)];
    for (let i = 0; i < entry.value.length; i++) {
        if (!JSPLib.validate.validateHashEntries(`${key}.value[${i}]`, entry.value[i], AUTOCOMPLETE_CONSTRAINTS[type])) {
            return false;
        }
    }
    return true;
}

function ValidateRelatedtagEntry(key, entry) {
    if (!JSPLib.validate.validateHashEntries(key, entry, RELATEDTAG_CONSTRAINTS.entry)) {
        return false;
    }
    if (!JSPLib.validate.validateHashEntries(key + '.value', entry.value, RELATEDTAG_CONSTRAINTS.value)) {
        return false;
    }
    if (!JSPLib.validate.validateHashValues(key + '.value.tags_overlap', entry.value.tags_overlap, RELATEDTAG_CONSTRAINTS.tags_overlap)) {
        return false;
    }
    for (let title in entry.value.other_wikis) {
        let value = entry.value.other_wikis[title];
        let wiki_key = key + '.value.other_wikis.' + title;
        let check = validate({title}, {title: RELATEDTAG_CONSTRAINTS.other_wiki_title});
        if (check !== undefined) {
            JSPLib.validate.outputValidateError(wiki_key, check);
            return false;
        }
        check = validate({value}, {value: RELATEDTAG_CONSTRAINTS.other_wiki_value});
        if (check !== undefined) {
            JSPLib.validate.outputValidateError(wiki_key, check);
            return false;
        }
    }
    return true;
}

function ValidateProgramData(key, entry) {
    var checkerror = [];
    switch (key) {
        case 'iac-user-settings':
            checkerror = JSPLib.menu.validateUserSettings(entry, SETTINGS_CONFIG);
            break;
        case 'iac-prune-expires':
            if (!Number.isInteger(entry)) {
                checkerror = ["Value is not an integer."];
            }
            break;
        case 'iac-choice-info':
            if (JSPLib.validate.isHash(entry)) {
                checkerror = ValidateUsageData(entry);
            } else {
                checkerror = ['Value is not a hash'];
            }
            break;
        case 'iac-ac-source':
            if (!Number.isInteger(entry) || entry > AUTOCOMPLETE_SOURCE.length || entry < 0) {
                checkerror = [`Value is not an integer between 0 and {AUTOCOMPLETE_SOURCE.length - 1}.`];
            }
            break;
        case 'iac-ac-mode':
            if (!Number.isInteger(entry) || entry > AUTOCOMPLETE_MODE.length || entry < 0) {
                checkerror = [`Value is not an integer between 0 and {AUTOCOMPLETE_MODE.length - 1}.`];
            }
            break;
        case 'iac-ac-caps':
            if (!Number.isInteger(entry) || entry > AUTOCOMPLETE_CAPITALIZATION.length || entry < 0) {
                checkerror = [`Value is not an integer between 0 and {AUTOCOMPLETE_CAPITALIZATION.length - 1}.`];
            }
            break;
        default:
            checkerror = ["Not a valid program data key."];
    }
    if (checkerror.length) {
        JSPLib.validate.outputValidateError(key, checkerror);
        return false;
    }
    return true;
}

//Scalpel validation... removes only data that is bad instead of tossing everything
function ValidateUsageData(choice_info) {
    let error_messages = [];
    let choice_order = choice_info.choice_order;
    let choice_data = choice_info.choice_data;
    if (!JSPLib.validate.isHash(choice_order) || !JSPLib.validate.isHash(choice_data)) {
        error_messages.push("Choice data/order is not a hash.");
        choice_info.choice_order = {};
        choice_info.choice_data = {};
        return error_messages;
    }
    //Validate choice order
    for (let type in choice_order) {
        if (!Array.isArray(choice_order[type])) {
            error_messages.push(`choice_order[${type}] is not an array.`);
            delete choice_order[type];
            continue;
        }
        for (let i = 0; i < choice_order[type].length; i++) {
            if (!JSPLib.validate.isString(choice_order[type][i])) {
                error_messages.push(`choice_order[${type}][${i}] is not a string`);
                choice_order[type].splice(i, 1);
                i--;
            }
        }
    }
    //Validate choice data
    for (let type in choice_data) {
        if (!JSPLib.validate.isHash(choice_data[type])) {
            error_messages.push(`choice_data[${type}] is not a hash`);
            delete choice_data[type];
            continue;
        }
        for (let key in choice_data[type]) {
            let validator = Object.assign({}, AUTOCOMPLETE_CONSTRAINTS[type], USAGE_CONSTRAINTS);
            let check = validate(choice_data[type][key], validator);
            if (check !== undefined) {
                error_messages.push(`choice_data[${type}][${key}]`, check);
                delete choice_data[type][key];
                continue;
            }
            let extra_keys = JSPLib.utility.arrayDifference(Object.keys(choice_data[type][key]), Object.keys(validator));
            if (extra_keys.length) {
                error_messages.push(`Hash contains extra keys: ${type} - ${key}`, extra_keys);
                delete choice_data[type][key];
            }
        }
    }
    //Validate same types between both
    let type_diff = JSPLib.utility.arraySymmetricDifference(Object.keys(choice_order), Object.keys(choice_data));
    if (type_diff.length) {
        error_messages.push("Type difference between choice order and choice data:", type_diff);
        type_diff.forEach((type) => {
            delete choice_order[type];
            delete choice_data[type];
        });
    }
    //Validate same keys between both
    for (let type in choice_order) {
        let key_diff = JSPLib.utility.arraySymmetricDifference(choice_order[type], Object.keys(choice_data[type]));
        if (key_diff.length) {
            error_messages.push("Key difference between choice order and choice data:", type, key_diff);
            key_diff.forEach((key) => {
                choice_order[type] = JSPLib.utility.arrayDifference(choice_order[type], [key]);
                delete choice_data[type][key];
            });
        }
    }
    return error_messages;
}

function ValidateCached(cached, type, term, word_mode) {
    if (!cached) return false;
    if (type !== 'tag') return true;
    if (word_mode) {
        return cached.value.every((item) => GetWordMatches(item.antecedent || item.name, term, false));
    } else {
        return cached.value.every((item) => GetGlobMatches(item.antecedent || item.name, term, false));
    }
}

//Helper functions

function ParseQuery(text, caret) {
    let before_caret_text = text.substring(0, caret);
    let match = before_caret_text.match(TERM_REGEX);
    let operator = match[1];
    let metatag = match[2] ? match[2].toLowerCase() : "tag";
    let term = match[3];
    let prefix = operator;
    if (metatag !== 'tag') {
        prefix += metatag + ':';
    }
    if (IAC.categories.includes(metatag)) {
        metatag = 'tag';
    }
    return { operator, metatag, term, prefix };
}

function RemoveTerm(str, index) {
    str = ' ' + str + ' ';
    let first_slice = str.slice(0, index);
    let second_slice = str.slice(index);
    let first_space = first_slice.lastIndexOf(' ');
    let second_space = second_slice.indexOf(' ');
    return (first_slice.slice(0, first_space) + second_slice.slice(second_space)).slice(1, -1);
}

function GetPrefix(str) {
    if (!(str in GetPrefix.prefixhash)) {
        GetPrefix.prefixhash[str] = str.split('_').map((part) => (part.replace(/[()]/g, "")[0])).join("");
    }
    return GetPrefix.prefixhash[str];
}
GetPrefix.prefixhash = {};

function GetConsequentMatch(term, tag) {
    let retval = {source: 'tag', antecedent: null};
    let regex = RegExp('^' + JSPLib.utility.regexpEscape(term).replace(/\\\*/g, '.*'));
    if (!tag.name.match(regex)) {
        let matching_consequent = tag.consequent_aliases.filter((consequent) => consequent.antecedent_name.match(regex));
        if (matching_consequent.length) {
            retval = {source: 'tag-alias', antecedent: matching_consequent[0].antecedent_name};
        }
    }
    return retval;
}

function GetIsBur() {
    return (IAC.controller === 'bulk-update-requests') && ['edit', 'new'].includes(IAC.action);
}

function GetHasQuickSearchBar() {
    return ['forum-topics', 'forum-posts', 'comments'].includes(IAC.controller);
}

const MapMetatag = (type, metatag, value) => ({
    type,
    antecedent: null,
    label: metatag + ':' + value,
    value: metatag + ':' + value,
    name: metatag + ':' + value,
    post_count: METATAG_TAG_CATEGORY,
    source: 'metatag',
    category: METATAG_TAG_CATEGORY
});

function MetatagData() {
    if (!MetatagData.data) {
        MetatagData.data = ALL_METATAGS
            .filter((tag) => (tag[0] !== '-'))
            .map((tag) => (MapMetatag('tag', tag, "")));
    }
    return MetatagData.data;
}

function SubmetatagData() {
    if (!SubmetatagData.data) {
        SubmetatagData.data = [];
        for (let metatag in STATIC_METATAGS) {
            for (let i = 0; i < STATIC_METATAGS[metatag].length; i++) {
                let submetatag = STATIC_METATAGS[metatag][i];
                SubmetatagData.data.push(MapMetatag('metatag', metatag, submetatag));
            }
        }
    }
    return SubmetatagData.data;
}

function GlobRegex(search, use_capture, return_groups = false) {
    GlobRegex.regexes ||= {};
    GlobRegex.capture_groups ||= {};
    let key = search + '\xff' + use_capture;
    if (!(key in GlobRegex.regexes)) {
        const captureMap = (
                               use_capture ?
                               (val) => (val.slice(0, 2) === String.raw`\*` ? '(.*)' : `(${val})`) :
                               (val) => (val.slice(0, 2) === String.raw`\*` ? '.*' : `${val}`)
                           );
        GlobRegex.capture_groups[key] = JSPLib.utility.findAll(search, /\*|[^*]+/g)
                                           .filter((val) => val !== '')
                                           .map((val) => JSPLib.utility.regexpEscape(val))
                                           .map(captureMap);
        GlobRegex.regexes[key] = new RegExp('^' + GlobRegex.capture_groups[key].join("") + '$', 'i');
    }
    return (return_groups ? GlobRegex.capture_groups[key] : GlobRegex.regexes[key]);
}

function WordRegex(search, use_capture, return_groups = false) {
    WordRegex.regexes ||= {};
    WordRegex.capture_groups ||= {};
    let key = search + '\xff' + use_capture;
    if (!(key in WordRegex.regexes)) {
        let bookend = (use_capture ? '(.*)' : '.*');
        let capture_groups = JSPLib.utility.findAll(search, ALL_DELIMTER_RG)
            .filter((val)=>val !== '')
            .map((word)=>{
                if (word.match(DELIMITER_GROUP_RG)) {
                    return (use_capture ? '(.*)' : '.*');
                }
                let escape_word = JSPLib.utility.regexpEscape(word);
                return DELIMITER_LOOKBEHIND + (use_capture ? `(${escape_word})` : escape_word);
            });
        WordRegex.capture_groups[key] = [bookend, ...capture_groups, bookend];
        WordRegex.regexes[key] = new RegExp(WordRegex.capture_groups[key].join("") + '(.*)', 'i');
    }
    return (return_groups ? WordRegex.capture_groups[key] : WordRegex.regexes[key]);
}

//Get regex from separate function and memoize that value
function GetGlobMatches(name, search, use_capture) {
    let regex = GlobRegex(search, use_capture);
    let match = name.match(regex);
    return match;
}

//Get regex from separate function and memoize that value
function GetWordMatches(name, search, use_capture) {
    let regex = WordRegex(search, use_capture);
    let match = name.match(regex);
    return match;
}

//Time functions

function MinimumExpirationTime(type) {
    return EXPIRATION_CONFIG[type].minimum;
}

function MaximumExpirationTime(type) {
    return (EXPIRATION_CONFIG[type].maximum ? EXPIRATION_CONFIG[type].maximum : EXPIRATION_CONFIG[type].minimum);
}

//Logarithmic increase of expiration time based upon a count
function ExpirationTime(type, count) {
    let config = EXPIRATION_CONFIG[type];
    let expiration = Math.log10(10 * count / config.logarithmic_start) * config.minimum;
    expiration = Math.max(expiration, config.minimum);
    expiration = Math.min(expiration, config.maximum);
    return Math.round(expiration);
}

//Render functions

function AutocompleteRenderItem(list, item) {
    if ('html' in item) {
        return Danbooru.Autocomplete.render_item_old(list, item);
    }
    if (SOURCE_CONFIG[item.type].render) {
        return RenderListItem(SOURCE_CONFIG[item.type].render)(list, item);
    }
    let tag_info = "";
    if (item.antecedent) {
        tag_info = `<span class="autocomplete-tag">${item.label}</span>`;
        let antecedent = item.antecedent.replace(/_/g, " ");
        tag_info = '<span class="autocomplete-arrow">→</span>' + tag_info;
        tag_info = `<span class="autocomplete-antecedent autocomplete-item">${antecedent}</span>` + tag_info;
    } else {
        tag_info = `<span class="autocomplete-tag autocomplete-item">${item.label}</span>`;
    }
    let post_text = "";
    if (item.post_count !== undefined) {
        let count = item.post_count;
        post_text = String(item.post_count);
        if (count >= 1000000) {
            post_text = JSPLib.utility.setPrecision(count / 1000000, 2) + 'M';
        } else if (count >= 1000) {
            post_text = JSPLib.utility.setPrecision(count / 1000, 2) + "k";
        }
    }
    let url = '/posts?tags=' + encodeURIComponent(item.name);
    let link_classes = ['iac-autocomplete-link'];
    if (item.type === 'tag') {
        link_classes.push('tag-type-' + item.category)
    } else if (item.type === 'user') {
        link_classes.push('user-' + item.level.toLowerCase());
    } else if (item.type === 'pool') {
        link_classes.push('pool-category-' + item.category);
    }
    let line_item = `
<span class="iac-tag-info">
    <a href="${url}" class="${link_classes.join(' ')}">${tag_info}</a>
</span>
<span class="post-count">${post_text}</span>`;
    let data_attributes = ["type", "antecedent", "value", "category", "post_count"];
    let data_items = ["type", "antecedent", "value", "category", "post_count"].map((attr) => `data-autocomplete-${attr.replace(/_/g, "-")}="${item[attr]}"`);
    let $list_item = $(`
<li ${data_items.join(' ')}>
    <div class="iac-line-entry iac-query">${line_item}</div>
</li>`);
    $list_item.data("item.autocomplete", item);
    $list_item.find('a').on('click.iac', (event) => {event.preventDefault();});
    return $list_item.appendTo(list);
}

function RenderTaglist(taglist, columnname, tags_overlap, total_posts) {
    let html = "";
    let display_percentage = false;
    var sample_size;
    if (IAC.related_statistics_enabled && JSPLib.validate.isHash(tags_overlap) && Number.isInteger(total_posts)) {
        display_percentage = true;
        let max_posts = Math.min(total_posts, 1000);
        sample_size = Math.max(...Object.values(tags_overlap), max_posts);
    }
    taglist.forEach((tagdata) => {
        let tag = tagdata[0];
        let escaped_tag = JSPLib.utility.HTMLEscape(tag);
        let category = tagdata[1];
        let display_name = tag.replace(/_/g, ' ');
        let search_link = JSPLib.danbooru.postSearchLink(tag, display_name, `class="search-tag" data-tag-name="${escaped_tag}"`);
        let margin_style = 'text-indent: -1.5em; margin-left: 1.5em;';
        let prefix = "";
        if (display_percentage && Number.isInteger(tags_overlap[tag])) {
            let tag_percentage = Math.ceil(100 * (tags_overlap[tag] / sample_size)) || 0;
            let tag_percentage_string = JSPLib.utility.padNumber(tag_percentage, 2) + '%';
            let spacing_style = (tag_percentage >= 100 ? `style="letter-spacing:-2px"` : "");
            prefix = `<span class="iac-tag-statistic" ${spacing_style}>${tag_percentage_string}</span> `;
            margin_style = 'text-indent: -3.3em; margin-left: 3.3em;';
        }
        html += `<div style="${margin_style}">${prefix}<li class="tag-type-${category}" style="display: inline;">${search_link}</li></div>\n`;
    });
    return `
<h6>${columnname}</h6>
<div>
${html}
</div>`;
}

function RenderTagColumns(related_tags, post_count) {
    let is_empty = related_tags.tags.length === 0;
    let display_name = related_tags.query.replace(/_/g, ' ');
    let column = (is_empty ? "" : RenderTaglist(related_tags.tags, display_name, related_tags.tags_overlap, post_count));
    let html = `
<div class="tag-column general-related-tags-column is-empty-${is_empty}">
${column}
</div>`;
    is_empty = related_tags.wiki_page_tags.length === 0;
    column = (is_empty ? "" : RenderTaglist(related_tags.wiki_page_tags, JSPLib.danbooru.wikiLink(related_tags.query, `wiki:${display_name}`, 'target="_blank"')));
    html += `
<div class="tag-column wiki-related-tags-column is-empty-${is_empty}">
${column}
</div>`;
    for (let title in related_tags.other_wikis) {
        let title_name = title.replace(/_/g, ' ');
        column = RenderTaglist(related_tags.other_wikis[title], JSPLib.danbooru.wikiLink(title, `wiki:${title_name}`, 'target="_blank"'));
        html += `
<div class="tag-column wiki-related-tags-column is-empty-false">
${column}
</div>`;
    }
    return html;
}

function RenderListItem(alink_func) {
    return function (list, item) {
        let $link = alink_func($('<a/>'), item);
        let $container = $('<div/>').append($link);
        HighlightSelected($container, list, item);
        return $('<li/>').data('item.autocomplete', item).append($container).appendTo(list);
    };
}

function RenderMenuItem() {
    return function (ul, items) {
        let event_UID = items.UID || IAC.query_UID[items.key];
        if (Number.isInteger(event_UID)) {
            JSPLib.debug.debugTime('renderitem-' + event_UID);
        }
        items.forEach((item)=>{
            this._renderItemData(ul, item);
        });
        if (Number.isInteger(event_UID)) {
            JSPLib.debug.debugTimeEnd('renderitem-' + event_UID);
            JSPLib.debug.debugTimeEnd('autocomplete-' + event_UID);
        }
    };
}

function RenderRelatedQueryControls() {
    let html = "";
    RELATED_QUERY_TYPES.forEach((type) => {
        let checked = (IAC.related_query_default[0] === type ? 'checked' : "");
        let display_name = JSPLib.utility.displayCase(type);
        html += `
<label for="related_query_${type}">${display_name}</label>
<input id="related_query_${type}" class="iac-program-checkbox" type="radio" name="related_query_type" data-selector="${type}" ${checked}>`;
    });
    return `
<div id="iac-related-query-type">
    ${html}
</div>`;
}

function RenderAutocompleteNotice(type, list, index) {
    let values = list.map((val, i) => (index === i ? `<u>${val}</u>` : val));
    let line = values.join('&nbsp;|&nbsp;');
    return `<b>Autocomplete ${type}</b>: ${line}`;
}

//Main helper functions

function CapitalizeAutocomplete(string) {
    switch (IAC.ac_caps) {
        case 1:
            return string.toUpperCase();
        case 2:
            return JSPLib.utility.titleizeString(string);
        case 3:
            return JSPLib.utility.properCase(string);
        case 4:
            return JSPLib.utility.exceptCase(string);
        case 5:
            return JSPLib.utility.romanCase(string);
        case 0:
        default:
            return string;
    }
}

function FixupMetatag(value, metatag) {
    switch(metatag) {
        case '@':
            value.value = '@' + value.name;
            value.label = value.name;
            break;
        case "":
            value.value = value.name;
            value.label = value.name.replace(/_/g, ' ');
            break;
        default:
            metatag = metatag.replace(/:$/, "");
            value.value = metatag + ':' + value.name;
            value.label = value.name.replace(/_/g, ' ');
    }
}

function SortSources(data) {
    var scaler;
    switch(IAC.postcount_scale[0]) {
        case 'logarithmic':
            scaler = ((num) => Math.log(num));
            break;
        case 'square_root':
            scaler = ((num) => Math.sqrt(num));
            break;
        case 'linear':
        default:
            scaler = ((num) => num);
    }
    data.sort((a, b) => {
        let mult_a = IAC[`${a.source}_source_weight`];
        let mult_b = IAC[`${b.source}_source_weight`];
        let weight_a = mult_a * scaler(a.post_count);
        let weight_b = mult_b * scaler(b.post_count);
        return weight_b - weight_a;
    }).forEach((entry, i) => {
        data[i] = entry;
    });
}

function GroupSources(data) {
    let source_order = IAC.source_order;
    data.sort((a, b) => (source_order.indexOf(a.source) - source_order.indexOf(b.source)));
}

function FixExpirationCallback(key, value, tagname, type) {
    this.debug('log', "Fixing expiration:", tagname);
    JSPLib.danbooru.submitRequest('tags', {search: {name: tagname}}).then((data) => {
        if (!data.length) {
            return;
        }
        let expiration_time = ExpirationTime(type, data[0].post_count);
        JSPLib.storage.saveData(key, {value, expires: JSPLib.utility.getExpires(expiration_time)});
    });
}

function GetArtistData(url) {
    let urlkey = 'af-' + url;
    let refkey = 'ref-' + url;
    let data = JSPLib.storage.getStorageData(urlkey, sessionStorage);
    if (data) {
        return data;
    }
    let redirect = JSPLib.storage.getStorageData(refkey, sessionStorage);
    if (redirect) {
        this.debug('log', "Redirect found!", redirect);
        return JSPLib.storage.getStorageData(redirect, sessionStorage);
    }
}

function SaveArtistData() {
    let url = $('#upload_source, #post_source').val();
    let ref = $('#upload_referer_url').val();
    if (!url.match(/^https?:\/\//)) {
        return;
    }
    let urlkey = 'af-' + url;
    let refkey = 'ref-' + ref;
    let source_info = LZString.compressToUTF16($('#source-info').html());
    let source_column = LZString.compressToUTF16($('.source-related-tags-columns').html());
    this.debug('log', "Saving", urlkey);
    JSPLib.storage.setStorageData(urlkey, {source_info, source_column}, sessionStorage);
    if (ref) {
        this.debug('log', "Saving", refkey);
        JSPLib.storage.setStorageData(refkey, urlkey, sessionStorage);
    }
}

function GetRelatedKeyModifer(category, query_type) {
    let query_modifier = "";
    if (['frequent', 'similar', 'like'].includes(query_type)) {
        query_modifier = query_type[0];
    } else if(category) {
        query_modifier = 'f';
    } else {
        query_modifier = 's';
    }
    return 'rt' + query_modifier + (category ? JSPLib.danbooru.getShortName(category) : "");
}

//Network functions

async function GetPostCount(tag) {
    let key = 'ctat-' + tag;
    this.debug('log', "Checking:", tag);
    let cached = await JSPLib.storage.checkLocalDB(key, ValidateEntry, POST_COUNT_EXPIRES);
    if (!cached) {
        this.debug('log', "Querying:", tag);
        let data = await JSPLib.danbooru.submitRequest('counts/posts', {tags: tag}, {default_val: {counts: {posts: 0}}});
        cached = {value: data.counts.posts, expires: JSPLib.utility.getExpires(POST_COUNT_EXPIRES)};
        JSPLib.storage.saveData(key, cached);
    }
    this.debug('log', "Found:", tag, cached.value);
    return cached.value;
}

async function GetRelatedTags(tag, category, query_type) {
    let key = GetRelatedKeyModifer(category, query_type) + '-' + tag;
    this.debug('log', "Checking:", key, category);
    let cached = await JSPLib.storage.checkLocalDB(key, ValidateEntry, RELATED_TAG_EXPIRES);
    if (!cached) {
        this.debug('log', "Querying:", tag, category);
        let url_addons = {query: tag, category};
        if (['frequent', 'similar', 'like'].includes(query_type)) {
            url_addons.type = query_type;
        }
        if (IAC.related_results_limit > 0) {
            url_addons.limit = IAC.related_results_limit;
        }
        let data = await JSPLib.danbooru.submitRequest('related_tag', url_addons);
        cached = {value: data, expires: JSPLib.utility.getExpires(RELATED_TAG_EXPIRES)};
        JSPLib.storage.saveData(key, cached);
    }
    this.debug('log', "Found:", tag, category, cached.value);
    return cached.value;
}

//Usage functions

function KeepSourceData(type, metatag, data) {
    IAC.source_data[type] = IAC.source_data[type] || {};
    data.forEach((val) => {
        let orig_key = val.name.replace(RegExp(`^${metatag}:?`), "");
        let key = (val.antecedent ? val.antecedent + '\xff' + orig_key : orig_key);
        IAC.source_data[type][key] = val;
    });
}

function GetChoiceOrder(type, query, word_mode) {
    let queryterm = query.toLowerCase() + (type === 'metatag' && !query.endsWith('*') ? '*' : "");
    let regex = (word_mode ? WordRegex(queryterm, false) : GlobRegex(queryterm, false));
    let available_choices = IAC.choice_order[type].filter((name) => {
        return name.toLowerCase().match(regex);
    });
    let sortable_choices = available_choices.filter((tag) => (IAC.choice_data[type][tag].use_count > 0));
    sortable_choices.sort((a, b) => IAC.choice_data[type][b].use_count - IAC.choice_data[type][a].use_count);
    return JSPLib.utility.arrayUnique(sortable_choices.concat(available_choices));
}

function AddUserSelected(type, metatag, term, data, query_type, word_mode, key) {
    IAC.shown_data = [];
    let order = IAC.choice_order[type];
    let choice = IAC.choice_data[type];
    if (!order || !choice) {
        return;
    }
    let user_order = GetChoiceOrder(type, term, word_mode);
    for (let i = user_order.length - 1; i >= 0; i--) {
        let checkterm = user_order[i];
        if (query_type === 'tag' && choice[checkterm].category === METATAG_TAG_CATEGORY) {
            continue;
        }
        //Splice out Danbooru data if it exists
        for (let j = 0; j < data.length; j++) {
            let compareterm = (data[j].antecedent ? data[j].antecedent + '\xff' + data[j].name : data[j].name);
            if (compareterm === checkterm) {
                data.splice(j, 1);
                //Should only be one of these at most
                break;
            }
        }
        let add_data = Object.assign({}, choice[user_order[i]], {term, key, type});
        if (type === 'tag' && ['tag', 'tag-word'].includes(add_data.source)) {
            add_data.source = (word_mode ? 'tag-word' : 'tag');
        }
        FixupMetatag(add_data, metatag);
        data.unshift(add_data);
        IAC.shown_data.push(user_order[i]);
    }
    data.splice(IAC.source_results_returned);
}

//For autocomplete select
function InsertUserSelected(data, input, selected) {
    if (!IAC.usage_enabled || !$(input).hasClass('iac-autocomplete')) {
        return;
    }
    var type, item, term, source_data;
    //Being hamstrung by Danbooru's select function of the multi-source tag complete
    if (typeof selected === 'string') {
        let autocomplete = $(input).autocomplete('instance');
        let list_container = autocomplete.menu.element[0];
        let $links = $('.ui-state-active', list_container).parent();
        if ($links.length === 0) {
            $links = $('.ui-menu-item:first-of-type', list_container);
        }
        item = $links.data('item.autocomplete');
        if (!item) {
            this.debug('log', "Error: No autocomplete data found!", $links, item);
            return;
        }
        type = item.type;
        if (!type) {
            let autocomplete_type = $(input).data('autocomplete');
            if (autocomplete_type === 'tag-query' || autocomplete_type === 'tag-edit') {
                let match = selected.match(TERM_REGEX);
                type = (match[2] && match[3].length ? match[2] : 'tag');
            } else {
                type = autocomplete_type.replace(/-/g, "");
            }
        }
    } else {
        item = selected;
        type = SOURCE_KEY[data];
    }
    if (item.category === BUR_TAG_CATEGORY) {
        return;
    }
    if ($(input).data('multiple') === false) {
        input.name = input.name.trim();
    }
    if (item.antecedent) {
        term = item.antecedent + '\xff' + item.name;
    } else {
        term = item.name;
    }
    if (item.category === METATAG_TAG_CATEGORY) {
        if (item.type === 'tag') {
            input.selectionStart = input.selectionEnd = input.selectionStart - 1;
            setTimeout(() => {$(input).autocomplete('search');}, 100);
        }
        source_data = item;
    } else if (item.source === 'tag-abbreviation') {
        source_data = item;
    } else
    //Final failsafe
    if (!IAC.source_data[type] || !IAC.source_data[type][term]) {
        if (!IAC.choice_data[type] || !IAC.choice_data[type][term]) {
            this.debug('log', "Error: Bad data selector!", type, term, selected, data, item);
            return;
        }
        source_data = IAC.choice_data[type][term];
    } else {
        source_data = IAC.source_data[type][term];
    }
    IAC.choice_order[type] = IAC.choice_order[type] || [];
    IAC.choice_data[type] = IAC.choice_data[type] || {};
    IAC.choice_order[type].unshift(term);
    IAC.choice_order[type] = JSPLib.utility.arrayUnique(IAC.choice_order[type]);
    //So the use count doesn't get squashed by the new variable assignment
    let use_count = (IAC.choice_data[type][term] && IAC.choice_data[type][term].use_count) || 0;
    IAC.choice_data[type][term] = JSPLib.utility.dataCopy(source_data);
    ['key', 'term', 'label', 'value', 'type'].forEach((e) => {delete IAC.choice_data[type][term][e];});
    IAC.choice_data[type][term].expires = JSPLib.utility.getExpires(GetUsageExpires());
    IAC.choice_data[type][term].use_count = use_count + 1;
    if (IAC.usage_maximum > 0) {
        IAC.choice_data[type][term].use_count = Math.min(IAC.choice_data[type][term].use_count, IAC.usage_maximum);
    }
    IAC.shown_data.forEach((key) => {
        if (key !== term) {
            IAC.choice_data[type][key].use_count = IAC.choice_data[type][key].use_count || 0;
            IAC.choice_data[type][key].use_count *= IAC.usage_multiplier;
        }
    });
    StoreUsageData('insert', term);
}

function InsertCompletion(input, completion) {
    if (!$(input).hasClass('iac-autocomplete')) {
        Danbooru.Autocomplete.insert_completion_old(input, completion);
        return;
    }
    // Trim all whitespace (tabs, spaces) except for line returns
    var before_caret_text = input.value.substring(0, input.selectionStart).replace(/^[ \t]+|[ \t]+$/gm, "");
    var after_caret_text = input.value.substring(input.selectionStart).replace(/^[ \t]+|[ \t]+$/gm, "");
    var regexp = new RegExp('(' + IAC.prefixes.join('|') + ')?\\S+$', 'g');
    let $input = $(input);
    let start = 0, end = 0;
    if ($input.data('insert-autocomplete')) {
        let display_text = completion;
        let current_mode = AUTOCOMPLETE_MODE[IAC.ac_mode];
        if (['tag', 'normal'].includes(current_mode)) {
            if (current_mode === 'normal') {
                display_text = display_text.replace(/_/g, ' ');
                display_text = CapitalizeAutocomplete(display_text);
            }
            before_caret_text = before_caret_text.replace(regexp, '$1') + '[[' + display_text + ']]';
            start = end = before_caret_text.length;
        } else if (['pipe', 'custom'].includes(current_mode)) {
            let insert_text = "insert text";
            if (current_mode === 'pipe') {
                display_text = display_text.replace(/_/g, ' ');
                display_text = CapitalizeAutocomplete(display_text);
                insert_text = "";
            }
            before_caret_text = before_caret_text.replace(regexp, '$1') + `[[${display_text}|${insert_text}]]`;
            if (current_mode === 'pipe') {
                start = end = before_caret_text.length;
            } else {
                //Current mode == custom
                start = before_caret_text.length - 13;
                end = before_caret_text.length - 2;
            }
        }
        setTimeout(() => {DisableTextAreaAutocomplete($input);}, 100);
    } else {
        var query = ParseQuery(input.value, input.selectionStart);
        var select = ParseQuery(completion, completion.length);
        before_caret_text = before_caret_text.substring(0, before_caret_text.search(/\S+$/));
        var prefix = (query.metatag !== "tag" ? (query.prefix || select.prefix) : query.operator);
        var name = (query.metatag === "tag" ? completion : select.term);
        before_caret_text += prefix + name + ' ';
        start = end = before_caret_text.length;
    }
    input.value = before_caret_text + after_caret_text;
    input.selectionStart = start;
    input.selectionEnd = end;
}

function StaticMetatagSource(term, metatag) {
    let lower_term = term.toLowerCase();
    let full_term = `${metatag}:${lower_term}`;
    let data = SubmetatagData()
        .filter((item) => item.name.startsWith(full_term))
        .map((item) => Object.assign({}, item, {term}))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, IAC.source_results_returned);
    AddUserSelected('metatag', "", full_term, data, false, null);
    return data;
}

//For autocomplete render
function HighlightSelected($link, list, item) {
    if (IAC.source_highlight_enabled) {
        if (item.expires) {
            $($link).addClass('iac-user-choice');
        }
        if (item.type === 'tag' || item.type === 'metatag') {
            $($link).addClass('iac-tag-highlight');
            switch (item.source) {
                case 'tag':
                    $($link).addClass('iac-tag-exact');
                    break;
                case 'tag-word':
                    $($link).addClass('iac-tag-word');
                    break;
                case 'tag-abbreviation':
                    $($link).addClass('iac-tag-abbreviation');
                    break;
                case 'tag-alias':
                    $($link).addClass('iac-tag-alias');
                    break;
                case 'tag-autocorrect':
                    $($link).addClass('iac-tag-autocorrect');
                    break;
                case 'tag-other-name':
                    $($link).addClass('iac-tag-other-name');
                    break;
                case 'bur':
                    $($link).addClass('iac-tag-bur');
                    break;
                case 'metatag':
                    $($link).addClass('iac-tag-metatag');
                    //falls through
                default:
                    //Do nothing
            }
        }
        if (IAC.highlight_used && IAC.current_tags.includes(item.name)) {
            $($link).addClass('iac-already-used');
        }
    }
    if (IAC.highlight_words_enabled) {
        let term = item.term;
        if (item.type === 'tag' || item.type === 'metatag') {
            term += (item.source === 'metatag' && !item.term.endsWith('*') ? '*' : "");
            let [tagname, tagclass] = (item.antecedent ? [item.antecedent, 'autocomplete-antecedent'] : [item.name, 'autocomplete-tag']);
            let highlight_html = (item.source === 'tag-word' ? HighlightWords(term, tagname) : HighlightGlobs(term, tagname, item.type));
            if (highlight_html) {
                $link.find('.' + tagclass).html(highlight_html);
            }
        } else {
            let value = term;
            let highlight_html = HighlightGlobs(value, item.name);
            if (highlight_html) {
                $link.find('a').html(highlight_html);
            }
        }
    }
    if (item.source == 'metatag') {
        $('a', $link).addClass('tag-type-' + item.category);
        $('.post-count', $link).text('metatag');
    }
    if (item.type === 'tag') {
        $($link).attr('data-autocomplete-type', item.source);
    }
    return $link;
}

function HighlightWords(search, name) {
    let regex = WordRegex(search, true);
    let capture_groups = WordRegex(search, true, true);
    let word_match = name.match(regex);
    if (!word_match) return null;
    let html_sections = word_match.slice(1).map((match, i) => {
        let label = match.replace(/_/g, "&ensp;");
        return (capture_groups[i] !== '(.*)' ? `<span class="iac-highlight-match iac-word-match">${label}</span>` : label);
    });
    return html_sections.join("");
}

function HighlightGlobs(search, name) {
    let regex = GlobRegex(search, true);
    let capture_groups = GlobRegex(search, true, true);
    let glob_match = name.match(regex);
    if (!glob_match) return null;
    let html_sections = glob_match.slice(1).map((match, i) => {
        let label = match.replace(/_/g, "&ensp;");
        return (capture_groups[i] !== '(.*)' ? `<span class="iac-highlight-match iac-glob-match">${label}</span>` : label);
    });
    return html_sections.join("");
}

function CorrectUsageData() {
    let error_messages = ValidateUsageData(IAC);
    if (error_messages.length) {
        this.debug('log', "Corrections to usage data detected!");
        error_messages.forEach((error) => {this.debug('log', error);});
        StoreUsageData('correction');
    } else {
        this.debug('log', "Usage data is valid.");
    }
}

function PruneUsageData() {
    let is_dirty = false;
    for (let type_key in IAC.choice_data) {
        let type_entry = IAC.choice_data[type_key];
        for (let key in type_entry) {
            let entry = type_entry[key];
            if (!JSPLib.utility.validateExpires(entry.expires, GetUsageExpires())) {
                this.debug('log', "Pruning choice data!", type_key, key);
                IAC.choice_order[type_key] = JSPLib.utility.arrayDifference(IAC.choice_order[type_key], [key]);
                delete type_entry[key];
                is_dirty = true;
            }
        }
    }
    if (is_dirty) {
        StoreUsageData('prune');
    }
}

function StoreUsageData(name, key = "", save = true) {
    if (save) {
        JSPLib.storage.setStorageData('iac-choice-info', {choice_order: IAC.choice_order, choice_data: IAC.choice_data}, localStorage);
    }
    IAC.channel.postMessage({type: 'reload', name, key, choice_order: IAC.choice_order, choice_data: IAC.choice_data});
}

//Non-autocomplete storage

async function RelatedTagsButton(event) {
    let currenttag = Danbooru.RelatedTag.current_tag().trim().toLowerCase();
    let category = $(event.target).data('category') || "";
    let query_type = JSPLib.menu.getCheckboxRadioSelected('.iac-program-checkbox');
    let promise_array = [GetRelatedTags(currenttag, category, query_type[0])];
    if (IAC.related_statistics_enabled) {
        promise_array.push(GetPostCount(currenttag));
    } else {
        promise_array.push(Promise.resolve(null));
    }
    let [related_tags, post_count] = await Promise.all(promise_array);
    if (!related_tags) {
        return;
    }
    $('#related-tags-container .current-related-tags-columns').html(RenderTagColumns(related_tags, post_count));
    Danbooru.RelatedTag.update_selected();
    Danbooru.RelatedTag.show();
}

async function FindArtistSession() {
    var url = $('#post_source').val();
    if (!url || !url.match(/^https?:\/\//)) {
        return;
    }
    let urlkey = 'af-' + url;
    this.debug('log', "Checking artist", urlkey);
    let data = GetArtistData(url);
    if (data) {
        this.debug('log', "Found artist data", urlkey);
        $('#source-info').html(LZString.decompressFromUTF16(data.source_info));
        $('.source-related-tags-columns').html(LZString.decompressFromUTF16(data.source_column));
        Danbooru.RelatedTag.update_selected();
    } else {
        this.debug('log', "Missing artist data", urlkey);
        $('#source-info').addClass('loading');
        try {
            await $.get('/source.js', {url});
            SaveArtistData();
        } catch (e) {
            //swallow
        }
        $('#source-info').removeClass('loading');
    }
}

//Event handlers

function RelatedTagsEnter() {
    $(document).on(PROGRAM_KEYDOWN + '.scroll', null, 'left right', RelatedTagsScroll);
}

function RelatedTagsLeave() {
    $(document).off(PROGRAM_KEYDOWN + '.scroll');
}

function RelatedTagsScroll(event) {
    let $related_tags = $('.related-tags');
    let current_left = $related_tags.prop('scrollLeft');
    if (event.originalEvent.key === 'ArrowLeft') {
        current_left -= 40;
    } else if (event.originalEvent.key === 'ArrowRight') {
        current_left += 40;
    }
    $related_tags.prop('scrollLeft', current_left);
}

////Setup functions

function RebindRender() {
    $(AUTOCOMPLETE_REBIND_SELECTORS).each((i, entry) => {
        let render_set = $(entry).data('iac-render');
        let autocomplete = $(entry).data('uiAutocomplete');
        if (!render_set && autocomplete) {
            autocomplete._renderItem = Danbooru.Autocomplete.render_item;
            autocomplete._renderMenu = RenderMenuItem();
            $(entry).data('iac-render', true);
        }
    });
}

function DelayInitializeAutocomplete(...args) {
    setTimeout(() => {InitializeAutocompleteIndexed(...args);}, JQUERY_DELAY);
}

function DelayInitializeTagAutocomplete(selector, type) {
    if (selector && type) {
        $(selector).attr('data-autocomplete', type);
    }
    clearTimeout(DelayInitializeTagAutocomplete.timer);
    DelayInitializeTagAutocomplete.timer = setTimeout(DanbooruIntializeTagAutocomplete, JQUERY_DELAY);
}

//Rebind callback functions

function RebindRenderCheck() {
    JSPLib.utility.recheckTimer({
        check: () => !JSPLib.utility.hasDOMDataKey(AUTOCOMPLETE_REBIND_SELECTORS, 'iac-render'),
        exec: RebindRender,
    }, TIMER_POLL_INTERVAL, JSPLib.utility.one_second * 5);
}

function RebindRelatedTags() {
    //Only need to check one of them, since they're all bound at the same time
    JSPLib.utility.recheckTimer({
        check: () => JSPLib.utility.isNamespaceBound(document, 'click', 'danbooru', '.related-tags-button'),
        exec: () => {
            $(document).off('click.danbooru', '.related-tags-button');
            $(document).on('click.danbooru', '.related-tags-button', RelatedTagsButton);
        }
    }, TIMER_POLL_INTERVAL);
}

function RebindOpenEditMenu() {
    JSPLib.utility.recheckTimer({
        check: () => JSPLib.utility.isGlobalFunctionBound('danbooru:show-related-tags'),
        exec: () => {
            IAC.cached_data = true;
            InitializeShowRelatedTags();
        }
    }, TIMER_POLL_INTERVAL);
}

function RebindAnyAutocomplete(selector, keycode, multiple) {
    JSPLib.utility.recheckTimer({
        check: () => JSPLib.utility.hasDOMDataKey(selector, 'uiAutocomplete'),
        exec: () => {
            $(selector).autocomplete('destroy').off('keydown.Autocomplete.tab');
            InitializeAutocompleteIndexed(selector, keycode, multiple);
        }
    }, TIMER_POLL_INTERVAL);
}

function RebindMultipleTag() {
    JSPLib.utility.recheckTimer({
        check: () => JSPLib.utility.hasDOMDataKey(AUTOCOMPLETE_MULTITAG_SELECTORS, 'uiAutocomplete'),
        exec: () => {
            $(AUTOCOMPLETE_MULTITAG_SELECTORS).autocomplete('destroy').off('keydown.Autocomplete.tab');
            DanbooruIntializeTagAutocomplete();
        }
    }, TIMER_POLL_INTERVAL);
}

function RebindSingleTag() {
    JSPLib.utility.recheckTimer({
        check: () => JSPLib.utility.hasDOMDataKey('[data-autocomplete=tag]', 'uiAutocomplete'),
        exec: () => {
            let autocomplete = AnySourceIndexed('ac', true);
            let $fields = $('[data-autocomplete=tag]');
            $fields.autocomplete('destroy').off('keydown.Autocomplete.tab');
            $fields.autocomplete({
                minLength: 1,
                autoFocus: true,
                async source(request, respond) {
                    let results = await autocomplete.call(this, request.term);
                    respond(results);
                },
                select (event, ui) {
                    InsertUserSelected('ac', this, ui.item);
                },
            });
            $fields.addClass('iac-autocomplete');
            setTimeout(() => {
                $fields.each((i, field) => {
                    let autocomplete = $(field).data('uiAutocomplete');
                    autocomplete._renderItem = Danbooru.Autocomplete.render_item;
                    autocomplete._renderMenu = RenderMenuItem();
                });
            }, JQUERY_DELAY);
        }
    }, TIMER_POLL_INTERVAL);
}

function ReorderAutocompleteEvent($obj) {
    function RequeueEvent(str, event_array) {
        let position = event_array.findIndex((event) => event.namespace.startsWith(str));
        let item = event_array.splice(position, 1);
        event_array.unshift(item[0]);
    }
    try {
        let private_data = JSPLib.utility.getPrivateData($obj[0]);
        let keydown_events = JSPLib.utility.getNestedAttribute(private_data, ['events', 'keydown']);
        RequeueEvent('autocomplete', keydown_events);
        //The tab event handler must go before the autocomplete handler
        RequeueEvent('Autocomplete.Tab', keydown_events);
    } catch (error) {
        JSPLib.debug.debugerror("Unable to reorder autocomplete events!", error);
    }
}

//Initialization functions

function DanbooruIntializeTagAutocomplete() {
    var $fields_multiple = $(AUTOCOMPLETE_MULTITAG_SELECTORS);
    $fields_multiple.autocomplete({
        select(event, ui) {
            if (event.key === "Enter") {
                event.stopImmediatePropagation();
            }
            Danbooru.Autocomplete.insert_completion(this, ui.item.name);
            return false;
        },
        async source(req, resp) {
            var query = ParseQuery(req.term, this.element.get(0).selectionStart);
            var metatag = query.metatag;
            var term = query.term;
            var prefix = query.prefix;
            var results = [];
            switch (metatag) {
                case "order":
                case "status":
                case "rating":
                case "locked":
                case "child":
                case "parent":
                case "filetype":
                case "disapproved":
                case "embedded":
                case "commentary":
                case "is":
                case "has":
                    results = Danbooru.Autocomplete.static_metatag_source(term, metatag);
                    break;
                case "user":
                case "approver":
                case "commenter":
                case "comm":
                case "noter":
                case "noteupdater":
                case "commentaryupdater":
                case "artcomm":
                case "fav":
                case "ordfav":
                case "appealer":
                case "flagger":
                case "upvote":
                case "downvote":
                    results = await Danbooru.Autocomplete.user_source(term, prefix);
                    break;
                case "pool":
                case "ordpool":
                    results = await Danbooru.Autocomplete.pool_source(term, prefix);
                    break;
                case "favgroup":
                case "ordfavgroup":
                    results = await Danbooru.Autocomplete.favorite_group_source(term, prefix, Danbooru.CurrentUser.data("id"));
                    break;
                case "search":
                    results = await Danbooru.Autocomplete.saved_search_source(term, prefix);
                    break;
                case "tag":
                    results = await Danbooru.Autocomplete.tag_source(term);
                    break;
                default:
                    results = [];
                    break;
            }
            resp(results);
        },
    });
    $fields_multiple.each((i, entry) => {
        let autocomplete = $(entry).data('uiAutocomplete');
        autocomplete._renderItem = Danbooru.Autocomplete.render_item;
        autocomplete._renderMenu = RenderMenuItem();
    });
    let $tag_input_fields = $("#upload_tag_string, #post_tag_string");
    if ($tag_input_fields.length) {
        ReorderAutocompleteEvent($tag_input_fields);
    }
    $fields_multiple.addClass('iac-autocomplete');
}

function InitializeAutocompleteIndexed(selector, keycode, multiple = false, wiki = false) {
    let type = SOURCE_KEY[keycode];
    var $fields = $(selector);
    let autocomplete = AnySourceIndexed(keycode, true);
    $fields.autocomplete({
        minLength: 1,
        delay: 100,
        async source(request, respond) {
            var term;
            if (multiple || wiki) {
                term = ParseQuery(request.term, this.element.get(0).selectionStart).term;
                if (!term) {
                    respond([]);
                    return;
                }
            } else {
                term = request.term;
            }
            let results = await autocomplete.call(this, term);
            respond(results);
        },
        select (event, ui) {
            InsertUserSelected(keycode, this, ui.item);
            if (wiki) {
                InsertCompletion(this, ui.item.name);
                event.stopImmediatePropagation();
                return false;
            } if (multiple) {
                if (event.key === 'Enter') {
                    event.stopImmediatePropagation();
                }
                Danbooru.Autocomplete.insert_completion_old(this, ui.item.name);
                return false;
            }
            ui.item.name = ui.item.name.trim();
            return ui.item.name;
        },
    });
    let alink_func = (SOURCE_CONFIG[type].render ? SOURCE_CONFIG[type].render : ($domobj, item) => $domobj.text(item.name));
    setTimeout(() => {
        $fields.each((i, field) => {
            let autocomplete = $(field).data('uiAutocomplete');
            if (wiki) {
                autocomplete._renderItem = Danbooru.Autocomplete.render_item;
            } else {
                autocomplete._renderItem = RenderListItem(alink_func);
            }
            autocomplete._renderMenu = RenderMenuItem();
        });
    }, JQUERY_DELAY);
    if (!JSPLib.utility.isNamespaceBound(selector, 'keydown', 'Autocomplete.tab')) {
        $fields.on('keydown.Autocomplete.tab', null, 'tab', Danbooru.Autocomplete.on_tab);
    }
    $fields.data('autocomplete', type);
    $fields.data('multiple', multiple || wiki);
    $fields.addClass('iac-autocomplete');
}

function InitializeTextAreaAutocomplete() {
    IAC.ac_source = JSPLib.storage.getStorageData('iac-ac-source', localStorage, 0);
    IAC.ac_mode = JSPLib.storage.getStorageData('iac-ac-mode', localStorage, 0);
    IAC.ac_caps = JSPLib.storage.getStorageData('iac-ac-caps', localStorage, 0);
    $('textarea:not([data-autocomplete]), input[type=text]:not([data-autocomplete])').on(PROGRAM_KEYDOWN, null, 'alt+a', (event) => {
        let $input = $(event.currentTarget);
        let type = AUTOCOMPLETE_SOURCE[IAC.ac_source];
        if (!$input.data('insert-autocomplete')) {
            EnableTextAreaAutocomplete($input, type);
        } else {
            DisableTextAreaAutocomplete($input, type);
        }
    }).data('insert-autocomplete', false);
    $('textarea:not([data-autocomplete]), input[type=text]:not([data-autocomplete])').on(PROGRAM_KEYDOWN, null, 'alt+1 alt+2 alt+3', (event) => {
        if (event.originalEvent.key === '1') {
            IAC.ac_source = (IAC.ac_source + 1) % AUTOCOMPLETE_SOURCE.length;
            JSPLib.notice.notice(RenderAutocompleteNotice('source', AUTOCOMPLETE_SOURCE, IAC.ac_source));
            JSPLib.storage.setStorageData('iac-ac-source', IAC.ac_source, localStorage);
        } else if (event.originalEvent.key === '2') {
            IAC.ac_mode = (IAC.ac_mode + 1) % AUTOCOMPLETE_MODE.length;
            JSPLib.notice.notice(RenderAutocompleteNotice('mode', AUTOCOMPLETE_MODE, IAC.ac_mode));
            JSPLib.storage.setStorageData('iac-ac-mode', IAC.ac_mode, localStorage);
        } else if (event.originalEvent.key === '3') {
            IAC.ac_caps = (IAC.ac_caps + 1) % AUTOCOMPLETE_CAPITALIZATION.length;
            JSPLib.notice.notice(RenderAutocompleteNotice('capitalization', AUTOCOMPLETE_CAPITALIZATION, IAC.ac_caps));
            JSPLib.storage.setStorageData('iac-ac-caps', IAC.ac_caps, localStorage);
        }
        IAC.channel.postMessage({type: 'text_autocomplete', source: IAC.ac_source, mode: IAC.ac_mode, caps: IAC.ac_caps});
    });
}

function EnableTextAreaAutocomplete($input, type) {
    if ($input.closest('.autocomplete-mentions').length > 0) {
        $input.autocomplete('destroy').off('keydown.Autocomplete.tab');
    }
    let input_selector = JSPLib.utility.getHTMLTree($input[0]);
    let type_shortcut = PROGRAM_DATA_KEY[type];
    InitializeAutocompleteIndexed(input_selector, type_shortcut, false, true);
    $input.data('insert-autocomplete', true);
    $input.data('autocomplete', 'tag-edit');
    JSPLib.notice.notice(JSPLib.utility.sprintf(AUTOCOMPLETE_MESSAGE, AUTOCOMPLETE_SOURCE[IAC.ac_source], AUTOCOMPLETE_MODE[IAC.ac_mode], AUTOCOMPLETE_CAPITALIZATION[IAC.ac_caps]));
}

function DisableTextAreaAutocomplete($input) {
    $input.autocomplete('destroy').off('keydown.Autocomplete.tab');
    $input.data('insert-autocomplete', false);
    $input.data('autocomplete', "");
    JSPLib.notice.notice("<b>Autocomplete turned off!</b>");
    if ($input.closest('.autocomplete-mentions').length > 0) {
        Danbooru.Autocomplete.initialize_mention_autocomplete($input);
    }
}

function InitializeShowRelatedTags() {
    $(document).off('danbooru:show-related-tags');
    if (IAC.controller === 'posts') {
        if (!IAC.RTC.cached_data) {
            $(document).one('danbooru:show-related-tags.danbooru', Danbooru.RelatedTag.initialize_recent_and_favorite_tags);
        }
        $(document).one('danbooru:show-related-tags.iac', FindArtistSession);
    }
    if (IAC.related_query_enabled) {
        JSPLib.utility.setCSSStyle(RELATED_QUERY_CONTROL_CSS, 'related_query');
        $(document).one('danbooru:show-related-tags.iac', InitialiazeRelatedQueryControls);
    }
    if (IAC.expandable_related_section_enabled) {
        JSPLib.utility.setCSSStyle(EXPANDABLE_RELATED_SECTION_CSS, 'expandable_related');
        $(document).one('danbooru:show-related-tags.iac', InitialiazeRelatedExpandableSection);
    }
}

function InitialiazeRelatedQueryControls() {
    $('#tags-container').append(RenderRelatedQueryControls());
    $('#iac-related-query-type').css('display', 'inline-flex');
    $('#iac-related-query-type .iac-program-checkbox').checkboxradio();
    $('#iac-related-query-type .ui-state-hover').removeClass('ui-state-hover');
}

function InitialiazeRelatedExpandableSection() {
    $('.related-tags').before(IAC_SCROLL_WRAPPER);
    $('#iac-edit-scroll-wrapper').on(PROGRAM_SCROLL, () => {
        $('.related-tags').scrollLeft($('#iac-edit-scroll-wrapper').scrollLeft());
    });
    $('.related-tags').on(PROGRAM_SCROLL, () => {
        $('#iac-edit-scroll-wrapper').scrollLeft($('.related-tags').scrollLeft());
    });
    let $container = $('#related-tags-container');
    new ResizeObserver(() => {
        if ($container.hasClass('visible')) {
            QueueRelatedTagColumnWidths();
        }
    }).observe($container[0]);
}

function InitializeRelatedTagPopupListener() {
    $(document).on('danbooru:open-post-edit-dialog.iac', () => {
        $('.related-tags').on(PROGRAM_MOUSEENTER, RelatedTagsEnter);
        $('.related-tags').on(PROGRAM_MOUSELEAVE, RelatedTagsLeave);
    });
    $(document).on('danbooru:close-post-edit-dialog.iac', () => {
        $('.related-tags').off(PROGRAM_MOUSEENTER + ' ' + PROGRAM_MOUSELEAVE);
    });
}

function InitializeRelatedTagColumnWidths() {
    const em_size = 14;
    const max_column_em = 20;
    const min_column_em = 10;
    const range = document.createRange();
    const getChildWidth = (i, child) => {
        if (child.nodeType === 3) {
            range.selectNodeContents(child);
            const rects = range.getClientRects();
            return (rects.length > 0 ? rects[0].width : 0);
        }
        return $(child).outerWidth();
    };
    const getSum = (a, b) => (a + b);
    let $related_tags = $('.related-tags');
    $('.tag-column', $related_tags[0]).each((i, column) => {
        let $column = $(column);
        $column.css('width', "");
        let $container = $('>ul,>div', column);
        let $children = $container.children();
        if ($children.length === 0) {
            return;
        }
        let line_tag = $container.children().get(0).tagName.toLowerCase();
        let container_tag = $container.get(0).tagName.toLowerCase();
        let line_selector = container_tag + '>' + line_tag;
        let max_child_width = Math.max(...$(line_selector, column).map((i, entry) => {
            let child_widths = $(entry).contents().map(getChildWidth).toArray();
            return child_widths.reduce(getSum, 0);
        }));
        let max_column_width = max_column_em * em_size;
        let column_width = Math.max(Math.min(max_child_width, max_column_width), min_column_em * em_size);
        $column.width((Math.ceil(column_width / em_size) + 2) + 'em');
    });
    if ($related_tags.prop('scrollWidth') > ($related_tags.outerWidth() + (2 * em_size))) {
        $('#iac-edit-scroll-wrapper').width($related_tags.outerWidth());
        $('#iac-edit-scroll-bar').width($related_tags.prop('scrollWidth') - em_size);
        $('#iac-edit-scroll-wrapper').show();
        $related_tags.addClass('scrollable');
    } else {
        $('#iac-edit-scroll-wrapper').hide();
        $related_tags.removeClass('scrollable');
    }
}

function QueueRelatedTagColumnWidths() {
    if (Number.isInteger(QueueRelatedTagColumnWidths.timer)) {
        clearTimeout(QueueRelatedTagColumnWidths.timer);
    }
    QueueRelatedTagColumnWidths.timer = setTimeout(() => {
        InitializeRelatedTagColumnWidths();
        QueueRelatedTagColumnWidths.timer = null;
    }, 100);
}

//Main auxiliary functions

async function NetworkSource(type, key, term, metatag, query_type, word_mode, process = true) {
    this.debug('log', "Querying", type, ':', term);
    const CONFIG = SOURCE_CONFIG[type];
    let url_addons = $.extend({limit: IAC.source_results_returned}, CONFIG.data(term));
    let data = await JSPLib.danbooru.submitRequest(CONFIG.url, url_addons);
    if (!data || !Array.isArray(data)) {
        return [];
    }
    var d = data.map((item) => CONFIG.map(item, term));
    var expiration_time = CONFIG.expiration(d);
    var save_data = JSPLib.utility.dataCopy(d);
    JSPLib.storage.saveData(key, {value: save_data, expires: JSPLib.utility.getExpires(expiration_time)});
    if (CONFIG.fixupexpiration && d.length) {
        setTimeout(() => {FixExpirationCallback(key, save_data, save_data[0].value, type);}, CALLBACK_INTERVAL);
    }
    if (process) {
        return ProcessSourceData(type, metatag, term, d, query_type, key, word_mode);
    }
}

function AnySourceIndexed(keycode, has_context = false) {
    var type = SOURCE_KEY[keycode];
    return async function (term, prefix) {
        if ((!SOURCE_CONFIG[type].spacesallowed || JSPLib.validate.isString(prefix)) && term.match(/\S\s/)) {
            return [];
        }
        term = term.trim();
        if (term === "") {
            return [];
        }
        var word_mode = false;
        if (type === 'tag' && !term.startsWith('/') && !term.endsWith('*')) {
            word_mode = term.length > 1 &&
                        !(
                             IAC.word_start_matches ||
                             (SOURCE_CONFIG[type] === SOURCE_CONFIG.tag2) ||
                             (IAC.alternate_tag_wildcards && Boolean(term.match(/\*/)))
                         );
            term += (!word_mode && !term.endsWith('*') ? '*' : "");
        } else {
            term += (term.endsWith('*') ? "" : '*');
            term = (SOURCE_CONFIG[type].searchstart ? "" : "*") + term;
        }
        var key = (keycode + '-' + term).toLowerCase();
        let UID = IAC.query_UID[key] = JSPLib.utility.getUniqueID();
        JSPLib.debug.debugTime('autocomplete-' + UID);
        JSPLib.debug.debugTime('source-' + UID);
        var use_metatag = (JSPLib.validate.isString(prefix) ? prefix : "");
        var query_type = (has_context ? $(this.element).data('autocomplete') : null);
        var final_data = null;
        if (!IAC.network_only_mode) {
            var max_expiration = MaximumExpirationTime(type);
            var cached = await JSPLib.storage.checkLocalDB(key, ValidateEntry, max_expiration);
            if (ValidateCached(cached, type, term, word_mode)) {
                RecheckSourceData(type, key, term, cached, word_mode);
                final_data = ProcessSourceData(type, use_metatag, term, cached.value, query_type, key, word_mode);
            }
        }
        if (!final_data) {
            final_data = NetworkSource(type, key, term, use_metatag, query_type, word_mode);
        }
        JSPLib.debug.debugTimeEnd('source-' + UID);
        Object.assign(final_data, {UID, term, key});
        return final_data;
    };
}

function RecheckSourceData(type, key, term, data, word_mode) {
    if (IAC.recheck_data_interval > 0) {
        let recheck_time = data.expires - GetRecheckExpires();
        if (!JSPLib.utility.validateExpires(recheck_time)) {
            this.debug('log', "Rechecking", type, ':', term);
            NetworkSource(type, key, term, null, null, word_mode, false);
        }
    }
}

function ProcessSourceData(type, metatag, term, data, query_type, key, word_mode=false) {
    data.forEach((val) => {
        FixupMetatag(val, metatag);
        Object.assign(val, {term, key, type});
    });
    KeepSourceData(type, metatag, data);
    if (type === 'tag') {
        if (IAC.alternate_sorting_enabled) {
            SortSources(data);
        }
        if (IAC.metatag_source_enabled) {
            if (query_type !== 'tag') {
                let regex = new RegExp('^' + JSPLib.utility.regexpEscape(term).replace(/\\\*/g, '.*'));
                let filter_data = MetatagData().filter((data) => data.name.match(regex));
                let metatag_term = term + (term.endsWith('*') ? "" : '*');
                let add_data = filter_data.map((item) => Object.assign({term: metatag_term}, item));
                data.unshift(...add_data);
            }
        }
        if (IAC.source_grouping_enabled) {
            GroupSources(data);
        }
    }
    if (IAC.usage_enabled) {
        AddUserSelected(type, metatag, term, data, query_type, word_mode, key);
    }
    if (IAC.is_bur && IAC.BUR_source_enabled) {
        let add_data = BUR_DATA.filter((data) => (term.length === 2 || GetGlobMatches(data.name, term))).map((data) => Object.assign({term}, data));
        data.unshift(...add_data);
        data.splice(IAC.source_results_returned);
    }
    //Doing this here to avoid processing it on each list item
    IAC.highlight_used = (document.activeElement.tagName === 'TEXTAREA' && ['post_tag_string', 'upload_tag_string'].includes(document.activeElement.id));
    if (IAC.highlight_used) {
        let adjusted_tag_string = RemoveTerm(document.activeElement.value, document.activeElement.selectionStart);
        IAC.current_tags = adjusted_tag_string.split(/\s+/);
    }
    return data;
}

//Main execution functions

function InstallQuickSearchBars() {
    if (IAC.forum_quick_search_enabled && (IAC.controller === 'forum-topics' || IAC.controller === 'forum-posts')) {
        JSPLib.utility.setCSSStyle(FORUM_CSS, 'forum');
        $('#subnav-menu .search_body_matches').closest('li').after(FORUM_TOPIC_SEARCH);
    }
    if (IAC.comment_quick_search_enabled && IAC.controller === 'comments') {
        $('#subnav-menu .search_body_matches').closest('li').after(POST_COMMENT_SEARCH);
    }
}

function SetupAutocompleteBindings() {
    Danbooru.Autocomplete.tag_source = AnySourceIndexed('ac');
    Danbooru.Autocomplete.pool_source = AnySourceIndexed('pl');
    Danbooru.Autocomplete.user_source = AnySourceIndexed('us');
    Danbooru.Autocomplete.favorite_group_source = AnySourceIndexed('fg');
    Danbooru.Autocomplete.saved_search_source = AnySourceIndexed('ss');
    Danbooru.Autocomplete.static_metatag_source = StaticMetatagSource;
    Danbooru.Autocomplete.insert_completion_old = Danbooru.Autocomplete.insert_completion;
    Danbooru.Autocomplete.insert_completion = JSPLib.utility.hijackFunction(InsertCompletion, InsertUserSelected);
    Danbooru.Autocomplete.render_item_old = Danbooru.Autocomplete.render_item;
    Danbooru.Autocomplete.render_item = JSPLib.utility.hijackFunction(AutocompleteRenderItem, HighlightSelected);
    Danbooru.Autocomplete.initialize_tag_autocomplete_old = Danbooru.Autocomplete.initialize_tag_autocomplete;
    Danbooru.Autocomplete.initialize_tag_autocomplete = DanbooruIntializeTagAutocomplete;
}

function SetupAutocompleteInitializations() {
    switch (IAC.controller) {
        case 'wiki-pages':
        case 'wiki-page-versions':
            RebindAnyAutocomplete('[data-autocomplete=wiki-page]', 'wp');
            break;
        case 'artists':
        case 'artist-versions':
        case 'artist-urls':
            RebindAnyAutocomplete('[data-autocomplete=artist]', 'ar');
            break;
        case 'pools':
        case 'pool-versions':
            RebindAnyAutocomplete('[data-autocomplete=pool]', 'pl');
            break;
        case 'favorite-groups':
            RebindAnyAutocomplete('[data-autocomplete=favorite-group]', 'fg');
            break;
        case 'posts':
            if (IAC.action === 'index') {
                RebindAnyAutocomplete('[data-autocomplete=saved-search-label]', 'ss', true);
            }
            break;
        case 'saved-searches':
            if (IAC.action === 'index') {
                DelayInitializeTagAutocomplete('#search_query_ilike', 'tag-query');
                RebindAnyAutocomplete('[data-autocomplete=saved-search-label]', 'ss');
            } else if (IAC.action === 'edit') {
                DelayInitializeTagAutocomplete('#saved_search_query', 'tag-query');
                RebindAnyAutocomplete('[data-autocomplete=saved-search-label]', 'ss', true);
            }
            break;
        case 'forum-topics':
        case 'forum-posts':
            DelayInitializeAutocomplete('#quick_search_title_matches', 'ft');
            if (IAC.action === 'search') {
                DelayInitializeAutocomplete('#search_topic_title_matches', 'ft');
            }
            break;
        case 'comments':
            DelayInitializeTagAutocomplete();
            break;
        case 'uploads':
            if (IAC.action === 'index') {
                DelayInitializeTagAutocomplete('#search_post_tags_match', 'tag-query');
            }
            break;
        case 'bulk-update-requests':
            if (IAC.is_bur) {
                DelayInitializeTagAutocomplete('#bulk_update_request_script', 'tag-edit');
            }
            break;
        case 'related-tags':
            DelayInitializeTagAutocomplete('#search_query', 'tag-query');
            //falls through
        default:
            //do nothing
    }
    if ($(AUTOCOMPLETE_REBIND_SELECTORS).length) {
        RebindRenderCheck();
    }
    if ($('[data-autocomplete=tag]').length) {
        RebindSingleTag();
    }
    if ($(AUTOCOMPLETE_MULTITAG_SELECTORS).length) {
        RebindMultipleTag();
    }
    if ($(AUTOCOMPLETE_USER_SELECTORS).length) {
        RebindAnyAutocomplete(AUTOCOMPLETE_USER_SELECTORS, 'us');
    }
    if (IAC.text_input_autocomplete_enabled) {
        InitializeTextAreaAutocomplete();
    }
}

function SetupPostEditInitializations() {
    if ((IAC.controller === 'posts' && IAC.action === 'show') || (IAC.controller === 'uploads' && IAC.action === 'show') || (IAC.controller === 'upload-media-assets' && IAC.action === 'show')) {
        RebindRelatedTags();
        if (IAC.controller === 'posts') {
            RebindOpenEditMenu();
        } else if (IAC.controller === 'uploads' || IAC.controller === 'upload-media-assets') {
            //Is source column empty?
            if (/^\s+$/.test($('.source-related-tags-columns').html())) {
                this.debug('log', "Setting up mutation observer for source data.");
                JSPLib.concurrency.setupMutationReplaceObserver('.related-tags', '.source-related-tags-columns', SaveArtistData);
            } else {
                SaveArtistData();
            }
            InitializeShowRelatedTags();
            $(document).trigger('danbooru:show-related-tags');
        }
        if (IAC.expandable_related_section_enabled) {
            InitializeRelatedTagPopupListener();
            Danbooru.RelatedTag.show = JSPLib.utility.hijackFunction(Danbooru.RelatedTag.show, () => {
                QueueRelatedTagColumnWidths();
            });
            Danbooru.RelatedTag.hide = JSPLib.utility.hijackFunction(Danbooru.RelatedTag.hide, () => {
                $('#iac-edit-scroll-wrapper').hide();
            });
        }
    }
}

function CleanupTasks() {
    PruneUsageData();
    JSPLib.storage.pruneEntries(PROGRAM_SHORTCUT, PROGRAM_DATA_REGEX, PRUNE_EXPIRES);
}

//Cache functions

function OptionCacheDataKey(data_type, data_value) {
    IAC.related_category = $('#iac-control-related-tag-type').val();
    let modifier = (data_type === 'related_tag' ? GetRelatedKeyModifer(IAC.related_category) : PROGRAM_DATA_KEY[data_type]);
    return `${modifier}-${data_value}`;
}

function UpdateLocalData(key, data) {
    switch (key) {
        case 'iac-choice-info':
            IAC.choice_order = data.choice_order;
            IAC.choice_data = data.choice_data;
            StoreUsageData('save', "", false);
            //falls through
        default:
            //Do nothing
    }
}

//Settings functions

function BroadcastIAC(event) {
    this.debug('log', `(${event.data.type}): ${event.data.name} ${event.data.key}`);
    switch (event.data.type) {
        case 'text_autocomplete':
            IAC.ac_source = event.data.source;
            IAC.ac_mode = event.data.mode;
            IAC.ac_caps = event.data.caps;
            break;
        case 'reload':
            IAC.choice_order = event.data.choice_order;
            IAC.choice_data = event.data.choice_data;
            //falls through
        default:
            //do nothing
    }
}

function RemoteSettingsCallback() {
    SetTagAutocompleteSource();
}

function SetTagAutocompleteSource() {
    if (IAC.alternate_tag_source) {
        SOURCE_CONFIG.tag = SOURCE_CONFIG.tag2;
    } else {
        SOURCE_CONFIG.tag = SOURCE_CONFIG.tag1;
    }
}

function GetUsageExpires() {
    return IAC.usage_expires * JSPLib.utility.one_day;
}

function GetRecheckExpires() {
    return IAC.recheck_data_interval * JSPLib.utility.one_day;
}

function DataTypeChange() {
    let data_type = $('#iac-control-data-type').val();
    let action = (data_type === 'related_tag' ? 'show' : 'hide');
    $('.iac-options[data-setting=related_tag_type]')[action]();
}

function InitializeProgramValues() {
    if (!JSPLib.storage.use_indexed_db) {
        this.debug('warn', "No Indexed DB! Exiting...");
        return false;
    }
    if (document.querySelector(AUTOCOMPLETE_ALL_SELECTORS) === null && !GetHasQuickSearchBar()) {
        this.debug('warn', "No autocomplete inputs! Exiting...");
        return false;
    }
    Object.assign(IAC, {
        userid: Danbooru.CurrentUser.data('id'),
        FindArtistSession,
        InitializeAutocompleteIndexed,
    });
    Object.assign(IAC, {
        choice_info: JSPLib.storage.getStorageData('iac-choice-info', localStorage, {}),
        is_bur: GetIsBur(),
        prefixes: JSON.parse(JSPLib.utility.getMeta('autocomplete-tag-prefixes')),
    }, PROGRAM_RESET_KEYS);
    Object.assign(IAC, {
        categories: IAC.prefixes.filter((key) => (!['-', '~'].includes(key))).map((key) => (key.slice(0, -1))),
    });
    if (JSPLib.validate.isHash(IAC.choice_info)) {
        IAC.choice_order = IAC.choice_info.choice_order;
        IAC.choice_data = IAC.choice_info.choice_data;
    }
    return true;
}

function RenderSettingsMenu() {
    $('#indexed-autocomplete').append(JSPLib.menu.renderMenuFramework(MENU_CONFIG));
    $('#iac-general-settings-message').append(JSPLib.menu.renderExpandable("Text autocomplete details", TEXT_AUTOCOMPLETE_DETAILS));
    $('#iac-general-settings').append(JSPLib.menu.renderDomainSelectors());
    $('#iac-general-settings').append(JSPLib.menu.renderCheckbox('text_input_autocomplete_enabled'));
    $('#iac-general-settings').append(JSPLib.menu.renderCheckbox('forum_quick_search_enabled'));
    $('#iac-general-settings').append(JSPLib.menu.renderCheckbox('comment_quick_search_enabled'));
    $('#iac-source-settings').append(JSPLib.menu.renderCheckbox('BUR_source_enabled'));
    $('#iac-source-settings').append(JSPLib.menu.renderCheckbox('metatag_source_enabled'));
    $('#iac-usage-settings-message').append(JSPLib.menu.renderExpandable("Additional setting details", USAGE_SETTINGS_DETAILS));
    $('#iac-usage-settings').append(JSPLib.menu.renderCheckbox('usage_enabled'));
    $('#iac-usage-settings').append(JSPLib.menu.renderTextinput('usage_multiplier'));
    $('#iac-usage-settings').append(JSPLib.menu.renderTextinput('usage_maximum'));
    $('#iac-usage-settings').append(JSPLib.menu.renderTextinput('usage_expires'));
    $('#iac-display-settings-message').append(JSPLib.menu.renderExpandable("Additional setting details", DISPLAY_SETTINGS_DETAILS));
    $('#iac-display-settings').append(JSPLib.menu.renderTextinput('source_results_returned', 5));
    $('#iac-display-settings').append(JSPLib.menu.renderCheckbox('source_highlight_enabled'));
    $('#iac-display-settings').append(JSPLib.menu.renderCheckbox('highlight_words_enabled'));
    $('#iac-display-settings').append(JSPLib.menu.renderCheckbox('source_grouping_enabled'));
    $('#iac-display-settings').append(JSPLib.menu.renderSortlist('source_order'));
    $('#iac-sort-settings-message').append(JSPLib.menu.renderExpandable("Additional setting details", SORT_SETTINGS_DETAILS));
    $('#iac-sort-settings').append(JSPLib.menu.renderCheckbox('alternate_sorting_enabled'));
    $('#iac-sort-settings').append(JSPLib.menu.renderInputSelectors('postcount_scale', 'radio'));
    $('#iac-sort-settings').append(JSPLib.menu.renderTextinput('exact_source_weight', 5));
    $('#iac-sort-settings').append(JSPLib.menu.renderTextinput('prefix_source_weight', 5));
    $('#iac-sort-settings').append(JSPLib.menu.renderTextinput('alias_source_weight', 5));
    $('#iac-sort-settings').append(JSPLib.menu.renderTextinput('correct_source_weight', 5));
    $('#iac-related-tag-settings-message').append(JSPLib.menu.renderExpandable("Additional setting details", RELATED_TAG_SETTINGS_DETAILS));
    $('#iac-related-tag-settings').append(JSPLib.menu.renderTextinput('related_results_limit', 5));
    $('#iac-related-tag-settings').append(JSPLib.menu.renderCheckbox('related_statistics_enabled'));
    $('#iac-related-tag-settings').append(JSPLib.menu.renderCheckbox('related_query_enabled'));
    $('#iac-related-tag-settings').append(JSPLib.menu.renderInputSelectors('related_query_default', 'radio'));
    $('#iac-related-tag-settings').append(JSPLib.menu.renderCheckbox('expandable_related_section_enabled'));
    $('#iac-network-settings-message').append(JSPLib.menu.renderExpandable("Additional setting details", NETWORK_SETTINGS_DETAILS));
    $('#iac-network-settings').append(JSPLib.menu.renderTextinput('recheck_data_interval', 5));
    $('#iac-network-settings').append(JSPLib.menu.renderCheckbox('alternate_tag_source'));
    $('#iac-network-settings').append(JSPLib.menu.renderCheckbox('alternate_tag_wildcards'));
    $('#iac-network-settings').append(JSPLib.menu.renderCheckbox('word_start_matches'));
    $('#iac-network-settings').append(JSPLib.menu.renderCheckbox('network_only_mode'));
    $('#iac-controls').append(JSPLib.menu.renderCacheControls());
    $('#iac-cache-controls-message').append(JSPLib.menu.renderExpandable("Cache Data details", CACHE_DATA_DETAILS));
    $('#iac-cache-controls').append(JSPLib.menu.renderLinkclick('cache_info', true));
    $('#iac-cache-controls').append(JSPLib.menu.renderCacheInfoTable());
    $('#iac-cache-controls').append(JSPLib.menu.renderLinkclick('purge_cache', true));
    $('#iac-controls').append(JSPLib.menu.renderCacheEditor(true));
    $('#iac-cache-editor-message').append(JSPLib.menu.renderExpandable("Program Data details", PROGRAM_DATA_DETAILS));
    $('#iac-cache-editor-controls').append(JSPLib.menu.renderKeyselect('data_source', true));
    $('#iac-cache-editor-controls').append(JSPLib.menu.renderDataSourceSections());
    $('#iac-section-indexed-db').append(JSPLib.menu.renderKeyselect('data_type', true));
    $('#iac-section-indexed-db').append(JSPLib.menu.renderKeyselect('related_tag_type', true));
    $('#iac-section-local-storage').append(JSPLib.menu.renderCheckbox('raw_data', true));
    $('#iac-cache-editor-controls').append(JSPLib.menu.renderTextinput('data_name', 20, true));
    $('.iac-options[data-setting=related_tag_type]').hide();
    JSPLib.menu.engageUI(true, true);
    JSPLib.menu.saveUserSettingsClick(RemoteSettingsCallback);
    JSPLib.menu.resetUserSettingsClick(LOCALSTORAGE_KEYS, RemoteSettingsCallback);
    JSPLib.menu.cacheInfoClick();
    JSPLib.menu.purgeCacheClick();
    JSPLib.menu.expandableClick();
    JSPLib.menu.dataSourceChange();
    $('#iac-control-data-type').on('change.iac', DataTypeChange);
    JSPLib.menu.rawDataChange();
    JSPLib.menu.getCacheClick(ValidateProgramData);
    JSPLib.menu.saveCacheClick(ValidateProgramData, ValidateEntry, UpdateLocalData);
    JSPLib.menu.deleteCacheClick();
    JSPLib.menu.listCacheClick();
    JSPLib.menu.refreshCacheClick();
    JSPLib.menu.cacheAutocomplete();
}

//Main program

function Main() {
    this.debug('log', "Initialize start:", JSPLib.utility.getProgramTime());
    const preload = {
        run_on_settings: true,
        default_data: DEFAULT_VALUES,
        initialize_func: InitializeProgramValues,
        broadcast_func: BroadcastIAC,
        menu_css: SETTINGS_MENU_CSS + '\n' + LIBRARY_MENU_CSS,
    };
    if (!JSPLib.menu.preloadScript(IAC, RenderSettingsMenu, preload)) return;
    InstallQuickSearchBars();
    JSPLib.load.setProgramGetter(IAC, 'RTC', 'RecentTagsCalc');
    CorrectUsageData();
    SetupAutocompleteBindings();
    SetupAutocompleteInitializations();
    SetupPostEditInitializations();
    SetTagAutocompleteSource();
    JSPLib.utility.setCSSStyle(PROGRAM_CSS, 'program');
    JSPLib.statistics.addPageStatistics(PROGRAM_NAME);
    JSPLib.load.noncriticalTasks(CleanupTasks);
}

/****Function decoration****/

[
    Main, BroadcastIAC, NetworkSource, FindArtistSession, PruneUsageData, CorrectUsageData, InsertUserSelected,
    SaveArtistData, GetArtistData, FixExpirationCallback, ValidateEntry, GetPostCount, GetRelatedTags,
    SetupPostEditInitializations, RecheckSourceData, InitializeProgramValues,
] = JSPLib.debug.addFunctionLogs([
    Main, BroadcastIAC, NetworkSource, FindArtistSession, PruneUsageData, CorrectUsageData, InsertUserSelected,
    SaveArtistData, GetArtistData, FixExpirationCallback, ValidateEntry, GetPostCount, GetRelatedTags,
    SetupPostEditInitializations, RecheckSourceData, InitializeProgramValues,
]);

[
    ValidateUsageData, SaveArtistData, RenderTagColumns, RenderSettingsMenu,
    RelatedTagsButton, FindArtistSession,
] = JSPLib.debug.addFunctionTimers([
    //Sync
    ValidateUsageData, SaveArtistData, RenderTagColumns, RenderSettingsMenu,
    //Async
    RelatedTagsButton, FindArtistSession,
]);

/****Initialization****/

//Variables for debug.js
JSPLib.debug.debug_console = false;
JSPLib.debug.level = JSPLib.debug.INFO;
JSPLib.debug.program_shortcut = PROGRAM_SHORTCUT;

//Variables for menu.js
JSPLib.menu.program_shortcut = PROGRAM_SHORTCUT;
JSPLib.menu.program_name = PROGRAM_NAME;
JSPLib.menu.program_data = IAC;
JSPLib.menu.program_reset_data = PROGRAM_RESET_KEYS;
JSPLib.menu.program_data_regex = PROGRAM_DATA_REGEX;
JSPLib.menu.program_data_key = OptionCacheDataKey;
JSPLib.menu.settings_callback = RemoteSettingsCallback;
JSPLib.menu.reset_callback = RemoteSettingsCallback;
JSPLib.menu.settings_config = SETTINGS_CONFIG;
JSPLib.menu.control_config = CONTROL_CONFIG;

//Export JSPLib
JSPLib.load.exportData(PROGRAM_NAME, IAC, {other_data: TERM_REGEX, datalist: ['cached_data']});
JSPLib.load.exportFuncs(PROGRAM_NAME, {debuglist: [DanbooruIntializeTagAutocomplete], alwayslist: [FindArtistSession, InitializeAutocompleteIndexed]});

/****Execution start****/

JSPLib.load.programInitialize(Main, {program_name: PROGRAM_NAME, required_variables: PROGRAM_LOAD_REQUIRED_VARIABLES, required_selectors: PROGRAM_LOAD_REQUIRED_SELECTORS});
