/****DEPENDENCIES****/

/**External dependencies**/
// jQuery

/****SETUP****/

var JSPLib = JSPLib || {};
JSPLib.utility = JSPLib.utility || {};

/****GLOBAL VARIABLES****/

JSPLib.utility.cssstyle = {};

/****FUNCTIONS****/

//Time functions

JSPLib.utility.sleep = function (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

//Filter functions

//String filters

JSPLib.utility.filterRegex = function (array,regex) {
    return array.filter(entry=>{return entry.match(regex);});
}
JSPLib.utility.filterEmpty = function (array) {
    return JSPLib.utility.filterRegex(array,/[\s\S]+/)
}

//Array functions

JSPLib.utility.setUnique = function (array) {
    return array.filter((value,index,self)=>{return self.indexOf(value) === index;});
}

JSPLib.utility.setDifference = function (array1,array2) {
    return array1.filter(value=>{return array2.indexOf(value) < 0;});
}

JSPLib.utility.setIntersection = function (array1,array2) {
    return array1.filter(value=>{return array2.indexOf(value) >= 0;});
}

JSPLib.utility.setUnion = function (array1,array2) {
    return JSPLib.utility.setUnique(array1.concat(array2));
}

JSPLib.utility.setSymmetricDifference = function (array1,array2) {
    return JSPLib.utility.setDifference(JSPLib.utility.setUnion(array1,array2),JSPLib.utility.setIntersection(array1,array2));
}

//Object functions

//Deep copy of an array of objects
JSPLib.utility.dataCopy = function (olddata) {
    let newdata = [];
    for (let i = 0;i < olddata.length;i++) {
        newdata.push(jQuery.extend(true, {}, olddata[i]));
    }
    return newdata;
}

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
}
