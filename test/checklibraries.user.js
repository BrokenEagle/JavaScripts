// ==UserScript==
// @name         CheckLibraries
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      7.2
// @source       https://danbooru.donmai.us/users/23799
// @description  Runs tests on all of the libraries
// @author       BrokenEagle
// @match        *://*/*
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/test/checklibraries.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.5.2/localforage.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.12.0/validate.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190213/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190213/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190213/lib/concurrency.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190213/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190213/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190213/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190213/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190213/lib/debug.js
// ==/UserScript==

/****SETUP****/

JSPLib.debug.debug_console = true;

/****GLOBAL VARIABLES****/

//Time to wait before switching the page style
const csstyle_waittime = 5000;

//Needs to be configured specific to each system
const test_local_storage = false;
const test_indexed_db = true;
const test_storage = true;

//Result variables
var test_successes = 0;
var test_failures = 0;
var overall_test_successes = 0;
var overall_test_failures = 0;

//Utility variables
const walkdom_test = `
<div id="grandparent" class="generation0">
    <div id="parent0" class="generation1">
        <div id="child0a" class="generation2"></div>
        <div id="child0b" class="generation2"></div>
    </div>
    <div id="parent1" class="generation1">
        <div id="child1a" class="generation2"></div>
        <div id="child1b" class="generation2"></div>
    </div>
</div>
`;

const domdata_test = `<div data-test1="test1" data-test2="2"></div>`;

/****FUNCTIONS****/

//Result helper functions

function ResetResult() {
    test_successes = 0;
    test_failures = 0;
}

function RecordResult(bool) {
    if (bool) {
        test_successes += 1;
        overall_test_successes += 1;
    } else {
        test_failures += 1;
        overall_test_failures += 1;
    }
    return bool;
}

//Data helper functions

function repr(data) {
    return JSON.stringify(data);
}

function bracket(string) {
    return `《${string}》`;
}

function RoundToHundredth(number) {
    return Math.round(100 * number) / 100;
}

function GetValidationLength(results) {
    return (results === undefined ? 0 : Object.keys(results).length);
}

function ShowEnabled(bool) {
    return (bool ? "enabled" : "disabled");
}

function ObjectContains(obj,includes) {
    if (typeof obj !== "object") {
        console.log("Object is not an object");
        return false;
    }
    if (Object.keys(obj).length !== includes.length) {
        console.log("Object does not contain the right amount of keys");
        return false;
    }
    for (let i = 0;i < includes.length; i++) {
        if (!(includes[i] in obj)) {
            console.log("Object does not contain the key:",includes[i]);
            return false;
        }
    }
    return true;
}

//Program helper functions

async function LoadWait(program_name) {
    let numwaits = 0;
    do {
        console.log("Sleeping 1000ms");
        await JSPLib.utility.sleep(1000);
        numwaits += 1;
        if (numwaits >= 10) {
            console.log("Abandoning program test!");
            return false;
        }
    } while (typeof JSPLib.load.program_load_timers[program_name] !== 'boolean');
    return true;
}

async function RateLimit() {
    console.log("Before rate limit...");
    await JSPLib.danbooru.rateLimit();
    console.log("After rate limit...");
}

//Main functions

async function CheckDebugLibrary() {
    console.log("++++++++++++++++++++CheckDebugLibrary++++++++++++++++++++");
    ResetResult();

    console.log("Checking debuglog(): check this out");
    JSPLib.debug.pretext = "Check:";
    JSPLib.debug.debuglog("check this out");
    JSPLib.debug.debug_console = false;
    JSPLib.debug.debuglog("check this out");
    JSPLib.debug.pretext = "";

    console.log("Checking debuglogLevel(): WARNING+");
    JSPLib.debug.debug_console = true;
    JSPLib.debug.pretext = "CheckLibraries:";
    JSPLib.debug.level = JSPLib.debug.WARNING;
    JSPLib.debug.debuglogLevel("ALL",JSPLib.debug.ALL);
    JSPLib.debug.debuglogLevel("VERBOSE",JSPLib.debug.VERBOSE);
    JSPLib.debug.debuglogLevel("DEBUG",JSPLib.debug.DEBUG);
    JSPLib.debug.debuglogLevel("INFO",JSPLib.debug.INFO);
    JSPLib.debug.debuglogLevel("WARNING",JSPLib.debug.WARNING);
    JSPLib.debug.debuglogLevel("ERROR",JSPLib.debug.ERROR);

    console.log("Checking debug timer");
    JSPLib.debug.pretimer = "CL-";
    JSPLib.debug.debug_console = false;
    JSPLib.debug.debugTime("check");
    JSPLib.debug.debugTimeEnd("check");
    JSPLib.debug.debug_console = true;
    JSPLib.debug.debugTime("check");
    JSPLib.debug.debugTimeEnd("check");
    JSPLib.debug.pretimer = "";

    console.log("Checking record timer");
    JSPLib.debug.recordTime('test1','test');
    JSPLib.debug.recordTimeEnd('test1','test');
    JSPLib.debug.debug_console = false;
    JSPLib.debug.recordTime('test2','test');
    JSPLib.debug.recordTimeEnd('test2','test');
    console.log(`Should have recorded only 1 value`,RecordResult(Object.keys(JSPLib.debug.records).length === 1));

    console.log("Checking debugExecute");
    let testvalue1 = 4;
    JSPLib.debug.debugExecute(()=>{
        testvalue1 += 1;
    });
    JSPLib.debug.debug_console = true;
    JSPLib.debug.debugExecute(()=>{
        testvalue1 += 2;
    });
    console.log(`Test value should be 6 ${bracket(testvalue1)}`,RecordResult(testvalue1 === 6));

    console.log("Checking debugSyncTimer");
    testvalue1 = 4;
    let testvalue2 = 1;
    let testfunc = JSPLib.debug.debugSyncTimer(function TestfuncSync (a,b) {return a + b;});
    let result1 = testfunc(4,1);
    console.log(`Result value should be 5 ${bracket(result1)}`,RecordResult(result1 === 5));

    console.log("Checking debugAsyncTimer");
    testfunc = JSPLib.debug.debugAsyncTimer(function TestfuncAsync (a,b) {return a + b;});
    result1 = testfunc(4,1);
    let result2 = await result1;
    console.log(`Result value should be a promise ${bracket(result1)}`,RecordResult(result1 && result1.constructor && result1.constructor.name === "Promise"));
    console.log(`Result promise value should be 5 ${bracket(result2)}`,RecordResult(result2 === 5));

    console.log("Checking addFunctionLogs");
    testfunc = function FunctionLogs (a,b) {FunctionLogs.debuglog("check this out");};
    JSPLib.debug.addFunctionLogs([testfunc]);
    testfunc();
    console.log(`Function should have debuglog as a function attribute`,RecordResult('debuglog' in testfunc && typeof testfunc.debuglog === "function"));

    JSPLib.debug.level = JSPLib.debug.ALL;
    console.log(`CheckDebugLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

async function CheckUtilityLibrary() {
    console.log("++++++++++++++++++++CheckUtilityLibrary++++++++++++++++++++");
    ResetResult();

    console.log("Checking sleep(): 1000ms");
    JSPLib.debug.debugTime("sleep()");
    await JSPLib.utility.sleep(1000);
    JSPLib.debug.debugTimeEnd("sleep()");

    console.log("Checking getExpiration");
    let date1 = Date.now();
    let testexpire1 = JSPLib.utility.getExpiration(100);
    console.log(`Value ${testexpire1} should be 100 ms greater than ${Date.now()} within 1-2ms`,RecordResult(Math.abs(testexpire1 - (Date.now() + 100)) <= 2));

    console.log("Checking not");
    let testvalue1 = null;
    let resultbool1 = JSPLib.utility.not(testvalue1,false);
    let resultbool2 = JSPLib.utility.not(testvalue1,true);
    console.log(`Value ${testvalue1} should not be truthy ${bracket(resultbool1)}`,RecordResult(!resultbool1));
    console.log(`The NOT of value ${testvalue1} should be truthy ${bracket(resultbool2)}`,RecordResult(resultbool2));

    console.log("Checking setPrecision");
    testvalue1 = 1.22;
    let testvalue2 = JSPLib.utility.setPrecision(1.2222222,2);
    console.log(`Value ${testvalue1} should be equal to ${testvalue2} with a decimal precision of 2`,RecordResult(testvalue1 === testvalue2));

    console.log("Checking maxLengthString");
    testvalue1 = JSPLib.utility.maxLengthString("AUserNameThatIsWayTooLong");
    console.log(`Value ${repr(testvalue1)} should have a string length of ${JSPLib.utility.max_column_characters}`,RecordResult(testvalue1.length === JSPLib.utility.max_column_characters));

    console.log("Checking regexpEscape");
    let string1 = "tag_(qualifier)";
    let regexstring1 = "tag_\\(qualifier\\)";
    let teststring1 = JSPLib.utility.regexpEscape(string1);
    console.log(`Value ${repr(string1)} should should be regex escaped to ${repr(regexstring1)} ${bracket(repr(teststring1))}`,RecordResult(teststring1 === regexstring1));

    console.log("Checking kebabCase");
    string1 = "testKebabCase";
    let string2 = "test-kebab-case";
    teststring1 = JSPLib.utility.kebabCase(string1);
    console.log(`Value ${repr(string1)} should should be changed to ${repr(string2)} ${bracket(repr(teststring1))}`,RecordResult(teststring1 === string2));

    console.log("Checking camelCase");
    teststring1 = JSPLib.utility.camelCase(string2);
    console.log(`Value ${repr(string2)} should should be changed to ${repr(string1)} ${bracket(repr(teststring1))}`,RecordResult(teststring1 === string1));

    console.log("Checking displayCase");
    string1 = "test_display_case";
    string2 = "Test display case";
    teststring1 = JSPLib.utility.displayCase(string1);
    console.log(`Value ${repr(string1)} should should be changed to ${repr(string2)} ${bracket(repr(teststring1))}`,RecordResult(teststring1 === string2));

    console.log("Checking filterEmpty");
    let testarray1 = ["test","first","nonempty"];
    let testarray2 = ["test","first","empty",""];
    let resultarray1 = JSPLib.utility.filterEmpty(testarray1);
    let resultarray2 = JSPLib.utility.filterEmpty(testarray2);
    console.log(`Array ${repr(testarray1)} should be equal in length to ${repr(resultarray1)}`,RecordResult(testarray1.length === resultarray1.length));
    console.log(`Array ${repr(testarray2)} should not be equal in length to ${repr(resultarray2)}`,RecordResult(testarray2.length !== resultarray2.length));

    console.log("Checking filterRegex");
    let regex1 = /^(?:other|empty)/;
    resultarray1 = JSPLib.utility.filterRegex(testarray1,regex1);
    resultarray2 = JSPLib.utility.filterRegex(testarray2,regex1);
    console.log(`Array ${repr(resultarray1)} should have a length of zero`,RecordResult(resultarray1.length === 0));
    console.log(`Array ${repr(resultarray2)} should have a length of one`,RecordResult(resultarray2.length === 1));

    console.log("Checking setUnique");
    let testarray3 = ["testing","first","testing"];
    resultarray1 = JSPLib.utility.setUnique(testarray3);
    console.log(`Array ${repr(resultarray1)} should have a length of two`,RecordResult(resultarray1.length === 2));

    console.log("Checking setDifference");
    resultarray1 = JSPLib.utility.setDifference(testarray1,testarray2);
    resultarray2 = JSPLib.utility.setDifference(testarray2,testarray1);
    console.log(`Array ${repr(resultarray1)} should have a length of one`,RecordResult(resultarray1.length === 1));
    console.log(`Array ${repr(resultarray2)} should have a length of two`,RecordResult(resultarray2.length === 2));

    console.log("Checking setIntersection");
    resultarray1 = JSPLib.utility.setIntersection(testarray1,testarray2);
    console.log(`Array ${repr(resultarray1)} should have a length of two`,RecordResult(resultarray1.length === 2));

    console.log("Checking setUnion");
    resultarray1 = JSPLib.utility.setUnion(testarray1,testarray3);
    console.log(`Array ${repr(resultarray1)} should have a length of four`,RecordResult(resultarray1.length === 4));

    console.log("Checking setSymmetricDifference");
    resultarray1 = JSPLib.utility.setSymmetricDifference(testarray1,testarray3);
    console.log(`Array ${repr(resultarray1)} should have a length of three`,RecordResult(resultarray1.length === 3));

    console.log("Checking listFilter");
    let testobjectarray1 = [{id: 1, type: 'a'},{id: 2, type: 'b'}, {id: 3, type: 'b'}];
    testarray1 = [1,3];
    testarray2 = ['a'];
    let expectedobjectarray1 = [{id: 1, type: 'a'}, {id: 3, type: 'b'}];
    let expectedobjectarray2 = [{id: 2, type: 'b'}, {id: 3, type: 'b'}];
    let resultobjectarray1 = JSPLib.utility.listFilter(testobjectarray1,testarray1,'id');
    let resultobjectarray2 = JSPLib.utility.listFilter(testobjectarray1,testarray2,'type',true);
    console.log(`Object array ${repr(testobjectarray1)} with id filters on ${repr(testarray1)} should be equal to ${repr(expectedobjectarray1)} ${bracket(repr(resultobjectarray1))}`,RecordResult(JSON.stringify(resultobjectarray1) === JSON.stringify(expectedobjectarray1)));
    console.log(`Object array ${repr(testobjectarray1)} with reverse type filters on ${repr(testarray2)} should be equal to ${repr(expectedobjectarray2)} ${bracket(repr(resultobjectarray2))}`,RecordResult(JSON.stringify(resultobjectarray2) === JSON.stringify(expectedobjectarray2)));

    console.log("Checking getObjectAttributes");
    let expectedarray1 = [1,2,3];
    resultarray1 = JSPLib.utility.getObjectAttributes(testobjectarray1,'id');
    console.log(`Object array ${repr(testobjectarray1)} with getting the id attributes should be equal to ${repr(expectedarray1)} ${bracket(repr(resultarray1))}`,RecordResult(JSON.stringify(resultarray1) === JSON.stringify(expectedarray1)));

    console.log("Checking dataCopy");
    let testobject1 = {'test':0,'value':{'deep':1}};
    let copyobject1 = testobject1;
    let shallowobject1 = Object.assign({},testobject1);
    let [deepobject1] = JSPLib.utility.dataCopy([testobject1]);
    testobject1.test = 10;
    testobject1.value.deep = 11;
    console.log(`Object ${repr(copyobject1)} should have the same values as ${repr(testobject1)}`,RecordResult(copyobject1.test === 10 && copyobject1.value.deep === 11));
    console.log(`Object ${repr(shallowobject1)} should have one value the same as ${repr(testobject1)}`,RecordResult(shallowobject1.test !== 10 && copyobject1.value.deep === 11));
    console.log(`Object ${repr(deepobject1)} should have no values the same as ${repr(testobject1)}`,RecordResult(deepobject1.test !== 10 && deepobject1.value.deep !== 11));

    console.log("Checking arrayFill");
    string1 = "[]";
    testarray1 = JSPLib.utility.arrayFill(10,string1);
    //Compare to see if any entry is equal to any other entry
    resultbool1 = !testarray1.reduce((isequal,entry,i,array)=>{
        return isequal || ((i < array.length - 1) && array.slice(i+1,array.length-1).reduce((subisequal,subentry)=>{
            return subisequal || (subentry === entry);
        },false));
    },false);
    //Compare to see if all entries are equal to the JSON string when stringified
    resultbool2 = testarray1.reduce((isequal,entry)=>{return isequal && JSON.stringify(entry) === string1;},true);
    console.log(`Object ${repr(testarray1)} should have a length of 10 ${bracket(testarray1.length)}`,RecordResult(testarray1.length === 10));
    console.log(`Object ${repr(testarray1)} should have no entries equal to each other ${bracket(resultbool1)}`,RecordResult(resultbool1));
    console.log(`Object ${repr(testarray1)} should have all entries equal to the stringified JSON} ${bracket(resultbool2)}`,RecordResult(resultbool2));

    console.log("Checking hijackFunction");
    let add_function = function (a,b) {return a + b};
    let subtract_one = function (data,a,b) {return data - 1;}
    let hijacked_function = JSPLib.utility.hijackFunction(add_function,subtract_one);
    testvalue1 = add_function(3,4);
    testvalue2 = hijacked_function(3,4);
    console.log(`Original add function should produce a result of 7`,RecordResult(testvalue1 === 7));
    console.log(`Hijacked add function should produce a result of 6`,RecordResult(testvalue2 === 6));

    console.log("Checking DOMtoArray");
    let $domtest = $.parseHTML(domdata_test)[0];
    let array1 = JSPLib.utility.DOMtoArray($domtest.attributes);
    let array2 = array1.map((entry)=>{return entry.value;});
    let array3 = ['test1','2'];
    console.log(`Object returned should be an array`,RecordResult(Array.isArray(array1)));
    console.log(`Data values for object should be ${repr(array3)} ${bracket(repr(array2))}`,RecordResult(JSON.stringify(array2) === JSON.stringify(array3)));

    console.log("Checking DOMtoHash");
    let hash1 = JSPLib.utility.DOMtoHash($domtest.dataset);
    array2 = Object.keys(hash1).map((entry)=>{return hash1[entry];});
    console.log(`Object returned should be a hash`,RecordResult(hash1.constructor === Object));
    console.log(`Data values for object should be ${repr(array3)} ${bracket(repr(array2))}`,RecordResult(JSON.stringify(array2) === JSON.stringify(array3)));

    console.log("Checking getDataAttributes");
    hash1 = JSPLib.utility.getDataAttributes($domtest);
    let hash2 = {test1: "test1", test2: 2};
    console.log(`Object returned should be a hash`,RecordResult(hash1.constructor === Object));
    console.log(`Data values for object should be ${repr(hash2)} ${bracket(repr(hash1))}`,RecordResult(ObjectContains(hash1,['test1','test2']) && hash1.test1 === hash2.test1 && hash1.test2 === hash2.test2));

    console.log("Checking installScript");
    let script1 = "https://cdn.jsdelivr.net/gh/jquery/jquery-ui@1.12.1/ui/widgets/tabs.js";
    let state1 = typeof jQuery.ui.tabs;
    await JSPLib.utility.installScript(script1);
    let state2 = typeof jQuery.ui.tabs;
    console.log(`Initial state of jQuery tabs should be undefined ${bracket(repr(state1))}`,RecordResult(state1 === "undefined"));
    console.log(`Subsequent state of jQuery tabs should be a function ${bracket(repr(state2))}`,RecordResult(state2 === "function"));

    //Setup for data functions
    let jqueryobj = $("#checklibrary-count");
    jqueryobj.on("mouseenter.checklibraries.test_hover",(e)=>{
        console.log("Hovering over count...");
    });
    let testdata1 = {test_data: 'check'};
    jqueryobj.data(testdata1);
    let $domobj = jqueryobj[0];
    $(document).on("checklibraries:log-this",()=>{console.log("Check this out")});

    console.log("Checking getPrivateData");
    let data1 = JSPLib.utility.getPrivateData($domobj);
    console.log(`data should be object with 2 keys and 1 subkey ${bracket(repr(data1))}`,RecordResult(ObjectContains(data1,['events','handle']) && ObjectContains(data1.events,['mouseover'])));

    console.log("Checking getPublicData");
    data1 = JSPLib.utility.getPublicData($domobj);
    console.log(`data should be object ${repr(testdata1)} ${bracket(repr(data1))}`,RecordResult(ObjectContains(data1,['test_data']) && data1.test_data === "check"));

    console.log("Checking getBoundEventNames");
    array1 = JSPLib.utility.getBoundEventNames("#checklibrary-count",'mouseover',null);
    array2 = ['checklibraries.test_hover'];
    console.log(`Bound event names for object should be ${repr(array2)} ${bracket(repr(array1))}`,RecordResult(JSON.stringify(array1) === JSON.stringify(array2)));

    console.log("Checking isNamespaceBound");
    string1 = 'checklibraries.test_hover';
    resultbool1 = JSPLib.utility.isNamespaceBound("#checklibrary-count",'mouseover',string1);
    console.log(`Bound event names for object should include ${repr(string1)} ${bracket(repr(resultbool1))}`,RecordResult(resultbool1));

    console.log("Checking isGlobalFunctionBound");
    string1 = 'checklibraries:log-this';
    resultbool1 = JSPLib.utility.isGlobalFunctionBound(string1);
    console.log(`Global functions should include ${repr(string1)} ${bracket(repr(resultbool1))}`,RecordResult(resultbool1));

    console.log("Checking getDOMDataKeys");
    array1 = JSPLib.utility.getDOMDataKeys("#checklibrary-count");
    array2 = ['test_data'];
    console.log(`DOM data keys for object should be ${repr(array2)} ${bracket(repr(array1))}`,RecordResult(JSON.stringify(array1) === JSON.stringify(array2)));

    console.log("Checking hasDOMDataKey");
    string1 = 'test_data';
    resultbool1 = JSPLib.utility.hasDOMDataKey("#checklibrary-count",string1);
    console.log(`DOM data keys for object should include ${repr(string1)} ${bracket(repr(resultbool1))}`,RecordResult(resultbool1));

    console.log("Checking addStyleSheet");
    JSPLib.utility.addStyleSheet("https://cdn.jsdelivr.net/gh/BrokenEagle/JavaScripts@stable/test/test-css-1.css","test");
    console.log("Color set to green... changing color in 5 seconds.");
    await JSPLib.utility.sleep(csstyle_waittime);
    JSPLib.utility.addStyleSheet("https://cdn.jsdelivr.net/gh/BrokenEagle/JavaScripts@stable/test/test-css-2.css","test");
    console.log("Color set to orange... validate that there is only 1 style element.");
    console.log(`Module global cssstyle ${repr(JSPLib.utility.csssheet)} should have a length of 1`,RecordResult(Object.keys(JSPLib.utility.csssheet).length === 1));
    await JSPLib.utility.sleep(csstyle_waittime);
    JSPLib.utility.addStyleSheet("","test");

    console.log("Checking setCSSStyle");
    JSPLib.utility.setCSSStyle("body {background: black !important;}","test");
    console.log("Color set to black... changing color in 5 seconds.");
    await JSPLib.utility.sleep(csstyle_waittime);
    JSPLib.utility.setCSSStyle("body {background: purple !important;}","test");
    console.log("Color set to purple... validate that there is only 1 style element.");
    console.log(`Module global cssstyle ${repr(JSPLib.utility.cssstyle)} should have a length of 1`,RecordResult(Object.keys(JSPLib.utility.cssstyle).length === 1));
    await JSPLib.utility.sleep(csstyle_waittime);
    JSPLib.utility.setCSSStyle("","test");

    console.log("Checking fullHide");
    let selector1 = "#page";
    JSPLib.utility.fullHide(selector1);
    let expectedstyletext1 = "display: none !important;";
    let resultstyletext1 = document.querySelector(selector1).style.cssText;
    console.log(`DOM ${selector1} should have the CSS style of ${repr(expectedstyletext1)} ${bracket(repr(resultstyletext1))}`,RecordResult(expectedstyletext1 === resultstyletext1));

    console.log("Sleeping 5 seconds for visual confirmation.");
    await JSPLib.utility.sleep(csstyle_waittime);

    console.log("Checking clearHide");
    JSPLib.utility.clearHide(selector1);
    expectedstyletext1 = "";
    resultstyletext1 = document.querySelector(selector1).style.cssText;
    console.log(`DOM ${selector1} should have the CSS style of ${repr(expectedstyletext1)} ${bracket(repr(resultstyletext1))}`,RecordResult(expectedstyletext1 === resultstyletext1));

    console.log("Checking getMeta");
    let metaselector1 = "csrf-param";
    let expectedmeta1 = "authenticity_token";
    let resultmeta1 = JSPLib.utility.getMeta(metaselector1);
    console.log(`Meta ${metaselector1} should have the content of ${repr(expectedmeta1)} ${bracket(repr(resultmeta1))}`,RecordResult(expectedmeta1 === resultmeta1));

    console.log("Checking getNthParent");
    $domtest = $.parseHTML(walkdom_test);
    let child1 = $("#child0a",$domtest)[0];
    let result1 = JSPLib.utility.getNthParent(child1,1);
    console.log(`Node ${child1.id} should have parent0 as a parent ${bracket(result1.id)}`,RecordResult(result1 && result1.id === "parent0"));

    console.log("Checking getNthChild");
    let parent1 = $("#parent0",$domtest)[0];
    result1 = JSPLib.utility.getNthChild(parent1,2);
    let result2 = JSPLib.utility.getNthChild(parent1,-2);
    console.log(`Node ${parent1.id} should have child0b as the 2nd child from the start ${bracket(result1.id)}`,RecordResult(result1 && result1.id === "child0b"));
    console.log(`Node ${parent1.id} should have child0a as the 2nd child from the end ${bracket(result2.id)}`,RecordResult(result2 && result2.id === "child0a"));

    console.log("Checking getNthSibling");
    result1 = JSPLib.utility.getNthSibling(child1,1);
    console.log(`Node ${child1.id} should have child0b as its first sibling ${bracket(result1.id)}`,RecordResult(result1 && result1.id === "child0b"));

    console.log("Checking walkDOM");
    result1 = JSPLib.utility.walkDOM(child1,[[0,-1],[1,0],[0,2]])
    console.log(`Node ${child1.id} should have child1b as the second child of its parent's first sibling ${bracket(result1.id)}`,RecordResult(result1 && result1.id === "child1b"));

    console.log("Checking readCookie");
    let cookiename1 = "doesnt-exist";
    result1 = JSPLib.utility.readCookie(cookiename1);
    console.log(`Cookie ${cookiename1} should not exist ${bracket(result1)}`,RecordResult(result1 === null));

    console.log("Checking createCookie");
    let value1 = 'doesexist';
    JSPLib.utility.createCookie(cookiename1,value1);
    result1 = JSPLib.utility.readCookie(cookiename1);
    console.log(`Cookie ${cookiename1} should now exist with value 'doesexist' ${bracket(result1)}`,RecordResult(result1 === value1));

    console.log("Checking eraseCookie");
    JSPLib.utility.eraseCookie(cookiename1)
    result1 = JSPLib.utility.readCookie(cookiename1);
    console.log(`Cookie ${cookiename1} should now not exist after being erased ${bracket(result1)}`,RecordResult(result1 === null));

    console.log("Checking setupMutationObserver");
    $("#checklibrary-count").after('<span id="checklibrary-observe"></span>');
    string1 = 'nothing';
    string2 = 'something';
    value1 = string1;
    JSPLib.utility.setupMutationRemoveObserver("footer","#checklibrary-observe",()=>{console.log("Observation found!");value1 = string2;});
    $("#checklibrary-observe").replaceWith('<span id="checklibrary-observe">Observed</span>');
    await JSPLib.utility.sleep(1000);
    console.log(`Value ${repr(value1)} should be equal to ${repr(string2)}`,RecordResult(value1 === string2));

    console.log(`CheckUtilityLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

function CheckStatisticsLibrary() {
    console.log("++++++++++++++++++++CheckStatisticsLibrary++++++++++++++++++++");
    ResetResult();

    console.log("Checking average");
    let data1 = [0,1,2,3,4,20];
    let expected_result1 = 5;
    let result1 = JSPLib.statistics.average(data1);
    console.log(`Values of ${repr(data1)} should have an average of ${expected_result1}`,RecordResult(result1 === expected_result1));

    console.log("Checking standardDeviation");
    expected_result1 = 6.83;
    result1 = RoundToHundredth(JSPLib.statistics.standardDeviation(data1));
    console.log(`Values of ${repr(data1)} should have a standard deviation of ${expected_result1}`,RecordResult(result1 === expected_result1));

    console.log("Checking removeOutliers");
    result1 = JSPLib.statistics.removeOutliers(data1);
    console.log(`Values of ${repr(data1)} should have had 1 outlier removed`,RecordResult((data1.length - result1.length) === 1));

    console.log("Checking outputAdjustedMean()");
    console.log(JSPLib.debug.records);
    JSPLib.debug.records = {};
    console.log("Shouldn't see output #1");
    JSPLib.statistics.outputAdjustedMean("Statistics Test");
    JSPLib.debug.recordTime('statistics','test');
    JSPLib.debug.recordTimeEnd('statistics','test');
    console.log("Shouldn't see output #2");
    JSPLib.debug.debug_console = false;
    JSPLib.statistics.outputAdjustedMean("Statistics Test");
    console.log("Should see output #3");
    JSPLib.debug.debug_console = true;
    JSPLib.statistics.outputAdjustedMean("Statistics Test");

    console.log(`CheckStatisticsLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

function CheckValidateLibrary() {
    console.log("++++++++++++++++++++CheckValidateLibrary++++++++++++++++++++");
    ResetResult();

    //For checking library with/without validate installed
    if (typeof validate === "function") {
        console.log("Checking number_constraints");
        var testdata1 = {value: "test"};
        var testdata2 = {value: 0};
        var result1 = validate(testdata1,{value: JSPLib.validate.number_constraints});
        var result2 = validate(testdata2,{value: JSPLib.validate.number_constraints});
        console.log(`Object ${repr(testdata1)} should have 1 validation error`,RecordResult(GetValidationLength(result1) === 1));
        console.log(`Object ${repr(testdata2)} should have 0 validation errors`,RecordResult(GetValidationLength(result2) === 0));

        console.log("Checking integer_constraints");
        testdata1 = {value: 1.44};
        testdata2 = {value: 0};
        result1 = validate(testdata1,{value: JSPLib.validate.integer_constraints});
        result2 = validate(testdata2,{value: JSPLib.validate.integer_constraints});
        console.log(`Object ${repr(testdata1)} should have 1 validation error`,RecordResult(GetValidationLength(result1) === 1));
        console.log(`Object ${repr(testdata2)} should have 0 validation errors`,RecordResult(GetValidationLength(result2) === 0));

        console.log("Checking counting_constraints");
        testdata1 = {value: -1};
        testdata2 = {value: 0};
        result1 = validate(testdata1,{value: JSPLib.validate.counting_constraints});
        result2 = validate(testdata2,{value: JSPLib.validate.counting_constraints});
        console.log(`Object ${repr(testdata1)} should have 1 validation error`,RecordResult(GetValidationLength(result1) === 1));
        console.log(`Object ${repr(testdata2)} should have 0 validation errors`,RecordResult(GetValidationLength(result2) === 0));

        console.log("Checking postcount_constraints");
        testdata1 = {value: 0};
        testdata2 = {value: 1};
        result1 = validate(testdata1,{value: JSPLib.validate.postcount_constraints});
        result2 = validate(testdata2,{value: JSPLib.validate.postcount_constraints});
        console.log(`Object ${repr(testdata1)} should have 1 validation error`,RecordResult(GetValidationLength(result1) === 1));
        console.log(`Object ${repr(testdata2)} should have 0 validation errors`,RecordResult(GetValidationLength(result2) === 0));

        console.log("Checking expires_constraints");
        testdata1 = {value: -1};
        testdata2 = {value: "1"};
        result1 = validate(testdata1,{value: JSPLib.validate.expires_constraints});
        result2 = validate(testdata2,{value: JSPLib.validate.expires_constraints});
        console.log(`Object ${repr(testdata1)} should have 1 validation error`,RecordResult(GetValidationLength(result1) === 1));
        console.log(`Object ${repr(testdata2)} should have 0 validation errors`,RecordResult(GetValidationLength(result2) === 0));

        console.log("Checking inclusion_constraints");
        testdata1 = {value: null};
        testdata2 = {value: "dog"};
        let inclusion1 = ["dog","cat"];
        result1 = validate(testdata1,{value: JSPLib.validate.inclusion_constraints(inclusion1)});
        result2 = validate(testdata2,{value: JSPLib.validate.inclusion_constraints(inclusion1)});
        console.log(`Object ${repr(testdata1)} with inclusion ${repr(inclusion1)} should have 1 validation error`,RecordResult(GetValidationLength(result1) === 1));
        console.log(`Object ${repr(testdata2)} with inclusion ${repr(inclusion1)} should have 0 validation errors`,RecordResult(GetValidationLength(result2) === 0));

        console.log("Checking hash validator");
        testdata1 = {value: [0,1,2]};
        testdata2 = {value: {a: 1}};
        var validator1 = {value: {hash: true}};
        result1 = validate(testdata1,validator1);
        result2 = validate(testdata2,validator1);
        console.log(`Object ${repr(testdata1)} with validator ${repr(validator1)} should have 1 validation error`,RecordResult(GetValidationLength(result1) === 1));
        console.log(`Object ${repr(testdata2)} with validator ${repr(validator1)} should have 0 validation errors`,RecordResult(GetValidationLength(result2) === 0));

        console.log("Checking array validator");
        testdata1 = {value: [0,1,2]};
        testdata2 = {value: [0,1,2,3]};
        validator1 = {value: {array: {length: {is: 4}}}};
        var validator2 = {value: {array: {length: {minimum: 4}}}};
        var validator3 = {value: {array: {length: {maximum: 3}}}};
        result1 = validate(testdata1,validator1);
        result2 = validate(testdata1,validator2);
        var result3 = validate(testdata2,validator3);
        var result4 = validate(testdata2,validator1);
        console.log(`Object ${repr(testdata1)} with validator ${repr(validator1)} should have 1 validation error`,RecordResult(GetValidationLength(result1) === 1));
        console.log(`Object ${repr(testdata1)} with validator ${repr(validator2)} should have 1 validation error`,RecordResult(GetValidationLength(result2) === 1));
        console.log(`Object ${repr(testdata2)} with validator ${repr(validator3)} should have 1 validation error`,RecordResult(GetValidationLength(result3) === 1));
        console.log(`Object ${repr(testdata2)} with validator ${repr(validator1)} should have 0 validation errors`,RecordResult(GetValidationLength(result4) === 0));

        console.log("Checking boolean validator");
        testdata1 = {value: undefined};
        testdata2 = {value: true};
        validator1 = {value: {boolean: true}};
        result1 = validate(testdata1,validator1);
        result2 = validate(testdata2,validator1);
        console.log(`Object ${repr(testdata1)} with validator ${repr(validator1)} should have 1 validation error`,RecordResult(GetValidationLength(result1) === 1));
        console.log(`Object ${repr(testdata2)} with validator ${repr(validator1)} should have 0 validation errors`,RecordResult(GetValidationLength(result2) === 0));

        console.log("Checking string validator");
        testdata1 = {value: undefined};
        testdata2 = {value: null};
        validator1 = {value: {string: {allowNull: true}}};
        result1 = validate(testdata1,validator1);
        result2 = validate(testdata2,validator1);
        console.log(`Object ${repr(testdata1)} with validator ${repr(validator1)} should have 1 validation error`,RecordResult(GetValidationLength(result1) === 1));
        console.log(`Object ${repr(testdata2)} with validator ${repr(validator1)} should have 0 validation errors`,RecordResult(GetValidationLength(result2) === 0));

        console.log("Checking tagentryarray validator");
        testdata1 = {value: ["tag",0]};
        testdata2 = {value: [["tag",0]]};
        result1 = validate(testdata1,{value: {tagentryarray: true}});
        result2 = validate(testdata2,{value: {tagentryarray: true}});
        console.log(`Object ${repr(testdata1)} should have 1 validation error`,RecordResult(GetValidationLength(result1) === 1));
        console.log(`Object ${repr(testdata2)} should have 0 validation errors`,RecordResult(GetValidationLength(result2) === 0));

        console.log("Checking hash_constraints");
        testdata1 = {value: "0"};
        testdata2 = {value: {}};
        result1 = validate(testdata1,{value: JSPLib.validate.hash_constraints});
        result2 = validate(testdata2,{value: JSPLib.validate.hash_constraints});
        console.log(`Object ${repr(testdata1)} should have 1 validation error`,RecordResult(GetValidationLength(result1) === 1));
        console.log(`Object ${repr(testdata2)} should have 0 validation errors`,RecordResult(GetValidationLength(result2) === 0));

        console.log("Checking array_constraints");
        testdata1 = {value: null};
        testdata2 = {value: ["test"]};
        result1 = validate(testdata1,{value: JSPLib.validate.array_constraints()});
        result2 = validate(testdata2,{value: JSPLib.validate.array_constraints({is: 1})});
        console.log(`Object ${repr(testdata1)} should have 1 validation error`,RecordResult(GetValidationLength(result1) === 1));
        console.log(`Object ${repr(testdata2)} should have 0 validation errors`,RecordResult(GetValidationLength(result2) === 0));

        console.log("Checking boolean_constraints");
        testdata1 = {value: null};
        testdata2 = {value: false};
        result1 = validate(testdata1,{value: JSPLib.validate.boolean_constraints});
        result2 = validate(testdata2,{value: JSPLib.validate.boolean_constraints});
        console.log(`Object ${repr(testdata1)} should have 1 validation error`,RecordResult(GetValidationLength(result1) === 1));
        console.log(`Object ${repr(testdata2)} should have 0 validation errors`,RecordResult(GetValidationLength(result2) === 0));

        console.log("Checking stringonly_constraints");
        testdata1 = {value: null};
        testdata2 = {value: "test"};
        result1 = validate(testdata1,{value: JSPLib.validate.stringonly_constraints});
        result2 = validate(testdata2,{value: JSPLib.validate.stringonly_constraints});
        console.log(`Object ${repr(testdata1)} should have 1 validation error`,RecordResult(GetValidationLength(result1) === 1));
        console.log(`Object ${repr(testdata2)} should have 0 validation errors`,RecordResult(GetValidationLength(result2) === 0));

        console.log("Checking stringnull_constraints");
        testdata1 = {value: 0};
        testdata2 = {value: null};
        result1 = validate(testdata1,{value: JSPLib.validate.stringnull_constraints});
        result2 = validate(testdata2,{value: JSPLib.validate.stringnull_constraints});
        console.log(result1,result2);
        console.log(`Object ${repr(testdata1)} should have 1 validation error`,RecordResult(GetValidationLength(result1) === 1));
        console.log(`Object ${repr(testdata2)} should have 0 validation errors`,RecordResult(GetValidationLength(result2) === 0));

        console.log("Checking tagentryarray_constraints");
        testdata1 = {value: null};
        testdata2 = {value: [["tag",0]]};
        result1 = validate(testdata1,{value: JSPLib.validate.tagentryarray_constraints});
        result2 = validate(testdata2,{value: JSPLib.validate.tagentryarray_constraints});
        console.log(`Object ${repr(testdata1)} should have 1 validation error`,RecordResult(GetValidationLength(result1) === 1));
        console.log(`Object ${repr(testdata2)} should have 0 validation errors`,RecordResult(GetValidationLength(result2) === 0));

        console.log("Checking hashentry_constraints");
        testdata1 = {value: null};
        testdata2 = {value: {}, expires: 0};
        result1 = validate(testdata1,JSPLib.validate.hashentry_constraints);
        result2 = validate(testdata2,JSPLib.validate.hashentry_constraints);
        console.log(result1,result2);
        console.log(`Object ${repr(testdata1)} should have 2 validation error`,RecordResult(GetValidationLength(result1) === 2));
        console.log(`Object ${repr(testdata2)} should have 0 validation errors`,RecordResult(GetValidationLength(result2) === 0));

        console.log("Checking arrayentry_constraints");
        testdata1 = {expires: -1};
        testdata2 = {value: [], expires: 0};
        result1 = validate(testdata1,JSPLib.validate.arrayentry_constraints());
        result2 = validate(testdata2,JSPLib.validate.arrayentry_constraints({maximum: 1}));
        console.log(result1,result2);
        console.log(`Object ${repr(testdata1)} should have 2 validation errors`,RecordResult(GetValidationLength(result1) === 2));
        console.log(`Object ${repr(testdata2)} should have 0 validation errors`,RecordResult(GetValidationLength(result2) === 0));

        console.log("Checking validateIsHash");
        testdata1 = [];
        testdata2 = {};
        result1 = JSPLib.validate.validateIsHash('test',testdata1);
        result2 = JSPLib.validate.validateIsHash('test',testdata2);
        console.log(result1,result2);
        console.log(`Object ${repr(testdata1)} should return false`,RecordResult(result1 === false));
        console.log(`Object ${repr(testdata2)} should return true`,RecordResult(result2 === true));

        console.log("Checking validateIsArray");
        testdata1 = {};
        testdata2 = [1,2,3];
        result1 = JSPLib.validate.validateIsArray('test',testdata1,3);
        result2 = JSPLib.validate.validateIsArray('test',testdata2,3);
        console.log(result1,result2);
        console.log(`Object ${repr(testdata1)} should return false`,RecordResult(result1 === false));
        console.log(`Object ${repr(testdata2)} should return true`,RecordResult(result2 === true));

        console.log("Checking validateArrayValues");
        testdata1 = [1,2,3,4];
        testdata2 = ["one","two","three","four"];
        result1 = JSPLib.validate.validateArrayValues('test',testdata1,JSPLib.validate.stringonly_constraints);
        result2 = JSPLib.validate.validateArrayValues('test',testdata2,JSPLib.validate.stringonly_constraints);
        console.log(result1,result2);
        console.log(`Object ${repr(testdata1)} should return false`,RecordResult(result1 === false));
        console.log(`Object ${repr(testdata2)} should return true`,RecordResult(result2 === true));

        console.log("Checking validateHashEntries");
        testdata1 = {value: 5, expires: true};
        testdata2 = {value: [1,2,3,4], expires: 0};
        validator1 = JSPLib.validate.arrayentry_constraints({is: 4})
        result1 = JSPLib.validate.validateHashEntries('test',testdata1,validator1);
        result2 = JSPLib.validate.validateHashEntries('test',testdata2,validator1);
        console.log(result1,result2);
        console.log(`Object ${repr(testdata1)} should return false`,RecordResult(result1 === false));
        console.log(`Object ${repr(testdata2)} should return true`,RecordResult(result2 === true));
    }

    console.log("Checking validateExpires");
    testdata1 = Date.now() - 100;
    testdata2 = Date.now() + 100;
    result1 = JSPLib.validate.validateExpires(testdata1,100);
    result2 = JSPLib.validate.validateExpires(testdata2,100);
    console.log(`Expiration of ${testdata1} should be expired`,RecordResult(result1 === false));
    console.log(`Expiration of ${testdata2} should be unexpired`,RecordResult(result2 === true));

    console.log("Checking isHash");
    testdata1 = [];
    testdata2 = {};
    result1 = JSPLib.validate.isHash(testdata1);
    result2 = JSPLib.validate.isHash(testdata2);
    console.log(`Value of ${testdata1} should not be a hash`,RecordResult(result1 === false));
    console.log(`Value of ${testdata2} should be a hash`,RecordResult(result2 === true));

    console.log("Checking isBoolean");
    testdata2 = true;
    result1 = JSPLib.validate.isBoolean(testdata1);
    result2 = JSPLib.validate.isBoolean(testdata2);
    console.log(`Value of ${testdata1} should not be a boolean`,RecordResult(result1 === false));
    console.log(`Value of ${testdata2} should be a boolean`,RecordResult(result2 === true));

    console.log("Checking isString");
    testdata2 = "test";
    result1 = JSPLib.validate.isString(testdata1);
    result2 = JSPLib.validate.isString(testdata2);
    console.log(`Value of ${testdata1} should not be a string`,RecordResult(result1 === false));
    console.log(`Value of ${testdata2} should be a string`,RecordResult(result2 === true));

    console.log("Checking isNumber");
    testdata2 = 22.2;
    result1 = JSPLib.validate.isNumber(testdata1);
    result2 = JSPLib.validate.isNumber(testdata2);
    console.log(`Value of ${testdata1} should not be a string`,RecordResult(result1 === false));
    console.log(`Value of ${testdata2} should be a string`,RecordResult(result2 === true));

    console.log("Checking validateID");
    testdata1 = 1234;
    result1 = JSPLib.validate.validateID(testdata1);
    result2 = JSPLib.validate.validateID(testdata2);
    console.log(`Record ID of ${testdata1} should be valid`,RecordResult(result1 === true));
    console.log(`Record ID of ${testdata2} should be invalid`,RecordResult(result2 === false));

    console.log("Checking validateIDList");
    testdata1 = [1,2,3,4];
    testdata2 = [1,'a',-1,null];
    result1 = JSPLib.validate.validateIDList(testdata1);
    result2 = JSPLib.validate.validateIDList(testdata2);
    console.log(`Record ID of ${testdata1} should be valid`,RecordResult(result1 === true));
    console.log(`Record ID of ${testdata2} should be invalid`,RecordResult(result2 === false));

    console.log(`CheckValidateLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

async function CheckStorageLibrary() {
    console.log("++++++++++++++++++++CheckStorageLibrary++++++++++++++++++++");
    ResetResult();

    console.log("Checking global variables");
    console.log(`use_local_storage should be ${ShowEnabled(test_local_storage)}`,RecordResult(JSPLib.storage.use_local_storage == test_local_storage));
    console.log(`use_indexed_db should be ${ShowEnabled(test_indexed_db)}`,RecordResult(JSPLib.storage.use_indexed_db == test_indexed_db));
    console.log(`use_storage should be ${ShowEnabled(test_storage)}`,RecordResult(JSPLib.storage.use_storage == test_storage));

    console.log("Checking setStorageData");
    let data1 = ["check this"];
    let data2 = JSON.stringify(data1);
    JSPLib.storage.setStorageData('session-value',data1,sessionStorage);
    JSPLib.storage.setStorageData('local-value',data1,localStorage);
    let result1 = sessionStorage.getItem('session-value');
    let result2 = localStorage.getItem('local-value');
    console.log(`session-value stored in sessionStorage as ${repr(result1)} should be equal to the stringified data ${repr(data1)}`,RecordResult(result1 === data2));
    console.log(`local-value stored in localStorage as ${repr(result1)} should be equal to the stringified data ${repr(data1)}`,RecordResult(result2 === data2));

    console.log("Checking getStorageData");
    data1 = `[check this]`;
    data2 = ["check this"];
    sessionStorage.setItem('bad-value',data1);
    JSPLib.storage.setStorageData('good-value',data2,sessionStorage);
    result1 = JSPLib.storage.getStorageData('bad-value',sessionStorage);
    result2 = JSPLib.storage.getStorageData('good-value',sessionStorage);
    let result3 = JSPLib.storage.getStorageData('nonexistent-value',sessionStorage,[0]);
    console.log(`bad-value with data ${repr(data1)} should return null ${bracket(repr(result1))}`,RecordResult(result1 === null));
    console.log(`good-value with data ${repr(data2)} should return value ${bracket(repr(result2))}]`,RecordResult(result2 && result2[0] === "check this"));
    console.log(`nonexistant-value with default value [0] should return default value ${bracket(repr(result3))}`,RecordResult(result3 && result3[0] === 0));

    console.log("Checking pruneStorageData");
    let testvalue = "test".repeat(1000);
    JSPLib.storage.setStorageData('testremove',{expires: 1, value: testvalue},sessionStorage);
    JSPLib.storage.setStorageData('teststay',{expires: 0, value: testvalue},sessionStorage);
    JSPLib.storage.pruneStorageData(sessionStorage);
    result1 = JSPLib.storage.getStorageData('testremove',sessionStorage);
    result2 = JSPLib.storage.getStorageData('teststay',sessionStorage);
    console.log(`testremove should be pruned and return null with getStorageData ${bracket(repr(result1))}`,RecordResult(result1 === null));
    console.log(`teststay shouldn't be pruned and return value with getStorageData ${bracket(repr(result2))}`,RecordResult(result2 && result2.value && result2.value === testvalue));

    console.log("Checking storage quota exceeded");
    JSPLib.debug.level = JSPLib.debug.WARNING;
    let testsize1 = JSON.stringify(sessionStorage).length;
    for (let i = 0; i < 2000; i++) {
        JSPLib.storage.setStorageData('test'+i,{expires: 1, value: testvalue},sessionStorage);
        testsize1 += testvalue.length;
    }
    let testsize2 = JSON.stringify(sessionStorage).length;
    console.log(`expected size of storage ${bracket(testsize1)}} should be greater than actual size ${bracket(testsize2)}`,RecordResult(testsize1 > testsize2));
    JSPLib.debug.level = JSPLib.debug.VERBOSE;

    console.log("Checking hasDataExpired");
    let data3 = {expires: Date.now() - 10000, value: data2};
    let data4 = {expires: Date.now() + 10000, value: data2};
    result1 = JSPLib.storage.hasDataExpired("result1",undefined);
    result2 = JSPLib.storage.hasDataExpired("result2",data2);
    result3 = JSPLib.storage.hasDataExpired("result3",data3);
    let result4 = JSPLib.storage.hasDataExpired("result4",data4);
    let result5 = JSPLib.storage.hasDataExpired("result5",data4,1000);
    console.log(`undefined data should have expired ${bracket(repr(result1))}`,RecordResult(result1 === true));
    console.log(`data with no expires ${repr(data2)} should have expired ${bracket(repr(result2))}`,RecordResult(result2 === true));
    console.log(`data with expires ${repr(data3)} should have expired ${bracket(repr(result3))}`,RecordResult(result3 === true));
    console.log(`data with expires ${repr(data4)} should not have expired ${bracket(repr(result4))}`,RecordResult(result4 === false));
    console.log(`data with expires ${repr(data4)} should have an expiration that is too long ${bracket(repr(result5))}`,RecordResult(result5 === true));

    //For checking library with/without localforage installed
    if (JSPLib.storage.use_storage) {
        console.log("Checking saveData");
        await JSPLib.storage.saveData('good-value',data2);
        result1 = JSPLib.storage.getStorageData('good-value',sessionStorage);
        result2 = await JSPLib.storage.danboorustorage.getItem('good-value');
        console.log(`good-value with data ${repr(data2)} should return value (sessionStorage) ${bracket(repr(result1))}`,RecordResult(result1 && result1[0] === "check this"));
        console.log(`good-value with data ${repr(data2)} should return value (indexedDB) ${bracket(repr(result2))}`,RecordResult(result2 && result2[0] === "check this"));

        console.log("Checking retrieveData");
        sessionStorage.removeItem('bad-value');
        await JSPLib.storage.danboorustorage.removeItem('bad-value');
        result1 = await JSPLib.storage.retrieveData('bad-value');
        result2 = await JSPLib.storage.retrieveData('good-value');
        sessionStorage.removeItem('good-value');
        result3 = await JSPLib.storage.retrieveData('good-value');
        console.log(`bad-value with no entry should return null ${bracket(repr(result1))}`,RecordResult(result1 === null));
        console.log(`good-value with data ${repr(data1)} should return value (sessionStorage) ${bracket(repr(result2))}`,RecordResult(result2 && result2[0] === "check this"));
        console.log(`good-value with data ${repr(data1)} should return value (indexedDB) ${bracket(repr(result3))}`,RecordResult(result3 && result3[0] === "check this"));

        console.log("Checking removeData");
        JSPLib.storage.removeData('good-value');
        result1 = JSPLib.storage.getStorageData('good-value',sessionStorage);
        result2 = await JSPLib.storage.danboorustorage.getItem('good-value');
        console.log(`good-value with data deleted should return null (sessionStorage) ${bracket(repr(result1))}`,RecordResult(result1 === null));
        console.log(`good-value with data deleted should return null (indexedDB) ${bracket(repr(result2))}`,RecordResult(result2 === null));

        console.log("Checking checkLocalDB");
        let data5 = {expires: 0, value: data2};
        await JSPLib.storage.saveData('expired-value',data3);
        await JSPLib.storage.saveData('good-value',data4);
        await JSPLib.storage.saveData('persistent-value',data5);
        let validator1 = function (key,cached) { return true;};
        let validator2 = function (key,cached) { return false;};
        result1 = await JSPLib.storage.checkLocalDB('expired-value',validator1);
        result2 = await JSPLib.storage.checkLocalDB('good-value',validator2);
        result3 = await JSPLib.storage.checkLocalDB('good-value',validator1);
        result4 = await JSPLib.storage.checkLocalDB('persistent-value',validator1);
        console.log(`expired-value with data ${repr(data3)} should return null ${bracket(repr(result1))}`,RecordResult(result1 === null));
        console.log(`good-value with data ${repr(data4)} with false validation should return null ${bracket(repr(result2))}`,RecordResult(result2 === null));
        console.log(`good-value with data ${repr(data4)} with true validation should return value ${bracket(repr(result3))}`,RecordResult(result3 && result3.value && result3.value[0] === "check this"));
        console.log(`persistent-value with data ${repr(data5)} should return value ${bracket(repr(result4))}`,RecordResult(result4 && result4.expires === 0 && result4.value && result4.value[0] === "check this"));

        console.log("Checking pruneStorage");
        await JSPLib.storage.pruneStorage(/-value$/);
        result1 = await JSPLib.storage.retrieveData('expired-value');
        result2 = await JSPLib.storage.retrieveData('good-value');
        console.log(`expired-value should be pruned and return null with retrieveData ${bracket(repr(result1))}`,RecordResult(result1 === null));
        console.log(`good-value shouldn't be pruned and return value with retrieveData ${bracket(repr(result2))}`,RecordResult(result2 && result2.value && result2.value[0] === "check this"));

        console.log("Checking pruneEntries");
        await JSPLib.storage.saveData('expired-value',data3);
        await JSPLib.storage.saveData('good-value',data4);
        await JSPLib.storage.pruneEntries('cl', /-value$/, JSPLib.utility.one_minute);
        result1 = await JSPLib.storage.retrieveData('expired-value');
        result2 = await JSPLib.storage.retrieveData('good-value');
        console.log(`expired-value should be pruned and return null with retrieveData ${bracket(repr(result1))}`,RecordResult(result1 === null));
        console.log(`good-value shouldn't be pruned and return value with retrieveData ${bracket(repr(result2))}`,RecordResult(result2 && result2.value && result2.value[0] === "check this"));

        console.log("Checking purgeCache");
        await JSPLib.storage.saveData('expired-value',data3);
        await JSPLib.storage.saveData('good-value',data4);
        await JSPLib.storage.purgeCache(/-value$/,"#checklibrary-count");
        result1 = await JSPLib.storage.retrieveData('expired-value');
        result2 = await JSPLib.storage.retrieveData('good-value');
        result3 = await JSPLib.storage.retrieveData('persistent-value');
        console.log(`expired-value should be pruned and return null with retrieveData ${bracket(repr(result1))}`,RecordResult(result1 === null));
        console.log(`good-value should be pruned and return null with retrieveData ${bracket(repr(result2))}`,RecordResult(result2 === null));
        console.log(`persistent-value should be pruned and return null with retrieveData ${bracket(repr(result3))}`,RecordResult(result3 === null));
    }

    //Cleanup actions
    sessionStorage.clear();

    console.log(`CheckStorageLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

async function CheckDanbooruLibrary() {
    console.log("++++++++++++++++++++CheckDanbooruLibrary++++++++++++++++++++");
    ResetResult();

    console.log("Checking joinArgs");
    let object1 = {search: {id: "20,21,5"}};
    let object2 = {search: {order: "customorder"}};
    let result1 = JSPLib.danbooru.joinArgs(object1,object2);
    console.log(`joining arguments ${repr(object1)} and ${repr(object2)} should have the 2 search arguments [${repr(result1)}]`,RecordResult(ObjectContains(result1,['search']) && ObjectContains(result1.search,['id','order']) && result1.search.id === "20,21,5" && result1.search.order === "customorder"));

    console.log("Checking getNextPageID");
    let array1 = [{id:25},{id:26},{id:27}];
    result1 = JSPLib.danbooru.getNextPageID(array1,false);
    let result2 = JSPLib.danbooru.getNextPageID(array1,true);
    console.log(`for item array ${repr(array1)}, the next page ID going in forward should be 25 [${repr(result1)}]`,RecordResult(result1 === 25));
    console.log(`for item array ${repr(array1)}, the next page ID going in reverse should be 27 [${repr(result2)}]`,RecordResult(result2 === 27));

    console.log("Checking incrementCounter");
    JSPLib.danbooru.counter_domname = "#checklibrary-count";
    await JSPLib.utility.sleep(5000);
    result1 = JSPLib.danbooru.num_network_requests;
    JSPLib.danbooru.incrementCounter();
    result2 = JSPLib.danbooru.num_network_requests;
    console.log(`the counter should have incremented by 1 [${repr(result1)}]`,RecordResult((result2 - result1) === 1));

    console.log("Checking decrementCounter");
    await JSPLib.utility.sleep(5000);
    result1 = JSPLib.danbooru.num_network_requests;
    JSPLib.danbooru.decrementCounter();
    result2 = JSPLib.danbooru.num_network_requests;
    console.log(`the counter should have decremented by 1 [${repr(result1)}]`,RecordResult((result1 - result2) === 1));

    console.log("Checking rateLimit");
    JSPLib.danbooru.num_network_requests = JSPLib.danbooru.max_network_requests;
    RateLimit();
    await JSPLib.utility.sleep(5000);
    JSPLib.danbooru.num_network_requests = 0;
    await JSPLib.utility.sleep(2000);

    console.log("Checking getShortName");
    result1 = JSPLib.danbooru.getShortName('copyright');
    result2 = JSPLib.danbooru.getShortName('general');
    let result3 = JSPLib.danbooru.getShortName('artist');
    let result4 = JSPLib.danbooru.getShortName('character');
    console.log(`the short name for copyright should be copy [${repr(result1)}]`,RecordResult(result1 === 'copy'));
    console.log(`the short name for general should be gen [${repr(result2)}]`,RecordResult(result2 === 'gen'));
    console.log(`the short name for artist should be art [${repr(result2)}]`,RecordResult(result3 === 'art'));
    console.log(`the short name for character should be char [${repr(result2)}]`,RecordResult(result4 === 'char'));

    console.log("Checking randomDummyTag");
    let string1 = JSPLib.danbooru.randomDummyTag();
    let string2 = "notadummytag";
    let regex1 = /^dummytag-[0-9a-z]{8}$/;
    result1 = string1.match(regex1);
    result2 = string2.match(regex1);
    console.log(`the string ${repr(string1)} should be a dummy tag [${repr(result1)}]`,RecordResult(!!result1));
    console.log(`the string ${repr(string2)} should not be a dummy tag [${repr(result2)}]`,RecordResult(!result2));

    console.log("Checking tagOnlyRegExp");
    string1 = "character_(qualifier)";
    string2 = "qualifier";
    regex1 = JSPLib.danbooru.tagOnlyRegExp(string1);
    let regex2 = /^character_\(qualifier\)$/i;
    let regex3 = JSPLib.danbooru.tagRegExp(string2);
    result1 = string1.match(regex1);
    result2 = string1.match(regex3);
    console.log(`the tag ${repr(string1)} should produce the regex ${String(regex2)} ${bracket(String(regex1))}`,RecordResult(String(regex1) === String(regex2)));
    console.log(`the regex ${String(regex1)} should find one match in the string ${repr(string1)} ${bracket(repr(result1))}`,RecordResult(Array.isArray(result1) && result1.length === 1 && result1[0] === string1));
    console.log(`the regex ${String(regex3)} should find no matches in the string ${repr(string1)} ${bracket(repr(result2))}`,RecordResult(result2 === null));

    var skip_test = false;
    try {
        JSPLib.danbooru.tagRegExp("");
    } catch (e) {
        console.log("No lookarounds... skipping tagRegExp test!");
        skip_test = true;
    }
    if (!skip_test) {
        console.log("Checking tagRegExp");
        string1 = "1girl solo aliased:_the_tag standing aliased:_the_tag character_(qualifier) short_hair";
        string2 = "aliased:_the_tag";
        let string3 = "alias_tag";
        let string4 = "qualifier animated 1girl";
        let string5 = "qualifier";
        regex1 = JSPLib.danbooru.tagRegExp(string2);
        regex2 = /(?<=(?:^|\s))aliased\:_the_tag(?=(?:$|\s))/gi;
        regex3 = JSPLib.danbooru.tagRegExp(string5);
        result1 = string1.match(regex1);
        result2 = string1.replace(regex1,string3);
        result3 = string1.match(regex3);
        result4 = string4.match(regex3);
        console.log(`the tag ${repr(string2)} should produce the regex ${String(regex2)} [${String(regex1)}]`,RecordResult(String(regex1) === String(regex2)));
        console.log(`the regex ${String(regex1)} should find two matches in the string ${repr(string1)} [${repr(result1)}]`,RecordResult(Array.isArray(result1) && result1.length === 2 && result1[0] === string2));
        console.log(`the regex ${String(regex1)} should replace the tag ${repr(string2)} with ${repr(string3)} in the string ${repr(string1)} [${repr(result2)}]`,RecordResult(result2 === "1girl solo alias_tag standing alias_tag character_(qualifier) short_hair"));
        console.log(`the regex ${String(regex3)} should find no matches in the string ${repr(string1)} [${repr(result3)}]`,RecordResult(result3 === null));
        console.log(`the regex ${String(regex3)} should find one match in the string ${repr(string4)} [${repr(result4)}]`,RecordResult(Array.isArray(result4) && result4.length === 1 && result4[0] === string5));
    }

    console.log("Checking postSearchLink");
    string1 = "1girl solo";
    string2 = "Check this link";
    let option1 = `class="search-tag"`;
    let string3 = '<a class="search-tag" href="/posts?tags=1girl+solo">Check this link</a>';
    result1 = JSPLib.danbooru.postSearchLink(string1,string2,option1);
    console.log(`the tag ${repr(string1)} with text ${repr(string2)} should produce the link  ${repr(string3)} [${repr(result1)}]`,RecordResult(result1 === string3));

    console.log("Checking submitRequest");
    let type1 = 'posts';
    let type2 = 'doesntexist';
    let addons1 = {limit:1};
    result1 = await JSPLib.danbooru.submitRequest(type1,addons1);
    result2 = await JSPLib.danbooru.submitRequest(type2);
    console.log(`with type ${type1} and addons ${repr(addons1)}, a single post should have been returned [${repr(result1)}]`,RecordResult(Array.isArray(result1) && result1.length === 1));
    console.log(`with nonexistent type ${type2}, null should be returned [${repr(result2)}]`,RecordResult(result2 === null));

    console.log("Checking getAllItems");
    type1 = 'users';
    addons1 = {search:{level:50}}; //Search for admins
    let page1 = 1; //Except for the first admin
    let limit1 = 1; //One at a time
    let reverse1 = true; //Starting from lowest to highest ID
    result1 = await JSPLib.danbooru.getAllItems(type1,limit1,{addons:addons1,page:page1,reverse:true});
    result2 = JSPLib.utility.getObjectAttributes(result1,'id');
    result3 = JSPLib.utility.getObjectAttributes(result1,'level').reduce((total,entry)=>{return total && entry === 50;},true);
    console.log(`with type ${type1} and addons ${repr(addons1)}, four users should have been returned [${repr(result1)}]`,RecordResult(Array.isArray(result1) && result1.length === 4));
    console.log(`should have also not returned the first user [${repr(result2)}]`,RecordResult(Array.isArray(result2) && !result2.includes(1)));
    console.log(`should have also returned users in reverse order [${repr(result2)}]`,RecordResult(Array.isArray(result2) && result2.length === 4 && result2[0] < result2[1] && result2[1] < result2[2] && result2[2] < result2[3]));
    console.log("should have also returned only admins",RecordResult(result3));

    console.log("Checking rateLimit #2");
    JSPLib.danbooru.num_network_requests = JSPLib.danbooru.max_network_requests;
    JSPLib.danbooru.submitRequest(type1,addons1).then(()=>{console.log("Finished submitting request!");});
    await JSPLib.utility.sleep(5000);
    JSPLib.danbooru.num_network_requests = 0;
    await JSPLib.utility.sleep(2000);

    console.log(`CheckDanbooruLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

async function CheckLoadLibrary() {
    console.log("++++++++++++++++++++CheckLoadLibrary++++++++++++++++++++");
    ResetResult();

    console.log("Checking isVariableDefined");
    window.doesexist = null;
    let test1 = JSPLib.load._isVariableDefined('window.doesexist');
    let test2 = JSPLib.load._isVariableDefined('window.doesntexist');
    console.log(`variable 'window.doesexist' should exist`,RecordResult(test1 === true));
    console.log(`variable 'window.doesntexist' shouldn't exist`,RecordResult(test2 === false));

    console.log("Checking programInitialize and programLoad");
    let function1 = function() { console.log("Shouldn't run!");};
    let function2 = function() { console.log("Should run!");};
    window.goodvariable = true;
    $("body").append(`<div id="id-does-exist">`);
    $("body").append(`<div class="class-does-exist">`);

    console.log("Starting program load with bad variable");
    JSPLib.load.programInitialize(function1,'timer1',['window.badvariable'],[],5);
    let test_success = await LoadWait('timer1');
    if (test_success) {
        console.log(`program load waiting on "window.badvariable" should not have run`,RecordResult(JSPLib.load.program_load_timers.timer1 === false));
        console.log(`program load waiting on "window.badvariable" should have tried 6 times [${JSPLib.load.program_load_retries.timer1}]`,RecordResult(JSPLib.load.program_load_retries.timer1 === 6));
    } else {
        RecordResult(test_success);
    }

    console.log("Starting program load with bad DOM id");
    JSPLib.load.programInitialize(function1,'timer2',[],['#id-doesnt-exist'],1);
    test_success = await LoadWait('timer2');
    if (test_success) {
        console.log(`program load waiting on #id-doesnt-exist should not have run`,RecordResult(JSPLib.load.program_load_timers.timer2 === false));
        console.log(`program load waiting on #id-doesnt-exist should have tries 2 times [${JSPLib.load.program_load_retries.timer2}]`,RecordResult(JSPLib.load.program_load_retries.timer2 === 2));
    } else {
        RecordResult(test_success);
    }

    console.log("Starting program load with bad DOM class");
    JSPLib.load.programInitialize(function1,'timer3',[],['.class-doesnt-exist'],0);
    test_success = await LoadWait('timer3');
    if (test_success) {
        console.log(`program load waiting on .class-doesnt-exist should not have run`,RecordResult(JSPLib.load.program_load_timers.timer3 === false));
        console.log(`program load waiting on .class-doesnt-exist should have retried once [${JSPLib.load.program_load_retries.timer3}]`,RecordResult(JSPLib.load.program_load_retries.timer3 === 0));
    } else {
        RecordResult(test_success);
    }

    console.log("Starting program load with bad DOM tagname");
    JSPLib.load.programInitialize(function1,'timer4',[],['badtag'],0);
    test_success = await LoadWait('timer4');
    if (test_success) {
        console.log(`program load waiting on <badtag> should not have run`,RecordResult(JSPLib.load.program_load_timers.timer4 === false));
        console.log(`program load waiting on <badtag> should have retried once [${JSPLib.load.program_load_retries.timer4}]`,RecordResult(JSPLib.load.program_load_retries.timer4 === 0));
    } else {
        RecordResult(test_success);
    }

    console.log("Starting good program load");
    JSPLib.load.programInitialize(function2,'timer5',['window.goodvariable'],['#id-does-exist','.class-does-exist','body'],5);
    test_success = await LoadWait('timer5');
    if (test_success) {
        console.log(`program load waiting on "window.goodvariable" should have run`,RecordResult(JSPLib.load.program_load_timers.timer5 === true));
        console.log(`program load waiting on "window.goodvariable" should have tried once [${JSPLib.load.program_load_retries.timer5}]`,RecordResult(JSPLib.load.program_load_retries.timer5 === 0));
    } else {
        RecordResult(test_success);
    }

    console.log(`CheckLoadLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

async function checklibrary() {
    $("footer").prepend('<span id="checklibrary-count" style="font-size:400%">0</span>');
    await CheckDebugLibrary();
    await CheckUtilityLibrary();
    CheckStatisticsLibrary();
    CheckValidateLibrary();
    await CheckStorageLibrary();
    await CheckDanbooruLibrary();
    await CheckLoadLibrary();

    console.log(`All library results: ${overall_test_successes} succeses, ${overall_test_failures} failures`);
}

/****PROGRAM START****/

JSPLib.load.programInitialize(checklibrary,'CL',['window.jQuery','window.Danbooru'],["footer"]);
