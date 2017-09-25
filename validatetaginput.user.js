// ==UserScript==
// @name         ValidateTagInput
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      5
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

const submitvalidator = `
<input id="validate-tags" type="button" class="ui-button ui-widget ui-corner-all" value="Submit">
<div id="validation-input">
<label for="skip-validate-tags">Skip Validation</label>
<input type="checkbox" id="skip-validate-tags">
</div>`;

const warningMessages = `
<div id="warning-bad-removes" class="error-messages ui-state-error ui-corner-all" style="display:none"></div>
<div id="warning-new-tags" class="error-messages ui-state-error ui-corner-all" style="display:none"></div>`;

//Functions

function getTagList() {
    if ($("c-posts").length) {
        return $("#post_tag_string").val().split(/[\s\n]+/);
    } else {
        return $("#upload_tag_string").val().split(/[\s\n]+/);
    }
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

function hasImplicationExpired(entryname) {
    if (localStorage[entryname] === undefined) {
        return true;
    }
    if ((Date.now - JSON.parse(localStorage[entryname]).expires) > (60*60*24*30)) {
        return true;
    }
    return false;
}

async function queryTagImplications(taglist) {
    let async_requests = 0;
    let checkimplications = {};
    for (let i = 0;i < taglist.length;i++) {
        let entryname = 'ti-'+taglist[i];
        if (hasImplicationExpired(entryname)) {
            if (async_requests > 25) {
                console.log("Sleeping for one second...");
                let temp = await sleep(1000);
            }
            console.log("Querying implication:",taglist[i]);
            async_requests++;
            resp = $.getJSON('/tag_implications',{'limit':100,'search':{'consequent_name':taglist[i],'status':'active'}},data=>{
                localStorage[entryname] = JSON.stringify({'aliases':data.map(entry=>{return entry.antecedent_name;}),'expires':Date.now()});
            }).always(()=>{
                async_requests--;
            });
        } else {
            console.log("Found implication:",taglist[i]);
        }
    }
    let implicationtimer = setInterval(()=>{
        if (async_requests === 0) {
            clearInterval(implicationtimer);
            queryTagImplications.isdone = true;
        }
    },500);
}
queryTagImplications.isdone = false;

function buildImplicationDict(array) {
    var implicationdict = {};
    $.each(array,(i,tag)=>{
        //These entries should have been created if the code gets here
        implicationdict[tag] = JSON.parse(localStorage['ti-'+tag]).aliases;
    });
    return implicationdict;
}

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
            console.log("In callback:",checktags);
        }).always(()=>{
            async_requests--;
        });
    }
    let validatetimer = setInterval(()=>{
        console.log("Async:",async_requests);
        if (async_requests===0) {
            console.log("In interval:",checktags);
            clearInterval(validatetimer);
            nonexisttags = addedtags.filter(value=>{return checktags.indexOf(value) < 0;});
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
    if (!queryTagImplications.isdone) {
        //Validate tag removals are not as critical, so don't hold up any tag editing if it's not done yet
        $("#warning-bad-removes").hide();
        validateTagRemoves.submitrequest = true;
        return;
    }
    let postedittags = transformTypetags(getCurrentTags());
    let removedtags = (setDifference(preedittags,postedittags)).concat(setIntersection(getNegativetags(postedittags),postedittags));
    console.log("Removed tags:",removedtags);
    let implicationdict = buildImplicationDict(preedittags);
    console.log("Implications:",implicationdict);
    let allrelations = [];
    $.each(removedtags,(i,tag)=>{
        let badremoves = setIntersection(getAllRelations(tag,implicationdict),postedittags);
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
        $("#warning-bad-removes")[0].innerHTML = '<strong>Warning</strong>: The following implication relations prevent certain tag removes:<br>' + removelist;
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
                        $("#form [name=commit]").click();
                    } else {
                        console.log("Validation failed!");
                        $("#validate-tags")[0].removeAttribute('disabled');
                        $("#validate-tags")[0].setAttribute('value','Submit');
                    }
                }
            },100);
        }
    });
}

//Execution start

if ($("#c-uploads #a-new").length || $("#c-posts #a-show").length) {
    main();
}
