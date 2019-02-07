// ==UserScript==
// @name         DisplayPostInfo
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      6.0
// @source       https://danbooru.donmai.us/users/23799
// @description  Display views, uploader, and other info to the user.
// @author       BrokenEagle
// @match        *://*.donmai.us/posts*
// @match        *://*.donmai.us/users/*/edit
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/displaypostinfo.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.5.2/localforage.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.12.0/validate.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/crypto-js/3.1.2/rollups/md5.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/menu.js
// ==/UserScript==

/****GLOBAL VARIABLES****/

//Variables for debug.js
JSPLib.debug.debug_console = false;
JSPLib.debug.pretext = "DPI:";
JSPLib.debug.pretimer = "DPI-";
JSPLib.debug.level = JSPLib.debug.INFO;

//Variables for load.js
const program_load_required_variables = ['window.jQuery','Danbooru.PostTooltip'];
const program_load_required_selectors = ["#post-information,#c-posts #a-index,#c-users #a-edit"];

//Main program variable
var DPI;

//Regex that matches the prefix of all program cache data
const program_cache_regex = /^(?:tt|user)-/

//Main program expires
const prune_expires = JSPLib.utility.one_day;

//For factory reset
const localstorage_keys = [];
const program_reset_keys = {};

//Main settings
const settings_config = {
    post_views_enabled: {
        default: true,
        validate: (data)=>{return validate.isBoolean(data);},
        hint: "Shows post views on the post page."
    },
    post_uploader_enabled: {
        default: true,
        validate: (data)=>{return validate.isBoolean(data);},
        hint: "Shows the post uploader on the post page."
    },
    top_tagger_enabled: {
        default: false,
        validate: (data)=>{return validate.isBoolean(data);},
        hint: "Shows top tagger on the post page."
    },
    basic_post_tooltip: {
        default: true,
        validate: (data)=>{return typeof data === "boolean";},
        hint: "Adds the post uploader to the basic post tooltips."
    },
    advanced_post_tooltip: {
        default: true,
        validate: (data)=>{return validate.isBoolean(data);},
        hint: "Adds the post uploader to the advanced post tooltips."
    }
}

//CSS constants

const menu_css = `
#dpi-console .expandable {
    width: 90%;
}
#dpi-console {
    width: 100%;
    min-width: 100em;
}
.dpi-linkclick.jsplib-linkclick .dpi-control.jsplib-control {
    display: inline;
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
</div>
`;


//Time constants
const thumbnail_hover_delay = 250;
const top_tagger_expiration = JSPLib.utility.one_month;
const user_expiration = JSPLib.utility.one_month;
const bad_user_expiration = JSPLib.utility.one_day;

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

/****FUNCTIONS****/

////Validate functions

function ValidateEntry(key,entry) {
    if (!JSPLib.validate.validateIsHash(key,entry)) {
        return false;
    }
    if (key.match(/^user-/)) {
        return ValidateUserEntry(key,entry);
    } else if (key.match(/^tt-/)) {
        return ValidateTopTaggerEntry(key,entry);
    }
    JSPLib.debug.debuglog("Shouldn't get here");
    return false;
}

function ValidateUserEntry(key,entry) {
    let check = validate(entry, user_constraints.entry);
    if (check !== undefined) {
        JSPLib.validate.printValidateError(key, check);
        return false;
    }
    check = validate(entry.value, user_constraints.value);
    if (check !== undefined) {
        JSPLib.validate.printValidateError(key + '.value', check);
        return false;
    }
    return true;
}

function ValidateTopTaggerEntry(key,entry) {
    let check = validate(entry,top_tagger_constraints);
    if (check !== undefined) {
        JSPLib.validate.printValidateError(key,check);
        return false;
    }
    return true;
}

////Library functions

function NameToKeyTransform(namelist,prefix) {
    return namelist.map((value)=>{return prefix + '-' + value;});
}

function KeyToNameTransform(keylist,prefix) {
    return keylist.map((key)=>{return key.replace(RegExp('^' + prefix + '-'),'');});
}

async function BatchStorageCheck(keyarray,validator,expires) {
    let promise_array = [];
    keyarray.forEach((key)=>{
        promise_array.push(JSPLib.storage.checkLocalDB(key,validator,expires));
    });
    let result_array = await Promise.all(promise_array);
    let missing_array = [];
    result_array.forEach((result,i)=>{
        if (!result) {
            missing_array.push(keyarray[i]);
        }
    });
    return missing_array;
}

function FixRenderLinkclick(program_shortcut,setting_name,display_name,link_text,hint) {
    let setting_key = JSPLib.utility.kebabCase(setting_name);
    return `
<div class="${program_shortcut}-linkclick jsplib-linkclick jsplib-menu-item">
    <h4>${display_name}</h4>
    <div>
        <b>[
            <span class="${program_shortcut}-control jsplib-control">
                <a href="#" id="${program_shortcut}-setting-${setting_key}">${link_text}</a>
            </span>
        ]</b>
        &emsp;
        <span class="${program_shortcut}-setting-tooltip jsplib-inline-tooltip">${hint}</span>
    </div>
</div>`;
}

function AddFunctionLogs(funclist) {
    funclist.forEach((func)=>{
        func.debuglog = function () {
            JSPLib.debug.debuglog(`${func.name} - `,...arguments);
        };
    });
}

////Auxiliary functions

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
    return `<a class="${level_class}${unlimited_class}${approver_class} with-style" href="/users/${user_id}">${user_name}</a>`;
}

function PopulateUserTags(current_tags,added_tags,user_tags,version_order,updater_id) {
    user_tags[updater_id] = user_tags[updater_id] || [];
    user_tags[updater_id] = user_tags[updater_id].concat(added_tags);
    version_order.unshift(updater_id);
    current_tags.tags = JSPLib.utility.setDifference(current_tags.tags,added_tags);
}

async function GetUserData(user_id) {
    let user_key = `user-${user_id}`;
    let data = await JSPLib.storage.checkLocalDB(user_key, ValidateEntry, user_expiration);
    if (!data) {
        JSPLib.debug.debuglog("DisplayPostUploader - Getting post uploader info:", user_id);
        let user_data = await JSPLib.danbooru.submitRequest("users", {search: {id: user_id, expiry: 30}});
        if (user_data && user_data.length) {
            mapped_data = MapUserData(user_data[0]);
            JSPLib.storage.saveData(user_key,{value: mapped_data, expires: JSPLib.utility.getExpiration(user_expiration)});
        } else {
            JSPLib.debug.debuglog("DisplayPostUploader - Missing user:", user_id);
            mapped_data = BlankUser(user_id);
            JSPLib.storage.saveData(user_key,{value: mapped_data, expires: JSPLib.utility.getExpiration(bad_user_expiration)});
        }
    } else {
        mapped_data = data.value;
    }
    return mapped_data;
}
GetUserData.promises = {};

function SaveMappedListData(mapped_data,expiration) {
    mapped_data.forEach((user)=>{
        let user_id = Object.keys(user)[0];
        JSPLib.storage.saveData(`user-${user_id}`, {value: user[user_id], expires: JSPLib.utility.getExpiration(expiration)});
    });
}

async function GetUserListData(user_id_list) {
    var mapped_list_data = [];
    let key_list = NameToKeyTransform(user_id_list,'user');
    let missing_keys = await BatchStorageCheck(key_list, ValidateEntry, user_expiration);
    if (missing_keys.length) {
        let missing_users = KeyToNameTransform(missing_keys,'user').map(Number);
        GetUserListData.debuglog("Missing users:", missing_users);
        let user_list = await JSPLib.danbooru.submitRequest("users", {search: {id: missing_users.join(',')}, limit: missing_users.length});
        mapped_list_data = user_list.map((user)=>{return {[user.id]: MapUserData(user)};});
        SaveMappedListData(mapped_list_data, user_expiration);
        if (user_list.length !== missing_users.length) {
            let found_users = JSPLib.utility.getObjectAttributes(user_list,'id');
            let bad_users = JSPLib.utility.setDifference(missing_users,found_users);
            GetUserListData.debuglog("Bad users:", bad_users);
            let bad_data = bad_users.map((user_id)=>{return {[user_id]: BlankUser(user_id)};});
            SaveMappedListData(bad_data, bad_user_expiration);
            mapped_list_data = mapped_list_data.concat(bad_data);
        }
    }
    let found_keys = JSPLib.utility.setDifference(key_list,missing_keys);
    if (found_keys.length) {
        let found_users = KeyToNameTransform(found_keys,'user').map(Number);
        GetUserListData.debuglog("Found users:", found_users);
        let found_data = found_keys.map((key,i)=>{
            let user_id = found_users[i];
            //Just in case...
            let default_val = {value: BlankUser(user_id)};
            return {[user_id]: JSPLib.storage.getStorageData(key,sessionStorage, default_val).value};
        });
        mapped_list_data = mapped_list_data.concat(found_data);
    }
    return Object.assign({},...mapped_list_data);
}

////Main execution functions

//#A-SHOW

async function DisplayPostViews() {
    var post_views;
    let post_id = JSPLib.utility.getMeta('post-id');
    DisplayPostViews.debuglog("Checking post views:", post_id);
    try {
        post_views = await $.get(`https://isshiki.donmai.us/post_views/${post_id}`);
    } catch(e) {
        post_views = `${e.status} ${e.responseText || e.statusText}`;
        DisplayPostViews.debuglog("Error:", e.status, e.responseText || e.statusText);
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
    let search_html =  JSPLib.danbooru.postSearchLink("user:" + user_data.name, "&raquo;");
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
        let post_versions = await JSPLib.danbooru.submitRequest('post_versions',{search: {post_id: post_id}, limit: 1000});
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
            JSPLib.storage.saveData(key_hash,{value: top_tagger_id, expires: JSPLib.utility.getExpiration(top_tagger_expiration)});
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
    $("#dpi-top-tagger").after(`<li>Top tagger: ${name_html}</li>`).show();
}

//#A-INDEX

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

//Settings functions

function RenderSettingsMenu() {
    $("#display-post-info").append(dpi_menu);
    $("#dpi-general-settings").append(JSPLib.menu.renderCheckbox("dpi",'post_views_enabled'));
    $("#dpi-general-settings").append(JSPLib.menu.renderCheckbox("dpi",'post_uploader_enabled'));
    $("#dpi-general-settings").append(JSPLib.menu.renderCheckbox("dpi",'top_tagger_enabled'));
    $("#dpi-general-settings").append(JSPLib.menu.renderCheckbox("dpi",'basic_post_tooltip'));
    $("#dpi-general-settings").append(JSPLib.menu.renderCheckbox("dpi",'advanced_post_tooltip'));
    $("#dpi-cache-settings").append(FixRenderLinkclick("dpi",'purge_cache',`Purge cache (<span id="dpi-purge-counter">...</span>)`,"Click to purge","Dumps all of the cached data related to DisplayPostInfo."));
    JSPLib.menu.saveUserSettingsClick('dpi','DisplayPostInfo');
    JSPLib.menu.resetUserSettingsClick('dpi','DisplayPostInfo',localstorage_keys,program_reset_keys);
    JSPLib.menu.purgeCacheClick('dpi','DisplayPostInfo',program_cache_regex,"#dpi-purge-counter");
}

//Main program

function main() {
    Danbooru.DPI = DPI = {
        basic_tooltips: JSON.parse(Danbooru.Utility.meta('disable-post-tooltips')),
        settings_config: settings_config
    };
    DPI.user_settings = JSPLib.menu.loadUserSettings('dpi');
    if ($("#c-posts #a-show").length) {
        //Render containers now so that completion time doesn't determine order
        $("#post-information > ul > li:nth-of-type(6)").after(`<li id="dpi-post-views" style="display:none"></li>`);
        $("#post-information > ul > li:nth-of-type(2)").after(`<li id="dpi-post-uploader" style="display:none"></li><li id="dpi-top-tagger" style="display:none"></li>`);
        if (DPI.user_settings.post_views_enabled) {
            DisplayPostViews();
        }
        if (DPI.user_settings.post_uploader_enabled) {
            DisplayPostUploader();
        }
        if (DPI.user_settings.top_tagger_enabled) {
            DisplayTopTagger();
        }
    } else if ($("#c-posts #a-index").length) {
        let all_uploaders = JSPLib.utility.setUnique($(".post-preview").map((i,entry)=>{return $(entry).data('uploader-id')}).toArray());
        DPI.all_uploaders = GetUserListData(all_uploaders);
        if (!Danbooru.DPI.basic_tooltips && DPI.user_settings.advanced_post_tooltip) {
            Danbooru.PostTooltip.QTIP_OPTIONS.content = RenderTooltip;
        } else if (Danbooru.DPI.basic_tooltips && DPI.user_settings.basic_post_tooltip) {
            UpdateThumbnailTitles();
        }
    } else if ($("#c-users #a-edit").length) {
        JSPLib.utility.installScript("https://cdn.jsdelivr.net/gh/jquery/jquery-ui@1.12.1/ui/widgets/tabs.js").done(()=>{
            JSPLib.menu.installSettingsMenu("DisplayPostInfo");
            RenderSettingsMenu();
        });
        JSPLib.utility.setCSSStyle(menu_css,'menu');
    }
    setTimeout(()=>{
        JSPLib.storage.pruneEntries('dpi',program_cache_regex,prune_expires);
    },JSPLib.utility.one_minute);
}

//Execution start

AddFunctionLogs([DisplayPostViews,DisplayPostUploader,DisplayTopTagger,RenderTooltip,GetUserListData]);

JSPLib.load.programInitialize(main,'DPI',program_load_required_variables,program_load_required_selectors);
