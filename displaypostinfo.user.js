// ==UserScript==
// @name         DisplayPostInfo
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      12.0
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
// @require      https://cdnjs.cloudflare.com/ajax/libs/core-js/3.8.1/minified.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.9.0/localforage.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.13.1/validate.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.0.0/core.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.0.0/md5.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201230-module/lib/module.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/notice.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201215/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20201230-menu/lib/menu.js
// ==/UserScript==

/* global JSPLib $ Danbooru CryptoJS */

/****Global variables****/

//Library constants

////NONE

//Exterior script variables
const DANBOORU_TOPIC_ID = '15926';

//Variables for load.js
const PROGRAM_LOAD_REQUIRED_VARIABLES = ['window.jQuery','Danbooru.PostTooltip'];
const PROGRAM_LOAD_REQUIRED_SELECTORS = ["#page"];
const PROGRAM_LOAD_OPTIONAL_SELECTORS = ['#c-posts #a-show','#c-posts #a-index','#c-users #a-edit'];

//Program name constants
const PROGRAM_SHORTCUT = 'dpi';
const PROGRAM_NAME = 'DisplayPostInfo';

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
const SOURCE_TYPES = ['original','normalized'];

//Main settings
const SETTINGS_CONFIG = {
    post_views_enabled: {
        default: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Shows post views on the post page."
    },
    top_tagger_enabled: {
        default: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Shows top tagger on the post page."
    },
    basic_post_tooltip: {
        default: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Adds the post uploader to the basic post tooltips."
    },
    advanced_post_tooltip: {
        default: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Enables the configuration of post tooltip settings."
    },
    post_show_delay: {
        default: 500,
        parse: parseInt,
        validate: (data) => (Number.isInteger(data) && data >= 0),
        hint: "How long to delay showing the post tooltip (in milliseconds)."
    },
    post_hide_delay: {
        default: 125,
        parse: parseInt,
        validate: (data) => (Number.isInteger(data) && data >= 0),
        hint: "How long to delay hiding the post tooltip (in milliseconds)."
    },
    post_favorites_enabled: {
        default: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Adds attributes to posts that allows the user to apply their own CSS styles to them."
    },
    post_statistics_enabled: {
        default: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Shows post statistics for all of the posts on a page."
    },
    domain_statistics_enabled: {
        default: false,
        validate: JSPLib.validate.isBoolean,
        hint: "Shows domain statistics for all of the posts on a page."
    },
    domain_source_type: {
        allitems: SOURCE_TYPES,
        default: ['normalized'],
        validate: (data) => JSPLib.menu.validateCheckboxRadio(data,'radio',SOURCE_TYPES),
        hint: "Select the type of post source to be used for domain statistics."
    },
    tag_statistics_enabled: {
        default: false,
        validate: JSPLib.validate.isBoolean,
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
        buttons: ['get', 'save', 'delete', 'list', 'refresh'],
        hint: "Click <b>Get</b> to see the data, <b>Save</b> to edit it, and <b>Delete</b> to remove it.<br><b>List</b> shows keys in their raw format, and <b>Refresh</b> checks the keys again.",
    },
};

const MENU_CONFIG = {
    topic_id: DANBOORU_TOPIC_ID,
    settings: [{
        name: 'general',
    },{
        name: 'information',
    },{
        name: 'tooltip',
    },{
        name: 'statistics',
    }],
    controls: [],
};

// Default values

const DEFAULT_VALUES = {
    user_promises: {},
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

const POST_VIEWS_LINE = '<li id="dpi-post-views" style="display:none"></li>';
const USER_NAMES_LINE = '<li id="dpi-top-tagger" style="display:none"></li>';

const CACHE_DATA_DETAILS = `
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

const PROGRAM_DATA_DETAILS = `
<p class="tn">All timestamps are in milliseconds since the epoch (<a href="https://www.epochconverter.com">Epoch converter</a>).</p>
<ul>
    <li>General data
        <ul>
            <li><b>prune-expires:</b> When the program will next check for cache data that has expired.</li>
            <li><b>user-settings:</b> All configurable settings.</li>
        </ul>
    </li>
</ul>`;

const POST_INDEX_STATISTICS = `
<section id="dpi-post-statistics"></section>
<section id="dpi-domain-statistics"></section>`;

const POST_STATISTICS_TABLE = `
<h2>Post statistics</h2>
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
<h2>Domain statistics</h2>
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
    this.debug('log',"Bad key!");
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
    return `<a class="dpi-username ${level_class}${unlimited_class}${approver_class} user" data-user-id="${user_id}" data-user-name="${user_name}" href="/users/${user_id}" aria-expanded="false">${user_name}</a>`;
}

function PopulateUserTags(current_tags,added_tags,user_tags,version_order,updater_id) {
    user_tags[updater_id] = user_tags[updater_id] || [];
    user_tags[updater_id] = JSPLib.utility.concat(user_tags[updater_id], (added_tags));
    version_order.unshift(updater_id);
    current_tags.tags = JSPLib.utility.arrayDifference(current_tags.tags,added_tags);
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
        return min_views_expiration;
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
        this.debug('log',"Querying:", user_id);
        let user_data = await JSPLib.danbooru.submitRequest("users", {search: {id: user_id, expiry: 30}, only: user_fields});
        if (user_data && user_data.length) {
            var mapped_data = MapUserData(user_data[0]);
            JSPLib.storage.saveData(user_key,{value: mapped_data, expires: JSPLib.utility.getExpires(user_expiration)});
        } else {
            this.debug('log',"Missing user:", user_id);
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
        this.debug('log',"Missing users:", missing_users);
        let user_list = await JSPLib.danbooru.submitRequest("users", {search: {id: missing_users.join(',')}, limit: missing_users.length, only: user_fields});
        mapped_list_data = user_list.map((user) => ({[user.id]: MapUserData(user)}));
        SaveMappedListData(mapped_list_data, user_expiration);
        if (user_list.length !== missing_users.length) {
            let found_users = JSPLib.utility.getObjectAttributes(user_list,'id');
            let bad_users = JSPLib.utility.arrayDifference(missing_users,found_users);
            this.debug('log',"Bad users:", bad_users);
            let bad_data = bad_users.map((userid) => ({[userid]: BlankUser(userid)}));
            SaveMappedListData(bad_data, bad_user_expiration);
            mapped_list_data = JSPLib.utility.concat(mapped_list_data, bad_data);
        }
    }
    if (found_users.length) {
        this.debug('log',"Found users:", found_users);
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
    this.debug('log',"Checking:", post_id);
    let view_data = await JSPLib.storage.checkLocalDB(views_key, ValidateEntry, max_views_expiration);
    if (!view_data) {
        let post_timestamp = new Date($("#post-information time").attr("datetime")).getTime();
        let expiration_time = PostViewsExpiration(post_timestamp);
        try {
            post_views = await $.get(`https://isshiki.donmai.us/post_views/${post_id}`);
        } catch(e) {
            let error_text = `${e.status} ${e.responseText || e.statusText}`;
            this.debug('log',"Error:", e.status, e.responseText || e.statusText);
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

async function DisplayTopTagger() {
    var name_html, top_tagger_id;
    let $image = $(".image-container");
    let uploader_id = $image.data('uploader-id');
    let post_id = $image.data('id');
    let tag_string = $image.data('tags');
    let tag_hash = CryptoJS.MD5(tag_string).toString();
    let key_hash = `tt-${post_id}-${tag_hash}`;
    let data = await JSPLib.storage.checkLocalDB(key_hash, ValidateEntry, top_tagger_expiration);
    if (!data) {
        this.debug('log',"Cache miss:",key_hash);
        //Hashed so that it's mutable
        let current_tags = {tags: tag_string.split(' ')};
        let user_tags = DPI.user_tags = {};
        let version_order = DPI.version_order = [];
        let post_versions = await JSPLib.danbooru.submitRequest('post_versions',{search: {post_id: post_id}, limit: 1000, only: postver_fields});
        if (post_versions && post_versions.length) {
            post_versions.sort((a,b) => (a.version - b.version));
            if (post_versions[0].unchanged_tags.length !== 0) {
                let true_adds = JSPLib.utility.arrayIntersection(current_tags.tags,post_versions[0].unchanged_tags.split(' '));
                PopulateUserTags(current_tags,true_adds,user_tags,version_order,uploader_id);
            }
            post_versions.forEach((postver)=>{
                let true_adds = JSPLib.utility.arrayIntersection(postver.added_tags,current_tags.tags);
                if (true_adds.length) {
                    let updater_id = postver.updater_id || 13;
                    PopulateUserTags(current_tags,true_adds,user_tags,version_order,updater_id);
                }
            });
            version_order = JSPLib.utility.arrayUnique(version_order);
            let user_order = Object.keys(user_tags).map(Number).sort((a,b) => (user_tags[b].length - user_tags[a].length));
            let top_taggers = user_order.filter((user) => (user_tags[user].length === user_tags[user_order[0]].length));
            if (top_taggers.length > 1) {
                top_taggers.sort((a,b) => (version_order.indexOf(b) - version_order.indexOf(a)));
            }
            top_tagger_id = top_taggers[0];
            this.debug('log',"Top tagger found:",top_tagger_id);
            JSPLib.storage.saveData(key_hash,{value: top_tagger_id, expires: JSPLib.utility.getExpires(top_tagger_expiration)});
        } else {
            this.debug('log',"Error: No post versions found",post_versions);
            name_html = "No data!";
        }
    } else {
        top_tagger_id = data.value;
        this.debug('log',"Cache hit:",key_hash);
    }
    if (top_tagger_id) {
        if (!(top_tagger_id in DPI.user_promises)) {
            DPI.user_promises[top_tagger_id] = GetUserData(top_tagger_id);
        }
        let user_data = await DPI.user_promises[top_tagger_id];
        name_html = RenderUsername(top_tagger_id,user_data);
    }
    $("#dpi-top-tagger").html(`Top tagger: ${name_html}`).show();
}

////#A-INDEX

async function RenderTooltip(render_promise, instance) {
    await Promise.all([render_promise, DPI.favorites_promise]);
    let $target = $(instance.reference);
    let post_id = $target.closest('.post-preview').data('id');
    if (!DPI.favorite_ids.includes(post_id)) {
        return;
    }
    $(instance.popper).find('.fa-heart').switchClass('far', 'fas');
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

async function ProcessPostFavorites() {
    let $post_previews = $(".post-preview");
    let post_ids = $post_previews.map((i,entry) => $(entry).data('id')).toArray();
    let favorites = await JSPLib.danbooru.submitRequest('favorites', {search: {user_id: DPI.user_id, post_id: post_ids.join(',')}, limit: post_ids.length, only: 'post_id'});
    DPI.favorite_ids = JSPLib.utility.getObjectAttributes(favorites, 'post_id');
    $post_previews.each((i,entry)=>{
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
    let post_tags = $post_previews.map((i,entry) => [$(entry).data('tags').split(' ')]).toArray();
    let column_tags = $search_tags.map((i,entry) => $(entry).text().replace(/ /g,'_')).toArray();
    let column_info = {};
    column_tags.forEach((tag)=>{
        column_info[tag] = post_tags.filter((entry) => entry.includes(tag)).length;
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
        .filter((host) => (host !== ""))
        .reduce((total,host)=>{
            total[host] = total[host] || 0;
            total[host]++;
            return total;
        }, {});
    let domain_keys = Object.keys(domain_frequency).sort((a,b) => (domain_frequency[b] - domain_frequency[a]));
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
                    DisplayPostViews();
                } else {
                    $post_views.show();
                }
            } else {
                $post_views.hide();
            }
        }
        if (JSPLib.menu.hasSettingChanged('top_tagger_enabled')) {
            let $top_tagger = $("#dpi-top-tagger");
            if (DPI.user_settings.top_tagger_enabled) {
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
    $('#display-post-info').append(JSPLib.menu.renderMenuFramework(MENU_CONFIG));
    $("#dpi-general-settings").append(JSPLib.menu.renderDomainSelectors());
    $("#dpi-information-settings").append(JSPLib.menu.renderCheckbox('post_views_enabled'));
    $("#dpi-information-settings").append(JSPLib.menu.renderCheckbox('top_tagger_enabled'));
    $("#dpi-information-settings").append(JSPLib.menu.renderCheckbox('post_favorites_enabled'));
    $("#dpi-tooltip-settings").append(JSPLib.menu.renderCheckbox('basic_post_tooltip'));
    $("#dpi-tooltip-settings").append(JSPLib.menu.renderCheckbox('advanced_post_tooltip'));
    $('#dpi-tooltip-settings').append(JSPLib.menu.renderTextinput('post_show_delay', 10));
    $('#dpi-tooltip-settings').append(JSPLib.menu.renderTextinput('post_hide_delay', 10));
    $("#dpi-statistics-settings").append(JSPLib.menu.renderCheckbox('post_statistics_enabled'));
    $("#dpi-statistics-settings").append(JSPLib.menu.renderCheckbox('domain_statistics_enabled'));
    $("#dpi-statistics-settings").append(JSPLib.menu.renderInputSelectors('domain_source_type', 'radio'));
    $("#dpi-statistics-settings").append(JSPLib.menu.renderCheckbox('tag_statistics_enabled'));
    $('#dpi-controls').append(JSPLib.menu.renderCacheControls());
    $('#dpi-cache-controls-message').append(JSPLib.menu.renderExpandable("Cache Data details", CACHE_DATA_DETAILS));
    $("#dpi-cache-controls").append(JSPLib.menu.renderLinkclick('cache_info', true));
    $('#dpi-cache-controls').append(JSPLib.menu.renderCacheInfoTable());
    $("#dpi-cache-controls").append(JSPLib.menu.renderLinkclick('purge_cache', true));
    $('#dpi-controls').append(JSPLib.menu.renderCacheEditor(true));
    $('#dpi-cache-editor-message').append(JSPLib.menu.renderExpandable("Program Data details",PROGRAM_DATA_DETAILS));
    $("#dpi-cache-editor-controls").append(JSPLib.menu.renderKeyselect('data_source', true));
    $("#dpi-cache-editor-controls").append(JSPLib.menu.renderDataSourceSections());
    $("#dpi-section-indexed-db").append(JSPLib.menu.renderKeyselect('data_type', true));
    $("#dpi-section-local-storage").append(JSPLib.menu.renderCheckbox('raw_data', true));
    $("#dpi-cache-editor-controls").append(JSPLib.menu.renderTextinput('data_name', 20, true));
    JSPLib.menu.engageUI(true);
    JSPLib.menu.saveUserSettingsClick();
    JSPLib.menu.resetUserSettingsClick();
    JSPLib.menu.cacheInfoClick();
    JSPLib.menu.expandableClick();
    JSPLib.menu.purgeCacheClick();
    JSPLib.menu.dataSourceChange();
    JSPLib.menu.rawDataChange();
    JSPLib.menu.getCacheClick(ValidateProgramData);
    JSPLib.menu.saveCacheClick(ValidateProgramData, ValidateEntry);
    JSPLib.menu.deleteCacheClick();
    JSPLib.menu.listCacheClick();
    JSPLib.menu.refreshCacheClick();
    JSPLib.menu.cacheAutocomplete();
}

//Main program

function Main() {
    Object.assign(DPI, {
        controller: document.body.dataset.controller,
        action: document.body.dataset.action,
        user_id: Danbooru.CurrentUser.data('id'),
        basic_tooltips: Danbooru.CurrentUser.data('disable-post-tooltips'),
        user_settings: JSPLib.menu.loadUserSettings(),
    }, DEFAULT_VALUES);
    if (JSPLib.danbooru.isSettingMenu()) {
        JSPLib.menu.initializeSettingsMenu(RenderSettingsMenu);
        return;
    }
    if (!JSPLib.menu.isScriptEnabled()) {
        this.debug('log',"Script is disabled on", window.location.hostname);
        return;
    }
    if (DPI.controller === 'posts' && DPI.action === 'show') {
        $('#post-information #post-info-score').after(POST_VIEWS_LINE);
        $('#post-information #post-info-uploader').after(USER_NAMES_LINE);
        if (DPI.user_settings.post_views_enabled) {
            DisplayPostViews();
        }
        if (DPI.user_settings.top_tagger_enabled) {
            DisplayTopTagger();
        }
    } else if (DPI.controller === 'posts' && DPI.action === 'index') {
        let all_uploaders = JSPLib.utility.arrayUnique(JSPLib.utility.getDOMAttributes($(".post-preview"), 'uploader-id'));
        DPI.all_uploaders = GetUserListData(all_uploaders);
        if (!DPI.basic_tooltips && DPI.user_settings.advanced_post_tooltip) {
            if (DPI.user_settings.post_favorites_enabled) {
                Danbooru.PostTooltip.on_show = JSPLib.utility.hijackFunction(Danbooru.PostTooltip.on_show, RenderTooltip);
            }
            Danbooru.PostTooltip.SHOW_DELAY = DPI.user_settings.post_show_delay;
            Danbooru.PostTooltip.HIDE_DELAY = DPI.user_settings.post_hide_delay;
            if (document.body._tippy) {
                $(document).off("click.danbooru.postTooltip");
                document.body._tippy.destroy();
                Danbooru.PostTooltip.initialize();
            }
        } else if (DPI.basic_tooltips && DPI.user_settings.basic_post_tooltip) {
            UpdateThumbnailTitles();
        }
        if (DPI.user_settings.post_favorites_enabled) {
            DPI.favorites_promise = ProcessPostFavorites();
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

[
    Main, GetUserData, DisplayPostViews, DisplayTopTagger, GetUserListData, ValidateEntry,
] = JSPLib.debug.addFunctionLogs([
    Main, GetUserData, DisplayPostViews, DisplayTopTagger, GetUserListData, ValidateEntry,
]);

[
    RenderSettingsMenu,
    DisplayPostViews, DisplayTopTagger, GetUserListData,
] = JSPLib.debug.addFunctionTimers([
    //Sync
    RenderSettingsMenu,
    //Async
    DisplayPostViews, DisplayTopTagger, GetUserListData,
]);

/****Initialization****/

//Variables for debug.js
JSPLib.debug.debug_console = false;
JSPLib.debug.level = JSPLib.debug.INFO;
JSPLib.debug.program_shortcut = PROGRAM_SHORTCUT;

//Variables for menu.js
JSPLib.menu.program_shortcut = PROGRAM_SHORTCUT;
JSPLib.menu.program_name = PROGRAM_NAME;
JSPLib.menu.program_data = DPI;
JSPLib.menu.program_data_regex = PROGRAM_DATA_REGEX;
JSPLib.menu.program_data_key = PROGRAM_DATA_KEY;
JSPLib.menu.settings_callback = RemoteSettingsCallback;
JSPLib.menu.settings_config = SETTINGS_CONFIG;
JSPLib.menu.control_config = CONTROL_CONFIG;

//Export JSPLib
JSPLib.load.exportData(PROGRAM_NAME, DPI);

/****Execution start****/

JSPLib.load.programInitialize(Main, PROGRAM_NAME, PROGRAM_LOAD_REQUIRED_VARIABLES, PROGRAM_LOAD_REQUIRED_SELECTORS, PROGRAM_LOAD_OPTIONAL_SELECTORS);
