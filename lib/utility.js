/****DEPENDENCIES****/

/**External dependencies**/
// jQuery (optional)

/****SETUP****/

//Linter configuration
/* global JSPLib */

JSPLib.utility = {};

/****GLOBAL VARIABLES****/

JSPLib.utility.max_column_characters = 20;

//Time constants

JSPLib.utility.one_second = 1000;
JSPLib.utility.one_minute = JSPLib.utility.one_second * 60;
JSPLib.utility.one_hour = JSPLib.utility.one_minute * 60;
JSPLib.utility.one_day = JSPLib.utility.one_hour * 24;
JSPLib.utility.one_week = JSPLib.utility.one_day * 7;
JSPLib.utility.one_year = JSPLib.utility.one_day * 365.2425;
JSPLib.utility.one_month = JSPLib.utility.one_year / 12;

//Regex constants

JSPLib.utility.WORDBREAK_REGEX = /\(+|\)+|[\s_]+|[^\s_()]+/g;
JSPLib.utility.ROMAN_REGEX = /^M?M?M?(CM|CD|D?C?C?C?)(XC|XL|L?X?X?X?)(IX|IV|V?I?I?I?)$/i;

//String constants

JSPLib.utility.NONTITLEIZE_WORDS = ['a', 'an', 'of', 'the', 'is'];

//CSS constants

JSPLib.utility.AT_BLOCK_RULES = /^@(?:counter-style|container|font-face|font-feature-values|keyframes|layer|media|page|position-try|property|scope|starting-style|supports|view-transition)[ {]/;
JSPLib.utility.AT_STATEMENT_RULES = /^@(?:charset|import|layer|namespace) /;

/****FUNCTIONS****/

//Time

JSPLib.utility.sleep = function (ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

JSPLib.utility.getExpires = function (expires) {
    return Math.round(Date.now() + expires);
};

JSPLib.utility.validateExpires = function (actual_expires, expected_expires) {
    //Resolve to false if the actual_expires is bogus, has expired, or the expiration is too long
    return Number.isInteger(actual_expires) && (Date.now() <= actual_expires) && (!Number.isInteger(expected_expires) || ((actual_expires - Date.now()) <= expected_expires));
};

JSPLib.utility.getProgramTime = function () {
    let current = performance.now();
    JSPLib.debug.debuglogLevel("utility.getProgramTime", {current, window: JSPLib.info.start, script: JSPLib._start_time}, JSPLib.debug.DEBUG);
    return {manager: current - JSPLib.info.start, script: current - JSPLib._start_time};
};

JSPLib.utility.timeAgo = function (time_value, {precision = 2, compare_time = null, recent_duration = null} = {}) {
    let timestamp = this.toTimeStamp(time_value);
    if (!this._isTimestamp(timestamp)) return "N/A";
    compare_time ??= Date.now();
    let time_interval = compare_time - timestamp;
    if (this._isTimestamp(recent_duration) && time_interval < recent_duration) {
        return "recently";
    }
    if (time_interval < JSPLib.utility.one_hour) {
        return this.setPrecision(time_interval / JSPLib.utility.one_minute, precision) + " minutes ago";
    }
    if (time_interval < JSPLib.utility.one_day) {
        return this.setPrecision(time_interval / JSPLib.utility.one_hour, precision) + " hours ago";
    }
    if (time_interval < JSPLib.utility.one_month) {
        return this.setPrecision(time_interval / JSPLib.utility.one_day, precision) + " days ago";
    }
    if (time_interval < JSPLib.utility.one_year) {
        return this.setPrecision(time_interval / JSPLib.utility.one_month, precision) + " months ago";
    }
    return this.setPrecision(time_interval / JSPLib.utility.one_year, precision) + " years ago";
};

JSPLib.utility.toTimeStamp = function (time_value) {
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

JSPLib.utility.timeFromNow = function (time_value, {precision = 2, compare_time = null, recent_duration = null} = {}) {
    let timestamp = this.toTimeStamp(time_value);
    if (!this._isTimestamp(timestamp)) return "N/A";
    compare_time ??= Date.now();
    let time_interval = timestamp - compare_time;
    if (this._isTimestamp(recent_duration) && time_interval < recent_duration) {
        return "soon";
    }
    if (time_interval < 0) {
        return "already passed";
    }
    if (time_interval < JSPLib.utility.one_hour) {
        return "in " + this.setPrecision(time_interval / JSPLib.utility.one_minute, precision) + " minutes";
    }
    if (time_interval < JSPLib.utility.one_day) {
        return "in " + this.setPrecision(time_interval / JSPLib.utility.one_hour, precision) + " hours";
    }
    if (time_interval < JSPLib.utility.one_month) {
        return "in " + this.setPrecision(time_interval / JSPLib.utility.one_day, precision) + " days";
    }
    if (time_interval < JSPLib.utility.one_year) {
        return "in " + this.setPrecision(time_interval / JSPLib.utility.one_month, precision) + " months";
    }
    return "in " + this.setPrecision(time_interval / JSPLib.utility.one_year, precision) + " years";
};

//Number

JSPLib.utility.isDigit = function (input) {
    return typeof input === 'string' && /^\d+$/.test(input);
};

JSPLib.utility.bigIntMax = function (...args) {
    return args.reduce((max, comp) => (max > comp ? max : comp));
};

JSPLib.utility.bigIntMin = function (...args) {
    return args.reduce((min, comp) => (min < comp ? min : comp));
};

JSPLib.utility.setPrecision = function (number, precision) {
    return parseFloat(number.toFixed(precision));
};

JSPLib.utility.getUniqueID = function() {
    return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
};

JSPLib.utility.clamp = function (value, low, high) {
    return Math.max(low, Math.min(value, high));
};

//String

JSPLib.utility.titleizeString = function (string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
};

JSPLib.utility.titleizeExcept = function (word) {
    return (this.NONTITLEIZE_WORDS.includes(word) ? word : this.titleizeString(word));
};

JSPLib.utility.titleizeRoman = function (word) {
    return (word.match(this.ROMAN_REGEX) ? word.toUpperCase() : this.titleizeExcept(word));
};

JSPLib.utility.maxLengthString = function (string, length) {
    let check_length = (length ? length : this.max_column_characters);
    if (string.length > check_length) {
        string = string.slice(0, check_length - 1) + '…';
    }
    return string;
};

JSPLib.utility.kebabCase = function (string) {
    return string.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase();
};

JSPLib.utility.camelCase = function (string) {
    return string.replace(/[-_]([a-z])/g, (_, letter) => letter.toUpperCase());
};

JSPLib.utility.snakeCase = function (string) {
    return string.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/[\s-]+/g, '_').toLowerCase();
};

JSPLib.utility.displayCase = function (string) {
    return this.titleizeString(string.replace(/[_-]/g, ' '));
};

JSPLib.utility.properCase = function (string) {
    return string.match(this.WORDBREAK_REGEX).map((word) => this.titleizeString(word)).join("");
};

JSPLib.utility.exceptCase = function (string) {
    return string.match(this.WORDBREAK_REGEX).map((word) => this.titleizeExcept(word)).join("");
};

JSPLib.utility.romanCase = function (string) {
    return string.match(this.WORDBREAK_REGEX).map((word) => this.titleizeRoman(word)).join("");
};

JSPLib.utility.padNumber = function (num, size) {
    var s = String(num);
    return s.padStart(size, '0');
};

JSPLib.utility.sprintf = function (format, ...values) {
    return values.reduce((str, val) => str.replace(/%s/, val), format);
};

JSPLib.utility.readableBytes = function (bytes) {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    let i = Math.floor(Math.log(bytes) / Math.log(1024));
    return this.setPrecision((bytes / Math.pow(1024, i)), 2) + ' ' + sizes[i];
};

JSPLib.utility.renderTemplate = function (literals, args, mapping) {
    let output = "";
    for (let i = 0; i < literals.raw.length; i++) {
        output += literals.raw[i];
        if (i < args.length) {
            var insert;
            if (this.isHash(mapping)) {
                if (args[i] in mapping) {
                    insert = mapping[args[i]];
                } else if (this.isHash(args[i])) {
                    insert = Object.values(args[i]).at(0);
                } else {
                    insert = "";
                }
            } else {
                insert = args[i];
            }
            output += insert;
        }
    }
    return output;
};

JSPLib.utility.generateTemplate = function (func, literals, args) {
    return function (mapping = {}) {
        return func(JSPLib.utility.renderTemplate(literals, args, mapping));
    };
};

JSPLib.utility.trim = function (literals, ...args) {
    return this.renderTemplate(literals, args).trim();
};

//Regex

JSPLib.utility.verboseRegex = function (flags) {
    return function (literals, ...args) {
        let output = JSPLib.utility.renderTemplate(literals, args);
        return RegExp(output.replace(/\s+/g, ""), flags);
    };
};

JSPLib.utility.findAll = function(str, regex) {
    return [...str.matchAll(regex)].flat();
};

JSPLib.utility.regexpEscape = function (string) {
    return string.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
};

JSPLib.utility.regexReplace = function (string, values) {
    const replaceTerm = (str, val, key) => str.replace(RegExp(`%${key}%`, 'g'), val);
    return this.objectReduce(values, replaceTerm, string);
};

JSPLib.utility.safeMatch = function (string, regex, group = 0, defaultValue = "") {
    const match = string.match(regex);
    if (match) {
        return match[group];
    }
    return defaultValue;
};

//String array

JSPLib.utility.filterRegex = function (array, regex, reverse = false) {
    return array.filter((entry) => this._not(entry.match(regex), reverse));
};

JSPLib.utility.filterEmpty = function (array) {
    return this.filterRegex(array, /[\s\S]+/);
};

//Array

JSPLib.utility.concat = function(array1, array2) {
    let result = Array(array1.length + array2.length);
    for(let i = 0; i < array1.length; i++){
        result[i] = array1[i];
    }
    for(let i = 0; i < array2.length; i++){
        result[array1.length + i] = array2[i];
    }
    return result;
};

JSPLib.utility.multiConcat = function (...arrays) {
    if (arrays.length <= 1) {
        return arrays[0] || [];
    }
    let merged_array = arrays[0];
    for (let i = 1; i < arrays.length; i++) {
        merged_array = this.concat(merged_array, arrays[i]);
    }
    return merged_array;
};

//Unlike arrayUnion, this preservers the order of the concatted arrays
JSPLib.utility.concatUnique = function (array1, array2) {
    return this.arrayUnique(this.concat(array1, array2));
};

JSPLib.utility.isSet = function (data) {
    return data && data.constructor && data.constructor.name === "Set";
};

JSPLib.utility.mergeSets = function(set1, set2) {
    let result = this.copySet(set1);
    for (let x of set2) {
        result.add(x);
    }
    return result;
};

JSPLib.utility.copySet = function(set) {
    let result = new Set();
    for (let x of set) {
        result.add(x);
    }
    return result;
};

JSPLib.utility.setToArray = function (set) {
    let array = Array(set.size);
    let i = 0;
    for (let x of set) {
        array[i++] = x;
    }
    return array;
};

JSPLib.utility.arrayToSet = function (array) {
    let set = new Set();
    for (let x of array) {
        set.add(x);
    }
    return set;
};

JSPLib.utility.setUnion = function (set1, set2) {
    let [small, large] = this._orderSets(set1, set2);
    const comparator = () => (true);
    return this._setOperation(small, comparator, this.copySet(large));
};

JSPLib.utility.setDifference = function (set1, set2) {
    const comparator = (val) => !set2.has(val);
    return this._setOperation(set1, comparator);
};

JSPLib.utility.setIntersection = function (set1, set2) {
    let [small, large] = this._orderSets(set1, set2);
    const comparator = (val) => large.has(val);
    return this._setOperation(small, comparator);
};

JSPLib.utility.setSymmetricDifference = function (set1, set2) {
    let combined = this.setUnion(set1, set2);
    let comparator = (val) => !(set1.has(val) && set2.has(val));
    return this._setOperation(combined, comparator);
};

JSPLib.utility.setEquals = function (set1, set2) {
    if (!this.isSet(set1) || !this.isSet(set2)) {
        return false;
    }
    if (set1.size !== set2.size) {
        return false;
    }
    let [small, large] = this._orderSets(set1, set2);
    return this.setEvery(small, (val) => large.has(val));
};

JSPLib.utility.setEvery = function (set, func) {
    for (let value of set) {
        if (!func(value, value, set)) {
            return false;
        }
    }
    return true;
};

JSPLib.utility.setSome = function (set, func) {
    for (let value of set) {
        if (func(value, value, set)) {
            return true;
        }
    }
    return false;
};

JSPLib.utility.setMap = function (set, func) {
    let retval = new Set();
    for (let value of set) {
        retval.add(func(value, value, set));
    }
    return retval;
};

JSPLib.utility.setFilter = function (set, func) {
    let retval = new Set();
    for (let value of set) {
        if (func(value, value, set)) {
            retval.add(value);
        }
    }
    return retval;
};

JSPLib.utility.setReduce = function (set, func, acc) {
    for (let value of set) {
        acc = func(acc, value, value, set);
    }
    return acc;
};

JSPLib.utility.isSubSet = function (set1, set2) {
    return this.setEvery(set2, (val) => set1.has(val));
};

JSPLib.utility.isSuperSet = function (set1, set2) {
    return this.isSubSet(set2, set1);
};

JSPLib.utility.setHasIntersection = function (set1, set2) {
    let [small, large] = this._orderSets(set1, set2);
    return this.setSome(small, (val) => large.has(val));
};

JSPLib.utility.arrayUnique = function (array) {
    return this.setToArray(this.arrayToSet(array));
};

JSPLib.utility.arrayUnion = function (array1, array2) {
    let [set1, set2] = this._makeSets(array1, array2);
    return this.setToArray(this.setUnion(set1, set2));
};

JSPLib.utility.arrayDifference = function (array1, array2) {
    let [set1, set2] = this._makeSets(array1, array2);
    return this.setToArray(this.setDifference(set1, set2));
};

JSPLib.utility.arrayIntersection = function (array1, array2) {
    let [set1, set2] = this._makeSets(array1, array2);
    return this.setToArray(this.setIntersection(set1, set2));
};

JSPLib.utility.arraySymmetricDifference = function (array1, array2) {
    let [set1, set2] = this._makeSets(array1, array2);
    return this.setToArray(this.setSymmetricDifference(set1, set2));
};

JSPLib.utility.isSubArray = function (array1, array2) {
    let [set1, set2] = this._makeSets(array1, array2);
    return this.isSubSet(set1, set2);
};

JSPLib.utility.isSuperArray = function (array1, array2) {
    return this.isSubArray(array2, array1);
};

JSPLib.utility.arrayEquals = function (array1, array2) {
    if (!Array.isArray(array1) || !Array.isArray(array2)) {
        return false;
    }
    if (array1.length !== array2.length) {
        return false;
    }
    let [set1, set2] = this._makeSets(array1, array2);
    return this.setEquals(set1, set2);
};

JSPLib.utility.arrayHasIntersection = function (array1, array2) {
    let [set1, set2] = this._makeSets(array1, array2);
    return this.setHasIntersection(set1, set2);
};

//Filter a list of objects with a list of values
JSPLib.utility.listFilter = function (array, itemlist, itemkey, reverse = false) {
    return array.filter((item) => this._not(itemlist.includes(item[itemkey]), reverse));
};

JSPLib.utility.joinList = function (array, prefix, suffix, joiner) {
    prefix = prefix || '';
    suffix = suffix || '';
    return array.map((level) => (prefix + level + suffix)).join(joiner);
};

//Object

JSPLib.utility.freezeObject = function (object, recurse = false) {
    if (recurse) {
        for (let key in object) {
            let value = object[key];
            if (typeof value === "object" && value !== null) {
                this.freezeObject(value, true);
                Object.freeze(value);
            }
        }
    }
    Object.freeze(object);
};

JSPLib.utility.freezeObjects = function (object_array, recurse) {
    object_array.forEach((val) => {this.freezeObject(val, recurse);});
};

//To freeze individual properties of an object
JSPLib.utility.freezeProperty = function (object, property) {
    Object.defineProperty(object, property, { configurable: false, writable: false });
};

JSPLib.utility.freezeProperties = function (object, property_list) {
    property_list.forEach((property) => {this.freezeProperty(object, property);});
};

JSPLib.utility.getObjectAttributes = function (object, attribute) {
    if (Array.isArray(object)) {
        return object.map((val) => val[attribute]);
    } if (this.isSet(object)) {
        return this.setMap(object, (val) => val[attribute]);
    }
    throw "JSPLib.utility.getObjectAttributes: Unhandled object type";
};


//Get nested attribute for single object
JSPLib.utility.getNestedAttribute = function (data, attributes) {
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
JSPLib.utility.getNestedObjectAttributes = function (data, attributes) {
    for (let i = 0; i < attributes.length; i++) {
        let attribute = attributes[i];
        data = this.getObjectAttributes(data, attribute);
        if (data.length === 0 || data[0] === undefined) {
            return null;
        }
    }
    return data;
};

JSPLib.utility.objectReduce = function (object, reducer, accumulator) {
    for (let key in object) {
        if (Object.prototype.hasOwnProperty.call(object, key)) {
            accumulator = reducer(accumulator, object[key], key, object);
        }
    }
    return accumulator;
};

//Deep copy an object or array
JSPLib.utility.dataCopy = function (olddata) {
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
            value = this.dataCopy(value);
        }
        copyMethod(key, value);
    }
    return newdata;
};

JSPLib.utility.mergeHashes = function (...hashes) {
    let result = this.dataCopy(hashes[0]);
    for (let i = 1; i < hashes.length; i++) {
        for (let k in hashes[i]) {
            if (this.isHash(result[k]) && this.isHash(hashes[i][k])) {
                result[k] = this.mergeHashes(result[k], hashes[i][k]);
            } else {
                result[k] = this.dataCopy(hashes[i][k]);
            }
        }
    }
    return result;
};

//Compare two objects to detect changes to the first
JSPLib.utility.recurseCompareObjects = function (object1, object2, difference = {}) {
    for (let key in object1) {
        if (object1[key] !== object2[key] && typeof object1[key] !== "object") {
            difference[key] = [object1[key], object2[key]];
        } else if (typeof object1[key] === "object") {
            difference[key] = {};
            this.recurseCompareObjects(object1[key], object2[key], difference[key]);
            //Delete empty objects
            if (Object.getOwnPropertyNames(difference[key]).length === 0) {
                delete difference[key];
            }
        }
    }
    return difference;
};

JSPLib.utility.arrayFill = function (length, stringified_json) {
    return Array(length).fill().map(() => JSON.parse(stringified_json));
};

JSPLib.utility.arrayRemove = function (array, item) {
    return array.filter((value) => (value !== item));
};

//Promise

JSPLib.utility.createPromise = function () {
    var resolve, reject;
    function resolver(_resolve, _reject) {
        resolve = _resolve;
        reject = _reject;
    }
    var promise = new Promise(resolver);
    return {promise, resolve, reject};
};

JSPLib.utility.promiseState = function (promise) {
    const pendingState = {status: 'pending'};
    return Promise.race([promise, pendingState]).then(
        (value) => (value === pendingState ? value : {status: 'resolved', value}),
        (reason) => ({status: 'rejected', reason}),
    );
};

JSPLib.utility.createStatusPromise = function () {
    const ret = this.createPromise();
    const timer = this.initializeInterval(() => {
        this.promiseState(ret.promise).then((state) => {
            ret.status = state.status;
            if (ret.status !== 'pending') {
                clearInterval(timer);
            }
        });
    }, 100);
    return ret;
};

JSPLib.utility.promiseHashAll = async function (promise_hash) {
    const correlate = function (hash, parr = null) {
        parr ??= [];
        for (let key in hash) {
            if (hash[key].constructor.name === 'Promise') {
                parr.push(hash[key]);
            } else if (JSPLib.utility.isHash(hash[key])) {
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
            } else if (JSPLib.utility.isHash(hash[key])) {
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

JSPLib.utility.hijackFunction = function (oldfunc, postfunc, {prefunc = null, key = null} = {}) {
    return function(...args) {
        if (prefunc) {
            prefunc.call(this, ...args);
        }
        let isasync = (oldfunc.constructor.name === "AsyncFunction");
        var timer;
        if (typeof key === "string") {
            let timer_key = key + '[' + this.getUniqueID() + ']';
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

JSPLib.utility.nestedCSSCheck = function ({multiline = true} = {}) {
    let context = this;
    return function (literals, ...args) {
        let output = context.renderTemplate(literals, args);
        if ('CSSNestedDeclarations' in JSPLib._window) {
            return output;
        }
        let rules = context.parseCSSRules(output);
        return context.renderUnnestedCSS(rules, {multiline});
    };
};

JSPLib.utility.addStyleSheet = function (url, title = '') {
    if (title in this._css_sheet) {
        this._css_sheet[title].href = url;
    } else {
        this._css_sheet[title] = JSPLib._document.createElement('link');
        this._css_sheet[title].rel = 'stylesheet';
        this._css_sheet[title].type = 'text/css';
        this._css_sheet[title].href = url;
        JSPLib._document.head.appendChild(this._css_sheet[title]);
    }
};

//Sets the css style and retains a pointer to the DOM object for later edits
JSPLib.utility.setCSSStyle = function (csstext, title) {
    if (title in this._css_style) {
        this._css_style[title].innerHTML = csstext;
    } else {
        this._css_style[title] = JSPLib._document.createElement('style');
        this._css_style[title].type = 'text/css';
        this._css_style[title].innerHTML = csstext;
        JSPLib._document.head.appendChild(this._css_style[title]);
    }
    return this._css_style[title];
};

JSPLib.utility.hasStyle = function (name) {
    return name in this._css_style;
};

JSPLib.utility.renderColorScheme = function (css_text, mode) {
    let lines = css_text.trim().split('\n');
    let theme_lines = [];
    let auto_lines = [];
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (/^[ /}]/.test(line)) {
            theme_lines.push(line);
            auto_lines.push('    ' + line);
        } else {
            theme_lines.push(`body[data-current-user-theme=${mode}] ${line}`);
            auto_lines.push(`    body[data-current-user-theme=auto] ${line}`);
        }
    }
    let theme_css = theme_lines.join('\n');
    let auto_css = `@media (prefers-color-scheme: ${mode}) {\n${auto_lines.join('\n')}\n}`;
    return '\n' + theme_css + '\n' + auto_css;
};

JSPLib.utility.renderUnnestedCSS = function (rules, {parent = ":root", indent = 0, multiline = true} = {}) {
    const renderComment = function (comment_array, spacing) {
        return comment_array.map((comm) => {
            let extra_space = (comm.startsWith('*') ? ' ' : "");
            return spacing + extra_space + comm;
        }).join('\n');
    };
    let css = "";
    let spacing = Array(indent).fill('    ').join("");
    let joiner = (multiline ? ',\n' : ', ');
    for (let i = 0; i < rules.length; i++) {
        let rule = rules[i];
        if (rule.statement !== null) {
            css += rule.statement + ';\n';
        } else if (rule.comment !== null) {
            css += renderComment(rule.comment, spacing) + '\n';
        } else if (rule.is_at_block_rule) {
            let block_css = "";
            for (let j = 0; j < rule.subrules.length; j++) {
                block_css += this.renderUnnestedCSS(rule.subrules[j], {indent: indent + 1, multiline});
            }
            css += spacing + rule.selectors.join(joiner + spacing) + ' {\n' + block_css + spacing + '}\n';
        } else {
            //let selector = rule.selectors.map((selector) => selector.replace(/&/g, parent)).join(joiner + spacing);
            let selector = rule.selectors.map((selector) => parent.split(/\s*,\s*/).map((par) => selector.replace(/&/g, par))).flat().join(joiner + spacing);
            if (rule.declarations.length) {
                let block_text = rule.declarations.map((decl) => {
                    if (Array.isArray(decl)) {
                        return renderComment(decl, spacing + '    ');
                    }
                    return spacing + '    ' + decl.text + ';' + (decl.comment ? ' ' + decl.comment : "");
                }).join('\n');
                css += `${spacing}${selector} {\n${block_text}\n${spacing}}\n`;
            }
            for (let j = 0; j < rule.subrules.length; j++) {
                let subrule = rule.subrules[j];
                if (typeof subrule[0] === 'string') {
                    css += renderComment(subrule, spacing) + '\n';
                } else {
                    css += this.renderUnnestedCSS(subrule, {parent: selector, indent, multiline});
                }
            }
        }
    }
    return css;
};

JSPLib.utility.parseCSSRules = function (css, is_subrule = false) {
    const normalizeString = function (str) {
        return str.replace(/\s+/g, ' ').trim();
    };
    const addDeclaration = function (declarations, declaration, comment = null) {
        if (declaration.indexOf(':') !== -1) {
            // Ensure colons have a space to the right, and !important has a space to the left
            let text = declaration.split(/\s*:\s*/).join(': ').replace(/\s?!important$/, ' !important');
            declarations.push({text, comment});
        }
    };
    let rules = [];
    let inside_rule = false;
    let nested_comment = false;
    // Replace all single-line comments with multi-line comments (the former is not allowed in stylesheets)
    css = css.replace(/\/\/\s*(.*)/g, "/* $1 */");
    for (let i = 0; i < css.length; i++) {
        var rule, block_indices, start, end, subcss_block, subrule, comment, statement, comment_match;
        rule ??= {comment: null, statement: null, selectors: [], declarations: [], subrules: [], is_at_block_rule: false};
        start ??= i;
        switch (css[i]) {
            case '{':
                if (!inside_rule) {
                    rule.selectors = this._parseSelectors(css.slice(start, i), is_subrule);
                    if (rule.selectors[0].match(this.AT_BLOCK_RULES)) {
                        rule.is_at_block_rule = true;
                        block_indices = this._getBlockIndices(css.slice(start));
                        subcss_block = css.slice(start + block_indices.block_start, start + block_indices.block_end);
                        subrule = this.parseCSSRules(subcss_block, false);
                        rule.subrules.push(subrule);
                        rules.push(rule);
                        rule = null;
                        i = start + block_indices.block_end;
                    } else {
                        inside_rule = true;
                    }
                } else {
                    block_indices = this._getBlockIndices(css.slice(start));
                    end = start + block_indices.block_end + 1;
                    subcss_block = css.slice(start, end);
                    subrule = this.parseCSSRules(subcss_block, true);
                    if (nested_comment) {
                        comment = rule.declarations.pop();
                        rule.subrules.push(comment);
                        nested_comment = false;
                    }
                    rule.subrules.push(subrule);
                    i = end - 1;
                }
                start = null;
                break;
            case ';':
                statement = normalizeString(css.slice(start, i));
                // Get end-of-line comment
                comment_match = css.slice(i + 1).match(/^( *\/\*.*?\*\/)/);
                comment = (comment_match ? comment_match[1] : null);
                if (statement.match(this.AT_STATEMENT_RULES)) {
                    rules.push({statement, comment});
                } else {
                    addDeclaration(rule.declarations, statement, comment);
                }
                if (comment_match) {
                    i += comment_match[0].length;
                }
                start = null;
                nested_comment = false;
                break;
            case '}':
                // For declarations not suffixed with a semi-colon (only/last declaration)
                addDeclaration(rule.declarations, normalizeString(css.slice(start, i)));
                rules.push(rule);
                rule = start = null;
                nested_comment = inside_rule = false;
                break;
            case '/':
                if (css[i + 1] === '*') {
                    let match = css.slice(i).match(/\/\*.*?\*\//s);
                    if (match) {
                        let comment = match[0].split(/\s*\n\s*/);
                        if (inside_rule) {
                            nested_comment = true;
                            rule.declarations.push(comment);
                        } else {
                            rules.push({comment, statement: null});
                        }
                        i += match[0].length - 1;
                        start = null;
                    }
                }
                // falls through
            default:
                // do nothing
        }
    }
    return rules;
};

//DOM

JSPLib.utility.DOMtoArray = function (obj) {
    var array = [];
    for (let i = obj.length; i--;) {
        array[i] = obj[i];
    }
    return array;
};

JSPLib.utility.DOMtoHash = function (obj) {
    var hash = {};
    for (let key in obj) {
        hash[key] = obj[key];
    }
    return hash;
};

JSPLib.utility.installScriptDOM = function (url, addons = {}) {
    let script = JSPLib._document.createElement('script');
    script.src = url;
    for (let key in addons) {
        script[key] = addons[key];
    }
    JSPLib._document.head.appendChild(script);
};

JSPLib.utility.getExpando = function (is_private) {
    return JSPLib._jQuery.expando + (is_private ? '1' : '2');
};

JSPLib.utility.getPrivateData = function ($dom_object) {
    if ($dom_object) {
        let private_expando = this.getExpando(true);
        if (private_expando && private_expando in $dom_object) {
            return $dom_object[private_expando];
        }
    }
    return {};
};

JSPLib.utility.getPublicData = function ($dom_object) {
    if ($dom_object) {
        let public_expando = this.getExpando(false);
        if (public_expando && public_expando in $dom_object) {
            return $dom_object[public_expando];
        }
        return this.getAllDOMData($dom_object);
    }
    return {};
};

JSPLib.utility.getAttr = function (domobj, key) {
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

JSPLib.utility.getDOMAttributes = function ($dom_array, attribute, parser = ((a) => a)) {
    let attribute_key = this.camelCase(attribute);
    let results = Array($dom_array.length);
    for (let i = 0; i < $dom_array.length; i++) {
        results[i] = parser($dom_array[i].dataset[attribute_key]);
    }
    return results;
};

JSPLib.utility.getAllDOMData = function ($dom_object) {
    let dataset = this.DOMtoHash($dom_object.dataset);
    for (let key in dataset) {
        try {
            dataset[key] = JSON.parse(dataset[key]);
        } catch (e) {
            //swallow
        }
    }
    return dataset;
};

JSPLib.utility.saveEventHandlers = function (root, type) {
    let $obj = this._getObjRoot(root);
    let private_data = this.getPrivateData($obj);
    return (this.isHash(private_data) && 'events' in private_data && type in private_data.events && private_data.events[type].map((event) => [event.namespace, event.handler])) || [];
};

JSPLib.utility.rebindEventHandlers = function (root, type, handlers, namespaces) {
    let $obj = this._getObjRoot(root);
    let rebind_handlers = handlers.filter((handler) => this.arrayHasIntersection(namespaces, handler[0].split('.')));
    rebind_handlers.forEach((handler) => {
        let trigger = type + (handler[0].length === 0 ? "" : '.' + handler[0]);
        JSPLib._jQuery($obj).on(trigger, handler[1]);
    });
};

JSPLib.utility.blockActiveElementSwitch = function (selector) {
    JSPLib._document.querySelectorAll(selector).forEach((elem) => {
        // Allows the use of document.activeElement to get the last selected text input or textarea
        elem.onmousedown = (e) => {(e || JSPLib._window.event).preventDefault();};
    });
};

JSPLib.utility.getBoundEventNames = function (root, eventtype, selector) {
    let $obj = this._getObjRoot(root);
    if ($obj === null) {
        return [];
    }
    let private_data = this.getPrivateData($obj);
    let boundevents = 'events' in private_data && private_data.events;
    if (!boundevents || !(eventtype in boundevents)) {
        return [];
    }
    let selector_events = boundevents[eventtype].filter((entry) => (entry.selector === selector || (selector === undefined && entry.selector === null) || (selector === null && entry.selector === undefined)));
    return selector_events.map((entry) => entry.namespace);
};

JSPLib.utility.isNamespaceBound = function ({root = null, eventtype = null, namespace = null, selector = null, presence = true} = {}) {
    let event_namespaces = this.getBoundEventNames(root, eventtype, selector);
    let name_parts = namespace.split('.');
    return this._not(event_namespaces.some((name) => this.isSubArray(name.split('.'), name_parts)), !presence);
};

JSPLib.utility.isGlobalFunctionBound = function (name) {
    let private_data = this.getPrivateData(document);
    return private_data && 'events' in private_data && Object.keys(private_data.events).includes(name);
};

JSPLib.utility.getDOMDataKeys = function (selector) {
    let $obj = JSPLib._document.querySelector(selector);
    return Object.keys(this.getPublicData($obj));
};

JSPLib.utility.hasDOMDataKey = function (selector, key) {
    return this.getDOMDataKeys(selector).includes(key);
};

JSPLib.utility.setDataAttribute = function (obj, key, value) {
    let $obj = ('length' in obj ? obj : [obj]);
    for (let i = 0; i < obj.length; i++) {
        let expando = this.getExpando(false);
        if (expando in $obj) {
            let public_data = this.getPublicData($obj);
            public_data[key] = value;
        }
        $obj[i].setAttribute('data-' + key, value);
    }
};

JSPLib.utility.getElemPosition = function (domnode) {
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

JSPLib.utility.isScrolledIntoView = function (domnode, view_percentage = 0.75) {
    let docViewTop = JSPLib._window.scrollY;
    let docViewBottom = docViewTop + JSPLib._window.innerHeight;
    let {top: elemTop} = this.getElemPosition(domnode);
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

JSPLib.utility.fullHide = function (selector) {
    let $objs = JSPLib._document.querySelectorAll(selector);
    for (let i = 0; i < $objs.length; i++) {
        $objs[i].style.setProperty('display', 'none', 'important');
    }
};

JSPLib.utility.clearHide = function (selector) {
    let $objs = JSPLib._document.querySelectorAll(selector);
    for (let i = 0; i < $objs.length; i++) {
        $objs[i].style.setProperty('display', '');
    }
};

JSPLib.utility.getMeta = function (key) {
    let $obj = JSPLib._document.querySelector("meta[name=" + key + "]");
    return $obj && $obj.content;
};

JSPLib.utility.sanitizeCSSName = function (name) {
    return name.replace(/[!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~]/g, '\\$&');
};

JSPLib.utility.getHTMLTree = function (domnode) {
    var tree = [];
    for (let checknode = domnode; checknode !== null; checknode = checknode.parentElement) {
        let nodename = checknode.tagName.toLowerCase();
        let id = (checknode.id !== "" ? '#' + JSPLib.utility.sanitizeCSSName(checknode.id) : "");
        let classlist = [...checknode.classList].map((entry) => ('.' + this.sanitizeCSSName(entry))).join("");
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

JSPLib.utility.getNthParent = function (obj, levels) {
    let $element = obj;
    for (let i = 0;i < levels;i++) {
        $element = $element.parentElement;
    }
    return $element;
};

//Number is one-based, i.e. the first child is number 1, the last child is -1
JSPLib.utility.getNthChild = function (obj, number) {
    let child_pos = (number < 0 ? obj.children.length + number : number - 1);
    return obj.children[child_pos];
};

JSPLib.utility.getNthSibling = function (obj, vector) {
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
JSPLib.utility.walkDOM = function (obj, vectors) {
    let $element = obj;
    for (let vector of vectors) {
        if ((vector[0] !== 0) && (vector[1] !== 0)) {
            continue; //invalid vector
        } else if (vector[0] !== 0) {
            $element = this.getNthSibling($element, vector[0]);
        } else if (vector[1] < 0) {
            $element = this.getNthParent($element, Math.abs(vector[1]));
        } else if (vector[1] > 0) {
            $element = this.getNthChild($element, vector[1]);
        }
    }
    return $element;
};

//Event handlers

JSPLib.utility.subscribeDOMProperty = function (object, property, {getter = null, setter = null} = {}) {
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

JSPLib.utility.setPropertyTrap = function (object, property, {value = {}, getter = null, setter = null} = {}) {
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

JSPLib.utility.clickAndHold = function(selector, func, namespace = "", wait_time = 500, interval_time = 100) {
    let $obj = (typeof selector === 'string' ? JSPLib._jQuery(selector) : selector);
    let event_namespaces = ['mousedown', 'mouseup', 'mouseleave'].map((event_type) => (event_type + (namespace ? '.' + namespace : "")));
    let timer = null;
    let interval = null;
    $obj.on(event_namespaces[0], (event) => {
        if (event.button !== 0) return;
        func(event);
        timer = setTimeout(() => {
            interval = this.initializeInterval(() => {
                func(event);
            }, interval_time);
        }, wait_time);
    }).on(event_namespaces.slice(1).join(', '), () => {
        clearTimeout(timer);
        clearInterval(interval);
    });
};

//Image

JSPLib.utility.getImageDimensions = function (image_url) {
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

JSPLib.utility.getPreviewDimensions = function (image_width, image_height, base_dimension) {
    let scale = Math.min(base_dimension / image_width, base_dimension / image_height);
    scale = Math.min(1, scale);
    let width = Math.round(image_width * scale);
    let height = Math.round(image_height * scale);
    return [width, height];
};

//Interval

JSPLib.utility.initializeInterval = function (func, time) {
    let retval = func();
    if (retval === false || retval === undefined) {
        return setInterval(func, time);
    }
    return true;
};

JSPLib.utility.recheckInterval = function ({check = null, exec = null, debug = null, fail = null, always = null, duration = null, interval = null} = {}) {
    let expires = Number.isInteger(duration) && this.getExpires(duration);
    var timeobj = {};
    var timer = null;
    timer = timeobj.timer = this.initializeInterval(() => {
        if (check?.()) {
            exec?.();
            timeobj.timer = true;
        } else if (!expires || this.validateExpires(expires)) {
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

JSPLib.utility.DOMWaitExecute = function ({global_check = null, namespace_check = null, data_check = null, extra_check = null, found = null, interval = null, duration = null, name = null} = {}) {
    const printer = (name ? JSPLib.debug.getFunctionPrint('utility.DOMWaitExecute') : (() => {}));
    extra_check ??= (() => true);
    this.recheckInterval({
        check: () => {
            let checks = [];
            if (global_check !== null) {
                checks.push(this.isGlobalFunctionBound(global_check));
            }
            if (namespace_check !== null) {
                checks.push(this.isNamespaceBound(namespace_check));
            }
            if (data_check !== null) {
                checks.push(this.hasDOMDataKey(data_check.selector, data_check.key));
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

JSPLib.utility.refreshPage = function (timeout) {
    setTimeout(() => {
        JSPLib._window.location.reload();
    }, timeout);
};

//Cookie

JSPLib.utility.createCookie = function (name, value, days, domain) {
    let cookie_text = name + '=' + value;
    if (days) {
        let date = new Date();
        date.setTime(date.getTime() + (days * this.one_day));
        cookie_text += '; expires=' + date.toGMTString();
    }
    if (domain) {
        cookie_text += '; domain=' + domain;
    }
    JSPLib._document.cookie = cookie_text + '; path=/; SameSite=Lax;';
};

JSPLib.utility.readCookie = function (name) {
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

JSPLib.utility.eraseCookie = function (name, domain) {
    this.createCookie(name, "", -1, domain);
};

//HTML/URL

JSPLib.utility.getDomainName = function (url, level = 0) {
    let parser = new URL(url);
    let domain_levels = parser.hostname.split('.');
    return domain_levels.slice(level * -1).join('.');
};

JSPLib.utility.getFileURLNameExt = function (file_url, dflt = 'jpg') {
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

JSPLib.utility.parseParams = function (str) {
    if (str === "") return {};
    str = (str.startsWith('?') ? str.slice(1) : str);
    return str.split('&').reduce((params, param) => {
        var paramSplit = param.split('=').map((value) => decodeURIComponent(value.replace(/\+/g, ' ')));
        params[paramSplit[0]] = paramSplit[1];
        return params;
    }, {});
};

JSPLib.utility.renderParams = function (params) {
    let param_array = [];
    for (let key in params) {
        let enc_key = encodeURIComponent(key);
        let enc_value = (params[key] === null ? "" : encodeURIComponent(params[key]).replace(/%20/g, '+'));
        param_array.push(enc_key + '=' + enc_value);
    }
    return param_array.join('&');
};

JSPLib.utility.renderHTMLTag = function (tagname, text, options = {}) {
    let attributes = [];
    for (let attr in options) {
        let attr_key = this.kebabCase(attr);
        let attr_data = options[attr];
        if (attr_data === null) {
            attributes.push(attr_key)
        } else if (attr_data !== undefined) {
            attributes.push(`${attr_key}="${attr_data}"`)
        }
    }
    let html_tag = `<${tagname} ${attributes.join(' ')}>`;
    if (text !== null) {
        html_tag += `${text}</${tagname}>`;
    }
    return html_tag;
};

JSPLib.utility.HTMLEscape = function (str) {
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

JSPLib.utility.fullEncodeURIComponent = function (str) {
    return encodeURIComponent(str).replace(/[!'()*]/g, (c) => ('%' + c.charCodeAt(0).toString(16)));
};

JSPLib.utility.normalizeHTML = function ({template = false} = {}) {
    const context = this;
    const normalize = function (output) {
        // Mark all of the spaces surrounded by a gt/lt and a non-space or lt/gt. These spaces need to stay.
        let marked_output = output.replaceAll('> <', '>\xff<').replace(/(?<=>) (?=[^ <])/g, '\xff').replace(/(?<=[^ >]) (?=<)/g, '\xff');
        let normalized_output = marked_output.replace(/\s+/g, ' ').replace(/(?<=>)\s/g, "").replace(/\s(?=<)/g, "").replaceAll(' >', '>');
        // Once the HTML has been normalized, restore all of the intentional spaces.
        return normalized_output.replaceAll('\xff', ' ');
    };
    return function (literals, ...args) {
        if (template) {
            return context.generateTemplate(normalize, literals, args);
        }
        return normalize(context.renderTemplate(literals, args));
    };
};

//Validation

JSPLib.utility.isBoolean = function (value) {
    return typeof value === "boolean";
};

JSPLib.utility.isString = function (value) {
    return typeof value === "string";
};

JSPLib.utility.isNumber = function (value) {
    return typeof value === 'number' && !isNaN(value);
};

JSPLib.utility.isInteger = function (value) {
    return Number.isInteger(value);
};

JSPLib.utility.isHash = function (value) {
    return value?.constructor?.name === 'Object';
};

JSPLib.utility.validateID = function (value) {
    return Number.isInteger(value) && (value > 0);
};

JSPLib.utility.validateIDList = function (array) {
    return Array.isArray(array) && ((array.length === 0) || ((array.length > 0) && array.reduce((total, val) => this.validateID(val) && total, true)));
};

//Other

JSPLib.utility.createBroadcastChannel = function (name, func) {
    let channel = new BroadcastChannel(name);
    channel.onmessage = func;
    return channel;
};

//So that throw statements can be used in more places like ternary operators
JSPLib.utility.throwError = function(e) {
    throw e;
};

/****PRIVATE DATA****/

//Variables

JSPLib.utility._css_style = {};
JSPLib.utility._css_sheet = {};
//Functions

JSPLib.utility._isTimestamp = function (timestamp) {
    //This includes epoch timestamps as well as durations, which must be integer/float and greater than zero
    return typeof timestamp === 'number' && !Number.isNaN(timestamp) && timestamp >= 0;
};

JSPLib.utility._not = function (data, reverse) {
    return (reverse ? !data : Boolean(data));
};

JSPLib.utility._setOperation = function (iterator, comparator, result = new Set()) {
    for (let val of iterator) {
        if (comparator(val)) {
            result.add(val);
        }
    }
    return result;
};

JSPLib.utility._makeSets = function (...arrays) {
    return arrays.map((array) => this.arrayToSet(array));
};

JSPLib.utility._makeArray = function (iterator, data, comparator) {
    let result = [];
    for (let val of iterator) {
        if (comparator(data, val)) {
            result.push(val);
        }
    }
    return result;
};

JSPLib.utility._orderSets = function (set1, set2) {
    return (set1.size > set2.size ? [set2, set1] : [set1, set2]);
};

JSPLib.utility._orderArrays = function (array1, array2) {
    return (array1.length > array2.length ? [array2, array1] : [array1, array2]);
};

JSPLib.utility._getObjRoot = function (root) {
    return (typeof root !== 'string' ? root : JSPLib._document.querySelector(root));
};

JSPLib.utility._getBlockIndices = function (text) {
    // Searches for text surrounded by curly braces, and returns the string indices of the text within.
    let block_level = -1;
    let block_start = null;
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '}') {
            if (block_level === 0) {
                return {block_start, block_end: i};
            } 
            block_level -= 1;
        }
        else if (text[i] === '{') {
            block_level += 1;
            block_start ??= i + 1;
        }
    }
    throw "No blocks found!";
};

JSPLib.utility._parseSelectors = function (text, is_subrule) {
    let selectors = [];
    let inside_parentheses = false;
    /**
     * Replace selector operators outside of parentheses with a space on both sides.
     * Replace selector operators wihin parentheses with a space only on the right side.
     * Ensure commas within parentheses always have a space to the right.
     * Individual selectors are broken up by commas.
     */
    let formatted_text = text.replace(/\s+/g, ' ').trim().replace(/(?<!\()\s*([>~+])\s*/g, ' $1 ').replace(/(?<=\()\s*([>~+])\s*/g, '$1 ').replace(/\s*,\s*/g, ', ');
    if (formatted_text.match(this.AT_BLOCK_RULES)) return [formatted_text];
    for (let i = 0; i < formatted_text.length; i++) {
        var start;
        start ??= i;
        switch (formatted_text[i]) {
            case '(':
                inside_parentheses = true;
                break;
            case ')':
                inside_parentheses = false;
                break;
            case ',':
                if (!inside_parentheses) {
                    selectors.push(formatted_text.slice(start, i).trim());
                    start = null;
                }
                // falls through
            default:
                // do nothing;
        }
        // Last iteration
        if (i === formatted_text.length - 1) {
            selectors.push(formatted_text.slice(start, i + 1).trim());
        }
    }
    if (is_subrule) {
        selectors = selectors.map((selector) => (selector.indexOf('&') === -1 ? '& ' + selector : selector));
    }
    return selectors;
};

/****INITIALIZATION****/

JSPLib.utility._configuration = {
    nonenumerable: [],
    nonwritable: ['one_second', 'one_minute', 'one_hour', 'one_day', 'one_week', 'one_month', 'one_year', 'WORDBREAK_REGEX', 'ROMAN_REGEX', 'NONTITLEIZE_WORDS', '_css_style', '_css_sheet', '_start_time']
};
JSPLib.initializeModule('utility');
