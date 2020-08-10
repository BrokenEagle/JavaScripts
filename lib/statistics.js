/****SETUP****/

//Linter configuration
/* global JSPLib */

var JSPLib = JSPLib || {};
JSPLib.statistics = JSPLib.statistics || {};

//Has debug.js been loaded?
JSPLib.debug = JSPLib.debug || {};
JSPLib.debug.debuglogLevel = JSPLib.debug.debuglogLevel || (()=>{});
JSPLib.debug.debugExecute = JSPLib.debug.debugExecute || (()=>{});
JSPLib.debug._records = JSPLib.debug._records || {};

/****FUNCTIONS****/

//Print data functions

JSPLib.statistics.outputAdjustedMean = function (tablename = '') {
    if (Object.keys(JSPLib.debug._records).length === 0) {
        return;
    }
    if (tablename !== '') {
        JSPLib.debug.debuglogLevel(`====${tablename} Metrics====`,JSPLib.debug.INFO);
    }
    let outputtime = {};
    let recordkeys = Object.keys(JSPLib.debug._records);
    for (let i = 0;i < recordkeys.length;i++) {
        let val = JSPLib.debug._records[recordkeys[i]];
        if (!(val.type in outputtime)) {
            outputtime[val.type] = [];
        }
        outputtime[val.type].push(val.endtime-val.starttime);
    }
    let outputkeys = Object.keys(outputtime);
    for (let i = 0;i < outputkeys.length;i++) {
        let type = outputkeys[i];
        let values = outputtime[type];
        let adjvalues = this.removeOutliers(values);
        let adjaverage = this.average(adjvalues);
        JSPLib.debug.debuglogLevel(type + ':',"num",values.length,"avg",parseFloat(adjaverage.toFixed(2)),"rem",values.length - adjvalues.length,JSPLib.debug.INFO);
    }
};

JSPLib.statistics.addPageStatistics = function (name) {
    JSPLib.debug.debugExecute(()=>{
        window.addEventListener('beforeunload', ()=>{
            this.outputAdjustedMean(name);
        });
    });
};

//Statistics functions

JSPLib.statistics.removeOutliers = function (values,iterations=Infinity) {
    var i = 1;
    do {
        var length = values.length;
        let avg = this.average(values);
        let stddev = this.standardDeviation(values);
        let adjvalues = values.filter(val=>{return (Math.abs(val-avg) < (2 * stddev));});
        var newlength = adjvalues.length;
        if (newlength === 0) {
            return values;
        }
        values = adjvalues;
        i++;
    } while ((length != newlength) && (i <= iterations));
    return values;
};

JSPLib.statistics.standardDeviation = function (values) {
    var avg = this.average(values);
    return Math.sqrt(this.average(values.map(value=>{let diff = value - avg; return diff * diff;})));
};

JSPLib.statistics.average = function (values) {
    if (values.length) {
        return values.reduce(function(a, b) { return a + b; })/values.length;
    }
    return NaN;
};

/****INITIALIZATION****/

JSPLib.statistics._configuration = {
    nonenumerable: ['_configuration'],
    nonwritable: ['_configuration']
};
Object.defineProperty(JSPLib,'statistics',{configurable:false,writable:false});
for (let property in JSPLib.statistics) {
    if (JSPLib.statistics._configuration.nonenumerable.includes(property)) {
        Object.defineProperty(JSPLib.statistics,property,{enumerable:false});
    }
    if (JSPLib.statistics._configuration.nonwritable.includes(property)) {
        Object.defineProperty(JSPLib.statistics,property,{writable:false});
    }
    Object.defineProperty(JSPLib.statistics,property,{configurable:false});
}
