/****SETUP****/

//Linter configuration
/* global JSPLib jQuery Danbooru */

var JSPLib = JSPLib || {};
JSPLib.debug = JSPLib.debug || {};

/****GLOBAL VARIABLES****/

JSPLib.debug.debug_console = false;
JSPLib.debug.pretext = "";
JSPLib.debug.pretimer = "";
JSPLib.debug.level = 0;

JSPLib.debug.ALL = 0;
JSPLib.debug.VERBOSE = 1;
JSPLib.debug.DEBUG = 2;
JSPLib.debug.INFO = 3;
JSPLib.debug.WARNING = 4;
JSPLib.debug.ERROR = 5;

/****FUNCTIONS****/

//Debug output functions

JSPLib.debug.debuglog = function (...args) {
    if (JSPLib.debug.debug_console) {
        if (typeof args[0] === 'function') {
            args = args[0]();
        }
        if (JSPLib.debug.pretext) {
            console.log(JSPLib.debug.pretext,...args);
        } else {
            console.log(...args);
        }
    }
};

JSPLib.debug.debuglogLevel = function (...args) {
    let level = args.slice(-1)[0];
    if (Number.isInteger(level) && level >= JSPLib.debug.level) {
        JSPLib.debug.debuglog(...args.slice(0,-1));
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
        JSPLib.debug._records[index] = {
            entryname: entryname,
            type: type,
            starttime: performance.now(),
            endtime: 0};
    }
};

JSPLib.debug.recordTimeEnd = function (entryname,type) {
    if (JSPLib.debug.debug_console) {
        let index = entryname + ',' + type;
        if (!(index in JSPLib.debug._records)) {
            return;
        }
        if (JSPLib.debug._records[index].endtime === 0) {
            JSPLib.debug._records[index].endtime = performance.now();
        }
    }
};

//Execute functions

JSPLib.debug.debugExecute = function (func) {
    if (JSPLib.debug.debug_console) {
        func();
    }
};

JSPLib.debug.debugSyncTimer = function (func,nameindex) {
    return function(...args) {
        let timer_name = JSPLib.debug._getFuncTimerName(func,args,nameindex);
        JSPLib.debug.debugTime(timer_name);
        let ret = func(...args);
        JSPLib.debug.debugTimeEnd(timer_name);
        return ret;
    }
};

JSPLib.debug.debugAsyncTimer = function (func,nameindex) {
    return async function(...args) {
        let timer_name = JSPLib.debug._getFuncTimerName(func,args,nameindex);
        JSPLib.debug.debugTime(timer_name);
        let ret = await func(...args);
        JSPLib.debug.debugTimeEnd(timer_name);
        return ret;
    }
};

//Decorator functions

JSPLib.debug.addFunctionLogs = function (funclist) {
    funclist.forEach((func)=>{
        func.debuglog = function (...args) {
            JSPLib.debug.debuglog(`${func.name} -`,...args);
        };
    });
};

JSPLib.debug.addFunctionTimers = function (hash,is_async,itemlist) {
    let timerFunc = (is_async ? JSPLib.debug.debugAsyncTimer : JSPLib.debug.debugSyncTimer);
    itemlist.forEach((item)=>{
        let func = item;
        let nameindex = null;
        if (Array.isArray(item)) {
            if (typeof item[0] === 'function' && item.length > 1 && item.slice(1).every(val => Number.isInteger(val))) {
                func = item[0];
                if (item.length === 2) {
                    nameindex = item[1];
                } else {
                    nameindex = item.slice(1);
                }
            } else {
                throw "JSPLib.debug.addFunctionTimers: Invalid array parameter";
            }
        } else if (typeof item !== 'function') {
            throw "JSPLib.debug.addFunctionTimers: Item is not a function";
        }
        hash[func.name] = timerFunc(func,nameindex);
    });
};

/****PRIVATE DATA****/

//Variables

JSPLib.debug._records = {};

//Functions

JSPLib.debug._getFuncTimerName = function (func,args,nameindex) {
   let timer_name = func.name;
    if (Number.isInteger(nameindex) && args[nameindex] !== undefined) {
        timer_name += '.' + args[nameindex];
    } else if (Array.isArray(nameindex)) {
        for (let i = 0; i < nameindex.length; i++) {
            let argindex = nameindex[i];
            if (args[argindex] !== undefined) {
                timer_name += '.' + args[argindex];
            } else {
                break;
            }
        }
    }
    return timer_name;
};

/****INITIALIZATION****/

JSPLib.debug._configuration = {
    nonenumerable: ['_records','_getFuncTimerName','_configuration'],
    nonwritable: ['_records','ALL','VERBOSE','DEBUG','INFO','WARNING','ERROR','_configuration']
};
Object.defineProperty(JSPLib,'debug',{configurable:false,writable:false});
for (let property in JSPLib.debug) {
    if (JSPLib.debug._configuration.nonenumerable.includes(property)) {
        Object.defineProperty(JSPLib.debug,property,{enumerable:false});
    }
    if (JSPLib.debug._configuration.nonwritable.includes(property)) {
        Object.defineProperty(JSPLib.debug,property,{writable:false});
    }
    Object.defineProperty(JSPLib.debug,property,{configurable:false});
}
