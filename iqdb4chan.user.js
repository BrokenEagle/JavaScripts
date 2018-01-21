// ==UserScript==
// @name         IQDB 4chan
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      5
// @source       https://danbooru.donmai.us/users/23799
// @description  Danbooru IQDB checker for 4chan threads.
// @author       BrokenEagle
// @match        *://boards.4chan.org/*/thread/*
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/iqdb4chan.user.js
// @require      https://ajax.googleapis.com/ajax/libs/jquery/1.8/jquery.min.js
// ==/UserScript==

/****Global variables****/

//Default colors for links
const postlink_css = `
a.very-high-similarity {
    color: green;
}
a.high-similarity {
    color: blue;
}
a.medium-high-similarity {
    color: orange;
}
a.medium-similarity {
    color: red;
}
`

// 4chan uses the $ variable so run jQuery in noConflict mode
_$ = jQuery.noConflict();

/****Functions****/

//Helper functions

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function setCSSStyle(csstext) {
    var css_dom = document.createElement('style');
    css_dom.type = 'text/css';
    css_dom.innerHTML = csstext;
    document.head.appendChild(css_dom);
}

function similarityClass(score) {
    if (score > 95.0) {
        return "very-high-similarity";
    }
    if (score > 90.0) {
        return "high-similarity";
    }
    if (score > 85.0) {
        return "medium-high-similarity";
    }
    return "medium-similarity";
}

//Main functions

async function checkThumbs() {
    let $filethumbs = _$(".fileThumb");
    for (let j=0;j<$filethumbs.length;j++) {
        console.log($filethumbs[j].href);
        if (checkThumbs.async_requests > 25) {
            console.log("Sleeping for one second...");
            let temp = await sleep(1000);
        }
        checkThumbs.async_requests++;
        const resp = _$.getJSON('https://danbooru.donmai.us/iqdb_queries.json',{'url':$filethumbs[j].href},data=>{
            console.log("Data:",data.length);
            if (data.length > 0) {
                let poststring = "";
                for (let i=0;i<data.length;i++) {
                    let postid = data[i].post.id;
                    let scoreclass = similarityClass(data[i].score);
                    poststring += `, <a href="http://danbooru.donmai.us/posts/${postid}" target="_blank" class="danbooru-post ${scoreclass}">post #${postid}</a>`;
                }
                let oldhtml = _$($filethumbs[j]).prev()[0].innerHTML;
                _$($filethumbs[j]).prev()[0].innerHTML = oldhtml + poststring;
            } else {
                $filethumbs[j].childNodes[0].style.border = "10px solid red";
            }
        }).always(()=>{
            console.log("Status:",resp.status,resp.statusText);
            checkThumbs.async_requests--;
        });
    }
}
checkThumbs.async_requests = 0;

function IQDBCheck() {
    if (!IQDBCheck.IQDB_done) {
        setCSSStyle(postlink_css);
        checkThumbs();
        IQDBCheck.IQDB_done = true;
    }
}
IQDBCheck.IQDB_done = false;

//PROGRAM START

//Add IQDB check link
_$(".boardTitle").after('<a href="#" id="iqdb-check">&lt;IQDB Check&gt;</a>');

//Add click function to the IQDB check link
_$("#iqdb-check").off().click(e=>{
    IQDBCheck();
    e.preventDefault();
});
