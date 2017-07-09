// ==UserScript==
// @name         Safelist
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      35
// @source       https://danbooru.donmai.us/users/23799
// @description  Alternate Danbooru blacklist handler
// @author       BrokenEagle
// @match        *://*.donmai.us/*
// @grant        none
// @run-at       document-body
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/raw/stable/dist/safelist.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.4/lodash.min.js
// ==/UserScript==

(function() {
'use strict';

////////////////
//Constants

const list_callback_retrytime = 5000;
const list_callback_polling_interval = 50;
const timeout_polling_interval = 1000;
const max_danbooru_retries = 50;
const danbooru_recheck_interval = 100;
const debug_console = false;

const help_hints = {
    'enable_tag_hide':"Hide all occurrences of a tag in sidemenus and tables.",
    'enable_text_replace':"Replace all occurrences of a tag with <u><b>Replacement Text</b></u> in prose and titles.",
    'enable_write_mode':"Enable writes to your Danbooru blacklist with the <b><u>Push</u></b> button.",
    'enable_validate_mode':"Enable ValidateBlacklist addon if installed. Click <b><u>Validate</u></b> button to activate.",
    'use_session_enable':"Have a different state of enabled on every page tab.",
    'use_session_level':"Have a different active list on every page tab."
};

const safelist_css = `
/*Safelist controls*/
#safelist-box {
    margin-bottom: 0.5em;
}
#safelist-box h1 {
    font-size: 1.16667em;
}
#safelist-box #safelist {
    margin-left: 1em;
}
#safelist-box #safelist .safelist-active,
#safelist-box #safelist .safelist-pending {
    font-style: italic;
}
#safelist-box #safelist .safelist-pending:after {
    content: "(Loading)";
    padding-left: 4px;
}
#safelist-box #safelist .safelist-allnone {
    font-weight: bold;
}
    /*Sidebar list*/
#c-posts #sidebar #safelist-box #safelist li,
#c-favorites #sidebar #safelist-box #safelist li {
    list-style-type: disc;
}
    /*Topbar list*/
#c-artist-commentaries #safelist-box h1,
#c-comments #safelist-box h1,
#c-users #safelist-box #safelist-box h1,
#c-favorite-groups #safelist-box h1,
#c-pools #safelist-box h1,
#c-post-appeals #safelist-box h1,
#c-post-flags #safelist-box h1,
#c-post-replacements #safelist-box h1,
#c-explore-posts #safelist-box h1 {
    display: inline;
}
#c-artist-commentaries #safelist-box #safelist,
#c-comments #safelist-box #safelist,
#c-users #safelist-box #safelist,
#c-favorite-groups #safelist-box #safelist,
#c-pools #safelist-box #safelist,
#c-post-appeals #safelist-box #safelist,
#c-post-flags #safelist-box #safelist,
#c-post-replacements #safelist-box #safelist,
#c-explore-posts #safelist-box #safelist {
    display: inline;
}
#c-artist-commentaries #safelist-box #safelist li,
#c-comments #safelist-box #safelist li,
#c-users #safelist-box #safelist li,
#c-favorite-groups #safelist-box #safelist li,
#c-pools #safelist-box #safelist li,
#c-post-appeals #safelist-box #safelist li,
#c-post-flags #safelist-box #safelist li,
#c-post-replacements #safelist-box #safelist li,
#c-explore-posts #safelist-box #safelist li {
    display: inline;
    position: relative;
}
#c-artist-commentaries #safelist-box #safelist li:after,
#c-comments #safelist-box #safelist li:after,
#c-users #safelist-box #safelist li:after,
#c-favorite-groups #safelist-box #safelist li:after,
#c-pools #safelist-box #safelist li:after,
#c-post-appeals #safelist-box #safelist li:after,
#c-post-flags #safelist-box #safelist li:after,
#c-post-replacements #safelist-box #safelist li:after,
#c-explore-posts #safelist-box #safelist li:after {
    content: "|";
    font-weight: normal;
}
#c-artist-commentaries #safelist-box #safelist li.safelist-pending:before,
#c-comments #safelist-box #safelist li.safelist-pending:before,
#c-users #safelist-box #safelist li.safelist-pending:before,
#c-favorite-groups #safelist-box #safelist li.safelist-pending:before,
#c-pools #safelist-box #safelist li.safelist-pending:before,
#c-post-appeals #safelist-box #safelist li.safelist-pending:before,
#c-post-flags #safelist-box #safelist li.safelist-pending:before,
#c-post-replacements #safelist-box #safelist li.safelist-pending:before,
#c-explore-posts #safelist-box #safelist li.safelist-pending:before {
    content: "(Loading)";
    top: 20px;
    left: -5px;
    position: absolute;
}

/*Safelist settings*/
    /*General settings*/
#c-posts #a-index #safelist-settings {
    display: block;
}
#c-posts #a-index #safelist-settings input.btn {
    margin-right: 1em;
    margin-top: 1em;
    min-width: 4em;
}
    /*Name row*/
#c-posts #a-index #safelist-settings .safelist-namerow {
    height: 2em;
}
#c-posts #a-index #safelist-settings .safelist-namerow h2 {
    display: inline-block;
    margin-right: 0.5em;
}
#c-posts #a-index #safelist-settings .safelist-namerow .text {
    margin: 0.5em;
    padding-left: 0.5em;
    line-height:150%;
}
#c-posts #a-index #safelist-settings > div {
    margin-bottom: 1em;
}
    /*Input groupings*/
#c-posts #a-index #safelist-settings .input {
    border: 2px solid grey;
    padding: 0.8em;
    border-radius: 10px;
}
#c-posts #a-index #safelist-settings .input label {
    display: block;
    font-weight: bold;
    line-height: 1.5em;
    font-size: 100%;
}
#c-posts #a-index #safelist-settings .input span {
    display: block;
    max-width: 90%;
}
    /*Textblock(s)*/
#c-posts #a-index #safelist-settings textarea {
    width: 90%;
    height: 10em;
}
#c-posts #a-index #safelist-settings .safelist-textblock li {
    list-style-type: disc;
}
#c-posts #a-index #safelist-settings .safelist-textblock ul {
    margin-left: 1.5em;
}
#c-posts #a-index #safelist-settings .safelist-textblock div {
    padding: 0 0.5em;
    border: 2px solid lightgrey;
    width: 90%;
    height: 10em;
    font-size: 0.8em;
    overflow: auto;
}
    /*Checkbox input*/
#c-posts #a-index #safelist-settings .safelist-checkbox input {
    margin-top: 1em;
}
#c-posts #a-index #safelist-settings .safelist-checkbox .hint {
    margin: 1em 0;
}
    /*Fit and placement settings*/
#c-posts #a-index #safelist-settings .safelist-textblock,
#c-posts #a-index #safelist-settings .safelist-checkbox,
#c-posts #a-index #safelist-settings .safelist-textinput,
#c-posts #a-index #safelist-settings .safelist-namerow  {
    width: 50%;
    float: left;
    margin-top: 0.5em;
    position: relative;
}
#c-posts #a-index #safelist-settings .safelist-selection,
#c-posts #a-index #safelist-settings .safelist-halfcheckbox {
    width: 25%;
    float: left;
    margin-top: 0.5em;
    position: relative;
}
    /*Tooltip*/
#c-posts #a-index #safelist-settings .tooltip {
    visibility: hidden;
    background-color: black;
    color: #fff;
    text-align: center;
    border-radius: 6px;
    padding: 5px 0;
    border: 2px solid grey;
    /* Position the tooltip */
    position: absolute;
    z-index: 1;
    bottom: 100%;
    left: 4em;
    margin-left: -60px;
}
#c-posts #a-index #safelist-settings .validate-blacklist.tooltip {
    text-align: left;
}
#c-posts #a-index #safelist-settings label:hover ~ .tooltip,
#c-posts #a-index #safelist-settings .tooltip:hover {
    visibility: visible;
}

/*Other settings*/
div.safelist-error {
    font-size: 125%;
    margin: 1em;
    font-weight: bold;
    text-align: left;
    border: 2px solid lightgrey;
}
`;

const css_enabled = `
#page #blacklist-box {
    display: none !important;
}

#page .post-preview,
#page .post-preview.blacklisted,
#page .post-preview.blacklisted.blacklisted-active,
#page #image-container,
#page #image-container.blacklisted,
#page #image-container.blacklisted.blacklisted-active,
#page #has-parent-relationship-preview .blacklisted:not(.blacklisted-active),
#page #has-children-relationship-preview .blacklisted:not(.blacklisted-active) {
    display: none !important;
}
#page .post-preview.safelist-active,
#page .post-preview.blacklisted.safelist-active,
#page .post-preview.blacklisted.blacklisted-active.safelist-active,
#page #image-container.safelist-active,
#page #image-container.blacklisted.safelist-active,
#page #image-container.blacklisted.blacklisted-active.safelist-active {
    display: block !important;
}
#page #has-parent-relationship-preview .blacklisted:not(.blacklisted-active).safelist-active,
#page #has-children-relationship-preview .blacklisted:not(.blacklisted-active).safelist-active {
    display: inline-block !important;
}
`;

/////////////////////
//Global variables

//Main variable for storing permenant data
var safelist_config;

//Main variable for storing session data
var safelist_session;

//Translated tag list to Danbooru's format for processsing blacklist entries
var custom_entries;

//Stores the active and variable menus
var menu_items;

//Stores the precalculated list of hidden posts to reduce penalty for list calculation
var post_list_dict = {};

//Keeps track of CSS styles implemented to allow for swapping of styles
var cssstyle_dict = {};

//Used for quick comparison of raw settings
var json_settings;

////////////////
//Classes

//Main application class
class Safelist {
    constructor(level) {
        this.level = level;
        this.list = [''];
        this.css = '';
        this.hotkey = ['',''];
        this.name ="Level "+level.toUpperCase();
        this.enabled = true;
    }
    validateSafelistData() {
        validateData(this,'css','string',"");
        validateData(this,'name','string',"Level "+this.level.toUpperCase());
        validateData(this,'enabled','boolean',true);
        validateData(this,'background_process','boolean',false);
        if ($.isArray(this.list) && (this.list.length>=1)) {
            let templist = _(this.list).filter(tag=>{return (typeof(tag)==='string')&&(tag!=='');}).defaults(['']).value();
            if (debug_console && (_.xor(this.list,templist).length>0)) {debuglog("Invalid list item(s) found");}
            this.list = templist;
        } else {
            debuglog("Invalid key: list");
            this.list = [""];
        }
        if ($.isArray(this.hotkey) && (this.hotkey.length>=2)){
            if ((typeof this.hotkey[0]!=='string')||($.inArray(this.hotkey[0],['','alt','shift','ctrl'])<0)) {
                debuglog("Invalid hotkey: modifier");
                this.hotkey[0] = "";
            }
            if ((typeof this.hotkey[0]!=='string')||($.inArray(this.hotkey[1],_.concat('','abcdefghijklmnopqrstuvwxyz1234567890'.split('')))<0)) {
                debuglog("Invalid hotkey: keypress");
                this.hotkey[1] = "";
            }
            if (debug_console && this.hotkey.length>2) {debuglog("Invalid hotkey length");}
            this.hotkey = this.hotkey.slice(0,2);
        } else {
            debuglog("Invalid key: hotkey");
            this.hotkey = ["",""];
        }
        _(this).each((val,key)=>{
            if ($.inArray(key,['level','list','css','hotkey','name','enabled','background_process'])<0) {
                debuglog(`Deleting key: ${key}`);
                delete this[key];
            }
        });
    }
    //Getter/setter functions
    get isVariable() {
        return !isNaN(this.level);
    }
    get isPrunable() {
        return (this.isVariable && !this.enabled);
    }
    get isEmpty() {
        return (this.list.length==1) && (this.list[0]==='');
    }
    get tagstring() {
        return this.list.join('\n');
    }
    set tagstring(str) {
        this.list = _(str).split('\n').map($.trim).filter(tag=>{return tag!=='';}).defaults(['']).value();
    }
    //Copied code from Danbooru on adding !important to every entry
    renderedCSS() {
        return '\r\n' + this.css.
            split('\n').
            map(function(str) {
                return str.replace(
                    /(\S)\s*(?:!important)?\s*(;|})/,
                    "$1 !important$2");
                })
            .join('\n') + '\r\n';
    }
    
    /////////////////////////
    //Render HTML functions
    
    //Links in the side menu
    renderedSide() {
        if (!this.enabled) {return "";}
        const constantaddon = (this.isVariable?"":'class="safelist-allnone"');
        return `
        <li ${constantaddon}><a href="#" id="safe-level-${this.level}">${this.name}</a></li>`;
    }
    //Sections in the setting menu
    renderLevelSetting() {
        let optionitem = "";
        let listitem = `
        <div class="input" id="safelist-settings-level-${this.level}">`;
        listitem += this.renderNamerow();
        listitem += this.renderKeyselect();
        listitem += (this.isVariable?this.renderBackgroundOption():'');
        listitem += `
            <div class="clearfix"></div>`;
        listitem += (this.isVariable?this.renderTagBlock():this.renderLevelCheckbox());
        listitem += this.renderCSSBlock();
        listitem += `
            <div class="clearfix"></div>`;
        optionitem += this.renderLevelButtons();
        optionitem += this.renderFeedback();
        if ($.inArray(this.level,['a','n'])<0) {
            listitem += optionitem;
        }
        return listitem + `
        </div>`;
    }
    //List name, edit button and textbox
    renderNamerow() {
        let escapedname = sanitizeForHTML(this.name);
        let nameitem = `
            <div class="safelist-namerow">
                <h2 id="safelist-heading-level-${this.level}">${this.name}</h2>
                <input type="text" name="safelist-name-level-${this.level}" value="${escapedname}" size="40" autocomplete="off" class="text">`;
        nameitem += this.renderButton('edit');
        return nameitem + `
            </div>`;
    }
    //Hotkey dropdowns
    renderKeyselect() {
        let item = `
    <div class="safelist-selection">
        <label for="safelist_keyselect_level_${this.level}" style="width:5em">Hotkey</label>
        <select name="safelistKeymodifierLevel${this.level}" id="safelist_modifier_level_${this.level}">`;
        $.each(['','alt','shift','ctrl'], (i,key)=>{
            let selected = (this.hotkey[0]===key?'selected="selected"':'');
            let ucase = _.startCase(key);
            item += `\r\n        <option ${selected} value="${key}">${ucase}</option>`;
        });
        item += `</select>
        <select name="safelistKeyselectLevel${this.level}" id="safelist_keyselect_level_${this.level}">`;
        $.each(_.concat('','abcdefghijklmnopqrstuvwxyz1234567890'.split('')), (i,key)=>{
            let selected = (this.hotkey[1]===key?'selected="selected"':'');
            let ucase = key.toUpperCase();
            item += `\r\n        <option ${selected} value="${key}">${ucase}</option>`;
        });
        return item + `
        </select>
        <span class="tooltip">Changes list when Safelist is active. Keep in mind existing <a href="/static/keyboard_shortcuts">Danbooru hotkeys</a>.</span>
    </div>`;
    }
    //Background process options
    renderBackgroundOption() {
        const value = (this.background_process ? "checked" : "");
        return `
            <div class="safelist-halfcheckbox">
                <label for="safelist_background_process_level_${this.level}" style="width:12em">Background Process</label>
                <input type="checkbox" ${value} name="safelistBackgroundProcessLevel${this.level.toUpperCase()}" id="safelist_background_process_level_${this.level}">
                <span class="tooltip">Process this list in the background so that changing lists is more responsive.</span>
            </div>`;
    }
    //For constant levels all and none... takes place of taglist
    renderLevelCheckbox() {
        const value = (this.enabled ? "checked" : "");
        const label = (this.level=='a'?"Enable all":"Enable none");
        const hint = (this.level=='a'?"Shows everything.":"Shows nothing.");
        return `
            <div class="safelist-checkbox">
                <label for="safelist-enable-level-${this.level}" style="width:9em">${label} list</label>
                <input type="checkbox" ${value} name="safelistCheckboxLevel${this.level.toUpperCase()}" id="safelist-enable-level-${this.level}">
                <span class="tooltip">${hint}</span>
            </div>`;
    }
    //For custom levels
    renderTagBlock() {
        return `
            <div class="safelist-textblock">
                <label for="safelist_tags_level_${this.level}" style="width:9em">Blacklisted tags</label>
                <textarea name="safelistTagsLevel${this.level}" id="safelist_tags_level_${this.level}" cols="40" rows="5" autocomplete="off">${this.tagstring}</textarea>
                <span class="tooltip">Put any tag combinations you never want to see here. Each combination should go on a separate line. <a href="/wiki_pages/help:blacklists">View help.</a></span>
            </div>`;
    }
    //Custom style per level
    renderCSSBlock() {
        return `
            <div class="safelist-textblock">
                <label for="safelist_css_level_${this.level}" style="width:7em">Custom CSS</label>
                <textarea name="safelistCSSLevel${this.level}" id="safelist_css_level_${this.level}" cols="40" rows="5" autocomplete="off">${this.css}</textarea>
                <span class="tooltip">Style to apply to the whole site.</span>
            </div>`;
    }
    //Button renderer
    renderButton(type) {
        const value = _.startCase(type);
        return `
                <input type="submit" name="safelist-${type}-level-${this.level}" value="${value}" class="btn safelist-${type}">`;
    }
    //Renders all level buttons
    renderLevelButtons() {
        let optionitem = `
            <div class="safelist-setting-buttons">`;
        optionitem += this.renderButton('pull');
        optionitem += this.renderButton('push');
        optionitem += this.renderButton('validate');
        optionitem += this.renderButton('reset');
        optionitem += this.renderButton('apply');
        optionitem += this.renderButton('delete');
        return optionitem + `
            </div>`;
    }
    //For the validate function
    renderFeedback() {
        return `
            <div class="safelist-output">
                <div class="safelist-textblock">
                    <label for="safelist_feedback_level_${this.level}">Feedback</label>
                    <textarea readonly name="safelistFeedbackLevel${this.level}" id="safelist_feedback_level_${this.level}" cols="40" rows="5"></textarea>
                </div>
                <div class="safelist-textblock">
                    <label for="safelist_results_level_${this.level}" style="width:15em">Results</label>
                    <div id="safelist_results_level_${this.level}"></div>
                    <span class="validate-blacklist"></span>
                </div>
                <div class="clearfix"></div>
            </div>`;
    }
    
    ////////////////////
    //Click functions
    
    //Side menu click
    setSideLevelClick() {
        $("#safe-level-"+this.level).off().click(function(e) {
            //Click events need their own try/catch blocks
            try {
                console.time("LevelChange");
                $("#show-posts-link").click();
                //The only context we have on a click is "e", so get the level from it
                let match = /safe-level-(.*)/.exec(e.currentTarget.id);
                if(match) {
                    let key = match[1];
                    safelist_session.active_list = key;
                    let value = safelist_config.levels[key];
                    if (post_list_dict[key]===undefined){
                        debuglog("List not ready!");
                        //If no lists are being actively calculated...?
                        if (Object.keys(calculateActiveList.background_work).length===0) {
                            calculateActiveList.handle = setTimeout(calculateActiveList,1);
                        }
                        setActiveList(key,"pending");
                        //Else calculateActiveList will automatically switch over
                    } else {
                        debuglog("Precalculated list change");
                        showHidePosts(post_list_dict[key]);
                        setActiveList(key,"active");
                    }
                    setCSSStyle(value.renderedCSS(),"safelist_user_css");
                    setSessionData();
                    if (safelist_config.enable_tag_hide) {
                        value.scrubTags();
                    }
                    if (safelist_config.enable_text_replace) {
                        value.scrubText();
                    }
                }
                console.timeEnd("LevelChange");
                e.preventDefault();
            } catch (e) {
                errorlog(e);
                throw e;
            }
        });
    }
    //Activate hotkey for level if it exists
    setKeypress() {
        $(document).off("keydown.safelist.level"+this.level);
        if ((!$.isArray(this.hotkey)) || (this.hotkey.length < 2) || (this.hotkey[1] === '')) {return;}
        let combokey = (this.hotkey[0] === ''?this.hotkey[1]:this.hotkey.join('+'));
        debuglog(this.level,String(this.hotkey),combokey);
        $(document).on("keydown.safelist.level"+this.level, null,combokey, e=>{
            if (safelist_session.enable_safelist) {
                $("#safe-level-"+this.level).click();
            }
        });
    }
    //Set all level clicks for menu
    setMenuLevelClicks() {
        $(`[name="safelist-name-level-${this.level}"]`).hide();
        $(`[name="safelist-reset-level-${this.level}"]`).hide();
        $(`[name="safelist-apply-level-${this.level}"]`).hide();
        $(`#safelist-settings-level-${this.level} .safelist-output`).hide();
        this.setNameChangeClick();
        this.setPullButtonClick();
        this.setPushButtonClick();
        this.setValidateButtonClick();
        this.setResetButtonClick();
        this.setApplyButtonClick();
        this.setDeleteButtonClick();
    }
    //Set the name edit button
    setNameChangeClick() {
        $(`[name="safelist-edit-level-${this.level}"]`).off().click(function(e) {
            try {
                let match = /safelist-edit-level-(.*)/.exec(e.currentTarget.name);
                if (match) {
                    let level = match[1];
                    $("#safelist-heading-level-"+level).hide();
                    $(`[name="safelist-edit-level-${level}"]`).hide();
                    $(`[name="safelist-name-level-${level}"]`).show();
            }
            } catch (e) {
                errorlog(e);
                throw e;
            }
        });
    }
    //Set the pull blacklist button
    setPullButtonClick() {
        $(`[name="safelist-pull-level-${this.level}"]`).off().click(function(e) {
            try {
                let match = /safelist-pull-level-(.*)/.exec(e.target.name);
                if (match) {
                    let level = match[1];
                    $("#safelist_tags_level_"+level).val(
                        Danbooru.meta("blacklisted-tags")
                        .replace(/(rating:[qes])\w+/ig, "$1")
                        .toLowerCase().split(/,/).join('\n'));
                }
            } catch (e) {
                errorlog(e);
                throw e;
            }
        });
    }
    //Set the push blacklist button
    setPushButtonClick() {
        $(`[name="safelist-push-level-${this.level}"]`).off().click(function(e) {
            try {
                let match = /safelist-push-level-(.*)/.exec(e.target.name);
                if (match) {
                    let level = match[1];
                    let keyinput = confirm("Update your blacklist on Danbooru?");
                    if (keyinput) {
                        let tagdata = $("#safelist_tags_level_"+level).val().replace(/\n/g,'\r\n');
                        let senddata = {'user':{'blacklisted_tags': tagdata}};
                        let user = Danbooru.meta("current-user-id");
                        $.ajax({
                          type: "PUT",
                          url: "/users/" + user + ".json",
                          data: senddata,
                          success: function(data) {
                            debuglog("Success",data);
                            Danbooru.notice("Settings updated.");
                          },
                          error: function(data) {
                            debuglog("Failure",data);
                            Danbooru.notice("Error updating settings!");
                          }
                        });
                    }
                }
            } catch (e) {
                errorlog(e);
                throw e;
            }
        });
    }
    //Set the validate blacklist button
    setValidateButtonClick() {
        $(`[name="safelist-validate-level-${this.level}"]`).off().click(function(e) {
            try {
                let match = /safelist-validate-level-(.*)/.exec(e.target.name);
                if (match) {
                    let level = match[1];
                    //Only process if ValidateBlacklist is installed
                    if (typeof(ValidateBlacklist)=='function') {
                        $(`[name="safelist-validate-level-${level}"]`).hide();
                        $(`[name="safelist-reset-level-${level}"]`).show();
                        $(`#safelist-settings-level-${level} .safelist-output`).show();
                        //Get current tags in tag box
                        var safelevel = safelist_config.levels[level];
                        let taglist = $("#safelist_tags_level_"+level).val().split('\n');
                        safelevel.$results = $("#safelist_results_level_"+level);
                        safelevel.logger = new TextboxLogger("#safelist_feedback_level_"+level);
                        safelevel.blacklist = new ValidateBlacklist(taglist,safelevel.logger);
                        //Clear both output areas
                        safelevel.logger.clear();
                        safelevel.$results[0].innerHTML = "";
                        //Start processing the lists
                        safelevel.blacklist.processList();
                        setTimeout(()=>{safelevel.validateCallback();},timeout_polling_interval);
                    } else {
                        Danbooru.notice("Validate Blacklist not installed!");
                        $(`[name="safelist-validate-level-${level}"]`)[0].setAttribute("disabled","true");
                    }
                }
            } catch (e) {
                errorlog(e);
                throw e;
            }
        });
    }
    //Set the reset button
    setResetButtonClick() {
        $(`[name="safelist-reset-level-${this.level}"]`).off().click(function(e) {
            try {
                let match = /safelist-reset-level-(.*)/.exec(e.target.name);
                if (match) {
                    let level = match[1];
                    //Was the validate global variable instantiated...?
                    var safelevel = safelist_config.levels[level];
                    if (('blacklist' in safelevel) && (safelevel.blacklist instanceof ValidateBlacklist)) {
                        $(`[name="safelist-reset-level-${level}"]`).hide();
                        $(`[name="safelist-validate-level-${level}"]`).show();
                        safelevel.blacklist.allstop();
                    } else {
                        Danbooru.notice("Validate Blacklist not initiated!");
                        $(`[name="safelist-reset-level-${level}"]`)[0].setAttribute("disabled","true");
                    }
                }
            } catch (e) {
                errorlog(e);
                throw e;
            }
        });
    }
    //Set apply button
    setApplyButtonClick() {
        $(`[name="safelist-apply-level-${this.level}"]`).off().click(function(e) {
            try {
                let match = /safelist-apply-level-(.*)/.exec(e.target.name);
                if (match) {
                    let level = match[1];
                    var safelevel = safelist_config.levels[level];
                    if (('blacklist' in safelevel) && (safelevel.blacklist instanceof ValidateBlacklist)) {
                        $(`[name="safelist-apply-level-${level}"]`).hide();
                        $(`[name="safelist-validate-level-${level}"]`).show();
                        $("#safelist_tags_level_"+level).val(safelevel.blacklist.reconstructed_list.join('\n'));
                        safelevel.logger.log("Blacklist has been updated in text area!");
                        safelevel.logger.log("Click 'Save' to update Safelist settings...");
                        if (safelist_config.enable_write_mode) {
                            safelevel.logger.log("...or click 'Push' to update Danbooru blacklist.");
                        }
                    } else {
                        Danbooru.notice("Validate Blacklist not initiated!");
                        $(`[name="safelist-apply-level-${level}"]`)[0].setAttribute("disabled","true");
                    }
                }
            } catch (e) {
                errorlog(e);
                throw e;
            }
        });
    }
    //Set delete button
    setDeleteButtonClick() {
        $(`[name="safelist-delete-level-${this.level}"]`).off().click(function(e) {
            try {
                let match = /safelist-delete-level-(.*)/.exec(e.target.name);
                if (match) {
                    let level = match[1];
                    let value = safelist_config.levels[level];
                    $("#safelist-settings-level-"+level).hide();
                    value.enabled=false;
                }
            } catch (e) {
                errorlog(e);
                throw e;
            }
        });
    }
    
    /////////////////////
    //Helper functions
    
    //Callback for the validate button
    validateCallback() {
        try {
            if (this.blacklist.is_ready) {
                this.$results[0].innerHTML = this.blacklist.reconstructed_html;
                $(`[name="safelist-reset-level-${this.level}"]`).hide();
                if (!this.blacklist.unchanged) {
                    $(`[name="safelist-apply-level-${this.level}"]`).show();
                    //Load the legend...
                    //Doing this here so that we don't have to check for the addon at program initialization
                    let $tooltip = $(`#safelist_results_level_${this.level} + .validate-blacklist`);
                    let $label = $(`[for=safelist_results_level_${this.level}]`);
                    if ($tooltip.length) {
                        $tooltip[0].innerHTML = ValidateBlacklist.legend;
                        $tooltip.addClass("tooltip");
                        $label[0].innerHTML = "Results (hover for legend)";
                    }
                } else {
                    $(`[name="safelist-validate-level-${this.level}"]`).show();
                }
            } else if ((!this.blacklist.stop)&&(!this.blacklist.error)) {
                debuglog("Reschedule callback");
                var me = this;
                setTimeout(()=>{me.validateCallback();},timeout_polling_interval);
            }
        } catch (e) {
            errorlog(e);
            throw e;
        }
    }
    //Tag & text functions
    
    //The following are completely tag related and will be hidden
    scrubTags() {
        //Only start calculating once the active enabled list is done
        if (checkPriority()) {
            var me = this;
            setTimeout(()=>{me.scrubTags();},500);
            return;
        }
        showTags();
        if (this.isEmpty) {return;}
        console.time("ScrubTags");
        if ($("#c-posts").length) {
            hideTags(".search-tag",1,this.list);
        }
        if ($("#c-favorites").length) {
            hideTags(".search-tag",1,this.list);
        }
        if ($("#c-wiki-pages").length) {
            hideTags("#c-wiki-pages li a",0,this.list);
            hideTags("#c-wiki-pages .striped td:nth-of-type(1) a",2,this.list);
        }
        if ($("#c-wiki-page-versions").length) {
            hideTags("#c-wiki-page-versions li a",0,this.list);
            hideTags("#c-wiki-page-versions .striped td:nth-of-type(1) a",2,this.list);
        }
        if ($("#c-artists").length) {
            hideTags("#c-artists .striped td:nth-of-type(1) a",2,this.list);
        }
        if ($("#c-artist-versions").length) {
            hideTags("#c-artist-versions td:nth-of-type(1) a",2,this.list);
        }
        if ($("#c-tags").length) {
            hideTags("#c-tags .striped td:nth-of-type(2) a:nth-of-type(2)",2,this.list);
        }
        if ($("#c-meta-searches").length) {
            hideTags("#c-meta-searches .striped td:nth-of-type(1)",1,this.list);
            hideTags("#c-meta-searches .striped td:nth-of-type(2)",1,this.list);
        }
        if ($("#c-explore-posts #a-searches").length) {
            hideTags("#c-explore-posts #a-searches .striped td:nth-of-type(1) a",2,this.list);
        }
        if ($("#c-explore-posts #a-missed-searches").length) {
            hideTags("#c-explore-posts #a-missed-searches .striped td:nth-of-type(1) a",2,this.list);
        }
        console.timeEnd("ScrubTags");
    }
    //The following may only be partially tag-related and will be replaced with replacement text
    scrubText() {
        if (this.isEmpty) {return;}
        if ((!validateExpandableStatus.isdone)||checkPriority()) {
            var me = this;
            setTimeout(()=>{me.scrubText();},500);
            return;
        }
        console.time("ScrubText");
        if ($("#c-forum-topics #a-index").length) {
            hideText("#c-forum-topics #a-index .striped td:nth-of-type(1) a:not(.last-page)",this.list);
        }
        if ($("#c-forum-topics #a-show").length) {
            hideText("#c-forum-topics #a-show h1",this.list);
        }
        if ($("#c-dmails #a-index").length) {
            hideText("#c-dmails #a-index .striped td:nth-of-type(4) a",this.list);
        }
        if ($("#c-dmails #a-show").length) {
            hideText("#c-dmails #a-show h2",this.list);
        }
        if ($("#c-wiki-pages #a-show").length) {
            hideText("#wiki-page-title",this.list);
        }
        if ($("#c-artists #a-show").length) {
            hideText("#c-artists #a-show h1",this.list);
        }
        if ($("#c-upload-tags-report #a-show").length) {
            hideText("#c-upload-tags-report #a-show .striped td:not(:first-of-type)",this.list);
        }
        if ($("#c-post-versions #a-index").length) {
            hideText(".diff-list",this.list);
        }
        if ($("#c-notes #a-index").length) {
            hideText("#c-notes #a-index .striped td:nth-of-type(4)",this.list);
        }
        if ($("#c-note-versions #a-index").length) {
            hideText("#c-note-versions #a-index .striped td:nth-of-type(4)",this.list);
        }
        if ($("#c-posts #a-show").length) {
            hideText("#c-posts #a-show #artist-commentary h3",this.list);
            delayHideText("#notes article","#c-posts #a-show .note-box-inner-border",this.list);
            delayHideText("#notes article","#c-posts #a-show .note-body",this.list);
        }
        if ($("#c-pools #a-index").length) {
            hideText("#c-pools #a-index .striped td:nth-of-type(2) a:not(.last-page)",this.list);
        }
        if ($("#c-pools #a-show").length) {
            hideText("#c-pools #a-show h1 a",this.list);
        }
        if ($("#c-pools #a-gallery").length) {
            hideText("#c-pools #a-gallery .desc",this.list);
        }
        if ($("#c-pool-versions #a-index").length) {
            hideText("#c-pool-versions #a-index .striped td:nth-of-type(1)",this.list);
        }
        if ($("#c-bans #a-index").length) {
            hideText("#c-bans #a-index .striped td:nth-of-type(5)",this.list);
        }
        if ($("#c-user-feedbacks #a-index").length) {
            hideText("#c-user-feedbacks #a-index .striped td:nth-of-type(4)",this.list);
        }
        if ($("#c-burs #a-index").length) {
            hideText("#c-burs #a-index .striped td:nth-of-type(4)",this.list);
        }
        if ($("#c-artist-commentaries #a-index").length) {
            hideText("#c-artist-commentaries #a-index .striped h3",this.list);
        }
        if ($("#c-artist-commentary-versions #a-index").length) {
            //Replace this with h3 if https://github.com/r888888888/danbooru/issues/3187 gets fixed
            hideText("#c-artist-commentary-versions #a-index .striped td:nth-of-type(2)",this.list);
            hideText("#c-artist-commentary-versions #a-index .striped td:nth-of-type(3)",this.list);
        }
        if ($("#c-tag-aliases #a-index").length) {
            hideText("#c-tag-aliases #a-index .striped td:nth-of-type(1)",this.list);
            hideText("#c-tag-aliases #a-index .striped td:nth-of-type(2)",this.list);
        }
        if ($("#c-tag-implications #a-index").length) {
            hideText("#c-tag-implications #a-index .striped td:nth-of-type(1)",this.list);
            hideText("#c-tag-implications #a-index .striped td:nth-of-type(2)",this.list);
        }
        if ($("#c-post-appeals #a-index").length) {
            hideText("#c-post-appeals #a-index .striped td:nth-of-type(2)",this.list);
        }
        if ($("#c-post-flags #a-index").length) {
            hideText("#c-post-flags #a-index .striped td:nth-of-type(2)",this.list);
        }
        //There are a lot of these, so check every time
        if ($(".prose:not(.dtext-preview)").length) {
            hideText(".prose:not(.dtext-preview)",this.list);
            fixExpandables();
        }
        console.timeEnd("ScrubText",this.list);
    }
}

//////////////////
//Main functions

function initializeSafelist() {
    getActualTime("Initialize start:");
    console.time("Initialize");
    console.time("PreInit");
    loadProgramData();
    loadSessionData();
    validateExpandableStatus();
    console.timeEnd("PreInit");
    if ($("#blacklist-box").length&&!($("#c-wiki-pages").length||$("#c-wiki-page-versions").length)) {
        console.time("SideSetup");
        setCSSStyle(safelist_css,"safelist_css");
        menu_items = calculateRenderedMenus();
        $("#blacklist-box").after(renderSidemenu());
        setListClicks();
        post_list_dict.a = [];
        post_list_dict.n = safelistPosts();
        createEntryArray();
        console.timeEnd("SideSetup");
        if (safelist_session.enable_safelist) {
            $("#enable-safelist").click();
        } else {
            $("#disable-safelist").click();
        }
        if ('requestIdleCallback' in window) {
            calculateLists.handle = requestIdleCallback(calculateLists);
        } else {
            //Need to test out the following
            calculateLists.handle = setTimeout(calculateLists,list_callback_retrytime);
        }
    } else if ((safelist_session.enable_safelist) && (safelist_session.active_list !== undefined)) {
        //Activate any non-post functions if applicable
        console.time("NonPost");
        //Value could be undefined if the active list was pruned
        let value = safelist_config.levels[safelist_session.active_list];
        //For the check priority function
        post_list_dict[safelist_session.active_list] = [];
        value && setCSSStyle(value.renderedCSS(),"safelist_user_css");
        if (safelist_config.enable_text_replace) {
            value && value.scrubText();
        }
        if (safelist_config.enable_tag_hide) {
            value && value.scrubTags();
        }
        console.timeEnd("NonPost");
    }
    //Render settings menu only from post index page
    //Since it starts out hidden, we are doing it last
    if($("#c-posts #a-index").length) {
        console.time("MenuSetup");
        $("#post-sections li:last-child").after(renderSettingMenuLink());
        $("#excerpt").before(renderSettingMenu());
        $("#safelist-settings").hide();
        setSettingsClicks();
        if (!safelist_config.enable_write_mode) {
            $.each($(".safelist-push"), (i,entry)=>{entry.setAttribute("disabled",true);});
        }
        if (!safelist_config.enable_validate_mode) {
            $.each($(".safelist-validate"), (i,entry)=>{entry.setAttribute("disabled",true);});
        }
        console.timeEnd("MenuSetup");
    }
    console.timeEnd("Initialize");
}

function reloadSafelist(configure,changed_menus) {
    console.time("Reload");
    //The side menu has changed, so rerender it
    if (changed_menus.length) {
        //Redraw the safelist sidemenu
        $("#safelist-box")[0].outerHTML = renderSidemenu();
        setListClicks();
        setActiveList(safelist_session.active_list,'active');
        //The following avoids using (enable/disable).click(), which can potentially cause unneeded work
        if(safelist_session.enable_safelist) {
            $("#enable-safelist").hide();
            $("#disable-safelist").show();
        }
        else {
            $("#safelist").hide();
            $("#enable-safelist").show();
            $("#disable-safelist").hide();
        }
    }
    if ('levels' in configure) {
        //A list has changed, so recreate the entry array
        if (_.reduce(safelist_config.levels,(result,value)=>{return result || ('list' in value);},false)) {
            debuglog("Updating custom entries...");
            createEntryArray();
        }
        $.each(configure.levels,(level,val)=>{
            let value = safelist_config.levels[level];
            if ('list' in val) {
                delete post_list_dict[level];
                if (safelist_session.enable_safelist && (safelist_session.active_list == level)) {
                    //The list was active, so set it to pending
                    setActiveList(safelist_session.active_list,'pending');
                    signalActiveList(true);
                }
            }
            if (('css' in val) && safelist_session.enable_safelist && (safelist_session.active_list == level)) {
                setCSSStyle(value.renderedCSS(),"safelist_user_css");
            }
            if ('name' in val) {
                $("#safelist-heading-level-"+level)[0].innerHTML = value.name;
                if (changed_menus.length === 0) {$("#safe-level-"+level)[0].innerHTML = value.name;}
            }
            if ('hotkey' in val) {
                value.setKeypress();
            }
        });
        restartLists();
    }
    if ('name' in configure) {
        $("#safelist-box h1")[0].innerHTML = safelist_config.name;
        $("#show-safelist-settings-link")[0].innerHTML = safelist_config.name;
    }
    let value = safelist_config.levels[safelist_session.active_list];
    if (('enable_text_replace' in configure) || (('replacement_text' in configure))) {
        if (safelist_config.enable_text_replace) {
            //Only hide text if the list is defined and enabled
            value && value.enabled && value.scrubText();
        } else {
            showText();
        }
    }
    if ('enable_tag_hide' in configure) {
        if (safelist_config.enable_tag_hide) {
            //Only hide tags if the list is defined and enabled
            value && value.enabled && value.scrubTags();
        } else {
            showTags();
        }
    }
    if ('enable_write_mode' in configure) {
        if (safelist_config.enable_write_mode) {
            $.each($(".safelist-push"), (i,entry)=>{entry.removeAttribute("disabled");});
        } else {
            $.each($(".safelist-push"), (i,entry)=>{entry.setAttribute("disabled",true);});
        }
    }
    if ('enable_validate_mode' in configure) {
        if (safelist_config.enable_validate_mode) {
            $.each($(".safelist-validate"), (i,entry)=>{entry.removeAttribute("disabled");});
        } else {
            $.each($(".safelist-validate"), (i,entry)=>{entry.setAttribute("disabled",true);});
        }
    }
    if (('use_session_enable' in configure) || ('use_session_level' in configure)) {
        setSessionData();
    }
    $("#safelist-rawsettings > textarea").val(json_settings);
    console.timeEnd("Reload");
}

//Set Safelist config before calling this function
function resetAllSettings() {
    //Cancel any list calculations
    signalActiveList();
    restartLists();
    menu_items = calculateRenderedMenus();
    createEntryArray();
    post_list_dict = {};
    post_list_dict.a = [];
    post_list_dict.n = safelistPosts();
    //Side menu items
    $("#safelist-box")[0].outerHTML = renderSidemenu();
    setListClicks();
    initialSessionData(true);
    $("#disable-safelist").click();
    showHidePosts(safelistPosts());
    //Settings menu
    $("#show-safelist-settings-link")[0].innerHTML = safelist_config.name;
    $("#safelist-settings")[0].outerHTML = renderSettingMenu();
    $("#safelist-settings").hide();
    setSettingsClicks();
    if (!safelist_config.enable_write_mode) {
        $.each($(".safelist-push"), (i,entry)=>{entry.setAttribute("disabled",true);});
    }
    if (!safelist_config.enable_validate_mode) {
        $.each($(".safelist-validate"), (i,entry)=>{entry.setAttribute("disabled",true);});
    }
}

/////////////////////
//Helper functions

//Resets all program variables to Default values
function initialProgramData() {
    safelist_config = {};
    safelist_config.name = "Safelist";
    safelist_config.levels = {};
    ['a','n','1'].map((level,i)=>{ safelist_config.levels[level]=new Safelist(level);});
    safelist_config.next_index = 2;
    safelist_config.enable_tag_hide = false;
    safelist_config.enable_text_replace = false;
    safelist_config.enable_validate_mode = false;
    safelist_config.enable_write_mode = false;
    safelist_config.use_session_enable = false;
    safelist_config.use_session_level = false;
    safelist_config.replacement_text = '';
}

//Loads program data from storage
function loadProgramData() {
    safelist_config = window.localStorage.safelist_config;
    if(safelist_config!==undefined){
        try {
            safelist_config = JSON.parse(safelist_config);
        } catch (e) {
            Danbooru.notice("Settings corrupted... reverting to initial configuration.");
            initialProgramData();
            setProgramData();
            return;
        }
        $.each(safelist_config.levels, (level,val)=>{
            safelist_config.levels[level] = Object.assign(new Safelist(''),val);
        });
        pruneCustomLists();
    } else {
        initialProgramData();
    }
    setProgramData();
}

//Stores program data
function setProgramData() {
    validateProgramData();
    window.localStorage.safelist_config = json_settings = JSON.stringify(safelist_config);
}

//Validates program data
function validateProgramData() {
    debuglog("Checking configuration");
    if (typeof(safelist_config)!=='object') {
        debuglog("Invalid configuration variable");
        safelist_config = {};
    }
    validateData(safelist_config,'name','string',"Safelist");
    validateData(safelist_config,'replacement_text','string',"");
    validateData(safelist_config,'enable_tag_hide','boolean',false);
    validateData(safelist_config,'enable_text_replace','boolean',false);
    validateData(safelist_config,'enable_write_mode','boolean',false);
    validateData(safelist_config,'enable_validate_mode','boolean',false);
    validateData(safelist_config,'use_session_enable','boolean',false);
    validateData(safelist_config,'use_session_level','boolean',false);
    if (validateData(safelist_config,'levels','object',{})) {
        let maxlevel = 0;
        $.each(safelist_config.levels, (key,value)=>{
            debuglog("Checking safelist "+key);
            if (!(value instanceof Safelist)) {
                debuglog('Invalid Safelist');
                safelist_config.levels[key] = new Safelist(key);
            } else {
                if (key!==value.level) {
                    debuglog('Invalid key: level');
                    value.level=key;
                }
                value.validateSafelistData();
            }
            maxlevel = (value.isVariable?Math.max(parseInt(key),maxlevel):maxlevel);
        });
        safelist_config.next_index = maxlevel + 1;
    } else {
        ['a','n','1'].map((level,i)=>{ safelist_config.levels[level]=new Safelist(level);});
        safelist_config.next_index = 2;
    }
    _(safelist_config).each((val,key)=>{
        if ($.inArray(key,['name','replacement_text','enable_tag_hide','enable_text_replace',
                            'enable_write_mode','enable_validate_mode','use_session_enable','use_session_level',
                            'levels','next_index','enable_safelist','active_list'])<0) {
            debuglog(`Deleting key: ${key}`);
            delete safelist_config[key];
        }
    });
}

function initialSessionData(enabled = false) {
    safelist_session = {};
    safelist_session.enable_safelist = enabled;
    safelist_session.active_list = undefined;
}

//Loads session data from storage
function loadSessionData() {
    safelist_session = window.sessionStorage.safelist_session;
    if(safelist_session!==undefined) {
        try {
            safelist_session = JSON.parse(safelist_session);
        } catch (e) {
            initialSessionData();
        }
    } else {
        initialSessionData();
    }
    if (!safelist_config.use_session_enable) {
        safelist_session.enable_safelist = (safelist_config.enable_safelist!==undefined?safelist_config.enable_safelist:false);
    }
    if (!safelist_config.use_session_level) {
        safelist_session.active_list = safelist_config.active_list;
    }
    setSessionData();
}

//Stores session data
function setSessionData() {
    window.sessionStorage.safelist_session = JSON.stringify(safelist_session);
    if ((!safelist_config.use_session_enable)||(!safelist_config.use_session_level)) {
        //Don't use the working safelist config since that could be modifed
        //Changes to long-term storage should only take place if the user clicks "Save"
        let tempparse = JSON.parse(window.localStorage.safelist_config);
        if (!safelist_config.use_session_enable) {
            tempparse.enable_safelist = safelist_session.enable_safelist;
        }
        if (!safelist_config.use_session_level) {
            tempparse.active_list = safelist_session.active_list;
        }
        window.localStorage.safelist_config = JSON.stringify(tempparse);
    }
}

//Removing lists only at page load helps with the detection of new list adds
//Plus it removes errors for something that could still using a deleted level's data
function pruneCustomLists() {
    $.each(safelist_config.levels, (level,val)=>{
        if(val.isPrunable) {
            delete safelist_config.levels[level];
        }
    });
}

//Set the style for the active list in the side menu
function setActiveList(level,type) {
    if (level===undefined) {return;}
    $("#safelist li").removeClass("safelist-active safelist-pending");
    $(`#safe-level-${level}`).parent().addClass(`safelist-${type}`);
}

//Create the same structure that Danbooru uses for each custom list
function createEntryArray(){
    custom_entries = {};
    $.each(safelist_config.levels, (level,val)=>{
        if(val.isVariable) {
            var array = [];
            $.each(val.list, (i,tags)=>{
                var entry = Danbooru.Blacklist.parse_entry(tags);
                array.push(entry);
            });
            custom_entries[level]=array;
        }
    });
}

//Sets the css style and retains a pointer to the DOM object for later edits
function setCSSStyle(csstext,title) {
    if (title in cssstyle_dict) {
        cssstyle_dict[title].innerHTML = csstext;
    } else {
        cssstyle_dict[title] = document.createElement('style');
        cssstyle_dict[title].type = 'text/css';
        cssstyle_dict[title].innerHTML = csstext;
        document.head.appendChild(cssstyle_dict[title]);
    }
}

//A faster way to show and hide posts using precalcuated lists
function showHidePosts(postlist) {
    console.time("showHidePosts");
    $.each(_.difference(safelistPosts(),postlist), (i,post)=>{
        safelistUnhide(post);
    });
    $.each(postlist, (i,post)=>{
        safelistHide(post);
    });
    console.timeEnd("showHidePosts");
}

//Copy of Danbooru's functions since we're using a different class to hide items
function safelistHide(post) {
    var $post = $(post);
    $post.removeClass("safelist-active");
    var $video = $post.find("video").get(0);
    if ($video) {
        $video.pause();
        $video.currentTime = 0;
    }
}

function safelistUnhide(post) {
    var $post = $(post);
    $post.addClass("safelist-active");
    var $video = $post.find("video").get(0);
    if ($video) {
        $video.play();
    }
}

//Get the current state of the menus for other functions to use
function calculateRenderedMenus() {
    var menu = {'rendered_menus':[],'variable_menus':[],'process_menus':[]};
    $.each(safelist_config.levels, (level,val)=>{
        if (val.enabled) {
            if (val.isVariable) {
                menu.variable_menus.push(parseInt(val.level));
                if (val.background_process) {
                    menu.process_menus.push(parseInt(val.level));
                }
            }
            menu.rendered_menus.push(val.level);
        }
    });
    //Sort from lowest to highest, and then set to string
    menu.variable_menus = menu.variable_menus.sort((a,b)=>{return a-b;}).map((level,i)=>String(level));
    menu.process_menus = menu.process_menus.sort((a,b)=>{return a-b;}).map((level,i)=>String(level));
    return menu;
}

function checkPriority() {
    return ((safelist_session.enable_safelist) && (safelist_session.active_list!==undefined) && (!(safelist_session.active_list in post_list_dict)));
}

function safelistPosts() {
    return $(".post-preview, #image-container, #c-comments .post");
}

///////////////////////////
//Calculate list functions

//Asynchronous function that calculates inactive lists in the background
function calculateLists(deadline) {
    try {
        //Only start calculating once the active enabled list is done
        if (checkPriority()) {
            if ('requestIdleCallback' in window) {
                calculateLists.handle = requestIdleCallback(calculateLists);
            } else {
                calculateLists.handle = setTimeout(calculateLists,list_callback_retrytime);
            }
            return;
        }
        if (calculateLists.$safelist_posts === undefined) {calculateLists.$safelist_posts = safelistPosts();}
        if (!('requestIdleCallback' in window)) {deadline = performance.now();}
        while (true) {
            //Are we starting a new job?
            if (!('update_list' in calculateLists.background_work)) {
                //Get the next uncalculated list
                //let update_list = _(menu_items.variable_menus).concat(['a','n','danbooru']).xor(Object.keys(post_list_dict)).shift();
                let update_list = _(menu_items.process_menus).difference(Object.keys(post_list_dict)).shift();
                //Main exit condition
                if (update_list === undefined) {
                    debuglog("Lists done!");
                    return;
                }
                if (calculateLists.lists_processed===0) {getActualTime("Passive list start:");}
                calculateLists.lists_processed++;
                //Initialize FOR loop and other variables
                calculateLists.background_work.update_list = update_list;
                calculateLists.background_work.start_id = 0;
                calculateLists.background_work.update_array = [];
                calculateLists.background_work.start_time = performance.now();
            } else if (calculateLists.background_work.update_list in post_list_dict) {
                //User has changed list from inactive to active midst calculating
                calculateLists.background_work = {};
                continue;
            }
            let index = calculateLists.background_work.update_list;
            //Restart the FOR loop where we left off
            for (let i=calculateLists.background_work.start_id;i < calculateLists.$safelist_posts.length;i++) {
                for (let j=0;j<custom_entries[index].length;j++){
                    if (Danbooru.Blacklist.post_match(calculateLists.$safelist_posts[i], custom_entries[index][j])) {
                        calculateLists.background_work.update_array.push(calculateLists.$safelist_posts[i]);
                        //Bail early on any entry match
                        break;
                    }
                }
                calculateLists.background_work.start_id++;
                if ('requestIdleCallback' in window) {
                    if (deadline.timeRemaining() <= 0.0) {
                        //Release function back to idle pool
                        calculateLists.handle = requestIdleCallback(calculateLists);
                        return;
                    }
                }
                //Release the process every once in a while to avoid locking up the processor
                //Using a 50% on/off duty cycle at a constant interval
                else if ((performance.now() - deadline)>list_callback_polling_interval) {
                    calculateLists.handle = setTimeout(calculateLists,list_callback_polling_interval);
                    return;
                }
            }
            //Add finished list to global variable
            post_list_dict[index] = calculateLists.background_work.update_array;
            console.log(`Completed list ${index}: `,performance.now()-calculateLists.background_work.start_time);
            calculateLists.background_work = {};
        }
    } catch (e) {
        errorlog(e);
        throw e;
    }
}
calculateLists.background_work = {};
calculateLists.lists_processed = 0;

function restartLists() {
    if ('requestIdleCallback' in window) {
        cancelIdleCallback(calculateLists.handle);
        setTimeout(()=>{
            calculateLists.background_work = {};
            calculateLists.handle = requestIdleCallback(calculateLists);
            },500);
        } else {
        clearTimeout(calculateLists.handle);
        setTimeout(()=>{
            calculateLists.background_work = {};
            calculateLists.handle = setTimeout(calculateLists,list_callback_retrytime);
            },500);
    }
}

//Like caclulateLists, but for the active list, plus it has higher priority
function calculateActiveList() {
    try {
        if (calculateActiveList.$safelist_posts === undefined) {calculateActiveList.$safelist_posts = safelistPosts();}
        if (('level' in calculateActiveList.background_work)&&(safelist_session.active_list != calculateActiveList.background_work.level)) {
            debuglog("Changing list...");
            calculateActiveList.background_work = {};
        }
        if ((safelist_session.active_list in post_list_dict)||(!safelist_session.enable_safelist)) {
            debuglog("Bailing on work...");
            calculateActiveList.background_work = {};
            setActiveList(safelist_session.active_list,'active');
            return;
        }
        if (!('level' in calculateActiveList.background_work)) {
            getActualTime("Active list start:");
            calculateActiveList.background_work.level = safelist_session.active_list;
            calculateActiveList.background_work.start_id = 0;
            calculateActiveList.background_work.update_array = [];
            calculateActiveList.background_work.start_time = performance.now();
        }
        let level = calculateActiveList.background_work.level;
        let iteration_time = performance.now();
        for (let i=calculateActiveList.background_work.start_id;i < calculateActiveList.$safelist_posts.length;i++) {
            for (let j=0;j<custom_entries[level].length;j++){
                if (Danbooru.Blacklist.post_match(calculateActiveList.$safelist_posts[i], custom_entries[level][j])) {
                    calculateActiveList.background_work.update_array.push(calculateActiveList.$safelist_posts[i]);
                    //Bail early on any entry match
                    break;
                }
            }
            calculateActiveList.background_work.start_id++;
            //Pass control back every once in a while to avoid locking up the browser
            if ((performance.now() - iteration_time) > 50.0) {
                calculateActiveList.handle = setTimeout(calculateActiveList,1);
                return ;
            }
        }
        post_list_dict[level] = calculateActiveList.background_work.update_array;
        console.log("Completed active list:",performance.now()-calculateActiveList.background_work.start_time);
        setActiveList(safelist_session.active_list,'active');
        showHidePosts(post_list_dict[level]);
        calculateActiveList.background_work = {};
    } catch (e) {
        errorlog(e);
        throw e;
    }
}
calculateActiveList.background_work = {};

function signalActiveList(restart=false) {
    clearTimeout(calculateActiveList.handle);
    if (checkPriority()) {
        setTimeout(()=>{
            calculateActiveList.background_work = {};
            if (restart) {calculateActiveList.handle = setTimeout(calculateActiveList,1);}
            },500);
    }
}

////////////////////
//Render functions

function renderSidemenu() {
    let safelistBox = `
<section id="safelist-box">
    <h1>${safelist_config.name}</h1>
    <ul id="safelist">`;
    safelistBox += safelist_config.levels.a.renderedSide();
    $.each(menu_items.variable_menus, (i,level)=>{safelistBox += safelist_config.levels[level].renderedSide();});
    safelistBox += safelist_config.levels.n.renderedSide();
    return safelistBox + `
    </ul>
    <a href="#" id="enable-safelist">Enable</a>
    <a href="#" id="disable-safelist">Disable</a>
</section>`;
}

function renderSettingMenuLink() {
    return `
<li><a href="#" id="show-safelist-settings-link">${safelist_config.name}</a></li>`;
}

function renderSettingMenu() {
    let menustring = `
<fieldset id="safelist-settings">
    <div class="input" id="safelist-settings-optional">
        <h2>Options</h2>`;
    menustring += renderOptionTextinput('name');
    menustring += renderOptionTextinput('replacement_text');
    menustring += renderOptionCheckbox('enable_tag_hide');
    menustring += renderOptionCheckbox('enable_text_replace');
    menustring += renderOptionCheckbox('enable_write_mode');
    menustring += renderOptionCheckbox('enable_validate_mode');
    menustring += renderOptionCheckbox('use_session_enable');
    menustring += renderOptionCheckbox('use_session_level');
    menustring += `
        <div class="clearfix"></div>
    </div>`;
    menustring += safelist_config.levels.a.renderLevelSetting();
    menustring += safelist_config.levels.n.renderLevelSetting();
    $.each(menu_items.variable_menus, (i,level)=>{menustring += safelist_config.levels[level].renderLevelSetting();});
    return menustring + `
    <hr>
    <div id="safelist-controls">
        <input type="submit" name="safelist-commit" value="Submit" class="btn">
        <input type="submit" name="safelist-add" value="Add" class="btn">
        <input type="submit" name="safelist-resetall" value="Reset All" class="btn">
        <input type="submit" name="safelist-showhideraw" value="Show Raw" class="btn">
    </div>
    <div id="safelist-rawsettings">
        <textarea style="width:100%;height:10em">${json_settings}</textarea>
        <span class="hint">Used to transfer settings between domains/computers.  <b>Settings here take priority!</b>.</span>
    </div>
</fieldset>
`;
}

function renderOptionTextinput(setting) {
    const name = "safelist-" + _.kebabCase(setting);
    const title = _.startCase(setting);
    const value = sanitizeForHTML(safelist_config[setting]);
    return `<div class="safelist-textinput">
        <label for="${name}">${title}</label>
        <input type="text" name="${name}" value="${value}" size="40" autocomplete="off">
    </div>`;
}

function renderOptionCheckbox(setting) {
    const name = _.camelCase(setting);
    const id = "safelist-" + _.kebabCase(setting);
    const label = _.startCase(setting);
    const value = (safelist_config[setting] ? "checked" : "");
    const hint = help_hints[setting];
    return `
        <div class="safelist-checkbox">
            <label for="${id}"  style="width:13em">${label}</label>
            <input type="checkbox" ${value} name="${name}" id="${id}">
            <span class="tooltip">${hint}</span>
        </div>`;
}

////////////////////
// Click functions

//List clicks

function setListClicks() {
    $.each(safelist_config.levels, (key,value)=>{
        value.setSideLevelClick();
        value.setKeypress(key);
    });
    enableSafelistClick();
    disableSafelistClick();
}

function enableSafelistClick() {
    $("#enable-safelist").off().click(function(e) {
        try {
            console.time("Enable");
            setCSSStyle(css_enabled,"blacklist_css");
            $("#safelist").show();
            $("#enable-safelist").hide();
            $("#disable-safelist").show();
            if ($.inArray(safelist_session.active_list,menu_items.rendered_menus)>=0){
                $("#safe-level-"+safelist_session.active_list).click();
            }
            safelist_session.enable_safelist = true;
            setSessionData();
            console.timeEnd("Enable");
            e.preventDefault();
        } catch (e) {
            errorlog(e);
            throw e;
        }
    });
}

function disableSafelistClick() {
    $("#disable-safelist").off().click(function(e) {
        try {
            console.time("Disable");
            setCSSStyle('',"blacklist_css");
            //The following should not run at program initialization
            if (safelist_session.enable_safelist) {
                setCSSStyle('',"safelist_user_css");
                if (safelist_config.enable_tag_hide) {
                    showTags();
                }
                if (safelist_config.enable_text_replace) {
                    showText();
                }
                $("#show-posts-link").click();
            }
            $("#safelist").hide();
            $("#enable-safelist").show();
            $("#disable-safelist").hide();
            safelist_session.enable_safelist = false;
            setSessionData();
            console.timeEnd("Disable");
            e.preventDefault();
        } catch (e) {
            errorlog(e);
            throw e;
        }
    });
}

//Menu settings clicks

function setSettingsClicks() {
    setSaveButtonClick();
    setAddButtonClick();
    setResetAllButtonClick();
    setRawClick();
    setChangeMenuClick();
    $.each(safelist_config.levels, (level,val)=>{
        val.setMenuLevelClicks();
    });
}

function setChangeMenuClick() {
    $("#post-sections a").off("click").click(function(e) {
        try {
            const post_sections = ["posts","excerpt","safelist-settings"];
            $("#post-sections li").removeClass("active");
            $(e.currentTarget).parent().addClass("active");
            let match=/show-(.*)-link/.exec(e.currentTarget.id);
            if(match){
                let activesection = match[1];
                $.each(_.difference(post_sections,activesection), function(i, section) {
                    $("#"+section).hide();
                });
                $("#"+activesection).show();
            }
            e.preventDefault();
        } catch (e) {
            errorlog(e);
            throw e;
        }
    });
}

function setAddButtonClick() {
    $("[name=safelist-add]").off().click(function(e) {
        try {
            let index = safelist_config.next_index.toString();
            let addlist = safelist_config.levels[index] = new Safelist(index);
            $("#safelist-settings>hr").before(addlist.renderLevelSetting());
            if (!safelist_config.enable_write_mode) {$(`[name="safelist-push-level-${index}"]`)[0].setAttribute("disabled","true");}
            if (!safelist_config.enable_validate_mode) {$(`[name="safelist-validate-level-${index}"]`)[0].setAttribute("disabled","true");}
            addlist.setMenuLevelClicks();
            safelist_config.next_index++;
        } catch (e) {
            errorlog(e);
            throw e;
        }
    });
}

function setResetAllButtonClick() {
    $("[name=safelist-resetall]").off().click(function(e) {
        try {
            let keyinput = confirm("Reset all Safelist settings?");
            if (keyinput) {
                console.time("ResetAll");
                initialProgramData();
                setProgramData();
                resetAllSettings();
                console.timeEnd("ResetAll");
            }
        } catch (e) {
            errorlog(e);
            throw e;
        }
    });
}

function setRawClick() {
    $("#safelist-rawsettings").hide();
    $("[name=safelist-showhideraw]").off().click(function(e) {
        try {
            var button = $(this);
            $("#safelist-rawsettings").fadeToggle("fast");
            if (button.val() === "Show Raw") {
                button.val("Hide Raw");
            } else {
                button.val("Show Raw");
            }
        } catch (e) {
            errorlog(e);
            throw e;
        }
    });
}

function setSaveButtonClick() {
    $("[name=safelist-commit]").off().click(function(e) {
        try {
            //Save presettings change for comparison later
            let checkjson_settings = $("#safelist-rawsettings > textarea").val();
            if (json_settings != checkjson_settings) {
                debuglog("Raw change detected!");
                try {
                    safelist_config = JSON.parse(checkjson_settings);
                } catch (err) {
                    Danbooru.notice("Raw settings corrupted... reverting to original data!");
                    $("#safelist-rawsettings > textarea").val(json_settings);
                    return;
                }
                $.each(safelist_config.levels, (level,val)=>{
                    safelist_config.levels[level] = Object.assign(new Safelist(''),val);
                });
                setProgramData();
                resetAllSettings();
                return;
            }
            validateProgramData();
            var preconfig = _.cloneDeep(safelist_config);
            var premenu = calculateRenderedMenus();
            safelist_config.levels.a.enabled = $("#safelist-enable-level-a")[0].checked;
            safelist_config.levels.n.enabled = $("#safelist-enable-level-n")[0].checked;
            safelist_config.enable_tag_hide = $("#safelist-enable-tag-hide")[0].checked;
            safelist_config.enable_text_replace = $("#safelist-enable-text-replace")[0].checked;
            safelist_config.enable_write_mode = $("#safelist-enable-write-mode")[0].checked;
            safelist_config.enable_validate_mode = $("#safelist-enable-validate-mode")[0].checked;
            safelist_config.use_session_enable = $("#safelist-use-session-enable")[0].checked;
            safelist_config.use_session_level = $("#safelist-use-session-level")[0].checked;
            safelist_config.replacement_text = $("[name=safelist-replacement-text]").val().replace(/<.+?>/g,'');
            safelist_config.name = $("[name=safelist-name]").val();
            $.each(safelist_config.levels, (level,val)=>{
                if($.inArray(level,premenu.variable_menus)>=0) {
                    val.tagstring = $("#safelist_tags_level_"+level).val();
                    val.background_process = $("#safelist_background_process_level_"+level)[0].checked;
                }
                val.css = $("#safelist_css_level_"+level).val();
                val.name = $(`[name=safelist-name-level-${level}]`).val();
                val.hotkey[0] = $("#safelist_modifier_level_"+level).val();
                val.hotkey[1] = $("#safelist_keyselect_level_"+level).val();
            });
            $(".safelist-namerow .text").hide();
            $(".safelist-namerow h2").show();
            $(".safelist-namerow .btn").show();
            setProgramData();
            Danbooru.notice("Settings saved.");
            let postmenu = calculateRenderedMenus();
            let changed_menus = _.xor(postmenu.rendered_menus,menu_items.rendered_menus);
            menu_items = postmenu;
            recurseCompareSettings(preconfig,safelist_config);
            debuglog(preconfig,changed_menus);
            reloadSafelist(preconfig,changed_menus);
        } catch (e) {
            errorlog(e);
            throw e;
        }
    });
}

//////////////////////////
//Tag & Text functions

function hideTags(domname,parentlevel,list) {
    $.each($(domname), (i,domtag)=>{
        let normalizedtag = domtag.innerText.replace(' ','_');
        $.each(list, (i,censor_tag)=>{
            if(normalizedtag==censor_tag){
                let node = $(domtag);
                for (let j=0;j<parentlevel;j++){
                    node = node.parent();
                }
                node.hide();
                //bail early
                return;
            }
        });
    });
}

function showTags() {
    console.time("ShowTags");
    if ($("#c-posts").length) {
        $(".search-tag").parent().show();
    }
    if ($("#c-favorites").length) {
        $(".search-tag").parent().show();
    }
    if ($("#c-wiki-pages").length) {
        $("#c-wiki-pages li a").show();
        $("#c-wiki-pages .striped tr").show();
    }
    if ($("#c-wiki-page-versions").length) {
        $("#c-wiki-page-versions li a").show();
        $("#c-wiki-page-versions .striped tr").show();
    }
    if ($("#c-artists").length) {
        $("#c-artists .striped tr").show();
    }
    if ($("#c-artist-versions").length) {
        $("#c-artist-versions tr").show();
    }
    if ($("#c-tags").length) {
        $("#c-tags .striped tr").show();
    }
    if ($("#c-meta-searches").length) {
        $("#c-meta-searches .striped tr").show();
    }
    if ($("#c-explore-posts #a-searches").length) {
        $("#c-explore-posts #a-searches .striped tr").show();
    }
    if ($("#c-explore-posts #a-missed-searches").length) {
        $("#c-explore-posts #a-missed-searches .striped tr").show();
    }
    console.timeEnd("ShowTags");
}

//This function will clobber any existing events (only expandable buttons so far)
//However, a recursive function that avoided the above was orders of magnitude slower
function hideText(domname, list) {
    debuglog(domname);
    if(hideText[domname]===undefined) {
       hideText[domname] = {};
       hideText[domname].domlink = $(domname);
       hideText[domname].domtext = _.map(hideText[domname].domlink,"innerHTML");
    }
    $.each(hideText[domname].domlink, (i,dom)=>{
        let replace_text = hideText[domname].domtext[i];
        $.each(list, (i,censor_tag)=>{
            replace_text = replace_text.replace(tagRegExp(censor_tag),safelist_config.replacement_text);
        });
        if (dom.innerHTML != replace_text) {
            dom.innerHTML = replace_text;
        }
    });
}

function delayHideText(sourcedom,destdom,list) {
    try {
        debuglog(sourcedom,$(sourcedom).length,destdom,$(destdom).length);
        if ($(sourcedom).length != $(destdom).length) {
            setTimeout(delayHideText,50,sourcedom,destdom,list);
            return;
        }
        hideText(destdom,list);
    } catch (e) {
        errorlog(e);
        throw e;
    }
}

function showText() {
    console.time("ShowText");
    $.each(Object.keys(hideText), (i,key)=>{
        $.each(hideText[key].domlink, (i,dom)=>{dom.innerHTML=hideText[key].domtext[i];});
    });
    fixExpandables();
    console.timeEnd("ShowText");
}

///////////////////////////////////
//Functions for expandable Dtext

//Will fix any DText expandable broken by hideText
function fixExpandables() {
    if (!isExpandables()) {
        return;
    }
    let $expandable_buttons = $(".expandable-button");
    if ($expandable_buttons.length) {
        $expandable_buttons.off();
        Danbooru.Dtext.initialize_expandables();
    }
}

//Check if Danbooru is done by checking the display status
function validateExpandableStatus() {
    try {
        if (!isExpandables()) {
            debuglog("There are no Dtext expandables!");
            validateExpandableStatus.isdone = true;
            return;
        }
        validateExpandableStatus.isdone = _.reduce($(".expandable-content"),(result,value)=>{return result && (value.style.display === "none"); },true);
        if (validateExpandableStatus.isdone) {
            debuglog("DText expandables are done!");
        } else {
            if (validateExpandableStatus.checked === 0) {
                debuglog("Dtext expandables are not done!");
            }
            setTimeout(validateExpandableStatus,500);
            validateExpandableStatus.checked++;
        }
    } catch (e) {
        errorlog(e);
        throw e;
    }
}
validateExpandableStatus.isdone = false;
validateExpandableStatus.checked = 0;

//Logic function to reduce calls to DOM
function isExpandables() {
    if (isExpandables.firsttime) {
        isExpandables.value = (($(".prose:not(.dtext-preview)").length!==0)&&($(".expandable-content").length!==0));
        isExpandables.firsttime = false;
    }
    return isExpandables.value;
}
isExpandables.firsttime = true;

//////////////////////
//Utility functions

//Compare two objects to detect changes to the first
function recurseCompareSettings(object1,object2) {
    $.each(object1, function(key,val) {
        if (_.isEqual(object1[key],object2[key])) {
            delete object1[key];
        } else if (typeof object1[key]==="object") {
            recurseCompareSettings(object1[key],object2[key]);
        }
    });
}

function validateData(object,key,type,defaultval) {
    if (typeof(object[key])!==type) {
        debuglog(`Invalid Key: ${key}`);
        object[key] = defaultval;
        return false;
    }
    return true;
}

function tagRegExp(str) {
    return RegExp('\\b'+str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1").replace(/_/g,'[_ ]')+'\\b','gi');
}

function sanitizeForHTML(str) {
    return str.replace(/&/g,'&amp;').replace(/>/g,'&gt;').replace(/</g,'&lt;').replace(/\n/g,'<br>').replace(/"/g,'&quot;');
}

function getActualTime(str) {
    debuglog(str,performance.now()-getActualTime.starttime);
}
getActualTime.starttime = performance.now();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function debuglog(args) {
    if (debug_console) {
        console.log.apply(this,arguments);
    }
}

function errorlog(error) {
    console.trace(error);
    let errortext = sanitizeForHTML(error.stack);
    $("footer").append(`<div class="safelist-error">Safelist error: ${errortext}</div>`);
    alert("Safelist error ocurred... check page bottom for details!");
}

//////////////////////
//Main entry points

async function libraryWait() {
    try {
        console.log("Checking Danbooru");
        while (typeof(window.Danbooru)==="undefined") {
            if (libraryWait.checked > max_danbooru_retries) {return;}
            console.log("Waiting on Danbooru...");
            let temp = await sleep(50);
            libraryWait.checked++;
        }
        console.log("Checking Danbooru.Blacklist");
        while (typeof(window.Danbooru.Blacklist)==="undefined") {
            if (libraryWait.checked > max_danbooru_retries) {return;}
            console.log("Waiting on Danbooru Blacklist...");
            let temp = await sleep(50);
            libraryWait.checked++;
        }
        initializeSafelist();
    } catch (e) {
        errorlog(e);
        throw e;
    }
}
libraryWait.checked = 0;

libraryWait();

})();
