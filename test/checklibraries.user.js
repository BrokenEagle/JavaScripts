// ==UserScript==
// @name         CheckLibraries
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      16.0
// @source       https://danbooru.donmai.us/users/23799
// @description  Runs tests on all of the libraries
// @author       BrokenEagle
// @match        https://danbooru.donmai.us/static/site_map
// @grant        GM.xmlHttpRequest
// @run-at       document-end
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/test/checklibraries.user.js
// @updateURL    https://raw.githubusercontent.com/BrokenEagle/JavaScripts/master/test/checklibraries.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.5.2/localforage.min.js
// @require      https://cdn.jsdelivr.net/npm/localforage-getitems@1.4.2/dist/localforage-getitems.js
// @require      https://cdn.jsdelivr.net/npm/localforage-setitems@1.4.0/dist/localforage-setitems.js
// @require      https://cdn.jsdelivr.net/npm/localforage-removeitems@1.4.0/dist/localforage-removeitems.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/validate.js/0.12.0/validate.min.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/module.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/notice.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/concurrency.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/saucenao.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/20240821/lib/load.js
// @connect      cdn.donmai.us
// @connect      saucenao.com
// ==/UserScript==

// eslint-disable-next-line no-redeclare
/* global jQuery JSPLib validate unsafeWindow GM */

/****SETUP****/

//Set this key for SauceNAO test
const saucenao_api_key = null;

const PREVIEW_URL = 'https://cdn.donmai.us/180x180/d3/4e/d34e4cf0a437a5d65f8e82b7bcd02606.jpg';

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

//Print helper functions

function TestPrint(message, test, {result = null, no_result = false} = {}) {
    let print_func = (test ? console.log : console.warn);
    let print_result = (no_result ? '' : bracket(result));
    print_func(message, print_result, test);
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

function ArrayEqual(test_array, result_array, check_order=true) {
    if (!ArrayLength(result_array, test_array.length)) {
        return false;
    }
    for (let i = 0; i < test_array.length; i++) {
        let compare = (check_order ? test_array[i] === result_array[i] : result_array.includes(test_array[i]));
        if (!compare) {
            console.log("Array does not contain matching values:", test_array[i], result_array[i]);
            return false;
        }
    }
    return true;
}

function ArrayIncludes(test_array, value, includes) {
    if (!ArrayCheck(test_array)) {
        return false
    }
    if (!test_array.includes(value) == includes) {
        console.log("Object does not contain value:", value);
        return false;
    }
    return true;
}

function ArrayLength(test_array, expected_length) {
    if (!ArrayCheck(test_array)) {
        return false
    }
    if (test_array.length !== expected_length) {
        console.log("Array does not contain the right amount of values:", test_array.length, expected_length);
        return false;
    }
    return true;
}

function ArrayCheck(test_array) {
    if (!Array.isArray(test_array)) {
        console.log("Object is not an array");
        return false;
    }
    return true;
}

function HashContains(hash, includes) {
    if (!HashCheck(hash)) {
        return false;
    }
    if (Object.keys(hash).length !== includes.length) {
        console.log("Hash does not contain the right amount of keys");
        return false;
    }
    for (let i = 0;i < includes.length; i++) {
        if (!(includes[i] in hash)) {
            console.log("Hash does not contain the key:", includes[i]);
            return false;
        }
    }
    return true;
}

function HashCheck(hash) {
    if (typeof hash !== 'object' || hash === null || Array.isArray(hash)) {
        console.log("Object is not a hash");
        return false;
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
    let debug_enabled = JSPLib.debug.debug_console;
    let debug_level = JSPLib.debug.level;

    console.log("Checking debuglog(): check this out");
    JSPLib.debug.pretext = "Check:";
    JSPLib.debug.debuglog("enabled: check this out");
    JSPLib.debug.debuglog(() => ["delaylog: check this out"]);
    JSPLib.debug.debug_console = false;
    JSPLib.debug.debuglog("disabled: check this out");
    JSPLib.debug.pretext = "";

    console.log("Checking debugwarnLevel(): WARNING+");
    JSPLib.debug.debug_console = true;
    JSPLib.debug.pretext = "CheckLibraries:";
    JSPLib.debug.level = JSPLib.debug.WARNING;
    JSPLib.debug.debugwarnLevel("ALL", JSPLib.debug.ALL);
    JSPLib.debug.debugwarnLevel("VERBOSE", JSPLib.debug.VERBOSE);
    JSPLib.debug.debugwarnLevel("DEBUG", JSPLib.debug.DEBUG);
    JSPLib.debug.debugwarnLevel("INFO", JSPLib.debug.INFO);
    JSPLib.debug.debugwarnLevel("WARNING", JSPLib.debug.WARNING);
    JSPLib.debug.debugwarnLevel("ERROR", JSPLib.debug.ERROR);

    console.log("Checking debug timer");
    JSPLib.debug.program_shortcut = "bl";
    JSPLib.debug.debug_console = false;
    JSPLib.debug.debugTime("check");
    JSPLib.debug.debugTimeEnd("check");
    JSPLib.debug.debug_console = true;
    JSPLib.debug.debugTime("check");
    JSPLib.debug.debugTimeEnd("check");
    JSPLib.debug.program_shortcut = "cl";

    console.log("Checking record timer");
    JSPLib.debug.recordTime('test1', 'test');
    JSPLib.debug.recordTimeEnd('test1', 'test');
    JSPLib.debug.debug_console = false;
    JSPLib.debug.recordTime('test2', 'test');
    JSPLib.debug.recordTimeEnd('test2', 'test');
    let result_length1 = Object.keys(JSPLib.debug._records).length;
    TestPrint("Should have recorded only 1 value", RecordResult(result_length1 === 1), {result: result_length1});

    console.log("Checking debugExecute");
    let testvalue1 = 4;
    JSPLib.debug.debugExecute(() => {
        testvalue1 += 1;
    });
    JSPLib.debug.debug_console = true;
    JSPLib.debug.debugExecute(() => {
        testvalue1 += 2;
    });
    TestPrint("Test value should be 6", RecordResult(testvalue1 === 6), {result: testvalue1});

    console.log("Checking debugSyncTimer");
    testvalue1 = 4;
    let testfunc = JSPLib.debug.debugSyncTimer((a, b) => a + b);
    let result1 = testfunc(4, 1);
    TestPrint("Result value should be 5", RecordResult(result1 === 5), {result: result1});

    console.log("Checking debugAsyncTimer");
    testfunc = JSPLib.debug.debugAsyncTimer((a, b) => a + b);
    result1 = testfunc(4, 1);
    let result2 = await result1;
    TestPrint("Result value should be a promise", RecordResult(result1?.constructor?.name === "Promise"), {result: result1});
    TestPrint("Result promise value should be 5", RecordResult(result2 === 5), {result: result2});

    console.log("Checking addFunctionLogs");
    testfunc = function FunctionLogs (a, b) {this.debug('log', "check this out", a, "+", b, "= ?");};
    [testfunc] = JSPLib.debug.addFunctionLogs([testfunc]);
    testfunc('0', '1');

    console.log("Checking addFunctionTimers");
    [testfunc] = JSPLib.debug.addFunctionTimers([
        [testfunc, 0, 1],
    ]);
    testfunc('a', 'b');

    console.log("Testing decorated functions with debug off...");
    JSPLib.debug.debug_console = false;
    testfunc('c', 'd');

    JSPLib.debug.debug_console = debug_enabled;
    JSPLib.debug.level = debug_level;
    console.log(`CheckDebugLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

async function CheckNoticeLibrary() {
    console.log("++++++++++++++++++++CheckNoticeLibrary++++++++++++++++++++");
    console.log("Start time:", JSPLib.utility.getProgramTime());
    ResetResult();
    let debug_enabled = JSPLib.debug.debug_console;
    let debug_level = JSPLib.debug.level;

    console.log("Checking notice");
    JSPLib.notice.notice("check this");
    await JSPLib.utility.sleep(2000);

    console.log("Checking error");
    JSPLib.notice.error("check this");
    await JSPLib.utility.sleep(2000);

    console.log("Checking debugNotice");
    JSPLib.debug.debug_console = false;
    JSPLib.notice.debugNotice("shouldn't see this");
    await JSPLib.utility.sleep(2000);
    JSPLib.debug.debug_console = true;
    JSPLib.notice.debugNotice("should see this");
    await JSPLib.utility.sleep(2000);

    console.log("Checking debugError");
    JSPLib.debug.debug_console = false;
    JSPLib.notice.debugError("shouldn't see this");
    await JSPLib.utility.sleep(2000);
    JSPLib.debug.debug_console = true;
    JSPLib.notice.debugError("should see this");
    await JSPLib.utility.sleep(2000);

    console.log("Checking debugNoticeLevel");
    JSPLib.debug.level = JSPLib.debug.INFO;
    JSPLib.notice.debugNoticeLevel("shouldn't see this level", JSPLib.debug.DEBUG);
    await JSPLib.utility.sleep(2000);
    JSPLib.notice.debugNoticeLevel("should see this level", JSPLib.debug.INFO);
    await JSPLib.utility.sleep(2000);


    console.log("Checking debugErrorLevel");
    JSPLib.debug.level = JSPLib.debug.ERROR;
    JSPLib.notice.debugErrorLevel("shouldn't see this level", JSPLib.debug.WARNING);
    await JSPLib.utility.sleep(2000);
    JSPLib.notice.debugErrorLevel("should see this level", JSPLib.debug.INFO, JSPLib.debug.ERROR);
    await JSPLib.utility.sleep(2000);
    jQuery('#close-notice-link').click();

    console.log("Checking installBanner");
    let result1 = JSPLib.notice.danbooru_installed;
    let result2 = jQuery('#cl-notice').length === 0;
    TestPrint("Boolean flag should be set by invoker", RecordResult(result1), {no_result: true});
    TestPrint("The library banner should not be installed", RecordResult(result2), {no_result: true});
    JSPLib.notice.installBanner('cl');
    JSPLib.notice.danbooru_installed = false;
    result1 = JSPLib.notice.banner_installed;
    result2 = jQuery('#cl-notice').length === 1;
    TestPrint("Boolean flag should be set by function", RecordResult(result1), {no_result: true});
    TestPrint("The program banner should be installed", RecordResult(result2), {no_result: true});

    console.log("Checking notice #2");
    JSPLib.notice.notice("check this #2");
    await JSPLib.utility.sleep(2000);

    console.log("Checking error #2");
    JSPLib.notice.error("check this #2");
    await JSPLib.utility.sleep(2000);

    console.log("Checking debugNotice #2");
    JSPLib.debug.debug_console = false;
    JSPLib.notice.debugNotice("shouldn't see this #2");
    await JSPLib.utility.sleep(2000);
    JSPLib.debug.debug_console = true;
    JSPLib.notice.debugNotice("should see this #2");
    await JSPLib.utility.sleep(2000);

    console.log("Checking debugError #2");
    JSPLib.debug.debug_console = false;
    JSPLib.notice.debugError("shouldn't see this #2");
    await JSPLib.utility.sleep(2000);
    JSPLib.debug.debug_console = true;
    JSPLib.notice.debugError("should see this #2");
    await JSPLib.utility.sleep(2000);

    console.log("Checking debugNoticeLevel #2");
    JSPLib.debug.level = JSPLib.debug.INFO;
    JSPLib.notice.debugNoticeLevel("shouldn't see this level #2", JSPLib.debug.DEBUG);
    await JSPLib.utility.sleep(2000);
    JSPLib.notice.debugNoticeLevel("should see this level #2", JSPLib.debug.INFO);
    await JSPLib.utility.sleep(2000);

    console.log("Checking debugErrorLevel #2");
    JSPLib.debug.level = JSPLib.debug.ERROR;
    JSPLib.notice.debugErrorLevel("shouldn't see this level #2", JSPLib.debug.WARNING);
    await JSPLib.utility.sleep(2000);
    JSPLib.notice.debugErrorLevel("should see this level #2", JSPLib.debug.INFO, JSPLib.debug.ERROR);
    await JSPLib.utility.sleep(2000);
    jQuery('#cl-close-notice-link').click();

    JSPLib.debug.debug_console = debug_enabled;
    JSPLib.debug.level = debug_level;
    console.log(`CheckNoticeLibrary results: ${test_successes} succeses, ${test_failures} failures`);
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
    let testexpire1 = JSPLib.utility.getExpires(100);
    TestPrint(`Value ${testexpire1} should be 100 ms greater than ${Date.now()} within 1-2ms`, RecordResult(Math.abs(testexpire1 - (Date.now() + 100)) <= 2), {no_result: true});

    console.log("Checking validateExpires");
    let testdata1 = Date.now() - 100;
    let testdata2 = Date.now() + 100;
    let result1 = JSPLib.utility.validateExpires(testdata1, 100);
    let result2 = JSPLib.utility.validateExpires(testdata2, 100);
    TestPrint(`Expiration of ${testdata1} should be expired`, RecordResult(result1 === false), {no_result: true});
    TestPrint(`Expiration of ${testdata2} should be unexpired`, RecordResult(result2 === true), {no_result: true});

    console.log("Checking timeAgo");
    let timeval1 = "2007-12-31T04:13:18.602Z";
    let timeval2 = '"2007-09-10T20:31:08.995Z"';
    let timestamp1 = new Date('2000').getTime();
    let timeinvalid1 = 'blah';
    let comparetime1 = new Date('2008').getTime();
    let expectedtime1 = '19.78 hours ago';
    let expectedtime2 = '3.68 months ago';
    let expectedtime3 = '8 years ago';
    let timestring1 = JSPLib.utility.timeAgo(timeval1, {compare_time: comparetime1});
    let timestring2 = JSPLib.utility.timeAgo(timeval2, {compare_time: comparetime1});
    let timestring3 = JSPLib.utility.timeAgo(timestamp1, {compare_time: comparetime1});
    let timestring4 = JSPLib.utility.timeAgo(timeinvalid1, {compare_time: comparetime1});
    TestPrint(`Time ago string for ${timeval1}`, RecordResult(timestring1 === expectedtime1), {result: timestring1});
    TestPrint(`Time ago string for ${timeval2}`, RecordResult(timestring2 === expectedtime2), {result: timestring2});
    TestPrint(`Time ago string for ${timestamp1}`, RecordResult(timestring3 === expectedtime3), {result: timestring3});
    TestPrint(`Time ago string for invalid value ${timeinvalid1}`, RecordResult(timestring4 === 'N/A'), {result: timestring4});

    console.log("Checking toTimeStamp");
    let timeval3 = '"2000-01-01T00:00:00.000Z"';
    let expectedtimestamp1 = 946684800000;
    let timestamp2 = JSPLib.utility.toTimeStamp(timeval3);
    let timestamp3 = JSPLib.utility.toTimeStamp(timeinvalid1);
    TestPrint(`Timestamp for ${timeval3}`, RecordResult(timestamp2 === expectedtimestamp1), {result: timestamp2});
    TestPrint(`Timestamp for invalid ${timeinvalid1}`, RecordResult(Number.isNaN(timestamp3)), {result: timestamp3});

    console.log("Checking not");
    let testvalue1 = null;
    let resultbool1 = JSPLib.utility.not(testvalue1, false);
    let resultbool2 = JSPLib.utility.not(testvalue1, true);
    TestPrint(`Value ${testvalue1} should not be truthy`, RecordResult(!resultbool1), {result: resultbool1});
    TestPrint(`The NOT of value ${testvalue1} should be truthy`, RecordResult(resultbool2), {result: resultbool2});

    console.log("Checking setPrecision");
    testvalue1 = 1.22;
    let testvalue2 = JSPLib.utility.setPrecision(1.2222222, 2);
    TestPrint(`Value ${testvalue1} should be equal to ${testvalue2} with a decimal precision of 2`, RecordResult(testvalue1 === testvalue2), {no_result: true});

    console.log("Checking getUniqueID");
    testvalue1 = JSPLib.utility.getUniqueID();
    testvalue2 = JSPLib.utility.getUniqueID();
    TestPrint(`Value ${testvalue1} should not be equal to ${testvalue2}`, RecordResult(testvalue1 !== testvalue2), {no_result: true});

    console.log("Checking clamp");
    let high = 5
    let low = 1
    testvalue1 = 6
    testvalue2 = 3
    result1 = JSPLib.utility.clamp(testvalue1, low, high);
    result2 = JSPLib.utility.clamp(testvalue2, low, high);
    TestPrint(`Clamp of ${testvalue1} should be 5`, RecordResult(result1 === 5), {result: result1});
    TestPrint(`Clamp of ${testvalue2} should be 3`, RecordResult(result2 === 3), {result: result2});

    console.log("Checking maxLengthString");
    testvalue1 = JSPLib.utility.maxLengthString("AUserNameThatIsWayTooLong");
    testvalue2 = JSPLib.utility.maxLengthString("AUserNameThatIsWayTooLong", 10);
    TestPrint(`Value ${repr(testvalue1)} should have a string length of ${JSPLib.utility.max_column_characters}`, RecordResult(testvalue1.length === JSPLib.utility.max_column_characters), {no_result: true});
    TestPrint(`Value ${repr(testvalue2)} should have a string length of 10`, RecordResult(testvalue2.length === 10), {no_result: true});

    console.log("Checking kebabCase");
    let string1 = "testKebabCase";
    let string2 = "test-kebab-case";
    let string3 = "test_kebab_case";
    let teststring1 = JSPLib.utility.kebabCase(string1);
    let teststring2 = JSPLib.utility.kebabCase(string3);
    TestPrint(`Value ${repr(string1)} should should be changed to ${repr(string2)}`, RecordResult(teststring1 === string2), {result: repr(teststring1)});
    TestPrint(`Value ${repr(string3)} should should be changed to ${repr(string2)}`, RecordResult(teststring2 === string2), {result: repr(teststring2)});

    console.log("Checking camelCase");
    teststring1 = JSPLib.utility.camelCase(string2);
    teststring2 = JSPLib.utility.camelCase(string3);
    TestPrint(`Value ${repr(string2)} should should be changed to ${repr(string1)}`, RecordResult(teststring1 === string1), {result: repr(teststring1)});
    TestPrint(`Value ${repr(string3)} should should be changed to ${repr(string1)}`, RecordResult(teststring2 === string1), {result: repr(teststring2)});

    console.log("Checking snakeCase");
    teststring1 = JSPLib.utility.snakeCase(string1);
    teststring2 = JSPLib.utility.snakeCase(string2);
    TestPrint(`Value ${repr(string1)} should should be changed to ${repr(string3)}`, RecordResult(teststring1 === string3), {result: repr(teststring1)});
    TestPrint(`Value ${repr(string2)} should should be changed to ${repr(string3)}`, RecordResult(teststring2 === string3), {result: repr(teststring2)});

    console.log("Checking displayCase");
    string1 = "test_display_case";
    string2 = "Test display case";
    teststring1 = JSPLib.utility.displayCase(string1);
    TestPrint(`Value ${repr(string1)} should should be changed to ${repr(string2)}`, RecordResult(teststring1 === string2), {result: repr(teststring1)});

    console.log("Checking properCase");
    string1 = "Test proper case";
    string2 = "Test Proper Case";
    teststring1 = JSPLib.utility.properCase(string1);
    TestPrint(`Value ${repr(string1)} should should be changed to ${repr(string2)}`, RecordResult(teststring1 === string2), {result: repr(teststring1)});

    console.log("Checking exceptCase");
    string1 = "Test the except case";
    string2 = "Test the Except Case";
    teststring1 = JSPLib.utility.exceptCase(string1);
    TestPrint(`Value ${repr(string1)} should should be changed to ${repr(string2)}`, RecordResult(teststring1 === string2), {result: repr(teststring1)});

    console.log("Checking romanCase");
    string1 = "Test the roman case iii";
    string2 = "Test the Roman Case III";
    teststring1 = JSPLib.utility.romanCase(string1);
    TestPrint(`Value ${repr(string1)} should should be changed to ${repr(string2)}`, RecordResult(teststring1 === string2), {result: repr(teststring1)});

    console.log("Checking padNumber");
    let num1 = 23;
    let num2 = 23.2;
    string1 = "0023";
    string2 = "0023.2";
    teststring1 = JSPLib.utility.padNumber(num1, 4);
    teststring2 = JSPLib.utility.padNumber(num2, 6);
    TestPrint(`Value ${repr(num1)} should should be changed to ${repr(string1)}`, RecordResult(teststring1 === string1), {result: repr(teststring1)});
    TestPrint(`Value ${repr(num2)} should should be changed to ${repr(string2)}`, RecordResult(teststring2 === string2), {result: repr(teststring2)});

    console.log("Checking sprintf");
    string1 = "%s test %s";
    string2 = "this test 3";
    teststring1 = JSPLib.utility.sprintf(string1, "this", 3);
    TestPrint(`Value ${repr(string1)} should should be changed to ${repr(string2)}`, RecordResult(teststring1 === string2), {result: repr(teststring1)});

    console.log("Checking trim");
    string1 = "something something";
    teststring1 = JSPLib.utility.trim`  \r\r  something something    \n\n  `;
    TestPrint(`Value ${repr(teststring1)} should should be equal to ${repr(string1)}`, RecordResult(teststring1 === string1), {no_result: true});

    console.log("Checking verboseRegex");
    let regex1 = JSPLib.utility.verboseRegex()`\d+`;
    let regex2 = JSPLib.utility.verboseRegex('i')`\w`;
    TestPrint(`Value ${repr(regex1)} should should be a regex`, RecordResult(regex1.constructor.name === 'RegExp'), {no_result: true});
    TestPrint(String.raw`Value ${repr(regex1)} should have a source of \d+`, RecordResult(regex1.source === String.raw`\d+`), {no_result: true});
    TestPrint(`Value ${repr(regex2.toString())} should be case-insensitive`, RecordResult(regex2.flags === 'i'), {no_result: true});

    console.log("Checking findAll");
    string1 = "100 200 300 400";
    let array1 = ["100", "200", "300", "400"];
    result1 = JSPLib.utility.findAll(string1, /\d+/g);
    TestPrint(`Value ${repr(string1)} should find matches ${repr(array1)}`, RecordResult(ArrayEqual(array1, result1)), {result: repr(result1)});

    console.log("Checking regexpEscape");
    string1 = "tag_(qualifier)";
    let regexstring1 = "tag_\\(qualifier\\)";
    teststring1 = JSPLib.utility.regexpEscape(string1);
    TestPrint(`Value ${repr(string1)} should be regex escaped to ${repr(regexstring1)}`, RecordResult(teststring1 === regexstring1), {result: repr(teststring1)});

    console.log("Checking regexReplace");
    string1 = "10 something false";
    let format_string1 = "%NUMBER% %STRING% %BOOL%";
    let format_data1 = {NUMBER: 10, STRING: "something", BOOL: false};
    teststring1 = JSPLib.utility.regexReplace(format_string1, format_data1);
    TestPrint(`Format ${repr(format_string1)} and data ${repr(format_data1)} should should be regex replaced to ${repr(string1)}`, RecordResult(string1 === teststring1), {result: repr(teststring1)});

    console.log("Checking filterEmpty");
    let testarray1 = ["test", "first", "nonempty"];
    let testarray2 = ["test", "first", "empty", ""];
    let resultarray1 = JSPLib.utility.filterEmpty(testarray1);
    let resultarray2 = JSPLib.utility.filterEmpty(testarray2);
    TestPrint(`Array ${repr(testarray1)} should be equal in length to ${repr(resultarray1)}`, RecordResult(testarray1.length === resultarray1.length), {no_result: true});
    TestPrint(`Array ${repr(testarray2)} should not be equal in length to ${repr(resultarray2)}`, RecordResult(testarray2.length !== resultarray2.length), {no_result: true});

    console.log("Checking filterRegex");
    regex1 = /^(?:other|empty)/;
    resultarray1 = JSPLib.utility.filterRegex(testarray1, regex1);
    resultarray2 = JSPLib.utility.filterRegex(testarray2, regex1);
    TestPrint(`Array ${repr(resultarray1)} should have a length of zero`, RecordResult(resultarray1.length === 0), {no_result: true});
    TestPrint(`Array ${repr(resultarray2)} should have a length of one`, RecordResult(resultarray2.length === 1), {no_result: true});

    console.log("Checking concat");
    array1 = [1, 2, 3];
    let array2 = [4, 5, 6];
    let checkarray1 = [1, 2, 3, 4, 5, 6];
    resultarray1 = JSPLib.utility.concat(array1, array2);
    TestPrint(`Array ${repr(array1)} concatenated with ${repr(array2)} should become ${repr(checkarray1)}`, RecordResult(ArrayEqual(checkarray1, resultarray1)), {result: resultarray1});

    console.log("Checking multiConcat");
    let array3 = [7, 8, 9];
    checkarray1 = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    resultarray1 = JSPLib.utility.multiConcat(array1, array2, array3);
    TestPrint(`Array ${repr(array1)} concatenated with ${repr(array2)} should become ${repr(checkarray1)}`, RecordResult(ArrayEqual(checkarray1, resultarray1)), {result: resultarray1});

    console.log("Checking concatUnique");
    array1 = [1, 2, 3];
    array2 = [3, 4, 5];
    checkarray1 = [1, 2, 3, 4, 5, ];
    resultarray1 = JSPLib.utility.concatUnique(array1, array2);
    TestPrint(`Array ${repr(array1)} concatenated with ${repr(array2)} should become ${repr(checkarray1)}`, RecordResult(ArrayEqual(checkarray1, resultarray1)), {result: repr(resultarray1)});

    console.log("Checking isSet");
    let set1 = new Set();
    resultbool1 = JSPLib.utility.isSet(set1);
    TestPrint(`Set ${repr(set1)} should be a set ${bracket(resultbool1)}`, RecordResult(resultbool1), {no_result: true});

    console.log("Checking arrayUnique");
    let testarray3 = ["testing", "first", "testing"];
    checkarray1 = ["testing", "first"];
    resultarray1 = JSPLib.utility.arrayUnique(testarray3);
    TestPrint(`Array ${repr(testarray3)} should become ${repr(checkarray1)}`, RecordResult(ArrayEqual(checkarray1, resultarray1)), {result: resultarray1});

    console.log("Checking arrayDifference");
    resultarray1 = JSPLib.utility.arrayDifference(testarray1, testarray2);
    resultarray2 = JSPLib.utility.arrayDifference(testarray2, testarray1);
    TestPrint(`Array ${repr(resultarray1)} should have a length of one`, RecordResult(resultarray1.length === 1), {no_result: true});
    TestPrint(`Array ${repr(resultarray2)} should have a length of two`, RecordResult(resultarray2.length === 2), {no_result: true});

    console.log("Checking arrayIntersection");
    resultarray1 = JSPLib.utility.arrayIntersection(testarray1, testarray2);
    TestPrint(`Array ${repr(resultarray1)} should have a length of two`, RecordResult(resultarray1.length === 2), {no_result: true});

    console.log("Checking arrayUnion");
    resultarray1 = JSPLib.utility.arrayUnion(testarray1, testarray3);
    TestPrint(`Array ${repr(resultarray1)} should have a length of four`, RecordResult(resultarray1.length === 4), {no_result: true});

    console.log("Checking arraySymmetricDifference");
    resultarray1 = JSPLib.utility.arraySymmetricDifference(testarray1, testarray3);
    TestPrint(`Array ${repr(resultarray1)} should have a length of three`, RecordResult(resultarray1.length === 3), {no_result: true});

    console.log("Checking arrayEquals");
    array1 = [1, 2, 3];
    array2 = [1, 2, 3];
    array3 = [2, 4];
    resultbool1 = JSPLib.utility.arrayEquals(array1, array2);
    resultbool2 = JSPLib.utility.arrayEquals(array1, array3);
    TestPrint(`Array ${repr(array2)} should be equal to ${repr(array1)}`, RecordResult(resultbool1), {no_result: true});
    TestPrint(`Array ${repr(array3)} should not be equal to ${repr(array1)}`, RecordResult(!resultbool2), {no_result: true});

    console.log("Checking isSubArray");
    array1 = [1, 2, 3];
    array2 = [1, 3];
    array3 = [2, 4];
    resultbool1 = JSPLib.utility.isSubArray(array1, array2);
    resultbool2 = JSPLib.utility.isSubArray(array1, array3);
    TestPrint(`Array ${repr(array2)} should be a subset of ${repr(array1)}`, RecordResult(resultbool1), {no_result: true});
    TestPrint(`Array ${repr(array3)} should not be a subset of ${repr(array1)}`, RecordResult(!resultbool2), {no_result: true});

    console.log("Checking isSuperArray");
    array1 = [1, 2, 3];
    array2 = [1, 3];
    resultbool1 = JSPLib.utility.isSuperArray(array1, array2);
    resultbool2 = JSPLib.utility.isSuperArray(array2, array1);
    TestPrint(`Array ${repr(array2)} should not be a superset of ${repr(array1)}`, RecordResult(!resultbool1), {no_result: true});
    TestPrint(`Array ${repr(array1)} should be a superset of ${repr(array2)}`, RecordResult(resultbool2), {no_result: true});

    console.log("Checking arrayHasIntersection");
    array1 = [1, 2, 3];
    array2 = [3, 5];
    array3 = [5, 6];
    resultbool1 = JSPLib.utility.arrayHasIntersection(array1, array2);
    resultbool2 = JSPLib.utility.arrayHasIntersection(array1, array3);
    TestPrint(`Array ${repr(array1)} should have an intersection with ${repr(array2)}`, RecordResult(resultbool1), {no_result: true});
    TestPrint(`Array ${repr(array1)} should not have an intersection with ${repr(array3)}`, RecordResult(!resultbool2), {no_result: true});

    console.log("Checking listFilter");
    let testobjectarray1 = [{id: 1, type: 'a'}, {id: 2, type: 'b'}, {id: 3, type: 'b'}];
    testarray1 = [1, 3];
    testarray2 = ['a'];
    let expectedobjectarray1 = [{id: 1, type: 'a'}, {id: 3, type: 'b'}];
    let expectedobjectarray2 = [{id: 2, type: 'b'}, {id: 3, type: 'b'}];
    let resultobjectarray1 = JSPLib.utility.listFilter(testobjectarray1, testarray1, 'id');
    let resultobjectarray2 = JSPLib.utility.listFilter(testobjectarray1, testarray2, 'type', true);
    TestPrint(`Object array ${repr(testobjectarray1)} with id filters on ${repr(testarray1)} should be equal to ${repr(expectedobjectarray1)}`, RecordResult(JSON.stringify(resultobjectarray1) === JSON.stringify(expectedobjectarray1)), {result: repr(resultobjectarray1)});
    TestPrint(`Object array ${repr(testobjectarray1)} with reverse type filters on ${repr(testarray2)} should be equal to ${repr(expectedobjectarray2)}`, RecordResult(JSON.stringify(resultobjectarray2) === JSON.stringify(expectedobjectarray2)), {result: repr(resultobjectarray2)});

    console.log("Checking joinList");
    string1 = "test-1-section,test-3-section";
    teststring1 = JSPLib.utility.joinList(testarray1, "test-", '-section', ',');
    TestPrint(`Value ${repr(testarray1)} should should be changed to ${repr(string1)}`, RecordResult(teststring1 === string1), {result: repr(teststring1)});

    console.log("Checking freezeObject");
    let testobject1 = {id: 1, type: {a: 1, b: 2}};
    let testobject2 = {id: 2, type: {a: 3, b: 4}};
    JSPLib.utility.freezeObject(testobject1);
    JSPLib.utility.freezeObject(testobject2, true);
    let boolarray1 = [Object.isFrozen(testobject1), !Object.isFrozen(testobject1.type)];
    let boolarray2 = [Object.isFrozen(testobject2), Object.isFrozen(testobject2.type)];
    TestPrint(`Object ${repr(testobject1)} should be frozen but not object attributes`, RecordResult(boolarray1.every((val) => val)), {result: repr(boolarray1)});
    TestPrint(`Object ${repr(testobject2)} and object attributes should be frozen`, RecordResult(boolarray2.every((val) => val)), {result: repr(boolarray2)});

    console.log("Checking freezeObjects");
    testobjectarray1 = [{id: 1, type: {a: 1, b: 2}}, {id: 2, type: {a: 3, b: 4}}];
    JSPLib.utility.freezeObjects(testobjectarray1, true);
    boolarray1 = [Object.isFrozen(testobjectarray1[0]), Object.isFrozen(testobjectarray1[0].type), Object.isFrozen(testobjectarray1[1]), Object.isFrozen(testobjectarray1[1].type)];
    TestPrint(`Objects array ${repr(testobjectarray1)} should have the object and object attributes be frozen`, RecordResult(boolarray1.every((val) => val)), {result: repr(boolarray1)});

    console.log("Checking freezeProperty");
    testobject1 = {id: 1, type: {a: 1, b: 2}};
    JSPLib.utility.freezeProperty(testobject1, 'id');
    let objectdescriptor1 = Object.getOwnPropertyDescriptor(testobject1, 'id');
    boolarray1 = [!objectdescriptor1.writable, !objectdescriptor1.configurable];
    TestPrint(`Object ${repr(testobject1)} should have the 'id' attribute be frozen`, RecordResult(boolarray1.every((val) => val)), {result: repr(boolarray1)});

    console.log("Checking freezeProperties");
    testobject1 = {id: 2, type: {a: 3, b: 4}};
    JSPLib.utility.freezeProperties(testobject1, ['id', 'type']);
    objectdescriptor1 = Object.getOwnPropertyDescriptor(testobject1, 'id');
    let objectdescriptor2 = Object.getOwnPropertyDescriptor(testobject1, 'type');
    boolarray1 = [!objectdescriptor1.writable, !objectdescriptor1.configurable, !objectdescriptor2.writable, !objectdescriptor2.configurable];
    TestPrint(`Object ${repr(testobject1)} should have the 'id' and 'type' attributes be frozen`, RecordResult(boolarray1.every((val) => val)), {result: repr(boolarray1)});

    console.log("Checking getObjectAttributes");
    array1 = [1, 2, 3];
    testobjectarray1 = [{id: 1, type: 'a'}, {id: 2, type: 'b'}, {id: 3, type: 'b'}];
    resultarray1 = JSPLib.utility.getObjectAttributes(testobjectarray1, 'id');
    TestPrint(`Object array ${repr(testobjectarray1)} with getting the id attributes should be equal to ${repr(array1)}`, RecordResult(ArrayEqual(resultarray1, array1)), {result: repr(resultarray1)});

    console.log("Checking getNestedAttribute");
    result1 = JSPLib.utility.getNestedAttribute(testobject1, ['type', 'a']);
    TestPrint(`Object ${repr(testobject1)} with getting a nested attribute should be equal to 3`, RecordResult(result1 === 3), {result: repr(result1)});

    console.log("Checking getNestedObjectAttributes");
    array1 = [1, 3];
    testobjectarray1 = [{id: 1, type: {a: 1, b: 2}}, {id: 2, type: {a: 3, b: 4}}];
    resultarray1 = JSPLib.utility.getNestedObjectAttributes(testobjectarray1, ['type', 'a']);
    TestPrint(`Object array ${repr(testobjectarray1)} with getting nested attributes should be equal to ${repr(array1)}`, RecordResult(ArrayEqual(resultarray1, array1)), {result: repr(resultarray1)});

    console.log("Checking objectReduce");
    testobject1 = {test1: 1, test2: 2, test3: 3};
    result1 = JSPLib.utility.objectReduce(testobject1, (total, val) => total + val, 0);
    TestPrint(`Object ${repr(testobject1)} totaling key values should be equal to 6`, RecordResult(result1 === 6), {result: repr(result1)});

    console.log("Checking dataCopy");
    testobject1 = {'test': 0, 'value': {'deep': 1}};
    let copyobject1 = testobject1;
    let shallowobject1 = Object.assign({}, testobject1);
    let [deepobject1] = JSPLib.utility.dataCopy([testobject1]);
    testobject1.test = 10;
    testobject1.value.deep = 11;
    TestPrint(`Object ${repr(copyobject1)} should have the same values as`, RecordResult(copyobject1?.test === 10 && copyobject1?.value?.deep === 11), {result: repr(testobject1)});
    TestPrint(`Object ${repr(shallowobject1)} should have one value the same as`, RecordResult(shallowobject1?.test !== 10 && copyobject1?.value?.deep === 11), {result: repr(testobject1)});
    TestPrint(`Object ${repr(deepobject1)} should have no values the same as`, RecordResult(deepobject1?.test !== 10 && deepobject1?.value?.deep !== 11), {result: repr(testobject1)});

    console.log("Checking mergeHashes");
    let object1 = {search: {id: "20,21,5"}};
    let object2 = {search: {order: "customorder"}};
    result1 = JSPLib.utility.mergeHashes(object1, object2);
    boolarray1 = [HashContains(result1, ['search']), HashContains(result1.search, ['id', 'order'])];
    if(boolarray1[1]) {
        boolarray1.push(result1.search.id === "20,21,5")
        boolarray1.push(result1.search.order === "customorder");
    }
    TestPrint(`Merging hashes ${repr(object1)} and ${repr(object2)} produces the following result => ${repr(result1)}`, RecordResult(boolarray1.every((val) => val)), {result: repr(boolarray1)});

    console.log("Checking recurseCompareObjects");
    testobject1 = {'test': 0, 'value': {'deep': 1}};
    copyobject1 = {'test': 0, 'value': {'deep': 2}};
    let resultobject1 = JSPLib.utility.recurseCompareObjects(testobject1, copyobject1);
    TestPrint(`Object ${repr(testobject1)} compared against ${repr(copyobject1)} should find the changed value ${repr(resultobject1)}`, RecordResult(resultobject1?.value?.deep?.[0] === 1 && resultobject1?.value?.deep?.[1] === 2), {result: repr(resultobject1)});

    console.log("Checking arrayFill");
    string1 = "[]";
    testarray1 = JSPLib.utility.arrayFill(10, string1);
    //Compare to see if any entry is equal to any other entry
    resultbool1 = !testarray1.reduce((isequal, entry, i, array) => isequal || ((i < array.length - 1) && array.slice(i + 1, array.length - 1).reduce((subisequal, subentry) => subisequal || (subentry === entry), false)), false);
    //Compare to see if all entries are equal to the JSON string when stringified
    resultbool2 = testarray1.reduce((isequal, entry) => isequal && JSON.stringify(entry) === string1, true);
    TestPrint(`Object ${repr(testarray1)} should have a length of 10`, RecordResult(testarray1.length === 10), {result: testarray1.length});
    TestPrint(`Object ${repr(testarray1)} should have no entries equal to each other`, RecordResult(resultbool1 === true), {no_result: true});
    TestPrint(`Object ${repr(testarray1)} should have all entries equal to the stringified JSON`, RecordResult(resultbool2 === true), {no_result: true});

    console.log("Checking hijackFunction");
    let add_function = function (a, b) {return a + b;};
    let subtract_one = function (data) {return data - 1;};
    let hijacked_function = JSPLib.utility.hijackFunction(add_function, subtract_one);
    testvalue1 = add_function(3, 4);
    testvalue2 = hijacked_function(3, 4);
    TestPrint("Original add function should produce a result of 7", RecordResult(testvalue1 === 7), {no_result: true});
    TestPrint("Hijacked add function should produce a result of 6", RecordResult(testvalue2 === 6), {no_result: true});

    console.log("Checking DOMtoArray");
    let $domtest = jQuery.parseHTML(domdata_test)[0];
    array1 = JSPLib.utility.DOMtoArray($domtest.attributes);
    array2 = array1.map((entry) => entry.value);
    array3 = ['test1', '2'];
    TestPrint("Object returned should be an array", RecordResult(Array.isArray(array1)), {no_result: true});
    TestPrint(`Data values for object should be ${repr(array3)}`, RecordResult(JSON.stringify(array2) === JSON.stringify(array3)), {result: repr(array2)});

    console.log("Checking DOMtoHash");
    let hash1 = JSPLib.utility.DOMtoHash($domtest.dataset);
    array2 = Object.keys(hash1).map((entry) => hash1[entry]);
    TestPrint("Object returned should be a hash", RecordResult(hash1.constructor === Object), {no_result: true});
    TestPrint(`Data values for object should be ${repr(array3)}`, RecordResult(JSON.stringify(array2) === JSON.stringify(array3)), {result: repr(array2)});

    console.log("Checking getDOMAttributes");
    let $domarray = jQuery.parseHTML(domdata_test);
    checkarray1 = ["test1"];
    resultarray1 = JSPLib.utility.getDOMAttributes($domarray, 'test1', String);
    TestPrint("Object returned should be an array", RecordResult(Array.isArray(resultarray1)), {no_result: true});
    TestPrint(`Data values for array should be ${repr(checkarray1)}`, RecordResult(ArrayEqual(checkarray1, resultarray1)), {result: repr(resultarray1)});

    console.log("Checking getAllDOMData");
    hash1 = JSPLib.utility.getAllDOMData($domtest);
    let hash2 = {test1: "test1", test2: 2};
    TestPrint("Object returned should be a hash", RecordResult(hash1.constructor === Object), {no_result: true});
    TestPrint(`Data values for object should be ${repr(hash2)}`, RecordResult(HashContains(hash1, ['test1', 'test2']) && hash1.test1 === hash2.test1 && hash1.test2 === hash2.test2), {result: repr(hash1)});

    //Setup for data functions
    let jqueryobj = jQuery("#checklibrary-count");
    jqueryobj.on("mouseenter.checklibraries.test_hover", () => {
        console.log("Hovering over count...");
    });
    testdata1 = {test_data: 'check'};
    jqueryobj.data(testdata1);
    let $domobj = jqueryobj[0];
    jQuery(document).on("checklibraries:log-this", () => {console.log("Check this out");});
    await JSPLib.utility.sleep(100);

    console.log("Checking getPrivateData");
    let data1 = JSPLib.utility.getPrivateData($domobj);
    TestPrint("data should be object with 2 keys and 1 subkey", RecordResult(HashContains(data1, ['events', 'handle']) && HashContains(data1.events, ['mouseover'])), {result: repr(data1)});

    console.log("Checking getPublicData");
    data1 = JSPLib.utility.getPublicData($domobj);
    TestPrint(`data should be object ${repr(testdata1)}`, RecordResult(HashContains(data1, ['test_data']) && data1.test_data === "check"), {result: repr(data1)});

    console.log("Checking saveEventHandlers");
    string1 = 'checklibraries.test_hover';
    data1 = JSPLib.utility.saveEventHandlers('#checklibrary-count', 'mouseover');
    TestPrint("There should be 1 event for the object", RecordResult(data1.length === 1), {result: data1.length});
    TestPrint(`The namespace should be named ${string1}`, RecordResult(data1?.[0]?.[0] === string1), {result: data1?.[0]?.[0]});

    if (data1.length) {
        console.log("Checking rebindEventHandlers");
        jqueryobj.off("mouseenter.checklibraries.test_hover");
        result1 = JSPLib.utility.saveEventHandlers('#checklibrary-count', 'mouseover');
        JSPLib.utility.rebindEventHandlers('#checklibrary-count', 'mouseover', data1, ['test_hover']);
        result2 = JSPLib.utility.saveEventHandlers('#checklibrary-count', 'mouseover');
        TestPrint("There should be 0 event for the object before rebinding", RecordResult(result1.length === 0), {result: result1.length});
        TestPrint("There should be 1 event for the object", RecordResult(result2.length === 1), {result: result2.length});
        TestPrint(`The namespace should be named ${string1}`, RecordResult(result2?.[0]?.[0] === string1), {result: result2?.[0]?.[0]});
    } else {
        console.error("Unable to do the rebindEventHandlers test.");
    }

    console.log("Checking getBoundEventNames");
    array1 = JSPLib.utility.getBoundEventNames("#checklibrary-count", 'mouseover', null);
    array2 = ['checklibraries.test_hover'];
    TestPrint(`Bound event names for object should be ${repr(array2)}`, RecordResult(JSON.stringify(array1) === JSON.stringify(array2)), {result: repr(array1)});

    console.log("Checking isNamespaceBound");
    string1 = 'checklibraries.test_hover';
    resultbool1 = JSPLib.utility.isNamespaceBound("#checklibrary-count", 'mouseover', string1);
    TestPrint(`Bound event names for object should include ${repr(string1)}`, RecordResult(resultbool1), {result: repr(resultbool1)});

    console.log("Checking isGlobalFunctionBound");
    string1 = 'checklibraries:log-this';
    resultbool1 = JSPLib.utility.isGlobalFunctionBound(string1);
    TestPrint(`Global functions should include ${repr(string1)}`, RecordResult(resultbool1), {result: repr(resultbool1)});

    console.log("Checking getDOMDataKeys");
    array1 = JSPLib.utility.getDOMDataKeys("#checklibrary-count");
    array2 = ['test_data'];
    TestPrint(`DOM data keys for object should be ${repr(array2)}`, RecordResult(JSON.stringify(array1) === JSON.stringify(array2)), {result: repr(array1)});

    console.log("Checking hasDOMDataKey");
    string1 = 'test_data';
    resultbool1 = JSPLib.utility.hasDOMDataKey("#checklibrary-count", string1);
    TestPrint(`DOM data keys for object should include ${repr(string1)}`, RecordResult(resultbool1 === true), {no_result: true});

    console.log("Checking addStyleSheet");
    JSPLib.utility.addStyleSheet("https://cdn.jsdelivr.net/gh/BrokenEagle/JavaScripts@stable/test/test-css-1.css", "test");
    console.log("Color set to green... changing color in 5 seconds.");
    await JSPLib.utility.sleep(csstyle_waittime);
    JSPLib.utility.addStyleSheet("https://cdn.jsdelivr.net/gh/BrokenEagle/JavaScripts@stable/test/test-css-2.css", "test");
    console.log("Color set to orange... validate that there is only 1 style element.");
    TestPrint(`Module global cssstyle ${repr(JSPLib.utility._css_sheet)} should have a length of 1`, RecordResult(Object.keys(JSPLib.utility._css_sheet).length === 1), {result: Object.keys(JSPLib.utility._css_sheet).length});
    await JSPLib.utility.sleep(csstyle_waittime);
    JSPLib.utility.addStyleSheet("", "test");

    console.log("Checking isScrolledIntoView");
    window.scroll(0, 10000);
    await JSPLib.utility.sleep(100);
    result1 = JSPLib.utility.isScrolledIntoView(document.querySelector('footer'));
    TestPrint("Page footer should be in view", RecordResult(result1), {no_result: true});

    console.log("Checking setCSSStyle");
    let prior_length = Object.keys(JSPLib.utility._css_style).length;
    JSPLib.utility.setCSSStyle("body {background: black !important;}", "test");
    console.log("Color set to black... changing color in 5 seconds.");
    await JSPLib.utility.sleep(csstyle_waittime);
    JSPLib.utility.setCSSStyle("body {background: purple !important;}", "test");
    console.log("Color set to purple... validate that there is only 1 style element.");
    let current_length = Object.keys(JSPLib.utility._css_style).length;
    TestPrint(`Module global cssstyle ${repr(JSPLib.utility._css_style)} should have increased the number of keys by 1`, RecordResult((current_length - prior_length) === 1), {result: {prior: prior_length, current: current_length}});
    await JSPLib.utility.sleep(csstyle_waittime);
    JSPLib.utility.setCSSStyle("", "test");

    console.log("Checking hasStyle");
    result1 = JSPLib.utility.hasStyle('test');
    TestPrint("Test style should be initialized", RecordResult(result1), {no_result: true});

    console.log("Checking fullHide");
    let selector1 = "#page";
    JSPLib.utility.fullHide(selector1);
    let expectedstyletext1 = "display: none !important;";
    let resultstyletext1 = document.querySelector(selector1).style.cssText;
    TestPrint(`DOM ${selector1} should have the CSS style of ${repr(expectedstyletext1)}`, RecordResult(expectedstyletext1 === resultstyletext1), {result: repr(resultstyletext1)});

    console.log("Sleeping 5 seconds for visual confirmation.");
    await JSPLib.utility.sleep(csstyle_waittime);

    console.log("Checking clearHide");
    JSPLib.utility.clearHide(selector1);
    expectedstyletext1 = "";
    resultstyletext1 = document.querySelector(selector1).style.cssText;
    TestPrint(`DOM ${selector1} should have the CSS style of ${repr(expectedstyletext1)}`, RecordResult(expectedstyletext1 === resultstyletext1), {result: repr(resultstyletext1)});
    window.scroll(0, 10000);

    console.log("Checking getMeta");
    let metaselector1 = "csrf-param";
    let expectedmeta1 = "authenticity_token";
    let resultmeta1 = JSPLib.utility.getMeta(metaselector1);
    TestPrint(`Meta ${metaselector1} should have the content of ${repr(expectedmeta1)}`, RecordResult(expectedmeta1 === resultmeta1), {result: repr(resultmeta1)});

    console.log("Checking getHTMLTree");
    let expectedtree1 = "html > body.c-static.a-site-map.flex.flex-col:nth-of-type(1) > footer#page-footer.text-sm.text-center.flex-initial.mt-4.py-3.w-full.border-t.flex.flex-wrap.items-center.justify-center.gap-1:nth-of-type(1)";
    result1 = JSPLib.utility.getHTMLTree(document.querySelector('footer'));
    TestPrint(`The footer should have "${expectedtree1}" as the HTML tree`, RecordResult(result1 === expectedtree1), {result: result1});

    console.log("Checking getNthParent");
    $domtest = jQuery.parseHTML(walkdom_test);
    let child1 = jQuery("#child0a", $domtest)[0];
    result1 = JSPLib.utility.getNthParent(child1, 1);
    TestPrint(`Node ${child1.id} should have parent0 as a parent`, RecordResult(result1?.id === "parent0"), {result: result1.id});

    console.log("Checking getNthChild");
    let parent1 = jQuery("#parent0", $domtest)[0];
    result1 = JSPLib.utility.getNthChild(parent1, 2);
    result2 = JSPLib.utility.getNthChild(parent1, -2);
    TestPrint(`Node ${parent1.id} should have child0b as the 2nd child from the start`, RecordResult(result1?.id === "child0b"), {result: result1.id});
    TestPrint(`Node ${parent1.id} should have child0a as the 2nd child from the end`, RecordResult(result2?.id === "child0a"), {result: result2?.id});

    console.log("Checking getNthSibling");
    result1 = JSPLib.utility.getNthSibling(child1, 1);
    TestPrint(`Node ${child1.id} should have child0b as its first sibling`, RecordResult(result1?.id === "child0b"), {result: result1?.id});

    console.log("Checking walkDOM");
    result1 = JSPLib.utility.walkDOM(child1, [[0, -1], [1, 0], [0, 2]]);
    TestPrint(`Node ${child1.id} should have child1b as the second child of its parent's first sibling`, RecordResult(result1?.id === "child1b"), {result: result1?.id});

    console.log("Checking getImageDimensions");
    let dimensions1 = {width: 127, height: 180};
    let dimensions2 = await JSPLib.utility.getImageDimensions(PREVIEW_URL);
    TestPrint(`Dimensions should have width of 127 and height of 180`, RecordResult(Boolean(dimensions2?.width === 127 && dimensions2?.height === 180)), {result: repr(dimensions2)});

    console.log("Checking getPreviewDimensions");
    let base_dimensions = 150;
    dimensions2 = JSPLib.utility.getPreviewDimensions(dimensions1.width, dimensions1.height, base_dimensions);
    TestPrint(`Dimensions should have width of 106 and height of 150`, RecordResult(Boolean(dimensions2?.[0] === 106 && dimensions2?.[1] === 150)), {result: repr(dimensions2)});

    console.log("Checking recheckTimer");
    let checkvalue1 = false;
    let checkvalue2 = false;
    let checkvalue3 = false;
    let iterator1 = 0;
    let iterator2 = 0;
    let timer1 = JSPLib.utility.recheckTimer({
        check: () => {
            console.log("[Non-expiring] Checking value", ++iterator1, "times.");
            return checkvalue1;
        },
        exec: () => {checkvalue2 = true;}
    }, 100);
    let timer2 = JSPLib.utility.recheckTimer({
        check: () => {
            console.log("[Expiring] Checking value", ++iterator2, "times.");
            return checkvalue1;
        },
        exec: () => {checkvalue3 = true;}
    }, 100, 100);
    await JSPLib.utility.sleep(JSPLib.utility.one_second);
    checkvalue1 = true;
    await JSPLib.utility.sleep(JSPLib.utility.one_second);
    TestPrint(`Non-expiring timer should have been successful`, RecordResult(timer1.timer === true), {result: repr(timer1)});
    TestPrint(`Non-expiring timer should have changed value to true`, RecordResult(checkvalue2 === true), {result: checkvalue2});
    TestPrint(`Expiring timer should have not been successful`, RecordResult(timer2.timer === false), {no_result: true});
    TestPrint(`Expiring timer should have changed value to true`, RecordResult(checkvalue3 === false), {no_result: true});

    console.log("Checking readCookie");
    let cookiename1 = "doesnt-exist";
    result1 = JSPLib.utility.readCookie(cookiename1);
    TestPrint(`Cookie ${cookiename1} should not exist`, RecordResult(result1 === null), {result: result1});

    console.log("Checking createCookie");
    let value1 = 'doesexist';
    JSPLib.utility.createCookie(cookiename1, value1);
    result1 = JSPLib.utility.readCookie(cookiename1);
    TestPrint(`Cookie ${cookiename1} should now exist with value 'doesexist'`, RecordResult(result1 === value1), {result: result1});

    console.log("Checking eraseCookie");
    JSPLib.utility.eraseCookie(cookiename1);
    result1 = JSPLib.utility.readCookie(cookiename1);
    TestPrint(`Cookie ${cookiename1} should now not exist after being erased`, RecordResult(result1 === null), {result: result1});

    console.log("Checking getDomainName");
    string1 = "http://danbooru.donmai.us";
    string2 = "donmai.us";
    string3 = JSPLib.utility.getDomainName(string1, 2);
    TestPrint(`URL of ${string1} should have a base domain of ${string2}`, RecordResult(string2 === string3), {result: string3});

    console.log("Checking parseParams");
    string1 = "test1=2&test2=3";
    object1 = {test1: "2", test2: "3"};
    result1 = JSPLib.utility.parseParams(string1);
    TestPrint(`Value ${repr(string1)} should should be changed to ${repr(object1)}`, RecordResult(JSON.stringify(object1) === JSON.stringify(result1)), {result: repr(result1)});

    console.log("Checking HTMLEscape");
    string1 = '& < > "';
    string2 = "&amp; &lt; &gt; &quot;";
    result1 = JSPLib.utility.HTMLEscape(string1);
    TestPrint(`Value ${repr(string1)} should should be changed to ${repr(string2)}`, RecordResult(string2 === result1), {result: repr(result1)});

    console.log("Checking fullEncodeURIComponent");
    string1 = 'blah_(foo)';
    string2 = "blah_%28foo%29";
    result1 = JSPLib.utility.fullEncodeURIComponent(string1);
    TestPrint(`Value ${repr(string1)} should should be changed to ${repr(string2)}`, RecordResult(string2 === result1), {result: repr(result1)});

    console.log(`CheckUtilityLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

function CheckStatisticsLibrary() {
    console.log("++++++++++++++++++++CheckStatisticsLibrary++++++++++++++++++++");
    console.log("Start time:", JSPLib.utility.getProgramTime());
    ResetResult();

    console.log("Checking average");
    let data1 = [0, 1, 2, 3, 4, 20];
    let data2 = [];
    let expected_result1 = 5;
    let result1 = JSPLib.statistics.average(data1);
    let result2 = JSPLib.statistics.average(data2);
    TestPrint(`Values of ${repr(data1)} should have an average of ${expected_result1}`, RecordResult(result1 === expected_result1), {result: result1});
    TestPrint(`An empty array should have an average of NaN`, RecordResult(Number.isNaN(result2)), {result: result2});

    console.log("Checking standardDeviation");
    expected_result1 = 6.83;
    result1 = RoundToHundredth(JSPLib.statistics.standardDeviation(data1));
    TestPrint(`Values of ${repr(data1)} should have a standard deviation of ${expected_result1}`, RecordResult(result1 === expected_result1), {no_result: true});

    console.log("Checking removeOutliers");
    result1 = JSPLib.statistics.removeOutliers(data1);
    TestPrint(`Values of ${repr(data1)} should have had 1 outlier removed`, RecordResult((data1.length - result1.length) === 1), {no_result: true});

    console.log("Checking outputAdjustedMean()");
    console.log(JSPLib.debug._records);
    JSPLib.debug._records = {};
    console.log("Shouldn't see output #1");
    JSPLib.statistics.outputAdjustedMean("Statistics Test");
    JSPLib.debug.recordTime('statistics', 'test');
    JSPLib.debug.recordTimeEnd('statistics', 'test');
    console.log("Shouldn't see output #2");
    let debug_enabled = JSPLib.debug.debug_console;
    JSPLib.debug.debug_console = false;
    JSPLib.statistics.outputAdjustedMean("Statistics Test");
    console.log("Should see output #3");
    JSPLib.debug.debug_console = true;
    JSPLib.statistics.outputAdjustedMean("Statistics Test");
    JSPLib.debug.debug_console = debug_enabled;

    console.log(`CheckStatisticsLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

function CheckValidateLibrary() {
    console.log("++++++++++++++++++++CheckValidateLibrary++++++++++++++++++++");
    console.log("Start time:", JSPLib.utility.getProgramTime());
    ResetResult();

    var testdata1;
    var testdata2;
    var result1;
    var result2;
    var result3;
    var result4;

    //For checking library with/without validate installed
    if (typeof validate === "function") {
        console.log("Checking number_constraints");
        testdata1 = {value: "test"};
        testdata2 = {value: 0};
        result1 = validate(testdata1, {value: JSPLib.validate.number_constraints});
        result2 = validate(testdata2, {value: JSPLib.validate.number_constraints});
        TestPrint(`Object ${repr(testdata1)} should have 1 validation error`, RecordResult(GetValidationLength(result1) === 1), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should have 0 validation errors`, RecordResult(GetValidationLength(result2) === 0), {no_result: true});

        console.log("Checking integer_constraints");
        testdata1 = {value: 1.44};
        testdata2 = {value: 0};
        result1 = validate(testdata1, {value: JSPLib.validate.integer_constraints});
        result2 = validate(testdata2, {value: JSPLib.validate.integer_constraints});
        TestPrint(`Object ${repr(testdata1)} should have 1 validation error`, RecordResult(GetValidationLength(result1) === 1), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should have 0 validation errors`, RecordResult(GetValidationLength(result2) === 0), {no_result: true});

        console.log("Checking counting_constraints");
        testdata1 = {value: -1};
        testdata2 = {value: 0};
        result1 = validate(testdata1, {value: JSPLib.validate.counting_constraints});
        result2 = validate(testdata2, {value: JSPLib.validate.counting_constraints});
        TestPrint(`Object ${repr(testdata1)} should have 1 validation error`, RecordResult(GetValidationLength(result1) === 1), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should have 0 validation errors`, RecordResult(GetValidationLength(result2) === 0), {no_result: true});

        console.log("Checking postcount_constraints");
        testdata1 = {value: 0};
        testdata2 = {value: 1};
        result1 = validate(testdata1, {value: JSPLib.validate.postcount_constraints});
        result2 = validate(testdata2, {value: JSPLib.validate.postcount_constraints});
        TestPrint(`Object ${repr(testdata1)} should have 1 validation error`, RecordResult(GetValidationLength(result1) === 1), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should have 0 validation errors`, RecordResult(GetValidationLength(result2) === 0), {no_result: true});

        console.log("Checking expires_constraints");
        testdata1 = {value: -1};
        testdata2 = {value: "1"};
        result1 = validate(testdata1, {value: JSPLib.validate.expires_constraints});
        result2 = validate(testdata2, {value: JSPLib.validate.expires_constraints});
        TestPrint(`Object ${repr(testdata1)} should have 1 validation error`, RecordResult(GetValidationLength(result1) === 1), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should have 0 validation errors`, RecordResult(GetValidationLength(result2) === 0), {no_result: true});

        console.log("Checking inclusion_constraints");
        testdata1 = {value: null};
        testdata2 = {value: "dog"};
        let inclusion1 = ["dog", "cat"];
        result1 = validate(testdata1, {value: JSPLib.validate.inclusion_constraints(inclusion1)});
        result2 = validate(testdata2, {value: JSPLib.validate.inclusion_constraints(inclusion1)});
        TestPrint(`Object ${repr(testdata1)} with inclusion ${repr(inclusion1)} should have 1 validation error`, RecordResult(GetValidationLength(result1) === 1), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} with inclusion ${repr(inclusion1)} should have 0 validation errors`, RecordResult(GetValidationLength(result2) === 0), {no_result: true});

        console.log("Checking hash validator");
        testdata1 = {value: [0, 1, 2]};
        testdata2 = {value: {a: 1}};
        var validator1 = {value: {hash: true}};
        result1 = validate(testdata1, validator1);
        result2 = validate(testdata2, validator1);
        TestPrint(`Object ${repr(testdata1)} with validator ${repr(validator1)} should have 1 validation error`, RecordResult(GetValidationLength(result1) === 1), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} with validator ${repr(validator1)} should have 0 validation errors`, RecordResult(GetValidationLength(result2) === 0), {no_result: true});

        console.log("Checking array validator");
        testdata1 = {value: [0, 1, 2]};
        testdata2 = {value: [0, 1, 2, 3]};
        validator1 = {value: {array: {length: {is: 4}}}};
        var validator2 = {value: {array: {length: {minimum: 4}}}};
        var validator3 = {value: {array: {length: {maximum: 3}}}};
        result1 = validate(testdata1, validator1);
        result2 = validate(testdata1, validator2);
        result3 = validate(testdata2, validator3);
        result4 = validate(testdata2, validator1);
        TestPrint(`Object ${repr(testdata1)} with validator ${repr(validator1)} should have 1 validation error`, RecordResult(GetValidationLength(result1) === 1), {no_result: true});
        TestPrint(`Object ${repr(testdata1)} with validator ${repr(validator2)} should have 1 validation error`, RecordResult(GetValidationLength(result2) === 1), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} with validator ${repr(validator3)} should have 1 validation error`, RecordResult(GetValidationLength(result3) === 1), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} with validator ${repr(validator1)} should have 0 validation errors`, RecordResult(GetValidationLength(result4) === 0), {no_result: true});

        console.log("Checking boolean validator");
        testdata1 = {value: undefined};
        testdata2 = {value: true};
        validator1 = {value: {boolean: true}};
        result1 = validate(testdata1, validator1);
        result2 = validate(testdata2, validator1);
        TestPrint(`Object ${repr(testdata1)} with validator ${repr(validator1)} should have 1 validation error`, RecordResult(GetValidationLength(result1) === 1), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} with validator ${repr(validator1)} should have 0 validation errors`, RecordResult(GetValidationLength(result2) === 0), {no_result: true});

        console.log("Checking string validator");
        testdata1 = {value: undefined};
        testdata2 = {value: null};
        validator1 = {value: {string: {allowNull: true}}};
        result1 = validate(testdata1, validator1);
        result2 = validate(testdata2, validator1);
        TestPrint(`Object ${repr(testdata1)} with validator ${repr(validator1)} should have 1 validation error`, RecordResult(GetValidationLength(result1) === 1), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} with validator ${repr(validator1)} should have 0 validation errors`, RecordResult(GetValidationLength(result2) === 0), {no_result: true});

        console.log("Checking tagentryarray validator");
        testdata1 = {value: ["tag", 0]};
        testdata2 = {value: [["tag", 0]]};
        result1 = validate(testdata1, {value: {tagentryarray: true}});
        result2 = validate(testdata2, {value: {tagentryarray: true}});
        TestPrint(`Object ${repr(testdata1)} should have 1 validation error`, RecordResult(GetValidationLength(result1) === 1), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should have 0 validation errors`, RecordResult(GetValidationLength(result2) === 0), {no_result: true});

        console.log("Checking hash_constraints");
        testdata1 = {value: "0"};
        testdata2 = {value: {}};
        result1 = validate(testdata1, {value: JSPLib.validate.hash_constraints});
        result2 = validate(testdata2, {value: JSPLib.validate.hash_constraints});
        TestPrint(`Object ${repr(testdata1)} should have 1 validation error`, RecordResult(GetValidationLength(result1) === 1), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should have 0 validation errors`, RecordResult(GetValidationLength(result2) === 0), {no_result: true});

        console.log("Checking array_constraints");
        testdata1 = {value: null};
        testdata2 = {value: ["test"]};
        result1 = validate(testdata1, {value: JSPLib.validate.array_constraints()});
        result2 = validate(testdata2, {value: JSPLib.validate.array_constraints({is: 1})});
        TestPrint(`Object ${repr(testdata1)} should have 1 validation error`, RecordResult(GetValidationLength(result1) === 1), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should have 0 validation errors`, RecordResult(GetValidationLength(result2) === 0), {no_result: true});

        console.log("Checking boolean_constraints");
        testdata1 = {value: null};
        testdata2 = {value: false};
        result1 = validate(testdata1, {value: JSPLib.validate.boolean_constraints});
        result2 = validate(testdata2, {value: JSPLib.validate.boolean_constraints});
        TestPrint(`Object ${repr(testdata1)} should have 1 validation error`, RecordResult(GetValidationLength(result1) === 1), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should have 0 validation errors`, RecordResult(GetValidationLength(result2) === 0), {no_result: true});

        console.log("Checking stringonly_constraints");
        testdata1 = {value: null};
        testdata2 = {value: "test"};
        result1 = validate(testdata1, {value: JSPLib.validate.stringonly_constraints});
        result2 = validate(testdata2, {value: JSPLib.validate.stringonly_constraints});
        TestPrint(`Object ${repr(testdata1)} should have 1 validation error`, RecordResult(GetValidationLength(result1) === 1), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should have 0 validation errors`, RecordResult(GetValidationLength(result2) === 0), {no_result: true});

        console.log("Checking stringnull_constraints");
        testdata1 = {value: 0};
        testdata2 = {value: null};
        result1 = validate(testdata1, {value: JSPLib.validate.stringnull_constraints});
        result2 = validate(testdata2, {value: JSPLib.validate.stringnull_constraints});
        TestPrint(`Object ${repr(testdata1)} should have 1 validation error`, RecordResult(GetValidationLength(result1) === 1), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should have 0 validation errors`, RecordResult(GetValidationLength(result2) === 0), {no_result: true});

        console.log("Checking tagentryarray_constraints");
        testdata1 = {value: null};
        testdata2 = {value: [["tag", 0]]};
        result1 = validate(testdata1, {value: JSPLib.validate.tagentryarray_constraints()});
        result2 = validate(testdata2, {value: JSPLib.validate.tagentryarray_constraints()});
        result3 = validate(testdata2, {value: JSPLib.validate.tagentryarray_constraints([1])});
        TestPrint(`Object ${repr(testdata1)} should have 1 validation error`, RecordResult(GetValidationLength(result1) === 1), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should have 0 validation errors`, RecordResult(GetValidationLength(result2) === 0), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} with valid tag categories [1] should have 1 validation error`, RecordResult(GetValidationLength(result3) === 1), {no_result: true});

        console.log("Checking hashentry_constraints");
        testdata1 = {value: null};
        testdata2 = {value: {}, expires: 0};
        result1 = validate(testdata1, JSPLib.validate.hashentry_constraints);
        result2 = validate(testdata2, JSPLib.validate.hashentry_constraints);
        console.log(result1, result2);
        TestPrint(`Object ${repr(testdata1)} should have 2 validation error`, RecordResult(GetValidationLength(result1) === 2), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should have 0 validation errors`, RecordResult(GetValidationLength(result2) === 0), {no_result: true});

        console.log("Checking arrayentry_constraints");
        testdata1 = {expires: -1};
        testdata2 = {value: [], expires: 0};
        result1 = validate(testdata1, JSPLib.validate.arrayentry_constraints());
        result2 = validate(testdata2, JSPLib.validate.arrayentry_constraints({maximum: 1}));
        console.log(result1, result2);
        TestPrint(`Object ${repr(testdata1)} should have 2 validation errors`, RecordResult(GetValidationLength(result1) === 2), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should have 0 validation errors`, RecordResult(GetValidationLength(result2) === 0), {no_result: true});

        console.log("Checking validateIsHash");
        testdata1 = [];
        testdata2 = {};
        result1 = JSPLib.validate.validateIsHash('test', testdata1);
        result2 = JSPLib.validate.validateIsHash('test', testdata2);
        TestPrint(`Object ${repr(testdata1)} should return false`, RecordResult(result1 === false), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should return true`, RecordResult(result2 === true), {no_result: true});

        console.log("Checking validateIsArray");
        testdata1 = {};
        testdata2 = [1, 2, 3];
        result1 = JSPLib.validate.validateIsArray('test', testdata1, 3);
        result2 = JSPLib.validate.validateIsArray('test', testdata2, 3);
        TestPrint(`Object ${repr(testdata1)} should return false`, RecordResult(result1 === false), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should return true`, RecordResult(result2 === true), {no_result: true});

        console.log("Checking validateHashEntries");
        testdata1 = {value: 5, expires: true};
        testdata2 = {value: [1, 2, 3, 4], expires: 0};
        validator1 = JSPLib.validate.arrayentry_constraints({is: 4});
        result1 = JSPLib.validate.validateHashEntries('test', testdata1, validator1);
        result2 = JSPLib.validate.validateHashEntries('test', testdata2, validator1);
        TestPrint(`Object ${repr(testdata1)} should return false`, RecordResult(result1 === false), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should return true`, RecordResult(result2 === true), {no_result: true});
    }

    console.log("Checking validateArrayValues");
    testdata1 = [-1, -2, 3, 4];
    testdata2 = [1, 2, 3, 4];
    let testdata3 = ["one", "two", "three", "four"];
    let testdata4 = [1.2, 1.5];
    let testdata5 = [null, null];
    result1 = JSPLib.validate.validateArrayValues('test', testdata1, JSPLib.validate.basic_integer_validator);
    result2 = JSPLib.validate.validateArrayValues('test', testdata2, JSPLib.validate.basic_ID_validator);
    result3 = JSPLib.validate.validateArrayValues('test', testdata3, JSPLib.validate.basic_stringonly_validator);
    result4 = JSPLib.validate.validateArrayValues('test', testdata4, JSPLib.validate.basic_number_validator);
    let result5 = JSPLib.validate.validateArrayValues('test', testdata5, JSPLib.validate.basic_stringonly_validator);
    TestPrint(`Object ${repr(testdata1)} should be all integers`, RecordResult(result1), {no_result: true});
    TestPrint(`Object ${repr(testdata2)} should be all IDs`, RecordResult(result2), {no_result: true});
    TestPrint(`Object ${repr(testdata3)} should be all strings`, RecordResult(result3), {no_result: true});
    TestPrint(`Object ${repr(testdata4)} should be all numbers`, RecordResult(result4), {no_result: true});
    TestPrint(`Object ${repr(testdata5)} is not all strings`, RecordResult(!result5), {no_result: true});

    console.log("Checking correctArrayValues");
    testdata1 = [-1, -2, 3, 4];
    testdata2 = ["one", "two", "three", "four"];
    result1 = JSPLib.validate.correctArrayValues('test', testdata1, JSPLib.validate.basic_ID_validator);
    result2 = JSPLib.validate.correctArrayValues('test', testdata2, JSPLib.validate.basic_stringonly_validator);
    JSPLib.utility.concat(result1, result2).forEach((message) => {console.log(message);});
    TestPrint(`Object ${repr(testdata1)} should have two corrections`, RecordResult(result1.length === 2), {no_result: true});
    TestPrint(`Object ${repr(testdata2)} should have no corrections`, RecordResult(result2.length === 0), {no_result: true});

    console.log("Checking validateHashValues");
    testdata1 = {a: -1, b: -2, c: 3, d: 4};
    testdata2 = {a: 1, b: 2, c: 3, d: 4};
    testdata3 = {a: "one", b: "two", c: "three", d: "four"};
    testdata4 = {a: null, b: null, c: null, d: null};
    result1 = JSPLib.validate.validateHashValues('test', testdata1, JSPLib.validate.basic_integer_validator);
    result2 = JSPLib.validate.validateHashValues('test', testdata2, JSPLib.validate.basic_ID_validator);
    result3 = JSPLib.validate.validateHashValues('test', testdata3, JSPLib.validate.basic_stringonly_validator);
    result4 = JSPLib.validate.validateHashValues('test', testdata4, JSPLib.validate.basic_stringonly_validator);
    TestPrint(`Object ${repr(testdata1)} should be all integers`, RecordResult(result1), {no_result: true});
    TestPrint(`Object ${repr(testdata2)} should be all IDs`, RecordResult(result2), {no_result: true});
    TestPrint(`Object ${repr(testdata3)} should be all strings`, RecordResult(result3), {no_result: true});
    TestPrint(`Object ${repr(testdata4)} is not all strings`, RecordResult(!result4), {no_result: true});

    console.log("Checking isHash");
    testdata1 = [];
    testdata2 = {};
    result1 = JSPLib.validate.isHash(testdata1);
    result2 = JSPLib.validate.isHash(testdata2);
    TestPrint(`Value of ${testdata1} should not be a hash`, RecordResult(result1 === false), {no_result: true});
    TestPrint(`Value of ${testdata2} should be a hash`, RecordResult(result2 === true), {no_result: true});

    console.log("Checking isBoolean");
    testdata2 = true;
    result1 = JSPLib.validate.isBoolean(testdata1);
    result2 = JSPLib.validate.isBoolean(testdata2);
    TestPrint(`Value of ${testdata1} should not be a boolean`, RecordResult(result1 === false), {no_result: true});
    TestPrint(`Value of ${testdata2} should be a boolean`, RecordResult(result2 === true), {no_result: true});

    console.log("Checking isString");
    testdata2 = "test";
    result1 = JSPLib.validate.isString(testdata1);
    result2 = JSPLib.validate.isString(testdata2);
    TestPrint(`Value of ${testdata1} should not be a string`, RecordResult(result1 === false), {no_result: true});
    TestPrint(`Value of ${testdata2} should be a string`, RecordResult(result2 === true), {no_result: true});

    console.log("Checking isNumber");
    testdata2 = 22.2;
    result1 = JSPLib.validate.isNumber(testdata1);
    result2 = JSPLib.validate.isNumber(testdata2);
    TestPrint(`Value of ${testdata1} should not be a string`, RecordResult(result1 === false), {no_result: true});
    TestPrint(`Value of ${testdata2} should be a string`, RecordResult(result2 === true), {no_result: true});

    console.log("Checking validateID");
    testdata1 = 1234;
    result1 = JSPLib.validate.validateID(testdata1);
    result2 = JSPLib.validate.validateID(testdata2);
    TestPrint(`Record ID of ${testdata1} should be valid`, RecordResult(result1 === true), {no_result: true});
    TestPrint(`Record ID of ${testdata2} should be invalid`, RecordResult(result2 === false), {no_result: true});

    console.log("Checking validateIDList");
    testdata1 = [1, 2, 3, 4];
    testdata2 = [1, 'a', -1, null];
    result1 = JSPLib.validate.validateIDList(testdata1);
    result2 = JSPLib.validate.validateIDList(testdata2);
    TestPrint(`Record ID of ${testdata1} should be valid`, RecordResult(result1 === true), {no_result: true});
    TestPrint(`Record ID of ${testdata2} should be invalid`, RecordResult(result2 === false), {no_result: true});

    console.log(`CheckValidateLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

async function CheckStorageLibrary() {
    console.log("++++++++++++++++++++CheckStorageLibrary++++++++++++++++++++");
    console.log("Start time:", JSPLib.utility.getProgramTime());
    ResetResult();

    console.log("Checking global variables");
    TestPrint(`use_local_storage should be ${ShowEnabled(test_local_storage)}`, RecordResult(JSPLib.storage.use_local_storage === test_local_storage), {no_result: true});
    TestPrint(`use_indexed_db should be ${ShowEnabled(test_indexed_db)}`, RecordResult(JSPLib.storage.use_indexed_db === test_indexed_db), {no_result: true});
    TestPrint(`use_storage should be ${ShowEnabled(test_storage)}`, RecordResult(JSPLib.storage.use_storage === test_storage), {no_result: true});

    console.log("Checking setStorageData");
    let data1 = ["check this"];
    let data2 = JSON.stringify(data1);
    JSPLib.storage.setSessionData('session-value', data1);
    JSPLib.storage.setLocalData('local-value', data1);
    let result1 = sessionStorage.getItem('session-value');
    let result2 = localStorage.getItem('local-value');
    let memorydata1 = JSPLib.storage.memory_storage.sessionStorage['session-value'];
    let memorydata2 = JSPLib.storage.memory_storage.localStorage['local-value'];
    TestPrint(`session-value stored in sessionStorage as ${repr(result1)} should be equal to the stringified data`, RecordResult(result1 === data2), {result: repr(data1)});
    TestPrint(`session-value stored in memory storage as ${repr(memorydata1)} should be equal to the data`, RecordResult(ArrayEqual(memorydata1, data1)), {result: repr(data1)});
    TestPrint(`local-value stored in localStorage as ${repr(result1)} should be equal to the stringified data`, RecordResult(result2 === data2), {result: repr(data1)});
    TestPrint(`local-value stored in memory storage as ${repr(memorydata2)} should be equal to the data`, RecordResult(ArrayEqual(memorydata2, data1)), {result: repr(data1)});

    console.log("Checking removeStorageData");
    JSPLib.storage.setSessionData('remove-value', 'blah');
    JSPLib.storage.removeSessionData('remove-value');
    result1 = sessionStorage.getItem('remove-value');
    result2 = JSPLib.storage.memory_storage.sessionStorage['remove-value'];
    TestPrint("Removed value should return null", RecordResult(result1 === null), {result: repr(result1)});
    TestPrint("Memory storage value should be undefined", RecordResult(result2 === undefined), {result: repr(result2)});

    console.log("Checking getStorageData");
    data1 = `[check this]`;
    data2 = ["check this"];
    sessionStorage.setItem('bad-value', data1);
    JSPLib.storage.setSessionData('good-value', data2);
    result1 = JSPLib.storage.getSessionData('bad-value');
    result2 = JSPLib.storage.getSessionData('good-value');
    let result3 = JSPLib.storage.getSessionData('nonexistent-value', {default_val: [0]});
    TestPrint(`bad-value with data ${repr(data1)} should return null`, RecordResult(result1 === null), {result: repr(result1)});
    TestPrint(`good-value with data ${repr(data2)} should return value`, RecordResult(result2?.[0] === "check this"), {result: repr(result2)});
    TestPrint("nonexistant-value with default value [0] should return default value", RecordResult(result3?.[0] === 0), {result: repr(result3)});

    console.log("Checking invalidateStorageData");
    data1 = ["check this"];
    JSPLib.storage.setSessionData('memory-value', data1);
    result1 = JSPLib.storage.memory_storage.sessionStorage['memory-value'];
    JSPLib.storage.invalidateSessionData('memory-value');
    result2 = JSPLib.storage.memory_storage.sessionStorage['memory-value'];
    TestPrint("memory-value should not be defined after setting it's value", RecordResult(result1 !== undefined), {result: repr(result1)});
    TestPrint("memory-value should be undefined after invalidating it's value", RecordResult(result2 === undefined), {result: repr(result2)});

    console.log("Checking checkStorageData");
    let validator1 = function () { return true;};
    let validator2 = function () { return false;};
    result1 = JSPLib.storage.checkSessionData('good-value', validator1, sessionStorage);
    delete JSPLib.storage.memory_storage.sessionStorage['good-value'];
    result2 = JSPLib.storage.checkSessionData('good-value', validator2, sessionStorage);
    TestPrint(`good-value with data ${repr(data2)} with good validate should return value`, RecordResult(result1?.[0] === "check this"), {result: repr(result1)});
    TestPrint(`good-value with data ${repr(data2)} with bad validate should return null`, RecordResult(result2 === null), {result: repr(result2)});

    console.log("Checking storage quota exceeded");
    let testvalue = "test".repeat(1000);
    let expectedsize1 = JSON.stringify(sessionStorage).length + JSON.stringify({expires: 1, value: testvalue}).length * 2000;
    for (let i = 0; i < 2000; i++) {
        JSPLib.storage.setStorageData('test' + i, {expires: 1, value: testvalue}, sessionStorage);
    }
    let testsize1 = JSON.stringify(sessionStorage).length;
    TestPrint(`expected size of storage ${bracket(expectedsize1)} should be greater than actual size`, RecordResult(expectedsize1 > testsize1), {result: testsize1});
    JSPLib.debug.level = JSPLib.debug.VERBOSE;

    console.log("Checking hasDataExpired");
    let max_expiration1 = 100000;
    let data3 = {expires: Date.now() - max_expiration1, value: data2};
    let data4 = {expires: Date.now() + max_expiration1, value: data2};
    result1 = JSPLib.storage.hasDataExpired("result1", undefined);
    result2 = JSPLib.storage.hasDataExpired("result2", data2);
    result3 = JSPLib.storage.hasDataExpired("result3", data3);
    let result4 = JSPLib.storage.hasDataExpired("result4", data4);
    let result5 = JSPLib.storage.hasDataExpired("result5", data4, 1000);
    TestPrint(`undefined data should have expired`, RecordResult(result1 === true), {result: repr(result1)});
    TestPrint(`data with no expires ${repr(data2)} should have expired`, RecordResult(result2 === true), {result: repr(result2)});
    TestPrint(`data with expires ${repr(data3)} should have expired`, RecordResult(result3 === true), {result: repr(result3)});
    TestPrint(`data with expires ${repr(data4)} should not have expired`, RecordResult(result4 === false), {result: repr(result4)});
    TestPrint(`data with expires ${repr(data4)} should have an expiration that is too long`, RecordResult(result5 === true), {result: repr(result5)});

    console.log("Checking setIndexedSessionData");
    data1 = ["check this"];
    data2 = JSON.stringify(data1);
    JSPLib.storage.setIndexedSessionData('session-value', data1);
    result1 = sessionStorage.getItem('danbooru-storage-session-value');
    memorydata1 = JSPLib.storage.memory_storage.sessionStorage['danbooru-storage-session-value'];
    TestPrint(`Indexed session-value stored in sessionStorage as ${repr(data2)} should be equal to the stringified data`, RecordResult(result1 === data2), {result: repr(result1)});
    TestPrint(`Indexed session-value stored in memory storage as ${repr(data1)} should be equal to the data`, RecordResult(ArrayEqual(memorydata1, data1)), {result: repr(memorydata1)});

    console.log("Checking removeIndexedSessionData");
    JSPLib.storage.setStorageData('danbooru-storage-remove-value', 'blah', sessionStorage);
    JSPLib.storage.removeIndexedSessionData('remove-value');
    result1 = sessionStorage.getItem('danbooru-storage-remove-value');
    result2 = JSPLib.storage.memory_storage.sessionStorage['danbooru-storage-remove-value'];
    TestPrint('Removed value should return null', RecordResult(result1 === null), {result: repr(result1)});
    TestPrint('Memory storage value should be undefined', RecordResult(result2 === undefined), {result: repr(result2)});

    console.log("Checking getIndexedSessionData");
    data1 = `[check this]`;
    data2 = ["check this"];
    sessionStorage.setItem('danbooru-storage-bad-value', data1);
    JSPLib.storage.setStorageData('danbooru-storage-good-value', data2, sessionStorage);
    result1 = JSPLib.storage.getIndexedSessionData('bad-value');
    result2 = JSPLib.storage.getIndexedSessionData('good-value');
    result3 = JSPLib.storage.getIndexedSessionData('nonexistent-value', {default_val: [0]});
    TestPrint(`bad-value with data ${repr(data1)} should return null`, RecordResult(result1 === null), {result: repr(result1)});
    TestPrint(`good-value with data ${repr(data2)} should return value`, RecordResult(result2?.[0] === "check this"), {result: repr(result2)});
    TestPrint('nonexistant-value with default value [0] should return default value', RecordResult(result3?.[0] === 0), {result: repr(result3)});

    console.log("Checking invalidateIndexedSessionData");
    data1 = ["check this"];
    JSPLib.storage.setIndexedSessionData('memory-value', data1);
    result1 = JSPLib.storage.memory_storage.sessionStorage['danbooru-storage-memory-value'];
    JSPLib.storage.invalidateIndexedSessionData('memory-value');
    result2 = JSPLib.storage.memory_storage.sessionStorage['danbooru-storage-memory-value'];
    TestPrint("memory-value should not be defined after setting it's value", RecordResult(result1 !== undefined), {result: repr(result1)});
    TestPrint("memory-value should be undefined after invalidating it's value", RecordResult(result2 === undefined), {result: repr(result2)});

    //For checking library with/without localforage installed
    if (JSPLib.storage.use_storage) {
        console.log("Checking saveData");
        await JSPLib.storage.saveData('good-value', data2);
        result1 = JSPLib.storage.getIndexedSessionData('good-value');
        result2 = await JSPLib.storage.danboorustorage.getItem('good-value');
        TestPrint(`good-value with data ${repr(data2)} should return value (sessionStorage)`, RecordResult(result1?.[0] === "check this"), {result: repr(result1)});
        TestPrint(`good-value with data ${repr(data2)} should return value (indexedDB)`, RecordResult(result2?.[0] === "check this"), {result: repr(result2)});

        console.log("Checking retrieveData");
        sessionStorage.removeItem('bad-value');
        await JSPLib.storage.danboorustorage.removeItem('bad-value');
        result1 = await JSPLib.storage.retrieveData('bad-value');
        result2 = await JSPLib.storage.retrieveData('good-value');
        JSPLib.storage.removeIndexedSessionData('good-value');
        result3 = await JSPLib.storage.retrieveData('good-value');
        TestPrint(`bad-value with no entry should return null`, RecordResult(result1 === null), {result: repr(result1)});
        TestPrint(`good-value with data ${repr(data1)} should return value (sessionStorage)`, RecordResult(result2?.[0] === "check this"), {result: repr(result2)});
        TestPrint(`good-value with data ${repr(data1)} should return value (indexedDB)`, RecordResult(result3?.[0] === "check this"), {result: repr(result3)});

        console.log("Checking removeData");
        JSPLib.storage.removeData('good-value');
        result1 = JSPLib.storage.getIndexedSessionData('good-value');
        result2 = await JSPLib.storage.danboorustorage.getItem('good-value');
        TestPrint(`good-value with data deleted should return null (sessionStorage)`, RecordResult(result1 === null), {result: repr(result1)});
        TestPrint(`good-value with data deleted should return null (indexedDB)`, RecordResult(result2 === null), {result: repr(result2)});

        console.log("Checking checkLocalDB");
        let data5 = {expires: 0, value: data2};
        await JSPLib.storage.saveData('expired-value', data3);
        await JSPLib.storage.saveData('good-value', data4);
        await JSPLib.storage.saveData('persistent-value', data5);
        result1 = await JSPLib.storage.checkLocalDB('expired-value', max_expiration1, {validator: validator1});
        result2 = await JSPLib.storage.checkLocalDB('good-value', max_expiration1, {validator: validator2});
        result3 = await JSPLib.storage.checkLocalDB('good-value', max_expiration1, {validator: validator1});
        result4 = await JSPLib.storage.checkLocalDB('persistent-value', max_expiration1, {validator: validator1});
        TestPrint(`expired-value with data ${repr(data3)} should return null`, RecordResult(result1 === null), {result: repr(result1)});
        TestPrint(`good-value with data ${repr(data4)} with false validation should return null`, RecordResult(result2 === null), {result: repr(result2)});
        TestPrint(`good-value with data ${repr(data4)} with true validation should return value`, RecordResult(result3?.value?.[0] === "check this"), {result: repr(result3)});
        TestPrint(`persistent-value with data ${repr(data5)} should return value`, RecordResult(result4?.expires === 0 && result4?.value?.[0] === "check this"), {result: repr(result4)});

        console.log("Checking batchSaveData");
        let value1 = {expires: 0, value: 1};
        let value2 = {expires: 0, value: true};
        let batchdata1 = {value1, value2};
        await JSPLib.storage.batchSaveData(batchdata1);
        result1 = JSPLib.storage.getIndexedSessionData('value1');
        result2 = JSPLib.storage.getIndexedSessionData('value2');
        result3 = await JSPLib.storage.danboorustorage.getItem('value1');
        result4 = await JSPLib.storage.danboorustorage.getItem('value2');
        TestPrint(`value1 with data ${repr(value1)} should return value (sessionStorage)`, RecordResult(result1?.value === 1), {result: repr(result1)});
        TestPrint(`value2 with data ${repr(value2)} should return value (sessionStorage)`, RecordResult(result2?.value === true), {result: repr(result2)});
        TestPrint(`value1 with data ${repr(value1)} should return value (indexedDB)`, RecordResult(result3?.value === 1), {result: repr(result3)});
        TestPrint(`value2 with data ${repr(value2)} should return value (indexedDB)`, RecordResult(result4?.value === true), {result: repr(result4)});

        console.log("Checking batchRetrieveData");
        let keylist1 = ['value1', 'value2', 'value3'];
        let keylist2 = ['value1', 'value2'];
        keylist1.forEach((key) => {
            JSPLib.storage.removeIndexedSessionData(key);
        });
        result1 = await JSPLib.storage.batchRetrieveData(keylist1);
        result2 = Object.keys(result1);
        TestPrint(`Batch retrieval of ${repr(keylist1)} should return the keys ${repr(keylist2)}`, RecordResult(ArrayEqual(keylist2, result2)), {result: repr(result2)});
        TestPrint(`value1 with data ${repr(value1)} should return value`, RecordResult(result1.value1?.value === 1), {result: repr(result1.value1)});
        TestPrint(`value2 with data ${repr(value2)} should return value`, RecordResult(result1.value2?.value === true), {result: repr(result1.value2)});

        console.log("Checking batchCheckLocalDB");
        keylist1.forEach((key) => {
            JSPLib.storage.removeIndexedSessionData(key);
        });
        result1 = await JSPLib.storage.batchCheckLocalDB(keylist1, null, {validator: () => (true)});
        result2 = Object.keys(result1);
        TestPrint(`Batch retrieval of ${repr(keylist1)} should return the keys ${repr(keylist2)}`, RecordResult(ArrayEqual(keylist2, result2)), {result: repr(result2)});
        TestPrint(`value1 with data ${repr(value1)} should return value`, RecordResult(result1.value1?.value === 1), {result: repr(result1.value1)});
        TestPrint(`value2 with data ${repr(value2)} should return value`, RecordResult(result1.value2?.value === true), {result: repr(result1.value2)});

        console.log("Checking batchRemoveData");
        await JSPLib.storage.batchRemoveData(keylist2);
        result1 = JSPLib.storage.getIndexedSessionData('value1');
        result2 = JSPLib.storage.getIndexedSessionData('value2');
        result3 = await JSPLib.storage.danboorustorage.getItem('value1');
        result4 = await JSPLib.storage.danboorustorage.getItem('value2');
        TestPrint("value1 should return null (sessionStorage)", RecordResult(result1 === null), {result: repr(result1)});
        TestPrint("value2 should return null (sessionStorage)", RecordResult(result2 === null), {result: repr(result2)});
        TestPrint("value1 should return null (indexedDB)", RecordResult(result3 === null), {result: repr(result3)});
        TestPrint("value2 should return null (indexedDB)", RecordResult(result4 === null), {result: repr(result4)});

        console.log("Checking pruneCache");
        await JSPLib.storage.pruneCache(/-value$/);
        result1 = await JSPLib.storage.retrieveData('expired-value');
        result2 = await JSPLib.storage.retrieveData('good-value');
        TestPrint("expired-value should be pruned and return null with retrieveData", RecordResult(result1 === null), {result: repr(result1)});
        TestPrint("good-value shouldn't be pruned and return value with retrieveData", RecordResult(result2?.value?.[0] === "check this"), {result: repr(result2)});

        console.log("Checking pruneProgramCache");
        await JSPLib.storage.saveData('expired-value', data3);
        await JSPLib.storage.saveData('good-value', data4);
        await JSPLib.storage.pruneProgramCache('cl', /-value$/, JSPLib.utility.one_minute);
        result1 = await JSPLib.storage.retrieveData('expired-value');
        result2 = await JSPLib.storage.retrieveData('good-value');
        TestPrint("expired-value should be pruned and return null with retrieveData", RecordResult(result1 === null), {result: repr(result1)});
        TestPrint("good-value shouldn't be pruned and return value with retrieveData", RecordResult(result2?.value?.[0] === "check this"), {result: repr(result2)});

        console.log("Checking purgeCache");
        await JSPLib.storage.saveData('expired-value', data3);
        await JSPLib.storage.saveData('good-value', data4);
        await JSPLib.storage.purgeCache(/^(good|expired|persistent)-value$/, "#checklibrary-count");
        result1 = await JSPLib.storage.retrieveData('expired-value');
        result2 = await JSPLib.storage.retrieveData('good-value');
        result3 = await JSPLib.storage.retrieveData('persistent-value');
        TestPrint("expired-value should be pruned and return null with retrieveData", RecordResult(result1 === null), {result: repr(result1)});
        TestPrint("good-value should be pruned and return null with retrieveData", RecordResult(result2 === null), {result: repr(result2)});
        TestPrint("persistent-value should be pruned and return null with retrieveData", RecordResult(result3 === null), {result: repr(result3)});

        console.log("Checking programCacheInfo");
        await JSPLib.storage.saveData('expired-value', data3);
        await JSPLib.storage.saveData('good-value', data4);
        result1 = await JSPLib.storage.programCacheInfo('cl', /^(good|expired)-value$/);
        result2 = Object.keys(result1);
        TestPrint("Cache info should have 3 storage keys", RecordResult(ArrayEqual(result2, ['index', 'session', 'local'], false)), {result: result2});
        TestPrint("Cache info should have 2 Index DB items", RecordResult(result1.index.program_items === 2), {result: result1.index.program_items});
        TestPrint("Cache info should have 2 session storage items", RecordResult(result1.session.program_items === 2), {result: result1.session.program_items});
        TestPrint("Cache info should have 1 local storage items", RecordResult(result1.local.program_items === 1), {result: result1.local.program_items});
    }

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
    let result1 = JSPLib.concurrency.reserveSemaphore('cl', 'test');
    let result2 = JSPLib.storage.getStorageData(key1, localStorage);
    console.log(JSPLib._window);
    let result3 = JSPLib.utility.isNamespaceBound(JSPLib._window, 'beforeunload', key2);
    TestPrint(`Semaphore ${result1} should be equal to saved data`, RecordResult(result1 === result2), {result: result2});
    TestPrint("Before unload event should have been created", RecordResult(result3 === true), {result: result3});

    console.log("Checking checkSemaphore");
    result1 = JSPLib.concurrency.checkSemaphore('cl', 'test');
    TestPrint("Semaphore should not be available", RecordResult(result1 === false), {result: result1});

    console.log("Checking freeSemaphore");
    JSPLib.concurrency.freeSemaphore('cl', 'test');
    result1 = JSPLib.concurrency.checkSemaphore('cl', 'test');
    result2 = JSPLib.utility.isNamespaceBound(JSPLib._window, 'beforeunload', key2);
    TestPrint("Semaphore should be available", RecordResult(result1 === true), {result: result1});
    TestPrint("Before unload event should have been cleared", RecordResult(result2 === false), {result: result2});

    console.log("Checking checkTimeout");
    let key3 = 'cl-timeout';
    let expiration1 = JSPLib.utility.one_second * 10;
    result1 = JSPLib.concurrency.checkTimeout(key3, expiration1);
    TestPrint("Timeout should be not set / expired", RecordResult(result1 === true), {result: result1});

    console.log("Checking setRecheckTimeout");
    JSPLib.concurrency.setRecheckTimeout(key3, expiration1);
    result1 = JSPLib.concurrency.checkTimeout(key3, expiration1);
    TestPrint("Timeout should be set and unexpired", RecordResult(result1 === false), {result: result1});

    console.log("Checking _getSelectorChecks");
    let string1 = 'span';
    let string2 = '.class';
    let string3 = '#id';
    let string4 = '##text';
    let checkarray1 = ['tagName', 'SPAN'];
    let checkarray2 = ['className', 'class'];
    let checkarray3 = ['id', 'id'];
    let checkarray4 = ['nodeName', '#text'];
    let testarray1 = JSPLib.concurrency._getSelectorChecks(string1);
    let testarray2 = JSPLib.concurrency._getSelectorChecks(string2);
    let testarray3 = JSPLib.concurrency._getSelectorChecks(string3);
    let testarray4 = JSPLib.concurrency._getSelectorChecks(string4);
    TestPrint(`Selector ${repr(string1)} should return the values ${repr(checkarray1)}`, RecordResult(ArrayEqual(testarray1, checkarray1)), {result: repr(testarray1)});
    TestPrint(`Selector ${repr(string2)} should return the values ${repr(checkarray2)}`, RecordResult(ArrayEqual(testarray2, checkarray2)), {result: repr(testarray2)});
    TestPrint(`Selector ${repr(string3)} should return the values ${repr(checkarray3)}`, RecordResult(ArrayEqual(testarray3, checkarray3)), {result: repr(testarray3)});
    TestPrint(`Selector ${repr(string4)} should return the values ${repr(checkarray4)}`, RecordResult(ArrayEqual(testarray4, checkarray4)), {result: repr(testarray4)});

    console.log("Checking setupMutationReplaceObserver");
    jQuery("#checklibrary-count").after('<span id="checklibrary-observe"></span>');
    string1 = 'nothing';
    string2 = 'something';
    let value1 = string1;
    JSPLib.concurrency.setupMutationReplaceObserver("footer", "#checklibrary-observe", () => {console.log("Observation found!");value1 = string2;});
    jQuery("#checklibrary-observe").replaceWith('<span id="checklibrary-observe" style="font-size:200%">(Observed)</span>');
    await JSPLib.utility.sleep(1000);
    TestPrint(`Value ${repr(value1)} should be equal to ${repr(string2)}`, RecordResult(value1 === string2), {no_result: true});

    console.log("Checking whenScrolledIntoView");
    let selector1 = '#app-name-header';
    let testvalue1 = null;
    let testvalue2 = 'seen';
    let setvalue1 = testvalue1;
    JSPLib.concurrency.whenScrolledIntoView(selector1).then(() => {
        console.log("!!SCROLLED INTO VIEW!!");
        setvalue1 = testvalue2;
    });
    await JSPLib.utility.sleep(100);
    console.log("==BEFORE SCROLL==");
    let checkvalue1 = setvalue1;
    window.scroll(0, 0);
    await JSPLib.utility.sleep(100);
    console.log("==AFTER SCROLL==");
    let checkvalue2 = setvalue1;
    TestPrint(`Selector ${repr(selector1)} should not be visibile initially`, RecordResult(checkvalue1 === testvalue1), {result: repr(checkvalue1)});
    TestPrint(`Selector ${repr(selector1)} should visibile after scrolling`, RecordResult(checkvalue2 === testvalue2), {result: repr(checkvalue2)});
    window.scroll(0, 10000);

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
        console.log("Checking getData");
        let size1 = 8687;
        let type1 = "image/jpeg";
        let resp1 = await JSPLib.network.getData(PREVIEW_URL);
        let boolarray1 = [typeof resp1 === "object" && resp1.constructor.name === "Blob"];
        if(boolarray1[0]) boolarray1.push(resp1.size === size1);
        if(boolarray1[0]) boolarray1.push(resp1.type === type1);
        TestPrint(`Image with URL ${PREVIEW_URL} should be blob with size ${size1} and type ${type1}`, RecordResult(boolarray1.every((val) => val)), {result: repr(boolarray1)});

        console.log("Checking getDataSize");
        size1 = 8687;
        resp1 = await JSPLib.network.getDataSize(PREVIEW_URL);
        TestPrint(`Image with URL ${PREVIEW_URL} should get the image size of ${size1}`, RecordResult(resp1 === size1), {result: resp1});
    } else {
        console.log("Skipping GM.xmlHttpRequest tests...");
    }

    console.log("Checking installXHRHook");
    let builtinXhrFn = JSPLib._window.XMLHttpRequest;
    let url1 = '/users';
    let addons1 = {search: {id: '1'}, limit: 1, only: 'id,name'};
    let found1 = false;
    JSPLib.network.installXHRHook([
        (data) => {
            if (Array.isArray(data) && data.length === 1 && data[0].id === 1) {
                TestPrint(`With URL ${url1} and addons ${repr(addons1)}, a single user record of user #1 should have been returned`, RecordResult(data[0].name === "albert"), {result: repr(data)});
                found1 = true;
            }
        }
    ]);
    await JSPLib.network.getJSON(url1, {data: addons1});
    JSPLib._window.XMLHttpRequest = builtinXhrFn;
    await JSPLib.utility.sleep(1000);
    if (!found1) {
        TestPrint('installXHRHook test failed', RecordResult(false), {no_result: true});
    }

    console.log("Checking incrementCounter");
    JSPLib.network.counter_domname = "#checklibrary-count";
    await JSPLib.utility.sleep(2000);
    let result1 = JSPLib.network.num_network_requests;
    JSPLib.network.incrementCounter('network');
    let result2 = JSPLib.network.num_network_requests;
    TestPrint(`The counter should have incremented by 1 from ${repr(result1)}`, RecordResult((result2 - result1) === 1), {result: repr(result2)});

    console.log("Checking decrementCounter");
    await JSPLib.utility.sleep(2000);
    result1 = JSPLib.network.num_network_requests;
    JSPLib.network.decrementCounter('network');
    result2 = JSPLib.network.num_network_requests;
    TestPrint(`The counter should have decremented by 1 from ${repr(result1)}`, RecordResult((result1 - result2) === 1), {result: repr(result2)});

    console.log("Checking rateLimit"); //Visual confirmation required
    JSPLib.network.num_network_requests = JSPLib.network.max_network_requests;
    RateLimit('network');
    await JSPLib.utility.sleep(5000);
    JSPLib.network.num_network_requests = 0;
    await JSPLib.utility.sleep(2000);

    console.log("Checking processError");
    let error1 = {status: 502};
    let baderror1 = {status: 999, responseText: "Bad error code!"};
    result1 = JSPLib.network.processError(error1, "CheckNetworkLibrary");
    TestPrint(`The error ${repr(error1)} should be processed to ${repr(error1)}`, RecordResult(result1.status === baderror1.status && result1.responseText === baderror1.responseText), {result: repr(result1)});

    console.log("Checking logError");
    JSPLib.network.error_domname = "#checklibrary-error";
    let num_errors = JSPLib.network.error_messages.length;
    error1 = {status: 403, responseText: 'Bad redirect!'};
    result1 = JSPLib.network.logError(error1, 'processError');
    TestPrint('Should have one error logged', RecordResult((JSPLib.network.error_messages.length - num_errors) === 1), {result: JSPLib.network.error_messages.length});

    console.log("Checking notifyError"); //Visual confirmation required
    error1 = {status: 502, responseText: '<!doctype html>'};
    JSPLib.network.notifyError(error1);
    await JSPLib.utility.sleep(4000);
    jQuery("#close-notice-link").click();
    await JSPLib.utility.sleep(2000);

    console.log("Checking getNotify"); //Visual confirmation required
    url1 = "/bad_url";
    await JSPLib.network.getNotify(url1, {custom_error: "Unable to get bad URL!"});
    await JSPLib.utility.sleep(4000);
    jQuery("#close-notice-link").click();
    await JSPLib.utility.sleep(2000);

    console.log("Checking get");
    url1 = "/static/contact";
    let options1 = null;
    let resp = JSPLib.network.get(url1, {type: 'html', ajax_options: {beforeSend: (jqXHR, settings) => (options1 = settings)}});
    let html = await resp;
    let $html = jQuery(html);
    let dom1 = $html.find('#c-static #a-contact');
    TestPrint('Method should be GET', RecordResult(options1.type === 'GET'), {result: options1.type});
    TestPrint('Response code should be 200', RecordResult(resp.status === 200), {result: resp.status});
    TestPrint('Response data should be a string', RecordResult(typeof html === "string"), {result: typeof html});
    TestPrint('HTML should contain the correct structures', RecordResult(dom1.length === 1), {result: dom1.length});

    console.log("Checking post");
    url1 = "/static/contact";
    options1 = null;
    resp = JSPLib.network.post(url1, {data: {_method: 'get'}, type: 'html', ajax_options: {beforeSend: (jqXHR, settings) => (options1 = settings)}});
    html = await resp;
    $html = jQuery(html);
    dom1 = $html.find('#c-static #a-contact');
    TestPrint('Method should be POST', RecordResult(options1.type === 'POST'), {result: options1.type});
    TestPrint('Response code should be 200', RecordResult(resp.status === 200), {result: resp.status});
    TestPrint('Response data should be a string', RecordResult(typeof html === "string"), {result: typeof html});
    TestPrint('HTML should contain the correct structures', RecordResult(dom1.length === 1), {result: dom1.length});

    console.log("Checking getJSON");
    url1 = "/posts/1.json";
    options1 = null;
    resp = JSPLib.network.getJSON(url1, {ajax_options: {beforeSend: (jqXHR, settings) => (options1 = settings)}});
    let json1 = await resp;
    TestPrint('Method should be GET', RecordResult(options1.type === 'GET'), {result: options1.type});
    TestPrint('Response code should be 200', RecordResult(resp.status === 200), {result: resp.status});
    TestPrint('Response data should be a hash', RecordResult(HashCheck(json1)), {result: typeof json1});
    TestPrint('JSON should contain the correct structures', RecordResult(json1?.id === 1 & json1?.md5 === 'd34e4cf0a437a5d65f8e82b7bcd02606'), {result: json1});

    console.log("Checking getScript");
    url1 = "https://cdn.jsdelivr.net/gh/jquery/jquery-ui@1.12.1/ui/widgets/tabs.js";
    let state1 = typeof jQuery.ui.tabs;
    options1 = null;
    resp = JSPLib.network.getScript(url1, {ajax_options: {beforeSend: (jqXHR, settings) => (options1 = settings)}});
    await resp;
    await JSPLib.utility.sleep(200);
    let state2 = typeof jQuery.ui.tabs;
    TestPrint('Method should be GET', RecordResult(options1.type === 'GET'), {result: options1.type});
    TestPrint('Response code should be 200', RecordResult(resp.status === 200), {result: resp.status});
    TestPrint('Initial state of jQuery tabs should be undefined', RecordResult(state1 === "undefined"), {result: state1});
    TestPrint('Subsequent state of jQuery tabs should be a function', RecordResult(state2 === "function"), {result: state2});

    console.log(`CheckNetworkLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

async function CheckDanbooruLibrary() {
    console.log("++++++++++++++++++++CheckDanbooruLibrary++++++++++++++++++++");
    console.log("Start time:", JSPLib.utility.getProgramTime());
    ResetResult();

    console.log("Checking getNextPageID");
    let array1 = [{id: 25}, {id: 26}, {id: 27}];
    let result1 = JSPLib.danbooru.getNextPageID(array1, false);
    let result2 = JSPLib.danbooru.getNextPageID(array1, true);
    TestPrint(`for item array ${repr(array1)}, the next page ID going in forward should be 25`, RecordResult(result1 === 25), {result: result1});
    TestPrint(`for item array ${repr(array1)}, the next page ID going in reverse should be 27`, RecordResult(result2 === 27), {result: result2});

    console.log("Checking getShortName");
    result1 = JSPLib.danbooru.getShortName('copyright');
    result2 = JSPLib.danbooru.getShortName('general');
    let result3 = JSPLib.danbooru.getShortName('artist');
    let result4 = JSPLib.danbooru.getShortName('character');
    TestPrint("the short name for copyright should be copy", RecordResult(result1 === 'copy'), {result: result1});
    TestPrint("the short name for general should be gen", RecordResult(result2 === 'gen'), {result: result2});
    TestPrint("the short name for artist should be art", RecordResult(result3 === 'art'), {result: result2});
    TestPrint("the short name for character should be char", RecordResult(result4 === 'char'), {result: result2});

    console.log("Checking randomDummyTag");
    let string1 = JSPLib.danbooru.randomDummyTag();
    let string2 = "notadummytag";
    let regex1 = /^dummytag-[0-9a-z]{8}$/;
    result1 = string1.match(regex1);
    result2 = string2.match(regex1);
    TestPrint(`the string ${repr(string1)} should be a dummy tag`, RecordResult(!!result1), {result: result1});
    TestPrint(`the string ${repr(string2)} should not be a dummy tag`, RecordResult(!result2), {result: result2});

    console.log("Checking tagOnlyRegExp");
    string1 = "character_(qualifier)";
    string2 = "qualifier";
    regex1 = JSPLib.danbooru.tagOnlyRegExp(string1);
    let regex2 = /^character_\(qualifier\)$/i;
    result1 = string1.match(regex1);
    TestPrint(`the tag ${repr(string1)} should produce the regex ${String(regex2)}`, RecordResult(String(regex1) === String(regex2)), {result: String(regex1)});
    TestPrint(`the regex ${String(regex1)} should find one match in the string ${repr(string1)}`, RecordResult(result1?.[0] === string1), {result: repr(result1)});

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
        regex2 = RegExp('(?<=(?:^|\\s))aliased\\:_the_tag(?=(?:$|\\s))', 'gi');
        let regex3 = JSPLib.danbooru.tagRegExp(string5);
        result1 = string1.match(regex1);
        result2 = string1.replace(regex1, string3);
        result3 = string1.match(regex3);
        result4 = string4.match(regex3);
        TestPrint(`the tag ${repr(string2)} should produce the regex ${String(regex2)}`, RecordResult(String(regex1) === String(regex2)), {result: String(regex1)});
        TestPrint(`the regex ${String(regex1)} should find two matches in the string ${repr(string1)}`, RecordResult(result1?.[0] === string2), {result: result1});
        TestPrint(`the regex ${String(regex1)} should replace the tag ${repr(string2)} with ${repr(string3)} in the string ${repr(string1)}`, RecordResult(result2 === "1girl solo alias_tag standing alias_tag character_(qualifier) short_hair"), {result: result2});
        TestPrint(`the regex ${String(regex3)} should find no matches in the string ${repr(string1)}`, RecordResult(result3 === null), {result: result3});
        TestPrint(`the regex ${String(regex3)} should find one match in the string ${repr(string4)}`, RecordResult(result4?.[0] === string5), {result: result4});
    }

    console.log("Checking postSearchLink");
    string1 = "1girl solo";
    string2 = "Check this link";
    let option1 = `class="search-tag"`;
    let string3 = '<a class="search-tag" href="/posts?tags=1girl+solo">Check this link</a>';
    result1 = JSPLib.danbooru.postSearchLink(string1, string2, option1);
    TestPrint(`the tag ${repr(string1)} with text ${repr(string2)} should produce the link  ${repr(string3)}`, RecordResult(result1 === string3), {result: result1});

    console.log("Checking wikiLink");
    string1 = "1girl";
    string2 = "Wiki link";
    option1 = 'class="category-0"';
    string3 = '<a class="category-0" href="/wiki_pages/1girl">Wiki link</a>';
    result1 = JSPLib.danbooru.wikiLink(string1, string2, option1);
    TestPrint(`the tag ${repr(string1)} with text ${repr(string2)} should produce the link  ${repr(string3)}`, RecordResult(result1 === string3), {result: result1});

    console.log("Checking submitRequest");
    JSPLib.danbooru.error_domname = "#checklibrary-error";
    let type1 = 'posts';
    let type2 = 'doesntexist';
    let addons1 = {limit: 1};
    result1 = await JSPLib.danbooru.submitRequest(type1, addons1);
    result2 = await JSPLib.danbooru.submitRequest(type2);
    TestPrint(`with type ${type1} and addons ${repr(addons1)}, a single post should have been returned`, RecordResult(ArrayLength(result1, 1)), {result: result1});
    TestPrint(`with nonexistent type ${type2}, null should be returned`, RecordResult(result2 === null), {result: repr(result2)});

    console.log("Checking submitRequest (long)");
    result1 = await JSPLib.danbooru.submitRequest(type1, addons1, {long_format: true});
    TestPrint(`with type ${type1} and addons ${repr(addons1)}, a single post should have been returned`, RecordResult(ArrayLength(result1, 1)), {result: result1});

    console.log("Checking getAllItems");
    type1 = 'users';
    addons1 = {search: {level: 50}, only: 'id,level'}; //Search for admins
    let page1 = 1; //Except for the first admin
    let limit1 = 1; //One at a time
    result1 = await JSPLib.danbooru.getAllItems(type1, limit1, {url_addons: addons1, batches: 2, page: page1, reverse: true});
    result2 = JSPLib.utility.getObjectAttributes(result1, 'id');
    result3 = result2.sort((a, b) => a - b);
    result4 = JSPLib.utility.getObjectAttributes(result1, 'level').reduce((total, entry) => total && entry === 50, true);
    TestPrint(`with type ${type1} and addons ${repr(addons1)}, two users should have been returned`, RecordResult(ArrayLength(result1, 2)), {result: repr(result1)});
    TestPrint("should have also not returned the first user", RecordResult(ArrayIncludes(result2, 1, false)), {result: repr(result2)});
    TestPrint(`should have also returned users in reverse order ${repr(result3)}`, RecordResult(repr(result2) === repr(result3)), {result: repr(result2)});
    TestPrint("should have also returned only admins", RecordResult(result4), {no_result: true});

    console.log("Checking getAllItems (long)");
    result1 = await JSPLib.danbooru.getAllItems(type1, limit1, {url_addons: addons1, batches: 2, page: page1, reverse: true, long_format: true});
    result2 = JSPLib.utility.getObjectAttributes(result1, 'id');
    result3 = result2.sort((a, b) => a - b);
    result4 = JSPLib.utility.getObjectAttributes(result1, 'level').reduce((total, entry) => total && entry === 50, true);
    TestPrint(`with type ${type1} and addons ${repr(addons1)}, two users should have been returned`, RecordResult(ArrayLength(result1, 2)), {result: repr(result1)});
    TestPrint("should have also not returned the first user", RecordResult(ArrayIncludes(result2, 1, false)), {result: repr(result2)});
    TestPrint(`should have also returned users in reverse order ${repr(result3)}`, RecordResult(repr(result2) === repr(result3)), {result: repr(result2)});
    TestPrint("should have also returned only admins", RecordResult(result4), {no_result: true});

    console.log("Checking getAllItems (counter)");
    let users_latest = await JSPLib.danbooru.submitRequest(type1, {limit: 10, only: 'id'});
    let page_start = JSPLib.danbooru.getNextPageID(users_latest, false);
    let page_end = JSPLib.danbooru.getNextPageID(users_latest, true);
    array1 = JSPLib.utility.getObjectAttributes(users_latest, 'id');
    result1 = await JSPLib.danbooru.getAllItems(type1, limit1, {page: page_end + 1, url_addons: {search: {id: `${page_end}..${page_start}`}, only: 'id'}, domname: '#checklibrary-count'});
    result2 = JSPLib.utility.getObjectAttributes(result1, 'id');
    result3 = jQuery('#checklibrary-count').data('latest-id');
    result4 = Number(jQuery('#checklibrary-count').text());
    TestPrint(`getting the latest users with IDs ${repr(array1)} should get the same users`, RecordResult(ArrayEqual(array1, result2)), {result: repr(result2)});
    TestPrint(`the countdown counter latest ID should be ${repr(page_start)}`, RecordResult(result3 === page_start), {result: repr(result3)});
    TestPrint("the countdown counter should end at 0", RecordResult(result4 === 0), {result: repr(result4)});

    console.log("Checking getPostsCountdown");
    JSPLib.danbooru.error_domname = "#checklibrary-error";
    string1 = "id:1,2,3,4";
    string2 = 'id'; //Grab only the ID
    result1 = await JSPLib.danbooru.getPostsCountdown(string1, 1, string2, '#checklibrary-count');
    TestPrint(`with query ${string1} and addons "${string2}", four posts should have been returned`, RecordResult(ArrayLength(result1, 4)), {result: repr(result1)});

    console.log("Checking rateLimit #2");
    JSPLib.danbooru.num_network_requests = JSPLib.danbooru.max_network_requests;
    JSPLib.danbooru.submitRequest(type1, addons1).then(() => {console.log("Finished submitting request!");});
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
    TestPrint(`Site ${string1} should have a DB index of ${number1}`, RecordResult(result1 === number1), {result: result1});

    console.log("Checking checkSauce #1");
    let object1 = null;
    result1 = JSPLib.saucenao.checkSauce(object1);
    TestPrint(`Response of ${repr(object1)} should return a result of false`, RecordResult(result1 === false), {no_result: true}, {result: result1});
    TestPrint("The no sauce flag should have been set", RecordResult(JSPLib.saucenao.no_sauce === true), {no_result: true});
    await JSPLib.utility.sleep(2000);

    console.log("Checking checkSauce #2");
    object1 = {header: {long_remaining: 0}, results: {}};
    result1 = JSPLib.saucenao.checkSauce(object1);
    TestPrint(`Response of ${repr(object1)} should return a result of true`, RecordResult(result1 === true), {no_result: true});
    TestPrint("The no sauce flag should have been set", RecordResult(JSPLib.saucenao.no_sauce === true), {no_result: true});
    await JSPLib.utility.sleep(2000);

    console.log("Checking checkSauce #3");
    object1 = {header: {long_remaining: 1, short_remaining: 0}, results: {}};
    result1 = JSPLib.saucenao.checkSauce(object1);
    TestPrint(`Response of ${repr(object1)} should return a result of true`, RecordResult(result1 === true), {no_result: true});
    TestPrint("The no sauce flag should not have been set", RecordResult(JSPLib.saucenao.no_sauce === false), {no_result: true});
    await JSPLib.utility.sleep(2000);

    console.log("Checking checkSauce #4");
    object1 = {header: {long_remaining: 1, short_remaining: 1, status: -1, message: 'Some message.'}};
    result1 = JSPLib.saucenao.checkSauce(object1);
    TestPrint(`Response of ${repr(object1)} should return a result of false`, RecordResult(result1 === false), {no_result: true});
    TestPrint("The no sauce flag should not have been set", RecordResult(JSPLib.saucenao.no_sauce === false), {no_result: true});
    await JSPLib.utility.sleep(2000);

    console.log("Checking checkSauce #5");
    object1 = {header: {long_remaining: 1, short_remaining: 1}, results: {}};
    result1 = JSPLib.saucenao.checkSauce(object1);
    TestPrint(`Response of ${repr(object1)} should return a result of true`, RecordResult(result1 === true), {no_result: true});
    TestPrint("The no sauce flag should not have been set", RecordResult(JSPLib.saucenao.no_sauce === false), {no_result: true});
    await JSPLib.utility.sleep(2000);

    console.log("Checking getSauce #1");
    object1 = {header: {long_remaining: 1, short_remaining: 1}, results: {}};
    result1 = await JSPLib.saucenao.getSauce();
    TestPrint(`No API key should return a result of false`, RecordResult(result1 === false), {no_result: true});
    await JSPLib.utility.sleep(2000);

    console.log("Checking getSauce #2");
    JSPLib.saucenao.api_key = saucenao_api_key;
    JSPLib.saucenao._sauce_wait = Date.now() + JSPLib.utility.one_second;
    result1 = await JSPLib.saucenao.getSauce();
    TestPrint(`Wait time remaining should should return a result of false`, RecordResult(result1 === false), {no_result: true});
    await JSPLib.utility.sleep(2000);

    if (typeof GM.xmlHttpRequest !== 'undefined') {
        //Save old settings
        let old_xhr = jQuery.ajaxSettings.xhr;
        JSPLib.network.jQuerySetup();

        console.log("Checking getSauce #3");
        let num_results = 2;
        let resp1 = await JSPLib.saucenao.getSauce(PREVIEW_URL, JSPLib.saucenao.getDBIndex('danbooru'), num_results, true);
        let boolarray1 = [Boolean(resp1?.header), Boolean(resp1?.results)];
        TestPrint(`Image with URL ${PREVIEW_URL} should have a header and results`, RecordResult(boolarray1.every((val) => val)), {result: repr(boolarray1)});
        if (boolarray1.every((val) => val)) {
            let bool1 = ArrayEqual(Object.keys(resp1.header.index), ['9']);
            TestPrint("There should be two results", RecordResult(resp1.header.results_returned === num_results), {result: resp1.header.results_returned});
            TestPrint("All results should be from Danbooru", RecordResult(bool1 === true), {no_result: true});
        } else {
            console.error("Invalid response returned:", resp1);
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
    JSPLib._window.doesexist = null;
    let test1 = JSPLib.load._isVariableDefined('window.doesexist');
    let test2 = JSPLib.load._isVariableDefined('window.doesntexist');
    TestPrint("variable 'window.doesexist' should exist", RecordResult(test1 === true), {no_result: true});
    TestPrint("variable 'window.doesntexist' shouldn't exist", RecordResult(test2 === false), {no_result: true});

    console.log("Checking programInitialize and programLoad");
    let function1 = function() { console.log("Shouldn't run!");};
    let function2 = function() { console.log("Should run!");};
    JSPLib._window.goodvariable = true;
    jQuery("body").append(`<div id="id-does-exist">`);
    jQuery("body").append(`<div class="class-does-exist">`);

    console.log("Starting program load with bad variable");
    JSPLib.load.programInitialize(function1, {function_name: 'timer1', required_variables: ['window.badvariable'], max_retries: 5});
    let test_success = await LoadWait('timer1');
    if (test_success) {
        TestPrint("program load waiting on 'window.badvariable' should not have run", RecordResult(JSPLib.load.program_load_timers.timer1 === false), {no_result: true});
        TestPrint("program load waiting on 'window.badvariable' should have tried 6 times", RecordResult(JSPLib.load.program_load_retries.timer1 === 6), {result: JSPLib.load.program_load_retries.timer1});
    } else {
        TestPrint("Loading failed", RecordResult(test_success), {no_result: true});
    }

    console.log("Starting program load with bad DOM id");
    JSPLib.load.programInitialize(function1, {function_name: 'timer2', required_selectors: ['#id-doesnt-exist'], max_retries: 1});
    test_success = await LoadWait('timer2');
    if (test_success) {
        TestPrint("program load waiting on #id-doesnt-exist should not have run", RecordResult(JSPLib.load.program_load_timers.timer2 === false), {no_result: true});
        TestPrint("program load waiting on #id-doesnt-exist should have tried 2 times", RecordResult(JSPLib.load.program_load_retries.timer2 === 2), {result: JSPLib.load.program_load_retries.timer2});
    } else {
        TestPrint("Loading failed", RecordResult(test_success), {no_result: true});
    }

    console.log("Starting program load with bad DOM class");
    JSPLib.load.programInitialize(function1, {function_name: 'timer3', required_selectors: ['.class-doesnt-exist'], max_retries: 0});
    test_success = await LoadWait('timer3');
    if (test_success) {
        TestPrint("program load waiting on .class-doesnt-exist should not have run", RecordResult(JSPLib.load.program_load_timers.timer3 === false), {no_result: true});
        TestPrint("program load waiting on .class-doesnt-exist should have tried once", RecordResult(JSPLib.load.program_load_retries.timer3 === 1), {result: JSPLib.load.program_load_retries.timer3});
    } else {
        TestPrint("Loading failed", RecordResult(test_success), {no_result: true});
    }

    console.log("Starting program load with bad DOM tagname");
    JSPLib.load.programInitialize(function1, {function_name: 'timer4', required_selectors: ['badtag'], max_retries: 0});
    test_success = await LoadWait('timer4');
    if (test_success) {
        TestPrint("program load waiting on <badtag> should not have run", RecordResult(JSPLib.load.program_load_timers.timer4 === false), {no_result: true});
        TestPrint("program load waiting on <badtag> should have tried once", RecordResult(JSPLib.load.program_load_retries.timer4 === 1), {result: JSPLib.load.program_load_retries.timer4});
    } else {
        TestPrint("Loading failed", RecordResult(test_success), {no_result: true});
    }

    console.log("Starting program load with all bad optional selectors");
    JSPLib.load.programInitialize(function1, {function_name: 'timer5', optional_selectors: ['badtag1', 'badtag2'], max_retries: 0});
    test_success = await LoadWait('timer5');
    if (test_success) {
        TestPrint("program load waiting on <badtag1> or <badtag2> should not have run", RecordResult(JSPLib.load.program_load_timers.timer5 === false), {no_result: true});
        TestPrint("program load waiting on <badtag> or <badtag2> should have tried once", RecordResult(JSPLib.load.program_load_retries.timer5 === 1), {result: JSPLib.load.program_load_retries.timer5});
    } else {
        TestPrint("Loading failed", RecordResult(test_success), {no_result: true});
    }

    console.log("Starting good program load");
    JSPLib.load.programInitialize(function2, {function_name: 'timer6', required_variables: ['window.goodvariable'], required_selectors: ['#id-does-exist', '.class-does-exist', 'body'], optional_selectors: ['#c-static', '#c-posts'], max_retries: 5});
    test_success = await LoadWait('timer6');
    if (test_success) {
        TestPrint("program load waiting on 'window.goodvariable' should have run", RecordResult(JSPLib.load.program_load_timers.timer6 === true), {no_result: true});
        TestPrint("program load waiting on 'window.goodvariable' should have tried once", RecordResult(JSPLib.load.program_load_retries.timer6 === 0), {result: JSPLib.load.program_load_retries.timer6});
    } else {
        TestPrint("Loading failed", RecordResult(test_success), {no_result: true});
    }

    console.log(`CheckLoadLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

async function checklibrary() {
    jQuery("footer").prepend('<span id="checklibrary-error" style="font-size:400%">0</span>&emsp;<span id="checklibrary-count" style="font-size:400%">0</span>');
    document.body.style.height = '5000px';
    setTimeout(() => {window.scroll(0, 10000);}, 2000);

    //await CheckDebugLibrary();
    //await CheckNoticeLibrary();
    //await CheckUtilityLibrary();
    //CheckStatisticsLibrary();
    //CheckValidateLibrary();
    await CheckStorageLibrary();
    //await CheckConcurrencyLibrary();
    //await CheckNetworkLibrary();
    //await CheckDanbooruLibrary();
    //await CheckSaucenaoLibrary();
    //await CheckLoadLibrary();
    console.log(`All library results: ${overall_test_successes} succeses, ${overall_test_failures} failures`);
}

/****INITIALIZATION****/

JSPLib.debug.debug_console = true;
JSPLib.debug.level = JSPLib.debug.INFO;
JSPLib.debug.program_shortcut = 'cl';

//Export JSPLib
JSPLib.load.exportData('CheckLibraries');

/****Execution start****/

JSPLib.load.programInitialize(checklibrary, {program_name: 'CL', required_variables: ['window.jQuery', 'window.Danbooru'], required_selectors: ["footer"]});
