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

JSPLib.concurrency.checkSemaphore = function (program_shortcut, name) {
    let storage_name = this._getSemaphoreName(program_shortcut, name, true);
    let semaphore = JSPLib.storage.getLocalData(storage_name, {default_val: 0});
    return !JSPLib.utility.validateExpires(semaphore, this.process_semaphore_expires);
};

JSPLib.concurrency.freeSemaphore = function (program_shortcut, name) {
    let event_name = this._getSemaphoreName(program_shortcut, name, false);
    let storage_name = this._getSemaphoreName(program_shortcut, name, true);
    JSPLib._jQuery(JSPLib._window).off('beforeunload.' + event_name);
    JSPLib.storage.setLocalData(storage_name, 0);
};

JSPLib.concurrency.reserveSemaphore = function (self, program_shortcut, name) {
    let display_name = (name ? `[${name}]` : '');
    if (this.checkSemaphore(program_shortcut, name)) {
        self.debug('logLevel', `Tab got the semaphore ${display_name}!`, JSPLib.debug.INFO);
        //Guarantee that leaving/closing tab reverts the semaphore
        let event_name = this._getSemaphoreName(program_shortcut, name, false);
        let storage_name = this._getSemaphoreName(program_shortcut, name, true);
        JSPLib._jQuery(JSPLib._window).on('beforeunload.' + event_name, () => {
            JSPLib.storage.setLocalData(storage_name, 0);
        });
        //Set semaphore with an expires in case the program crashes
        let semaphore = JSPLib.utility.getExpires(this.process_semaphore_expires);
        JSPLib.storage.setLocalData(storage_name, semaphore);
        return semaphore;
    }
    self.debug('logLevel', `Tab missed the semaphore ${display_name}!`, JSPLib.debug.WARNING);
    return null;
};

//Timeout functions

JSPLib.concurrency.checkTimeout = function (storage_key, expires_time) {
    let expires = JSPLib.storage.getLocalData(storage_key, {default_val: 0});
    return !JSPLib.utility.validateExpires(expires, expires_time);
};

JSPLib.concurrency.setRecheckTimeout = function (storage_key, expires_time) {
    JSPLib.storage.setLocalData(storage_key, JSPLib.utility.getExpires(expires_time));
};

//Observer functions

//Calls a function when the DOM object of a certain ID or classname of an immediate child gets replaced
JSPLib.concurrency.setupMutationReplaceObserver = function (self, $root_node, remove_selector, func, disconnect = true) {
    if (typeof $root_node === 'string') {
        $root_node = document.querySelector($root_node);
    }
    let [key, name] = this._getSelectorChecks(remove_selector);
    new MutationObserver((mutations, observer) => {
        for (let i = 0; i < mutations.length; i++) {
            let mutation = mutations[i];
            self.debug('logLevel', "Checking mutation:", mutation.type, mutation.removedNodes, JSPLib.debug.VERBOSE);
            if (mutation.type === "childList" && mutation.removedNodes.length === 1) {
                let node = mutation.removedNodes[0];
                self.debug('logLevel', `Checking removed node: ${key} ${name} "${node[key]}"`, JSPLib.debug.DEBUG);
                if ((key !== 'classname' && name === node[key]) || (node[key].split(' ').includes(name))) {
                    self.debug('logLevel', `Validated remove: ${remove_selector} has been modified!`, JSPLib.debug.INFO);
                    func(mutation);
                    if (disconnect) {
                        self.debug('logLevel', "Disconnecting observer.", JSPLib.debug.DEBUG);
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

JSPLib.concurrency.whenScrolledIntoView = function (self, selector, options = {}) {
    let {observers, notifications} = this._intersection;
    const observer_key = JSON.stringify(options);
    const findNotification = (entry, observer_key) => (notifications[observer_key].find((notification) => (notification.item === entry.target)));
    notifications[observer_key] ||= [];
    let item = document.querySelector(selector);
    let check_existing = findNotification(item, observer_key);
    if (check_existing) return check_existing.promise;
    if (!(observer_key in observers)) {
        observers[observer_key] = new IntersectionObserver((entries, observer) => {
            entries.forEach((entry) => {
                self.debug('logLevel', "Checking intersection:", entry.isIntersecting, entry.target, JSPLib.debug.VERBOSE);
                if (entry.isIntersecting) {
                    let notification = findNotification(entry, observer_key);
                    self.debug('logLevel', "Finding notification:", notification, JSPLib.debug.DEBUG);
                    if (notification) {
                        self.debug('logLevel', "Validated intersection:", notification.selector, JSPLib.debug.INFO);
                        observer.unobserve(notification.item);
                        notification.resolve(true);
                        notifications[observer_key] = JSPLib.utility.arrayRemove(notifications[observer_key], notification);
                    }
                }
            });
        }, options);
    }
    let {promise, resolve} = JSPLib.utility.createPromise();
    let notification = {item, promise, resolve};
    notifications[observer_key].push(notification);
    observers[observer_key].observe(item);
    return notification.promise;
};

/****PRIVATE DATA****/

//Data

JSPLib.concurrency._intersection = {observers: {}, notifications: {}};

//Functions

JSPLib.concurrency._getSemaphoreName = function (program_shortcut, name, storage = true) {
    return program_shortcut + (storage ? '-process-semaphore' + (name ? '-' + name : '') : '.semaphore' + (name ? '.' + name : ''));
};

JSPLib.concurrency._getSelectorChecks = function (selector) {
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
};

/****INITIALIZATION****/

JSPLib.concurrency._configuration = {
    nonenumerable: [],
    nonwritable: ['_intersection']
};
JSPLib.initializeModule('concurrency');
JSPLib.debug.addModuleLogs('concurrency', ['reserveSemaphore', 'setupMutationReplaceObserver', 'whenScrolledIntoView']);
