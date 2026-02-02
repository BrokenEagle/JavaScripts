/****DEPENDENCIES****/

////Must be included before modules that need debug logging

/****SETUP****/

//Linter configuration
/* global JSPLib */

(function () {

const Debug = JSPLib.Debug = {};

/****PUBLIC VARIABLES****/

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

/****PUBLIC FUNCTIONS****/

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
    if (Debug.mode && (level === null || _levelCheck(level))) {
        func();
    }
};

//Other functions

Debug.getRecords = function () {
    return RECORDS;
};

Debug.createError = function () {
    return (Debug.mode ? new Error() : null);
};

/****PRIVATE FUNCTIONS****/

function _levelCheck(level) {
    return Number.isInteger(level) && level >= Debug.level;
}

function _debugOutput(output_func, args) {
    if (Debug.mode) {
        _consoleOutput(output_func, args);
    }
}

function _debugOutputLevel(output_func, args) {
    if (Debug.mode) {
        let level = args.at(-1);
        if (_levelCheck(level)) {
            _consoleOutput(output_func, args.slice(0, -1));
        }
    }
}

function _consoleOutput(output_func, args) {
    if (Debug.pretext) {
        args.unshift(JSPLib.prefix);
    }
    output_func(...args);
}

function _getDebugTimerName(str) {
    return (Debug.pretimer ? JSPLib.timer : "") + str;
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
    if (/^[0-5]$/.test(stored_value)) {
        return Number(stored_value);
    }
    if (Number.isInteger(set_value) && set_value >= 0 && set_value <= 5) {
        return set_value;
    }
    return original_value;
});

JSPLib.initializeModule('Debug', ['ALL', 'VERBOSE', 'DEBUG', 'INFO', 'WARNING', 'ERROR']);

})();
