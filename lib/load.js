/**Main program variable dependencies**/
// timer_poll_interval - time to wait between each check
// program_load_max_retries - number of times to check
// program_load_required_variables - array of strings denoting external variables required, e.g. jQuery

/****SETUP****/

//Has debug.js been loaded?
if (debuglog === undefined) {
    var debuglog = ()=>{};
    var debugTime = ()=>{};
    var debugTimeEnd = ()=>{};
}

/****Functions****/

function programLoad(program,timername) {
    if (programLoad.retries >= program_load_max_retries) {
        debuglog("Abandoning program load!");
        clearInterval(programLoad.timer);
        return false;
    }
    for (let i=0;i<program_load_required_variables.length;i++) {
        if (eval(program_load_required_variables[i]) === undefined) {
            debuglog(program_load_required_variables[i] + " not installed yet!");
            programLoad.retries += 1;
            return false;
        }
    }
    clearInterval(programLoad.timer);
    program();
    debugTimeEnd(timername + "-programLoad");
    return true;
}
programLoad.retries = 0;

function programInitialize(program,timername) {
    debugTime(timername + "-programLoad");
    if(!programLoad(program,timername)) {
        programLoad.timer = setInterval(()=>{programLoad(program,timername);},timer_poll_interval);
    }
}
