// ==UserScript==
// @name         BetterSavedSearches
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      5.3
// @source       https://danbooru.donmai.us/users/23799
// @description  Provides an alternative mechanism and UI for saved searches
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/bettersavedsearches.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.5.2/localforage.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.12.0/validate.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190530/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190530/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190530/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190530/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190530/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190530/lib/concurrency.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190530/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190530/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190530/lib/menu.js
// ==/UserScript==

//Variables for debug.js
JSPLib.debug.debug_console = true;
JSPLib.debug.pretext = "BSS:";
JSPLib.debug.pretimer = "BSS-";
JSPLib.debug.level = JSPLib.debug.INFO;

//Variables for utility.js
JSPLib.utility.max_column_characters = 15;

//Variables for danbooru.js
JSPLib.danbooru.counter_domname = "#bss-initialize-counter";
JSPLib.danbooru.max_network_requests = 10;

//Variables for load.js
const program_load_required_variables = ['window.jQuery','window.Danbooru'];
const program_load_required_selectors = ['#page'];

//Main program variable
var BSS;

//Timer function hash
var Timer = {};

//Regexes that match all program data
const purge_cache_regex = /(ta|plid|plname)-/;
const program_cache_regex = /(ta|plid|plname|bss)-/;

//Main program expires
const prune_expires = JSPLib.utility.one_day;

//For factory reset
const localstorage_keys = [];
const program_reset_keys = {};

//For cache editor
const all_source_types = ['indexed_db','local_storage'];
const all_data_types = ['tag_alias','pool_id','pool_name','program_data','custom'];
const reverse_data_key = {
    tag_alias: 'ta',
    pool_id: 'plid',
    pool_name: 'plname',
    program_data: 'bss'
};

//Available setting values
const profile_thumb_types = ['danbooru','script','both'];

//Main settings
const settings_config = {
    main_script_enabled: {
        default: true,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Allows the script to be turned on/off for different subdomains."
    },
    profile_thumb_source: {
        allitems: profile_thumb_types,
        default: ['danbooru'],
        validate: (data)=>{return Array.isArray(data) && data.length === 1 && profile_thumb_types.includes(data[0])},
        hint: "Select which source to get thumbnails from on the profile page."
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

//CSS constants

const post_css = `
#bss-saved-search-box {
    width: 200px;
}
#bss-message {
    font-size: 200%;
    margin: 10px;
}
.bss-clear {
    color: red;
    font-weight: bold;
}
.bss-reset {
    margin-left: -5px;
}
.bss-disabled > .bss-link {
    text-decoration: underline;
}
.bss-active > .bss-link {
    font-weight: bold;
}
.bss-metatags > .bss-link {
    color: green;
}`
const search_css = `
#bss-new-saved-search #saved_search_query {
    max-width: unset;
}
#bss-refresh-saved-searches a {
    color: green;
}
`;

const profile_css = `
.bss-search-header {
    margin-left: 1em;
}
.bss-search-header .bss-link {
    color: #0073ff;
}
.bss-search-header .bss-link:hover {
    color: #80b9ff;
}
.bss-profile-load {
    color: grey;
    margin-left: 0.5em
}
`;

//HTML constants

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
        <span style="font-weight:bold">Last updated:</span>
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
            <input type="text" id="saved_search_label_string" size="40">
            <span class="hint">A list of tags to help categorize this search. Space delimited.</span>
        </div>
        <button type="button" class="ui-button ui-corner-all ui-widget">Submit</button>
    </form>`;

const bss_menu = `
<div id="bss-script-message" class="prose">
    <h2>BetterSavedSearches</h2>
    <p>Check the forum for the latest on information and updates (<a class="dtext-link dtext-id-link dtext-forum-topic-id-link" href="/forum_topics/15462">topic #15462</a>).</p>
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
        <div id="bss-cache-settings" class="jsplib-settings-grouping">
            <div id="bss-cache-message" class="prose">
                <h4>Cache settings</h4>
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
const html_query_size = 500;
const api_query_size = 100;
const timer_poll_interval = 100;

//Main function expires
const saved_search_expires = JSPLib.utility.one_day;
const normalize_expires = JSPLib.utility.one_week;

//Data expires
const pool_data_expires = JSPLib.utility.one_month;
const alias_data_expires =JSPLib.utility.one_month;

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
const META_TAGS = new RegExp('^(commenter|comm|noter|noteupdater|artcomm|ordpool|' +
                    '-?favgroup|-?fav|ordfav|md5|-?locked|width|height|mpixels|' +
                    'ratio|score|favcount|filesize|-?source|-?id|date|age|order|limit|' +
                    '-?approver|tagcount|pixiv_id|pixiv|search|upvote|downvote|' +
                    '-?flagger|-?appealer|gentags|chartags|copytags|arttags|metatags):(.+)$','i');

const FREE_TAGS = /$(-?status:deleted|rating:s.*|limit:.+)$/i

//Validation constants

const basic_integer_validator = {
    func: Number.isInteger,
    type: "integer"
};
const basic_stringonly_validator = {
    func: JSPLib.validate.isString,
    type: "string"
};

const query_constraints = {
    queries: JSPLib.validate.array_constraints,
    queryentry: {
        id: JSPLib.validate.integer_constraints,
        tags: JSPLib.validate.stringonly_constraints,
        original: JSPLib.validate.stringnull_constraints,
        checked: JSPLib.validate.integer_constraints,
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
        posts: basic_integer_validator,
        unseen: basic_integer_validator,
        labels: basic_stringonly_validator,
    }
};

const relation_constraints = {
    entry: JSPLib.validate.arrayentry_constraints(),
    value: basic_stringonly_validator
};

const pool_constraints = {
    entry: JSPLib.validate.hashentry_constraints,
    value: {
        id: JSPLib.validate.integer_constraints,
        name: JSPLib.validate.stringonly_constraints
    }
};

const posttime_constraints = {
    id: JSPLib.validate.integer_constraints,
    created: JSPLib.validate.integer_constraints
}

/****FUNCTIONS****/

//Validate functions

function ValidateEntry(key,entry) {
    if (!JSPLib.validate.validateIsHash(key, entry)) {
        return false;
    }
    if (key.match(/^ta-/)) {
        return ValidateRelationEntry(key, entry);
    } else if (key.match(/^(plid|plname)-/)) {
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
    } else {
        CorrectQueries.debuglog("Query data is valid.");
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
        case 'bss-queries':
            return ValidateQueries(key,entry);
        case 'bss-secondary-pass':
            return ValidatePostTimeEntry(key,entry);
        case 'bss-user-settings':
            checkerror = JSPLib.menu.validateUserSettings(entry,settings_config);
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
            return JSPLib.validate.validateArrayValues(key,entry,basic_integer_validator);
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

JSPLib.danbooru.getShowID = function() {
    return (document.body.dataset.action === "show" ? parseInt(window.location.pathname.match(/\d+$/)[0]) : 0);
};

JSPLib.utility.getUniqueID = function() {
    return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
};

JSPLib.utility.isScrolledIntoView = function(elem) {
    let docViewTop = $(window).scrollTop();
    let docViewBottom = docViewTop + $(window).height();
    let elemTop = $(elem).offset().top;
    let elemBottom = elemTop + $(elem).height();
    return ((elemBottom <= docViewBottom) && (elemTop >= docViewTop));
};

JSPLib.validate.validateArrayValues = function(key,array,validator) {
    let invalid_items = array.map((item,i)=>{return (validator.func(item) ? undefined : [i,item]);}).filter(Array.isArray);
    if (invalid_items.length) {
        invalid_items.forEach((entry)=>{
            let display_key = `${key}[${entry[0]}]:`;
            let display_item = JSON.stringify(entry[1]);
            JSPLib.debug.debuglog(display_key,`${display_item} is not a valid ${validator.type}!`);
        });
        return false;
    }
    return true;
};

JSPLib.validate.correctArrayValues = function(key,array,validator) {
    let error_messages = [];
    for (let i = array.length - 1; i >= 0; i--) {
        if (!validator.func(array[i])) {
            error_messages.push({[`${key}[${i}]`]: `${array[i]} is not a valid ${validator.type}.`});
            array.splice(i,1);
        }
    }
    return error_messages;
};

JSPLib.concurrency.checkTimeout = function (storage_key,expires_time,storage=localStorage) {
    let expires = JSPLib.storage.getStorageData(storage_key,storage,0);
    return !JSPLib.concurrency._validateExpires(expires,expires_time);
};

JSPLib.concurrency.setRecheckTimeout = function (storage_key,expires_time,storage=localStorage) {
    JSPLib.storage.setStorageData(storage_key,JSPLib.concurrency._getExpiration(expires_time),storage);
};

JSPLib.utility.setDifference = function (array1,array2) {
    let set2 = new Set(array2);
    return JSPLib.utility.setUnique(array1.filter(x => !set2.has(x)));
};

JSPLib.utility.setIntersection = function (array1,array2) {
    let set2 = new Set(array2);
    return JSPLib.utility.setUnique(array1.filter(x => set2.has(x)));
};

JSPLib.utility.isSubset = function (array1,array2) {
    let set1 = new Set(array1);
    return array2.every(x => set1.has(x));
};

JSPLib.utility.hasIntersection = function (array1,array2) {
    let set1 = new Set(array1);
    return array2.some(x => set1.has(x));
};

JSPLib.danbooru.isSettingMenu = function () {
    return document.body.dataset.controller === "users" && document.body.dataset.action === "settings";
};

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
    return JSPLib.utility.setUnique(QueryReduce((all_tags,entry)=>{return all_tags.concat(GetAllEntryTags(entry));},[]));
}

function GetAllEntryTags(entry) {
    return entry.require.concat(entry.exclude).concat(entry.optional);
}

function GetPosts(type,choose,id) {
    return NormalizePosts(QueryReduce((total_posts,entry)=>{return (choose(entry,id) ? total_posts.concat(entry[type]) : total_posts);},[]));
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
    let idstring = "id:" + PostIDString(posts,page);
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

function GetSearchPosts() {
    if ('bss-search-posts' in sessionStorage) {
        return JSPLib.storage.checkStorageData('bss-search-posts',ValidateProgramData,sessionStorage,[]);
    }
    return [];
}

function WasOverflow() {
    return JSPLib.storage.checkStorageData('bss-overflow',ValidateProgramData,localStorage,false);
}

//Storage functions

async function LoadBSSEntries() {
    if (('bss-heartbeat' in sessionStorage) && JSPLib.concurrency.checkTimeout('bss-heartbeat', JSPLib.utility.one_minute * 5, sessionStorage)) {
        LoadBSSEntries.debuglog("Window timeout detected! Removing stale data...");
        sessionStorage.removeItem('bss-queries');
    }
    BSS.entries = await JSPLib.storage.retrieveData('bss-queries');
    CorrectQueries(BSS);
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
        let checked_timestring = new Date(query.checked).toLocaleString();
        let seeded_timestring = new Date(query.seeded).toLocaleString();
        let title_string = `
 Last found: ${checked_timestring}
Last seeded: ${seeded_timestring}`.trim('\n');
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

function SetLineOptions(entry) {
    return {
        count_enabled: (entry.unseen.length ? "" : "display:none"),
        clear_enabled: (!entry.unseen.length && entry.posts.length ? "" : "display:none"),
        reset_enabled: (!entry.unseen.length && !entry.posts.length ? "" : "display:none"),
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
    <span class="bss-last-control">
        <span class="bss-count" style="${options.count_enabled}">(<a title="${entry.posts.length}">${entry.unseen.length}</a>)</span>
        <span class="bss-clear" style="${options.clear_enabled}"><a title="${entry.posts.length}">X</a></span>
        <span class="bss-reset" style="${options.reset_enabled}"><a class="ui-icon ui-icon-arrowrefresh-1-w"></a></span>
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
        let html = `<li class="numbered-page"><a href="${PostIDQuery(posts,i)}">${i}</a></li>`;
        if (i < BSS.page) {
            $(".current-page").before(html);
        } else {
            $(".arrow:last-of-type").before(html);
        }
    }
    if (first_page !== 1) {
        let html = `<li class="numbered-page"><a href="${PostIDQuery(posts,1)}">1</a></li>`;
        if (first_page > 2) {
            html += `<li class="more"><i class="fas fa-ellipsis-h"></i></li>`;
        }
        $(".arrow:first-of-type").after(html);
    }
    if (last_page !== total_pages) {
        let html = `<li class="numbered-page"><a href="${PostIDQuery(posts,total_pages)}">${total_pages}</a></li>`;
        if (last_page < (total_pages - 1)) {
            html = `<li class="more"><i class="fas fa-ellipsis-h"></i></li>` + html;
        }
        $(".arrow:last-of-type").before(html);
    }
    if (BSS.page !== 1) {
        let html = `
<a rel="prev" id="paginator-prev" data-shortcut="a left" href="${PostIDQuery(posts,BSS.page-1)}" title="Shortcut is a or left">
    <i class="fas fa-chevron-left"></i>
</a>`;
        $(".arrow:first-of-type").html(html);
    }
    if (BSS.page !== total_pages) {
        let html = `
<a rel="next" id="paginator-next" data-shortcut="d right" href="${PostIDQuery(posts,BSS.page + 1)}" title="Shortcut is d or right">
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
    SearchClick(".bss-label-query > span > .bss-count a",3,'unseen',ChooseLabel);
    ClearClick(".bss-label-query > span > .bss-clear a",3,ChooseLabel);
    ResetClick(".bss-label-query > span > .bss-reset a",3,ChooseLabel);
    SearchClick(".bss-detailed-query .bss-link",1,'posts',ChooseID);
    SearchClick(".bss-detailed-query .bss-count a",3,'unseen',ChooseID);
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
    if (entry.checked) {
        $(`.${classname}[data-id=${entry.id}] > .ui-icon-calendar`).attr('title',new Date(entry.checked).toLocaleString());
    }
    $(`.${classname}[data-id=${entry.id}] > span > .bss-count a`).html(entry.unseen.length);
    $(`.${classname}[data-id=${entry.id}] > span > .bss-count a`).attr('title',entry.posts.length);
    $(`.${classname}[data-id=${entry.id}] > span > .bss-clear a`).attr('title',entry.posts.length);
    $(`.${classname}[data-id=${entry.id}] > .bss-last-control > span`).hide();
    let show_control = 'bss-count';
    if (!entry.unseen.length && entry.posts.length) {
        show_control = 'bss-clear';
    } else if (!entry.unseen.length && !entry.posts.length) {
        show_control = 'bss-reset';
    }
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

function RefreshLinkCount() {
    let program_queries = BSS.entries.map((entry)=>{return (entry.original ? entry.original : entry.tags);});
    let actual_queries = $(".striped td:first-of-type a").map((i,entry)=>{return entry.innerText;}).toArray();
    let query_difference = JSPLib.utility.setSymmetricDifference(program_queries,actual_queries);
    RefreshLinkCount.debuglog(query_difference);
    $("#bss-refresh-count").html(query_difference.length);
}

////#C-USERS #A-SHOW

function InitializeProfilePage() {
    switch (BSS.user_settings.profile_thumb_source[0]) {
        case "script":
            $(".user-saved-search .box:first-of-type").hide();
        case "both":
            $(".user-saved-search .box").prepend(`<h4 class="bss-search-header">Danbooru</h4>`).css('margin-bottom',"0");
            CheckSearchVisibility();
            LoadProfilePostsInterval.timer = JSPLib.utility.initializeInterval(LoadProfilePostsInterval, JSPLib.utility.one_second);
            $(window).on('scroll.bss',(event)=>{CheckSearchVisibility();});
        case "danbooru":
        default:
            //Do nothing
    }
}

//Alias functions

async function QueryTagAlias(tag) {
    let consequent = [];
    let entryname = 'ta-' + tag;
    let storeditem = await JSPLib.storage.checkLocalDB(entryname,ValidateEntry);
    if (!storeditem) {
        QueryTagAlias.debuglog("Querying alias:",tag);
        let url_addons = {search: {antecedent_name: tag, status: 'active'}, only: alias_field};
        let data = await JSPLib.danbooru.submitRequest('tag_aliases', url_addons,[],entryname);
        if (data.length) {
            //Alias antecedents are unique, so no need to check the size
            QueryTagAlias.debuglog("Alias:",tag,data[0].consequent_name);
            consequent = [data[0].consequent_name];
        }
        JSPLib.storage.saveData(entryname,{value: consequent, expires: JSPLib.utility.getExpiration(alias_data_expires)});
    } else {
        consequent = storeditem.value;
        if (consequent.length) {
            QueryTagAlias.debuglog("Alias:",tag,consequent[0]);
        }
    }
    return {[tag]: consequent};
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
            JSPLib.storage.saveData('plname-' + data.name, {value: data, expires: JSPLib.utility.getExpiration(pool_data_expires)});
        } else {
            data = {id: poolid, name: "XXXXXXXX"};
        }
        JSPLib.storage.saveData(key, {value: data, expires: JSPLib.utility.getExpiration(pool_data_expires)});
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
            JSPLib.storage.saveData('plid-' + data.id, {value: data, expires: JSPLib.utility.getExpiration(pool_data_expires)});
        } else {
            data = {id: 0, name: poolname};
        }
        JSPLib.storage.saveData(key, {value: data, expires: JSPLib.utility.getExpiration(pool_data_expires)});
        return data;
    }
}

//Event handlers

////#C-POSTS #A-INDEX

function SearchClick(selector,level,posttype,choosepost) {
    $(selector).on('click.bss',async (event)=>{
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
    $(selector).on('click.bss',async (event)=>{
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
    $(selector).on('click.bss',async (event)=>{
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
    $("#bss-reset-position").on('click.bss',(event)=>{
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
    $(".collapsible-saved-search-links").on('click.bss',(event)=>{
        let label = $(event.target.parentElement).data('id');
        $(event.target).toggleClass("ui-icon-triangle-1-e ui-icon-triangle-1-s");
        $(`.bss-label-query[data-id=${label}] > ul`).slideToggle(100);
    });
}

function MainToggle() {
    $("#toggle-bss-saved-searches").on('click.bss',(event)=>{
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
    $("#bss-refresh-saved-searches a").on('click.bss',async (event)=>{
        if (!RefreshLinkClick.reserved) {
            RefreshLinkClick.reserved = true;
            JSPLib.utility.fullHide("#bss-refresh-saved-searches");
            JSPLib.utility.clearHide("#bss-loading-saved-searches");
            await CheckUserSavedSearches(true);
            await Timer.NormalizeBSSEntries(true);
            StoreBSSEntries();
            RefreshLinkCount();
            JSPLib.utility.fullHide("#bss-loading-saved-searches");
            JSPLib.utility.clearHide("#bss-refresh-saved-searches");
            Danbooru.Utility.notice("Saved searches updated.");
            RefreshLinkClick.reserved = false;
        }
        event.preventDefault();
    });
}

function SubmitNewQueryClick() {
    $("#bss-new-saved-search button").on('click.bss',async (event)=>{
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
        SubmitDeleteClick();
        RefreshLinkCount();
        Danbooru.Utility.notice(`Saved search "${saved_search.query}" has been added.`);
    });
}

function SubmitDeleteClick() {
    //Add an extra event to the Delete click
    $(".striped [data-method=delete]").off('click.bss').on('click.bss',(event)=>{
        let current_rows = $(".striped tbody tr").length;
        JSPLib.utility.rebindTimer({
            check: ()=>{return $(".striped tbody tr").length < current_rows;},
            exec: ()=>{RefreshLinkCount();}
        },timer_poll_interval);
    });
}

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
        checked: 0,
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

function UpdateQuery(post,query) {
    UpdateQuery.debuglog(post.id,query);
    query.posts = NormalizePostsSlice(query.posts.concat(post.id));
    query.unseen = NormalizePostsSlice(query.unseen.concat(post.id));
    query.checked = Date.now();
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
            if (query.metatags) {
                SeedQuery.debuglog("Metatag merge:", query.tags);
                let diff_index = post_ids.indexOf(query.posts[0]);
                //Assumes that own order is consistent with metatags search
                query.unseen = (diff_index >=0 ? post_ids.slice(0, diff_index) : post_ids);
                SeedQuery.debuglog("Unseen posts:", query.unseen);
                query.posts = JSPLib.utility.setUnion(query.unseen, query.posts).slice(0, BSS.user_settings.saved_search_size);
            } else {
                let post_range = query.posts.filter((postid)=>{return ((postid <= post_ids[0]) && (postid >= post_ids[post_ids.length - 1]));});
                let false_positives = JSPLib.utility.setDifference(post_range,post_ids);
                let false_negatives = JSPLib.utility.setDifference(post_ids,post_range);
                SeedQuery.debuglog("Merge:",query.tags);
                SeedQuery.debuglog("False positives:",false_positives);
                SeedQuery.debuglog("False negatives:",false_negatives);
                if (false_positives.length) {
                    query.unseen = NormalizePosts(JSPLib.utility.setDifference(query.unseen,false_positives));
                    query.posts = NormalizePosts(JSPLib.utility.setDifference(query.posts,false_positives));
                }
                if (false_negatives.length) {
                    query.unseen = NormalizePostsSlice(query.unseen.concat(false_negatives));
                    query.posts = NormalizePostsSlice(query.posts.concat(false_negatives));
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
            query.expires = JSPLib.utility.getExpiration(expires_interval + expires_window);
        }
    } else {
        //Disable invalid queries
        query.unseen = [];
        query.posts = [];
        query.disabled = true;
    }
    query.checked = Date.now();
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
    let url_addons = {search: {name: all_tags.join(','), hide_empty: 'yes'}, only: tag_fields};
    let query_tags = await JSPLib.danbooru.getAllItems('tags', api_query_size, {addons: url_addons});
    let found_tags = JSPLib.utility.getObjectAttributes(query_tags,'name');
    let alias_entries = found_tags.map((tag)=>{return {[tag]: []};});
    let missing_tags = JSPLib.utility.setDifference(all_tags,found_tags);
    if (missing_tags.length) {
        let network_aliases = await Promise.all(missing_tags.map((tag)=>{return QueryTagAlias(tag);}))
        alias_entries = alias_entries.concat(network_aliases);
    }
    //Convert array of hashes into one hash
    let tag_aliases = alias_entries.reduce((a,b)=>{return Object.assign(a,b);});
    let change_tags = missing_tags.reduce((changes,tag)=>{return (tag != GetLastConsequent(tag,tag_aliases) ? changes.concat(tag) : changes);},[]);
    if (!change_tags.length) {
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
                entry_a.unseen = NormalizePosts(entry_a.unseen.concat(entry_b.unseen));
                entry_a.posts = NormalizePosts(entry_a.posts.concat(entry_b.posts));
                entry_b.duplicate = true;
            }
        }
    }
}

//Post helper functions

function ProcessPosts(posts) {
    let all_tags = GetAllTags();
    posts.forEach((post)=>{
        let post_tags = GeneratePostTags(post);
        if (JSPLib.utility.hasIntersection(all_tags,post_tags)) {
            QueryIterator((query)=>{
                if (query.metatags || query.posts.includes(post.id)) {
                    return;
                }
                if (CheckPost(post_tags,query)) {
                    UpdateQuery(post,query);
                }
            });
        }
    });
}

function GeneratePostTags(post) {
    let tags = [post.tag_string,post.pool_string].join(' ').match(/\S+/g) || [];
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

function NormalizePosts(postids) {
    return JSPLib.utility.setUnique(postids).sort(function(a, b){return b - a});
}

function NormalizePostsSlice(postids) {
    return NormalizePosts(postids).slice(0,BSS.user_settings.saved_search_size);
}

function PostIDString(postids,page) {
    let page_start = (page ? (page - 1) * BSS.user_settings.query_size : 0);
    let page_end = (page ? page * BSS.user_settings.query_size: html_query_size);
    return postids.slice(page_start,page_end).join(',');
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
        options.addons.tags = `id:${pageid}..${pageid+199}`;
    }
    InitialPass.debuglog("Network:",pageid);
    let posts = await JSPLib.danbooru.getAllItems('posts', api_query_size, options);
    if (posts.length === 199) {
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
        let process_ids = NormalizePostsSlice(JSPLib.utility.getObjectAttributes(process_posts,'id'));
        let options = {addons: {tags: "id:" + PostIDString(process_ids), only: post_fields}};
        SecondaryPass.debuglog("Network:",process_ids);
        let posts = await JSPLib.danbooru.getAllItems('posts', api_query_size, options);
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
        let saved_searches = await JSPLib.danbooru.submitRequest('saved_searches',[]);
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
        return `${reverse_data_key[data_type]}-${data_value}`;
    }
}

//Settings functions

function BSSBroadcast(ev) {
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
            break;
        case "reset":
            Object.assign(BSS,program_reset_keys);
        case "settings":
            BSS.user_settings = ev.data.user_settings;
            BSS.is_setting_menu && JSPLib.menu.updateUserSettings('bss');
            break;
        case "purge":
            Object.keys(sessionStorage).forEach((key)=>{
                if (key.match(program_cache_regex)) {
                    sessionStorage.removeItem(key);
                }
            });
        default:
            //do nothing
    }
}

function MaximumTagQueryLimit() {
    if ($("body").data('user-is-platinum')) {
        return 12;
    } else if ($("body").data('user-is-gold')) {
        return 6;
    } else {
        return 2;
    }
}

function RenderSettingsMenu() {
    $("#better-saved-searches").append(bss_menu);
    $("#bss-general-settings").append(JSPLib.menu.renderCheckbox("bss",'main_script_enabled'));
    $("#bss-general-settings").append(JSPLib.menu.renderInputSelectors("bss",'profile_thumb_source','radio'));
    $("#bss-post-settings").append(JSPLib.menu.renderTextinput("bss",'seed_size',10));
    $("#bss-post-settings").append(JSPLib.menu.renderTextinput("bss",'query_size',10));
    $("#bss-post-settings").append(JSPLib.menu.renderTextinput("bss",'saved_search_size',10));
    $("#bss-network-settings").append(JSPLib.menu.renderTextinput("bss",'recheck_interval',10));
    $("#bss-network-settings").append(JSPLib.menu.renderTextinput("bss",'metatags_interval',10));
    $("#bss-network-settings").append(JSPLib.menu.renderTextinput("bss",'random_reseed_interval',10));
    $("#bss-filter-settings").append(JSPLib.menu.renderCheckbox("bss",'show_deleted_enabled'));
    $("#bss-filter-settings").append(JSPLib.menu.renderCheckbox("bss",'show_favorites_enabled'));
    $("#bss-cache-settings").append(JSPLib.menu.renderLinkclick("bss",'cache_info',"Cache info","Click to populate","Calculates the cache usage of the program and compares it to the total usage."));
    $("#bss-cache-settings").append(`<div id="bss-cache-info-table" style="display:none"></div>`);
    $("#bss-cache-settings").append(JSPLib.menu.renderLinkclick("bss",'purge_cache',`Purge cache (<span id="bss-purge-counter">...</span>)`,"Click to purge","Dumps all of the cached data related to DisplayPostInfo."));
    $("#bss-cache-settings").append(JSPLib.menu.renderLinkclick("bss",'reset_program_data',"Reset program data","Click to reset",`<span style="color:red"><b>Warning!</b></span> The program will have to reinitialize, including reseeding all saved searches.`));
    $("#bss-cache-editor-controls").append(JSPLib.menu.renderKeyselect('bss','data_source',true,'indexed_db',all_source_types,"Indexed DB is <b>Cache Data</b> and Local Storage is <b>Program Data</b>."));
    $("#bss-cache-editor-controls").append(JSPLib.menu.renderKeyselect('bss','data_type',true,'tag_data',all_data_types,"Only applies to Indexed DB.  Use <b>Custom</b> for querying by keyname."));
    $("#bss-cache-editor-controls").append(JSPLib.menu.renderTextinput('bss','data_name',20,true,"Click <b>Get</b> to see the data, <b>Save</b> to edit it, and <b>Delete</b> to remove it.",['get','save','delete']));
    JSPLib.menu.engageUI('bss',true);
    JSPLib.menu.saveUserSettingsClick('bss','BetterSavedSearches');
    JSPLib.menu.resetUserSettingsClick('bss','BetterSavedSearches',localstorage_keys,program_reset_keys);
    JSPLib.menu.purgeCacheClick('bss','BetterSavedSearches',purge_cache_regex,"#bss-purge-counter");
    JSPLib.menu.purgeCacheClick('bss','BetterSavedSearches',/bss-queries/);
    JSPLib.menu.cacheInfoClick('bss',program_cache_regex,"#bss-cache-info-table");
    JSPLib.menu.getCacheClick('bss',OptionCacheDataKey);
    JSPLib.menu.saveCacheClick('bss',()=>{return false;},ValidateEntry,OptionCacheDataKey);
    JSPLib.menu.deleteCacheClick('bss',OptionCacheDataKey);
    JSPLib.menu.cacheAutocomplete('bss',program_cache_regex,OptionCacheDataKey);
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
        user_limit: MaximumTagQueryLimit(),
        search_posts: GetSearchPosts(),
        tab_id: GetTabID(),
        seed_rate: GetSeedRate(),
        is_setting_menu: JSPLib.danbooru.isSettingMenu(),
        storage_keys: {indexed_db: [], local_storage: []},
        settings_config: settings_config,
        channel: new BroadcastChannel('BetterSavedSearches')
    };
    Object.assign(BSS, {
        is_post_index: BSS.controller === "posts" && BSS.action === "index",
        is_post_show: BSS.controller === "posts" && BSS.action === "show",
        is_searches: BSS.controller === "saved-searches" && BSS.action === "index",
        is_profile_page: BSS.controller === "users" && BSS.action === "show" && parseInt(JSPLib.utility.getMeta('current-user-id')) === JSPLib.danbooru.getShowID(),
        user_settings: JSPLib.menu.loadUserSettings('bss')
    });
    if (BSS.is_setting_menu) {
        JSPLib.validate.dom_output = "#bss-cache-editor-errors";
        JSPLib.menu.loadStorageKeys('bss',program_cache_regex);
        JSPLib.utility.installScript("https://cdn.jsdelivr.net/gh/jquery/jquery-ui@1.12.1/ui/widgets/tabs.js").done(()=>{
            JSPLib.menu.installSettingsMenu("BetterSavedSearches");
            RenderSettingsMenu();
        });
    }
    if (!BSS.user_settings.main_script_enabled) {
        Main.debuglog("Script is disabled!");
        return;
    }
    BSS.timeout_expires = BSS.user_settings.recheck_interval * JSPLib.utility.one_minute;
    BSS.channel.onmessage = BSSBroadcast;
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
        RefreshLinkClick();
        SubmitNewQueryClick();
        SubmitDeleteClick();
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
    } else if (BSS.controller === "posts" || BSS.is_searches_index || BSS.is_profile_page) {
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
    } else if (BSS.is_searches_index) {
        RefreshLinkCount();
    } else if (BSS.is_post_show && BSS.active_query) {
        SequentializePostShow();
    } else if (BSS.is_profile_page) {
        InitializeProfilePage();
        JSPLib.utility.setCSSStyle(profile_css,'program');
    }
    //Take care of other non-critical tasks at a later time
    setTimeout(()=>{
        JSPLib.utility.initializeInterval(()=>{
            JSPLib.concurrency.setRecheckTimeout('bss-heartbeat', JSPLib.utility.one_minute * 5, sessionStorage);
        },JSPLib.utility.one_minute);
        CheckUserSavedSearches().then(()=>{
            Timer.NormalizeBSSEntries();
        });
        JSPLib.storage.pruneEntries('bss',purge_cache_regex,prune_expires);
    },JSPLib.utility.one_minute);
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
    UpdateQuery,BSSLinkHover,ResetClick,ClearClick,SearchClick,QueryTagAlias,RefreshLinkCount,RecalculateLine,RecalculateTree,
    LoadBSSEntries,CorrectQueries
]);

/****Execution start****/

JSPLib.load.programInitialize(Main,'BSS',program_load_required_variables,program_load_required_selectors);
