/****DEPENDENCIES****/

/**External dependencies**/
// jQuery
// GM.xmlHttpRequest (optional)

/**Internal dependencies**/
// JSPLib.utility

/****SETUP****/

//Linter configuration
/* global JSPLib */

JSPLib.network = {};

/****GLOBAL VARIABLES****/

JSPLib.network.rate_limit_wait = 500; // half second
JSPLib.network.counter_domname = null;
JSPLib.network.error_domname = null;
JSPLib.network.error_messages = [];
JSPLib.network.num_network_requests = 0;
JSPLib.network.max_network_requests = 25;

/****FUNCTIONS****/

//jQuery Setup

// https://gist.github.com/monperrus/999065
// This is a shim that adapts jQuery's ajax methods to use GM_xmlhttpRequest.
// This allows the use jQuery.getJSON instead of using GM_xmlhttpRequest directly.
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

    this.open = function(...outerargs) {
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
                xhr[handler](xhr);
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
    JSPLib._jQuery.ajaxSetup({
        xhr: function () {return new JSPLib.network.GM_XHR();}
    });
};

//HTML functions

JSPLib.network.getNotify = async function (url,url_addons={},custom_error) {
    try {
        return await JSPLib._jQuery.get(url,url_addons);
    } catch(error) {
        //Swallow exception... will return false value
        error = JSPLib.network.processError(error,"network.getNotify");
        let error_key = `${url}?${JSPLib._jQuery.param(url_addons)}`;
        JSPLib.network.logError(error_key,error);
        JSPLib.network.notifyError(error,custom_error);
        return false;
    }
};

//Image functions

JSPLib.network.getImage = function (image_url) {
    JSPLib.debug.recordTime(image_url, 'Network');
    return GM.xmlHttpRequest({
            method: 'GET',
            url: image_url,
            responseType: 'blob',
    }).then((resp)=>{
        return resp.response;
    }).finally(()=>{
        JSPLib.debug.recordTimeEnd(image_url, 'Network');
    });
};

JSPLib.network.getImageSize = function (image_url) {
    JSPLib.debug.recordTime(image_url, 'Network');
    return GM.xmlHttpRequest({
        method: 'HEAD',
        url: image_url
    }).then((resp)=>{
        let value = -1;
        if (resp.status === 200) {
            let match = resp.responseHeaders.match(/content-length: (\d+)/);
            if (match) {
                value = parseInt(match[1]);
            }
        }
        return value;
    }).finally(()=>{
        JSPLib.debug.recordTimeEnd(image_url, 'Network');
    });
};

//Hook functions

JSPLib.network.installXHRHook = function (funcs) {
    const hookWindow = (typeof(unsafeWindow) === 'undefined' ? window : unsafeWindow);
    const builtinXhrFn = hookWindow.XMLHttpRequest;
    hookWindow.XMLHttpRequest = function(...xs) {
        //Was this called with the new operator?
        let xhr = new.target === undefined
            ? Reflect.apply(builtinXhrFn, this, xs)
            : Reflect.construct(builtinXhrFn, xs, builtinXhrFn);
        //Add data hook to XHR load event
        xhr.addEventListener('load', (event)=>{JSPLib.network._dataCallback(xhr, funcs);});
        return xhr;
    };
};

//Rate functions

JSPLib.network.incrementCounter = function (module) {
    JSPLib[module].num_network_requests += 1;
    JSPLib.network.counter_domname && JSPLib._jQuery(JSPLib.network.counter_domname).html(JSPLib[module].num_network_requests);
};

JSPLib.network.decrementCounter = function (module) {
    JSPLib[module].num_network_requests -= 1;
    JSPLib.network.counter_domname && JSPLib._jQuery(JSPLib.network.counter_domname).html(JSPLib[module].num_network_requests);
};

JSPLib.network.rateLimit = async function (self,module) {
    while (JSPLib[module].num_network_requests >= JSPLib[module].max_network_requests) {
        self.debug('logLevel',"Max simultaneous network requests exceeded! Sleeping...",JSPLib.debug.WARNING);
        await new Promise(resolve => setTimeout(resolve, JSPLib.network.rate_limit_wait)); //Sleep
    }
};

//Error functions

JSPLib.network.processError = function (self,error,funcname) {
    error = (typeof error === "object" && 'status' in error && 'responseText' in error ? error : {status: 999, responseText: "Bad error code!"});
    self.debug('warnLevel',funcname,"error:",error.status,'\r\n',error.responseText,JSPLib.debug.ERROR);
    return error;
};

JSPLib.network.logError = function (key,error) {
    JSPLib.network.error_messages.push([key,error.status,error.responseText]);
    if (JSPLib.network.error_domname) {
        JSPLib._jQuery(JSPLib.network.error_domname).html(JSPLib.network.error_messages.length);
    }
};

JSPLib.network.notifyError = function (error,custom_error="") {
    let message = error.responseText;
    if (message.match(/<\/html>/i)) {
        message = (JSPLib.network._http_error_messages[error.status] ? JSPLib.network._http_error_messages[error.status] + "&nbsp;-&nbsp;" : "") + "&lt;HTML response&gt;";
    } else {
        try {
            let parse_message = JSON.parse(message);
            if (JSPLib.validate.isHash(parse_message)) {
                if ('reason' in parse_message) {
                    message = parse_message.reason;
                } else if ('message' in parse_message) {
                    message = parse_message.message;
                }
            }
        } catch (exception) {
            //Swallow
        }
    }
    JSPLib.notice.error(`<span style="font-size:16px;line-height:24px;font-weight:bold;font-family:sans-serif">HTTP ${error.status}:</span>${message}<br>${custom_error}`);
};

/****PRIVATE DATA****/

//Variables

JSPLib.network._http_error_messages = {
    502: "Bad gateway",
};

//Functions

JSPLib.network._dataCallback = function (xhr,funcs) {
    if (xhr.responseType === '' || xhr.responseType === 'text') {
        let data = xhr.responseText;
        //It varies whether data comes in as a string or JSON
        if (typeof data === 'string' && data.length > 0) {
            //Some requests like POST requests have an empty string for the response
            try {
                data = JSON.parse(data);
            } catch(e) {
                //Swallow
            }
        }
        funcs.forEach((func)=>{
            func(data);
        });
    }
};

/****INITIALIZATION****/

JSPLib.network._configuration = {
    nonenumerable: ['_http_error_messages','_dataCallback','_configuration'],
    nonwritable: ['error_messages','_http_error_messages','_dataCallback','_configuration']
};
JSPLib.initializeModule('network');
JSPLib.debug.addModuleLogs('network',['rateLimit','processError']);
