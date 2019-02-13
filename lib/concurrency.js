/****DEPENDENCIES****/

/**External dependencies**/
// jQuery (optional)
// JSPLib.storage

/****SETUP****/

var JSPLib = JSPLib || {};
JSPLib.concurrency = JSPLib.concurrency || {};

//Has debug.js been loaded?
JSPLib.debug = JSPLib.debug || {};
JSPLib.debug.debuglogLevel = JSPLib.debug.debuglogLevel || (()=>{});

/****GLOBAL VARIABLES****/

JSPLib.concurrency.process_semaphore_expires = 5 * 60 * 1000;

/****FUNCTIONS****/

//Semaphore functions

JSPLib.concurrency.checkSemaphore = function (program_shortcut,name) {
    let storage_name = JSPLib.concurrency.getSemaphoreName(program_shortcut,name,true);
    let semaphore = JSPLib.storage.getStorageData(storage_name,localStorage,0);
    return !JSPLib.concurrency._validateExpires(semaphore, JSPLib.concurrency.process_semaphore_expires);
};

JSPLib.concurrency.freeSemaphore = function (program_shortcut,name) {
    let event_name = JSPLib.concurrency.getSemaphoreName(program_shortcut,name,false);
    let storage_name = JSPLib.concurrency.getSemaphoreName(program_shortcut,name,true);
    window.jQuery && jQuery(window).off('beforeunload.'+event_name);
    JSPLib.storage.setStorageData(storage_name,0,localStorage);
};

JSPLib.concurrency.reserveSemaphore = function (program_shortcut,name) {
    let display_name = (name ? `[${name}]` : '');
    if (JSPLib.concurrency.checkSemaphore(program_shortcut,name)) {
        JSPLib.debug.debuglogLevel(`Tab got the semaphore ${display_name}!`,JSPLib.debug.INFO);
        //Guarantee that leaving/closing tab reverts the semaphore
        let event_name = JSPLib.concurrency.getSemaphoreName(program_shortcut,name,false);
        let storage_name = JSPLib.concurrency.getSemaphoreName(program_shortcut,name,true);
        window.jQuery && jQuery(window).on('beforeunload.'+event_name,function () {
            JSPLib.storage.setStorageData(storage_name,0,localStorage);
        });
        //Set semaphore with an expires in case the program crashes
        let semaphore = JSPLib.concurrency._getExpiration(JSPLib.concurrency.process_semaphore_expires);
        JSPLib.storage.setStorageData(storage_name, semaphore, localStorage);
        return semaphore;
    }
    JSPLib.debug.debuglogLevel(`Tab missed the semaphore ${display_name}!`,JSPLib.debug.WARNING);
    return null;
};

//Timeout functions

JSPLib.concurrency.checkTimeout = function (storage_key,expires_time) {
    let expires = JSPLib.storage.getStorageData(storage_key,localStorage,0);
    return !JSPLib.concurrency._validateExpires(expires,expires_time);
};

JSPLib.concurrency.setRecheckTimeout = function (storage_key,expires_time) {
    JSPLib.storage.setStorageData(storage_key,JSPLib.concurrency._getExpiration(expires_time),localStorage);
};

//Helper functions

JSPLib.concurrency.getSemaphoreName = function (program_shortcut,name,storage=true) {
    if (storage) {
        return program_shortcut + '-process-semaphore' + (name ? '-' + name : '');
    } else {
        return program_shortcut + '.semaphore' + (name ? '.' + name : '');
    }
};

//Private functions

JSPLib.concurrency._validateExpires = function (actual_expires,expected_expires) {
    //Resolve to false if the actual_expires is bogus, has expired, or the expiration is too long
    return Number.isInteger(actual_expires) && (Date.now() <= actual_expires) && (!Number.isInteger(expected_expires) || ((actual_expires - Date.now()) <= expected_expires));
};

JSPLib.concurrency._getExpiration = function (expires) {
    return Date.now() + expires;
}
