/****DEPENDENCIES****/

/**External dependencies**/
// jQuery (optional)

/****SETUP****/

//Linter configuration
/* global JSPLib jQuery Danbooru */

var JSPLib = JSPLib || {};
JSPLib.utility = JSPLib.utility || {};

//Has debug.js been loaded?
JSPLib.debug = JSPLib.debug || {};
JSPLib.debug.debuglogLevel = JSPLib.debug.debuglogLevel || (()=>{});

/****GLOBAL VARIABLES****/

JSPLib.utility.max_column_characters = 20;

//Time constants

JSPLib.utility.one_second = 1000;
JSPLib.utility.one_minute = JSPLib.utility.one_second * 60;
JSPLib.utility.one_hour = JSPLib.utility.one_minute * 60;
JSPLib.utility.one_day = JSPLib.utility.one_hour * 24;
JSPLib.utility.one_week = JSPLib.utility.one_day * 7;
JSPLib.utility.one_month = JSPLib.utility.one_day * 30;
JSPLib.utility.one_year = JSPLib.utility.one_day * 365;

//Regex constants

JSPLib.utility.WORDBREAK_REGEX = /\(+|\)+|[\s_]+|[^\s_\(\)]+/g;
JSPLib.utility.ROMAN_REGEX = /^M?M?M?(CM|CD|D?C?C?C?)(XC|XL|L?X?X?X?)(IX|IV|V?I?I?I?)$/i;

//String constants

JSPLib.utility.NONTITLEIZE_WORDS = ['a', 'an', 'of', 'the', 'is'];

/****FUNCTIONS****/

//Time functions

JSPLib.utility.sleep = function (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
};

JSPLib.utility.getExpires = function (expires) {
    return Math.round(Date.now() + expires);
};

JSPLib.utility.validateExpires = function (actual_expires,expected_expires) {
    //Resolve to false if the actual_expires is bogus, has expired, or the expiration is too long
    return Number.isInteger(actual_expires) && (Date.now() <= actual_expires) && (!Number.isInteger(expected_expires) || ((actual_expires - Date.now()) <= expected_expires));
};

JSPLib.utility.getProgramTime = function () {
    return performance.now() - JSPLib.utility._start_time;
};

//Boolean functions

JSPLib.utility.not = function (data,reverse) {
    return (reverse ? !Boolean(data) : Boolean(data));
};

//Number functions

JSPLib.utility.setPrecision = function (number,precision) {
    return parseFloat(number.toFixed(precision));
};

JSPLib.utility.getUniqueID = function() {
    return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
};

//String functions

JSPLib.utility.titleizeString = function (string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
};

JSPLib.utility.titleizeExcept = function (word) {
    return (JSPLib.utility.NONTITLEIZE_WORDS.includes(word) ? word : JSPLib.utility.titleizeString(word));
};

JSPLib.utility.titleizeRoman = function (word) {
    return (word.match(JSPLib.utility.ROMAN_REGEX) ? word.toUpperCase() : JSPLib.utility.titleizeExcept(word));
};

JSPLib.utility.maxLengthString = function (string,length) {
    let check_length = (length ? length : JSPLib.utility.max_column_characters);
    if (string.length > check_length) {
        string = string.slice(0,check_length-1) + '…';
    }
    return string;
};

JSPLib.utility.kebabCase = function (string) {
    return string.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g,'-').toLowerCase();
};

JSPLib.utility.camelCase = function (string) {
    return string.replace(/[-_]([a-z])/g,(all,letter)=>{return letter.toUpperCase()});
};

JSPLib.utility.snakeCase = function (string) {
    return string.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/[\s-]+/g,'_').toLowerCase();
};

JSPLib.utility.displayCase = function (string) {
    return JSPLib.utility.titleizeString(string.replace(/[_]/g,' '));
};

JSPLib.utility.properCase = function (string) {
    return string.match(JSPLib.utility.WORDBREAK_REGEX).map((word) => JSPLib.utility.titleizeString(word)).join("");
};

JSPLib.utility.exceptCase = function (string) {
    return string.match(JSPLib.utility.WORDBREAK_REGEX).map((word) => JSPLib.utility.titleizeExcept(word)).join("");
};

JSPLib.utility.romanCase = function (string) {
    return string.match(JSPLib.utility.WORDBREAK_REGEX).map((word) => JSPLib.utility.titleizeRoman(word)).join("");
};

JSPLib.utility.padNumber = function (num,size,is_decimal=false) {
    var s = String(num);
    if (is_decimal && s.indexOf('.') < 0) {
        s += '.0';
    }
    let pad_size = size || (is_decimal ? 2 : 4);
    while (s.length < pad_size) {
        s = "0" + s;
    }
    return s;
};

JSPLib.utility.sprintf = function (format,...values) {
    return values.reduce((str, val)=>{return str.replace(/%s/, val);},format);
};

//Simple template trim for singular strings
JSPLib.utility.trim = function (string) {
    return string[0].trim();
};

//Regex functions

JSPLib.utility.findAll = function(str,regex) {
    return [...str.matchAll(regex)].flat();
};

JSPLib.utility.regexpEscape = function (string) {
    return string.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
};

JSPLib.utility.regexReplace = function (string,values) {
    const replaceTerm = (str,val,key) => str.replace(RegExp(`%${key}%`,'g'),val);
    return JSPLib.utility.objectReduce(values,replaceTerm,string);
};

//String array functions

JSPLib.utility.filterRegex = function (array,regex,reverse=false) {
    return array.filter(entry=>{return JSPLib.utility.not(entry.match(regex),reverse);});
};

JSPLib.utility.filterEmpty = function (array) {
    return JSPLib.utility.filterRegex(array,/[\s\S]+/);
};

//Array functions

JSPLib.utility.concat = function(array1,array2) {
    let result = Array(array1.length + array2.length)
    for(let i = 0; i < array1.length; i++){
      result[i] = array1[i]
    }
    for(let i = 0; i < array2.length; i++){
      result[array1.length + i] = array2[i]
    }
    return result;
};

JSPLib.utility.multiConcat = function (...arrays) {
    if (arrays.length < 1) {
        return arrays[0];
    }
    let merged_array = arrays[0];
    for (let i = 1; i < arrays.length; i++) {
        merged_array = JSPLib.utility.concat(merged_array, arrays[i]);
    }
    return merged_array;
};

JSPLib.utility.isSet = function (data) {
    return data && data.constructor && data.constructor.name === "Set";
};

JSPLib.utility.mergeSets = function(set1,set2) {
    let [small,large] = JSPLib.utility._orderSets(set1,set2);
    let result = new Set(small);
    for (let x of large) {
        result.add(x);
    }
    return result;
};

JSPLib.utility.setUnion = function (set1,set2) {
    let [small,large] = this._orderSets(set1,set2);
    const comparator = ()=>(true);
    return this._setOperation(small,comparator,new Set(large));
};

JSPLib.utility.setDifference = function (set1,set2) {
    const comparator = (val) => !set2.has(val);
    return this._setOperation(set1,comparator);
};

JSPLib.utility.setIntersection = function (set1,set2) {
    let [small,large] = this._orderSets(set1,set2);
    const comparator = (val) => large.has(val);
    return this._setOperation(small,comparator);
};

JSPLib.utility.setSymmetricDifference = function (set1,set2) {
    let combined = this.setUnion(set1,set2);
    let comparator = (val) => !(set1.has(val) && set2.has(val));
    return this._setOperation(combined,comparator);
};

JSPLib.utility.setEquals = function (set1,set2) {
    if (!this.isSet(set1) || !this.isSet(set2)) {
        return false;
    }
    if (set1.size !== set2.size) {
        return false;
    }
    let [small,large] = this._orderSets(set1,set2);
    return [...small].every(val => large.has(val));
};

JSPLib.utility.isSubSet = function (set1,set2) {
    return set2.every(val => set1.has(val));
};

JSPLib.utility.isSuperSet = function (set1,set2) {
    return this.isSubSet(set2,set1);
};

JSPLib.utility.setHasIntersection = function (set1,set2) {
    let [small,large] = this._orderSets(set1,set2);
    return small.some(val => large.has(val));
};

JSPLib.utility.arrayUnique = function (array) {
    return [...(new Set(array))];
};

JSPLib.utility.arrayUnion = function (array1,array2) {
    let [set1,set2] = this._makeSets(array1,array2);
    return [...this.setUnion(set1,set2)];
};

JSPLib.utility.arrayDifference = function (array1,array2) {
    let [set1,set2] = this._makeSets(array1,array2);
    return [...this.setDifference(set1,set2)];
};

JSPLib.utility.arrayIntersection = function (array1,array2) {
    let [set1,set2] = this._makeSets(array1,array2);
    return [...this.setIntersection(set1,set2)];
};

JSPLib.utility.arraySymmetricDifference = function (array1,array2) {
    let [set1,set2] = this._makeSets(array1,array2);
    return [...this.setSymmetricDifference(set1,set2)];
};

JSPLib.utility.isSubArray = function (array1,array2) {
    let [set1,set2] = this._makeSets(array1,array2);
    return this.isSubSet(set1,set2);
};

JSPLib.utility.isSuperArray = function (array1,array2) {
    return this.isSubArray(array2,array1);
};

JSPLib.utility.arrayEquals = function (array1,array2) {
    if (!Array.isArray(array1) || !Array.isArray(array2)) {
        return false;
    }
    if (array1.length !== array2.length) {
        return false;
    }
    let [set1,set2] = this._makeSets(array1,array2);
    return this.setEquals(set1,set2);
};

JSPLib.utility.arrayHasIntersection = function (array1,array2) {
    let [set1,set2] = this._makeSets(array1,array2);
    return this.setHasIntersection(set1,set2);
};

//Filter a list of objects with a list of values
JSPLib.utility.listFilter = function (array,itemlist,itemkey,reverse=false) {
    return array.filter((item)=>{return JSPLib.utility.not(itemlist.includes(item[itemkey]),reverse);});
};

JSPLib.utility.joinList = function (array,prefix,suffix,joiner) {
    prefix = prefix || '';
    suffix = suffix || '';
    return array.map((level)=>{
        return prefix + level + suffix;
    }).join(joiner);
};

//Object functions

JSPLib.utility.freezeObject = function (obj,recurse=false) {
    if (recurse) {
        for (let key in obj) {
            let value = obj[key];
            if (typeof value === "object" && value !== null) {
                JSPLib.utility.freezeObject(value,true);
                Object.freeze(value);
            }
        }
    }
    Object.freeze(obj);
};

JSPLib.utility.freezeObjects = function (obj_array,recurse) {
    obj_array.forEach((val)=>{JSPLib.utility.freezeObject(val,recurse);});
};

//To freeze individual properties of an object
JSPLib.utility.freezeProperty = function (obj,property) {
    Object.defineProperty(obj, property, { configurable: false, writable: false });
};

JSPLib.utility.freezeProperties = function (obj,property_list) {
    property_list.forEach((property)=>{JSPLib.utility.freezeProperty(obj,property);});
};

JSPLib.utility.getObjectAttributes = function (array,attribute) {
    return array.map(val => val[attribute]);
};


//Get nested attribute for single object
JSPLib.utility.getNestedAttribute = function (data,attributes) {
    for (let i = 0; i < attributes.length; i++) {
        let attribute = attributes[i];
        data = data[attribute]
        if (data === undefined) {
            return null;
        }
    }
    return data;
};

//Get nested attribute for multiple objects
JSPLib.utility.getNestedObjectAttributes = function (data,attributes) {
    for (let i = 0; i < attributes.length; i++) {
        let attribute = attributes[i];
        data = JSPLib.utility.getObjectAttributes(data, attribute);
        if (data.length === 0 || data[0] === undefined) {
            return null;
        }
    }
    return data;
};

JSPLib.utility.objectReduce = function (object,reducer,accumulator) {
    for (let key in object) {
        if (object.hasOwnProperty(key)) {
        accumulator = reducer(accumulator, object[key], key, object);
        }
    }
    return accumulator;
};

//Deep copy an object or array
JSPLib.utility.dataCopy = function (olddata) {
    if (!this._isHash(olddata) && !Array.isArray(olddata)) {
        return olddata;
    }
    let newdata = (Array.isArray(olddata) ? [] : {});
    for (let key in olddata) {
        let value = olddata[key];
        newdata[key] = ((typeof value === "object") && value !== null ? JSPLib.utility.dataCopy(value) : value);
    }
    return newdata;
};

JSPLib.utility.joinArgs = function (...values) {
    let results = {};
    for (let i = 0; i < values.length; i++) {
        JSPLib.utility._combineArgs(results,values[i]);
    }
    return JSPLib.utility.dataCopy(results);
};

//Compare two objects to detect changes to the first
JSPLib.utility.recurseCompareObjects = function (object1,object2,difference={}) {
    for (let key in object1) {
        if (object1[key] !== object2[key] && typeof object1[key] !== "object") {
            difference[key] = [object1[key], object2[key]];
        } else if (typeof object1[key] === "object") {
            difference[key] = {};
            JSPLib.utility.recurseCompareObjects(object1[key], object2[key], difference[key]);
            //Delete empty objects
            if (Object.getOwnPropertyNames(difference[key]).length === 0) {
                delete difference[key];
            }
        }
    }
    return difference;
}

JSPLib.utility.arrayFill = function (length,stringified_json) {
    return Array(length).fill().map(()=>{return JSON.parse(stringified_json);});
};

//Function functions

JSPLib.utility.hijackFunction = function (oldfunc,postfunc,prefunc) {
    return function(...args) {
        if (prefunc) {
            prefunc.call(this,...args);
        }
        let data = oldfunc.call(this,...args);
        data = postfunc.call(this,data,...args);
        return data;
    }
};

//For functions stored on a hash tree
JSPLib.utility.recursiveLabels = function (hash, current_name) {
    for (let key in hash) {
        if (typeof hash[key] === "function") {
            hash[key] = this.hijackFunction(
                hash[key],
                function (data) {console.log("Output", current_name + '.' + key, data); return data},
                function (args) {console.log("Calling", current_name + '.' + key, args);},
            );
        } else if (this._isHash(hash[key])) {
            RecursiveLabels(hash[key], current_name + '.' + key);
        }
    }
}

//DOM functions

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

JSPLib.utility.installScript = function (url) {
    if ('jQuery' in window) {
        //If jQuery is available, it returns a promise which can be used to check for script install
        return jQuery.ajax({
            url: url,
            dataType: "script",
            cache: true
        });
    } else {
        //Otherwise, the calling script will need to test for script install some other way
        let script = document.createElement('script');
        script.src = url;
        document.head.appendChild(script);
    }
};

JSPLib.utility.getExpando = function (private_data) {
    if (private_data) {
        return typeof jQuery !== 'undefined' && jQuery.expando + '1';
    } else {
        return typeof jQuery !== 'undefined' && jQuery.expando + '2';
    }
};

JSPLib.utility.getPrivateData = function ($dom_object) {
    if ($dom_object) {
        let private_expando = JSPLib.utility.getExpando(true);
        if (private_expando && private_expando in $dom_object) {
            return $dom_object[private_expando];
        }
    }
    return {};
};

JSPLib.utility.getPublicData = function ($dom_object) {
    if ($dom_object) {
        let public_expando = JSPLib.utility.getExpando(false);
        if (public_expando && public_expando in $dom_object) {
            return $dom_object[public_expando];
        } else {
            return JSPLib.utility.getAllDOMData($dom_object);
        }
    }
    return {};
};

JSPLib.utility.getDOMAttributes = function ($dom_array,attribute,parser=((a)=>{return a;})) {
    let attribute_key = JSPLib.utility.camelCase(attribute);
    let results = Array($dom_array.length);
    for (let i = 0; i < $dom_array.length; i++) {
        results[i] = parser($dom_array[i].dataset[attribute_key]);
    }
    return results;
};

JSPLib.utility.getAllDOMData = function ($dom_object) {
    let dataset = JSPLib.utility.DOMtoHash($dom_object.dataset);
    for (let key in dataset) {
        try {
            dataset[key] = JSON.parse(dataset[key]);
        } catch (e) {
            //swallow
        }
    }
    return dataset;
};

JSPLib.utility.getBoundEventNames = function (root,eventtype,selector) {
    let $obj = ((root === document || root === window) ? root : document.querySelector(root));
    if ($obj === null) {
        return [];
    }
    let private_data = JSPLib.utility.getPrivateData($obj);
    let boundevents = 'events' in private_data && private_data.events;
    if (!boundevents || !(eventtype in boundevents)) {
        return [];
    }
    let selector_events = boundevents[eventtype].filter((entry)=>{return entry.selector === selector || (selector === undefined && entry.selector === null) || (selector === null && entry.selector === undefined);});
    return selector_events.map((entry)=>{return entry.namespace;});
};

JSPLib.utility.isNamespaceBound = function (root,eventtype,namespace,selector) {
    let namespaces = JSPLib.utility.getBoundEventNames(root,eventtype,selector);
    return namespaces.includes(namespace);
};

JSPLib.utility.isGlobalFunctionBound = function (name) {
    let private_data = JSPLib.utility.getPrivateData(document);
    return private_data && 'events' in private_data && Object.keys(private_data.events).includes(name);
};

JSPLib.utility.getDOMDataKeys = function (selector) {
    let $obj = document.querySelector(selector);
    return Object.keys(JSPLib.utility.getPublicData($obj));
};

JSPLib.utility.hasDOMDataKey = function (selector,key) {
    return JSPLib.utility.getDOMDataKeys(selector).includes(key);
};

JSPLib.utility.isScrolledIntoView = function (domnode,view_percentage=0.75) {
    let docViewTop = window.scrollY;
    let docViewBottom = docViewTop + window.innerHeight;
    let elemTop = 0;
    for (let currElem = domnode; currElem.offsetParent !== null; currElem = currElem.offsetParent) {
        elemTop += currElem.offsetTop
        let computed_style = window.getComputedStyle(currElem);
        if (computed_style.transform !== "none") {
            let translate_y = Number(computed_style.transform.match(/[0-9-.]+/g)[5]);
            elemTop += translate_y;
        }
    }
    let elemBottom = elemTop + domnode.offsetHeight;
    if ((elemBottom <= docViewBottom) && (elemTop >= docViewTop)) {
        //Is element entirely within view?
        return true;
    } else if ((elemBottom >= docViewBottom) && (elemTop <= docViewTop)) {
        //Does element fill up the view?
        return true;
    } else if ((elemTop >= docViewTop) && (elemTop <= docViewBottom)) {
        //Does the top portion of the element fill up a certain percentage of the view?
        return ((docViewBottom - elemTop) / (docViewBottom - docViewTop)) > view_percentage;
    } else if ((elemBottom >= docViewTop) && (elemBottom <= docViewBottom)) {
        //Does the bottom portion of the element fill up a certain percentage of the view?
        return ((elemBottom - docViewTop) / (docViewBottom - docViewTop)) > view_percentage;
    }
    return false;
};

JSPLib.utility.addStyleSheet = function (url,title='') {
    if (title in JSPLib.utility._css_sheet) {
        JSPLib.utility._css_sheet[title].href = url;
    } else {
        JSPLib.utility._css_sheet[title] = document.createElement('link');
        JSPLib.utility._css_sheet[title].rel = 'stylesheet';
        JSPLib.utility._css_sheet[title].type = 'text/css';
        JSPLib.utility._css_sheet[title].href = url;
        document.head.appendChild(JSPLib.utility._css_sheet[title]);
    }
};

//Sets the css style and retains a pointer to the DOM object for later edits
JSPLib.utility.setCSSStyle = function (csstext,title) {
    if (title in JSPLib.utility._css_style) {
        JSPLib.utility._css_style[title].innerHTML = csstext;
    } else {
        JSPLib.utility._css_style[title] = document.createElement('style');
        JSPLib.utility._css_style[title].type = 'text/css';
        JSPLib.utility._css_style[title].innerHTML = csstext;
        document.head.appendChild(JSPLib.utility._css_style[title]);
    }
};

JSPLib.utility.hasStyle = function (name) {
    return name in JSPLib.utility._css_style;
};

JSPLib.utility.fullHide = function (selector) {
    let $objs = document.querySelectorAll(selector);
    for (let i = 0; i < $objs.length; i++) {
        $objs[i].style.setProperty('display','none','important');
    }
};

JSPLib.utility.clearHide = function (selector) {
    let $objs = document.querySelectorAll(selector);
    for (let i = 0; i < $objs.length; i++) {
        $objs[i].style.setProperty('display','');
    }
};

JSPLib.utility.getMeta = function (key) {
    let $obj = document.querySelector("meta[name=" + key + "]");
    return $obj && $obj.content;
};

JSPLib.utility.getHTMLTree = function (domnode) {
    var tree = [];
    for (let checknode = domnode; checknode !== null; checknode = checknode.parentElement) {
        let nodename = checknode.tagName.toLowerCase();
        let id = (checknode.id !== "" ? "#" : "") + checknode.id;
        let classlist = Object.assign(new Array(),checknode.classList).map((entry)=>{return '.' + entry;}).join('');
        let index = "";
        if (checknode.parentElement !== null) {
            let similar_elements = [...checknode.parentElement.children].filter(entry => entry.tagName === checknode.tagName);
            let similar_position = similar_elements.indexOf(checknode) + 1;
            index = ":nth-of-type(" + similar_position + ")";
        }
        tree.push(nodename + id + classlist + index);
    }
    return tree.reverse().join(" > ");
};

JSPLib.utility.getNthParent = function (obj,levels) {
    let $element = obj;
    for (let i=0;i<levels;i++) {
        $element = $element.parentElement;
    }
    return $element;
};

//Number is one-based, i.e. the first child is number 1, the last child is -1
JSPLib.utility.getNthChild = function (obj,number) {
    let child_pos = (number < 0 ? obj.children.length + number : number - 1);
    return obj.children[child_pos];
};

JSPLib.utility.getNthSibling = function (obj,vector) {
    let $element = obj;
    let distance = Math.abs(vector);
    for (let i=0;i<distance;i++) {
        $element = (vector > 0 ? $element.nextElementSibling : $element.previousElementSibling);
    }
    return $element;
};

//Two dimensional array where each entry is a two-entry vector
//vectors[0]: moves at the same hierarchy level, i.e. siblings
//vectors[1]: move to different hierarchy levels, i.e. ancestors/descendants
//No diagonal vectors, i.e. the first or second entry must be 0
//Going to descendants must be done one vector at a time
JSPLib.utility.walkDOM = function (obj,vectors) {
    let $element = obj;
    for (let vector of vectors) {
        if ((vector[0] !== 0) && (vector[1] !== 0)) {
            continue; //invalid vector
        } else if (vector[0] !== 0) {
            $element = JSPLib.utility.getNthSibling($element, vector[0]);
        } else if (vector[1] < 0) {
            $element = JSPLib.utility.getNthParent($element, Math.abs(vector[1]));
        } else if (vector[1] > 0) {
            $element = JSPLib.utility.getNthChild($element, vector[1]);
        }
    }
    return $element;
};

//Image functions

JSPLib.utility.getImageDimensions = function (image_url) {
    return new Promise((resolve)=>{
        let fake_image = document.createElement('img');
        fake_image.onload = function () {
            resolve({
                width: fake_image.naturalWidth,
                height: fake_image.naturalHeight,
            });
        };
        fake_image.src = image_url;
    });
};

JSPLib.utility.getPreviewDimensions = function (image_width,image_height,base_dimension) {
    let scale = Math.min(base_dimension / image_width, base_dimension / image_height);
    scale = Math.min(1, scale);
    let width = Math.round(image_width * scale);
    let height = Math.round(image_height * scale);
    return [width, height];
};

//Interval functions

JSPLib.utility.initializeInterval = function (func,time) {
    func();
    return setInterval(func,time);
};

JSPLib.utility.recheckTimer = function (funcs,interval,duration) {
    let expires = duration && JSPLib.utility.getExpires(duration);
    var timeobj = {};
    //Have non-mutating object for internal use, with mutating object for external use
    var timer = timeobj.timer = setInterval(()=>{
        if (funcs.check()) {
            clearInterval(timer);
            funcs.exec();
            //Way to notify externally when the recheck is successful
            timeobj.timer = true;
        } else if (duration && !JSPLib.utility.validateExpires(expires)) {
            clearInterval(timer);
            //Way to notify externally when the duration has expired
            timeobj.timer = false;
        }
    },interval);
    return timeobj;
};

//Page functions

JSPLib.utility.refreshPage = function (timeout) {
    setTimeout(()=>{
        window.location.reload();
    }, timeout);
};

//Cookie functions

JSPLib.utility.createCookie = function (name, value, days, domain) {
    let cookie_text = name + '=' + value;
    if (days) {
        let date = new Date();
        date.setTime(date.getTime() + (days * JSPLib.utility.one_day));
        cookie_text += '; expires=' + date.toGMTString();
    }
    if (domain) {
        cookie_text += '; domain=' + domain;
    }
    document.cookie = cookie_text + '; path=/';
};

JSPLib.utility.readCookie = function (name) {
    let name_equals = name + "=";
    let all_cookies = document.cookie.split(';');
    for (let i = 0; i < all_cookies.length; i++) {
        let cookie = all_cookies[i].trim();
        if (cookie.indexOf(name_equals) == 0) {
            return decodeURIComponent(cookie.substring(name_equals.length, cookie.length).replace(/\+/g, " "));
        }
    }
    return null;
};

JSPLib.utility.eraseCookie = function (name,domain) {
    JSPLib.utility.createCookie(name,"",-1,domain);
};

//HTML/URL functions

JSPLib.utility.getDomainName = function (url,level=0) {
    let parser = new URL(url);
    let domain_levels = parser.hostname.split('.');
    return domain_levels.slice(level * -1).join('.');
};

JSPLib.utility.parseParams = function (str) {
    return str.split('&').reduce(function (params, param) {
        var paramSplit = param.split('=').map(function (value) {
            return decodeURIComponent(value.replace(/\+/g, ' '));
        });
        params[paramSplit[0]] = paramSplit[1];
        return params;
    }, {});
};

JSPLib.utility.HTMLEscape = function (str) {
    const escape_entries = [
        ['&','&amp;'],
        ['<','&lt;'],
        ['>','&gt;'],
        ['"','&quot;'],
        ["'",'&#x27;'],
        ['`','&#x60;']
    ];
    escape_entries.forEach((entry)=>{
        str = str.replace(RegExp(entry[0],'g'),entry[1]);
    });
    return str;
};

//Mutation observer functions

//Calls a function when the DOM object of a certain ID or classname gets replaced
JSPLib.utility.setupMutationReplaceObserver = function ($root_node,remove_selector,func,disconnect=true) {
    if (typeof $root_node === 'string') {
        $root_node = document.querySelector($root_node);
    }
    let [key,name] = JSPLib.utility._getSelectorChecks(remove_selector);
    new MutationObserver(function(mutations,observer) {
        mutations.forEach(function(mutation) {
            JSPLib.debug.debuglogLevel("utility.setupMutationRemoveObserver - Checking mutation:",mutation.type,mutation.removedNodes,JSPLib.debug.VERBOSE);
            if (mutation.type == "childList" && mutation.removedNodes.length === 1) {
                let node = mutation.removedNodes[0];
                JSPLib.debug.debuglogLevel(`utility.setupMutationRemoveObserver - Checking removed node: ${key} ${name} "${node[key]}"`,JSPLib.debug.DEBUG);
                if (name == node[key]) {
                    JSPLib.debug.debuglogLevel(`utility.setupMutationRemoveObserver - Validated remove: ${remove_selector} has been modified!`,JSPLib.debug.INFO);
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

//Notification functions

JSPLib.utility.notice = function (...args) {
    typeof Danbooru === 'object' && Danbooru.Utility && Danbooru.Utility.notice(...args);
};

JSPLib.utility.error = function (...args) {
    typeof Danbooru === 'object' && Danbooru.Utility && Danbooru.Utility.error(...args);
};

//Other functions

JSPLib.utility.createBroadcastChannel = function (name,func) {
    let channel = new BroadcastChannel(name);
    channel.onmessage = func;
    return channel;
};

//So that throw statements can be used in more places like ternary operators
JSPLib.utility.throw = function(e) {
    throw e;
}

/****PRIVATE DATA****/

//Variables

JSPLib.utility._css_style = {};
JSPLib.utility._css_sheet = {};
JSPLib.utility._start_time = performance.now();

//Functions

JSPLib.utility._setOperation = function (iterator,comparator,result=new Set()) {
    for (let val of iterator) {
        if (comparator(val)) {
            result.add(val);
        }
    }
    return result;  
};

JSPLib.utility._makeSets = function (...arrays) {
    return arrays.map(array => new Set(array));
};

JSPLib.utility._makeArray = function (iterator,data,comparator) {
    let result = [];
    for (let val of iterator) {
        if (comparator(data,val)) {
            result.push(val);
        }
    }
    return result;
};

JSPLib.utility._orderSets = function (set1,set2) {
    return (set1.size > set2.size ? [set2,set1] : [set1,set2]);
};

JSPLib.utility._orderArrays = function (array1,array2) {
    return (array1.length > array2.length ? [array2,array1] : [array1,array2]);
};

JSPLib.utility._combineArgs = function (results,data) {
    for (let key in data) {
        if (!(key in results) || !((typeof results[key] === "object") && (typeof data[key] === "object"))) {
            results[key] = (typeof data[key] === "object" ? JSPLib.utility.dataCopy(data[key]) : data[key]);
        } else {
            JSPLib.utility._combineArgs(results[key],data[key]);
        }
    }
};

JSPLib.utility._getSelectorChecks = function (selector) {
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

JSPLib.utility._isHash = function (value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
};

/****INITIALIZATION****/

JSPLib.utility._configuration = {
    nonenumerable: ['_css_style','_css_sheet','_start_time','_makeSets','_makeArray','_orderSets','_orderArrays','_combineArgs','_getSelectorChecks','_isHash','_configuration'],
    nonwritable: ['one_second','one_minute','one_hour','one_day','one_week','one_month','one_year','WORDBREAK_REGEX','ROMAN_REGEX','NONTITLEIZE_WORDS','_css_style','_css_sheet','_start_time','_configuration']
};
Object.defineProperty(JSPLib,'utility',{configurable:false,writable:false});
for (let property in JSPLib.utility) {
    if (JSPLib.utility._configuration.nonenumerable.includes(property)) {
        Object.defineProperty(JSPLib.utility,property,{enumerable:false});
    }
    if (JSPLib.utility._configuration.nonwritable.includes(property)) {
        Object.defineProperty(JSPLib.utility,property,{writable:false});
    }
    Object.defineProperty(JSPLib.utility,property,{configurable:false});
}
