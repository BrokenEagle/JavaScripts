// ==UserScript==
// @name         CheckLibraries
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      2.2
// @source       https://danbooru.donmai.us/users/23799
// @description  Runs tests on all of the libraries
// @author       BrokenEagle
// @match        http://*/*
// @grant        none
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/library-version2/test/checklibraries.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.5.2/localforage.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.12.0/validate.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/library-version2/lib/load.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/library-version2/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/library-version2/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/library-version2/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/library-version2/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/library-version2/lib/debug.js
// ==/UserScript==

/****SETUP****/

JSPLib.debug.debug_console = true;

/****GLOBAL VARIABLES****/

//Time to wait before switching the page style
const csstyle_waittime = 10000;

//Needs to be configured specific to each system
const test_local_storage = false;
const test_indexed_db = true;
const test_storage = true;

//Result variables
var test_successes = 0;
var test_failures = 0;
var overall_test_successes = 0;
var overall_test_failures = 0;

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

function RoundToHundredth(number) {
    return Math.round(100 * number) / 100;
}

function GetValidationLength(results) {
    return (results === undefined ? 0 : Object.keys(results).length);
}

function ShowEnabled(bool) {
    return (bool ? "enabled" : "disabled");
}

//Program helper functions

async function LoadWait() {
    let numwaits = 0;
    do {
        JSPLib.debug.debuglog("Sleeping 1000ms");
        await JSPLib.utility.sleep(1000);
        numwaits += 1;
        if (numwaits >= 10) {
            JSPLib.debug.debuglog("Abandoning program test!");
            return false;
        }
    } while (typeof JSPLib.load.programLoad.timer !== 'boolean');
    return true;
}

//Main functions

async function ChecDebugLibrary() {
    ResetResult();

    console.log("Checking debuglog(): check this out");
    JSPLib.debug.debuglog("check this out");
    JSPLib.debug.debug_console = false;
    JSPLib.debug.debuglog("check this out");

    console.log("Checking debug timer");
    JSPLib.debug.debugTime("check");
    JSPLib.debug.debugTimeEnd("check");
    JSPLib.debug.debug_console = true;
    JSPLib.debug.debugTime("check");
    JSPLib.debug.debugTimeEnd("check");

    console.log("Checking record timer");
    JSPLib.debug.recordTime('test1','test');
    JSPLib.debug.recordTimeEnd('test1','test');
    JSPLib.debug.debug_console = false;
    JSPLib.debug.recordTime('test2','test');
    JSPLib.debug.recordTimeEnd('test2','test');
    console.log(`Should have recorded only 1 value`,RecordResult(Object.keys(JSPLib.debug.records).length === 1));

    JSPLib.debug.debug_console = true;
    console.log(`ChecDebugLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

async function CheckUtilityLibrary() {
    ResetResult();

    JSPLib.debug.debuglog("Checking sleep(): 1000ms");
    JSPLib.debug.debugTime("sleep()");
    await JSPLib.utility.sleep(1000);
    JSPLib.debug.debugTimeEnd("sleep()");

    JSPLib.debug.debuglog("Checking filterNull");
    let testarray1 = ["test","first","nonnull"];
    let testarray2 = ["test","first","null",""];
    let resultarray1 = JSPLib.utility.filterNull(testarray1);
    let resultarray2 = JSPLib.utility.filterNull(testarray2);
    JSPLib.debug.debuglog(`Array ${repr(testarray1)} should be equal in length to ${repr(resultarray1)}`,RecordResult(testarray1.length === resultarray1.length));
    JSPLib.debug.debuglog(`Array ${repr(testarray2)} should not be equal in length to ${repr(resultarray2)}`,RecordResult(testarray2.length !== resultarray2.length));

    JSPLib.debug.debuglog("Checking filterRegex");
    let regex1 = /^(?:other|null)/;
    resultarray1 = JSPLib.utility.regexFilter(testarray1,regex1);
    resultarray2 = JSPLib.utility.regexFilter(testarray2,regex1);
    JSPLib.debug.debuglog(`Array ${repr(resultarray1)} should have a length of zero`,RecordResult(resultarray1.length === 0));
    JSPLib.debug.debuglog(`Array ${repr(resultarray2)} should have a length of one`,RecordResult(resultarray2.length === 1));

    JSPLib.debug.debuglog("Checking setDifference");
    resultarray1 = JSPLib.utility.setDifference(testarray1,testarray2);
    resultarray2 = JSPLib.utility.setDifference(testarray2,testarray1);
    JSPLib.debug.debuglog(`Array ${repr(resultarray1)} should have a length of one`,RecordResult(resultarray1.length === 1));
    JSPLib.debug.debuglog(`Array ${repr(resultarray2)} should have a length of two`,RecordResult(resultarray2.length === 2));

    JSPLib.debug.debuglog("Checking setIntersection");
    resultarray1 = JSPLib.utility.setIntersection(testarray1,testarray2);
    JSPLib.debug.debuglog(`Array [${resultarray1}] should have a length of two`,RecordResult(resultarray1.length === 2));

    JSPLib.debug.debuglog("Checking setIntersection");
    let testobject1 = {'test':0,'value':{'deep':1}};
    let copyobject1 = testobject1;
    let shallowobject1 = Object.assign({},testobject1);
    let [deepobject1] = JSPLib.utility.dataCopy([testobject1]);
    testobject1.test = 10;
    testobject1.value.deep = 11;
    JSPLib.debug.debuglog(`Object ${repr(copyobject1)} should have the same values as ${repr(testobject1)}`,RecordResult(copyobject1.test === 10 && copyobject1.value.deep === 11));
    JSPLib.debug.debuglog(`Object ${repr(shallowobject1)} should have one value the same as ${repr(testobject1)}`,RecordResult(shallowobject1.test !== 10 && copyobject1.value.deep === 11));
    JSPLib.debug.debuglog(`Object ${repr(deepobject1)} should have no values the same as ${repr(testobject1)}`,RecordResult(deepobject1.test !== 10 && deepobject1.value.deep !== 11));

    JSPLib.debug.debuglog("Checking setCSSStyle");
    JSPLib.utility.setCSSStyle("body {background: black;}","test");
    JSPLib.debug.debuglog("Color set to black... changing color in 10 seconds.");
    await JSPLib.utility.sleep(csstyle_waittime);
    JSPLib.utility.setCSSStyle("body {background: purple;}","test");
    JSPLib.debug.debuglog("Color set to purple... validate that there is only 1 style element.");
    JSPLib.debug.debuglog(`Module global cssstyle ${repr(JSPLib.utility.cssstyle)} should have a length of 1`,RecordResult(Object.keys(JSPLib.utility.cssstyle).length === 1));

    JSPLib.debug.debuglog(`CheckUtilityLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

function CheckStatisticsLibrary() {
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
    JSPLib.debug.recordTime('statistics','test');
    JSPLib.debug.recordTimeEnd('statistics','test');
    JSPLib.statistics.outputAdjustedMean();
    JSPLib.statistics.debug_console = true;
    JSPLib.statistics.outputAdjustedMean();

    console.log(`CheckStatisticsLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

function CheckValidateLibrary() {
    ResetResult();

    JSPLib.debug.debuglog("Checking postcount_constraints");
    let testdata1 = {value: "1"};
    let testdata2 = {value: 1};
    let result1 = validate(testdata1,{value: JSPLib.validate.postcount_constraints});
    let result2 = validate(testdata2,{value: JSPLib.validate.postcount_constraints});
    JSPLib.debug.debuglog(`Object ${repr(testdata1)} should have 1 validation error`,RecordResult(GetValidationLength(result1) === 1));
    JSPLib.debug.debuglog(`Object ${repr(testdata2)} should have 0 validation errors`,RecordResult(GetValidationLength(result2) === 0));

    JSPLib.debug.debuglog("Checking expires_constraints");
    testdata1 = {value: 0};
    testdata2 = {value: "1"};
    result1 = validate(testdata1,{value: JSPLib.validate.expires_constraints});
    result2 = validate(testdata2,{value: JSPLib.validate.expires_constraints});
    JSPLib.debug.debuglog(`Object ${repr(testdata1)} should have 1 validation error`,RecordResult(GetValidationLength(result1) === 1));
    JSPLib.debug.debuglog(`Object ${repr(testdata2)} should have 0 validation errors`,RecordResult(GetValidationLength(result2) === 0));

    JSPLib.debug.debuglog("Checking stringonly_constraints");
    testdata1 = {value: null};
    testdata2 = {value: "test"};
    result1 = validate(testdata1,{value: JSPLib.validate.stringonly_constraints});
    result2 = validate(testdata2,{value: JSPLib.validate.stringonly_constraints});
    JSPLib.debug.debuglog(`Object ${repr(testdata1)} should have 1 validation error`,RecordResult(GetValidationLength(result1) === 1));
    JSPLib.debug.debuglog(`Object ${repr(testdata2)} should have 0 validation errors`,RecordResult(GetValidationLength(result2) === 0));

    JSPLib.debug.debuglog("Checking tagentryarray_constraints");
    testdata1 = {value: ["tag",0]};
    testdata2 = {value: [["tag",0]]};
    result1 = validate(testdata1,{value: JSPLib.validate.tagentryarray_constraints});
    result2 = validate(testdata2,{value: JSPLib.validate.tagentryarray_constraints});
    JSPLib.debug.debuglog(`Object ${repr(testdata1)} should have 1 validation error`,RecordResult(GetValidationLength(result1) === 1));
    JSPLib.debug.debuglog(`Object ${repr(testdata2)} should have 0 validation errors`,RecordResult(GetValidationLength(result2) === 0));

    JSPLib.debug.debuglog("Checking inclusion_constraints");
    testdata1 = {value: null};
    testdata2 = {value: "dog"};
    let inclusion1 = ["dog","cat"];
    result1 = validate(testdata1,{value: JSPLib.validate.inclusion_constraints(inclusion1)});
    result2 = validate(testdata2,{value: JSPLib.validate.inclusion_constraints(inclusion1)});
    JSPLib.debug.debuglog(`Object ${repr(testdata1)} with inclusion ${repr(inclusion1)} should have 1 validation error`,RecordResult(GetValidationLength(result1) === 1));
    JSPLib.debug.debuglog(`Object ${repr(testdata2)} with inclusion ${repr(inclusion1)} should have 0 validation errors`,RecordResult(GetValidationLength(result2) === 0));

    JSPLib.debug.debuglog("Checking array validator");
    testdata1 = {value: [0,1,2]};
    testdata2 = {value: [0,1,2,3]};
    let validator1 = {value: {array: {length: 4}}};
    result1 = validate(testdata1,validator1);
    result2 = validate(testdata2,validator1);
    JSPLib.debug.debuglog(`Object ${repr(testdata1)} with validator ${repr(validator1)} should have 1 validation error`,RecordResult(GetValidationLength(result1) === 1));
    JSPLib.debug.debuglog(`Object ${repr(testdata2)} with validator ${repr(validator1)} should have 0 validation errors`,RecordResult(GetValidationLength(result2) === 0));

    JSPLib.debug.debuglog("Checking array validator");
    testdata1 = {value: undefined};
    testdata2 = {value: null};
    validator1 = {value: {string: {allowNull: true}}};
    result1 = validate(testdata1,validator1);
    result2 = validate(testdata2,validator1);
    JSPLib.debug.debuglog(`Object ${repr(testdata1)} with validator ${repr(validator1)} should have 1 validation error`,RecordResult(GetValidationLength(result1) === 1));
    JSPLib.debug.debuglog(`Object ${repr(testdata2)} with validator ${repr(validator1)} should have 0 validation errors`,RecordResult(GetValidationLength(result2) === 0));

    JSPLib.debug.debuglog(`CheckValidateLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

async function CheckStorageLibrary() {
    ResetResult();

    JSPLib.debug.debuglog("Checking global variables");
    JSPLib.debug.debuglog(`use_local_storage should be ${ShowEnabled(test_local_storage)}`,RecordResult(JSPLib.storage.use_local_storage == test_local_storage));
    JSPLib.debug.debuglog(`use_indexed_db should be ${ShowEnabled(test_indexed_db)}`,RecordResult(JSPLib.storage.use_indexed_db == test_indexed_db));
    JSPLib.debug.debuglog(`use_storage should be ${ShowEnabled(test_storage)}`,RecordResult(JSPLib.storage.use_storage == test_storage));

    JSPLib.debug.debuglog("Checking getSessionData");
    let data1 = `[check this]`;
    let data2 = ["check this"];
    sessionStorage.setItem('bad-value',data1);
    await JSPLib.storage.saveData('good-value',data2);
    let result1 = JSPLib.storage.getSessionData('bad-value');
    let result2 = JSPLib.storage.getSessionData('good-value');
    JSPLib.debug.debuglog(`bad-value with data ${repr(data1)} should return undefined`,RecordResult(result1 === undefined));
    JSPLib.debug.debuglog(`good-value with data ${repr(data2)} should return value`,RecordResult(result2 && result2[0] === "check this"));

    JSPLib.debug.debuglog("Checking retrieveData");
    sessionStorage.removeItem('bad-value');
    await JSPLib.storage.danboorustorage.removeItem('bad-value');
    result1 = await JSPLib.storage.retrieveData('bad-value');
    result2 = await JSPLib.storage.retrieveData('good-value');
    sessionStorage.removeItem('good-value');
    let result3 = await JSPLib.storage.retrieveData('good-value');
    JSPLib.debug.debuglog(`bad-value with no entry should return null`,RecordResult(result1 === null));
    JSPLib.debug.debuglog(`good-value with data ${repr(data1)} should return value (sessionStorage)`,RecordResult(result2 && result2[0] === "check this"));
    JSPLib.debug.debuglog(`good-value with data ${repr(data1)} should return value (indexedDB)`,RecordResult(result3 && result3[0] === "check this"));

    JSPLib.debug.debuglog("Checking hasDataExpired");
    let data3 = {expires: Date.now() - 10000, value: data2};
    let data4 = {expires: Date.now() + 10000, value: data2};
    result1 = JSPLib.storage.hasDataExpired(data3);
    result2 = JSPLib.storage.hasDataExpired(data4);
    JSPLib.debug.debuglog(`data with expires ${repr(data3)} should have expired`,RecordResult(result1 === true));
    JSPLib.debug.debuglog(`data with expires ${repr(data4)} should have expired`,RecordResult(result2 === false));

    JSPLib.debug.debuglog("Checking checkLocalDB");
    await JSPLib.storage.saveData('expired-value',data3);
    await JSPLib.storage.saveData('good-value',data4);
    let validator1 = function (key,cached) { return true;};
    let validator2 = function (key,cached) { return false;};
    result1 = await JSPLib.storage.checkLocalDB('expired-value',validator1);
    result2 = await JSPLib.storage.checkLocalDB('good-value',validator2);
    result3 = await JSPLib.storage.checkLocalDB('good-value',validator1);
    JSPLib.debug.debuglog(`expired-value with data ${repr(data3)} should return undefined`,RecordResult(result1 === undefined));
    JSPLib.debug.debuglog(`good-value with data ${repr(data4)} with false validation should return undefined`,RecordResult(result2 === undefined));
    JSPLib.debug.debuglog(`good-value with data ${repr(data4)} with true validation should return value`,RecordResult(result3 && result3.value && result3.value[0] === "check this"));

    JSPLib.debug.debuglog(`CheckStorageLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

async function CheckLoadLibrary() {
    ResetResult();

    JSPLib.debug.debuglog("Checking programInitialize and programLoad");
    let function1 = function() { JSPLib.debug.debuglog("Shouldn't run!");};
    let function2 = function() { JSPLib.debug.debuglog("Should run!");};
    window.goodvariable = true;

    JSPLib.debug.debuglog("Starting bad program load");
    JSPLib.load.programInitialize(function1,'timer1',['window.badvariable'],5);
    let test_success = await LoadWait();
    if (test_success) {
        JSPLib.debug.debuglog(`program load waiting on "window.badvariable" should not have run`,RecordResult(JSPLib.load.programLoad.timer === false));
        JSPLib.debug.debuglog(`program load waiting on "window.badvariable" should have tried 6 times`,RecordResult(JSPLib.load.program_load_retries.timer1 === 5));
    } else {
        RecordResult(test_success);
    }

    JSPLib.debug.debuglog("Starting good program load");
    JSPLib.load.programInitialize(function2,'timer2',['window.goodvariable'],5);
    test_success = await LoadWait();
    if (test_success) {
        JSPLib.debug.debuglog(`program load waiting on "window.goodvariable" should have run`,RecordResult(JSPLib.load.programLoad.timer === true));
        JSPLib.debug.debuglog(`program load waiting on "window.goodvariable" should have tried once`,RecordResult(JSPLib.load.program_load_retries.timer2 === 0));
    } else {
        RecordResult(test_success);
    }

    JSPLib.debug.debuglog(`CheckLoadLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

async function checklibrary() {
    ChecDebugLibrary();
    await CheckUtilityLibrary();
    CheckStatisticsLibrary();
    CheckValidateLibrary();
    await CheckStorageLibrary();
    await CheckLoadLibrary();

    JSPLib.debug.debuglog(`All library results: ${overall_test_successes} succeses, ${overall_test_failures} failures`);
}

/****PROGRAM START****/

JSPLib.load.programInitialize(checklibrary,'CL',['window.jQuery','window.Danbooru']);
