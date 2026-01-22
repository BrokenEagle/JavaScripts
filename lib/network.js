/****DEPENDENCIES****/

/**External dependencies**/
// jQuery
// GM.xmlHttpRequest (optional)

/**Internal dependencies**/
// JSPLib.Debug (optional)
// JSPLib.Notice (optional)
// JSPLib.Utility

/****SETUP****/

//Linter configuration
// eslint-disable-next-line no-redeclare
/* global JSPLib GM */

(function (Debug, Notice, Utility) {

const Network = JSPLib.Network;

/****GLOBAL VARIABLES****/

Network.wait_interval = 500;
Network.error_domname = null;
Network.error_messages = [];

/****FUNCTIONS****/

//JSPLib._jQuery Setup

Network.jQuerySetup = function () {
    JSPLib._jQuery.ajaxSetup({
        xhr () {return new _GM_XHR();}
    });
};

//HTML functions

Network.getNotify = function (url, {url_addons = {}, custom_error = "", ajax_options, xhr_options} = {}) {
    let full_url = url + (Object.keys(url_addons).length ? '?' + Utility.renderParams(url_addons) : '');
    Debug.recordTime(full_url, 'Network');
    return Network.get(full_url, {ajax_options, xhr_options}).then(
        //Success
        (data) => data,
        //Failure
        (error) => {
            let process_error = Network.processError(error, "Network.getNotify");
            let error_key = `${url}?${Utility.renderParams(url_addons)}`;
            Network.logError(error_key, process_error);
            Network.notifyError(process_error, custom_error);
            return false;
        },
    ).always(() => {
        Debug.recordTimeEnd(full_url, 'Network');
    });
};

//Data functions

Network.getData = function (data_url, {ajax_options, xhr_options = {}} = {}) {
    Debug.recordTime(data_url, 'Network');
    xhr_options.responseType = 'blob';
    return Network.get(data_url, {type: 'binary', ajax_options, xhr_options})
        .then((data, _, resp) => {
            if (resp.status < 200 || resp.status >= 400) {
                Utility.throwError(resp.status);
            }
            return data;
        }).always(() => {
            Debug.recordTimeEnd(data_url, 'Network');
        });
};

Network.getDataSize = function (image_url, {ajax_options, xhr_options} = {}) {
    Debug.recordTime(image_url, 'Network');
    return Network.head(image_url, {ajax_options, xhr_options})
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
            Debug.recordTimeEnd(image_url, 'Network');
        });
};

//JSPLib._jQuery mirrored functions
//These support xhrOptions, and are modified from JSPLib._jQuery 3.6.0

Network.ajax = function (url, options) {
    const printer = Debug.getFunctionPrint('Network.ajax');
    if (!JSPLib._jquery_installed) {
        return Promise.resolve(null);
    }
    printer.logLevel({url, options}, Debug.ALL);
    return JSPLib._jQuery.ajax(url, options);
};

['get', 'post', 'head', 'delete', 'put', 'patch', 'options'].forEach((method) => {
    Network[method] = function(url, {data = null, callback = null, type = null, ajax_options = {}, xhr_options = {}} = {}) {
        let standard_options = {
            url,
            type: method,
            dataType: type,
            data,
            success: callback,
            xhrFields: xhr_options,
        };
        let final_options = Utility.mergeHashes(standard_options, ajax_options);
        Debug.recordTime(url, 'Network');
        // The url can be an options object (which then must have .url)
        return Network.ajax(final_options).always(() => {
            Debug.recordTimeEnd(url, 'Network');
        });
    };
});

Network.getJSON = function(url, {data, callback, ajax_options, xhr_options} = {}) {
    return Network.get(url, {data, callback, type: 'json', ajax_options, xhr_options});
};

Network.getScript = function (url, {callback, ajax_options, xhr_options} = {}) {
    ajax_options = Utility.mergeHashes({cache: true}, ajax_options);
    return Network.get(url, {callback, type: 'script', ajax_options, xhr_options});
};

//Hook functions

Network.installXHRHook = function (funcs) {
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

Network.waitNetwork = async function (wait_func) {
    do {
        await Utility.sleep(Network.wait_interval);
    } while (wait_func());
};

//Error functions

Network.processError = function (error, funcname) {
    const printer = Debug.getFunctionPrint('Network.processError');
    var ret = null;
    if (typeof error === "object") {
        if ('status' in error && 'responseText' in error) {
            ret = error;
        } else if ('statusText' in error) {
            ret = {status: -1, responseText: error.statusText};
        }
    }
    ret ??= {status: -999, responseText: "Bad error!"};
    printer.errorLevel(funcname, "error:", ret.status, '\r\n', ret.responseText, Debug.ERROR);
    return ret;
};

Network.logError = function (key, error) {
    Network.error_messages.push([key, error.status, error.responseText]);
    if (Network.error_domname) {
        JSPLib._jQuery(Network.error_domname).html(Network.error_messages.length);
    }
};

Network.notifyError = function (error, custom_error = "") {
    let message = error.responseText;
    var notice_html;
    if (error.status > 0) {
        if (message.match(/<\/html>/i)) {
            message = (HTTP_ERROR_MESSAGES[error.status] ? HTTP_ERROR_MESSAGES[error.status] + "&nbsp;-&nbsp;" : "") + "&lt;HTML response&gt;";
        } else {
            message = _parseJSONErrorMessage(message);
        }
        notice_html = Utility.sprintf(NOTIFY_HEADER, `HTTP ${error.status}:`);
    } else {
        notice_html = Utility.sprintf(NOTIFY_HEADER, "Network error:");
    }
    notice_html += ' ' + message;
    if (custom_error.length) {
        notice_html += '<br>' + custom_error;
    }
    Notice.error(notice_html);
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
        if (Utility.isHash(parse_message)) {
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

JSPLib.initializeModule('Network', {
    nonwritable: ['error_messages']
});

})(JSPLib.Debug, JSPLib.Notice, JSPLib.Utility);
