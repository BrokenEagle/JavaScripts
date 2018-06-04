// ==UserScript==
// @name         ValidateTagInput
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      23
// @source       https://danbooru.donmai.us/users/23799
// @description  Validates tag add/remove inputs on a post edit or upload.
// @author       BrokenEagle
// @match        *://*.donmai.us/posts*
// @match        *://*.donmai.us/uploads*
// @match        *://*.donmai.us/users/*/edit
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/validatetaginput.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.5.2/localforage.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.12.0/validate.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180515/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180515/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180515/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180515/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180515/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180515/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20180515/lib/danbooru.js
// ==/UserScript==

//Global variables

//Variables for debug.js
JSPLib.debug.debug_console = true;

//Variables for load.js
const program_load_required_variables = ['window.jQuery','window.Danbooru'];

//Holds the state of the tags in the textbox at page load
var preedittags;

//JSPLib.utility.sleep time to wait for async requests
const sleep_wait_time = 1000;

//Wait time for quick edit box
// 1. Let box close before reenabling the submit button
// 2. Let box open before querying the implications
const quickedit_wait_time = 1000;

//Polling interval for checking program status
const timer_poll_interval = 100;

//Expiration time is one month
const milliseconds_per_day = 1000 * 60 * 60 * 24;
const validatetag_expiration_days = 30;
const validatetag_expiration_time = milliseconds_per_day * validatetag_expiration_days;

//Validate constants

const relation_constraints = {
    entry: {
        expires : JSPLib.validate.expires_constraints,
        value: {
            presence: true,
            array: true
        }
    },
    value: JSPLib.validate.stringonly_constraints
};

//HTML constants

const submit_button = `
<input id="validate-tags" type="button" class="ui-button ui-widget ui-corner-all" value="Submit">`;

const input_validator = `
<div id="validation-input" style="display:none">
<label for="skip-validate-tags">Skip Validation</label>
<input type="checkbox" id="skip-validate-tags">
</div>`;

const reset_storage = `
<div class="input">
    <label>Site data</label>
    <p><a href="#" id="reset-storage-link">Reset cached data</a></p>
</div>`;

const warning_messages = `
<div id="warning-no-rating" class="error-messages ui-state-error ui-corner-all" style="display:none"><strong>Error</strong>: Must specify a rating</div>
<div id="warning-new-tags" class="error-messages ui-state-error ui-corner-all" style="display:none"></div>
<div id="warning-bad-removes" class="error-messages ui-state-highlight ui-corner-all" style="display:none"></div>`;

/**FUNCTIONS**/

//Helper functions

function getTagList() {
    return stripQuoteSourceMetatag($("#upload_tag_string,#post_tag_string").val()).split(/[\s\n]+/).map(tag=>{return tag.toLowerCase();});
}

function stripQuoteSourceMetatag(str) {
    return str.replace(/source:"[^"]+"\s?/g,'');
}

function filterMetatags(array) {
    return array.filter(value=>{return !value.match(/(?:rating|-?parent|source|-?locked|-?pool|newpool|-?fav|child|-?favgroup|upvote|downvote):/i);});
}

//Typetags are ignored for tag adds, and do nothing for tag removes
function filterTypetags(array) {
    return array.filter(value=>{return !value.match(/(?:general|gen|artist|art|copyright|copy|co|character|char|ch|meta):/i);});
}

function filterNegativetags(array) {
    return array.filter(value=>{return value[0]!='-';});
}

function getNegativetags(array) {
    return filterTypetags(array.filter(value=>{return value[0]=='-';}).map(value=>{return value.substring(1);}));
}

function transformTypetags(array) {
    return array.map(value=>{return value.match(/(?:general:|gen:|artist:|art:|copyright:|copy:|co:|character:|char:|ch:|meta:)?(.*)/i)[1];});
}

function getCurrentTags() {
    return filterMetatags(JSPLib.utility.filterEmpty(getTagList()));
}

//Validate functions

function ValidateRelationEntry(key,entry) {
    if (entry === null) {
        JSPLib.debug.debuglog(key,"entry not found!");
        return false;
    }
    let check = validate(entry,relation_constraints.entry);
    if (check !== undefined) {
        JSPLib.validate.printValidateError(key,check);
        return false
    }
    for (let i = 0;i < entry.value.length; i++) {
        check = validate(entry.value[i],relation_constraints.value);
        if (check !== undefined) {
            JSPLib.validate.printValidateError(key,check);
            return false
        }
    }
    return true;
}

function deleteKeyEntries(store,regex) {
    $.each(JSPLib.utility.filterRegex(Object.keys(store),regex),(i,key)=>{
        store.removeItem(key);
    });
}

//Network functions

//Queries aliases of added tags... can be called multiple times
async function queryTagAliases(taglist) {
    JSPLib.debug.debugTime("queryTagAliases");
    queryTagAliases.isdone = false;
    queryTagAliases.async_requests = 0;
    let consequent = "";
    for (let i = 0;i < taglist.length;i++) {
        if ($.inArray(taglist[i],queryTagAliases.seenlist) >= 0) {
            continue;
        }
        let entryname = 'ta-'+taglist[i];
        JSPLib.storage.checkLocalDB(entryname,ValidateRelationEntry).then((data)=>{
            if (!storeditem) {
                JSPLib.debug.debuglog("Querying alias:",taglist[i]);
                queryTagAliases.async_requests++;
                JSPLib.danbooru.submitRequest('tag_aliases',{search:{antecedent_name:taglist[i],status:'active'}},[],entryname).then((data)=>{
                    if (data.length) {
                        //Alias antecedents are unique, so no need to check the size
                        JSPLib.debug.debuglog("Alias:",taglist[i],data[0].consequent_name);
                        queryTagAliases.aliastags.push(taglist[i]);
                        consequent = [data[0].consequent_name];
                    } else {
                        consequent = [];
                    }
                    JSPLib.storage.saveData(entryname,{'value':consequent,'expires':Date.now() + validatetag_expiration_time});
                    queryTagAliases.async_requests--;
                });
            } else {
                consequent = storeditem.value;
                if (consequent.length) {
                    JSPLib.debug.debuglog("Alias:",taglist[i],consequent[0]);
                    queryTagAliases.aliastags.push(taglist[i]);
                }
                queryTagAliases.async_requests--
            }
        });
    }
    queryTagAliasesCallback.timer = setInterval(queryTagAliasesCallback,timer_poll_interval);
}
queryTagAliases.aliastags = [];
queryTagAliases.seenlist = [];
queryTagAliases.isdone = true;

//Queries implications of preexisting tags... called once per image
async function queryTagImplications(taglist) {
    JSPLib.debug.debugTime("queryTagImplications");
    queryTagImplications.isdone = false;
    queryTagImplications.async_requests = 0;
    for (let i = 0;i < taglist.length;i++) {
        let entryname = 'ti-'+taglist[i];
        queryTagImplications.async_requests++;
        JSPLib.storage.checkLocalDB(entryname,ValidateRelationEntry).then((storeditem)=>{
            if (!storeditem) {
                JSPLib.debug.debuglog("Querying implication:",taglist[i]);
                JSPLib.danbooru.submitRequest('tag_implications',{limit:100,search:{consequent_name:taglist[i],status:'active'}},[],entryname).then((data)=>{
                    let implications = data.map(entry=>{return entry.antecedent_name;});
                    queryTagImplications.implicationdict[taglist[i]] = implications;
                    JSPLib.storage.saveData(entryname,{'value':implications,'expires':Date.now() + validatetag_expiration_time});
                    queryTagImplications.async_requests--;
                });
            } else {
                queryTagImplications.implicationdict[taglist[i]] = storeditem.value;
                queryTagImplications.async_requests--;
            }
        });
    }
    queryTagImplicationsCallback.timer = setInterval(queryTagImplicationsCallback,timer_poll_interval);
}
queryTagImplications.implicationdict = {};
queryTagImplications.isdone = true;

function getAllRelations(tag,implicationdict) {
    var tmp = [];
    if (tag in implicationdict) {
        for(let i=0;i<implicationdict[tag].length;i++) {
            tmp.push(implicationdict[tag][i]);
            let tmp2 = getAllRelations(implicationdict[tag][i],implicationdict);
            tmp = tmp.concat(tmp2);
        }
        return tmp;
    } else {
        return [];
    }
}

//Main execution functions

async function validateTagAdds() {
    JSPLib.debug.debugTime("validateTagAdds");
    validateTagAdds.isready = false;
    validateTagAdds.submitrequest = false;
    let postedittags = getCurrentTags();
    validateTagAdds.addedtags = JSPLib.utility.setDifference(JSPLib.utility.setDifference(filterNegativetags(filterTypetags(postedittags)),preedittags),getNegativetags(postedittags));
    JSPLib.debug.debuglog("Added tags:",validateTagAdds.addedtags);
    if ((validateTagAdds.addedtags.length === 0) || $("#skip-validate-tags")[0].checked) {
        JSPLib.debug.debuglog("Tag Add Validation - Skipping!",validateTagAdds.addedtags.length === 0,$("#skip-validate-tags")[0].checked);
        $("#warning-new-tags").hide();
        validateTagAdds.isready = true;
        validateTagAdds.submitrequest = true;
        return;
    }
    let data = await JSPLib.danbooru.getAllItems('tags',100,{addons:{search:{name:validateTagAdds.addedtags.join(','),hide_empty:'yes'}}});
    validateTagAdds.checktags = data.map(entry=>{return entry.name;});
    queryTagAliases(validateTagAdds.addedtags);
    validateTagAddsCallback.timer = setInterval(validateTagAddsCallback,timer_poll_interval);
}
validateTagAdds.isready = true;

function validateTagRemoves() {
    validateTagRemoves.submitrequest = false;
    if (!queryTagImplications.isdone || $("#skip-validate-tags")[0].checked) {
        //Validate tag removals are not as critical, so don't hold up any tag editing if it's not done yet
        JSPLib.debug.debuglog("Tag Remove Validation - Skipping!",queryTagImplications.isdone,$("#skip-validate-tags")[0].checked);
        $("#warning-bad-removes").hide();
        validateTagRemoves.submitrequest = true;
        return;
    }
    let postedittags = transformTypetags(getCurrentTags());
    let removedtags = (JSPLib.utility.setDifference(preedittags,postedittags)).concat(JSPLib.utility.setIntersection(getNegativetags(postedittags),postedittags));
    let finaltags = JSPLib.utility.setDifference(postedittags,removedtags);
    JSPLib.debug.debuglog("Final tags:",finaltags);
    JSPLib.debug.debuglog("Removed tags:",removedtags);
    let allrelations = [];
    $.each(removedtags,(i,tag)=>{
        let badremoves = JSPLib.utility.setIntersection(getAllRelations(tag,queryTagImplications.implicationdict),finaltags);
        if (badremoves.length) {
            allrelations.push(badremoves.toString() + ' -> ' + tag);
        }
    });
    if (allrelations.length) {
        JSPLib.debug.debuglog("Tag Remove Validation - Badremove tags!");
        $.each(allrelations,(i,relation)=>{JSPLib.debug.debuglog(i,relation);});
        $("#validation-input").show();
        $("#warning-bad-removes").show();
        let removelist = allrelations.join('<br>');
        $("#warning-bad-removes")[0].innerHTML = '<strong>Notice</strong>: The following implication relations prevent certain tag removes:<br>' + removelist;
    } else {
        JSPLib.debug.debuglog("Tag Remove Validation - Free and clear to submit!");
        $("#warning-bad-removes").hide();
        validateTagRemoves.submitrequest = true;
    }
}

//Click functions

function postModeMenuClick(e) {
    let s = $("#mode-box select").val();
    if (s === "edit") {
        $("#validation-input,#warning-no-rating,#warning-new-tags,#warning-bad-removes").hide();
        let post_id = $(e.target).closest("article").data("id");
        let $post = $("#post_" + post_id);
        preedittags = $post.data("tags").split(' ');
        JSPLib.debug.debuglog("Preedit tags:",preedittags);
        //Wait until the edit box loads before querying implications
        setTimeout(()=>{queryTagImplications(preedittags);},quickedit_wait_time);
    } else if (s === "view") {
        return;
    }
    e.preventDefault();
}

function validateTagsClick(e) {
    //Prevent code from being reentrant until finished processing
    if (validateTagsClick.isready) {
        JSPLib.debug.debugTime("validateTagsClick");
        validateTagsClick.isready = false;
        $("#validate-tags")[0].setAttribute('disabled','true');
        $("#validate-tags")[0].setAttribute('value','Submitting...');
        validateTagAdds();
        validateTagRemoves();
        validateTagsClickCallback.timer = setInterval(validateTagsClickCallback,timer_poll_interval);
    }
}
validateTagsClick.isready = true;

function resetLocalStorageClick(e) {
    if (confirm("Delete Danbooru cached data?\n\nThis includes data for the tag autcomplete and the tag validator.")) {
        if (use_local_storage) {
            deleteKeyEntries(localStorage,/^(Danbooru storage\/(ti|ta)|ac)-/);
        }
        if (use_indexed_db) {
            let temp = danboorustorage.clear(()=>{Danbooru.notice("Site data reset!");});
        }
        deleteKeyEntries(sessionStorage,/^(ti|ta)-/);
    }
    e.preventDefault();
}

//Timer/callback functions

function queryTagAliasesCallback() {
    if (queryTagAliases.async_requests === 0) {
        JSPLib.debug.debugTimeEnd("queryTagAliases");
        clearInterval(queryTagAliasesCallback.timer);
        queryTagAliases.isdone = true;
        JSPLib.debug.debuglog("Check aliases:",queryTagAliases.aliastags);
    }
}

function queryTagImplicationsCallback() {
    if (queryTagImplications.async_requests === 0) {
        JSPLib.debug.debugTimeEnd("queryTagImplications");
        clearInterval(queryTagImplicationsCallback.timer);
        queryTagImplications.isdone = true;
        JSPLib.debug.debuglog("Implications:",queryTagImplications.implicationdict);
    }
}

function validateTagAddsCallback() {
    JSPLib.debug.debuglog("Waiting:",queryTagAliases.isdone);
    if (queryTagAliases.isdone) {
        JSPLib.debug.debugTimeEnd("validateTagAdds");
        clearInterval(validateTagAddsCallback.timer);
        let nonexisttags = JSPLib.utility.setDifference(JSPLib.utility.setDifference(validateTagAdds.addedtags,validateTagAdds.checktags),queryTagAliases.aliastags);
        if (nonexisttags.length > 0) {
            JSPLib.debug.debuglog("Tag Add Validation - Nonexistant tags!");
            $.each(nonexisttags,(i,tag)=>{JSPLib.debug.debuglog(i,tag);});
            $("#validation-input").show();
            $("#warning-new-tags").show();
            let taglist = nonexisttags.join(', ');
            $("#warning-new-tags")[0].innerHTML = '<strong>Warning</strong>: The following new tags will be created:  ' + taglist;
        } else {
            JSPLib.debug.debuglog("Tag Add Validation - Free and clear to submit!");
            $("#warning-new-tags").hide();
            validateTagAdds.submitrequest = true;
        }
        validateTagAdds.isready = true;
    }
}

function validateTagsClickCallback() {
    //Wait on asynchronous functions
    if(validateTagAdds.isready) {
        JSPLib.debug.debugTimeEnd("validateTagsClick");
        clearInterval(validateTagsClickCallback.timer);
        if (validateTagAdds.submitrequest && validateTagRemoves.submitrequest) {
            JSPLib.debug.debuglog("Submit request!");
            $("#form,#quick-edit-form").trigger("submit");
            if ($("#c-uploads #a-new,#c-posts #a-show").length) {
                JSPLib.debug.debuglog("Disabling return key!");
                $("#upload_tag_string,#post_tag_string").off("keydown.danbooru.submit");
            }
            if ($("#c-uploads #a-new").length) {
                //Check for the triggering of Danbooru's client validation (file/source/rating)
                reenableSubmitCallback.timer = setInterval(reenableSubmitCallback,timer_poll_interval);
            } else if ($("#c-posts #a-index").length) {
                //Wait until the edit box closes to reenable the submit button click
                setTimeout(()=>{
                    JSPLib.debug.debuglog("Ready for next edit!");
                    $("#validate-tags")[0].removeAttribute('disabled');
                    $("#validate-tags")[0].setAttribute('value','Submit');
                    validateTagsClick.isready = true;
                },quickedit_wait_time);
            }
        } else {
            JSPLib.debug.debuglog("Validation failed!");
            $("#validate-tags")[0].removeAttribute('disabled');
            $("#validate-tags")[0].setAttribute('value','Submit');
            validateTagsClick.isready = true;
        }
    }
}

function reenableSubmitCallback() {
    if ($("#client-errors").css("display") !== "none") {
        clearInterval(reenableSubmitCallback.timer);
        JSPLib.debug.debuglog("Danbooru's client validation failed!");
        $("#validate-tags")[0].removeAttribute('disabled');
        $("#validate-tags")[0].setAttribute('value','Submit');
        $("#upload_tag_string").on("keydown.danbooru.submit", null, "return", e=>{
            $("#validate-tags").click();
            e.preventDefault();
        });
        validateTagsClick.isready = true;
    }
}

function rebindHotkey() {
    let boundevents = $.map($._data($("#upload_tag_string,#post_tag_string")[0], "events").keydown,(entry)=>{return entry.namespace;});
    JSPLib.debug.debuglog("Bound events:",boundevents);
    if ($.inArray('danbooru.submit',boundevents) >= 0) {
        clearInterval(rebindHotkey.timer);
        $("#upload_tag_string,#post_tag_string").off("keydown.danbooru.submit").on("keydown.danbooru.submit", null, "return", e=>{
            $("#validate-tags").click();
            e.preventDefault();
        });
    }
}

//Main

function main() {
    JSPLib.debug.debuglog("========STARTING MAIN========");
    if ($("#c-users #a-edit").length) {
        $("#basic-settings-section > .user_time_zone").before(reset_storage);
        $("#reset-storage-link").click(resetLocalStorageClick);
        return;
    }
    //pruneCache();
    if ($("#c-uploads #a-new").length) {
        //Upload tags will always start out blank
        preedittags = [];
    } else if ($("#c-posts #a-show").length) {
        preedittags = JSPLib.utility.filterEmpty(getTagList());
        queryTagImplications(preedittags);
    } else if ($("#c-posts #a-index #mode-box").length){
        $(".post-preview a").click(postModeMenuClick);
    } else {
        JSPLib.debug.debuglog("Nothing found!");
        return;
    }
    JSPLib.debug.debuglog("Preedit tags:",preedittags);
    $("#form [type=submit],#quick-edit-form [type=submit][value=Submit]").after(submit_button);
    $("#form [type=submit],#quick-edit-form [type=submit][value=Submit]").hide();
    if ($("#c-posts #a-index").length) {
        $("#quick-edit-form [type=submit][value=Cancel]").after(input_validator);
        $("#quick-edit-form").after(warning_messages);
    } else{
        $("#validate-tags").after(input_validator);
        $("#related-tags-container").before(warning_messages);
    }
    $("#validate-tags").click(validateTagsClick);
    rebindHotkey.timer = setInterval(rebindHotkey,timer_poll_interval);
    if (JSPLib.debug.debug_console) {
        window.addEventListener('beforeunload',function () {
            JSPLib.statistics.outputAdjustedMean("ValidateTagInput");
        });
    }
}

//Execution start

JSPLib.load.programInitialize(main,'VTI',program_load_required_variables);
