// ==UserScript==
// @name         CheckLibraries
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      17.0
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
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/1a49004da6cd62e0be1ae855ea786febcda9afb1/lib/module.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/1a49004da6cd62e0be1ae855ea786febcda9afb1/lib/debug.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/1a49004da6cd62e0be1ae855ea786febcda9afb1/lib/notice.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/1a49004da6cd62e0be1ae855ea786febcda9afb1/lib/utility.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/1a49004da6cd62e0be1ae855ea786febcda9afb1/lib/storage.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/1a49004da6cd62e0be1ae855ea786febcda9afb1/lib/concurrency.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/1a49004da6cd62e0be1ae855ea786febcda9afb1/lib/statistics.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/1a49004da6cd62e0be1ae855ea786febcda9afb1/lib/validate.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/1a49004da6cd62e0be1ae855ea786febcda9afb1/lib/network.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/1a49004da6cd62e0be1ae855ea786febcda9afb1/lib/danbooru.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/1a49004da6cd62e0be1ae855ea786febcda9afb1/lib/saucenao.js
// @require      https://raw.githubusercontent.com/BrokenEagle/JavaScripts/1a49004da6cd62e0be1ae855ea786febcda9afb1/lib/load.js
// @connect      cdn.donmai.us
// @connect      saucenao.com
// ==/UserScript==

// eslint-disable-next-line no-redeclare
/* global jQuery JSPLib validate GM */

(({Debug, Notice, Utility, Storage, Template, Concurrency, Statistics, Validate, Network, Danbooru, Saucenao, Load, Menu}) => {

'CheckLibraries';

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
    return JSON.stringify(
        data,
        (_key, value) => (value instanceof Set ? [...value] : value)
    );
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

function HashEqual(x, y) {
    if (typeof x === 'object' && (typeof x === typeof y)) {
        if (Object.keys(x).length === Object.keys(y).length) {
            return Object.keys(x).every((key) => HashEqual(x[key], y[key]));
        }
        return false;
    }
    return x === y;
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

//Main functions

function CheckDebugLibrary() {
    console.log("++++++++++++++++++++CheckDebugLibrary++++++++++++++++++++");
    console.log("Start time:", Utility.getProgramTime());
    ResetResult();
    let debug_enabled = Debug.mode;
    let debug_level = Debug.level;

    console.log("Checking log(): check this out");
    Debug.mode = true;
    Debug.log("enabled: check this out");
    Debug.mode = false;
    Debug.log("disabled: check this out");

    console.log("Checking warnLevel(): WARNING+");
    Debug.mode = true;
    Debug.pretext = "CheckLibraries:";
    Debug.level = Debug.WARNING;
    Debug.warnLevel("ALL", Debug.ALL);
    Debug.warnLevel("VERBOSE", Debug.VERBOSE);
    Debug.warnLevel("DEBUG", Debug.DEBUG);
    Debug.warnLevel("INFO", Debug.INFO);
    Debug.warnLevel("WARNING", Debug.WARNING);
    Debug.warnLevel("ERROR", Debug.ERROR);

    console.log("Checking debug timer");
    Debug.mode = false;
    Debug.time("check");
    Debug.timeEnd("check");
    Debug.mode = true;
    Debug.time("check");
    Debug.timeEnd("check");

    console.log("Checking recordKey");
    let record_key1 = Debug.recordKey('CheckDebugLibrary', 'test');
    let record_key2 = Debug.recordKey('CheckDebugLibrary', ['1', '2', '3']);
    let record_key3 = Debug.recordKey('CheckDebugLibrary', () => '1234');
    TestPrint("Record key should take the format: ^CheckDebugLibrary;test;\d+$", RecordResult(/^CheckDebugLibrary;test;\d+$/.test(record_key1)), {result: record_key1});
    TestPrint("Record key should take the format: ^CheckDebugLibrary;1,2,3;\d+$", RecordResult(/^CheckDebugLibrary;1,2,3;\d+$/.test(record_key2)), {result: record_key2});
    TestPrint("Record key should take the format: ^CheckDebugLibrary;1234;\d+$", RecordResult(/^CheckDebugLibrary;1234;\d+$/.test(record_key3)), {result: record_key3});

    console.log("Checking record timer");
    Debug.recordTime('test1', 'test');
    Debug.recordTimeEnd('test1', 'test');
    Debug.mode = false;
    Debug.recordTime('test2', 'test');
    Debug.recordTimeEnd('test2', 'test');
    let result_length1 = Object.keys(Debug.getRecords()).length;
    TestPrint("Should have recorded only 1 value", RecordResult(result_length1 === 1), {result: result_length1});

    console.log("Checking execute");
    let testvalue1 = 4;
    Debug.execute(() => {
        testvalue1 += 1;
    });
    Debug.mode = true;
    Debug.execute(() => {
        testvalue1 += 2;
    });
    TestPrint("Test value should be 6", RecordResult(testvalue1 === 6), {result: testvalue1});

    Debug.mode = debug_enabled;
    Debug.level = debug_level;
    console.log(`CheckDebugLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

async function CheckNoticeLibrary() {
    console.log("++++++++++++++++++++CheckNoticeLibrary++++++++++++++++++++");
    console.log("Start time:", Utility.getProgramTime());
    ResetResult();
    let debug_enabled = Debug.mode;
    let debug_level = Debug.level;

    console.log("Checking notice");
    Notice.notice("check this");
    await Utility.sleep(2000);

    console.log("Checking error");
    Notice.error("check this");
    await Utility.sleep(2000);

    console.log("Checking debugNotice");
    Debug.mode = false;
    Notice.debugNotice("shouldn't see this");
    await Utility.sleep(2000);
    Debug.mode = true;
    Notice.debugNotice("should see this");
    await Utility.sleep(2000);

    console.log("Checking debugError");
    Debug.mode = false;
    Notice.debugError("shouldn't see this");
    await Utility.sleep(2000);
    Debug.mode = true;
    Notice.debugError("should see this");
    await Utility.sleep(2000);

    console.log("Checking debugNoticeLevel");
    Debug.level = Debug.INFO;
    Notice.debugNoticeLevel("shouldn't see this level", Debug.DEBUG);
    await Utility.sleep(2000);
    Notice.debugNoticeLevel("should see this level", Debug.INFO);
    await Utility.sleep(2000);


    console.log("Checking debugErrorLevel");
    Debug.level = Debug.ERROR;
    Notice.debugErrorLevel("shouldn't see this level", Debug.WARNING);
    await Utility.sleep(2000);
    Notice.debugErrorLevel("should see this level", Debug.INFO, Debug.ERROR);
    await Utility.sleep(2000);
    jQuery('#close-notice-link').click();

    console.log("Checking installBanner");
    let result1 = Notice.danbooru_notice_installed;
    let result2 = jQuery('#cl-notice').length === 0;
    TestPrint("Boolean flag should be set by invoker", RecordResult(result1), {no_result: true});
    TestPrint("The library banner should not be installed", RecordResult(result2), {no_result: true});
    Notice.installBanner('cl');
    result1 = jQuery('#cl-notice').length === 1;
    TestPrint("The program banner should be installed", RecordResult(result1), {no_result: true});

    console.log("Checking notice #2");
    Notice.notice("check this #2");
    await Utility.sleep(2000);

    console.log("Checking error #2");
    Notice.error("check this #2");
    await Utility.sleep(2000);

    console.log("Checking debugNotice #2");
    Debug.mode = false;
    Notice.debugNotice("shouldn't see this #2");
    await Utility.sleep(2000);
    Debug.mode = true;
    Notice.debugNotice("should see this #2");
    await Utility.sleep(2000);

    console.log("Checking debugError #2");
    Debug.mode = false;
    Notice.debugError("shouldn't see this #2");
    await Utility.sleep(2000);
    Debug.mode = true;
    Notice.debugError("should see this #2");
    await Utility.sleep(2000);

    console.log("Checking debugNoticeLevel #2");
    Debug.level = Debug.INFO;
    Notice.debugNoticeLevel("shouldn't see this level #2", Debug.DEBUG);
    await Utility.sleep(2000);
    Notice.debugNoticeLevel("should see this level #2", Debug.INFO);
    await Utility.sleep(2000);

    console.log("Checking debugErrorLevel #2");
    Debug.level = Debug.ERROR;
    Notice.debugErrorLevel("shouldn't see this level #2", Debug.WARNING);
    await Utility.sleep(2000);
    Notice.debugErrorLevel("should see this level #2", Debug.INFO, Debug.ERROR);
    await Utility.sleep(2000);
    jQuery('#cl-close-notice-link').click();

    Debug.mode = debug_enabled;
    Debug.level = debug_level;
    console.log(`CheckNoticeLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

async function CheckUtilityLibrary() {
    console.log("++++++++++++++++++++CheckUtilityLibrary++++++++++++++++++++");
    console.log("Start time:", Utility.getProgramTime());
    ResetResult();

    console.log("Checking sleep(): 1000ms");
    Debug.time("sleep()");
    await Utility.sleep(1000);
    Debug.timeEnd("sleep()");

    console.log("Checking getExpires");
    let testexpire1 = Utility.getExpires(100);
    TestPrint(`Value ${testexpire1} should be 100 ms greater than ${Date.now()} within 1-2ms`, RecordResult(Math.abs(testexpire1 - (Date.now() + 100)) <= 2), {no_result: true});

    console.log("Checking validateExpires");
    let testdata1 = Date.now() - 100;
    let testdata2 = Date.now() + 100;
    let result1 = Utility.validateExpires(testdata1, 100);
    let result2 = Utility.validateExpires(testdata2, 100);
    TestPrint(`Expiration of ${testdata1} should be expired`, RecordResult(result1 === false), {no_result: true});
    TestPrint(`Expiration of ${testdata2} should be unexpired`, RecordResult(result2 === true), {no_result: true});

    console.log("Checking toTimeStamp");
    let timeval3 = '"2000-01-01T00:00:00.000Z"';
    let expectedtimestamp1 = 946684800000;
    let timeinvalid1 = 'blah';
    let timestamp2 = Utility.toTimeStamp(timeval3);
    let timestamp3 = Utility.toTimeStamp(timeinvalid1);
    TestPrint(`Timestamp for ${timeval3}`, RecordResult(timestamp2 === expectedtimestamp1), {result: timestamp2});
    TestPrint(`Timestamp for invalid ${timeinvalid1}`, RecordResult(Number.isNaN(timestamp3)), {result: timestamp3});

    console.log("Checking timeAgo");
    let timeval1 = "2007-12-31T04:13:18.602Z";
    let timeval2 = '"2007-09-10T20:31:08.995Z"';
    let timestamp1 = new Date('2000').getTime();
    let comparetime1 = new Date('2008').getTime();
    let expectedtime1 = '19.78 hours ago';
    let expectedtime2 = '3.68 months ago';
    let expectedtime3 = '8 years ago';
    let timestring1 = Utility.timeAgo(timeval1, {compare_time: comparetime1});
    let timestring2 = Utility.timeAgo(timeval2, {compare_time: comparetime1});
    let timestring3 = Utility.timeAgo(timestamp1, {compare_time: comparetime1});
    let timestring4 = Utility.timeAgo(timeinvalid1, {compare_time: comparetime1});
    TestPrint(`Time ago string for ${timeval1}`, RecordResult(timestring1 === expectedtime1), {result: timestring1});
    TestPrint(`Time ago string for ${timeval2}`, RecordResult(timestring2 === expectedtime2), {result: timestring2});
    TestPrint(`Time ago string for ${timestamp1}`, RecordResult(timestring3 === expectedtime3), {result: timestring3});
    TestPrint(`Time ago string for invalid value ${timeinvalid1}`, RecordResult(timestring4 === 'N/A'), {result: timestring4});

    console.log("Checking setPrecision");
    let testvalue1 = 1.22;
    let testvalue2 = Utility.setPrecision(1.2222222, 2);
    TestPrint(`Value ${testvalue1} should be equal to ${testvalue2} with a decimal precision of 2`, RecordResult(testvalue1 === testvalue2), {no_result: true});

    console.log("Checking getUniqueID");
    testvalue1 = Utility.getUniqueID();
    testvalue2 = Utility.getUniqueID();
    TestPrint(`Value ${testvalue1} should not be equal to ${testvalue2}`, RecordResult(testvalue1 !== testvalue2), {no_result: true});

    console.log("Checking clamp");
    let high = 5
    let low = 1
    testvalue1 = 6
    testvalue2 = 3
    result1 = Utility.clamp(testvalue1, low, high);
    result2 = Utility.clamp(testvalue2, low, high);
    TestPrint(`Clamp of ${testvalue1} should be 5`, RecordResult(result1 === 5), {result: result1});
    TestPrint(`Clamp of ${testvalue2} should be 3`, RecordResult(result2 === 3), {result: result2});

    console.log("Checking maxLengthString");
    testvalue2 = Utility.maxLengthString("AUserNameThatIsWayTooLong", 10);
    TestPrint(`Value ${repr(testvalue2)} should have a string length of 10`, RecordResult(testvalue2.length === 10), {no_result: true});

    console.log("Checking titleize");
    let string = "titleize";
    let expected = "Titleize";
    let teststring = Utility.titleize(string);
    TestPrint(`Value ${repr(string)} should should be changed to ${repr(expected)}`, RecordResult(teststring === expected), {result: repr(teststring)});

    console.log("Checking kebabCase");
    let string1 = "testKebabCase";
    let string2 = "test-kebab-case";
    let string3 = "test_kebab_case";
    let teststring1 = Utility.kebabCase(string1);
    let teststring2 = Utility.kebabCase(string3);
    TestPrint(`Value ${repr(string1)} should should be changed to ${repr(string2)}`, RecordResult(teststring1 === string2), {result: repr(teststring1)});
    TestPrint(`Value ${repr(string3)} should should be changed to ${repr(string2)}`, RecordResult(teststring2 === string2), {result: repr(teststring2)});

    console.log("Checking camelCase");
    teststring1 = Utility.camelCase(string2);
    teststring2 = Utility.camelCase(string3);
    TestPrint(`Value ${repr(string2)} should should be changed to ${repr(string1)}`, RecordResult(teststring1 === string1), {result: repr(teststring1)});
    TestPrint(`Value ${repr(string3)} should should be changed to ${repr(string1)}`, RecordResult(teststring2 === string1), {result: repr(teststring2)});

    console.log("Checking snakeCase");
    teststring1 = Utility.snakeCase(string1);
    teststring2 = Utility.snakeCase(string2);
    TestPrint(`Value ${repr(string1)} should should be changed to ${repr(string3)}`, RecordResult(teststring1 === string3), {result: repr(teststring1)});
    TestPrint(`Value ${repr(string2)} should should be changed to ${repr(string3)}`, RecordResult(teststring2 === string3), {result: repr(teststring2)});

    console.log("Checking displayCase");
    string1 = "test_display_case";
    string2 = "Test display case";
    teststring1 = Utility.displayCase(string1);
    TestPrint(`Value ${repr(string1)} should should be changed to ${repr(string2)}`, RecordResult(teststring1 === string2), {result: repr(teststring1)});

    console.log("Checking padNumber");
    let num1 = 23;
    let num2 = 23.2;
    string1 = "0023";
    string2 = "0023.2";
    teststring1 = Utility.padNumber(num1, 4);
    teststring2 = Utility.padNumber(num2, 6);
    TestPrint(`Value ${repr(num1)} should should be changed to ${repr(string1)}`, RecordResult(teststring1 === string1), {result: repr(teststring1)});
    TestPrint(`Value ${repr(num2)} should should be changed to ${repr(string2)}`, RecordResult(teststring2 === string2), {result: repr(teststring2)});

    console.log("Checking sprintf");
    string1 = "%s test %s";
    string2 = "this test 3";
    teststring1 = Utility.sprintf(string1, "this", 3);
    TestPrint(`Value ${repr(string1)} should should be changed to ${repr(string2)}`, RecordResult(teststring1 === string2), {result: repr(teststring1)});

    console.log("Checking readableBytes");
    let bytesize = 1048576;
    let expectedbytes = '1 MB';
    teststring1 = Utility.readableBytes(bytesize);
    TestPrint(`Value ${bytesize} should have a readable byte size of ${repr(expectedbytes)}`, RecordResult(teststring1 === expectedbytes), {result: repr(teststring1)});

    console.log("Checking joinList");
    let testarray1 = ['1', '3'];
    string1 = "test-1-section,test-3-section";
    teststring1 = Utility.joinList(testarray1, {prefix: "test-", suffix: '-section', joiner: ','});
    TestPrint(`Value ${repr(testarray1)} should should be changed to ${repr(string1)}`, RecordResult(teststring1 === string1), {result: repr(teststring1)});

    console.log("Checking findAll");
    string1 = "100 200 300 400";
    let array1 = ["100", "200", "300", "400"];
    result1 = Utility.findAll(string1, /\d+/g);
    TestPrint(`Value ${repr(string1)} should find matches ${repr(array1)}`, RecordResult(ArrayEqual(array1, result1)), {result: repr(result1)});

    console.log("Checking regexpEscape");
    string1 = "tag_(qualifier)";
    let regexstring1 = "tag_\\(qualifier\\)";
    teststring1 = Utility.regexpEscape(string1);
    TestPrint(`Value ${repr(string1)} should be regex escaped to ${repr(regexstring1)}`, RecordResult(teststring1 === regexstring1), {result: repr(teststring1)});

    console.log("Checking regexReplace");
    string1 = "10 something false";
    let format_string1 = "%NUMBER% %STRING% %BOOL%";
    let format_data1 = {NUMBER: 10, STRING: "something", BOOL: false};
    teststring1 = Utility.regexReplace(format_string1, format_data1);
    TestPrint(`Format ${repr(format_string1)} and data ${repr(format_data1)} should should be regex replaced to ${repr(string1)}`, RecordResult(string1 === teststring1), {result: repr(teststring1)});

    console.log("Checking safeMatch");
    teststring1 = "blog-navigate";
    teststring2 = "not-applicable";
    let regex1 = /^blog-(.*)$/;
    let exepectedmatch1 = 'navigate';
    let default_val = 'N/A';
    let match1 = Utility.safeMatch(teststring1, regex1, {group: 1, default_val});
    let match2 = Utility.safeMatch(teststring2, regex1, {group: 1, default_val});
    TestPrint(`Value ${repr(teststring1)} with regex ${regex1} should find a match of ${repr(exepectedmatch1)}`, RecordResult(match1 === exepectedmatch1), {result: match1});
    TestPrint(`Value ${repr(teststring2)} with regex ${regex1} should return the default value of ${repr(default_val)}`, RecordResult(match2 === default_val), {result: match2});

    console.log("Checking filterRegex");
    testarray1 = ["test", "first", "nonempty"];
    let testarray2 = ["test", "first", "empty", ""];
    regex1 = /^(?:other|empty)/;
    let resultarray1 = Utility.filterRegex(testarray1, regex1);
    let resultarray2 = Utility.filterRegex(testarray2, regex1);
    TestPrint(`Array ${repr(resultarray1)} should have a length of zero`, RecordResult(resultarray1.length === 0), {no_result: true});
    TestPrint(`Array ${repr(resultarray2)} should have a length of one`, RecordResult(resultarray2.length === 1), {no_result: true});

    console.log("Checking concat");
    array1 = [1, 2, 3];
    let array2 = [4, 5, 6];
    let checkarray1 = [1, 2, 3, 4, 5, 6];
    resultarray1 = Utility.concat(array1, array2);
    TestPrint(`Array ${repr(array1)} concatenated with ${repr(array2)} should become ${repr(checkarray1)}`, RecordResult(ArrayEqual(checkarray1, resultarray1)), {result: resultarray1});

    console.log("Checking multiConcat");
    let array3 = [7, 8, 9];
    checkarray1 = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    resultarray1 = Utility.multiConcat(array1, array2, array3);
    TestPrint(`Array ${repr(array1)} concatenated with ${repr(array2)} should become ${repr(checkarray1)}`, RecordResult(ArrayEqual(checkarray1, resultarray1)), {result: resultarray1});

    console.log("Checking arrayUnique");
    let testarray3 = ["testing", "first", "testing"];
    checkarray1 = ["testing", "first"];
    resultarray1 = Utility.arrayUnique(testarray3);
    TestPrint(`Array ${repr(testarray3)} should become ${repr(checkarray1)}`, RecordResult(ArrayEqual(checkarray1, resultarray1)), {result: resultarray1});

    console.log("Checking arrayUnion");
    resultarray1 = Utility.arrayUnion(testarray1, testarray3);
    TestPrint(`Array ${repr(resultarray1)} should have a length of 4`, RecordResult(resultarray1.length === 4), {no_result: true});

    console.log("Checking arrayDifference");
    resultarray1 = Utility.arrayDifference(testarray1, testarray2);
    resultarray2 = Utility.arrayDifference(testarray2, testarray1);
    TestPrint(`Array ${repr(resultarray1)} should have a length of 1`, RecordResult(resultarray1.length === 1), {no_result: true});
    TestPrint(`Array ${repr(resultarray2)} should have a length of 2`, RecordResult(resultarray2.length === 2), {no_result: true});

    console.log("Checking arrayIntersection");
    resultarray1 = Utility.arrayIntersection(testarray1, testarray2);
    TestPrint(`Array ${repr(resultarray1)} should have a length of 2`, RecordResult(resultarray1.length === 2), {no_result: true});

    console.log("Checking arraySymmetricDifference");
    resultarray1 = Utility.arraySymmetricDifference(testarray1, testarray3);
    TestPrint(`Array ${repr(resultarray1)} should have a length of 3`, RecordResult(resultarray1.length === 3), {no_result: true});

    console.log("Checking isSubArray");
    array1 = [1, 2, 3];
    array2 = [1, 3];
    array3 = [2, 4];
    let resultbool1 = Utility.isSubArray(array1, array2);
    let resultbool2 = Utility.isSubArray(array1, array3);
    TestPrint(`Array ${repr(array2)} should be a subset of ${repr(array1)}`, RecordResult(resultbool1), {no_result: true});
    TestPrint(`Array ${repr(array3)} should not be a subset of ${repr(array1)}`, RecordResult(!resultbool2), {no_result: true});

    console.log("Checking isSuperArray");
    array1 = [1, 2, 3];
    array2 = [1, 3];
    resultbool1 = Utility.isSuperArray(array1, array2);
    resultbool2 = Utility.isSuperArray(array2, array1);
    TestPrint(`Array ${repr(array2)} should not be a superset of ${repr(array1)}`, RecordResult(!resultbool1), {no_result: true});
    TestPrint(`Array ${repr(array1)} should be a superset of ${repr(array2)}`, RecordResult(resultbool2), {no_result: true});

    console.log("Checking arrayEquals");
    array1 = [1, 2, 3];
    array2 = [1, 2, 3];
    array3 = [2, 4];
    resultbool1 = Utility.arrayEquals(array1, array2);
    resultbool2 = Utility.arrayEquals(array1, array3);
    TestPrint(`Array ${repr(array2)} should be equal to ${repr(array1)}`, RecordResult(resultbool1), {no_result: true});
    TestPrint(`Array ${repr(array3)} should not be equal to ${repr(array1)}`, RecordResult(!resultbool2), {no_result: true});

    console.log("Checking arrayHasIntersection");
    array1 = [1, 2, 3];
    array2 = [3, 5];
    array3 = [5, 6];
    resultbool1 = Utility.arrayHasIntersection(array1, array2);
    resultbool2 = Utility.arrayHasIntersection(array1, array3);
    TestPrint(`Array ${repr(array1)} should have an intersection with ${repr(array2)}`, RecordResult(resultbool1), {no_result: true});
    TestPrint(`Array ${repr(array1)} should not have an intersection with ${repr(array3)}`, RecordResult(!resultbool2), {no_result: true});

    console.log("Checking setUnion");
    let testset1 = new Set(["test", "first", "nonempty"]);
    let testset2 = new Set(["test", "first", "empty", ""]);
    let testset3 = new Set(["testing", "first", "testing"]);
    let resultset1 = Utility.setUnion(testset1, testset3);
    TestPrint(`Set ${repr(resultset1)} should have a size of 4`, RecordResult(resultset1.size === 4), {no_result: true});

    console.log("Checking setDifference");
    resultset1 = Utility.setDifference(testset1, testset2);
    let resultset2 = Utility.setDifference(testset2, testset1);
    TestPrint(`Set ${repr(resultset1)} should have a size of 1`, RecordResult(resultset1.size === 1), {no_result: true});
    TestPrint(`Set ${repr(resultset2)} should have a size of 2`, RecordResult(resultset2.size === 2), {no_result: true});

    console.log("Checking setIntersection");
    resultset1 = Utility.setIntersection(testset1, testset2);
    TestPrint(`Set ${repr(resultset1)} should have a size of 2`, RecordResult(resultset1.size === 2), {no_result: true});

    console.log("Checking arraySymmetricDifference");
    resultset1 = Utility.setSymmetricDifference(testset1, testset3);
    TestPrint(`Set ${repr(resultset1)} should have a size of 3`, RecordResult(resultset1.size === 3), {no_result: true});

    console.log("Checking isSubSet");
    let set1 = new Set([1, 2, 3]);
    let set2 = new Set([1, 3]);
    let set3 = new Set([2, 4]);
    resultbool1 = Utility.isSubSet(set1, set2);
    resultbool2 = Utility.isSubSet(set1, set3);
    TestPrint(`Set ${repr(set2)} should be a subset of ${repr(set1)}`, RecordResult(resultbool1), {no_result: true});
    TestPrint(`Set ${repr(set3)} should not be a subset of ${repr(set1)}`, RecordResult(!resultbool2), {no_result: true});

    console.log("Checking isSuperSet");
    set1 = new Set([1, 2, 3]);
    set2 = new Set([1, 3]);
    resultbool1 = Utility.isSuperSet(set1, set2);
    resultbool2 = Utility.isSuperSet(set2, set1);
    TestPrint(`Set ${repr(set2)} should not be a superset of ${repr(set1)}`, RecordResult(!resultbool1), {no_result: true});
    TestPrint(`Set ${repr(set1)} should be a superset of ${repr(set2)}`, RecordResult(resultbool2), {no_result: true});

    console.log("Checking setEquals");
    set1 = new Set([1, 2, 3]);
    set2 = new Set([1, 2, 3]);
    set3 = new Set([2, 4]);
    resultbool1 = Utility.setEquals(set1, set2);
    resultbool2 = Utility.setEquals(set1, set3);
    TestPrint(`Set ${repr(set2)} should be equal to ${repr(set1)}`, RecordResult(resultbool1), {no_result: true});
    TestPrint(`Set ${repr(set3)} should not be equal to ${repr(set1)}`, RecordResult(!resultbool2), {no_result: true});

    console.log("Checking setHasIntersection");
    set1 = new Set([1, 2, 3]);
    set2 = new Set([3, 5]);
    set3 = new Set([5, 6]);
    resultbool1 = Utility.setHasIntersection(set1, set2);
    resultbool2 = Utility.setHasIntersection(set1, set3);
    TestPrint(`Set ${repr(set1)} should have an intersection with ${repr(set2)}`, RecordResult(resultbool1), {no_result: true});
    TestPrint(`Set ${repr(set1)} should not have an intersection with ${repr(set3)}`, RecordResult(!resultbool2), {no_result: true});

    console.log("Checking setEvery");
    set1 = new Set([1, 1, 1]);
    set2 = new Set([1, 1, 2]);
    let compare1 = (val) => val === 1;
    resultbool1 = Utility.setEvery(set1, compare1);
    resultbool2 = Utility.setEvery(set2, compare1);
    TestPrint(`Set ${repr(set1)} should have every value be equal to 1`, RecordResult(resultbool1), {no_result: true});
    TestPrint(`Set ${repr(set1)} should not have every value be equal to 1`, RecordResult(!resultbool2), {no_result: true});

    console.log("Checking setSome");
    set1 = new Set([1, 0, 2]);
    set2 = new Set([0, 2, 4]);
    resultbool1 = Utility.setSome(set1, compare1);
    resultbool2 = Utility.setSome(set2, compare1);
    TestPrint(`Set ${repr(set1)} should have some value be equal to 1`, RecordResult(resultbool1), {no_result: true});
    TestPrint(`Set ${repr(set1)} should not have some value be equal to 1`, RecordResult(!resultbool2), {no_result: true});

    console.log("Checking deepFreeze");
    let testobject1 = {id: 1, type: {a: 1, b: 2}};
    Utility.deepFreeze(testobject1);
    let boolarray1 = [Object.isFrozen(testobject1), Object.isFrozen(testobject1.type)];
    TestPrint(`Object ${repr(testobject1)} and the type subobject should be frozen`, RecordResult(boolarray1.every((val) => val)), {result: repr(boolarray1)});

    console.log("Checking getObjectAttributes");
    array1 = [1, 2, 3];
    let testobjectarray1 = [{id: 1, type: 'a'}, {id: 2, type: 'b'}, {id: 3, type: 'b'}];
    resultarray1 = Utility.getObjectAttributes(testobjectarray1, 'id');
    TestPrint(`Object array ${repr(testobjectarray1)} with getting the id attributes should be equal to ${repr(array1)}`, RecordResult(ArrayEqual(resultarray1, array1)), {result: repr(resultarray1)});

    console.log("Checking getNestedAttribute");
    result1 = Utility.getNestedAttribute(testobject1, ['type', 'a']);
    TestPrint(`Object ${repr(testobject1)} with getting a nested attribute should be equal to 1`, RecordResult(result1 === 1), {result: repr(result1)});

    console.log("Checking getNestedObjectAttributes");
    array1 = [1, 3];
    testobjectarray1 = [{id: 1, type: {a: 1, b: 2}}, {id: 2, type: {a: 3, b: 4}}];
    resultarray1 = Utility.getNestedObjectAttributes(testobjectarray1, ['type', 'a']);
    TestPrint(`Object array ${repr(testobjectarray1)} with getting nested attributes should be equal to ${repr(array1)}`, RecordResult(ArrayEqual(resultarray1, array1)), {result: repr(resultarray1)});

    console.log("Checking objectReduce");
    testobject1 = {test1: 1, test2: 2, test3: 3};
    result1 = Utility.objectReduce(testobject1, (total, val) => total + val, 0);
    TestPrint(`Object ${repr(testobject1)} totaling key values should be equal to 6`, RecordResult(result1 === 6), {result: repr(result1)});

    console.log("Checking deepCopy");
    testobject1 = {'test': 0, 'value': {'deep': 1}};
    let copyobject1 = testobject1;
    let shallowobject1 = Object.assign({}, testobject1);
    let [deepobject1] = Utility.deepCopy([testobject1]);
    testobject1.test = 10;
    testobject1.value.deep = 11;
    TestPrint(`Object ${repr(copyobject1)} should have the same values as`, RecordResult(copyobject1?.test === 10 && copyobject1?.value?.deep === 11), {result: repr(testobject1)});
    TestPrint(`Object ${repr(shallowobject1)} should have one value the same as`, RecordResult(shallowobject1?.test !== 10 && copyobject1?.value?.deep === 11), {result: repr(testobject1)});
    TestPrint(`Object ${repr(deepobject1)} should have no values the same as`, RecordResult(deepobject1?.test !== 10 && deepobject1?.value?.deep !== 11), {result: repr(testobject1)});

    console.log("Checking mergeObjects");
    let object1 = {search: {id: "20,21,5"}};
    let object2 = {search: {order: "customorder"}};
    result1 = Utility.mergeObjects(object1, object2);
    boolarray1 = [HashContains(result1, ['search']), HashContains(result1.search, ['id', 'order'])];
    if(boolarray1[1]) {
        boolarray1.push(result1.search.id === "20,21,5")
        boolarray1.push(result1.search.order === "customorder");
    }
    TestPrint(`Merging objects ${repr(object1)} and ${repr(object2)} produces the following result => ${repr(result1)}`, RecordResult(boolarray1.every((val) => val)), {result: repr(boolarray1)});
    TestPrint(`The original object ${repr(object1)} should be unmodified`, RecordResult(object1.search.order === undefined), {no_result: true});

    console.log("Checking assignObjects");
    result1 = Utility.assignObjects(object1, object2);
    boolarray1 = [HashContains(result1, ['search']), HashContains(result1.search, ['id', 'order'])];
    if(boolarray1[1]) {
        boolarray1.push(result1.search.id === "20,21,5")
        boolarray1.push(result1.search.order === "customorder");
    }
    let boolarray2 = [HashContains(object1, ['search']), HashContains(object1.search, ['id', 'order'])];
    if(boolarray1[1]) {
        boolarray1.push(object1.search.id === "20,21,5")
        boolarray1.push(object1.search.order === "customorder");
    }
    TestPrint(`Merging objects ${repr(object1)} and ${repr(object2)} produces the following result => ${repr(result1)}`, RecordResult(boolarray1.every((val) => val)), {result: repr(boolarray1)});
    TestPrint(`The first object ${repr(object1)} should be modified and be equal to the return value ${repr(result1)}`, RecordResult(boolarray2.every((val) => val)), {result: repr(boolarray2)});

    console.log("Checking setCSSStyle");
    Utility.setCSSStyle("body {background: black !important;}", "test");
    console.log("Color set to black... changing color in 5 seconds.");
    await Utility.sleep(csstyle_waittime);
    Utility.setCSSStyle("body {background: purple !important;}", "test");
    console.log("Color set to purple...");
    await Utility.sleep(csstyle_waittime);
    Utility.setCSSStyle("", "test");

    console.log("Checking hasStyle");
    result1 = Utility.hasStyle('test');
    TestPrint("Test style should be initialized", RecordResult(result1), {no_result: true});

    //Setup for data functions. These need some delay so that the values can be found when read.
    let jqueryobj = jQuery("#checklibrary-count");
    jqueryobj.on("mouseenter.checklibraries.test_hover", () => {
        console.log("Hovering over count...");
    });
    testdata1 = {test_data: 'check'};
    jqueryobj.data(testdata1);
    await Utility.sleep(100);

    console.log("Checking getPrivateData");
    let $domobj = jqueryobj[0];
    let data1 = Utility.getPrivateData($domobj);
    TestPrint("data should be object with 2 keys and 1 subkey", RecordResult(HashContains(data1, ['events', 'handle']) && HashContains(data1.events, ['mouseover'])), {result: repr(data1)});

    console.log("Checking getPublicData");
    data1 = Utility.getPublicData($domobj);
    TestPrint(`data should be object ${repr(testdata1)}`, RecordResult(HashEqual(testdata1, data1)), {result: repr(data1)});

    console.log("Checking getAttr");
    let $domarray = jQuery(`<div deleted="true" data-test1="test1" data-test2="2"></div>`);
    $domobj = $domarray[0];
    let expected1 = {deleted: 'true'};
    let expected2 = {deleted: 'true', 'data-test1': 'test1', 'data-test2': '2'};
    result1 = Utility.getAttr($domobj, 'deleted');
    result2 = Utility.getAttr($domobj, ['deleted']);
    let result3 = Utility.getAttr($domobj);
    TestPrint(`The 'deleted' attribute of the dom object should be 'true'`, RecordResult(result1 === 'true'), {result: repr(result1)});
    TestPrint("The value returned for ['deleted'] should be a hash", RecordResult(HashCheck(result2)), {no_result: true});
    TestPrint(`The attributes hash should be equal to ${repr(expected1)}`, RecordResult(HashEqual(result2, expected1)), {result: repr(result2)});
    TestPrint("The value returned for no keys should be a hash", RecordResult(HashCheck(result3)), {no_result: true});
    TestPrint(`The attributes hash should be equal to ${repr(expected2)}`, RecordResult(HashEqual(result3, expected2)), {result: repr(result3)});

    console.log("Checking getDOMArrayDataValues");
    expected1 = ["test1"];
    resultarray1 = Utility.getDOMArrayDataValues($domarray, 'test1');
    TestPrint("The value returned should be an array", RecordResult(ArrayCheck(resultarray1)), {no_result: true});
    TestPrint(`Data values for array should be ${repr(expected1)}`, RecordResult(ArrayEqual(expected1, resultarray1)), {result: repr(resultarray1)});

    console.log("Checking isNamespaceBound");
    string1 = 'checklibraries.test_hover';
    resultbool1 = Utility.isNamespaceBound({root: "#checklibrary-count", eventtype: 'mouseover', namespace: string1});
    TestPrint(`Bound event names for object should include ${repr(string1)}`, RecordResult(resultbool1), {result: repr(resultbool1)});

    console.log("Checking hasDOMDataKey");
    string1 = 'test_data';
    resultbool1 = Utility.hasDOMDataKey({selector: "#checklibrary-count", key: string1});
    TestPrint(`DOM data keys for object should include ${repr(string1)}`, RecordResult(resultbool1 === true), {no_result: true});

    console.log("Checking setDataAttribute");
    Utility.setDataAttribute($domarray, 'test3', 'on');
    result1 = $domarray.attr('data-test3');
    result2 = $domarray.data('test3');
    TestPrint(`Setting the data attribute 'test3' should set the 'data-test3' attribute`, RecordResult(result1 === 'on'), {result: repr(result1)});
    TestPrint(`Setting the data attribute 'test3' should set the 'test3' data value`, RecordResult(result2 === 'on'), {result: repr(result2)});

    //Skipping the getElemPosition test. No way to reliably test this.

    console.log("Checking getMeta");
    let metaselector1 = "csrf-param";
    let expectedmeta1 = "authenticity_token";
    let resultmeta1 = Utility.getMeta(metaselector1);
    TestPrint(`Meta ${metaselector1} should have the content of ${repr(expectedmeta1)}`, RecordResult(expectedmeta1 === resultmeta1), {result: repr(resultmeta1)});

    console.log("Checking recheckInterval");
    let checkvalue1 = false;
    let checkvalue2 = false;
    let checkvalue3 = false;
    let iterator1 = 0;
    let iterator2 = 0;
    let timer1 = Utility.recheckInterval({
        check: () => {
            console.log("[Non-expiring] Checking value", ++iterator1, "times.");
            return checkvalue1;
        },
        success: () => {checkvalue2 = true;},
        interval: 100,
    });
    let timer2 = Utility.recheckInterval({
        check: () => {
            console.log("[Expiring] Checking value", ++iterator2, "times.");
            return checkvalue1;
        },
        success: () => {checkvalue3 = true;},
        interval: 100,
        duration: 100,
    });
    await Utility.sleep(Utility.one_second);
    checkvalue1 = true;
    await Utility.sleep(Utility.one_second);
    TestPrint(`Non-expiring timer should have been successful`, RecordResult(timer1.timer === true), {result: repr(timer1)});
    TestPrint(`Non-expiring timer should have changed value to true`, RecordResult(checkvalue2 === true), {result: checkvalue2});
    TestPrint(`Expiring timer should have not been successful`, RecordResult(timer2.timer === false), {no_result: true});
    TestPrint(`Expiring timer should have left value at false`, RecordResult(checkvalue3 === false), {no_result: true});

    console.log("Checking readCookie");
    let cookiename1 = "doesnt-exist";
    result1 = Utility.readCookie(cookiename1);
    TestPrint(`Cookie ${cookiename1} should not exist`, RecordResult(result1 === null), {result: result1});

    console.log("Checking createCookie");
    let value1 = 'doesexist';
    Utility.createCookie(cookiename1, value1);
    result1 = Utility.readCookie(cookiename1);
    TestPrint(`Cookie ${cookiename1} should now exist with value 'doesexist'`, RecordResult(result1 === value1), {result: result1});

    console.log("Checking eraseCookie");
    Utility.eraseCookie(cookiename1);
    result1 = Utility.readCookie(cookiename1);
    TestPrint(`Cookie ${cookiename1} should now not exist after being erased`, RecordResult(result1 === null), {result: result1});

    console.log("Checking getDomainName");
    string1 = "http://danbooru.donmai.us";
    string2 = "donmai.us";
    string3 = Utility.getDomainName(string1, {level: 2});
    TestPrint(`URL of ${string1} should have a base domain of ${string2}`, RecordResult(string2 === string3), {result: string3});

    console.log("Checking parseParams");
    string1 = "test1=2&test2=3";
    object1 = {test1: "2", test2: "3"};
    result1 = Utility.parseParams(string1);
    TestPrint(`Value ${repr(string1)} should should be changed to ${repr(object1)}`, RecordResult(HashEqual(object1, result1)), {result: repr(result1)});

    console.log("Checking renderParams");
    result1 = Utility.renderParams(object1);
    TestPrint(`Value ${repr(object1)} should should be changed to ${repr(string1)}`, RecordResult(string1 === result1), {result: repr(result1)});

    console.log("Checking renderHTMLTag");
    expected1 = '<a href="/posts/1234">post #1234</a>';
    result1 = Utility.renderHTMLTag('a', 'post #1234', {href: '/posts/1234'});
    TestPrint(`HTML tag should be rendered as ${repr(expected1)}`, RecordResult(expected1 === result1), {result: repr(result1)});

    console.log("Checking HTMLEscape");
    string1 = '& < > "';
    string2 = "&amp; &lt; &gt; &quot;";
    result1 = Utility.HTMLEscape(string1);
    TestPrint(`Value ${repr(string1)} should should be changed to ${repr(string2)}`, RecordResult(string2 === result1), {result: repr(result1)});

    console.log("Checking isBoolean");
    testdata2 = true;
    result1 = Utility.isBoolean(testdata1);
    result2 = Utility.isBoolean(testdata2);
    TestPrint(`Value of ${testdata1} should not be a boolean`, RecordResult(result1 === false), {no_result: true});
    TestPrint(`Value of ${testdata2} should be a boolean`, RecordResult(result2 === true), {no_result: true});

    console.log("Checking isString");
    testdata2 = "test";
    result1 = Utility.isString(testdata1);
    result2 = Utility.isString(testdata2);
    TestPrint(`Value of ${testdata1} should not be a string`, RecordResult(result1 === false), {no_result: true});
    TestPrint(`Value of ${testdata2} should be a string`, RecordResult(result2 === true), {no_result: true});

    console.log("Checking isNumber");
    testdata2 = 22.2;
    result1 = Utility.isNumber(testdata1);
    result2 = Utility.isNumber(testdata2);
    TestPrint(`Value of ${testdata1} should not be a string`, RecordResult(result1 === false), {no_result: true});
    TestPrint(`Value of ${testdata2} should be a string`, RecordResult(result2 === true), {no_result: true});

    console.log("Checking isInteger");
    testdata2 = 22;
    result1 = Utility.isInteger(testdata1);
    result2 = Utility.isInteger(testdata2);
    TestPrint(`Value of ${testdata1} should not be a string`, RecordResult(result1 === false), {no_result: true});
    TestPrint(`Value of ${testdata2} should be a string`, RecordResult(result2 === true), {no_result: true});

    console.log("Checking isHash");
    testdata1 = [];
    testdata2 = {};
    result1 = Utility.isHash(testdata1);
    result2 = Utility.isHash(testdata2);
    TestPrint(`Value of ${testdata1} should not be a hash`, RecordResult(result1 === false), {no_result: true});
    TestPrint(`Value of ${testdata2} should be a hash`, RecordResult(result2 === true), {no_result: true});

    console.log("Checking isArray");
    result1 = Utility.isArray(testdata1);
    result2 = Utility.isArray(testdata2);
    TestPrint(`Value of ${testdata1} should be an array`, RecordResult(result1 === true), {no_result: true});
    TestPrint(`Value of ${testdata2} should not be an array`, RecordResult(result2 === false), {no_result: true});

    console.log("Checking isSet");
    set1 = new Set();
    resultbool1 = Utility.isSet(set1);
    TestPrint(`Set ${repr(set1)} should be a set ${bracket(resultbool1)}`, RecordResult(resultbool1), {no_result: true});

    console.log("Checking isID");
    testdata1 = 1234;
    result1 = Utility.isID(testdata1);
    result2 = Utility.isID(testdata2);
    TestPrint(`Record ID of ${testdata1} should be valid`, RecordResult(result1 === true), {no_result: true});
    TestPrint(`Record ID of ${testdata2} should be invalid`, RecordResult(result2 === false), {no_result: true});

    console.log("Checking isIDList");
    testdata1 = [1, 2, 3, 4];
    testdata2 = [1, 'a', -1, null];
    result1 = Utility.isIDList(testdata1);
    result2 = Utility.isIDList(testdata2);
    TestPrint(`Record ID of ${testdata1} should be valid`, RecordResult(result1 === true), {no_result: true});
    TestPrint(`Record ID of ${testdata2} should be invalid`, RecordResult(result2 === false), {no_result: true});

    console.log(`CheckUtilityLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

function CheckStatisticsLibrary() {
    console.log("++++++++++++++++++++CheckStatisticsLibrary++++++++++++++++++++");
    console.log("Start time:", Utility.getProgramTime());
    ResetResult();

    console.log("Checking average");
    let data1 = [0, 1, 2, 3, 4, 20];
    let data2 = [];
    let expected_result1 = 5;
    let result1 = Statistics.average(data1);
    let result2 = Statistics.average(data2);
    TestPrint(`Values of ${repr(data1)} should have an average of ${expected_result1}`, RecordResult(result1 === expected_result1), {result: result1});
    TestPrint(`An empty array should have an average of NaN`, RecordResult(Number.isNaN(result2)), {result: result2});

    console.log("Checking standardDeviation");
    expected_result1 = 6.83;
    result1 = RoundToHundredth(Statistics.standardDeviation(data1));
    TestPrint(`Values of ${repr(data1)} should have a standard deviation of ${expected_result1}`, RecordResult(result1 === expected_result1), {no_result: true});

    console.log("Checking removeOutliers");
    result1 = Statistics.removeOutliers(data1);
    TestPrint(`Values of ${repr(data1)} should have had 1 outlier removed`, RecordResult((data1.length - result1.length) === 1), {no_result: true});

    console.log(`CheckStatisticsLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

function CheckValidateLibrary() {
    console.log("++++++++++++++++++++CheckValidateLibrary++++++++++++++++++++");
    console.log("Start time:", Utility.getProgramTime());
    ResetResult();

    var testdata1;
    var testdata2;
    var result1;
    var result2;
    var result3;
    var result4;

    //For checking library with/without validate installed
    if (typeof validate === "function") {
        console.log("Checking boolean_constraints");
        testdata1 = {value: null};
        testdata2 = {value: false};
        result1 = validate(testdata1, {value: Validate.boolean_constraints});
        result2 = validate(testdata2, {value: Validate.boolean_constraints});
        TestPrint(`Object ${repr(testdata1)} should have 1 validation error`, RecordResult(GetValidationLength(result1) === 1), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should have 0 validation errors`, RecordResult(GetValidationLength(result2) === 0), {no_result: true});

        console.log("Checking number_constraints");
        testdata1 = {value: "test"};
        testdata2 = {value: 0};
        result1 = validate(testdata1, {value: Validate.number_constraints});
        result2 = validate(testdata2, {value: Validate.number_constraints});
        TestPrint(`Object ${repr(testdata1)} should have 1 validation error`, RecordResult(GetValidationLength(result1) === 1), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should have 0 validation errors`, RecordResult(GetValidationLength(result2) === 0), {no_result: true});

        console.log("Checking integer_constraints");
        testdata1 = {value: 1.44};
        testdata2 = {value: 0};
        result1 = validate(testdata1, {value: Validate.integer_constraints});
        result2 = validate(testdata2, {value: Validate.integer_constraints});
        TestPrint(`Object ${repr(testdata1)} should have 1 validation error`, RecordResult(GetValidationLength(result1) === 1), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should have 0 validation errors`, RecordResult(GetValidationLength(result2) === 0), {no_result: true});

        console.log("Checking nonnegative_integer_constraints");
        testdata1 = {value: -1};
        testdata2 = {value: 0};
        result1 = validate(testdata1, {value: Validate.nonnegative_integer_constraints});
        result2 = validate(testdata2, {value: Validate.nonnegative_integer_constraints});
        TestPrint(`Object ${repr(testdata1)} should have 1 validation error`, RecordResult(GetValidationLength(result1) === 1), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should have 0 validation errors`, RecordResult(GetValidationLength(result2) === 0), {no_result: true});

        console.log("Checking positive_integer_constraints");
        testdata1 = {value: 0};
        testdata2 = {value: 1};
        result1 = validate(testdata1, {value: Validate.positive_integer_constraints});
        result2 = validate(testdata2, {value: Validate.positive_integer_constraints});
        TestPrint(`Object ${repr(testdata1)} should have 1 validation error`, RecordResult(GetValidationLength(result1) === 1), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should have 0 validation errors`, RecordResult(GetValidationLength(result2) === 0), {no_result: true});

        console.log("Checking stringonly_constraints");
        testdata1 = {value: null};
        testdata2 = {value: "test"};
        result1 = validate(testdata1, {value: Validate.stringonly_constraints});
        result2 = validate(testdata2, {value: Validate.stringonly_constraints});
        TestPrint(`Object ${repr(testdata1)} should have 1 validation error`, RecordResult(GetValidationLength(result1) === 1), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should have 0 validation errors`, RecordResult(GetValidationLength(result2) === 0), {no_result: true});

        console.log("Checking stringnull_constraints");
        testdata1 = {value: 0};
        testdata2 = {value: null};
        result1 = validate(testdata1, {value: Validate.stringnull_constraints});
        result2 = validate(testdata2, {value: Validate.stringnull_constraints});
        TestPrint(`Object ${repr(testdata1)} should have 1 validation error`, RecordResult(GetValidationLength(result1) === 1), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should have 0 validation errors`, RecordResult(GetValidationLength(result2) === 0), {no_result: true});

        console.log("Checking string_constraints");
        testdata1 = {value: 'test'};
        testdata2 = {value: null};
        result1 = validate(testdata1, {value: Validate.string_constraints({length: {is: 4}})});
        result2 = validate(testdata2, {value: Validate.string_constraints({string: {allowNull: true}})});
        TestPrint(`Object ${repr(testdata1)} should have 0 validation error`, RecordResult(GetValidationLength(result1) === 0), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should have 0 validation errors`, RecordResult(GetValidationLength(result2) === 0), {no_result: true});

        console.log("Checking hash_constraints");
        testdata1 = {value: "0"};
        testdata2 = {value: {}};
        result1 = validate(testdata1, {value: Validate.hash_constraints});
        result2 = validate(testdata2, {value: Validate.hash_constraints});
        TestPrint(`Object ${repr(testdata1)} should have 1 validation error`, RecordResult(GetValidationLength(result1) === 1), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should have 0 validation errors`, RecordResult(GetValidationLength(result2) === 0), {no_result: true});

        console.log("Checking hashentry_constraints");
        testdata1 = {value: null};
        testdata2 = {value: {}, expires: 0};
        result1 = validate(testdata1, Validate.hashentry_constraints);
        result2 = validate(testdata2, Validate.hashentry_constraints);
        console.log(result1, result2);
        TestPrint(`Object ${repr(testdata1)} should have 2 validation error`, RecordResult(GetValidationLength(result1) === 2), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should have 0 validation errors`, RecordResult(GetValidationLength(result2) === 0), {no_result: true});

        console.log("Checking array_constraints");
        testdata1 = {value: null};
        testdata2 = {value: ["test"]};
        result1 = validate(testdata1, {value: Validate.array_constraints()});
        result2 = validate(testdata2, {value: Validate.array_constraints({is: 1})});
        TestPrint(`Object ${repr(testdata1)} should have 1 validation error`, RecordResult(GetValidationLength(result1) === 1), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should have 0 validation errors`, RecordResult(GetValidationLength(result2) === 0), {no_result: true});

        console.log("Checking arrayentry_constraints");
        testdata1 = {expires: -1};
        testdata2 = {value: [], expires: 0};
        result1 = validate(testdata1, Validate.arrayentry_constraints());
        result2 = validate(testdata2, Validate.arrayentry_constraints({maximum: 1}));
        TestPrint(`Object ${repr(testdata1)} should have 2 validation errors`, RecordResult(GetValidationLength(result1) === 2), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should have 0 validation errors`, RecordResult(GetValidationLength(result2) === 0), {no_result: true});

        console.log("Checking tagentryarray_constraints");
        testdata1 = {value: null};
        testdata2 = {value: [["tag", 0]]};
        result1 = validate(testdata1, {value: Validate.tagentryarray_constraints()});
        result2 = validate(testdata2, {value: Validate.tagentryarray_constraints()});
        result3 = validate(testdata2, {value: Validate.tagentryarray_constraints([1])});
        TestPrint(`Object ${repr(testdata1)} should have 1 validation error`, RecordResult(GetValidationLength(result1) === 1), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should have 0 validation errors`, RecordResult(GetValidationLength(result2) === 0), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} with valid tag categories [1] should have 1 validation error`, RecordResult(GetValidationLength(result3) === 1), {no_result: true});

        console.log("Checking inclusion_constraints");
        testdata1 = {value: null};
        testdata2 = {value: "dog"};
        let inclusion1 = ["dog", "cat"];
        result1 = validate(testdata1, {value: Validate.inclusion_constraints(inclusion1)});
        result2 = validate(testdata2, {value: Validate.inclusion_constraints(inclusion1)});
        TestPrint(`Object ${repr(testdata1)} with inclusion ${repr(inclusion1)} should have 1 validation error`, RecordResult(GetValidationLength(result1) === 1), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} with inclusion ${repr(inclusion1)} should have 0 validation errors`, RecordResult(GetValidationLength(result2) === 0), {no_result: true});

        console.log("Checking validateIsHash");
        testdata1 = [];
        testdata2 = {};
        result1 = Validate.validateIsHash('test', testdata1);
        result2 = Validate.validateIsHash('test', testdata2);
        TestPrint(`Object ${repr(testdata1)} should return false`, RecordResult(result1 === false), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should return true`, RecordResult(result2 === true), {no_result: true});

        console.log("Checking validateIsArray");
        testdata1 = {};
        testdata2 = [1, 2, 3];
        result1 = Validate.validateIsArray('test', testdata1, 3);
        result2 = Validate.validateIsArray('test', testdata2, 3);
        TestPrint(`Object ${repr(testdata1)} should return false`, RecordResult(result1 === false), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should return true`, RecordResult(result2 === true), {no_result: true});

        console.log("Checking validateHashEntries");
        testdata1 = {value: 5, expires: true};
        testdata2 = {value: [1, 2, 3, 4], expires: 0};
        let validator1 = Validate.arrayentry_constraints({is: 4});
        result1 = Validate.validateHashEntries('test', testdata1, validator1);
        result2 = Validate.validateHashEntries('test', testdata2, validator1);
        TestPrint(`Object ${repr(testdata1)} should return false`, RecordResult(result1 === false), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should return true`, RecordResult(result2 === true), {no_result: true});

        console.log("Checking validateHashArrayEntries");
        testdata1 = [{a: 5, b: 'c'}];
        testdata2 = [{a: 5, b: 6}];
        validator1 = {a: Validate.positive_integer_constraints, b: Validate.positive_integer_constraints};
        result1 = Validate.validateHashArrayEntries('test', testdata1, validator1);
        result2 = Validate.validateHashArrayEntries('test', testdata2, validator1);
        TestPrint(`Object ${repr(testdata1)} should return false`, RecordResult(result1 === false), {no_result: true});
        TestPrint(`Object ${repr(testdata2)} should return true`, RecordResult(result2 === true), {no_result: true});

    }

    console.log("Checking validateArrayValues");
    testdata1 = [-1, -2, 3, 4];
    testdata2 = [1, 2, 3, 4];
    let testdata3 = ["one", "two", "three", "four"];
    let testdata4 = [1.2, 1.5];
    let testdata5 = [null, null];
    let result0 = Validate.validateArrayValues('test', null, Validate.basic_integer_validator);
    result1 = Validate.validateArrayValues('test', testdata1, Validate.basic_integer_validator);
    result2 = Validate.validateArrayValues('test', testdata2, Validate.basic_ID_validator);
    result3 = Validate.validateArrayValues('test', testdata3, Validate.basic_stringonly_validator);
    result4 = Validate.validateArrayValues('test', testdata4, Validate.basic_number_validator);
    let result5 = Validate.validateArrayValues('test', testdata5, Validate.basic_stringonly_validator);
    TestPrint(`null value should not be an array`, RecordResult(!result0), {no_result: true});
    TestPrint(`Object ${repr(testdata1)} should be all integers`, RecordResult(result1), {no_result: true});
    TestPrint(`Object ${repr(testdata2)} should be all IDs`, RecordResult(result2), {no_result: true});
    TestPrint(`Object ${repr(testdata3)} should be all strings`, RecordResult(result3), {no_result: true});
    TestPrint(`Object ${repr(testdata4)} should be all numbers`, RecordResult(result4), {no_result: true});
    TestPrint(`Object ${repr(testdata5)} is not all strings`, RecordResult(!result5), {no_result: true});

    console.log("Checking correctArrayValues");
    testdata1 = [-1, -2, 3, 4];
    testdata2 = ["one", "two", "three", "four"];
    result0 = Validate.correctArrayValues('test0', null, Validate.basic_integer_validator);
    result1 = Validate.correctArrayValues('test1', testdata1, Validate.basic_ID_validator);
    result2 = Validate.correctArrayValues('test2', testdata2, Validate.basic_stringonly_validator);
    Utility.multiConcat(result0, result1, result2).forEach((message) => {console.log(message);});
    TestPrint(`null value should not be an array`, RecordResult(result0[0] === 'test0 is not an array.'), {no_result: true});
    TestPrint(`Object ${repr(testdata1)} should have two corrections`, RecordResult(result1.length === 2), {no_result: true});
    TestPrint(`Object ${repr(testdata2)} should have no corrections`, RecordResult(result2.length === 0), {no_result: true});

    console.log("Checking validateHashValues");
    testdata1 = {a: -1, b: -2, c: 3, d: 4};
    testdata2 = {a: 1, b: 2, c: 3, d: 4};
    testdata3 = {a: "one", b: "two", c: "three", d: "four"};
    testdata4 = {a: null, b: null, c: null, d: null};
    result1 = Validate.validateHashValues('test0', testdata1, Validate.basic_integer_validator);
    result2 = Validate.validateHashValues('test1', testdata2, Validate.basic_ID_validator);
    result3 = Validate.validateHashValues('test2', testdata3, Validate.basic_stringonly_validator);
    result4 = Validate.validateHashValues('test3', testdata4, Validate.basic_stringonly_validator);
    TestPrint(`Object ${repr(testdata1)} should be all integers`, RecordResult(result1), {no_result: true});
    TestPrint(`Object ${repr(testdata2)} should be all IDs`, RecordResult(result2), {no_result: true});
    TestPrint(`Object ${repr(testdata3)} should be all strings`, RecordResult(result3), {no_result: true});
    TestPrint(`Object ${repr(testdata4)} is not all strings`, RecordResult(!result4), {no_result: true});

    console.log(`CheckValidateLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

async function CheckStorageLibrary() {
    console.log("++++++++++++++++++++CheckStorageLibrary++++++++++++++++++++");
    console.log("Start time:", Utility.getProgramTime());
    ResetResult();

    console.log("Checking setStorageData");
    let data1 = ["check this"];
    let data2 = JSON.stringify(data1);
    Storage.setSessionData('session-value', data1);
    Storage.setLocalData('local-value', data1);
    let result1 = sessionStorage.getItem('session-value');
    let result2 = localStorage.getItem('local-value');
    TestPrint(`session-value stored in sessionStorage as ${repr(result1)} should be equal to the stringified data`, RecordResult(result1 === data2), {result: repr(data1)});

    console.log("Checking removeStorageData");
    Storage.setSessionData('remove-value', 'blah');
    Storage.removeSessionData('remove-value');
    result1 = sessionStorage.getItem('remove-value');
    TestPrint("Removed value should return null", RecordResult(result1 === null), {result: repr(result1)});

    console.log("Checking getStorageData");
    data1 = `[check this]`;
    data2 = ["check this"];
    sessionStorage.setItem('bad-value', data1);
    Storage.setSessionData('good-value', data2);
    result1 = Storage.getSessionData('bad-value');
    result2 = Storage.getSessionData('good-value');
    let result3 = Storage.getSessionData('nonexistent-value', {default_val: [0]});
    sessionStorage.setItem('good-value', JSON.stringify(data1));
    let result4 = Storage.getSessionData('good-value', {bypass: true});
    TestPrint(`bad-value with data ${repr(data1)} should return null`, RecordResult(result1 === null), {result: repr(result1)});
    TestPrint(`good-value with data ${repr(data2)} should return value`, RecordResult(result2?.[0] === "check this"), {result: repr(result2)});
    TestPrint("nonexistant-value with default value [0] should return default value", RecordResult(result3?.[0] === 0), {result: repr(result3)});
    TestPrint(`good-value should return updated data when bypassing memory storage`, RecordResult(result4 === data1), {result: repr(result4)});

    console.log("Checking invalidateStorageData");
    data1 = ["check this"];
    Storage.setSessionData('memory-value', data1);
    result1 = Storage.inMemoryStorage('memory-value', sessionStorage);
    Storage.invalidateSessionData('memory-value');
    result2 = !Storage.inMemoryStorage('memory-value', sessionStorage);
    TestPrint("memory-value should be in memory storage after setting its value", RecordResult(result1), {no_result: true});
    TestPrint("memory-value should not be in memory storage after invalidating its value", RecordResult(result2), {no_result: true});

    console.log("Checking checkStorageData");
    let validator1 = function () { return true;};
    let validator2 = function () { return false;};
    Storage.invalidateSessionData('good-value');
    result1 = Storage.checkSessionData('good-value', {validator: validator1});
    Storage.invalidateSessionData('good-value');
    result2 = Storage.checkSessionData('good-value', {validator: validator2});
    TestPrint(`data with good validate should return value`, RecordResult(result1 === "[check this]"), {result: repr(result1)});
    TestPrint(`data with bad validate should return null`, RecordResult(result2 === null), {result: repr(result2)});

    console.log("Checking storage quota exceeded");
    let testvalue = "test".repeat(1000);
    let expectedsize1 = JSON.stringify(sessionStorage).length + JSON.stringify({expires: 1, value: testvalue}).length * 2000;
    for (let i = 0; i < 2000; i++) {
        Storage.setStorageData('test' + i, {expires: 1, value: testvalue}, sessionStorage);
    }
    let testsize1 = JSON.stringify(sessionStorage).length;
    TestPrint(`expected size of storage ${bracket(expectedsize1)} should be greater than actual size`, RecordResult(expectedsize1 > testsize1), {result: testsize1});

    console.log("Checking hasDataExpired");
    let max_expiration1 = 100000;
    let data3 = {expires: Date.now() - max_expiration1, value: data2};
    let data4 = {expires: Date.now() + max_expiration1, value: data2};
    result1 = Storage.hasDataExpired("result1", undefined);
    result2 = Storage.hasDataExpired("result2", data2);
    result3 = Storage.hasDataExpired("result3", data3);
    result4 = Storage.hasDataExpired("result4", data4);
    let result5 = Storage.hasDataExpired("result5", data4, 1000);
    TestPrint(`undefined data should have expired`, RecordResult(result1 === true), {result: repr(result1)});
    TestPrint(`data with no expires ${repr(data2)} should have expired`, RecordResult(result2 === true), {result: repr(result2)});
    TestPrint(`data with expires ${repr(data3)} should have expired`, RecordResult(result3 === true), {result: repr(result3)});
    TestPrint(`data with expires ${repr(data4)} should not have expired`, RecordResult(result4 === false), {result: repr(result4)});
    TestPrint(`data with expires ${repr(data4)} should have an expiration that is too long`, RecordResult(result5 === true), {result: repr(result5)});

    console.log("Checking setIndexedSessionData");
    data1 = ["check this"];
    data2 = JSON.stringify(data1);
    Storage.setIndexedSessionData('session-value', data1);
    result1 = sessionStorage.getItem('danbooru-storage-session-value');
    TestPrint(`Indexed session-value stored in sessionStorage as ${repr(data2)} should be equal to the stringified data`, RecordResult(result1 === data2), {result: repr(result1)});

    console.log("Checking removeIndexedSessionData");
    Storage.setStorageData('danbooru-storage-remove-value', 'blah', sessionStorage);
    Storage.removeIndexedSessionData('remove-value');
    result1 = sessionStorage.getItem('danbooru-storage-remove-value');
    TestPrint('Removed value should return null', RecordResult(result1 === null), {result: repr(result1)});

    console.log("Checking getIndexedSessionData");
    data1 = `[check this]`;
    data2 = ["check this"];
    sessionStorage.setItem('danbooru-storage-bad-value', data1);
    Storage.setStorageData('danbooru-storage-good-value', data2, sessionStorage);
    result1 = Storage.getIndexedSessionData('bad-value');
    result2 = Storage.getIndexedSessionData('good-value');
    result3 = Storage.getIndexedSessionData('nonexistent-value', {default_val: [0]});
    TestPrint(`bad-value with data ${repr(data1)} should return null`, RecordResult(result1 === null), {result: repr(result1)});
    TestPrint(`good-value with data ${repr(data2)} should return value`, RecordResult(result2?.[0] === "check this"), {result: repr(result2)});
    TestPrint('nonexistant-value with default value [0] should return default value', RecordResult(result3?.[0] === 0), {result: repr(result3)});

    console.log("Checking invalidateIndexedSessionData");
    data1 = ["check this"];
    Storage.setIndexedSessionData('memory-value', data1);
    result1 = Storage.inMemoryStorage('memory-value', sessionStorage, Storage.danboorustorage);
    Storage.invalidateIndexedSessionData('memory-value');
    result2 = !Storage.inMemoryStorage('memory-value', sessionStorage, Storage.danboorustorage);
    TestPrint("memory-value should not be defined after setting it's value", RecordResult(result1), {no_result: true});
    TestPrint("memory-value should be undefined after invalidating it's value", RecordResult(result2), {no_result: true});

    //For checking library with/without localforage installed
    if (Storage.use_storage) {
        console.log("Checking saveData");
        await Storage.saveData('good-value', data2);
        result1 = Storage.getIndexedSessionData('good-value');
        result2 = await Storage.danboorustorage.getItem('good-value');
        TestPrint(`good-value with data ${repr(data2)} should return value (sessionStorage)`, RecordResult(result1?.[0] === "check this"), {result: repr(result1)});
        TestPrint(`good-value with data ${repr(data2)} should return value (indexedDB)`, RecordResult(result2?.[0] === "check this"), {result: repr(result2)});

        console.log("Checking retrieveData");
        sessionStorage.removeItem('bad-value');
        await Storage.danboorustorage.removeItem('bad-value');
        result1 = await Storage.retrieveData('bad-value');
        result2 = await Storage.retrieveData('good-value');
        Storage.removeIndexedSessionData('good-value');
        result3 = await Storage.retrieveData('good-value');
        TestPrint(`bad-value with no entry should return null`, RecordResult(result1 === null), {result: repr(result1)});
        TestPrint(`good-value with data ${repr(data1)} should return value (sessionStorage)`, RecordResult(result2?.[0] === "check this"), {result: repr(result2)});
        TestPrint(`good-value with data ${repr(data1)} should return value (indexedDB)`, RecordResult(result3?.[0] === "check this"), {result: repr(result3)});

        console.log("Checking removeData");
        Storage.removeData('good-value');
        result1 = Storage.getIndexedSessionData('good-value');
        result2 = await Storage.danboorustorage.getItem('good-value');
        TestPrint(`good-value with data deleted should return null (sessionStorage)`, RecordResult(result1 === null), {result: repr(result1)});
        TestPrint(`good-value with data deleted should return null (indexedDB)`, RecordResult(result2 === null), {result: repr(result2)});

        console.log("Checking checkData");
        let data5 = {expires: 0, value: data2};
        await Storage.saveData('expired-value', data3);
        await Storage.saveData('good-value', data4);
        await Storage.saveData('persistent-value', data5);
        result1 = await Storage.checkData('expired-value', max_expiration1, {validator: validator1});
        result2 = await Storage.checkData('good-value', max_expiration1, {validator: validator2});
        result3 = await Storage.checkData('good-value', max_expiration1, {validator: validator1});
        result4 = await Storage.checkData('persistent-value', max_expiration1, {validator: validator1});
        TestPrint(`expired-value with data ${repr(data3)} should return null`, RecordResult(result1 === null), {result: repr(result1)});
        TestPrint(`good-value with data ${repr(data4)} with false validation should return null`, RecordResult(result2 === null), {result: repr(result2)});
        TestPrint(`good-value with data ${repr(data4)} with true validation should return value`, RecordResult(result3?.value?.[0] === "check this"), {result: repr(result3)});
        TestPrint(`persistent-value with data ${repr(data5)} should return value`, RecordResult(result4?.expires === 0 && result4?.value?.[0] === "check this"), {result: repr(result4)});

        console.log("Checking batchSaveData");
        let value1 = {expires: 0, value: 1};
        let value2 = {expires: 0, value: true};
        let batchdata1 = {value1, value2};
        await Storage.batchSaveData(batchdata1);
        result1 = Storage.getIndexedSessionData('value1');
        result2 = Storage.getIndexedSessionData('value2');
        result3 = await Storage.danboorustorage.getItem('value1');
        result4 = await Storage.danboorustorage.getItem('value2');
        TestPrint(`value1 with data ${repr(value1)} should return value (sessionStorage)`, RecordResult(result1?.value === 1), {result: repr(result1)});
        TestPrint(`value2 with data ${repr(value2)} should return value (sessionStorage)`, RecordResult(result2?.value === true), {result: repr(result2)});
        TestPrint(`value1 with data ${repr(value1)} should return value (indexedDB)`, RecordResult(result3?.value === 1), {result: repr(result3)});
        TestPrint(`value2 with data ${repr(value2)} should return value (indexedDB)`, RecordResult(result4?.value === true), {result: repr(result4)});

        console.log("Checking batchRetrieveData");
        let keylist1 = ['value1', 'value2', 'value3'];
        let keylist2 = ['value1', 'value2'];
        keylist1.forEach((key) => {
            Storage.removeIndexedSessionData(key);
        });
        result1 = await Storage.batchRetrieveData(keylist1);
        result2 = Object.keys(result1);
        TestPrint(`Batch retrieval of ${repr(keylist1)} should return the keys ${repr(keylist2)}`, RecordResult(ArrayEqual(keylist2, result2)), {result: repr(result2)});
        TestPrint(`value1 with data ${repr(value1)} should return value`, RecordResult(result1.value1?.value === 1), {result: repr(result1.value1)});
        TestPrint(`value2 with data ${repr(value2)} should return value`, RecordResult(result1.value2?.value === true), {result: repr(result1.value2)});

        console.log("Checking batchCheckData");
        keylist1.forEach((key) => {
            Storage.removeIndexedSessionData(key);
        });
        result1 = await Storage.batchCheckData(keylist1, {validator: () => (true)});
        result2 = Object.keys(result1);
        TestPrint(`Batch retrieval of ${repr(keylist1)} should return the keys ${repr(keylist2)}`, RecordResult(ArrayEqual(keylist2, result2)), {result: repr(result2)});
        TestPrint(`value1 with data ${repr(value1)} should return value`, RecordResult(result1.value1?.value === 1), {result: repr(result1.value1)});
        TestPrint(`value2 with data ${repr(value2)} should return value`, RecordResult(result1.value2?.value === true), {result: repr(result1.value2)});

        console.log("Checking batchRemoveData");
        await Storage.batchRemoveData(keylist2);
        result1 = Storage.getIndexedSessionData('value1');
        result2 = Storage.getIndexedSessionData('value2');
        result3 = await Storage.danboorustorage.getItem('value1');
        result4 = await Storage.danboorustorage.getItem('value2');
        TestPrint("value1 should return null (sessionStorage)", RecordResult(result1 === null), {result: repr(result1)});
        TestPrint("value2 should return null (sessionStorage)", RecordResult(result2 === null), {result: repr(result2)});
        TestPrint("value1 should return null (indexedDB)", RecordResult(result3 === null), {result: repr(result3)});
        TestPrint("value2 should return null (indexedDB)", RecordResult(result4 === null), {result: repr(result4)});

        console.log("Checking pruneCache");
        await Storage.pruneCache(/-value$/);
        result1 = await Storage.retrieveData('expired-value');
        result2 = await Storage.retrieveData('good-value');
        TestPrint("expired-value should be pruned and return null with retrieveData", RecordResult(result1 === null), {result: repr(result1)});
        TestPrint("good-value shouldn't be pruned and return value with retrieveData", RecordResult(result2?.value?.[0] === "check this"), {result: repr(result2)});

        console.log("Checking pruneProgramCache");
        await Storage.saveData('expired-value', data3);
        await Storage.saveData('good-value', data4);
        await Storage.pruneProgramCache(/-value$/, Utility.one_minute);
        result1 = await Storage.retrieveData('expired-value');
        result2 = await Storage.retrieveData('good-value');
        TestPrint("expired-value should be pruned and return null with retrieveData", RecordResult(result1 === null), {result: repr(result1)});
        TestPrint("good-value shouldn't be pruned and return value with retrieveData", RecordResult(result2?.value?.[0] === "check this"), {result: repr(result2)});

        console.log("Checking purgeCache");
        await Storage.saveData('expired-value', data3);
        await Storage.saveData('good-value', data4);
        await Storage.purgeCache(/^(good|expired|persistent)-value$/, "#checklibrary-count");
        result1 = await Storage.retrieveData('expired-value');
        result2 = await Storage.retrieveData('good-value');
        result3 = await Storage.retrieveData('persistent-value');
        TestPrint("expired-value should be pruned and return null with retrieveData", RecordResult(result1 === null), {result: repr(result1)});
        TestPrint("good-value should be pruned and return null with retrieveData", RecordResult(result2 === null), {result: repr(result2)});
        TestPrint("persistent-value should be pruned and return null with retrieveData", RecordResult(result3 === null), {result: repr(result3)});

        console.log("Checking programCacheInfo");
        await Storage.saveData('expired-value', data3);
        await Storage.saveData('good-value', data4);
        result1 = await Storage.programCacheInfo(/^(good|expired)-value$/);
        result2 = Object.keys(result1);
        TestPrint("Cache info should have 3 storage keys", RecordResult(ArrayEqual(result2, ['index', 'session', 'local'], false)), {result: result2});
        TestPrint("Cache info should have 2 Index DB items", RecordResult(result1.index.program_items === 2), {result: result1.index.program_items});
        TestPrint("Cache info should have 2 session storage items", RecordResult(result1.session.program_items === 2), {result: result1.session.program_items});
        TestPrint("Cache info should have 2 local storage items", RecordResult(result1.local.program_items === 2), {result: result1.local.program_items});
    }

    //Cleanup actions
    sessionStorage.clear();

    console.log(`CheckStorageLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

async function CheckConcurrencyLibrary() {
    console.log("++++++++++++++++++++CheckConcurrencyLibrary++++++++++++++++++++");
    console.log("Start time:", Utility.getProgramTime());
    ResetResult();

    console.log("Checking reserveSemaphore");
    let key1 = 'cl-process-semaphore-test';
    let key2 = 'cl.semaphore.test';
    localStorage.removeItem(key1);
    let result1 = Concurrency.reserveSemaphore('test');
    let result2 = Storage.getStorageData(key1, localStorage);
    console.log(JSPLib._window);
    let result3 = Utility.isNamespaceBound({root: JSPLib._window, eventtype: 'beforeunload', namespace: key2});
    TestPrint(`Semaphore ${result1} should be equal to saved data`, RecordResult(result1 === result2), {result: result2});
    TestPrint("Before unload event should have been created", RecordResult(result3 === true), {result: result3});

    console.log("Checking checkSemaphore");
    result1 = Concurrency.checkSemaphore('test');
    TestPrint("Semaphore should not be available", RecordResult(result1 === false), {result: result1});

    console.log("Checking freeSemaphore");
    Concurrency.freeSemaphore('test');
    result1 = Concurrency.checkSemaphore('cl', 'test');
    result2 = Utility.isNamespaceBound({root: JSPLib._window, eventtype: 'beforeunload', namespace: key2});
    TestPrint("Semaphore should be available", RecordResult(result1 === true), {result: result1});
    TestPrint("Before unload event should have been cleared", RecordResult(result2 === false), {result: result2});

    console.log("Checking checkTimeout");
    let key3 = 'cl-timeout';
    let expiration1 = Utility.one_second * 10;
    result1 = Concurrency.checkTimeout(key3, expiration1);
    TestPrint("Timeout should be not set / expired", RecordResult(result1 === true), {result: result1});

    console.log("Checking setRecheckTimeout");
    Concurrency.setRecheckTimeout(key3, expiration1);
    result1 = Concurrency.checkTimeout(key3, expiration1);
    TestPrint("Timeout should be set and unexpired", RecordResult(result1 === false), {result: result1});

    //Cleanup actions
    localStorage.removeItem(key1);
    localStorage.removeItem(key3);

    console.log(`CheckConcurrencyLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

async function CheckNetworkLibrary() {
    console.log("++++++++++++++++++++CheckNetworkLibrary++++++++++++++++++++");
    console.log("Start time:", Utility.getProgramTime());
    ResetResult();

    if (typeof GM.xmlHttpRequest !== 'undefined') {
        console.log("Checking getData");
        let size1 = 8687;
        let type1 = "image/jpeg";
        let resp1 = await Network.getData(PREVIEW_URL);
        let boolarray1 = [typeof resp1 === "object" && resp1.constructor.name === "Blob"];
        if(boolarray1[0]) boolarray1.push(resp1.size === size1);
        if(boolarray1[0]) boolarray1.push(resp1.type === type1);
        TestPrint(`Image with URL ${PREVIEW_URL} should be blob with size ${size1} and type ${type1}`, RecordResult(boolarray1.every((val) => val)), {result: repr(boolarray1)});

        console.log("Checking getDataSize");
        size1 = 8687;
        resp1 = await Network.getDataSize(PREVIEW_URL);
        TestPrint(`Image with URL ${PREVIEW_URL} should get the image size of ${size1}`, RecordResult(resp1 === size1), {result: resp1});
    } else {
        console.log("Skipping GM.xmlHttpRequest tests...");
    }

    console.log("Checking processError");
    let error1 = {status: 502};
    let baderror1 = {status: -999, responseText: "Bad error!"};
    let result1 = Network.processError(error1, "CheckNetworkLibrary");
    TestPrint(`The error ${repr(error1)} should be processed to ${repr(baderror1)}`, RecordResult(result1.status === baderror1.status && result1.responseText === baderror1.responseText), {result: repr(result1)});

    console.log("Checking logError");
    Network.error_domname = "#checklibrary-error";
    let num_errors = Network.error_messages.length;
    error1 = {status: 403, responseText: 'Bad redirect!'};
    result1 = Network.logError(error1, 'processError');
    TestPrint('Should have one error logged', RecordResult((Network.error_messages.length - num_errors) === 1), {result: Network.error_messages.length});

    console.log("Checking notifyError"); //Visual confirmation required
    error1 = {status: 502, responseText: '<!doctype html>'};
    Network.notifyError(error1);
    await Utility.sleep(4000);
    jQuery("#close-notice-link").click();
    await Utility.sleep(2000);

    console.log("Checking getNotify"); //Visual confirmation required
    let url1 = "/bad_url";
    await Network.getNotify(url1, {custom_error: "Unable to get bad URL!"});
    await Utility.sleep(4000);
    jQuery("#close-notice-link").click();
    await Utility.sleep(2000);

    console.log("Checking get");
    url1 = "/static/contact";
    let options1 = null;
    let resp = Network.get(url1, {type: 'html', ajax_options: {beforeSend: (jqXHR, settings) => (options1 = settings)}});
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
    resp = Network.post(url1, {data: {_method: 'get'}, type: 'html', ajax_options: {beforeSend: (jqXHR, settings) => (options1 = settings)}});
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
    resp = Network.getJSON(url1, {ajax_options: {beforeSend: (jqXHR, settings) => (options1 = settings)}});
    let json1 = await resp;
    TestPrint('Method should be GET', RecordResult(options1.type === 'GET'), {result: options1.type});
    TestPrint('Response code should be 200', RecordResult(resp.status === 200), {result: resp.status});
    TestPrint('Response data should be a hash', RecordResult(HashCheck(json1)), {result: typeof json1});
    TestPrint('JSON should contain the correct structures', RecordResult(json1?.id === 1 & json1?.md5 === 'd34e4cf0a437a5d65f8e82b7bcd02606'), {result: json1});

    console.log(`CheckNetworkLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

async function CheckDanbooruLibrary() {
    console.log("++++++++++++++++++++CheckDanbooruLibrary++++++++++++++++++++");
    console.log("Start time:", Utility.getProgramTime());
    ResetResult();

    console.log("Checking getNextPageID");
    let array1 = [{id: 25}, {id: 26}, {id: 27}];
    let result1 = Danbooru.getNextPageID(array1, false);
    let result2 = Danbooru.getNextPageID(array1, true);
    TestPrint(`for item array ${repr(array1)}, the next page ID going in forward should be 25`, RecordResult(result1 === 25), {result: result1});
    TestPrint(`for item array ${repr(array1)}, the next page ID going in reverse should be 27`, RecordResult(result2 === 27), {result: result2});

    console.log("Checking postSearchLink");
    let string1 = "1girl solo";
    let string2 = "Check this link";
    let string3 = '<a class="search-tag" href="/posts?tags=1girl+solo">Check this link</a>';
    result1 = Danbooru.postSearchLink(string2, {tags: string1}, {class: 'search-tag'});
    TestPrint(`the tag ${repr(string1)} with text ${repr(string2)} should produce the link  ${repr(string3)}`, RecordResult(result1 === string3), {result: result1});

    console.log("Checking wikiLink");
    string1 = "1girl";
    string2 = "Wiki link";
    string3 = '<a class="category-0" href="/wiki_pages/1girl">Wiki link</a>';
    result1 = Danbooru.wikiLink(string2, string1, {class: 'category-0'});
    TestPrint(`the tag ${repr(string1)} with text ${repr(string2)} should produce the link  ${repr(string3)}`, RecordResult(result1 === string3), {result: result1});

    console.log("Checking query");
    Danbooru.error_domname = "#checklibrary-error";
    let type1 = 'posts';
    let type2 = 'doesntexist';
    let addons1 = {limit: 1};
    result1 = await Danbooru.query(type1, addons1);
    result2 = await Danbooru.query(type2);
    TestPrint(`with type ${type1} and addons ${repr(addons1)}, a single post should have been returned`, RecordResult(ArrayLength(result1, 1)), {result: result1});
    TestPrint(`with nonexistent type ${type2}, null should be returned`, RecordResult(result2 === null), {result: repr(result2)});

    console.log("Checking query (long)");
    result1 = await Danbooru.query(type1, addons1, {long_format: true});
    TestPrint(`with type ${type1} and addons ${repr(addons1)}, a single post should have been returned`, RecordResult(ArrayLength(result1, 1)), {result: result1});

    console.log("Checking queryPageItems");
    type1 = 'users';
    addons1 = {search: {level: 50}, only: 'id,level'}; //Search for admins
    let page1 = 1; //Except for the first admin
    let limit1 = 1; //One at a time
    result1 = await Danbooru.queryPageItems(type1, limit1, {url_addons: addons1, batches: 2, page: page1, reverse: true});
    result2 = Utility.getObjectAttributes(result1, 'id');
    let result3 = result2.sort((a, b) => a - b);
    let result4 = Utility.getObjectAttributes(result1, 'level').reduce((total, entry) => total && entry === 50, true);
    TestPrint(`with type ${type1} and addons ${repr(addons1)}, two users should have been returned`, RecordResult(ArrayLength(result1, 2)), {result: repr(result1)});
    TestPrint("should have also not returned the first user", RecordResult(ArrayIncludes(result2, 1, false)), {result: repr(result2)});
    TestPrint(`should have also returned users in reverse order ${repr(result3)}`, RecordResult(repr(result2) === repr(result3)), {result: repr(result2)});
    TestPrint("should have also returned only admins", RecordResult(result4), {no_result: true});

    console.log("Checking queryPageItems (long)");
    result1 = await Danbooru.queryPageItems(type1, limit1, {url_addons: addons1, batches: 2, page: page1, reverse: true, long_format: true});
    result2 = Utility.getObjectAttributes(result1, 'id');
    result3 = result2.sort((a, b) => a - b);
    result4 = Utility.getObjectAttributes(result1, 'level').reduce((total, entry) => total && entry === 50, true);
    TestPrint(`with type ${type1} and addons ${repr(addons1)}, two users should have been returned`, RecordResult(ArrayLength(result1, 2)), {result: repr(result1)});
    TestPrint("should have also not returned the first user", RecordResult(ArrayIncludes(result2, 1, false)), {result: repr(result2)});
    TestPrint(`should have also returned users in reverse order ${repr(result3)}`, RecordResult(repr(result2) === repr(result3)), {result: repr(result2)});
    TestPrint("should have also returned only admins", RecordResult(result4), {no_result: true});

    console.log("Checking queryPageItems (counter)");
    let users_latest = await Danbooru.query(type1, {limit: 10, only: 'id'});
    let page_start = Danbooru.getNextPageID(users_latest, false);
    let page_end = Danbooru.getNextPageID(users_latest, true);
    array1 = Utility.getObjectAttributes(users_latest, 'id');
    result1 = await Danbooru.queryPageItems(type1, limit1, {page: page_end + 1, url_addons: {search: {id: `${page_end}..${page_start}`}, only: 'id'}, domname: '#checklibrary-count'});
    result2 = Utility.getObjectAttributes(result1, 'id');
    result3 = jQuery('#checklibrary-count').data('latest-id');
    result4 = Number(jQuery('#checklibrary-count').text());
    TestPrint(`getting the latest users with IDs ${repr(array1)} should get the same users`, RecordResult(ArrayEqual(array1, result2)), {result: repr(result2)});
    TestPrint(`the countdown counter latest ID should be ${repr(page_start)}`, RecordResult(result3 === page_start), {result: repr(result3)});
    TestPrint("the countdown counter should end at 0", RecordResult(result4 === 0), {result: repr(result4)});

    console.log("Checking queryIDItems (counter)");
    result1 = await Danbooru.queryIDItems(type1, array1, limit1, {domname: '#checklibrary-count'});
    result2 = Utility.getObjectAttributes(result1, 'id');
    result4 = Number(jQuery('#checklibrary-count').text());
    TestPrint(`getting the latest users with IDs ${repr(array1)} should get the same users`, RecordResult(ArrayEqual(array1, result2)), {result: repr(result2)});
    TestPrint("the countdown counter should end at 0", RecordResult(result4 === 0), {result: repr(result4)});

    console.log(`CheckDanbooruLibrary results: ${test_successes} succeses, ${test_failures} failures`);
}

async function CheckSaucenaoLibrary() {
    console.log("++++++++++++++++++++CheckSaucenaoLibrary++++++++++++++++++++");
    console.log("Start time:", Utility.getProgramTime());
    ResetResult();

    console.log("Checking checkSauce #1");
    let object1 = null;
    result1 = Saucenao.checkSauce(object1);
    TestPrint(`Response of ${repr(object1)} should return a result of false`, RecordResult(result1 === false), {no_result: true}, {result: result1});
    await Utility.sleep(2000);

    console.log("Checking checkSauce #2");
    object1 = {header: {long_remaining: 0}, results: {}};
    result1 = Saucenao.checkSauce(object1);
    TestPrint(`Response of ${repr(object1)} should return a result of true`, RecordResult(result1 === true), {no_result: true});
    await Utility.sleep(2000);

    console.log("Checking checkSauce #3");
    object1 = {header: {long_remaining: 1, short_remaining: 0}, results: {}};
    result1 = Saucenao.checkSauce(object1);
    TestPrint(`Response of ${repr(object1)} should return a result of true`, RecordResult(result1 === true), {no_result: true});
    await Utility.sleep(2000);

    console.log("Checking checkSauce #4");
    object1 = {header: {long_remaining: 1, short_remaining: 1, status: -1, message: 'Some message.'}};
    result1 = Saucenao.checkSauce(object1);
    TestPrint(`Response of ${repr(object1)} should return a result of false`, RecordResult(result1 === false), {no_result: true});
    await Utility.sleep(2000);

    console.log("Checking checkSauce #5");
    object1 = {header: {long_remaining: 1, short_remaining: 1}, results: {}};
    result1 = Saucenao.checkSauce(object1);
    TestPrint(`Response of ${repr(object1)} should return a result of true`, RecordResult(result1 === true), {no_result: true});
    await Utility.sleep(2000);

    console.log("Checking getSauce #1");
    object1 = {header: {long_remaining: 1, short_remaining: 1}, results: {}};
    result1 = await Saucenao.getSauce();
    TestPrint(`No API key should return a result of false`, RecordResult(result1 === false), {no_result: true});
    await Utility.sleep(2000);

    if (typeof GM.xmlHttpRequest !== 'undefined') {
        //Save old settings
        let old_xhr = jQuery.ajaxSettings.xhr;
        Network.jQuerySetup();
        Saucenao.api_key = saucenao_api_key;

        console.log("Checking getSauce #3");
        let num_results = 2;
        let resp1 = await Saucenao.getSauce(PREVIEW_URL, {limit: num_results, notify: true});
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

async function checklibrary() {
    jQuery("footer").prepend('<span id="checklibrary-error" style="font-size:400%">0</span>&emsp;<span id="checklibrary-count" style="font-size:400%">0</span>');
    document.body.style.height = '5000px';
    setTimeout(() => {window.scroll(0, 10000);}, 2000);

    CheckDebugLibrary();
    await CheckUtilityLibrary();
    await CheckNoticeLibrary();
    CheckStatisticsLibrary();
    CheckValidateLibrary();
    await CheckStorageLibrary();
    await CheckConcurrencyLibrary();
    await CheckNetworkLibrary();
    await CheckDanbooruLibrary();
    await CheckSaucenaoLibrary();

    console.log(`All library results: ${overall_test_successes} succeses, ${overall_test_failures} failures`);
}

/****INITIALIZATION****/

JSPLib.shortcut = 'cl';
JSPLib.name = 'CheckLibraries';

Debug.mode = true;
Debug.level = Debug.INFO;

//Export JSPLib
Load.exportData();

/****Execution start****/

Load.programInitialize(checklibrary, {program_name: 'CL', required_variables: ['window.jQuery', 'window.Danbooru'], required_selectors: ["footer"]});

})(JSPLib);
