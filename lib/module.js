/****DEPENDENCIES****/

////Must be included 1st in the list of modules

/****SETUP****/

//Linter configuration
/* global jQuery Danbooru GM_info */

const JSPLib = {};
JSPLib._start_time = performance.now();

//Boilerplate functions

JSPLib.debug = {};
JSPLib.debug.debuglogLevel = JSPLib.debug.recordTime = JSPLib.debug.recordTimeEnd = JSPLib.debug.debugTime = JSPLib.debug.debugTimeEnd = JSPLib.debug.debugExecute = (() => {});
JSPLib.debug.addModuleLogs = function (module_name, func_names) {
    const module = JSPLib[module_name];
    func_names.forEach((name) => {
        const func = module[name];
        module[name] = function (...args) {
            let debug = {};
            debug.debug = (() => {}); //Fix once TM option chaining works
            return func.apply(this, [debug].concat(args));
        };
    });
};
JSPLib.debug._records = {};

JSPLib.notice = {};
JSPLib.notice.notice = (...args) => {JSPLib._Danbooru.Utility.notice(...args);};
JSPLib.notice.error = (...args) => {JSPLib._Danbooru.Utility.error(...args);};

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

/****PRIVATE DATA****/

//Variables

JSPLib._active_script = false;
JSPLib._sandboxed = typeof unsafeWindow !== "undefined";
// eslint-disable-next-line no-undef
JSPLib._window = (JSPLib._sandboxed ? unsafeWindow : window);
JSPLib._document = JSPLib._window.document;
JSPLib._gm_info = (typeof GM_info !== "undefined" ? GM_info : {});
JSPLib.__jquery_installed = false;
JSPLib.__danbooru_installed = false;

/****INITIALIZATION****/

JSPLib._configuration = {
    nonenumerable: [],
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
