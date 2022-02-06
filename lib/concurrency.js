/****DEPENDENCIES****/

/**External dependencies**/
// jQuery (optional)

/**Internal dependencies**/
// JSPLib.utility
// JSPLib.storage

/****SETUP****/

//Linter configuration
/* global JSPLib */

JSPLib.concurrency = {};

/****GLOBAL VARIABLES****/

JSPLib.concurrency.process_semaphore_expires = 5 * 60 * 1000; //5 minutes

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
    JSPLib._jQuery(window).off('beforeunload.'+event_name);
    JSPLib.storage.setStorageData(storage_name,0,localStorage);
};

JSPLib.concurrency.reserveSemaphore = function (self,program_shortcut,name) {
    let display_name = (name ? `[${name}]` : '');
    if (this.checkSemaphore(program_shortcut,name)) {
        self.debug('logLevel',`Tab got the semaphore ${display_name}!`,JSPLib.debug.INFO);
        //Guarantee that leaving/closing tab reverts the semaphore
        let event_name = this._getSemaphoreName(program_shortcut,name,false);
        let storage_name = this._getSemaphoreName(program_shortcut,name,true);
        JSPLib._jQuery(window).on('beforeunload.'+event_name,function () {
            JSPLib.storage.setStorageData(storage_name,0,localStorage);
        });
        //Set semaphore with an expires in case the program crashes
        let semaphore = JSPLib.utility.getExpires(this.process_semaphore_expires);
        JSPLib.storage.setStorageData(storage_name, semaphore, localStorage);
        return semaphore;
    }
    self.debug('logLevel',`Tab missed the semaphore ${display_name}!`,JSPLib.debug.WARNING);
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

//Mutation observer functions

//Calls a function when the DOM object of a certain ID or classname of an immediate child gets replaced
JSPLib.concurrency.setupMutationReplaceObserver = function (self,$root_node,remove_selector,func,disconnect=true) {
    if (typeof $root_node === 'string') {
        $root_node = document.querySelector($root_node);
    }
    let [key,name] = this._getSelectorChecks(remove_selector);
    new MutationObserver(function(mutations,observer) {
        mutations.forEach(function(mutation) {
            self.debug('logLevel',"Checking mutation:",mutation.type,mutation.removedNodes,JSPLib.debug.VERBOSE);
            if (mutation.type == "childList" && mutation.removedNodes.length === 1) {
                let node = mutation.removedNodes[0];
                self.debug('logLevel',`Checking removed node: ${key} ${name} "${node[key]}"`,JSPLib.debug.DEBUG);
                if (name == node[key]) {
                    self.debug('logLevel',`Validated remove: ${remove_selector} has been modified!`,JSPLib.debug.INFO);
                    func(mutation);
                    if (disconnect) {
                        observer.disconnect();
                    }
                }
            }
        });
    }).observe($root_node, {
        childList: true
    });
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

JSPLib.concurrency._getSelectorChecks = function (selector) {
    let key = "";
    let type = selector.slice(0,1);
    let name = selector.slice(1);
    switch (type) {
        case '.':
            key = 'className'
            break;
        case '#':
            key = (name === '#text' ? 'nodeName' : 'id');
            break;
        default:
            key = 'tagName';
            name = selector.toUpperCase();
    }
    return [key,name];
};

/****INITIALIZATION****/

JSPLib.concurrency._configuration = {
    nonenumerable: ['_getSemaphoreName','_getSelectorChecks','_configuration'],
    nonwritable: ['_configuration']
};
JSPLib.initializeModule('concurrency');
JSPLib.debug.addModuleLogs('concurrency',['reserveSemaphore','setupMutationReplaceObserver']);
