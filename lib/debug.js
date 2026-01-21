/****DEPENDENCIES****/

////Must be included before modules that need debug logging

/****SETUP****/

//Linter configuration
/* global JSPLib */

(function () {

const debug = JSPLib.debug;

/****GLOBAL VARIABLES****/

debug.line = false;
debug.pretext = true;
debug.pretimer = true;

debug.ALL = 0;
debug.VERBOSE = 1;
debug.DEBUG = 2;
debug.INFO = 3;
debug.WARNING = 4;
debug.ERROR = 5;

debug._records = {};

/****FUNCTIONS****/

//Debug output functions

debug.debuglog = function (...args) {
    _debugOutput(console.log, args);
};

debug.debugwarn = function (...args) {
    _debugOutput(console.warn, args);
};

debug.debugerror = function (...args) {
    _debugOutput(console.error, args);
};

debug.debuglogLevel = function (...args) {
    _debugOutputLevel(console.log, args);
};

debug.debugwarnLevel = function (...args) {
    _debugOutputLevel(console.warn, args);
};

debug.debugerrorLevel = function (...args) {
    _debugOutputLevel(console.error, args);
};

debug.getFunctionPrint = function (func_name) {
    debug._func_printer ??= {};
    if (!debug._func_printer[func_name]) {
        let printer = {};
        if (debug.mode) {
            debug._func_iteration ??= {};
            debug._func_iteration[func_name] = 0;
            ['debuglog', 'debugwarn', 'debugerror', 'debuglogLevel', 'debugwarnLevel', 'debugerrorLevel'].forEach((debugfunc) => {
                printer[debugfunc] = function (...args) {
                    let iteration = debug._func_iteration[func_name];
                    debug[debugfunc](`${func_name}[${iteration}] -`, ...args);
                };
            });
        } else {
            ['debuglog', 'debugwarn', 'debugerror', 'debuglogLevel', 'debugwarnLevel', 'debugerrorLevel'].forEach((debugfunc) => {
                printer[debugfunc] = (() => {});
            });
        }
        debug._func_printer[func_name] = printer;
    } else if (debug.mode) {
        debug._func_iteration[func_name]++;
    }
    return debug._func_printer[func_name];
};

//Timing functions

debug.debugTime = function (str) {
    if (debug.mode) {
        console.time(_getDebugTimerName(str));
    }
};

debug.debugTimeEnd = function (str) {
    if (debug.mode) {
        console.timeEnd(_getDebugTimerName(str));
    }
};

//Data recording functions

debug.recordTime = function (entryname, type) {
    if (debug.mode) {
        let index = entryname + ',' + type;
        debug._records[index] = {
            entryname,
            type,
            starttime: performance.now(),
            endtime: 0};
    }
};

debug.recordTimeEnd = function (entryname, type) {
    if (debug.mode) {
        let index = entryname + ',' + type;
        if (!(index in debug._records)) {
            return;
        }
        if (debug._records[index].endtime === 0) {
            debug._records[index].endtime = performance.now();
        }
    }
};

//Execute functions

debug.debugExecute = function (func, level = null) {
    let execute_level = level ?? debug.level;
    if (debug.mode && Number.isInteger(execute_level) && execute_level >= debug.level) {
        func();
    }
};

//Timer functions

debug.debugTimer = function (func, nameindex) {
    let func_type = Object.getPrototypeOf(func).constructor.name;
    if (func_type !== 'Function' || func_type !== 'AsyncFunction') {
        throw "debug.debugTimer: Item has unknown function constructor";
    }
    let func_name = func.name.replace(/^bound /, "");
    let retfunc = function(...args) {
        var timer_name;
        if (debug.mode) {
            timer_name = _getFuncName(func_name, args, nameindex);
            debug.debugTime(timer_name);
        }
        let ret = func(...args);
        if (debug.mode) {
            if (func_type === 'Function') {
                debug.debugTimeEnd(timer_name);
            } else {
                ret.then(() => {
                    debug.debugTimeEnd(timer_name);
                });
            }
        }
        return ret;
    };
    Object.defineProperty(retfunc, 'name', {value: func_name});
    return retfunc;
};

//Other functions

debug.createError = function () {
    return (debug.mode ? new Error() : null);
};

/****PRIVATE FUNCTIONS****/

function _debugOutput(output_func, args) {
    if (debug.mode) {
        _consoleOutput(output_func, args);
    }
}

function _debugOutputLevel(output_func, args) {
    if (debug.mode) {
        let level = args.at(-1);
        if (Number.isInteger(level) && level >= debug.level) {
            _consoleOutput(output_func, args.slice(0, -1));
        }
    }
}

function _consoleOutput(output_func, args) {
    if (typeof args[0] === 'function') {
        args = args[0]();
    }
    if (debug.line) {
        let caller_line = (new Error).stack.split('\n')[4];
        let match = caller_line.match(/\d+:(\d+)/);
        if (match) {
            args.unshift('[' + match[1] + ']');
        }
    }
    if (debug.pretext) {
        args.unshift(JSPLib.program_prefix);
    }
    output_func(...args);
}

function _getDebugTimerName(str) {
    return (debug.pretimer ? JSPLib.program_timer : "") + str;
}

function _getFuncName(func_name, args, nameindex) {
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
}

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

JSPLib.initializeModule('debug', {
    nonwritable: ['_records', 'ALL', 'VERBOSE', 'DEBUG', 'INFO', 'WARNING', 'ERROR']
});

})();
