// ==UserScript==
// @name         DisplayPostInfo
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      10.4
// @description  Display views, uploader, and other info to the user.
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        *://*.donmai.us/
// @match        *://*.donmai.us/posts*
// @match        *://*.donmai.us/settings
// @exclude      /^https?://\w+\.donmai\.us/.*\.(xml|json|atom)(\?|$)/
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/displaypostinfo.user.js
// @require      https://cdn.jsdelivr.net/npm/core-js-bundle@3.2.1/minified.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.5.2/localforage.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.12.0/validate.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/crypto-js/3.1.2/rollups/md5.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200507-utility/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200506-storage/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20200505/lib/menu.js
// ==/UserScript==

/* global JSPLib $ Danbooru CryptoJS */

/****Global variables****/

//Library constants

////NONE

//Exterior script variables
const DANBOORU_TOPIC_ID = '15926';
const JQUERY_TAB_WIDGET_URL = 'https://cdn.jsdelivr.net/gh/jquery/jquery-ui@1.12.1/ui/widgets/tabs.js';

//Variables for load.js
const PROGRAM_LOAD_REQUIRED_VARIABLES = ['window.jQuery','Danbooru.PostTooltip'];
const PROGRAM_LOAD_REQUIRED_SELECTORS = ["#page"];
const PROGRAM_LOAD_OPTIONAL_SELECTORS = ['#c-posts #a-show','#c-posts #a-index','#c-users #a-edit'];

//Program name constants
const PROGRAM_SHORTCUT = 'dpi';
const PROGRAM_CLICK = 'click.dpi';
const PROGRAM_NAME = 'DisplayPostInfo';

//Program data constants
const PROGRAM_DATA_REGEX = /^(tt|user|pv)-/; //Regex that matches the prefix of all program cache data
const PROGRAM_DATA_KEY = {
    tag_alias: 'ta',
    tag_implication: 'ti',
    artist_entry: 'are'
};

//Main program variable
var DPI;

//TIMER function hash
const TIMER = {};

//Available setting values
const SOURCE_TYPES = ['original','normalized'];

//Main settings
const SETTINGS_CONFIG = {
    post_views_enabled: {
        default: true,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Shows post views on the post page."
    },
    post_uploader_enabled: {
        default: true,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Shows the post uploader on the post page."
    },
    top_tagger_enabled: {
        default: false,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Shows top tagger on the post page."
    },
    basic_post_tooltip: {
        default: true,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Adds the post uploader to the basic post tooltips."
    },
    advanced_post_tooltip: {
        default: true,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Adds the post uploader to the advanced post tooltips."
    },
    post_statistics_enabled: {
        default: true,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Shows post statistics for all of the posts on a page."
    },
    domain_statistics_enabled: {
        default: true,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Shows domain statistics for all of the posts on a page."
    },
    domain_source_type: {
        allitems: SOURCE_TYPES,
        default: ['normalized'],
        validate: (data)=>{return JSPLib.menu.validateCheckboxRadio(data,'radio',SOURCE_TYPES);},
        hint: "Select the type of post source to be used for domain statistics."
    },
    tag_statistics_enabled: {
        default: true,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Shows the percentage of posts with the tags from the tag column."
    },
};

const all_source_types = ['indexed_db', 'local_storage'];
const all_data_types = ['user_data', 'top_tagger', 'post_views', 'custom'];

const CONTROL_CONFIG = {
    refresh_frequent_tags: {
        value: "Click to refresh",
        hint: "Gets the latest favorite tags from the user's profile.",
    },
    cache_info: {
        value: "Click to populate",
        hint: "Calculates the cache usage of the program and compares it to the total usage.",
    },
    purge_cache: {
        display: `Purge cache (<span id="${PROGRAM_SHORTCUT}-purge-counter">...</span>)`,
        value: "Click to purge",
        hint: `Dumps all of the cached data related to ${PROGRAM_NAME}.`,
    },
    data_source: {
        allitems: all_source_types,
        value: 'indexed_db',
        hint: "Indexed DB is <b>Cache Data</b> and Local Storage is <b>Program Data</b>.",
    },
    data_type: {
        allitems: all_data_types,
        value: 'user_data',
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

let post_index_css = `
#dpi-post-statistics th,
#dpi-domain-statistics th {
    text-align: right;
}
#dpi-post-statistics th,
#dpi-post-statistics td {
    padding: 2px;
}
.dpi-domain-overflow {
    color: blue;
}
.dpi-tag-statistic {
    color:lightpink;
}
#c-posts #a-index #sidebar {
    width: 16em;
}
`;

//HTML constants

const POST_VIEWS_LINE = '<li id="dpi-post-views" style="display:none"></li>'
const USER_NAMES_LINE = `<li id="dpi-post-uploader" style="display:none"></li><li id="dpi-top-tagger" style="display:none"></li>`;

const CACHE_INFO_TABLE = '<div id="dpi-cache-info-table" style="display:none"></div>';

const dpi_menu = `
<div id="dpi-script-message" class="prose">
    <h2>${PROGRAM_NAME}</h2>
    <p>Check the forum for the latest on information and updates (<a class="dtext-link dtext-id-link dtext-forum-topic-id-link" href="/forum_topics/${DANBOORU_TOPIC_ID}">topic #${DANBOORU_TOPIC_ID}</a>).</p>
</div>
<div id="dpi-console" class="jsplib-console">
    <div id="dpi-settings" class="jsplib-outer-menu">
        <div id="dpi-general-settings" class="jsplib-settings-grouping">
            <div id="dpi-general-message" class="prose">
                <h4>General settings</h4>
            </div>
        </div>
        <div id="dpi-information-settings" class="jsplib-settings-grouping">
            <div id="dpi-information-message" class="prose">
                <h4>Information settings</h4>
            </div>
        </div>
        <div id="dpi-tooltip-settings" class="jsplib-settings-grouping">
            <div id="dpi-tooltip-message" class="prose">
                <h4>Tooltip settings</h4>
            </div>
        </div>
        <div id="dpi-statistics-settings" class="jsplib-settings-grouping">
            <div id="dpi-statistics-message" class="prose">
                <h4>Statistics settings</h4>
            </div>
        </div>
        <div id="dpi-cache-settings" class="jsplib-settings-grouping">
            <div id="dpi-cache-message" class="prose">
                <h4>Cache settings</h4>
                <div class="expandable">
                    <div class="expandable-header">
                        <span>Cache Data details</span>
                        <input type="button" value="Show" class="expandable-button">
                    </div>
                    <div class="expandable-content">
                        <ul>
                            <li><b>Top tagger (tt):</b> The user ID of the top tagger.
                                <ul>
                                    <li>The key hash is the post ID plus the MD5 hash of the tags.</li>
                                    <li>This is because any combination of tags has only one top tagger.</li>
                                    <li>Example key: <code>tt-123456-0752fc4b6d2a27c152f1b793ac95c918</code></li>
                                </ul>
                            </li>
                            <li><b>User data (user):</b> Information about the user.</li>
                            <li><b>Post views (pv):</b> Unique view count of a post./li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        <hr>
        <div id="dpi-settings-buttons" class="jsplib-settings-buttons">
            <input type="button" id="dpi-commit" value="Save">
            <input type="button" id="dpi-resetall" value="Factory Reset">
        </div>
    </div>
    <div id="dpi-cache-editor" class="jsplib-outer-menu">
        <div id="dpi-editor-message" class="prose">
            <h4>Cache editor</h4>
            <p>See the <b><a href="#dpi-cache-message">Cache Data</a></b> details for the list of all cache data and what they do.</p>
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
                    </ul>
                </div>
            </div>
        </div>
        <div id="dpi-cache-editor-controls"></div>
        <div id="dpi-cache-editor-errors" class="jsplib-cache-editor-errors"></div>
        <div id="dpi-cache-viewer" class="jsplib-cache-viewer">
            <textarea></textarea>
        </div>
    </div>
</div>
`;

const POST_INDEX_STATISTICS = `
<section id="dpi-post-statistics"></section>
<section id="dpi-domain-statistics"></section>`;

const POST_STATISTICS_TABLE = `
<h1>Post statistics</h1>
<table class="striped">
    <tbody>
        <tr>
            <th>Score:</th>
            <td>%SCORE_AVERAGE% ± %SCORE_DEVIATION%</td>
        </tr>
        <tr>
            <th>Favorites:</th>
            <td>%FAVES_AVERAGE% ± %FAVES_DEVIATION%</td>
        </tr>
        <tr>
            <th>Safe:</th>
            <td>%SAFE_PERCENTAGE%%</td>
        </tr>
        <tr>
            <th><span style="font-size:90%;letter-spacing:-1px">Questionable:</span></th>
            <td>%QUESTIONABLE_PERCENTAGE%%</td>
        </tr>
        <tr>
            <th>Explicit:</th>
            <td>%EXPLICIT_PERCENTAGE%%</td>
        </tr>
        <tr>
            <th>Pending:</th>
            <td>%PENDING_COUNT%</td>
        </tr>
        <tr>
            <th>Banned:</th>
            <td>%BANNED_COUNT%</td>
        </tr>
        <tr>
            <th>Flagged:</th>
            <td>%FLAGGED_COUNT%</td>
        </tr>
        <tr>
            <th>Deleted:</th>
            <td>%DELETED_COUNT%</td>
        </tr>
    </tbody>
</table>`;

const DOMAIN_STATISTICS_TABLE = `
    <h1>Domain statistics</h1>
    <table class="striped">
        <tbody>
        </tbody>
    </table>`;

const DOMAIN_STATISTICS_ROW = `
<tr>
    <th>%DOMAIN_NAME%</th>
    <td>%DOMAIN_COUNT%</th>
</tr>`;

//Time constants
const prune_expires = JSPLib.utility.one_day;
const noncritical_recheck = JSPLib.utility.one_minute;
const thumbnail_hover_delay = 250;
const top_tagger_expiration = JSPLib.utility.one_month;
const user_expiration = JSPLib.utility.one_month;
const bad_user_expiration = JSPLib.utility.one_day;
const min_views_expiration = JSPLib.utility.one_minute;
const mid_views_expiration = JSPLib.utility.one_hour;
const max_views_expiration = JSPLib.utility.one_day;

//Other constants

const user_fields = "id,name,level_string,can_upload_free,can_approve_posts";
const postver_fields = "id,version,updater_id,unchanged_tags,added_tags";

//Data inclusion lists
const all_levels = ["Member","Gold","Platinum","Builder","Moderator","Admin"];

//Validate constants

const top_tagger_constraints = {
    expires: JSPLib.validate.expires_constraints,
    value: JSPLib.validate.id_constraints
};

const user_constraints = {
    entry: JSPLib.validate.hashentry_constraints,
    value: {
        name: JSPLib.validate.stringonly_constraints,
        level: JSPLib.validate.inclusion_constraints(all_levels),
        contributor: JSPLib.validate.boolean_constraints,
        approver: JSPLib.validate.boolean_constraints
    }
};

const view_constraints = {
    expires: JSPLib.validate.expires_constraints,
    value: JSPLib.validate.expires_constraints
};

/****FUNCTIONS****/

//Validate functions

function ValidateEntry(key,entry) {
    if (!JSPLib.validate.validateIsHash(key,entry)) {
        return false;
    }
    if (key.match(/^user-/)) {
        return ValidateUserEntry(key,entry);
    } else if (key.match(/^tt-/)) {
        return JSPLib.validate.validateHashEntries(key, entry, top_tagger_constraints);
    } else if (key.match(/^pv-/)) {
        return JSPLib.validate.validateHashEntries(key, entry, view_constraints);
    }
    ValidateEntry.debuglog("Bad key!");
    return false;
}

function ValidateUserEntry(key,entry) {
    if (!JSPLib.validate.validateHashEntries(key, entry, user_constraints.entry)) {
        return false;
    }
    return JSPLib.validate.validateHashEntries(key + '.value', entry.value, user_constraints.value);
}

function ValidateProgramData(key,entry) {
    var checkerror=[];
    switch (key) {
        case 'dpi-user-settings':
            checkerror = JSPLib.menu.validateUserSettings(entry, SETTINGS_CONFIG);
            break;
        case 'dpi-prune-expires':
            if (!Number.isInteger(entry)) {
                checkerror = ["Value is not an integer."];
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

//Auxiliary functions

function BlankUser(user_id) {
    return {
        name: `user_${user_id}`,
        level: "Member",
        contributor: false,
        approver: false,
    };
}

function MapUserData(user) {
    return {
        name: user.name,
        level: user.level_string,
        contributor: user.can_upload_free,
        approver: user.can_approve_posts
    };
}

function RenderUsername(user_id,user_data) {
    let user_name = JSPLib.utility.maxLengthString(user_data.name.replace(/_/g,' '));
    let level_class = "user-" + user_data.level.toLowerCase();
    let unlimited_class = (user_data.contributor ? " user-post-uploader" : "");
    let approver_class = (user_data.approver ? " user-post-approver" : "");
    return `<a class="dpi-username ${level_class}${unlimited_class}${approver_class} with-style" href="/users/${user_id}">${user_name}</a>`;
}

function PopulateUserTags(current_tags,added_tags,user_tags,version_order,updater_id) {
    user_tags[updater_id] = user_tags[updater_id] || [];
    user_tags[updater_id] = JSPLib.utility.concat(user_tags[updater_id], (added_tags));
    version_order.unshift(updater_id);
    current_tags.tags = JSPLib.utility.setDifference(current_tags.tags,added_tags);
}

function SaveMappedListData(mapped_data,expiration) {
    mapped_data.forEach((user)=>{
        let user_id = Object.keys(user)[0];
        JSPLib.storage.saveData(`user-${user_id}`, {value: user[user_id], expires: JSPLib.utility.getExpires(expiration)});
    });
}

function LogarithmicExpiration(count, max_count, time_divisor, multiplier) {
    let time_exponent = Math.pow(10,(1/time_divisor));
    return Math.round(Math.log10(time_exponent + (10 - time_exponent) * (count / max_count)) * multiplier);
}

function PostViewsExpiration(created_timestamp) {
    let created_interval = Date.now() - created_timestamp;
    if (created_interval < JSPLib.utility.one_hour) {
        return min_views_expiration
    } else if (created_interval < JSPLib.utility.one_day) {
        let hour_interval = (created_interval / JSPLib.utility.one_hour) - 1; //Start at 0 hours and go to 23 hours
        let hour_slots = 23; //There are 23 hour slots between 1 hour and 24 hours
        let minutes_hour = 60;
        return LogarithmicExpiration(hour_interval, hour_slots, minutes_hour, mid_views_expiration);
    } else if (created_interval < JSPLib.utility.one_month) {
        let day_interval = (created_interval / JSPLib.utility.one_day) - 1; //Start at 0 days and go to 29 days
        let day_slots = 29; //There are 29 days slots between 1 day and 30 days
        let hours_day = 24;
        return LogarithmicExpiration(day_interval, day_slots, hours_day, max_views_expiration);
    } else {
        return max_views_expiration;
    }
}

//Network functions

async function GetUserData(user_id) {
    let user_key = `user-${user_id}`;
    let data = await JSPLib.storage.checkLocalDB(user_key, ValidateEntry, user_expiration);
    if (!data) {
        GetUserData.debuglog("Querying:", user_id);
        let user_data = await JSPLib.danbooru.submitRequest("users", {search: {id: user_id, expiry: 30}, only: user_fields});
        if (user_data && user_data.length) {
            var mapped_data = MapUserData(user_data[0]);
            JSPLib.storage.saveData(user_key,{value: mapped_data, expires: JSPLib.utility.getExpires(user_expiration)});
        } else {
            GetUserData.debuglog("Missing user:", user_id);
            mapped_data = BlankUser(user_id);
            JSPLib.storage.saveData(user_key,{value: mapped_data, expires: JSPLib.utility.getExpires(bad_user_expiration)});
        }
    } else {
        mapped_data = data.value;
    }
    return mapped_data;
}
GetUserData.promises = {};

async function GetUserListData(userid_list) {
    var mapped_list_data = [];
    let [found_users,missing_users] = await JSPLib.storage.batchStorageCheck(userid_list, ValidateEntry, user_expiration, 'user');
    if (missing_users.length) {
        GetUserListData.debuglog("Missing users:", missing_users);
        let user_list = await JSPLib.danbooru.submitRequest("users", {search: {id: missing_users.join(',')}, limit: missing_users.length, only: user_fields});
        mapped_list_data = user_list.map((user)=>{return {[user.id]: MapUserData(user)};});
        SaveMappedListData(mapped_list_data, user_expiration);
        if (user_list.length !== missing_users.length) {
            let found_users = JSPLib.utility.getObjectAttributes(user_list,'id');
            let bad_users = JSPLib.utility.setDifference(missing_users,found_users);
            GetUserListData.debuglog("Bad users:", bad_users);
            let bad_data = bad_users.map((userid)=>{return {[userid]: BlankUser(userid)};});
            SaveMappedListData(bad_data, bad_user_expiration);
            mapped_list_data = JSPLib.utility.concat(mapped_list_data, bad_data);
        }
    }
    if (found_users.length) {
        GetUserListData.debuglog("Found users:", found_users);
        let found_data = found_users.map((userid)=>{
            //Just in case...
            let default_val = {value: BlankUser(userid)};
            return {[userid]: JSPLib.storage.getStorageData('user-' + userid, sessionStorage, default_val).value};
        });
        mapped_list_data = JSPLib.utility.concat(mapped_list_data, found_data);
    }
    return Object.assign({},...mapped_list_data);
}

//Main execution functions

////#A-SHOW

async function DisplayPostViews() {
    var post_views;
    let post_id = $('.image-container').data('id');
    let views_key = `pv-${post_id}`;
    DisplayPostViews.debuglog("Checking:", post_id);
    let view_data = await JSPLib.storage.checkLocalDB(views_key, ValidateEntry, max_views_expiration);
    if (!view_data) {
        let post_timestamp = new Date($("#post-information time").attr("datetime")).getTime();
        let expiration_time = PostViewsExpiration(post_timestamp);
        try {
            post_views = await $.get(`https://isshiki.donmai.us/post_views/${post_id}`);
        } catch(e) {
            let error_text = `${e.status} ${e.responseText || e.statusText}`;
            DisplayPostViews.debuglog("Error:", e.status, e.responseText || e.statusText);
            $("#dpi-post-views").html(`Views: ${error_text}`).show();
            return;
        }
        //If the post was created within the hour, then only cache in session storage, else cache normally
        if (expiration_time === min_views_expiration) {
            JSPLib.storage.setStorageData(views_key, {value: post_views, expires: JSPLib.utility.getExpires(expiration_time)}, sessionStorage);
        } else {
            JSPLib.storage.saveData(views_key, {value: post_views, expires: JSPLib.utility.getExpires(expiration_time)});
        }
    } else {
        post_views = view_data.value;
    }
    $("#dpi-post-views").html(`Views: ${post_views}`).show();
}

async function DisplayPostUploader() {
    let uploader_id = $(".image-container").data('uploader-id');
    if (!(uploader_id in GetUserData.promises)) {
        GetUserData.promises[uploader_id] = GetUserData(uploader_id);
    }
    let user_data = await GetUserData.promises[uploader_id];
    let name_html = RenderUsername(uploader_id,user_data);
    let search_html = JSPLib.danbooru.postSearchLink("user:" + user_data.name, "&raquo;");
    $("#dpi-post-uploader").html(`Uploader: ${name_html}&ensp;${search_html}`).show();
}

async function DisplayTopTagger() {
    var name_html, top_tagger_id;
    let $image = $(".image-container");
    let uploader_id = $image.data('uploader-id');
    let post_id = $image.data('id');
    let tag_string = $image.data('tags')
    let tag_hash = CryptoJS.MD5(tag_string).toString();
    let key_hash = `tt-${post_id}-${tag_hash}`;
    let data = await JSPLib.storage.checkLocalDB(key_hash, ValidateEntry, top_tagger_expiration);
    if (!data) {
        DisplayTopTagger.debuglog("Cache miss:",key_hash);
        //Hashed so that it's mutable
        let current_tags = {tags: tag_string.split(' ')};
        let user_tags = DPI.user_tags = {};
        let version_order = DPI.version_order = [];
        let post_versions = await JSPLib.danbooru.submitRequest('post_versions',{search: {post_id: post_id}, limit: 1000, only: postver_fields});
        if (post_versions && post_versions.length) {
            post_versions.sort((a,b)=>{return a.version - b.version;});
            if (post_versions[0].unchanged_tags.length !== 0) {
                let true_adds = JSPLib.utility.setIntersection(current_tags.tags,post_versions[0].unchanged_tags.split(' '));
                PopulateUserTags(current_tags,true_adds,user_tags,version_order,uploader_id);
            }
            post_versions.forEach((postver)=>{
                let true_adds = JSPLib.utility.setIntersection(postver.added_tags,current_tags.tags);
                if (true_adds.length) {
                    let updater_id = postver.updater_id || 13;
                    PopulateUserTags(current_tags,true_adds,user_tags,version_order,updater_id);
                }
            });
            version_order = JSPLib.utility.setUnique(version_order);
            let user_order = Object.keys(user_tags).map(Number).sort((a,b)=>{return user_tags[b].length - user_tags[a].length;});
            let top_taggers = user_order.filter((user)=>{return user_tags[user].length === user_tags[user_order[0]].length;});
            if (top_taggers.length > 1) {
                top_taggers.sort((a,b)=>{return version_order.indexOf(b) - version_order.indexOf(a);});
            }
            top_tagger_id = top_taggers[0];
            DisplayTopTagger.debuglog("Top tagger found:",top_tagger_id);
            JSPLib.storage.saveData(key_hash,{value: top_tagger_id, expires: JSPLib.utility.getExpires(top_tagger_expiration)});
        } else {
            DisplayTopTagger.debuglog("Error: No post versions found",post_versions);
            name_html = "No data!";
        }
    } else {
        top_tagger_id = data.value;
        DisplayTopTagger.debuglog("Cache hit:",key_hash);
    }
    if (top_tagger_id) {
        if (!(top_tagger_id in GetUserData.promises)) {
            GetUserData.promises[top_tagger_id] = GetUserData(top_tagger_id);
        }
        let user_data = await GetUserData.promises[top_tagger_id];
        name_html = RenderUsername(top_tagger_id,user_data);
    }
    $("#dpi-top-tagger").html(`Top tagger: ${name_html}`).show();
}

////#A-INDEX

async function RenderTooltip(render_promise, event, qtip) {
    let [,data] = await Promise.all([render_promise, DPI.all_uploaders]);
    var uploader_id = $(event.target).closest('.post-preview').data("uploader-id");
    if (!(uploader_id in data)) {
        data[uploader_id] = await GetUserData(uploader_id);
    }
    let name_html = RenderUsername(uploader_id, data[uploader_id]);
    $(".post-tooltip-header-left", qtip.elements.content[0]).prepend(name_html);
}

function UpdateThumbnailTitles() {
    DPI.all_uploaders.then((data)=>{
        $(".post-preview").each((i,entry)=>{
            let uploader_id = $(entry).data('uploader-id');
            let $image = $("img",entry);
            let title = $image.attr('title');
            title += ` user:${data[uploader_id].name}`;
            $image.attr('title',title);
        });
    });
}

function ProcessTagStatistics() {
    let $search_tags = $("#tag-box .search-tag");
    let $post_previews = $(".post-preview");
    let total_posts = $post_previews.length;
    let post_tags = $post_previews.map((i,entry)=>{return [$(entry).data('tags').split(' ')];}).toArray();
    let column_tags = $search_tags.map((i,entry)=>{return $(entry).text().replace(/ /g,'_');}).toArray();
    let column_info = {};
    column_tags.forEach((tag)=>{
        column_info[tag] = post_tags.filter((entry)=>{return entry.includes(tag);}).length;
    });
    $search_tags.each((i,entry)=>{
        let tag = column_tags[i];
        let tag_percentage = Math.ceil(100 * (column_info[tag] / total_posts)) || 0;
        let tag_percentage_string = JSPLib.utility.padNumber(tag_percentage, 2) + '%';
        let spacing_tyle = (tag_percentage === 100 ? `style="letter-spacing:-2px"` : "");
        $(entry).before(` <span class="dpi-tag-statistic" ${spacing_tyle}>${tag_percentage_string}</span> `);
    });
}

function ProcessPostStatistics() {
    let $post_previews = $(".post-preview");
    let total_posts = $post_previews.length;
    let score_list = JSPLib.utility.getDOMAttributes($post_previews, 'score', Number);
    let faves_list = JSPLib.utility.getDOMAttributes($post_previews, 'fav-count', Number);
    let safe_count = $post_previews.filter("[data-rating=s]").length;
    let questionable_count = $post_previews.filter("[data-rating=q]").length;
    let explicit_count = $post_previews.filter("[data-rating=e]").length;
    let statistics_html = JSPLib.utility.regexReplace(POST_STATISTICS_TABLE, {
        SCORE_AVERAGE: JSPLib.utility.setPrecision(JSPLib.statistics.average(score_list), 1) || 0,
        SCORE_DEVIATION: JSPLib.utility.setPrecision(JSPLib.statistics.standardDeviation(score_list), 1) || 0,
        FAVES_AVERAGE: JSPLib.utility.setPrecision(JSPLib.statistics.average(faves_list), 1) || 0,
        FAVES_DEVIATION: JSPLib.utility.setPrecision(JSPLib.statistics.standardDeviation(faves_list), 1) ||0,
        SAFE_PERCENTAGE: Math.ceil(100 * (safe_count / total_posts)) || 0,
        QUESTIONABLE_PERCENTAGE: Math.ceil(100 * (questionable_count / total_posts)) || 0,
        EXPLICIT_PERCENTAGE: Math.ceil(100 * (explicit_count / total_posts)) || 0,
        PENDING_COUNT: $post_previews.filter('[data-flags*="pending"]').length,
        BANNED_COUNT: $post_previews.filter('[data-flags*="banned"]').length,
        FLAGGED_COUNT: $post_previews.filter('[data-flags*="flagged"]').length,
        DELETED_COUNT: $post_previews.filter('[data-flags*="deleted"]').length,
    });
    $('#dpi-post-statistics').append(statistics_html);
}

function ProcessDomainStatistics() {
    let $domain_table = $(DOMAIN_STATISTICS_TABLE);
    let source_key = GetSourceDataKey();
    let domain_frequency = $(".post-preview")
        .map((i,preview)=>{
            try {
                //Will generate an exception for non-URL sources
                return JSPLib.utility.getDomainName($(preview).data(source_key), 2);
            } catch (e) {
                return "";
            }
        })
        .toArray()
        .filter((host)=>host !== "")
        .reduce((total,host)=>{
            total[host] = total[host] || 0;
            total[host]++;
            return total;
        }, {});
    let domain_keys = Object.keys(domain_frequency).sort((a,b) => domain_frequency[b] - domain_frequency[a]);
    domain_keys.forEach((domain)=>{
        let [class_addon,title_addon] = (domain.length > JSPLib.utility.max_column_characters ? ['class="dpi-domain-overflow"', `title="${domain}"`] : ["", ""]);
        $('tbody', $domain_table).append(
            JSPLib.utility.regexReplace(DOMAIN_STATISTICS_ROW, {
                DOMAIN_NAME: `<span ${class_addon} ${title_addon}>${JSPLib.utility.maxLengthString(domain)}</span>`,
                DOMAIN_COUNT: domain_frequency[domain],
            })
        );
    });
    $('#dpi-domain-statistics').append($domain_table);
}

//Settings functions

function RemoteSettingsCallback() {
    InitializeChangedSettings();
}

function InitializeChangedSettings() {
    if (DPI.controller === 'posts' && DPI.action === 'show') {
        if (JSPLib.menu.hasSettingChanged('post_views_enabled')) {
            let $post_views = $("#dpi-post-views");
            if (DPI.user_settings.post_views_enabled) {
                if ($post_views.text() === "") {
                    TIMER.DisplayPostViews();
                } else {
                    $post_views.show();
                }
            } else {
                $post_views.hide();
            }
        }
        if (JSPLib.menu.hasSettingChanged('post_uploader_enabled')) {
            let $post_uploader = $("#dpi-post-uploader");
            if (DPI.user_settings.post_uploader_enabled) {
                if ($post_uploader.text() === "") {
                    TIMER.DisplayPostUploader();
                } else {
                    $post_uploader.show();
                }
            } else {
                $post_uploader.hide();
            }
        }
        if (JSPLib.menu.hasSettingChanged('top_tagger_enabled')) {
            let $top_tagger = $("#dpi-top-tagger");
            if (DPI.user_settings.top_tagger_enabled) {
                if ($top_tagger.text() === "") {
                    TIMER.DisplayTopTagger();
                } else {
                    $top_tagger.show();
                }
            } else {
                $top_tagger.hide();
            }
        }
    } else if (DPI.controller === 'posts' && DPI.action === 'index') {
        if (JSPLib.menu.hasSettingChanged('post_statistics_enabled')) {
            let $post_statistics = $("#dpi-post-statistics");
            if (DPI.user_settings.post_statistics_enabled) {
                if ($post_statistics.children().length === 0) {
                    ProcessPostStatistics();
                } else {
                    $post_statistics.show();
                }
            } else {
                $post_statistics.hide();
            }
        }
        if (JSPLib.menu.hasSettingChanged('domain_statistics_enabled')) {
            let $domain_statistics = $('#dpi-domain-statistics');
            if (DPI.user_settings.domain_statistics_enabled) {
                if ($domain_statistics.children().length === 0) {
                    ProcessDomainStatistics();
                } else {
                    $domain_statistics.show();
                }
            } else {
                $domain_statistics.hide();
            }
        }
        if (JSPLib.menu.hasSettingChanged('tag_statistics_enabled')) {
            let $tag_statistics = $(".dpi-tag-statistic");
            if (DPI.user_settings.tag_statistics_enabled) {
                if ($tag_statistics.length === 0) {
                    ProcessTagStatistics();
                } else {
                    $tag_statistics.show();
                }
            } else {
                $tag_statistics.hide();
            }
        }
        //Not handling tooltips or domain source at this time
    }
}

function GetSourceDataKey() {
    switch (DPI.user_settings.domain_source_type[0]) {
        case 'original':
            return 'source';
        case 'normalized':
            return 'normalized-source';
    }
}

function RenderSettingsMenu() {
    $("#display-post-info").append(dpi_menu);
    $("#dpi-general-settings").append(JSPLib.menu.renderDomainSelectors());
    $("#dpi-information-settings").append(JSPLib.menu.renderCheckbox('post_views_enabled'));
    $("#dpi-information-settings").append(JSPLib.menu.renderCheckbox('post_uploader_enabled'));
    $("#dpi-information-settings").append(JSPLib.menu.renderCheckbox('top_tagger_enabled'));
    $("#dpi-tooltip-settings").append(JSPLib.menu.renderCheckbox('basic_post_tooltip'));
    $("#dpi-tooltip-settings").append(JSPLib.menu.renderCheckbox('advanced_post_tooltip'));
    $("#dpi-statistics-settings").append(JSPLib.menu.renderCheckbox('post_statistics_enabled'));
    $("#dpi-statistics-settings").append(JSPLib.menu.renderCheckbox('domain_statistics_enabled'));
    $("#dpi-statistics-settings").append(JSPLib.menu.renderInputSelectors('domain_source_type', 'radio'));
    $("#dpi-statistics-settings").append(JSPLib.menu.renderCheckbox('tag_statistics_enabled'));
    $("#dpi-cache-settings").append(JSPLib.menu.renderLinkclick('cache_info', true));
    $("#dpi-cache-settings").append(CACHE_INFO_TABLE);
    $("#dpi-cache-settings").append(JSPLib.menu.renderLinkclick('purge_cache', true));
    $("#dpi-cache-editor-controls").append(JSPLib.menu.renderKeyselect('data_source', true));
    $("#dpi-cache-editor-controls").append(JSPLib.menu.renderDataSourceSections());
    $("#dpi-section-indexed-db").append(JSPLib.menu.renderKeyselect('data_type', true));
    $("#dpi-section-local-storage").append(JSPLib.menu.renderCheckbox('raw_data', true));
    $("#dpi-cache-editor-controls").append(JSPLib.menu.renderTextinput('data_name', 20, true));
    JSPLib.menu.engageUI(true);
    JSPLib.menu.saveUserSettingsClick();
    JSPLib.menu.resetUserSettingsClick();
    JSPLib.menu.cacheInfoClick();
    JSPLib.menu.purgeCacheClick();
    JSPLib.menu.dataSourceChange();
    JSPLib.menu.rawDataChange();
    JSPLib.menu.getCacheClick();
    JSPLib.menu.saveCacheClick(ValidateProgramData, ValidateEntry);
    JSPLib.menu.deleteCacheClick();
    JSPLib.menu.cacheAutocomplete();
}

//Main program

function Main() {
    Danbooru.DPI = DPI = {
        controller: document.body.dataset.controller,
        action: document.body.dataset.action,
        basic_tooltips: Danbooru.CurrentUser.data('disable-post-tooltips'),
        settings_config: SETTINGS_CONFIG,
        control_config: CONTROL_CONFIG,
    };
    Object.assign(DPI, {
        user_settings: JSPLib.menu.loadUserSettings(),
    });
    if (JSPLib.danbooru.isSettingMenu()) {
        JSPLib.menu.loadStorageKeys();
        JSPLib.utility.installScript(JQUERY_TAB_WIDGET_URL).done(()=>{
            JSPLib.menu.installSettingsMenu();
            RenderSettingsMenu();
        });
        return;
    }
    if (!JSPLib.menu.isScriptEnabled()) {
        Main.debuglog("Script is disabled on", window.location.hostname);
        return;
    }
    if (DPI.controller === 'posts' && DPI.action === 'show') {
        $('#post-information #post-info-score').after(POST_VIEWS_LINE);
        $('#post-information #post-info-date').after(USER_NAMES_LINE);
        if (DPI.user_settings.post_views_enabled) {
            TIMER.DisplayPostViews();
        }
        if (DPI.user_settings.post_uploader_enabled) {
            TIMER.DisplayPostUploader();
        }
        if (DPI.user_settings.top_tagger_enabled) {
            TIMER.DisplayTopTagger();
        }
    } else if (DPI.controller === 'posts' && DPI.action === 'index') {
        let all_uploaders = JSPLib.utility.setUnique(JSPLib.utility.getDOMAttributes($(".post-preview"), 'uploader-id'));
        DPI.all_uploaders = TIMER.GetUserListData(all_uploaders);
        if (!Danbooru.DPI.basic_tooltips && DPI.user_settings.advanced_post_tooltip) {
            Danbooru.PostTooltip.QTIP_OPTIONS.content = JSPLib.utility.hijackFunction(Danbooru.PostTooltip.render_tooltip, RenderTooltip);
        } else if (Danbooru.DPI.basic_tooltips && DPI.user_settings.basic_post_tooltip) {
            UpdateThumbnailTitles();
        }
        $('#tag-box').after(POST_INDEX_STATISTICS);
        if (DPI.user_settings.post_statistics_enabled) {
            ProcessPostStatistics();
        }
        if (DPI.user_settings.domain_statistics_enabled) {
            ProcessDomainStatistics();
        }
        if (DPI.user_settings.tag_statistics_enabled) {
            ProcessTagStatistics();
        }
        JSPLib.utility.setCSSStyle(post_index_css,'program');
    }
    JSPLib.statistics.addPageStatistics(PROGRAM_NAME);
    setTimeout(()=>{
        JSPLib.storage.pruneEntries(PROGRAM_SHORTCUT, PROGRAM_DATA_REGEX, prune_expires);
    }, noncritical_recheck);
}

/****Function decoration****/

JSPLib.debug.addFunctionTimers(TIMER, false, [
    RenderSettingsMenu
]);

JSPLib.debug.addFunctionTimers(TIMER, true, [
    DisplayPostViews, DisplayPostUploader, DisplayTopTagger, GetUserListData,
]);

JSPLib.debug.addFunctionLogs([
    Main, GetUserData, DisplayPostViews, DisplayTopTagger, RenderTooltip, GetUserListData, ValidateEntry,
]);

/****Initialization****/

//Variables for debug.js
JSPLib.debug.debug_console = false;
JSPLib.debug.pretext = "DPI:";
JSPLib.debug.pretimer = "DPI-";
JSPLib.debug.level = JSPLib.debug.INFO;

//Variables for menu.js
JSPLib.menu.program_shortcut = PROGRAM_SHORTCUT;
JSPLib.menu.program_name = PROGRAM_NAME;
JSPLib.menu.program_data_regex = PROGRAM_DATA_REGEX;
JSPLib.menu.program_data_key = PROGRAM_DATA_KEY;
JSPLib.menu.settings_callback = RemoteSettingsCallback;

//Export JSPLib
if (JSPLib.debug.debug_console) {
    window.JSPLib.lib = window.JSPLib.lib || {};
    window.JSPLib.lib[PROGRAM_NAME] = JSPLib;
}

/****Execution start****/

JSPLib.load.programInitialize(Main, PROGRAM_NAME, PROGRAM_LOAD_REQUIRED_VARIABLES, PROGRAM_LOAD_REQUIRED_SELECTORS, PROGRAM_LOAD_OPTIONAL_SELECTORS);
