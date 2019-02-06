// ==UserScript==
// @name         DisplayPostInfo
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      4.0
// @source       https://danbooru.donmai.us/users/23799
// @description  Display views, uploader, and other info to the user.
// @author       BrokenEagle
// @match        *://*.donmai.us/posts*
// @match        *://*.donmai.us/users/*/edit
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/displaypostinfo.user.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20181230/lib/utility.js
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

//For factory reset
const localstorage_keys = [];
const program_reset_keys = {};

//Main settings
const settings_config = {
    post_views_enabled: {
        default: true,
        validate: (data)=>{return typeof data === "boolean";},
        hint: "Shows post views on the post page."
    },
    post_uploader_enabled: {
        default: true,
        validate: (data)=>{return typeof data === "boolean";},
        hint: "Shows the post uploader on the post page."
    },
    top_tagger_enabled: {
        default: false,
        validate: (data)=>{return typeof data === "boolean";},
        hint: "Shows top tagger on the post page."
    },
    basic_post_tooltip: {
        default: true,
        validate: (data)=>{return typeof data === "boolean";},
        hint: "Adds the post uploader to the basic post tooltips."
    },
    advanced_post_tooltip: {
        default: true,
        validate: (data)=>{return typeof data === "boolean";},
        hint: "Adds the post uploader to the advanced post tooltips."
    }
}

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
        <hr>
        <div id="dpi-settings-buttons" class="jsplib-settings-buttons">
            <input type="button" id="dpi-commit" value="Save">
            <input type="button" id="dpi-resetall" value="Factory Reset">
        </div>
    </div>
</div>
`;

const thumbnail_hover_delay = 250;

/****FUNCTIONS****/

////Auxiliary functions

function BlankUser(user_id) {
    return {
        name: `user_${user_id}`,
        level_string: "Member",
        can_upload_free: false,
        can_approve_posts: false,
    };
}

function RenderUsername(user_data) {
    let uploader_name = JSPLib.utility.maxLengthString(user_data.name);
    let level_class = "user-" + user_data.level_string.toLowerCase();
    let unlimited_class = (user_data.can_upload_free ? " user-post-uploader" : "");
    let approver_class = (user_data.can_approve_posts ? " user-post-approver" : "");
    return `<a class="${level_class}${unlimited_class}${approver_class} with-style" href="/users/${user_data.id}">${uploader_name}</a>`;
}

function PopulateUserTags(current_tags,added_tags,user_tags,version_order,updater_id) {
    user_tags[updater_id] = user_tags[updater_id] || [];
    user_tags[updater_id] = user_tags[updater_id].concat(added_tags);
    version_order.unshift(updater_id);
    current_tags.tags = JSPLib.utility.setDifference(current_tags.tags,added_tags);
}

////Main execution functions

//#A-SHOW

async function DisplayPostViews() {
    var post_views;
    let post_id = JSPLib.utility.getMeta('post-id');
    JSPLib.debug.debuglog("Checking post views:", post_id);
    try {
        post_views = await $.get(`https://isshiki.donmai.us/post_views/${post_id}`);
    } catch(e) {
        post_views = `${e.status} ${e.responseText || e.statusText}`;
        JSPLib.debug.debuglog("DisplayPostViews error:", e.status, e.responseText || e.statusText);
    }
    $("#dpi-post-views").html(`Views: ${post_views}`).show();
}

function DisplayPostUploader() {
    let uploader_id = $("#image-container").data('uploader-id');
    JSPLib.debug.debuglog("Getting post uploader info:", uploader_id);
    JSPLib.danbooru.submitRequest("users", {search: {id: uploader_id}, expiry: 30}, [BlankUser(uploader_id)]).then((data)=>{
        let user_data = (data.length ? data[0] : BlankUser(uploader_id));
        let name_html = RenderUsername(user_data);
        let search_html =  JSPLib.danbooru.postSearchLink("user:" + user_data.name, "&raquo;");
        $("#dpi-post-uploader").html(`Uploader: ${name_html}&ensp;${search_html}`).show();
    });
}

async function DisplayTopTagger() {
    var name_html;
    let $image = $("#image-container");
    let uploader_id = $image.data('uploader-id');
    let post_id = $image.data('id');
    //Hashed so that it's mutable
    let current_tags = {tags: $image.data('tags').split(' ')};
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
        let top_tagger = top_taggers[0];
        JSPLib.debug.debuglog("Top tagger found:",top_tagger);
        let data = await JSPLib.danbooru.submitRequest("users", {search: {id: top_tagger}, expiry: 30}, [BlankUser(top_tagger)]);
        let user_data = (data.length ? data[0] : BlankUser(top_tagger));
        name_html = RenderUsername(user_data);
    } else {
        JSPLib.debug.debuglog("Error: No post versions found",post_versions);
        name_html = "No data!";
    }
    $("#dpi-top-tagger").after(`<li>Top tagger: ${name_html}</li>`).show();
}

//#A-INDEX

function RenderTooltip (event, qtip) {
    var post_id = $(this).parents("[data-id]").data("id");
    var uploader_id = $(this).parents("[data-uploader-id]").data("uploader-id");
    JSPLib.debug.debuglog("Getting post uploader info:", uploader_id);
    var uploader_resp = JSPLib.danbooru.submitRequest("users", {search: {id: uploader_id}, expiry: 30}, [BlankUser(uploader_id)]);
    JSPLib.debug.debuglog("Getting tooltip info:", post_id);
    $.get("/posts/" + post_id, {variant: "tooltip"}).then((html)=>{
        qtip.set("content.text", html);
        qtip.elements.tooltip.removeClass("post-tooltip-loading");
        uploader_resp.then((data)=>{
            let user_data = (data.length ? data[0] : BlankUser(uploader_id));
            $(".post-tooltip-header-left",qtip.elements.content[0]).prepend(RenderUsername(user_data));
        });
        // Hide the tooltip if the user stopped hovering before the ajax request completed.
        if (Danbooru.PostTooltip.lostFocus) {
            qtip.hide();
        }
    });
}

function PostThumbnailHover() {
    $(document).on("mouseenter.DPI",".post-preview:not(.dpi-processed)",(e)=>{
        let $post = $(e.currentTarget);
        let timer = setTimeout(()=>{
            let $image = $("img",e.currentTarget);
            let uploader_id = $post.data('uploader-id');
            let title = $image.attr('title');
            JSPLib.debug.debuglog("Getting post uploader info:", uploader_id);
            JSPLib.danbooru.submitRequest("users", {search: {id: uploader_id}, expiry: 30}, [BlankUser(uploader_id)]).then((data)=>{
                let user_data = (data.length ? data[0] : BlankUser(uploader_id));
                $image.attr('title',`${title} user:${user_data.name}`);
            });
            $post.addClass("dpi-processed");
        },thumbnail_hover_delay);
        $post.data('dpi-timer',timer);
    });
    $(document).on("mouseleave.DPI",".post-preview:not(.dpi-processed)",(e)=>{
        let timer = $(e.currentTarget).data('dpi-timer');
        if (timer) {
            clearTimeout(timer);
        }
    });
}

//Settings functions

function RenderSettingsMenu() {
    $("#display-post-info").append(dpi_menu);
    $("#dpi-general-settings").append(JSPLib.menu.renderCheckbox("dpi",'post_views_enabled'));
    $("#dpi-general-settings").append(JSPLib.menu.renderCheckbox("dpi",'post_uploader_enabled'));
    $("#dpi-general-settings").append(JSPLib.menu.renderCheckbox("dpi",'top_tagger_enabled'));
    $("#dpi-general-settings").append(JSPLib.menu.renderCheckbox("dpi",'advanced_post_tooltip'));
    JSPLib.menu.saveUserSettingsClick('dpi','DisplayPostInfo');
    JSPLib.menu.resetUserSettingsClick('dpi','DisplayPostInfo',localstorage_keys,program_reset_keys);
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
        if (!Danbooru.DPI.basic_tooltips && DPI.user_settings.advanced_post_tooltip) {
            Danbooru.PostTooltip.QTIP_OPTIONS.content = RenderTooltip;
        } else if (Danbooru.DPI.basic_tooltips && DPI.user_settings.basic_post_tooltip) {
            PostThumbnailHover();
        }
    } else if ($("#c-users #a-edit").length) {
        JSPLib.utility.installScript("https://cdn.jsdelivr.net/gh/jquery/jquery-ui@1.12.1/ui/widgets/tabs.js").done(()=>{
            JSPLib.menu.installSettingsMenu("DisplayPostInfo");
            RenderSettingsMenu();
        });
    }
}

//Execution start

JSPLib.load.programInitialize(main,'DPI',program_load_required_variables,program_load_required_selectors);
