/****DEPENDENCIES****/

/**External dependencies**/
// jQuery (optional)
// JSPLib.utility
// JSPLib.storage

/****SETUP****/

//Linter configuration
/* global JSPLib jQuery */

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
    let storage_name = this._getSemaphoreName(program_shortcut,name,true);
    let semaphore = JSPLib.storage.getStorageData(storage_name,localStorage,0);
    return !JSPLib.utility.validateExpires(semaphore, this.process_semaphore_expires);
};

JSPLib.concurrency.freeSemaphore = function (program_shortcut,name) {
    let event_name = this._getSemaphoreName(program_shortcut,name,false);
    let storage_name = this._getSemaphoreName(program_shortcut,name,true);
    typeof jQuery !== 'undefined' && jQuery(window).off('beforeunload.'+event_name);
    JSPLib.storage.setStorageData(storage_name,0,localStorage);
};

JSPLib.concurrency.reserveSemaphore = function (program_shortcut,name) {
    let display_name = (name ? `[${name}]` : '');
    if (this.checkSemaphore(program_shortcut,name)) {
        JSPLib.debug.debuglogLevel(`concurrency.reserveSemaphore - Tab got the semaphore ${display_name}!`,JSPLib.debug.INFO);
        //Guarantee that leaving/closing tab reverts the semaphore
        let event_name = this._getSemaphoreName(program_shortcut,name,false);
        let storage_name = this._getSemaphoreName(program_shortcut,name,true);
        typeof jQuery !== 'undefined' && jQuery(window).on('beforeunload.'+event_name,function () {
            JSPLib.storage.setStorageData(storage_name,0,localStorage);
        });
        //Set semaphore with an expires in case the program crashes
        let semaphore = JSPLib.utility.getExpires(this.process_semaphore_expires);
        JSPLib.storage.setStorageData(storage_name, semaphore, localStorage);
        return semaphore;
    }
    JSPLib.debug.debuglogLevel(`concurrency.reserveSemaphore - Tab missed the semaphore ${display_name}!`,JSPLib.debug.WARNING);
    return null;
};

//Timeout functions

JSPLib.concurrency.checkTimeout = function (storage_key,expires_time,storage=localStorage) {
    let expires = JSPLib.storage.getStorageData(storage_key,storage,0);
    return !JSPLib.utility.validateExpires(expires,expires_time);
};

JSPLib.concurrency.setRecheckTimeout = function (storage_key,expires_time,storage=localStorage) {
    JSPLib.storage.setStorageData(storage_key,JSPLib.utility.getExpires(expires_time),storage);
};

/****PRIVATE DATA****/

//Functions

JSPLib.concurrency._getSemaphoreName = function (program_shortcut,name,storage=true) {
    if (storage) {
        return program_shortcut + '-process-semaphore' + (name ? '-' + name : '');
    } else {
        return program_shortcut + '.semaphore' + (name ? '.' + name : '');
    }
};

/****INITIALIZATION****/

JSPLib.concurrency._configuration = {
    nonenumerable: ['_getSemaphoreName','_configuration'],
    nonwritable: ['_configuration']
};
Object.defineProperty(JSPLib,'concurrency',{configurable:false,writable:false});
for (let property in JSPLib.concurrency) {
    if (JSPLib.concurrency._configuration.nonenumerable.includes(property)) {
        Object.defineProperty(JSPLib.concurrency,property,{enumerable:false});
    }
    if (JSPLib.concurrency._configuration.nonwritable.includes(property)) {
        Object.defineProperty(JSPLib.concurrency,property,{writable:false});
    }
    Object.defineProperty(JSPLib.concurrency,property,{configurable:false});
}
