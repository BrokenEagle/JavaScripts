/****DEPENDENCIES****/

////Must be included 1st in the list of modules

/****SETUP****/

//Linter configuration
/* global jQuery Danbooru */

const JSPLib = {};

//Boilerplate functions

JSPLib.debug = {};
JSPLib.debug.debuglogLevel = JSPLib.debug.recordTime = JSPLib.debug.recordTimeEnd = JSPLib.debug.debugTime = JSPLib.debug.debugTimeEnd = JSPLib.debug.debugExecute = (()=>{});
JSPLib.debug.addModuleLogs = function (module_name,func_names) {
    const module = JSPLib[module_name];
    func_names.forEach((name)=>{
        const func = module[name];
        module[name] = function (...args) {
            let debug = {};
            debug.debug = (()=>{}); //Fix once TM option chaining works
            return func.apply(this,[debug].concat(args));
        };
    });
};
JSPLib.debug._records = {};

/****GLOBAL VARIABLES****/

JSPLib.UID = null;

/****FUNCTIONS****/

JSPLib.initializeModule = function (name) {
    const module = JSPLib[name];
    const configuration = module._configuration;
    Object.defineProperty(JSPLib,name,{configurable:false,writable:false});
    for (let property in module) {
        if (configuration.nonenumerable.includes(property)) {
            Object.defineProperty(module,property,{enumerable:false});
        }
        if (configuration.nonwritable.includes(property)) {
            Object.defineProperty(module,property,{writable:false});
        }
        Object.defineProperty(module,property,{configurable:false});
    }
};

/****PRIVATE DATA****/

//Variables

JSPLib._active_script = false;
JSPLib._window = (typeof unsafeWindow !== "undefined" ? unsafeWindow : window);
JSPLib._jquery_installed = false;
JSPLib._danbooru_installed = false;

/****INITIALIZATION****/

Object.defineProperty(JSPLib, '_jQuery', {get: function() {return (this._jquery_installed && jQuery) || ((this._jquery_installed = typeof jQuery === 'function') && jQuery) || (()=>{});}});
Object.defineProperty(JSPLib, '_Danbooru', {get: function() {return (this._danbooru_installed && Danbooru) || ((this._danbooru_installed = typeof Danbooru === 'object') && Danbooru) || {};}});

JSPLib._configuration = {
    nonenumerable: ['_active_script','_window','_jquery_installed','_danbooru_installed','_configuration'],
    nonwritable: ['_active_script','_window','_configuration','UID']
};
(()=>{
    const configuration = JSPLib._configuration;
    if (!('JSPLib' in JSPLib._window)) {
        JSPLib._active_script = true;
    }
    JSPLib._window_jsp = JSPLib._window.JSPLib = JSPLib._window.JSPLib || {};
    JSPLib._window_jsp.export = JSPLib._window_jsp.export || {};
    JSPLib.UID = JSPLib._window_jsp.UID = JSPLib._window_jsp.UID || {};
    JSPLib.UID.value = JSPLib.UID.value || Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    for (let property in JSPLib) {
        if (configuration.nonenumerable.includes(property)) {
            Object.defineProperty(JSPLib,property,{enumerable:false});
        }
        if (configuration.nonwritable.includes(property)) {
            Object.defineProperty(JSPLib,property,{writable:false});
        }
        Object.defineProperty(JSPLib,property,{configurable:false});
    }
})();
