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
JSPLib.load.script_wait_interval = 500;
JSPLib.load.fallback_wait_duration = JSPLib.utility.one_second * 5;

/****FUNCTIONS****/

JSPLib.load.programLoad = function (entry_func, initialize_name, required_variables, required_selectors, optional_selectors, max_retries, load_id) {
    const printer = JSPLib.debug.getFunctionPrint('load.programLoad');
    if ((this.program_load_retries[initialize_name] > max_retries) && (this.program_load_retries[initialize_name] !== 0)) {
        printer.debuglogLevel(initialize_name, "Abandoning program load!", JSPLib.debug.WARNING);
        clearInterval(this.program_load_timers[initialize_name]);
        this.program_load_timers[initialize_name] = false;
        JSPLib.debug.debugTimeEnd(load_id + "-programLoad");
        return false;
    }
    const required_variables_installed = required_variables.length === 0 || required_variables.every((name) => this._isVariableDefined(name));
    if (!required_variables_installed) {
        printer.debuglogLevel(initialize_name, "required variables", required_variables.join(', ') + " not installed yet.", JSPLib.debug.DEBUG);
        this._incrementRetries(initialize_name, max_retries);
        return false;
    }
    const required_selectors_installed = required_selectors.length === 0 || required_selectors.every((selector) => document.querySelector(selector));
    if (!required_selectors_installed) {
        printer.debuglogLevel(initialize_name, "required selectors", required_selectors.join(', ') + " not installed yet.", JSPLib.debug.DEBUG);
        this._incrementRetries(initialize_name, max_retries);
        return false;
    }
    const optional_installed = optional_selectors.length === 0 || optional_selectors.some((selector) => document.querySelector(selector));
    if (!optional_installed) {
        printer.debuglogLevel(initialize_name, "optional selectors", optional_selectors.join(', ') + " not installed yet.", JSPLib.debug.DEBUG);
        this._incrementRetries(initialize_name, max_retries);
        return false;
    }
    clearInterval(this.program_load_timers[initialize_name]);
    this.program_load_timers[initialize_name] = true;
    printer.debuglog(`Initialize start [${initialize_name}]:`, JSPLib.utility.getProgramTime());
    entry_func();
    JSPLib.debug.debugTimeEnd(load_id + "-programLoad");
    return true;
};

JSPLib.load.programInitialize = function (entry_func, {function_name = null, required_variables = [], required_selectors = [], optional_selectors = [], max_retries = JSPLib.load._default_max_retries, timer_interval = JSPLib.load._default_timer_interval} = {}) {
    const printer = JSPLib.debug.getFunctionPrint('load.programInitialize');
    if (JSPLib.program_name && function_name === null) {
        if (JSPLib._window_jsp.program[JSPLib.program_name]) return;
        JSPLib._window_jsp.program[JSPLib.program_name] = {
            version: JSPLib._gm_info.script.version,
            start: Date.now(),
        };
        JSPLib._window_jsp.info.scripts.push({
            program_name: JSPLib.program_name,
            load_start: performance.now(),
        });
        if (JSPLib.debug.mode) {
            JSPLib._window_jsp.program[JSPLib.program_name].info = JSPLib._gm_info;
        }
    }
    let initialize_name = function_name ?? JSPLib.program_name;
    if (typeof initialize_name !== 'string') {
        printer.debuglogLevel("No name program/function name passed in!", JSPLib.debug.ERROR);
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


JSPLib.load.noncriticalTasks = function (delay_func, delay_duration = JSPLib.load._default_delay_duration) {
    let adjusted_delay_duration = delay_duration + ((0.5 - Math.random()) * (delay_duration / 4)); // Have up to a 25% swing to avoid processing all scripts at once
    setTimeout(() => {delay_func();}, adjusted_delay_duration);
};

JSPLib.load.exportData = function ({other_data = null, read_list = [], write_list = []} = {}) {
    if (JSPLib.debug.mode) {
        JSPLib._window_jsp.lib ||= {};
        JSPLib._window_jsp.lib[JSPLib.program_name] = JSPLib;
        JSPLib._window_jsp.value ||= {};
        JSPLib._window_jsp.value[JSPLib.program_name] = JSPLib.program_data;
        JSPLib._window_jsp.other ||= {};
        JSPLib._window_jsp.other[JSPLib.program_name] = other_data;
    }
    JSPLib._window_jsp.exports[JSPLib.program_name] ||= {};
    read_list.forEach((name) => {
        Object.defineProperty(JSPLib._window_jsp.exports[JSPLib.program_name], name, {get: () => JSPLib.program_data[name]});
    });
    write_list.forEach((name) => {
        Object.defineProperty(JSPLib._window_jsp.exports[JSPLib.program_name], name, {get: () => JSPLib.program_data[name], set: (val) => {JSPLib.program_data[name] = val;}});
    });
};

JSPLib.load.exportFuncs = function ({debug_list = [], always_list = []} = {}) {
    JSPLib._window_jsp.exports[JSPLib.program_name] = JSPLib._window_jsp.exports[JSPLib.program_name] || {};
    let funclist = JSPLib.debug.mode ? debug_list.concat(always_list) : always_list;
    funclist.forEach((func) => {
        JSPLib._window_jsp.exports[JSPLib.program_name][func.name] = func;
    });
};

JSPLib.load.setProgramGetter = function (program_value, other_program_key, other_program_name, min_version = null) {
    Object.defineProperty(program_value, other_program_key, { get() {return JSPLib._window_jsp.exports[other_program_name] ?? {};}});
    Object.defineProperty(program_value, 'has_' + other_program_key, { get() {return other_program_name in JSPLib._window_jsp.program;}});
    if (min_version !== null) {
        Object.defineProperty(program_value, other_program_key + '_version', { get() {return Number(JSPLib._window_jsp.program[other_program_name].version);}});
        Object.defineProperty(program_value, 'use_' + other_program_key, { get() {return program_value['has_' + other_program_key] && program_value[other_program_key + '_version'] >= min_version;}});
    }
};

JSPLib.load.scriptWaitExecute = function (program_data, other_program_key, {version = true, available = null, fallback = null}) {
    //For script dependent code which may used at the beginning of program execution
    JSPLib.utility.recheckInterval({
        check: () => (version && program_data['use_' + other_program_key] || !version && program_data['has_' + other_program_key]),
        exec: available,
        fail: fallback,
        interval: JSPLib.load.script_wait_interval,
        duration: JSPLib.load.fallback_wait_duration,
    });
};

/****PRIVATE DATA****/

//Variables

JSPLib.load._program_load_id = 0;
JSPLib.load._default_timer_interval = 100;
JSPLib.load._default_delay_duration = JSPLib.utility.one_minute;
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
