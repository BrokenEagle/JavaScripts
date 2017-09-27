// ==UserScript==
// @name         ValidateTagInput
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      8
// @source       https://danbooru.donmai.us/users/23799
// @description  Validates tag inputs on a post edit, both adds and removes.
// @author       BrokenEagle
// @match        *://*.donmai.us/posts/*
// @match        *://*.donmai.us/uploads*
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/validatetaginput.user.js
// ==/UserScript==

//Global variables

var preedittags;

const sleep_wait_time = 1000;

const submitvalidator = `
<input id="validate-tags" type="button" class="ui-button ui-widget ui-corner-all" value="Submit">
<div id="validation-input">
<label for="skip-validate-tags">Skip Validation</label>
<input type="checkbox" id="skip-validate-tags">
</div>`;

const warningMessages = `
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

function hasDataExpired(entryname) {
    if (localStorage[entryname] === undefined) {
        return true;
    }
    if ((Date.now() - JSON.parse(localStorage[entryname]).expires) > 0) {
        return true;
    }
    return false;
}

//Queries aliases of added tags... can be called multiple times
async function queryTagAliases(taglist) {
    queryTagAliases.isdone = false;
    let async_requests = 0;
    let consequent = "";
    for (let i = 0;i < taglist.length;i++) {
        if (taglist[i] in queryTagAliases.seenlist) {
            continue;
        }
        let entryname = 'ta-'+taglist[i];
        if (hasDataExpired(entryname)) {
            if (async_requests > 25) {
                console.log("Sleeping...");
                let temp = await sleep(sleep_wait_time);
            }
            console.log("Querying alias:",taglist[i]);
            async_requests++;
            resp = $.getJSON('/tag_aliases',{'search':{'antecedent_name':taglist[i],'status':'active'}},data=>{
                if (data.length) {
                    //Alias antecedents are unique, so no need to check the size
                    console.log("Alias:",taglist[i],data[0].consequent_name);
                    queryTagAliases.aliastags.push(taglist[i]);
                    consequent = data[0].consequent_name;
                } else {
                    consequent = "";
                }
                localStorage[entryname] = JSON.stringify({'aliases':consequent,'expires':Date.now()+(60*60*24*30*1000)});
                queryTagAliases.seenlist.push(taglist[i]);
            }).always(()=>{
                async_requests--;
            });
        } else {
            console.log("Found alias:",taglist[i]);
            consequent = JSON.parse(localStorage[entryname]).aliases;
            if (consequent.length) {
                console.log("Alias:",taglist[i],consequent);
                queryTagAliases.aliastags.push(taglist[i]);
            }
        }
    }
    let aliastimer = setInterval(()=>{
        if (async_requests === 0) {
            clearInterval(aliastimer);
            queryTagAliases.isdone = true;
            console.log("Check aliases:",queryTagAliases.aliastags);
        }
    },500);
}
queryTagAliases.aliastags = [];
queryTagAliases.seenlist = [];

//Queries implications of preexisting tags... called only once
async function queryTagImplications(taglist) {
    queryTagImplications.isdone = false;
    let async_requests = 0;
    for (let i = 0;i < taglist.length;i++) {
        let entryname = 'ti-'+taglist[i];
        if (hasDataExpired(entryname)) {
            if (async_requests > 25) {
                console.log("Sleeping...");
                let temp = await sleep(sleep_wait_time);
            }
            console.log("Querying implication:",taglist[i]);
            async_requests++;
            resp = $.getJSON('/tag_implications',{'limit':100,'search':{'consequent_name':taglist[i],'status':'active'}},data=>{
                let implications = data.map(entry=>{return entry.antecedent_name;});
                queryTagImplications.implicationdict[taglist[i]] = implications;
                localStorage[entryname] = JSON.stringify({'implications':implications,'expires':Date.now()+(60*60*24*30*1000)});
            }).always(()=>{
                async_requests--;
            });
        } else {
            console.log("Found implication:",taglist[i]);
            queryTagImplications.implicationdict[taglist[i]] = JSON.parse(localStorage[entryname]).implications;
        }
    }
    let implicationtimer = setInterval(()=>{
        if (async_requests === 0) {
            clearInterval(implicationtimer);
            queryTagImplications.isdone = true;
            console.log("Implications:",queryTagImplications.implicationdict);
        }
    },500);
}
queryTagImplications.implicationdict = {};

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
    let addedtags = setDifference(filterNegativetags(filterTypetags(getCurrentTags())),preedittags);
    if ((addedtags.length === 0) || $("#skip-validate-tags")[0].checked) {
        console.log("Tag Add Validation - Skipping!",addedtags.length === 0,$("#skip-validate-tags")[0].checked);
        $("#warning-new-tags").hide();
        validateTagAdds.isready = true;
        validateTagAdds.submitrequest = true;
        return;
    }
    let checktags = [];
    let async_requests = 0;
    for (let i = 0;i < addedtags.length;i+=100) {
        async_requests++;
        resp = $.getJSON('/tags',{'limit':100,'search':{'name':addedtags.slice(i,i+100).join(','),'hide_empty':'yes'}},data=>{
            checktags = checktags.concat(data.map(entry=>{return entry.name;}));
        }).always(()=>{
            async_requests--;
        });
    }
    queryTagAliases(addedtags);
    let validatetimer = setInterval(()=>{
        console.log("Waiting:",async_requests,queryTagAliases.isdone);
        if (async_requests===0 && queryTagAliases.isdone) {
            clearInterval(validatetimer);
            nonexisttags = setDifference(setDifference(addedtags,checktags),queryTagAliases.aliastags);
            if (nonexisttags.length > 0) {
                console.log("Nonexistant tags:");
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
    },500);
}
validateTagAdds.isready = true;

function validateTagRemoves() {
    validateTagRemoves.submitrequest = false;
    if (!queryTagImplications.isdone || $("#skip-validate-tags")[0].checked) {
        //Validate tag removals are not as critical, so don't hold up any tag editing if it's not done yet
        $("#warning-bad-removes").hide();
        validateTagRemoves.submitrequest = true;
        return;
    }
    let postedittags = transformTypetags(getCurrentTags());
    let removedtags = (setDifference(preedittags,postedittags)).concat(setIntersection(getNegativetags(postedittags),postedittags));
    console.log("Removed tags:",removedtags);
    let allrelations = [];
    $.each(removedtags,(i,tag)=>{
        let badremoves = setIntersection(getAllRelations(tag,queryTagImplications.implicationdict),postedittags);
        if (badremoves.length) {
            allrelations.push(badremoves.toString() + ' -> ' + tag);
        }
    });
    if (allrelations.length) {
        console.log("Badremove tags:");
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

//Main

function main() {
    if (window.location.pathname === '/uploads') {
        //Upload error occurred from /uploads/new... reload prior preedittags
        preedittags = JSON.parse(localStorage.preedittags);
    } else {
        preedittags = filterNull(getTagList());
        localStorage.preedittags = JSON.stringify(preedittags);
    }
    $("#form [name=commit]").after(submitvalidator);
    $("#related-tags-container").before(warningMessages);
    $("#form [name=commit]").hide();
    $("#validation-input").hide();
    queryTagImplications(preedittags);
    $("#validate-tags").click(e=>{
        if (validateTagAdds.isready) {
            $("#validate-tags")[0].setAttribute('disabled','true');
            $("#validate-tags")[0].setAttribute('value','Submitting...');
            validateTagAdds();
            validateTagRemoves();
            let clicktimer = setInterval(()=>{
                if(validateTagAdds.isready) {
                    clearInterval(clicktimer);
                    if (validateTagAdds.submitrequest && validateTagRemoves.submitrequest) {
                        console.log("Submit request!");
                        $("#form").trigger("submit");
                        $("#quick-edit-form").trigger("submit");
                        $("#upload_tag_string,#post_tag_string").off(".submit");
                    } else {
                        console.log("Validation failed!");
                        $("#validate-tags")[0].removeAttribute('disabled');
                        $("#validate-tags")[0].setAttribute('value','Submit');
                    }
                }
            },100);
        }
    });
    $("#upload_tag_string,#post_tag_string").off("keydown.danbooru.submit").on("keydown.danbooru.submit", null, "return", e=>{
        $("#validate-tags").click();
        e.preventDefault();
    });
}

//Execution start

if ($("#c-uploads #a-new,#c-posts #a-show").length) {
    main();
}
