/****CONFIGURATION****/

const default_timer_interval = 100;
const default_max_retries = 50;

/****SETUP****/

var JSPLib = JSPLib || {};
JSPLib.load = JSPLib.load || {};

//Has debug.js been loaded?
if (JSPLib.debug === undefined) {
    JSPLib.debug = {};
    JSPLib.debug.debuglog = ()=>{};
    JSPLib.debug.debugTime = ()=>{};
    JSPLib.debug.debugTimeEnd = ()=>{};
}

/****GLOBAL VARIABLES****/

JSPLib.load.program_load_retries = {};

/****FUNCTIONS****/

JSPLib.load.programLoad = function (program,timername,required_variables,max_retries) {
    if (JSPLib.load.program_load_retries[timername] >= max_retries) {
        JSPLib.debug.debuglog("Abandoning program load!");
        clearInterval(JSPLib.load.programLoad.timer);
        JSPLib.load.programLoad.timer = false;
        return false;
    }
    for (let i=0;i<required_variables.length;i++) {
        if (eval(required_variables[i]) === undefined) {
            JSPLib.debug.debuglog(required_variables[i] + " not installed yet!");
            JSPLib.load.program_load_retries[timername] += 1;
            return false;
        }
    }
    clearInterval(JSPLib.load.programLoad.timer);
    JSPLib.load.programLoad.timer = true;
    program();
    JSPLib.debug.debugTimeEnd(timername + "-programLoad");
    return true;
};

JSPLib.load.programInitialize = function (program,timername,required_variables = [],max_retries = default_max_retries,timer_interval = default_timer_interval) {
    JSPLib.load.program_load_retries[timername] = 0;
    JSPLib.debug.debugTime(timername + "-programLoad");
    if(!JSPLib.load.programLoad(program,timername,required_variables,max_retries)) {
        JSPLib.load.programLoad.timer = setInterval(()=>{JSPLib.load.programLoad(program,timername,required_variables,max_retries);},timer_interval);
    }
};
