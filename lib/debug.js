/****SETUP****/

var JSPLib = JSPLib || {};
JSPLib.debug = JSPLib.debug || {};

/****GLOBAL VARIABLES****/

JSPLib.debug.debug_console = false;
JSPLib.debug.pretext = "";
JSPLib.debug.pretimer = "";
JSPLib.debug.level = 0;
JSPLib.debug.records = {};

JSPLib.debug.ALL = 0;
JSPLib.debug.VERBOSE = 1;
JSPLib.debug.DEBUG = 2;
JSPLib.debug.INFO = 3;
JSPLib.debug.WARNING = 4;
JSPLib.debug.ERROR = 5;

/****FUNCTIONS****/

//Debug output functions

JSPLib.debug.debuglog = function () {
    if (JSPLib.debug.debug_console) {
        if (JSPLib.debug.pretext) {
            console.log(JSPLib.debug.pretext,...arguments);
        } else {
            console.log(...arguments);
        }
    }
};

JSPLib.debug.debuglogLevel = function (args) {
    let level = arguments[arguments.length - 1];
    if (level >= JSPLib.debug.level) {
        arguments.length -= 1;
        JSPLib.debug.debuglog(...arguments);
    }
}

JSPLib.debug.debugTime = function (str) {
    if (JSPLib.debug.debug_console) {
        console.time(JSPLib.debug.pretimer + str);
    }
};

JSPLib.debug.debugTimeEnd = function (str) {
    if (JSPLib.debug.debug_console) {
        console.timeEnd(JSPLib.debug.pretimer + str);
    }
};

//Data recording functions

JSPLib.debug.recordTime = function (entryname,type) {
    if (JSPLib.debug.debug_console) {
        let index = entryname + ',' + type;
        JSPLib.debug.records[index] = {
            entryname: entryname,
            type: type,
            starttime: performance.now(),
            endtime: 0};
    }
};

JSPLib.debug.recordTimeEnd = function (entryname,type) {
    if (JSPLib.debug.debug_console) {
        let index = entryname + ',' + type;
        if (!(index in JSPLib.debug.records)) {
            return;
        }
        if (JSPLib.debug.records[index].endtime === 0) {
            JSPLib.debug.records[index].endtime = performance.now();
        }
    }
};

//Execute functions

JSPLib.debug.debugExecute = function (func) {
    if (JSPLib.debug.debug_console) {
        func();
    }
}

JSPLib.debug.debugSyncTimer = function (func,funcname) {
    return function() {
        JSPLib.debug.debugTime(funcname);
        let ret = func(...arguments);
        JSPLib.debug.debugTimeEnd(funcname);
        return ret;
    }
}

JSPLib.debug.debugAsyncTimer = function (func,funcname) {
    return async function() {
        JSPLib.debug.debugTime(funcname);
        let ret = await func(...arguments);
        JSPLib.debug.debugTimeEnd(funcname);
        return ret;
    }
}
