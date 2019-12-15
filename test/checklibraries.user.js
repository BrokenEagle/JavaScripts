// ==UserScript==
// @name         CheckLibraries
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      10.6
// @source       https://danbooru.donmai.us/users/23799
// @description  Runs tests on all of the libraries
// @author       BrokenEagle
// @match        https://danbooru.donmai.us/static/site_map
// @grant        GM.xmlHttpRequest
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/test/checklibraries.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.5.2/localforage.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.12.0/validate.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190929/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190929/lib/concurrency.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20191221/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20191221/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20191221/lib/saucenao.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20190929/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20191221/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20191221/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20191221/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20191221/lib/debug.js
// @connect      saucenao.com
// ==/UserScript==

/* global jQuery JSPLib validate */

/****SETUP****/

JSPLib.debug.debug_console = true;

//Set this key for SauceNAO test
const saucenao_api_key = null;

const [WINDOWVALUE,WINDOWNAME] = (typeof unsafeWindow !== "undefined" ? [unsafeWindow,'unsafeWindow'] : [window,'window']);

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

function ArrayEqual(test_array,result_array) {
    if (!Array.isArray(result_array)) {
        console.log("Object is not an array");
        return false;
    }
    if (test_array.length !== result_array.length) {
        console.log("Array does not contain the right amount of values");
        return false;
    }
    for (let i = 0;i < test_array.length; i++) {
        if (test_array[i] !== result_array[i]) {
            console.log("Array does not contain matching values:",test_array[i],result_array[i]);
            return false;
        }
    }
    return true;
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

async function RateLimit(module) {
    console.log("Before rate limit...");
    await JSPLib.network.rateLimit(module);
    console.log("After rate limit...");
}

//Main functions

async function CheckDebugLibrary() {
    console.log("++++++++++++++++++++CheckDebugLibrary++++++++++++++++++++");
    console.log("Start time:", JSPLib.utility.getProgramTime());
    ResetResult();

    console.log("Checking debuglog(): check this out");
    JSPLib.debug.pretext = "Check:";
    JSPLib.debug.debuglog("enabled: check this out");
    JSPLib.debug.debuglog(() => ["delaylog: check this out"]);
    JSPLib.debug.debug_console = false;
    JSPLib.debug.debuglog("disabled: check this out");
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
    let result_length1 = Object.keys(JSPLib.debug._records).length;
    console.log(`Should have recorded only 1 value ${bracket(result_length1)}`,RecordResult(result_length1 === 1));

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

    console.log("Checking addFunctionTimers");
    const TIMER = {};
    JSPLib.debug.addFunctionTimers(TIMER, false, [
        [testfunc, 0, 1],
    ]);
    TIMER.FunctionLogs('a', 'b');
    let hash_keys = Object.keys(TIMER);
    let key_type = typeof TIMER.FunctionLogs;
    console.log(`TIMER should have one key of "FunctionLogs" ${bracket(hash_keys)}`, RecordResult('FunctionLogs' in TIMER));
    console.log(`TIMER value "FunctionLogs" should be a function ${bracket(key_type)}`, RecordResult(key_type === "function"));

    JSPLib.debug.level = JSPLib.debug.ALL;
    console.log(`CheckDebugLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

async function CheckUtilityLibrary() {
    console.log("++++++++++++++++++++CheckUtilityLibrary++++++++++++++++++++");
    console.log("Start time:", JSPLib.utility.getProgramTime());
    ResetResult();

    console.log("Checking sleep(): 1000ms");
    JSPLib.debug.debugTime("sleep()");
    await JSPLib.utility.sleep(1000);
    JSPLib.debug.debugTimeEnd("sleep()");

    console.log("Checking getExpires");
    let date1 = Date.now();
    let testexpire1 = JSPLib.utility.getExpires(100);
    console.log(`Value ${testexpire1} should be 100 ms greater than ${Date.now()} within 1-2ms`,RecordResult(Math.abs(testexpire1 - (Date.now() + 100)) <= 2));

    console.log("Checking validateExpires");
    let testdata1 = Date.now() - 100;
    let testdata2 = Date.now() + 100;
    let result1 = JSPLib.utility.validateExpires(testdata1,100);
    let result2 = JSPLib.utility.validateExpires(testdata2,100);
    console.log(`Expiration of ${testdata1} should be expired`,RecordResult(result1 === false));
    console.log(`Expiration of ${testdata2} should be unexpired`,RecordResult(result2 === true));

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

    console.log("Checking getUniqueID");
    testvalue1 = JSPLib.utility.getUniqueID();
    testvalue2 = JSPLib.utility.getUniqueID();
    console.log(`Value ${testvalue1} should not be equal to ${testvalue2}`,RecordResult(testvalue1 !== testvalue2));

    console.log("Checking maxLengthString");
    testvalue1 = JSPLib.utility.maxLengthString("AUserNameThatIsWayTooLong");
    testvalue2 = JSPLib.utility.maxLengthString("AUserNameThatIsWayTooLong",10);
    console.log(`Value ${repr(testvalue1)} should have a string length of ${JSPLib.utility.max_column_characters}`,RecordResult(testvalue1.length === JSPLib.utility.max_column_characters));
    console.log(`Value ${repr(testvalue2)} should have a string length of 10`,RecordResult(testvalue2.length === 10));

    console.log("Checking kebabCase");
    let string1 = "testKebabCase";
    let string2 = "test-kebab-case";
    let teststring1 = JSPLib.utility.kebabCase(string1);
    console.log(`Value ${repr(string1)} should should be changed to ${repr(string2)} ${bracket(repr(teststring1))}`,RecordResult(teststring1 === string2));

    console.log("Checking camelCase");
    teststring1 = JSPLib.utility.camelCase(string2);
    console.log(`Value ${repr(string2)} should should be changed to ${repr(string1)} ${bracket(repr(teststring1))}`,RecordResult(teststring1 === string1));

    console.log("Checking displayCase");
    string1 = "test_display_case";
    string2 = "Test display case";
    teststring1 = JSPLib.utility.displayCase(string1);
    console.log(`Value ${repr(string1)} should should be changed to ${repr(string2)} ${bracket(repr(teststring1))}`,RecordResult(teststring1 === string2));

    console.log("Checking padNumber");
    let num1 = 23;
    string1 = "0023";
    teststring1 = JSPLib.utility.padNumber(num1,4);
    console.log(`Value ${repr(num1)} should should be changed to ${repr(string1)} ${bracket(repr(teststring1))}`,RecordResult(teststring1 === string1));

    console.log("Checking sprintf");
    string1 = "%s test %s";
    string2 = "this test 3";
    teststring1 = JSPLib.utility.sprintf(string1,"this",3);
    console.log(`Value ${repr(string1)} should should be changed to ${repr(string2)} ${bracket(repr(teststring1))}`,RecordResult(teststring1 === string2));

    console.log("Checking trim");
    string1 = "something something";
    teststring1 = JSPLib.utility.trim`  \r\r  something something    \n\n  `;
    console.log(`Value ${repr(teststring1)} should should be equal to ${repr(string1)}`,RecordResult(teststring1 === string1));

    console.log("Checking findAll");
    string1 = "100 200 300 400";
    let array1 = ["100", "200", "300", "400"];
    result1 = JSPLib.utility.findAll(string1,/\d+/g);
    console.log(`Value ${repr(string1)} should should find matches ${repr(array1)} ${bracket(repr(result1))}`,RecordResult(ArrayEqual(array1,result1)));

    console.log("Checking regexpEscape");
    string1 = "tag_(qualifier)";
    let regexstring1 = "tag_\\(qualifier\\)";
    teststring1 = JSPLib.utility.regexpEscape(string1);
    console.log(`Value ${repr(string1)} should should be regex escaped to ${repr(regexstring1)} ${bracket(repr(teststring1))}`,RecordResult(teststring1 === regexstring1));

    console.log("Checking regexReplace");
    string1 = "10 something false";
    let format_string1 = "%NUMBER% %STRING% %BOOL%";
    let format_data1 = {NUMBER: 10, STRING: "something", BOOL: false};
    teststring1 = JSPLib.utility.regexReplace(format_string1,format_data1);
    console.log(`Format ${repr(format_string1)} and data ${repr(format_data1)} should should be regex replaced to ${repr(string1)} ${bracket(repr(teststring1))}`,RecordResult(string1 === teststring1));

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

    console.log("Checking concat");
    array1 = [1,2,3];
    let array2 = [4,5,6];
    let checkarray1 = [1,2,3,4,5,6];
    resultarray1 = JSPLib.utility.concat(array1,array2);
    console.log(`Array ${repr(array1)} concatenated with ${repr(array2)} should become ${repr(checkarray1)} ${bracket(resultarray1)}`,RecordResult(ArrayEqual(checkarray1,resultarray1)));

    console.log("Checking setUnique");
    let testarray3 = ["testing","first","testing"];
    checkarray1 = ["testing","first"];
    resultarray1 = JSPLib.utility.setUnique(testarray3);
    console.log(`Array ${repr(testarray3)} should become ${repr(checkarray1)} ${bracket(resultarray1)}`,RecordResult(ArrayEqual(checkarray1,resultarray1)));

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

    console.log("Checking arrayEquals");
    array1 = [1,2,3];
    array2 = [1,2,3];
    let array3 = [2,4];
    resultbool1 = JSPLib.utility.arrayEquals(array1,array2);
    resultbool2 = JSPLib.utility.arrayEquals(array1,array3);
    console.log(`Array ${repr(array2)} should be equal to ${repr(array1)}`,RecordResult(resultbool1));
    console.log(`Array ${repr(array3)} should not be equal to ${repr(array1)}`,RecordResult(!resultbool2));

    console.log("Checking isSubset");
    array1 = [1,2,3];
    array2 = [1,3];
    array3 = [2,4];
    resultbool1 = JSPLib.utility.isSubset(array1,array2);
    resultbool2 = JSPLib.utility.isSubset(array1,array3);
    console.log(`Array ${repr(array2)} should be a subset of ${repr(array1)}`,RecordResult(resultbool1));
    console.log(`Array ${repr(array3)} should not be a subset of ${repr(array1)}`,RecordResult(!resultbool2));

    console.log("Checking isSuperset");
    array1 = [1,2,3];
    array2 = [1,3];
    resultbool1 = JSPLib.utility.isSuperset(array1,array2);
    resultbool2 = JSPLib.utility.isSuperset(array2,array1);
    console.log(`Array ${repr(array2)} should not be a superset of ${repr(array1)}`,RecordResult(!resultbool1));
    console.log(`Array ${repr(array1)} should be a superset of ${repr(array2)}`,RecordResult(resultbool2));

    console.log("Checking hasIntersection");
    array1 = [1,2,3];
    array2 = [3,5];
    array3 = [5,6];
    resultbool1 = JSPLib.utility.hasIntersection(array1,array2);
    resultbool2 = JSPLib.utility.hasIntersection(array1,array3);
    console.log(`Array ${repr(array1)} should have an intersection with ${repr(array2)}`,RecordResult(resultbool1));
    console.log(`Array ${repr(array1)} should not have an intersection with ${repr(array3)}`,RecordResult(!resultbool2));

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

    console.log("Checking joinList");
    string1 = "test-1-section,test-3-section";
    teststring1 = JSPLib.utility.joinList(testarray1,"test-",'-section',',');
    console.log(`Value ${repr(testarray1)} should should be changed to ${repr(string1)} ${bracket(repr(teststring1))}`,RecordResult(teststring1 === string1));

    console.log("Checking freezeObject");
    let testobject1 = {id: 1, type: {a: 1, b:2}};
    let testobject2 = {id: 2, type: {a: 3, b:4}};
    JSPLib.utility.freezeObject(testobject1);
    JSPLib.utility.freezeObject(testobject2,true);
    let boolarray1 = [Object.isFrozen(testobject1), !Object.isFrozen(testobject1.type)];
    let boolarray2 = [Object.isFrozen(testobject2), Object.isFrozen(testobject2.type)];
    console.log(`Object ${repr(testobject1)} should be frozen but not object attributes ${bracket(repr(boolarray1))}`,RecordResult(boolarray1.every(val => val)));
    console.log(`Object ${repr(testobject2)} and object attributes should be frozen ${bracket(repr(boolarray2))}`,RecordResult(boolarray2.every(val => val)));

    console.log("Checking freezeObjects");
    testobjectarray1 = [{id: 1, type: {a: 1, b:2}}, {id: 2, type: {a: 3, b:4}}];
    JSPLib.utility.freezeObjects(testobjectarray1,true);
    boolarray1 = [Object.isFrozen(testobjectarray1[0]), Object.isFrozen(testobjectarray1[0].type), Object.isFrozen(testobjectarray1[1]), Object.isFrozen(testobjectarray1[1].type)];
    console.log(`Objects array ${repr(testobjectarray1)} should have the object and object attributes be frozen ${bracket(repr(boolarray1))}`,RecordResult(boolarray1.every(val => val)));

    console.log("Checking freezeProperty");
    testobject1 = {id: 1, type: {a: 1, b:2}};
    JSPLib.utility.freezeProperty(testobject1,'id');
    let objectdescriptor1 = Object.getOwnPropertyDescriptor(testobject1,'id');
    boolarray1 = [!objectdescriptor1.writable, !objectdescriptor1.configurable];
    console.log(`Object ${repr(testobject1)} should have the 'id' attribute be frozen ${bracket(repr(boolarray1))}`,RecordResult(boolarray1.every(val => val)));

    console.log("Checking freezeProperties");
    testobject1 = {id: 2, type: {a: 3, b:4}};
    JSPLib.utility.freezeProperties(testobject1,['id','type']);
    objectdescriptor1 = Object.getOwnPropertyDescriptor(testobject1,'id');
    let objectdescriptor2 = Object.getOwnPropertyDescriptor(testobject1,'type');
    boolarray1 = [!objectdescriptor1.writable, !objectdescriptor1.configurable, !objectdescriptor2.writable, !objectdescriptor2.configurable];
    console.log(`Object ${repr(testobject1)} should have the 'id' and 'type' attributes be frozen ${bracket(repr(boolarray1))}`,RecordResult(boolarray1.every(val => val)));

    console.log("Checking getObjectAttributes");
    array1 = [1,2,3];
    testobjectarray1 = [{id: 1, type: 'a'},{id: 2, type: 'b'}, {id: 3, type: 'b'}];
    resultarray1 = JSPLib.utility.getObjectAttributes(testobjectarray1,'id');
    console.log(`Object array ${repr(testobjectarray1)} with getting the id attributes should be equal to ${repr(array1)} ${bracket(repr(resultarray1))}`,RecordResult(ArrayEqual(resultarray1,array1)));

    console.log("Checking getNestedObjectAttributes");
    array1 = [1,3];
    testobjectarray1 = [{id: 1, type: {a: 1, b:2}}, {id: 2, type: {a: 3, b:4}}];
    resultarray1 = JSPLib.utility.getNestedObjectAttributes(testobjectarray1,['type','a']);
    console.log(`Object array ${repr(testobjectarray1)} with getting the id attributes should be equal to ${repr(array1)} ${bracket(repr(resultarray1))}`,RecordResult(ArrayEqual(resultarray1,array1)));

    console.log("Checking objectReduce");
    testobject1 = {test1: 1, test2: 2, test3: 3};
    result1 = JSPLib.utility.objectReduce(testobject1,(total,val)=>{return total + val;},0);
    console.log(`Object ${repr(testobject1)} totaling key values should be equal to 6 ${bracket(repr(result1))}`,RecordResult(result1 === 6));

    console.log("Checking dataCopy");
    testobject1 = {'test':0,'value':{'deep':1}};
    let copyobject1 = testobject1;
    let shallowobject1 = Object.assign({},testobject1);
    let [deepobject1] = JSPLib.utility.dataCopy([testobject1]);
    testobject1.test = 10;
    testobject1.value.deep = 11;
    console.log(`Object ${repr(copyobject1)} should have the same values as ${repr(testobject1)}`,RecordResult(copyobject1.test === 10 && copyobject1.value.deep === 11));
    console.log(`Object ${repr(shallowobject1)} should have one value the same as ${repr(testobject1)}`,RecordResult(shallowobject1.test !== 10 && copyobject1.value.deep === 11));
    console.log(`Object ${repr(deepobject1)} should have no values the same as ${repr(testobject1)}`,RecordResult(deepobject1.test !== 10 && deepobject1.value.deep !== 11));

    console.log("Checking joinArgs");
    let object1 = {search: {id: "20,21,5"}};
    let object2 = {search: {order: "customorder"}};
    result1 = JSPLib.utility.joinArgs(object1,object2);
    boolarray1 = [ObjectContains(result1,['search']), ObjectContains(result1.search,['id','order'])];
    boolarray1[0] && boolarray1.push(result1.search.id === "20,21,5");
    boolarray1[1] && boolarray1.push(result1.search.order === "customorder");
    console.log(`joining arguments ${repr(object1)} and ${repr(object2)} should have the 2 search arguments ${repr(result1)} ${bracket(repr(boolarray1))}`,RecordResult(boolarray1.every(val => val)));

    console.log("Checking recurseCompareObjects");
    testobject1 = {'test':0,'value':{'deep':1}};
    copyobject1 = {'test':0,'value':{'deep':2}};
    let resultobject1 = JSPLib.utility.recurseCompareObjects(testobject1,copyobject1);
    console.log(`Object ${repr(testobject1)} compared against ${repr(copyobject1)} should find the changed value ${repr(resultobject1)}`,RecordResult(resultobject1.value.deep[0] === 1 && resultobject1.value.deep[1] === 2));

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
    let $domtest = jQuery.parseHTML(domdata_test)[0];
    array1 = JSPLib.utility.DOMtoArray($domtest.attributes);
    array2 = array1.map((entry)=>{return entry.value;});
    array3 = ['test1','2'];
    console.log(`Object returned should be an array`,RecordResult(Array.isArray(array1)));
    console.log(`Data values for object should be ${repr(array3)} ${bracket(repr(array2))}`,RecordResult(JSON.stringify(array2) === JSON.stringify(array3)));

    console.log("Checking DOMtoHash");
    let hash1 = JSPLib.utility.DOMtoHash($domtest.dataset);
    array2 = Object.keys(hash1).map((entry)=>{return hash1[entry];});
    console.log(`Object returned should be a hash`,RecordResult(hash1.constructor === Object));
    console.log(`Data values for object should be ${repr(array3)} ${bracket(repr(array2))}`,RecordResult(JSON.stringify(array2) === JSON.stringify(array3)));

    console.log("Checking getDOMAttributes");
    let $domarray = jQuery.parseHTML(domdata_test)
    checkarray1 = ["test1"];
    resultarray1 = JSPLib.utility.getDOMAttributes($domarray,'test1',String);
    console.log(`Object returned should be an array`,RecordResult(Array.isArray(resultarray1)));
    console.log(`Data values for array should be ${repr(checkarray1)} ${bracket(repr(resultarray1))}`,RecordResult(ArrayEqual(checkarray1,resultarray1)));

    console.log("Checking getAllDOMData");
    hash1 = JSPLib.utility.getAllDOMData($domtest);
    let hash2 = {test1: "test1", test2: 2};
    console.log(`Object returned should be a hash`,RecordResult(hash1.constructor === Object));
    console.log(`Data values for object should be ${repr(hash2)} ${bracket(repr(hash1))}`,RecordResult(ObjectContains(hash1,['test1','test2']) && hash1.test1 === hash2.test1 && hash1.test2 === hash2.test2));

    console.log("Checking installScript");
    let script1 = "https://cdn.jsdelivr.net/gh/jquery/jquery-ui@1.12.1/ui/widgets/tabs.js";
    let state1 = typeof jQuery.ui.tabs;
    await JSPLib.utility.installScript(script1);
    await JSPLib.utility.sleep(100);
    let state2 = typeof jQuery.ui.tabs;
    console.log(`Initial state of jQuery tabs should be undefined ${bracket(repr(state1))}`,RecordResult(state1 === "undefined"));
    console.log(`Subsequent state of jQuery tabs should be a function ${bracket(repr(state2))}`,RecordResult(state2 === "function"));

    //Setup for data functions
    let jqueryobj = jQuery("#checklibrary-count");
    jqueryobj.on("mouseenter.checklibraries.test_hover",(e)=>{
        console.log("Hovering over count...");
    });
    testdata1 = {test_data: 'check'};
    jqueryobj.data(testdata1);
    let $domobj = jqueryobj[0];
    jQuery(document).on("checklibraries:log-this",()=>{console.log("Check this out")});
    await JSPLib.utility.sleep(100);

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
    console.log(`Module global cssstyle ${repr(JSPLib.utility._css_sheet)} should have a length of 1`,RecordResult(Object.keys(JSPLib.utility._css_sheet).length === 1));
    await JSPLib.utility.sleep(csstyle_waittime);
    JSPLib.utility.addStyleSheet("","test");

    console.log("Checking isScrolledIntoView");
    result1 = JSPLib.utility.isScrolledIntoView(document.querySelector('footer'));
    console.log(`Page footer should be in view`,RecordResult(result1));

    console.log("Checking setCSSStyle");
    JSPLib.utility.setCSSStyle("body {background: black !important;}","test");
    console.log("Color set to black... changing color in 5 seconds.");
    await JSPLib.utility.sleep(csstyle_waittime);
    JSPLib.utility.setCSSStyle("body {background: purple !important;}","test");
    console.log("Color set to purple... validate that there is only 1 style element.");
    console.log(`Module global cssstyle ${repr(JSPLib.utility._css_style)} should have a length of 1`,RecordResult(Object.keys(JSPLib.utility._css_style).length === 1));
    await JSPLib.utility.sleep(csstyle_waittime);
    JSPLib.utility.setCSSStyle("","test");

    console.log("Checking hasStyle");
    result1 = JSPLib.utility.hasStyle('test');
    console.log(`Test style should be initialized`,RecordResult(result1));

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
    $domtest = jQuery.parseHTML(walkdom_test);
    let child1 = jQuery("#child0a",$domtest)[0];
    result1 = JSPLib.utility.getNthParent(child1,1);
    console.log(`Node ${child1.id} should have parent0 as a parent ${bracket(result1.id)}`,RecordResult(result1 && result1.id === "parent0"));

    console.log("Checking getNthChild");
    let parent1 = jQuery("#parent0",$domtest)[0];
    result1 = JSPLib.utility.getNthChild(parent1,2);
    result2 = JSPLib.utility.getNthChild(parent1,-2);
    console.log(`Node ${parent1.id} should have child0b as the 2nd child from the start ${bracket(result1.id)}`,RecordResult(result1 && result1.id === "child0b"));
    console.log(`Node ${parent1.id} should have child0a as the 2nd child from the end ${bracket(result2.id)}`,RecordResult(result2 && result2.id === "child0a"));

    console.log("Checking getNthSibling");
    result1 = JSPLib.utility.getNthSibling(child1,1);
    console.log(`Node ${child1.id} should have child0b as its first sibling ${bracket(result1.id)}`,RecordResult(result1 && result1.id === "child0b"));

    console.log("Checking walkDOM");
    result1 = JSPLib.utility.walkDOM(child1,[[0,-1],[1,0],[0,2]])
    console.log(`Node ${child1.id} should have child1b as the second child of its parent's first sibling ${bracket(result1.id)}`,RecordResult(result1 && result1.id === "child1b"));

    console.log("Checking getImageDimensions");
    let dimensions1 = {width: 459, height: 650};
    let dimensions2 = await JSPLib.utility.getImageDimensions("https://raikou1.donmai.us/d3/4e/d34e4cf0a437a5d65f8e82b7bcd02606.jpg");
    console.log(`Dimensions should have width of 459 and height of 650 ${bracket(dimensions2)}`,RecordResult(Boolean(typeof dimensions2 === "object" && dimensions2.width === 459 && dimensions2.height === 650)));

    console.log("Checking getPreviewDimensions");
    let base_dimensions = 150;
    dimensions2 = JSPLib.utility.getPreviewDimensions(dimensions1.width, dimensions1.height, base_dimensions);
    console.log(`Dimensions should have width of 106 and height of 150 ${bracket(dimensions2)}`,RecordResult(Boolean(Array.isArray(dimensions2) && dimensions2[0] === 106 && dimensions2[1] === 150)));

    console.log("Checking recheckTimer");
    let checkvalue1 = false;
    let checkvalue2 = false;
    let checkvalue3 = false;
    let iterator1 = 0;
    let iterator2 = 0;
    let timer1 = JSPLib.utility.recheckTimer({
        check: ()=>{
            console.log("[Non-expiring] Checking value", ++iterator1, "times.");
            return checkvalue1;
        },
        exec: ()=>{checkvalue2 = true;}
    }, 100);
    let timer2 = JSPLib.utility.recheckTimer({
        check: ()=>{
            console.log("[Expiring] Checking value", ++iterator2, "times.");
            return checkvalue1;
        },
        exec: ()=>{checkvalue3 = true;}
    }, 100, 100);
    await JSPLib.utility.sleep(JSPLib.utility.one_second);
    checkvalue1 = true;
    await JSPLib.utility.sleep(JSPLib.utility.one_second);
    console.log(`Non-expiring timer should have been successful ${bracket(repr(timer1))}`,RecordResult(timer1.timer === true));
    console.log(`Non-expiring timer should have changed value to true ${bracket(checkvalue2)}`,RecordResult(checkvalue2 === true));
    console.log(`Expiring timer should have not been successful ${bracket(repr(timer2))}`,RecordResult(timer2.timer === false));
    console.log(`Expiring timer should have changed value to true ${bracket(checkvalue3)}`,RecordResult(checkvalue3 === false));

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

    console.log("Checking getDomainName");
    string1 = "http://danbooru.donmai.us";
    string2 = "donmai.us";
    let string3 = JSPLib.utility.getDomainName(string1, 2);
    console.log(`URL of ${string1} should have a base domain of ${string2} ${bracket(string3)}`,RecordResult(string2 === string3));

    console.log("Checking parseParams");
    string1 = "test1=2&test2=3";
    object1 = {test1: "2", test2: "3"};
    result1 = JSPLib.utility.parseParams(string1);
    console.log(`Value ${repr(string1)} should should be changed to ${repr(object1)} ${bracket(repr(result1))}`,RecordResult(JSON.stringify(object1) === JSON.stringify(result1)));

    console.log("Checking HTMLEscape");
    string1 = '& < > "';
    string2 = "&amp; &lt; &gt; &quot;";
    result1 = JSPLib.utility.HTMLEscape(string1);
    console.log(`Value ${repr(string1)} should should be changed to ${repr(string2)} ${bracket(repr(result1))}`,RecordResult(string2 === result1));

    console.log("Checking setupMutationObserver");
    jQuery("#checklibrary-count").after('<span id="checklibrary-observe"></span>');
    string1 = 'nothing';
    string2 = 'something';
    value1 = string1;
    JSPLib.utility.setupMutationRemoveObserver("footer","#checklibrary-observe",()=>{console.log("Observation found!");value1 = string2;});
    jQuery("#checklibrary-observe").replaceWith('<span id="checklibrary-observe" style="font-size:200%">(Observed)</span>');
    await JSPLib.utility.sleep(1000);
    console.log(`Value ${repr(value1)} should be equal to ${repr(string2)}`,RecordResult(value1 === string2));

    console.log(`CheckUtilityLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

function CheckStatisticsLibrary() {
    console.log("++++++++++++++++++++CheckStatisticsLibrary++++++++++++++++++++");
    console.log("Start time:", JSPLib.utility.getProgramTime());
    ResetResult();

    console.log("Checking average");
    let data1 = [0,1,2,3,4,20];
    let data2 = [];
    let expected_result1 = 5;
    let result1 = JSPLib.statistics.average(data1);
    let result2 = JSPLib.statistics.average(data2);
    console.log(`Values of ${repr(data1)} should have an average of ${expected_result1} ${bracket(result1)}`,RecordResult(result1 === expected_result1));
    console.log(`An empty array should have an average of NaN ${bracket(result2)}`,RecordResult(Number.isNaN(result2)));

    console.log("Checking standardDeviation");
    expected_result1 = 6.83;
    result1 = RoundToHundredth(JSPLib.statistics.standardDeviation(data1));
    console.log(`Values of ${repr(data1)} should have a standard deviation of ${expected_result1}`,RecordResult(result1 === expected_result1));

    console.log("Checking removeOutliers");
    result1 = JSPLib.statistics.removeOutliers(data1);
    console.log(`Values of ${repr(data1)} should have had 1 outlier removed`,RecordResult((data1.length - result1.length) === 1));

    console.log("Checking outputAdjustedMean()");
    console.log(JSPLib.debug._records);
    JSPLib.debug._records = {};
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
    console.log("Start time:", JSPLib.utility.getProgramTime());
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

    console.log("Checking validateArrayValues");
    testdata1 = [-1,-2,3,4];
    testdata2 = [1,2,3,4];
    let testdata3 = ["one","two","three","four"];
    result1 = JSPLib.validate.validateArrayValues('test',testdata1,JSPLib.validate.basic_integer_validator);
    result2 = JSPLib.validate.validateArrayValues('test',testdata2,JSPLib.validate.basic_ID_validator);
    result2 = JSPLib.validate.validateArrayValues('test',testdata3,JSPLib.validate.basic_stringonly_validator);
    console.log(`Object ${repr(testdata1)} should be all integers`,RecordResult(result1));
    console.log(`Object ${repr(testdata2)} should be all IDs`,RecordResult(result2));
    console.log(`Object ${repr(testdata3)} should be all strings`,RecordResult(result2));

    console.log("Checking correctArrayValues");
    testdata1 = [-1,-2,3,4];
    testdata2 = ["one","two","three","four"];
    result1 = JSPLib.validate.correctArrayValues('test',testdata1,JSPLib.validate.basic_ID_validator);
    result2 = JSPLib.validate.correctArrayValues('test',testdata2,JSPLib.validate.basic_stringonly_validator);
    JSPLib.utility.concat(result1,result2).forEach((message)=>{console.log(message);});
    console.log(`Object ${repr(testdata1)} should have two corrections`,RecordResult(result1.length === 2));
    console.log(`Object ${repr(testdata2)} should have no corrections`,RecordResult(result2.length === 0));

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
    console.log("Start time:", JSPLib.utility.getProgramTime());
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

    console.log("Checking checkStorageData");
    let validator1 = function (key,cached) { return true;};
    let validator2 = function (key,cached) { return false;};
    result1 = JSPLib.storage.checkStorageData('good-value',validator1,sessionStorage);
    result2 = JSPLib.storage.checkStorageData('good-value',validator2,sessionStorage);
    console.log(`good-value with data ${repr(data2)} with good validate should return value ${bracket(repr(result1))}]`,RecordResult(result1 && result1[0] === "check this"));
    console.log(`good-value with data ${repr(data2)} with bad validate should return null ${bracket(repr(result2))}]`,RecordResult(result2 === null));

    console.log("Checking pruneStorageData");
    JSPLib.debug.level = JSPLib.debug.WARNING;
    let testvalue = "test".repeat(1000);
    JSPLib.storage.setStorageData('testremove',{expires: 1, value: testvalue},sessionStorage);
    JSPLib.storage.setStorageData('teststay',{expires: 0, value: testvalue},sessionStorage);
    JSPLib.storage.pruneStorageData(sessionStorage);
    result1 = JSPLib.storage.getStorageData('testremove',sessionStorage);
    result2 = JSPLib.storage.getStorageData('teststay',sessionStorage);
    console.log(`testremove should be pruned and return null with getStorageData ${bracket(repr(result1))}`,RecordResult(result1 === null));
    console.log(`teststay shouldn't be pruned and return value with getStorageData ${bracket(repr(result2))}`,RecordResult(result2 && result2.value && result2.value === testvalue));

    console.log("Checking storage quota exceeded");
    let testsize1 = JSON.stringify(sessionStorage).length;
    for (let i = 0; i < 2000; i++) {
        JSPLib.storage.setStorageData('test'+i,{expires: 1, value: testvalue},sessionStorage);
        testsize1 += testvalue.length;
    }
    let testsize2 = JSON.stringify(sessionStorage).length;
    console.log(`expected size of storage ${bracket(testsize1)}} should be greater than actual size ${bracket(testsize2)}`,RecordResult(testsize1 > testsize2));
    JSPLib.debug.level = JSPLib.debug.VERBOSE;

    console.log("Checking hasDataExpired");
    let max_expiration1 = 10000;
    let data3 = {expires: Date.now() - max_expiration1, value: data2};
    let data4 = {expires: Date.now() + max_expiration1, value: data2};
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
        result1 = await JSPLib.storage.checkLocalDB('expired-value',validator1,max_expiration1);
        result2 = await JSPLib.storage.checkLocalDB('good-value',validator2,max_expiration1);
        result3 = await JSPLib.storage.checkLocalDB('good-value',validator1,max_expiration1);
        result4 = await JSPLib.storage.checkLocalDB('persistent-value',validator1,max_expiration1);
        console.log(`expired-value with data ${repr(data3)} should return null ${bracket(repr(result1))}`,RecordResult(result1 === null));
        console.log(`good-value with data ${repr(data4)} with false validation should return null ${bracket(repr(result2))}`,RecordResult(result2 === null));
        console.log(`good-value with data ${repr(data4)} with true validation should return value ${bracket(repr(result3))}`,RecordResult(result3 && result3.value && result3.value[0] === "check this"));
        console.log(`persistent-value with data ${repr(data5)} should return value ${bracket(repr(result4))}`,RecordResult(result4 && result4.expires === 0 && result4.value && result4.value[0] === "check this"));

        console.log("Checking batchStorageCheck");
        let keyarray1 = ['expired-value','good-value','persistent-value'];
        let expected1 = ['expired-value'];
        let expected2 = ['good-value','persistent-value'];
        let [found1,missing1] = await JSPLib.storage.batchStorageCheck(keyarray1,validator1,max_expiration1);
        console.log(`Batch check of ${repr(keyarray1)} should return ${repr(expected1)} in missing array ${bracket(repr(missing1))}`,RecordResult(ArrayEqual(missing1,expected1)));
        console.log(`Batch check of ${repr(keyarray1)} should return ${repr(expected2)} in found array ${bracket(repr(expected2))}`,RecordResult(ArrayEqual(found1,expected2)));

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
        await JSPLib.storage.purgeCache(/^(good|expired|persistent)-value$/,"#checklibrary-count");
        result1 = await JSPLib.storage.retrieveData('expired-value');
        result2 = await JSPLib.storage.retrieveData('good-value');
        result3 = await JSPLib.storage.retrieveData('persistent-value');
        console.log(`expired-value should be pruned and return null with retrieveData ${bracket(repr(result1))}`,RecordResult(result1 === null));
        console.log(`good-value should be pruned and return null with retrieveData ${bracket(repr(result2))}`,RecordResult(result2 === null));
        console.log(`persistent-value should be pruned and return null with retrieveData ${bracket(repr(result3))}`,RecordResult(result3 === null));

        console.log("Checking programCacheInfo");
        await JSPLib.storage.saveData('expired-value',data3);
        await JSPLib.storage.saveData('good-value',data4);
        result1 = await JSPLib.storage.programCacheInfo('cl',/^(good|expired)-value$/);
        result2 = Object.keys(result1);
        console.log(`Cache info should have 3 storage keys ${bracket(result2)}`,RecordResult(result2.length === 3 && JSPLib.utility.setSymmetricDifference(result2,['index','session','local']).length === 0));
        console.log(`Cache info should have 2 Index DB items ${bracket(result1.index.program_items)}`,RecordResult(result1.index.program_items === 2));
        console.log(`Cache info should have 2 session storage items ${bracket(result1.session.program_items)}`,RecordResult(result1.session.program_items === 2));
        console.log(`Cache info should have 1 local storage items ${bracket(result1.local.program_items)}`,RecordResult(result1.local.program_items === 1));
    }

    console.log("Checking nameToKeyTransform");
    data1 = ["test1","test2"];
    data2 = ["cl-test1","cl-test2"];
    result1 = JSPLib.storage.nameToKeyTransform(data1,'cl');
    console.log(`Name list ${repr(data1)} should be transformed to ${repr(data2)} ${bracket(result1)}`,RecordResult(JSON.stringify(result1) === JSON.stringify(data2)));

    console.log("Checking keyToNameTransform");
    result1 = JSPLib.storage.keyToNameTransform(data2,'cl');
    console.log(`Name list ${repr(data2)} should be transformed to ${repr(data1)} ${bracket(result1)}`,RecordResult(JSON.stringify(result1) === JSON.stringify(data1)));

    //Cleanup actions
    sessionStorage.clear();

    console.log(`CheckStorageLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

async function CheckConcurrencyLibrary() {
    console.log("++++++++++++++++++++CheckConcurrencyLibrary++++++++++++++++++++");
    console.log("Start time:", JSPLib.utility.getProgramTime());
    ResetResult();

    console.log("Checking reserveSemaphore");
    let key1 = 'cl-process-semaphore-test';
    let key2 = 'cl.semaphore.test';
    localStorage.removeItem(key1);
    let result1 = JSPLib.concurrency.reserveSemaphore('cl','test');
    let result2 = JSPLib.storage.getStorageData(key1,localStorage);
    let result3 = JSPLib.utility.isNamespaceBound(window,'beforeunload',key2);
    console.log(`Semaphore ${result1} should be equal to saved data ${bracket(result2)}`,RecordResult(result1 === result2));
    console.log(`Before unload event should have been created ${bracket(result3)}`,RecordResult(result3 === true));

    console.log("Checking checkSemaphore");
    result1 = JSPLib.concurrency.checkSemaphore('cl','test');
    console.log(`Semaphore should not be available ${bracket(result1)}`,RecordResult(result1 === false));

    console.log("Checking freeSemaphore");
    JSPLib.concurrency.freeSemaphore('cl','test');
    result1 = JSPLib.concurrency.checkSemaphore('cl','test');
    result2 = JSPLib.utility.isNamespaceBound(window,'beforeunload',key2);
    console.log(`Semaphore should be available ${bracket(result1)}`,RecordResult(result1 === true));
    console.log(`Before unload event should have been cleared ${bracket(result2)}`,RecordResult(result2 === false));

    console.log("Checking checkTimeout");
    let key3 = 'cl-timeout';
    let expiration1 = JSPLib.utility.one_second * 10;
    result1 = JSPLib.concurrency.checkTimeout(key3,expiration1);
    console.log(`Timeout should be not set / expired ${bracket(result1)}`,RecordResult(result1 === true));

    console.log("Checking setRecheckTimeout");
    JSPLib.concurrency.setRecheckTimeout(key3,expiration1);
    result1 = JSPLib.concurrency.checkTimeout(key3,expiration1);
    console.log(`Timeout should be set and unexpired ${bracket(result1)}`,RecordResult(result1 === false));

    //Cleanup actions
    localStorage.removeItem(key1);
    localStorage.removeItem(key3);

    console.log(`CheckConcurrencyLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

async function CheckNetworkLibrary() {
    console.log("++++++++++++++++++++CheckNetworkLibrary++++++++++++++++++++");
    console.log("Start time:", JSPLib.utility.getProgramTime());
    ResetResult();

    if (typeof GM.xmlHttpRequest !== 'undefined') {
        console.log("Checking getImage");
        let url1 = 'https://raikou4.donmai.us/preview/d3/4e/d34e4cf0a437a5d65f8e82b7bcd02606.jpg';
        let size1 = 7130;
        let type1 = "image/jpeg";
        let resp1 = await JSPLib.network.getImage(url1);
        let boolarray1 = [typeof resp1 === "object" && resp1.constructor.name === "Blob"];
        boolarray1[0] && boolarray1.push(resp1.size === size1);
        boolarray1[0] && boolarray1.push(resp1.type === type1);
        console.log(`Image with URL ${url1} should be blob with size ${size1} and type ${type1} ${bracket(repr(boolarray1))}`,resp1,RecordResult(boolarray1.every(val => val)));

        console.log("Checking getImageSize");
        url1 = 'https://raikou4.donmai.us/preview/d3/4e/d34e4cf0a437a5d65f8e82b7bcd02606.jpg';
        size1 = 7130;
        resp1 = await JSPLib.network.getImageSize(url1);
        console.log(`Image with URL ${url1} should get the image size of ${size1} ${bracket(resp1)}`,resp1,RecordResult(resp1 === size1));
    } else {
        console.log("Skipping GM.xmlHttpRequest tests...");
    }

    console.log("Checking installXHRHook");
    let builtinXhrFn = WINDOWVALUE.XMLHttpRequest;
    let url1 = '/users';
    let addons1 = {search:{id:'1'},limit:1,only:'id,name'};
    let found1 = false;
    JSPLib.network.installXHRHook([
        (data)=>{
            if (Array.isArray(data) && data.length === 1 && data[0].id === 1) {
                console.log(`With URL ${url1} and addons ${repr(addons1)}, a single user record of user #1 should have been returned ${bracket(repr(data))}`,RecordResult(data[0].name === "albert"));
                found1 = true;
            }
        }
    ]);
    await jQuery.getJSON(url1,addons1);
    WINDOWVALUE.XMLHttpRequest = builtinXhrFn;
    await JSPLib.utility.sleep(1000);
    if (!found1) {
        console.log("installXHRHook test failed",RecordResult(false));
    }

    console.log("Checking incrementCounter");
    JSPLib.network.counter_domname = "#checklibrary-count";
    await JSPLib.utility.sleep(2000);
    let result1 = JSPLib.danbooru.num_network_requests;
    JSPLib.network.incrementCounter('danbooru');
    let result2 = JSPLib.danbooru.num_network_requests;
    console.log(`The counter should have incremented by 1 from ${repr(result1)} ${bracket(repr(result2))}`,RecordResult((result2 - result1) === 1));

    console.log("Checking decrementCounter");
    await JSPLib.utility.sleep(2000);
    result1 = JSPLib.danbooru.num_network_requests;
    JSPLib.network.decrementCounter('danbooru');
    result2 = JSPLib.danbooru.num_network_requests;
    console.log(`The counter should have decremented by 1 from ${repr(result1)} ${bracket(repr(result2))}`,RecordResult((result1 - result2) === 1));

    console.log("Checking rateLimit"); //Visual confirmation required
    JSPLib.danbooru.num_network_requests = JSPLib.danbooru.max_network_requests;
    RateLimit('danbooru');
    await JSPLib.utility.sleep(5000);
    JSPLib.danbooru.num_network_requests = 0;
    await JSPLib.utility.sleep(2000);

    console.log("Checking processError");
    let error1 = {status: 502};
    let baderror1 = {status: 999, responseText: "Bad error code!"};
    result1 = JSPLib.network.processError(error1,"CheckNetworkLibrary");
    console.log(`The error ${repr(error1)} should be processed to ${repr(error1)} ${bracket(repr(result1))}`,RecordResult(result1.status === baderror1.status && result1.responseText === baderror1.responseText));

    console.log("Checking logError");
    JSPLib.network.error_domname = "#checklibrary-error";
    let num_errors = JSPLib.network.error_messages.length;
    error1 = {status: 403, responseText: 'Bad redirect!'};
    result1 = JSPLib.network.logError(error1,'processError');
    console.log(`Should have one error logged ${bracket(JSPLib.network.error_messages.length)}`,RecordResult((JSPLib.network.error_messages.length - num_errors) === 1));

    console.log("Checking notifyError"); //Visual confirmation required
    error1 = {status: 502, responseText: '<!doctype html>'};
    JSPLib.network.notifyError(error1);
    await JSPLib.utility.sleep(4000);
    jQuery("#close-notice-link").click();
    await JSPLib.utility.sleep(2000);

    console.log("Checking getNotify"); //Visual confirmation required
    url1 = "/bad_url";
    await JSPLib.network.getNotify(url1, {}, "Unable to get bad URL!");
    await JSPLib.utility.sleep(4000);
    jQuery("#close-notice-link").click();
    await JSPLib.utility.sleep(2000);

    console.log(`CheckNetworkLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

async function CheckDanbooruLibrary() {
    console.log("++++++++++++++++++++CheckDanbooruLibrary++++++++++++++++++++");
    console.log("Start time:", JSPLib.utility.getProgramTime());
    ResetResult();

    console.log("Checking getNextPageID");
    let array1 = [{id:25},{id:26},{id:27}];
    let result1 = JSPLib.danbooru.getNextPageID(array1,false);
    let result2 = JSPLib.danbooru.getNextPageID(array1,true);
    console.log(`for item array ${repr(array1)}, the next page ID going in forward should be 25 ${bracket(result1)}`,RecordResult(result1 === 25));
    console.log(`for item array ${repr(array1)}, the next page ID going in reverse should be 27 ${bracket(result2)}`,RecordResult(result2 === 27));

    console.log("Checking getShortName");
    result1 = JSPLib.danbooru.getShortName('copyright');
    result2 = JSPLib.danbooru.getShortName('general');
    let result3 = JSPLib.danbooru.getShortName('artist');
    let result4 = JSPLib.danbooru.getShortName('character');
    console.log(`the short name for copyright should be copy ${bracket(result1)}`,RecordResult(result1 === 'copy'));
    console.log(`the short name for general should be gen ${bracket(result2)}`,RecordResult(result2 === 'gen'));
    console.log(`the short name for artist should be art ${bracket(result2)}`,RecordResult(result3 === 'art'));
    console.log(`the short name for character should be char ${bracket(result2)}`,RecordResult(result4 === 'char'));

    console.log("Checking randomDummyTag");
    let string1 = JSPLib.danbooru.randomDummyTag();
    let string2 = "notadummytag";
    let regex1 = /^dummytag-[0-9a-z]{8}$/;
    result1 = string1.match(regex1);
    result2 = string2.match(regex1);
    console.log(`the string ${repr(string1)} should be a dummy tag ${bracket(result1)}`,RecordResult(!!result1));
    console.log(`the string ${repr(string2)} should not be a dummy tag ${bracket(result2)}`,RecordResult(!result2));

    console.log("Checking tagOnlyRegExp");
    string1 = "character_(qualifier)";
    string2 = "qualifier";
    regex1 = JSPLib.danbooru.tagOnlyRegExp(string1);
    let regex2 = /^character_\(qualifier\)$/i;
    result1 = string1.match(regex1);
    console.log(`the tag ${repr(string1)} should produce the regex ${String(regex2)} ${bracket(String(regex1))}`,RecordResult(String(regex1) === String(regex2)));
    console.log(`the regex ${String(regex1)} should find one match in the string ${repr(string1)} ${bracket(repr(result1))}`,RecordResult(Array.isArray(result1) && result1.length === 1 && result1[0] === string1));

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
        regex2 = RegExp('(?<=(?:^|\\s))aliased\\:_the_tag(?=(?:$|\\s))','gi');
        let regex3 = JSPLib.danbooru.tagRegExp(string5);
        result1 = string1.match(regex1);
        result2 = string1.replace(regex1,string3);
        result3 = string1.match(regex3);
        result4 = string4.match(regex3);
        console.log(`the tag ${repr(string2)} should produce the regex ${String(regex2)} ${bracket(String(regex1))}`,RecordResult(String(regex1) === String(regex2)));
        console.log(`the regex ${String(regex1)} should find two matches in the string ${repr(string1)} ${bracket(result1)}`,RecordResult(Array.isArray(result1) && result1.length === 2 && result1[0] === string2));
        console.log(`the regex ${String(regex1)} should replace the tag ${repr(string2)} with ${repr(string3)} in the string ${repr(string1)} ${bracket(result2)}`,RecordResult(result2 === "1girl solo alias_tag standing alias_tag character_(qualifier) short_hair"));
        console.log(`the regex ${String(regex3)} should find no matches in the string ${repr(string1)} ${bracket(result3)}`,RecordResult(result3 === null));
        console.log(`the regex ${String(regex3)} should find one match in the string ${repr(string4)} ${bracket(result4)}`,RecordResult(Array.isArray(result4) && result4.length === 1 && result4[0] === string5));
    }

    console.log("Checking postSearchLink");
    string1 = "1girl solo";
    string2 = "Check this link";
    let option1 = `class="search-tag"`;
    let string3 = '<a class="search-tag" href="/posts?tags=1girl+solo">Check this link</a>';
    result1 = JSPLib.danbooru.postSearchLink(string1,string2,option1);
    console.log(`the tag ${repr(string1)} with text ${repr(string2)} should produce the link  ${repr(string3)} ${bracket(result1)}`,RecordResult(result1 === string3));

    console.log("Checking wikiLink");
    string1 = "1girl";
    string2 = "Wiki link";
    option1 = 'class="category-0"';
    string3 = '<a class="category-0" href="/wiki_pages/show_or_new?title=1girl">Wiki link</a>';
    result1 = JSPLib.danbooru.wikiLink(string1,string2,option1);
    console.log(`the tag ${repr(string1)} with text ${repr(string2)} should produce the link  ${repr(string3)} ${bracket(result1)}`,RecordResult(result1 === string3));

    console.log("Checking submitRequest");
    JSPLib.danbooru.error_domname = "#checklibrary-error";
    let type1 = 'posts';
    let type2 = 'doesntexist';
    let addons1 = {limit:1};
    result1 = await JSPLib.danbooru.submitRequest(type1,addons1);
    result2 = await JSPLib.danbooru.submitRequest(type2);
    console.log(`with type ${type1} and addons ${repr(addons1)}, a single post should have been returned ${bracket(result1)}`,RecordResult(Array.isArray(result1) && result1.length === 1));
    console.log(`with nonexistent type ${type2}, null should be returned [${repr(result2)}]`,RecordResult(result2 === null));

    console.log("Checking getAllItems");
    type1 = 'users';
    addons1 = {search: {level: 50}, only: 'id,level'}; //Search for admins
    let page1 = 1; //Except for the first admin
    let limit1 = 1; //One at a time
    let reverse1 = true; //Starting from lowest to highest ID
    result1 = await JSPLib.danbooru.getAllItems(type1, limit1, 2, {addons: addons1, page: page1, reverse: true});
    result2 = JSPLib.utility.getObjectAttributes(result1,'id');
    result3 = result2.sort((a,b) => a-b);
    result4 = JSPLib.utility.getObjectAttributes(result1,'level').reduce((total,entry)=>{return total && entry === 50;},true);
    console.log(`with type ${type1} and addons ${repr(addons1)}, two users should have been returned ${bracket(repr(result1))}`,RecordResult(Array.isArray(result1) && result1.length === 2));
    console.log(`should have also not returned the first user ${bracket(repr(result2))}`,RecordResult(Array.isArray(result2) && !result2.includes(1)));
    console.log(`should have also returned users in reverse order ${repr(result3)} ${bracket(repr(result2))}`,RecordResult(repr(result2) === repr(result3)));
    console.log("should have also returned only admins",RecordResult(result4));

    console.log("Checking getPostsCountdown");
    JSPLib.danbooru.error_domname = "#checklibrary-count";
    string1 = "id:1,2,3,4";
    string2 = 'id'; //Grab only the ID
    result1 = await JSPLib.danbooru.getPostsCountdown(string1, 1, string2, '#checklibrary-count');
    console.log(`with query ${string1} and addons "${string2}", four posts should have been returned ${bracket(repr(result1))}`,RecordResult(Array.isArray(result1) && result1.length === 4));

    console.log("Checking rateLimit #2");
    JSPLib.danbooru.num_network_requests = JSPLib.danbooru.max_network_requests;
    JSPLib.danbooru.submitRequest(type1,addons1).then(()=>{console.log("Finished submitting request!");});
    await JSPLib.utility.sleep(5000);
    JSPLib.danbooru.num_network_requests = 0;
    await JSPLib.utility.sleep(2000);

    console.log(`CheckDanbooruLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

async function CheckSaucenaoLibrary() {
    console.log("++++++++++++++++++++CheckSaucenaoLibrary++++++++++++++++++++");
    console.log("Start time:", JSPLib.utility.getProgramTime());
    ResetResult();

    console.log("Checking getDBIndex");
    let string1 = 'danbooru';
    let number1 = 9;
    let result1 = JSPLib.saucenao.getDBIndex(string1);
    console.log(`Site ${string1} should have a DB index of ${number1} ${bracket(result1)}`,RecordResult(result1 === number1));

    console.log("Checking checkSauce #1");
    let object1 = null;
    let bool1 = false;
    result1 = JSPLib.saucenao.checkSauce(object1);
    console.log(`Response of ${repr(object1)} should return a result of ${bool1} ${bracket(result1)}`,RecordResult(result1 === bool1));
    console.log(`The no sauce flag should have been set ${bracket(JSPLib.saucenao.no_sauce)}`,RecordResult(JSPLib.saucenao.no_sauce === true));
    await JSPLib.utility.sleep(2000);

    console.log("Checking checkSauce #2");
    object1 = {header: {long_remaining: 0}, results: {}};
    bool1 = true;
    result1 = JSPLib.saucenao.checkSauce(object1);
    console.log(`Response of ${repr(object1)} should return a result of ${bool1} ${bracket(result1)}`,RecordResult(result1 === bool1));
    console.log(`The no sauce flag should have been set ${bracket(JSPLib.saucenao.no_sauce)}`,RecordResult(JSPLib.saucenao.no_sauce === true));
    await JSPLib.utility.sleep(2000);

    console.log("Checking checkSauce #3");
    object1 = {header: {long_remaining: 1, short_remaining: 0}, results: {}};
    bool1 = true;
    result1 = JSPLib.saucenao.checkSauce(object1);
    console.log(`Response of ${repr(object1)} should return a result of ${bool1} ${bracket(result1)}`,RecordResult(result1 === bool1));
    console.log(`The no sauce flag should not have been set ${bracket(JSPLib.saucenao.no_sauce)}`,RecordResult(JSPLib.saucenao.no_sauce === false));
    await JSPLib.utility.sleep(2000);

    console.log("Checking checkSauce #4");
    object1 = {header: {long_remaining: 1, short_remaining: 1, status: -1, message: 'Some message.'}};
    bool1 = false;
    result1 = JSPLib.saucenao.checkSauce(object1);
    console.log(`Response of ${repr(object1)} should return a result of ${bool1} ${bracket(result1)}`,RecordResult(result1 === bool1));
    console.log(`The no sauce flag should not have been set ${bracket(JSPLib.saucenao.no_sauce)}`,RecordResult(JSPLib.saucenao.no_sauce === false));
    await JSPLib.utility.sleep(2000);

    console.log("Checking checkSauce #5");
    object1 = {header: {long_remaining: 1, short_remaining: 1}, results: {}};
    bool1 = true;
    result1 = JSPLib.saucenao.checkSauce(object1);
    console.log(`Response of ${repr(object1)} should return a result of ${bool1} ${bracket(result1)}`,RecordResult(result1 === bool1));
    console.log(`The no sauce flag should not have been set ${bracket(JSPLib.saucenao.no_sauce)}`,RecordResult(JSPLib.saucenao.no_sauce === false));
    await JSPLib.utility.sleep(2000);

    console.log("Checking getSauce #1");
    object1 = {header: {long_remaining: 1, short_remaining: 1}, results: {}};
    bool1 = false;
    result1 = await JSPLib.saucenao.getSauce();
    console.log(`No API key should return a result of ${bool1} ${bracket(result1)}`,RecordResult(result1 === bool1));
    await JSPLib.utility.sleep(2000);

    console.log("Checking getSauce #2");
    JSPLib.saucenao.api_key = saucenao_api_key;
    JSPLib.saucenao._sauce_wait = Date.now() + JSPLib.utility.one_second;
    bool1 = false;
    result1 = await JSPLib.saucenao.getSauce();
    console.log(`Wait time remaining should should return a result of ${bool1} ${bracket(result1)}`,RecordResult(result1 === bool1));
    await JSPLib.utility.sleep(2000);

    if (typeof GM.xmlHttpRequest !== 'undefined') {
        //Save old settings
        let old_xhr = jQuery.ajaxSettings.xhr;
        JSPLib.network.jQuerySetup();

        console.log("Checking getSauce #3");
        let url1 = 'https://raikou4.donmai.us/preview/d3/4e/d34e4cf0a437a5d65f8e82b7bcd02606.jpg';
        let num_results = 2;
        let resp1 = await JSPLib.saucenao.getSauce(url1, JSPLib.saucenao.getDBIndex('danbooru'), num_results, true);
        let boolarray1 = [typeof resp1 === "object" && resp1 !== null];
        boolarray1[0] && boolarray1.push('header' in resp1);
        boolarray1[0] && boolarray1.push('results' in resp1);
        console.log(`Image with URL ${url1} should have a header and results ${bracket(repr(boolarray1))}`,resp1,RecordResult(boolarray1.every(val => val)));
        if (boolarray1.every(val => val)) {
            let bool1 = ArrayEqual(Object.keys(resp1.header.index),['9']);
            console.log(`There should be two results ${bracket(resp1.header.results_returned)}`,RecordResult(resp1.header.results_returned === num_results));
            console.log(`All results should be from Danbooru ${bracket(bool1)}`,RecordResult(bool1));
        }

        //Restore old settings
        jQuery.ajaxSetup({
            xhr: old_xhr
        });
    } else {
        console.log("Skipping getSauce tests...");
    }

    console.log(`CheckSaucenaoLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

async function CheckLoadLibrary() {
    console.log("++++++++++++++++++++CheckLoadLibrary++++++++++++++++++++");
    console.log("Start time:", JSPLib.utility.getProgramTime());
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
    jQuery("body").append(`<div id="id-does-exist">`);
    jQuery("body").append(`<div class="class-does-exist">`);

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
    jQuery("footer").prepend('<span id="checklibrary-error" style="font-size:400%">0</span>&emsp;<span id="checklibrary-count" style="font-size:400%">0</span>');
    await CheckDebugLibrary();
    await CheckUtilityLibrary();
    CheckStatisticsLibrary();
    CheckValidateLibrary();
    await CheckStorageLibrary();
    CheckConcurrencyLibrary();
    await CheckNetworkLibrary();
    await CheckDanbooruLibrary();
    await CheckSaucenaoLibrary();
    await CheckLoadLibrary();
    console.log(`All library results: ${overall_test_successes} succeses, ${overall_test_failures} failures`);
}

/****PROGRAM START****/

JSPLib.load.programInitialize(checklibrary,'CL',[WINDOWNAME + '.jQuery',WINDOWNAME + '.Danbooru'],["footer"]);

WINDOWVALUE.JSPLib = WINDOWVALUE.JSPLib || {};
WINDOWVALUE.JSPLib.lib = JSPLib;
