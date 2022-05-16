/****DEPENDENCIES****/

////Must be included before modules that need debug logging

/****SETUP****/

//Linter configuration
/* global JSPLib */

JSPLib.debug = {};

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
    this._debugOutput(console.log, ...args);
};

JSPLib.debug.debugwarn = function (...args) {
    this._debugOutput(console.warn, ...args);
};

JSPLib.debug.debugerror = function (...args) {
    this._debugOutput(console.error, ...args);
};

JSPLib.debug.debuglogLevel = function (...args) {
    this._debugOutputLevel(console.log, ...args);
};

JSPLib.debug.debugwarnLevel = function (...args) {
    this._debugOutputLevel(console.warn, ...args);
};

JSPLib.debug.debugerrorLevel = function (...args) {
    this._debugOutputLevel(console.error, ...args);
};

//Timing functions

JSPLib.debug.debugTime = function (str) {
    if (this.debug_console) {
        console.time(this._getDebugTimerName(str));
    }
};

JSPLib.debug.debugTimeEnd = function (str) {
    if (this.debug_console) {
        console.timeEnd(this._getDebugTimerName(str));
    }
};

//Data recording functions

JSPLib.debug.recordTime = function (entryname, type) {
    if (this.debug_console) {
        let index = entryname + ',' + type;
        this._records[index] = {
            entryname,
            type,
            starttime: performance.now(),
            endtime: 0};
    }
};

JSPLib.debug.recordTimeEnd = function (entryname, type) {
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

JSPLib.debug.debugExecute = function (func, level = null) {
    let execute_level = level || this.level;
    if (this.debug_console && Number.isInteger(execute_level) && execute_level >= this.level) {
        func();
    }
};

//Timer functions

JSPLib.debug.debugSyncTimer = function (func, nameindex) {
    if (!this.debug_console) {
        return func;
    }
    let context = this;
    return function(...args) {
        let timer_name = context._getFuncName(func, args, nameindex);
        context.debugTime(timer_name);
        let ret = func(...args);
        context.debugTimeEnd(timer_name);
        return ret;
    };
};

JSPLib.debug.debugAsyncTimer = function (func, nameindex) {
    if (!this.debug_console) {
        return func;
    }
    let context = this;
    return async function(...args) {
        let timer_name = context._getFuncName(func, args, nameindex);
        context.debugTime(timer_name);
        let ret = await func(...args);
        context.debugTimeEnd(timer_name);
        return ret;
    };
};


//Decorator functions

JSPLib.debug.addFunctionLogs = function (funclist) {
    const context = this;
    return funclist.map((func) => {
        func.iteration = 1;
        let func_name = this._getFuncName(func);
        let new_func = function (...args) {
            let debug = {};
            if (context.debug_console) {
                let iteration = func.iteration++;
                debug = {
                    debug (...args) {
                        let function_key = 'debug' + args[0];
                        args = args.slice(1);
                        if (typeof args[0] === 'function') {
                            let temp = args;
                            args = [() => (JSPLib.utility.concat([`${func_name}[${iteration}] -`], temp[0]()))];
                        } else {
                            args = JSPLib.utility.concat([`${func_name}[${iteration}] -`], args);
                        }
                        context[function_key](...args);
                    },
                };
            } else {
                debug.debug = (() => {}); //Fix once TM option chaining works
            }
            return func.apply(debug, args);
        };
        Object.defineProperty(new_func, "name", { value: func_name});
        return new_func;
    });
};

JSPLib.debug.addModuleLogs = function (module_name, func_names) {
    const context = this;
    const module = JSPLib[module_name];
    func_names.forEach((name) => {
        const func = module[name];
        func.iteration = 1;
        module[name] = function (...args) {
            let debug = {};
            if (context.debug_console) {
                let iteration = func.iteration++;
                debug = {
                    debug (...args) {
                        let function_key = 'debug' + args[0];
                        context[function_key](`${module_name}.${name}[${iteration}] -`, ...args.slice(1));
                    },
                };
            } else {
                debug.debug = (() => {}); //Fix once TM option chaining works
            }
            return func.apply(this, [debug].concat(args));
        };
    });
};

JSPLib.debug.addFunctionTimers = function (funclist) {
    let context = this;
    return funclist.map((item) => {
        let func = item;
        let timerFunc = null;
        let nameindex = null;
        if (Array.isArray(item)) {
            if (typeof item[0] === 'function' && item.length > 1 && item.slice(1).every((val) => Number.isInteger(val))) {
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
        let func_type = Object.getPrototypeOf(func).constructor.name;
        if (func_type === 'Function') {
            timerFunc = this.debugSyncTimer;
        } else if (func_type === 'AsyncFunction') {
            timerFunc = this.debugAsyncTimer;
        } else {
            throw "debug.addFunctionTimers: Item has unknown function constructor";
        }
        return timerFunc.apply(context, [func, nameindex]);
    });
};

/****PRIVATE DATA****/

//Variables

JSPLib.debug._records = {};
JSPLib.debug.program_prefix = "";
JSPLib.debug.program_timer = "";

Object.defineProperty(JSPLib.debug, 'program_shortcut', {set(shortcut) {
    let shortcut_upper = shortcut.toUpperCase();
    this.program_prefix = shortcut_upper + ':';
    this.program_timer = shortcut_upper + '-';
}});

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
        this._debugOutput(output_func, ...args.slice(0, -1));
    }
};

JSPLib.debug._getDebugTimerName = function(str) {
    return (this.pretimer ? this.program_timer : "") + str;
};

JSPLib.debug._getFuncName = function (func, args, nameindex) {
    let timer_name = func.name.replace(/^bound /, "");
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
    nonenumerable: [],
    nonwritable: ['_records', 'ALL', 'VERBOSE', 'DEBUG', 'INFO', 'WARNING', 'ERROR']
};
JSPLib.initializeModule('debug');
