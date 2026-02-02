/****DEPENDENCIES****/

/**Internal dependencies**/
// JSPLib.Debug (optional)
// JSPLib.Utility
// JSPLib.Storage

/****SETUP****/

//Linter configuration
/* global JSPLib */

(function ({Debug, Utility, Storage}) {

const Load = JSPLib.Load;

/****PRIVATE VARIABLES****/

const PROGRAM_LOAD_RETRIES = {};
const PROGRAM_LOAD_TIMERS = {};

var PROGRAM_LOAD_ID = 0;
const DEFAULT_TIMER_INTERVAL = 100;
const DEFAULT_DELAY_DURATION = Utility.one_minute;
const DEFAULT_MAX_RETRIES = 50;

var SCRIPT_ENABLED = null;

/****PUBLIC FUNCTIONS****/

Load.programInitialize = function (entry_func, {function_name = null, required_variables = [], required_selectors = [], optional_selectors = [], max_retries = DEFAULT_MAX_RETRIES, timer_interval = DEFAULT_TIMER_INTERVAL, load_when_hidden = true} = {}) {
    const printer = Debug.getFunctionPrint('Load.programInitialize');
    if (JSPLib.name && function_name === null) {
        if (JSPLib._window_jsp.program[JSPLib.name]) {
            printer.debugwarn(`${JSPLib.name} already loaded.`);
            return;
        }
        JSPLib._window_jsp.program[JSPLib.name] = {
            version: JSPLib._gm_info.script.version,
            start: Date.now(),
        };
        JSPLib._window_jsp.info.scripts.push({
            program_name: JSPLib.name,
            load_start: performance.now(),
        });
        Debug.execute(() => {
            JSPLib._window_jsp.program[JSPLib.name].info = JSPLib._gm_info;
        });
    }
    let initialize_name = function_name ?? JSPLib.name;
    if (typeof initialize_name !== 'string') {
        printer.logLevel("No name program/function name passed in!", Debug.ERROR);
        return;
    }
    PROGRAM_LOAD_RETRIES[initialize_name] = 0;
    let load_id = PROGRAM_LOAD_ID++;
    Debug.time(load_id + "-programLoad");
    PROGRAM_LOAD_TIMERS[initialize_name] = Utility.initializeInterval(() => {
        if (!load_when_hidden && document.hidden) {
            return false;
        }
        return _programLoad(entry_func, initialize_name, required_variables, required_selectors, optional_selectors, max_retries, load_id);
    }, timer_interval);
};

Load.noncriticalTasks = function (delay_func, {delay_duration = DEFAULT_DELAY_DURATION} = {}) {
    let adjusted_delay_duration = delay_duration + ((0.5 - Math.random()) * (delay_duration / 4)); // Have up to a 25% swing to avoid processing all scripts at once
    setTimeout(() => {delay_func();}, adjusted_delay_duration);
};

Load.exportData = function ({other_data = null, read_list = [], write_list = []} = {}) {
    Debug.execute(() => {
        JSPLib._window_jsp.lib ??= {};
        JSPLib._window_jsp.lib[JSPLib.name] = JSPLib;
        JSPLib._window_jsp.value ??= {};
        JSPLib._window_jsp.value[JSPLib.name] = JSPLib.data;
        JSPLib._window_jsp.other ??= {};
        JSPLib._window_jsp.other[JSPLib.name] = other_data;
    });
    JSPLib._window_jsp.exports[JSPLib.name] ??= {};
    read_list.forEach((name) => {
        Object.defineProperty(JSPLib._window_jsp.exports[JSPLib.name], name, {get: () => JSPLib.data[name]});
    });
    write_list.forEach((name) => {
        Object.defineProperty(JSPLib._window_jsp.exports[JSPLib.name], name, {get: () => JSPLib.data[name], set: (val) => {JSPLib.data[name] = val;}});
    });
};

Load.exportFuncs = function ({debug_list = [], always_list = []} = {}) {
    JSPLib._window_jsp.exports[JSPLib.name] = JSPLib._window_jsp.exports[JSPLib.name] || {};
    let funclist = always_list;
    Debug.execute(() => {
        funclist = Utility.concat(funclist, debug_list);
    });
    funclist.forEach((func) => {
        JSPLib._window_jsp.exports[JSPLib.name][func.name] = func;
    });
};

Load.setProgramGetter = function (program_value, other_program_key, other_program_name, min_version = null) {
    Object.defineProperty(program_value, other_program_key, { get() {return JSPLib._window_jsp.exports[other_program_name] ?? {};}});
    Object.defineProperty(program_value, 'has_' + other_program_key, { get() {return other_program_name in JSPLib._window_jsp.program;}});
    if (min_version !== null) {
        Object.defineProperty(program_value, other_program_key + '_version', { get() {return Number(JSPLib._window_jsp.program[other_program_name].version);}});
        Object.defineProperty(program_value, 'use_' + other_program_key, { get() {return program_value['has_' + other_program_key] && program_value[other_program_key + '_version'] >= min_version;}});
    }
};

Load.scriptWaitExecute = function (program_data, other_program_key, {version = true, available = null, fallback = null, interval = 500, duration = Utility.one_second * 5}) {
    //For script dependent code which may used at the beginning of program execution
    Utility.recheckInterval({
        check: () => (version && program_data['use_' + other_program_key] || !version && program_data['has_' + other_program_key]),
        success: available,
        fail: fallback,
        interval,
        duration,
    });
};

Load.isScriptEnabled = function () {
    if (SCRIPT_ENABLED === null) {
        let domains = Utility.readCookie(JSPLib.name);
        if (!domains) {
            SCRIPT_ENABLED = true;
        } else if (domains === 'none') {
            SCRIPT_ENABLED = false;
        } else{
            SCRIPT_ENABLED = domains.split(',').includes(JSPLib._current_subdomain);
        }
    }
    return SCRIPT_ENABLED;
};

Load.preloadScript = function ({broadcast_func = null, program_css = null, light_css = null, dark_css = null, danbooru_userscript = true} = {}) {
    const printer = Debug.getFunctionPrint('Load.preloadScript');
    JSPLib.data.user_settings = _loadUserSettings();
    for (let key in JSPLib.data.user_settings) {
        Object.defineProperty(JSPLib.data, key, {get() {return JSPLib.data.user_settings[key];}});
    }
    let danbooru_dataset = {};
    if (danbooru_userscript) {
        if (!Load.isScriptEnabled()) {
            printer.logLevel("Script is disabled on", JSPLib._window.location.hostname, Debug.INFO);
            return;
        }
        danbooru_dataset = {
            controller: document.body.dataset.controller,
            action: document.body.dataset.action,
        };
    }
    Utility.assignObjects(
        JSPLib.data,
        Utility.deepCopy(JSPLib.default_data),
        Utility.deepCopy(JSPLib.reset_data),
        danbooru_dataset,
    );
    if (typeof broadcast_func == 'function') {
        JSPLib.data.channel = Utility.createBroadcastChannel(JSPLib.name, broadcast_func);
    }
    if (program_css) {
        Utility.setCSSStyle(program_css, 'program');
    }
    if (light_css) {
        Utility.setCSSStyle(light_css, 'light');
    }
    if (dark_css) {
        Utility.setCSSStyle(dark_css, 'dark');
    }
};

/****PRIVATE FUNCTIONS****/

function _programLoad(entry_func, initialize_name, required_variables, required_selectors, optional_selectors, max_retries, load_id) {
    const printer = Debug.getFunctionPrint('Load.programLoad');
    if ((PROGRAM_LOAD_RETRIES[initialize_name] > max_retries) && (PROGRAM_LOAD_RETRIES[initialize_name] !== 0)) {
        printer.logLevel(initialize_name, "Abandoning program load!", Debug.WARNING);
        clearInterval(PROGRAM_LOAD_TIMERS[initialize_name]);
        PROGRAM_LOAD_TIMERS[initialize_name] = false;
        Debug.timeEnd(load_id + "-programLoad");
        return false;
    }
    const required_variables_installed = required_variables.length === 0 || required_variables.every((name) => _isVariableDefined(name));
    if (!required_variables_installed) {
        printer.logLevel(initialize_name, "required variables", required_variables.join(', ') + " not installed yet.", Debug.DEBUG);
        PROGRAM_LOAD_RETRIES[initialize_name]++;
        return false;
    }
    const required_selectors_installed = required_selectors.length === 0 || required_selectors.every((selector) => document.querySelector(selector));
    if (!required_selectors_installed) {
        printer.logLevel(initialize_name, "required selectors", required_selectors.join(', ') + " not installed yet.", Debug.DEBUG);
        PROGRAM_LOAD_RETRIES[initialize_name]++;
        return false;
    }
    const optional_installed = optional_selectors.length === 0 || optional_selectors.some((selector) => document.querySelector(selector));
    if (!optional_installed) {
        printer.logLevel(initialize_name, "optional selectors", optional_selectors.join(', ') + " not installed yet.", Debug.DEBUG);
        PROGRAM_LOAD_RETRIES[initialize_name]++;
        return false;
    }
    clearInterval(PROGRAM_LOAD_TIMERS[initialize_name]);
    PROGRAM_LOAD_TIMERS[initialize_name] = true;
    printer.log(`Initialize start [${initialize_name}]:`, Utility.getProgramTime());
    entry_func();
    Debug.timeEnd(load_id + "-programLoad");
    return true;
}

function _loadUserSettings() {
    const printer = Debug.getFunctionPrint('Load.loadUserSettings');
    let config = JSPLib.settings_config;
    let settings = Storage.getLocalData(`${JSPLib.shortcut}-user-settings`, {default_val: {}});
    let dirty = false;
    if (Utility.isArray(JSPLib.settings_migrations)) {
        JSPLib.settings_migrations.forEach((migration) => {
            if (config[migration.to].validate((settings[migration.from]))) {
                printer.logLevel("Migrating setting: ", migration.from, "->", migration.to, Debug.INFO);
                settings[migration.to] = settings[migration.from];
                delete settings[migration.from];
                dirty = true;
            }
        });
    }
    if (!Utility.isHash(settings)) {
        printer.warnLevel("User settings are not a hash!", Debug.ERROR);
        settings = {};
    }
    let errors = _validateUserSettings(settings);
    if (errors.length) {
        printer.logLevel("Errors found:\n", errors.join('\n'), Debug.WARNING);
        dirty = true;
    }
    if (dirty) {
        printer.logLevel("Saving updated changes to user settings!", Debug.INFO);
        Storage.setLocalData(`${JSPLib.shortcut}-user-settings`, settings);
    }
    printer.logLevel("Returning settings:", settings, Debug.DEBUG);
    return settings;
}

function _validateUserSettings(settings) {
    const printer = Debug.getFunctionPrint('Load.validateUserSettings');
    let error_messages = [];
    //This check is for validating settings through the cache editor
    if (!Utility.isHash(settings)) {
        return ["User settings are not a hash."];
    }
    let config = JSPLib.settings_config;
    for (let setting in config) {
        if (!(setting in settings) || !config[setting].validate(settings[setting])) {
            if (!(setting in settings)) {
                error_messages.push(`'${setting}' setting not found.`);
            } else {
                error_messages.push(`'${setting}' contains invalid data.`);
            }
            let old_setting = settings[setting];
            let message = "";
            if (Utility.isArray(config[setting].allitems) && Utility.isArray(settings[setting]) && !config[setting].sortvalue) {
                settings[setting] = Utility.arrayIntersection(config[setting].allitems, settings[setting]);
                message = "Removing bad items";
            } else {
                settings[setting] = config[setting].reset;
                message = "Loading default";
            }
            printer.logLevel(`${message}:`, setting, old_setting, "->", settings[setting], Debug.WARNING);
        }
    }
    let valid_settings = Object.keys(config);
    for (let setting in settings) {
        if (!valid_settings.includes(setting)) {
            printer.logLevel("Deleting invalid setting:", setting, settings[setting], Debug.WARNING);
            delete settings[setting];
            error_messages.push(`'${setting}' is an invalid setting.`);
        }
    }
    return error_messages;
}

function _isVariableDefined(variable_name) {
    let variable_hierarchy = variable_name.split('.');
    if (variable_hierarchy[0] === 'window') {
        variable_hierarchy.shift();
    }
    let curr_obj = JSPLib._window;
    for (let i = 0;i < variable_hierarchy.length;i++) {
        if (!(variable_hierarchy[i] in curr_obj)) {
            return false;
        }
        curr_obj = curr_obj[variable_hierarchy[i]];
        if ((typeof curr_obj !== 'object' || curr_obj == null) && (i < (variable_hierarchy.length - 1))) {
            return false;
        }
    }
    return true;
}

/****INITIALIZATION****/

JSPLib.initializeModule('load');

})(JSPLib);
