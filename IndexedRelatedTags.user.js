// ==UserScript==
// @name         IndexedRelatedTags
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      3.4
// @description  Uses Indexed DB for autocomplete, plus caching of other data.
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @exclude      /^https?://\w+\.donmai\.us/.*\.(xml|json|atom)(\?|$)/
// @grant        none
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/IndexedRelatedTags.user.js
// @updateURL    https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/IndexedRelatedTags.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.10.0/localforage.min.js
// @require      https://cdn.jsdelivr.net/npm/localforage-removeitems@1.4.0/dist/localforage-removeitems.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.13.1/validate.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/module.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/notice.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/concurrency.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/menu.js
// ==/UserScript==

/* global JSPLib $ Danbooru validate */

/****Global variables****/

//Library constants

////NONE

//Exterior script variables
const DANBOORU_TOPIC_ID = null;

//Variables for load.js
const PROGRAM_LOAD_REQUIRED_VARIABLES = ['window.jQuery', 'window.Danbooru', 'Danbooru.RelatedTag', 'Danbooru.CurrentUser', 'Danbooru.Post'];
const PROGRAM_LOAD_REQUIRED_SELECTORS = ['#top', '#page'];

//Program name constants
const PROGRAM_SHORTCUT = 'irt';
const PROGRAM_CLICK = 'click.irt';
const PROGRAM_KEYDOWN = 'keydown.irt';
const PROGRAM_MOUSEENTER = 'mouseenter.irt';
const PROGRAM_MOUSELEAVE = 'mouseleave.irt';
const PROGRAM_SCROLL = 'scroll.irt';
const PROGRAM_NAME = 'IndexedRelatedTags';

//Program data constants
const PROGRAM_DATA_REGEX = /^(rt[fcjo](gen|char|copy|art)?|wpt|tagov)-/; //Regex that matches the prefix of all program cache data

//Main program variables
const IRT = {};
const FUNC = {};

//For factory reset
const LOCALSTORAGE_KEYS = [];
const PROGRAM_RESET_KEYS = {};

//Available setting values
const RELATED_QUERY_ORDERS = ['frequency', 'cosine', 'jaccard', 'overlap'];
const RELATED_QUERY_CATEGORIES = {
    general: 0,
    copyright: 3,
    character: 4,
    artist: 1,
    meta: 5
};
const RELATED_CATEGORY_NAMES = Object.keys(RELATED_QUERY_CATEGORIES);

//Main settings
const SETTINGS_CONFIG = {
    related_query_categories: {
        allitems: RELATED_CATEGORY_NAMES,
        reset: RELATED_CATEGORY_NAMES,
        validate: (data) => JSPLib.menu.validateCheckboxRadio(data, 'checkbox', RELATED_CATEGORY_NAMES),
        hint: "Select the category query buttons to show.",
    },
    related_results_limit: {
        reset: 0,
        parse: parseInt,
        validate: (data) => JSPLib.menu.validateNumber(data, true, 0, 50),
        hint: "Number of results to show (1 - 50) for the primary <b>Tags</b> column. Setting to 0 uses Danbooru's default limit."
    },
    related_query_order_enabled: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Show controls that allow for alternate query orders on related tags."
    },
    related_query_order_default: {
        allitems: RELATED_QUERY_ORDERS,
        reset: ['frequency'],
        validate: (data) => JSPLib.menu.validateCheckboxRadio(data, 'radio', RELATED_QUERY_ORDERS),
        hint: "Select the default query order selected on the related tag controls. Will be the order used when the order controls are not available."
    },
    expandable_related_section_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Places all related tag columns on the same row, with top/bottom scrollbars and arrow keys to support scrolling."
    },
    related_statistics_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Show tag overlap statistics for related tag results (<b>Tags</b> column only)."
    },
    random_post_batches: {
        reset: 4,
        parse: parseInt,
        validate: (data) => JSPLib.menu.validateNumber(data, true, 1, 10),
        hint: "Number of consecutive queries for random posts (1 - 10)."
    },
    random_posts_per_batch: {
        reset: 100,
        parse: parseInt,
        validate: (data) => JSPLib.menu.validateNumber(data, true, 20, 200),
        hint: "Number of posts to query for each batch (20 - 200)."
    },
    wiki_page_tags_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Include wiki page tags when using one of the related tags buttons."
    },
    wiki_page_query_only_enabled: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Include a button to query only wiki page tags."
    },
    checklist_tags_enabled: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Include checklist tags when using one of the related tags buttons."
    },
    checklist_query_only_enabled: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Include a button to add only checklist tags."
    },
    query_unknown_tags_enabled: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Do an additional query if any wiki page tags are not found with the initial query."
    },
    other_wikis_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Include list_of_* wikis when including wiki page tags."
    },
    unique_wiki_tags_enabled: {
        reset: true,
        validate: JSPLib.validate.isBoolean,
        hint: "Only show one instance of a tag by its first occurrence."
    },
    recheck_data_interval: {
        reset: 1,
        parse: parseInt,
        validate: (data) => JSPLib.menu.validateNumber(data, true, 0, 3),
        hint: "Number of days (0 - 3). Setting to 0 disables this."
    },
    network_only_mode: {
        reset: false,
        validate: JSPLib.validate.isBoolean,
        hint: `Always goes to network. <b><span style="color:red">Warning:</span> This negates the benefit of cached data!</b>`
    },
};

//Available config values
const ALL_SOURCE_TYPES = ['indexed_db', 'local_storage'];
const ALL_DATA_TYPES = ['related_tag', 'wiki_page', 'tag_overlap', 'custom'];
const ALL_RELATED = ["", 'general', 'copyright', 'character', 'artist'];
const ALL_ORDER = ['frequent', 'cosine', 'jaccard', 'overlap'];

const CONTROL_CONFIG = {
    cache_info: {
        value: "Click to populate",
        hint: "Calculates the cache usage of the program and compares it to the total usage.",
    },
    purge_cache: {
        display: `Purge cache (<span id="irt-purge-counter">...</span>)`,
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
        value: 'related_tag',
        hint: "Select type of data. Use <b>Custom</b> for querying by keyname.",
    },
    tag_category: {
        allitems: ALL_RELATED,
        value: "",
        hint: "Select type of tag category. Blank selects uncategorized data.",
    },
    query_order: {
        allitems: ALL_ORDER,
        value: 'frequent',
        hint: "Select type of query order.",
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
    import_export: {
        display: 'Import/Export',
        value: false,
        hint: "Once selected, all checklists can be exported by clicking <b>View</b>, or imported by clicking <b>Save</b>.",
    },
    tag_name: {
        value: "",
        buttons: ['view', 'save', 'populate', 'list'],
        hint: "Click <b>View</b> to see the list of tags, and <b>Save</b> to commit the changes. <b>Populate</b> will query the current list of wiki page tags. <b>List</b> will show all tags with checklists in alphabetical order.",
    },
};

const MENU_CONFIG = {
    topic_id: DANBOORU_TOPIC_ID,
    settings: [{
        name: 'general',
    }, {
        name: 'related-tag',
        message: "Affects the related tags shown in the post/upload edit menu.",
    }, {
        name: 'tag-statistic',
        message: "Shows much overlap there is between the tags in the related tag column and the query term. This does not include wiki page tags.",
    }, {
        name: 'checklist',
        message: "Allows frequent tags on a per-tag basis.",
    }, {
        name: 'wiki-page',
        message: "Affects how the wiki pages get queried for tags.",
    }, {
        name: 'network',
    }],
    controls: [{
        name: 'checklist',
        message: "View and edit frequent tags on a per-tag basis."
    }],
};

// Default values

const DEFAULT_VALUES = PROGRAM_RESET_KEYS;

//Pre-CSS/HTML constants

const DEPRECATED_TAG_CATEGORY = 200;
const NONEXISTENT_TAG_CATEGORY = 300;
const BUR_TAG_CATEGORY = 400;
const METATAG_TAG_CATEGORY = 500;

//CSS Constants

const PROGRAM_CSS = `
.irt-line-entry {
    display: flex;
    width: 100%;
    white-space: nowrap;
}
.irt-line-entry a {
    white-space: normal;
}
.irt-query > span:first-of-type,
.irt-pool > span:first-of-type,
.irt-favgroup > span:first-of-type,
.irt-artist > span:first-of-type,
.irt-forum-topic > span:first-of-type {
    flex-basis: 90%;
}
.irt-query > span:last-of-type,
.irt-pool > span:last-of-type,
.irt-favgroup > span:last-of-type,
.irt-artist > span:last-of-type,
.irt-forum-topic > span:last-of-type {
    flex-basis: 10%;
    text-align: right;
}
.irt-wiki-page > span:first-of-type {
    flex-basis: 85%;
}
.irt-wiki-page > span:last-of-type {
    flex-basis: 15%;
    text-align: right;
}
.irt-user > span,
irt-search > span {
    flex-basis: 100%;
}
.irt-user-choice .autocomplete-item {
    box-shadow: 0px 2px 0px #000;
    padding-bottom: 1px;
    line-height: 150%;
}
.irt-tag-alias a {
    font-style: italic;
}
.irt-tag-highlight {
    margin-top: -5px;
    margin-bottom: 5px;
}
.irt-tag-highlight > div:before {
    content: "●";
    padding-right: 4px;
    font-weight: bold;
    font-size: 150%;
}
.irt-tag-bur > div:before {
    color: #000;
}
.irt-tag-exact > div:before {
    color: #DDD;
}
.irt-tag-word > div:before {
    color: #888;
}
.irt-tag-abbreviation > div:before {
    color: hotpink;
}
.irt-tag-alias > div:before {
    color: gold;
}
.irt-tag-autocorrect > div:before {
    color: cyan;
}
.irt-tag-other-name > div:before {
    color: orange;
}
.tag-type-${NONEXISTENT_TAG_CATEGORY} a.search-tag:link,
.tag-type-${NONEXISTENT_TAG_CATEGORY} a.search-tag:visited {
    color: skyblue;
}
.tag-type-${DEPRECATED_TAG_CATEGORY} a.search-tag:link,
.tag-type-${DEPRECATED_TAG_CATEGORY} a.search-tag:visited {
    color: darkgrey;
}
.tag-type-${NONEXISTENT_TAG_CATEGORY} a.search-tag:hover,
.tag-type-${DEPRECATED_TAG_CATEGORY} a.search-tag:hover {
    filter: brightness(1.25);
}
.irt-tag-bur > div:before,
.irt-tag-highlight .tag-type-${BUR_TAG_CATEGORY}:link,
.irt-tag-highlight .tag-type-${BUR_TAG_CATEGORY}:visited,
.irt-tag-highlight .tag-type-${BUR_TAG_CATEGORY}:hover {
    color: #888;
}
.irt-highlight-match {
    font-weight: bold;
}
.irt-related-tags .tag-column li.selected {
    font-weight: bold;
}
.irt-related-tags .tag-column li:before {
    content: "*";
    font-family: monospace;
    font-weight: bold;
    visibility: hidden;
    padding-right: 0.2em;
}
.irt-related-tags .tag-column li.selected:before {
    visibility: visible;
}
div#edit-dialog div#irt-related-tags-container {
    max-height: 400px;
    overflow-y: auto;
}
/** DARK/LIGHT Color Setup **/
body[data-current-user-theme=light] .irt-already-used {
    background-color: #FFFFAA;
}
body[data-current-user-theme=light] .irt-tag-metatag > div:before,
body[data-current-user-theme=light] .irt-tag-highlight .tag-type-${METATAG_TAG_CATEGORY}:link,
body[data-current-user-theme=light] .irt-tag-highlight .tag-type-${METATAG_TAG_CATEGORY}:visited,
body[data-current-user-theme=light] .irt-tag-highlight .tag-type-${METATAG_TAG_CATEGORY}:hover {
    color: #000;
}
body[data-current-user-theme=light] .irt-highlight-match {
    filter: brightness(0.75);
}
body[data-current-user-theme=dark] .irt-already-used {
    background-color: #666622;
}
body[data-current-user-theme=dark] .irt-tag-metatag > div:before,
body[data-current-user-theme=dark] .irt-tag-highlight .tag-type-${METATAG_TAG_CATEGORY}:link,
body[data-current-user-theme=dark] .irt-tag-highlight .tag-type-${METATAG_TAG_CATEGORY}:visited,
body[data-current-user-theme=dark] .irt-tag-highlight .tag-type-${METATAG_TAG_CATEGORY}:hover {
    color: #FFF;
}
body[data-current-user-theme=dark] .irt-highlight-match {
    filter: brightness(1.25);
}
@media (prefers-color-scheme: light) {
    body[data-current-user-theme=auto] .irt-already-used {
        background-color: #FFFFAA;
    }
    body[data-current-user-theme=auto] .irt-tag-metatag > div:before,
    body[data-current-user-theme=auto] .irt-tag-highlight .tag-type-${METATAG_TAG_CATEGORY}:link,
    body[data-current-user-theme=auto] .irt-tag-highlight .tag-type-${METATAG_TAG_CATEGORY}:visited,
    body[data-current-user-theme=auto] .irt-tag-highlight .tag-type-${METATAG_TAG_CATEGORY}:hover {
        color: #000;
    }
    body[data-current-user-theme=auto] .irt-highlight-match {
        filter: brightness(0.75);
    }
}
@media (prefers-color-scheme: dark) {
    body[data-current-user-theme=auto] .irt-already-used {
        background-color: #666622;
    }
    body[data-current-user-theme=auto] .irt-tag-metatag > div:before,
    body[data-current-user-theme=auto] .irt-tag-highlight .tag-type-${METATAG_TAG_CATEGORY}:link,
    body[data-current-user-theme=auto] .irt-tag-highlight .tag-type-${METATAG_TAG_CATEGORY}:visited,
    body[data-current-user-theme=auto] .irt-tag-highlight .tag-type-${METATAG_TAG_CATEGORY}:hover {
        color: #FFF;
    }
    body[data-current-user-theme=auto] .irt-highlight-match {
        filter: brightness(1.25);
    }
}
`;

const RELATED_QUERY_CONTROL_CSS = `
.irt-related-button {
    margin: 0 2px;
}
.irt-related-button[disabled] {
    cursor: default;
}
#irt-wiki-page-query {
    color: white;
    font-weight: bold;
    background-color: green;
    border-color: darkgreen;
    margin-right: 0.5em;
}
#irt-checklist-query {
    color: white;
    font-weight: bold;
    background-color: orange;
    border-color: darkorange;
    margin-right: 0.5em;
}
#irt-related-query-type label {
    color: black;
    background-color: lightgrey;
    margin-right: 0.5em;
    font-weight: bold;
}
#irt-related-query-type .ui-checkboxradio-radio-label.ui-checkboxradio-checked .ui-icon,
#irt-related-query-type .ui-checkboxradio-radio-label.ui-checkboxradio-checked:hover .ui-icon {
    background-image: none;
    width: 8px;
    height: 8px;
    border-width: 4px;
    border-style: solid;
}
#irt-related-query-type .ui-state-active .ui-icon-background {
    border: black;
    background-color: white;
}
#irt-related-query-type .ui-visual-focus,
#irt-related-query-type .ui-state-active,
#irt-related-query-type .ui-widget-content .ui-state-active,
#irt-related-query-type .ui-button.ui-state-active:hover,
#irt-related-query-type .ui-button.ui-state-active:focus,
#irt-related-query-type .ui-button:focus,
#irt-related-query-type .ui-button:active {
    border: 1px solid white;
    background: lightgrey;
    outline: none;
    box-shadow: none;
}`;

const EXPANDABLE_RELATED_SECTION_CSS = `
#irt-edit-scroll-wrapper {
    height: 20px;
    overflow-x: scroll;
    overflow-y: hidden;
    display: none;
}
#irt-edit-scroll-bar {
    height: 20px;
}
.irt-tag-statistic {
    color: hotpink;
}
div#irt-related-tags-container div.irt-related-tags {
    overflow-x: hidden;
    flex-wrap: nowrap;
    max-width: calc(100% - 2em);
    display: inline-flex;
}
div#irt-related-tags-container div.irt-related-tags.scrollable {
    overflow-x: scroll;
}
div#irt-related-tags-container div.irt-related-tags div.tag-column {
    width: 18em;
    max-width: unset;
    margin-right: 1em;
}
div#irt-related-tags-container div.irt-related-tags div.tag-column.irt-general-related-tags-column.irt-is-empty-false {
    width: 18em;
}
div#irt-related-tags-container div.irt-related-tags div.tag-column.irt-is-empty-true {
    display: none;
}`;

const SETTINGS_MENU_CSS = `
#indexed-related-tags .jsplib-settings-grouping:not(#irt-general-settings) .irt-selectors label {
    width: 150px;
}
#indexed-related-tags .irt-sortlist li {
    width: 10em;
}
#indexed-related-tags .irt-formula {
    font-family: mono;
}
#irt-checklist-frequent-tags textarea {
    width: 40em;
    height: 25em;
}`;

//HTML Constants

const RELATED_TAG_SETTINGS_DETAILS = `
<ul>
    <li><b>Related query orders:</b>
        <ul>
            <li><b>Frequency:</b> Uses the frequency of tags that appear with the queried tag from a sample of 1000 posts.</li>
            <li><b>Cosine:</b> The overall similarity of tags, regardless of their post count or overlap.</li>
            <li><b>Jaccard:</b> The specific similarity of tags, taking into account the post count and overlap.</li>
            <li><b>Overlap:</b> The number of posts tags have in common.</li>
        </ul>
    </li>
</ul>
<div style="font-size:80%"><b>Note:</b> Each related query order is stored separately, so results can be repeated with different values.</div>`;

const NETWORK_SETTINGS_DETAILS = `
<ul>
    <li><b>Recheck data interval:</b> Data expiring within this period gets automatically requeried.</li>
    <li><b>Network only mode:</b>
        <ul>
            <li>Can be used to correct cache data that has been changed on the server.</li>
            <li><span style="color:red;font-weight:bold">Warning!</span> <span style="font-style:italic">As this negates the benefits of using local cached data, it should only be used sparingly.</span></li>
        </ul>
    </li>
</ul>`;

const CACHE_DATA_DETAILS = `
<ul>
    <li><b>Related tag data:</b> Frequency tags from each of the tag categories (<span style="font-size:80%"><i>beneath the tag edit box</i></span>).
        <ul style="font-size:80%">
            <li>all (rt)</li>
            <li>general (rtgen)</li>
            <li>artists (rtart)</li>
            <li>characters (rtchar)</li>
            <li>copyrights (rtcopy)</li>
            <li>meta (rtmeta)</li>
        </ul>
    </li>
    <li><b>Wiki page tags (wpt):</b> Wiki links to other tags.</li>
    <li><b>Tags overlap (tagov):</b> Frequency of tag in relation to other tags.</li>
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
</ul>`;

const CHECKLIST_TEXTAREA = `
<div id="irt-checklist-frequent-tags">
    <textarea data-autocomplete="tag-query"></textarea>
</div>
`;

const IRT_SCROLL_WRAPPER = `
<div id="irt-edit-scroll-wrapper">
    <div id="irt-edit-scroll-bar"></div>
</div>`;

const IRT_RELATED_TAGS_SECTION = `
<div id="irt-related-tags-container">
    <div class="irt-related-tags">
        <div id="irt-frequent-recent-container" style="display: inline-flex;"></div>
        <div id="irt-related-tags-query-container" style="display: inline-flex;"></div>
        <div id="irt-translated-tags-container" style="display: inline-flex;"></div>
    </div>
</div>`;

const WIKI_PAGE_BUTTON = `
<div id="irt-wiki-page-controls" style="display: inline-flex; margin-bottom: 0.5em; margin-right: 1em;">
    <button id="irt-wiki-page-query" class="irt-wiki-button" title="Query wiki pages only.">Wiki page</button>
</div>`;

const CHECKLIST_BUTTON = `
<div id="irt-checklist-controls" style="display: inline-flex; margin-bottom: 0.5em; margin-right: 1em;">
    <button id="irt-checklist-query" class="irt-checklist-button" title="Query checklist only.">Checklist</button>
</div>`;

//Time constants

const PRUNE_EXPIRES = JSPLib.utility.one_day;

//Expiration variables

const TAGS_OVERLAP_EXPIRES = JSPLib.utility.one_month;
const WIKI_PAGE_TAGS_EXPIRES = 2 * JSPLib.utility.one_week;
const RELATED_TAG_EXPIRES = JSPLib.utility.one_week;

//Validate constants

const RELATEDTAG_CONSTRAINTS = {
    entry: JSPLib.validate.hashentry_constraints,
    value: {
        categories: JSPLib.validate.array_constraints,
        query: JSPLib.validate.stringonly_constraints,
        tags: JSPLib.validate.tagentryarray_constraints(),
    },
    categories: JSPLib.validate.inclusion_constraints(ALL_RELATED),
};

const TAG_OVERLAP_CONSTRAINTS = {
    entry: JSPLib.validate.hashentry_constraints,
    value: {
        count: JSPLib.validate.counting_constraints,
        overlap: JSPLib.validate.hash_constraints,
    },
    overlap: JSPLib.validate.basic_integer_validator,
};

const WIKI_PAGE_CONSTRAINTS = {
    entry: JSPLib.validate.hashentry_constraints,
    value: {
        title: JSPLib.validate.stringonly_constraints,
        tags: JSPLib.validate.tagentryarray_constraints([0, 1, 3, 4, 5, NONEXISTENT_TAG_CATEGORY]),
        other_wikis: JSPLib.validate.array_constraints,
    },
    other_wikis: JSPLib.validate.basic_stringonly_validator,
};

/****Functions****/

//Library functions

////NONE

//Validate functions

FUNC.ValidateEntry = function (self, key, entry) {
    if (!JSPLib.validate.validateIsHash(key, entry)) {
        return false;
    }
    if (key.match(/^rt[fcjo](gen|char|copy|art)?-/)) {
        return FUNC.ValidateRelatedtagEntry(key, entry);
    }
    if (key.match(/^tagov-/)) {
        return FUNC.ValidateTagOverlapEntry(key, entry);
    }
    if (key.match(/^wpt-/)) {
        return FUNC.ValidateWikiPageEntry(key, entry);
    }
    self.debuglog("Bad key!");
    return false;
};

FUNC.ValidateRelatedtagEntry = function (key, entry) {
    if (!JSPLib.validate.validateHashEntries(key, entry, RELATEDTAG_CONSTRAINTS.entry)) {
        return false;
    }
    if (!JSPLib.validate.validateHashEntries(key + '.value', entry.value, RELATEDTAG_CONSTRAINTS.value)) {
        return false;
    }
    return true;
};

FUNC.ValidateTagOverlapEntry = function (key, entry) {
    if (!JSPLib.validate.validateHashEntries(key, entry, TAG_OVERLAP_CONSTRAINTS.entry)) {
        return false;
    }
    if (!JSPLib.validate.validateHashEntries(key + '.value', entry.value, TAG_OVERLAP_CONSTRAINTS.value)) {
        return false;
    }
    if (!JSPLib.validate.validateHashValues(key + '.value.overlap', entry.value.overlap, TAG_OVERLAP_CONSTRAINTS.overlap)) {
        return false;
    }
    return true;
};

FUNC.ValidateWikiPageEntry = function (key, entry) {
    if (!JSPLib.validate.validateHashEntries(key, entry, WIKI_PAGE_CONSTRAINTS.entry)) {
        return false;
    }
    if (!JSPLib.validate.validateHashEntries(key + '.value', entry.value, WIKI_PAGE_CONSTRAINTS.value)) {
        return false;
    }
    if (!JSPLib.validate.validateArrayValues(key + '.other_wikis', entry.value.other_wikis, WIKI_PAGE_CONSTRAINTS.other_wikis)) {
        return false;
    }
    return true;
};

FUNC.ValidateProgramData = function (key, entry) {
    var checkerror = [];
    switch (key) {
        case 'irt-user-settings':
            checkerror = JSPLib.menu.validateUserSettings(entry, SETTINGS_CONFIG);
            break;
        case 'irt-prune-expires':
            if (!Number.isInteger(entry)) {
                checkerror = ["Value is not an integer."];
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
};

//Auxiliary functions

FUNC.GetRelatedKeyModifer = function (category, query_order) {
    return 'rt' + query_order[0] + (category ? JSPLib.danbooru.getShortName(category) : "");
};

FUNC.FilterTagEntries = function (tagentries) {
    if (!IRT.unique_wiki_tags_enabled) return tagentries;
    let tags_seen = new Set();
    return tagentries.filter((entry) => {
        if (tags_seen.has(entry[0])) return false;
        tags_seen.add(entry[0]);
        return true;
    });
};

FUNC.GetTagsEntryArray = function (wiki_page) {
    let wiki_link_targets = JSPLib.utility.findAll(wiki_page.body, /\[\[([^|\]]+)\|?[^\]]*\]\]/g)
        .filter((str) => !str.startsWith('[['))
        .map((str) => str.toLowerCase()
            .replace(/ /g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+/g, "")
            .replace(/_+$/g, ""))
        .filter((str) => !str.match(/^(?:tag_group|pool_group|help|howto|about|template|disclaimer):|list_of_/));
    return wiki_link_targets.map((link_target) => {
        let dtext_link = (wiki_page.dtext_links || []).find((dtext_link) => dtext_link.link_target === link_target);
        if (dtext_link) {
            if (dtext_link.linked_tag?.is_deprecated) {
                return [link_target, DEPRECATED_TAG_CATEGORY];
            }
            if (dtext_link.linked_tag) {
                return [link_target, dtext_link.linked_tag.category];
            }
            return [link_target, NONEXISTENT_TAG_CATEGORY];
        }
        return null;
    }).filter((tag_entry) => tag_entry !== null);
};

FUNC.GetChecklistTagsArray = function (tag_name) {
    let tag_array = JSPLib.storage.getLocalData('irt-checklist-' + tag_name, {default_val: []});
    let check = validate({tag_array}, {tag_array: JSPLib.validate.tagentryarray_constraints([0, 1, 3, 4, 5, DEPRECATED_TAG_CATEGORY, NONEXISTENT_TAG_CATEGORY])});
    if (check) {
        console.warn(`Validation error[${tag_name}]:`, check, tag_array);
        return null;
    }
    return tag_array;
};

FUNC.CreateTagArray = function (tag_list, tag_data) {
    return tag_list.map((name) => {
        let tag = tag_data.find((item) => item.name === name);
        if (!tag) {
            return [name, NONEXISTENT_TAG_CATEGORY];
        }
        if (tag.is_deprecated) {
            return [name, DEPRECATED_TAG_CATEGORY];
        }
        return [name, tag.category];
    });
};

FUNC.GetTagQueryParams = function (tag_list) {
    return {
        search: {
            name_comma: tag_list.join(',')
        },
        only: 'name,category,is_deprecated',
        limit: tag_list.length
    };
};

//Render functions

FUNC.RenderTaglist = function (taglist, columnname, tags_overlap) {
    let html = "";
    let display_percentage = Boolean(IRT.related_statistics_enabled && JSPLib.validate.isHash(tags_overlap));
    taglist.forEach((tagdata) => {
        let tag = tagdata[0];
        let escaped_tag = JSPLib.utility.HTMLEscape(tag);
        let category = tagdata[1];
        let display_name = tag.replace(/_/g, ' ');
        let search_link = JSPLib.danbooru.postSearchLink(tag, display_name, `class="search-tag" data-tag-name="${escaped_tag}"`);
        let margin_style = 'text-indent: -1.5em; margin-left: 1.5em;';
        let prefix = "";
        if (display_percentage) {
            var percentage_string, style;
            if (Number.isInteger(tags_overlap.overlap[tag])) {
                let tag_percentage = Math.ceil(100 * (tags_overlap.overlap[tag] / tags_overlap.count)) || 0;
                percentage_string = JSPLib.utility.padNumber(tag_percentage, 2) + '%';
                style = (tag_percentage >= 100 ? `style="letter-spacing: -2px;"` : "");
            } else {
                percentage_string = ">5%";
                style = 'style="color: darkgrey;"';
            }
            prefix = `<span class="irt-tag-statistic" ${style}>${percentage_string}</span> `;
            margin_style = 'text-indent: -3.3em; margin-left: 3.3em;';
        }
        html += `<div style="${margin_style}">${prefix}<li class="tag-type-${category}" style="display: inline;">${search_link}</li></div>\n`;
    });
    return `
<h6>${columnname}</h6>
<div>
${html}
</div>`;
};

FUNC.RenderTagColumn = function (classname, column_html, is_empty) {
    return `
<div class="tag-column ${classname} irt-is-empty-${is_empty}">
${column_html}
</div>`;
};

FUNC.RenderTagQueryColumn = function (related_tags, tags_overlap) {
    let is_empty = related_tags.tags.length === 0;
    let display_name = related_tags.query.replace(/_/g, ' ');
    let column_html = (!is_empty ? FUNC.RenderTaglist(related_tags.tags, display_name, tags_overlap) : "");
    return FUNC.RenderTagColumn('irt-general-related-tags-column', column_html, is_empty);
};

FUNC.RenderChecklistColumn = function (checklist_tags, tag_name) {
    let is_empty = checklist_tags.length === 0;
    let display_name = "Checklist: " + tag_name.replace(/_/g, ' ');
    let column_html = (!is_empty ? FUNC.RenderTaglist(checklist_tags, display_name) : "");
    return FUNC.RenderTagColumn('irt-checklist-related-tags-column', column_html, is_empty);
};

FUNC.RenderWikiTagQueryColumns = function (wiki_page, other_wikis) {
    let is_empty = wiki_page.tags.length === 0;
    let display_name = wiki_page.title.replace(/_/g, ' ');
    let column_html = (!is_empty ? FUNC.RenderTaglist(FUNC.FilterTagEntries(wiki_page.tags), JSPLib.danbooru.wikiLink(wiki_page.title, `wiki:${display_name}`, 'target="_blank"')) : "");
    let html = FUNC.RenderTagColumn('irt-wiki-related-tags-column', column_html, is_empty);
    other_wikis.forEach((other_wiki) => {
        if (other_wiki.tags.length === 0) return;
        let title_name = other_wiki.title.replace(/_/g, ' ');
        column_html = FUNC.RenderTaglist(FUNC.FilterTagEntries(other_wiki.tags), JSPLib.danbooru.wikiLink(other_wiki.title, `wiki:${title_name}`, 'target="_blank"'));
        html += FUNC.RenderTagColumn('irt-wiki-related-tags-column', column_html, false);
    });
    return html;
};

FUNC.RenderUserQueryColumns = function (recent_tags, frequent_tags, ai_tags) {
    let is_empty = recent_tags.length === 0;
    let column_html = (is_empty ? "" : FUNC.RenderTaglist(recent_tags, 'Recent'));
    let html = FUNC.RenderTagColumn('irt-recent-related-tags-column', column_html, is_empty);
    is_empty = frequent_tags.length === 0;
    column_html = (!is_empty ? FUNC.RenderTaglist(frequent_tags, 'Frequent') : "");
    html += FUNC.RenderTagColumn('irt-frequent-related-tags-column', column_html, is_empty);
    is_empty = ai_tags.length === 0;
    column_html = (!is_empty ? FUNC.RenderTaglist(ai_tags, 'Suggested') : "");
    html += FUNC.RenderTagColumn('irt-ai-tags-related-tags-column', column_html, is_empty);
    return html;
};

FUNC.RenderTranslatedColumn = function (translated_tags) {
    let is_empty = translated_tags.length === 0;
    let column_html = (!is_empty ? FUNC.RenderTaglist(translated_tags, 'Translated') : "");
    return FUNC.RenderTagColumn('irt-translated-tags-related-tags-column', column_html, is_empty);
};

FUNC.RenderRelatedQueryCategoryControls = function () {
    let html = '<button id="related_query_category_all" class="irt-related-button">All</button>';
    for (let category in RELATED_QUERY_CATEGORIES) {
        if (!IRT.related_query_categories.includes(category)) continue;
        let display_name = JSPLib.utility.displayCase(category);
        html += `
<button id="related_query_category_${category}" class="irt-related-button" data-selector="${category}">${display_name}</button>`;
    }
    return `
<div id="irt-related-query-category" style="display: inline-flex; margin-bottom: 0.5em; margin-right: 1em;">
    ${html}
</div>`;
};

FUNC.RenderRelatedQueryTypeControls = function () {
    let html = "";
    RELATED_QUERY_ORDERS.forEach((type) => {
        let checked = (IRT.related_query_order_default[0] === type ? 'checked' : "");
        let display_name = JSPLib.utility.displayCase(type);
        html += `
<label for="related_query_type_${type}">${display_name}</label>
<input id="related_query_type_${type}" class="irt-program-checkbox" type="radio" name="related_query_type" data-selector="${type}" ${checked}>`;
    });
    return `
<div id="irt-related-query-type" style="display: inline-flex; margin-bottom: 0.4em;">
    ${html}
</div>`;
};

//Network functions

FUNC.RandomPosts = async function (tag, batches, per_batch) {
    let posts = [];
    let url_addons = {
        tags: tag + ' order:md5', // Gives us quasi-random results
        only: 'id,md5,tag_string',
        limit: per_batch,
    };
    for (let i = 1; i <= batches; i++) {
        url_addons.page = i;
        let result = await JSPLib.danbooru.submitRequest('posts', url_addons);
        posts = JSPLib.utility.concat(posts, result);
        if (result.length < per_batch) break;
    }
    return posts;
};

FUNC.TagsOverlapQuery = async function(self, tag) {
    const [batches, per_batch] = [IRT.random_post_batches, IRT.random_posts_per_batch];
    self.debuglog("Querying:", tag, batches, per_batch);
    let [posts, count] = await Promise.all([
        FUNC.RandomPosts(tag, batches, per_batch),
        JSPLib.danbooru.submitRequest('counts/posts', {tags: tag}, {default_val: {counts: {posts: 0}}})
    ]);
    let overlap = {};
    for (let i = 0; i < posts.length; i++) {
        let tag_names = posts[i].tag_string.split(' ');
        tag_names.forEach((tag) => {
            overlap[tag] = (overlap[tag] ?? 0) + 1;
        });
    }
    let cutoff = Math.min(posts.length, batches * per_batch) / 20; // (5% or greater overlap)
    for (let k in overlap) {
        if (overlap[k] < cutoff) {
            delete overlap[k];
        }
    }
    return {value: {overlap, count: Math.min(count.counts.posts, batches * per_batch)}, expires: JSPLib.utility.getExpires(TAGS_OVERLAP_EXPIRES)};
};

FUNC.WikiPageTagsQuery = async function (self, title) {
    self.debuglog("Querying:", title, (IRT.other_wikis_enabled ? "with" : "without", "other wikis"));
    let url_addons = {
        search: {title},
        only: 'body,tag,dtext_links[link_target,link_type,linked_tag[name,category,is_deprecated]]'
    };
    let wikis_with_links = await JSPLib.danbooru.submitRequest('wiki_pages', url_addons);
    let tags = (wikis_with_links.length ? FUNC.GetTagsEntryArray(wikis_with_links[0]) : []);
    if (IRT.query_unknown_tags_enabled) {
        let tag_names = tags.filter((tag) => tag[1] === NONEXISTENT_TAG_CATEGORY).map((tag) => tag[0]);
        if (tag_names.length) {
            let tag_data = await JSPLib.danbooru.submitRequest('tags', FUNC.GetTagQueryParams(tag_names));
            let tag_array = FUNC.CreateTagArray(tag_names, tag_data);
            tags = tags.map((tag_entry) => (tag_array.find((item) => item[0] === tag_entry[0]) ?? tag_entry));
        }
    }
    let other_wikis = (!title.startsWith('list_of_') ?
        (wikis_with_links?.[0]?.dtext_links || [])
            .filter((link) => (link.link_type === 'wiki_link' && link.link_target.startsWith('list_of_')))
            .map((link) => link.link_target) :
        []);
    return {value: {title, tags, other_wikis}, expires: JSPLib.utility.getExpires(WIKI_PAGE_TAGS_EXPIRES)};
};

FUNC.RelatedTagsQuery = async function(self, tag, category, query_order) {
    self.debuglog("Querying:", tag, category);
    let url_addons = {search: {query: tag, order: query_order}, limit: IRT.related_results_limit || Danbooru.RelatedTag.MAX_RELATED_TAGS};
    if (category in RELATED_QUERY_CATEGORIES) {
        url_addons.search.category = RELATED_QUERY_CATEGORIES[category];
    }
    let html = await JSPLib.network.get('/related_tag.html', {data: url_addons});
    let tagentry_array = $(html).find('tbody .name-column a[href^="/posts"]').toArray().map((link) => {
        let name = link.innerText;
        let category = Number(
            link.className
                .match(/tag-type-(\d)/)?.[1]
                ?? NONEXISTENT_TAG_CATEGORY
        );
        return [name, category];
    });
    let data = {
        query: tag,
        categories: (category ? [RELATED_QUERY_CATEGORIES[category]] : []),
        tags: tagentry_array,
    };
    return {value: data, expires: JSPLib.utility.getExpires(RELATED_TAG_EXPIRES)};
};

//Network/storage wrappers

FUNC.GetCachedData = async function (self, {name = "", args = [], keyfunc = (() => {}), netfunc = (() => {}), expires = null} = {}) {
    let key = keyfunc(...args);
    self.debuglog("Checking", name, ':', key);
    let cached = await (!IRT.network_only_mode ?
        JSPLib.storage.checkLocalDB(key, expires) :
        Promise.resolve(null));
    if (!cached) {
        cached = await netfunc(...args);
        JSPLib.storage.saveData(key, cached);
    } else if (IRT.recheck_data_interval > 0) {
        let recheck_time = cached.expires - (IRT.recheck_data_interval * JSPLib.utility.one_day);
        if (!JSPLib.utility.validateExpires(recheck_time)) {
            self.debuglog("Rechecking", name, key);
            netfunc(...args).then((data) => {
                JSPLib.storage.saveData(key, data);
            });
        }
    }
    self.debuglog("Found", name, ':', key, cached.value);
    return cached.value;
};

FUNC.GetRelatedTags = function (tag, category, query_order) {
    return FUNC.GetCachedData({
        name: 'related tags',
        args: [tag, category, query_order],
        keyfunc: (tag, category, query_order) => (FUNC.GetRelatedKeyModifer(category, query_order) + '-' + tag),
        netfunc: FUNC.RelatedTagsQuery,
        expires: RELATED_TAG_EXPIRES,
    });
};

FUNC.GetTagsOverlap = function (tag) {
    return FUNC.GetCachedData({
        name: 'tags overlap',
        args: [tag],
        keyfunc: (tag) => ('tagov-' + tag),
        netfunc: FUNC.TagsOverlapQuery,
        expires: TAGS_OVERLAP_EXPIRES,
    });
};

FUNC.GetWikiPageTags = function(tag) {
    return FUNC.GetCachedData({
        name: 'wiki page tags',
        args: [tag],
        keyfunc: (tag) => ('wpt-' + tag),
        netfunc: FUNC.WikiPageTagsQuery,
        expires: WIKI_PAGE_TAGS_EXPIRES,
    });
};

FUNC.GetAllWikiPageTags = async function (tag) {
    let wiki_page = await FUNC.GetWikiPageTags(tag);
    var other_wikis;
    if (IRT.other_wikis_enabled) {
        let promise_array = [];
        wiki_page.other_wikis.forEach((title) => {
            promise_array.push(FUNC.GetWikiPageTags(title));
        });
        other_wikis = await Promise.all(promise_array);
    } else {
        other_wikis = [];
    }
    return {wiki_page, other_wikis};
};

//Event handlers

FUNC.RelatedTagsButton = async function (event) {
    event.preventDefault();
    let currenttag = Danbooru.RelatedTag.current_tag().trim().toLowerCase();
    let category = $(event.target).data('selector');
    let query_order = (IRT.related_query_order_enabled ? JSPLib.menu.getCheckboxRadioSelected('.irt-program-checkbox') : IRT.related_query_order_default);
    let promise_array = [FUNC.GetRelatedTags(currenttag, category, query_order[0])];
    if (IRT.related_statistics_enabled) {
        promise_array.push(FUNC.GetTagsOverlap(currenttag));
    } else {
        promise_array.push(Promise.resolve(null));
    }
    if (IRT.wiki_page_tags_enabled) {
        promise_array.push(FUNC.GetAllWikiPageTags(currenttag));
    } else {
        promise_array.push(Promise.resolve(null));
    }
    let [related_tags, tags_overlap, wiki_result] = await Promise.all(promise_array);
    if (!related_tags) {
        return;
    }
    var tag_array;
    if (IRT.checklist_tags_enabled) {
        tag_array = FUNC.GetChecklistTagsArray(currenttag) ?? [];
    }
    $('#irt-related-tags-query-container').html(
        FUNC.RenderTagQueryColumn(related_tags, tags_overlap) +
        (IRT.checklist_tags_enabled ? FUNC.RenderChecklistColumn(tag_array, currenttag) : "") +
        (IRT.wiki_page_tags_enabled ? FUNC.RenderWikiTagQueryColumns(wiki_result.wiki_page, wiki_result.other_wikis) : "")
    );
    FUNC.UpdateSelected();
    FUNC.QueueRelatedTagColumnWidths();
};

FUNC.WikiPageButton = async function (event) {
    event.preventDefault();
    let currenttag = Danbooru.RelatedTag.current_tag().trim().toLowerCase();
    let wiki_result = await FUNC.GetAllWikiPageTags(currenttag);
    $('#irt-related-tags-query-container').html(FUNC.RenderWikiTagQueryColumns(wiki_result.wiki_page, wiki_result.other_wikis));
    FUNC.UpdateSelected();
    FUNC.QueueRelatedTagColumnWidths();
};

FUNC.ChecklistButton = async function (event) {
    event.preventDefault();
    let currenttag = Danbooru.RelatedTag.current_tag().trim().toLowerCase();
    let tag_array = FUNC.GetChecklistTagsArray(currenttag);
    if (tag_array === null) {
        JSPLib.notice.error("Corrupted data: See debug console for details.");
    } else {
        $('#irt-related-tags-query-container').html(FUNC.RenderChecklistColumn(tag_array, currenttag));
        FUNC.UpdateSelected();
        FUNC.QueueRelatedTagColumnWidths();
    }
};

FUNC.RelatedTagsEnter = function () {
    $(document).on(PROGRAM_KEYDOWN + '.scroll', null, 'left right', FUNC.RelatedTagsScroll);
};

FUNC.RelatedTagsLeave = function () {
    $(document).off(PROGRAM_KEYDOWN + '.scroll');
};

FUNC.RelatedTagsScroll = function (event) {
    let $related_tags = $('.irt-related-tags');
    let current_left = $related_tags.prop('scrollLeft');
    if (event.originalEvent.key === 'ArrowLeft') {
        current_left -= 40;
    } else if (event.originalEvent.key === 'ArrowRight') {
        current_left += 40;
    }
    $related_tags.prop('scrollLeft', current_left);
};

FUNC.ViewChecklistTag = function () {
    let import_export = $('#irt-enable-import-export').prop('checked');
    if (import_export) {
        let tag_list =
            Object.keys(localStorage)
                .filter((name) => name.startsWith('irt-checklist-'))
                .map((name) => name.replace('irt-checklist-', ""));
        let tag_data = tag_list.map((tag_name) => {
            let tag_array = FUNC.GetChecklistTagsArray(tag_name);
            if (Array.isArray(tag_array)) {
                return {[tag_name]: tag_array.map((item) => item[0])};
            }
            return null;
        }).filter((data) => data != null);
        $('#irt-checklist-frequent-tags textarea').val(JSON.stringify(JSPLib.utility.mergeHashes(...tag_data), null, 4));
    } else {
        let tag_name = $('#irt-control-tag-name').val().split(/\s+/)[0];
        if (!tag_name) return;
        let tag_array = FUNC.GetChecklistTagsArray(tag_name);
        if (tag_array === null) {
            JSPLib.notice.error("Corrupted data: See debug console for details.");
        } else {
            let tag_list = tag_array.map((entry) => entry[0]);
            $('#irt-checklist-frequent-tags textarea').val(tag_list.join('\n'));
        }
    }
};

FUNC.SaveChecklistTag = async function () {
    let import_export = $('#irt-enable-import-export').prop('checked');
    if (import_export) {
        let text_input = $('#irt-checklist-frequent-tags textarea').val();
        var data_input;
        try {
            data_input = JSON.parse(text_input);
        } catch (e) {
            data_input = null;
            JSPLib.debug.debugerror("Error parsing data:", e);
        }
        if (JSPLib.validate.isHash(data_input)) {
            let checklist_data = {};
            let check_tags = [];
            for (let key in data_input) {
                let checklist = data_input[key];
                if (!Array.isArray(checklist)) continue;
                checklist = checklist.filter((item) => typeof item === "string");
                if (checklist.length === 0) continue;
                checklist_data[key] = checklist;
                check_tags = JSPLib.utility.arrayUnion(check_tags, checklist);
            }
            if (check_tags.length > 0) {
                JSPLib.notice.notice("Querying tags...");
                let tag_data = [];
                for (let i = 0; i < check_tags.length; i += 1000) {
                    let query_tags = check_tags.slice(i, i + 1000);
                    let tags = await JSPLib.danbooru.submitRequest('tags', FUNC.GetTagQueryParams(query_tags), {long_format: true});
                    tag_data = JSPLib.utility.concat(tag_data, tags);
                }
                for (let tag_name in checklist_data) {
                    let checklist = checklist_data[tag_name];
                    let tag_array = FUNC.CreateTagArray(checklist, tag_data);
                    JSPLib.storage.setLocalData('irt-checklist-' + tag_name, tag_array);
                }
                JSPLib.notice.notice("Checklists imported.");
            } else {
                JSPLib.notice.error("No valid checklists found.");
            }
        } else {
            JSPLib.notice.error("Error importing checklist.");
        }
    } else {
        let tag_name = $('#irt-control-tag-name').val().split(/\s+/)[0];
        if (!tag_name) return;
        let checklist = $('#irt-checklist-frequent-tags textarea').val().split(/\s/).filter((name) => (name !== ""));
        if (checklist.length > 0) {
            let tag_data = await JSPLib.danbooru.submitRequest('tags', FUNC.GetTagQueryParams(checklist));
            let tag_array = FUNC.CreateTagArray(checklist, tag_data);
            JSPLib.storage.setLocalData('irt-checklist-' + tag_name, tag_array);
        } else {
            JSPLib.storage.removeLocalData('irt-checklist-' + tag_name);
        }
        JSPLib.notice.notice("Checklist updated.");
    }
};

FUNC.PopulateChecklistTag = function () {
    let tag_name = $('#irt-control-tag-name').val().split(/\s+/)[0];
    if (!tag_name) return;
    JSPLib.notice.notice("Querying Danbooru...");
    FUNC.WikiPageTagsQuery(tag_name).then((data) => {
        let tag_list = data.value.tags.map((entry) => entry[0]);
        $('#irt-checklist-frequent-tags textarea').val(tag_list.join('\n'));
    });
};

FUNC.ListChecklistTags = function () {
    let tag_list =
        Object.keys(localStorage)
            .filter((name) => name.startsWith('irt-checklist-'))
            .map((name) => name.replace('irt-checklist-', ""))
            .sort();
    $('#irt-checklist-frequent-tags textarea').val(tag_list.join('\n'));
};

//Initialization functions

FUNC.InitializeUserMediaTags = function (self) {
    let recent_tags = $('.recent-related-tags-column [data-tag-name]').map((i, entry) => [[entry.dataset.tagName, Number(entry.className.match(/tag-type-(\d)/)?.[1])]]).toArray();
    let frequent_tags = $('.frequent-related-tags-column [data-tag-name]').map((i, entry) => [[entry.dataset.tagName, Number(entry.className.match(/tag-type-(\d)/)?.[1])]]).toArray();
    let ai_tags = $('.ai-tags-related-tags-column [data-tag-name]').map((i, entry) => [[entry.dataset.tagName, Number(entry.className.match(/tag-type-(\d)/)?.[1])]]).toArray();
    self.debuglog("Media tags:", {recent_tags, frequent_tags, ai_tags});
    $('#irt-frequent-recent-container').html(FUNC.RenderUserQueryColumns(recent_tags, frequent_tags, ai_tags));
    FUNC.UpdateSelected();
    FUNC.QueueRelatedTagColumnWidths();
};

FUNC.InitializeTranslatedTags = function (self) {
    let translated_tags = $('.translated-tags-related-tags-column [data-tag-name]').map((i, entry) => [[entry.dataset.tagName, Number(entry.className.match(/tag-type-(\d)/)?.[1])]]).toArray();
    self.debuglog("Translated tags:", translated_tags);
    $('#irt-translated-tags-container').html(FUNC.RenderTranslatedColumn(translated_tags));
    FUNC.UpdateSelected();
    FUNC.QueueRelatedTagColumnWidths();
};

FUNC.UpdateSelected = function () {
    const current_tags = Danbooru.RelatedTag.current_tags();
    $('.irt-related-tags li').each((_, li) => {
        const tag_name = $(li).find('a').attr('data-tag-name');
        if (current_tags.includes(tag_name)) {
            $(li).addClass('selected');
            $(li).find('input').prop('checked', true);
        } else {
            $(li).removeClass('selected');
            $(li).find('input').prop('checked', false);
        }
    });
};

FUNC.ToggleTag = function (event) {
    const $field = $('#post_tag_string');
    const tag = $(event.target).closest('li').find('a').attr('data-tag-name');
    if (Danbooru.RelatedTag.current_tags().includes(tag)) {
        const escaped_tag = Danbooru.Utility.regexp_escape(tag);
        $field.val($field.val().replace(new RegExp('(^|\\s)' + escaped_tag + '($|\\s)', 'gi'), '$1$2'));
    } else {
        $field.val($field.val() + ' ' + tag);
    }
    $field.val($field.val().trim().replace(/ +/g, ' ') + ' ');
    FUNC.UpdateSelected();
    // The timeout is needed on Chrome since it will clobber the field attribute otherwise
    setTimeout(() => {
        $field.prop('selectionStart', $field.val().length);
    }, 100);
    event.preventDefault();
    // Artificially trigger input event so the tag counter updates.
    $field.trigger('input');
};

//Initialize functions

FUNC.InitializeRelatedTagsSection = function () {
    Danbooru.Post.EDIT_DIALOG_MIN_HEIGHT = 800;
    $(document).on(PROGRAM_CLICK, '.irt-related-tags a.search-tag', FUNC.ToggleTag);
    $(document).on(PROGRAM_CLICK, '.irt-related-button', FUNC.RelatedTagsButton);
    $(document).on(PROGRAM_CLICK, '.irt-wiki-button', FUNC.WikiPageButton);
    $(document).on(PROGRAM_CLICK, '.irt-checklist-button', FUNC.ChecklistButton);
    $(document).on('input.irt', '#post_tag_string', FUNC.UpdateSelected);
    FUNC.InitialiazeRelatedQueryControls();
    $('.related-tags').before(IRT_RELATED_TAGS_SECTION);
    $('#related-tags-container').hide();
    FUNC.InitializeTagColumns();
    if (IRT.expandable_related_section_enabled) {
        FUNC.InitialiazeRelatedExpandableSection();
    }
};

FUNC.InitializeTagColumns = function (self) {
    if (IRT.controller === 'posts') {
        let media_asset_id = $("#related-tags-container").attr("data-media-asset-id");
        JSPLib.network.get("/related_tag.js", {data: {user_tags: true, media_asset_id}});
    }
    if (!$('#related-tags-container .ai-tags-related-tags-column').html()?.trim()) {
        self.debuglog("User/Media tags not loaded yet... setting up mutation observer.");
        JSPLib.concurrency.setupMutationReplaceObserver('#related-tags-container', '.ai-tags-related-tags-column', () => {
            FUNC.InitializeUserMediaTags();
        });
    } else {
        FUNC.InitializeUserMediaTags();
    }
    if (!$('#related-tags-container .translated-tags-related-tags-column').html()?.trim()) {
        self.debuglog("Translated tags not loaded yet... setting up mutation observer.");
        JSPLib.concurrency.setupMutationReplaceObserver('#related-tags-container', '.translated-tags-related-tags-column', () => {
            FUNC.InitializeTranslatedTags();
        });
    } else {
        FUNC.InitializeTranslatedTags();
    }
};

FUNC.InitialiazeRelatedQueryControls = function () {
    $('#post_tag_string, #upload_tag_string').parent().after('<div id="irt-related-tag-query-controls" style="display: flex; flex-wrap: wrap;"></div>');
    $('#irt-related-tag-query-controls').append(FUNC.RenderRelatedQueryCategoryControls());
    if (IRT.wiki_page_query_only_enabled) {
        $('#irt-related-tag-query-controls').append(WIKI_PAGE_BUTTON);
    }
    if (IRT.checklist_query_only_enabled) {
        $('#irt-related-tag-query-controls').append(CHECKLIST_BUTTON);
    }
    if (IRT.related_query_order_enabled) {
        $('#irt-related-tag-query-controls').append(FUNC.RenderRelatedQueryTypeControls());
        $('#irt-related-query-type .irt-program-checkbox').checkboxradio();
        $('#irt-related-query-type .ui-state-hover').removeClass('ui-state-hover');
    }
    $('#post_tag_string').css('max-width', '80rem');
    $('#post_tag_string').closest('.fixed-width-container').css('max-width', '80rem');
    JSPLib.utility.setCSSStyle(RELATED_QUERY_CONTROL_CSS, 'related_query');
};

FUNC.InitialiazeRelatedExpandableSection = function () {
    $('.irt-related-tags').before(IRT_SCROLL_WRAPPER);
    $('.irt-related-tags').on(PROGRAM_MOUSEENTER, FUNC.RelatedTagsEnter);
    $('.irt-related-tags').on(PROGRAM_MOUSELEAVE, FUNC.RelatedTagsLeave);
    $('#irt-edit-scroll-wrapper').on(PROGRAM_SCROLL, () => {
        $('.irt-related-tags').scrollLeft($('#irt-edit-scroll-wrapper').scrollLeft());
    });
    $('.irt-related-tags').on(PROGRAM_SCROLL, () => {
        $('#irt-edit-scroll-wrapper').scrollLeft($('.irt-related-tags').scrollLeft());
    });
    let $container = $('#irt-related-tags-container');
    new ResizeObserver(() => {
        FUNC.QueueRelatedTagColumnWidths();
    }).observe($container[0]);
    JSPLib.utility.setCSSStyle(EXPANDABLE_RELATED_SECTION_CSS, 'expandable_related');
};

FUNC.InitializeRelatedTagColumnWidths = function () {
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
    let $related_tags = $('.irt-related-tags');
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
        $('#irt-edit-scroll-wrapper').width($related_tags.outerWidth());
        $('#irt-edit-scroll-bar').width($related_tags.prop('scrollWidth') - em_size);
        $('#irt-edit-scroll-wrapper').show();
        $related_tags.addClass('scrollable');
    } else {
        $('#irt-edit-scroll-wrapper').hide();
        $related_tags.removeClass('scrollable');
    }
};

FUNC.QueueRelatedTagColumnWidths = function () {
    if (Number.isInteger(FUNC.QueueRelatedTagColumnWidths.timer)) {
        clearTimeout(FUNC.QueueRelatedTagColumnWidths.timer);
    }
    FUNC.QueueRelatedTagColumnWidths.timer = setTimeout(() => {
        FUNC.InitializeRelatedTagColumnWidths();
        FUNC.QueueRelatedTagColumnWidths.timer = null;
    }, 100);
};

//Main execution functions

FUNC.SetupInitializations = function () {
    if (IRT.action !== 'show' || !['posts', 'uploads', 'upload-media-assets'].includes(IRT.controller)) return;
    IRT.inititialization_started = false;
    // Wait for event signal from Danbooru
    $(document).on('danbooru:open-post-edit-tab.irt danbooru:open-post-edit-dialog.irt', () => {
        IRT.inititialization_started = true;
        $(document).off('danbooru:open-post-edit-tab.irt danbooru:open-post-edit-dialog.irt');
    });
    // Or check if the tags have already been rendered
    JSPLib.utility.recheckTimer({
        check: () => (IRT.inititialization_started || ($('#related-tags-container .ai-tags-related-tags-column .tag-list').html() || "").trim() !== ""),
        exec: () => FUNC.InitializeRelatedTagsSection(),
        fail: () => {
            $(document)
                .off('danbooru:open-post-edit-tab.irt danbooru:open-post-edit-dialog.irt')
                .on('danbooru:open-post-edit-tab.irt danbooru:open-post-edit-dialog.irt', () => {
                    FUNC.InitializeRelatedTagsSection();
                    $(document).off('danbooru:open-post-edit-tab.irt danbooru:open-post-edit-dialog.irt');
                });
        },
    }, 250, JSPLib.utility.one_second * 10);
    $(document).on('danbooru:close-post-edit-dialog.irt', FUNC.QueueRelatedTagColumnWidths);
};

FUNC.CleanupTasks = function () {
    JSPLib.storage.pruneProgramCache(PROGRAM_SHORTCUT, PROGRAM_DATA_REGEX, PRUNE_EXPIRES);
};

//Menu functions

FUNC.OptionCacheDataKey = function (data_type, data_value) {
    if (data_type === 'related_tag') {
        IRT.tag_category = $('#irt-control-tag-category').val();
        IRT.query_order = $('#irt-control-query-order').val();
        let modifier = FUNC.GetRelatedKeyModifer(IRT.related_category, IRT.query_order);
        return `${modifier}-${data_value}`;
    }
    if (data_type === 'wiki_page') {
        return `wpt-${data_value}`;
    }
    if (data_type === 'tag_overlap') {
        return `tagov-${data_value}`;
    }
};

FUNC.DataTypeChange = function () {
    let data_type = $('#irt-control-data-type').val();
    let action = (data_type === 'related_tag' ? 'show' : 'hide');
    $('.irt-options[data-setting=tag_category]')[action]();
    $('.irt-options[data-setting=query_order]')[action]();
};

FUNC.InitializeProgramValues = function(self) {
    if (!JSPLib.storage.use_indexed_db) {
        self.debugwarn("No Indexed DB! Exiting...");
        return false;
    }
    return true;
};

FUNC.RenderSettingsMenu = function() {
    $('#indexed-related-tags').append(JSPLib.menu.renderMenuFramework(MENU_CONFIG));
    $('#irt-general-settings').append(JSPLib.menu.renderDomainSelectors());
    $('#irt-related-tag-settings-message').append(JSPLib.menu.renderExpandable("Additional setting details", RELATED_TAG_SETTINGS_DETAILS));
    $('#irt-related-tag-settings').append(JSPLib.menu.renderInputSelectors('related_query_categories', 'checkbox'));
    $('#irt-related-tag-settings').append(JSPLib.menu.renderCheckbox('related_query_order_enabled'));
    $('#irt-related-tag-settings').append(JSPLib.menu.renderInputSelectors('related_query_order_default', 'radio'));
    $('#irt-related-tag-settings').append(JSPLib.menu.renderTextinput('related_results_limit', 5));
    $('#irt-related-tag-settings').append(JSPLib.menu.renderCheckbox('expandable_related_section_enabled'));
    $('#irt-tag-statistic-settings').append(JSPLib.menu.renderCheckbox('related_statistics_enabled'));
    $('#irt-tag-statistic-settings').append(JSPLib.menu.renderTextinput('random_post_batches', 5));
    $('#irt-tag-statistic-settings').append(JSPLib.menu.renderTextinput('random_posts_per_batch', 5));
    $('#irt-checklist-settings').append(JSPLib.menu.renderCheckbox('checklist_tags_enabled'));
    $('#irt-checklist-settings').append(JSPLib.menu.renderCheckbox('checklist_query_only_enabled'));
    $('#irt-wiki-page-settings').append(JSPLib.menu.renderCheckbox('wiki_page_tags_enabled'));
    $('#irt-wiki-page-settings').append(JSPLib.menu.renderCheckbox('other_wikis_enabled'));
    $('#irt-wiki-page-settings').append(JSPLib.menu.renderCheckbox('unique_wiki_tags_enabled'));
    $('#irt-wiki-page-settings').append(JSPLib.menu.renderCheckbox('wiki_page_query_only_enabled'));
    $('#irt-wiki-page-settings').append(JSPLib.menu.renderCheckbox('query_unknown_tags_enabled'));
    $('#irt-network-settings-message').append(JSPLib.menu.renderExpandable("Additional setting details", NETWORK_SETTINGS_DETAILS));
    $('#irt-network-settings').append(JSPLib.menu.renderTextinput('recheck_data_interval', 5));
    $('#irt-network-settings').append(JSPLib.menu.renderCheckbox('network_only_mode'));
    $('#irt-checklist-controls').append(JSPLib.menu.renderCheckbox('import_export', true));
    $('#irt-checklist-controls').append(JSPLib.menu.renderTextinput('tag_name', 50, true));
    $('#irt-control-tag-name').attr('data-autocomplete', 'tag-query');
    $('#irt-checklist-controls').append(CHECKLIST_TEXTAREA);
    $('#irt-controls').append(JSPLib.menu.renderCacheControls());
    $('#irt-cache-controls-message').append(JSPLib.menu.renderExpandable("Cache Data details", CACHE_DATA_DETAILS));
    $('#irt-cache-controls').append(JSPLib.menu.renderLinkclick('cache_info', true));
    $('#irt-cache-controls').append(JSPLib.menu.renderCacheInfoTable());
    $('#irt-cache-controls').append(JSPLib.menu.renderLinkclick('purge_cache', true));
    $('#irt-controls').append(JSPLib.menu.renderCacheEditor(true));
    $('#irt-cache-editor-message').append(JSPLib.menu.renderExpandable("Program Data details", PROGRAM_DATA_DETAILS));
    $('#irt-cache-editor-controls').append(JSPLib.menu.renderKeyselect('data_source', true));
    $('#irt-cache-editor-controls').append(JSPLib.menu.renderDataSourceSections());
    $('#irt-section-indexed-db').append(JSPLib.menu.renderKeyselect('data_type', true));
    $('#irt-section-indexed-db').append(JSPLib.menu.renderKeyselect('tag_category', true));
    $('#irt-section-indexed-db').append(JSPLib.menu.renderKeyselect('query_order', true));
    $('#irt-section-local-storage').append(JSPLib.menu.renderCheckbox('raw_data', true));
    $('#irt-cache-editor-controls').append(JSPLib.menu.renderTextinput('data_name', 20, true));
    JSPLib.menu.engageUI(true, true);
    JSPLib.menu.saveUserSettingsClick();
    JSPLib.menu.resetUserSettingsClick(LOCALSTORAGE_KEYS);
    $('#irt-tag-name-view').on(PROGRAM_CLICK, FUNC.ViewChecklistTag);
    $('#irt-tag-name-save').on(PROGRAM_CLICK, FUNC.SaveChecklistTag);
    $('#irt-tag-name-populate').on(PROGRAM_CLICK, FUNC.PopulateChecklistTag);
    $('#irt-tag-name-list').on(PROGRAM_CLICK, FUNC.ListChecklistTags);
    JSPLib.menu.cacheInfoClick();
    JSPLib.menu.purgeCacheClick();
    JSPLib.menu.expandableClick();
    JSPLib.menu.dataSourceChange();
    $('#irt-control-data-type').on('change.irt', FUNC.DataTypeChange);
    JSPLib.menu.rawDataChange();
    JSPLib.menu.getCacheClick(FUNC.ValidateProgramData);
    JSPLib.menu.saveCacheClick(FUNC.ValidateProgramData, FUNC.ValidateEntry);
    JSPLib.menu.deleteCacheClick();
    JSPLib.menu.listCacheClick();
    JSPLib.menu.refreshCacheClick();
    JSPLib.menu.cacheAutocomplete();
};

//Main program

FUNC.Main = function(self) {
    self.debuglog("Initialize start:", JSPLib.utility.getProgramTime());
    const preload = {
        run_on_settings: true,
        default_data: DEFAULT_VALUES,
        initialize_func: FUNC.InitializeProgramValues,
        menu_css: SETTINGS_MENU_CSS,
    };
    if (!JSPLib.menu.preloadScript(IRT, FUNC.RenderSettingsMenu, preload)) return;
    FUNC.SetupInitializations();
    JSPLib.utility.setCSSStyle(PROGRAM_CSS, 'program');
    JSPLib.statistics.addPageStatistics(PROGRAM_NAME);
    JSPLib.load.noncriticalTasks(FUNC.CleanupTasks);
};

/****Function decoration****/

JSPLib.debug.addProgramTimers(FUNC, {
    sync_funcs: ['RenderTagQueryColumn', 'RenderSettingsMenu'],
    async_funcs: ['RelatedTagsButton', 'WikiPageButton', 'RelatedTagsQuery'],
});
JSPLib.debug.addProgramLogs(FUNC, [
    'Main', 'ValidateEntry', 'InitializeProgramValues',
    'InitializeTagColumns', 'InitializeUserMediaTags', 'InitializeTranslatedTags',
    'RelatedTagsQuery', 'TagsOverlapQuery', 'WikiPageTagsQuery',
    'GetCachedData', 'BroadcastIRT',
]);

/****Initialization****/

//Variables for debug.js
JSPLib.debug.debug_console = false;
JSPLib.debug.level = JSPLib.debug.INFO;
JSPLib.debug.program_shortcut = PROGRAM_SHORTCUT;

//Variables for menu.js
JSPLib.menu.program_shortcut = PROGRAM_SHORTCUT;
JSPLib.menu.program_name = PROGRAM_NAME;
JSPLib.menu.program_data = IRT;
JSPLib.menu.program_reset_data = PROGRAM_RESET_KEYS;
JSPLib.menu.program_data_regex = PROGRAM_DATA_REGEX;
JSPLib.menu.program_data_key = FUNC.OptionCacheDataKey;
JSPLib.menu.settings_config = SETTINGS_CONFIG;
JSPLib.menu.control_config = CONTROL_CONFIG;

//Variables for storage.js
JSPLib.storage.indexedDBValidator = FUNC.ValidateEntry;

//Export JSPLib
JSPLib.load.exportData(PROGRAM_NAME, IRT, {datalist: ['cached_data'], other_data: {FUNC}});

/****Execution start****/

JSPLib.load.programInitialize(FUNC.Main, {program_name: PROGRAM_NAME, required_variables: PROGRAM_LOAD_REQUIRED_VARIABLES, required_selectors: PROGRAM_LOAD_REQUIRED_SELECTORS});
