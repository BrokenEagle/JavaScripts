/****DEPENDENCIES****/

/**External dependencies**/
// jQuery (optional)

/**Internal dependencies**/
// JSPLib.Debug (optional)
// JSPLib.Utility
// JSPLib.Storage

/****SETUP****/

//Linter configuration
/* global JSPLib */

(function ({jQueryProxy, Debug, Utility, Storage}) {

const Concurrency = JSPLib.Concurrency;

/****PUBLIC VARIABLES****/

Concurrency.process_semaphore_expires = 5 * Utility.one_minute;

/****PUBLIC FUNCTIONS****/

//Semaphore functions

Concurrency.checkSemaphore = function (name) {
    let storage_name = _getSemaphoreName(name, true);
    let semaphore = Storage.getLocalData(storage_name, {default_val: 0, bypass: true});
    return !Utility.validateExpires(semaphore, Concurrency.process_semaphore_expires);
};

Concurrency.freeSemaphore = function (name) {
    let event_name = _getSemaphoreName(name, false);
    let storage_name = _getSemaphoreName(name, true);
    jQueryProxy(JSPLib._window).off('beforeunload.' + event_name);
    Storage.setLocalData(storage_name, 0);
};

Concurrency.reserveSemaphore = function (name) {
    const printer = Debug.getFunctionPrint('Concurrency.reserveSemaphore');
    let display_name = (name ? `[${name}]` : '');
    if (Concurrency.checkSemaphore(name)) {
        printer.logLevel(`Tab got the semaphore ${display_name}!`, Debug.INFO);
        //Guarantee that leaving/closing tab reverts the semaphore
        let event_name = _getSemaphoreName(name, false);
        let storage_name = _getSemaphoreName(name, true);
        jQueryProxy(JSPLib._window).on('beforeunload.' + event_name, () => {
            Storage.setLocalData(storage_name, 0);
        });
        //Set semaphore with an expires in case the program crashes
        let semaphore = Utility.getExpires(Concurrency.process_semaphore_expires);
        Storage.setLocalData(storage_name, semaphore);
        return semaphore;
    }
    printer.logLevel(`Tab missed the semaphore ${display_name}!`, Debug.WARNING);
    return null;
};

//Timeout functions

Concurrency.checkTimeout = function (storage_key, expires_time) {
    let expires = Storage.getLocalData(storage_key, {default_val: 0});
    return !Utility.validateExpires(expires, expires_time);
};

Concurrency.setRecheckTimeout = function (storage_key, expires_time, jitter = null) {
    if (Utility.isNumber(jitter) && jitter < expires_time) {
        expires_time += -Math.random() * jitter;
    }
    let expires_timestamp = Utility.getExpires(expires_time);
    Storage.setLocalData(storage_key, expires_timestamp);
    return expires_timestamp;
};

/****PRIVATE FUNCTIONS****/

function _getSemaphoreName(name, storage = true) {
    return JSPLib.shortcut + (storage ? '-process-semaphore' + (name ? '-' + name : '') : '.semaphore' + (name ? '.' + name : ''));
}

/****INITIALIZATION****/

JSPLib.initializeModule('Concurrency');

})(JSPLib);
