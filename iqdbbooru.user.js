// ==UserScript==
// @name         IQDB Booru
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      6
// @source       https://danbooru.donmai.us/users/23799
// @description  Danbooru IQDB checker for various Booru sites.
// @author       BrokenEagle
// @match        *://gelbooru.com/index.php?page=post&s=list*
// @match        *://chan.sankakucomplex.com/?*
// @match        *://yande.re/post?*
// @match        *://konachan.com/post?*
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/iqdbbooru.user.js
// @require      https://ajax.googleapis.com/ajax/libs/jquery/1.8/jquery.min.js
// @connect      donmai.us
// ==/UserScript==

//Global variables

//Configuration details per site
var site_config = {
    'gelbooru.com': {
        'thumbQuery': '.preview',
        'outerContainer': '.thumbnail-preview',
        'startHeight': 170,
        'startWidth': 170,
        'thumbContainerDiff':3,
        'postTop':155,
        'linkAnchor': '#searchTags > h4',
        'anchorVector': []
    },
    'chan.sankakucomplex.com': {
        'thumbQuery': '.preview',
        'outerContainer': '.thumb',
        'startHeight': 180,
        'startWidth': 170,
        'thumbContainerDiff':2,
        'thumbBorderDiff':0,
        'postTop':160,
        'linkAnchor': '#tag-sidebar',
        'anchorVector': [[-1,0]]
    },
    'yande.re': {
        'thumbQuery': '.preview',
        'outerContainer': '#post-list-posts li',
        'startHeight': 185,
        'startWidth': 170,
        'thumbContainerDiff':3,
        'thumbBorderDiff':2,
        'postTop':185 ,
        'linkAnchor': '#tag-sidebar',
        'anchorVector': [[-1,0]]
    },
    'konachan.com': {
        'thumbQuery': '.preview',
        'outerContainer': '#post-list-posts li',
        'startHeight': 165,
        'startWidth': 170,
        'thumbContainerDiff':3,
        'thumbBorderDiff':2,
        'postTop':165 ,
        'linkAnchor': '#tag-sidebar',
        'anchorVector': [[-1,0]]
    }
};

// 4chan uses the $ variable so run jQuery in noConflict mode
_$ = jQuery.noConflict();

// https://gist.github.com/monperrus/999065
// This is an shim that adapts jQuery's ajax methods to use GM_xmlhttpRequest.
// This allows us to use $.getJSON instead of using GM_xmlhttpRequest directly.
function GM_XHR() {
    this.type = null;
    this.url = null;
    this.async = null;
    this.username = null;
    this.password = null;
    this.status = null;
    this.readyState = null;
    this.headers = {};

    this.abort = function() {
        this.readyState = 0;
    };

    this.getAllResponseHeaders = function(name) {
      if (this.readyState!=4) return "";
      return this.responseHeaders;
    };

    this.getResponseHeader = function(name) {
      var regexp = new RegExp('^'+name+': (.*)$','im');
      var match = regexp.exec(this.responseHeaders);
      if (match) { return match[1]; }
      return '';
    };

    this.open = function(type, url, async, username, password) {
        this.type = type ? type : null;
        this.url = url ? url : null;
        this.async = async ? async : null;
        this.username = username ? username : null;
        this.password = password ? password : null;
        this.readyState = 1;
    };

    this.setRequestHeader = function(name, value) {
        this.headers[name] = value;
    };

    this.send = function(data) {
        this.data = data;
        var that = this;
        // http://wiki.greasespot.net/GM_xmlhttpRequest
        GM_xmlhttpRequest({
            method: this.type,
            url: this.url,
            headers: this.headers,
            data: this.data,
            responseType: this.responseType,
            onload: function(rsp) {
                // Populate wrapper object with returned data
                // including the Greasemonkey specific "responseHeaders"
                for (var k in rsp) {
                    that[k] = rsp[k];
                }
                // now we call onreadystatechange
                if (that.onload) {
                    that.onload();
                } else {
                    that.onreadystatechange();
                }
            },
            onerror: function(rsp) {
                for (var k in rsp) {
                    that[k] = rsp[k];
                }
                // now we call onreadystatechange
                if (that.onerror) {
                    that.onerror();
                } else {
                    that.onreadystatechange();
                }
            }
        });
    };
}

//Helper functions

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

//Functions for moving through the DOM
function getNthParent(obj,levels) {
    let $element = obj;
    for (let i=0;i<levels;i++) {
        $element = $element.parentElement;
    }
    return $element;
}

function getNthChild(obj,number) {
    return obj.children[number];
}

function getNthSibling(obj,vector) {
    let $element = obj;
    let distance = Math.abs(vector);
    for (let i=0;i<distance;i++) {
        $element = (vector > 0?$element.nextElementSibling:$element.previousElementSibling);
    }
    return $element;
}

function walkDOM(obj,vectors) {
    let $element = obj;
    for (let vector of vectors) {
        if ((vector[0] !== 0) && (vector[1] !== 0)) {
            continue; //invalid vector
        } else if (vector[0] !== 0) {
            $element = getNthSibling($element,vector[0]);
        } else if (vector[1] > 0) {
            $element = getNthParent($element,vector[1]);
        } else if (vector[1] < 0) {
            $element = getNthChild($element,Math.abs(vector[1]));
        }
    }
    return $element;
}

//Main functions

async function checkThumbs() {
    let $filethumbs = _$(site_config[window.location.host].thumbQuery);
    for (let j=0;j<$filethumbs.length;j++) {
        console.log($filethumbs[j].src);
        if (checkThumbs.async_requests > 25) {
            console.log("Sleeping for one second...");
            let temp = await sleep(1000);
        }
        checkThumbs.async_requests++;
        const resp = _$.getJSON('https://danbooru.donmai.us/iqdb_queries.json',{'url':$filethumbs[j].src},data=>{
            console.log("Data:",data.length);
            if (data.length > 0) {
                //Place a list of post(s) underneath the image
                let postlist = [];
                for (let i=0;i<data.length;i++) {
                    let postid = data[i].post.id;
                    postlist.push(`<a href="http://danbooru.donmai.us/posts/${postid}" target="_blank" class="danbooru-post">post #${postid}</a>`);
                }
                if (checkThumbs.maxPosts < data.length) {
                    let newheight = site_config[window.location.host].startHeight + (15 * data.length);
                    _$(site_config[window.location.host].outerContainer).css('height',`${newheight}px`);
                    console.log("New height:",newheight);
                    checkThumbs.maxPosts = data.length;
                }
                let $outercontainer = getNthParent($filethumbs[j],site_config[window.location.host].thumbContainerDiff);
                let poststring = postlist.join('<br>');
                $outercontainer.innerHTML += `<span style="position:absolute;top:${site_config[window.location.host].postTop}px;left:30px;white-space:nowrap">${poststring}</span>`;
                $outercontainer.style.position = 'relative';
            } else {
                //Add a red "border" to the image
                $outercontainer = getNthParent($filethumbs[j],site_config[window.location.host].thumbBorderDiff);
                $outercontainer.style['box-shadow'] = "0px 0px 0px 10px #f00";
            }
        }).always(()=>{
            console.log("Status:",resp.status,resp.statusText);
            checkThumbs.async_requests--;
        });
    }
}
checkThumbs.maxPosts = 0;
checkThumbs.async_requests = 0;

function IQDBCheck() {
    if (!IQDBCheck.IQDB_done) {
        _$(".thumbnail-preview").css('width',`${site_config[window.location.host].startWidth}px`).css('text-align','center');
        checkThumbs();
        IQDBCheck.IQDB_done = true;
    }
}
IQDBCheck.IQDB_done = false;

//Configure ajax so that getJSON can be used
_$.ajaxSetup({
    xhr: function () { return new GM_XHR(); },
});

//PROGRAM START

//Add IQDB check link
walkDOM(_$(site_config[window.location.host].linkAnchor)[0],site_config[window.location.host].anchorVector).innerHTML += '<br><a style="color:hotpink" href="#" id="iqdb-check">&lt;IQDB Check&gt;</a>';

//Add click function to the IQDB check link
_$("#iqdb-check").off().click(e=>{
    IQDBCheck();
    e.preventDefault();
});
