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
// eslint-disable-next-line no-undef
JSPLib._window = (typeof unsafeWindow !== "undefined" ? unsafeWindow : window);
JSPLib.__jquery_installed = false;
JSPLib.__danbooru_installed = false;

/****INITIALIZATION****/

JSPLib._configuration = {
    nonenumerable: ['_active_script','_window','_jquery_installed','_danbooru_installed','_configuration'],
    nonwritable: ['_active_script','_window','_configuration','UID']
};

//Wrap initialization with IIFE to avoid polluting the global namespace with variable names/objects
(()=>{
    const jquery_main_functions = ['extend','error','noop','isPlainObject','isEmptyObject','globalEval','each','makeArray','inArray','merge','grep','map','find','unique','uniqueSort','text','isXMLDoc','contains','escapeSelector','filter','Callbacks','Deferred','when','readyException','ready','hasData','data','removeData','_data','_removeData','queue','dequeue','_queueHooks','removeEvent','Event','htmlPrefilter','clone','cleanData','style','css','Tween','fx','Animation','speed','attr','removeAttr','prop','parseXML','param','ajaxSetup','ajaxPrefilter','ajaxTransport','ajax','getJSON','getScript','get','post','_evalUrl','parseHTML','proxy','holdReady','isArray','parseJSON','nodeName','isFunction','isWindow','camelCase','type','now','isNumeric','trim','noConflict','widget','Widget'];
    const jquery_main_objects = ['fn','support','expr','event','cssHooks','cssNumber','cssProps','easing','timers','attrHooks','propHooks','propFix','valHooks','lastModified','etag','ajaxSettings','offset','rails','ui','hotkeys','position'];
    const jquery_main_values = ['expando','isReady','guid','readyWait','active'];
    const jquery_object_functions = ['constructor','toArray','get','pushStack','each','map','slice','first','last','even','odd','eq','end','push','sort','splice','extend','find','filter','not','is','init','has','closest','index','add','addBack','parent','parents','parentsUntil','next','prev','nextAll','prevAll','nextUntil','prevUntil','siblings','children','contents','ready','data','removeData','queue','dequeue','clearQueue','promise','show','hide','toggle','on','one','off','detach','remove','text','append','prepend','before','after','empty','clone','html','replaceWith','appendTo','prependTo','insertBefore','insertAfter','replaceAll','css','fadeTo','animate','stop','finish','slideDown','slideUp','slideToggle','fadeIn','fadeOut','fadeToggle','delay','attr','removeAttr','prop','removeProp','addClass','removeClass','toggleClass','hasClass','val','trigger','triggerHandler','serialize','serializeArray','wrapAll','wrapInner','wrap','unwrap','load','offset','position','offsetParent','scrollLeft','scrollTop','innerHeight','height','outerHeight','innerWidth','width','outerWidth','ajaxStart','ajaxStop','ajaxComplete','ajaxError','ajaxSuccess','ajaxSend','bind','unbind','delegate','undelegate','hover','blur','focus','focusin','focusout','resize','scroll','click','dblclick','mousedown','mouseup','mousemove','mouseover','mouseout','mouseenter','mouseleave','change','select','submit','keydown','keypress','keyup','contextmenu','selectEnd','mouse','scrollParent','draggable','disableSelection','enableSelection','resizable','progressbar','slider','dropzone','uniqueId','removeUniqueId','menu','autocomplete','controlgroup','_form','labels','checkboxradio','button','buttonset','dialog','sortable'];
    const jquery_object_values = ['jquery', 'length'];
    const jquery_main_stub = (()=>jquery_object_stub);
    const jquery_object_stub = (()=>jquery_object_stub);
    jquery_main_functions.forEach((key)=>{jquery_main_stub[key] = (()=>null);});
    jquery_main_objects.forEach((key)=>{jquery_main_stub[key] = {};});
    jquery_main_values.forEach((key)=>{jquery_main_stub[key] = "";});
    jquery_object_functions.forEach((key)=>{jquery_object_stub[key] = (()=>jquery_object_stub);});
    jquery_object_values.forEach((key)=>{jquery_object_stub[key] = "";});
    Object.defineProperty(JSPLib, '_jquery_installed', {get: function() {return (this.__jquery_installed || (this.__jquery_installed = (typeof jQuery === 'function')));}});
    Object.defineProperty(JSPLib, '_jQuery', {get: function() {return (this._jquery_installed && jQuery) || jquery_main_stub;}});

    Object.defineProperty(JSPLib, '_danbooru_installed', {get: function() {return (this.__danbooru_installed || (this.__danbooru_installed = (typeof Danbooru === 'object')));}});
    Object.defineProperty(JSPLib, '_Danbooru', {get: function() {return (this._danbooru_installed && Danbooru) || {};}});

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
