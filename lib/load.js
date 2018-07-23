/****CONFIGURATION****/

const default_timer_interval = 100;
const default_max_retries = 50;

/****SETUP****/

var JSPLib = JSPLib || {};
JSPLib.load = JSPLib.load || {};

//Has debug.js been loaded?
JSPLib.debug = JSPLib.debug || {};
JSPLib.debug.debuglog = JSPLib.debug.debuglog || (()=>{});
JSPLib.debug.debugTime = JSPLib.debug.debugTime || (()=>{});
JSPLib.debug.debugTimeEnd = JSPLib.debug.debugTimeEnd || (()=>{});

/****GLOBAL VARIABLES****/

JSPLib.load.program_load_retries = {};

/****FUNCTIONS****/

JSPLib.load.programLoad = function (program,timername,required_variables,required_ids,required_classes,required_tags,max_retries) {
    if (JSPLib.load.program_load_retries[timername] >= max_retries) {
        JSPLib.debug.debuglog(timername,"Abandoning program load!");
        clearInterval(JSPLib.load.programLoad.timer);
        JSPLib.load.programLoad.timer = false;
        return false;
    }
    for (let i=0;i<required_variables.length;i++) {
        if (eval(required_variables[i]) === undefined) {
            JSPLib.debug.debuglog(timername,required_variables[i] + " not installed yet!");
            JSPLib.load.program_load_retries[timername] += 1;
            return false;
        }
    }
    for (let i=0;i<required_ids.length;i++) {
        if (!document.getElementById(required_ids[i])) {
            JSPLib.debug.debuglog(timername,"#" + required_ids[i] + " not installed yet!");
            JSPLib.load.program_load_retries[timername] += 1;
            return false;
        }
    }
    for (let i=0;i<required_classes.length;i++) {
        if (!document.getElementsByClassName(required_classes[i])) {
            JSPLib.debug.debuglog(timername,"." + required_classes[i] + " not installed yet!");
            JSPLib.load.program_load_retries[timername] += 1;
            return false;
        }
    }
    for (let i=0;i<required_tags.length;i++) {
        if (!document.getElementsByTagName(required_tags[i])) {
            JSPLib.debug.debuglog(timername,"<" + required_tags[i] + "> not installed yet!");
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

JSPLib.load.programInitialize = function (program,timername,required_variables = [],required_ids = [],required_classes = [],required_tags = [],max_retries = default_max_retries,timer_interval = default_timer_interval) {
    JSPLib.load.program_load_retries[timername] = 0;
    JSPLib.debug.debugTime(timername + "-programLoad");
    if(!JSPLib.load.programLoad(program,timername,required_variables,required_ids,required_classes,required_tags,max_retries)) {
        JSPLib.load.programLoad.timer = setInterval(()=>{JSPLib.load.programLoad(program,timername,required_variables,required_ids,required_classes,required_tags,max_retries);},timer_interval);
    }
};
