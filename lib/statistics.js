/****DEPENDENCIES****/

/**Internal dependencies**/
// JSPLib.utility

/****SETUP****/

//Linter configuration
/* global JSPLib */

(function (debug, utility) {

const statistics = JSPLib.statistics;

/****FUNCTIONS****/

//Print data functions

statistics.outputAdjustedMean = function (tablename = '') {
    const printer = debug.getFunctionPrint('statistics.outputAdjustedMean');
    if (Object.keys(debug._records).length === 0) {
        return;
    }
    if (tablename !== '') {
        printer.debuglogLevel(`====${tablename} Metrics====`, debug.INFO);
    }
    let outputtime = {};
    let recordkeys = Object.keys(debug._records);
    for (let i = 0;i < recordkeys.length;i++) {
        let val = debug._records[recordkeys[i]];
        if (!(val.type in outputtime)) {
            outputtime[val.type] = [];
        }
        outputtime[val.type].push(val.endtime - val.starttime);
    }
    let outputkeys = Object.keys(outputtime);
    for (let i = 0;i < outputkeys.length;i++) {
        let type = outputkeys[i];
        let values = outputtime[type];
        let adjvalues = statistics.removeOutliers(values);
        let adjaverage = statistics.average(adjvalues);
        printer.debuglogLevel(type + ':', "num", values.length, "avg", parseFloat(adjaverage.toFixed(2)), "rem", values.length - adjvalues.length, debug.INFO);
    }
};

statistics.addPageStatistics = function () {
    debug.debugExecute(() => {
        JSPLib._window.addEventListener('beforeunload', () => {
            statistics.outputAdjustedMean(JSPLib.program_name);
        });
    });
};

statistics.outputSortedRecords = function(type = null, begin = 0, end = 10) {
    let records = debug._records;
    let record_keys = Object.keys(records);
    if (type !== null) {
        record_keys = record_keys.filter((key) => records[key].type === type);
    }
    record_keys.sort((keya, keyb) => (records[keyb].endtime - records[keyb].starttime) - (records[keya].endtime - records[keya].starttime));
    record_keys = record_keys.slice(begin, end);
    record_keys.forEach((key, i) => {
        let record = records[key];
        let total_time = utility.setPrecision((record.endtime - record.starttime) / 1000, 2);
        let start_time = utility.setPrecision((record.starttime - utility._start_time) / 1000, 2);
        let end_time = utility.setPrecision((record.endtime - utility._start_time) / 1000, 2);
        console.log(i, record.type, record.entryname, total_time, start_time, end_time);
    });
};

//Statistics functions

statistics.removeOutliers = function (values, iterations = Infinity) {
    var i = 1;
    var length;
    var newlength;
    do {
        length = values.length;
        let avg = statistics.average(values);
        let stddev = statistics.standardDeviation(values);
        let adjvalues = values.filter((val) => (Math.abs(val - avg) < (2 * stddev)));
        newlength = adjvalues.length;
        if (newlength === 0) {
            return values;
        }
        values = adjvalues;
        i++;
    } while ((length !== newlength) && (i <= iterations));
    return values;
};

statistics.standardDeviation = function (values) {
    var avg = statistics.average(values);
    return Math.sqrt(statistics.average(values.map((value) => {let diff = value - avg; return diff * diff;})));
};

statistics.average = function (values) {
    if (values.length) {
        return values.reduce((a, b) => a + b) / values.length;
    }
    return NaN;
};

/****INITIALIZATION****/

JSPLib.initializeModule('statistics');

})(JSPLib.debug, JSPLib.utility);
