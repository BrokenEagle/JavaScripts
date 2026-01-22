/****DEPENDENCIES****/

/**Internal dependencies**/
// JSPLib.Debug (optional)
// JSPLib.Utility

/****SETUP****/

//Linter configuration
/* global JSPLib */

(function (Debug, Utility) {

const Load = JSPLib.Load;

/****GLOBAL VARIABLES****/

Load.load_when_hidden = true;
Load.script_wait_interval = 500;
Load.fallback_wait_duration = Utility.one_second * 5;

/****PRIVATE VARIABLES****/

const PROGRAM_LOAD_RETRIES = {};
const PROGRAM_LOAD_TIMERS = {};

var PROGRAM_LOAD_ID = 0;
const DEFAULT_TIMER_INTERVAL = 100;
const DEFAULT_DELAY_DURATION = Utility.one_minute;
const DEFAULT_MAX_RETRIES = 50;

/****FUNCTIONS****/

Load.programLoad = function (entry_func, initialize_name, required_variables, required_selectors, optional_selectors, max_retries, load_id) {
    const printer = Debug.getFunctionPrint('Load.programLoad');
    if ((PROGRAM_LOAD_RETRIES[initialize_name] > max_retries) && (PROGRAM_LOAD_RETRIES[initialize_name] !== 0)) {
        printer.logLevel(initialize_name, "Abandoning program load!", Debug.WARNING);
        clearInterval(PROGRAM_LOAD_TIMERS[initialize_name]);
        PROGRAM_LOAD_TIMERS[initialize_name] = false;
        Debug.timeEnd(load_id + "-programLoad");
        return false;
    }
    const required_variables_installed = required_variables.length === 0 || required_variables.every((name) => _isVariableDefined(name));
    if (!required_variables_installed) {
        printer.logLevel(initialize_name, "required variables", required_variables.join(', ') + " not installed yet.", Debug.DEBUG);
        PROGRAM_LOAD_RETRIES[initialize_name]++;
        return false;
    }
    const required_selectors_installed = required_selectors.length === 0 || required_selectors.every((selector) => document.querySelector(selector));
    if (!required_selectors_installed) {
        printer.logLevel(initialize_name, "required selectors", required_selectors.join(', ') + " not installed yet.", Debug.DEBUG);
        PROGRAM_LOAD_RETRIES[initialize_name]++;
        return false;
    }
    const optional_installed = optional_selectors.length === 0 || optional_selectors.some((selector) => document.querySelector(selector));
    if (!optional_installed) {
        printer.logLevel(initialize_name, "optional selectors", optional_selectors.join(', ') + " not installed yet.", Debug.DEBUG);
        PROGRAM_LOAD_RETRIES[initialize_name]++;
        return false;
    }
    clearInterval(PROGRAM_LOAD_TIMERS[initialize_name]);
    PROGRAM_LOAD_TIMERS[initialize_name] = true;
    printer.log(`Initialize start [${initialize_name}]:`, Utility.getProgramTime());
    entry_func();
    Debug.timeEnd(load_id + "-programLoad");
    return true;
};

Load.programInitialize = function (entry_func, {function_name = null, required_variables = [], required_selectors = [], optional_selectors = [], max_retries = DEFAULT_MAX_RETRIES, timer_interval = DEFAULT_TIMER_INTERVAL} = {}) {
    const printer = Debug.getFunctionPrint('Load.programInitialize');
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
        Debug.execute(() => {
            JSPLib._window_jsp.program[JSPLib.program_name].info = JSPLib._gm_info;
        });
    }
    let initialize_name = function_name ?? JSPLib.program_name;
    if (typeof initialize_name !== 'string') {
        printer.logLevel("No name program/function name passed in!", Debug.ERROR);
        return;
    }
    PROGRAM_LOAD_RETRIES[initialize_name] = 0;
    let load_id = PROGRAM_LOAD_ID++;
    Debug.time(load_id + "-programLoad");
    PROGRAM_LOAD_TIMERS[initialize_name] = Utility.initializeInterval(() => {
        if (!Load.load_when_hidden && document.hidden) {
            return false;
        }
        return Load.programLoad(entry_func, initialize_name, required_variables, required_selectors, optional_selectors, max_retries, load_id);
    }, timer_interval);
};


Load.noncriticalTasks = function (delay_func, delay_duration = DEFAULT_DELAY_DURATION) {
    let adjusted_delay_duration = delay_duration + ((0.5 - Math.random()) * (delay_duration / 4)); // Have up to a 25% swing to avoid processing all scripts at once
    setTimeout(() => {delay_func();}, adjusted_delay_duration);
};

Load.exportData = function ({other_data = null, read_list = [], write_list = []} = {}) {
    Debug.execute(() => {
        JSPLib._window_jsp.lib ??= {};
        JSPLib._window_jsp.lib[JSPLib.program_name] = JSPLib;
        JSPLib._window_jsp.value ??= {};
        JSPLib._window_jsp.value[JSPLib.program_name] = JSPLib.program_data;
        JSPLib._window_jsp.other ??= {};
        JSPLib._window_jsp.other[JSPLib.program_name] = other_data;
    });
    JSPLib._window_jsp.exports[JSPLib.program_name] ??= {};
    read_list.forEach((name) => {
        Object.defineProperty(JSPLib._window_jsp.exports[JSPLib.program_name], name, {get: () => JSPLib.program_data[name]});
    });
    write_list.forEach((name) => {
        Object.defineProperty(JSPLib._window_jsp.exports[JSPLib.program_name], name, {get: () => JSPLib.program_data[name], set: (val) => {JSPLib.program_data[name] = val;}});
    });
};

Load.exportFuncs = function ({debug_list = [], always_list = []} = {}) {
    JSPLib._window_jsp.exports[JSPLib.program_name] = JSPLib._window_jsp.exports[JSPLib.program_name] || {};
    let funclist = always_list;
    Debug.execute(() => {
        funclist = Utility.concat(funclist, debug_list);
    });
    funclist.forEach((func) => {
        JSPLib._window_jsp.exports[JSPLib.program_name][func.name] = func;
    });
};

Load.setProgramGetter = function (program_value, other_program_key, other_program_name, min_version = null) {
    Object.defineProperty(program_value, other_program_key, { get() {return JSPLib._window_jsp.exports[other_program_name] ?? {};}});
    Object.defineProperty(program_value, 'has_' + other_program_key, { get() {return other_program_name in JSPLib._window_jsp.program;}});
    if (min_version !== null) {
        Object.defineProperty(program_value, other_program_key + '_version', { get() {return Number(JSPLib._window_jsp.program[other_program_name].version);}});
        Object.defineProperty(program_value, 'use_' + other_program_key, { get() {return program_value['has_' + other_program_key] && program_value[other_program_key + '_version'] >= min_version;}});
    }
};

Load.scriptWaitExecute = function (program_data, other_program_key, {version = true, available = null, fallback = null}) {
    //For script dependent code which may used at the beginning of program execution
    Utility.recheckInterval({
        check: () => (version && program_data['use_' + other_program_key] || !version && program_data['has_' + other_program_key]),
        exec: available,
        fail: fallback,
        interval: Load.script_wait_interval,
        duration: Load.fallback_wait_duration,
    });
};

/****PRIVATE FUNCTIONS****/

function _isVariableDefined(variable_name) {
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
}

/****INITIALIZATION****/

JSPLib.initializeModule('load');

})(JSPLib.Debug, JSPLib.Utility);
