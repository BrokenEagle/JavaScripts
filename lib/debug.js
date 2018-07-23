/****SETUP****/

var JSPLib = JSPLib || {};
JSPLib.debug = JSPLib.debug || {};

/****GLOBAL VARIABLES****/

JSPLib.debug.debug_console = false;
JSPLib.debug.pretext = "";
JSPLib.debug.records = {};

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

JSPLib.debug.debugTime = function (str) {
    if (JSPLib.debug.debug_console) {
        console.time(str);
    }
};

JSPLib.debug.debugTimeEnd = function (str) {
    if (JSPLib.debug.debug_console) {
        console.timeEnd(str);
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
