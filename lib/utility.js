/****DEPENDENCIES****/

/**External dependencies**/
// jQuery

/****SETUP****/

var JSPLib = JSPLib || {};
JSPLib.utility = JSPLib.utility || {};

/****GLOBAL VARIABLES****/

JSPLib.utility.cssstyle = {};
JSPLib.utility.max_column_characters = 20;

//Time constants

JSPLib.utility.one_second = 1000;
JSPLib.utility.one_minute = JSPLib.utility.one_second * 60;
JSPLib.utility.one_hour = JSPLib.utility.one_minute * 60;
JSPLib.utility.one_day = JSPLib.utility.one_hour * 24;
JSPLib.utility.one_week = JSPLib.utility.one_day * 7;
JSPLib.utility.one_month = JSPLib.utility.one_day * 30;
JSPLib.utility.one_year = JSPLib.utility.one_day * 365;

/****FUNCTIONS****/

//Time functions

JSPLib.utility.sleep = function (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
};

//Number functions

JSPLib.utility.setPrecision = function (number,precision) {
    return parseFloat(number.toFixed(precision));
};

//String functions

JSPLib.utility.titleizeString = function (string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
};

JSPLib.utility.maxLengthString = function (string) {
    if (string.length > JSPLib.utility.max_column_characters) {
        string = string.slice(0,JSPLib.utility.max_column_characters-1) + '…';
    }
    return string;
};

//String array functions

JSPLib.utility.filterRegex = function (array,regex) {
    return array.filter(entry=>{return entry.match(regex);});
};

JSPLib.utility.filterEmpty = function (array) {
    return JSPLib.utility.filterRegex(array,/[\s\S]+/);
};

//Array functions

JSPLib.utility.setUnique = function (array) {
    return array.filter((value,index,self)=>{return self.indexOf(value) === index;});
};

JSPLib.utility.setDifference = function (array1,array2) {
    return array1.filter(value=>{return array2.indexOf(value) < 0;});
};

JSPLib.utility.setIntersection = function (array1,array2) {
    return array1.filter(value=>{return array2.indexOf(value) >= 0;});
};

JSPLib.utility.setUnion = function (array1,array2) {
    return JSPLib.utility.setUnique(array1.concat(array2));
};

JSPLib.utility.setSymmetricDifference = function (array1,array2) {
    return JSPLib.utility.setDifference(JSPLib.utility.setUnion(array1,array2),JSPLib.utility.setIntersection(array1,array2));
};

//Object functions

JSPLib.utility.getObjectAttributes = function (array,attribute) {
    return array.map(val=>{return val[attribute];});
};

//Deep copy of an array of objects
JSPLib.utility.dataCopy = function (olddata) {
    let newdata = [];
    for (let i = 0;i < olddata.length;i++) {
        newdata.push(jQuery.extend(true, {}, olddata[i]));
    }
    return newdata;
};

//DOM functions

//Sets the css style and retains a pointer to the DOM object for later edits
JSPLib.utility.setCSSStyle = function (csstext,title) {
    if (title in JSPLib.utility.cssstyle) {
        JSPLib.utility.cssstyle[title].innerHTML = csstext;
    } else {
        JSPLib.utility.cssstyle[title] = document.createElement('style');
        JSPLib.utility.cssstyle[title].type = 'text/css';
        JSPLib.utility.cssstyle[title].innerHTML = csstext;
        document.head.appendChild(JSPLib.utility.cssstyle[title]);
    }
};
