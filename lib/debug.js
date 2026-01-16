/****DEPENDENCIES****/

////Must be included before modules that need debug logging

/****SETUP****/

//Linter configuration
/* global JSPLib */

JSPLib.debug = {};

/****GLOBAL VARIABLES****/

JSPLib.debug.line = false;
JSPLib.debug.pretext = true;
JSPLib.debug.pretimer = true;

JSPLib.debug.ALL = 0;
JSPLib.debug.VERBOSE = 1;
JSPLib.debug.DEBUG = 2;
JSPLib.debug.INFO = 3;
JSPLib.debug.WARNING = 4;
JSPLib.debug.ERROR = 5;

/****FUNCTIONS****/

//Debug output functions

JSPLib.debug.debuglog = function (...args) {
    this._debugOutput(console.log, args);
};

JSPLib.debug.debugwarn = function (...args) {
    this._debugOutput(console.warn, args);
};

JSPLib.debug.debugerror = function (...args) {
    this._debugOutput(console.error, args);
};

JSPLib.debug.debuglogLevel = function (...args) {
    this._debugOutputLevel(console.log, args);
};

JSPLib.debug.debugwarnLevel = function (...args) {
    this._debugOutputLevel(console.warn, args);
};

JSPLib.debug.debugerrorLevel = function (...args) {
    this._debugOutputLevel(console.error, args);
};

JSPLib.debug.getFunctionPrint = function (func_name) {
    this._func_printer ??= {};
    if (!this._func_printer[func_name]) {
        let printer = {};
        if (this.mode) {
            let context = this;
            context._func_iteration ??= {};
            context._func_iteration[func_name] = 0;
            ['debuglog', 'debugwarn', 'debugerror', 'debuglogLevel', 'debugwarnLevel', 'debugerrorLevel'].forEach((debugfunc) => {
                printer[debugfunc] = function (...args) {
                    let iteration = context._func_iteration[func_name];
                    context[debugfunc](`${func_name}[${iteration}] -`, ...args);
                };
            });
        } else {
            ['debuglog', 'debugwarn', 'debugerror', 'debuglogLevel', 'debugwarnLevel', 'debugerrorLevel'].forEach((debugfunc) => {
                printer[debugfunc] = (() => {});
            });
        }
        this._func_printer[func_name] = printer;
    } else if (this.mode) {
        this._func_iteration[func_name]++;
    }
    return this._func_printer[func_name];
};

//Timing functions

JSPLib.debug.debugTime = function (str) {
    if (this.mode) {
        console.time(this._getDebugTimerName(str));
    }
};

JSPLib.debug.debugTimeEnd = function (str) {
    if (this.mode) {
        console.timeEnd(this._getDebugTimerName(str));
    }
};

//Data recording functions

JSPLib.debug.recordTime = function (entryname, type) {
    if (this.mode) {
        let index = entryname + ',' + type;
        this._records[index] = {
            entryname,
            type,
            starttime: performance.now(),
            endtime: 0};
    }
};

JSPLib.debug.recordTimeEnd = function (entryname, type) {
    if (this.mode) {
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

JSPLib.debug.debugExecute = function (func, level = null) {
    let execute_level = level || this.level;
    if (this.mode && Number.isInteger(execute_level) && execute_level >= this.level) {
        func();
    }
};

//Timer functions

JSPLib.debug.debugTimer = function (func, nameindex) {
    let context = this;
    let func_type = Object.getPrototypeOf(func).constructor.name;
    if (func_type !== 'Function' || func_type !== 'AsyncFunction') {
        throw "debug.debugTimer: Item has unknown function constructor";
    }
    let func_name = func.name.replace(/^bound /, "");
    let retfunc = function(...args) {
        var timer_name;
        if (context.mode) {
            timer_name = context._getFuncName(func_name, args, nameindex);
            context.debugTime(timer_name);
        }
        let ret = func(...args);
        if (context.mode) {
            if (func_type === 'Function') {
                context.debugTimeEnd(timer_name);
            } else {
                ret.then(() => {
                    context.debugTimeEnd(timer_name);
                });
            }
        }
        return ret;
    };
    Object.defineProperty(retfunc, 'name', {value: func_name});
    return retfunc;
};

//Other functions

JSPLib.debug.createError = function () {
    return (JSPLib.debug.mode ? new Error() : null);
};

/****PRIVATE DATA****/

//Variables

JSPLib.debug._records = {};

//Functions

JSPLib.debug._debugOutput = function (output_func, args) {
    if (this.mode) {
        this._console_output(output_func, args);
    }
};

JSPLib.debug._debugOutputLevel = function (output_func, args) {
    if (this.mode) {
        let level = args.at(-1);
        if (Number.isInteger(level) && level >= this.level) {
            this._console_output(output_func, args.slice(0, -1));
        }
    }
};

JSPLib.debug._console_output = function (output_func, args) {
    if (typeof args[0] === 'function') {
        args = args[0]();
    }
    if (this.line) {
        let caller_line = (new Error).stack.split('\n')[4];
        let match = caller_line.match(/\d+:(\d+)/);
        if (match) {
            args.unshift('[' + match[1] + ']');
        }
    }
    if (this.pretext) {
        args.unshift(JSPLib.program_prefix);
    }
    output_func(...args);
};

JSPLib.debug._getDebugTimerName = function(str) {
    return (this.pretimer ? JSPLib.program_timer : "") + str;
};

JSPLib.debug._getFuncName = function (func_name, args, nameindex) {
    let timer_name = func_name;
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

JSPLib.initializeModuleProperty('debug', 'mode', false, (set_value, stored_value, original_value) => {
    switch (stored_value) {
        case 'true':
            return true;
        case 'false':
            return false;
        default:
            return (typeof set_value === 'boolean' ? set_value : original_value);
    }
});

JSPLib.initializeModuleProperty('debug', 'level', 0, (set_value, stored_value, original_value) => {
    if (/^[0-5]$/.test(set_value)) {
        return Number(set_value);
    }
    if (Number.isInteger(stored_value) && stored_value >= 0 && stored_value <= 5) {
        return stored_value;
    }
    return original_value;
});

JSPLib.debug._configuration = {
    nonenumerable: [],
    nonwritable: ['_records', 'ALL', 'VERBOSE', 'DEBUG', 'INFO', 'WARNING', 'ERROR']
};
JSPLib.initializeModule('debug');
