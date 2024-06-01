/****DEPENDENCIES****/

/**External dependencies**/
// jQuery
// GM.xmlHttpRequest (optional)

/**Internal dependencies**/
// JSPLib.utility

/****SETUP****/

//Linter configuration
// eslint-disable-next-line no-redeclare
/* global JSPLib GM */

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
    const open_params = ['type', 'url', 'async', 'username', 'password'];
    Object.assign(this, {headers: {}}, ...open_params.concat(['status', 'readyState']).map((key) => ({[key]: null})));

    this.abort = function() {
        this.readyState = 0;
    };

    this.getAllResponseHeaders = function() {
        return (this.readyState !== 4 ? "" : this.responseHeaders);
    };

    this.getResponseHeader = function(name) {
        var regexp = new RegExp('^' + name + ': (.*)$', 'im');
        var match = regexp.exec(this.responseHeaders);
        return (match ? match[1] : '');
    };

    this.open = function(...outerargs) {
        let context = this;
        open_params.forEach((arg, i) => {
            context[arg] = outerargs[i] || null;
        });
        this.readyState = 1;
    };

    this.setRequestHeader = function(name, value) {
        this.headers[name] = value;
    };

    this.onresponse = function (handler) {
        let context = this;
        return function (resp) {
            ['readyState', 'responseHeaders', 'responseText', 'response', 'status', 'statusText'].forEach((key) => {
                context[key] = resp[key];
            });
            if (context[handler]) {
                context[handler](context);
            } else if (context.onreadystatechange) {
                context.onreadystatechange();
            }
        };
    };

    this.send = function(data) {
        const gm_params = ['url', 'headers', 'data', 'responseType', 'cookie', 'binary', 'nocache', 'revalidate', 'timeout', 'context', 'overrideMimeType', 'anonymous', 'fetch', 'password'];
        this.data = !this.anonymous || data ? data : undefined;
        let standard_params = {
            method: this.type,
            //jQuery uses username, Tampermonkey uses user
            user: this.username,
            onload: this.onresponse("onload"),
            onerror: this.onresponse("onerror"),
        };
        let send_data = Object.assign(standard_params, ...gm_params.map((key) => (this[key] !== undefined ? {[key]: this[key]} : {})));
        return GM.xmlHttpRequest(send_data);
    };
};

JSPLib.network.jQuerySetup = function () {
    JSPLib._jQuery.ajaxSetup({
        xhr () {return new JSPLib.network.GM_XHR();}
    });
};

//HTML functions

JSPLib.network.getNotify = function (url, {url_addons = {}, custom_error = null, ajax_options, xhr_options} = {}) {
    let full_url = url + (Object.keys(url_addons).length ? '?' + JSPLib._jQuery.param(url_addons) : '');
    JSPLib.debug.recordTime(full_url, 'Network');
    return this.get(full_url, {ajax_options, xhr_options}).then(
        //Success
        (data) => data,
        //Failure
        (error) => {
            let process_error = this.processError(error, "network.getNotify");
            let error_key = `${url}?${JSPLib._jQuery.param(url_addons)}`;
            this.logError(error_key, process_error);
            this.notifyError(process_error, custom_error);
            return false;
        },
    ).always(() => {
        JSPLib.debug.recordTimeEnd(full_url, 'Network');
    });
};

//Data functions

JSPLib.network.getData = function (data_url, {ajax_options, xhr_options = {}} = {}) {
    JSPLib.debug.recordTime(data_url, 'Network');
    xhr_options.responseType = 'blob';
    return this.get(data_url, {type: 'binary', ajax_options, xhr_options})
        .then((data, _, resp) => {
            if (resp.status < 200 || resp.status >= 400) {
                JSPLib.utility.throwError(resp.status);
            }
            return data;
        }).always(() => {
            JSPLib.debug.recordTimeEnd(data_url, 'Network');
        });
};

JSPLib.network.getDataSize = function (image_url, {ajax_options, xhr_options} = {}) {
    JSPLib.debug.recordTime(image_url, 'Network');
    return this.head(image_url, {ajax_options, xhr_options})
        .then((_data, _status, resp) => {
            let value = -1;
            if (resp.status === 200) {
                let header_data = resp.getResponseHeader('content-length');
                let match = header_data && header_data.match(/\d+/);
                if (match) {
                    value = parseInt(match[0]);
                }
            }
            return value;
        }).always(() => {
            JSPLib.debug.recordTimeEnd(image_url, 'Network');
        });
};

//jQuery mirrored functions
//These support xhrOptions, and are modified from jQuery 3.6.0

JSPLib.network.ajax = function (self, url, options) {
    if (!JSPLib._jquery_installed) {
        return Promise.resolve(null);
    }
    self.debug('logLevel', {url, options}, JSPLib.debug.VERBOSE);
    return JSPLib._jQuery.ajax(url, options);
};

['get', 'post', 'head', 'delete', 'put', 'patch', 'options'].forEach((method) => {
    JSPLib.network[method] = function(url, {data = null, callback = null, type = null, ajax_options = {}, xhr_options = {}} = {}) {
        let standard_options = {
            url,
            type: method,
            dataType: type,
            data,
            success: callback,
            xhrFields: xhr_options,
        };
        let final_options = JSPLib.utility.mergeHashes(standard_options, ajax_options);
        JSPLib.debug.recordTime(url, 'Network');
        // The url can be an options object (which then must have .url)
        return this.ajax(final_options).always(() => {
            JSPLib.debug.recordTimeEnd(url, 'Network');
        });
    };
});

JSPLib.network.getJSON = function(url, {data, callback, ajax_options, xhr_options} = {}) {
    return this.get(url, {data, callback, type: 'json', ajax_options, xhr_options});
};

JSPLib.network.getScript = function (url, {callback, ajax_options, xhr_options} = {}) {
    ajax_options = JSPLib.utility.mergeHashes({cache: true}, ajax_options);
    return this.get(url, {callback, type: 'script', ajax_options, xhr_options});
};

//Hook functions

JSPLib.network.installXHRHook = function (funcs) {
    const builtinXhrFn = JSPLib._window.XMLHttpRequest;
    JSPLib._window.XMLHttpRequest = function(...xs) {
        //Was this called with the new operator?
        let xhr = new.target === undefined
            ? Reflect.apply(builtinXhrFn, this, xs)
            : Reflect.construct(builtinXhrFn, xs, builtinXhrFn);
        //Add data hook to XHR load event
        xhr.addEventListener('load', () => {JSPLib.network._dataCallback(xhr, funcs);});
        return xhr;
    };
};

//Rate functions

JSPLib.network.incrementCounter = function (module) {
    JSPLib[module].num_network_requests += 1;
    if (this.counter_domname) {
        JSPLib._jQuery(this.counter_domname).html(JSPLib[module].num_network_requests);
    }
};

JSPLib.network.decrementCounter = function (module) {
    JSPLib[module].num_network_requests -= 1;
    if (this.counter_domname) {
        JSPLib._jQuery(this.counter_domname).html(JSPLib[module].num_network_requests);
    }
};

JSPLib.network.rateLimit = async function (self, module) {
    while (JSPLib[module].num_network_requests >= JSPLib[module].max_network_requests) {
        self.debug('logLevel', "Max simultaneous network requests exceeded! Sleeping...", JSPLib.debug.WARNING);
        let rate_limit_wait = JSPLib[module].rate_limit_wait || this.rate_limit_wait;
        await new Promise((resolve) => setTimeout(resolve, rate_limit_wait)); //Sleep
    }
};

//Error functions

JSPLib.network.processError = function (self, error, funcname) {
    error = (typeof error === "object" && 'status' in error && 'responseText' in error ? error : {status: 999, responseText: "Bad error code!"});
    self.debug('errorLevel', funcname, "error:", error.status, '\r\n', error.responseText, JSPLib.debug.ERROR);
    return error;
};

JSPLib.network.logError = function (key, error) {
    this.error_messages.push([key, error.status, error.responseText]);
    if (this.error_domname) {
        JSPLib._jQuery(this.error_domname).html(this.error_messages.length);
    }
};

JSPLib.network.notifyError = function (error, custom_error = "") {
    let message = error.responseText;
    if (message.match(/<\/html>/i)) {
        message = (this._http_error_messages[error.status] ? this._http_error_messages[error.status] + "&nbsp;-&nbsp;" : "") + "&lt;HTML response&gt;";
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

JSPLib.network._dataCallback = function (xhr, funcs) {
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
        funcs.forEach((func) => {
            func(data);
        });
    }
};

/****INITIALIZATION****/

JSPLib.network._configuration = {
    nonenumerable: [],
    nonwritable: ['error_messages', '_http_error_messages', '_dataCallback']
};
JSPLib.initializeModule('network');
JSPLib.debug.addModuleLogs('network', ['ajax', 'rateLimit', 'processError']);
