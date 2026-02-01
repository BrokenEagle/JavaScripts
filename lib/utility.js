/****DEPENDENCIES****/

/**External dependencies**/
// jQuery (optional)

/**Internal dependencies**/
// JSPLib.Debug (optional)

/****SETUP****/

//Linter configuration
/* global JSPLib */

(function ({jQueryProxy, Debug}) {

const Utility = JSPLib.Utility;

/****PUBLIC VARIABLES****/

Utility.max_column_characters = 20;

//Time constants

Utility.one_second = 1000;
Utility.one_minute = Utility.one_second * 60;
Utility.one_hour = Utility.one_minute * 60;
Utility.one_day = Utility.one_hour * 24;
Utility.one_week = Utility.one_day * 7;
Utility.one_year = Utility.one_day * 365.2425;
Utility.one_month = Utility.one_year / 12;

/****PRIVATE VARIABLES****/

const CSS_STYLE = {};
const CSS_SHEET = {};

/****PUBLIC FUNCTIONS****/

//Time

Utility.sleep = function (ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

Utility.getExpires = function (expires) {
    return Math.round(Date.now() + expires);
};

Utility.validateExpires = function (actual_expires, expected_expires) {
    //Resolve to false if the actual_expires is bogus, has expired, or the expiration is too long
    return Utility.isInteger(actual_expires) && (Date.now() <= actual_expires) && (!Utility.isInteger(expected_expires) || ((actual_expires - Date.now()) <= expected_expires));
};

Utility.getProgramTime = function () {
    let current = performance.now();
    return {manager: current - JSPLib.info.start, script: current - JSPLib._start_time};
};

Utility.toTimeStamp = function (time_value) {
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

Utility.timeAgo = function (time_value, {precision = 2, compare_time = null, recent_duration = null} = {}) {
    let timestamp = Utility.toTimeStamp(time_value);
    if (!_isTimestamp(timestamp)) return "N/A";
    compare_time ??= Date.now();
    let time_interval = compare_time - timestamp;
    if (_isTimestamp(recent_duration) && time_interval < recent_duration) {
        return "recently";
    }
    if (time_interval < Utility.one_hour) {
        return Utility.setPrecision(time_interval / Utility.one_minute, precision) + " minutes ago";
    }
    if (time_interval < Utility.one_day) {
        return Utility.setPrecision(time_interval / Utility.one_hour, precision) + " hours ago";
    }
    if (time_interval < Utility.one_month) {
        return Utility.setPrecision(time_interval / Utility.one_day, precision) + " days ago";
    }
    if (time_interval < Utility.one_year) {
        return Utility.setPrecision(time_interval / Utility.one_month, precision) + " months ago";
    }
    return Utility.setPrecision(time_interval / Utility.one_year, precision) + " years ago";
};

Utility.timeFromNow = function (time_value, {precision = 2, compare_time = null, recent_duration = null} = {}) {
    let timestamp = Utility.toTimeStamp(time_value);
    if (!_isTimestamp(timestamp)) return "N/A";
    compare_time ??= Date.now();
    let time_interval = timestamp - compare_time;
    if (_isTimestamp(recent_duration) && time_interval < recent_duration) {
        return "soon";
    }
    if (time_interval < 0) {
        return "already passed";
    }
    if (time_interval < Utility.one_hour) {
        return "in " + Utility.setPrecision(time_interval / Utility.one_minute, precision) + " minutes";
    }
    if (time_interval < Utility.one_day) {
        return "in " + Utility.setPrecision(time_interval / Utility.one_hour, precision) + " hours";
    }
    if (time_interval < Utility.one_month) {
        return "in " + Utility.setPrecision(time_interval / Utility.one_day, precision) + " days";
    }
    if (time_interval < Utility.one_year) {
        return "in " + Utility.setPrecision(time_interval / Utility.one_month, precision) + " months";
    }
    return "in " + Utility.setPrecision(time_interval / Utility.one_year, precision) + " years";
};

//Number

Utility.setPrecision = function (number, precision) {
    return parseFloat(number.toFixed(precision));
};

Utility.getUniqueID = function() {
    return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
};

Utility.clamp = function (value, low, high) {
    return Math.max(low, Math.min(value, high));
};

//String

Utility.titleizeString = function (string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
};

Utility.maxLengthString = function (string, length) {
    let check_length = (length ? length : Utility.max_column_characters);
    if (string.length > check_length) {
        string = string.slice(0, check_length - 1) + '…';
    }
    return string;
};

Utility.kebabCase = function (string) {
    return string.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase();
};

Utility.camelCase = function (string) {
    return string.replace(/[-_]([a-z])/g, (_, letter) => letter.toUpperCase());
};

Utility.snakeCase = function (string) {
    return string.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/[\s-]+/g, '_').toLowerCase();
};

Utility.displayCase = function (string) {
    return Utility.titleizeString(string.replace(/[_-]/g, ' '));
};

Utility.padNumber = function (num, size) {
    var s = String(num);
    return s.padStart(size, '0');
};

Utility.sprintf = function (format, ...values) {
    return values.reduce((str, val) => str.replace(/%s/, val), format);
};

Utility.readableBytes = function (bytes) {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    let i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Utility.setPrecision((bytes / Math.pow(1024, i)), 2) + ' ' + sizes[i];
};

//Regex

Utility.findAll = function(str, regex) {
    return [...str.matchAll(regex)].flat();
};

Utility.regexpEscape = function (string) {
    return string.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
};

Utility.regexReplace = function (string, values) {
    const replaceTerm = (str, val, key) => str.replace(RegExp(`%${key}%`, 'g'), val);
    return Utility.objectReduce(values, replaceTerm, string);
};

Utility.safeMatch = function (string, regex, {group = 0, default_val = ""} = {}) {
    const match = string.match(regex);
    if (match) {
        return match[group];
    }
    return default_val;
};

//String array

Utility.filterRegex = function (array, regex, {negated = false} = {}) {
    return array.filter((entry) => _not(entry.match(regex), negated));
};

Utility.filterEmpty = function (array) {
    return Utility.filterRegex(array, /[\s\S]+/);
};

//Array

Utility.concat = function(array1, array2) {
    let result = Array(array1.length + array2.length);
    for(let i = 0; i < array1.length; i++){
        result[i] = array1[i];
    }
    for(let i = 0; i < array2.length; i++){
        result[array1.length + i] = array2[i];
    }
    return result;
};

Utility.multiConcat = function (...arrays) {
    if (arrays.length <= 1) {
        return arrays[0] || [];
    }
    let merged_array = arrays[0];
    for (let i = 1; i < arrays.length; i++) {
        merged_array = Utility.concat(merged_array, arrays[i]);
    }
    return merged_array;
};

//Unlike arrayUnion, this preservers the order of the concatted arrays
Utility.concatUnique = function (array1, array2) {
    return Utility.arrayUnique(Utility.concat(array1, array2));
};

Utility.isSet = function (data) {
    return data && data.constructor && data.constructor.name === "Set";
};

Utility.mergeSets = function(set1, set2) {
    let result = Utility.copySet(set1);
    for (let x of set2) {
        result.add(x);
    }
    return result;
};

Utility.copySet = function(set) {
    let result = new Set();
    for (let x of set) {
        result.add(x);
    }
    return result;
};

Utility.setToArray = function (set) {
    let array = Array(set.size);
    let i = 0;
    for (let x of set) {
        array[i++] = x;
    }
    return array;
};

Utility.arrayToSet = function (array) {
    let set = new Set();
    for (let x of array) {
        set.add(x);
    }
    return set;
};

Utility.setUnion = function (set1, set2) {
    let [small, large] = _orderSets(set1, set2);
    const comparator = () => (true);
    return _setOperation(small, comparator, Utility.copySet(large));
};

Utility.setDifference = function (set1, set2) {
    const comparator = (val) => !set2.has(val);
    return _setOperation(set1, comparator);
};

Utility.setIntersection = function (set1, set2) {
    let [small, large] = _orderSets(set1, set2);
    const comparator = (val) => large.has(val);
    return _setOperation(small, comparator);
};

Utility.setSymmetricDifference = function (set1, set2) {
    let combined = Utility.setUnion(set1, set2);
    let comparator = (val) => !(set1.has(val) && set2.has(val));
    return _setOperation(combined, comparator);
};

Utility.setEquals = function (set1, set2) {
    if (!Utility.isSet(set1) || !Utility.isSet(set2)) {
        return false;
    }
    if (set1.size !== set2.size) {
        return false;
    }
    let [small, large] = _orderSets(set1, set2);
    return Utility.setEvery(small, (val) => large.has(val));
};

Utility.setEvery = function (set, func) {
    for (let value of set) {
        if (!func(value, value, set)) {
            return false;
        }
    }
    return true;
};

Utility.setSome = function (set, func) {
    for (let value of set) {
        if (func(value, value, set)) {
            return true;
        }
    }
    return false;
};

Utility.setMap = function (set, func) {
    let retval = new Set();
    for (let value of set) {
        retval.add(func(value, value, set));
    }
    return retval;
};

Utility.setFilter = function (set, func) {
    let retval = new Set();
    for (let value of set) {
        if (func(value, value, set)) {
            retval.add(value);
        }
    }
    return retval;
};

Utility.setReduce = function (set, func, acc) {
    for (let value of set) {
        acc = func(acc, value, value, set);
    }
    return acc;
};

Utility.isSubSet = function (set1, set2) {
    return Utility.setEvery(set2, (val) => set1.has(val));
};

Utility.isSuperSet = function (set1, set2) {
    return Utility.isSubSet(set2, set1);
};

Utility.setHasIntersection = function (set1, set2) {
    let [small, large] = _orderSets(set1, set2);
    return Utility.setSome(small, (val) => large.has(val));
};

Utility.arrayUnique = function (array) {
    return Utility.setToArray(Utility.arrayToSet(array));
};

Utility.arrayUnion = function (array1, array2) {
    let [set1, set2] = _makeSets(array1, array2);
    return Utility.setToArray(Utility.setUnion(set1, set2));
};

Utility.arrayDifference = function (array1, array2) {
    let [set1, set2] = _makeSets(array1, array2);
    return Utility.setToArray(Utility.setDifference(set1, set2));
};

Utility.arrayIntersection = function (array1, array2) {
    let [set1, set2] = _makeSets(array1, array2);
    return Utility.setToArray(Utility.setIntersection(set1, set2));
};

Utility.arraySymmetricDifference = function (array1, array2) {
    let [set1, set2] = _makeSets(array1, array2);
    return Utility.setToArray(Utility.setSymmetricDifference(set1, set2));
};

Utility.isSubArray = function (array1, array2) {
    let [set1, set2] = _makeSets(array1, array2);
    return Utility.isSubSet(set1, set2);
};

Utility.isSuperArray = function (array1, array2) {
    return Utility.isSubArray(array2, array1);
};

Utility.arrayEquals = function (array1, array2) {
    if (!Utility.isArray(array1) || !Utility.isArray(array2)) {
        return false;
    }
    if (array1.length !== array2.length) {
        return false;
    }
    let [set1, set2] = _makeSets(array1, array2);
    return Utility.setEquals(set1, set2);
};

Utility.arrayHasIntersection = function (array1, array2) {
    let [set1, set2] = _makeSets(array1, array2);
    return Utility.setHasIntersection(set1, set2);
};

Utility.joinList = function (array, {prefix = "", suffix = "", joiner = ""} = {}) {
    return array.map((level) => (prefix + level + suffix)).join(joiner);
};

//Object

Utility.deepFreeze = function (obj) {
    for (let key in obj) {
        if (Utility.isHash(obj[key])) {
            Utility.deepFreeze(obj[key]);
        }
    }
    if (!Object.isFrozen(obj)) {
        Object.freeze(obj);
    }
    return obj;
};

Utility.getObjectAttributes = function (object, attribute) {
    const mapFunc = (val) => val[attribute];
    if (Utility.isArray(object)) {
        return object.map(mapFunc);
    } if (Utility.isSet(object)) {
        return Utility.setMap(object, mapFunc);
    }
    throw new Error("Utility.getObjectAttributes: Unhandled object type");
};

Utility.getNestedAttribute = function (data, attributes) {
    for (let i = 0; i < attributes.length; i++) {
        let attribute = attributes[i];
        data = data[attribute];
        if (data === undefined) {
            return null;
        }
    }
    return data;
};

Utility.getNestedObjectAttributes = function (data, attributes) {
    for (let i = 0; i < attributes.length; i++) {
        let attribute = attributes[i];
        data = Utility.getObjectAttributes(data, attribute);
        if (data.length === 0 || data[0] === undefined) {
            return null;
        }
    }
    return data;
};

Utility.objectReduce = function (object, reducer, accumulator) {
    for (let key in object) {
        accumulator = reducer(accumulator, object[key], key, object);
    }
    return accumulator;
};

//Deep copy an object or array
Utility.dataCopy = function (olddata) {
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
            value = Utility.dataCopy(value);
        }
        copyMethod(key, value);
    }
    return newdata;
};

Utility.mergeObjects = function (...objects) {
    let result = Utility.dataCopy(objects[0]);
    for (let i = 1; i < objects.length; i++) {
        for (let k in objects[i]) {
            if (Utility.isHash(result[k]) && Utility.isHash(objects[i][k])) {
                result[k] = Utility.mergeObjects(result[k], objects[i][k]);
            } else {
                result[k] = Utility.dataCopy(objects[i][k]);
            }
        }
    }
    return result;
};

//Compare two objects to detect changes to the first
Utility.compareObjects = function (object1, object2) {
    let difference = {};
    for (let key in object1) {
        if (Utility.isHash(object1[key])) {
            let temp = Utility.compareObjects(object1[key], object2[key]);
            if (temp !== undefined) {
                difference[key] = temp;
            }
        } else if (object1[key] !== object2[key]) {
            difference[key] = {old_val: object1[key], new_val: object2[key]};
        }
    }
    return (Object.keys(difference).length > 0 ? difference : undefined);
};

Utility.arrayFill = function (length, stringified_json) {
    return Array(length).fill().map(() => JSON.parse(stringified_json));
};

Utility.arrayRemove = function (array, item) {
    var index = array.indexOf(item);
    if (index > -1) {
        array.splice(index, 1);
    }
};

//Promise

Utility.createPromise = function () {
    var resolve, reject;
    function resolver(_resolve, _reject) {
        resolve = _resolve;
        reject = _reject;
    }
    var promise = new Promise(resolver);
    return {promise, resolve, reject};
};

Utility.createStatusPromise = function () {
    const ret = Utility.createPromise();
    const timer = Utility.initializeInterval(() => {
        _promiseState(ret.promise).then((state) => {
            ret.status = state.status;
            if (ret.status !== 'pending') {
                clearInterval(timer);
            }
        });
    }, 100);
    return ret;
};

Utility.promiseHashAll = async function (promise_hash) {
    const correlate = function (hash, parr = null) {
        parr ??= [];
        for (let key in hash) {
            if (hash[key].constructor.name === 'Promise') {
                parr.push(hash[key]);
            } else if (Utility.isHash(hash[key])) {
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
            } else if (Utility.isHash(hash[key])) {
                result[key] = resolve(hash[key]);
            }
        }
        return result;
    };
    let promise_array = correlate(promise_hash);
    let result_array = await Promise.all(promise_array);
    return resolve(promise_hash);
};

//CSS

Utility.addStyleSheet = function (url, title) {
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
Utility.setCSSStyle = function (csstext, title) {
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

Utility.hasStyle = function (name) {
    return name in CSS_STYLE;
};

//DOM

Utility.getjQueryObj = function (selector) {
    if (typeof selector === 'string' || selector instanceof HTMLBodyElement) {
        return jQueryProxy(selector);
    }
    if (selector instanceof jQueryProxy) {
        return selector;
    }
    throw new Error("Bad selector.");
};

Utility.DOMtoArray = function (obj) {
    var array = [];
    for (let i = obj.length; i--;) {
        array[i] = obj[i];
    }
    return array;
};

Utility.DOMtoHash = function (obj) {
    var hash = {};
    for (let key in obj) {
        hash[key] = obj[key];
    }
    return hash;
};

Utility.getPrivateData = function ($dom_object) {
    if ($dom_object) {
        let private_expando = _getExpando(true);
        if (private_expando && private_expando in $dom_object) {
            return $dom_object[private_expando];
        }
    }
    return {};
};

Utility.getPublicData = function ($dom_object) {
    if ($dom_object) {
        let public_expando = _getExpando(false);
        if (public_expando && public_expando in $dom_object) {
            return $dom_object[public_expando];
        }
        return Utility.getDOMDataset($dom_object);
    }
    return {};
};

Utility.getAttr = function (domobj, key) {
    if (typeof key === 'string') {
        return domobj.attributes[key].value;
    }
    let data = {};
    for (let attr of domobj.attributes) {
        if (Utility.isArray(key) && !key.includes(attr.name)) continue;
        data[attr.name] = attr.value;
    }
    return data;
};

Utility.getDOMArrayDataValues = function ($dom_array, key, {parser = null} = {}) {
    let data_key = Utility.camelCase(key);
    let results = Array($dom_array.length);
    for (let i = 0; i < $dom_array.length; i++) {
        results[i] = $dom_array[i].dataset[data_key];
        if (typeof parser === 'function') {
            results[i] = parser(results[i]);
        }
    }
    return results;
};

Utility.getDOMDataset = function ($dom_object) {
    let dataset = Utility.DOMtoHash($dom_object.dataset);
    for (let key in dataset) {
        try {
            dataset[key] = JSON.parse(dataset[key]);
        } catch (e) {
            //swallow
        }
    }
    return dataset;
};

Utility.getBoundEventNames = function (root, eventtype, selector) {
    let $obj = _getObjRoot(root);
    if ($obj === null) {
        return [];
    }
    let private_data = Utility.getPrivateData($obj);
    let boundevents = 'events' in private_data && private_data.events;
    if (!boundevents || !(eventtype in boundevents)) {
        return [];
    }
    let selector_events = boundevents[eventtype].filter((entry) => (entry.selector === selector || (selector === undefined && entry.selector === null) || (selector === null && entry.selector === undefined)));
    return selector_events.map((entry) => entry.namespace);
};

Utility.isNamespaceBound = function ({root = null, eventtype = null, namespace = null, selector = null} = {}) {
    let event_namespaces = Utility.getBoundEventNames(root, eventtype, selector);
    let name_parts = namespace.split('.');
    return event_namespaces.some((name) => Utility.isSubArray(name.split('.'), name_parts));
};

Utility.isGlobalFunctionBound = function (name) {
    let private_data = Utility.getPrivateData(document);
    return private_data && 'events' in private_data && Object.keys(private_data.events).includes(name);
};

Utility.getDOMDataKeys = function (selector) {
    let $obj = JSPLib._document.querySelector(selector);
    return Object.keys(Utility.getPublicData($obj));
};

Utility.hasDOMDataKey = function ({selector = null, key = null} = {}) {
    return Utility.getDOMDataKeys(selector).includes(key);
};

Utility.setDataAttribute = function (obj, key, value) {
    let $obj = ('length' in obj ? obj : [obj]);
    for (let i = 0; i < obj.length; i++) {
        let expando = _getExpando(false);
        if (expando in $obj) {
            let public_data = Utility.getPublicData($obj);
            public_data[key] = value;
        }
        $obj[i].setAttribute('data-' + key, value);
    }
};

Utility.getElemPosition = function (domnode) {
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

Utility.isScrolledIntoView = function (domnode, {view_percentage = 0.75} = {}) {
    let docViewTop = JSPLib._window.scrollY;
    let docViewBottom = docViewTop + JSPLib._window.innerHeight;
    let {top: elemTop} = Utility.getElemPosition(domnode);
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

Utility.getMeta = function (key) {
    let $obj = JSPLib._document.querySelector("meta[name=" + key + "]");
    return $obj && $obj.content;
};

//Event handlers

Utility.setPropertyTrap = function (object, property, {value = null, getter = null, setter = null, caller = null} = {}) {
    // For subproperties that are accessed/written/called after an object is initialized
    value ??= object[property] ?? {};
    let handler = {};
    if (getter) {
        handler.get = function (_target, prop, _receiver) {
            getter(prop);
            return value[prop];
        };
    }
    if (setter) {
        handler.set = function (_target, prop, val, _receiver) {
            setter(prop, val);
            value[prop] = val;
        };
    }
    if (caller) {
        handler.apply = function (_target, this_arg, args) {
            caller(args);
            return value.apply(this_arg, args);
        };
    }
    object[property] = new Proxy(object, handler);
    Object.defineProperty(object, property, {
        configurable: false,
        enumerable: true,
        writeable: false,
    });
};

//Interval

Utility.initializeInterval = function (func, time) {
    let retval = func();
    if (retval === false || retval === undefined) {
        return setInterval(func, time);
    }
    return true;
};

Utility.recheckInterval = function ({check = null, success = null, debug = null, fail = null, always = null, duration = null, interval = null} = {}) {
    let expires = Utility.isInteger(duration) && Utility.getExpires(duration);
    var timeobj = {};
    var timer = null;
    timer = timeobj.timer = Utility.initializeInterval(() => {
        if (check?.()) {
            success?.();
            timeobj.timer = true;
        } else if (!expires || Utility.validateExpires(expires)) {
            debug?.();
            return false;
        } else {
            fail?.();
            timeobj.timer = false;
        }
        always?.();
        if (Utility.isInteger(timer)) {
            clearInterval(timer);
        }
        return true;
    }, interval);
    return timeobj;
};

Utility.DOMWaitExecute = function ({global_check = null, namespace_check = null, data_check = null, extra_check = null, found = null, interval = null, duration = null, name = null} = {}) {
    const printer = Debug.getFunctionPrint('Utility.DOMWaitExecute', name === null);
    const negateCheck = function (func, options) {
        let check = func.apply(Utility, [options]);
        if (options.negate) {
            check = _not(check, options.negate);
        }
        return check;
    };
    Utility.recheckInterval({
        check: () => {
            let checks = [];
            if (global_check !== null) {
                checks.push(negateCheck(Utility.isGlobalFunctionBound, global_check));
            }
            if (namespace_check !== null) {
                checks.push(negateCheck(Utility.isNamespaceBound, namespace_check));
            }
            if (data_check !== null) {
                checks.push(negateCheck(Utility.hasDOMDataKey, data_check));
            }
            if (extra_check !== null) {
                checks.push(extra_check());
            }
            return checks.every((c) => c);
        },
        debug: () => printer.logLevel(`Waiting on DOM: ${name}.`, Debug.VERBOSE),
        fail: () => printer.logLevel(`Failed to execute: ${name}.`, Debug.WARNING),
        exec: () => {
            printer.logLevel(`Event triggered: ${name}.`, Debug.INFO);
            found();
        },
        interval,
        duration,
    });
};

//Cookie

Utility.createCookie = function (name, value, days, domain) {
    let cookie_text = name + '=' + value;
    if (days) {
        let date = new Date();
        date.setTime(date.getTime() + (days * Utility.one_day));
        cookie_text += '; expires=' + date.toGMTString();
    }
    if (domain) {
        cookie_text += '; domain=' + domain;
    }
    JSPLib._document.cookie = cookie_text + '; path=/; SameSite=Lax;';
};

Utility.readCookie = function (name) {
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

Utility.eraseCookie = function (name, domain) {
    Utility.createCookie(name, "", -1, domain);
};

//HTML/URL

Utility.getDomainName = function (url, {level = 0} = {}) {
    let parser = new URL(url);
    let domain_levels = parser.hostname.split('.');
    return domain_levels.slice(level * -1).join('.');
};

Utility.parseParams = function (str) {
    if (str === "") return {};
    str = (str.startsWith('?') ? str.slice(1) : str);
    return str.split('&').reduce((params, param) => {
        var paramSplit = param.split('=').map((value) => decodeURIComponent(value.replace(/\+/g, ' ')));
        params[paramSplit[0]] = paramSplit[1];
        return params;
    }, {});
};

Utility.renderParams = function (params) {
    const normalizeValue = function (value) {
        return encodeURIComponent(value).replaceAll(/%20/g, '+').replace(/%2c/gi, ',');
    };
    const renderParamsRecurse = function (subparams, param_key = "", param_array = []) {
        for (let key in subparams) {
            let enc_key = encodeURIComponent(key);
            let subparam_key = (param_key === "" ? enc_key : param_key + `[${enc_key}]`);
            if (subparams[key] === null) {
                param_array.push(subparam_key + '=');
            } else if (Utility.isHash(subparams[key])) {
                param_array = renderParamsRecurse(subparams[key], subparam_key, param_array);
            } else if (Utility.isArray(subparams[key])) {
                for (let i = 0; i < subparams[key].length; i++) {
                    param_array.push(subparam_key + '[]=' + normalizeValue(subparams[key][i]));
                }
            } else {
                param_array.push(subparam_key + '=' + normalizeValue(subparams[key]));
            }
        }
        return param_array;
    };
    let param_array = renderParamsRecurse(params);
    return param_array.join('&');
};

Utility.renderHTMLTag = function (tagname, text, options = {}) {
    let attributes = [];
    for (let attr in options) {
        let attr_key = Utility.kebabCase(attr);
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

Utility.HTMLEscape = function (str) {
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

//Validation

Utility.isBoolean = function (value) {
    return typeof value === "boolean";
};

Utility.isString = function (value) {
    return typeof value === "string";
};

Utility.isNumber = function (value) {
    return typeof value === 'number' && !isNaN(value);
};

Utility.isInteger = function (value) {
    return Number.isInteger(value);
};

Utility.isHash = function (value) {
    return value?.constructor?.name === 'Object';
};

Utility.isArray = function (value) {
    return value?.constructor?.name === 'Array';
};

Utility.validateID = function (value) {
    return Utility.isInteger(value) && (value > 0);
};

Utility.validateIDList = function (array) {
    return Utility.isArray(array) && ((array.length === 0) || ((array.length > 0) && array.reduce((total, val) => Utility.validateID(val) && total, true)));
};

//Other

Utility.createBroadcastChannel = function (name, func) {
    let channel = new BroadcastChannel(name);
    channel.onmessage = func;
    return channel;
};

//So that throw statements can be used in more places like ternary operators
Utility.throwError = function(e) {
    if (e.constructor?.name === 'Error') {
        throw e;
    }
    throw new Error(e);
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
    return arrays.map((array) => Utility.arrayToSet(array));
}

function _orderSets(set1, set2) {
    return (set1.size > set2.size ? [set2, set1] : [set1, set2]);
}

function _promiseState(promise) {
    const pendingState = {status: 'pending'};
    return Promise.race([promise, pendingState]).then(
        (value) => (value === pendingState ? value : {status: 'resolved', value}),
        (reason) => ({status: 'rejected', reason}),
    );
}

function _getExpando(is_private) {
    return jQueryProxy.expando + (is_private ? '1' : '2');
}

function _getObjRoot(root) {
    return (typeof root !== 'string' ? root : JSPLib._document.querySelector(root));
}

/****INITIALIZATION****/

JSPLib.initializeModule('utility', {
    nonwritable: ['one_second', 'one_minute', 'one_hour', 'one_day', 'one_week', 'one_month', 'one_year']
});

})(JSPLib);
