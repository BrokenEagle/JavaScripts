// ==UserScript==
// @name         IQDB 4chan
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      2
// @source       https://danbooru.donmai.us/users/23799
// @description  Danbooru IQDB checker for 4chan threads.
// @author       BrokenEagle
// @match        *://boards.4chan.org/*/thread/*
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/iqdb4chan.user.js
// @require      https://ajax.googleapis.com/ajax/libs/jquery/1.8/jquery.min.js
// @connect      donmai.us
// ==/UserScript==

// 4chan uses the $ variable so run jQuery in noConflict mode
_$ = jQuery.noConflict();

// https://gist.github.com/monperrus/999065
// This is an shim that adapts jQuery's ajax methods to use GM_xmlhttpRequest. This allows us to use $.getJSON instead of using GM_xmlhttpRequest directly.
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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkThumbs() {
    let $filethumbs = _$(".fileThumb");
    for (let j=0;j<$filethumbs.length;j++) {
        console.log($filethumbs[j].href);
        if (async_requests > 25) {
            console.log("Sleeping for one second...");
            let temp = await sleep(1000);
        }
        async_requests++;
        const resp = _$.getJSON('https://danbooru.donmai.us/iqdb_queries.json',{'url':$filethumbs[j].href},data=>{
            console.log("Data:",data.length);
            if (data.length > 0) {
                let poststring = "";
                for (let i=0;i<data.length;i++) {
                    let postid = data[i].post.id;
                    poststring += `, <a href="http://danbooru.donmai.us/posts/${postid}">post #${postid}</a>`;
                }
                let oldhtml = _$($filethumbs[j]).prev()[0].innerHTML;
                _$($filethumbs[j]).prev()[0].innerHTML = oldhtml + poststring;
            } else {
                $filethumbs[j].childNodes[0].style.border = "10px solid red";
            }
        }).always(()=>{
            console.log("Status:",resp.status,resp.statusText);
            async_requests--;
        });
    }
}

_$.ajaxSetup({
    xhr: function () { return new GM_XHR(); },
});

var async_requests = 0;
var IQDB_done = false;

_$(".boardTitle").after('<a href="#" id="iqdb-check">IQDB Check</a>');

_$("#iqdb-check").off().click(e=>{
    if (!IQDB_done) {
        checkThumbs();
        IQDB_done = true;
    }
    e.preventDefault();
});
