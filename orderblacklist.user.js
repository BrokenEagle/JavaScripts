// ==UserScript==
// @name         Order Blacklist
// @namespace    https://github.com/BrokenEagle/JavaScripts
// @version      2
// @source       https://danbooru.donmai.us/users/23799
// @description  Order blacklist tags
// @author       BrokenEagle
// @match        *://*.donmai.us
// @match        *://*.donmai.us/posts*
// @exclude      *://*.donmai.us/posts/*
// @grant        none
// @run-at       document-body
// @downloadURL  https://raw.githubusercontent.com/BrokenEagle/JavaScripts/stable/orderblacklist.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.15.0/lodash.js
// ==/UserScript==

(function() {
'use strict';

///////////////
//Constants

const sleep_wait_time = 1000;
const polling_interval = 500;
const max_async_requests = 25;
const max_window_size = 25;
const debug_console = false;

////////////////
//Classes

//Main application class
class OrderBlacklist {
    constructor(list,logger) {
        this.async_requests = 0;
        list = _.map(list,$.trim);
        this.original_list = _.uniq(list);
        this.working_list = _.cloneDeep(this.original_list);
        this.list_weights = [];
        this.reconstructed_list = [];
        this.reconstructed_html = "";
        this.is_ready = false;
        this.window_size = 0;
        this.logger = logger || {'log':function (){}};
        this.error = false;
        this.unchanged = false;
        this.last_logged = 0;
        this.stage = 0;
        this.stop = false;
    }
    //Set the window size between 0 and max_window_size based upon remaing requests
    setWindow(adder) {
        adder = (this.async_requests>=0?adder:adder*-1);
        this.window_size = Math.min(Math.max(this.window_size + adder,0),max_window_size);
    }
    //////////////////////
    //Logger functions
    alllog(str) {
        this.debuglog(str);
        this.logger.log(str);
    }
    debuglog(args) {
        if (debug_console) {
            console.log.apply(this,arguments);
        }
    }
    //Only update user if there was a change since the last polling interval
    logRemaining(current) {
        let remaining = this.async_requests + this.working_list.length - current;
        if (remaining != this.last_logged) {
            this.alllog(`Requests remaining: ${remaining}`);
            this.last_logged = remaining;
        }
    }
    ///////////////////////
    //Main functions
    //Sequentially process asynchronous requests
    processList() {
        try {
            if (this.stage===0) {
                this.is_running = true;
                console.time("orderProcessList");
                this.alllog("Getting post counts...");
                //Aliases are gotten first since aliases would show up as invalid by the validateTag function
                this.getPostCounts();
                this.stage = 1;
                return;
            }
            if (this.stage==1) {
                this.alllog("Done!");
                this.reconstructed_list = _(this.list_weights).sortBy('count').reverse().map(o=>{return o.tag}).value();
                this.unchanged = _.isEqual(this.reconstructed_list,this.original_list);
                if (this.unchanged) {
                    this.reconstructed_html= "List already ordered!";
                } else {
                    this.reconstructed_html = _(this.reconstructed_list).map(tag=>{let htmltag=sanitizeForHTML(tag);return `<span>${htmltag}</span>`}).value().join('\n');
                }
                this.is_ready = true;
            }
            console.timeEnd("orderProcessList");
        }
        catch (e) {
            this.error = true;
            this.alllog(e.stack);
        }
    }
    //This callback helps serialize all of the stages
    //Callback has window context, so "this" token must be passed to it
    callback() {
        if (this.stop) {return;}
        this.debuglog("Stage:",this.stage);
        this.debuglog("Async:",this.async_requests);
        this.debuglog("ID:",this.id);
        //Don't check for more processing until the last task called is done
        if (this.async_requests !== 0) {
            if (this.last_logged != this.async_requests) {
                this.alllog(`Requests remaining: ${this.async_requests}`);
                this.last_logged = this.async_requests;
            }
            var me = this;
            setTimeout(()=>{me.callback();},polling_interval);
            this.debuglog("Rescheduled");
        } else {
            this.processList();
        }
    }
    ////////////////
    //Tag functions
    async getPostCounts() {
        try {
            for(let i=0;i<this.working_list.length;i++) {
                //Check for stop signal
                if (this.stop) {this.is_running=false;return;}
                //Throttles the requests to avoid killing the processor
                if (this.async_requests > (max_async_requests+this.window_size)) {
                    this.logRemaining(i);
                    let temp = await sleep(sleep_wait_time);
                    this.setWindow(1);
                }
                let tag = this.working_list[i];
                //We increment the async_requests counter... the $ callback decrements it
                this.async_requests++;
                const resp = $.getJSON('/counts/posts',{'tags':tag},data=>{
                    let entry = {};
                    entry.tag = tag;
                    entry.count = data.counts.posts;
                    this.list_weights.push(entry);
                }).always(()=>{
                    this.async_requests--;
                });
            }
            //Go to callback function to wait for any outstanding requests to complete
            var me = this;
            setTimeout(()=>{me.callback();},polling_interval);
        }
        catch (e) {
            this.error = true;
            this.alllog(e.stack);
        }
    }
    //////////////////////
    //Control functions
    allstop() {
        this.stop = true;
    }
    //Wait to call reset until all lists are no longer running
    reset() {
        this.async_requests = 0;
        this.working_list = _.cloneDeep(this.original_list);
        this.list_weights = [];
        this.reconstructed_list = [];
        this.reconstructed_html = "";
        this.is_ready = false;
        this.window_size = 0;
        this.error = false;
        this.unchanged = false;
        this.combos_started = false;
        this.last_logged = 0;
        this.stage = 0;
        this.stop = false;
    }
}

//Simple class for writing to a <textarea>
class TextboxLogger {
    constructor(selector) {
        this.$element = $(selector);
    }
    log(textinput,end='\n') {
        let data = this.$element.val();
        this.$element.val(data + textinput + end);
        this.$element.scrollTop(this.$element[0].scrollHeight);
    }
    clear() {
        this.$element.val('');
    }
}

////////////////////////
//Utility functions

function sanitizeForHTML(str) {
    return str.replace(/&/g,'&amp;').replace(/>/g,'&gt;').replace(/</g,'&lt;');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

//Export list
if(window.OrderBlacklist===undefined) {window.OrderBlacklist = OrderBlacklist;}
if(window.TextboxLogger===undefined) {window.TextboxLogger = TextboxLogger;}

})();
