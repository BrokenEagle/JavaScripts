// ==UserScript==
// @name         DisplayPostInfo
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      12.15
// @description  Display views, uploader, and other info to the user.
// @source       https://danbooru.donmai.us/users/23799
// @author       BrokenEagle
// @match        https://*.donmai.us/*
// @exclude      /^(?!https:\/\/\w+\.donmai\.us\/?(posts(\/\d+)?|settings)?\/?(\?|$)).*/
// @exclude      /^https://\w+\.donmai\.us/.*\.(xml|json|atom)(\?|$)/
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/DisplayPostInfo.user.js
// @updateURL    https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/DisplayPostInfo.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.5.2/localforage.min.js
// @require      https://cdn.jsdelivr.net/npm/localforage-getitems@1.4.2/dist/localforage-getitems.min.js
// @require      https://cdn.jsdelivr.net/npm/localforage-removeitems@1.4.0/dist/localforage-removeitems.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.13.1/validate.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/core.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/md5.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/8be8b18e19ebdac9f269e35e4fe4b1a98472756f/lib/module.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/8be8b18e19ebdac9f269e35e4fe4b1a98472756f/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/8be8b18e19ebdac9f269e35e4fe4b1a98472756f/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/8be8b18e19ebdac9f269e35e4fe4b1a98472756f/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/8be8b18e19ebdac9f269e35e4fe4b1a98472756f/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/8be8b18e19ebdac9f269e35e4fe4b1a98472756f/lib/concurrency.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/8be8b18e19ebdac9f269e35e4fe4b1a98472756f/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/8be8b18e19ebdac9f269e35e4fe4b1a98472756f/lib/template.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/8be8b18e19ebdac9f269e35e4fe4b1a98472756f/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/8be8b18e19ebdac9f269e35e4fe4b1a98472756f/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/8be8b18e19ebdac9f269e35e4fe4b1a98472756f/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/8be8b18e19ebdac9f269e35e4fe4b1a98472756f/lib/menu.js
// ==/UserScript==

/* global JSPLib $ CryptoJS */

(({DanbooruProxy, Debug, Utility, Storage, Template, Validate, Statistics, Danbooru, Load, Menu}) => {

const PROGRAM_NAME = 'DisplayPostInfo';
const PROGRAM_SHORTCUT = 'dpi';

/****Library updates****/

////NONE

/****Global variables****/

//Exterior script variables
const DANBOORU_TOPIC_ID = '15926';

//Variables for load.js
const PROGRAM_LOAD_REQUIRED_VARIABLES = ['window.jQuery', 'window.Danbooru', 'Danbooru.PostTooltip'];
const PROGRAM_LOAD_OPTIONAL_SELECTORS = ['#c-posts #a-show', '#c-posts #a-index', '#c-users #a-edit'];

//Program data constants
const PROGRAM_DATA_REGEX = /^(tt|user|pv)-/; //Regex that matches the prefix of all program cache data
const PROGRAM_DATA_KEY = {
    user_data: 'user',
    top_tagger: 'tt',
    post_views: 'pv',
};

//Main program variable
const DPI = {};

//Available setting values

//Main settings
const SETTINGS_CONFIG = {
    post_views_enabled: {
        reset: false,
        validate: Utility.isBoolean,
        hint: "Shows post views on the post page."
    },
    top_tagger_enabled: {
        reset: false,
        validate: Utility.isBoolean,
        hint: "Shows top tagger on the post page."
    },
    basic_post_tooltip: {
        reset: false,
        validate: Utility.isBoolean,
        hint: "Adds the post uploader to the basic post tooltips."
    },
    advanced_post_tooltip: {
        reset: false,
        validate: Utility.isBoolean,
        hint: "Enables the configuration of post tooltip settings."
    },
    post_show_delay: {
        reset: 500,
        parse: parseInt,
        validate: (data) => (Number.isInteger(data) && data >= 0),
        hint: "How long to delay showing the post tooltip (in milliseconds)."
    },
    post_hide_delay: {
        reset: 125,
        parse: parseInt,
        validate: (data) => (Number.isInteger(data) && data >= 0),
        hint: "How long to delay hiding the post tooltip (in milliseconds)."
    },
    post_favorites_enabled: {
        reset: false,
        validate: Utility.isBoolean,
        hint: "Adds attributes to posts that allows the user to apply their own CSS styles to them."
    },
    post_statistics_enabled: {
        reset: false,
        validate: Utility.isBoolean,
        hint: "Shows post statistics for all of the posts on a page."
    },
    domain_statistics_enabled: {
        reset: false,
        validate: Utility.isBoolean,
        hint: "Shows domain statistics for all of the posts on a page."
    },
    tag_statistics_enabled: {
        reset: false,
        validate: Utility.isBoolean,
        hint: "Shows the percentage of posts with the tags from the tag column."
    },
};

const ALL_SOURCE_TYPES = ['indexed_db', 'local_storage'];
const ALL_DATA_TYPES = ['user_data', 'top_tagger', 'post_views', 'custom'];

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
        allitems: ALL_SOURCE_TYPES,
        value: 'indexed_db',
        hint: "Indexed DB is <b>Cache Data</b> and Local Storage is <b>Program Data</b>.",
    },
    data_type: {
        allitems: ALL_DATA_TYPES,
        value: 'user_data',
        hint: "Select type of data. Use <b>Custom</b> for querying by keyname.",
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
        name: 'information',
    }, {
        name: 'tooltip',
    }, {
        name: 'statistics',
    }],
    controls: [],
};

// Default values

const DEFAULT_VALUES = {
    user_promises: {},
};

//CSS constants

const POST_INDEX_CSS = Template.normalizeCSS()`
.dpi-table th {
    text-align: right;
}
#dpi-post-statistics {
    th, td {
        padding: 2px;
    }
}
.dpi-domain-overflow {
    color: blue;
}
.dpi-tag-statistic {
    color: lightpink;
}
#c-posts #a-index #sidebar {
    width: 16em;
}`;

//HTML constants

const POST_VIEWS_LINE = '<li id="dpi-post-views" style="display:none"></li>';
const USER_NAMES_LINE = '<li id="dpi-top-tagger" style="display:none"></li>';

const CACHE_DATA_DETAILS = Template.normalizeHTML()`
<ul>
    <li><b>Top tagger (tt):</b> The user ID of the top tagger.
        <ul>
            <li>The key hash is the post ID plus the MD5 hash of the tags.</li>
            <li>This is because any combination of tags has only one top tagger.</li>
            <li>Example key: <code>tt-123456-0752fc4b6d2a27c152f1b793ac95c918</code></li>
        </ul>
    </li>
    <li><b>User data (user):</b> Information about the user.</li>
    <li><b>Post views (pv):</b> Unique view count of a post.</li>
</ul>`;

const PROGRAM_DATA_DETAILS = Template.normalizeHTML()`
<p class="tn">All timestamps are in milliseconds since the epoch (<a href="https://www.epochconverter.com">Epoch converter</a>).</p>
<ul>
    <li>General data
        <ul>
            <li><b>prune-expires:</b> When the program will next check for cache data that has expired.</li>
            <li><b>user-settings:</b> All configurable settings.</li>
        </ul>
    </li>
</ul>`;

const POST_INDEX_STATISTICS = Template.normalizeHTML()`
<section id="dpi-post-statistics" class="dpi-table"></section>
<section id="dpi-domain-statistics" class="dpi-table"></section>`;

const POST_STATISTICS_TABLE = Template.normalizeHTML()`
<h2>Post statistics</h2>
<table class="striped">
    <tbody>
        <tr>
            <th>Score:</th>
            <td>%SCORE_AVERAGE% ± %SCORE_DEVIATION%</td>
        </tr>
        <tr>
            <th>General:</th>
            <td>%GENERAL_PERCENTAGE%%</td>
        </tr>
        <tr>
            <th>Sensitive:</th>
            <td>%SENSITIVE_PERCENTAGE%%</td>
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

const DOMAIN_STATISTICS_TABLE = Template.normalizeHTML()`
<h2>Domain statistics</h2>
<table class="striped">
    <tbody>
    </tbody>
</table>`;

const DOMAIN_STATISTICS_ROW = Template.normalizeHTML()`
<tr>
    <th>%DOMAIN_NAME%</th>
    <td>%DOMAIN_COUNT%</th>
</tr>`;

//Time constants

const PRUNE_EXPIRES = Utility.one_day;
const TOP_TAGGER_EXPIRATION = Utility.one_month;
const USER_EXPIRATION = Utility.one_month;
const BAD_USER_EXPIRATION = Utility.one_day;
const MIN_VIEWS_EXPIRATION = Utility.one_minute;
const MID_VIEWS_EXPIRATION = Utility.one_hour;
const MAX_VIEWS_EXPIRATION = Utility.one_day;

//Other constants

const USER_FIELDS = "id,name,level_string";
const POSTVER_FIELDS = "id,version,updater_id,unchanged_tags,added_tags";

//Data inclusion lists

const ALL_LEVELS = ['Restricted', 'Member', 'Gold', 'Platinum', 'Builder', 'Contributor', 'Approver', 'Moderator', 'Admin', 'Owner'];

//Validate constants

const TOP_TAGGER_CONSTRAINTS = {
    expires: Validate.expires_constraints,
    value: Validate.id_constraints
};

const USER_CONSTRAINTS = {
    entry: Validate.hashentry_constraints,
    value: {
        name: Validate.stringonly_constraints,
        level: Validate.inclusion_constraints(ALL_LEVELS),
    }
};

const VIEW_CONSTRAINTS = {
    expires: Validate.expires_constraints,
    value: Validate.expires_constraints
};

/****FUNCTIONS****/

//Validate functions

function ValidateEntry(key, entry) {
    const printer = Debug.getFunctionPrint('ValidateEntry');
    if (!Validate.validateIsHash(key, entry)) {
        return false;
    }
    if (key.match(/^user-/)) {
        return ValidateUserEntry(key, entry);
    } if (key.match(/^tt-/)) {
        return Validate.validateHashEntries(key, entry, TOP_TAGGER_CONSTRAINTS);
    } if (key.match(/^pv-/)) {
        return Validate.validateHashEntries(key, entry, VIEW_CONSTRAINTS);
    }
    printer.log("Bad key!");
    return false;
}

function ValidateUserEntry(key, entry) {
    if (!Validate.validateHashEntries(key, entry, USER_CONSTRAINTS.entry)) {
        return false;
    }
    return Validate.validateHashEntries(key + '.value', entry.value, USER_CONSTRAINTS.value);
}

function ValidateProgramData(key, entry) {
    var checkerror = [];
    switch (key) {
        case 'dpi-user-settings':
            checkerror = Menu.validateUserSettings(entry, SETTINGS_CONFIG);
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
        Validate.outputValidateError(key, checkerror);
        return false;
    }
    return true;
}

//Auxiliary functions

function BlankUser(user_id) {
    return {
        name: `user_${user_id}`,
        level: "Member",
    };
}

function MapUserData(user) {
    return {
        name: user.name,
        level: user.level_string,
    };
}

function BlankUsers(user_ids) {
    let mapped_users = {};
    user_ids.forEach((user_id) => {
        mapped_users[user_id] = BlankUser(user_id);
    });
    return mapped_users;
}

function MapUsersData(users) {
    let mapped_users = {};
    users.forEach((user) => {
        mapped_users[user.id] = MapUserData(user);
    });
    return mapped_users;
}

function SaveMappedListData(mapped_data, expiration) {
    for (let key in mapped_data) {
        Storage.saveData(`user-${key}`, {value: mapped_data[key], expires: Utility.getExpires(expiration)});
    }
}

function RenderUsername(user_id, user_data) {
    let user_name = Utility.maxLengthString(user_data.name.replace(/_/g, ' '));
    let level_class = "user-" + user_data.level.toLowerCase();
    return `<a class="dpi-username ${level_class} user" data-user-id="${user_id}" data-user-name="${user_name}" href="/users/${user_id}" aria-expanded="false">${user_name}</a>`;
}

function PopulateUserTags(current_tags, added_tags, user_tags, version_order, updater_id) {
    user_tags[updater_id] = user_tags[updater_id] || [];
    user_tags[updater_id] = Utility.concat(user_tags[updater_id], (added_tags));
    version_order.unshift(updater_id);
    current_tags.tags = Utility.arrayDifference(current_tags.tags, added_tags);
}

function LogarithmicExpiration(count, max_count, time_divisor, multiplier) {
    let time_exponent = Math.pow(10, (1 / time_divisor));
    return Math.round(Math.log10(time_exponent + (10 - time_exponent) * (count / max_count)) * multiplier);
}

function PostViewsExpiration(created_timestamp) {
    let created_interval = Date.now() - created_timestamp;
    if (created_interval < Utility.one_hour) {
        return MIN_VIEWS_EXPIRATION;
    } if (created_interval < Utility.one_day) {
        let hour_interval = (created_interval / Utility.one_hour) - 1; //Start at 0 hours and go to 23 hours
        let hour_slots = 23; //There are 23 hour slots between 1 hour and 24 hours
        let minutes_hour = 60;
        return LogarithmicExpiration(hour_interval, hour_slots, minutes_hour, MID_VIEWS_EXPIRATION);
    } if (created_interval < Utility.one_month) {
        let day_interval = (created_interval / Utility.one_day) - 1; //Start at 0 days and go to 29 days
        let day_slots = 29; //There are 29 days slots between 1 day and 30 days
        let hours_day = 24;
        return LogarithmicExpiration(day_interval, day_slots, hours_day, MAX_VIEWS_EXPIRATION);
    }
    return MAX_VIEWS_EXPIRATION;
}

//Network functions

async function GetUserData(user_id) {
    const printer = Debug.getFunctionPrint('GetUserData');
    let user_key = `user-${user_id}`;
    let data = await Storage.checkLocalDB(user_key, USER_EXPIRATION);
    var mapped_data;
    if (!data) {
        printer.log("Querying:", user_id);
        let user_data = await Danbooru.submitRequest("users", {search: {id: user_id, expiry: 30}, only: USER_FIELDS});
        if (user_data && user_data.length) {
            mapped_data = MapUserData(user_data[0]);
            Storage.saveData(user_key, {value: mapped_data, expires: Utility.getExpires(USER_EXPIRATION)});
        } else {
            printer.log("Missing user:", user_id);
            mapped_data = BlankUser(user_id);
            Storage.saveData(user_key, {value: mapped_data, expires: Utility.getExpires(BAD_USER_EXPIRATION)});
        }
    } else {
        mapped_data = data.value;
    }
    return mapped_data;
}

async function GetUsersData(user_ids) {
    const printer = Debug.getFunctionPrint('GetUsersData');
    let user_keys = user_ids.map((user_id) => 'user-' + user_id);
    let cached = await Storage.batchCheckLocalDB(user_keys, USER_EXPIRATION);
    let missing_keys = Utility.arrayDifference(user_keys, Object.keys(cached));
    if (missing_keys.length) {
        printer.log("Missing users:", missing_keys);
        let missing_ids = missing_keys.map((key) => Number(key.replace('user-', "")));
        let users = await Danbooru.submitRequest("users", {search: {id: missing_ids.join(',')}, limit: missing_ids.length, only: USER_FIELDS});
        let mapped_users = MapUsersData(users);
        SaveMappedListData(mapped_users, USER_EXPIRATION);
        cached = Utility.mergeHashes(cached, mapped_users);
        if (users.length !== missing_keys.length) {
            let network_ids = Utility.getObjectAttributes(users, 'id');
            let bad_ids = Utility.arrayDifference(missing_ids, network_ids);
            printer.log("Bad users:", bad_ids);
            let bad_users = BlankUsers(bad_ids);
            SaveMappedListData(bad_users, BAD_USER_EXPIRATION);
            cached = Utility.mergeHashes(cached, bad_users);
        }
    }
    return cached;
}

//Main execution functions

////#A-SHOW

async function DisplayPostViews() {
    const printer = Debug.getFunctionPrint('DisplayPostViews');
    var post_views;
    let post_id = $('.image-container').data('id');
    let views_key = `pv-${post_id}`;
    printer.log("Checking:", post_id);
    let view_data = await Storage.checkLocalDB(views_key, MAX_VIEWS_EXPIRATION);
    if (!view_data) {
        let post_timestamp = new Date($("#post-information time").attr("datetime")).getTime();
        let expiration_time = PostViewsExpiration(post_timestamp);
        try {
            post_views = await $.get(`https://isshiki.donmai.us/post_views/${post_id}`);
        } catch(e) {
            let error_text = `${e.status} ${e.responseText || e.statusText}`;
            printer.log("Error:", e.status, e.responseText || e.statusText);
            $("#dpi-post-views").html(`Views: ${error_text}`).show();
            return;
        }
        //If the post was created within the hour, then only cache in session storage, else cache normally
        if (expiration_time === MIN_VIEWS_EXPIRATION) {
            Storage.setSessionData(views_key, {value: post_views, expires: Utility.getExpires(expiration_time)});
        } else {
            Storage.saveData(views_key, {value: post_views, expires: Utility.getExpires(expiration_time)});
        }
    } else {
        post_views = view_data.value;
    }
    $("#dpi-post-views").html(`Views: ${post_views}`).show();
}

async function DisplayTopTagger() {
    const printer = Debug.getFunctionPrint('DisplayTopTagger');
    var name_html, top_tagger_id;
    let $image = $(".image-container");
    let uploader_id = $image.data('uploader-id');
    let post_id = $image.data('id');
    let tag_string = $image.data('tags');
    let tag_hash = CryptoJS.MD5(tag_string).toString();
    let key_hash = `tt-${post_id}-${tag_hash}`;
    let data = await Storage.checkLocalDB(key_hash, TOP_TAGGER_EXPIRATION);
    if (!data) {
        printer.log("Cache miss:", key_hash);
        //Hashed so that it's mutable
        let current_tags = {tags: tag_string.split(' ')};
        let user_tags = DPI.user_tags = {};
        let version_order = DPI.version_order = [];
        let post_versions = await Danbooru.submitRequest('post_versions', {search: {post_id}, limit: 1000, only: POSTVER_FIELDS});
        if (post_versions && post_versions.length) {
            post_versions.sort((a, b) => (a.version - b.version));
            if (post_versions[0].unchanged_tags.length !== 0) {
                let true_adds = Utility.arrayIntersection(current_tags.tags, post_versions[0].unchanged_tags.split(' '));
                PopulateUserTags(current_tags, true_adds, user_tags, version_order, uploader_id);
            }
            post_versions.forEach((postver) => {
                let true_adds = Utility.arrayIntersection(postver.added_tags, current_tags.tags);
                if (true_adds.length) {
                    let updater_id = postver.updater_id || 13;
                    PopulateUserTags(current_tags, true_adds, user_tags, version_order, updater_id);
                }
            });
            version_order = Utility.arrayUnique(version_order);
            let user_order = Object.keys(user_tags).map(Number).sort((a, b) => (user_tags[b].length - user_tags[a].length));
            let top_taggers = user_order.filter((user) => (user_tags[user].length === user_tags[user_order[0]].length));
            if (top_taggers.length > 1) {
                top_taggers.sort((a, b) => (version_order.indexOf(b) - version_order.indexOf(a)));
            }
            top_tagger_id = top_taggers[0];
            printer.log("Top tagger found:", top_tagger_id);
            Storage.saveData(key_hash, {value: top_tagger_id, expires: Utility.getExpires(TOP_TAGGER_EXPIRATION)});
        } else {
            printer.log("Error: No post versions found", post_versions);
            name_html = "No data!";
        }
    } else {
        top_tagger_id = data.value;
        printer.log("Cache hit:", key_hash);
    }
    if (top_tagger_id) {
        if (!(top_tagger_id in DPI.user_promises)) {
            DPI.user_promises[top_tagger_id] = GetUserData(top_tagger_id);
        }
        let user_data = await DPI.user_promises[top_tagger_id];
        name_html = RenderUsername(top_tagger_id, user_data);
    }
    $("#dpi-top-tagger").html(`Top tagger: ${name_html}`).show();
}

////#A-INDEX

function UpdateThumbnailTitles() {
    DPI.all_uploaders.then((data) => {
        $(".post-preview").each((_, entry) => {
            let uploader_id = $(entry).data('uploader-id');
            let $image = $("img", entry);
            let title = $image.attr('title');
            title += ` user:${data[uploader_id].name}`;
            $image.attr('title', title);
        });
    });
}

async function ProcessPostFavorites() {
    let $post_previews = $(".post-preview");
    let post_ids = $post_previews.map((_, entry) => $(entry).data('id')).toArray();
    let favorites = await Danbooru.submitRequest('favorites', {search: {user_id: DPI.user_id, post_id: post_ids.join(',')}, limit: post_ids.length, only: 'post_id'});
    DPI.favorite_ids = Utility.getObjectAttributes(favorites, 'post_id');
    $post_previews.each((_, entry) => {
        let $entry = $(entry);
        let post_id = $entry.data('id');
        let is_favorited = DPI.favorite_ids.includes(post_id);
        $entry.attr('data-is-favorited', is_favorited).data('is_favorited', is_favorited);
    });
}

function ProcessTagStatistics() {
    let $search_tags = $("#tag-box .search-tag");
    let $post_previews = $(".post-preview");
    let total_posts = $post_previews.length;
    let post_tags = $post_previews.map((_, entry) => [$(entry).data('tags').split(' ')]).toArray();
    let column_tags = $search_tags.map((_, entry) => $(entry).text().replace(/ /g, '_')).toArray();
    let column_info = {};
    column_tags.forEach((tag) => {
        column_info[tag] = post_tags.filter((entry) => entry.includes(tag)).length;
    });
    $search_tags.each((i, entry) => {
        let tag = column_tags[i];
        let tag_percentage = Math.ceil(100 * (column_info[tag] / total_posts)) || 0;
        let tag_percentage_string = Utility.padNumber(tag_percentage, 2) + '%';
        let spacing_tyle = (tag_percentage === 100 ? `style="letter-spacing:-2px"` : "");
        $(entry).before(` <span class="dpi-tag-statistic" ${spacing_tyle}>${tag_percentage_string}</span> `);
    });
}

function ProcessPostStatistics() {
    let $post_previews = $(".post-preview");
    let total_posts = $post_previews.length;
    let score_list = Utility.getDOMAttributes($post_previews, 'score', Number);
    let general_count = $post_previews.filter("[data-rating=g]").length;
    let sensitive_count = $post_previews.filter("[data-rating=s]").length;
    let questionable_count = $post_previews.filter("[data-rating=q]").length;
    let explicit_count = $post_previews.filter("[data-rating=e]").length;
    let statistics_html = Utility.regexReplace(POST_STATISTICS_TABLE, {
        SCORE_AVERAGE: Utility.setPrecision(Statistics.average(score_list), 1) || 0,
        SCORE_DEVIATION: Utility.setPrecision(Statistics.standardDeviation(score_list), 1) || 0,
        GENERAL_PERCENTAGE: Math.ceil(100 * (general_count / total_posts)) || 0,
        SENSITIVE_PERCENTAGE: Math.ceil(100 * (sensitive_count / total_posts)) || 0,
        QUESTIONABLE_PERCENTAGE: Math.ceil(100 * (questionable_count / total_posts)) || 0,
        EXPLICIT_PERCENTAGE: Math.ceil(100 * (explicit_count / total_posts)) || 0,
        PENDING_COUNT: $post_previews.filter('[data-flags*="pending"]').length,
        BANNED_COUNT: $post_previews.filter('[data-flags*="banned"]').length,
        FLAGGED_COUNT: $post_previews.filter('[data-flags*="flagged"]').length,
        DELETED_COUNT: $post_previews.filter('[data-flags*="deleted"]').length,
    });
    $('#dpi-post-statistics').append(statistics_html);
}

async function ProcessDomainStatistics() {
    let $domain_table = $(DOMAIN_STATISTICS_TABLE);
    let post_ids = Utility.getDOMAttributes($(".post-preview"), 'id', Number);
    let posts = await Danbooru.submitRequest('posts', {tags: `id:${post_ids.join(',')} status:any`, limit: post_ids.length, only: 'source', expires_in: '3600s'});
    let domain_frequency = posts
        .map((post) => {
            try {
                //Will generate an exception for non-URL sources
                return Utility.getDomainName(post.source, 2);
            } catch (e) {
                return "";
            }
        })
        .filter((host) => (host !== ""))
        .reduce((total, host) => {
            total[host] = total[host] || 0;
            total[host]++;
            return total;
        }, {});
    let domain_keys = Object.keys(domain_frequency).sort((a, b) => (domain_frequency[b] - domain_frequency[a]));
    domain_keys.forEach((domain) => {
        let [class_addon, title_addon] = (domain.length > Utility.max_column_characters ? ['class="dpi-domain-overflow"', `title="${domain}"`] : ["", ""]);
        $('tbody', $domain_table).append(
            Utility.regexReplace(DOMAIN_STATISTICS_ROW, {
                DOMAIN_NAME: `<span ${class_addon} ${title_addon}>${Utility.maxLengthString(domain)}</span>`,
                DOMAIN_COUNT: domain_frequency[domain],
            })
        );
    });
    $('#dpi-domain-statistics').append($domain_table);
}

////OTHER

function CleanupTasks() {
    Storage.pruneProgramCache(PROGRAM_SHORTCUT, PROGRAM_DATA_REGEX, PRUNE_EXPIRES);
}

//Settings functions

function RemoteSettingsCallback() {
    //FIX FOR MENU LIBRARY
    setTimeout(() => {InitializeChangedSettings();}, 1);
}

function InitializeChangedSettings() {
    if (DPI.controller === 'posts' && DPI.action === 'show') {
        if (Menu.hasSettingChanged('post_views_enabled')) {
            let $post_views = $("#dpi-post-views");
            if (DPI.post_views_enabled) {
                if ($post_views.text() === "") {
                    DisplayPostViews();
                } else {
                    $post_views.show();
                }
            } else {
                $post_views.hide();
            }
        }
        if (Menu.hasSettingChanged('top_tagger_enabled')) {
            let $top_tagger = $("#dpi-top-tagger");
            if (DPI.top_tagger_enabled) {
                if ($top_tagger.text() === "") {
                    DisplayTopTagger();
                } else {
                    $top_tagger.show();
                }
            } else {
                $top_tagger.hide();
            }
        }
    } else if (DPI.controller === 'posts' && DPI.action === 'index') {
        if (Menu.hasSettingChanged('post_statistics_enabled')) {
            let $post_statistics = $("#dpi-post-statistics");
            if (DPI.post_statistics_enabled) {
                if ($post_statistics.children().length === 0) {
                    ProcessPostStatistics();
                } else {
                    $post_statistics.show();
                }
            } else {
                $post_statistics.hide();
            }
        }
        if (Menu.hasSettingChanged('domain_statistics_enabled')) {
            let $domain_statistics = $('#dpi-domain-statistics');
            if (DPI.domain_statistics_enabled) {
                if ($domain_statistics.children().length === 0) {
                    ProcessDomainStatistics();
                } else {
                    $domain_statistics.show();
                }
            } else {
                $domain_statistics.hide();
            }
        }
        if (Menu.hasSettingChanged('tag_statistics_enabled')) {
            let $tag_statistics = $(".dpi-tag-statistic");
            if (DPI.tag_statistics_enabled) {
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

function InitializeProgramValues() {
    Object.assign(DPI, {
        user_id: DanbooruProxy.CurrentUser.data('id'),
        basic_tooltips: DanbooruProxy.CurrentUser.data('disable-post-tooltips'),
    });
    return true;
}

function RenderSettingsMenu() {
    $('#display-post-info').append(Menu.renderMenuFramework(MENU_CONFIG));
    $("#dpi-general-settings").append(Menu.renderDomainSelectors());
    $("#dpi-information-settings").append(Menu.renderCheckbox('post_views_enabled'));
    $("#dpi-information-settings").append(Menu.renderCheckbox('top_tagger_enabled'));
    $("#dpi-information-settings").append(Menu.renderCheckbox('post_favorites_enabled'));
    $("#dpi-tooltip-settings").append(Menu.renderCheckbox('basic_post_tooltip'));
    $("#dpi-tooltip-settings").append(Menu.renderCheckbox('advanced_post_tooltip'));
    $('#dpi-tooltip-settings').append(Menu.renderTextinput('post_show_delay', 10));
    $('#dpi-tooltip-settings').append(Menu.renderTextinput('post_hide_delay', 10));
    $("#dpi-statistics-settings").append(Menu.renderCheckbox('post_statistics_enabled'));
    $("#dpi-statistics-settings").append(Menu.renderCheckbox('domain_statistics_enabled'));
    $("#dpi-statistics-settings").append(Menu.renderCheckbox('tag_statistics_enabled'));
    $('#dpi-controls').append(Menu.renderCacheControls());
    $('#dpi-cache-controls-message').append(Menu.renderExpandable("Cache Data details", CACHE_DATA_DETAILS));
    $("#dpi-cache-controls").append(Menu.renderLinkclick('cache_info', true));
    $('#dpi-cache-controls').append(Menu.renderCacheInfoTable());
    $("#dpi-cache-controls").append(Menu.renderLinkclick('purge_cache', true));
    $('#dpi-controls').append(Menu.renderCacheEditor(true));
    $('#dpi-cache-editor-message').append(Menu.renderExpandable("Program Data details", PROGRAM_DATA_DETAILS));
    $("#dpi-cache-editor-controls").append(Menu.renderKeyselect('data_source', true));
    $("#dpi-cache-editor-controls").append(Menu.renderDataSourceSections());
    $("#dpi-section-indexed-db").append(Menu.renderKeyselect('data_type', true));
    $("#dpi-section-local-storage").append(Menu.renderCheckbox('raw_data', true));
    $("#dpi-cache-editor-controls").append(Menu.renderTextinput('data_name', 20, true));
    Menu.engageUI({checkboxradio: true});
    Menu.saveUserSettingsClick();
    Menu.resetUserSettingsClick();
    Menu.cacheInfoClick();
    Menu.expandableClick();
    Menu.purgeCacheClick();
    Menu.dataSourceChange();
    Menu.rawDataChange();
    Menu.getCacheClick(ValidateProgramData);
    Menu.saveCacheClick(ValidateProgramData, ValidateEntry);
    Menu.deleteCacheClick();
    Menu.listCacheClick();
    Menu.refreshCacheClick();
    Menu.cacheAutocomplete();
}

//Main program

function Main() {
    const preload = {
        run_on_settings: false,
        default_data: DEFAULT_VALUES,
        initialize_func: InitializeProgramValues,
        render_menu_func: RenderSettingsMenu,
    };
    if (!Menu.preloadScript(DPI, preload)) return;
    if (DPI.controller === 'posts' && DPI.action === 'show') {
        $('#post-information #post-info-score').after(POST_VIEWS_LINE);
        $('#post-information #post-info-uploader').after(USER_NAMES_LINE);
        if (DPI.post_views_enabled) {
            DisplayPostViews();
        }
        if (DPI.top_tagger_enabled) {
            DisplayTopTagger();
        }
    } else if (DPI.controller === 'posts' && DPI.action === 'index') {
        $('#tag-box').after(POST_INDEX_STATISTICS);
        if (DPI.post_statistics_enabled) {
            ProcessPostStatistics();
        }
        if (DPI.domain_statistics_enabled) {
            ProcessDomainStatistics();
        }
        if (DPI.tag_statistics_enabled) {
            ProcessTagStatistics();
        }
        Utility.setCSSStyle(POST_INDEX_CSS, 'program');
    }
    if (DPI.post_favorites_enabled) {
        DPI.favorites_promise = ProcessPostFavorites();
    }
    if (!DPI.basic_tooltips && DPI.advanced_post_tooltip) {
        DanbooruProxy.PostTooltip.SHOW_DELAY = DPI.post_show_delay;
        DanbooruProxy.PostTooltip.HIDE_DELAY = DPI.post_hide_delay;
        if (document.body._tippy) {
            $(document).off("click.danbooru.postTooltip");
            DanbooruProxy.PostTooltip.instance[0].destroy();
            DanbooruProxy.PostTooltip.initialize();
        }
    } else if (DPI.basic_tooltips && DPI.basic_post_tooltip) {
        let all_uploaders = Utility.arrayUnique(Utility.getDOMAttributes($(".post-preview"), 'uploader-id'));
        DPI.all_uploaders = GetUsersData(all_uploaders);
        UpdateThumbnailTitles();
    }
    Statistics.addPageStatistics(PROGRAM_NAME);
    Load.noncriticalTasks(CleanupTasks);
}

/****Initialization****/

//Variables for JSPLib
JSPLib.name = PROGRAM_NAME;
JSPLib.shortcut = PROGRAM_SHORTCUT;
JSPLib.data = DPI;

//Variables for debug.js
Debug.mode = false;
Debug.level = Debug.INFO;

//Variables for menu.js
Menu.data_regex = PROGRAM_DATA_REGEX;
Menu.data_key = PROGRAM_DATA_KEY;
Menu.settings_callback = RemoteSettingsCallback;
Menu.settings_config = SETTINGS_CONFIG;
Menu.control_config = CONTROL_CONFIG;

//Variables for storage.js
Storage.indexedDBValidator = ValidateEntry;
Storage.localSessionValidator = ValidateProgramData;

//Export JSPLib
Load.exportData();

/****Execution start****/

Load.programInitialize(Main, {required_variables: PROGRAM_LOAD_REQUIRED_VARIABLES, optional_selectors: PROGRAM_LOAD_OPTIONAL_SELECTORS});

})(JSPLib);
