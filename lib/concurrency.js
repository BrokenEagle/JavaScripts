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

/****GLOBAL VARIABLES****/

Concurrency.process_semaphore_expires = 5 * 60 * 1000; //5 minutes

/****PRIVATE VARIABLE****/

const OBSERVERS = {};
const NOTIFICATIONS = {};

/****FUNCTIONS****/

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

//Observer functions

//Calls a function when the DOM object of a certain ID or classname of an immediate child gets replaced
Concurrency.setupMutationReplaceObserver = function ($root_node, remove_selector, func, disconnect = true) {
    const printer = Debug.getFunctionPrint('Concurrency.setupMutationReplaceObserver');
    if (typeof $root_node === 'string') {
        $root_node = document.querySelector($root_node);
    }
    let [key, name] = _getSelectorChecks(remove_selector);
    new MutationObserver((mutations, observer) => {
        for (let i = 0; i < mutations.length; i++) {
            let mutation = mutations[i];
            printer.logLevel("Checking mutation:", mutation.type, mutation.removedNodes, Debug.VERBOSE);
            if (mutation.type === "childList" && mutation.removedNodes.length === 1) {
                let node = mutation.removedNodes[0];
                printer.logLevel(`Checking removed node: ${key} ${name} "${node[key]}"`, Debug.DEBUG);
                if ((key !== 'classname' && name === node[key]) || (node[key].split(' ').includes(name))) {
                    printer.logLevel(`Validated remove: ${remove_selector} has been modified!`, Debug.INFO);
                    func(mutation);
                    if (disconnect) {
                        printer.logLevel("Disconnecting observer.", Debug.DEBUG);
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

Concurrency.whenScrolledIntoView = function (selector, options = {}) {
    const printer = Debug.getFunctionPrint('Concurrency.whenScrolledIntoView');
    const observer_key = JSON.stringify(options);
    const findNotification = (entry, observer_key) => (NOTIFICATIONS[observer_key].find((notification) => (notification.item === entry.target)));
    NOTIFICATIONS[observer_key] ??= [];
    let item = document.querySelector(selector);
    let check_existing = findNotification(item, observer_key);
    if (check_existing) return check_existing.promise;
    if (!(observer_key in OBSERVERS)) {
        OBSERVERS[observer_key] = new IntersectionObserver((entries, observer) => {
            entries.forEach((entry) => {
                printer.logLevel("Checking intersection:", entry.isIntersecting, entry.target, Debug.VERBOSE);
                if (entry.isIntersecting) {
                    let notification = findNotification(entry, observer_key);
                    printer.logLevel("Finding notification:", notification, Debug.DEBUG);
                    if (notification) {
                        printer.logLevel("Validated intersection:", notification.selector, Debug.INFO);
                        observer.unobserve(notification.item);
                        notification.resolve(true);
                        NOTIFICATIONS[observer_key] = Utility.arrayRemove(NOTIFICATIONS[observer_key], notification);
                    }
                }
            });
        }, options);
    }
    let {promise, resolve} = Utility.createPromise();
    let notification = {item, promise, resolve};
    NOTIFICATIONS[observer_key].push(notification);
    OBSERVERS[observer_key].observe(item);
    return notification.promise;
};

/****PRIVATE FUNCTIONS****/

function _getSemaphoreName(name, storage = true) {
    return JSPLib.shortcut + (storage ? '-process-semaphore' + (name ? '-' + name : '') : '.semaphore' + (name ? '.' + name : ''));
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

JSPLib.initializeModule('Concurrency');

})(JSPLib);
