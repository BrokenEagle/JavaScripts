/****DEPENDENCIES****/

/**External dependencies**/
// jQuery (optional)

/**Internal dependencies**/
// JSPLib.utility
// JSPLib.storage

/****SETUP****/

//Linter configuration
/* global JSPLib */

(function (utility, storage) {

const concurrency = JSPLib.concurrency;

/****GLOBAL VARIABLES****/

concurrency.process_semaphore_expires = 5 * 60 * 1000; //5 minutes

/****PRIVATE VARIABLE****/

const OBSERVERS = {};
const NOTIFICATIONS = {};

/****FUNCTIONS****/

//Semaphore functions

concurrency.checkSemaphore = function (name) {
    let storage_name = _getSemaphoreName(name, true);
    let semaphore = storage.getLocalData(storage_name, {default_val: 0, bypass: true});
    return !utility.validateExpires(semaphore, concurrency.process_semaphore_expires);
};

concurrency.freeSemaphore = function (name) {
    let event_name = _getSemaphoreName(name, false);
    let storage_name = _getSemaphoreName(name, true);
    JSPLib._jQuery(JSPLib._window).off('beforeunload.' + event_name);
    storage.setLocalData(storage_name, 0);
};

concurrency.reserveSemaphore = function (name) {
    const printer = JSPLib.debug.getFunctionPrint('concurrency.reserveSemaphore');
    let display_name = (name ? `[${name}]` : '');
    if (concurrency.checkSemaphore(name)) {
        printer.debuglogLevel(`Tab got the semaphore ${display_name}!`, JSPLib.debug.INFO);
        //Guarantee that leaving/closing tab reverts the semaphore
        let event_name = _getSemaphoreName(name, false);
        let storage_name = _getSemaphoreName(name, true);
        JSPLib._jQuery(JSPLib._window).on('beforeunload.' + event_name, () => {
            storage.setLocalData(storage_name, 0);
        });
        //Set semaphore with an expires in case the program crashes
        let semaphore = utility.getExpires(concurrency.process_semaphore_expires);
        storage.setLocalData(storage_name, semaphore);
        return semaphore;
    }
    printer.debuglogLevel(`Tab missed the semaphore ${display_name}!`, JSPLib.debug.WARNING);
    return null;
};

//Timeout functions

concurrency.checkTimeout = function (storage_key, expires_time) {
    let expires = storage.getLocalData(storage_key, {default_val: 0});
    return !utility.validateExpires(expires, expires_time);
};

concurrency.setRecheckTimeout = function (storage_key, expires_time, jitter = null) {
    if (utility.isNumber(jitter) && jitter < expires_time) {
        expires_time += -Math.random() * jitter;
    }
    let expires_timestamp = utility.getExpires(expires_time);
    storage.setLocalData(storage_key, expires_timestamp);
    return expires_timestamp;
};

//Observer functions

//Calls a function when the DOM object of a certain ID or classname of an immediate child gets replaced
concurrency.setupMutationReplaceObserver = function ($root_node, remove_selector, func, disconnect = true) {
    const printer = JSPLib.debug.getFunctionPrint('concurrency.setupMutationReplaceObserver');
    if (typeof $root_node === 'string') {
        $root_node = document.querySelector($root_node);
    }
    let [key, name] = _getSelectorChecks(remove_selector);
    new MutationObserver((mutations, observer) => {
        for (let i = 0; i < mutations.length; i++) {
            let mutation = mutations[i];
            printer.debuglogLevel("Checking mutation:", mutation.type, mutation.removedNodes, JSPLib.debug.VERBOSE);
            if (mutation.type === "childList" && mutation.removedNodes.length === 1) {
                let node = mutation.removedNodes[0];
                printer.debuglogLevel(`Checking removed node: ${key} ${name} "${node[key]}"`, JSPLib.debug.DEBUG);
                if ((key !== 'classname' && name === node[key]) || (node[key].split(' ').includes(name))) {
                    printer.debuglogLevel(`Validated remove: ${remove_selector} has been modified!`, JSPLib.debug.INFO);
                    func(mutation);
                    if (disconnect) {
                        printer.debuglogLevel("Disconnecting observer.", JSPLib.debug.DEBUG);
                        observer.disconnect();
                        return;
                    }
                }
            }
        }
    }).observe($root_node, {
        childList: true,
    });
};

concurrency.whenScrolledIntoView = function (selector, options = {}) {
    const printer = JSPLib.debug.getFunctionPrint('concurrency.whenScrolledIntoView');
    const observer_key = JSON.stringify(options);
    const findNotification = (entry, observer_key) => (NOTIFICATIONS[observer_key].find((notification) => (notification.item === entry.target)));
    NOTIFICATIONS[observer_key] ||= [];
    let item = document.querySelector(selector);
    let check_existing = findNotification(item, observer_key);
    if (check_existing) return check_existing.promise;
    if (!(observer_key in OBSERVERS)) {
        OBSERVERS[observer_key] = new IntersectionObserver((entries, observer) => {
            entries.forEach((entry) => {
                printer.debuglogLevel("Checking intersection:", entry.isIntersecting, entry.target, JSPLib.debug.VERBOSE);
                if (entry.isIntersecting) {
                    let notification = findNotification(entry, observer_key);
                    printer.debuglogLevel("Finding notification:", notification, JSPLib.debug.DEBUG);
                    if (notification) {
                        printer.debuglogLevel("Validated intersection:", notification.selector, JSPLib.debug.INFO);
                        observer.unobserve(notification.item);
                        notification.resolve(true);
                        NOTIFICATIONS[observer_key] = utility.arrayRemove(NOTIFICATIONS[observer_key], notification);
                    }
                }
            });
        }, options);
    }
    let {promise, resolve} = utility.createPromise();
    let notification = {item, promise, resolve};
    NOTIFICATIONS[observer_key].push(notification);
    OBSERVERS[observer_key].observe(item);
    return notification.promise;
};

/****PRIVATE FUNCTIONS****/

function _getSemaphoreName(name, storage = true) {
    return JSPLib.program_shortcut + (storage ? '-process-semaphore' + (name ? '-' + name : '') : '.semaphore' + (name ? '.' + name : ''));
}

function _getSelectorChecks(selector) {
    let key = "";
    let type = selector.slice(0, 1);
    let name = selector.slice(1);
    switch (type) {
        case '.':
            key = 'className';
            break;
        case '#':
            key = (name === '#text' ? 'nodeName' : 'id');
            break;
        default:
            key = 'tagName';
            name = selector.toUpperCase();
    }
    return [key, name];
}

/****INITIALIZATION****/

JSPLib.initializeModule('concurrency');

})(JSPLib.utility, JSPLib.storage);
