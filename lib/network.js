/****DEPENDENCIES****/

/**External dependencies**/
// jQuery

/****SETUP****/

var JSPLib = JSPLib || {};
JSPLib.network = JSPLib.network || {};

//Has debug.js been loaded?
JSPLib.debug = JSPLib.debug || {};
JSPLib.debug.recordTime = JSPLib.debug.recordTime || (()=>{});
JSPLib.debug.recordTimeEnd = JSPLib.debug.recordTimeEnd || (()=>{});

/****FUNCTIONS****/

//jQuery Setup

// https://gist.github.com/monperrus/999065
// This is a shim that adapts jQuery's ajax methods to use GM_xmlhttpRequest.
// This allows the use $.getJSON instead of using GM_xmlhttpRequest directly.
//
// This is necessary because some sites have a Content Security Policy (CSP) which
// blocks cross-origin requests to Danbooru that require authentication.
// Tampermonkey can bypass the CSP, but only if GM_xmlhttpRequest is used.
JSPLib.network.GM_XHR = function () {
    const open_params = ['type','url','async','username','password'];
    Object.assign(this,{headers: {}},...open_params.concat(['status','readyState']).map(function (key) {return {[key]: null};}));

    this.abort = function() {
        this.readyState = 0;
    };

    this.getAllResponseHeaders = function(name) {
        return (this.readyState != 4 ? "" : this.responseHeaders);
    };

    this.getResponseHeader = function(name) {
        var regexp = new RegExp('^'+name+': (.*)$','im');
        var match = regexp.exec(this.responseHeaders);
        return (match ? match[1] : '');
    };

    this.open = function(type, url, async, username, password) {
        let outerargs = arguments;
        let xhr = this;
        open_params.forEach(function (arg,i) {
            xhr[arg] = outerargs[i] || null;
        });
        this.readyState = 1;
    };

    this.setRequestHeader = function(name, value) {
        this.headers[name] = value;
    };

    this.onresponse = function (handler) {
        let xhr = this;
        return function (resp) {
            ['readyState','responseHeaders','responseText','status','statusText'].forEach(function (key) {
                xhr[key] = resp[key];
            });
            if (xhr[handler]) {
                xhr[handler].call(xhr);
            } else {
                xhr.onreadystatechange();
            }
        };
    };

    this.send = function(data) {
        this.data = data;
        GM.xmlHttpRequest({
            method: this.type,
            url: this.url,
            headers: this.headers,
            data: this.data,
            responseType: this.responseType,
            onload: this.onresponse("onload"),
            onerror: this.onresponse("onerror"),
        });
    };
};

JSPLib.network.jQuerySetup = function () {
    $.ajaxSetup({
        xhr: function () {return new JSPLib.network.GM_XHR();}
    });
};

//Image functions

JSPLib.network.getImage = function (image_url) {
    JSPLib.debug.recordTime(image_url,'Network');
    return new Promise((resolve,reject)=>{
        GM.xmlHttpRequest({
            method: "GET",
            url: image_url,
            responseType: 'blob',
            onload: function(resp) {
                JSPLib.debug.recordTimeEnd(image_url,'Network');
                resolve(resp.response);
            },
            onerror: function(resp) {
                JSPLib.debug.recordTimeEnd(image_url,'Network');
                reject(resp);
            }
        });
    });
};

JSPLib.network.getImageSize = function (image_url) {
    JSPLib.debug.recordTime(image_url,'Network');
    return new Promise((resolve,reject)=>{
        GM.xmlHttpRequest({
            method: "HEAD",
            url: image_url,
            onload: function(resp) {
                JSPLib.debug.recordTimeEnd(image_url,'Network');
                let size = -1;
                let match = resp.responseHeaders.match(/content-length: (\d+)/);
                if (match) {
                    size = parseInt(match[1]);
                }
                resolve(size);
            },
            onerror: function(resp) {
                JSPLib.debug.recordTimeEnd(image_url,'Network');
                reject(resp);
            }
        });
    });
};
