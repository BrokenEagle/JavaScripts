// ==UserScript==
// @name         ValidateTagInput
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      4
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

function filterTypetags(array) {
    return array.filter(value=>{return !value.match(/(?:general|gen|artist|art|copyright|copy|co|character|char|ch):/i);});
}

function filterNegativetags(array) {
    return array.filter(value=>{return value[0]!='-';});
}

function setDifference(array1,array2) {
    return array1.filter(value=>{return array2.indexOf(value) < 0;});
}

function getCurrentTags() {
    return filterMetatags(filterNull(getTagList()));
}

function validateTagAdds() {
    validateTagAdds.isready = false;
    validateTagAdds.submitrequest = false;
    let addedtags = setDifference(filterNegativetags(filterTypetags(getCurrentTags())),preedittags);
    if ((addedtags.length === 0) || $("#skip-validate-tags")[0].checked) {
        console.log("Skipping validations!",addedtags.length === 0,$("#skip-validate-tags")[0].checked);
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
                let taglist = nonexisttags.join(', ');
                if ($("#warning-new-tags").length) {
                    $("#warning-new-tags")[0].innerHTML = `<strong>Warning</strong>: The following new tags will be created:  {${taglist}}`;
                } else {
                    $("#related-tags-container").before(`<div id="warning-new-tags" class="error-messages ui-state-error ui-corner-all"><strong>Warning</strong>: The following new tags will be created:  {${taglist}}</div>`);
                }
                $("#validate-tags")[0].removeAttribute('disabled');
                $("#validate-tags")[0].setAttribute('value','Submit');
            } else {
                console.log("Free and clear to submit!");
                validateTagAdds.submitrequest = true;
            }
            validateTagAdds.isready = true;
        }
    },500);
}
validateTagAdds.isready = true;

function validateTagRemoves() {
    //WIP
    validateTagRemoves.submitrequest = true;
}
validateTagRemoves.isready = true;

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
    $("#form [name=commit]").hide();
    $("#validation-input").hide();

    $("#validate-tags").click(e=>{
        if (validateTagAdds.isready && validateTagRemoves.isready) {
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
                    }
                }
            },100);
        }
    });
}

if ($("#c-uploads #a-new").length || $("#c-posts #a-show").length) {
    main();
}
