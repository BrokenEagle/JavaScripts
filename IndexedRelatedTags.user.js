// ==UserScript==
// @name         IndexedRelatedTags
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      3.11
// @description  Uses Indexed DB for autocomplete, plus caching of other data.
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        https://*.donmai.us/*
// @exclude      /^(?!https:\/\/\w+\.donmai\.us\/((posts|upload_media_assets|uploads)\/\d+|uploads\/\d+\/assets\/\d+|settings)\/?(\?|$)).*/
// @exclude      /^https://\w+\.donmai\.us/.*\.(xml|json|atom)(\?|$)/
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/IndexedRelatedTags.user.js
// @updateURL    https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/IndexedRelatedTags.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.10.0/localforage.min.js
// @require      https://cdn.jsdelivr.net/npm/localforage-removeitems@1.4.0/dist/localforage-removeitems.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.13.1/validate.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/7e48abbddec16868fcd5ca7d9209df1760593c27/lib/module.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/7e48abbddec16868fcd5ca7d9209df1760593c27/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/7e48abbddec16868fcd5ca7d9209df1760593c27/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/7e48abbddec16868fcd5ca7d9209df1760593c27/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/7e48abbddec16868fcd5ca7d9209df1760593c27/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/7e48abbddec16868fcd5ca7d9209df1760593c27/lib/notice.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/7e48abbddec16868fcd5ca7d9209df1760593c27/lib/template.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/7e48abbddec16868fcd5ca7d9209df1760593c27/lib/concurrency.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/7e48abbddec16868fcd5ca7d9209df1760593c27/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/7e48abbddec16868fcd5ca7d9209df1760593c27/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/7e48abbddec16868fcd5ca7d9209df1760593c27/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/7e48abbddec16868fcd5ca7d9209df1760593c27/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/7e48abbddec16868fcd5ca7d9209df1760593c27/lib/menu.js
// ==/UserScript==

/* global JSPLib $ */

(({DanbooruProxy, ValidateJS, Debug, Notice, Utility, Storage, Template, Validate, Concurrency, Statistics, Network, Danbooru, Load, Menu}) => {

const PROGRAM_NAME = 'IndexedRelatedTags';
const PROGRAM_SHORTCUT = 'irt';

/****Library updates****/

////NONE

/****Global variables****/

//Exterior script variables
const DANBOORU_TOPIC_ID = '23592';

//Variables for load.js
const PROGRAM_LOAD_REQUIRED_VARIABLES = ['window.jQuery', 'window.Danbooru', 'Danbooru.RelatedTag', 'Danbooru.Post'];
const PROGRAM_LOAD_REQUIRED_SELECTORS = ['#top', '#page'];

//Program data constants
const PROGRAM_DATA_REGEX = /^(rt[fcjo](gen|char|copy|art)?|wpt|tagov)-/; //Regex that matches the prefix of all program cache data

//Main program variables
const IRT = {};

//Available setting values
const RELATED_QUERY_ORDERS = ['frequency', 'cosine', 'jaccard', 'overlap'];

//Main settings
const SETTINGS_CONFIG = {
    related_query_categories: {
        allitems: Danbooru.categories.names,
        reset: Danbooru.categories.names,
        validate: (data) => Menu.validateCheckboxRadio(data, 'checkbox', Danbooru.categories.names),
        hint: "Select the category query buttons to show.",
    },
    related_results_limit: {
        reset: 0,
        parse: parseInt,
        validate: (data) => Menu.validateNumber(data, true, 0, 50),
        hint: "Number of results to show (1 - 50) for the primary <b>Tags</b> column. Setting to 0 uses Danbooru's default limit."
    },
    related_query_order_enabled: {
        reset: false,
        validate: Utility.isBoolean,
        hint: "Show controls that allow for alternate query orders on related tags."
    },
    related_query_order_default: {
        allitems: RELATED_QUERY_ORDERS,
        reset: ['frequency'],
        validate: (data) => Menu.validateCheckboxRadio(data, 'radio', RELATED_QUERY_ORDERS),
        hint: "Select the default query order selected on the related tag controls. Will be the order used when the order controls are not available."
    },
    expandable_related_section_enabled: {
        reset: true,
        validate: Utility.isBoolean,
        hint: "Places all related tag columns on the same row, with top/bottom scrollbars and arrow keys to support scrolling."
    },
    related_statistics_enabled: {
        reset: true,
        validate: Utility.isBoolean,
        hint: "Show tag overlap statistics for related tag results (<b>Tags</b> column only)."
    },
    random_post_batches: {
        reset: 4,
        parse: parseInt,
        validate: (data) => Menu.validateNumber(data, true, 1, 10),
        hint: "Number of consecutive queries for random posts (1 - 10)."
    },
    random_posts_per_batch: {
        reset: 100,
        parse: parseInt,
        validate: (data) => Menu.validateNumber(data, true, 20, 200),
        hint: "Number of posts to query for each batch (20 - 200)."
    },
    wiki_page_tags_enabled: {
        reset: true,
        validate: Utility.isBoolean,
        hint: "Include wiki page tags when using one of the related tags buttons."
    },
    wiki_page_query_only_enabled: {
        reset: false,
        validate: Utility.isBoolean,
        hint: "Include a button to query only wiki page tags."
    },
    checklist_tags_enabled: {
        reset: false,
        validate: Utility.isBoolean,
        hint: "Include checklist tags when using one of the related tags buttons."
    },
    checklist_query_only_enabled: {
        reset: false,
        validate: Utility.isBoolean,
        hint: "Include a button to add only checklist tags."
    },
    query_unknown_tags_enabled: {
        reset: false,
        validate: Utility.isBoolean,
        hint: "Do an additional query if any wiki page tags are not found with the initial query."
    },
    other_wikis_enabled: {
        reset: true,
        validate: Utility.isBoolean,
        hint: "Include list_of_* wikis when including wiki page tags."
    },
    unique_wiki_tags_enabled: {
        reset: true,
        validate: Utility.isBoolean,
        hint: "Only show one instance of a tag by its first occurrence."
    },
    recheck_data_interval: {
        reset: 1,
        parse: parseInt,
        validate: (data) => Menu.validateNumber(data, true, 0, 3),
        hint: "Number of days (0 - 3). Setting to 0 disables this."
    },
    network_only_mode: {
        reset: false,
        validate: Utility.isBoolean,
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

//Pre-CSS/HTML constants

const DEPRECATED_TAG_CATEGORY = 200;
const NONEXISTENT_TAG_CATEGORY = 300;

//CSS Constants

const PROGRAM_CSS = Template.normalizeCSS()`
/**Container**/
div#edit-dialog div#irt-related-tags-container {
    max-height: 400px;
    overflow-y: auto;
}
div#irt-related-tags {
    overflow-x: hidden;
    flex-wrap: nowrap;
    max-width: calc(100% - 2em);
    display: inline-flex;
    & > div {
        display: inline-flex;
    }
    &.scrollable {
        overflow-x: scroll;
    }
}
/**Related tag columns**/
div.irt-tag-column {
    width: 18em;
    max-width: unset;
    margin-right: 1em;
    &.irt-is-empty-true {
        display: none;
    }
}
/**Related tag**/
div.irt-no-percentage {
    text-indent: -1.5em;
    margin-left: 1.5em;
}
div.irt-has-percentage {
    text-indent: -3.3em;
    margin-left: 3.3em;
}
span.irt-tag-statistic {
    filter: hue-rotate(-30deg);
    &.irt-high-percent {
        letter-spacing: -2px;
    }
}
div.irt-related-tag li {
    display: inline;
    &:before {
        content: "*";
        font-family: monospace;
        font-weight: bold;
        visibility: hidden;
        padding-right: 0.2em;
    }
    &.irt-selected {
        font-weight: bold;
        &:before {
            visibility: visible;
        }
    }
}
/**Related query controls**/
#irt-related-tag-query-controls {
    display: flex;
    flex-wrap: wrap;
}
/****Category****/
#irt-related-query-category {
    display: inline-flex;
    margin-bottom: 0.5em;
    margin-right: 1em;
    .irt-related-button {
        margin: 0 2px;
        &[disabled] {
            cursor: default;
        }
    }
}
/****Wiki****/
#irt-wiki-page-controls {
    display: inline-flex;
    margin-bottom: 0.5em;
    margin-right: 1em;
}
#irt-wiki-page-query {
    color: white;
    font-weight: bold;
    border: 1px solid;
    margin-right: 0.5em;
}
/****Checklist****/
#irt-checklist-controls {
    display: inline-flex;
    margin-bottom: 0.5em;
    margin-right: 1em;
}
#irt-checklist-query {
    color: white;
    font-weight: bold;
    border: 1px solid;
    margin-right: 0.5em;
}
/****Query type****/
#irt-related-query-type {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 0.5em;
    label {
        cursor: pointer;
        user-select: none;
        display: block;
        font-size: 14px;
        line-height: 1.5em;
        font-weight: bold;
        border: 1px solid;
        border-radius: 3px;
        padding: 2px 8px;
        text-align: center;
    }
    input {
        margin-left: 0.25em;
        vertical-align: middle;
        cursor: pointer;
    }
}
/**Expandable sections**/
#irt-edit-scroll-wrapper {
    height: 20px;
    overflow-x: scroll;
    overflow-y: hidden;
    display: none;
}
#irt-edit-scroll-bar {
    height: 20px;
}`;

const LIGHT_MODE_CSS = Template.normalizeCSS({theme: 'light'})`
/**Related tag**/
span.irt-tag-statistic {
    color: var(--red-3);
    &.irt-low-percent {
        color: var(--grey-3);
    }
}
.tag-type-${NONEXISTENT_TAG_CATEGORY} a.search-tag {
    &:link,
    &:visited {
        color: var(--yellow-3);
    }
    &:hover {
        color: var(--yellow-2);
    }
}
.tag-type-${DEPRECATED_TAG_CATEGORY} a.search-tag {
    &:link,
    &:visited {
        color: var(--grey-4);
    }
    &:hover {
        color: var(--grey-3);
    }
}
/**Related query controls**/
/****Wiki****/
#irt-wiki-page-query {
    background-color: var(--green-4);
    border-color: var(--green-5);
}
/****Checklist****/
#irt-checklist-query {
    background-color: var(--orange-3);
    border-color: var(--orange-4);
}
/****Query type****/
#irt-related-query-type label {
    color: var(--black);
    background-color: var(--grey-2);
    border-color: var(--grey-3);
}`;

const DARK_MODE_CSS = Template.normalizeCSS({theme: 'dark'})`
/**Related tag**/
span.irt-tag-statistic {
    color: var(--red-5);
    &.irt-tag-statistic.irt-low-percent {
        color: var(--grey-5);
    }
}
.tag-type-${NONEXISTENT_TAG_CATEGORY} a.search-tag {
    &:link,
    &:visited {
        color: var(--orange-5);
    }
    &:hover {
        color: var(--orange-4);
    }
}
.tag-type-${DEPRECATED_TAG_CATEGORY} a.search-tag {
    &:link,
    &:visited {
        color: var(--grey-5);
    }
    &:hover {
        color: var(--grey-4);
    }
}
/**Related query controls**/
/****Wiki****/
#irt-wiki-page-query {
    background-color: var(--green-5);
    border-color: var(--green-6);
}
/****Checklist****/
#irt-checklist-query {
    background-color: var(--orange-5);
    border-color: var(--orange-6);
}
/****Query type****/
#irt-related-query-type label {
    color: var(--white);
    background-color: var(--grey-6);
    border-color: var(--grey-7);
}`;

const MENU_CSS = `
.irt-selectors.jsplib-setting-item label {
    width: 150px;
}
.irt-sortlist li {
    width: 10em;
}
.irt-formula {
    font-family: mono;
}
#irt-checklist-frequent-tags textarea {
    width: 40em;
    height: 25em;
}`;

//HTML Constants

const RELATED_TAG_SETTINGS_DETAILS = Template.normalizeHTML()`
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

const NETWORK_SETTINGS_DETAILS = Template.normalizeHTML()`
<ul>
    <li><b>Recheck data interval:</b> Data expiring within this period gets automatically requeried.</li>
    <li><b>Network only mode:</b>
        <ul>
            <li>Can be used to correct cache data that has been changed on the server.</li>
            <li><span style="color:red;font-weight:bold">Warning!</span> <span style="font-style:italic">As this negates the benefits of using local cached data, it should only be used sparingly.</span></li>
        </ul>
    </li>
</ul>`;

const CACHE_DATA_DETAILS = Template.normalizeHTML()`
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

const PROGRAM_DATA_DETAILS = Template.normalizeHTML()`
<p class="tn">All timestamps are in milliseconds since the epoch (<a href="https://www.epochconverter.com">Epoch converter</a>).</p>
<ul>
    <li><u>General data</u>
        <ul>
            <li><b>prune-expires:</b> When the program will next check for cache data that has expired.</li>
            <li><b>user-settings:</b> All configurable settings.</li>
        </ul>
    </li>
</ul>`;

const CHECKLIST_TEXTAREA = Template.normalizeHTML()`
<div id="irt-checklist-frequent-tags">
    <textarea data-autocomplete="tag-query"></textarea>
</div>
`;

const IRT_SCROLL_WRAPPER = Template.normalizeHTML()`
<div id="irt-edit-scroll-wrapper">
    <div id="irt-edit-scroll-bar"></div>
</div>`;

const IRT_RELATED_TAGS_SECTION = Template.normalizeHTML()`
<div id="irt-related-tags-container">
    <div id="irt-related-tags">
        <div id="irt-frequent-recent-container"></div>
        <div id="irt-related-tags-query-container"></div>
        <div id="irt-translated-tags-container"></div>
    </div>
</div>`;

const WIKI_PAGE_BUTTON = Template.normalizeHTML()`
<div id="irt-wiki-page-controls">
    <button id="irt-wiki-page-query" class="irt-wiki-button" title="Query wiki pages only.">Wiki page</button>
</div>`;

const CHECKLIST_BUTTON = Template.normalizeHTML()`
<div id="irt-checklist-controls">
    <button id="irt-checklist-query" class="irt-checklist-button" title="Query checklist only.">Checklist</button>
</div>`;

//Time constants

const PRUNE_EXPIRES = Utility.one_day;

//Expiration variables

const TAGS_OVERLAP_EXPIRES = Utility.one_month;
const WIKI_PAGE_TAGS_EXPIRES = 2 * Utility.one_week;
const RELATED_TAG_EXPIRES = Utility.one_week;

//Validate constants

const RELATEDTAG_CONSTRAINTS = {
    entry: Validate.hashentry_constraints,
    value: {
        categories: Validate.array_constraints,
        query: Validate.stringonly_constraints,
        tags: Validate.tagentryarray_constraints(),
    },
    categories: Validate.inclusion_constraints(ALL_RELATED),
};

const TAG_OVERLAP_CONSTRAINTS = {
    entry: Validate.hashentry_constraints,
    value: {
        count: Validate.counting_constraints,
        overlap: Validate.hash_constraints,
    },
    overlap: Validate.basic_integer_validator,
};

const WIKI_PAGE_CONSTRAINTS = {
    entry: Validate.hashentry_constraints,
    value: {
        title: Validate.stringonly_constraints,
        tags: Validate.tagentryarray_constraints(Utility.concat(Danbooru.categories.values, [NONEXISTENT_TAG_CATEGORY])),
        other_wikis: Validate.array_constraints,
    },
    other_wikis: Validate.basic_stringonly_validator,
};

/****Functions****/

//Validate functions

function ValidateEntry(key, entry) {
    const printer = Debug.getFunctionPrint('ValidateEntry');
    if (!Validate.validateIsHash(key, entry)) {
        return false;
    }
    if (key.match(/^rt[fcjo](gen|char|copy|art)?-/)) {
        return ValidateRelatedtagEntry(key, entry);
    }
    if (key.match(/^tagov-/)) {
        return ValidateTagOverlapEntry(key, entry);
    }
    if (key.match(/^wpt-/)) {
        return ValidateWikiPageEntry(key, entry);
    }
    printer.log("Bad key!");
    return false;
}

function ValidateRelatedtagEntry(key, entry) {
    if (!Validate.validateHashEntries(key, entry, RELATEDTAG_CONSTRAINTS.entry)) {
        return false;
    }
    if (!Validate.validateHashEntries(key + '.value', entry.value, RELATEDTAG_CONSTRAINTS.value)) {
        return false;
    }
    return true;
}

function ValidateTagOverlapEntry(key, entry) {
    if (!Validate.validateHashEntries(key, entry, TAG_OVERLAP_CONSTRAINTS.entry)) {
        return false;
    }
    if (!Validate.validateHashEntries(key + '.value', entry.value, TAG_OVERLAP_CONSTRAINTS.value)) {
        return false;
    }
    if (!Validate.validateHashValues(key + '.value.overlap', entry.value.overlap, TAG_OVERLAP_CONSTRAINTS.overlap)) {
        return false;
    }
    return true;
}

function ValidateWikiPageEntry(key, entry) {
    if (!Validate.validateHashEntries(key, entry, WIKI_PAGE_CONSTRAINTS.entry)) {
        return false;
    }
    if (!Validate.validateHashEntries(key + '.value', entry.value, WIKI_PAGE_CONSTRAINTS.value)) {
        return false;
    }
    if (!Validate.validateArrayValues(key + '.other_wikis', entry.value.other_wikis, WIKI_PAGE_CONSTRAINTS.other_wikis)) {
        return false;
    }
    return true;
}

function ValidateProgramData(key, entry) {
    var checkerror = [];
    switch (key) {
        case 'irt-user-settings':
            checkerror = Menu.validateUserSettings(entry, SETTINGS_CONFIG);
            break;
        case 'irt-prune-expires':
            if (!Utility.isInteger(entry)) {
                checkerror = ["Value is not an integer."];
            }
            break;
        default:
            checkerror = ["Not a valid program data key."];
    }
    if (checkerror.length) {
        Validate.outputValidateError(key, checkerror);
        return false;
    }
    return true;
}

//Auxiliary functions

function GetQueryOrder() {
    if(IRT.related_query_order_enabled){
        return $('.irt-program-checkbox').filter((_, input) => input.checked).data('selector');
    }
    return IRT.related_query_order_default[0];
}

function GetRelatedKeyModifer(category, query_order) {
    return 'rt' + query_order[0] + (category ? Danbooru.categories.short[category] : "");
}

function FilterTagEntries(tagentries) {
    if (!IRT.unique_wiki_tags_enabled) return tagentries;
    let tags_seen = new Set();
    return tagentries.filter((entry) => {
        if (tags_seen.has(entry[0])) return false;
        tags_seen.add(entry[0]);
        return true;
    });
}

function GetTagsEntryArray(wiki_page) {
    let wiki_link_targets = Utility.findAll(wiki_page.body, /\[\[([^|\]]+)\|?[^\]]*\]\]/g)
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
}

function GetChecklistTagsArray(tag_name) {
    let tag_array = Storage.getLocalData('irt-checklist-' + tag_name, {default_val: []});
    let check = ValidateJS({tag_array}, {tag_array: Validate.tagentryarray_constraints([0, 1, 3, 4, 5, DEPRECATED_TAG_CATEGORY, NONEXISTENT_TAG_CATEGORY])});
    if (check) {
        console.warn(`Validation error[${tag_name}]:`, check, tag_array);
        return null;
    }
    return tag_array;
}

function CreateTagArray(tag_list, tag_data) {
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
}

function GetTagQueryParams(tag_list) {
    return {
        search: {
            name_comma: tag_list.join(',')
        },
        only: 'name,category,is_deprecated',
        limit: tag_list.length
    };
}

function SetupMutationReplaceObserver(remove_class, func) {
    const printer = Debug.getFunctionPrint('SetupMutationReplaceObserver');
    let [key, name] = _getSelectorChecks(remove_selector);
    new MutationObserver((mutations, observer) => {
        for (let i = 0; i < mutations.length; i++) {
            let mutation = mutations[i];
            printer.logLevel("Checking mutation:", mutation.type, mutation.removedNodes, Debug.VERBOSE);
            if (mutation.type === "childList" && mutation.removedNodes.length === 1) {
                let node = mutation.removedNodes[0];
                printer.logLevel(`Checking removed node: .${remove_class} "${node.className}"`, Debug.DEBUG);
                if (node.classList.contains(remove_class)) {
                    printer.logLevel(`Validated remove: ${remove_selector} has been modified!`, Debug.INFO);
                    func(mutation);
                }
            }
        }
    }).observe(document.querySelector('#related-tags-container'), {
        childList: true,
    });
};

//Render functions

function RenderTaglist(taglist, columnname, tags_overlap) {
    let html = "";
    let display_percentage = Boolean(IRT.related_statistics_enabled && Utility.isHash(tags_overlap));
    taglist.forEach((tagdata) => {
        let tag = tagdata[0];
        let escaped_tag = Utility.HTMLEscape(tag);
        let category = tagdata[1];
        let display_name = tag.replace(/_/g, ' ');
        let search_link = Danbooru.postSearchLink(display_name, {tags: tag}, {class: 'search-tag', dataCategory: category, dataTagName: escaped_tag});
        var prefix, classname;
        if (display_percentage) {
            var percentage_string, percent_classname;
            if (Utility.isInteger(tags_overlap.overlap[tag])) {
                let tag_percentage = Math.ceil(100 * (tags_overlap.overlap[tag] / tags_overlap.count)) || 0;
                percentage_string = Utility.padNumber(tag_percentage, 2) + '%';
                percent_classname = (tag_percentage >= 100 ? 'irt-high-percent' : "");
            } else {
                percentage_string = ">5%";
                percent_classname = 'irt-low-percent';
            }
            prefix = `<span class="irt-tag-statistic ${percent_classname}">${percentage_string}</span> `;
            classname = 'irt-has-percentage';
        } else {
            prefix = "";
            classname = 'irt-no-percentage';
        }
        var title;
        if (category === DEPRECATED_TAG_CATEGORY) {
            title = 'deprecated';
        } else if (category === NONEXISTENT_TAG_CATEGORY) {
            title = 'nonexistent';
        } else {
            title = "";
        }
        html += `
            <div class="irt-related-tag ${classname}" title="${title}">
                ${prefix}
                <li class="tag-type-${category}">${search_link}</li>
            </div>`;
    });
    return `
<h6>${columnname}</h6>
<div>
${html}
</div>`;
}

function RenderTagColumn(classname, column_html, is_empty) {
    return `
<div class="irt-tag-column ${classname} irt-is-empty-${is_empty}">
${column_html}
</div>`;
}

function RenderTagQueryColumn(related_tags, tags_overlap) {
    let is_empty = related_tags.tags.length === 0;
    let display_name = related_tags.query.replace(/_/g, ' ');
    let column_html = (!is_empty ? RenderTaglist(related_tags.tags, display_name, tags_overlap) : "");
    return RenderTagColumn('irt-general-related-tags-column', column_html, is_empty);
}

function RenderChecklistColumn(checklist_tags, tag_name) {
    let is_empty = checklist_tags.length === 0;
    let display_name = "Checklist: " + tag_name.replace(/_/g, ' ');
    let column_html = (!is_empty ? RenderTaglist(checklist_tags, display_name) : "");
    return RenderTagColumn('irt-checklist-related-tags-column', column_html, is_empty);
}

function RenderWikiTagQueryColumns(wiki_page, other_wikis) {
    let is_empty = wiki_page.tags.length === 0;
    let display_name = wiki_page.title.replace(/_/g, ' ');
    let column_html = (!is_empty ? RenderTaglist(FilterTagEntries(wiki_page.tags), Danbooru.wikiLink(`wiki:${display_name}`, wiki_page.title, {target: "_blank"})) : "");
    let html = RenderTagColumn('irt-wiki-related-tags-column', column_html, is_empty);
    other_wikis.forEach((other_wiki) => {
        if (other_wiki.tags.length === 0) return;
        let title_name = other_wiki.title.replace(/_/g, ' ');
        column_html = RenderTaglist(FilterTagEntries(other_wiki.tags), Danbooru.wikiLink(`wiki:${title_name}`, other_wiki.title, {target: "_blank"}));
        html += RenderTagColumn('irt-wiki-related-tags-column', column_html, false);
    });
    return html;
}

function RenderUserQueryColumns(recent_tags, frequent_tags, ai_tags) {
    let is_empty = recent_tags.length === 0;
    let column_html = (is_empty ? "" : RenderTaglist(recent_tags, 'Recent'));
    let html = RenderTagColumn('irt-recent-related-tags-column', column_html, is_empty);
    is_empty = frequent_tags.length === 0;
    column_html = (!is_empty ? RenderTaglist(frequent_tags, 'Frequent') : "");
    html += RenderTagColumn('irt-frequent-related-tags-column', column_html, is_empty);
    is_empty = ai_tags.length === 0;
    column_html = (!is_empty ? RenderTaglist(ai_tags, 'Suggested') : "");
    html += RenderTagColumn('irt-ai-tags-related-tags-column', column_html, is_empty);
    return html;
}

function RenderTranslatedColumn(translated_tags) {
    let is_empty = translated_tags.length === 0;
    let column_html = (!is_empty ? RenderTaglist(translated_tags, 'Translated') : "");
    return RenderTagColumn('irt-translated-tags-related-tags-column', column_html, is_empty);
}

function RenderRelatedQueryCategoryControls() {
    let html = '<button id="related_query_category_all" class="irt-related-button">All</button>';
    for (let category in Danbooru.categories.name) {
        if (!IRT.related_query_categories.includes(category)) continue;
        let display_name = Utility.displayCase(category);
        html += `
<button id="related_query_category_${category}" class="irt-related-button" data-selector="${category}">${display_name}</button>`;
    }
    return `
<div id="irt-related-query-category">
    ${html}
</div>`;
}

function RenderRelatedQueryTypeControls() {
    let html = "";
    RELATED_QUERY_ORDERS.forEach((type) => {
        let checked = (IRT.related_query_order_default[0] === type ? 'checked' : "");
        let display_name = Utility.displayCase(type);
        html += `
<label for="related_query_type_${type}">
    ${display_name}
    <input id="related_query_type_${type}" class="irt-program-checkbox" type="radio" name="related_query_type" data-selector="${type}" ${checked}>
</label>`;

    });
    return `
<div id="irt-related-query-type">
    ${html}
</div>`;
}

//Network functions

async function RandomPosts(tag, batches, per_batch) {
    let posts = [];
    let url_addons = {
        tags: tag + ' order:md5', // Gives us quasi-random results
        only: 'id,md5,tag_string',
        limit: per_batch,
    };
    for (let i = 1; i <= batches; i++) {
        url_addons.page = i;
        let result = await Danbooru.query('posts', url_addons);
        posts = Utility.concat(posts, result);
        if (result.length < per_batch) break;
    }
    return posts;
}

async function TagsOverlapQuery(tag) {
    const printer = Debug.getFunctionPrint('TagsOverlapQuery');
    const [batches, per_batch] = [IRT.random_post_batches, IRT.random_posts_per_batch];
    printer.log("Querying:", tag, batches, per_batch);
    let [posts, count] = await Promise.all([
        RandomPosts(tag, batches, per_batch),
        Danbooru.query('counts/posts', {tags: tag}, {default_val: {counts: {posts: 0}}})
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
    return {value: {overlap, count: Math.min(count.counts.posts, batches * per_batch)}, expires: Utility.getExpires(TAGS_OVERLAP_EXPIRES)};
}

async function WikiPageTagsQuery(title) {
    const printer = Debug.getFunctionPrint('WikiPageTagsQuery');
    printer.log("Querying:", title, (IRT.other_wikis_enabled ? "with" : "without", "other wikis"));
    let url_addons = {
        search: {title},
        only: 'body,tag,dtext_links[link_target,link_type,linked_tag[name,category,is_deprecated]]'
    };
    let wikis_with_links = await Danbooru.query('wiki_pages', url_addons);
    let tags = (wikis_with_links.length ? GetTagsEntryArray(wikis_with_links[0]) : []);
    if (IRT.query_unknown_tags_enabled) {
        let tag_names = tags.filter((tag) => tag[1] === NONEXISTENT_TAG_CATEGORY).map((tag) => tag[0]);
        if (tag_names.length) {
            let tag_data = await Danbooru.query('tags', GetTagQueryParams(tag_names));
            let tag_array = CreateTagArray(tag_names, tag_data);
            tags = tags.map((tag_entry) => (tag_array.find((item) => item[0] === tag_entry[0]) ?? tag_entry));
        }
    }
    let other_wikis = (!title.startsWith('list_of_') ?
        (wikis_with_links?.[0]?.dtext_links || [])
            .filter((link) => (link.link_type === 'wiki_link' && link.link_target.startsWith('list_of_')))
            .map((link) => link.link_target) :
        []);
    return {value: {title, tags, other_wikis}, expires: Utility.getExpires(WIKI_PAGE_TAGS_EXPIRES)};
}

async function RelatedTagsQuery(tag, category, query_order) {
    const printer = Debug.getFunctionPrint('RelatedTagsQuery');
    printer.log("Querying:", tag, category);
    let url_addons = {search: {query: tag, order: query_order}, limit: IRT.related_results_limit || DanbooruProxy.RelatedTag.MAX_RELATED_TAGS};
    if (category in Danbooru.categories.name) {
        url_addons.search.category = Danbooru.categories.name[category];
    }
    let html = await Network.get('/related_tag.html', {data: url_addons});
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
        categories: (category ? [Danbooru.categories.name[category]] : []),
        tags: tagentry_array,
    };
    return {value: data, expires: Utility.getExpires(RELATED_TAG_EXPIRES)};
}

//Network/storage wrappers

async function GetCachedData({name = "", args = [], keyfunc = (() => {}), netfunc = (() => {}), expires = null} = {}) {
    const printer = Debug.getFunctionPrint('GetCachedData');
    let key = keyfunc(...args);
    printer.log("Checking", name, ':', key);
    let cached = await (!IRT.network_only_mode ?
        Storage.checkLocalDB(key, expires) :
        Promise.resolve(null));
    if (!cached) {
        cached = await netfunc(...args);
        Storage.saveData(key, cached);
    } else if (IRT.recheck_data_interval > 0) {
        let recheck_time = cached.expires - (IRT.recheck_data_interval * Utility.one_day);
        if (!Utility.validateExpires(recheck_time)) {
            printer.log("Rechecking", name, key);
            netfunc(...args).then((data) => {
                Storage.saveData(key, data);
            });
        }
    }
    printer.log("Found", name, ':', key, cached.value);
    return cached.value;
}

function GetRelatedTags(tag, category, query_order) {
    return GetCachedData({
        name: 'related tags',
        args: [tag, category, query_order],
        keyfunc: (tag, category, query_order) => (GetRelatedKeyModifer(category, query_order) + '-' + tag),
        netfunc: RelatedTagsQuery,
        expires: RELATED_TAG_EXPIRES,
    });
}

function GetTagsOverlap(tag) {
    return GetCachedData({
        name: 'tags overlap',
        args: [tag],
        keyfunc: (tag) => ('tagov-' + tag),
        netfunc: TagsOverlapQuery,
        expires: TAGS_OVERLAP_EXPIRES,
    });
}

function GetWikiPageTags(tag) {
    return GetCachedData({
        name: 'wiki page tags',
        args: [tag],
        keyfunc: (tag) => ('wpt-' + tag),
        netfunc: WikiPageTagsQuery,
        expires: WIKI_PAGE_TAGS_EXPIRES,
    });
}

async function GetAllWikiPageTags(tag) {
    let wiki_page = await GetWikiPageTags(tag);
    var other_wikis;
    if (IRT.other_wikis_enabled) {
        let promise_array = [];
        wiki_page.other_wikis.forEach((title) => {
            promise_array.push(GetWikiPageTags(title));
        });
        other_wikis = await Promise.all(promise_array);
    } else {
        other_wikis = [];
    }
    return {wiki_page, other_wikis};
}

//Event handlers

async function RelatedTagsButton(event) {
    event.preventDefault();
    let currenttag = DanbooruProxy.RelatedTag.current_tag().trim().toLowerCase();
    let category = $(event.target).data('selector');
    let query_order = GetQueryOrder();
    let promise_array = [GetRelatedTags(currenttag, category, query_order)];
    if (IRT.related_statistics_enabled) {
        promise_array.push(GetTagsOverlap(currenttag));
    } else {
        promise_array.push(Promise.resolve(null));
    }
    if (IRT.wiki_page_tags_enabled) {
        promise_array.push(GetAllWikiPageTags(currenttag));
    } else {
        promise_array.push(Promise.resolve(null));
    }
    let [related_tags, tags_overlap, wiki_result] = await Promise.all(promise_array);
    if (!related_tags) {
        return;
    }
    var tag_array;
    if (IRT.checklist_tags_enabled) {
        tag_array = GetChecklistTagsArray(currenttag) ?? [];
    }
    $('#irt-related-tags-query-container').html(
        RenderTagQueryColumn(related_tags, tags_overlap) +
        (IRT.checklist_tags_enabled ? RenderChecklistColumn(tag_array, currenttag) : "") +
        (IRT.wiki_page_tags_enabled ? RenderWikiTagQueryColumns(wiki_result.wiki_page, wiki_result.other_wikis) : "")
    );
    UpdateSelected();
    QueueRelatedTagColumnWidths();
}

async function WikiPageButton(event) {
    event.preventDefault();
    let currenttag = DanbooruProxy.RelatedTag.current_tag().trim().toLowerCase();
    let wiki_result = await GetAllWikiPageTags(currenttag);
    $('#irt-related-tags-query-container').html(RenderWikiTagQueryColumns(wiki_result.wiki_page, wiki_result.other_wikis));
    UpdateSelected();
    QueueRelatedTagColumnWidths();
}

function ChecklistButton(event) {
    event.preventDefault();
    let currenttag = DanbooruProxy.RelatedTag.current_tag().trim().toLowerCase();
    let tag_array = GetChecklistTagsArray(currenttag);
    if (tag_array === null) {
        Notice.error("Corrupted data: See debug console for details.");
    } else {
        $('#irt-related-tags-query-container').html(RenderChecklistColumn(tag_array, currenttag));
        UpdateSelected();
        QueueRelatedTagColumnWidths();
    }
}

function RelatedTagsEnter() {
    $(document).on(JSPLib.event.keydown + '.scroll', null, 'left right', RelatedTagsScroll);
}

function RelatedTagsLeave() {
    $(document).off(JSPLib.event.keydown + '.scroll');
}

function RelatedTagsScroll(event) {
    let $related_tags = $('#irt-related-tags');
    let current_left = $related_tags.prop('scrollLeft');
    if (event.originalEvent.key === 'ArrowLeft') {
        current_left -= 40;
    } else if (event.originalEvent.key === 'ArrowRight') {
        current_left += 40;
    }
    $related_tags.prop('scrollLeft', current_left);
}

function ViewChecklistTag() {
    let import_export = $('#irt-enable-import-export').prop('checked');
    if (import_export) {
        let tag_list =
            Object.keys(localStorage)
                .filter((name) => name.startsWith('irt-checklist-'))
                .map((name) => name.replace('irt-checklist-', ""));
        let tag_data = tag_list.map((tag_name) => {
            let tag_array = GetChecklistTagsArray(tag_name);
            if (Utility.isArray(tag_array)) {
                return {[tag_name]: tag_array.map((item) => item[0])};
            }
            return null;
        }).filter((data) => data != null);
        $('#irt-checklist-frequent-tags textarea').val(JSON.stringify(Utility.assignObjects(...tag_data), null, 4));
    } else {
        let tag_name = $('#irt-control-tag-name').val().split(/\s+/)[0];
        if (!tag_name) return;
        let tag_array = GetChecklistTagsArray(tag_name);
        if (tag_array === null) {
            Notice.error("Corrupted data: See debug console for details.");
        } else {
            let tag_list = tag_array.map((entry) => entry[0]);
            $('#irt-checklist-frequent-tags textarea').val(tag_list.join('\n'));
        }
    }
}

async function SaveChecklistTag() {
    let import_export = $('#irt-enable-import-export').prop('checked');
    if (import_export) {
        let text_input = $('#irt-checklist-frequent-tags textarea').val();
        var data_input;
        try {
            data_input = JSON.parse(text_input);
        } catch (e) {
            data_input = null;
            Debug.error("Error parsing data:", e);
        }
        if (Utility.isHash(data_input)) {
            let checklist_data = {};
            let check_tags = [];
            for (let key in data_input) {
                let checklist = data_input[key];
                if (!Utility.isArray(checklist)) continue;
                checklist = checklist.filter((item) => typeof item === "string");
                if (checklist.length === 0) continue;
                checklist_data[key] = checklist;
                check_tags = Utility.arrayUnion(check_tags, checklist);
            }
            if (check_tags.length > 0) {
                Notice.notice("Querying tags...");
                let tag_data = [];
                for (let i = 0; i < check_tags.length; i += 1000) {
                    let query_tags = check_tags.slice(i, i + 1000);
                    let tags = await Danbooru.query('tags', GetTagQueryParams(query_tags), {long_format: true});
                    tag_data = Utility.concat(tag_data, tags);
                }
                for (let tag_name in checklist_data) {
                    let checklist = checklist_data[tag_name];
                    let tag_array = CreateTagArray(checklist, tag_data);
                    Storage.setLocalData('irt-checklist-' + tag_name, tag_array);
                }
                Notice.notice("Checklists imported.");
            } else {
                Notice.error("No valid checklists found.");
            }
        } else {
            Notice.error("Error importing checklist.");
        }
    } else {
        let tag_name = $('#irt-control-tag-name').val().split(/\s+/)[0];
        if (!tag_name) return;
        let checklist = $('#irt-checklist-frequent-tags textarea').val().split(/\s/).filter((name) => (name !== ""));
        if (checklist.length > 0) {
            let tag_data = await Danbooru.query('tags', GetTagQueryParams(checklist));
            let tag_array = CreateTagArray(checklist, tag_data);
            Storage.setLocalData('irt-checklist-' + tag_name, tag_array);
        } else {
            Storage.removeLocalData('irt-checklist-' + tag_name);
        }
        Notice.notice("Checklist updated.");
    }
}

function PopulateChecklistTag() {
    let tag_name = $('#irt-control-tag-name').val().split(/\s+/)[0];
    if (!tag_name) return;
    Notice.notice("Querying Danbooru...");
    WikiPageTagsQuery(tag_name).then((data) => {
        let tag_list = data.value.tags.map((entry) => entry[0]);
        $('#irt-checklist-frequent-tags textarea').val(tag_list.join('\n'));
    });
}

function ListChecklistTags() {
    let tag_list =
        Object.keys(localStorage)
            .filter((name) => name.startsWith('irt-checklist-'))
            .map((name) => name.replace('irt-checklist-', ""))
            .sort();
    $('#irt-checklist-frequent-tags textarea').val(tag_list.join('\n'));
}

//Initialization functions

function InitializeUserMediaTags() {
    const printer = Debug.getFunctionPrint('InitializeUserMediaTags');
    let recent_tags = $('.recent-related-tags-column [data-tag-name]').map((_, entry) => [[entry.dataset.tagName, Number(entry.className.match(/tag-type-(\d)/)?.[1])]]).toArray();
    let frequent_tags = $('.frequent-related-tags-column [data-tag-name]').map((_, entry) => [[entry.dataset.tagName, Number(entry.className.match(/tag-type-(\d)/)?.[1])]]).toArray();
    let ai_tags = $('.ai-tags-related-tags-column [data-tag-name]').map((_, entry) => [[entry.dataset.tagName, Number(entry.className.match(/tag-type-(\d)/)?.[1])]]).toArray();
    printer.log("Media tags:", {recent_tags, frequent_tags, ai_tags});
    $('#irt-frequent-recent-container').html(RenderUserQueryColumns(recent_tags, frequent_tags, ai_tags));
    UpdateSelected();
    QueueRelatedTagColumnWidths();
}

function InitializeTranslatedTags() {
    const printer = Debug.getFunctionPrint('InitializeTranslatedTags');
    let translated_tags = $('.translated-tags-related-tags-column [data-tag-name]').map((_, entry) => [[entry.dataset.tagName, Number(entry.className.match(/tag-type-(\d)/)?.[1])]]).toArray();
    printer.log("Translated tags:", translated_tags);
    $('#irt-translated-tags-container').html(RenderTranslatedColumn(translated_tags));
    UpdateSelected();
    QueueRelatedTagColumnWidths();
}

function UpdateSelected() {
    const current_tags = DanbooruProxy.RelatedTag.current_tags();
    $('#irt-related-tags li').each((_, li) => {
        const tag_name = $(li).find('a').attr('data-tag-name');
        if (current_tags.includes(tag_name)) {
            $(li).addClass('irt-selected');
            $(li).find('input').prop('checked', true);
        } else {
            $(li).removeClass('irt-selected');
            $(li).find('input').prop('checked', false);
        }
    });
}

function ToggleTag(event) {
    let $field = $('#post_tag_string');
    let $link = $(event.target).closest('li').find('a');
    let category = $link.data('category');
    let tag = $link.data('tag-name');
    if (category === DEPRECATED_TAG_CATEGORY) {
        Notice.error(`Tag "${tag}" is deprecated.`);
        event.preventDefault();
        return;
    }
    if (category === NONEXISTENT_TAG_CATEGORY && !DanbooruProxy.RelatedTag.current_tags().includes(tag) && !confirm(`Tag "${tag}" does not exist. Continue?`)) {
        event.preventDefault();
        return;
    }
    let old_value = $field.val();
    if (DanbooruProxy.RelatedTag.current_tags().includes(tag)) {
        let escaped_tag = RegExp.escape(tag);
        let regex = new RegExp('(^|\\s)' + escaped_tag + '($|\\s)', 'gi');
        let updated_value = old_value.replace(regex, '$1$2');
        $field.val(updated_value);
    } else {
        $field.val(old_value + ' ' + tag);
    }
    let normalized_value = $field.val().trim().replace(/ +/g, ' ');
    $field.val(normalized_value + ' ');
    UpdateSelected();
    // The timeout is needed on Chrome since it will clobber the field attribute otherwise
    setTimeout(() => {
        $field.prop('selectionStart', $field.val().length);
    }, 100);
    event.preventDefault();
    // Artificially trigger input event so the tag counter updates.
    $field.trigger('input');
}

//Initialize functions

function InitializeRelatedTagsSection() {
    DanbooruProxy.Post.EDIT_DIALOG_MIN_HEIGHT = 800;
    $(document).on(JSPLib.event.click, '#irt-related-tags a.search-tag', ToggleTag);
    $(document).on(JSPLib.event.click, '.irt-related-button', RelatedTagsButton);
    $(document).on(JSPLib.event.click, '.irt-wiki-button', WikiPageButton);
    $(document).on(JSPLib.event.click, '.irt-checklist-button', ChecklistButton);
    $(document).on('input.irt', '#post_tag_string', UpdateSelected);
    InitialiazeRelatedQueryControls();
    $('.related-tags').before(IRT_RELATED_TAGS_SECTION);
    $('#related-tags-container').hide();
    InitializeTagColumns();
    if (IRT.expandable_related_section_enabled) {
        InitialiazeRelatedExpandableSection();
    }
}

function InitializeTagColumns() {
    const printer = Debug.getFunctionPrint('InitializeTagColumns');
    if (IRT.controller === 'posts') {
        let media_asset_id = $("#related-tags-container").attr("data-media-asset-id");
        Network.get("/related_tag.js", {data: {user_tags: true, media_asset_id}});
    }
    if (!$('#related-tags-container .ai-tags-related-tags-column').html()?.trim()) {
        printer.log("User/Media tags not loaded yet... setting up mutation observer.");
        SetupMutationReplaceObserver('.ai-tags-related-tags-column', () => {
            InitializeUserMediaTags();
        });
    } else {
        InitializeUserMediaTags();
    }
    if (!$('#related-tags-container .translated-tags-related-tags-column').html()?.trim()) {
        printer.log("Translated tags not loaded yet... setting up mutation observer.");
        SetupMutationReplaceObserver('.translated-tags-related-tags-column', () => {
            InitializeTranslatedTags();
        });
    } else {
        InitializeTranslatedTags();
    }
}

function InitialiazeRelatedQueryControls() {
    $('#post_tag_string, #upload_tag_string').parent().after('<div id="irt-related-tag-query-controls"></div>');
    $('#irt-related-tag-query-controls').append(RenderRelatedQueryCategoryControls());
    if (IRT.wiki_page_query_only_enabled) {
        $('#irt-related-tag-query-controls').append(WIKI_PAGE_BUTTON);
    }
    if (IRT.checklist_query_only_enabled) {
        $('#irt-related-tag-query-controls').append(CHECKLIST_BUTTON);
    }
    if (IRT.related_query_order_enabled) {
        $('#irt-related-tag-query-controls').append(RenderRelatedQueryTypeControls());
        $('#irt-related-query-type .ui-state-hover').removeClass('ui-state-hover');
    }
    $('#post_tag_string').css('max-width', '80rem');
    $('#post_tag_string').closest('.fixed-width-container').css('max-width', '80rem');
}

function InitialiazeRelatedExpandableSection() {
    $('#irt-related-tags').before(IRT_SCROLL_WRAPPER);
    $('#irt-related-tags').on(JSPLib.event.mouseenter, RelatedTagsEnter);
    $('#irt-related-tags').on(JSPLib.event.mouseleave, RelatedTagsLeave);
    $('#irt-edit-scroll-wrapper').on(JSPLib.event.scroll, () => {
        $('#irt-related-tags').scrollLeft($('#irt-edit-scroll-wrapper').scrollLeft());
    });
    $('#irt-related-tags').on(JSPLib.event.scroll, () => {
        $('#irt-edit-scroll-wrapper').scrollLeft($('#irt-related-tags').scrollLeft());
    });
    let $container = $('#irt-related-tags-container');
    new ResizeObserver(() => {
        QueueRelatedTagColumnWidths();
    }).observe($container[0]);
}

function InitializeRelatedTagColumnWidths() {
    const em_size = 14;
    const max_column_em = 20;
    const min_column_em = 10;
    const range = document.createRange();
    const getChildWidth = (_, child) => {
        if (child.nodeType === 3) {
            range.selectNodeContents(child);
            const rects = range.getClientRects();
            return (rects.length > 0 ? rects[0].width : 0);
        }
        return $(child).outerWidth();
    };
    const getSum = (a, b) => (a + b);
    let $related_tags = $('#irt-related-tags');
    $('.irt-tag-column', $related_tags[0]).each((_, column) => {
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
        let max_child_width = Math.max(...$(line_selector, column).map((_, entry) => {
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
}

function QueueRelatedTagColumnWidths() {
    if (Utility.isInteger(QueueRelatedTagColumnWidths.timer)) {
        clearTimeout(QueueRelatedTagColumnWidths.timer);
    }
    QueueRelatedTagColumnWidths.timer = setTimeout(() => {
        InitializeRelatedTagColumnWidths();
        QueueRelatedTagColumnWidths.timer = null;
    }, 100);
}

//Main execution functions

function SetupInitializations() {
    const printer = Debug.getFunctionPrint('SetupInitializations');
    Utility.recheckInterval({
        check: () => (($('#related-tags-container .ai-tags-related-tags-column .tag-list').html() || "").trim() !== ""),
        success: () => {
            printer.log("Related tags found... initializing.");
            InitializeRelatedTagsSection();
        },
        fail: () => {
            printer.log("Related tags not found... setting up event listener.");
            $(document)
                .on('danbooru:open-post-edit-tab.irt danbooru:open-post-edit-dialog.irt', () => {
                    printer.log("Event listener triggered... initializing.");
                    InitializeRelatedTagsSection();
                    $(document).off('danbooru:open-post-edit-tab.irt danbooru:open-post-edit-dialog.irt');
                });
        },
        interval: 250,
        duration: Utility.one_second * 10,
    });
    $(document).on('danbooru:close-post-edit-dialog.irt', QueueRelatedTagColumnWidths);
}

function CleanupTasks() {
    Storage.pruneProgramCache(PROGRAM_SHORTCUT, PROGRAM_DATA_REGEX, PRUNE_EXPIRES);
}

//Menu functions

function OptionCacheDataKey(data_type, data_value) {
    if (data_type === 'related_tag') {
        IRT.tag_category = $('#irt-control-tag-category').val();
        IRT.query_order = $('#irt-control-query-order').val();
        let modifier = GetRelatedKeyModifer(IRT.related_category, IRT.query_order);
        return `${modifier}-${data_value}`;
    }
    if (data_type === 'wiki_page') {
        return `wpt-${data_value}`;
    }
    if (data_type === 'tag_overlap') {
        return `tagov-${data_value}`;
    }
}

function DataTypeChange() {
    let data_type = $('#irt-control-data-type').val();
    let action = (data_type === 'related_tag' ? 'show' : 'hide');
    $('.irt-options[data-setting=tag_category]')[action]();
    $('.irt-options[data-setting=query_order]')[action]();
}

function InitializeMenuAutocomplete() {
    const printer = Debug.getFunctionPrint('InitializeMenuAutocomplete');
    Load.setProgramGetter(IRT, 'IAC', 'IndexedAutocomplete', 29.25);
    Load.scriptWaitExecute(IRT, 'IAC', {
        available: () => {
            $('#irt-control-tag-name, #irt-checklist-frequent-tags').data('tag-query');
            IRT.IAC.InitializeTagQueryAutocompleteIndexed('#irt-control-tag-name, #irt-checklist-frequent-tags textarea', null);
            printer.logLevel('Initialized IAC autocomplete on menu inputs.', Debug.DEBUG);
        },
        fallback: () => {
            Danbooru.initializeAutocomplete('#irt-control-tag-name, #irt-checklist-frequent-tags textarea', 'tag-query');
            printer.logLevel('Initialized Danbooru autocomplete on menu inputs.', Debug.DEBUG);
        },
    });
}

function InitializeProgramValues() {
    Load.setProgramGetter(IRT, 'IAC', 'IndexedAutocomplete', 29.25);
    return true;
}

function RenderSettingsMenu() {
    $('#indexed-related-tags').append(Menu.renderMenuFramework(MENU_CONFIG));
    $('#irt-general-settings').append(Menu.renderDomainSelectors());
    $('#irt-related-tag-settings-message').append(Menu.renderExpandable("Additional setting details", RELATED_TAG_SETTINGS_DETAILS));
    $('#irt-related-tag-settings').append(Menu.renderInputSelectors('related_query_categories', 'checkbox'));
    $('#irt-related-tag-settings').append(Menu.renderCheckbox('related_query_order_enabled'));
    $('#irt-related-tag-settings').append(Menu.renderInputSelectors('related_query_order_default', 'radio'));
    $('#irt-related-tag-settings').append(Menu.renderTextinput('related_results_limit', 5));
    $('#irt-related-tag-settings').append(Menu.renderCheckbox('expandable_related_section_enabled'));
    $('#irt-tag-statistic-settings').append(Menu.renderCheckbox('related_statistics_enabled'));
    $('#irt-tag-statistic-settings').append(Menu.renderTextinput('random_post_batches', 5));
    $('#irt-tag-statistic-settings').append(Menu.renderTextinput('random_posts_per_batch', 5));
    $('#irt-checklist-settings').append(Menu.renderCheckbox('checklist_tags_enabled'));
    $('#irt-checklist-settings').append(Menu.renderCheckbox('checklist_query_only_enabled'));
    $('#irt-wiki-page-settings').append(Menu.renderCheckbox('wiki_page_tags_enabled'));
    $('#irt-wiki-page-settings').append(Menu.renderCheckbox('other_wikis_enabled'));
    $('#irt-wiki-page-settings').append(Menu.renderCheckbox('unique_wiki_tags_enabled'));
    $('#irt-wiki-page-settings').append(Menu.renderCheckbox('wiki_page_query_only_enabled'));
    $('#irt-wiki-page-settings').append(Menu.renderCheckbox('query_unknown_tags_enabled'));
    $('#irt-network-settings-message').append(Menu.renderExpandable("Additional setting details", NETWORK_SETTINGS_DETAILS));
    $('#irt-network-settings').append(Menu.renderTextinput('recheck_data_interval', 5));
    $('#irt-network-settings').append(Menu.renderCheckbox('network_only_mode'));
    $('#irt-checklist-controls').append(Menu.renderCheckbox('import_export', true));
    $('#irt-checklist-controls').append(Menu.renderTextinput('tag_name', 50, true));
    $('#irt-checklist-controls').append(CHECKLIST_TEXTAREA);
    $('#irt-controls').append(Menu.renderCacheControls());
    $('#irt-cache-controls-message').append(Menu.renderExpandable("Cache Data details", CACHE_DATA_DETAILS));
    $('#irt-cache-controls').append(Menu.renderLinkclick('cache_info', true));
    $('#irt-cache-controls').append(Menu.renderCacheInfoTable());
    $('#irt-cache-controls').append(Menu.renderLinkclick('purge_cache', true));
    $('#irt-controls').append(Menu.renderCacheEditor(true));
    $('#irt-cache-editor-message').append(Menu.renderExpandable("Program Data details", PROGRAM_DATA_DETAILS));
    $('#irt-cache-editor-controls').append(Menu.renderKeyselect('data_source', true));
    $('#irt-cache-editor-controls').append(Menu.renderDataSourceSections());
    $('#irt-section-indexed-db').append(Menu.renderKeyselect('data_type', true));
    $('#irt-section-indexed-db').append(Menu.renderKeyselect('tag_category', true));
    $('#irt-section-indexed-db').append(Menu.renderKeyselect('query_order', true));
    $('#irt-section-local-storage').append(Menu.renderCheckbox('raw_data', true));
    $('#irt-cache-editor-controls').append(Menu.renderTextinput('data_name', 20, true));
    Menu.engageUI({checkboxradio: true});
    Menu.saveUserSettingsClick();
    Menu.resetUserSettingsClick();
    $('#irt-control-tag-name-view').on(JSPLib.event.click, ViewChecklistTag);
    $('#irt-control-tag-name-save').on(JSPLib.event.click, SaveChecklistTag);
    $('#irt-control-tag-name-populate').on(JSPLib.event.click, PopulateChecklistTag);
    $('#irt-control-tag-name-list').on(JSPLib.event.click, ListChecklistTags);
    Menu.cacheInfoClick();
    Menu.purgeCacheClick();
    Menu.expandableClick();
    Menu.dataSourceChange();
    $('#irt-control-data-type').on('change.irt', DataTypeChange);
    Menu.rawDataChange();
    Menu.getCacheClick(ValidateProgramData);
    Menu.saveCacheClick(ValidateProgramData, ValidateEntry);
    Menu.deleteCacheClick();
    Menu.listCacheClick();
    Menu.refreshCacheClick();
    Menu.cacheAutocomplete();
    InitializeMenuAutocomplete();
}

//Main program

function Main() {
    Load.preloadScript({
        program_css: PROGRAM_CSS,
        light_css: LIGHT_MODE_CSS,
        dark_css: DARK_MODE_CSS,
    });
    Load.preloadMenu({
        menu_func: RenderSettingsMenu,
        menu_css: MENU_CSS,
    });
    if (!Load.isScriptEnabled() || Menu.isSettingsMenu()) return;
    InitializeProgramValues();
    SetupInitializations();
    Statistics.addPageStatistics(PROGRAM_NAME);
    Load.noncriticalTasks(CleanupTasks);
}

/****Initialization****/

//Variables for JSPLib
JSPLib.data = IRT;
JSPLib.name = PROGRAM_NAME;
JSPLib.shortcut = PROGRAM_SHORTCUT;
JSPLib.settings_config = SETTINGS_CONFIG;

//Variables for debug.js
Debug.mode = false;
Debug.level = Debug.INFO;

//Variables for menu.js
Menu.data_regex = PROGRAM_DATA_REGEX;
Menu.data_key = OptionCacheDataKey;
Menu.control_config = CONTROL_CONFIG;

//Variables for storage.js
Storage.indexedDBValidator = ValidateEntry;

//Export JSPLib
Load.exportData();

/****Execution start****/

Load.programInitialize(Main, {required_variables: PROGRAM_LOAD_REQUIRED_VARIABLES, required_selectors: PROGRAM_LOAD_REQUIRED_SELECTORS});

})(JSPLib);
