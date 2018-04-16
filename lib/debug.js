/**Main program variable dependencies**/
// debug_console - boolean that enables or disables debug logging

/****FUNCTIONS****/

//Debug output functions

function debuglog(args) {
    if (debug_console) {
        console.log.apply(this,arguments);
    }
}

function debugTime(str) {
    if (debug_console) {
        console.time(str);
    }
}

function debugTimeEnd(str) {
    if (debug_console) {
        console.timeEnd(str);
    }
}

//Data recording functions

function recordTime(entryname,type) {
    if (debug_console) {
        let index = entryname + ',' + type;
        recordTime.records[index] = {
            entryname: entryname,
            type: type,
            starttime: performance.now(),
            endtime: 0};
    }
}
recordTime.records = {};

function recordTimeEnd(entryname,type) {
    if (debug_console) {
        let index = entryname + ',' + type;
        if (!(index in recordTime.records)) {
            return;
        }
        if (recordTime.records[index].endtime === 0) {
            recordTime.records[index].endtime = performance.now();
        }
    }
}

//Print data functions

function outputAdjustedMean() {
    let outputtime = {};
    $.each(recordTime.records,(i,val)=>{
        if (!(val.type in outputtime)) {
            outputtime[val.type] = [];
        }
        outputtime[val.type].push(val.endtime-val.starttime);
    });
    $.each(outputtime,(type,values)=>{
        let adjvalues = removeOutliers(values);
        debuglog(type + ':',"num",values.length,"avg",Math.round(100*average(adjvalues))/100,"rem",values.length-adjvalues.length);
    });
}

//Statistics functions

function removeOutliers(values) {
    do {
        var length = values.length;
        let avg = average(values);
        let stddev = standardDeviation(values);
        let adjvalues = values.filter(val=>{return (Math.abs(val-avg) < (2 * stddev));});
        var newlength = adjvalues.length;
        if (newlength === 0) {
            return values;
        }
        values = adjvalues;
    } while (length != newlength);
    return values;
}

function standardDeviation(values) {
    var avg = average(values);
    return Math.sqrt(average(values.map(value=>{let diff = value - avg; return diff * diff;})));
}

function average(values) {
    return values.reduce(function(a, b) { return a + b; })/values.length;
}
