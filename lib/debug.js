/****SETUP****/

var JSPLib = JSPLib || {};
JSPLib.debug = JSPLib.debug || {};

/****GLOBAL VARIABLES****/

JSPLib.debug.debug_console = false;
JSPLib.debug.records = {};

/****FUNCTIONS****/

//Debug output functions

JSPLib.debug.debuglog = function (args) {
    if (JSPLib.debug.debug_console) {
        console.log.apply(this,arguments);
    }
};

JSPLib.debug.debugTime = function (str) {
    if (JSPLib.debug.debug_console) {
        console.time(str);
    }
};

JSPLib.debug.debugTimeEnd = function (str) {
    if (JSPLib.debug.debug_console) {
        console.timeEnd(str);
    }
};

//Data recording functions

JSPLib.debug.recordTime = function (entryname,type) {
    if (JSPLib.debug.debug_console) {
        let index = entryname + ',' + type;
        JSPLib.debug.records[index] = {
            entryname: entryname,
            type: type,
            starttime: performance.now(),
            endtime: 0};
    }
};

JSPLib.debug.recordTimeEnd = function (entryname,type) {
    if (JSPLib.debug.debug_console) {
        let index = entryname + ',' + type;
        if (!(index in JSPLib.debug.records)) {
            return;
        }
        if (JSPLib.debug.records[index].endtime === 0) {
            JSPLib.debug.records[index].endtime = performance.now();
        }
    }
};

//Print data functions

JSPLib.debug.outputAdjustedMean = function () {
    let outputtime = {};
    $.each(JSPLib.debug.records,(i,val)=>{
        if (!(val.type in outputtime)) {
            outputtime[val.type] = [];
        }
        outputtime[val.type].push(val.endtime-val.starttime);
    });
    $.each(outputtime,(type,values)=>{
        let adjvalues = JSPLib.debug.removeOutliers(values);
        JSPLib.debug.debuglog(type + ':',"num",values.length,"avg",Math.round(100 * JSPLib.debug.average(adjvalues)) / 100,"rem",values.length - adjvalues.length);
    });
};

//Statistics functions

JSPLib.debug.removeOutliers = function (values) {
    do {
        var length = values.length;
        let avg = JSPLib.debug.average(values);
        let stddev = JSPLib.debug.standardDeviation(values);
        let adjvalues = values.filter(val=>{return (Math.abs(val-avg) < (2 * stddev));});
        var newlength = adjvalues.length;
        if (newlength === 0) {
            return values;
        }
        values = adjvalues;
    } while (length != newlength);
    return values;
};

JSPLib.debug.standardDeviation = function (values) {
    var avg = JSPLib.debug.average(values);
    return Math.sqrt(JSPLib.debug.average(values.map(value=>{let diff = value - avg; return diff * diff;})));
};

JSPLib.debug.average = function (values) {
    return values.reduce(function(a, b) { return a + b; })/values.length;
};
