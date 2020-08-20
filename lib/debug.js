/****SETUP****/

//Linter configuration
/* global JSPLib jQuery Danbooru */

var JSPLib = JSPLib || {};
JSPLib.debug = JSPLib.debug || {};

/****GLOBAL VARIABLES****/

JSPLib.debug.debug_console = false;
JSPLib.debug.debug_line = false;
JSPLib.debug.pretext = true;
JSPLib.debug.pretimer = true;
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
    this._debugOutput(console.log,...args);
};

JSPLib.debug.debugwarn = function (...args) {
    this._debugOutput(console.warn,...args);
};

JSPLib.debug.debugerror = function (...args) {
    this._debugOutput(console.error,...args);
};

JSPLib.debug.debuglogLevel = function (...args) {
    this._debugOutputLevel(console.log,...args);
};

JSPLib.debug.debugwarnLevel = function (...args) {
    this._debugOutputLevel(console.warn,...args);
};

JSPLib.debug.debugerrorLevel = function (...args) {
    this._debugOutputLevel(console.error,...args);
};

JSPLib.debug.debugTime = function (str) {
    if (this.debug_console) {
        console.time(JSPLib.debug._getDebugTimerName(str));
    }
};

JSPLib.debug.debugTimeEnd = function (str) {
    if (this.debug_console) {
        console.timeEnd(JSPLib.debug._getDebugTimerName(str));
    }
};

//Data recording functions

JSPLib.debug.recordTime = function (entryname,type) {
    if (this.debug_console) {
        let index = entryname + ',' + type;
        this._records[index] = {
            entryname: entryname,
            type: type,
            starttime: performance.now(),
            endtime: 0};
    }
};

JSPLib.debug.recordTimeEnd = function (entryname,type) {
    if (this.debug_console) {
        let index = entryname + ',' + type;
        if (!(index in this._records)) {
            return;
        }
        if (this._records[index].endtime === 0) {
            this._records[index].endtime = performance.now();
        }
    }
};

//Execute functions

JSPLib.debug.debugExecute = function (func) {
    if (this.debug_console) {
        func();
    }
};

JSPLib.debug.debugSyncTimer = function (func,nameindex) {
    let context = this;
    return function(...args) {
        let timer_name = context._getFuncTimerName(func,args,nameindex);
        context.debugTime(timer_name);
        let ret = func(...args);
        context.debugTimeEnd(timer_name);
        return ret;
    }
};

JSPLib.debug.debugAsyncTimer = function (func,nameindex) {
    let context = this;
    return async function(...args) {
        let timer_name = context._getFuncTimerName(func,args,nameindex);
        context.debugTime(timer_name);
        let ret = await func(...args);
        context.debugTimeEnd(timer_name);
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
    let context = this;
    let timerFunc = (is_async ? this.debugAsyncTimer : this.debugSyncTimer);
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
                throw "debug.addFunctionTimers: Invalid array parameter";
            }
        } else if (typeof item !== 'function') {
            throw "debug.addFunctionTimers: Item is not a function";
        }
        hash[func.name] = timerFunc.apply(context,[func,nameindex]);
    });
};

/****PRIVATE DATA****/

//Variables

JSPLib.debug._records = {};
JSPLib.debug.program_prefix = "";
JSPLib.debug.program_timer = "";

//Functions

JSPLib.debug._debugOutput = function (output_func, ...args) {
    if (this.debug_console) {
        if (typeof args[0] === 'function') {
            args = args[0]();
        }
        if (this.debug_line) {
            let caller_line = (new Error).stack.split('\n')[4];
            let match = caller_line.match(/\d+:(\d+)/);
            if (match) {
                args.unshift('[' + match[1] + ']');
            }
        }
        if (this.pretext) {
            args.unshift(this.program_prefix);
        }
        output_func(...args);
    }
};

JSPLib.debug._debugOutputLevel = function (output_func, ...args) {
    let level = args.slice(-1)[0];
    if (Number.isInteger(level) && level >= this.level) {
        this._debugOutput(output_func, ...args.slice(0,-1));
    }
};

JSPLib.debug._getDebugTimerName = function(str) {
    return (this.pretimer ? this.program_timer : "") + str;
};

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

Object.defineProperty(JSPLib.debug, 'program_shortcut', {set: function(shortcut) {
    let shortcut_upper = shortcut.toUpperCase();
    this.program_prefix = shortcut_upper + ':';
    this.program_timer = shortcut_upper + '-';
}});

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
