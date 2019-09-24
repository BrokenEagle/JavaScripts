// ==UserScript==
// @name         IndexedAutocomplete
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      25.1
// @source       https://danbooru.donmai.us/users/23799
// @description  Uses indexed DB for autocomplete
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/indexedautocomplete.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.5.2/localforage.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.12.0/validate.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.4.4/lz-string.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190530/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190530/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190530/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190530/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190530/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190530/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190530/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190530/lib/menu.js
// ==/UserScript==

/* global $ Danbooru JSPLib validate LZString */

/****Global variables****/

//Variables for debug.js
JSPLib.debug.debug_console = false;
JSPLib.debug.pretext = "IAC:";
JSPLib.debug.pretimer = "IAC-";
JSPLib.debug.level = JSPLib.debug.INFO;

//Variables for load.js
const program_load_required_variables = ['window.jQuery','window.Danbooru','Danbooru.Autocomplete','Danbooru.RelatedTag'];
const program_load_required_selectors = ['#top','#page'];

//Main program variable
var IAC;

//Timer function hash
const Timer = {};

//Regex that matches the prefix of all program cache data
const program_cache_regex = /^(af|ref|ac|pl|us|fg|ss|ar|wp|ft|rt(gen|char|copy|art)?)-/;

//Main program expires
const prune_expires = JSPLib.utility.one_day;
const noncritical_recheck = JSPLib.utility.one_minute;

//For factory reset
const localstorage_keys = [
    'iac-prune-expires',
    'iac-choice-info'
];
const program_reset_keys = {
    choice_order:{},
    choice_data:{}
};

//Available setting values
const tag_sources = ['metatag','exact','prefix','alias','correct'];
const scale_types = ['linear','square_root','logarithmic'];

//Main settings
const settings_config = {
    prefix_check_enabled: {
        default: true,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Check the prefix/acronym of a tag for a match. Limited to prefixes of length 2-4."
    },
    usage_multiplier: {
        default: 0.9,
        parse: parseFloat,
        validate: (data)=>{return JSPLib.validate.isNumber(data) && data >= 0.0 && data <= 1.0;},
        hint: "Valid values: 0.0 - 1.0."
    },
    usage_maximum: {
        default: 20,
        parse: parseFloat,
        validate: (data)=>{return JSPLib.validate.isNumber(data) && data >= 0.0;},
        hint: "Set to 0 for no maximum."
    },
    usage_expires: {
        default: 2,
        parse: parseInt,
        validate: (data)=>{return Number.isInteger(data) && data > 0;},
        hint: "Number of days."
    },
    usage_enabled: {
        default: true,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Uncheck to turn off usage mechanism."
    },
    alternate_sorting_enabled: {
        default: false,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Check to use alternate weights and/or scales for sorting calculations."
    },
    postcount_scale: {
        allitems: scale_types,
        default: ['linear'],
        validate: (data)=>{return Array.isArray(data) && data.length === 1 && scale_types.includes(data[0])},
        hint: "Select the type of scaling to be applied to the post count."
    },
    exact_source_weight: {
        default: 1.0,
        parse: parseFloat,
        validate: (data)=>{return JSPLib.validate.isNumber(data) && data >= 0.0 && data <= 1.0;},
        hint: "Valid values: 0.0 - 1.0."
    },
    prefix_source_weight: {
        default: 0.8,
        parse: parseFloat,
        validate: (data)=>{return JSPLib.validate.isNumber(data) && data >= 0.0 && data <= 1.0;},
        hint: "Valid values: 0.0 - 1.0."
    },
    alias_source_weight: {
        default: 0.2,
        parse: parseFloat,
        validate: (data)=>{return JSPLib.validate.isNumber(data) && data >= 0.0 && data <= 1.0;},
        hint: "Valid values: 0.0 - 1.0."
    },
    correct_source_weight: {
        default: 0.1,
        parse: parseFloat,
        validate: (data)=>{return JSPLib.validate.isNumber(data) && data >= 0.0 && data <= 1.0;},
        hint: "Valid values: 0.0 - 1.0."
    },
    metatag_source_enabled: {
        default: true,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Adds metatags to autocomplete results on all post tag search inputs."
    },
    BUR_source_enabled: {
        default: true,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Adds BUR script elements to autocomplete results on bulk update requests, tag aliases, and tag implications."
    },
    source_results_returned: {
        default: 10,
        parse: parseInt,
        validate: (data)=>{return Number.isInteger(data) && data >= 5 && data <= 20;},
        hint: "Number of results to return (5 - 20)."
    },
    source_highlight_enabled: {
        default: true,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Adds highlights and stylings to the HTML classes set by the program."
    },
    source_grouping_enabled: {
        default: true,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Groups the results by tag autocomplete sources."
    },
    source_order: {
        allitems: tag_sources,
        default: tag_sources,
        validate: (data)=>{return Array.isArray(data) && JSPLib.utility.setSymmetricDifference(data,tag_sources).length === 0},
        hint: "Used when source grouping is enabled. Drag and drop the sources to determine the group order."
    },
    alternate_tag_source: {
        default: false,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Uses the <code>/tags</code> controller instead of the normal autocomplete source."
    },
    network_only_mode: {
        default: false,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: `Always goes to network. <b><span style="color:red">Warning:</span> This negates the benefit of cached data!</b>`
    },
    recheck_data_interval: {
        default: 1,
        parse: parseInt,
        validate: (data)=>{return Number.isInteger(data) && data >= 0 && data <= 3;},
        hint: "Number of days (0 - 3). Data expiring within this period gets automatically requeried. Setting to 0 disables this."
    }
}

//Pre-CSS/HTML constants

const bur_tag_category = 400;
const metatag_tag_category = 500;

//CSS Constants

const program_css = `
.iac-user-choice a {
    font-weight: bold;
}
.iac-already-used {
    background-color: #FFFFAA;
}
.iac-tag-alias a {
    font-style: italic;
}
.iac-tag-highlight {
    margin-top: -5px;
}
.iac-tag-highlight > div::before {
    content: "●";
    padding-right: 4px;
    font-weight: bold;
    font-size: 150%;
}
.iac-tag-bur > div::before {
    color: #000;
}
.iac-tag-exact > div::before {
    color: #DDD;
}
.iac-tag-prefix > div::before {
    color: hotpink;
}
.iac-tag-alias > div::before {
    color: gold;
}
.iac-tag-correct > div::before {
    color: cyan;
}
.iac-tag-bur > div::before,
.iac-tag-metatag > div::before{
    color: #000;
}
.iac-tag-highlight .tag-type-${bur_tag_category}:link {
    color: #888;
}
.iac-tag-highlight .tag-type-${bur_tag_category}:hover {
    color: #CCC;
}
.iac-tag-highlight .tag-type-${metatag_tag_category}:link {
    color: #000;
}
.iac-tag-highlight .tag-type-${metatag_tag_category}:hover {
    color: #444;
}
`;

const forum_css = `
.ui-menu-item .forum-topic-category-0 {
    color: blue;
}
.ui-menu-item .forum-topic-category-1 {
    color: green;
}
.ui-menu-item .forum-topic-category-2 {
    color: red;
}
`;

const menu_css = `
#iac-console {
    width: 100%;
    min-width: 100em;
}
#iac-console .expandable {
    width: 90%;
}
#iac-cache-viewer textarea {
    width: 100%;
    min-width: 40em;
    height: 50em;
    padding: 5px;
}
#iac-cache-editor-errors {
    display: none;
    border: solid lightgrey 1px;
    margin: 0.5em;
    padding: 0.5em;
}
#iac-settings .iac-linkclick .iac-control {
    display: inline;
}
#indexed-autocomplete a {
    color:#0073ff;
}
`;

//HTML Constants

const forum_topic_search = `
<li>
    <form action="/forum_topics" accept-charset="UTF-8" method="get">
        <input name="utf8" type="hidden" value="✓">
        <input id="quick_search_title_matches" placeholder="Search topic" type="text" name="search[title_matches]" class="ui-autocomplete-input" data-autocomplete="forum-topic" autocomplete="off">
    </form>
</li>`;

const post_comment_search = `
<li>
    <form action="/comments" accept-charset="UTF-8" method="get">
        <input name="utf8" type="hidden" value="✓">
        <input type="hidden" name="group_by" id="group_by" value="post">
        <input id="quick_search_post_matches" placeholder="Search posts" type="text" name="tags" class="ui-autocomplete-input" data-autocomplete="tag-query" autocomplete="off">
    </form>
</li>`;

const iac_menu = `
<div id="iac-script-message" class="prose">
    <h2>IndexedAutocomplete</h2>
    <p>Check the forum for the latest on information and updates (<a class="dtext-link dtext-id-link dtext-forum-topic-id-link" href="/forum_topics/14701">topic #14701</a>).</p>
</div>
<div id="iac-console" class="jsplib-console">
    <div id="iac-settings" class="jsplib-outer-menu">
        <div id="iac-source-settings" class="jsplib-settings-grouping">
            <div id="iac-source-message" class="prose">
                <h4>Source settings</h4>
            </div>
        </div>
        <div id="iac-usage-settings" class="jsplib-settings-grouping">
            <div id="iac-usage-message" class="prose">
                <h4>Usage settings</h4>
                <p>How items get sorted that are selected by the user.</p>
                <div class="expandable">
                    <div class="expandable-header">
                        <span>Additional setting details</span>
                        <input type="button" value="Show" class="expandable-button">
                    </div>
                    <div class="expandable-content">
                        <h5>Equations</h5>
                        <ul>
                            <li><span style="width:5em;display:inline-block"><b>Hit:</b></span><span style="font-family:monospace;font-size:125%">usage_count = Min( usage_count + 1 , usage_maximum )</span></li>
                            <li><span style="width:5em;display:inline-block"><b>Miss:</b></span><span style="font-family:monospace;font-size:125%">usage_count = usage_count * usage_multiplier</span></li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        <div id="iac-display-settings" class="jsplib-settings-grouping">
            <div id="iac-display-message" class="prose">
                <h4>Display settings</h4>
                <p>Affects the presentation of autocomplete data to the user.</p>
                <div class="expandable">
                    <div class="expandable-header">
                        <span>Additional setting details</span>
                        <input type="button" value="Show" class="expandable-button">
                    </div>
                    <div class="expandable-content">
                        <ul>
                            <li><b>Source highlight enabled:</b> The following are the CSS classes and default styling.
                                <ul>
                                    <li><code>.iac-user-choice</code> - bold text</li>
                                    <li><code>.iac-tag-exact</code> - grey dot</li>
                                    <li><code>.iac-tag-prefix</code> - pink dot</li>
                                    <li><code>.iac-tag-alias</code> - gold dot, italic text</li>
                                    <li><code>.iac-tag-correct</code> - cyan dot</li>
                                </ul>
                            </li>
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
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        <div id="iac-sort-settings" class="jsplib-settings-grouping">
            <div id="iac-sort-message" class="prose">
                <h4>Sort settings</h4>
                <p>Affects the order of tag autocomplete data.</p>
                <div class="expandable">
                    <div class="expandable-header">
                        <span>Additional setting details</span>
                        <input type="button" value="Show" class="expandable-button">
                    </div>
                    <div class="expandable-content">
                        <ul>
                            <li>Alternate sorting must be enabled to use the alternate scales/weights.</li>
                            <li>These settings won't affect anything if source grouping is enabled.</li>
                        </ul>
                        <h5>Equations</h5>
                        <ul>
                            <li><span style="width:8em;display:inline-block"><b>Linear:</b></span><span style="font-family:monospace;font-size:125%">tag_weight = source_weight x post_count</span></li>
                            <li><span style="width:8em;display:inline-block"><b>Square root:</b></span><span style="font-family:monospace;font-size:125%">tag_weight = source_weight x Sqrt( post_count )</span></li>
                            <li><span style="width:8em;display:inline-block"><b>Logarithmic:</b></span><span style="font-family:monospace;font-size:125%">tag_weight = source_weight x Log( post_count )</span></li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        <div id="iac-network-settings" class="jsplib-settings-grouping">
            <div id="iac-network-message" class="prose">
                <h4>Network settings</h4>
                <div class="expandable">
                    <div class="expandable-header">
                        <span>Additional setting details</span>
                        <input type="button" value="Show" class="expandable-button">
                    </div>
                    <div class="expandable-content">
                        <ul>
                            <li><b>Alternate tag source:</b>
                                <ul>
                                    <li>No aliases.</li>
                                    <li>No fuzzy or intelligent autocomplete.</li>
                                    <li>All results will be exact matches.</li>
                                </ul>
                            </li>
                            <li><b>Network only mode:</b>
                                <ul>
                                    <li>Can be used to correct cache data that has been changed on the server.</li>
                                    <li><span style="color:red;font-weight:bold">Warning!</span> <span style="font-style:italic">As this negates the benefits of using local cached data, it should only be used sparingly.</span></li>
                                </ul>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        <div id="iac-cache-settings" class="jsplib-settings-grouping">
            <div id="iac-cache-message" class="prose">
                <h4>Cache settings</h4>
                <h5>Cache data</h5>
                <div class="expandable">
                    <div class="expandable-header">
                        <span>Cache Data details</span>
                        <input type="button" value="Show" class="expandable-button">
                    </div>
                    <div class="expandable-content">
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
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        <hr>
        <div id="iac-settings-buttons" class="jsplib-settings-buttons">
            <input type="button" id="iac-commit" value="Save">
            <input type="button" id="iac-resetall" value="Factory Reset">
        </div>
    </div>
    <div id="iac-cache-editor" class="jsplib-outer-menu">
        <div id="iac-editor-message" class="prose">
            <h4>Cache editor</h4>
            <p>See the <b><a href="#iac-cache-message">Cache Data</a></b> details for the list of all cache data and what they do.</p>
            <div class="expandable">
                <div class="expandable-header">
                    <span>Program Data details</span>
                    <input type="button" value="Show" class="expandable-button">
                </div>
                <div class="expandable-content">
                    <p class="tn">All timestamps are in milliseconds since the epoch (<a href="https://www.epochconverter.com">Epoch converter</a>).</p>
                    <ul>
                        <li>General data
                            <ul>
                                <li><b>prune-expires:</b> When the program will next check for cache data that has expired.</li>
                                <li><b>user-settings:</b> All configurable settings.</li>
                            </ul>
                        </li>
                        <li>Usage data
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
                    </ul>
                </div>
            </div>
        </div>
        <div id="iac-cache-editor-controls"></div>
        <div id="iac-cache-editor-errors" class="jsplib-cache-editor-errors"></div>
        <div id="iac-cache-viewer" class="jsplib-cache-viewer">
            <textarea></textarea>
        </div>
    </div>
</div>
`;

//Cache editor constants

const all_source_types = ['indexed_db','local_storage'];
const all_data_types = ['tag','pool','user','artist','wiki','forum','saved_search','favorite_group','related_tag','custom'];
const reverse_data_key = {
    tag: 'ac',
    pool: 'pl',
    user: 'us',
    artist: 'ar',
    wiki: 'wp',
    forum: 'ft',
    saved_search: 'ss',
    favorite_group: 'fg'
};

//BUR constants
const bur_keywords = ['->','alias','imply','update','unalias','unimply','category'];
const bur_data = bur_keywords.map((tag)=>{
    return {
        type: 'tag',
        label: tag,
        value: tag,
        post_count: 'BUR',
        source: 'bur',
        category: bur_tag_category
    };
});

//Polling interval for checking program status
const timer_poll_interval = 100;

//Interval for fixup callback functions
const callback_interval = 1000;

//Delay for calling functions after initialization
const jquery_delay = 500;

//Data inclusion lists
const all_categories = [0,1,3,4,5];
const all_topics = [0,1,2];
const all_pools = ["collection","series"]
const all_related = ['','general','copyright','character','artist'];
const all_users = ["Member","Gold","Platinum","Builder","Moderator","Admin"];

//All of the following are used to determine when to run the script
const autocomplete_userlist = [
    "#search_to_name",
    "#search_from_name",
    "#dmail_to_name",
    "#search_user_name",
    "#search_banner_name",
    "#search_creator_name",
    "#search_approver_name",
    "#search_updater_name",
    "#search_uploader_name",
    "#user_feedback_user_name",
    ".c-users .search_name_matches input",
    ".c-user-upgrades .search_name_matches input",
];
//DOM elements with race condition
const autocomplete_rebindlist = [
    "[data-autocomplete=tag-query]",
    "[data-autocomplete=tag-edit]",
    "[data-autocomplete=tag]",
    ".autocomplete-mentions textarea"
];
//DOM elements with autocomplete
const autocomplete_domlist = [
    '#bulk_update_request_script',
    '.c-forum-topics #subnav-menu .search_body_matches',
    '.c-forum-posts #subnav-menu .search_body_matches',
    '[data-autocomplete="wiki-page"]',
    '[data-autocomplete="artist"]',
    '[data-autocomplete="pool"]',
    ].concat(autocomplete_rebindlist).concat(autocomplete_userlist);

const autocomplete_user_selectors = autocomplete_userlist.join(',');
const autocomplete_rebind_selectors = autocomplete_rebindlist.join(',');

//Expiration variables

const expiration_config = {
    tag: {
        logarithmic_start: 100,
        minimum: JSPLib.utility.one_week,
        maximum: JSPLib.utility.one_month
    },
    pool: {
        logarithmic_start: 10,
        minimum: JSPLib.utility.one_week,
        maximum: JSPLib.utility.one_month
    },
    user: {
        minimum: JSPLib.utility.one_month
    },
    favgroup: {
        minimum: JSPLib.utility.one_week
    },
    search: {
        minimum: JSPLib.utility.one_week
    },
    relatedtag: {
        minimum: JSPLib.utility.one_week
    },
    wikipage: {
        logarithmic_start: 100,
        minimum: JSPLib.utility.one_week,
        maximum: JSPLib.utility.one_month
    },
    artist: {
        logarithmic_start: 10,
        minimum: JSPLib.utility.one_week,
        maximum: JSPLib.utility.one_month
    },
    forumtopic: {
        minimum: JSPLib.utility.one_week
    }
};

//Source variables

const source_key = {
    ac: 'tag',
    pl: 'pool',
    us: 'user',
    fg: 'favgroup',
    ss: 'search',
    ar: 'artist',
    wp: 'wikipage',
    ft: 'forumtopic'
};

const source_config = {
    tag1: {
        url: "tags/autocomplete",
        data: (term)=>{
            return {
                search: {
                    name_matches: term
                }
            };
        },
        map: (tag)=>{
            return {
                type: 'tag',
                label: tag.name.replace(/_/g, " "),
                antecedent: tag.antecedent_name || null,
                value: tag.name,
                category: tag.category,
                post_count: tag.post_count,
                source: tag.source
            };
        },
        expiration: (d)=>{
            return (d.length ? ExpirationTime('tag', d[0].post_count) : MinimumExpirationTime('tag'));
        },
        fixupmetatag: false,
        fixupexpiration: false,
        searchstart: true,
        spacesallowed: false
    },
    tag2: {
        url: 'tags',
        data: (term)=>{
            return {
                search: {
                    name_matches: term + "*",
                    hide_empty: true,
                    order: 'count'
                },
                only: "name,category,post_count"
            };
        },
        map: (tag)=>{
            return {
                type: 'tag',
                label: tag.name.replace(/_/g, " "),
                antecedent: null,
                value: tag.name,
                category: tag.category,
                post_count: tag.post_count,
                source: 'exact'
            };
        },
        expiration: (d)=>{
            return (d.length ? ExpirationTime('tag', d[0].post_count) : MinimumExpirationTime('tag'));
        },
        fixupmetatag: false,
        fixupexpiration: false,
        searchstart: true,
        spacesallowed: false
    },
    metatag: {
        fixupmetatag: false
    },
    pool: {
        url: 'pools',
        data: (term)=>{
            return {
                search: {
                    order: 'post_count',
                    name_matches: term
                },
                only: "name,category,post_count"
            };
        },
        map: (pool)=>{
            return {
                type: 'pool',
                name: pool.name,
                post_count: pool.post_count,
                category: pool.category
            };
        },
        expiration: (d)=>{
            return (d.length ? ExpirationTime('pool', d[0].post_count) : MinimumExpirationTime('pool'));
        },
        fixupmetatag: true,
        fixupexpiration: false,
        searchstart: false,
        spacesallowed: true,
        render: ($domobj,item)=>{return $domobj.addClass("pool-category-" + item.category).text(item.label);}
    },
    user: {
        url: 'users',
        data: (term)=>{
            return {
                search: {
                    order: 'post_upload_count',
                    current_user_first: true,
                    name_matches: term + "*"
                },
                only: "name,level_string"
            };
        },
        map: (user)=>{
            return {
                type: 'user',
                name: user.name,
                level: user.level_string
            };
        },
        expiration: (d)=>{
            return MinimumExpirationTime('user');
        },
        fixupmetatag: true,
        fixupexpiration: false,
        searchstart: true,
        spacesallowed: false,
        render: ($domobj,item)=>{return $domobj.addClass("user-" + item.level.toLowerCase()).addClass("with-style").text(item.label);}
    },
    favgroup: {
        url: 'favorite_groups',
        data: (term)=>{
            return {
                search: {
                    name_matches: term
                },
                only: "name,post_count"
            };
        },
        map: (favgroup)=>{
            return {
                name: favgroup.name,
                post_count: favgroup.post_count
            };
        },
        expiration: (d)=>{
            return MinimumExpirationTime('favgroup');
        },
        fixupmetatag: true,
        fixupexpiration: false,
        searchstart: false,
        spacesallowed: true
    },
    search: {
        url: 'saved_searches/labels',
        data: (term)=>{
            return {
                search: {
                    label: term + "*"
                }
            };
        },
        map: (label)=>{
            return {
                name: label
            };
        },
        expiration: (d)=>{
            return MinimumExpirationTime('search');
        },
        fixupmetatag: true,
        fixupexpiration: false,
        searchstart: true,
        spacesallowed: false
    },
    wikipage: {
        url: 'wiki_pages',
        data: (term)=>{
            return {
                search: {
                    order: 'post_count',
                    hide_deleted: true,
                    title: term + "*"
                },
                only: "title,category_name"
            };
        },
        map: (wikipage)=>{
            return {
                label: wikipage.title.replace(/_/g, " "),
                value: wikipage.title,
                category: wikipage.category_name
            };
        },
        expiration: (d)=>{
            return MinimumExpirationTime('wikipage');
        },
        fixupmetatag: false,
        fixupexpiration: true,
        searchstart: true,
        spacesallowed: true,
        render: ($domobj,item)=>{return $domobj.addClass("tag-type-" + item.category).text(item.label);}
    },
    artist: {
        url: 'artists',
        data: (term)=>{
            return {
                search: {
                    order: 'post_count',
                    is_active: true,
                    name_like: term.trim().replace(/\s+/g, "_") + "*"
                },
                only: 'name'
            };
        },
        map: (artist)=>{
            return {
                label: artist.name.replace(/_/g, " "),
                value: artist.name
            };
        },
        expiration: (d)=>{
            return MinimumExpirationTime('artist');
        },
        fixupmetatag: false,
        fixupexpiration: true,
        searchstart: true,
        spacesallowed: false,
        render: ($domobj,item)=>{return $domobj.addClass("tag-type-1").text(item.label);}
    },
    forumtopic: {
        url: 'forum_topics',
        data: (term)=>{
            return {
                search: {
                    order: 'sticky',
                    title_matches: "*" + term + "*"
                },
                only: "title,category_id"
            };
        },
        map: (forumtopic)=>{
            return {
                value: forumtopic.title,
                category: forumtopic.category_id
            };
        },
        expiration: (d)=>{
            return MinimumExpirationTime('forumtopic');
        },
        fixupmetatag: false,
        fixupexpiration: false,
        searchstart: false,
        spacesallowed: true,
        render: ($domobj,item)=>{return $domobj.addClass("forum-topic-category-" + item.category).text(item.value);}
    }
};

//Validate constants

const autocomplete_constraints = {
    entry: JSPLib.validate.arrayentry_constraints({maximum: 20}),
    tag: {
        antecedent: JSPLib.validate.stringnull_constraints,
        category: JSPLib.validate.inclusion_constraints(all_categories.concat(metatag_tag_category)),
        label: JSPLib.validate.stringonly_constraints,
        post_count: JSPLib.validate.postcount_constraints,
        type: JSPLib.validate.inclusion_constraints(['tag', 'metatag']),
        value: JSPLib.validate.stringonly_constraints,
        source: JSPLib.validate.inclusion_constraints(tag_sources)
    },
    get metatag() {
        return this.tag;
    },
    pool: {
        category: JSPLib.validate.inclusion_constraints(all_pools),
        post_count: JSPLib.validate.counting_constraints,
        type: JSPLib.validate.inclusion_constraints(["pool"]),
        name: JSPLib.validate.stringonly_constraints
    },
    user: {
        level: JSPLib.validate.inclusion_constraints(all_users),
        type: JSPLib.validate.inclusion_constraints(["user"]),
        name: JSPLib.validate.stringonly_constraints
    },
    favgroup: {
        post_count: JSPLib.validate.counting_constraints,
        name: JSPLib.validate.stringonly_constraints
    },
    search: {
        name: JSPLib.validate.stringonly_constraints
    },
    artist: {
        label: JSPLib.validate.stringonly_constraints,
        value: JSPLib.validate.stringonly_constraints
    },
    wikipage: {
        label: JSPLib.validate.stringonly_constraints,
        value: JSPLib.validate.stringonly_constraints,
        category: JSPLib.validate.inclusion_constraints(all_categories)
    },
    forumtopic: {
        value: JSPLib.validate.stringonly_constraints,
        category: JSPLib.validate.inclusion_constraints(all_topics)
    }
};

const relatedtag_constraints = {
    entry: JSPLib.validate.hashentry_constraints,
    value: {
        category: JSPLib.validate.inclusion_constraints(all_related),
        query: JSPLib.validate.stringonly_constraints,
        tags: JSPLib.validate.tagentryarray_constraints,
        wiki_page_tags: JSPLib.validate.tagentryarray_constraints,
        other_wikis: JSPLib.validate.hash_constraints
    },
    other_wiki_title: JSPLib.validate.stringonly_constraints,
    other_wiki_value: JSPLib.validate.tagentryarray_constraints
};

const usage_constraints = {
    expires: JSPLib.validate.expires_constraints,
    use_count: {
        numericality: {
            greaterThanOrEqualTo: 0
        }
    }
};

/****Functions****/

//Validate functions

function ValidateEntry(key,entry) {
    if (!JSPLib.validate.validateIsHash(key, entry)) {
        return false
    }
    if (key.match(/^(?:ac|pl|us|fg|ss|ar|wp|ft)-/)) {
        return ValidateAutocompleteEntry(key, entry);
    } else if (key.match(/^rt(?:gen|char|copy|art)?-/)) {
        return ValidateRelatedtagEntry(key, entry);
    }
    ValidateEntry.debuglog("Bad key!");
    return false;
}

function ValidateAutocompleteEntry(key,entry) {
    if (!JSPLib.validate.validateHashEntries(key, entry, autocomplete_constraints.entry)) {
        return false;
    }
    let type = source_key[key.slice(0,2)];
    for (let i = 0; i < entry.value.length; i++) {
        if (!JSPLib.validate.validateHashEntries(`${key}.value[${i}]`, entry.value[i], autocomplete_constraints[type])) {
            return false;
        }
    }
    return true;
}

function ValidateRelatedtagEntry(key,entry) {
    if (!JSPLib.validate.validateHashEntries(key, entry, relatedtag_constraints.entry)) {
        return false;
    }
    if (!JSPLib.validate.validateHashEntries(key + '.value', entry.value, relatedtag_constraints.value)) {
        return false;
    }
    for (let title in entry.value.other_wikis) {
        let value = entry.value.other_wikis[title];
        let wiki_key = key + '.value.other_wikis.' + title;
        let check = validate({title: title}, {title: relatedtag_constraints.other_wiki_title});
        if (check !== undefined) {
            JSPLib.validate.outputValidateError(wiki_key, check);
            return false;
        }
        check = validate({value: value},{value: relatedtag_constraints.other_wiki_value});
        if (check !== undefined) {
            JSPLib.validate.outputValidateError(wiki_key, check);
            return false;
        }
    }
    return true;
}

function ValidateProgramData(key,entry) {
    var checkerror=[];
    switch (key) {
        case 'iac-user-settings':
            checkerror = JSPLib.menu.validateUserSettings(entry, settings_config);
            break;
        case 'iac-prune-expires':
            if (!Number.isInteger(entry)) {
                checkerror = ["Value is not an integer."];
            }
            break;
        case 'iac-choice-info':
            if (JSPLib.validate.isHash(entry)) {
                checkerror = Timer.ValidateUsageData(entry);
            } else {
                checkerror = ['Value is not a hash'];
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
            error_messages.push(`choice_order[${type}] is not an array.`)
            delete choice_order[type];
            continue;
        }
        for (let i = 0; i < choice_order[type].length; i++) {
            if (!JSPLib.validate.isString(choice_order[type][i])) {
                error_messages.push(`choice_order[${type}][${i}] is not a string`)
                choice_order[type].splice(i, 1);
                i--;
            }
        }
    }
    //Validate choice data
    for (let type in choice_data) {
        if (!JSPLib.validate.isHash(choice_data[type])) {
            error_messages.push(`choice_data[${type}] is not a hash`)
            delete choice_data[type];
            continue;
        }
        for (let key in choice_data[type]) {
            let validator = Object.assign({}, autocomplete_constraints[type], usage_constraints);
            let check = validate(choice_data[type][key], validator);
            if (check !== undefined) {
                error_messages.push(`choice_data[${type}][${key}]`, check);
                delete choice_data[type][key];
            }
        }
    }
    //Validate same types between both
    let type_diff = JSPLib.utility.setSymmetricDifference(Object.keys(choice_order), Object.keys(choice_data));
    if (type_diff.length) {
        error_messages.push("Type difference between choice order and choice data:", type_diff);
        type_diff.forEach((type)=>{
            delete choice_order[type];
            delete choice_data[type];
        });
    }
    //Validate same keys between both
    for (let type in choice_order) {
        let key_diff = JSPLib.utility.setSymmetricDifference(choice_order[type], Object.keys(choice_data[type]));
        if (key_diff.length) {
            error_messages.push("Key difference between choice order and choice data:", type, key_diff);
            key_diff.forEach((key)=>{
                choice_order[type] = JSPLib.utility.setDifference(choice_order[type], [key]);
                delete choice_data[type][key];
            });
        }
    }
    return error_messages;
}

//Library functions

JSPLib.danbooru.wikiLink = function (tag,text) {
    return `<a href="/wiki_pages/show_or_new?title=${encodeURIComponent(tag)}">${text}</a>`;
};

JSPLib.danbooru.isSettingMenu = function () {
    return document.body.dataset.controller === "users" && document.body.dataset.action === "edit";
};

JSPLib.utility.displayCase = function (string) {
    return JSPLib.utility.titleizeString(string.replace(/[_]/g,' '));
};

//Helper functions

function RemoveTerm(str,index) {
    str = " " + str + " ";
    let first_slice = str.slice(0, index);
    let second_slice = str.slice(index);
    let first_space = first_slice.lastIndexOf(' ');
    let second_space = second_slice.indexOf(' ');
    return (first_slice.slice(0, first_space) + second_slice.slice(second_space)).slice(1,-1);
}

function GetPrefix(str) {
    if (!(str in GetPrefix.prefixhash)) {
        GetPrefix.prefixhash[str] = str.split('_').map((part)=>{return part.replace(/[()]/g, '')[0];}).join('');
    }
    return GetPrefix.prefixhash[str];
}
GetPrefix.prefixhash = {};

function GetIsBur() {
    return document.body.dataset.controller === "bulk-update-requests" && ['edit','new'].includes(document.body.dataset.action);
}
function MapMetatag(type,metatag,value) {
    return {
        type: type,
        antecedent: null,
        label: metatag + ':' + value,
        value: metatag + ':' + value,
        post_count: metatag_tag_category,
        source: 'metatag',
        category: metatag_tag_category
    }
}

function MetatagData() {
    if (!MetatagData.data) {
        MetatagData.data = Danbooru.Autocomplete.METATAGS.filter((tag)=>{return tag[0] !== "-";}).map((tag)=>{
            return MapMetatag('tag', tag, '');
        });
    }
    return MetatagData.data;
}

function SubmetatagData() {
    if (!SubmetatagData.data) {
        SubmetatagData.data = [];
        for (let metatag in Danbooru.Autocomplete.static_metatags) {
            for (let i = 0; i < Danbooru.Autocomplete.static_metatags[metatag].length; i++) {
                let submetatag = Danbooru.Autocomplete.static_metatags[metatag][i];
                SubmetatagData.data.push(MapMetatag('metatag', metatag, submetatag));
            }
        }
    }
    return SubmetatagData.data;
}

//Time functions

function MinimumExpirationTime(type) {
    return expiration_config[type].minimum;
}

function MaximumExpirationTime(type) {
    return (expiration_config[type].maximum ? expiration_config[type].maximum : expiration_config[type].minimum);
}

//Logarithmic increase of expiration time based upon a count
function ExpirationTime(type,count) {
    let config = expiration_config[type];
    let expiration = Math.log10(10 * count / config.logarithmic_start) * config.minimum;
    expiration = Math.max(expiration, config.minimum);
    expiration = Math.min(expiration, config.maximum);
    return Math.round(expiration);
}

//Render functions

function RenderTaglist(taglist,columnname) {
    let html = "";
    taglist.forEach((tagdata)=>{
        let tag = tagdata[0];
        let category = tagdata[1];
        let display_name = tag.replace(/_/g, ' ');
        let search_link = JSPLib.danbooru.postSearchLink(tag, display_name, 'class="search-tag"');
        html += `<li class="category-${category}">${search_link}</li>\n`;
    });
    return `
<h6>${columnname}</h6>
<ul>
${html}
</ul>`;
}

function RenderTagColumns(data) {
    let is_empty = data.tags.length === 0;
    let display_name = data.query.replace(/_/g, ' ');
    let column = (is_empty ? "" : RenderTaglist(data.tags, display_name));
    let html = `
<div class="tag-column general-related-tags-column is-empty-${is_empty}">
${column}
</div>`;
    is_empty = data.wiki_page_tags.length === 0;
    column = (is_empty ? "" : RenderTaglist(data.wiki_page_tags, JSPLib.danbooru.wikiLink(data.query, `wiki:${display_name}`)));
    html += `
<div class="tag-column wiki-related-tags-column is-empty-${false}">
${column}
</div>`;
    for (let title in data.other_wikis) {
        let title_name = title.replace(/_/g, ' ');
        column = RenderTaglist(data.other_wikis[title], JSPLib.danbooru.wikiLink(title, `wiki:${title_name}`));
        html += `
<div class="tag-column wiki-related-tags-column is-empty-false">
${column}
</div>`;
    }
    return html;
}

function RenderListItem(alink_func) {
    return function (list,item) {
        var $link = alink_func($("<a/>"), item);
        var $container = $("<div/>").append($link);
        HighlightSelected($container, list, item);
        return $("<li/>").data("item.autocomplete", item).append($container).appendTo(list);
    }
}

//Main helper functions

function FixupMetatag(value,metatag) {
    switch(metatag) {
        case "@":
            value.value = "@" + value.name;
            value.label = value.name;
            break;
        case "":
            value.value = value.name;
            value.label = value.name.replace(/_/g, " ");
            break;
        default:
            metatag = metatag.replace(/:$/,'');
            value.value = metatag + ":" + value.name;
            value.label = value.name.replace(/_/g, " ");
    }
}

function SortSources(data) {
    var scaler;
    switch(IAC.user_settings.postcount_scale[0]) {
        case "logarithmic":
            scaler = ((num)=>{return Math.log(num);});
            break;
        case "square_root":
            scaler = ((num)=>{return Math.sqrt(num);});
            break;
        case "linear":
        default:
            scaler = ((num)=>{return num;});
    }
    data.sort((a,b)=>{
        let mult_a = IAC.user_settings[`${a.source}_source_weight`];
        let mult_b = IAC.user_settings[`${b.source}_source_weight`];
        let weight_a = mult_a * scaler(a.post_count);
        let weight_b = mult_b * scaler(b.post_count);
        return weight_b - weight_a;
    }).forEach((entry,i)=>{
        data[i] = entry;
    });
}

function GroupSources(data) {
    let source_order = IAC.user_settings.source_order;
    data.sort((a,b)=>{
        return source_order.indexOf(a.source) - source_order.indexOf(b.source);
    }).forEach((entry,i)=>{
        data[i] = entry;
    });
}

function FixExpirationCallback(key,value,tagname,type) {
    FixExpirationCallback.debuglog("Fixing expiration:", tagname);
    JSPLib.danbooru.submitRequest('tags',{search: {name: tagname}}).then((data)=>{
        if (!data.length) {
            return;
        }
        var expiration_time = ExpirationTime(type,data[0].post_count);
        JSPLib.storage.saveData(key, {value: value, expires: JSPLib.utility.getExpiration(expiration_time)});
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
            GetArtistData.debuglog("Redirect found!", redirect);
            return JSPLib.storage.getStorageData(redirect, sessionStorage);
        }
}

function SaveArtistData() {
    let url = $("#upload_source,#post_source").val();
    let ref = $("#upload_referer_url").val();
    if (!url.match(/^https?:\/\//)) {
        return;
    }
    let urlkey = 'af-' + url;
    let refkey = 'ref-' + ref;
    let source_info = LZString.compressToUTF16($("#source-info").html());
    let source_column = LZString.compressToUTF16($(".source-related-tags-columns").html());
    SaveArtistData.debuglog("Saving", urlkey);
    JSPLib.storage.setStorageData(urlkey, {source_info: source_info, source_column: source_column}, sessionStorage);
    if (ref) {
        SaveArtistData.debuglog("Saving", refkey);
        JSPLib.storage.setStorageData(refkey, urlkey, sessionStorage);
    }
}

function GetRelatedKeyModifer(category) {
    return 'rt' + (category ? JSPLib.danbooru.getShortName(category) : "");
}

//Usage functions

function KeepSourceData(type,metatag,data) {
    IAC.source_data[type] = IAC.source_data[type] || {};
    data.forEach((val)=>{
        let orig_key = val.value.replace(RegExp(`^${metatag}:?`), '');
        let key = (val.antecedent ? val.antecedent : orig_key);
        IAC.source_data[type][key] = val;
    });
}

function GetChoiceOrder(type,query) {
    let checkprefix = IAC.user_settings.prefix_check_enabled && (type === 'tag') && (query.length >= 2 && query.length <= 4);
    let queryterm = query.toLowerCase();
    let available_choices = IAC.choice_order[type].filter((tag)=>{
        let tagterm = tag.toLowerCase();
        let tagprefix = (checkprefix ? GetPrefix(tagterm) : '');
        let queryindex = tagterm.indexOf(queryterm);
        let prefixindex = (checkprefix ? tagprefix.indexOf(queryterm) : -1);
        return (queryindex === 0) || (prefixindex === 0) || (!source_config[type].searchstart && queryindex > 0);
    });
    let sortable_choices = available_choices.filter((tag)=>{return IAC.choice_data[type][tag].use_count > 0});
    sortable_choices.sort((a,b)=>{
        return IAC.choice_data[type][b].use_count - IAC.choice_data[type][a].use_count;
    });
    return JSPLib.utility.setUnique(sortable_choices.concat(available_choices));
}

function AddUserSelected(type,metatag,term,data,query_type) {
    IAC.shown_data = [];
    let order = IAC.choice_order[type];
    let choice = IAC.choice_data[type];
    if (!order || !choice) {
        return;
    }
    let user_order = GetChoiceOrder(type, term);
    for (let i = user_order.length - 1; i >= 0; i--) {
        let checkterm = (['','@'].includes(metatag) ? metatag + user_order[i] : metatag + ':' + user_order[i]);
        if (query_type === "tag" && choice[checkterm].category === metatag_tag_category) {
            continue;
        }
        //Splice out Danbooru data if it exists
        for (let j = 0; j < data.length; j++) {
            let compareterm = (data[j].antecedent ? data[j].antecedent : data[j].value);
            if (compareterm === checkterm) {
                data.splice(j, 1);
                //Should only be one of these at most
                break;
            }
        }
        let add_data = choice[user_order[i]];
        if (source_config[type].fixupmetatag) {
            FixupMetatag(add_data, metatag);
        }
        data.unshift(add_data);
        IAC.shown_data.push(user_order[i]);
    }
    data.splice(IAC.user_settings.source_results_returned);
}

//For autocomplete select
function InsertUserSelected(data,input,selected) {
    if (!IAC.user_settings.usage_enabled) {
        return;
    }
    var type,item,term,source_data;
    //Being hamstrung by Danbooru's select function of the multi-source tag complete
    if (typeof selected === "string") {
        let autocomplete = $(input).autocomplete("instance");
        let list_container = autocomplete.menu.element[0];
        let $links = $('.ui-state-active', list_container).parent();
        if ($links.length === 0) {
            $links = $(".ui-menu-item:first-of-type", list_container);
        }
        item = $links.data("item.autocomplete");
        if (!item) {
            InsertUserSelected.debuglog("Error: No autocomplete data found!", $links, item);
            return;
        }
        type = item.type;
        if (!type) {
            let autocomplete_type = $(input).data('autocomplete');
            if (autocomplete_type === 'tag-query' || autocomplete_type === 'tag-edit') {
                let match = selected.match(Danbooru.Autocomplete.METATAGS_REGEX);
                type = (match ? match[1] : 'tag');
            } else {
                type = autocomplete_type.replace(/-/g, '');
            }
        }
    } else {
        item = selected;
        type = source_key[data];
    }
    if (item.category === bur_tag_category) {
        return;
    }
    if ($(input).data('multiple') === false) {
        input.value = input.value.trim();
    }
    if (item.antecedent) {
        term = item.antecedent;
    } else if (item.name) {
        term = item.name;
    } else {
        term = item.value;
    }
    if (item.category === metatag_tag_category) {
        if (item.type === 'tag') {
            input.selectionStart = input.selectionEnd = input.selectionStart - 1;
            setTimeout(()=>{$(input).autocomplete("search");},100);
        }
        source_data = item;
    } else
    //Final failsafe
    if (!IAC.source_data[type] || !IAC.source_data[type][term]) {
        if (!IAC.choice_data[type] || !IAC.choice_data[type][term]) {
            InsertUserSelected.debuglog("Error: Bad data selector!", type, term, selected, data, item);
            return;
        }
        source_data = IAC.choice_data[type][term];
    } else {
        source_data = IAC.source_data[type][term];
    }
    IAC.choice_order[type] = IAC.choice_order[type] || [];
    IAC.choice_data[type] = IAC.choice_data[type] || {};
    IAC.choice_order[type].unshift(term);
    IAC.choice_order[type] = JSPLib.utility.setUnique(IAC.choice_order[type]);
    //So the use count doesn't get squashed by the new variable assignment
    let use_count = (IAC.choice_data[type][term] && IAC.choice_data[type][term].use_count) || 0;
    IAC.choice_data[type][term] = source_data;
    IAC.choice_data[type][term].expires = JSPLib.utility.getExpiration(GetUsageExpires());
    IAC.choice_data[type][term].use_count = use_count + 1;
    if (IAC.user_settings.usage_maximum > 0) {
        IAC.choice_data[type][term].use_count = Math.min(IAC.choice_data[type][term].use_count, IAC.user_settings.usage_maximum);
    }
    IAC.shown_data.forEach((key)=>{
        if (key !== term) {
            IAC.choice_data[type][key].use_count = IAC.choice_data[type][key].use_count || 0;
            IAC.choice_data[type][key].use_count *= IAC.user_settings.usage_multiplier;
        }
    });
    StoreUsageData('insert', term);
}

function StaticMetatagSource(term, resp, metatag) {
    let full_term = `${metatag}:${term}`;
    let data = SubmetatagData()
        .filter((data)=>{return data.value.startsWith(full_term);})
        .sort((a,b)=>{return a.value.localeCompare(b.value);})
        .slice(0,IAC.user_settings.source_results_returned);
    AddUserSelected('metatag','',full_term,data)
    resp(data);
}

//For autocomplete render
function HighlightSelected($link,list,item) {
    if (IAC.user_settings.source_highlight_enabled) {
        if (item.expires) {
            $($link).addClass('iac-user-choice');
        }
        if (item.type === 'tag' || item.type === "metatag") {
            $($link).addClass('iac-tag-highlight');
            switch (item.source) {
                case 'exact':
                    $($link).addClass('iac-tag-exact');
                    break;
                case 'prefix':
                    $($link).addClass('iac-tag-prefix');
                    break;
                case 'alias':
                    $($link).addClass('iac-tag-alias');
                    break;
                case 'correct':
                    $($link).addClass('iac-tag-correct');
                    break;
                case 'bur':
                    $($link).addClass('iac-tag-bur');
                    break;
                case 'metatag':
                    $($link).addClass('iac-tag-metatag');
                    $(".post-count", $link).text('metatag');
                    $("a", $link).addClass("tag-type-" + item.category);
                    //falls through
                default:
                    //Do nothing
            }
        }
        if (IAC.highlight_used && IAC.current_tags.includes(item.value)) {
            $($link).addClass('iac-already-used');
        }
    }
    return $link;
}

function CorrectUsageData() {
    let error_messages = Timer.ValidateUsageData(IAC);
    if (error_messages.length) {
        CorrectUsageData.debuglog("Corrections to usage data detected!");
        error_messages.forEach((error)=>{CorrectUsageData.debuglog(error)});
        StoreUsageData('correction');
    } else {
        CorrectUsageData.debuglog("Usage data is valid.");
    }
}

function PruneUsageData() {
    let is_dirty = false;
    for (let type_key in IAC.choice_data) {
        let type_entry = IAC.choice_data[type_key];
        for (let key in type_entry) {
            let entry = type_entry[key];
            if (!JSPLib.validate.validateExpires(entry.expires, GetUsageExpires())) {
                PruneUsageData.debuglog("Pruning choice data!", type_key, key);
                IAC.choice_order[type_key] = JSPLib.utility.setDifference(IAC.choice_order[type_key], [key])
                delete type_entry[key];
                is_dirty = true;
            }
        }
    }
    if (is_dirty) {
        StoreUsageData('prune');
    }
}

function StoreUsageData(name,key='',save=true) {
    if (save) {
        JSPLib.storage.setStorageData('iac-choice-info', {choice_order: IAC.choice_order, choice_data: IAC.choice_data}, localStorage);
    }
    IAC.channel.postMessage({type: "reload", name: name, key: key, choice_order: IAC.choice_order, choice_data: IAC.choice_data});
}

//Non-autocomplete storage

async function RelatedTagsButton(event) {
    let category = $(event.target).data("category") || "";
    let currenttag = Danbooru.RelatedTag.current_tag().trim();
    let keymodifier = GetRelatedKeyModifer(category);
    let key = (keymodifier + "-" + currenttag).toLowerCase();
    let max_expiration = MaximumExpirationTime('relatedtag');
    RelatedTagsButton.debuglog("Checking relatedtag:", currenttag, category);
    let cached = await JSPLib.storage.checkLocalDB(key, ValidateEntry, max_expiration);
    if (cached) {
        RelatedTagsButton.debuglog("Found relatedtag:", currenttag, category);
        $("#related-tags-container .current-related-tags-columns").html(Timer.RenderTagColumns(cached.value));
    } else {
        RelatedTagsButton.debuglog("Querying relatedtag:", currenttag, category);
        var data = await JSPLib.danbooru.submitRequest('related_tag', {query: currenttag, category: category});
        if (!data) {
            return;
        }
        //inclusion_constraints doesn't allow for null...yet
        data.category = category;
        JSPLib.storage.saveData(key, {value: data, expires: JSPLib.utility.getExpiration(MinimumExpirationTime('relatedtag'))});
        $("#related-tags-container .current-related-tags-columns").html(Timer.RenderTagColumns(data));
    }
    Danbooru.RelatedTag.update_selected();
    Danbooru.RelatedTag.show();
}

async function FindArtistSession(event) {
    var url = $("#post_source").val();
    if (!url.match(/^https?:\/\//)) {
        return;
    }
    let urlkey = 'af-' + url;
    FindArtistSession.debuglog("Checking artist", urlkey);
    let data = GetArtistData(url);
    if (data) {
        FindArtistSession.debuglog("Found artist data", urlkey);
        $("#source-info").html(LZString.decompressFromUTF16(data.source_info));
        $(".source-related-tags-columns").html(LZString.decompressFromUTF16(data.source_column))
    } else {
        FindArtistSession.debuglog("Missing artist data", urlkey);
        $("#source-info").addClass("loading");
        try {
            await $.get("/source.js", {url: url});
            Timer.SaveArtistData();
        } catch (e) {
            //swallow
        }
        $("#source-info").removeClass("loading");
    }
}

////Setup functions

//Rebind callback functions

function RebindRenderCheck() {
    let render_expires = Date.now() + JSPLib.utility.one_second * 5;
    let render_timer = JSPLib.utility.initializeInterval(()=>{
        if(!JSPLib.utility.hasDOMDataKey(autocomplete_rebind_selectors, 'iac-render')) {
            $(autocomplete_rebind_selectors).each((i,entry)=>{
                let render_set = $(entry).data("iac-render");
                let autocomplete_item = $(entry).data("uiAutocomplete");
                if (!render_set && autocomplete_item) {
                    autocomplete_item._renderItem = Danbooru.Autocomplete.render_item;
                    $(entry).data("iac-render", true);
                }
            });
        }
        if (!JSPLib.validate.validateExpires(render_expires)) {
            clearInterval(render_timer);
            return;
        }
    }, timer_poll_interval);
}

function RebindRelatedTags() {
    //Only need to check one of them, since they're all bound at the same time
    JSPLib.utility.rebindTimer({
        check: ()=>{return JSPLib.utility.isNamespaceBound(document, 'click', 'danbooru', ".related-tags-button");},
        exec: ()=>{
            $(document).off("click.danbooru",".related-tags-button");
            $(document).on("click.danbooru",".related-tags-button", Timer.RelatedTagsButton);
        }
    },timer_poll_interval);
}

function RebindFindArtist() {
    JSPLib.utility.rebindTimer({
        check: ()=>{return JSPLib.utility.isGlobalFunctionBound("danbooru:show-related-tags");},
        exec: ()=>{
            IAC.cached_data = true;
            $(document).off("danbooru:show-related-tags");
            if (!Danbooru.RTC || !Danbooru.RTC.cached_data) {
                $(document).one("danbooru:show-related-tags", Danbooru.RelatedTag.initialize_recent_and_favorite_tags);
            }
            $(document).one("danbooru:show-related-tags", Timer.FindArtistSession);
        }
    },timer_poll_interval);
}

function RebindAnyAutocomplete(selector,keycode,multiple) {
    JSPLib.utility.rebindTimer({
        check: ()=>{return JSPLib.utility.hasDOMDataKey(selector, 'uiAutocomplete');},
        exec: ()=>{
            $(selector).autocomplete("destroy").off('keydown.Autocomplete.tab');
            InitializeAutocompleteIndexed(selector, keycode, multiple);
        }
    },timer_poll_interval);
}

function RebindSingleTag() {
    JSPLib.utility.rebindTimer({
        check: ()=>{return JSPLib.utility.hasDOMDataKey('[data-autocomplete=tag]', 'uiAutocomplete');},
        exec: ()=>{
            $('[data-autocomplete=tag]').autocomplete("destroy").off('keydown.Autocomplete.tab');
            $('[data-autocomplete=tag]').autocomplete({
                minLength: 1,
                autoFocus: true,
                source: AnySourceIndexed('ac', '', false, true)
            });
        }
    },timer_poll_interval);
}

//Initialization functions

function InitializeAutocompleteIndexed(selector,keycode,multiple=false) {
    let type = source_key[keycode];
    var $fields = $(selector);
    $fields.autocomplete({
        minLength: 1,
        delay: 100,
        source: AnySourceIndexed(keycode, '', multiple),
        search: function () {
            $(this).data("uiAutocomplete").menu.bindings = $();
        },
        select: function (event,ui) {
            InsertUserSelected(keycode, this, ui.item);
            if (multiple) {
                if (event.key === "Enter") {
                    event.stopImmediatePropagation();
                }
                Danbooru.Autocomplete.insert_completion_old(this, ui.item.value);
                return false;
            } else {
                ui.item.value = ui.item.value.trim();
            }
            return ui.item.value;
        }
    });
    let alink_func = (source_config[type].render ? source_config[type].render : ($domobj,item)=>{return $domobj.text(item.value);});
    setTimeout(()=>{
        $fields.each((i,field)=>{
            $(field).data('uiAutocomplete')._renderItem = RenderListItem(alink_func);
        });
    }, jquery_delay);
    if (!JSPLib.utility.isNamespaceBound(selector, 'keydown', 'Autocomplete.tab')) {
        $fields.on('keydown.Autocomplete.tab', null, "tab", Danbooru.Autocomplete.on_tab);
    }
    $fields.data('autocomplete', type);
    $fields.data('multiple', multiple);
}

//Main execution functions

function NetworkSource(type,key,term,resp,metatag,context,process=true) {
    NetworkSource.debuglog("Querying", type, ':', term);
    let url_addons = $.extend({limit: IAC.user_settings.source_results_returned}, source_config[type].data(term));
    JSPLib.danbooru.submitRequest(source_config[type].url, url_addons).then((data)=>{
        if (!data || !Array.isArray(data)) {
            if (process) {
                resp([]);
            }
            return;
        }
        var d = data.map(source_config[type].map);
        var expiration_time = source_config[type].expiration(d);
        var save_data = JSPLib.utility.dataCopy(d);
        JSPLib.storage.saveData(key, {value: save_data, expires: JSPLib.utility.getExpiration(expiration_time)});
        if (source_config[type].fixupexpiration && d.length) {
            setTimeout(()=>{FixExpirationCallback(key, save_data, save_data[0].value, type);}, callback_interval);
        }
        if (process) {
            ProcessSourceData(type, metatag, term, d, resp, context);
        }
    });
}

function AnySourceIndexed(keycode,default_metatag='',multiple=false,single=false) {
    var type = source_key[keycode];
    return async function (req, resp, input_metatag) {
        var term;
        //Only for instances set with InitializeAutocompleteIndexed, i.e. not the hooked "tag-query" source functions
        if (multiple) {
            term = Danbooru.Autocomplete.parse_query(req.term, this.element.get(0).selectionStart).term;
            if (!term) {
                resp([]);
                return;
            }
        } else {
            term = (req.term ? req.term : req);
            if ((!source_config[type].spacesallowed || input_metatag) && term.match(/\S\s/)) {
                resp([]);
                return;
            }
            term = term.trim();
        }
        if (term === "") {
            resp([]);
            return;
        }
        var key = (keycode + "-" + term).toLowerCase();
        var use_metatag = (input_metatag ? input_metatag : default_metatag);
        var context = (single ? this : null);
        if (!IAC.user_settings.network_only_mode) {
            var max_expiration = MaximumExpirationTime(type);
            var cached = await JSPLib.storage.checkLocalDB(key, ValidateEntry, max_expiration);
            if (cached) {
                RecheckSourceData(type, key, term, cached);
                ProcessSourceData(type, use_metatag, term, cached.value, resp, context);
                return;
            }
        }
        NetworkSource(type, key, term, resp, use_metatag, context);
    }
}

function RecheckSourceData(type,key,term,data) {
    if (IAC.user_settings.recheck_data_interval > 0) {
        let recheck_time = data.expires - GetRecheckExpires();
        if (!JSPLib.validate.validateExpires(recheck_time)) {
            JSPLib.debug.debuglog("Rechecking", type, ":", term);
            NetworkSource(type, key, term, null, null, null, false);
        }
    }
}

function ProcessSourceData(type,metatag,term,data,resp,context) {
    var query_type = (context ? $(context.element).data('autocomplete') : null);
    if (source_config[type].fixupmetatag) {
        data.forEach((val)=> {FixupMetatag(val, metatag);});
    }
    KeepSourceData(type, metatag, data);
    if (type === 'tag') {
        if (IAC.user_settings.alternate_sorting_enabled) {
            SortSources(data);
        }
        if (IAC.user_settings.metatag_source_enabled) {
            if (query_type !== 'tag') {
                let add_data = MetatagData().filter((data)=>{return data.value.startsWith(term);});
                data.unshift(...add_data);
            }
        }
        if (IAC.user_settings.source_grouping_enabled) {
            GroupSources(data);
        }
    }
    if (IAC.user_settings.usage_enabled) {
        AddUserSelected(type, metatag, term, data, query_type);
    }
    if (IAC.is_bur && IAC.user_settings.BUR_source_enabled) {
        let add_data = bur_data.filter((data)=>{return term.length === 1 || data.value.startsWith(term);});
        data.unshift(...add_data);
        data.splice(IAC.user_settings.source_results_returned);
    }
    //Doing this here to avoid processing it on each list item
    IAC.highlight_used = (document.activeElement.tagName === 'TEXTAREA' && ['post_tag_string','upload_tag_string'].includes(document.activeElement.id));
    if (IAC.highlight_used) {
        let adjusted_tag_string = RemoveTerm(document.activeElement.value, document.activeElement.selectionStart);
        IAC.current_tags = adjusted_tag_string.split(/\s+/);
    }
    resp(data);
}

//Cache functions

function OptionCacheDataKey(data_type,data_value) {
    if (data_type === "related_tag") {
        IAC.related_category = $("#iac-control-related-tag-type").val();
        return `${GetRelatedKeyModifer(IAC.related_category)}-${data_value}`;
    } else {
        return `${reverse_data_key[data_type]}-${data_value}`;
    }
}

function UpdateLocalData(key,data) {
    switch (key) {
        case 'iac-choice-info':
            IAC.choice_order = data.choice_order;
            IAC.choice_data = data.choice_data;
            StoreUsageData('save', '', false);
            //falls through
        default:
            //Do nothing
    }
}

//Settings functions

function BroadcastIAC(ev) {
    BroadcastIAC.debuglog(`(${ev.data.type}):`, (ev.data.type === "reload" ? `${ev.data.name} ${ev.data.key}` : ev.data));
    switch (ev.data.type) {
        case "reload":
            IAC.choice_order = ev.data.choice_order;
            IAC.choice_data = ev.data.choice_data;
            break;
        case "reset":
            Object.assign(IAC, program_reset_keys);
            //falls through
        case "settings":
            IAC.user_settings = ev.data.user_settings;
            IAC.is_setting_menu && JSPLib.menu.updateUserSettings('iac');
            SetTagAutocompleteSource();
            break;
        case "purge":
            Object.keys(sessionStorage).forEach((key)=>{
                if (key.match(program_cache_regex)) {
                    sessionStorage.removeItem(key);
                }
            });
            //falls through
        default:
            //do nothing
    }
}

function SetTagAutocompleteSource() {
    if (IAC.user_settings.alternate_tag_source) {
        source_config.tag = source_config.tag2;
    } else {
        source_config.tag = source_config.tag1;
    }
}

function GetUsageExpires() {
    return IAC.user_settings.usage_expires * JSPLib.utility.one_day;
}

function GetRecheckExpires() {
    return IAC.user_settings.recheck_data_interval * JSPLib.utility.one_day;
}

function RenderSettingsMenu() {
    $("#indexed-autocomplete").append(iac_menu);
    $("#iac-source-settings").append(JSPLib.menu.renderCheckbox('iac', 'BUR_source_enabled'));
    $("#iac-source-settings").append(JSPLib.menu.renderCheckbox('iac', 'metatag_source_enabled'));
    $("#iac-usage-settings").append(JSPLib.menu.renderCheckbox('iac', 'usage_enabled'));
    $("#iac-usage-settings").append(JSPLib.menu.renderTextinput('iac', 'usage_multiplier'));
    $("#iac-usage-settings").append(JSPLib.menu.renderTextinput('iac', 'usage_maximum'));
    $("#iac-usage-settings").append(JSPLib.menu.renderTextinput('iac', 'usage_expires'));
    $("#iac-usage-settings").append(JSPLib.menu.renderCheckbox('iac', 'prefix_check_enabled'));
    $("#iac-display-settings").append(JSPLib.menu.renderTextinput('iac', 'source_results_returned', 5));
    $("#iac-display-settings").append(JSPLib.menu.renderCheckbox('iac', 'source_highlight_enabled'));
    $("#iac-display-settings").append(JSPLib.menu.renderCheckbox('iac', 'source_grouping_enabled'));
    $("#iac-display-settings").append(JSPLib.menu.renderSortlist('iac', 'source_order'));
    $("#iac-sort-settings").append(JSPLib.menu.renderCheckbox('iac', 'alternate_sorting_enabled'));
    $("#iac-sort-settings").append(JSPLib.menu.renderInputSelectors('iac', 'postcount_scale', 'radio'));
    $("#iac-sort-settings").append(JSPLib.menu.renderTextinput('iac', 'exact_source_weight', 5));
    $("#iac-sort-settings").append(JSPLib.menu.renderTextinput('iac', 'prefix_source_weight', 5));
    $("#iac-sort-settings").append(JSPLib.menu.renderTextinput('iac', 'alias_source_weight', 5));
    $("#iac-sort-settings").append(JSPLib.menu.renderTextinput('iac', 'correct_source_weight', 5));
    $("#iac-network-settings").append(JSPLib.menu.renderTextinput('iac', 'recheck_data_interval', 5));
    $("#iac-network-settings").append(JSPLib.menu.renderCheckbox('iac', 'alternate_tag_source'));
    $("#iac-network-settings").append(JSPLib.menu.renderCheckbox('iac', 'network_only_mode'));
    $("#iac-cache-settings").append(JSPLib.menu.renderLinkclick('iac', 'cache_info', "Cache info", "Click to populate", "Calculates the cache usage of the program and compares it to the total usage."));
    $("#iac-cache-settings").append(`<div id="iac-cache-info-table" style="display:none"></div>`);
    $("#iac-cache-settings").append(JSPLib.menu.renderLinkclick('iac', 'purge_cache',`Purge cache (<span id="iac-purge-counter">...</span>)`, "Click to purge", "Dumps all of the cached data related to IndexedAutocomplete."));
    $("#iac-cache-editor-controls").append(JSPLib.menu.renderKeyselect('iac', 'data_source', true, 'indexed_db', all_source_types, "Indexed DB is <b>Cache Data</b> and Local Storage is <b>Program Data</b>."));
    $("#iac-cache-editor-controls").append(JSPLib.menu.renderKeyselect('iac', 'data_type', true, 'tag', all_data_types, "Only applies to Indexed DB. Use <b>Custom</b> for querying by keyname."));
    $("#iac-cache-editor-controls").append(JSPLib.menu.renderKeyselect('iac', 'related_tag_type', true, '', all_related, "Only applies to related tag data."));
    $("#iac-cache-editor-controls").append(JSPLib.menu.renderTextinput('iac', 'data_name', 20, true, "Click <b>Get</b> to see the data, <b>Save</b> to edit it, and <b>Delete</b> to remove it.", ['get','save','delete']));
    JSPLib.menu.engageUI('iac', true, true);
    JSPLib.menu.saveUserSettingsClick('iac', 'IndexedAutocomplete');
    JSPLib.menu.resetUserSettingsClick('iac', 'IndexedAutocomplete', localstorage_keys, program_reset_keys);
    JSPLib.menu.cacheInfoClick('iac', program_cache_regex, "#iac-cache-info-table");
    JSPLib.menu.purgeCacheClick('iac','IndexedAutocomplete', program_cache_regex, "#iac-purge-counter");
    JSPLib.menu.getCacheClick('iac', OptionCacheDataKey);
    JSPLib.menu.saveCacheClick('iac',ValidateProgramData, ValidateEntry, OptionCacheDataKey, UpdateLocalData);
    JSPLib.menu.deleteCacheClick('iac', OptionCacheDataKey);
    JSPLib.menu.cacheAutocomplete('iac', program_cache_regex, OptionCacheDataKey);
}

//Main program

function Main() {
    if (!JSPLib.storage.use_indexed_db) {
        Main.debuglog("No Indexed DB! Exiting...");
        return;
    }
    Danbooru.IAC = IAC = {
        controller: document.body.dataset.controller,
        action: document.body.dataset.action,
        source_data: {},
        choice_info: JSPLib.storage.getStorageData('iac-choice-info', localStorage, {}),
        is_bur: GetIsBur(),
        FindArtistSession: FindArtistSession,
        InitializeAutocompleteIndexed: InitializeAutocompleteIndexed,
        storage_keys: {indexed_db: [], local_storage: []},
        is_setting_menu: JSPLib.danbooru.isSettingMenu(),
        settings_config: settings_config,
        channel: new BroadcastChannel('IndexedAutocomplete')
    };
    IAC.user_settings = JSPLib.menu.loadUserSettings('iac');
    IAC.channel.onmessage = BroadcastIAC;
    //Check this first in case the settings page doesn't have autocomplete inputs in the future
    if (IAC.is_setting_menu) {
        JSPLib.validate.dom_output = "#iac-cache-editor-errors";
        JSPLib.menu.loadStorageKeys('iac', program_cache_regex);
        JSPLib.utility.installScript("https://cdn.jsdelivr.net/gh/jquery/jquery-ui@1.12.1/ui/widgets/tabs.js").done(()=>{
            JSPLib.menu.installSettingsMenu("IndexedAutocomplete");
            Timer.RenderSettingsMenu();
        });
    }
    if ($(autocomplete_domlist.join(',')).length === 0) {
        Main.debuglog("No autocomplete inputs! Exiting...");
        return;
    }
    JSPLib.utility.setCSSStyle(program_css, 'program');
    SetTagAutocompleteSource();
    if (!JSPLib.validate.isHash(IAC.choice_info) || $.isEmptyObject(IAC.choice_info)) {
        //Temporary transitory code
        IAC.choice_order = JSPLib.storage.getStorageData('iac-choice-order', localStorage, {});
        IAC.choice_data = JSPLib.storage.getStorageData('iac-choice-data', localStorage, {});
        JSPLib.storage.setStorageData('iac-choice-info', {choice_order: IAC.choice_order, choice_data: IAC.choice_data}, localStorage);
    } else {
        IAC.choice_order = IAC.choice_info.choice_order;
        IAC.choice_data = IAC.choice_info.choice_data;
    }
    CorrectUsageData();
    /**Autocomplete bindings**/
    Danbooru.Autocomplete.normal_source = AnySourceIndexed('ac');
    Danbooru.Autocomplete.pool_source = AnySourceIndexed('pl');
    Danbooru.Autocomplete.user_source = AnySourceIndexed('us');
    Danbooru.Autocomplete.favorite_group_source = AnySourceIndexed('fg');
    Danbooru.Autocomplete.saved_search_source = AnySourceIndexed('ss', 'search');
    Danbooru.Autocomplete.static_metatag_source = StaticMetatagSource;
    Danbooru.Autocomplete.insert_completion_old = Danbooru.Autocomplete.insert_completion;
    Danbooru.Autocomplete.insert_completion = JSPLib.utility.hijackFunction(Danbooru.Autocomplete.insert_completion, InsertUserSelected);
    Danbooru.Autocomplete.render_item = JSPLib.utility.hijackFunction(Danbooru.Autocomplete.render_item, HighlightSelected);
    RebindRenderCheck();
    //Tag-only queries need to be rebound to account for no metatag complete
    if ($('[data-autocomplete=tag]').length) {
        RebindSingleTag();
    }
    if (['wiki-pages','wiki-page-versions'].includes(IAC.controller)) {
        RebindAnyAutocomplete('[data-autocomplete="wiki-page"]', 'wp');
    }
    if (['artists','artist-versions','artist-urls'].includes(IAC.controller)) {
        RebindAnyAutocomplete('[data-autocomplete="artist"]', 'ar');
    }
    if (['pools','pool-versions'].includes(IAC.controller)) {
        RebindAnyAutocomplete('[data-autocomplete="pool"]', 'pl');
    }
    if (IAC.controller === "posts" && IAC.action === "index") {
        RebindAnyAutocomplete("#saved_search_label_string", 'ss', true);
    }
    if (IAC.controller === "saved-searches" && IAC.action === "edit") {
        $("#saved_search_query").attr('data-autocomplete', 'tag-query');
        setTimeout(Danbooru.Autocomplete.initialize_tag_autocomplete, jquery_delay);
        setTimeout(()=>{InitializeAutocompleteIndexed("#saved_search_label_string", 'ss', true);}, jquery_delay);
    }
    if (IAC.controller === "saved-searches" && IAC.action === "index") {
        $("#search_query_ilike").attr('data-autocomplete', 'tag-query');
        setTimeout(Danbooru.Autocomplete.initialize_tag_autocomplete, jquery_delay);
        setTimeout(()=>{InitializeAutocompleteIndexed("#search_label", 'ss');}, jquery_delay);
    }
    if (IAC.controller === "forum-topics" || IAC.controller === "forum-posts") {
        JSPLib.utility.setCSSStyle(forum_css, 'forum');
        $('#subnav-menu .search_body_matches').closest("li").after(forum_topic_search);
        setTimeout(()=>{InitializeAutocompleteIndexed("#quick_search_title_matches", 'ft');}, jquery_delay);
        if (IAC.action === "search") {
            setTimeout(()=>{InitializeAutocompleteIndexed("#search_topic_title_matches", 'ft');}, jquery_delay);
        }
    }
    if (IAC.controller === "comments") {
        $('#subnav-menu .search_body_matches').closest("li").after(post_comment_search);
        setTimeout(Danbooru.Autocomplete.initialize_tag_autocomplete, jquery_delay);
    }
    if ((IAC.controller === "uploads" && IAC.action === "index") || IAC.is_bur) {
        $("#search_post_tags_match").attr('data-autocomplete', 'tag-query');
        $("#bulk_update_request_script").attr('data-autocomplete', 'tag-edit');
        //The initialize code doesn't work properly unless some time has elapsed after setting the attribute
        setTimeout(Danbooru.Autocomplete.initialize_tag_autocomplete, jquery_delay);
    }
    if ($(autocomplete_user_selectors).length) {
        setTimeout(()=>{InitializeAutocompleteIndexed(autocomplete_user_selectors, 'us');}, jquery_delay);
    }
    /**Non-autocomplete bindings**/
    if ((IAC.controller === "posts" && IAC.action === "show") || (IAC.controller === "uploads" && IAC.action === "new")) {
        RebindRelatedTags();
        if (IAC.controller === "posts") {
            RebindFindArtist();
        } else if (IAC.controller === "uploads") {
            //Is source column empty?
            if (/^\s+$/.test($(".source-related-tags-columns").html())) {
                Main.debuglog("Setting up mutation observer for source data.");
                JSPLib.utility.setupMutationRemoveObserver(".related-tags", ".source-related-tags-columns", ()=>{Timer.SaveArtistData();});
            } else {
                Timer.SaveArtistData();
            }
        }
    }
    /**Other setup**/
    JSPLib.debug.debugExecute(()=>{
        window.addEventListener('beforeunload',()=>{
            JSPLib.statistics.outputAdjustedMean("IndexedAutocomplete");
        });
    });
    //Take care of other non-critical tasks at a later time
    setTimeout(()=>{
        PruneUsageData();
        JSPLib.storage.pruneEntries('iac', program_cache_regex, prune_expires);
    },noncritical_recheck);
}

/****Function decoration****/

JSPLib.debug.addFunctionTimers(Timer,false,[ValidateUsageData,SaveArtistData,RenderTagColumns,RenderSettingsMenu]);

JSPLib.debug.addFunctionTimers(Timer,true,[RelatedTagsButton,FindArtistSession]);

JSPLib.debug.addFunctionLogs([
    Main,BroadcastIAC,NetworkSource,FindArtistSession,RelatedTagsButton,PruneUsageData,CorrectUsageData,InsertUserSelected,
    SaveArtistData,GetArtistData,FixExpirationCallback,ValidateEntry
]);

/****Execution start****/

JSPLib.load.programInitialize(Main, 'IAC', program_load_required_variables, program_load_required_selectors);
