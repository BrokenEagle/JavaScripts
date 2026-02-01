/****DEPENDENCIES****/

////Must be included 1st in the list of modules

/****SETUP****/

//Linter configuration
/* global jQuery Danbooru GM_info unsafeWindow validate */

const JSPLib = {
    Utility: {},
    Storage: {},
    Template: {},
    Validate: {},
    Concurrency: {},
    Statistics: {},
    Network: {},
    Danbooru: {},
    Saucenao: {},
    Load: {},
    Menu: {},
};

(function () {

JSPLib._start_time = performance.now();

/****GLOBAL VARIABLES****/

JSPLib.prefix = "";
JSPLib.timer = "";
JSPLib.regex = /(?:)/;
JSPLib.id = "";
JSPLib.data = {};
JSPLib.settings_config = {};
JSPLib.default_data = {};
JSPLib.reset_data = {};

/****PRIVATE VARIABLES****/

var PROGRAM_SHORTCUT = "";
var PROGRAM_NAME = "";
var JQUERY_INSTALLED = false;
var DANBOORU_INSTALLED = false;

//Stub constants

const STUB_FUNCTION = new Proxy((() => {}), {
    // A basic proxy which can be endlessly chained/called.
    get(_target, _prop, _receiver) {
        return STUB_FUNCTION;
    },
    apply(_target, _thisArg, _args) {
        return STUB_FUNCTION;
    },
});

/****FUNCTIONS****/

JSPLib.initializeModule = function (name, configuration) {
    var module;
    configuration ??= {};
    if (name === null) {
        module = JSPLib;
    } else {
        module = JSPLib[name];
        Object.defineProperty(JSPLib, name, {configurable: false, writable: false});
    }
    for (let property in module) {
        if (configuration?.nonenumerable?.includes(property) || property.startsWith('_')) {
            Object.defineProperty(module, property, {enumerable: false});
        }
        if (configuration?.nonwritable?.includes(property)) {
            Object.defineProperty(module, property, {writable: false});
        }
        Object.defineProperty(module, property, {configurable: false});
    }
};

JSPLib.initializeModuleProperty = function (module, name, private_value, setter) {
    let module_key = module.toLowerCase();
    let name_key = name.replaceAll('_', '-');
    let storage_key = null;
    Object.defineProperty(JSPLib[module], name, {
        get() {
            return private_value;
        },
        set(value) {
            if (typeof setter === 'function') {
                storage_key ??= `${JSPLib.shortcut}-${module_key}-${name_key}`;
                private_value = setter(value, localStorage.getItem(storage_key), private_value);
            } else {
                private_value = value;
            }
        },
        enumerable: true,
        configurable: false,
    });
};

/****INITIALIZATION****/

JSPLib._sandboxed = typeof unsafeWindow !== 'undefined';
JSPLib._gm_info = (typeof GM_info !== 'undefined' ? GM_info : {});
JSPLib._window = (JSPLib._sandboxed ? unsafeWindow : window);
JSPLib._document = JSPLib._window.document;
JSPLib._page_context = JSPLib._window.window === JSPLib._window;
JSPLib._active_script = !('JSPLib' in JSPLib._window);

//Window initialization

JSPLib._window_jsp = JSPLib._window.JSPLib ??= {};
JSPLib._window_jsp.exports ??= {};
JSPLib._window_jsp.program ??= {};
JSPLib.UID = JSPLib._window_jsp.UID ??= {};
JSPLib.UID.value ??= Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
JSPLib.info = JSPLib._window_jsp.info ??= {};
JSPLib.info.UID ??= JSPLib.UID.value;
JSPLib.info.start ??= JSPLib._start_time;
JSPLib.info.scripts ??= [];

//Basic module initialization

JSPLib.Debug = STUB_FUNCTION;
JSPLib.Notice = {
    notice: (...args) => JSPLib._Danbooru.Utility.notice(...args),
    error: (...args) => JSPLib._Danbooru.Utility.error(...args),
    close: () => JSPLib._document.getElementById('close-notice-link')?.click(),
};

//Define properties

Object.defineProperties(JSPLib, {
    shortcut: {
        get() {
            return PROGRAM_SHORTCUT;
        },
        set(value) {
            let shortcut_upper = value.toUpperCase();
            JSPLib.prefix = shortcut_upper + ':';
            JSPLib.timer = shortcut_upper + '-';
            JSPLib.regex = RegExp(`^${value}-(.*)`);
            PROGRAM_SHORTCUT = value;
        },
        enumerable: true,
    },
    name: {
        get() {
            return PROGRAM_NAME;
        },
        set(value) {
            JSPLib.id = value.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase();
            PROGRAM_NAME = value;
        },
        enumerable: true,
    },
    _jQuery: {
        get() {
            JQUERY_INSTALLED ||= (typeof jQuery === 'function' || typeof window.jQuery === 'function');
            return (JQUERY_INSTALLED ? jQuery : STUB_FUNCTION);
        },
    },
    _Danbooru: {
        get() {
            DANBOORU_INSTALLED ||= (typeof Danbooru === 'object' || typeof window.Danbooru === 'object');
            return (DANBOORU_INSTALLED ? Danbooru : STUB_FUNCTION);
        },
    },
});

JSPLib.event = new Proxy(JSPLib, {
    get(_target, prop, _receiver) {
        return prop + '.' + JSPLib.shortcut;
    },
});

JSPLib.jQueryProxy = new Proxy((() => {}), {
    get(_target, prop, _receiver) {
        return JSPLib._jQuery[prop];
    },
    apply(_target, _thisArg, args) {
        return JSPLib._jQuery(...args);
    },
});

JSPLib.DanbooruProxy = new Proxy((() => {}), {
    get(_target, prop, _receiver) {
        return JSPLib._Danbooru[prop];
    },
});

JSPLib.ValidateJS = (typeof validate !== 'undefined' ? validate : window.validate);

//Configuration

JSPLib.initializeModule(null, {
    nonwritable: ['_active_script', '_sandboxed', '_page_context', '_window', '_document', '_gm_info', '_window_jsp', '_jQueryProxy', '_DanbooruProxy', 'UID', 'info', 'program']
});

})();
