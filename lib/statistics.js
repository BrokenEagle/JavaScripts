/****DEPENDENCIES****/

/**Internal dependencies**/
// JSPLib.Debug (optional)

/****SETUP****/

//Linter configuration
/* global JSPLib */

(function ({Debug}) {

const Statistics = JSPLib.Statistics;

/****PUBLIC FUNCTIONS****/

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
            Statistics.outputAdjustedMean(JSPLib.name);
        });
    }, Debug.INFO);
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
