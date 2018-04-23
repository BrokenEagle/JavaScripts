/****SETUP****/

var JSPLib = JSPLib || {};
JSPLib.statistics = JSPLib.statistics || {};

//Has debug.js been loaded?
JSPLib.debug = JSPLib.debug || {};
JSPLib.debug.debuglog = JSPLib.debug.debuglog || (()=>{});
JSPLib.debug.records = JSPLib.debug.records || {};

/****FUNCTIONS****/

//Print data functions

JSPLib.statistics.outputAdjustedMean = function (tablename = '') {
    if (Object.keys(JSPLib.debug.records).length === 0) {
        return;
    }
    if (tablename !== '') {
        JSPLib.debug.debuglog(`====${tablename} Metrics====`);
    }
    let outputtime = {};
    let recordkeys = Object.keys(JSPLib.debug.records);
    for (let i = 0;i < recordkeys.length;i++) {
        let val = JSPLib.debug.records[recordkeys[i]];
        if (!(val.type in outputtime)) {
            outputtime[val.type] = [];
        }
        outputtime[val.type].push(val.endtime-val.starttime);
    }
    let outputkeys = Object.keys(outputtime);
    for (let i = 0;i < outputkeys.length;i++) {
        let type = outputkeys[i];
        let values = outputtime[type];
        let adjvalues = JSPLib.statistics.removeOutliers(values);
        let adjaverage = JSPLib.statistics.average(adjvalues);
        JSPLib.debug.debuglog(type + ':',"num",values.length,"avg",parseFloat(adjaverage.toFixed(2)),"rem",values.length - adjvalues.length);
    }
};

//Statistics functions

JSPLib.statistics.removeOutliers = function (values) {
    do {
        var length = values.length;
        let avg = JSPLib.statistics.average(values);
        let stddev = JSPLib.statistics.standardDeviation(values);
        let adjvalues = values.filter(val=>{return (Math.abs(val-avg) < (2 * stddev));});
        var newlength = adjvalues.length;
        if (newlength === 0) {
            return values;
        }
        values = adjvalues;
    } while (length != newlength);
    return values;
};

JSPLib.statistics.standardDeviation = function (values) {
    var avg = JSPLib.statistics.average(values);
    return Math.sqrt(JSPLib.statistics.average(values.map(value=>{let diff = value - avg; return diff * diff;})));
};

JSPLib.statistics.average = function (values) {
    return values.reduce(function(a, b) { return a + b; })/values.length;
};
