// ==UserScript==
// @name         DisplayPostInfo
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      8.5
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
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190929/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190929/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190929/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190929/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190929/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190929/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190929/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190929/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190929/lib/menu.js
// ==/UserScript==

/* global JSPLib $ Danbooru CryptoJS */

/****GLOBAL VARIABLES****/

//Variables for debug.js
JSPLib.debug.debug_console = false;
JSPLib.debug.pretext = "DPI:";
JSPLib.debug.pretimer = "DPI-";
JSPLib.debug.level = JSPLib.debug.INFO;

//Variables for load.js
const program_load_required_variables = ['window.jQuery','Danbooru.PostTooltip'];
const program_load_required_selectors = ["#page"];

//Main program variable
var DPI;

//Timer function hash
const Timer = {};

//Regex that matches the prefix of all program cache data
const program_cache_regex = /^(tt|user|pv)-/

//Main program expires
const prune_expires = JSPLib.utility.one_day;

//For factory reset
const localstorage_keys = [];
const program_reset_keys = {};

const all_source_types = ['indexed_db','local_storage'];
const all_data_types = ['user_data','top_tagger','post_views','custom'];
const reverse_data_key = {
    user_data: 'user',
    top_tagger: 'tt',
    post_views: 'pv'
};

//Main settings
const settings_config = {
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
        hint: "Shows page statistics for all of the posts on a page."
    },
    tag_statistics_enabled: {
        default: true,
        validate: (data)=>{return JSPLib.validate.isBoolean(data);},
        hint: "Shows the percentage of posts with the tags from the tag column."
    },
}

//CSS constants

let post_index_css = `
#dpi-post-statistics th {
    text-align: right;
}
#dpi-post-statistics th,
#dpi-post-statistics td {
    padding: 2px;
}
.dpi-tag-statistic {
    color:lightpink;
}
#c-posts #a-index #sidebar {
    width: 16em;
}
`;

//HTML constants

const dpi_menu = `
<div id="dpi-script-message" class="prose">
    <h2>DisplayPostInfo</h2>
    <p>Check the forum for the latest on information and updates (<a class="dtext-link dtext-id-link dtext-forum-topic-id-link" href="/forum_topics/15926" style="color:#0073ff">topic #15926</a>).</p>
    <p>Check the original forum for information on earlier versions (<a class="dtext-link dtext-id-link dtext-forum-post-id-link" href="/forum_posts/154468">forum #154468</a>).</p>
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


//Time constants
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
    value: JSPLib.validate.postcount_constraints
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
            checkerror = JSPLib.menu.validateUserSettings(entry,settings_config);
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

////None

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
    user_tags[updater_id] = user_tags[updater_id].concat(added_tags);
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
            mapped_list_data = mapped_list_data.concat(bad_data);
        }
    }
    if (found_users.length) {
        GetUserListData.debuglog("Found users:", found_users);
        let found_data = found_users.map((userid)=>{
            //Just in case...
            let default_val = {value: BlankUser(userid)};
            return {[userid]: JSPLib.storage.getStorageData('user-' + userid, sessionStorage, default_val).value};
        });
        mapped_list_data = mapped_list_data.concat(found_data);
    }
    return Object.assign({},...mapped_list_data);
}

//Main execution functions

////#A-SHOW

async function DisplayPostViews() {
    var post_views;
    let post_id = JSPLib.utility.getMeta('post-id');
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
    let uploader_id = $("#image-container").data('uploader-id');
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
    let $image = $("#image-container");
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

function RenderTooltip (event, qtip) {
    var post_id = $(this).parents("[data-id]").data("id");
    var uploader_id = $(this).parents("[data-uploader-id]").data("uploader-id");
    RenderTooltip.debuglog("Getting tooltip info:", post_id);
    $.get("/posts/" + post_id, {variant: "tooltip"}).then((html)=>{
        qtip.set("content.text", html);
        qtip.elements.tooltip.removeClass("post-tooltip-loading");
        DPI.all_uploaders.then((data)=>{
            let name_html = RenderUsername(uploader_id,data[uploader_id]);
            $(".post-tooltip-header-left",qtip.elements.content[0]).prepend(name_html);
        });
        // Hide the tooltip if the user stopped hovering before the ajax request completed.
        if (Danbooru.PostTooltip.lostFocus) {
            qtip.hide();
        }
    });
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
        let tag_percentage = Math.ceil(100 * (column_info[tag] / total_posts));
        let spacing_tyle = (tag_percentage === 100 ? `style="letter-spacing:-2px"` : "");
        $(entry).before(` <span class="dpi-tag-statistic" ${spacing_tyle}>${JSPLib.utility.padNumber(tag_percentage,2)}%</span> `);
    });
}

function ProcessPostStatistics() {
    let $post_previews = $(".post-preview");
    let total_posts = $post_previews.length;
    let score_list = $post_previews.map((i,entry)=>{return Number($(entry).data('score'));}).toArray();
    let faves_list = $post_previews.map((i,entry)=>{return Number($(entry).data('fav-count'));}).toArray();
    let safe_count = $post_previews.filter("[data-rating=s]").length;
    let questionable_count = $post_previews.filter("[data-rating=q]").length;
    let explicit_count = $post_previews.filter("[data-rating=e]").length;
    $("#tag-box").after(`
<section id="dpi-post-statistics">
    <h1>Statistics</h1>
    <table class="striped">
        <tbody>
            <tr>
                <th>Score:</th>
                <td>${JSPLib.utility.setPrecision(JSPLib.statistics.average(score_list),1)} ± ${JSPLib.utility.setPrecision(JSPLib.statistics.standardDeviation(score_list),1)}</td>
            </tr>
            <tr>
                <th>Favorites:</th>
                <td>${JSPLib.utility.setPrecision(JSPLib.statistics.average(faves_list),1)} ± ${JSPLib.utility.setPrecision(JSPLib.statistics.standardDeviation(faves_list),1)}</td>
            </tr>
            <tr>
                <th>Safe:</th>
                <td>${Math.ceil(100 * (safe_count / total_posts))}%</td>
            </tr>
            <tr>
                <th><span style="font-size:90%;letter-spacing:-1px">Questionable:</span></th>
                <td>${Math.ceil(100 * (questionable_count / total_posts))}%</td>
            </tr>
            <tr>
                <th>Explicit:</th>
                <td>${Math.ceil(100 * (explicit_count / total_posts))}%</td>
            </tr>
        </tbody>
    </table>
</section>
`);
}

//Settings functions

function BroadcastDPI(ev) {
    BroadcastDPI.debuglog(`(${ev.data.type}):`, ev.data);
    switch (ev.data.type) {
        case "reset":
            Object.assign(DPI,program_reset_keys);
            //falls through
        case "settings":
            DPI.old_settings = JSPLib.utility.dataCopy(DPI.user_settings);
            DPI.user_settings = ev.data.user_settings;
            DPI.is_setting_menu && JSPLib.menu.updateUserSettings('dpi');
            InitializeChangedSettings();
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

function InitializeChangedSettings() {
    if ($("#c-posts #a-show").length) {
        if (JSPLib.menu.hasSettingChanged('dpi','post_views_enabled')) {
            let $post_views = $("#dpi-post-views");
            if (DPI.user_settings.post_views_enabled) {
                if ($post_views.text() === "") {
                    Timer.DisplayPostViews();
                } else {
                    $post_views.show();
                }
            } else {
                $post_views.hide();
            }
        }
        if (JSPLib.menu.hasSettingChanged('dpi','post_uploader_enabled')) {
            let $post_uploader = $("#dpi-post-uploader");
            if (DPI.user_settings.post_uploader_enabled) {
                if ($post_uploader.text() === "") {
                    Timer.DisplayPostUploader();
                } else {
                    $post_uploader.show();
                }
            } else {
                $post_uploader.hide();
            }
        }
        if (JSPLib.menu.hasSettingChanged('dpi','top_tagger_enabled')) {
            let $top_tagger = $("#dpi-top-tagger");
            if (DPI.user_settings.top_tagger_enabled) {
                if ($top_tagger.text() === "") {
                    Timer.DisplayTopTagger();
                } else {
                    $top_tagger.show();
                }
            } else {
                $top_tagger.hide();
            }
        }
    } else if ($("#c-posts #a-index").length) {
        if (JSPLib.menu.hasSettingChanged('dpi','post_statistics_enabled')) {
            let $post_statistics = $("#dpi-post-statistics");
            if (DPI.user_settings.post_statistics_enabled) {
                if ($post_statistics.length === 0) {
                    ProcessPostStatistics();
                } else {
                    $post_statistics.show();
                }
            } else {
                $post_statistics.hide();
            }
        }
        if (JSPLib.menu.hasSettingChanged('dpi','tag_statistics_enabled')) {
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
        //Not handling tooltips at this time
    }
}

function RenderSettingsMenu() {
    $("#display-post-info").append(dpi_menu);
    $("#dpi-general-settings").append(JSPLib.menu.renderDomainSelectors('dpi', 'DisplayPostInfo'));
    $("#dpi-information-settings").append(JSPLib.menu.renderCheckbox("dpi",'post_views_enabled'));
    $("#dpi-information-settings").append(JSPLib.menu.renderCheckbox("dpi",'post_uploader_enabled'));
    $("#dpi-information-settings").append(JSPLib.menu.renderCheckbox("dpi",'top_tagger_enabled'));
    $("#dpi-tooltip-settings").append(JSPLib.menu.renderCheckbox("dpi",'basic_post_tooltip'));
    $("#dpi-tooltip-settings").append(JSPLib.menu.renderCheckbox("dpi",'advanced_post_tooltip'));
    $("#dpi-statistics-settings").append(JSPLib.menu.renderCheckbox("dpi",'post_statistics_enabled'));
    $("#dpi-statistics-settings").append(JSPLib.menu.renderCheckbox("dpi",'tag_statistics_enabled'));
    $("#dpi-cache-settings").append(JSPLib.menu.renderLinkclick("dpi",'cache_info',"Cache info","Click to populate","Calculates the cache usage of the program and compares it to the total usage."));
    $("#dpi-cache-settings").append(`<div id="dpi-cache-info-table" style="display:none"></div>`);
    $("#dpi-cache-settings").append(JSPLib.menu.renderLinkclick("dpi",'purge_cache',`Purge cache (<span id="dpi-purge-counter">...</span>)`,"Click to purge","Dumps all of the cached data related to DisplayPostInfo."));
    $("#dpi-cache-editor-controls").append(JSPLib.menu.renderKeyselect('dpi','data_source',true,'indexed_db',all_source_types,"Indexed DB is <b>Cache Data</b> and Local Storage is <b>Program Data</b>."));
    $("#dpi-cache-editor-controls").append(JSPLib.menu.renderKeyselect('dpi','data_type',true,'tag_data',all_data_types,"Only applies to Indexed DB.  Use <b>Custom</b> for querying by keyname."));
    $("#dpi-cache-editor-controls").append(JSPLib.menu.renderTextinput('dpi','data_name',20,true,"Click <b>Get</b> to see the data, <b>Save</b> to edit it, and <b>Delete</b> to remove it.",['get','save','delete']));
    JSPLib.menu.engageUI('dpi',true);
    JSPLib.menu.saveUserSettingsClick('dpi','DisplayPostInfo');
    JSPLib.menu.resetUserSettingsClick('dpi','DisplayPostInfo',localstorage_keys,program_reset_keys);
    JSPLib.menu.purgeCacheClick('dpi','DisplayPostInfo',program_cache_regex,"#dpi-purge-counter");
    JSPLib.menu.cacheInfoClick('dpi',program_cache_regex,"#dpi-cache-info-table");
    JSPLib.menu.getCacheClick('dpi',reverse_data_key);
    JSPLib.menu.saveCacheClick('dpi',ValidateProgramData,ValidateEntry,reverse_data_key);
    JSPLib.menu.deleteCacheClick('dpi',reverse_data_key);
    JSPLib.menu.cacheAutocomplete('dpi',program_cache_regex,reverse_data_key);
}

//Main program

function Main() {
    Danbooru.DPI = DPI = {
        basic_tooltips: JSON.parse(JSPLib.utility.getMeta('disable-post-tooltips')),
        storage_keys: {indexed_db: [], local_storage: []},
        is_setting_menu: Boolean($("#c-users #a-edit").length),
        settings_config: settings_config,
        channel: new BroadcastChannel('DisplayPostInfo')
    };
    DPI.user_settings = JSPLib.menu.loadUserSettings('dpi');
    DPI.channel.onmessage = BroadcastDPI;
    if (JSPLib.danbooru.isSettingMenu()) {
        JSPLib.validate.dom_output = "#dpi-cache-editor-errors";
        JSPLib.menu.loadStorageKeys('dpi',program_cache_regex);
        JSPLib.utility.installScript("https://cdn.jsdelivr.net/gh/jquery/jquery-ui@1.12.1/ui/widgets/tabs.js").done(()=>{
            JSPLib.menu.installSettingsMenu("DisplayPostInfo");
            RenderSettingsMenu();
        });
        return;
    }
    if (!JSPLib.menu.isScriptEnabled('DisplayPostInfo')) {
        Main.debuglog("Script is disabled on", window.location.hostname);
        return;
    }
    if ($("#c-posts #a-show").length) {
        //Render containers now so that completion time doesn't determine order
        $("#post-information > ul > li:nth-of-type(6)").after(`<li id="dpi-post-views" style="display:none"></li>`);
        $("#post-information > ul > li:nth-of-type(2)").after(`<li id="dpi-post-uploader" style="display:none"></li><li id="dpi-top-tagger" style="display:none"></li>`);
        if (DPI.user_settings.post_views_enabled) {
            Timer.DisplayPostViews();
        }
        if (DPI.user_settings.post_uploader_enabled) {
            Timer.DisplayPostUploader();
        }
        if (DPI.user_settings.top_tagger_enabled) {
            Timer.DisplayTopTagger();
        }
    } else if ($("#c-posts #a-index").length) {
        //Maybe put the following map function into the library
        let all_uploaders = JSPLib.utility.setUnique($(".post-preview").map((i,entry)=>{return $(entry).data('uploader-id')}).toArray());
        DPI.all_uploaders = Timer.GetUserListData(all_uploaders);
        if (!Danbooru.DPI.basic_tooltips && DPI.user_settings.advanced_post_tooltip) {
            Danbooru.PostTooltip.QTIP_OPTIONS.content = RenderTooltip;
        } else if (Danbooru.DPI.basic_tooltips && DPI.user_settings.basic_post_tooltip) {
            UpdateThumbnailTitles();
        }
        if (DPI.user_settings.post_statistics_enabled) {
            ProcessPostStatistics();
        }
        if (DPI.user_settings.tag_statistics_enabled) {
            ProcessTagStatistics();
        }
        JSPLib.utility.setCSSStyle(post_index_css,'program');
    }
    setTimeout(()=>{
        JSPLib.storage.pruneEntries('dpi',program_cache_regex,prune_expires);
    },JSPLib.utility.one_minute);
}

/****Function decoration****/

JSPLib.debug.addFunctionTimers(Timer,false,[
    RenderSettingsMenu
]);

JSPLib.debug.addFunctionTimers(Timer,true,[
    DisplayPostViews,DisplayPostUploader,DisplayTopTagger,GetUserListData
]);

JSPLib.debug.addFunctionLogs([
    Main,BroadcastDPI,GetUserData,DisplayPostViews,DisplayTopTagger,RenderTooltip,GetUserListData,ValidateEntry
]);

/****Execution start****/

JSPLib.load.programInitialize(Main,'DPI',program_load_required_variables,program_load_required_selectors);
