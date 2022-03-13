// ==UserScript==
// @name         BetterSavedSearches
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      6.5
// @description  Provides an alternative mechanism and UI for saved searches.
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @exclude      /^https?://\w+\.donmai\.us/.*\.(xml|json|atom)(\?|$)/
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/bettersavedsearches.user.js
// @require      https://cdn.jsdelivr.net/npm/core-js-bundle@3.2.1/minified.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.5.2/localforage.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.12.0/validate.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200507-utility/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/concurrency.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200506-storage/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/menu.js
// ==/UserScript==

/* global JSPLib $ Danbooru validate */

/****Global variables****/

//Library constants

////NONE

//Exterior script variables
const DANBOORU_TOPIC_ID = '15462';
const JQUERY_TAB_WIDGET_URL = 'https://cdn.jsdelivr.net/gh/jquery/jquery-ui@1.12.1/ui/widgets/tabs.js';

//Variables for load.js
const program_load_required_variables = ['window.jQuery','window.Danbooru'];
const program_load_required_selectors = ['#page'];

//Program name constants
const PROGRAM_SHORTCUT = 'bss';
const PROGRAM_CLICK = 'click.bss';
const PROGRAM_NAME = 'BetterSavedSearches';

//Program data constants
const PROGRAM_DATA_REGEX = /(ta|plid|plname)-/; //Regex that matches the prefix of all program cache data
const PROGRAM_DATA_KEY = {
    tag_alias: 'ta',
    pool_id: 'plid',
    pool_name: 'plname',
    program_data: 'bss-queries',
};

//Main program variable
var BSS;

//Timer function hash
var Timer = {};

//For factory reset
const localstorage_keys = [
    'first-pass-resume',
    'secondary-pass',
    'overflow',
    'hide-saved-searches',
    'bss-seed-rate',
];

//Available setting values
const profile_thumb_types = ['danbooru','script','both'];

//Main settings
const SETTINGS_CONFIG = {
    profile_thumb_source: {
        allitems: profile_thumb_types,
        default: ['danbooru'],
        validate: (data)=>{return Array.isArray(data) && data.length === 1 && profile_thumb_types.includes(data[0])},
        hint: "Currently disabled."
    },
    recheck_interval: {
        default: 5,
        parse: parseInt,
        validate: (data)=>{return Number.isInteger(data) && data > 0;},
        hint: "How often to check for new posts (# of minutes)."
    },
    metatags_interval: {
        default: 16,
        parse: parseInt,
        validate: (data)=>{return Number.isInteger(data) && data >= 4;},
        hint: "How often to run a query on each metatag search (# of hours, minimum 4)."
    },
    random_reseed_interval: {
        default: 60,
        parse: parseInt,
        validate: (data)=>{return Number.isInteger(data) && data >= 15;},
        hint: "How often to run a query on a randomly chosen saved search (# of minutes, minimum 15)."
    },
    seed_size: {
        default: 100,
        parse: parseInt,
        validate: (data)=>{return Number.isInteger(data) && data >= 20 && data <= 200;},
        hint: "Amount of posts to seed a saved search with (valid values, 20 - 200)."
    },
    query_size: {
        default: 100,
        parse: parseInt,
        validate: (data)=>{return Number.isInteger(data) && data >= 20 && data <= 100;},
        hint: "Amount of post results to show per page (valid values, 20 - 100)."
    },
    saved_search_size: {
        default: 200,
        parse: parseInt,
        validate: (data)=>{return Number.isInteger(data) && data >= 100 && data <= 500;},
        hint: "Maximum number of posts to track per saved search (valid values, 100 - 500)."
    },
    show_deleted_enabled: {
        default: false,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Will show deleted posts in the search query results."
    },
    show_favorites_enabled: {
        default: true,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Will show favorited posts in the search query results."
    },
};

const all_source_types = ['indexed_db','local_storage'];
const all_data_types = ['program_data', 'tag_alias', 'pool_id', 'pool_name', 'custom'];

const CONTROL_CONFIG = {
    cache_info: {
        value: "Click to populate",
        hint: "Calculates the cache usage of the program and compares it to the total usage.",
    },
    purge_cache: {
        display: `Purge cache (<span id="${PROGRAM_SHORTCUT}-purge-counter">...</span>)`,
        value: "Click to purge",
        hint: `Dumps all of the cached data related to ${PROGRAM_NAME}.`,
    },
    reset_query_data: {
        display: `Reset query data (<span id="${PROGRAM_SHORTCUT}-initialize-counter">...</span>)`,
        value: "Click to reset",
        hint: `<span style="color:red"><b>Warning!</b></span> The program will have to reinitialize, including reseeding all saved searches.`,
    },
    data_source: {
        allitems: all_source_types,
        value: 'indexed_db',
        hint: "Indexed DB is <b>Cache Data</b> and Local Storage is <b>Program Data</b>.",
    },
    data_type: {
        allitems: all_data_types,
        value: 'program_data',
        hint: "Select type of data. Use <b>Custom</b> for querying by keyname.",
    },
    raw_data: {
        value: false,
        hint: "Select to import/export all program data",
    },
    data_name: {
        value: "",
        buttons: ['get', 'save', 'delete'],
        hint: "Click <b>Get</b> to see the data, <b>Save</b> to edit it, and <b>Delete</b> to remove it.",
    },
};

//CSS constants

const post_css = `
#bss-message {
    font-size: 200%;
    margin: 10px;
}
#bss-saved-search-list .bss-link {
    margin-left: -4px;
}
.bss-clear {
    color: red;
    font-weight: bold;
    margin: 0 -4px;
}
.bss-reset {
    margin: 0 -5px;
}
.bss-disabled > .bss-link {
    text-decoration: underline;
}
.bss-active > .bss-link {
    font-weight: bold;
}
.bss-metatags > .bss-link {
    color: green;
}`;
const search_css = `
#bss-new-saved-search #saved_search_query {
    max-width: unset;
}
#bss-refresh-saved-searches a {
    color: green;
}`;

//HTML constants

const CACHE_INFO_TABLE = '<div id="bss-cache-info-table" style="display:none"></div>';

const saved_search_box = `
<section id="bss-saved-search-box">
    <h1>
        <a class="bss-link">Saved Searches</a>
        <a href="/posts?tags=search%3Aall">&raquo;</a>
        (<a class="bss-count" title="...">...</a>)
    </h1>
    <ul id="bss-saved-search-list" style="display:none">
    </ul>
    <div id="bss-message" style="display:none">Loading (<span id="bss-initialize-counter">0</span>)</div>
    <div id="bss-last-updated" style="font-size:75%">
        <span style="font-weight:bold">Last post:</span>
        <span id="bss-time-ago">...</span>
        (
            <a id="bss-reset-position" style="color:red;font-weight:bold"  title="Click to reset position to latest post.">X</a>
        )
    </div>
    <div id="bss-seed-velocity" style="font-size:75%">
        <span style="font-weight:bold">Reseeds/day:</span>
        <span id="bss-seeds-day">...</span>
    </div>
    <a id="toggle-bss-saved-searches" href="#">Toggle List</a>
</section>`;

const refresh_link = `
<li id="bss-refresh-saved-searches"><a href="#">Refresh BetterSavedSearches (<span id="bss-refresh-count">...</span>)</a></li>
<li id="bss-loading-saved-searches" style="display:none !important;padding-left:10px !important">BetterSavedSearches: Loading (<span id="bss-initialize-counter">0</span>)</li>`;

const add_search_form = `
    <form class="simple_form" id="bss-new-saved-search">
        <div class="input">
            <label for="saved_search_query">Query</label>
            <input data-autocomplete="tag-query" type="text" id="saved_search_query" size="100">
        </div>
        <div class="input">
            <label for="saved_search_label_string">Labels</label>
            <input data-autocomplete="saved-search" type="text" id="saved_search_label_string" size="40">
            <span class="hint">A list of tags to help categorize this search. Space delimited.</span>
        </div>
        <button type="button" class="ui-button ui-corner-all ui-widget">Submit</button>
    </form>`;

const bss_menu = `
<div id="bss-script-message" class="prose">
    <h2>BetterSavedSearches</h2>
    <p>Check the forum for the latest on information and updates (<a class="dtext-link dtext-id-link dtext-forum-topic-id-link" href="/forum_topics/${DANBOORU_TOPIC_ID}">topic #${DANBOORU_TOPIC_ID}</a>).</p>
</div>
<div id="bss-console" class="jsplib-console">
    <div id="bss-settings" class="jsplib-outer-menu">
        <div id="bss-general-settings" class="jsplib-settings-grouping">
            <div id="bss-general-message" class="prose">
                <h4>General settings</h4>
            </div>
        </div>
        <div id="bss-post-settings" class="jsplib-settings-grouping">
            <div id="bss-post-message" class="prose">
                <h4>Post settings</h4>
            </div>
        </div>
        <div id="bss-network-settings" class="jsplib-settings-grouping">
            <div id="bss-network-message" class="prose">
                <h4>Network settings</h4>
                <p>Metatag searches include the use of unhandled search terms, most often because that information is not contained in the post itself.
                   Therefore, instead of being collected at the regular check, the script executes individual post queries to Danbooru.
                </p>
                <div class="expandable">
                    <div class="expandable-header">
                        <span>Unhandled metatags</span>
                        <input type="button" value="Show" class="expandable-button">
                    </div>
                    <div class="expandable-content">
                        <li>age</li>
                        <li>appealer</li>
                        <li>approver</li>
                        <li>artcomm</li>
                        <li>arttags</li>
                        <li>chartags</li>
                        <li>comm</li>
                        <li>commenter</li>
                        <li>copytags</li>
                        <li>date</li>
                        <li>downvote</li>
                        <li>fav</li>
                        <li>favcount</li>
                        <li>favgroup</li>
                        <li>filesize</li>
                        <li>flagger</li>
                        <li>gentags</li>
                        <li>height</li>
                        <li>id</li>
                        <li>limit</li>
                        <li>locked</li>
                        <li>md5</li>
                        <li>metatags</li>
                        <li>mpixels</li>
                        <li>noter</li>
                        <li>noteupdater</li>
                        <li>order</li>
                        <li>ordfav</li>
                        <li>ordpool</li>
                        <li>pixiv</li>
                        <li>pixiv_id</li>
                        <li>pool</li>
                        <li>ratio</li>
                        <li>score</li>
                        <li>search</li>
                        <li>source</li>
                        <li>tagcount</li>
                        <li>upvote</li>
                        <li>width</li>
                    </div>
                </div>
                <div class="expandable">
                    <div class="expandable-header">
                        <span>Additional setting details</span>
                        <input type="button" value="Show" class="expandable-button">
                    </div>
                    <div class="expandable-content">
                        <ul>
                            <li><b>Metatags interval:</b>
                                <ul>
                                    <li>This includes a random addon of 50% of the selected value.</li>
                                    <li>This prevents all metatag searches triggering at once.</li>
                                </ul>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        <div id="bss-filter-settings" class="jsplib-settings-grouping">
            <div id="bss-filter-message" class="prose">
                <h4>Filter settings</h4>
            </div>
        </div>
        <div id="bss-cache-controls" class="jsplib-settings-grouping">
            <div id="bss-cache-message" class="prose">
                <h4>Cache controls</h4>
                <div class="expandable">
                    <div class="expandable-header">
                        <span>Cache Data details</span>
                        <input type="button" value="Show" class="expandable-button">
                    </div>
                    <div class="expandable-content">
                        <ul>
                            <li><b>Tag aliases (ta):</b> Used to determine if an added tag is bad or an alias.</li>
                            <li><b>Pool ID (plid):</b> ID -> name information.</li>
                            <li><b>Pool name (plname):</b> Name -> ID information.</li>
                            <li><b>Program data (bss-queries):</b> Tracks post data for saved search queries./li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        <hr>
        <div id="bss-settings-buttons" class="jsplib-settings-buttons">
            <input type="button" id="bss-commit" value="Save">
            <input type="button" id="bss-resetall" value="Factory Reset">
        </div>
    </div>
    <div id="bss-cache-editor" class="jsplib-outer-menu">
        <div id="bss-editor-message" class="prose">
            <h4>Cache editor</h4>
            <p>See the <b><a href="#bss-cache-message">Cache Data</a></b> details for the list of all cache data and what they do.</p>
            <div class="expandable">
                <div class="expandable-header">
                    <span>Program Data details</span>
                    <input type="button" value="Show" class="expandable-button">
                </div>
                <div class="expandable-content">
                    <p class="tn">All timestamps are in milliseconds since the epoch (<a href="https://www.epochconverter.com">Epoch converter</a>).</p>
                    <ul>
                        <li>Query data
                            <ul>
                                <li><b>first-pass-resume:</b> The last post ID seen by the program.</li>
                                <li><b>secondary-pass:</b> List of postIDs with timestamps to check again once they are over an hour old.</li>
                                <li><b>overflow:</b> Did the last post check reach the limit?
                                    <ul>
                                        <li>When true, it overides whatever the timeout value is.</li>
                                        <li>This allows the program to catch up faster when it is behind.</li>
                                    </ul>
                                </li>
                                <li><b>bss-seed-rate:</b> List of timestamps over the last day when seed events occurred.</li>
                            </ul>
                        </li>
                        <li>Recheck data
                            <ul>
                                <li><b>timeout:</b> When the program will next check for new posts.</li>
                                <li><b>query-recheck-expires:</b> When the program will next fully check a random query.</li>
                                <li><b>saved-search-expires:</b> When the program will next check for new saved searches.
                                    <ul>
                                        <li><b>Note:</b> These can also be manually refreshed from the Saved Searches <a href="/saved_searches">Management Page</a>.</li>
                                    </ul>
                                </li>
                                <li><b>normalize-expires:</b> When the program will normalize the query data.
                                    <ul>
                                        <li>This includes unaliasing tags, replacing pool names with IDs, and removing duplicate entries.</li>
                                        <li>This testing also gets done at the manual refresh mentioned above.</li>
                                    </ul>
                                </li>
                            </ul>
                        </li>
                        <li>General data
                            <ul>
                                <li><b>hide-saved-searches:</b> The toggle state of the user interface on the post index page.</li>
                                <li><b>prune-expires:</b> When the program will next check for cache data that has expired.</li>
                                <li><b>user-settings:</b> All configurable settings.</li>
                            </ul>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
        <div id="bss-cache-editor-controls"></div>
        <div id="bss-cache-editor-errors" class="jsplib-cache-editor-errors"></div>
        <div id="bss-cache-viewer" class="jsplib-cache-viewer">
            <textarea></textarea>
        </div>
    </div>
</div>
`;

//Other constants

const random_ratio = 1000;

//At around 1000 the URI becomes too long and errors out on Danbooru
//At around 500 Hijiribe/Sonohara refuses the connection
const HTML_QUERY_SIZE = 500;
const API_QUERY_SIZE = 100;
const MAX_QUERY_SIZE = 1000;

//Time constants
const prune_expires = JSPLib.utility.one_day;
const noncritical_recheck = JSPLib.utility.one_minute;
const heartbeat_timeout = JSPLib.utility.one_minute * 5;
const saved_search_expires = JSPLib.utility.one_day;
const normalize_expires = JSPLib.utility.one_week;
const pool_data_expires = JSPLib.utility.one_month;
const alias_data_expires =JSPLib.utility.one_month;
const timer_poll_interval = 100;

//Only field parameters
const post_fields = "id,created_at,tag_string,pool_string,rating,uploader_name,has_children,parent_id,file_ext,is_deleted,is_pending,is_flagged,is_banned";
const pool_fields = "id,name";
const tag_fields = "id,name";
const alias_field = "consequent_name";

//REGEXes

const ALL_META_TAGS = new RegExp('^(-?user|-?approver|commenter|comm|noter|noteupdater|' +
                               'artcomm|-?pool|ordpool|-?favgroup|-?fav|ordfav|md5|' +
                               '-?rating|-?locked|width|height|mpixels|ratio|score|' +
                               'favcount|filesize|-?source|-?id|date|age|order|limit|' +
                               '-?status|tagcount|-?parent|child|pixiv_id|pixiv|search|' +
                               'upvote|downvote|-?filetype|-?flagger|-?appealer|' +
                               'gentags|chartags|copytags|arttags|metatags):(.+)$','i');

//Only includes those metatags that aren't being handled
const META_TAGS = new RegExp('^(commenter|comm|noter|noteupdater|artcomm|-?pool|ordpool|' +
                    '-?favgroup|-?fav|ordfav|md5|-?locked|width|height|mpixels|' +
                    'ratio|score|favcount|filesize|-?source|-?id|date|age|order|limit|' +
                    '-?approver|tagcount|pixiv_id|pixiv|search|upvote|downvote|' +
                    '-?flagger|-?appealer|gentags|chartags|copytags|arttags|metatags):(.+)$','i');

const FREE_TAGS = /$(-?status:deleted|rating:s.*|limit:.+)$/i

//Validation constants

const query_constraints = {
    queries: JSPLib.validate.array_constraints,
    queryentry: {
        id: JSPLib.validate.id_constraints,
        tags: JSPLib.validate.stringonly_constraints,
        original: JSPLib.validate.stringnull_constraints,
        found: JSPLib.validate.integer_constraints,
        expires: JSPLib.validate.integer_constraints,
        seeded: JSPLib.validate.integer_constraints,
        updated: JSPLib.validate.integer_constraints,
        posts: JSPLib.validate.array_constraints,
        unseen: JSPLib.validate.array_constraints,
        require: JSPLib.validate.array_constraints,
        optional: JSPLib.validate.array_constraints,
        exclude: JSPLib.validate.array_constraints,
        labels: JSPLib.validate.array_constraints,
        metatags: JSPLib.validate.boolean_constraints,
        dirty: JSPLib.validate.boolean_constraints,
        disabled: JSPLib.validate.boolean_constraints,
        duplicate: JSPLib.validate.boolean_constraints,
        successrate: JSPLib.validate.number_constraints
    },
    inclusiondata: ['exclude', 'optional', 'require'],
    typedata: {
        posts: JSPLib.validate.basic_ID_validator,
        unseen: JSPLib.validate.basic_ID_validator,
        labels: JSPLib.validate.basic_stringonly_validator,
        require: JSPLib.validate.basic_stringonly_validator,
        optional: JSPLib.validate.basic_stringonly_validator,
        exclude: JSPLib.validate.basic_stringonly_validator,
    }
};

const relation_constraints = {
    entry: JSPLib.validate.arrayentry_constraints(),
    value: JSPLib.validate.basic_stringonly_validator
};

const pool_constraints = {
    entry: JSPLib.validate.hashentry_constraints,
    value: {
        id: JSPLib.validate.id_constraints,
        name: JSPLib.validate.stringonly_constraints
    }
};

const posttime_constraints = {
    id: JSPLib.validate.id_constraints,
    created: JSPLib.validate.integer_constraints
}

/****FUNCTIONS****/

//Validate functions

function ValidateEntry(key,entry) {
    if (key === 'bss-queries') {
        return ValidateQueries(key,entry);
    }
    if (!JSPLib.validate.validateIsHash(key, entry)) {
        return false;
    }
    if (key.match(/^ta-/)) {
        return ValidateRelationEntry(key, entry);
    }
    if (key.match(/^(plid|plname)-/)) {
        return ValidatePoolEntry(key, entry);
    }
    ValidateEntry.debuglog("Bad key!");
    return false;
}

function ValidateRelationEntry(key,entry) {
    if (!JSPLib.validate.validateHashEntries(key, entry, relation_constraints.entry)) {
        return false;
    }
    return JSPLib.validate.validateArrayValues(key + '.value', entry.value, relation_constraints.value)
}

function ValidatePoolEntry(key,entry) {
    if (!JSPLib.validate.validateHashEntries(key, entry, pool_constraints.entry)) {
        return false;
    }
    if (!JSPLib.validate.validateHashEntries(key + '.value', entry.value, pool_constraints.value)) {
        return false;
    }
    return true;
}

function ValidateQueries(query_container) {
    let error_messages = [];
    let queries = query_container.entries;
    if (!Array.isArray(queries)) {
        error_messages.push("Queries data is not an array.");
        query_container.entries = [];
        return error_messages;
    }
    for (let i = queries.length - 1; i >= 0; i--){
        let itemkey = `queries[${i}]`;
        let query = queries[i];
        if (!JSPLib.validate.isHash(query)) {
            error_messages.push({[itemkey]: "Query is not a hash."});
            queries.splice(i,1);
            continue;
        }
        let check_tags = query.tags || query.original;
        if (!check_tags || !JSPLib.validate.isString(check_tags)) {
            error_messages.push({[itemkey]: "No tags in query."});
            queries.splice(i,1);
            continue;
        }
        let parse_query = ParseQuery(check_tags);
        let check = validate(query, query_constraints.queryentry);
        if (check !== undefined) {
            error_messages.push({[itemkey]: check});
            for (let key in check) {
                query[key] = parse_query[key];
            }
        }
        let bad_keys = JSPLib.utility.setDifference(Object.keys(query),Object.keys(query_constraints.queryentry));
        if (bad_keys.length) {
            error_messages.push({[itemkey]: ["Bad keys found.", bad_keys]});
            bad_keys.forEach((key)=>{delete query[key];});
        }
        for (let key in query_constraints.typedata) {
            let check_messages = JSPLib.validate.correctArrayValues(`${itemkey}.${key}`,query[key],query_constraints.typedata[key]);
            error_messages.push(...check_messages);
        }
        query_constraints.inclusiondata.forEach((key)=>{
            let differences = JSPLib.utility.setSymmetricDifference(query[key],parse_query[key]);
            if (differences.length) {
                error_messages.push({[`${itemkey}.${key}`]: ["Missing/extra tags found.",differences]});
                query[key] = parse_query[key];
            }
        });
        if (error_messages.length) {
            query.dirty = true;
        }
    }
    return error_messages;
}

function CorrectQueries(entry) {
    let error_messages = ValidateQueries(entry);
    if (error_messages.length) {
        CorrectQueries.debuglog("Corrections to queries detected!");
        error_messages.forEach((error)=>{CorrectQueries.debuglog(JSON.stringify(error,null,2))});
        BSS.dirty = true;
        return false
    } else {
        CorrectQueries.debuglog("Query data is valid.");
        return true;
    }
}

function ValidatePostTimeEntry(key,entry) {
    if (!JSPLib.validate.validateIsArray(key,entry)) {
        return false
    }
    for (let i = 0;i < entry.length;i++){
        let itemkey = key + `[${i}]`;
        if (!JSPLib.validate.validateIsHash(itemkey,entry[i])) {
            return false
        }
        if (!JSPLib.validate.validateHashEntries(itemkey, entry[i], posttime_constraints)) {
            return false;
        }
    }
    return true;
}

function ValidateProgramData(key,entry) {
    var checkerror=[];
    switch (key) {
        case 'bss-secondary-pass':
            return ValidatePostTimeEntry(key,entry);
        case 'bss-user-settings':
            checkerror = JSPLib.menu.validateUserSettings(entry, SETTINGS_CONFIG);
            break;
        case 'bss-overflow':
        case 'bss-hide-saved-searches':
            if (!JSPLib.validate.isBoolean(entry)) {
                checkerror = ["Value is not a boolean."];
            }
            break;
        case 'bss-first-pass-resume':
            if (!JSPLib.validate.validateID(entry)) {
                checkerror = ["Value is not a valid ID."];
            }
            break;
        case 'bss-search-posts':
            if (!JSPLib.validate.validateIDList(entry)) {
                checkerror = ["Value is not a valid ID list."];
            }
            break;
        case 'bss-timeout':
        case 'bss-recent-timestamp':
        case 'bss-saved-search-expires':
        case 'bss-query-recheck-expires':
        case 'bss-normalize-expires':
        case 'bss-prune-expires':
            if (!Number.isInteger(entry)) {
                checkerror = ["Value is not an integer."];
            }
            break;
        case 'bss-seed-rate':
            if (!Array.isArray(entry)) {
                checkerror = ["Value is not an array."];
            } else {
                return JSPLib.validate.validateArrayValues(key,entry,JSPLib.validate.basic_integer_validator);
            }
            break;
        default:
            checkerror = ["Not a valid program data key."];
    }
    if (checkerror.length) {
        JSPLib.validate.outputValidateError(key,checkerror);
        return false;
    }
    return true;
}

//Library functions

////NONE

//Helper functions

function ChooseAll() {
    return true;
}

function ChooseLabel(query,label) {
    return query.labels.includes(label);
}

function ChooseID(query,id) {
    return query.id == id;
}

function QueryIterator(func) {
    BSS.entries.forEach((entry,i)=>{
        if (entry.duplicate) {
            return;
        }
        return func(entry,i);
    });
}

function QueryFilter(func) {
    return BSS.entries.filter((entry)=>{
        if (entry.duplicate) {
            return;
        }
        return func(entry);
    });
}

function QueryReduce(func,initial) {
    return BSS.entries.reduce((accumulator,entry)=>{
        if (entry.duplicate) {
            return accumulator;
        }
        return func(accumulator,entry);
    },initial);
}

function GetLabelEntry(label) {
    return {
        id: label,
        dirty: GetLabelDirty(label),
        unseen: GetPosts('unseen',ChooseLabel,label),
        posts: GetPosts('posts',ChooseLabel,label),
        disabled: GetLabelDisabled(label),
        metatags: GetLabelMetatags(label)
    };
}

function GetLabelDirty(label) {
    return QueryReduce((dirty,entry)=>{return (ChooseLabel(entry,label) ? dirty || entry.dirty : dirty);},false);
}

function GetLabelMetatags(label) {
    return QueryReduce((metatags,entry)=>{return (ChooseLabel(entry,label) ? metatags || entry.metatags : metatags);},false);
}

function GetLabelActive(label) {
    return QueryReduce((active,entry)=>{return (ChooseLabel(entry,label) ? active || (BSS.active_query == entry.id) : active);},false);
}

function GetLabelDisabled(label) {
    return QueryReduce((disabled,entry)=>{return (ChooseLabel(entry,label) ? disabled && entry.disabled : disabled);},true);
}

function GetAnyDirty() {
    return QueryReduce((dirty,entry)=>{return dirty || entry.dirty;},false);
}

function GetAllTags() {
    return JSPLib.utility.setUnique(QueryReduce((all_tags,entry)=>{return JSPLib.utility.concat(all_tags, GetAllEntryTags(entry));},[]));
}

function GetAllEntryTags(entry) {
    return entry.require.concat(entry.exclude).concat(entry.optional);
}

function GetPosts(type,choose,id) {
    let postids = QueryReduce((total_posts,entry)=>{
        return (choose(entry,id) ? total_posts.concat(entry[type]) : total_posts);
    },[]);
    return NormalizePosts(postids);
}

function ClearPosts(type,choose,id) {
    QueryIterator((entry)=>{
        if (choose(entry,id)) {
            if (entry[type].length > 0) {
                entry[type].length = 0;
                entry.dirty = true;
            }
            if (type == 'posts') {
                entry.disabled = true;
            }
        }
    });
}

function ResetDirty() {
    QueryIterator((entry)=>{entry.dirty = false});
}

function PostIDQuery(posts,page,escape=true) {
    let activestring = (BSS.user_settings.show_deleted_enabled ? "status:any " : "");
    let idstring = "id:" + PaginatePostIDString(posts,page);
    let urlsearch = $.param({
        tags: activestring + idstring,
        limit: BSS.user_settings.query_size,
        bss: (BSS.active_query ? BSS.active_query : "all"),
        bss_type: (BSS.query_type ? BSS.query_type : "click"),
        tab: BSS.tab_id,
        p: page
    });
    if (escape) {
        urlsearch = JSPLib.utility.HTMLEscape(urlsearch);
    }
    return "/posts?" + urlsearch;
}

function TimeAgo(timestamp) {
    let time_interval = Date.now() - timestamp;
    if (time_interval < JSPLib.utility.one_hour) {
        return JSPLib.utility.setPrecision(time_interval / JSPLib.utility.one_minute, 2) + " minutes ago";
    } else if (time_interval < JSPLib.utility.one_day) {
        return JSPLib.utility.setPrecision(time_interval / JSPLib.utility.one_hour, 2) + " hours ago";
    } else if (time_interval < JSPLib.utility.one_month) {
        return JSPLib.utility.setPrecision(time_interval / JSPLib.utility.one_day, 2) + " days ago";
    } else if (time_interval < JSPLib.utility.one_year) {
        return JSPLib.utility.setPrecision(time_interval / JSPLib.utility.one_month, 2) + " months ago";
    } else {
        return JSPLib.utility.setPrecision(time_interval / JSPLib.utility.one_year, 2) + " years ago";
    }
}

function GetTabID() {
    let tab_id = JSPLib.storage.getStorageData('bss-tab-id',sessionStorage);
    if (!tab_id) {
        tab_id = JSPLib.utility.getUniqueID();
        JSPLib.storage.setStorageData('bss-tab-id',tab_id,sessionStorage);
    }
    return tab_id;
}

function GetSeedRate() {
    let stored_rate = JSPLib.storage.checkStorageData('bss-seed-rate',ValidateProgramData,localStorage,[]);
    let filtered_rate = stored_rate.filter((timestamp)=>{return (Date.now() - timestamp) < JSPLib.utility.one_day;});
    if (stored_rate.length !== filtered_rate.length) {
        JSPLib.storage.setStorageData('bss-seed-rate',filtered_rate,localStorage);
    }
    return filtered_rate;
}

function WasOverflow() {
    return JSPLib.storage.checkStorageData('bss-overflow',ValidateProgramData,localStorage,false);
}

//Storage functions

async function LoadBSSEntries() {
    if (('bss-heartbeat' in sessionStorage) && JSPLib.concurrency.checkTimeout('bss-heartbeat', heartbeat_timeout, sessionStorage)) {
        LoadBSSEntries.debuglog("Window timeout detected! Removing stale data...");
        sessionStorage.removeItem('bss-queries');
    }
    BSS.entries = await JSPLib.storage.retrieveData('bss-queries');
    if (!CorrectQueries(BSS)) {
        await StoreBSSEntries();
    }
}

async function StoreBSSEntries() {
    if (BSS.dirty || GetAnyDirty()) {
        if (BSS.dirty) {
            StoreBSSEntries.debuglog("Broadcast reinstall!");
            BSS.channel.postMessage({type:"reinstall",entries:BSS.entries});
        } else if (GetAnyDirty()) {
            StoreBSSEntries.debuglog("Broadcast reload!");
            BSS.channel.postMessage({type:"reload",entries:BSS.entries});
        }
        ResetDirty();
        await JSPLib.storage.saveData('bss-queries', BSS.entries);
        BSS.dirty = false;
    }
}

//Render functions

////#C-POSTS #A-INDEX

function RenderSavedSearchList() {
    let posthtml = '';
    BSS.labels.forEach((label)=>{
        posthtml += RenderSavedSearchLabel(label);
    });
    return posthtml;
}

function RenderSavedSearchLabel(label) {
    let posthtml = "";
    let label_queries = QueryFilter((entry)=>{return ChooseLabel(entry,label);}).sort((a,b)=>{return a.tags.localeCompare(b.tags);});
    label_queries.forEach((query)=>{
        let options = SetLineOptions(query);
        let title_string = RenderCalendarTitle(query);
        let preicon_html = `<span class="ui-icon ui-icon-calendar" title="${title_string}"></span>`;
        let query_string = (query.original ? query.original : query.tags);
        let pool_ids = GetPoolIDs(query_string);
        posthtml += RenderQueryLine("bss-detailed-query",query,options,pool_ids,preicon_html,query_string,query_string,true) + '\n</li>';
    });
    let label_entry = GetLabelEntry(label);
    let label_options = SetLineOptions(label_entry);
    let preicon_html = `<a class="ui-icon collapsible-saved-search-links ui-icon-triangle-1-e"></a>`;
    let prehtml = RenderQueryLine("bss-label-query",label_entry,label_options,[],preicon_html,label,`search:${label}`,false);
    let display = (GetLabelActive(label) ? "" : "display:none");
    return prehtml + `\n<ul style="${display}">` + posthtml + `\n</ul>\n</li>`;
}

function RenderCalendarTitle(query) {
    let found_timestring = (query.found > 0 ? new Date(query.found).toLocaleString() : 'N/A');
    let seeded_timestring = new Date(query.seeded).toLocaleString();
    return `
Last found: ${found_timestring}
Last seeded: ${seeded_timestring}`.trim('\n');
}

function SetLineOptions(entry) {
    return {
        clear_enabled: (entry.posts.length > 0 ? "" : "display:none"),
        reset_enabled: (entry.posts.length === 0 ? "" : "display:none"),
        active_class: (BSS.active_query == entry.id ? " bss-active" : ''),
        disabled_class: (entry.disabled ? " bss-disabled" : ''),
        metatag_class: (entry.metatags ? " bss-metatags" : ''),
    };
}

function RenderQueryLine(classname,entry,options,pool_ids,preicon_html,linetext,linksearch,detailed) {
    let data_pools = (pool_ids.length ? ` data-pools="${pool_ids.join(',')}"` : '');
    return `
<li class="${classname}${options.active_class}${options.disabled_class}${options.metatag_class}" data-id="${entry.id}"${data_pools}>
    ${preicon_html}
    <a class="bss-link" title="${linetext}">${JSPLib.utility.maxLengthString(linetext)}</a>
    ${JSPLib.danbooru.postSearchLink(linksearch,'&raquo;')}
    <span class="bss-count">(<a title="${entry.posts.length}">${entry.unseen.length}</a>)</span>
    <span class="bss-last-control">
        [
        <span class="bss-clear" style="${options.clear_enabled}"><a title="${entry.posts.length}">X</a></span>
        <span class="bss-reset" style="${options.reset_enabled}"><a class="ui-icon ui-icon-arrowrefresh-1-w"></a></span>
        ]
    </span>`;
}

////#C-SAVED-SEARCHES #A-INDEX

function RenderTableRow(saved_search) {
    let rowclass = $(".striped tr").length % 2 ? "even" : "odd";
    let rowlabels = saved_search.labels.map((label)=>{return JSPLib.danbooru.postSearchLink(`search:${label}`,label);}).join('\n        ');
    return `
<tr id="saved-search-${saved_search.id}" class="${rowclass}">
    <td>${JSPLib.danbooru.postSearchLink(saved_search.query,saved_search.query)}</td>
    <td>
        ${rowlabels}
    </td>
    <td class="links">
        <a href="/saved_searches/${saved_search.id}/edit">edit</a>
        | <a data-remote="true" rel="nofollow" data-method="delete" href="/saved_searches/${saved_search.id}">delete</a>
    </td>
</tr>`;
}

//Initialization functions

////#C-POSTS #A-INDEX

async function PaginatePostIndex() {
    await BSS.deferred_search;
    $(".current-page > span").text(BSS.page);
    let posts = BSS.search_posts;
    let total_pages = Math.ceil(posts.length/BSS.user_settings.query_size);
    let first_page = Math.max(BSS.page - 4, 1);
    let last_page = Math.min(BSS.page + 4, total_pages);
    for (let i = first_page; i <= last_page; i++) {
        if (i === BSS.page) {
            continue;
        }
        let html = `<li class="numbered-page"><a class="bss-post-search" href="${PostIDQuery(posts,i)}">${i}</a></li>`;
        if (i < BSS.page) {
            $(".current-page").before(html);
        } else {
            $(".arrow:last-of-type").before(html);
        }
    }
    if (first_page !== 1) {
        let html = `<li class="numbered-page"><a class="bss-post-search" href="${PostIDQuery(posts,1)}">1</a></li>`;
        if (first_page > 2) {
            html += `<li class="more"><i class="fas fa-ellipsis-h"></i></li>`;
        }
        $(".arrow:first-of-type").after(html);
    }
    if (last_page !== total_pages) {
        let html = `<li class="numbered-page"><a class="bss-post-search" href="${PostIDQuery(posts,total_pages)}">${total_pages}</a></li>`;
        if (last_page < (total_pages - 1)) {
            html = `<li class="more"><i class="fas fa-ellipsis-h"></i></li>` + html;
        }
        $(".arrow:last-of-type").before(html);
    }
    if (BSS.page !== 1) {
        let html = `
<a rel="prev" id="paginator-prev" class="bss-post-search" data-shortcut="a left" href="${PostIDQuery(posts,BSS.page-1)}" title="Shortcut is a or left">
    <i class="fas fa-chevron-left"></i>
</a>`;
        $(".arrow:first-of-type").html(html);
    }
    if (BSS.page !== total_pages) {
        let html = `
<a rel="next" id="paginator-next" class="bss-post-search" data-shortcut="d right" href="${PostIDQuery(posts,BSS.page + 1)}" title="Shortcut is d or right">
    <i class="fas fa-chevron-right"></i>
</a>`;
        $(".arrow:last-of-type").html(html);
    }
}

function InitializeIndexThumbnails () {
    $(".post-preview").each((i,entry)=>{
        if (!BSS.user_settings.show_favorites_enabled) {
            if ($(entry).data('is-favorited')) {
                entry.style.setProperty('display','none','important');
                return;
            }
        }
        let postid = $(entry).data("id");
        $(">a",entry).attr('href',`/posts/${postid}?bss=${BSS.active_query}&bss_type=${BSS.query_type}&tab=${BSS.tab_id}`);
    });
}

function InitializeUI() {
    InitializeUI.debuglog("Rendering!");
    BSS.labels = QueryReduce((a,b,result)=>{return a.concat(b.labels);},[]);
    BSS.labels = JSPLib.utility.setUnique(BSS.labels).sort();
    $("#bss-saved-search-list").html(RenderSavedSearchList());
    RecalculateMain();
    if (!JSPLib.storage.checkStorageData('bss-hide-saved-searches',ValidateProgramData,localStorage,false)) {
        $("#bss-saved-search-list").show();
        $("#bss-message").hide();
    }
    SearchClick("h1 > .bss-link",0,'posts',ChooseAll);
    SearchClick("h1 > .bss-count",0,'unseen',ChooseAll);
    SearchClick(".bss-label-query > .bss-link",1,'posts',ChooseLabel);
    SearchClick(".bss-label-query > .bss-count a",2,'unseen',ChooseLabel);
    ClearClick(".bss-label-query > span > .bss-clear a",3,ChooseLabel);
    ResetClick(".bss-label-query > span > .bss-reset a",3,ChooseLabel);
    SearchClick(".bss-detailed-query .bss-link",1,'posts',ChooseID);
    SearchClick(".bss-detailed-query .bss-count a",2,'unseen',ChooseID);
    ClearClick(".bss-detailed-query .bss-clear a",3,ChooseID);
    ResetClick(".bss-detailed-query .bss-reset a",3,ChooseID);
    MainToggle();
    DetailedSearchesToggle();
    BSSLinkHover();
    let timestamp = JSPLib.storage.checkStorageData('bss-recent-timestamp',ValidateProgramData,localStorage);
    let timeagostring = (timestamp ? ((Date.now() - timestamp) < JSPLib.utility.one_minute * 10 ? "Up to date" : TimeAgo(timestamp)) : "ERROR");
    $("#bss-time-ago").text(timeagostring);
    ResetPosition();
    $("#bss-seeds-day").text(BSS.seed_rate.length);
}

function RecalculateTree() {
    QueryIterator((entry)=>{
        RecalculateLine(entry,'bss-detailed-query');
    });
    BSS.labels.forEach((label)=>{
        RecalculateLine(GetLabelEntry(label),'bss-label-query');
    });
    if (GetAnyDirty()) {
        RecalculateTree.debuglog("Dirty BSS entries!");
        RecalculateMain();
    }
}

function RecalculateLine(entry,classname) {
    if (!entry.dirty) {
        return;
    }
    RecalculateLine.debuglog("Dirty item:",entry.id);
    $(`.${classname}[data-id=${entry.id}] > .ui-icon-calendar`).attr('title',RenderCalendarTitle(entry));
    $(`.${classname}[data-id=${entry.id}] > span > .bss-count a`).html(entry.unseen.length);
    $(`.${classname}[data-id=${entry.id}] > span > .bss-count a`).attr('title',entry.posts.length);
    $(`.${classname}[data-id=${entry.id}] > span > .bss-clear a`).attr('title',entry.posts.length);
    $(`.${classname}[data-id=${entry.id}] > .bss-last-control > span`).hide();
    let show_control = (entry.posts.length > 0 ? 'bss-clear' : 'bss-reset');
    $(`.${classname}[data-id=${entry.id}]  > span > .${show_control}`).show();
    if (entry.disabled) {
        $(`.${classname}[data-id=${entry.id}]`).addClass('bss-disabled');
    } else {
        $(`.${classname}[data-id=${entry.id}]`).removeClass('bss-disabled');
    }
}

function RecalculateMain() {
    $("h1 > .bss-count").html(GetPosts('unseen',ChooseAll).length);
    $("h1 > .bss-count").attr('title',GetPosts('posts',ChooseAll).length);
}

////#C-POSTS #A-SHOW

async function SequentializePostShow() {
    await BSS.deferred_search;
    let postid = parseInt(JSPLib.utility.getMeta('post-id'));
    let posts = (BSS.query_type === "posts" ? GetPosts("posts",ChooseLabel,BSS.active_query) : BSS.search_posts);
    if (posts.length === 0) {
        return;
    }
    let index = posts.indexOf(postid);
    let first_postid = posts[0];
    let prev_postid = (index >= 1 ? posts[index-1] : posts[index]);
    let next_postid = (index < (posts.length - 1) ? posts[index+1] : posts[index]);
    let last_postid = posts.slice(-1);
    let urlsearch = $.param($.extend({
        bss: (BSS.active_query ? BSS.active_query : "all"),
        bss_type: (BSS.query_type ? BSS.query_type : "click"),
    },{
       tab: (BSS.opening_tab ? BSS.tab_id : undefined)
    }));
    $("#search-seq-nav .search-name").text("BetterSavedSearches");
    $("#search-seq-nav .prev").before(`<a style="position:absolute;left:1em" href="/posts/${first_postid}?${urlsearch}">&laquo; first</a>`);
    $("#search-seq-nav .prev").attr('href',`/posts/${prev_postid}?${urlsearch}`).css('left','5em');
    $("#search-seq-nav .next").attr('href',`/posts/${next_postid}?${urlsearch}`).css('right','5em');
    $("#search-seq-nav .next").after(`<a style="position:absolute;right:1em" href="/posts/${last_postid}?${urlsearch}">last &raquo;</a>`);
}

////#C-SAVED-SEARCHES #A-INDEX

//Check for existence of IndexedAutocomplete
function AutocompleteRecheck() {
    AutocompleteRecheck.timer = JSPLib.utility.initializeInterval(()=>{
        if(Danbooru.IAC && Danbooru.IAC.InitializeAutocompleteIndexed) {
            setTimeout(()=>{Danbooru.IAC.InitializeAutocompleteIndexed("[data-autocomplete=saved-search]", 'ss', true);}, 500);
            clearInterval(AutocompleteRecheck.timer);
        }
    }, timer_poll_interval, JSPLib.utility.one_second * 5);
}

//Alias functions

async function QueryTagAliases(taglist) {
    let [cached_aliases,uncached_aliases] = await JSPLib.storage.batchStorageCheck(taglist, ValidateEntry, alias_data_expires, 'ta');
    QueryTagAliases.debuglog("Cached aliases:", cached_aliases);
    QueryTagAliases.debuglog("Uncached aliases:", uncached_aliases);
    if (uncached_aliases.length) {
        let all_aliases = [];
        for (let i = 0; i < uncached_aliases.length; i += API_QUERY_SIZE) {
            let check_tags = uncached_aliases.slice(i, i + API_QUERY_SIZE);
            let url_addons = {search: {antecedent_name_space: check_tags.join(' '), status:'active'}, only: alias_field, limit: MAX_QUERY_SIZE};
            let data = await JSPLib.danbooru.submitRequest('tag_aliases', url_addons, []);
            all_aliases = JSPLib.utility.concat(all_aliases, data);
        }
        let found_aliases = [];
        all_aliases.forEach((alias)=>{
            found_aliases.push(alias.antecedent_name);
            JSPLib.storage.saveData('ta-' + alias.antecedent_name, {value: [alias.consequent_name], expires: JSPLib.utility.getExpires(alias_data_expires)});
        });
        let unfound_aliases = JSPLib.utility.setDifference(uncached_aliases, found_aliases);
        unfound_aliases.forEach((tag)=>{
            JSPLib.storage.saveData('ta-' + tag, {value: [], expires: JSPLib.utility.getExpires(alias_data_expires)});
        });
        QueryTagAliases.debuglog("Found aliases:", found_aliases);
        QueryTagAliases.debuglog("Unfound aliases:", unfound_aliases);
    }
    let alias_dict = {};
    cached_aliases.forEach((tag)=>{
        alias_dict[tag] = JSPLib.storage.getStorageData('ta-' + tag, sessionStorage).value;
    });
    QueryTagAliases.debuglog("Aliases:", alias_dict);
    return alias_dict;
}

function GetLastConsequent(tag,tag_aliases) {
    if (!(tag in tag_aliases) || tag_aliases[tag].length == 0) {
        return tag;
    }
    return GetLastConsequent(tag_aliases[tag][0],tag_aliases);
}

//Pool functions

function GetPoolIDs(str) {
    return str.split(' ').filter((tag)=>{return tag.match(/^pool:\d+$/);}).map((pooltag)=>{return parseInt(pooltag.match(/:(\d+)/)[1]);});
}

async function GetPoolNameFromID(poolid) {
    let key = 'plid-' + poolid.toString();
    let storeditem = await JSPLib.storage.checkLocalDB(key,ValidateEntry);
    if (storeditem) {
        return storeditem.value;
    } else {
        let pool = await JSPLib.danbooru.submitRequest(`pools/${poolid}`,{only: pool_fields},{});
        let data = {};
        if (Object.keys(pool).length > 0) {
            data = pool;
            JSPLib.storage.saveData('plname-' + data.name, {value: data, expires: JSPLib.utility.getExpires(pool_data_expires)});
        } else {
            data = {id: poolid, name: "XXXXXXXX"};
        }
        JSPLib.storage.saveData(key, {value: data, expires: JSPLib.utility.getExpires(pool_data_expires)});
        return data;
    }
}

async function GetPoolIDFromName(poolname) {
    let key = 'plname-' + poolname;
    let storeditem = await JSPLib.storage.checkLocalDB(key,ValidateEntry);
    if (storeditem) {
        return storeditem.value;
    } else {
        let url_addons = {search:{order: "post_count", name_matches: poolname}, limit: 10, only: pool_fields};
        let pools = await JSPLib.danbooru.submitRequest('pools', url_addons, []);
        pools = pools.filter((pool)=>{return pool.name.match(JSPLib.danbooru.tagOnlyRegExp(poolname));});
        let data = {};
        if (pools.length) {
            data = pools[0];
            JSPLib.storage.saveData('plid-' + data.id, {value: data, expires: JSPLib.utility.getExpires(pool_data_expires)});
        } else {
            data = {id: 0, name: poolname};
        }
        JSPLib.storage.saveData(key, {value: data, expires: JSPLib.utility.getExpires(pool_data_expires)});
        return data;
    }
}

//Event handlers

////#C-POSTS #A-INDEX

function SearchClick(selector,level,posttype,choosepost) {
    $(selector).on(PROGRAM_CLICK,async (event)=>{
        if (!SearchClick.reserved) {
            let id = $(JSPLib.utility.getNthParent(event.target,level)).data('id');
            let posts = GetPosts(posttype,choosepost,id);
            SearchClick.debuglog(id,posts.length);
            if (posts.length > 0) {
                ClearPosts('unseen',choosepost,id);
                StoreBSSEntries();
                JSPLib.storage.setStorageData('bss-search-posts',posts,sessionStorage);
                BSS.active_query = id;
                BSS.query_type = "click";
                window.location = window.location.origin + PostIDQuery(posts,1,false);
            }
            SearchClick.reserved = false;
        }
    });
}

function ClearClick(selector,level,choosepost) {
    $(selector).on(PROGRAM_CLICK,async (event)=>{
        if (!ClearClick.reserved) {
            ClearClick.reserved = true;
            let $dom = $(JSPLib.utility.getNthParent(event.target,level));
            let id = $dom.data('id');
            ClearClick.debuglog(id);
            ClearPosts('posts',choosepost,id);
            ClearPosts('unseen',choosepost,id);
            Timer.RecalculateTree();
            StoreBSSEntries();
            $dom.addClass('bss-disabled');
            ClearClick.reserved = false;
        }
    });
}

function ResetClick(selector,level,choosepost) {
    $(selector).on(PROGRAM_CLICK,async (event)=>{
        if (!ResetClick.reserved) {
            ResetClick.reserved = true;
            let $dom = $(JSPLib.utility.getNthParent(event.target,level));
            let id = $dom.data('id');
            ResetClick.debuglog(id);
            $("#bss-saved-search-list").hide();
            $("#bss-message").show();
            let promise_array = [];
            QueryIterator((entry)=>{
                if (choosepost(entry,id)) {
                    entry.dirty = true;
                    entry.disabled = false;
                    promise_array.push(SeedQuery(entry));
                }
            });
            await Promise.all(promise_array);
            Timer.RecalculateTree();
            StoreBSSEntries();
            $("#bss-message").hide();
            $("#bss-saved-search-list").show();
            ResetClick.reserved = false;
        }
    });
}

function ResetPosition() {
    $("#bss-reset-position").on(PROGRAM_CLICK,(event)=>{
        if(confirm("This will skip all posts to the current. Continue?")) {
            JSPLib.danbooru.submitRequest('posts',{limit: 1, only: "id,created_at"}).then((data)=>{
                JSPLib.storage.setStorageData('bss-recent-timestamp', new Date(data[0].created_at).getTime(), localStorage);
                JSPLib.storage.setStorageData('bss-first-pass-resume', data[0].id,localStorage);
                $("#bss-time-ago").text("Up to date");
            });
        }
    });
}

function DetailedSearchesToggle() {
    $(".collapsible-saved-search-links").on(PROGRAM_CLICK,(event)=>{
        let label = $(event.target.parentElement).data('id');
        $(event.target).toggleClass("ui-icon-triangle-1-e ui-icon-triangle-1-s");
        $(`.bss-label-query[data-id=${label}] > ul`).slideToggle(100);
    });
}

function MainToggle() {
    $("#toggle-bss-saved-searches").on(PROGRAM_CLICK,(event)=>{
        $("#bss-saved-search-list").slideToggle(100);
        if (!JSPLib.storage.checkStorageData('bss-hide-saved-searches',ValidateProgramData,localStorage,false)) {
            JSPLib.storage.setStorageData('bss-hide-saved-searches',true,localStorage);
        } else {
            JSPLib.storage.setStorageData('bss-hide-saved-searches',false,localStorage);
        }
        BSS.channel.postMessage({type:"toggle"});
        event.preventDefault();
    });
}

function BSSLinkHover() {
    $(".bss-detailed-query[data-pools] .bss-link").on('mouseover.bss',async (event)=>{
        let $link = $(event.target);
        $link.unbind("mouseenter mouseleave");
        let pool_ids = $(event.target.parentElement).data('pools').toString().split(',').map((x)=>{return parseInt(x);});
        let title = $link.attr('title');
        BSSLinkHover.debuglog(title,pool_ids);
        let promise_array = pool_ids.map((poolid)=>{return GetPoolNameFromID(poolid);});
        let pools = await Promise.all(promise_array);
        pools.forEach((pool)=>{
            title = title.split(' ').map((tag)=>{return tag.replace(JSPLib.danbooru.tagOnlyRegExp(`pool:${pool.id}`),`pool:${pool.name}`);}).join(' ');
        });
        $link.attr('title',title);
    });
}

////#C-SAVED-SEARCHES #A-INDEX

function RefreshLinkClick() {
    $("#bss-refresh-saved-searches a").on(PROGRAM_CLICK,async (event)=>{
        if (!RefreshLinkClick.reserved) {
            RefreshLinkClick.reserved = true;
            JSPLib.utility.fullHide("#bss-refresh-saved-searches");
            JSPLib.utility.clearHide("#bss-loading-saved-searches");
            await CheckUserSavedSearches(true);
            await Timer.NormalizeBSSEntries(true);
            StoreBSSEntries();
            JSPLib.utility.fullHide("#bss-loading-saved-searches");
            JSPLib.utility.clearHide("#bss-refresh-saved-searches");
            Danbooru.Utility.notice("Saved searches updated.");
            RefreshLinkClick.reserved = false;
        }
        event.preventDefault();
    });
}

function SubmitNewQueryClick() {
    $("#bss-new-saved-search button").on(PROGRAM_CLICK,async (event)=>{
        let labels = $("#saved_search_label_string").val();
        let query = $("#saved_search_query").val();
        try {
            var saved_search = await $.post('/saved_searches.json',{saved_search:{query: query, label_string: labels}});
        } catch (e) {
            e = (typeof e === "object" && 'status' in e && 'responseText' in e ? e : {status: 999, responseText: "Bad error code!"});
            JSPLib.debug.debuglog("POST error:",e.status,e.responseText);
            Danbooru.Utility.error(`HTTP Error ${e.status} creating saved search!`);
            return;
        }
        let html = RenderTableRow(saved_search);
        $(".striped tbody").append(html);
        Danbooru.Utility.notice(`Saved search "${saved_search.query}" has been added.`);
    });
}

////Settings menu

function ResetQueryDataClick() {
    $('#bss-control-reset-query-data').on(PROGRAM_CLICK, (event)=>{
        if(confirm("This will reset all query data. Continue?")) {
            if (!ResetQueryDataClick.is_started) {
                ResetQueryDataClick.is_started = true;
                BSS.entries = [];
                CheckUserSavedSearches(true).then(()=>{
                    StoreBSSEntries();
                    ResetQueryDataClick.is_started = false;
                    JSPLib.utility.notice('Query data has finished reinitializing!');
                });
            }
        }
    });
}
ResetQueryDataClick.is_started = false;

//Profile functions

async function CheckSearchVisibility() {
    $(".user-saved-search:not(.bss-processed)").each((i,elem)=>{
        let $elem = $(elem);
        let label = $elem.data('label');
        if (JSPLib.utility.isScrolledIntoView(elem)) {
            let post_ids = GetPosts('posts',ChooseLabel,label).slice(0,10);
            if (post_ids.length > 0) {
                CheckSearchVisibility.total_post_ids = JSPLib.utility.setUnion(CheckSearchVisibility.total_post_ids,post_ids);
                CheckSearchVisibility.label_post_ids[label] = post_ids;
                $(elem).append(`<div class="box" data-id="${label}"><h1 class="bss-profile-load">Loading...</h2></div>`);
            } else {
                $(elem).append(`<div class="box"><h4>BetterSavedSearches</h4><br><h1>Empty!</h1></div>`);
            }
            $(elem).addClass("bss-processed");
        }
    });
}
CheckSearchVisibility.total_post_ids = [];
CheckSearchVisibility.label_post_ids = [];

async function LoadProfilePostsInterval() {
    if (CheckSearchVisibility.total_post_ids.length === 0) {
        return;
    }
    let total_post_ids = JSPLib.utility.dataCopy(CheckSearchVisibility.total_post_ids);
    let label_post_ids = JSPLib.utility.dataCopy(CheckSearchVisibility.label_post_ids);
    CheckSearchVisibility.total_post_ids = [];
    CheckSearchVisibility.label_post_ids = {};
    let html = await $.get("/posts",{tags:"id:"+total_post_ids.join(','),limit:total_post_ids.length});
    var $posts = $.parseHTML(html);
    for (let label in label_post_ids) {
        let $label_box = $(`.user-saved-search[data-label=${label}] .box:last-of-type`);
        $label_box.html(`<h4 class="bss-search-header">BetterSavedSearches: <a class="bss-link">${label}</a></h4>`);
        label_post_ids[label].forEach((post_id)=>{
            let $thumb = $(`.post-preview[data-id=${post_id}]`,$posts);
            $label_box.append($thumb);
            $(">a",$thumb).attr('href',`/posts/${post_id}?bss=${label}&bss_type=posts`);
            //The profile thumbs have carriage returns between each element which adds a few pixels of margin
            $label_box.append('\n');
        });
        SearchClick(`.user-saved-search[data-label=${label}] .bss-link`,2,'posts',ChooseLabel);
    }
    Danbooru.Blacklist.apply();
    if ($(".user-saved-search:not(.bss-processed)").length === 0 && CheckSearchVisibility.total_post_ids.length === 0) {
        clearInterval(LoadProfilePostsInterval.timer);
        LoadProfilePostsInterval.timer = true;
    }
}

//Query functions

function ParseQuery(string) {
    let entry = {
        id: JSPLib.utility.getUniqueID(), //Only used for validate errors
        tags: string,
        original: null,
        found: 0,
        expires: 0,
        seeded: 0,
        updated: 0,
        posts: [],
        unseen: [],
        require: [],
        optional: [],
        exclude: [],
        labels: [],
        metatags: false,
        dirty: false,
        disabled: false,
        duplicate: false,
        successrate: 0.0
    };
    let matches = string.match(/\S+/g) || [];
    let total_tags = 0;
    matches.forEach((tag)=>{
        if (tag.match(META_TAGS)) {
            entry.metatags = true;
        } else if (tag.charAt(0) === '-') {
            entry.exclude.push(tag.slice(1));
        } else if (tag.charAt(0) === '~') {
            entry.optional.push(tag.slice(1));
        } else {
            entry.require.push(tag);
        }
        if (!tag.match(FREE_TAGS)) {
            total_tags++;
        }
    });
    if (total_tags > BSS.user_limit) {
        entry.disabled = true;
        entry.expires = -1;
    }
    return entry;
}

function UpdateQuery(post_ids,query) {
    UpdateQuery.debuglog(post_ids,query);
    query.unseen = NormalizePosts(query.unseen, post_ids, true, true, "add");
    query.posts = NormalizePosts(query.posts, post_ids, true, true, "add");
    query.found = Date.now();
    query.dirty = true;
}

async function SeedQuery(query,merge=false) {
    if (query.expires < 0) {
        SeedQuery.debuglog("Number of query tags outside user limit!");
    }
    SeedQuery.debuglog(query);
    let addons = {tags: query.tags, only: "id", limit: BSS.user_settings.seed_size};
    let posts = await JSPLib.danbooru.submitRequest('posts',addons,[]);
    let post_ids = JSPLib.utility.getObjectAttributes(posts,'id');
    if (post_ids.length) {
        if (merge) {
            SeedQuery.debuglog("Merge:", query.metatags, query.tags);
            if (query.metatags) {
                let diff_index = post_ids.indexOf(query.posts[0]);
                //Assumes that own order is consistent with metatags search
                let unseen_posts = (diff_index >=0 ? post_ids.slice(0, diff_index) : post_ids);
                SeedQuery.debuglog("Unseen posts:", unseen_posts);
                if (unseen_posts.length) {
                    //Having the unseen posts as the first input will add them to the front since insertion order is being maintained
                    query.unseen = NormalizePosts(unseen_posts, query.unseen, true, false, "add");
                    query.posts = NormalizePosts(unseen_posts, query.posts, true, false, "add");
                    query.found = Date.now();
                }
            } else {
                let post_range = query.posts.filter((postid)=>{return ((postid <= post_ids[0]) && (postid >= post_ids[post_ids.length - 1]));});
                let false_positives = JSPLib.utility.setDifference(post_range,post_ids);
                let false_negatives = JSPLib.utility.setDifference(post_ids,post_range);
                SeedQuery.debuglog("False positives:",false_positives);
                SeedQuery.debuglog("False negatives:",false_negatives);
                if (false_positives.length) {
                    query.unseen = NormalizePosts(query.unseen, false_positives, false, true, "subtract");
                    query.posts = NormalizePosts(query.posts, false_positives, false, true, "subtract");
                }
                if (false_negatives.length) {
                    query.unseen = NormalizePosts(query.unseen, false_negatives, true, true, "add");
                    query.posts = NormalizePosts(query.posts, false_negatives, true, true, "add");
                    query.found = Date.now();
                }
                if (false_positives.length || false_negatives.length) {
                    let hour_distance = (Date.now() - query.seeded) / JSPLib.utility.one_hour;
                    let successes_hour = (false_positives.length + false_negatives.length) / hour_distance;
                    query.successrate = Math.abs(successes_hour) + Math.abs(query.successrate);
                } else {
                    query.successrate /= 2;
                }
            }
        } else {
            query.posts = post_ids;
            query.unseen = [];
        }
        if (query.metatags) {
            //Choose a random time between 16 - 24 hours
            let expires_interval = BSS.user_settings.metatags_interval * JSPLib.utility.one_hour;
            let expires_window = (Math.random() * expires_interval * 0.5);
            query.expires = JSPLib.utility.getExpires(expires_interval + expires_window);
        }
    } else {
        //Disable invalid queries
        query.unseen = [];
        query.posts = [];
        query.disabled = true;
    }
    query.seeded = Date.now();
    query.dirty = true;
}

function MergeQuery(oldquery,newquery) {
    oldquery.original = oldquery.tags;
    oldquery.tags = newquery.tags;
    oldquery.require = newquery.require;
    oldquery.exclude = newquery.exclude;
    oldquery.optional = newquery.optional;
    oldquery.dirty = true;
}

//Select a query with a higher weight towards:
//- those with an older seed times
//- those with a higher post velocity
//- those with a higher success rate
function ChooseRandomQuery() {
    let random_choice = {};
    let total_post_distance = 0;
    let total_seed_distance = 0;
    let total_success_distance = 0;
    let last_post = JSPLib.storage.checkStorageData('bss-first-pass-resume',ValidateProgramData,localStorage);
    if (!last_post) {
        return false;
    }
    QueryIterator((entry)=>{
        if (entry.disabled || entry.metatags) {
            return;
        }
        //Get the distance for the last 10 posts
        let post_distances = entry.posts.map((postid)=>{return last_post - postid;}).slice(0,10);
        //Inverting the metric so that smaller distnces are favored
        let post_distance_metric = 1 / JSPLib.statistics.average(post_distances);
        total_post_distance += post_distance_metric;
        //Not inverting the metric to favor larger time distances
        let seed_distance_metric = Date.now() - entry.seeded;
        total_seed_distance += seed_distance_metric;
        let success_distance_metric = Math.abs(entry.successrate);
        total_success_distance += success_distance_metric;
        random_choice[entry.id] = {entry: entry, post_distance: post_distance_metric, seed_distance: seed_distance_metric, success_distance: success_distance_metric};
    });
    let total_spread = 0;
    for (let key in random_choice) {
        let entry = random_choice[key];
        entry.seed_distance = (total_seed_distance ? entry.seed_distance * random_ratio / total_seed_distance : 0);
        entry.post_distance = (total_post_distance ? entry.post_distance * random_ratio / total_post_distance : 0);
        entry.success_distance = (total_success_distance ? entry.success_distance * random_ratio / total_success_distance : 0);
        entry.combined = Math.round(entry.seed_distance + entry.post_distance + entry.success_distance);
        entry.begin = total_spread;
        entry.end = total_spread + entry.combined;
        total_spread = entry.end;
    }
    BSS.random_choice = random_choice;
    BSS.total_spread = total_spread;
    let random_pick = BSS.random_pick = Math.floor(total_spread * Math.random());
    let random_entry = null;
    QueryIterator((entry)=>{
        if (entry.disabled || entry.metatags) {
            return;
        }
        let id = entry.id;
        if ((random_pick >= random_choice[id].begin) && (random_pick < random_choice[id].end)) {
            BSS.random_chosen = random_choice[id];
            random_entry = entry;
            return false;
        }
    });
    return random_entry;
}

function CheckPost(tags,query) {
    if (query.require.length && !JSPLib.utility.isSubset(tags,query.require)) {
        return false;
    }
    if (query.optional.length && !JSPLib.utility.hasIntersection(tags,query.optional)) {
        return false;
    }
    if (query.exclude.length && JSPLib.utility.hasIntersection(tags,query.exclude)) {
        return false;
    }
    return true;
}

//Normalize functions

async function NormalizeBSSEntries(overide=false) {
    if (JSPLib.concurrency.checkTimeout('bss-normalize-expires',normalize_expires) || overide) {
        if (BSS.initialized) {
            NormalizeBSSEntries.debuglog("Checking...");
            let old_entries = JSPLib.utility.dataCopy(BSS.entries);
            ResetBSSEntries();
            await UnaliasBSSEntries();
            await ReplacePoolNamesWithIDs();
            RemoveDuplicateBSSEntries();
            JSPLib.debug.debugExecute(()=>{
                for (let i = 0; i < old_entries.length; i++) {
                    //This gets modified, but it's not actually changing anything
                    old_entries[i].dirty = BSS.entries[i].dirty;
                    if (JSON.stringify(old_entries[i]) !== JSON.stringify(BSS.entries[i])) {
                        NormalizeBSSEntries.debuglog("Changed Entry!",old_entries[i],'->',BSS.entries[i]);
                    }
                }
            });
            JSPLib.concurrency.setRecheckTimeout('bss-normalize-expires',normalize_expires);
        } else {
            //Doing this along with regular initialization ends up being a lot of network calls, so do it later
            NormalizeBSSEntries.debuglog("Will intialize after one hour");
            JSPLib.concurrency.setRecheckTimeout('bss-normalize-expires',JSPLib.utility.one_hour);
        }
    } else {
        NormalizeBSSEntries.debuglog("Skipping!");
    }
}

function ResetBSSEntries() {
    BSS.entries.forEach((entry)=>{
        let reset_entry = ParseQuery(entry.original ? entry.original : entry.tags);
        MergeQuery(entry,reset_entry);
        entry.duplicate = false;
        entry.original = null;
    });
}

async function UnaliasBSSEntries() {
    UnaliasBSSEntries.debuglog("Testing...");
    let all_tags = GetAllTags().filter((tag)=>{return !tag.match(ALL_META_TAGS);});
    let query_tags = [];
    for (let i = 0; i < all_tags.length; i += API_QUERY_SIZE) {
        let check_tags = all_tags.slice(i, i + API_QUERY_SIZE);
        let url_addons = {search: {name_space: check_tags.join(' '), hide_empty: true}, only: tag_fields, limit: API_QUERY_SIZE};
        let data = await JSPLib.danbooru.submitRequest('tags', url_addons, []);
        query_tags = JSPLib.utility.concat(query_tags, data);
    }
    let found_tags = JSPLib.utility.getObjectAttributes(query_tags,'name');
    let tag_aliases = {};
    found_tags.forEach((tag)=>{
        tag_aliases[tag] = [];
    })
    let missing_tags = JSPLib.utility.setDifference(all_tags,found_tags);
    if (missing_tags.length === 0) {
        UnaliasBSSEntries.debuglog("No missing tags!");
    }
    let network_aliases = await QueryTagAliases(missing_tags);
    Object.assign(tag_aliases, network_aliases);
    let change_tags = missing_tags.reduce((changes,tag)=>{return (tag != GetLastConsequent(tag,tag_aliases) ? changes.concat(tag) : changes);},[]);
    if (change_tags.length === 0) {
        UnaliasBSSEntries.debuglog("No tags to unalias!")
        return;
    }
    BSS.entries.forEach((entry)=>{
        let affected_tags = JSPLib.utility.setIntersection(change_tags,GetAllEntryTags(entry));
        if (affected_tags.length == 0) {
            return;
        }
        UnaliasBSSEntries.debuglog("UnaliasBSSEntries: Found affected entry",entry);
        let query_string = entry.tags;
        affected_tags.forEach((tag)=>{
            query_string = query_string.split(' ').map((tag)=>{return tag.replace(JSPLib.danbooru.tagOnlyRegExp(tag),GetLastConsequent(tag,tag_aliases));}).join(' ');
        });
        UnaliasBSSEntries.debuglog("UnaliasBSSEntries: Query change",entry.tags,"->",query_string);
        MergeQuery(entry,ParseQuery(query_string));
    });
}

async function ReplacePoolNamesWithIDs() {
    ReplacePoolNamesWithIDs.debuglog("Testing...");
    let all_pools = JSPLib.utility.filterRegex(GetAllTags(),/^pool:(?!\d*$)/);
    if (!all_pools.length) {
        ReplacePoolNamesWithIDs.debuglog("No pool names to replace!")
        return;
    }
    let pools = await Promise.all(all_pools.map((pooltag)=>{return GetPoolIDFromName(pooltag.match(/:(.*)/)[1]);}));
    BSS.entries.forEach((entry)=>{
        let affected_tags = JSPLib.utility.setIntersection(all_pools,GetAllEntryTags(entry));
        if (affected_tags.length == 0) {
            return;
        }
        ReplacePoolNamesWithIDs.debuglog("Found affected pool entry",entry);
        let query_string = entry.tags;
        affected_tags.forEach((pooltag)=>{
            let pool_id = pools.filter((pool)=>{return pooltag.match(JSPLib.danbooru.tagOnlyRegExp('pool:' + pool.name));});
            if (pool_id.length == 0 || pool_id[0].id == 0) {
                return;
            }
            query_string = query_string.split(' ').map((tag)=>{return tag.replace(JSPLib.danbooru.tagOnlyRegExp(pooltag),'pool:' + pool_id[0].id);}).join(' ');
        });
        ReplacePoolNamesWithIDs.debuglog("Query change",entry.tags,"->",query_string);
        MergeQuery(entry,ParseQuery(query_string));
    });
}


function RemoveDuplicateBSSEntries() {
    RemoveDuplicateBSSEntries.debuglog("Testing...");
    for (let i = 0;i < BSS.entries.length - 1; i++) {
        let entry_a = BSS.entries[i];
        for (let j = i + 1;j < BSS.entries.length; j++) {
            let entry_b = BSS.entries[j];
            let metatag_queries = entry_a.metatags && entry_b.metatags;
            let require_match = !metatag_queries && !JSPLib.utility.setSymmetricDifference(entry_a.require,entry_b.require).length;
            let exclude_match = !metatag_queries && !JSPLib.utility.setSymmetricDifference(entry_a.exclude,entry_b.exclude).length;
            let optional_match = !metatag_queries && !JSPLib.utility.setSymmetricDifference(entry_a.optional,entry_b.optional).length;
            if (require_match && exclude_match && optional_match || (entry_a.tags == entry_b.tags)) {
                RemoveDuplicateBSSEntries.debuglog("Duplicate entries found:", entry_a);
                entry_b.duplicate = true;
            }
        }
    }
}

//Post helper functions

function ProcessPosts(posts) {
    let all_tags = GetAllTags();
    let update_posts = {};
    posts.forEach((post)=>{
        let post_tags = GeneratePostTags(post);
        if (JSPLib.utility.hasIntersection(all_tags,post_tags)) {
            QueryIterator((query)=>{
                if (query.metatags || query.posts.includes(post.id)) {
                    return;
                }
                if (CheckPost(post_tags,query)) {
                    update_posts[query.id] = update_posts[query.id] || [];
                    update_posts[query.id].push(post.id);
                }
            });
        }
    });
    QueryIterator((query)=>{
        if (query.id in update_posts) {
            UpdateQuery(update_posts[query.id], query);
        }
    });
}

function GeneratePostTags(post) {
    let tags = post.tag_string.match(/\S+/g) || [];
    tags.push(`rating:{post.rating}`);
    tags.push(`user:post.uploader_name`);
    tags.push(post.has_children ? 'child:any' : 'child:none');
    tags.push(post.parent_id ? 'parent:any' : 'parent:none');
    tags.push(`filetype:${post.file_ext}`);
    post.is_deleted && tags.push('status:deleted');
    post.is_pending && tags.push('status:pending');
    post.is_flagged && tags.push('status:flagged');
    post.is_banned && tags.push('status:banned');
    !post.is_deleted && !post.is_pending && !post.is_flagged && tags.push('status:active');
    return tags;
}

function NormalizePosts(postids1,postids2,slice=false,sort=true,operation) {
    if (postids2 && operation) {
        if (operation === "add") {
            postids1 = JSPLib.utility.setUnion(postids2, postids1);
        } else if (operation === "subtract") {
            postids1 = JSPLib.utility.setDifference(postids1, postids2);
        }
    }
    if (sort) {
        postids1 = postids1.sort((a, b)=>{return b - a});
    }
    if (typeof slice === "boolean" && slice) {
        postids1 = postids1.slice(0, BSS.user_settings.saved_search_size);
    } else if (Number.isInteger(slice)) {
        postids1 = postids1.slice(0, slice);
    }
    return postids1;
}

function PaginatePostIDString(postids,page) {
    let page_start = (page - 1) * BSS.user_settings.query_size;
    let page_end = page * BSS.user_settings.query_size;
    return postids.slice(page_start, page_end).join(',');
}

function TimePostsFilter(posts,key,time,compare) {
    switch (compare) {
        case "gt": return posts.filter((post)=>{return (new Date(post[key]).getTime() + time) < Date.now();});
        case "lt": return posts.filter((post)=>{return (new Date(post[key]).getTime() + time) > Date.now();});
    }
}

//Main execution functions

//Process all posts more than 5 minutes old; setup secondary pass for posts newer than 1 hour
//This will catch most of the uploads from good taggers
async function InitialPass() {
    let options = {reverse: true, addons: {only: post_fields}};
    let pageid = JSPLib.storage.checkStorageData('bss-first-pass-resume',ValidateProgramData,localStorage);
    if (pageid) {
        options.page = pageid;
    }
    InitialPass.debuglog("Network:",pageid);
    let posts = await JSPLib.danbooru.getAllItems('posts', API_QUERY_SIZE, 2, options);
    if (posts.length === (API_QUERY_SIZE * 2)) {
        InitialPass.debuglog("Overflow detected!");
        JSPLib.storage.setStorageData('bss-overflow',true,localStorage);
    } else {
        JSPLib.storage.setStorageData('bss-overflow',false,localStorage);
    }
    let initial_posts = TimePostsFilter(posts, 'created_at', 5 * JSPLib.utility.one_minute, "gt");
    if (initial_posts.length) {
        Timer.ProcessPosts(initial_posts);
        let secondary_posts = TimePostsFilter(initial_posts, 'created_at', JSPLib.utility.one_hour, "lt");
        secondary_posts = secondary_posts.map((post)=>{return {id: post.id, created: new Date(post.created_at).getTime()};});
        InitialPass.debuglog("Secondary->",secondary_posts);
        if (secondary_posts.length) {
            let storage_posts = JSPLib.storage.checkStorageData('bss-secondary-pass',ValidatePostTimeEntry,localStorage,[]);
            BSS.secondary_pass = storage_posts.concat(secondary_posts);
            JSPLib.storage.setStorageData('bss-secondary-pass',BSS.secondary_pass,localStorage);
        }
        let all_timestamps = JSPLib.utility.getObjectAttributes(posts,'created_at');
        let normal_timestamps = all_timestamps.map((timestamp)=>{return new Date(timestamp).getTime();})
        let most_recent_timestamp = Math.max(...normal_timestamps);
        JSPLib.storage.setStorageData('bss-recent-timestamp', most_recent_timestamp, localStorage);
        JSPLib.storage.setStorageData('bss-first-pass-resume',JSPLib.danbooru.getNextPageID(initial_posts,true),localStorage);
    } else {
        InitialPass.debuglog("No posts!");
    }
}

//Process all posts more than one hour old that were set aside during installation or InitialPass
//This will catch most uploads that get tagged better by other users
async function SecondaryPass() {
    if (!BSS.secondary_pass) {
        BSS.secondary_pass = JSPLib.storage.checkStorageData('bss-secondary-pass',ValidatePostTimeEntry,localStorage,[]);
    }
    let process_posts = TimePostsFilter(BSS.secondary_pass, 'created', JSPLib.utility.one_hour, "gt");
    if (process_posts.length) {
        let process_ids = JSPLib.utility.getObjectAttributes(process_posts, 'id');
        process_ids = NormalizePosts(process_ids, null, HTML_QUERY_SIZE);
        let options = {addons: {tags: "id:" + process_ids.join(','), only: post_fields}};
        SecondaryPass.debuglog("Network:",process_ids);
        let posts = await JSPLib.danbooru.getAllItems('posts', API_QUERY_SIZE, null, options);
        Timer.ProcessPosts(posts);
        let remaining_posts = JSPLib.utility.listFilter(BSS.secondary_pass,process_ids,'id',true);
        SecondaryPass.debuglog("Remaining:",remaining_posts);
        JSPLib.storage.setStorageData('bss-secondary-pass',remaining_posts,localStorage);
    } else {
        SecondaryPass.debuglog("Skipping!");
    }

}

//Selects a random query every time period and runs a fresh reseed + merge
//This should catch any posts that slip by the one hour mark
async function RandomQueryRecheck() {
    let expires_interval = BSS.user_settings.random_reseed_interval * JSPLib.utility.one_minute;
    if (JSPLib.concurrency.checkTimeout('bss-query-recheck-expires',expires_interval)) {
        //Don't process right after initialization
        if (BSS.initialized) {
            RandomQueryRecheck.debuglog("Getting random...");
            let query = ChooseRandomQuery();
            if (query) {
                await SeedQuery(query,true);
                BSS.seed_rate.push(Date.now());
                JSPLib.storage.setStorageData('bss-seed-rate',BSS.seed_rate,localStorage);
            }
        }
        JSPLib.concurrency.setRecheckTimeout('bss-query-recheck-expires',expires_interval);
    } else {
        RandomQueryRecheck.debuglog("Skipping!");
    }
}

//Processes one metatag query per page load if the entry has expired
async function DailyMetatagRecheck() {
    let promise_array = [];
    QueryIterator((entry)=>{
        if (entry.metatags && !entry.disabled && entry.expires >=0 && Date.now() > entry.expires) {
            DailyMetatagRecheck.debuglog(entry.tags);
            promise_array.push(SeedQuery(entry,true));
            return false;
        }
    });
    if (promise_array.length) {
        await Promise.all(promise_array);
    } else {
        DailyMetatagRecheck.debuglog("Skipping!");
    }
}

async function CheckUserSavedSearches(overide=false) {
    if (JSPLib.concurrency.checkTimeout('bss-saved-search-expires',saved_search_expires) || overide) {
        CheckUserSavedSearches.debuglog("Checking...");
        let saved_searches = await JSPLib.danbooru.getAllItems('saved_searches', API_QUERY_SIZE, null, {page: 0, reverse: true});
        let query_ids = JSPLib.utility.getObjectAttributes(BSS.entries,'id');
        let promise_array = [];
        BSS.dirty = false;
        saved_searches.forEach((entry)=>{
            let entry_time = new Date(entry.updated_at).getTime();
            let index = query_ids.indexOf(entry.id);
            if (index >= 0) {
                if (entry_time > BSS.entries[index].updated) {
                    CheckUserSavedSearches.debuglog("Splicing out old entry",BSS.entries[index]);
                    BSS.entries.splice(index,1);
                    query_ids = JSPLib.utility.getObjectAttributes(BSS.entries,'id');
                } else {
                    return;
                }
            }
            CheckUserSavedSearches.debuglog("Adding search:",entry);
            let query = ParseQuery(entry.query);
            query.updated = entry_time;
            query.id = entry.id;
            query.labels = entry.labels;
            BSS.entries.push(query);
            promise_array.push(SeedQuery(query));
            BSS.dirty = true;
        });
        await Promise.all(promise_array);
        let current_ids = JSPLib.utility.getObjectAttributes(saved_searches,'id');
        let removed_ids = JSPLib.utility.setDifference(query_ids,current_ids);
        if (removed_ids.length) {
            CheckUserSavedSearches.debuglog("Removing old entries!",removed_ids);
            BSS.entries = JSPLib.utility.listFilter(BSS.entries,removed_ids,'id',true);
            BSS.dirty = true;
        }
        JSPLib.concurrency.setRecheckTimeout('bss-saved-search-expires',saved_search_expires);
    } else {
        CheckUserSavedSearches.debuglog("Skipping!");
    }
}

//Cache functions

function OptionCacheDataKey(data_type,data_value) {
    if (data_type === "program_data") {
        return "bss-queries";
    } else {
        let type_shortcut = PROGRAM_DATA_REGEX[data_type];
        return `${type_shortcut}-${data_value}`;
    }
}

//Settings functions

function BSSBroadcast(ev) {
    if (!BSS.is_enabled) {
        return;
    }
    BSSBroadcast.debuglog(`(${ev.data.type}):`,ev.data);
    BSS.entries = (ev.data.entries ? ev.data.entries : BSS.entries);
    if (BSS.is_post_index) {
        if (ev.data.type === "reload") {
            Timer.RecalculateTree();
        } else if (ev.data.type === "reinstall") {
            Timer.InitializeUI();
        } else if (ev.data.type === "toggle") {
            $("#bss-saved-search-list").toggle(100);
        }
    }
    switch (ev.data.type) {
        case "search_query":
            if (ev.data.rx_tab === BSS.tab_id && BSS.search_posts.length) {
                BSS.channel.postMessage({type:"search_response",posts:BSS.search_posts,rx_tab:ev.data.tx_tab});
            }
            break;
        case "search_response":
            if (ev.data.rx_tab === BSS.tab_id) {
                BSS.search_posts = ev.data.posts;
                JSPLib.storage.setStorageData('bss-search-posts',BSS.search_posts,sessionStorage);
                BSS.deferred_search.resolve(true);
            }
            break;
        case "reload":
        case "reinstall":
            ResetDirty();
            JSPLib.storage.setStorageData('bss-queries',BSS.entries,sessionStorage);
            //falls through
        default:
            //do nothing
    }
}

function MaximumTagQueryLimit() {
    if (Danbooru.CurrentUser.data('is-platinum')) {
        return 12;
    } else if (Danbooru.CurrentUser.data('is-gold')) {
        return 6;
    } else {
        return 2;
    }
}

function GetRecheckExpires() {
    return BSS.user_settings.recheck_interval * JSPLib.utility.one_minute;
}

function RemoteSettingsCallback() {
    if (BSS.active_query) {
        if (JSPLib.utility.hasSettingChanged('show_deleted_enabled')) {
            $('.bss-post-search').each((i,link)=>{
                let old_link = link.href;
                let replacement = (BSS.user_settings.show_deleted_enabled ? 'status%3Aany%20' : "");
                let new_link = old_link.replace(/tags=status%3Aany%20/,'tags=' + replacement);
                link.href = new_link;
            });
        }
        if (JSPLib.utility.hasSettingChanged('show_favorites_enabled')) {
            $(".post-preview").each((i,post)=>{
                if (!BSS.user_settings.show_favorites_enabled && $(post).data('is-favorited')) {
                    post.style.setProperty('display','none','important');
                } else {
                    post.style.removeProperty('display');
                }
            });
        }
    }
}

function RemoteResetCallback() {
    $("#bss-saved-search-list").show();
    $("#bss-seeds-day").text(BSS.seed_rate.length);
    RemoteSettingsCallback();
}

function RemoteDisableCallback() {
    $("#bss-saved-search-box").hide();
    JSPLib.utility.fullHide("#bss-refresh-saved-searches");
    $("#bss-new-saved-search").hide();
}

function RenderSettingsMenu() {
    $("#better-saved-searches").append(bss_menu);
    $("#bss-general-settings").append(JSPLib.menu.renderDomainSelectors());
    $("#bss-general-settings").append(JSPLib.menu.renderInputSelectors('profile_thumb_source', 'radio'));
    $("#bss-post-settings").append(JSPLib.menu.renderTextinput('seed_size', 10));
    $("#bss-post-settings").append(JSPLib.menu.renderTextinput('query_size', 10));
    $("#bss-post-settings").append(JSPLib.menu.renderTextinput('saved_search_size', 10));
    $("#bss-network-settings").append(JSPLib.menu.renderTextinput('recheck_interval', 10));
    $("#bss-network-settings").append(JSPLib.menu.renderTextinput('metatags_interval', 10));
    $("#bss-network-settings").append(JSPLib.menu.renderTextinput('random_reseed_interval', 10));
    $("#bss-filter-settings").append(JSPLib.menu.renderCheckbox('show_deleted_enabled'));
    $("#bss-filter-settings").append(JSPLib.menu.renderCheckbox('show_favorites_enabled'));
    $("#bss-cache-controls").append(JSPLib.menu.renderLinkclick('cache_info', true));
    $("#bss-cache-controls").append(CACHE_INFO_TABLE);
    $("#bss-cache-controls").append(JSPLib.menu.renderLinkclick('purge_cache', true));
    $("#bss-cache-controls").append(JSPLib.menu.renderLinkclick('reset_query_data', true));
    $("#bss-cache-editor-controls").append(JSPLib.menu.renderKeyselect('data_source', true));
    $("#bss-cache-editor-controls").append(JSPLib.menu.renderDataSourceSections());
    $("#bss-section-indexed-db").append(JSPLib.menu.renderKeyselect('data_type', true));
    $("#bss-section-local-storage").append(JSPLib.menu.renderCheckbox('raw_data', true));
    $("#bss-cache-editor-controls").append(JSPLib.menu.renderTextinput('data_name', 20, true));
    JSPLib.menu.engageUI(true);
    $('.bss-selectors[data-setting=profile_thumb_source] input').checkboxradio('disable');
    JSPLib.menu.saveUserSettingsClick();
    JSPLib.menu.resetUserSettingsClick(localstorage_keys);
    JSPLib.menu.cacheInfoClick();
    JSPLib.menu.purgeCacheClick();
    ResetQueryDataClick();
    JSPLib.menu.dataSourceChange();
    JSPLib.menu.rawDataChange();
    JSPLib.menu.getCacheClick();
    JSPLib.menu.saveCacheClick(ValidateProgramData, ValidateEntry);
    JSPLib.menu.deleteCacheClick();
    JSPLib.menu.cacheAutocomplete();
}

//Main function
async function Main() {
    if (JSPLib.utility.getMeta('current-user-name') === "Anonymous") {
        Main.debuglog("User must log in!");
        return;
    }
    Danbooru.BSS = BSS = {
        controller: document.body.dataset.controller,
        action: document.body.dataset.action,
        dirty: false,
        is_enabled: JSPLib.menu.isScriptEnabled(),
        settings_config: SETTINGS_CONFIG,
        control_config: CONTROL_CONFIG,
        channel: JSPLib.utility.createBroadcastChannel(PROGRAM_NAME, BSSBroadcast)
    };
    Object.assign(BSS, {
        is_post_index: BSS.controller === "posts" && BSS.action === "index",
        is_searches_index: BSS.controller === "saved-searches" && BSS.action === "index",
        user_settings: JSPLib.menu.loadUserSettings(),
    });
    if (JSPLib.danbooru.isSettingMenu()) {
        JSPLib.menu.loadStorageKeys();
        JSPLib.utility.installScript(JQUERY_TAB_WIDGET_URL).done(()=>{
            JSPLib.menu.installSettingsMenu();
            RenderSettingsMenu();
        });
    }
    if (!BSS.is_enabled) {
        Main.debuglog("Script is disabled on", window.location.hostname);
        return;
    }
    Object.assign(BSS, {
        user_limit: MaximumTagQueryLimit(),
        tab_id: GetTabID(),
        seed_rate: GetSeedRate(),
        timeout_expires: GetRecheckExpires(),
        search_posts: JSPLib.storage.checkStorageData('bss-search-posts',ValidateProgramData,sessionStorage,[]),
    });
    if (BSS.controller === "posts") {
        if (location.search) {
            let parse = JSPLib.utility.parseParams(location.href.split('?')[1]);
            BSS.active_query = parse.bss;
            BSS.query_type = parse.bss_type;
            BSS.page = parseInt(parse.p);
            BSS.opening_tab = parseInt(parse.tab);
        }
        if (BSS.active_query) {
            BSS.deferred_search = $.Deferred();
            if (BSS.query_type === "click" && !('bss-search-posts' in sessionStorage)) {
                BSS.channel.postMessage({type:"search_query",tx_tab:BSS.tab_id,rx_tab:BSS.opening_tab});
            } else {
                BSS.deferred_search.resolve(true);
            }
        }
    }
    //Render the barebones HTML early on
    if (BSS.is_post_index) {
        Main.debuglog("Adding user interface!");
        $("#tag-box").before(saved_search_box);
        if (!JSPLib.storage.checkStorageData('bss-hide-saved-searches',ValidateProgramData,localStorage,false)) {
            $("#bss-message").show();
        }
        if (BSS.active_query === "all") {
            $("#bss-saved-search-box > h1 > .bss-link").css("background-color","#DDD");
        }
        JSPLib.utility.setCSSStyle(post_css,'program');
    } else if (BSS.is_searches_index) {
        $("#nav menu:last-of-type").append(refresh_link);
        $(".striped").after(add_search_form);
        AutocompleteRecheck();
        RefreshLinkClick();
        SubmitNewQueryClick();
        JSPLib.utility.setCSSStyle(search_css,'program');
    }
    //Load and/or process the data
    if ((JSPLib.concurrency.checkTimeout('bss-timeout',BSS.timeout_expires) || WasOverflow()) && JSPLib.concurrency.reserveSemaphore('bss')) {
        await Timer.LoadBSSEntries();
        BSS.initialized = Boolean(BSS.entries.length);
        if (!BSS.initialized) {
            await CheckUserSavedSearches(true);
        }
        //Main execution portion
        await InitialPass();
        await SecondaryPass();
        await Promise.all([
            RandomQueryRecheck(),
            DailyMetatagRecheck()
        ]);
        //Save data
        await StoreBSSEntries();
        JSPLib.concurrency.setRecheckTimeout('bss-timeout',BSS.timeout_expires);
        JSPLib.concurrency.freeSemaphore('bss');
    } else if (BSS.controller === "posts" || BSS.is_searches_index) {
        await Timer.LoadBSSEntries();
        BSS.initialized = Boolean(BSS.entries.length);
    }
    //Initialize UI after getting data
    if (BSS.is_post_index) {
        Timer.InitializeUI();
        if (BSS.active_query) {
            PaginatePostIndex();
            InitializeIndexThumbnails();
        }
    } else if (BSS.controller === "posts" && BSS.action === "show" && BSS.active_query) {
        SequentializePostShow();
    }
    JSPLib.statistics.addPageStatistics(PROGRAM_NAME);
    //Take care of other non-critical tasks at a later time
    setTimeout(()=>{
        JSPLib.utility.initializeInterval(()=>{
            JSPLib.concurrency.setRecheckTimeout('bss-heartbeat', heartbeat_timeout, sessionStorage);
        },JSPLib.utility.one_minute);
        CheckUserSavedSearches().then(()=>{
            Timer.NormalizeBSSEntries();
        });
        JSPLib.storage.pruneEntries('bss', PROGRAM_DATA_REGEX, prune_expires);
    }, noncritical_recheck);
}

/****Function decoration****/

JSPLib.debug.addFunctionTimers(Timer,false,[
    InitializeUI,RecalculateTree,ProcessPosts
]);

JSPLib.debug.addFunctionTimers(Timer,true,[
    LoadBSSEntries,NormalizeBSSEntries
]);

JSPLib.debug.addFunctionLogs([
    Main,BSSBroadcast,InitializeUI,CheckUserSavedSearches,DailyMetatagRecheck,RandomQueryRecheck,SecondaryPass,InitialPass,
    NormalizeBSSEntries,SeedQuery,StoreBSSEntries,ValidateEntry,RemoveDuplicateBSSEntries,ReplacePoolNamesWithIDs,UnaliasBSSEntries,
    UpdateQuery,BSSLinkHover,ResetClick,ClearClick,SearchClick,QueryTagAliases,RecalculateLine,RecalculateTree,
    LoadBSSEntries,CorrectQueries
]);

/****Initialization****/

//Variables for debug.js
JSPLib.debug.debug_console = false;
JSPLib.debug.pretext = "BSS:";
JSPLib.debug.pretimer = "BSS-";
JSPLib.debug.level = JSPLib.debug.INFO;

//Variables for menu.js
JSPLib.menu.program_shortcut = PROGRAM_SHORTCUT;
JSPLib.menu.program_name = PROGRAM_NAME;
JSPLib.menu.program_data_regex = PROGRAM_DATA_REGEX;
JSPLib.menu.program_data_key = OptionCacheDataKey;
JSPLib.menu.settings_callback = RemoteSettingsCallback;
JSPLib.menu.reset_callback = RemoteResetCallback;
JSPLib.menu.disable_callback = RemoteDisableCallback;

//Variables for utility.js
JSPLib.utility.max_column_characters = 15;

//Variables for network.js
JSPLib.network.counter_domname = "#bss-initialize-counter";

//Variables for danbooru.js
JSPLib.danbooru.max_network_requests = 10;

//Export JSPLib
if (JSPLib.debug.debug_console) {
    window.JSPLib.lib = window.JSPLib.lib || {};
    window.JSPLib.lib[PROGRAM_NAME] = JSPLib;
}

/****Execution start****/

JSPLib.load.programInitialize(Main,'BSS',program_load_required_variables,program_load_required_selectors);
