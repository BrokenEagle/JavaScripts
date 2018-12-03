/****CONFIGURATION****/

const default_timer_interval = 100;
const default_max_retries = 50;

/****SETUP****/

var JSPLib = JSPLib || {};
JSPLib.load = JSPLib.load || {};

//Has debug.js been loaded?
JSPLib.debug = JSPLib.debug || {};
JSPLib.debug.debuglogLevel = JSPLib.debug.debuglogLevel || (()=>{});
JSPLib.debug.debugTime = JSPLib.debug.debugTime || (()=>{});
JSPLib.debug.debugTimeEnd = JSPLib.debug.debugTimeEnd || (()=>{});

/****GLOBAL VARIABLES****/

JSPLib.load.program_load_retries = {};
JSPLib.load.program_load_timers = {};
JSPLib.load.program_load_id = 0;

/****FUNCTIONS****/

JSPLib.load.programLoad = function (program,program_name,required_variables,required_selectors,max_retries,load_id) {
    if (JSPLib.load.program_load_retries[program_name] > max_retries) {
        JSPLib.debug.debuglogLevel(program_name,"Abandoning program load!",JSPLib.debug.WARNING);
        clearInterval(JSPLib.load.program_load_timers[program_name]);
        JSPLib.load.program_load_timers[program_name] = false;
        JSPLib.debug.debugTimeEnd(load_id + "-programLoad");
        return false;
    }
    for (let i=0;i<required_variables.length;i++) {
        if (!JSPLib.load._isVariableDefined(required_variables[i])) {
            JSPLib.debug.debuglogLevel(program_name,required_variables[i] + " not installed yet!",JSPLib.debug.INFO);
            if (max_retries !== 0) {
                JSPLib.load.program_load_retries[program_name] += 1;
            }
            return false;
        }
    }
    for (let i=0;i<required_selectors.length;i++) {
        if (!document.querySelector(required_selectors[i])) {
            JSPLib.debug.debuglogLevel(program_name, "selector", required_selectors[i] + " not installed yet!",JSPLib.debug.INFO);
            if (max_retries !== 0) {
                JSPLib.load.program_load_retries[program_name] += 1;
            }
            return false;
        }
    }
    clearInterval(JSPLib.load.program_load_timers[program_name]);
    JSPLib.load.program_load_timers[program_name] = true;
    program();
    JSPLib.debug.debugTimeEnd(load_id + "-programLoad");
    return true;
};

JSPLib.load.programInitialize = function (program,program_name,required_variables = [],required_selectors = [],max_retries = default_max_retries,timer_interval = default_timer_interval) {
    JSPLib.load.program_load_retries[program_name] = 0;
    let load_id = JSPLib.load.program_load_id++;
    JSPLib.debug.debugTime(load_id + "-programLoad");
    if(!JSPLib.load.programLoad(program,program_name,required_variables,required_selectors,max_retries,load_id) && max_retries !== 0) {
        JSPLib.load.program_load_timers[program_name] = setInterval(()=>{JSPLib.load.programLoad(program,program_name,required_variables,required_selectors,max_retries,load_id);},timer_interval);
    } else if (max_retries === 0) {
        JSPLib.load.program_load_timers[program_name] = false;
        JSPLib.debug.debugTimeEnd(load_id + "-programLoad");
    }
};

//Private functions

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
}
