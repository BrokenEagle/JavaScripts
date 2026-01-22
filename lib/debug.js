/****DEPENDENCIES****/

////Must be included before modules that need debug logging

/****SETUP****/

//Linter configuration
/* global JSPLib */

(function () {

const Debug = JSPLib.Debug;

/****GLOBAL VARIABLES****/

Debug.line = false;
Debug.pretext = true;
Debug.pretimer = true;

Debug.ALL = 0;
Debug.VERBOSE = 1;
Debug.DEBUG = 2;
Debug.INFO = 3;
Debug.WARNING = 4;
Debug.ERROR = 5;

/****PRIVATE VARIABLES****/

const FUNC_PRINTER = {};
const FUNC_STUB = {};
const FUNC_ITERATION = {};

const FUNC_NAMES = ['log', 'warn', 'error', 'logLevel', 'warnLevel', 'errorLevel'];

const RECORDS = {};

/****FUNCTIONS****/

//Debug output functions

Debug.log = function (...args) {
    _debugOutput(console.log, args);
};

Debug.warn = function (...args) {
    _debugOutput(console.warn, args);
};

Debug.error = function (...args) {
    _debugOutput(console.error, args);
};

Debug.logLevel = function (...args) {
    _debugOutputLevel(console.log, args);
};

Debug.warnLevel = function (...args) {
    _debugOutputLevel(console.warn, args);
};

Debug.errorLevel = function (...args) {
    _debugOutputLevel(console.error, args);
};

Debug.getFunctionPrint = function (func_name, stub = false) {
    if (Debug.mode && !stub) {
        if (!FUNC_PRINTER[func_name]) {
            let printer = {};
            FUNC_ITERATION[func_name] = 0;
            FUNC_NAMES.forEach((debugfunc) => {
                printer[debugfunc] = function (...args) {
                    let iteration = FUNC_ITERATION[func_name];
                    Debug[debugfunc](`${func_name}[${iteration}] -`, ...args);
                };
            });
            FUNC_PRINTER[func_name] = printer;
        }
        FUNC_ITERATION[func_name]++;
        return FUNC_PRINTER[func_name];
    }
    if (!FUNC_STUB[func_name]) {
        let printer = {};
        FUNC_NAMES.forEach((debugfunc) => {
            printer[debugfunc] = (() => {});
        });
        FUNC_STUB[func_name] = printer;
    }
    return FUNC_STUB[func_name];
};

//Timing functions

Debug.time = function (str) {
    if (Debug.mode) {
        console.time(_getDebugTimerName(str));
    }
};

Debug.timeEnd = function (str) {
    if (Debug.mode) {
        console.timeEnd(_getDebugTimerName(str));
    }
};

//Data recording functions

Debug.recordTime = function (entryname, type) {
    if (Debug.mode) {
        let index = entryname + ',' + type;
        RECORDS[index] = {
            entryname,
            type,
            starttime: performance.now(),
            endtime: 0};
    }
};

Debug.recordTimeEnd = function (entryname, type) {
    if (Debug.mode) {
        let index = entryname + ',' + type;
        if (!(index in RECORDS)) {
            return;
        }
        if (RECORDS[index].endtime === 0) {
            RECORDS[index].endtime = performance.now();
        }
    }
};

//Execute functions

Debug.execute = function (func, level = null) {
    let execute_level = level ?? Debug.level;
    if (Debug.mode && Number.isInteger(execute_level) && execute_level >= Debug.level) {
        func();
    }
};

//Timer functions

Debug.timer = function (func, nameindex) {
    let func_type = Object.getPrototypeOf(func).constructor.name;
    if (func_type !== 'Function' || func_type !== 'AsyncFunction') {
        throw new Error("Item has unknown function constructor");
    }
    let func_name = func.name.replace(/^bound /, "");
    let retfunc = function(...args) {
        var timer_name;
        if (Debug.mode) {
            timer_name = _getFuncName(func_name, args, nameindex);
            Debug.time(timer_name);
        }
        let ret = func(...args);
        if (Debug.mode) {
            if (func_type === 'Function') {
                Debug.timeEnd(timer_name);
            } else {
                ret.then(() => {
                    Debug.timeEnd(timer_name);
                });
            }
        }
        return ret;
    };
    Object.defineProperty(retfunc, 'name', {value: func_name});
    return retfunc;
};

//Other functions

Debug.getRecords = function () {
    return RECORDS;
};

Debug.createError = function () {
    return (Debug.mode ? new Error() : null);
};

/****PRIVATE FUNCTIONS****/

function _debugOutput(output_func, args) {
    if (Debug.mode) {
        _consoleOutput(output_func, args);
    }
}

function _debugOutputLevel(output_func, args) {
    if (Debug.mode) {
        let level = args.at(-1);
        if (Number.isInteger(level) && level >= Debug.level) {
            _consoleOutput(output_func, args.slice(0, -1));
        }
    }
}

function _consoleOutput(output_func, args) {
    if (typeof args[0] === 'function') {
        args = args[0]();
        if (args === undefined) return;
    }
    if (Debug.line) {
        let caller_line = (new Error).stack.split('\n')[4];
        let match = caller_line.match(/\d+:(\d+)/);
        if (match) {
            args.unshift('[' + match[1] + ']');
        }
    }
    if (Debug.pretext) {
        args.unshift(JSPLib.prefix);
    }
    output_func(...args);
}

function _getDebugTimerName(str) {
    return (Debug.pretimer ? JSPLib.timer : "") + str;
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

JSPLib.initializeModuleProperty('Debug', 'mode', false, (set_value, stored_value, original_value) => {
    switch (stored_value) {
        case 'true':
            return true;
        case 'false':
            return false;
        default:
            return (typeof set_value === 'boolean' ? set_value : original_value);
    }
});

JSPLib.initializeModuleProperty('Debug', 'level', 0, (set_value, stored_value, original_value) => {
    if (/^[0-5]$/.test(set_value)) {
        return Number(set_value);
    }
    if (Number.isInteger(stored_value) && stored_value >= 0 && stored_value <= 5) {
        return stored_value;
    }
    return original_value;
});

JSPLib.initializeModule('Debug', {
    nonwritable: ['ALL', 'VERBOSE', 'DEBUG', 'INFO', 'WARNING', 'ERROR']
});

})();
