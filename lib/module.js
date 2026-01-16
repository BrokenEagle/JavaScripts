/****DEPENDENCIES****/

////Must be included 1st in the list of modules

/****SETUP****/

//Linter configuration
/* global jQuery Danbooru GM_info unsafeWindow */

const JSPLib = {};
JSPLib._start_time = performance.now();

//Boilerplate functions

JSPLib.debug = {};
['debuglog', 'debugwarn', 'debugerror', 'debuglogLevel', 'debugwarnLevel', 'debugerrorLevel', 'recordTime', 'recordTimeEnd', 'debugTime', 'debugTimeEnd', 'debugExecute'].forEach((debugfunc) => {
    JSPLib.debug[debugfunc] = (() => {});
});

JSPLib.debug.getFunctionPrint = (() => JSPLib.debug);

JSPLib.notice = {};
JSPLib.notice.notice = ((...args) => JSPLib._Danbooru.Utility.notice(...args));
JSPLib.notice.error = ((...args) => JSPLib._Danbooru.Utility.error(...args));
JSPLib.notice.close = (() => JSPLib._document.getElementById('close-notice-link')?.click());

/****GLOBAL VARIABLES****/

JSPLib.UID = null;

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

/****PUBLIC DATA****/

Object.defineProperty(JSPLib, 'program_shortcut', {
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
});
JSPLib.program_prefix = "";
JSPLib.program_timer = "";
JSPLib.program_name = "";
JSPLib.program_data = {};
JSPLib.program = new Proxy(JSPLib, {
    get(target, prop, _receiver) {
        return prop + (target.program_shortcut.length ? '.' + target.program_shortcut : "");
    },
});

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

JSPLib._configuration = {
    nonenumerable: ['_program_shortcut'],
    nonwritable: ['_active_script', '_window', 'UID']
};

//Wrap initialization with IIFE to avoid polluting the global namespace with variable names/objects
(() => {
    const jquery_main_functions = ['extend', 'error', 'noop', 'isPlainObject', 'isEmptyObject', 'globalEval', 'each', 'makeArray', 'inArray', 'merge', 'grep', 'map', 'find', 'unique', 'uniqueSort', 'text', 'isXMLDoc', 'contains', 'escapeSelector', 'filter', 'Callbacks', 'Deferred', 'when', 'readyException', 'ready', 'hasData', 'data', 'removeData', '_data', '_removeData', 'queue', 'dequeue', '_queueHooks', 'removeEvent', 'Event', 'htmlPrefilter', 'clone', 'cleanData', 'style', 'css', 'Tween', 'fx', 'Animation', 'speed', 'attr', 'removeAttr', 'prop', 'parseXML', 'param', 'ajaxSetup', 'ajaxPrefilter', 'ajaxTransport', 'ajax', 'getJSON', 'getScript', 'get', 'post', '_evalUrl', 'parseHTML', 'proxy', 'holdReady', 'isArray', 'parseJSON', 'nodeName', 'isFunction', 'isWindow', 'camelCase', 'type', 'now', 'isNumeric', 'trim', 'noConflict', 'widget', 'Widget'];
    const jquery_main_objects = ['fn', 'support', 'expr', 'event', 'cssHooks', 'cssNumber', 'cssProps', 'easing', 'timers', 'attrHooks', 'propHooks', 'propFix', 'valHooks', 'lastModified', 'etag', 'ajaxSettings', 'offset', 'rails', 'ui', 'hotkeys', 'position'];
    const jquery_main_values = ['expando', 'isReady', 'guid', 'readyWait', 'active'];
    const jquery_object_functions = ['constructor', 'toArray', 'get', 'pushStack', 'each', 'map', 'slice', 'first', 'last', 'even', 'odd', 'eq', 'end', 'push', 'sort', 'splice', 'extend', 'find', 'filter', 'not', 'is', 'init', 'has', 'closest', 'index', 'add', 'addBack', 'parent', 'parents', 'parentsUntil', 'next', 'prev', 'nextAll', 'prevAll', 'nextUntil', 'prevUntil', 'siblings', 'children', 'contents', 'ready', 'data', 'removeData', 'queue', 'dequeue', 'clearQueue', 'promise', 'show', 'hide', 'toggle', 'on', 'one', 'off', 'detach', 'remove', 'text', 'append', 'prepend', 'before', 'after', 'empty', 'clone', 'html', 'replaceWith', 'appendTo', 'prependTo', 'insertBefore', 'insertAfter', 'replaceAll', 'css', 'fadeTo', 'animate', 'stop', 'finish', 'slideDown', 'slideUp', 'slideToggle', 'fadeIn', 'fadeOut', 'fadeToggle', 'delay', 'attr', 'removeAttr', 'prop', 'removeProp', 'addClass', 'removeClass', 'toggleClass', 'hasClass', 'val', 'trigger', 'triggerHandler', 'serialize', 'serializeArray', 'wrapAll', 'wrapInner', 'wrap', 'unwrap', 'load', 'offset', 'position', 'offsetParent', 'scrollLeft', 'scrollTop', 'innerHeight', 'height', 'outerHeight', 'innerWidth', 'width', 'outerWidth', 'ajaxStart', 'ajaxStop', 'ajaxComplete', 'ajaxError', 'ajaxSuccess', 'ajaxSend', 'bind', 'unbind', 'delegate', 'undelegate', 'hover', 'blur', 'focus', 'focusin', 'focusout', 'resize', 'scroll', 'click', 'dblclick', 'mousedown', 'mouseup', 'mousemove', 'mouseover', 'mouseout', 'mouseenter', 'mouseleave', 'change', 'select', 'submit', 'keydown', 'keypress', 'keyup', 'contextmenu', 'selectEnd', 'mouse', 'scrollParent', 'draggable', 'disableSelection', 'enableSelection', 'resizable', 'progressbar', 'slider', 'dropzone', 'uniqueId', 'removeUniqueId', 'menu', 'autocomplete', 'controlgroup', '_form', 'labels', 'checkboxradio', 'button', 'buttonset', 'dialog', 'sortable'];
    const jquery_object_values = ['jquery', 'length'];
    const jquery_main_stub = (() => jquery_object_stub);
    const jquery_object_stub = (() => jquery_object_stub);
    jquery_main_functions.forEach((key) => {jquery_main_stub[key] = (() => null);});
    jquery_main_objects.forEach((key) => {jquery_main_stub[key] = {};});
    jquery_main_values.forEach((key) => {jquery_main_stub[key] = "";});
    jquery_object_functions.forEach((key) => {jquery_object_stub[key] = (() => jquery_object_stub);});
    jquery_object_values.forEach((key) => {jquery_object_stub[key] = "";});
    const danbooru_utility_functions = ['notice', 'error'];
    const danbooru_stub = {Utility: {}};
    danbooru_utility_functions.forEach((key) => {danbooru_stub.Utility[key] = (() => null);});
    Object.defineProperty(JSPLib, '_jquery_installed', {get() {this.__jquery_installed ||= (typeof jQuery === 'function'); return this.__jquery_installed;}});
    Object.defineProperty(JSPLib, '_jQuery', {get() {return (this._jquery_installed && jQuery) || jquery_main_stub;}});

    Object.defineProperty(JSPLib, '_danbooru_installed', {get() {this.__danbooru_installed ||= (typeof Danbooru === 'object'); return this.__danbooru_installed;}});
    Object.defineProperty(JSPLib, '_Danbooru', {get() {return (this._danbooru_installed && Danbooru) || danbooru_stub;}});

    if (!('JSPLib' in JSPLib._window)) {
        JSPLib._active_script = true;
    }
    JSPLib._window_jsp = JSPLib._window.JSPLib ||= {};
    JSPLib._window_jsp.exports ||= {};
    JSPLib._window_jsp.program ||= {};
    JSPLib.UID = JSPLib._window_jsp.UID ||= {};
    JSPLib.UID.value ||= Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    JSPLib.info = JSPLib._window_jsp.info ||= {};
    JSPLib.info.UID ||= JSPLib.UID.value;
    JSPLib.info.start ||= performance.now();
    JSPLib.info.scripts ||= [];
    JSPLib.initializeModule();
})();
