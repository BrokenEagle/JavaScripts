/****FUNCTIONS****/

//Time functions

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

//Filter functions

function filterNull(array) {
    return array.filter(value=>{return value !== '';});
}

function regexFilter(array,regex) {
    return array.filter(entry=>{return entry.match(regex);});
}

//Array functions

function setDifference(array1,array2) {
    return array1.filter(value=>{return array2.indexOf(value) < 0;});
}

function setIntersection(array1,array2) {
    return array1.filter(value=>{return array2.indexOf(value) >= 0;});
}

//Object functions

function dataCopy(olddata) {
    let newdata = [];
    $.each(olddata, (i,data)=>{
        newdata.push(jQuery.extend(true, {}, data));
    });
    return newdata;
}

//Other functions

//Sets the css style and retains a pointer to the DOM object for later edits
function setCSSStyle(csstext,title) {
    if (title in setCSSStyle.cssstyle) {
        setCSSStyle.cssstyle[title].innerHTML = csstext;
    } else {
        setCSSStyle.cssstyle[title] = document.createElement('style');
        setCSSStyle.cssstyle[title].type = 'text/css';
        setCSSStyle.cssstyle[title].innerHTML = csstext;
        document.head.appendChild(setCSSStyle.cssstyle[title]);
    }
}
setCSSStyle.cssstyle = {};
