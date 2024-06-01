/****DEPENDENCIES****/

/**Internal dependencies**/
// JSPLib.utility

/****SETUP****/

//Linter configuration
/* global JSPLib */

JSPLib.statistics = {};

/****FUNCTIONS****/

//Print data functions

JSPLib.statistics.outputAdjustedMean = function (self, tablename = '') {
    if (Object.keys(JSPLib.debug._records).length === 0) {
        return;
    }
    if (tablename !== '') {
        self.debug('logLevel', `====${tablename} Metrics====`, JSPLib.debug.INFO);
    }
    let outputtime = {};
    let recordkeys = Object.keys(JSPLib.debug._records);
    for (let i = 0;i < recordkeys.length;i++) {
        let val = JSPLib.debug._records[recordkeys[i]];
        if (!(val.type in outputtime)) {
            outputtime[val.type] = [];
        }
        outputtime[val.type].push(val.endtime - val.starttime);
    }
    let outputkeys = Object.keys(outputtime);
    for (let i = 0;i < outputkeys.length;i++) {
        let type = outputkeys[i];
        let values = outputtime[type];
        let adjvalues = this.removeOutliers(values);
        let adjaverage = this.average(adjvalues);
        self.debug('logLevel', type + ':', "num", values.length, "avg", parseFloat(adjaverage.toFixed(2)), "rem", values.length - adjvalues.length, JSPLib.debug.INFO);
    }
};

JSPLib.statistics.addPageStatistics = function (name) {
    JSPLib.debug.debugExecute(() => {
        JSPLib._window.addEventListener('beforeunload', () => {
            this.outputAdjustedMean(name);
        });
    });
};

JSPLib.statistics.outputSortedRecords = function(type = null, begin = 0, end = 10) {
    let records = JSPLib.debug._records;
    let record_keys = Object.keys(records);
    if (type !== null) {
        record_keys = record_keys.filter((key) => records[key].type === type);
    }
    record_keys.sort((keya, keyb) => (records[keyb].endtime - records[keyb].starttime) - (records[keya].endtime - records[keya].starttime));
    record_keys = record_keys.slice(begin, end);
    record_keys.forEach((key, i) => {
        let record = records[key];
        let total_time = JSPLib.utility.setPrecision((record.endtime - record.starttime) / 1000, 2);
        let start_time = JSPLib.utility.setPrecision((record.starttime - JSPLib.utility._start_time) / 1000, 2);
        let end_time = JSPLib.utility.setPrecision((record.endtime - JSPLib.utility._start_time) / 1000, 2);
        console.log(i, record.type, record.entryname, total_time, start_time, end_time);
    });
};

//Statistics functions

JSPLib.statistics.removeOutliers = function (values, iterations = Infinity) {
    var i = 1;
    var length;
    var newlength;
    do {
        length = values.length;
        let avg = this.average(values);
        let stddev = this.standardDeviation(values);
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

JSPLib.statistics.standardDeviation = function (values) {
    var avg = this.average(values);
    return Math.sqrt(this.average(values.map((value) => {let diff = value - avg; return diff * diff;})));
};

JSPLib.statistics.average = function (values) {
    if (values.length) {
        return values.reduce((a, b) => a + b) / values.length;
    }
    return NaN;
};

/****INITIALIZATION****/

JSPLib.statistics._configuration = {
    nonenumerable: [],
    nonwritable: []
};
JSPLib.initializeModule('statistics');
JSPLib.debug.addModuleLogs('statistics', ['outputAdjustedMean']);
