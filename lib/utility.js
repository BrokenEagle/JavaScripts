/****DEPENDENCIES****/

/**External dependencies**/
// jQuery (optional)

/****SETUP****/

//Linter configuration
/* global JSPLib */

(function () {

const utility = JSPLib.utility;

/****GLOBAL VARIABLES****/

utility.max_column_characters = 20;

//Time constants

utility.one_second = 1000;
utility.one_minute = utility.one_second * 60;
utility.one_hour = utility.one_minute * 60;
utility.one_day = utility.one_hour * 24;
utility.one_week = utility.one_day * 7;
utility.one_year = utility.one_day * 365.2425;
utility.one_month = utility.one_year / 12;

/****PRIVATE VARIABLES****/

const WORDBREAK_REGEX = /\(+|\)+|[\s_]+|[^\s_()]+/g;
const ROMAN_REGEX = /^M?M?M?(CM|CD|D?C?C?C?)(XC|XL|L?X?X?X?)(IX|IV|V?I?I?I?)$/i;

const NONTITLEIZE_WORDS = ['a', 'an', 'of', 'the', 'is'];

const CSS_STYLE = {};
const CSS_SHEET = {};

/****FUNCTIONS****/

//Time

utility.sleep = function (ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

utility.getExpires = function (expires) {
    return Math.round(Date.now() + expires);
};

utility.validateExpires = function (actual_expires, expected_expires) {
    //Resolve to false if the actual_expires is bogus, has expired, or the expiration is too long
    return Number.isInteger(actual_expires) && (Date.now() <= actual_expires) && (!Number.isInteger(expected_expires) || ((actual_expires - Date.now()) <= expected_expires));
};

utility.getProgramTime = function () {
    let current = performance.now();
    JSPLib.debug.debuglogLevel("utility.getProgramTime", {current, window: JSPLib.info.start, script: JSPLib._start_time}, JSPLib.debug.DEBUG);
    return {manager: current - JSPLib.info.start, script: current - JSPLib._start_time};
};

utility.timeAgo = function (time_value, {precision = 2, compare_time = null, recent_duration = null} = {}) {
    let timestamp = utility.toTimeStamp(time_value);
    if (!_isTimestamp(timestamp)) return "N/A";
    compare_time ??= Date.now();
    let time_interval = compare_time - timestamp;
    if (_isTimestamp(recent_duration) && time_interval < recent_duration) {
        return "recently";
    }
    if (time_interval < utility.one_hour) {
        return utility.setPrecision(time_interval / utility.one_minute, precision) + " minutes ago";
    }
    if (time_interval < utility.one_day) {
        return utility.setPrecision(time_interval / utility.one_hour, precision) + " hours ago";
    }
    if (time_interval < utility.one_month) {
        return utility.setPrecision(time_interval / utility.one_day, precision) + " days ago";
    }
    if (time_interval < utility.one_year) {
        return utility.setPrecision(time_interval / utility.one_month, precision) + " months ago";
    }
    return utility.setPrecision(time_interval / utility.one_year, precision) + " years ago";
};

utility.toTimeStamp = function (time_value) {
    while (typeof time_value === 'string') {
        var tmp;
        try {
            tmp = JSON.parse(time_value);
        } catch(e) {
            break;
        }
        time_value = tmp;
    }
    return (typeof time_value === 'string' ? new Date(time_value).getTime() : time_value);
};

utility.timeFromNow = function (time_value, {precision = 2, compare_time = null, recent_duration = null} = {}) {
    let timestamp = utility.toTimeStamp(time_value);
    if (!_isTimestamp(timestamp)) return "N/A";
    compare_time ??= Date.now();
    let time_interval = timestamp - compare_time;
    if (_isTimestamp(recent_duration) && time_interval < recent_duration) {
        return "soon";
    }
    if (time_interval < 0) {
        return "already passed";
    }
    if (time_interval < utility.one_hour) {
        return "in " + utility.setPrecision(time_interval / utility.one_minute, precision) + " minutes";
    }
    if (time_interval < utility.one_day) {
        return "in " + utility.setPrecision(time_interval / utility.one_hour, precision) + " hours";
    }
    if (time_interval < utility.one_month) {
        return "in " + utility.setPrecision(time_interval / utility.one_day, precision) + " days";
    }
    if (time_interval < utility.one_year) {
        return "in " + utility.setPrecision(time_interval / utility.one_month, precision) + " months";
    }
    return "in " + utility.setPrecision(time_interval / utility.one_year, precision) + " years";
};

//Number

utility.isDigit = function (input) {
    return typeof input === 'string' && /^\d+$/.test(input);
};

utility.bigIntMax = function (...args) {
    return args.reduce((max, comp) => (max > comp ? max : comp));
};

utility.bigIntMin = function (...args) {
    return args.reduce((min, comp) => (min < comp ? min : comp));
};

utility.setPrecision = function (number, precision) {
    return parseFloat(number.toFixed(precision));
};

utility.getUniqueID = function() {
    return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
};

utility.clamp = function (value, low, high) {
    return Math.max(low, Math.min(value, high));
};

//String

utility.titleizeString = function (string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
};

utility.titleizeExcept = function (word) {
    return (NONTITLEIZE_WORDS.includes(word) ? word : utility.titleizeString(word));
};

utility.titleizeRoman = function (word) {
    return (word.match(ROMAN_REGEX) ? word.toUpperCase() : utility.titleizeExcept(word));
};

utility.maxLengthString = function (string, length) {
    let check_length = (length ? length : utility.max_column_characters);
    if (string.length > check_length) {
        string = string.slice(0, check_length - 1) + '…';
    }
    return string;
};

utility.kebabCase = function (string) {
    return string.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase();
};

utility.camelCase = function (string) {
    return string.replace(/[-_]([a-z])/g, (_, letter) => letter.toUpperCase());
};

utility.snakeCase = function (string) {
    return string.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/[\s-]+/g, '_').toLowerCase();
};

utility.displayCase = function (string) {
    return utility.titleizeString(string.replace(/[_-]/g, ' '));
};

utility.properCase = function (string) {
    return string.match(WORDBREAK_REGEX).map((word) => utility.titleizeString(word)).join("");
};

utility.exceptCase = function (string) {
    return string.match(WORDBREAK_REGEX).map((word) => utility.titleizeExcept(word)).join("");
};

utility.romanCase = function (string) {
    return string.match(WORDBREAK_REGEX).map((word) => utility.titleizeRoman(word)).join("");
};

utility.padNumber = function (num, size) {
    var s = String(num);
    return s.padStart(size, '0');
};

utility.sprintf = function (format, ...values) {
    return values.reduce((str, val) => str.replace(/%s/, val), format);
};

utility.readableBytes = function (bytes) {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    let i = Math.floor(Math.log(bytes) / Math.log(1024));
    return utility.setPrecision((bytes / Math.pow(1024, i)), 2) + ' ' + sizes[i];
};

//Regex

utility.findAll = function(str, regex) {
    return [...str.matchAll(regex)].flat();
};

utility.regexpEscape = function (string) {
    return string.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
};

utility.regexReplace = function (string, values) {
    const replaceTerm = (str, val, key) => str.replace(RegExp(`%${key}%`, 'g'), val);
    return utility.objectReduce(values, replaceTerm, string);
};

utility.safeMatch = function (string, regex, group = 0, defaultValue = "") {
    const match = string.match(regex);
    if (match) {
        return match[group];
    }
    return defaultValue;
};

//String array

utility.filterRegex = function (array, regex, reverse = false) {
    return array.filter((entry) => _not(entry.match(regex), reverse));
};

utility.filterEmpty = function (array) {
    return utility.filterRegex(array, /[\s\S]+/);
};

//Array

utility.concat = function(array1, array2) {
    let result = Array(array1.length + array2.length);
    for(let i = 0; i < array1.length; i++){
        result[i] = array1[i];
    }
    for(let i = 0; i < array2.length; i++){
        result[array1.length + i] = array2[i];
    }
    return result;
};

utility.multiConcat = function (...arrays) {
    if (arrays.length <= 1) {
        return arrays[0] || [];
    }
    let merged_array = arrays[0];
    for (let i = 1; i < arrays.length; i++) {
        merged_array = utility.concat(merged_array, arrays[i]);
    }
    return merged_array;
};

//Unlike arrayUnion, this preservers the order of the concatted arrays
utility.concatUnique = function (array1, array2) {
    return utility.arrayUnique(utility.concat(array1, array2));
};

utility.isSet = function (data) {
    return data && data.constructor && data.constructor.name === "Set";
};

utility.mergeSets = function(set1, set2) {
    let result = utility.copySet(set1);
    for (let x of set2) {
        result.add(x);
    }
    return result;
};

utility.copySet = function(set) {
    let result = new Set();
    for (let x of set) {
        result.add(x);
    }
    return result;
};

utility.setToArray = function (set) {
    let array = Array(set.size);
    let i = 0;
    for (let x of set) {
        array[i++] = x;
    }
    return array;
};

utility.arrayToSet = function (array) {
    let set = new Set();
    for (let x of array) {
        set.add(x);
    }
    return set;
};

utility.setUnion = function (set1, set2) {
    let [small, large] = _orderSets(set1, set2);
    const comparator = () => (true);
    return _setOperation(small, comparator, utility.copySet(large));
};

utility.setDifference = function (set1, set2) {
    const comparator = (val) => !set2.has(val);
    return _setOperation(set1, comparator);
};

utility.setIntersection = function (set1, set2) {
    let [small, large] = _orderSets(set1, set2);
    const comparator = (val) => large.has(val);
    return _setOperation(small, comparator);
};

utility.setSymmetricDifference = function (set1, set2) {
    let combined = utility.setUnion(set1, set2);
    let comparator = (val) => !(set1.has(val) && set2.has(val));
    return _setOperation(combined, comparator);
};

utility.setEquals = function (set1, set2) {
    if (!utility.isSet(set1) || !utility.isSet(set2)) {
        return false;
    }
    if (set1.size !== set2.size) {
        return false;
    }
    let [small, large] = _orderSets(set1, set2);
    return utility.setEvery(small, (val) => large.has(val));
};

utility.setEvery = function (set, func) {
    for (let value of set) {
        if (!func(value, value, set)) {
            return false;
        }
    }
    return true;
};

utility.setSome = function (set, func) {
    for (let value of set) {
        if (func(value, value, set)) {
            return true;
        }
    }
    return false;
};

utility.setMap = function (set, func) {
    let retval = new Set();
    for (let value of set) {
        retval.add(func(value, value, set));
    }
    return retval;
};

utility.setFilter = function (set, func) {
    let retval = new Set();
    for (let value of set) {
        if (func(value, value, set)) {
            retval.add(value);
        }
    }
    return retval;
};

utility.setReduce = function (set, func, acc) {
    for (let value of set) {
        acc = func(acc, value, value, set);
    }
    return acc;
};

utility.isSubSet = function (set1, set2) {
    return utility.setEvery(set2, (val) => set1.has(val));
};

utility.isSuperSet = function (set1, set2) {
    return utility.isSubSet(set2, set1);
};

utility.setHasIntersection = function (set1, set2) {
    let [small, large] = _orderSets(set1, set2);
    return utility.setSome(small, (val) => large.has(val));
};

utility.arrayUnique = function (array) {
    return utility.setToArray(utility.arrayToSet(array));
};

utility.arrayUnion = function (array1, array2) {
    let [set1, set2] = _makeSets(array1, array2);
    return utility.setToArray(utility.setUnion(set1, set2));
};

utility.arrayDifference = function (array1, array2) {
    let [set1, set2] = _makeSets(array1, array2);
    return utility.setToArray(utility.setDifference(set1, set2));
};

utility.arrayIntersection = function (array1, array2) {
    let [set1, set2] = _makeSets(array1, array2);
    return utility.setToArray(utility.setIntersection(set1, set2));
};

utility.arraySymmetricDifference = function (array1, array2) {
    let [set1, set2] = _makeSets(array1, array2);
    return utility.setToArray(utility.setSymmetricDifference(set1, set2));
};

utility.isSubArray = function (array1, array2) {
    let [set1, set2] = _makeSets(array1, array2);
    return utility.isSubSet(set1, set2);
};

utility.isSuperArray = function (array1, array2) {
    return utility.isSubArray(array2, array1);
};

utility.arrayEquals = function (array1, array2) {
    if (!Array.isArray(array1) || !Array.isArray(array2)) {
        return false;
    }
    if (array1.length !== array2.length) {
        return false;
    }
    let [set1, set2] = _makeSets(array1, array2);
    return utility.setEquals(set1, set2);
};

utility.arrayHasIntersection = function (array1, array2) {
    let [set1, set2] = _makeSets(array1, array2);
    return utility.setHasIntersection(set1, set2);
};

//Filter a list of objects with a list of values
utility.listFilter = function (array, itemlist, itemkey, reverse = false) {
    return array.filter((item) => _not(itemlist.includes(item[itemkey]), reverse));
};

utility.joinList = function (array, prefix, suffix, joiner) {
    prefix = prefix || '';
    suffix = suffix || '';
    return array.map((level) => (prefix + level + suffix)).join(joiner);
};

//Object

utility.freezeObject = function (object, recurse = false) {
    if (recurse) {
        for (let key in object) {
            let value = object[key];
            if (typeof value === "object" && value !== null) {
                utility.freezeObject(value, true);
                Object.freeze(value);
            }
        }
    }
    Object.freeze(object);
};

utility.freezeObjects = function (object_array, recurse) {
    object_array.forEach((val) => {utility.freezeObject(val, recurse);});
};

//To freeze individual properties of an object
utility.freezeProperty = function (object, property) {
    Object.defineProperty(object, property, { configurable: false, writable: false });
};

utility.freezeProperties = function (object, property_list) {
    property_list.forEach((property) => {utility.freezeProperty(object, property);});
};

utility.getObjectAttributes = function (object, attribute) {
    if (Array.isArray(object)) {
        return object.map((val) => val[attribute]);
    } if (utility.isSet(object)) {
        return utility.setMap(object, (val) => val[attribute]);
    }
    throw "utility.getObjectAttributes: Unhandled object type";
};


//Get nested attribute for single object
utility.getNestedAttribute = function (data, attributes) {
    for (let i = 0; i < attributes.length; i++) {
        let attribute = attributes[i];
        data = data[attribute];
        if (data === undefined) {
            return null;
        }
    }
    return data;
};

//Get nested attribute for multiple objects
utility.getNestedObjectAttributes = function (data, attributes) {
    for (let i = 0; i < attributes.length; i++) {
        let attribute = attributes[i];
        data = utility.getObjectAttributes(data, attribute);
        if (data.length === 0 || data[0] === undefined) {
            return null;
        }
    }
    return data;
};

utility.objectReduce = function (object, reducer, accumulator) {
    for (let key in object) {
        if (Object.prototype.hasOwnProperty.call(object, key)) {
            accumulator = reducer(accumulator, object[key], key, object);
        }
    }
    return accumulator;
};

//Deep copy an object or array
utility.dataCopy = function (olddata) {
    if (typeof olddata !== "object" || olddata === null) {
        return olddata;
    }
    if (!['Object', 'Array', 'Set'].includes(olddata.constructor.name)) {
        return Object.create(Object.getPrototypeOf(olddata));
    }
    let newdata = new olddata.constructor;
    let entries = (olddata.constructor.name === 'Set' ? olddata.entries() : Object.entries(olddata));
    const copyMethod = (olddata.constructor.name === 'Set' ? (_, value) => newdata.add(value) : (key, value) => (newdata[key] = value));
    for (let [key, value] of entries) {
        if ((typeof value === "object") && (value !== null)) {
            value = utility.dataCopy(value);
        }
        copyMethod(key, value);
    }
    return newdata;
};

utility.mergeHashes = function (...hashes) {
    let result = utility.dataCopy(hashes[0]);
    for (let i = 1; i < hashes.length; i++) {
        for (let k in hashes[i]) {
            if (utility.isHash(result[k]) && utility.isHash(hashes[i][k])) {
                result[k] = utility.mergeHashes(result[k], hashes[i][k]);
            } else {
                result[k] = utility.dataCopy(hashes[i][k]);
            }
        }
    }
    return result;
};

//Compare two objects to detect changes to the first
utility.recurseCompareObjects = function (object1, object2, difference = {}) {
    for (let key in object1) {
        if (object1[key] !== object2[key] && typeof object1[key] !== "object") {
            difference[key] = [object1[key], object2[key]];
        } else if (typeof object1[key] === "object") {
            difference[key] = {};
            utility.recurseCompareObjects(object1[key], object2[key], difference[key]);
            //Delete empty objects
            if (Object.getOwnPropertyNames(difference[key]).length === 0) {
                delete difference[key];
            }
        }
    }
    return difference;
};

utility.arrayFill = function (length, stringified_json) {
    return Array(length).fill().map(() => JSON.parse(stringified_json));
};

utility.arrayRemove = function (array, item) {
    return array.filter((value) => (value !== item));
};

//Promise

utility.createPromise = function () {
    var resolve, reject;
    function resolver(_resolve, _reject) {
        resolve = _resolve;
        reject = _reject;
    }
    var promise = new Promise(resolver);
    return {promise, resolve, reject};
};

utility.promiseState = function (promise) {
    const pendingState = {status: 'pending'};
    return Promise.race([promise, pendingState]).then(
        (value) => (value === pendingState ? value : {status: 'resolved', value}),
        (reason) => ({status: 'rejected', reason}),
    );
};

utility.createStatusPromise = function () {
    const ret = utility.createPromise();
    const timer = utility.initializeInterval(() => {
        utility.promiseState(ret.promise).then((state) => {
            ret.status = state.status;
            if (ret.status !== 'pending') {
                clearInterval(timer);
            }
        });
    }, 100);
    return ret;
};

utility.promiseHashAll = async function (promise_hash) {
    const correlate = function (hash, parr = null) {
        parr ??= [];
        for (let key in hash) {
            if (hash[key].constructor.name === 'Promise') {
                parr.push(hash[key]);
            } else if (utility.isHash(hash[key])) {
                correlate(hash[key], parr);
            }
        }
        return parr;
    };
    const resolve = function (hash) {
        let result = {};
        for (let key in hash) {
            if (hash[key].constructor.name === 'Promise') {
                let index = promise_array.indexOf(hash[key]);
                result[key] = result_array[index];
            } else if (utility.isHash(hash[key])) {
                result[key] = resolve(hash[key]);
            }
        }
        return result;
    };
    let promise_array = correlate(promise_hash);
    let result_array = await Promise.all(promise_array);
    return resolve(promise_hash);
};

//Function

utility.hijackFunction = function (oldfunc, postfunc, {prefunc = null, key = null} = {}) {
    return function(...args) {
        if (prefunc) {
            prefunc.call(this, ...args);
        }
        let isasync = (oldfunc.constructor.name === "AsyncFunction");
        var timer;
        if (typeof key === "string") {
            let timer_key = key + '[' + utility.getUniqueID() + ']';
            timer = {
                start () {
                    JSPLib.debug.debugTime(timer_key);
                },
                end (data) {
                    if (isasync) {
                        data.then(() => {
                            JSPLib.debug.debugTimeEnd(timer_key);
                        });
                    } else {
                        JSPLib.debug.debugTimeEnd(timer_key);
                    }
                },
            };
        } else {
            timer = {
                start () {},
                end () {},
            };
        }
        timer.start();
        let data = oldfunc.call(this, ...args);
        timer.end(data);
        data = postfunc.call(this, data, ...args);
        return data;
    };
};

//CSS

utility.addStyleSheet = function (url, title = '') {
    if (title in CSS_SHEET) {
        CSS_SHEET[title].href = url;
    } else {
        CSS_SHEET[title] = JSPLib._document.createElement('link');
        CSS_SHEET[title].rel = 'stylesheet';
        CSS_SHEET[title].type = 'text/css';
        CSS_SHEET[title].href = url;
        JSPLib._document.head.appendChild(CSS_SHEET[title]);
    }
};

//Sets the css style and retains a pointer to the DOM object for later edits
utility.setCSSStyle = function (csstext, title) {
    if (title in CSS_STYLE) {
        CSS_STYLE[title].innerHTML = csstext;
    } else {
        CSS_STYLE[title] = JSPLib._document.createElement('style');
        CSS_STYLE[title].type = 'text/css';
        CSS_STYLE[title].innerHTML = csstext;
        JSPLib._document.head.appendChild(CSS_STYLE[title]);
    }
    return CSS_STYLE[title];
};

utility.hasStyle = function (name) {
    return name in CSS_STYLE;
};

//DOM

utility.DOMtoArray = function (obj) {
    var array = [];
    for (let i = obj.length; i--;) {
        array[i] = obj[i];
    }
    return array;
};

utility.DOMtoHash = function (obj) {
    var hash = {};
    for (let key in obj) {
        hash[key] = obj[key];
    }
    return hash;
};

utility.installScriptDOM = function (url, addons = {}) {
    let script = JSPLib._document.createElement('script');
    script.src = url;
    for (let key in addons) {
        script[key] = addons[key];
    }
    JSPLib._document.head.appendChild(script);
};

utility.getExpando = function (is_private) {
    return JSPLib._jQuery.expando + (is_private ? '1' : '2');
};

utility.getPrivateData = function ($dom_object) {
    if ($dom_object) {
        let private_expando = utility.getExpando(true);
        if (private_expando && private_expando in $dom_object) {
            return $dom_object[private_expando];
        }
    }
    return {};
};

utility.getPublicData = function ($dom_object) {
    if ($dom_object) {
        let public_expando = utility.getExpando(false);
        if (public_expando && public_expando in $dom_object) {
            return $dom_object[public_expando];
        }
        return utility.getAllDOMData($dom_object);
    }
    return {};
};

utility.getAttr = function (domobj, key) {
    if (typeof key === 'string') {
        return domobj.attributes[key].value;
    }
    let data = {};
    for (let attr of domobj.attributes) {
        if (Array.isArray(key) && !key.includes(attr.name)) continue;
        data[attr.name] = attr.value;
    }
    return data;
};

utility.getDOMAttributes = function ($dom_array, attribute, parser = ((a) => a)) {
    let attribute_key = utility.camelCase(attribute);
    let results = Array($dom_array.length);
    for (let i = 0; i < $dom_array.length; i++) {
        results[i] = parser($dom_array[i].dataset[attribute_key]);
    }
    return results;
};

utility.getAllDOMData = function ($dom_object) {
    let dataset = utility.DOMtoHash($dom_object.dataset);
    for (let key in dataset) {
        try {
            dataset[key] = JSON.parse(dataset[key]);
        } catch (e) {
            //swallow
        }
    }
    return dataset;
};

utility.saveEventHandlers = function (root, type) {
    let $obj = _getObjRoot(root);
    let private_data = utility.getPrivateData($obj);
    return (utility.isHash(private_data) && 'events' in private_data && type in private_data.events && private_data.events[type].map((event) => [event.namespace, event.handler])) || [];
};

utility.rebindEventHandlers = function (root, type, handlers, namespaces) {
    let $obj = _getObjRoot(root);
    let rebind_handlers = handlers.filter((handler) => utility.arrayHasIntersection(namespaces, handler[0].split('.')));
    rebind_handlers.forEach((handler) => {
        let trigger = type + (handler[0].length === 0 ? "" : '.' + handler[0]);
        JSPLib._jQuery($obj).on(trigger, handler[1]);
    });
};

utility.blockActiveElementSwitch = function (selector) {
    JSPLib._document.querySelectorAll(selector).forEach((elem) => {
        // Allows the use of document.activeElement to get the last selected text input or textarea
        elem.onmousedown = (e) => {(e || JSPLib._window.event).preventDefault();};
    });
};

utility.getBoundEventNames = function (root, eventtype, selector) {
    let $obj = _getObjRoot(root);
    if ($obj === null) {
        return [];
    }
    let private_data = utility.getPrivateData($obj);
    let boundevents = 'events' in private_data && private_data.events;
    if (!boundevents || !(eventtype in boundevents)) {
        return [];
    }
    let selector_events = boundevents[eventtype].filter((entry) => (entry.selector === selector || (selector === undefined && entry.selector === null) || (selector === null && entry.selector === undefined)));
    return selector_events.map((entry) => entry.namespace);
};

utility.isNamespaceBound = function ({root = null, eventtype = null, namespace = null, selector = null, presence = true} = {}) {
    let event_namespaces = utility.getBoundEventNames(root, eventtype, selector);
    let name_parts = namespace.split('.');
    return _not(event_namespaces.some((name) => utility.isSubArray(name.split('.'), name_parts)), !presence);
};

utility.isGlobalFunctionBound = function (name) {
    let private_data = utility.getPrivateData(document);
    return private_data && 'events' in private_data && Object.keys(private_data.events).includes(name);
};

utility.getDOMDataKeys = function (selector) {
    let $obj = JSPLib._document.querySelector(selector);
    return Object.keys(utility.getPublicData($obj));
};

utility.hasDOMDataKey = function (selector, key) {
    return utility.getDOMDataKeys(selector).includes(key);
};

utility.setDataAttribute = function (obj, key, value) {
    let $obj = ('length' in obj ? obj : [obj]);
    for (let i = 0; i < obj.length; i++) {
        let expando = utility.getExpando(false);
        if (expando in $obj) {
            let public_data = utility.getPublicData($obj);
            public_data[key] = value;
        }
        $obj[i].setAttribute('data-' + key, value);
    }
};

utility.getElemPosition = function (domnode) {
    let elemTop = 0;
    let elemLeft = 0;
    for (let currElem = domnode; currElem.offsetParent !== null; currElem = currElem.offsetParent) {
        elemTop += currElem.offsetTop;
        elemLeft += currElem.offsetLeft;
        let computed_style = JSPLib._window.getComputedStyle(currElem);
        if (computed_style.transform !== "none") {
            let translate_x = Number(computed_style.transform.match(/[0-9-.]+/g)[4]);
            let translate_y = Number(computed_style.transform.match(/[0-9-.]+/g)[5]);
            elemLeft += translate_x;
            elemTop += translate_y;
        }
    }
    return {top: elemTop, left: elemLeft};
};

utility.isScrolledIntoView = function (domnode, view_percentage = 0.75) {
    let docViewTop = JSPLib._window.scrollY;
    let docViewBottom = docViewTop + JSPLib._window.innerHeight;
    let {top: elemTop} = utility.getElemPosition(domnode);
    let elemBottom = elemTop + domnode.offsetHeight;
    if ((elemBottom <= docViewBottom) && (elemTop >= docViewTop)) {
        //Is element entirely within view?
        return true;
    }
    if ((elemBottom >= docViewBottom) && (elemTop <= docViewTop)) {
        //Does element fill up the view?
        return true;
    }
    if ((elemTop >= docViewTop) && (elemTop <= docViewBottom)) {
        //Does the top portion of the element fill up a certain percentage of the view?
        return ((docViewBottom - elemTop) / (docViewBottom - docViewTop)) > view_percentage;
    }
    if ((elemBottom >= docViewTop) && (elemBottom <= docViewBottom)) {
        //Does the bottom portion of the element fill up a certain percentage of the view?
        return ((elemBottom - docViewTop) / (docViewBottom - docViewTop)) > view_percentage;
    }
    return false;
};

utility.fullHide = function (selector) {
    let $objs = JSPLib._document.querySelectorAll(selector);
    for (let i = 0; i < $objs.length; i++) {
        $objs[i].style.setProperty('display', 'none', 'important');
    }
};

utility.clearHide = function (selector) {
    let $objs = JSPLib._document.querySelectorAll(selector);
    for (let i = 0; i < $objs.length; i++) {
        $objs[i].style.setProperty('display', '');
    }
};

utility.getMeta = function (key) {
    let $obj = JSPLib._document.querySelector("meta[name=" + key + "]");
    return $obj && $obj.content;
};

utility.sanitizeCSSName = function (name) {
    return name.replace(/[!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~]/g, '\\$&');
};

utility.getHTMLTree = function (domnode) {
    var tree = [];
    for (let checknode = domnode; checknode !== null; checknode = checknode.parentElement) {
        let nodename = checknode.tagName.toLowerCase();
        let id = (checknode.id !== "" ? '#' + utility.sanitizeCSSName(checknode.id) : "");
        let classlist = [...checknode.classList].map((entry) => ('.' + utility.sanitizeCSSName(entry))).join("");
        let index = "";
        if (checknode.parentElement !== null) {
            let similar_elements = [...checknode.parentElement.children].filter((entry) => entry.tagName === checknode.tagName);
            let similar_position = similar_elements.indexOf(checknode) + 1;
            index = ":nth-of-type(" + similar_position + ")";
        }
        tree.push(nodename + id + classlist + index);
    }
    return tree.reverse().join(" > ");
};

utility.getNthParent = function (obj, levels) {
    let $element = obj;
    for (let i = 0;i < levels;i++) {
        $element = $element.parentElement;
    }
    return $element;
};

//Number is one-based, i.e. the first child is number 1, the last child is -1
utility.getNthChild = function (obj, number) {
    let child_pos = (number < 0 ? obj.children.length + number : number - 1);
    return obj.children[child_pos];
};

utility.getNthSibling = function (obj, vector) {
    let $element = obj;
    let distance = Math.abs(vector);
    for (let i = 0;i < distance;i++) {
        $element = (vector > 0 ? $element.nextElementSibling : $element.previousElementSibling);
    }
    return $element;
};

//Two dimensional array where each entry is a two-entry vector
//vectors[0]: moves at the same hierarchy level, i.e. siblings
//vectors[1]: move to different hierarchy levels, i.e. ancestors/descendants
//No diagonal vectors, i.e. the first or second entry must be 0
//Going to descendants must be done one vector at a time
utility.walkDOM = function (obj, vectors) {
    let $element = obj;
    for (let vector of vectors) {
        if ((vector[0] !== 0) && (vector[1] !== 0)) {
            continue; //invalid vector
        } else if (vector[0] !== 0) {
            $element = utility.getNthSibling($element, vector[0]);
        } else if (vector[1] < 0) {
            $element = utility.getNthParent($element, Math.abs(vector[1]));
        } else if (vector[1] > 0) {
            $element = utility.getNthChild($element, vector[1]);
        }
    }
    return $element;
};

//Event handlers

utility.subscribeDOMProperty = function (object, property, {getter = null, setter = null} = {}) {
    // For properties that are directly on a DOM object, such as value
    const descriptor = Object.getOwnPropertyDescriptor(object.constructor.prototype, property);
    Object.defineProperty(object, property, {
        get() {
            let value = descriptor.get.call(object);
            getter?.(value);
            return value;
        },
        set(value) {
            descriptor.set.call(object, value);
            setter?.(value);
        },
        configurable: false,
        enumerable: true,
    });
};

utility.setPropertyTrap = function (object, property, {value = {}, getter = null, setter = null} = {}) {
    // For subproperties that are accessed/written after the DOM object is initialized
    const private_property = '_' + property;
    let proxy_value = new Proxy(object, {
        get(target, prop, _receiver) {
            let value = target[private_property][prop];
            getter?.(prop, value);
            return value;
        },
        set(target, prop, value, _receiver) {
            target[private_property][prop] = value;
            setter?.(prop, value);
        },
    });
    Object.defineProperty(object, property, {
        value: proxy_value,
        configurable: false,
        enumerable: true,
        writeable: false,
    });
    Object.defineProperty(object, private_property, {
        value,
        configurable: false,
        enumerable: false,
        writeable: false,
    });
};

utility.clickAndHold = function(selector, func, namespace = "", wait_time = 500, interval_time = 100) {
    let $obj = (typeof selector === 'string' ? JSPLib._jQuery(selector) : selector);
    let event_namespaces = ['mousedown', 'mouseup', 'mouseleave'].map((event_type) => (event_type + (namespace ? '.' + namespace : "")));
    let timer = null;
    let interval = null;
    $obj.on(event_namespaces[0], (event) => {
        if (event.button !== 0) return;
        func(event);
        timer = setTimeout(() => {
            interval = utility.initializeInterval(() => {
                func(event);
            }, interval_time);
        }, wait_time);
    }).on(event_namespaces.slice(1).join(', '), () => {
        clearTimeout(timer);
        clearInterval(interval);
    });
};

//Image

utility.getImageDimensions = function (image_url) {
    return new Promise((resolve, reject) => {
        let fake_image = JSPLib._document.createElement('img');
        fake_image.onload = function () {
            resolve({
                width: fake_image.naturalWidth,
                height: fake_image.naturalHeight,
            });
        };
        fake_image.onerror = function() {
            reject(null);
        };
        fake_image.src = image_url;
    });
};

utility.getPreviewDimensions = function (image_width, image_height, base_dimension) {
    let scale = Math.min(base_dimension / image_width, base_dimension / image_height);
    scale = Math.min(1, scale);
    let width = Math.round(image_width * scale);
    let height = Math.round(image_height * scale);
    return [width, height];
};

//Interval

utility.initializeInterval = function (func, time) {
    let retval = func();
    if (retval === false || retval === undefined) {
        return setInterval(func, time);
    }
    return true;
};

utility.recheckInterval = function ({check = null, exec = null, debug = null, fail = null, always = null, duration = null, interval = null} = {}) {
    let expires = Number.isInteger(duration) && utility.getExpires(duration);
    var timeobj = {};
    var timer = null;
    timer = timeobj.timer = utility.initializeInterval(() => {
        if (check?.()) {
            exec?.();
            timeobj.timer = true;
        } else if (!expires || utility.validateExpires(expires)) {
            debug?.();
            return false;
        } else {
            fail?.();
            timeobj.timer = false;
        }
        always?.();
        if (Number.isInteger(timer)) {
            clearInterval(timer);
        }
        return true;
    }, interval);
    return timeobj;
};

utility.DOMWaitExecute = function ({global_check = null, namespace_check = null, data_check = null, extra_check = null, found = null, interval = null, duration = null, name = null} = {}) {
    const printer = (name ? JSPLib.debug.getFunctionPrint('utility.DOMWaitExecute') : (() => {}));
    extra_check ??= (() => true);
    utility.recheckInterval({
        check: () => {
            let checks = [];
            if (global_check !== null) {
                checks.push(utility.isGlobalFunctionBound(global_check));
            }
            if (namespace_check !== null) {
                checks.push(utility.isNamespaceBound(namespace_check));
            }
            if (data_check !== null) {
                checks.push(utility.hasDOMDataKey(data_check.selector, data_check.key));
            }
            if (extra_check !== null) {
                checks.push(extra_check());
            }
            return checks.every((c) => c);
        },
        debug: () => printer.debuglogLevel(`Waiting on DOM: ${name}.`, JSPLib.debug.VERBOSE),
        fail: () => printer.debuglogLevel(`Failed to execute: ${name}.`, JSPLib.debug.WARNING),
        exec: () => {
            printer.debuglogLevel(`Event triggered: ${name}.`, JSPLib.debug.INFO);
            found();
        },
        interval,
        duration,
    });
};

//Page

utility.refreshPage = function (timeout) {
    setTimeout(() => {
        JSPLib._window.location.reload();
    }, timeout);
};

//Cookie

utility.createCookie = function (name, value, days, domain) {
    let cookie_text = name + '=' + value;
    if (days) {
        let date = new Date();
        date.setTime(date.getTime() + (days * utility.one_day));
        cookie_text += '; expires=' + date.toGMTString();
    }
    if (domain) {
        cookie_text += '; domain=' + domain;
    }
    JSPLib._document.cookie = cookie_text + '; path=/; SameSite=Lax;';
};

utility.readCookie = function (name) {
    let name_equals = name + "=";
    let all_cookies = JSPLib._document.cookie.split(';');
    for (let i = 0; i < all_cookies.length; i++) {
        let cookie = all_cookies[i].trim();
        if (cookie.indexOf(name_equals) === 0) {
            return decodeURIComponent(cookie.substring(name_equals.length, cookie.length).replace(/\+/g, " "));
        }
    }
    return null;
};

utility.eraseCookie = function (name, domain) {
    utility.createCookie(name, "", -1, domain);
};

//HTML/URL

utility.getDomainName = function (url, level = 0) {
    let parser = new URL(url);
    let domain_levels = parser.hostname.split('.');
    return domain_levels.slice(level * -1).join('.');
};

utility.getFileURLNameExt = function (file_url, dflt = 'jpg') {
    try {
        let path_index = file_url.lastIndexOf('/');
        let file_ident = file_url.slice(path_index + 1);
        let [file_name, extension] = file_ident.split('.');
        extension = extension.split(/\W+/)[0];
        return [file_name, extension];
    } catch (_e) {
        return [null, dflt];
    }
};

utility.parseParams = function (str) {
    if (str === "") return {};
    str = (str.startsWith('?') ? str.slice(1) : str);
    return str.split('&').reduce((params, param) => {
        var paramSplit = param.split('=').map((value) => decodeURIComponent(value.replace(/\+/g, ' ')));
        params[paramSplit[0]] = paramSplit[1];
        return params;
    }, {});
};

utility.renderParams = function (params) {
    let param_array = [];
    for (let key in params) {
        let enc_key = encodeURIComponent(key);
        let enc_value = (params[key] === null ? "" : encodeURIComponent(params[key]).replace(/%20/g, '+'));
        param_array.push(enc_key + '=' + enc_value);
    }
    return param_array.join('&');
};

utility.renderHTMLTag = function (tagname, text, options = {}) {
    let attributes = [];
    for (let attr in options) {
        let attr_key = utility.kebabCase(attr);
        let attr_data = options[attr];
        if (attr_data === null) {
            attributes.push(attr_key);
        } else if (attr_data !== undefined) {
            attributes.push(`${attr_key}="${attr_data}"`);
        }
    }
    let html_tag = `<${tagname} ${attributes.join(' ')}>`;
    if (text !== null) {
        html_tag += `${text}</${tagname}>`;
    }
    return html_tag;
};

utility.HTMLEscape = function (str) {
    const escape_entries = [
        ['&', '&amp;'],
        ['<', '&lt;'],
        ['>', '&gt;'],
        ['"', '&quot;'],
        ["'", '&#x27;'],
        ['`', '&#x60;']
    ];
    escape_entries.forEach((entry) => {
        str = str.replace(RegExp(entry[0], 'g'), entry[1]);
    });
    return str;
};

utility.fullEncodeURIComponent = function (str) {
    return encodeURIComponent(str).replace(/[!'()*]/g, (c) => ('%' + c.charCodeAt(0).toString(16)));
};

//Validation

utility.isBoolean = function (value) {
    return typeof value === "boolean";
};

utility.isString = function (value) {
    return typeof value === "string";
};

utility.isNumber = function (value) {
    return typeof value === 'number' && !isNaN(value);
};

utility.isInteger = function (value) {
    return Number.isInteger(value);
};

utility.isHash = function (value) {
    return value?.constructor?.name === 'Object';
};

utility.validateID = function (value) {
    return Number.isInteger(value) && (value > 0);
};

utility.validateIDList = function (array) {
    return Array.isArray(array) && ((array.length === 0) || ((array.length > 0) && array.reduce((total, val) => utility.validateID(val) && total, true)));
};

//Other

utility.createBroadcastChannel = function (name, func) {
    let channel = new BroadcastChannel(name);
    channel.onmessage = func;
    return channel;
};

//So that throw statements can be used in more places like ternary operators
utility.throwError = function(e) {
    throw e;
};

/****PRIVATE FUNCTIONS****/

function _isTimestamp(timestamp) {
    //This includes epoch timestamps as well as durations, which must be integer/float and greater than zero
    return typeof timestamp === 'number' && !Number.isNaN(timestamp) && timestamp >= 0;
}

function _not(data, reverse) {
    return (reverse ? !data : Boolean(data));
}

function _setOperation(iterator, comparator, result = new Set()) {
    for (let val of iterator) {
        if (comparator(val)) {
            result.add(val);
        }
    }
    return result;
}

function _makeSets(...arrays) {
    return arrays.map((array) => utility.arrayToSet(array));
}

function _orderSets(set1, set2) {
    return (set1.size > set2.size ? [set2, set1] : [set1, set2]);
}

function _getObjRoot(root) {
    return (typeof root !== 'string' ? root : JSPLib._document.querySelector(root));
}

/****INITIALIZATION****/

JSPLib.initializeModule('utility', {
    nonwritable: ['one_second', 'one_minute', 'one_hour', 'one_day', 'one_week', 'one_month', 'one_year']
});

})();
