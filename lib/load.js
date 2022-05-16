/****DEPENDENCIES****/

/**Internal dependencies**/
// JSPLib.utility

/****SETUP****/

//Linter configuration
/* global JSPLib */

JSPLib.load = {};

/****GLOBAL VARIABLES****/

JSPLib.load.program_load_retries = {};
JSPLib.load.program_load_timers = {};
JSPLib.load.load_when_hidden = true;
JSPLib.load.core_js_url = 'https://cdnjs.cloudflare.com/ajax/libs/core-js/3.22.2/minified.js';
JSPLib.load.core_js_integrity = 'sha512-5A/QlqiLiPDTwNLWoPCUw/eqH8D0w9gmseKLy9NDJ35lCYchs04Kuq6KrarvozcDCo+W7jQtDH6UyUjDjObn/Q==';


/****FUNCTIONS****/

JSPLib.load.programLoad = function (self, entry_func, program_name, required_variables, required_selectors, optional_selectors, max_retries, load_id) {
    if ((this.program_load_retries[program_name] > max_retries) && (this.program_load_retries[program_name] !== 0)) {
        self.debug('logLevel', program_name, "Abandoning program load!", JSPLib.debug.WARNING);
        clearInterval(this.program_load_timers[program_name]);
        this.program_load_timers[program_name] = false;
        JSPLib.debug.debugTimeEnd(load_id + "-programLoad");
        return false;
    }
    const required_variables_installed = required_variables.length === 0 || required_variables.every((name) => this._isVariableDefined(name));
    if (!required_variables_installed) {
        self.debug('logLevel', program_name, "required variables", required_variables.join(', ') + " not installed yet.", JSPLib.debug.DEBUG);
        this._incrementRetries(program_name, max_retries);
        return false;
    }
    const required_selectors_installed = required_selectors.length === 0 || required_selectors.every((selector) => document.querySelector(selector));
    if (!required_selectors_installed) {
        self.debug('logLevel', program_name, "required selectors", required_selectors.join(', ') + " not installed yet.", JSPLib.debug.DEBUG);
        this._incrementRetries(program_name, max_retries);
        return false;
    }
    const optional_installed = optional_selectors.length === 0 || optional_selectors.some((selector) => document.querySelector(selector));
    if (!optional_installed) {
        self.debug('logLevel', program_name, "optional selectors", optional_selectors.join(', ') + " not installed yet.", JSPLib.debug.DEBUG);
        this._incrementRetries(program_name, max_retries);
        return false;
    }
    clearInterval(this.program_load_timers[program_name]);
    this.program_load_timers[program_name] = true;
    entry_func();
    JSPLib.debug.debugTimeEnd(load_id + "-programLoad");
    return true;
};

JSPLib.load.programInitialize = function (self, entry_func, {program_name = null, function_name = null, required_variables = [], required_selectors = [], optional_selectors = [], max_retries = JSPLib.load._default_max_retries, timer_interval = JSPLib.load._default_timer_interval} = {}) {
    if (program_name) {
        if (JSPLib._window_jsp.program[program_name]) return;
        JSPLib._window_jsp.program[program_name] = {
            version: JSPLib._gm_info.version,
            uuid: JSPLib._gm_info.script.uuid,
            start: Date.now(),
        };
        JSPLib._window_jsp.info.scripts.push({
            program_name,
            load_start: performance.now(),
        });
        if (JSPLib.debug.debug_console) {
            JSPLib._window_jsp.program[program_name].info = JSPLib._gm_info;
        }
    }
    let initialize_name = program_name || function_name;
    if (typeof initialize_name !== 'string') {
        self.debug('logLevel', "No name program/function name passed in!", JSPLib.debug.ERROR);
        return;
    }
    this.program_load_retries[initialize_name] = 0;
    let load_id = this._program_load_id++;
    JSPLib.debug.debugTime(load_id + "-programLoad");
    this.program_load_timers[initialize_name] = JSPLib.utility.initializeInterval(() => {
        if (!this.load_when_hidden && document.hidden) {
            return false;
        }
        return this.programLoad(entry_func, initialize_name, required_variables, required_selectors, optional_selectors, max_retries, load_id);
    }, timer_interval);
};

JSPLib.load.installCoreJS = function (self) {
    if (JSPLib._window_jsp.info.core_js_promise === undefined) {
        self.debug('log', "Installing Core JS.", JSPLib.debug.INFO);
        let addons = {
            integrity: JSPLib.load.core_js_integrity,
            crossOrigin: 'anonymous',
            referrerPolicy: 'no-referrer',
        };
        JSPLib.utility.installScriptDOM(JSPLib.load.core_js_url, addons);
        JSPLib._window_jsp.info.core_js_promise = new Promise((resolve) => {
            let timer = setInterval(() => {
                if (typeof Set.prototype.every === 'function') {
                    clearInterval(timer);
                    resolve(null);
                } else {
                    self.debug('log', "Not installed yet.", JSPLib.debug.VERBOSE);
                }
            }, 100);
        });
    } else {
        self.debug('log', "Core JS already installed.", JSPLib.debug.DEBUG);
    }
    return JSPLib._window_jsp.info.core_js_promise;
};


JSPLib.load.noncriticalTasks = function (delay_func, delay_duration = JSPLib.load._default_delay_duration) {
    let adjusted_delay_duration = delay_duration + ((0.5 - Math.random()) * (delay_duration / 4)); // Have up to a 25% swing to avoid processing all scripts at once
    setTimeout(() => {delay_func();}, adjusted_delay_duration);
};

JSPLib.load.exportData = function (program_name, program_value, {other_data = null, datalist = []} = {}) {
    if (JSPLib.debug.debug_console) {
        JSPLib._window_jsp.lib = JSPLib._window_jsp.lib || {};
        JSPLib._window_jsp.lib[program_name] = JSPLib;
        JSPLib._window_jsp.value = JSPLib._window_jsp.value || {};
        JSPLib._window_jsp.value[program_name] = program_value;
        JSPLib._window_jsp.other = JSPLib._window_jsp.other || {};
        JSPLib._window_jsp.other[program_name] = other_data;
    }
    JSPLib._window_jsp.exports[program_name] = JSPLib._window_jsp.exports[program_name] || {};
    datalist.forEach((name) => {
        Object.defineProperty(JSPLib._window_jsp.exports[program_name], name, {get: () => program_value[name]});
    });
};

JSPLib.load.exportFuncs = function (program_name, {debuglist = [], alwayslist = []}) {
    JSPLib._window_jsp.exports[program_name] = JSPLib._window_jsp.exports[program_name] || {};
    let funclist = JSPLib.debug.debug_console ? debuglist.concat(alwayslist) : alwayslist;
    funclist.forEach((func) => {
        JSPLib._window_jsp.exports[program_name][func.name] = func;
    });
};

JSPLib.load.getExport = function (program_name) {
    return JSPLib._window_jsp.exports[program_name];
};

JSPLib.load.setProgramGetter = function (program_value, other_program_key, other_program_name) {
    Object.defineProperty(program_value, other_program_key, { get() {return JSPLib.load.getExport(other_program_name) || JSPLib._Danbooru[other_program_key] || {};}});
};

/****PRIVATE DATA****/

//Variables

JSPLib.load._program_load_id = 0;
JSPLib.load._default_timer_interval = 100;
JSPLib.load._default_delay_duration = 1000 * 60; // One minute
JSPLib.load._default_max_retries = 50;

//Functions

JSPLib.load._isVariableDefined = function(variable_name) {
    let variable_hierarchy = variable_name.split('.');
    if (variable_hierarchy[0] === 'window') {
        variable_hierarchy.shift();
    }
    let curr_obj = JSPLib._window;
    for (let i = 0;i < variable_hierarchy.length;i++) {
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

JSPLib.load._incrementRetries = function(program_name) {
    this.program_load_retries[program_name] += 1;
};

/****INITIALIZATION****/

JSPLib.load._configuration = {
    nonenumerable: [],
    nonwritable: ['program_load_retries', 'program_load_timers', '_default_timer_interval', '_default_delay_duration', '_default_max_retries']
};
JSPLib.initializeModule('load');
JSPLib.debug.addModuleLogs('load', ['programLoad', 'programInitialize', 'installCoreJS']);
