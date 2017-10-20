// ==UserScript==
// @name         ValidateTagInput
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      17
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
// ==/UserScript==

//Global variables

//Holds the state of the tags in the textbox at page load
var preedittags;

//Gets own instance in case forage is used in another script
var danboorustorage = localforage.createInstance({
    name: 'Danbooru storage',
    driver: [localforage.INDEXEDDB,
             localforage.LOCALSTORAGE]
    });

//Set state variables that indicate which database is being used
const use_indexed_db = danboorustorage.supports(danboorustorage.INDEXEDDB);
const use_local_storage = !danboorustorage.supports(danboorustorage.INDEXEDDB) && danboorustorage.supports(danboorustorage.LOCALSTORAGE);

//Set the maximum cache size to 1M chars
const maximum_cache_size = 1000000;

//Sleep time to wait for async requests
const sleep_wait_time = 1000;

//Wait time for quick edit box
// 1. Let box close before reenabling the submit button
// 2. Let box open before querying the implications
const quickedit_wait_time = 1000;

//Polling interval for checking program status
const timer_poll_interval = 100;

//Expiration time is one month
const expiration_time = 1000*60*60*24*30;

const submitButton = `
<input id="validate-tags" type="button" class="ui-button ui-widget ui-corner-all" value="Submit">`;

const inputValidator = `
<div id="validation-input" style="display:none">
<label for="skip-validate-tags">Skip Validation</label>
<input type="checkbox" id="skip-validate-tags">
</div>`;

const resetStorage = `
<div class="input">
    <label>Site data</label>
    <p><a href="#" id="reset-storage-link">Reset cached data</a></p>
</div>`;

const warningMessages = `
<div id="warning-no-rating" class="error-messages ui-state-error ui-corner-all" style="display:none"><strong>Error</strong>: Must specify a rating</div>
<div id="warning-new-tags" class="error-messages ui-state-error ui-corner-all" style="display:none"></div>
<div id="warning-bad-removes" class="error-messages ui-state-highlight ui-corner-all" style="display:none"></div>`;

//Functions

function getTagList() {
    return $("#upload_tag_string,#post_tag_string").val().split(/[\s\n]+/).map(tag=>{return tag.toLowerCase();});
}

function filterNull(array) {
    return array.filter(value=>{return value !== '';});
}

function filterMetatags(array) {
    return array.filter(value=>{return !value.match(/(?:rating|-?parent|source|-?locked|-?pool|newpool|-?fav|child|-?favgroup|upvote|downvote):/i);});
}

//Typetags are ignored for tag adds, and do nothing for tag removes
function filterTypetags(array) {
    return array.filter(value=>{return !value.match(/(?:general|gen|artist|art|copyright|copy|co|character|char|ch):/i);});
}

function filterNegativetags(array) {
    return array.filter(value=>{return value[0]!='-';});
}

function getNegativetags(array) {
    return filterTypetags(array.filter(value=>{return value[0]=='-';}).map(value=>{return value.substring(1);}));
}

function transformTypetags(array) {
    return array.map(value=>{return value.match(/(?:general:|gen:|artist:|art:|copyright:|copy:|co:|character:|char:|ch:)?(.*)/i)[1];});
}

function setDifference(array1,array2) {
    return array1.filter(value=>{return array2.indexOf(value) < 0;});
}

function setIntersection(array1,array2) {
    return array1.filter(value=>{return array2.indexOf(value) >= 0;});
}

function getCurrentTags() {
    return filterMetatags(filterNull(getTagList()));
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function retrieveData(key) {
    if (!(use_indexed_db || use_local_storage)) {
        return null;
    }
    if (key in sessionStorage) {
        console.log("Found item (Session):",key);
        try {
            return JSON.parse(sessionStorage.getItem(key));
        } catch (e) {
            //Swallow exception
        }
    }
    let value = await danboorustorage.getItem(key);
    if (value !== null) {
        console.log("Found item (IndexDB):",key);
        sessionStorage[key] = JSON.stringify(value);
    }
    return value;
}

function saveData(key,value) {
    danboorustorage.setItem(key,value);
    sessionStorage.setItem(key,JSON.stringify(value));
}

function hasDataExpired(storeditem) {
    if (storeditem === null) {
        return true;
    }
    if ((Date.now() - storeditem.expires) > 0) {
        return true;
    }
    return false;
}

function checkArrayData(array,type) {
    return array.reduce((total,value)=>{return total && (typeof value === type);},true);
}

function checkDataModel(storeditem) {
    if (!('value' in storeditem) || !('expires' in storeditem)) {
        console.log(entryname, "Missing data properties!");
        return false;
    }
    if (typeof(storeditem.expires) !== "number") {
        console.log(entryname, "Expires is not a number!");
        return false;
    }
    if (!($.isArray(storeditem.value) && checkArrayData(storeditem.value,'string'))) {
        console.log(entryname, "Value is not an array of strings!");
        return false;
    }
    return true;
}

function deleteKeyEntries(store,regex) {
    $.each(Object.keys(store).filter(entry=>{return entry.match(regex);}),(i,key)=>{
        store.removeItem(key);
    });
}

function pruneCache() {
    let current_cache_size = 0;
    //Removes local storage used by Versions 16 and prior
    if (use_local_storage) {
         current_cache_size = filterKeyEntries(Object.keys(localStorage)).reduce((total,key)=>{return total+localStorage[key].length;},0);
    }
    if (use_indexed_db || (current_cache_size > maximum_cache_size)) {
        deleteKeyEntries(localStorage,/^(?:ti|ta)-/);
    }
}

//Queries aliases of added tags... can be called multiple times
async function queryTagAliases(taglist) {
    queryTagAliases.isdone = false;
    queryTagAliases.async_requests = 0;
    let consequent = "";
    for (let i = 0;i < taglist.length;i++) {
        if ($.inArray(taglist[i],queryTagAliases.seenlist) >= 0) {
            continue;
        }
        let entryname = 'ta-'+taglist[i];
        let storeditem = await retrieveData(entryname);
        if (hasDataExpired(storeditem) || !checkDataModel(storeditem)) {
            if (queryTagAliases.async_requests > 25) {
                console.log("Sleeping...");
                let temp = await sleep(sleep_wait_time);
            }
            console.log("Querying alias:",taglist[i]);
            queryTagAliases.async_requests++;
            resp = $.getJSON('/tag_aliases',{'search':{'antecedent_name':taglist[i],'status':'active'}},data=>{
                if (data.length) {
                    //Alias antecedents are unique, so no need to check the size
                    console.log("Alias:",taglist[i],data[0].consequent_name);
                    queryTagAliases.aliastags.push(taglist[i]);
                    consequent = [data[0].consequent_name];
                } else {
                    consequent = [];
                }
                if (use_indexed_db || use_local_storage) {
                    saveData(entryname,{'value':consequent,'expires':Date.now()+expiration_time});
                }
                queryTagAliases.seenlist.push(taglist[i]);
            }).always(()=>{
                queryTagAliases.async_requests--;
            });
        } else {
            consequent = storeditem.value;
            if (consequent.length) {
                console.log("Alias:",taglist[i],consequent[0]);
                queryTagAliases.aliastags.push(taglist[i]);
            }
        }
    }
    queryTagAliasesCallback.timer = setInterval(queryTagAliasesCallback,timer_poll_interval);
}
queryTagAliases.aliastags = [];
queryTagAliases.seenlist = [];
queryTagAliases.isdone = true;

//Queries implications of preexisting tags... called once per image
async function queryTagImplications(taglist) {
    queryTagImplications.isdone = false;
    queryTagImplications.async_requests = 0;
    for (let i = 0;i < taglist.length;i++) {
        let entryname = 'ti-'+taglist[i];
        let storeditem = await retrieveData(entryname);
        if (hasDataExpired(storeditem) || !checkDataModel(storeditem)) {
            if (queryTagImplications.async_requests > 25) {
                console.log("Sleeping...");
                let temp = await sleep(sleep_wait_time);
            }
            console.log("Querying implication:",taglist[i]);
            queryTagImplications.async_requests++;
            resp = $.getJSON('/tag_implications',{'limit':100,'search':{'consequent_name':taglist[i],'status':'active'}},data=>{
                let implications = data.map(entry=>{return entry.antecedent_name;});
                queryTagImplications.implicationdict[taglist[i]] = implications;
                if (use_indexed_db || use_local_storage) {
                    saveData(entryname,{'value':implications,'expires':Date.now()+expiration_time});
                }
            }).always(()=>{
                queryTagImplications.async_requests--;
            });
        } else {
            queryTagImplications.implicationdict[taglist[i]] = storeditem.value;
        }
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

function validateTagAdds() {
    validateTagAdds.isready = false;
    validateTagAdds.submitrequest = false;
    let postedittags = getCurrentTags();
    validateTagAdds.addedtags = setDifference(setDifference(filterNegativetags(filterTypetags(postedittags)),preedittags),getNegativetags(postedittags));
    console.log("Added tags:",validateTagAdds.addedtags);
    if ((validateTagAdds.addedtags.length === 0) || $("#skip-validate-tags")[0].checked) {
        console.log("Tag Add Validation - Skipping!",validateTagAdds.addedtags.length === 0,$("#skip-validate-tags")[0].checked);
        $("#warning-new-tags").hide();
        validateTagAdds.isready = true;
        validateTagAdds.submitrequest = true;
        return;
    }
    validateTagAdds.checktags = [];
    validateTagAdds.async_requests = 0;
    for (let i = 0;i < validateTagAdds.addedtags.length;i+=100) {
        validateTagAdds.async_requests++;
        let querystring = validateTagAdds.addedtags.slice(i,i+100).join(',');
        console.log("Tag query string:",i,querystring);
        resp = $.getJSON('/tags',{'limit':100,'search':{'name':validateTagAdds.addedtags.slice(i,i+100).join(','),'hide_empty':'yes'}},data=>{
            let foundtags = data.map(entry=>{return entry.name;});
            console.log("Found tags:",i,foundtags);
            validateTagAdds.checktags = validateTagAdds.checktags.concat(foundtags);
        }).always(()=>{
            validateTagAdds.async_requests--;
        });
    }
    queryTagAliases(validateTagAdds.addedtags);
    validateTagAddsCallback.timer = setInterval(validateTagAddsCallback,timer_poll_interval);
}
validateTagAdds.isready = true;

function validateTagRemoves() {
    validateTagRemoves.submitrequest = false;
    if (!queryTagImplications.isdone || $("#skip-validate-tags")[0].checked) {
        //Validate tag removals are not as critical, so don't hold up any tag editing if it's not done yet
        console.log("Tag Remove Validation - Skipping!",queryTagImplications.isdone,$("#skip-validate-tags")[0].checked);
        $("#warning-bad-removes").hide();
        validateTagRemoves.submitrequest = true;
        return;
    }
    let postedittags = transformTypetags(getCurrentTags());
    let removedtags = (setDifference(preedittags,postedittags)).concat(setIntersection(getNegativetags(postedittags),postedittags));
    let finaltags = setDifference(postedittags,removedtags);
    console.log("Final tags:",finaltags);
    console.log("Removed tags:",removedtags);
    let allrelations = [];
    $.each(removedtags,(i,tag)=>{
        let badremoves = setIntersection(getAllRelations(tag,queryTagImplications.implicationdict),finaltags);
        if (badremoves.length) {
            allrelations.push(badremoves.toString() + ' -> ' + tag);
        }
    });
    if (allrelations.length) {
        console.log("Tag Remove Validation - Badremove tags!");
        $.each(allrelations,(i,relation)=>{console.log(i,relation);});
        $("#validation-input").show();
        $("#warning-bad-removes").show();
        let removelist = allrelations.join('<br>');
        $("#warning-bad-removes")[0].innerHTML = '<strong>Notice</strong>: The following implication relations prevent certain tag removes:<br>' + removelist;
    } else {
        console.log("Tag Remove Validation - Free and clear to submit!");
        $("#warning-bad-removes").hide();
        validateTagRemoves.submitrequest = true;
    }
}

function validateRatingExists() {
    validateRatingExists.submitrequest = false;
    if ($("#skip-validate-tags")[0].checked) {
        //Validate tag removals are not as critical, so don't hold up any tag editing if it's not done yet
        console.log("Rating Exists Validation - Skipping!",$("#skip-validate-tags")[0].checked);
        $("#warning-bad-removes").hide();
        validateRatingExists.submitrequest = true;
    }
    else if ($("#upload_rating_s,#post_rating_s")[0].checked || $("#upload_rating_q,#post_rating_q")[0].checked || $("#upload_rating_e,#post_rating_e")[0].checked) {
        console.log("Rating Exists Validation - Free and clear to submit!");
        $("#warning-no-rating").hide();
        validateRatingExists.submitrequest = true;
    } else {
        $("#validation-input").show();
        $("#warning-no-rating").show();
        console.log("Rating Exists Validation - No rating selected!");
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
        console.log("Preedit tags:",preedittags);
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
        validateTagsClick.isready = false;
        $("#validate-tags")[0].setAttribute('disabled','true');
        $("#validate-tags")[0].setAttribute('value','Submitting...');
        validateTagAdds();
        validateTagRemoves();
        if ($("#c-uploads #a-new").length) {
            validateRatingExists();
        } else {
            validateRatingExists.submitrequest = true;
        }
        validateTagsClickCallback.timer = setInterval(validateTagsClickCallback,timer_poll_interval);
    }
}
validateTagsClick.isready = true;

function resetLocalStorageClick(e) {
    if (confirm("Delete Danbooru cached data?\n\nThis includes data for the tag autcomplete and the tag validator.")) {
        if (use_local_storage) {
            deleteKeyEntries(localStorage,/^(?:ac|ti|ta)-/);
        }
        if (use_indexed_db) {
            let temp = danboorustorage.clear(()=>{Danbooru.notice("Site data reset!");});
        }
        deleteKeyEntries(sessionStorage,/^(?:ac|ti|ta)-/);
    }
    e.preventDefault();
}

//Timer/callback functions

function queryTagAliasesCallback() {
    if (queryTagAliases.async_requests === 0) {
        clearInterval(queryTagAliasesCallback.timer);
        queryTagAliases.isdone = true;
        console.log("Check aliases:",queryTagAliases.aliastags);
    }
}

function queryTagImplicationsCallback() {
    if (queryTagImplications.async_requests === 0) {
        clearInterval(queryTagImplicationsCallback.timer);
        queryTagImplications.isdone = true;
        console.log("Implications:",queryTagImplications.implicationdict);
    }
}

function validateTagAddsCallback() {
    console.log("Waiting:",validateTagAdds.async_requests,queryTagAliases.isdone);
    if (validateTagAdds.async_requests===0 && queryTagAliases.isdone) {
        clearInterval(validateTagAddsCallback.timer);
        nonexisttags = setDifference(setDifference(validateTagAdds.addedtags,validateTagAdds.checktags),queryTagAliases.aliastags);
        if (nonexisttags.length > 0) {
            console.log("Tag Add Validation - Nonexistant tags!");
            $.each(nonexisttags,(i,tag)=>{console.log(i,tag);});
            $("#validation-input").show();
            $("#warning-new-tags").show();
            let taglist = nonexisttags.join(', ');
            $("#warning-new-tags")[0].innerHTML = '<strong>Warning</strong>: The following new tags will be created:  ' + taglist;
        } else {
            console.log("Tag Add Validation - Free and clear to submit!");
            $("#warning-new-tags").hide();
            validateTagAdds.submitrequest = true;
        }
        validateTagAdds.isready = true;
    }
}

function validateTagsClickCallback() {
    //Wait on asynchronous functions
    if(validateTagAdds.isready) {
        clearInterval(validateTagsClickCallback.timer);
        if (validateTagAdds.submitrequest && validateTagRemoves.submitrequest && validateRatingExists.submitrequest) {
            console.log("Submit request!");
            $("#form,#quick-edit-form").trigger("submit");
            if ($("#c-uploads #a-new,#c-posts #a-show").length) {
                console.log("Disabling return key!");
                $("#upload_tag_string,#post_tag_string").off("keydown.danbooru.submit");
            } else {
                //Wait until the edit box closes to reenable the submit button click
                setTimeout(()=>{
                    console.log("Ready for next edit!");
                    $("#validate-tags")[0].removeAttribute('disabled');
                    $("#validate-tags")[0].setAttribute('value','Submit');
                    validateTagsClick.isready = true;
                },quickedit_wait_time);
            }
        } else {
            console.log("Validation failed!");
            $("#validate-tags")[0].removeAttribute('disabled');
            $("#validate-tags")[0].setAttribute('value','Submit');
            validateTagsClick.isready = true;
        }
    }
}

function rebindHotkey() {
    let boundevents = $.map($._data($("#upload_tag_string,#post_tag_string")[0], "events").keydown,(entry)=>{return entry.namespace;});
    console.log("Bound events:",boundevents);
    if ($.inArray('danbooru.submit',boundevents) >= 0) {
        clearInterval(rebindHotkey.timer);
        $("#upload_tag_string,#post_tag_string").off("keydown.danbooru.submit").on("keydown.danbooru.submit", null, "return", e=>{
            $("#validate-tags").click();
            e.preventDefault();
        });
    }
}

function programLoad() {
    if (typeof window.Danbooru === undefined) {
        console.log("Danbooru not installed yet!");
        return;
    }
    if (typeof window.jQuery === undefined) {
        console.log("jQuery not installed yet!");
        return;
    }
    clearInterval(programLoad.timer);
    if ($("#c-uploads #a-new,#c-posts #a-show,#c-posts #a-index").length) {
        main();
    } else if ($("#c-users #a-edit").length) {
        $("#basic-settings-section > .user_time_zone").before(resetStorage);
        $("#reset-storage-link").click(resetLocalStorageClick);
    }
}

//Main

function main() {
    console.log("========STARTING MAIN========");
    pruneCache();
    if ($("#c-uploads #a-new").length) {
        //Upload tags will always start out blank
        preedittags = [];
    } else if ($("#c-posts #a-show").length) {
        preedittags = filterNull(getTagList());
        queryTagImplications(preedittags);
    } else if ($("#c-posts #a-index").length){
        $(".post-preview a").click(postModeMenuClick);
    } else {
        console.log("Nothing found!");
        return;
    }
    console.log("Preedit tags:",preedittags);
    $("#form [type=submit],#quick-edit-form [type=submit][value=Submit]").after(submitButton);
    $("#form [type=submit],#quick-edit-form [type=submit][value=Submit]").hide();
    if ($("#c-posts #a-index").length) {
        $("#quick-edit-form [type=submit][value=Cancel]").after(inputValidator);
        $("#quick-edit-form").after(warningMessages);
    } else{
        $("#validate-tags").after(inputValidator);
        $("#related-tags-container").before(warningMessages);
    }
    $("#validate-tags").click(validateTagsClick);
    rebindHotkey.timer = setInterval(rebindHotkey,timer_poll_interval);
}

//Execution start

programLoad.timer = setInterval(programLoad,timer_poll_interval);
