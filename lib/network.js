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

(function (debug, utility, notice) {

const network = JSPLib.network;

/****GLOBAL VARIABLES****/

network.wait_interval = 500;
network.error_domname = null;
network.error_messages = [];

/****FUNCTIONS****/

//JSPLib._jQuery Setup

network.jQuerySetup = function () {
    JSPLib._jQuery.ajaxSetup({
        xhr () {return new _GM_XHR();}
    });
};

//HTML functions

network.getNotify = function (url, {url_addons = {}, custom_error = "", ajax_options, xhr_options} = {}) {
    let full_url = url + (Object.keys(url_addons).length ? '?' + utility.renderParams(url_addons) : '');
    debug.recordTime(full_url, 'Network');
    return network.get(full_url, {ajax_options, xhr_options}).then(
        //Success
        (data) => data,
        //Failure
        (error) => {
            let process_error = network.processError(error, "network.getNotify");
            let error_key = `${url}?${utility.renderParams(url_addons)}`;
            network.logError(error_key, process_error);
            network.notifyError(process_error, custom_error);
            return false;
        },
    ).always(() => {
        debug.recordTimeEnd(full_url, 'Network');
    });
};

//Data functions

network.getData = function (data_url, {ajax_options, xhr_options = {}} = {}) {
    debug.recordTime(data_url, 'Network');
    xhr_options.responseType = 'blob';
    return network.get(data_url, {type: 'binary', ajax_options, xhr_options})
        .then((data, _, resp) => {
            if (resp.status < 200 || resp.status >= 400) {
                utility.throwError(resp.status);
            }
            return data;
        }).always(() => {
            debug.recordTimeEnd(data_url, 'Network');
        });
};

network.getDataSize = function (image_url, {ajax_options, xhr_options} = {}) {
    debug.recordTime(image_url, 'Network');
    return network.head(image_url, {ajax_options, xhr_options})
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
            debug.recordTimeEnd(image_url, 'Network');
        });
};

//JSPLib._jQuery mirrored functions
//These support xhrOptions, and are modified from JSPLib._jQuery 3.6.0

network.ajax = function (url, options) {
    const printer = debug.getFunctionPrint('network.ajax');
    if (!JSPLib._jquery_installed) {
        return Promise.resolve(null);
    }
    printer.debuglogLevel({url, options}, debug.ALL);
    return JSPLib._jQuery.ajax(url, options);
};

['get', 'post', 'head', 'delete', 'put', 'patch', 'options'].forEach((method) => {
    network[method] = function(url, {data = null, callback = null, type = null, ajax_options = {}, xhr_options = {}} = {}) {
        let standard_options = {
            url,
            type: method,
            dataType: type,
            data,
            success: callback,
            xhrFields: xhr_options,
        };
        let final_options = utility.mergeHashes(standard_options, ajax_options);
        debug.recordTime(url, 'Network');
        // The url can be an options object (which then must have .url)
        return network.ajax(final_options).always(() => {
            debug.recordTimeEnd(url, 'Network');
        });
    };
});

network.getJSON = function(url, {data, callback, ajax_options, xhr_options} = {}) {
    return network.get(url, {data, callback, type: 'json', ajax_options, xhr_options});
};

network.getScript = function (url, {callback, ajax_options, xhr_options} = {}) {
    ajax_options = utility.mergeHashes({cache: true}, ajax_options);
    return network.get(url, {callback, type: 'script', ajax_options, xhr_options});
};

//Hook functions

network.installXHRHook = function (funcs) {
    const builtinXhrFn = JSPLib._window.XMLHttpRequest;
    JSPLib._window.XMLHttpRequest = function(...xs) {
        //Was this called with the new operator?
        let xhr = new.target === undefined
            ? Reflect.apply(builtinXhrFn, this, xs)
            : Reflect.construct(builtinXhrFn, xs, builtinXhrFn);
        //Add data hook to XHR load event
        xhr.addEventListener('load', () => {_dataCallback(xhr, funcs);});
        return xhr;
    };
};

//Rate functions

network.waitNetwork = async function (wait_func) {
    do {
        await utility.sleep(network.wait_interval);
    } while (wait_func());
};

//Error functions

network.processError = function (error, funcname) {
    const printer = debug.getFunctionPrint('network.processError');
    var ret = null;
    if (typeof error === "object") {
        if ('status' in error && 'responseText' in error) {
            ret = error;
        } else if ('statusText' in error) {
            ret = {status: -1, responseText: error.statusText};
        }
    }
    ret ??= {status: -999, responseText: "Bad error!"};
    printer.debugerrorLevel(funcname, "error:", ret.status, '\r\n', ret.responseText, debug.ERROR);
    return ret;
};

network.logError = function (key, error) {
    network.error_messages.push([key, error.status, error.responseText]);
    if (network.error_domname) {
        JSPLib._jQuery(network.error_domname).html(network.error_messages.length);
    }
};

network.notifyError = function (error, custom_error = "") {
    let message = error.responseText;
    var notice_html;
    if (error.status > 0) {
        if (message.match(/<\/html>/i)) {
            message = (HTTP_ERROR_MESSAGES[error.status] ? HTTP_ERROR_MESSAGES[error.status] + "&nbsp;-&nbsp;" : "") + "&lt;HTML response&gt;";
        } else {
            message = _parseJSONErrorMessage(message);
        }
        notice_html = utility.sprintf(NOTIFY_HEADER, `HTTP ${error.status}:`);
    } else {
        notice_html = utility.sprintf(NOTIFY_HEADER, "Network error:");
    }
    notice_html += ' ' + message;
    if (custom_error.length) {
        notice_html += '<br>' + custom_error;
    }
    notice.error(notice_html);
};

/****PRIVATE DATA****/

//Variables

const HTTP_ERROR_MESSAGES = {
    502: "Bad gateway",
};

const NOTIFY_HEADER = '<span style="font-size: 16px; line-height: 24px; font-weight: bold; font-family: sans-serif;">%s</span>';

/****PRIVATE FUNCTIONS****/

// https://gist.github.com/monperrus/999065
// This is a shim that adapts JSPLib._jQuery's ajax methods to use GM_xmlhttpRequest.
// This allows the use JSPLib._jQuery.getJSON instead of using GM_xmlhttpRequest directly.
//
// This is necessary because some sites have a Content Security Policy (CSP) which
// blocks cross-origin requests to Danbooru that require authentication.
// Tampermonkey can bypass the CSP, but only if GM_xmlhttpRequest is used.
function _GM_XHR () {
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
            //JSPLib._jQuery uses username, Tampermonkey uses user
            user: this.username,
            onload: this.onresponse("onload"),
            onerror: this.onresponse("onerror"),
        };
        let send_data = Object.assign(standard_params, ...gm_params.map((key) => (this[key] !== undefined ? {[key]: this[key]} : {})));
        return GM.xmlHttpRequest(send_data);
    };
}

function _parseJSONErrorMessage(message) {
    try {
        let parse_message = JSON.parse(message);
        if (utility.isHash(parse_message)) {
            if ('reason' in parse_message) {
                message = parse_message.reason;
            } else if ('message' in parse_message) {
                message = parse_message.message;
            }
        }
    } catch (exception) {
        //Swallow
    }
    return message;
}

function _dataCallback(xhr, funcs) {
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
}

/****INITIALIZATION****/

JSPLib.initializeModule('network', {
    nonwritable: ['error_messages']
});

})(JSPLib.debug, JSPLib.utility, JSPLib.notice);
