/****DEPENDENCIES****/

////NONE

/****SETUP****/

//Linter configuration
/* global JSPLib */

JSPLib.load = {};

/****GLOBAL VARIABLES****/

JSPLib.load.program_load_retries = {};
JSPLib.load.program_load_timers = {};
JSPLib.load.load_when_hidden = true;

/****FUNCTIONS****/

JSPLib.load.programLoad = function (self,program,program_name,required_variables,required_selectors,optional_selectors,max_retries,load_id) {
    if (this.program_load_retries[program_name] > max_retries) {
        self.debug('logLevel',program_name,"Abandoning program load!",JSPLib.debug.WARNING);
        clearInterval(this.program_load_timers[program_name]);
        this.program_load_timers[program_name] = false;
        JSPLib.debug.debugTimeEnd(load_id + "-programLoad");
        return false;
    }
    for (let i = 0; i < required_variables.length; i++) {
        if (!this._isVariableDefined(required_variables[i])) {
            self.debug('logLevel',program_name,required_variables[i]+" not installed yet!",JSPLib.debug.INFO);
            this._incrementRetries(program_name,max_retries);
            return false;
        }
    }
    for (let i = 0; i < required_selectors.length; i++) {
        if (!document.querySelector(required_selectors[i])) {
            self.debug('logLevel',program_name,"required selector",required_selectors[i]+" not installed yet!",JSPLib.debug.INFO);
            this._incrementRetries(program_name,max_retries);
            return false;
        }
    }
    let optional_installed = optional_selectors.length === 0 || optional_selectors.some(selector => document.querySelector(selector));
    if (!optional_installed) {
        self.debug('logLevel',program_name,"optional selectors",optional_selectors.join(', ')+" not installed yet!",JSPLib.debug.INFO);
        this._incrementRetries(program_name,max_retries);
        return false;
    }
    clearInterval(this.program_load_timers[program_name]);
    this.program_load_timers[program_name] = true;
    program();
    JSPLib.debug.debugTimeEnd(load_id + "-programLoad");
    return true;
};

JSPLib.load.programInitialize = function (program,program_name,required_variables = [],required_selectors = [],optional_selectors = [], max_retries = JSPLib.load._default_max_retries,timer_interval = JSPLib.load._default_timer_interval) {
    this.program_load_retries[program_name] = 0;
    let load_id = this._program_load_id++;
    JSPLib.debug.debugTime(load_id + "-programLoad");
    if(!this.programLoad(program,program_name,required_variables,required_selectors,optional_selectors,max_retries,load_id) && max_retries !== 0) {
        this.program_load_timers[program_name] = setInterval(()=>{
            if (!this.load_when_hidden && document.hidden) {
                return;
            }
            this.programLoad(program,program_name,required_variables,required_selectors,optional_selectors,max_retries,load_id);
        },timer_interval);
    } else if (max_retries === 0) {
        this.program_load_timers[program_name] = false;
        JSPLib.debug.debugTimeEnd(load_id + "-programLoad");
    }
};

JSPLib.load.exportData = function (program_name, program_value, other_data = null, datalist=[]) {
    if (JSPLib.debug.debug_console) {
        JSPLib._window_jsp.lib = JSPLib._window_jsp.lib || {};
        JSPLib._window_jsp.lib[program_name] = JSPLib;
        JSPLib._window_jsp.value = JSPLib._window_jsp.value || {};
        JSPLib._window_jsp.value[program_name] = program_value;
        JSPLib._window_jsp.other = JSPLib._window_jsp.other || {};
        JSPLib._window_jsp.other[program_name] = other_data;
    }
    JSPLib._window_jsp.export[program_name] = JSPLib._window_jsp.export[program_name] || {};
    datalist.forEach((name)=>{
        Object.defineProperty(JSPLib._window_jsp.export[program_name], name, {get: () => program_value[name]});
    });
};

JSPLib.load.exportFuncs = function (program_name, debuglist, alwayslist=[]) {
    JSPLib._window_jsp.export[program_name] = JSPLib._window_jsp.export[program_name] || {};
    let funclist = JSPLib.debug.debug_console ? debuglist.concat(alwayslist) : alwayslist;
    funclist.forEach((func)=>{
        JSPLib._window_jsp.export[program_name][func.name] = func;
    });
};

JSPLib.load.getExport = function (program_name) {
    return JSPLib._window_jsp.export[program_name];
};

JSPLib.load.setProgramGetter = function (program_value,other_program_key,other_program_name) {
    Object.defineProperty(program_value, other_program_key, { get: function() {return JSPLib.load.getExport(other_program_name) || JSPLib._Danbooru[other_program_key] || {};}});
};

/****PRIVATE DATA****/

//Variables

JSPLib.load._program_load_id = 0;
JSPLib.load._default_timer_interval = 100;
JSPLib.load._default_max_retries = 50;

//Functions

JSPLib.load._isVariableDefined = function(variable_name) {
    let variable_hierarchy = variable_name.split('.');
    if (variable_hierarchy[0] === 'window') {
        variable_hierarchy.shift();
    }
    let curr_obj = window;
    for (let i=0;i<variable_hierarchy.length;i++) {
        if (!(variable_hierarchy[i] in curr_obj)) {
            return false;
        }
        curr_obj = curr_obj[variable_hierarchy[i]];
        if ((typeof curr_obj !== 'object' || curr_obj == null) && (i < (variable_hierarchy.length - 1))) {
            return false;
        }
    }
    return true;
};

JSPLib.load._incrementRetries = function(program_name,max_retries) {
    if (max_retries !== 0) {
        this.program_load_retries[program_name] += 1;
    }
};

JSPLib.load._getWindow = function () {
    return (typeof unsafeWindow !== "undefined" ? unsafeWindow : window);
};

/****INITIALIZATION****/

JSPLib.load._configuration = {
    nonenumerable: ['_program_load_id','_default_timer_interval','_default_max_retries','_isVariableDefined','_incrementRetries','_getWindow','_configuration'],
    nonwritable: ['program_load_retries','program_load_timers','_default_timer_interval','_default_max_retries','_configuration']
};
JSPLib.initializeModule('load');
JSPLib.debug.addModuleLogs('load',['programLoad']);
