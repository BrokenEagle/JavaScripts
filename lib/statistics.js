/****DEPENDENCIES****/

/**Internal dependencies**/
// JSPLib.Debug (optional)
// JSPLib.Utility

/****SETUP****/

//Linter configuration
/* global JSPLib */

(function ({Debug, Utility}) {

const Statistics = JSPLib.Statistics;

/****FUNCTIONS****/

//Print data functions

Statistics.outputAdjustedMean = function (tablename = '') {
    const printer = Debug.getFunctionPrint('Statistics.outputAdjustedMean');
    let records = Debug.getRecords();
    if (Object.keys(records).length === 0) {
        return;
    }
    if (tablename !== '') {
        printer.log(`====${tablename} Metrics====`);
    }
    let outputtime = {};
    let recordkeys = Object.keys(records);
    for (let i = 0;i < recordkeys.length;i++) {
        let val = records[recordkeys[i]];
        if (!(val.type in outputtime)) {
            outputtime[val.type] = [];
        }
        outputtime[val.type].push(val.endtime - val.starttime);
    }
    let outputkeys = Object.keys(outputtime);
    for (let i = 0;i < outputkeys.length;i++) {
        let type = outputkeys[i];
        let values = outputtime[type];
        let adjvalues = Statistics.removeOutliers(values);
        let adjaverage = Statistics.average(adjvalues);
        printer.log(type + ':', "num", values.length, "avg", parseFloat(adjaverage.toFixed(2)), "rem", values.length - adjvalues.length);
    }
};

Statistics.addPageStatistics = function () {
    Debug.execute(() => {
        JSPLib._window.addEventListener('beforeunload', () => {
            Statistics.outputAdjustedMean(JSPLib.program_name);
        });
    }, Debug.INFO);
};

Statistics.outputSortedRecords = function(type = null, begin = 0, end = 10) {
    let records = Debug.getRecords();
    let record_keys = Object.keys(records);
    if (type !== null) {
        record_keys = record_keys.filter((key) => records[key].type === type);
    }
    record_keys.sort((keya, keyb) => (records[keyb].endtime - records[keyb].starttime) - (records[keya].endtime - records[keya].starttime));
    record_keys = record_keys.slice(begin, end);
    record_keys.forEach((key, i) => {
        let record = records[key];
        let total_time = Utility.setPrecision((record.endtime - record.starttime) / 1000, 2);
        let start_time = Utility.setPrecision((record.starttime - Utility._start_time) / 1000, 2);
        let end_time = Utility.setPrecision((record.endtime - Utility._start_time) / 1000, 2);
        console.log(i, record.type, record.entryname, total_time, start_time, end_time);
    });
};

//Statistics functions

Statistics.removeOutliers = function (values, iterations = Infinity) {
    var i = 1;
    var length;
    var newlength;
    do {
        length = values.length;
        let avg = Statistics.average(values);
        let stddev = Statistics.standardDeviation(values);
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

Statistics.standardDeviation = function (values) {
    var avg = Statistics.average(values);
    return Math.sqrt(Statistics.average(values.map((value) => {let diff = value - avg; return diff * diff;})));
};

Statistics.average = function (values) {
    if (values.length) {
        return values.reduce((a, b) => a + b) / values.length;
    }
    return NaN;
};

/****INITIALIZATION****/

JSPLib.initializeModule('Statistics');

})(JSPLib);
