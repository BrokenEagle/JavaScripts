/****DEPENDENCIES****/

////Must be included 1st in the list of modules

/****SETUP****/

//Linter configuration
/* global jQuery Danbooru GM_info unsafeWindow validate */

const JSPLib = {
    Debug: {},
    Utility: {},
    Storage: {},
    Template: {},
    Validate: {},
    Concurrency: {},
    Statistics: {},
    Notice: {},
    Network: {},
    Danbooru: {},
    Saucenao: {},
    Load: {},
    Menu: {},
};

(() => {

JSPLib._start_time = performance.now();

/****GLOBAL VARIABLES****/

JSPLib.prefix = "";
JSPLib.timer = "";
JSPLib.regex = /(?:)/;
JSPLib.id = "";
JSPLib.data = {};

/****PRIVATE VARIABLES****/

var PROGRAM_SHORTCUT = "";
var PROGRAM_NAME = "";
var JQUERY_INSTALLED = false;
var DANBOORU_INSTALLED = false;

//Stub constants

const JSPLIB_DEBUG_FUNCTIONS = ['log', 'warn', 'error', 'logLevel', 'warnLevel', 'errorLevel', 'recordTime', 'recordTimeEnd', 'time', 'timeEnd'];
const JQUERY_MAIN_FUNCTIONS = ['extend', 'error', 'noop', 'isPlainObject', 'isEmptyObject', 'globalEval', 'each', 'makeArray', 'inArray', 'merge', 'grep', 'map', 'find', 'unique', 'uniqueSort', 'text', 'isXMLDoc', 'contains', 'escapeSelector', 'filter', 'Callbacks', 'Deferred', 'when', 'readyException', 'ready', 'hasData', 'data', 'removeData', '_data', '_removeData', 'queue', 'dequeue', '_queueHooks', 'removeEvent', 'Event', 'htmlPrefilter', 'clone', 'cleanData', 'style', 'css', 'Tween', 'fx', 'Animation', 'speed', 'attr', 'removeAttr', 'prop', 'parseXML', 'param', 'ajaxSetup', 'ajaxPrefilter', 'ajaxTransport', 'ajax', 'getJSON', 'getScript', 'get', 'post', '_evalUrl', 'parseHTML', 'proxy', 'holdReady', 'isArray', 'parseJSON', 'nodeName', 'isFunction', 'isWindow', 'camelCase', 'type', 'now', 'isNumeric', 'trim', 'noConflict', 'widget', 'Widget'];
const JQUEY_MAIN_OBJECTS = ['fn', 'support', 'expr', 'event', 'cssHooks', 'cssNumber', 'cssProps', 'easing', 'timers', 'attrHooks', 'propHooks', 'propFix', 'valHooks', 'lastModified', 'etag', 'ajaxSettings', 'offset', 'rails', 'ui', 'hotkeys', 'position'];
const JQUERY_MAIN_VALUES = ['expando', 'isReady', 'guid', 'readyWait', 'active'];
const JQUERY_OBJECT_FUNCTIONS = ['constructor', 'toArray', 'get', 'pushStack', 'each', 'map', 'slice', 'first', 'last', 'even', 'odd', 'eq', 'end', 'push', 'sort', 'splice', 'extend', 'find', 'filter', 'not', 'is', 'init', 'has', 'closest', 'index', 'add', 'addBack', 'parent', 'parents', 'parentsUntil', 'next', 'prev', 'nextAll', 'prevAll', 'nextUntil', 'prevUntil', 'siblings', 'children', 'contents', 'ready', 'data', 'removeData', 'queue', 'dequeue', 'clearQueue', 'promise', 'show', 'hide', 'toggle', 'on', 'one', 'off', 'detach', 'remove', 'text', 'append', 'prepend', 'before', 'after', 'empty', 'clone', 'html', 'replaceWith', 'appendTo', 'prependTo', 'insertBefore', 'insertAfter', 'replaceAll', 'css', 'fadeTo', 'animate', 'stop', 'finish', 'slideDown', 'slideUp', 'slideToggle', 'fadeIn', 'fadeOut', 'fadeToggle', 'delay', 'attr', 'removeAttr', 'prop', 'removeProp', 'addClass', 'removeClass', 'toggleClass', 'hasClass', 'val', 'trigger', 'triggerHandler', 'serialize', 'serializeArray', 'wrapAll', 'wrapInner', 'wrap', 'unwrap', 'load', 'offset', 'position', 'offsetParent', 'scrollLeft', 'scrollTop', 'innerHeight', 'height', 'outerHeight', 'innerWidth', 'width', 'outerWidth', 'ajaxStart', 'ajaxStop', 'ajaxComplete', 'ajaxError', 'ajaxSuccess', 'ajaxSend', 'bind', 'unbind', 'delegate', 'undelegate', 'hover', 'blur', 'focus', 'focusin', 'focusout', 'resize', 'scroll', 'click', 'dblclick', 'mousedown', 'mouseup', 'mousemove', 'mouseover', 'mouseout', 'mouseenter', 'mouseleave', 'change', 'select', 'submit', 'keydown', 'keypress', 'keyup', 'contextmenu', 'selectEnd', 'mouse', 'scrollParent', 'draggable', 'disableSelection', 'enableSelection', 'resizable', 'progressbar', 'slider', 'dropzone', 'uniqueId', 'removeUniqueId', 'menu', 'autocomplete', 'controlgroup', '_form', 'labels', 'checkboxradio', 'button', 'buttonset', 'dialog', 'sortable'];
const JQUERY_OBJECT_VALUES = ['jquery', 'length'];
const DANBOORU_UTILITY_FUNCTIONS = ['notice', 'error'];

const JQUERY_MAIN_STUB = (() => JQUERY_OBJECT_STUB);
const JQUERY_OBJECT_STUB = (() => JQUERY_OBJECT_STUB);
const DANBOORU_STUB = {Utility: {}};

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

//Boilerplate functions

JSPLIB_DEBUG_FUNCTIONS.forEach((debugfunc) => {JSPLib.Debug[debugfunc] = (() => {});});
JSPLib.Debug.execute = ((...args) => args.at(0)?.());
JSPLib.Debug.getFunctionPrint = (() => JSPLib.Debug);

JSPLib.Notice.notice = ((...args) => JSPLib._Danbooru.Utility.notice(...args));
JSPLib.Notice.error = ((...args) => JSPLib._Danbooru.Utility.error(...args));
JSPLib.Notice.close = (() => JSPLib._document.getElementById('close-notice-link')?.click());

JQUERY_MAIN_FUNCTIONS.forEach((key) => {JQUERY_MAIN_STUB[key] = (() => null);});
JQUEY_MAIN_OBJECTS.forEach((key) => {JQUERY_MAIN_STUB[key] = {};});
JQUERY_MAIN_VALUES.forEach((key) => {JQUERY_MAIN_STUB[key] = "";});
JQUERY_OBJECT_FUNCTIONS.forEach((key) => {JQUERY_OBJECT_STUB[key] = (() => JQUERY_OBJECT_STUB);});
JQUERY_OBJECT_VALUES.forEach((key) => {JQUERY_OBJECT_STUB[key] = "";});

DANBOORU_UTILITY_FUNCTIONS.forEach((key) => {DANBOORU_STUB.Utility[key] = (() => null);});

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
    _jquery_installed: {
        get() {
            JQUERY_INSTALLED ||= (typeof jQuery === 'function' || typeof window.jQuery === 'function');
            return JQUERY_INSTALLED;
        },
    },
    _jQuery: {
        get() {
            return (JSPLib._jquery_installed ? jQuery : JQUERY_MAIN_STUB);
        },
    },
    _danbooru_installed: {
        get() {
            DANBOORU_INSTALLED ||= (typeof Danbooru === 'object' || typeof window.Danbooru === 'object');
            return DANBOORU_INSTALLED;
        },
    },
    _Danbooru: {
        get() {
            return (JSPLib._danbooru_installed ? Danbooru : DANBOORU_STUB);
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
    nonwritable: ['_active_script', '_sandboxed', '_page_context', '_window', '_document', '_gm_info', '_window_jsp', '_jQueryProxy', 'UID', 'info', 'program']
});

})();
