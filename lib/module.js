/****DEPENDENCIES****/

////Must be included 1st in the list of modules

/****SETUP****/

//Linter configuration
/* global jQuery Danbooru GM_info unsafeWindow */

const JSPLib = {};

(() => {
    
JSPLib._start_time = performance.now();

/****GLOBAL VARIABLES****/

JSPLib.program_prefix = "";
JSPLib.program_timer = "";
JSPLib.program_name = "";
JSPLib.program_regex = /(?:)/;
JSPLib.program_id = "";
JSPLib.program_data = {};

JSPLib.program = new Proxy(JSPLib, {
    get(target, prop, _receiver) {
        return prop + (target.program_shortcut.length ? '.' + target.program_shortcut : "");
    },
});

//Stub constants

const JSPLIB_DEBUG_FUNCTIONS = ['debuglog', 'debugwarn', 'debugerror', 'debuglogLevel', 'debugwarnLevel', 'debugerrorLevel', 'recordTime', 'recordTimeEnd', 'debugTime', 'debugTimeEnd', 'debugExecute'];
const JQUERY_MAIN_FUNCTIONS = ['extend', 'error', 'noop', 'isPlainObject', 'isEmptyObject', 'globalEval', 'each', 'makeArray', 'inArray', 'merge', 'grep', 'map', 'find', 'unique', 'uniqueSort', 'text', 'isXMLDoc', 'contains', 'escapeSelector', 'filter', 'Callbacks', 'Deferred', 'when', 'readyException', 'ready', 'hasData', 'data', 'removeData', '_data', '_removeData', 'queue', 'dequeue', '_queueHooks', 'removeEvent', 'Event', 'htmlPrefilter', 'clone', 'cleanData', 'style', 'css', 'Tween', 'fx', 'Animation', 'speed', 'attr', 'removeAttr', 'prop', 'parseXML', 'param', 'ajaxSetup', 'ajaxPrefilter', 'ajaxTransport', 'ajax', 'getJSON', 'getScript', 'get', 'post', '_evalUrl', 'parseHTML', 'proxy', 'holdReady', 'isArray', 'parseJSON', 'nodeName', 'isFunction', 'isWindow', 'camelCase', 'type', 'now', 'isNumeric', 'trim', 'noConflict', 'widget', 'Widget'];
const JQUEY_MAIN_OBJECTS = ['fn', 'support', 'expr', 'event', 'cssHooks', 'cssNumber', 'cssProps', 'easing', 'timers', 'attrHooks', 'propHooks', 'propFix', 'valHooks', 'lastModified', 'etag', 'ajaxSettings', 'offset', 'rails', 'ui', 'hotkeys', 'position'];
const JQUERY_MAIN_VALUES = ['expando', 'isReady', 'guid', 'readyWait', 'active'];
const JQUERY_OBJECT_FUNCTIONS = ['constructor', 'toArray', 'get', 'pushStack', 'each', 'map', 'slice', 'first', 'last', 'even', 'odd', 'eq', 'end', 'push', 'sort', 'splice', 'extend', 'find', 'filter', 'not', 'is', 'init', 'has', 'closest', 'index', 'add', 'addBack', 'parent', 'parents', 'parentsUntil', 'next', 'prev', 'nextAll', 'prevAll', 'nextUntil', 'prevUntil', 'siblings', 'children', 'contents', 'ready', 'data', 'removeData', 'queue', 'dequeue', 'clearQueue', 'promise', 'show', 'hide', 'toggle', 'on', 'one', 'off', 'detach', 'remove', 'text', 'append', 'prepend', 'before', 'after', 'empty', 'clone', 'html', 'replaceWith', 'appendTo', 'prependTo', 'insertBefore', 'insertAfter', 'replaceAll', 'css', 'fadeTo', 'animate', 'stop', 'finish', 'slideDown', 'slideUp', 'slideToggle', 'fadeIn', 'fadeOut', 'fadeToggle', 'delay', 'attr', 'removeAttr', 'prop', 'removeProp', 'addClass', 'removeClass', 'toggleClass', 'hasClass', 'val', 'trigger', 'triggerHandler', 'serialize', 'serializeArray', 'wrapAll', 'wrapInner', 'wrap', 'unwrap', 'load', 'offset', 'position', 'offsetParent', 'scrollLeft', 'scrollTop', 'innerHeight', 'height', 'outerHeight', 'innerWidth', 'width', 'outerWidth', 'ajaxStart', 'ajaxStop', 'ajaxComplete', 'ajaxError', 'ajaxSuccess', 'ajaxSend', 'bind', 'unbind', 'delegate', 'undelegate', 'hover', 'blur', 'focus', 'focusin', 'focusout', 'resize', 'scroll', 'click', 'dblclick', 'mousedown', 'mouseup', 'mousemove', 'mouseover', 'mouseout', 'mouseenter', 'mouseleave', 'change', 'select', 'submit', 'keydown', 'keypress', 'keyup', 'contextmenu', 'selectEnd', 'mouse', 'scrollParent', 'draggable', 'disableSelection', 'enableSelection', 'resizable', 'progressbar', 'slider', 'dropzone', 'uniqueId', 'removeUniqueId', 'menu', 'autocomplete', 'controlgroup', '_form', 'labels', 'checkboxradio', 'button', 'buttonset', 'dialog', 'sortable'];
const JQUERY_OBJECT_VALUES = ['jquery', 'length'];
const DANBOORU_UTILITY_FUNCTIONS = ['notice', 'error'];

JSPLib.debug = {};
JSPLib.notice = {};
const JQUERY_MAIN_STUB = (() => JQUERY_OBJECT_STUB);
const JQUERY_OBJECT_STUB = (() => JQUERY_OBJECT_STUB);
const DANBOORU_STUB = {Utility: {}};

/****FUNCTIONS****/

JSPLib.initializeModule = function (name) {
    var module;
    if (name === undefined) {
        module = JSPLib;
    } else {
        module = JSPLib[name];
        Object.defineProperty(JSPLib, name, {configurable: false, writable: false});
    }
    const configuration = module._configuration;
    for (let property in module) {
        if (configuration.nonenumerable.includes(property) || property.startsWith('_')) {
            Object.defineProperty(module, property, {enumerable: false});
        }
        if (configuration.nonwritable.includes(property) || property === '_configuration') {
            Object.defineProperty(module, property, {writable: false});
        }
        Object.defineProperty(module, property, {configurable: false});
    }
};

JSPLib.initializeModuleProperty = function (module, name, default_value, setter) {
    const private_name = '_' + name;
    Object.defineProperty(JSPLib[module], name, {
        get() {
            return this[private_name];
        },
        set(value) {
            if (typeof setter === 'function') {
                this[private_name] = setter(value, localStorage.getItem(`${JSPLib.program_shortcut}-${module}-${name}`), this[private_name]);
            } else {
                this[private_name] = value;
            }
        },
        enumerable: true,
        configurable: false,
    });
    JSPLib[module][private_name] = default_value;
};

/****PRIVATE DATA****/

//Variables

JSPLib._program_shortcut = "";
JSPLib._active_script = false;
JSPLib._sandboxed = typeof unsafeWindow !== "undefined";
JSPLib._window = (JSPLib._sandboxed ? unsafeWindow : window);
JSPLib._page_context = JSPLib._window.window === JSPLib._window;
JSPLib._document = JSPLib._window.document;
JSPLib._gm_info = (typeof GM_info !== "undefined" ? GM_info : {});
JSPLib.__jquery_installed = false;
JSPLib.__danbooru_installed = false;

/****INITIALIZATION****/

if (!('JSPLib' in JSPLib._window)) {
    JSPLib._active_script = true;
}

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

JSPLIB_DEBUG_FUNCTIONS.forEach((debugfunc) => {JSPLib.debug[debugfunc] = (() => {});});
JSPLib.debug.getFunctionPrint = (() => JSPLib.debug);

JSPLib.notice.notice = ((...args) => JSPLib._Danbooru.Utility.notice(...args));
JSPLib.notice.error = ((...args) => JSPLib._Danbooru.Utility.error(...args));
JSPLib.notice.close = (() => JSPLib._document.getElementById('close-notice-link')?.click());

JQUERY_MAIN_FUNCTIONS.forEach((key) => {JQUERY_MAIN_STUB[key] = (() => null);});
JQUEY_MAIN_OBJECTS.forEach((key) => {JQUERY_MAIN_STUB[key] = {};});
JQUERY_MAIN_VALUES.forEach((key) => {JQUERY_MAIN_STUB[key] = "";});
JQUERY_OBJECT_FUNCTIONS.forEach((key) => {JQUERY_OBJECT_STUB[key] = (() => JQUERY_OBJECT_STUB);});
JQUERY_OBJECT_VALUES.forEach((key) => {JQUERY_OBJECT_STUB[key] = "";});

DANBOORU_UTILITY_FUNCTIONS.forEach((key) => {DANBOORU_STUB.Utility[key] = (() => null);});

//Configuration

Object.defineProperties(JSPLib, {
    program_shortcut: {
        get() {
            return this._program_shortcut;
        },
        set(shortcut) {
            let shortcut_upper = shortcut.toUpperCase();
            this.program_prefix = shortcut_upper + ':';
            this.program_timer = shortcut_upper + '-';
            this.program_regex = RegExp(`^${shortcut}-(.*)`);
            this._program_shortcut = shortcut;
        },
        enumerable: true,
        configurable: false,
    },
    program_name: {
        get() {
            return this._program_name;
        },
        set(name) {
            this.program_id = name.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase();
            this._program_name = name;
        },
        enumerable: true,
        configurable: false,
    },
    _jquery_installed: {
        get() {
            this.__jquery_installed ||= (typeof jQuery === 'function');
            return this.__jquery_installed;
        },
    },
    _jQuery: {
        get() {
            return (this._jquery_installed ? jQuery : JQUERY_MAIN_STUB);
        },
    },
    _danbooru_installed: {
        get() {
            this.__danbooru_installed ||= (typeof Danbooru === 'object');
            return this.__danbooru_installed;
        },
    },
    _Danbooru: {
        get() {
            return (this._danbooru_installed ? Danbooru : DANBOORU_STUB);
        },
    },
});

JSPLib._configuration = {
    nonenumerable: ['_program_shortcut', '_program_name'],
    nonwritable: ['_active_script', '_window', 'UID', 'program']
};
JSPLib.initializeModule();

})();
