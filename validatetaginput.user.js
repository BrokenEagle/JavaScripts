// ==UserScript==
// @name         ValidateTagInput
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      2
// @source       https://danbooru.donmai.us/users/23799
// @description  Validates tag inputs on a post edit, both adds and removes.
// @author       BrokenEagle
// @match        *://*.donmai.us/posts/*
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/validatetaginput.user.js
// ==/UserScript==

//Constants

const preedittags = $("#post_tag_string").val().split(/[\s\n]+/).filter(value=>{return value !== '';});
const submitvalidator = `
<input id="validate-tags" type="button" class="ui-button ui-widget ui-corner-all" value="Submit">
<div id="validation-input">
<label for="skip-validate-tags">Skip Validation</label>
<input type="checkbox" id="skip-validate-tags">
</div>`;

//Functions

function getCurrentTags() {
    return $("#post_tag_string").val().split(/[\s\n]+/).filter(value=>{return ((value !== '')&&(!value.match(/(?:rating|-?parent|source|-?locked|-?pool|newpool|-?fav|child|-?favgroup|upvote|downvote):/i)));});
}

function validateTagAdds() {
    let postedittags = getCurrentTags();
    let addedtags = postedittags.filter(value=>{return ((preedittags.indexOf(value) < 0)&&(value[0]!='-'));});
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
            if (nonexisttags.length > 0 && !$("#skip-validate-tags")[0].checked) {
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
                $("#form [name=commit]").click();
            }
        }
    },500);
}

function validateTagRemoves() {
    //WIP
}

//Execution start

$("#form [name=commit]").after(submitvalidator);
$("#form [name=commit]").hide();
$("#validation-input").hide();

$("#validate-tags").click(e=>{
    $("#validate-tags")[0].setAttribute('disabled','true');
    $("#validate-tags")[0].setAttribute('value','Submitting...');
    validateTagAdds();
});
